from datetime import datetime, timezone
from typing import Any

import pytest

from app import liteapi
from app.demos.hotels import hotels
from app.demos.types import OpContext, OpResult

# A Sunday afternoon in Miami.
NOW = datetime(2026, 10, 11, 18, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="browser")


def rate(name: str, amount: float, refundable: bool = False, board: str = "RO", resort_fee: float = 0) -> dict[str, Any]:
    fees = [{"included": True, "description": "TAX", "amount": round(amount * 0.13, 2), "currency": "USD"}]
    if resort_fee:
        fees.append({"included": False, "description": "Resort fee", "amount": resort_fee, "currency": "USD"})
    return {
        "name": name,
        "boardType": board,
        "boardName": {"RO": "Room Only", "BB": "Bed and Breakfast"}[board],
        "retailRate": {"total": [{"amount": amount, "currency": "USD"}], "taxesAndFees": fees},
        "cancellationPolicies": {"refundableTag": "RFN" if refundable else "NRFN", "cancelPolicyInfos": [{"cancelTime": "2026-10-21 08:00:00", "amount": amount / 2, "currency": "USD"}] if refundable else []},
    }


def room_type(offer: str, r: dict[str, Any]) -> dict[str, Any]:
    return {"offerId": offer, "offerRetailRate": {"amount": r["retailRate"]["total"][0]["amount"], "currency": "USD"}, "rates": [r]}


HOTELS = [
    {"id": "h_betsy", "name": "The Betsy Hotel, South Beach", "main_photo": "https://example.test/betsy.jpg", "address": "1440 Ocean Drive", "rating": 9.2, "stars": 4, "review_count": 1800},
    {"id": "h_one", "name": "1 Hotel South Beach", "main_photo": "https://example.test/one.jpg", "address": "2341 Collins Avenue", "rating": 9.4, "stars": 5, "review_count": 3100},
    {"id": "h_budget", "name": "Seaside Budget Inn", "main_photo": None, "address": "10 Collins Avenue", "rating": 7.1, "stars": 2, "review_count": 240},
    {"id": "h_new", "name": "Brand New Hotel", "main_photo": None, "address": "1 New Street", "rating": 10, "stars": 3, "review_count": 3},
]
SEARCH = {
    "data": [
        {"hotelId": "h_betsy", "roomTypes": [room_type("o_betsy", rate("King Room", 598.99, refundable=True))]},
        {"hotelId": "h_one", "roomTypes": [room_type("o_one", rate("Ocean View King", 1420.78))]},
        {"hotelId": "h_budget", "roomTypes": [room_type("o_budget", rate("Double Room", 179.53))]},
        {"hotelId": "h_new", "roomTypes": [room_type("o_new", rate("Studio", 400.0))]},
    ],
    "hotels": HOTELS,
}
BETSY_ROOMS = {
    "data": [
        {
            "hotelId": "h_betsy",
            "roomTypes": [
                room_type("r_cheap", rate("Classic Queen", 560.0, resort_fee=60)),
                room_type("r_flex", rate("Classic Queen", 610.0, refundable=True, resort_fee=60)),
                room_type("r_bfast", rate("Deluxe King", 690.0, board="BB")),
            ],
        }
    ]
}
BETSY = {
    "id": "h_betsy",
    "name": "The Betsy Hotel, South Beach",
    "starRating": 4,
    "rating": 9.2,
    "reviewCount": 1800,
    "address": "1440 Ocean Drive",
    "city": "Miami Beach",
    "hotelImages": [{"url": "https://example.test/b2.jpg", "order": 1}, {"url": "https://example.test/b1.jpg", "defaultImage": True, "order": 0}],
    "hotelFacilities": ["Free WiFi", "Bar", "Outdoor pool", "Spa/wellness center", "Lift / Elevator"],
    "checkinCheckoutTimes": {"checkin_start": "04:00 PM", "checkout": "11:00 AM"},
    "sentiment_analysis": {"pros": ["Great location", "Friendly staff"], "cons": ["Small rooms"]},
    "hotelDescription": "<p><strong>On Ocean Drive</strong><br>A boutique hotel.</p>",
}


@pytest.fixture
def lite(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    calls: dict[str, Any] = {"prebook": [], "price": None, "fail": None}

    async def search_rates(city: str, checkin: str, checkout: str, adults: int, **_: Any) -> dict[str, Any]:
        calls["city"] = city
        return SEARCH

    async def hotel_rates(hotel_id: str, *_: Any, **__: Any) -> dict[str, Any]:
        return BETSY_ROOMS

    async def hotel_details(hotel_id: str) -> dict[str, Any]:
        return BETSY

    async def prebook(offer_id: str) -> dict[str, Any]:
        if calls["fail"]:
            raise liteapi.LiteError(calls["fail"])
        calls["prebook"].append(offer_id)
        return {"prebookId": "pb_1", "price": calls["price"] or 610.0, "currency": "USD"}

    monkeypatch.setattr(liteapi, "search_rates", search_rates)
    monkeypatch.setattr(liteapi, "hotel_rates", hotel_rates)
    monkeypatch.setattr(liteapi, "hotel_details", hotel_details)
    monkeypatch.setattr(liteapi, "prebook", prebook)
    return calls


async def run(state: Any, name: str, args: Any = None) -> OpResult:
    op = hotels.operations[name]
    i = op.params(**(args or {})) if op.params else None
    r = op.run(state, i, CTX)
    return await r if hasattr(r, "__await__") else r  # type: ignore[return-value]


async def to_review(state: Any) -> None:
    await run(state, "search_hotels", {"area": "miami_beach", "checkin": "2026-10-23", "checkout": "2026-10-25", "adults": 2})
    await run(state, "choose_hotel", {"option": 1})
    await run(state, "choose_room", {"room": 2})
    await run(state, "set_guest", {"fullName": "Alex  Taylor"})


async def test_search_offers_three_labelled_hotels_and_skips_thinly_reviewed(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    r = await run(s, "search_hotels", {"area": "miami_beach", "checkin": "2026-10-23", "checkout": "2026-10-25", "adults": 2, "priority": "best_rated"})
    assert r.ok and lite["city"] == "Miami Beach"
    names = [(o["label"], o["name"]) for o in r.result["shortlist"]]
    assert names[0] == ("Best rated", "1 Hotel South Beach")
    assert ("Cheapest", "Seaside Budget Inn") in names
    # A 10 from three reviews never leads.
    assert all(n != "Brand New Hotel" for _, n in names)
    assert r.result["shortlist"][0]["perNight"] == "$710"
    assert s.stage == "options"


async def test_search_rejects_bad_dates(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    assert (await run(s, "search_hotels", {"area": "downtown", "checkin": "2026-10-01", "checkout": "2026-10-03"})).error == "date_in_past"
    assert (await run(s, "search_hotels", {"area": "downtown", "checkin": "2026-10-23", "checkout": "2026-10-23"})).error == "checkout_before_checkin"
    assert (await run(s, "search_hotels", {"area": "downtown", "checkin": "2026-10-23", "checkout": "2026-11-23"})).error == "too_long"


async def test_budget_filter_says_when_nothing_fits(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    r = await run(s, "search_hotels", {"area": "miami_beach", "checkin": "2026-10-23", "checkout": "2026-10-25", "maxPerNight": 50})
    assert r.ok and "Nothing under $50" in r.result["note"]


async def test_hotel_offers_cheapest_flexible_and_breakfast_rooms(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    await run(s, "search_hotels", {"area": "miami_beach", "checkin": "2026-10-23", "checkout": "2026-10-25", "priority": "best"})
    betsy = next(o["option"] for o in s.options if o["name"].startswith("The Betsy"))
    r = await run(s, "choose_hotel", {"option": betsy})
    assert r.ok
    rooms = r.result["rooms"]
    assert [x["why"] for x in rooms] == ["Lowest price", "Free cancellation", "With breakfast"]
    assert rooms[1]["cancellation"] == "Free cancellation until Wednesday, October 21"
    assert rooms[2]["board"] == "Breakfast included"
    assert "resort fee of $60, paid at the hotel" == rooms[0]["payAtHotel"]
    assert "offerId" not in rooms[0]
    assert s.hotel and s.hotel["photos"][0] == "https://example.test/b1.jpg"
    assert s.hotel["highlights"] == ["Outdoor pool", "Spa/wellness center", "Free WiFi", "Bar"]


async def test_review_rechecks_price_and_book_stops_at_payment(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    await to_review(s)
    assert s.guest == {"name": "Alex Taylor", "email": "guest@example.com", "phone": "+1 305 555 0142"}
    lite["price"] = 615.5
    r = await run(s, "review_stay")
    assert r.ok and lite["prebook"] == ["r_flex"]
    assert r.result["review"]["total"] == "$615.50" and r.result["review"]["priceChanged"] is True
    b = await run(s, "book_stay")
    assert not b.ok and b.error == "test_mode" and b.changed
    assert s.stage == "payment" and s.booking == {"status": "payment_stopped"}


async def test_expired_rate_says_to_look_again(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    await to_review(s)
    lite["fail"] = "unavailable"
    r = await run(s, "review_stay")
    assert not r.ok and r.error == "unavailable" and "choose_hotel" in r.message


async def test_order_is_enforced(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    assert (await run(s, "choose_hotel", {"option": 1})).error == "no_search"
    assert (await run(s, "set_guest", {"fullName": "Alex Taylor"})).error == "no_room"
    assert (await run(s, "book_stay")).error == "not_reviewed"


async def test_view_keeps_ids_and_amounts_server_side(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    await to_review(s)
    await run(s, "review_stay")
    v = hotels.view(s)
    assert v["search"]["area"] == "Miami Beach" and v["search"]["nights"] == 2
    assert all("hotelId" not in o for o in v["options"])
    assert all(not ({"offerId", "amount"} & set(r)) for r in v["rooms"])
    assert v["review"]["guest"] == "Alex Taylor" and v["stage"] == "review"


def test_opening_lines_and_instruction() -> None:
    s = hotels.create_state(NOW)
    text = hotels.instruction(s, CTX)
    assert "Hi, thanks for calling Palmetto Stays, this is Marisol. Please tell me the number on your screen." in text
    assert "receptionist" not in text.lower()
    assert s.today == "2026-10-11"


async def test_take_message_records_a_callback_for_an_agent(lite: dict[str, Any]) -> None:
    s = hotels.create_state(NOW)
    r = await run(s, "search_hotels", {"area": "miami_beach", "checkin": "2026-12-11", "checkout": "2026-12-31", "adults": 4})
    assert r.error == "too_long" and "take_message" in r.message
    m = await run(s, "take_message", {"name": "Leif", "callbackNumber": "+15555555382", "summary": "Two rooms in Miami Beach, Dec 11 to 31, five adults."})
    assert m.ok and m.changed and m.result["messageId"].startswith("MSG-")
    again = await run(s, "take_message", {"name": "Leif", "callbackNumber": "+15555555382", "summary": "Two rooms in Miami Beach, Dec 11 to 31, five adults."})
    assert again.result["duplicate"] is True
    v = hotels.view(s)
    assert v["messages"] == [{"id": m.result["messageId"], "name": "Leif", "summary": "Two rooms in Miami Beach, Dec 11 to 31, five adults.", "preferredTime": None, "callback": "•••• 5382"}]
    assert "Never say you have noted" in hotels.instruction(s, CTX)


async def test_summary_email_after_a_message_with_the_digital_macaroni_card(lite: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    from app import email

    sent: list[dict[str, str]] = []

    async def send(to: str, subject: str, html_body: str, text_body: str, from_name: str) -> None:
        sent.append({"to": to, "subject": subject, "html": html_body, "text": text_body})

    async def any_domain(domain: str) -> bool:
        return True

    monkeypatch.setattr(email, "send", send)
    monkeypatch.setattr(email, "receives_mail", any_domain)
    s = hotels.create_state(NOW)
    await run(s, "take_message", {"name": "Leif Marshall", "callbackNumber": "+15555555382", "summary": "Two rooms in Miami Beach, Dec 11 to 31, five adults."})
    r = await run(s, "email_quote", {"email": "leif at example dot com", "recap": "You wanted two rooms for twenty nights; I took a message for an agent.", "callerConfirmed": True})
    assert r.ok and sent[0]["to"] == "leif@example.com" and sent[0]["subject"] == "Your call with Palmetto Stays"
    assert "Thanks for calling, Leif" in sent[0]["text"] and "Two rooms in Miami Beach" in sent[0]["text"] and "•••• 5382" in sent[0]["text"]
    assert "This is just the tip of the iceberg." in sent[0]["html"] and "Book a call with Leif" in sent[0]["html"]
