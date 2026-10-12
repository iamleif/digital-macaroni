"""Every question a tool hands the agent is one question: no 'X, and if so, Y' pairs."""

import re
from datetime import datetime, timezone

import pytest

from app.demos.dental import intake as dental_intake
from app.demos.dental import create_state
from app.demos.insurance import state as insurance_state
from app.demos.lawfirm import state as lawfirm_state
from app.demos.realestate import state as realestate_state

JOINED = re.compile(r", and if so|, and what|, and who|, and which|, and when|, and where| and what| and who| and which| and when| and where|\? [A-Z][^?]*\?")


def check(q: str):
    assert q.count("?") == 1, q
    assert not JOINED.search(q), q


def test_lawfirm_questions_are_single():
    for _, q, _ in lawfirm_state.QUESTIONS:
        check(q)


def test_insurance_claim_questions_are_single():
    for _, q, _ in insurance_state.CLAIM_QUESTIONS:
        check(q)


def test_insurance_quote_questions_are_single():
    a = {"quoteLines": ["auto", "home", "renters"]}
    for _, q, _ in insurance_state._quote_steps(a):
        if q:
            check(q)
    check(insurance_state.quote_next(type("S", (), {"account": {}})())[0])


@pytest.mark.parametrize("lead", [{}, {"name": "Sam"}, {"intent": "buy"}, {"intent": "sell"}, {"intent": "both", "financing": "pre_approved"}])
def test_realestate_lead_questions_are_single(lead):
    for _, _, q in realestate_state.lead_questions(lead):
        check(q)


def test_insurance_other_insurer_is_asked_only_after_a_real_other_party():
    claim = {"kind": "x", "date": "d", "location": "l", "injuries": "no", "policeReport": "no", "otherParty": "Sam Lee"}
    assert insurance_state.claim_next(claim)[0] == "Do you know their insurer?"
    claim["otherParty"] = "unknown"
    assert insurance_state.claim_next(claim)[0] == "Do you have any photos?"


def test_dental_triage_and_intake_questions_are_single():
    for tr in ({}, {"swelling": True}):
        s = create_state(datetime(2026, 10, 12, tzinfo=timezone.utc))
        s.triage = dict(tr)
        s.patient = {"howLong": None}
        while True:
            t = dental_intake.triage_next(s)
            if not t:
                break
            check(t[1])
            s.triage[t[0]] = False if t[0] != "painLevel" else 3
            if t[0] == "howLong":
                s.patient["howLong"] = "a day"


def test_dental_intake_walk_is_single_questions():
    for child in (False, True):
        s = create_state(datetime(2026, 10, 12, tzinfo=timezone.utc))
        s.patient = {"child": child}
        seen = 0
        for _ in range(30):
            key, q = dental_intake.intake_next(s)
            if not q:
                break
            check(q)
            seen += 1
            p = s.patient
            if key == "hasInsurance":
                p["hasInsurance"] = True
            elif key == "carrier":
                s.insurance = {"carrier": "Delta"}
            elif key == "name":
                p["name"] = "Sam Lee"
            elif key == "newPatient":
                p["newPatient"] = True
            elif key == "relationship":
                p["relationship"] = "self"
            else:
                p[key] = "x" if key not in ("age",) else 6
        assert seen >= 8
