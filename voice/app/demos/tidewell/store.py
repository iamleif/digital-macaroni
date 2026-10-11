"""
Tidewell Clinic's business data. The only module that reads data/*.json: the tools ask here, so a live
install can swap these reads for its practice system (Jane, Mindbody…) without touching the agent.
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
PACKAGE: dict[str, str] = _services["package"]
STAFF_IDS: tuple[str, ...] = tuple(p["id"] for p in _team["staff"])
_insurance = _load("insurance.json")
DIRECT_BILL: list[str] = _insurance["direct"]
INSURER_ALIASES: dict[str, str] = _insurance["aliases"]
PATIENTS: list[dict[str, Any]] = _load("patients.json")["patients"]
_hours = _load("hours.json")

CAL = Calendar(
    prefix="TW", time_zone=TIME_ZONE, open_hour=_hours["openHour"], close_hour=_hours["closeHour"],
    closed_weekdays=frozenset(_hours["closedWeekdays"]), days_ahead=_hours["daysAhead"],
    staff=_team["staff"], services=SERVICES, busy_titles=_team["busyTitles"],
)

BUSINESS["menu"] = [{"service": s["id"], "name": s["name"], "selfPay": s["priceLabel"], "minutes": s["minutes"], "with": CAL.person(s["staff"][0])["name"], **({"newPatientsOnly": True} if s.get("newPatient") else {}), **({"returningPatientsOnly": True} if s.get("returningOnly") else {})} for s in SERVICES]
BUSINESS["package"] = PACKAGE
BUSINESS["team"] = [{"name": p["name"], "role": p["role"]} for p in _team["staff"]]


def _words(s: str) -> set[str]:
    return set(re.sub(r"[^a-z ]", " ", s.lower()).split())


def find_patient(name: str, date_of_birth: str) -> Optional[dict[str, Any]]:
    w = _words(name)
    return next((p for p in PATIENTS if _words(p["name"]) == w and p["dateOfBirth"] == date_of_birth), None)


def insurer(said: str) -> Optional[str]:
    """The plan we bill directly, from what the caller called it; None when we don't."""
    t = said.lower()
    return next((v for k, v in INSURER_ALIASES.items() if k in t), None)
