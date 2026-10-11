"""
Lune Salon & Med Spa's business data. The only module that reads data/*.json: the tools ask here, so a
live install can swap these reads for its booking system (Boulevard, Vagaro, Square…) without
touching the agent.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from ..booking import Calendar

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


BUSINESS: dict[str, Any] = _load("business.json")
TIME_ZONE: str = BUSINESS.pop("timeZone")
_team = _load("team.json")
_services = _load("services.json")
SERVICES: list[dict[str, Any]] = _services["services"]
SERVICE_IDS: tuple[str, ...] = tuple(s["id"] for s in SERVICES)
ADD_ONS: list[dict[str, Any]] = _services["addOns"]
ADD_ON_IDS: tuple[str, ...] = tuple(a["id"] for a in ADD_ONS)
DEPOSIT_FROM: int = _services["depositFrom"]
DEPOSIT: str = _services["deposit"]
STAFF_IDS: tuple[str, ...] = tuple(p["id"] for p in _team["staff"])
CLIENTS: list[dict[str, Any]] = _load("clients.json")["clients"]
_hours = _load("hours.json")

CAL = Calendar(
    prefix="LN", time_zone=TIME_ZONE, open_hour=_hours["openHour"], close_hour=_hours["closeHour"],
    closed_weekdays=frozenset(_hours["closedWeekdays"]), days_ahead=_hours["daysAhead"],
    staff=_team["staff"], services=SERVICES, busy_titles=_team["busyTitles"],
)

BUSINESS["menu"] = [{"service": s["id"], "name": s["name"], "price": s["priceLabel"], "minutes": s["minutes"], "with": [CAL.person(p)["name"] for p in s["staff"]]} for s in SERVICES]
BUSINESS["addOns"] = [{"addOn": a["id"], "name": a["name"], "price": a["price"], "with": [CAL.service(x)["name"] for x in a["with"]]} for a in ADD_ONS]
BUSINESS["team"] = [{"name": p["name"], "role": p["role"]} for p in _team["staff"]]


def add_on(aid: str) -> dict[str, Any]:
    return next(a for a in ADD_ONS if a["id"] == aid)


def _words(s: str) -> set[str]:
    return set(re.sub(r"[^a-z ]", " ", s.lower()).split())


def known_client(name: str) -> Optional[dict[str, Any]]:
    """A returning client, matched on their full name."""
    w = _words(name)
    return next((c for c in CLIENTS if len(w) > 1 and _words(c["name"]) == w), None)
