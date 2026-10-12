"""Wes's operations at Woodward Motor Co.: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, add_days, already_sent, date_label, fail, mask_number, ok, reference, send_summary, weekday
from . import store
from .state import (
    Appointment,
    Busy,
    DealershipState,
    Message,
    Purpose,
    active,
    bookable_days,
    confirm_text,
    describe_slot,
    full_name,
    is_free,
    money,
    open_slots,
    parse_slot,
    spoken,
)
from .store import BODIES, BUSINESS, CLOSED_WEEKDAYS, DAYS_AHEAD, FINANCE, SERVICE_ADVISOR, SERVICE_IDS, car, describe_search, salesperson, service

Body = Literal[BODIES]  # type: ignore[valid-type]
ServiceId = Literal[SERVICE_IDS]  # type: ignore[valid-type]


def get_dealership_info(state: DealershipState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Hours, pricing, financing, trade-ins, warranty and service", {**BUSINESS, "today": state.today})


class SearchInventory(BaseModel):
    make: Optional[str] = Field(None, max_length=30, description="e.g. Ford, Chevrolet, Toyota.")
    model: Optional[str] = Field(None, max_length=30, description="e.g. F-150, Equinox, RAV4.")
    body: Optional[Body] = Field(None, description="SUV, Car, Truck, Van or Minivan.")
    maxPrice: Optional[int] = Field(None, ge=1000, le=500000, description="Top of the budget in dollars: 'under 30' means 30000.")
    minYear: Optional[int] = Field(None, ge=1990, le=2027)
    maxMiles: Optional[int] = Field(None, ge=0, le=300000)
    color: Optional[str] = Field(None, max_length=20)
    drivetrain: Optional[Literal["4x4/AWD", "AWD", "4WD", "FWD", "RWD"]] = None
    fuel: Optional[Literal["Electric", "Hybrid", "Gasoline", "Diesel"]] = None


def search_inventory(state: DealershipState, i: SearchInventory, ctx: OpContext) -> OpResult:
    hits = store.search(i.make, i.model, i.body, i.maxPrice, i.minYear, i.maxMiles, i.color, i.drivetrain, i.fuel)
    state.search = {k: v for k, v in i.model_dump().items() if v is not None}
    state.matches = [c["stock"] for c in hits]
    state.read = state.matches[:3]
    state.focus = None
    state.opened = True
    for k, v in (("make", i.make), ("model", i.model), ("body", i.body), ("maxPrice", i.maxPrice)):
        if v:
            state.lead.setdefault(k, v)
    if not hits:
        looser = store.search(i.make, i.model, i.body, None, None, None, None, None, i.fuel) or store.search(None, None, i.body, i.maxPrice, None, None, None, None, None)
        return ok("No exact matches", {"total": 0, "closest": [spoken(c) for c in looser[:2]], "say": "Say we don't have that exact one on the lot right now; offer the closest one or two, or to have a consultant call when one comes in."}, True)
    return ok(f"{len(hits)} on the lot · reading {len(state.read)}", {"total": len(hits), "matches": [spoken(car(s)) for s in state.read]}, True)  # type: ignore[arg-type]


class GetVehicle(BaseModel):
    stockNumber: str = Field(description="From search_inventory, or the last six of the VIN if the caller reads it out.")


def get_vehicle(state: DealershipState, i: GetVehicle, ctx: OpContext) -> OpResult:
    c = car(i.stockNumber)
    if not c:
        return fail("not_found", "That car isn't on our lot. Say so, and offer to search for something similar.")
    state.focus = c["stock"]
    if c["stock"] not in state.matches:
        state.matches = [c["stock"], *state.matches]
    state.lead["interest"] = c["stock"]
    state.opened = True
    out = {**spoken(c), "interior": c["interior"], "engine": c["engine"], "transmission": c["transmission"], "seats": c["seats"], "vinLast6": c["vin"][-6:], "warranty": "Certified pre-owned warranty" if c["cpo"] else "90-day / 3,000-mile powertrain warranty", "say": "Answer only from these facts. Anything not here (options, accident history, features): say a consultant can check, never guess."}
    return ok(f"{describe_search(c)} · {money(c['price'])}", out, True)


class NoteLead(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Once the caller confirmed it.")
    payment: Optional[Literal["cash", "finance", "lease", "undecided"]] = None
    maxPrice: Optional[int] = Field(None, ge=1000, le=500000)
    timeline: Optional[Literal["this_week", "this_month", "few_months", "browsing"]] = None
    tradeYear: Optional[int] = Field(None, ge=1980, le=2027, description="Trade-in: year.")
    tradeMake: Optional[str] = Field(None, max_length=30)
    tradeModel: Optional[str] = Field(None, max_length=40)
    tradeMiles: Optional[int] = Field(None, ge=0, le=500000)
    tradeCondition: Optional[Literal["excellent", "good", "fair", "rough"]] = None
    tradeOwed: Optional[Literal["paid_off", "still_owe", "not_sure"]] = None


def note_lead(state: DealershipState, i: NoteLead, ctx: OpContext) -> OpResult:
    new = {k: (v.strip() if isinstance(v, str) else v) for k, v in i.model_dump().items() if v is not None}
    first_only = "name" in new and not full_name(new["name"])
    if first_only:
        del new["name"]
    changed = [k for k, v in new.items() if state.lead.get(k) != v]
    state.lead.update(new)
    state.opened = True
    out: dict[str, Any] = {}
    if "name" in changed:
        c = store.known_customer(state.lead["name"])
        state.customer = c
        if c:
            out["knownCustomer"] = {"car": c["car"], "salesperson": salesperson(c["salesperson"])["name"], "say": "Welcome them back. Confirm the last four digits of their phone before mentioning their car or history."}
    if any(k.startswith("trade") for k in changed):
        out["tradeIn"] = "Noted for an in-person appraisal (about 20 minutes). Never give a value or a range."
    if first_only:
        out["next"] = "And your last name?"
        out["say"] = "The name was not saved: it needs a first and last name. Ask \"And your last name?\" before you save or book."
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", out, bool(changed))


class CheckAvailability(BaseModel):
    purpose: Purpose = Field(description="test_drive (a car on our lot) or service (the caller's own car).")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD.")
    stockNumber: Optional[str] = Field(None, description="Test drives: the car.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = None


def check_availability(state: DealershipState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    stock = i.stockNumber or state.focus
    if i.purpose == "test_drive" and not (stock and car(stock)):
        return fail("which_car", "Ask which car; open it with get_vehicle first.")
    days = bookable_days(state)
    if i.date < state.today:
        return fail("outside_calendar", f"That day has passed. Bookings open from today through {date_label(days[-1])}.")
    if i.date > add_days(state.today, DAYS_AHEAD - 1):
        return fail("outside_calendar", f"This demo's calendar only goes out two weeks, through {date_label(days[-1])}. Offer the caller a day within that.")

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    exact = [s for s in open_slots(state, i.purpose, i.date, stock) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "purpose": i.purpose, "stock": stock if i.purpose == "test_drive" else None}
    if exact:
        picked = exact[:: max(1, len(exact) // 3)][:3]
        state.offered = list(dict.fromkeys(state.offered + picked))
        return ok(f"{len(exact)} open on {date_label(i.date)}", {"day": date_label(i.date), "available": [describe_slot(s) for s in picked]}, True)
    later: list[str] = []
    for d in (d for d in days if d > i.date):
        later += [s for s in open_slots(state, i.purpose, d, stock) if in_part(s)][:2]
        if len(later) >= 3:
            break
    picked = later[:3]
    state.offered = list(dict.fromkeys(state.offered + picked))
    if picked:
        first = picked[0][:10]
        state.viewing = {**state.viewing, "date": first, "slots": [s for s in open_slots(state, i.purpose, first, stock) if in_part(s)]}
    reason = "closed_sunday" if weekday(i.date) in CLOSED_WEEKDAYS else "fully_booked"
    return ok(f"Nothing on {date_label(i.date)} · next openings found" if picked else "Nothing available", {"day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(s) for s in picked]}, True)


class BookAppointment(BaseModel):
    purpose: Purpose
    slotId: str = Field(description="From check_availability.")
    stockNumber: Optional[str] = Field(None, description="Test drives: the car.")
    service: Optional[ServiceId] = Field(None, description="Service visits: what it's for.")
    ownVehicle: Optional[str] = Field(None, max_length=80, description="Service visits: the caller's car, e.g. '2019 Honda CR-V'.")
    callerConfirmed: bool = Confirmed()


def book_appointment(state: DealershipState, i: BookAppointment, ctx: OpContext) -> OpResult:
    name = state.lead.get("name")
    if not full_name(name):
        return fail("missing_details", "Ask for the caller's first and last name first (\"And your last name?\"), and save it with note_lead.")
    stock = (i.stockNumber or (state.viewing or {}).get("stock") or state.focus) if i.purpose == "test_drive" else None
    if i.purpose == "test_drive" and not (stock and car(stock)):
        return fail("which_car", "Which car is the test drive for? Open it with get_vehicle.")
    if i.purpose == "service" and not (i.service and i.ownVehicle):
        return fail("missing_details", "Ask what the service is for first, then which car in the next turn.")
    vehicle = describe_search(car(stock)) if stock else i.ownVehicle  # type: ignore[arg-type]
    same = next((a for a in active(state) if a.slot_id == i.slotId and a.purpose == i.purpose), None)
    if same:
        return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True, "confirmation": confirm_text(same)})
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour, who = parse_slot(i.slotId)  # type: ignore[misc]
    if not is_free(state, who, day, hour):
        return fail("slot_taken", "That time has just been taken. Check availability again.")
    aid = reference("WM", state.seq, state.seed)
    state.seq += 1
    state.busy.append(Busy(who, day, hour, aid, False))
    state.appointments.append(Appointment(aid, i.purpose, i.slotId, who, stock, i.service, vehicle or "", name, "booked", ctx.now.isoformat()))
    state.viewing = {"date": day, "slots": open_slots(state, i.purpose, day, stock), "purpose": i.purpose, "stock": stock}
    out: dict[str, Any] = {"appointmentId": aid}
    if i.purpose == "test_drive":
        out.update({"with": salesperson(who)["short"], "say": "Say it's booked, who will have the car pulled up, and to bring their driver's licence. The car is held for them for 24 hours."})
    else:
        out.update({"advisor": SERVICE_ADVISOR["name"], "say": f"Say it's booked with {SERVICE_ADVISOR['name']} at the service desk; mention a loaner only if they ask."})
    return ok(f"{'Test drive' if i.purpose == 'test_drive' else 'Service'} booked · {aid}", out, True)


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: DealershipState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    a = next((a for a in active(state) if a.id == i.appointmentId), None)
    if not a:
        return fail("not_found", "There is no booking with that reference in this call.")
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour, who = parse_slot(i.newSlotId)  # type: ignore[misc]
    if not is_free(state, who, day, hour, a.id):
        return fail("slot_taken", "That time is no longer free.")
    b = next(b for b in state.busy if b.ref == a.id)
    b.who, b.date, b.hour = who, day, hour
    a.slot_id, a.who, a.updated_at, a.changes = i.newSlotId, who, ctx.now.isoformat(), a.changes + 1
    s = describe_slot(a.slot_id)
    return ok(f"Moved · {a.id}", {"appointmentId": a.id, "newTime": f"{s['day']} at {s['time']}"}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    forTeam: Literal["sales", "finance", "service"] = Field(description="finance for rates, payments, credit and approvals; service for repairs; sales for the rest.")
    preferredTime: Optional[str] = Field(None, max_length=80)


def take_message(state: DealershipState, i: TakeMessage, ctx: OpContext) -> OpResult:
    if not full_name(i.name):
        return fail("missing_details", "Ask for the caller's first and last name (\"And your last name?\") before taking the message.")
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    who = FINANCE["name"] if i.forTeam == "finance" else SERVICE_ADVISOR["name"] if i.forTeam == "service" else salesperson((state.customer or {}).get("salesperson") or "tony")["name"]
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, who, ctx.now.isoformat()))
    state.opened = True
    return ok(f"Message for {who.split(' ')[0]} · {mid}", {"messageId": mid, "for": who}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " You may include cars and listed prices you read out. Never a payment or a trade-in value.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: DealershipState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    booked = active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        rows = [(describe_search(car(s)), f"{money(car(s)['price'])} · {car(s)['miles']:,} miles · stock {s}") for s in state.read if car(s)]  # type: ignore[index]
        r, sent = await send_summary("dealership", "Wes", i.email, i.recap, state.lead.get("name"), messages, rows, did="searched the lot for you and passed your details to the team")
        if sent:
            state.emailed = sent
        return r
    a = booked[-1]
    s = describe_slot(a.slot_id)
    c = car(a.stock) if a.stock else None
    rows: list[tuple[str, str]] = []
    if c:
        rows += [("Car", f"{describe_search(c)} · {c['color']}"), ("Price", f"{money(c['price'])} plus tax, title, plates and doc fee"), ("Miles", f"{c['miles']:,}"), ("Stock", c["stock"]), ("With", s.get("with", "")), ("Bring", "Your driver's licence" + (" and your trade-in's title or payoff details" if state.lead.get("tradeMake") else ""))]
    else:
        rows += [("Car", a.vehicle), ("Service", service(a.service_id)["name"] + f" · {service(a.service_id)['price']}"), ("Advisor", SERVICE_ADVISOR["name"])]  # type: ignore[arg-type]
    rows.append(("Where", BUSINESS["address"].split(",")[0] + ", Detroit"))
    v = {"brand": "dealership", "agent": "Wes", "service": "Test drive" if c else "Service visit", "day": s["day"], "time": s["time"], "zone": "Eastern", "name": a.name, "reference": a.id, "rows": rows, "did": "searched the lot, found the car and booked your test drive" if c else "booked your car into the service bay", "photo": None}
    masked, why = await email.confirm(i.email, email.appointment_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
