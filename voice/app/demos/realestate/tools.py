"""Miles's operations at Juniper Row Realty: plain functions over one call's state, tested without a model."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, already_sent, date_label, fail, mask_number, ok, reference, send_summary, weekday
from . import store
from .state import (
    Appointment,
    AreaId,
    Booked,
    Financing,
    Intent,
    Message,
    PropertyType,
    Purpose,
    RealEstateState,
    SellerReason,
    Timeline,
    active,
    bookable_days,
    confirm_text,
    describe_slot,
    is_free,
    money,
    open_slots,
    parse_slot,
    spoken,
    who_handles,
)
from .store import AREA_NAME, BUSINESS, CLOSED_WEEKDAYS, agent, first_name, listing


def get_brokerage_info(state: RealEstateState, _: Any, ctx: OpContext) -> OpResult:
    return ok("The brokerage's areas, hours and agents", {**BUSINESS, "areas": [{"name": a["name"], "neighbourhoods": a["places"]} for a in store.AREAS], "today": state.today})


class NoteLead(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Best callback number, once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Email address, only once the caller confirmed it.")
    intent: Optional[Intent] = Field(None, description="buy, sell or both.")
    areas: Optional[list[AreaId]] = Field(None, description="Areas they want to buy in, from the list. Send the full list so far.")
    minPrice: Optional[int] = Field(None, ge=0, le=20_000_000, description="Lowest price they mentioned, in dollars.")
    maxPrice: Optional[int] = Field(None, ge=0, le=20_000_000, description="Top of their budget, in dollars.")
    beds: Optional[int] = Field(None, ge=0, le=10, description="Bedrooms they need, at least.")
    propertyType: Optional[PropertyType] = Field(None, description="Single Family (a house), Condo or Townhouse.")
    timeline: Optional[Timeline] = Field(None, description="When they hope to move: now, three_months, six_months, later, browsing.")
    financing: Optional[Financing] = Field(None, description="Buyers: pre_approved, cash, talking_to_lender, not_yet.")
    lender: Optional[str] = Field(None, min_length=2, max_length=80, description="Their lender, if they named one.")
    firstTimeBuyer: Optional[bool] = Field(None, description="True if this is their first home.")
    hasAgent: Optional[bool] = Field(None, description="True if they already have a signed agreement with another agent.")
    sellAddress: Optional[str] = Field(None, min_length=5, max_length=140, description="Sellers: the address of the home they want to sell.")
    sellerReason: Optional[SellerReason] = Field(None, description="Sellers: why they are selling, if they said.")


def note_lead(state: RealEstateState, i: NoteLead, ctx: OpContext) -> OpResult:
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    for k in ("name", "lender", "sellAddress"):
        if k in new:
            new[k] = new[k].strip()
    if "minPrice" in new and "maxPrice" in new and new["minPrice"] > new["maxPrice"]:
        new["minPrice"], new["maxPrice"] = new["maxPrice"], new["minPrice"]
    changed = [k for k, v in new.items() if state.lead.get(k) != v]
    state.lead.update(new)
    state.opened = True
    out: dict[str, Any] = {}
    if "name" in changed:
        c = store.known_contact(state.lead["name"])
        state.contact = c
        if c:
            out["knownContact"] = {"spokeWith": agent(c["agent"])["name"], "note": c["lastContact"], "say": "Say warmly that you see they spoke with that agent, in one short sentence. Ask them to confirm the last four digits of their phone before you mention any detail of the note."}
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", out, bool(changed))


class SearchListings(BaseModel):
    area: Optional[str] = Field(None, max_length=60, description="The area, neighbourhood or zip code in the caller's words, e.g. Hyde Park, East Austin, 78704. Empty for all of Austin.")
    minPrice: Optional[int] = Field(None, ge=0, le=20_000_000)
    maxPrice: Optional[int] = Field(None, ge=0, le=20_000_000, description="Top of the budget, in dollars: 'under 700' means 700000.")
    minBeds: Optional[int] = Field(None, ge=0, le=10)
    minBaths: Optional[float] = Field(None, ge=0, le=10)
    propertyType: Optional[PropertyType] = Field(None, description="Single Family (a house), Condo or Townhouse.")


def search_listings(state: RealEstateState, i: SearchListings, ctx: OpContext) -> OpResult:
    areas: list[str] = []
    if i.area and i.area.strip():
        found = store.area_of(i.area)
        if not found:
            return fail("unknown_area", f"Juniper Row covers {', '.join(AREA_NAME.values())}. Ask which of those is closest.", {"areas": list(AREA_NAME.values())})
        areas = [found]
    hits = store.search(areas, i.minPrice, i.maxPrice, i.minBeds, i.minBaths, [i.propertyType] if i.propertyType else [])
    state.search = {"area": AREA_NAME[areas[0]] if areas else "All of Austin", "minPrice": i.minPrice, "maxPrice": i.maxPrice, "minBeds": i.minBeds, "minBaths": i.minBaths, "type": i.propertyType}
    state.matches = [x["id"] for x in hits]
    state.read = state.matches[:3]
    state.focus = None
    state.opened = True
    if areas and "areas" not in state.lead:
        state.lead["areas"] = areas
    if not hits:
        # Show what is closest so the caller has somewhere to go: the same area at any price, or anywhere at their price.
        near = store.search(areas, None, None, i.minBeds, None, []) or store.search([], i.minPrice, i.maxPrice, i.minBeds, None, [])
        return ok("No exact matches", {"matches": [], "total": 0, "closest": [spoken(x) for x in near[:2]], "say": "Say nothing matches exactly, offer the closest one or two, or offer to have an agent send new listings as they come up."}, True)
    return ok(f"{len(hits)} match{'es' if len(hits) != 1 else ''} · reading {len(state.read)}", {"total": len(hits), "matches": [spoken(listing(x)) for x in state.read]}, True)  # type: ignore[arg-type]


class GetListing(BaseModel):
    listingId: Optional[str] = Field(None, description="From search_listings or an earlier get_listing.")
    street: Optional[str] = Field(None, max_length=100, description="The street (and number, if given) when the caller names a home, e.g. 'Clarkson' or '1204 Clarkson Avenue'.")


def get_listing(state: RealEstateState, i: GetListing, ctx: OpContext) -> OpResult:
    if i.listingId:
        x = listing(i.listingId)
        hits = [x] if x else []
    elif i.street:
        hits = store.by_street(i.street)
    else:
        return fail("missing_details", "Pass the listingId, or the street the caller named.")
    if not hits:
        return fail("not_found", "That home is not in our listings. Say you don't see it, and offer to have an agent check and call back.")
    if len(hits) > 1:
        state.matches = [x["id"] for x in hits]
        state.read = state.matches[:3]
        return ok(f"{len(hits)} homes on that street", {"several": [spoken(x) for x in hits[:3]], "say": "Read the addresses and ask which one."}, True)
    x = hits[0]
    state.focus = x["id"]
    if x["id"] not in state.matches:
        state.matches = [x["id"], *state.matches]
    state.opened = True
    out = {**spoken(x), "status": "Active, for sale", "agent": first_name(who_handles(state, "showing", x["id"]))}
    for k, label in (("yearBuilt", "yearBuilt"), ("lotSqft", "lotSquareFeet"), ("hoaFee", "hoaFeePerMonth")):
        if x.get(k):
            out[label] = x[k]
    return ok(f"{x['address']} · {money(x['price'])}", out, True)


class EstimateValue(BaseModel):
    address: str = Field(min_length=8, max_length=140, description="The caller's street address, with the neighbourhood or zip code if they gave it, e.g. '2103 S Gilpin St, 78704'.")
    beds: Optional[float] = Field(None, ge=0, le=10, description="Bedrooms, if they said.")
    squareFeet: Optional[int] = Field(None, ge=300, le=20000, description="Square footage, if they know it roughly.")


def estimate_value(state: RealEstateState, i: EstimateValue, ctx: OpContext) -> OpResult:
    address = i.address.strip()
    if "austin" not in address.lower() and not any(z in address for a in store.AREAS for z in a["zips"]):
        address += ", Austin, TX"
    state.lead.setdefault("sellAddress", i.address.strip())
    state.lead.setdefault("intent", "sell")
    state.opened = True
    try:
        e = store.estimate_value(address, i.beds, i.squareFeet)
    except store.EstimateError:
        state.estimate = {"status": "unavailable", "address": i.address.strip()}
        return ok("No estimate · full valuation instead", {"estimate": None, "say": f"Say you can't give a range for that address over the phone (ask for the neighbourhood or zip code once if they didn't give it), and that {first_name(store.SELLER_AGENT)} gives a real number in person with a free valuation."}, True)
    state.estimate = {"status": "ok", **e}
    return ok(
        f"Estimate {money(e['low'])} to {money(e['high'])}",
        {"low": money(e["low"]), "high": money(e["high"]), "comparables": e["comparables"], "say": f"Give it as a range, call it a rough estimate from comparable homes for sale nearby, and say {first_name(store.SELLER_AGENT)} can firm it up with a free in-person valuation. Never give a single number or your own opinion of the price."},
        True,
    )


class CheckAvailability(BaseModel):
    purpose: Purpose = Field(description="showing (a buyer sees a listing) or valuation (a seller's home).")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    listingId: Optional[str] = Field(None, description="Showings: the home they want to see.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = Field(None, description="Morning is before noon; afternoon is noon onwards.")


def check_availability(state: RealEstateState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    lid = i.listingId or state.focus
    if i.purpose == "showing" and not (lid and listing(lid)):
        return fail("which_home", "Ask which home they want to see; find it with get_listing first.")
    aid = who_handles(state, i.purpose, lid)
    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_calendar", f"Times can be booked from today to {date_label(days[-1])}.")

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    exact = [s for s in open_slots(state, i.purpose, aid, i.date) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "agent": aid, "purpose": i.purpose, "listingId": lid if i.purpose == "showing" else None}
    if exact:
        offered = exact[:3]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open with {first_name(aid)} on {date_label(i.date)}", {"day": date_label(i.date), "agent": agent(aid)["name"], "available": [describe_slot(s, aid) for s in offered]}, True)
    later: list[str] = []
    for day in (d for d in days if d > i.date):
        later += [s for s in open_slots(state, i.purpose, aid, day) if in_part(s)]
        if len(later) >= 3:
            break
    offered = later[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    if offered:
        first = offered[0][:10]
        state.viewing = {**state.viewing, "date": first, "slots": [s for s in open_slots(state, i.purpose, aid, first) if in_part(s)]}
    reason = "closed" if weekday(i.date) in CLOSED_WEEKDAYS else "fully_booked"
    return ok(f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available", {"day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(s, aid) for s in offered]}, True)


class BookAppointment(BaseModel):
    purpose: Purpose
    slotId: str = Field(description="From check_availability.")
    listingId: Optional[str] = Field(None, description="Showings: the home.")
    callerConfirmed: bool = Confirmed()


def book_appointment(state: RealEstateState, i: BookAppointment, ctx: OpContext) -> OpResult:
    if not state.lead.get("name"):
        return fail("missing_details", "Ask for the caller's name first.")
    lid = i.listingId or (state.viewing or {}).get("listingId") or state.focus
    if i.purpose == "showing" and not (lid and listing(lid)):
        return fail("which_home", "Which home is the showing for? Find it with get_listing.")
    if i.purpose == "valuation" and not state.lead.get("sellAddress"):
        return fail("missing_details", "Ask for the address of the home to value.")
    address = listing(lid)["address"] if i.purpose == "showing" else state.lead["sellAddress"]  # type: ignore[index]
    same = next((a for a in active(state) if a.slot_id == i.slotId and a.purpose == i.purpose and a.address == address), None)
    if same:
        return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True, "confirmation": confirm_text(same)})
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    aid = who_handles(state, i.purpose, lid)
    if not is_free(state, aid, day, hour):
        alternatives = open_slots(state, i.purpose, aid, day)[:3]
        state.offered = list(dict.fromkeys(state.offered + alternatives))
        return fail("slot_taken", "That time has just been taken.", {"alternatives": [describe_slot(s, aid) for s in alternatives]})
    aid_ref = reference("JR", state.seq, state.seed)
    state.seq += 1
    state.calendar.append(Booked(aid, day, hour, aid_ref, False))
    state.appointments.append(Appointment(aid_ref, i.purpose, i.slotId, aid, lid if i.purpose == "showing" else None, address, state.lead["name"], "booked", ctx.now.isoformat()))
    state.viewing = {"date": day, "slots": open_slots(state, i.purpose, aid, day), "agent": aid, "purpose": i.purpose, "listingId": lid if i.purpose == "showing" else None}
    what = "Showing" if i.purpose == "showing" else "Valuation"
    return ok(f"{what} booked · {aid_ref}", {"appointmentId": aid_ref, "agent": first_name(aid), "address": address}, True)


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: RealEstateState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    a = next((a for a in active(state) if a.id == i.appointmentId), None)
    if not a:
        return fail("not_found", "There is no booking with that reference in this call.")
    if a.slot_id == i.newSlotId:
        return ok(f"Already at that time · {a.id}", {"appointmentId": a.id, "unchanged": True, "confirmation": confirm_text(a)})
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    if not is_free(state, a.agent_id, day, hour, a.id):
        return fail("slot_taken", "That time is no longer free.")
    slot = next(b for b in state.calendar if b.ref == a.id)
    slot.date, slot.hour = day, hour
    a.slot_id, a.updated_at, a.changes = i.newSlotId, ctx.now.isoformat(), a.changes + 1
    state.viewing = {"date": day, "slots": open_slots(state, a.purpose, a.agent_id, day), "agent": a.agent_id, "purpose": a.purpose, "listingId": a.listing_id}
    s = describe_slot(a.slot_id, a.agent_id)
    return ok(f"Moved · {a.id}", {"appointmentId": a.id, "newTime": f"{s['day']} at {s['time']}"}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")


def take_message(state: RealEstateState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    aid = who_handles(state)
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, aid, ctx.now.isoformat()))
    state.opened = True
    return ok(f"Message for {first_name(aid)} · {mid}", {"messageId": mid, "for": agent(aid)["name"]}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP + " You may include homes and prices you read out. Never mention a lead rank.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: RealEstateState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    """Emails the caller the booked showing or valuation, or a summary of the call when nothing was booked."""
    booked = active(state)
    kind = "booking" if booked else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if not booked:
        messages = [{"id": m.id, "summary": m.summary, "callback": mask_number(m.callback_number)} for m in state.messages]
        rows = [(listing(x)["address"], f"{money(listing(x)['price'])} · {listing(x)['beds']} bd · {listing(x)['baths']} ba") for x in state.read if listing(x)]  # type: ignore[index]
        if state.estimate and state.estimate.get("status") == "ok":
            rows.append(("Automated estimate", f"{money(state.estimate['low'])} to {money(state.estimate['high'])}"))
        name = state.messages[-1].name if state.messages else state.lead.get("name")
        r, sent = await send_summary("realestate", "Miles", i.email, i.recap, name, messages, rows, did="answered your questions about Austin homes and passed your details to the right agent")
        if sent:
            state.emailed = sent
        return r
    a = booked[-1]
    s = describe_slot(a.slot_id, a.agent_id)
    x = listing(a.listing_id) if a.listing_id else None
    v = {"purpose": a.purpose, "day": s["day"], "time": s["time"], "agent": s["agent"], "address": a.address, "name": a.name, "reference": a.id, "price": money(x["price"]) if x else None, "home": f"{x['beds']} bd · {x['baths']} ba · {x['sqft']:,} sq ft" if x else None}
    masked, why = await email.confirm(i.email, email.realestate_confirmation(v))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": a.id, "kind": "booking"}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)
