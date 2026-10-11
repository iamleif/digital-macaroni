"""
Call recordings, only for visitors who ticked "Record the call" on the setup card (their consent):
Twilio starts recording once their screen links (pairing.link_call), and the agent's connected line
says so. When the recording is ready it is copied into the call log bucket next to the call's page
and deleted from Twilio, so the only copy lives with the rest of the call and is deleted with it
after 30 days.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Optional

import httpx

from . import calllog, log
from .config import config

if TYPE_CHECKING:
    from .session import DemoSession

API = "https://api.twilio.com/2010-04-01"
# Sessions whose recording is still on its way: the callback arrives after the call has ended.
_pending: dict[str, "DemoSession"] = {}


def pending(session_id: str) -> bool:
    return session_id in _pending


def _auth() -> Optional[tuple[str, str]]:
    if not (config.twilio_account_sid and config.twilio_api_key_sid and config.twilio_api_key_secret):
        return None
    return config.twilio_api_key_sid, config.twilio_api_key_secret


async def start(session: "DemoSession", call_sid: Optional[str]) -> None:
    """Starts recording a live call. Never raises: a call without a recording is still a call."""
    auth = _auth()
    if not auth or not call_sid or not config.call_log_bucket:
        return
    before = session.record.started
    sent = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10, auth=auth) as http:
            r = await http.post(
                f"{API}/Accounts/{config.twilio_account_sid}/Calls/{call_sid}/Recordings.json",
                data={
                    "RecordingChannels": "mono",
                    "RecordingStatusCallback": f"{config.public_url}/twilio/recording?session={session.id}",
                    "RecordingStatusCallbackEvent": "completed",
                    "Trim": "do-not-trim",
                },
            )
        if r.status_code >= 300:
            log.warn("recording.start_failed", {"session": session.id, "outcome": r.status_code})
            return
        # The recording starts about when Twilio answered: halfway through the request is close enough to line up the transcript.
        session.recording_offset_ms = int(((sent + time.monotonic()) / 2 - before) * 1000)
        _pending[session.id] = session
        log.info("recording.started", {"session": session.id})
    except Exception as err:  # noqa: BLE001
        log.warn("recording.start_failed", {"session": session.id}, err)


async def finished(session_id: str, recording_sid: str, recording_url: str) -> None:
    """Twilio says the recording is ready: keep it with the call (unless the visitor opted out), then delete it from Twilio."""
    session = _pending.pop(session_id, None)
    keep = session is not None and (session.setup or {}).get("record") is True
    auth = _auth()
    if not auth:
        return
    try:
        async with httpx.AsyncClient(timeout=60, auth=auth, follow_redirects=True) as http:
            if keep:
                audio = await http.get(f"{recording_url}.mp3")
                if audio.status_code == 200 and audio.content:
                    stored = await calllog.put(calllog.report_name(session.report_token, "mp3"), audio.content, "audio/mpeg")  # type: ignore[union-attr]
                    log.info("recording.stored" if stored else "recording.store_failed", {"session": session_id, "bytes": len(audio.content)})
                else:
                    log.warn("recording.download_failed", {"session": session_id, "outcome": audio.status_code})
            else:
                log.info("recording.discarded", {"session": session_id})
            d = await http.delete(f"{API}/Accounts/{config.twilio_account_sid}/Recordings/{recording_sid}.json")
            if d.status_code >= 300:
                log.warn("recording.delete_failed", {"session": session_id, "outcome": d.status_code})
    except Exception as err:  # noqa: BLE001
        log.warn("recording.finish_failed", {"session": session_id}, err)
    if session is not None:
        from . import report_email

        await report_email.send(session, recorded=keep)
