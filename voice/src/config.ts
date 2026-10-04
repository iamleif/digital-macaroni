import type { DemoId } from "./protocol.js";

const env = process.env;
const onCloudRun = Boolean(env.K_SERVICE);

export const config = {
  port: Number(env.PORT ?? 8080),
  /** The exact public base URL Twilio calls; it is part of every request signature. */
  publicUrl: (env.DEMO_PUBLIC_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  geminiApiKey: env.GEMINI_API_KEY ?? "",
  model: env.DEMO_LIVE_MODEL ?? "gemini-3.8-live",
  twilioAuthToken: env.TWILIO_AUTH_TOKEN ?? "",
  /** Local test harness only: never honoured on Cloud Run. */
  skipTwilioSignature: !onCloudRun && env.DEMO_SKIP_TWILIO_SIGNATURE === "1",
  /** Which demo each dialled number reaches (E.164). */
  numbers: {
    [env.NORTHLINE_NUMBER ?? "+12068879619"]: "northline",
    [env.FORMFIELD_NUMBER ?? "+18302392110"]: "formfield",
  } as Record<string, DemoId>,
  voices: {
    northline: env.NORTHLINE_VOICE ?? "Sulafat",
    formfield: env.FORMFIELD_VOICE ?? "Iapetus",
  } as Record<DemoId, string>,
  /** Silence that ends the visitor's turn. Lower is snappier; too low cuts people off mid-thought. */
  endOfSpeechSilenceMs: Number(env.DEMO_END_OF_SPEECH_SILENCE_MS ?? 700),
  /** Log pitch and loudness of each agent turn on phone calls (numbers only), to diagnose voice changes. */
  voiceDiagnostics: env.DEMO_VOICE_DIAGNOSTICS === "1",
  elevenlabsApiKey: env.ELEVENLABS_API_KEY ?? "",
  /** Demos that run on ElevenLabs Agents (agent ids from scripts/elevenlabs-setup.ts); others use Gemini. */
  elevenlabsAgents: {
    ...(env.ELEVENLABS_FORMFIELD_AGENT_ID ? { formfield: env.ELEVENLABS_FORMFIELD_AGENT_ID } : {}),
    ...(env.ELEVENLABS_NORTHLINE_AGENT_ID ? { northline: env.ELEVENLABS_NORTHLINE_AGENT_ID } : {}),
  } as Partial<Record<DemoId, string>>,
  /** Immediate server-side stop for new sessions. */
  enabled: env.DEMO_ENABLED !== "0",
  maxSessionSeconds: Number(env.DEMO_MAX_SESSION_SECONDS ?? 300),
  maxConcurrent: Number(env.DEMO_MAX_CONCURRENT_SESSIONS ?? 8),
  /** Exact website origins allowed to start browser sessions. */
  allowedOrigins: (env.DEMO_ALLOWED_ORIGINS ?? "https://digitalmacaroni.io,https://www.digitalmacaroni.io,http://localhost:3000,http://127.0.0.1:3790").split(",").map((s) => s.trim()).filter(Boolean),
};
