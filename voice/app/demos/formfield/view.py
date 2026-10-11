"""What the Form & Field dashboard shows. Never includes anything the visitor should not see."""

from __future__ import annotations

from typing import Any

from ..types import date_label, mask_number
from .state import FormFieldState, Reservation, available
from .store import ORDERS, product, variant_of


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
