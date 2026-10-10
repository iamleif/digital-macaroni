from datetime import datetime, timezone
from typing import Any

import pytest

from app.demos.formfield import formfield
from app.demos.northline import issue_is_vague, northline
from app.demos.types import OpContext, OpResult, add_days, weekday

# A Thursday morning in Seattle.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="browser")
TOMORROW = "2026-10-02"


def runner(demo):
    state = demo.create_state(NOW)

    def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = demo.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        if (args or {}).get("callerConfirmed") is False:
            raise AssertionError("tests always confirm")
        return o.run(state, parsed, CTX)

    return state, run


def res(r: OpResult) -> dict[str, Any]:
    return r.result


def slots_for(run, service: str = "heating_repair", day: str = TOMORROW) -> list[str]:
    return [s["slotId"] for s in res(run("check_availability", {"service": service, "date": day}))["available"]]


class TestNorthline:
    def test_uses_the_sessions_own_date_and_offers_only_open_windows(self):
        state, run = runner(northline)
        assert state.today == "2026-10-01"
        r = run("check_availability", {"service": "heating_repair", "date": TOMORROW, "partOfDay": "afternoon"})
        assert r.ok
        slots = [s["slotId"] for s in res(r)["available"]]
        assert slots
        # Tomorrow's 12–2 window is fully booked in the fixture.
        assert f"{TOMORROW}T12" not in slots
        assert set(slots) <= set(state.offered)

    def test_refuses_to_propose_or_book_a_time_it_never_offered(self):
        _, run = runner(northline)
        assert not run("note_request_details", {"proposedSlotId": f"{TOMORROW}T14"}).ok
        r = run("book_appointment", {"slotId": f"{TOMORROW}T14", "service": "heating_repair", "name": "Alex", "address": "48 Birch Lane", "issue": "No heat", "callerConfirmed": True})
        assert not r.ok and r.error == "slot_not_offered"

    def test_books_once_retries_return_the_same_booking_and_moves_the_same_record(self):
        state, run = runner(northline)
        slots = slots_for(run)
        booking = {"slotId": slots[0], "service": "heating_repair", "name": "Alex Taylor", "address": "48 Birch Lane", "issue": "Furnace not heating", "callerConfirmed": True}
        first = run("book_appointment", booking)
        assert first.ok
        again = run("book_appointment", booking)
        assert res(again)["duplicate"] and res(again)["appointmentId"] == res(first)["appointmentId"]
        assert len(state.appointments) == 1
        # A second, different booking in the same call is refused: changes go through reschedule.
        other = run("book_appointment", {**booking, "slotId": slots[1]})
        assert not other.ok and other.error == "already_booked"

        moved = run("reschedule_appointment", {"appointmentId": res(first)["appointmentId"], "newSlotId": slots[1], "callerConfirmed": True})
        assert moved.ok
        assert len(state.appointments) == 1 and state.appointments[0].slot_id == slots[1]
        assert len([j for j in state.jobs if not j.existing]) == 1

        assert run("cancel_appointment", {"appointmentId": res(first)["appointmentId"], "callerConfirmed": True}).ok
        assert not [j for j in state.jobs if not j.existing]

    @pytest.mark.parametrize("vague", ["Heating and cooling", "probably some kind of heating or cooling", "HVAC issue", "Heating repair", "something with the AC", "furnace problem", "not sure, my system"])
    def test_a_category_is_vague(self, vague):
        assert issue_is_vague(vague)

    @pytest.mark.parametrize("real", ["No heat", "Furnace not heating", "AC blowing warm air", "Rattling noise from the furnace", "Water leaking under the unit", "keeps turning on and off"])
    def test_a_symptom_is_not_vague(self, real):
        assert not issue_is_vague(real)

    def test_will_not_book_a_repair_until_it_knows_what_the_caller_noticed(self):
        state, run = runner(northline)
        booking = {"slotId": slots_for(run)[0], "service": "heating_repair", "name": "Alex", "address": "48 Birch Lane", "issue": "Heating and cooling", "callerConfirmed": True}
        r = run("book_appointment", booking)
        assert not r.ok and r.error == "issue_too_vague"
        assert not state.appointments
        assert run("book_appointment", {**booking, "issue": "House not warming up, furnace runs"}).ok

    def test_books_a_tune_up_or_estimate_on_request_alone(self):
        _, run = runner(northline)
        slots = slots_for(run, "cooling_tune_up")
        assert run("book_appointment", {"slotId": slots[0], "service": "cooling_tune_up", "name": "Alex", "address": "48 Birch Lane", "issue": "AC tune-up", "callerConfirmed": True}).ok
        info = res(run("get_business_info"))
        assert next(s for s in info["services"] if s["service"] == "replacement_estimate")["price"] == "Free"

    def test_keeps_a_category_off_the_request_card_and_says_so(self):
        state, run = runner(northline)
        r = run("note_request_details", {"service": "heating_repair", "issue": "heating or cooling"})
        assert r.ok and "issue" not in state.request and res(r)["issueNotRecorded"]
        run("note_request_details", {"issue": "No heat upstairs"})
        assert state.request["issue"] == "No heat upstairs"

    def test_gives_only_what_is_new_after_booking(self):
        _, run = runner(northline)
        r = res(run("book_appointment", {"slotId": slots_for(run)[0], "service": "heating_repair", "name": "Alex", "address": "48 Birch Lane", "issue": "No heat", "callerConfirmed": True}))
        assert sorted(r) == ["appointmentId", "callsAhead", "technician"]

    def test_offers_next_openings_when_a_day_has_none_and_says_sunday_is_closed(self):
        state, run = runner(northline)
        sunday = next(d for d in (add_days(state.today, i) for i in range(7)) if weekday(d) == 0)
        r = run("check_availability", {"service": "cooling_repair", "date": sunday})
        assert r.ok and res(r)["available"] == [] and res(r)["reason"] == "closed_sunday" and res(r)["nextAvailable"]

    def test_takes_a_message_once(self):
        state, run = runner(northline)
        msg = {"name": "Alex", "callbackNumber": "555-0142", "summary": "Wants a quote for a new boiler"}
        assert run("take_message", msg).ok
        assert res(run("take_message", msg))["duplicate"]
        assert len(state.messages) == 1

    def test_an_urgent_message_goes_to_the_on_call_technician(self):
        state, run = runner(northline)
        r = run("take_message", {"name": "Jamie", "callbackNumber": "555-0142", "summary": "No heat at 12 Orchard Road", "urgent": True})
        assert r.ok and res(r)["onCallCallsBackWithin"] == "15 minutes"
        assert northline.view(state)["messages"][0]["urgent"]

    def test_business_info_covers_emergencies_the_club_and_financing(self):
        _, run = runner(northline)
        info = res(run("get_business_info"))
        assert "$149" in info["emergency"]["fee"] and "$19" in info["comfortClub"]["price"] and "$99" in info["financing"]

    def test_knows_whether_the_business_is_open_right_now(self):
        state, _ = runner(northline)
        # 7 AM Pacific on a Thursday is after hours; 2 PM is open.
        early = OpContext(now=datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc), channel="phone")
        midday = OpContext(now=datetime(2026, 10, 1, 21, 0, tzinfo=timezone.utc), channel="phone")
        assert "closed right now" in northline.instruction(state, early)
        assert "we are open" in northline.instruction(state, midday)

    def test_shows_openings_only_for_technicians_who_do_that_work(self):
        state, run = runner(northline)
        run("check_availability", {"service": "heating_repair", "date": "2026-10-03"})
        view = northline.view(state)
        assert view["open"] and all(o["techId"] != "sam" for o in view["open"])

    def test_shows_other_customers_jobs_without_their_details(self):
        state, _ = runner(northline)
        assert all(j["kind"] == "existing" and "name" not in j and "address" not in j for j in northline.view(state)["schedule"])


class TestFormField:
    def test_shop_info_covers_returns_shipping_and_gift_cards(self):
        _, run = runner(formfield)
        info = res(run("get_shop_info"))
        assert info["address"] and "30 days" in info["returns"] and "$9" in info["shipping"] and "$25" in info["giftCards"]

    def test_finds_a_green_lamp_under_100(self):
        _, run = runner(formfield)
        r = run("search_products", {"query": "table lamp", "color": "green", "maxPrice": 100})
        assert r.ok and [m["name"] for m in res(r)["matches"]] == ["Ridge Table Lamp"]

    def test_refuses_an_out_of_stock_option_and_suggests_what_is_available(self):
        _, run = runner(formfield)
        r = run("reserve_item", {"variantId": "ridge-oat", "quantity": 1, "name": "Sam", "callerConfirmed": True})
        assert not r.ok and [o["variantId"] for o in res(r)["otherOptions"]] == ["ridge-sage", "ridge-charcoal"]

    def test_reserves_holds_stock_changes_quantity_and_releases_on_cancel(self):
        state, run = runner(formfield)
        first = run("reserve_item", {"variantId": "ridge-sage", "quantity": 2, "name": "Sam", "callerConfirmed": True})
        assert first.ok

        def in_stock(vid: str) -> int:
            return next(o for o in res(run("get_product_details", {"productId": "ridge-lamp"}))["options"] if o["variantId"] == vid)["inStock"]

        assert in_stock("ridge-sage") == 1
        assert res(run("reserve_item", {"variantId": "ridge-sage", "quantity": 2, "name": "Sam", "callerConfirmed": True}))["duplicate"]
        rid = res(first)["reservationId"]
        too_many = run("update_reservation", {"reservationId": rid, "quantity": 4, "callerConfirmed": True})
        assert not too_many.ok and too_many.error == "insufficient_stock"
        assert run("update_reservation", {"reservationId": rid, "quantity": 3, "callerConfirmed": True}).ok
        assert in_stock("ridge-sage") == 0
        assert run("cancel_reservation", {"reservationId": rid, "callerConfirmed": True}).ok
        assert in_stock("ridge-sage") == 3
        assert state.reservations[0].status == "cancelled"

    def test_only_discusses_an_order_when_number_and_email_both_match(self):
        state, run = runner(formfield)
        assert not run("lookup_order", {"orderNumber": "1042", "email": "someone@example.com"}).ok
        assert not run("create_support_request", {"issue": "Mug arrived chipped"}).ok
        assert run("lookup_order", {"orderNumber": "order 1042", "email": "Emilia at example dot com"}).ok
        assert res(run("create_support_request", {"issue": "Mug arrived chipped"}))["status"] == "pending review"
        assert len(state.support_requests) == 1
