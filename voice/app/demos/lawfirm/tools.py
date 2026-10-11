"""Nora's operations at Alder & Finch: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, date_label, fail, mask_number, ok, reference, send_summary, weekday
from .state import (
    AccidentType,
    Booked,
    Consult,
    Fault,
    Format,
    InjuryArea,
    LawFirmState,
    Message,
    Treatment,
    Tri,
    active,
    bookable_days,
    confirm_text,
    describe_slot,
    eligible_attorneys,
    free_attorney,
    missing_fields,
    name_matches,
    open_slots,
    parse_day,
    parse_slot,
    score,
    tier_of,
    years_between,
)
from .store import ADVERSE, BUSINESS, CLIENTS, CLOSED_WEEKDAYS, DECLINES, FAULT_LABEL, FORMAT_LABEL, LICENSED_STATE, OUTSIDE_PRACTICE, TREATMENT_LABEL, attorney, first_name, limit_years


def get_firm_info(state: LawFirmState, _: Any, ctx: OpContext) -> OpResult:
    return ok("The firm's practice, hours and fees", {**BUSINESS, "today": state.today})


class NoteIntake(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Best callback number, once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Email address, only once the caller confirmed it.")
    accidentType: Optional[AccidentType] = Field(None, description="The kind of accident.")
    accidentDate: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="The date it happened, YYYY-MM-DD, worked out from today's date.")
    accidentState: Optional[str] = Field(None, min_length=2, max_length=2, description="Two-letter US state where it happened, e.g. CO.")
    accidentCity: Optional[str] = Field(None, min_length=2, max_length=60, description="City where it happened.")
    injuries: Optional[str] = Field(None, min_length=2, max_length=240, description="What hurts or was injured, in the caller's words. Never a category.")
    treatment: Optional[Treatment] = Field(None, description="The most serious treatment so far: none, doctor_or_urgent_care, emergency_room, ongoing_care, surgery, hospitalized.")
    injuryAreas: Optional[list[InjuryArea]] = Field(None, description="Every part of the body the caller says was hurt, picked from the list. Send the full list so far, not only the new part.")
    missedWork: Optional[Tri] = Field(None, description="Whether the injuries have kept them from working.")
    someoneDied: Optional[bool] = Field(None, description="True only if the caller says someone died in the accident.")
    atFault: Optional[Fault] = Field(None, description="Who was at fault in the caller's view: other_party, shared, me, unsure.")
    policeReport: Optional[Tri] = Field(None, description="Whether a police report was filed.")
    otherPartyInsured: Optional[Tri] = Field(None, description="Whether the other side has insurance, if known.")
    otherPartyInsurer: Optional[str] = Field(None, min_length=2, max_length=80, description="The other side's insurance company, if the caller knows it.")
    opposingParty: Optional[str] = Field(None, min_length=2, max_length=100, description="The other driver, company or property owner, if the caller knows.")
    hasLawyer: Optional[bool] = Field(None, description="True if the caller already has a lawyer for this accident.")


def note_intake(state: LawFirmState, i: NoteIntake, ctx: OpContext) -> OpResult:
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    if "accidentDate" in new:
        d = parse_day(new["accidentDate"])
        if d is None:
            return fail("bad_date", "That date is not valid. Work it out again from today's date.")
        if d > date.fromisoformat(state.today):
            return fail("future_date", "That date is in the future. Check it with the caller.")
    if "accidentState" in new:
        new["accidentState"] = new["accidentState"].upper()
    for k in ("name", "accidentCity", "injuries", "opposingParty", "otherPartyInsurer"):
        if k in new:
            new[k] = new[k].strip()
    changed = [k for k, v in new.items() if state.intake.get(k) != v]
    # New facts invalidate what was already decided from the old ones.
    if changed and state.assessment and not state.consults:
        if any(k in changed for k in ("accidentType", "accidentDate", "accidentState", "treatment", "atFault", "hasLawyer", "someoneDied", "otherPartyInsured", "policeReport")):
            state.assessment = None
    if "name" in changed or "opposingParty" in changed:
        state.conflict = None
    state.intake.update(new)
    state.opened = True
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", {}, bool(changed))


class CheckConflicts(BaseModel):
    callerName: str = Field(min_length=1, max_length=80, description="The caller's name.")
    opposingParty: Optional[str] = Field(None, max_length=100, description="The other driver, company or property owner, if the caller named one.")


def check_conflicts(state: LawFirmState, i: CheckConflicts, ctx: OpContext) -> OpResult:
    names = [i.callerName.strip()] + ([i.opposingParty.strip()] if i.opposingParty else [])
    hits: list[str] = []
    # The firm cannot act against its own clients, nor for someone it is already suing.
    if i.opposingParty and any(name_matches(i.opposingParty, c) for c in CLIENTS):
        hits.append("The other party is a current client")
    if any(name_matches(i.callerName, a) for a in ADVERSE):
        hits.append("The caller is an adverse party on an open matter")
    state.intake["name"] = state.intake.get("name") or i.callerName.strip()
    if i.opposingParty:
        state.intake.setdefault("opposingParty", i.opposingParty.strip())
    state.opened = True
    state.conflict = {"status": "conflict" if hits else "clear", "names": names, "hits": hits}
    if hits:
        d = DECLINES["conflict"]
        return ok("Conflict found · cannot take this matter", {"conflict": True, "say": d[1]}, True)
    return ok("No conflicts found", {"conflict": False}, True)


def assess_case(state: LawFirmState, _: Any, ctx: OpContext) -> OpResult:
    miss = missing_fields(state)
    if miss:
        return fail("missing_details", "Still needed before this can be assessed: " + ", ".join(miss) + ". Ask the caller for them, one at a time.")
    if state.conflict is None:
        return fail("conflict_check_first", "Run check_conflicts first, with the caller's name and the other party's name if known.")
    i = state.intake
    today = date.fromisoformat(state.today)
    d = parse_day(i["accidentDate"])
    reason: Optional[str] = None
    if state.conflict["status"] == "conflict":
        reason = "conflict"
    elif i["accidentType"] in OUTSIDE_PRACTICE:
        reason = "outside_practice"
    elif i["accidentState"] != LICENSED_STATE:
        reason = "out_of_state"
    elif i["hasLawyer"] is True:
        reason = "has_lawyer"
    elif i["atFault"] == "me":
        reason = "at_fault"
    elif d and years_between(d, today) > limit_years(i['accidentType']):
        reason = "out_of_time"
    elif i["treatment"] == "none" and not i.get("injuries") and not i.get("someoneDied"):
        reason = "no_injury"
    if reason:
        why, say = DECLINES[reason]
        state.assessment = {"outcome": "declined", "reason": reason, "why": why, "tier": None, "flags": [], "deadline": None, "score": score(state) if reason != "conflict" else 0}
        return ok(f"Cannot take it · {why.rstrip('.')}", {"canTakeCase": False, "say": say}, True)
    pts = score(state)
    tier = "A" if i.get("someoneDied") else tier_of(pts)
    flags: list[str] = []
    deadline = date(d.year + limit_years(i['accidentType']), d.month, min(d.day, 28)) if d else None
    if d and years_between(d, today) > limit_years(i['accidentType']) - 0.5:
        flags.append("Time limit within 6 months")
    if i.get("someoneDied"):
        flags.append("Wrongful death")
    if i["treatment"] == "none":
        flags.append("No treatment yet")
    if i.get("otherPartyInsured") == "no":
        flags.append("Other side may be uninsured")
    why = [
        f"{TREATMENT_LABEL[i['treatment']]}",
        f"Fault: {FAULT_LABEL[i['atFault']].lower()}",
        "Police report filed" if i.get("policeReport") == "yes" else "No police report" if i.get("policeReport") == "no" else "Police report unknown",
        "Other side insured" if i.get("otherPartyInsured") == "yes" else "Other side uninsured" if i.get("otherPartyInsured") == "no" else "Insurance unknown",
    ]
    state.assessment = {"outcome": "qualified", "reason": None, "why": why, "tier": tier, "flags": flags, "deadline": deadline.isoformat() if deadline else None, "score": pts}
    out: dict[str, Any] = {"canTakeCase": True, "priority": "priority" if tier == "A" or "Time limit within 6 months" in flags else "standard", "nextStep": "Offer the free consultation, ask phone, video or office, and check availability."}
    if "Time limit within 6 months" in flags:
        out["timeLimits"] = "Time limits can be strict, so it is worth booking soon. Say only that; never state a deadline."
    if tier == "A":
        out["attorney"] = "This caller goes to the senior partner; check_availability already shows only his times."
    return ok(f"Can take it · priority {tier}" if tier == "A" else "Can take it", out, True)


class CheckAvailability(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = Field(None, description="Morning is before noon; afternoon is noon onwards.")


def check_availability(state: LawFirmState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    if not state.assessment or state.assessment["outcome"] != "qualified":
        return fail("not_qualified", "Only offer a consultation after assess_case says the firm can take the case.")
    pool = eligible_attorneys(state)

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_calendar", f"Consultations can be booked from today to {date_label(days[-1])}.", {"bookableFrom": state.today, "bookableTo": days[-1]})
    exact = [s for s in open_slots(state, i.date, pool) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "pool": pool}
    if exact:
        offered = exact[:4]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open on {date_label(i.date)}", {"date": i.date, "day": date_label(i.date), "available": [describe_slot(state, s, pool) for s in offered]}, True)
    alternatives: list[str] = []
    for day in (d for d in days if d > i.date):
        alternatives += [s for s in open_slots(state, day, pool) if in_part(s)]
        if len(alternatives) >= 3:
            break
    offered = alternatives[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    if offered:
        first = offered[0][:10]
        state.viewing = {"date": first, "slots": [s for s in open_slots(state, first, pool) if in_part(s)], "pool": pool}
    reason = "weekend" if weekday(i.date) in CLOSED_WEEKDAYS else "fully_booked"
    return ok(
        f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available",
        {"date": i.date, "day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(state, s, pool) for s in offered]},
        True,
    )


class BookConsultation(BaseModel):
    slotId: str
    format: Format = Field(description="phone, video or office.")
    callerConfirmed: bool = Confirmed()


def book_consultation(state: LawFirmState, i: BookConsultation, ctx: OpContext) -> OpResult:
    if not state.assessment or state.assessment["outcome"] != "qualified":
        return fail("not_qualified", "A consultation can only be booked after assess_case says the firm can take the case.")
    if not state.intake.get("name"):
        return fail("missing_details", "Ask for the caller's name first.")
    existing = active(state)
    same = next((c for c in existing if c.slot_id == i.slotId), None)
    if same:
        return ok(f"Already booked · {same.id}", {"consultationId": same.id, "duplicate": True, "confirmation": confirm_text(state, same)})
    if existing:
        return fail("already_booked", "This caller already has a consultation booked in this call. Use reschedule_consultation to change it.", {"consultationId": existing[0].id, "confirmation": confirm_text(state, existing[0])})
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    pool = eligible_attorneys(state)
    who = free_attorney(state, day, hour, pool)
    if not who:
        alternatives = open_slots(state, day, pool)[:3]
        state.offered = list(dict.fromkeys(state.offered + alternatives))
        return fail("slot_taken", "That time has just been taken.", {"alternatives": [describe_slot(state, s, pool) for s in alternatives]})
    cid = reference("AF", state.seq, state.seed)
    state.seq += 1
    state.calendar.append(Booked(who, day, hour, cid, False))
    state.consults.append(Consult(cid, i.slotId, who, i.format, state.intake["name"], "booked", ctx.now.isoformat()))
    state.viewing = {"date": day, "slots": open_slots(state, day, pool), "pool": pool}
    return ok(f"Consultation booked · {cid}", {"consultationId": cid, "attorney": first_name(who), "format": i.format}, True)


class RescheduleConsultation(BaseModel):
    consultationId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_consultation(state: LawFirmState, i: RescheduleConsultation, ctx: OpContext) -> OpResult:
    c = next((c for c in active(state) if c.id == i.consultationId), None)
    if not c:
        return fail("not_found", "There is no active consultation with that reference in this call.")
    if c.slot_id == i.newSlotId:
        return ok(f"Already at that time · {c.id}", {"consultationId": c.id, "unchanged": True, "confirmation": confirm_text(state, c)})
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    pool = eligible_attorneys(state)
    who = free_attorney(state, day, hour, pool, c.id)
    if not who:
        return fail("slot_taken", "That time is no longer free.")
    slot = next(b for b in state.calendar if b.ref == c.id)
    slot.attorney_id, slot.date, slot.hour = who, day, hour
    c.slot_id, c.attorney_id, c.updated_at, c.changes = i.newSlotId, who, ctx.now.isoformat(), c.changes + 1
    state.viewing = {"date": day, "slots": open_slots(state, day, pool), "pool": pool}
    s = describe_slot(state, c.slot_id, [who], c.id)
    return ok(f"Consultation moved · {c.id}", {"consultationId": c.id, "attorney": first_name(who), "newTime": f"{s['day']} at {s['time']}"}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")
    urgent: bool = Field(False, description="True only for a serious injury or a death: it goes straight to an attorney.")


def take_message(state: LawFirmState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, i.urgent, ctx.now.isoformat()))
    if i.urgent:
        return ok(f"Urgent · sent to an attorney · {mid}", {"messageId": mid, "attorneyCallsBackWithin": "the hour"}, True)
    return ok(f"Message for the attorneys · {mid}", {"messageId": mid}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " Never mention case value, priority or odds.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: LawFirmState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    """Emails the caller the booked consultation, or a summary of the call when nothing was booked."""
    booked = active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        name = state.messages[-1].name if state.messages else state.intake.get("name")
        r, sent = await send_summary("lawfirm", "Nora", i.email, i.recap, name, messages, did="took your call, listened to what happened and passed it to the right attorney")
        if sent:
            state.emailed = sent
        return r
    c = booked[-1]
    s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
    consult = {"day": s["day"], "time": s["time"], "attorney": attorney(c.attorney_id)["name"], "format": FORMAT_LABEL[c.fmt], "name": c.name, "reference": c.id}
    masked, why = await email.confirm(i.email, email.consult_confirmation(consult))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": c.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
