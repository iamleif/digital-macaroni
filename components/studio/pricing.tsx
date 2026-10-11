import { ArrowUpRight, Check } from "./icons";
import { Reveal } from "./reveal";
import h from "./home.module.css";

/** Every feature line; the homepage shows the first few of each, /pricing/ shows them all. */
const READY = [
  "Answers every call, day or night: books appointments, answers questions and takes messages",
  "Knowledge base: trained on your services, prices, FAQs and policies",
  "One integration: your calendar, CRM or any software with an API, plus Zapier for thousands of other apps",
  "Texts callers confirmations and links, and texts you a summary after every call",
  "Full admin control, plus unlimited users",
  "Transfers urgent calls to you or your team",
  "Your brand: business name, voice, greeting and hours",
  "Every call’s transcript and summary in your dashboard",
  "Email support and 30 days of fixes after launch",
];
const CUSTOM = [
  "Everything in the core agent",
  "Deep knowledge base: built from your website, documents and past calls, and kept current",
  "Five or more connections that write back: creates leads, updates records and books into your CRM, calendar or practice software",
  "Your own intake and qualification scripts, with routing by department, location or case type",
  "Outbound: callbacks, reminders, follow-ups and two-way texting",
  "Multiple numbers, locations and languages",
  "Designed and tested on your real calls before launch",
  "90 days of tuning after launch and priority support",
  "Fixed scope and price, agreed up front",
];
const SHORT = 5;

/** What a company can bring us in for. Shared by the consulting card and /consulting/. */
export const CONSULTING_AREAS = [
  "Voice inside your product",
  "Phones and support to AI agents",
  "Architecture and build reviews",
  "Hands-on build sprints",
  "Training your team",
  "Long-term projects",
];

export function PlanCards({ full = false }: { full?: boolean }) {
  const ready = full ? READY : READY.slice(0, SHORT);
  const custom = full ? CUSTOM : CUSTOM.slice(0, SHORT);
  return <div className={h.plans}>
    <Reveal className={h.planShell}>
      <article className={h.plan}>
        <p className={h.planName}>Core agent</p>
        <p className={h.planPrice}>$2,500<span>one-time</span></p>
        <p className={h.planPitch}>One of our proven agents, branded as your business, connected to your calendar or CRM, tested and launched for you in 2 to 5 days.</p>
        <ul>{ready.map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
        <a className={h.pillOutline} href="/contact/?topic=core-agent">Start with a core agent <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
      </article>
    </Reveal>
    <Reveal delay={90} className={h.planShell}>
      <article className={h.plan} data-featured>
        <p className={h.planName}>Custom agent<em>Most flexible</em></p>
        <p className={h.planPrice}><small>from</small>$6,000</p>
        <p className={h.planPitch}>Everything in the core agent, built around your business and connected to the tools you already use.</p>
        <ul>{custom.map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
        <a className={h.pillYellow} href="/contact/?topic=custom-agent">Shape a custom project <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
      </article>
    </Reveal>
  </div>;
}

/** The wide card under the two plans: bigger engagements, priced once the work is scoped. */
export function ConsultingCard() {
  return <Reveal className={`${h.planShell} ${h.consultShell}`}>
    <article className={h.consult}>
      <div className={h.consultCopy}>
        <p className={h.planName}>Consulting</p>
        <p className={h.consultTitle}>Bring us in on a bigger project.</p>
        <p className={h.planPitch}>For companies putting voice AI into their product, moving their phones or support to AI agents, or getting a stalled build over the line. A few days on site, or months alongside your team.</p>
      </div>
      <div className={h.consultSide}>
        <ul className={h.consultAreas}>{CONSULTING_AREAS.map((a) => <li key={a}>{a}</li>)}</ul>
        <p className={h.consultPrice}>Scoped and priced per engagement</p>
        <a className={h.pillOutline} href="/consulting/">See how consulting works <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
      </div>
    </article>
  </Reveal>;
}

/** Running plans and extras: the full breakdown that lives on /pricing/. */
export function RunningCosts() {
  return <Reveal className={h.running}>
    <div className={h.runningHead}><h3>Keeping it running</h3><p>The agent price is a one-time build. Every agent also needs a phone line, call minutes and texts: run it yourself, or let us handle it.</p></div>
    <div className={h.runningPlans}>
      <div><p className={h.runName}>Self-hosted</p><p className={h.runPrice}>Free<span>/mo from us</span></p><p>We get you set up with your own phone and AI accounts and build your agent there. You run it yourself, with 30 days of fixes included. One-time $500 setup.</p></div>
      <div><p className={h.runName}>Hosted</p><p className={h.runPrice}>$349<span>/mo</span></p><p>We keep it running: your number, 500 call minutes, 500 texts, your dashboard and email support. Changes are quoted when you need them. Billed monthly in advance, 3-month minimum, then month-to-month.</p></div>
      <div data-featured><p className={h.runName}>Managed<em>Hands-off</em></p><p className={h.runPrice}>$749<span>/mo</span></p><p>We run it for you: 1,000 call minutes, 1,000 texts, up to 2 hours of changes a month, tuning from real calls, a monthly report and same-day email support. Billed monthly in advance, 3-month minimum, then month-to-month.</p></div>
    </div>
    <div className={h.extras}>
      <div className={h.runningHead}><h3>Extras</h3><p>Add-ons for either agent, core or custom.</p></div>
      <div className={h.extraList}>
        <div><p className={h.runName}>Self-hosted setup</p><p className={h.extraPrice}>$500<span>one-time</span></p><p>Setting up your own accounts, building and testing your agent in them, and a short guide for running it.</p></div>
        <div><p className={h.runName}>Texting registration</p><p className={h.extraPrice}>$50<span>one-time</span></p><p>Registers your number and business with the carriers (A2P 10DLC), so your agent’s texts reach your customers. Needed for texting in the US, on either plan.</p></div>
        <div><p className={h.runName}>Premium voices</p><p className={h.extraPrice}>+$80<span>/mo Hosted</span></p><p>Our most natural voices: +$100/mo on Managed. On Self-hosted, you pay the voice provider’s rate.</p></div>
        <div><p className={h.runName}>Extra connections</p><p className={h.extraPrice}>$750<span>each</span></p><p>Add a calendar, CRM or API connection to a core agent, before or after launch.</p></div>
        <div><p className={h.runName}>Extra minutes &amp; texts</p><p className={h.extraPrice}>As needed</p><p>Billed per minute and per text at the rate in your proposal if you go over your plan’s allowance.</p></div>
      </div>
    </div>
    <p className={h.offerNote}>Need several agents? <a href="/contact/">Let’s talk</a>.</p>
  </Reveal>;
}
