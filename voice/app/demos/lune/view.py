"""What Lune's front desk shows: the day's book, the menu, the booking card and the deposit. Never includes anything the caller should not see."""

from __future__ import annotations

from typing import Any, Optional

from ..booking import BookingState, parse_slot
from ..types import date_label, mask_number
from .store import CAL, DEPOSIT, DEPOSIT_FROM, add_on


def request_rows(state: BookingState) -> list[dict[str, Any]]:
    r = state.request
    booked = CAL.active(state)
    a = booked[-1] if booked else None
    svc = CAL.service(a.service_id if a else r["serviceId"])["name"] if (a or r.get("serviceId")) else None
    if svc and (a and a.extras.get("addOn") or r.get("addOn")):
        svc += f" + {a.extras['addOn'] if a and a.extras.get('addOn') else add_on(r['addOn'])['name']}"
    who = CAL.short(a.staff_id) if a else (CAL.short(r["stylist"]) if r.get("stylist") else None)
    when, note = None, None
    sid = a.slot_id if a else r.get("proposedSlotId")
    if sid:
        d = CAL.describe(sid)
        when, note = f"{d['day']}, {d['time']}", ("Booked" if a else "Proposed")
        who = who or CAL.short(parse_slot(sid)[2])  # type: ignore[index]
    return [
        {"label": "Service", "value": svc},
        {"label": "Stylist", "value": who},
        {"label": "Name", "value": r.get("name")},
        {"label": "Mobile", "value": mask_number(r["phone"]) if r.get("phone") else None},
        {"label": "Time", "value": when, **({"note": note} if note else {})},
    ]


def extras(state: BookingState) -> Optional[dict[str, Any]]:
    r = state.request
    booked = CAL.active(state)
    a = booked[-1] if booked else None
    rows: list[dict[str, Any]] = []
    c = r.get("client")
    rows.append({"label": "Client", "value": f"Returning · {c['usual']}" if c else ("New client" if r.get("newClient") else "Not known yet"), **({"tone": "good"} if c else {})})
    sid = a.service_id if a else r.get("serviceId")
    if sid:
        s = CAL.service(sid)
        rows.append({"label": "Deposit", "value": f"{DEPOSIT} · secure link texted · off the bill" if s["price"] >= DEPOSIT_FROM else "Not needed", "tone": "good"})
    if a and a.extras.get("addOn"):
        rows.append({"label": "Add-on", "value": f"{a.extras['addOn']} · accepted", "tone": "good"})
    if r.get("notes"):
        rows.append({"label": "Note for the stylist", "value": r["notes"]})
    if a:
        rows.append({"label": "Cancellation", "value": "Free up to 24 hours before"})
    return {"title": "Client & deposit", "rows": rows} if r or a else None


def view(state: BookingState) -> dict[str, Any]:
    return CAL.view(state, skin="salon", time_zone_label="Pacific Time", request=request_rows(state), extras=extras(state), agent="Ellie")
