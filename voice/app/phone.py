"""
One phone call: Twilio media stream <-> the demo's live agent. The agent greets at once and the
caller can talk over the greeting. An interruption clears Twilio's queued audio. The call ends when
the agent says goodbye (a mark after the last audio lets the goodbye play in full before the stream
closes, which ends the call), when the caller hangs up, or at the demo's time limit.
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from typing import Any, Optional

from starlette.websockets import WebSocket, WebSocketDisconnect

from . import log
from .audio import LevelMeter, PhoneEncoder, rms, twilio_to_gemini, voice_stats
from .config import config
from .live import LiveSession, TranscriptTracker, open_live
from .pairing import MAX_ATTEMPTS_PER_CALL, link_call
from .session import DemoSession, get_session

GREET_NOTE = "[The call has just connected. Greet the caller now.]"
NUDGE_NOTE = "[The line has been quiet for a while. Briefly and warmly check whether the caller is still there.]"
SILENT_GOODBYE_NOTE = "[The line is still quiet. Say a short, friendly goodbye, then call end_call.]"
TIME_NOTE = "[The demo call has reached its time limit. Kindly tell the caller the demo is ending, thank them for trying it, mention they can try it again or get in touch on the website, then call end_call.]"
LINKED_NOTE = "[The caller has just linked their screen with the keypad code; they can now see the dashboard. Acknowledge it in a few words and carry on.]"
HANGUP_MARK = "demo-hangup"
SPEECH_RMS = 700
# Caller audio held while the live session connects: about five seconds of 20 ms frames.
PENDING_CAP = 250
_CLOSE = object()


def _now() -> float:
    return time.monotonic()


class PhoneBridge:
    def __init__(self, twilio: WebSocket) -> None:
        self.twilio = twilio
        self.loop = asyncio.get_running_loop()
        self.session: Optional[DemoSession] = None
        self.live: Optional[LiveSession] = None
        self.tracker: Optional[TranscriptTracker] = None
        self.stream_sid = ""
        self.started_at = 0.0
        self.pending: list[bytes] = []
        self.last_speech_at = 0.0
        self.playback_ends_at = 0.0
        self.speaking = False
        self.first_audio = False
        self.nudged = False
        self.finished = False
        self.hangup: Optional[dict[str, Any]] = None
        self.tasks: list[asyncio.Task[Any]] = []
        self.handles: list[asyncio.TimerHandle] = []
        self.speaking_timer: Optional[asyncio.TimerHandle] = None
        self.encoder = PhoneEncoder()
        self.meter = LevelMeter()
        self.turn_audio: list[bytes] = []
        self.turn_number = 0
        self.digits = ""
        self.last_digit_at = 0.0
        self.link_attempts = 0
        self.linked = False
        self.outq: asyncio.Queue[Any] = asyncio.Queue()
        self.open = True

    # ---- Twilio socket ----

    def send(self, msg: dict[str, Any]) -> None:
        if self.open:
            self.outq.put_nowait(json.dumps(msg))

    def close_twilio(self) -> None:
        """Closes after anything already queued has gone out."""
        if self.open:
            self.outq.put_nowait(_CLOSE)

    async def _writer(self) -> None:
        while True:
            item = await self.outq.get()
            if item is _CLOSE:
                self.open = False
                try:
                    await self.twilio.close()
                except Exception:  # noqa: BLE001
                    pass
                return
            try:
                await self.twilio.send_text(item)
            except Exception:  # noqa: BLE001
                self.open = False
                return

    # ---- helpers ----

    def measure_turn(self) -> None:
        if not config.voice_diagnostics or not self.turn_audio:
            return
        stats = voice_stats(b"".join(self.turn_audio))
        self.turn_audio = []
        self.turn_number += 1
        log.info("phone.agent_voice", {"session": self.session.id if self.session else None, "count": self.turn_number, "duration_ms": stats["seconds"] * 1000, "pitch_hz": stats["pitchHz"], "loudness_db": stats["loudnessDb"]})

    def link(self, code: str) -> str:
        """Links this call to a waiting page. Shared by keypad entry and the agent's link_screen tool."""
        if not self.session:
            return "not_found"
        if self.linked:
            return "linked"
        if self.link_attempts >= MAX_ATTEMPTS_PER_CALL:
            return "too_many_attempts"
        self.link_attempts += 1
        result = link_call(code, self.session)
        if result == "linked":
            self.linked = True
            log.info("phone.screen_linked", {"session": self.session.id})
        return result

    def set_speaking(self, on: bool) -> None:
        if self.speaking == on or not self.session:
            return
        self.speaking = on
        self.session.emit({"type": "agent.speaking", "speaking": on})

    def speaking_ends_with_playback(self) -> None:
        """The agent stops "speaking" when its queued audio has finished playing, not when it stops sending."""
        if self.speaking_timer:
            self.speaking_timer.cancel()
        self.speaking_timer = self.loop.call_later(max(0.0, self.playback_ends_at - _now()), self.set_speaking, False)

    def send_levels(self, pcm24: bytes, plays_in: float) -> None:
        """The waveform on a linked page: this chunk's bar heights and when the caller hears them."""
        if not self.session:
            return
        first = plays_in - self.meter.pending / LevelMeter.RATE
        levels = self.meter.feed(pcm24)
        if levels:
            self.session.emit({"type": "agent.levels", "in": max(0, round(first * 1000)), "frameMs": 40, "bands": LevelMeter.BANDS, "levels": base64.b64encode(levels).decode()})

    def send_hangup_mark(self) -> None:
        if not self.hangup or self.hangup["mark_sent"]:
            return
        self.hangup["mark_sent"] = True
        if self.hangup.get("settle"):
            self.hangup["settle"].cancel()
        self.send({"event": "mark", "streamSid": self.stream_sid, "mark": {"name": HANGUP_MARK}})

    def request_hangup(self, reason: str, wait_for_goodbye_s: float = 1.5) -> None:
        """Waits for the goodbye to be spoken (or to start, when the model still has to say it), then marks."""
        if self.hangup or self.finished:
            return
        self.hangup = {"reason": reason, "mark_sent": False, "backstop": self.loop.call_later(12, self.close_twilio)}
        self.hangup["settle"] = self.loop.call_later(wait_for_goodbye_s, self.send_hangup_mark)

    async def finish(self, reason: str) -> None:
        if self.finished:
            return
        self.finished = True
        for t in self.tasks:
            t.cancel()
        for h in self.handles:
            h.cancel()
        if self.hangup:
            self.hangup["backstop"].cancel()
            if self.hangup.get("settle"):
                self.hangup["settle"].cancel()
        if self.tracker:
            self.tracker.finish_all()
        self.set_speaking(False)
        if self.live:
            await self.live.close()
        if self.session:
            self.session.end(self.hangup["reason"] if self.hangup else reason)
        self.close_twilio()
        log.info("phone.call_ended", {"session": self.session.id if self.session else None, "duration_ms": int((_now() - self.started_at) * 1000) if self.started_at else 0})

    async def tick(self) -> None:
        while True:
            await asyncio.sleep(1)
            if not self.live or self.hangup or self.finished:
                continue
            now = _now()
            if now - self.started_at >= config.max_session_seconds - 20:
                self.live.send_text(TIME_NOTE)
                self.request_hangup("time_limit", 8)
                continue
            quiet_for = now - max(self.last_speech_at, self.playback_ends_at, self.started_at)
            if not self.nudged and quiet_for >= 12:
                self.nudged = True
                self.live.send_text(NUDGE_NOTE)
                self.playback_ends_at = max(self.playback_ends_at, now)
            elif self.nudged and quiet_for >= 10:
                self.live.send_text(SILENT_GOODBYE_NOTE)
                self.request_hangup("silence", 8)

    # ---- the agent's side ----

    async def run_live(self, live: LiveSession) -> None:
        sid = self.session.id if self.session else None
        try:
            async for e in live.events():
                if e.type == "interrupted":
                    self.send({"event": "clear", "streamSid": self.stream_sid})
                    self.encoder.reset()
                    self.meter.reset()
                    if self.session:
                        self.session.emit({"type": "audio.interrupted"})
                    self.measure_turn()
                    self.playback_ends_at = _now()
                    if self.tracker:
                        self.tracker.finish_agent()
                    if self.speaking_timer:
                        self.speaking_timer.cancel()
                    self.set_speaking(False)
                elif e.type == "turn_complete":
                    self.measure_turn()
                    if self.tracker:
                        self.tracker.finish_all()
                    self.speaking_ends_with_playback()
                    if self.hangup:
                        self.send_hangup_mark()
                elif e.type == "transcript" and self.tracker:
                    if e.speaker == "visitor":
                        self.tracker.visitor_text(e.text)
                    else:
                        self.tracker.agent_text(e.text, e.finished)
                elif e.type == "transcript_set" and self.tracker:
                    self.tracker.visitor_set(e.text, e.finished)
                elif e.type == "agent_correction" and self.tracker:
                    self.tracker.correct_agent(e.text)
                elif e.type == "audio":
                    if not self.first_audio:
                        self.first_audio = True
                        log.info("phone.first_audio", {"session": sid, "latency_ms": int((_now() - self.started_at) * 1000)})
                    if self.speaking_timer:
                        self.speaking_timer.cancel()
                    if not self.speaking and self.last_speech_at:
                        log.info("phone.turn_latency", {"session": sid, "latency_ms": int((_now() - self.last_speech_at) * 1000)})
                    self.set_speaking(True)
                    if config.voice_diagnostics and len(self.turn_audio) < 1500:
                        self.turn_audio.append(e.data)
                    mu = self.encoder.encode(e.data)
                    now = _now()
                    plays_at = max(now, self.playback_ends_at)
                    # mu-law at 8 kHz: one byte per sample.
                    self.playback_ends_at = plays_at + len(mu) / 8000
                    self.send_levels(e.data, plays_at - now)
                    if self.hangup and not self.hangup["mark_sent"]:
                        if self.hangup.get("settle"):
                            self.hangup["settle"].cancel()
                        self.hangup["settle"] = self.loop.call_later(1.5, self.send_hangup_mark)
                    self.send({"event": "media", "streamSid": self.stream_sid, "media": {"payload": base64.b64encode(mu).decode()}})
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            if not self.finished:
                log.warn("phone.live_error", {"session": sid}, err)
        finally:
            self.close_twilio()

    async def connect_live(self, s: DemoSession) -> None:
        try:
            live = await open_live(s)
        except Exception as err:  # noqa: BLE001
            log.error("phone.live_failed", {"session": s.id}, err)
            s.emit({"type": "session.error", "message": "The agent could not connect."})
            self.close_twilio()
            return
        if self.finished:
            await live.close()
            return
        self.live = live
        s.live_started = True
        log.info("phone.live_ready", {"session": s.id, "latency_ms": int((_now() - self.started_at) * 1000)})
        if not live.greets_itself:
            live.send_text(GREET_NOTE)
        for p in self.pending:
            live.send_audio(p)
        self.pending.clear()
        self.tasks.append(asyncio.create_task(self.tick()))
        self.tasks.append(asyncio.create_task(self.run_live(live)))

    # ---- the caller's side ----

    def on_start(self, start: dict[str, Any]) -> None:
        self.stream_sid = start.get("streamSid", "")
        self.started_at = _now()
        s = get_session((start.get("customParameters") or {}).get("sessionId"))
        if not s or s.ended or s.connected or s.channel != "phone":
            log.warn("phone.unknown_session")
            self.close_twilio()
            return
        self.session = s
        s.connected = True
        s.request_end = lambda reason: self.request_hangup(reason)
        s.link_screen = self.link
        self.tracker = TranscriptTracker(s)
        s.emit({"type": "session.ready", "sessionId": s.id, "demo": s.demo_id, "channel": "phone"})
        s.publish_state()
        self.tasks.append(asyncio.create_task(self.connect_live(s)))

    def on_media(self, payload: str) -> None:
        pcm = twilio_to_gemini(base64.b64decode(payload))
        if rms(pcm) > SPEECH_RMS:
            self.last_speech_at = _now()
            self.nudged = False
        if self.live:
            self.live.send_audio(pcm)
        elif len(self.pending) < PENDING_CAP:
            self.pending.append(pcm)

    def on_dtmf(self, digit: str) -> None:
        # A four-digit code typed on the keypad; digits more than five seconds apart start over.
        now = _now()
        if now - self.last_digit_at > 5:
            self.digits = ""
        self.last_digit_at = now
        self.digits = (self.digits + digit)[-4:]
        if len(self.digits) == 4 and not self.linked:
            result = self.link(self.digits)
            self.digits = ""
            if result == "linked" and self.live:
                self.live.send_text(LINKED_NOTE)

    async def run(self) -> None:
        writer = asyncio.create_task(self._writer())
        # Hard backstop for the demo's time limit, whatever the model does.
        self.handles.append(self.loop.call_later(config.max_session_seconds + 10, self.close_twilio))
        reason = "disconnected"
        try:
            while True:
                raw = await self.twilio.receive_text()
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                event = msg.get("event")
                if event == "start" and msg.get("start"):
                    self.on_start(msg["start"])
                elif event == "media" and msg.get("media"):
                    self.on_media(msg["media"]["payload"])
                elif event == "dtmf" and (msg.get("dtmf") or {}).get("digit", "") in tuple("0123456789"):
                    self.on_dtmf(msg["dtmf"]["digit"])
                elif event == "mark" and (msg.get("mark") or {}).get("name") == HANGUP_MARK:
                    self.close_twilio()
                elif event == "stop":
                    reason = "visitor_ended"
                    break
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as err:  # noqa: BLE001
            reason = "error"
            log.warn("phone.socket_error", {"session": self.session.id if self.session else None}, err)
        await self.finish(reason)
        try:
            await asyncio.wait_for(writer, timeout=2)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            writer.cancel()


async def bridge_phone(twilio: WebSocket) -> None:
    await PhoneBridge(twilio).run()
