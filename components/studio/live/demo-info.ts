import type { DemoId } from "./types";

/** How the agent is built, as the live demo page explains it. Keep in step with the agent's real configuration. */
export interface AgentDesign {
  /** Short platform badge beside the demo's name. */
  platform: string;
  /** What hears, thinks and speaks. */
  stack: { role: string; value: string }[];
  /** The tools the agent has been given, as the voice service names them. */
  tools: { name: string; label: string }[];
  /** Rules the agent works within; each is enforced by its instructions and the service's tools. */
  rules: string[];
  /** Short "built with" line: platform, reasoning model, voice. Falls back to the platform badge. */
  builtWith?: string[];
  /** End-of-call summary lines: successful uses of these tools, counted ("{n}" is replaced). */
  outcomes?: { tools: string[]; one: string; many: string }[];
  /** Tools that hand work to people; none used means the call needed no staff. */
  handoffTools?: string[];
}

const sharedTools = [
  { name: "get_caller_number", label: "Read caller ID" },
  { name: "link_screen", label: "Link a call to this screen" },
  { name: "end_call", label: "End the call" },
];

export interface DemoInfo {
  id: DemoId;
  name: string;
  role: string;
  agentName: string;
  phone: string;
  phoneDisplay: string;
  intro: string;
  /** Meta description when the intro runs past what search results show. */
  seoDescription?: string;
  prompts: string[];
  sampleDetails: string;
  /** Sample details to use on the call, shown in their own box so they are easy to find. */
  sampleCard?: { title: string; items: { label: string; value: string }[] };
  design: AgentDesign;
}

/** The demos as the website presents them. Shared by the homepage cards and the live demo pages. */
export const voiceDemos: Record<DemoId, DemoInfo> = {
  northline: {
    id: "northline",
    name: "Northline",
    role: "Home services booking",
    agentName: "Ellie",
    phone: "+12068879619",
    phoneDisplay: "(206) 887-9619",
    intro: "Talk to Ellie, Northline’s booking assistant. Book a heating or cooling visit, change it, or leave a message, and watch the schedule change as she works.",
    prompts: ["Can someone look at my furnace tomorrow afternoon?", "Actually, can we make it a bit later?", "Could someone call me back instead?"],
    sampleDetails: "Use any name and address you like. Northline, its technicians and its schedule are fictional; nobody will visit.",
    design: {
      platform: "Gemini Live",
      stack: [{ role: "All three", value: "Google Gemini Live hears, thinks and speaks in one speech-to-speech model: no separate transcription or voice step" }],
      tools: [
        { name: "get_business_info", label: "Look up services and fees" },
        { name: "note_request_details", label: "Fill in the service request" },
        { name: "check_availability", label: "Check the schedule" },
        { name: "book_appointment", label: "Book a visit" },
        { name: "reschedule_appointment", label: "Move a visit" },
        { name: "cancel_appointment", label: "Cancel a visit" },
        { name: "take_message", label: "Leave a message for the team" },
        { name: "email_confirmation", label: "Email the confirmation" },
        ...sharedTools,
      ],
      builtWith: ["Google Gemini Live", "one speech-to-speech model"],
      outcomes: [
        { tools: ["check_availability"], one: "Checked the schedule", many: "Checked the schedule {n} times" },
        { tools: ["book_appointment"], one: "Booked a visit", many: "Booked {n} visits" },
        { tools: ["reschedule_appointment"], one: "Moved the visit", many: "Moved the visit {n} times" },
        { tools: ["cancel_appointment"], one: "Cancelled a visit", many: "Cancelled {n} visits" },
        { tools: ["take_message"], one: "Left a message for the team", many: "Left {n} messages for the team" },
        { tools: ["email_confirmation"], one: "Emailed the confirmation", many: "Emailed the confirmation" },
      ],
      handoffTools: ["take_message"],
      rules: [
        "Offers only times the live schedule returns",
        "Reads the details back and waits for a yes before booking or changing",
        "Moves the same visit rather than double-booking",
        "For gas, sparking or flooding near electrics: leave and call 911 first",
      ],
    },
  },
  formfield: {
    id: "formfield",
    name: "Form & Field",
    role: "Shop assistant",
    agentName: "Theo",
    phone: "+18302392110",
    phoneDisplay: "(830) 239-2110",
    intro: "Talk to Theo, Form & Field’s shop assistant. Describe what you’re after, ask about the details, and reserve something for pickup while the shop’s stock updates.",
    prompts: ["I’m looking for a green table lamp under a hundred dollars.", "What’s it made of?", "Can you hold one for me to pick up?", "Where’s my order? It’s 1042, emilia@example.com."],
    sampleDetails: "Form & Field is a fictional shop. Nothing is charged, sold or shipped. For order help, use order 1042 with emilia@example.com.",
    sampleCard: { title: "Checking on an order? Use these", items: [{ label: "Order number", value: "1042" }, { label: "Email", value: "emilia@example.com" }] },
    design: {
      platform: "ElevenLabs Agents",
      stack: [
        { role: "Hears", value: "ElevenLabs Scribe Realtime" },
        { role: "Thinks", value: "Gemini 3.7 Flash, run by ElevenLabs" },
        { role: "Speaks", value: "Eleven v4 Turbo voice" },
      ],
      tools: [
        { name: "search_products", label: "Search the catalogue" },
        { name: "get_product_details", label: "Check product details" },
        { name: "reserve_item", label: "Reserve for pickup" },
        { name: "update_reservation", label: "Change a reservation" },
        { name: "cancel_reservation", label: "Cancel a reservation" },
        { name: "lookup_order", label: "Look up an order" },
        { name: "create_support_request", label: "Open a support request" },
        { name: "take_message", label: "Leave a message for the team" },
        { name: "email_reservation", label: "Email the reservation" },
        ...sharedTools,
      ],
      builtWith: ["ElevenLabs Agents", "Gemini 3.7 Flash", "Eleven v4 voice"],
      outcomes: [
        { tools: ["search_products", "get_product_details"], one: "Looked up the catalogue", many: "Looked up the catalogue {n} times" },
        { tools: ["reserve_item"], one: "Reserved an item for pickup", many: "Made {n} pickup reservations" },
        { tools: ["update_reservation", "cancel_reservation"], one: "Changed a reservation", many: "Changed reservations {n} times" },
        { tools: ["lookup_order"], one: "Found an order", many: "Looked up {n} orders" },
        { tools: ["create_support_request"], one: "Opened a support request", many: "Opened {n} support requests" },
        { tools: ["take_message"], one: "Left a message for the team", many: "Left {n} messages for the team" },
        { tools: ["email_reservation"], one: "Emailed the reservation", many: "Emailed the reservation" },
      ],
      handoffTools: ["take_message", "create_support_request"],
      rules: [
        "Quotes only prices and stock the catalogue returns",
        "Reads every reservation or change back and waits for a yes",
        "Discusses an order only after its number and email both match",
        "Never takes payment or promises a refund: items are paid in store",
      ],
    },
  },
  travel: {
    id: "travel",
    name: "Waypoint Travel",
    role: "Flight search & booking",
    agentName: "Linda",
    phone: "+17205996395",
    phoneDisplay: "(720) 599-6395",
    seoDescription: "Talk to Linda, Waypoint Travel’s agent. She searches live airline fares and books the trip with you, fare, seat and bags, right up to payment.",
    intro: "Talk to Linda, Waypoint Travel’s agent. Tell her where and when you’d like to fly: she searches live airline fares, then books it like a travel agent: fare, seat, bags and traveller, right up to payment.",
    prompts: ["I’d like to fly from London to New York next Friday.", "Just me, coming back a week later.", "The first one. A window seat, please.", "Add one checked bag."],
    sampleDetails: "Waypoint Travel is fictional. Fares come from an airline booking system’s test environment, so prices are illustrative and nothing is ever booked or charged. Any name will do, such as Alex Taylor.",
    design: {
      platform: "Google ADK",
      stack: [
        { role: "Hears", value: "Gemini 3.5 Transcribe Live" },
        { role: "Thinks", value: "Gemini 3.5 Flash-Lite, run through Google’s Agent Development Kit" },
        { role: "Speaks", value: "Gemini 3.8 Flash TTS, a voice designed for Linda" },
      ],
      tools: [
        { name: "find_places", label: "Look up airports" },
        { name: "search_flights", label: "Search airline fares" },
        { name: "choose_flight", label: "Price a flight and its fare levels" },
        { name: "choose_fare", label: "Switch fare level" },
        { name: "get_seats", label: "Open the seat map" },
        { name: "choose_seat", label: "Choose a seat" },
        { name: "add_bags", label: "Add checked bags" },
        { name: "set_traveller", label: "Add the traveller" },
        { name: "review_booking", label: "Re-check the price and review" },
        { name: "book_flight", label: "Book (stops at payment in test mode)" },
        { name: "email_itinerary", label: "Email the itinerary" },
        ...sharedTools,
      ],
      rules: [
        "Quotes only flights and prices the airline search returns",
        "Re-checks the fare and reads the booking back before going ahead",
        "Never books, holds or charges: the demo stops before payment",
        "Never asks for passport, date of birth or card details",
      ],
    },
  },
};

export const demoPath = (id: DemoId) => `/demo/${id}/`;
