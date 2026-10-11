"""
Palmetto Stays' business data and its hotel source. The only module that reads data/*.json and the
only one that talks to LiteAPI: the tools ask here, never the files or the hotel API, so a live
install can swap these for its own booking system without touching the agent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ... import liteapi

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


AGENCY: dict[str, Any] = _load("agency.json")
TIME_ZONE: str = AGENCY["timeZone"]
AREAS: dict[str, dict[str, str]] = AGENCY["areas"]
MAX_NIGHTS: int = AGENCY["limits"]["maxNights"]
MAX_ADULTS: int = AGENCY["limits"]["maxAdults"]
DAYS_AHEAD: int = AGENCY["limits"]["daysAhead"]
# What a hotel needs besides the name. A public demo never collects these: they are shown as samples.
SAMPLE_GUEST: dict[str, str] = _load("sample_guest.json")

# ---- The hotel source (LiteAPI sandbox: real hotels and rates, never a booking) ----

LiteError = liteapi.LiteError


async def search_rates(city: str, checkin: str, checkout: str, adults: int) -> dict[str, Any]:
    return await liteapi.search_rates(city, checkin, checkout, adults)


async def hotel_rates(hotel_id: str, checkin: str, checkout: str, adults: int) -> dict[str, Any]:
    return await liteapi.hotel_rates(hotel_id, checkin, checkout, adults)


async def hotel_details(hotel_id: str) -> dict[str, Any]:
    return await liteapi.hotel_details(hotel_id)


async def prebook(offer_id: str) -> dict[str, Any]:
    return await liteapi.prebook(offer_id)
