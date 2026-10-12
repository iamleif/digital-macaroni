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


QUOTE_DONE = "Collected: say a licensed agent will go through the numbers, check there are no other drivers or vehicles, then offer a call with one (check_availability for their day)."

# (field, question, mandatory). Order is the agency's order, one question at a time.
CLAIM_QUESTIONS: list[tuple[str, str, bool]] = [
    ("kind", "What happened?", True),
    ("date", "When did it happen?", True),
    ("location", "Where did it happen?", True),
    ("injuries", "Was anyone hurt?", True),
    ("policeReport", "Was a police report made?", False),
    ("otherParty", "Was another driver or party involved, and do you know their insurer?", False),
    ("photos", "Do you have any photos?", False),
]


def claim_next(claim: dict[str, Any]) -> tuple[Optional[str], bool]:
    """The next unanswered claim question and whether it is optional; (None, False) when all are answered."""
    for key, question, mandatory in CLAIM_QUESTIONS:
        if key not in claim:
            return question, not mandatory
    return None, False


def _missing_driver_detail(a: dict[str, Any]) -> Optional[str]:
    for d in a.get("drivers") or []:
        who = d.get("name") or "the driver"
        if not d.get("dateOfBirth"):
            return f"What is {who}'s date of birth?"
        if d.get("yearsLicensed") is None:
            return f"How many years has {who} been licensed?"
    return None


def _quote_steps(a: dict[str, Any]) -> list[tuple[bool, str, bool]]:
    """(already answered, question, mandatory), in the agency's order, for what the caller wants quoted."""
    lines = a.get("quoteLines", [])
    skipped = set(a.get("skipped", []))
    steps: list[tuple[bool, str, bool]] = [(bool(a.get("name")), "May I have your name?", True)]
    if "auto" not in lines:
        steps.append((bool(a.get("dateOfBirth")), "What is your date of birth?", True))
    for line in lines:
        if line == "auto":
            steps.append((bool(a.get("drivers")), "Who will be driving? Please give me each driver's name.", True))
            steps.append((_missing_driver_detail(a) is None, _missing_driver_detail(a) or "", True))
            steps.append((all(d.get("incidents") for d in a.get("drivers") or []) and bool(a.get("drivers")) or "incidents" in skipped, "Any tickets or accidents in the last five years, for any driver?", False))
            steps.append((bool(a.get("vehicles")), "What vehicles are we insuring? Year, make and model of each.", True))
            steps.append((bool(a.get("address")), "What address are the vehicles kept at?", True))
        elif line == "home":
            steps.append((bool(a.get("address")), "What is the home's address?", True))
            steps.append((bool(a.get("yearBuilt")), "What year was the home built?", True))
            steps.append((bool(a.get("squareFeet")), "Roughly how many square feet is it?", True))
        elif line == "renters":
            steps.append((bool(a.get("address")), "What is the rental address?", True))
            steps.append((bool(a.get("personalProperty")), "Roughly what are your belongings worth?", True))
    steps += [
        (bool(a.get("currentCarrier")) or "currentCarrier" in skipped, "Who insures you now?", False),
        (bool(a.get("renewalDate")) or "renewalDate" in skipped, "When does that policy renew?", False),
        (bool(a.get("coverageWanted")) or "coverageWanted" in skipped, "Are there any extras you want on it?", False),
    ]
    return steps


def quote_next(state: InsuranceState) -> tuple[Optional[str], bool]:
    """The next unanswered quote question and whether it is optional; (None, False) when everything is collected."""
    a = state.account
    if not a.get("quoteLines"):
        return "What would you like quoted: auto, home, renters, or a mix?", False
    for done, question, mandatory in _quote_steps(a):
        if not done:
            return question, not mandatory
    return None, False
