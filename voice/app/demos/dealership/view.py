"""What Woodward's desk shows: the lead, the lot as it's searched, the car on the call, the trade-in, test drives and service. Never includes anything the caller should not see."""

from __future__ import annotations

from typing import Any, Optional

from ... import email
from ..types import mask_number, reference
from . import store
from .state import DealershipState, active, describe_slot, miles, money
from .store import FINANCE, SERVICE_ADVISOR, car, describe_search, salesperson, service

PAY = {"cash": "Cash", "finance": "Finance", "lease": "Lease", "undecided": "Not sure yet"}
WHEN = {"this_week": "This week", "this_month": "This month", "few_months": "In a few months", "browsing": "Just looking"}
COND = {"excellent": "Excellent", "good": "Good", "fair": "Fair", "rough": "Rough"}
OWED = {"paid_off": "Paid off", "still_owe": "Still owes", "not_sure": "Not sure"}


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def sections(state: DealershipState) -> list[dict[str, Any]]:
    L = state.lead
    want = " ".join(x for x in (L.get("make"), L.get("model")) if x) or None
    out = [
        {"id": "contact", "title": "Contact", "fields": [
            f("name", "Full name", "text", L.get("name")),
            f("phone", "Phone", "text", mask_number(L["phone"]) if L.get("phone") else None),
            f("email", "Email", "text", email.mask(L["email"]) if L.get("email") and "@" in L["email"] else None),
            f("source", "Source", "select", "Phone · AI assistant" if state.opened else None, ["Phone · AI assistant", "Website", "Cars.com", "Walk-in"]),
        ]},
        {"id": "want", "title": "Looking for", "fields": [
            f("want", "Make & model", "text", want),
            f("body", "Body style", "chips", [L["body"]] if L.get("body") else None, list(store.BODIES)),
            f("budget", "Budget", "text", f"Up to {money(L['maxPrice'])}" if L.get("maxPrice") else None),
            f("payment", "Paying", "select", PAY.get(L.get("payment", "")), list(PAY.values())),
            f("timeline", "Timeline", "select", WHEN.get(L.get("timeline", "")), list(WHEN.values())),
        ]},
    ]
    if any(k.startswith("trade") for k in L):
        out.append({"id": "trade", "title": "Trade-in", "fields": [
            f("tradeCar", "Vehicle", "text", " ".join(str(x) for x in (L.get("tradeYear"), L.get("tradeMake"), L.get("tradeModel")) if x) or None),
            f("tradeMiles", "Miles", "text", f"{L['tradeMiles']:,}" if L.get("tradeMiles") is not None else None),
            f("tradeCondition", "Condition", "select", COND.get(L.get("tradeCondition", "")), list(COND.values())),
            f("tradeOwed", "Loan", "toggle", OWED.get(L.get("tradeOwed", "")), list(OWED.values())),
        ]})
    return out


def tile(c: dict[str, Any], state: DealershipState) -> dict[str, Any]:
    return {"stock": c["stock"], "vin": c["vin"], "name": describe_search(c), "price": money(c["price"]), "miles": miles(c["miles"]), "color": c["color"], "drivetrain": c["drivetrain"], "fuel": c["fuel"], "cpo": c["cpo"],
            "matched": c["stock"] in state.matches, "read": c["stock"] in state.read, "focus": c["stock"] == state.focus, "booked": any(a.stock == c["stock"] for a in active(state))}


def lot(state: DealershipState) -> dict[str, Any]:
    if state.search is None and not state.focus:
        seen: set[str] = set()
        spread = [c for c in sorted(store.CARS, key=lambda c: (-c["year"], c["miles"])) if not (c["body"] in seen or seen.add(c["body"]))]  # type: ignore[func-returns-value]
        return {"criteria": None, "total": len(store.CARS), "cars": [tile(c, state) for c in spread[:6]], "snapshot": store.SNAPSHOT}
    ids = list(dict.fromkeys(([state.focus] if state.focus else []) + state.read + state.matches))[:6]
    s = state.search or {}
    bits = [" ".join(str(s[k]) for k in ("make", "model") if s.get(k)), s.get("body"), f"under {money(s['maxPrice'])}" if s.get("maxPrice") else None, s.get("color"), s.get("drivetrain"), s.get("fuel")]
    return {"criteria": " · ".join(b for b in bits if b) or None, "total": len(state.matches), "cars": [tile(car(i), state) for i in ids if car(i)], "snapshot": store.SNAPSHOT}  # type: ignore[arg-type]


def focus(state: DealershipState) -> Optional[dict[str, Any]]:
    c = car(state.focus) if state.focus else None
    if not c:
        return None
    facts = [("Miles", f"{c['miles']:,}"), ("Colour", c["color"]), ("Interior", c["interior"]), ("Drivetrain", c["drivetrain"]), ("Engine", c["engine"]), ("Fuel", c["fuel"]), ("Seats", c["seats"]), ("Stock", c["stock"])]
    return {"stock": c["stock"], "vin": c["vin"], "name": describe_search(c), "price": money(c["price"]), "cpo": c["cpo"], "facts": [{"label": a, "value": str(b)} for a, b in facts if b], "warranty": "Certified pre-owned" if c["cpo"] else "90-day / 3,000-mile powertrain"}


def tasks(state: DealershipState) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in active(state):
        s = describe_slot(a.slot_id)
        if a.purpose == "test_drive":
            out.append({"title": f"Pull up the {a.vehicle}", "who": s.get("with", ""), "due": f"{s['day']}, {s['time']}"})
            out.append({"title": "Hold the car 24 hours", "who": "Lot manager", "due": "Now"})
        else:
            out.append({"title": f"Service · {service(a.service_id)['name']} · {a.vehicle}", "who": SERVICE_ADVISOR["name"], "due": f"{s['day']}, {s['time']}"})  # type: ignore[arg-type]
    if state.lead.get("tradeMake"):
        out.append({"title": "Appraise the trade-in at the visit", "who": "Used car manager", "due": "At the visit"})
    if state.lead.get("payment") in ("finance", "lease"):
        out.append({"title": "Pre-qualify for financing", "who": FINANCE["name"], "due": "Before the visit"})
    if state.opened and not active(state) and state.lead.get("name"):
        out.append({"title": "Follow-up call", "who": "Sales", "due": "Today"})
    return out


def note(state: DealershipState) -> Optional[str]:
    L = state.lead
    if not L.get("name"):
        return None
    parts = [f"{L['name']} called the dealership."]
    if state.focus and car(state.focus):
        c = car(state.focus)
        parts.append(f"Interested in the {describe_search(c)} ({money(c['price'])}, stock {c['stock']}).")  # type: ignore[index]
    if L.get("maxPrice"):
        parts.append(f"Budget up to {money(L['maxPrice'])}.")
    if L.get("payment"):
        parts.append(f"Paying: {PAY[L['payment']].lower()}.")
    if L.get("tradeMake"):
        parts.append(f"Trade-in: {L.get('tradeYear', '')} {L['tradeMake']} {L.get('tradeModel', '')}".strip() + (f", {L['tradeMiles']:,} miles" if L.get("tradeMiles") else "") + ".")
    for a in active(state):
        s = describe_slot(a.slot_id)
        parts.append(("Test drive" if a.purpose == "test_drive" else "Service") + f" booked {s['day']} at {s['time']}" + (f" with {s['with']}." if s.get("with") else "."))
    return " ".join(parts)


def view(state: DealershipState) -> dict[str, Any]:
    v = state.viewing
    open_times = [{"slotId": s, **{k: d.get(k, "") for k in ("day", "time", "with")}} for s in (v["slots"] if v else [])[:4] for d in [describe_slot(s)]] if v else []
    booked = active(state)
    return {
        "timeZone": "Eastern Time",
        "record": {"opened": state.opened, "number": reference("D", 500, state.seed) if state.opened else None, "title": state.lead.get("name"),
                   "stage": "booked" if booked else ("interested" if state.focus else ("new" if not state.opened else "searching")), "sections": sections(state)},
        "known": {"car": state.customer["car"], "lastService": state.customer["lastService"], "salesperson": salesperson(state.customer["salesperson"])["name"]} if state.customer else None,
        "lot": lot(state),
        "focus": focus(state),
        "calendar": {"purpose": v["purpose"], "openTimes": open_times} if v else None,
        "appointments": [{"id": a.id, "purpose": a.purpose, "status": a.status, "vehicle": a.vehicle, "stock": a.stock, "name": a.name, "changes": a.changes, "service": service(a.service_id)["name"] if a.service_id else None, **{k: describe_slot(a.slot_id).get(k, "") for k in ("day", "time", "with")}} for a in state.appointments],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "for": m.for_team} for m in state.messages],
        "note": note(state),
        "tasks": tasks(state),
        "emailed": state.emailed,
    }
