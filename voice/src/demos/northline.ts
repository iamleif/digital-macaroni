import { z } from "zod";
import { addDays, dateIn, dateLabel, fail, ok, reference, maskNumber, Confirmed, weekday, type DemoDefinition, type OpResult } from "./types.js";

/**
 * Northline Home Services: a fictional heating, cooling and plumbing company. The visitor books a
 * service visit, changes it, cancels it, or leaves a callback request. Availability comes from a
 * small schedule generated relative to the session's own date, so "tomorrow" always means something.
 */
const TIME_ZONE = "America/Chicago";
const WINDOWS = [8, 10, 12, 14, 16] as const;
const DAYS_AHEAD = 7;

type Skill = "heating" | "cooling" | "plumbing";

const TECHNICIANS = [
  { id: "maya", name: "Maya Ortiz", skills: ["heating", "cooling"] as Skill[] },
  { id: "sam", name: "Sam Becker", skills: ["plumbing"] as Skill[] },
  { id: "jordan", name: "Jordan Lee", skills: ["heating", "plumbing", "cooling"] as Skill[] },
];

const SERVICES = [
  { id: "heating_repair", name: "Heating repair", skill: "heating" as Skill, fee: 89, about: "Furnace, boiler or heat pump not heating, strange noises, or the system cycling on and off." },
  { id: "cooling_repair", name: "Cooling repair", skill: "cooling" as Skill, fee: 89, about: "Air conditioning not cooling, leaking, or not turning on." },
  { id: "plumbing_repair", name: "Plumbing repair", skill: "plumbing" as Skill, fee: 79, about: "Leaks, clogged drains, running toilets, low water pressure." },
  { id: "water_heater", name: "Water heater service", skill: "plumbing" as Skill, fee: 79, about: "No hot water, leaking tank, pilot light problems." },
  { id: "heating_tune_up", name: "Heating tune-up", skill: "heating" as Skill, fee: 129, about: "Furnace, boiler or heat pump check and cleaning before winter. Flat price, not a call-out fee." },
  { id: "cooling_tune_up", name: "AC tune-up", skill: "cooling" as Skill, fee: 129, about: "Air conditioner check and cleaning before summer. Flat price, not a call-out fee." },
  // Both HVAC technicians quote new systems, so either skill finds the same people.
  { id: "replacement_estimate", name: "New system estimate", skill: "heating" as Skill, fee: 0, about: "An in-home quote for a new furnace, air conditioner or heat pump. Free." },
];
type ServiceId = (typeof SERVICES)[number]["id"];
const SERVICE_IDS = SERVICES.map((s) => s.id) as [ServiceId, ...ServiceId[]];
/** Booked on request alone; every other service needs what the caller has actually noticed. */
const NO_SYMPTOM_NEEDED: ServiceId[] = ["heating_tune_up", "cooling_tune_up", "replacement_estimate"];

interface Job {
  id: string;
  techId: string;
  date: string;
  hour: number;
  serviceId: ServiceId;
  /** Jobs already on the schedule belong to other (fictional) customers and show no details. */
  existing: boolean;
}

interface Appointment {
  id: string;
  jobId: string;
  slotId: string;
  serviceId: ServiceId;
  name: string;
  address: string;
  issue: string;
  status: "booked" | "cancelled";
  techId: string;
  updatedAt: string;
  history: { at: string; change: "booked" | "moved" | "cancelled"; slotId: string }[];
}

interface Message {
  id: string;
  name: string;
  callbackNumber: string;
  summary: string;
  preferredTime: string | null;
  createdAt: string;
}

export interface NorthlineState {
  seed: string;
  today: string;
  /** Earliest bookable hour today, in the business's time zone. */
  earliestTodayHour: number;
  jobs: Job[];
  request: { serviceId?: ServiceId; name?: string; address?: string; issue?: string; proposedSlotId?: string };
  /** Slots the agent has actually offered; only these can be booked. */
  offered: string[];
  /** The date and slots the dashboard is showing. */
  viewing: { date: string; slots: string[]; skill: Skill } | null;
  appointments: Appointment[];
  messages: Message[];
  seq: number;
}

const slotId = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}`;
const parseSlot = (id: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(id);
  return m ? { date: m[1]!, hour: Number(m[2]) } : null;
};
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? " AM" : " PM"}`;
const windowLabel = (h: number) => `${((h + 11) % 12) + 1}${(h < 12) === (h + 2 < 12) ? "" : h < 12 ? " AM" : " PM"}–${hourLabel(h + 2)}`;
const service = (id: ServiceId) => SERVICES.find((s) => s.id === id)!;
const techName = (id: string) => TECHNICIANS.find((t) => t.id === id)?.name ?? id;

function bookableDays(state: NorthlineState): string[] {
  const days: string[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = addDays(state.today, i);
    if (weekday(d) !== 0) days.push(d); // Closed Sundays.
  }
  return days;
}

function freeTech(state: NorthlineState, date: string, hour: number, skill: Skill, ignoreJobId?: string): string | null {
  for (const t of TECHNICIANS) {
    if (!t.skills.includes(skill)) continue;
    const busy = state.jobs.some((j) => j.techId === t.id && j.date === date && j.hour === hour && j.id !== ignoreJobId);
    if (!busy) return t.id;
  }
  return null;
}

function openSlots(state: NorthlineState, date: string, skill: Skill, ignoreJobId?: string): string[] {
  if (!bookableDays(state).includes(date)) return [];
  return WINDOWS.filter((h) => (date !== state.today || h >= state.earliestTodayHour) && freeTech(state, date, h, skill, ignoreJobId)).map((h) => slotId(date, h));
}

const describeSlot = (id: string) => {
  const s = parseSlot(id)!;
  return { slotId: id, date: s.date, day: dateLabel(s.date), window: windowLabel(s.hour) };
};

function createState(now: Date): NorthlineState {
  const { date: today, hour, minute } = dateIn(TIME_ZONE, now);
  const seed = `${today}:${now.getTime()}`;
  const state: NorthlineState = {
    seed,
    today,
    earliestTodayHour: hour + (minute > 0 ? 3 : 2),
    jobs: [],
    request: {},
    offered: [],
    viewing: null,
    appointments: [],
    messages: [],
    seq: 0,
  };
  // Other customers' jobs: deterministic per day, roughly a third of each technician's windows.
  let n = 0;
  for (const date of bookableDays(state)) {
    WINDOWS.forEach((h, wi) => {
      TECHNICIANS.forEach((t, ti) => {
        const dayIndex = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
        const busy = (dayIndex * 7 + wi * 2 + ti * 5) % 3 === 0 || (dayIndex === 1 && h === 12);
        if (busy) state.jobs.push({ id: `existing-${n++}`, techId: t.id, date, hour: h, serviceId: t.skills.includes("plumbing") && ti === 1 ? "plumbing_repair" : "heating_repair", existing: true });
      });
    });
  }
  return state;
}

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Words that name a trade, a system or a kind of visit without saying what is wrong with it.
 * An issue made only of these ("heating and cooling", "HVAC problem", "furnace repair") is a
 * category, not a symptom; anything left over ("not", "noise", "leaking", "cold") is information.
 */
const UMBRELLA = new Set(
  "a an and or the my our some kind of sort type with for to in on it its it's is i we need needs want wants probably maybe possibly just something thing stuff general not_sure unsure help hvac heating heat cooling cool air ac a/c conditioning conditioner system unit furnace boiler pump thermostat plumbing problem problems issue issues trouble service repair repairs fix check look appointment visit".split(" "),
);
export const issueIsVague = (issue: string) =>
  issue
    .toLowerCase()
    .replace(/not sure/g, "not_sure")
    .split(/[^a-z/_']+/)
    .filter(Boolean)
    .every((w) => UMBRELLA.has(w));

const ServiceParam = z
  .enum(SERVICE_IDS)
  .describe(`One of: ${SERVICES.map((s) => `${s.id} (${s.name})`).join(", ")}. Choose only once the caller has said which system and what is wrong, or asked for a tune-up or estimate outright.`);
const IssueParam = z
  .string()
  .min(3)
  .max(200)
  .describe("What the caller has noticed, close to their own words, e.g. \"furnace runs but the house isn't warming up\". Never just a category like \"heating repair\" or \"HVAC issue\".");

function active(state: NorthlineState) {
  return state.appointments.filter((a) => a.status === "booked");
}

function confirmText(a: Appointment) {
  const s = describeSlot(a.slotId);
  return `${service(a.serviceId).name} on ${s.day}, arrival between ${s.window}, at ${a.address}. Reference ${a.id}.`;
}

export const northline: DemoDefinition<NorthlineState> = {
  id: "northline",
  businessName: "Northline Home Services",
  agentName: "Ellie",
  createState,

  instruction(state) {
    const today = dateLabel(state.today);
    return `You are Ellie. You answer the phone for Northline Home Services, a heating, cooling and plumbing company. You work for Northline; speak as part of its team ("we", "our technicians").

Behind the scenes, and not something to mention unless asked: this line is a demonstration. Bookings and messages are sample records, and no technician will actually visit or call. If a caller asks directly whether you are a real person, answer honestly and briefly that you are Northline's AI assistant. If they ask directly whether this is a real business or a real booking, say briefly that this is a demo line and nothing will actually be scheduled, then carry on helping.

Today is ${today} (${state.today}), Central Time. Use this to resolve "today", "tomorrow" and weekdays; always say the full day and date back when you offer or confirm a time.

How you speak: warm, calm and reassuring, like a capable dispatcher who has done this a thousand times. Short sentences. One question per turn. Never read out ids, slot codes or anything in brackets. No more than three options at once. If you are interrupted, stop and listen.

Say each thing once:
- Never turn the caller's words back into a question ("Did you need a heating and cooling appointment?") and never restate what they just told you before asking your next question. A brief, varied acknowledgement is enough ("Okay." "Oh, that's no fun in this weather."), then move on.
- Don't say you can book something until you have checked availability.
- Give the full day and date once, when you first offer a time ("Saturday the fourth, between two and four"); after that, "Saturday, two to four" is enough.
- Tools work in the background. Never announce that you are noting, saving, checking or updating something unless the caller has to wait. After a tool result, carry on from where you were; if you have already asked a question, say nothing more and wait for the answer.

Opening: exactly "Thanks for calling Northline, this is Ellie. How can I help?" Nothing more.

Finding the right visit. Before checking availability you need two things: which service fits, and what the caller has actually noticed.
- "Heating and cooling", "HVAC", "my system", "the air" and "something with the heat" are not a service. When the caller is vague or unsure, ask one short question to sort it, such as "Is it the heat, the air conditioning, or are you after a tune-up or a quote on a new system?"
- Once you know which system, ask what they have noticed: no heat or cool air, weak airflow, a noise, a leak, or it keeps turning on and off. Skip this if they have already said.
- A plain request needs no symptom: "a furnace tune-up", "a quote for a new AC".
- You are not a technician. Don't diagnose, guess at causes, suggest fixes or promise what the visit will find. Ask about what they see, hear or smell, never about parts.
- For a heating problem, ask once whether they smell gas or have a carbon monoxide alarm going off.

Booking, in this order: the service and what they've noticed, as above; when suits them; check_availability for that day and offer what it returned; the caller's name and the service address. When they pick a time, read it all back once in one sentence (the service, day and window, name and address) and ask whether to book it. On a clear yes, call book_appointment with callerConfirmed true. Then say only what is new: the reference, and that the technician will call half an hour before arriving. Don't repeat what you just read back.

Keeping the request card current: call note_request_details at most once per caller turn, with everything new from that turn, and make the call before you say anything in that turn, never after. Record the service only once it is settled, and the issue in the caller's words, never a category. When they choose a time, record it as proposedSlotId.

Other things you can do, always through your tools:
- Answer questions about services, fees, hours and area with get_business_info. Never invent prices, policies or services.
- Change or cancel a booking made in this call: check_availability for the new time, confirm, then reschedule_appointment or cancel_appointment. A change moves the same appointment; never book a second one.
- Take a message for a callback with take_message when they prefer a call back, nothing suitable is available, or you cannot help. Ask for a name. On a phone call, use get_caller_number and ask whether the number they are calling from (say only its last four digits) is the best one to reach them; otherwise ask for a number, and suggest the sample number 555-0142 if they would rather not give theirs.

Rules: never say something is booked, moved or cancelled unless the tool returned ok true. For a callback, call take_message only after the caller has confirmed the number. If a tool says something is missing, just ask the caller for it; if it fails for another reason, explain simply and offer what it suggests. Asking about a time is not a request to book it. If the caller mentions gas, a carbon monoxide alarm, burning smells, sparking, or water near electrics, tell them to leave the area and call 911 or their gas utility first, and remind them this is a demo line.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short goodbye and then call end_call. Never call end_call in the same turn as a booking, change or message.`;
  },

  operations: {
    get_business_info: {
      label: "Looking up Northline's services",
      description: "Northline's services with fees, hours, service area and policies. Use before answering any question about the business.",
      run: (state) =>
        ok("Services and hours", {
          services: SERVICES.map((s) => ({ service: s.id, name: s.name, callOutFee: s.fee ? `$${s.fee}` : "Free", covers: s.about })),
          hours: "Visits Monday to Saturday, arrival windows from 8 AM to 6 PM Central Time. Closed Sunday.",
          area: "Maple Grove, Cedar Falls and Riverside.",
          policies: [
            "The call-out fee covers the visit and diagnosis; repair work is quoted on site before anything is done.",
            "Customers can change or cancel a visit free of charge.",
            "Technicians call ahead 30 minutes before arriving.",
          ],
          today: state.today,
        }),
    },

    note_request_details: {
      label: "Updating the service request",
      description: "Record details the caller has given or confirmed, as soon as they do, so the request card fills in. Send only the fields that are new or changed. proposedSlotId must be a slot check_availability returned.",
      parameters: z.object({
        service: ServiceParam.optional(),
        name: z.string().min(1).max(80).optional().describe("The caller's name as they gave it."),
        address: z.string().min(3).max(160).optional().describe("The service address as confirmed."),
        issue: IssueParam.optional(),
        proposedSlotId: z.string().optional().describe("The slot the caller chose, before booking."),
      }),
      run(state, input: { service?: ServiceId; name?: string; address?: string; issue?: string; proposedSlotId?: string }) {
        if (input.proposedSlotId && !state.offered.includes(input.proposedSlotId)) return fail("slot_not_offered", "That time was not offered. Check availability first.");
        const r = state.request;
        // A category is not worth showing on the card as the problem; the agent still needs to ask.
        const issue = input.issue && !issueIsVague(input.issue) ? input.issue.trim() : undefined;
        if (input.service) r.serviceId = input.service;
        if (input.name) r.name = input.name.trim();
        if (input.address) r.address = input.address.trim();
        if (issue) r.issue = issue;
        if (input.proposedSlotId) r.proposedSlotId = input.proposedSlotId;
        const fields = [input.service && "service", input.name && "name", input.address && "address", issue && "issue", input.proposedSlotId && "proposed time"].filter(Boolean);
        return ok(
          `Noted ${fields.join(", ") || "details"}`,
          {
            // Every tool result invites the live model to speak again; this one should not.
            next: "Don't mention this. If you have already spoken this turn, stop and wait for the caller.",
            ...(input.issue && !issue ? { issueNotRecorded: "That names a system, not a problem. Ask what they have noticed." } : {}),
          },
          fields.length > 0,
        );
      },
    },

    check_availability: {
      label: "Checking the schedule",
      description: "Open arrival windows for a service on a date (YYYY-MM-DD, Central Time). If that date has none, returns the next available windows instead. Only offer what this returns.",
      parameters: z.object({
        service: ServiceParam,
        date: DateString.describe("The day the caller asked for, YYYY-MM-DD."),
        partOfDay: z.enum(["morning", "afternoon", "any"]).optional().describe("Morning is before noon; afternoon is noon onwards."),
      }),
      run(state, input: { service: ServiceId; date: string; partOfDay?: "morning" | "afternoon" | "any" }) {
        const skill = service(input.service).skill;
        const inPart = (id: string) => {
          const h = parseSlot(id)!.hour;
          return input.partOfDay === "morning" ? h < 12 : input.partOfDay === "afternoon" ? h >= 12 : true;
        };
        const days = bookableDays(state);
        if (input.date < state.today || input.date > days[days.length - 1]!) {
          return fail("outside_schedule", `Bookings open from today to ${dateLabel(days[days.length - 1]!)}.`, { bookableFrom: state.today, bookableTo: days[days.length - 1] });
        }
        const exact = openSlots(state, input.date, skill).filter(inPart);
        state.viewing = { date: input.date, slots: exact, skill };
        if (exact.length) {
          const offered = exact.slice(0, 4);
          state.offered = [...new Set([...state.offered, ...offered])];
          return ok(`${offered.length} open on ${dateLabel(input.date)}`, { date: input.date, day: dateLabel(input.date), available: offered.map(describeSlot) }, true);
        }
        const alternatives: string[] = [];
        for (const d of days.filter((d) => d > input.date)) {
          alternatives.push(...openSlots(state, d, skill).filter(inPart));
          if (alternatives.length >= 3) break;
        }
        const offered = alternatives.slice(0, 3);
        state.offered = [...new Set([...state.offered, ...offered])];
        const closed = weekday(input.date) === 0;
        return ok(
          offered.length ? `Nothing on ${dateLabel(input.date)} · next openings found` : `Nothing available this week`,
          { date: input.date, day: dateLabel(input.date), available: [], reason: closed ? "closed_sunday" : "fully_booked", nextAvailable: offered.map(describeSlot) },
          true,
        );
      },
    },

    book_appointment: {
      label: "Booking the visit",
      description: "Book the visit after the caller clearly said yes to the read-back. slotId must come from check_availability.",
      parameters: z.object({
        slotId: z.string(),
        service: ServiceParam,
        name: z.string().min(1).max(80),
        address: z.string().min(3).max(160),
        issue: IssueParam,
        callerConfirmed: Confirmed,
      }),
      run(state, input: { slotId: string; service: ServiceId; name: string; address: string; issue: string }, ctx): OpResult {
        const existing = active(state);
        const same = existing.find((a) => a.slotId === input.slotId && a.serviceId === input.service);
        if (same) return ok(`Already booked · ${same.id}`, { appointmentId: same.id, duplicate: true, confirmation: confirmText(same) });
        if (existing.length) return fail("already_booked", "This caller already has a visit booked in this call. Use reschedule_appointment to change it.", { appointmentId: existing[0]!.id, confirmation: confirmText(existing[0]!) });
        if (!NO_SYMPTOM_NEEDED.includes(input.service) && issueIsVague(input.issue)) {
          return fail("issue_too_vague", "The issue only names a system or trade. Ask the caller what they have noticed (no heat, a noise, a leak), then book.");
        }
        if (!state.offered.includes(input.slotId)) return fail("slot_not_offered", "That time was not offered. Check availability first.");
        const slot = parseSlot(input.slotId)!;
        const tech = freeTech(state, slot.date, slot.hour, service(input.service).skill);
        if (!tech) {
          const alternatives = openSlots(state, slot.date, service(input.service).skill).slice(0, 3);
          state.offered = [...new Set([...state.offered, ...alternatives])];
          return fail("slot_taken", "That window has just been taken.", { alternatives: alternatives.map(describeSlot) });
        }
        const id = reference("NL", state.seq++, state.seed);
        const at = ctx.now.toISOString();
        state.jobs.push({ id, techId: tech, date: slot.date, hour: slot.hour, serviceId: input.service, existing: false });
        const appt: Appointment = { id, jobId: id, slotId: input.slotId, serviceId: input.service, name: input.name.trim(), address: input.address.trim(), issue: input.issue.trim(), status: "booked", techId: tech, updatedAt: at, history: [{ at, change: "booked", slotId: input.slotId }] };
        state.appointments.push(appt);
        state.request = { serviceId: input.service, name: appt.name, address: appt.address, issue: appt.issue };
        state.viewing = { date: slot.date, slots: openSlots(state, slot.date, service(input.service).skill), skill: service(input.service).skill };
        // The caller has just heard the details in the read-back; give only what is new.
        return ok(`Visit booked · ${id}`, { appointmentId: id, technician: techName(tech).split(" ")[0], callsAhead: "30 minutes before arriving" }, true);
      },
    },

    reschedule_appointment: {
      label: "Moving the visit",
      description: "Move the existing booking to a new slot from check_availability, after the caller confirmed the new time.",
      parameters: z.object({ appointmentId: z.string(), newSlotId: z.string(), callerConfirmed: Confirmed }),
      run(state, input: { appointmentId: string; newSlotId: string }, ctx) {
        const appt = active(state).find((a) => a.id === input.appointmentId);
        if (!appt) return fail("not_found", "There is no active booking with that reference in this call.");
        if (appt.slotId === input.newSlotId) return ok(`Already at that time · ${appt.id}`, { appointmentId: appt.id, unchanged: true, confirmation: confirmText(appt) });
        if (!state.offered.includes(input.newSlotId)) return fail("slot_not_offered", "That time was not offered. Check availability first.");
        const slot = parseSlot(input.newSlotId)!;
        const tech = freeTech(state, slot.date, slot.hour, service(appt.serviceId).skill, appt.jobId);
        if (!tech) return fail("slot_taken", "That window is no longer free.");
        const job = state.jobs.find((j) => j.id === appt.jobId)!;
        Object.assign(job, { techId: tech, date: slot.date, hour: slot.hour });
        const at = ctx.now.toISOString();
        Object.assign(appt, { slotId: input.newSlotId, techId: tech, updatedAt: at });
        appt.history.push({ at, change: "moved", slotId: input.newSlotId });
        delete state.request.proposedSlotId;
        state.viewing = { date: slot.date, slots: openSlots(state, slot.date, service(appt.serviceId).skill), skill: service(appt.serviceId).skill };
        const moved = describeSlot(appt.slotId);
        return ok(`Visit moved · ${appt.id}`, { appointmentId: appt.id, technician: techName(tech).split(" ")[0], newTime: `${moved.day}, ${moved.window}` }, true);
      },
    },

    cancel_appointment: {
      label: "Cancelling the visit",
      description: "Cancel a booking made in this call, after the caller confirmed.",
      parameters: z.object({ appointmentId: z.string(), callerConfirmed: Confirmed }),
      run(state, input: { appointmentId: string }, ctx) {
        const appt = state.appointments.find((a) => a.id === input.appointmentId);
        if (!appt) return fail("not_found", "There is no booking with that reference in this call.");
        if (appt.status === "cancelled") return ok(`Already cancelled · ${appt.id}`, { appointmentId: appt.id, unchanged: true });
        state.jobs = state.jobs.filter((j) => j.id !== appt.jobId);
        const at = ctx.now.toISOString();
        Object.assign(appt, { status: "cancelled", updatedAt: at });
        appt.history.push({ at, change: "cancelled", slotId: appt.slotId });
        return ok(`Visit cancelled · ${appt.id}`, { appointmentId: appt.id, cancelled: true }, true);
      },
    },

    take_message: {
      label: "Leaving a message for the team",
      description: "Leave a callback request for the Northline team.",
      parameters: z.object({
        name: z.string().min(1).max(80),
        callbackNumber: z.string().min(7).max(20),
        summary: z.string().min(3).max(300).describe("What the caller needs, in a sentence or two."),
        preferredTime: z.string().max(80).optional().describe("When they would like a call back, in their words."),
      }),
      run(state, input: { name: string; callbackNumber: string; summary: string; preferredTime?: string }, ctx) {
        const dup = state.messages.find((m) => m.summary === input.summary.trim() && m.name === input.name.trim());
        if (dup) return ok(`Message already left · ${dup.id}`, { messageId: dup.id, duplicate: true });
        const id = reference("MSG", state.seq++, state.seed);
        state.messages.push({ id, name: input.name.trim(), callbackNumber: input.callbackNumber.trim(), summary: input.summary.trim(), preferredTime: input.preferredTime?.trim() || null, createdAt: ctx.now.toISOString() });
        return ok(`Message for the team · ${id}`, { messageId: id }, true);
      },
    },
  },

  view(state) {
    const days = bookableDays(state);
    const focus = state.viewing?.date ?? active(state)[0]?.slotId.slice(0, 10) ?? addDays(state.today, 1);
    const date = days.includes(focus) ? focus : days[0]!;
    const proposed = state.request.proposedSlotId;
    return {
      timeZone: "Central Time",
      today: state.today,
      day: { date, label: dateLabel(date) },
      technicians: TECHNICIANS.map((t) => ({ id: t.id, name: t.name.split(" ")[0] })),
      windows: WINDOWS.map((h) => ({ hour: h, label: windowLabel(h) })),
      schedule: state.jobs
        .filter((j) => j.date === date)
        .map((j) => {
          const appt = j.existing ? null : state.appointments.find((a) => a.jobId === j.id && a.status === "booked");
          return { techId: j.techId, hour: j.hour, kind: j.existing ? "existing" : "demo", title: service(j.serviceId).name, ...(appt ? { appointmentId: appt.id, name: appt.name, address: appt.address } : {}) };
        }),
      // Only technicians who do this kind of work and are free: an opening shown is one that could be booked.
      open: state.viewing?.date === date
        ? state.viewing.slots.flatMap((id) => {
            const hour = parseSlot(id)!.hour;
            return TECHNICIANS.filter((t) => t.skills.includes(state.viewing!.skill) && !state.jobs.some((j) => j.techId === t.id && j.date === date && j.hour === hour)).map((t) => ({ techId: t.id, hour }));
          })
        : [],
      proposed: proposed && proposed.startsWith(date) ? parseSlot(proposed)!.hour : null,
      request: {
        service: state.request.serviceId ? service(state.request.serviceId).name : null,
        name: state.request.name ?? null,
        address: state.request.address ?? null,
        issue: state.request.issue ?? null,
        proposed: proposed ? describeSlot(proposed) : null,
      },
      appointments: state.appointments.map((a) => ({ id: a.id, status: a.status, service: service(a.serviceId).name, ...describeSlot(a.slotId), technician: techName(a.techId), name: a.name, address: a.address, changes: a.history.length - 1 })),
      messages: state.messages.map((m) => ({ id: m.id, name: m.name, summary: m.summary, preferredTime: m.preferredTime, callback: maskNumber(m.callbackNumber) })),
    };
  },
};
