import type { DemoEvent } from "./types";

/**
 * The agent's voice for the waveform. The service sends bar heights ahead of time, each batch saying
 * when the caller will hear it; this holds them until then. Phone audio reaches the caller a little
 * after the service sends it, so frames are held a further PHONE_DELAY_MS (`?wavedelay=` overrides it
 * while tuning by ear on a real call).
 */
const PHONE_DELAY_MS = 180;

export class VoiceLevels {
  bands = 12;
  /** Real levels have arrived this call: gaps between words should then stay flat, not be filled in. */
  received = false;
  private frames: { at: number; v: Uint8Array }[] = [];
  private frameMs = 40;
  private delay = PHONE_DELAY_MS;

  constructor() {
    if (typeof window === "undefined") return;
    const d = Number(new URLSearchParams(window.location.search).get("wavedelay"));
    if (Number.isFinite(d) && d > 0) this.delay = d;
  }

  /** Takes the waveform's events; true when the event is for the waveform only. */
  take(e: DemoEvent): boolean {
    if (e.type === "agent.levels") {
      const bytes = Uint8Array.from(atob(e.levels), (c) => c.charCodeAt(0));
      const start = performance.now() + e.in + this.delay;
      this.bands = e.bands;
      this.frameMs = e.frameMs;
      this.received = true;
      for (let i = 0; i * e.bands < bytes.length; i++) this.frames.push({ at: start + i * e.frameMs, v: bytes.subarray(i * e.bands, (i + 1) * e.bands) });
      return true;
    }
    // The caller talked over the agent: what was queued will never be heard.
    if (e.type === "audio.interrupted") this.frames = [];
    return false;
  }

  clear() {
    this.frames = [];
    this.received = false;
  }

  /** Fills `out` (0..1 per band) for time `t` (performance.now()); false when nothing is playing. */
  sample(t: number, out: Float32Array): boolean {
    while (this.frames.length > 1 && this.frames[1]!.at <= t) this.frames.shift();
    const a = this.frames[0];
    if (!a || a.at > t || t - a.at > this.frameMs * 1.5) {
      if (a && t - a.at > this.frameMs * 1.5) this.frames.shift();
      return false;
    }
    const b = this.frames[1];
    const f = b && b.at - a.at <= this.frameMs * 1.5 ? (t - a.at) / (b.at - a.at) : 0;
    for (let i = 0; i < out.length; i++) out[i] = ((a.v[i] ?? 0) * (1 - f) + (b && f ? b.v[i] ?? 0 : 0) * f) / 255;
    return true;
  }
}
