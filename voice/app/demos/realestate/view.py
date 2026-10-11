"""What the Juniper Row screen shows: the brokerage's side of the call. Never includes anything the caller should not see."""

from __future__ import annotations

from typing import Any, Optional

from ... import email
from ..types import mask_number, reference
from .state import RealEstateState, active, describe_slot, missing_fields, money, score, standout, tier, who_handles
from . import store
from .store import AREA_NAME, FINANCING_LABEL, INTENT_LABEL, SELLER_REASON_LABEL, SNAPSHOT, TIER_NOTE, TIMELINE_LABEL, TYPE_LABEL, agent, listing

YES_NO = ["Yes", "No"]


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def yn(v: Optional[bool]) -> Optional[str]:
    return None if v is None else "Yes" if v else "No"


def price_range(lead: dict[str, Any]) -> Optional[str]:
    lo, hi = lead.get("minPrice"), lead.get("maxPrice")
    if lo and hi:
        return f"{money(lo)} to {money(hi)}"
    if hi:
        return f"Up to {money(hi)}"
    if lo:
        return f"From {money(lo)}"
    return None


def record_sections(state: RealEstateState) -> list[dict[str, Any]]:
    lead = state.lead
    intent = lead.get("intent")
    selling = intent in ("sell", "both") or bool(lead.get("sellAddress"))
    buying = intent != "sell"
    out = [
        {"id": "contact", "title": "Contact", "fields": [
            f("name", "Full name", "text", lead.get("name")),
            f("phone", "Phone", "text", mask_number(lead["phone"]) if lead.get("phone") else None),
            f("email", "Email", "text", email.mask(lead["email"]) if lead.get("email") and "@" in lead["email"] else None),
            f("intent", "Lead type", "select", INTENT_LABEL.get(intent or ""), list(INTENT_LABEL.values())),
            f("source", "Source", "select", "Phone · AI assistant" if state.opened else None, ["Phone · AI assistant", "Zillow", "Website", "Open house", "Referral"]),
        ]},
    ]
    if buying:
        out.append({"id": "search", "title": "Looking for", "fields": [
            f("areas", "Areas", "chips", [AREA_NAME[a] for a in lead.get("areas", [])] or None, list(AREA_NAME.values()), True),
            f("price", "Price range", "text", price_range(lead)),
            f("beds", "Bedrooms", "text", f"{lead['beds']}+" if lead.get("beds") is not None else None),
            f("type", "Home type", "select", TYPE_LABEL.get(lead.get("propertyType", "")), list(TYPE_LABEL.values())),
        ]})
    if selling:
        out.append({"id": "selling", "title": "Selling", "fields": [
            f("sellAddress", "Property address", "text", lead.get("sellAddress"), None, True),
            f("reason", "Reason", "select", SELLER_REASON_LABEL.get(lead.get("sellerReason", "")), list(SELLER_REASON_LABEL.values())),
        ]})
    out.append({"id": "ready", "title": "Readiness", "fields": [
        f("timeline", "Timeline", "select", TIMELINE_LABEL.get(lead.get("timeline", "")), list(TIMELINE_LABEL.values())),
        *([f("financing", "Financing", "select", FINANCING_LABEL.get(lead.get("financing", "")), list(FINANCING_LABEL.values())), f("lender", "Lender", "text", lead.get("lender"))] if buying else []),
        *([f("first", "First home", "toggle", yn(lead.get("firstTimeBuyer")), YES_NO)] if buying else []),
        f("agent", "Has an agent", "toggle", yn(lead.get("hasAgent")), YES_NO),
    ]})
    return out


def stage_of(state: RealEstateState) -> str:
    booked = active(state)
    if booked:
        return "booked"
    if not missing_fields(state):
        return "qualified"
    if state.opened:
        return "contacted"
    return "new"


def tile(x: dict[str, Any], state: RealEstateState) -> dict[str, Any]:
    return {
        "id": x["id"], "address": x["address"], "area": AREA_NAME[x["area"]], "type": TYPE_LABEL.get(x["type"], x["type"]),
        "price": money(x["price"]), "beds": x["beds"], "baths": x["baths"], "sqft": x["sqft"], "daysOnMarket": x.get("daysOnMarket"),
        "standout": standout(x), "matched": x["id"] in state.matches, "read": x["id"] in state.read, "focus": x["id"] == state.focus,
        "booked": any(a.listing_id == x["id"] for a in active(state)),
    }


def listings_panel(state: RealEstateState) -> dict[str, Any]:
    if state.search is None and not state.focus:
        # Before a search: a spread of what is on the market, one from each area.
        seen: set[str] = set()
        spread = [x for x in store.LISTINGS if not (x["area"] in seen or seen.add(x["area"]))]  # type: ignore[func-returns-value]
        return {"criteria": None, "total": len(store.LISTINGS), "homes": [tile(x, state) for x in spread[:6]], "snapshot": SNAPSHOT}
    ids = list(dict.fromkeys(([state.focus] if state.focus else []) + state.read + state.matches))[:6]
    s = state.search or {}
    bits = [s.get("area")] if s.get("area") else []
    if s.get("maxPrice") or s.get("minPrice"):
        bits.append(price_range({"minPrice": s.get("minPrice"), "maxPrice": s.get("maxPrice")}) or "")
    if s.get("minBeds"):
        bits.append(f"{s['minBeds']}+ beds")
    if s.get("type"):
        bits.append(TYPE_LABEL[s["type"]])
    return {"criteria": " · ".join(b for b in bits if b) or None, "total": len(state.matches), "homes": [tile(listing(i), state) for i in ids if listing(i)], "snapshot": SNAPSHOT}  # type: ignore[arg-type]


def focus_card(state: RealEstateState) -> Optional[dict[str, Any]]:
    x = listing(state.focus) if state.focus else None
    if not x:
        return None
    facts = [("Type", TYPE_LABEL.get(x["type"], x["type"])), ("Beds", str(x["beds"])), ("Baths", str(x["baths"])), ("Square feet", f"{x['sqft']:,}")]
    if x.get("yearBuilt"):
        facts.append(("Built", str(x["yearBuilt"])))
    if x.get("lotSqft"):
        facts.append(("Lot", f"{x['lotSqft']:,} sq ft"))
    if x.get("hoaFee"):
        facts.append(("HOA", f"{money(int(x['hoaFee']))}/mo"))
    if x.get("daysOnMarket") is not None:
        facts.append(("On market", f"{x['daysOnMarket']} days"))
    return {"id": x["id"], "address": x["address"], "area": AREA_NAME[x["area"]], "zip": x["zip"], "price": money(x["price"]), "facts": [{"label": a, "value": b} for a, b in facts], "agent": agent(who_handles(state, "showing", x["id"]))["name"]}


def lead_card(state: RealEstateState) -> dict[str, Any]:
    t = tier(state)
    lead = state.lead
    why: list[str] = []
    if lead.get("timeline"):
        why.append(TIMELINE_LABEL[lead["timeline"]])
    if lead.get("financing"):
        why.append(FINANCING_LABEL[lead["financing"]] + (f" · {lead['lender']}" if lead.get("lender") else ""))
    if lead.get("firstTimeBuyer"):
        why.append("First-time buyer")
    for a in active(state):
        why.append("Showing booked" if a.purpose == "showing" else "Valuation booked")
    flags = ["Works with another agent"] if lead.get("hasAgent") else []
    aid = who_handles(state)
    return {
        "tier": t, "tierNote": TIER_NOTE.get(t or ""), "score": score(state) if t else None, "points": why, "flags": flags,
        "agent": {"name": agent(aid)["name"], "role": agent(aid)["role"]} if state.opened else None,
        "known": {"spokeWith": agent(state.contact["agent"])["name"], "note": state.contact["lastContact"]} if state.contact else None,
    }


def tasks(state: RealEstateState) -> list[dict[str, Any]]:
    """What the CRM would queue for the team after the call: derived from the records, never invented."""
    out: list[dict[str, Any]] = []
    t = tier(state)
    aid = who_handles(state)
    for a in active(state):
        s = describe_slot(a.slot_id, a.agent_id)
        out.append({"title": f"{'Showing' if a.purpose == 'showing' else 'Valuation'} · {a.address}", "who": s["agent"], "due": f"{s['day']}, {s['time']}"})
        if a.purpose == "valuation":
            out.append({"title": "Prepare the market analysis", "who": s["agent"], "due": "Before the visit"})
    if t:
        out.append({"title": "Call the lead back" if t == "A" else "Follow-up call", "who": agent(aid)["name"], "due": "Today" if t == "A" else "This week" if t == "B" else "Next month"})
    if state.lead.get("financing") in ("not_yet", "talking_to_lender"):
        out.append({"title": "Introduce a preferred lender", "who": agent(aid)["name"], "due": "This week"})
    if state.search and state.lead.get("intent") != "sell":
        out.append({"title": "Set up a saved search with new-listing alerts", "who": "Juniper Row CRM", "due": "Now"})
    return out


def call_note(state: RealEstateState) -> Optional[str]:
    lead = state.lead
    if not state.opened or not lead.get("name"):
        return None
    parts = [f"{lead['name']} called the brokerage line" + (f", {INTENT_LABEL[lead['intent']].lower()}" if lead.get("intent") else "") + "."]
    if lead.get("areas"):
        parts.append("Areas: " + ", ".join(AREA_NAME[a] for a in lead["areas"]) + ".")
    if price_range(lead):
        parts.append(f"Budget: {price_range(lead)}.")
    if lead.get("beds"):
        parts.append(f"{lead['beds']}+ bedrooms.")
    if lead.get("timeline"):
        parts.append(f"Timeline: {TIMELINE_LABEL[lead['timeline']].lower()}.")
    if lead.get("financing"):
        parts.append(f"{FINANCING_LABEL[lead['financing']]}" + (f" with {lead['lender']}." if lead.get("lender") else "."))
    if state.focus and listing(state.focus):
        x = listing(state.focus)
        parts.append(f"Asked about {x['address']} ({money(x['price'])}).")  # type: ignore[index]
    if state.estimate and state.estimate.get("status") == "ok":
        parts.append(f"Automated estimate for {lead.get('sellAddress', 'their home')}: {money(state.estimate['low'])} to {money(state.estimate['high'])}.")
    for a in active(state):
        s = describe_slot(a.slot_id, a.agent_id)
        parts.append(f"{'Showing' if a.purpose == 'showing' else 'Valuation'} booked with {s['agent']}, {s['day']} at {s['time']}.")
    if lead.get("hasAgent"):
        parts.append("Already works with another agent.")
    return " ".join(parts)


def view(state: RealEstateState) -> dict[str, Any]:
    v = state.viewing
    open_times = [{"slotId": s, **{k: d[k] for k in ("day", "time", "agent")}} for s in (v["slots"] if v else [])[:4] for d in [describe_slot(s, v["agent"])]] if v else []
    return {
        "timeZone": "Central Time",
        "record": {
            "opened": state.opened,
            "number": reference("L", 400, state.seed) if state.opened else None,
            "title": state.lead.get("name"),
            "stage": stage_of(state),
            "sections": record_sections(state),
        },
        "lead": lead_card(state),
        "listings": listings_panel(state),
        "focus": focus_card(state),
        "estimate": state.estimate and ({"status": "ok", "address": state.estimate["address"], "low": money(state.estimate["low"]), "high": money(state.estimate["high"]), "comparables": state.estimate["comparables"]} if state.estimate["status"] == "ok" else {"status": "unavailable", "address": state.estimate["address"]}),
        "calendar": {"purpose": v["purpose"], "agent": agent(v["agent"])["name"], "openTimes": open_times} if v else None,
        "appointments": [{"id": a.id, "purpose": a.purpose, "status": a.status, "address": a.address, "name": a.name, "changes": a.changes, **{k: describe_slot(a.slot_id, a.agent_id)[k] for k in ("day", "time", "agent")}} for a in state.appointments],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "for": agent(m.for_agent)["name"] if m.for_agent else None} for m in state.messages],
        "note": call_note(state),
        "tasks": tasks(state),
        "emailed": state.emailed,
    }
