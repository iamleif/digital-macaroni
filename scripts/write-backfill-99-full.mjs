import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const apiKey = process.env.DEEPINFRA_API_KEY;
const model = process.env.DIGITAL_MACARONI_WRITER_MODEL || "openai/gpt-oss-120b-Turbo";
const batch = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "batch.json"), "utf8"));
const brief = fs.readFileSync(path.join(root, "research", "ARTICLE_BRIEF.md"), "utf8");
const humanizerContext = fs.readFileSync(path.join(root, "humanizer-context.md"), "utf8");
const voiceExamples = fs.readFileSync(path.join(root, ".agents", "skills", "digital-macaroni-review-writer", "references", "voice-examples.md"), "utf8");
const controlArticle = fs.readFileSync(path.join(root, "content", "reviews", "allo.mdx"), "utf8");
const only = process.argv.find((item) => item.startsWith("--slug="))?.slice(7);
const limit = Number(process.argv.find((item) => item.startsWith("--limit="))?.slice(8) || Infinity);
const concurrency = Number(process.argv.find((item) => item.startsWith("--concurrency="))?.slice(14) || 3);
const force = process.argv.includes("--force");
const products = batch.products.filter((item) => !only || item.slug === only).slice(0, limit);

if (!apiKey) throw new Error("Missing DEEPINFRA_API_KEY.");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function modelJson(system, user, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.45,
          max_tokens: 7000,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || payload?.detail || `HTTP ${response.status}`);
      const raw = payload?.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Writer returned no JSON object");
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch (error) {
      lastError = error;
      await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

function words(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean);
}

function normalizePunctuation(value, dashReplacement = ",") {
  return String(value || "").replace(/[\u2010-\u2012]/g, "-").replace(/[\u2013\u2014]/g, dashReplacement);
}

function aggregationMatches(body) {
  return body.match(/\b(?:reviews? show|the evidence shows|sources? describe|reports? indicate|customer feedback shows|across review sites|(?:users?|customers?|reviewers?|multiple users|several users)\s+(?:report|confirm|describe|say|note|mention|praise|complain))\b/gi) || [];
}

function draftErrors(data) {
  const errors = [];
  const verdictWords = words(data.verdict).length;
  const bodyWords = words(data.finalBody).length;
  if (!data.title || !data.description) errors.push("missing title or description");
  if (data.verdict !== data.cardVerdict) errors.push("verdict and card verdict differ");
  if (verdictWords < 8 || verdictWords > 9 || data.verdict.length > 64) errors.push("verdict must be 8 or 9 words and at most 64 characters");
  if (bodyWords < 600 || bodyWords > 1200) errors.push(`body has ${bodyWords} words`);
  if ((data.finalBody.match(/^## /gm) || []).length < 3) errors.push("fewer than three useful sections");
  if (/[‐‑‒–—]/.test(`${data.title}\n${data.description}\n${data.verdict}\n${data.finalBody}`)) errors.push("contains a Unicode dash");
  if (aggregationMatches(data.finalBody).length) errors.push("contains aggregation-led prose");
  if (/\b(?:the case is weaker|earns its place|value proposition|buyer fit|operational complexity|the part we trust least|becomes more compelling|limits our recommendation|most suitable|potential mismatches|enterprise-grade|advisable)\b/i.test(data.finalBody)) errors.push("contains analyst or marketing language");
  if (/^## (?:Overview|Core capabilities|Who might benefit|Recommendation(?: and decision rule)?|Decision rule|What using .+ feels like)\s*$/gim.test(data.finalBody)) errors.push("contains a generic section heading");
  if (/^\s*[-*+]\s+/gm.test(data.finalBody)) errors.push("contains a bullet list");
  if (/\*\*Decision rule:?\*\*/i.test(data.finalBody)) errors.push("contains a labeled decision rule");
  if (/\b(?:we tested|we used|our testing|in our test)\b/i.test(data.finalBody)) errors.push("implies hands-on testing");
  if (!/\b(?:we recommend|we would choose|we would skip|we would not choose|skip it|worth trying|worth paying|do not recommend)\b/i.test(data.finalBody)) errors.push("no direct recommendation");
  for (const key of ["onboarding", "product", "support", "billing"]) {
    const score = Number(data.scores?.[key]);
    if (!Number.isFinite(score) || score < 0 || score > 10) errors.push(`invalid ${key} score`);
  }
  return errors;
}

function schemaCategory(category) {
  if (category === "Developer tools") return "DeveloperApplication";
  if (category === "Design & creative") return "DesignApplication";
  if (category === "Accounting & finance") return "FinanceApplication";
  return "BusinessApplication";
}

async function fetchBuffer(url, timeout = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { buffer: Buffer.from(await response.arrayBuffer()), type: response.headers.get("content-type") || "", finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

async function saveIcon(product) {
  const directory = path.join(root, "public", "product-icons");
  fs.mkdirSync(directory, { recursive: true });
  const existing = fs.readdirSync(directory).find((name) => name.replace(/\.[^.]+$/, "") === product.slug);
  if (existing && !force) return `/product-icons/${existing}`;
  let iconUrl;
  try {
    const page = await fetch(product.productUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await page.text();
    const match = html.match(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i);
    if (match) iconUrl = new URL(match[1], page.url).href;
  } catch {}
  if (!iconUrl) iconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(product.productUrl).hostname)}&sz=128`;
  let file;
  try {
    file = await fetchBuffer(iconUrl);
  } catch {
    file = await fetchBuffer(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(product.productUrl).hostname)}&sz=128`);
  }
  const extension = file.type.includes("svg") ? "svg" : file.type.includes("webp") ? "webp" : file.type.includes("jpeg") ? "jpg" : file.type.includes("png") ? "png" : "ico";
  const output = path.join(directory, `${product.slug}.${extension}`);
  fs.writeFileSync(output, file.buffer);
  return `/product-icons/${product.slug}.${extension}`;
}

async function writeProduct(product, index) {
  const articlePath = path.join(root, "content", "reviews", `${product.slug}.mdx`);
  if (!force && fs.existsSync(articlePath)) {
    console.log(`[${index + 1}/${products.length}] ${product.product}: existing article retained`);
    return { slug: product.slug, status: "existing" };
  }
  const evidence = JSON.parse(fs.readFileSync(path.join(root, "research", product.slug, "evidence.json"), "utf8"));
  const evidenceText = JSON.stringify(evidence);
  console.log(`[${index + 1}/${products.length}] ${product.product}: writer notebook and raw draft`);
  const first = await modelJson(
    "You are the Digital Macaroni editorial reviewer. Write a plainspoken software review from supplied evidence. Never invent use or facts. Return strict JSON only.",
    `Create the complete writing package for ${product.product}. Follow the editorial brief and voice sample.

The article must sound like a person explaining software to a friend. Explain unfamiliar terms through what actually happens. State who needs each major feature and when it will not matter. Take a firm position. Use concrete customer incidents only when the evidence includes them. Do not narrate the research corpus. Never write phrases such as reviews show, the evidence shows, users report, several users confirm, multiple users say, sources describe, or across review sites. If one account matters, attribute it narrowly, such as "One App Store reviewer..." Do not use analyst language, marketing copy, fake drama, any Unicode dash, forced lists of three, bullet lists, or the pattern not X but Y. Do not use words such as workflow, platform, value proposition, most suitable, potential mismatch, enterprise-grade, or advisable. Do not claim hands-on use. Keep the body between 750 and 1100 words. Start with two or three plain paragraphs that answer what the product does, who it is for, and our judgment. Do not add an Overview heading. Use three to six product-specific H2 headings that make a judgment, never generic headings such as Core capabilities, Who might benefit, Recommendation, Decision rule, or What using X feels like. End with a practical decision rule written as ordinary prose, not a label.

The verdict and cardVerdict must be identical, eight or nine words, and no more than 64 characters. The title should be a normal search title such as Product review: direct question or judgment. Scores must be defensible from the evidence.

Return JSON:
{
 "writerNotebookMarkdown":"...",
 "argumentCardMarkdown":"...",
 "spokenBriefMarkdown":"...",
 "title":"...",
 "description":"...",
 "verdict":"...",
 "cardVerdict":"...",
 "scores":{"onboarding":0,"product":0,"support":0,"billing":0},
 "rawBody":"Markdown article body"
}

EDITORIAL BRIEF:\n${brief.slice(0, 14000)}

VOICE RULES:\n${voiceExamples.slice(0, 8000)}

FULL CONTROL ARTICLE:\n${controlArticle.slice(controlArticle.indexOf("---", 3) + 3, 14000)}

EVIDENCE:\n${evidenceText.slice(0, 50000)}`
  );

  console.log(`[${index + 1}/${products.length}] ${product.product}: copy edit and Humanizer`);
  const second = await modelJson(
    "You are the restrained Humanizer and final copy editor for Digital Macaroni. Preserve factual scope. Return strict JSON only.",
    `Edit this research-based review so it sounds connected, specific, and naturally spoken. Do not add slang, metaphors, fake memories, personal experience, features, prices, or customer stories. Keep reported patterns scoped honestly without putting source aggregation in the narrator's seat. Improve transitions so paragraphs build on one another. Remove robotic repetition, clipped verdict stacks, filler, marketing adjectives, analyst phrases, corpus narration, generic headings, bullet lists, uniform sentence patterns, every Unicode dash, forced groups of three, and the pattern not X but Y. Avoid the words workflow, platform, value proposition, most suitable, potential mismatch, enterprise-grade, and advisable. Keep 750 to 1100 words and three to six product-specific H2 headings that state a useful judgment. Keep the recommendation firm, and write the decision rule naturally without labeling it.

Return JSON:
{"finalBody":"final Markdown body","humanizerReportMarkdown":"short report listing the meaningful AI-pattern clusters removed and confirming that no facts were added"}

BRAND CONTEXT:\n${humanizerContext}

EVIDENCE:\n${evidenceText.slice(0, 42000)}

RAW DRAFT:\n${first.rawBody}`
  );

  const output = { ...first, finalBody: second.finalBody, humanizerReportMarkdown: second.humanizerReportMarkdown };
  output.title = normalizePunctuation(output.title, ":");
  output.description = normalizePunctuation(output.description);
  output.verdict = normalizePunctuation(output.verdict);
  output.cardVerdict = output.verdict;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const errors = draftErrors(output);
    if (errors.length === 0) break;
    console.log(`[${index + 1}/${products.length}] ${product.product}: correction ${attempt} (${errors.join("; ")})`);
    const correction = await modelJson(
      "You are the final Digital Macaroni copy editor. Return strict JSON only and do not add unsupported facts.",
      `Correct every listed publication failure while preserving the article's facts, natural voice, recommendation, and useful detail. You may revise the title, description, verdict, headings, and body. Remove every phrase that narrates reviews, evidence, users, sources, reports, or feedback as a group. State Digital Macaroni's conclusion directly while keeping any necessary scope qualifier. Use no Unicode dashes, bullet lists, generic headings, labeled decision rule, analyst language, or marketing language. Write 750 to 950 words in connected paragraphs under exactly four product-specific H2 headings. If the draft is short, expand by explaining supported features in ordinary language, who they help, where the practical limit appears, and why that changes the recommendation. Do not pad with repetition. The final two paragraphs must include the exact phrase "We recommend" or "We would skip" and a natural decision rule. Return {"title":"plain search title","description":"plain factual summary","verdict":"identical 8 or 9 word verdict under 64 characters","cardVerdict":"same verdict","finalBody":"complete corrected Markdown body","humanizerReportMarkdown":"updated short report"}.

FAILURES: ${errors.join("; ")}

EVIDENCE:\n${evidenceText.slice(0, 42000)}

ARTICLE:\n${output.finalBody}`
    );
    output.finalBody = correction.finalBody;
    output.finalBody = normalizePunctuation(output.finalBody);
    if (correction.title) output.title = normalizePunctuation(correction.title, ":");
    if (correction.description) output.description = normalizePunctuation(correction.description);
    if (correction.verdict) {
      output.verdict = normalizePunctuation(correction.verdict);
      output.cardVerdict = output.verdict;
    }
    output.humanizerReportMarkdown = correction.humanizerReportMarkdown || output.humanizerReportMarkdown;
  }
  const remainingErrors = draftErrors(output);
  if (remainingErrors.length) {
    const failedDir = path.join(root, "research", product.slug, "drafts");
    fs.mkdirSync(failedDir, { recursive: true });
    fs.writeFileSync(path.join(failedDir, `${product.slug}-review-2026-08-15-rejected.md`), `${output.finalBody || ""}\n`);
    throw new Error(`${product.product}: ${remainingErrors.join("; ")}`);
  }
  const directory = path.join(root, "research", product.slug);
  const drafts = path.join(directory, "drafts");
  fs.mkdirSync(drafts, { recursive: true });
  fs.writeFileSync(path.join(directory, "writer-notebook-2026-08-15.md"), `${first.writerNotebookMarkdown.trim()}\n`);
  fs.writeFileSync(path.join(directory, "argument-card-2026-08-15.md"), `${first.argumentCardMarkdown.trim()}\n`);
  fs.writeFileSync(path.join(directory, "spoken-review-brief-2026-08-15.md"), `${first.spokenBriefMarkdown.trim()}\n`);
  fs.writeFileSync(path.join(drafts, `${product.slug}-review-2026-08-15-raw.md`), `${first.rawBody.trim()}\n`);
  fs.writeFileSync(path.join(drafts, `${product.slug}-review-2026-08-15-copy-edit.md`), `${second.finalBody.trim()}\n`);
  fs.writeFileSync(path.join(drafts, `${product.slug}-review-2026-08-15-humanized.md`), `${output.finalBody.trim()}\n`);
  fs.writeFileSync(path.join(directory, "humanizer-report-2026-08-15.md"), `${output.humanizerReportMarkdown.trim()}\n`);

  const logoUrl = await saveIcon(product);
  const componentScores = Object.values(output.scores).map(Number);
  const score = Number((componentScores.reduce((sum, value) => sum + value, 0) / componentScores.length).toFixed(1));
  const frontmatter = {
    company: product.product,
    title: output.title.replace(/[\u2010-\u2014]/g, ":"),
    description: output.description.replace(/[\u2010-\u2014]/g, ","),
    date: product.plannedDate,
    author: "Leif Johansen",
    status: "published",
    category: product.category,
    productUrl: product.productUrl,
    logoUrl,
    schemaCategory: schemaCategory(product.category),
    score,
    verdict: output.verdict,
    cardVerdict: output.verdict,
    featured: false,
    reviewType: "research-based",
    legacyResearch: false,
    testingDisclosure: "This is a research-based review. We studied official product information, independent review platforms, and community discussions. We did not run a hands-on test. No payment was received for coverage.",
    sources: evidence.sources.map((source) => ({ name: source.name, url: source.url, accessed: source.accessed })),
    scores: output.scores,
    publishAt: `${product.plannedDate}T09:00:00Z`,
  };
  fs.writeFileSync(articlePath, matter.stringify(`\n${output.finalBody.trim()}\n`, frontmatter));
  console.log(`[${index + 1}/${products.length}] ${product.product}: article and icon saved (${score}/10)`);
  return { slug: product.slug, status: "completed", score, date: product.plannedDate, icon: logoUrl };
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < products.length) {
    const index = cursor++;
    try {
      results.push(await writeProduct(products[index], index));
    } catch (error) {
      console.error(`[${index + 1}/${products.length}] ${products[index].product}: BLOCKED: ${error.message}`);
      results.push({ slug: products[index].slug, status: "blocked", error: error.message });
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
const blocked = results.filter((item) => item.status === "blocked");
fs.writeFileSync(path.join(root, "research", "backfill-99", "writing-run.json"), `${JSON.stringify({ results, blocked }, null, 2)}\n`);
console.log(`Writing run finished: ${results.filter((item) => item.status === "completed").length} completed, ${results.filter((item) => item.status === "existing").length} existing, ${blocked.length} blocked.`);
if (blocked.length) process.exitCode = 2;
import "./lib/legacy-publisher-disabled.mjs";
