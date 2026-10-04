"""
Waypoint Travel: a fictional travel agency. Linda works like a travel agent: she finds out what matters
to the caller (price, journey time, time of day, nonstop, airline), runs a real search on Duffel and
offers a labelled short list rather than everything found. Booking then goes as deep as a real one:
fare level, seat (on the airline's seat map), checked bags, traveller, and a full read-back with a live
price check. It stops at payment: the demo runs in Duffel's test mode and never creates an order.
Nothing is purchased or held. Traveller details beyond the caller's name are labelled samples.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .. import duffel, email
from .types import Confirmed, DemoDefinition, OpContext, OpResult, Operation, add_days, date_in, date_label, fail, ok

TIME_ZONE = "America/New_York"
SHORTLIST = 3
MAX_OPTIONS = 5
# Duffel searches up to about eleven months ahead.
MAX_DAYS_AHEAD = 330
CURRENCY = {"USD": "$", "GBP": "£", "EUR": "€", "CAD": "CA$", "AUD": "A$"}
TEST_MODE_LINE = "I'm sorry, I'm in test mode, so I can't book this for you right now."
PAYMENT_LINE = "Everything's ready. This is where I'd take payment, but I'm in test mode, so I can't book this for you right now."
OPENING_PHONE = "Thanks for calling Waypoint Travel, this is Linda. If you're following along on our website, type the four-digit code on your screen, or just read it to me. Otherwise, where are you hoping to fly?"
OPENING_WEB = "Thanks for calling Waypoint Travel, this is Linda. Where are you hoping to fly?"
# Departure windows the caller can ask for, in the airport's local time.
TIME_WINDOWS = {"morning": ("05:00", "11:59"), "afternoon": ("12:00", "16:59"), "evening": ("17:00", "23:59")}
# What an airline needs besides the name. A public demo never collects these: they are shown as samples.
SAMPLE_TRAVELLER = {"bornOn": "1990-04-12", "email": "traveller@example.com", "phone": "+1 555 0142"}
STAGES = ["trip", "options", "fare", "seat", "bags", "traveller", "review", "payment"]

Cabin = Literal["economy", "premium_economy", "business", "first"]
Priority = Literal["cheapest", "fastest", "best"]
TimeOfDay = Literal["any", "morning", "afternoon", "evening"]
IATA = r"^[A-Za-z]{3}$"
LABELS = {"cheapest": "Cheapest", "fastest": "Fastest", "best": "Best value"}


@dataclass
class TravelState:
    seed: str
    today: str
    search: Optional[dict[str, Any]] = None
    # The short list the agent offered, numbered as it numbered them. offerId stays server-side.
    options: list[dict[str, Any]] = field(default_factory=list)
    # Every offer from the last search (server-side only): fare levels come from offers on the same flights.
    offers: list[dict[str, Any]] = field(default_factory=list)
    selected: Optional[int] = None
    # The chosen offer as the airline last priced it, with the extras it sells (server-side only).
    offer: Optional[dict[str, Any]] = None
    details: Optional[dict[str, Any]] = None
    fare_levels: list[dict[str, Any]] = field(default_factory=list)
    seat_map: Optional[dict[str, Any]] = None
    # Seat designator -> (service id, amount, currency), server-side only.
    seat_services: dict[str, tuple[str, str, str]] = field(default_factory=dict)
    seat: Optional[dict[str, Any]] = None
    bags: Optional[dict[str, Any]] = None
    traveller: Optional[dict[str, Any]] = None
    review: Optional[dict[str, Any]] = None
    booking: Optional[dict[str, Any]] = None
    # The booking read back to the caller, awaiting their yes (the site's booking card shows it).
    read_back: Optional[dict[str, Any]] = None
    stage: str = "trip"
    # The itinerary email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None
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


def flight_key(o: dict[str, Any]) -> str:
    """The flights an offer is for, regardless of fare: the same key means the same seats on the same planes."""
    return "|".join(f"{s['marketing_carrier']['iata_code']}{s['marketing_carrier_flight_number']}{s['departing_at']}" for sl in o["slices"] for s in sl["segments"])


def total_minutes(o: dict[str, Any]) -> int:
    return sum(_minutes(s.get("duration")) for s in o["slices"])


def total_stops(o: dict[str, Any]) -> int:
    return sum(len(s["segments"]) - 1 for s in o["slices"])


def shortlist(offers: list[dict[str, Any]], priority: str = "best", size: int = SHORTLIST) -> list[tuple[dict[str, Any], str]]:
    """
    A travel agent's short list: one offer per set of flights (its cheapest fare), ranked by what the
    caller cares about, each labelled with why it is there (the cheapest, the fastest, the best value).
    """
    cheapest_per_flight: dict[str, dict[str, Any]] = {}
    for o in offers:
        k = flight_key(o)
        if k not in cheapest_per_flight or float(o["total_amount"]) < float(cheapest_per_flight[k]["total_amount"]):
            cheapest_per_flight[k] = o
    unique = list(cheapest_per_flight.values())
    if not unique:
        return []
    low_price = min(float(o["total_amount"]) for o in unique)
    low_time = min(total_minutes(o) for o in unique) or 1

    def value(o: dict[str, Any]) -> float:
        # Price and journey time each relative to the best available; every stop counts against it too.
        return float(o["total_amount"]) / low_price + 0.8 * total_minutes(o) / low_time + 0.15 * total_stops(o)

    rank = {"cheapest": lambda o: (float(o["total_amount"]), total_minutes(o)), "fastest": lambda o: (total_minutes(o), float(o["total_amount"])), "best": value}
    picks: list[tuple[dict[str, Any], str]] = []
    # The caller's priority first, then the other two kinds, then the next best by their priority.
    for kind in [priority, *[k for k in ("cheapest", "fastest", "best") if k != priority]]:
        top = min(unique, key=rank[kind])  # type: ignore[arg-type]
        if all(top is not p for p, _ in picks):
            picks.append((top, LABELS[kind]))
    for o in sorted(unique, key=rank[priority]):  # type: ignore[arg-type]
        if len(picks) >= size:
            break
        if all(o is not p for p, _ in picks):
            picks.append((o, "Also good"))
    return picks[:size]


def brief(o: dict[str, Any]) -> dict[str, Any]:
    """What the agent hears about an option: enough to describe it in a sentence."""

    def leg(j: dict[str, Any]) -> dict[str, Any]:
        return {"date": j["date"], "departs": j["departs"], "from": j["fromName"], "arrives": j["arrives"] + (" next day" if j["arrivesNextDay"] else ""), "to": j["toName"], "stops": j["stops"], "via": j["via"], "duration": j["duration"]}

    out = {"option": o["option"], "label": o.get("label"), "airline": o["airline"], "price": o["price"], "outbound": leg(o["journeys"][0])}
    if len(o["journeys"]) > 1:
        out["return"] = leg(o["journeys"][1])
    return out


def search_label(s: dict[str, Any]) -> str:
    trip = f"{s['origin']} to {s['destination']}, {date_label(s['departureDate'])}"
    return trip + (f", back {date_label(s['returnDate'])}" if s.get("returnDate") else "")


def fare_summary(offer: dict[str, Any]) -> dict[str, Any]:
    first = (offer.get("slices") or [{}])[0]
    return {"brand": first.get("fare_brand_name") or "Standard", "price": money(offer["total_amount"], offer["total_currency"]), "amount": offer["total_amount"], **conditions(offer), "baggage": baggage(offer)}


def extra_bag_service(offer: dict[str, Any]) -> Optional[dict[str, Any]]:
    """The airline's extra checked bag for the first traveller, if it sells one."""
    for s in offer.get("available_services") or []:
        if s.get("type") == "baggage" and (s.get("metadata") or {}).get("type") == "checked":
            return s
    return None


# ---- Seat maps ----


def _seat_position(sections: list[list[dict[str, Any]]], si: int, ci: int) -> str:
    """Window, aisle or middle, from where a seat sits among the row's sections (aisles fall between them)."""
    seats = [i for i, c in enumerate(sections[si]) if "id" in c]
    if not seats:
        return "middle"
    if (si == 0 and ci == seats[0]) or (si == len(sections) - 1 and ci == seats[-1]):
        return "window"
    if (si > 0 and ci == seats[0]) or (si < len(sections) - 1 and ci == seats[-1]):
        return "aisle"
    return "middle"


def compact_seat_map(m: dict[str, Any], currency: str) -> tuple[dict[str, Any], dict[str, tuple[str, str, str]]]:
    """
    One segment's seat map as the dashboard draws it: rows of sections (aisles between sections) of
    cells, each a seat (free, paid with its price, or taken) or a facility (lavatory, galley, exit,
    bassinet, empty). Exit rows are marked so their extra legroom can be offered. Service ids stay here.
    """
    services: dict[str, tuple[str, str, str]] = {}
    cab = (m.get("cabins") or [{}])[0]
    rows: list[dict[str, Any]] = []
    exit_next = False
    for row in cab.get("rows") or []:
        sections: list[list[dict[str, Any]]] = []
        is_exit_marker = False
        for sec in row.get("sections") or []:
            cells: list[dict[str, Any]] = []
            for el in sec.get("elements") or []:
                if el.get("type") == "seat" and el.get("designator"):
                    svc = (el.get("available_services") or [None])[0]
                    if svc is None:
                        cells.append({"id": el["designator"], "st": "taken"})
                    else:
                        amount, cur = svc["total_amount"], svc.get("total_currency") or currency
                        services[el["designator"]] = (svc["id"], amount, cur)
                        cells.append({"id": el["designator"], "st": "free" if float(amount) == 0 else "paid", "price": None if float(amount) == 0 else money(amount, cur)})
                else:
                    if el.get("type") == "exit_row":
                        is_exit_marker = True
                    cells.append({"type": el.get("type") or "empty"})
            sections.append(cells)
        number = next((int(re.match(r"\d+", c["id"]).group()) for sec in sections for c in sec if "id" in c), None)  # type: ignore[union-attr]
        rows.append({"row": number, "exit": exit_next and number is not None, "sections": sections})
        if number is not None:
            exit_next = False
        if is_exit_marker:
            exit_next = True
    return {"cabin": cab.get("cabin_class"), "aisles": cab.get("aisles"), "wings": cab.get("wings"), "rows": rows}, services


def seats_in(seat_map: dict[str, Any]) -> list[dict[str, Any]]:
    """Every bookable seat with its position, row and price."""
    out = []
    for row in seat_map["rows"]:
        for si, sec in enumerate(row["sections"]):
            for ci, c in enumerate(sec):
                if "id" in c and c["st"] != "taken":
                    out.append({"seat": c["id"], "row": row["row"], "position": _seat_position(row["sections"], si, ci), "exitRow": row["exit"], "price": c.get("price") or "free"})
    return out


def seat_suggestions(seat_map: dict[str, Any]) -> dict[str, Any]:
    """What the agent tells the caller: how many seats are open and the best of each kind."""
    open_seats = seats_in(seat_map)

    def best(position: Optional[str] = None, exit_row: bool = False) -> Optional[dict[str, Any]]:
        pool = [s for s in open_seats if (position is None or s["position"] == position) and (not exit_row or s["exitRow"])]
        pool.sort(key=lambda s: (s["price"] != "free", 0 if s["price"] == "free" else float(re.sub(r"[^\d.]", "", s["price"]) or 0), s["row"] or 999))
        return pool[0] if pool else None

    return {
        "openSeats": len(open_seats),
        "freeSeats": sum(1 for s in open_seats if s["price"] == "free"),
        "bestWindow": best("window"),
        "bestAisle": best("aisle"),
        "exitRow": best(exit_row=True),
    }


DUFFEL_FAILURES = {
    "timeout": "The airline search took too long. Apologise and offer to try again, perhaps with nearby dates.",
    "rate_limited": "The flight system is busy. Apologise and offer to try again in a moment.",
    "network": "The flight system could not be reached. Apologise and offer to try again.",
    "not_configured": "Flight search is not available right now. Apologise briefly.",
    "rejected": "The airline system did not accept that. Check the details with the caller.",
    "not_found": "That fare is no longer available. Offer to search again.",
}


def duffel_failure(err: duffel.DuffelError) -> OpResult:
    return fail(err.kind, DUFFEL_FAILURES.get(err.kind, DUFFEL_FAILURES["network"]))


# ---- State, instructions ----


def create_state(now: datetime) -> TravelState:
    today = date_in(TIME_ZONE, now)[0]
    return TravelState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)


def instruction(state: TravelState, ctx: OpContext) -> str:
    return f"""You are Linda. You work at Waypoint Travel, a small travel agency, and you help callers find and book flights. Speak as part of the agency ("we", "our").

Behind the scenes, and not something to mention unless asked: this line is a demonstration connected to an airline booking system's test environment. The searches, fares, seat maps and extras are real requests to that test environment, but nothing can be booked or paid for. If a caller asks directly whether you are a real person, say briefly that you are Waypoint's AI assistant. If they ask whether the flights or prices are real, say briefly that this is a demo running on test airline data, then carry on helping.

Today is {date_label(state.today)}, {state.today[:4]} ({state.today}). Work out dates the caller describes ("next Friday", "the 20th") from today, and say the date back as a weekday and date ("Friday, November 20th").

How you speak: friendly, capable and efficient, like a good agent who has done this a thousand times. Short sentences, one question at a time. Everything you write is spoken aloud by a voice, so never use lists, bullet points, symbols, abbreviations or emoji, and never read out codes or ids. Say airports by city or name ("London Heathrow"), times naturally ("nine oh five in the morning"), durations in words ("seven hours forty-five"), seats naturally ("twenty-eight A, a window seat"), and prices as spoken amounts ("four hundred and twelve dollars"). Keep prices to the dollar except in the final read-back. If you are interrupted, stop and listen.

Opening on a phone call: exactly "{OPENING_PHONE}" Nothing more.
Opening in a website conversation: exactly "{OPENING_WEB}" Nothing more.

How you work, step by step, always through your tools:
1. The trip. You need where from, where to, the date, one way or return (and the return date), and how many travellers. Assume economy unless the caller says otherwise; never suggest premium, business or first class yourself. Before searching, if the caller has not said what matters to them, ask one short open question such as "Anything that matters most, like the price or the time of day?" and accept whatever they say, including "no". Let the caller lead; do not quiz them. When a city or airport is unclear, call find_places.
2. Search: call search_flights with what you know (if they said nothing about priorities, use the best balance). It returns a short list of up to three options, each with a label (cheapest, fastest, best value). Never say how many fares exist in total. Keep it to three short sentences at most: the option that fits what they care about (airline, departure time, nonstop or stops, price), then the alternatives in a few words each ("or Lufthansa at six thirty for three ninety"), then ask which they would like. Only describe options the tool returned; never invent flights, times or prices.
3. The flight: when they pick one, call choose_flight and say in one sentence what the fare includes (bags, changes). Mention other fare levels only if the caller asks about them or about changing the fare; switch with choose_fare if they want to.
4. Seats: ask once whether they would like to choose a seat; if not, move on. If yes, call get_seats. Offer the best window and aisle seats and say which are free or what they cost; mention the exit row for extra legroom if there is one. Book their choice with choose_seat (a seat number, or a preference such as window or aisle). If the airline has no seat map, say seats are assigned at check-in.
5. Bags: ask once whether they need an extra checked bag, giving the price the tool gives; add it with add_bags only if they want it.
6. The traveller: ask for the lead traveller's full name and call set_traveller. Do not ask for date of birth, email, phone, passport or payment details: in this demo the other details the airline needs are filled with clearly marked samples, and you can say so in a few words.
7. Review: call review_booking. It re-checks the price live and returns the whole booking. Read it back clearly, starting with "Here's your booking": the flights, the fare, the seat, the bags, the traveller's name, and the total. Nothing is booked yet, so never say "you are booked" or "you're all set". Ask whether everything is correct.
8. Payment: when they say yes, call book_flight. It stops at payment: say exactly "{PAYMENT_LINE}" Never say a flight is booked, held, reserved or paid.
9. Email: then offer once to email them a copy of the itinerary. If they want it, ask for their email address, read it back spelling out anything unusual, and when they confirm it, call email_itinerary with callerConfirmed true. Say it is on its way only if the tool returns ok. If they decline, that's fine. Then ask whether there is anything else you can help with.

Rules: if a tool fails, explain simply and do what its message suggests. If they change their mind at any point (another flight, another seat, no bag), use the tools to change it; the dashboard follows.

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
    nonstopOnly: bool = Field(False, description="True only if the caller wants direct flights only.")
    priority: Priority = Field("best", description="What the caller cares about most: cheapest, fastest (shortest journey) or best (balance).")
    departTime: TimeOfDay = Field("any", description="Time of day for the outbound flight, if the caller has one.")
    returnTime: TimeOfDay = Field("any", description="Time of day for the return flight, if the caller has one.")
    airline: Optional[str] = Field(None, max_length=40, description="An airline the caller prefers, by name, if any.")


def _window(slice_: dict[str, Any], when: str) -> dict[str, Any]:
    if when in TIME_WINDOWS:
        start, end = TIME_WINDOWS[when]
        slice_["departure_time"] = {"from": start, "to": end}
    return slice_


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
    slices = [_window({"origin": origin, "destination": destination, "departure_date": i.departureDate}, i.departTime)]
    if i.returnDate:
        slices.append(_window({"origin": destination, "destination": origin, "departure_date": i.returnDate}, i.returnTime))
    prefs = {"priority": i.priority, "departTime": i.departTime, "returnTime": i.returnTime, "nonstopOnly": i.nonstopOnly, "airline": i.airline}
    state.search = {"origin": origin, "destination": destination, "departureDate": i.departureDate, "returnDate": i.returnDate, "adults": i.adults, "cabinClass": i.cabinClass, **prefs}
    # A new search starts the booking again.
    state.options, state.offers, state.selected, state.offer, state.details, state.fare_levels = [], [], None, None, None, []
    state.seat_map, state.seat_services, state.seat, state.bags, state.review, state.read_back, state.booking = None, {}, None, None, None, None, None
    state.stage = "options"
    try:
        offers = await duffel.search_offers(slices, i.adults, i.cabinClass, 0 if i.nonstopOnly else 1)
    except duffel.DuffelError as err:
        return duffel_failure(err)
    note = None
    if i.airline:
        wanted = i.airline.lower()
        matching = [o for o in offers if wanted in (o.get("owner") or {}).get("name", "").lower() or any(wanted in (s.get("marketing_carrier") or {}).get("name", "").lower() for sl in o["slices"] for s in sl["segments"])]
        if matching:
            offers = matching
        else:
            note = f"Nothing on {i.airline} for that search; these are the best on other airlines. Tell the caller."
    state.offers = offers
    picks = shortlist(offers, i.priority)
    state.options = [summarise(o, n) | {"label": label} for n, (o, label) in enumerate(picks, start=1)]
    if not state.options:
        return ok("No flights found", {"shortlist": [], "note": "No flights for that search. Suggest nearby dates, another time of day, another airport, or allowing a connection."}, True)
    result: dict[str, Any] = {"shortlist": [brief(o) for o in state.options], "next": "Lead with the option that fits what they care about; do not say how many fares exist."}
    if note:
        result["note"] = note
    return ok(f"{len(state.options)} best of {len(offers)} fares", result, True)


class OptionRef(BaseModel):
    option: int = Field(ge=1, le=MAX_OPTIONS, description="The option number from search_flights.")


def _option(state: TravelState, n: int) -> Optional[dict[str, Any]]:
    return next((o for o in state.options if o["option"] == n), None)


def _set_offer(state: TravelState, option: int, offer: dict[str, Any], was_amount: Optional[str]) -> None:
    """Makes this offer the one being booked: its fare details, its fare levels, and a fresh start on extras."""
    state.selected = option
    state.offer = offer
    fare = fare_summary(offer)
    state.details = {"option": option, "price": fare["price"], "priceChanged": was_amount is not None and offer["total_amount"] != was_amount, "fareBrand": fare["brand"], "refund": fare["refund"], "changes": fare["changes"], "baggage": fare["baggage"]}
    same = [o for o in state.offers if flight_key(o) == flight_key(offer)] or [offer]
    levels: dict[str, dict[str, Any]] = {}
    for o in sorted(same, key=lambda o: float(o["total_amount"])):
        f = fare_summary(o)
        levels.setdefault(f["brand"], {**f, "offerId": o["id"]})
    current = fare["brand"]
    levels[current] = {**fare, "offerId": offer["id"]}
    base = float(offer["total_amount"])
    state.fare_levels = [{**lv, "current": lv["brand"] == current, "difference": money(f"{float(lv['amount']) - base:.2f}", offer["total_currency"]) if lv["brand"] != current else None} for lv in sorted(levels.values(), key=lambda lv: float(lv["amount"]))]
    state.seat_map, state.seat_services, state.seat, state.bags, state.review, state.read_back, state.booking = None, {}, None, None, None, None, None
    bag = extra_bag_service(offer)
    state.bags = {"included": fare["baggage"], "added": 0, "extraBagPrice": money(bag["total_amount"], bag["total_currency"]) if bag else None, "maxExtra": (bag or {}).get("maximum_quantity", 0), "amount": "0.00"}


def _levels_for_agent(state: TravelState) -> list[dict[str, Any]]:
    return [{k: v for k, v in lv.items() if k in ("brand", "price", "difference", "refund", "changes", "baggage", "current")} for lv in state.fare_levels]


async def choose_flight(state: TravelState, i: OptionRef, ctx: OpContext) -> OpResult:
    chosen = _option(state, i.option)
    if not chosen:
        return fail("no_such_option", "There is no option with that number in the current search.")
    try:
        offer = await duffel.get_offer(chosen["offerId"], services=True)
    except duffel.DuffelError as err:
        return duffel_failure(err)
    _set_offer(state, i.option, offer, chosen["amount"])
    state.stage = "fare"
    others = [lv for lv in state.fare_levels if not lv["current"]]
    return ok(
        f"{chosen['airline']} · {state.details['fareBrand']} · {state.details['price']}",  # type: ignore[index]
        {"fare": {k: state.details[k] for k in ("fareBrand", "price", "priceChanged", "refund", "changes", "baggage")}, "fareLevels": _levels_for_agent(state), "extraCheckedBag": state.bags["extraBagPrice"], "next": "Say what this fare includes" + (" and offer the next fare level up with its price difference." if others else ".") + " Then ask about seats."},  # type: ignore[index]
        True,
    )


class ChooseFare(BaseModel):
    fare: str = Field(min_length=2, max_length=40, description="The fare level's name, e.g. 'Economy Comfort'.")


async def choose_fare(state: TravelState, i: ChooseFare, ctx: OpContext) -> OpResult:
    if state.offer is None or state.selected is None:
        return fail("no_flight", "Choose a flight first with choose_flight.")
    wanted = i.fare.lower()
    level = next((lv for lv in state.fare_levels if lv["brand"].lower() == wanted), None) or next((lv for lv in state.fare_levels if wanted in lv["brand"].lower() or lv["brand"].lower() in wanted), None)
    if level is None:
        return fail("no_such_fare", "That fare level is not offered on these flights.", {"fareLevels": _levels_for_agent(state)})
    if level["current"]:
        return ok(f"Already on {level['brand']}", {"fare": level["brand"], "price": level["price"], "unchanged": True})
    try:
        offer = await duffel.get_offer(level["offerId"], services=True)
    except duffel.DuffelError as err:
        return duffel_failure(err)
    _set_offer(state, state.selected, offer, level["amount"])
    state.stage = "fare"
    return ok(f"{state.details['fareBrand']} · {state.details['price']}", {"fare": {k: state.details[k] for k in ("fareBrand", "price", "refund", "changes", "baggage")}, "extraCheckedBag": state.bags["extraBagPrice"], "note": "Any seat or bag chosen before needs choosing again on this fare."}, True)  # type: ignore[index]


class NoArgs(BaseModel):
    pass


async def get_seats(state: TravelState, i: NoArgs, ctx: OpContext) -> OpResult:
    if state.offer is None:
        return fail("no_flight", "Choose a flight first with choose_flight.")
    try:
        maps = await duffel.seat_maps(state.offer["id"])
    except duffel.DuffelError as err:
        return duffel_failure(err)
    first_segment = state.offer["slices"][0]["segments"][0]["id"]
    m = next((x for x in maps if x.get("segment_id") == first_segment), maps[0] if maps else None)
    state.stage = "seat"
    if not m:
        state.seat_map = None
        return ok("Seats assigned at check-in", {"seatMap": False, "note": "This airline does not offer seat selection here; seats are assigned at check-in. Tell the caller briefly and move on to bags."}, True)
    seg = state.offer["slices"][0]["segments"][0]
    state.seat_map, state.seat_services = compact_seat_map(m, state.offer["total_currency"])
    state.seat_map["flight"] = {"from": seg["origin"]["iata_code"], "to": seg["destination"]["iata_code"], "flight": f"{seg['marketing_carrier']['iata_code']}{seg['marketing_carrier_flight_number']}"}
    s = seat_suggestions(state.seat_map)
    if not s["openSeats"]:
        return ok("No seats left to choose", {"seatMap": True, "openSeats": 0, "note": "No seats are left to choose; seats will be assigned at check-in."}, True)
    return ok(f"{s['openSeats']} seats open", {"seatMap": True, **s, "next": "Offer the best window and aisle seats with their prices, and the exit row if there is one."}, True)


class ChooseSeat(BaseModel):
    seat: Optional[str] = Field(None, pattern=r"^\d{1,2}[A-Ka-k]$", description="A seat number, e.g. '28A'.")
    preference: Optional[Literal["window", "aisle", "middle", "exit_row"]] = Field(None, description="Or a kind of seat, if the caller did not name one.")


async def choose_seat(state: TravelState, i: ChooseSeat, ctx: OpContext) -> OpResult:
    if state.seat_map is None:
        return fail("no_seat_map", "Call get_seats first; if the airline has no seat map, seats are assigned at check-in.")
    open_seats = seats_in(state.seat_map)
    pick_seat: Optional[dict[str, Any]] = None
    if i.seat:
        pick_seat = next((s for s in open_seats if s["seat"] == i.seat.upper()), None)
        if pick_seat is None:
            sug = seat_suggestions(state.seat_map)
            return fail("seat_unavailable", "That seat is taken or does not exist. Offer one of these instead.", {"bestWindow": sug["bestWindow"], "bestAisle": sug["bestAisle"]})
    else:
        sug = seat_suggestions(state.seat_map)
        pick_seat = {"window": sug["bestWindow"], "aisle": sug["bestAisle"], "exit_row": sug["exitRow"]}.get(i.preference or "", None) or next((s for s in open_seats if s["position"] == "middle"), None)
        if pick_seat is None:
            return fail("no_such_seat", "No open seat of that kind. Offer what is open instead.", {"bestWindow": sug["bestWindow"], "bestAisle": sug["bestAisle"]})
    service_id, amount, currency = state.seat_services[pick_seat["seat"]]
    state.seat = {**pick_seat, "amount": amount, "currency": currency}
    state.review, state.read_back = None, None
    state.stage = "seat"
    return ok(f"Seat {pick_seat['seat']} · {pick_seat['position']} · {pick_seat['price']}", {"seat": pick_seat["seat"], "position": pick_seat["position"], "exitRow": pick_seat["exitRow"], "price": pick_seat["price"], "next": "Confirm the seat in a few words, then ask about bags."}, True)


class AddBags(BaseModel):
    count: int = Field(ge=0, le=3, description="Extra checked bags to add for the lead traveller (0 removes them).")


async def add_bags(state: TravelState, i: AddBags, ctx: OpContext) -> OpResult:
    if state.offer is None or state.bags is None:
        return fail("no_flight", "Choose a flight first with choose_flight.")
    bag = extra_bag_service(state.offer)
    if i.count and bag is None:
        return fail("no_extra_bags", f"This airline does not sell extra bags here. The fare includes {state.bags['included']}.")
    if bag is not None and i.count > (bag.get("maximum_quantity") or 1):
        return fail("too_many_bags", f"At most {bag.get('maximum_quantity') or 1} extra checked bag can be added.")
    amount = f"{float(bag['total_amount']) * i.count:.2f}" if bag else "0.00"
    state.bags = {**state.bags, "added": i.count, "amount": amount, "total": money(amount, bag["total_currency"]) if bag else None}
    state.review, state.read_back = None, None
    state.stage = "bags"
    return ok(f"{i.count} extra bag{'s' if i.count != 1 else ''}" + (f" · {state.bags['total']}" if i.count else ""), {"included": state.bags["included"], "extraBags": i.count, "extraBagsCost": state.bags.get("total"), "next": "Confirm briefly, then ask for the lead traveller's full name."}, True)


class SetTraveller(BaseModel):
    fullName: str = Field(min_length=2, max_length=80, description="Lead traveller's full name as the caller gave it.")


async def set_traveller(state: TravelState, i: SetTraveller, ctx: OpContext) -> OpResult:
    if state.offer is None:
        return fail("no_flight", "Choose a flight first with choose_flight.")
    name = re.sub(r"\s+", " ", i.fullName.strip())
    state.traveller = {"name": name, **SAMPLE_TRAVELLER, "sample": ["bornOn", "email", "phone"]}
    state.review, state.read_back = None, None
    state.stage = "traveller"
    return ok(f"Traveller · {name}", {"traveller": name, "otherDetails": "Filled with clearly marked samples in this demo; do not ask for them.", "next": "Call review_booking."}, True)


async def review_booking(state: TravelState, i: NoArgs, ctx: OpContext) -> OpResult:
    if state.offer is None or state.selected is None:
        return fail("no_flight", "Choose a flight first with choose_flight.")
    if state.traveller is None:
        return fail("no_traveller", "Ask for the lead traveller's full name and call set_traveller first.")
    try:
        fresh = await duffel.get_offer(state.offer["id"])
    except duffel.DuffelError as err:
        return duffel_failure(err)
    cur = fresh["total_currency"]
    fare_amount = float(fresh["total_amount"])
    seat_amount = float(state.seat["amount"]) if state.seat else 0.0
    bags_amount = float((state.bags or {}).get("amount") or 0)
    total = f"{fare_amount + seat_amount + bags_amount:.2f}"
    chosen = _option(state, state.selected)
    assert chosen is not None
    out = chosen["journeys"][0]
    back = chosen["journeys"][1] if len(chosen["journeys"]) > 1 else None
    state.review = {
        "airline": chosen["airline"],
        "outbound": f"{out['date']}, {out['departs']} from {out['fromName']}, arriving {out['arrives']}" + (" the next day" if out["arrivesNextDay"] else ""),
        "return": f"{back['date']}, {back['departs']} from {back['fromName']}" if back else None,
        "fare": f"{state.details['fareBrand']} · {money(fresh['total_amount'], cur)}",  # type: ignore[index]
        "fareChanged": fresh["total_amount"] != state.offer["total_amount"],
        "seat": f"{state.seat['seat']} ({state.seat['position']}) · {state.seat['price']}" if state.seat else "Assigned at check-in",
        "bags": (state.bags or {}).get("included", "") + (f" + {state.bags['added']} extra · {state.bags['total']}" if state.bags and state.bags.get("added") else ""),
        "traveller": state.traveller["name"],
        "total": money(total, cur),
        "amount": total,
    }
    state.read_back = {"option": state.selected, "travellerName": state.traveller["name"], "price": state.review["total"]}
    state.stage = "review"
    return ok(f"Review · total {state.review['total']}", {"review": {k: v for k, v in state.review.items() if k != "amount" and v is not None}, "next": "Read the booking back clearly with the total, and ask whether everything is correct."}, True)


async def book_flight(state: TravelState, i: NoArgs, ctx: OpContext) -> OpResult:
    """After the caller's yes to the review: everything is ready, and the demo stops at payment."""
    if state.review is None or state.traveller is None:
        return fail("not_reviewed", "Call review_booking and read it back first; book only after the caller says yes.")
    state.stage = "payment"
    state.booking = {"option": state.selected, "travellerName": state.traveller["name"], "price": state.review["total"], "status": "not_booked_test_mode"}
    r = fail("test_mode", f'Everything up to payment is done; this demo runs in test mode, so nothing is booked or paid. Say exactly: "{PAYMENT_LINE}" Then ask whether there is anything else.', {"notBooked": True, "total": state.review["total"]})
    r.summary = "Stopped at payment · test mode"
    r.changed = True
    return r


class EmailItinerary(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it, e.g. 'alex.taylor@example.com'.")
    callerConfirmed: bool = Confirmed()


async def email_itinerary(state: TravelState, i: EmailItinerary, ctx: OpContext) -> OpResult:
    """Emails the reviewed itinerary to the caller: once per call, from a fixed template."""
    if state.review is None:
        return fail("not_reviewed", "There is no reviewed itinerary to send yet.")
    if state.emailed:
        return fail("already_sent", f"The itinerary was already emailed to {state.emailed['to']} on this call.")
    address = email.normalise(i.email)
    if address is None:
        return fail("invalid_email", "That doesn't look like a complete email address. Ask the caller to say it again, slowly.")
    r = state.review
    rows = [("Flights", f"{r['airline']} · {r['outbound']}"), ("Return", r.get("return") or ""), ("Fare", r["fare"]), ("Seat", r["seat"]), ("Bags", r["bags"]), ("Traveller", r["traveller"])]
    body, text = email.page("Waypoint Travel", "Your flight itinerary", "Here's the trip we put together on the phone. It's a quote, not a booking: in this demo we stop before payment.", rows, r["total"], "Linda")
    why = await email.send(address, f"Your Waypoint Travel itinerary · {r['total']}", body, text, "Linda at Waypoint Travel")
    if why == "too_many_for_address":
        return fail(why, "That address has already had several emails from our demos today. Apologise and offer nothing further by email.")
    if why:
        return fail("email_failed", "The email could not be sent right now. Apologise briefly.")
    state.emailed = {"to": email.mask(address), "total": r["total"]}
    return ok(f"Itinerary emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"]}, True)


def view(state: TravelState) -> dict[str, Any]:
    return {
        "stage": state.stage,
        "search": ({**state.search, "label": search_label(state.search), "originName": state.places.get(state.search["origin"]), "destinationName": state.places.get(state.search["destination"])} if state.search else None),
        "options": [{k: v for k, v in o.items() if k != "offerId"} for o in state.options],
        "selected": state.selected,
        "details": state.details,
        "fareLevels": [{k: v for k, v in lv.items() if k != "offerId"} for lv in state.fare_levels],
        "seatMap": state.seat_map,
        "seat": state.seat and {k: v for k, v in state.seat.items() if k not in ("amount", "currency")},
        "bags": state.bags and {k: v for k, v in state.bags.items() if k != "amount"},
        "traveller": state.traveller,
        "review": state.review and {k: v for k, v in state.review.items() if k != "amount"},
        "readBack": state.read_back,
        "booking": state.booking,
        "emailed": state.emailed,
    }


travel: DemoDefinition[TravelState] = DemoDefinition(
    id="travel",
    business_name="Waypoint Travel",
    agent_name="Linda",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="friendly, warm and efficient, at an easy conversational pace",
    fixed_lines=[OPENING_PHONE, OPENING_WEB, PAYMENT_LINE],
    vocabulary=["Waypoint", "Heathrow", "Gatwick", "Stansted", "JFK", "LaGuardia", "Newark", "LAX", "O'Hare", "Lufthansa", "British Airways", "economy", "premium economy", "business class", "first class", "one way", "round trip", "nonstop", "layover", "window", "aisle", "exit row", "checked bag", "carry-on"],
    operations={
        "find_places": Operation("Looking up airports", "Airports and cities matching a name or code, with their codes.", find_places, FindPlaces),
        "search_flights": Operation("Searching flights", "Search airline fares with the caller's preferences. Returns a labelled short list of up to three options.", search_flights, SearchFlights, slow=True),
        "choose_flight": Operation("Checking the fare", "Choose an option from the short list: current price, what the fare includes, and the other fare levels on the same flights.", choose_flight, OptionRef),
        "choose_fare": Operation("Changing the fare", "Switch to another fare level on the same flights.", choose_fare, ChooseFare),
        "get_seats": Operation("Opening the seat map", "The airline's seat map for the first flight: open seats, the best window and aisle, and the exit row, with prices.", get_seats, NoArgs),
        "choose_seat": Operation("Choosing a seat", "Choose a seat by number or by kind (window, aisle, middle, exit row).", choose_seat, ChooseSeat),
        "add_bags": Operation("Adding bags", "Add extra checked bags for the lead traveller, at the airline's price.", add_bags, AddBags),
        "set_traveller": Operation("Adding the traveller", "The lead traveller's full name; the rest is filled with marked samples.", set_traveller, SetTraveller),
        "review_booking": Operation("Reviewing the booking", "Re-check the price live and return the whole booking with the total, to read back.", review_booking, NoArgs),
        "book_flight": Operation("Taking payment", "After the caller confirms the review: complete the booking. In this demo it stops at payment.", book_flight, NoArgs),
        "email_itinerary": Operation("Emailing the itinerary", "Email the reviewed itinerary to the caller, after they confirm the address read back to them. Once per call.", email_itinerary, EmailItinerary),
    },
)
