"""Marisol's operations at Palmetto Stays: plain functions over one call's state, tested without a model or the hotel API."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import RECAP_HELP, Confirmed, OpContext, OpResult, add_days, already_sent, date_label, fail, mask_number, ok, reference, send_summary
from . import store
from .prompt import PAYMENT_LINE
from .state import (
    SHORTLIST,
    AreaId,
    HotelState,
    Priority,
    brief,
    hotel_panel,
    hotels_with_prices,
    money,
    plain,
    room_choices,
    shortlist,
    stay_label,
    summarise,
)
from .store import AGENCY, AREAS, DAYS_AHEAD, MAX_ADULTS, MAX_NIGHTS, SAMPLE_GUEST, LiteError

LITE_FAILURES = {
    "timeout": "The hotel search took too long. Apologise and offer to try again.",
    "rate_limited": "The hotel system is busy. Apologise and offer to try again in a moment.",
    "network": "The hotel system could not be reached. Apologise and offer to try again.",
    "not_configured": "Hotel search is not available right now. Apologise briefly.",
    "rejected": "The hotel system did not accept that. Check the details with the caller.",
    "unavailable": "That rate has just sold out or expired. Say so, and offer to check the hotel's rooms again with choose_hotel.",
}


def lite_failure(err: LiteError) -> OpResult:
    return fail(err.kind, LITE_FAILURES.get(err.kind, LITE_FAILURES["network"]))


class NoArgs(BaseModel):
    pass


def get_agency_info(state: HotelState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Hours and policies", {**AGENCY, "today": state.today})


class SearchHotels(BaseModel):
    area: AreaId = Field(description="miami_beach for South Beach and the beachfront; downtown for Downtown Miami, Brickell and the airport.")
    checkin: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="Check-in date, YYYY-MM-DD.")
    checkout: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="Check-out date, YYYY-MM-DD.")
    adults: int = Field(2, ge=1, le=MAX_ADULTS)
    priority: Priority = Field("best", description="What the caller cares about most: best_rated (guest reviews), cheapest, or best (good reviews for the price).")
    minStars: Optional[int] = Field(None, ge=2, le=5, description="Only if the caller asked for at least this many stars.")
    maxPerNight: Optional[int] = Field(None, ge=50, le=5000, description="Only if the caller gave a budget per night, in dollars.")


async def search_hotels(state: HotelState, i: SearchHotels, ctx: OpContext) -> OpResult:
    try:
        cin, cout = date.fromisoformat(i.checkin), date.fromisoformat(i.checkout)
    except ValueError:
        return fail("invalid_date", "That is not a valid date. Check the dates with the caller.")
    if i.checkin < state.today:
        return fail("date_in_past", f"That date has passed; today is {date_label(state.today)}. Check the dates with the caller.")
    if i.checkin > add_days(state.today, DAYS_AHEAD):
        return fail("too_far_ahead", "Hotels only sell about eleven months ahead. Suggest earlier dates.")
    nights = (cout - cin).days
    if nights < 1:
        return fail("checkout_before_checkin", "Check-out must be after check-in. Check both dates with the caller.")
    if nights > MAX_NIGHTS:
        return fail("too_long", f"We book up to {MAX_NIGHTS} nights per call. Offer to take a message so an agent can call back about the longer stay, and use take_message.")
    state.search = {"area": i.area, "checkin": i.checkin, "checkout": i.checkout, "nights": nights, "adults": i.adults, "priority": i.priority, "minStars": i.minStars, "maxPerNight": i.maxPerNight}
    # A new search starts the booking again.
    state.options, state.selected, state.hotel, state.rooms, state.room, state.review, state.booking = [], None, None, [], None, None, None
    state.stage = "options"
    try:
        resp = await store.search_rates(AREAS[i.area]["city"], i.checkin, i.checkout, i.adults)
    except LiteError as err:
        return lite_failure(err)
    hotels = hotels_with_prices(resp)
    notes = []
    if i.minStars:
        starred = [h for h in hotels if (h["hotel"].get("stars") or 0) >= i.minStars]
        if starred:
            hotels = starred
        else:
            notes.append(f"Nothing at {i.minStars} stars or more for those dates; these are the best of the rest. Tell the caller.")
    if i.maxPerNight:
        within = [h for h in hotels if h["amount"] / nights <= i.maxPerNight]
        if within:
            hotels = within
        else:
            notes.append(f"Nothing under {money(i.maxPerNight)} a night for those dates; these are the closest. Tell the caller.")
    state.options = [summarise(h, n, label, nights) for n, (h, label) in enumerate(shortlist(hotels, i.priority), start=1)]
    if not state.options:
        return ok("No hotels found", {"shortlist": [], "note": "Nothing available for those dates. Suggest other dates or the other area."}, True)
    result: dict[str, Any] = {"stay": stay_label(state.search), "shortlist": [brief(o) for o in state.options], "next": "Lead with the hotel that fits what they care about; do not say how many hotels exist."}
    if notes:
        result["note"] = " ".join(notes)
    return ok(f"{len(state.options)} best of {len(hotels)} hotels", result, True)


class OptionRef(BaseModel):
    option: int = Field(ge=1, le=SHORTLIST, description="The option number from search_hotels.")


async def choose_hotel(state: HotelState, i: OptionRef, ctx: OpContext) -> OpResult:
    if not state.search or not state.options:
        return fail("no_search", "Search first with search_hotels.")
    option = next((o for o in state.options if o["option"] == i.option), None)
    if option is None:
        return fail("no_such_option", f"There is no option {i.option}. The options are 1 to {len(state.options)}.")
    s = state.search
    try:
        details = await store.hotel_details(option["hotelId"])
        rates = await store.hotel_rates(option["hotelId"], s["checkin"], s["checkout"], s["adults"])
    except LiteError as err:
        return lite_failure(err)
    state.selected = option["option"]
    state.hotel = hotel_panel(details, option)
    state.rooms = room_choices(rates, s["nights"])
    state.room, state.review, state.booking = None, None, None
    state.stage = "hotel"
    if not state.rooms:
        return ok(f"{state.hotel['name']} · no rooms left", {"hotel": state.hotel["name"], "rooms": [], "note": "The hotel has no rooms left for those dates. Offer another option from the short list."}, True)
    facts = {
        "hotel": state.hotel["name"],
        "stars": state.hotel["stars"],
        "guestRating": f"{state.hotel['rating']} out of 10 from {state.hotel['reviews']} reviews" if state.hotel["rating"] else None,
        "address": state.hotel["address"],
        "checkIn": state.hotel["checkIn"],
        "checkOut": state.hotel["checkOut"],
        "guestsLike": state.hotel["pros"],
        "guestsMention": state.hotel["cons"],
        "facilities": (details.get("hotelFacilities") or [])[:40],
        "about": plain(details.get("hotelDescription") or "")[:700],
        "parking": details.get("parking"),
        "petsAllowed": details.get("petsAllowed"),
        "rooms": [{k: v for k, v in r.items() if k not in ("offerId", "amount")} for r in state.rooms],
    }
    return ok(f"{state.hotel['name']} · {len(state.rooms)} room choice{'s' if len(state.rooms) > 1 else ''}", facts, True)


class RoomRef(BaseModel):
    room: int = Field(ge=1, le=3, description="The room number from choose_hotel.")


def choose_room(state: HotelState, i: RoomRef, ctx: OpContext) -> OpResult:
    room = next((r for r in state.rooms if r["room"] == i.room), None)
    if room is None:
        return fail("no_such_room", "Choose a hotel first with choose_hotel, then one of the rooms it returned.")
    state.room, state.review, state.booking = room["room"], None, None
    state.stage = "guest"
    result = {"room": room["name"], "board": room["board"], "cancellation": room["cancellation"], "total": room["total"], "next": "Ask for the lead guest's full name."}
    if room["payAtHotel"]:
        result["payAtHotel"] = room["payAtHotel"]
    return ok(f"Room · {room['name']}", result, True)


class SetGuest(BaseModel):
    fullName: str = Field(min_length=2, max_length=80, description="The lead guest's full name as the caller gave it.")


def set_guest(state: HotelState, i: SetGuest, ctx: OpContext) -> OpResult:
    if state.room is None:
        return fail("no_room", "Choose a room first with choose_room.")
    name = " ".join(i.fullName.split())
    state.guest = {"name": name, **SAMPLE_GUEST}
    state.review, state.booking = None, None
    state.stage = "review"
    return ok(f"Guest · {name}", {"guest": name, "otherDetails": "Filled with clearly marked samples in this demo; do not ask for them.", "next": "Call review_stay."}, True)


async def review_stay(state: HotelState, i: NoArgs, ctx: OpContext) -> OpResult:
    room = next((r for r in state.rooms if r["room"] == state.room), None)
    if room is None or state.hotel is None or state.search is None:
        return fail("no_room", "Choose a hotel and a room first.")
    if state.guest is None:
        return fail("no_guest", "Ask for the lead guest's full name and call set_guest first.")
    try:
        held = await store.prebook(room["offerId"])
    except LiteError as err:
        return lite_failure(err)
    amount = float(held.get("price") or room["amount"])
    s = state.search
    state.review = {
        "hotel": state.hotel["name"],
        "room": room["name"],
        "board": room["board"],
        "dates": f"{date_label(s['checkin'])} to {date_label(s['checkout'])}",
        "nights": s["nights"],
        "adults": s["adults"],
        "guest": state.guest["name"],
        "total": money(amount, cents=True),
        "taxes": room["payAtHotel"],
        "cancellation": room["cancellation"],
        "priceChanged": abs(amount - room["amount"]) >= 0.01,
    }
    state.stage = "review"
    return ok(f"Review · total {state.review['total']}", {"review": {k: v for k, v in state.review.items() if v is not None}, "next": "Read the stay back clearly with the total, and ask whether everything is correct."}, True)


async def book_stay(state: HotelState, i: NoArgs, ctx: OpContext) -> OpResult:
    """After the caller's yes to the review: everything is ready, and the demo stops at payment."""
    if state.review is None or state.guest is None:
        return fail("not_reviewed", "Call review_stay and read it back first; book only after the caller says yes.")
    state.stage = "payment"
    state.booking = {"status": "payment_stopped"}
    r = fail("test_mode", f'Everything up to payment is done; this demo runs in test mode, so nothing is booked or paid. Say exactly: "{PAYMENT_LINE}" Then ask whether there is anything else.', {"notBooked": True, "total": state.review["total"]})
    r.summary = "Stopped at payment · test mode"
    r.changed = True
    return r


class EmailQuote(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it, e.g. 'alex.taylor@example.com'.")
    recap: Optional[str] = Field(None, max_length=600, description=RECAP_HELP)
    callerConfirmed: bool = Confirmed()


async def email_quote(state: HotelState, i: EmailQuote, ctx: OpContext) -> OpResult:
    """Emails the caller the reviewed stay, or a summary of the call when there is none."""
    kind = "booking" if state.review and state.hotel else "summary"
    if already_sent(state.emailed, i.email, kind):
        return ok(f"Already emailed · {state.emailed['to']}", {"sent": True, "to": state.emailed["to"], "duplicate": True})  # type: ignore[index]
    if state.review is None or state.hotel is None:
        messages = [message_view(m) for m in state.messages]
        name = (state.guest or {}).get("name") or (state.messages[-1]["name"] if state.messages else None)
        r, sent = await send_summary("hotels", "Marisol", "Marisol at Palmetto Stays", i.email, i.recap, name, messages, did="searched real hotels with live rates and looked after your request")
        if sent:
            state.emailed = sent
        return r
    stay = {**state.review, "photo": (state.hotel["photos"] or [None])[0], "address": state.hotel["address"], "checkIn": state.hotel["checkIn"], "checkOut": state.hotel["checkOut"]}
    masked, why = await email.confirm(i.email, email.hotel_quote(stay), "Marisol at Palmetto Stays")
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "kind": "booking"}
    return ok(f"Quote emailed · {masked}", {"sent": True, "to": masked}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80, description="The caller's name as they gave it.")
    callbackNumber: str = Field(min_length=7, max_length=20, description="The number the caller confirmed for the call back.")
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two: e.g. two rooms for five adults in Miami Beach, December 11 to 31.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")


def take_message(state: HotelState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m["summary"] == i.summary.strip() and m["name"] == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup['id']}", {"messageId": dup["id"], "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append({"id": mid, "name": i.name.strip(), "callback": i.callbackNumber.strip(), "summary": i.summary.strip(), "preferredTime": (i.preferredTime or "").strip() or None, "at": ctx.now.isoformat()})
    return ok(f"Message for an agent · {mid}", {"messageId": mid, "callsBack": "An agent calls back within one business day."}, True)


def message_view(m: dict[str, Any]) -> dict[str, Any]:
    return {"id": m["id"], "name": m["name"], "summary": m["summary"], "preferredTime": m["preferredTime"], "callback": mask_number(m["callback"])}
