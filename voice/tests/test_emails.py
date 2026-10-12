from typing import Any

import pytest

from app import email
from app.demos.formfield import formfield
from app.demos.northline import northline
from tests.test_demos import CTX, runner, slots_for


@pytest.fixture
def outbox(monkeypatch):
    sent: list[dict[str, Any]] = []

    async def any_domain(domain):
        return True

    monkeypatch.setattr(email, "receives_mail", any_domain)

    async def send(to, subject, html_body, text_body, from_name):
        sent.append({"to": to, "subject": subject, "html": html_body, "text": text_body, "from": from_name})
        return None

    monkeypatch.setattr(email, "send", send)
    return sent


async def call(demo, state, op: str, args: dict[str, Any]):
    o = demo.operations[op]
    return await o.run(state, o.params.model_validate(args), CTX)  # type: ignore[misc,union-attr]


async def test_ellie_emails_a_summary_or_the_booked_visit(outbox):
    state, run = runner(northline)
    early = await call(northline, state, "email_confirmation", {"email": "alex@example.com", "callerConfirmed": True})
    assert early.error == "no_recap" and not outbox
    summary = await call(northline, state, "email_confirmation", {"email": "alex@example.com", "recap": "You asked what a furnace repair costs; I explained the $89 service fee.", "callerConfirmed": True})
    assert summary.ok and len(outbox) == 1 and "$89 service fee" in outbox[0]["text"] and "Book a call with Leif" in outbox[0]["html"]
    outbox.clear()
    run("book_appointment", {"slotId": slots_for(run)[0], "service": "heating_repair", "name": "Alex Taylor", "address": "48 Birch Lane, Springfield", "issue": "Furnace not heating", "callerConfirmed": True})
    r = await call(northline, state, "email_confirmation", {"email": "alex dot taylor at example dot com", "callerConfirmed": True})
    assert r.ok and r.result["to"] == "a•••r@example.com" and northline.view(state)["emailed"]["to"] == "a•••r@example.com"
    msg = outbox[0]
    assert msg["to"] == "alex.taylor@example.com" and msg["from"] == "Digital Macaroni" and msg["subject"].startswith("Demo · ")
    assert "Heating repair" in msg["text"] and "48 Birch Lane, Springfield" in msg["text"] and state.appointments[0].id in msg["text"]
    assert "Book a call with Leif" in msg["html"] and "cal.com/leif-johansen-pnbduq/ai-agent" in msg["html"]
    same = await call(northline, state, "email_confirmation", {"email": "alex dot taylor at example dot com", "callerConfirmed": True})
    assert same.ok and same.result["duplicate"] and len(outbox) == 1
    other = await call(northline, state, "email_confirmation", {"email": "other@example.com", "callerConfirmed": True})
    assert other.ok and len(outbox) == 2


async def test_erica_emails_the_reservation_with_the_items_picture(outbox):
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "ridge-sage", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    r = await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert r.ok and formfield.view(state)["emailed"]["to"] == "s•••m@example.com"
    msg = outbox[0]
    assert msg["from"] == "Digital Macaroni" and "Ridge Table Lamp" in msg["subject"]
    assert "/email-assets/products/ridge-lamp.jpg" in msg["html"] and "Sage green" in msg["text"] and "210 Market Street" in msg["text"]


async def test_every_catalogue_item_has_a_photograph_for_the_email(outbox):
    from pathlib import Path

    from app.demos.formfield import CATALOGUE, PHOTOS

    assets = Path(__file__).parent.parent / "app" / "email_assets" / "products"
    assert len(CATALOGUE) == 18 and {p["id"] for p in CATALOGUE} == PHOTOS
    assert all((assets / f"{p['id']}.jpg").exists() for p in CATALOGUE)
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "moss-green", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert "/email-assets/products/moss-lamp.jpg" in outbox[0]["html"]


async def test_a_bad_address_is_refused_with_a_plain_instruction(outbox):
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "ridge-sage", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    r = await call(formfield, state, "email_reservation", {"email": "sam at example", "callerConfirmed": True})
    assert r.error == "invalid_email" and "read it back" in r.message and not outbox


def test_every_product_has_an_email_picture():
    from pathlib import Path

    from app.demos.formfield import CATALOGUE, PHOTOS

    folder = Path(email.__file__).parent / "email_assets" / "products"
    for p in CATALOGUE:
        assert (folder / f"{p['id']}.{'jpg' if p['id'] in PHOTOS else 'png'}").exists(), p["id"]


async def test_a_misheard_domain_is_caught_before_anything_is_sent(outbox, monkeypatch):
    async def no_mail(domain):
        return domain != "recent.dev"

    monkeypatch.setattr(email, "receives_mail", no_mail)
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "ridge-sage", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    r = await call(formfield, state, "email_reservation", {"email": "delivered@recent.dev", "callerConfirmed": True})
    assert r.error == "unknown_domain" and "spell the part after the @" in r.message and not outbox
    ok = await call(formfield, state, "email_reservation", {"email": "delivered@resend.dev", "callerConfirmed": True})
    assert ok.ok and len(outbox) == 1


async def test_erica_never_gets_the_tracking_number_but_can_email_it(outbox):
    state, run = runner(formfield)
    r = run("lookup_order", {"orderNumber": "1042", "email": "emilia@example.com"})
    assert r.ok and r.result["carrier"] == "FedEx" and "999000011042" not in str(r.result)
    sent = await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert sent.ok and "999000011042" in outbox[0]["text"] and "FedEx" in outbox[0]["text"] and "Order 1042" in outbox[0]["subject"] + outbox[0]["text"]
    again = await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert again.ok and len(outbox) == 1


async def test_an_order_that_has_not_shipped_has_no_tracking_to_send(outbox):
    state, run = runner(formfield)
    r = run("lookup_order", {"orderNumber": "1051", "email": "tomas.rivera@example.com"})
    assert r.ok and "carrier" not in r.result
    await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert "Added once it ships" in outbox[0]["text"] or "Added once it ships" in outbox[0]["html"]
