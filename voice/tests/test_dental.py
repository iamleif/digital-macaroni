from datetime import datetime, timezone
from typing import Any

from app import email
from app.demos.dental import dental
from app.demos.dental.state import HOLDS, parse_slot
from app.demos.types import OpContext, OpResult

# A Thursday morning in Chicago.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="phone")
MONDAY = "2026-10-05"
SATURDAY = "2026-10-03"


def runner():
    state = dental.create_state(NOW)

    async def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = dental.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        r = o.run(state, parsed, CTX)
        return await r if hasattr(r, "__await__") else r

    return state, run


def first(r: OpResult) -> str:
    return (r.result["available"] or r.result["nextAvailable"])[0]["slotId"]


async def test_new_patient_with_delta_is_in_network_and_gets_90_minutes_in_a_hygiene_chair():
    state, run = runner()
    await run("note_patient", {"name": "Alex Taylor", "dateOfBirth": "1990-05-04", "newPatient": True, "reason": "new_patient", "relationship": "self", "memberId": "DD123", "medicalAlert": "takes blood thinners"})
    r = await run("check_insurance", {"carrier": "Delta"})
    assert r.result["inNetwork"] is True and "never say what's covered" in r.result["say"]
    slot = first(await run("check_availability", {"type": "new_patient", "date": MONDAY}))
    assert parse_slot(slot)[2] in ("op3", "op4")
    b = await run("book_appointment", {"slotId": slot, "type": "new_patient", "callerConfirmed": True})
    assert b.ok and "forms" in b.result["say"]
    mine = next(a for a in state.book if not a.existing)
    assert mine.minutes == 90 and mine.alert and mine.exam
    v = dental.view(state)
    assert v["record"]["stage"] == "booked" and any(t["title"].startswith("Verify Delta Dental") for t in v["tasks"])


async def test_out_of_network_says_we_file_it():
    _, run = runner()
    r = await run("check_insurance", {"carrier": "Humana"})
    assert r.result["inNetwork"] is False and "file the claim" in r.result["say"]


async def test_emergencies_only_use_the_held_slots():
    state, run = runner()
    await run("note_patient", {"howLong": "two days"})
    t = await run("triage_emergency", {"painLevel": 8, "swelling": False, "fever": False, "faceInjuryOrAccident": False})
    assert t.result["goTo"] == "same_day"
    r = await run("check_availability", {"type": "emergency", "date": MONDAY})
    starts = {(parse_slot(s["slotId"])[2], parse_slot(s["slotId"])[1]) for s in r.result["available"]}
    assert starts <= set(HOLDS) and starts
    # Nothing else may be booked into a hold.
    for s in (await run("check_availability", {"type": "filling_consult", "date": MONDAY})).result["available"]:
        assert (parse_slot(s["slotId"])[2], parse_slot(s["slotId"])[1]) not in HOLDS


async def test_swelling_toward_the_eye_goes_to_the_er_and_blocks_booking():
    _, run = runner()
    r = await run("triage_emergency", {"swelling": True, "swellingSpreading": True})
    assert r.result["goTo"] == "er" and "911" in r.result["say"]
    assert (await run("check_availability", {"type": "emergency", "date": MONDAY})).error == "emergency_room"


async def test_knocked_out_tooth_is_within_the_hour():
    _, run = runner()
    r = await run("triage_emergency", {"knockedOutTooth": True})
    assert r.result["goTo"] == "now" and "milk" in r.result["say"]


async def test_a_recall_too_early_for_insurance_is_flagged():
    _, run = runner()
    assert (await run("find_patient", {"name": "John Edwards", "dateOfBirth": "1968-02-09", "callerSaysTheyAreAPatient": True})).ok
    r = await run("check_availability", {"type": "cleaning", "date": MONDAY})
    assert "insurance usually covers the next one from" in r.result["frequency"]


async def test_an_overdue_recall_books_with_her_usual_hygienist():
    state, run = runner()
    await run("find_patient", {"name": "Karen Davis", "dateOfBirth": "1979-06-22", "callerSaysTheyAreAPatient": True})
    r = await run("check_availability", {"type": "cleaning", "date": MONDAY})
    assert "frequency" not in r.result
    assert r.result["available"][0]["with"] == "Jenna Morris" or r.result["available"]


async def test_perio_maintenance_is_for_current_patients():
    _, run = runner()
    assert (await run("check_availability", {"type": "perio_maintenance", "date": MONDAY})).error == "existing_only"


async def test_closed_on_weekends_and_a_short_notice_list():
    state, run = runner()
    r = await run("check_availability", {"type": "cleaning", "date": SATURDAY})
    assert r.result["reason"] == "closed"
    await run("note_patient", {"name": "Sam Lee"})
    assert (await run("add_to_asap_list", {"type": "cleaning", "preferred": "weekday mornings"})).ok
    assert any("Short-notice" in t["title"] for t in dental.view(state)["tasks"])


async def test_the_email_never_carries_symptoms(monkeypatch):
    sent = {}

    async def confirm(to, message):
        sent["text"] = message[2]
        return "a•••@example.com", None

    monkeypatch.setattr(email, "confirm", confirm)
    _, run = runner()
    await run("note_patient", {"name": "Alex Taylor", "symptoms": ["pain", "swelling"]})
    await run("triage_emergency", {"painLevel": 7})
    slot = first(await run("check_availability", {"type": "emergency", "date": MONDAY}))
    await run("book_appointment", {"slotId": slot, "type": "emergency", "callerConfirmed": True})
    assert (await run("email_confirmation", {"email": "alex@example.com", "callerConfirmed": True})).ok
    assert "swelling" not in sent["text"].lower() and "Emergency visit" in sent["text"]


def test_the_prompt_never_lets_june_diagnose_or_promise_coverage():
    p = dental.instruction(dental.create_state(NOW), CTX)
    assert "Never diagnose" in p and "Never say a visit is covered" in p and "receptionist" not in p.lower()


async def test_never_looks_up_someone_who_is_new_or_has_not_said():
    state, run = runner()
    r = await run("find_patient", {"name": "Kevin Sweeney", "dateOfBirth": "1942-02-07", "callerSaysTheyAreAPatient": False})
    assert r.error == "new_patient" and "Ask whether they've been to see us before" in r.message
    await run("note_patient", {"name": "Kevin Sweeney", "newPatient": True})
    assert (await run("find_patient", {"name": "Kevin Sweeney", "dateOfBirth": "1942-02-07", "callerSaysTheyAreAPatient": True})).error == "new_patient"
    assert state.lookups == 0


async def nxt(run, args):
    return (await run("note_patient", args)).result


async def test_next_asks_the_name_first_and_never_repeats_answered_questions():
    state, run = runner()
    r = await nxt(run, {"reason": "cleaning"})
    assert r["next"] == "Can I get your name?" and r["nextField"] == "name"
    r = await nxt(run, {"name": "Alex Taylor"})
    assert r["nextField"] == "newPatient"
    r = await nxt(run, {"newPatient": True})
    assert r["nextField"] == "dateOfBirth"
    r = await nxt(run, {"dateOfBirth": "1990-05-04"})
    assert r["nextField"] == "lastVisit"  # reason was already given
    r = await nxt(run, {"lastVisit": "two years ago"})
    assert r["nextField"] == "insurance"
    assert (await run("check_insurance", {"carrier": "Delta"})).ok
    r = await nxt(run, {"reason": "cleaning"})
    assert r["nextField"] == "relationship"
    r = await nxt(run, {"relationship": "spouse"})
    assert r["nextField"] == "subscriber"
    r = await nxt(run, {"subscriber": "Pat Taylor"})
    assert r["nextField"] == "memberId"
    r = await nxt(run, {"memberId": "DD123"})
    assert r["nextField"] == "groupNumber"
    r = await nxt(run, {})  # optional: asked once only
    assert r["nextField"] == "medicalAlert"
    r = await nxt(run, {})
    assert r["next"] is None and "Chart complete" in r["then"]


async def test_skipped_questions_are_not_asked_again_and_no_insurance_skips_the_insurance_list():
    _, run = runner()
    await nxt(run, {"name": "Sam Lee", "newPatient": True, "dateOfBirth": "1985-01-02", "reason": "cleaning"})
    r = await nxt(run, {"skipped": ["lastVisit", "insurance"]})
    assert r["nextField"] == "medicalAlert"
    r = await nxt(run, {"medicalAlert": "allergic to penicillin"})
    assert r["next"] is None


async def test_a_child_gets_the_child_questions():
    _, run = runner()
    r = await nxt(run, {"child": True})
    assert r["next"] == "What's your child's name?"
    r = await nxt(run, {"name": "Mia Lee", "newPatient": True})
    assert r["nextField"] == "age"
    r = await nxt(run, {"age": 6})
    assert r["nextField"] == "dateOfBirth" and "their" in r["next"]


async def test_a_found_patient_is_not_asked_the_new_patient_list():
    _, run = runner()
    assert (await run("find_patient", {"name": "Karen Davis", "dateOfBirth": "1979-06-22", "callerSaysTheyAreAPatient": True})).ok
    r = await nxt(run, {})
    assert r["nextField"] == "reason"
    r = await nxt(run, {"reason": "cleaning"})
    assert r["next"] is None and "Chart complete" in r["then"]


async def test_a_current_patient_not_yet_found_is_sent_to_find_patient():
    _, run = runner()
    r = await nxt(run, {"name": "Karen Davis", "newPatient": False})
    assert r["nextField"] == "dateOfBirth"
    r = await nxt(run, {"dateOfBirth": "1979-06-22"})
    assert r["next"] is None and "find_patient" in r["then"]


async def test_triage_names_the_unanswered_red_flag_question_in_order_before_the_outcome():
    state, run = runner()
    r = await nxt(run, {"symptoms": ["pain"]})
    assert r["nextField"] == "howLong"
    t = await run("triage_emergency", {"painLevel": 6})
    assert t.result["nextField"] == "howLong" and "goTo" not in t.result and not state.triage.get("outcome")
    r = await nxt(run, {"howLong": "since Tuesday"})
    assert r["nextField"] == "swelling"
    t = await run("triage_emergency", {"swelling": True})
    assert t.result["nextField"] == "swellingSpreading"
    t = await run("triage_emergency", {"swellingSpreading": False})
    assert t.result["nextField"] == "troubleBreathingOrSwallowing"
    t = await run("triage_emergency", {"troubleBreathingOrSwallowing": False})
    assert t.result["nextField"] == "fever"
    t = await run("triage_emergency", {"fever": False})
    assert t.result["nextField"] == "faceInjuryOrAccident"
    t = await run("triage_emergency", {"faceInjuryOrAccident": False})
    assert t.result["goTo"] == "same_day" and t.result.get("next") is None
    assert (await nxt(run, {}))["nextField"] == "name"


async def test_red_flags_return_the_outcome_even_with_questions_left():
    state, run = runner()
    t = await run("triage_emergency", {"troubleBreathingOrSwallowing": True})
    assert t.result["goTo"] == "er" and "911" in t.result["say"]
    r = await nxt(run, {})
    assert r["next"] is None and "don't book" in r["then"]
