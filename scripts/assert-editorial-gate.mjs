import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { bodySha256, isSha256 } from "./lib/editorial-contract.mjs";

const root = process.cwd();
const remote = process.argv.includes("--remote");
const reviewDirectory = path.join(root, "content", "reviews");
const failures = [];
const published = [];

for (const file of fs.readdirSync(reviewDirectory).filter((name) => name.endsWith(".mdx")).sort()) {
  const slug = file.replace(/\.mdx$/, "");
  const parsed = matter(fs.readFileSync(path.join(reviewDirectory, file), "utf8"));
  if (parsed.data.status !== "published") continue;

  const fingerprint = bodySha256(parsed.content);
  const runId = Number(parsed.data.editorialRunId);
  const approved = parsed.data.approvedBodySha256;

  if (!Number.isSafeInteger(runId) || runId <= 0) {
    failures.push(`${slug}: published review has no editorialRunId receipt`);
  }
  if (!isSha256(approved)) {
    failures.push(`${slug}: published review has no valid approvedBodySha256 receipt`);
  } else if (approved !== fingerprint) {
    failures.push(`${slug}: local body differs from its approved fingerprint`);
  }

  published.push({ slug, runId, approved, fingerprint, date: parsed.data.date });
}

if (failures.length > 0) {
  console.error(`Editorial gate rejected ${failures.length} condition${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (remote && published.length > 0) {
  const quotedSlugs = published.map(({ slug }) => `'${slug}'`).join(", ");
  const sql = `
    select
      a.slug,
      a.body_sha256,
      a.approved_body_sha256,
      a.published_on::text as published_on,
      a.editorial_run_id,
      r.status as run_status,
      r.final_body_sha256,
      r.approved_body_sha256 as run_approved_body_sha256,
      r.validated_body_sha256,
      (select count(*) from private.editorial_artifacts ea where ea.run_id = r.id) as artifact_count,
      exists(select 1 from private.editorial_approvals ep where ep.run_id = r.id and ep.body_sha256 = a.body_sha256) as has_approval,
      exists(select 1 from private.editorial_validations ev where ev.run_id = r.id and ev.body_sha256 = a.body_sha256 and ev.passed) as has_validation
    from public.articles a
    left join private.editorial_runs r on r.id = a.editorial_run_id
    where a.slug in (${quotedSlugs}) and a.status = 'published'
    order by a.slug;
  `;
  const result = spawnSync("supabase", ["db", "query", "--linked", sql], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    console.error("Remote editorial receipt verification could not run.");
    process.exit(result.status ?? 1);
  }

  let rows;
  try {
    rows = JSON.parse(result.stdout).rows;
  } catch {
    console.error("Remote editorial receipt verification returned unreadable output.");
    process.exit(1);
  }

  const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const item of published) {
    const row = rowsBySlug.get(item.slug);
    if (!row) {
      failures.push(`${item.slug}: no published Supabase article matches the local review`);
      continue;
    }
    const hashes = [
      row.body_sha256,
      row.approved_body_sha256,
      row.final_body_sha256,
      row.run_approved_body_sha256,
      row.validated_body_sha256,
    ];
    if (row.editorial_run_id !== item.runId || hashes.some((hash) => hash !== item.fingerprint)) {
      failures.push(`${item.slug}: local, database, approval, and validation fingerprints do not all match`);
    }
    if (row.run_status !== "published" || Number(row.artifact_count) !== 10 || !row.has_approval || !row.has_validation) {
      failures.push(`${item.slug}: Supabase editorial run is incomplete`);
    }
    if (row.published_on !== item.date) {
      failures.push(`${item.slug}: Supabase publication date differs from the preserved local date`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Editorial gate rejected ${failures.length} condition${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Editorial gate passed for ${published.length} published review${published.length === 1 ? "" : "s"}${remote ? " locally and in Supabase" : " locally"}.`);
