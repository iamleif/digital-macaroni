import { getAllContent, getContentBySlug } from "@/lib/content";

export const dynamic = "force-static";

const baseUrl = "https://digitalmacaroni.io";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const reviews = getAllContent("review");
  const latestPublication = reviews
    .map((review) => review.date)
    .sort((left, right) => right.localeCompare(left))[0];
  const lastBuildDate = latestPublication
    ? new Date(`${latestPublication}T12:00:00Z`).toUTCString()
    : new Date().toUTCString();
  const items = reviews.map((review) => {
    const entry = getContentBySlug("review", review.slug);
    const content = entry?.body
      .replaceAll("<Callout>", "")
      .replaceAll("</Callout>", "")
      .replace(/^##\s+/gm, "")
      .replace(/\n{2,}/g, "\n\n")
      .trim() ?? review.description;

    return `
    <item>
      <title>${xml(review.title)}</title>
      <link>${baseUrl}/reviews/${review.slug}</link>
      <guid isPermaLink="true">${baseUrl}/reviews/${review.slug}</guid>
      <description>${xml(review.description)}</description>
      <category>${xml(review.category)}</category>
      <dc:creator>${xml(review.author)}</dc:creator>
      <pubDate>${new Date(`${review.date}T12:00:00Z`).toUTCString()}</pubDate>
      <content:encoded>${xml(content)}</content:encoded>
    </item>`;
  }).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Digital Macaroni</title>
    <link>${baseUrl}</link>
    <description>Independent software reviews with clear opinions and simple scores.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
