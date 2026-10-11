"""
The appointment engine for businesses that book people into set times with a named staff member
(salons, med spas, clinics). It owns the calendar: who is busy when, what is open for a service, and
booking, moving and cancelling against it. Each business keeps its own folder (data, rules, prompt,
words on screen) and hands the engine its team, services and hours.

Times are whole hours; a service longer than an hour takes the next hours too. Slot ids carry the
staff member ("2026-10-03T14@maria"), so the agent offers a person and a time together.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from .types import OpContext, OpResult, add_days, date_in, date_label, fail, mask_number, ok, reference, weekday


@dataclass
class Busy:
    staff_id: str
    date: str
    hour: int
    span: int
    title: str
    ref: str
    existing: bool
    name: Optional[str] = None


@dataclass
class Appointment:
    id: str
    service_id: str
    slot_id: str
    staff_id: str
    name: str
    status: Literal["booked", "cancelled"]
    updated_at: str
    changes: int = 0
    # What the business adds to a booking: an add-on, a deposit link, intake forms.
    extras: dict[str, Any] = field(default_factory=dict)


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
class BookingState:
    seed: str
    today: str
    earliest_today_hour: int
    busy: list[Busy] = field(default_factory=list)
    # What the caller has told us, in the business's own fields.
    request: dict[str, Any] = field(default_factory=dict)
    offered: list[str] = field(default_factory=list)
    # The day and openings the board shows: {"date", "slots", "service"}.
    viewing: Optional[dict[str, Any]] = None
    appointments: list[Appointment] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def parse_slot(sid: str) -> Optional[tuple[str, int, str]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})@([a-z0-9_-]+)", sid)
    return (m.group(1), int(m.group(2)), m.group(3)) if m else None


class Calendar:
    def __init__(self, *, prefix: str, time_zone: str, open_hour: int, close_hour: int, closed_weekdays: frozenset[int], days_ahead: int, staff: list[dict[str, Any]], services: list[dict[str, Any]], busy_titles: dict[str, list[str]]):
        self.prefix = prefix
        self.time_zone = time_zone
        self.open_hour, self.close_hour = open_hour, close_hour
        self.closed_weekdays = closed_weekdays
        self.days_ahead = days_ahead
        self.staff = staff
        self.services = services
        # Titles for other clients' bookings on each person's calendar, so the board looks like a real day.
        self.busy_titles = busy_titles

    # ---- Lookups ----

    def service(self, sid: str) -> dict[str, Any]:
        return next(s for s in self.services if s["id"] == sid)

    def person(self, pid: str) -> dict[str, Any]:
        return next(p for p in self.staff if p["id"] == pid)

    def short(self, pid: str) -> str:
        """How the team says the name: "Maria", "Dr. Lee"."""
        return self.person(pid)["short"]

    def span(self, sid: str) -> int:
        return max(1, math.ceil(self.service(sid)["minutes"] / 60))

    def hours(self) -> list[int]:
        return list(range(self.open_hour, self.close_hour))

    def bookable_days(self, state: BookingState) -> list[str]:
        return [d for d in (add_days(state.today, i) for i in range(self.days_ahead)) if weekday(d) not in self.closed_weekdays]

    def describe(self, sid: str) -> dict[str, str]:
        day, hour, pid = parse_slot(sid)  # type: ignore[misc]
        return {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour), "with": self.person(pid)["name"]}

    # ---- The calendar ----

    def create_state(self, now: datetime) -> BookingState:
        today, hour, minute = date_in(self.time_zone, now)
        state = BookingState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (2 if minute > 0 else 1))
        n = 0
        today_ord = datetime.fromisoformat(today).toordinal()
        for day in self.bookable_days(state):
            di = datetime.fromisoformat(day).toordinal() - today_ord
            for pi, p in enumerate(self.staff):
                titles = self.busy_titles.get(p["id"]) or ["Booked"]
                h = self.open_hour
                while h < self.close_hour:
                    if (di * 5 + h * 3 + pi * 7) % 4 == 0:
                        span = 2 if (di + h + pi) % 5 == 0 and h + 1 < self.close_hour else 1
                        state.busy.append(Busy(p["id"], day, h, span, titles[(di + h + pi) % len(titles)], f"existing-{n}", True))
                        n += 1
                        h += span
                    else:
                        h += 1
        return state

    def free(self, state: BookingState, pid: str, day: str, hour: int, span: int, ignore_ref: Optional[str] = None) -> bool:
        if hour + span > self.close_hour:
            return False
        for b in state.busy:
            if b.staff_id == pid and b.date == day and b.ref != ignore_ref and b.hour < hour + span and hour < b.hour + b.span:
                return False
        return True

    def open_slots(self, state: BookingState, service_id: str, day: str, staff_id: Optional[str] = None, ignore_ref: Optional[str] = None) -> list[str]:
        if day not in self.bookable_days(state):
            return []
        s = self.service(service_id)
        who = [p for p in s["staff"] if staff_id in (None, p)]
        span = self.span(service_id)
        out = []
        for h in self.hours():
            if day == state.today and h < state.earliest_today_hour:
                continue
            for pid in who:
                if self.free(state, pid, day, h, span, ignore_ref):
                    out.append(f"{day}T{h:02d}@{pid}")
        return out

    # ---- Operations the businesses wrap ----

    def check(self, state: BookingState, service_id: str, date: str, staff_id: Optional[str], part_of_day: Optional[str]) -> OpResult:
        s = self.service(service_id)
        if staff_id and staff_id not in s["staff"]:
            return fail("wrong_person", f"{self.person(staff_id)['name']} doesn't do {s['name']}. It's done by " + " or ".join(self.person(p)["name"] for p in s["staff"]) + ".")
        days = self.bookable_days(state)
        if date < state.today or date > days[-1]:
            return fail("outside_calendar", f"Bookings open from today to {date_label(days[-1])}.")

        def in_part(sid: str) -> bool:
            h = parse_slot(sid)[1]  # type: ignore[index]
            return h < 12 if part_of_day == "morning" else h >= 12 if part_of_day == "afternoon" else True

        exact = [x for x in self.open_slots(state, service_id, date, staff_id) if in_part(x)]
        state.viewing = {"date": date, "slots": exact, "service": service_id}
        if exact:
            # Spread across the day and the team rather than three back-to-back hours with one person.
            picked = exact[:: max(1, len(exact) // 3)][:3]
            state.offered = list(dict.fromkeys(state.offered + picked))
            return ok(f"{len(exact)} open on {date_label(date)}", {"day": date_label(date), "available": [self.describe(x) for x in picked]}, True)
        later: list[str] = []
        for d in (d for d in days if d > date):
            later += [x for x in self.open_slots(state, service_id, d, staff_id) if in_part(x)][:2]
            if len(later) >= 3:
                break
        picked = later[:3]
        state.offered = list(dict.fromkeys(state.offered + picked))
        if picked:
            first = picked[0][:10]
            state.viewing = {"date": first, "slots": [x for x in self.open_slots(state, service_id, first, staff_id) if in_part(x)], "service": service_id}
        reason = "closed" if weekday(date) in self.closed_weekdays else "fully_booked"
        return ok(f"Nothing on {date_label(date)} · next openings found" if picked else "Nothing available", {"day": date_label(date), "available": [], "reason": reason, "nextAvailable": [self.describe(x) for x in picked]}, True)

    def book(self, state: BookingState, slot_id: str, service_id: str, name: str, ctx: OpContext, extras: Optional[dict[str, Any]] = None) -> OpResult:
        live = self.active(state)
        same = next((a for a in live if a.slot_id == slot_id and a.service_id == service_id), None)
        if same:
            return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True, "confirmation": self.confirm_text(same)})
        if live:
            return fail("already_booked", "This caller already has a booking in this call. Use reschedule_appointment to change it.", {"appointmentId": live[0].id, "confirmation": self.confirm_text(live[0])})
        if slot_id not in state.offered:
            return fail("slot_not_offered", "That time was not offered. Check availability first.")
        day, hour, pid = parse_slot(slot_id)  # type: ignore[misc]
        if pid not in self.service(service_id)["staff"]:
            return fail("wrong_service", "That time was offered for a different service. Check availability for this one.")
        span = self.span(service_id)
        if not self.free(state, pid, day, hour, span):
            alternatives = self.open_slots(state, service_id, day)[:3]
            state.offered = list(dict.fromkeys(state.offered + alternatives))
            return fail("slot_taken", "That time has just been taken.", {"alternatives": [self.describe(x) for x in alternatives]})
        aid = reference(self.prefix, state.seq, state.seed)
        state.seq += 1
        state.busy.append(Busy(pid, day, hour, span, self.service(service_id)["name"], aid, False, name.strip()))
        state.appointments.append(Appointment(aid, service_id, slot_id, pid, name.strip(), "booked", ctx.now.isoformat(), extras=extras or {}))
        state.request.pop("proposedSlotId", None)
        state.viewing = {"date": day, "slots": self.open_slots(state, service_id, day), "service": service_id}
        return ok(f"Booked · {aid}", {"appointmentId": aid, "with": self.person(pid)["name"]}, True)

    def move(self, state: BookingState, appointment_id: str, new_slot_id: str, ctx: OpContext) -> OpResult:
        a = next((a for a in self.active(state) if a.id == appointment_id), None)
        if not a:
            return fail("not_found", "There is no booking with that reference in this call.")
        if a.slot_id == new_slot_id:
            return ok(f"Already at that time · {a.id}", {"appointmentId": a.id, "unchanged": True})
        if new_slot_id not in state.offered:
            return fail("slot_not_offered", "That time was not offered. Check availability first.")
        day, hour, pid = parse_slot(new_slot_id)  # type: ignore[misc]
        if pid not in self.service(a.service_id)["staff"] or not self.free(state, pid, day, hour, self.span(a.service_id), a.id):
            return fail("slot_taken", "That time is no longer free.")
        b = next(b for b in state.busy if b.ref == a.id)
        b.staff_id, b.date, b.hour = pid, day, hour
        a.slot_id, a.staff_id, a.updated_at, a.changes = new_slot_id, pid, ctx.now.isoformat(), a.changes + 1
        state.viewing = {"date": day, "slots": self.open_slots(state, a.service_id, day), "service": a.service_id}
        s = self.describe(new_slot_id)
        return ok(f"Moved · {a.id}", {"appointmentId": a.id, "newTime": f"{s['day']} at {s['time']}", "with": s["with"]}, True)

    def cancel(self, state: BookingState, appointment_id: str, ctx: OpContext) -> OpResult:
        a = next((a for a in state.appointments if a.id == appointment_id), None)
        if not a:
            return fail("not_found", "There is no booking with that reference in this call.")
        if a.status == "cancelled":
            return ok(f"Already cancelled · {a.id}", {"appointmentId": a.id, "unchanged": True})
        state.busy = [b for b in state.busy if b.ref != a.id]
        a.status, a.updated_at = "cancelled", ctx.now.isoformat()
        return ok(f"Cancelled · {a.id}", {"appointmentId": a.id, "cancelled": True}, True)

    def message(self, state: BookingState, name: str, number: str, summary: str, preferred: Optional[str], urgent: bool, ctx: OpContext) -> OpResult:
        dup = next((m for m in state.messages if m.summary == summary.strip() and m.name == name.strip()), None)
        if dup:
            return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
        mid = reference("MSG", state.seq, state.seed)
        state.seq += 1
        state.messages.append(Message(mid, name.strip(), number.strip(), summary.strip(), (preferred or "").strip() or None, ctx.now.isoformat(), urgent))
        return ok(f"Message for the team · {mid}", {"messageId": mid}, True)

    def active(self, state: BookingState) -> list[Appointment]:
        return [a for a in state.appointments if a.status == "booked"]

    def confirm_text(self, a: Appointment) -> str:
        s = self.describe(a.slot_id)
        return f"{self.service(a.service_id)['name']} with {s['with']} on {s['day']} at {s['time']}. Reference {a.id}."

    # ---- The board (AppointmentView on the website) ----

    def view(self, state: BookingState, *, skin: str, time_zone_label: str, request: list[dict[str, Any]], extras: Optional[dict[str, Any]], agent: str) -> dict[str, Any]:
        days = self.bookable_days(state)
        live = self.active(state)
        focus = (state.viewing or {}).get("date") or (live[0].slot_id[:10] if live else add_days(state.today, 1))
        day = focus if focus in days else days[0]
        v = state.viewing
        opened = []
        if v and v["date"] == day:
            for sid in v["slots"]:
                _, h, pid = parse_slot(sid)  # type: ignore[misc]
                opened.append({"staffId": pid, "hour": h})
        proposed = state.request.get("proposedSlotId")
        prop = parse_slot(proposed) if proposed else None
        chosen = state.request.get("serviceId") or (live[-1].service_id if live else None)
        return {
            "skin": skin,
            "timeZone": time_zone_label,
            "day": {"label": date_label(day)},
            "staff": [{"id": p["id"], "name": p["short"], "role": p["role"]} for p in self.staff],
            "hours": [{"hour": h, "label": hour_label(h)} for h in self.hours()],
            "schedule": [
                {"staffId": b.staff_id, "hour": b.hour, "span": b.span, "kind": "existing" if b.existing else "demo", "title": b.title, **({"ref": b.ref, "name": b.name} if not b.existing else {})}
                for b in state.busy if b.date == day and (b.existing or any(a.id == b.ref and a.status == "booked" for a in state.appointments))
            ],
            "open": opened,
            "proposed": {"staffId": prop[2], "hour": prop[1]} if prop and prop[0] == day else None,
            "menu": [{"id": s["id"], "name": s["name"], "price": s["priceLabel"], "minutes": s["minutes"], "staff": [self.person(p)["short"] for p in s["staff"]], "group": s["group"], "chosen": s["id"] == chosen} for s in self.services if not s.get("hidden")],
            "request": request,
            "extras": extras,
            "appointments": [
                {"id": a.id, "status": a.status, "service": self.service(a.service_id)["name"] + (f" + {a.extras['addOn']}" if a.extras.get("addOn") else ""), "when": f"{self.describe(a.slot_id)['day']}, {self.describe(a.slot_id)['time']}", "staff": self.person(a.staff_id)["short"], "name": a.name, "changes": a.changes}
                for a in state.appointments
            ],
            "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "urgent": m.urgent} for m in state.messages],
            "emailed": state.emailed,
            "agent": agent,
        }
