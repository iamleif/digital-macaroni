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

    def tool(self, name: str, args: dict[str, Any], ok: bool, result: dict[str, Any], ms: int) -> None:
        self._add({"kind": "tool", "tool": name, "args": mask_emails(args), "ok": ok, "result": mask_emails(result), "ms": ms})

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
        }


def _object_name(session: "DemoSession", record: CallRecord) -> str:
    at = record.started_at
    return f"calls/{at:%Y-%m-%d}/{session.demo_id}/{at:%H%M%S}-{session.channel}-{session.id[:8]}.json"


def _token() -> str:
    import google.auth
    import google.auth.transport.requests

    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/devstorage.read_write"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


async def save(session: "DemoSession") -> None:
    bucket = config.call_log_bucket
    record: Optional[CallRecord] = session.record
    if record is None or not any(e["kind"] == "say" for e in record.entries):
        return
    name = _object_name(session, record)
    body = json.dumps(record.document(session), ensure_ascii=False, indent=1).encode()
    if config.call_log_dir:
        path = os.path.join(config.call_log_dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        return
    if not bucket:
        return
    try:
        token = await asyncio.to_thread(_token)
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.post(
                f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={quote(name, safe='')}",
                content=body,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
        if r.status_code >= 300:
            log.warn("calllog.save_failed", {"session": session.id, "outcome": r.status_code})
        else:
            log.info("calllog.saved", {"session": session.id, "entries": len(record.entries)})
    except Exception as err:  # noqa: BLE001
        log.warn("calllog.save_failed", {"session": session.id}, err)
