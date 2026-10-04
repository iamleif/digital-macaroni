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
  ...nlRequest({ service: "Heating repair", issue: "Furnace stopped heating", name: "Alex Taylor", address: "48 Birch Lane", proposed: { day: "Tomorrow", window: "2–4 PM" } }),
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
  say("visitor", "Alex Taylor, 48 Birch Lane."),
  state(2, nlRequest({ service: "Heating repair", issue: "Furnace stopped heating", name: "Alex Taylor", address: "48 Birch Lane" })),
  tool("c2", "check_availability", "Check the schedule"),
  700,
  ok("c2", "check_availability", "Check the schedule", "3 open windows · Maya free 2–4 PM tomorrow"),
  state(3, nlOpen),
  speaking(true),
  say("agent", "Maya can be there tomorrow between 2 and 4. Just to confirm: a heating repair at 48 Birch Lane, tomorrow 2 to 4 PM. Shall I book it?"),
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
  say("visitor", "No, that’s everything. Thanks!"),
  say("agent", "Thanks for calling Northline. Stay warm!"),
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
  say("visitor", "Perfect, thank you."),
  say("agent", "Thanks for calling Form & Field, Sam. See you soon!"),
  { type: "session.ended", reason: "agent_ended" },
]);

const travelSearch: TravelView = { ...travelEmpty, search: travelSample.search };
const travelFound: TravelView = { ...travelSearch, options: travelSample.options };
const travelChecked: TravelView = { ...travelFound, selected: 1, details: travelSample.details };
const travelReadBack: TravelView = { ...travelChecked, readBack: { option: 1, travellerName: "Alex Taylor", price: "$389" } };

const travel = timeline([
  { type: "session.ready", sessionId: "replay", demo: "travel", channel: "phone" },
  { type: "pairing.linked" },
  speaking(true),
  say("agent", "Hi, this is Linda at Waypoint Travel. Where would you like to go?"),
  speaking(false),
  1600,
  say("visitor", "I’d like to fly from London to New York on November 20th, coming back a week later. Just me."),
  tool("c1", "find_places", "Look up airports"),
  500,
  ok("c1", "find_places", "Look up airports", "London (LON) · New York (NYC)"),
  state(1, travelSearch),
  tool("c2", "search_flights", "Search airline fares"),
  1400,
  ok("c2", "search_flights", "Search airline fares", "3 round trips · from $389"),
  state(2, travelFound),
  speaking(true),
  say("agent", "I found three options. The cheapest is British Airways, nonstop, for 389 dollars return. Iberia is 402 with a stop in Madrid, and Virgin Atlantic is 426 nonstop."),
  speaking(false),
  1600,
  say("visitor", "Tell me more about the British Airways one."),
  tool("c3", "get_offer_details", "Check a fare’s rules and bags"),
  800,
  ok("c3", "get_offer_details", "Check a fare’s rules and bags", "$389 unchanged · not refundable · 1 checked bag"),
  state(3, travelChecked),
  speaking(true),
  say("agent", "It’s Economy Basic: one checked bag and a carry-on, not refundable, and changes are 70 dollars. Would you like to book it?"),
  speaking(false),
  1400,
  say("visitor", "Yes, let’s book it. Alex Taylor."),
  state(4, travelReadBack),
  say("agent", "Option 1, British Airways, for Alex Taylor at 389 dollars. Shall I go ahead?"),
  1200,
  say("visitor", "Go ahead."),
  tool("c4", "book_flight", "Book a flight (stops in test mode)"),
  900,
  ok("c4", "book_flight", "Book a flight (stops in test mode)", "Stopped before payment · test mode"),
  state(5, travelSample),
  speaking(true),
  say("agent", "This demo stops right before payment, so nothing has been booked or charged. In a real agency, your ticket would be issued now."),
  speaking(false),
  { type: "session.ended", reason: "agent_ended" },
]);

export const REPLAYS: Record<DemoId, Step[]> = { northline, formfield, travel };
