import type { FormFieldView, NorthlineView, TravelJourney, TravelSeatCell, TravelSeatMap, TravelView } from "./types";

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
    { techId: "sam", hour: 10, kind: "existing", title: "Plumbing repair" },
    { techId: "jordan", hour: 12, kind: "existing", title: "Seasonal tune-up" },
    { techId: "maya", hour: 12, kind: "existing", title: "Heating repair" },
    { techId: "sam", hour: 12, kind: "existing", title: "Water heater service" },
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

/** A 27-row, three-and-three economy cabin: the front rows and window or aisle seats cost extra, row 12 is an exit row. */
function sampleSeatMap(): TravelSeatMap {
  const taken = new Set(["1B", "1C", "2A", "2E", "3D", "3F", "5B", "6A", "6C", "6F", "7A", "7D", "8A", "8B", "8E", "9A", "9F", "10A", "10C", "10D", "12C", "13B", "13E", "14A", "14F", "15D", "16A", "16B", "16C", "17F", "18A", "18E", "19C", "19D", "20B", "21A", "21F", "22D", "22E", "23A", "24C", "24F", "25B", "26A", "26E", "27C", "27D"]);
  const rows: TravelSeatMap["rows"] = [];
  for (let n = 1; n <= 27; n++) {
    const cell = (l: string): TravelSeatCell => {
      const id = `${n}${l}`;
      if (taken.has(id)) return { id, st: "taken" };
      const price = n <= 5 ? "$35" : n === 12 ? "$45" : "AF".includes(l) || "CD".includes(l) ? "$18" : null;
      return { id, st: price ? "paid" : "free", price };
    };
    rows.push({ row: n, exit: n === 12, sections: [["A", "B", "C"].map(cell), ["D", "E", "F"].map(cell)] });
  }
  rows.push({ row: null, exit: false, sections: [[{ type: "lavatory" }, { type: "empty" }, { type: "empty" }], [{ type: "empty" }, { type: "empty" }, { type: "galley" }]] });
  return { cabin: "economy", aisles: 1, wings: { first_row_index: 8, last_row_index: 16 }, rows, flight: { from: "LHR", to: "JFK", flight: "ZZ117" } };
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
