import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/ArticlePage";
import { getAllContent, getContentBySlug } from "@/lib/content";

function recommendationRank(currentSlug: string, candidateSlug: string) {
  let hash = 2166136261;
  for (const character of `${currentSlug}:${candidateSlug}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateStaticParams() {
  const params = getAllContent("review").map(({ slug }) => ({ slug }));
  return params.length > 0 ? params : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getContentBySlug("review", slug);
  if (!entry) return {};
  const canonical = `/reviews/${entry.slug}`;
  const image = `/reviews/${entry.slug}/og-image`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: {
      canonical,
      types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
    },
    authors: [{ name: entry.author, url: "/about" }],
    openGraph: {
      type: "article",
      url: canonical,
      title: entry.title,
      description: entry.description,
      images: [{ url: image, width: 1200, height: 630, alt: `${entry.company} review by Digital Macaroni` }],
      publishedTime: `${entry.date}T12:00:00Z`,
      authors: [entry.author],
    },
    twitter: {
      card: "summary",
      title: entry.title,
      description: entry.description,
      images: [image],
    },
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getContentBySlug("review", slug);
  if (!entry) notFound();
  const recommendations = getAllContent("review")
    .filter((review) => review.slug !== entry.slug)
    .sort((left, right) => recommendationRank(entry.slug, left.slug) - recommendationRank(entry.slug, right.slug))
    .slice(0, 3);
  return <ArticlePage entry={entry} recommendations={recommendations} />;
}
