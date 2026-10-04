/**
 * The demo voice service's protocol and dashboard records, as the website receives them. Mirrors
 * DigitalMacaroni/voice/src/protocol.ts and each demo's view() output.
 */
export type DemoId = "northline" | "formfield" | "travel";

export type DemoEvent =
  | { type: "session.ready"; sessionId: string; demo: DemoId; channel: "phone" | "browser" }
  | { type: "session.ended"; reason: string }
  | { type: "session.error"; message: string }
  | { type: "transcript"; id: string; speaker: "visitor" | "agent"; text: string; final: boolean }
  | { type: "tool.started"; callId: string; tool: string; label: string }
  | { type: "tool.succeeded"; callId: string; tool: string; label: string; summary: string; version: number }
  | { type: "tool.failed"; callId: string; tool: string; label: string; summary: string }
  | { type: "state"; version: number; state: DemoView }
  | { type: "audio.interrupted" }
  | { type: "agent.speaking"; speaking: boolean }
  /** The agent's voice as waveform bars: `bands` bytes per frame, low pitches first; the first frame plays `in` ms after it was sent. */
  | { type: "agent.levels"; in: number; frameMs: number; bands: number; levels: string }
  | { type: "pairing.waiting"; code: string; expiresAt: number }
  | { type: "pairing.linked" }
  | { type: "pairing.expired" };

export interface NorthlineView {
  timeZone: string;
  today: string;
  day: { date: string; label: string };
  technicians: { id: string; name: string }[];
  windows: { hour: number; label: string }[];
  schedule: { techId: string; hour: number; kind: "existing" | "demo"; title: string; appointmentId?: string; name?: string; address?: string }[];
  /** Bookable openings for the service being discussed: only technicians who do that work. */
  open: { techId: string; hour: number }[];
  proposed: number | null;
  request: { service: string | null; name: string | null; address: string | null; issue: string | null; proposed: { day: string; window: string } | null };
  appointments: { id: string; status: "booked" | "cancelled"; service: string; day: string; window: string; technician: string; name: string; address: string; changes: number }[];
  messages: { id: string; name: string; summary: string; preferredTime?: string | null }[];
}

export interface FormFieldView {
  shown: {
    id: string;
    name: string;
    category: string;
    price: number;
    focus: boolean;
    options: { id: string; option: string; inStock: number }[];
    description?: string;
    materials?: string;
    size?: string;
  }[];
  reservations: { id: string; status: "reserved" | "cancelled"; product: string; option: string; quantity: number; name: string; pickupBy: string; price: number }[];
  order: { number: string; name: string; items: { name: string; option: string; price: number }[]; status: string; events: string[] } | null;
  supportRequests: { id: string; orderNumber: string; issue: string; status: string }[];
  messages: { id: string; name: string; summary: string }[];
}

export interface TravelJourney {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  date: string;
  departs: string;
  arrives: string;
  arrivesNextDay: boolean;
  duration: string;
  stops: number;
  via: string[];
  flights: string[];
  airlines: string[];
}

/** Waypoint Travel: the caller's search, the options read out, and how far booking got (never past test mode). */
export interface TravelView {
  search: { origin: string; destination: string; departureDate: string; returnDate: string | null; adults: number; cabinClass: string; label: string; originName?: string | null; destinationName?: string | null } | null;
  options: { option: number; airline: string; price: string; amount: string; currency: string; journeys: TravelJourney[] }[];
  selected: number | null;
  details: { option: number; price: string; priceChanged: boolean; fareBrand?: string | null; refund: string; changes: string; baggage: string } | null;
  readBack: { option: number; travellerName: string; price: string } | null;
  booking: { option: number; travellerName: string; price: string; status: "not_booked_test_mode" } | null;
}

export type DemoView = NorthlineView | FormFieldView | TravelView;
