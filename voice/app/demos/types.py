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
