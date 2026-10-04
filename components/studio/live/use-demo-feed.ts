"use client";

import { useCallback, useReducer } from "react";
import type { DemoEvent, DemoView } from "./types";

/**
 * Folds the service's events into what the demo window shows: the conversation (each utterance
 * once, replaced as its text firms up; each action once, updated when it finishes), the business's
 * latest records, and whether the agent is speaking.
 */
export type Entry =
  | { kind: "say"; id: string; speaker: "visitor" | "agent"; text: string; final: boolean }
  | { kind: "action"; id: string; tool: string; label: string; status: "running" | "done" | "failed"; summary?: string; at: number; doneAt?: number };

/** What happened behind the conversation, in order, for the "under the hood" log. */
export type LogItem =
  | { kind: "event"; id: string; at: number; text: string }
  | { kind: "action"; id: string };

export interface Feed {
  entries: Entry[];
  log: LogItem[];
  view: DemoView | null;
  version: number;
  speaking: boolean;
  ended: string | null;
}

const empty: Feed = { entries: [], log: [], view: null, version: -1, speaking: false, ended: null };
let seq = 0;
// A snapshot replays session.ready, so each lifecycle note is recorded once.
const note = (feed: Feed, text: string): Feed =>
  feed.log.some((i) => i.kind === "event" && i.text === text) ? feed : { ...feed, log: [...feed.log, { kind: "event", id: `e${++seq}`, at: Date.now(), text }] };

function reduce(feed: Feed, e: DemoEvent | { type: "reset" }): Feed {
  switch (e.type) {
    case "reset":
      return empty;
    case "transcript": {
      const at = feed.entries.findIndex((x) => x.kind === "say" && x.id === e.id);
      const entry: Entry = { kind: "say", id: e.id, speaker: e.speaker, text: e.text, final: e.final };
      if (at === -1) return { ...feed, entries: [...feed.entries, entry] };
      const entries = feed.entries.slice();
      entries[at] = entry;
      return { ...feed, entries };
    }
    case "tool.started":
      if (feed.entries.some((x) => x.kind === "action" && x.id === e.callId)) return feed;
      return { ...feed, entries: [...feed.entries, { kind: "action", id: e.callId, tool: e.tool, label: e.label, status: "running", at: Date.now() }], log: [...feed.log, { kind: "action", id: e.callId }] };
    case "tool.succeeded":
    case "tool.failed": {
      const status = e.type === "tool.succeeded" ? "done" : "failed";
      const at = feed.entries.findIndex((x) => x.kind === "action" && x.id === e.callId);
      const now = Date.now();
      const prev = at === -1 ? undefined : feed.entries[at];
      const entry: Entry = { kind: "action", id: e.callId, tool: e.tool, label: e.label, status, summary: e.summary, at: prev?.kind === "action" ? prev.at : now, doneAt: now };
      if (at === -1) return { ...feed, entries: [...feed.entries, entry], log: [...feed.log, { kind: "action", id: e.callId }] };
      const entries = feed.entries.slice();
      entries[at] = entry;
      return { ...feed, entries };
    }
    case "state":
      return e.version >= feed.version ? { ...feed, view: e.state, version: e.version } : feed;
    case "agent.speaking":
      return { ...feed, speaking: e.speaking };
    case "session.ready":
      return note(feed, e.channel === "phone" ? "Phone call connected" : "Conversation started in the browser");
    case "pairing.linked":
      return note(feed, "Your phone call is linked to this screen");
    case "session.ended":
      return note({ ...feed, speaking: false, ended: e.reason }, e.reason === "agent_ended" ? "The agent ended the call after saying goodbye" : e.reason === "time_limit" ? "Demo time limit reached" : "Conversation ended");
    default:
      return feed;
  }
}

export function useDemoFeed() {
  const [feed, dispatch] = useReducer(reduce, empty);
  const push = useCallback((e: DemoEvent) => dispatch(e), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return { feed, push, reset };
}
