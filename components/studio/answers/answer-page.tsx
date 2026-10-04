import Image from "next/image";
import type { ReactNode } from "react";
import { voiceDemos } from "../live/demo-info";
import { ArrowUpRight, Check } from "../icons";
import { ANSWERS, CATEGORIES, UPDATED, UPDATED_ISO, type Answer } from "./content";
import { SOURCES } from "./sources";
import a from "./answers.module.css";

const SITE = "https://digitalmacaroni.io";
export const AUTHOR = { name: "Leif", byline: "founder of Digital Macaroni" };

/** Shared chrome for the Answers hub and pages: top bar, sheet, conversation prompt, footer. */
export function AnswersShell({ children }: { children: ReactNode }) {
  return <div className={a.page}>
    <header className={a.top}>
      <a href="/" className={a.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
      <nav className={a.topNav} aria-label="Answers navigation">
        <a href="/answers/">Answers</a>
        <a href="/#agents">Live demos</a>
        <a href="/contact/" className={a.topCta}>Drop us a note</a>
      </nav>
    </header>
    <main id="content" className={a.sheet}>{children}</main>
    <footer className={a.foot}>
      <a href="/answers/">All answers</a>
      <a href="/llm-info/">About Digital Macaroni</a>
      <a href="/privacy/">Privacy</a>
      <a href="/demo-terms/">Demo terms</a>
      <span>© 2026 Digital Macaroni</span>
    </footer>
  </div>;
}

function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

function TestItYourself({ answer }: { answer: Answer }) {
  const demo = voiceDemos[answer.demo];
  return <aside className={a.test} aria-label="Try a live demo">
    <div>
      <p className={a.testKicker}>Test it yourself</p>
      <h2>Try {demo.agentName} at {demo.name} and see if you can trip it up.</h2>
      <p>Spell an email address. Change your mind about the time. Ask for something it shouldn&rsquo;t do, then ask for a person. The live demo shows every step it takes while you talk.</p>
    </div>
    <div className={a.testActions}>
      <a className={a.testCall} href={`/demo/${answer.demo}/`}>Open the live demo<ArrowUpRight size={14} /></a>
    </div>
  </aside>;
}

export function AnswerPage({ answer }: { answer: Answer }) {
  const url = `${SITE}/answers/${answer.slug}/`;
  const related = answer.related.map((s) => ANSWERS.find((x) => x.slug === s)).filter((x): x is Answer => Boolean(x));
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: answer.title,
      description: answer.description,
      url,
      datePublished: UPDATED_ISO,
      dateModified: UPDATED_ISO,
      author: { "@type": "Person", name: AUTHOR.name, jobTitle: "Founder", worksFor: { "@type": "Organization", name: "Digital Macaroni", url: SITE } },
      publisher: { "@type": "Organization", name: "Digital Macaroni", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/studio/macaroni.png` } },
      mainEntityOfPage: url,
      citation: answer.sources.map((k) => SOURCES[k].url),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ q: answer.title, a: answer.short }, ...answer.faqs].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Answers", item: `${SITE}/answers/` },
        { "@type": "ListItem", position: 3, name: answer.label, item: url },
      ],
    },
  ];

  return <AnswersShell>
    <JsonLd data={structured} />
    <article className={a.article}>
      <nav className={a.crumbs} aria-label="Breadcrumb"><a href="/answers/">Answers</a><span aria-hidden="true">/</span><span>{CATEGORIES[answer.category].title}</span></nav>
      <h1>{answer.title}</h1>
      <p className={a.byline}>By {AUTHOR.name}, {AUTHOR.byline} · Updated <time dateTime={UPDATED_ISO}>{UPDATED}</time></p>

      <section className={a.short} aria-label="Short answer">
        <p className={a.shortLabel}><Check size={14} />Short answer</p>
        <p>{answer.short}</p>
      </section>

      <div className={a.prose}>{answer.body}</div>

      <TestItYourself answer={answer} />

      <section className={a.faqs} aria-labelledby="faq-heading">
        <h2 id="faq-heading">Common questions</h2>
        {answer.faqs.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
      </section>

      {answer.sources.length ? <section className={a.sources} aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        <ol>{answer.sources.map((k) => {
          const s = SOURCES[k];
          return <li key={k}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a><span>{s.publisher}</span><p>{s.note}</p></li>;
        })}</ol>
        <p className={a.sourcesNote}>Checked against the original sources on {UPDATED}. Industry figures are estimates, not quotes.</p>
      </section> : null}

      {related.length ? <section className={a.related} aria-labelledby="related-heading">
        <h2 id="related-heading">Related answers</h2>
        <div>{related.map((r) => <a key={r.slug} href={`/answers/${r.slug}/`}><span>{CATEGORIES[r.category].title}</span><b>{r.title}</b><ArrowUpRight size={14} /></a>)}</div>
      </section> : null}

      <section className={a.note}>
        <div><h2>Want this for your business?</h2><p>Tell us what you need and we&rsquo;ll write back with questions and ideas.</p></div>
        <a href="/contact/" className={a.noteCta}>Drop us a note<ArrowUpRight size={14} /></a>
      </section>
    </article>
  </AnswersShell>;
}

export function AnswersHub() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Answers about AI phone agents",
    url: `${SITE}/answers/`,
    hasPart: ANSWERS.map((x) => ({ "@type": "Article", headline: x.title, url: `${SITE}/answers/${x.slug}/` })),
  };
  return <AnswersShell>
    <JsonLd data={structured} />
    <div className={a.hub}>
      <p className={a.hubKicker}>Answers</p>
      <h1>Straight answers about AI phone agents.</h1>
      <p className={a.hubLede}>What they cost, what they do for your kind of business, and how they handle the details. Written by the team that builds them, with sources for every outside figure.</p>
      {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((c) => <section key={c} className={a.hubGroup} aria-labelledby={`cat-${c}`}>
        <div className={a.hubGroupHead}><h2 id={`cat-${c}`}>{CATEGORIES[c].title}</h2><p>{CATEGORIES[c].blurb}</p></div>
        <div className={a.cards}>{ANSWERS.filter((x) => x.category === c).map((x) => <a key={x.slug} href={`/answers/${x.slug}/`} className={a.card}>
          <span className={a.cardLabel}>{x.label}</span>
          <b>{x.title}</b>
          <p>{x.description}</p>
          <span className={a.cardArrow}><ArrowUpRight size={14} /></span>
        </a>)}</div>
      </section>)}
    </div>
  </AnswersShell>;
}
