import { EndSensitivity, GoogleGenAI, Modality } from "@google/genai";
import { Gemini, InMemoryRunner, LiveRequestQueue, LlmAgent, setLogger } from "@google/adk";
import { config } from "./config.js";
import { demos } from "./demos/index.js";
import type { DemoId } from "./protocol.js";
import { getSession, type DemoSession } from "./session.js";
import { demoTools } from "./tools.js";
import { openElevenLabs } from "./elevenlabs.js";
import { log } from "./log.js";

/**
 * Gemini Live through Google's Agent Development Kit, adapted from Anders' adk-live.ts: one
 * LlmAgent per demo, one in-memory ADK session per demo session, audio in through a
 * LiveRequestQueue, ADK running the tools. Transport-independent: the phone bridge and the browser
 * socket both speak LiveSession.
 */
export type LiveEvent =
  /** Model audio: base64 16-bit PCM at 24 kHz. */
  | { type: "audio"; data: string }
  | { type: "interrupted" }
  | { type: "turn_complete" }
  | { type: "transcript"; speaker: "visitor" | "agent"; text: string; finished: boolean }
  /** ElevenLabs: the whole utterance so far (replaces, not appends). */
  | { type: "transcript_set"; speaker: "visitor"; text: string; final: boolean }
  /** ElevenLabs: after an interruption, the words the agent actually got to say. */
  | { type: "agent_correction"; text: string };

export interface LiveSession {
  /** The engine speaks its own opening line, so no greeting note is needed. */
  greetsItself?: boolean;
  /** Visitor audio: base64 16-bit PCM at 16 kHz. */
  sendAudio(pcm16kBase64: string): void;
  /** A note to the model from the system (not visitor speech), such as "greet the caller now". */
  sendText(text: string): void;
  events: AsyncIterable<LiveEvent>;
  close(): void;
}

// ADK's own logging could include conversation text; replace it with nothing (except when debugging locally).
const silent = () => undefined;
if (process.env.DEMO_DEBUG_ADK !== "1" || process.env.K_SERVICE) setLogger({ log: silent, debug: silent, info: silent, warn: silent, error: silent, setLogLevel: silent } as never);

const PHONE_NOTE = `

This is a phone call. The caller may be watching the demo dashboard on the website: the page shows a four-digit code they can type on their keypad (you will be told when it links) or read out to you, in which case call link_screen with the digits. Only bring it up if they ask how to see the screen.`;
const BROWSER_NOTE = `

This conversation is in the visitor's web browser; they can see the dashboard update as you work.`;

const runners = Object.fromEntries(
  (Object.keys(demos) as DemoId[]).map((id) => {
    const demo = demos[id];
    const agent = new LlmAgent({
      name: `${id}_voice`,
      model: new Gemini({ model: config.model, apiKey: config.geminiApiKey }),
      instruction: (ctx) => {
        const s = getSession(ctx.sessionId);
        if (!s) return "The session has ended. Say goodbye.";
        return demo.instruction(s.state, { now: new Date(), channel: s.channel }) + (s.channel === "phone" ? PHONE_NOTE : BROWSER_NOTE);
      },
      tools: demoTools(demo),
    });
    return [id, new InMemoryRunner({ agent, appName: `${id}_voice` })];
  }),
) as Record<DemoId, InMemoryRunner>;

/**
 * The first live connection a process makes takes about three seconds longer than later ones
 * (measured locally: ~4.3 s vs ~1 s to first audio). Opening and closing one connection at start-up,
 * and again every few minutes, keeps that delay away from visitors. No content is sent, so it uses
 * no model input or output.
 */
export async function warmUp(): Promise<number> {
  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  let ready!: () => void;
  const setup = new Promise<void>((r) => (ready = r));
  try {
    const s = await ai.live.connect({
      model: config.model,
      config: { responseModalities: [Modality.AUDIO] },
      callbacks: { onmessage: (m) => m.setupComplete && ready(), onerror: () => ready(), onclose: () => ready() },
    });
    await Promise.race([setup, new Promise((r) => setTimeout(r, 10_000))]);
    s.close();
  } catch {
    // A failed warm-up only means the next visitor waits a little longer.
  }
  return Date.now() - started;
}

/**
 * Opens the demo's live agent on its own engine. The demos are two separate products: Northline on
 * Gemini Live, Form & Field on ElevenLabs Agents. A demo configured for ElevenLabs never falls back
 * to Gemini; if ElevenLabs cannot start, the caller is told the demo is unavailable.
 */
export async function openLive(session: DemoSession): Promise<LiveSession> {
  const agentId = config.elevenlabsAgents[session.demoId];
  if (!agentId) return openGemini(session);
  const instruction = demos[session.demoId].instruction(session.state, { now: new Date(), channel: session.channel }) + (session.channel === "phone" ? PHONE_NOTE : BROWSER_NOTE);
  const live = await openElevenLabs(session, agentId, instruction);
  log.info("live.engine", { session: session.id, outcome: "elevenlabs" });
  return live;
}

async function openGemini(session: DemoSession): Promise<LiveSession> {
  const runner = runners[session.demoId];
  const appName = `${session.demoId}_voice`;
  await runner.sessionService.createSession({ appName, userId: session.id, sessionId: session.id });
  const queue = new LiveRequestQueue();
  const abort = new AbortController();
  const stream = runner.runLive({
    userId: session.id,
    sessionId: session.id,
    liveRequestQueue: queue,
    runConfig: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voices[session.demoId] } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Reply sooner after the visitor stops; a pause shorter than this does not end their turn.
      realtimeInputConfig: { automaticActivityDetection: { endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, silenceDurationMs: config.endOfSpeechSilenceMs } },
    },
    abortSignal: abort.signal,
  });

  async function* events(): AsyncGenerator<LiveEvent> {
    for await (const event of stream) {
      if (event.interrupted) yield { type: "interrupted" };
      for (const part of event.content?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) yield { type: "audio", data: part.inlineData.data };
      }
      if (event.inputTranscription?.text) yield { type: "transcript", speaker: "visitor", text: event.inputTranscription.text, finished: Boolean(event.inputTranscription.finished) };
      if (event.outputTranscription?.text) yield { type: "transcript", speaker: "agent", text: event.outputTranscription.text, finished: Boolean(event.outputTranscription.finished) };
      if (event.turnComplete) yield { type: "turn_complete" };
    }
  }

  let closed = false;
  return {
    sendAudio: (data) => {
      if (!closed) queue.sendRealtime({ data, mimeType: "audio/pcm;rate=16000" });
    },
    sendText: (text) => {
      if (!closed) queue.send({ content: { role: "user", parts: [{ text }] } });
    },
    events: events(),
    close: () => {
      if (closed) return;
      closed = true;
      queue.close();
      abort.abort();
      runner.sessionService.deleteSession({ appName, userId: session.id, sessionId: session.id }).catch(() => undefined);
    },
  };
}

/**
 * Turns the live stream's transcript pieces into utterances for the conversation panel. For
 * Gemini 3.x, ADK passes the visitor's words as fragments (each marked finished) and the agent's
 * as fragments followed by one complete, finished text. Each utterance is emitted under one id and
 * replaced in place; it is final when the other side starts or the turn completes.
 */
export class TranscriptTracker {
  private seq = 0;
  private visitor: { id: string; text: string } | null = null;
  private agent: { id: string; text: string } | null = null;
  private lastAgent: string | null = null;

  constructor(private session: DemoSession) {}

  private emit(speaker: "visitor" | "agent", u: { id: string; text: string }, final: boolean) {
    // Transcripts can carry markers such as <no speech>, {pause} or voice tags like [cheerful]; they are not words.
    const text = u.text.replace(/<[^>]*>|\{[^}]*\}|\[[a-z][a-z \-]{0,24}\]/gi, " ").replace(/\s+/g, " ").trim();
    if (text) this.session.emit({ type: "transcript", id: u.id, speaker, text: text.slice(0, 2000), final });
  }

  visitorText(text: string) {
    if (this.agent) this.finishAgent();
    if (!this.visitor) this.visitor = { id: `u${++this.seq}`, text: "" };
    this.visitor.text += text;
    this.emit("visitor", this.visitor, false);
  }

  agentText(text: string, finished: boolean) {
    if (this.visitor) this.finishVisitor();
    if (!this.agent) this.agent = { id: `u${++this.seq}`, text: "" };
    if (finished) {
      this.agent.text = text;
      this.finishAgent();
    } else {
      this.agent.text += text;
      this.emit("agent", this.agent, false);
    }
  }

  /** Sets the visitor's current utterance to this whole text (engines that send cumulative text). */
  visitorSet(text: string, final: boolean) {
    if (this.agent) this.finishAgent();
    if (!this.visitor) this.visitor = { id: `u${++this.seq}`, text: "" };
    this.visitor.text = text;
    if (final) this.finishVisitor();
    else this.emit("visitor", this.visitor, false);
  }

  /** Replaces the agent's last utterance with what it actually said before being interrupted. */
  correctAgent(text: string) {
    if (this.agent) {
      this.agent.text = text;
      this.finishAgent();
    } else if (this.lastAgent) this.emit("agent", { id: this.lastAgent, text }, true);
  }

  finishVisitor() {
    if (this.visitor) this.emit("visitor", this.visitor, true);
    this.visitor = null;
  }

  finishAgent() {
    if (this.agent) {
      this.emit("agent", this.agent, true);
      this.lastAgent = this.agent.id;
    }
    this.agent = null;
  }

  finishAll() {
    this.finishVisitor();
    this.finishAgent();
  }
}

