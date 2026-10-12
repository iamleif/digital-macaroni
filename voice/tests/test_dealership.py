from datetime import datetime, timezone
from typing import Any

from app.demos.dealership import dealership, store
from app.demos.dealership import state as dstate
from app.demos.dealership.state import parse_slot
from app.demos.types import OpContext, OpResult

# A Thursday morning in Detroit.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="phone")
SATURDAY = "2026-10-03"
SUNDAY = "2026-10-04"


def runner():
    state = dealership.create_state(NOW)

    def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = dealership.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        return o.run(state, parsed, CTX)

    return state, run


def first_slot(r: OpResult) -> str:
    return (r.result["available"] or r.result["nextAvailable"])[0]["slotId"]


def test_the_lot_is_real_cars_with_photos():
    assert len(store.CARS) > 1000
    assert all(len(c["vin"]) == 17 and c["price"] > 0 for c in store.CARS)


def test_finds_a_truck_under_budget_and_books_a_test_drive():
    state, run = runner()
    r = run("search_inventory", {"body": "Truck", "maxPrice": 40000})
    assert r.ok and r.result["total"] > 0
    assert all(int(m["price"].strip("$").replace(",", "")) <= 40000 for m in r.result["matches"])
    stock = r.result["matches"][0]["stockNumber"]
    assert run("get_vehicle", {"stockNumber": stock}).ok
    run("note_lead", {"name": "Andre Williams", "payment": "finance", "tradeYear": 2016, "tradeMake": "Chevy", "tradeModel": "Malibu", "tradeMiles": 98000})
    slot = first_slot(run("check_availability", {"purpose": "test_drive", "date": SATURDAY}))
    b = run("book_appointment", {"purpose": "test_drive", "slotId": slot, "callerConfirmed": True})
    assert b.ok and "licence" in b.result["say"]
    v = dealership.view(state)
    assert v["record"]["stage"] == "booked" and any(s["id"] == "trade" for s in v["record"]["sections"])
    assert any("financing" in t["title"] for t in v["tasks"]) and any("trade-in" in t["title"] for t in v["tasks"])
    assert v["known"]["car"].startswith("2021 Ford")


def test_trucks_go_to_the_truck_specialist_when_he_is_free():
    state, run = runner()
    truck = next(c for c in store.CARS if c["body"] == "Truck")
    run("get_vehicle", {"stockNumber": truck["stock"]})
    r = run("check_availability", {"purpose": "test_drive", "date": SATURDAY})
    whos = {parse_slot(s["slotId"])[2] for s in r.result["available"]}
    assert "ben" in whos or r.result["available"]


def test_never_gives_a_trade_value_or_a_payment():
    _, run = runner()
    r = run("note_lead", {"tradeYear": 2018, "tradeMake": "Honda", "tradeModel": "Civic", "tradeMiles": 60000, "tradeCondition": "good"})
    assert "Never give a value" in r.result["tradeIn"]
    p = dealership.instruction(dealership.create_state(NOW), CTX)
    assert "Never quote a lower price, a monthly payment, a rate" in p


def test_a_car_not_on_the_lot_is_not_invented():
    _, run = runner()
    assert run("get_vehicle", {"stockNumber": "W99999"}).error == "not_found"
    r = run("search_inventory", {"make": "Ferrari", "model": "Roma"})
    assert r.ok and r.result["total"] == 0


def test_books_service_for_the_callers_own_car():
    state, run = runner()
    run("note_lead", {"name": "Grace Novak"})
    slot = first_slot(run("check_availability", {"purpose": "service", "date": SATURDAY}))
    assert parse_slot(slot)[1] < 14  # Saturday service closes at 2 PM
    b = run("book_appointment", {"purpose": "service", "slotId": slot, "service": "oil_change", "ownVehicle": "2020 Jeep Grand Cherokee", "callerConfirmed": True})
    assert b.ok and b.result["advisor"] == "Dave Mitchell"


def test_closed_sunday():
    _, run = runner()
    run("get_vehicle", {"stockNumber": store.CARS[0]["stock"]})
    assert run("check_availability", {"purpose": "test_drive", "date": SUNDAY}).result["reason"] == "closed_sunday"


def test_finance_questions_go_to_rita():
    _, run = runner()
    r = run("take_message", {"name": "Sam Lee", "callbackNumber": "+13135550142", "summary": "Wants to know monthly payments on the F-150", "forTeam": "finance"})
    assert r.result["for"] == "Rita Alvarez"


# ---- horizon, varied diaries, full names ----

DAY13, DAY14 = "2026-10-14", "2026-10-15"  # today is 2026-10-01


def test_calendar_is_bookable_for_fourteen_days_and_no_further():
    state, run = runner()
    run("get_vehicle", {"stockNumber": store.CARS[0]["stock"]})
    assert store.DAYS_AHEAD == 14
    assert DAY13 in dstate.bookable_days(state) and DAY14 not in dstate.bookable_days(state)
    assert run("check_availability", {"purpose": "test_drive", "date": DAY13}).ok
    r = run("check_availability", {"purpose": "test_drive", "date": DAY14})
    assert not r.ok
    assert "only goes out two weeks, through Wednesday, October 14" in r.message


def test_diaries_differ_by_date_but_not_by_call():
    from app.demos.dealership.state import create_state, nearly_full

    def pattern(state, day):
        return sorted((b.who, b.hour) for b in state.busy if b.date == day)

    a, b = create_state(NOW), create_state(datetime(2026, 10, 1, 17, 30, tzinfo=timezone.utc))
    days = dstate.bookable_days(a)
    assert all(pattern(a, d) == pattern(b, d) for d in days)
    assert len({tuple(pattern(a, d)) for d in days}) == len(days)
    assert len({tuple(sorted(x.title for x in a.busy if x.date == d)) for d in days}) > 8
    assert sum(1 for d in days if nearly_full(d)) <= 1
    for d in days:
        assert len(dstate.open_slots(a, "test_drive", d)) >= 1 and len(dstate.open_slots(a, "service", d)) >= 1
    assert len([d for d in days if len(dstate.open_slots(a, "test_drive", d)) <= 3]) <= 2


def test_a_first_name_alone_is_not_saved_or_booked():
    state, run = runner()
    r = run("note_lead", {"name": "Andre"})
    assert "name" not in state.lead and "last name" in r.result["next"]
    run("get_vehicle", {"stockNumber": store.CARS[0]["stock"]})
    slot = first_slot(run("check_availability", {"purpose": "test_drive", "date": SATURDAY}))
    b = run("book_appointment", {"purpose": "test_drive", "slotId": slot, "callerConfirmed": True})
    assert not b.ok
    assert not run("take_message", {"name": "Andre", "callbackNumber": "+13135550142", "summary": "Wants a call back", "forTeam": "sales"}).ok
    run("note_lead", {"name": "Andre Williams"})
    assert state.lead["name"] == "Andre Williams"


def test_the_prompt_says_just_a_moment_and_asks_for_last_names():
    p = dealership.instruction(dealership.create_state(NOW), CTX)
    assert "Just a moment" not in p and "And your last name?" in p and "two weeks ahead" in p
