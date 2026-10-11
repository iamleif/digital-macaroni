"""
One call's Form & Field: what is on show, reservations held against stock, the matched order,
support requests and messages. Stock shown is the catalogue's stock minus what this call has held.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..types import date_in, date_label
from .store import CATEGORIES, TIME_ZONE, variant_of

Category = Literal[CATEGORIES]  # type: ignore[valid-type]


@dataclass
class Reservation:
    id: str
    variant_id: str
    quantity: int
    name: str
    status: Literal["reserved", "cancelled"]
    pickup_by: str
    updated_at: str


@dataclass
class FormFieldState:
    seed: str
    today: str
    # Units held by reservations made in this session, by variant. Stock shown is stock minus held.
    held: dict[str, int] = field(default_factory=dict)
    shown: list[str] = field(default_factory=list)
    focus: Optional[str] = None
    reservations: list[Reservation] = field(default_factory=list)
    matched_order: Optional[str] = None
    support_requests: list[dict[str, str]] = field(default_factory=list)
    messages: list[dict[str, str]] = field(default_factory=list)
    seq: int = 0
    # The reservation email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None


def available(state: FormFieldState, v: dict[str, Any]) -> int:
    return v["stock"] - state.held.get(v["id"], 0)


def price(n: int) -> str:
    return f"${n}"


def variant_view(state: FormFieldState, v: dict[str, Any]) -> dict[str, Any]:
    return {"variantId": v["id"], "option": v["option"], "inStock": available(state, v)}


def reservation_text(r: Reservation) -> str:
    p, v = variant_of(r.variant_id)  # type: ignore[misc]
    return f"{r.quantity} × {p['name']} in {v['option']}, held for {r.name} until closing on {date_label(r.pickup_by)}. Reference {r.id}."


def _words(s: str) -> list[str]:
    return [re.sub(r"s$", "", w) for w in re.split(r"[^a-z]+", s.lower()) if len(w) > 2]


def score(p: dict[str, Any], query: Optional[str], category: Optional[str], color: Optional[str], max_price: Optional[float]) -> int:
    if category and p["category"] != category:
        return 0
    if max_price is not None and p["price"] > max_price:
        return 0
    if color and not any(color.lower() in c or c in color.lower() for c in p["colors"]):
        return 0
    if not query:
        return 1
    vocabulary = set(_words(f"{p['name']} {p['category']} {p['description']} {' '.join(p['colors'])}"))
    return sum(1 for w in _words(query) if w in vocabulary)


def create_state(now: datetime) -> FormFieldState:
    today = date_in(TIME_ZONE, now)[0]
    return FormFieldState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today)
