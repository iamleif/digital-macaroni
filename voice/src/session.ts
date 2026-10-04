import { randomBytes, randomUUID } from "node:crypto";
import { config } from "./config.js";
import { demos } from "./demos/index.js";
import type { DemoDefinition } from "./demos/types.js";
import { log } from "./log.js";
import type { Channel, DemoEvent, DemoId, EndReason } from "./protocol.js";

/**
 * One visitor's demo: its own copy of the business's records, its transcript, and whoever is
 * watching it. Nothing is shared between sessions. Sessions live in this process's memory only;
 * the service runs as a single instance so a phone call and a paired browser reach the same one.
 */
type Listener = (e: DemoEvent) => void;

const HISTORY_CAP = 400;
/** Ended sessions stay readable this long so the visitor can look at the result. */
const KEEP_ENDED_MS = 10 * 60_000;
/** A session whose transport never connects is ended after this. */
const CONNECT_TIMEOUT_MS = 45_000;

export class DemoSession {
  readonly id = randomUUID();
  /** The browser that started this session proves it with this; never sent anywhere else. */
  readonly token = randomBytes(18).toString("base64url");
  readonly createdAt = Date.now();
  readonly demo: DemoDefinition<unknown>;
  state: unknown;
  version = 0;
  connected = false;
  /** The live agent actually started (a phone call that never got one hears an apology instead). */
  liveStarted = false;
  ended: EndReason | null = null;
  endedAt = 0;
  /** Set by the transport: asks it to finish the conversation gracefully (say goodbye, hang up). */
  requestEnd: (reason: EndReason) => void = (reason) => this.end(reason);
  /** Set by the phone bridge: links this call to a waiting page by its code. */
  linkScreen: ((code: string) => string) | null = null;
  /** Phone calls only: the caller's number as Twilio reported it (E.164), or null if withheld. Held in memory, never logged. */
  callerNumber: string | null = null;
  private listeners = new Set<Listener>();
  private history: DemoEvent[] = [];

  constructor(
    readonly demoId: DemoId,
    readonly channel: Channel,
  ) {
    this.demo = demos[demoId];
    this.state = this.demo.createState(new Date());
  }

  emit(e: DemoEvent) {
    if (e.type !== "audio" && e.type !== "audio.interrupted") {
      this.history.push(e);
      if (this.history.length > HISTORY_CAP) this.history.splice(0, this.history.length - HISTORY_CAP);
    }
    for (const l of this.listeners) {
      try {
        l(e);
      } catch (err) {
        log.warn("session.listener_failed", { session: this.id }, err);
      }
    }
  }

  view() {
    return this.demo.view(this.state);
  }

  publishState() {
    this.version++;
    this.emit({ type: "state", version: this.version, state: this.view() });
  }

  /** What a viewer joining now needs: the conversation so far in order (latest text per utterance) and state. */
  snapshot(): DemoEvent[] {
    const conversation: DemoEvent[] = [];
    const position = new Map<string, number>();
    for (const e of this.history) {
      if (e.type === "transcript") {
        const at = position.get(e.id);
        if (at === undefined) {
          position.set(e.id, conversation.length);
          conversation.push(e);
        } else conversation[at] = e;
      } else if (e.type === "tool.started" || e.type === "tool.succeeded" || e.type === "tool.failed") conversation.push(e);
    }
    return [
      { type: "session.ready", sessionId: this.id, demo: this.demoId, channel: this.channel },
      ...conversation,
      { type: "state", version: this.version, state: this.view() },
      ...(this.ended ? [{ type: "session.ended" as const, reason: this.ended }] : []),
    ];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  end(reason: EndReason) {
    if (this.ended) return;
    this.ended = reason;
    this.endedAt = Date.now();
    this.emit({ type: "session.ended", reason });
    log.info("session.ended", { session: this.id, demo: this.demoId, channel: this.channel, outcome: reason, duration_ms: this.endedAt - this.createdAt, version: this.version });
  }
}

const sessions = new Map<string, DemoSession>();

export type Admission = { ok: true; session: DemoSession } | { ok: false; reason: "disabled" | "busy" };

export function admit(demoId: DemoId, channel: Channel): Admission {
  if (!config.enabled) return { ok: false, reason: "disabled" };
  if (activeCount() >= config.maxConcurrent) {
    log.warn("session.refused_busy", { demo: demoId, channel, count: activeCount() });
    return { ok: false, reason: "busy" };
  }
  const session = new DemoSession(demoId, channel);
  sessions.set(session.id, session);
  log.info("session.created", { session: session.id, demo: demoId, channel });
  return { ok: true, session };
}

export const getSession = (id: string | undefined | null) => (id ? sessions.get(id) : undefined);
export const activeCount = () => [...sessions.values()].filter((s) => !s.ended).length;

/** Ends abandoned or over-long sessions and forgets old ended ones. */
export function startSweeper(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const s of sessions.values()) {
      if (!s.ended && !s.connected && now - s.createdAt > CONNECT_TIMEOUT_MS) s.end("disconnected");
      // The transport enforces the limit gracefully; this is the backstop.
      else if (!s.ended && now - s.createdAt > (config.maxSessionSeconds + 30) * 1000) s.end("time_limit");
      else if (s.ended && now - s.endedAt > KEEP_ENDED_MS) sessions.delete(s.id);
    }
  }, 5_000).unref();
}
