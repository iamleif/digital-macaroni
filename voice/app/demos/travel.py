"""
Waypoint Travel: a fictional travel agency. The visitor asks for flights; the agent resolves places,
runs real searches on Duffel and reads back the actual options, prices and fare rules. Booking goes as
far as the read-back and confirmation, re-checks the fare, then stops: the demo runs in Duffel's test
mode and never creates an order. Nothing is purchased or held.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .. import duffel
from .types import DemoDefinition, OpContext, OpResult, Operation, add_days, date_in, date_label, fail, ok

TIME_ZONE = "America/New_York"
MAX_OPTIONS = 5
# Duffel searches up to about eleven months ahead.
MAX_DAYS_AHEAD = 330
CURRENCY = {"USD": "$", "GBP": "£", "EUR": "€", "CAD": "CA$", "AUD": "A$"}
TEST_MODE_LINE = "I'm sorry, I'm in test mode, so I can't book this for you right now."
OPENING_PHONE = "Thanks for calling Waypoint Travel, this is Linda. If you're following along on our website, type the four-digit code on your screen, or just read it to me. Otherwise, where are you hoping to fly?"
OPENING_WEB = "Thanks for calling Waypoint Travel, this is Linda. Where are you hoping to fly?"

Cabin = Literal["economy", "premium_economy", "business", "first"]
IATA = r"^[A-Za-z]{3}$"


@dataclass
class TravelState:
    seed: str
    today: str
    search: Optional[dict[str, Any]] = None
    # What the visitor was offered, in the order the agent numbered them. offerId stays server-side.
    options: list[dict[str, Any]] = field(default_factory=list)
    selected: Optional[int] = None
    details: Optional[dict[str, Any]] = None
    booking: Optional[dict[str, Any]] = None
    # The booking read back to the caller, awaiting their yes.
    read_back: Optional[dict[str, Any]] = None
    # Names of places the agent looked up, by code, so the dashboard can say "London" rather than "LON".
    places: dict[str, str] = field(default_factory=dict)


# ---- Formatting what the airline returned into things the agent can say ----


def money(amount: str, currency: str) -> str:
    value = float(amount)
    text = f"{value:,.0f}" if value.is_integer() else f"{value:,.2f}"
    symbol = CURRENCY.get(currency)
    return f"{symbol}{text}" if symbol else f"{text} {currency}"


def duration(iso: Optional[str]) -> str:
    """ISO 8601 durations as Duffel sends them ("PT7H45M", "P1DT2H") to "7h 45m"."""
    if not iso:
        return ""
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?", iso)
    if not m:
        return ""
    days, hours, minutes = (int(g or 0) for g in m.groups())
    hours += days * 24
    return " ".join(p for p in (f"{hours}h" if hours else "", f"{minutes}m" if minutes else "") if p) or "0m"


def clock(local: str) -> str:
    """Duffel's local airport time ("2026-11-20T09:05:00") as "9:05 AM"."""
    t = datetime.fromisoformat(local)
    return t.strftime("%I:%M %p").lstrip("0")


def day(local: str) -> str:
    return date_label(local[:10])


def journey(slice_: dict[str, Any]) -> dict[str, Any]:
    segments = slice_.get("segments") or []
    first, last = segments[0], segments[-1]
    carriers = list(dict.fromkeys((s.get("marketing_carrier") or {}).get("name") or "" for s in segments))
    return {
        "from": first["origin"]["iata_code"],
        "fromName": first["origin"].get("name"),
        "to": last["destination"]["iata_code"],
        "toName": last["destination"].get("name"),
        "date": day(first["departing_at"]),
        "departs": clock(first["departing_at"]),
        "arrives": clock(last["arriving_at"]),
        # Arriving on a later calendar day than it left, in local times.
        "arrivesNextDay": last["arriving_at"][:10] > first["departing_at"][:10],
        "duration": duration(slice_.get("duration")),
        "stops": len(segments) - 1,
        "via": [s["destination"]["iata_code"] for s in segments[:-1]],
        "flights": [f"{(s.get('marketing_carrier') or {}).get('iata_code', '')}{s.get('marketing_carrier_flight_number', '')}" for s in segments],
        "airlines": [c for c in carriers if c],
    }


def summarise(offer: dict[str, Any], number: int) -> dict[str, Any]:
    return {
        "option": number,
        "offerId": offer["id"],
        "airline": (offer.get("owner") or {}).get("name"),
        "price": money(offer["total_amount"], offer["total_currency"]),
        "amount": offer["total_amount"],
        "currency": offer["total_currency"],
        "journeys": [journey(s) for s in offer.get("slices") or []],
    }


def _minutes(iso: Optional[str]) -> int:
    d = duration(iso)
    h = re.search(r"(\d+)h", d)
    m = re.search(r"(\d+)m", d)
    return (int(h.group(1)) if h else 0) * 60 + (int(m.group(1)) if m else 0)


def pick(offers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    A short list worth reading out from offers sorted by price: the cheapest few, plus the fastest and
    the one with fewest stops if they are not already there. Same-looking offers (same flights, a
    different fare) keep only the cheapest.
    """
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for o in offers:
        key = "|".join(f"{s['marketing_carrier']['iata_code']}{s['marketing_carrier_flight_number']}{s['departing_at']}" for sl in o["slices"] for s in sl["segments"])
        if key not in seen:
            seen.add(key)
            unique.append(o)
    chosen = unique[:3]
    total = lambda o: sum(_minutes(s.get("duration")) for s in o["slices"])  # noqa: E731
    stops = lambda o: sum(len(s["segments"]) - 1 for s in o["slices"])  # noqa: E731
    for best in (min(unique, key=total, default=None), min(unique, key=stops, default=None)):
        if best is not None and best not in chosen:
            chosen.append(best)
    return chosen[:MAX_OPTIONS]


def conditions(offer: dict[str, Any]) -> dict[str, str]:
    def rule(c: Optional[dict[str, Any]], verb: str) -> str:
        if not c:
            return "Not stated by the airline"
        if not c.get("allowed"):
            return f"Not {verb}"
        fee = c.get("penalty_amount")
        return f"{verb.capitalize()} for a fee of {money(fee, c.get('penalty_currency') or offer['total_currency'])}" if fee and float(fee) > 0 else f"{verb.capitalize()} free of charge"

    c = offer.get("conditions") or {}
    return {"refund": rule(c.get("refund_before_departure"), "refundable"), "changes": rule(c.get("change_before_departure"), "changeable")}


def baggage(offer: dict[str, Any]) -> str:
    checked = carry = 0
    first = ((offer.get("slices") or [{}])[0].get("segments") or [{}])[0]
    for p in (first.get("passengers") or [])[:1]:
        for b in p.get("baggages") or []:
            if b.get("type") == "checked":
                checked += b.get("quantity", 0)
            elif b.get("type") == "carry_on":
                carry += b.get("quantity", 0)
    parts = [f"{checked} checked bag{'s' if checked != 1 else ''}" if checked else "no checked bags", f"{carry} carry-on" if carry else "no carry-on stated"]
    return ", ".join(parts) + " per traveller"


def brief(o: dict[str, Any]) -> dict[str, Any]:
    """What the agent hears about an option: enough to describe it in a sentence."""

    def leg(j: dict[str, Any]) -> dict[str, Any]:
        return {"date": j["date"], "departs": j["departs"], "from": j["fromName"], "arrives": j["arrives"] + (" next day" if j["arrivesNextDay"] else ""), "to": j["toName"], "stops": j["stops"], "duration": j["duration"]}

    out = {"option": o["option"], "airline": o["airline"], "price": o["price"], "outbound": leg(o["journeys"][0])}
    if len(o["journeys"]) > 1:
        out["return"] = leg(o["journeys"][1])
    return out


def search_label(s: dict[str, Any]) -> str:
    trip = f"{s['origin']} to {s['destination']}, {date_label(s['departureDate'])}"
    return trip + (f", back {date_label(s['returnDate'])}" if s.get("returnDate") else "")


DUFFEL_FAILURES = {
    "timeout": "The airline search took too long. Apologise and offer to try again, perhaps with nearby dates.",
    "rate_limited": "The flight system is busy. Apologise and offer to try again in a moment.",
    "network": "The flight system could not be reached. Apologise and offer to try again.",
    "not_configured": "Flight search is not available right now. Apologise briefly.",
    "rejected": "The airline system did not accept that search. Check the airports and dates with the caller.",
    "not_found": "That fare is no longer available. Offer to search again.",
}


def duffel_failure(err: duffel.DuffelError) -> OpResult:
    return fail(err.kind, DUFFEL_FAILURES.get(err.kind, DUFFEL_FAILURES["network"]))


# ---- State, instructions ----


def create_state(now: datetime) -> TravelState:
    today = date_in(TIME_ZONE, now)[0]
    return TravelState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)


def instruction(state: TravelState, ctx: OpContext) -> str:
    return f"""You are Linda. You work at Waypoint Travel, a small travel agency, and you help callers find flights. Speak as part of the agency ("we", "our").

Behind the scenes, and not something to mention unless asked: this line is a demonstration connected to an airline booking system's test environment. The searches are real requests, but the airlines, schedules and prices come from that test environment and nothing can be booked. If a caller asks directly whether you are a real person, say briefly that you are Waypoint's AI assistant. If they ask whether the flights or prices are real, say briefly that this is a demo running on test airline data, then carry on helping.

Today is {date_label(state.today)}, {state.today[:4]} ({state.today}). Work out dates the caller describes ("next Friday", "the 20th") from today, and say the date back as a weekday and date ("Friday, November 20th").

How you speak: friendly, capable and efficient, like a good agent who has done this a thousand times. Short sentences, one question at a time. Everything you write is spoken aloud by a voice, so never use lists, bullet points, symbols, abbreviations or emoji, and never read out codes or ids. Say airports by city or name ("London Heathrow"), times naturally ("nine oh five in the morning"), durations in words ("seven hours forty-five"), and prices as spoken amounts ("four hundred and twelve dollars"). Keep prices to the dollar ("about four hundred and thirteen dollars") except in a booking read-back. If you are interrupted, stop and listen.

Opening on a phone call: exactly "{OPENING_PHONE}" Nothing more.
Opening in a website conversation: exactly "{OPENING_WEB}" Nothing more.

What you can do, always through your tools:
- Places: when a city or airport is unclear or has several airports, call find_places and use its codes. A city code (such as LON or NYC) covers all of that city's airports.
- Search: before searching you need where from, where to, the departure date, one way or return (and the return date), and how many adults. Assume economy unless they say otherwise. Then call search_flights. Only describe options the tool returned; never invent flights, times or prices.
- Presenting results: keep it brief, the caller is listening, not reading. Say how many you found and the lowest price, then describe the best one or two in one short sentence each: airline, departure time, nonstop or how many stops, and price. Mention an airport only when it is not the obvious main one. Leave out flight numbers, arrival times and the return flight unless asked. Then ask which sounds good, or whether they want other times.
- Details: when the caller is interested in an option, call get_offer_details for its option number to get the current price, the refund and change rules and the baggage allowance. Mention if the price changed.
- Booking: when they want to book, get the lead traveller's full name and call book_flight. The first call books nothing and returns readBack: read those details back and ask for a clear yes. If they say yes, call book_flight again with the same option and name. Booking is switched off in this demo: that second call re-checks the fare and returns notBooked. Then say exactly "{TEST_MODE_LINE}" and offer to help with anything else, such as other dates or another trip. Never say a flight is booked, held or reserved.

Rules: if a tool fails, explain simply and do what its message suggests. Do not ask for dates of birth, passport numbers, email addresses or payment details.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short goodbye and then call end_call."""


# ---- Operations ----


class FindPlaces(BaseModel):
    query: str = Field(min_length=2, max_length=60, description="A city, airport name or airport code, e.g. 'London' or 'JFK'.")


async def find_places(state: TravelState, i: FindPlaces, ctx: OpContext) -> OpResult:
    try:
        places = await duffel.suggest_places(i.query)
    except duffel.DuffelError as err:
        return duffel_failure(err)
    if not places:
        return fail("no_match", "No airport or city matches that. Ask the caller to say it another way.")
    for p in places:
        if p["code"] and p["name"]:
            state.places.setdefault(p["code"], p["name"])
    return ok(f"{len(places)} place{'s' if len(places) > 1 else ''} found", {"places": places})


class SearchFlights(BaseModel):
    origin: str = Field(pattern=IATA, description="Airport or city code to fly from, e.g. LHR or LON.")
    destination: str = Field(pattern=IATA, description="Airport or city code to fly to.")
    departureDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD.")
    returnDate: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD, only for a return trip.")
    adults: int = Field(1, ge=1, le=6)
    cabinClass: Cabin = "economy"
    nonstopOnly: bool = Field(False, description="True only if the caller asked for direct flights.")


async def search_flights(state: TravelState, i: SearchFlights, ctx: OpContext) -> OpResult:
    origin, destination = i.origin.upper(), i.destination.upper()
    if origin == destination:
        return fail("same_place", "The origin and destination are the same. Check with the caller.")
    try:
        out = date.fromisoformat(i.departureDate)
        back = date.fromisoformat(i.returnDate) if i.returnDate else None
    except ValueError:
        return fail("invalid_date", "That is not a valid date. Check the date with the caller.")
    if i.departureDate < state.today:
        return fail("date_in_past", f"That date has passed; today is {date_label(state.today)}. Check the date with the caller.")
    if i.departureDate > add_days(state.today, MAX_DAYS_AHEAD):
        return fail("too_far_ahead", "Airlines only sell about eleven months ahead. Suggest an earlier date.")
    if back and back < out:
        return fail("return_before_departure", "The return date is before the departure. Check both dates with the caller.")
    slices = [{"origin": origin, "destination": destination, "departure_date": i.departureDate}]
    if i.returnDate:
        slices.append({"origin": destination, "destination": origin, "departure_date": i.returnDate})
    state.search = {"origin": origin, "destination": destination, "departureDate": i.departureDate, "returnDate": i.returnDate, "adults": i.adults, "cabinClass": i.cabinClass}
    state.options, state.selected, state.details = [], None, None
    try:
        offers = await duffel.search_offers(slices, i.adults, i.cabinClass, 0 if i.nonstopOnly else 1)
    except duffel.DuffelError as err:
        return duffel_failure(err)
    state.options = [summarise(o, n) for n, o in enumerate(pick(offers), start=1)]
    if not state.options:
        return ok("No flights found", {"found": 0, "note": "No flights for that search. Suggest nearby dates, another airport, or allowing a connection."}, True)
    cheapest = min(state.options, key=lambda o: float(o["amount"]))
    return ok(
        f"{len(offers)} fares · showing {len(state.options)}",
        {"found": len(offers), "fromPrice": cheapest["price"], "options": [brief(o) for o in state.options]},
        True,
    )


class OptionRef(BaseModel):
    option: int = Field(ge=1, le=MAX_OPTIONS, description="The option number from search_flights.")


def _option(state: TravelState, n: int) -> Optional[dict[str, Any]]:
    return next((o for o in state.options if o["option"] == n), None)


async def get_offer_details(state: TravelState, i: OptionRef, ctx: OpContext) -> OpResult:
    chosen = _option(state, i.option)
    if not chosen:
        return fail("no_such_option", "There is no option with that number in the current search.")
    try:
        offer = await duffel.get_offer(chosen["offerId"])
    except duffel.DuffelError as err:
        return duffel_failure(err)
    now_price = money(offer["total_amount"], offer["total_currency"])
    state.selected = i.option
    state.details = {
        "option": i.option,
        "price": now_price,
        "priceChanged": offer["total_amount"] != chosen["amount"],
        "fareBrand": ((offer.get("slices") or [{}])[0]).get("fare_brand_name"),
        **conditions(offer),
        "baggage": baggage(offer),
    }
    return ok(f"Option {i.option} · {now_price}", {k: v for k, v in state.details.items() if v is not None} | {"wasPrice": chosen["price"]}, True)


class BookFlight(BaseModel):
    option: int = Field(ge=1, le=MAX_OPTIONS)
    travellerName: str = Field(min_length=2, max_length=80, description="Lead traveller's full name as the caller gave it.")


async def book_flight(state: TravelState, i: BookFlight, ctx: OpContext) -> OpResult:
    """
    Two calls, like a careful agent: the first returns what to read back and books nothing; the second,
    for the same option and name after the caller's yes, re-checks the fare as a real booking would
    before payment, then stops because the demo is in test mode.
    """
    chosen = _option(state, i.option)
    if not chosen:
        return fail("no_such_option", "There is no option with that number in the current search.")
    name = re.sub(r"\s+", " ", i.travellerName.strip())
    if not state.read_back or (state.read_back["option"], state.read_back["travellerName"].lower()) != (i.option, name.lower()):
        state.read_back = {"option": i.option, "travellerName": name, "price": chosen["price"]}
        out = chosen["journeys"][0]
        # A step, not a failure: the result says plainly that nothing is booked yet.
        return ok(
            f"Details to confirm · {chosen['price']}",
            {"booked": False, "next": "Nothing is booked yet. Read these details back to the caller and ask whether they are correct; if they say yes, call book_flight again with the same option and name.", "readBack": {"traveller": name, "airline": chosen["airline"], "outbound": f"{out['date']}, {out['departs']} from {out['fromName']}", "return": chosen["journeys"][1]["date"] if len(chosen["journeys"]) > 1 else None, "price": chosen["price"]}},
            True,
        )
    try:
        offer = await duffel.get_offer(chosen["offerId"])
    except duffel.DuffelError as err:
        return duffel_failure(err)
    state.selected = i.option
    state.read_back = None
    state.booking = {"option": i.option, "travellerName": name, "price": money(offer["total_amount"], offer["total_currency"]), "status": "not_booked_test_mode"}
    r = fail("test_mode", f'Booking is switched off: this demo runs in test mode and nothing was booked. Say exactly: "{TEST_MODE_LINE}" Then offer other help.', {"notBooked": True, "fareStillAvailable": True, "currentPrice": state.booking["price"]})
    r.summary = "Not booked: test mode"
    r.changed = True
    return r


def view(state: TravelState) -> dict[str, Any]:
    return {
        "search": ({**state.search, "label": search_label(state.search), "originName": state.places.get(state.search["origin"]), "destinationName": state.places.get(state.search["destination"])} if state.search else None),
        "options": [{k: v for k, v in o.items() if k != "offerId"} for o in state.options],
        "selected": state.selected,
        "details": state.details,
        "readBack": state.read_back,
        "booking": state.booking,
    }


travel: DemoDefinition[TravelState] = DemoDefinition(
    id="travel",
    business_name="Waypoint Travel",
    agent_name="Linda",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="friendly, warm and efficient, at an easy conversational pace",
    fixed_lines=[OPENING_PHONE, OPENING_WEB, TEST_MODE_LINE],
    vocabulary=["Waypoint", "Heathrow", "Gatwick", "Stansted", "JFK", "LaGuardia", "Newark", "LAX", "O'Hare", "economy", "premium economy", "business class", "first class", "one way", "round trip", "nonstop", "layover"],
    operations={
        "find_places": Operation("Looking up airports", "Airports and cities matching a name or code, with their codes.", find_places, FindPlaces),
        "search_flights": Operation("Searching flights", "Search airline fares for a one-way or return trip. Returns up to five options, cheapest first, with times, stops and price.", search_flights, SearchFlights),
        "get_offer_details": Operation("Checking the fare", "Current price, refund and change rules and baggage for one option.", get_offer_details, OptionRef),
        "book_flight": Operation("Booking the flight", "Book an option for the lead traveller, after the caller said yes to the read-back.", book_flight, BookFlight),
    },
)
