"""
Confirmation emails from the demos, sent through Resend from Digital Macaroni's verified domain.

A public phone line must not become a way to email strangers, so: one email per conversation, at
most EMAILS_PER_ADDRESS_PER_DAY to any address and EMAILS_PER_HOUR in total, fixed templates filled
only from the session's own records (the caller cannot write the content), and the address is never
logged or kept: the session shows only a masked form of it.
"""

from __future__ import annotations

import hashlib
import html
import re
import time
from typing import Optional

import httpx

from . import log
from .config import config

EMAILS_PER_ADDRESS_PER_DAY = 3
EMAILS_PER_HOUR = 60
_ADDRESS = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
# Sends in the last day, by a hash of the address (the address itself is not kept).
_by_address: dict[str, list[float]] = {}
_recent: list[float] = []


def normalise(spoken: str) -> Optional[str]:
    """An email address as a caller might say it ("alex dot taylor at gmail dot com"), or None."""
    s = spoken.strip().lower()
    s = re.sub(r"\s+(at)\s+", "@", s)
    s = re.sub(r"\s+(dot)\s+", ".", s)
    s = re.sub(r"\s+(underscore)\s+", "_", s)
    s = re.sub(r"\s+(dash|hyphen)\s+", "-", s)
    s = re.sub(r"\s+", "", s).rstrip(".")
    return s if _ADDRESS.match(s) else None


def mask(address: str) -> str:
    """"alex.taylor@example.com" -> "a•••r@example.com"."""
    local, _, domain = address.partition("@")
    return (local[0] + "•••" + local[-1] if len(local) > 2 else local[0] + "•••") + "@" + domain


def _key(address: str) -> str:
    return hashlib.sha256(address.encode()).hexdigest()


def allowed(address: str) -> Optional[str]:
    """None if this address may be sent to now, else why not."""
    now = time.time()
    _recent[:] = [t for t in _recent if now - t < 3600]
    sent = [t for t in _by_address.get(_key(address), []) if now - t < 86400]
    _by_address[_key(address)] = sent
    if len(_recent) >= EMAILS_PER_HOUR:
        return "busy"
    if len(sent) >= EMAILS_PER_ADDRESS_PER_DAY:
        return "too_many_for_address"
    return None


async def send(to: str, subject: str, html_body: str, text_body: str, from_name: str) -> Optional[str]:
    """Sends one email; returns None when sent, else a short reason."""
    if not config.resend_api_key:
        return "not_configured"
    why = allowed(to)
    if why:
        return why
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.resend_api_key}"},
                json={"from": f"{from_name} <{config.email_from}>", "to": [to], "subject": subject, "html": html_body, "text": text_body, "reply_to": config.email_reply_to},
            )
    except httpx.HTTPError as err:
        log.warn("email.failed", {"outcome": "network"}, err)
        return "failed"
    log.info("email.sent" if r.status_code < 300 else "email.failed", {"status": r.status_code, "latency_ms": int((time.monotonic() - started) * 1000)})
    if r.status_code >= 300:
        return "failed"
    now = time.time()
    _recent.append(now)
    _by_address.setdefault(_key(to), []).append(now)
    return None


# ---- Templates ----

INK, MUTED, LINE, ACCENT = "#1f1d1a", "#6b6458", "#ece5da", "#9a6b3b"


def _rows(rows: list[tuple[str, str]]) -> str:
    return "".join(
        f'<tr><td style="padding:10px 0;border-top:1px solid {LINE};color:{MUTED};font-size:13px;width:120px;vertical-align:top">{html.escape(k)}</td>'
        f'<td style="padding:10px 0;border-top:1px solid {LINE};color:{INK};font-size:15px">{html.escape(v)}</td></tr>'
        for k, v in rows
        if v
    )


def page(business: str, heading: str, note: str, rows: list[tuple[str, str]], total: Optional[str], agent: str) -> tuple[str, str]:
    """A simple, well-behaved HTML email and its plain-text twin."""
    total_html = (
        f'<tr><td style="padding:14px 0 0;border-top:2px solid {INK};font-weight:700;font-size:15px">Total</td>'
        f'<td style="padding:14px 0 0;border-top:2px solid {INK};font-weight:700;font-size:20px">{html.escape(total)}</td></tr>'
        if total
        else ""
    )
    body = f"""<!doctype html><html><body style="margin:0;background:#f6f2ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2ea;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:28px 28px 24px">
<tr><td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:{ACCENT};font-weight:700">{html.escape(business)}</td></tr>
<tr><td style="padding:8px 0 4px;font-size:24px;font-weight:700;color:{INK}">{html.escape(heading)}</td></tr>
<tr><td style="padding:0 0 18px;font-size:14px;color:{MUTED};line-height:1.5">{html.escape(note)}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{_rows(rows)}{total_html}</table></td></tr>
<tr><td style="padding:22px 0 0;font-size:13px;color:{MUTED};line-height:1.6">Sent by {html.escape(agent)}, the AI agent you spoke with. {html.escape(business)} is a fictional business in a live demo: nothing was booked, sold or charged.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:18px 8px;font-size:13px;color:{MUTED};line-height:1.6;text-align:center">
Want an AI phone agent like {html.escape(agent)} for your business? <a href="https://digitalmacaroni.io/contact/" style="color:{INK};font-weight:600">Talk to Digital Macaroni</a>
</td></tr></table>
</td></tr></table></body></html>"""
    text = "\n".join(
        [business.upper(), heading, note, ""]
        + [f"{k}: {v}" for k, v in rows if v]
        + ([f"Total: {total}"] if total else [])
        + ["", f"Sent by {agent}, the AI agent you spoke with. {business} is a fictional business in a live demo: nothing was booked, sold or charged.", f"Want an AI phone agent like {agent} for your business? https://digitalmacaroni.io/contact/"]
    )
    return body, text
