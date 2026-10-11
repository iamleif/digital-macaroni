"""
Juniper Row Realty's business data and its outside sources. The only module that reads data/*.json
the tools ask here, so a live install can swap these reads for its own CRM and MLS feed without
touching the agent.

Listings are real active Austin sale listings, pulled once into data/listings.json by
scripts/refresh_listings.py. A call never reaches RentCast: searches and value estimates both work
from that file.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


BUSINESS: dict[str, Any] = _load("brokerage.json")
TIME_ZONE: str = BUSINESS.pop("timeZone")

_agents = _load("agents.json")
AGENTS: list[dict[str, Any]] = _agents["agents"]
SELLER_AGENT: str = _agents["sellerAgent"]
BUSINESS["agents"] = [{"name": a["name"], "focus": a["focus"]} for a in AGENTS]

AREAS: list[dict[str, Any]] = _load("areas.json")["areas"]
AREA_NAME: dict[str, str] = {a["id"]: a["name"] for a in AREAS}
AREA_IDS: tuple[str, ...] = tuple(AREA_NAME)

_calendar = _load("calendar.json")
SHOWING_HOURS: tuple[int, ...] = tuple(_calendar["showingHours"])
VALUATION_HOURS: tuple[int, ...] = tuple(_calendar["valuationHours"])
DAYS_AHEAD: int = _calendar["daysAhead"]
CLOSED_WEEKDAYS: frozenset[int] = frozenset(_calendar["closedWeekdays"])

CONTACTS: list[dict[str, Any]] = _load("leads.json")["contacts"]

_labels = _load("labels.json")
INTENT_LABEL: dict[str, str] = _labels["intent"]
TIMELINE_LABEL: dict[str, str] = _labels["timeline"]
FINANCING_LABEL: dict[str, str] = _labels["financing"]
TYPE_LABEL: dict[str, str] = _labels["propertyTypes"]
SELLER_REASON_LABEL: dict[str, str] = _labels["sellerReason"]

_qualify = _load("qualify.json")
REQUIRED: list[tuple[str, str]] = [(r["key"], r["ask"]) for r in _qualify["required"]]
POINTS: dict[str, Any] = _qualify["points"]
TIERS: dict[str, int] = _qualify["tiers"]
OTHERWISE_TIER: str = _qualify["otherwiseTier"]
TIER_NOTE: dict[str, str] = _qualify["tierNote"]

_listings_file = _DATA / "listings.json"
_snapshot = json.loads(_listings_file.read_text()) if _listings_file.exists() else {"listings": [], "snapshot": None}
LISTINGS: list[dict[str, Any]] = _snapshot["listings"]
SNAPSHOT: Optional[str] = _snapshot.get("snapshot")


def agent(aid: str) -> dict[str, Any]:
    return next(a for a in AGENTS if a["id"] == aid)


def first_name(aid: str) -> str:
    return agent(aid)["name"].split(" ")[0]


def agent_for_area(area: Optional[str]) -> str:
    """The buyer's agent who covers an area; the first buyer's agent when the area is unknown."""
    buyers = [a for a in AGENTS if a["areas"]]
    return next((a["id"] for a in buyers if area in a["areas"]), buyers[0]["id"])


def _words(s: str) -> list[str]:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()


def area_of(text: str) -> Optional[str]:
    """An area id from what the caller said: an area name, a neighbourhood or a zip code."""
    t = " ".join(_words(text))
    for a in AREAS:
        names = [a["id"], a["name"], *a["places"]]
        if any(" ".join(_words(n)) in t or t in " ".join(_words(n)) for n in names if len(t) >= 3) or any(z in t for z in a["zips"]):
            return a["id"]
    return None


def listing(lid: str) -> Optional[dict[str, Any]]:
    return next((x for x in LISTINGS if x["id"].lower() == lid.strip().lower()), None)


_SUFFIXES = {"street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "lane", "ln", "boulevard", "blvd", "court", "ct", "circle", "cir", "way", "trail", "trl", "place", "pl", "cove", "cv", "unit", "apt", "n", "s", "e", "w", "north", "south", "east", "west"}


def by_street(text: str) -> list[dict[str, Any]]:
    """Listings on the street the caller named ("the place on Clarkson"), with the house number if given."""
    words = _words(text)
    said = set(words)
    number = next((w for w in words if w.isdigit()), None)
    hits = []
    for x in LISTINGS:
        name = {w for w in _words(x["street"]) if w not in _SUFFIXES and not w.isdigit()}
        if name and name <= said:
            hits.append(x)
    if number:
        exact = [x for x in hits if _words(x["address"])[:1] == [number]]
        return exact or hits
    return hits


def search(areas: list[str], min_price: Optional[int], max_price: Optional[int], min_beds: Optional[float], min_baths: Optional[float], types: list[str]) -> list[dict[str, Any]]:
    out = [
        x for x in LISTINGS
        if (not areas or x["area"] in areas)
        and (min_price is None or x["price"] >= min_price)
        and (max_price is None or x["price"] <= max_price)
        and (min_beds is None or x["beds"] >= min_beds)
        and (min_baths is None or x["baths"] >= min_baths)
        and (not types or x["type"] in types)
    ]
    # Closest to the top of the budget first: what the caller can afford, at its best.
    return sorted(out, key=lambda x: -x["price"]) if max_price else sorted(out, key=lambda x: x["price"])


def name_matches(a: str, b: str) -> bool:
    """Every word of the shorter name appears in the longer; a first name alone only matches a one-word name."""
    wa, wb = set(_words(a)), set(_words(b))
    if not wa or not wb:
        return False
    short, long_ = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
    return short <= long_ and (len(short) > 1 or len(long_) == 1)


def known_contact(name: str) -> Optional[dict[str, Any]]:
    """Someone the brokerage has already spoken to ("I talked to someone last week")."""
    return next((c for c in CONTACTS if name_matches(name, c["name"])), None)


class EstimateError(Exception):
    """Not enough comparable homes in our listings to give a range."""


def _zip_in(text: str) -> Optional[str]:
    m = re.search(r"\b(7\d{4})\b", text)
    return m.group(1) if m else None


def estimate_value(address: str, beds: Optional[float] = None, sqft: Optional[int] = None) -> dict[str, Any]:
    """
    A value range for the caller's home from comparable homes in our listings: the same zip code (or
    area), the same kind of home, priced per square foot when we know the size, otherwise by bedrooms.
    Raises EstimateError when there are too few comparables.
    """
    zip_code = _zip_in(address)
    area = next((a["id"] for a in AREAS if zip_code in a["zips"]), None) if zip_code else area_of(address)
    pool = [x for x in LISTINGS if x["type"] == "Single Family"]
    near = [x for x in pool if zip_code and x["zip"] == zip_code]
    if len(near) < 3 and area:
        near = [x for x in pool if x["area"] == area]
    if len(near) < 3:
        raise EstimateError("too_few")
    if sqft:
        per = sorted(x["price"] / x["sqft"] for x in near if x.get("sqft"))
        mid = per[len(per) // 2] * sqft
    else:
        alike = [x for x in near if beds is None or abs(x["beds"] - beds) <= 1] or near
        prices = sorted(x["price"] for x in alike)
        mid = prices[len(prices) // 2]
        near = alike
    rnd = lambda n: int(round(n / 5000) * 5000)  # noqa: E731
    return {"price": rnd(mid), "low": rnd(mid * 0.93), "high": rnd(mid * 1.07), "comparables": len(near), "address": address, "area": AREA_NAME[near[0]["area"]]}
