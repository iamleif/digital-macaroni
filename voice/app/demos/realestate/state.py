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

from .. import schedule as sched
from ..types import add_days, date_in, date_label, weekday
from .store import (
    AGENTS,
    DECK,
    FORCED,
    SHIFTS,
    TITLES,
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
    title: str = ""


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
    # How many times note_lead has put each lead question in front of the agent.
    asked: dict[str, int] = field(default_factory=dict)
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


def full_name(name: Optional[str]) -> bool:
    """A name worth saving for a booking or lead: a first and a last name."""
    return len((name or "").split()) >= 2


def existing_calendar(days: list[str], today: Optional[str] = None, earliest_hour: int = 0) -> list[Booked]:
    """Appointments already in the agents' diaries. Each date is generated from the date alone (never the call's time),
    so a given day looks the same on every call while different days and weeks differ. The agents work different
    shifts (a late start, a half day, a day off, lunch at different times); the day keeps two to five open hours,
    for different agents at different times; everything else they work is taken. Dana's openings are at valuation
    times, the buyers' agents' at any showing hour."""
    out: list[Booked] = []
    n = 0
    lo, hi = min(SHOWING_HOURS) * 60, (max(SHOWING_HOURS) + 1) * 60
    for day in days:
        segs = {a["id"]: sched.shift_of(SHIFTS, a["id"], day, lo, hi) for a in AGENTS}
        floor = earliest_hour * 60 if day == today else 0
        idx = sched.business_index(day, set())
        k = sched.open_budget("juniper", day, sched.OPEN_WEIGHTS_MANY)

        def make(min_start: int, segs=segs) -> list[sched.Hole]:
            def starts(who: str, minutes: int, holes: list[sched.Hole]) -> list[int]:
                free = sched.subtract(segs[who], [h.span() for h in holes if h.who == who])
                ok_hours = VALUATION_HOURS if who == SELLER_AGENT else SHOWING_HOURS
                return sched.hole_starts(free, 60, 60, min_start, allowed=lambda s: s // 60 in ok_hours)

            return sched.choose_holes(
                sched.rng("juniper", "holes", day), k=k, deck=[((w,), 60) for w in DECK], idx=idx, starts=starts, span=(lo, hi),
                forced=[((w,), 60) for w, period, phase in FORCED if idx % int(period) == int(phase)],
            )

        holes = sched.settle(make, floor, min(k, 2), lambda hs: [h.start for h in hs])
        taken = {(h.who, h.start // 60) for h in holes}
        for a in AGENTS:
            r = sched.rng("juniper", "fill", day, a["id"])
            titles = TITLES["dana"] if a["id"] == SELLER_AGENT else TITLES["buyers"]
            off = sched.off_blocks(segs[a["id"]], lo, hi, seed=f"juniper{day}{a['id']}")
            for h in range(lo // 60, hi // 60):
                if (a["id"], h) in taken:
                    continue
                if any(s <= h * 60 and h * 60 + 60 <= e for s, e in segs[a["id"]]):
                    out.append(Booked(a["id"], day, h, f"existing-{n}", True, r.choice(titles)))
                else:
                    out.append(Booked(a["id"], day, h, f"existing-{n}", True, next((x[2] for x in off if x[0] < (h + 1) * 60 and h * 60 < x[0] + x[1]), "Out")))
                n += 1
    return out


def create_state(now: datetime) -> RealEstateState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = RealEstateState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
    state.calendar = existing_calendar(bookable_days(state), today, state.earliest_today_hour)
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
    return [label for key, label in REQUIRED if state.lead.get(key) in (None, "", []) or (key == "name" and not full_name(state.lead.get(key)))]


# The brokerage's order for getting to know a lead: (key, how many times it may be put to the caller,
# the question as it is said aloud). A question the caller dodges is not put a third time.
def lead_questions(lead: dict[str, Any]) -> list[tuple[str, int, str]]:
    intent = lead.get("intent")
    buys, sells = intent in ("buy", "both"), intent in ("sell", "both")
    first_only = bool(lead.get("name")) and not full_name(lead["name"])
    qs: list[tuple[str, int, str]] = [("lastName" if first_only else "name", 2, "And your last name?" if first_only else "May I have your name?"), ("intent", 2, "Are you looking to buy, sell, or both?")]
    if sells:
        qs.append(("sellAddress", 2, "What's the address of the home you're thinking of selling?"))
    if buys or sells:
        qs.append(("timeline", 2, "When are you hoping to sell?" if intent == "sell" else "When are you hoping to move?"))
    if buys:
        qs.append(("financing", 2, "Are you pre-approved, paying cash, or still working on financing?"))
        if lead.get("financing") in ("pre_approved", "talking_to_lender"):
            qs.append(("lender", 2, "Who's your lender?"))
        qs += [("firstTimeBuyer", 2, "Is this your first home?"), ("hasAgent", 2, "Are you already working with an agent?")]
    if intent == "sell":
        qs.append(("alsoBuying", 1, "Are you also looking to buy?"))
    return qs


def next_question(state: RealEstateState) -> Optional[tuple[str, str]]:
    """The first question still unanswered (and not already asked as often as it may be), as (key, spoken)."""
    for key, limit, text in lead_questions(state.lead):
        if (state.lead.get(key) in (None, "", []) or key == "lastName") and state.asked.get(key, 0) < limit:
            return key, text
    return None


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
