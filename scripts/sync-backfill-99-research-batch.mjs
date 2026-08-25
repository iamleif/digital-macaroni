import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const batch = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "batch.json"), "utf8"));
const quote = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;

const statements = batch.products.map((item) => `
insert into public.products (
  category_id, slug, name, website_url, discovered_from, pipeline_status,
  target_publish_date, is_public
)
select c.id, ${quote(item.slug)}, ${quote(item.product)}, ${quote(item.productUrl)},
       ${quote(item.discoveredFrom)}, 'researching', null, false
from public.categories c
where c.name=${quote(item.category)}
on conflict (slug) do update set
  category_id=excluded.category_id,
  name=excluded.name,
  website_url=excluded.website_url,
  discovered_from=excluded.discovered_from,
  pipeline_status=case when public.products.pipeline_status='published' then 'published' else 'researching' end,
  target_publish_date=case when public.products.pipeline_status='published' then public.products.target_publish_date else null end;

insert into public.research_jobs (
  product_id, status, review_type, priority, scheduled_for, config
)
select p.id, 'queued', 'research-based', ${Number(item.slot <= 18 ? 1 : 2)}, null,
       ${json({
         batch: "backfill-99",
         slot: item.slot,
         plannedDate: item.plannedDate,
         releaseDateRequired: true,
         minimumTotalSources: batch.policy.minimumTotalSources,
         minimumIndependentPlatforms: batch.policy.minimumIndependentPlatforms,
         minimumCommunitySources: batch.policy.minimumCommunitySources,
         minimumVoiceSamples: batch.policy.minimumVoiceSamples,
         draftingLocked: true,
       })}
from public.products p
where p.slug=${quote(item.slug)}
  and not exists (
    select 1 from public.research_jobs j
    where j.product_id=p.id and j.status in ('queued', 'running', 'blocked', 'needs_review')
  );

update public.research_jobs j
set config=j.config || ${json({
  batch: "backfill-99",
  plannedDate: item.plannedDate,
  releaseDateRequired: true,
  draftingLocked: true,
})},
    priority=${Number(item.slot <= 18 ? 1 : 2)},
    scheduled_for=null
from public.products p
where j.product_id=p.id
  and p.slug=${quote(item.slug)}
  and j.status in ('queued', 'running', 'blocked', 'needs_review');
`).join("\n");

const verification = `
${statements}

select jsonb_build_object(
  'product_count', count(*),
  'active_job_count', count(*) filter (where j.status in ('queued','running','blocked','needs_review')),
  'scheduled_before_release_verification', count(*) filter (where j.scheduled_for is not null),
  'public_product_count', count(*) filter (where p.is_public)
) as result
from public.products p
join public.research_jobs j on j.product_id=p.id
where j.config->>'batch'='backfill-99';
`;

const output = execFileSync(
  "supabase",
  ["db", "query", "--linked", "--output", "json", verification],
  { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

console.log(output.trim());
