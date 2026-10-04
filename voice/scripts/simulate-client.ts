/**
 * Local verification against a running server (npm run dev with DEMO_SKIP_TWILIO_SIGNATURE=1):
 *
 *   npx tsx scripts/simulate-client.ts browser northline   # a website conversation
 *   npx tsx scripts/simulate-client.ts paired formfield    # a phone call linked to a watching page by keypad code
 *
 * Caller lines are spoken with macOS `say`. Prints what a page would receive.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const [mode = "browser", demo = "northline", script] = process.argv.slice(2);
const lines = () => LINES[script ?? demo]!;
const BASE = process.env.DEMO_URL ?? "http://localhost:8080";
const ORIGIN = "http://127.0.0.1:3790";
const NUMBERS: Record<string, string> = { northline: "+12068879619", formfield: "+18302392110" };
const LINES: Record<string, string[]> = {
  northline: ["Hi, can someone come and fix a leaking pipe under my kitchen sink on Monday morning?", "It's Jamie Fox, at 12 Orchard Road.", "The earliest one, please.", "Yes, book it.", "That's all, thanks. Goodbye."],
  callback: ["Hi, I'd like someone from your team to call me back about a quote for a new water heater.", "My name is Chris.", "Yes, that number is fine.", "No, that's all. Bye."],
  formfield: ["Hi! Do you have any planters?", "Is the large sage one in stock?", "Great, can you reserve one for Priya?", "Yes, please.", "That's everything, thank you. Bye."],
};

const dir = mkdtempSync(join(tmpdir(), "demo-client-"));
function speak(text: string, i: number, format: "ulaw@8000" | "LEI16@16000"): Buffer {
  const aiff = join(dir, `${i}.aiff`);
  const wav = join(dir, `${i}-${format}.wav`);
  execFileSync("say", ["-v", "Samantha", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", format, "-c", "1", aiff, wav]);
  const file = readFileSync(wav);
  const at = file.indexOf("data");
  return file.subarray(at + 8, at + 8 + file.readUInt32LE(at + 4));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;
let speaking = false;
let lastAgent = Date.now();
let ended = false;
let agentAudioBytes = 0;

function show(raw: string) {
  const e = JSON.parse(raw);
  if (e.type === "transcript" && e.final) console.log(`${stamp()}  ${e.speaker === "agent" ? "AGENT  " : "VISITOR"}  ${e.text}`);
  else if (e.type === "tool.started") console.log(`${stamp()}    ⋯ ${e.label}`);
  else if (e.type === "tool.succeeded") console.log(`${stamp()}    ✓ ${e.summary}`);
  else if (e.type === "tool.failed") console.log(`${stamp()}    ✗ ${e.label}: ${e.summary}`);
  else if (e.type === "state") console.log(`${stamp()}    · state v${e.version}`);
  else if (e.type === "agent.speaking") {
    speaking = e.speaking;
    lastAgent = Date.now();
  } else if (e.type === "session.ended") {
    ended = true;
    console.log(`${stamp()}  — ended: ${e.reason}`);
  } else if (!["transcript", "audio.interrupted"].includes(e.type)) console.log(`${stamp()}  [${e.type}${e.code ? ` ${e.code}` : ""}${e.message ? `: ${e.message}` : ""}]`);
}

async function waitForAgent(timeoutMs = 30_000) {
  const start = Date.now();
  while (!speaking && Date.now() - start < timeoutMs && !ended) await sleep(50);
  while (Date.now() - start < timeoutMs && !ended) {
    if (!speaking && Date.now() - lastAgent > 1_200) return;
    await sleep(50);
  }
}

async function post(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.json() as Promise<Record<string, string>>;
}

/** Streams frames in real time, with silence between lines, until told to stop. */
function line(sendFrame: (b: Buffer) => void, frameBytes: number, silenceByte: number) {
  let current: Buffer | null = null;
  let offset = 0;
  const silence = Buffer.alloc(frameBytes, silenceByte);
  const timer = setInterval(() => {
    if (current && offset < current.length) {
      sendFrame(current.subarray(offset, offset + frameBytes));
      offset += frameBytes;
    } else {
      current = null;
      sendFrame(silence);
    }
  }, 20);
  return {
    say: async (audio: Buffer) => {
      current = audio;
      offset = 0;
      while (current) await sleep(20);
    },
    stop: () => clearInterval(timer),
  };
}

if (mode === "browser") {
  const { sessionId, token } = await post("/browser/sessions", { demo });
  const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/browser/sessions/${sessionId}?token=${token}`, { headers: { origin: ORIGIN } });
  ws.on("message", (data, isBinary) => (isBinary ? (agentAudioBytes += (data as Buffer).length) : show(data.toString())));
  await new Promise((r) => ws.once("open", r));
  const mic = line((b) => ws.readyState === 1 && ws.send(b), 640, 0);
  await waitForAgent();
  for (const [i, text] of lines().entries()) {
    if (ended) break;
    console.log(`${stamp()}  (says: ${text})`);
    await mic.say(speak(text, i, "LEI16@16000"));
    await waitForAgent();
  }
  await sleep(3_000);
  mic.stop();
  console.log(`agent audio received: ${(agentAudioBytes / 48_000).toFixed(1)} s`);
  ws.close();
} else {
  // The page asks for a code and watches; the "caller" dials the demo number and types the code.
  const { code, viewerToken } = await post("/pairings", { demo });
  const viewer = new WebSocket(`${BASE.replace(/^http/, "ws")}/pairings/${viewerToken}`, { headers: { origin: ORIGIN } });
  viewer.on("message", (d) => show(d.toString()));
  await new Promise((r) => viewer.once("open", r));
  const form = new URLSearchParams({ CallSid: "CA" + "0".repeat(32), From: "+15555550100", To: NUMBERS[demo]! });
  const twiml = await (await fetch(`${BASE}/twilio/voice`, { method: "POST", body: form })).text();
  const sessionId = /name="sessionId" value="([^"]+)"/.exec(twiml)?.[1];
  if (!sessionId) throw new Error(`no session in TwiML: ${twiml}`);
  const call = new WebSocket(`${BASE.replace(/^http/, "ws")}/twilio/media`);
  await new Promise((r) => call.once("open", r));
  call.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.event === "mark") setTimeout(() => call.readyState === 1 && call.send(JSON.stringify({ event: "mark", mark: m.mark })), 300);
  });
  call.send(JSON.stringify({ event: "start", start: { streamSid: "MZsim", callSid: "CAsim", customParameters: { sessionId } } }));
  const phone = line((b) => call.readyState === 1 && call.send(JSON.stringify({ event: "media", media: { payload: b.toString("base64") } })), 160, 0xff);
  await waitForAgent();
  console.log(`${stamp()}  (types code ${code} on the keypad)`);
  for (const digit of code!) {
    call.send(JSON.stringify({ event: "dtmf", dtmf: { track: "inbound_track", digit } }));
    await sleep(250);
  }
  await waitForAgent(8_000);
  for (const [i, text] of lines().entries()) {
    if (ended) break;
    console.log(`${stamp()}  (says: ${text})`);
    await phone.say(speak(text, i, "ulaw@8000"));
    await waitForAgent();
  }
  await sleep(3_000);
  phone.stop();
  call.close();
  viewer.close();
}
await sleep(500);
process.exit(0);
