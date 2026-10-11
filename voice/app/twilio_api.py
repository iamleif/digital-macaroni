"""
Twilio's REST API, for the agent factory: placing the instant demo call, sending texts, and buying
and pointing a client's number. Authenticated with the demo-only API key. Every call returns a
plain result; nothing here raises on a Twilio error.
"""

from __future__ import annotations

import re
from typing import Any, Optional

import httpx

from . import log
from .config import config

API = "https://api.twilio.com/2010-04-01"
NANP = re.compile(r"^\+1[2-9][0-9]{2}[2-9][0-9]{6}$")


def configured() -> bool:
    return bool(config.twilio_account_sid and config.twilio_api_key_sid and config.twilio_api_key_secret)


def nanp_number(raw: str) -> Optional[str]:
    """A US or Canadian number in E.164 (+1XXXXXXXXXX), from whatever the visitor typed, or None."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    n = f"+1{digits}"
    return n if len(digits) == 10 and NANP.match(n) else None


def pretty(n: str) -> str:
    """+12065550142 -> (206) 555-0142."""
    d = n[-10:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else n


async def _request(method: str, path: str, data: Optional[dict[str, Any]] = None, params: Optional[dict[str, str]] = None) -> tuple[int, dict[str, Any]]:
    if not configured():
        return 0, {"message": "not_configured"}
    try:
        async with httpx.AsyncClient(timeout=15, auth=(config.twilio_api_key_sid, config.twilio_api_key_secret)) as http:
            r = await http.request(method, f"{API}/Accounts/{config.twilio_account_sid}{path}", data=data, params=params)
        try:
            body = r.json()
        except ValueError:
            body = {}
        return r.status_code, body
    except httpx.HTTPError as err:
        log.warn("twilio_api.failed", {"route": path.split("?")[0]}, err)
        return 0, {"message": "network"}


async def place_call(to: str, from_: str, answer_url: str, status_callback: str) -> Optional[str]:
    """
    Rings `to`. When it's answered, Twilio first checks whether a person or a voicemail picked up
    (answering machine detection), then asks `answer_url` what to do, with AnsweredBy in the request.
    Progress (ringing, answered, completed, no answer) goes to `status_callback`. Returns the call SID, or None.
    """
    status, body = await _request(
        "POST",
        "/Calls.json",
        data={
            "To": to, "From": from_, "Url": answer_url, "Method": "POST", "Timeout": "25",
            "MachineDetection": "Enable", "MachineDetectionTimeout": "8",
            "StatusCallback": status_callback, "StatusCallbackMethod": "POST",
            # Twilio takes one StatusCallbackEvent parameter per event.
            "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
        },
    )
    if status >= 300 or status == 0:
        log.warn("twilio_api.call_failed", {"outcome": status, "code": body.get("code")})
        return None
    return body.get("sid")


async def send_sms(to: str, body: str, from_: Optional[str] = None) -> bool:
    status, out = await _request("POST", "/Messages.json", data={"To": to, "From": from_ or config.sms_from, "Body": body[:1500]})
    if status >= 300 or status == 0:
        log.warn("twilio_api.sms_failed", {"outcome": status, "code": out.get("code")})
        return False
    return True


async def buy_local_number(area_code: str, friendly_name: str, voice_url: str) -> Optional[str]:
    """
    Buys a voice-capable local number in the area code (or, if it has none free, anywhere in the US)
    with its incoming calls pointed at `voice_url`. Returns the number in E.164, or None.
    """
    candidates: list[dict[str, Any]] = []
    for params in ({"AreaCode": area_code, "VoiceEnabled": "true", "SmsEnabled": "true"}, {"AreaCode": area_code, "VoiceEnabled": "true"}, {"VoiceEnabled": "true", "SmsEnabled": "true"}):
        if "AreaCode" in params and not re.fullmatch(r"[2-9][0-9]{2}", area_code or ""):
            continue
        status, body = await _request("GET", "/AvailablePhoneNumbers/US/Local.json", params={**params, "PageSize": "5"})
        candidates = body.get("available_phone_numbers") or [] if status == 200 else []
        if candidates:
            break
    for c in candidates:
        status, body = await _request("POST", "/IncomingPhoneNumbers.json", data={"PhoneNumber": c["phone_number"], "FriendlyName": friendly_name[:64], "VoiceUrl": voice_url, "VoiceMethod": "POST"})
        if status in (200, 201):
            log.info("twilio_api.number_bought", {"outcome": "ok"})
            return body.get("phone_number")
        log.warn("twilio_api.buy_failed", {"outcome": status, "code": body.get("code")})
    return None
