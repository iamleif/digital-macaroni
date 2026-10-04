from datetime import datetime, timezone
from typing import Any

import pytest

from app import duffel
from app.cascade import Chunker, finished
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


OFFERS = [
    offer("off_1", "399.79", "Duffel Airways", [segment("ZZ", "10", "LHR", "KEF", "2026-10-09T06:00:00", "2026-10-09T08:00:00"), segment("ZZ", "11", "KEF", "JFK", "2026-10-09T09:00:00", "2026-10-09T11:00:00")], "PT10H"),
    offer("off_2", "399.79", "Duffel Airways", [segment("ZZ", "10", "LHR", "KEF", "2026-10-09T06:00:00", "2026-10-09T08:00:00"), segment("ZZ", "11", "KEF", "JFK", "2026-10-09T09:00:00", "2026-10-09T11:00:00")], "PT10H"),
    offer("off_3", "411.00", "British Airways", [segment("BA", "117", "LHR", "JFK", "2026-10-09T08:20:00", "2026-10-09T11:05:00")], "PT7H45M"),
    offer("off_4", "450.00", "American Airlines", [segment("AA", "101", "LHR", "JFK", "2026-10-09T18:00:00", "2026-10-09T20:40:00")], "PT7H40M"),
    offer("off_5", "520.00", "American Airlines", [segment("AA", "107", "LHR", "JFK", "2026-10-09T21:00:00", "2026-10-10T00:10:00")], "PT8H10M"),
]


@pytest.fixture
def fake_duffel(monkeypatch):
    calls: dict[str, int] = {"search": 0, "offer": 0}

    async def search_offers(slices, adults, cabin, max_connections):
        calls["search"] += 1
        return OFFERS

    async def get_offer(oid):
        calls["offer"] += 1
        return next(o for o in OFFERS if o["id"] == oid) | {"total_amount": "405.00"}

    monkeypatch.setattr(duffel, "search_offers", search_offers)
    monkeypatch.setattr(duffel, "get_offer", get_offer)
    return calls


def runner():
    state = travel.create_state(NOW)

    async def run(op: str, args: dict[str, Any]) -> OpResult:
        o = travel.operations[op]
        return await o.run(state, o.params.model_validate(args), CTX)  # type: ignore[misc,union-attr]

    return state, run


SEARCH = {"origin": "lhr", "destination": "JFK", "departureDate": "2026-10-09"}


async def test_lists_distinct_options_cheapest_first_with_the_fastest_included(fake_duffel):
    state, run = runner()
    r = await run("search_flights", SEARCH)
    assert r.ok and r.result["found"] == 5
    options = r.result["options"]
    # The two identical Duffel Airways fares collapse into one.
    assert [o["airline"] for o in options] == ["Duffel Airways", "British Airways", "American Airlines"]
    assert options[0]["outbound"]["stops"] == 1 and options[1]["outbound"]["stops"] == 0
    assert r.result["fromPrice"] == "$399.79"
    assert "offerId" not in str(options) and "offerId" not in str(travel.view(state))


async def test_refuses_past_dates_and_returns_before_departure_without_calling_duffel(fake_duffel):
    _, run = runner()
    assert (await run("search_flights", {**SEARCH, "departureDate": "2025-10-09"})).error == "date_in_past"
    assert (await run("search_flights", {**SEARCH, "returnDate": "2026-10-08"})).error == "return_before_departure"
    assert fake_duffel["search"] == 0


async def test_details_report_the_current_fare_and_rules(fake_duffel):
    state, run = runner()
    await run("search_flights", SEARCH)
    r = await run("get_offer_details", {"option": 2})
    assert r.ok and r.result["price"] == "$405" and r.result["priceChanged"] is True
    assert r.result["refund"] == "Not refundable" and r.result["changes"] == "Changeable for a fee of $70"
    assert state.selected == 2


async def test_booking_reads_back_first_then_stops_in_test_mode_and_never_books(fake_duffel):
    state, run = runner()
    await run("search_flights", SEARCH)
    first = await run("book_flight", {"option": 2, "travellerName": "Jamie  Fox"})
    assert first.ok and first.result["booked"] is False and first.result["readBack"]["traveller"] == "Jamie Fox"
    assert state.booking is None and fake_duffel["offer"] == 0
    second = await run("book_flight", {"option": 2, "travellerName": "jamie fox"})
    assert not second.ok and second.error == "test_mode" and second.result["notBooked"] is True
    assert "I'm sorry, I'm in test mode" in second.message
    assert state.booking["status"] == "not_booked_test_mode" and second.changed
    # The fare was re-checked, as a real booking would, and nothing else was called.
    assert fake_duffel["offer"] == 1


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
