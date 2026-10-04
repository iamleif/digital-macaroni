"""
Streaming speech-to-text for the cascade. Two interchangeable transcribers take the visitor's audio
(16 kHz PCM16), are told when our own silence detector thinks the visitor has stopped, and yield
("interim", text) for the utterance so far and ("final", text) once it is finished:

- AssemblyAI Universal-3.6 Pro (the default): most accurate on phone audio in our side-by-side test
  (97% of key facts on noisy phone lines against 70% for Gemini), about 0.43 s to a final.
- Gemini 3.5 Transcribe Live: all-Google fallback (DEMO_STT_PROVIDER=gemini).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Optional, Protocol
from urllib.parse import urlencode

import websockets
from google import genai
from google.genai import types

from . import log
from .config import config

Event = tuple[str, str]
# AssemblyAI takes audio messages of 50 to 1000 ms; ours arrive in 20 ms frames, so they are batched.
ASSEMBLY_BATCH_BYTES = 3200  # 100 ms of 16 kHz PCM16
ASSEMBLY_MIN_BYTES = 1600  # 50 ms
ASSEMBLY_MAX_TERMS = 100


class Transcriber(Protocol):
    async def send(self, pcm16k: bytes) -> None: ...

    async def end_of_speech(self) -> None:
        """Our silence detector thinks the visitor has stopped: finalise what was said, now."""

    def events(self) -> AsyncIterator[Event]: ...

    async def close(self) -> None: ...


class AssemblyTranscriber:
    def __init__(self, ws: Any) -> None:
        self.ws = ws
        self.buf = bytearray()
        self.finished_turns: set[int] = set()

    async def send(self, pcm16k: bytes) -> None:
        self.buf += pcm16k
        if len(self.buf) >= ASSEMBLY_BATCH_BYTES:
            await self._flush()

    async def _flush(self) -> None:
        if not self.buf:
            return
        if len(self.buf) < ASSEMBLY_MIN_BYTES:
            self.buf += bytes(ASSEMBLY_MIN_BYTES - len(self.buf))
        data, self.buf = bytes(self.buf), bytearray()
        await self.ws.send(data)

    async def end_of_speech(self) -> None:
        await self._flush()
        await self.ws.send(json.dumps({"type": "ForceEndpoint"}))

    async def events(self) -> AsyncIterator[Event]:
        async for raw in self.ws:
            if isinstance(raw, bytes):
                continue
            e = json.loads(raw)
            kind = e.get("type")
            if kind == "Turn":
                order = e.get("turn_order", -1)
                if e.get("end_of_turn"):
                    # One final per turn: a formatted repeat of the same turn is not a new utterance.
                    if order not in self.finished_turns and (text := (e.get("transcript") or "").strip()):
                        self.finished_turns.add(order)
                        yield ("final", text)
                elif order not in self.finished_turns:
                    words = e.get("words") or []
                    text = " ".join(w.get("text", "") for w in words).strip() or (e.get("transcript") or "").strip()
                    if text:
                        yield ("interim", text)
            elif kind == "Error" or "error" in e:
                raise RuntimeError(f"assemblyai {e.get('error_code', '')}: {str(e.get('error', ''))[:120]}")

    async def close(self) -> None:
        try:
            await self.ws.send(json.dumps({"type": "Terminate"}))
            await self.ws.close()
        except Exception:  # noqa: BLE001
            pass


class GeminiTranscriber:
    def __init__(self, cm: Any, session: Any) -> None:
        self.cm = cm
        self.session = session

    async def send(self, pcm16k: bytes) -> None:
        await self.session.send_realtime_input(audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000"))

    async def end_of_speech(self) -> None:
        # Makes the model finalise at once instead of waiting on its own detector.
        await self.session.send_realtime_input(audio_stream_end=True)

    async def events(self) -> AsyncIterator[Event]:
        while True:
            async for msg in self.session.receive():
                sc = msg.server_content
                if not sc:
                    continue
                if sc.interim_input_transcription and sc.interim_input_transcription.text:
                    yield ("interim", sc.interim_input_transcription.text)
                if sc.input_transcription and sc.input_transcription.text:
                    yield ("final", sc.input_transcription.text)

    async def close(self) -> None:
        try:
            await self.cm.__aexit__(None, None, None)
        except Exception:  # noqa: BLE001
            pass


async def open_transcriber(vocabulary: list[str], gemini: Optional[genai.Client] = None) -> Transcriber:
    """The configured transcriber; Gemini when AssemblyAI is chosen but has no key."""
    if config.stt_provider == "assemblyai" and config.assemblyai_api_key:
        params = {"speech_model": config.assemblyai_model, "encoding": "pcm_s16le", "sample_rate": 16000}
        if vocabulary:
            params["keyterms_prompt"] = json.dumps(vocabulary[:ASSEMBLY_MAX_TERMS])
        url = "wss://streaming.assemblyai.com/v3/ws?" + urlencode(params)
        ws = await asyncio.wait_for(websockets.connect(url, additional_headers={"Authorization": config.assemblyai_api_key}, max_size=None), timeout=8)
        return AssemblyTranscriber(ws)
    if config.stt_provider == "assemblyai":
        log.warn("stt.assemblyai_unconfigured", {"outcome": "gemini"})
    client = gemini or genai.Client(api_key=config.gemini_api_key)
    stt_config = types.LiveConnectConfig(
        response_modalities=[types.Modality.TEXT],
        input_audio_transcription=types.AudioTranscriptionConfig(custom_vocabulary=vocabulary or None),
        # The model's own end-of-speech detector is the backstop; ours is quicker.
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH, silence_duration_ms=config.end_of_speech_silence_ms)
        ),
    )
    cm = client.aio.live.connect(model=config.stt_model, config=stt_config)
    session = await asyncio.wait_for(cm.__aenter__(), timeout=8)
    return GeminiTranscriber(cm, session)
