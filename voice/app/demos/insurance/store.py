"""
Bluebird Insurance Agency's data. The only module that reads data/*.json: the tools ask here, never the
files, so a live install can swap these reads for its agency system (Applied Epic, HawkSoft, EZLynx…)
without touching the agent.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


BUSINESS: dict[str, Any] = _load("agency.json")
TIME_ZONE: str = BUSINESS.pop("timeZone")

CARRIERS: dict[str, dict[str, str]] = {c["id"]: c for c in _load("carriers.json")["carriers"]}
BUSINESS["carriers"] = [c["name"] for c in CARRIERS.values()]

_staff = _load("staff.json")
STAFF: list[dict[str, Any]] = _staff["staff"]
LICENSED: tuple[str, ...] = tuple(_staff["licensed"])
SERVICE: str = _staff["service"]
BUSINESS["team"] = [{"name": s["name"], "role": s["role"]} for s in STAFF]

_calendar = _load("calendar.json")
CALL_HOURS: tuple[int, ...] = tuple(_calendar["callHours"])
DAYS_AHEAD: int = _calendar["daysAhead"]
CLOSED_WEEKDAYS: frozenset[int] = frozenset(_calendar["closedWeekdays"])

CUSTOMERS: list[dict[str, Any]] = _load("customers.json")["customers"]
POLICIES: dict[str, dict[str, Any]] = {p["number"]: p for p in _load("policies.json")["policies"]}

_labels = _load("labels.json")
LINE_LABEL: dict[str, str] = _labels["lines"]
COVERAGE_LABEL: dict[str, str] = _labels["coverageWanted"]
CHANGE_LABEL: dict[str, str] = _labels["changeTypes"]
CLAIM_LABEL: dict[str, str] = _labels["claimTypes"]


def person(sid: str) -> dict[str, Any]:
    return next(s for s in STAFF if s["id"] == sid)


def first_name(sid: str) -> str:
    return person(sid)["name"].split(" ")[0]


def carrier(cid: str) -> dict[str, str]:
    return CARRIERS[cid]


def _words(s: str) -> list[str]:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()


def name_matches(a: str, b: str) -> bool:
    wa, wb = set(_words(a)), set(_words(b))
    if not wa or not wb:
        return False
    short, long_ = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
    return short <= long_ and len(short) > 1


def policy(number: str) -> Optional[dict[str, Any]]:
    key = re.sub(r"[^A-Z0-9]", "", number.upper())
    return next((p for n, p in POLICIES.items() if re.sub(r"[^A-Z0-9]", "", n) == key), None)


def find_customer(name: Optional[str], date_of_birth: Optional[str], policy_number: Optional[str]) -> tuple[Optional[dict[str, Any]], str]:
    """(customer, why). Needs the name with the date of birth, or a policy number with the name."""
    if policy_number:
        p = policy(policy_number)
        if not p:
            return None, "no_policy"
        c = next(c for c in CUSTOMERS if p["number"] in c["policies"])
        if name and not name_matches(name, c["name"]):
            return None, "mismatch"
        return c, "ok"
    if not name:
        return None, "need_name"
    named = [c for c in CUSTOMERS if name_matches(name, c["name"])]
    if not named:
        return None, "not_found"
    if not date_of_birth:
        return None, "need_dob"
    c = next((c for c in named if c["dateOfBirth"] == date_of_birth), None)
    return (c, "ok") if c else (None, "mismatch")
