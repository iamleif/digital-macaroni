import type WebSocket from "ws";
import { createPhoneEncoder, twilioToGemini, voiceStats } from "./audio.js";
import { config } from "./config.js";
import { openLive, TranscriptTracker, type LiveSession } from "./live.js";
import { log } from "./log.js";
import type { EndReason } from "./protocol.js";
import { linkCall, MAX_ATTEMPTS_PER_CALL } from "./pairing.js";
import { getSession, type DemoSession } from "./session.js";

/**
 * One phone call: Twilio Media Streams on one side, the demo's live agent on the other. Adapted from
 * Anders' bridge.ts, without its prerecorded opening: the agent greets at once and the caller can
 * talk over the greeting. An interruption clears Twilio's queued audio. The call ends when the agent
 * says goodbye (end_call), the line stays silent, or the demo's time limit is reached; a mark after
 * the last audio lets the goodbye play in full before the stream closes, which ends the call.
 */
interface TwilioMessage {
  event: string;
  dtmf?: { digit: string };
  start?: { streamSid: string; callSid: string; customParameters?: Record<string, string> };
  media?: { payload: string };
  mark?: { name: string };
}

const GREET_NOTE = "[The call has just connected. Greet the caller now.]";
const NUDGE_NOTE = "[The line has been quiet for a while. Briefly and warmly check whether the caller is still there.]";
const SILENT_GOODBYE_NOTE = "[The line is still quiet. Say a short, friendly goodbye, then call end_call.]";
const TIME_NOTE = "[The demo call has reached its time limit. Kindly tell the caller the demo is ending, thank them for trying it, mention they can try it again or get in touch on the website, then call end_call.]";
const LINKED_NOTE = "[The caller has just linked their screen with the keypad code; they can now see the dashboard. Acknowledge it in a few words and carry on.]";
const HANGUP_MARK = "demo-hangup";
const SPEECH_RMS = 700;
/** Caller audio held while the live session connects: about five seconds of 20 ms frames. */
const PENDING_CAP = 250;

function rms(pcm16kBase64: string): number {
  const pcm = Buffer.from(pcm16kBase64, "base64");
  let sum = 0;
  const n = pcm.length >> 1;
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2);
    sum += s * s;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

export function bridgePhone(twilio: WebSocket): void {
  let session: DemoSession | undefined;
  let live: LiveSession | null = null;
  let tracker: TranscriptTracker | null = null;
  let streamSid = "";
  let startedAt = 0;
  const pending: string[] = [];
  let lastSpeechAt = 0;
  let playbackEndsAt = 0;
  let speaking = false;
  let firstAudio = false;
  let nudged = false;
  let finished = false;
  let hangup: { reason: EndReason; markSent: boolean; settle?: NodeJS.Timeout; backstop: NodeJS.Timeout } | null = null;
  const timers: NodeJS.Timeout[] = [];
  const encoder = createPhoneEncoder();
  // Diagnostics only (DEMO_VOICE_DIAGNOSTICS=1): the agent's audio for the current turn, measured then dropped.
  let turnAudio: Buffer[] = [];
  let turnNumber = 0;
  function measureTurn() {
    if (!config.voiceDiagnostics || !turnAudio.length) return;
    const stats = voiceStats(Buffer.concat(turnAudio));
    turnAudio = [];
    log.info("phone.agent_voice", { session: session?.id, count: ++turnNumber, duration_ms: stats.seconds * 1000, pitch_hz: stats.pitchHz, loudness_db: stats.loudnessDb });
  }
  let digits = "";
  let lastDigitAt = 0;
  let linkAttempts = 0;
  let linked = false;

  /** Links this call to a waiting page. Shared by keypad entry and the agent's link_screen tool. */
  function link(code: string): string {
    if (!session) return "not_found";
    if (linked) return "linked";
    if (linkAttempts >= MAX_ATTEMPTS_PER_CALL) return "too_many_attempts";
    linkAttempts++;
    const result = linkCall(code, session);
    if (result === "linked") {
      linked = true;
      log.info("phone.screen_linked", { session: session.id });
    }
    return result;
  }

  const send = (msg: unknown) => {
    if (twilio.readyState === 1) twilio.send(JSON.stringify(msg));
  };

  let speakingTimer: NodeJS.Timeout | null = null;
  /** The agent stops "speaking" when its queued audio has finished playing, not when it stops sending. */
  function speakingEndsWithPlayback() {
    if (speakingTimer) clearTimeout(speakingTimer);
    speakingTimer = setTimeout(() => setSpeaking(false), Math.max(0, playbackEndsAt - Date.now()));
  }

  function setSpeaking(on: boolean) {
    if (speaking === on || !session) return;
    speaking = on;
    session.emit({ type: "agent.speaking", speaking: on });
  }

  function sendHangupMark() {
    if (!hangup || hangup.markSent) return;
    hangup.markSent = true;
    if (hangup.settle) clearTimeout(hangup.settle);
    send({ event: "mark", streamSid, mark: { name: HANGUP_MARK } });
  }

  /** Waits for the goodbye to be spoken (or to start, when the model still has to say it), then marks. */
  function requestHangup(reason: EndReason, waitForGoodbyeMs = 1_500) {
    if (hangup || finished) return;
    hangup = { reason, markSent: false, backstop: setTimeout(() => twilio.close(), 12_000) };
    hangup.settle = setTimeout(sendHangupMark, waitForGoodbyeMs);
  }

  function finish(reason: EndReason) {
    if (finished) return;
    finished = true;
    for (const t of timers) clearInterval(t);
    if (hangup) {
      clearTimeout(hangup.backstop);
      if (hangup.settle) clearTimeout(hangup.settle);
    }
    tracker?.finishAll();
    setSpeaking(false);
    live?.close();
    session?.end(hangup?.reason ?? reason);
    log.info("phone.call_ended", { session: session?.id, duration_ms: startedAt ? Date.now() - startedAt : 0 });
  }

  function tick() {
    if (!live || hangup || finished) return;
    const now = Date.now();
    if (now - startedAt >= (config.maxSessionSeconds - 20) * 1000) {
      live.sendText(TIME_NOTE);
      requestHangup("time_limit", 8_000);
      return;
    }
    const quietFor = now - Math.max(lastSpeechAt, playbackEndsAt, startedAt);
    if (!nudged && quietFor >= 12_000) {
      nudged = true;
      live.sendText(NUDGE_NOTE);
      playbackEndsAt = Math.max(playbackEndsAt, now);
    } else if (nudged && quietFor >= 10_000) {
      live.sendText(SILENT_GOODBYE_NOTE);
      requestHangup("silence", 8_000);
    }
  }

  async function run(l: LiveSession) {
    try {
      for await (const e of l.events) {
        if (e.type === "interrupted") {
          send({ event: "clear", streamSid });
          encoder.reset();
          measureTurn();
          playbackEndsAt = Date.now();
          tracker?.finishAgent();
          if (speakingTimer) clearTimeout(speakingTimer);
          setSpeaking(false);
        } else if (e.type === "turn_complete") {
          measureTurn();
          tracker?.finishAll();
          speakingEndsWithPlayback();
          if (hangup) sendHangupMark();
        } else if (e.type === "transcript") {
          if (e.speaker === "visitor") tracker?.visitorText(e.text);
          else tracker?.agentText(e.text, e.finished);
        } else if (e.type === "transcript_set") {
          tracker?.visitorSet(e.text, e.final);
        } else if (e.type === "agent_correction") {
          tracker?.correctAgent(e.text);
        } else if (e.type === "audio") {
          if (!firstAudio) {
            firstAudio = true;
            log.info("phone.first_audio", { session: session?.id, latency_ms: Date.now() - startedAt });
          }
          if (speakingTimer) clearTimeout(speakingTimer);
          if (!speaking && lastSpeechAt) log.info("phone.turn_latency", { session: session?.id, latency_ms: Date.now() - lastSpeechAt });
          setSpeaking(true);
          if (config.voiceDiagnostics && turnAudio.length < 1500) turnAudio.push(Buffer.from(e.data, "base64"));
          const payload = encoder.encode(e.data);
          playbackEndsAt = Math.max(Date.now(), playbackEndsAt) + Math.floor((payload.length * 3) / 4 / 8);
          if (hangup && !hangup.markSent) {
            if (hangup.settle) clearTimeout(hangup.settle);
            hangup.settle = setTimeout(sendHangupMark, 1_500);
          }
          send({ event: "media", streamSid, media: { payload } });
        }
      }
    } catch (err) {
      if (!finished) log.warn("phone.live_error", { session: session?.id }, err);
    } finally {
      if (twilio.readyState === 1) twilio.close();
    }
  }

  twilio.on("message", (raw: Buffer) => {
    let msg: TwilioMessage;
    try {
      msg = JSON.parse(raw.toString()) as TwilioMessage;
    } catch {
      return;
    }
    if (msg.event === "start" && msg.start) {
      streamSid = msg.start.streamSid;
      startedAt = Date.now();
      session = getSession(msg.start.customParameters?.sessionId);
      if (!session || session.ended || session.connected || session.channel !== "phone") {
        log.warn("phone.unknown_session");
        twilio.close();
        return;
      }
      const s = session;
      s.connected = true;
      s.requestEnd = (reason) => requestHangup(reason);
      s.linkScreen = link;
      tracker = new TranscriptTracker(s);
      s.emit({ type: "session.ready", sessionId: s.id, demo: s.demoId, channel: "phone" });
      s.publishState();
      openLive(s)
        .then((l) => {
          if (finished) return l.close();
          live = l;
          s.liveStarted = true;
          log.info("phone.live_ready", { session: s.id, latency_ms: Date.now() - startedAt });
          if (!l.greetsItself) l.sendText(GREET_NOTE);
          for (const p of pending.splice(0)) l.sendAudio(p);
          timers.push(setInterval(tick, 1_000));
          void run(l);
        })
        .catch((err) => {
          log.error("phone.live_failed", { session: s.id }, err);
          s.emit({ type: "session.error", message: "The agent could not connect." });
          twilio.close();
        });
    } else if (msg.event === "media" && msg.media) {
      const pcm = twilioToGemini(msg.media.payload);
      if (rms(pcm) > SPEECH_RMS) {
        lastSpeechAt = Date.now();
        nudged = false;
      }
      if (live) live.sendAudio(pcm);
      else if (pending.length < PENDING_CAP) pending.push(pcm);
    } else if (msg.event === "dtmf" && msg.dtmf && /^[0-9]$/.test(msg.dtmf.digit)) {
      // A four-digit code typed on the keypad; digits more than five seconds apart start over.
      const now = Date.now();
      if (now - lastDigitAt > 5_000) digits = "";
      lastDigitAt = now;
      digits = (digits + msg.dtmf.digit).slice(-4);
      if (digits.length === 4 && !linked) {
        const result = link(digits);
        digits = "";
        if (result === "linked") live?.sendText(LINKED_NOTE);
      }
    } else if (msg.event === "mark" && msg.mark?.name === HANGUP_MARK) {
      twilio.close();
    } else if (msg.event === "stop") {
      finish("visitor_ended");
    }
  });
  twilio.on("close", () => finish("disconnected"));
  twilio.on("error", () => finish("error"));
  // Hard backstop for the demo's time limit, whatever the model does.
  timers.push(setTimeout(() => twilio.close(), (config.maxSessionSeconds + 10) * 1000));
}
