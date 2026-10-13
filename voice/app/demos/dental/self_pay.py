"""
Self-pay at Aspen Grove: what Josh offers a caller with no dental insurance. The $129 new-patient visit, this
month's special (join the savings plan and the first visit is included, with free take-home whitening), the plan's
sign-up link, and the household: anyone else at home due gets the sign-up with the intake forms, no names taken on
the call. Guidance for the agent, never a script.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ..types import OpContext, OpResult, ok
from .intake import next_fields
from .state import DentalState
from .store import PLAN, SELF_PAY

def uninsured(state: DentalState) -> bool:
    return state.patient.get("hasInsurance") is False and not state.found


def monthly(member: dict[str, Any]) -> int:
    return PLAN["child" if member.get("child") else "adult"]["monthly"]


def plan_members(state: DentalState) -> list[dict[str, Any]]:
    """Who the sign-up link is for on this call: the caller, once they want it. The household signs up from the forms."""
    if state.self_pay.get("plan") != "text":
        return []
    p = state.patient
    return [{"name": p.get("name") or "Caller", "child": bool(p.get("child"))}]


def self_pay_options(state: DentalState, _: Any, ctx: OpContext) -> OpResult:
    state.self_pay["offered"] = True
    state.opened = True
    v, sp = SELF_PAY["newPatientVisit"], SELF_PAY["special"]
    return ok("Self-pay options", {
        "newPatientVisit": f"Normally {v['price']}: {v['covers'][0].lower()}{v['covers'][1:]}. {v['regularCleaning']}",
        "specialThisMonth": sp["offer"],
        "whitening": sp["whitening"],
        "plan": {
            "name": PLAN["name"],
            "adult": f"${PLAN['adult']['monthly']} a month, or ${PLAN['adult']['yearly']} a year ({PLAN['adult']['ages']})",
            "child": f"${PLAN['child']['monthly']} a month, or ${PLAN['child']['yearly']} a year ({PLAN['child']['ages']})",
            "covers": PLAN["covers"],
            "term": PLAN["term"],
            "simple": PLAN["simple"],
            "ifAsked": PLAN["notInsurance"],
            "signUp": PLAN["signUp"],
            "household": PLAN["household"],
        },
        "guide": "In your own words, short and warm: new patients are normally $129 for the exam, a full set of X-rays and a cleaning. "
                 "But right now there's a special: join the savings plan this month and that first visit is included, plus free take-home whitening once the dentist gives the okay. "
                 "The plan is $35 a month and covers their cleanings, exams and X-rays for the year, plus 15% off any treatment. "
                 "Then ask whether to text them the sign-up link with their forms, and record the answer with note_savings_plan.",
    }, True)


class NoteSavingsPlan(BaseModel):
    wantsLink: bool = Field(description="True when they want the sign-up link texted with their forms; false for a no or a 'not now'.")


def note_savings_plan(state: DentalState, i: NoteSavingsPlan, ctx: OpContext) -> OpResult:
    state.self_pay["offered"] = True
    state.self_pay["plan"] = "text" if i.wantsLink else "declined"
    state.opened = True
    say = ("Say you'll text the sign-up link with their forms, to the number they're calling from. "
           if i.wantsLink else "That's fine: they book the $129 visit. Don't bring the plan up again. ")
    return ok("Savings plan · sign-up link to text" if i.wantsLink else "Savings plan · not now", {"say": say, **next_fields(state)}, True)


def self_pay_card(state: DentalState) -> Optional[dict[str, Any]]:
    """The self-pay card the front office sees."""
    if not (uninsured(state) or state.self_pay):
        return None
    members = plan_members(state)
    per = [{"name": m["name"], "kind": "Child" if m.get("child") else "Adult", "monthly": monthly(m)} for m in members]
    total = sum(x["monthly"] for x in per)
    plan = state.self_pay.get("plan")
    return {
        "offered": bool(state.self_pay.get("offered")),
        "plan": plan,
        "visit": "Included with the plan" if plan == "text" else SELF_PAY["newPatientVisit"]["price"],
        "special": SELF_PAY["special"]["offer"],
        "members": per,
        "monthly": total,
        "yearly": total * 12,
        "household": state.patient.get("familyDue"),
    }


__all__ = ["NoteSavingsPlan", "note_savings_plan", "plan_members", "self_pay_card", "self_pay_options", "uninsured"]
