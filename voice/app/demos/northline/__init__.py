"""
Northline Home Services: a fictional heating and cooling (HVAC) company. The visitor books a
service visit, changes it, cancels it, or leaves a callback request.

Folder: data/*.json (the business), store.py (the only reader of the data), state.py (one call),
prompt.py (Ellie's instructions), tools.py (her operations), view.py (the dashboard).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import instruction
from .state import NorthlineState, create_state, issue_is_vague
from .tools import (
    BookAppointment,
    CancelAppointment,
    CheckAvailability,
    EmailConfirmation,
    NoteRequestDetails,
    RescheduleAppointment,
    TakeMessage,
    book_appointment,
    cancel_appointment,
    check_availability,
    email_confirmation,
    get_business_info,
    note_request_details,
    reschedule_appointment,
    take_message,
)
from .view import view

__all__ = ["northline", "issue_is_vague"]


northline: DemoDefinition[NorthlineState] = DemoDefinition(
    id="northline",
    business_name="Northline Home Services",
    agent_name="Ellie",
    create_state=create_state,
    instruction=instruction,
    view=view,
    operations={
        "get_business_info": Operation("Looking up Northline's services", "Everything about Northline: services and prices, service area, hours, emergencies and the after-hours fee, the Comfort Club, financing, warranty, payment and policies. Use before answering any question about the business.", get_business_info, writes=False),
        "note_request_details": Operation(
            "Updating the service request",
            "Record details the caller has given or confirmed so the request card fills in. Send only the fields that are new or changed. proposedSlotId must be a slot check_availability returned.",
            note_request_details,
            NoteRequestDetails,
            aside=True,
        ),
        "check_availability": Operation(
            "Checking the schedule",
            "Open arrival windows for a service on a date (YYYY-MM-DD, Pacific Time). If that date has none, returns the next available windows instead. Only offer what this returns.",
            check_availability,
            CheckAvailability,
            writes=False,
        ),
        "book_appointment": Operation("Booking the visit", "Book the visit after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the visit", "Move the existing booking to a new slot from check_availability, after the caller confirmed the new time.", reschedule_appointment, RescheduleAppointment),
        "cancel_appointment": Operation("Cancelling the visit", "Cancel a booking made in this call, after the caller confirmed.", cancel_appointment, CancelAppointment),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request for the Northline team.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked visit, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
