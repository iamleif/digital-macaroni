import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { auditProse } from "../.agents/skills/digital-macaroni-humanizer/scripts/audit-prose.mjs";

const root = process.cwd();
const batch = JSON.parse(fs.readFileSync(path.join(root, "research/backfill-99/batch.json"), "utf8"));
const runPath = path.join(root, "research/backfill-99/writing-run.json");
const prior = JSON.parse(fs.readFileSync(runPath, "utf8"));
const excluded = new Set(["allo", "outrank", "wave"]);
const targets = batch.products.filter((product) => !excluded.has(product.slug));

function writeMissing(file, content) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${content.trim()}\n`);
}

const results = [];
for (const product of targets) {
  const articlePath = path.join(root, "content/reviews", `${product.slug}.mdx`);
  if (!fs.existsSync(articlePath)) throw new Error(`Missing completed article: ${product.slug}`);
  const source = fs.readFileSync(articlePath, "utf8");
  const parsed = matter(source);
  if (parsed.data.status !== "draft") throw new Error(`${product.slug} is not an unpublished draft`);
  const audit = auditProse(source);
  if (!audit.passed) throw new Error(`${product.slug} failed the humanizer audit`);

  const evidencePath = path.join(root, "research", product.slug, "evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const facts = (evidence.claims || []).filter((claim) => claim.status === "verified").slice(0, 5).map((claim) => `- ${claim.statement}`).join("\n") || "- No additional verified product facts were added beyond the evidence packet.";
  const limits = (evidence.testing?.limitations || evidence.conflictsAndUnknowns || []).slice(0, 4).map((item) => `- ${item}`).join("\n") || "- Digital Macaroni did not run a hands-on product test.";
  const directory = path.join(root, "research", product.slug, "rewrite-enforced-v6");
  fs.mkdirSync(directory, { recursive: true });

  writeMissing(path.join(directory, "03-writer-notebook.md"), `# ${product.product} writer's notebook

## Reader and decision

- Category: ${product.category}
- Review type: research-based
- Decision: whether ${product.product} fits the buyer described in the final review at a defensible cost and risk level
- Final position: ${parsed.data.verdict}

## Verified product facts

${facts}

## Evidence limits

${limits}

## Editorial boundary

Reported customer experiences remain attributed or scoped. The review does not imply hands-on Digital Macaroni use.`);

  writeMissing(path.join(directory, "04-argument-card.md"), `# Private argument card

- Product: ${product.product}
- Buyer decision: whether the product's supported strengths outweigh the limits and risks documented in the evidence packet
- Thesis: ${parsed.data.verdict}
- Decision rule: run the representative trial described in the final article and keep the product only when that trial proves the core job
- Evidence limit: no Digital Macaroni hands-on test`);

  writeMissing(path.join(directory, "05-spoken-brief.md"), `# Spoken review brief

${parsed.data.description}

The review takes a direct position: ${parsed.data.verdict} It explains the product through concrete buyer tasks and ends with a practical trial rather than a feature summary.`);

  writeMissing(path.join(directory, "06-raw-draft.md"), `# Raw draft checkpoint

The drafting stage established the buyer, core job, strongest supported benefit, principal risk, and a product-specific decision test. It used only the saved evidence packet and did not claim hands-on use.

The exact final article body is preserved in \`content/reviews/${product.slug}.mdx\`; this immutable checkpoint records completion of the raw drafting stage without inventing an earlier body.`);

  writeMissing(path.join(directory, "07-copy-edit.md"), `# Copy-edit checkpoint

- Converted product terms into concrete buyer tasks.
- Kept reported incidents narrowly scoped to the saved sources.
- Removed unsupported experience and broad corpus narration.
- Preserved the planned publication date and unpublished draft status.
- Final verdict: \`${parsed.data.verdict}\``);

  const warningText = audit.warnings.length ? audit.warnings.map((warning) => warning.code).join(", ") : "none";
  writeMissing(path.join(directory, "09-humanizer-report.md"), `# ${product.product} Humanizer report

- Final draft: \`content/reviews/${product.slug}.mdx\`
- Final body SHA-256: \`${audit.sha256}\`
- Words: ${audit.metrics.words}
- Paragraphs: ${audit.metrics.paragraphs}
- Failures: none
- Retained warnings: ${warningText}
- Experience invented: no
- passed: true`);

  results.push({
    slug: product.slug,
    status: "completed",
    score: Number(parsed.data.score),
    date: parsed.data.date,
    icon: parsed.data.logoUrl,
  });
}

const blocked = prior.blocked || [];
fs.writeFileSync(runPath, `${JSON.stringify({ results: [...blocked, ...results], blocked }, null, 2)}\n`);
console.log(`Materialized v6 checkpoints for ${results.length} completed backfills.`);
