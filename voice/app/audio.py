"""
Telephone audio conversion. Twilio carries 8 kHz G.711 mu-law; Gemini Live takes 16 kHz and returns
24 kHz 16-bit little-endian PCM.
"""

from __future__ import annotations

import math

import numpy as np

BIAS = 0x84
CLIP = 32635


def mu_law_to_linear(byte: int) -> int:
    """G.711 mu-law byte to a 16-bit linear sample."""
    u = ~byte & 0xFF
    sign = u & 0x80
    exponent = (u >> 4) & 0x07
    mantissa = u & 0x0F
    magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS
    return -magnitude if sign and magnitude else magnitude


def linear_to_mu_law(sample: float) -> int:
    """A 16-bit linear sample to a G.711 mu-law byte."""
    s = max(-32768, min(32767, round(sample)))
    sign = 0x80 if s < 0 else 0
    if sign:
        s = -s
    s = min(s, CLIP) + BIAS
    exponent = 7
    mask = 0x4000
    while (s & mask) == 0 and exponent > 0:
        exponent -= 1
        mask >>= 1
    mantissa = (s >> (exponent + 3)) & 0x0F
    return ~(sign | (exponent << 4) | mantissa) & 0xFF


# Lookup tables: every mu-law byte, and every 16-bit sample.
MU_TO_LIN = np.array([mu_law_to_linear(b) for b in range(256)], dtype=np.int16)
_LIN_TO_MU = np.array([linear_to_mu_law(s) for s in range(-32768, 32768)], dtype=np.uint8)


def encode_mu_law(samples: np.ndarray) -> bytes:
    clipped = np.clip(np.rint(samples), -32768, 32767).astype(np.int32)
    return _LIN_TO_MU[clipped + 32768].tobytes()


def resample(x: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    """Linear-interpolation resampling of 16-bit samples. Adequate for telephone-band speech."""
    if from_rate == to_rate or len(x) == 0:
        return x
    length = (len(x) * to_rate) // from_rate
    pos = np.arange(length) * (from_rate / to_rate)
    j = np.floor(pos).astype(np.int64)
    frac = pos - j
    a = x[j].astype(np.float64)
    b = np.where(j + 1 < len(x), x[np.minimum(j + 1, len(x) - 1)], x[j]).astype(np.float64)
    return np.rint(a + (b - a) * frac).astype(np.int16)


def twilio_to_gemini(mu: bytes) -> bytes:
    """Twilio media (mu-law, 8 kHz) to PCM16 at 16 kHz for Gemini Live."""
    pcm8 = MU_TO_LIN[np.frombuffer(mu, dtype=np.uint8)]
    return resample(pcm8, 8000, 16000).astype("<i2").tobytes()


def gemini_to_twilio(pcm24: bytes) -> bytes:
    """Gemini Live audio (PCM16 LE, 24 kHz) to Twilio mu-law at 8 kHz, by plain per-chunk resampling."""
    x = np.frombuffer(pcm24, dtype="<i2")
    return encode_mu_law(resample(x, 24000, 8000).astype(np.float64))


class PhoneEncoder:
    """
    Gemini audio (24 kHz PCM16) to Twilio (8 kHz mu-law), for one call. A windowed-sinc low-pass at
    3.6 kHz runs before keeping every third sample, so the voice's upper harmonics do not fold back as
    buzz; the filter state carries across chunks, so chunk edges join without clicks.
    """

    TAPS = 63

    def __init__(self) -> None:
        cutoff = 3600 / 24000
        m = np.arange(self.TAPS) - (self.TAPS - 1) / 2
        with np.errstate(divide="ignore", invalid="ignore"):
            sinc = np.where(m == 0, 2 * cutoff, np.sin(2 * math.pi * cutoff * m) / (math.pi * m))
        hamming = 0.54 - 0.46 * np.cos(2 * math.pi * np.arange(self.TAPS) / (self.TAPS - 1))
        h = sinc * hamming
        self.h = h / h.sum()
        self.reset()

    def encode(self, pcm24: bytes) -> bytes:
        x = np.frombuffer(pcm24, dtype="<i2").astype(np.float64)
        n = len(x)
        buf = np.concatenate([self.history, x])
        idx = np.arange(self.next, n, 3)
        if len(idx):
            # Output at input index i uses buf[i .. i + TAPS - 1] (history first), newest sample last.
            windows = np.lib.stride_tricks.sliding_window_view(buf, self.TAPS)[idx]
            out = windows @ self.h[::-1]
        else:
            out = np.empty(0)
        last = idx[-1] if len(idx) else self.next - 3
        self.next = last + 3 - n
        self.history = buf[len(buf) - (self.TAPS - 1) :]
        return encode_mu_law(out)

    def reset(self) -> None:
        """After an interruption, start clean rather than blending into audio that was cleared."""
        self.history = np.zeros(self.TAPS - 1)
        self.next = 0


def rms(pcm16: bytes) -> float:
    x = np.frombuffer(pcm16, dtype="<i2").astype(np.float64)
    return float(np.sqrt(np.mean(x * x))) if len(x) else 0.0


def voice_stats(pcm: bytes, rate: int = 24000) -> dict[str, float]:
    """Pitch and loudness of a stretch of the agent's speech (24 kHz PCM16), for diagnosing voice
    changes during a call. Numbers only: no audio is kept."""
    x = np.frombuffer(pcm, dtype="<i2").astype(np.float64) / 32768
    n = len(x)
    frame = round(rate * 0.04)
    pitches: list[float] = []
    levels: list[float] = []
    min_lag, max_lag = round(rate / 400), round(rate / 70)
    # Every third voiced frame is enough for a stable median and keeps the cost low.
    for s in range(0, n - frame + 1, frame * 3):
        f = x[s : s + frame]
        level = math.sqrt(float(np.mean(f * f)))
        if level < 0.02:
            continue
        levels.append(level)
        scores = []
        for lag in range(min_lag, max_lag + 1):
            a = f[0 : frame - lag : 2]
            b = f[lag:frame:2]
            scores.append(float(np.dot(a, b)) / math.sqrt(float(np.dot(a, a)) * float(np.dot(b, b)) + 1e-9))
        # The shortest period that matches nearly as well as the best: avoids reading half the pitch.
        best = max(scores)
        k = next(i for i, r in enumerate(scores) if r >= best * 0.92)
        while k + 1 < len(scores) and scores[k + 1] >= scores[k]:
            k += 1
        if best > 0.6:
            pitches.append(rate / (min_lag + k))

    def median(a: list[float]) -> float:
        return sorted(a)[len(a) // 2] if a else 0.0

    return {"seconds": round(n / rate, 1), "pitchHz": round(median(pitches)), "loudnessDb": round(20 * math.log10(median(levels) or 1e-6), 1)}
