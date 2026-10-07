/**
 * The missed call math, shared by the calculator and the page that explains it:
 * missed calls × the share who would have booked × the average job value.
 * Deliberately conservative: no repeat business, no lifetime value, no referrals.
 */

export type Group = "home" | "auto" | "professional" | "health" | "beauty" | "other";
/** `value` and `hint` override the group's wording where a business counts value differently. */
export type Trade = { id: string; label: string; group: Group; ticket: number; value?: string; hint?: string };

/** How each group talks about what one booking is worth. */
export const GROUPS: Record<Group, { label: string; value: string; hint: string }> = {
  home: { label: "Home services", value: "Average job value", hint: "What a typical booked job is worth to you." },
  auto: { label: "Auto", value: "Average repair order", hint: "What a typical repair order is worth to you." },
  professional: { label: "Professional services", value: "Average value of a new client", hint: "What a typical new client or matter brings in." },
  health: { label: "Health and wellness", value: "Average appointment value", hint: "What a typical booked appointment is worth to you." },
  beauty: { label: "Beauty", value: "Average appointment value", hint: "What a typical booked appointment is worth to you." },
  other: { label: "Other", value: "Average value of a booking", hint: "What a typical booking or new customer is worth to you." },
};

/** Typical value of one booking, US, from the sources on the page. "Something else" keeps whatever is typed. */
export const TRADES: Trade[] = [
  { id: "hvac", label: "HVAC", group: "home", ticket: 350 },
  { id: "plumbing", label: "Plumbing", group: "home", ticket: 341 },
  { id: "electrical", label: "Electrical", group: "home", ticket: 351 },
  { id: "roofing", label: "Roofing", group: "home", ticket: 1174 },
  { id: "garage", label: "Garage doors", group: "home", ticket: 265 },
  { id: "pest", label: "Pest control", group: "home", ticket: 172 },
  { id: "cleaning", label: "House cleaning", group: "home", ticket: 150, value: "Average cleaning value", hint: "What one cleaning visit is worth to you." },
  { id: "lawn", label: "Lawn care and landscaping", group: "home", ticket: 123, value: "Average visit value", hint: "What one visit is worth to you." },
  { id: "auto", label: "Auto repair", group: "auto", ticket: 500 },
  { id: "law", label: "Law firm", group: "professional", ticket: 3000, value: "Average case value", hint: "What a typical new matter brings in. Ours is roughly nine hours at the average lawyer's rate." },
  { id: "accounting", label: "Accounting and tax", group: "professional", ticket: 250, value: "Average value of a new client", hint: "What a new client brings in. Ours is one individual tax return." },
  { id: "insurance", label: "Insurance agency", group: "professional", ticket: 150, value: "Commission on a new policy", hint: "What a new policy earns you in its first year. Renewals add more." },
  { id: "dental", label: "Dental", group: "health", ticket: 450, value: "Value of a new patient's first visit", hint: "A new-patient exam, cleaning and X-rays. Most patients come back." },
  { id: "chiro", label: "Chiropractic", group: "health", ticket: 80 },
  { id: "pt", label: "Physical therapy", group: "health", ticket: 150, value: "Value of a first evaluation", hint: "What a new patient's first visit is worth. Most book follow-ups." },
  { id: "vet", label: "Veterinary", group: "health", ticket: 200 },
  { id: "medspa", label: "Med spa", group: "beauty", ticket: 435, value: "Average treatment value", hint: "What a typical treatment is worth to you." },
  { id: "salon", label: "Hair salon", group: "beauty", ticket: 95 },
  { id: "massage", label: "Massage and spa", group: "beauty", ticket: 110 },
  { id: "other", label: "Something else", group: "other", ticket: 0 },
];

export const BOOKING_RATES = [
  { rate: 0.2, label: "1 in 5" },
  { rate: 0.25, label: "1 in 4" },
  { rate: 1 / 3, label: "1 in 3" },
  { rate: 0.5, label: "1 in 2" },
];

export const DEFAULT_MISSED = 20;
/** Before a business is picked: a neutral example value, the same as the page's worked example. */
export const STARTING_VALUE = 350;
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
