"""Owen's operations at Bluebird Insurance: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, date_label, fail, mask_number, ok, reference, send_summary, weekday
from . import store
from .state import (
    AgentCall,
    Booked,
    ChangeType,
    ClaimType,
    Coverage,
    InsuranceState,
    Line,
    Message,
    Request,
    Tri,
    active,
    bookable_days,
    describe_slot,
    free_agent,
    open_slots,
    parse_slot,
    quote_missing,
)
from .store import BUSINESS, CHANGE_LABEL, CLAIM_LABEL, CLOSED_WEEKDAYS, LINE_LABEL, SERVICE, carrier, first_name, person

MAX_LOOKUPS = 3


def get_agency_info(state: InsuranceState, _: Any, ctx: OpContext) -> OpResult:
    return ok("The agency's lines, carriers, hours and policies", {**BUSINESS, "today": state.today})


class Driver(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dateOfBirth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    yearsLicensed: Optional[int] = Field(None, ge=0, le=80)
    incidents: Optional[str] = Field(None, max_length=160, description="Tickets or accidents in the last five years, in their words; 'none' if none.")


class Vehicle(BaseModel):
    year: int = Field(ge=1950, le=2028)
    make: str = Field(min_length=2, max_length=40)
    model: str = Field(min_length=1, max_length=40)


class NoteAccount(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    dateOfBirth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="The caller's date of birth, YYYY-MM-DD.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Best callback number, once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Email address, only once the caller confirmed it.")
    address: Optional[str] = Field(None, min_length=5, max_length=140, description="Home or garaging address.")
    quoteLines: Optional[list[Line]] = Field(None, description="Lines they want quoted: auto, home, renters. Send the full list.")
    drivers: Optional[list[Driver]] = Field(None, description="Every driver for an auto quote. Send the full list each time.")
    vehicles: Optional[list[Vehicle]] = Field(None, description="Every vehicle for an auto quote. Send the full list each time.")
    currentCarrier: Optional[str] = Field(None, max_length=60, description="Who insures them now, or 'none'.")
    renewalDate: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="When their current policy renews, YYYY-MM-DD.")
    coverageWanted: Optional[list[Coverage]] = Field(None, description="What they said they want. Send the full list.")
    yearBuilt: Optional[int] = Field(None, ge=1800, le=2027, description="Home quotes: year the home was built.")
    squareFeet: Optional[int] = Field(None, ge=200, le=20000, description="Home quotes: square footage.")
    personalProperty: Optional[int] = Field(None, ge=1000, le=500000, description="Renters quotes: roughly what their belongings are worth, in dollars.")


def note_account(state: InsuranceState, i: NoteAccount, ctx: OpContext) -> OpResult:
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    if "dateOfBirth" in new and new["dateOfBirth"] >= state.today:
        return fail("bad_date", "That date of birth is not right. Check it with the caller.")
    for k in ("name", "address", "currentCarrier"):
        if k in new:
            new[k] = new[k].strip()
    changed = [k for k, v in new.items() if state.account.get(k) != v]
    state.account.update(new)
    state.opened = True
    out: dict[str, Any] = {}
    if state.account.get("quoteLines"):
        miss = quote_missing(state)
        out["stillNeededForTheQuote"] = miss or "Nothing: offer a call with a licensed agent to go through the options."
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", out, bool(changed))


class FindCustomer(BaseModel):
    name: Optional[str] = Field(None, max_length=80, description="The caller's full name.")
    dateOfBirth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Their date of birth, YYYY-MM-DD.")
    policyNumber: Optional[str] = Field(None, max_length=20, description="A policy number, if they have it.")


def find_customer(state: InsuranceState, i: FindCustomer, ctx: OpContext) -> OpResult:
    if state.customer:
        return ok(f"Already verified · {state.customer['name']}", {"name": state.customer["name"], "policies": policy_list(state.customer)})
    if state.lookups >= MAX_LOOKUPS:
        return fail("too_many_tries", "Stop trying to look them up. Offer a message so their account manager can call them back.")
    c, why = store.find_customer(i.name, i.dateOfBirth, i.policyNumber)
    state.opened = True
    if why in ("need_name", "need_dob"):
        return fail(why, "Ask for their full name and date of birth, or a policy number.")
    state.lookups += 1
    if not c:
        return fail("not_found", "No match. Ask them to check the spelling or the date once; if it still does not match, treat them as a new customer or take a message. Never say which detail was wrong.")
    state.customer = c
    state.account.setdefault("name", c["name"])
    state.account.setdefault("dateOfBirth", c["dateOfBirth"])
    state.account.setdefault("address", c["address"])
    return ok(f"Verified · {c['name']}", {"name": c["name"], "policies": policy_list(c)}, True)


def policy_list(c: dict[str, Any]) -> list[dict[str, str]]:
    return [{"policyNumber": n, "line": LINE_LABEL[store.POLICIES[n]["line"]], "carrier": carrier(store.POLICIES[n]["carrier"])["name"]} for n in c["policies"]]


def owned(state: InsuranceState, number: Optional[str], line: Optional[str]) -> Optional[dict[str, Any]]:
    if not state.customer:
        return None
    mine = [store.POLICIES[n] for n in state.customer["policies"]]
    if number:
        p = store.policy(number)
        return p if p and p["number"] in state.customer["policies"] else None
    if line:
        return next((p for p in mine if p["line"] == line), None)
    return mine[0] if len(mine) == 1 else None


class PolicyRef(BaseModel):
    policyNumber: Optional[str] = Field(None, max_length=20)
    line: Optional[Line] = Field(None, description="auto, home or renters, when they don't know the number.")


def get_policy(state: InsuranceState, i: PolicyRef, ctx: OpContext) -> OpResult:
    if not state.customer:
        return fail("verify_first", "Find the customer first with find_customer (name and date of birth, or a policy number).")
    p = owned(state, i.policyNumber, i.line)
    if not p:
        return fail("which_policy", "Ask which policy: " + ", ".join(f"{x['line']} with {x['carrier']}" for x in policy_list(state.customer)) + ".")
    state.policy = p["number"]
    out = {
        "policyNumber": p["number"], "line": LINE_LABEL[p["line"]], "carrier": carrier(p["carrier"])["name"], "term": p["term"],
        "effective": date_label(p["effective"]) + f", {p['effective'][:4]}", "renews": date_label(p["renewal"]) + f", {p['renewal'][:4]}",
        "coverages": p["coverages"], "billing": p["billing"],
        "say": "Read only what is asked, from this. Never say whether a particular loss would be covered: the carrier's claims team decides that.",
    }
    for k in ("vehicles", "drivers", "property"):
        if p.get(k):
            out[k] = p[k]
    return ok(f"{LINE_LABEL[p['line']]} policy · {carrier(p['carrier'])['name']}", out, True)


class ReportClaim(BaseModel):
    policyNumber: Optional[str] = Field(None, max_length=20)
    line: Optional[Line] = None
    kind: Optional[ClaimType] = Field(None, description="What happened, from the list.")
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="When it happened, YYYY-MM-DD, from today's date.")
    location: Optional[str] = Field(None, max_length=120, description="Where it happened.")
    description: Optional[str] = Field(None, max_length=400, description="What happened, in the caller's words.")
    injuries: Optional[Tri] = Field(None, description="Was anyone hurt.")
    policeReport: Optional[Tri] = None
    otherParty: Optional[str] = Field(None, max_length=140, description="The other driver or party, and their insurer if known.")
    photos: Optional[Tri] = Field(None, description="Whether they have photos.")


def report_claim(state: InsuranceState, i: ReportClaim, ctx: OpContext) -> OpResult:
    if not state.customer:
        return fail("verify_first", "Find the customer first with find_customer.")
    p = owned(state, i.policyNumber, i.line) or (store.POLICIES.get(state.claim["policy"]) if state.claim else None)
    if not p:
        return fail("which_policy", "Ask which policy this is on: " + ", ".join(f"{x['line']} with {x['carrier']}" for x in policy_list(state.customer)) + ".")
    new = {k: v for k, v in i.model_dump(exclude={"policyNumber", "line"}).items() if v is not None}
    if new.get("date") and new["date"] > state.today:
        return fail("future_date", "That date is in the future. Check it with the caller.")
    if not state.claim:
        state.claim = {"id": reference("FN", state.seq, state.seed), "policy": p["number"], "loggedAt": ctx.now.isoformat()}
        state.seq += 1
    state.claim.update(new)
    state.claim["policy"] = p["number"]
    state.policy = p["number"]
    c = carrier(p["carrier"])
    missing = [label for key, label in (("kind", "what happened"), ("date", "when"), ("location", "where"), ("injuries", "whether anyone was hurt")) if key not in state.claim]
    out: dict[str, Any] = {"noticeId": state.claim["id"], "carrier": c["name"], "claimsLine": c["claimsLine"], "claimsOnline": c["claimsOnline"]}
    if missing:
        out["stillNeeded"] = missing
    else:
        out["say"] = f"Say the details are logged for our team and {first_name(SERVICE)} will follow up. Give the {c['name']} claims line slowly, digit by digit, and say the carrier's adjuster decides coverage. If anyone was hurt, say to get medical help first."
    return ok(f"Claim notice {state.claim['id']} · {c['name']}", out, True)


class RequestChange(BaseModel):
    policyNumber: Optional[str] = Field(None, max_length=20)
    line: Optional[Line] = None
    kind: ChangeType
    details: str = Field(min_length=3, max_length=300, description="The change in the caller's words: the car (year, make, model), the driver, the new address.")


def request_change(state: InsuranceState, i: RequestChange, ctx: OpContext) -> OpResult:
    if not state.customer:
        return fail("verify_first", "Find the customer first with find_customer.")
    p = owned(state, i.policyNumber, i.line or ("auto" if i.kind in ("add_vehicle", "remove_vehicle", "add_driver", "remove_driver") else None))
    if not p:
        return fail("which_policy", "Ask which policy: " + ", ".join(f"{x['line']} with {x['carrier']}" for x in policy_list(state.customer)) + ".")
    dup = next((r for r in state.requests if r.policy == p["number"] and r.kind == i.kind and r.details == i.details.strip()), None)
    if dup:
        return ok(f"Already logged · {dup.id}", {"requestId": dup.id, "duplicate": True})
    rid = reference("SR", state.seq, state.seed)
    state.seq += 1
    state.requests.append(Request(rid, p["number"], i.kind, i.details.strip(), ctx.now.isoformat()))
    state.policy = p["number"]
    return ok(f"{CHANGE_LABEL[i.kind]} · {rid}", {"requestId": rid, "who": person(SERVICE)["name"], "say": f"Say it is logged and {first_name(SERVICE)} will confirm it, usually the same business day; it takes effect once confirmed. Never say the change is made or that coverage is in place, and never quote a price change."}, True)


class EmailIdCard(BaseModel):
    policyNumber: Optional[str] = Field(None, max_length=20)
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    callerConfirmed: bool = Confirmed()


async def email_id_card(state: InsuranceState, i: EmailIdCard, ctx: OpContext) -> OpResult:
    if not state.customer:
        return fail("verify_first", "Find the customer first with find_customer.")
    p = owned(state, i.policyNumber, "auto" if not i.policyNumber else None)
    if not p or p["line"] != "auto":
        return fail("not_auto", "ID cards are for auto policies. Ask which auto policy.")
    card = {"name": state.customer["name"], "carrier": carrier(p["carrier"])["name"], "policyNumber": p["number"], "effective": p["effective"], "expires": p["renewal"], "vehicles": p.get("vehicles", []), "drivers": p.get("drivers", []), "claimsLine": carrier(p["carrier"])["claimsLine"]}
    masked, why = await email.confirm(i.email, email.insurance_id_card(card))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.id_cards.append(p["number"])
    state.policy = p["number"]
    state.emailed = {"to": masked, "reference": p["number"], "kind": "idcard"}
    return ok(f"ID card emailed · {masked}", {"sent": True, "to": masked}, True)


class CheckAvailability(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = None


def check_availability(state: InsuranceState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_calendar", f"Calls can be booked from today to {date_label(days[-1])}.")

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    exact = [s for s in open_slots(state, i.date) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact}
    if exact:
        offered = exact[:3]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open on {date_label(i.date)}", {"day": date_label(i.date), "available": [describe_slot(state, s) for s in offered]}, True)
    later: list[str] = []
    for day in (d for d in days if d > i.date):
        later += [s for s in open_slots(state, day) if in_part(s)]
        if len(later) >= 3:
            break
    offered = later[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    if offered:
        first = offered[0][:10]
        state.viewing = {"date": first, "slots": [s for s in open_slots(state, first) if in_part(s)]}
    reason = "weekend" if weekday(i.date) in CLOSED_WEEKDAYS else "fully_booked"
    return ok(f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available", {"day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(state, s) for s in offered]}, True)


class BookAgentCall(BaseModel):
    slotId: str = Field(description="From check_availability.")
    topic: str = Field(min_length=3, max_length=120, description="What the call is for, e.g. 'Auto and renters quote' or 'Review home coverage'.")
    callerConfirmed: bool = Confirmed()


def book_agent_call(state: InsuranceState, i: BookAgentCall, ctx: OpContext) -> OpResult:
    name = state.account.get("name") or (state.customer or {}).get("name")
    if not name:
        return fail("missing_details", "Ask for the caller's name first.")
    same = next((c for c in active(state) if c.slot_id == i.slotId), None)
    if same:
        return ok(f"Already booked · {same.id}", {"callId": same.id, "duplicate": True})
    if active(state):
        return fail("already_booked", "A call is already booked on this call. Use reschedule_agent_call to change it.")
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    who = free_agent(state, day, hour)
    if not who:
        return fail("slot_taken", "That time has just been taken.", {"alternatives": [describe_slot(state, s) for s in open_slots(state, day)[:3]]})
    cid = reference("BB", state.seq, state.seed)
    state.seq += 1
    state.calendar.append(Booked(who, day, hour, cid, False))
    state.calls.append(AgentCall(cid, i.slotId, who, i.topic.strip(), name, "booked", ctx.now.isoformat()))
    state.viewing = {"date": day, "slots": open_slots(state, day)}
    return ok(f"Call booked with {first_name(who)} · {cid}", {"callId": cid, "agent": first_name(who), "say": "Say who will call them, and when. They will call the number on file."}, True)


class RescheduleAgentCall(BaseModel):
    callId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_agent_call(state: InsuranceState, i: RescheduleAgentCall, ctx: OpContext) -> OpResult:
    c = next((c for c in active(state) if c.id == i.callId), None)
    if not c:
        return fail("not_found", "There is no call with that reference booked on this call.")
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    who = free_agent(state, day, hour, c.id)
    if not who:
        return fail("slot_taken", "That time is no longer free.")
    slot = next(b for b in state.calendar if b.ref == c.id)
    slot.staff_id, slot.date, slot.hour = who, day, hour
    c.slot_id, c.staff_id, c.updated_at, c.changes = i.newSlotId, who, ctx.now.isoformat(), c.changes + 1
    state.viewing = {"date": day, "slots": open_slots(state, day)}
    s = describe_slot(state, c.slot_id, who)
    return ok(f"Call moved · {c.id}", {"callId": c.id, "agent": first_name(who), "newTime": f"{s['day']} at {s['time']}"}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80)


def take_message(state: InsuranceState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, ctx.now.isoformat()))
    state.opened = True
    return ok(f"Message for {first_name(SERVICE)} · {mid}", {"messageId": mid, "for": person(SERVICE)["name"]}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " Never mention a price or say anything is covered.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: InsuranceState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    """Emails the caller the booked agent call, or a summary of the call (claim notice, change request, message) when nothing was booked."""
    booked = active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        rows: list[tuple[str, str]] = []
        if state.claim:
            c = carrier(store.POLICIES[state.claim["policy"]]["carrier"])
            rows += [("Claim notice", state.claim["id"]), (f"{c['name']} claims", c["claimsLine"])]
        rows += [(CHANGE_LABEL[r.kind], f"{r.id} · {r.details}") for r in state.requests]
        name = (state.customer or {}).get("name") or state.account.get("name") or (state.messages[-1].name if state.messages else None)
        r, sent = await send_summary("insurance", "Owen", i.email, i.recap, name, messages, rows, did="looked up your policy and logged everything for our team")
        if sent:
            state.emailed = sent
        return r
    c = booked[-1]
    s = describe_slot(state, c.slot_id, c.staff_id)
    v = {"day": s["day"], "time": s["time"], "agent": s["agent"], "topic": c.topic, "name": c.name, "reference": c.id}
    masked, why = await email.confirm(i.email, email.insurance_call_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": c.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)


def days_until(today: str, day: str) -> int:
    return (date.fromisoformat(day) - date.fromisoformat(today)).days
