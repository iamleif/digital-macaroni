import type { Metadata } from "next";
import { answerBySlug } from "@/components/studio/answers/content";
import { StudioFooter, StudioNav } from "@/components/studio/chrome";
import { ArrowUpRight } from "@/components/studio/icons";
import { ConsultingCard, PlanCards, RunningCosts } from "@/components/studio/pricing";
import { Intro, Reveal } from "@/components/studio/reveal";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";
import h from "@/components/studio/home.module.css";

export const metadata: Metadata = pageMeta({
  title: "Pricing — Digital Macaroni",
  shareTitle: "Digital Macaroni pricing: AI voice agents from $2,500",
  description: "AI voice agent pricing: ready-made agents $2,500 one-time, custom agents from $5,000. Running plans from $149/mo, or self-host on your own accounts. Consulting priced per engagement.",
  path: "/pricing/",
  ownImage: true,
});

const PAGE_URL = `${SITE}/pricing/`;

const faqs = ["how-much-does-an-ai-phone-agent-cost", "hosted-vs-managed-vs-self-hosted-ai-phone-agent", "custom-ai-phone-agent-vs-template-build", "can-i-keep-my-business-phone-number"]
  .map((slug) => answerBySlug(slug)!)
  .filter(Boolean);

export default function PricingPage() {
  return <div className={h.page}>
    <JsonLd data={[
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: "Digital Macaroni pricing",
        description: metadata.description,
        isPartOf: { "@id": `${SITE}/#website` },
        about: ORG_REF,
        dateModified: "2026-10-08",
        mainEntity: { "@id": `${PAGE_URL}#catalog` },
      },
      {
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        "@id": `${PAGE_URL}#catalog`,
        name: "AI voice agents and running plans",
        url: PAGE_URL,
        provider: ORG_REF,
        itemListElement: [
          { "@type": "Offer", name: "Ready-made AI voice agent", description: "A proven inbound phone agent rebuilt for your business: answers every call, books appointments, answers questions, takes messages, texts confirmations and summaries, and transfers urgent calls. Live in 2 to 5 days.", price: 2500, priceCurrency: "USD", url: PAGE_URL, itemOffered: { "@type": "Service", serviceType: "AI voice agent", name: "Ready-made AI voice agent", provider: ORG_REF } },
          { "@type": "Offer", name: "Custom AI voice agent", description: "An AI voice agent built around your business and connected to your calendar, CRM, booking or field-service software through their APIs, with two-way texting and your own call flows. Live in 2 to 4 weeks.", priceSpecification: { "@type": "PriceSpecification", minPrice: 5000, priceCurrency: "USD" }, url: PAGE_URL, itemOffered: { "@type": "Service", serviceType: "AI voice agent", name: "Custom AI voice agent", provider: ORG_REF } },
          { "@type": "Offer", name: "Self-hosted setup", description: "Your agent built and tested in your own phone and AI accounts, with 30 days of fixes. No monthly fee from Digital Macaroni.", price: 500, priceCurrency: "USD", url: PAGE_URL },
          { "@type": "Offer", name: "Hosted plan", description: "Your number, 500 call minutes, 500 texts and your dashboard.", priceSpecification: { "@type": "UnitPriceSpecification", minPrice: 149, priceCurrency: "USD", unitText: "MONTH" }, url: PAGE_URL },
          { "@type": "Offer", name: "Managed plan", description: "1,000 call minutes, 1,000 texts, changes on request, tuning from real calls and a monthly report.", priceSpecification: { "@type": "UnitPriceSpecification", minPrice: 399, priceCurrency: "USD", unitText: "MONTH" }, url: PAGE_URL },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.title, acceptedAnswer: { "@type": "Answer", text: f.short } })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Pricing", item: PAGE_URL },
        ],
      },
    ]} />
    <main id="content" className={h.contents}>
      <section className={`${h.sheet} ${h.heroSheet}`} aria-labelledby="pricing-title">
        <StudioNav />
        <div className={h.pageHead}>
          <Intro delay={80}><h1 id="pricing-title" className={h.heroTitle}>Clear pricing. Built around your business.</h1></Intro>
          <Intro delay={160}><p className={h.heroSub}>One price to build your agent, then a plan to keep it running. You know the full cost before any work begins.</p></Intro>
        </div>
      </section>

      <section className={`${h.sheet} ${h.darkSheet}`} aria-labelledby="agents-heading">
        <div className={h.sheetInner}>
          <div className={h.priceHead}>
            <Reveal><h2 id="agents-heading" className={h.h2}>Pay once to build it.<br /><span>Then pick how it runs.</span></h2></Reveal>
            <Reveal delay={80}><p className={h.pricingLede}>Start with a proven agent, or have one built around your systems.</p></Reveal>
          </div>
          <PlanCards full />
          <RunningCosts />
          <ConsultingCard />
        </div>
      </section>

      <section className={h.sheet} aria-labelledby="questions-heading">
        <div className={`${h.sheetInner} ${h.faqWrap}`}>
          <Reveal className={h.faqHead}>
            <h2 id="questions-heading" className={h.h2}>Pricing,<br /><span>answered straight.</span></h2>
            <p className={h.lede}>What people ask before they buy. Each one links to a full answer with sources.</p>
            <a className={h.pillLight} href="/answers/">All answers<span className={h.pillIcon} style={{ background: "rgba(15,15,13,.06)" }}><ArrowUpRight size={14} /></span></a>
          </Reveal>
          <div className={h.faqList}>
            {faqs.map((f) => <details key={f.slug} className={h.faqItem}>
              <summary>{f.title}</summary>
              <p>{f.short}</p>
              <a href={`/answers/${f.slug}/`}>Read the full answer<ArrowUpRight size={13} /></a>
            </details>)}
          </div>
        </div>
      </section>

      <section className={`${h.sheet} ${h.ctaSheet}`} aria-labelledby="talk-heading">
        <div className={h.sheetInner}>
          <Reveal className={h.ctaCopy}>
            <h2 id="talk-heading" className={h.h2}>Not sure which fits?</h2>
            <p className={h.lede}>Tell us about your business and the calls you get. We&rsquo;ll write back with the right plan and a fixed price.</p>
            <div className={h.ctaActions}>
              <a className={h.pillDark} href="/contact/">Drop us a note<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
              <a className={h.pillLight} href="/#agents">Try a live demo</a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
    <StudioFooter />
  </div>;
}
