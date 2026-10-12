"""What Josh asks next: the practice's intake and triage questions, in order, derived from what the chart already holds."""

from __future__ import annotations

from typing import Optional

from .state import DentalState

# Questions the caller may decline or not have an answer to; `skipped` on note_patient records it so they are not asked again.
SKIPPABLE = ("age", "dateOfBirth", "reason", "lastVisit", "insurance", "relationship", "subscriber", "memberId", "groupNumber", "medicalAlert", "howLong")
CHART_DONE = "Chart complete: check insurance if you haven't, then move to booking."
LOOKUP = "They said they're a current patient: use find_patient with their full name and birth date."


def _open(state: DentalState, key: str, value) -> bool:
    return value is None and key not in state.skipped


def triage_next(state: DentalState) -> Optional[tuple[str, str]]:
    """The first red-flag question still unanswered, in the practice's order."""
    tr = state.triage or {}
    if _open(state, "howLong", state.patient.get("howLong")):
        return "howLong", "Where does it hurt, and how long has it been going on?"
    if tr.get("swelling") is None:
        return "swelling", "Is there any swelling in your face or gums?"
    if tr["swelling"] and tr.get("swellingSpreading") is None:
        return "swellingSpreading", "Is the swelling spreading toward your eye or down your neck, or making it hard to speak?"
    if tr["swelling"] and tr.get("troubleBreathingOrSwallowing") is None:
        return "troubleBreathingOrSwallowing", "Is it hard to breathe or swallow?"
    if tr.get("fever") is None:
        return "fever", "Do you have a fever?"
    if tr.get("painLevel") is None:
        return "painLevel", "On a scale of one to ten, how bad is the pain?"
    if tr.get("faceInjuryOrAccident") is None:
        return "faceInjuryOrAccident", "Has there been any injury to your face or mouth, or bleeding that won't stop?"
    return None


def in_emergency(state: DentalState) -> bool:
    p = state.patient
    return bool(state.triage) or p.get("reason") == "emergency" or bool(set(p.get("symptoms") or []) & {"pain", "swelling", "knocked_out_tooth", "jaw_pain"}) or p.get("painLevel") is not None


def intake_next(state: DentalState) -> tuple[Optional[str], Optional[str]]:
    """(field, spoken question) for the next unanswered intake question; (None, None) when the chart is complete.
    A field with no question means a tool step comes next (see LOOKUP)."""
    p = state.patient
    child = p.get("child") is True
    they = "they" if child else "you"

    if state.triage and state.triage.get("outcome") == "er":
        return None, None
    if in_emergency(state) and not (state.triage and state.triage.get("outcome")):
        t = triage_next(state)
        if t:
            return t
    if not p.get("name"):
        return "name", "What's your child's name?" if child else "Can I get your name?"
    if len(p["name"].split()) < 2:  # a first name alone is not a name yet
        return "name", "And their last name?" if child else "And your last name?"
    if state.found:
        if p.get("reason") is None and not state.triage:
            return "reason", "What can we do for you today?"
        return None, None
    if p.get("newPatient") is None:
        return "newPatient", "Has your child been to see us before?" if child else "Have you been to see us before?"
    emergency = in_emergency(state)
    if child and _open(state, "age", p.get("age")):
        return "age", "How old are they?"
    if _open(state, "dateOfBirth", p.get("dateOfBirth")):
        return "dateOfBirth", "And their date of birth?" if child else "What's your date of birth?"
    if p["newPatient"] is False:
        return "lookup", None
    if emergency:
        return None, None
    if _open(state, "reason", p.get("reason")):
        return "reason", "What brings " + ("them" if child else "you") + " in?"
    if _open(state, "lastVisit", p.get("lastVisit")):
        return "lastVisit", f"When did {they} last see a dentist?"
    ins = state.insurance
    if ins is None and "insurance" not in state.skipped:
        return "insurance", "Do you have dental insurance? Which plan is it?"
    if ins and not ins.get("medicaid"):
        rel = p.get("relationship")
        if _open(state, "relationship", rel):
            return "relationship", "Whose name is the plan under?" if child else "Is the plan in your own name, or someone else's?"
        if rel in ("spouse", "child", "other") and _open(state, "subscriber", p.get("subscriber")):
            return "subscriber", "What's the plan holder's name?"
        if rel in ("spouse", "child", "other") and len((p.get("subscriber") or "").split()) == 1 and "subscriber" not in state.skipped:
            return "subscriber", "And the plan holder's last name?"
        if _open(state, "memberId", p.get("memberId")):
            return "memberId", "What's the member ID on the card?"
        if p.get("groupNumber") is None and "groupNumber" not in state.skipped and "groupNumber" not in state.asked:
            state.asked.append("groupNumber")
            return "groupNumber", "Is there a group number or employer on the card?"
    if p.get("medicalAlert") is None and "medicalAlert" not in state.skipped and "medicalAlert" not in state.asked:
        state.asked.append("medicalAlert")
        return "medicalAlert", "Is there anything the dentist should know before the visit, like blood thinners or needing antibiotics first?"
    return None, None


def next_fields(state: DentalState) -> dict:
    """The `next` block that note_patient returns."""
    key, q = intake_next(state)
    if q:
        return {"next": q, "nextField": key}
    if key == "lookup":
        return {"next": None, "then": LOOKUP}
    if state.triage and state.triage.get("outcome") == "er":
        return {"next": None, "then": "Emergency room first: don't book."}
    return {"next": None, "then": CHART_DONE}
