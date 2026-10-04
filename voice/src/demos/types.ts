import { z } from "zod";
import type { Channel, DemoId } from "../protocol.js";

/**
 * A demo business: its fixtures, its agent's instructions, and the operations the agent may ask
 * for. Operations are plain functions over one session's state, so they run and are tested without
 * a model. The agent only ever hears what an operation actually returned.
 */
export interface OpContext {
  now: Date;
  channel: Channel;
}

export type OpResult =
  | { ok: true; result: Record<string, unknown>; summary: string; changed: boolean }
  | { ok: false; error: string; message: string; result?: Record<string, unknown> };

export interface Operation<S> {
  /** What the conversation panel shows while it runs, e.g. "Checking availability". */
  label: string;
  description: string;
  parameters?: z.ZodObject;
  run(state: S, input: never, ctx: OpContext): OpResult;
}

export interface DemoDefinition<S> {
  id: DemoId;
  businessName: string;
  agentName: string;
  createState(now: Date): S;
  instruction(state: S, ctx: OpContext): string;
  operations: Record<string, Operation<S>>;
  /** The records the dashboard shows. Never includes anything the visitor should not see. */
  view(state: S): unknown;
}

/**
 * Writes take this flag. The tool layer refuses the call unless it is true, so the model has to make
 * a deliberate, visible confirmation step before anything is booked, reserved or cancelled.
 */
export const Confirmed = z.boolean().describe("True only after you read the details back and the caller clearly said yes.");

export const ok = (summary: string, result: Record<string, unknown>, changed = false): OpResult => ({ ok: true, summary, result, changed });
export const fail = (error: string, message: string, result?: Record<string, unknown>): OpResult => ({ ok: false, error, message, ...(result ? { result } : {}) });

/** A phone number for display: only its last four digits. */
export function maskNumber(n: string): string {
  const digits = n.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••";
}

/** Calendar dates as YYYY-MM-DD in the business's time zone. */
export function dateIn(timeZone: string, at: Date): { date: string; hour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** A short reference the agent can read out: letters that are hard to mishear, then digits. */
export function reference(prefix: string, seq: number, seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${prefix}-${String(((h + seq * 7919) % 900) + 100)}`;
}
