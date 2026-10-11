"""
One call's Palmetto Stays booking, and the pure helpers that turn what the hotel source returned into
things Marisol can say: prices, the labelled short list of hotels, and a hotel's best room choices.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from ..types import date_in, date_label
from .store import AREAS, TIME_ZONE

SHORTLIST = 3
STAGES = ["trip", "options", "hotel", "room", "guest", "review", "payment"]
# Hotels with fewer reviews than this never lead as "best rated".
MIN_REVIEWS = 50

Priority = Literal["best", "best_rated", "cheapest"]
AreaId = Literal[tuple(AREAS)]  # type: ignore[valid-type]
LABELS = {"best_rated": "Best rated", "best": "Best value", "cheapest": "Cheapest"}
BOARDS = {"RO": "Room only", "BB": "Breakfast included", "HB": "Half board", "FB": "Full board", "AI": "All inclusive"}
# Facilities worth a mention, in the order a caller cares about them.
HIGHLIGHTS = ["Beachfront", "Private beach", "Outdoor pool", "Swimming pool", "Rooftop pool", "Spa/wellness center", "Fitness center", "Free WiFi", "Restaurant", "Bar", "Room service", "Free parking", "Valet parking", "Airport shuttle", "Pets allowed", "Family rooms"]


@dataclass
class HotelState:
    seed: str
    today: str
    search: Optional[dict[str, Any]] = None
    # The short list the agent offered, numbered as it numbered them. hotelId stays server-side.
    options: list[dict[str, Any]] = field(default_factory=list)
    selected: Optional[int] = None
    hotel: Optional[dict[str, Any]] = None
    # The selected hotel's room choices. offerId and amount stay server-side.
    rooms: list[dict[str, Any]] = field(default_factory=list)
    room: Optional[int] = None
    guest: Optional[dict[str, Any]] = None
    review: Optional[dict[str, Any]] = None
    booking: Optional[dict[str, Any]] = None
    stage: str = "trip"
    # Callback requests for an agent: what the agency can't do on this call (several rooms, a long stay, a person).
    messages: list[dict[str, Any]] = field(default_factory=list)
    seq: int = 0
    # The quote email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None


def create_state(now: datetime) -> HotelState:
    today, _, _ = date_in(TIME_ZONE, now)
    return HotelState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)


# ---- Formatting what the hotel source returned into things the agent can say ----


def money(amount: float, cents: bool = False) -> str:
    return f"${amount:,.2f}" if cents else f"${amount:,.0f}"


def nights_between(checkin: str, checkout: str) -> int:
    return (date.fromisoformat(checkout) - date.fromisoformat(checkin)).days


def stay_label(s: dict[str, Any]) -> str:
    return f"{AREAS[s['area']]['name']} · {date_label(s['checkin'])} to {date_label(s['checkout'])} · {s['nights']} night{'s' if s['nights'] != 1 else ''} · {s['adults']} adult{'s' if s['adults'] != 1 else ''}"


def rate_amount(rate: dict[str, Any]) -> float:
    return float(((rate.get("retailRate") or {}).get("total") or [{}])[0].get("amount") or 0)


def offer_amount(room_type: dict[str, Any]) -> float:
    return float((room_type.get("offerRetailRate") or {}).get("amount") or sum(rate_amount(r) for r in room_type.get("rates") or []))


def refundable(rate: dict[str, Any]) -> bool:
    return (rate.get("cancellationPolicies") or {}).get("refundableTag") == "RFN"


def cancellation(rate: dict[str, Any]) -> str:
    """When a rate stops being free to cancel, from the earliest penalty, e.g. "Free cancellation until Wednesday, October 21"."""
    if not refundable(rate):
        return "Non-refundable"
    infos = [i for i in (rate.get("cancellationPolicies") or {}).get("cancelPolicyInfos") or [] if float(i.get("amount") or 0) > 0 and i.get("cancelTime")]
    if not infos:
        return "Free cancellation"
    first = min(i["cancelTime"] for i in infos)
    return f"Free cancellation until {date_label(first[:10])}"


def board(rate: dict[str, Any]) -> str:
    return BOARDS.get(rate.get("boardType") or "", rate.get("boardName") or "Room only")


def pay_at_hotel(rate: dict[str, Any]) -> Optional[str]:
    """Fees the hotel collects on arrival (resort fees, some taxes), which the price does not include."""
    fees = [f for f in (rate.get("retailRate") or {}).get("taxesAndFees") or [] if not f.get("included") and float(f.get("amount") or 0) > 0]
    if not fees:
        return None
    return " and ".join(f"{(f.get('description') or 'fees').lower()} of {money(float(f['amount']))}" for f in fees) + ", paid at the hotel"


def hotels_with_prices(resp: dict[str, Any]) -> list[dict[str, Any]]:
    """One entry per hotel: its details and its cheapest offer for the stay."""
    info = {h["id"]: h for h in resp.get("hotels") or []}
    out = []
    for r in resp.get("data") or []:
        h = info.get(r.get("hotelId"))
        room_types = r.get("roomTypes") or []
        if not h or not h.get("name") or not room_types:
            continue
        cheapest = min(room_types, key=offer_amount)
        rate = (cheapest.get("rates") or [{}])[0]
        out.append({"hotel": h, "amount": offer_amount(cheapest), "refundable": refundable(rate)})
    return out


def shortlist(hotels: list[dict[str, Any]], priority: str) -> list[tuple[dict[str, Any], str]]:
    """Up to three distinct hotels, each with a label, the caller's priority first."""
    if not hotels:
        return []
    rated = [h for h in hotels if (h["hotel"].get("review_count") or 0) >= MIN_REVIEWS and h["hotel"].get("rating")]
    picks = {
        "cheapest": min(hotels, key=lambda h: h["amount"]),
        "best_rated": max(rated or hotels, key=lambda h: (h["hotel"].get("rating") or 0, h["hotel"].get("review_count") or 0)),
        # Rating points per hundred dollars a night, among hotels guests rate 7.5 or better.
        "best": max([h for h in rated if h["hotel"]["rating"] >= 7.5] or hotels, key=lambda h: (h["hotel"].get("rating") or 0) / max(h["amount"], 1)),
    }
    order = [priority] + [p for p in ("best", "best_rated", "cheapest") if p != priority]
    chosen: list[tuple[dict[str, Any], str]] = []
    for p in order:
        h = picks[p]
        if all(h["hotel"]["id"] != c["hotel"]["id"] for c, _ in chosen):
            chosen.append((h, LABELS[p]))
    # Fill up with the next best rated when two labels picked the same hotel.
    for h in sorted(rated or hotels, key=lambda h: -(h["hotel"].get("rating") or 0)):
        if len(chosen) >= SHORTLIST:
            break
        if all(h["hotel"]["id"] != c["hotel"]["id"] for c, _ in chosen):
            chosen.append((h, "Also good"))
    return chosen[:SHORTLIST]


def summarise(h: dict[str, Any], number: int, label: str, nights: int) -> dict[str, Any]:
    hotel = h["hotel"]
    return {
        "option": number,
        "label": label,
        "hotelId": hotel["id"],
        "name": hotel["name"],
        "stars": hotel.get("stars"),
        "rating": hotel.get("rating"),
        "reviews": hotel.get("review_count"),
        "photo": hotel.get("main_photo"),
        "address": hotel.get("address") or "",
        "total": money(h["amount"]),
        "perNight": money(h["amount"] / max(nights, 1)),
        "refundable": h["refundable"],
    }


def brief(o: dict[str, Any]) -> dict[str, Any]:
    """What the agent hears about one option."""
    return {
        "option": o["option"],
        "label": o["label"],
        "name": o["name"],
        "stars": o["stars"],
        "guestRating": f"{o['rating']} out of 10 from {o['reviews']} reviews" if o["rating"] and o["reviews"] else None,
        "address": o["address"],
        "totalForStay": o["total"],
        "perNight": o["perNight"],
        "freeCancellationAvailable": o["refundable"],
    }


def room_choices(resp: dict[str, Any], nights: int) -> list[dict[str, Any]]:
    """Up to three rooms worth offering: the cheapest, the cheapest free to cancel, the cheapest with breakfast."""
    rates = []
    for r in resp.get("data") or []:
        for rt in r.get("roomTypes") or []:
            for rate in rt.get("rates") or []:
                rates.append({"offerId": rt["offerId"], "amount": offer_amount(rt), "rate": rate})
    if not rates:
        return []
    rates.sort(key=lambda x: x["amount"])
    wanted = [
        ("Lowest price", rates[0]),
        ("Free cancellation", next((x for x in rates if refundable(x["rate"])), None)),
        ("With breakfast", next((x for x in rates if (x["rate"].get("boardType") or "RO") != "RO"), None)),
    ]
    out: list[dict[str, Any]] = []
    for why, x in wanted:
        if x is None or any(o["offerId"] == x["offerId"] for o in out):
            continue
        rate = x["rate"]
        out.append(
            {
                "room": len(out) + 1,
                "why": why,
                "name": rate.get("name") or "Room",
                "board": board(rate),
                "refundable": refundable(rate),
                "cancellation": cancellation(rate),
                "total": money(x["amount"]),
                "perNight": money(x["amount"] / max(nights, 1)),
                "payAtHotel": pay_at_hotel(rate),
                "offerId": x["offerId"],
                "amount": x["amount"],
            }
        )
    return out


def plain(html_text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html_text or "")).strip()


def hotel_panel(d: dict[str, Any], option: dict[str, Any]) -> dict[str, Any]:
    facilities = d.get("hotelFacilities") or d.get("facilities") or []
    times = d.get("checkinCheckoutTimes") or {}
    sentiment = d.get("sentiment_analysis") or {}
    images = sorted(d.get("hotelImages") or [], key=lambda i: (not i.get("defaultImage"), i.get("order") or 0))
    return {
        "name": d.get("name") or option["name"],
        "stars": d.get("starRating") or option["stars"],
        "rating": d.get("rating") or option["rating"],
        "reviews": d.get("reviewCount") or option["reviews"],
        "photos": [i["url"] for i in images if i.get("url")][:4] or ([option["photo"]] if option["photo"] else []),
        "address": f"{d.get('address') or option['address']}, {d.get('city') or 'Miami'}",
        "checkIn": times.get("checkin_start") or "",
        "checkOut": times.get("checkout") or "",
        "highlights": [f for f in HIGHLIGHTS if f in facilities][:6],
        "pros": (sentiment.get("pros") or [])[:3],
        "cons": (sentiment.get("cons") or [])[:3],
    }
