import Image from "next/image";
import type { ReactNode } from "react";
import { voiceDemos } from "../live/demo-info";
import { ArrowUpRight, Check, LinkedIn } from "../icons";
import { FOUNDER, FOUNDER_REF, JsonLd, ORG_REF, SITE } from "../site";
import { ANSWERS, CATEGORIES, UPDATED, UPDATED_ISO, type Answer } from "./content";
import { SOURCES } from "./sources";
import { CookieSettings } from "../consent";
import a from "./answers.module.css";


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
      <a href="/missed-call-calculator/">Missed call calculator</a>
      <a href="/architecture/">Architecture</a>
      <a href="/about/">About</a>
      <a href="/llm-info.txt">For AI assistants</a>
      <a href="/privacy/">Privacy</a>
      <a href="/demo-terms/">Demo terms</a>
      <CookieSettings />
      <span>© 2026 Digital Macaroni</span>
    </footer>
  </div>;
}

/** "By Leif Johansen (LinkedIn), founder of Digital Macaroni" — the mark opens LinkedIn. */
function Byline() {
  return <>By <span className={a.author}>{FOUNDER.name}</span><a href={FOUNDER.linkedin} target="_blank" rel="noopener noreferrer me" className={a.authorLinkedIn} aria-label={`${FOUNDER.name} on LinkedIn`}><LinkedIn size={14} /></a>, founder of Digital Macaroni</>;
}

function AuthorCard() {
  return <aside className={a.authorCard} aria-label="About the author">
    <div>
      <p className={a.authorCardKicker}>Written by</p>
      <p className={a.authorCardName}>{FOUNDER.name}</p>
      <p>Founder of Digital Macaroni.</p>
    </div>
    <div className={a.authorCardLinks}>
      <a href={FOUNDER.linkedin} target="_blank" rel="noopener noreferrer me"><LinkedIn size={15} />LinkedIn</a>
    </div>
  </aside>;
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
      image: `${url}opengraph-image`,
      author: { ...FOUNDER_REF, "@type": "Person", name: FOUNDER.name, sameAs: [FOUNDER.linkedin] },
      publisher: ORG_REF,
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
      <p className={a.byline}><Byline /> · Updated <time dateTime={UPDATED_ISO}>{UPDATED}</time></p>

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

      <AuthorCard />

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
    hasPart: [
      { "@type": "WebApplication", name: "Missed call calculator", url: `${SITE}/missed-call-calculator/` },
      ...ANSWERS.map((x) => ({ "@type": "Article", headline: x.title, url: `${SITE}/answers/${x.slug}/` })),
    ],
  };
  return <AnswersShell>
    <JsonLd data={structured} />
    <div className={a.hub}>
      <p className={a.hubKicker}>Answers</p>
      <h1>Straight answers about AI phone agents.</h1>
      <p className={a.hubLede}>What they cost, what they do for your kind of business, and how they handle the details. Written by the team that builds them, with sources for every outside figure.</p>
      <section className={a.hubGroup} aria-labelledby="cat-tools">
        <div className={a.hubGroupHead}><h2 id="cat-tools">Free tools</h2><p>Run your own numbers before you spend anything.</p></div>
        <div className={a.cards}>
          <a href="/missed-call-calculator/" className={`${a.card} ${a.toolCard}`}>
            <span className={a.cardLabel}>Calculator</span>
            <b>Missed call calculator</b>
            <p>See what unanswered calls cost your business each month and year, with typical values for your kind of business.</p>
            <span className={a.cardArrow}><ArrowUpRight size={14} /></span>
          </a>
        </div>
      </section>
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
