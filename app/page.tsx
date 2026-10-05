import type { Metadata } from "next";
import Image from "next/image";
import { Agents } from "@/components/studio/agents";
import { HeroApp } from "@/components/studio/hero-app";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, Device, Globe, Grid, Plug, Sparkle, Wave } from "@/components/studio/icons";
import { Places } from "@/components/studio/location";
import { CookieSettings } from "@/components/studio/consent";
import { Intro, Reveal } from "@/components/studio/reveal";
import { Work } from "@/components/studio/work";
import { answerBySlug } from "@/components/studio/answers/content";
import { pageMeta } from "@/components/studio/site";
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

/** Flags for the languages section, in public/studio/flags (country-flag-icons, MIT). A flag stands in for a language, not a market. */
const flags = ["us", "gb", "es", "mx", "fr", "de", "it", "pt", "br", "nl", "pl", "se", "no", "dk", "fi", "cz", "sk", "hu", "ro", "bg", "hr", "gr", "tr", "ua", "sa", "in", "cn", "jp", "kr", "vn", "id", "my", "ph"];

/** The 32 languages on the real-time voice engine's published list. */
const languages: [string, string][] = [
  ["English", ""], ["Spanish", "Español"], ["French", "Français"], ["German", "Deutsch"], ["Italian", "Italiano"], ["Portuguese", "Português"], ["Dutch", "Nederlands"], ["Polish", "Polski"],
  ["Swedish", "Svenska"], ["Norwegian", "Norsk"], ["Danish", "Dansk"], ["Finnish", "Suomi"], ["Czech", "Čeština"], ["Slovak", "Slovenčina"], ["Hungarian", "Magyar"], ["Romanian", "Română"],
  ["Bulgarian", "Български"], ["Croatian", "Hrvatski"], ["Greek", "Ελληνικά"], ["Turkish", "Türkçe"], ["Ukrainian", "Українська"], ["Russian", "Русский"], ["Arabic", "العربية"], ["Hindi", "हिन्दी"],
  ["Tamil", "தமிழ்"], ["Chinese", "中文"], ["Japanese", "日本語"], ["Korean", "한국어"], ["Vietnamese", "Tiếng Việt"], ["Indonesian", "Bahasa Indonesia"], ["Malay", "Bahasa Melayu"], ["Filipino", "Tagalog"],
];

/** Tools with documented APIs (each checked against its developer docs, 2026-10-04), grouped the way an owner thinks about them. Examples, not partnerships. */
const integrations: { group: string; tools: string[] }[] = [
  { group: "Calendars & booking", tools: ["Google Calendar", "Outlook", "Calendly", "Acuity", "SimplyBook.me"] },
  { group: "CRM", tools: ["HubSpot", "Salesforce", "Pipedrive", "Zoho CRM", "GoHighLevel", "Keap", "Close", "Teamleader", "Dynamics 365"] },
  { group: "Legal", tools: ["Clio", "MyCase", "PracticePanther", "Lawmatics", "Smokeball"] },
  { group: "Trades & repair", tools: ["ServiceTitan", "Jobber", "Housecall Pro", "simPRO", "ServiceM8", "AccuLynx", "JobNimbus", "Shopmonkey", "Tekmetric"] },
  { group: "Vet & pet care", tools: ["ezyVet", "Vetspire", "MoeGo"] },
  { group: "Commerce & payments", tools: ["Shopify", "WooCommerce", "Square", "Stripe", "PayPal", "Clover", "Toast", "Lightspeed", "SumUp", "Mollie"] },
  { group: "Accounting", tools: ["QuickBooks", "Xero", "Sage", "FreshBooks", "FreeAgent", "Zoho Books"] },
  { group: "Messages", tools: ["SMS", "WhatsApp", "Email", "Slack", "Microsoft Teams"] },
  { group: "Data", tools: ["Google Sheets", "Airtable", "Notion", "Your database"] },
];

/** An example call: what the agent did, and where each action landed. */
const exampleActions: [string, string, string][] = [
  ["check_availability", "Checked the schedule", "Google Calendar"],
  ["find_customer", "Found the customer", "HubSpot"],
  ["book_job", "Booked the job", "Jobber"],
  ["send_confirmation", "Texted a confirmation", "SMS"],
];

/** Homepage questions: each links to its full answer page. */
const homeFaqs = ["how-much-does-an-ai-phone-agent-cost", "what-happens-when-an-ai-phone-agent-gets-something-wrong", "can-i-keep-my-business-phone-number", "will-callers-know-they-are-talking-to-an-ai", "hosted-vs-managed-vs-self-hosted-ai-phone-agent", "custom-ai-phone-agent-vs-template-build"]
  .map((slug) => answerBySlug(slug)!)
  .filter(Boolean);

const ASK_AI_PROMPT = "Summarize what Digital Macaroni (digitalmacaroni.io) does and who it's for: the AI agents, software and automations it builds, and how they take action inside a business's workflows. Use https://digitalmacaroni.io/llm-info.txt and https://digitalmacaroni.io/llms.txt as sources.";
/** Each assistant opens with the prompt above; icon file in /studio/ai/. */
const askAi: [string, string, string][] = [
  ["chatgpt.png", "ChatGPT", `https://chatgpt.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["claude.png", "Claude", `https://claude.ai/new?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["gemini.png", "Gemini", `https://gemini.google.com/app?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["google.svg", "Google AI Mode", `https://www.google.com/search?udm=50&q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["perplexity.png", "Perplexity", `https://www.perplexity.ai/search?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["grok.png", "Grok", `https://grok.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
];

const steps = [
  { title: "Tell us what you need", copy: "A few questions about your business and the calls you get. It takes a couple of minutes." },
  { title: "We write back", copy: "We read it properly and reply by email with questions and ideas for your business." },
  { title: "A clear proposal", copy: "Scope, price and timeline in writing, agreed before any work begins." },
];

export default function HomePage() {
  return <div className={h.page}>
    <main id="content" className={h.contents}>
    {/* Hero */}
    <section className={`${h.sheet} ${h.heroSheet}`} aria-labelledby="hero-heading">
      <header className={h.nav}>
        <a href="#" className={h.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={30} height={30} priority />Digital Macaroni</a>
        <nav aria-label="Studio navigation" className={h.navLinks}><a href="#agents">Voice demos</a><a href="#services">Services</a><a href="#work">Work</a><a href="#pricing">Pricing</a><a href="/answers/">Answers</a></nav>
        <a className={h.navCta} href="/contact/">Let’s talk</a>
      </header>

      <div>
        <div className={h.heroCopy}>
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
      <div className={`${h.sheetInner} ${h.langInner}`}>
        <Reveal className={h.langCopy}>
          <p className={h.kickerDark}>Languages</p>
          <h2 id="languages-heading" className={h.h2}>Speaks your customers’ <span className={h.chip} data-tone="yellow"><Globe size={22} /></span> language.</h2>
          <p>Your agent can speak many languages, so callers can talk in the one they’re most comfortable with, from the first question to the booking.</p>
          <p className={h.langNote}>{languages.length} languages and more. Available languages depend on the voice chosen for your agent.</p>
          <ul className={h.srOnly}>{languages.map(([name]) => <li key={name}>{name}</li>)}</ul>
        </Reveal>
        <Reveal delay={80} className={h.flagPile}>
          {flags.map((code) => <Image key={code} unoptimized src={`/studio/flags/${code}.svg`} alt="" width={48} height={32} />)}
        </Reveal>
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
          <Reveal delay={80} className={h.apiBand}>
            <span className={h.apiIcon}><Code size={20} /></span>
            <div><b>If it has an API, we can connect to it.</b><p>In-house systems, industry software, webhooks, REST or GraphQL APIs, even a shared spreadsheet. If your system has a way in, your agent can use it.</p></div>
            <a className={h.pillDark} href="/contact/?topic=custom-agent">Ask about your tools<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
          </Reveal>
        </div>
        <div className={h.toolGroups}>
          {integrations.map((g, i) => <Reveal key={g.group} delay={(i % 3) * 50} className={h.toolGroup}><p>{g.group}</p><div>{g.tools.map((t) => <span key={t}>{t}</span>)}</div></Reveal>)}
        </div>
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
              <a className={h.pillOutline} href="/contact/?topic=ready-made">Start with a ready-made agent <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
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
              <a className={h.pillYellow} href="/contact/?topic=custom-agent">Shape a custom project <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
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

    <section className={h.askAi} aria-labelledby="ask-ai-heading">
      <h2 id="ask-ai-heading" className={h.askAiHeading}><Sparkle size={15} />Ask AI about Digital Macaroni</h2>
      <div>{askAi.map(([file, name, href]) => <a key={file} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ask ${name} about Digital Macaroni`} title={name}><Image unoptimized src={`/studio/ai/${file}`} alt="" width={36} height={36} /></a>)}</div>
    </section>

    <footer className={h.footer}>
      <a href="/" className={h.brand}><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
      <nav aria-label="Site information" className={h.footerLinks}>
        <a href="/about/">About</a>
        <a href="/answers/">Answers</a>
        <a href="/privacy/">Privacy</a>
        <a href="/demo-terms/">Demo terms</a>
        <CookieSettings />
      </nav>
      <div className={h.footerPlaces}><Places /></div>
      <a href="/llm-info.txt" className={h.footerAi}><span aria-hidden="true">👋</span> Hey AI, learn about us</a>
      <p className={h.footerCopy}>© 2026 Digital Macaroni</p>
    </footer>
  </div>;
}
