/**
 * The demo voice service's protocol and dashboard records, as the website receives them. Mirrors
 * DigitalMacaroni/voice/src/protocol.ts and each demo's view() output.
 */
export type DemoId = "northline" | "formfield" | "travel" | "lawfirm" | "hotels";

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
  /** A confirmation emailed after booking, to a masked address (the full address never reaches the page). */
  emailed?: { to: string; reference: string } | null;
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
  /** A reservation emailed after reserving, to a masked address (the full address never reaches the page). */
  emailed?: { to: string; reference: string } | null;
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

export type TravelStage = "trip" | "options" | "fare" | "seat" | "bags" | "traveller" | "review" | "payment";

/** One cell of a seat map: a seat (free, paid with its price, or taken) or a facility (lavatory, galley, exit, empty). */
export type TravelSeatCell = { id: string; st: "free" | "paid" | "taken"; price?: string | null } | { type: string };

export interface TravelSeatMap {
  cabin: string | null;
  aisles: number | null;
  /** Row indexes the wings span, as the airline sends them. */
  wings: { first_row_index: number; last_row_index: number } | null;
  /** Each row's sections, left to right; aisles fall between sections. Exit rows have extra legroom. */
  rows: { row: number | null; exit: boolean; sections: TravelSeatCell[][] }[];
  flight?: { from: string; to: string; flight: string };
}

export interface TravelFareLevel {
  brand: string;
  price: string;
  amount: string;
  refund: string;
  changes: string;
  baggage: string;
  current: boolean;
  /** Price difference from the current fare, e.g. "$40"; null on the current fare. */
  difference: string | null;
}

/** Waypoint Travel: the caller's search, the options read out, and how far booking got (never past test mode). */
export interface TravelView {
  /** How far the booking has got. Older services send no stage; the page works it out. */
  stage?: TravelStage;
  search: { origin: string; destination: string; departureDate: string; returnDate: string | null; adults: number; cabinClass: string; label: string; originName?: string | null; destinationName?: string | null } | null;
  options: { option: number; label?: string | null; airline: string; price: string; amount: string; currency: string; journeys: TravelJourney[] }[];
  selected: number | null;
  details: { option: number; price: string; priceChanged: boolean; fareBrand?: string | null; refund: string; changes: string; baggage: string } | null;
  fareLevels?: TravelFareLevel[];
  seatMap?: TravelSeatMap | null;
  seat?: { seat: string; row: number | null; position: "window" | "aisle" | "middle"; exitRow: boolean; price: string } | null;
  bags?: { included: string; added: number; extraBagPrice: string | null; maxExtra: number; total?: string | null } | null;
  /** The lead traveller: the name is the caller's; the fields in `sample` are marked samples, never collected. */
  traveller?: { name: string; bornOn: string; email: string; phone: string; sample: string[] } | null;
  review?: { airline: string; outbound: string; return: string | null; fare: string; fareChanged: boolean; seat: string; bags: string; traveller: string; total: string } | null;
  readBack: { option: number; travellerName: string; price: string } | null;
  booking: { option: number; travellerName: string; price: string; status: "not_booked_test_mode" } | null;
  /** The itinerary emailed after the payment stop, to a masked address (the full address never reaches the page). */
  emailed?: { to: string; total: string } | null;
  /** Callback requests for an agent (groups, multi-city, hotels, a person). The number is masked. */
  messages?: { id: string; name: string; summary: string; preferredTime: string | null; callback: string }[];
}

export type HotelsStage = "trip" | "options" | "hotel" | "room" | "guest" | "review" | "payment";

/** Palmetto Stays: real Miami hotels with live rates, one hotel's rooms, the lead guest, and a stop at payment (test mode). */
export interface HotelsView {
  stage: HotelsStage;
  search: { area: string; checkin: string; checkout: string; checkinLabel: string; checkoutLabel: string; nights: number; adults: number; label: string } | null;
  /** The short list read out: "Best rated", "Best value" or "Cheapest". `rating` is out of 10. */
  options: { option: number; label: string; name: string; stars: number | null; rating: number | null; reviews: number | null; photo: string | null; address: string; total: string; perNight: string; refundable: boolean }[];
  selected: number | null;
  hotel: { name: string; stars: number | null; rating: number | null; reviews: number | null; photos: string[]; address: string; checkIn: string; checkOut: string; highlights: string[]; pros: string[]; cons: string[] } | null;
  rooms: { room: number; name: string; board: string; refundable: boolean; cancellation: string; total: string; perNight: string }[];
  room: number | null;
  /** The lead guest: the name is the caller's; email and phone are marked samples, never collected. */
  guest: { name: string; email: string; phone: string } | null;
  review: { hotel: string; room: string; board: string; dates: string; nights: number; adults: number; guest: string; total: string; taxes: string | null; cancellation: string; priceChanged: boolean } | null;
  booking: { status: "payment_stopped" } | null;
  /** Callback requests for an agent (several rooms, a long stay, a person). The number is masked. */
  messages: { id: string; name: string; summary: string; preferredTime: string | null; callback: string }[];
  /** The quote emailed after the payment stop, to a masked address (the full address never reaches the page). */
  emailed: { to: string } | null;
}

/** The businesses Ellie can answer for. Northline uses NorthlineView; the others share AppointmentView. */
export type BookingSkin = "home" | "salon" | "clinic";
export type BrandId = DemoId | "lune" | "tidewell";

/**
 * A front-desk day for businesses that book people into fixed times with a named staff member
 * (salons, med spas, clinics). Same engine as Northline, different words and one signature panel.
 */
export interface AppointmentView {
  skin: "salon" | "clinic";
  timeZone: string;
  day: { label: string };
  staff: { id: string; name: string; role: string }[];
  hours: { hour: number; label: string }[];
  /** Booked time; `span` is how many hour columns it covers. */
  schedule: { staffId: string; hour: number; span: number; kind: "existing" | "demo"; title: string; ref?: string; name?: string }[];
  open: { staffId: string; hour: number }[];
  proposed: { staffId: string; hour: number } | null;
  /** Salon: the service menu. Clinic: visit types. `chosen` marks the one being booked. */
  menu: { id: string; name: string; price: string; minutes: number; staff: string[]; group: string; chosen?: boolean }[];
  request: { label: string; value: string | null; note?: string }[];
  /** The signature panel's extra facts: deposit and add-on (salon), intake and coverage (clinic). */
  extras: { title: string; rows: { label: string; value: string; tone?: "good" | "warn" }[] } | null;
  appointments: { id: string; status: "booked" | "cancelled"; service: string; when: string; staff: string; name: string; changes: number }[];
  messages: { id: string; name: string; summary: string }[];
  emailed?: { to: string; reference: string } | null;
}

/** One field of the matter record: typed in (text, date), picked from a menu (select), toggled (chips, toggle). */
export interface RecordField {
  key: string;
  label: string;
  kind: "text" | "select" | "date" | "chips" | "toggle";
  value: string | string[] | null;
  options: string[];
  wide: boolean;
}

/** Alder & Finch Injury Law: a new matter opened and filled in while the call runs, then reviewed, tasked and (maybe) booked. */
export interface LawFirmView {
  timeZone: string;
  record: {
    opened: boolean;
    number: string | null;
    title: string | null;
    stage: "new" | "conflict" | "qualified" | "consult" | "declined";
    sections: { id: string; title: string; fields: RecordField[] }[];
  };
  conflict: { status: "clear" | "conflict"; checked: string[] } | null;
  assessment: { outcome: "qualified" | "declined"; tier: "A" | "B" | "C" | null; reason: string | null; points: string[]; flags: string[]; deadline: string | null } | null;
  /** The call summary the firm's system would hold on the matter, written from the records. */
  note: string | null;
  tasks: { title: string; who: string; due: string }[];
  /** Openings the agent just found for the free consultation. */
  openTimes: { slotId: string; day: string; time: string; attorney: string }[];
  consults: { id: string; status: "booked" | "cancelled"; day: string; time: string; attorney: string; format: string; name: string; changes: number }[];
  messages: { id: string; name: string; summary: string; preferredTime?: string | null; urgent?: boolean }[];
  /** Every call since the last brief, best cases first; this call is the one marked `mine`. */
  brief: { rows: { who: string; summary: string; tier: "A" | "B" | "C" | null; mine: boolean; declined: boolean }[] } | null;
  emailed?: { to: string; reference: string } | null;
}

export type DemoView = NorthlineView | FormFieldView | TravelView | AppointmentView | LawFirmView | HotelsView;
