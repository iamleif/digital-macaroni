"""
Bluebird Insurance Agency: a fictional independent agency in Macon, Georgia writing personal auto, home
and renters with several carriers. New callers get a quote intake and a call with a licensed agent;
current customers (found by name and date of birth, or a policy number) hear what their policy says,
report a claim (logged for staff, with the carrier's claims line), request a change, or get their ID
card by email. Owen never quotes, binds, changes coverage or says a loss is covered.

Folder: data/*.json (the agency, carriers, staff, customers, policies), store.py (the only reader of the
data), state.py (one call), prompt.py (Owen's instructions), tools.py (his operations), view.py (the
agency's screen).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .state import InsuranceState, create_state
from .tools import (
    BookAgentCall,
    CheckAvailability,
    EmailConfirmation,
    EmailIdCard,
    FindCustomer,
    NoteAccount,
    PolicyRef,
    ReportClaim,
    RequestChange,
    RescheduleAgentCall,
    TakeMessage,
    book_agent_call,
    check_availability,
    email_confirmation,
    email_id_card,
    find_customer,
    get_agency_info,
    get_policy,
    note_account,
    report_claim,
    request_change,
    reschedule_agent_call,
    take_message,
)
from .view import view

__all__ = ["insurance"]


insurance: DemoDefinition[InsuranceState] = DemoDefinition(
    id="insurance",
    business_name="Bluebird Insurance Agency",
    agent_name="Owen",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="warm, steady and plain-spoken, an experienced Georgia insurance agent at an unhurried pace",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Bluebird", "Owen", "Macon", "Progressive", "Travelers", "Safeco", "Nationwide", "deductible", "liability", "comprehensive", "collision", "uninsured motorist", "renters", "homeowners", "declarations", "endorsement", "Lily"],
    operations={
        "get_agency_info": Operation("Looking up Bluebird", "The agency's lines, carriers, hours and how quotes, claims, changes and payments work. Use before answering any question about the agency.", get_agency_info),
        "note_account": Operation("Updating the account", "Record what the caller has told you about themselves and what they want quoted, so the account record fills in. Send only what is new or changed; drivers, vehicles and lists in full.", note_account, NoteAccount),
        "find_customer": Operation("Finding the customer", "Find a current customer by full name and date of birth, or a policy number. Required before reading any policy.", find_customer, FindCustomer),
        "get_policy": Operation("Opening the policy", "A current customer's policy: carrier, coverages, limits, deductibles, vehicles or property, renewal and billing.", get_policy, PolicyRef),
        "report_claim": Operation("Logging the claim notice", "Log a first notice of loss for our team as details come in, and get the carrier's claims line. Never files the claim with the carrier.", report_claim, ReportClaim),
        "request_change": Operation("Logging a policy change", "Log a change request (add or remove a vehicle or driver, address, mortgage company) for staff to confirm.", request_change, RequestChange),
        "email_id_card": Operation("Emailing the ID card", "Email an auto ID card, after the caller confirmed the address read back to them.", email_id_card, EmailIdCard),
        "check_availability": Operation("Checking the agents' calendar", "Open times for a call with a licensed agent on a date (YYYY-MM-DD, Eastern Time). If that day has none, returns the next openings.", check_availability, CheckAvailability),
        "book_agent_call": Operation("Booking a call with an agent", "Book a call with a licensed agent after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_agent_call, BookAgentCall),
        "reschedule_agent_call": Operation("Moving the call", "Move the booked call to a new time from check_availability, after the caller confirmed.", reschedule_agent_call, RescheduleAgentCall),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request for the account manager. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked call, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
