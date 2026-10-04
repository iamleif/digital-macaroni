# Demo voice service

The live voice agents behind the website demos: Ellie (Northline Home Services) and Theo (Form & Field).
Python, Google ADK, `gemini-3.8-live`. Form & Field runs on ElevenLabs Agents when
`ELEVENLABS_FORMFIELD_AGENT_ID` is set (it is in production).

- Phone: Twilio media streams on the two demo numbers (`/twilio/voice`, `/twilio/media`).
- Website: browser microphone sessions (`/browser/sessions`) and pairing a phone call to a watching page (`/pairings`).
- One Cloud Run service, `studio-demo-voice` in `rankladder-471812`, single instance (sessions live in memory).

## Run locally

```bash
uv sync
GEMINI_API_KEY=… DEMO_SKIP_TWILIO_SIGNATURE=1 uv run uvicorn app.main:app --port 8080
uv run python scripts/simulate_call.py northline vague   # a phone call, watched through keypad pairing
uv run python scripts/simulate_browser.py northline      # a website conversation
uv run pytest                                            # operations, audio, tool declarations
```

## Deploy

```bash
gcloud run deploy studio-demo-voice --source . --project rankladder-471812 --region us-central1
```

Settings and secrets live on the Cloud Run service and carry over between deploys.
`scripts/twilio-numbers.sh point|restore` moves the two demo numbers to this service or back to RankLadder's bridge.

## Gemini 3.8 Live and tools

3.8 Live runs function calls asynchronously by default, and a result that arrives after the agent has
spoken starts a second turn (the agent repeats itself). Every tool here declares its behaviour in
`app/tools.py`: BLOCKING for anything the agent needs before it speaks, NON_BLOCKING with SILENT
scheduling only for `end_call`. A SILENT result on a tool called before the agent speaks leaves it silent.
