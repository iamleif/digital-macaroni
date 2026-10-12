"""
One call at Alder & Finch: the intake, the conflict check, the assessment, the attorney calendar,
consultations and messages. Availability comes from a small calendar generated relative to the
session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import hashlib
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
    title: str = ""


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
    # Optional questions the caller declined or can't answer; they are not asked again.
    declined: set[str] = field(default_factory=set)


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


_TITLES = ("Client consultation", "Deposition prep", "Mediation", "Case review", "Court hearing", "Settlement call", "Records review", "Expert call", "Client meeting", "Intake review")
_DAY_FILL = {1: 0.50, 2: 0.30, 3: 0.42, 4: 0.58, 5: 0.22}  # how full each weekday tends to be (1 = Monday)
_EPOCH = date(2026, 1, 5)


def _u(*parts: object) -> float:
    """A repeatable number in [0, 1) from the parts: the same date and people always give the same value."""
    return int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode()).digest()[:8], "big") / 2**64


def _business_index(day: str) -> int:
    d = date.fromisoformat(day)
    return sum(1 for i in range((d - _EPOCH).days) if weekday(add_days(_EPOCH.isoformat(), i)) not in CLOSED_WEEKDAYS)


def packed_day(day: str) -> bool:
    """One nearly-full day in every ten business days (a fortnight), fixed by the date alone."""
    return _business_index(day) % 10 == 3


def existing_blocks(day: str) -> list[tuple[str, int, str]]:
    """(attorney id, hour, title) already busy on a day. Seeded by the date, attorney and firm, never by the call time."""
    packed = packed_day(day)
    week = date.fromisoformat(day).toordinal() // 7
    day_fill = 0.9 if packed else min(0.8, max(0.1, _DAY_FILL.get(weekday(day), 0.4) + (_u("af", "week", week) - 0.5) * 0.3 + (_u("af", "day", day) - 0.5) * 0.3))
    out: list[tuple[str, int, str]] = []
    for t in ATTORNEYS:
        aid = t["id"]
        fill = day_fill if packed else min(0.85, max(0.05, day_fill + (_u("af", day, aid, "load") - 0.5) * 0.4))
        keep = (1 if packed else 2) if aid == SENIOR_PARTNER else (0 if packed else 1)
        busy = [h for h in HOURS if _u("af", day, aid, h) < fill]
        free = [h for h in HOURS if h not in busy]
        for h in sorted(busy, key=lambda h: _u("af", day, aid, h, "keep"))[: max(0, keep - len(free))]:
            busy.remove(h)
        out += [(aid, h, _TITLES[int(_u("af", day, aid, h, "title") * len(_TITLES))]) for h in sorted(busy)]
    return out


def create_state(now: datetime) -> LawFirmState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = LawFirmState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (3 if minute > 0 else 2))
    n = 0
    for day in bookable_days(state):
        for aid, h, title in existing_blocks(day):
            state.calendar.append(Booked(aid, day, h, f"existing-{n}", True, title))
            n += 1
    return state


# ---- Intake helpers ----


def has_full_name(name: Optional[str]) -> bool:
    """A first and a last name: at least two words."""
    return len((name or "").split()) >= 2


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


# The firm's intake order: (intake key, question as spoken, required). A question counts as answered once its key
# is on the record (or the caller declined it, optional ones only). Death and serious injury are routed by
# assess_case and the urgent flag on take_message, so they are not asked here.
QUESTIONS: list[tuple[str, str, bool]] = [
    ("accidentType", "What happened? What kind of accident was it?", True),
    ("accidentDate", "When did it happen?", True),
    ("accidentState", "Where did it happen, what city and state?", True),
    ("injuryAreas", "What part of your body was hurt, and what hurts now?", False),
    ("missedWork", "Has it kept you from working?", False),
    ("symptoms", "Any passing out, tingling, numbness, dizziness or headaches?", False),
    ("treatment", "What treatment have you had so far?", True),
    ("treatingProvider", "Who is treating you, a hospital, clinic or doctor?", False),
    ("atFault", "In your view, who was at fault?", True),
    ("policeReport", "Was a police report filed?", False),
    ("otherPartyInsurer", "Do you know the other side's insurance company?", False),
    ("opposingParty", "Do you know the other party's name?", False),
    ("witnesses", "Did anyone else see it happen?", False),
    ("vehicleDamage", "Was there damage to your vehicle or property?", False),
    ("hasLawyer", "Do you already have a lawyer for this?", True),
    ("heardFrom", "How did you hear about us?", False),
    ("name", "May I have your name?", True),
    ("phone", "What's the best number to reach you? On a phone call use get_caller_number and confirm the last four digits.", False),
    ("email", "Would you like to give an email address?", False),
]
_ALSO_ANSWERED_BY = {"otherPartyInsurer": ("otherPartyInsured",), "injuryAreas": ("injuries",)}


def next_question(state: LawFirmState) -> dict[str, Any]:
    """What to ask next and what is still missing, from what is on the record. The source of truth for intake order."""

    def answered(key: str, required: bool) -> bool:
        if key == "name":
            return has_full_name(state.intake.get("name"))
        if any(state.intake.get(k) not in (None, "", []) for k in (key, *_ALSO_ANSWERED_BY.get(key, ()))):
            return True
        return not required and key in state.declined

    left = [(k, q, r) for k, q, r in QUESTIONS if not answered(k, r)]
    need = missing_fields(state)
    first = left[0][1] if left else None
    if left and left[0][0] == "name" and state.intake.get("name"):
        first = "And your last name?"
    out: dict[str, Any] = {"next": first, "stillNeeded": need}
    if left:
        out["nextIsRequired"] = left[0][2]
        out["questionsLeft"] = len(left)
    else:
        out["message"] = "Intake complete: move on to the conflict check." if not need else "Required details are still missing: " + ", ".join(need)
    return out


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
