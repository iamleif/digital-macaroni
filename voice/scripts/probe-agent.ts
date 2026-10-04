/**
 * Opens one demo agent's live session and reports whether it greets. Set DEMO_DEBUG_ADK=1 to see
 * ADK's own logs. Needs GEMINI_API_KEY.   npx tsx scripts/probe-agent.ts formfield
 */
import { isDemoId } from "../src/demos/index.js";
import { openLive } from "../src/live.js";
import { admit } from "../src/session.js";

const demo = process.argv[2] ?? "northline";
if (!isDemoId(demo)) throw new Error("demo must be northline or formfield");
const a = admit(demo, "browser");
if (!a.ok) throw new Error(a.reason);
const started = Date.now();
const live = await openLive(a.session);
live.sendText("[The call has just connected. Greet the caller now.]");
setTimeout(() => {
  console.log("RESULT no audio within 15 s");
  process.exit(1);
}, 15_000);
for await (const e of live.events) {
  if (e.type === "audio") {
    console.log(`RESULT audio after ${Date.now() - started} ms`);
    process.exit(0);
  }
}
console.log("RESULT stream ended without audio");
process.exit(1);
