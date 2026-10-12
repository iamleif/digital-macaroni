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

from .. import schedule as sched
from ..types import add_days, date_in, date_label, weekday
from .store import (
    DECK,
    FORCED,
    OPEN_WEIGHTS,
    SHIFTS,
    TITLES,
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


def existing_blocks(day: str, min_hour: int = 0) -> list[tuple[str, int, str]]:
    """(attorney id, hour, title) already busy on a day, including time off shift ("Out", "Lunch", "Admin"). The three
    attorneys work different shifts (a half day, a morning in court); the day keeps two to four open consultation hours
    at different times, always one with the senior partner; every other hour they work is taken. Seeded by the date,
    attorney and firm, never by the call time."""
    lo, hi = min(HOURS) * 60, (max(HOURS) + 1) * 60
    segs = {t["id"]: sched.shift_of(SHIFTS, t["id"], day, lo, hi) for t in ATTORNEYS}

    idx = sched.business_index(day, CLOSED_WEEKDAYS)
    k = sched.cap_budget(sched.open_budget("af", day, OPEN_WEIGHTS), sched.cells_working(segs, HOURS), 1)

    def make(min_start: int) -> list[sched.Hole]:
        def starts(who: str, minutes: int, holes: list[sched.Hole]) -> list[int]:
            free = sched.subtract(segs[who], [h.span() for h in holes if h.who == who])
            return sched.hole_starts(free, 60, 60, min_start, allowed=lambda s: s // 60 in HOURS)

        return sched.choose_holes(
            sched.rng("af", "holes", day), k=k, deck=[((w,), 60) for w in DECK], idx=idx, starts=starts, span=(lo, hi),
            forced=[((w,), 60) for w, period, phase in FORCED if idx % int(period) == int(phase)], must=[((SENIOR_PARTNER,), 60)],
        )

    holes = sched.settle(make, min_hour * 60, min(k, 2), lambda hs: [h.start for h in hs])
    taken = {(h.who, h.start // 60) for h in holes}
    out: list[tuple[str, int, str]] = []
    for t in ATTORNEYS:
        aid = t["id"]
        r = sched.rng("af", "fill", day, aid)
        off = sched.off_blocks(segs[aid], lo, hi, seed=f"af{day}{aid}")
        for h in HOURS:
            if (aid, h) in taken:
                continue
            if any(a <= h * 60 and h * 60 + 60 <= e for a, e in segs[aid]):
                out.append((aid, h, r.choice(TITLES)))
            else:
                out.append((aid, h, next((x[2] for x in off if x[0] < (h + 1) * 60 and h * 60 < x[0] + x[1]), "Out")))
    return out


def create_state(now: datetime) -> LawFirmState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = LawFirmState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (3 if minute > 0 else 2))
    n = 0
    for day in bookable_days(state):
        for aid, h, title in existing_blocks(day, state.earliest_today_hour if day == state.today else 0):
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
    ("accidentType", "What kind of accident was it?", True),
    ("accidentDate", "When did it happen?", True),
    ("accidentState", "What city and state did it happen in?", True),
    ("injuryAreas", "What part of your body was hurt?", False),
    ("missedWork", "Has it kept you from working?", False),
    ("symptoms", "Any passing out, tingling, numbness, dizziness or headaches?", False),
    ("treatment", "What treatment have you had so far?", True),
    ("treatingProvider", "Who is treating you?", False),
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
