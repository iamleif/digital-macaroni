# Digital Macaroni review system

This folder holds the work behind each review. The public article is the final output. The queue, source policy, and evidence files show how we got there.

## The workflow

1. Add a product to `queue.json` with one category from `lib/review-taxonomy.ts`.
2. Copy `_template/evidence.json` into `research/<slug>/evidence.json`.
3. Find and source the product's original public release date using the official launch history, Product Hunt, and other dated public records. Do not schedule it yet.
4. Search broadly: official pages, launch history, at least two review platforms, a relevant community such as Reddit, and additional independent reporting.
5. Record at least six sources and 20 user-review or community samples, with access dates, themes, conflicts, and factual claims.
6. Test the product when access is available. Never call a review hands-on without recorded tasks.
7. Draft the review from the evidence. Do not copy source wording.
   - To create a private first draft with DeepSeek through DeepInfra, add `DEEPINFRA_API_KEY` to `.env.local`, then run `npm run draft:review -- <slug>`. The draft is saved under `research/<slug>/drafts/`; it is never published automatically.
   - Then invoke the installed `humanizer` skill in `blunt` voice on a copy of that draft. It automatically uses `humanizer-context.md` to preserve the Digital Macaroni voice and evidence safeguards. Keep both versions for review.
8. If a defensible release date cannot be verified, mark the candidate blocked and replace it. Do not estimate.
9. Assign a date inside the editorial window only after the release date is verified. A review date can never precede the release date.
10. Run `npm run publish:review -- <slug>` to validate and publish.

## Product discovery

AppSumo is one discovery source, not the research system. Products may also come from Product Hunt, G2, Capterra, TrustRadius, GetApp, Software Advice, Trustpilot, SaaS directories, public launch lists, relevant communities, reader submissions, and direct product discovery.

Digital Macaroni focuses on smaller, newer, and overlooked software. We want useful products that readers may not already know, especially independent tools solving a narrow problem well. Large category incumbents are normally out of scope. A famous product only belongs in the queue when there is a specific, timely reason to cover it—not simply because it is popular.

Before a product enters the active queue, record why it is interesting, who it helps, and what makes it different from the established choices. A broad directory of household names is not an editorial plan.

The crawler must respect each site's robots.txt, terms, rate limits, login walls, and personal data. If a platform does not permit automated collection, use an approved API, a permitted export, or manual research.

The current Python sync worker collects permitted first-party facts and product icons. It is not yet the full independent-research worker. The next worker will use approved search or platform APIs, save each permitted source and finding in Supabase, preserve disagreements, and hand a cited evidence packet to the writer. It will not bypass login walls or scrape a site that forbids automated collection.

## Writing rules

- Aim for a sixth-grade reading level. The publisher blocks new reviews above grade 7.5.
- Keep the average sentence at 18 words or fewer.
- Use short paragraphs and familiar words.
- Explain technical terms.
- Put one clear idea in each paragraph.
- Keep card verdicts to nine words and 64 characters.
- Separate facts, reported user patterns, and Digital Macaroni opinions.
- State what we could not verify.

Legacy reviews remain visible, but the validator flags them until they receive a full evidence and reading-level refresh.
