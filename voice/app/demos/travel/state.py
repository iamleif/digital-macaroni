"""
One call's Waypoint booking, and the pure helpers that turn what the airline returned into things
Linda can say: prices, journeys, the labelled short list, fare levels and seat maps.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..types import date_in, date_label
from .store import CURRENCY, TIME_WINDOWS, TIME_ZONE

SHORTLIST = 3
MAX_OPTIONS = 5
STAGES = ["trip", "options", "fare", "seat", "bags", "traveller", "review", "payment"]

Cabin = Literal["economy", "premium_economy", "business", "first"]
Priority = Literal["cheapest", "fastest", "best"]
TimeOfDay = Literal[("any", *TIME_WINDOWS)]  # type: ignore[valid-type]
IATA = r"^[A-Za-z]{3}$"
LABELS = {"cheapest": "Cheapest", "fastest": "Fastest", "best": "Best value"}


@dataclass
class TravelState:
    seed: str
    today: str
    search: Optional[dict[str, Any]] = None
    # The short list the agent offered, numbered as it numbered them. offerId stays server-side.
    options: list[dict[str, Any]] = field(default_factory=list)
    # Every offer from the last search (server-side only): fare levels come from offers on the same flights.
    offers: list[dict[str, Any]] = field(default_factory=list)
    selected: Optional[int] = None
    # The chosen offer as the airline last priced it, with the extras it sells (server-side only).
    offer: Optional[dict[str, Any]] = None
    details: Optional[dict[str, Any]] = None
    fare_levels: list[dict[str, Any]] = field(default_factory=list)
    seat_map: Optional[dict[str, Any]] = None
    # Seat designator -> (service id, amount, currency), server-side only.
    seat_services: dict[str, tuple[str, str, str]] = field(default_factory=dict)
    seat: Optional[dict[str, Any]] = None
    bags: Optional[dict[str, Any]] = None
    traveller: Optional[dict[str, Any]] = None
    review: Optional[dict[str, Any]] = None
    booking: Optional[dict[str, Any]] = None
    # The booking read back to the caller, awaiting their yes (the site's booking card shows it).
    read_back: Optional[dict[str, Any]] = None
    stage: str = "trip"
    # The itinerary email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None
    # Names of places the agent looked up, by code, so the dashboard can say "London" rather than "LON".
    places: dict[str, str] = field(default_factory=dict)


# ---- Formatting what the airline returned into things the agent can say ----


def money(amount: str, currency: str) -> str:
    value = float(amount)
    text = f"{value:,.0f}" if value.is_integer() else f"{value:,.2f}"
    symbol = CURRENCY.get(currency)
    return f"{symbol}{text}" if symbol else f"{text} {currency}"


def duration(iso: Optional[str]) -> str:
    """ISO 8601 durations as Duffel sends them ("PT7H45M", "P1DT2H") to "7h 45m"."""
    if not iso:
        return ""
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?", iso)
    if not m:
        return ""
    days, hours, minutes = (int(g or 0) for g in m.groups())
    hours += days * 24
    return " ".join(p for p in (f"{hours}h" if hours else "", f"{minutes}m" if minutes else "") if p) or "0m"


def clock(local: str) -> str:
    """Duffel's local airport time ("2026-11-20T09:05:00") as "9:05 AM"."""
    t = datetime.fromisoformat(local)
    return t.strftime("%I:%M %p").lstrip("0")


def day(local: str) -> str:
    return date_label(local[:10])


def journey(slice_: dict[str, Any]) -> dict[str, Any]:
    segments = slice_.get("segments") or []
    first, last = segments[0], segments[-1]
    carriers = list(dict.fromkeys((s.get("marketing_carrier") or {}).get("name") or "" for s in segments))
    return {
        "from": first["origin"]["iata_code"],
        "fromName": first["origin"].get("name"),
        "to": last["destination"]["iata_code"],
        "toName": last["destination"].get("name"),
        "date": day(first["departing_at"]),
        "departs": clock(first["departing_at"]),
        "arrives": clock(last["arriving_at"]),
        # Arriving on a later calendar day than it left, in local times.
        "arrivesNextDay": last["arriving_at"][:10] > first["departing_at"][:10],
        "duration": duration(slice_.get("duration")),
        "stops": len(segments) - 1,
        "via": [s["destination"]["iata_code"] for s in segments[:-1]],
        "flights": [f"{(s.get('marketing_carrier') or {}).get('iata_code', '')}{s.get('marketing_carrier_flight_number', '')}" for s in segments],
        "airlines": [c for c in carriers if c],
    }


def summarise(offer: dict[str, Any], number: int) -> dict[str, Any]:
    return {
        "option": number,
        "offerId": offer["id"],
        "airline": (offer.get("owner") or {}).get("name"),
        "airlineLogo": (offer.get("owner") or {}).get("logo_symbol_url"),
        "price": money(offer["total_amount"], offer["total_currency"]),
        "amount": offer["total_amount"],
        "currency": offer["total_currency"],
        "journeys": [journey(s) for s in offer.get("slices") or []],
    }


def _minutes(iso: Optional[str]) -> int:
    d = duration(iso)
    h = re.search(r"(\d+)h", d)
    m = re.search(r"(\d+)m", d)
    return (int(h.group(1)) if h else 0) * 60 + (int(m.group(1)) if m else 0)


def conditions(offer: dict[str, Any]) -> dict[str, str]:
    def rule(c: Optional[dict[str, Any]], verb: str) -> str:
        if not c:
            return "Not stated by the airline"
        if not c.get("allowed"):
            return f"Not {verb}"
        fee = c.get("penalty_amount")
        return f"{verb.capitalize()} for a fee of {money(fee, c.get('penalty_currency') or offer['total_currency'])}" if fee and float(fee) > 0 else f"{verb.capitalize()} free of charge"

    c = offer.get("conditions") or {}
    return {"refund": rule(c.get("refund_before_departure"), "refundable"), "changes": rule(c.get("change_before_departure"), "changeable")}


def baggage(offer: dict[str, Any]) -> str:
    checked = carry = 0
    first = ((offer.get("slices") or [{}])[0].get("segments") or [{}])[0]
    for p in (first.get("passengers") or [])[:1]:
        for b in p.get("baggages") or []:
            if b.get("type") == "checked":
                checked += b.get("quantity", 0)
            elif b.get("type") == "carry_on":
                carry += b.get("quantity", 0)
    parts = [f"{checked} checked bag{'s' if checked != 1 else ''}" if checked else "no checked bags", f"{carry} carry-on" if carry else "no carry-on stated"]
    return ", ".join(parts) + " per traveller"


def flight_key(o: dict[str, Any]) -> str:
    """The flights an offer is for, regardless of fare: the same key means the same seats on the same planes."""
    return "|".join(f"{s['marketing_carrier']['iata_code']}{s['marketing_carrier_flight_number']}{s['departing_at']}" for sl in o["slices"] for s in sl["segments"])


def total_minutes(o: dict[str, Any]) -> int:
    return sum(_minutes(s.get("duration")) for s in o["slices"])


def total_stops(o: dict[str, Any]) -> int:
    return sum(len(s["segments"]) - 1 for s in o["slices"])


def shortlist(offers: list[dict[str, Any]], priority: str = "best", size: int = SHORTLIST) -> list[tuple[dict[str, Any], str]]:
    """
    A travel agent's short list: one offer per set of flights (its cheapest fare), ranked by what the
    caller cares about, each labelled with why it is there (the cheapest, the fastest, the best value).
    """
    cheapest_per_flight: dict[str, dict[str, Any]] = {}
    for o in offers:
        k = flight_key(o)
        if k not in cheapest_per_flight or float(o["total_amount"]) < float(cheapest_per_flight[k]["total_amount"]):
            cheapest_per_flight[k] = o
    unique = list(cheapest_per_flight.values())
    if not unique:
        return []
    low_price = min(float(o["total_amount"]) for o in unique)
    low_time = min(total_minutes(o) for o in unique) or 1

    def value(o: dict[str, Any]) -> float:
        # Price and journey time each relative to the best available; every stop counts against it too.
        return float(o["total_amount"]) / low_price + 0.8 * total_minutes(o) / low_time + 0.15 * total_stops(o)

    rank = {"cheapest": lambda o: (float(o["total_amount"]), total_minutes(o)), "fastest": lambda o: (total_minutes(o), float(o["total_amount"])), "best": value}
    picks: list[tuple[dict[str, Any], str]] = []
    # The caller's priority first, then the other two kinds, then the next best by their priority.
    for kind in [priority, *[k for k in ("cheapest", "fastest", "best") if k != priority]]:
        top = min(unique, key=rank[kind])  # type: ignore[arg-type]
        if all(top is not p for p, _ in picks):
            picks.append((top, LABELS[kind]))
    for o in sorted(unique, key=rank[priority]):  # type: ignore[arg-type]
        if len(picks) >= size:
            break
        if all(o is not p for p, _ in picks):
            picks.append((o, "Also good"))
    return picks[:size]


def brief(o: dict[str, Any]) -> dict[str, Any]:
    """What the agent hears about an option: enough to describe it in a sentence."""

    def leg(j: dict[str, Any]) -> dict[str, Any]:
        return {"date": j["date"], "departs": j["departs"], "from": j["fromName"], "arrives": j["arrives"] + (" next day" if j["arrivesNextDay"] else ""), "to": j["toName"], "stops": j["stops"], "via": j["via"], "duration": j["duration"]}

    out = {"option": o["option"], "label": o.get("label"), "airline": o["airline"], "price": o["price"], "outbound": leg(o["journeys"][0])}
    if len(o["journeys"]) > 1:
        out["return"] = leg(o["journeys"][1])
    return out


def search_label(s: dict[str, Any]) -> str:
    trip = f"{s['origin']} to {s['destination']}, {date_label(s['departureDate'])}"
    return trip + (f", back {date_label(s['returnDate'])}" if s.get("returnDate") else "")


def fare_summary(offer: dict[str, Any]) -> dict[str, Any]:
    first = (offer.get("slices") or [{}])[0]
    return {"brand": first.get("fare_brand_name") or "Standard", "price": money(offer["total_amount"], offer["total_currency"]), "amount": offer["total_amount"], **conditions(offer), "baggage": baggage(offer)}


def extra_bag_service(offer: dict[str, Any]) -> Optional[dict[str, Any]]:
    """The airline's extra checked bag for the first traveller, if it sells one."""
    for s in offer.get("available_services") or []:
        if s.get("type") == "baggage" and (s.get("metadata") or {}).get("type") == "checked":
            return s
    return None


# ---- Seat maps ----


def _seat_position(sections: list[list[dict[str, Any]]], si: int, ci: int) -> str:
    """Window, aisle or middle, from where a seat sits among the row's sections (aisles fall between them)."""
    seats = [i for i, c in enumerate(sections[si]) if "id" in c]
    if not seats:
        return "middle"
    if (si == 0 and ci == seats[0]) or (si == len(sections) - 1 and ci == seats[-1]):
        return "window"
    if (si > 0 and ci == seats[0]) or (si < len(sections) - 1 and ci == seats[-1]):
        return "aisle"
    return "middle"


def compact_seat_map(m: dict[str, Any], currency: str) -> tuple[dict[str, Any], dict[str, tuple[str, str, str]]]:
    """
    One segment's seat map as the dashboard draws it: rows of sections (aisles between sections) of
    cells, each a seat (free, paid with its price, or taken) or a facility (lavatory, galley, exit,
    bassinet, empty). Exit rows are marked so their extra legroom can be offered. Service ids stay here.
    """
    services: dict[str, tuple[str, str, str]] = {}
    cab = (m.get("cabins") or [{}])[0]
    rows: list[dict[str, Any]] = []
    exit_next = False
    for row in cab.get("rows") or []:
        sections: list[list[dict[str, Any]]] = []
        is_exit_marker = False
        for sec in row.get("sections") or []:
            cells: list[dict[str, Any]] = []
            for el in sec.get("elements") or []:
                if el.get("type") == "seat" and el.get("designator"):
                    svc = (el.get("available_services") or [None])[0]
                    if svc is None:
                        cells.append({"id": el["designator"], "st": "taken"})
                    else:
                        amount, cur = svc["total_amount"], svc.get("total_currency") or currency
                        services[el["designator"]] = (svc["id"], amount, cur)
                        cells.append({"id": el["designator"], "st": "free" if float(amount) == 0 else "paid", "price": None if float(amount) == 0 else money(amount, cur)})
                else:
                    if el.get("type") == "exit_row":
                        is_exit_marker = True
                    cells.append({"type": el.get("type") or "empty"})
            sections.append(cells)
        number = next((int(re.match(r"\d+", c["id"]).group()) for sec in sections for c in sec if "id" in c), None)  # type: ignore[union-attr]
        rows.append({"row": number, "exit": exit_next and number is not None, "sections": sections})
        if number is not None:
            exit_next = False
        if is_exit_marker:
            exit_next = True
    return {"cabin": cab.get("cabin_class"), "aisles": cab.get("aisles"), "wings": cab.get("wings"), "rows": rows}, services


def seats_in(seat_map: dict[str, Any]) -> list[dict[str, Any]]:
    """Every bookable seat with its position, row and price."""
    out = []
    for row in seat_map["rows"]:
        for si, sec in enumerate(row["sections"]):
            for ci, c in enumerate(sec):
                if "id" in c and c["st"] != "taken":
                    out.append({"seat": c["id"], "row": row["row"], "position": _seat_position(row["sections"], si, ci), "exitRow": row["exit"], "price": c.get("price") or "free"})
    return out


def seat_suggestions(seat_map: dict[str, Any]) -> dict[str, Any]:
    """What the agent tells the caller: how many seats are open and the best of each kind."""
    open_seats = seats_in(seat_map)

    def best(position: Optional[str] = None, exit_row: bool = False) -> Optional[dict[str, Any]]:
        pool = [s for s in open_seats if (position is None or s["position"] == position) and (not exit_row or s["exitRow"])]
        pool.sort(key=lambda s: (s["price"] != "free", 0 if s["price"] == "free" else float(re.sub(r"[^\d.]", "", s["price"]) or 0), s["row"] or 999))
        return pool[0] if pool else None

    return {
        "openSeats": len(open_seats),
        "freeSeats": sum(1 for s in open_seats if s["price"] == "free"),
        "bestWindow": best("window"),
        "bestAisle": best("aisle"),
        "exitRow": best(exit_row=True),
    }


def create_state(now: datetime) -> TravelState:
    today = date_in(TIME_ZONE, now)[0]
    return TravelState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)
