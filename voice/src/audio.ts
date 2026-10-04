/**
 * Telephone audio conversion, from Anders (services/voice/src/audio.ts). Twilio carries 8 kHz G.711
 * mu-law; Gemini Live takes 16 kHz and returns 24 kHz 16-bit little-endian PCM.
 */

const BIAS = 0x84;
const CLIP = 32635;

/** G.711 mu-law byte to a 16-bit linear sample. */
export function muLawToLinear(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign && magnitude ? -magnitude : magnitude;
}

/** A 16-bit linear sample to a G.711 mu-law byte. */
export function linearToMuLaw(sample: number): number {
  let s = Math.max(-32768, Math.min(32767, Math.round(sample)));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Linear-interpolation resampling of 16-bit samples. Adequate for telephone-band speech. */
export function resample(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input;
  const length = Math.floor((input.length * toRate) / fromRate);
  const out = new Int16Array(length);
  const step = fromRate / toRate;
  for (let i = 0; i < length; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = input[j] ?? 0;
    const b = input[j + 1] ?? a;
    out[i] = Math.round(a + (b - a) * frac);
  }
  return out;
}

/** Twilio media payload (base64 mu-law, 8 kHz) to base64 PCM16 at 16 kHz for Gemini Live. */
export function twilioToGemini(payloadBase64: string): string {
  const mu = Buffer.from(payloadBase64, "base64");
  const pcm8 = new Int16Array(mu.length);
  for (let i = 0; i < mu.length; i++) pcm8[i] = muLawToLinear(mu[i]!);
  const pcm16 = resample(pcm8, 8000, 16000);
  return Buffer.from(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength).toString("base64");
}

/** Gemini Live audio (base64 PCM16 little-endian, 24 kHz) to a Twilio payload (base64 mu-law, 8 kHz). */
export function geminiToTwilio(pcmBase64: string): string {
  const bytes = Buffer.from(pcmBase64, "base64");
  const pcm24 = new Int16Array(bytes.length >> 1);
  for (let i = 0; i < pcm24.length; i++) pcm24[i] = bytes.readInt16LE(i * 2);
  const pcm8 = resample(pcm24, 24000, 8000);
  const mu = Buffer.alloc(pcm8.length);
  for (let i = 0; i < pcm8.length; i++) mu[i] = linearToMuLaw(pcm8[i]!);
  return mu.toString("base64");
}

/**
 * Gemini audio (24 kHz PCM16) to Twilio (8 kHz mu-law), for one call. A windowed-sinc low-pass at
 * 3.6 kHz runs before keeping every third sample, so the voice's upper harmonics do not fold back as
 * buzz; the filter state carries across chunks, so chunk edges join without clicks. Replaces the
 * per-chunk linear resampling for the phone's outbound audio.
 */
export function createPhoneEncoder(): { encode(pcm24kBase64: string): string; reset(): void } {
  const TAPS = 63;
  const cutoff = 3600 / 24000;
  const h = new Float32Array(TAPS);
  let sum = 0;
  for (let i = 0; i < TAPS; i++) {
    const m = i - (TAPS - 1) / 2;
    const sinc = m === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * m) / (Math.PI * m);
    const hamming = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (TAPS - 1));
    h[i] = sinc * hamming;
    sum += h[i]!;
  }
  for (let i = 0; i < TAPS; i++) h[i]! /= sum;

  let history = new Float32Array(TAPS - 1);
  let next = 0;
  return {
    encode(pcm24kBase64) {
      const bytes = Buffer.from(pcm24kBase64, "base64");
      const n = bytes.length >> 1;
      const buf = new Float32Array(TAPS - 1 + n);
      buf.set(history);
      for (let i = 0; i < n; i++) buf[TAPS - 1 + i] = bytes.readInt16LE(i * 2);
      const out: number[] = [];
      let i = next;
      for (; i < n; i += 3) {
        const k = TAPS - 1 + i;
        let acc = 0;
        for (let j = 0; j < TAPS; j++) acc += h[j]! * buf[k - j]!;
        out.push(linearToMuLaw(acc));
      }
      next = i - n;
      history = buf.slice(buf.length - (TAPS - 1));
      return Buffer.from(out).toString("base64");
    },
    /** After an interruption, start clean rather than blending into audio that was cleared. */
    reset() {
      history = new Float32Array(TAPS - 1);
      next = 0;
    },
  };
}

/**
 * Pitch and loudness of a stretch of the agent's speech (24 kHz PCM16), for diagnosing voice
 * changes during a call. Numbers only: no audio is kept.
 */
export function voiceStats(pcm: Buffer, rate = 24000): { seconds: number; pitchHz: number; loudnessDb: number } {
  const n = pcm.length >> 1;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  const frame = Math.round(rate * 0.04);
  const pitches: number[] = [];
  const levels: number[] = [];
  // Every third voiced frame is enough for a stable median and keeps the cost low.
  for (let s = 0; s + frame <= n; s += frame * 3) {
    let e = 0;
    for (let i = 0; i < frame; i++) e += x[s + i]! ** 2;
    const rms = Math.sqrt(e / frame);
    if (rms < 0.02) continue;
    levels.push(rms);
    const minLag = Math.round(rate / 400);
    const scores: number[] = [];
    for (let lag = minLag; lag <= Math.round(rate / 70); lag++) {
      let c = 0, e1 = 0, e2 = 0;
      for (let i = 0; i + lag < frame; i += 2) {
        c += x[s + i]! * x[s + i + lag]!;
        e1 += x[s + i]! ** 2;
        e2 += x[s + i + lag]! ** 2;
      }
      scores.push(c / Math.sqrt(e1 * e2 + 1e-9));
    }
    // The shortest period that matches nearly as well as the best: avoids reading half the pitch.
    const best = Math.max(...scores);
    let k = scores.findIndex((r) => r >= best * 0.92);
    while (k + 1 < scores.length && scores[k + 1]! >= scores[k]!) k++;
    const bestLag = minLag + k;
    if (best > 0.6) pitches.push(rate / bestLag);
  }
  const median = (a: number[]) => (a.length ? a.sort((p, q) => p - q)[Math.floor(a.length / 2)]! : 0);
  return { seconds: Math.round((n / rate) * 10) / 10, pitchHz: Math.round(median(pitches)), loudnessDb: Math.round(20 * Math.log10(median(levels) || 1e-6) * 10) / 10 };
}
