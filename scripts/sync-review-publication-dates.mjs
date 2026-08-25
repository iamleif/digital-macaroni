import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const reviews = fs
  .readdirSync(reviewDirectory)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => {
    const slug = file.slice(0, -4);
    const { data } = matter(fs.readFileSync(path.join(reviewDirectory, file), "utf8"));
    return { slug, date: data.date, publishAt: data.publishAt };
  });

const values = reviews
  .map((review) => `(${quote(review.slug)}, ${quote(review.date)}::date, ${quote(review.publishAt)}::timestamptz)`)
  .join(",\n");
const schedule = `schedule(slug, published_on, publish_at) as (values\n${values}\n)`;
const sql = `
with ${schedule}
update public.products p
set target_publish_date=s.published_on
from schedule s
where p.slug=s.slug;

with ${schedule}
update public.articles a
set published_on=s.published_on, publish_at=s.publish_at, updated_on=null
from public.products p, schedule s
where a.product_id=p.id and p.slug=s.slug;

with ${schedule}
update public.research_jobs j
set scheduled_for=s.published_on
from public.products p, schedule s
where j.product_id=p.id and p.slug=s.slug;
`;

execFileSync("supabase", ["db", "query", "--linked", sql], { stdio: "inherit" });

const result = JSON.parse(execFileSync("supabase", [
  "db", "query", "--linked", "--output", "json",
  `select p.slug, p.target_publish_date, a.published_on, a.updated_on, a.publish_at,
          (select count(*) from public.research_jobs j where j.product_id=p.id and j.scheduled_for=a.published_on) as matching_job_dates
   from public.products p join public.articles a on a.product_id=p.id
   where p.slug in (${reviews.map((review) => quote(review.slug)).join(",")});`,
], { encoding: "utf8" }));
const remoteBySlug = new Map((result.rows ?? []).map((row) => [row.slug, row]));
const failures = [];

for (const review of reviews) {
  const row = remoteBySlug.get(review.slug);
  if (!row) { failures.push(`${review.slug}: missing remotely`); continue; }
  if (String(row.target_publish_date).slice(0, 10) !== review.date) failures.push(`${review.slug}: product date mismatch`);
  if (String(row.published_on).slice(0, 10) !== review.date) failures.push(`${review.slug}: article date mismatch`);
  if (row.updated_on !== null) failures.push(`${review.slug}: updated date is not empty`);
  if (String(row.publish_at).slice(0, 10) !== review.date) failures.push(`${review.slug}: publish time mismatch`);
  if (Number(row.matching_job_dates) < 1) failures.push(`${review.slug}: research job date mismatch`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Synced and verified publication dates for ${reviews.length} reviews.`);
import "./lib/legacy-publisher-disabled.mjs";
