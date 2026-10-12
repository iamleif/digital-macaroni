"""
Palmetto Stays: a fictional hotel-booking agency in Miami. Marisol works like a good local agent: she
finds out what matters to the caller (the beach or the city, the price, great reviews), runs a real
search on LiteAPI and offers a labelled short list of real hotels with live prices. Booking then goes
as deep as a real one: the hotel's room choices (breakfast, free cancellation), the lead guest, and a
read-back after a live price check and hold. It stops at payment: the demo runs on LiteAPI's sandbox
and never books. Guest details beyond the name are labelled samples.

Folder: data/*.json (the agency), store.py (the only reader of the data, and the only caller of
LiteAPI), state.py (one call), prompt.py (Marisol's instructions), tools.py (her operations),
view.py (the dashboard).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, PAYMENT_LINE, instruction
from .state import HotelState, create_state
from .tools import (
    EmailQuote,
    NoArgs,
    OptionRef,
    RoomRef,
    SearchHotels,
    SetGuest,
    TakeMessage,
    book_stay,
    choose_hotel,
    choose_room,
    email_quote,
    get_agency_info,
    review_stay,
    search_hotels,
    set_guest,
    take_message,
)
from .view import view

__all__ = ["hotels"]


hotels: DemoDefinition[HotelState] = DemoDefinition(
    id="hotels",
    business_name="Palmetto Stays",
    agent_name="Marisol",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="warm, sunny and capable, at an easy conversational pace",
    max_seconds=420,
    fixed_lines=[OPENING_PHONE, OPENING_WEB, PAYMENT_LINE],
    vocabulary=["Palmetto", "Marisol", "Miami Beach", "South Beach", "Brickell", "Ocean Drive", "Collins Avenue", "Biscayne", "check-in", "check-out", "king bed", "queen bed", "suite", "ocean view", "breakfast", "free cancellation", "resort fee"],
    operations={
        "get_agency_info": Operation("Looking up Palmetto Stays", "The agency's hours, the areas we book and our policies. Use before answering any question about the agency itself.", get_agency_info, writes=False),
        "search_hotels": Operation("Searching hotels", "Search real hotels with live prices for the caller's area, dates and guests. Returns a labelled short list of up to three.", search_hotels, SearchHotels, slow=True, writes=False),
        "choose_hotel": Operation("Opening the hotel", "Choose a hotel from the short list: what it offers, what guests say, and its best room choices with live prices.", choose_hotel, OptionRef, slow=True),
        "choose_room": Operation("Choosing the room", "Choose one of the room choices choose_hotel returned.", choose_room, RoomRef),
        "set_guest": Operation("Adding the guest", "The lead guest's full name; the rest is filled with marked samples.", set_guest, SetGuest),
        "review_stay": Operation("Checking the price with the hotel", "Re-check the price live with the hotel and hold it, and return the whole stay with the total, to read back.", review_stay, NoArgs, slow=True),
        "book_stay": Operation("Taking payment", "After the caller confirms the review: complete the booking. In this demo it stops at payment.", book_stay, NoArgs),
        "take_message": Operation("Leaving a message for an agent", "Leave a callback request for a Palmetto Stays agent: several rooms or a group, a stay longer than we book on a call, or anything else a person must handle. Only after the caller confirmed the number.", take_message, TakeMessage),
        "email_quote": Operation("Emailing the caller", "Email the caller the reviewed stay, or a summary of the call (with recap) when there is none, after they confirm the address read back to them.", email_quote, EmailQuote),
    },
)
