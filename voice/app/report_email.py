"""
The call report promised on the setup card ("Where should we send your call report?"): once the call
ends, a short email to that address with what the agent did and the button to the call's own page.
Sent once per call, after the recording is stored when there is one (so the page is complete).
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from . import email, log

if TYPE_CHECKING:
    from .session import DemoSession

# Steps that are plumbing or look-ups, not something the caller would call an outcome.
QUIET = {"link_screen", "get_caller_number", "end_call", "get_business_info", "get_firm_info", "get_shop_info", "get_agency_info", "note_request_details", "note_intake", "find_places", "get_brokerage_info", "note_lead", "note_account", "note_booking", "note_visit", "get_dealership_info", "get_practice_info", "note_patient"}
DID = {
    "northline": "checked the live schedule and looked after your call",
    "lawfirm": "took your call, listened to what happened and passed it to the right attorney",
    "formfield": "searched the shop, checked live stock and looked after your call",
    "travel": "searched live airline fares and looked after your call",
    "hotels": "searched real hotels with live rates and looked after your call",
    "realestate": "searched real Austin listings and passed your details to the right agent",
    "insurance": "looked after your call and logged everything for our licensed agents",
    "lune": "found the right person, checked the book and looked after your call",
    "tidewell": "found the right practitioner, checked the schedule and looked after your call",
    "dealership": "searched the lot and looked after your call",
    "dental": "checked the book and looked after your call",
}
# How long to wait for a recording before sending the report without it.
RECORDING_WAIT_S = 90


def steps(session: "DemoSession") -> list[str]:
    seen: list[str] = []
    for e in session.record.entries:
        if e.get("kind") == "tool" and e.get("ok") and e.get("tool") not in QUIET and e.get("summary"):
            line = str(e["summary"])
            if line not in seen:
                seen.append(line)
    return seen[-6:]


async def send(session: "DemoSession", recorded: bool) -> None:
    address = (session.setup or {}).get("email")
    if session.report_sent or not address or session.demo_id not in email.BRANDS:
        return
    session.report_sent = True
    email.REPORT_URL.set(session.report_url)
    message = email.call_report(session.demo_id, session.demo.agent_name, {"steps": steps(session), "recorded": recorded, "did": DID.get(session.demo_id)})
    masked, why = await email.confirm(address, message)
    log.info("report.emailed" if masked else "report.not_sent", {"session": session.id, "outcome": why})


async def after_call(session: "DemoSession", recording_pending: bool) -> None:
    """At the end of a call: send now, or once the recording is in (with a fallback if it never comes)."""
    if not recording_pending:
        await send(session, recorded=False)
        return
    await asyncio.sleep(RECORDING_WAIT_S)
    await send(session, recorded=False)
