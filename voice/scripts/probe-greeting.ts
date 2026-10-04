/**
 * Measures time to the greeting's first audio while silent caller audio streams, as on a real call,
 * comparing when the greeting note is sent. Needs GEMINI_API_KEY.
 *   npx tsx scripts/probe-greeting.ts northline
 */
import { isDemoId } from "../src/demos/index.js";
import { openLive, warmUp } from "../src/live.js";
import { admit } from "../src/session.js";

const arg = process.argv[2] ?? "northline";
if (!isDemoId(arg)) throw new Error("demo must be northline or formfield");
const demo = arg;
const silence = Buffer.alloc(640).toString("base64"); // 20 ms of 16 kHz PCM16 silence

async function trial(mode: "text-first" | "audio-first" | "no-audio") {
  const a = admit(demo, "browser");
  if (!a.ok) throw new Error(a.reason);
  const started = Date.now();
  const live = await openLive(a.session);
  let stop = false;
  const pump = async () => { while (!stop) { live.sendAudio(silence); await new Promise((r) => setTimeout(r, 20)); } };
  if (mode === "audio-first") { void pump(); await new Promise((r) => setTimeout(r, 200)); }
  live.sendText("[The call has just connected. Greet the caller now.]");
  if (mode === "text-first") void pump();
  const timer = setTimeout(() => { stop = true; live.close(); }, 15_000);
  for await (const e of live.events) {
    if (e.type === "audio") { stop = true; clearTimeout(timer); live.close(); return `${Date.now() - started} ms`; }
  }
  return "no audio";
}
if (process.argv[3] === "warm") console.log("warm-up", await warmUp(), "ms");
for (const mode of ["no-audio", "text-first", "audio-first", "no-audio", "text-first"] as const) console.log(mode.padEnd(12), await trial(mode));
process.exit(0);
