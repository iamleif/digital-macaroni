import { formfieldEmpty, formfieldSample, northlineEmpty, northlineSample, travelEmpty, travelSample } from "../live/sample-views";
import type { DemoEvent, DemoId, FormFieldView, NorthlineView, TravelView } from "../live/types";

/**
 * Sample calls for reviewing the demo pages without phoning in (`?replay`). Each is a timeline of the
 * same events the voice service sends, built from the sample records, and the page labels it as a
 * replay. Nothing here reaches the voice service.
 */
type Step = { at: number; event: DemoEvent };

function timeline(events: (DemoEvent | number)[]): Step[] {
  // Numbers are pauses in ms before the next event; each event otherwise follows 900 ms after the last.
  const out: Step[] = [];
  let t = 600;
  let pause = 0;
  for (const e of events) {
    if (typeof e === "number") { pause = e; continue; }
    t += pause || 900;
    pause = 0;
    out.push({ at: t, event: e });
  }
  return out;
}

let v = 0;
const say = (speaker: "visitor" | "agent", text: string, id = `t${++v}`): DemoEvent => ({ type: "transcript", id, speaker, text, final: true });
const tool = (callId: string, name: string, label: string): DemoEvent => ({ type: "tool.started", callId, tool: name, label });
const ok = (callId: string, name: string, label: string, summary: string): DemoEvent => ({ type: "tool.succeeded", callId, tool: name, label, summary, version: 0 });
const state = (version: number, s: NorthlineView | FormFieldView | TravelView): DemoEvent => ({ type: "state", version, state: s });
const speaking = (on: boolean): DemoEvent => ({ type: "agent.speaking", speaking: on });

const nlRequest = (patch: Partial<NorthlineView["request"]>): NorthlineView => ({ ...northlineEmpty, request: { ...northlineEmpty.request, ...patch } });
const nlOpen: NorthlineView = {
  ...nlRequest({ service: "Heating repair", issue: "Furnace stopped heating", name: "Alex Taylor", address: "48 Birch Lane, Seattle", proposed: { day: "Tomorrow", window: "2–4 PM" } }),
  open: [{ techId: "maya", hour: 14 }, { techId: "maya", hour: 16 }, { techId: "jordan", hour: 10 }],
  proposed: 14,
};

const northline = timeline([
  { type: "session.ready", sessionId: "replay", demo: "northline", channel: "phone" },
  { type: "pairing.linked" },
  speaking(true),
  say("agent", "Thanks for calling Northline Home Services, this is Ellie. How can I help today?"),
  speaking(false),
  1600,
  say("visitor", "Hi, my furnace stopped working. Can someone look at it tomorrow afternoon?"),
  tool("c1", "note_request_details", "Fill in the service request"),
  600,
  ok("c1", "note_request_details", "Fill in the service request", "Heating repair · furnace stopped heating"),
  state(1, nlRequest({ service: "Heating repair", issue: "Furnace stopped heating" })),
  speaking(true),
  say("agent", "I’m sorry to hear that. Can I get your name and the address for the visit?"),
  speaking(false),
  1500,
  say("visitor", "Alex Taylor, 48 Birch Lane, Seattle."),
  state(2, nlRequest({ service: "Heating repair", issue: "Furnace stopped heating", name: "Alex Taylor", address: "48 Birch Lane, Seattle" })),
  tool("c2", "check_availability", "Check the schedule"),
  700,
  ok("c2", "check_availability", "Check the schedule", "3 open windows · Maya free 2–4 PM tomorrow"),
  state(3, nlOpen),
  speaking(true),
  say("agent", "Maya can be there tomorrow between 2 and 4. Just to confirm: a heating repair at 48 Birch Lane, Seattle, tomorrow 2 to 4 PM. Shall I book it?"),
  speaking(false),
  1800,
  say("visitor", "Yes, please."),
  tool("c3", "book_appointment", "Book a visit"),
  800,
  ok("c3", "book_appointment", "Book a visit", "Booked NL-345 · Maya · tomorrow 2–4 PM"),
  state(4, { ...northlineSample, open: [] }),
  speaking(true),
  say("agent", "You’re all set. Your reference is N L 3 4 5, and Maya will call ahead when she’s on her way. Anything else?"),
  speaking(false),
  1500,
  say("visitor", "Could you email me the confirmation?"),
  tool("c4", "email_confirmation", "Emailing the confirmation"),
  700,
  ok("c4", "email_confirmation", "Emailing the confirmation", "Confirmation emailed · a•••r@example.com"),
  state(5, { ...northlineSample, open: [], emailed: { to: "a•••r@example.com", reference: "NL-345" } }),
  speaking(true),
  say("agent", "Sent. Thanks for calling Northline. Stay warm!"),
  speaking(false),
  { type: "session.ended", reason: "agent_ended" },
]);

const lamp = formfieldSample.shown[0]!;
const ffFound: FormFieldView = { ...formfieldEmpty, shown: [{ ...lamp, focus: false, materials: undefined, size: undefined }, formfieldSample.shown[1]!] };
const ffFocus: FormFieldView = { ...ffFound, shown: [{ ...lamp, description: "A ribbed ceramic table lamp with a soft linen drum shade. Warm, even light for a side table or desk." }, formfieldSample.shown[1]!] };

const formfield = timeline([
  { type: "session.ready", sessionId: "replay", demo: "formfield", channel: "phone" },
  { type: "pairing.linked" },
  speaking(true),
  say("agent", "Thanks for calling Form & Field, this is Theo. What can I help you find?"),
  speaking(false),
  1600,
  say("visitor", "I’m looking for a green table lamp under a hundred dollars."),
  tool("c1", "search_products", "Search the catalogue"),
  700,
  ok("c1", "search_products", "Search the catalogue", "2 green lamps found · one under $100"),
  state(1, ffFound),
  speaking(true),
  say("agent", "The Ridge Table Lamp comes in sage green for 89 dollars, and there’s one left in that colour. Would you like to hear more about it?"),
  speaking(false),
  1500,
  say("visitor", "What’s it made of?"),
  tool("c2", "get_product_details", "Check product details"),
  600,
  ok("c2", "get_product_details", "Check product details", "Ridge Table Lamp · glazed stoneware, linen shade"),
  state(2, ffFocus),
  speaking(true),
  say("agent", "It has a glazed stoneware base with a linen shade, and it stands 18 inches tall."),
  speaking(false),
  1500,
  say("visitor", "Lovely. Can you hold two for me? I’m Sam Rivera."),
  tool("c3", "reserve_item", "Reserve for pickup"),
  800,
  ok("c3", "reserve_item", "Reserve for pickup", "Held FF-801 · 2 × Ridge Table Lamp, sage green"),
  state(3, { ...formfieldSample, shown: ffFocus.shown }),
  speaking(true),
  say("agent", "Done. Two Ridge Table Lamps in sage green are held for you until closing Monday, reference F F 8 0 1. You’ll pay in store."),
  speaking(false),
  1400,
  say("visitor", "Perfect. Can you email me the reservation?"),
  tool("c4", "email_reservation", "Emailing the reservation"),
  700,
  ok("c4", "email_reservation", "Emailing the reservation", "Reservation emailed · s•••m@example.com"),
  state(4, { ...formfieldSample, shown: ffFocus.shown, emailed: { to: "s•••m@example.com", reference: "FF-801" } }),
  speaking(true),
  say("agent", "Sent. Thanks for calling Form & Field, Sam. See you soon!"),
  speaking(false),
  { type: "session.ended", reason: "agent_ended" },
]);

const tv = (patch: Partial<TravelView>): TravelView => ({ ...travelEmpty, ...patch });
const tSearch = tv({ stage: "options", search: travelSample.search });
const tFound = { ...tSearch, options: travelSample.options };
const tFare = { ...tFound, stage: "fare" as const, selected: 1, details: travelSample.details, fareLevels: travelSample.fareLevels, bags: { ...travelSample.bags!, added: 0, total: null } };
const tSeats = { ...tFare, stage: "seat" as const, seatMap: travelSample.seatMap };
const tSeat = { ...tSeats, seat: travelSample.seat };
const tBags = { ...tSeat, stage: "bags" as const, bags: travelSample.bags };
const tTraveller = { ...tBags, stage: "traveller" as const, traveller: travelSample.traveller };
const tReview = { ...tTraveller, stage: "review" as const, review: travelSample.review, readBack: travelSample.readBack };
const tPayment = { ...tReview, stage: "payment" as const, booking: travelSample.booking };
const tEmailed = { ...tPayment, emailed: { to: "a•••r@example.com", total: "$472" } };

const travel = timeline([
  { type: "session.ready", sessionId: "replay", demo: "travel", channel: "phone" },
  { type: "pairing.linked" },
  speaking(true),
  say("agent", "Thanks for calling Waypoint Travel, this is Linda. Where are you hoping to fly?"),
  speaking(false),
  1600,
  say("visitor", "London to New York on November 20th, back a week later. Just me."),
  tool("c1", "find_places", "Looking up airports"),
  500,
  ok("c1", "find_places", "Looking up airports", "London (LON) · New York (NYC)"),
  state(1, tSearch),
  tool("c2", "search_flights", "Searching flights"),
  1600,
  ok("c2", "search_flights", "Searching flights", "3 best of 42 fares"),
  state(2, tFound),
  speaking(true),
  say("agent", "The best value is Duffel Airways, nonstop at 8:20 in the morning, for 389 dollars return. Iberia is 372 with a stop in Madrid, or Virgin Atlantic is fastest at 426. Which would you like?"),
  speaking(false),
  1600,
  say("visitor", "The Duffel Airways one."),
  tool("c3", "choose_flight", "Checking the fare"),
  800,
  ok("c3", "choose_flight", "Checking the fare", "Duffel Airways · Economy Basic · $389"),
  state(3, tFare),
  speaking(true),
  say("agent", "That’s Economy Basic: a carry-on, no checked bag, and changes are 70 dollars. For 40 more, Economy Standard adds a checked bag and free changes. Shall I keep Basic?"),
  speaking(false),
  1500,
  say("visitor", "Basic is fine. Can I get a window seat?"),
  tool("c4", "get_seats", "Opening the seat map"),
  900,
  ok("c4", "get_seats", "Opening the seat map", "121 seats open"),
  state(4, tSeats),
  2200,
  tool("c5", "choose_seat", "Choosing a seat"),
  600,
  ok("c5", "choose_seat", "Choosing a seat", "Seat 11A · window · $18"),
  state(5, tSeat),
  speaking(true),
  say("agent", "I’ve got you 11A, a window just ahead of the wing, for 18 dollars. Would you like to add a checked bag? It’s 65 dollars."),
  speaking(false),
  1600,
  say("visitor", "Yes, one bag please."),
  tool("c6", "add_bags", "Adding bags"),
  600,
  ok("c6", "add_bags", "Adding bags", "1 extra bag · $65"),
  state(6, tBags),
  speaking(true),
  say("agent", "Done. And the lead traveller’s full name?"),
  speaking(false),
  1400,
  say("visitor", "Alex Taylor."),
  tool("c7", "set_traveller", "Adding the traveller"),
  500,
  ok("c7", "set_traveller", "Adding the traveller", "Traveller · Alex Taylor"),
  state(7, tTraveller),
  2600,
  tool("c8", "review_booking", "Reviewing the booking"),
  900,
  ok("c8", "review_booking", "Reviewing the booking", "Review · total $472"),
  state(8, tReview),
  speaking(true),
  say("agent", "Here’s everything: Duffel Airways, out Friday November 20th at 8:20 from Heathrow, back the 27th. Seat 11A, one extra bag, for Alex Taylor. The total is 472 dollars. Is that all correct?"),
  speaking(false),
  1600,
  say("visitor", "Yes, that’s right."),
  tool("c9", "book_flight", "Taking payment"),
  700,
  { type: "tool.failed", callId: "c9", tool: "book_flight", label: "Taking payment", summary: "Stopped at payment · test mode" },
  state(9, tPayment),
  speaking(true),
  say("agent", "Everything’s ready. This is where I’d take payment, but I’m in test mode, so I can’t book this for you right now. Would you like the itinerary by email?"),
  speaking(false),
  1500,
  say("visitor", "Sure, send it over."),
  tool("c10", "email_itinerary", "Emailing the itinerary"),
  800,
  ok("c10", "email_itinerary", "Emailing the itinerary", "Itinerary emailed to a•••r@example.com"),
  state(10, tEmailed),
  speaking(true),
  say("agent", "Sent. Anything else I can help with?"),
  speaking(false),
  { type: "session.ended", reason: "agent_ended" },
]);

export const REPLAYS: Record<DemoId, Step[]> = { northline, formfield, travel };
