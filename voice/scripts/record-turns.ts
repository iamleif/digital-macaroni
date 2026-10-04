/**
 * Records the agent's raw audio (24 kHz PCM16) per turn in a short scripted conversation, to check
 * that the voice stays consistent after the caller speaks. Writes turn-N.pcm files to the given dir.
 *   GEMINI_API_KEY=… npx tsx scripts/record-turns.ts northline /tmp/out [phone|browser]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDemoId } from "../src/demos/index.js";
import { openLive } from "../src/live.js";
import { admit } from "../src/session.js";

const [arg = "northline", out = "/tmp/turns", channel = "phone"] = process.argv.slice(2);
if (!isDemoId(arg)) throw new Error("demo");
mkdirSync(out, { recursive: true });
const lines = (process.env.LINES ?? "Hi, my furnace stopped working. Can someone come and look at it tomorrow?|It's Alex Taylor, at 48 Birch Lane.|The earliest one is fine.").split("|");
function pcm16k(text: string, i: number): Buffer {
  const aiff = join(out, `c${i}.aiff`), wav = join(out, `c${i}.wav`);
  execFileSync("say", ["-v", process.env.CALLER_VOICE ?? "Samantha", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiff, wav]);
  const f = readFileSync(wav); const at = f.indexOf("data");
  return f.subarray(at + 8, at + 8 + f.readUInt32LE(at + 4));
}
const a = admit(arg, channel === "browser" ? "browser" : "phone");
if (!a.ok) throw new Error(a.reason);
const live = await openLive(a.session);
const turns: Buffer[][] = [[]];
let turnDone: () => void = () => {};
void (async () => {
  for await (const e of live.events) {
    if (e.type === "audio") turns[turns.length - 1]!.push(Buffer.from(e.data, "base64"));
    if (e.type === "transcript" && e.finished && process.env.SHOW_TEXT) console.log(e.speaker === "agent" ? "AGENT:" : "CALLER:", e.text);
    if (e.type === "turn_complete" && turns[turns.length - 1]!.length) { turns.push([]); turnDone(); }
  }
})();
const waitTurn = () => new Promise<void>((r) => { turnDone = r; setTimeout(r, 25_000); });
const silence = Buffer.alloc(640);
let stop = false;
void (async () => { while (!stop) { live.sendAudio(silence.toString("base64")); await new Promise((r) => setTimeout(r, 20)); } })();
live.sendText("[The call has just connected. Greet the caller now.]");
await waitTurn();
for (const [i, line] of lines.entries()) {
  const pcm = pcm16k(line, i);
  stop = true; await new Promise((r) => setTimeout(r, 30));
  for (let o = 0; o < pcm.length; o += 640) { live.sendAudio(pcm.subarray(o, o + 640).toString("base64")); await new Promise((r) => setTimeout(r, 20)); }
  stop = false; void (async () => { while (!stop) { live.sendAudio(silence.toString("base64")); await new Promise((r) => setTimeout(r, 20)); } })();
  await waitTurn();
}
stop = true;
turns.filter((t) => t.length).forEach((t, i) => writeFileSync(join(out, `turn-${i}.pcm`), Buffer.concat(t)));
console.log("turns recorded:", turns.filter((t) => t.length).length);
live.close();
process.exit(0);
