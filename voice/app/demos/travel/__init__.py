"""
Waypoint Travel: a fictional travel agency. Linda works like a travel agent: she finds out what matters
to the caller (price, journey time, time of day, nonstop, airline), runs a real search on Duffel and
offers a labelled short list rather than everything found. Booking then goes as deep as a real one:
fare level, seat (on the airline's seat map), checked bags, traveller, and a full read-back with a live
price check. It stops at payment: the demo runs in Duffel's test mode and never creates an order.
Nothing is purchased or held. Traveller details beyond the caller's name are labelled samples.

Folder: data/*.json (the agency), store.py (the only reader of the data, and the only caller of Duffel),
state.py (one call), prompt.py (Linda's instructions), tools.py (her operations), view.py (the dashboard).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, PAYMENT_LINE, instruction
from .state import TravelState, create_state, duration, money
from .tools import (
    AddBags,
    ChooseFare,
    ChooseSeat,
    EmailItinerary,
    FindPlaces,
    NoArgs,
    OptionRef,
    SearchFlights,
    SetTraveller,
    add_bags,
    book_flight,
    choose_fare,
    choose_flight,
    choose_seat,
    email_itinerary,
    find_places,
    get_seats,
    review_booking,
    search_flights,
    set_traveller,
)
from .view import view

__all__ = ["travel", "duration", "money"]


travel: DemoDefinition[TravelState] = DemoDefinition(
    id="travel",
    business_name="Waypoint Travel",
    agent_name="Linda",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="friendly, warm and efficient, at an easy conversational pace",
    # The whole booking (trip, options, fare, seat, bags, traveller, review, payment, email) needs more than five minutes.
    max_seconds=480,
    fixed_lines=[OPENING_PHONE, OPENING_WEB, PAYMENT_LINE],
    vocabulary=["Waypoint", "Heathrow", "Gatwick", "Stansted", "JFK", "LaGuardia", "Newark", "LAX", "O'Hare", "Lufthansa", "British Airways", "economy", "premium economy", "business class", "first class", "one way", "round trip", "nonstop", "layover", "window", "aisle", "exit row", "checked bag", "carry-on"],
    operations={
        "find_places": Operation("Looking up airports", "Airports and cities matching a name or code, with their codes.", find_places, FindPlaces),
        "search_flights": Operation("Searching flights", "Search airline fares with the caller's preferences. Returns a labelled short list of up to three options.", search_flights, SearchFlights, slow=True),
        "choose_flight": Operation("Checking the fare", "Choose an option from the short list: current price, what the fare includes, and the other fare levels on the same flights.", choose_flight, OptionRef),
        "choose_fare": Operation("Changing the fare", "Switch to another fare level on the same flights.", choose_fare, ChooseFare),
        "get_seats": Operation("Opening the seat map", "The airline's seat map for the first flight: open seats, the best window and aisle, and the exit row, with prices.", get_seats, NoArgs),
        "choose_seat": Operation("Choosing a seat", "Choose a seat by number or by kind (window, aisle, middle, exit row).", choose_seat, ChooseSeat),
        "add_bags": Operation("Adding bags", "Add extra checked bags for the lead traveller, at the airline's price.", add_bags, AddBags),
        "set_traveller": Operation("Adding the traveller", "The lead traveller's full name; the rest is filled with marked samples.", set_traveller, SetTraveller),
        "review_booking": Operation("Reviewing the booking", "Re-check the price live and return the whole booking with the total, to read back.", review_booking, NoArgs),
        "book_flight": Operation("Taking payment", "After the caller confirms the review: complete the booking. In this demo it stops at payment.", book_flight, NoArgs),
        "email_itinerary": Operation("Emailing the itinerary", "Email the reviewed itinerary to the caller, after they confirm the address read back to them. Once per call.", email_itinerary, EmailItinerary),
    },
)
