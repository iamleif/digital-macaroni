# Digital Macaroni crawler

The crawler collects evidence. It does not publish reviews.

The first connector, `sync_official_sources.py`, reads products from Supabase, checks each official site's `robots.txt`, stores the page title and description as an official source, finds the site's real icon, uploads it to the public `product-icons` bucket, and records the crawl result.

Run one product:

```sh
python3 crawler/sync_official_sources.py --slug linear
```

Run the seeded backlog:

```sh
python3 crawler/sync_official_sources.py --limit 50 --workers 6
```

Required server-only environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Never expose the secret key in browser code or commit it to the repository.

Each review platform will get its own connector. A connector must use a permitted API, export, or crawl method; respect robots rules, terms, authentication walls, and rate limits; and store summaries and short excerpts rather than copying full customer reviews.
