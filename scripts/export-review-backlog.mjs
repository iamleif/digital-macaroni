import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outputDirectory = path.join(root, "research", "backlog-packets");

const sql = `
select jsonb_build_object(
  'product', jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'name', p.name,
    'website_url', p.website_url,
    'short_description', p.short_description,
    'logo_source_url', p.logo_source_url,
    'logo_storage_path', p.logo_storage_path,
    'target_publish_date', p.target_publish_date,
    'category', c.name
  ),
  'job', to_jsonb(r),
  'sources', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.id)
    from public.research_sources s
    where s.product_id = p.id
  ), '[]'::jsonb),
  'findings', coalesce((
    select jsonb_agg(to_jsonb(f) || jsonb_build_object(
      'source_ids', coalesce((
        select jsonb_agg(fs.source_id order by fs.source_id)
        from public.finding_sources fs
        where fs.finding_id = f.id
      ), '[]'::jsonb)
    ) order by f.id)
    from public.research_findings f
    where f.product_id = p.id
  ), '[]'::jsonb)
) as packet
from public.research_jobs r
join public.products p on p.id = r.product_id
join public.categories c on c.id = p.category_id
where r.status = 'needs_review'
order by r.priority, r.id;
`;

const response = JSON.parse(execFileSync(
  "supabase",
  ["db", "query", "--linked", "--output", "json", sql],
  { cwd: root, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
));

fs.mkdirSync(outputDirectory, { recursive: true });

for (const row of response.rows ?? []) {
  const packet = row.packet;
  if (!packet?.product?.slug) continue;
  const target = path.join(outputDirectory, `${packet.product.slug}.json`);
  fs.writeFileSync(target, `${JSON.stringify(packet, null, 2)}\n`);
}

console.log(`Exported ${response.rows?.length ?? 0} review packets.`);
