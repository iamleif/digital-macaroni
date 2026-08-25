import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const batch = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "batch.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "qualification-audit.json"), "utf8"));
const quote = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const plannedBySlug = new Map(batch.products.map((item) => [item.slug, item]));
const errors = [];

for (const item of audit.products) {
  const planned = plannedBySlug.get(item.slug);
  if (!planned) errors.push(`${item.slug}: missing from batch`);
  if (!item.release?.date || !item.release?.sourceUrl) errors.push(`${item.slug}: missing release evidence`);
  if (planned && item.release?.date >= planned.plannedDate) errors.push(`${item.slug}: release date does not predate planned publication`);
  if ((item.platforms?.length ?? 0) < audit.rules.minimumIndependentPlatforms) errors.push(`${item.slug}: fewer than two independent platforms`);
  const knownVoices = (item.platforms ?? []).reduce((sum, source) => sum + (source.voices ?? 0), 0) + (item.communityVoicesObserved ?? 0);
  if (knownVoices < audit.rules.minimumVoiceSamples) errors.push(`${item.slug}: fewer than 20 observed voices`);
  if (!item.communityUrl) errors.push(`${item.slug}: missing community source`);
}

if (audit.products.length !== batch.products.length) errors.push(`audit contains ${audit.products.length} products; expected ${batch.products.length}`);
if (errors.length) throw new Error(errors.join("\n"));

const statements = audit.products.map((item) => {
  const planned = plannedBySlug.get(item.slug);
  const sources = [
    { platform: "official", type: "official", url: planned.productUrl, title: `${planned.product} official website`, metadata: { purpose: "active-product-check" } },
    { platform: "release-record", type: "launch-history", url: item.release.sourceUrl, title: `${planned.product} launch history`, metadata: { releasedOn: item.release.date, precision: item.release.precision } },
    ...item.platforms.map((source) => ({ platform: source.name.toLowerCase().replaceAll(" ", "-"), type: "independent-review-platform", url: source.url, title: `${planned.product} reviews on ${source.name}`, metadata: { observedVoices: source.voices } })),
    { platform: "reddit", type: "community", url: item.communityUrl, title: `${planned.product} community discovery`, metadata: { observedVoices: item.communityVoicesObserved ?? null, requiresThreadExtraction: true } },
  ];

  const sourceSql = sources.map((source) => `
insert into public.research_sources (product_id, platform, source_type, url, title, metadata)
select p.id, ${quote(source.platform)}, ${quote(source.type)}, ${quote(source.url)}, ${quote(source.title)},
       ${json({ batch: "backfill-99", stage: "qualification", ...source.metadata })}
from public.products p where p.slug=${quote(item.slug)}
on conflict (product_id, url) do update set accessed_at=now(), metadata=public.research_sources.metadata || excluded.metadata;`).join("\n");

  return `
insert into private.product_release_records (product_id, released_on, date_precision, source_url, verified_at, notes)
select p.id, ${quote(item.release.date)}::date, ${quote(item.release.precision)}, ${quote(item.release.sourceUrl)}, now(),
       ${quote(`Verified for backfill-99. Planned publication ${planned.plannedDate}; drafting remains locked pending full evidence extraction.`)}
from public.products p where p.slug=${quote(item.slug)}
on conflict (product_id) do update set released_on=excluded.released_on, date_precision=excluded.date_precision,
  source_url=excluded.source_url, verified_at=now(), notes=excluded.notes;
${sourceSql}
update public.research_jobs j
set config=j.config || ${json({ qualificationAudit: "passed", releaseVerified: true, sourceFootprintQualified: true, fullEvidenceApproved: false, draftingLocked: true })},
    last_error=null
from public.products p
where j.product_id=p.id and p.slug=${quote(item.slug)} and j.config->>'batch'='backfill-99';`;
}).join("\n");

const verification = `
begin;
${statements}
commit;
select jsonb_build_object(
  'products', count(*),
  'release_records', count(*) filter (where release_verified),
  'qualified_jobs', count(*) filter (where j.config->>'qualificationAudit'='passed'),
  'drafting_locked', count(*) filter (where j.config->>'draftingLocked'='true'),
  'public_products', count(*) filter (where p.is_public),
  'scheduled_jobs', count(*) filter (where j.scheduled_for is not null),
  'minimum_qualification_sources', min(source_count),
  'maximum_qualification_sources', max(source_count)
) as result
from (
  select p.id,
         exists(select 1 from private.product_release_records r where r.product_id=p.id and r.verified_at is not null) release_verified,
         (select count(*) from public.research_sources s where s.product_id=p.id and s.metadata->>'batch'='backfill-99') source_count
  from public.products p
  where p.slug in (${audit.products.map((item) => quote(item.slug)).join(",")})
) checked
join public.products p on p.id=checked.id
join public.research_jobs j on j.product_id=p.id and j.config->>'batch'='backfill-99';`;

const output = execFileSync("supabase", ["db", "query", "--linked", "--output", "json", verification], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 30 * 1024 * 1024,
});

console.log(output.trim());
