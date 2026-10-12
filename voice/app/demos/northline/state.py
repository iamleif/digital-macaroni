"""
One call's Northline: the schedule, the request card, bookings and messages. Availability comes
from a small schedule generated relative to the session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from ..booking import day_fullness, day_rng
from ..types import add_days, date_in, date_label, weekday
from .store import CLOSED_WEEKDAYS, DAYS_AHEAD, SERVICE_IDS, SERVICES, TECHNICIANS, TIME_ZONE, WINDOWS, service

ServiceId = Literal[SERVICE_IDS]  # type: ignore[valid-type]


@dataclass
class Job:
    id: str
    tech_id: str
    date: str
    hour: int
    service_id: str
    # Jobs already on the schedule belong to other (fictional) customers and show no details.
    existing: bool


@dataclass
class Appointment:
    id: str
    job_id: str
    slot_id: str
    service_id: str
    name: str
    address: str
    issue: str
    status: Literal["booked", "cancelled"]
    tech_id: str
    updated_at: str
    history: list[dict[str, str]]


@dataclass
class Message:
    id: str
    name: str
    callback_number: str
    summary: str
    preferred_time: Optional[str]
    created_at: str
    urgent: bool = False


@dataclass
class NorthlineState:
    seed: str
    today: str
    # Earliest bookable hour today, in the business's time zone.
    earliest_today_hour: int
    jobs: list[Job] = field(default_factory=list)
    request: dict[str, str] = field(default_factory=dict)
    # Slots the agent has actually offered; only these can be booked.
    offered: list[str] = field(default_factory=list)
    # The date and slots the dashboard is showing.
    viewing: Optional[dict[str, Any]] = None
    appointments: list[Appointment] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    # The confirmation email, once sent: only a masked address is kept.
    emailed: Optional[dict[str, Any]] = None


def slot_id(day: str, hour: int) -> str:
    return f"{day}T{hour:02d}"


def parse_slot(sid: str) -> Optional[tuple[str, int]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})", sid)
    return (m.group(1), int(m.group(2))) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1}{' AM' if h < 12 else ' PM'}"


def window_label(h: int) -> str:
    start_suffix = "" if (h < 12) == (h + 2 < 12) else (" AM" if h < 12 else " PM")
    return f"{((h + 11) % 12) + 1}{start_suffix}–{hour_label(h + 2)}"


def bookable_days(state: NorthlineState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in CLOSED_WEEKDAYS]


def free_tech(state: NorthlineState, day: str, hour: int, skill: str, ignore_job_id: Optional[str] = None) -> Optional[str]:
    for t in TECHNICIANS:
        if skill not in t["skills"]:
            continue
        busy = any(j.tech_id == t["id"] and j.date == day and j.hour == hour and j.id != ignore_job_id for j in state.jobs)
        if not busy:
            return t["id"]
    return None


def open_slots(state: NorthlineState, day: str, skill: str, ignore_job_id: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    return [slot_id(day, h) for h in WINDOWS if (day != state.today or h >= state.earliest_today_hour) and free_tech(state, day, h, skill, ignore_job_id)]


def describe_slot(sid: str) -> dict[str, str]:
    day, hour = parse_slot(sid)  # type: ignore[misc]
    return {"slotId": sid, "date": day, "day": date_label(day), "window": window_label(hour)}


def create_state(now: datetime) -> NorthlineState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = NorthlineState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (3 if minute > 0 else 2))
    # Other customers' jobs: deterministic per calendar date (not per call), busier on Fridays and Saturdays,
    # lighter mid-week, with different technicians busy in different windows.
    n = 0
    for day in bookable_days(state):
        fullness = day_fullness("NL", day)
        jobs: list[Job] = []
        for t in TECHNICIANS:
            r = day_rng("NL", day, t["id"])
            mine = min(0.9, max(0.1, fullness - 0.15 + r.uniform(-0.2, 0.2)))
            kinds = [s["id"] for s in SERVICES if s["skill"] in t["skills"]]
            for h in WINDOWS:
                if r.random() < mine:
                    jobs.append(Job(id="", tech_id=t["id"], date=day, hour=h, service_id=r.choice(kinds), existing=True))
        # Every kind of work keeps at least one opening a day.
        r = day_rng("NL", day, "room")
        for skill in {s["skill"] for s in SERVICES}:
            while not any(any(skill in t["skills"] and not any(j.tech_id == t["id"] and j.hour == h for j in jobs) for t in TECHNICIANS) for h in WINDOWS):
                owners = [j for j in jobs if skill in next(t for t in TECHNICIANS if t["id"] == j.tech_id)["skills"]]
                if not owners:
                    break
                jobs.remove(r.choice(owners))
        for j in jobs:
            j.id = f"existing-{n}"
            n += 1
        state.jobs += jobs
    return state


# Words that name a trade, a system or a kind of visit without saying what is wrong with it.
# An issue made only of these ("heating and cooling", "HVAC problem", "furnace repair") is a
# category, not a symptom; anything left over ("not", "noise", "leaking", "cold") is information.
UMBRELLA = set(
    "a an and or the my our some kind of sort type with for to in on it its it's is i we need needs want wants probably maybe possibly "
    "just something thing stuff general not_sure unsure help hvac heating heat cooling cool air ac a/c conditioning conditioner system "
    "unit furnace boiler pump thermostat problem problems issue issues trouble service repair repairs fix check look appointment visit".split()
)


def issue_is_vague(issue: str) -> bool:
    words = [w for w in re.split(r"[^a-z/_']+", issue.lower().replace("not sure", "not_sure")) if w]
    return all(w in UMBRELLA for w in words)


def active(state: NorthlineState) -> list[Appointment]:
    return [a for a in state.appointments if a.status == "booked"]


def confirm_text(a: Appointment) -> str:
    s = describe_slot(a.slot_id)
    return f"{service(a.service_id)['name']} on {s['day']}, arrival between {s['window']}, at {a.address}. Reference {a.id}."


SERVICE_HELP = (
    "One of: "
    + ", ".join(f"{s['id']} ({s['name']})" for s in SERVICES)
    + ". Choose only once the caller has said which system and what is wrong, or asked for a tune-up or estimate outright."
)
ISSUE_HELP = 'What the caller has noticed, close to their own words, e.g. "furnace runs but the house isn\'t warming up". Never just a category like "heating repair" or "HVAC issue".'
DATE_HELP = "The day the caller asked for, YYYY-MM-DD."
