import { describe, expect, it } from "vitest";
import { createPhoneEncoder, geminiToTwilio, muLawToLinear, voiceStats } from "../src/audio.js";

const tone = (hz: number, seconds: number, rate = 24000, amp = 12000) => {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(amp * Math.sin((2 * Math.PI * hz * i) / rate)), i * 2);
  return b;
};
const rmsOfMuLaw = (b64: string) => {
  const mu = Buffer.from(b64, "base64").subarray(200); // skip the filter's start-up
  let e = 0;
  for (const byte of mu) e += muLawToLinear(byte) ** 2;
  return Math.sqrt(e / mu.length);
};

describe("phone encoder", () => {
  it("keeps speech-band audio and removes what would alias into buzz", () => {
    const voice = rmsOfMuLaw(createPhoneEncoder().encode(tone(1000, 0.5).toString("base64")));
    const high = rmsOfMuLaw(createPhoneEncoder().encode(tone(6000, 0.5).toString("base64")));
    const highOld = rmsOfMuLaw(geminiToTwilio(tone(6000, 0.5).toString("base64")));
    expect(voice).toBeGreaterThan(7000);
    expect(high).toBeLessThan(voice * 0.05);
    // The old per-chunk resampler let it through as a 2 kHz alias.
    expect(highOld).toBeGreaterThan(voice * 0.5);
  });

  it("gives identical output however the audio is chunked", () => {
    const audio = tone(440, 0.3);
    const whole = Buffer.from(createPhoneEncoder().encode(audio.toString("base64")), "base64");
    const enc = createPhoneEncoder();
    const parts: Buffer[] = [];
    for (let o = 0; o < audio.length; o += 2 * 997) parts.push(Buffer.from(enc.encode(audio.subarray(o, o + 2 * 997).toString("base64")), "base64"));
    expect(Buffer.concat(parts).equals(whole)).toBe(true);
  });
});

describe("voice stats", () => {
  it("measures pitch and loudness", () => {
    const s = voiceStats(tone(220, 1));
    expect(Math.abs(s.pitchHz - 220)).toBeLessThan(8);
    expect(s.loudnessDb).toBeGreaterThan(-12);
    expect(s.seconds).toBe(1);
  });
});
