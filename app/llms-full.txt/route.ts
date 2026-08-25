import { getAllContent, getContentBySlug } from "@/lib/content";

export const dynamic = "force-static";

const baseUrl = "https://digitalmacaroni.io";

export function GET() {
  const reviews = getAllContent("review").map((review) => {
    const entry = getContentBySlug("review", review.slug);
    const sources = review.sources
      .map((source) => `- [${source.name}](${source.url}) — accessed ${source.accessed}`)
      .join("\n");

    return `## ${review.company}: ${review.title}

- URL: ${baseUrl}/reviews/${review.slug}
- Category: ${review.category}
- Published: ${review.date}
- Author: ${review.author}
- Review type: ${review.reviewType}
- Overall score: ${review.score?.toFixed(1)}/10
- Onboarding: ${review.scores?.onboarding?.toFixed(1)}/10
- Product: ${review.scores?.product?.toFixed(1)}/10
- Support: ${review.scores?.support?.toFixed(1)}/10
- Billing: ${review.scores?.billing?.toFixed(1)}/10
- Verdict: ${review.verdict}

### Method disclosure

${review.testingDisclosure}

### Sources

${sources}

### Full review

${entry?.body ?? ""}`;
  }).join("\n\n---\n\n");

  const body = `# Digital Macaroni — complete review corpus

> This file contains the full text and public evidence record for every published Digital Macaroni software review.

## Method

Digital Macaroni scores onboarding, product, support, and billing. The overall score is an independent editorial judgment rather than a mechanical average. Hands-on, research-based, and legacy reviews are labeled explicitly. Source material is used as evidence; published prose is original Digital Macaroni analysis.

${reviews}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
