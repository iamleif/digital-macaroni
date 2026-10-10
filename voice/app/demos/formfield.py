"""
Form & Field: a fictional home-goods shop. The visitor describes what they want, hears about real
catalogue items and stock, and reserves one for pickup. Order lookup and support requests are the
secondary path. No payment, purchase or delivery happens.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .. import email
from .types import Confirmed, DemoDefinition, OpContext, OpResult, Operation, add_days, date_in, date_label, fail, mask_number, ok, reference

TIME_ZONE = "America/Chicago"
HOLD_DAYS = 2

# Everything Theo may tell a caller about the shop, in one place. His instructions carry only what he
# needs to run a call; get_shop_info returns this, and he answers from it.
SHOP: dict[str, Any] = {
    "name": "Form & Field",
    "what": "A small home-goods shop: lighting, tableware, textiles, small furniture and planters.",
    "address": "210 Market Street",
    "hours": "10 AM to 6 PM, Monday to Saturday. Closed Sunday.",
    "pickup": f"Reserved items are held for {HOLD_DAYS} days and paid for in store when collected.",
    "shipping": "We ship anywhere in the US: $9 flat, free on orders over $150, usually 3 to 5 business days.",
    "localDelivery": "Furniture and floor lamps can be delivered locally for $35, free on orders over $250, usually within a week.",
    "returns": "Returns within 30 days, unused and with the receipt, refunded to the original payment. Sale items are final sale.",
    "giftCards": "Gift cards in store and online, from $25. Gift wrapping is free in the shop.",
    "payment": "Card, cash, Apple Pay and Google Pay in store.",
}
Category = Literal["lighting", "tableware", "textiles", "furniture", "planters"]


def _v(vid: str, option: str, stock: int) -> dict[str, Any]:
    return {"id": vid, "option": option, "stock": stock}


CATALOGUE: list[dict[str, Any]] = [
    {"id": "ridge-lamp", "name": "Ridge Table Lamp", "category": "lighting", "price": 89, "description": "A ribbed ceramic table lamp with a soft linen drum shade. Warm, even light for a side table or desk.", "materials": "Glazed stoneware base, linen shade, fabric cord", "size": "18 inches tall, shade 12 inches across", "colors": ["green", "sage", "oat", "beige", "charcoal", "grey"], "variants": [_v("ridge-sage", "Sage green", 3), _v("ridge-oat", "Oat", 0), _v("ridge-charcoal", "Charcoal", 5)]},
    {"id": "moss-lamp", "name": "Moss Glass Lamp", "category": "lighting", "price": 129, "description": "A mouth-blown green glass table lamp. The base glows slightly when it is on.", "materials": "Hand-blown glass, brass fittings, cotton shade", "size": "16 inches tall", "colors": ["green", "moss"], "variants": [_v("moss-green", "Moss green", 1)]},
    {"id": "arc-floor-lamp", "name": "Arc Floor Lamp", "category": "lighting", "price": 189, "description": "A slim arching floor lamp that reaches over a sofa or reading chair.", "materials": "Powder-coated steel, marble base", "size": "68 inches tall, 40 inch reach", "colors": ["brass", "gold", "black"], "variants": [_v("arc-brass", "Brushed brass", 2), _v("arc-black", "Matte black", 4)]},
    {"id": "pleat-pendant", "name": "Pleat Paper Pendant", "category": "lighting", "price": 64, "description": "A pleated paper ceiling shade that softens a bright bulb. Fits a standard pendant fitting.", "materials": "Washi-style paper over a steel frame", "size": "20 inches across", "colors": ["white", "cream"], "variants": [_v("pleat-white", "White", 8)]},
    {"id": "everyday-mugs", "name": "Everyday Mugs, set of two", "category": "tableware", "price": 32, "description": "Generous stoneware mugs with a comfortable handle. Dishwasher and microwave safe.", "materials": "Stoneware with a satin glaze", "size": "12 fluid ounces each", "colors": ["sand", "beige", "sage", "green", "ink", "blue"], "variants": [_v("mugs-sand", "Sand", 12), _v("mugs-sage", "Sage", 0), _v("mugs-ink", "Ink blue", 7)]},
    {"id": "linen-throw", "name": "Washed Linen Throw", "category": "textiles", "price": 78, "description": "A heavy, soft washed-linen throw with fringed ends.", "materials": "100% European linen", "size": "50 by 60 inches", "colors": ["olive", "green", "natural", "beige", "rust", "orange"], "variants": [_v("throw-olive", "Olive", 4), _v("throw-natural", "Natural", 6), _v("throw-rust", "Rust", 0)]},
    {"id": "fold-side-table", "name": "Fold Side Table", "category": "furniture", "price": 145, "description": "A small solid-wood side table with a folded lip that stops things sliding off.", "materials": "Solid oak or walnut, oil finish", "size": "20 inches tall, 16 inch top", "colors": ["oak", "light wood", "walnut", "dark wood"], "variants": [_v("fold-oak", "Oak", 2), _v("fold-walnut", "Walnut", 0)]},
    {"id": "field-planter", "name": "Field Planter", "category": "planters", "price": 48, "description": "A stoneware planter with a drainage hole and matching saucer.", "materials": "Stoneware, unglazed inside", "size": "Small 6 inches, large 10 inches across", "colors": ["sage", "green", "clay", "terracotta"], "variants": [_v("planter-small-sage", "Small, sage", 5), _v("planter-large-sage", "Large, sage", 1), _v("planter-large-clay", "Large, clay", 3)]},
]

ORDERS = [
    {"number": "1042", "email": "emilia@example.com", "name": "Emilia Hayes", "items": [{"name": "Everyday Mugs, set of two", "option": "Sand", "price": 32}, {"name": "Washed Linen Throw", "option": "Olive", "price": 78}], "status": "Delayed in transit", "events": ["Order placed", "Packed", "Shipped", "Carrier delay reported"], "expected": 2},
    {"number": "1043", "email": "jon@example.com", "name": "Jon Park", "items": [{"name": "Ridge Table Lamp", "option": "Charcoal", "price": 89}], "status": "Delivered", "events": ["Order placed", "Packed", "Shipped", "Delivered"], "expected": -1},
]


@dataclass
class Reservation:
    id: str
    variant_id: str
    quantity: int
    name: str
    status: Literal["reserved", "cancelled"]
    pickup_by: str
    updated_at: str


@dataclass
class FormFieldState:
    seed: str
    today: str
    # Units held by reservations made in this session, by variant. Stock shown is stock minus held.
    held: dict[str, int] = field(default_factory=dict)
    shown: list[str] = field(default_factory=list)
    focus: Optional[str] = None
    reservations: list[Reservation] = field(default_factory=list)
    matched_order: Optional[str] = None
    support_requests: list[dict[str, str]] = field(default_factory=list)
    messages: list[dict[str, str]] = field(default_factory=list)
    seq: int = 0
    # The reservation email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None


def product(pid: str) -> Optional[dict[str, Any]]:
    return next((p for p in CATALOGUE if p["id"] == pid), None)


def variant_of(vid: str) -> Optional[tuple[dict[str, Any], dict[str, Any]]]:
    for p in CATALOGUE:
        for v in p["variants"]:
            if v["id"] == vid:
                return p, v
    return None


def available(state: FormFieldState, v: dict[str, Any]) -> int:
    return v["stock"] - state.held.get(v["id"], 0)


def price(n: int) -> str:
    return f"${n}"


def variant_view(state: FormFieldState, v: dict[str, Any]) -> dict[str, Any]:
    return {"variantId": v["id"], "option": v["option"], "inStock": available(state, v)}


def reservation_text(r: Reservation) -> str:
    p, v = variant_of(r.variant_id)  # type: ignore[misc]
    return f"{r.quantity} × {p['name']} in {v['option']}, held for {r.name} until closing on {date_label(r.pickup_by)}. Reference {r.id}."


def _words(s: str) -> list[str]:
    return [re.sub(r"s$", "", w) for w in re.split(r"[^a-z]+", s.lower()) if len(w) > 2]


def score(p: dict[str, Any], query: Optional[str], category: Optional[str], color: Optional[str], max_price: Optional[float]) -> int:
    if category and p["category"] != category:
        return 0
    if max_price is not None and p["price"] > max_price:
        return 0
    if color and not any(color.lower() in c or c in color.lower() for c in p["colors"]):
        return 0
    if not query:
        return 1
    vocabulary = set(_words(f"{p['name']} {p['category']} {p['description']} {' '.join(p['colors'])}"))
    return sum(1 for w in _words(query) if w in vocabulary)


def create_state(now: datetime) -> FormFieldState:
    today = date_in(TIME_ZONE, now)[0]
    return FormFieldState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)


def instruction(state: FormFieldState, ctx: OpContext) -> str:
    return f"""You are Theo. You work at Form & Field, a small home-goods shop selling lighting, tableware, textiles, small furniture and planters, and you answer its phone. Speak as part of the shop ("we", "our shop").

Behind the scenes, and not something to mention unless asked: this line is a demonstration. Reservations, orders and requests are sample records; nothing is charged, held, sold or shipped. If a caller asks directly whether you are a real person, answer honestly and briefly that you are Form & Field's AI assistant. If they ask directly whether this is a real shop or a real reservation, say briefly that this is a demo line and nothing will actually be held or charged, then carry on helping.

Today is {date_label(state.today)}.

What you know about the shop (address, hours, pickup, shipping, local delivery, returns, gift cards, payment) comes from get_shop_info. Call it before answering any question about the shop, and answer only from what it returns. Never invent a policy; if it isn't there, offer to take a message so the team can answer.

How you speak: calm, helpful and endearing. You are unhurried and warm, with a gentle, slightly playful charm: the shop assistant people remember because you made them feel looked after, never pushy or salesy. Show real delight when something suits them, and be kind and reassuring when something is out of stock or not quite right. Speak at an easy pace in short sentences, one question at a time. Describe products the way a good shop assistant would, using only catalogue facts. Never read out ids. Say prices naturally ("eighty-nine dollars"). Offer at most three items at once. If you are interrupted, stop and listen.

Opening: exactly "Thanks for calling Form & Field, this is Theo. How can I help?" Nothing more.

What you can do, always through your tools:
- Find products with search_products; its results include each item's description, materials, size and stock, so you can describe them straight away. Use get_product_details only to look at an item that was not in the results. Never invent products, prices, sizes, materials or stock.
- Stock: say whether the option they want is in stock, using the inStock numbers. If it is out of stock, say so and suggest available options or similar items from search results.
- Reserve for pickup: confirm the item, option, quantity and the name for the reservation, read them back and ask for a clear yes, then call reserve_item with callerConfirmed true. Tell them the result exactly as returned, including the reference and pickup deadline. Change the quantity or cancel with update_reservation or cancel_reservation after confirming.
- Orders: for "where is my order", ask for the order number and the email on the order, then lookup_order. Only discuss an order after it matches. For a damaged or wrong item on a matched order, use create_support_request; it goes to the team for review. Never promise a refund, replacement or delivery date the tool did not give. Sample details: order 1042 with emilia@example.com.
- Take a message with take_message if they want someone to call back. On a phone call, use get_caller_number and ask whether the number they are calling from (say only its last four digits) is the best one; otherwise ask for a number, and suggest the sample number 555-0142 if they would rather not give theirs.

Rules: never say something is reserved, changed or cancelled unless the tool returned ok true. For a callback, call take_message only after the caller has confirmed the number. If a tool fails, explain simply and offer what it suggests.
Email: once an item is reserved, offer once to email the reservation details. If they want it, ask for their email address and read it back carefully: spell the part before the @ letter by letter, then say the rest ("j, a, m, i, e, at gmail dot com"). Only when they clearly confirm it is right, call email_reservation with callerConfirmed true. Say it is on its way only if the tool returns ok. If they decline, that's fine.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short goodbye and then call end_call. Never call end_call in the same turn as a reservation, change or support request."""


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


# Product pictures for the email: studio photographs where they exist, drawings for the rest.
PHOTOS = {"ridge-lamp", "everyday-mugs", "field-planter", "linen-throw"}


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
    details = {"product": p["name"], "option": v["option"], "quantity": r.quantity, "price": price(p["price"] * r.quantity), "pickupBy": date_label(r.pickup_by), "shop": SHOP["address"], "hours": "10 AM – 6 PM, Monday to Saturday", "name": r.name, "reference": r.id, "image": image}
    masked, why = await email.confirm(i.email, email.pickup_reservation(details), "Theo at Form & Field")
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": r.id}
    return ok(f"Reservation emailed · {masked}", {"sent": True, "to": masked}, True)


def view(state: FormFieldState) -> dict[str, Any]:
    order = next((o for o in ORDERS if o["number"] == state.matched_order), None)

    def shown(pid: str) -> dict[str, Any]:
        p = product(pid)
        assert p is not None
        entry: dict[str, Any] = {"id": p["id"], "name": p["name"], "category": p["category"], "price": p["price"], "focus": state.focus == p["id"], "options": [{"id": v["id"], "option": v["option"], "inStock": available(state, v)} for v in p["variants"]]}
        if state.focus == p["id"]:
            entry.update({"description": p["description"], "materials": p["materials"], "size": p["size"]})
        return entry

    def reservation(r: Reservation) -> dict[str, Any]:
        p, v = variant_of(r.variant_id)  # type: ignore[misc]
        return {"id": r.id, "status": r.status, "product": p["name"], "option": v["option"], "quantity": r.quantity, "name": r.name, "pickupBy": date_label(r.pickup_by), "price": p["price"] * r.quantity}

    return {
        "shown": [shown(pid) for pid in state.shown],
        "reservations": [reservation(r) for r in state.reservations],
        "order": {"number": order["number"], "name": order["name"], "items": order["items"], "status": order["status"], "events": order["events"]} if order else None,
        "supportRequests": state.support_requests,
        "messages": [{"id": m["id"], "name": m["name"], "summary": m["summary"], "callback": mask_number(m["callbackNumber"])} for m in state.messages],
        "emailed": state.emailed,
    }


formfield: DemoDefinition[FormFieldState] = DemoDefinition(
    id="formfield",
    business_name="Form & Field",
    agent_name="Theo",
    create_state=create_state,
    instruction=instruction,
    view=view,
    operations={
        "get_shop_info": Operation("Checking the shop's policies", "Everything about the shop: address, hours, pickup, shipping, local delivery, returns, gift cards and payment. Use before answering any question about the shop.", get_shop_info),
        "search_products": Operation("Searching the catalogue", "Find catalogue items. Returns up to five matches with price and stock by option.", search_products, SearchProducts),
        "get_product_details": Operation("Checking product details", "Full catalogue facts for one product: description, materials, size and stock by option.", get_product_details, GetProductDetails),
        "reserve_item": Operation("Reserving for pickup", "Hold an in-stock option for pickup, after the caller said yes to the read-back.", reserve_item, ReserveItem),
        "update_reservation": Operation("Updating the reservation", "Change the quantity on a reservation made in this call, after the caller confirmed.", update_reservation, UpdateReservation),
        "cancel_reservation": Operation("Cancelling the reservation", "Cancel a reservation made in this call, after the caller confirmed. The stock is released.", cancel_reservation, CancelReservation),
        "lookup_order": Operation("Looking up the order", "Find an order by its number and the email address on it. Both must match.", lookup_order, LookupOrder),
        "create_support_request": Operation(
            "Opening a support request",
            "Send a damaged, wrong or missing item report on the matched order to the team for review. Nothing is refunded or replaced automatically.",
            create_support_request,
            CreateSupportRequest,
        ),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request for the shop team.", take_message, TakeMessage),
        "email_reservation": Operation("Emailing the reservation", "Email the pickup reservation to the caller, after they confirm the address read back to them. Once per call.", email_reservation, EmailReservation),
    },
)
