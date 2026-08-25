import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import matter from "gray-matter";

const root = process.cwd();
const queue = JSON.parse(fs.readFileSync(path.join(root, "research", "queue.json"), "utf8"));
const reviews = queue.map((item) => {
  const reviewPath = path.join(root, "content", "reviews", `${item.slug}.mdx`);
  const { data, content } = matter(fs.readFileSync(reviewPath, "utf8"));
  if (data.status !== "published" || item.status !== "published") throw new Error(`${item.slug}: not published locally`);
  if (!data.logoUrl) throw new Error(`${item.slug}: logoUrl is missing`);
  const iconPath = path.join(root, "public", data.logoUrl.replace(/^\//, ""));
  if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size < 64) throw new Error(`${item.slug}: local icon is missing or empty`);
  return { slug: item.slug, data, content: content.trim() };
});

const quotedSlugs = reviews.map((item) => `'${item.slug.replaceAll("'", "''")}'`).join(",");
const query = `
select p.slug, p.pipeline_status, p.is_public, p.logo_source_url,
       a.status as article_status, a.published_on, a.updated_on, a.overall_score,
       a.verdict, a.card_verdict,
       md5(a.body_mdx) as body_hash,
       (select count(*) from public.article_scores s where s.article_id=a.id) as score_count,
       (select count(*) from public.article_citations c where c.article_id=a.id) as citation_count,
       (select count(*) from public.research_jobs j where j.product_id=p.id and j.status='approved') as approved_job_count,
       (select count(*) from private.product_release_records r where r.product_id=p.id and r.verified_at is not null) as release_count
from public.products p
left join public.articles a on a.product_id=p.id
where p.slug in (${quotedSlugs})
order by p.slug;`;

const result = JSON.parse(execFileSync("supabase", ["db", "query", "--linked", "--output", "json", query], { encoding: "utf8" }));
const remoteBySlug = new Map((result.rows ?? []).map((row) => [row.slug, row]));
const failures = [];

for (const review of reviews) {
  const row = remoteBySlug.get(review.slug);
  if (!row) { failures.push(`${review.slug}: missing product/article result`); continue; }
  const localHash = createHash("md5").update(review.content).digest("hex");
  if (row.pipeline_status !== "published" || row.is_public !== true || row.article_status !== "published") failures.push(`${review.slug}: remote publication status mismatch`);
  if (row.body_hash !== localHash) failures.push(`${review.slug}: remote body mismatch`);
  if (row.verdict !== review.data.verdict || row.card_verdict !== review.data.cardVerdict) failures.push(`${review.slug}: remote headline mismatch`);
  if (String(row.published_on).slice(0, 10) !== review.data.date) failures.push(`${review.slug}: remote publication date mismatch`);
  if (row.updated_on !== null) failures.push(`${review.slug}: remote updated date must be empty`);
  if (Number(row.overall_score) !== Number(review.data.score)) failures.push(`${review.slug}: remote score mismatch`);
  if (Number(row.score_count) !== 1) failures.push(`${review.slug}: score row missing`);
  if (Number(row.citation_count) !== review.data.sources.length) failures.push(`${review.slug}: citation count mismatch`);
  if (Number(row.approved_job_count) < 1) failures.push(`${review.slug}: approved research job missing`);
  if (Number(row.release_count) !== 1) failures.push(`${review.slug}: verified release record missing`);
  if (!row.logo_source_url) failures.push(`${review.slug}: remote logo source missing`);
}

if (remoteBySlug.size !== reviews.length) failures.push(`Remote result contains ${remoteBySlug.size} of ${reviews.length} products`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified ${reviews.length} published reviews, headlines, article bodies, scores, citations, research jobs, release dates, and icons.`);
