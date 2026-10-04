import type { Metadata } from "next";
import Image from "next/image";
import { Agents } from "@/components/studio/agents";
import { HeroApp } from "@/components/studio/hero-app";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, Device, Globe, Grid, Plug, Sparkle, Wave } from "@/components/studio/icons";
import { Intro, Reveal } from "@/components/studio/reveal";
import { Work } from "@/components/studio/work";
import h from "@/components/studio/home.module.css";

export const metadata: Metadata = {
  title: { absolute: "Digital Macaroni — Voice agents and software that get to work" },
  description: "Digital Macaroni designs and builds custom AI voice agents, dashboards and apps for businesses. Call one of our live demo agents and watch it work.",
  alternates: { canonical: "/" },
};

const services = [
  {
    id: "voice",
    dark: true,
    icon: <Wave size={20} />,
    title: "Voice agents",
    copy: "Agents that answer the phone, book the job and hand off the rest, all in your brand’s voice.",
    tags: ["Booking & rescheduling", "Shop & order help", "Messages & handoff", "After-hours cover"],
  },
  {
    id: "software",
    icon: <Grid size={20} />,
    title: "Business software",
    copy: "Dashboards and back-office tools shaped around how your team actually works.",
    tags: ["Dashboards", "Internal tools", "Integrations"],
  },
  {
    id: "apps",
    icon: <Device size={20} />,
    title: "Apps",
    copy: "Web and mobile apps for your customers, from first prototype to the App Store.",
    tags: ["iOS & web", "Customer portals"],
  },
];

/** The 32 languages on the real-time voice engine's published list. */
const languages: [string, string][] = [
  ["English", ""], ["Spanish", "Español"], ["French", "Français"], ["German", "Deutsch"], ["Italian", "Italiano"], ["Portuguese", "Português"], ["Dutch", "Nederlands"], ["Polish", "Polski"],
  ["Swedish", "Svenska"], ["Norwegian", "Norsk"], ["Danish", "Dansk"], ["Finnish", "Suomi"], ["Czech", "Čeština"], ["Slovak", "Slovenčina"], ["Hungarian", "Magyar"], ["Romanian", "Română"],
  ["Bulgarian", "Български"], ["Croatian", "Hrvatski"], ["Greek", "Ελληνικά"], ["Turkish", "Türkçe"], ["Ukrainian", "Українська"], ["Russian", "Русский"], ["Arabic", "العربية"], ["Hindi", "हिन्दी"],
  ["Tamil", "தமிழ்"], ["Chinese", "中文"], ["Japanese", "日本語"], ["Korean", "한국어"], ["Vietnamese", "Tiếng Việt"], ["Indonesian", "Bahasa Indonesia"], ["Malay", "Bahasa Melayu"], ["Filipino", "Tagalog"],
];

/** Tools with public APIs, grouped the way an owner thinks about them. Examples, not partnerships. */
const integrations: { group: string; tools: string[] }[] = [
  { group: "Calendars & booking", tools: ["Google Calendar", "Outlook", "Calendly", "Acuity", "Clio"] },
  { group: "CRM", tools: ["HubSpot", "Salesforce", "Pipedrive", "GoHighLevel"] },
  { group: "Field service", tools: ["ServiceTitan", "Jobber", "Housecall Pro"] },
  { group: "Commerce & payments", tools: ["Shopify", "Square", "Stripe"] },
  { group: "Messages", tools: ["SMS", "Email", "Slack", "Microsoft Teams"] },
  { group: "Data", tools: ["Google Sheets", "Airtable", "Notion", "Your database"] },
];

/** An example call: what the agent did, and where each action landed. */
const exampleActions: [string, string, string][] = [
  ["check_availability", "Checked the schedule", "Google Calendar"],
  ["find_customer", "Found the customer", "HubSpot"],
  ["book_job", "Booked the job", "Jobber"],
  ["send_confirmation", "Texted a confirmation", "SMS"],
];

const stats = [
  { value: "3", label: "Live voice agents you can call today", tab: "Right now" },
  { value: "3", label: "Products we’ve built and run ourselves" },
  { value: "1", label: "Team from first sketch to launch" },
];

export default function HomePage() {
  return <div className={h.page}>
    <main id="content" className={h.contents}>
    {/* Hero */}
    <section className={`${h.sheet} ${h.heroSheet}`} aria-labelledby="hero-heading">
      <header className={h.nav}>
        <a href="#" className={h.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={30} height={30} priority />Digital Macaroni</a>
        <nav aria-label="Studio navigation" className={h.navLinks}><a href="#agents">Voice demos</a><a href="#services">Services</a><a href="#work">Work</a><a href="#pricing">Pricing</a></nav>
        <a className={h.navCta} href="/contact/">Let’s talk</a>
      </header>

      <div>
        <div className={h.heroCopy}>
          <Intro><a href="#agents" className={h.proofChip}><span className={h.liveDot} />Three live agents · call one right now<ArrowDown size={13} /></a></Intro>
          <Intro delay={80}><h1 id="hero-heading" className={h.heroTitle}>
            Voice agents <span className={h.chip} data-tone="yellow"><Wave size={26} /></span> and software
            <br className={h.brDesk} /> that <span className={h.stickerWrap}>get to work<span className={h.sticker}>Live</span></span>
          </h1></Intro>
          <Intro delay={160}><p className={h.heroSub}>We design and build custom AI voice agents, dashboards and apps, made to look, sound and run like your business.</p></Intro>
          <Intro delay={240} className={h.heroActions}>
            <a className={h.pillDark} href="#agents">Try a live demo<span className={h.pillIcon}><ArrowDown size={14} /></span></a>
            <a className={h.pillLight} href="#work">See our work</a>
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
      <div className={h.sheetInner}>
        <div className={h.langHead}>
          <Reveal>
            <p className={h.kickerDark}>Languages</p>
            <h2 id="languages-heading" className={h.h2}>Speaks your customers’ <span className={h.chip} data-tone="yellow"><Globe size={22} /></span> language.</h2>
          </Reveal>
          <Reveal delay={80} className={h.langAside}>
            <p>Your agent can speak many languages, so callers can talk in the one they’re most comfortable with, from the first question to the booking.</p>
          </Reveal>
        </div>
        <Reveal className={h.langGrid}>
          {languages.map(([name, native]) => <div key={name} className={h.lang}><b>{name}</b><span>{native || "\u00a0"}</span></div>)}
        </Reveal>
        <p className={h.langNote}>And many more. Available languages depend on the voice chosen for your agent.</p>
      </div>
    </section>

    {/* Integrations */}
    <section id="integrations" className={h.sheet} aria-labelledby="integrations-heading">
      <div className={h.sheetInner}>
        <div className={h.sectionHead}>
          <Reveal><h2 id="integrations-heading" className={h.h2}>Works with the tools <span className={h.chip} data-tone="blue"><Plug size={21} /></span><br />you already run</h2><p className={h.lede}>Your agent doesn’t just talk. It checks your calendar, updates your CRM and sends the follow-up, in the systems your team already works in.</p></Reveal>
        </div>
        <div className={h.connect}>
          <Reveal className={h.flowShell}>
            <div className={h.flow} aria-label="Example: what an agent does on one call">
              <div className={h.flowTop}><span className={h.flowOrb} /><div><b>One call, four systems</b><small>Example booking call</small></div><span className={h.flowLive}><i />On a call</span></div>
              <ol>{exampleActions.map(([tool, did, where]) => <li key={tool}><span className={h.flowCheck}><Check size={12} /></span><div><b>{did}</b><code>{tool}</code></div><ArrowRight size={14} /><em>{where}</em></li>)}</ol>
            </div>
          </Reveal>
          <div className={h.toolGroups}>
            {integrations.map((g, i) => <Reveal key={g.group} delay={i * 50} className={h.toolGroup}><p>{g.group}</p><div>{g.tools.map((t) => <span key={t}>{t}</span>)}</div></Reveal>)}
          </div>
        </div>
        <Reveal className={h.apiBand}>
          <span className={h.apiIcon}><Code size={20} /></span>
          <div><b>If it has an API, we can connect to it.</b><p>In-house systems, industry software, webhooks, REST or GraphQL APIs, even a shared spreadsheet. If your system has a way in, your agent can use it.</p></div>
          <a className={h.pillDark} href="/contact/">Ask about your tools<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
        </Reveal>
        <p className={h.tmNote}>Tools shown are examples of systems with APIs we can connect to. Names are trademarks of their owners and don’t imply a partnership.</p>
      </div>
    </section>

    {/* Services */}
    <section id="services" className={h.sheet} aria-labelledby="services-heading">
      <div className={h.sheetInner}>
        <div className={h.sectionHead}>
          <Reveal><h2 id="services-heading" className={h.h2}>What we <span className={h.chip} data-tone="orange"><Sparkle size={20} /></span> build<br />for your business</h2><p className={h.lede}>Three things, made properly by one team.</p></Reveal>
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

    {/* Studio statement */}
    <section id="studio" className={h.sheet} aria-labelledby="studio-heading">
      <div className={`${h.sheetInner} ${h.statement}`}>
        <Reveal className={h.statementMark}><Image unoptimized src="/studio/macaroni.png" alt="" width={84} height={84} /></Reveal>
        <div>
          <Reveal><h2 id="studio-heading" className={h.statementText}>
            We’re an independent product studio. We design and build the things a business runs on, <span>the agent your customers call, the tools your team opens every morning, and the site that brings them in.</span>
          </h2></Reveal>
          <div className={h.stats}>
            {stats.map((st, i) => <Reveal key={st.label} delay={i * 80} className={h.stat}>
              {st.tab && <span className={h.statTab}><i />{st.tab}</span>}
              <div className={h.statCard} data-tabbed={st.tab ? true : undefined}><strong>{st.value}</strong><p>{st.label}</p></div>
            </Reveal>)}
          </div>
        </div>
      </div>
    </section>

    {/* Work */}
    <section id="work" className={h.sheet} aria-labelledby="work-heading">
      <div className={h.sheetInner}>
        <div className={h.sectionHead}>
          <Reveal><h2 id="work-heading" className={h.h2}>Things we’ve <span className={h.chip} data-tone="blue"><Check size={22} /></span> made</h2><p className={h.lede}>Three products of our own. The same care goes into what we build for you.</p></Reveal>
        </div>
        <Reveal><Work /></Reveal>
      </div>
    </section>

    {/* Pricing */}
    <section id="pricing" className={`${h.sheet} ${h.darkSheet}`} aria-labelledby="pricing-heading">
      <div className={h.sheetInner}>
        <div className={h.priceHead}>
          <Reveal><p className={h.kickerDark}>Pricing</p><h2 id="pricing-heading" className={h.h2}>Clear pricing.<br /><span>Built around your business.</span></h2></Reveal>
          <Reveal delay={80}><p className={h.pricingLede}>Start with a proven agent, or have one built around your systems. Either way, you know the price before any work begins.</p></Reveal>
        </div>

        <div className={h.plans}>
          <Reveal className={h.planShell}>
            <article className={h.plan}>
              <p className={h.planName}>Ready-made agent</p>
              <p className={h.planPrice}>$2,500<span>one-time</span></p>
              <p className={h.planPitch}>One of our proven agents, rebuilt for your business to answer every inbound call.</p>
              <ul>
                <li><Check size={15} />Answers every call, day or night</li>
                <li><Check size={15} />Books appointments, answers questions and takes messages</li>
                <li><Check size={15} />Texts callers confirmations and links</li>
                <li><Check size={15} />Texts you a summary after every call</li>
                <li><Check size={15} />Transfers urgent calls to you or your team</li>
                <li><Check size={15} />Your name, voice, hours and services</li>
                <li><Check size={15} />Every call’s transcript and summary in your dashboard</li>
              </ul>
              <a className={h.pillOutline} href="/contact/">Start with a ready-made agent <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
            </article>
          </Reveal>
          <Reveal delay={90} className={h.planShell} >
            <article className={h.plan} data-featured>
              <p className={h.planName}>Custom agent<em>Most flexible</em></p>
              <p className={h.planPrice}><small>from</small>$5,000</p>
              <p className={h.planPitch}>Everything in the ready-made agent, built around your business and connected to the tools you already use.</p>
              <ul>
                <li><Check size={15} />Everything in the ready-made agent</li>
                <li><Check size={15} />Connects to your systems through their APIs: calendar, CRM, booking or field-service software</li>
                <li><Check size={15} />Two-way texting: reminders, follow-ups and replies</li>
                <li><Check size={15} />Your own rules, call flows and handoffs</li>
                <li><Check size={15} />Designed and tested on your real calls</li>
                <li><Check size={15} />Fixed scope and price, agreed up front</li>
              </ul>
              <a className={h.pillYellow} href="/contact/">Shape a custom project <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
            </article>
          </Reveal>
        </div>

        <Reveal className={h.running}>
          <div className={h.runningHead}><h3>Keeping it running</h3><p>Every agent needs a phone line, call minutes and texts. Run it yourself, or let us handle it.</p></div>
          <div className={h.runningPlans}>
            <div><p className={h.runName}>Self-hosted</p><p className={h.runPrice}>Free<span>/mo from us</span></p><p>We get you set up with your own phone and AI accounts and build your agent there. You run it yourself, with 30 days of fixes included. One-time $500 setup.</p></div>
            <div><p className={h.runName}>Hosted</p><p className={h.runPrice}>from $149<span>/mo</span></p><p>We keep it running: your number, 500 call minutes, 500 texts and your dashboard. Changes are quoted when you need them.</p></div>
            <div data-featured><p className={h.runName}>Managed<em>Hands-off</em></p><p className={h.runPrice}>from $399<span>/mo</span></p><p>We run it for you: 1,000 call minutes, 1,000 texts, changes on request, tuning from real calls and a monthly report.</p></div>
          </div>
          <div className={h.extras}>
            <div className={h.runningHead}><h3>Extras</h3><p>Add-ons for either agent, ready-made or custom.</p></div>
            <div className={h.extraList}>
              <div><p className={h.runName}>Self-hosted setup</p><p className={h.extraPrice}>$500<span>one-time</span></p><p>Setting up your own accounts, building and testing your agent in them, and a short guide for running it.</p></div>
              <div><p className={h.runName}>Texting registration</p><p className={h.extraPrice}>$50<span>one-time</span></p><p>Registers your number and business with the carriers (A2P 10DLC), so your agent’s texts reach your customers. Needed for texting in the US, on either plan.</p></div>
              <div><p className={h.runName}>Premium voices</p><p className={h.extraPrice}>+$80<span>/mo Hosted</span></p><p>Our most natural voices: +$100/mo on Managed. On Self-hosted, you pay the voice provider’s rate.</p></div>
              <div><p className={h.runName}>Extra minutes &amp; texts</p><p className={h.extraPrice}>As needed</p><p>Billed at the rate in your proposal if you go over your plan’s minutes or texts.</p></div>
            </div>
          </div>
          <p className={h.offerNote}>Need several agents or outbound calling? <a href="/contact/">Let’s talk</a>.</p>
        </Reveal>
      </div>
    </section>

    </main>

    <footer className={h.footer}>
      <a href="/" className={h.brand}><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
      <nav aria-label="Site information">
        <a href="/llm-info/"><Sparkle size={15} />Hey AI, learn about Digital Macaroni</a>
        <a href="/privacy/">Privacy</a>
        <a href="/demo-terms/">Demo terms</a>
      </nav>
      <span>© 2026 Digital Macaroni</span>
    </footer>
  </div>;
}
