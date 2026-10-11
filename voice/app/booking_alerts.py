"""
Discovery calls booked on Leif's Cal.com page: Cal.com calls /webhooks/cal on every booking, reschedule and
cancellation (signed with CAL_WEBHOOK_SECRET), and Leif gets an email at LEADS_EMAIL with who, when (in
Eastern and in Norway time), their phone and website, and, when they came through the instant demo, which
business it was and their call summary.
"""

from __future__ import annotations

import hashlib
import hmac
import html
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from . import log
from .config import config

WHAT = {"BOOKING_CREATED": "New discovery call", "BOOKING_RESCHEDULED": "Discovery call moved", "BOOKING_CANCELLED": "Discovery call cancelled"}


def signed(body: bytes, signature: Optional[str]) -> bool:
    if not config.cal_webhook_secret or not signature:
        return False
    expected = hmac.new(config.cal_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def _when(iso: str) -> str:
    try:
        at = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return iso or ""
    et, no = at.astimezone(ZoneInfo("America/New_York")), at.astimezone(ZoneInfo("Europe/Oslo"))
    return f"{et:%A %B %-d}, {et:%-I:%M %p} Eastern ({no:%H:%M} in Norway)"


def _demo_lead(email: str) -> Optional[dict[str, Any]]:
    """The instant demo this person tried today, if it's still in memory."""
    from .factory import jobs

    email = email.strip().lower()
    for j in sorted(jobs.values(), key=lambda j: j.created, reverse=True):
        if j.kind == "instant" and j.lead.get("email", "").lower() == email:
            return {"business": j.profile.business_name if j.profile else "", "website": j.lead.get("website", ""), "summary": (j.summary or {}).get("summary", "")}
    return None


async def handle(event: dict[str, Any]) -> None:
    from .factory import _resend, _shell

    trigger = str(event.get("triggerEvent") or "")
    if trigger not in WHAT:
        return
    p = event.get("payload") or {}
    who = (p.get("attendees") or [{}])[0]
    responses = p.get("responses") or {}

    def answer(key: str) -> str:
        v = responses.get(key)
        v = v.get("value") if isinstance(v, dict) else v
        return str(v or "")

    name, email = str(who.get("name") or ""), str(who.get("email") or "")
    demo = _demo_lead(email) if email else None
    rows = [
        ("Who", name), ("Email", email), ("Phone", answer("attendeePhoneNumber")), ("Website", answer("website") or (demo or {}).get("website", "")),
        ("When", _when(str(p.get("startTime") or ""))), ("Their time zone", str(who.get("timeZone") or "")),
        ("Notes", answer("notes") or str(p.get("additionalNotes") or "")),
        ("Tried the demo as", (demo or {}).get("business", "")), ("Demo call", (demo or {}).get("summary", "")),
    ]
    e = html.escape
    table = "".join(f"<tr><td style='padding:6px 14px 6px 0;color:#857d70;vertical-align:top'>{e(k)}</td><td style='padding:6px 0'>{e(v)}</td></tr>" for k, v in rows if v)
    heading = f"{WHAT[trigger]}: {name or email}"
    sent = await _resend(config.leads_email, f"{heading} · {_when(str(p.get('startTime') or ''))}", _shell(heading, heading, f"<table>{table}</table>", "From your Cal.com page, via Digital Macaroni"), "\n".join(f"{k}: {v}" for k, v in rows if v), "Digital Macaroni")
    log.info("booking.alert", {"outcome": trigger if sent else "email_failed"})
