import WebSocket from "ws";
import { config } from "./config.js";
import type { LiveEvent, LiveSession } from "./live.js";
import { log } from "./log.js";
import type { DemoSession } from "./session.js";
import { runTool, toolSpecs } from "./tools.js";

/**
 * A demo conversation on ElevenLabs Agents. Our server is the agent's only client: it relays the
 * visitor's audio (16 kHz PCM) and the agent's (24 kHz PCM), and runs the agent's tools itself as
 * client tools, so the session's records, dashboard and transcript work exactly as with Gemini.
 * The agent's instructions are replaced per conversation from the same source as Gemini's.
 * Speaks the same LiveSession interface as the Gemini adapter.
 */
const API = "https://api.elevenlabs.io";
/** Tools are registered with a prefix (scripts/elevenlabs-setup.ts) so they cannot clash in the workspace. */
export const TOOL_PREFIX = "ff_";
/** No agent audio for this long means its turn has finished. */
const TURN_IDLE_MS = 700;

interface ServerEvent {
  type: string;
  ping_event?: { event_id: number };
  audio_event?: { audio_base_64: string; event_id: number };
  interruption_event?: { event_id: number };
  user_transcription_event?: { user_transcript: string };
  tentative_user_transcription_event?: { user_transcript: string };
  agent_response_event?: { agent_response: string };
  agent_response_correction_event?: { corrected_agent_response: string };
  client_tool_call?: { tool_name: string; tool_call_id: string; parameters: unknown };
  error_event?: { code?: number; error_name?: string; message?: string };
}

export async function openElevenLabs(session: DemoSession, agentId: string, instruction: string): Promise<LiveSession> {
  const specs = toolSpecs(session.demo);
  const prompt = specs.reduce((text, s) => text.replace(new RegExp(`\\b${s.name}\\b`, "g"), `${TOOL_PREFIX}${s.name}`), instruction);

  const signed = await fetch(`${API}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { headers: { "xi-api-key": config.elevenlabsApiKey } });
  if (!signed.ok) throw new Error(`signed url ${signed.status}`);
  const { signed_url: url } = (await signed.json()) as { signed_url: string };

  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timeout")), 8_000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  ws.send(JSON.stringify({ type: "conversation_initiation_client_data", conversation_config_override: { agent: { prompt: { prompt } } } }));

  // Events in arrival order, consumed by the phone or browser bridge.
  const queue: LiveEvent[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  const push = (e: LiveEvent) => {
    queue.push(e);
    wake?.();
  };
  let interruptedAt = -1;
  let idle: NodeJS.Timeout | null = null;
  let speaking = false;

  ws.on("message", (raw: Buffer) => {
    let e: ServerEvent;
    try {
      e = JSON.parse(raw.toString()) as ServerEvent;
    } catch {
      return;
    }
    switch (e.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", event_id: e.ping_event!.event_id }));
        break;
      case "audio": {
        const a = e.audio_event!;
        // Audio generated before an interruption arrives late sometimes; it must not play.
        if (a.event_id <= interruptedAt) break;
        speaking = true;
        push({ type: "audio", data: a.audio_base_64 });
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => {
          speaking = false;
          push({ type: "turn_complete" });
        }, TURN_IDLE_MS);
        break;
      }
      case "interruption":
        interruptedAt = e.interruption_event!.event_id;
        if (idle) clearTimeout(idle);
        if (speaking) push({ type: "interrupted" });
        speaking = false;
        break;
      case "tentative_user_transcript":
        push({ type: "transcript_set", speaker: "visitor", text: e.tentative_user_transcription_event!.user_transcript, final: false });
        break;
      case "user_transcript":
        push({ type: "transcript_set", speaker: "visitor", text: e.user_transcription_event!.user_transcript, final: true });
        break;
      case "agent_response":
        push({ type: "transcript", speaker: "agent", text: e.agent_response_event!.agent_response, finished: true });
        break;
      case "agent_response_correction":
        push({ type: "agent_correction", text: e.agent_response_correction_event!.corrected_agent_response });
        break;
      case "client_tool_call": {
        const call = e.client_tool_call!;
        const name = call.tool_name.startsWith(TOOL_PREFIX) ? call.tool_name.slice(TOOL_PREFIX.length) : call.tool_name;
        void runTool(specs, session, name, call.parameters)
          .catch((err) => {
            log.error("elevenlabs.tool_failed", { session: session.id, tool: name }, err);
            return { ok: false, error: "internal_error" };
          })
          .then((result) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "client_tool_result", tool_call_id: call.tool_call_id, result: JSON.stringify(result), is_error: result.ok === false }));
          });
        break;
      }
      case "client_error":
        log.warn("elevenlabs.client_error", { session: session.id, error_code: e.error_event?.code ?? null, outcome: e.error_event?.error_name ?? null });
        break;
    }
  });
  ws.on("close", (code) => {
    log.info("elevenlabs.closed", { session: session.id, outcome: String(code) });
    if (idle) clearTimeout(idle);
    done = true;
    wake?.();
  });
  ws.on("error", (err) => log.warn("elevenlabs.socket_error", { session: session.id }, err));

  async function* events(): AsyncGenerator<LiveEvent> {
    while (true) {
      while (queue.length) yield queue.shift()!;
      if (done) return;
      await new Promise<void>((r) => (wake = r));
      wake = null;
    }
  }

  return {
    greetsItself: true,
    sendAudio: (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ user_audio_chunk: data }));
    },
    sendText: (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "user_message", text }));
    },
    events: events(),
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000);
    },
  };
}
