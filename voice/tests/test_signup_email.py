"""Every email an agent sends goes to the address the visitor signed up with; a different one is refused."""

from dataclasses import replace
from typing import Any

import pytest

from app import email
from app.demos import demos
from app.demos.types import OpContext, email_offer
from tests.test_demos import CTX, runner

SIGNUP = "visitor@acme.com"
WITH = replace(CTX, customer_email=SIGNUP)

# Every summary-capable email tool: (demo id, operation).
TOOLS = [
    ("northline", "email_confirmation"),
    ("lune", "email_confirmation"),
    ("tidewell", "email_confirmation"),
    ("dealership", "email_confirmation"),
    ("realestate", "email_confirmation"),
    ("lawfirm", "email_confirmation"),
    ("dental", "email_confirmation"),
    ("insurance", "email_confirmation"),
    ("hotels", "email_quote"),
    ("travel", "email_itinerary"),
    ("formfield", "email_reservation"),
]
RECAP = "You asked about hours and I took a note for the team."


@pytest.fixture
def outbox(monkeypatch):
    sent: list[dict[str, Any]] = []

    async def any_domain(domain):
        return True

    async def send(to, subject, html_body, text_body, from_name):
        sent.append({"to": to, "subject": subject, "text": text_body})
        return None

    monkeypatch.setattr(email, "receives_mail", any_domain)
    monkeypatch.setattr(email, "send", send)
    return sent


async def call(demo_id: str, state, op: str, args: dict[str, Any], ctx: OpContext):
    o = demos[demo_id].operations[op]
    return await o.run(state, o.params.model_validate(args), ctx)  # type: ignore[misc,union-attr]


@pytest.mark.parametrize("demo_id,op", TOOLS)
async def test_mail_goes_to_the_signup_address_with_no_address_argument(outbox, demo_id, op):
    state, _ = runner(demos[demo_id])
    r = await call(demo_id, state, op, {"recap": RECAP, "callerConfirmed": True}, WITH)
    assert r.ok, r.message
    assert [m["to"] for m in outbox] == [SIGNUP]
    assert r.result["to"] == email.mask(SIGNUP)
    # The same address spoken again, or in the caller's words, is the same mail: de-duplicated.
    again = await call(demo_id, state, op, {"email": "visitor at acme dot com", "recap": RECAP, "callerConfirmed": True}, WITH)
    assert again.ok and len(outbox) == 1


@pytest.mark.parametrize("demo_id,op", TOOLS)
async def test_a_different_address_is_refused_and_nothing_is_sent(outbox, demo_id, op):
    state, _ = runner(demos[demo_id])
    r = await call(demo_id, state, op, {"email": "someone.else@example.com", "recap": RECAP, "callerConfirmed": True}, WITH)
    assert not r.ok and r.error == "email_on_file_only" and "only send to the email they signed up with" in r.message
    assert not outbox


@pytest.mark.parametrize("demo_id,op", TOOLS)
async def test_without_a_signup_email_the_old_flow_still_asks_and_sends(outbox, demo_id, op):
    state, _ = runner(demos[demo_id])
    need = await call(demo_id, state, op, {"recap": RECAP, "callerConfirmed": True}, CTX)
    assert not need.ok and need.error == "need_email" and "read it back" in need.message and not outbox
    r = await call(demo_id, state, op, {"email": "sam@example.com", "recap": RECAP, "callerConfirmed": True}, CTX)
    assert r.ok and [m["to"] for m in outbox] == ["sam@example.com"]


async def test_erica_order_confirmation_goes_to_the_signup_address(outbox):
    state, run = runner(demos["formfield"])
    assert run("lookup_order", {"orderNumber": "1042", "email": "emilia@example.com"}).ok
    sent = await call("formfield", state, "email_reservation", {"callerConfirmed": True}, WITH)
    assert sent.ok and [m["to"] for m in outbox] == [SIGNUP]
    assert "999000011042" in outbox[0]["text"] and "FedEx" in outbox[0]["text"]
    outbox.clear()
    refused = await call("formfield", state, "email_reservation", {"email": "emilia@example.com", "callerConfirmed": True}, WITH)
    assert refused.error == "email_on_file_only" and not outbox


async def test_dental_never_stores_a_spoken_email_when_signup_exists(outbox):
    state, run = runner(demos["dental"])
    o = demos["dental"].operations["note_patient"]
    r = o.run(state, o.params.model_validate({"name": "Alex Taylor", "email": "other@example.com"}), WITH)
    assert r.ok and state.patient["email"] == SIGNUP
    sent = await call("dental", state, "email_confirmation", {"recap": RECAP, "callerConfirmed": True}, WITH)
    assert sent.ok and [m["to"] for m in outbox] == [SIGNUP]


async def test_insurance_id_card_goes_to_the_signup_address(outbox):
    state, run = runner(demos["insurance"])
    f = demos["insurance"].operations["find_customer"]
    out = f.run(state, f.params.model_validate({"name": "Chris Patterson", "dateOfBirth": "1985-04-12"}), WITH)
    out = await out if hasattr(out, "__await__") else out
    assert out.ok
    r = await call("insurance", state, "email_id_card", {"callerConfirmed": True}, WITH)
    assert r.ok and [m["to"] for m in outbox] == [SIGNUP]
    outbox.clear()
    bad = await call("insurance", state, "email_id_card", {"email": "chris@example.com", "callerConfirmed": True}, WITH)
    assert bad.error == "email_on_file_only" and not outbox


async def test_lawfirm_and_realestate_and_dealership_do_not_keep_a_spoken_email(outbox):
    for demo_id, op, store, args in (
        ("lawfirm", "note_intake", lambda s: s.intake, {"name": "Pat Doe", "email": "x@example.com"}),
        ("realestate", "note_lead", lambda s: s.lead, {"name": "Pat Doe", "email": "x@example.com"}),
        ("dealership", "note_lead", lambda s: s.lead, {"name": "Pat Doe", "email": "x@example.com"}),
    ):
        state, _ = runner(demos[demo_id])
        o = demos[demo_id].operations[op]
        r = o.run(state, o.params.model_validate(args), WITH)
        assert r.ok and store(state)["email"] == SIGNUP


def test_the_shared_offer_is_short_and_tells_the_agent_what_to_do_both_ways():
    text = email_offer("email_confirmation", "booked visit")
    assert "need_email" in text and "signed up with" in text and len(text) // 4 < 130


async def test_the_tool_layer_hands_the_sessions_setup_email_to_the_operation(outbox):
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.tools import tool_specs

    demo = demos["northline"]
    for setup, wrong, expect in (({"email": SIGNUP}, "other@example.com", [SIGNUP]), (None, "", [])):
        outbox.clear()
        session = SimpleNamespace(
            id="s", channel="phone", state=demo.create_state(datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)), setup=setup, report_url=None, version=1, ended=False,
            emit=lambda e: None, publish_state=lambda: None, record=SimpleNamespace(tool=lambda *a, **k: None),
        )
        spec = next(s for s in tool_specs(demo) if s.name == "email_confirmation")
        out = await spec.run(session, {"recap": RECAP, "callerConfirmed": True})  # type: ignore[arg-type]
        assert ([m["to"] for m in outbox] == expect) and (out["ok"] is bool(expect))
        if setup:
            out = await spec.run(session, {"email": wrong, "recap": RECAP, "callerConfirmed": True})  # type: ignore[arg-type]
            assert out["error"] == "email_on_file_only" and len(outbox) == 1
        else:
            assert out["error"] == "need_email"
