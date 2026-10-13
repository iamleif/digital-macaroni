"""What Aspen Grove's front office shows: the appointment book by operatory, the patient chart, insurance, triage and the short-notice list. Never includes anything the caller should not see."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from ... import email
from ..types import date_in, date_label, mask_number, reference
from .self_pay import self_pay_card, plan_members
from .state import HOLD_MIN, HOLDS, LUNCH, DentalState, active, bookable_days, clock, free, has_lunch, hours_of, parse_slot
from .store import OPS, TIME_ZONE, TYPES, op, provider, visit_type

SYMPTOM = {"pain": "Pain", "swelling": "Swelling", "broken_tooth": "Broken tooth", "lost_filling": "Lost filling", "bleeding_gums": "Bleeding gums", "sensitivity": "Sensitivity", "knocked_out_tooth": "Knocked-out tooth", "jaw_pain": "Jaw pain"}
REL = {"self": "Self", "spouse": "Spouse", "child": "Child", "other": "Other"}


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def short_date(iso: Optional[str]) -> Optional[str]:
    if not iso:
        return None
    d = date.fromisoformat(iso)
    return f"{d.strftime('%b')} {d.day}, {d.year}"


def sections(state: DentalState) -> list[dict[str, Any]]:
    p = state.patient
    ins = state.insurance or {}
    status = None if p.get("newPatient") is None and not state.found else ("Existing" if state.found or p.get("newPatient") is False else "New")
    return [
        {"id": "patient", "title": "Patient", "fields": [
            f("name", "Name", "text", p.get("name")),
            f("dob", "Birthdate", "date", short_date(p.get("dateOfBirth"))),
            f("phone", "Phone", "text", mask_number(p["phone"]) if p.get("phone") else (f"•••• {state.found['phoneLast4']}" if state.found else None)),
            f("email", "Email", "text", email.mask(p["email"]) if p.get("email") and "@" in p["email"] else None),
            f("status", "Patient", "toggle", status, ["New", "Existing"]),
            f("referral", "Referred by", "text", p.get("referral")),
        ]},
        {"id": "visit", "title": "Reason for visit", "fields": [
            f("reason", "Visit", "select", visit_type(p["reason"])["name"] if p.get("reason") else None, [t["name"] for t in TYPES]),
            f("symptoms", "Symptoms", "chips", [SYMPTOM[x] for x in p.get("symptoms", [])] or None, list(SYMPTOM.values()), True),
            f("pain", "Pain", "text", f"{p['painLevel']}/10" if p.get("painLevel") is not None else None),
            f("howLong", "How long", "text", p.get("howLong")),
            f("lastVisit", "Last dental visit", "text", p.get("lastVisit") or (short_date(state.found["lastVisit"]) if state.found else None)),
            f("alert", "Medical alert", "text", p.get("medicalAlert"), None),
        ]},
        {"id": "insurance", "title": "Insurance", "fields": [
            f("carrier", "Carrier", "text", ins.get("carrier") or ("None · self-pay" if p.get("hasInsurance") is False else None)),
            f("network", "Network", "toggle", None if not ins else ("In network" if ins.get("inNetwork") else "Out of network"), ["In network", "Out of network"]),
            f("subscriber", "Subscriber", "text", p.get("subscriber") or (p.get("name") if p.get("relationship") == "self" else None)),
            f("relationship", "Relationship", "select", REL.get(p.get("relationship", "")), list(REL.values())),
            f("memberId", "Member ID", "text", p.get("memberId")),
            f("group", "Group / employer", "text", p.get("groupNumber")),
        ]},
    ]


def stage_of(state: DentalState) -> str:
    if active(state):
        return "booked"
    if state.insurance or state.triage or state.self_pay.get("offered"):
        return "checked"
    if state.opened:
        return "chart"
    return "new"


def board(state: DentalState) -> dict[str, Any]:
    days = bookable_days(state)
    live = active(state)
    focus = (state.viewing or {}).get("date") or (live[-1].date if live else days[0] if days[0] != state.today else (days[1] if len(days) > 1 else days[0]))
    day = focus if focus in days else days[0]
    hrs = hours_of(day) or (8 * 60, 17 * 60)
    appts = [a for a in state.book if a.date == day and a.status == "booked"]
    v = state.viewing
    open_ = []
    if v and v["date"] == day:
        mins = visit_type(v["type"])["minutes"]
        for sid in v["slots"]:
            _, start, oid = parse_slot(sid)  # type: ignore[misc]
            open_.append({"op": oid, "start": start, "minutes": mins})
    holds = [{"op": o, "start": h, "minutes": HOLD_MIN} for o, h in HOLDS if h + HOLD_MIN <= hrs[1] and free(state, o, day, h, HOLD_MIN)]
    # The red "now" line, as a practice's book draws it, on today's page only.
    _, hh, mm = date_in(TIME_ZONE, datetime.now(timezone.utc))
    return {
        "date": day,
        "label": date_label(day),
        "open": hrs[0],
        "close": hrs[1],
        "lunch": list(LUNCH) if has_lunch(day) else None,
        "now": hh * 60 + mm if day == state.today and hrs[0] <= hh * 60 + mm <= hrs[1] else None,
        "ops": [{"id": o["id"], "name": o["name"], "provider": provider(o["provider"])["short"], "code": provider(o["provider"])["code"], "tone": provider(o["provider"])["tone"], "role": provider(o["provider"])["role"]} for o in OPS],
        "appts": [{
            "id": a.id, "op": a.op, "start": a.start, "minutes": a.minutes, "patient": a.patient, "procedures": a.procedures,
            "code": provider(op(a.op)["provider"])["code"], "tone": provider(op(a.op)["provider"])["tone"],
            "kind": "existing" if a.existing else "demo", "confirmed": a.confirmed, "alert": a.alert, "exam": a.exam, **({"off": True} if a.off else {}),
            "phone": f"•••• {a.phone4}" if a.phone4 else None, "time": clock(a.start),
        } for a in appts],
        "openSlots": open_,
        "holds": holds,
    }


def tasks(state: DentalState) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    live = active(state)
    if any(a.type_id in ("new_patient", "child_cleaning") for a in live):
        n = sum(1 for a in live if a.type_id in ("new_patient", "child_cleaning"))
        out.append({"title": "Send new-patient forms" + (f" · {n} patients" if n > 1 else ""), "who": "Josh", "due": "Now"})
    members = plan_members(state)
    if state.self_pay.get("plan") == "text":
        out.append({"title": "Text savings-plan sign-up link", "who": "Practice system", "due": "Now"})
        out.append({"title": f"Enroll {len(members)} in the savings plan · first visit included", "who": "Front office", "due": "At check-in"})
        out.append({"title": "Take-home whitening once the dentist okays it", "who": "Dr. Patel", "due": "After the first exam"})
    if state.patient.get("familyDue"):
        out.append({"title": "Include household forms and plan sign-up", "who": "Josh", "due": "With the intake forms"})
    for a in live:
        t = visit_type(a.type_id)  # type: ignore[arg-type]
        if state.insurance and not state.insurance.get("medicaid"):
            out.append({"title": f"Verify {state.insurance['carrier']} benefits", "who": "Front office", "due": "Before the visit"})
        out.append({"title": f"Reminder text · {t['name']}", "who": "Practice system", "due": "2 days before"})
    if state.patient.get("medicalAlert"):
        out.append({"title": "Medical alert on the chart for the dentist", "who": "Front office", "due": "Before the visit"})
    for x in state.asap:
        out.append({"title": f"Short-notice list · {x['type']} · {x['preferred']}", "who": "Front office", "due": "When a time opens"})
    return out


def note(state: DentalState) -> Optional[str]:
    p = state.patient
    if not p.get("name"):
        return None
    parts = [f"{p['name']} called" + (" (current patient)." if state.found else " (new patient)." if p.get("newPatient") else ".")]
    if p.get("reason"):
        parts.append(f"Wants: {visit_type(p['reason'])['name'].lower()}.")
    if state.triage:
        o = state.triage.get("outcome")
        parts.append("Triage: told to go to the emergency room." if o == "er" else "Triage: same-day emergency visit." if o == "same_day" else "Triage: knocked-out tooth, seen within the hour." if o == "now" else "")
    if state.insurance:
        parts.append(f"Insurance: {state.insurance['carrier']} ({'in' if state.insurance.get('inNetwork') else 'out of'} network).")
    elif p.get("hasInsurance") is False:
        plan = state.self_pay.get("plan")
        parts.append("No insurance: " + ("wants the savings plan; sign-up link to text." if plan == "text" else "gave the self-pay options; not joining the plan for now." if plan == "declined" else "self-pay options given." if state.self_pay.get("offered") else "self-pay."))
    if p.get("familyDue"):
        parts.append("Others at home are due too: their forms go with the caller's.")
    for a in active(state):
        who = "" if a.patient == p.get("name") else f" for {a.patient}"
        parts.append(f"Booked {visit_type(a.type_id)['name'].lower()}{who} {date_label(a.date)} at {clock(a.start)} with {provider(op(a.op)['provider'])['name']}.")  # type: ignore[arg-type]
    return " ".join(x for x in parts if x)


def view(state: DentalState) -> dict[str, Any]:
    live = active(state)
    return {
        "timeZone": "Central Time",
        "record": {"opened": state.opened, "number": (state.found or {}).get("id") or (reference("P", 600, state.seed) if state.opened else None), "title": state.patient.get("name"), "stage": stage_of(state), "sections": sections(state)},
        "board": board(state),
        "insurance": state.insurance,
        "selfPay": self_pay_card(state),
        "triage": state.triage,
        "found": {"due": state.found["due"], "hygienist": provider(state.found["hygienist"])["name"]} if state.found else None,
        "booked": [{"id": a.id, "patient": a.patient, "visit": visit_type(a.type_id)["name"], "day": date_label(a.date), "time": clock(a.start), "with": provider(op(a.op)["provider"])["name"], "op": op(a.op)["name"], "changes": a.changes} for a in live],  # type: ignore[arg-type]
        "asap": state.asap,
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "urgent": m.urgent} for m in state.messages],
        "note": note(state),
        "tasks": tasks(state),
        "emailed": state.emailed,
    }
