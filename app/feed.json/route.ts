import { getAllContent, getContentBySlug } from "@/lib/content";

export const dynamic = "force-static";

const baseUrl = "https://digitalmacaroni.io";

export function GET() {
  const items = getAllContent("review").map((review) => {
    const entry = getContentBySlug("review", review.slug);
    return {
      id: `${baseUrl}/reviews/${review.slug}`,
      url: `${baseUrl}/reviews/${review.slug}`,
      title: review.title,
      summary: review.description,
      content_text: entry?.body ?? review.description,
      date_published: `${review.date}T12:00:00Z`,
      authors: [{ name: review.author, url: `${baseUrl}/about` }],
      tags: [review.category, review.reviewType].filter(Boolean),
    };
  });

  return Response.json({
    version: "https://jsonfeed.org/version/1.1",
    title: "Digital Macaroni",
    home_page_url: `${baseUrl}/`,
    feed_url: `${baseUrl}/feed.json`,
    description: "Independent software reviews with clear opinions and simple scores.",
    language: "en",
    authors: [{ name: "Leif Johansen", url: `${baseUrl}/about` }],
    items,
  });
}
