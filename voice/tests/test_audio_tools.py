import base64
import math

import numpy as np

from app.audio import MU_TO_LIN, PhoneEncoder, gemini_to_twilio, twilio_to_gemini, voice_stats
from app.demos import demos
from app.tools import DemoTool, tool_specs
from google.genai import types


def tone(hz: float, seconds: float, rate: int = 24000, amp: int = 12000) -> bytes:
    n = round(seconds * rate)
    return (np.rint(amp * np.sin(2 * math.pi * hz * np.arange(n) / rate))).astype("<i2").tobytes()


def rms_of_mu_law(mu: bytes) -> float:
    x = MU_TO_LIN[np.frombuffer(mu, dtype=np.uint8)[200:]].astype(np.float64)  # skip the filter's start-up
    return float(np.sqrt(np.mean(x * x)))


def test_phone_encoder_keeps_speech_and_removes_what_would_alias():
    voice = rms_of_mu_law(PhoneEncoder().encode(tone(1000, 0.5)))
    high = rms_of_mu_law(PhoneEncoder().encode(tone(6000, 0.5)))
    high_old = rms_of_mu_law(gemini_to_twilio(tone(6000, 0.5)))
    assert voice > 7000
    assert high < voice * 0.05
    # The plain per-chunk resampler lets it through as a 2 kHz alias.
    assert high_old > voice * 0.5


def test_phone_encoder_output_is_identical_however_audio_is_chunked():
    audio = tone(440, 0.3)
    whole = PhoneEncoder().encode(audio)
    enc = PhoneEncoder()
    parts = b"".join(enc.encode(audio[o : o + 2 * 997]) for o in range(0, len(audio), 2 * 997))
    assert parts == whole


def test_twilio_audio_becomes_16k_pcm():
    assert len(twilio_to_gemini(b"\xff" * 160)) == 320 * 2


def test_voice_stats_measures_pitch_and_loudness():
    s = voice_stats(tone(220, 1))
    assert abs(s["pitchHz"] - 220) < 8 and s["loudnessDb"] > -12 and s["seconds"] == 1


def test_tools_declare_their_live_behaviour():
    tools = {t.name: t for t in (DemoTool(s) for s in tool_specs(demos["northline"]))}
    assert tools["note_request_details"].behavior == types.Behavior.BLOCKING
    assert tools["end_call"].behavior == types.Behavior.NON_BLOCKING
    assert tools["end_call"].response_scheduling == types.FunctionResponseScheduling.SILENT
    assert tools["book_appointment"].behavior == types.Behavior.BLOCKING
    decl = tools["check_availability"]._get_declaration()
    assert decl and decl.parameters and decl.parameters.properties
    assert decl.parameters.required == ["service", "date"]
    assert "heating_repair" in (decl.parameters.properties["service"].enum or [])
    assert decl.parameters.properties["partOfDay"].nullable


def test_level_meter_frames_carry_across_chunks_and_silence_is_flat():
    from app.audio import LevelMeter

    m = LevelMeter()
    speech = tone(300, 0.1) + tone(2500, 0.1)  # 200 ms: five 40 ms frames
    out = m.feed(speech[:3000]) + m.feed(speech[3000:])
    assert len(out) == 5 * LevelMeter.BANDS
    assert m.pending == 0
    frames = np.frombuffer(out, np.uint8).reshape(5, LevelMeter.BANDS)
    # A low tone lights the inner (low) bands, a high one the outer bands.
    assert frames[0].argmax() < frames[-1].argmax()
    assert LevelMeter().feed(bytes(LevelMeter.FRAME * 2 * 3)) == bytes(3 * LevelMeter.BANDS)
    assert m.feed(tone(300, 0.01)) == b"" and m.pending == 240


def test_a_tool_called_mid_reply_is_told_what_the_caller_already_heard():
    import asyncio
    from types import SimpleNamespace

    from app.session import DemoSession, sessions

    s = DemoSession("dealership", "phone")
    sessions[s.id] = s
    try:
        tools = {t.name: t for t in (DemoTool(spec) for spec in tool_specs(demos["dealership"]))}
        ctx = SimpleNamespace(session=SimpleNamespace(id=s.id))

        def run(name: str, args: dict) -> dict:
            return asyncio.run(tools[name].run_async(args=args, tool_context=ctx))  # type: ignore[arg-type]

        # Tools first, then words: an ordinary result.
        assert "alreadySaid" not in run("search_inventory", {"body": "SUV"})
        # Wes on 2026-10-11: he asked a question, then searched.
        s.said_this_turn = " Are you leaning towards an SUV   or a sedan?"
        r = run("search_inventory", {"body": "SUV"})
        assert r["ok"] and r["alreadySaid"] == "Are you leaning towards an SUV or a sedan?" and "Do not repeat" in r["afterThis"]
        # Hanging up after the goodbye stays silent and gets no note.
        assert "alreadySaid" not in run("end_call", {})
    finally:
        sessions.pop(s.id, None)


def test_cascade_notes_carry_an_acknowledgement_the_tool_never_sees():
    import asyncio
    from types import SimpleNamespace

    from app.session import DemoSession, sessions

    cascade = {t.name: t for t in (DemoTool(spec, live=False) for spec in tool_specs(demos["dealership"]))}
    live = {t.name: t for t in (DemoTool(spec) for spec in tool_specs(demos["dealership"]))}
    decl = cascade["note_lead"]._get_declaration()
    assert decl and decl.parameters and "sayNow" in decl.parameters.properties and decl.parameters.required[0] == "sayNow"
    # Only notes, and only on the cascade.
    assert "sayNow" not in (cascade["search_inventory"]._get_declaration().parameters.properties or {})
    assert "sayNow" not in (live["note_lead"]._get_declaration().parameters.properties or {})
    s = DemoSession("dealership", "phone")
    sessions[s.id] = s
    try:
        ctx = SimpleNamespace(session=SimpleNamespace(id=s.id))
        r = asyncio.run(cascade["note_lead"].run_async(args={"sayNow": "Thanks, Sam Lee.", "name": "Sam Lee"}, tool_context=ctx))  # type: ignore[arg-type]
        assert r["ok"] and s.state.lead.get("name") == "Sam Lee" and "sayNow" not in s.state.lead
        assert all("sayNow" not in (t.get("args") or {}) for t in s.record.entries if isinstance(t, dict))
    finally:
        sessions.pop(s.id, None)
