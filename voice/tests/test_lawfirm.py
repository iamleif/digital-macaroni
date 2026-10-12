from datetime import datetime, timezone
from typing import Any

from app.demos.lawfirm import lawfirm
from app.demos.types import OpContext, OpResult

# A Thursday morning in Denver.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="browser")
TOMORROW = "2026-10-02"  # Friday
SATURDAY = "2026-10-03"

CRASH = {"name": "Alex Taylor", "accidentType": "car", "accidentDate": "2026-09-20", "accidentState": "CO", "accidentCity": "Denver", "injuries": "Neck and back pain", "treatment": "emergency_room", "atFault": "other_party", "policeReport": "yes", "otherPartyInsured": "yes", "hasLawyer": False}


def runner():
    state = lawfirm.create_state(NOW)

    def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = lawfirm.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        return o.run(state, parsed, CTX)

    return state, run


def qualified(**over):
    state, run = runner()
    assert run("note_intake", {**CRASH, **over}).ok
    assert run("check_conflicts", {"callerName": over.get("name", "Alex Taylor"), "opposingParty": over.get("opposingParty")}).ok
    return state, run


def slots(run, day=TOMORROW):
    return [s["slotId"] for s in run("check_availability", {"date": day}).result["available"]]


class TestLawFirm:
    def test_qualifies_a_typical_crash_and_never_hands_the_agent_a_tier(self):
        state, run = qualified()
        r = run("assess_case")
        assert r.ok and r.result["canTakeCase"] is True
        assert state.assessment["tier"] == "B"
        assert "B" not in str(r.result) and "tier" not in r.result

    def test_surgery_with_clear_fault_is_tier_a_and_goes_to_the_senior_partner(self):
        state, run = qualified(treatment="surgery")
        assert run("assess_case").result["priority"] == "priority"
        assert state.assessment["tier"] == "A"
        found = run("check_availability", {"date": TOMORROW})
        assert found.ok
        assert all(s["attorney"] == "Marcus Finch" for s in found.result["available"] if s["attorney"])

    def test_wont_assess_before_the_basics_or_the_conflict_check(self):
        state, run = runner()
        assert run("assess_case").error == "missing_details"
        run("note_intake", CRASH)
        assert run("assess_case").error == "conflict_check_first"

    def test_declines_politely_outside_washington(self):
        state, run = qualified(accidentState="UT")
        r = run("assess_case")
        assert r.ok and r.result["canTakeCase"] is False
        assert state.assessment["reason"] == "out_of_state"
        assert run("check_availability", {"date": TOMORROW}).error == "not_qualified"

    def test_declines_when_already_represented_when_at_fault_or_out_of_time_or_not_hurt(self):
        for over, reason in [
            ({"hasLawyer": True}, "has_lawyer"),
            ({"atFault": "me"}, "at_fault"),
            ({"accidentDate": "2022-05-01"}, "out_of_time"),
            ({"accidentType": "workplace"}, "outside_practice"),
            ({"injuries": "", "treatment": "none"}, "no_injury"),
        ]:
            state, run = runner()
            run("note_intake", {k: v for k, v in {**CRASH, **over}.items() if v != ""})
            run("check_conflicts", {"callerName": "Alex Taylor"})
            run("assess_case")
            assert state.assessment["reason"] == reason, over

    def test_flags_a_time_limit_that_is_close(self):
        state, run = qualified(accidentDate="2023-12-01")
        r = run("assess_case")
        assert "timeLimits" in r.result
        assert "Time limit within 6 months" in state.assessment["flags"]

    def test_conflict_check_finds_a_current_client_and_never_says_who(self):
        state, run = runner()
        run("note_intake", CRASH)
        r = run("check_conflicts", {"callerName": "Alex Taylor", "opposingParty": "Hollis Plumbing Co"})
        assert r.result["conflict"] is True
        assert "Hollis" not in r.result["say"]
        run("assess_case")
        assert state.assessment["reason"] == "conflict"

    def test_conflict_check_finds_an_adverse_party_calling_in(self):
        _, run = runner()
        assert run("check_conflicts", {"callerName": "marcus webb"}).result["conflict"] is True

    def test_first_name_only_is_asked_for_a_last_name(self):
        _, run = runner()
        assert run("check_conflicts", {"callerName": "Priya"}).error == "need_last_name"
        assert run("check_conflicts", {"callerName": "Priya Singh"}).result["conflict"] is False

    def test_rejects_a_future_accident_date(self):
        _, run = runner()
        assert run("note_intake", {"accidentDate": "2026-12-01"}).error == "future_date"

    def test_books_once_and_moves_the_same_consultation(self):
        state, run = qualified()
        run("assess_case")
        open_ = slots(run)
        assert open_
        book = {"slotId": open_[0], "format": "phone", "callerConfirmed": True}
        first = run("book_consultation", book)
        assert first.ok
        assert run("book_consultation", book).result["duplicate"] is True
        other = run("book_consultation", {**book, "slotId": open_[1]})
        assert other.error == "already_booked"
        later = [s["slotId"] for s in run("check_availability", {"date": TOMORROW}).result["available"] if s["slotId"] != open_[0]]
        moved = run("reschedule_consultation", {"consultationId": first.result["consultationId"], "newSlotId": later[0], "callerConfirmed": True})
        assert moved.ok
        assert len([c for c in state.consults if c.status == "booked"]) == 1
        assert state.consults[0].changes == 1

    def test_refuses_to_book_a_time_it_never_offered_or_before_qualifying(self):
        state, run = runner()
        assert run("book_consultation", {"slotId": f"{TOMORROW}T10", "format": "phone", "callerConfirmed": True}).error == "not_qualified"
        qualified_state, qrun = qualified()
        qrun("assess_case")
        assert qrun("book_consultation", {"slotId": f"{TOMORROW}T10", "format": "phone", "callerConfirmed": True}).error == "slot_not_offered"

    def test_weekends_have_no_consultations_and_offer_the_next_openings(self):
        _, run = qualified()
        run("assess_case")
        r = run("check_availability", {"date": SATURDAY})
        assert r.ok and r.result["available"] == [] and r.result["reason"] == "weekend" and r.result["nextAvailable"]

    def test_the_view_ranks_this_call_in_the_morning_brief_and_hides_nothing_from_the_firm(self):
        state, run = qualified()
        run("assess_case")
        v = lawfirm.view(state)
        assert v["assessment"]["tier"] == "B"
        rows = v["brief"]["rows"]
        assert any(r["mine"] for r in rows) and rows == sorted(rows, key=lambda r: {"A": 0, "B": 1, "C": 2, None: 3}[r["tier"]])
        assert v["conflict"]["status"] == "clear"
        fields = {f["key"]: f for sec in v["record"]["sections"] for f in sec["fields"]}
        assert v["record"]["opened"] and v["record"]["number"].startswith("PI-") and v["record"]["stage"] == "qualified"
        assert fields["name"]["value"] == "Alex Taylor" and fields["type"]["value"] == "Car crash" and fields["treatment"]["value"] == "Emergency room"
        assert "Car crash" in fields["type"]["options"] and fields["police"]["value"] == "Yes"
        assert v["note"] and "Tier B" in v["note"]
        assert any("police report" in task["title"].lower() for task in v["tasks"])

    def test_takes_a_message_once(self):
        state, run = runner()
        m = {"name": "Alex Reed", "callbackNumber": "2065550142", "summary": "Wants to speak to a person"}
        assert run("take_message", m).ok
        assert run("take_message", m).result["duplicate"] is True
        assert len(state.messages) == 1


def test_the_record_opens_on_the_first_detail_and_injury_areas_become_chips():
    state, run = runner()
    assert lawfirm.view(state)["record"]["opened"] is False
    run("note_intake", {"injuryAreas": ["neck", "back"], "missedWork": "yes", "otherPartyInsurer": "State Farm"})
    v = lawfirm.view(state)
    fields = {f["key"]: f for sec in v["record"]["sections"] for f in sec["fields"]}
    assert v["record"]["opened"] and fields["areas"]["value"] == ["Neck", "Back"] and fields["work"]["value"] == "Yes" and fields["insurer"]["value"] == "State Farm"


def test_note_intake_says_what_to_ask_next_and_never_repeats_an_answered_question():
    state, run = runner()
    r = run("note_intake", {"accidentType": "car"}).result
    assert "When did it happen" in r["next"] and r["nextIsRequired"] and "the date it happened" in r["stillNeeded"]
    asked = [r["next"]]
    for patch in ({"accidentDate": "2026-09-20"}, {"accidentState": "CO"}, {"injuryAreas": ["neck"]}, {"missedWork": "no"}):
        r = run("note_intake", patch).result
        assert r["next"] not in asked
        asked.append(r["next"])
    assert "tingling" in r["next"]  # symptoms follow missed work, in the firm's order
    # Answering ahead of the tool skips those questions.
    r = run("note_intake", {"symptoms": "headaches", "treatment": "emergency_room", "treatingProvider": "Denver Health", "atFault": "other_party"}).result
    assert "police report" in r["next"]
    assert run("note_intake", {"policeReport": "yes"}).result["next"] not in asked


def test_declined_optional_questions_are_not_asked_again_but_required_ones_are():
    state, run = runner()
    run("note_intake", {k: v for k, v in CRASH.items() if k not in ("policeReport", "otherPartyInsured")})
    r = run("note_intake", {"declined": ["policeReport", "accidentDate"]}).result
    assert "police report" not in r["next"]
    assert state.declined == {"policeReport"}


def test_intake_reports_complete_when_everything_is_collected():
    state, run = runner()
    full = {**CRASH, "injuryAreas": ["neck", "back"], "missedWork": "yes", "symptoms": "dizziness", "treatingProvider": "Denver Health",
            "otherPartyInsurer": "State Farm", "opposingParty": "Sam Lee", "witnesses": "none", "vehicleDamage": "rear bumper",
            "heardFrom": "a friend", "phone": "3035550142", "email": "alex@example.com"}
    r = run("note_intake", full).result
    assert r["next"] is None and r["stillNeeded"] == [] and "conflict check" in r["message"]
    # Required-only is not complete: optional questions are still surfaced, flagged as optional.
    state, run = runner()
    r = run("note_intake", {k: CRASH[k] for k in ("name", "accidentType", "accidentDate", "accidentState", "treatment", "atFault", "hasLawyer")}).result
    assert r["stillNeeded"] == [] and r["next"] and r["nextIsRequired"] is False


class TestCalendar:
    def test_bookable_for_exactly_fourteen_days(self):
        state, run = qualified()
        assert run("assess_case").ok
        assert slots(run, "2026-10-14")  # day 13, a Wednesday
        r = run("check_availability", {"date": "2026-10-15"})  # day 14
        assert r.error == "outside_calendar"
        assert r.message.startswith("This demo's calendar only goes out two weeks, through Wednesday")

    def test_busy_blocks_differ_by_date_and_not_by_call(self):
        def pattern(state, day):
            return sorted((b.attorney_id, b.hour) for b in state.calendar if b.date == day)

        a, b = lawfirm.create_state(NOW), lawfirm.create_state(datetime(2026, 10, 1, 20, 30, tzinfo=timezone.utc))
        days = [d for d in dict.fromkeys(x.date for x in a.calendar)]
        assert len(days) >= 9
        assert len({tuple(pattern(a, d)) for d in days}) == len(days)
        assert all(pattern(a, d) == pattern(b, d) for d in days if d in {x.date for x in b.calendar} and d not in (a.today, b.today))
        week1, week2 = [pattern(a, d) for d in days[:5]], [pattern(a, d) for d in days[5:10]]
        assert week1 != week2
        assert len({len(pattern(a, d)) for d in days}) > 2
        assert any(x.title for x in a.calendar) and len({x.title for x in a.calendar}) > 3

    def test_every_day_keeps_senior_partner_time_and_most_of_the_day_is_taken(self):
        state = lawfirm.create_state(NOW)
        senior = {b.date: 0 for b in state.calendar}
        for d in senior:
            senior[d] = len([h for h in lawfirm_hours() if not any(b.attorney_id == "marcus" and b.date == d and b.hour == h for b in state.calendar)])
        assert min(senior.values()) >= 1
        # Seven consultation hours for each of three attorneys: nobody's day is wide open.
        for d in senior:
            free = 21 - len([b for b in state.calendar if b.date == d])
            assert 1 <= free <= 5, (d, free)

    def test_last_name_is_asked_for_and_booking_needs_it(self):
        state, run = runner()
        skip = ["missedWork", "symptoms", "treatingProvider", "opposingParty", "witnesses", "vehicleDamage", "heardFrom"]
        r = run("note_intake", {**CRASH, "name": "Alex", "declined": skip})
        assert r.result["next"] == "And your last name?"
        assert run("check_conflicts", {"callerName": "Alex"}).error == "need_last_name"
        run("check_conflicts", {"callerName": "Alex Taylor"})
        assert run("assess_case").ok
        assert state.intake["name"] == "Alex Taylor"
        sid = slots(run)[0]
        state.intake["name"] = "Alex"
        assert run("book_consultation", {"slotId": sid, "format": "phone", "callerConfirmed": True}).error == "missing_details"
        run("note_intake", {"name": "Alex Taylor"})
        assert run("book_consultation", {"slotId": sid, "format": "phone", "callerConfirmed": True}).ok

    def test_prompt_says_just_a_moment_before_the_calendar(self):
        p = lawfirm.instruction(lawfirm.create_state(NOW), CTX)
        assert "Just a moment" not in p and "And your last name?" in p and "two weeks ahead" in p


def lawfirm_hours():
    from app.demos.lawfirm.store import HOURS

    return HOURS
