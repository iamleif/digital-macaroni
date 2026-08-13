import type { ContentMeta } from "@/lib/content";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { ReviewCard } from "./ReviewCard";

export function ProductPicks({
  reviews,
  title = "Most recent",
  eyebrow = "Latest reviews",
  viewAllHref,
}: {
  reviews: ContentMeta[];
  title?: string;
  eyebrow?: string;
  viewAllHref?: string;
}) {
  return (
    <section className="product-picks section-pad" id="product-picks" aria-labelledby="product-picks-title">
      <header className="reviews-home-heading">
        <div>
          <span className="tiny-label">{eyebrow}</span>
          <h2 id="product-picks-title">{title}</h2>
        </div>
        <p>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
      </header>
      <div className="product-pick-grid">
        {reviews.map((review) => <ReviewCard key={review.slug} review={review} />)}
      </div>
      {viewAllHref && (
        <Link className="view-all-reviews-link" href={viewAllHref}>
          See all reviews <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
