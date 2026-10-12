"""
Alder & Finch's firm data. The only module that reads data/*.json: the tools ask here, never the
files, so a live install can swap these reads for its real system (Clio, Filevine…) without
touching the agent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


_calendar = _load("calendar.json")
TIME_ZONE: str = _calendar["timeZone"]
HOURS: tuple[int, ...] = tuple(_calendar["consultHours"])
DAYS_AHEAD: int = _calendar["daysAhead"]
# 0 is Sunday, as in JavaScript.
CLOSED_WEEKDAYS: frozenset[int] = frozenset(_calendar["closedWeekdays"])

_jurisdiction = _load("jurisdiction.json")
LICENSED_STATE: str = _jurisdiction["licensedState"]
LIMITATION_YEARS: int = _jurisdiction["limitationYears"]  # Colorado: two years for most injury claims, three for motor vehicle accidents.
VEHICLE_LIMITATION_YEARS: int = _jurisdiction["vehicleLimitationYears"]
VEHICLE_TYPES: tuple[str, ...] = tuple(_jurisdiction["vehicleTypes"])


def limit_years(kind: str) -> int:
    return VEHICLE_LIMITATION_YEARS if kind in VEHICLE_TYPES else LIMITATION_YEARS


_attorneys = _load("attorneys.json")
ATTORNEYS: list[dict[str, Any]] = [{**a, "types": tuple(a["types"])} for a in _attorneys["attorneys"]]
# Serious injuries and deaths go to the senior partner; a conflict goes to the conflicts attorney.
SENIOR_PARTNER: str = _attorneys["seniorPartner"]
# Who works when (weekday -> shift), the order openings come round in, and what the other appointments are called.
SHIFTS: dict[str, Any] = _attorneys["shifts"]
DECK: list[str] = _attorneys["deck"]
FORCED: list[list[Any]] = _attorneys["forced"]
TITLES: list[str] = _attorneys["titles"]
OPEN_WEIGHTS: list[list[float]] = _attorneys["openWeights"]
CONFLICTS_ATTORNEY: str = _attorneys["conflictsAttorney"]

# The firm's wording for the intake form's choices.
_labels = _load("labels.json")
TYPE_LABEL: dict[str, str] = _labels["accidentTypes"]
ACCIDENT_TYPES: tuple[str, ...] = tuple(TYPE_LABEL)
INJURY_AREAS: dict[str, str] = _labels["injuryAreas"]
TREATMENT_LABEL: dict[str, str] = _labels["treatments"]
FAULT_LABEL: dict[str, str] = _labels["fault"]
FORMAT_LABEL: dict[str, str] = _labels["formats"]

# The firm's intake criteria: what must be known, how a case scores, and when it is declined.
_intake = _load("intake.json")
REQUIRED: list[tuple[str, str]] = [(r["key"], r["ask"]) for r in _intake["required"]]
_points = _intake["points"]
TREATMENT_POINTS: dict[str, int] = _points["treatment"]
FAULT_POINTS: dict[str, int] = _points["fault"]
POLICE_REPORT_POINTS: dict[str, int] = _points["policeReport"]
INSURED_POINTS: dict[str, int] = _points["otherPartyInsured"]
DEATH_POINTS: int = _points["someoneDied"]
# Highest tier first: a case takes the first tier whose minimum score it reaches.
TIERS: dict[str, int] = _intake["tiers"]
OTHERWISE_TIER: str = _intake["otherwiseTier"]
OUTSIDE_PRACTICE: tuple[str, ...] = tuple(_intake["outsidePractice"])
DECLINES: dict[str, tuple[str, str]] = {k: (d["why"], d["say"]) for k, d in _intake["declines"].items()}

# People and companies the firm already acts for or against: the conflict check reads these.
_conflicts = _load("conflicts.json")
CLIENTS: list[str] = _conflicts["clients"]
ADVERSE: list[str] = _conflicts["adverse"]

# Other calls that came in overnight, for the 7 AM brief. Fictional, with no contact details.
OVERNIGHT: list[dict[str, Any]] = _load("overnight.json")["calls"]

# Everything Nora may tell a caller about the firm, in one place. get_firm_info returns this.
_firm = _load("firm.json")
BUSINESS: dict[str, Any] = {}
for _k, _v in _firm.items():
    BUSINESS[_k] = _v
    if _k == "fees":
        BUSINESS["attorneys"] = [{"name": a["name"], "focus": a["focus"]} for a in ATTORNEYS]


def attorney(aid: str) -> dict[str, Any]:
    return next(a for a in ATTORNEYS if a["id"] == aid)


def first_name(aid: str) -> str:
    return attorney(aid)["name"].split(" ")[0]
