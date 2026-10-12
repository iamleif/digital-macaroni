# Demo voice service

The live voice agents behind the website demos. Current engines, voices, prompt sizes and per-minute costs for
every agent are in `Docs/studio-preview/AGENT_STACK_AND_COST.md` in the Macaroni repo; in short:

- All twelve agents run on the cascade (`app/cascade.py`): AssemblyAI Universal-3.6 Pro hears (`app/stt.py`), a Gemini text model
  (`gemini-3.5-flash-lite`, minimal thinking) thinks through ADK and runs the tools, and `gemini-3.8-flash-lite-tts` speaks in
  the agent's voice (`<NAME>_VOICE` settings; Linda uses a designed voice). `DEMO_CASCADE` lists them: travel, dental, northline,
  dealership, hotels, lune, lawfirm, realestate, insurance, tidewell, agent, formfield.
- Erica (Form & Field, voice Hali) moved from ElevenLabs onto the cascade on October 12; the ElevenLabs adapter (`app/elevenlabs.py`) is still in the code but unused.
- Gemini 3.8 Live (`gemini-3.8-live`, through ADK) is still in the code but no agent uses it.
- Flights come from Duffel in test mode (`app/duffel.py`, read-only); hotels from LiteAPI's sandbox (`app/liteapi.py`). Booking stops
  before payment; nothing is ever booked or charged.
- Every agent's prompt is its own document in `app/demos/<name>/prompt.py` (Personality, Tone, Opening, Facts, Hearing, What you do,
  Pushback, Errors, Email, Guardrails, Ending). Nothing is shared between prompts.

- Phone: Twilio media streams on the demo numbers (`/twilio/voice`, `/twilio/media`): Northline (720) 599-6395,
  Form & Field (830) 239-2110, Alder & Finch (206) 887-9619, Waypoint (929) 333-3608, Palmetto Stays (786) 305-3013.
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
`studio-demo-duffel-token` secret as `DUFFEL_ACCESS_TOKEN` and `studio-demo-assemblyai-api-key` as `ASSEMBLYAI_API_KEY`.
Palmetto Stays needs `studio-demo-liteapi-key` as `LITEAPI_KEY`.

## Gemini 3.8 Live and tools

3.8 Live runs function calls asynchronously by default, and a result that arrives after the agent has
spoken starts a second turn (the agent repeats itself). Every tool here declares its behaviour in
`app/tools.py`: BLOCKING for anything the agent needs before it speaks, NON_BLOCKING with SILENT
scheduling only for `end_call`. A SILENT result on a tool called before the agent speaks leaves it silent.

Blocking doesn't stop the model talking first and calling a tool part-way through its reply, and every
result makes it speak again: two answers to one caller turn. So every Gemini Live agent is told to make its
tool calls before it speaks (`LIVE_NOTE` in `app/live.py`), and a tool called mid-reply returns what the
caller already heard (`alreadySaid`) with an instruction not to repeat it (`app/tools.py`).
