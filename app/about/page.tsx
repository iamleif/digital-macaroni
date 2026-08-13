import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "About",
  description: "Why Digital Macaroni reviews software as a service experience.",
  alternates: {
    canonical: "/about",
    types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
  },
};

export default function AboutPage() {
  return (
    <section className="about-page section-pad">
      <header className="about-hero">
        <span className="eyebrow">About this publication</span>
        <h1>Software has a customer service problem.</h1>
      </header>
      <div className="about-grid">
        <div className="about-statement">
          <p>
            Digital Macaroni is an independent publication about SaaS, customer
            experience and the products people actually have to use.
          </p>
        </div>
        <div className="about-copy">
          <p>
            Products are usually reviewed as collections of features. But customers
            experience the whole thing: the promise on the landing page, the first
            five minutes, the work they came to do, the answer they get when something
            breaks and the invoice that arrives later.
          </p>
          <p>
            That complete experience is what Digital Macaroni pays attention to.
            Reviews score the product and the service around it. Stories look at the
            systems, habits and small decisions that shape how software feels to use.
          </p>
          <p>
            The publication is written and built by Leif Johansen. I work across
            product, customer experience, AI and early-stage startups. I have built
            voice AI products, worked closely with customers and developed strong
            opinions about support queues along the way.
          </p>
          <div className="about-contact">
            <a href="mailto:hello@digitalmacaroni.io">hello@digitalmacaroni.io <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" /></a>
            <a href="https://www.linkedin.com/company/digitalmacaroni/" target="_blank" rel="noreferrer">
              LinkedIn <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
      <aside className="about-principles">
        <span className="eyebrow">Editorial principles</span>
        <ol>
          <li><span>01</span>Use the real product.</li>
          <li><span>02</span>Review the relationship, not the feature list.</li>
          <li><span>03</span>Be specific enough to be useful.</li>
          <li><span>04</span>Say when an opinion is an opinion.</li>
        </ol>
      </aside>
    </section>
  );
}
