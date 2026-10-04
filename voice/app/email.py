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
from dataclasses import dataclass
from typing import Any, Optional

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


async def confirm(spoken: str, message: tuple[str, str, str], from_name: str) -> tuple[Optional[str], Optional[str]]:
    """
    Sends one demo email to the address the caller gave. Returns (masked address, None) when sent, or
    (None, reason): "invalid_email", "too_many_for_address", "busy", "not_configured" or "failed".
    """
    address = normalise(spoken)
    if address is None:
        return None, "invalid_email"
    subject, body, text = message
    why = await send(address, subject, body, text, from_name)
    return (None, why) if why else (mask(address), None)


# What the agent is told for each reason an email was not sent.
REFUSALS = {
    "invalid_email": "That doesn't look like a complete email address. Ask the caller to say it again, slowly, and read it back.",
    "too_many_for_address": "That address has already had several emails from our demos today. Apologise; nothing more can be emailed to it today.",
}


# ---- Templates ----
# Table layout with inline styles: the dialect every email client (Gmail, Apple Mail, Outlook) renders.
# Images are hosted by this service at /email-assets (inline cid: images are dropped by some webmail).

FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
SERIF = "Georgia,'Times New Roman',serif"
CONTACT_URL = "https://digitalmacaroni.io/contact/"


@dataclass(frozen=True)
class Brand:
    short: str
    full: str
    mark: str
    accent: str
    soft: str
    ink: str
    serif: bool = False


BRANDS = {
    "travel": Brand("Waypoint", "Waypoint Travel", "waypoint.png", "#b26f2a", "#fbf1e4", "#2f2a24"),
    "northline": Brand("Northline", "Northline Home Services", "northline.png", "#2a5aa8", "#eaf1fc", "#1d2b44"),
    "formfield": Brand("Form & Field", "Form & Field", "formfield.png", "#4f6a4a", "#eef2ea", "#2b3226", serif=True),
}


def asset(name: str) -> str:
    return f"{config.public_url}/email-assets/{name}"


def e(s: object) -> str:
    return html.escape(str(s))


def _detail_rows(rows: list[tuple[str, str]], b: Brand) -> str:
    return "".join(
        f'<tr><td style="padding:11px 0;border-top:1px solid #ece8e1;color:#857d70;font-size:13px;width:110px;vertical-align:top;font-family:{FONT}">{e(k)}</td>'
        f'<td style="padding:11px 0;border-top:1px solid #ece8e1;color:{b.ink};font-size:15px;font-family:{FONT};line-height:1.45">{e(v)}</td></tr>'
        for k, v in rows
        if v
    )


def _total(label: str, value: str, b: Brand) -> str:
    return (
        f'<tr><td style="padding:16px 0 2px;border-top:2px solid {b.ink};font-weight:700;font-size:15px;color:{b.ink};font-family:{FONT}">{e(label)}</td>'
        f'<td align="right" style="padding:16px 0 2px;border-top:2px solid {b.ink};font-weight:800;font-size:24px;color:{b.ink};font-family:{FONT}">{e(value)}</td></tr>'
    )


def _pill(text: str, b: Brand) -> str:
    return f'<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:{b.soft};color:{b.accent};font-size:12px;font-weight:700;letter-spacing:.3px;font-family:{FONT}">{e(text)}</span>'


def promo_card(agent: str, did: str) -> str:
    """The Digital Macaroni card at the foot of every demo email."""
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin-top:20px">
<tr><td style="background:#1b1a17;border-radius:18px;padding:30px 30px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td><img src="{asset("digital-macaroni.png")}" width="40" height="40" alt="Digital Macaroni" style="display:block;border:0"></td></tr>
<tr><td style="padding:16px 0 8px;font-family:{FONT};font-size:24px;line-height:1.25;font-weight:800;color:#fff8e6">This is just the tip of the iceberg.</td></tr>
<tr><td style="font-family:{FONT};font-size:15px;line-height:1.65;color:#d9d2c3">{e(agent)} {e(did)}, then wrote this email, without a human stepping in. Digital Macaroni builds AI voice agents like {e(agent)} for real businesses: answering every call, booking and rescheduling, taking orders, handling support, and plugging into the tools you already use.</td></tr>
<tr><td style="padding:22px 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f5c542;border-radius:999px"><a href="{CONTACT_URL}" style="display:inline-block;padding:13px 24px;font-family:{FONT};font-size:15px;font-weight:700;color:#1b1a17;text-decoration:none">Book a chat with us &rarr;</a></td></tr></table></td></tr>
<tr><td style="padding:14px 0 0;font-family:{FONT};font-size:13px;line-height:1.6;color:#a9a192">Or just reply to this email. It comes straight to our team.</td></tr>
</table></td></tr></table>"""


def layout(b: Brand, preheader: str, kicker: str, heading: str, intro: str, card: str, agent: str, did: str) -> str:
    name_font = SERIF if b.serif else FONT
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f1eb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:28px 12px 36px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 6px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="{asset(b.mark)}" width="34" height="34" alt="" style="display:block;border:0;border-radius:9px"></td>
<td style="padding-left:10px;font-family:{name_font};font-size:20px;font-weight:700;color:{b.ink};letter-spacing:{'.5px' if b.serif else '-.3px'}">{e(b.full)}</td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:30px 30px 26px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:{FONT};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:{b.accent}">{e(kicker)}</td></tr>
<tr><td style="padding:8px 0 6px;font-family:{FONT};font-size:26px;line-height:1.25;font-weight:800;color:{b.ink}">{e(heading)}</td></tr>
<tr><td style="padding:0 0 22px;font-family:{FONT};font-size:15px;line-height:1.6;color:#6b645a">{e(intro)}</td></tr>
<tr><td>{card}</td></tr>
<tr><td style="padding:22px 0 0;font-family:{FONT};font-size:12px;line-height:1.6;color:#9a9286">Sent by {e(agent)}, the AI agent you spoke with. {e(b.full)} is a fictional business in a live demo by Digital Macaroni: nothing was booked, sold or charged.</td></tr>
</table></td></tr>
<tr><td>{promo_card(agent, did)}</td></tr>
<tr><td style="padding:18px 6px 0;font-family:{FONT};font-size:12px;color:#9a9286;text-align:center">Digital Macaroni &middot; <a href="https://digitalmacaroni.io" style="color:#9a9286">digitalmacaroni.io</a> &middot; <a href="https://digitalmacaroni.io/privacy/" style="color:#9a9286">Privacy</a></td></tr>
</table></td></tr></table></body></html>"""


def _text(b: Brand, heading: str, intro: str, lines: list[str], agent: str, did: str) -> str:
    return "\n".join(
        [b.full.upper(), "", heading, intro, ""]
        + lines
        + ["", f"Sent by {agent}, the AI agent you spoke with. {b.full} is a fictional business in a live demo by Digital Macaroni: nothing was booked, sold or charged.", "", "This is just the tip of the iceberg.", f"{agent} {did}, then wrote this email, without a human stepping in. Digital Macaroni builds AI voice agents like {agent} for real businesses.", f"Book a chat with us: {CONTACT_URL}", "Or just reply to this email. It comes straight to our team."]
    )


def flight_itinerary(t: dict[str, Any]) -> tuple[str, str, str]:
    """Waypoint: a boarding-pass style card. Returns (subject, html, text)."""
    b = BRANDS["travel"]

    def leg(j: dict[str, Any], label: str) -> str:
        via = "Nonstop" if not j["stops"] else f"{j['stops']} stop{'s' if j['stops'] > 1 else ''} via {', '.join(j['via'])}"
        nxt = '<span style="font-size:12px;color:#b26f2a"> +1</span>' if j.get("arrivesNextDay") else ""
        logo = f'<img src="{e(t["airlineLogo"])}" width="18" height="18" alt="" style="vertical-align:middle;border:0;margin-right:6px">' if t.get("airlineLogo") else ""
        return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{b.soft};border-radius:14px;margin:0 0 10px">
<tr><td style="padding:16px 18px 4px;font-family:{FONT};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{b.accent}">{e(label)} &middot; {e(j['date'])}</td></tr>
<tr><td style="padding:4px 18px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="38%" style="font-family:{FONT};vertical-align:top"><div style="font-size:32px;font-weight:800;color:{b.ink};letter-spacing:-.5px">{e(j['from'])}</div><div style="font-size:14px;font-weight:700;color:{b.ink}">{e(j['departs'])}</div><div style="font-size:12px;color:#857d70">{e(j['fromName'])}</div></td>
<td width="24%" align="center" style="font-family:{FONT};vertical-align:middle;color:{b.accent}"><div style="font-size:20px">&#9992;</div><div style="font-size:12px;color:#857d70">{e(j['duration'])}</div><div style="font-size:11px;color:#857d70">{e(via)}</div></td>
<td width="38%" align="right" style="font-family:{FONT};vertical-align:top"><div style="font-size:32px;font-weight:800;color:{b.ink};letter-spacing:-.5px">{e(j['to'])}</div><div style="font-size:14px;font-weight:700;color:{b.ink}">{e(j['arrives'])}{nxt}</div><div style="font-size:12px;color:#857d70">{e(j['toName'])}</div></td>
</tr></table></td></tr>
<tr><td style="padding:0 18px 14px;font-family:{FONT};font-size:12px;color:#857d70">{logo}{e(' · '.join(j['airlines']))} &middot; {e(' · '.join(j['flights']))}</td></tr></table>"""

    card = _pill("Quote · not booked", b) + '<div style="height:14px"></div>' + "".join(leg(j, "Outbound" if n == 0 else "Return") for n, j in enumerate(t["journeys"]))
    rows = [("Fare", t["fare"]), ("Seat", t["seat"]), ("Bags", t["bags"]), ("Traveller", t["traveller"]), ("Changes", t.get("changes", "")), ("Refunds", t.get("refund", ""))]
    card += f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">{_detail_rows(rows, b)}{_total("Total", t["total"], b)}</table>'
    first = t["journeys"][0]
    route = f"{first['from']} to {first['to']}"
    did = "found live fares, held your seat on the map, priced your bags"
    heading = f"Your trip, {t['traveller'].split(' ')[0]}" if t.get("traveller") else "Your trip"
    intro = f"Here's the {route} itinerary we put together on the phone. It's a quote, so nothing is booked: in this demo we stop just before payment."
    body = layout(b, f"{route} · {first['date']} · {t['total']}", "Flight itinerary", heading, intro, card, "Linda", did)
    lines = [f"{'Outbound' if n == 0 else 'Return'}: {j['date']}, {j['from']} {j['departs']} to {j['to']} {j['arrives']} ({j['duration']}, {'nonstop' if not j['stops'] else str(j['stops']) + ' stop'}), {' · '.join(j['airlines'])}" for n, j in enumerate(t["journeys"])]
    lines += [f"{k}: {v}" for k, v in rows if v] + [f"Total: {t['total']} (quote, not booked)"]
    return f"Your Waypoint itinerary · {route} · {t['total']}", body, _text(b, heading, intro, lines, "Linda", did)


def visit_confirmation(v: dict[str, Any]) -> tuple[str, str, str]:
    """Northline: the booked visit, big and clear. Returns (subject, html, text)."""
    b = BRANDS["northline"]
    card = f"""{_pill("Visit booked · " + v["reference"], b)}<div style="height:14px"></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{b.soft};border-radius:14px"><tr><td style="padding:20px 20px 18px;font-family:{FONT}">
<div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{b.accent}">{e(v["day"])}</div>
<div style="padding:4px 0 2px;font-size:30px;font-weight:800;color:{b.ink};letter-spacing:-.5px">{e(v["window"])}</div>
<div style="font-size:14px;color:#5d6875">Arrival window &middot; {e(v["technician"])} will call 30 minutes before arriving</div></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">{_detail_rows([("Service", v["service"]), ("Problem", v.get("issue", "")), ("Address", v["address"]), ("Name", v["name"]), ("Reference", v["reference"])], b)}</table>"""
    did = "checked the live schedule, found you a slot and booked it"
    heading = f"You're booked, {v['name'].split(' ')[0]}"
    intro = "Here are the details of your visit. Need to change it? Just call us back and Ellie will move it."
    body = layout(b, f"{v['service']} · {v['day']}, {v['window']}", "Visit confirmation", heading, intro, card, "Ellie", did)
    lines = [f"When: {v['day']}, {v['window']}", f"Service: {v['service']}", f"Address: {v['address']}", f"Technician: {v['technician']}", f"Reference: {v['reference']}"]
    return f"Your Northline visit · {v['day']}, {v['window']}", body, _text(b, heading, intro, lines, "Ellie", did)


def pickup_reservation(r: dict[str, Any]) -> tuple[str, str, str]:
    """Form & Field: the reserved item, ready for pickup. Returns (subject, html, text)."""
    b = BRANDS["formfield"]
    card = f"""{_pill("Reserved for pickup · " + r["reference"], b)}<div style="height:14px"></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{b.soft};border-radius:14px"><tr>
{f'<td width="120" style="padding:14px 0 14px 14px;vertical-align:middle"><img src="{e(r["image"])}" width="120" height="120" alt="{e(r["product"])}" style="display:block;border:0;border-radius:10px;background:#fff"></td>' if r.get("image") else ""}
<td style="padding:20px 20px 18px;font-family:{FONT};vertical-align:middle">
<div style="font-family:{SERIF};font-size:24px;font-weight:700;color:{b.ink}">{e(r["product"])}</div>
<div style="padding:4px 0 0;font-size:15px;color:#555b50">{e(r["quantity"])} &times; {e(r["option"])} &middot; {e(r["price"])}</div></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">{_detail_rows([("Pick up by", r["pickupBy"]), ("Shop", r["shop"]), ("Hours", r["hours"]), ("Name", r["name"]), ("Payment", "In store at pickup"), ("Reference", r["reference"])], b)}</table>"""
    did = "searched the catalogue, checked live stock and held it for you"
    heading = f"It's held for you, {r['name'].split(' ')[0]}"
    intro = "Your item is set aside and waiting at the shop. Bring your reference, and pay when you collect."
    body = layout(b, f"{r['product']} · held until {r['pickupBy']}", "Pickup reservation", heading, intro, card, "Theo", did)
    lines = [f"Item: {r['quantity']} x {r['product']}, {r['option']} ({r['price']})", f"Pick up by: {r['pickupBy']}", f"Shop: {r['shop']} ({r['hours']})", f"Reference: {r['reference']}"]
    return f"Held for you at Form & Field · {r['product']}", body, _text(b, heading, intro, lines, "Theo", did)
