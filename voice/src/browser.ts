import type WebSocket from "ws";
import { config } from "./config.js";
import { openLive, TranscriptTracker, type LiveSession } from "./live.js";
import { log } from "./log.js";
import type { DemoEvent, EndReason } from "./protocol.js";
import type { DemoSession } from "./session.js";

/**
 * One browser conversation. The page sends microphone audio as binary frames (16-bit PCM, 16 kHz,
 * mono) and {"type":"end"} to hang up. It receives the agent's audio as binary frames (16-bit PCM,
 * 24 kHz) and every session event as JSON: transcript, tool activity, state, lifecycle. The same
 * socket carries both, so the dashboard and the voice cannot belong to different sessions.
 */
const GREET_NOTE = "[The visitor has just pressed Talk on the website and is listening. Greet them now.]";
const NUDGE_NOTE = "[The visitor has been quiet for a while. Briefly and warmly check whether they are still there.]";
const SILENT_GOODBYE_NOTE = "[The visitor is still quiet. Say a short, friendly goodbye, then call end_call.]";
const TIME_NOTE = "[The demo has reached its time limit. Kindly say the demo is ending, thank them for trying it, then call end_call.]";
const SPEECH_RMS = 700;
const MAX_FRAME_BYTES = 32_000; // one second of 16 kHz PCM16

function rms(pcm: Buffer): number {
  let sum = 0;
  const n = pcm.length >> 1;
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2);
    sum += s * s;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

export function bridgeBrowser(socket: WebSocket, session: DemoSession): void {
  let live: LiveSession | null = null;
  const tracker = new TranscriptTracker(session);
  const startedAt = Date.now();
  const pending: string[] = [];
  let lastSpeechAt = 0;
  let lastAgentAudioAt = 0;
  let speaking = false;
  let nudged = false;
  let finished = false;
  let ending: { reason: EndReason; timer: NodeJS.Timeout } | null = null;
  const timers: NodeJS.Timeout[] = [];

  const sendJson = (e: DemoEvent) => {
    if (socket.readyState === 1) socket.send(JSON.stringify(e));
  };
  const unsubscribe = session.subscribe((e) => {
    if (e.type !== "audio") sendJson(e);
  });

  // When the page will have finished playing what was sent (24 kHz PCM16: 48 bytes per ms).
  let playbackEndsAt = 0;
  let speakingTimer: NodeJS.Timeout | null = null;
  function speakingEndsWithPlayback() {
    if (speakingTimer) clearTimeout(speakingTimer);
    speakingTimer = setTimeout(() => setSpeaking(false), Math.max(0, playbackEndsAt - Date.now()));
  }

  function setSpeaking(on: boolean) {
    if (speaking === on) return;
    speaking = on;
    session.emit({ type: "agent.speaking", speaking: on });
  }

  function finish(reason: EndReason) {
    if (finished) return;
    finished = true;
    for (const t of timers) clearTimeout(t);
    if (ending) clearTimeout(ending.timer);
    tracker.finishAll();
    setSpeaking(false);
    live?.close();
    session.end(ending?.reason ?? reason);
    unsubscribe();
    // Let the page receive session.ended, then close; it keeps showing the result.
    setTimeout(() => socket.readyState === 1 && socket.close(1000), 250);
    log.info("browser.ended", { session: session.id, duration_ms: Date.now() - startedAt });
  }

  /** Ends once the goodbye has been spoken: after the turn completes, or a quiet spell, or a backstop. */
  function requestEnd(reason: EndReason, waitMs = 1_500) {
    if (ending || finished) return;
    ending = { reason, timer: setTimeout(() => finish(reason), waitMs) };
  }
  session.requestEnd = (reason) => requestEnd(reason, reason === "agent_ended" ? 2_500 : 9_000);

  function tick() {
    if (!live || ending || finished) return;
    const now = Date.now();
    if (now - startedAt >= (config.maxSessionSeconds - 20) * 1000) {
      live.sendText(TIME_NOTE);
      requestEnd("time_limit", 12_000);
      return;
    }
    const quietFor = now - Math.max(lastSpeechAt, lastAgentAudioAt, startedAt);
    if (!nudged && quietFor >= 15_000) {
      nudged = true;
      live.sendText(NUDGE_NOTE);
      lastAgentAudioAt = now;
    } else if (nudged && quietFor >= 12_000) {
      live.sendText(SILENT_GOODBYE_NOTE);
      requestEnd("silence", 10_000);
    }
  }

  async function run(l: LiveSession) {
    try {
      for await (const e of l.events) {
        if (e.type === "interrupted") {
          sendJson({ type: "audio.interrupted" });
          tracker.finishAgent();
          playbackEndsAt = Date.now();
          if (speakingTimer) clearTimeout(speakingTimer);
          setSpeaking(false);
        } else if (e.type === "turn_complete") {
          tracker.finishAll();
          speakingEndsWithPlayback();
          if (ending) {
            clearTimeout(ending.timer);
            const reason = ending.reason;
            ending.timer = setTimeout(() => finish(reason), 1_200);
          }
        } else if (e.type === "transcript") {
          if (e.speaker === "visitor") tracker.visitorText(e.text);
          else tracker.agentText(e.text, e.finished);
        } else if (e.type === "transcript_set") {
          tracker.visitorSet(e.text, e.final);
        } else if (e.type === "agent_correction") {
          tracker.correctAgent(e.text);
        } else if (e.type === "audio") {
          if (!lastAgentAudioAt) log.info("browser.first_audio", { session: session.id, latency_ms: Date.now() - startedAt });
          if (!speaking && lastSpeechAt) log.info("browser.turn_latency", { session: session.id, latency_ms: Date.now() - lastSpeechAt });
          lastAgentAudioAt = Date.now();
          if (speakingTimer) clearTimeout(speakingTimer);
          setSpeaking(true);
          const audio = Buffer.from(e.data, "base64");
          playbackEndsAt = Math.max(Date.now(), playbackEndsAt) + audio.length / 48;
          lastAgentAudioAt = playbackEndsAt;
          if (socket.readyState === 1) socket.send(audio);
        }
      }
    } catch (err) {
      if (!finished) log.warn("browser.live_error", { session: session.id }, err);
    } finally {
      if (!finished) {
        if (!ending) sendJson({ type: "session.error", message: "The conversation was interrupted." });
        finish("error");
      }
    }
  }

  socket.on("message", (data: Buffer, isBinary: boolean) => {
    if (finished) return;
    if (isBinary) {
      if (data.length > MAX_FRAME_BYTES || data.length % 2) return;
      if (rms(data) > SPEECH_RMS) {
        lastSpeechAt = Date.now();
        nudged = false;
      }
      const b64 = data.toString("base64");
      if (live) live.sendAudio(b64);
      else if (pending.length < 100) pending.push(b64);
      return;
    }
    try {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === "end") finish("visitor_ended");
    } catch {
      // Ignore anything that is not a known message.
    }
  });
  socket.on("close", () => finish("disconnected"));
  socket.on("error", () => finish("error"));
  timers.push(setTimeout(() => finish("time_limit"), (config.maxSessionSeconds + 10) * 1000));

  session.connected = true;
  for (const e of session.snapshot()) sendJson(e);
  openLive(session)
    .then((l) => {
      if (finished) return l.close();
      live = l;
      if (!l.greetsItself) l.sendText(GREET_NOTE);
      for (const p of pending.splice(0)) l.sendAudio(p);
      timers.push(setInterval(tick, 1_000));
      void run(l);
    })
    .catch((err) => {
      log.error("browser.live_failed", { session: session.id }, err);
      sendJson({ type: "session.error", message: "The agent could not connect. Please try again, or call the demo number." });
      finish("error");
    });
}
