"""
A demo conversation on ElevenLabs Agents. Our server is the agent's only client: it relays the
visitor's audio (16 kHz PCM) and the agent's (24 kHz PCM), and runs the agent's tools itself as
client tools, so the session's records, dashboard and transcript work exactly as with Gemini.
The agent's instructions are replaced per conversation from the same source as Gemini's.
Speaks the same LiveSession interface as the Gemini adapter.
"""

from __future__ import annotations

import asyncio
import base64
import json
import re
from typing import Any, AsyncIterator, Optional
from urllib.parse import quote

import httpx
import websockets

from . import log
from .config import config
from .live import LiveEvent
from .session import DemoSession
from .tools import run_tool, tool_specs

API = "https://api.elevenlabs.io"
# Tools are registered with a prefix (scripts/elevenlabs-setup.ts) so they cannot clash in the workspace.
TOOL_PREFIX = "ff_"
# No agent audio for this long means its turn has finished.
TURN_IDLE_S = 0.7


class ElevenLabsLive:
    greets_itself = True

    def __init__(self, session: DemoSession, ws: Any) -> None:
        self.session = session
        self.ws = ws
        self.specs = tool_specs(session.demo)
        self.out: asyncio.Queue[Optional[LiveEvent]] = asyncio.Queue()
        self.interrupted_at = -1
        self.speaking = False
        self.idle: Optional[asyncio.TimerHandle] = None
        self.reader = asyncio.create_task(self._read())

    def _push(self, e: LiveEvent) -> None:
        self.out.put_nowait(e)

    def _turn_idle(self) -> None:
        self.speaking = False
        self._push(LiveEvent("turn_complete"))

    async def _send(self, msg: dict[str, Any]) -> None:
        try:
            await self.ws.send(json.dumps(msg))
        except Exception:  # noqa: BLE001
            pass

    async def _tool(self, call: dict[str, Any]) -> None:
        name = call["tool_name"]
        name = name[len(TOOL_PREFIX) :] if name.startswith(TOOL_PREFIX) else name
        try:
            result = await run_tool(self.specs, self.session, name, call.get("parameters"))
        except Exception as err:  # noqa: BLE001
            log.error("elevenlabs.tool_failed", {"session": self.session.id, "tool": name}, err)
            result = {"ok": False, "error": "internal_error"}
        await self._send({"type": "client_tool_result", "tool_call_id": call["tool_call_id"], "result": json.dumps(result), "is_error": result.get("ok") is False})

    async def _read(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            async for raw in self.ws:
                try:
                    e = json.loads(raw)
                except ValueError:
                    continue
                kind = e.get("type")
                if kind == "ping":
                    await self._send({"type": "pong", "event_id": e["ping_event"]["event_id"]})
                elif kind == "audio":
                    a = e["audio_event"]
                    # Audio generated before an interruption arrives late sometimes; it must not play.
                    if a["event_id"] <= self.interrupted_at:
                        continue
                    self.speaking = True
                    self._push(LiveEvent("audio", data=base64.b64decode(a["audio_base_64"])))
                    if self.idle:
                        self.idle.cancel()
                    self.idle = loop.call_later(TURN_IDLE_S, self._turn_idle)
                elif kind == "interruption":
                    self.interrupted_at = e["interruption_event"]["event_id"]
                    if self.idle:
                        self.idle.cancel()
                    if self.speaking:
                        self._push(LiveEvent("interrupted"))
                    self.speaking = False
                elif kind == "tentative_user_transcript":
                    self._push(LiveEvent("transcript_set", speaker="visitor", text=e["tentative_user_transcription_event"]["user_transcript"], finished=False))
                elif kind == "user_transcript":
                    self._push(LiveEvent("transcript_set", speaker="visitor", text=e["user_transcription_event"]["user_transcript"], finished=True))
                elif kind == "agent_response":
                    self._push(LiveEvent("transcript", speaker="agent", text=e["agent_response_event"]["agent_response"], finished=True))
                elif kind == "agent_response_correction":
                    self._push(LiveEvent("agent_correction", text=e["agent_response_correction_event"]["corrected_agent_response"]))
                elif kind == "client_tool_call":
                    asyncio.create_task(self._tool(e["client_tool_call"]))
                elif kind == "client_error":
                    err = e.get("error_event") or {}
                    log.warn("elevenlabs.client_error", {"session": self.session.id, "error_code": err.get("code"), "outcome": err.get("error_name")})
        except Exception as err:  # noqa: BLE001
            log.warn("elevenlabs.socket_error", {"session": self.session.id}, err)
        finally:
            log.info("elevenlabs.closed", {"session": self.session.id})
            if self.idle:
                self.idle.cancel()
            self.out.put_nowait(None)

    def send_audio(self, pcm16k: bytes) -> None:
        asyncio.create_task(self._send({"user_audio_chunk": base64.b64encode(pcm16k).decode()}))

    def send_text(self, text: str) -> None:
        asyncio.create_task(self._send({"type": "user_message", "text": text}))

    async def events(self) -> AsyncIterator[LiveEvent]:
        while True:
            e = await self.out.get()
            if e is None:
                return
            yield e

    async def close(self) -> None:
        try:
            await self.ws.close(1000)
        except Exception:  # noqa: BLE001
            pass


async def open_elevenlabs(session: DemoSession, agent_id: str, instruction: str) -> ElevenLabsLive:
    prompt = instruction
    for s in tool_specs(session.demo):
        prompt = re.sub(rf"\b{re.escape(s.name)}\b", f"{TOOL_PREFIX}{s.name}", prompt)
    async with httpx.AsyncClient(timeout=8) as http:
        r = await http.get(f"{API}/v1/convai/conversation/get-signed-url?agent_id={quote(agent_id)}", headers={"xi-api-key": config.elevenlabs_api_key})
    if r.status_code != 200:
        raise RuntimeError(f"signed url {r.status_code}")
    ws = await asyncio.wait_for(websockets.connect(r.json()["signed_url"], max_size=None), timeout=8)
    await ws.send(json.dumps({"type": "conversation_initiation_client_data", "conversation_config_override": {"agent": {"prompt": {"prompt": prompt}}}}))
    return ElevenLabsLive(session, ws)
