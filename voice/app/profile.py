"""
A business profile from a website: what the generic agent knows about the business it answers for.

We read the home page and up to four internal pages that usually carry the facts (about, services,
contact, hours, FAQ, pricing, booking). Only public web addresses are fetched: a host that resolves
to a private, loopback, link-local or reserved address is refused, at every redirect, so a visitor's
"website" can never reach the cloud metadata server or anything internal. When that yields too
little text (JavaScript-only sites, bot walls), Gemini's URL context reads the site instead.
A Gemini text model then writes the profile. It never invents: anything the site doesn't say stays empty.
"""

from __future__ import annotations

import asyncio
import html
import ipaddress
import json
import re
import socket
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from pydantic import BaseModel, Field

from . import log
from .config import config

MAX_BYTES = 1_500_000
MAX_TEXT = 30_000
THIN_TEXT = 600
USEFUL = re.compile(r"about|service|contact|hour|faq|question|pricing|price|rate|menu|book|appointment|location|area|team|practice|treatment", re.I)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 DigitalMacaroniAgent/1.0"


class Faq(BaseModel):
    q: str
    a: str


class Profile(BaseModel):
    business_name: str = Field(description="The business's name as it presents itself.")
    summary: str = Field(description="One or two plain sentences: what the business does and for whom.")
    industry: str = Field("", description="A short label, e.g. 'dental clinic', 'HVAC contractor', 'personal injury law firm'.")
    services: list[str] = Field(default_factory=list, description="Services or products offered, short names, at most 15.")
    hours: str = Field("", description="Opening hours as the site states them, or empty.")
    location: str = Field("", description="Street address or city, or empty.")
    service_area: str = Field("", description="Areas served, or empty.")
    phone: str = Field("", description="The business's main phone number, or empty.")
    email: str = Field("", description="The business's public contact email, or empty.")
    booking_url: str = Field("", description="A full URL where customers book or request an appointment online, or empty.")
    time_zone: str = Field("America/New_York", description="IANA time zone of the business's location, best guess from the address; America/New_York if unknown.")
    faqs: list[Faq] = Field(default_factory=list, description="Up to 10 questions customers ask, with the site's own answers.")
    prices: list[str] = Field(default_factory=list, description="Prices exactly as stated on the site (e.g. 'New patient exam $99'), at most 10. Never estimate.")
    policies: list[str] = Field(default_factory=list, description="Policies worth knowing on a call: cancellation, payment, insurance, emergencies, guarantees. At most 8.")
    website: str = ""


def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError):
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return bool(infos)


def normalise_url(raw: str) -> Optional[str]:
    s = (raw or "").strip()
    if not s:
        return None
    if not re.match(r"^https?://", s, re.I):
        s = "https://" + s
    u = urlparse(s)
    host = (u.hostname or "").lower()
    if u.scheme not in ("http", "https") or "." not in host or len(s) > 300 or u.port not in (None, 80, 443):
        return None
    return u._replace(fragment="").geturl()


async def _get(http: httpx.AsyncClient, url: str) -> Optional[tuple[str, str]]:
    """GET a public page, following up to four redirects, each checked. Returns (final url, html)."""
    for _ in range(5):
        host = urlparse(url).hostname or ""
        if not await asyncio.to_thread(_public_host, host):
            return None
        try:
            async with http.stream("GET", url) as r:
                if r.is_redirect and r.headers.get("location"):
                    url = urljoin(url, r.headers["location"])
                    if urlparse(url).scheme not in ("http", "https"):
                        return None
                    continue
                if r.status_code != 200 or "html" not in r.headers.get("content-type", "html"):
                    return None
                body = b""
                async for chunk in r.aiter_bytes():
                    body += chunk
                    if len(body) > MAX_BYTES:
                        break
                return url, body.decode(r.encoding or "utf-8", errors="replace")
        except (httpx.HTTPError, UnicodeError):
            return None
    return None


def page_text(doc: str) -> str:
    doc = re.sub(r"(?is)<(script|style|noscript|svg|template)[^>]*>.*?</\1>", " ", doc)
    doc = re.sub(r"(?is)<!--.*?-->", " ", doc)
    doc = re.sub(r"(?i)<(br|/p|/div|/li|/h[1-6]|/tr)[^>]*>", "\n", doc)
    title = re.search(r"(?is)<title[^>]*>(.*?)</title>", doc)
    meta = re.search(r'(?is)<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)', doc)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", doc))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text).strip()
    head = " | ".join(html.unescape(m.group(1)).strip() for m in (title, meta) if m)
    return (head + "\n" + text) if head else text


def useful_links(base: str, doc: str, limit: int = 4) -> list[str]:
    host = urlparse(base).hostname
    seen: list[str] = []
    for href, label in re.findall(r'(?is)<a[^>]+href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', doc):
        url = urljoin(base, href.strip()).split("#")[0]
        u = urlparse(url)
        if u.scheme not in ("http", "https") or u.hostname != host or url.rstrip("/") == base.rstrip("/"):
            continue
        if re.search(r"\.(pdf|jpe?g|png|gif|webp|zip|mp4)$", u.path, re.I):
            continue
        if USEFUL.search(u.path) or USEFUL.search(re.sub(r"<[^>]+>", " ", label)):
            if url not in seen:
                seen.append(url)
        if len(seen) >= limit:
            break
    return seen


async def read_site(url: str) -> str:
    """The text of the home page and its most useful internal pages, capped."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(8, connect=4), headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.5"}, follow_redirects=False) as http:
        home = await _get(http, url)
        if not home:
            return ""
        final, doc = home
        pages = [f"PAGE {final}\n{page_text(doc)}"]
        more = await asyncio.gather(*(_get(http, link) for link in useful_links(final, doc)), return_exceptions=True)
        for got in more:
            if isinstance(got, tuple):
                pages.append(f"PAGE {got[0]}\n{page_text(got[1])[:8000]}")
    return "\n\n".join(pages)[:MAX_TEXT]


PROMPT = """You are setting up an AI phone agent for a business. From the website content below, write the business profile as JSON with exactly these keys: {keys}.

Rules: use only facts the website states. Leave a field empty ("" or []) when the site doesn't say. Never estimate prices, hours or policies. Write plainly, as the business would say it to a customer on the phone. Keep each list item short.{extra}"""


def _client():
    from google import genai

    return genai.Client(api_key=config.gemini_api_key)


def _parse(text: str, website: str) -> Optional[Profile]:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        if not isinstance(data, dict):
            return None
        # Models sometimes return hours as a list or a list as one string: bend them to the shape.
        for k, f in Profile.model_fields.items():
            v = data.get(k)
            if f.annotation is str and isinstance(v, list):
                data[k] = "; ".join(str(x) for x in v if x)
            elif f.annotation is str and v is None:
                data.pop(k, None)
            elif k in ("services", "prices", "policies") and isinstance(v, str):
                data[k] = [v] if v else []
        if not data.get("time_zone"):
            data.pop("time_zone", None)
        faqs = []
        for x in data.get("faqs") or []:
            if isinstance(x, dict):
                q, a = x.get("q") or x.get("question"), x.get("a") or x.get("answer")
                if isinstance(q, str) and isinstance(a, str) and q and a:
                    faqs.append({"q": q, "a": a})
        data["faqs"] = faqs
        for k in ("services", "prices", "policies"):
            data[k] = [x if isinstance(x, str) else " ".join(str(v) for v in x.values()) if isinstance(x, dict) else str(x) for x in data.get(k) or []]
        data["website"] = website
        p = Profile.model_validate(data)
    except (ValueError, TypeError) as err:
        log.warn("profile.unreadable", {}, err)
        return None
    return p if p.business_name.strip() else None


async def build_profile(website: str, hint_name: str = "") -> Optional[Profile]:
    """The profile for a website, or None if neither our reader nor Gemini's could make sense of it."""
    from google.genai import types

    keys = ", ".join(Profile.model_fields)
    extra = f"\n\nThe business calls itself: {hint_name}." if hint_name else ""
    text = await read_site(website)
    log.info("profile.read", {"count": len(text)})
    try:
        client = _client()
        if len(text) >= THIN_TEXT:
            r = await client.aio.models.generate_content(
                model=config.text_model,
                contents=PROMPT.format(keys=keys, extra=extra) + "\n\nWEBSITE CONTENT:\n" + text,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
            )
            p = _parse(r.text or "", website)
            if p:
                return p
        # Too little to work with: let Gemini read the site itself.
        r = await client.aio.models.generate_content(
            model=config.text_model,
            contents=PROMPT.format(keys=keys, extra=extra) + f"\n\nThe website is {website}. Read it (and its about, services, contact and FAQ pages). Reply with the JSON only.",
            config=types.GenerateContentConfig(tools=[types.Tool(url_context=types.UrlContext())], temperature=0.2),
        )
        return _parse(r.text or "", website)
    except Exception as err:  # noqa: BLE001
        log.warn("profile.failed", {}, err)
        return None


def fallback_profile(website: str, name: str = "") -> Profile:
    """When a site can't be read: enough for the agent to answer politely and take messages."""
    host = (urlparse(website).hostname or "").removeprefix("www.")
    label = name or host.split(".")[0].replace("-", " ").title()
    return Profile(business_name=label, summary=f"{label}. The agent has no details from the website yet, so it takes messages for the team.", website=website)


def profile_facts(p: dict[str, Any]) -> dict[str, Any]:
    """What get_business_info returns: the profile without empty fields."""
    return {k: v for k, v in p.items() if v not in ("", [], None)}
