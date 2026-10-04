"""
The agent's tools for one demo, independent of which voice engine asks for them. Each tool runs
against the calling session's own records and reports the actual result twice from the same
value: to the model (what it may say) and to the session's viewers (what the dashboard and
conversation panel show). Gemini reaches them through ADK (demo_tools); ElevenLabs through
run_tool. Arguments are validated here with each operation's Pydantic model in both cases.

Gemini 3.8 Live runs function calls asynchronously unless told otherwise, and a result that
arrives later starts a new model turn. So every tool states its behaviour: BLOCKING for anything
whose result the agent needs before it speaks (every demo tool returns in well under a
millisecond, so blocking costs nothing), NON_BLOCKING with SILENT scheduling for end_call, which
comes after the goodbye and must never make the agent talk again.
"""

from __future__ import annotations

import inspect
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types
from pydantic import BaseModel, ValidationError

from . import log
from .demos.types import DemoDefinition, OpContext, OpResult, fail, mask_number
from .session import DemoSession, get_session

Result = dict[str, Any]


@dataclass
class ToolSpec:
    name: str
    description: str
    run: Callable[[DemoSession, dict[str, Any]], Awaitable[Result]]
    params: Optional[type[BaseModel]] = None
    background: bool = False


def _call_id() -> str:
    return uuid.uuid4().hex[:8]


def _operation_spec(name: str, op: Any) -> ToolSpec:
    async def run(session: DemoSession, args: dict[str, Any]) -> Result:
        if op.params is not None:
            try:
                parsed: Any = op.params.model_validate(args)
            except ValidationError as err:
                issues = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in err.errors())
                return {"ok": False, "error": "invalid_arguments", "message": issues}
        else:
            parsed = args
        call_id = _call_id()
        started = time.monotonic()
        session.emit({"type": "tool.started", "callId": call_id, "tool": name, "label": op.label})
        r: OpResult
        if "callerConfirmed" in args and args.get("callerConfirmed") is not True:
            r = fail("not_confirmed", "Read the details back and get a clear yes from the caller first.")
        else:
            try:
                out = op.run(session.state, parsed, OpContext(now=datetime.now(timezone.utc), channel=session.channel))  # type: ignore[arg-type]
                r = await out if inspect.isawaitable(out) else out
            except Exception as err:  # noqa: BLE001
                log.error("tool.crashed", {"session": session.id, "tool": name}, err)
                r = fail("internal_error", "Something went wrong. Apologise and offer to take a message instead.")
        log.info("tool.result", {"session": session.id, "tool": name, "outcome": "ok" if r.ok else r.error, "latency_ms": int((time.monotonic() - started) * 1000)})
        # A failure can change records too (the travel demo notes a booking it stopped).
        if r.changed:
            session.publish_state()
        if r.ok:
            session.emit({"type": "tool.succeeded", "callId": call_id, "tool": name, "label": op.label, "summary": r.summary, "version": session.version})
            return {"ok": True, **r.result}
        session.emit({"type": "tool.failed", "callId": call_id, "tool": name, "label": op.label, "summary": r.summary or r.message})
        return {"ok": False, "error": r.error, "message": r.message, **r.result}

    return ToolSpec(name=name, description=op.description, run=run, params=op.params, background=op.background)


class LinkScreen(BaseModel):
    code: str


async def _get_caller_number(session: DemoSession, _: dict[str, Any]) -> Result:
    if session.channel != "phone":
        return {"ok": False, "error": "not_a_phone_call", "message": "This is a website conversation; ask for a number if one is needed."}
    call_id = _call_id()
    label = "Checking the number you’re calling from"
    session.emit({"type": "tool.started", "callId": call_id, "tool": "get_caller_number", "label": label})
    n = session.caller_number
    if not n:
        session.emit({"type": "tool.failed", "callId": call_id, "tool": "get_caller_number", "label": label, "summary": "Caller ID withheld"})
        return {"ok": False, "error": "withheld", "message": "The caller's number is hidden. Ask for a callback number."}
    session.emit({"type": "tool.succeeded", "callId": call_id, "tool": "get_caller_number", "label": label, "summary": f"Calling from {mask_number(n)}", "version": session.version})
    return {"ok": True, "number": n, "lastFour": n[-4:]}


async def _link_screen(session: DemoSession, args: dict[str, Any]) -> Result:
    if not session.link_screen:
        return {"ok": False, "error": "not_a_phone_call", "message": "This conversation is already on the website."}
    result = session.link_screen("".join(c for c in str(args.get("code", "")) if c.isdigit()))
    if result == "linked":
        return {"ok": True, "linked": True}
    return {"ok": False, "error": result, "message": "That code did not match a waiting screen. Ask them to check the code on the page."}


async def _end_call(session: DemoSession, _: dict[str, Any]) -> Result:
    session.request_end("agent_ended")
    return {"ok": True}


def tool_specs(demo: DemoDefinition[Any]) -> list[ToolSpec]:
    return [
        *(_operation_spec(name, op) for name, op in demo.operations.items()),
        ToolSpec(
            "get_caller_number",
            'The phone number this caller is calling from, when the network provides it. Use it instead of asking them to recite a number: confirm it by its last four digits ("the number ending 0142"), and use the full number for take_message if they agree. Not available in website conversations.',
            _get_caller_number,
        ),
        ToolSpec(
            "link_screen",
            "Link this phone call to the caller's screen when they read you the four-digit code shown on the website, so they can watch the dashboard. Pass only the digits.",
            _link_screen,
            LinkScreen,
        ),
        ToolSpec("end_call", "End the conversation after you have said goodbye.", _end_call, background=True),
    ]


async def run_tool(specs: list[ToolSpec], session: DemoSession, name: str, args: Any) -> Result:
    """Runs a tool by name for engines without their own tool loop (ElevenLabs)."""
    spec = next((s for s in specs if s.name == name), None)
    if spec is None:
        return {"ok": False, "error": "unknown_tool"}
    if session.ended:
        return {"ok": False, "error": "session_ended"}
    return await spec.run(session, args if isinstance(args, dict) else {})


# ---- ADK ----

_TYPES = {"string": types.Type.STRING, "integer": types.Type.INTEGER, "number": types.Type.NUMBER, "boolean": types.Type.BOOLEAN, "object": types.Type.OBJECT, "array": types.Type.ARRAY}


def _schema(node: dict[str, Any]) -> types.Schema:
    """A Pydantic JSON schema node as a Gemini Schema. Covers what the demos use: flat objects of
    strings, numbers, booleans and string enums, optional fields included."""
    if "anyOf" in node:
        branches = [b for b in node["anyOf"] if b.get("type") != "null"]
        merged = {**branches[0], **{k: v for k, v in node.items() if k not in ("anyOf", "default")}}
        s = _schema(merged)
        s.nullable = len(branches) < len(node["anyOf"]) or None
        return s
    s = types.Schema(type=_TYPES[node.get("type", "string")], description=node.get("description"))
    if "enum" in node:
        s.enum = [str(v) for v in node["enum"]]
    for src, dst in (("pattern", "pattern"), ("minLength", "min_length"), ("maxLength", "max_length"), ("minimum", "minimum"), ("maximum", "maximum")):
        if src in node:
            setattr(s, dst, node[src])
    if node.get("type") == "object":
        s.properties = {k: _schema(v) for k, v in (node.get("properties") or {}).items()}
        s.required = node.get("required") or None
    return s


class DemoTool(BaseTool):
    """
    One demo tool for ADK: declares its schema and, on Gemini Live, its behaviour; runs in the caller's
    session. On the cascade (a text model, live=False) calls are ordinary and blocking; a background
    tool (end_call) ends the model's turn instead of prompting it to speak again.
    """

    def __init__(self, spec: ToolSpec, live: bool = True) -> None:
        super().__init__(
            name=spec.name,
            description=spec.description,
            behavior=(types.Behavior.NON_BLOCKING if spec.background else types.Behavior.BLOCKING) if live else None,
            response_scheduling=types.FunctionResponseScheduling.SILENT if spec.background and live else None,
        )
        self.spec = spec
        self.live = live

    def _get_declaration(self) -> Optional[types.FunctionDeclaration]:
        params = _schema(self.spec.params.model_json_schema()) if self.spec.params else None
        return types.FunctionDeclaration(name=self.name, description=self.description, parameters=params)

    async def run_async(self, *, args: dict[str, Any], tool_context: ToolContext) -> Any:
        session = get_session(tool_context.session.id)
        if session is None or session.ended:
            return {"ok": False, "error": "session_ended"}
        if self.spec.background and not self.live:
            tool_context.actions.skip_summarization = True
        return await self.spec.run(session, args or {})


def demo_tools(demo: DemoDefinition[Any], live: bool = True) -> list[BaseTool]:
    return [DemoTool(spec, live) for spec in tool_specs(demo)]
