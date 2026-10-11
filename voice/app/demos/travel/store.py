"""
Waypoint's business data and its flight source. The only module that reads data/*.json and the only
one that talks to Duffel: the tools ask here, never the files or the airline API, so a live install
can swap these for its own booking system (Sabre, Amadeus, a consolidator…) without touching the agent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ... import duffel

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


_agency = _load("agency.json")
TIME_ZONE: str = _agency["timeZone"]
# Departure windows the caller can ask for, in the airport's local time.
TIME_WINDOWS: dict[str, tuple[str, str]] = {k: tuple(v) for k, v in _agency["departureWindows"].items()}  # type: ignore[misc]
CURRENCY: dict[str, str] = _load("currencies.json")["symbols"]
# What an airline needs besides the name. A public demo never collects these: they are shown as samples.
SAMPLE_TRAVELLER: dict[str, str] = _load("sample_traveller.json")

# ---- The flight source (Duffel, read-only) ----

# Duffel searches up to about eleven months ahead.
MAX_DAYS_AHEAD = 330

DuffelError = duffel.DuffelError


async def suggest_places(query: str) -> list[dict[str, Any]]:
    return await duffel.suggest_places(query)


async def search_offers(slices: list[dict[str, Any]], adults: int, cabin_class: str, max_connections: int) -> list[dict[str, Any]]:
    return await duffel.search_offers(slices, adults, cabin_class, max_connections)


async def get_offer(offer_id: str, services: bool = False) -> dict[str, Any]:
    return await duffel.get_offer(offer_id, services=services)


async def seat_maps(offer_id: str) -> list[dict[str, Any]]:
    return await duffel.seat_maps(offer_id)
