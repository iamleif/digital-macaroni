import { Fragment } from "react";
import { AnswersShell } from "../answers/answer-page";
import a from "../answers/answers.module.css";
import { ArrowRight, ArrowUpRight, Phone } from "../icons";
import { voiceDemos } from "../live/demo-info";
import { FOUNDER, JsonLd, ORG_REF, SITE } from "../site";
import { Engine, Logo, builtWith } from "./agent-page";
import { ARCHITECTURES, ARCHITECTURE_FAQS, CHOOSE, COMPARISON, LOGOS, PARTS, STORIES } from "./content";
import s from "./agent-page.module.css";

const UPDATED = "5 October 2026";

/** /architecture/: a reference guide to how voice agents are built. Each architecture with a live demo gets a section; grows with STORIES and ARCHITECTURE_FAQS. */
export function ArchitectureHub() {
  const toc = [
    { id: "parts", label: "The parts of a voice agent" },
    ...STORIES.map((x, i) => ({ id: x.slug, label: `${i + 1}. ${ARCHITECTURES[x.architecture].name}` })),
    { id: "compare", label: "Side by side" },
    { id: "choose", label: "How to choose" },
    { id: "questions", label: "Questions" },
  ];
  return <AnswersShell>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "How AI voice agents are built",
      description: "A guide to voice agent architecture: speech-to-speech models, managed voice platforms and speech-to-text, LLM and text-to-speech cascades.",
      url: `${SITE}/architecture/`,
      author: { "@type": "Person", name: FOUNDER.name, sameAs: [FOUNDER.linkedin] },
      publisher: ORG_REF,
      hasPart: STORIES.map((x) => ({ "@type": "TechArticle", headline: x.seoTitle, url: `${SITE}/architecture/${x.slug}/` })),
    }} />
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ARCHITECTURE_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    }} />
    <div className={s.guide}>
      <nav className={s.toc} aria-label="Contents">
        <p>Contents</p>
        <ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>)}</ol>
      </nav>

      <article className={s.guideBody}>
        <header className={s.guideHead}>
          <p className={s.guideKicker}>Voice agent architecture</p>
          <h1>How AI voice agents are built</h1>
          <p className={s.lede}>Every voice agent has to hear, think, call tools and speak. How those parts fit together decides how fast it replies, how well it handles interruptions, how accurately it hears details and who can maintain it. There are three main ways to build one, and we run a live demo of each.</p>
          <p className={s.guideMeta}>By {FOUNDER.name}, founder of Digital Macaroni · Updated {UPDATED}</p>
        </header>

        <section id="parts" className={s.guideSection}>
          <h2>The parts of a voice agent</h2>
          <figure className={s.flow} data-tone="mono" aria-label="The parts of a voice agent">
            <div className={`${s.flowRow} ${s.flowCompact}`}>
              <div className={s.node}><span className={s.nodeIcon}><Phone size={16} /></span><b>Caller</b></div>
              <span className={s.link} aria-hidden="true"><i /></span>
              <div className={s.node}><b>Phone line</b></div>
              <span className={s.link} data-both aria-hidden="true"><i /></span>
              <div className={`${s.node} ${s.engine}`}><div className={s.oneModelParts}>{["Hear", "Think", "Speak"].map((p) => <span key={p}>{p}</span>)}</div></div>
              <span className={s.link} data-both aria-hidden="true"><i /></span>
              <div className={s.node}><b>Tools</b></div>
            </div>
          </figure>
          <dl className={s.parts}>
            {PARTS.map((p) => <Fragment key={p.name}><dt>{p.name}</dt><dd>{p.copy}</dd></Fragment>)}
          </dl>
          <p className={s.guideText}>The three architectures below differ in one place: how hearing, thinking and speaking are put together.</p>
        </section>

        {STORIES.map((x, i) => {
          const arch = ARCHITECTURES[x.architecture];
          const d = voiceDemos[x.demo];
          return <section key={x.slug} id={x.slug} className={s.guideSection}>
            <p className={s.guideNum}>{String(i + 1).padStart(2, "0")} · {arch.also}</p>
            <h2>{arch.name}</h2>
            <p className={s.guideText}>{arch.guide}</p>
            <figure className={`${s.flow} ${s.guideSchematic}`} data-tone="mono" aria-label={`${arch.name}: how a call flows`}>
              <div className={`${s.flowRow} ${s.flowCompact} ${s.flowWide}`}>
                <div className={s.node}><span className={s.nodeIcon}><Phone size={16} /></span><b>Caller</b></div>
                <span className={s.link} aria-hidden="true"><i /></span>
                <div className={s.node}><b>Phone line</b></div>
                <span className={s.link} data-both aria-hidden="true"><i /></span>
                <div className={`${s.node} ${s.engine}`}>
                  <span className={s.engineName}>{arch.name}</span>
                  <Engine story={x} />
                </div>
                <span className={s.link} data-both aria-hidden="true"><i /></span>
                <div className={s.node}><b>Tools</b></div>
              </div>
            </figure>
            <div className={s.guideCols}>
              <div>
                <h3>Good at</h3>
                <ul>{x.strengths.map((t) => <li key={t.title}>{t.title}</li>)}</ul>
              </div>
              <div>
                <h3>Trade-offs</h3>
                <ul>{x.tradeOffs.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            <p className={s.guideBuilt}><span>Our build</span>{builtWith(x).map((id) => <span key={id} className={s.guideLogo}><Logo id={id} size={14} />{LOGOS[id].name}</span>)}</p>
            <div className={s.guideLinks}>
              <a href={`/architecture/${x.slug}/`}>Full breakdown<ArrowRight size={14} /></a>
              <a href={`/demo/${x.demo}/`}>See it live: {d.agentName} at {d.name}<ArrowUpRight size={14} /></a>
            </div>
          </section>;
        })}

        <section id="compare" className={s.guideSection}>
          <h2>Side by side</h2>
          <div className={s.compareWrap}>
            <table className={s.compare}>
              <thead>
                <tr><th scope="col"><span className={s.srOnly}>Compare</span></th>{STORIES.map((x) => <th key={x.slug} scope="col"><a href={`#${x.slug}`}>{ARCHITECTURES[x.architecture].name}</a></th>)}</tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {STORIES.map((x) => <td key={x.slug}>{row.values[x.architecture]}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section id="choose" className={s.guideSection}>
          <h2>How to choose</h2>
          <dl className={s.parts}>
            {STORIES.map((x) => <Fragment key={x.slug}><dt><a href={`#${x.slug}`}>{ARCHITECTURES[x.architecture].name}</a></dt><dd>{CHOOSE[x.architecture]}</dd></Fragment>)}
          </dl>
        </section>

        <section id="questions" className={`${a.faqs} ${s.guideSection}`}>
          <h2>Questions about voice agent architecture</h2>
          {ARCHITECTURE_FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>

        <div className={a.note}>
          <div>
            <h2>Not sure which one fits your calls?</h2>
            <p>Tell us how your phone line works. We’ll recommend an architecture and explain why.</p>
          </div>
          <a className={a.noteCta} href="/contact/">Drop us a note<ArrowUpRight size={14} /></a>
        </div>
      </article>
    </div>
  </AnswersShell>;
}
