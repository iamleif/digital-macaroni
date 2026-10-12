"""Ellie's operations at Tidewell Clinic: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..booking import BookingState, last_name_missing
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, fail, mask_number, ok, send_summary, email_target
from . import store
from .store import BUSINESS, CAL, SERVICE_IDS, STAFF_IDS

ServiceId = Literal[SERVICE_IDS]  # type: ignore[valid-type]
StaffId = Literal[STAFF_IDS]  # type: ignore[valid-type]
SERVICE_HELP = "One of: " + ", ".join(f"{s['id']} ({s['name']})" for s in CAL.services) + "."
# Said by the caller: any of these means 911 or the emergency room, not a booking.
EMERGENCY = ("chest_pain", "bladder_or_bowel", "saddle_numbness", "sudden_weakness", "fever_with_back_pain", "recent_serious_injury")
RedFlag = Literal[EMERGENCY + ("numbness_tingling",)]  # type: ignore[valid-type]


def get_business_info(state: BookingState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Services, insurance, hours and policies", {**BUSINESS, "today": state.today})


class NoteVisit(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The patient's name as they gave it.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Best number, once the caller confirmed it.")
    newPatient: Optional[bool] = Field(None, description="True if they've never been to Tidewell.")
    reason: Optional[str] = Field(None, min_length=3, max_length=200, description="What's bothering them, in their words (e.g. 'lower back pain after lifting a box').")
    howLong: Optional[str] = Field(None, max_length=60, description="How long it has been going on, in their words.")
    cause: Optional[Literal["lifting", "sport", "car_accident", "work_injury", "fall", "gradual", "not_sure"]] = Field(None, description="How it started.")
    redFlags: Optional[list[RedFlag]] = Field(None, description="Only what the caller actually said. Send the full list.")
    coverage: Optional[Literal["insurance", "self_pay", "auto_accident", "workers_comp"]] = None
    insurer: Optional[str] = Field(None, max_length=80, description="Their insurance plan, as they named it.")
    service: Optional[ServiceId] = Field(None, description=SERVICE_HELP)
    practitioner: Optional[StaffId] = None
    proposedSlotId: Optional[str] = None


def note_visit(state: BookingState, i: NoteVisit, ctx: OpContext) -> OpResult:
    if i.proposedSlotId and i.proposedSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    if (bad := last_name_missing(i.name)):
        return bad
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    if "service" in new:
        new["serviceId"] = new.pop("service")
    if "cause" in new and new["cause"] == "car_accident":
        new.setdefault("coverage", "auto_accident")
    changed = [k for k, v in new.items() if state.request.get(k) != v]
    state.request.update(new)
    out: dict[str, Any] = {}
    flags = state.request.get("redFlags") or []
    if any(f in EMERGENCY for f in flags):
        state.request["emergency"] = True
        out["emergency"] = "Stop booking. Tell them calmly that with what they're describing they should call 911 or go to the emergency room now, and that we'll be here once they've been checked. Don't book a visit."
    elif "numbness_tingling" in flags:
        out["flagForPractitioner"] = "Book as normal; the practitioner will see the note. Don't comment on what it means."
    if "insurer" in changed:
        plan = store.insurer(state.request["insurer"])
        state.request["directBill"] = plan
        out["insurance"] = (f"We bill {plan} directly. The front desk checks their benefits before the first visit." if plan else "We don't bill that plan directly: they pay at the visit and we give a receipt to submit.") + " Never say what the plan covers or what they'll owe."
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", out, bool(changed))


class FindPatient(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dateOfBirth: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD.")


def find_patient(state: BookingState, i: FindPatient, ctx: OpContext) -> OpResult:
    if (bad := last_name_missing(i.name)):
        return bad
    tries = state.request.get("lookups", 0)
    if tries >= 3:
        return fail("too_many_tries", "Stop looking them up. Book them as a new patient, or take a message for the front desk.")
    state.request["lookups"] = tries + 1
    p = store.find_patient(i.name, i.dateOfBirth)
    if not p:
        return fail("not_found", "No match. Ask once to check the spelling and date; never say which was wrong. Otherwise book as a new patient.")
    state.request.update({"patient": p, "name": p["name"], "newPatient": False, "practitioner": state.request.get("practitioner") or p["sees"]})
    if p["plan"] != "Self-pay":
        state.request.update({"coverage": "insurance", "insurer": p["plan"], "directBill": p["plan"]})
    return ok(f"Found · {p['name']}", {"name": p["name"], "usuallySees": CAL.person(p["sees"])["name"], "last": p["last"], "plan": p["plan"]}, True)


class CheckAvailability(BaseModel):
    service: ServiceId = Field(description=SERVICE_HELP)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    practitioner: Optional[StaffId] = None
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = None


def _fits(state: BookingState, service_id: str) -> Optional[OpResult]:
    s = CAL.service(service_id)
    if state.request.get("emergency"):
        return fail("emergency", "Don't book: they need 911 or the emergency room first.")
    if s.get("returningOnly") and not state.request.get("patient"):
        return fail("new_patient_first", "Follow-ups are for current patients. New patients start with the assessment (chiro_new or physio_new); returning patients are found with find_patient first.")
    return None


def check_availability(state: BookingState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    if (bad := _fits(state, i.service)):
        return bad
    state.request["serviceId"] = i.service
    return CAL.check(state, i.service, i.date, i.practitioner, i.partOfDay)


class BookAppointment(BaseModel):
    slotId: str = Field(description="From check_availability.")
    service: ServiceId
    name: str = Field(min_length=1, max_length=80)
    callerConfirmed: bool = Confirmed()


def book_appointment(state: BookingState, i: BookAppointment, ctx: OpContext) -> OpResult:
    if (bad := last_name_missing(i.name)):
        return bad
    if (bad := _fits(state, i.service)):
        return bad
    s = CAL.service(i.service)
    extras: dict[str, Any] = {}
    if s.get("newPatient"):
        extras["intake"] = "Intake forms emailed"
    r = CAL.book(state, i.slotId, i.service, i.name, ctx, extras)
    if r.ok and not r.result.get("duplicate"):
        state.request.update({"name": i.name.strip(), "serviceId": i.service})
        if extras.get("intake"):
            r.result["intake"] = "Say we'll email the intake forms; they take about ten minutes."
        r.result["arrive"] = "Ask them to arrive ten minutes early for a first visit." if s.get("newPatient") else ""
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
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two. No health details beyond what they chose to say.")
    preferredTime: Optional[str] = Field(None, max_length=80)


def take_message(state: BookingState, i: TakeMessage, ctx: OpContext) -> OpResult:
    return CAL.message(state, i.name, i.callbackNumber, i.summary, i.preferredTime, False, ctx)


class EmailConfirmation(BaseModel):
    email: Optional[str] = Field(None, max_length=120, description="Only when no signup email is on file: the caller's email address as they gave it. Leave out otherwise.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " Never include health details.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: BookingState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    to, refused = email_target(ctx, i.email)
    if refused:
        return refused
    booked = CAL.active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, to, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        r, sent = await send_summary("tidewell", "Ellie", to, i.recap, state.request.get("name"), messages, did="answered your questions and passed your message to the front desk")
        if sent:
            state.emailed = sent
        return r
    a = booked[-1]
    d = CAL.describe(a.slot_id)
    s = CAL.service(a.service_id)
    rows = [("With", d["with"]), ("Where", BUSINESS["address"].split(".")[0])]
    if a.extras.get("intake"):
        rows.append(("Before you come", "Intake forms (about ten minutes); arrive ten minutes early"))
    rows.append(("Changes", "24 hours' notice, please"))
    # The email names the visit type only: no reason for the visit or other health details.
    v = {"brand": "tidewell", "agent": "Ellie", "service": s["name"], "day": d["day"], "time": d["time"], "zone": "Pacific", "name": a.name, "reference": a.id, "rows": rows, "did": "found the right practitioner and booked your visit"}
    masked, why = await email.confirm(to, email.appointment_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
