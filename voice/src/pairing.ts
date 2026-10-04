import { randomBytes, randomInt } from "node:crypto";
import type { DemoId } from "./protocol.js";
import type { DemoSession } from "./session.js";

/**
 * Linking a phone call to a browser that wants to watch it. The page asks for a short code and
 * shows it; the caller types it on the keypad (or reads it to the agent). Only then does that page
 * receive the call's events. Codes are single-use, short-lived, scoped to one demo, and never
 * matched by caller ID. A call gets a few attempts before further codes are ignored.
 */
const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS_PER_CALL = 5;

export interface Pairing {
  code: string;
  viewerToken: string;
  demo: DemoId;
  expiresAt: number;
  session: DemoSession | null;
  /** The viewer's socket hook: called once the call is linked. */
  onLinked?: (session: DemoSession) => void;
}

const byCode = new Map<string, Pairing>();
const byToken = new Map<string, Pairing>();

function sweep() {
  const now = Date.now();
  for (const p of byToken.values()) {
    if (p.expiresAt < now && !p.session) {
      byCode.delete(p.code);
      byToken.delete(p.viewerToken);
    }
  }
}

export function createPairing(demo: DemoId): Pairing {
  sweep();
  let code: string;
  do code = String(randomInt(1000, 10000));
  while (byCode.has(code));
  const p: Pairing = { code, viewerToken: randomBytes(18).toString("base64url"), demo, expiresAt: Date.now() + CODE_TTL_MS, session: null };
  byCode.set(code, p);
  byToken.set(p.viewerToken, p);
  return p;
}

export const pairingForViewer = (token: string | undefined) => (token ? byToken.get(token) : undefined);

export type LinkResult = "linked" | "not_found" | "wrong_demo" | "already_linked";

/** Links a phone session to the pairing with this code. The code stops working once used. */
export function linkCall(code: string, session: DemoSession): LinkResult {
  sweep();
  const p = byCode.get(code);
  if (!p || p.expiresAt < Date.now()) return "not_found";
  if (p.demo !== session.demoId) return "wrong_demo";
  if (p.session) return "already_linked";
  p.session = session;
  byCode.delete(code);
  p.onLinked?.(session);
  return "linked";
}

export function dropPairing(p: Pairing) {
  byCode.delete(p.code);
  byToken.delete(p.viewerToken);
}
