import { Fragment } from "react";
import { AnswersShell } from "../answers/answer-page";
import a from "../answers/answers.module.css";
import { BrandLockup } from "../brand-marks";
import { Airplane, Armchair, ArrowsClockwise, Barbell, Bed, Buildings, Calculator, CarProfile, Confetti, ForkKnife, Garage, Gear, HardHat, Key, Package, PawPrint, Plant, Scales, Scissors, ShieldCheck, Stethoscope, Storefront, Tooth, Toolbox, Truck, Warehouse, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { ArrowDown, ArrowUpRight, Check, Phone } from "../icons";
import { voiceDemos } from "../live/demo-info";
import { JsonLd, ORG_REF, SITE } from "../site";
import { ARCHITECTURES, LOGOS, STORIES, stackOf, type ArchitectureStory, type LogoId } from "./content";
import s from "./agent-page.module.css";

const BUSINESS_ICONS: Record<string, Icon> = { Airplane, Armchair, ArrowsClockwise, Barbell, Bed, Buildings, Calculator, CarProfile, Confetti, ForkKnife, Garage, Gear, HardHat, Key, Package, PawPrint, Plant, Scales, Scissors, ShieldCheck, Stethoscope, Storefront, Tooth, Toolbox, Truck, Warehouse, Wrench };

function BusinessIcon({ name }: { name: string }) {
  const I = BUSINESS_ICONS[name];
  return I ? <span className={s.businessIcon}><I size={18} weight="regular" /></span> : null;
}

export function Logo({ id, size = 16 }: { id: LogoId; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={s.logo} data-mono={LOGOS[id].mono || undefined} src={LOGOS[id].src} alt="" width={size} height={size} />;
}

/** Every company whose technology the demo runs on, engine first. */
export function builtWith(story: ArchitectureStory): LogoId[] {
  const ids = stackOf(story).map((p) => p.logo).filter((x): x is LogoId => Boolean(x));
  return [...new Set(ids)];
}

// The phone line, the call link to the screen and ending the call: plumbing, not something the agent does for the caller.
const PLUMBING = new Set(["get_caller_number", "link_screen", "end_call"]);

/** Caller → phone line and call service → the engine ⇄ the demo backend. Only the engine differs between the three demos. */
function Flow({ story }: { story: ArchitectureStory }) {
  const demo = voiceDemos[story.demo];
  const tools = demo.design.tools.filter((t) => !PLUMBING.has(t.name));
  const shown = tools.slice(0, 5);
  return <figure className={s.flow} data-tone={story.tone} aria-label={`Architecture of the ${demo.name} demo`}>
    <div className={s.flowRow}>
      <div className={s.node}>
        <span className={s.nodeIcon}><Phone size={16} /></span>
        <b>The caller</b>
        <p>Rings the demo number from any phone.</p>
      </div>
      <Link />
      <div className={s.node}>
        <span className={s.nodeLogos}><Logo id={story.carrier} /><Logo id="google-cloud" /></span>
        <b>Phone line and call service</b>
        <p>{LOGOS[story.carrier].name} streams the call to our service on Google Cloud Run, which pairs it with the live screen.</p>
      </div>
      <Link both />
      <div className={`${s.node} ${s.engine}`} data-architecture={story.architecture}>
        <span className={s.engineName}>{ARCHITECTURES[story.architecture].name}</span>
        <Engine story={story} />
      </div>
      <Link both />
      <div className={s.node}>
        <b>Demo backend</b>
        <ul className={s.tools}>
          {shown.map((t) => <li key={t.name}><Check size={13} />{t.label}</li>)}
          {tools.length > shown.length && <li className={s.more}>and {tools.length - shown.length} more tools</li>}
        </ul>
      </div>
    </div>
    <figcaption>Tool calls run on our own service, against the demo’s data. Every result is shown on the live screen as it happens, and the confirmation goes out by email.</figcaption>
  </figure>;
}

export function Engine({ story }: { story: ArchitectureStory }) {
  const { label, parts } = story.engine;
  if (story.architecture === "bidirectional") return <div className={s.oneModel}>
    <div className={s.oneModelHead}><span className={s.orb} aria-hidden="true" /><b>{label}</b><Logo id={story.engine.logo} /></div>
    <div className={s.oneModelParts}>{parts.map((p) => <span key={p.role}>{p.role}</span>)}</div>
    <p>One live session, audio in and out at once.</p>
  </div>;
  if (story.architecture === "platform") return <div className={s.platform}>
    <span className={s.platformName}><Logo id={story.engine.logo} size={12} />{label}</span>
    {parts.map((p) => <div key={p.role} className={s.part}><small>{p.role}</small><span>{p.logo && <Logo id={p.logo} size={13} />}{p.name}</span></div>)}
  </div>;
  return <div className={s.chain}>
    {parts.map((p, i) => <Fragment key={p.role}>
      {i > 0 && <span className={s.chainArrow} aria-hidden="true"><ArrowDown size={12} /></span>}
      <div className={s.part}><small>{p.role}</small><span>{p.logo && <Logo id={p.logo} size={13} />}{p.name}</span></div>
    </Fragment>)}
  </div>;
}

function Link({ both = false }: { both?: boolean }) {
  return <span className={s.link} data-both={both || undefined} aria-hidden="true"><i /></span>;
}

export function ArchitecturePage({ story }: { story: ArchitectureStory }) {
  const demo = voiceDemos[story.demo];
  const arch = ARCHITECTURES[story.architecture];
  const url = `${SITE}/architecture/${story.slug}/`;
  const others = STORIES.filter((x) => x.demo !== story.demo);
  return <AnswersShell>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: story.seoTitle,
      description: story.description,
      url,
      publisher: ORG_REF,
      author: ORG_REF,
    }} />
    <article className={s.page}>
      <nav className={a.crumbs} aria-label="Breadcrumb"><a href="/architecture/">Voice agent architecture</a><span>/</span><span>{arch.name}</span></nav>

      <header className={s.hero} data-tone={story.tone}>
        <div className={s.heroTop}>
          <BrandLockup id={story.demo} />
        </div>
        <p className={s.kicker}>{arch.name}</p>
        <h1>{story.headline}</h1>
        <p className={s.lede}>{story.lede}</p>
        <div className={s.heroActions}>
          <a className={s.primary} href={`/demo/${story.demo}/`}>Call the {demo.name} demo<ArrowUpRight size={14} /></a>
          <a className={s.secondary} href="/architecture/">Compare architectures</a>
        </div>
      </header>

      <section className={s.builtWith} aria-label="Built with">
        <span>Built with</span>
        <ul>{builtWith(story).map((id) => <li key={id}><Logo id={id} size={18} />{LOGOS[id].name}</li>)}</ul>
      </section>

      <section className={s.section}>
        <h2>The architecture</h2>
        <Flow story={story} />
      </section>

      <section className={s.section}>
        <h2>Businesses this architecture works for</h2>
        <p className={s.sectionNote}>{story.businesses.intro}</p>
        <ul className={s.businesses}>
          {story.businesses.list.map((b) => <li key={b.name}><div className={s.businessHead}><BusinessIcon name={b.icon} /><b>{b.name}</b></div><p>{b.idea}</p></li>)}
        </ul>
      </section>

      <section className={s.section}>
        <h2>The stack</h2>
        <div className={s.stack}>
          {stackOf(story).map((p) => <div key={p.role + p.name}>
            <span className={s.stackRole}>{p.logo && <Logo id={p.logo} size={14} />}{p.role}</span>
            <b>{p.name}</b>
            <p>{p.note}</p>
          </div>)}
        </div>
      </section>

      <section className={s.section}>
        <h2>What this architecture does well</h2>
        <div className={s.strengths}>
          {story.strengths.map((x) => <div key={x.title}><b>{x.title}</b><p>{x.copy}</p></div>)}
        </div>
      </section>

      <section className={s.section}>
        <h2>What the demo shows on a call</h2>
        <ol className={s.steps}>
          {story.steps.map((step, i) => <li key={step.title}><span>{String(i + 1).padStart(2, "0")}</span><b>{step.title}</b><p>{step.copy}</p></li>)}
        </ol>
      </section>

      <section className={s.section}>
        <h2>Guardrails in the demo</h2>
        <ul className={s.rules}>
          {demo.design.rules.map((r) => <li key={r}><Check size={15} />{r}</li>)}
        </ul>
      </section>

      <section className={s.fit}>
        <h2>Trade-offs</h2>
        <ul>{story.tradeOffs.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <aside className={a.test} aria-label="Try the live demo">
        <div>
          <p className={a.testKicker}>Hear the architecture</p>
          <h2>Call the {demo.name} demo and watch the agent work on screen.</h2>
          <p>Interrupt, change your mind, ask for something off-limits. The live screen shows every tool call as it happens.</p>
        </div>
        <div className={a.testActions}>
          <a className={a.testCall} href={`/demo/${story.demo}/`}>Open the live demo<ArrowUpRight size={14} /></a>
        </div>
      </aside>

      <section className={s.section} id="compare">
        <h2>The other two architectures</h2>
        <p className={s.sectionNote}>There’s no single right way to build a voice agent. Each demo shows a different one, and we choose per business. <a href="/architecture/">See them side by side</a>.</p>
        <div className={s.others}>
          {others.map((o) => {
            const d = voiceDemos[o.demo];
            return <a key={o.demo} href={`/architecture/${o.slug}/`} className={s.other} data-tone={o.tone}>
              <span className={s.otherKicker}>{d.name} demo</span>
              <b>{ARCHITECTURES[o.architecture].name}</b>
              <p>{ARCHITECTURES[o.architecture].short}</p>
              <span className={s.otherArrow}><ArrowUpRight size={14} /></span>
            </a>;
          })}
        </div>
      </section>

      <div className={a.note}>
        <div>
          <h2>Building for a different kind of business?</h2>
          <p>Tell us how your calls go. We’ll recommend an architecture and explain why.</p>
        </div>
        <a className={a.noteCta} href="/contact/">Drop us a note<ArrowUpRight size={14} /></a>
      </div>
    </article>
  </AnswersShell>;
}
