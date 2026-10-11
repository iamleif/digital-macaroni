import type { AppointmentView, FormFieldView, HotelsView, LawFirmView, RecordField, NorthlineView, TravelJourney, TravelSeatCell, TravelSeatMap, TravelView } from "./types";

/**
 * Representative records for the homepage cards and the demo window before a conversation starts.
 * Same shapes the live service sends, so the preview and the live dashboard are one component.
 */
const windows = [8, 10, 12, 14, 16].map((hour) => ({ hour, label: ["8–10 AM", "10 AM–12 PM", "12–2 PM", "2–4 PM", "4–6 PM"][[8, 10, 12, 14, 16].indexOf(hour)]! }));

export const northlineSample: NorthlineView = {
  timeZone: "Pacific Time",
  today: "",
  day: { date: "", label: "Tomorrow" },
  technicians: [
    { id: "maya", name: "Maya" },
    { id: "sam", name: "Sam" },
    { id: "jordan", name: "Jordan" },
  ],
  windows,
  schedule: [
    { techId: "maya", hour: 8, kind: "existing", title: "Heating repair" },
    { techId: "sam", hour: 10, kind: "existing", title: "Cooling repair" },
    { techId: "jordan", hour: 12, kind: "existing", title: "Seasonal tune-up" },
    { techId: "maya", hour: 12, kind: "existing", title: "Heating repair" },
    { techId: "sam", hour: 12, kind: "existing", title: "AC tune-up" },
    { techId: "maya", hour: 14, kind: "demo", title: "Heating repair", appointmentId: "NL-345", name: "Alex Taylor", address: "48 Birch Lane, Seattle" },
    { techId: "jordan", hour: 16, kind: "existing", title: "Cooling repair" },
  ],
  open: [{ techId: "sam", hour: 8 }, { techId: "jordan", hour: 8 }, { techId: "maya", hour: 10 }, { techId: "jordan", hour: 10 }, { techId: "maya", hour: 16 }],
  proposed: null,
  request: { service: "Heating repair", name: "Alex Taylor", address: "48 Birch Lane, Seattle", issue: "Furnace stopped heating", proposed: null },
  appointments: [{ id: "NL-345", status: "booked", service: "Heating repair", day: "Tomorrow", window: "2–4 PM", technician: "Maya Ortiz", name: "Alex Taylor", address: "48 Birch Lane, Seattle", changes: 0 }],
  messages: [],
};

export const northlineEmpty: NorthlineView = {
  ...northlineSample,
  schedule: northlineSample.schedule.filter((j) => j.kind === "existing"),
  open: [],
  request: { service: null, name: null, address: null, issue: null, proposed: null },
  appointments: [],
};

export const formfieldSample: FormFieldView = {
  shown: [
    {
      id: "ridge-lamp",
      name: "Ridge Table Lamp",
      category: "lighting",
      price: 89,
      focus: true,
      options: [
        { id: "ridge-sage", option: "Sage green", inStock: 1 },
        { id: "ridge-oat", option: "Oat", inStock: 0 },
        { id: "ridge-charcoal", option: "Charcoal", inStock: 5 },
      ],
      materials: "Glazed stoneware base, linen shade",
      size: "18 inches tall",
    },
    { id: "moss-lamp", name: "Moss Glass Lamp", category: "lighting", price: 129, focus: false, options: [{ id: "moss-green", option: "Moss green", inStock: 1 }] },
  ],
  reservations: [{ id: "FF-801", status: "reserved", product: "Ridge Table Lamp", option: "Sage green", quantity: 2, name: "Sam Rivera", pickupBy: "Monday", price: 178 }],
  order: null,
  supportRequests: [],
  messages: [],
};

export const formfieldEmpty: FormFieldView = {
  shown: [
    { id: "ridge-lamp", name: "Ridge Table Lamp", category: "lighting", price: 89, focus: false, options: [{ id: "ridge-sage", option: "Sage green", inStock: 3 }, { id: "ridge-oat", option: "Oat", inStock: 0 }, { id: "ridge-charcoal", option: "Charcoal", inStock: 5 }] },
    { id: "everyday-mugs", name: "Everyday Mugs, set of two", category: "tableware", price: 32, focus: false, options: [{ id: "mugs-sand", option: "Sand", inStock: 12 }, { id: "mugs-sage", option: "Sage", inStock: 0 }, { id: "mugs-ink", option: "Ink blue", inStock: 7 }] },
    { id: "field-planter", name: "Field Planter", category: "planters", price: 48, focus: false, options: [{ id: "planter-small-sage", option: "Small, sage", inStock: 5 }, { id: "planter-large-sage", option: "Large, sage", inStock: 1 }, { id: "planter-large-clay", option: "Large, clay", inStock: 3 }] },
  ],
  reservations: [],
  order: null,
  supportRequests: [],
  messages: [],
};

const leg = (date: string, from: [string, string], to: [string, string], departs: string, arrives: string, duration: string, airline: string, flight: string, via: string[] = [], nextDay = false): TravelJourney => ({
  from: from[0], fromName: from[1], to: to[0], toName: to[1], date, departs, arrives, arrivesNextDay: nextDay, duration, stops: via.length, via, flights: [flight], airlines: [airline],
});
const LHR: [string, string] = ["LHR", "Heathrow Airport"];
const JFK: [string, string] = ["JFK", "John F. Kennedy International Airport"];

/**
 * The economy cabin of a wide-body, three-three-three with two aisles, the shape Duffel Airways sends:
 * window and aisle seats cost extra, the narrower rows at either end have two seats a side, and row 18
 * behind the lavatories is an exit row.
 */
function sampleSeatMap(): TravelSeatMap {
  const rows: TravelSeatMap["rows"] = [];
  const blocks = (n: number) => (n === 10 || n >= 31 ? [["A", "C"], ["D", "E", "F"], ["J", "K"]] : [["A", "B", "C"], ["D", "E", "F"], ["H", "J", "K"]]);
  for (let n = 10; n <= 32; n++) {
    // A seat at either end of its block is a window or an aisle.
    const cell = (l: string, edge: boolean): TravelSeatCell => {
      const id = `${n}${l}`;
      if (id !== "11A" && (n * 7 + l.charCodeAt(0) * 3) % 5 < 2) return { id, st: "taken" };
      const price = n === 18 ? "$45" : edge ? "$18" : null;
      return { id, st: price ? "paid" : "free", price };
    };
    if (n === 18) {
      rows.push({ row: null, exit: false, sections: [[{ type: "lavatory" }], [{ type: "lavatory" }], [{ type: "lavatory" }]] });
      rows.push({ row: null, exit: false, sections: [[{ type: "exit_row" }], [], [{ type: "exit_row" }]] });
    }
    rows.push({ row: n, exit: n === 18, sections: blocks(n).map((b) => b.map((l, i) => cell(l, i === 0 || i === b.length - 1))) });
  }
  rows.push({ row: null, exit: false, sections: [[{ type: "galley" }], [{ type: "galley" }], [{ type: "galley" }]] });
  const at = (n: number) => rows.findIndex((r) => r.row === n);
  return { cabin: "economy", aisles: 2, wings: { first_row_index: at(13), last_row_index: at(22) }, rows, flight: { from: "LHR", to: "JFK", flight: "ZZ117" } };
}

export const travelSeatMap = sampleSeatMap();

export const travelSample: TravelView = {
  stage: "payment",
  search: { origin: "LON", destination: "NYC", departureDate: "2026-11-20", returnDate: "2026-11-27", adults: 1, cabinClass: "economy", originName: "London", destinationName: "New York", label: "LON to NYC, Friday, November 20, back Friday, November 27" },
  options: [
    { option: 1, label: "Best value", airline: "Duffel Airways", price: "$389", amount: "389.00", currency: "USD", journeys: [leg("Friday, November 20", LHR, JFK, "8:20 AM", "11:05 AM", "7h 45m", "Duffel Airways", "ZZ117"), leg("Friday, November 27", JFK, LHR, "6:30 PM", "6:40 AM", "7h 10m", "Duffel Airways", "ZZ178", [], true)] },
    { option: 2, label: "Cheapest", airline: "Iberia", price: "$372", amount: "372.00", currency: "USD", journeys: [leg("Friday, November 20", LHR, JFK, "7:05 AM", "1:50 PM", "11h 45m", "Iberia", "IB3167", ["MAD"]), leg("Friday, November 27", JFK, LHR, "5:15 PM", "9:55 AM", "11h 40m", "Iberia", "IB6252", ["MAD"], true)] },
    { option: 3, label: "Fastest", airline: "Virgin Atlantic", price: "$426", amount: "426.00", currency: "USD", journeys: [leg("Friday, November 20", LHR, JFK, "11:40 AM", "2:35 PM", "7h 55m", "Virgin Atlantic", "VS3"), leg("Friday, November 27", JFK, LHR, "8:05 PM", "8:10 AM", "7h 05m", "Virgin Atlantic", "VS4", [], true)] },
  ],
  selected: 1,
  details: { option: 1, price: "$389", priceChanged: false, fareBrand: "Economy Basic", refund: "Not refundable", changes: "Changeable for a fee of $70", baggage: "no checked bags, 1 carry-on per traveller" },
  fareLevels: [
    { brand: "Economy Basic", price: "$389", amount: "389.00", refund: "Not refundable", changes: "Changeable for a fee of $70", baggage: "no checked bags, 1 carry-on per traveller", current: true, difference: null },
    { brand: "Economy Standard", price: "$429", amount: "429.00", refund: "Not refundable", changes: "Changeable free of charge", baggage: "1 checked bag, 1 carry-on per traveller", current: false, difference: "$40" },
    { brand: "Economy Flex", price: "$519", amount: "519.00", refund: "Refundable for a fee of $50", changes: "Changeable free of charge", baggage: "2 checked bags, 1 carry-on per traveller", current: false, difference: "$130" },
  ],
  seatMap: travelSeatMap,
  seat: { seat: "11A", row: 11, position: "window", exitRow: false, price: "$18" },
  bags: { included: "no checked bags, 1 carry-on per traveller", added: 1, extraBagPrice: "$65", maxExtra: 2, total: "$65" },
  traveller: { name: "Alex Taylor", bornOn: "1990-04-12", email: "traveller@example.com", phone: "+1 555 0142", sample: ["bornOn", "email", "phone"] },
  review: { airline: "Duffel Airways", outbound: "Friday, November 20, 8:20 AM from Heathrow Airport, arriving 11:05 AM", return: "Friday, November 27, 6:30 PM from John F. Kennedy International Airport", fare: "Economy Basic · $389", fareChanged: false, seat: "11A (window) · $18", bags: "no checked bags, 1 carry-on per traveller + 1 extra · $65", traveller: "Alex Taylor", total: "$472" },
  readBack: { option: 1, travellerName: "Alex Taylor", price: "$472" },
  booking: { option: 1, travellerName: "Alex Taylor", price: "$472", status: "not_booked_test_mode" },
};

export const travelEmpty: TravelView = { stage: "trip", search: null, options: [], selected: null, details: null, fareLevels: [], seatMap: null, seat: null, bags: null, traveller: null, review: null, readBack: null, booking: null };

/* ---------------- Ellie's other businesses (front-end preview data) ---------------- */

const dayHours = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i).map((hour) => ({ hour, label: `${hour % 12 || 12}${hour < 12 ? " AM" : " PM"}` }));

/** Lune Salon & Med Spa: stylists and an injector, a service menu with prices and times, deposits. */
export const luneSample: AppointmentView = {
  skin: "salon",
  timeZone: "Pacific Time",
  day: { label: "Saturday" },
  staff: [
    { id: "maria", name: "Maria", role: "Senior stylist" },
    { id: "ava", name: "Ava", role: "Colourist" },
    { id: "jules", name: "Jules", role: "Nail artist" },
    { id: "noor", name: "Noor", role: "Nurse injector" },
  ],
  hours: dayHours(9, 18),
  schedule: [
    { staffId: "maria", hour: 9, span: 1, kind: "existing", title: "Cut & style" },
    { staffId: "maria", hour: 12, span: 2, kind: "existing", title: "Blowout + treatment" },
    { staffId: "ava", hour: 9, span: 3, kind: "existing", title: "Balayage" },
    { staffId: "ava", hour: 15, span: 2, kind: "existing", title: "Root colour" },
    { staffId: "jules", hour: 10, span: 1, kind: "existing", title: "Gel manicure" },
    { staffId: "jules", hour: 13, span: 1, kind: "existing", title: "Pedicure" },
    { staffId: "noor", hour: 11, span: 1, kind: "existing", title: "Hydrafacial" },
    { staffId: "noor", hour: 14, span: 1, kind: "existing", title: "Consultation" },
    { staffId: "maria", hour: 15, span: 1, kind: "demo", title: "Cut & style", ref: "LN-218", name: "Priya Shah" },
  ],
  open: [{ staffId: "maria", hour: 10 }, { staffId: "maria", hour: 15 }, { staffId: "maria", hour: 16 }],
  proposed: null,
  menu: [
    { id: "cut", name: "Cut & style", price: "$85", minutes: 60, staff: ["Maria", "Ava"], group: "Hair", chosen: true },
    { id: "balayage", name: "Balayage", price: "$220", minutes: 180, staff: ["Ava"], group: "Hair" },
    { id: "gloss", name: "Gloss add-on", price: "$35", minutes: 20, staff: ["Maria", "Ava"], group: "Hair" },
    { id: "gel", name: "Gel manicure", price: "$45", minutes: 45, staff: ["Jules"], group: "Nails" },
    { id: "hydrafacial", name: "Hydrafacial", price: "$199", minutes: 60, staff: ["Noor"], group: "Med spa" },
    { id: "consult", name: "Injectables consultation", price: "Free", minutes: 30, staff: ["Noor"], group: "Med spa" },
  ],
  request: [
    { label: "Service", value: "Cut & style" },
    { label: "Stylist", value: "Maria" },
    { label: "Name", value: "Priya Shah" },
    { label: "Mobile", value: "•••• 0142" },
    { label: "Time", value: "Saturday, 3 PM", note: "Booked" },
  ],
  extras: { title: "Deposit & add-ons", rows: [
    { label: "Deposit", value: "$25 held on card · applied at checkout", tone: "good" },
    { label: "Add-on offered", value: "Gloss · $35 · accepted", tone: "good" },
    { label: "Cancellation", value: "Free up to 24 hours before" },
  ] },
  appointments: [{ id: "LN-218", status: "booked", service: "Cut & style + gloss", when: "Saturday, 3 PM", staff: "Maria", name: "Priya Shah", changes: 0 }],
  messages: [],
};

export const luneEmpty: AppointmentView = {
  ...luneSample,
  schedule: luneSample.schedule.filter((j) => j.kind === "existing"),
  open: [],
  menu: luneSample.menu.map((m) => ({ ...m, chosen: false })),
  request: luneSample.request.map((r) => ({ label: r.label, value: null })),
  extras: null,
  appointments: [],
};

/** Tidewell Clinic: chiropractic, physio and massage; new vs returning patients, coverage, packages. */
export const tidewellSample: AppointmentView = {
  skin: "clinic",
  timeZone: "Pacific Time",
  day: { label: "Tuesday" },
  staff: [
    { id: "lee", name: "Dr. Lee", role: "Chiropractor" },
    { id: "sam", name: "Sam Patel", role: "Physiotherapist" },
    { id: "nina", name: "Nina", role: "Massage therapist" },
  ],
  hours: dayHours(8, 18),
  schedule: [
    { staffId: "lee", hour: 8, span: 1, kind: "existing", title: "Adjustment" },
    { staffId: "lee", hour: 9, span: 1, kind: "existing", title: "Adjustment" },
    { staffId: "lee", hour: 13, span: 1, kind: "existing", title: "New patient" },
    { staffId: "sam", hour: 10, span: 1, kind: "existing", title: "Follow-up" },
    { staffId: "sam", hour: 14, span: 2, kind: "existing", title: "Post-op rehab" },
    { staffId: "nina", hour: 9, span: 2, kind: "existing", title: "Massage · 90" },
    { staffId: "nina", hour: 15, span: 1, kind: "existing", title: "Massage · 60" },
    { staffId: "lee", hour: 11, span: 1, kind: "demo", title: "New patient assessment", ref: "TW-407", name: "Jordan Reyes" },
  ],
  open: [{ staffId: "lee", hour: 10 }, { staffId: "lee", hour: 11 }, { staffId: "lee", hour: 16 }],
  proposed: null,
  menu: [
    { id: "chiro-new", name: "Chiropractic · new patient", price: "$120", minutes: 60, staff: ["Dr. Lee"], group: "Chiropractic", chosen: true },
    { id: "chiro-follow", name: "Chiropractic · follow-up", price: "$65", minutes: 30, staff: ["Dr. Lee"], group: "Chiropractic" },
    { id: "physio-new", name: "Physio assessment", price: "$130", minutes: 60, staff: ["Sam Patel"], group: "Physiotherapy" },
    { id: "massage-60", name: "Massage · 60 min", price: "$110", minutes: 60, staff: ["Nina"], group: "Massage" },
    { id: "package", name: "5-visit package", price: "$300", minutes: 30, staff: ["Dr. Lee"], group: "Packages" },
  ],
  request: [
    { label: "Patient", value: "Jordan Reyes" },
    { label: "Visit", value: "New patient · chiropractic" },
    { label: "Reason", value: "Lower back pain after lifting, 1 week" },
    { label: "Practitioner", value: "Dr. Lee" },
    { label: "Time", value: "Tuesday, 11 AM", note: "Booked" },
  ],
  extras: { title: "Intake & coverage", rows: [
    { label: "Patient type", value: "New · intake forms sent by email", tone: "good" },
    { label: "Coverage", value: "Insurance on file · direct billing, verified at the visit" },
    { label: "Red flags", value: "None mentioned (no numbness, no fall)", tone: "good" },
    { label: "Package", value: "5-visit package offered · thinking about it" },
  ] },
  appointments: [{ id: "TW-407", status: "booked", service: "New patient assessment", when: "Tuesday, 11 AM", staff: "Dr. Lee", name: "Jordan Reyes", changes: 0 }],
  messages: [],
};

export const tidewellEmpty: AppointmentView = {
  ...tidewellSample,
  schedule: tidewellSample.schedule.filter((j) => j.kind === "existing"),
  open: [],
  menu: tidewellSample.menu.map((m) => ({ ...m, chosen: false })),
  request: tidewellSample.request.map((r) => ({ label: r.label, value: null })),
  extras: null,
  appointments: [],
};

const f = (key: string, label: string, kind: RecordField["kind"], value: RecordField["value"] = null, options: string[] = [], wide = false): RecordField => ({ key, label, kind, value, options, wide });
const TYPES = ["Car crash", "Truck crash", "Motorcycle crash", "Pedestrian or bicycle", "Rideshare crash", "Slip or fall", "Dog bite", "Workplace injury", "Medical malpractice", "Other injury"];
const AREAS = ["Head / concussion", "Neck", "Back", "Shoulder / arm", "Hand / wrist", "Hip / leg", "Knee / foot", "Broken bones", "Internal", "Cuts / scarring", "Emotional distress"];
const TREATMENTS = ["No treatment yet", "Doctor or urgent care", "Emergency room", "Ongoing treatment", "Surgery", "Hospitalized"];
const FAULTS = ["Other party", "Shared", "The caller", "Not sure yet"];
const YNS = ["Yes", "No", "Not sure"];

/** The matter record with whatever has been filled in so far. Same shape the voice service sends. */
export function lawRecord(v: Partial<Record<string, string | string[]>> = {}, opened = Object.keys(v).length > 0): LawFirmView["record"]["sections"] {
  const g = (k: string) => (v[k] as string | undefined) ?? null;
  return [
    { id: "contact", title: "Contact", fields: [f("name", "Full name", "text", g("name")), f("phone", "Phone", "text", g("phone")), f("email", "Email", "text", g("email"))] },
    { id: "matter", title: "Matter", fields: [
      f("practice", "Practice area", "select", opened ? "Personal injury" : null, ["Personal injury", "Insurance", "Real estate"]),
      f("type", "Case type", "select", g("type"), TYPES),
      f("date", "Date of incident", "date", g("date")),
      f("where", "Location", "text", g("where")),
      f("source", "Referral source", "select", opened ? "Phone · AI intake" : null, ["Phone · AI intake", "Website", "Referral", "Advertising"]),
    ] },
    { id: "injuries", title: "Injuries & treatment", fields: [
      f("areas", "Injured areas", "chips", (v.areas as string[] | undefined) ?? null, AREAS, true),
      f("injuries", "In the caller’s words", "text", g("injuries"), [], true),
      f("treatment", "Treatment so far", "select", g("treatment"), TREATMENTS),
      f("work", "Missed work", "toggle", g("work"), YNS),
    ] },
    { id: "liability", title: "Liability & insurance", fields: [
      f("fault", "At fault", "select", g("fault"), FAULTS),
      f("other", "Other party", "text", g("other")),
      f("police", "Police report", "toggle", g("police"), YNS),
      f("insured", "Other side insured", "toggle", g("insured"), YNS),
      f("insurer", "Insurer", "text", g("insurer")),
      f("lawyer", "Already has a lawyer", "toggle", g("lawyer"), ["Yes", "No"]),
    ] },
  ];
}

const brief0: NonNullable<LawFirmView["brief"]>["rows"] = [
  { who: "Jordan M.", summary: "Semi-truck hit his car on I-5; surgery on Tuesday, driver cited", tier: "A", mine: false, declined: false },
  { who: "Aisha K.", summary: "Rear-ended at a light; ER visit, physio booked, other driver insured", tier: "B", mine: false, declined: false },
  { who: "Chris P.", summary: "Bitten by a neighbour’s dog; urgent care, stitches", tier: "C", mine: false, declined: false },
  { who: "Lena S.", summary: "Slipped on a wet store floor; no treatment yet", tier: "C", mine: false, declined: false },
];

/** Before a call: an empty record waiting for the first detail, and last night's brief. */
export const lawfirmEmpty: LawFirmView = {
  timeZone: "Mountain Time",
  record: { opened: false, number: null, title: null, stage: "new", sections: lawRecord({}, false) },
  conflict: null,
  assessment: null,
  note: null,
  tasks: [],
  openTimes: [],
  consults: [],
  messages: [],
  brief: { rows: brief0 },
  emailed: null,
};

export const lawStory: Record<string, string | string[]> = {
  type: "Car crash", date: "Sep 20, 2026", where: "Denver, CO", areas: ["Neck", "Back"], injuries: "Neck and lower back pain since the crash", treatment: "Emergency room", work: "Yes",
  fault: "Other party", other: "Unknown driver", police: "Yes", insured: "Yes", insurer: "State Farm", lawyer: "No",
};
export const lawNamed = { ...lawStory, name: "Alex Taylor", phone: "•••• 0142", email: "a•••r@example.com" };

export const lawfirmSample: LawFirmView = {
  ...lawfirmEmpty,
  record: { opened: true, number: "PI-482", title: "Alex Taylor", stage: "consult", sections: lawRecord(lawNamed) },
  conflict: { status: "clear", checked: ["Alex Taylor"] },
  assessment: { outcome: "qualified", tier: "B", reason: null, points: ["Emergency room", "Fault: other party", "Police report filed", "Other side insured"], flags: [], deadline: "September 20, 2029" },
  note: "Alex Taylor called the intake line about a car crash on 2026-09-20 in Denver, CO. Injuries: neck and lower back pain since the crash. Treatment: emergency room. Fault: other party. Police report filed. Not represented. Conflict check clear. Tier B. Free consultation booked with Dana Alder, tomorrow at 1 PM.",
  tasks: [
    { title: "Free consultation · tomorrow, 1 PM", who: "Dana Alder", due: "Tomorrow" },
    { title: "Email the consultation confirmation", who: "Nora", due: "Sent" },
    { title: "Request the police report", who: "Intake team", due: "Tomorrow" },
    { title: "Send the medical-records release for signature", who: "Intake team", due: "Tomorrow" },
  ],
  consults: [{ id: "AF-482", status: "booked", day: "Tomorrow", time: "1 PM", attorney: "Dana Alder", format: "Phone call", name: "Alex Taylor", changes: 0 }],
  brief: { rows: [brief0[0]!, { who: "Alex T.", summary: "Car crash; emergency room; other party at fault", tier: "B", mine: true, declined: false }, ...brief0.slice(1)] },
};

/* Palmetto Stays: real Miami Beach hotels; rates and reviews here are illustrative, live calls bring the real ones. */
export const hotelsSample: HotelsView = {
  stage: "payment",
  search: { area: "Miami Beach", checkin: "2026-11-20", checkout: "2026-11-22", checkinLabel: "Fri, Nov 20", checkoutLabel: "Sun, Nov 22", nights: 2, adults: 2, label: "Miami Beach · Nov 20–22 · 2 adults" },
  options: [
    { option: 1, label: "Best rated", name: "The Betsy Hotel, South Beach", stars: 5, rating: 9.2, reviews: 2779, photo: "https://static.cupid.travel/hotels/448099852.jpg", address: "1440 Ocean Drive, Miami Beach", total: "$1,118", perNight: "$559", refundable: false },
    { option: 2, label: "Best value", name: "Nautilus Sonesta Miami Beach", stars: 4, rating: 8.6, reviews: 3001, photo: "https://static.cupid.travel/hotels/488247392.jpg", address: "1825 Collins Avenue, Miami Beach", total: "$742", perNight: "$371", refundable: true },
    { option: 3, label: "Cheapest", name: "The Goodtime Hotel", stars: 4, rating: 8.1, reviews: 2199, photo: "https://static.cupid.travel/hotels/595742196.jpg", address: "601 Washington Avenue, Miami Beach", total: "$538", perNight: "$269", refundable: false },
  ],
  selected: 1,
  hotel: {
    name: "The Betsy Hotel, South Beach", stars: 5, rating: 9.2, reviews: 2779, photos: ["https://static.cupid.travel/hotels/448099852.jpg", "https://static.cupid.travel/hotels/452995447.jpg", "https://static.cupid.travel/hotels/319016195.jpg", "https://static.cupid.travel/hotels/184187576.jpg"], address: "1440 Ocean Drive, Miami Beach, FL 33139",
    checkIn: "4:00 PM", checkOut: "11:00 AM",
    highlights: ["Rooftop pool", "Beach service", "Restaurant", "Bar", "Fitness room", "Free WiFi"],
    pros: ["On Ocean Drive, across from the beach", "Guests praise the staff and the breakfast"],
    cons: ["Some rooms are compact", "Parking is valet only"],
  },
  rooms: [
    { room: 1, name: "Deluxe King, City View", board: "Room only", refundable: false, cancellation: "Non-refundable", total: "$1,118", perNight: "$559" },
    { room: 2, name: "Deluxe King, City View", board: "Breakfast included", refundable: true, cancellation: "Free cancellation until Tue, Nov 17", total: "$1,218", perNight: "$609" },
    { room: 3, name: "Ocean View Queen", board: "Breakfast included", refundable: true, cancellation: "Free cancellation until Tue, Nov 17", total: "$1,396", perNight: "$698" },
  ],
  room: 2,
  guest: { name: "Alex Taylor", email: "guest@example.com", phone: "+1 555 0142" },
  review: {
    hotel: "The Betsy Hotel, South Beach", room: "Deluxe King, City View", board: "Breakfast included", dates: "Fri, Nov 20 – Sun, Nov 22", nights: 2, adults: 2,
    guest: "Alex Taylor", total: "$1,218", taxes: "Resort fee of $40 a night, paid at the hotel", cancellation: "Free cancellation until Tue, Nov 17", priceChanged: false,
  },
  booking: { status: "payment_stopped" },
  messages: [],
  emailed: null,
};

export const hotelsEmpty: HotelsView = { stage: "trip", search: null, options: [], selected: null, hotel: null, rooms: [], room: null, guest: null, review: null, booking: null, messages: [], emailed: null };
