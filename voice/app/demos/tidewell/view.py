"""What Tidewell's reception shows: the day's visits, visit types, the patient booking, intake and coverage. Never includes anything the caller should not see."""

from __future__ import annotations

from typing import Any, Optional

from ..booking import BookingState, parse_slot
from ..types import mask_number
from .store import CAL

CAUSE = {"lifting": "lifting", "sport": "sport", "car_accident": "a car accident", "work_injury": "a work injury", "fall": "a fall", "gradual": "came on gradually", "not_sure": "not sure how"}
COVER = {"insurance": "Insurance", "self_pay": "Self-pay", "auto_accident": "Auto accident claim (PIP)", "workers_comp": "Workers' comp"}


def request_rows(state: BookingState) -> list[dict[str, Any]]:
    r = state.request
    booked = CAL.active(state)
    a = booked[-1] if booked else None
    reason = r.get("reason")
    if reason and (r.get("howLong") or r.get("cause")):
        reason += ", " + ", ".join(x for x in (r.get("howLong"), CAUSE.get(r.get("cause", ""))) if x)
    sid = a.slot_id if a else r.get("proposedSlotId")
    when = note = who = None
    if sid:
        d = CAL.describe(sid)
        when, note, who = f"{d['day']}, {d['time']}", ("Booked" if a else "Proposed"), CAL.short(parse_slot(sid)[2])  # type: ignore[index]
    elif r.get("practitioner"):
        who = CAL.short(r["practitioner"])
    svc = CAL.service(a.service_id if a else r["serviceId"])["name"] if (a or r.get("serviceId")) else None
    return [
        {"label": "Patient", "value": r.get("name")},
        {"label": "Visit", "value": svc},
        {"label": "Reason", "value": reason},
        {"label": "Practitioner", "value": who},
        {"label": "Time", "value": when, **({"note": note} if note else {})},
    ]


def extras(state: BookingState) -> Optional[dict[str, Any]]:
    r = state.request
    if not r:
        return None
    rows: list[dict[str, Any]] = []
    p = r.get("patient")
    if p:
        rows.append({"label": "Patient type", "value": f"Returning · {p['last']}", "tone": "good"})
    elif r.get("newPatient"):
        booked = any(a.extras.get("intake") for a in CAL.active(state))
        rows.append({"label": "Patient type", "value": "New · intake forms emailed" if booked else "New · assessment first", "tone": "good"})
    if r.get("coverage"):
        plan = r.get("directBill")
        cover = COVER[r["coverage"]] + (f" · {plan} · direct billing, benefits checked before the visit" if plan else (f" · {r['insurer']} · pays at the visit, receipt to submit" if r.get("insurer") else ""))
        rows.append({"label": "Coverage", "value": cover, **({"tone": "good"} if plan or r["coverage"] != "insurance" else {"tone": "warn"})})
    flags = r.get("redFlags") or []
    if r.get("emergency"):
        rows.append({"label": "Red flags", "value": "Emergency signs · told to call 911 / ER, not booked", "tone": "warn"})
    elif "numbness_tingling" in flags:
        rows.append({"label": "Red flags", "value": "Numbness or tingling · noted for the practitioner", "tone": "warn"})
    elif r.get("reason"):
        rows.append({"label": "Red flags", "value": "None mentioned", "tone": "good"})
    return {"title": "Intake & coverage", "rows": rows} if rows else None


def view(state: BookingState) -> dict[str, Any]:
    v = CAL.view(state, skin="clinic", time_zone_label="Pacific Time", request=request_rows(state), extras=extras(state), agent="Ellie")
    # Reception's board shows the visit type, never why someone is coming in.
    return v
