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
import re
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
# AssemblyAI accepts at most this many characters of agent context.
AGENT_CONTEXT_MAX = 1750
_MARKDOWN = re.compile(r"!?\[([^\]]*)\]\([^)]*\)|[*_#>`~|]+")
_IDS = re.compile(r"\b(?:[a-z]{2,5}_[A-Za-z0-9]{6,}|[0-9a-f]{8}-[0-9a-f-]{27})\b")


def _letters(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def clean_context(text: str) -> str:
    """Agent text as AssemblyAI should see it: no markdown or ids, at most the last 1750 characters, cut at a word."""
    t = _MARKDOWN.sub(lambda m: m.group(1) or " ", text or "")
    t = re.sub(r"\s+", " ", _IDS.sub(" ", t)).strip()
    if len(t) > AGENT_CONTEXT_MAX:
        t = t[-AGENT_CONTEXT_MAX:]
        t = t.split(" ", 1)[1] if " " in t[:40] else t
    return t


class Transcriber(Protocol):
    # The transcriber's own end-of-turn model decides when the visitor has finished (AssemblyAI); when
    # False, our silence detector does (Gemini), and replies may start speculatively from interims.
    decides_turns: bool

    async def send(self, pcm16k: bytes) -> None: ...

    async def end_of_speech(self) -> None:
        """Our silence detector thinks the visitor has stopped: finalise what was said, now."""

    async def force_end(self) -> None:
        """A long silence and still no final: end the turn regardless."""

    def events(self) -> AsyncIterator[Event]: ...

    async def set_agent_context(self, text: str) -> None:
        """Tells the transcriber what the agent just said, so it hears the answer better. Optional."""

    async def close(self) -> None: ...


class AssemblyTranscriber:
    # Its end-of-turn model tells a pause mid-thought from the end of one; forcing an endpoint at our
    # 0.3 s silence split callers' sentences into separate turns.
    decides_turns = True

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
        # Not forced: AssemblyAI ends the turn itself (see decides_turns).
        await self._flush()

    async def force_end(self) -> None:
        # The backstop when its own end-of-turn has not come after a long silence.
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
                    # The turn's own transcript is punctuated, which is what tells a finished sentence from a
                    # trailing one; the bare words (which can run ahead of it) are used when they say more.
                    words = e.get("words") or []
                    bare = " ".join(w.get("text", "") for w in words).strip()
                    formatted = (e.get("transcript") or "").strip()
                    text = formatted if len(_letters(formatted)) >= len(_letters(bare)) else bare
                    if text:
                        yield ("interim", text)
            elif kind == "Error" or "error" in e:
                raise RuntimeError(f"assemblyai {e.get('error_code', '')}: {str(e.get('error', ''))[:120]}")

    async def set_agent_context(self, text: str) -> None:
        # Sent while the reply is still being spoken; a failure here must never end the call.
        context = clean_context(text)
        if not context or not config.agent_context:
            return
        try:
            await self.ws.send(json.dumps({"type": "UpdateConfiguration", "agent_context": context}))
        except Exception as err:  # noqa: BLE001
            log.warn("stt.agent_context_failed", {"outcome": "ignored"}, err)

    async def close(self) -> None:
        try:
            await self.ws.send(json.dumps({"type": "Terminate"}))
            await self.ws.close()
        except Exception:  # noqa: BLE001
            pass


class GeminiTranscriber:
    decides_turns = False

    def __init__(self, cm: Any, session: Any) -> None:
        self.cm = cm
        self.session = session

    async def send(self, pcm16k: bytes) -> None:
        await self.session.send_realtime_input(audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000"))

    async def set_agent_context(self, text: str) -> None:
        return None

    async def end_of_speech(self) -> None:
        # Makes the model finalise at once instead of waiting on its own detector.
        await self.session.send_realtime_input(audio_stream_end=True)

    async def force_end(self) -> None:
        # end_of_speech already finalised.
        return None

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


async def open_transcriber(vocabulary: list[str], gemini: Optional[genai.Client] = None, agent_context: str = "") -> Transcriber:
    """The configured transcriber; Gemini when AssemblyAI is chosen but has no key."""
    if config.stt_provider == "assemblyai" and config.assemblyai_api_key:
        params = {"speech_model": config.assemblyai_model, "encoding": "pcm_s16le", "sample_rate": 16000}
        if vocabulary:
            params["keyterms_prompt"] = json.dumps(vocabulary[:ASSEMBLY_MAX_TERMS])
        context = clean_context(agent_context) if config.agent_context and config.assemblyai_model == "universal-3-6-pro" else ""
        if context:
            params["agent_context"] = context
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
