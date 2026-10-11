"""Linda's operations at Waypoint: plain functions over one call's state, tested without a model or the airline."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, add_days, already_sent, date_label, fail, mask_number, ok, reference, send_summary
from . import store
from .prompt import PAYMENT_LINE
from .state import (
    IATA,
    MAX_OPTIONS,
    Cabin,
    Priority,
    TimeOfDay,
    TravelState,
    brief,
    compact_seat_map,
    extra_bag_service,
    fare_summary,
    flight_key,
    money,
    seat_suggestions,
    seats_in,
    shortlist,
    summarise,
)
from .store import MAX_DAYS_AHEAD, SAMPLE_TRAVELLER, TIME_WINDOWS, DuffelError

DUFFEL_FAILURES = {
    "timeout": "The airline search took too long. Apologise and offer to try again, perhaps with nearby dates.",
    "rate_limited": "The flight system is busy. Apologise and offer to try again in a moment.",
    "network": "The flight system could not be reached. Apologise and offer to try again.",
    "not_configured": "Flight search is not available right now. Apologise briefly.",
    "rejected": "The airline system did not accept that. Check the details with the caller.",
    "not_found": "That fare is no longer available. Offer to search again.",
}


def duffel_failure(err: DuffelError) -> OpResult:
    return fail(err.kind, DUFFEL_FAILURES.get(err.kind, DUFFEL_FAILURES["network"]))


class FindPlaces(BaseModel):
    query: str = Field(min_length=2, max_length=60, description="A city, airport name or airport code, e.g. 'London' or 'JFK'.")


async def find_places(state: TravelState, i: FindPlaces, ctx: OpContext) -> OpResult:
    try:
        places = await store.suggest_places(i.query)
    except DuffelError as err:
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
        offers = await store.search_offers(slices, i.adults, i.cabinClass, 0 if i.nonstopOnly else 1)
    except DuffelError as err:
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
        offer = await store.get_offer(chosen["offerId"], services=True)
    except DuffelError as err:
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
        offer = await store.get_offer(level["offerId"], services=True)
    except DuffelError as err:
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
        maps = await store.seat_maps(state.offer["id"])
    except DuffelError as err:
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
    seat: Optional[str] = Field(None, pattern=r"^\d{1,2}[A-Ka-k]$", description="The seat number the caller named, e.g. '28A'. Whenever they name a seat, pass it here, never a preference.")
    preference: Optional[Literal["window", "aisle", "middle", "exit_row"]] = Field(None, description="Only when the caller asked for a kind of seat without naming one.")


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
    elif i.preference:
        sug = seat_suggestions(state.seat_map)
        # Never a different kind of seat than the one asked for.
        pick_seat = {"window": sug["bestWindow"], "aisle": sug["bestAisle"], "exit_row": sug["exitRow"]}.get(i.preference) if i.preference != "middle" else next((s for s in open_seats if s["position"] == "middle"), None)
        if pick_seat is None:
            return fail("no_such_seat", "No open seat of that kind. Offer what is open instead.", {"bestWindow": sug["bestWindow"], "bestAisle": sug["bestAisle"]})
    else:
        return fail("no_seat_named", "Pass the seat number the caller named, or the kind of seat they asked for.")
    service_id, amount, currency = state.seat_services[pick_seat["seat"]]
    state.seat = {**pick_seat, "amount": amount, "currency": currency}
    state.review, state.read_back = None, None
    state.stage = "seat"
    return ok(f"Seat {pick_seat['seat']} · {pick_seat['position']} · {pick_seat['price']}", {"seat": pick_seat["seat"], "position": pick_seat["position"], "exitRow": pick_seat["exitRow"], "price": pick_seat["price"], "next": "Say the seat back in a few words (number, window or aisle, price) so the caller can correct it, then ask about bags."}, True)


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
        fresh = await store.get_offer(state.offer["id"])
    except DuffelError as err:
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
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP)
    callerConfirmed: bool = Confirmed()


async def email_itinerary(state: TravelState, i: EmailItinerary, ctx: OpContext) -> OpResult:
    """Emails the caller the reviewed itinerary, or a summary of the call when there is none."""
    kind = "booking" if state.review else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if state.review is None:
        messages = [message_view(m) for m in state.messages]
        name = (state.traveller or {}).get("name") or (state.messages[-1]["name"] if state.messages else None)
        res, sent = await send_summary("travel", "Linda", i.email, i.recap, name, messages, did="searched live airline fares and looked after your request")
        if sent:
            state.emailed = sent
        return res
    r = state.review
    chosen = _option(state, state.selected) if state.selected else None
    trip = {
        "journeys": chosen["journeys"] if chosen else [],
        "fare": r["fare"],
        "seat": r["seat"],
        "bags": r["bags"],
        "traveller": r["traveller"],
        "total": r["total"],
        "changes": (state.details or {}).get("changes", ""),
        "refund": (state.details or {}).get("refund", ""),
        "airlineLogo": chosen.get("airlineLogo") if chosen else None,
    }
    masked, why = await email.confirm(i.email, email.flight_itinerary(trip))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "total": r["total"], "kind": "booking"}
    return ok(f"Itinerary emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"]}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80, description="The caller's name as they gave it.")
    callbackNumber: str = Field(min_length=7, max_length=20, description="The number the caller confirmed for the call back.")
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two: e.g. a group of nine flying New York to Lisbon in June.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")


def take_message(state: TravelState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m["summary"] == i.summary.strip() and m["name"] == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup['id']}", {"messageId": dup["id"], "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append({"id": mid, "name": i.name.strip(), "callback": i.callbackNumber.strip(), "summary": i.summary.strip(), "preferredTime": (i.preferredTime or "").strip() or None, "at": ctx.now.isoformat()})
    return ok(f"Message for an agent · {mid}", {"messageId": mid, "callsBack": "An agent calls back within one business day."}, True)


def message_view(m: dict[str, Any]) -> dict[str, Any]:
    return {"id": m["id"], "name": m["name"], "summary": m["summary"], "preferredTime": m["preferredTime"], "callback": mask_number(m["callback"])}
