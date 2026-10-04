"""
Local verification against a running server (DEMO_SKIP_TWILIO_SIGNATURE=1 uv run uvicorn app.main:app --port 8080):
a synthetic phone call through the real Twilio webhook, media stream and Gemini Live, watched by a
paired page (linked with the keypad code) that prints the transcript, tool cards and final records.
Caller lines are spoken with macOS `say`, converted to 8 kHz mu-law and streamed in 20 ms frames.

    uv run python scripts/simulate_call.py northline [script]
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time

import httpx
import websockets

BASE = os.environ.get("DEMO_URL", "http://localhost:8080")
WS = "ws" + BASE[4:]
ORIGIN = "http://127.0.0.1:3790"
NUMBERS = {"northline": "+12068879619", "formfield": "+18302392110", "travel": "+17205996395"}
SCRIPTS = {
    "northline": [
        "Hi. My furnace stopped working this morning. Can someone come look at it tomorrow afternoon?",
        "No, nothing like that.",
        "My name is Alex Taylor, and the address is 48 Birch Lane.",
        "The first one you mentioned works for me.",
        "Yes, that's right, please book it.",
        "Actually, can we make it a bit later that day?",
        "Yes, move it to that one please.",
        "No, that's everything. Thanks, bye.",
    ],
    # A caller who only knows it is "heating or cooling": Ellie should ask, not echo it back.
    "vague": [
        "Hi, I need someone to come out. It's probably some kind of heating or cooling thing.",
        "It's the heat. The house just isn't getting warm.",
        "No, nothing like that.",
        "Tomorrow afternoon if you can.",
        "The first one works.",
        "It's Alex Taylor, at 48 Birch Lane.",
        "Yes, please book it.",
        "No, that's everything. Thanks, bye.",
    ],
    "travel": [
        "Hi, I'd like to fly from London to New York on November twentieth, coming back on the twenty seventh. Just me, economy.",
        "Tell me more about the cheapest one.",
        "Great, let's book it. My name is Alex Taylor.",
        "Yes, that's right.",
        "No, that's everything. Thanks, bye.",
    ],
    "formfield": [
        "Hi, I'm looking for a green table lamp, ideally under a hundred dollars.",
        "What's it made of, and how tall is it?",
        "Okay, the sage green one then. Can you hold one for me to pick up? My name is Sam Rivera.",
        "Yes, that's correct.",
        "That's all, thank you, bye.",
    ],
}

t0 = time.monotonic()


def stamp() -> str:
    return f"{time.monotonic() - t0:5.1f}s"


def speak(text: str, d: str, i: int) -> bytes:
    aiff, wav = f"{d}/{i}.aiff", f"{d}/{i}.wav"
    subprocess.run(["say", "-v", "Samantha", "-o", aiff, text], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "ulaw@8000", "-c", "1", aiff, wav], check=True)
    data = open(wav, "rb").read()
    at = data.index(b"data")
    size = int.from_bytes(data[at + 4 : at + 8], "little")
    return data[at + 8 : at + 8 + size]


async def main() -> None:
    demo = sys.argv[1] if len(sys.argv) > 1 else "northline"
    lines = SCRIPTS[sys.argv[2] if len(sys.argv) > 2 else demo]
    async with httpx.AsyncClient(base_url=BASE) as http:
        twiml = (await http.post("/twilio/voice", data={"To": NUMBERS[demo], "From": "+15555550142", "CallSid": "CAsim"})).text
        session_id = re.search(r'name="sessionId" value="([^"]+)"', twiml).group(1)  # type: ignore[union-attr]
        pairing = (await http.post("/pairings", json={"demo": demo}, headers={"origin": ORIGIN})).json()

    state = {"speaking": False, "last_audio": time.monotonic(), "ended": False, "final": None}
    levels = {"events": 0, "frames": 0, "late_ms": 0, "interrupted": 0}

    async def watch() -> None:
        async with websockets.connect(f"{WS}/pairings/{pairing['viewerToken']}", origin=ORIGIN) as viewer:  # type: ignore[arg-type]
            async for raw in viewer:
                e = json.loads(raw)
                t = e["type"]
                if t == "transcript" and e["final"]:
                    print(f"{stamp()}  {'AGENT ' if e['speaker'] == 'agent' else 'CALLER'}  {e['text']}", flush=True)
                elif t == "tool.started":
                    print(f"{stamp()}    ⋯ {e['label']}  [{e['tool']}]", flush=True)
                elif t == "tool.succeeded":
                    print(f"{stamp()}    ✓ {e['summary']}  (v{e['version']})", flush=True)
                elif t == "tool.failed":
                    print(f"{stamp()}    ✗ {e['label']}: {e['summary']}", flush=True)
                elif t == "agent.speaking":
                    state["speaking"] = e["speaking"]
                    state["last_audio"] = time.monotonic()
                elif t == "agent.levels":
                    levels["events"] += 1
                    levels["frames"] += len(base64.b64decode(e["levels"])) // e["bands"]
                    levels["late_ms"] = max(levels["late_ms"], e["in"])
                elif t == "audio.interrupted":
                    levels["interrupted"] += 1
                elif t == "state":
                    state["final"] = e["state"]
                elif t == "pairing.linked":
                    print(f"{stamp()}  (screen linked)", flush=True)
                elif t == "session.ended":
                    state["ended"] = True
                    print(f"{stamp()}  — session ended: {e['reason']}", flush=True)
                    print(f"           waveform: {levels['events']} level events, {levels['frames'] * 40 / 1000:.1f} s of bars, furthest ahead {levels['late_ms']} ms, {levels['interrupted']} interruptions", flush=True)
                    return

    watcher = asyncio.create_task(watch())
    await asyncio.sleep(0.3)
    silence = base64.b64encode(b"\xff" * 160).decode()
    talking = asyncio.Event()

    async with websockets.connect(f"{WS}/twilio/media") as twilio:

        async def reader() -> None:
            try:
                async for raw in twilio:
                    msg = json.loads(raw)
                    # Twilio reports a mark once the audio before it has played; here, shortly after.
                    if msg.get("event") == "mark":
                        await asyncio.sleep(0.3)
                        await twilio.send(json.dumps({"event": "mark", "streamSid": "MZsim", "mark": msg["mark"]}))
            except websockets.ConnectionClosed:
                pass
            state["ended"] = True

        async def line_noise() -> None:
            # Keep the line open with silence between caller lines, like a real call.
            while not state["ended"]:
                if not talking.is_set():
                    try:
                        await twilio.send(json.dumps({"event": "media", "streamSid": "MZsim", "media": {"payload": silence}}))
                    except websockets.ConnectionClosed:
                        return
                await asyncio.sleep(0.02)

        await twilio.send(json.dumps({"event": "start", "start": {"streamSid": "MZsim", "callSid": "CAsim", "customParameters": {"sessionId": session_id}}}))
        for digit in pairing["code"]:
            await twilio.send(json.dumps({"event": "dtmf", "streamSid": "MZsim", "dtmf": {"digit": digit}}))
        tasks = [asyncio.create_task(reader()), asyncio.create_task(line_noise())]

        async def wait_for_agent(timeout: float = 30) -> None:
            start = time.monotonic()
            while not state["speaking"] and time.monotonic() - start < timeout and not state["ended"]:
                await asyncio.sleep(0.05)
            while time.monotonic() - start < timeout and not state["ended"]:
                if not state["speaking"] and time.monotonic() - state["last_audio"] > 1.2:
                    return
                await asyncio.sleep(0.05)

        await wait_for_agent()
        with tempfile.TemporaryDirectory() as d:
            for i, line in enumerate(lines):
                if state["ended"]:
                    break
                audio = speak(line, d, i)
                print(f"{stamp()}  (caller says: {line})", flush=True)
                talking.set()
                for o in range(0, len(audio), 160):
                    await twilio.send(json.dumps({"event": "media", "streamSid": "MZsim", "media": {"payload": base64.b64encode(audio[o : o + 160]).decode()}}))
                    await asyncio.sleep(0.02)
                talking.clear()
                await wait_for_agent()
        await asyncio.sleep(4)
        for t in tasks:
            t.cancel()
    await asyncio.sleep(0.5)
    watcher.cancel()
    print("\nFinal records:", json.dumps(state["final"], indent=2))


asyncio.run(main())
