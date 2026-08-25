import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const slug = process.argv[2];
const model = process.env.DEEPINFRA_MODEL || "deepseek-ai/DeepSeek-R1";
const apiKey = process.env.DEEPINFRA_API_KEY;

if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Usage: npm run draft:review -- <slug>");
  process.exit(1);
}

if (!apiKey) {
  console.error("Missing DEEPINFRA_API_KEY. Add it to .env.local; never commit that file.");
  process.exit(1);
}

const evidencePath = path.join(root, "research", slug, "evidence.json");
const briefPath = path.join(root, "research", "ARTICLE_BRIEF.md");
const queuePath = path.join(root, "research", "queue.json");

for (const requiredPath of [evidencePath, briefPath, queuePath]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`Required drafting input is missing: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const queueItem = queue.find((item) => item.slug === slug);
const brief = fs.readFileSync(briefPath, "utf8");

if (!queueItem) {
  console.error(`${slug} is not in research/queue.json.`);
  process.exit(1);
}
if (evidence.productSlug !== slug) {
  console.error("Evidence productSlug does not match the requested slug.");
  process.exit(1);
}
if (!Array.isArray(evidence.sources) || evidence.sources.length < 6) {
  console.error("Drafting is blocked until the evidence packet has at least six sources.");
  process.exit(1);
}
if (!Array.isArray(evidence.claims) || evidence.claims.length < 3) {
  console.error("Drafting is blocked until the evidence packet has at least three documented claims.");
  process.exit(1);
}
if (!evidence.releaseDate?.date || !evidence.releaseDate?.sourceId) {
  console.error("Drafting is blocked until the evidence packet has a verified release date.");
  process.exit(1);
}

const systemPrompt = `You are the first-draft writer for Digital Macaroni, an independent software review publication. Think privately, but return only the finished Markdown article body. Never output <think>, analysis, notes, a plan, frontmatter, a source list, or citations.

Write only from the supplied evidence packet and editorial brief. A claim not in the packet does not belong in the article. Do not infer current pricing, missing features, performance, product behavior, or user outcomes. Do not claim hands-on use unless evidence.testing.accessedProduct is true. Never copy source wording. If evidence is uncertain, state the uncertainty plainly.

This is Digital Macaroni's verdict, not a summary of the research corpus. Treat the evidence as material you have already digested. Assert the publication's conclusions in its own voice. Prefer "Lodgify's channel sync is the main risk" over "reports describe sync failures." Do not narrate sample sizes, source agreement, or the act of researching. Avoid aggregation phrases such as "reviews show", "reviews praise", "the evidence shows", "users report", "sources describe", "reports from", and "the complaints are not dominant". Use a narrow qualifier only when needed to keep a reported pattern from becoming a universal fact. The publication's judgment must drive every section, not just the verdict.

This is a review, not a product summary. Open with a direct thesis. Name the evidence conflict that decides the verdict. Explain why it changes the buyer's decision. Every paragraph must state a judgment, explain its buyer impact, or make the recommendation more specific. Do not use generic experience language such as "should feel", "likely to feel", "can be a good fit", or generic product-use instructions. Keep method disclosure out of the article body unless an evidence limit changes the recommendation. Do not use em dashes or en dashes.`;

const userPrompt = `Write a 700 to 1,000 word first draft for ${queueItem.product}, a ${queueItem.category} product. Follow this editorial brief exactly:\n\n${brief}\n\nEvidence packet (the release date is private and must never appear in the article):\n\n${JSON.stringify(evidence, null, 2)}`;

const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.45,
    max_tokens: 4_000,
    reasoning_effort: "high",
  }),
});

const payload = await response.json().catch(() => null);
if (!response.ok) {
  const detail = payload?.error?.message || payload?.detail || response.statusText;
  console.error(`DeepInfra request failed (${response.status}): ${detail}`);
  process.exit(1);
}

const draft = payload?.choices?.[0]?.message?.content
  ?.replace(/<think>[\s\S]*?<\/think>\s*/i, "")
  .trim();
if (!draft) {
  console.error("DeepInfra returned no draft text.");
  process.exit(1);
}

const draftDirectory = path.join(root, "research", slug, "drafts");
fs.mkdirSync(draftDirectory, { recursive: true });
const createdAt = new Date().toISOString();
const filename = `${createdAt.replace(/[:.]/g, "-")}-deepinfra.md`;
const outputPath = path.join(draftDirectory, filename);
const header = `<!--\nDraft only. Generated by ${model} through DeepInfra on ${createdAt}.\nUse as an editorial starting point. Verify every claim against research/${slug}/evidence.json before moving text into content/reviews/${slug}.mdx.\n-->\n\n`;
fs.writeFileSync(outputPath, `${header}${draft}\n`);

const usage = payload.usage;
console.log(`First draft saved to ${path.relative(root, outputPath)}.`);
if (usage) console.log(`Usage: ${usage.prompt_tokens ?? "?"} prompt tokens, ${usage.completion_tokens ?? "?"} completion tokens.`);
