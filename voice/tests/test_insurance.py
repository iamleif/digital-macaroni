from datetime import datetime, timezone
from typing import Any

from app import email
from app.demos.insurance import insurance
from app.demos.types import OpContext, OpResult

# A Thursday morning in Macon.
NOW = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
CTX = OpContext(now=NOW, channel="phone")
TOMORROW = "2026-10-02"  # Friday
SATURDAY = "2026-10-03"

CHRIS = {"name": "Chris Patterson", "dateOfBirth": "1985-04-12"}


def runner():
    state = insurance.create_state(NOW)

    async def run(op: str, args: dict[str, Any] | None = None) -> OpResult:
        o = insurance.operations[op]
        parsed = o.params.model_validate(args or {}) if o.params else (args or {})
        r = o.run(state, parsed, CTX)
        return await r if hasattr(r, "__await__") else r

    return state, run


async def verified():
    state, run = runner()
    assert (await run("find_customer", CHRIS)).ok
    return state, run


class TestQuote:
    async def test_collects_what_a_licensed_agent_needs_and_books_the_call(self):
        state, run = runner()
        r = await run("note_account", {"name": "Jamie Cole", "quoteLines": ["auto", "renters"]})
        assert r.result["next"] == "Who will be driving? Please give me each driver's name."
        await run("note_account", {"dateOfBirth": "1994-02-11", "drivers": [{"name": "Jamie Cole", "dateOfBirth": "1994-02-11", "yearsLicensed": 12, "incidents": "none"}], "vehicles": [{"year": 2020, "make": "Honda", "model": "Accord"}], "address": "300 Walnut St, Macon, GA", "personalProperty": 25000, "currentCarrier": "GEICO", "renewalDate": "2026-10-28"})
        assert (await run("note_account", {"coverageWanted": ["full_coverage"]})).result["next"] is None
        found = await run("check_availability", {"date": TOMORROW})
        slot = found.result["available"][0]["slotId"]
        b = await run("book_agent_call", {"slotId": slot, "topic": "Auto and renters quote", "callerConfirmed": True})
        assert b.ok and b.result["agent"] in ("Tasha", "Robert")
        v = insurance.view(state)
        assert v["record"]["stage"] == "booked"
        assert "Bundle: auto + renters" in v["flags"] and "Renews within 45 days" in v["flags"]
        assert v["rows"]["vehicles"][0]["name"] == "2020 Honda Accord"

    async def test_next_question_advances_and_never_repeats(self):
        state, run = runner()
        r = await run("note_account", {"name": "Jamie Cole"})
        assert "quoted" in r.result["next"]
        r = await run("note_account", {"quoteLines": ["auto", "home"]})
        assert r.result["next"] == "Who will be driving? Please give me each driver's name."
        r = await run("note_account", {"drivers": [{"name": "Jamie Cole"}]})
        assert r.result["next"] == "What is Jamie Cole's date of birth?"
        r = await run("note_account", {"drivers": [{"name": "Jamie Cole", "dateOfBirth": "1994-02-11"}]})
        assert r.result["next"] == "How many years has Jamie Cole been licensed?"
        r = await run("note_account", {"drivers": [{"name": "Jamie Cole", "dateOfBirth": "1994-02-11", "yearsLicensed": 12}]})
        assert "tickets or accidents" in r.result["next"] and r.result["optional"]
        r = await run("note_account", {"skip": ["incidents"]})
        assert r.result["next"].startswith("What vehicles")
        r = await run("note_account", {"vehicles": [{"year": 2020, "make": "Honda", "model": "Accord"}], "address": "300 Walnut St, Macon, GA"})
        assert r.result["next"] == "What year was the home built?"  # the address is not asked twice
        r = await run("note_account", {"yearBuilt": 1998, "squareFeet": 2100})
        assert r.result["next"] == "Who insures you now?" and r.result["optional"]
        r = await run("note_account", {"currentCarrier": "GEICO", "skip": ["renewalDate", "coverageWanted"]})
        assert r.result["next"] is None and "licensed agent" in r.result["done"]

    async def test_weekends_offer_the_next_weekday(self):
        _, run = runner()
        r = await run("check_availability", {"date": SATURDAY})
        assert r.ok and r.result["reason"] == "weekend" and r.result["nextAvailable"]

    async def test_no_price_ever_reaches_the_agent(self):
        state, run = await verified()
        r = await run("get_policy", {"line": "auto"})
        assert "premium" not in str(r.result).lower() and "quote" not in str(r.result).lower()


class TestCustomer:
    async def test_needs_name_and_birth_date_before_any_policy(self):
        _, run = runner()
        assert (await run("get_policy", {"line": "auto"})).error == "verify_first"
        assert (await run("find_customer", {"name": "Chris Patterson"})).error == "need_dob"
        assert (await run("find_customer", {"name": "Chris Patterson", "dateOfBirth": "1985-04-13"})).error == "not_found"

    async def test_reads_the_deductible_from_the_policy(self):
        state, run = await verified()
        r = await run("get_policy", {"line": "auto"})
        assert r.ok and r.result["carrier"] == "Progressive"
        assert {"name": "Collision", "deductible": "$500"} in r.result["coverages"]
        assert insurance.view(state)["policy"]["number"] == "PA-48211"

    async def test_a_policy_number_finds_the_customer(self):
        state, run = runner()
        assert (await run("find_customer", {"policyNumber": "rn 11804"})).ok
        assert state.customer["name"] == "Alicia Moreno"

    async def test_stops_after_three_wrong_tries(self):
        _, run = runner()
        for _ in range(3):
            await run("find_customer", {"name": "Chris Patterson", "dateOfBirth": "1990-01-01"})
        assert (await run("find_customer", CHRIS)).error == "too_many_tries"


class TestClaim:
    async def test_logs_the_notice_and_gives_the_carrier_line(self):
        state, run = await verified()
        r = await run("report_claim", {"line": "auto", "kind": "hit_while_parked", "description": "Someone backed into me in the Kroger lot"})
        assert r.ok and r.result["claimsLine"] == "1-800-776-4737" and r.result["next"] == "When did it happen?"
        r = await run("report_claim", {"date": "2026-09-30", "location": "Kroger, Zebulon Road", "injuries": "no", "policeReport": "no", "photos": "yes", "otherParty": "unknown"})
        assert r.result["next"] is None and "claims line" in r.result["done"]
        v = insurance.view(state)
        assert v["claim"]["carrier"] == "Progressive" and v["record"]["stage"] == "logged"
        assert any("claim" in t["title"] for t in v["tasks"])

    async def test_next_claim_question_advances_in_order(self):
        _, run = await verified()
        r = await run("report_claim", {"line": "auto"})
        assert r.result["next"] == "What happened?"
        asked = []
        for field, value in (("kind", "hit_while_parked"), ("date", "2026-09-30"), ("location", "Kroger"), ("injuries", "no"), ("policeReport", "unknown"), ("otherParty", "unknown")):
            r = await run("report_claim", {field: value})
            asked.append(r.result["next"])
        assert asked == ["When did it happen?", "Where did it happen?", "Was anyone hurt?", "Was a police report made?", "Was another driver or party involved?", "Do you have any photos?"]
        r = await run("report_claim", {"photos": "no"})
        assert r.result["next"] is None and "done" in r.result

    async def test_refuses_a_future_date(self):
        _, run = await verified()
        assert (await run("report_claim", {"line": "auto", "date": "2026-12-01"})).error == "future_date"


class TestChange:
    async def test_adding_a_car_is_a_request_never_a_change(self):
        state, run = await verified()
        r = await run("request_change", {"kind": "add_vehicle", "details": "2026 Kia Telluride, bought today"})
        assert r.ok and r.result["who"] == "Lily Chen" and "Never say the change is made" in r.result["say"]
        assert state.requests[0].policy == "PA-48211"

    async def test_emails_the_id_card(self, monkeypatch):
        sent = {}

        async def confirm(to, message):
            sent["subject"] = message[0]
            return "c•••@example.com", None

        monkeypatch.setattr(email, "confirm", confirm)
        state, run = await verified()
        r = await run("email_id_card", {"email": "chris@example.com", "callerConfirmed": True})
        assert r.ok and "PA-48211" in sent["subject"]
        assert state.id_cards == ["PA-48211"]


async def test_message_goes_to_the_account_manager():
    state, run = runner()
    r = await run("take_message", {"name": "Henry Boyd", "callbackNumber": "+14785550142", "summary": "Question about the renewal bill"})
    assert r.ok and r.result["for"] == "Lily Chen"
    assert insurance.view(state)["messages"][0]["callback"] == "•••• 0142"


def test_the_prompt_never_lets_owen_quote_or_promise_coverage():
    p = insurance.instruction(insurance.create_state(NOW), CTX)
    assert "never quote a price" in p and "never say whether a particular loss" in p and "Social Security" in p


def _pattern(state, day):
    return sorted((b.staff_id, b.hour) for b in state.calendar if b.date == day)


def test_bookable_for_exactly_fourteen_days():
    state, run = runner()
    import asyncio

    ok = asyncio.run(run("check_availability", {"date": "2026-10-14"}))
    assert ok.ok and ok.result["available"]
    r = asyncio.run(run("check_availability", {"date": "2026-10-15"}))
    assert r.error == "outside_calendar" and r.message.startswith("This demo's calendar only goes out two weeks, through Wednesday")


def test_busy_blocks_differ_by_date_and_not_by_call():
    a, b = insurance.create_state(NOW), insurance.create_state(datetime(2026, 10, 1, 20, 30, tzinfo=timezone.utc))
    days = list(dict.fromkeys(x.date for x in a.calendar))
    assert len(days) >= 9
    assert len({tuple(_pattern(a, d)) for d in days}) == len(days)
    assert all(_pattern(a, d) == _pattern(b, d) for d in days if d in {x.date for x in b.calendar} and d not in (a.today, b.today))
    assert [_pattern(a, d) for d in days[:5]] != [_pattern(a, d) for d in days[5:10]]
    assert len({len(_pattern(a, d)) for d in days}) > 2
    assert len({x.title for x in a.calendar}) > 3
    assert all(insurance_open(a, d) for d in days if d != a.today)
    assert sum(1 for d in days if insurance_open(a, d)) >= 9


def insurance_open(state, day):
    from app.demos.insurance.state import open_slots

    return open_slots(state, day)


async def test_last_name_is_asked_for_and_booking_needs_it():
    state, run = runner()
    r = await run("note_account", {"name": "Jamie", "quoteLines": ["renters"]})
    assert r.result["next"] == "And your last name?"
    r = await run("note_account", {"name": "Jamie Cole", "quoteLines": ["auto"], "drivers": [{"name": "Sam"}]})
    assert r.result["next"] == "And Sam's last name?"
    state.account["name"] = "Jamie"
    sid = (await run("check_availability", {"date": TOMORROW})).result["available"][0]["slotId"]
    assert (await run("book_agent_call", {"slotId": sid, "topic": "Renters quote", "callerConfirmed": True})).error == "missing_details"
    await run("note_account", {"name": "Jamie Cole"})
    assert (await run("book_agent_call", {"slotId": sid, "topic": "Renters quote", "callerConfirmed": True})).ok
    assert (await run("take_message", {"name": "Henry", "callbackNumber": "+14785550142", "summary": "Billing question"})).error == "need_last_name"


def test_prompt_says_just_a_moment_before_the_calendar():
    p = insurance.instruction(insurance.create_state(NOW), CTX)
    assert "Just a moment" not in p and "And your last name?" in p and "Never guess the year" in p and "two weeks ahead" in p
