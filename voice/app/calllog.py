"""
The words of each call, kept so the demos can be reviewed and improved: what the caller and the
agent said, every tool the agent called (with its arguments and result) and the reply timings.
Written once, when a session ends, as one JSON file in Cloud Storage. The bucket deletes files
after 30 days. Local runs can write to a folder instead (DEMO_CALL_LOG_DIR); with neither set, nothing is written.

The caller's own number is never written; email addresses and phone numbers in tool arguments are masked.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional
from urllib.parse import quote

import httpx

from . import log
from .config import config

if TYPE_CHECKING:
    from .session import DemoSession

MAX_ENTRIES = 3000
_EMAIL = re.compile(r"([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)")
_PHONE = re.compile(r"\+?\(?\d[\d\s().-]{2,}(\d{4})\b")


def mask_emails(v: Any) -> Any:
    """Masks email addresses and phone numbers (all but the last four digits)."""
    if isinstance(v, str):
        return _PHONE.sub(r"•••\1", _EMAIL.sub(r"\1•••@\2", v))
    if isinstance(v, dict):
        return {k: mask_emails(x) for k, x in v.items()}
    if isinstance(v, list):
        return [mask_emails(x) for x in v]
    return v


class CallRecord:
    def __init__(self) -> None:
        self.started = time.monotonic()
        self.started_at = datetime.now(timezone.utc)
        self.entries: list[dict[str, Any]] = []
        # Transcript utterances arrive as repeated updates; only the latest text is kept, in first-heard order.
        self._said: dict[str, int] = {}

    def _at(self) -> int:
        return int((time.monotonic() - self.started) * 1000)

    def _add(self, entry: dict[str, Any]) -> None:
        if len(self.entries) < MAX_ENTRIES:
            self.entries.append({"t": self._at(), **entry})

    def said(self, utterance_id: str, speaker: str, text: str) -> None:
        at = self._said.get(utterance_id)
        if at is None:
            self._said[utterance_id] = len(self.entries)
            self._add({"kind": "say", "speaker": speaker, "text": mask_emails(text)})
        else:
            self.entries[at]["text"] = mask_emails(text)

    def tool(self, name: str, args: dict[str, Any], ok: bool, result: dict[str, Any], ms: int, summary: str = "", label: str = "") -> None:
        self._add({"kind": "tool", "tool": name, "label": label, "summary": mask_emails(summary), "args": mask_emails(args), "ok": ok, "result": mask_emails(result), "ms": ms})

    def note(self, kind: str, **data: Any) -> None:
        self._add({"kind": kind, **data})

    def document(self, session: "DemoSession") -> dict[str, Any]:
        return {
            "session": session.id,
            "demo": session.demo_id,
            "channel": session.channel,
            "startedAt": self.started_at.isoformat(),
            "durationMs": self._at(),
            "ended": session.ended,
            "entries": self.entries,
            "finalState": mask_emails(session.view()),
            "report": session.report_token,
            "setup": session.setup,
            "recordingOffsetMs": session.recording_offset_ms,
            "callerNumber": ("•••• " + session.caller_number[-4:]) if session.caller_number else None,
        }


def _object_name(session: "DemoSession", record: CallRecord) -> str:
    at = record.started_at
    return f"calls/{at:%Y-%m-%d}/{session.demo_id}/{at:%H%M%S}-{session.channel}-{session.id[:8]}.json"


_creds: Any = None


def _token() -> str:
    global _creds
    import google.auth
    import google.auth.transport.requests

    if _creds is None:
        _creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/devstorage.read_write"])
    if not _creds.valid:
        _creds.refresh(google.auth.transport.requests.Request())
    return _creds.token


def report_name(token: str, ext: str) -> str:
    """Each call's page reads from here: the call document (.json) and its recording (.mp3)."""
    return f"reports/{token}.{ext}"


async def put(name: str, body: bytes, content_type: str) -> bool:
    """Writes one object to the call log bucket (or the local folder). True when it was stored."""
    if config.call_log_dir:
        path = os.path.join(config.call_log_dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        return True
    if not config.call_log_bucket:
        return False
    token = await asyncio.to_thread(_token)
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            f"https://storage.googleapis.com/upload/storage/v1/b/{config.call_log_bucket}/o?uploadType=media&name={quote(name, safe='')}",
            content=body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
        )
    return r.status_code < 300


async def get(name: str, byte_range: Optional[str] = None) -> Optional[tuple[int, bytes, dict[str, str]]]:
    """Reads one object (or a byte range of it): (status, body, headers), or None when it does not exist."""
    if config.call_log_dir:
        path = os.path.join(config.call_log_dir, name)
        if not os.path.exists(path):
            return None
        with open(path, "rb") as f:
            data = f.read()
        return 200, data, {"content-length": str(len(data))}
    if not config.call_log_bucket:
        return None
    token = await asyncio.to_thread(_token)
    headers = {"Authorization": f"Bearer {token}"}
    if byte_range:
        headers["Range"] = byte_range
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.get(f"https://storage.googleapis.com/storage/v1/b/{config.call_log_bucket}/o/{quote(name, safe='')}?alt=media", headers=headers)
    if r.status_code == 404:
        return None
    if r.status_code >= 400:
        log.warn("calllog.read_failed", {"outcome": r.status_code})
        return None
    keep = {k: v for k, v in r.headers.items() if k.lower() in ("content-length", "content-range", "accept-ranges")}
    return r.status_code, r.content, keep


async def save(session: "DemoSession") -> None:
    bucket = config.call_log_bucket
    record: Optional[CallRecord] = session.record
    if record is None or not any(e["kind"] == "say" for e in record.entries):
        return
    if not (config.call_log_dir or bucket):
        return
    body = json.dumps(record.document(session), ensure_ascii=False, indent=1).encode()
    try:
        # The review copy, by date and demo; and the call's own page, by its private token.
        stored = await put(_object_name(session, record), body, "application/json")
        stored = await put(report_name(session.report_token, "json"), body, "application/json") and stored
        if stored:
            log.info("calllog.saved", {"session": session.id, "entries": len(record.entries)})
        else:
            log.warn("calllog.save_failed", {"session": session.id})
    except Exception as err:  # noqa: BLE001
        log.warn("calllog.save_failed", {"session": session.id}, err)
