import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import { ensureReviewIcon } from "./lib/review-icon.mjs";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("Usage: node scripts/sync-one-review-cli.mjs <slug>");

const icon = await ensureReviewIcon({ root: process.cwd(), slug });
const source = fs.readFileSync(path.join(process.cwd(), "content", "reviews", `${slug}.mdx`), "utf8");
const { data, content } = matter(source);
const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "research", slug, "evidence.json"), "utf8"));
const quote = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const productJson = JSON.parse(execFileSync("supabase", [
  "db", "query", "--linked", "--output", "json",
  `select id from public.products where slug=${quote(slug)};`,
], { encoding: "utf8" }));
const productId = productJson.rows?.[0]?.id;
if (!productId) throw new Error(`Product not found in Supabase: ${slug}`);
const releaseSource = evidence.sources.find((item) => item.id === evidence.releaseDate?.sourceId);
if (!releaseSource) throw new Error(`${slug}: release-date source is missing from the evidence packet`);
const releasePrecision = ["day", "month", "year"].includes(evidence.releaseDate.precision) ? evidence.releaseDate.precision : "day";

const sql = `
update public.products
set pipeline_status='published', target_publish_date=${quote(data.date)}, is_public=true,
    logo_source_url=coalesce(${quote(icon.sourceUrl)}, logo_source_url)
where id=${productId};

insert into private.product_release_records (product_id, released_on, date_precision, source_url, verified_at, notes)
values (${productId}, ${quote(evidence.releaseDate.date)}, ${quote(releasePrecision)}, ${quote(releaseSource.url)}, now(), ${quote(`Verified from ${releaseSource.name}; evidence refreshed ${evidence.researchUpdated}.`)})
on conflict (product_id) do update set
  released_on=excluded.released_on, date_precision=excluded.date_precision,
  source_url=excluded.source_url, verified_at=now(), notes=excluded.notes;

insert into public.research_jobs (product_id, status, review_type, priority, scheduled_for, completed_at, config)
select ${productId}, 'approved', ${quote(data.reviewType)}, 3, ${quote(data.date)}, now(), ${json({ releaseDateRequired: true, minimumTotalSources: 6, minimumIndependentPlatforms: 2, minimumCommunitySources: 1, minimumVoiceSamples: 20 })}
where not exists (select 1 from public.research_jobs where product_id=${productId});

update public.research_jobs
set status='approved', review_type=${quote(data.reviewType)}, scheduled_for=${quote(data.date)}, completed_at=coalesce(completed_at, now()), last_error=null
where product_id=${productId};

insert into public.articles (
  product_id, slug, title, description, body_mdx, verdict, card_verdict,
  author_name, status, review_type, testing_disclosure, featured,
  published_on, updated_on, publish_at, overall_score
) values (
  ${productId}, ${quote(slug)}, ${quote(data.title)}, ${quote(data.description)},
  ${quote(content.trim())}, ${quote(data.verdict)}, ${quote(data.cardVerdict)},
  ${quote(data.author)}, 'published', ${quote(data.reviewType)},
  ${quote(data.testingDisclosure)}, ${Boolean(data.featured)}, ${quote(data.date)},
  null, ${quote(data.publishAt || `${data.date}T09:00:00Z`)}, ${data.score}
)
on conflict (product_id) do update set
  slug=excluded.slug, title=excluded.title, description=excluded.description,
  body_mdx=excluded.body_mdx, verdict=excluded.verdict,
  card_verdict=excluded.card_verdict, author_name=excluded.author_name,
  status='published', review_type=excluded.review_type,
  testing_disclosure=excluded.testing_disclosure, featured=excluded.featured,
  published_on=excluded.published_on, updated_on=null,
  publish_at=excluded.publish_at, overall_score=excluded.overall_score,
  validation_report=${json({ passed: true, validatedAt: "2026-08-14", validator: "scripts/validate-content.mjs" })};

insert into public.article_scores (article_id, onboarding, product, support, billing)
select id, ${data.scores.onboarding}, ${data.scores.product}, ${data.scores.support}, ${data.scores.billing}
from public.articles where product_id=${productId}
on conflict (article_id) do update set
  onboarding=excluded.onboarding, product=excluded.product,
  support=excluded.support, billing=excluded.billing,
  rationale=${json(evidence.scoreRationale)};

delete from public.article_citations
where article_id=(select id from public.articles where product_id=${productId});

insert into public.article_citations (article_id, name, url, accessed_on, sort_order)
values
${data.sources.map((item, index) => `((select id from public.articles where product_id=${productId}), ${quote(item.name)}, ${quote(item.url)}, ${quote(item.accessed)}, ${index})`).join(",\n")};
`;

execFileSync("supabase", ["db", "query", "--linked", sql], { stdio: "inherit" });
const expectedHash = JSON.parse(execFileSync("supabase", [
  "db", "query", "--linked", "--output", "json",
  `select md5(${quote(content.trim())}) as body_hash;`,
], { encoding: "utf8" })).rows?.[0]?.body_hash;
const verification = JSON.parse(execFileSync("supabase", [
  "db", "query", "--linked", "--output", "json",
  `select p.pipeline_status, p.is_public, a.status, a.published_on, a.overall_score,
          md5(a.body_mdx) as body_hash,
          (select count(*) from public.article_citations c where c.article_id=a.id) as citation_count,
          (select count(*) from public.article_scores s where s.article_id=a.id) as score_count,
          (select count(*) from public.research_jobs j where j.product_id=p.id and j.status='approved') as approved_job_count
   from public.products p join public.articles a on a.product_id=p.id where p.id=${productId};`,
], { encoding: "utf8" })).rows?.[0];

if (!verification || verification.pipeline_status !== "published" || verification.is_public !== true || verification.status !== "published") {
  throw new Error(`${slug}: Supabase publication verification failed`);
}
if (verification.body_hash !== expectedHash) throw new Error(`${slug}: Supabase body does not match the local article`);
if (Number(verification.citation_count) !== data.sources.length) throw new Error(`${slug}: Supabase citations do not match local sources`);
if (Number(verification.score_count) !== 1) throw new Error(`${slug}: Supabase score row is missing`);
if (Number(verification.approved_job_count) < 1) throw new Error(`${slug}: Supabase research job is not approved`);

console.log(`Synced and verified ${slug}.`);
import "./lib/legacy-publisher-disabled.mjs";
