/**
 * Events from a demo session to whoever is watching it: the visitor's own browser, or a browser
 * paired with their phone call. Every dashboard change comes from a `state` event that follows a
 * tool's actual result; `tool.started` is never a success claim.
 */
export type DemoId = "northline" | "formfield";
export type Channel = "phone" | "browser";

export type DemoEvent =
  | { type: "session.ready"; sessionId: string; demo: DemoId; channel: Channel }
  | { type: "session.ended"; reason: EndReason }
  | { type: "session.error"; message: string }
  /** One utterance, replaced in place by id. `final: false` text may still change. */
  | { type: "transcript"; id: string; speaker: "visitor" | "agent"; text: string; final: boolean }
  | { type: "tool.started"; callId: string; tool: string; label: string }
  | { type: "tool.succeeded"; callId: string; tool: string; label: string; summary: string; version: number }
  | { type: "tool.failed"; callId: string; tool: string; label: string; summary: string }
  /** The demo business's current records, as the dashboard should show them. */
  | { type: "state"; version: number; state: unknown }
  /** Browser playback: base64 PCM16 at 24 kHz. Not sent to paired viewers of a phone call. */
  | { type: "audio"; data: string }
  | { type: "audio.interrupted" }
  | { type: "agent.speaking"; speaking: boolean }
  /** Only to a page watching a phone call: waiting for the caller to enter the code, then linked. */
  | { type: "pairing.waiting"; code: string; expiresAt: number }
  | { type: "pairing.linked" }
  | { type: "pairing.expired" };

export type EndReason = "visitor_ended" | "agent_ended" | "time_limit" | "silence" | "disconnected" | "error";
