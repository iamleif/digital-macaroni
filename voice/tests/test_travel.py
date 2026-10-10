from datetime import datetime, timezone
from typing import Any

import pytest

from app import duffel
from app.cascade import Chunker, finished, spoken_code
from app.demos.travel import duration, money, travel
from app.demos.types import OpContext, OpResult

# A Thursday morning in New York.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="browser")


def segment(carrier: str, number: str, origin: str, destination: str, departs: str, arrives: str) -> dict[str, Any]:
    return {
        "marketing_carrier": {"iata_code": carrier, "name": {"BA": "British Airways", "AA": "American Airlines", "ZZ": "Duffel Airways"}[carrier]},
        "marketing_carrier_flight_number": number,
        "origin": {"iata_code": origin, "name": f"{origin} Airport"},
        "destination": {"iata_code": destination, "name": f"{destination} Airport"},
        "departing_at": departs,
        "arriving_at": arrives,
        "passengers": [{"baggages": [{"type": "checked", "quantity": 1}, {"type": "carry_on", "quantity": 1}]}],
    }


def offer(oid: str, amount: str, owner: str, segments: list[dict[str, Any]], dur: str) -> dict[str, Any]:
    return {
        "id": oid,
        "total_amount": amount,
        "total_currency": "USD",
        "owner": {"name": owner},
        "slices": [{"duration": dur, "segments": segments, "fare_brand_name": "Basic"}],
        "conditions": {"refund_before_departure": {"allowed": False}, "change_before_departure": {"allowed": True, "penalty_amount": "70.00", "penalty_currency": "USD"}},
    }


def brand(o: dict[str, Any], name: str, amount: str, oid: str, bags: int = 1) -> dict[str, Any]:
    """The same flights at another fare level."""
    segs = [{**seg, "passengers": [{"baggages": [{"type": "checked", "quantity": bags}, {"type": "carry_on", "quantity": 1}]}]} for seg in o["slices"][0]["segments"]]
    return {**o, "id": oid, "total_amount": amount, "slices": [{**o["slices"][0], "fare_brand_name": name, "segments": segs}], "conditions": {"refund_before_departure": {"allowed": True, "penalty_amount": "0", "penalty_currency": "USD"}, "change_before_departure": {"allowed": True, "penalty_amount": "0", "penalty_currency": "USD"}}}


OFFERS = [
    offer("off_1", "399.79", "Duffel Airways", [segment("ZZ", "10", "LHR", "KEF", "2026-10-09T06:00:00", "2026-10-09T08:00:00"), segment("ZZ", "11", "KEF", "JFK", "2026-10-09T09:00:00", "2026-10-09T11:00:00")], "PT10H"),
    offer("off_2", "399.79", "Duffel Airways", [segment("ZZ", "10", "LHR", "KEF", "2026-10-09T06:00:00", "2026-10-09T08:00:00"), segment("ZZ", "11", "KEF", "JFK", "2026-10-09T09:00:00", "2026-10-09T11:00:00")], "PT10H"),
    offer("off_3", "411.00", "British Airways", [segment("BA", "117", "LHR", "JFK", "2026-10-09T08:20:00", "2026-10-09T11:05:00")], "PT7H45M"),
    offer("off_4", "450.00", "American Airlines", [segment("AA", "101", "LHR", "JFK", "2026-10-09T18:00:00", "2026-10-09T20:40:00")], "PT7H40M"),
    offer("off_5", "520.00", "American Airlines", [segment("AA", "107", "LHR", "JFK", "2026-10-09T21:00:00", "2026-10-10T00:10:00")], "PT8H10M"),
]
OFFERS.append(brand(OFFERS[2], "Economy Comfort", "456.00", "off_3c", bags=2))
for o in OFFERS:
    for i, seg in enumerate(o["slices"][0]["segments"]):
        seg["id"] = f"seg_{o['id'][-1]}_{i}"

BAG = {"type": "baggage", "id": "ase_bag", "total_amount": "20.00", "total_currency": "USD", "maximum_quantity": 1, "metadata": {"type": "checked", "maximum_weight_kg": 23}}


def seat(designator: str, price: str | None) -> dict[str, Any]:
    return {"type": "seat", "designator": designator, "available_services": [] if price is None else [{"id": f"ase_{designator}", "total_amount": price, "total_currency": "USD"}]}


SEAT_MAP = {
    "segment_id": "seg_3_0",
    "cabins": [{"cabin_class": "economy", "aisles": 1, "wings": None, "rows": [
        {"sections": [{"elements": [seat("10A", "25.00"), seat("10B", None)]}, {"elements": [seat("10C", "0"), seat("10D", "0")]}]},
        {"sections": [{"elements": [{"type": "exit_row"}]}, {"elements": [{"type": "exit_row"}]}]},
        {"sections": [{"elements": [seat("11A", "45.00"), seat("11B", "45.00")]}, {"elements": [seat("11C", None), seat("11D", "45.00")]}]},
        {"sections": [{"elements": [{"type": "lavatory"}]}, {"elements": [{"type": "galley"}]}]},
    ]}],
}


@pytest.fixture
def fake_duffel(monkeypatch):
    calls: dict[str, int] = {"search": 0, "offer": 0, "seat_maps": 0, "slices": []}

    async def search_offers(slices, adults, cabin, max_connections):
        calls["search"] += 1
        calls["slices"] = slices
        return OFFERS

    async def get_offer(oid, services=False):
        calls["offer"] += 1
        o = next(o for o in OFFERS if o["id"] == oid)
        return o | {"total_amount": "415.00" if oid == "off_3" else o["total_amount"], "available_services": [BAG] if services else None}

    async def seat_maps(oid):
        calls["seat_maps"] += 1
        return [SEAT_MAP] if oid.startswith("off_3") else []

    monkeypatch.setattr(duffel, "search_offers", search_offers)
    monkeypatch.setattr(duffel, "get_offer", get_offer)
    monkeypatch.setattr(duffel, "seat_maps", seat_maps)
    return calls


def runner():
    state = travel.create_state(NOW)

    async def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = travel.operations[op]
        return await o.run(state, o.params.model_validate(args or {}), CTX)  # type: ignore[misc,union-attr]

    return state, run


SEARCH = {"origin": "lhr", "destination": "JFK", "departureDate": "2026-10-09"}


async def test_offers_a_labelled_short_list_led_by_what_the_caller_cares_about(fake_duffel):
    state, run = runner()
    r = await run("search_flights", {**SEARCH, "priority": "fastest"})
    short = r.result["shortlist"]
    assert r.ok and len(short) == 3 and "found" not in r.result
    assert short[0]["airline"] == "American Airlines" and short[0]["label"] == "Fastest"
    assert {o["label"] for o in short} == {"Fastest", "Cheapest", "Best value"}
    # The same flights at another fare are one option, at their cheapest fare.
    assert sum(1 for o in short if o["airline"] == "Duffel Airways") <= 1
    cheapest = await run("search_flights", {**SEARCH, "priority": "cheapest"})
    assert cheapest.result["shortlist"][0]["price"] == "$399.79"
    assert "offerId" not in str(travel.view(state))


async def test_time_of_day_and_airline_preferences_shape_the_search(fake_duffel):
    _, run = runner()
    r = await run("search_flights", {**SEARCH, "returnDate": "2026-10-16", "departTime": "morning", "returnTime": "evening", "airline": "american"})
    assert fake_duffel["slices"][0]["departure_time"] == {"from": "05:00", "to": "11:59"}
    assert fake_duffel["slices"][1]["departure_time"] == {"from": "17:00", "to": "23:59"}
    assert {o["airline"] for o in r.result["shortlist"]} == {"American Airlines"}


async def test_refuses_past_dates_and_returns_before_departure_without_calling_duffel(fake_duffel):
    _, run = runner()
    assert (await run("search_flights", {**SEARCH, "departureDate": "2025-10-09"})).error == "date_in_past"
    assert (await run("search_flights", {**SEARCH, "returnDate": "2026-10-08"})).error == "return_before_departure"
    assert fake_duffel["search"] == 0


def _option_for(state, airline: str) -> int:
    return next(o["option"] for o in state.options if o["airline"] == airline)


async def test_choosing_a_flight_gives_its_fare_and_the_fare_level_up(fake_duffel):
    state, run = runner()
    await run("search_flights", {**SEARCH, "priority": "best"})
    ba = _option_for(state, "British Airways")
    r = await run("choose_flight", {"option": ba})
    assert r.ok and r.result["fare"]["price"] == "$415" and r.result["fare"]["priceChanged"] is True
    levels = r.result["fareLevels"]
    assert [lv["brand"] for lv in levels] == ["Basic", "Economy Comfort"] and levels[1]["difference"] == "$41"
    assert r.result["extraCheckedBag"] == "$20"
    up = await run("choose_fare", {"fare": "comfort"})
    assert up.ok and state.details["fareBrand"] == "Economy Comfort" and state.details["refund"] == "Refundable free of charge"
    assert "2 checked bags" in state.details["baggage"]


async def test_seat_map_offers_real_seats_and_books_by_number_or_kind(fake_duffel):
    state, run = runner()
    await run("search_flights", SEARCH)
    await run("choose_flight", {"option": _option_for(state, "British Airways")})
    r = await run("get_seats")
    assert r.ok and r.result["openSeats"] == 6 and r.result["freeSeats"] == 2
    # Free seats come first: 10D is a free window (10A is a window too, at $25); 10C a free aisle.
    assert r.result["bestWindow"]["seat"] == "10D" and r.result["bestWindow"]["price"] == "free"
    assert r.result["bestAisle"]["seat"] == "10C" and r.result["bestAisle"]["price"] == "free"
    assert r.result["exitRow"]["seat"] in ("11A", "11B", "11D")
    # The dashboard gets the whole map: seats free, paid and taken, facilities, the exit row.
    rows = travel.view(state)["seatMap"]["rows"]
    assert rows[0]["sections"][0][1] == {"id": "10B", "st": "taken"} and rows[2]["exit"] is True and rows[3]["sections"][0][0] == {"type": "lavatory"}
    taken = await run("choose_seat", {"seat": "10B"})
    assert not taken.ok and taken.error == "seat_unavailable"
    window = await run("choose_seat", {"preference": "window"})
    assert window.ok and state.seat["seat"] == "10D" and state.seat["price"] == "free"
    paid = await run("choose_seat", {"seat": "10a"})
    assert paid.ok and state.seat["seat"] == "10A" and state.seat["position"] == "window" and state.seat["price"] == "$25"
    assert "ase_" not in str(travel.view(state))
    # Never a different seat than the one asked for: no seat named means no change.
    nothing = await run("choose_seat", {})
    assert not nothing.ok and nothing.error == "no_seat_named" and state.seat["seat"] == "10A"


def test_linda_gets_eight_minutes():
    assert travel.max_seconds == 480


async def test_an_airline_without_a_seat_map_assigns_seats_at_check_in(fake_duffel):
    state, run = runner()
    await run("search_flights", SEARCH)
    await run("choose_flight", {"option": _option_for(state, "American Airlines")})
    r = await run("get_seats")
    assert r.ok and r.result["seatMap"] is False and state.seat_map is None


async def test_full_booking_reviews_the_total_then_stops_at_payment(fake_duffel):
    state, run = runner()
    await run("search_flights", SEARCH)
    assert (await run("book_flight")).error == "not_reviewed"
    await run("choose_flight", {"option": _option_for(state, "British Airways")})
    await run("get_seats")
    await run("choose_seat", {"seat": "10A"})
    bags = await run("add_bags", {"count": 1})
    assert bags.ok and state.bags["total"] == "$20"
    assert (await run("add_bags", {"count": 2})).error == "too_many_bags"
    await run("set_traveller", {"fullName": "Jamie  Fox"})
    assert state.traveller["name"] == "Jamie Fox" and state.traveller["email"] == "traveller@example.com" and "email" in state.traveller["sample"]
    review = await run("review_booking")
    # Fare 415 + seat 25 + bag 20, with the fare re-checked live.
    assert review.ok and review.result["review"]["total"] == "$460" and state.stage == "review"
    paid = await run("book_flight")
    assert not paid.ok and paid.error == "test_mode" and "This is where I'd take payment" in paid.message
    assert state.booking["status"] == "not_booked_test_mode" and state.stage == "payment" and paid.changed


async def test_duffel_failures_become_plain_instructions(monkeypatch):
    async def timeout(*_):
        raise duffel.DuffelError("timeout")

    monkeypatch.setattr(duffel, "search_offers", timeout)
    _, run = runner()
    r = await run("search_flights", SEARCH)
    assert not r.ok and r.error == "timeout" and "try again" in r.message


def test_formats_money_and_durations():
    assert money("412.50", "USD") == "$412.50" and money("400.00", "GBP") == "£400" and money("99", "SEK") == "99 SEK"
    assert duration("PT7H45M") == "7h 45m" and duration("P1DT2H") == "26h" and duration("PT50M") == "50m"


def test_chunker_speaks_the_first_sentence_then_the_rest_together():
    c = Chunker()
    pieces = []
    for token in ["Sure, I can ", "help with that, ", "no problem. I found ", "five flights. The ", "cheapest is $399.79 with Iberia."]:
        pieces += c.feed(token)
    pieces += c.flush()
    assert pieces == ["Sure, I can help with that, no problem.", "I found five flights. The cheapest is $399.79 with Iberia."]


@pytest.mark.parametrize("text", ["Yes.", "Just me, economy.", "Hi, I'd like to fly from London to New York next Friday.", "Can you check Saturday?", "My name is Jamie Fox."])
def test_a_finished_sentence_ends_the_turn(text):
    assert finished(text)


@pytest.mark.parametrize("text", ["I'd like to fly from London to New York and", "My name is", "Hi, I'd like to fly from", "Coming back on the 27th,", "um", ""])
def test_a_trailing_transcript_waits_for_more(text):
    assert not finished(text)


@pytest.mark.parametrize("text", ["8946", "8946.", "8 9 4 6", "Eight nine four six.", "It's 8946.", "The code is eight, nine, four, six.", "8, 9, 4, 6"])
def test_a_spoken_screen_code_is_recognised(text):
    assert spoken_code(text) == "8946"


@pytest.mark.parametrize("text", ["Hi, I'd like to fly from London to New York on November 20th 2026, one way, just me.", "Just me, economy.", "894", "89461", "I paid 1200 dollars and 4000 more", "Two adults."])
def test_ordinary_speech_is_not_taken_for_a_code(text):
    assert spoken_code(text) is None


def test_a_number_on_its_own_counts_as_something_said():
    assert finished("8946") and finished("8 9 4 6")


@pytest.mark.parametrize("spoken,expected", [("alex.taylor@example.com", "alex.taylor@example.com"), ("Alex dot Taylor at Gmail dot com", "alex.taylor@gmail.com"), ("jamie underscore fox at outlook dot co dot uk", "jamie_fox@outlook.co.uk"), ("not an email", None), ("alex at gmail", None)])
def test_spoken_email_addresses_are_normalised(spoken, expected):
    from app import email
    assert email.normalise(spoken) == expected


async def test_itinerary_email_is_sent_once_from_the_reviewed_booking(fake_duffel, monkeypatch):
    from app import email
    sent: list[tuple[str, str]] = []

    async def send(to, subject, html_body, text_body, from_name):
        sent.append((to, text_body))
        return None

    monkeypatch.setattr(email, "send", send)
    state, run = runner()
    await run("search_flights", SEARCH)
    early = await run("email_itinerary", {"email": "alex@example.com", "callerConfirmed": True})
    assert early.error == "not_reviewed" and not sent
    await run("choose_flight", {"option": _option_for(state, "British Airways")})
    await run("set_traveller", {"fullName": "Alex Taylor"})
    await run("review_booking")
    bad = await run("email_itinerary", {"email": "alex at example", "callerConfirmed": True})
    assert bad.error == "invalid_email" and not sent
    r = await run("email_itinerary", {"email": "Alex dot Taylor at example dot com", "callerConfirmed": True})
    assert r.ok and r.result["to"] == "a•••r@example.com" and travel.view(state)["emailed"]["to"] == "a•••r@example.com"
    assert sent[0][0] == "alex.taylor@example.com" and "Alex Taylor" in sent[0][1] and "Total: $415" in sent[0][1] and "nothing was booked" in sent[0][1]
    again = await run("email_itinerary", {"email": "other@example.com", "callerConfirmed": True})
    assert again.error == "already_sent" and len(sent) == 1
    assert "alex.taylor" not in str(travel.view(state))


def test_email_limits_per_address(monkeypatch):
    from app import email
    monkeypatch.setattr(email, "_by_address", {})
    monkeypatch.setattr(email, "_recent", [])
    for _ in range(email.EMAILS_PER_ADDRESS_PER_DAY):
        assert email.allowed("a@example.com") is None
        email._by_address.setdefault(email._key("a@example.com"), []).append(__import__("time").time())
    assert email.allowed("a@example.com") == "too_many_for_address" and email.allowed("b@example.com") is None
