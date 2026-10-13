"""
Lune Salon & Med Spa: a fictional salon and med spa on Melrose Avenue, Los Angeles. Ellie books cuts,
colour, nails and med-spa treatments with the right person at a real open time, offers an add-on,
holds bigger services with a deposit link, moves and cancels, and starts new injectable clients with
a consultation. On the shared appointment engine (../booking.py).

Folder: data/*.json (the salon, team, menu, hours, returning clients), store.py (the only reader of the
data), prompt.py (Ellie's instructions), tools.py (her operations), view.py (the front desk).
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
    NoteBooking,
    RescheduleAppointment,
    TakeMessage,
    book_appointment,
    cancel_appointment,
    check_availability,
    email_confirmation,
    get_business_info,
    note_booking,
    reschedule_appointment,
    take_message,
)
from .view import view

__all__ = ["lune"]


lune: DemoDefinition[BookingState] = DemoDefinition(
    id="lune",
    business_name="Lune Salon & Med Spa",
    agent_name="Ellie",
    create_state=CAL.create_state,
    instruction=instruction,
    view=view,
    voice_style="warm, easy and a little bubbly, a friendly salon front desk",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Lune", "Ellie", "Melrose", "balayage", "blowout", "gloss", "Hydrafacial", "Botox", "filler", "gel manicure", "pedicure", "Maria", "Ava", "Jules", "Noor"],
    operations={
        "get_business_info": Operation("Looking up Lune", "The menu and prices, add-ons, the team, hours, deposits, cancellation, med-spa rules and parking. Use before answering any question about the salon.", get_business_info, writes=False),
        "note_booking": Operation("Updating the booking card", "Record what the caller has told you so the booking card fills in. Send only what is new or changed.", note_booking, NoteBooking, aside=True),
        "check_availability": Operation("Checking the book", "Open times for a service on a date (YYYY-MM-DD, Pacific Time), with who they're with. If that day has none, returns the next openings.", check_availability, CheckAvailability, writes=False),
        "book_appointment": Operation("Booking it", "Book the service after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the appointment", "Move the booking to a new time from check_availability, after the caller confirmed.", reschedule_appointment, RescheduleAppointment),
        "cancel_appointment": Operation("Cancelling the appointment", "Cancel a booking made in this call, after the caller confirmed.", cancel_appointment, CancelAppointment),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked appointment, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
