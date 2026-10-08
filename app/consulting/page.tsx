import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { StudioAskBand, StudioFooter, StudioNav } from "@/components/studio/chrome";
import { ArrowUpRight, Bolt, Calendar, Check, Mic, Phone, Search, Sparkle, Users } from "@/components/studio/icons";
import { Intro, Reveal } from "@/components/studio/reveal";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";
import h from "@/components/studio/home.module.css";

export const metadata: Metadata = pageMeta({
  title: "Voice AI Consulting — Digital Macaroni",
  shareTitle: "Voice AI consulting: bring Digital Macaroni in on your next big build",
  description: "Voice AI consulting for companies putting voice agents into a product, moving phones and support to AI agents, or rescuing a stalled build. Days on site or months alongside your team, scoped and priced per engagement.",
  path: "/consulting/",
  ownImage: true,
});

const PAGE_URL = `${SITE}/consulting/`;
const CONTACT = "/contact/?topic=consulting";

const areas: { icon: ReactNode; title: string; copy: string }[] = [
  { icon: <Mic size={18} />, title: "Voice inside your product", copy: "Add voice agents to your app, platform or service: the architecture, the speech and AI providers, latency, phone lines and the rollout." },
  { icon: <Phone size={18} />, title: "Phones and support to AI agents", copy: "Move call handling from people and phone trees to AI agents. We map the call flows, connect your CRM and ticketing, run a pilot, then scale what works." },
  { icon: <Search size={18} />, title: "Architecture and build reviews", copy: "A second set of eyes on an agent you’ve built or bought: where it breaks, why it’s slow, what each minute costs, and a plan to fix it." },
  { icon: <Bolt size={18} />, title: "Hands-on build sprints", copy: "We join your team for a set number of days and ship a working piece: a pilot agent, an integration, a test harness." },
  { icon: <Users size={18} />, title: "Training your team", copy: "Workshops that get your engineers building, testing and running voice agents themselves." },
  { icon: <Calendar size={18} />, title: "Long-term projects", copy: "A change that takes months. We plan it with you, build alongside your team and stay through launch." },
];

const shapes: { name: string; title: string; copy: string; points: string[] }[] = [
  { name: "Short", title: "A few days", copy: "On site or remote, billed by the day.", points: ["Workshops and architecture sessions", "A review of an existing agent", "A hands-on build sprint"] },
  { name: "Project", title: "Weeks to months", copy: "A fixed scope and one agreed price.", points: ["Pilot through to launch", "Built alongside your team", "Milestones and handover in writing"] },
  { name: "Ongoing", title: "Month to month", copy: "A senior voice AI partner on call.", points: ["Regular working sessions", "Reviews of new builds and vendors", "Tuning from real calls"] },
];

const faqs = [
  { q: "How much does voice AI consulting cost?", a: "It depends on the work. Short engagements are billed by the day, and projects get one fixed price for an agreed scope. We talk it through first, then you get the timeline and the price in writing before anything starts." },
  { q: "How long does an engagement take?", a: "Anywhere from a few days for a review, workshop or build sprint to several months for a full move of your phones or support to AI agents." },
  { q: "Do you work on site or remotely?", a: "Either. Many engagements mix the two: on site to kick off and for key working sessions, remote in between." },
  { q: "Can you work with our team and the vendors we already use?", a: "Yes. We work alongside your engineers and with the voice, phone and AI providers you already use, or help you choose them." },
  { q: "What kinds of voice agents have you built?", a: "Speech-to-speech agents, agents on managed voice platforms, and cascades of separate speech-to-text, AI and text-to-speech steps. You can call a live example of each from our demos." },
];

const steps = [
  { title: "Tell us about the project", copy: "What you’re changing, from what to what, and by when." },
  { title: "We set up a time to talk", copy: "A call with you and your team to scope the work properly." },
  { title: "A proposal in writing", copy: "Timeline, who does what and the price, agreed before any work begins." },
];

export default function ConsultingPage() {
  return <div className={h.page}>
    <JsonLd data={[
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "@id": `${PAGE_URL}#service`,
        name: "Voice AI consulting",
        serviceType: "Voice AI consulting",
        url: PAGE_URL,
        provider: ORG_REF,
        description: metadata.description,
        audience: { "@type": "BusinessAudience", name: "Companies adding voice AI to a product or moving phones and support to AI agents" },
        hasOfferCatalog: { "@type": "OfferCatalog", name: "Consulting engagements", itemListElement: areas.map((a) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: a.title, description: a.copy, provider: ORG_REF } })) },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Consulting", item: PAGE_URL },
        ],
      },
    ]} />
    <main id="content" className={h.contents}>
      <section className={`${h.sheet} ${h.heroSheet}`} aria-labelledby="consulting-title">
        <StudioNav />
        <div className={h.pageHead}>
          <Intro delay={80}><h1 id="consulting-title" className={h.heroTitle}>Bring us in on your next big build.</h1></Intro>
          <Intro delay={160}><p className={h.heroSub}>For companies making a real change: putting voice AI into a product, moving phones and support to AI agents, or getting a stalled build over the line. We come in, work alongside your team and get it done.</p></Intro>
          <Intro delay={240} className={h.ctaActions}>
            <a className={h.pillDark} href={CONTACT}>Talk about your project<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
            <a className={h.pillLight} href="/architecture/">See how we build</a>
          </Intro>
        </div>
      </section>

      <section className={h.sheet} aria-labelledby="areas-heading">
        <div className={h.sheetInner}>
          <div className={h.sectionHead}>
            <Reveal><h2 id="areas-heading" className={h.h2}>What we <span className={h.chip} data-tone="orange"><Sparkle size={20} /></span> help with</h2><p className={h.lede}>Short engagements or long ones. If it involves voice agents, we&rsquo;ve likely built it.</p></Reveal>
          </div>
          <div className={h.areaGrid}>
            {areas.map((a, i) => <Reveal key={a.title} as="article" delay={(i % 3) * 80} className={h.area}>
              <span className={h.areaIcon}>{a.icon}</span>
              <h3>{a.title}</h3>
              <p>{a.copy}</p>
            </Reveal>)}
          </div>
        </div>
      </section>

      <section className={`${h.sheet} ${h.darkSheet}`} aria-labelledby="shapes-heading">
        <div className={h.sheetInner}>
          <div className={h.priceHead}>
            <Reveal><h2 id="shapes-heading" className={h.h2}>Shaped to the job.<br /><span>Priced once it&rsquo;s scoped.</span></h2></Reveal>
            <Reveal delay={80}><p className={h.pricingLede}>Every company and every project is different, so we talk it through first. You get the timeline and the price in writing before anything starts.</p></Reveal>
          </div>
          <div className={h.shapes}>
            {shapes.map((s, i) => <Reveal key={s.name} delay={i * 80}>
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
              <ul>{s.points.map((p) => <li key={p}><Check size={15} />{p}</li>)}</ul>
            </Reveal>)}
          </div>
          <Reveal className={h.pricingMore}>
            <p>Want proof first? Call our live demos: three agents on three different architectures.</p>
            <a className={h.pillOutline} href="/#agents">Try a live demo <span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
          </Reveal>
        </div>
      </section>

      <section className={h.sheet} aria-labelledby="questions-heading">
        <div className={`${h.sheetInner} ${h.faqWrap}`}>
          <Reveal className={h.faqHead}>
            <h2 id="questions-heading" className={h.h2}>Questions,<br /><span>answered straight.</span></h2>
            <p className={h.lede}>What companies ask before bringing us in.</p>
          </Reveal>
          <div className={h.faqList}>
            {faqs.map((f) => <details key={f.q} className={h.faqItem}>
              <summary>{f.q}</summary>
              <p className={h.faqAnswer}>{f.a}</p>
            </details>)}
          </div>
        </div>
      </section>

      <section className={`${h.sheet} ${h.ctaSheet}`} aria-labelledby="talk-heading">
        <div className={`${h.sheetInner} ${h.cta}`}>
          <Reveal className={h.ctaCopy}>
            <span className={h.ctaMark}><Image unoptimized src="/studio/macaroni.png" alt="" width={56} height={56} /></span>
            <h2 id="talk-heading" className={h.h2}>Let&rsquo;s talk about your project.</h2>
            <p className={h.lede}>Tell us what you&rsquo;re working on and we&rsquo;ll set up a time to talk it through.</p>
            <div className={h.ctaActions}>
              <a className={h.pillDark} href={CONTACT}>Start the conversation<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
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
    </main>
    <StudioAskBand />
    <StudioFooter />
  </div>;
}
