"""
One call at Woodward Motor Co.: the lead (what they want, budget, payment, trade-in), the cars searched
and the one being discussed, the sales consultants' test-drive calendar, the service bays, bookings
and messages. Availability is generated relative to the session's own date.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..types import add_days, date_in, date_label, weekday
from .store import BAYS, CLOSED_WEEKDAYS, DAYS_AHEAD, DRIVE_HOURS, SALES, SERVICE_HOURS, TIME_ZONE, car, salesperson, specialist

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


def roll(*parts: Any) -> float:
    """A repeatable number in [0, 1) from the parts: the same date and staff always give the same answer."""
    h = hashlib.sha256("|".join(str(p) for p in ("woodward", *parts)).encode()).digest()
    return int.from_bytes(h[:6], "big") / 2**48


# How busy each weekday is (0 is Sunday): weekends and Fridays are test-drive days, midweek is quiet.
FULLNESS = {1: 0.14, 2: 0.2, 3: 0.12, 4: 0.26, 5: 0.42, 6: 0.58}
DRIVE_TITLES = ("Test drive", "Trade-in appraisal", "Delivery handover", "Finance meeting", "Walk-around", "Customer visit")
SERVICE_TITLES = ("Oil change", "Brake service", "Tire rotation", "Diagnostic", "Recall repair", "Inspection")


def nearly_full(day: str) -> bool:
    """One day in every fourteen is nearly booked solid, so any fortnight has exactly one."""
    return datetime.fromisoformat(day).toordinal() % 14 == 0


def create_state(now: datetime) -> DealershipState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = DealershipState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    state.busy = existing_busy(bookable_days(state))
    return state


def existing_busy(days: list[str]) -> list[Busy]:
    """Appointments already in the diary. Each date is generated from the date alone (never the call's time), so a
    given day looks the same on every call while different days and weeks differ."""
    out: list[Busy] = []
    n = 0
    for day in days:
        full = nearly_full(day)
        wd = weekday(day)
        level = 0.88 if full else min(0.8, FULLNESS.get(wd, 0.2) * (0.5 + 1.1 * roll(day, "level")))
        spare = {h: roll(day, "spare", h) for h in DRIVE_HOURS}
        keep = sorted(DRIVE_HOURS, key=lambda h: spare[h])[: 2 if full else 4]
        for h in DRIVE_HOURS:
            free_one = SALES[int(roll(day, "free", h) * len(SALES))]["id"]
            for s in SALES:
                if h in keep and s["id"] == free_one:
                    continue
                if roll(day, h, s["id"]) < min(0.95, level * (0.4 + 1.2 * roll(day, s["id"], "bias"))):
                    out.append(Busy(s["id"], day, h, f"existing-{n}", True, DRIVE_TITLES[int(roll(day, h, s["id"], "t") * len(DRIVE_TITLES))]))
                    n += 1
        keep_s = sorted(SERVICE_HOURS, key=lambda h: roll(day, "sspare", h))[: 2 if full else 3]
        for h in SERVICE_HOURS:
            top = BAYS - 1
            count = 1 if h in keep_s else min(top, int(roll(day, "bays", h) * (top + 1) * (0.5 + level * 1.4)))
            if full and h not in keep_s:
                count = BAYS
            for b in range(count):
                out.append(Busy("bay", day, h, f"existing-{n}", True, SERVICE_TITLES[int(roll(day, h, b, "t") * len(SERVICE_TITLES))]))
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
