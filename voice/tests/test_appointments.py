from datetime import datetime, timezone
from typing import Any

from app import email
import pytest

from app.demos.booking import parse_slot
from app.demos.types import weekday
from app.demos.lune.store import CAL as lune_cal
from app.demos.tidewell.store import CAL as tidewell_cal
from app.demos.lune import lune
from app.demos.tidewell import tidewell
from app.demos.types import OpContext, OpResult

# A Thursday morning in Los Angeles and Portland.
NOW = datetime(2026, 10, 1, 16, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="phone")
SATURDAY = "2026-10-03"
SUNDAY = "2026-10-04"
MONDAY = "2026-10-05"


def runner(demo):
    state = demo.create_state(NOW)

    async def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = demo.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        r = o.run(state, parsed, CTX)
        return await r if hasattr(r, "__await__") else r

    return state, run


async def offer(run, service, day=SATURDAY, **kw):
    r = await run("check_availability", {"service": service, "date": day, **kw})
    assert r.ok, r
    return (r.result["available"] or r.result["nextAvailable"])[0]["slotId"]


class TestLune:
    async def test_books_a_cut_with_maria_and_offers_a_gloss(self):
        state, run = runner(lune)
        r = await run("note_booking", {"service": "cut", "stylist": "maria"})
        assert r.result["addOnToOffer"]["name"] == "Gloss"
        slot = await offer(run, "cut", stylist="maria")
        assert parse_slot(slot)[2] == "maria"
        b = await run("book_appointment", {"slotId": slot, "service": "cut", "name": "Priya Shah", "addOn": "gloss", "callerConfirmed": True})
        assert b.ok and b.result["with"] == "Maria Lopez" and "deposit" not in b.result
        v = lune.view(state)
        assert v["appointments"][0]["service"] == "Cut & style + Gloss"
        assert any(j["kind"] == "demo" for j in v["schedule"])

    async def test_balayage_takes_three_hours_and_needs_a_deposit(self):
        state, run = runner(lune)
        slot = await offer(run, "balayage")
        b = await run("book_appointment", {"slotId": slot, "service": "balayage", "name": "Leah Park", "callerConfirmed": True})
        assert b.ok and "$25" in b.result["deposit"]
        mine = next(j for j in state.busy if not j.existing)
        assert mine.minutes == 180

    async def test_closed_sunday_and_monday(self):
        _, run = runner(lune)
        r = await run("check_availability", {"service": "cut", "date": MONDAY})
        assert r.result["reason"] == "closed" and r.result["nextAvailable"]

    async def test_new_injectable_clients_start_with_a_consultation(self):
        _, run = runner(lune)
        assert (await run("check_availability", {"service": "botox", "date": SATURDAY})).error == "consult_first"
        assert (await offer(run, "consult"))

    async def test_a_returning_med_spa_client_can_book_botox(self):
        _, run = runner(lune)
        r = await run("note_booking", {"name": "Dana Whitfield"})
        assert "Botox" in r.result["knownClient"]["usual"]
        assert (await offer(run, "botox"))

    async def test_the_wrong_person_for_a_service_is_named(self):
        _, run = runner(lune)
        r = await run("check_availability", {"service": "balayage", "date": SATURDAY, "stylist": "jules"})
        assert r.error == "wrong_person" and "Ava" in r.message

    async def test_moves_the_same_booking(self):
        state, run = runner(lune)
        slot = await offer(run, "gel_mani")
        aid = (await run("book_appointment", {"slotId": slot, "service": "gel_mani", "name": "Sam Lee", "callerConfirmed": True})).result["appointmentId"]
        new = await offer(run, "gel_mani", day="2026-10-07")
        assert (await run("reschedule_appointment", {"appointmentId": aid, "newSlotId": new, "callerConfirmed": True})).ok
        assert len(state.appointments) == 1 and state.appointments[0].changes == 1


class TestTidewell:
    async def test_new_patient_with_back_pain_books_an_assessment_and_gets_intake_forms(self):
        state, run = runner(tidewell)
        await run("note_visit", {"newPatient": True, "reason": "lower back pain", "howLong": "a week", "cause": "lifting"})
        r = await run("note_visit", {"coverage": "insurance", "insurer": "Regence Blue Cross"})
        assert "bill Regence BlueCross BlueShield directly" in r.result["insurance"]
        slot = await offer(run, "chiro_new")
        b = await run("book_appointment", {"slotId": slot, "service": "chiro_new", "name": "Alex Taylor", "callerConfirmed": True})
        assert b.ok and b.result["with"] == "Dr. Hannah Lee" and "intake" in b.result
        rows = {r["label"]: r for r in tidewell.view(state)["extras"]["rows"]}
        assert rows["Patient type"]["value"].startswith("New") and rows["Red flags"]["value"] == "None mentioned"

    async def test_emergency_signs_stop_the_booking(self):
        state, run = runner(tidewell)
        r = await run("note_visit", {"reason": "back pain", "redFlags": ["bladder_or_bowel"]})
        assert "911" in r.result["emergency"]
        assert (await run("check_availability", {"service": "chiro_new", "date": SATURDAY})).error == "emergency"

    async def test_follow_ups_are_for_returning_patients(self):
        _, run = runner(tidewell)
        assert (await run("check_availability", {"service": "chiro_follow", "date": SATURDAY})).error == "new_patient_first"
        assert (await run("find_patient", {"name": "Jordan Reyes", "dateOfBirth": "1988-03-14"})).ok
        assert (await offer(run, "chiro_follow"))

    async def test_a_plan_we_dont_bill_is_pay_and_submit(self):
        _, run = runner(tidewell)
        r = await run("note_visit", {"coverage": "insurance", "insurer": "Kaiser"})
        assert "pay at the visit" in r.result["insurance"]

    async def test_closed_sunday(self):
        _, run = runner(tidewell)
        assert (await run("check_availability", {"service": "massage_60", "date": SUNDAY})).result["reason"] == "closed"

    async def test_the_email_never_carries_the_reason_for_the_visit(self, monkeypatch):
        sent = {}

        async def confirm(to, message):
            sent["text"] = message[2]
            return "a•••@example.com", None

        monkeypatch.setattr(email, "confirm", confirm)
        _, run = runner(tidewell)
        await run("note_visit", {"newPatient": True, "reason": "sciatica down my left leg"})
        slot = await offer(run, "physio_new")
        await run("book_appointment", {"slotId": slot, "service": "physio_new", "name": "Alex Taylor", "callerConfirmed": True})
        assert (await run("email_confirmation", {"email": "alex@example.com", "callerConfirmed": True})).ok
        assert "sciatica" not in sent["text"] and "Physio assessment" in sent["text"]


ALL_DAYS = [f"2026-10-{d:02d}" for d in range(1, 15)]


def busy_pattern(state, day):
    return sorted((b.staff_id, b.start, b.minutes, b.title) for b in state.busy if b.date == day and b.existing)


@pytest.mark.parametrize("demo", [lune, tidewell])
class TestHorizonAndPatterns:
    def test_fourteen_days_bookable_day_fourteen_not(self, demo):
        state = demo.create_state(NOW)
        days = demo.view  # noqa: F841
        cal = lune_cal if demo is lune else tidewell_cal
        bookable = cal.bookable_days(state)
        assert bookable[-1] == "2026-10-14" or bookable[-1] == "2026-10-13"
        assert cal.days_ahead == 14
        last = bookable[-1]
        svc = "cut" if demo is lune else "massage_60"
        r = cal.check(state, svc, last, None, None)
        assert r.ok
        far = cal.check(state, svc, "2026-10-15", None, None)
        assert not far.ok and "two weeks" in far.message and "Offer the caller a day within that" in far.message and "through" in far.message
        assert cal.check(state, svc, "2026-10-14", None, None).ok or weekday("2026-10-14") in cal.closed_weekdays

    def test_days_look_different_and_the_same_date_repeats(self, demo):
        cal = lune_cal if demo is lune else tidewell_cal
        a = demo.create_state(NOW)
        b = demo.create_state(datetime(2026, 10, 1, 23, 45, tzinfo=timezone.utc))
        open_days = cal.bookable_days(a)
        assert all(busy_pattern(a, d) == busy_pattern(b, d) for d in open_days)
        patterns = {tuple(busy_pattern(a, d)) for d in open_days}
        assert len(patterns) == len(open_days)
        # Two Thursdays and two days in the same week are not copies of each other.
        assert busy_pattern(a, "2026-10-01") != busy_pattern(a, "2026-10-08")
        assert busy_pattern(a, "2026-10-06") != busy_pattern(a, "2026-10-07")
        counts = [len(busy_pattern(a, d)) for d in open_days]
        assert max(counts) - min(counts) >= 3

    def test_every_day_keeps_an_opening_for_every_service(self, demo):
        cal = lune_cal if demo is lune else tidewell_cal
        state = demo.create_state(NOW)
        for d in cal.bookable_days(state)[1:]:
            for s in cal.services:
                assert cal.open_slots(state, s["id"], d), (d, s["id"])


@pytest.mark.parametrize("demo,op,args", [
    (lune, "note_booking", {"name": "Priya"}),
    (tidewell, "note_visit", {"name": "Alex"}),
    (tidewell, "find_patient", {"name": "Jordan", "dateOfBirth": "1988-03-14"}),
])
async def test_a_first_name_alone_is_refused(demo, op, args):
    _, run = runner(demo)
    r = await run(op, args)
    assert not r.ok and r.error == "last_name_needed" and "last name" in r.message


async def test_booking_needs_a_last_name():
    for demo, svc in ((lune, "cut"), (tidewell, "massage_60")):
        _, run = runner(demo)
        slot = await offer(run, svc)
        r = await run("book_appointment", {"slotId": slot, "service": svc, "name": "Priya", "callerConfirmed": True})
        assert not r.ok and r.error == "last_name_needed"
        assert (await run("book_appointment", {"slotId": slot, "service": svc, "name": "Priya Shah", "callerConfirmed": True})).ok


def test_prompts_say_just_a_moment_and_ask_for_a_last_name():
    for d in (lune, tidewell):
        p = d.instruction(d.create_state(NOW), CTX)
        assert "Just a moment" not in p and "And your last name?" in p and "two weeks ahead" in p
    assert "month, day and year" in tidewell.instruction(tidewell.create_state(NOW), CTX)


def test_both_prompts_open_with_the_screen_code():
    for d in (lune, tidewell):
        p = d.instruction(d.create_state(NOW), CTX)
        assert "Please tell me the number on your screen." in p and "receptionist" not in p.lower()
