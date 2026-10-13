"""
One call at Aspen Grove Dental: the appointment book (four operatories in 10-minute steps, as a practice
system shows it), the patient record, the insurance check, any emergency triage, bookings and messages.
The book is generated relative to the session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
import random
from datetime import datetime
from typing import Any, Literal, Optional

from .. import schedule as sched
from ..types import add_days, date_in, date_label, weekday
from .store import FILL, HOLES, OPS, SHIFTS, TIME_ZONE, TYPES, op, ops_for, provider, visit_type

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
    # Time off shift (a day off, an early finish, admin), shown in the book as a block so each chair has its real shape.
    off: bool = False


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
    # No insurance: the self-pay options were given, and the caller's answer on the savings plan ("text" the sign-up link, or "declined").
    self_pay: dict[str, Any] = field(default_factory=dict)


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
    return sched.rng("dental", *parts)


def _cards(rows: list[list[Any]]) -> list[sched.Card]:
    return [(tuple(ops_for(r[0])), int(r[1])) for r in rows]


def _fill_day(state: DentalState, day: str, n: int) -> int:
    """The day's book. Each chair works its provider's shift (half days, days off, a late start); the day keeps two to
    five openings in different chairs at different times; every other working minute already has a patient in it."""
    hrs = hours_of(day)
    lunch = [LUNCH] if has_lunch(day) else []
    segs = {o["id"]: sched.shift_of(SHIFTS, o["provider"], day, hrs[0], hrs[1]) for o in OPS}  # type: ignore[index]
    work = {oid: sched.subtract(s, lunch) for oid, s in segs.items()}
    holds = {o["id"]: [(h, h + HOLD_MIN) for hop, h in HOLDS if hop == o["id"] and h + HOLD_MIN <= hrs[1]] for o in OPS}  # type: ignore[index]
    floor = -(-state.earliest_today // 30) * 30 if day == state.today else 0
    low = {o["id"]: min(t["minutes"] for t in TYPES if t["with"] == ("hygiene" if provider(o["provider"])["role"] == "Hygienist" else "dentist")) for o in OPS}

    k = sched.open_budget("dental", day, sched.OPEN_WEIGHTS_MANY)
    idx = sched.business_index(day, {0, 6})
    forced = [c for c, f in zip(_cards(HOLES["forced"]), HOLES["forced"]) if idx % int(f[2]) == int(f[3])]

    def make(min_start: int) -> list[sched.Hole]:
        def starts(who: str, minutes: int, holes: list[sched.Hole]) -> list[int]:
            free = sched.subtract(work[who], holds[who] + [h.span() for h in holes if h.who == who])
            return sched.hole_starts(free, minutes, 30, min_start, min_side=20)

        return sched.choose_holes(_rng("holes", day), k=k, deck=_cards(HOLES["deck"]), idx=idx, starts=starts, span=hrs, forced=forced)  # type: ignore[arg-type]

    holes = sched.settle(make, floor, min(k, 2), lambda hs: [h.start for h in hs])
    for o in OPS:
        oid = o["id"]
        rng = _rng("chair", day, oid)
        hyg = provider(o["provider"])["role"] == "Hygienist"
        for a, m, title in sched.off_blocks(segs[oid], hrs[0], hrs[1], cover=lunch, seed=f"dental{day}{oid}"):  # type: ignore[index]
            state.book.append(Appt(f"existing-{n}", oid, day, a, m, title, "Not scheduled", True, confirmed="confirmed", off=True))
            n += 1
        free = sched.subtract(work[oid], holds[oid] + [h.span() for h in holes if h.who == oid])
        pool = [tuple(x) for x in (FILL["hygiene"] if hyg else FILL["dentist"])]
        for t, mins, procs in sched.fill(rng, free, pool, STEP, low[oid]):
            state.book.append(Appt(f"existing-{n}", oid, day, t, mins, rng.choice(FILL["names"]), procs, True, phone4=f"{rng.randrange(1000, 10000)}",
                                   confirmed=rng.choices(["confirmed", "left_message", "unconfirmed"], (6, 1, 2))[0], alert=rng.random() < 0.11, exam=hyg and "Ex" in procs))
            n += 1
    return n


def create_state(now: datetime) -> DentalState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = DentalState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today=hour * 60 + minute + 60)
    n = 0
    for day in bookable_days(state):
        n = _fill_day(state, day, n)
    return state


def active(state: DentalState) -> list[Appt]:
    return [a for a in state.book if not a.existing and a.status == "booked"]
