# Demo voice service

The live voice agents behind the website demos, each on its own engine:

- Ellie (Northline Home Services): Gemini Live (`gemini-3.8-live`) through Google ADK.
- Theo (Form & Field): ElevenLabs Agents when `ELEVENLABS_FORMFIELD_AGENT_ID` is set (it is in production).
- Linda (Waypoint Travel): the cascade in `app/cascade.py`. `gemini-3.5-transcribe-live` hears, `gemini-3.5-flash-lite`
  answers through ADK and runs the tools, and `gemini-3.8-flash-tts` speaks in the designed voice "Linda 2". Flights
  come from Duffel in test mode (`app/duffel.py`, read-only); booking stops before any order is created.
  `DEMO_CASCADE` lists the demos on the cascade (default `travel`).

- Phone: Twilio media streams on the three demo numbers (`/twilio/voice`, `/twilio/media`): Northline (206) 887-9619,
  Form & Field (830) 239-2110, Waypoint (720) 599-6395.
- Website: browser microphone sessions (`/browser/sessions`) and pairing a phone call to a watching page (`/pairings`).
- One Cloud Run service, `studio-demo-voice` in `digital-macaroni-510610`, single always-on instance (sessions live in memory).
  Built with Google buildpacks from `Procfile` and `.python-version` (no Dockerfile).

## Run locally

```bash
uv sync
GEMINI_API_KEY=… DUFFEL_ACCESS_TOKEN=… DEMO_SKIP_TWILIO_SIGNATURE=1 uv run uvicorn app.main:app --port 8080
uv run python scripts/simulate_call.py northline vague   # a phone call, watched through keypad pairing
uv run python scripts/simulate_browser.py northline      # a website conversation
uv run pytest                                            # operations, audio, tool declarations
```

## Deploy

```bash
gcloud run deploy studio-demo-voice --source . --project digital-macaroni-510610 --region us-central1
```

Settings and secrets live on the Cloud Run service and carry over between deploys.
`scripts/twilio-numbers.sh point|restore` moves the Northline and Form & Field numbers to this service or back to
RankLadder's bridge; Waypoint's number was bought for the demo and stays on this service. Waypoint also needs the
`studio-demo-duffel-token` secret as `DUFFEL_ACCESS_TOKEN`.

## Gemini 3.8 Live and tools

3.8 Live runs function calls asynchronously by default, and a result that arrives after the agent has
spoken starts a second turn (the agent repeats itself). Every tool here declares its behaviour in
`app/tools.py`: BLOCKING for anything the agent needs before it speaks, NON_BLOCKING with SILENT
scheduling only for `end_call`. A SILENT result on a tool called before the agent speaks leaves it silent.
