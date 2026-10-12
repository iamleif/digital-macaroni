"""
One call at Aspen Grove Dental: the appointment book (four operatories in 10-minute steps, as a practice
system shows it), the patient record, the insurance check, any emergency triage, bookings and messages.
The book is generated relative to the session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import hashlib
import random
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from ..types import add_days, date_in, date_label, weekday
from .store import FILL, OPS, TIME_ZONE, op, ops_for, provider, visit_type

STEP = 10
LUNCH = (12 * 60, 13 * 60)


@dataclass
class Appt:
    id: str
    op: str
    date: str
    start: int  # minutes after midnight
    minutes: int
    patient: str
    procedures: str
    existing: bool
    type_id: Optional[str] = None
    status: Literal["booked", "cancelled"] = "booked"
    phone4: Optional[str] = None
    changes: int = 0
    # As the book shows them: confirmed by the patient, a medical alert on the chart, the dentist's exam during a cleaning.
    # Unconfirmed, left message or confirmed, as the book shows reminders working through the week.
    confirmed: str = "unconfirmed"
    alert: bool = False
    exam: bool = False


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
class DentalState:
    seed: str
    today: str
    earliest_today: int
    book: list[Appt] = field(default_factory=list)
    patient: dict[str, Any] = field(default_factory=dict)
    # The existing patient, once found by name and date of birth.
    found: Optional[dict[str, Any]] = None
    lookups: int = 0
    insurance: Optional[dict[str, Any]] = None
    triage: Optional[dict[str, Any]] = None
    # Questions the caller declined or couldn't answer, and optional ones already asked once: never asked again.
    skipped: list[str] = field(default_factory=list)
    asked: list[str] = field(default_factory=list)
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    messages: list[Message] = field(default_factory=list)
    # The short-notice list: patients who want an earlier time if one opens.
    asap: list[dict[str, Any]] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    opened: bool = False


def hours_of(day: str) -> Optional[tuple[int, int]]:
    """Open and close in minutes; None when closed. Friday closes at 2 PM."""
    wd = weekday(day)
    if wd in (0, 6):
        return None
    return (8 * 60, 14 * 60) if wd == 5 else (8 * 60, 17 * 60)


def has_lunch(day: str) -> bool:
    return weekday(day) != 5


HORIZON_DAYS = 14  # today + 0..13


def horizon_end(today: str) -> str:
    return add_days(today, HORIZON_DAYS - 1)


def bookable_days(state: DentalState) -> list[str]:
    """Every open day in the next 14 calendar days, today included."""
    return [d for d in (add_days(state.today, i) for i in range(HORIZON_DAYS)) if hours_of(d)]


def clock(m: int) -> str:
    h, mm = divmod(m, 60)
    return f"{(h + 11) % 12 + 1}:{mm:02d} {'AM' if h < 12 else 'PM'}".replace(":00 ", " ")


def slot_id(day: str, start: int, oid: str) -> str:
    return f"{day}T{start // 60:02d}{start % 60:02d}@{oid}"


def parse_slot(sid: str) -> Optional[tuple[str, int, str]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})@(op\d)", sid)
    return (m.group(1), int(m.group(2)) * 60 + int(m.group(3)), m.group(4)) if m else None


def free(state: DentalState, oid: str, day: str, start: int, minutes: int, ignore: Optional[str] = None) -> bool:
    hrs = hours_of(day)
    if not hrs or start < hrs[0] or start + minutes > hrs[1]:
        return False
    if has_lunch(day) and start < LUNCH[1] and LUNCH[0] < start + minutes:
        return False
    return not any(a.op == oid and a.date == day and a.status == "booked" and a.id != ignore and a.start < start + minutes and start < a.start + a.minutes for a in state.book)


def open_slots(state: DentalState, type_id: str, day: str, prefer: Optional[str] = None, ignore: Optional[str] = None) -> list[str]:
    t = visit_type(type_id)
    hrs = hours_of(day)
    if not hrs or day not in bookable_days(state):
        return []
    ops = ops_for(t["with"])
    if prefer in ops:
        ops = [prefer] + [o for o in ops if o != prefer]
    out = []
    if type_id == "emergency":
        for o, s in HOLDS:
            if s + HOLD_MIN <= hrs[1] and not (day == state.today and s < state.earliest_today) and free(state, o, day, s, t["minutes"], ignore):
                out.append(slot_id(day, s, o))
        return out
    for s in range(hrs[0], hrs[1], 30):
        if day == state.today and s < state.earliest_today:
            continue
        o = next((o for o in ops if free(state, o, day, s, t["minutes"], ignore) and not in_hold(o, day, s, t["minutes"])), None)
        if o:
            out.append(slot_id(day, s, o))
    return out


def describe_slot(sid: str) -> dict[str, str]:
    day, start, oid = parse_slot(sid)  # type: ignore[misc]
    return {"slotId": sid, "date": day, "day": date_label(day), "time": clock(start), "with": provider(op(oid)["provider"])["name"]}


# Same-day emergency holds, late morning and early afternoon: (operatory, start). Kept open for pain calls.
HOLDS = (("op1", 10 * 60 + 30), ("op2", 14 * 60))
HOLD_MIN = 30


def in_hold(oid: str, day: str, start: int, minutes: int) -> bool:
    hrs = hours_of(day)
    return any(o == oid and h + HOLD_MIN <= hrs[1] and start < h + HOLD_MIN and h < start + minutes for o, h in HOLDS) if hrs else False


def _rng(*parts: object) -> random.Random:
    """Deterministic per date and chair, never per call: a given day always looks the same."""
    return random.Random(int(hashlib.sha256(":".join(map(str, parts)).encode()).hexdigest()[:12], 16))


# How full each weekday runs (Sunday=0): Mondays and Fridays are busy, Wednesday is light.
FULLNESS = {1: 0.88, 2: 0.72, 3: 0.5, 4: 0.76, 5: 0.9}


def nearly_full(day: str) -> bool:
    """About one day in a fortnight, a Tuesday to Thursday, is nearly booked solid. Decided by the date alone."""
    d = date.fromisoformat(day)
    iso = d.isocalendar()
    rng = _rng("full-week", iso.year, iso.week)
    return rng.random() < 0.55 and weekday(day) == rng.choice((2, 3, 4))


def _fill_day(state: DentalState, day: str, n: int) -> int:
    hrs = hours_of(day)
    full = nearly_full(day)
    base = 0.97 if full else FULLNESS[weekday(day)] + _rng("jitter", day).uniform(-0.08, 0.08)
    for o in OPS:
        rng = _rng("chair", day, o["id"])
        hyg = provider(o["provider"])["role"] == "Hygienist"
        pool = [tuple(x) for x in (FILL["hygiene"] if hyg else FILL["dentist"])]
        fullness = min(0.98, base + rng.uniform(-0.1, 0.06))
        t = hrs[0] + rng.choice((0, 0, 10, 30))  # type: ignore[index]
        while t < hrs[1]:  # type: ignore[index]
            if has_lunch(day) and LUNCH[0] <= t < LUNCH[1]:
                t = LUNCH[1]
                continue
            if rng.random() > fullness:  # an open stretch
                t += rng.choice((30, 30, 60, 90))
                continue
            fits = [(p, m) for p, m in pool if t + m <= hrs[1] and not (has_lunch(day) and t < LUNCH[1] and LUNCH[0] < t + m) and not in_hold(o["id"], day, t, m)]  # type: ignore[index]
            if not fits:
                t += STEP
                continue
            procs, mins = rng.choice(fits)
            state.book.append(Appt(f"existing-{n}", o["id"], day, t, mins, rng.choice(FILL["names"]), procs, True, phone4=f"{rng.randrange(1000, 10000)}",
                                   confirmed=rng.choices(["confirmed", "left_message", "unconfirmed"], (6, 1, 2))[0], alert=rng.random() < 0.11, exam=hyg and "Ex" in procs))
            n += 1
            t += mins
    return n


def _has_room(state: DentalState, day: str) -> bool:
    keep, state.earliest_today = state.earliest_today, 0
    try:
        return bool(open_slots(state, "cleaning", day)) and bool(open_slots(state, "new_patient", day))
    finally:
        state.earliest_today = keep


def create_state(now: datetime) -> DentalState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = DentalState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today=hour * 60 + minute + 60)
    n = 0
    for day in bookable_days(state):
        n = _fill_day(state, day, n)
        if nearly_full(day):
            continue
        # Every ordinary day keeps open cleaning and new-patient time: thin out the hygiene chairs until it does.
        hyg_ops = set(ops_for("hygiene"))
        rng = _rng("thin", day)
        while not _has_room(state, day):
            mine = [a for a in state.book if a.date == day and a.op in hyg_ops]
            if not mine:
                break
            state.book.remove(rng.choice(mine))
    return state


def active(state: DentalState) -> list[Appt]:
    return [a for a in state.book if not a.existing and a.status == "booked"]
