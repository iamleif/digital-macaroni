import type { ReactNode } from "react";
import type { DemoId } from "../live/types";
import { SOURCES, type SourceKey } from "./sources";

/**
 * The Answers pages: one question per page, a direct answer first, then the detail. Facts about
 * Digital Macaroni come from how the agents and plans actually work; every outside figure links to
 * its source and appears in the page's source list.
 */
export type Category = "industries" | "costs" | "how-it-works";

export interface Answer {
  slug: string;
  category: Category;
  /** The question, as the page title. */
  title: string;
  /** Short label for cards and links. */
  label: string;
  /** The direct answer, shown first. Plain text: it is also the structured-data answer. */
  short: string;
  description: string;
  demo: DemoId;
  body: ReactNode;
  faqs: { q: string; a: string }[];
  sources: SourceKey[];
  related: string[];
}

export const CATEGORIES: Record<Category, { title: string; blurb: string }> = {
  industries: { title: "By industry", blurb: "What a phone agent does for your kind of business, and the tools it connects to." },
  costs: { title: "Costs and plans", blurb: "What it costs, what's included, and how it keeps running." },
  "how-it-works": { title: "How it works", blurb: "Reliability, disclosure, your phone number and the rest of the details." },
};

export const UPDATED = "October 4, 2026";
export const UPDATED_ISO = "2026-10-04";

/** An inline citation: links the claim to its source, which also appears in the page's source list. */
function Cite({ k, children }: { k: SourceKey; children: ReactNode }) {
  return <a href={SOURCES[k].url} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const Demo = ({ id, children }: { id: DemoId; children: ReactNode }) => <a href={`/demo/${id}/`}>{children}</a>;

export const ANSWERS: Answer[] = [
  /* ---------------- Industries ---------------- */
  {
    slug: "ai-phone-agent-for-home-services",
    category: "industries",
    label: "Home services",
    title: "What can an AI phone agent do for a home services business?",
    short: "An AI phone agent answers every call for an HVAC, plumbing or electrical business, books and reschedules visits into real availability, takes the details your technicians need, and sends emergencies and anything it can't handle to your team. It works around the clock and connects to tools like ServiceTitan, Jobber and Housecall Pro.",
    description: "How an AI phone agent books, reschedules and triages calls for HVAC, plumbing and electrical businesses, and the field service tools it connects to.",
    demo: "northline",
    body: <>
      <h2>The calls it handles</h2>
      <ul>
        <li><strong>New bookings.</strong> &ldquo;My furnace stopped working, can someone come tomorrow?&rdquo; The agent asks what&rsquo;s wrong, checks the schedule, offers a real arrival window and books it once the caller says yes.</li>
        <li><strong>Reschedules and cancellations.</strong> It moves the existing visit rather than creating a duplicate, so your board stays clean.</li>
        <li><strong>Questions.</strong> Service area, call-out fees, what you do and don&rsquo;t fix, opening hours. It only quotes what you&rsquo;ve given it.</li>
        <li><strong>Messages and callbacks.</strong> When nothing fits or the caller wants a person, it takes a message with the details and sends it to your team.</li>
        <li><strong>After-hours calls.</strong> The calls that used to go to voicemail get answered and booked. The <a href="/missed-call-calculator/">missed call calculator</a> shows what those calls are worth to you.</li>
      </ul>
      <h2>Emergencies and safety</h2>
      <p>You decide what counts as an emergency and what happens next. Our demo agent, Ellie, is set up so that anyone reporting a gas smell, sparking or flooding near electrics is told to leave and call 911 first. You can also route true emergencies straight to your on-call technician.</p>
      <h2>What lands in your system</h2>
      <p>Each booking arrives with the service, the problem in the caller&rsquo;s words, the name, address and a confirmed time. With a <a href="/answers/how-much-does-an-ai-phone-agent-cost/">custom agent</a> it goes straight into the tools you already run:</p>
      <table>
        <thead><tr><th>Tool</th><th>What the agent can do there</th></tr></thead>
        <tbody>
          <tr><td>ServiceTitan, Jobber, Housecall Pro</td><td>Check availability, book and move jobs, add customer details</td></tr>
          <tr><td>simPRO, ServiceM8</td><td>Create jobs and leads with the caller&rsquo;s details</td></tr>
          <tr><td>Google Calendar, Outlook</td><td>Book directly into shared calendars</td></tr>
          <tr><td>SMS</td><td>Text the caller a confirmation and text your team a summary</td></tr>
        </tbody>
      </table>
      <p>A <a href="/answers/how-much-does-an-ai-phone-agent-cost/">ready-made agent</a> needs no integration: bookings and messages land in your own dashboard instead.</p>
    </>,
    faqs: [
      { q: "Can an AI phone agent book into ServiceTitan or Jobber?", a: "Yes. A custom agent connects to ServiceTitan, Jobber, Housecall Pro, simPRO, ServiceM8 and other field service tools through their APIs to check availability and book jobs. A ready-made agent books into its own dashboard instead." },
      { q: "What happens with emergency calls?", a: "You set the rules. Callers reporting dangers such as a gas smell can be told to leave and call 911, and urgent jobs can be transferred to your on-call technician." },
      { q: "How long does it take to set up?", a: "A ready-made agent is usually live in two to five days. A custom agent connected to your systems takes two to four weeks." },
    ],
    sources: [],
    related: ["what-happens-when-an-ai-phone-agent-gets-something-wrong", "how-much-does-an-ai-phone-agent-cost", "can-i-keep-my-business-phone-number"],
  },
  {
    slug: "ai-phone-agent-for-law-firms",
    category: "industries",
    label: "Law firms",
    title: "How can an AI phone agent handle intake for a law firm?",
    short: "An AI phone agent answers a law firm's calls, collects new-client intake details, screens for the practice areas you handle, books consultations and passes existing clients' messages to the right person. It never gives legal advice, and it connects to practice management tools like Clio, MyCase and PracticePanther.",
    description: "How an AI phone agent answers calls, runs new-client intake and books consultations for law firms, and the practice management tools it connects to.",
    demo: "northline",
    body: <>
      <h2>The calls it handles</h2>
      <ul>
        <li><strong>New-client intake.</strong> It asks the questions your intake form asks: the caller&rsquo;s name and contact details, what the matter is about, key dates, and the names of other parties so your team can run a conflict check.</li>
        <li><strong>Screening.</strong> If you only handle family law and personal injury, it says so politely and, if you like, suggests where else to look.</li>
        <li><strong>Consultation booking.</strong> It offers times from your calendar and books the consultation once the caller confirms.</li>
        <li><strong>Existing clients.</strong> &ldquo;Has my attorney filed the motion yet?&rdquo; It takes a detailed message for the right person rather than guessing.</li>
      </ul>
      <h2>What it won&rsquo;t do</h2>
      <p>It doesn&rsquo;t give legal advice, predict outcomes or quote fees you haven&rsquo;t approved. Those limits are written into the agent&rsquo;s rules, the same way our demo agents follow theirs on every call. When a caller pushes for advice, it explains that an attorney will follow up.</p>
      <h2>Confidentiality and recording</h2>
      <p>Intake calls can contain sensitive details, so you choose whether calls are recorded and how long transcripts are kept. If you record, check the consent rules where you and your callers are: several states, including California, Florida and Pennsylvania, require every party to agree to a recording, according to <Cite k="wiretap">Kilpatrick&rsquo;s state-by-state guide</Cite>. More on that in <a href="/answers/will-callers-know-they-are-talking-to-an-ai/">our disclosure answer</a>.</p>
      <h2>Tools it connects to</h2>
      <table>
        <thead><tr><th>Tool</th><th>What the agent can do there</th></tr></thead>
        <tbody>
          <tr><td>Clio, MyCase, PracticePanther, Smokeball</td><td>Create contacts and matters, book consultations into the firm calendar</td></tr>
          <tr><td>Lawmatics</td><td>Send new intakes into your intake pipeline</td></tr>
          <tr><td>Outlook, Google Calendar</td><td>Book consultations directly</td></tr>
        </tbody>
      </table>
    </>,
    faqs: [
      { q: "Will an AI phone agent give legal advice?", a: "No. It collects intake details, books consultations and takes messages. Its rules stop it from giving legal advice, predicting outcomes or quoting unapproved fees." },
      { q: "Can it connect to Clio?", a: "Yes. A custom agent can create contacts and matters and book consultations in Clio, MyCase, PracticePanther, Smokeball and Lawmatics through their APIs." },
      { q: "Are intake calls recorded?", a: "Only if you choose. If you record, several US states require every party's consent, so the agent can announce the recording at the start of the call." },
    ],
    sources: ["wiretap"],
    related: ["will-callers-know-they-are-talking-to-an-ai", "custom-ai-phone-agent-vs-template-build", "how-much-does-an-ai-phone-agent-cost"],
  },
  {
    slug: "ai-phone-agent-for-vet-clinics-and-pet-care",
    category: "industries",
    label: "Vet clinics and pet care",
    title: "What can an AI phone agent do for a vet clinic or pet care business?",
    short: "An AI phone agent books appointments, grooming and boarding, answers questions about hours and requirements, takes refill and callback requests, and points after-hours emergencies to an emergency clinic. It doesn't give medical advice, and it connects to tools like ezyVet, Vetspire and MoeGo.",
    description: "How an AI phone agent books appointments, grooming and boarding and handles after-hours calls for vet clinics and pet care businesses.",
    demo: "formfield",
    body: <>
      <h2>The calls it handles</h2>
      <ul>
        <li><strong>Appointments.</strong> Checkups, vaccinations, follow-ups. It asks for the pet&rsquo;s name and species and the reason for the visit, then books from real availability.</li>
        <li><strong>Grooming, daycare and boarding.</strong> Dates, the services wanted, and anything your team needs to know before drop-off.</li>
        <li><strong>Common questions.</strong> Hours, prices you&rsquo;ve approved, vaccination requirements for boarding, what to bring.</li>
        <li><strong>Refills and callbacks.</strong> It takes the request and sends it to your team to review. It never approves anything itself.</li>
      </ul>
      <h2>After hours and emergencies</h2>
      <p>The agent doesn&rsquo;t judge how sick an animal is. You decide what it says: for example, if a caller describes an emergency it gives the number and address of your partner emergency clinic straight away, and it can transfer the call during opening hours.</p>
      <h2>Does HIPAA apply?</h2>
      <p>HIPAA covers health information about people. It applies to health plans, clearinghouses and providers of human health care, according to the <Cite k="hhs">U.S. Department of Health and Human Services</Cite>, so it doesn&rsquo;t cover pets&rsquo; medical records. Your clients&rsquo; names, numbers and payment details are still personal information, so we keep the data your agent collects to what it needs. Digital Macaroni doesn&rsquo;t build agents for human medical practices.</p>
      <h2>Tools it connects to</h2>
      <table>
        <thead><tr><th>Tool</th><th>What the agent can do there</th></tr></thead>
        <tbody>
          <tr><td>ezyVet, Vetspire</td><td>Look up clients and patients, book appointments</td></tr>
          <tr><td>MoeGo</td><td>Book grooming, daycare and boarding</td></tr>
          <tr><td>SMS</td><td>Text reminders, confirmations and forms</td></tr>
        </tbody>
      </table>
      <p>Some practice management systems charge for API access. ezyVet, for example, requires approval through its owner&rsquo;s partner program, so we include any such costs in your quote.</p>
    </>,
    faqs: [
      { q: "Does HIPAA apply to vet clinics?", a: "No. HIPAA covers health information about people, held by human health care providers, health plans and clearinghouses. Pet medical records are outside it, though clients' personal details still need care." },
      { q: "Can the agent book into ezyVet or Vetspire?", a: "Yes. A custom agent can look up clients and book appointments through ezyVet's and Vetspire's APIs, and grooming or boarding through MoeGo." },
      { q: "What does it do with emergency calls?", a: "It follows your instructions, such as giving the details of your partner emergency clinic immediately or transferring the call during opening hours. It doesn't assess symptoms." },
    ],
    sources: ["hhs"],
    related: ["what-happens-when-an-ai-phone-agent-gets-something-wrong", "hosted-vs-managed-vs-self-hosted-ai-phone-agent", "how-much-does-an-ai-phone-agent-cost"],
  },
  {
    slug: "ai-phone-agent-for-auto-repair-shops",
    category: "industries",
    label: "Auto repair shops",
    title: "What can an AI phone agent do for an auto repair shop?",
    short: "An AI phone agent books service appointments, answers \"is my car ready?\" from your shop system, explains drop-off and pickup, takes messages for the service advisor, and texts customers confirmations. It connects to shop management tools like Shopmonkey and Tekmetric, and only quotes prices you've approved.",
    description: "How an AI phone agent books service, answers car-status calls and texts confirmations for auto repair shops using Shopmonkey or Tekmetric.",
    demo: "northline",
    body: <>
      <h2>The calls it handles</h2>
      <ul>
        <li><strong>&ldquo;Is my car ready?&rdquo;</strong> Connected to your shop system, it can look up the repair order and give the status, so your service advisors aren&rsquo;t on the phone all day.</li>
        <li><strong>Booking service.</strong> Oil changes, inspections, diagnostics. It takes the vehicle&rsquo;s year, make and model and the problem, and books a slot.</li>
        <li><strong>Drop-off and pickup.</strong> Hours, key drop, loaner or shuttle rules, what to bring.</li>
        <li><strong>Messages for the advisor.</strong> Questions about an estimate or approving extra work go to a person.</li>
      </ul>
      <h2>Prices and estimates</h2>
      <p>The agent only quotes prices you&rsquo;ve given it, such as a standard oil change. It doesn&rsquo;t estimate repairs. When a caller asks what a repair will cost, it books a diagnostic or takes a message for the advisor.</p>
      <h2>Texting</h2>
      <p>Customers often want the details in writing. The agent can text a confirmation with the time and address while still on the call. Business texting in the US needs carrier registration first; see <a href="/answers/can-i-keep-my-business-phone-number/">keeping your number</a>.</p>
      <h2>Tools it connects to</h2>
      <table>
        <thead><tr><th>Tool</th><th>What the agent can do there</th></tr></thead>
        <tbody>
          <tr><td>Shopmonkey, Tekmetric</td><td>Look up repair orders, book appointments, add customers and vehicles</td></tr>
          <tr><td>Google Calendar</td><td>Book into a shared calendar if you don&rsquo;t use shop software</td></tr>
          <tr><td>SMS</td><td>Text confirmations and status updates</td></tr>
        </tbody>
      </table>
    </>,
    faqs: [
      { q: "Can an AI phone agent tell customers if their car is ready?", a: "Yes, when it's connected to your shop management system, such as Shopmonkey or Tekmetric, it can look up the repair order and read back its status." },
      { q: "Will it quote repair prices?", a: "Only prices you've approved, like a standard service. For repair costs it books a diagnostic or takes a message for the service advisor." },
      { q: "Can it text customers?", a: "Yes. It can text confirmations and updates once your number is registered for business texting." },
    ],
    sources: [],
    related: ["custom-ai-phone-agent-vs-template-build", "can-i-keep-my-business-phone-number", "how-much-does-an-ai-phone-agent-cost"],
  },
  {
    slug: "ai-phone-agent-for-roofing-companies",
    category: "industries",
    label: "Roofing companies",
    title: "What can an AI phone agent do for a roofing company?",
    short: "An AI phone agent answers every call for a roofing company, including the rush after a storm, qualifies leads, books inspections, collects insurance claim details without giving claim advice, and texts callers a link to send photos. It connects to roofing tools like AccuLynx and JobNimbus.",
    description: "How an AI phone agent qualifies leads, books inspections and handles post-storm call volume for roofing companies using AccuLynx or JobNimbus.",
    demo: "northline",
    body: <>
      <h2>Why roofing is different</h2>
      <p>Call volume isn&rsquo;t steady. After a storm, the phones can ring all day while your crews are on roofs. An agent answers every one of those calls at once, so new leads don&rsquo;t go to the next company on the list.</p>
      <h2>The calls it handles</h2>
      <ul>
        <li><strong>Lead qualification.</strong> Address, type of property, what happened, whether it&rsquo;s leaking now, and the roof&rsquo;s approximate age.</li>
        <li><strong>Inspection booking.</strong> It offers inspection slots and books one when the caller confirms.</li>
        <li><strong>Insurance claims.</strong> It records the insurer and claim number if there is one. It doesn&rsquo;t advise on coverage or what a claim will pay.</li>
        <li><strong>Photos.</strong> It can text the caller a link to upload photos of the damage, so your estimator sees it before the visit.</li>
        <li><strong>Active leaks.</strong> You decide whether these go straight to an on-call number.</li>
      </ul>
      <h2>Tools it connects to</h2>
      <table>
        <thead><tr><th>Tool</th><th>What the agent can do there</th></tr></thead>
        <tbody>
          <tr><td>AccuLynx, JobNimbus</td><td>Create leads and jobs with the caller&rsquo;s details, book inspections</td></tr>
          <tr><td>Google Calendar, Outlook</td><td>Book inspections for your estimators</td></tr>
          <tr><td>SMS</td><td>Text confirmations and photo upload links</td></tr>
        </tbody>
      </table>
    </>,
    faqs: [
      { q: "Can an AI phone agent handle storm call volume?", a: "Yes. It answers every incoming call at the same time, so no caller waits on hold or goes to voicemail during a post-storm rush." },
      { q: "Does it give insurance claim advice?", a: "No. It records the insurer and claim number and books an inspection. Questions about coverage go to your team." },
      { q: "Can it connect to AccuLynx or JobNimbus?", a: "Yes. A custom agent creates leads and books inspections in AccuLynx or JobNimbus through their APIs." },
    ],
    sources: [],
    related: ["what-happens-when-an-ai-phone-agent-gets-something-wrong", "how-much-does-an-ai-phone-agent-cost", "hosted-vs-managed-vs-self-hosted-ai-phone-agent"],
  },

  /* ---------------- Costs and plans ---------------- */
  {
    slug: "how-much-does-an-ai-phone-agent-cost",
    category: "costs",
    label: "What it costs",
    title: "How much does an AI phone agent cost?",
    short: "Off-the-shelf AI receptionists start at about $29 a month. Agency-built agents typically cost $1,500 to $5,000 to set up plus $300 to $800 a month, and large custom builds run far higher. At Digital Macaroni, a ready-made agent is $2,500 and a custom agent starts at $5,000, plus a running plan from free to $399 a month.",
    description: "What AI phone agents cost in 2026, from off-the-shelf receptionists to agency and custom builds, and what Digital Macaroni charges.",
    demo: "northline",
    body: <>
      <h2>The market, roughly</h2>
      <table>
        <thead><tr><th>Option</th><th>Typical cost</th><th>What you get</th></tr></thead>
        <tbody>
          <tr><td>Off-the-shelf AI receptionist</td><td>From about $29/month, rising with calls or features</td><td>A general receptionist you configure yourself</td></tr>
          <tr><td>Agency-built single agent</td><td>$1,500 to $5,000 setup, $300 to $800/month</td><td>An agent set up for you, usually on a voice platform</td></tr>
          <tr><td>Agency-built, larger scope</td><td>$30,000 to $150,000 in the first year</td><td>Fully custom flows on a platform, live in 4 to 10 weeks</td></tr>
          <tr><td>Built from scratch</td><td>$250,000 to $2 million in the first year</td><td>Your own voice infrastructure, 4 to 9 months</td></tr>
        </tbody>
      </table>
      <p>These are industry figures, not quotes: off-the-shelf prices from <Cite k="aira">Aira&rsquo;s 2026 pricing comparison</Cite>, agency setup and retainer ranges from <Cite k="ciela">Ciela&rsquo;s 2026 pricing guide</Cite>, and larger builds from <Cite k="groovy">Groovy Web&rsquo;s build-vs-buy analysis</Cite>.</p>
      <h2>What Digital Macaroni charges</h2>
      <table>
        <thead><tr><th>Plan</th><th>Price</th><th>Includes</th></tr></thead>
        <tbody>
          <tr><td>Ready-made agent</td><td>$2,500 one-time</td><td>A proven agent rebuilt for your business: answers every call, books, takes messages, texts confirmations and summaries, transfers urgent calls, dashboard. Live in 2 to 5 days.</td></tr>
          <tr><td>Custom agent</td><td>From $5,000</td><td>Everything above, connected to your systems through their APIs, with two-way texting and your own call flows. Live in 2 to 4 weeks.</td></tr>
        </tbody>
      </table>
      <h2>Keeping it running</h2>
      <table>
        <thead><tr><th>Running plan</th><th>Monthly</th><th>Includes</th></tr></thead>
        <tbody>
          <tr><td>Self-hosted</td><td>Free from us ($500 one-time setup)</td><td>Built in your own phone and AI accounts; you pay those providers directly</td></tr>
          <tr><td>Hosted</td><td>From $149</td><td>Your number, 500 call minutes, 500 texts, your dashboard</td></tr>
          <tr><td>Managed</td><td>From $399</td><td>1,000 call minutes, 1,000 texts, changes on request, tuning, monthly report</td></tr>
        </tbody>
      </table>
      <p>Extras: $50 one-time to register your number for business texting, premium voices from $80 a month, and extra minutes or texts at the rate in your proposal. See the <a href="/#pricing">pricing section</a> and <a href="/answers/hosted-vs-managed-vs-self-hosted-ai-phone-agent/">how the running plans differ</a>.</p>
      <p>Before you compare prices, run your own numbers in the <a href="/missed-call-calculator/">missed call calculator</a>: it shows what unanswered calls cost you each month.</p>
      <h2>What actually drives the price</h2>
      <ul>
        <li><strong>Integrations.</strong> Each system the agent reads from or writes to adds build and testing time.</li>
        <li><strong>Call volume.</strong> Minutes cost real money at the phone and AI providers, so higher volume means a bigger plan.</li>
        <li><strong>Voice.</strong> Premium voices sound more natural and cost more per minute.</li>
        <li><strong>Who maintains it.</strong> Managed plans include ongoing changes; self-hosted puts that on your team.</li>
      </ul>
    </>,
    faqs: [
      { q: "How much does an AI receptionist cost per month?", a: "Off-the-shelf AI receptionists start at about $29 a month and rise with call volume or features. Agency-run agents typically cost $300 to $800 a month on top of a setup fee." },
      { q: "How much does a custom AI phone agent cost?", a: "At Digital Macaroni, custom agents start at $5,000, plus a running plan. Industry estimates for larger agency builds run from $30,000 to $150,000 in the first year." },
      { q: "Is there a monthly fee?", a: "Hosted plans start at $149 a month and managed plans at $399. Self-hosted agents have no monthly fee from us; you pay your phone and AI providers directly." },
    ],
    sources: ["aira", "ciela", "groovy"],
    related: ["hosted-vs-managed-vs-self-hosted-ai-phone-agent", "custom-ai-phone-agent-vs-template-build", "can-i-keep-my-business-phone-number"],
  },
  {
    slug: "hosted-vs-managed-vs-self-hosted-ai-phone-agent",
    category: "costs",
    label: "Hosted, managed or self-hosted",
    title: "Who maintains an AI phone agent: hosted, managed or self-hosted?",
    short: "Every AI phone agent needs a phone line, call minutes and someone to keep it working. With hosted, we run it and you request changes as needed. With managed, we run it and make changes, tune it from real calls and report monthly. With self-hosted, we build it in your own accounts and your team runs it.",
    description: "The difference between hosted, managed and self-hosted AI phone agents, and how to choose who keeps yours running.",
    demo: "travel",
    body: <>
      <h2>Why this matters</h2>
      <p>Building the agent is the start. Prices change, staff change, new services arrive and callers ask things nobody expected. In <Cite k="assemblyai">AssemblyAI&rsquo;s 2026 survey of voice agent builders</Cite>, 82.5% felt confident building voice agents, yet 75% struggled with reliability once agents were in production. Someone has to own that part.</p>
      <h2>The three options</h2>
      <table>
        <thead><tr><th></th><th>Self-hosted</th><th>Hosted</th><th>Managed</th></tr></thead>
        <tbody>
          <tr><td>Monthly fee from us</td><td>None ($500 one-time setup)</td><td>From $149</td><td>From $399</td></tr>
          <tr><td>Where it runs</td><td>Your own phone and AI accounts</td><td>Our infrastructure</td><td>Our infrastructure</td></tr>
          <tr><td>Minutes and texts</td><td>You pay providers directly</td><td>500 each included</td><td>1,000 each included</td></tr>
          <tr><td>Changes</td><td>Your team, or billed per change</td><td>Quoted when you need them</td><td>Included, on request</td></tr>
          <tr><td>Tuning from real calls</td><td>Your team</td><td>On request</td><td>Included</td></tr>
          <tr><td>Monthly report</td><td>No</td><td>No</td><td>Yes</td></tr>
          <tr><td>Fixes</td><td>30 days included</td><td>Included</td><td>Included</td></tr>
        </tbody>
      </table>
      <h2>How to choose</h2>
      <ul>
        <li><strong>Managed</strong> suits owners who want it to just work, and businesses whose prices, services or hours change often.</li>
        <li><strong>Hosted</strong> suits businesses whose details rarely change and who are happy to ask when they do.</li>
        <li><strong>Self-hosted</strong> suits larger businesses with technical staff who want everything in their own accounts.</li>
      </ul>
      <h2>How self-hosting works</h2>
      <p>You choose self-hosted at the start, and we build the agent directly in your accounts from day one, so nothing has to be moved later. You open the phone and AI accounts in your business&rsquo;s name, invite us in for the build, and testing during the build is billed to those accounts. At hand-over you get a short guide to running it, 30 days of fixes, and a license to use the agent. You can remove our access or keep it for paid changes.</p>
    </>,
    faqs: [
      { q: "What is a managed AI phone agent?", a: "One that the builder runs and maintains for you: hosting, call minutes, changes on request, tuning from real calls and a monthly report. At Digital Macaroni, managed plans start at $399 a month." },
      { q: "Can I self-host an AI phone agent?", a: "Yes. For a one-time $500 setup we build it in your own phone and AI accounts, you pay those providers directly, and you get 30 days of fixes." },
      { q: "Can I switch plans later?", a: "Yes. You can move between hosted and managed at any time. Moving to self-hosted later means setting the agent up in your accounts, so it's easiest to choose that at the start." },
    ],
    sources: ["assemblyai"],
    related: ["how-much-does-an-ai-phone-agent-cost", "custom-ai-phone-agent-vs-template-build", "what-happens-when-an-ai-phone-agent-gets-something-wrong"],
  },

  /* ---------------- How it works ---------------- */
  {
    slug: "what-happens-when-an-ai-phone-agent-gets-something-wrong",
    category: "how-it-works",
    label: "When it gets something wrong",
    title: "What happens when an AI phone agent gets something wrong?",
    short: "A well-built AI phone agent catches its own mistakes before they matter. It reads details back and waits for a yes before booking, lets callers correct it mid-call, texts written confirmations, and hands off to a person when it can't help. Every step is logged, so you can see what happened on each call.",
    description: "How a well-built AI phone agent avoids, catches and recovers from mistakes: read-backs, corrections, texted confirmations, handoffs and call logs.",
    demo: "northline",
    body: <>
      <h2>Where phone agents usually fail</h2>
      <p>The voice is rarely the problem. The failures are in the details: a misheard email address, a wrong date, a booking nobody confirmed, a caller who wants a person and can&rsquo;t get one. In <Cite k="assemblyai">AssemblyAI&rsquo;s 2026 survey</Cite>, voice agent builders named callers having to repeat themselves as the number one user frustration.</p>
      <h2>How our agents catch mistakes</h2>
      <ul>
        <li><strong>Read-back before anything happens.</strong> Before booking, changing or cancelling, the agent reads the details back and waits for a clear yes. Nothing is committed on a guess.</li>
        <li><strong>Corrections mid-call.</strong> &ldquo;Actually, make it Thursday.&rdquo; The agent updates the same booking rather than making a second one, and reads it back again.</li>
        <li><strong>Hard-to-hear details in writing.</strong> For email addresses and spellings, it can text the caller a confirmation or a short link to type it themselves.</li>
        <li><strong>Only real answers.</strong> It quotes only the times, prices and stock your systems return. If it doesn&rsquo;t know, it says so and takes a message.</li>
        <li><strong>A person when needed.</strong> Callers can always ask for someone. The agent transfers the call or takes a detailed message.</li>
      </ul>
      <h2>You can see every step</h2>
      <p>Each call is logged: what the caller said, every action the agent took, and how long each one took. Our live demos show this as it happens in the &ldquo;Behind the call&rdquo; panel. If something goes wrong, you can see exactly where, and it gets fixed in the agent&rsquo;s rules.</p>
      <h2>Rules it follows on every call</h2>
      <p>The model decides how to say things. The rules decide what it may do. Our demo agents, for example, never offer a time the live schedule didn&rsquo;t return, discuss an order only after the order number and email both match, and never take payment over the phone. Your agent gets rules written for your business.</p>
    </>,
    faqs: [
      { q: "What if an AI phone agent mishears someone?", a: "It reads the details back and waits for a yes before acting, so the caller can correct it. For things like email addresses it can text a confirmation or a link to type them." },
      { q: "Can callers reach a real person?", a: "Yes. A caller can ask for a person at any time, and the agent transfers the call or takes a detailed message for your team." },
      { q: "Can I see what the agent did on a call?", a: "Yes. Every call is logged with the conversation, each action the agent took and how long it took." },
    ],
    sources: ["assemblyai"],
    related: ["custom-ai-phone-agent-vs-template-build", "will-callers-know-they-are-talking-to-an-ai", "hosted-vs-managed-vs-self-hosted-ai-phone-agent"],
  },
  {
    slug: "custom-ai-phone-agent-vs-template-build",
    category: "how-it-works",
    label: "Custom vs a template build",
    title: "Custom AI phone agent vs. a free template build: what's the difference?",
    short: "A template build can answer a call and book a slot in an afternoon, and for a simple test that may be enough. A production agent adds what keeps real customers happy: read-backs and corrections, your rules, connections to your systems, texting registration, handoffs, call logs and someone maintaining it.",
    description: "What a free or 30-minute template AI phone agent leaves out compared with a custom, production-ready agent, and when a template is enough.",
    demo: "formfield",
    body: <>
      <h2>Why template builds look so good</h2>
      <p>Voice platforms have made the demo easy: an agent that picks up, sounds natural and books a slot can be set up quickly. The hard part comes later. In <Cite k="assemblyai">AssemblyAI&rsquo;s 2026 survey</Cite>, 82.5% of voice agent builders felt confident building agents, but 75% struggled with reliability once they were in production.</p>
      <h2>What a template usually leaves out</h2>
      <table>
        <thead><tr><th></th><th>Typical template build</th><th>Production agent</th></tr></thead>
        <tbody>
          <tr><td>Booking</td><td>Writes to a calendar</td><td>Uses your real availability, reads back and waits for a yes</td></tr>
          <tr><td>Corrections</td><td>Often creates duplicates</td><td>Updates the same booking</td></tr>
          <tr><td>Your systems</td><td>Rarely</td><td>Connected through their APIs</td></tr>
          <tr><td>Rules</td><td>A prompt</td><td>Written limits on what it may say and do</td></tr>
          <tr><td>Handoffs</td><td>Often missing</td><td>Transfers or detailed messages</td></tr>
          <tr><td>Texting</td><td>Often unregistered</td><td>Registered with carriers so texts arrive</td></tr>
          <tr><td>Call logs</td><td>Basic, if any</td><td>Every step and its timing</td></tr>
          <tr><td>After launch</td><td>You&rsquo;re on your own</td><td>Hosted or managed, with fixes</td></tr>
        </tbody>
      </table>
      <h2>When a template is enough</h2>
      <p>If you want to hear what an AI receptionist sounds like, or test whether callers in your market will talk to one, a template is a fine first step. Once real customers depend on it, the details above decide whether it helps or hurts.</p>
      <h2>Judge it by calling it</h2>
      <p>Don&rsquo;t judge any agent, including ours, by a video. Call it and try to trip it up: spell an email address, change your mind about the time, ask something it shouldn&rsquo;t answer, ask for a person.</p>
    </>,
    faqs: [
      { q: "Is a free AI receptionist template good enough?", a: "For hearing how one sounds or a quick test, yes. For real customers, templates often lack read-backs, corrections, integrations, handoffs, texting registration and maintenance." },
      { q: "What makes an AI phone agent production-ready?", a: "It confirms details before acting, handles corrections, follows written rules, connects to your systems, hands off to people, logs every step and has someone maintaining it." },
      { q: "How do I test an AI phone agent before buying?", a: "Call it. Spell an email address, change the appointment time, ask for something it shouldn't do and ask for a person, then check what landed in the system." },
    ],
    sources: ["assemblyai"],
    related: ["what-happens-when-an-ai-phone-agent-gets-something-wrong", "how-much-does-an-ai-phone-agent-cost", "hosted-vs-managed-vs-self-hosted-ai-phone-agent"],
  },
  {
    slug: "will-callers-know-they-are-talking-to-an-ai",
    category: "how-it-works",
    label: "Telling callers it's AI",
    title: "Will callers know they're talking to an AI?",
    short: "Only if you choose. Your agent can introduce itself as an AI assistant or not, and calls can be recorded or not. But the law may decide for you: in the EU, people must be told they're talking to AI, several US states require everyone's consent to record a call, and AI voices on outbound calls fall under US robocall rules.",
    description: "Whether an AI phone agent has to tell callers it's AI or that calls are recorded, and the EU and US rules that apply.",
    demo: "northline",
    body: <>
      <h2>Your choices</h2>
      <ul>
        <li><strong>Disclosure.</strong> The agent can open with something like &ldquo;Hi, this is Ellie, Northline&rsquo;s AI assistant,&rdquo; or simply use its name.</li>
        <li><strong>Recording.</strong> Calls can be recorded with an announcement, or not recorded at all. Transcripts can be kept or not.</li>
      </ul>
      <p>We set both to follow the rules where you and your callers are. This page isn&rsquo;t legal advice; check with your own counsel if you&rsquo;re unsure.</p>
      <h2>The rules that may apply</h2>
      <table>
        <thead><tr><th>Where</th><th>Rule</th><th>What it means for your agent</th></tr></thead>
        <tbody>
          <tr><td>European Union</td><td>EU AI Act, Article 50 (from 2 August 2026)</td><td>People must be told they&rsquo;re interacting with an AI system, unless it&rsquo;s obvious</td></tr>
          <tr><td>Several US states</td><td>All-party consent to record</td><td>If you record, every party must agree, so the agent announces it</td></tr>
          <tr><td>United States, outbound calls</td><td>FCC ruling under the TCPA (February 2024)</td><td>AI-generated voices count as &ldquo;artificial&rdquo; voices, so robocall consent rules apply to agents that place calls</td></tr>
        </tbody>
      </table>
      <p>Sources: the EU AI Act&rsquo;s transparency duty, as summarized by <Cite k="euAiAct">Cooley</Cite>; all-party consent states, including California, Florida, Illinois, Pennsylvania and Washington, from <Cite k="wiretap">Kilpatrick&rsquo;s wiretap law chart</Cite>; and the FCC&rsquo;s AI voice ruling, as summarized by <Cite k="fccAiVoice">Cooley</Cite>.</p>
      <h2>What we recommend</h2>
      <p>A short, friendly disclosure. Many callers are wary of AI on the phone, and an agent that&rsquo;s upfront about what it is, then gets the job done, builds more trust than one that hopes nobody notices. It also keeps you on the right side of the EU rule if you have European customers.</p>
    </>,
    faqs: [
      { q: "Does an AI phone agent have to say it's AI?", a: "In the EU, yes: from 2 August 2026, the AI Act requires telling people they're interacting with an AI system unless it's obvious. Elsewhere it's your choice, and we recommend a short disclosure." },
      { q: "Can AI phone calls be recorded?", a: "Yes, if you choose. Several US states, including California, require every party's consent, so the agent can announce the recording at the start." },
      { q: "Are AI voices allowed on outbound calls?", a: "In the US, the FCC ruled in February 2024 that AI-generated voices are artificial voices under the TCPA, so robocall consent rules apply to outbound AI calls." },
    ],
    sources: ["euAiAct", "wiretap", "fccAiVoice"],
    related: ["what-happens-when-an-ai-phone-agent-gets-something-wrong", "ai-phone-agent-for-law-firms", "can-i-keep-my-business-phone-number"],
  },
  {
    slug: "can-i-keep-my-business-phone-number",
    category: "how-it-works",
    label: "Keeping your number",
    title: "Can I keep my business phone number with an AI phone agent?",
    short: "Yes. You can port your existing number over so the agent answers it directly, forward calls from your current number to the agent all the time or only after hours, or keep your phone system and route calls to the agent. We work with Twilio, Telnyx or the phone system you already use.",
    description: "How to keep your existing business number with an AI phone agent: porting, call forwarding or routing from your current phone system.",
    demo: "formfield",
    body: <>
      <h2>Three ways to keep your number</h2>
      <table>
        <thead><tr><th>Option</th><th>How it works</th><th>Good for</th></tr></thead>
        <tbody>
          <tr><td>Port the number</td><td>Your number moves to a voice provider such as Twilio or Telnyx, and the agent answers it directly</td><td>Businesses that want the agent as the main line</td></tr>
          <tr><td>Forward calls</td><td>Your current provider forwards calls to the agent&rsquo;s number: always, after hours, or when nobody picks up</td><td>Trying it out, or covering only missed and after-hours calls</td></tr>
          <tr><td>Route from your phone system</td><td>Your existing phone system sends certain calls to the agent, such as one option on a menu</td><td>Businesses with an office phone system they want to keep</td></tr>
        </tbody>
      </table>
      <p>Moving a number between providers in the same area is your right in the US; the <Cite k="fccPorting">FCC&rsquo;s porting guide</Cite> explains how it works. Keep your current service active until the port completes, so the number never stops working.</p>
      <h2>Texting from your number</h2>
      <p>If your agent sends texts, US carriers require the number to be registered for business texting (known as A2P 10DLC) first. Registration has its own carrier fees, listed by <Cite k="twilio10dlc">Twilio</Cite>. We handle it for a one-time $50.</p>
      <h2>A common way to start</h2>
      <p>Forward only the calls you&rsquo;d otherwise miss: after hours, or when nobody answers within a few rings. Your team keeps answering as normal, and the agent catches everything else. Many businesses move the whole line to the agent once they&rsquo;ve seen it work.</p>
    </>,
    faqs: [
      { q: "Can I keep my existing business number?", a: "Yes. You can port it to a voice provider such as Twilio or Telnyx, forward calls to the agent, or route calls from your current phone system." },
      { q: "Can the agent answer only after hours?", a: "Yes. Your provider can forward calls to the agent after hours or when nobody answers, while your team takes calls as usual." },
      { q: "Do I need to register my number to send texts?", a: "In the US, yes. Business texting from local numbers requires A2P 10DLC registration with the carriers. Digital Macaroni handles it for a one-time $50." },
    ],
    sources: ["fccPorting", "twilio10dlc"],
    related: ["how-much-does-an-ai-phone-agent-cost", "will-callers-know-they-are-talking-to-an-ai", "ai-phone-agent-for-home-services"],
  },
];

export const answerBySlug = (slug: string) => ANSWERS.find((a) => a.slug === slug);
