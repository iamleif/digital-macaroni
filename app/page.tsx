import type { Metadata } from "next";
import Image from "next/image";
import { Agents } from "@/components/studio/agents";
import { HeroApp } from "@/components/studio/hero-app";
import { ArrowDown, ArrowUpRight, Device, Globe, Grid, Phone, Plug, Sparkle, Wave } from "@/components/studio/icons";
import { StudioAskBand, StudioFooter, StudioNav } from "@/components/studio/chrome";
import { ConsultingCard, PlanCards } from "@/components/studio/pricing";
import { Intro, Reveal } from "@/components/studio/reveal";
import { answerBySlug } from "@/components/studio/answers/content";
import { pageMeta } from "@/components/studio/site";
import { DEFAULT_MISSED, DEFAULT_RATE, TRADES, lostRevenue } from "@/components/studio/calculator/math";
import h from "@/components/studio/home.module.css";

export const metadata: Metadata = pageMeta({
  title: "Digital Macaroni — AI voice agents and software that get to work",
  shareTitle: "Digital Macaroni — AI agents that take action inside real business workflows",
  description: "Digital Macaroni builds AI agents that take action inside real business workflows: voice agents, software and automations that turn conversations into completed work. Call a live demo agent and watch it work.",
  path: "/",
  ownImage: true,
});

const services = [
  {
    id: "voice",
    dark: true,
    icon: <Wave size={20} />,
    title: "Voice agents",
    copy: "Agents that answer the phone, understand what callers need and do the work, all in your brand’s voice.",
    tags: ["Booking & rescheduling", "Orders & stock checks", "Lead intake & qualifying", "Reminders & follow-ups", "Messages & handoff", "After-hours cover"],
  },
  {
    id: "automations",
    icon: <Plug size={20} />,
    title: "Automations & integrations",
    copy: "Connect the tools you already run, so a conversation turns into a booking, a record, an invoice or a message to the right person.",
    tags: ["CRM updates", "Calendars & scheduling", "Text & email follow-ups", "Slack & Teams alerts", "Invoices & payments", "APIs & webhooks"],
  },
  {
    id: "software",
    icon: <Grid size={20} />,
    title: "Business software",
    copy: "Dashboards and back-office tools shaped around how your team actually works.",
    tags: ["Dashboards", "Internal tools", "Admin panels", "Reporting", "Scheduling & dispatch", "Customer records"],
  },
  {
    id: "apps",
    icon: <Device size={20} />,
    title: "Apps",
    copy: "Web and mobile apps for your customers and your team, from first prototype to the App Store.",
    tags: ["iOS", "Android", "Web apps", "Customer portals", "Booking apps", "Prototypes & MVPs"],
  },
];

/** Flags beside the languages copy, in a 4×4 grid whose last cell says there are more. SVGs in public/studio/flags (country-flag-icons, MIT). A flag stands in for a language, not a market. */
const flags = ["us", "es", "fr", "de", "it", "br", "nl", "pl", "se", "gr", "hr", "in", "cn", "jp", "kr"];

/** The 32 languages on the real-time voice engine's published list. */
const languages: [string, string][] = [
  ["English", ""], ["Spanish", "Español"], ["French", "Français"], ["German", "Deutsch"], ["Italian", "Italiano"], ["Portuguese", "Português"], ["Dutch", "Nederlands"], ["Polish", "Polski"],
  ["Swedish", "Svenska"], ["Norwegian", "Norsk"], ["Danish", "Dansk"], ["Finnish", "Suomi"], ["Czech", "Čeština"], ["Slovak", "Slovenčina"], ["Hungarian", "Magyar"], ["Romanian", "Română"],
  ["Bulgarian", "Български"], ["Croatian", "Hrvatski"], ["Greek", "Ελληνικά"], ["Turkish", "Türkçe"], ["Ukrainian", "Українська"], ["Russian", "Русский"], ["Arabic", "العربية"], ["Hindi", "हिन्दी"],
  ["Tamil", "தமிழ்"], ["Chinese", "中文"], ["Japanese", "日本語"], ["Korean", "한국어"], ["Vietnamese", "Tiếng Việt"], ["Indonesian", "Bahasa Indonesia"], ["Malay", "Bahasa Melayu"], ["Filipino", "Tagalog"],
];

/** A short sample of tools with documented APIs (checked against their developer docs, 2026-10-04). Examples, not partnerships. */
const tools = ["Calendly", "HubSpot", "Salesforce", "GoHighLevel", "Keap", "ServiceTitan", "Housecall Pro", "AccuLynx", "Clio", "Lawmatics", "Applied Epic", "Shopify", "Square", "QuickBooks", "Slack", "WhatsApp"];

/** Homepage questions: each links to its full answer page. */
const homeFaqs = ["how-much-does-an-ai-phone-agent-cost", "what-happens-when-an-ai-phone-agent-gets-something-wrong", "can-i-keep-my-business-phone-number", "will-callers-know-they-are-talking-to-an-ai", "hosted-vs-managed-vs-self-hosted-ai-phone-agent", "custom-ai-phone-agent-vs-template-build"]
  .map((slug) => answerBySlug(slug)!)
  .filter(Boolean);

const steps = [
  { title: "Tell us what you need", copy: "A few questions about your business and the calls you get. It takes a couple of minutes." },
  { title: "We write back", copy: "We read it properly and reply by email with questions and ideas for your business." },
  { title: "A clear proposal", copy: "Scope, price and timeline in writing, agreed before any work begins." },
];

// The homepage card runs the calculator's own defaults across very different businesses, so the two always agree.
const EXAMPLES = ["law", "dental", "medspa", "hvac", "salon"].map((id) => {
  const trade = TRADES.find((t) => t.id === id)!;
  return { label: trade.label, lost: lostRevenue({ missed: DEFAULT_MISSED, ticket: trade.ticket, rate: DEFAULT_RATE }).monthly };
});

export default function HomePage() {
  return <div className={h.page}>
    <main id="content" className={h.contents}>
    {/* Hero */}
    <section className={`${h.sheet} ${h.heroSheet}`} aria-labelledby="hero-heading">
      <StudioNav home />

      <div>
        <div className={h.heroCopy}>
          <Intro delay={80}><h1 id="hero-heading" className={h.heroTitle}>
            Voice agents <span className={h.chip} data-tone="yellow"><Wave size={26} /></span> and software
            <br className={h.brDesk} /> that <span className={h.stickerWrap}>get to work<span className={h.sticker}>Live</span></span>
          </h1></Intro>
          <Intro delay={160}><p className={h.heroSub}>We design and build custom AI voice agents, dashboards and apps, made to look, sound and run like your business.</p></Intro>
          <Intro delay={240} className={h.heroActions}>
            <a className={h.pillDark} href="#agents">Try a live demo<span className={h.pillIcon}><ArrowDown size={14} /></span></a>
            <a className={h.pillLight} href="#pricing">See pricing</a>
          </Intro>
        </div>
        <Intro delay={360}><HeroApp /></Intro>
      </div>
    </section>

    {/* Agents */}
    <section id="agents" className={h.sheet} aria-labelledby="agents-heading">
      <div className={h.sheetInner}>
        <div className={h.sectionHead}>
          <Reveal><h2 id="agents-heading" className={h.h2}>Meet the agents <span className={h.chip} data-tone="purple"><Wave size={20} /></span><br />then give one a call</h2><p className={h.lede}>Three sample businesses, three voice agents. Call one from your phone and watch it work on screen.</p></Reveal>
        </div>
        <Agents />
        <p className={h.note}>Live AI agents on fictional businesses. Nothing is really booked, sold or charged. <a href="/demo-terms/">Demo terms</a></p>
      </div>
    </section>

    {/* Languages */}
    <section id="languages" className={`${h.sheet} ${h.darkSheet} ${h.langSheet}`} aria-labelledby="languages-heading">
      <div className={`${h.sheetInner} ${h.langInner}`}>
        <Reveal className={h.langCopy}>
          <div className={h.langIcon}><span className={h.chip} data-tone="yellow"><Globe size={22} /></span></div>
          <h2 id="languages-heading" className={h.h2}>Speaks your customers’ language.</h2>
          <p>Your agent can speak many languages, so callers can talk in the one they’re most comfortable with, from the first question to the booking.</p>
          <p className={h.langNote}>{languages.length} languages and more. Available languages depend on the voice chosen for your agent.</p>
          <ul className={h.srOnly}>{languages.map(([name]) => <li key={name}>{name}</li>)}</ul>
        </Reveal>
        <Reveal delay={80} className={h.flagGrid}>
          {flags.map((code) => <Image key={code} unoptimized src={`/studio/flags/${code}.svg`} alt="" width={84} height={56} />)}
          <span className={h.flagMore}>+ many more</span>
        </Reveal>
      </div>
    </section>

    {/* Integrations */}
    <section id="integrations" className={h.sheet} aria-labelledby="integrations-heading">
      <div className={`${h.sheetInner} ${h.toolStrip}`}>
        <Reveal>
          <h2 id="integrations-heading" className={h.h2}>Works with the tools <span className={h.chip} data-tone="blue"><Plug size={21} /></span> you already run</h2>
          <p className={h.lede}>Your agent checks your calendar, updates your CRM and sends the follow-up, in the systems your team already works in.</p>
        </Reveal>
        <Reveal delay={80} className={h.toolCloud}>
          <p className={h.toolNote}><Sparkle size={13} />Just a few examples. If you can think of it, we can connect to it.</p>
          <ul aria-label="Examples of tools we connect to">
            {tools.map((t) => <li key={t}>{t}</li>)}
            <li data-any>Anything with an API</li>
          </ul>
          <a className={h.toolAsk} href="/contact/?topic=custom-agent">Ask about your tools<ArrowUpRight size={14} /></a>
        </Reveal>
      </div>
    </section>

    {/* Services */}
    <section id="services" className={h.sheet} aria-labelledby="services-heading">
      <div className={h.sheetInner}>
        <div className={h.sectionHead}>
          <Reveal><h2 id="services-heading" className={h.h2}>What we <span className={h.chip} data-tone="orange"><Sparkle size={20} /></span> build<br />for your business</h2><p className={h.lede}>Voice agents, automations, software and apps, made properly by one team.</p></Reveal>
        </div>
        <div className={h.serviceGrid}>
          {services.map((sv, i) => <Reveal key={sv.id} as="article" delay={i * 80} className={h.service} >
            <div className={h.serviceCard} data-dark={sv.dark || undefined}>
              <span className={h.serviceIcon}>{sv.icon}</span>
              <h3>{sv.title}</h3>
              <p>{sv.copy}</p>
              <div className={h.serviceTags}>{sv.tags.map((t) => <span key={t}>{t}</span>)}</div>
            </div>
          </Reveal>)}
        </div>
      </div>
    </section>

    {/* Missed call calculator */}
    <section id="calculator" className={h.sheet} aria-labelledby="calculator-heading">
      <div className={`${h.sheetInner} ${h.calcPromo}`}>
        <Reveal>
          <h2 id="calculator-heading" className={h.h2}>What are missed calls <span className={h.chip} data-tone="yellow"><Phone size={22} /></span> costing you?</h2>
          <p className={h.lede}>Pick your kind of business, enter last month&rsquo;s missed calls, and see what they cost you in a few seconds. Typical values for home services, law firms, clinics, salons and more, with sources. No signup.</p>
          <div className={h.ctaActions}>
            <a className={h.pillDark} href="/missed-call-calculator/">Run your numbers<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <a href="/missed-call-calculator/" className={h.calcMini} aria-label="Open the missed call calculator">
            <p className={h.calcMiniHead}>{DEFAULT_MISSED} missed calls a month, 1 in 4 would have booked</p>
            <ul className={h.calcMiniRows}>
              {EXAMPLES.map((x) => <li key={x.label}><span>{x.label}</span><b>${Math.round(x.lost).toLocaleString("en-US")}<small> a month</small></b></li>)}
            </ul>
            <div className={h.calcMiniResult}>
              <b>What&rsquo;s yours?</b>
              <span>Pick your business and run your own numbers<ArrowUpRight size={15} /></span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>

    {/* Start a conversation */}
    <section id="studio" className={`${h.sheet} ${h.ctaSheet}`} aria-labelledby="studio-heading">
      <div className={`${h.sheetInner} ${h.cta}`}>
        <Reveal className={h.ctaCopy}>
          <span className={h.ctaMark}><Image unoptimized src="/studio/macaroni.png" alt="" width={56} height={56} /></span>
          <h2 id="studio-heading" className={h.h2}>Let’s talk it through.</h2>
          <p className={h.lede}>Want to win more business from the calls you already get, give your customers a better experience, or free your team from the phone? Drop us a note, tell us what you need, and we’ll take it from there.</p>
          <div className={h.ctaActions}>
            <a className={h.pillDark} href="/contact/">Drop us a note<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
          </div>
        </Reveal>
        <ol className={h.steps}>
          {steps.map((st, i) => <Reveal as="div" key={st.title} delay={i * 80} className={h.step}>
            <span className={h.stepNo}>{i + 1}</span>
            <div><b>{st.title}</b><p>{st.copy}</p></div>
          </Reveal>)}
        </ol>
      </div>
    </section>

    {/* Pricing: the two plans and consulting; the full breakdown lives on /pricing/. */}
    <section id="pricing" className={`${h.sheet} ${h.darkSheet}`} aria-labelledby="pricing-heading">
      <div className={h.sheetInner}>
        <div className={h.priceHead}>
          <Reveal><h2 id="pricing-heading" className={h.h2}>Clear pricing.<br /><span>Built around your business.</span></h2></Reveal>
          <Reveal delay={80}><p className={h.pricingLede}>Start with a proven agent, or have one built around your systems. Either way, you know the price before any work begins.</p></Reveal>
        </div>
        <PlanCards />
        <ConsultingCard />
        <Reveal className={h.pricingMore}>
          <p>Running plans from $149/mo, extras and everything that&rsquo;s included.</p>
          <a className={h.pillOutline} href="/pricing/">See full pricing <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
        </Reveal>
      </div>
    </section>

    {/* Questions */}
    <section id="questions" className={h.sheet} aria-labelledby="questions-heading">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: homeFaqs.map((f) => ({ "@type": "Question", name: f.title, acceptedAnswer: { "@type": "Answer", text: f.short } })) }).replace(/</g, "\\u003c") }} />
      <div className={`${h.sheetInner} ${h.faqWrap}`}>
        <Reveal className={h.faqHead}>
          <h2 id="questions-heading" className={h.h2}>Questions,<br /><span>answered straight.</span></h2>
          <p className={h.lede}>The things people ask before they buy. Each one links to a full answer with sources.</p>
          <a className={h.pillLight} href="/answers/">All answers<span className={h.pillIcon} style={{ background: "rgba(15,15,13,.06)" }}><ArrowUpRight size={14} /></span></a>
        </Reveal>
        <div className={h.faqList}>
          {homeFaqs.map((f) => <details key={f.slug} className={h.faqItem}>
            <summary>{f.title}</summary>
            <p>{f.short}</p>
            <a href={`/answers/${f.slug}/`}>Read the full answer<ArrowUpRight size={13} /></a>
          </details>)}
        </div>
      </div>
    </section>

    </main>

    <StudioAskBand />

    <StudioFooter />
  </div>;
}
