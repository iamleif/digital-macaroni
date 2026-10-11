"""
Woodward Motor Co.: a fictional pre-owned superstore with a service department on Woodward Avenue,
Detroit, selling real cars (about 1,200 retail listings around Detroit, pulled once from auto.dev and
kept as our own data, photos included). Wes finds cars, answers from the listing, books test drives
with the right consultant, takes trade-in details for an in-person appraisal, books service, and
sends payment questions to the finance manager. Never a lower price, a payment or a trade value.

Folder: data/*.json (the dealership, staff, service menu, calendar, customers, inventory), store.py
(the only reader of the data), state.py (one call), prompt.py (Wes's instructions), tools.py (his
operations), view.py (the desk).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .state import DealershipState, create_state
from .tools import (
    BookAppointment,
    CheckAvailability,
    EmailConfirmation,
    GetVehicle,
    NoteLead,
    RescheduleAppointment,
    SearchInventory,
    TakeMessage,
    book_appointment,
    check_availability,
    email_confirmation,
    get_dealership_info,
    get_vehicle,
    note_lead,
    reschedule_appointment,
    search_inventory,
    take_message,
)
from .view import view

__all__ = ["dealership"]


dealership: DemoDefinition[DealershipState] = DemoDefinition(
    id="dealership",
    business_name="Woodward Motor Co.",
    agent_name="Wes",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="friendly, straight-talking and relaxed, a Detroit car guy",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Woodward", "Wes", "Detroit", "F-150", "Silverado", "Equinox", "Explorer", "Bronco", "Wrangler", "Grand Cherokee", "RAV4", "CR-V", "Tahoe", "Escalade", "Navigator", "Model Y", "AWD", "4x4", "test drive", "trade-in", "certified pre-owned", "Rita"],
    operations={
        "get_dealership_info": Operation("Looking up Woodward", "Hours, pricing and fees, financing, trade-ins, warranty, delivery and the service menu. Use before answering any question about the dealership.", get_dealership_info),
        "search_inventory": Operation("Searching the lot", "Search the cars on our lot by make, model, body style, budget, year, miles, colour, drivetrain or fuel. Returns how many and the best few to read out.", search_inventory, SearchInventory),
        "get_vehicle": Operation("Pulling up the car", "One car's details by stock number.", get_vehicle, GetVehicle),
        "note_lead": Operation("Updating the lead", "Record what the caller told you about themselves, how they'll pay and their trade-in, so the lead fills in. Send only what is new or changed.", note_lead, NoteLead),
        "check_availability": Operation("Checking the calendar", "Open times for a test drive of a car, or a service visit, on a date (YYYY-MM-DD, Eastern Time). If that day has none, returns the next openings.", check_availability, CheckAvailability),
        "book_appointment": Operation("Booking it", "Book the test drive or service visit after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the booking", "Move a booking to a new time from check_availability, after the caller confirmed.", reschedule_appointment, RescheduleAppointment),
        "take_message": Operation("Leaving a message", "Leave a callback request for sales, finance or service. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked test drive or service visit, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
