import os
from dataclasses import dataclass, field

env = os.environ
on_cloud_run = bool(env.get("K_SERVICE"))


def _origins() -> list[str]:
    raw = env.get("DEMO_ALLOWED_ORIGINS", "https://digitalmacaroni.io,https://www.digitalmacaroni.io,http://localhost:3000,http://127.0.0.1:3790")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Config:
    port: int = int(env.get("PORT", "8080"))
    # The exact public base URL Twilio calls; it is part of every request signature.
    public_url: str = env.get("DEMO_PUBLIC_URL", "http://localhost:8080").rstrip("/")
    gemini_api_key: str = env.get("GEMINI_API_KEY", "")
    model: str = env.get("DEMO_LIVE_MODEL", "gemini-3.8-live")
    twilio_auth_token: str = env.get("TWILIO_AUTH_TOKEN", "")
    # Local test harness only: never honoured on Cloud Run.
    skip_twilio_signature: bool = not on_cloud_run and env.get("DEMO_SKIP_TWILIO_SIGNATURE") == "1"
    # Which demo each dialled number reaches (E.164).
    numbers: dict[str, str] = field(
        default_factory=lambda: {
            env.get("NORTHLINE_NUMBER", "+12068879619"): "northline",
            env.get("FORMFIELD_NUMBER", "+18302392110"): "formfield",
            env.get("TRAVEL_NUMBER", "+17205996395"): "travel",
        }
    )
    # Prebuilt Gemini voice names, or designed voice ids ("voice_…", from AI Studio; the travel default is
    # "Linda 2", designed on gemini-3.8-flash-tts and valid until 2027-10-04).
    voices: dict[str, str] = field(
        default_factory=lambda: {"northline": env.get("NORTHLINE_VOICE", "Sulafat"), "formfield": env.get("FORMFIELD_VOICE", "Iapetus"), "travel": env.get("TRAVEL_VOICE", "voice_6lu9yg7544iu")}
    )
    # Demos on the cascade (speech-to-text, a Gemini text model through ADK, then Gemini TTS) instead of Gemini Live.
    cascade_demos: frozenset[str] = frozenset(d.strip() for d in env.get("DEMO_CASCADE", "travel").split(",") if d.strip())
    # Speech-to-text for the cascade: "assemblyai" (Universal-3.6 Pro, the default) or "gemini".
    stt_provider: str = env.get("DEMO_STT_PROVIDER", "assemblyai")
    assemblyai_api_key: str = env.get("ASSEMBLYAI_API_KEY", "")
    assemblyai_model: str = env.get("DEMO_ASSEMBLYAI_MODEL", "universal-3-6-pro")
    stt_model: str = env.get("DEMO_STT_MODEL", "gemini-3.5-transcribe-live")
    text_model: str = env.get("DEMO_TEXT_MODEL", "gemini-3.5-flash-lite")
    tts_model: str = env.get("DEMO_TTS_MODEL", "gemini-3.8-flash-lite-tts")
    duffel_token: str = env.get("DUFFEL_ACCESS_TOKEN", "")
    # Confirmation emails (Resend; the sending domain digitalmacaroni.io is verified there).
    resend_api_key: str = env.get("RESEND_API_KEY", "")
    email_from: str = env.get("DEMO_EMAIL_FROM", "demos@digitalmacaroni.io")
    email_reply_to: str = env.get("DEMO_EMAIL_REPLY_TO", "hello@digitalmacaroni.io")
    # Silence that ends the visitor's turn. Lower is snappier; too low cuts people off mid-thought.
    end_of_speech_silence_ms: int = int(env.get("DEMO_END_OF_SPEECH_SILENCE_MS", "700"))
    # Log pitch and loudness of each agent turn on phone calls (numbers only), to diagnose voice changes.
    voice_diagnostics: bool = env.get("DEMO_VOICE_DIAGNOSTICS") == "1"
    elevenlabs_api_key: str = env.get("ELEVENLABS_API_KEY", "")
    # Demos that run on ElevenLabs Agents; the others use Gemini Live.
    elevenlabs_agents: dict[str, str] = field(
        default_factory=lambda: {
            demo: agent
            for demo, agent in (("formfield", env.get("ELEVENLABS_FORMFIELD_AGENT_ID")), ("northline", env.get("ELEVENLABS_NORTHLINE_AGENT_ID")))
            if agent
        }
    )
    # Immediate server-side stop for new sessions.
    enabled: bool = env.get("DEMO_ENABLED") != "0"
    max_session_seconds: int = int(env.get("DEMO_MAX_SESSION_SECONDS", "300"))
    # Cloud Storage bucket for call records (calllog.py); unset locally, so nothing is written.
    call_log_bucket: str = env.get("DEMO_CALL_LOG_BUCKET", "")
    # Local runs: write call records to this folder instead.
    call_log_dir: str = env.get("DEMO_CALL_LOG_DIR", "")
    max_concurrent: int = int(env.get("DEMO_MAX_CONCURRENT_SESSIONS", "8"))
    # Exact website origins allowed to start browser sessions.
    allowed_origins: list[str] = field(default_factory=_origins)
    debug_adk: bool = not on_cloud_run and env.get("DEMO_DEBUG_ADK") == "1"


config = Config()

# ADK's Gemini client reads the key from the environment.
if config.gemini_api_key:
    os.environ.setdefault("GOOGLE_API_KEY", config.gemini_api_key)
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")
