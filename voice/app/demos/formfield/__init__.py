"""
Form & Field: a fictional home-goods shop. The visitor describes what they want, hears about real
catalogue items and stock, and reserves one for pickup. Order lookup and support requests are the
secondary path. No payment, purchase or delivery happens.

Folder: data/*.json (the business), store.py (the only reader of the data), state.py (one call),
prompt.py (Erica's instructions), tools.py (his operations), view.py (the dashboard).
"""

from __future__ import annotations

from ..types import DemoDefinition, Operation
from .prompt import OPENING_PHONE, OPENING_WEB, instruction
from .state import FormFieldState, create_state
from .store import CATALOGUE, PHOTOS
from .tools import (
    CancelReservation,
    CreateSupportRequest,
    EmailReservation,
    GetProductDetails,
    LookupOrder,
    ReserveItem,
    SearchProducts,
    TakeMessage,
    UpdateReservation,
    cancel_reservation,
    create_support_request,
    email_reservation,
    get_product_details,
    get_shop_info,
    lookup_order,
    reserve_item,
    search_products,
    take_message,
    update_reservation,
)
from .view import view

__all__ = ["formfield", "CATALOGUE", "PHOTOS"]


formfield: DemoDefinition[FormFieldState] = DemoDefinition(
    id="formfield",
    business_name="Form & Field",
    agent_name="Erica",
    create_state=create_state,
    instruction=instruction,
    view=view,
    voice_style="warm, easy and quick, a friendly shop assistant",
    fixed_lines=[OPENING_PHONE, OPENING_WEB],
    operations={
        "get_shop_info": Operation("Checking the shop's policies", "Everything about the shop: address, hours, pickup, shipping, local delivery, returns, gift cards and payment. Use before answering any question about the shop.", get_shop_info, writes=False),
        "search_products": Operation("Searching the catalogue", "Find catalogue items. Returns up to five matches with price and stock by option.", search_products, SearchProducts, writes=False),
        "get_product_details": Operation("Checking product details", "Full catalogue facts for one product: description, materials, size and stock by option.", get_product_details, GetProductDetails, writes=False),
        "reserve_item": Operation("Reserving for pickup", "Hold an in-stock option for pickup, after the caller said yes to the read-back.", reserve_item, ReserveItem),
        "update_reservation": Operation("Updating the reservation", "Change the quantity on a reservation made in this call, after the caller confirmed.", update_reservation, UpdateReservation),
        "cancel_reservation": Operation("Cancelling the reservation", "Cancel a reservation made in this call, after the caller confirmed. The stock is released.", cancel_reservation, CancelReservation),
        "lookup_order": Operation("Looking up the order", "Find an order by its number and the email address on it. Both must match.", lookup_order, LookupOrder, writes=False),
        "create_support_request": Operation(
            "Opening a support request",
            "Send a damaged, wrong or missing item report on the matched order to the team for review. Nothing is refunded or replaced automatically.",
            create_support_request,
            CreateSupportRequest,
        ),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request for the shop team.", take_message, TakeMessage),
        "email_reservation": Operation("Emailing the caller", "Email the caller the pickup reservation; or, when they asked about an order and nothing was reserved, the order confirmation with its tracking number (the only way tracking numbers are shared); otherwise a summary of the call (with recap). Only after they confirm the address read back to them.", email_reservation, EmailReservation),
    },
)
