"""Theo's operations at Form & Field: plain functions over one call's state, tested without a model."""

from __future__ import annotations

import re
from typing import Any, Optional

from pydantic import BaseModel, Field

from ... import email
from ..types import Confirmed, OpContext, OpResult, add_days, date_label, fail, ok, reference
from .state import Category, FormFieldState, Reservation, available, price, reservation_text, score, variant_view
from .store import CATALOGUE, EMAIL_HOURS, HOLD_DAYS, ORDERS, PHOTOS, SHOP, product, variant_of


class SearchProducts(BaseModel):
    query: Optional[str] = Field(None, max_length=120, description="What they are looking for, in their words, e.g. 'table lamp'.")
    category: Optional[Category] = None
    color: Optional[str] = Field(None, max_length=30, description="A colour they asked for.")
    maxPrice: Optional[float] = Field(None, ge=1, description="Their budget in US dollars.")


def search_products(state: FormFieldState, i: SearchProducts, ctx: OpContext) -> OpResult:
    scored = [(p, score(p, i.query, i.category, i.color, i.maxPrice)) for p in CATALOGUE]
    best = max([0] + [s for _, s in scored])
    # Keep the strong matches: "table lamp" should not also bring back a table.
    matches = [p for p, s in sorted((m for m in scored if m[1] > 0 and m[1] >= best * 0.6), key=lambda m: (-m[1], m[0]["price"]))][:5]
    state.shown = [p["id"] for p in matches]
    state.focus = None
    if not matches:
        return ok("No matching items", {"matches": [], "note": "Nothing in the catalogue matches. Suggest a broader search or a different colour or budget."}, True)
    return ok(
        f"{len(matches)} item{'s' if len(matches) > 1 else ''} found",
        # The main facts come with the results, so describing an item needs no second lookup.
        {"matches": [{"productId": p["id"], "name": p["name"], "price": price(p["price"]), "description": p["description"], "materials": p["materials"], "size": p["size"], "options": [variant_view(state, v) for v in p["variants"]]} for p in matches]},
        True,
    )


class GetProductDetails(BaseModel):
    productId: str


def get_product_details(state: FormFieldState, i: GetProductDetails, ctx: OpContext) -> OpResult:
    p = product(i.productId)
    if not p:
        return fail("not_found", "That product is not in the catalogue.")
    state.focus = p["id"]
    if p["id"] not in state.shown:
        state.shown = ([p["id"]] + state.shown)[:5]
    return ok(p["name"], {"productId": p["id"], "name": p["name"], "price": price(p["price"]), "description": p["description"], "materials": p["materials"], "size": p["size"], "options": [variant_view(state, v) for v in p["variants"]]}, True)


class ReserveItem(BaseModel):
    variantId: str
    quantity: int = Field(ge=1, le=5)
    name: str = Field(min_length=1, max_length=80)
    callerConfirmed: bool = Confirmed()


def reserve_item(state: FormFieldState, i: ReserveItem, ctx: OpContext) -> OpResult:
    pv = variant_of(i.variantId)
    if not pv:
        return fail("not_found", "That option is not in the catalogue.")
    p, v = pv
    same = next((r for r in state.reservations if r.status == "reserved" and r.variant_id == i.variantId), None)
    if same:
        return ok(f"Already reserved · {same.id}", {"reservationId": same.id, "duplicate": True, "confirmation": reservation_text(same), "note": "Use update_reservation to change the quantity."})
    free = available(state, v)
    if free < i.quantity:
        others = [variant_view(state, x) for x in p["variants"] if x["id"] != v["id"] and available(state, x) > 0]
        return fail("insufficient_stock", f"Only {free} in stock." if free > 0 else "That option is out of stock.", {"inStock": free, "otherOptions": others})
    state.held[v["id"]] = state.held.get(v["id"], 0) + i.quantity
    rid = reference("FF", state.seq, state.seed)
    state.seq += 1
    r = Reservation(id=rid, variant_id=v["id"], quantity=i.quantity, name=i.name.strip(), status="reserved", pickup_by=add_days(state.today, HOLD_DAYS), updated_at=ctx.now.isoformat())
    state.reservations.append(r)
    state.focus = p["id"]
    return ok(f"Reserved · {rid}", {"reservationId": rid, "confirmation": reservation_text(r), "payment": "Paid in store at pickup."}, True)


class UpdateReservation(BaseModel):
    reservationId: str
    quantity: int = Field(ge=1, le=5)
    callerConfirmed: bool = Confirmed()


def update_reservation(state: FormFieldState, i: UpdateReservation, ctx: OpContext) -> OpResult:
    r = next((x for x in state.reservations if x.id == i.reservationId and x.status == "reserved"), None)
    if not r:
        return fail("not_found", "There is no active reservation with that reference in this call.")
    if r.quantity == i.quantity:
        return ok(f"No change · {r.id}", {"reservationId": r.id, "unchanged": True, "confirmation": reservation_text(r)})
    v = variant_of(r.variant_id)[1]  # type: ignore[index]
    free = available(state, v) + r.quantity
    if i.quantity > free:
        return fail("insufficient_stock", f"Only {free} can be held in total.", {"maxQuantity": free})
    state.held[v["id"]] = state.held.get(v["id"], 0) - r.quantity + i.quantity
    r.quantity, r.updated_at = i.quantity, ctx.now.isoformat()
    return ok(f"Reservation updated · {r.id}", {"reservationId": r.id, "confirmation": reservation_text(r)}, True)


class CancelReservation(BaseModel):
    reservationId: str
    callerConfirmed: bool = Confirmed()


def cancel_reservation(state: FormFieldState, i: CancelReservation, ctx: OpContext) -> OpResult:
    r = next((x for x in state.reservations if x.id == i.reservationId), None)
    if not r:
        return fail("not_found", "There is no reservation with that reference in this call.")
    if r.status == "cancelled":
        return ok(f"Already cancelled · {r.id}", {"reservationId": r.id, "unchanged": True})
    state.held[r.variant_id] = state.held.get(r.variant_id, 0) - r.quantity
    r.status, r.updated_at = "cancelled", ctx.now.isoformat()
    return ok(f"Reservation cancelled · {r.id}", {"reservationId": r.id, "cancelled": True}, True)


class LookupOrder(BaseModel):
    orderNumber: str = Field(max_length=20)
    email: str = Field(max_length=120)


def lookup_order(state: FormFieldState, i: LookupOrder, ctx: OpContext) -> OpResult:
    number = re.sub(r"\D", "", i.orderNumber)
    email = re.sub(r"\s", "", re.sub(r"\s+dot\s+", ".", re.sub(r"\s+at\s+", "@", i.email.strip().lower(), count=1)))
    order = next((o for o in ORDERS if o["number"] == number and o["email"] == email), None)
    if not order:
        state.matched_order = None
        return fail("no_match", "No order matches that number and email together. Ask them to check both.")
    state.matched_order = order["number"]
    result: dict[str, Any] = {"orderNumber": order["number"], "customer": order["name"].split(" ")[0], "items": [f"{x['name']}, {x['option']}" for x in order["items"]], "status": order["status"]}
    if order["expected"] >= 0:
        result["carrierEstimate"] = date_label(add_days(state.today, order["expected"]))
    return ok(f"Order {order['number']} matched", result, True)


class CreateSupportRequest(BaseModel):
    issue: str = Field(min_length=3, max_length=300)


def create_support_request(state: FormFieldState, i: CreateSupportRequest, ctx: OpContext) -> OpResult:
    if not state.matched_order:
        return fail("order_not_matched", "Match the order with lookup_order first.")
    dup = next((s for s in state.support_requests if s["orderNumber"] == state.matched_order), None)
    if dup:
        return ok(f"Request already open · {dup['id']}", {"requestId": dup["id"], "duplicate": True, "status": "pending review"})
    rid = reference("CS", state.seq, state.seed)
    state.seq += 1
    state.support_requests.append({"id": rid, "orderNumber": state.matched_order, "issue": i.issue.strip(), "status": "pending_review"})
    return ok(f"Support request · {rid}", {"requestId": rid, "status": "pending review", "next": "The team reviews it and replies by email within one business day."}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300)


def take_message(state: FormFieldState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m["summary"] == i.summary.strip()), None)
    if dup:
        return ok(f"Message already left · {dup['id']}", {"messageId": dup["id"], "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append({"id": mid, "name": i.name.strip(), "callbackNumber": i.callbackNumber.strip(), "summary": i.summary.strip()})
    return ok(f"Message for the team · {mid}", {"messageId": mid}, True)


def get_shop_info(state: FormFieldState, _: Any, ctx: OpContext) -> OpResult:
    return ok("Shop hours and policies", {**SHOP, "today": state.today})


class EmailReservation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    callerConfirmed: bool = Confirmed()


async def email_reservation(state: FormFieldState, i: EmailReservation, ctx: OpContext) -> OpResult:
    """Emails the pickup reservation to the caller, with the item's picture: once per call."""
    held = [r for r in state.reservations if r.status == "reserved"]
    if not held:
        return fail("nothing_reserved", "There is no reservation to send yet.")
    if state.emailed:
        return fail("already_sent", f"The reservation was already emailed to {state.emailed['to']} on this call.")
    r = held[-1]
    p, v = variant_of(r.variant_id)  # type: ignore[misc]
    image = email.asset(f"products/{p['id']}.{'jpg' if p['id'] in PHOTOS else 'png'}")
    details = {"product": p["name"], "option": v["option"], "quantity": r.quantity, "price": price(p["price"] * r.quantity), "pickupBy": date_label(r.pickup_by), "shop": SHOP["address"], "hours": EMAIL_HOURS, "name": r.name, "reference": r.id, "image": image}
    masked, why = await email.confirm(i.email, email.pickup_reservation(details), "Theo at Form & Field")
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": r.id}
    return ok(f"Reservation emailed · {masked}", {"sent": True, "to": masked}, True)
