"""Ellie's operations at Lune Salon & Med Spa: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..booking import BookingState, last_name_missing
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, fail, mask_number, ok, send_summary
from .store import ADD_ON_IDS, BUSINESS, CAL, DEPOSIT, DEPOSIT_FROM, SERVICE_IDS, STAFF_IDS, add_on, known_client

ServiceId = Literal[SERVICE_IDS]  # type: ignore[valid-type]
StaffId = Literal[STAFF_IDS]  # type: ignore[valid-type]
AddOnId = Literal[ADD_ON_IDS]  # type: ignore[valid-type]
SERVICE_HELP = "One of: " + ", ".join(f"{s['id']} ({s['name']})" for s in CAL.services) + "."


def get_business_info(state: BookingState, _: Any, ctx: OpContext) -> OpResult:
    return ok("The menu, team, hours and policies", {**BUSINESS, "today": state.today})


class NoteBooking(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Mobile number, once the caller confirmed it.")
    service: Optional[ServiceId] = Field(None, description=SERVICE_HELP)
    stylist: Optional[StaffId] = Field(None, description="Who they asked for, if anyone.")
    addOn: Optional[AddOnId] = Field(None, description="An add-on they said yes to.")
    newClient: Optional[bool] = Field(None, description="True if they have never been to Lune.")
    notes: Optional[str] = Field(None, max_length=200, description="Anything the stylist should know, in the caller's words (e.g. 'going two shades lighter', 'short hair').")
    proposedSlotId: Optional[str] = Field(None, description="The time they chose, before booking.")


def note_booking(state: BookingState, i: NoteBooking, ctx: OpContext) -> OpResult:
    if i.proposedSlotId and i.proposedSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    if (bad := last_name_missing(i.name)):
        return bad
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    if "service" in new:
        new["serviceId"] = new.pop("service")
    changed = [k for k, v in new.items() if state.request.get(k) != v]
    state.request.update(new)
    out: dict[str, Any] = {}
    if "name" in changed:
        c = known_client(state.request["name"])
        state.request["client"] = c
        if c:
            out["knownClient"] = {"usual": c["usual"], "say": "Welcome them back warmly. Confirm the last four digits of their mobile before mentioning anything about past visits."}
    s = state.request.get("serviceId")
    if s and "serviceId" in changed:
        fits = [{"addOn": a, "name": add_on(a)["name"], "price": add_on(a)["price"]} for a in ADD_ON_IDS if s in add_on(a)["with"]]
        if fits:
            out["addOnToOffer"] = fits[0] | {"say": "Offer it once, lightly, after the time is settled. If they say no, drop it."}
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", out, bool(changed))


class CheckAvailability(BaseModel):
    service: ServiceId = Field(description=SERVICE_HELP)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    stylist: Optional[StaffId] = Field(None, description="Only if they asked for someone.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = None


def check_availability(state: BookingState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    s = CAL.service(i.service)
    if s.get("returningOnly") and not ((state.request.get("client") or {}).get("medSpa")):
        return fail("consult_first", "New injectable clients start with the free injectables consultation with Noor. Offer that instead (service consult).")
    state.request["serviceId"] = i.service
    return CAL.check(state, i.service, i.date, i.stylist, i.partOfDay)


class BookAppointment(BaseModel):
    slotId: str = Field(description="From check_availability.")
    service: ServiceId
    name: str = Field(min_length=1, max_length=80)
    addOn: Optional[AddOnId] = Field(None, description="Only if the caller said yes to it.")
    callerConfirmed: bool = Confirmed()


def book_appointment(state: BookingState, i: BookAppointment, ctx: OpContext) -> OpResult:
    if (bad := last_name_missing(i.name)):
        return bad
    s = CAL.service(i.service)
    if s.get("returningOnly") and not ((state.request.get("client") or {}).get("medSpa")):
        return fail("consult_first", "Book the free injectables consultation first.")
    if i.addOn and i.service not in add_on(i.addOn)["with"]:
        return fail("add_on_doesnt_fit", f"{add_on(i.addOn)['name']} doesn't go with {s['name']}.")
    extras: dict[str, Any] = {}
    if i.addOn:
        extras["addOn"] = add_on(i.addOn)["name"]
    if s["price"] >= DEPOSIT_FROM:
        extras["deposit"] = DEPOSIT
    r = CAL.book(state, i.slotId, i.service, i.name, ctx, extras)
    if r.ok and not r.result.get("duplicate"):
        state.request.update({"name": i.name.strip(), "serviceId": i.service, **({"addOn": i.addOn} if i.addOn else {})})
        if extras.get("deposit"):
            r.result["deposit"] = f"A {DEPOSIT} deposit holds it: we text a secure link to pay it, and it comes off the bill. Never take card details."
        r.result["cancellation"] = "Free to move or cancel up to 24 hours before."
    return r


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: BookingState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    return CAL.move(state, i.appointmentId, i.newSlotId, ctx)


class CancelAppointment(BaseModel):
    appointmentId: str
    callerConfirmed: bool = Confirmed()


def cancel_appointment(state: BookingState, i: CancelAppointment, ctx: OpContext) -> OpResult:
    return CAL.cancel(state, i.appointmentId, ctx)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80)


def take_message(state: BookingState, i: TakeMessage, ctx: OpContext) -> OpResult:
    return CAL.message(state, i.name, i.callbackNumber, i.summary, i.preferredTime, False, ctx)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP)
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: BookingState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    booked = CAL.active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        r, sent = await send_summary("lune", "Ellie", i.email, i.recap, state.request.get("name"), messages, did="answered your questions and passed your message to the team")
        if sent:
            state.emailed = sent
        return r
    a = booked[-1]
    d = CAL.describe(a.slot_id)
    s = CAL.service(a.service_id)
    rows = [("With", d["with"]), ("Price", s["priceLabel"] + (f" + {a.extras['addOn']}" if a.extras.get("addOn") else ""))]
    if a.extras.get("deposit"):
        rows.append(("Deposit", f"{a.extras['deposit']} by secure link, taken off the bill"))
    rows += [("Where", BUSINESS["address"].split(".")[0]), ("Changes", "Free up to 24 hours before")]
    v = {"brand": "lune", "agent": "Ellie", "service": s["name"] + (f" + {a.extras['addOn']}" if a.extras.get("addOn") else ""), "day": d["day"], "time": d["time"], "zone": "Pacific", "name": a.name, "reference": a.id, "rows": rows, "did": "found the right person, checked the book and saved your spot"}
    masked, why = await email.confirm(i.email, email.appointment_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
