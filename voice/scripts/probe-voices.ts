/**
 * Checks which prebuilt voices the configured live model answers with: opens a session per voice,
 * asks for a greeting, and reports time to first audio. Needs GEMINI_API_KEY.
 *
 *   GEMINI_API_KEY=… npx tsx scripts/probe-voices.ts Sulafat Iapetus Puck
 */
import { GoogleGenAI, Modality } from "@google/genai";

const model = process.env.DEMO_LIVE_MODEL ?? "gemini-3.8-live";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function probe(voice: string): Promise<string> {
  const started = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: string, s?: { close(): void }) => {
      if (done) return;
      done = true;
      s?.close();
      resolve(r);
    };
    ai.live
      .connect({
        model,
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
        callbacks: {
          onopen: () => undefined,
          onmessage: (m) => {
            if (m.serverContent?.modelTurn?.parts?.some((p) => p.inlineData?.data)) finish(`audio after ${Date.now() - started} ms`, session);
          },
          onerror: (e) => finish(`error: ${e.message}`),
          onclose: (e) => finish(`closed ${e.code} ${e.reason?.slice(0, 160)}`),
        },
      })
      .then((s) => {
        session = s;
        s.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Say hello in one short sentence." }] }], turnComplete: true });
      })
      .catch((e: Error) => finish(`connect failed: ${e.message.slice(0, 160)}`));
    let session: { close(): void } | undefined;
    setTimeout(() => finish("no audio within 15 s", session), 15_000);
  });
}

for (const voice of process.argv.slice(2)) console.log(voice.padEnd(14), await probe(voice));
process.exit(0);
