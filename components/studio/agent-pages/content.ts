import type { DemoId } from "../live/types";

/**
 * Architecture pages, one per demo. The demos are examples of three ways to build a voice agent, not
 * products for sale: Northline, Form & Field and Waypoint are fictional, and the same architectures
 * work for any kind of business. Name the real components; keep prompts and internals out.
 * Keep the stack in step with voice/app/config.py.
 */
export type ArchitectureId = "bidirectional" | "platform" | "cascade";

/** Logos in public/studio/logos (see README there). Marks are square; shown with the company name beside them. */
export const LOGOS: Record<string, { name: string; src: string; mono?: boolean }> = {
  gemini: { name: "Google Gemini", src: "/studio/logos/gemini.svg" },
  google: { name: "Google ADK", src: "/studio/logos/google.svg" },
  "google-cloud": { name: "Google Cloud", src: "/studio/logos/google-cloud.svg" },
  elevenlabs: { name: "ElevenLabs", src: "/studio/logos/elevenlabs.svg" },
  assemblyai: { name: "AssemblyAI", src: "/studio/logos/assemblyai.svg" },
  twilio: { name: "Twilio", src: "/studio/logos/twilio.svg" },
  telnyx: { name: "Telnyx", src: "/studio/logos/telnyx.png", mono: true },
  resend: { name: "Resend", src: "/studio/logos/resend.svg" },
  duffel: { name: "Duffel", src: "/studio/logos/duffel.svg" },
};
export type LogoId = "gemini" | "google" | "google-cloud" | "elevenlabs" | "assemblyai" | "twilio" | "telnyx" | "resend" | "duffel";

export interface StackPart {
  role: string;
  name: string;
  note: string;
  logo?: LogoId;
}

export interface ArchitectureStory {
  /** URL slug: the architecture's searchable name, not the fictional business. */
  slug: string;
  /** Page title for search results and AI answers. */
  seoTitle: string;
  demo: DemoId;
  tone: "blue" | "sage" | "sand";
  architecture: ArchitectureId;
  /** The phone carrier in front of the call service. */
  carrier: "twilio" | "telnyx";
  /** Subject and possessive pronouns for the demo agent. */
  pronouns: [string, string];
  headline: string;
  lede: string;
  /** The engine in the diagram: one block, a platform frame, or a chain. */
  engine: { label: string; logo: LogoId; parts: { role: string; name: string; logo?: LogoId }[] };
  stack: StackPart[];
  strengths: { title: string; copy: string }[];
  /** What the demo shows on a call, in the caller's order. */
  steps: { title: string; copy: string }[];
  tradeOffs: string[];
  /** Other kinds of business the same architecture suits, with what the agent would do there. */
  businesses: { intro: string; list: { name: string; idea: string; icon: string }[] };
  description: string;
}

export const ARCHITECTURES: Record<ArchitectureId, { name: string; also: string; short: string; guide: string }> = {
  bidirectional: { name: "Single bidirectional model", also: "Speech-to-speech", short: "One model streams audio both ways: it hears, reasons, calls tools and speaks in one live session.", guide: "A single model takes the caller’s audio in and sends audio back out, reasoning and calling tools in between, all in one live session. Nothing is handed from one model to another, which is why it replies fastest and handles interruptions most naturally." },
  platform: { name: "Managed voice platform", also: "Voice platform", short: "A voice platform runs the real-time conversation; the tools and the data stay on our own server.", guide: "A voice platform runs the real-time conversation: it transcribes the caller, runs the reasoning model you choose and speaks the reply in one of its voices. When the agent needs the business’s data, the platform calls back to your own server, so the data and the records stay with you." },
  cascade: { name: "Cascade: hear, think, speak", also: "STT → LLM → TTS", short: "Three specialist models in a row, with turn-taking and timing handled by our own code.", guide: "Three separate models work in a row: speech-to-text writes down what the caller said, a language model decides what to do and calls tools, and text-to-speech says the reply. Your own code decides when each turn starts and ends. It’s a little slower, but each part can be chosen for its job and swapped on its own." },
};

export const CARRIERS: Record<ArchitectureStory["carrier"], StackPart> = {
  twilio: { role: "Phone line", name: "Twilio Programmable Voice", logo: "twilio", note: "Answers the number and streams the call audio both ways in real time." },
  telnyx: { role: "Phone line", name: "Telnyx Voice API", logo: "telnyx", note: "Answers the number and streams the call audio both ways in real time." },
};

/** What every demo shares behind the phone line. Only the engine differs. */
export const CALL_SERVICE: StackPart[] = [
  { role: "Call service", name: "Our own service on Google Cloud Run", logo: "google-cloud", note: "Bridges the call to the engine, runs the tools, keeps the records and pairs the call with the live screen." },
  { role: "Confirmations", name: "Resend", logo: "resend", note: "Sends the confirmation email from fixed templates, with limits so a public line can’t be misused." },
];

/** The demo's whole stack: engine and backend, then the way in. */
export const stackOf = (story: ArchitectureStory) => [...story.stack, CARRIERS[story.carrier], ...CALL_SERVICE];

export const STORIES: ArchitectureStory[] = [
  {
    slug: "speech-to-speech",
    seoTitle: "Speech-to-speech voice agent architecture: one bidirectional model (Gemini 3.8 Live)",
    demo: "northline",
    tone: "blue",
    architecture: "bidirectional",
    carrier: "twilio",
    pronouns: ["she", "her"],
    headline: "One model, streaming both ways.",
    lede: "Northline is our home-services example. We built Ellie to show how a voice agent can book, move and cancel service visits from a live schedule, quote fees, handle a caller who changes their mind, and take a message when nothing fits. She runs on a single bidirectional, speech-to-speech model, Google’s Gemini 3.8 Live, which hears the caller, reasons, calls tools and answers out loud in one continuous stream.",
    engine: { label: "Gemini 3.8 Live", logo: "gemini", parts: [{ role: "Hears", name: "native audio in" }, { role: "Thinks", name: "and calls tools" }, { role: "Speaks", name: "native audio out" }] },
    stack: [
      { role: "Hears, thinks and speaks", name: "Google Gemini 3.8 Live", logo: "gemini", note: "A native-audio model: sound goes in and sound comes out, with no separate transcription or voice step." },
      { role: "Agent framework", name: "Google Agent Development Kit (ADK)", logo: "google", note: "Defines the agent and its tools once, and runs the live session." },
      { role: "Backend", name: "The Northline demo backend", note: "Schedule, services and fees, bookings and messages. Fictional data, real logic." },
    ],
    strengths: [
      { title: "Lowest delay", copy: "Audio streams in and out over one live connection. Nothing is handed from a transcriber to a reasoning model to a voice, so replies start almost as soon as the caller stops." },
      { title: "Natural interruptions", copy: "The caller can cut in mid-sentence. The model hears it, stops, and picks up from what was actually said, the way a person would." },
      { title: "Hears the voice, not a transcript", copy: "Because it listens to the audio itself, it picks up tone and hesitation as well as words, so a worried caller gets a calmer answer." },
      { title: "Tool calls during the conversation, sync or async", copy: "Gemini 3.8 Live can call backend tools while the stream keeps flowing. Each tool is set to wait for its result or run in the background. Ellie’s booking tools wait, so she never says “booked” before the system has booked it; ending the call runs in the background after the goodbye." },
    ],
    steps: [
      { title: "Understands the problem", copy: "What’s wrong, where, and how soon. If it sounds dangerous, safety comes first." },
      { title: "Checks the real schedule", copy: "Only times the schedule actually returns. No guessing, no double-booking." },
      { title: "Reads it back", copy: "Day, time, address and fee, and she waits for a yes." },
      { title: "Calls the tool", copy: "Books, moves or cancels the visit, or leaves a message for the team." },
      { title: "Confirms it", copy: "The schedule updates on screen and a confirmation can go out by email." },
    ],
    tradeOffs: [
      "Voices come from the model’s built-in set rather than a voice designed from scratch.",
      "Less control over exact wording than when a separate text model writes every reply.",
      "Hearing, reasoning and speech all come from one provider.",
    ],
    businesses: {
      intro: "Ellie answers for a home-services company, but the same build suits any phone line where callers interrupt, change their minds and want something booked. A few ideas:",
      list: [
        { name: "Plumbing, HVAC and electrical", idea: "Books repair visits from the live schedule and flags emergencies to the on-call tech.", icon: "Wrench" },
        { name: "Roofing and contractors", idea: "Qualifies storm-damage and quote calls and books the inspection.", icon: "HardHat" },
        { name: "Dental and medical clinics", idea: "Books, moves and confirms appointments, and takes messages for the front desk.", icon: "Tooth" },
        { name: "Salons, spas and barbers", idea: "Books the right service with the right person and fills last-minute cancellations.", icon: "Scissors" },
        { name: "Restaurants", idea: "Takes reservations, answers hours and menu questions, and passes on large-party requests.", icon: "ForkKnife" },
        { name: "Auto repair shops", idea: "Books service slots, explains drop-off and answers “is my car ready?” calls.", icon: "Garage" },
        { name: "Property management", idea: "Logs maintenance requests and puts urgent ones straight through.", icon: "Buildings" },
        { name: "Veterinary clinics", idea: "Books visits and sends “is this urgent?” calls to the team right away.", icon: "PawPrint" },
        { name: "Gyms and fitness studios", idea: "Books classes and intro sessions and answers membership questions.", icon: "Barbell" },
      ],
    },
    description: "A speech-to-speech voice agent architecture, shown in our Northline demo: a single bidirectional model (Google Gemini 3.8 Live) that hears, reasons, calls tools and speaks in one live stream.",
  },
  {
    slug: "managed-voice-platform",
    seoTitle: "Managed voice platform architecture for AI voice agents (ElevenLabs Agents)",
    demo: "formfield",
    tone: "sage",
    architecture: "platform",
    carrier: "twilio",
    pronouns: ["he", "his"],
    headline: "A voice platform in front, our tools behind.",
    lede: "Form & Field is our retail example. We built Theo to show how a voice agent can answer product questions, check live stock, reserve items for pickup, look up orders and open support requests. He runs on a managed voice platform, ElevenLabs Agents, which handles the real-time conversation while the catalogue, stock and orders stay on our own server.",
    engine: { label: "ElevenLabs Agents", logo: "elevenlabs", parts: [{ role: "Hears", name: "Scribe Realtime", logo: "elevenlabs" }, { role: "Thinks", name: "Gemini 3.7 Flash", logo: "gemini" }, { role: "Speaks", name: "Eleven v4 Turbo", logo: "elevenlabs" }] },
    stack: [
      { role: "Hears", name: "ElevenLabs Scribe Realtime", logo: "elevenlabs", note: "Streaming speech recognition, run by the platform." },
      { role: "Thinks", name: "Google Gemini 3.7 Flash", logo: "gemini", note: "The reasoning model, chosen by us and run by the platform." },
      { role: "Speaks", name: "ElevenLabs Eleven v4 Turbo", logo: "elevenlabs", note: "A premium, natural voice from the platform’s library." },
      { role: "Backend", name: "The Form & Field demo backend", note: "Catalogue, stock levels, reservations, orders and support requests." },
    ],
    strengths: [
      { title: "The real-time loop is handled", copy: "Listening, turn-taking, interruptions and the voice are the platform’s job. That’s the hardest part to get right, and it’s proven at scale." },
      { title: "Pick the brain", copy: "The platform runs the reasoning model you choose. Here that’s Gemini 3.7 Flash, and it can be swapped without rebuilding the agent." },
      { title: "Tools run on our side", copy: "When Theo needs stock or an order, the platform sends the tool call back to our service over the same connection. The business’s data never has to live on the platform, and the records and dashboard stay ours." },
      { title: "Easy to own and hand over", copy: "The agent can sit in the business’s own platform account, and the setup is familiar to other developers. Nobody is locked in." },
    ],
    steps: [
      { title: "Finds the right piece", copy: "Searches the catalogue from a description, a budget or a style." },
      { title: "Answers the details", copy: "Materials, sizes and prices straight from the product listing." },
      { title: "Checks real stock", copy: "Only reserves what the shop actually has." },
      { title: "Reserves or looks up", copy: "Holds an item for pickup, or finds an order once its number and email match." },
      { title: "Confirms it", copy: "The shop’s screen updates and the reservation can go out by email." },
    ],
    tradeOffs: [
      "The platform charges its own per-minute fee on top of the call.",
      "You build within the platform’s features and limits.",
      "One more service in the path of every call.",
    ],
    businesses: {
      intro: "Theo answers for a homeware shop, but the same build suits any business whose calls are about products, orders and accounts, especially teams that want to own and run the agent themselves. A few ideas:",
      list: [
        { name: "Retail and boutiques", idea: "Checks stock across locations, holds items for pickup and answers product questions.", icon: "Storefront" },
        { name: "E-commerce brands", idea: "Handles “where’s my order?”, returns and delivery questions around the clock.", icon: "Package" },
        { name: "Furniture and appliance stores", idea: "Answers stock and delivery-window questions and books deliveries.", icon: "Armchair" },
        { name: "Auto parts stores", idea: "Checks fitment and stock and holds parts for pickup.", icon: "Gear" },
        { name: "Car dealerships", idea: "Answers inventory questions and books test drives and service visits.", icon: "CarProfile" },
        { name: "Equipment and tool rental", idea: "Checks availability, takes reservations and confirms pickup times.", icon: "Toolbox" },
        { name: "Subscription businesses", idea: "Answers account and plan questions and hands billing changes to staff.", icon: "ArrowsClockwise" },
        { name: "Garden centres and nurseries", idea: "Answers stock and plant-care questions and reserves items.", icon: "Plant" },
        { name: "Wholesale and distributors", idea: "Gives trade customers stock levels and order status by phone.", icon: "Warehouse" },
      ],
    },
    description: "A managed voice platform architecture for AI voice agents, shown in our Form & Field demo: a managed voice platform (ElevenLabs Agents) for the conversation, with the shop’s catalogue, stock and orders on our own server.",
  },
  {
    slug: "stt-llm-tts-cascade",
    seoTitle: "Cascading voice agent architecture: speech-to-text, LLM and text-to-speech",
    demo: "travel",
    tone: "sand",
    architecture: "cascade",
    carrier: "telnyx",
    pronouns: ["she", "her"],
    headline: "Three specialists in a row.",
    lede: "Waypoint Travel is our booking example. We built Linda to show how a voice agent can handle a long, detailed booking: searching live airline fares, explaining fare levels, choosing seats and bags, and reading everything back before payment. She runs on a cascade (speech-to-text, then a language model, then text-to-speech), where one model hears, another reasons and calls tools, and a third speaks, with our own code deciding when each turn starts and ends.",
    engine: { label: "Cascade", logo: "gemini", parts: [{ role: "Hears", name: "AssemblyAI Universal-3.6 Pro", logo: "assemblyai" }, { role: "Thinks", name: "Gemini 3.5 Flash-Lite", logo: "gemini" }, { role: "Speaks", name: "Gemini 3.8 Flash-Lite TTS", logo: "gemini" }] },
    stack: [
      { role: "Hears", name: "AssemblyAI Universal-3.6 Pro", logo: "assemblyai", note: "Streaming transcription, primed with the words that matter (airports, cities) and with its own end-of-turn detection." },
      { role: "Thinks", name: "Google Gemini 3.5 Flash-Lite", logo: "gemini", note: "A fast text model that reasons and calls tools through Google’s Agent Development Kit (ADK)." },
      { role: "Speaks", name: "Google Gemini 3.8 Flash-Lite TTS", logo: "gemini", note: "A voice designed for Linda, spoken while the reply is still being written." },
      { role: "Backend", name: "Live fares from Duffel’s test environment", logo: "duffel", note: "Real airline search, fare levels, seat maps and bags. Nothing is ever booked or charged." },
    ],
    strengths: [
      { title: "The best ear for phone audio", copy: "Details make or break a booking: an airport code, a surname, a seat. In our side-by-side test on noisy phone audio, this transcriber caught 97% of the key details, against 70% for the first one we tried." },
      { title: "Every part chosen for its job", copy: "The ear, the brain and the voice can each be swapped on their own as better models arrive, without rebuilding the rest." },
      { title: "Turn-taking we control", copy: "Our code reads whether the caller has finished a thought or just paused, starts the reply early, and throws it away unheard if the caller keeps going. When the caller interrupts, queued speech is dropped and the next turn knows what they actually heard." },
      { title: "Exact where it matters", copy: "Codes the caller reads out are matched to the screen by code, not by the model, and common lines are prepared in advance so they play instantly." },
    ],
    steps: [
      { title: "Finds the trip", copy: "Where from, where to, when and who. She looks airports up instead of guessing." },
      { title: "Searches live fares", copy: "Real flights and prices from an airline booking system." },
      { title: "Builds the booking", copy: "Fare level, seat, bags and traveller, one step at a time." },
      { title: "Re-checks and reads back", copy: "The price is checked again and the booking read back before going ahead." },
      { title: "Stops before payment", copy: "The booking screen fills in as she talks, and the itinerary can go out by email." },
    ],
    tradeOffs: [
      "A slightly longer pause before each reply than a single bidirectional model.",
      "More moving parts: three models from two providers, plus our own turn-taking.",
      "More engineering to build and to maintain.",
    ],
    businesses: {
      intro: "Linda books flights, but the same build suits any call full of names, numbers and codes that have to be exactly right, and any booking that takes several steps. A few ideas:",
      list: [
        { name: "Travel agencies", idea: "Searches and builds flights, hotels and full itineraries.", icon: "Airplane" },
        { name: "Hotels and vacation rentals", idea: "Takes dates, room types and guest details, and handles changes.", icon: "Bed" },
        { name: "Insurance agencies", idea: "Collects quote details like names, addresses, vehicles and policy numbers.", icon: "ShieldCheck" },
        { name: "Law firms", idea: "Takes new-client intake with names, dates and case details, spelled right.", icon: "Scales" },
        { name: "Clinic intake", idea: "Collects patient details and insurance information before the first visit.", icon: "Stethoscope" },
        { name: "Logistics and freight", idea: "Reads back tracking numbers and books pickups.", icon: "Truck" },
        { name: "Event venues and catering", idea: "Takes dates, headcounts, menus and special requests.", icon: "Confetti" },
        { name: "Car and van rental", idea: "Handles reservation codes, pickup times and extras.", icon: "Key" },
        { name: "Accountants and tax preparers", idea: "Books appointments and goes through what to bring.", icon: "Calculator" },
      ],
    },
    description: "A cascading voice agent architecture (speech-to-text, LLM, text-to-speech), shown in our Waypoint Travel demo: a cascade of specialist models (AssemblyAI to hear, Gemini 3.5 Flash-Lite to reason, Gemini 3.8 Flash-Lite TTS to speak) with our own turn-taking.",
  },
];

export const storyFor = (slug: string) => STORIES.find((s) => s.slug === slug);
export const architecturePath = (demo: DemoId) => `/architecture/${STORIES.find((s) => s.demo === demo)!.slug}/`;

/** The comparison on /architecture/. One value per architecture, in plain words; relative, not benchmarks. */
export const COMPARISON: { label: string; values: Record<ArchitectureId, string> }[] = [
  { label: "How it works", values: { bidirectional: "One model hears, thinks and speaks in one live stream", platform: "A voice platform runs the conversation; tools stay on our server", cascade: "Separate models hear, think and speak, one after another" } },
  { label: "Reply speed", values: { bidirectional: "Fastest", platform: "Fast", cascade: "A little slower" } },
  { label: "Interruptions", values: { bidirectional: "Most natural", platform: "Handled by the platform", cascade: "Handled by our own code" } },
  { label: "Names, numbers and codes", values: { bidirectional: "Good", platform: "Good", cascade: "Best in our tests" } },
  { label: "Voice", values: { bidirectional: "The model’s built-in voices", platform: "A large library of premium voices", cascade: "Any voice, including one designed for you" } },
  { label: "Control over wording", values: { bidirectional: "Less", platform: "More", cascade: "Most" } },
  { label: "Extra platform fee", values: { bidirectional: "No", platform: "Yes", cascade: "No" } },
  { label: "Easiest to hand over", values: { bidirectional: "Medium", platform: "Easiest", cascade: "Needs more engineering" } },
];

/** How to choose, one line per architecture. */
export const CHOOSE: Record<ArchitectureId, string> = {
  bidirectional: "Your callers interrupt, change plans and want it to feel like talking to a person.",
  platform: "You want the agent in your own account, simple to look after, with a premium voice.",
  cascade: "Every call is full of names, numbers or codes that have to be exactly right.",
};

/** Questions about voice agent architecture, answered on /architecture/ (and marked up as an FAQ for search). */
export const ARCHITECTURE_FAQS: { q: string; a: string }[] = [
  { q: "What is a voice agent architecture?", a: "It’s how the parts of a voice agent fit together: what hears the caller, what decides what to do and calls the business’s tools, and what speaks. Those choices decide how quickly it replies, how well it handles interruptions, how accurately it hears details, what each call costs and who can maintain it." },
  { q: "What’s the difference between speech-to-speech and a cascade?", a: "A speech-to-speech model takes the caller’s audio in and produces audio out in one step, so it replies quickly and handles interruptions naturally. A cascade splits the job: speech-to-text writes down what the caller said, a language model decides what to do, and text-to-speech says the answer. It’s a little slower, but each part can be chosen and tuned for its job." },
  { q: "Which architecture is fastest?", a: "A single speech-to-speech model, because nothing is handed between separate steps. A managed voice platform comes close. A cascade adds a short pause before each reply, which we keep small by starting the reply early and preparing common lines in advance." },
  { q: "Which is most accurate with names, numbers and codes?", a: "In our own tests on noisy phone audio, a cascade with a transcriber built for phone calls caught 97% of key details, against 70% for the first transcriber we tried. That’s why our booking demo uses a cascade." },
  { q: "Do I need a voice platform like ElevenLabs?", a: "Not always. A platform is the quickest way to a natural voice and the easiest setup to hand over, but it adds its own per-minute fee. Speech-to-speech and cascade builds run without one." },
  { q: "Can the architecture change later?", a: "Yes. In our builds the business’s tools and data are kept separate from the engine that hears and speaks. All three of our demos use the same kind of tool layer, so the engine can be swapped as better models arrive without rebuilding the agent." },
  { q: "Does the architecture affect my phone number or carrier?", a: "No. Any of them works with carriers such as Twilio and Telnyx, and with your existing business number through call forwarding." },
];

/** The parts every voice agent has, whatever the architecture. */
export const PARTS: { name: string; copy: string }[] = [
  { name: "Phone line", copy: "A carrier such as Twilio or Telnyx answers the number and streams the call audio in real time." },
  { name: "Hear", copy: "Turns the caller’s voice into something the agent can work with: a transcript, or audio a model understands directly." },
  { name: "Think", copy: "A language model works out what the caller wants, decides what to do next and calls tools." },
  { name: "Speak", copy: "Turns the reply into a voice, ideally while the reply is still being written." },
  { name: "Tools", copy: "The business’s own systems the agent can use: schedules, catalogues, bookings, orders, messages." },
];
