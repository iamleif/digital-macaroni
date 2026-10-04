"""
One browser conversation. The page sends microphone audio as binary frames (16-bit PCM, 16 kHz,
mono) and {"type":"end"} to hang up. It receives the agent's audio as binary frames (16-bit PCM,
24 kHz) and every session event as JSON: transcript, tool activity, state, lifecycle. The same
socket carries both, so the dashboard and the voice cannot belong to different sessions.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional

from starlette.websockets import WebSocket, WebSocketDisconnect

from . import log
from .audio import rms
from .config import config
from .live import LiveSession, TranscriptTracker, open_live
from .session import DemoSession

GREET_NOTE = "[The visitor has just pressed Talk on the website and is listening. Greet them now.]"
NUDGE_NOTE = "[The visitor has been quiet for a while. Briefly and warmly check whether they are still there.]"
SILENT_GOODBYE_NOTE = "[The visitor is still quiet. Say a short, friendly goodbye, then call end_call.]"
TIME_NOTE = "[The demo has reached its time limit. Kindly say the demo is ending, thank them for trying it, then call end_call.]"
SPEECH_RMS = 700
MAX_FRAME_BYTES = 32_000  # one second of 16 kHz PCM16
_CLOSE = object()


def _now() -> float:
    return time.monotonic()


class BrowserBridge:
    def __init__(self, socket: WebSocket, session: DemoSession) -> None:
        self.socket = socket
        self.session = session
        self.loop = asyncio.get_running_loop()
        self.live: Optional[LiveSession] = None
        self.tracker = TranscriptTracker(session)
        self.started_at = _now()
        self.pending: list[bytes] = []
        self.last_speech_at = 0.0
        self.last_agent_audio_at = 0.0
        self.speaking = False
        self.nudged = False
        self.finished = False
        self.ending: Optional[dict[str, Any]] = None
        self.tasks: list[asyncio.Task[Any]] = []
        self.handles: list[asyncio.TimerHandle] = []
        # When the page will have finished playing what was sent (24 kHz PCM16: 48 bytes per ms).
        self.playback_ends_at = 0.0
        self.speaking_timer: Optional[asyncio.TimerHandle] = None
        self.outq: asyncio.Queue[Any] = asyncio.Queue()
        self.open = True
        self.unsubscribe = session.subscribe(lambda e: e["type"] != "audio" and self.send_json(e))

    def send_json(self, e: dict[str, Any]) -> None:
        if self.open:
            self.outq.put_nowait(json.dumps(e))

    def send_audio(self, pcm24: bytes) -> None:
        if self.open:
            self.outq.put_nowait(pcm24)

    async def _writer(self) -> None:
        while True:
            item = await self.outq.get()
            try:
                if item is _CLOSE:
                    self.open = False
                    await self.socket.close(1000)
                    return
                if isinstance(item, bytes):
                    await self.socket.send_bytes(item)
                else:
                    await self.socket.send_text(item)
            except Exception:  # noqa: BLE001
                self.open = False
                return

    def set_speaking(self, on: bool) -> None:
        if self.speaking == on:
            return
        self.speaking = on
        self.session.emit({"type": "agent.speaking", "speaking": on})

    def speaking_ends_with_playback(self) -> None:
        if self.speaking_timer:
            self.speaking_timer.cancel()
        self.speaking_timer = self.loop.call_later(max(0.0, self.playback_ends_at - _now()), self.set_speaking, False)

    def finish(self, reason: str) -> None:
        if self.finished:
            return
        self.finished = True
        for t in self.tasks:
            t.cancel()
        for h in self.handles:
            h.cancel()
        if self.ending:
            self.ending["timer"].cancel()
        self.tracker.finish_all()
        self.set_speaking(False)
        if self.live:
            asyncio.create_task(self.live.close())
        self.session.end(self.ending["reason"] if self.ending else reason)
        self.unsubscribe()
        # Let the page receive session.ended, then close; it keeps showing the result.
        self.loop.call_later(0.25, lambda: self.open and self.outq.put_nowait(_CLOSE))
        log.info("browser.ended", {"session": self.session.id, "duration_ms": int((_now() - self.started_at) * 1000)})

    def request_end(self, reason: str, wait_s: float = 1.5) -> None:
        """Ends once the goodbye has been spoken: after the turn completes, or a quiet spell, or a backstop."""
        if self.ending or self.finished:
            return
        self.ending = {"reason": reason, "timer": self.loop.call_later(wait_s, self.finish, reason)}

    async def tick(self) -> None:
        while True:
            await asyncio.sleep(1)
            if not self.live or self.ending or self.finished:
                continue
            now = _now()
            if now - self.started_at >= config.max_session_seconds - 20:
                self.live.send_text(TIME_NOTE)
                self.request_end("time_limit", 12)
                continue
            quiet_for = now - max(self.last_speech_at, self.last_agent_audio_at, self.started_at)
            if not self.nudged and quiet_for >= 15:
                self.nudged = True
                self.live.send_text(NUDGE_NOTE)
                self.last_agent_audio_at = now
            elif self.nudged and quiet_for >= 12:
                self.live.send_text(SILENT_GOODBYE_NOTE)
                self.request_end("silence", 10)

    async def run_live(self, live: LiveSession) -> None:
        sid = self.session.id
        try:
            async for e in live.events():
                if e.type == "interrupted":
                    self.send_json({"type": "audio.interrupted"})
                    self.tracker.finish_agent()
                    self.playback_ends_at = _now()
                    if self.speaking_timer:
                        self.speaking_timer.cancel()
                    self.set_speaking(False)
                elif e.type == "turn_complete":
                    self.tracker.finish_all()
                    self.speaking_ends_with_playback()
                    if self.ending:
                        self.ending["timer"].cancel()
                        self.ending["timer"] = self.loop.call_later(1.2, self.finish, self.ending["reason"])
                elif e.type == "transcript":
                    if e.speaker == "visitor":
                        self.tracker.visitor_text(e.text)
                    else:
                        self.tracker.agent_text(e.text, e.finished)
                elif e.type == "transcript_set":
                    self.tracker.visitor_set(e.text, e.finished)
                elif e.type == "agent_correction":
                    self.tracker.correct_agent(e.text)
                elif e.type == "audio":
                    if not self.last_agent_audio_at:
                        log.info("browser.first_audio", {"session": sid, "latency_ms": int((_now() - self.started_at) * 1000)})
                    if not self.speaking and self.last_speech_at:
                        log.info("browser.turn_latency", {"session": sid, "latency_ms": int((_now() - self.last_speech_at) * 1000)})
                    if self.speaking_timer:
                        self.speaking_timer.cancel()
                    self.set_speaking(True)
                    self.playback_ends_at = max(_now(), self.playback_ends_at) + len(e.data) / 48000
                    self.last_agent_audio_at = self.playback_ends_at
                    self.send_audio(e.data)
        except asyncio.CancelledError:
            return
        except Exception as err:  # noqa: BLE001
            if not self.finished:
                log.warn("browser.live_error", {"session": sid}, err)
        if not self.finished:
            if not self.ending:
                self.send_json({"type": "session.error", "message": "The conversation was interrupted."})
            self.finish("error")

    async def connect_live(self) -> None:
        try:
            live = await open_live(self.session)
        except Exception as err:  # noqa: BLE001
            log.error("browser.live_failed", {"session": self.session.id}, err)
            self.send_json({"type": "session.error", "message": "The agent could not connect. Please try again, or call the demo number."})
            self.finish("error")
            return
        if self.finished:
            await live.close()
            return
        self.live = live
        self.session.live_started = True
        if not live.greets_itself:
            live.send_text(GREET_NOTE)
        for p in self.pending:
            live.send_audio(p)
        self.pending.clear()
        self.tasks.append(asyncio.create_task(self.tick()))
        self.tasks.append(asyncio.create_task(self.run_live(live)))

    def on_audio(self, data: bytes) -> None:
        if len(data) > MAX_FRAME_BYTES or len(data) % 2:
            return
        if rms(data) > SPEECH_RMS:
            self.last_speech_at = _now()
            self.nudged = False
        if self.live:
            self.live.send_audio(data)
        elif len(self.pending) < 100:
            self.pending.append(data)

    async def run(self) -> None:
        await self.socket.accept()
        writer = asyncio.create_task(self._writer())
        self.session.request_end = lambda reason: self.request_end(reason, 2.5 if reason == "agent_ended" else 9)
        self.handles.append(self.loop.call_later(config.max_session_seconds + 10, self.finish, "time_limit"))
        self.session.connected = True
        for e in self.session.snapshot():
            self.send_json(e)
        self.tasks.append(asyncio.create_task(self.connect_live()))
        reason = "disconnected"
        try:
            while not self.finished:
                msg = await self.socket.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("bytes") is not None:
                    if not self.finished:
                        self.on_audio(msg["bytes"])
                elif msg.get("text") is not None:
                    try:
                        if json.loads(msg["text"]).get("type") == "end":
                            reason = "visitor_ended"
                            break
                    except (ValueError, AttributeError):
                        pass  # Ignore anything that is not a known message.
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception:  # noqa: BLE001
            reason = "error"
        self.finish(reason)
        try:
            await asyncio.wait_for(writer, timeout=2)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            writer.cancel()


async def bridge_browser(socket: WebSocket, session: DemoSession) -> None:
    await BrowserBridge(socket, session).run()
