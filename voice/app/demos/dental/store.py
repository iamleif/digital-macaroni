"""
Aspen Grove Dental's data. The only module that reads data/*.json: the tools ask here, never the files,
so a live install can swap these reads for its practice system (Open Dental, Dentrix through NexHealth)
without touching the agent.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

_DATA = Path(__file__).parent / "data"


def _load(name: str) -> Any:
    return json.loads((_DATA / name).read_text())


BUSINESS: dict[str, Any] = _load("practice.json")
TIME_ZONE: str = BUSINESS.pop("timeZone")

_p = _load("providers.json")
PROVIDERS: list[dict[str, Any]] = _p["providers"]
OPS: list[dict[str, Any]] = _p["operatories"]

_t = _load("appointment_types.json")
TYPES: list[dict[str, Any]] = _t["types"]
TYPE_IDS: tuple[str, ...] = tuple(t["id"] for t in TYPES)

_ins = _load("insurance.json")
IN_NETWORK: list[str] = _ins["inNetwork"]
ALIASES: dict[str, str] = _ins["aliases"]
OUT_OF_NETWORK: str = _ins["outOfNetwork"]
MEDICAID: str = _ins["medicaid"]

PATIENTS: list[dict[str, Any]] = _load("patients.json")["patients"]
FILL: dict[str, Any] = _load("fill.json")

BUSINESS["visits"] = [{"type": t["id"], "name": t["name"], "minutes": t["minutes"], "price": t["price"]} for t in TYPES]
BUSINESS["team"] = [{"name": p["name"], "role": p["role"]} for p in PROVIDERS]
BUSINESS["insuranceInNetwork"] = IN_NETWORK


def provider(pid: str) -> dict[str, Any]:
    return next(p for p in PROVIDERS if p["id"] == pid)


def op(oid: str) -> dict[str, Any]:
    return next(o for o in OPS if o["id"] == oid)


def visit_type(tid: str) -> dict[str, Any]:
    return next(t for t in TYPES if t["id"] == tid)


def ops_for(kind: str) -> list[str]:
    """Hygiene visits run in the hygienists' chairs; dentist visits in the dentists'."""
    return [o["id"] for o in OPS if provider(o["provider"])["role"] == ("Hygienist" if kind == "hygiene" else "Dentist")]


def carrier(said: str) -> Optional[str]:
    t = said.lower()
    return next((v for k, v in ALIASES.items() if k in t), None)


def find_patient(name: str, dob: str) -> Optional[dict[str, Any]]:
    w = set(re.sub(r"[^a-z' ]", " ", name.lower()).split())
    return next((p for p in PATIENTS if set(p["name"].lower().split()) == w and p["dateOfBirth"] == dob), None)
