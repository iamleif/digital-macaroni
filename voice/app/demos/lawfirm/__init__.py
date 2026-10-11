"""
Alder & Finch Injury Law: a fictional personal-injury firm in Denver. The caller has been hurt and
rings the intake line. The agent listens, fills in the intake, runs a conflict check, qualifies or
politely declines, and books a free consultation on an attorney's calendar. The firm's side of the
screen is what a managing partner would want to see after the call: the intake, the conflict check,
the case tier, the attorney calendar and a ranked 7 AM case brief.

The agent never gives legal advice and never tells a caller what a case is worth, its tier or its
odds. Those live in the firm's view only.

Folder: data/*.json (the firm and its intake criteria), store.py (the only reader of the data),
state.py (one call), prompt.py (Nora's instructions), tools.py (her operations), view.py (the
firm's dashboard).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import instruction
from .state import LawFirmState, create_state
from .tools import (
    BookConsultation,
    CheckAvailability,
    CheckConflicts,
    EmailConfirmation,
    NoteIntake,
    RescheduleConsultation,
    TakeMessage,
    assess_case,
    book_consultation,
    check_availability,
    check_conflicts,
    email_confirmation,
    get_firm_info,
    note_intake,
    reschedule_consultation,
    take_message,
)
from .view import view

__all__ = ["lawfirm"]


lawfirm: DemoDefinition[LawFirmState] = DemoDefinition(
    id="lawfirm",
    business_name="Alder & Finch Injury Law",
    agent_name="Nora",
    create_state=create_state,
    instruction=instruction,
    view=view,
    operations={
        "get_firm_info": Operation("Looking up the firm", "What the firm handles, its fees and hours, its attorneys, what to bring to a consultation, and its policies. Use before answering any question about the firm.", get_firm_info),
        "note_intake": Operation("Filling in the intake form", "Record what the caller has told you so the intake form fills in. Send only the fields that are new or changed. Dates are YYYY-MM-DD worked out from today's date.", note_intake, NoteIntake),
        "check_conflicts": Operation("Running the conflict check", "Check the caller's name and the other party's name against the firm's clients and open matters. Run it once you have the caller's name. Never tell the caller what a conflict check found.", check_conflicts, CheckConflicts),
        "assess_case": Operation("Reviewing the case", "Decide whether the firm can take the case from the intake, and get what to say if it cannot. Needs the basics noted and the conflict check done. Never tell the caller a tier, a value or odds.", assess_case),
        "check_availability": Operation("Checking the attorneys' calendars", "Open consultation times with an attorney who fits this case on a date (YYYY-MM-DD, Mountain Time). If that date has none, returns the next openings instead. Only offer what this returns, and only after assess_case says the firm can take the case.", check_availability, CheckAvailability),
        "book_consultation": Operation("Booking the consultation", "Book the free consultation after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_consultation, BookConsultation),
        "reschedule_consultation": Operation("Moving the consultation", "Move the existing consultation to a new slot from check_availability, after the caller confirmed the new time.", reschedule_consultation, RescheduleConsultation),
        "take_message": Operation("Leaving a message for the attorneys", "Leave a callback request for the attorneys.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the confirmation", "Email the booked consultation's confirmation to the caller, after they confirm the address read back to them. Once per call.", email_confirmation, EmailConfirmation),
    },
)
