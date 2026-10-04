import type { Metadata } from "next";
import Image from "next/image";
import { Agents } from "@/components/studio/agents";
import { HeroApp } from "@/components/studio/hero-app";
import { ArrowDown, ArrowUpRight, Check, Device, Grid, Sparkle, Wave } from "@/components/studio/icons";
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

    {/* Pricing + contact */}
    <section id="pricing" className={`${h.sheet} ${h.darkSheet}`} aria-labelledby="pricing-heading">
      <div className={`${h.sheetInner} ${h.pricing}`}>
        <Reveal>
          <h2 id="pricing-heading" className={h.h2}>Your brand.<br /><span>Built around your business.</span></h2>
          <p className={h.pricingLede}>Voice agents, dashboards and apps that look, sound and work like you. We agree the scope and price with you before any work begins.</p>
        </Reveal>
        <Reveal delay={100} className={h.offerShell}>
          <div className={h.offer}>
            <p className={h.offerLabel}>Projects from</p>
            <p className={h.offerAmount}>$5,000<span>USD</span></p>
            <ul>
              <li><Check size={15} />Design, build and launch</li>
              <li><Check size={15} />Your voice, your brand, your workflow</li>
              <li><Check size={15} />Fixed scope agreed up front</li>
            </ul>
            <a className={h.pillYellow} href="/contact/">Let’s shape your project <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
            <p className={h.offerNote}>Final pricing depends on scope and integrations. Ongoing service, hosting and usage are quoted separately.</p>
          </div>
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
