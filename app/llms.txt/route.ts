export const dynamic = "force-static";

const baseUrl = "https://digitalmacaroni.io";

export function GET() {
  const body = `# Digital Macaroni

> Independent software reviews with clear opinions, documented methods, and simple scores.

Digital Macaroni reviews the complete software experience: onboarding, the product itself, support, and billing. Each published review has a visible testing or research disclosure.

## Main sections

- [Homepage](${baseUrl})
- [All reviews](${baseUrl}/reviews)
- [How scoring works](${baseUrl}/how-it-works)
- [Submit your software](${baseUrl}/submit)
- [About](${baseUrl}/about)
- [RSS feed](${baseUrl}/feed.xml)
- [JSON feed](${baseUrl}/feed.json)
- [Full review corpus](${baseUrl}/llms-full.txt)
- [Verified AI information](${baseUrl}/llm-info)

## Editorial information

- Author: Leif Johansen
- Publisher: Digital Macaroni
- Contact: hello@digitalmacaroni.io
- Scores are independent editorial judgments, not mechanical averages.
- Research-based and hands-on reviews are labeled separately.
- Review sources and access dates are shown on every published review.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
