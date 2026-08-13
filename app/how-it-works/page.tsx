import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How scoring works",
  description: "How Digital Macaroni reviews and scores software products.",
  alternates: {
    canonical: "/how-it-works",
    types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
  },
};

const criteria = [
  { number: "01", name: "Onboarding", copy: "How easy is it to understand, set up, and reach the first useful moment?" },
  { number: "02", name: "Product", copy: "Does the core product do its job well, consistently, and without unnecessary friction?" },
  { number: "03", name: "Support", copy: "What happens when something breaks, becomes confusing, or needs a human answer?" },
  { number: "04", name: "Billing", copy: "Is the price clear, the value fair, and the experience sane when money changes hands?" },
];

const bands = [
  ["9.0–10", "Exceptional", "One of the best products in its category."],
  ["8.0–8.9", "Great", "Easy to recommend, with a few real compromises."],
  ["7.0–7.9", "Good", "Useful and capable, but the rough edges matter."],
  ["6.0–6.9", "Mixed", "Gets important things right and important things wrong."],
  ["Below 6", "Hard to recommend", "The experience asks too much of the customer."],
];

export default function HowItWorksPage() {
  return (
    <div className="how-page section-pad">
      <header className="how-page-hero">
        <h1>We score the whole experience.</h1>
        <p>
          Every review starts with using the actual product. We look at four
          parts of the customer experience, then make one overall editorial call.
        </p>
      </header>

      <section className="criteria-list" aria-labelledby="criteria-title">
        <header className="criteria-heading">
          <h2 id="criteria-title">What we rate</h2>
          <span className="tiny-label">Four parts · one score</span>
        </header>
        <div className="criteria-grid">
          {criteria.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{item.name}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="score-bands" aria-labelledby="score-bands-title">
        <header>
          <span className="tiny-label">The scale</span>
          <h2 id="score-bands-title">What the final number means</h2>
          <p>
            The final score is informed by the four ratings, but it is not a
            mechanical average. Products are relationships; context and severity matter.
          </p>
        </header>
        <div>
          {bands.map(([range, label, copy]) => (
            <article key={range}>
              <strong>{range}</strong>
              <h3>{label}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
