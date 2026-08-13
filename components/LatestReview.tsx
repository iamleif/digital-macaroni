import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import type { ContentMeta } from "@/lib/content";
import { ProductMark } from "./ProductMark";

export function LatestReview({ review }: { review: ContentMeta }) {
  return (
    <section className="latest-review section-pad" aria-labelledby="latest-review-title">
      <div className="latest-review-copy">
        <span className="tiny-label">Newest review · {review.category}</span>
        <div className="latest-product-name">
          <ProductMark slug={review.slug} name={review.company ?? review.title} logoUrl={review.logoUrl} large />
          <span>{review.company}</span>
        </div>
        <h1 id="latest-review-title">{review.verdict}</h1>
        <p>{review.description}</p>
        <Link className="read-review-link" href={`/reviews/${review.slug}`}>
          Read our {review.company} review <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" />
        </Link>
      </div>
      <aside className="latest-score" aria-label={`Our score: ${review.score} out of 10`}>
        <span>Our score</span>
        <strong>{review.score?.toFixed(1)}</strong>
        <small>out of 10</small>
        <div className="latest-score-breakdown">
          {Object.entries(review.scores ?? {}).map(([label, score]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{score.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
