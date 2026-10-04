import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { config } from "./config.js";
import { warmUp } from "./live.js";
import { log } from "./log.js";
import { bridgeBrowser } from "./browser.js";
import { isDemoId } from "./demos/index.js";
import { createPairing, dropPairing, pairingForViewer } from "./pairing.js";
import { bridgePhone } from "./phone.js";
import type { DemoEvent } from "./protocol.js";
import { activeCount, admit, getSession, startSweeper, type DemoSession } from "./session.js";
import { hangupTwiml, noticeTwiml, rejectTwiml, streamTwiml, validMediaSignature, validTwilioSignature } from "./twilio.js";

/**
 * Digital Macaroni demo voice service. Each demo number reaches its own agent; every call gets its
 * own session with isolated sample records. Browser conversations and phone pairing are served by
 * the same process (single instance: sessions live in memory).
 */
const app = Fastify({ logger: false, trustProxy: true });
await app.register(formbody);
await app.register(websocket, { options: { maxPayload: 256 * 1024 } });

app.get("/health", async () => ({ ok: true, enabled: config.enabled, active: activeCount() }));

const signed = (path: string, params: Record<string, string>, signature: unknown) =>
  config.skipTwilioSignature || validTwilioSignature(config.twilioAuthToken, `${config.publicUrl}${path}`, params, typeof signature === "string" ? signature : undefined);

app.post("/twilio/voice", async (req, reply) => {
  const params = (req.body ?? {}) as Record<string, string>;
  if (!signed("/twilio/voice", params, req.headers["x-twilio-signature"])) {
    log.warn("twilio.bad_signature", { route: "voice" });
    return reply.code(403).send();
  }
  const demo = config.numbers[params.To ?? ""];
  if (!demo) {
    log.warn("twilio.unrouted_number");
    return reply.type("text/xml").send(rejectTwiml());
  }
  const admission = admit(demo, "phone");
  if (!admission.ok) {
    const notice =
      admission.reason === "disabled"
        ? "Thanks for calling Digital Macaroni's demo line. The demo is paused right now. Please try again later."
        : "Thanks for calling Digital Macaroni's demo line. All of our demo agents are busy right now. Please try again in a few minutes, or talk to the agent on our website.";
    return reply.type("text/xml").send(noticeTwiml(notice));
  }
  const from = params.From ?? "";
  admission.session.callerNumber = /^\+[1-9][0-9]{6,14}$/.test(from) ? from : null;
  log.info("twilio.call_answered", { session: admission.session.id, demo, caller_id: Boolean(admission.session.callerNumber) });
  const streamUrl = `${config.publicUrl.replace(/^http/, "ws")}/twilio/media`;
  const after = `${config.publicUrl}/twilio/after-stream?session=${admission.session.id}`;
  return reply.type("text/xml").send(streamTwiml(streamUrl, { sessionId: admission.session.id }, after));
});

// The stream has ended. If the agent never started (its engine was unavailable), say so politely.
app.post("/twilio/after-stream", async (req, reply) => {
  const params = (req.body ?? {}) as Record<string, string>;
  const id = (req.query as { session?: string }).session ?? "";
  if (!signed(`/twilio/after-stream?session=${id}`, params, req.headers["x-twilio-signature"])) {
    log.warn("twilio.bad_signature", { route: "after-stream" });
    return reply.code(403).send();
  }
  const session = getSession(id);
  if (session && !session.liveStarted) {
    log.warn("twilio.agent_unavailable", { session: session.id, demo: session.demoId });
    return reply.type("text/xml").send(noticeTwiml("Sorry, this demo isn't available right now. Please try again a little later, or try it on our website."));
  }
  return reply.type("text/xml").send(hangupTwiml());
});

// Twilio signs the WebSocket handshake too; anything unsigned is closed before a model session opens.
app.get("/twilio/media", { websocket: true }, (socket, req) => {
  const signature = req.headers["x-twilio-signature"];
  if (!config.skipTwilioSignature && !validMediaSignature(config.twilioAuthToken, config.publicUrl, typeof signature === "string" ? signature : undefined)) {
    log.warn("twilio.bad_signature", { route: "media" });
    socket.close(1008);
    return;
  }
  bridgePhone(socket);
});

// ---- Website: browser conversations and watching a phone call ----

const allowedOrigin = (origin: unknown) => typeof origin === "string" && config.allowedOrigins.includes(origin);

app.addHook("onRequest", async (req, reply) => {
  if (!req.url.startsWith("/browser/") && !req.url.startsWith("/pairings")) return;
  const origin = req.headers.origin;
  if (allowedOrigin(origin)) {
    reply.header("access-control-allow-origin", origin);
    reply.header("vary", "origin");
    reply.header("access-control-allow-methods", "POST, OPTIONS");
    reply.header("access-control-allow-headers", "content-type");
  }
  if (req.method === "OPTIONS") return reply.code(204).send();
});

/** Per-visitor limits on starting paid sessions; a single instance, so in-memory is the real limit. */
const starts = new Map<string, number[]>();
function allowStart(ip: string, max: number): boolean {
  const now = Date.now();
  const recent = (starts.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= max) return false;
  recent.push(now);
  starts.set(ip, recent);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of starts) if (times.every((t) => now - t > 10 * 60_000)) starts.delete(ip);
}, 60_000).unref();

app.post("/browser/sessions", async (req, reply) => {
  if (!allowedOrigin(req.headers.origin)) return reply.code(403).send({ error: "origin" });
  const demo = (req.body as { demo?: unknown } | undefined)?.demo;
  if (!isDemoId(demo)) return reply.code(400).send({ error: "demo" });
  if (!allowStart(`talk:${req.ip}`, 6)) return reply.code(429).send({ error: "rate_limited", message: "You have started several demos in a short time. Please wait a few minutes." });
  const admission = admit(demo, "browser");
  if (!admission.ok) {
    return reply.code(503).send({ error: admission.reason, message: admission.reason === "busy" ? "Our demo agents are all busy. Please try again in a minute or two." : "The demo is paused right now." });
  }
  return { sessionId: admission.session.id, token: admission.session.token, maxSeconds: config.maxSessionSeconds };
});

app.get("/browser/sessions/:id", { websocket: true }, (socket, req) => {
  const session = getSession((req.params as { id: string }).id);
  const token = (req.query as { token?: string }).token;
  if (!allowedOrigin(req.headers.origin) || !session || session.channel !== "browser" || session.token !== token || session.connected || session.ended) {
    socket.close(1008);
    return;
  }
  bridgeBrowser(socket, session);
});

app.post("/pairings", async (req, reply) => {
  if (!allowedOrigin(req.headers.origin)) return reply.code(403).send({ error: "origin" });
  const demo = (req.body as { demo?: unknown } | undefined)?.demo;
  if (!isDemoId(demo)) return reply.code(400).send({ error: "demo" });
  if (!allowStart(`pair:${req.ip}`, 20)) return reply.code(429).send({ error: "rate_limited" });
  const p = createPairing(demo);
  return { code: p.code, viewerToken: p.viewerToken, expiresAt: p.expiresAt };
});

// A page watching a phone call: waits for the code, then receives that call's events (never audio).
app.get("/pairings/:token", { websocket: true }, (socket, req) => {
  const p = pairingForViewer((req.params as { token: string }).token);
  if (!allowedOrigin(req.headers.origin) || !p) {
    socket.close(1008);
    return;
  }
  const send = (e: DemoEvent) => socket.readyState === 1 && socket.send(JSON.stringify(e));
  let unsubscribe = () => {};
  const attach = (session: DemoSession) => {
    send({ type: "pairing.linked" });
    for (const e of session.snapshot()) send(e);
    unsubscribe = session.subscribe((e) => e.type !== "audio" && send(e));
  };
  if (p.session) attach(p.session);
  else {
    send({ type: "pairing.waiting", code: p.code, expiresAt: p.expiresAt });
    p.onLinked = attach;
    const expiry = setTimeout(() => {
      if (!p.session) {
        send({ type: "pairing.expired" });
        socket.close(1000);
      }
    }, Math.max(0, p.expiresAt - Date.now()));
    socket.on("close", () => clearTimeout(expiry));
  }
  socket.on("close", () => {
    unsubscribe();
    if (!p.session) dropPairing(p);
  });
});

startSweeper();
if (!config.geminiApiKey) log.error("config.missing_gemini_key");
if (!config.twilioAuthToken && !config.skipTwilioSignature) log.error("config.missing_twilio_token");
await app.listen({ host: "0.0.0.0", port: config.port });
log.info("service.started", { model: config.model, enabled: config.enabled, max_concurrent: config.maxConcurrent });

// Keep the model connection warm so the first visitor after a quiet spell is not the slow one.
const warm = () => warmUp().then((ms) => log.info("live.warmed", { latency_ms: ms }));
if (config.geminiApiKey) {
  void warm();
  setInterval(() => void warm(), 4 * 60_000).unref();
}
