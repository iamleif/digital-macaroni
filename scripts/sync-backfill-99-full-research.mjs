import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const batch = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "batch.json"), "utf8"));
const quote = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;

const statements = [];
for (const product of batch.products) {
  const evidence = JSON.parse(fs.readFileSync(path.join(root, "research", product.slug, "evidence.json"), "utf8"));
  statements.push(`delete from public.research_findings where product_id=(select id from public.products where slug=${quote(product.slug)});`);
  for (const source of evidence.sources) {
    const platform = source.name.match(/ on ([^/]+)$/i)?.[1]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      || (source.sourceType === "community" ? "community" : source.id);
    const sourceType = source.sourceType === "official" && source.id === evidence.releaseDate.sourceId ? "launch-history" : source.sourceType;
    statements.push(`
insert into public.research_sources (product_id, platform, source_type, url, title, summary, metadata, accessed_at)
select p.id, ${quote(platform)}, ${quote(sourceType)}, ${quote(source.url)}, ${quote(source.name)},
       ${quote((source.keyThemes || []).join("; "))},
       ${json({ batch: "backfill-99", stage: "full-evidence", voiceSamples: source.reviewCountSampled, keyThemes: source.keyThemes || [] })}, now()
from public.products p where p.slug=${quote(product.slug)}
on conflict (product_id,url) do update set platform=excluded.platform, source_type=excluded.source_type,
 title=excluded.title, summary=excluded.summary, metadata=public.research_sources.metadata || excluded.metadata, accessed_at=now();`);
  }
  for (const claim of evidence.claims) {
    const findingType = claim.kind === "fact" ? "fact" : (/support|refund|fail|problem|issue|slow|bug|limit|complaint|price|cost/i.test(claim.statement) ? "complaint" : "praise");
    statements.push(`
with inserted as (
  insert into public.research_findings (product_id,finding_type,summary,prevalence,confidence)
  select p.id, ${quote(findingType)}, ${quote(claim.statement)}, ${quote(claim.kind === "fact" ? null : "mixed")}, ${claim.status === "verified" ? "0.95" : "0.78"}
  from public.products p where p.slug=${quote(product.slug)} returning id
)
insert into public.finding_sources (finding_id,source_id)
select i.id,s.id from inserted i
join public.products p on p.slug=${quote(product.slug)}
join public.research_sources s on s.product_id=p.id
where s.url in (${claim.sourceIds.map((id) => quote(evidence.sources.find((source) => source.id === id)?.url)).filter((value) => value !== "null").join(",") || "null"})
on conflict do nothing;`);
  }
  for (const conflict of evidence.conflictsAndUnknowns || []) {
    statements.push(`insert into public.research_findings (product_id,finding_type,summary,prevalence,confidence) select id,'conflict',${quote(conflict)},'mixed',0.7 from public.products where slug=${quote(product.slug)};`);
  }
  statements.push(`
update public.research_jobs j set status='needs_review', scheduled_for=${quote(product.plannedDate)}::date,
 config=j.config || ${json({ fullEvidenceApproved: true, draftingLocked: false, evidencePacket: `research/${product.slug}/evidence.json`, evidenceApprovedOn: "2026-08-15" })},
 completed_at=null, last_error=null
from public.products p where j.product_id=p.id and p.slug=${quote(product.slug)} and j.config->>'batch'='backfill-99';`);
}

const sql = `begin; ${statements.join("\n")} commit;
select jsonb_build_object(
 'products',count(*),
 'needs_review',count(*) filter(where j.status='needs_review'),
 'scheduled',count(*) filter(where j.scheduled_for is not null),
 'evidence_approved',count(*) filter(where j.config->>'fullEvidenceApproved'='true'),
 'minimum_sources',min((select count(*) from public.research_sources s where s.product_id=p.id and s.metadata->>'stage'='full-evidence')),
 'minimum_findings',min((select count(*) from public.research_findings f where f.product_id=p.id))
) result
from public.products p join public.research_jobs j on j.product_id=p.id and j.config->>'batch'='backfill-99';`;

const output = execFileSync("supabase", ["db", "query", "--linked", "--output", "json", sql], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});
console.log(output.trim());
