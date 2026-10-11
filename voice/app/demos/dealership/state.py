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


def create_state(now: datetime) -> DealershipState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = DealershipState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        di = datetime.fromisoformat(day).toordinal() - today_ord
        for hi, h in enumerate(DRIVE_HOURS):
            for si, s in enumerate(SALES):
                if (di * 5 + hi * 3 + si * 7) % 3 == 0:
                    state.busy.append(Busy(s["id"], day, h, f"existing-{n}", True))
                    n += 1
        for hi, h in enumerate(SERVICE_HOURS):
            for b in range((di + hi) % 4 + 1 if hi % 3 else 4):
                state.busy.append(Busy("bay", day, h, f"existing-{n}", True))
                n += 1
    return state


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
