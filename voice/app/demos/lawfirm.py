"""
Alder & Finch Injury Law: a fictional personal-injury firm in Denver. The caller has been hurt and
rings the intake line. The agent listens, fills in the intake, runs a conflict check, qualifies or
politely declines, and books a free consultation on an attorney's calendar. The firm's side of the
screen is what a managing partner would want to see after the call: the intake, the conflict check,
the case tier, the attorney calendar and a ranked 7 AM case brief.

The agent never gives legal advice and never tells a caller what a case is worth, its tier or its
odds. Those live in the firm's view only. Availability comes from a small calendar generated relative
to the session's own date, so "tomorrow" always means something.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .. import email
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

TIME_ZONE = "America/Denver"
HOURS = (9, 10, 11, 13, 14, 15, 16)
DAYS_AHEAD = 9
LICENSED_STATE = "CO"
LIMITATION_YEARS = 2  # Colorado: two years for most injury claims, three for motor vehicle accidents.
VEHICLE_TYPES = ("car", "truck", "motorcycle", "rideshare")


def limit_years(kind: str) -> int:
    return 3 if kind in VEHICLE_TYPES else LIMITATION_YEARS

ATTORNEYS = [
    {"id": "dana", "name": "Dana Alder", "focus": "Car & rideshare crashes", "types": ("car", "rideshare", "truck", "motorcycle", "other")},
    {"id": "marcus", "name": "Marcus Finch", "focus": "Serious injury & wrongful death", "types": ("truck", "motorcycle", "pedestrian_bike", "rideshare", "car", "other")},
    {"id": "priya", "name": "Priya Rao", "focus": "Falls, bites & cyclists", "types": ("slip_fall", "dog_bite", "pedestrian_bike", "car", "other")},
]

ACCIDENT_TYPES = ("car", "truck", "motorcycle", "pedestrian_bike", "rideshare", "slip_fall", "dog_bite", "workplace", "medical_malpractice", "other")
AccidentType = Literal["car", "truck", "motorcycle", "pedestrian_bike", "rideshare", "slip_fall", "dog_bite", "workplace", "medical_malpractice", "other"]
TYPE_LABEL = {
    "car": "Car crash", "truck": "Truck crash", "motorcycle": "Motorcycle crash", "pedestrian_bike": "Pedestrian or bicycle",
    "rideshare": "Rideshare crash", "slip_fall": "Slip or fall", "dog_bite": "Dog bite", "workplace": "Workplace injury",
    "medical_malpractice": "Medical malpractice", "other": "Other injury",
}
InjuryArea = Literal["head_or_concussion", "neck", "back", "shoulder_or_arm", "hand_or_wrist", "hip_or_leg", "knee_or_foot", "broken_bones", "internal", "cuts_or_scarring", "emotional"]
INJURY_AREAS = {
    "head_or_concussion": "Head / concussion", "neck": "Neck", "back": "Back", "shoulder_or_arm": "Shoulder / arm", "hand_or_wrist": "Hand / wrist",
    "hip_or_leg": "Hip / leg", "knee_or_foot": "Knee / foot", "broken_bones": "Broken bones", "internal": "Internal", "cuts_or_scarring": "Cuts / scarring", "emotional": "Emotional distress",
}
Treatment = Literal["none", "doctor_or_urgent_care", "emergency_room", "ongoing_care", "surgery", "hospitalized"]
TREATMENT_LABEL = {
    "none": "No treatment yet", "doctor_or_urgent_care": "Doctor or urgent care", "emergency_room": "Emergency room",
    "ongoing_care": "Ongoing treatment", "surgery": "Surgery", "hospitalized": "Hospitalized",
}
TREATMENT_POINTS = {"none": 0, "doctor_or_urgent_care": 1, "emergency_room": 2, "ongoing_care": 3, "surgery": 5, "hospitalized": 6}
Fault = Literal["other_party", "shared", "me", "unsure"]
FAULT_LABEL = {"other_party": "Other party", "shared": "Shared", "me": "The caller", "unsure": "Not sure yet"}
FAULT_POINTS = {"other_party": 3, "shared": 1, "unsure": 1, "me": 0}
Tri = Literal["yes", "no", "unknown"]
Format = Literal["phone", "video", "office"]
FORMAT_LABEL = {"phone": "Phone call", "video": "Video call", "office": "At our Denver office"}

# Everything the agent may tell a caller about the firm.
BUSINESS: dict[str, Any] = {
    "name": "Alder & Finch Injury Law",
    "practice": "Personal injury in Colorado: car, truck, motorcycle and rideshare crashes, pedestrian and bicycle injuries, slips and falls, dog bites, and wrongful death. Family law and estate planning are not handled by this line. The firm does not take workplace injury (workers' compensation) or medical malpractice cases.",
    "city": "Denver, CO",
    "licensed": "Attorneys are licensed in Colorado only.",
    "phone": "(720) 599-6395",
    "hours": "This intake line answers around the clock. Free consultations are Monday to Friday, 9 AM to 5 PM Mountain Time, by phone, by video or at the Denver office.",
    "consultation": "The consultation is free and there is no obligation. It is with an attorney, about 45 minutes.",
    "fees": "Contingency: the firm is paid only if it recovers money for the client, and the attorney explains the fee agreement at the consultation. Never quote a percentage or an amount.",
    "attorneys": [{"name": a["name"], "focus": a["focus"]} for a in ATTORNEYS],
    "whatToBring": "Anything they have: the police report number, photos, the other driver's insurance details, medical bills or records. None of it is required to book.",
    "policies": [
        "The intake line is an AI assistant, not a lawyer, and cannot give legal advice.",
        "Calling or booking does not create an attorney-client relationship; that begins only when the firm and the client agree in writing.",
        "The firm cannot take a case if the caller already has a lawyer for it, if the accident happened outside Colorado, or if the time limit to file has passed.",
        "If the caller cannot be helped, the Colorado Bar Association runs a lawyer referral service they can call.",
    ],
}

# People and companies the firm already acts for or against: the conflict check reads these.
CLIENTS = ["Hollis Plumbing", "Granger Dental Group", "Priya Nair", "Tom Okafor"]
ADVERSE = ["Marcus Webb", "Lakeshore Rideshare", "Redline Courier"]


@dataclass
class Consult:
    id: str
    slot_id: str
    attorney_id: str
    fmt: str
    name: str
    status: Literal["booked", "cancelled"]
    updated_at: str
    changes: int = 0


@dataclass
class Booked:
    attorney_id: str
    date: str
    hour: int
    ref: str
    existing: bool


@dataclass
class Message:
    id: str
    name: str
    callback_number: str
    summary: str
    preferred_time: Optional[str]
    urgent: bool
    created_at: str


@dataclass
class LawFirmState:
    seed: str
    today: str
    earliest_today_hour: int
    calendar: list[Booked] = field(default_factory=list)
    intake: dict[str, Any] = field(default_factory=dict)
    # None until the check has run; then {"status": "clear" | "conflict", "names": [...]}.
    conflict: Optional[dict[str, Any]] = None
    # None until assess_case has run.
    assessment: Optional[dict[str, Any]] = None
    offered: list[str] = field(default_factory=list)
    viewing: Optional[dict[str, Any]] = None
    consults: list[Consult] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    seq: int = 0
    emailed: Optional[dict[str, Any]] = None
    # The matter record opens on the first thing the caller says that is worth keeping.
    opened: bool = False


# ---- Time ----


def slot_id(day: str, hour: int) -> str:
    return f"{day}T{hour:02d}"


def parse_slot(sid: str) -> Optional[tuple[str, int]]:
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})T(\d{2})", sid)
    return (m.group(1), int(m.group(2))) if m else None


def hour_label(h: int) -> str:
    return f"{((h + 11) % 12) + 1} {'AM' if h < 12 else 'PM'}"


def bookable_days(state: LawFirmState) -> list[str]:
    return [d for d in (add_days(state.today, i) for i in range(DAYS_AHEAD)) if weekday(d) not in (0, 6)]


def attorney(aid: str) -> dict[str, Any]:
    return next(a for a in ATTORNEYS if a["id"] == aid)


def first_name(aid: str) -> str:
    return attorney(aid)["name"].split(" ")[0]


def eligible_attorneys(state: LawFirmState) -> list[str]:
    """Who can take this caller's case: the accident type, and serious injuries go to the senior partner."""
    kind = state.intake.get("accidentType", "other")
    a = state.assessment or {}
    if a.get("tier") == "A":
        return ["marcus"]
    return [t["id"] for t in ATTORNEYS if kind in t["types"]]


def free_attorney(state: LawFirmState, day: str, hour: int, pool: list[str], ignore_ref: Optional[str] = None) -> Optional[str]:
    for aid in pool:
        if not any(b.attorney_id == aid and b.date == day and b.hour == hour and b.ref != ignore_ref for b in state.calendar):
            return aid
    return None


def open_slots(state: LawFirmState, day: str, pool: list[str], ignore_ref: Optional[str] = None) -> list[str]:
    if day not in bookable_days(state):
        return []
    return [slot_id(day, h) for h in HOURS if (day != state.today or h >= state.earliest_today_hour) and free_attorney(state, day, h, pool, ignore_ref)]


def describe_slot(state: LawFirmState, sid: str, pool: Optional[list[str]] = None, ignore_ref: Optional[str] = None) -> dict[str, str]:
    day, hour = parse_slot(sid)  # type: ignore[misc]
    out = {"slotId": sid, "date": day, "day": date_label(day), "time": hour_label(hour)}
    who = free_attorney(state, day, hour, pool or eligible_attorneys(state), ignore_ref)
    if who:
        out["attorney"] = attorney(who)["name"]
    return out


def create_state(now: datetime) -> LawFirmState:
    today, hour, minute = date_in(TIME_ZONE, now)
    state = LawFirmState(seed=f"{today}:{int(now.timestamp() * 1000)}", today=today, earliest_today_hour=hour + (3 if minute > 0 else 2))
    n = 0
    today_ord = datetime.fromisoformat(today).toordinal()
    for day in bookable_days(state):
        day_index = datetime.fromisoformat(day).toordinal() - today_ord
        for hi, h in enumerate(HOURS):
            for ai, a in enumerate(ATTORNEYS):
                if (day_index * 5 + hi * 3 + ai * 4) % 3 == 0 or (day_index == 1 and h in (10, 14) and a["id"] == "marcus"):
                    state.calendar.append(Booked(a["id"], day, h, f"existing-{n}", True))
                    n += 1
    return state


# ---- Intake helpers ----


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


def name_matches(a: str, b: str) -> bool:
    """Case-insensitive; a first-name-only or reordered match counts when every word of the shorter name appears."""
    wa, wb = set(norm(a).split()), set(norm(b).split())
    if not wa or not wb:
        return False
    short, long_ = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
    return short <= long_ and (len(short) > 1 or len(long_) == 1)


def parse_day(s: str) -> Optional[date]:
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def years_between(start: date, end: date) -> float:
    return (end - start).days / 365.25


REQUIRED = [("name", "the caller's name"), ("accidentType", "what kind of accident"), ("accidentDate", "the date it happened"), ("accidentState", "the state where it happened"), ("treatment", "what medical treatment so far"), ("atFault", "who was at fault"), ("hasLawyer", "whether they already have a lawyer for it")]


def missing_fields(state: LawFirmState) -> list[str]:
    return [label for key, label in REQUIRED if state.intake.get(key) in (None, "")]


def score(state: LawFirmState) -> int:
    i = state.intake
    pts = TREATMENT_POINTS.get(i.get("treatment", "none"), 0) + FAULT_POINTS.get(i.get("atFault", "unsure"), 1)
    pts += 1 if i.get("policeReport") == "yes" else 0
    pts += 1 if i.get("otherPartyInsured") == "yes" else -1 if i.get("otherPartyInsured") == "no" else 0
    pts += 6 if i.get("someoneDied") else 0
    return pts


def tier_of(pts: int) -> str:
    return "A" if pts >= 9 else "B" if pts >= 6 else "C"


DECLINES = {
    "outside_practice": ("This kind of case is outside what the firm handles.", "Say kindly that the firm does not take this kind of case (workplace injuries and medical malpractice are handled by other specialists), and that the Colorado Bar Association's lawyer referral service can point them to the right kind of lawyer."),
    "out_of_state": ("The accident was outside Colorado; the firm is licensed in Colorado only.", "Say kindly that the firm's attorneys are licensed in Colorado only, so it cannot take an accident from another state, and that the state bar where it happened can refer them to a local injury lawyer. Do not offer a consultation."),
    "has_lawyer": ("The caller already has a lawyer for this.", "Say kindly that the firm cannot take on a matter another lawyer is already handling, and that they are best placed speaking with their current lawyer. Do not offer a consultation."),
    "no_injury": ("Nobody was hurt, so this is not an injury case.", "Say kindly that the firm handles cases where someone was injured, so this is not one it can help with, and that if anyone is hurt later they are welcome to call back."),
    "at_fault": ("The caller says they alone were at fault.", "Say kindly that the firm takes cases where someone else caused the injury, so it is not the right fit here. Do not give an opinion on fault, and do not give legal advice."),
    "out_of_time": ("The Colorado time limit to file looks to have passed.", "Say gently that, from the date given, the time limit that normally applies looks to have passed, so the firm cannot take it, and that a lawyer elsewhere could confirm. Do not give legal advice beyond that."),
    "conflict": ("The firm has a conflict of interest and cannot take this matter.", "Say only that the firm is not able to help with this matter. Never say why, never say who or what was found, and suggest the Colorado Bar Association's lawyer referral service."),
}


# ---- Operations ----


def instruction(state: LawFirmState, ctx: OpContext) -> str:
    today = date_label(state.today)
    _, hour, minute = date_in(TIME_ZONE, ctx.now)
    clock = f"{hour % 12 or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"
    return f"""You are Nora. You answer the intake line for {BUSINESS['name']}, a personal injury law firm in Denver. You work for the firm; speak as part of its team ("our attorneys", "we"). You are an AI intake assistant, not a lawyer.

Behind the scenes, and not something to mention unless asked: this line is a demonstration. The firm is fictional, the bookings are sample records, and no attorney will call. If a caller asks directly whether you are a real person, answer honestly and briefly that you are the firm's AI intake assistant. If they ask directly whether this is a real firm or a real booking, say briefly that this is a demo line and nothing will actually be scheduled, then carry on helping. If they start sharing real health or case details, gently remind them this is a demo and they can make up details.

What you know about the firm (what it handles, fees, hours, attorneys, what to bring) comes from get_firm_info. Call it before answering any question about the firm, and answer only from what it returns.

Today is {today} ({state.today}), and it is {clock} Mountain Time. Use this to resolve "yesterday", "last Tuesday" and "next week".

How you speak: calm, kind and unhurried, like an experienced intake coordinator who knows the caller may be hurt, shaken or in pain. Lead with care before questions ("I'm so sorry that happened. Let's make sure you're okay first."). Short sentences. One question per turn, never a list of questions. Never use legal jargon. Never read out ids, slot codes or anything in brackets. If you are interrupted, stop and listen. Never rush a caller who is upset; let them tell it their way, then gather the details gently.

Language: always speak English, every turn. Background voices or noise are not the caller. If the caller clearly speaks another language, say in English that this line can only help in English, then carry on in English.

Say each thing once: do not turn the caller's words back into a question, do not restate what they just told you before your next question, and do not announce that you are noting or checking something. A brief, varied acknowledgement is enough ("I'm sorry." "Okay." "That sounds frightening.").

Opening on a phone call: exactly "Thank you for calling Alder and Finch Injury Law, this is Nora. Please enter your screen code." Nothing more.
Opening in a website conversation: exactly "Thank you for calling Alder and Finch Injury Law, this is Nora. How can I help?" Nothing more.

Safety first. If the caller is hurt right now, in danger, or has not been seen by a medical professional after something serious, tell them to call 911 or get to an emergency room first and that you are here when they are ready.

Your job is intake. Let them tell what happened, then fill the gaps, one question at a time, in roughly this order:
1. What happened (the kind of accident), and when. Resolve the date yourself from today's date and confirm it only if it is ambiguous.
2. Where it happened: the state, and the city.
3. Injuries and treatment so far: which parts of the body were hurt (record them in injuryAreas, picking from the list), what hurts in their words, whether the injuries have kept them from work, and whether they have seen a doctor, been to the emergency room, are having ongoing treatment, had surgery, or were hospitalized. Ask gently. If someone died, offer your condolences and treat it as the most urgent kind of call.
4. Who was at fault, in their own view (the other driver, a business, themselves, or they are not sure). Ask only what they saw. Never give an opinion on fault.
5. Whether there is a police report, and whether the other side has insurance and with which company, if they know. "I don't know" is a fine answer.
6. The other party's name, if they know it (the driver, or the company or property owner).
7. Whether they already have a lawyer for this accident.
8. Their name, their best phone number (on a phone call use get_caller_number and confirm the last four digits), and an email if they are happy to give one.
Skip anything they have already said. The firm's screen is a case record that opens as the caller speaks: every field you record is typed into it and every choice is picked on it, so record each fact as soon as you have it. Call note_intake after each caller turn that gives you something new, with everything new from that turn, once per turn. Its result needs no comment. Record what they said in their own words for injuries.

Conflict check: as soon as you have the caller's name (and the other party's name, if they know it), call check_conflicts. This is routine; do not describe it to the caller beyond something like "I'll just run a quick check on our side." Never tell the caller what the check found if it finds a conflict.

Then call assess_case once the intake basics are in. It tells you whether the firm can take the case and what to say if it cannot. Never tell the caller a tier, a priority, the value of their case, their chances, or what they might receive. Never predict an outcome. If asked "what's my case worth" or "will I win", say kindly that only an attorney can speak to that after reviewing the details, and that is what the free consultation is for.

If the firm cannot take it, follow assess_case's guidance: be kind, brief and clear, never argue, never give legal advice, point them to the Colorado Bar Association's lawyer referral service where it says to, ask whether there is anything else, and end the call kindly.

If the firm can take it, offer the free consultation with an attorney (about 45 minutes, no obligation, no fee unless the firm recovers money for them; say fees only as get_firm_info gives them). Ask whether they would prefer phone, video or coming to the Denver office, ask what day suits them, and call check_availability for that day. Offer at most three options, naming the attorney. If assess_case says it is a priority, offer the very earliest times first and say the attorney will want to speak soon. If time limits are mentioned in its result, say only that time limits can be strict so it is worth booking soon; never state a deadline.

Booking: read back the day, time, attorney, format, and their name in one sentence, then ask whether to book it. On a clear yes, call book_consultation with callerConfirmed true. Then say only what is new: it is booked, the attorney's first name, and that you can email a confirmation. Change or cancel: check_availability for a new time, then reschedule_consultation once the caller confirmed. A change moves the same booking; never book a second one.

If the caller would rather talk to a person, is not ready to book, or nothing suits them, take a message with take_message: a name, a confirmed callback number, and what it is about. Use urgent true only for a serious injury or a death. Only call it after the caller confirmed the number.

Email: once a consultation is booked, offer once to email a confirmation. If they want it, ask for their email address and read it back carefully: spell the part before the @ letter by letter, then say the rest. Only when they clearly confirm it is right, call email_confirmation with callerConfirmed true. Say it is on its way only if the tool returns ok.

Rules: never say something is booked unless the tool returned ok true. Never give legal advice, never tell a caller what to do about insurance, settlements, statements or deadlines. If a caller presses for advice, say you are not a lawyer and that the attorney can answer exactly that in the consultation. If a tool says something is missing, just ask the caller for it; if it fails for another reason, explain simply and offer a message instead.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short, warm goodbye and then call end_call. Never call end_call in the same turn as a booking, change or message."""


def get_firm_info(state: LawFirmState, _: Any, ctx: OpContext) -> OpResult:
    return ok("The firm's practice, hours and fees", {**BUSINESS, "today": state.today})


class NoteIntake(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80, description="The caller's name as they gave it.")
    phone: Optional[str] = Field(None, min_length=7, max_length=20, description="Best callback number, once the caller confirmed it.")
    email: Optional[str] = Field(None, max_length=120, description="Email address, only once the caller confirmed it.")
    accidentType: Optional[AccidentType] = Field(None, description="The kind of accident.")
    accidentDate: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="The date it happened, YYYY-MM-DD, worked out from today's date.")
    accidentState: Optional[str] = Field(None, min_length=2, max_length=2, description="Two-letter US state where it happened, e.g. CO.")
    accidentCity: Optional[str] = Field(None, min_length=2, max_length=60, description="City where it happened.")
    injuries: Optional[str] = Field(None, min_length=2, max_length=240, description="What hurts or was injured, in the caller's words. Never a category.")
    treatment: Optional[Treatment] = Field(None, description="The most serious treatment so far: none, doctor_or_urgent_care, emergency_room, ongoing_care, surgery, hospitalized.")
    injuryAreas: Optional[list[InjuryArea]] = Field(None, description="Every part of the body the caller says was hurt, picked from the list. Send the full list so far, not only the new part.")
    missedWork: Optional[Tri] = Field(None, description="Whether the injuries have kept them from working.")
    someoneDied: Optional[bool] = Field(None, description="True only if the caller says someone died in the accident.")
    atFault: Optional[Fault] = Field(None, description="Who was at fault in the caller's view: other_party, shared, me, unsure.")
    policeReport: Optional[Tri] = Field(None, description="Whether a police report was filed.")
    otherPartyInsured: Optional[Tri] = Field(None, description="Whether the other side has insurance, if known.")
    otherPartyInsurer: Optional[str] = Field(None, min_length=2, max_length=80, description="The other side's insurance company, if the caller knows it.")
    opposingParty: Optional[str] = Field(None, min_length=2, max_length=100, description="The other driver, company or property owner, if the caller knows.")
    hasLawyer: Optional[bool] = Field(None, description="True if the caller already has a lawyer for this accident.")


def note_intake(state: LawFirmState, i: NoteIntake, ctx: OpContext) -> OpResult:
    new = {k: v for k, v in i.model_dump().items() if v is not None}
    if "accidentDate" in new:
        d = parse_day(new["accidentDate"])
        if d is None:
            return fail("bad_date", "That date is not valid. Work it out again from today's date.")
        if d > date.fromisoformat(state.today):
            return fail("future_date", "That date is in the future. Check it with the caller.")
    if "accidentState" in new:
        new["accidentState"] = new["accidentState"].upper()
    for k in ("name", "accidentCity", "injuries", "opposingParty", "otherPartyInsurer"):
        if k in new:
            new[k] = new[k].strip()
    changed = [k for k, v in new.items() if state.intake.get(k) != v]
    # New facts invalidate what was already decided from the old ones.
    if changed and state.assessment and not state.consults:
        if any(k in changed for k in ("accidentType", "accidentDate", "accidentState", "treatment", "atFault", "hasLawyer", "someoneDied", "otherPartyInsured", "policeReport")):
            state.assessment = None
    if "name" in changed or "opposingParty" in changed:
        state.conflict = None
    state.intake.update(new)
    state.opened = True
    return ok(f"Noted {len(changed)} detail{'s' if len(changed) != 1 else ''}" if changed else "Nothing new", {}, bool(changed))


class CheckConflicts(BaseModel):
    callerName: str = Field(min_length=1, max_length=80, description="The caller's name.")
    opposingParty: Optional[str] = Field(None, max_length=100, description="The other driver, company or property owner, if the caller named one.")


def check_conflicts(state: LawFirmState, i: CheckConflicts, ctx: OpContext) -> OpResult:
    names = [i.callerName.strip()] + ([i.opposingParty.strip()] if i.opposingParty else [])
    hits: list[str] = []
    # The firm cannot act against its own clients, nor for someone it is already suing.
    if i.opposingParty and any(name_matches(i.opposingParty, c) for c in CLIENTS):
        hits.append("The other party is a current client")
    if any(name_matches(i.callerName, a) for a in ADVERSE):
        hits.append("The caller is an adverse party on an open matter")
    state.intake["name"] = state.intake.get("name") or i.callerName.strip()
    if i.opposingParty:
        state.intake.setdefault("opposingParty", i.opposingParty.strip())
    state.opened = True
    state.conflict = {"status": "conflict" if hits else "clear", "names": names, "hits": hits}
    if hits:
        d = DECLINES["conflict"]
        return ok("Conflict found · cannot take this matter", {"conflict": True, "say": d[1]}, True)
    return ok("No conflicts found", {"conflict": False}, True)


def assess_case(state: LawFirmState, _: Any, ctx: OpContext) -> OpResult:
    miss = missing_fields(state)
    if miss:
        return fail("missing_details", "Still needed before this can be assessed: " + ", ".join(miss) + ". Ask the caller for them, one at a time.")
    if state.conflict is None:
        return fail("conflict_check_first", "Run check_conflicts first, with the caller's name and the other party's name if known.")
    i = state.intake
    today = date.fromisoformat(state.today)
    d = parse_day(i["accidentDate"])
    reason: Optional[str] = None
    if state.conflict["status"] == "conflict":
        reason = "conflict"
    elif i["accidentType"] in ("workplace", "medical_malpractice"):
        reason = "outside_practice"
    elif i["accidentState"] != LICENSED_STATE:
        reason = "out_of_state"
    elif i["hasLawyer"] is True:
        reason = "has_lawyer"
    elif i["atFault"] == "me":
        reason = "at_fault"
    elif d and years_between(d, today) > limit_years(i['accidentType']):
        reason = "out_of_time"
    elif i["treatment"] == "none" and not i.get("injuries") and not i.get("someoneDied"):
        reason = "no_injury"
    if reason:
        why, say = DECLINES[reason]
        state.assessment = {"outcome": "declined", "reason": reason, "why": why, "tier": None, "flags": [], "deadline": None, "score": score(state) if reason != "conflict" else 0}
        return ok(f"Cannot take it · {why.rstrip('.')}", {"canTakeCase": False, "say": say}, True)
    pts = score(state)
    tier = "A" if i.get("someoneDied") else tier_of(pts)
    flags: list[str] = []
    deadline = date(d.year + limit_years(i['accidentType']), d.month, min(d.day, 28)) if d else None
    if d and years_between(d, today) > limit_years(i['accidentType']) - 0.5:
        flags.append("Time limit within 6 months")
    if i.get("someoneDied"):
        flags.append("Wrongful death")
    if i["treatment"] == "none":
        flags.append("No treatment yet")
    if i.get("otherPartyInsured") == "no":
        flags.append("Other side may be uninsured")
    why = [
        f"{TREATMENT_LABEL[i['treatment']]}",
        f"Fault: {FAULT_LABEL[i['atFault']].lower()}",
        "Police report filed" if i.get("policeReport") == "yes" else "No police report" if i.get("policeReport") == "no" else "Police report unknown",
        "Other side insured" if i.get("otherPartyInsured") == "yes" else "Other side uninsured" if i.get("otherPartyInsured") == "no" else "Insurance unknown",
    ]
    state.assessment = {"outcome": "qualified", "reason": None, "why": why, "tier": tier, "flags": flags, "deadline": deadline.isoformat() if deadline else None, "score": pts}
    out: dict[str, Any] = {"canTakeCase": True, "priority": "priority" if tier == "A" or "Time limit within 6 months" in flags else "standard", "nextStep": "Offer the free consultation, ask phone, video or office, and check availability."}
    if "Time limit within 6 months" in flags:
        out["timeLimits"] = "Time limits can be strict, so it is worth booking soon. Say only that; never state a deadline."
    if tier == "A":
        out["attorney"] = "This caller goes to the senior partner; check_availability already shows only his times."
    return ok(f"Can take it · priority {tier}" if tier == "A" else "Can take it", out, True)


class CheckAvailability(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="The day the caller asked for, YYYY-MM-DD.")
    partOfDay: Optional[Literal["morning", "afternoon", "any"]] = Field(None, description="Morning is before noon; afternoon is noon onwards.")


def check_availability(state: LawFirmState, i: CheckAvailability, ctx: OpContext) -> OpResult:
    if not state.assessment or state.assessment["outcome"] != "qualified":
        return fail("not_qualified", "Only offer a consultation after assess_case says the firm can take the case.")
    pool = eligible_attorneys(state)

    def in_part(sid: str) -> bool:
        h = parse_slot(sid)[1]  # type: ignore[index]
        return h < 12 if i.partOfDay == "morning" else h >= 12 if i.partOfDay == "afternoon" else True

    days = bookable_days(state)
    if i.date < state.today or i.date > days[-1]:
        return fail("outside_calendar", f"Consultations can be booked from today to {date_label(days[-1])}.", {"bookableFrom": state.today, "bookableTo": days[-1]})
    exact = [s for s in open_slots(state, i.date, pool) if in_part(s)]
    state.viewing = {"date": i.date, "slots": exact, "pool": pool}
    if exact:
        offered = exact[:4]
        state.offered = list(dict.fromkeys(state.offered + offered))
        return ok(f"{len(offered)} open on {date_label(i.date)}", {"date": i.date, "day": date_label(i.date), "available": [describe_slot(state, s, pool) for s in offered]}, True)
    alternatives: list[str] = []
    for day in (d for d in days if d > i.date):
        alternatives += [s for s in open_slots(state, day, pool) if in_part(s)]
        if len(alternatives) >= 3:
            break
    offered = alternatives[:3]
    state.offered = list(dict.fromkeys(state.offered + offered))
    if offered:
        first = offered[0][:10]
        state.viewing = {"date": first, "slots": [s for s in open_slots(state, first, pool) if in_part(s)], "pool": pool}
    reason = "weekend" if weekday(i.date) in (0, 6) else "fully_booked"
    return ok(
        f"Nothing on {date_label(i.date)} · next openings found" if offered else "Nothing available",
        {"date": i.date, "day": date_label(i.date), "available": [], "reason": reason, "nextAvailable": [describe_slot(state, s, pool) for s in offered]},
        True,
    )


def active(state: LawFirmState) -> list[Consult]:
    return [c for c in state.consults if c.status == "booked"]


def confirm_text(state: LawFirmState, c: Consult) -> str:
    s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
    return f"{FORMAT_LABEL[c.fmt]} with {attorney(c.attorney_id)['name']} on {s['day']} at {s['time']}. Reference {c.id}."


class BookConsultation(BaseModel):
    slotId: str
    format: Format = Field(description="phone, video or office.")
    callerConfirmed: bool = Confirmed()


def book_consultation(state: LawFirmState, i: BookConsultation, ctx: OpContext) -> OpResult:
    if not state.assessment or state.assessment["outcome"] != "qualified":
        return fail("not_qualified", "A consultation can only be booked after assess_case says the firm can take the case.")
    if not state.intake.get("name"):
        return fail("missing_details", "Ask for the caller's name first.")
    existing = active(state)
    same = next((c for c in existing if c.slot_id == i.slotId), None)
    if same:
        return ok(f"Already booked · {same.id}", {"consultationId": same.id, "duplicate": True, "confirmation": confirm_text(state, same)})
    if existing:
        return fail("already_booked", "This caller already has a consultation booked in this call. Use reschedule_consultation to change it.", {"consultationId": existing[0].id, "confirmation": confirm_text(state, existing[0])})
    if i.slotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.slotId)  # type: ignore[misc]
    pool = eligible_attorneys(state)
    who = free_attorney(state, day, hour, pool)
    if not who:
        alternatives = open_slots(state, day, pool)[:3]
        state.offered = list(dict.fromkeys(state.offered + alternatives))
        return fail("slot_taken", "That time has just been taken.", {"alternatives": [describe_slot(state, s, pool) for s in alternatives]})
    cid = reference("AF", state.seq, state.seed)
    state.seq += 1
    state.calendar.append(Booked(who, day, hour, cid, False))
    state.consults.append(Consult(cid, i.slotId, who, i.format, state.intake["name"], "booked", ctx.now.isoformat()))
    state.viewing = {"date": day, "slots": open_slots(state, day, pool), "pool": pool}
    return ok(f"Consultation booked · {cid}", {"consultationId": cid, "attorney": first_name(who), "format": i.format}, True)


class RescheduleConsultation(BaseModel):
    consultationId: str
    newSlotId: str
    callerConfirmed: bool = Confirmed()


def reschedule_consultation(state: LawFirmState, i: RescheduleConsultation, ctx: OpContext) -> OpResult:
    c = next((c for c in active(state) if c.id == i.consultationId), None)
    if not c:
        return fail("not_found", "There is no active consultation with that reference in this call.")
    if c.slot_id == i.newSlotId:
        return ok(f"Already at that time · {c.id}", {"consultationId": c.id, "unchanged": True, "confirmation": confirm_text(state, c)})
    if i.newSlotId not in state.offered:
        return fail("slot_not_offered", "That time was not offered. Check availability first.")
    day, hour = parse_slot(i.newSlotId)  # type: ignore[misc]
    pool = eligible_attorneys(state)
    who = free_attorney(state, day, hour, pool, c.id)
    if not who:
        return fail("slot_taken", "That time is no longer free.")
    slot = next(b for b in state.calendar if b.ref == c.id)
    slot.attorney_id, slot.date, slot.hour = who, day, hour
    c.slot_id, c.attorney_id, c.updated_at, c.changes = i.newSlotId, who, ctx.now.isoformat(), c.changes + 1
    state.viewing = {"date": day, "slots": open_slots(state, day, pool), "pool": pool}
    s = describe_slot(state, c.slot_id, [who], c.id)
    return ok(f"Consultation moved · {c.id}", {"consultationId": c.id, "attorney": first_name(who), "newTime": f"{s['day']} at {s['time']}"}, True)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    callbackNumber: str = Field(min_length=7, max_length=20)
    summary: str = Field(min_length=3, max_length=300, description="What the caller needs, in a sentence or two.")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they would like a call back, in their words.")
    urgent: bool = Field(False, description="True only for a serious injury or a death: it goes straight to an attorney.")


def take_message(state: LawFirmState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.summary == i.summary.strip() and m.name == i.name.strip()), None)
    if dup:
        return ok(f"Message already left · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.summary.strip(), (i.preferredTime or "").strip() or None, i.urgent, ctx.now.isoformat()))
    if i.urgent:
        return ok(f"Urgent · sent to an attorney · {mid}", {"messageId": mid, "attorneyCallsBackWithin": "the hour"}, True)
    return ok(f"Message for the attorneys · {mid}", {"messageId": mid}, True)


class EmailConfirmation(BaseModel):
    email: str = Field(min_length=5, max_length=120, description="The caller's email address as they gave it.")
    callerConfirmed: bool = Confirmed()


async def email_confirmation(state: LawFirmState, i: EmailConfirmation, ctx: OpContext) -> OpResult:
    """Emails the booked consultation to the caller: once per call, from a fixed template."""
    booked = active(state)
    if not booked:
        return fail("nothing_booked", "There is no booked consultation to confirm yet.")
    if state.emailed:
        return fail("already_sent", f"The confirmation was already emailed to {state.emailed['to']} on this call.")
    c = booked[-1]
    s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
    consult = {"day": s["day"], "time": s["time"], "attorney": attorney(c.attorney_id)["name"], "format": FORMAT_LABEL[c.fmt], "name": c.name, "reference": c.id}
    masked, why = await email.confirm(i.email, email.consult_confirmation(consult), "Nora at Alder & Finch")
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly."))
    state.emailed = {"to": masked, "reference": c.id}
    return ok(f"Confirmation emailed · {masked}", {"sent": True, "to": masked}, True)


# ---- The firm's view ----

# Other calls that came in overnight, for the 7 AM brief. Fictional, with no contact details.
OVERNIGHT = [
    {"who": "Jordan M.", "summary": "Semi-truck hit his car on I-5; surgery on Tuesday, driver cited", "tier": "A", "score": 11},
    {"who": "Aisha K.", "summary": "Rear-ended at a light; ER visit, physio booked, other driver insured", "tier": "B", "score": 8},
    {"who": "Chris P.", "summary": "Bitten by a neighbour's dog; urgent care, stitches", "tier": "C", "score": 5},
    {"who": "Lena S.", "summary": "Slipped on a wet store floor; no treatment yet", "tier": "C", "score": 3},
]


def case_summary(state: LawFirmState) -> str:
    i = state.intake
    kind = TYPE_LABEL.get(i.get("accidentType", ""), "Injury")
    bits = [kind]
    if i.get("treatment") and i["treatment"] != "none":
        bits.append(TREATMENT_LABEL[i["treatment"]].lower())
    if i.get("atFault") == "other_party":
        bits.append("other party at fault")
    return "; ".join(bits)


def brief(state: LawFirmState) -> dict[str, Any]:
    rows = [{**r, "mine": False, "declined": False} for r in OVERNIGHT]
    a = state.assessment
    if a:
        who = (state.intake.get("name") or "This caller").strip()
        if a["outcome"] == "qualified":
            rows.append({"who": who, "summary": case_summary(state), "tier": a["tier"], "score": a["score"], "mine": True, "declined": False})
        else:
            rows.append({"who": who, "summary": f"Declined: {a['why'].rstrip('.')}", "tier": None, "score": -1, "mine": True, "declined": True})
    rows.sort(key=lambda r: r["score"], reverse=True)
    return {"rows": [{k: r[k] for k in ("who", "summary", "tier", "mine", "declined")} for r in rows]}


YES_NO = ["Yes", "No", "Not sure"]
TRI_LABEL = {"yes": "Yes", "no": "No", "unknown": "Not sure"}


def f(key: str, label: str, kind: str, value: Any = None, options: Optional[list[str]] = None, wide: bool = False) -> dict[str, Any]:
    return {"key": key, "label": label, "kind": kind, "value": value, "options": options or [], "wide": wide}


def record_sections(state: LawFirmState) -> list[dict[str, Any]]:
    i = state.intake
    tri = lambda k: TRI_LABEL.get(i.get(k, ""))  # noqa: E731
    lawyer = None if i.get("hasLawyer") is None else "Yes" if i["hasLawyer"] else "No"
    where = ", ".join(x for x in (i.get("accidentCity"), i.get("accidentState")) if x) or None
    when = None
    if i.get("accidentDate"):
        dd = date.fromisoformat(i["accidentDate"])
        when = f"{dd.strftime('%b')} {dd.day}, {dd.year}"
    return [
        {"id": "contact", "title": "Contact", "fields": [
            f("name", "Full name", "text", i.get("name")),
            f("phone", "Phone", "text", mask_number(i["phone"]) if i.get("phone") else None),
            f("email", "Email", "text", email.mask(i["email"]) if i.get("email") and "@" in i["email"] else None),
        ]},
        {"id": "matter", "title": "Matter", "fields": [
            f("practice", "Practice area", "select", "Personal injury" if state.opened else None, ["Personal injury", "Family law", "Estate planning"]),
            f("type", "Case type", "select", TYPE_LABEL.get(i.get("accidentType", "")), list(TYPE_LABEL.values())),
            f("date", "Date of incident", "date", when),
            f("where", "Location", "text", where),
            f("source", "Referral source", "select", "Phone · AI intake" if state.opened else None, ["Phone · AI intake", "Website", "Referral", "Advertising"]),
        ]},
        {"id": "injuries", "title": "Injuries & treatment", "fields": [
            f("areas", "Injured areas", "chips", [INJURY_AREAS[a] for a in i.get("injuryAreas", []) if a in INJURY_AREAS] or None, list(INJURY_AREAS.values()), True),
            f("injuries", "In the caller's words", "text", i.get("injuries"), None, True),
            f("treatment", "Treatment so far", "select", TREATMENT_LABEL.get(i.get("treatment", "")), list(TREATMENT_LABEL.values())),
            f("work", "Missed work", "toggle", tri("missedWork"), YES_NO),
            *([f("died", "Wrongful death", "toggle", "Yes", YES_NO)] if i.get("someoneDied") else []),
        ]},
        {"id": "liability", "title": "Liability & insurance", "fields": [
            f("fault", "At fault", "select", FAULT_LABEL.get(i.get("atFault", "")), list(FAULT_LABEL.values())),
            f("other", "Other party", "text", i.get("opposingParty")),
            f("police", "Police report", "toggle", tri("policeReport"), YES_NO),
            f("insured", "Other side insured", "toggle", tri("otherPartyInsured"), YES_NO),
            f("insurer", "Insurer", "text", i.get("otherPartyInsurer")),
            f("lawyer", "Already has a lawyer", "toggle", lawyer, ["Yes", "No"]),
        ]},
    ]


def stage_of(state: LawFirmState) -> str:
    a = state.assessment
    if a and a["outcome"] == "declined":
        return "declined"
    if active(state):
        return "consult"
    if a:
        return "qualified"
    if state.conflict:
        return "conflict"
    return "new"


def tasks(state: LawFirmState) -> list[dict[str, Any]]:
    """What the firm's system would queue for staff once Nora has finished: derived from the records, never invented."""
    a, i = state.assessment, state.intake
    out: list[dict[str, Any]] = []
    if not a:
        return out
    if a["outcome"] == "declined":
        if a["reason"] == "conflict":
            return [{"title": "Escalate to the conflicts attorney", "who": "Dana Alder", "due": "Today"}]
        return [{"title": "Send the non-engagement letter", "who": "Intake team", "due": "Today"}, {"title": "Send the Colorado Bar referral list", "who": "Intake team", "due": "Today"}]
    booked = active(state)
    if booked:
        c = booked[-1]
        s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
        out.append({"title": f"Free consultation · {s['day']}, {s['time']}", "who": attorney(c.attorney_id)["name"], "due": s["day"]})
    out.append({"title": "Email the consultation confirmation", "who": "Nora", "due": "Sent" if state.emailed else "Once booked"})
    if i.get("policeReport") == "yes":
        out.append({"title": "Request the police report", "who": "Intake team", "due": "Tomorrow"})
    if i.get("treatment") not in (None, "none"):
        out.append({"title": "Send the medical-records release for signature", "who": "Intake team", "due": "Tomorrow"})
    if a.get("deadline") and "Time limit within 6 months" in a["flags"]:
        out.append({"title": f"Calendar the filing deadline · {a['deadline']}", "who": "Docketing", "due": "Today"})
    if i.get("someoneDied"):
        out.append({"title": "Partner call to the family", "who": "Marcus Finch", "due": "Within the hour"})
    return out


def call_note(state: LawFirmState) -> Optional[str]:
    a, i = state.assessment, state.intake
    if not a:
        return None
    who = i.get("name", "The caller")
    kind = TYPE_LABEL.get(i.get("accidentType", ""), "injury").lower()
    where = ", ".join(x for x in (i.get("accidentCity"), i.get("accidentState")) if x)
    parts = [f"{who} called the intake line about a {kind}" + (f" on {i['accidentDate']}" if i.get("accidentDate") else "") + (f" in {where}." if where else ".")]
    if i.get("injuries"):
        parts.append(f"Injuries: {i['injuries']}.")
    if i.get("treatment"):
        parts.append(f"Treatment: {TREATMENT_LABEL[i['treatment']].lower()}.")
    parts.append(f"Fault: {FAULT_LABEL.get(i.get('atFault', ''), 'unknown').lower()}." + (" Police report filed." if i.get("policeReport") == "yes" else ""))
    parts.append("Not represented." if i.get("hasLawyer") is False else "")
    parts.append("Conflict check clear." if state.conflict and state.conflict["status"] == "clear" else "Conflict found.")
    if a["outcome"] == "declined":
        parts.append(f"Declined: {a['why'].rstrip('.')}.")
    else:
        parts.append(f"Tier {a['tier']}.")
        if active(state):
            c = active(state)[-1]
            s = describe_slot(state, c.slot_id, [c.attorney_id], c.id)
            parts.append(f"Free consultation booked with {attorney(c.attorney_id)['name']}, {s['day']} at {s['time']}.")
    return " ".join(p for p in parts if p)


def view(state: LawFirmState) -> dict[str, Any]:
    days = bookable_days(state)
    booked = active(state)
    focus = (state.viewing or {}).get("date") or (booked[0].slot_id[:10] if booked else add_days(state.today, 1))
    day = focus if focus in days else days[0]
    viewing = state.viewing
    a = state.assessment
    deadline = None
    if a and a.get("deadline"):
        dd = date.fromisoformat(a["deadline"])
        deadline = f"{dd.strftime('%B')} {dd.day}, {dd.year}"

    # Times the agent has just found: one row per opening, with the attorney it would be with.
    open_times = []
    if viewing and viewing["date"] == day:
        for sid in viewing["slots"]:
            d = describe_slot(state, sid, viewing["pool"])
            if d.get("attorney"):
                open_times.append({"slotId": sid, "day": d["day"], "time": d["time"], "attorney": d["attorney"]})
    return {
        "timeZone": "Mountain Time",
        "record": {
            "opened": state.opened,
            "number": reference("PI", 900, state.seed) if state.opened else None,
            "title": state.intake.get("name"),
            "stage": stage_of(state),
            "sections": record_sections(state),
        },
        "conflict": None if state.conflict is None else {"status": state.conflict["status"], "checked": state.conflict["names"]},
        "assessment": None if not a else {
            "outcome": a["outcome"], "tier": a["tier"], "reason": a["why"] if a["outcome"] == "declined" else None,
            "points": a["why"] if a["outcome"] == "qualified" else [], "flags": a["flags"], "deadline": deadline,
        },
        "note": call_note(state),
        "tasks": tasks(state),
        "openTimes": open_times[:4],
        "consults": [
            {"id": c.id, "status": c.status, **{k: v for k, v in describe_slot(state, c.slot_id, [c.attorney_id], c.id).items() if k in ("day", "time")}, "attorney": attorney(c.attorney_id)["name"], "format": FORMAT_LABEL[c.fmt], "name": c.name, "changes": c.changes}
            for c in state.consults
        ],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "urgent": m.urgent} for m in state.messages],
        "brief": brief(state) if a else None,
        "emailed": state.emailed,
    }


lawfirm: DemoDefinition[LawFirmState] = DemoDefinition(
    id="lawfirm",
    business_name="Alder & Finch Injury Law",
    agent_name="Nora",
    create_state=create_state,
    instruction=instruction,
    view=view,
    operations={
        "get_firm_info": Operation("Looking up the firm", "What the firm handles, its fees and hours, its attorneys, what to bring to a consultation, and its policies. Use before answering any question about the firm.", get_firm_info),
        "note_intake": Operation("Filling in the intake form", "Record what the caller has told you so the intake form fills in. Send only the fields that are new or changed. Dates are YYYY-MM-DD worked out from today's date.", note_intake, NoteIntake),
        "check_conflicts": Operation("Running the conflict check", "Check the caller's name and the other party's name against the firm's clients and open matters. Run it once you have the caller's name. Never tell the caller what a conflict check found.", check_conflicts, CheckConflicts),
        "assess_case": Operation("Reviewing the case", "Decide whether the firm can take the case from the intake, and get what to say if it cannot. Needs the basics noted and the conflict check done. Never tell the caller a tier, a value or odds.", assess_case),
        "check_availability": Operation("Checking the attorneys' calendars", "Open consultation times with an attorney who fits this case on a date (YYYY-MM-DD, Mountain Time). If that date has none, returns the next openings instead. Only offer what this returns, and only after assess_case says the firm can take the case.", check_availability, CheckAvailability),
        "book_consultation": Operation("Booking the consultation", "Book the free consultation after the caller clearly said yes to the read-back. slotId must come from check_availability.", book_consultation, BookConsultation),
        "reschedule_consultation": Operation("Moving the consultation", "Move the existing consultation to a new slot from check_availability, after the caller confirmed the new time.", reschedule_consultation, RescheduleConsultation),
        "take_message": Operation("Leaving a message for the attorneys", "Leave a callback request for the attorneys.", take_message, TakeMessage),
        "email_confirmation": Operation("Emailing the confirmation", "Email the booked consultation's confirmation to the caller, after they confirm the address read back to them. Once per call.", email_confirmation, EmailConfirmation),
    },
)
