"""What the Bluebird Insurance screen shows: the agency's side of the call. Never includes anything the caller should not see."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from ... import email
from ..types import mask_number, reference
from . import store
from .state import InsuranceState, active, describe_slot, quote_missing, quoting
from .store import CHANGE_LABEL, CLAIM_LABEL, COVERAGE_LABEL, LINE_LABEL, SERVICE, carrier, person

TRI = {"yes": "Yes", "no": "No", "unknown": "Not sure"}


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def short_date(iso: Optional[str]) -> Optional[str]:
    if not iso:
        return None
    d = date.fromisoformat(iso)
    return f"{d.strftime('%b')} {d.day}, {d.year}"


def record_sections(state: InsuranceState) -> list[dict[str, Any]]:
    a = state.account
    c = state.customer
    out = [{"id": "contact", "title": "Contact", "fields": [
        f("name", "Full name", "text", a.get("name")),
        f("dob", "Date of birth", "date", short_date(a.get("dateOfBirth"))),
        f("phone", "Phone", "text", mask_number(a["phone"]) if a.get("phone") else (f"•••• {c['phoneLast4']}" if c else None)),
        f("email", "Email", "text", email.mask(a["email"]) if a.get("email") and "@" in a["email"] else None),
        f("address", "Address", "text", a.get("address"), None, True),
        f("status", "Customer", "select", ("Current customer" if c else "New prospect") if state.opened else None, ["Current customer", "New prospect"]),
    ]}]
    if quoting(state) or not c:
        lines = a.get("quoteLines") or []
        out.append({"id": "quote", "title": "Quote request", "fields": [
            f("lines", "Lines to quote", "chips", [LINE_LABEL[x] for x in lines] or None, list(LINE_LABEL.values())),
            f("carrier", "Current carrier", "text", a.get("currentCarrier")),
            f("renewal", "Current renewal", "date", short_date(a.get("renewalDate"))),
            f("coverage", "Coverage wanted", "chips", [COVERAGE_LABEL[x] for x in a.get("coverageWanted", [])] or None, list(COVERAGE_LABEL.values()), True),
        ]})
    return out


def rows(state: InsuranceState) -> dict[str, list[dict[str, str]]]:
    """Drivers and vehicles for an auto quote, home facts for a home or renters quote."""
    a = state.account
    drivers = [{"name": d["name"], "detail": " · ".join(x for x in [short_date(d.get("dateOfBirth")) and f"Born {short_date(d.get('dateOfBirth'))}", d.get("yearsLicensed") is not None and f"Licensed {d['yearsLicensed']} yrs", d.get("incidents") and f"Incidents: {d['incidents']}"] if x)} for d in a.get("drivers", [])]
    vehicles = [{"name": f"{v['year']} {v['make']} {v['model']}", "detail": ""} for v in a.get("vehicles", [])]
    home = [{"name": k, "detail": v} for k, v in (("Year built", a.get("yearBuilt")), ("Square feet", a.get("squareFeet") and f"{a['squareFeet']:,}"), ("Belongings", a.get("personalProperty") and f"${a['personalProperty']:,}")) if v]
    return {"drivers": drivers, "vehicles": vehicles, "home": home}  # type: ignore[dict-item]


def stage_of(state: InsuranceState) -> str:
    if active(state):
        return "booked"
    if state.claim or state.requests or state.id_cards:
        return "logged"
    if state.customer or (quoting(state) and not quote_missing(state)):
        return "ready"
    if state.opened:
        return "intake"
    return "new"


def policy_card(state: InsuranceState) -> Optional[dict[str, Any]]:
    if not state.policy:
        return None
    p = store.POLICIES[state.policy]
    out = {
        "number": p["number"], "line": LINE_LABEL[p["line"]], "carrier": carrier(p["carrier"])["name"], "term": p["term"],
        "renews": short_date(p["renewal"]), "coverages": p["coverages"], "billing": p["billing"],
        "insured": [*p.get("vehicles", []), *([p["property"]] if p.get("property") else [])],
        "drivers": p.get("drivers", []),
    }
    return out


def claim_card(state: InsuranceState) -> Optional[dict[str, Any]]:
    c = state.claim
    if not c:
        return None
    p = store.POLICIES[c["policy"]]
    cr = carrier(p["carrier"])
    fields = [
        ("What happened", CLAIM_LABEL.get(c.get("kind", ""))), ("When", short_date(c.get("date"))), ("Where", c.get("location")),
        ("Injuries", TRI.get(c.get("injuries", ""))), ("Police report", TRI.get(c.get("policeReport", ""))), ("Other party", c.get("otherParty")), ("Photos", TRI.get(c.get("photos", ""))),
    ]
    return {"id": c["id"], "policy": p["number"], "carrier": cr["name"], "claimsLine": cr["claimsLine"], "description": c.get("description"), "fields": [{"label": k, "value": v} for k, v in fields], "injured": c.get("injuries") == "yes"}


def tasks(state: InsuranceState) -> list[dict[str, Any]]:
    """What the agency system would queue for staff after the call: from the records, never invented."""
    out: list[dict[str, Any]] = []
    mgr = person(SERVICE)["name"]
    for c in active(state):
        s = describe_slot(state, c.slot_id, c.staff_id)
        out.append({"title": f"Call {c.name} · {c.topic}", "who": s["agent"], "due": f"{s['day']}, {s['time']}"})
        if quoting(state):
            out.append({"title": "Run quotes with the carriers", "who": s["agent"], "due": "Before the call"})
    if quoting(state) and not active(state):
        out.append({"title": "Prepare the quote and call back", "who": "Licensed agent", "due": "Next business day"})
    if state.claim:
        out.append({"title": f"Follow up the {carrier(store.POLICIES[state.claim['policy']]['carrier'])['name']} claim · {state.claim['id']}", "who": mgr, "due": "Today"})
    for r in state.requests:
        out.append({"title": f"Endorsement · {CHANGE_LABEL[r.kind].lower()}", "who": mgr, "due": "Today"})
    for n in state.id_cards:
        out.append({"title": f"ID card sent · {n}", "who": "Owen", "due": "Done"})
    if state.customer and not quoting(state) and len(state.customer["policies"]) < 2:
        out.append({"title": "Cross-sell review", "who": "Licensed agent", "due": "This month"})
    return out


def flags(state: InsuranceState) -> list[str]:
    out: list[str] = []
    lines = set(state.account.get("quoteLines") or [])
    if state.customer:
        lines |= {store.POLICIES[n]["line"] for n in state.customer["policies"]}
    if "auto" in lines and ("home" in lines or "renters" in lines):
        out.append("Bundle: auto + " + ("home" if "home" in lines else "renters"))
    r = state.account.get("renewalDate")
    if r and r >= state.today and (date.fromisoformat(r) - date.fromisoformat(state.today)).days <= 45:
        out.append("Renews within 45 days")
    if state.claim and state.claim.get("injuries") == "yes":
        out.append("Injury reported")
    return out


def call_note(state: InsuranceState) -> Optional[str]:
    a = state.account
    name = (state.customer or {}).get("name") or a.get("name")
    if not state.opened or not name:
        return None
    parts = [f"{name} called" + (" (current customer, verified)." if state.customer else ".")]
    if quoting(state):
        parts.append("Wants a quote: " + ", ".join(LINE_LABEL[x].lower() for x in a["quoteLines"]) + ".")
        if a.get("vehicles"):
            parts.append("Vehicles: " + ", ".join(f"{v['year']} {v['make']} {v['model']}" for v in a["vehicles"]) + ".")
        if a.get("currentCarrier"):
            parts.append(f"Currently with {a['currentCarrier']}" + (f", renews {short_date(a.get('renewalDate'))}." if a.get("renewalDate") else "."))
    if state.policy and not state.claim and not state.requests:
        p = store.POLICIES[state.policy]
        parts.append(f"Asked about the {LINE_LABEL[p['line']].lower()} policy {p['number']}.")
    if state.claim:
        c = state.claim
        parts.append(f"First notice of loss {c['id']}: {CLAIM_LABEL.get(c.get('kind', ''), 'loss').lower()}" + (f" on {short_date(c.get('date'))}" if c.get("date") else "") + (f" at {c['location']}" if c.get("location") else "") + ". Carrier claims line given.")
    for r in state.requests:
        parts.append(f"Change requested ({r.id}): {r.details}.")
    for c in active(state):
        s = describe_slot(state, c.slot_id, c.staff_id)
        parts.append(f"Call with {s['agent']} booked, {s['day']} at {s['time']}.")
    return " ".join(parts)


def view(state: InsuranceState) -> dict[str, Any]:
    v = state.viewing
    open_times = [{"slotId": s, "day": d["day"], "time": d["time"], "agent": d.get("agent", "")} for s in (v["slots"] if v else [])[:4] for d in [describe_slot(state, s)]] if v else []
    return {
        "timeZone": "Eastern Time",
        "record": {
            "opened": state.opened,
            "number": (state.customer or {}).get("id") or (reference("Q", 300, state.seed) if state.opened else None),
            "title": (state.customer or {}).get("name") or state.account.get("name"),
            "stage": stage_of(state),
            "sections": record_sections(state),
        },
        "verified": state.customer is not None,
        "accountPolicies": [{"number": n, "line": LINE_LABEL[store.POLICIES[n]["line"]], "carrier": carrier(store.POLICIES[n]["carrier"])["name"], "renews": short_date(store.POLICIES[n]["renewal"])} for n in (state.customer or {}).get("policies", [])],
        "rows": rows(state),
        "flags": flags(state),
        "policy": policy_card(state),
        "claim": claim_card(state),
        "requests": [{"id": r.id, "policy": r.policy, "kind": CHANGE_LABEL[r.kind], "details": r.details} for r in state.requests],
        "openTimes": open_times,
        "calls": [{"id": c.id, "status": c.status, "topic": c.topic, "name": c.name, "changes": c.changes, **{k: describe_slot(state, c.slot_id, c.staff_id)[k] for k in ("day", "time", "agent")}} for c in state.calls],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number)} for m in state.messages],
        "note": call_note(state),
        "tasks": tasks(state),
        "emailed": state.emailed,
    }
