"""
Woodward Motor Co.'s data. The only module that reads data/*.json: the tools ask here, never the files,
so a live install can swap these reads for its dealer system (CDK, Tekion, DealerSocket…) without
touching the agent.

The inventory is real: retail listings within 25 miles of Detroit, pulled once from auto.dev
(October 11, 2026) and kept as our own data (data/inventory.json; raw data and photos in
gs://digital-macaroni-demo-data/dealership/). A call never reaches auto.dev.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


BUSINESS: dict[str, Any] = _load("dealership.json")
TIME_ZONE: str = BUSINESS.pop("timeZone")

_staff = _load("staff.json")
SALES: list[dict[str, Any]] = _staff["sales"]
FINANCE: dict[str, str] = _staff["finance"]
SERVICE_ADVISOR: dict[str, str] = _staff["service"]
SPECIALTIES: dict[str, str] = _staff["specialties"]
SHIFTS: dict[str, Any] = _staff["shifts"]
DRIVE_TITLES: tuple[str, ...] = tuple(_staff["titles"])
BUSINESS["team"] = [{"name": s["name"], "role": s["role"]} for s in SALES] + [{"name": FINANCE["name"], "role": FINANCE["role"]}, {"name": SERVICE_ADVISOR["name"], "role": SERVICE_ADVISOR["role"]}]

_service = _load("service.json")
SERVICES: list[dict[str, Any]] = _service["services"]
SERVICE_IDS: tuple[str, ...] = tuple(s["id"] for s in SERVICES)
BUSINESS["service"] = {"menu": [{"service": s["id"], "name": s["name"], "price": s["price"], "minutes": s["minutes"]} for s in SERVICES], "loaners": _service["loaners"], "allMakes": _service["allMakes"]}

_calendar = _load("calendar.json")
DRIVE_HOURS: tuple[int, ...] = tuple(_calendar["testDriveHours"])
SERVICE_HOURS: tuple[int, ...] = tuple(_calendar["serviceHours"])
BAYS: int = _calendar["bays"]
DAYS_AHEAD: int = _calendar["daysAhead"]
CLOSED_WEEKDAYS: frozenset[int] = frozenset(_calendar["closedWeekdays"])
# Each bay's technician shift by weekday, the order openings come round in, and what the other jobs are called.
BAY_SHIFTS: dict[str, list[str]] = _calendar["bayShifts"]
SERVICE_TITLES: tuple[str, ...] = tuple(_calendar["serviceTitles"])
DECK: list[str] = _calendar["deck"]
BAY_DECK: list[str] = _calendar["bayDeck"]

CUSTOMERS: list[dict[str, Any]] = _load("customers.json")["customers"]

_inventory = _load("inventory.json")
CARS: list[dict[str, Any]] = _inventory["cars"]
SNAPSHOT: str = _inventory["snapshot"]
BODIES: tuple[str, ...] = ("SUV", "Car", "Truck", "Van", "Minivan")


def service(sid: str) -> dict[str, Any]:
    return next(s for s in SERVICES if s["id"] == sid)


def salesperson(sid: str) -> dict[str, Any]:
    return next(s for s in SALES if s["id"] == sid)


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def car(stock: str) -> Optional[dict[str, Any]]:
    k = _key(stock)
    return next((c for c in CARS if _key(c["stock"]) == k or c["vin"].lower().endswith(k.lower()) and len(k) >= 6), None)


def search(make: Optional[str], model: Optional[str], body: Optional[str], max_price: Optional[int], min_year: Optional[int], max_miles: Optional[int], color: Optional[str], drivetrain: Optional[str], fuel: Optional[str]) -> list[dict[str, Any]]:
    mk, md, col = _key(make or ""), _key(model or ""), (color or "").lower()
    out = [
        c for c in CARS
        if (not mk or _key(c["make"]) == mk or mk in _key(c["make"]))
        and (not md or md in _key(c["model"]) or md in _key(c["model"] + c["trim"]))
        and (not body or c["body"] == body)
        and (max_price is None or c["price"] <= max_price)
        and (min_year is None or c["year"] >= min_year)
        and (max_miles is None or c["miles"] <= max_miles)
        and (not col or col in (c["color"] or "").lower())
        and (not drivetrain or (drivetrain == "4x4/AWD" and c["drivetrain"] in ("AWD", "4WD")) or c["drivetrain"] == drivetrain)
        and (not fuel or (c["fuel"] or "").lower().startswith(fuel.lower()))
    ]
    # Newest, lowest-mileage first within the budget: what a good salesperson would lead with.
    return sorted(out, key=lambda c: (-c["year"], c["miles"], c["price"]))


def describe_search(c: dict[str, Any]) -> str:
    return f"{c['year']} {c['make']} {c['model']}" + (f" {c['trim']}" if c["trim"] else "")


def specialist(c: Optional[dict[str, Any]]) -> Optional[str]:
    if not c:
        return None
    if c["fuel"] == "Electric":
        return SPECIALTIES.get("Electric")
    return SPECIALTIES.get(c["body"])


def known_customer(name: str) -> Optional[dict[str, Any]]:
    w = set(re.sub(r"[^a-z ]", " ", name.lower()).split())
    return next((c for c in CUSTOMERS if len(w) > 1 and set(c["name"].lower().split()) == w), None)
