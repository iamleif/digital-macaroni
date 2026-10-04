"""
Gemini Live through Google's Agent Development Kit (Python): one LlmAgent per demo, one in-memory
ADK session per demo session, audio in through a LiveRequestQueue, ADK running the tools.
Transport-independent: the phone bridge and the browser socket both speak LiveSession.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional, Protocol

from google import genai
from google.adk.agents import LiveRequestQueue, LlmAgent, RunConfig
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.agents.run_config import StreamingMode
from google.adk.runners import InMemoryRunner
from google.genai import types

from . import log
from .config import config
from .demos import demos
from .demos.types import OpContext
from .session import DemoSession, get_session
from .tools import demo_tools


@dataclass
class LiveEvent:
    # "audio" (24 kHz PCM16 in data), "interrupted", "turn_complete", "transcript",
    # "transcript_set" (ElevenLabs: the visitor's whole utterance so far) or
    # "agent_correction" (ElevenLabs: what the agent actually said before an interruption).
    type: str
    data: bytes = b""
    speaker: str = ""
    text: str = ""
    finished: bool = False


class LiveSession(Protocol):
    # The engine speaks its own opening line, so no greeting note is needed.
    greets_itself: bool

    def send_audio(self, pcm16k: bytes) -> None: ...

    def send_text(self, text: str) -> None:
        """A note to the model from the system (not visitor speech), such as "greet the caller now"."""

    def events(self) -> AsyncIterator[LiveEvent]: ...

    async def close(self) -> None: ...


# ADK's own logging could include conversation text; keep it quiet except when debugging locally.
for _name in ("google_adk", "google_genai", "google.adk", "google.genai"):
    logging.getLogger(_name).setLevel(logging.DEBUG if config.debug_adk else logging.CRITICAL)

PHONE_NOTE = """

This is a phone call. The caller may be watching the demo dashboard on the website: the page shows a four-digit code they can type on their keypad (you will be told when it links) or read out to you, in which case call link_screen with the digits. Only bring it up if they ask how to see the screen."""
BROWSER_NOTE = """

This conversation is in the visitor's web browser; they can see the dashboard update as you work."""


def full_instruction(session: DemoSession) -> str:
    from datetime import datetime, timezone

    ctx = OpContext(now=datetime.now(timezone.utc), channel=session.channel)  # type: ignore[arg-type]
    return session.demo.instruction(session.state, ctx) + (PHONE_NOTE if session.channel == "phone" else BROWSER_NOTE)


def _instruction_for(demo_id: str):
    def provide(ctx: ReadonlyContext) -> str:
        s = get_session(ctx.session.id)
        if s is None:
            return "The session has ended. Say goodbye."
        return full_instruction(s)

    return provide


def _runner(demo_id: str) -> InMemoryRunner:
    agent = LlmAgent(name=f"{demo_id}_voice", model=config.model, instruction=_instruction_for(demo_id), tools=demo_tools(demos[demo_id]))
    return InMemoryRunner(agent=agent, app_name=f"{demo_id}_voice")


runners = {demo_id: _runner(demo_id) for demo_id in demos}


async def warm_up() -> int:
    """
    The first live connection a process makes takes about three seconds longer than later ones.
    Opening and closing one connection at start-up, and again every few minutes, keeps that delay
    away from visitors. No content is sent, so it uses no model input or output.
    """
    started = time.monotonic()
    try:
        client = genai.Client(api_key=config.gemini_api_key)
        async with asyncio.timeout(10):
            async with client.aio.live.connect(model=config.model, config=types.LiveConnectConfig(response_modalities=[types.Modality.AUDIO])):
                pass
    except Exception:  # noqa: BLE001
        # A failed warm-up only means the next visitor waits a little longer.
        pass
    return int((time.monotonic() - started) * 1000)


class GeminiLive:
    greets_itself = False

    def __init__(self, session: DemoSession) -> None:
        self.session = session
        self.runner = runners[session.demo_id]
        self.app_name = f"{session.demo_id}_voice"
        self.queue = LiveRequestQueue()
        self.out: asyncio.Queue[Optional[LiveEvent]] = asyncio.Queue()
        self.pump: Optional[asyncio.Task[None]] = None
        self.closed = False

    async def start(self) -> None:
        await self.runner.session_service.create_session(app_name=self.app_name, user_id=self.session.id, session_id=self.session.id)
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=config.voices[self.session.demo_id]))),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            # Reply sooner after the visitor stops; a pause shorter than this does not end their turn.
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH, silence_duration_ms=config.end_of_speech_silence_ms)
            ),
        )
        stream = self.runner.run_live(user_id=self.session.id, session_id=self.session.id, live_request_queue=self.queue, run_config=run_config)
        self.pump = asyncio.create_task(self._pump(stream))

    async def _pump(self, stream: AsyncIterator[Any]) -> None:
        try:
            async for event in stream:
                for e in _map_event(event):
                    self.out.put_nowait(e)
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            if not self.closed:
                log.warn("live.stream_error", {"session": self.session.id}, err)
        finally:
            self.out.put_nowait(None)

    def send_audio(self, pcm16k: bytes) -> None:
        if not self.closed:
            self.queue.send_realtime(types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000"))

    def send_text(self, text: str) -> None:
        if not self.closed:
            self.queue.send_content(types.Content(role="user", parts=[types.Part(text=text)]))

    async def events(self) -> AsyncIterator[LiveEvent]:
        while True:
            e = await self.out.get()
            if e is None:
                return
            yield e

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.queue.close()
        if self.pump:
            self.pump.cancel()
        try:
            await self.runner.session_service.delete_session(app_name=self.app_name, user_id=self.session.id, session_id=self.session.id)
        except Exception:  # noqa: BLE001
            pass


def _map_event(event: Any) -> list[LiveEvent]:
    out: list[LiveEvent] = []
    if event.interrupted:
        out.append(LiveEvent("interrupted"))
    if event.content and event.content.parts:
        for part in event.content.parts:
            blob = part.inline_data
            if blob and blob.data and (blob.mime_type or "").startswith("audio/"):
                out.append(LiveEvent("audio", data=blob.data))
    if event.input_transcription and event.input_transcription.text:
        out.append(LiveEvent("transcript", speaker="visitor", text=event.input_transcription.text, finished=bool(event.input_transcription.finished)))
    if event.output_transcription and event.output_transcription.text:
        out.append(LiveEvent("transcript", speaker="agent", text=event.output_transcription.text, finished=bool(event.output_transcription.finished)))
    if event.turn_complete:
        out.append(LiveEvent("turn_complete"))
    return out


async def open_live(session: DemoSession) -> LiveSession:
    """
    Opens the demo's live agent on its own engine. The demos are separate products: Northline on
    Gemini Live, Form & Field on ElevenLabs Agents when configured, Waypoint on the cascade (cascade.py). A demo configured for ElevenLabs
    never falls back to Gemini; if ElevenLabs cannot start, the caller is told the demo is unavailable.
    """
    if session.demo_id in config.cascade_demos:
        from .cascade import open_cascade

        live = await open_cascade(session)
        log.info("live.engine", {"session": session.id, "outcome": "cascade"})
        return live
    agent_id = config.elevenlabs_agents.get(session.demo_id)
    if agent_id:
        from .elevenlabs import open_elevenlabs

        live = await open_elevenlabs(session, agent_id, full_instruction(session))
        log.info("live.engine", {"session": session.id, "outcome": "elevenlabs"})
        return live
    g = GeminiLive(session)
    await g.start()
    return g


# Transcripts can carry markers such as <no speech>, {pause} or voice tags like [cheerful]; they are not words.
_MARKERS = re.compile(r"<[^>]*>|\{[^}]*\}|\[[a-z][a-z \-]{0,24}\]", re.IGNORECASE)


class TranscriptTracker:
    """
    Turns the live stream's transcript pieces into utterances for the conversation panel. Each
    utterance is emitted under one id and replaced in place; it is final when the other side starts
    or the turn completes. A finished agent transcript that is the whole utterance replaces the
    fragments; one that is only the last piece is appended.
    """

    def __init__(self, session: DemoSession) -> None:
        self.session = session
        self.seq = 0
        self.visitor: Optional[dict[str, str]] = None
        self.agent: Optional[dict[str, str]] = None
        self.last_agent: Optional[str] = None

    def _emit(self, speaker: str, u: dict[str, str], final: bool) -> None:
        text = re.sub(r"\s+", " ", _MARKERS.sub(" ", u["text"])).strip()
        if text:
            self.session.emit({"type": "transcript", "id": u["id"], "speaker": speaker, "text": text[:2000], "final": final})

    def _new(self) -> dict[str, str]:
        self.seq += 1
        return {"id": f"u{self.seq}", "text": ""}

    def visitor_text(self, text: str) -> None:
        if self.agent:
            self.finish_agent()
        if not self.visitor:
            self.visitor = self._new()
        self.visitor["text"] += text
        self._emit("visitor", self.visitor, False)

    def agent_text(self, text: str, finished: bool) -> None:
        if self.visitor:
            self.finish_visitor()
        if not self.agent:
            self.agent = self._new()
        if finished:
            so_far = self.agent["text"]
            whole = not so_far or _squash(text).startswith(_squash(so_far)[:20])
            self.agent["text"] = text if whole else f"{so_far.rstrip()} {text.lstrip()}"
            self.finish_agent()
        else:
            self.agent["text"] += text
            self._emit("agent", self.agent, False)

    def visitor_set(self, text: str, final: bool) -> None:
        """Sets the visitor's current utterance to this whole text (engines that send cumulative text)."""
        if self.agent:
            self.finish_agent()
        if not self.visitor:
            self.visitor = self._new()
        self.visitor["text"] = text
        if final:
            self.finish_visitor()
        else:
            self._emit("visitor", self.visitor, False)

    def correct_agent(self, text: str) -> None:
        """Replaces the agent's last utterance with what it actually said before being interrupted."""
        if self.agent:
            self.agent["text"] = text
            self.finish_agent()
        elif self.last_agent:
            self._emit("agent", {"id": self.last_agent, "text": text}, True)

    def finish_visitor(self) -> None:
        if self.visitor:
            self._emit("visitor", self.visitor, True)
        self.visitor = None

    def finish_agent(self) -> None:
        if self.agent:
            self._emit("agent", self.agent, True)
            self.last_agent = self.agent["id"]
        self.agent = None

    def finish_all(self) -> None:
        self.finish_visitor()
        self.finish_agent()


def _squash(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())
