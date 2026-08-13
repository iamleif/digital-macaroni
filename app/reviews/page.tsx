import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewFilter } from "@/components/ReviewFilter";
import { getAllContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "All reviews",
  description: "Every Digital Macaroni software review in one place.",
  alternates: {
    canonical: "/reviews",
    types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
  },
};

export default function ReviewsPage() {
  const reviews = getAllContent("review");

  return (
    <div className="all-reviews-page">
      <Suspense fallback={null}>
        <ReviewFilter reviews={reviews} />
      </Suspense>
    </div>
  );
}
