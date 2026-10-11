"""
The generic business agent behind the agent factory: one agent, any business. What it knows comes
from the session's business profile (profile.py, built from the business's website and, for a
client, their setup form). It answers from that profile, takes messages, and texts the booking link
when the business has one. Two modes:

- instant: the agent rings a prospect who asked on the website; they play a customer of their own
  business. Afterwards they get the summary their business would get after every real call.
- client: a paying client's line, answering their real callers. The owner gets the summary.

Folder: this file (state, operations, definition) and prompt.py (the instructions).
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ... import twilio_api
from ...profile import profile_facts
from ..types import Confirmed, DemoDefinition, OpContext, OpResult, Operation, date_in, date_label, fail, mask_number, ok, reference
from .prompt import instruction

Mode = Literal["instant", "client"]


@dataclass
class Message:
    id: str
    name: str
    callback: str
    reason: str
    preferred_time: Optional[str]
    urgent: bool
    at: str


@dataclass
class AgentState:
    now: datetime
    mode: Mode = "client"
    profile: dict[str, Any] = field(default_factory=dict)
    agent_name: str = "Ava"
    # Instant mode: the prospect the agent is calling (first name only).
    visitor_name: str = ""
    # Instant mode: where the meeting link goes, and whether it went.
    visitor_email: str = ""
    meeting_sent: bool = False
    # Client mode: what the owner told us on the setup form, beyond the website.
    notes: str = ""
    never_say: str = ""
    caller_number: Optional[str] = None
    messages: list[Message] = field(default_factory=list)
    booking_texted: bool = False
    seq: int = 0
    seed: str = field(default_factory=lambda: secrets.token_hex(4))

    @property
    def business(self) -> str:
        return self.profile.get("business_name") or "the business"

    @property
    def time_zone(self) -> str:
        return self.profile.get("time_zone") or "America/New_York"


def create_state(now: datetime) -> AgentState:
    return AgentState(now=now)


def get_business_info(state: AgentState, _: Any, ctx: OpContext) -> OpResult:
    day, hour, minute = date_in(state.time_zone, ctx.now)
    facts = profile_facts(state.profile)
    facts.pop("time_zone", None)
    if state.notes:
        facts["owner_notes"] = state.notes
    facts["right_now"] = f"{date_label(day)}, {hour % 12 or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'} local time"
    return ok(f"What {state.business} offers", facts)


class TakeMessage(BaseModel):
    name: str = Field(min_length=1, max_length=80, description="The caller's name.")
    callbackNumber: str = Field(min_length=7, max_length=20, description="Their confirmed callback number.")
    reason: str = Field(min_length=3, max_length=400, description="What they need, in a sentence or two, with any details they gave (service, address, dates).")
    preferredTime: Optional[str] = Field(None, max_length=80, description="When they'd like a call back, in their words.")
    urgent: bool = Field(False, description="True only for an emergency or something that can't wait until the next business day.")


def take_message(state: AgentState, i: TakeMessage, ctx: OpContext) -> OpResult:
    dup = next((m for m in state.messages if m.name == i.name.strip() and m.reason == i.reason.strip()), None)
    if dup:
        return ok(f"Message already taken · {dup.id}", {"messageId": dup.id, "duplicate": True})
    mid = reference("MSG", state.seq, state.seed)
    state.seq += 1
    state.messages.append(Message(mid, i.name.strip(), i.callbackNumber.strip(), i.reason.strip(), (i.preferredTime or "").strip() or None, i.urgent, ctx.now.isoformat()))
    who = "the owner" if state.mode == "client" else "the team"
    return ok(f"{'Urgent message' if i.urgent else 'Message'} for {who} · {mid}", {"messageId": mid, "sentTo": who, "deliveredAfterCall": True}, True)


class TextBookingLink(BaseModel):
    callerConfirmed: bool = Confirmed()


async def text_booking_link(state: AgentState, i: TextBookingLink, ctx: OpContext) -> OpResult:
    url = state.profile.get("booking_url")
    if not url:
        return fail("no_booking_link", "This business has no online booking link. Offer to take a message so the team can book them in.")
    if ctx.channel != "phone" or not state.caller_number:
        return fail("no_number", "There's no number to text on this call. Read the website address instead, or take a message.")
    if state.booking_texted:
        return ok(f"Booking link already texted · {mask_number(state.caller_number)}", {"sent": True, "duplicate": True})
    sent = await twilio_api.send_sms(state.caller_number, f"{state.business}: book a time that suits you here: {url}\nReply STOP to opt out.")
    if not sent:
        return fail("sms_failed", "The text couldn't be sent right now. Read out the website instead, or take a message.")
    state.booking_texted = True
    return ok(f"Booking link texted · {mask_number(state.caller_number)}", {"sent": True}, True)


async def send_meeting_link(state: AgentState, _: Any, ctx: OpContext) -> OpResult:
    """Instant demo: emails the prospect a link to book a meeting with Digital Macaroni, while they're still on the call."""
    if state.mode != "instant" or not state.visitor_email:
        return fail("not_available", "There's no email to send a meeting link to on this call.")
    if state.meeting_sent:
        return ok("Meeting link already emailed", {"sent": True, "duplicate": True})
    from ...factory import send_meeting_email

    if not await send_meeting_email(state.visitor_name, state.visitor_email, state.business):
        return fail("email_failed", "The email couldn't be sent right now. Say the team will reach out by email instead.")
    state.meeting_sent = True
    return ok("Meeting link emailed", {"sent": True}, True)


def view(state: AgentState) -> dict[str, Any]:
    return {
        "business": state.business,
        "mode": state.mode,
        "messages": [{"id": m.id, "name": m.name, "callback": mask_number(m.callback), "reason": m.reason, "urgent": m.urgent} for m in state.messages],
        "bookingTexted": state.booking_texted,
    }


agent: DemoDefinition[AgentState] = DemoDefinition(
    id="agent",
    business_name="Your business",
    agent_name="Ava",
    create_state=create_state,
    instruction=instruction,
    view=view,
    screen=False,
    ring=True,
    operations={
        "get_business_info": Operation("Looking up the business", "Everything known about the business: services, hours, location, service area, prices, policies, FAQs, the owner's notes and the local time right now. Call it before answering any question about the business, and answer only from what it returns.", get_business_info),
        "take_message": Operation("Taking a message", "Take a message for the business after the caller confirmed their callback number. It reaches the owner by text and email the moment the call ends.", take_message, TakeMessage),
        "send_meeting_link": Operation("Emailing a link to book a meeting", "Instant demo only: email the prospect a link to book a meeting with Digital Macaroni's team. Call it once, at the close of the demo.", send_meeting_link),
        "text_booking_link": Operation("Texting the booking link", "Text the business's online booking link to the number the caller is calling from, after they said yes to a text. Only when get_business_info has a booking_url.", text_booking_link, TextBookingLink),
    },
)
