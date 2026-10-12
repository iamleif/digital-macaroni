"""
One call at Woodward Motor Co.: the lead (what they want, budget, payment, trade-in), the cars searched
and the one being discussed, the sales consultants' test-drive calendar, the service bays, bookings
and messages. Availability is generated relative to the session's own date.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from .. import schedule as sched
from ..types import add_days, date_in, date_label, weekday
from .store import BAY_DECK, BAY_SHIFTS, BAYS, CLOSED_WEEKDAYS, DAYS_AHEAD, DECK, DRIVE_HOURS, DRIVE_TITLES, SALES, SERVICE_HOURS, SERVICE_TITLES, SHIFTS, TIME_ZONE, car, salesperson, specialist

Purpose = Literal["test_drive", "service"]


@dataclass
class Busy:
    who: str  # a salesperson id, or "bay"
    date: str
    hour: int
    ref: str
    existing: bool
    title: str = ""


@dataclass
class Appointment:
    id: str
    purpose: str
    slot_id: str
    who: str
    stock: Optional[str]
    service_id: Optional[str]
    vehicle: str
    name: str
    status: Literal["booked", "cancelled"]
    updated_at: str
    changes: int = 0


@dataclass
class Message:
    id: str
    name: str
    callback_number: str
    summary: str
    preferred_time: Optional[str]
    for_team: str
    created_at: str


@dataclass
class DealershipState:
    seed: str
    today: str
    earliest_today_hour: int
    busy: list[Busy] = field(default_factory=list)
    lead: dict[str, Any] = field(default_factory=dict)
    customer: Optional[dict[str, Any]] = None
    search: Optional[dict[str, Any]] = None
    matches: list[str] = field(default_factory=list)
    read: list[str] = field(default_factory=list)
    focus: Optional[str] = None
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    appointments: list[Appointment] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    opened: bool = False


def slot_id(day: str, hour: int, who: str) -> str:
    return f"{day}T{hour:02d}@{who}"


def parse_slot(sid: str) -> Optional[tuple[str, int, str]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})@([a-z]+)", sid)
    return (m.group(1), int(m.group(2)), m.group(3)) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def bookable_days(state: DealershipState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in CLOSED_WEEKDAYS]


def is_free(state: DealershipState, who: str, day: str, hour: int, ignore_ref: Optional[str] = None) -> bool:
    taken = [b for b in state.busy if b.who == who and b.date == day and b.hour == hour and b.ref != ignore_ref]
    return len(taken) < (BAYS if who == "bay" else 1)


def consultants_for(state: DealershipState, stock: Optional[str]) -> list[str]:
    """Who shows this car: the specialist for trucks and EVs first, then whoever the caller already knows."""
    order = [s["id"] for s in SALES]
    first = specialist(car(stock)) if stock else None
    if state.customer:
        first = first or state.customer["salesperson"]
    return ([first] if first else []) + [x for x in order if x != first]


def open_slots(state: DealershipState, purpose: str, day: str, stock: Optional[str] = None, ignore_ref: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    out = []
    if purpose == "service":
        # Saturday service closes at 2 PM.
        hours = [h for h in SERVICE_HOURS if weekday(day) != 6 or h < 14]
        for h in hours:
            if (day != state.today or h >= state.earliest_today_hour) and is_free(state, "bay", day, h, ignore_ref):
                out.append(slot_id(day, h, "bay"))
        return out
    for h in DRIVE_HOURS:
        if day == state.today and h < state.earliest_today_hour:
            continue
        who = next((s for s in consultants_for(state, stock) if is_free(state, s, day, h, ignore_ref)), None)
        if who:
            out.append(slot_id(day, h, who))
    return out


def describe_slot(sid: str) -> dict[str, str]:
    day, hour, who = parse_slot(sid)  # type: ignore[misc]
    return {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour), **({"with": salesperson(who)["name"]} if who != "bay" else {})}


def full_name(name: Optional[str]) -> bool:
    """A name worth saving for a booking or lead: a first and a last name."""
    return len((name or "").split()) >= 2


def create_state(now: datetime) -> DealershipState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = DealershipState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    state.busy = existing_busy(bookable_days(state), today, state.earliest_today_hour)
    return state


def _split(k: int, idx: int) -> tuple[int, int]:
    """Of k openings, how many are test-drive hours and how many service hours: both kinds on most days, the odd
    one alternating by date."""
    if k == 1:
        return (1, 0) if idx % 2 == 0 else (0, 1)
    td = k // 2 + (k % 2 if idx % 2 == 0 else 0)
    return td, k - td


def existing_busy(days: list[str], today: Optional[str] = None, earliest_hour: int = 0) -> list[Busy]:
    """Appointments already in the diary. Each date is generated from the date alone (never the call's time), so a
    given day looks the same on every call while different days and weeks differ. The consultants and the service
    bays each work their own shifts (a late start, a half day, a day off, lunch somewhere else); the day keeps two to
    four open hours, some test drive and some service, at different times; everything else they work is taken."""
    out: list[Busy] = []
    n = 0
    for day in days:
        wd = weekday(day)
        idx = sched.business_index(day, CLOSED_WEEKDAYS)
        lo, hi = min(DRIVE_HOURS + SERVICE_HOURS) * 60, (max(DRIVE_HOURS) + 1) * 60
        floor = earliest_hour * 60 if day == today else 0
        # Sales: one resource per consultant.
        segs = {s["id"]: sched.shift_of(SHIFTS, s["id"], day, lo, hi) for s in SALES}
        # Service: one resource per bay, working the hours of its technician.
        service_hours = [h for h in SERVICE_HOURS if wd != 6 or h < 14]
        bays = {f"bay{i + 1}": sched.segments(spec, lo, hi) for i, spec in enumerate(BAY_SHIFTS[str(wd)][:BAYS])}
        k = sched.open_budget("woodward", day, sched.OPEN_WEIGHTS_BIG)
        td_n, svc_n = _split(k, idx)

        def make(min_start: int, segs=segs, bays=bays, service_hours=service_hours, td_n=td_n, svc_n=svc_n) -> tuple[list[sched.Hole], list[sched.Hole]]:
            def td_starts(who: str, minutes: int, holes: list[sched.Hole]) -> list[int]:
                free = sched.subtract(segs[who], [h.span() for h in holes if h.who == who])
                return sched.hole_starts(free, 60, 60, min_start, allowed=lambda s: s // 60 in DRIVE_HOURS)

            def bay_starts(who: str, minutes: int, holes: list[sched.Hole]) -> list[int]:
                free = sched.subtract(bays[who], [h.span() for h in holes if h.who == who])
                return sched.hole_starts(free, 60, 60, min_start, allowed=lambda s: s // 60 in service_hours)

            td = sched.choose_holes(sched.rng("woodward", "td", day), k=td_n, deck=[((w,), 60) for w in DECK], idx=idx, starts=td_starts, span=(lo, hi))
            sv = sched.choose_holes(sched.rng("woodward", "svc", day), k=svc_n, deck=[((b,), 60) for b in BAY_DECK], idx=idx, starts=bay_starts, span=(lo, hi))
            return td, sv

        td, sv = sched.settle(make, floor, min(k, 2), lambda pair: [h.start for h in pair[0] + pair[1]])
        # A service hour sometimes has two bays free.
        r2 = sched.rng("woodward", "extra-bay", day)
        for h in list(sv):
            if r2.random() < 0.5:
                other = [b for b in bays if b != h.who and any(a <= h.start and h.start + 60 <= e for a, e in bays[b]) and not any(x.who == b and x.start == h.start for x in sv)]
                if other:
                    sv.append(sched.Hole(r2.choice(other), h.start, 60))
        # A test-drive hour sometimes has a second consultant free too.
        for h in list(td):
            if r2.random() < 0.4:
                other = [s["id"] for s in SALES if s["id"] != h.who and any(a <= h.start and h.start + 60 <= e for a, e in segs[s["id"]]) and not any(x.who == s["id"] and x.start == h.start for x in td)]
                if other:
                    td.append(sched.Hole(r2.choice(other), h.start, 60))
        td_taken = {(h.who, h.start // 60) for h in td}
        sv_taken = {(h.who, h.start // 60) for h in sv}
        for s in SALES:
            r = sched.rng("woodward", "sales", day, s["id"])
            off = sched.off_blocks(segs[s["id"]], lo, hi, seed=f"woodward{day}{s['id']}")
            for h in DRIVE_HOURS:
                if (s["id"], h) in td_taken:
                    continue
                if any(a <= h * 60 and h * 60 + 60 <= e for a, e in segs[s["id"]]):
                    out.append(Busy(s["id"], day, h, f"existing-{n}", True, r.choice(DRIVE_TITLES)))
                else:
                    out.append(Busy(s["id"], day, h, f"existing-{n}", True, next((x[2] for x in off if x[0] < (h + 1) * 60 and h * 60 < x[0] + x[1]), "Out")))
                n += 1
        for h in service_hours:
            r = sched.rng("woodward", "bays", day, h)
            for bay, bsegs in bays.items():
                if (bay, h) in sv_taken:
                    continue
                if any(a <= h * 60 and h * 60 + 60 <= e for a, e in bsegs):
                    out.append(Busy("bay", day, h, f"existing-{n}", True, r.choice(SERVICE_TITLES)))
                else:
                    out.append(Busy("bay", day, h, f"existing-{n}", True, "Tech out"))
                n += 1
    return out


def active(state: DealershipState) -> list[Appointment]:
    return [a for a in state.appointments if a.status == "booked"]


def money(n: int) -> str:
    return f"${n:,}"


def miles(n: int) -> str:
    return f"{n:,} miles" if n else "new"


def spoken(c: dict[str, Any]) -> dict[str, Any]:
    """A car as the agent may describe it: listing facts only."""
    return {
        "stockNumber": c["stock"],
        "car": f"{c['year']} {c['make']} {c['model']}" + (f" {c['trim']}" if c["trim"] else ""),
        "price": money(c["price"]),
        "miles": miles(c["miles"]),
        "color": c["color"],
        "drivetrain": c["drivetrain"],
        **({"fuel": c["fuel"]} if c["fuel"] not in ("Gasoline", None) else {}),
        **({"certifiedPreOwned": True} if c["cpo"] else {}),
        **({"new": True} if not c["used"] else {}),
    }


def confirm_text(a: Appointment) -> str:
    s = describe_slot(a.slot_id)
    what = f"Test drive of the {a.vehicle}" if a.purpose == "test_drive" else f"Service for the {a.vehicle}"
    return f"{what} on {s['day']} at {s['time']}" + (f" with {s['with']}" if s.get("with") else "") + f". Reference {a.id}."
