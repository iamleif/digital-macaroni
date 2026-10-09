import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnswersShell } from "@/components/studio/answers/answer-page";
import { ANSWERS, CATEGORIES, type Answer } from "@/components/studio/answers/content";
import { SOURCES, type SourceKey } from "@/components/studio/answers/sources";
import { MissedCallCalculator } from "@/components/studio/calculator/missed-call-calculator";
import { AI_MINUTES_PER_CALL, AI_RATE_PER_MINUTE, DEFAULT_MISSED, DEFAULT_RATE, HOSTED_PLAN, TRADES, lostRevenue } from "@/components/studio/calculator/math";
import { ArrowUpRight, Check, Phone } from "@/components/studio/icons";
import { FOUNDER, FOUNDER_REF, JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";
import a from "@/components/studio/answers/answers.module.css";
import c from "@/components/studio/calculator/calculator.module.css";

const PATH = "/missed-call-calculator/";
const PAGE_URL = `${SITE}${PATH}`;
const CALC_UPDATED = "October 7, 2026";
const CALC_UPDATED_ISO = "2026-10-07";

export const metadata: Metadata = pageMeta({
  title: "Missed Call Calculator: What Missed Calls Cost Your Business",
  shareTitle: "Missed call calculator: what are missed calls costing you?",
  description: "Free missed call calculator for home services, law firms, clinics and salons. See the revenue missed calls cost your business each month and year.",
  path: PATH,
  ownImage: true,
});

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const example = lostRevenue({ missed: DEFAULT_MISSED, ticket: 350, rate: DEFAULT_RATE });
const perCall = AI_MINUTES_PER_CALL * AI_RATE_PER_MINUTE;

const Cite = ({ k, children }: { k: SourceKey; children: ReactNode }) => <a href={SOURCES[k].url} target="_blank" rel="noopener noreferrer">{children}</a>;

const SHORT = `Multiply your missed calls by the share who would have booked, then by what one booking is worth to you. ${DEFAULT_MISSED} missed calls × 1 in 4 × $350 = ${money(example.monthly)} a month, or ${money(example.monthly * 12)} a year.`;

const FAQS = [
  { q: "How do you calculate the cost of missed calls?", a: SHORT },
  { q: "What share of callers would have booked?", a: "ServiceTitan found the typical trade business books 42% of its calls, and shops with fewer than five technicians book 24%. We default to 1 in 4 so the estimate stays careful." },
  { q: "Do people call a competitor when you don't answer?", a: "In CallRail's 2025 survey of 1,000 US consumers, 82% said they'll call a competitor if a business doesn't answer, 78% have abandoned a business after an unanswered call, and only 42% leave a voicemail." },
  { q: "How many calls do home service businesses miss?", a: "CallRail's 2025 benchmark of 1.1 million conversations found home services businesses missed 14% of calls. Your own call log is the number to use." },
  { q: "How much does it cost to answer every call with AI?", a: `An AI phone agent costs roughly ${Math.round(AI_RATE_PER_MINUTE * 100)} cents a minute all-in, so a ${AI_MINUTES_PER_CALL}-minute call costs about ${Math.round(perCall * 100)} cents. Digital Macaroni's Hosted plan is $${HOSTED_PLAN.price} a month with ${HOSTED_PLAN.minutes} minutes included.` },
];

const SOURCE_KEYS: SourceKey[] = ["servicetitanBooking", "callrailConsumers", "callrailBenchmark", "quoCallbacks", "haHvac", "haPlumber", "haElectrician", "haRoof", "haGarage", "haPest", "haCleaning", "haLawn", "partstech", "clioRates", "natpFees", "naicAuto", "agentCommission", "pearlDental", "chiroFees", "forbesPT", "vetVisits", "aspsBotox", "fashSalon", "mmipMassage"];
const TRADE_SOURCE: Record<string, SourceKey> = { hvac: "haHvac", plumbing: "haPlumber", electrical: "haElectrician", roofing: "haRoof", garage: "haGarage", pest: "haPest", cleaning: "haCleaning", lawn: "haLawn", auto: "partstech", law: "clioRates", accounting: "natpFees", insurance: "agentCommission", dental: "pearlDental", chiro: "chiroFees", pt: "forbesPT", vet: "vetVisits", medspa: "aspsBotox", salon: "fashSalon", massage: "mmipMassage" };
const RELATED = ["how-much-does-an-ai-phone-agent-cost", "ai-phone-agent-for-home-services", "ai-phone-agent-for-roofing-companies"];

export default function MissedCallCalculatorPage() {
  const related = RELATED.map((s) => ANSWERS.find((x) => x.slug === s)).filter((x): x is Answer => Boolean(x));
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Missed call calculator",
      url: PAGE_URL,
      description: "Estimates the revenue a business loses each month from missed phone calls.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      dateModified: CALC_UPDATED_ISO,
      author: { ...FOUNDER_REF, "@type": "Person", name: FOUNDER.name, sameAs: [FOUNDER.linkedin] },
      publisher: ORG_REF,
      citation: SOURCE_KEYS.map((k) => SOURCES[k].url),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Answers", item: `${SITE}/answers/` },
        { "@type": "ListItem", position: 3, name: "Missed call calculator", item: PAGE_URL },
      ],
    },
  ];

  return <AnswersShell>
    <JsonLd data={structured} />
    <div className={c.tool}>
      <nav className={a.crumbs} aria-label="Breadcrumb"><a href="/answers/">Answers</a><span aria-hidden="true">/</span><span>Free tools</span></nav>
      <h1 className={c.title}>Missed call calculator</h1>
      <p className={c.lede}>See what unanswered calls cost your business each month. Pick your kind of business, enter your missed calls, and the answer updates as you go.</p>
      <MissedCallCalculator />
    </div>

    <article className={a.article}>
      <p className={a.byline}>By <span className={a.author}>{FOUNDER.name}</span>, founder of Digital Macaroni · Updated <time dateTime={CALC_UPDATED_ISO}>{CALC_UPDATED}</time></p>

      <section className={a.short} aria-label="Short answer">
        <p className={a.shortLabel}><Check size={14} />How to calculate the cost of missed calls</p>
        <p>{SHORT}</p>
      </section>

      <div className={a.prose}>
        <h2>How the math works</h2>
        <p><strong>Missed calls × share who would have booked × what one booking is worth = revenue lost per month.</strong> Multiply by 12 for the year.</p>
        <p>That&rsquo;s all the calculator does. It leaves out repeat customers, referrals and the lifetime value of a new customer, so your real loss is usually higher than the number it shows.</p>
        <p>Here&rsquo;s what {DEFAULT_MISSED} missed calls a month looks like by kind of business, at 1 in 4:</p>
        <table>
          <thead><tr><th>Business</th><th>Typical booking</th><th>Lost per month</th><th>Lost per year</th></tr></thead>
          <tbody>{TRADES.filter((t) => t.ticket).map((t) => {
            const r = lostRevenue({ missed: DEFAULT_MISSED, ticket: t.ticket, rate: DEFAULT_RATE });
            return <tr key={t.id}><td>{t.label}</td><td><Cite k={TRADE_SOURCE[t.id]}>{money(t.ticket)}</Cite></td><td>{money(r.monthly)}</td><td>{money(r.monthly * 12)}</td></tr>;
          })}</tbody>
        </table>
        <p>Each typical value links to its source, listed at the bottom of the page. They&rsquo;re national figures for one booking only: a law firm&rsquo;s figure assumes a small matter, an insurance agency&rsquo;s is first-year commission, and a dental or physical therapy figure is the first visit. Repeat visits and renewals would add more. Your own number is better: use it if you know it.</p>

        <h2>Why 1 in 4</h2>
        <p>Not every caller is a job. Some want a quote, some are out of your area, some are spam. <Cite k="servicetitanBooking">ServiceTitan&rsquo;s data from more than 3,000 trade businesses</Cite> found the typical shop books 42% of its calls, and shops with fewer than five technicians book 24%. We default to 1 in 4 so the estimate stays careful. If your team books more than that, pick 1 in 3 or 1 in 2.</p>

        <h2>What happens to the calls you miss</h2>
        <ul>
          <li><strong>They call someone else.</strong> In <Cite k="callrailConsumers">CallRail&rsquo;s 2025 survey of 1,000 US consumers</Cite>, 82% said they&rsquo;ll call a competitor if you don&rsquo;t answer, and 78% have given up on a business after an unanswered call.</li>
          <li><strong>Most don&rsquo;t leave a message.</strong> Only 42% of consumers in the same survey leave a voicemail.</li>
          <li><strong>Callbacks come too late.</strong> <Cite k="quoCallbacks">Quo&rsquo;s analysis of 16.7 million missed business calls</Cite> found 69% didn&rsquo;t get a callback within 48 hours.</li>
          <li><strong>It happens more than you think.</strong> <Cite k="callrailBenchmark">CallRail&rsquo;s benchmark of 1.1 million conversations</Cite> found home services businesses missed 14% of calls, law firms 28%.</li>
        </ul>

        <h2>Where to find your missed calls</h2>
        <ul>
          <li><strong>Your phone provider.</strong> Most business phone apps and carrier portals show missed and unanswered calls by month.</li>
          <li><strong>Your call tracking or field service software.</strong> If calls run through it, it logs the ones nobody picked up.</li>
          <li><strong>Count for a week.</strong> No report? Tally missed calls and voicemails for one week and multiply by four.</li>
        </ul>

        <h2>What answering them would cost</h2>
        <p>An AI phone agent runs roughly {Math.round(AI_RATE_PER_MINUTE * 100)} cents a minute all-in, for the phone line, the speech and the AI. A typical {AI_MINUTES_PER_CALL}-minute call costs about {Math.round(perCall * 100)} cents, so answering {DEFAULT_MISSED} missed calls costs about {money(DEFAULT_MISSED * perCall)} a month in minutes, against {money(example.monthly)} in lost jobs.</p>
        <p>Our Hosted plan is {money(HOSTED_PLAN.price)} a month with {HOSTED_PLAN.minutes} minutes and your dashboard included. See <a href="/answers/how-much-does-an-ai-phone-agent-cost/">what an AI phone agent costs</a> for the full picture. And if the calculator shows a small number, you may not need one at all.</p>
      </div>

      <aside className={a.test} aria-label="Try a live demo">
        <div>
          <p className={a.testKicker}>Hear it for yourself</p>
          <h2>Call the home-services demo and book a heating repair.</h2>
          <p>Ask what the visit costs. Push back on the fee. Change your mind about the time. The live demo shows every step the agent takes while you talk.</p>
        </div>
        <div className={a.testActions}>
          <a className={a.testCall} href="/demo/northline/"><Phone size={15} />Open the live demo</a>
        </div>
      </aside>

      <section className={a.faqs} aria-labelledby="faq-heading">
        <h2 id="faq-heading">Common questions</h2>
        {FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
      </section>

      <details className={`${a.sources} ${c.sourcesFold}`}>
        <summary><h2 id="sources-heading">Sources</h2><span>{SOURCE_KEYS.length} sources, checked {CALC_UPDATED}</span></summary>
        <ol>{SOURCE_KEYS.map((k) => {
          const s = SOURCES[k];
          return <li key={k}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a><span>{s.publisher}</span><p>{s.note}</p></li>;
        })}</ol>
        <p className={a.sourcesNote}>Checked against the original sources on {CALC_UPDATED}. Industry figures are estimates; your own numbers are better.</p>
      </details>

      <section className={a.related} aria-labelledby="related-heading">
        <h2 id="related-heading">Related answers</h2>
        <div>{related.map((r) => <a key={r.slug} href={`/answers/${r.slug}/`}><span>{CATEGORIES[r.category].title}</span><b>{r.title}</b><ArrowUpRight size={14} /></a>)}</div>
      </section>

      <section className={a.note}>
        <div><h2>Want every call answered?</h2><p>Tell us about your business and we&rsquo;ll write back with a plan and a price.</p></div>
        <a href="/contact/" className={a.noteCta}>Drop us a note<ArrowUpRight size={14} /></a>
      </section>
    </article>
  </AnswersShell>;
}
