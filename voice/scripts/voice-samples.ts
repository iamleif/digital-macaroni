/**
 * Records every prebuilt voice saying the same short line on the live model, in full quality
 * (24 kHz) and as callers hear it on the phone (8 kHz, through the same encoder as live calls).
 * Writes WAV files to the output directory. Needs GEMINI_API_KEY.
 *   npx tsx scripts/voice-samples.ts /tmp/voices
 */
import { GoogleGenAI, Modality } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPhoneEncoder, muLawToLinear } from "../src/audio.js";

export const VOICES: Record<string, string> = {
  Zephyr: "bright", Puck: "upbeat", Charon: "informative", Kore: "firm", Fenrir: "excitable", Leda: "youthful",
  Orus: "firm", Aoede: "breezy", Callirrhoe: "easy-going", Autonoe: "bright", Enceladus: "breathy", Iapetus: "clear",
  Umbriel: "easy-going", Algieba: "smooth", Despina: "smooth", Erinome: "clear", Algenib: "gravelly", Rasalgethi: "informative",
  Laomedeia: "upbeat", Achernar: "soft", Alnilam: "firm", Schedar: "even", Gacrux: "mature", Pulcherrima: "forward",
  Achird: "friendly", Zubenelgenubi: "casual", Vindemiatrix: "gentle", Sadachbia: "lively", Sadaltager: "knowledgeable", Sulafat: "warm",
};
const LINE = "Thanks for calling Northline, how can I help? ... Sure, I can check that for you. I've got a two-to-four window open tomorrow afternoon. Would that work?";

const out = process.argv[2] ?? "/tmp/voices";
mkdirSync(out, { recursive: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function wav(samples: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + samples.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}

async function record(voice: string): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    let session: { close(): void } | undefined;
    const done = (ok: boolean) => { session?.close(); resolve(ok && chunks.length ? Buffer.concat(chunks) : null); };
    const timer = setTimeout(() => done(true), 20_000);
    ai.live.connect({
      model: process.env.DEMO_LIVE_MODEL ?? "gemini-3.8-live",
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, systemInstruction: "You are a receptionist reading a line aloud on a phone call. Say exactly the text you are given, naturally, with a short pause where it shows '...'. Say nothing else." },
      callbacks: {
        onmessage: (m) => {
          for (const p of m.serverContent?.modelTurn?.parts ?? []) if (p.inlineData?.data) chunks.push(Buffer.from(p.inlineData.data, "base64"));
          if (m.serverContent?.turnComplete) { clearTimeout(timer); done(true); }
        },
        onerror: () => { clearTimeout(timer); done(false); },
        onclose: () => undefined,
      },
    }).then((s) => {
      session = s;
      s.sendClientContent({ turns: [{ role: "user", parts: [{ text: LINE }] }], turnComplete: true });
    }).catch(() => { clearTimeout(timer); done(false); });
  });
}

const names = Object.keys(VOICES);
for (let i = 0; i < names.length; i += 5) {
  await Promise.all(names.slice(i, i + 5).map(async (voice) => {
    const pcm = await record(voice);
    if (!pcm) return console.log(voice.padEnd(14), "no audio");
    writeFileSync(join(out, `${voice}.wav`), wav(pcm, 24000));
    // Through the live calls' phone encoder, then back to linear PCM for listening.
    const mu = Buffer.from(createPhoneEncoder().encode(pcm.toString("base64")), "base64");
    const phone = Buffer.alloc(mu.length * 2);
    for (let k = 0; k < mu.length; k++) phone.writeInt16LE(muLawToLinear(mu[k]!), k * 2);
    writeFileSync(join(out, `${voice}-phone.wav`), wav(phone, 8000));
    console.log(voice.padEnd(14), `${(pcm.length / 48000).toFixed(1)} s`);
  }));
}
process.exit(0);
