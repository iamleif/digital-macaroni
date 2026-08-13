import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { LatestReview } from "@/components/LatestReview";
import { ProductPicks } from "@/components/ProductPicks";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { getAllContent } from "@/lib/content";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
  },
};

export default function HomePage() {
  const reviews = getAllContent("review");
  const latest = reviews[0];
  const picks = reviews.slice(1, 4);

  return (
    <>
      <SiteJsonLd />
      {latest && <LatestReview review={latest} />}
      <ProductPicks
        reviews={picks}
        title="Most recent"
        eyebrow="Latest reviews"
        viewAllHref="/reviews"
      />
      <section className="how-teaser section-pad">
        <div>
          <span className="tiny-label">How scoring works</span>
          <h2>Four ratings.<br />One honest score.</h2>
        </div>
        <div>
          <p>
            We rate onboarding, the product itself, support, and billing. The
            final score is our editorial judgment of the complete experience.
          </p>
          <Link href="/how-it-works">See the scoring system <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
