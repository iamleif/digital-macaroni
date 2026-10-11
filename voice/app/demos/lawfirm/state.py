"""
One call at Alder & Finch: the intake, the conflict check, the assessment, the attorney calendar,
consultations and messages. Availability comes from a small calendar generated relative to the
session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from ..types import add_days, date_in, date_label, weekday
from .store import (
    ACCIDENT_TYPES,
    ATTORNEYS,
    CLOSED_WEEKDAYS,
    DAYS_AHEAD,
    DEATH_POINTS,
    FAULT_LABEL,
    FAULT_POINTS,
    FORMAT_LABEL,
    HOURS,
    INJURY_AREAS,
    INSURED_POINTS,
    OTHERWISE_TIER,
    POLICE_REPORT_POINTS,
    REQUIRED,
    SENIOR_PARTNER,
    TIERS,
    TIME_ZONE,
    TREATMENT_LABEL,
    TREATMENT_POINTS,
    attorney,
)

AccidentType = Literal[ACCIDENT_TYPES]  # type: ignore[valid-type]
InjuryArea = Literal[tuple(INJURY_AREAS)]  # type: ignore[valid-type]
Treatment = Literal[tuple(TREATMENT_LABEL)]  # type: ignore[valid-type]
Fault = Literal[tuple(FAULT_LABEL)]  # type: ignore[valid-type]
Tri = Literal["yes", "no", "unknown"]
Format = Literal[tuple(FORMAT_LABEL)]  # type: ignore[valid-type]


@dataclass
class Consult:
    id: str
    slot_id: str
    attorney_id: str
    fmt: str
    name: str
    status: Literal["booked", "cancelled"]
    updated_at: str
    changes: int = 0


@dataclass
class Booked:
    attorney_id: str
    date: str
    hour: int
    ref: str
    existing: bool


@dataclass
class Message:
    id: str
    name: str
    callback_number: str
    summary: str
    preferred_time: Optional[str]
    urgent: bool
    created_at: str


@dataclass
class LawFirmState:
    seed: str
    today: str
    earliest_today_hour: int
    calendar: list[Booked] = field(default_factory=list)
    intake: dict[str, Any] = field(default_factory=dict)
    # None until the check has run; then {"status": "clear" | "conflict", "names": [...]}.
    conflict: Optional[dict[str, Any]] = None
    # None until assess_case has run.
    assessment: Optional[dict[str, Any]] = None
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    consults: list[Consult] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    # The matter record opens on the first thing the caller says that is worth keeping.
    opened: bool = False


# ---- Time ----


def slot_id(day: str, hour: int) -> str:
    return f"{day}T{hour:02d}"


def parse_slot(sid: str) -> Optional[tuple[str, int]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})", sid)
    return (m.group(1), int(m.group(2))) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def bookable_days(state: LawFirmState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in CLOSED_WEEKDAYS]


def eligible_attorneys(state: LawFirmState) -> list[str]:
    """Who can take this caller's case: the accident type, and serious injuries go to the senior partner."""
    kind = state.intake.get("accidentType", "other")
    a = state.assessment or {}
    if a.get("tier") == "A":
        return [SENIOR_PARTNER]
    return [t["id"] for t in ATTORNEYS if kind in t["types"]]


def free_attorney(state: LawFirmState, day: str, hour: int, pool: list[str], ignore_ref: Optional[str] = None) -> Optional[str]:
    for aid in pool:
        if not any(b.attorney_id == aid and b.date == day and b.hour == hour and b.ref != ignore_ref for b in state.calendar):
            return aid
    return None


def open_slots(state: LawFirmState, day: str, pool: list[str], ignore_ref: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    return [slot_id(day, h) for h in HOURS if (day != state.today or h >= state.earliest_today_hour) and free_attorney(state, day, h, pool, ignore_ref)]


def describe_slot(state: LawFirmState, sid: str, pool: Optional[list[str]] = None, ignore_ref: Optional[str] = None) -> dict[str, str]:
    day, hour = parse_slot(sid)  # type: ignore[misc]
    out = {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour)}
    who = free_attorney(state, day, hour, pool or eligible_attorneys(state), ignore_ref)
    if who:
        out["attorney"] = attorney(who)["name"]
    return out


def create_state(now: datetime) -> LawFirmState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = LawFirmState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (3 if minute > 0 else 2))
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        day_index = datetime.fromisoformat(day).toordinal() - today_ord
        for hi, h in enumerate(HOURS):
            for ai, a in enumerate(ATTORNEYS):
                if (day_index * 5 + hi * 3 + ai * 4) % 3 == 0 or (day_index == 1 and h in (10, 14) and a["id"] == "marcus"):
                    state.calendar.append(Booked(a["id"], day, h, f"existing-{n}", True))
                    n += 1
    return state


# ---- Intake helpers ----


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


def name_matches(a: str, b: str) -> bool:
    """Case-insensitive; a first-name-only or reordered match counts when every word of the shorter name appears."""
    wa, wb = set(norm(a).split()), set(norm(b).split())
    if not wa or not wb:
        return False
    short, long_ = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
    return short <= long_ and (len(short) > 1 or len(long_) == 1)


def parse_day(s: str) -> Optional[date]:
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def years_between(start: date, end: date) -> float:
    return (end - start).days / 365.25


def missing_fields(state: LawFirmState) -> list[str]:
    return [label for key, label in REQUIRED if state.intake.get(key) in (None, "")]


def score(state: LawFirmState) -> int:
    i = state.intake
    pts = TREATMENT_POINTS.get(i.get("treatment", "none"), 0) + FAULT_POINTS.get(i.get("atFault", "unsure"), 1)
    pts += POLICE_REPORT_POINTS.get(i.get("policeReport"), 0)
    pts += INSURED_POINTS.get(i.get("otherPartyInsured"), 0)
    pts += DEATH_POINTS if i.get("someoneDied") else 0
    return pts


def tier_of(pts: int) -> str:
    return next((t for t, least in TIERS.items() if pts >= least), OTHERWISE_TIER)


def active(state: LawFirmState) -> list[Consult]:
    return [c for c in state.consults if c.status == "booked"]


def confirm_text(state: LawFirmState, c: Consult) -> str:
    s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
    return f"{FORMAT_LABEL[c.fmt]} with {attorney(c.attorney_id)['name']} on {s['day']} at {s['time']}. Reference {c.id}."
