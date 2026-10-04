"""
Northline Home Services: a fictional heating, cooling and plumbing company. The visitor books a
service visit, changes it, cancels it, or leaves a callback request. Availability comes from a
small schedule generated relative to the session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .types import (
    Confirmed,
    DemoDefinition,
    OpContext,
    OpResult,
    Operation,
    add_days,
    date_in,
    date_label,
    fail,
    mask_number,
    ok,
    reference,
    weekday,
)

TIME_ZONE = "America/Chicago"
WINDOWS = (8, 10, 12, 14, 16)
DAYS_AHEAD = 7

TECHNICIANS = [
    {"id": "maya", "name": "Maya Ortiz", "skills": ("heating", "cooling")},
    {"id": "sam", "name": "Sam Becker", "skills": ("plumbing",)},
    {"id": "jordan", "name": "Jordan Lee", "skills": ("heating", "plumbing", "cooling")},
]

SERVICES = [
    {"id": "heating_repair", "name": "Heating repair", "skill": "heating", "fee": 89, "about": "Furnace, boiler or heat pump not heating, strange noises, or the system cycling on and off."},
    {"id": "cooling_repair", "name": "Cooling repair", "skill": "cooling", "fee": 89, "about": "Air conditioning not cooling, leaking, or not turning on."},
    {"id": "plumbing_repair", "name": "Plumbing repair", "skill": "plumbing", "fee": 79, "about": "Leaks, clogged drains, running toilets, low water pressure."},
    {"id": "water_heater", "name": "Water heater service", "skill": "plumbing", "fee": 79, "about": "No hot water, leaking tank, pilot light problems."},
    {"id": "heating_tune_up", "name": "Heating tune-up", "skill": "heating", "fee": 129, "about": "Furnace, boiler or heat pump check and cleaning before winter. Flat price, not a call-out fee."},
    {"id": "cooling_tune_up", "name": "AC tune-up", "skill": "cooling", "fee": 129, "about": "Air conditioner check and cleaning before summer. Flat price, not a call-out fee."},
    # Both HVAC technicians quote new systems, so either skill finds the same people.
    {"id": "replacement_estimate", "name": "New system estimate", "skill": "heating", "fee": 0, "about": "An in-home quote for a new furnace, air conditioner or heat pump. Free."},
]
ServiceId = Literal["heating_repair", "cooling_repair", "plumbing_repair", "water_heater", "heating_tune_up", "cooling_tune_up", "replacement_estimate"]
# Booked on request alone; every other service needs what the caller has actually noticed.
NO_SYMPTOM_NEEDED = {"heating_tune_up", "cooling_tune_up", "replacement_estimate"}


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


def service(sid: str) -> dict[str, Any]:
    return next(s for s in SERVICES if s["id"] == sid)


def tech_name(tid: str) -> str:
    return next((t["name"] for t in TECHNICIANS if t["id"] == tid), tid)


def first_name(tid: str) -> str:
    return tech_name(tid).split(" ")[0]


def bookable_days(state: NorthlineState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) != 0]  # Closed Sundays.


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
    # Other customers' jobs: deterministic per day, roughly a third of each technician's windows.
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        day_index = datetime.fromisoformat(day).toordinal() - today_ord
        for wi, h in enumerate(WINDOWS):
            for ti, t in enumerate(TECHNICIANS):
                busy = (day_index * 7 + wi * 2 + ti * 5) % 3 == 0 or (day_index == 1 and h == 12)
                if busy:
                    svc = "plumbing_repair" if "plumbing" in t["skills"] and ti == 1 else "heating_repair"
                    state.jobs.append(Job(id=f"existing-{n}", tech_id=t["id"], date=day, hour=h, service_id=svc, existing=True))
                    n += 1
    return state


# Words that name a trade, a system or a kind of visit without saying what is wrong with it.
# An issue made only of these ("heating and cooling", "HVAC problem", "furnace repair") is a
# category, not a symptom; anything left over ("not", "noise", "leaking", "cold") is information.
UMBRELLA = set(
    "a an and or the my our some kind of sort type with for to in on it its it's is i we need needs want wants probably maybe possibly "
    "just something thing stuff general not_sure unsure help hvac heating heat cooling cool air ac a/c conditioning conditioner system "
    "unit furnace boiler pump thermostat plumbing problem problems issue issues trouble service repair repairs fix check look appointment visit".split()
)


def issue_is_vague(issue: str) -> bool:
    words = [w for w in re.split(r"[^a-z/_']+", issue.lower().replace("not sure", "not_sure")) if w]
    return all(w in UMBRELLA for w in words)


SERVICE_HELP = (
    "One of: "
    + ", ".join(f"{s['id']} ({s['name']})" for s in SERVICES)
    + ". Choose only once the caller has said which system and what is wrong, or asked for a tune-up or estimate outright."
)
ISSUE_HELP = 'What the caller has noticed, close to their own words, e.g. "furnace runs but the house isn\'t warming up". Never just a category like "heating repair" or "HVAC issue".'
DATE_HELP = "The day the caller asked for, YYYY-MM-DD."


def active(state: NorthlineState) -> list[Appointment]:
    return [a for a in state.appointments if a.status == "booked"]


def confirm_text(a: Appointment) -> str:
    s = describe_slot(a.slot_id)
    return f"{service(a.service_id)['name']} on {s['day']}, arrival between {s['window']}, at {a.address}. Reference {a.id}."


def instruction(state: NorthlineState, ctx: OpContext) -> str:
    today = date_label(state.today)
    return f"""You are Ellie. You answer the phone for Northline Home Services, a heating, cooling and plumbing company. You work for Northline; speak as part of its team ("we", "our technicians").

Behind the scenes, and not something to mention unless asked: this line is a demonstration. Bookings and messages are sample records, and no technician will actually visit or call. If a caller asks directly whether you are a real person, answer honestly and briefly that you are Northline's AI assistant. If they ask directly whether this is a real business or a real booking, say briefly that this is a demo line and nothing will actually be scheduled, then carry on helping.

Today is {today} ({state.today}), Central Time. Use this to resolve "today", "tomorrow" and weekdays.

How you speak: warm, calm and reassuring, like a capable dispatcher who has done this a thousand times. Short sentences. One question per turn. Never read out ids, slot codes or anything in brackets. No more than three options at once. If you are interrupted, stop and listen.

Say each thing once:
- Never turn the caller's words back into a question ("Did you need a heating and cooling appointment?") and never restate what they just told you before asking your next question. A brief, varied acknowledgement is enough ("Okay." "Oh, that's no fun in this weather."), then move on.
- Don't say you can book something until you have checked availability.
- Give the full day and date once, when you first offer a time ("Saturday the fourth, between two and four"); after that, "Saturday, two to four" is enough.
- Never announce that you are noting, saving, checking or updating something unless the caller has to wait. After a tool result, say only what the caller needs to hear next.

Opening on a phone call: exactly "Thanks for calling Northline, this is Ellie. If you're following along on our website, type the four-digit code on your screen, or just read it to me. Otherwise, how can I help?" Nothing more.
Opening in a website conversation: exactly "Thanks for calling Northline, this is Ellie. How can I help?" Nothing more.

Finding the right visit. Before checking availability you need two things: which service fits, and what the caller has actually noticed.
- "Heating and cooling", "HVAC", "my system", "the air" and "something with the heat" are not a service. When the caller is vague or unsure, ask one short question to sort it, such as "Is it the heat, the air conditioning, or are you after a tune-up or a quote on a new system?"
- Once you know which system, ask what they have noticed: no heat or cool air, weak airflow, a noise, a leak, or it keeps turning on and off. Skip this if they have already said.
- A plain request needs no symptom: "a furnace tune-up", "a quote for a new AC".
- You are not a technician. Don't diagnose, guess at causes, suggest fixes or promise what the visit will find. Ask about what they see, hear or smell, never about parts.
- For a heating problem, ask once whether they smell gas or have a carbon monoxide alarm going off.

Booking, in this order: the service and what they've noticed, as above; when suits them; check_availability for that day and offer what it returned; the caller's name and the service address. When they pick a time, read it all back once in one sentence (the service, day and window, name and address) and ask whether to book it. On a clear yes, call book_appointment with callerConfirmed true. Then say only what is new: the reference, and that the technician will call half an hour before arriving. Don't repeat what you just read back.

Keeping the request card current: note_request_details is instant and its result needs no comment. Call it at most once per caller turn, with everything new from that turn, then say what you were going to say. Record the service only once it is settled, and the issue in the caller's words, never a category. When they choose a time, record it as proposedSlotId.

Other things you can do, always through your tools:
- Answer questions about services, fees, hours and area with get_business_info. Never invent prices, policies or services.
- Change or cancel a booking made in this call: check_availability for the new time, then reschedule_appointment or cancel_appointment once the caller has confirmed. If they have already clearly said yes to a specific new time, that is the confirmation; don't ask again. A change moves the same appointment; never book a second one.
- Take a message for a callback with take_message when they prefer a call back, nothing suitable is available, or you cannot help. Ask for a name. On a phone call, use get_caller_number and ask whether the number they are calling from (say only its last four digits) is the best one to reach them; otherwise ask for a number, and suggest the sample number 555-0142 if they would rather not give theirs.

Rules: never say something is booked, moved or cancelled unless the tool returned ok true. For a callback, call take_message only after the caller has confirmed the number. If a tool says something is missing, just ask the caller for it; if it fails for another reason, explain simply and offer what it suggests. Asking about a time is not a request to book it. If the caller mentions gas, a carbon monoxide alarm, burning smells, sparking, or water near electrics, tell them to leave the area and call 911 or their gas utility first, and remind them this is a demo line.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short goodbye and then call end_call. Never call end_call in the same turn as a booking, change or message."""


# ---- Operations ----


def get_business_info(state: NorthlineState, _: Any, ctx: OpContext) -> OpResult:
    return ok(
        "Services and hours",
        {
            "services": [{"service": s["id"], "name": s["name"], "callOutFee": f"${s['fee']}" if s["fee"] else "Free", "covers": s["about"]} for s in SERVICES],
            "hours": "Visits Monday to Saturday, arrival windows from 8 AM to 6 PM Central Time. Closed Sunday.",
            "area": "Maple Grove, Cedar Falls and Riverside.",
            "policies": [
                "The call-out fee covers the visit and diagnosis; repair work is quoted on site before anything is done.",
                "Customers can change or cancel a visit free of charge.",
                "Technicians call ahead 30 minutes before arriving.",
            ],
            "today": state.today,
        },
    )


class NoteRequestDetails(BaseModel):
    service: Optional[ServiceId] = Field(None, description=SERVICE_HELP)
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    address: Optional[str] = Field(None, min_length=3, max_length=160, description="The service address as confirmed.")
    issue: Optional[str] = Field(None, min_length=3, max_length=200, description=ISSUE_HELP)
    proposedSlotId: Optional[str] = Field(None, description="The slot the caller chose, before booking.")


def note_request_details(state: NorthlineState, i: NoteRequestDetails, ctx: OpContext) -> OpResult:
    if i.proposedSlotId and i.proposedSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    r = state.request
    # A category is not worth showing on the card as the problem; the agent still needs to ask.
    issue = i.issue.strip() if i.issue and not issue_is_vague(i.issue) else None
    if i.service:
        r["serviceId"] = i.service
    if i.name:
        r["name"] = i.name.strip()
    if i.address:
        r["address"] = i.address.strip()
    if issue:
        r["issue"] = issue
    if i.proposedSlotId:
        r["proposedSlotId"] = i.proposedSlotId
    fields = [f for f, v in (("service", i.service), ("name", i.name), ("address", i.address), ("issue", issue), ("proposed time", i.proposedSlotId)) if v]
    result: dict[str, Any] = {}
    if i.issue and not issue:
        result["issueNotRecorded"] = "That names a system, not a problem. Ask what they have noticed."
    return ok(f"Noted {', '.join(fields) or 'details'}", result, bool(fields))


class CheckAvailability(BaseModel):
    service: ServiceId = Field(description=SERVICE_HELP)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description=DATE_HELP)
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = Field(None, description="Morning is before noon; afternoon is noon onwards.")


def check_availability(state: NorthlineState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    skill = service(i.service)["skill"]

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_schedule", f"Bookings open from today to {date_label(days[-1])}.", {"bookableFrom": state.today, "bookableTo": days[-1]})
    exact = [s for s in open_slots(state, i.date, skill) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "skill": skill}
    if exact:
        offered = exact[:4]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open on {date_label(i.date)}", {"date": i.date, "day": date_label(i.date), "available": [describe_slot(s) for s in offered]}, True)
    alternatives: list[str] = []
    for d in (d for d in days if d > i.date):
        alternatives += [s for s in open_slots(state, d, skill) if in_part(s)]
        if len(alternatives) >= 3:
            break
    offered = alternatives[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    return ok(
        f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available this week",
        {"date": i.date, "day": date_label(i.date), "available": [], "reason": "closed_sunday" if weekday(i.date) == 0 else "fully_booked", "nextAvailable": [describe_slot(s) for s in offered]},
        True,
    )


class BookAppointment(BaseModel):
    slotId: str
    service: ServiceId = Field(description=SERVICE_HELP)
    name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=3, max_length=160)
    issue: str = Field(min_length=3, max_length=200, description=ISSUE_HELP)
    callerConfirmed: bool = Confirmed()


def book_appointment(state: NorthlineState, i: BookAppointment, ctx: OpContext) -> OpResult:
    existing = active(state)
    same = next((a for a in existing if a.slot_id == i.slotId and a.service_id == i.service), None)
    if same:
        return ok(f"Already booked · {same.id}", {"appointmentId": same.id, "duplicate": True, "confirmation": confirm_text(same)})
    if existing:
        return fail("already_booked", "This caller already has a visit booked in this call. Use reschedule_appointment to change it.", {"appointmentId": existing[0].id, "confirmation": confirm_text(existing[0])})
    if i.service not in NO_SYMPTOM_NEEDED and issue_is_vague(i.issue):
        return fail("issue_too_vague", "The issue only names a system or trade. Ask the caller what they have noticed (no heat, a noise, a leak), then book.")
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    skill = service(i.service)["skill"]
    tech = free_tech(state, day, hour, skill)
    if not tech:
        alternatives = open_slots(state, day, skill)[:3]
        state.offered = list(dict.fromkeys(state.offered + alternatives))
        return fail("slot_taken", "That window has just been taken.", {"alternatives": [describe_slot(s) for s in alternatives]})
    aid = reference("NL", state.seq, state.seed)
    state.seq += 1
    at = ctx.now.isoformat()
    state.jobs.append(Job(id=aid, tech_id=tech, date=day, hour=hour, service_id=i.service, existing=False))
    appt = Appointment(id=aid, job_id=aid, slot_id=i.slotId, service_id=i.service, name=i.name.strip(), address=i.address.strip(), issue=i.issue.strip(), status="booked", tech_id=tech, updated_at=at, history=[{"at": at, "change": "booked", "slotId": i.slotId}])
    state.appointments.append(appt)
    state.request = {"serviceId": i.service, "name": appt.name, "address": appt.address, "issue": appt.issue}
    state.viewing = {"date": day, "slots": open_slots(state, day, skill), "skill": skill}
    # The caller has just heard the details in the read-back; give only what is new.
    return ok(f"Visit booked · {aid}", {"appointmentId": aid, "technician": first_name(tech), "callsAhead": "30 minutes before arriving"}, True)


class RescheduleAppointment(BaseModel):
    appointmentId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_appointment(state: NorthlineState, i: RescheduleAppointment, ctx: OpContext) -> OpResult:
    appt = next((a for a in active(state) if a.id == i.appointmentId), None)
    if not appt:
        return fail("not_found", "There is no active booking with that reference in this call.")
    if appt.slot_id == i.newSlotId:
        return ok(f"Already at that time · {appt.id}", {"appointmentId": appt.id, "unchanged": True, "confirmation": confirm_text(appt)})
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    skill = service(appt.service_id)["skill"]
    tech = free_tech(state, day, hour, skill, appt.job_id)
    if not tech:
        return fail("slot_taken", "That window is no longer free.")
    job = next(j for j in state.jobs if j.id == appt.job_id)
    job.tech_id, job.date, job.hour = tech, day, hour
    at = ctx.now.isoformat()
    appt.slot_id, appt.tech_id, appt.updated_at = i.newSlotId, tech, at
    appt.history.append({"at": at, "change": "moved", "slotId": i.newSlotId})
    state.request.pop("proposedSlotId", None)
    state.viewing = {"date": day, "slots": open_slots(state, day, skill), "skill": skill}
    moved = describe_slot(appt.slot_id)
    return ok(f"Visit moved · {appt.id}", {"appointmentId": appt.id, "technician": first_name(tech), "newTime": f"{moved['day']}, {moved['window']}"}, True)


class CancelAppointment(BaseModel):
    appointmentId: str
    callerConfirmed: bool = Confirmed()


def cancel_appointment(state: NorthlineState, i: CancelAppointment, ctx: OpContext) -> OpResult:
    appt = next((a for a in state.appointments if a.id == i.appointmentId), None)
    if not appt:
        return fail("not_found", "There is no booking with that reference in this call.")
    if appt.status == "cancelled":
        return ok(f"Already cancelled · {appt.id}", {"appointmentId": appt.id, "unchanged": True})
    state.jobs = [j for j in state.jobs if j.id != appt.job_id]
    at = ctx.now.isoformat()
    appt.status, appt.updated_at = "cancelled", at
    appt.history.append({"at": at, "change": "cancelled", "slotId": appt.slot_id})
    return ok(f"Visit cancelled · {appt.id}", {"appointmentId": appt.id, "cancelled": True}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")


def take_message(state: NorthlineState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(id=mid, name=i.name.strip(), callback_number=i.callbackNumber.strip(), summary=i.summary.strip(), preferred_time=(i.preferredTime or "").strip() or None, created_at=ctx.now.isoformat()))
    return ok(f"Message for the team · {mid}", {"messageId": mid}, True)


def view(state: NorthlineState) -> dict[str, Any]:
    days = bookable_days(state)
    focus = (state.viewing or {}).get("date") or (active(state)[0].slot_id[:10] if active(state) else add_days(state.today, 1))
    day = focus if focus in days else days[0]
    proposed = state.request.get("proposedSlotId")
    viewing = state.viewing

    def schedule_entry(j: Job) -> dict[str, Any]:
        appt = None if j.existing else next((a for a in state.appointments if a.job_id == j.id and a.status == "booked"), None)
        entry: dict[str, Any] = {"techId": j.tech_id, "hour": j.hour, "kind": "existing" if j.existing else "demo", "title": service(j.service_id)["name"]}
        if appt:
            entry.update({"appointmentId": appt.id, "name": appt.name, "address": appt.address})
        return entry

    # Only technicians who do this kind of work and are free: an opening shown is one that could be booked.
    open_cells = []
    if viewing and viewing["date"] == day:
        for sid in viewing["slots"]:
            hour = parse_slot(sid)[1]  # type: ignore[index]
            for t in TECHNICIANS:
                if viewing["skill"] in t["skills"] and not any(j.tech_id == t["id"] and j.date == day and j.hour == hour for j in state.jobs):
                    open_cells.append({"techId": t["id"], "hour": hour})

    return {
        "timeZone": "Central Time",
        "today": state.today,
        "day": {"date": day, "label": date_label(day)},
        "technicians": [{"id": t["id"], "name": t["name"].split(" ")[0]} for t in TECHNICIANS],
        "windows": [{"hour": h, "label": window_label(h)} for h in WINDOWS],
        "schedule": [schedule_entry(j) for j in state.jobs if j.date == day],
        "open": open_cells,
        "proposed": parse_slot(proposed)[1] if proposed and proposed.startswith(day) else None,  # type: ignore[index]
        "request": {
            "service": service(state.request["serviceId"])["name"] if state.request.get("serviceId") else None,
            "name": state.request.get("name"),
            "address": state.request.get("address"),
            "issue": state.request.get("issue"),
            "proposed": describe_slot(proposed) if proposed else None,
        },
        "appointments": [
            {"id": a.id, "status": a.status, "service": service(a.service_id)["name"], **describe_slot(a.slot_id), "technician": tech_name(a.tech_id), "name": a.name, "address": a.address, "changes": len(a.history) - 1}
            for a in state.appointments
        ],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number)} for m in state.messages],
    }


northline: DemoDefinition[NorthlineState] = DemoDefinition(
    id="northline",
    business_name="Northline Home Services",
    agent_name="Ellie",
    create_state=create_state,
    instruction=instruction,
    view=view,
    operations={
        "get_business_info": Operation("Looking up Northline's services", "Northline's services with fees, hours, service area and policies. Use before answering any question about the business.", get_business_info),
        "note_request_details": Operation(
            "Updating the service request",
            "Record details the caller has given or confirmed so the request card fills in. Send only the fields that are new or changed. proposedSlotId must be a slot check_availability returned.",
            note_request_details,
            NoteRequestDetails,
        ),
        "check_availability": Operation(
            "Checking the schedule",
            "Open arrival windows for a service on a date (YYYY-MM-DD, Central Time). If that date has none, returns the next available windows instead. Only offer what this returns.",
            check_availability,
            CheckAvailability,
        ),
        "book_appointment": Operation("Booking the visit", "Book the visit after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_appointment, BookAppointment),
        "reschedule_appointment": Operation("Moving the visit", "Move the existing booking to a new slot from check_availability, after the caller confirmed the new time.", reschedule_appointment, RescheduleAppointment),
        "cancel_appointment": Operation("Cancelling the visit", "Cancel a booking made in this call, after the caller confirmed.", cancel_appointment, CancelAppointment),
        "take_message": Operation("Leaving a message for the team", "Leave a callback request for the Northline team.", take_message, TakeMessage),
    },
)
