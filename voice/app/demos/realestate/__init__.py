"""
Juniper Row Realty: a fictional residential brokerage in Austin, Texas, answering for real active
Austin listings (pulled once from RentCast, stored in data/listings.json). Buyers ask about a home or search, and book a showing with
the agent for that area; sellers get a value range from comparable listings and a free in-person valuation.
Every caller becomes a lead on the brokerage's screen, ranked for the team (never told to the caller).

Folder: data/*.json (the brokerage, its agents, areas, calendar, contacts and listings), store.py (the
only reader of the data and of RentCast), state.py (one call), prompt.py (Miles's instructions),
tools.py (his operations), view.py (the brokerage's screen).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .state import RealEstateState, create_state
from .tools import (
    BookAppointment,
    CheckAvailability,
    EmailConfirmation,
    EstimateValue,
    GetListing,
    NoteLead,
    RescheduleAppointment,
    SearchListings,
    TakeMessage,
    book_appointment,
    check_availability,
    email_confirmation,
    estimate_value,
    get_brokerage_info,
    get_listing,
    note_lead,
    reschedule_appointment,
    search_listings,
    take_message,
)
from .view import view

__all__ = ["realestate"]


realestate: DemoDefinition[RealEstateState] = DemoDefinition(
    id="realestate",
    business_name="Juniper Row Realty",
    agent_name="Miles",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="friendly, easy-going and sharp, a local Austin agent at a relaxed pace",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    vocabulary=["Juniper Row", "Miles", "Austin", "South Congress", "Travis Heights", "Bouldin Creek", "Zilker", "Hyde Park", "Clarksville", "Tarrytown", "Mueller", "Cherrywood", "Crestview", "Allandale", "Westlake", "pre-approved", "showing", "valuation", "townhouse", "condo", "HOA"],
    operations={
        "get_brokerage_info": Operation("Looking up Juniper Row", "The brokerage's areas, hours, office, agents, how showings and valuations work, and its policies. Use before answering any question about the brokerage.", get_brokerage_info, writes=False),
        "note_lead": Operation("Updating the lead record", "Record what the caller has told you about themselves and what they want, so the lead record fills in. Send only what is new or changed.", note_lead, NoteLead, aside=True),
        "search_listings": Operation("Searching listings", "Search our active Austin listings by area, price, bedrooms, bathrooms and type. Returns the total and the best few to read out.", search_listings, SearchListings, writes=False),
        "get_listing": Operation("Opening the listing", "One home's details, by listingId or by the street the caller named.", get_listing, GetListing, writes=False),
        "estimate_value": Operation("Running a value estimate", "A rough value range for the caller's home from comparable homes for sale nearby. Needs the address with the neighbourhood or zip code; bedrooms and square feet make it better.", estimate_value, EstimateValue),
        "check_availability": Operation("Checking the agent's calendar", "Open times on a date (YYYY-MM-DD, Central Time) for a showing of a listing, or a valuation at the caller's home. If that day has none, returns the next openings.", check_availability, CheckAvailability, writes=False),
        "book_appointment": Operation("Booking it", "Book the showing or valuation after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the booking", "Move an existing showing or valuation to a new time from check_availability, after the caller confirmed.", reschedule_appointment, RescheduleAppointment),
        "take_message": Operation("Leaving a message for an agent", "Leave a callback request for the right agent. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the caller", "Email the caller the booked showing or valuation, or a summary of the call (with recap) when nothing was booked, after they confirm the address read back to them.", email_confirmation, EmailConfirmation),
    },
)
