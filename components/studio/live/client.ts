import type { DemoEvent, DemoId } from "./types";

/**
 * Browser side of the demo voice service. TalkSession: microphone in (16-bit PCM, 16 kHz) and the
 * agent's voice out (16-bit PCM, 24 kHz) over one WebSocket that also carries the session's events.
 * CallWatcher: a code the visitor types during a phone call, then that call's events.
 * Nothing here holds credentials; the service issues a per-session token.
 */
export const VOICE_URL = (process.env.NEXT_PUBLIC_DEMO_VOICE_URL ?? "https://studio-demo-voice-361680400699.us-central1.run.app").replace(/\/$/, "");

// Runs on the audio thread: downsamples the microphone to 16 kHz and posts 20 ms Int16 frames.
const CAPTURE_WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.pos = 0; this.out = new Int16Array(320); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos), f = this.pos - i;
      const a = ch[i], b = i + 1 < ch.length ? ch[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.out.length) { this.port.postMessage(this.out.buffer, [this.out.buffer]); this.out = new Int16Array(320); this.n = 0; }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor("demo-capture", Capture);
`;

export type TalkStatus = "idle" | "requesting-mic" | "connecting" | "live" | "ending" | "ended" | "error";

export class TalkSession {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private playCtx: AudioContext | null = null;
  private player: HTMLAudioElement | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private closed = false;

  constructor(
    private demo: DemoId,
    private onEvent: (e: DemoEvent) => void,
    private onStatus: (s: TalkStatus, message?: string) => void,
  ) {}

  /** Call from the Talk button's click handler: microphone permission and audio playback need it. */
  async start() {
    this.onStatus("requesting-mic");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      this.fail(denied ? "Microphone access is blocked. Allow it in your browser, or call the demo number instead." : "We couldn’t find a microphone. You can call the demo number instead.");
      return;
    }
    if (this.closed) return this.release();
    this.onStatus("connecting");

    // Playback goes through an <audio> element so the browser's echo cancellation can hear it.
    this.playCtx = new AudioContext({ sampleRate: 24000 });
    const out = this.playCtx.createMediaStreamDestination();
    this.player = new Audio();
    this.player.srcObject = out.stream;
    void this.player.play().catch(() => undefined);
    this.playDestination = out;

    let session: { sessionId: string; token: string };
    try {
      const r = await fetch(`${VOICE_URL}/browser/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ demo: this.demo }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return this.fail(body.message ?? "The demo couldn’t start. Please try again, or call the demo number.");
      session = body;
    } catch {
      return this.fail("We couldn’t reach the demo. Check your connection, or call the demo number.");
    }
    if (this.closed) return this.release();

    const socket = new WebSocket(`${VOICE_URL.replace(/^http/, "ws")}/browser/sessions/${session.sessionId}?token=${encodeURIComponent(session.token)}`);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onmessage = (m) => {
      if (m.data instanceof ArrayBuffer) return this.play(m.data);
      const e = JSON.parse(m.data as string) as DemoEvent;
      if (e.type === "audio.interrupted") this.stopPlayback();
      if (e.type === "session.ready") this.onStatus("live");
      if (e.type === "session.error") this.onStatus("error", e.message);
      if (e.type === "session.ended") this.finishAfterPlayback();
      this.onEvent(e);
    };
    socket.onclose = () => {
      if (!this.closed) this.finishAfterPlayback();
    };
    socket.onopen = () => void this.startCapture(socket);
  }

  private playDestination: MediaStreamAudioDestinationNode | null = null;

  private async startCapture(socket: WebSocket) {
    if (!this.stream) return;
    this.captureCtx = new AudioContext();
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "text/javascript" }));
    await this.captureCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const source = this.captureCtx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(this.captureCtx, "demo-capture");
    node.port.onmessage = (m) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(m.data as ArrayBuffer);
    };
    source.connect(node);
  }

  private play(data: ArrayBuffer) {
    if (!this.playCtx || !this.playDestination) return;
    const pcm = new Int16Array(data);
    const buffer = this.playCtx.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i]! / 0x8000;
    const src = this.playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.playDestination);
    const now = this.playCtx.currentTime;
    // A small lead absorbs network jitter without adding noticeable delay.
    this.nextStart = Math.max(this.nextStart, now + 0.04);
    src.start(this.nextStart);
    this.nextStart += buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** The visitor started talking over the agent: stop what is queued at once. */
  private stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
    this.nextStart = 0;
  }

  /** Stop listening now; let the agent's last words finish playing, then release everything. */
  private finishAfterPlayback() {
    if (this.closed) return;
    this.closed = true;
    this.onStatus("ending");
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.captureCtx?.close();
    const remaining = this.playCtx ? Math.max(0, this.nextStart - this.playCtx.currentTime) : 0;
    setTimeout(() => {
      this.release();
      this.onStatus("ended");
    }, Math.min(remaining, 8) * 1000 + 150);
  }

  /** The visitor pressed End. */
  end() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "end" }));
    this.stopPlayback();
    this.closed = true;
    this.release();
    this.onStatus("ended");
  }

  private fail(message: string) {
    this.closed = true;
    this.release();
    this.onStatus("error", message);
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.stopPlayback();
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();
    this.socket = null;
    void this.captureCtx?.close().catch(() => undefined);
    void this.playCtx?.close().catch(() => undefined);
    this.captureCtx = this.playCtx = null;
    if (this.player) this.player.srcObject = null;
    this.player = null;
  }
}

export type WatchStatus = "requesting" | "waiting" | "linked" | "expired" | "ended" | "error";

/** Shows a phone call on this page once the caller types the code shown here. */
export class CallWatcher {
  private socket: WebSocket | null = null;
  private stopped = false;

  constructor(
    private demo: DemoId,
    private onEvent: (e: DemoEvent) => void,
    private onStatus: (s: WatchStatus, code?: string) => void,
  ) {}

  async start() {
    this.onStatus("requesting");
    try {
      const r = await fetch(`${VOICE_URL}/pairings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ demo: this.demo }) });
      if (!r.ok) throw new Error(String(r.status));
      const { viewerToken } = (await r.json()) as { viewerToken: string };
      if (this.stopped) return;
      const socket = new WebSocket(`${VOICE_URL.replace(/^http/, "ws")}/pairings/${viewerToken}`);
      this.socket = socket;
      socket.onmessage = (m) => {
        const e = JSON.parse(m.data as string) as DemoEvent;
        if (e.type === "pairing.waiting") this.onStatus("waiting", e.code);
        else if (e.type === "pairing.linked") this.onStatus("linked");
        else if (e.type === "pairing.expired") this.onStatus("expired");
        else if (e.type === "session.ended") this.onStatus("ended");
        this.onEvent(e);
      };
      socket.onclose = () => {
        if (!this.stopped) this.onStatus("ended");
      };
    } catch {
      this.onStatus("error");
    }
  }

  stop() {
    this.stopped = true;
    this.socket?.close();
    this.socket = null;
  }
}
