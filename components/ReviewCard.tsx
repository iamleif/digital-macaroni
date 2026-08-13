import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import type { ContentMeta } from "@/lib/content";
import { ProductMark } from "./ProductMark";

export function ReviewCard({ review }: { review: ContentMeta }) {
  return (
    <article className="review-card">
      <Link href={`/reviews/${review.slug}`} aria-label={`Read our ${review.company} review`}>
        <header className="review-card-top">
          <ProductMark slug={review.slug} name={review.company ?? review.title} logoUrl={review.logoUrl} />
          <span className="review-card-category">{review.category}</span>
          <span className="review-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </header>
        <div className="review-card-copy">
          <span className="review-card-name">{review.company}</span>
          <h2>{review.cardVerdict}</h2>
          <p>{review.description}</p>
        </div>
        <footer className="review-card-bottom">
          <span>Our score</span>
          <strong>{review.score?.toFixed(1)}</strong>
          <small>/ 10</small>
        </footer>
      </Link>
    </article>
  );
}
