import { voiceDemos } from "../live/demo-info";
import type { AppointmentView, BrandId, DemoId, DemoView, FormFieldView, HotelsView, LawFirmView, NorthlineView, TravelView } from "../live/types";
import { SKINS } from "../demo/funnel";

/** One call's page, as GET {VOICE_URL}/reports/{token} returns it. */
export type ReportEntry =
  | { kind: "say"; t: number; speaker: string; text: string }
  | { kind: "step"; t: number; tool: string; label: string; summary: string; ok: boolean; ms: number | null };

export interface CallReport {
  demo: DemoId;
  business: string | null;
  agent: string | null;
  channel: "phone" | "browser";
  callerNumber: string | null;
  startedAt: string;
  durationMs: number;
  status: "live" | "complete";
  recording: { url: string; offsetMs: number } | null;
  recordingPending: boolean;
  setup: { trade?: string; tool?: string; record?: boolean } | null;
  entries: ReportEntry[];
  view: DemoView | null;
}

export type Step = Extract<ReportEntry, { kind: "step" }>;
export type Line = Extract<ReportEntry, { kind: "say" }>;

/** Which business the call was with: Ellie's salon and clinic front desks have their own brand. */
export function businessOf(r: CallReport): { brand: BrandId; name: string; agent: string; appointment: boolean } {
  const demo = voiceDemos[r.demo];
  const agent = r.agent ?? demo?.agentName ?? "The agent";
  const skin = r.view && "skin" in r.view ? r.view.skin : null;
  if (r.demo === "northline" && skin) return { brand: SKINS[skin].brand, name: SKINS[skin].name, agent, appointment: true };
  return { brand: r.demo, name: r.business ?? demo?.name ?? "the business", agent, appointment: false };
}

/** Booking demos stop on purpose at payment: the end of the flow, not a failure. */
export const isTestStop = (s: Step) => !s.ok && /test mode/i.test(s.summary);

/** A failure's first sentence only: the rest is guidance for the agent. */
export const stepOutcome = (s: Step) => (s.ok ? s.summary || s.label : (s.summary || s.label).split(/(?<=[.!?])\s/)[0]);

/** "1:07" from milliseconds. */
export function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "4 min 12 s", "52 s". */
export function spoken(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
}

export const took = (ms: number) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);

/** What the call achieved, in an owner's words: the main result first. */
export type Outcome = { title: string; detail?: string };

const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

function fromView(demo: DemoId, v: DemoView): Outcome[] {
  const main: Outcome[] = [];
  const after: Outcome[] = [];
  const emailed = "emailed" in v && v.emailed ? v.emailed : null;

  if ("skin" in v) {
    const a = v as AppointmentView;
    for (const x of a.appointments) main.push(x.status === "booked" ? { title: "Booked an appointment", detail: join(x.service, x.when, `with ${x.staff}`) } : { title: "Cancelled an appointment", detail: join(x.service, x.when) });
    for (const m of a.messages) after.push({ title: "Took a message for the team", detail: m.summary });
  } else if (demo === "northline") {
    const n = v as NorthlineView;
    for (const x of n.appointments) main.push(x.status === "booked"
      ? { title: x.changes ? "Booked a visit, then moved it" : "Booked a visit", detail: join(x.service, `${x.day}, ${x.window}`, `with ${x.technician}`) }
      : { title: "Cancelled a visit", detail: join(x.service, `${x.day}, ${x.window}`) });
    for (const m of n.messages) after.push({ title: "Took a message for the team", detail: join(m.summary, m.preferredTime && `call back ${m.preferredTime}`) });
  } else if (demo === "formfield") {
    const f = v as FormFieldView;
    for (const x of f.reservations) main.push(x.status === "reserved"
      ? { title: x.quantity > 1 ? `Reserved ${x.quantity} × ${x.product}` : `Reserved the ${x.product}`, detail: join(x.option, `held until ${x.pickupBy}`) }
      : { title: `Cancelled the ${x.product} reservation` });
    for (const s of f.supportRequests) main.push({ title: "Opened a support request", detail: join(`Order ${s.orderNumber}`, s.issue) });
    if (f.order && !f.supportRequests.length) after.push({ title: `Looked up order ${f.order.number}`, detail: f.order.status });
    for (const m of f.messages) after.push({ title: "Took a message for the team", detail: m.summary });
  } else if (demo === "travel") {
    const t = v as TravelView;
    if (t.booking) main.push({ title: "Took the flight booking up to payment", detail: t.review ? join(t.review.airline, t.review.outbound, t.review.return, t.review.total) : join(t.booking.travellerName, t.booking.price) });
    else if (t.review) main.push({ title: "Priced the trip and read it back", detail: join(t.review.airline, t.review.outbound, t.review.total) });
    else if (t.options.length) main.push({ title: "Searched live fares", detail: join(t.search?.label, `${t.options.length} options read out`) });
    for (const m of t.messages ?? []) after.push({ title: "Took a message for a travel agent", detail: join(m.summary, m.preferredTime && `call back ${m.preferredTime}`) });
  } else if (demo === "hotels") {
    const h = v as HotelsView;
    if (h.review) main.push({ title: h.booking ? "Took the stay up to payment" : "Quoted a stay", detail: join(h.review.hotel, h.review.room, h.review.dates, h.review.total) });
    else if (h.hotel) main.push({ title: "Showed a hotel and its rooms", detail: h.hotel.name });
    else if (h.options.length) main.push({ title: "Searched live hotel rates", detail: join(h.search?.label, `${h.options.length} hotels read out`) });
    for (const m of h.messages) after.push({ title: "Took a message for a travel agent", detail: join(m.summary, m.preferredTime && `call back ${m.preferredTime}`) });
  } else if (demo === "lawfirm") {
    const l = v as LawFirmView;
    for (const c of l.consults) main.push(c.status === "booked"
      ? { title: "Booked a free consultation", detail: join(`${c.day} at ${c.time}`, `with ${c.attorney}`, c.format) }
      : { title: "Cancelled a consultation", detail: `${c.day} at ${c.time}` });
    if (l.assessment?.outcome === "qualified") main.push({ title: "Opened a new case for the firm", detail: join(l.record.title, l.record.number, l.assessment.tier && `Tier ${l.assessment.tier}`) });
    if (l.assessment?.outcome === "declined") main.push({ title: "Explained the firm can’t take the case", detail: l.assessment.reason ?? undefined });
    for (const m of l.messages) after.push({ title: m.urgent ? "Took an urgent message for an attorney" : "Took a message for an attorney", detail: m.summary });
  }

  if (emailed) after.push({ title: "Emailed the caller a copy", detail: join(`To ${emailed.to}`, "reference" in emailed && typeof emailed.reference === "string" && emailed.reference) });
  return [...main, ...after];
}

/** Steps that went through, counted in the agent's own summary lines (demo-info). */
function fromSteps(demo: DemoId, steps: Step[]): Outcome[] {
  const lines = voiceDemos[demo]?.design.outcomes ?? [];
  const done = steps.filter((s) => s.ok || isTestStop(s));
  return lines
    .map((o) => ({ o, n: done.filter((s) => o.tools.includes(s.tool)).length }))
    .filter((x) => x.n > 0)
    .map(({ o, n }) => ({ title: n === 1 ? o.one : o.many.replace("{n}", String(n)) }));
}

export function outcomes(r: CallReport): Outcome[] {
  const steps = r.entries.filter((e): e is Step => e.kind === "step");
  const found = r.view ? fromView(r.demo, r.view) : [];
  return found.length ? found : fromSteps(r.demo, steps);
}
