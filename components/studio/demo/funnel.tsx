"use client";

import { useEffect, useState } from "react";
import type { Feed, Entry } from "../live/use-demo-feed";
import type { DemoInfo } from "../live/demo-info";
import type { BookingSkin, BrandId, DemoId } from "../live/types";
import { BrandMark, KindMark, type KindId } from "../brand-marks";
import { ArrowRight, Check, Close, Code, Lock, Phone } from "../icons";
import { VOICE_URL, type WatchStatus } from "../live/client";
import { Turnstile } from "../factory/Turnstile";
import { track } from "../consent";
import f from "./funnel.module.css";

/**
 * Before a demo call: which kind of business the visitor runs, what runs it today, and where to send
 * their call report. While the call runs, the right column shows what each of the agent's actions
 * would write into the tool they picked (or into a custom back office). The operations are the real
 * ones from each vendor's developer docs (Docs/studio-preview/INTEGRATION_MAP.md in the Macaroni repo).
 */

/** What the visitor says they do: a booking business (Ellie) or a legal practice area (Nora). */
export type LawArea = "injury" | "insurance" | "realestate";
export type ShopKind = "dtc" | "dealership" | "furniture";
export type TravelKind = "flights" | "hotels";
export type Trade = BookingSkin | LawArea | ShopKind | TravelKind;
/** `demo` is the demo page that runs this kind, when it is not the page the visitor is on. */
type TradeCard = { id: Trade; label: string; example: string; ready: boolean; demo?: DemoId };
/** `when` limits a write to calls that went one way: a case the firm took, or one it had to decline. */
export type Op = { what: string; op: string; when?: "qualified" | "declined" };
export type Tool = { id: string; name: string; skins: Trade[]; ops: Partial<Record<string, Op[]>>; confirmation: string };

export type Setup = { trade: Trade; tool: string; email: string; record: boolean; updates: boolean; pass?: string };

/** The businesses Ellie can answer for: one appointment engine, three front desks. */
const TRADES: TradeCard[] = [
  { id: "salon", label: "Salon & med spa", example: "Cuts, colour, nails, facials, injectables", ready: true },
  { id: "clinic", label: "Wellness clinic", example: "Chiropractic, physio, massage", ready: true },
  { id: "home", label: "Home services", example: "Heating & cooling visits", ready: true },
];

/** Law and professional services: separate businesses, each with its own agent and number. A card for another one opens its demo. */
const LAW_AREAS: TradeCard[] = [
  { id: "injury", label: "Personal injury", example: "Car crashes, falls, dog bites, wrongful death", ready: true, demo: "lawfirm" },
  { id: "realestate", label: "Real estate", example: "Buyers, sellers, showings, home values", ready: false, demo: "realestate" },
  { id: "insurance", label: "Insurance", example: "Quotes, coverage, claims, policy changes", ready: true, demo: "insurance" },
];
const LAW_FIRST: Partial<Record<DemoId, Trade>> = { lawfirm: "injury", realestate: "realestate", insurance: "insurance" };
const LAW_LEDE: Partial<Record<DemoId, string>> = {
  lawfirm: "Pick one and we’ll set the call up that way: intake questions, calendar and rules.",
  realestate: "Pick one and we’ll set the call up that way: listings, showings and lead scoring.",
  insurance: "Pick one and we’ll set the call up that way: quotes, policies and claims.",
};
/** The kinds of shop and travel business. Each is the same agent with its own catalogue. */
const SHOP_KINDS: TradeCard[] = [
  { id: "dtc", label: "Direct-to-consumer brand", example: "Online store: products, orders, returns", ready: true },
  { id: "dealership", label: "Auto dealership", example: "Inventory, test drives, trade-ins", ready: true },
  { id: "furniture", label: "Furniture showroom", example: "Pieces in stock, delivery, financing", ready: true },
];
/** Travel is separate businesses, each with its own agent and number: a card for another one opens its demo. */
const TRAVEL_KINDS: TradeCard[] = [
  { id: "flights", label: "Flights", example: "Search fares, pick seats, add bags", ready: true, demo: "travel" },
  { id: "hotels", label: "Hotels & stays", example: "Real hotels, rooms, live rates", ready: true, demo: "hotels" },
];

/** What each demo asks on the first step: the cards, the mark on each, and the words around them. */
function kindsFor(demoId: string): { cards: TradeCard[]; first: Trade; mark: (t: TradeCard) => React.ReactNode; title: string; lede: string; runs: string; stage: string } {
  if (demoId === "lawfirm" || demoId === "realestate" || demoId === "insurance") return { cards: LAW_AREAS, first: LAW_FIRST[demoId]!, mark: (t) => <BrandMark id={t.demo!} size={26} />, title: "What kind of business do you want to try?", lede: LAW_LEDE[demoId]!, runs: "What runs your business today?", stage: "Your business" };
  if (demoId === "formfield") return { cards: SHOP_KINDS, first: "dtc", mark: (t) => (t.id === "dtc" ? <BrandMark id="formfield" size={26} /> : <KindMark id={t.id as KindId} size={26} />), title: "What kind of business do you want to try?", lede: "Pick one and we’ll set the call up that way: inventory, availability and follow-up.", runs: "What runs your business today?", stage: "Your business" };
  if (demoId === "travel" || demoId === "hotels") return { cards: TRAVEL_KINDS, first: demoId === "hotels" ? "hotels" : "flights", mark: (t) => (t.id === "flights" ? <BrandMark id="travel" size={26} /> : t.id === "hotels" ? <BrandMark id="hotels" size={26} /> : <KindMark id={t.id as KindId} size={26} />), title: "What kind of business do you want to try?", lede: demoId === "hotels" ? "Pick one and we’ll set the call up that way: hotels, rooms and rates." : "Pick one and we’ll set the call up that way: fares, options and bookings.", runs: "What runs your business today?", stage: "Your business" };
  return { cards: TRADES, first: "salon", mark: (t) => <BrandMark id={SKINS[t.id as BookingSkin].brand} size={26} />, title: "What kind of business do you want to try?", lede: "Pick one and we’ll set the call up that way: services, schedule and rules.", runs: "What runs your business today?", stage: "Your business" };
}

/** How each business appears on the demo page. */
export const SKINS: Record<BookingSkin, { brand: BrandId; name: string; role: string; intro: string; prompts: string[]; sampleDetails: string }> = {
  home: { brand: "northline", name: "Northline", role: "Home services booking", intro: "", prompts: [], sampleDetails: "" },
  salon: {
    brand: "lune", name: "Lune Salon & Med Spa", role: "Salon & med spa booking",
    intro: "Book a cut, colour, nails or a med-spa treatment with a specific stylist, and watch the day fill in as Ellie works. Lune is a fictional salon and med spa.",
    prompts: ["Can I get a cut with Maria on Saturday afternoon?", "What does a balayage cost, and how long does it take?", "Could you add a gloss to that?"],
    sampleDetails: "Use any name you like. Lune, its team and its schedule are fictional; nothing is charged.",
  },
  clinic: {
    brand: "tidewell", name: "Tidewell Clinic", role: "Clinic booking",
    intro: "Book a first visit or a follow-up with the right practitioner, and watch the clinic's day and intake fill in. Tidewell is a fictional chiropractic, physio and massage clinic.",
    prompts: ["I hurt my back lifting. Can I see someone this week?", "Do you do direct billing?", "Is there a package if I need a few visits?"],
    sampleDetails: "Use any name you like and don't share real health details. Tidewell and its practitioners are fictional.",
  },
};

const CUSTOM = "custom";
/** Logos live in public/studio/logos/tools. A tool without a file shows its first letter. */
const TOOL_LOGOS: Record<string, string> = {
  square: "square.svg", gcal: "google-calendar.svg", servicetitan: "servicetitan.png", clio: "clio.svg",
  shopify: "shopify.svg", squarepos: "square.svg", lightspeed: "lightspeed.png", woocommerce: "woocommerce.png", bigcommerce: "bigcommerce.png",
  travefy: "travefy.png", traveljoy: "traveljoy.png", sabre: "sabre.png", amadeus: "amadeus.png", duffel: "duffel.svg",
  klaviyo: "klaviyo.png", gorgias: "gorgias.png", quickbooks: "quickbooks.svg", tekion: "tekion.png", cdk: "cdk.png", dealersocket: "dealersocket.png", vinsolutions: "vinsolutions.png", reynolds: "reynolds.png",
  ezlynx: "ezlynx.png", hawksoft: "hawksoft.png", hubspot: "hubspot.svg", followupboss: "followupboss.png", kvcore: "kvcore.png", lofty: "lofty.png",
  cloudbeds: "cloudbeds.png", mews: "mews.png", guesty: "guesty.png",
  boulevard: "boulevard.png", vagaro: "vagaro.png", shopmonkey: "shopmonkey.png", tekmetric: "tekmetric.jpg", fresha: "fresha.png", mangomint: "mangomint.png", mindbody: "mindbody.png", jane: "jane.png", workiz: "workiz.png",
  lawmatics: "lawmatics.png", mycase: "mycase.png", practicepanther: "practicepanther.png", cliogrow: "cliogrow.png",
  housecallpro: "housecallpro.png", jobber: "jobber.png",
};
export function ToolMark({ id, name }: { id: string; name: string }) {
  const file = TOOL_LOGOS[id];
  return <span className={f.toolMark}>{file ? <img src={`/studio/logos/tools/${file}`} alt="" /> : <b>{name.slice(0, 1)}</b>}</span>;
}

/** What each of Ellie's tools writes in each system, from the vendors' API references. */
const TOOLS: Tool[] = [
  {
    id: "housecallpro",
    name: "Housecall Pro",
    skins: ["home"],
    confirmation: "Housecall Pro texts the customer its own booking confirmation",
    ops: {
      get_caller_number: [{ what: "Find the customer by phone", op: "GET /customers?q=" }],
      check_availability: [{ what: "Check open arrival windows", op: "GET /company/schedule_availability/booking_windows" }],
      book_appointment: [
        { what: "Create the customer and service address", op: "POST /customers" },
        { what: "Create the job with the time window and technician", op: "POST /jobs" },
        { what: "Attach the call summary", op: "POST /jobs/{id}/notes" },
        { what: "Send the confirmation", op: "PUT /jobs/{id}/schedule · notify: true" },
      ],
      reschedule_appointment: [{ what: "Move the visit and notify the customer", op: "PUT /jobs/{id}/schedule" }],
      take_message: [{ what: "Log a lead for a callback", op: "POST /leads" }],
    },
  },
  {
    id: "jobber",
    name: "Jobber",
    skins: ["home"],
    confirmation: "Jobber's visit reminders go to the customer",
    ops: {
      get_caller_number: [{ what: "Find the client", op: "query clients(searchTerm)" }],
      check_availability: [{ what: "Read the team's scheduled visits", op: "query visits" }],
      book_appointment: [
        { what: "Create the client and property", op: "mutation clientCreate" },
        { what: "Create the job", op: "mutation jobCreate" },
        { what: "Schedule the visit and assign the tech", op: "mutation visitCreate" },
        { what: "Attach the call summary", op: "mutation jobCreateNote" },
      ],
      take_message: [{ what: "Log a request for a callback", op: "mutation requestCreate" }],
    },
  },
  {
    id: "servicetitan",
    name: "ServiceTitan",
    skins: ["home"],
    confirmation: "ServiceTitan's appointment notifications go to the customer",
    ops: {
      get_caller_number: [{ what: "Find the customer by phone", op: "GET /crm/v2/…/customers?phone=" }],
      check_availability: [{ what: "Check technician capacity", op: "POST /dispatch/v2/…/capacity" }],
      book_appointment: [
        { what: "Create the customer and location", op: "POST /crm/v2/…/customers" },
        { what: "Book the job with an arrival window", op: "POST /jpm/v2/…/jobs" },
        { what: "Assign the technician", op: "POST /dispatch/v2/…/assign-technicians" },
        { what: "Attach the call summary", op: "POST /jpm/v2/…/jobs/{id}/notes" },
      ],
      take_message: [{ what: "Log a lead for a callback", op: "POST /crm/v2/…/leads" }],
    },
  },
  {
    id: "workiz",
    name: "Workiz",
    skins: ["home"],
    confirmation: "Workiz automations send the confirmation",
    ops: {
      get_caller_number: [{ what: "Find the client", op: "GET /v2/clients?searchQuery=" }],
      check_availability: [{ what: "Check open slots", op: "GET /v2/availability" }],
      book_appointment: [
        { what: "Create the job (and client) with the time", op: "POST /v2/jobs" },
        { what: "Assign the technician", op: "POST /v2/jobs/{id}/team" },
      ],
      take_message: [{ what: "Log a lead for a callback", op: "POST /v2/leads" }],
    },
  },
  {
    id: "square",
    name: "Square Appointments",
    skins: ["salon", "clinic"],
    confirmation: "Square Appointments sends its own confirmation and reminders",
    ops: {
      get_caller_number: [{ what: "Find the client by phone", op: "POST /v2/customers/search" }],
      check_availability: [{ what: "Search open times for the service and staff member", op: "POST /v2/bookings/availability/search" }],
      book_appointment: [
        { what: "Create the client", op: "POST /v2/customers" },
        { what: "Book the service with the staff member", op: "POST /v2/bookings" },
        { what: "Attach the call summary", op: "booking.seller_note" },
      ],
    },
  },
  {
    id: "followupboss",
    name: "Follow Up Boss",
    skins: ["realestate"],
    confirmation: "Follow Up Boss sends the calendar invitation to the client",
    ops: {
      get_caller_number: [{ what: "Find the person by phone", op: "GET /v1/people?phone=" }],
      note_lead: [{ what: "Create or match the lead with search criteria and assigned agent", op: "POST /v1/events · type: Property Inquiry" }],
      get_listing: [{ what: "Attach the property to the lead", op: "POST /v1/events · property{street,price,bedrooms}" }],
      estimate_value: [{ what: "Log the seller inquiry with the address", op: "POST /v1/events · type: Seller Inquiry" }],
      book_appointment: [
        { what: "Book the appointment and invite the client", op: "POST /v1/appointments?sendInvitation=true" },
        { what: "Create the showing task for the agent", op: "POST /v1/tasks · type: Showing" },
        { what: "Log the call", op: "POST /v1/calls · isIncoming: true" },
      ],
      take_message: [{ what: "Create a call-back task for the agent", op: "POST /v1/tasks · type: Call" }],
    },
  },
  {
    id: "lofty",
    name: "Lofty",
    skins: ["realestate"],
    confirmation: "",
    ops: {
      get_caller_number: [{ what: "Find the lead by phone", op: "GET /v1.0/leads?phone=" }],
      note_lead: [{ what: "Create the lead with its inquiry and timeframe", op: "POST /v1.0/leads" }],
      search_listings: [{ what: "Save the search criteria on the lead", op: "POST /v1.0/leads · inquiry" }],
      check_availability: [{ what: "Read the agent's open times", op: "GET /v2.0/calendar/meetings/available" }],
      book_appointment: [
        { what: "Book the appointment at the property", op: "POST /v2.0/calendar · type: APPOINTMENT" },
        { what: "Assign the agent", op: "POST /v1.0/leads/{leadId}/assignment" },
        { what: "Add the call summary", op: "POST /v1.0/notes" },
      ],
      take_message: [{ what: "Create a call-back task", op: "POST /v2.0/tasks · type: Call" }],
    },
  },
  {
    id: "kvcore",
    name: "kvCORE",
    skins: ["realestate"],
    confirmation: "",
    ops: {
      note_lead: [{ what: "Create the contact with deal type and price range", op: "POST /contact" }],
      book_appointment: [
        { what: "Log the call and the booking as a note", op: "PUT /contact/{id}/action/note" },
        { what: "Schedule the agent's follow-up call", op: "POST /schedule-call" },
      ],
      take_message: [{ what: "Schedule a call back", op: "POST /schedule-call" }],
    },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    skins: ["realestate", "insurance"],
    confirmation: "HubSpot emails the meeting confirmation",
    ops: {
      get_caller_number: [{ what: "Search contacts by phone", op: "POST /crm/v3/objects/contacts/search" }],
      note_lead: [{ what: "Create the contact with its owner", op: "POST /crm/v3/objects/contacts · hubspot_owner_id" }],
      note_account: [{ what: "Create the contact", op: "POST /crm/v3/objects/contacts" }],
      find_customer: [{ what: "Search the policy by number or the contact", op: "POST /crm/v3/objects/{policy}/search" }],
      report_claim: [{ what: "Open a ticket for the claim", op: "POST /crm/v3/objects/tickets" }],
      request_change: [{ what: "Open a service ticket", op: "POST /crm/v3/objects/tickets" }],
      book_appointment: [
        { what: "Book the meeting", op: "POST /scheduler/v3/meetings/meeting-links/book" },
        { what: "Log the call", op: "POST /crm/v3/objects/calls" },
      ],
      book_agent_call: [
        { what: "Create the quote deal", op: "POST /crm/v3/objects/deals · pipeline: Quotes" },
        { what: "Book the call", op: "POST /scheduler/v3/meetings/meeting-links/book" },
      ],
      take_message: [{ what: "Create a call-back task", op: "POST /crm/v3/objects/tasks" }],
    },
  },
  {
    id: "agencyzoom",
    name: "AgencyZoom",
    skins: ["insurance"],
    confirmation: "",
    ops: {
      find_customer: [{ what: "Find the customer", op: "POST /customers" }],
      get_policy: [{ what: "Read the customer's policies", op: "GET /customers/{id}/policies" }],
      note_account: [{ what: "Create the lead", op: "POST /leads/create" }],
      book_agent_call: [
        { what: "Open the quote opportunity", op: "POST /leads/{id}/opportunities" },
        { what: "Create the agent's call task", op: "POST /tasks" },
      ],
      report_claim: [{ what: "Note the loss on the customer", op: "POST /customers/{id}/notes" }],
      request_change: [{ what: "Create a task for the account manager", op: "POST /tasks" }],
      take_message: [{ what: "Create a call-back task", op: "POST /tasks" }],
    },
  },
  {
    id: "hawksoft",
    name: "HawkSoft",
    skins: ["insurance"],
    confirmation: "",
    ops: {
      find_customer: [{ what: "Find the client by policy number", op: "GET /agency/{id}/clients/search?policyNumber=" }],
      get_policy: [{ what: "Read the policies and coverages", op: "GET /agency/{id}/clients/search?include=policies" }],
      note_account: [{ what: "Create the prospect", op: "POST /agency/{id}/client" }],
      report_claim: [{ what: "Log the loss with a task for the CSR", op: "POST /agency/{id}/client/{clientId}/log" }],
      request_change: [{ what: "Log the change for the CSR", op: "POST /agency/{id}/client/{clientId}/log" }],
      take_message: [{ what: "Log the call", op: "POST /agency/{id}/client/{clientId}/log" }],
    },
  },
  { id: "appliedepic", name: "Applied Epic", skins: ["insurance"], confirmation: "", ops: {} },
  { id: "ezlynx", name: "EZLynx", skins: ["insurance"], confirmation: "", ops: {} },
  { id: "cloudbeds", name: "Cloudbeds", skins: ["hotels"], confirmation: "", ops: {} },
  { id: "mews", name: "Mews", skins: ["hotels"], confirmation: "", ops: {} },
  { id: "guesty", name: "Guesty", skins: ["hotels"], confirmation: "", ops: {} },
  { id: "liteapi", name: "LiteAPI", skins: ["hotels"], confirmation: "", ops: {} },
  { id: "klaviyo", name: "Klaviyo", skins: ["dtc"], confirmation: "", ops: {} },
  { id: "gorgias", name: "Gorgias", skins: ["dtc"], confirmation: "", ops: {} },
  { id: "quickbooks", name: "QuickBooks", skins: ["furniture"], confirmation: "", ops: {} },
  { id: "tekion", name: "Tekion", skins: ["dealership"], confirmation: "", ops: {} },
  { id: "cdk", name: "CDK Global", skins: ["dealership"], confirmation: "", ops: {} },
  { id: "dealersocket", name: "DealerSocket", skins: ["dealership"], confirmation: "", ops: {} },
  { id: "vinsolutions", name: "VinSolutions", skins: ["dealership"], confirmation: "", ops: {} },
  { id: "reynolds", name: "Reynolds", skins: ["dealership"], confirmation: "", ops: {} },
  { id: "shopify", name: "Shopify", skins: ["dtc", "furniture"], confirmation: "", ops: {} },
  { id: "squarepos", name: "Square", skins: ["furniture"], confirmation: "", ops: {} },
  { id: "lightspeed", name: "Lightspeed", skins: ["furniture"], confirmation: "", ops: {} },
  { id: "woocommerce", name: "WooCommerce", skins: ["dtc"], confirmation: "", ops: {} },
  { id: "bigcommerce", name: "BigCommerce", skins: ["dtc"], confirmation: "", ops: {} },
  { id: "travefy", name: "Travefy", skins: ["flights", "hotels"], confirmation: "", ops: {} },
  { id: "traveljoy", name: "TravelJoy", skins: ["flights", "hotels"], confirmation: "", ops: {} },
  { id: "sabre", name: "Sabre", skins: ["flights", "hotels"], confirmation: "", ops: {} },
  { id: "amadeus", name: "Amadeus", skins: ["flights", "hotels"], confirmation: "", ops: {} },
  { id: "duffel", name: "Duffel", skins: ["flights"], confirmation: "", ops: {} },
  { id: "shopmonkey", name: "Shopmonkey", skins: ["home"], confirmation: "", ops: {} },
  { id: "tekmetric", name: "Tekmetric", skins: ["home"], confirmation: "", ops: {} },
  { id: "boulevard", name: "Boulevard", skins: ["salon"], confirmation: "", ops: {} },
  { id: "vagaro", name: "Vagaro", skins: ["salon"], confirmation: "", ops: {} },
  { id: "fresha", name: "Fresha", skins: ["salon"], confirmation: "", ops: {} },
  { id: "mangomint", name: "Mangomint", skins: ["salon"], confirmation: "", ops: {} },
  { id: "mindbody", name: "Mindbody", skins: ["salon", "clinic"], confirmation: "", ops: {} },
  { id: "jane", name: "Jane", skins: ["clinic"], confirmation: "", ops: {} },
  {
    id: "lawmatics",
    name: "Lawmatics",
    skins: ["injury"],
    confirmation: "A Lawmatics automation sends the client their consultation confirmation",
    ops: {
      get_caller_number: [{ what: "Find an existing matter by phone", op: "GET /v1/prospects/find_by_phone/:phone_number" }],
      check_conflicts: [
        { what: "Search contacts for the caller", op: "GET /v1/contacts/find_by_name/:name" },
        { what: "Check the opposing party's matters", op: "GET /v1/relationships?filter_by=contactable_id" },
      ],
      assess_case: [
        { what: "Create the person, the potential-client matter, practice area and intake answers", op: "POST /v1/prospects", when: "qualified" },
        { what: "Link the opposing party", op: "POST /v1/relationships", when: "qualified" },
      ],
      check_availability: [{ what: "Read the attorneys' booked events", op: "GET /v1/events" }],
      book_consultation: [
        { what: "Book the consultation on the matter and invite the client", op: "POST /v1/events · send_invites: true" },
        { what: "Add the call summary", op: "POST /v1/interactions" },
      ],
      take_message: [{ what: "Log a prospect for a callback", op: "POST /v1/prospects" }],
    },
  },
  {
    id: "clio",
    name: "Clio Manage",
    skins: ["injury"],
    confirmation: "Clio emails the client the calendar invitation",
    ops: {
      get_caller_number: [{ what: "Find the contact by phone", op: "GET /contacts.json?query=" }],
      check_conflicts: [
        { what: "Search contacts for the caller and the opposing party", op: "GET /contacts.json?query=" },
        { what: "Search matters for the opposing party", op: "GET /matters.json?query=" },
      ],
      assess_case: [
        { what: "Create the contact", op: "POST /contacts.json", when: "qualified" },
        { what: "Open a pending matter with the practice area and intake answers", op: "POST /matters.json · status: pending", when: "qualified" },
        { what: "Link the opposing party", op: "POST /relationships.json", when: "qualified" },
      ],
      check_availability: [{ what: "Read the attorney's calendar", op: "GET /calendar_entries.json" }],
      book_consultation: [
        { what: "Book the consultation and email the client", op: "POST /calendar_entries.json · send_email_notification" },
        { what: "Attach the call summary", op: "POST /notes.json" },
      ],
      take_message: [{ what: "Log the call for a callback", op: "POST /communications.json" }],
    },
  },
  {
    id: "mycase",
    name: "MyCase",
    skins: ["injury"],
    confirmation: "",
    ops: {
      get_caller_number: [{ what: "Find the lead or client by phone", op: "GET /v1/leads?filter[cell_phone_number]=" }],
      check_conflicts: [
        { what: "Search clients for the caller", op: "GET /v1/clients?filter[last_name]=" },
        { what: "Search cases for the opposing party", op: "GET /v1/cases" },
      ],
      assess_case: [{ what: "Create the lead with the intake answers", op: "POST /v1/leads", when: "qualified" }],
      check_availability: [{ what: "Read the attorneys' events", op: "GET /v1/events" }],
      book_consultation: [
        { what: "Book the consultation on the attorney's calendar", op: "POST /v1/events" },
        { what: "Log the call", op: "POST /v1/calls" },
      ],
      take_message: [{ what: "Log the call for a callback", op: "POST /v1/calls" }],
    },
  },
  {
    id: "cliogrow",
    name: "Clio Grow",
    skins: ["injury"],
    confirmation: "",
    ops: {
      check_conflicts: [{ what: "Search contacts and untriaged leads", op: "GET /contacts?query=" }],
      assess_case: [{ what: "Create the lead for the intake team, with the intake answers", op: "POST /inbox_leads", when: "qualified" }],
      take_message: [{ what: "Create a lead for a callback", op: "POST /inbox_leads" }],
    },
  },
  {
    id: "practicepanther",
    name: "PracticePanther",
    skins: ["injury"],
    confirmation: "",
    ops: {
      check_conflicts: [{ what: "Search contacts, accounts and matters", op: "GET /api/v2/matters?search_text=" }],
      assess_case: [
        { what: "Create the account and primary contact", op: "POST /api/v2/accounts", when: "qualified" },
        { what: "Open a pending matter", op: "POST /api/v2/matters · status: Pending", when: "qualified" },
      ],
      book_consultation: [
        { what: "Book the consultation", op: "POST /api/v2/events" },
        { what: "Log the call", op: "POST /api/v2/calllogs" },
      ],
    },
  },
  {
    id: "gcal",
    name: "Google Calendar",
    skins: ["injury"],
    confirmation: "Google emails the calendar invite",
    ops: {
      check_availability: [{ what: "Check free and busy time", op: "POST /freeBusy" }],
      book_appointment: [{ what: "Create the appointment and invite the client", op: "POST /calendars/{id}/events?sendUpdates=all" }],
      book_consultation: [{ what: "Create the consultation and invite the client", op: "POST /calendars/{id}/events?sendUpdates=all" }],
    },
  },
];

const OTHER = "other";

/** The tool a setup names, when it is one we map (not "custom" or "something else"). */
export function findTool(id: string | null | undefined): Tool | null {
  return TOOLS.find((t) => t.id === id) ?? null;
}

/** What one finished step would write into a tool: a case the firm declined skips the "qualified" writes, and the other way round. */
export function opsFor(tool: Tool, step: { tool: string; summary?: string | null }): Op[] {
  const declined = /cannot take|conflict/i.test(step.summary ?? "");
  return (tool.ops[step.tool] ?? []).filter((o) => !o.when || (o.when === "declined") === declined);
}

/** Steps that book something, after which the tool sends its own confirmation. */
export const BOOKING_TOOLS = ["book_appointment", "book_consultation", "book_agent_call"];

/* ---------------- Setup card ---------------- */

const SETUP_PARAM = "setup";
/** True when the page was opened from another demo's first step (the visitor already picked this kind). */
const arrivedWithKind = () => new URLSearchParams(window.location.search).get(SETUP_PARAM) === "tools";
/** Opens another demo on its setup card's second step, keeping a sample replay if one is running. */
function openDemoAt(id: DemoId) {
  const q = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  if (q.has("replay")) next.set("replay", "");
  next.set(SETUP_PARAM, "tools");
  window.location.href = `/demo/${id}/?${next.toString().replace(/^replay=&/, "replay&")}`;
}

export function SetupCard({ demo, watch, onNewCode, onDone, onSaved, onClose, again }: { demo: DemoInfo; watch: { status: WatchStatus; code?: string }; onNewCode: () => void; onDone: (s: Setup) => void; onSaved?: (s: Setup) => void; onClose?: () => void; again?: Setup }) {
  // "Try it again" comes straight back to the call step with the answers they already gave.
  // Arriving from another travel demo's first step (?setup=tools): that choice is made, so open on the tools.
  const [step, setStep] = useState(() => (again ? 3 : arrivedWithKind() ? 1 : 0));
  const kinds = kindsFor(demo.id);
  const [trade, setTrade] = useState<Trade>(again?.trade ?? kinds.first);
  const [tool, setTool] = useState<string | null>(again?.tool ?? null);
  const [email, setEmail] = useState(again?.email ?? "");
  const [record, setRecord] = useState(again?.record ?? true);
  const [updates, setUpdates] = useState(again?.updates ?? false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  // Verify you are human, and a reachable, non-throwaway address: checked by the voice service, which hands back a pass.
  const [human, setHuman] = useState("");
  const [checks, setChecks] = useState(0);
  const [checking, setChecking] = useState(false);
  const [emailProblem, setEmailProblem] = useState("");
  const [pass, setPass] = useState(again?.pass ?? "");
  // A field people never see; anything typed in it came from a bot.
  const [trap, setTrap] = useState("");

  useEffect(() => { if (!again) track("demo_setup_viewed", { demo: demo.id }); }, [demo.id, again]);
  // The marker has done its job once the card is open: clear it so a reload starts at the beginning.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SETUP_PARAM)) return;
    url.searchParams.delete(SETUP_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search.replace(/=(?=&|$)/g, "") + url.hash);
  }, []);

  function currentSetup(withPass = pass): Setup { return { trade, tool: tool ?? CUSTOM, email: email.trim(), record, updates, pass: withPass }; }
  async function checkAndContinue() {
    if (!human) { setEmailProblem("Please tick “Verify you are human” first."); return; }
    setChecking(true);
    setEmailProblem("");
    try {
      const r = await fetch(`${VOICE_URL}/check-email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), turnstileToken: human, company: trap }) });
      const out = (await r.json()) as { ok: boolean; pass?: string; message?: string };
      if (!out.ok || !out.pass) { setEmailProblem(out.message || "Please check your email address."); return; }
      setPass(out.pass);
      saveAndContinue(out.pass);
    } catch {
      setEmailProblem("We couldn’t check that just now. Please try again.");
    } finally {
      setChecking(false);
      setChecks((n) => n + 1);
    }
  }
  function saveAndContinue(withPass = pass) {
    const s = currentSetup(withPass);
    track("demo_setup_done", { demo: demo.id, trade, tool: s.tool, record: record ? 1 : 0, updates: updates ? 1 : 0 });
    onSaved?.(s);
    setStep(3);
  }
  // The call connected: the visitor is on screen, so the card gets out of the way.
  useEffect(() => { if (step === 3 && watch.status === "linked") onDone(currentSetup()); }, [step, watch.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const dial = watch.status === "waiting" && watch.code ? `tel:${demo.phone},,${watch.code}` : `tel:${demo.phone}`;

  // First time through, closing means leaving the demo: ask, then go back to the home page. On a retry it just closes.
  const [leaving, setLeaving] = useState(false);
  const newCodeBtn = <button type="button" className={f.newCode} onClick={onNewCode}>Create a new code</button>;

  if (leaving) return <div className={f.scrim} role="dialog" aria-modal="true" aria-labelledby="leave-title">
    <div className={f.card}>
      <h2 id="leave-title">Leave the demo?</h2>
      <p className={f.lede}>You’ll go back to the home page.</p>
      <div className={f.actions}>
        <button type="button" className={f.back} onClick={() => { track("demo_exit", { demo: demo.id, step }); window.location.href = "/"; }}>Leave</button>
        <button type="button" className={f.primary} onClick={() => setLeaving(false)}>Stay<ArrowRight size={14} /></button>
      </div>
    </div>
  </div>;

  return <div className={f.scrim} role="dialog" aria-modal="true" aria-labelledby="setup-title">
    <div className={f.card}>
      <button type="button" className={f.close} aria-label="Close" onClick={() => (again && onClose ? onClose() : setLeaving(true))}><Close size={18} /></button>
      <ol className={f.progress} aria-label="Steps">
        {[kinds.stage, "Your tools", "Your report", "Your call"].map((s, i) => <li key={s} data-state={i < step ? "done" : i === step ? "now" : "next"}><i>{i < step ? <Check size={11} /> : i + 1}</i>{s}</li>)}
      </ol>

      {step === 0 ? <>
        <h2 id="setup-title">{kinds.title}</h2>
        <p className={f.lede}>{kinds.lede}</p>
        <div className={f.trades}>
          {kinds.cards.map((t) => <button key={t.id} type="button" className={f.trade} data-selected={trade === t.id || undefined} disabled={!t.ready} onClick={() => { setTrade(t.id); setTool(null); }}>
            <span className={f.tradeMark}>{kinds.mark(t)}</span>
            <b>{t.label}</b><span>{t.example}</span>{t.ready ? null : <em>Coming soon</em>}
          </button>)}
        </div>
        <div className={f.actions}><button type="button" className={f.primary} onClick={() => {
          track("demo_setup_trade", { demo: demo.id, trade });
          const other = kinds.cards.find((t) => t.id === trade)?.demo;
          if (other && other !== demo.id) { openDemoAt(other); return; }
          setStep(1);
        }}>Continue<ArrowRight size={14} /></button></div>
      </> : null}

      {step === 1 ? <>
        <h2 id="setup-title">{kinds.runs}</h2>
        <p className={f.lede}>Pick yours and you’ll see exactly what the agent would write into it.</p>
        <div className={f.toolGrid}>
          {TOOLS.filter((t) => t.skins.includes(trade)).map((t) => <button key={t.id} type="button" className={f.toolTile} data-selected={tool === t.id || undefined} onClick={() => setTool(t.id)}><ToolMark id={t.id} name={t.name} /><span>{t.name}</span></button>)}
          <button type="button" className={f.toolTile} data-selected={tool === OTHER || undefined} onClick={() => setTool(OTHER)}><span className={f.toolMark}><b>+</b></span><span>Something else</span></button>
        </div>
        <div className={f.actions}>
          <button type="button" className={f.back} onClick={() => setStep(0)}>Back</button>
          <button type="button" className={f.primary} disabled={!tool} onClick={() => { track("demo_setup_tool", { demo: demo.id, tool: tool ?? "" }); setStep(2); }}>Continue<ArrowRight size={14} /></button>
        </div>
      </> : null}

      {step === 2 ? <>
        <h2 id="setup-title">Where should we send your call report?</h2>
        <p className={f.lede}>After the call you’ll get what the agent did, minute by minute{tool && tool !== CUSTOM && tool !== OTHER ? `, and what it would have written in ${TOOLS.find((t) => t.id === tool)?.name}` : ""}.</p>
        <label className={f.field}><span>Work email</span><input type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className={f.check}><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /><span>Record the call so I can listen back in my report</span></label>
        <label className={f.check}><input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} /><span>Send me occasional updates from Digital Macaroni</span></label>
        <p className={f.fine}><Lock size={12} /><span>Kept 30 days, then deleted. See our <a href="/privacy/">privacy policy</a>.</span></p>
        <div className="honeypot" aria-hidden="true" style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}><label>Leave this empty<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label></div>
        <div style={{ marginTop: 14 }}><Turnstile onToken={setHuman} resetKey={checks} /></div>
        {emailProblem ? <p className={f.fine} role="alert" style={{ color: "#b03a26" }}>{emailProblem}</p> : null}
        <div className={f.actions}>
          <button type="button" className={f.back} onClick={() => setStep(1)}>Back</button>
          <button type="button" className={f.primary} disabled={!emailOk || checking} onClick={() => void checkAndContinue()}>{checking ? "Checking…" : "Continue"}<ArrowRight size={14} /></button>
        </div>
      </> : null}

      {step === 3 ? <>
        <h2 id="setup-title">Now call it.</h2>
        <p className={f.lede}>Dial the number and enter the code when asked. This page follows your call.</p>
        <a className={f.dial} href={dial}><Phone size={20} />{demo.phoneDisplay}</a>
        {watch.status === "waiting" && watch.code
          ? <div className={f.codeRow} aria-label={`code ${watch.code.split("").join(" ")}`}><span>Your screen code</span><div className={f.codeBox}><div>{watch.code.split("").map((c, i) => <b key={i}>{c}</b>)}</div>{newCodeBtn}</div></div>
          : <div className={f.codeRow} data-loading><span>{watch.status === "error" ? "Can’t reach the demo line. Trying again…" : "Getting your screen code…"}</span><div className={f.codeBox}><div>{[0, 1, 2, 3].map((i) => <b key={i} />)}</div>{newCodeBtn}</div></div>}
        <div className={f.actions}>
          {again ? null : <button type="button" className={f.back} onClick={() => setStep(2)}>Back</button>}
        </div>
      </> : null}
    </div>
  </div>;
}

/** The tool the visitor picked, as its logo: shown beside "Behind the call". */
export function ToolBadge({ setup }: { setup: Setup }) {
  const tool = TOOLS.find((t) => t.id === setup.tool);
  return <span className={f.badge} title={tool?.name ?? "Your own system"}>{tool ? <ToolMark id={tool.id} name={tool.name} /> : <Code size={18} />}</span>;
}

/* ---------------- Live: what lands in their tools ---------------- */

type Action = Extract<Entry, { kind: "action" }>;

export function ToolsLane({ demo, feed, setup }: { demo: DemoInfo; feed: Feed; setup: Setup }) {
  const tool = TOOLS.find((t) => t.id === setup.tool);
  const done = feed.entries.filter((e): e is Action => e.kind === "action" && e.status === "done");
  const custom = !tool;
  const rows = custom
    ? done.filter((a) => a.tool !== "link_screen" && a.tool !== "end_call").map((a) => ({ key: a.id, what: a.summary ?? a.label, op: a.tool }))
    : done.flatMap((a) => opsFor(tool, a).map((o, i) => ({ key: `${a.id}-${i}`, what: o.what, op: o.op })));
  const booked = done.some((a) => BOOKING_TOOLS.includes(a.tool));

  return <section className={f.lane} aria-label={custom ? "Your back office" : `Sent to ${tool.name}`}>
    <header>
      <span className={f.laneIcon}>{custom ? <Code size={15} /> : tool.name.slice(0, 1)}</span>
      <div><h3>{custom ? "Your back office" : `Sent to ${tool.name}`}</h3><small>{custom ? `What ${demo.agentName} wrote into the system we’d build for you` : `In a live install, this is what ${demo.agentName} writes to your ${tool.name}`}</small></div>
    </header>
    {rows.length ? <ol>
      {rows.map((r) => <li key={r.key}><i><Check size={11} /></i><span>{r.what}<code>{r.op}</code></span></li>)}
      {!custom && booked && tool.confirmation ? <li data-kind="native"><i><Check size={11} /></i><span>{tool.confirmation}</span></li> : null}
    </ol> : <p className={f.laneEmpty}>{custom ? `Each record ${demo.agentName} creates appears here.` : Object.keys(tool.ops).length ? `Each call ${demo.agentName} would make to ${tool.name} appears here as she works.` : `We connect ${demo.agentName} to ${tool.name} through its API when we build yours.`}</p>}
  </section>;
}


/* ---------------- After the call ---------------- */

/** The call is over: the screen stays put behind this. Most people want another go, a few want to read what happened. */
export function AfterCall({ onAgain, onExplore, report, children }: { onAgain: () => void; onExplore: () => void; report?: string | null; children?: React.ReactNode }) {
  useEffect(() => { track("demo_after_call_viewed"); }, []);
  return <div className={f.scrim} role="dialog" aria-modal="true" aria-labelledby="after-title">
    <div className={f.card}>
      <button type="button" className={f.close} aria-label="Close" onClick={onExplore}><Close size={18} /></button>
      <h2 id="after-title">That was the call.</h2>
      <p className={f.lede}>Here’s what the agent handled. Run it again to try something different, or explore the screen to see every step.</p>
      {children ? <div className={f.recap}>{children}</div> : null}
      {report ? <a className={f.fullCall} href={`/call/?r=${encodeURIComponent(report)}`} target="_blank" rel="noopener" onClick={() => track("demo_after_call", { choice: "full_call" })}>
        <span><b>See your full call</b><small>The recording, every word and every step, on its own page</small></span><ArrowRight size={16} />
      </a> : null}
      <div className={f.actions}>
        <button type="button" className={f.back} onClick={() => { track("demo_after_call", { choice: "explore" }); onExplore(); }}>Explore the screen</button>
        <button type="button" className={f.primary} onClick={() => { track("demo_after_call", { choice: "again" }); onAgain(); }}>Try it again<ArrowRight size={14} /></button>
      </div>
    </div>
  </div>;
}
