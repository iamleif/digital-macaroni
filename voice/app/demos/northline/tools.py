"""Ellie's operations at Northline: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import Confirmed, OpContext, OpResult, date_label, fail, ok, reference, weekday
from .state import (
    DATE_HELP,
    ISSUE_HELP,
    SERVICE_HELP,
    Appointment,
    Job,
    Message,
    NorthlineState,
    ServiceId,
    active,
    bookable_days,
    confirm_text,
    describe_slot,
    free_tech,
    issue_is_vague,
    open_slots,
    parse_slot,
)
from .store import BUSINESS, NO_SYMPTOM_NEEDED, first_name, service


def get_business_info(state: NorthlineState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Services, hours and policies", {**BUSINESS, "today": state.today})


class NoteRequestDetails(BaseModel):
    service: Optional[ServiceId] = Field(None, description=SERVICE_HELP)
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    address: Optional[str] = Field(None, min_length=3, max_length=160, description="The service address as confirmed, street and city.")
    issue: Optional[str] = Field(None, min_length=3, max_length=200, description=ISSUE_HELP)
    proposedSlotId: Optional[str] = Field(None, description="The slot the caller chose, before booking.")


def note_request_details(state: NorthlineState, i: NoteRequestDetails, ctx: OpContext) -> OpResult:
    if i.proposedSlotId and i.proposedSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    r = state.request
    # A category is not worth showing on the card as the problem; the agent still needs to ask.
    issue = i.issue.strip() if i.issue and not issue_is_vague(i.issue) else None
    if i.service:
        r["serviceId"] = i.service
    if i.name:
        r["name"] = i.name.strip()
    if i.address:
        r["address"] = i.address.strip()
    if issue:
        r["issue"] = issue
    if i.proposedSlotId:
        r["proposedSlotId"] = i.proposedSlotId
    fields = [f for f, v in (("service", i.service), ("name", i.name), ("address", i.address), ("issue", issue), ("proposed time", i.proposedSlotId)) if v]
    result: dict[str, Any] = {}
    if i.issue and not issue:
        result["issueNotRecorded"] = "That names a system, not a problem. Ask what they have noticed."
    return ok(f"Noted {', '.join(fields) or 'details'}", result, bool(fields))


class CheckAvailability(BaseModel):
    service: ServiceId = Field(description=SERVICE_HELP)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description=DATE_HELP)
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = Field(None, description="Morning is before noon; afternoon is noon onwards.")


def check_availability(state: NorthlineState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    skill = service(i.service)["skill"]

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_schedule", f"Bookings open from today to {date_label(days[-1])}.", {"bookableFrom": state.today, "bookableTo": days[-1]})
    exact = [s for s in open_slots(state, i.date, skill) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "skill": skill}
    if exact:
        offered = exact[:4]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open on {date_label(i.date)}", {"date": i.date, "day": date_label(i.date), "available": [describe_slot(s) for s in offered]}, True)
    alternatives: list[str] = []
    for d in (d for d in days if d > i.date):
        alternatives += [s for s in open_slots(state, d, skill) if in_part(s)]
        if len(alternatives) >= 3:
            break
    offered = alternatives[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    # The board moves to the first day being offered, so what lights up matches what the caller hears.
    if offered:
        first = offered[0][:10]
        state.viewing = {"date": first, "slots": [s for s in open_slots(state, first, skill) if in_part(s)], "skill": skill}
    return ok(
        f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available this week",
        {"date": i.date, "day": date_label(i.date), "available": [], "reason": "closed_sunday" if weekday(i.date) == 0 else "fully_booked", "nextAvailable": [describe_slot(s) for s in offered]},
        True,
    )


class BookAppointment(BaseModel):
    slotId: str
    service: ServiceId = Field(description=SERVICE_HELP)
    name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=3, max_length=160)
    issue: str = Field(min_length=3, max_length=200, description=ISSUE_HELP)
    callerConfirmed: bool = Confirmed()


def book_appointment(state: NorthlineState, i: BookAppointment, ctx: OpContext) -> OpResult:
    existing = active(state)
    same = next((a for a in existing if a.slot_id == i.slotId and a.service_id == i.service), None)
    if same:
        return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True, "confirmation": confirm_text(same)})
    if existing:
        return fail("already_booked", "This caller already has a visit booked in this call. Use reschedule_appointment to change it.", {"appointmentId": existing[0].id, "confirmation": confirm_text(existing[0])})
    if i.service not in NO_SYMPTOM_NEEDED and issue_is_vague(i.issue):
        return fail("issue_too_vague", "The issue only names a system or trade. Ask the caller what they have noticed (no heat, a noise, a leak), then book.")
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    skill = service(i.service)["skill"]
    tech = free_tech(state, day, hour, skill)
    if not tech:
        alternatives = open_slots(state, day, skill)[:3]
        state.offered = list(dict.fromkeys(state.offered + alternatives))
        return fail("slot_taken", "That window has just been taken.", {"alternatives": [describe_slot(s) for s in alternatives]})
    aid = reference("NL", state.seq, state.seed)
    state.seq += 1
    at = ctx.now.isoformat()
    state.jobs.append(Job(id=aid, tech_id=tech, date=day, hour=hour, service_id=i.service, existing=False))
    appt = Appointment(id=aid, job_id=aid, slot_id=i.slotId, service_id=i.service, name=i.name.strip(), address=i.address.strip(), issue=i.issue.strip(), status="booked", tech_id=tech, updated_at=at, history=[{"at": at, "change": "booked", "slotId": i.slotId}])
    state.appointments.append(appt)
    state.request = {"serviceId": i.service, "name": appt.name, "address": appt.address, "issue": appt.issue}
    state.viewing = {"date": day, "slots": open_slots(state, day, skill), "skill": skill}
    # The caller has just heard the details in the read-back; give only what is new.
    return ok(f"Visit booked · {aid}", {"appointmentId": aid, "technician": first_name(tech), "callsAhead": "30 minutes before arriving"}, True)


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: NorthlineState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    appt = next((a for a in active(state) if a.id == i.appointmentId), None)
    if not appt:
        return fail("not_found", "There is no active booking with that reference in this call.")
    if appt.slot_id == i.newSlotId:
        return ok(f"Already at that time · {appt.id}", {"appointmentId": appt.id, "unchanged": True, "confirmation": confirm_text(appt)})
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    skill = service(appt.service_id)["skill"]
    tech = free_tech(state, day, hour, skill, appt.job_id)
    if not tech:
        return fail("slot_taken", "That window is no longer free.")
    job = next(j for j in state.jobs if j.id == appt.job_id)
    job.tech_id, job.date, job.hour = tech, day, hour
    at = ctx.now.isoformat()
    appt.slot_id, appt.tech_id, appt.updated_at = i.newSlotId, tech, at
    appt.history.append({"at": at, "change": "moved", "slotId": i.newSlotId})
    state.request.pop("proposedSlotId", None)
    state.viewing = {"date": day, "slots": open_slots(state, day, skill), "skill": skill}
    moved = describe_slot(appt.slot_id)
    return ok(f"Visit moved · {appt.id}", {"appointmentId": appt.id, "technician": first_name(tech), "newTime": f"{moved['day']}, {moved['window']}"}, True)


class CancelAppointment(BaseModel):
    appointmentId: str
    callerConfirmed: bool = Confirmed()


def cancel_appointment(state: NorthlineState, i: CancelAppointment, ctx: OpContext) -> OpResult:
    appt = next((a for a in state.appointments if a.id == i.appointmentId), None)
    if not appt:
        return fail("not_found", "There is no booking with that reference in this call.")
    if appt.status == "cancelled":
        return ok(f"Already cancelled · {appt.id}", {"appointmentId": appt.id, "unchanged": True})
    state.jobs = [j for j in state.jobs if j.id != appt.job_id]
    at = ctx.now.isoformat()
    appt.status, appt.updated_at = "cancelled", at
    appt.history.append({"at": at, "change": "cancelled", "slotId": appt.slot_id})
    return ok(f"Visit cancelled · {appt.id}", {"appointmentId": appt.id, "cancelled": True}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")
    urgent: bool = Field(False, description="True for an emergency after hours (or when nothing is free today): it goes to the on-call technician.")


def take_message(state: NorthlineState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(id=mid, name=i.name.strip(), callback_number=i.callbackNumber.strip(), summary=i.summary.strip(), preferred_time=(i.preferredTime or "").strip() or None, created_at=ctx.now.isoformat(), urgent=i.urgent))
    if i.urgent:
        return ok(f"Urgent · sent to the on-call technician · {mid}", {"messageId": mid, "onCallCallsBackWithin": "15 minutes"}, True)
    return ok(f"Message for the team · {mid}", {"messageId": mid}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: NorthlineState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    """Emails the booked visit to the caller: once per call, from a fixed template."""
    booked = active(state)
    if not booked:
        return fail("nothing_booked", "There is no booked visit to confirm yet.")
    if state.emailed:
        return fail("already_sent", f"The confirmation was already emailed to {state.emailed['to']} on this call.")
    a = booked[-1]
    s = describe_slot(a.slot_id)
    visit = {"day": s["day"], "window": s["window"], "technician": first_name(a.tech_id), "service": service(a.service_id)["name"], "issue": a.issue, "address": a.address, "name": a.name, "reference": a.id}
    masked, why = await email.confirm(i.email, email.visit_confirmation(visit), "Ellie at Northline")
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
