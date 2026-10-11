"""What the Alder & Finch dashboard shows: the managing partner's side of the call. Never includes anything the caller should not see."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from ... import email
from ..types import add_days, mask_number, reference
from .state import LawFirmState, active, bookable_days, describe_slot
from .store import CONFLICTS_ATTORNEY, FAULT_LABEL, FORMAT_LABEL, INJURY_AREAS, OVERNIGHT, SENIOR_PARTNER, TREATMENT_LABEL, TYPE_LABEL, attorney


def case_summary(state: LawFirmState) -> str:
    i = state.intake
    kind = TYPE_LABEL.get(i.get("accidentType", ""), "Injury")
    bits = [kind]
    if i.get("treatment") and i["treatment"] != "none":
        bits.append(TREATMENT_LABEL[i["treatment"]].lower())
    if i.get("atFault") == "other_party":
        bits.append("other party at fault")
    return "; ".join(bits)


def brief(state: LawFirmState) -> dict[str, Any]:
    rows = [{**r, "mine": False, "declined": False} for r in OVERNIGHT]
    a = state.assessment
    if a:
        who = (state.intake.get("name") or "This caller").strip()
        if a["outcome"] == "qualified":
            rows.append({"who": who, "summary": case_summary(state), "tier": a["tier"], "score": a["score"], "mine": True, "declined": False})
        else:
            rows.append({"who": who, "summary": f"Declined: {a['why'].rstrip('.')}", "tier": None, "score": -1, "mine": True, "declined": True})
    rows.sort(key=lambda r: r["score"], reverse=True)
    return {"rows": [{k: r[k] for k in ("who", "summary", "tier", "mine", "declined")} for r in rows]}


YES_NO = ["Yes", "No", "Not sure"]
TRI_LABEL = {"yes": "Yes", "no": "No", "unknown": "Not sure"}


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def record_sections(state: LawFirmState) -> list[dict[str, Any]]:
    i = state.intake
    tri = lambda k: TRI_LABEL.get(i.get(k, ""))  # noqa: E731
    lawyer = None if i.get("hasLawyer") is None else "Yes" if i["hasLawyer"] else "No"
    where = ", ".join(x for x in (i.get("accidentCity"), i.get("accidentState")) if x) or None
    when = None
    if i.get("accidentDate"):
        dd = date.fromisoformat(i["accidentDate"])
        when = f"{dd.strftime('%b')} {dd.day}, {dd.year}"
    return [
        {"id": "contact", "title": "Contact", "fields": [
            f("name", "Full name", "text", i.get("name")),
            f("phone", "Phone", "text", mask_number(i["phone"]) if i.get("phone") else None),
            f("email", "Email", "text", email.mask(i["email"]) if i.get("email") and "@" in i["email"] else None),
        ]},
        {"id": "matter", "title": "Matter", "fields": [
            f("practice", "Practice area", "select", "Personal injury" if state.opened else None, ["Personal injury", "Family law", "Estate planning"]),
            f("type", "Case type", "select", TYPE_LABEL.get(i.get("accidentType", "")), list(TYPE_LABEL.values())),
            f("date", "Date of incident", "date", when),
            f("where", "Location", "text", where),
            f("source", "Referral source", "select", "Phone · AI intake" if state.opened else None, ["Phone · AI intake", "Website", "Referral", "Advertising"]),
        ]},
        {"id": "injuries", "title": "Injuries & treatment", "fields": [
            f("areas", "Injured areas", "chips", [INJURY_AREAS[a] for a in i.get("injuryAreas", []) if a in INJURY_AREAS] or None, list(INJURY_AREAS.values()), True),
            f("injuries", "In the caller's words", "text", i.get("injuries"), None, True),
            f("treatment", "Treatment so far", "select", TREATMENT_LABEL.get(i.get("treatment", "")), list(TREATMENT_LABEL.values())),
            f("work", "Missed work", "toggle", tri("missedWork"), YES_NO),
            *([f("died", "Wrongful death", "toggle", "Yes", YES_NO)] if i.get("someoneDied") else []),
        ]},
        {"id": "liability", "title": "Liability & insurance", "fields": [
            f("fault", "At fault", "select", FAULT_LABEL.get(i.get("atFault", "")), list(FAULT_LABEL.values())),
            f("other", "Other party", "text", i.get("opposingParty")),
            f("police", "Police report", "toggle", tri("policeReport"), YES_NO),
            f("insured", "Other side insured", "toggle", tri("otherPartyInsured"), YES_NO),
            f("insurer", "Insurer", "text", i.get("otherPartyInsurer")),
            f("lawyer", "Already has a lawyer", "toggle", lawyer, ["Yes", "No"]),
        ]},
    ]


def stage_of(state: LawFirmState) -> str:
    a = state.assessment
    if a and a["outcome"] == "declined":
        return "declined"
    if active(state):
        return "consult"
    if a:
        return "qualified"
    if state.conflict:
        return "conflict"
    return "new"


def tasks(state: LawFirmState) -> list[dict[str, Any]]:
    """What the firm's system would queue for staff once Nora has finished: derived from the records, never invented."""
    a, i = state.assessment, state.intake
    out: list[dict[str, Any]] = []
    if not a:
        return out
    if a["outcome"] == "declined":
        if a["reason"] == "conflict":
            return [{"title": "Escalate to the conflicts attorney", "who": attorney(CONFLICTS_ATTORNEY)["name"], "due": "Today"}]
        return [{"title": "Send the non-engagement letter", "who": "Intake team", "due": "Today"}, {"title": "Send the Colorado Bar referral list", "who": "Intake team", "due": "Today"}]
    booked = active(state)
    if booked:
        c = booked[-1]
        s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
        out.append({"title": f"Free consultation · {s['day']}, {s['time']}", "who": attorney(c.attorney_id)["name"], "due": s["day"]})
    out.append({"title": "Email the consultation confirmation", "who": "Nora", "due": "Sent" if state.emailed else "Once booked"})
    if i.get("policeReport") == "yes":
        out.append({"title": "Request the police report", "who": "Intake team", "due": "Tomorrow"})
    if i.get("treatment") not in (None, "none"):
        out.append({"title": "Send the medical-records release for signature", "who": "Intake team", "due": "Tomorrow"})
    if a.get("deadline") and "Time limit within 6 months" in a["flags"]:
        out.append({"title": f"Calendar the filing deadline · {a['deadline']}", "who": "Docketing", "due": "Today"})
    if i.get("someoneDied"):
        out.append({"title": "Partner call to the family", "who": attorney(SENIOR_PARTNER)["name"], "due": "Within the hour"})
    return out


def call_note(state: LawFirmState) -> Optional[str]:
    a, i = state.assessment, state.intake
    if not a:
        return None
    who = i.get("name", "The caller")
    kind = TYPE_LABEL.get(i.get("accidentType", ""), "injury").lower()
    where = ", ".join(x for x in (i.get("accidentCity"), i.get("accidentState")) if x)
    parts = [f"{who} called the intake line about a {kind}" + (f" on {i['accidentDate']}" if i.get("accidentDate") else "") + (f" in {where}." if where else ".")]
    if i.get("injuries"):
        parts.append(f"Injuries: {i['injuries']}.")
    if i.get("treatment"):
        parts.append(f"Treatment: {TREATMENT_LABEL[i['treatment']].lower()}.")
    parts.append(f"Fault: {FAULT_LABEL.get(i.get('atFault', ''), 'unknown').lower()}." + (" Police report filed." if i.get("policeReport") == "yes" else ""))
    parts.append("Not represented." if i.get("hasLawyer") is False else "")
    parts.append("Conflict check clear." if state.conflict and state.conflict["status"] == "clear" else "Conflict found.")
    if a["outcome"] == "declined":
        parts.append(f"Declined: {a['why'].rstrip('.')}.")
    else:
        parts.append(f"Tier {a['tier']}.")
        if active(state):
            c = active(state)[-1]
            s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
            parts.append(f"Free consultation booked with {attorney(c.attorney_id)['name']}, {s['day']} at {s['time']}.")
    return " ".join(p for p in parts if p)


def view(state: LawFirmState) -> dict[str, Any]:
    days = bookable_days(state)
    booked = active(state)
    focus = (state.viewing or {}).get("date") or (booked[0].slot_id[:10] if booked else add_days(state.today, 1))
    day = focus if focus in days else days[0]
    viewing = state.viewing
    a = state.assessment
    deadline = None
    if a and a.get("deadline"):
        dd = date.fromisoformat(a["deadline"])
        deadline = f"{dd.strftime('%B')} {dd.day}, {dd.year}"

    # Times the agent has just found: one row per opening, with the attorney it would be with.
    open_times = []
    if viewing and viewing["date"] == day:
        for sid in viewing["slots"]:
            d = describe_slot(state, sid, viewing["pool"])
            if d.get("attorney"):
                open_times.append({"slotId": sid, "day": d["day"], "time": d["time"], "attorney": d["attorney"]})
    return {
        "timeZone": "Mountain Time",
        "record": {
            "opened": state.opened,
            "number": reference("PI", 900, state.seed) if state.opened else None,
            "title": state.intake.get("name"),
            "stage": stage_of(state),
            "sections": record_sections(state),
        },
        "conflict": None if state.conflict is None else {"status": state.conflict["status"], "checked": state.conflict["names"]},
        "assessment": None if not a else {
            "outcome": a["outcome"], "tier": a["tier"], "reason": a["why"] if a["outcome"] == "declined" else None,
            "points": a["why"] if a["outcome"] == "qualified" else [], "flags": a["flags"], "deadline": deadline,
        },
        "note": call_note(state),
        "tasks": tasks(state),
        "openTimes": open_times[:4],
        "consults": [
            {"id": c.id, "status": c.status, **{k: v for k, v in describe_slot(state, c.slot_id, [c.attorney_id], c.id).items() if k in ("day", "time")}, "attorney": attorney(c.attorney_id)["name"], "format": FORMAT_LABEL[c.fmt], "name": c.name, "changes": c.changes}
            for c in state.consults
        ],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "urgent": m.urgent} for m in state.messages],
        "brief": brief(state) if a else None,
        "emailed": state.emailed,
    }
