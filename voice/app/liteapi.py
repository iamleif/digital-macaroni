"""
LiteAPI (Nuitee) hotels, sandbox: real hotels with their photos, guest ratings and live rates, and
prebook, which re-checks a rate and holds its price. This module never books; the hotels demo stops
at payment. Calls the REST API directly.

One key is shared by every visitor and the sandbox allows 5 requests a second, so calls pass
through a process-wide limiter and hotel details are cached.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import httpx

from . import log
from .config import config

API = "https://api.liteapi.travel/v3.0"
BOOK_API = "https://book.liteapi.travel/v3.0"
# Rates come back from many suppliers; a caller is listening, so give up after this long.
TIMEOUT_S = 12
PER_SECOND = 4
DETAILS_TTL_S = 6 * 60 * 60


class LiteError(Exception):
    def __init__(self, kind: str, status: int = 0) -> None:
        super().__init__(kind)
        self.kind = kind
        self.status = status


class _Limiter:
    """A sliding one-second window shared by every session in this process."""

    def __init__(self, per_second: int) -> None:
        self.per_second = per_second
        self.calls: list[float] = []
        self.lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self.lock:
            while True:
                now = time.monotonic()
                self.calls = [t for t in self.calls if now - t < 1]
                if len(self.calls) < self.per_second:
                    self.calls.append(now)
                    return
                await asyncio.sleep(1 - (now - self.calls[0]) + 0.01)


_limiter = _Limiter(PER_SECOND)
_details: dict[str, tuple[float, dict[str, Any]]] = {}
_client: Optional[httpx.AsyncClient] = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(TIMEOUT_S, connect=5),
            headers={"Accept": "application/json", "Accept-Encoding": "gzip", "X-API-Key": config.liteapi_key},
        )
    return _client


async def _call(name: str, method: str, url: str, *, params: Optional[dict[str, Any]] = None, body: Optional[dict[str, Any]] = None) -> Any:
    if not config.liteapi_key:
        raise LiteError("not_configured")
    await _limiter.wait()
    started = time.monotonic()
    try:
        r = await _http().request(method, url, params=params, json=body)
    except httpx.TimeoutException as err:
        raise LiteError("timeout") from err
    except httpx.HTTPError as err:
        raise LiteError("network") from err
    log.info("liteapi.request", {"op": name, "status": r.status_code, "latency_ms": int((time.monotonic() - started) * 1000)})
    if r.status_code == 429:
        raise LiteError("rate_limited", 429)
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code >= 400 or "error" in data:
        # Error bodies describe the request, not the visitor; log only their codes.
        code = (data.get("error") or {}).get("code") if isinstance(data.get("error"), dict) else None
        log.warn("liteapi.error", {"op": name, "status": r.status_code, "outcome": str(code)[:40]})
        # 2001: no availability (sold out, or an offer that has expired).
        raise LiteError("unavailable" if code == 2001 or r.status_code == 404 else "rejected", r.status_code)
    return data


async def search_rates(city: str, checkin: str, checkout: str, adults: int, limit: int = 30, max_rates: int = 3) -> dict[str, Any]:
    """Hotels in a city with their cheapest rates for these dates: {"data": [...rates per hotel], "hotels": [...]}."""
    return await _call(
        "rates",
        "POST",
        f"{API}/hotels/rates",
        body={"cityName": city, "countryCode": "US", "checkin": checkin, "checkout": checkout, "currency": "USD", "guestNationality": "US", "occupancies": [{"adults": adults}], "limit": limit, "maxRatesPerHotel": max_rates, "timeout": TIMEOUT_S - 4},
    )


async def hotel_rates(hotel_id: str, checkin: str, checkout: str, adults: int, max_rates: int = 30) -> dict[str, Any]:
    """Every room and rate one hotel has for these dates."""
    return await _call(
        "hotel_rates",
        "POST",
        f"{API}/hotels/rates",
        body={"hotelIds": [hotel_id], "checkin": checkin, "checkout": checkout, "currency": "USD", "guestNationality": "US", "occupancies": [{"adults": adults}], "maxRatesPerHotel": max_rates, "timeout": TIMEOUT_S - 4},
    )


async def hotel_details(hotel_id: str) -> dict[str, Any]:
    """The hotel's photos, facilities, check-in times and review summary."""
    hit = _details.get(hotel_id)
    if hit and time.monotonic() - hit[0] < DETAILS_TTL_S:
        return hit[1]
    data = (await _call("hotel", "GET", f"{API}/data/hotel", params={"hotelId": hotel_id}))["data"]
    _details[hotel_id] = (time.monotonic(), data)
    return data


async def prebook(offer_id: str) -> dict[str, Any]:
    """Re-checks a rate with the hotel and holds its price. Not a booking: nothing is reserved or charged."""
    return (await _call("prebook", "POST", f"{BOOK_API}/rates/prebook", body={"offerId": offer_id, "usePaymentSdk": False}))["data"]
