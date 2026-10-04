/**
 * Creates or updates the Form & Field agent on ElevenLabs Agents: our tools as client tools (our
 * server runs them over the conversation's WebSocket), a configurable reasoning model (ELEVENLABS_LLM), Eleven v4
 * Turbo for the voice. Safe to re-run: tools and the agent are matched by name and updated.
 * Prints the agent id for ELEVENLABS_FORMFIELD_AGENT_ID.
 *
 *   ELEVENLABS_API_KEY=… npx tsx scripts/elevenlabs-setup.ts [voiceId]
 */
import { z } from "zod";
import { formfield } from "../src/demos/formfield.js";
import { toolSpecs } from "../src/tools.js";

const KEY = process.env.ELEVENLABS_API_KEY!;
const API = "https://api.elevenlabs.io";
const AGENT_NAME = "Form & Field · Theo (Digital Macaroni demo)";
const VOICE = process.argv[2] ?? "s3TPKV1kjDlVtZbl4Ksh"; // Adam – Engaging, Friendly and Bright (chosen by Leif, saved to My Voices)
const TOOL_PREFIX = "ff_"; // keeps these tools distinct from any others in the workspace

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: { "xi-api-key": KEY, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

/** ElevenLabs takes a plain JSON schema subset; every property needs a description. */
function toParameters(schema: z.ZodObject | undefined) {
  if (!schema) return { type: "object", properties: {}, required: [] };
  const json = z.toJSONSchema(schema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const clean = (p: Record<string, unknown>, name: string): Record<string, unknown> => {
    const type = Array.isArray(p.type) ? p.type[0] : p.type;
    const out: Record<string, unknown> = { type: type === "integer" ? "integer" : type, description: (p.description as string) ?? name.replace(/([A-Z])/g, " $1").toLowerCase() };
    if (p.enum) out.enum = p.enum;
    return out;
  };
  return {
    type: "object",
    properties: Object.fromEntries(Object.entries(json.properties ?? {}).map(([k, v]) => [k, clean(v, k)])),
    required: json.required ?? [],
  };
}

const specs = toolSpecs(formfield as never);
const existingTools: { id: string; tool_config: { name: string } }[] = (await api("GET", "/v1/convai/tools")).tools ?? [];
const toolIds: string[] = [];
for (const spec of specs) {
  const config = {
    type: "client",
    name: `${TOOL_PREFIX}${spec.name}`,
    description: spec.description,
    parameters: toParameters(spec.parameters),
    expects_response: true,
    response_timeout_secs: 10,
    // A short spoken bridge ("let me check") before lookups, so a tool's wait is not dead air.
    pre_tool_speech: "auto",
  };
  const found = existingTools.find((t) => t.tool_config.name === config.name);
  const res = found ? await api("PATCH", `/v1/convai/tools/${found.id}`, { tool_config: config }) : await api("POST", "/v1/convai/tools", { tool_config: config });
  toolIds.push(found?.id ?? res.id);
  console.log(found ? "updated" : "created", config.name);
}

// The prompt is replaced per conversation (it carries the date and the channel); this one is a fallback.
const conversationConfig = {
  agent: {
    first_message: "Thanks for calling Form & Field, this is Theo. How can I help?",
    language: "en",
    prompt: {
      prompt: formfield.instruction(formfield.createState(new Date()), { now: new Date(), channel: "phone" }),
      llm: process.env.ELEVENLABS_LLM ?? "gemini-3.5-flash", // chosen Oct 4 over 3.5 Flash-Lite (which skipped read-back confirmations)
      ...(process.env.ELEVENLABS_REASONING ? { reasoning_effort: process.env.ELEVENLABS_REASONING } : { reasoning_effort: "minimal" }),
      temperature: 0.4,
      tool_ids: toolIds,
    },
  },
  tts: { model_id: "eleven_v4_turbo", voice_id: VOICE, agent_output_audio_format: "pcm_24000", stability: 0.65, similarity_boost: 0.8 },
  asr: { user_input_audio_format: "pcm_16000", keywords: ["Form & Field", "Ridge", "Moss", "sage", "oat", "planter"] },
  turn: { turn_timeout: 10, turn_eagerness: "eager" },
  conversation: {
    max_duration_seconds: 330,
    client_events: ["conversation_initiation_metadata", "audio", "interruption", "user_transcript", "tentative_user_transcript", "agent_response", "agent_response_correction", "client_tool_call", "agent_tool_response", "ping", "client_error"],
  },
};
const platformSettings = {
  auth: { enable_auth: true },
  overrides: { conversation_config_override: { agent: { prompt: { prompt: true }, first_message: true } } },
  privacy: { record_voice: false, retention_days: 30 },
  call_limits: { agent_concurrency_limit: 6, bursting_enabled: false },
};

const agents: { agent_id: string; name: string }[] = (await api("GET", "/v1/convai/agents?page_size=100")).agents ?? [];
const existing = agents.find((a) => a.name === AGENT_NAME);
if (existing) {
  await api("PATCH", `/v1/convai/agents/${existing.agent_id}`, { name: AGENT_NAME, conversation_config: conversationConfig, platform_settings: platformSettings });
  console.log("updated agent", existing.agent_id);
} else {
  const res = await api("POST", "/v1/convai/agents/create", { name: AGENT_NAME, conversation_config: conversationConfig, platform_settings: platformSettings });
  console.log("created agent", res.agent_id);
}
