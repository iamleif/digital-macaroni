import asyncio
import json
from typing import Any
from urllib.parse import parse_qs, urlparse

import numpy as np
import pytest

from app import cascade, stt
from app.cascade import Cascade, finished
from app.config import config
from app.session import DemoSession


def setflag(monkeypatch, name: str, value: Any) -> None:
    # Config is a frozen dataclass; restored after each test by restore_config.
    _restore.append((name, getattr(config, name)))
    object.__setattr__(config, name, value)


_restore: list[tuple[str, Any]] = []


@pytest.fixture(autouse=True)
def restore_config():
    yield
    while _restore:
        n, v = _restore.pop()
        object.__setattr__(config, n, v)


class FakeWS:
    def __init__(self, fail: bool = False) -> None:
        self.sent: list[Any] = []
        self.fail = fail

    async def send(self, data: Any) -> None:
        if self.fail:
            raise ConnectionError("gone")
        self.sent.append(data)


# ---- agent context ----

async def test_connect_url_carries_the_opening_as_agent_context(monkeypatch):
    seen: dict[str, Any] = {}

    async def connect(url, **kw):
        seen["url"] = url
        return FakeWS()

    monkeypatch.setattr(stt.websockets, "connect", connect)
    setflag(monkeypatch, "stt_provider", "assemblyai")
    setflag(monkeypatch, "assemblyai_api_key", "k")
    t = await stt.open_transcriber([], None, "Thanks for calling. " + "x" * 2000)
    q = parse_qs(urlparse(seen["url"]).query)
    assert len(q["agent_context"][0]) <= 1750
    assert isinstance(t, stt.AssemblyTranscriber)
    setflag(monkeypatch, "agent_context", False)
    await stt.open_transcriber([], None, "Hello there.")
    assert "agent_context" not in parse_qs(urlparse(seen["url"]).query)


async def test_update_configuration_after_a_reply(monkeypatch):
    ws = FakeWS()
    t = stt.AssemblyTranscriber(ws)
    await t.set_agent_context("**Great.** See [this](http://x.y) option off_0000abcdefgh. What date works?")
    msg = json.loads(ws.sent[0])
    assert msg["type"] == "UpdateConfiguration"
    assert msg["agent_context"].startswith("Great. See this option") and msg["agent_context"].endswith("What date works?")
    assert "*" not in msg["agent_context"] and "off_" not in msg["agent_context"] and "http" not in msg["agent_context"]
    await t.set_agent_context("   ")
    assert len(ws.sent) == 1
    await t.set_agent_context("a " * 2000)
    assert len(json.loads(ws.sent[1])["agent_context"]) <= 1750


async def test_send_failure_is_swallowed():
    await stt.AssemblyTranscriber(FakeWS(fail=True)).set_agent_context("What date?")


async def test_gemini_transcriber_ignores_context():
    assert await stt.GeminiTranscriber(None, None).set_agent_context("What date?") is None


# ---- speculative start ----

class FakeStt:
    def __init__(self, decides: bool = True) -> None:
        self.decides_turns = decides
        self.contexts: list[str] = []

    async def send(self, pcm: bytes) -> None: ...
    async def end_of_speech(self) -> None: ...
    async def force_end(self) -> None: ...
    async def close(self) -> None: ...
    async def set_agent_context(self, text: str) -> None:
        self.contexts.append(text)


LOUD = (np.ones(320) * 5000).astype("<i2").tobytes()
QUIET = bytes(640)


def make(decides: bool = True) -> Cascade:
    c = Cascade(DemoSession("travel", "web"))
    c.stt = FakeStt(decides)  # type: ignore[assignment]
    return c


async def speak_then_pause(c: Cascade, interim: str, monkeypatch) -> None:
    monkeypatch.setattr(cascade, "END_OF_TURN_S", 0.02)
    task = asyncio.create_task(c._send_audio())
    c.audio_in.put_nowait(LOUD)
    await asyncio.sleep(0.01)
    c._interim(interim)
    await asyncio.sleep(0.03)
    c.audio_in.put_nowait(QUIET)
    await asyncio.sleep(0.05)
    c.audio_in.put_nowait(None)
    await task


def test_finished_lenient_reads_unpunctuated_interims():
    assert finished("I want to fly to Denver", lenient=True)
    assert not finished("I want to fly to Denver")
    assert not finished("my name is", lenient=True)
    assert not finished("I want to fly to Denver and", lenient=True)
    assert not finished("hello", lenient=True)


async def test_a_finished_interim_starts_a_reply_before_the_final(monkeypatch):
    c = make()
    await speak_then_pause(c, "I want to fly to Denver next Friday.", monkeypatch)
    text, _, _, speculative = c.inputs.get_nowait()
    assert speculative and "Denver" in text and c.speculated == text
    # the final matches: the reply carries on
    c._final("I want to fly to Denver next Friday.")
    assert not c.speculation_dropped and c.inputs.empty()


async def test_a_different_final_discards_the_speculation(monkeypatch):
    c = make()
    await speak_then_pause(c, "I want to fly to Denver next Friday.", monkeypatch)
    c.inputs.get_nowait()
    c._final("I want to fly to Dallas next Friday.")
    assert c.speculation_dropped
    assert c.inputs.get_nowait()[0] == "I want to fly to Dallas next Friday."
    # a dropped speculation never runs
    await c._run("x", 0.0, 0.0, True)
    assert c.turn is None and c.tail is None


async def test_a_trailing_interim_does_not_start_a_reply(monkeypatch):
    c = make()
    await speak_then_pause(c, "my name is", monkeypatch)
    assert c.inputs.empty() and c.speculated is None


async def test_speculation_flag_off_restores_waiting_for_the_final(monkeypatch):
    setflag(monkeypatch, "speculative", False)
    c = make()
    await speak_then_pause(c, "I want to fly to Denver next Friday.", monkeypatch)
    assert c.inputs.empty()


async def test_gemini_style_transcribers_still_speculate_with_the_flag_off(monkeypatch):
    setflag(monkeypatch, "speculative", False)
    c = make(decides=False)
    await speak_then_pause(c, "I want to fly to Denver next Friday.", monkeypatch)
    assert not c.inputs.empty()


def test_opening_for_the_channel():
    assert "number on your screen" in Cascade(DemoSession("travel", "phone"))._opening()
    assert "number on your screen" not in Cascade(DemoSession("travel", "web"))._opening()


# ---- fallback model ----

async def test_a_failing_primary_falls_back_within_the_turn(monkeypatch):
    from google.adk.agents import LlmAgent
    from google.adk.models import BaseLlm, LlmResponse
    from google.adk.runners import InMemoryRunner
    from google.genai import errors, types

    class Down(BaseLlm):
        async def generate_content_async(self, llm_request, stream=False):
            raise errors.ServerError(503, {"error": {"message": "overloaded"}})
            yield  # pragma: no cover

    class Slow(BaseLlm):
        async def generate_content_async(self, llm_request, stream=False):
            raise TimeoutError()
            yield  # pragma: no cover

    class Backup(BaseLlm):
        async def generate_content_async(self, llm_request, stream=False):
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text="Backup here.")]))

    for primary in (Down(model="primary"), Slow(model="primary")):
        model = cascade.CascadeFallbackModel(models=[primary, Backup(model="backup")])
        agent = LlmAgent(name="t", model=model, instruction="x")
        r = InMemoryRunner(agent=agent, app_name="t")
        await r.session_service.create_session(app_name="t", user_id="u", session_id="s")
        out = [e async for e in r.run_async(user_id="u", session_id="s", new_message=types.Content(role="user", parts=[types.Part(text="hi")]))]
        assert any(p.text == "Backup here." for e in out if e.content for p in e.content.parts or [])


def test_text_model_switch(monkeypatch):
    assert isinstance(cascade.text_model(), cascade.CascadeFallbackModel)
    setflag(monkeypatch, "text_fallback_model", "")
    assert cascade.text_model() == config.text_model


def test_a_scripted_result_takes_the_place_of_the_acknowledgement():
    from app.cascade import _scripted

    assert _scripted({"ok": True, "say": "Great, I'll send everything for them."})
    assert _scripted({"ok": True, "knownCustomer": {"car": "Civic", "say": "Welcome them back."}})
    assert _scripted({"ok": True, "guide": "In your own words: the visit is $129."})
    assert not _scripted({"ok": True, "next": "What's your date of birth?", "say": ""})
