"""
RentCast home-value estimates (AVM) for Juniper Row Realty. Listings are not fetched here: they are a
cached file (scripts/refresh_listings.py). An estimate costs one request against a small monthly quota,
so each address is asked once per process and the process stops asking after a cap.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from .config import config

API = "https://api.rentcast.io/v1"
TIMEOUT_S = 10

_cache: dict[str, dict[str, Any]] = {}
_spent = 0
_client: Optional[httpx.AsyncClient] = None


class EstimateError(Exception):
    """No estimate: not configured, out of quota, address not found, or the service failed."""


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=API, timeout=TIMEOUT_S, headers={"Accept": "application/json"})
    return _client


async def value(address: str) -> dict[str, Any]:
    """{price, low, high, comparables, propertyType, beds, baths, sqft} for a full street address."""
    global _spent
    key = " ".join(address.lower().split())
    if key in _cache:
        return _cache[key]
    if not config.rentcast_api_key:
        raise EstimateError("not_configured")
    if _spent >= config.rentcast_max_estimates:
        raise EstimateError("quota")
    _spent += 1
    try:
        r = await _http().get("/avm/value", params={"address": address, "compCount": 10}, headers={"X-Api-Key": config.rentcast_api_key})
    except httpx.HTTPError as e:
        raise EstimateError("unavailable") from e
    if r.status_code == 404:
        raise EstimateError("not_found")
    if r.status_code != 200:
        raise EstimateError("unavailable")
    d = r.json()
    if not d.get("price"):
        raise EstimateError("not_found")
    s = d.get("subjectProperty") or {}
    out = {
        "price": int(d["price"]),
        "low": int(d.get("priceRangeLow") or d["price"] * 0.92),
        "high": int(d.get("priceRangeHigh") or d["price"] * 1.08),
        "comparables": len(d.get("comparables") or []),
        "address": s.get("formattedAddress") or address,
        "propertyType": s.get("propertyType"),
        "beds": s.get("bedrooms"),
        "baths": s.get("bathrooms"),
        "sqft": s.get("squareFootage"),
    }
    _cache[key] = out
    return out
