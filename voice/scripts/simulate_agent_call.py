"""
Local check of the agent factory end to end, against a running server started with:

    GEMINI_API_KEY=… DEMO_SKIP_TWILIO_SIGNATURE=1 VOICE_ADMIN_TOKEN=test AGENTS_DIR=/tmp/agents \
      PROVISION_DRY_RUN=1 DRY_RUN_NUMBER=+15555550100 DEMO_CALL_LOG_DIR=/tmp/calls \
      uv run uvicorn app.main:app --port 8080

It makes an onboarding link, fills the setup form for a real website (dry run: no number is bought),
then rings the new agent's number through the real Twilio webhook and media stream with caller lines
spoken by macOS `say`, and prints the call record and the owner's summary (nothing is texted or emailed
locally).

    uv run python scripts/simulate_agent_call.py https://www.ballarddentalcare.com
"""

from __future__ import annotations

import asyncio
import base64
import glob
import json
import os
import re
import sys
import tempfile
import time

import httpx
import websockets

import subprocess

BASE = os.environ.get("DEMO_URL", "http://localhost:8080")
WS = "ws" + BASE[4:]
ORIGIN = "http://127.0.0.1:3790"
ADMIN = {"authorization": f"Bearer {os.environ.get('VOICE_ADMIN_TOKEN', 'test')}"}
CALLS = os.environ.get("DEMO_CALL_LOG_DIR", "/tmp/calls")
LINES = [
    "Hi, what are your hours this week?",
    "Okay. Do you do teeth cleanings, and can I come in next Tuesday?",
    "Sure. My name is Jordan Smith. Yes, this number is fine.",
    "That's all, thanks. Bye.",
]
t0 = time.monotonic()


def speak(text: str, d: str, i: int) -> bytes:
    """A caller line as 8 kHz mu-law, spoken by macOS `say` (as in simulate_call.py)."""
    aiff, wav = f"{d}/{i}.aiff", f"{d}/{i}.wav"
    subprocess.run(["say", "-v", "Samantha", "-o", aiff, text], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "ulaw@8000", "-c", "1", aiff, wav], check=True)
    data = open(wav, "rb").read()
    at = data.index(b"data")
    size = int.from_bytes(data[at + 4 : at + 8], "little")
    return data[at + 8 : at + 8 + size]


def stamp() -> str:
    return f"{time.monotonic() - t0:5.1f}s"


async def main() -> None:
    website = sys.argv[1] if len(sys.argv) > 1 else "https://www.ballarddentalcare.com"
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as http:
        invite = (await http.post("/admin/invites", json={"label": "Simulation", "plan": "core"}, headers=ADMIN)).json()
        token = invite["url"].split("invite=")[1]
        print(stamp(), "invite", invite["id"], "check:", (await http.get("/onboard/check", params={"invite": token})).json())
        job = (await http.post("/onboard", headers={"origin": ORIGIN}, json={
            "invite": token, "businessName": "Ballard Dental Care", "website": website, "ownerName": "Pat Owner", "ownerEmail": "owner@example.com",
            "ownerMobile": "206 555 0177", "areaCode": "206", "voice": "female", "hours": "", "notes": "New patients are welcome. We take most PPO insurance.", "neverSay": "",
        })).json()
        print(stamp(), "onboard", job)
        while job.get("step") not in ("live", "failed"):
            await asyncio.sleep(1)
            job = (await http.get(f"/onboard/{job['job']}")).json()
            print(stamp(), "  step:", job["step"])
        if job["step"] != "live":
            return
        print(stamp(), "agents:", [(a["businessName"], a["number"], a["status"]) for a in (await http.get("/admin/agents", headers=ADMIN)).json()["agents"]])
        twiml = (await http.post("/twilio/voice", data={"To": job["number"], "From": "+12065550142", "CallSid": "CAsim"})).text
        session_id = re.search(r'name="sessionId" value="([^"]+)"', twiml).group(1)  # type: ignore[union-attr]

    last_audio = [0.0]
    ended = [False]
    silence = base64.b64encode(b"\xff" * 160).decode()
    talking = asyncio.Event()
    async with websockets.connect(f"{WS}/twilio/media") as twilio:

        async def reader() -> None:
            try:
                async for raw in twilio:
                    msg = json.loads(raw)
                    if msg.get("event") == "media":
                        last_audio[0] = time.monotonic()
                    elif msg.get("event") == "mark":
                        await asyncio.sleep(0.3)
                        await twilio.send(json.dumps({"event": "mark", "streamSid": "MZsim", "mark": msg["mark"]}))
            except websockets.ConnectionClosed:
                pass
            ended[0] = True

        async def line_noise() -> None:
            while not ended[0]:
                if not talking.is_set():
                    try:
                        await twilio.send(json.dumps({"event": "media", "streamSid": "MZsim", "media": {"payload": silence}}))
                    except websockets.ConnectionClosed:
                        return
                await asyncio.sleep(0.02)

        async def wait_for_agent(timeout: float = 30) -> None:
            start = time.monotonic()
            while not ended[0] and time.monotonic() - start < timeout and (last_audio[0] < start or time.monotonic() - last_audio[0] < 1.5):
                await asyncio.sleep(0.05)

        await twilio.send(json.dumps({"event": "start", "start": {"streamSid": "MZsim", "callSid": "CAsim", "customParameters": {"sessionId": session_id}}}))
        tasks = [asyncio.create_task(reader()), asyncio.create_task(line_noise())]
        await wait_for_agent()
        with tempfile.TemporaryDirectory() as d:
            for i, line in enumerate(LINES):
                if ended[0]:
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

    print(stamp(), "call over; waiting for the summary")
    for _ in range(30):
        summaries = glob.glob(f"{CALLS}/summaries/{session_id}.json")
        if summaries:
            break
        await asyncio.sleep(1)
    record = sorted(glob.glob(f"{CALLS}/calls/*/agent/*{session_id[:8]}.json"))
    if record:
        for e in json.load(open(record[-1]))["entries"]:
            if e["kind"] == "say":
                print(f"   {'AGENT ' if e['speaker'] == 'agent' else 'CALLER'}  {e['text']}")
            elif e["kind"] == "tool":
                print(f"     ⋯ {e['tool']} {'ok' if e['ok'] else 'FAILED'}  {json.dumps(e['args'])[:140]}")
    if summaries:
        print("\nOwner summary (text):\n" + json.load(open(summaries[0]))["text"])
    else:
        print("\nNo summary written.")


asyncio.run(main())
