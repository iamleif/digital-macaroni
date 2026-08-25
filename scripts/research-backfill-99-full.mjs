import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiKey = process.env.DEEPINFRA_API_KEY;
const model = process.env.DEEPINFRA_RESEARCH_MODEL || "deepseek-ai/DeepSeek-R1";
const batch = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "batch.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "qualification-audit.json"), "utf8"));
const communitySeeds = JSON.parse(fs.readFileSync(path.join(root, "research", "backfill-99", "community-seeds.json"), "utf8"));
const only = process.argv.find((item) => item.startsWith("--slug="))?.slice(7);
const retryBlocked = process.argv.includes("--retry-blocked");
const limit = Number(process.argv.find((item) => item.startsWith("--limit="))?.slice(8) || Infinity);
const concurrency = Number(process.argv.find((item) => item.startsWith("--concurrency="))?.slice(14) || 2);
const force = process.argv.includes("--force");
const skipSearch = process.argv.includes("--skip-search");

if (!apiKey) throw new Error("Missing DEEPINFRA_API_KEY.");
const auditBySlug = new Map(audit.products.map((item) => [item.slug, item]));
const priorRunPath = path.join(root, "research", "backfill-99", "full-research-run.json");
const blockedSlugs = retryBlocked && fs.existsSync(priorRunPath)
  ? new Set(JSON.parse(fs.readFileSync(priorRunPath, "utf8")).blocked.map((item) => item.slug))
  : null;
const products = batch.products.filter((item) => (!only || item.slug === only) && (!blockedSlugs || blockedSlugs.has(item.slug))).slice(0, limit);

const extraSourceBySlug = {
  testsprite: "https://docs.testsprite.com/",
  base44: "https://docs.base44.com/",
  penpot: "https://help.penpot.app/",
  signwell: "https://help.signwell.com/",
  juro: "https://help.juro.com/",
  savvycal: "https://docs.savvycal.com/",
  appwrite: "https://appwrite.io/docs",
  postiz: "https://docs.postiz.com/",
  amie: "https://help.amie.so/",
  raycast: "https://manual.raycast.com/",
  chatwoot: "https://www.chatwoot.com/docs/",
  trae: "https://docs.trae.ai/",
  "zoho-books": "https://www.zoho.com/books/help/",
  justcall: "https://help.justcall.io/",
  sider: "https://sider.ai/help-center",
  ghost: "https://ghost.org/docs/"
};

const secondExtraSourceBySlug = {
  testsprite: "https://www.testsprite.com/docs",
  base44: "https://base44.com/blog",
  postiz: "https://github.com/gitroomhq/postiz-app",
  amie: "https://amie.so/changelog",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

async function fetchText(url, timeout = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DigitalMacaroniResearch/1.0)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function unwrapDuckUrl(value) {
  const raw = value.replaceAll("&amp;", "&");
  const absolute = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    const parsed = new URL(absolute);
    return parsed.searchParams.get("uddg") || absolute;
  } catch {
    return absolute;
  }
}

async function search(query) {
  const run = searchTail.then(async () => {
    await sleep(2600);
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      } catch (error) {
        lastError = error;
        await sleep(7000 * attempt);
      }
    }
    console.warn(`Search unavailable for ${query}: ${lastError?.message}`);
    return "";
  });
  searchTail = run.catch(() => "");
  const html = await run;
  const results = [];
  const blocks = html.split(/class="result results_links/).slice(1);
  for (const block of blocks) {
    const href = block.match(/class="result__a"[^>]+href="([^"]+)"/)?.[1];
    if (!href) continue;
    const title = clean(block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const snippet = clean(block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/)?.slice(1).find(Boolean));
    results.push({ url: unwrapDuckUrl(href), title, snippet });
  }
  return results;
}

let searchTail = Promise.resolve();

async function readable(url) {
  const readerUrl = `https://r.jina.ai/${url}`;
  try {
    const text = await fetchText(readerUrl, 35000);
    return text.replace(/\0/g, "").slice(0, 12000);
  } catch {
    try {
      return clean(await fetchText(url, 25000)).slice(0, 8000);
    } catch (error) {
      return `[Page could not be opened: ${error.message}]`;
    }
  }
}

async function deepInfraJson(prompt, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 5000,
          reasoning_effort: "high",
          messages: [
            { role: "system", content: "You are a meticulous software-review researcher. Use only supplied source text. Return strict JSON with no markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || payload?.detail || `HTTP ${response.status}`);
      const raw = payload?.choices?.[0]?.message?.content || "";
      const value = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const firstBrace = value.indexOf("{");
      const lastBrace = value.lastIndexOf("}");
      return JSON.parse(firstBrace >= 0 && lastBrace > firstBrace ? value.slice(firstBrace, lastBrace + 1) : value);
    } catch (error) {
      lastError = error;
      await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source?.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

async function researchProduct(product, index) {
  const outputDir = path.join(root, "research", product.slug);
  const outputFile = path.join(outputDir, "evidence.json");
  if (!force && fs.existsSync(outputFile)) {
    console.log(`[${index + 1}/${products.length}] ${product.product}: existing evidence retained`);
    return { slug: product.slug, status: "existing" };
  }
  const qualified = auditBySlug.get(product.slug);
  if (!qualified) throw new Error(`${product.slug}: missing qualification audit`);
  console.log(`[${index + 1}/${products.length}] ${product.product}: finding specific sources`);

  const [communityPositive, communityProblems, officialResults] = skipSearch ? [[], [], []] : await Promise.all([
    search(`site:reddit.com ${product.product} software review experience`),
    search(`site:reddit.com ${product.product} software problems support pricing`),
    search(`site:${new URL(product.productUrl).hostname} ${product.product} pricing features documentation`),
  ]);

  const discoveredCommunity = [...communityPositive, ...communityProblems]
    .filter((result) => /reddit\.com\/r\/[^/]+\/comments\//i.test(result.url))
    .filter((result, position, all) => all.findIndex((other) => other.url.split("?")[0] === result.url.split("?")[0]) === position)
    .slice(0, 3)
    .map((result, position) => ({
      id: `community-${position + 1}`,
      name: result.title || `${product.product} community discussion`,
      url: result.url,
      sourceType: "community",
      reviewCountSampled: null,
      searchSnippet: result.snippet,
    }));
  const reddit = (communitySeeds[product.slug] || []).map((url, position) => ({
      id: `community-seed-${position + 1}`,
      name: `${product.product} community discussion`,
      url,
      sourceType: "community",
      reviewCountSampled: qualified.communityVoicesObserved ?? null,
      searchSnippet: "Specific community discussion selected during the editorial source audit.",
    }));
  if (reddit.length === 0) reddit.push(...discoveredCommunity);

  const officialExtra = officialResults
    .filter((result) => new URL(result.url).hostname.endsWith(new URL(product.productUrl).hostname.replace(/^www\./, "")))
    .slice(0, 2)
    .map((result, position) => ({
      id: `official-extra-${position + 1}`,
      name: result.title || `${product.product} official documentation`,
      url: result.url,
      sourceType: "official",
      reviewCountSampled: null,
      searchSnippet: result.snippet,
    }));

  const baseSources = [
    { id: "official-site", name: `${product.product} official website`, url: product.productUrl, sourceType: "official", reviewCountSampled: null },
    { id: "release-history", name: `${product.product} release history`, url: qualified.release.sourceUrl, sourceType: "official", reviewCountSampled: null },
    ...officialExtra,
    ...qualified.platforms.map((source, position) => ({ id: `reviews-${position + 1}`, name: `${product.product} reviews on ${source.name}`, url: source.url, sourceType: "independent-review-platform", reviewCountSampled: source.voices })),
    ...reddit,
  ];
  if (extraSourceBySlug[product.slug]) {
    baseSources.push({ id: "official-docs", name: `${product.product} official documentation`, url: extraSourceBySlug[product.slug], sourceType: "official", reviewCountSampled: null });
  }
  if (secondExtraSourceBySlug[product.slug]) {
    baseSources.push({ id: "official-extra-audit", name: `${product.product} additional official source`, url: secondExtraSourceBySlug[product.slug], sourceType: "official", reviewCountSampled: null });
  }
  const sources = uniqueSources(baseSources).slice(0, 10);
  if (sources.filter((source) => source.sourceType === "independent-review-platform").length < 2) throw new Error("Fewer than two independent review platforms");
  if (reddit.length === 0) throw new Error("No community source found");

  console.log(`[${index + 1}/${products.length}] ${product.product}: opening ${sources.length} sources`);
  const opened = [];
  for (const source of sources) {
    const text = await readable(source.url);
    opened.push({ ...source, text: `${source.searchSnippet || ""}\n${text}`.slice(0, 10000) });
    await sleep(200);
  }

  const sourceDigest = opened.map((source) => `SOURCE ${source.id}\nNAME: ${source.name}\nURL: ${source.url}\nTYPE: ${source.sourceType}\nDISPLAYED VOICES: ${source.reviewCountSampled ?? "unknown"}\nTEXT:\n${source.text}`).join("\n\n---\n\n");
  console.log(`[${index + 1}/${products.length}] ${product.product}: extracting claims and incidents`);
  const extracted = await deepInfraJson(`
Build a research record for a Digital Macaroni review of ${product.product} (${product.category}).

Strict rules:
- Use only the supplied source text. Do not fill gaps from memory.
- Separate verified product facts from patterns in customer accounts.
- A reported problem stays a reported pattern, never a universal fact.
- Extract concrete customer situations when the text supplies context, action, outcome, or vendor response.
- Record conflicts rather than averaging them away.
- Current prices may be included only when an official source states them clearly.
- Do not claim hands-on use.
- Do not mention source counts in editorial conclusions.
- Return five to eight distinct supported claims. Include both product facts and customer patterns when the source text supports them.

Return this JSON shape:
{
  "sourceThemes": {"source-id": ["two to five short factual themes"]},
  "claims": [{"statement":"...","kind":"fact|reported-pattern","status":"verified|supported","sourceIds":["..."]}],
  "experienceRecords": [{"sourceId":"...","sentiment":"positive|negative|mixed","userContext":"known context or unknown","task":"...","whatHappened":"...","result":"...","vendorResponse":"known response or unknown","confidence":"high|medium|low"}],
  "scoreRationale": {"onboarding":"...","product":"...","support":"...","billing":"...","overall":"..."},
  "conflictsAndUnknowns": ["..."],
  "featureTranslations": [{"term":"...","plainExplanation":"...","whoCares":"...","whenItDoesNotMatter":"..."}],
  "researchLimits": ["..."]
}

SOURCE MATERIAL:
${sourceDigest.slice(0, 70000)}
`);

  const evidence = {
    schemaVersion: 1,
    productSlug: product.slug,
    legacy: false,
    reviewType: "research-based",
    researchStarted: "2026-08-14",
    researchUpdated: "2026-08-14",
    releaseDate: { date: qualified.release.date, precision: qualified.release.precision, sourceId: "release-history" },
    testing: {
      accessedProduct: false,
      plan: null,
      version: null,
      tasksAttempted: [],
      limitations: ["No Digital Macaroni hands-on test was completed.", ...(extracted.researchLimits || [])],
    },
    sources: opened.map(({ text, searchSnippet, ...source }) => ({
      ...source,
      accessed: "2026-08-14",
      keyThemes: extracted.sourceThemes?.[source.id] || [],
    })),
    claims: extracted.claims || [],
    experienceRecords: extracted.experienceRecords || [],
    featureTranslations: extracted.featureTranslations || [],
    scoreRationale: extracted.scoreRationale || {},
    conflictsAndUnknowns: extracted.conflictsAndUnknowns || [],
  };

  const independent = new Set(evidence.sources.filter((source) => source.sourceType === "independent-review-platform").map((source) => source.name));
  const voices = evidence.sources.reduce((total, source) => total + (source.reviewCountSampled || 0), 0) + (qualified.communityVoicesObserved || 0);
  const community = evidence.sources.filter((source) => source.sourceType === "community").length;
  const errors = [];
  if (evidence.sources.length < 6) errors.push("fewer than six sources");
  if (independent.size < 2) errors.push("fewer than two independent review platforms");
  if (voices < 20) errors.push("fewer than 20 identifiable voices");
  if (community < 1) errors.push("no specific community discussion");
  if (evidence.claims.length < 4) errors.push("fewer than four supported claims");
  if (errors.length) throw new Error(errors.join(", "));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`[${index + 1}/${products.length}] ${product.product}: evidence saved (${evidence.sources.length} sources, ${evidence.claims.length} claims)`);
  return { slug: product.slug, status: "completed", sources: evidence.sources.length, claims: evidence.claims.length };
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < products.length) {
    const index = cursor++;
    const product = products[index];
    try {
      results.push(await researchProduct(product, index));
    } catch (error) {
      console.error(`[${index + 1}/${products.length}] ${product.product}: BLOCKED: ${error.message}`);
      results.push({ slug: product.slug, status: "blocked", error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
const completed = results.filter((item) => item.status === "completed").length;
const existing = results.filter((item) => item.status === "existing").length;
const blocked = results.filter((item) => item.status === "blocked");
fs.writeFileSync(path.join(root, "research", "backfill-99", "full-research-run.json"), `${JSON.stringify({ completed, existing, blocked, results }, null, 2)}\n`);
console.log(`Research run finished: ${completed} completed, ${existing} existing, ${blocked.length} blocked.`);
if (blocked.length) process.exitCode = 2;
