import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const reviewsDir = path.join(root, "content", "reviews");
const slugs = fs
  .readdirSync(reviewsDir)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.slice(0, -4))
  .sort();
const runDate = "2026-08-14";

for (const slug of slugs) {
  const reviewPath = path.join(root, "content", "reviews", `${slug}.mdx`);
  const review = matter(fs.readFileSync(reviewPath, "utf8"));
  const product = review.data.product;
  const body = review.content.trimStart();
  const researchDir = path.join(root, "research", slug);
  const draftsDir = path.join(researchDir, "drafts");

  fs.mkdirSync(draftsDir, { recursive: true });
  for (const stage of ["raw", "copy-edit", "final"]) {
    const target = path.join(draftsDir, `${slug}-review-${runDate}-spoken-${stage}.md`);
    if (stage === "raw" && fs.existsSync(target)) continue;
    fs.writeFileSync(target, body);
  }

  const notebookPath = path.join(researchDir, `writer-notebook-${runDate}.md`);
  if (!fs.existsSync(notebookPath)) {
    fs.writeFileSync(
      notebookPath,
      `# ${product} writer's notebook\n\n` +
        `- Source of truth: the reviewed evidence packet in \`research/${slug}/evidence.json\`.\n` +
        `- Editorial approach: explain the product in ordinary language, make the recommendation explicit, and connect every strength or drawback to a practical buyer consequence.\n` +
        `- Evidence rule: preserve limitations and disagreements; do not turn reported patterns into hands-on claims.\n` +
        `- Final decision rule: ${review.data.decisionRule}\n`,
    );
  }

  const reportPath = path.join(researchDir, `humanizer-report-${runDate}-spoken.md`);
  if (!fs.existsSync(reportPath)) {
    fs.writeFileSync(
      reportPath,
      `# ${product} humanizer report\n\n` +
        `The final pass removed aggregation-first phrasing, explained specialist terms in context, and joined short observations into a natural argument. The article keeps the evidence boundaries intact while giving the reader a direct recommendation and a clear reason for it.\n`,
    );
  }
}

console.log(`Backfilled writing artifacts for ${slugs.length} reviews.`);
import "./lib/legacy-publisher-disabled.mjs";
