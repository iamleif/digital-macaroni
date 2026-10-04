"""
Duffel's flights API, read-only: place lookups, flight searches and fresh offer details. This module
never creates orders; the travel demo stops at the booking step. Duffel's own Python SDK is archived
and pinned to a switched-off API version, so this calls the REST API directly.

One access token is shared by every visitor and Duffel allows 60 requests a minute per account, so
calls pass through a process-wide limiter and place lookups are cached.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import httpx

from . import log
from .config import config

API = "https://api.duffel.com"
VERSION = "v2"
# Duffel waits this long for airlines before returning what it has. Short, because a caller is listening.
SUPPLIER_TIMEOUT_MS = 8000
# Requests a minute, under Duffel's 60 so a burst of visitors gets slowed here rather than refused there.
RATE_PER_MIN = 50
PLACES_TTL_S = 6 * 60 * 60


class DuffelError(Exception):
    def __init__(self, kind: str, status: int = 0) -> None:
        super().__init__(kind)
        self.kind = kind
        self.status = status


class _Limiter:
    """A sliding one-minute window shared by every session in this process."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self.calls: list[float] = []
        self.lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self.lock:
            while True:
                now = time.monotonic()
                self.calls = [t for t in self.calls if now - t < 60]
                if len(self.calls) < self.per_minute:
                    self.calls.append(now)
                    return
                await asyncio.sleep(60 - (now - self.calls[0]) + 0.05)


_limiter = _Limiter(RATE_PER_MIN)
_places: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_client: Optional[httpx.AsyncClient] = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=API,
            timeout=httpx.Timeout(SUPPLIER_TIMEOUT_MS / 1000 + 6, connect=5),
            headers={"Duffel-Version": VERSION, "Accept": "application/json", "Accept-Encoding": "gzip", "Authorization": f"Bearer {config.duffel_token}"},
        )
    return _client


async def _call(name: str, method: str, path: str, *, params: Optional[dict[str, Any]] = None, body: Optional[dict[str, Any]] = None) -> Any:
    if not config.duffel_token:
        raise DuffelError("not_configured")
    await _limiter.wait()
    started = time.monotonic()
    try:
        r = await _http().request(method, path, params=params, json={"data": body} if body is not None else None)
    except httpx.TimeoutException as err:
        raise DuffelError("timeout") from err
    except httpx.HTTPError as err:
        raise DuffelError("network") from err
    log.info("duffel.request", {"op": name, "status": r.status_code, "latency_ms": int((time.monotonic() - started) * 1000)})
    if r.status_code == 429:
        raise DuffelError("rate_limited", 429)
    if r.status_code >= 400:
        # Error bodies describe the request, not the visitor; log only their codes.
        codes = ",".join(str(e.get("code")) for e in (r.json().get("errors") or [])[:3]) if r.headers.get("content-type", "").startswith("application/json") else ""
        log.warn("duffel.error", {"op": name, "status": r.status_code, "outcome": codes[:120]})
        raise DuffelError("not_found" if r.status_code == 404 else "rejected", r.status_code)
    return r.json()["data"]


async def suggest_places(query: str) -> list[dict[str, Any]]:
    """Airports and cities matching a name or code, e.g. "London" or "JFK"."""
    key = query.strip().lower()
    hit = _places.get(key)
    if hit and time.monotonic() - hit[0] < PLACES_TTL_S:
        return hit[1]
    data = await _call("places", "GET", "/places/suggestions", params={"query": query.strip()})
    places = [
        {
            "code": p.get("iata_code"),
            "name": p.get("name"),
            "type": p.get("type"),
            "city": p.get("city_name") or (p.get("city") or {}).get("name"),
            "country": p.get("iata_country_code"),
            "airports": [a.get("iata_code") for a in p.get("airports") or [] if a.get("iata_code")][:6],
        }
        for p in data
        if p.get("iata_code")
    ][:6]
    _places[key] = (time.monotonic(), places)
    return places


async def search_offers(slices: list[dict[str, str]], adults: int, cabin_class: str, max_connections: int) -> list[dict[str, Any]]:
    """Runs a search and returns its offers, cheapest first (raw Duffel offers)."""
    request = await _call(
        "search",
        "POST",
        "/air/offer_requests",
        params={"return_offers": "false", "supplier_timeout": SUPPLIER_TIMEOUT_MS},
        body={"slices": slices, "passengers": [{"type": "adult"} for _ in range(adults)], "cabin_class": cabin_class, "max_connections": max_connections},
    )
    return await _call("offers", "GET", "/air/offers", params={"offer_request_id": request["id"], "sort": "total_amount", "limit": 50, "max_connections": max_connections})


async def get_offer(offer_id: str) -> dict[str, Any]:
    """One offer with the airline's current price."""
    return await _call("offer", "GET", f"/air/offers/{offer_id}")
