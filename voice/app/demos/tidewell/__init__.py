"""
Tidewell Clinic: a fictional chiropractic, physiotherapy and massage clinic in Portland, Oregon. Ellie
books new patients into the right assessment, finds returning patients by name and date of birth,
notes coverage (direct billing, self-pay, auto accident, workers' comp), sends emergencies to 911,
and moves and cancels. On the shared appointment engine (../booking.py).

Folder: data/*.json (the clinic, team, services, hours, insurance, patients), store.py (the only reader
of the data), prompt.py (Ellie's instructions), tools.py (her operations), view.py (reception).
"""

from __future__ import annotations

from ..booking import BookingState
from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .store import CAL
from .tools import (
    BookAppointment,
    CancelAppointment,
    CheckAvailability,
    EmailConfirmation,
    FindPatient,
    NoteVisit,
    RescheduleAppointment,
    TakeMessage,
    book_appointment,
    cancel_appointment,
    check_availability,
    email_confirmation,
    find_patient,
    get_business_info,
    note_visit,
    reschedule_appointment,
    take_message,
)
from .view import view

__all__ = ["tidewell"]


tidewell: DemoDefinition[BookingState] = DemoDefinition(
    id="tidewell",
    business_name="Tidewell Clinic",
    agent_name="Ellie",
    create_state=CAL.create_state,
    instruction=instruction,
    view=view,
    voice_style="calm, kind and steady, a caring clinic front desk",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Tidewell", "Ellie", "Portland", "chiropractic", "chiropractor", "physiotherapy", "physio", "massage", "Dr. Lee", "Sam Patel", "Nina", "Regence", "Providence", "Moda", "Aetna", "Cigna", "PIP", "workers' comp"],
    operations={
        "get_business_info": Operation("Looking up Tidewell", "Services and self-pay prices, new-patient visits, insurance we bill, the package, hours and policies. Use before answering any question about the clinic.", get_business_info, writes=False),
        "note_visit": Operation("Updating the patient booking", "Record what the caller has told you so the booking card fills in, including any warning signs they mention. Send only what is new or changed; follow what the result says.", note_visit, NoteVisit, aside=True),
        "find_patient": Operation("Finding the patient", "Find a returning patient by full name and date of birth.", find_patient, FindPatient, writes=False),
        "check_availability": Operation("Checking the schedule", "Open times for a visit on a date (YYYY-MM-DD, Pacific Time), with who it's with. If that day has none, returns the next openings.", check_availability, CheckAvailability, writes=False),
        "book_appointment": Operation("Booking the visit", "Book the visit after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the visit", "Move the booking to a new time from check_availability, after the caller confirmed.", reschedule_appointment, RescheduleAppointment),
        "cancel_appointment": Operation("Cancelling the visit", "Cancel a booking made in this call, after the caller confirmed.", cancel_appointment, CancelAppointment),
        "take_message": Operation("Leaving a message for the front desk", "Leave a callback request. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked visit, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
