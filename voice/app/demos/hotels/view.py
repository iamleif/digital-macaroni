"""What the Palmetto Stays dashboard shows. Hotel and offer ids, and amounts kept for pricing, stay server-side."""

from __future__ import annotations

from typing import Any

from ..types import date_label
from .state import HotelState, stay_label
from .tools import message_view
from .store import AREAS


def view(state: HotelState) -> dict[str, Any]:
    s = state.search
    return {
        "stage": state.stage,
        "search": (
            {"area": AREAS[s["area"]]["name"], "checkin": s["checkin"], "checkout": s["checkout"], "checkinLabel": date_label(s["checkin"]), "checkoutLabel": date_label(s["checkout"]), "nights": s["nights"], "adults": s["adults"], "label": stay_label(s)}
            if s
            else None
        ),
        "options": [{k: v for k, v in o.items() if k != "hotelId"} for o in state.options],
        "selected": state.selected,
        "hotel": state.hotel,
        "rooms": [{k: v for k, v in r.items() if k not in ("offerId", "amount", "why", "payAtHotel")} for r in state.rooms],
        "room": state.room,
        "guest": state.guest,
        "review": state.review,
        "booking": state.booking,
        "messages": [message_view(m) for m in state.messages],
        "emailed": state.emailed,
    }
