"""Josh's operations at Aspen Grove Dental: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, date_label, fail, mask_number, ok, reference, send_summary, weekday
from . import store
from .intake import SKIPPABLE, next_fields, triage_next
from .state import Appt, DentalState, Message, active, bookable_days, describe_slot, free, horizon_end, op, open_slots, parse_slot
from .store import BUSINESS, IN_NETWORK, OUT_OF_NETWORK, TYPE_IDS, provider, visit_type

TypeId = Literal[TYPE_IDS]  # type: ignore[valid-type]
Skippable = Literal[SKIPPABLE]  # type: ignore[valid-type]
Symptom = Literal["pain", "swelling", "broken_tooth", "lost_filling", "bleeding_gums", "sensitivity", "knocked_out_tooth", "jaw_pain"]
TYPE_HELP = "One of: " + ", ".join(f"{t['id']} ({t['name']}, {t['minutes']} min)" for t in store.TYPES) + "."


def get_practice_info(state: DentalState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Hours, visits, prices, insurance and policies", {**BUSINESS, "today": state.today})


class NotePatient(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The patient's name (the child's, for a child).")
    dateOfBirth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Once the caller confirmed it.")
    newPatient: Optional[bool] = None
    reason: Optional[TypeId] = Field(None, description=TYPE_HELP)
    symptoms: Optional[list[Symptom]] = Field(None, description="What they told you. Send the full list.")
    painLevel: Optional[int] = Field(None, ge=0, le=10)
    howLong: Optional[str] = Field(None, max_length=60, description="How long, in their words.")
    lastVisit: Optional[str] = Field(None, max_length=60, description="When they last saw a dentist, in their words.")
    subscriber: Optional[str] = Field(None, max_length=80, description="The insurance subscriber's name, if not the patient.")
    relationship: Optional[Literal["self", "spouse", "child", "other"]] = Field(None, description="The patient's relationship to the subscriber.")
    memberId: Optional[str] = Field(None, max_length=30)
    groupNumber: Optional[str] = Field(None, max_length=30, description="The group number or employer, if they have it.")
    child: Optional[bool] = Field(None, description="True when the patient is a child (the caller is the parent).")
    medicalAlert: Optional[str] = Field(None, max_length=120, description="Anything the dentist should know before treatment that they chose to mention (e.g. blood thinners, needs antibiotics first, an allergy). Their words.")
    referral: Optional[str] = Field(None, max_length=60, description="How they heard about us.")
    age: Optional[int] = Field(None, ge=0, le=120, description="The child's age, for a child.")
    skipped: Optional[list[Skippable]] = Field(None, description="Questions the caller can't or won't answer (no insurance, nothing to mention, doesn't remember): send the field name so it isn't asked again.")


def note_patient(state: DentalState, i: NotePatient, ctx: OpContext) -> OpResult:
    new = {k: (v.strip() if isinstance(v, str) else v) for k, v in i.model_dump().items() if v is not None}
    have = state.patient.get("name") or ""
    if new.get("name") and len(new["name"].split()) < 2 and have.lower().startswith(new["name"].lower()):
        new.pop("name")  # the first name again: keep what we have
    state.skipped += [k for k in new.pop("skipped", []) if k not in state.skipped]
    if new.get("dateOfBirth") and not ("1900" < new["dateOfBirth"] < state.today):
        return fail("bad_date", "That date of birth is not right. Check it with the caller; it needs month, day and a four-digit year.")
    changed = [k for k, v in new.items() if state.patient.get(k) != v]
    state.patient.update(new)
    state.opened = True
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", next_fields(state), bool(changed))


class FindPatient(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dateOfBirth: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    callerSaysTheyAreAPatient: bool = Field(description="True only when the caller said they have been to Aspen Grove before. Never look up someone who is new or hasn't said.")


def find_patient(state: DentalState, i: FindPatient, ctx: OpContext) -> OpResult:
    if not i.callerSaysTheyAreAPatient or state.patient.get("newPatient") is True:
        state.patient.update({"name": i.name.strip(), "dateOfBirth": i.dateOfBirth, "newPatient": True}) if i.callerSaysTheyAreAPatient is False else None
        return fail("new_patient", "Don't look them up: they haven't said they've been here before. Ask whether they've been to see us before; if not, carry on as a new patient.")
    if state.lookups >= 3:
        return fail("too_many_tries", "Stop looking them up. Book as a new patient or take a message for the front office.")
    if len(i.name.split()) < 2:
        return fail("incomplete_name", "A first and last name are needed. Ask \"And your last name?\" before looking them up.")
    state.lookups += 1
    state.opened = True
    p = store.find_patient(i.name, i.dateOfBirth)
    if not p:
        return fail("not_found", "No match. They said they've been here, so ask once to check the spelling and date; never say which was wrong. If it still doesn't match, carry on as a new patient without fuss.")
    state.found = p
    state.patient.update({"name": p["name"], "dateOfBirth": p["dateOfBirth"], "newPatient": False})
    state.insurance = {"carrier": p["carrier"], "inNetwork": p["carrier"] in IN_NETWORK, "onFile": True}
    return ok(f"Found · {p['name']}", {"name": p["name"], "due": p["due"], "lastVisit": date_label(p["lastVisit"]) + f", {p['lastVisit'][:4]}", "insuranceOnFile": p["carrier"], "usualHygienist": provider(p["hygienist"])["name"]}, True)


class CheckInsurance(BaseModel):
    carrier: str = Field(min_length=2, max_length=80, description="The dental plan as the caller named it.")


def check_insurance(state: DentalState, i: CheckInsurance, ctx: OpContext) -> OpResult:
    t = i.carrier.lower()
    state.opened = True
    if "medicaid" in t or "all kids" in t:
        state.insurance = {"carrier": i.carrier.strip(), "inNetwork": False, "medicaid": True}
        return ok("Medicaid · not accepted", {"inNetwork": False, "say": store.MEDICAID}, True)
    plan = store.carrier(i.carrier)
    state.insurance = {"carrier": plan or i.carrier.strip(), "inNetwork": bool(plan)}
    if plan:
        return ok(f"{plan} · in network", {"inNetwork": True, "say": f"We're in network with {plan}. The office checks the benefits before the visit; never say what's covered or what they'll owe."}, True)
    return ok("Out of network", {"inNetwork": False, "say": OUT_OF_NETWORK}, True)


class TriageEmergency(BaseModel):
    painLevel: Optional[int] = Field(None, ge=0, le=10)
    swelling: Optional[bool] = None
    swellingSpreading: Optional[bool] = Field(None, description="Swelling spreading toward the eye or down the neck, or making it hard to speak.")
    brokenJaw: Optional[bool] = None
    fever: Optional[bool] = None
    troubleBreathingOrSwallowing: Optional[bool] = None
    faceInjuryOrAccident: Optional[bool] = Field(None, description="A blow to the face, a fall or a crash.")
    knockedOutTooth: Optional[bool] = None
    bleedingWontStop: Optional[bool] = None


def triage_emergency(state: DentalState, i: TriageEmergency, ctx: OpContext) -> OpResult:
    t = {k: v for k, v in i.model_dump().items() if v is not None}
    state.triage = {**(state.triage or {}), **t}
    tr = state.triage
    state.patient["reason"] = "emergency"
    state.opened = True
    flag = bool(tr.get("troubleBreathingOrSwallowing") or tr.get("swellingSpreading") or (tr.get("swelling") and tr.get("fever")) or tr.get("faceInjuryOrAccident") or tr.get("bleedingWontStop") or tr.get("brokenJaw"))
    pending = None if flag or tr.get("knockedOutTooth") else triage_next(state)
    if pending:
        return ok("Triage · more to ask", {"next": pending[1], "nextField": pending[0], "outcome": None}, bool(t))
    if tr.get("troubleBreathingOrSwallowing") or tr.get("swellingSpreading") or (tr.get("swelling") and tr.get("fever")) or tr.get("faceInjuryOrAccident") or tr.get("bleedingWontStop") or tr.get("brokenJaw"):
        tr["outcome"] = "er"
        return ok("Emergency room first", {"goTo": "er", "say": "Calmly tell them to call 911 or go to the nearest emergency room now, and that we'll see them after. Don't book."}, True)
    if tr.get("knockedOutTooth"):
        tr["outcome"] = "now"
        return ok("Knocked-out tooth · come in now", {"goTo": "now", "say": "Time matters, within the hour: tell them to hold it by the top, not the root, keep it in milk, and come straight in; offer the soonest emergency time today. If there's none in the next hour, go to an emergency room."}, True)
    tr["outcome"] = "same_day"
    return ok("Same-day emergency visit", {"goTo": "same_day", "say": "Offer the emergency visit (check_availability with type emergency for today, else tomorrow). Never diagnose or suggest medicine."}, True)


def _six_months(day: str) -> str:
    """Six months and a day after a visit: when most plans pay for the next cleaning."""
    from datetime import timedelta

    d = date.fromisoformat(day)
    m = d.month + 6
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    return (date(y, m, min(d.day, 28)) + timedelta(days=1)).isoformat()


class CheckAvailability(BaseModel):
    type: TypeId = Field(description=TYPE_HELP)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = None


def check_availability(state: DentalState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    if state.triage and state.triage.get("outcome") == "er":
        return fail("emergency_room", "Don't book: they need 911 or the emergency room first.")
    if visit_type(i.type).get("existingOnly") and not state.found:
        return fail("existing_only", "Periodontal maintenance is for current patients the dentist has set it up for. New patients start with the new patient exam.")
    days = bookable_days(state)
    if i.date < state.today:
        return fail("outside_calendar", "That date has passed. Offer a day from today on.")
    if i.date > horizon_end(state.today):
        return fail("outside_calendar", f"This demo's calendar only goes out two weeks, through {date_label(days[-1])}. Offer the caller a day within that.")
    state.patient.setdefault("reason", i.type)
    prefer = (state.found or {}).get("hygienist")
    prefer_op = next((o["id"] for o in store.OPS if o["provider"] == prefer), None) if prefer else None

    def in_part(sid: str) -> bool:
        m = parse_slot(sid)[1]  # type: ignore[index]
        return m < 12 * 60 if i.partOfDay == "morning" else m >= 12 * 60 if i.partOfDay == "afternoon" else True

    out: dict[str, Any] = {}
    # Insurance usually pays for two cleanings a year, six months apart: flag a recall booked too early.
    if i.type == "cleaning" and state.found:
        earliest = _six_months(state.found["lastVisit"])
        if i.date < earliest:
            out["frequency"] = f"Their last cleaning was {date_label(state.found['lastVisit'])}; insurance usually covers the next one from {date_label(earliest)}. Mention it once and offer that date or later; never say for sure what's covered."
    exact = [x for x in open_slots(state, i.type, i.date, prefer_op) if in_part(x)]
    state.viewing = {"date": i.date, "slots": exact, "type": i.type}
    if exact:
        picked = exact[:: max(1, len(exact) // 3)][:3]
        state.offered = list(dict.fromkeys(state.offered + picked))
        return ok(f"{len(exact)} open on {date_label(i.date)}", {**out, "day": date_label(i.date), "available": [describe_slot(x) for x in picked]}, True)
    later: list[str] = []
    for d in (d for d in days if d > i.date):
        later += [x for x in open_slots(state, i.type, d, prefer_op) if in_part(x)][:2]
        if len(later) >= 3:
            break
    picked = later[:3]
    state.offered = list(dict.fromkeys(state.offered + picked))
    if picked:
        first = picked[0][:10]
        state.viewing = {"date": first, "slots": [x for x in open_slots(state, i.type, first, prefer_op) if in_part(x)], "type": i.type}
    reason = "closed" if weekday(i.date) in (0, 6) else "fully_booked"
    return ok(f"Nothing on {date_label(i.date)} · next openings found" if picked else "Nothing available", {**out, "day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(x) for x in picked], "asap": "If none suit, offer the short-notice list (add_to_asap_list)."}, True)


class BookAppointment(BaseModel):
    slotId: str = Field(description="From check_availability.")
    type: TypeId
    callerConfirmed: bool = Confirmed()


def book_appointment(state: DentalState, i: BookAppointment, ctx: OpContext) -> OpResult:
    if state.triage and state.triage.get("outcome") == "er":
        return fail("emergency_room", "Don't book: they need 911 or the emergency room first.")
    name = state.patient.get("name")
    if not name:
        return fail("missing_details", "Ask for the patient's name first.")
    if len(name.split()) < 2:
        return fail("missing_details", "Ask \"And your last name?\" first: a visit needs a first and last name.")
    if visit_type(i.type).get("existingOnly") and not state.found:
        return fail("existing_only", "New patients start with the new patient exam.")
    if i.type in ("new_patient",) and not state.patient.get("dateOfBirth"):
        return fail("missing_details", "Ask for the patient's date of birth first.")
    live = active(state)
    same = next((a for a in live if a.id and i.slotId == _sid(a) and a.type_id == i.type), None)
    if same:
        return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True})
    if live:
        return fail("already_booked", "This caller already has a visit booked in this call. Use reschedule_appointment to change it.")
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, start, oid = parse_slot(i.slotId)  # type: ignore[misc]
    t = visit_type(i.type)
    if oid not in store.ops_for(t["with"]) or not free(state, oid, day, start, t["minutes"]):
        return fail("slot_taken", "That time has just gone. Check availability again.")
    aid = reference("AG", state.seq, state.seed)
    state.seq += 1
    phone = state.patient.get("phone")
    state.book.append(Appt(aid, oid, day, start, t["minutes"], name, t["procedures"], False, i.type, "booked", phone4=(phone[-4:] if phone else None), confirmed="confirmed", alert=bool(state.patient.get("medicalAlert")), exam=t["with"] == "hygiene"))
    state.patient["reason"] = i.type
    state.viewing = {"date": day, "slots": open_slots(state, i.type, day), "type": i.type}
    who = provider(op(oid)["provider"])
    out: dict[str, Any] = {"appointmentId": aid, "with": who["name"]}
    if i.type == "new_patient":
        out["say"] = "Say we'll email the new-patient forms, to arrive 15 minutes early with a photo ID and their insurance card."
    elif i.type == "emergency":
        out["say"] = "Say to come a few minutes early; the dentist will see what's going on and talk through options and costs before doing anything."
    return ok(f"Booked · {aid}", out, True)


def _sid(a: Appt) -> str:
    return f"{a.date}T{a.start // 60:02d}{a.start % 60:02d}@{a.op}"


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: DentalState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    a = next((a for a in active(state) if a.id == i.appointmentId), None)
    if not a:
        return fail("not_found", "There is no visit with that reference booked in this call.")
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, start, oid = parse_slot(i.newSlotId)  # type: ignore[misc]
    if oid not in store.ops_for(visit_type(a.type_id)["with"]) or not free(state, oid, day, start, a.minutes, a.id):  # type: ignore[arg-type]
        return fail("slot_taken", "That time is no longer free.")
    a.date, a.start, a.op, a.changes = day, start, oid, a.changes + 1
    state.viewing = {"date": day, "slots": open_slots(state, a.type_id, day), "type": a.type_id}  # type: ignore[arg-type]
    s = describe_slot(i.newSlotId)
    return ok(f"Moved · {a.id}", {"appointmentId": a.id, "newTime": f"{s['day']} at {s['time']}"}, True)


class CancelAppointment(BaseModel):
    appointmentId: str
    callerConfirmed: bool = Confirmed()


def cancel_appointment(state: DentalState, i: CancelAppointment, ctx: OpContext) -> OpResult:
    a = next((a for a in state.book if a.id == i.appointmentId and not a.existing), None)
    if not a:
        return fail("not_found", "There is no visit with that reference in this call.")
    a.status = "cancelled"
    return ok(f"Cancelled · {a.id}", {"appointmentId": a.id}, True)


class AddToAsap(BaseModel):
    type: TypeId
    preferred: str = Field(min_length=2, max_length=120, description="When they could come at short notice, in their words, e.g. 'weekday mornings'.")


def add_to_asap_list(state: DentalState, i: AddToAsap, ctx: OpContext) -> OpResult:
    if not state.patient.get("name"):
        return fail("missing_details", "Ask for the patient's name and best number first.")
    entry = {"name": state.patient["name"], "type": visit_type(i.type)["name"], "preferred": i.preferred.strip()}
    if entry not in state.asap:
        state.asap.append(entry)
    return ok("On the short-notice list", {"say": "Say the front office calls or texts as soon as a time opens that fits."}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs. Billing and treatment questions go here.")
    preferredTime: Optional[str] = Field(None, max_length=80)
    urgent: bool = Field(False, description="Only for pain that can't wait and no emergency time left.")


def take_message(state: DentalState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, i.urgent, ctx.now.isoformat()))
    state.opened = True
    return ok(f"Message for the front office · {mid}", {"messageId": mid}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " Never include symptoms or health details.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: DentalState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    booked = active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        r, sent = await send_summary("dental", "Josh", i.email, i.recap, state.patient.get("name"), messages, did="answered your questions and passed your message to the front office")
        if sent:
            state.emailed = sent
        return r
    a = booked[-1]
    s = describe_slot(_sid(a))
    t = visit_type(a.type_id)  # type: ignore[arg-type]
    rows = [("With", s["with"]), ("Length", f"About {t['minutes']} minutes"), ("Where", BUSINESS["address"].split(".")[0])]
    if a.type_id == "new_patient":
        rows.append(("Bring", "Photo ID and your insurance card; arrive 15 minutes early"))
    rows.append(("Changes", "24 hours' notice, please"))
    v = {"brand": "dental", "agent": "Josh", "service": t["name"], "day": s["day"], "time": s["time"], "zone": "Central", "name": a.patient, "reference": a.id, "rows": rows, "did": "checked the book and saved you the right chair"}
    masked, why = await email.confirm(i.email, email.appointment_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
