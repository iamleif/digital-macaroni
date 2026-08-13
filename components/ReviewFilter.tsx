"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import type { ContentMeta } from "@/lib/content";
import { ReviewCard } from "./ReviewCard";

export function ReviewFilter({ reviews }: { reviews: ContentMeta[] }) {
  const reviewsPerPage = 12;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(reviews.map((review) => review.category)))],
    [reviews],
  );
  const activeCategory = categories.includes(searchParams.get("category") ?? "")
    ? searchParams.get("category")!
    : "All";
  const searchQuery = searchParams.get("q") ?? "";
  const sortOrder = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value || (key === "category" && value === "All") || (key === "sort" && value === "newest")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
  const visibleReviews = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reviews
      .filter((review) => activeCategory === "All" || review.category === activeCategory)
      .filter((review) => {
        if (!normalizedQuery) return true;

        return [review.company, review.title, review.description, review.category, review.verdict]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const dateDifference = new Date(left.date).getTime() - new Date(right.date).getTime();
        return sortOrder === "newest" ? -dateDifference : dateDifference;
      });
  }, [activeCategory, reviews, searchQuery, sortOrder]);
  const pageCount = Math.max(1, Math.ceil(visibleReviews.length / reviewsPerPage));
  const requestedPage = Number(searchParams.get("page"));
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const pageReviews = visibleReviews.slice((currentPage - 1) * reviewsPerPage, currentPage * reviewsPerPage);
  const firstSixReviews = pageReviews.slice(0, 6);
  const secondSixReviews = pageReviews.slice(6);

  return (
    <section className="product-picks review-filter-section section-pad" aria-labelledby="filtered-reviews-title">
      <header className="reviews-home-heading">
        <div>
          <span className="tiny-label">Browse the shelf</span>
          <h2 id="filtered-reviews-title">Every product</h2>
        </div>
        <p aria-live="polite">{visibleReviews.length} {visibleReviews.length === 1 ? "review" : "reviews"}</p>
      </header>
      <div className="category-filter" aria-label="Filter reviews by category">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={activeCategory === category}
            aria-controls="filtered-review-grid"
            onClick={() => updateFilters({ category, page: "" })}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="review-list-controls">
        <label className="review-search" htmlFor="review-search">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search reviews</span>
          <input
            id="review-search"
            type="search"
            value={searchQuery}
            onChange={(event) => updateFilters({ q: event.target.value, page: "" })}
            placeholder="Search products or categories"
          />
        </label>
        <div className="review-sort">
          <span>Sort by</span>
          <div className="review-sort-menu">
            <button
              className="review-sort-trigger"
              type="button"
              aria-expanded={isSortMenuOpen}
              aria-haspopup="true"
              onClick={() => setIsSortMenuOpen((isOpen) => !isOpen)}
            >
              {sortOrder === "newest" ? "Most recent" : "Oldest first"}
              <CaretDown size={16} aria-hidden="true" />
            </button>
            {isSortMenuOpen && (
              <div className="review-sort-options" aria-label="Sort reviews">
                <button
                  type="button"
                  aria-pressed={sortOrder === "newest"}
                  onClick={() => {
                    updateFilters({ sort: "newest", page: "" });
                    setIsSortMenuOpen(false);
                  }}
                >
                  Most recent
                </button>
                <button
                  type="button"
                  aria-pressed={sortOrder === "oldest"}
                  onClick={() => {
                    updateFilters({ sort: "oldest", page: "" });
                    setIsSortMenuOpen(false);
                  }}
                >
                  Oldest first
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="product-pick-grid all-review-grid" id="filtered-review-grid">
        {visibleReviews.length > 0 ? (
          firstSixReviews.map((review) => <ReviewCard key={review.slug} review={review} />)
        ) : (
          <p className="review-search-empty">No reviews match that search.</p>
        )}
      </div>
      {visibleReviews.length > 0 && (
        <>
          <aside className="review-submit-cta" aria-labelledby="review-submit-title">
            <div>
              <span className="tiny-label">Choose what comes next</span>
              <h3 id="review-submit-title">Know software we should review?</h3>
            </div>
            <div>
              <p>Tell us what it does and why it deserves a closer look. A submission never buys a score.</p>
              <Link href="/submit">Put it on our desk <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </aside>
          {secondSixReviews.length > 0 && (
            <div className="product-pick-grid all-review-grid review-grid-after-cta">
              {secondSixReviews.map((review) => <ReviewCard key={review.slug} review={review} />)}
            </div>
          )}
          {pageCount > 1 && (
            <nav className="review-pagination" aria-label="Review pages">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  aria-current={page === currentPage ? "page" : undefined}
                  onClick={() => updateFilters({ page: String(page) })}
                >
                  {page}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
