/**
 * The missed call math, shared by the calculator and the page that explains it:
 * missed calls × the share who would have booked × the average job value.
 * Deliberately conservative: no repeat business, no lifetime value, no referrals.
 */

export type Trade = { id: string; label: string; ticket: number };

/** Typical value of one booked job, US, from the sources on the page. "Other" keeps whatever is typed. */
export const TRADES: Trade[] = [
  { id: "hvac", label: "HVAC", ticket: 350 },
  { id: "plumbing", label: "Plumbing", ticket: 341 },
  { id: "electrical", label: "Electrical", ticket: 351 },
  { id: "roofing", label: "Roofing", ticket: 1174 },
  { id: "garage", label: "Garage doors", ticket: 265 },
  { id: "pest", label: "Pest control", ticket: 172 },
  { id: "auto", label: "Auto repair", ticket: 500 },
  { id: "other", label: "Something else", ticket: 0 },
];

export const BOOKING_RATES = [
  { rate: 0.2, label: "1 in 5" },
  { rate: 0.25, label: "1 in 4" },
  { rate: 1 / 3, label: "1 in 3" },
  { rate: 0.5, label: "1 in 2" },
];

export const DEFAULT_MISSED = 20;
export const DEFAULT_RATE = 0.25;

/** Answering cost: an average call length and an all-in AI phone agent rate (phone line, speech and model). */
export const AI_MINUTES_PER_CALL = 3;
export const AI_RATE_PER_MINUTE = 0.15;

/** Our entry running plan, as on the pricing section. */
export const HOSTED_PLAN = { price: 149, minutes: 500 };

export function lostRevenue({ missed, ticket, rate }: { missed: number; ticket: number; rate: number }) {
  const jobs = Math.round(missed * rate * 10) / 10;
  return { jobs, monthly: missed * rate * ticket };
}
