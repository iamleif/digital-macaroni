"""
Form & Field's business data. The only module that reads data/*.json: the tools ask here, never the
files, so a live install can swap these reads for its real system (Shopify, Square…) without
touching the agent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


_hours = _load("hours.json")
TIME_ZONE: str = _hours["timeZone"]
# Days a reservation is held for pickup.
HOLD_DAYS: int = _hours["holdDays"]
# The shop's hours as the reservation email prints them.
EMAIL_HOURS: str = _hours["emailHours"]

# Everything Theo may tell a caller about the shop, in one place. His instructions carry only what he
# needs to run a call; get_shop_info returns this, and he answers from it.
SHOP: dict[str, Any] = {k: v.format(holdDays=HOLD_DAYS) if k == "pickup" else v for k, v in _load("shop.json").items()}

_catalogue = _load("catalogue.json")
CATEGORIES: tuple[str, ...] = tuple(_catalogue["categories"])
CATALOGUE: list[dict[str, Any]] = _catalogue["products"]

ORDERS: list[dict[str, Any]] = _load("orders.json")["orders"]

# Product pictures for the email: studio photographs where they exist, drawings for the rest.
PHOTOS: set[str] = set(_load("photos.json")["photographed"])


def product(pid: str) -> Optional[dict[str, Any]]:
    return next((p for p in CATALOGUE if p["id"] == pid), None)


def variant_of(vid: str) -> Optional[tuple[dict[str, Any], dict[str, Any]]]:
    for p in CATALOGUE:
        for v in p["variants"]:
            if v["id"] == vid:
                return p, v
    return None
