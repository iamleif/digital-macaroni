from datetime import datetime, timezone
from typing import Any

import pytest

from app.demos.realestate import realestate, store
from app.demos.types import OpContext, OpResult

# A Thursday morning in Austin.
NOW = datetime(2026, 10, 1, 15, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="phone")
SATURDAY = "2026-10-03"

# Test homes (the real file is a RentCast snapshot that changes with every refresh).
HOMES = [
    {"id": "JR-1", "address": "1204 Clarkson Ave", "street": "Clarkson Ave", "city": "Austin", "zip": "78751", "area": "central", "type": "Single Family", "price": 689000, "beds": 3, "baths": 2, "sqft": 1610, "lotSqft": 6100, "yearBuilt": 1938, "hoaFee": None, "newConstruction": False, "daysOnMarket": 12},
    {"id": "JR-2", "address": "4410 Avenue F", "street": "Avenue F", "city": "Austin", "zip": "78751", "area": "central", "type": "Single Family", "price": 945000, "beds": 4, "baths": 3, "sqft": 2240, "lotSqft": 7000, "yearBuilt": 1946, "hoaFee": None, "newConstruction": False, "daysOnMarket": 30},
    {"id": "JR-3", "address": "1907 Aldrich St Unit 204", "street": "Aldrich St Unit", "city": "Austin", "zip": "78723", "area": "east", "type": "Condo", "price": 412000, "beds": 2, "baths": 2, "sqft": 1080, "lotSqft": None, "yearBuilt": 2019, "hoaFee": 310, "newConstruction": False, "daysOnMarket": 4},
    {"id": "JR-4", "address": "2103 S Gilpin St", "street": "S Gilpin St", "city": "Austin", "zip": "78704", "area": "south", "type": "Single Family", "price": 1150000, "beds": 3, "baths": 2.5, "sqft": 2050, "lotSqft": 9800, "yearBuilt": 2008, "hoaFee": None, "newConstruction": False, "daysOnMarket": 45},
    {"id": "JR-5", "address": "6807 Shoal Creek Blvd", "street": "Shoal Creek Blvd", "city": "Austin", "zip": "78757", "area": "north", "type": "Townhouse", "price": 599000, "beds": 3, "baths": 2.5, "sqft": 1720, "lotSqft": None, "yearBuilt": 2022, "hoaFee": 180, "newConstruction": True, "daysOnMarket": 20},
]


@pytest.fixture(autouse=True)
def homes(monkeypatch):
    monkeypatch.setattr(store, "LISTINGS", HOMES)


def runner():
    state = realestate.create_state(NOW)

    async def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = realestate.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        r = o.run(state, parsed, CTX)
        return await r if hasattr(r, "__await__") else r

    return state, run


async def first_open(run, purpose="showing", day=SATURDAY, listing_id=None):
    r = await run("check_availability", {"purpose": purpose, "date": day, **({"listingId": listing_id} if listing_id else {})})
    assert r.ok, r
    return (r.result["available"] or r.result["nextAvailable"])[0]["slotId"]


class TestSearch:
    async def test_finds_three_bedrooms_under_700_in_hyde_park(self):
        state, run = runner()
        r = await run("search_listings", {"area": "Hyde Park", "maxPrice": 700000, "minBeds": 3})
        assert r.ok and r.result["total"] == 1
        assert r.result["matches"][0]["address"] == "1204 Clarkson Ave"
        assert state.lead["areas"] == ["central"]
        tiles = realestate.view(state)["listings"]["homes"]
        assert tiles[0]["matched"] and tiles[0]["read"]

    async def test_an_area_we_dont_cover_is_named_not_guessed(self):
        _, run = runner()
        r = await run("search_listings", {"area": "Houston"})
        assert not r.ok and r.error == "unknown_area"

    async def test_no_exact_match_offers_the_closest(self):
        _, run = runner()
        r = await run("search_listings", {"area": "East Austin", "maxPrice": 200000})
        assert r.ok and r.result["total"] == 0 and r.result["closest"]

    async def test_names_a_home_by_its_street(self):
        state, run = runner()
        r = await run("get_listing", {"street": "the place on Clarkson"})
        assert r.ok and r.result["price"] == "$689,000" and state.focus == "JR-1"
        assert r.result["agent"] == "Priya"

    async def test_a_home_not_in_the_listings_is_not_invented(self):
        _, run = runner()
        r = await run("get_listing", {"street": "Lamar Blvd"})
        assert not r.ok and r.error == "not_found"

    async def test_the_agent_never_hears_a_listing_id_it_did_not_need(self):
        _, run = runner()
        r = await run("search_listings", {"area": "78704"})
        assert set(r.result["matches"][0]) >= {"listingId", "address", "price", "standout"}


class TestShowing:
    async def test_books_a_showing_with_the_agent_for_that_area(self):
        state, run = runner()
        await run("note_lead", {"name": "Jamie Cole", "intent": "buy", "timeline": "three_months", "financing": "pre_approved", "lender": "Amplify"})
        await run("get_listing", {"street": "Clarkson"})
        slot = await first_open(run)
        r = await run("book_appointment", {"purpose": "showing", "slotId": slot, "callerConfirmed": True})
        assert r.ok and r.result["agent"] == "Priya"
        v = realestate.view(state)
        assert v["record"]["stage"] == "booked"
        assert v["lead"]["tier"] == "A"
        assert any(t["title"].startswith("Showing") for t in v["tasks"])

    async def test_needs_a_yes_a_name_and_an_offered_time(self):
        _, run = runner()
        await run("get_listing", {"street": "Clarkson"})
        slot = await first_open(run)
        assert (await run("book_appointment", {"purpose": "showing", "slotId": slot, "callerConfirmed": True})).error == "missing_details"
        await run("note_lead", {"name": "Jamie Cole"})
        assert (await run("book_appointment", {"purpose": "showing", "slotId": "2026-10-09T09", "callerConfirmed": True})).error == "slot_not_offered"

    async def test_a_change_moves_the_same_showing(self):
        state, run = runner()
        await run("note_lead", {"name": "Jamie Cole"})
        await run("get_listing", {"street": "Clarkson"})
        slot = await first_open(run)
        booked = (await run("book_appointment", {"purpose": "showing", "slotId": slot, "callerConfirmed": True})).result["appointmentId"]
        r = await run("check_availability", {"purpose": "showing", "date": "2026-10-04", "listingId": "JR-1"})
        new = (r.result["available"] or r.result["nextAvailable"])[0]["slotId"]
        assert (await run("reschedule_appointment", {"appointmentId": booked, "newSlotId": new, "callerConfirmed": True})).ok
        assert len(state.appointments) == 1 and state.appointments[0].changes == 1

    async def test_asks_which_home_before_checking_showings(self):
        _, run = runner()
        assert (await run("check_availability", {"purpose": "showing", "date": SATURDAY})).error == "which_home"


class TestSeller:
    async def test_estimate_is_a_range_from_our_listings_and_books_a_valuation_with_dana(self, monkeypatch):
        homes = HOMES + [
            {**HOMES[3], "id": "JR-6", "address": "1500 Kenwood Ave", "street": "Kenwood Ave", "price": 980000, "sqft": 1900},
            {**HOMES[3], "id": "JR-7", "address": "1810 Newning Ave", "street": "Newning Ave", "price": 1240000, "sqft": 2300},
        ]
        monkeypatch.setattr(store, "LISTINGS", homes)
        state, run = runner()
        await run("note_lead", {"name": "Sam Lee", "timeline": "six_months"})
        r = await run("estimate_value", {"address": "2209 S Gilpin St, 78704", "squareFeet": 2000})
        assert r.ok and r.result["low"].startswith("$") and "price" not in r.result and r.result["comparables"] == 3
        assert state.lead["intent"] == "sell"
        slot = await first_open(run, "valuation")
        b = await run("book_appointment", {"purpose": "valuation", "slotId": slot, "callerConfirmed": True})
        assert b.ok and b.result["agent"] == "Dana"
        v = realestate.view(state)
        assert v["estimate"]["status"] == "ok" and any(s["id"] == "selling" for s in v["record"]["sections"])

    async def test_too_few_comparables_falls_back_to_the_valuation(self):
        state, run = runner()
        r = await run("estimate_value", {"address": "12 Nowhere Lane"})
        assert r.ok and r.result["estimate"] is None and "Dana" in r.result["say"]
        assert state.estimate["status"] == "unavailable"


class TestLead:
    async def test_knows_someone_who_called_before(self):
        _, run = runner()
        r = await run("note_lead", {"name": "Megan Alvarez"})
        assert r.result["knownContact"]["spokeWith"] == "Priya Shah"

    async def test_a_browsing_buyer_with_an_agent_is_tier_c_and_the_caller_never_hears_it(self):
        state, run = runner()
        r = await run("note_lead", {"name": "Ana Ruiz", "intent": "buy", "timeline": "browsing", "hasAgent": True})
        assert "tier" not in str(r.result).lower()
        assert realestate.view(state)["lead"]["tier"] == "C"

    async def test_message_goes_to_the_area_agent(self):
        state, run = runner()
        await run("note_lead", {"name": "Ana Ruiz", "areas": ["north"]})
        r = await run("take_message", {"name": "Ana Ruiz", "callbackNumber": "+15125550142", "summary": "Wants new listings in Crestview"})
        assert r.ok and r.result["for"] == "Jordan Ellis"
        assert realestate.view(state)["messages"][0]["callback"] == "•••• 0142"


def test_the_prompt_carries_the_fair_housing_rules():
    state = realestate.create_state(NOW)
    p = realestate.instruction(state, CTX)
    assert "Fair housing" in p and "crime maps" in p and "Please tell me the number on your screen." in p
