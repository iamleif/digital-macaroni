import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/components/MdxComponents";
import { ProductMark } from "@/components/ProductMark";
import { ReviewCard } from "@/components/ReviewCard";
import { StructuredData } from "@/components/StructuredData";
import type { ContentEntry, ContentMeta } from "@/lib/content";
import { formatDate } from "@/lib/content";

export function ArticlePage({ entry, recommendations }: { entry: ContentEntry; recommendations: ContentMeta[] }) {
  const canonicalUrl = `https://digitalmacaroni.io/reviews/${entry.slug}`;
  const imageUrl = `${canonicalUrl}/og-image`;
  const authorId = "https://digitalmacaroni.io/about#leif-johansen";
  const organizationId = "https://digitalmacaroni.io/#organization";
  const productId = `${entry.productUrl ?? canonicalUrl}#software`;
  const reviewText = entry.body
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        headline: entry.title,
        description: entry.description,
        datePublished: entry.date,
        dateModified: entry.updated,
        image: [imageUrl],
        author: { "@id": authorId },
        publisher: { "@id": organizationId },
        isPartOf: { "@id": "https://digitalmacaroni.io/#website" },
        about: { "@id": productId },
        mainEntityOfPage: canonicalUrl,
        inLanguage: "en",
      },
      {
        "@type": "Review",
        "@id": `${canonicalUrl}#review`,
        name: entry.title,
        reviewBody: reviewText,
        datePublished: entry.date,
        dateModified: entry.updated,
        author: { "@id": authorId },
        publisher: { "@id": organizationId },
        itemReviewed: {
          "@type": "SoftwareApplication",
          "@id": productId,
          name: entry.company,
          url: entry.productUrl,
          applicationCategory: entry.schemaCategory,
          operatingSystem: "Web browser",
        },
        reviewRating: typeof entry.score === "number" ? {
          "@type": "Rating",
          ratingValue: entry.score,
          bestRating: 10,
          worstRating: 0,
        } : undefined,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Digital Macaroni", item: "https://digitalmacaroni.io/" },
          { "@type": "ListItem", position: 2, name: "All reviews", item: "https://digitalmacaroni.io/reviews" },
          { "@type": "ListItem", position: 3, name: entry.company, item: canonicalUrl },
        ],
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: entry.author,
        url: "https://digitalmacaroni.io/about",
      },
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Digital Macaroni",
        url: "https://digitalmacaroni.io/",
        logo: { "@type": "ImageObject", url: "https://digitalmacaroni.io/icon.svg" },
      },
    ],
  };

  return (
    <article className="review-page section-pad">
      <StructuredData data={jsonLd} />

      <header className="review-page-header">
        <div className="review-product">
          <div className="review-product-id">
            <ProductMark slug={entry.slug} name={entry.company ?? entry.title} logoUrl={entry.logoUrl} linkTo={entry.productUrl} large />
            <div>
              <span className="tiny-label">{entry.category}</span>
              <strong>{entry.company}</strong>
            </div>
          </div>
          <h1>{entry.title}</h1>
          <p>{entry.description}</p>
          <div className="review-meta">
            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
            <span>Updated {formatDate(entry.updated, "short")}</span>
            <span>By {entry.author}</span>
            <span>{entry.readingTime} min read</span>
          </div>
        </div>

        {typeof entry.score === "number" && (
          <aside className="review-overall" aria-label={`Overall score ${entry.score} out of 10`}>
            <span>Our score</span>
            <strong>{entry.score.toFixed(1)}</strong>
            <small>out of 10</small>
            <p>“{entry.verdict}”</p>
          </aside>
        )}
      </header>

      <div className="review-content">
        <div className="review-writing">
          <span className="section-tag">What we think</span>
          <div className="article-body">
            <MDXRemote source={entry.body} components={mdxComponents} />
            {entry.productUrl && (
              <p className="official-product-link">
                <a href={entry.productUrl} target="_blank" rel="noreferrer">
                  Visit {entry.company ?? entry.title}’s official website ↗
                </a>
              </p>
            )}
          </div>
        </div>

        <aside className="rating-card" aria-label="Score breakdown">
          <span className="section-tag">What we rated</span>
          <div className="rating-lines">
            {Object.entries(entry.scores ?? {}).map(([label, score]) => (
              <div className="rating-line" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{score.toFixed(1)}</strong>
                </div>
                <span className="rating-track" aria-hidden="true">
                  <i style={{ transform: `scaleX(${score / 10})` }} />
                </span>
              </div>
            ))}
          </div>
          <div className="rating-total">
            <span>Final score</span>
            <strong>{entry.score?.toFixed(1)}</strong>
          </div>
        </aside>
      </div>

      {recommendations.length > 0 && (
        <section className="related-reviews" aria-labelledby="related-reviews-title">
          <header>
            <span className="tiny-label">Keep reading</span>
            <h2 id="related-reviews-title">Try another review.</h2>
          </header>
          <div className="related-review-grid">
            {recommendations.map((review) => <ReviewCard key={review.slug} review={review} />)}
          </div>
        </section>
      )}
    </article>
  );
}
