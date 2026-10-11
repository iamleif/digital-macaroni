"""
One call at Bluebird Insurance: the account record (a new quote or an existing customer), the policy
being read, a claim notice, service requests, the licensed agents' calendar, booked calls and messages.
Availability comes from a calendar generated relative to the session's own date.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..types import add_days, date_in, date_label, weekday
from .store import CALL_HOURS, CHANGE_LABEL, CLAIM_LABEL, CLOSED_WEEKDAYS, COVERAGE_LABEL, DAYS_AHEAD, LICENSED, LINE_LABEL, TIME_ZONE, person

Line = Literal[tuple(LINE_LABEL)]  # type: ignore[valid-type]
Coverage = Literal[tuple(COVERAGE_LABEL)]  # type: ignore[valid-type]
ChangeType = Literal[tuple(CHANGE_LABEL)]  # type: ignore[valid-type]
ClaimType = Literal[tuple(CLAIM_LABEL)]  # type: ignore[valid-type]
Tri = Literal["yes", "no", "unknown"]


@dataclass
class Booked:
    staff_id: str
    date: str
    hour: int
    ref: str
    existing: bool


@dataclass
class AgentCall:
    id: str
    slot_id: str
    staff_id: str
    topic: str
    name: str
    status: Literal["booked", "cancelled"]
    updated_at: str
    changes: int = 0


@dataclass
class Request:
    id: str
    policy: str
    kind: str
    details: str
    created_at: str


@dataclass
class Message:
    id: str
    name: str
    callback_number: str
    summary: str
    preferred_time: Optional[str]
    created_at: str


@dataclass
class InsuranceState:
    seed: str
    today: str
    earliest_today_hour: int
    calendar: list[Booked] = field(default_factory=list)
    # What the caller has told us: their details and, for a quote, what a licensed agent needs.
    account: dict[str, Any] = field(default_factory=dict)
    # The existing customer, once found by name and date of birth or a policy number.
    customer: Optional[dict[str, Any]] = None
    lookups: int = 0
    # The policy being read out.
    policy: Optional[str] = None
    claim: Optional[dict[str, Any]] = None
    requests: list[Request] = field(default_factory=list)
    id_cards: list[str] = field(default_factory=list)
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    calls: list[AgentCall] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    opened: bool = False


def slot_id(day: str, hour: int) -> str:
    return f"{day}T{hour:02d}"


def parse_slot(sid: str) -> Optional[tuple[str, int]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})", sid)
    return (m.group(1), int(m.group(2))) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def bookable_days(state: InsuranceState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in CLOSED_WEEKDAYS]


def free_agent(state: InsuranceState, day: str, hour: int, ignore_ref: Optional[str] = None) -> Optional[str]:
    for sid in LICENSED:
        if not any(b.staff_id == sid and b.date == day and b.hour == hour and b.ref != ignore_ref for b in state.calendar):
            return sid
    return None


def open_slots(state: InsuranceState, day: str, ignore_ref: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    return [slot_id(day, h) for h in CALL_HOURS if (day != state.today or h >= state.earliest_today_hour) and free_agent(state, day, h, ignore_ref)]


def describe_slot(state: InsuranceState, sid: str, staff_id: Optional[str] = None, ignore_ref: Optional[str] = None) -> dict[str, str]:
    day, hour = parse_slot(sid)  # type: ignore[misc]
    out = {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour)}
    who = staff_id or free_agent(state, day, hour, ignore_ref)
    if who:
        out["agent"] = person(who)["name"]
    return out


def create_state(now: datetime) -> InsuranceState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = InsuranceState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        di = datetime.fromisoformat(day).toordinal() - today_ord
        for hi, h in enumerate(CALL_HOURS):
            for ai, sid in enumerate(LICENSED):
                if (di * 5 + hi * 3 + ai * 2) % 3 == 0:
                    state.calendar.append(Booked(sid, day, h, f"existing-{n}", True))
                    n += 1
    return state


def active(state: InsuranceState) -> list[AgentCall]:
    return [c for c in state.calls if c.status == "booked"]


def quoting(state: InsuranceState) -> bool:
    return bool(state.account.get("quoteLines"))


QUOTE_NEEDS: dict[str, list[tuple[str, str]]] = {
    "auto": [("drivers", "each driver's name, date of birth and years licensed"), ("vehicles", "each vehicle's year, make and model"), ("address", "the garaging address")],
    "home": [("address", "the home's address"), ("yearBuilt", "the year the home was built"), ("squareFeet", "the home's square footage")],
    "renters": [("address", "the rental address"), ("personalProperty", "roughly what their belongings are worth")],
}


def quote_missing(state: InsuranceState) -> list[str]:
    a = state.account
    need: list[str] = [] if a.get("name") else ["the caller's name"]
    if not a.get("dateOfBirth") and not a.get("drivers"):
        need.append("the caller's date of birth")
    for line in a.get("quoteLines", []):
        for key, label in QUOTE_NEEDS[line]:
            if not a.get(key) and label not in need:
                need.append(label)
    return need
