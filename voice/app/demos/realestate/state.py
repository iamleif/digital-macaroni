"""
One call at Juniper Row Realty: the lead record, the listings the caller has heard about, a value
estimate, the agents' calendars, showings and valuations booked, and messages. Availability comes
from a calendar generated relative to the session's own date, so "Saturday" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..types import add_days, date_in, date_label, weekday
from .store import (
    AGENTS,
    AREA_NAME,
    CLOSED_WEEKDAYS,
    DAYS_AHEAD,
    FINANCING_LABEL,
    OTHERWISE_TIER,
    POINTS,
    REQUIRED,
    SELLER_AGENT,
    SELLER_REASON_LABEL,
    SHOWING_HOURS,
    TIERS,
    TIME_ZONE,
    TIMELINE_LABEL,
    TYPE_LABEL,
    INTENT_LABEL,
    VALUATION_HOURS,
    agent,
    agent_for_area,
    listing,
)

AreaId = Literal[tuple(AREA_NAME)]  # type: ignore[valid-type]
Intent = Literal[tuple(INTENT_LABEL)]  # type: ignore[valid-type]
Timeline = Literal[tuple(TIMELINE_LABEL)]  # type: ignore[valid-type]
Financing = Literal[tuple(FINANCING_LABEL)]  # type: ignore[valid-type]
PropertyType = Literal[tuple(TYPE_LABEL)]  # type: ignore[valid-type]
SellerReason = Literal[tuple(SELLER_REASON_LABEL)]  # type: ignore[valid-type]
Purpose = Literal["showing", "valuation"]


@dataclass
class Booked:
    agent_id: str
    date: str
    hour: int
    ref: str
    existing: bool


@dataclass
class Appointment:
    id: str
    purpose: str
    slot_id: str
    agent_id: str
    # A showing is at a listing; a valuation at the caller's own address.
    listing_id: Optional[str]
    address: str
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
    for_agent: Optional[str]
    created_at: str


@dataclass
class RealEstateState:
    seed: str
    today: str
    earliest_today_hour: int
    calendar: list[Booked] = field(default_factory=list)
    lead: dict[str, Any] = field(default_factory=dict)
    # Someone the brokerage already knows, matched on the caller's name.
    contact: Optional[dict[str, Any]] = None
    # The last search: its criteria and every match, best first; `read` are the ones read out.
    search: Optional[dict[str, Any]] = None
    matches: list[str] = field(default_factory=list)
    read: list[str] = field(default_factory=list)
    focus: Optional[str] = None
    # None until estimate_value has run; then the estimate, or why there is none.
    estimate: Optional[dict[str, Any]] = None
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    appointments: list[Appointment] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    opened: bool = False


# ---- Time ----


def slot_id(day: str, hour: int) -> str:
    return f"{day}T{hour:02d}"


def parse_slot(sid: str) -> Optional[tuple[str, int]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})", sid)
    return (m.group(1), int(m.group(2))) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def bookable_days(state: RealEstateState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in CLOSED_WEEKDAYS]


def hours_for(purpose: str) -> tuple[int, ...]:
    return VALUATION_HOURS if purpose == "valuation" else SHOWING_HOURS


def is_free(state: RealEstateState, aid: str, day: str, hour: int, ignore_ref: Optional[str] = None) -> bool:
    return not any(b.agent_id == aid and b.date == day and b.hour == hour and b.ref != ignore_ref for b in state.calendar)


def open_slots(state: RealEstateState, purpose: str, aid: str, day: str, ignore_ref: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    return [slot_id(day, h) for h in hours_for(purpose) if (day != state.today or h >= state.earliest_today_hour) and is_free(state, aid, day, h, ignore_ref)]


def describe_slot(sid: str, aid: str) -> dict[str, str]:
    day, hour = parse_slot(sid)  # type: ignore[misc]
    return {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour), "agent": agent(aid)["name"]}


def create_state(now: datetime) -> RealEstateState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = RealEstateState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        di = datetime.fromisoformat(day).toordinal() - today_ord
        for hi, h in enumerate(sorted(set(SHOWING_HOURS) | set(VALUATION_HOURS))):
            for ai, a in enumerate(AGENTS):
                if (di * 7 + hi * 3 + ai * 5) % 3 == 0:
                    state.calendar.append(Booked(a["id"], day, h, f"existing-{n}", True))
                    n += 1
    return state


# ---- The lead ----


def who_handles(state: RealEstateState, purpose: Optional[str] = None, listing_id: Optional[str] = None) -> str:
    """Sellers and valuations go to the listing specialist; a showing to the agent for that home's area."""
    if purpose == "valuation":
        return SELLER_AGENT
    lid = listing_id or (state.focus if purpose == "showing" else None)
    x = listing(lid) if lid else None
    if x:
        return agent_for_area(x["area"])
    if state.lead.get("intent") == "sell":
        return SELLER_AGENT
    areas = state.lead.get("areas") or []
    if areas:
        return agent_for_area(areas[0])
    if state.contact:
        return state.contact["agent"]
    return agent_for_area(None)


def active(state: RealEstateState) -> list[Appointment]:
    return [a for a in state.appointments if a.status == "booked"]


def missing_fields(state: RealEstateState) -> list[str]:
    return [label for key, label in REQUIRED if state.lead.get(key) in (None, "", [])]


def score(state: RealEstateState) -> int:
    lead = state.lead
    pts = POINTS["timeline"].get(lead.get("timeline", ""), 0) + POINTS["financing"].get(lead.get("financing", ""), 0)
    booked = active(state)
    if any(a.purpose == "showing" for a in booked):
        pts += POINTS["showingBooked"]
    if any(a.purpose == "valuation" for a in booked):
        pts += POINTS["valuationBooked"]
    if lead.get("hasAgent"):
        pts += POINTS["hasAgent"]
    return pts


def tier(state: RealEstateState) -> Optional[str]:
    """The lead's rank for the team, once enough is known. Never told to the caller."""
    if missing_fields(state):
        return None
    pts = score(state)
    return next((t for t, least in TIERS.items() if pts >= least), OTHERWISE_TIER)


def money(n: int) -> str:
    return f"${n:,}"


def standout(x: dict[str, Any]) -> str:
    """One true thing worth saying about a home, from the listing data only."""
    if x.get("newConstruction"):
        return "new construction"
    if x.get("daysOnMarket") is not None and x["daysOnMarket"] <= 7:
        return "just listed this week"
    if x.get("lotSqft") and x["type"] == "Single Family" and x["lotSqft"] >= 9000:
        return f"a big lot, about {round(x['lotSqft'] / 43560, 2)} acres"
    if x.get("yearBuilt") and x["yearBuilt"] >= 2018:
        return f"built in {x['yearBuilt']}"
    if x.get("yearBuilt") and x["yearBuilt"] <= 1950:
        return f"an older home, built in {x['yearBuilt']}"
    if x["type"] != "Single Family" and not x.get("hoaFee"):
        return "no HOA fee listed"
    return f"about {money(round(x['price'] / x['sqft']))} a square foot"


def spoken(x: dict[str, Any]) -> dict[str, Any]:
    """A listing as the agent may read it out: no ids except the one it passes back."""
    out = {
        "listingId": x["id"],
        "address": x["address"],
        "area": AREA_NAME[x["area"]],
        "type": TYPE_LABEL.get(x["type"], x["type"]),
        "price": money(x["price"]),
        "beds": x["beds"],
        "baths": x["baths"],
        "squareFeet": x["sqft"],
        "standout": standout(x),
    }
    if x.get("daysOnMarket") is not None:
        out["daysOnMarket"] = x["daysOnMarket"]
    return out


def confirm_text(a: Appointment) -> str:
    s = describe_slot(a.slot_id, a.agent_id)
    what = "Showing" if a.purpose == "showing" else "Home valuation"
    return f"{what} at {a.address} with {s['agent']} on {s['day']} at {s['time']}. Reference {a.id}."
