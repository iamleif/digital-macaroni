"""
Aspen Grove Dental: a fictional family dental practice in Lincoln Park, Chicago. Josh answers the phone
the way a good front office does: new patients (intake, insurance in or out of network, medical alerts),
current patients found by name and date of birth (recall, with the six-months-and-a-day insurance
timing), callers without insurance (self_pay.py: the $129 visit, this month's savings-plan special, forms for
the rest of the household), toothaches triaged to the emergency room or a held same-day slot, kids, changes, the
short-notice list. The book is the practice's: four operatories, two doctor and two hygiene, in
10-minute units, emergency holds at 10:30 and 2, lunch at 12.

Folder: data/*.json (the practice, providers and operatories, visit types, insurance, patients, the
day's other appointments), store.py (the only reader of the data), state.py (one call and the book),
prompt.py (Josh's instructions), tools.py (its operations), view.py (the front office).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .self_pay import NoteSavingsPlan, note_savings_plan, self_pay_options
from .state import DentalState, create_state
from .tools import (
    AddToAsap,
    BookAppointment,
    CancelAppointment,
    CheckAvailability,
    CheckInsurance,
    EmailConfirmation,
    FindPatient,
    NotePatient,
    RescheduleAppointment,
    TakeMessage,
    TriageEmergency,
    add_to_asap_list,
    book_appointment,
    cancel_appointment,
    check_availability,
    check_insurance,
    email_confirmation,
    find_patient,
    get_practice_info,
    note_patient,
    reschedule_appointment,
    take_message,
    triage_emergency,
)
from .view import view

__all__ = ["dental"]


dental: DemoDefinition[DentalState] = DemoDefinition(
    id="dental",
    business_name="Aspen Grove Dental",
    agent_name="Josh",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="warm, calm and organised, a trusted dental front office",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Aspen Grove", "Josh", "Lincoln Park", "Dr. Patel", "Dr. Okafor", "Jenna", "Luis", "hygienist", "cleaning", "checkup", "X-rays", "Delta Dental", "Cigna", "MetLife", "Aetna", "Guardian", "United Concordia", "periodontal", "crown", "filling", "toothache", "CareCredit", "Sunbit", "savings plan", "whitening", "self-pay"],
    operations={
        "get_practice_info": Operation("Looking up the practice", "Hours, visit types and prices, the new-patient special, insurance we're in network with, kids, emergencies, payment plans and policies. Use before answering any question about the practice.", get_practice_info, writes=False),
        "note_patient": Operation("Updating the patient chart", "Record what the caller has told you so the chart fills in. Send only what is new or changed.", note_patient, NotePatient),
        "find_patient": Operation("Finding the patient", "Find a current patient by full name and date of birth.", find_patient, FindPatient, writes=False),
        "check_insurance": Operation("Checking the insurance", "Whether we're in network with the caller's dental plan, and what to say.", check_insurance, CheckInsurance),
        # Self-pay: a caller with no insurance (self_pay.py).
        "self_pay_options": Operation("Self-pay options", "No insurance: the $129 new-patient visit, this month's special (join the savings plan and the first visit is included, plus free take-home whitening), and the plan's prices and cover. Call it right after a caller says they don't have insurance.", self_pay_options, writes=False),
        "note_savings_plan": Operation("Savings plan sign-up", "Record whether they want the savings plan's sign-up link texted with their forms.", note_savings_plan, NoteSavingsPlan),
        "triage_emergency": Operation("Triage", "Record a toothache or emergency's answers (pain, swelling, fever, breathing or swallowing, injury, knocked-out tooth, bleeding) and get what to do: emergency room, within the hour, or a same-day visit.", triage_emergency, TriageEmergency),
        "check_availability": Operation("Checking the book", "Open times for a visit type on a date (YYYY-MM-DD, Central Time), with who it's with. Emergencies use the held same-day slots. If that day has none, returns the next openings.", check_availability, CheckAvailability, writes=False),
        "book_appointment": Operation("Booking the visit", "Book the visit after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the visit", "Move the booking to a new time from check_availability, after the caller confirmed.", reschedule_appointment, RescheduleAppointment),
        "cancel_appointment": Operation("Cancelling the visit", "Cancel a booking made in this call, after the caller confirmed.", cancel_appointment, CancelAppointment),
        "add_to_asap_list": Operation("Adding to the short-notice list", "Put the patient on the list the office calls when an earlier time opens.", add_to_asap_list, AddToAsap),
        "take_message": Operation("Leaving a message for the front office", "Leave a callback request. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked visit, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
