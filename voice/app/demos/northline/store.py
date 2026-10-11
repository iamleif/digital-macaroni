"""
Northline's business data. The only module that reads data/*.json: the tools ask here, never the
files, so a live install can swap these reads for its real system (Jobber, Housecall Pro…)
without touching the agent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


_hours = _load("hours.json")
TIME_ZONE: str = _hours["timeZone"]
WINDOWS: tuple[int, ...] = tuple(_hours["arrivalWindows"])
DAYS_AHEAD: int = _hours["daysAhead"]
OPEN_HOURS: tuple[int, int] = tuple(_hours["openHours"])  # type: ignore[assignment]
# 0 is Sunday, as in JavaScript.
CLOSED_WEEKDAYS: frozenset[int] = frozenset(_hours["closedWeekdays"])

TECHNICIANS: list[dict[str, Any]] = [{**t, "skills": tuple(t["skills"])} for t in _load("team.json")["technicians"]]

_services = _load("services.json")
SERVICES: list[dict[str, Any]] = _services["services"]
SERVICE_IDS: tuple[str, ...] = tuple(s["id"] for s in SERVICES)
# Booked on request alone; every other service needs what the caller has actually noticed.
NO_SYMPTOM_NEEDED: frozenset[str] = frozenset(_services["noSymptomNeeded"])

# Everything Ellie may tell a caller about Northline, in one place. Her instructions carry only what
# she needs to run a call; get_business_info returns this, and she answers from it.
_business = _load("business.json")
BUSINESS: dict[str, Any] = {}
for _k, _v in _business.items():
    BUSINESS[_k] = _v
    if _k == "hours":
        BUSINESS["services"] = [{"service": s["id"], "name": s["name"], "price": f"${s['fee']}" if s["fee"] else "Free", "covers": s["about"]} for s in SERVICES]


def service(sid: str) -> dict[str, Any]:
    return next(s for s in SERVICES if s["id"] == sid)


def tech_name(tid: str) -> str:
    return next((t["name"] for t in TECHNICIANS if t["id"] == tid), tid)


def first_name(tid: str) -> str:
    return tech_name(tid).split(" ")[0]
