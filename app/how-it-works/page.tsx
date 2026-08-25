import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "@phosphor-icons/react/ssr";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How we review software",
  description:
    "How Digital Macaroni uses, investigates, and judges software products.",
  alternates: {
    canonical: "/how-it-works",
    types: {
      "application/rss+xml": "/feed.xml",
      "application/feed+json": "/feed.json",
    },
  },
};

const reviewAreas = [
  ["01", "Onboarding", "The first useful moment"],
  ["02", "Product", "The everyday reality"],
  ["03", "Support", "When things go sideways"],
  ["04", "Billing", "The money part"],
] as const;

const process = [
  {
    number: "01",
    title: "Give it a real job.",
    copy: "We start from scratch and use the product to get something done. No guided-demo theatre. No review assembled from a feature page.",
  },
  {
    number: "02",
    title: "Follow the friction.",
    copy: "We keep notes on setup, dead ends, unclear language, missing features, pricing, and the moments that are surprisingly good.",
  },
  {
    number: "03",
    title: "Make the call.",
    copy: "We compare the promise with the reality and write a verdict. Context matters more than a tidy spreadsheet average.",
  },
  {
    number: "04",
    title: "Look beyond our own test.",
    copy: "We research what other people have said across review platforms, customer communities, forums, and the wider web—looking for patterns our own time with the product might not reveal.",
  },
] as const;

const lenses = [
  {
    number: "01",
    title: "Onboarding",
    kicker: "Can you get anywhere useful?",
    copy: "We look at the path from first click to first result: setup, guidance, defaults, imports, and the amount of work required before the product earns its keep.",
  },
  {
    number: "02",
    title: "Product",
    kicker: "Does the core job hold up?",
    copy: "This carries the most weight. We test the work the product says it is built for, then pay attention to reliability, speed, limitations, and everyday friction.",
  },
  {
    number: "03",
    title: "Support",
    kicker: "What help is actually there?",
    copy: "We inspect the documentation and help experience. When we contact support, we say how and why. When we do not, we say that too.",
  },
  {
    number: "04",
    title: "Billing",
    kicker: "Is the money part honest?",
    copy: "We check pricing clarity, plan boundaries, trial terms, upgrade pressure, and cancellation information. We do not pretend to have tested a charge or refund we never made.",
  },
] as const;

const scoreBands = [
  ["9.0–10", "Exceptional", "A category standout. Easy to recommend."],
  ["8.0–8.9", "Great", "Very good, with compromises worth knowing."],
  ["7.0–7.9", "Good", "Useful, capable, and meaningfully imperfect."],
  ["6.0–6.9", "Mixed", "The rough edges change the recommendation."],
  ["Below 6", "Hard to recommend", "The product asks too much in return."],
] as const;

export default function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="how-title">
        <div className={styles.copy}>
          <div className={styles.eyebrow}>
            <span>Independent software reviews</span>
            <span aria-hidden="true">No sponsored scores</span>
          </div>

          <h1 id="how-title">
            Software reviews with the <em>boring bits</em> left in.
          </h1>

          <div className={styles.introRow}>
            <p>
              We test the first login, the daily work, the help available when
              things get awkward, and what it costs—then tell you what the
              polished homepage left out.
            </p>

            <Link className={styles.textLink} href="#method">
              See the method
              <ArrowDown size={17} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className={styles.receipt} aria-label="The four parts of a review">
          <div className={styles.tape} aria-hidden="true">
            The useful bits
          </div>

          <header className={styles.receiptHeader}>
            <span>Our review receipt</span>
            <span>DM / 001</span>
          </header>

          <div className={styles.receiptTitle}>
            <p>We don&apos;t stop at the feature list.</p>
            <span>Four lenses. One editorial call.</span>
          </div>

          <ol className={styles.receiptAreas}>
            {reviewAreas.map(([number, name, note]) => (
              <li key={number}>
                <span>{number}</span>
                <strong>{name}</strong>
                <small>{note}</small>
              </li>
            ))}
          </ol>

          <footer className={styles.receiptFooter}>
            <span>Scope disclosed</span>
            <span>Opinion included</span>
          </footer>
        </aside>
      </section>

      <section className={styles.method} id="method" aria-labelledby="method-title">
        <header className={styles.sectionIntro}>
          <span className={styles.label}>The method</span>
          <h2 id="method-title">Use it first.<br />Write second.</h2>
          <p>
            A good review needs a point of view, but it also needs receipts.
            This is the basic loop behind every Digital Macaroni verdict.
          </p>
        </header>

        <ol className={styles.processList}>
          {process.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.lenses} aria-labelledby="lenses-title">
        <header className={styles.lensesHeader}>
          <div>
            <span className={styles.label}>What we pay attention to</span>
            <h2 id="lenses-title">Four lenses.<br />Not four promises.</h2>
          </div>
          <p>
            These keep reviews consistent. They are not a claim that we have
            seen every edge case, spoken to every support agent, or lived
            through a year of invoices.
          </p>
        </header>

        <div className={styles.lensList}>
          {lenses.map((lens) => (
            <article key={lens.number}>
              <span>{lens.number}</span>
              <div>
                <h3>{lens.title}</h3>
                <strong>{lens.kicker}</strong>
              </div>
              <p>{lens.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.scoring} aria-labelledby="scoring-title">
        <div className={styles.scoreStatement}>
          <span className={styles.label}>About the score</span>
          <h2 id="scoring-title">A verdict.<br />Not a formula.</h2>
          <p>
            The four lenses inform the final score, but we do not average them
            mechanically. A serious product failure can matter more than four
            pleasant setup screens. The number is editorial judgment, made
            visible.
          </p>
        </div>

        <div className={styles.bands} aria-label="Score meanings">
          {scoreBands.map(([range, name, description]) => (
            <div key={range}>
              <strong>{range}</strong>
              <span>{name}</span>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.honesty} aria-labelledby="honesty-title">
        <span className={styles.label}>The important part</span>
        <div className={styles.honestyGrid}>
          <h2 id="honesty-title">Certainty is cheap.<br />Specifics are useful.</h2>
          <div>
            <p>
              We tell you what we used, what happened, and where our test
              stopped. If a company points out a factual error, we correct it.
              We do not negotiate the opinion.
            </p>
            <Link className={styles.reviewLink} href="/reviews">
              Read the reviews
              <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
