"""
A demo business: its fixtures, its agent's instructions, and the operations the agent may ask
for. Operations are plain functions over one session's state, so they run and are tested without
a model. The agent only ever hears what an operation actually returned.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Awaitable, Callable, Generic, Literal, Optional, TypeVar, Union
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

Channel = Literal["phone", "browser"]
S = TypeVar("S")


@dataclass
class OpContext:
    now: datetime
    channel: Channel
    # The work email the visitor typed on the website setup card: the only address any email may go to.
    customer_email: Optional[str] = None


@dataclass
class OpResult:
    ok: bool
    summary: str = ""
    result: dict[str, Any] = field(default_factory=dict)
    changed: bool = False
    error: str = ""
    message: str = ""


def ok(summary: str, result: dict[str, Any], changed: bool = False) -> OpResult:
    return OpResult(ok=True, summary=summary, result=result, changed=changed)


def fail(error: str, message: str, result: Optional[dict[str, Any]] = None) -> OpResult:
    return OpResult(ok=False, error=error, message=message, result=result or {})


@dataclass
class Operation(Generic[S]):
    # What the conversation panel shows while it runs, e.g. "Checking availability".
    label: str
    description: str
    # Plain demos answer from their own fixtures; one backed by an outside API may be async.
    run: Callable[[S, Any, OpContext], Union[OpResult, Awaitable[OpResult]]]
    params: Optional[type[BaseModel]] = None
    # Runs alongside the conversation and its result never starts a turn of its own (3.8 Live:
    # NON_BLOCKING with SILENT scheduling). Only for a call the agent makes after it has finished
    # speaking (hanging up): a SILENT result never prompts the model to carry on, so a tool the agent
    # calls before it speaks must stay BLOCKING or the agent falls silent.
    background: bool = False
    # Slow enough (an outside search taking seconds) that the caller hears a holding line while it runs.
    slow: bool = False
    # Changes state or has an outside effect (books, cancels, notes, emails, chooses). Only operations that are
    # clearly read-only set this False; the default is safe. Writes wait for the final transcript on a speculative turn.
    writes: bool = True


@dataclass
class DemoDefinition(Generic[S]):
    id: str
    business_name: str
    agent_name: str
    create_state: Callable[[datetime], S]
    instruction: Callable[[S, OpContext], str]
    operations: dict[str, Operation[S]]
    # The records the dashboard shows. Never includes anything the visitor should not see.
    view: Callable[[S], dict[str, Any]]
    # Cascade only: how the TTS voice should sound, and words the transcription should expect.
    voice_style: str = ""
    vocabulary: list[str] = field(default_factory=list)
    # Lines the agent says word for word (its openings); their audio is synthesised once and reused.
    fixed_lines: list[str] = field(default_factory=list)
    # Longest conversation in seconds; 0 uses the service-wide DEMO_MAX_SESSION_SECONDS.
    max_seconds: int = 0
    # Has a dashboard page a phone caller can link with a screen code (the generic agent has none).
    screen: bool = True
    # Can play a phone ring down the line (the instant demo: "Okay, here we go", ring, then the business answers).
    ring: bool = False


def Confirmed() -> Any:
    """
    Writes take this flag. The tool layer refuses the call unless it is true, so the model has to make
    a deliberate, visible confirmation step before anything is booked, reserved or cancelled.
    """
    return Field(description="True only after you read the details back and the caller clearly said yes.")


def mask_number(n: str) -> str:
    """A phone number for display: only its last four digits."""
    digits = "".join(c for c in n if c.isdigit())
    return f"•••• {digits[-4:]}" if len(digits) >= 4 else "••••"


def date_in(time_zone: str, at: datetime) -> tuple[str, int, int]:
    """Calendar date (YYYY-MM-DD), hour and minute in the business's time zone."""
    local = at.astimezone(ZoneInfo(time_zone))
    return local.strftime("%Y-%m-%d"), local.hour, local.minute


def add_days(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def weekday(day: str) -> int:
    """0 is Sunday, as in JavaScript."""
    return (date.fromisoformat(day).weekday() + 1) % 7


def date_label(day: str) -> str:
    d = date.fromisoformat(day)
    return f"{d.strftime('%A')}, {d.strftime('%B')} {d.day}"


def reference(prefix: str, seq: int, seed: str) -> str:
    """A short reference the agent can read out: letters that are hard to mishear, then digits."""
    h = 0
    for c in seed:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return f"{prefix}-{((h + seq * 7919) % 900) + 100}"


# ---- The email at the end of every call ----

RECAP_HELP = "Only when nothing was booked or reserved: two or three plain sentences, written to the caller, on what they asked and what you did (a message for the team, prices or options you gave). Never include anything they did not hear on the call."


def email_offer(tool: str, booking: str) -> str:
    """The instruction every agent follows before a call ends: offer the email, whatever happened on the call."""
    return f"""Email: before the call ends, offer once to email a copy: the {booking}, or if none a short summary of the call. If they want it, call {tool} with callerConfirmed true; when there is no {booking}, also pass recap. If it returns need_email, follow it. Say it's on its way only if it returns ok. If they want it sent elsewhere, say that for security you can only send to the email they signed up with, and offer that."""


NEED_EMAIL = "No signup email on file: ask for the address, read it back letter by letter (the part before the @ spelled out, then the rest), and once they clearly confirm it call again with email and callerConfirmed true."


def email_target(ctx: OpContext, spoken: Optional[str]) -> tuple[Optional[str], Optional[OpResult]]:
    """
    Where an email goes. With a signup email on file it is the only address: an empty or matching argument is
    fine, a different one is refused. Without one, the address the caller gave and confirmed (or need_email).
    """
    from .. import email

    given = (spoken or "").strip()
    if ctx.customer_email:
        if given and email.normalise(given) != email.normalise(ctx.customer_email):
            return None, fail("email_on_file_only", "For security I can only send to the email they signed up with. Say that, and offer to send it there.")
        return ctx.customer_email, None
    if not given:
        return None, fail("need_email", NEED_EMAIL)
    return given, None


def already_sent(emailed: Optional[dict[str, Any]], spoken: str, kind: str) -> bool:
    """The same email to the same address twice in one call is skipped; anything else goes out."""
    from .. import email

    target = email.normalise(spoken)
    return bool(emailed and target and emailed.get("kind") == kind and emailed.get("to") == email.mask(target))


async def send_summary(brand: str, agent: str, to: str, recap: Optional[str], name: Optional[str], messages: list[dict[str, Any]], rows: Optional[list[tuple[str, str]]] = None, did: Optional[str] = None) -> tuple[OpResult, Optional[dict[str, Any]]]:
    """Emails a call summary (no booking to confirm). Returns the result and what to keep as state.emailed."""
    from .. import email

    if not (recap and recap.strip()) and not messages:
        return fail("no_recap", "Nothing was booked, so pass recap: two or three sentences on what the caller asked and what you did."), None
    c = {"name": name, "recap": (recap or "").strip(), "messages": messages, "rows": rows or [], "did": did}
    masked, why = await email.confirm(to, email.call_summary(brand, agent, c))
    if why:
        return fail(why if why in email.REFUSALS else "email_failed", email.REFUSALS.get(why, "The email could not be sent right now. Apologise briefly.")), None
    return ok(f"Call summary emailed · {masked}", {"sent": True, "to": masked}, True), {"to": masked, "kind": "summary"}
