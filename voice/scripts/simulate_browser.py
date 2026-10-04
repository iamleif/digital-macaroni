"""
Local verification of a website conversation against a running server: starts a browser session
the way the page does, streams caller lines (macOS `say`, 16 kHz PCM16) over its socket, and prints
what the page receives.

    uv run python scripts/simulate_browser.py northline
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import time

import httpx
import websockets

BASE = os.environ.get("DEMO_URL", "http://localhost:8080")
ORIGIN = "http://127.0.0.1:3790"
LINES = {
    "northline": ["Hi, can someone come and fix a leaking pipe under my kitchen sink on Monday morning?", "It's Jamie Fox, at 12 Orchard Road.", "The earliest one, please.", "Yes, book it.", "That's all, thanks. Goodbye."],
    "travel": [
        "Hi, I'd like to fly from London to New York on November twentieth, one way, just me.",
        "Economy is fine. I care most about the price, and a morning flight if possible.",
        "Let's go with the Duffel Airways one.",
        "What would the next fare up give me?",
        "No, I'll stick with the basic fare. Can I pick a seat? A window, please.",
        "Yes, please add one checked bag.",
        "My name is Alex Taylor.",
        "Yes, that's all correct.",
        "No, that's everything. Thanks, bye.",
    ],
    "formfield": ["Hi! Do you have any planters?", "Is the large sage one in stock?", "Great, can you reserve one for Priya?", "Yes, please.", "That's everything, thank you. Bye."],
}
t0 = time.monotonic()


def stamp() -> str:
    return f"{time.monotonic() - t0:5.1f}s"


def speak(text: str, d: str, i: int) -> bytes:
    aiff, wav = f"{d}/{i}.aiff", f"{d}/{i}.wav"
    subprocess.run(["say", "-v", "Samantha", "-o", aiff, text], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiff, wav], check=True)
    data = open(wav, "rb").read()
    at = data.index(b"data")
    return data[at + 8 : at + 8 + int.from_bytes(data[at + 4 : at + 8], "little")]


async def main() -> None:
    demo = sys.argv[1] if len(sys.argv) > 1 else "northline"
    async with httpx.AsyncClient(base_url=BASE) as http:
        start = (await http.post("/browser/sessions", json={"demo": demo}, headers={"origin": ORIGIN})).json()
    state = {"speaking": False, "last": time.monotonic(), "ended": False, "audio": 0, "final": None, "tools": 0}
    url = f"ws{BASE[4:]}/browser/sessions/{start['sessionId']}?token={start['token']}"
    async with websockets.connect(url, origin=ORIGIN) as ws:  # type: ignore[arg-type]

        async def reader() -> None:
            async for raw in ws:
                if isinstance(raw, bytes):
                    state["audio"] += len(raw)
                    continue
                e = json.loads(raw)
                t = e["type"]
                if t == "transcript" and e["final"]:
                    print(f"{stamp()}  {'AGENT ' if e['speaker'] == 'agent' else 'VISITOR'}  {e['text']}", flush=True)
                elif t == "tool.started":
                    state["tools"] += 1
                elif t == "tool.succeeded":
                    state["tools"] -= 1
                    print(f"{stamp()}    ✓ {e['summary']}", flush=True)
                elif t == "tool.failed":
                    state["tools"] -= 1
                    print(f"{stamp()}    ✗ {e['label']}: {e['summary']}", flush=True)
                elif t == "agent.speaking":
                    state["speaking"], state["last"] = e["speaking"], time.monotonic()
                elif t == "state":
                    state["final"] = e["state"]
                elif t in ("session.ended", "session.error"):
                    print(f"{stamp()}  — {t}: {e.get('reason') or e.get('message')}", flush=True)
                    state["ended"] = True

        r = asyncio.create_task(reader())

        async def wait_for_agent(timeout: float = 60) -> None:
            s = time.monotonic()
            while not state["speaking"] and time.monotonic() - s < timeout and not state["ended"]:
                await asyncio.sleep(0.05)
            while time.monotonic() - s < timeout and not state["ended"]:
                # A running tool (a flight search) means the agent has not finished its turn.
                if not state["speaking"] and not state["tools"] and time.monotonic() - state["last"] > 1.2:
                    return
                await asyncio.sleep(0.05)

        silence = b"\x00" * 640
        talking = asyncio.Event()

        async def line_noise() -> None:
            # A real microphone never stops sending: keep the line open with silence between lines.
            while not state["ended"]:
                if not talking.is_set():
                    try:
                        await ws.send(silence)
                    except websockets.ConnectionClosed:
                        return
                await asyncio.sleep(0.02)

        noise = asyncio.create_task(line_noise())
        await wait_for_agent()
        with tempfile.TemporaryDirectory() as d:
            for i, line in enumerate(LINES[demo]):
                if state["ended"]:
                    break
                print(f"{stamp()}  (visitor says: {line})", flush=True)
                audio = speak(line, d, i)
                talking.set()
                for o in range(0, len(audio), 640):
                    await ws.send(audio[o : o + 640])
                    await asyncio.sleep(0.02)
                talking.clear()
                await wait_for_agent()
        await asyncio.sleep(4)
        noise.cancel()
        r.cancel()
    print(f"\nAgent audio received: {state['audio'] / 48000:.1f} s")
    print("Final records:", json.dumps(state["final"])[:600])


asyncio.run(main())
