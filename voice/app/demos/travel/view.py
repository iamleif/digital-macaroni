"""What the Waypoint dashboard shows. Offer and service ids, and amounts kept for pricing, stay server-side."""

from __future__ import annotations

from typing import Any

from .state import TravelState, search_label
from .tools import message_view


def view(state: TravelState) -> dict[str, Any]:
    return {
        "stage": state.stage,
        "search": ({**state.search, "label": search_label(state.search), "originName": state.places.get(state.search["origin"]), "destinationName": state.places.get(state.search["destination"])} if state.search else None),
        "options": [{k: v for k, v in o.items() if k != "offerId"} for o in state.options],
        "selected": state.selected,
        "details": state.details,
        "fareLevels": [{k: v for k, v in lv.items() if k != "offerId"} for lv in state.fare_levels],
        "seatMap": state.seat_map,
        "seat": state.seat and {k: v for k, v in state.seat.items() if k not in ("amount", "currency")},
        "bags": state.bags and {k: v for k, v in state.bags.items() if k != "amount"},
        "traveller": state.traveller,
        "review": state.review and {k: v for k, v in state.review.items() if k != "amount"},
        "readBack": state.read_back,
        "booking": state.booking,
        "messages": [message_view(m) for m in state.messages],
        "emailed": state.emailed,
    }
