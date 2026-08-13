# Digital Macaroni database

Supabase stores the private editorial queue, research jobs, source records, findings, article copies, scores, citations, and version history. Published pages are still built from the reviewed MDX files in this repository.

## Release-date safety

Verified product release dates live in `private.product_release_records`. They are internal research records and are not returned by the public site, feeds, JSON-LD, or Supabase's public API.

The `private.enforce_article_release_date` trigger blocks every non-legacy article when:

- no verified release-date record exists; or
- the proposed publication date is earlier than the verified release date.

Products in the candidate slate have no target publication date until release research is complete.

## Migration log

- `20260813122254_niche_editorial_slate.sql`: archives Notion, adds 50 niche candidates, creates internal release evidence, and adds the release-date publication guard.
- `20260813122717_harden_release_guard.sql`: runs the guard with controlled access to the private evidence table without exposing the table publicly.
