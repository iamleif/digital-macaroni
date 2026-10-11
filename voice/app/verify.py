"""
The checks every public form shares: is this a person (Cloudflare Turnstile, "Verify you are human"),
and is this an email address we can really reach (well formed, a domain that receives mail, and not a
throwaway inbox). The throwaway domains come from github.com/disposable-email-domains/disposable-email-domains
(data/disposable_domains.txt; refresh with scripts/refresh_disposable.sh).
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time
from pathlib import Path
from typing import Optional

import httpx

from . import log
from .config import config

_ADDRESS = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
_LIST = Path(__file__).parent / "data" / "disposable_domains.txt"
DISPOSABLE: frozenset[str] = frozenset(
    line.strip().lower() for line in (_LIST.read_text().splitlines() if _LIST.exists() else []) if line.strip() and not line.startswith("#")
)

# What a form shows for each reason.
EMAIL_MESSAGES = {
    "invalid": "That email address doesn't look right.",
    "disposable": "Please use your real email address: we can't send to temporary inboxes.",
    "no_mail": "That email domain doesn't seem to receive email. Please check the spelling.",
}


def is_disposable(domain: str) -> bool:
    """A throwaway domain, or a subdomain of one (x.mailinator.com)."""
    parts = domain.lower().strip(".").split(".")
    return any(".".join(parts[i:]) in DISPOSABLE for i in range(len(parts) - 1))


async def email_problem(address: str) -> Optional[str]:
    """None when the address is good to send to, else "invalid", "disposable" or "no_mail"."""
    from .email import receives_mail

    a = (address or "").strip().lower()
    if len(a) > 254 or not _ADDRESS.match(a):
        return "invalid"
    domain = a.rpartition("@")[2]
    if is_disposable(domain):
        return "disposable"
    if not await receives_mail(domain):
        return "no_mail"
    return None


async def human(token: str, ip: str) -> bool:
    """Cloudflare Turnstile's verdict on a form's "Verify you are human" token. Passes when no secret is set (local runs)."""
    if not config.turnstile_secret:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={"secret": config.turnstile_secret, "response": token, "remoteip": ip})
        return bool(r.json().get("success"))
    except (httpx.HTTPError, ValueError) as err:
        log.warn("verify.turnstile_failed", {}, err)
        return False


# A checked email's pass: the demo setup card checks the address and the visitor once (/check-email), then
# sends this with its setup; the pairing keeps the email only when the pass matches it. Valid ~2 hours.
def email_pass(address: str, at: Optional[float] = None) -> str:
    slot = int((at or time.time()) // 3600)
    key = (config.admin_token or config.proxy_key or "local").encode()
    return hmac.new(key, f"{address.strip().lower()}|{slot}".encode(), hashlib.sha256).hexdigest()[:32]


def pass_ok(address: str, given: str) -> bool:
    now = time.time()
    return bool(given) and any(hmac.compare_digest(email_pass(address, now - h * 3600), given) for h in (0, 1))
