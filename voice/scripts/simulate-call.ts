/**
 * Local verification: a synthetic phone call through the real bridge and Gemini Live, in-process.
 * Caller lines are spoken with macOS `say`, converted to 8 kHz mu-law and streamed in 20 ms frames
 * like Twilio Media Streams. Prints the transcript, tool events and record changes the dashboard
 * would receive. Needs GEMINI_API_KEY; makes real (small) model usage.
 *
 *   GEMINI_API_KEY=… npx tsx scripts/simulate-call.ts northline [script]
 */
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDemoId } from "../src/demos/index.js";
import { bridgePhone } from "../src/phone.js";
import type { DemoEvent } from "../src/protocol.js";
import { admit } from "../src/session.js";

const script = process.argv[2] ?? "northline";
const demo = script.split("-")[0]!;
if (!isDemoId(demo)) throw new Error("demo must be northline or formfield");

const SCRIPTS: Record<string, string[]> = {
  "formfield-order": [
    "Yeah, I need to find out where my order is.",
    "I don't have that information.",
    "Um, actually, I found the order number.",
    "The order number is 1042, and the email address is emilia at example dot com.",
    "Oh no. Okay. That's all, thanks, bye.",
  ],
  northline: [
    "Hi. My furnace stopped working this morning. Can someone come look at it tomorrow afternoon?",
    "My name is Alex Taylor, and the address is 48 Birch Lane.",
    "The first one you mentioned works for me.",
    "Yes, that's right, please book it.",
    "Actually, can we make it a bit later that day?",
    "Yes, move it to that one please.",
    "No, that's everything. Thanks, bye.",
  ],
  // A caller who only knows it is "heating or cooling": Ellie should ask, not echo it back.
  vague: [
    "Hi, I need someone to come out. It's probably some kind of heating or cooling thing.",
    "It's the heat. The house just isn't getting warm.",
    "No, nothing like that.",
    "Tomorrow afternoon if you can.",
    "The first one works.",
    "It's Alex Taylor, at 48 Birch Lane.",
    "Yes, please book it.",
    "No, that's everything. Thanks, bye.",
  ],
  formfield: [
    "Hi, I'm looking for a green table lamp, ideally under a hundred dollars.",
    "What's it made of, and how tall is it?",
    "Do you have it in oat?",
    "Okay, the sage green one then. Can you hold one for me to pick up? My name is Sam Rivera.",
    "Yes, that's correct.",
    "Actually, can you make that two?",
    "Yes please. That's all, thank you, bye.",
  ],
};

const dir = mkdtempSync(join(tmpdir(), "demo-call-"));
function speak(text: string, i: number): Buffer {
  const aiff = join(dir, `${i}.aiff`);
  const wav = join(dir, `${i}.wav`);
  execFileSync("say", ["-v", "Samantha", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "ulaw@8000", "-c", "1", aiff, wav]);
  const file = readFileSync(wav);
  const at = file.indexOf("data");
  return file.subarray(at + 8, at + 8 + file.readUInt32LE(at + 4));
}

class FakeTwilio extends EventEmitter {
  readyState = 1;
  mediaOut = 0;
  send(raw: string) {
    const msg = JSON.parse(raw) as { event: string; mark?: { name: string } };
    if (msg.event === "media") this.mediaOut++;
    // Twilio reports a mark once the audio before it has played; here, shortly after.
    if (msg.event === "mark") setTimeout(() => this.emit("message", Buffer.from(JSON.stringify({ event: "mark", mark: msg.mark }))), 300);
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit("close");
  }
  push(msg: unknown) {
    this.emit("message", Buffer.from(JSON.stringify(msg)));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;

const admission = admit(demo, "phone");
if (!admission.ok) throw new Error(admission.reason);
const session = admission.session;
let speaking = false;
let lastAgentAudio = Date.now();
let ended = false;
session.subscribe((e: DemoEvent) => {
  if (e.type === "transcript" && e.final) console.log(`${stamp()}  ${e.speaker === "agent" ? "AGENT " : "CALLER"}  ${e.text}`);
  else if (e.type === "tool.started") console.log(`${stamp()}    ⋯ ${e.label}  [${e.tool}]`);
  else if (e.type === "tool.succeeded") console.log(`${stamp()}    ✓ ${e.summary}  (v${e.version})`);
  else if (e.type === "tool.failed") console.log(`${stamp()}    ✗ ${e.label}: ${e.summary}`);
  else if (e.type === "agent.speaking") {
    speaking = e.speaking;
    lastAgentAudio = Date.now();
  } else if (e.type === "session.ended") {
    ended = true;
    console.log(`${stamp()}  — session ended: ${e.reason}`);
  }
});

const twilio = new FakeTwilio();
bridgePhone(twilio as never);
twilio.push({ event: "start", start: { streamSid: "MZsimulated", callSid: "CAsimulated", customParameters: { sessionId: session.id } } });

const SILENCE = Buffer.alloc(160, 0xff).toString("base64");
let stopSilence = false;
// Keep the line open with silence between caller lines, like a real call.
void (async () => {
  while (!stopSilence && !ended) {
    twilio.push({ event: "media", media: { payload: SILENCE } });
    await sleep(20);
  }
})();

async function waitForAgent(timeoutMs = 30_000) {
  const start = Date.now();
  // Wait for the agent to start, then for it to stop and stay quiet briefly.
  while (!speaking && Date.now() - start < timeoutMs && !ended) await sleep(50);
  while (Date.now() - start < timeoutMs && !ended) {
    if (!speaking && Date.now() - lastAgentAudio > 1_200) return;
    await sleep(50);
  }
}

await waitForAgent();
for (const [i, line] of SCRIPTS[process.argv[3] ?? demo]!.entries()) {
  if (ended) break;
  const audio = speak(line, i);
  console.log(`${stamp()}  (caller says: ${line})`);
  stopSilence = true;
  await sleep(25);
  for (let o = 0; o < audio.length; o += 160) {
    twilio.push({ event: "media", media: { payload: audio.subarray(o, o + 160).toString("base64") } });
    await sleep(20);
  }
  stopSilence = false;
  void (async () => {
    while (!stopSilence && !ended) {
      twilio.push({ event: "media", media: { payload: SILENCE } });
      await sleep(20);
    }
  })();
  await waitForAgent();
}
await sleep(4_000);
console.log("\nFinal records:", JSON.stringify(session.view(), null, 2));
twilio.close();
await sleep(500);
process.exit(0);
