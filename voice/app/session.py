"""
One visitor's demo: its own copy of the business's records, its transcript, and whoever is
watching it. Nothing is shared between sessions. Sessions live in this process's memory only;
the service runs as a single instance so a phone call and a paired browser reach the same one.

Events are the JSON objects the website receives (see protocol.py); listeners are plain callables.
"""

from __future__ import annotations

import asyncio
import secrets
import time
import uuid
from typing import Any, Callable, Optional

from . import calllog, log
from .config import config
from .demos import demos
from .demos.types import DemoDefinition

Event = dict[str, Any]
Listener = Callable[[Event], None]

HISTORY_CAP = 400
# Ended sessions stay readable this long so the visitor can look at the result.
KEEP_ENDED_S = 10 * 60
# A session whose transport never connects is ended after this.
CONNECT_TIMEOUT_S = 45


def now_ms() -> int:
    return int(time.time() * 1000)


class DemoSession:
    def __init__(self, demo_id: str, channel: str) -> None:
        self.id = str(uuid.uuid4())
        # The browser that started this session proves it with this; never sent anywhere else.
        self.token = secrets.token_urlsafe(18)
        self.created_at = time.monotonic()
        self.demo_id = demo_id
        self.channel = channel
        self.demo: DemoDefinition[Any] = demos[demo_id]
        self.state: Any = self.demo.create_state(_utc_now())
        self.version = 0
        self.connected = False
        # The live agent actually started (a phone call that never got one hears an apology instead).
        self.live_started = False
        self.ended: Optional[str] = None
        self.ended_at = 0.0
        # Set by the transport: asks it to finish the conversation gracefully (say goodbye, hang up).
        self.request_end: Callable[[str], None] = self.end
        # Set by the phone bridge: links this call to a waiting page by its code.
        self.link_screen: Optional[Callable[[str], str]] = None
        # Phone calls only: the caller's number as Twilio reported it (E.164), or None. Held in memory, never logged.
        self.caller_number: Optional[str] = None
        self._listeners: list[Listener] = []
        self._history: list[Event] = []
        # The words of the call, saved when it ends (calllog.py).
        self.record = calllog.CallRecord()

    @property
    def max_seconds(self) -> int:
        return self.demo.max_seconds or config.max_session_seconds

    def emit(self, e: Event) -> None:
        if e["type"] == "transcript":
            self.record.said(e["id"], e["speaker"], e["text"])
        if e["type"] not in ("audio", "audio.interrupted", "agent.levels"):
            self._history.append(e)
            if len(self._history) > HISTORY_CAP:
                del self._history[: len(self._history) - HISTORY_CAP]
        for listener in list(self._listeners):
            try:
                listener(e)
            except Exception as err:  # noqa: BLE001
                log.warn("session.listener_failed", {"session": self.id}, err)

    def view(self) -> dict[str, Any]:
        return self.demo.view(self.state)

    def publish_state(self) -> None:
        self.version += 1
        self.emit({"type": "state", "version": self.version, "state": self.view()})

    def snapshot(self) -> list[Event]:
        """What a viewer joining now needs: the conversation so far in order (latest text per utterance) and state."""
        conversation: list[Event] = []
        position: dict[str, int] = {}
        for e in self._history:
            if e["type"] == "transcript":
                at = position.get(e["id"])
                if at is None:
                    position[e["id"]] = len(conversation)
                    conversation.append(e)
                else:
                    conversation[at] = e
            elif e["type"] in ("tool.started", "tool.succeeded", "tool.failed"):
                conversation.append(e)
        events: list[Event] = [{"type": "session.ready", "sessionId": self.id, "demo": self.demo_id, "channel": self.channel}, *conversation, {"type": "state", "version": self.version, "state": self.view()}]
        if self.ended:
            events.append({"type": "session.ended", "reason": self.ended})
        return events

    def subscribe(self, listener: Listener) -> Callable[[], None]:
        self._listeners.append(listener)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def end(self, reason: str) -> None:
        if self.ended:
            return
        self.ended = reason
        self.ended_at = time.monotonic()
        self.emit({"type": "session.ended", "reason": reason})
        log.info("session.ended", {"session": self.id, "demo": self.demo_id, "channel": self.channel, "outcome": reason, "duration_ms": int((self.ended_at - self.created_at) * 1000), "version": self.version})
        try:
            asyncio.get_running_loop().create_task(calllog.save(self))
        except RuntimeError:
            pass


def _utc_now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


sessions: dict[str, DemoSession] = {}


def active_count() -> int:
    return sum(1 for s in sessions.values() if not s.ended)


def admit(demo_id: str, channel: str) -> tuple[Optional[DemoSession], Optional[str]]:
    """A new session, or why not: "disabled" or "busy"."""
    if not config.enabled:
        return None, "disabled"
    if active_count() >= config.max_concurrent:
        log.warn("session.refused_busy", {"demo": demo_id, "channel": channel, "count": active_count()})
        return None, "busy"
    session = DemoSession(demo_id, channel)
    sessions[session.id] = session
    log.info("session.created", {"session": session.id, "demo": demo_id, "channel": channel})
    return session, None


def get_session(sid: Optional[str]) -> Optional[DemoSession]:
    return sessions.get(sid) if sid else None


async def sweeper() -> None:
    """Ends abandoned or over-long sessions and forgets old ended ones."""
    while True:
        await asyncio.sleep(5)
        now = time.monotonic()
        for s in list(sessions.values()):
            if not s.ended and not s.connected and now - s.created_at > CONNECT_TIMEOUT_S:
                s.end("disconnected")
            # The transport enforces the limit gracefully; this is the backstop.
            elif not s.ended and now - s.created_at > s.max_seconds + 30:
                s.end("time_limit")
            elif s.ended and now - s.ended_at > KEEP_ENDED_S:
                sessions.pop(s.id, None)
