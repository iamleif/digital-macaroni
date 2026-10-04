from typing import Any

import pytest

from app import email
from app.demos.formfield import formfield
from app.demos.northline import northline
from tests.test_demos import CTX, runner, slots_for


@pytest.fixture
def outbox(monkeypatch):
    sent: list[dict[str, Any]] = []

    async def send(to, subject, html_body, text_body, from_name):
        sent.append({"to": to, "subject": subject, "html": html_body, "text": text_body, "from": from_name})
        return None

    monkeypatch.setattr(email, "send", send)
    return sent


async def call(demo, state, op: str, args: dict[str, Any]):
    o = demo.operations[op]
    return await o.run(state, o.params.model_validate(args), CTX)  # type: ignore[misc,union-attr]


async def test_ellie_emails_the_booked_visit_once(outbox):
    state, run = runner(northline)
    early = await call(northline, state, "email_confirmation", {"email": "alex@example.com", "callerConfirmed": True})
    assert early.error == "nothing_booked" and not outbox
    run("book_appointment", {"slotId": slots_for(run)[0], "service": "heating_repair", "name": "Alex Taylor", "address": "48 Birch Lane, Springfield", "issue": "Furnace not heating", "callerConfirmed": True})
    r = await call(northline, state, "email_confirmation", {"email": "alex dot taylor at example dot com", "callerConfirmed": True})
    assert r.ok and r.result["to"] == "a•••r@example.com" and northline.view(state)["emailed"]["to"] == "a•••r@example.com"
    msg = outbox[0]
    assert msg["to"] == "alex.taylor@example.com" and msg["from"] == "Ellie at Northline"
    assert "Heating repair" in msg["text"] and "48 Birch Lane, Springfield" in msg["text"] and state.appointments[0].id in msg["text"]
    assert "Book a chat with us" in msg["html"] and "digitalmacaroni.io/contact" in msg["html"]
    again = await call(northline, state, "email_confirmation", {"email": "other@example.com", "callerConfirmed": True})
    assert again.error == "already_sent" and len(outbox) == 1


async def test_theo_emails_the_reservation_with_the_items_picture(outbox):
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "ridge-sage", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    r = await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert r.ok and formfield.view(state)["emailed"]["to"] == "s•••m@example.com"
    msg = outbox[0]
    assert msg["from"] == "Theo at Form & Field" and "Ridge Table Lamp" in msg["subject"]
    assert "/email-assets/products/ridge-lamp.jpg" in msg["html"] and "Sage green" in msg["text"] and "210 Market Street" in msg["text"]


async def test_theo_uses_a_drawing_for_items_without_a_photograph(outbox):
    state, run = runner(formfield)
    run("reserve_item", {"variantId": "moss-green", "quantity": 1, "name": "Sam Rivera", "callerConfirmed": True})
    await call(formfield, state, "email_reservation", {"email": "sam@example.com", "callerConfirmed": True})
    assert "/email-assets/products/moss-lamp.png" in outbox[0]["html"]


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
