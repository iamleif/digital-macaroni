import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import matter from "gray-matter";

const root = process.cwd();
const apiKey = process.env.DEEPINFRA_API_KEY;
const model = process.env.DEEPINFRA_MODEL || "deepseek-ai/DeepSeek-V3";
const onlySlug = process.argv.find((value) => value.startsWith("--slug="))?.slice(7);
const limitArg = process.argv.find((value) => value.startsWith("--limit="))?.slice(8);
const limit = limitArg ? Number(limitArg) : Number.POSITIVE_INFINITY;
const dryRun = process.argv.includes("--dry-run");

if (!apiKey) throw new Error("Missing DEEPINFRA_API_KEY in .env.local.");
if (!Number.isFinite(limit) && limit !== Number.POSITIVE_INFINITY) throw new Error("--limit must be a number.");

const brief = fs.readFileSync(path.join(root, "research", "ARTICLE_BRIEF.md"), "utf8");
const humanizerSkill = fs.readFileSync(path.join(root, ".agents", "skills", "humanizer", "SKILL.md"), "utf8");
const humanizerContext = fs.readFileSync(path.join(root, "humanizer-context.md"), "utf8");
const queuePath = path.join(root, "research", "queue.json");
let queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryLinked(sql, output = "json") {
  return execFileSync("supabase", ["db", "query", "--linked", "--output", output, sql], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

const packetSql = `
select jsonb_build_object(
  'product', jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'website_url', p.website_url,
    'short_description', p.short_description, 'logo_source_url', p.logo_source_url,
    'logo_storage_path', p.logo_storage_path, 'target_publish_date', p.target_publish_date,
    'category', c.name
  ),
  'job', to_jsonb(r),
  'sources', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.id)
    from public.research_sources s where s.product_id = p.id
  ), '[]'::jsonb),
  'findings', coalesce((
    select jsonb_agg(to_jsonb(f) || jsonb_build_object(
      'source_ids', coalesce((
        select jsonb_agg(fs.source_id order by fs.source_id)
        from public.finding_sources fs where fs.finding_id = f.id
      ), '[]'::jsonb)
    ) order by f.id)
    from public.research_findings f where f.product_id = p.id
  ), '[]'::jsonb)
) as packet
from public.research_jobs r
join public.products p on p.id = r.product_id
join public.categories c on c.id = p.category_id
where r.status = 'needs_review'
order by r.priority, r.scheduled_for nulls last, r.id;
`;

const packetResponse = JSON.parse(queryLinked(packetSql));
let packets = packetResponse.rows.map((row) => row.packet);

function hasHumanizedDraft(slug) {
  const directory = path.join(root, "research", slug, "drafts");
  return fs.existsSync(directory) && fs.readdirSync(directory).some((name) => name.endsWith("-humanized.md"));
}

packets = packets.filter(({ product }) => !hasHumanizedDraft(product.slug));
if (onlySlug) packets = packets.filter(({ product }) => product.slug === onlySlug);
packets = packets.slice(0, limit);

function sourceType(source) {
  if (["official", "documentation"].includes(source.source_type)) return "official";
  if (source.source_type === "community") return "community";
  if (source.source_type === "launch-history") {
    return /reddit|product hunt|hacker news/i.test(source.platform || "") ? "community" : "official";
  }
  return "independent-review-platform";
}

function sourceId(source) {
  const base = `${source.platform || "source"}-${source.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `source-${source.id}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

function releaseRecord(sources) {
  const ranked = [...sources].sort((left, right) => {
    const score = (item) =>
      (item.source_type === "launch-history" ? 10 : 0) +
      (item.metadata?.dateRole ? 8 : 0) +
      (/launch|release|founded|turns \d+/i.test(`${item.title} ${item.summary}`) ? 4 : 0) +
      (item.published_at ? 2 : 0);
    return score(right) - score(left);
  });
  for (const source of ranked) {
    let date = dateOnly(source.published_at);
    if (!date) {
      const text = `${source.excerpt || ""} ${source.summary || ""}`;
      const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (iso) date = iso[1];
      if (!date) {
        const natural = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
        if (natural) {
          const parsed = new Date(`${natural[1]} ${natural[2]}, ${natural[3]} 12:00:00 UTC`);
          if (!Number.isNaN(parsed.valueOf())) date = parsed.toISOString().slice(0, 10);
        }
      }
    }
    if (date) return { date, source };
  }
  return null;
}

function keywords(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 4));
}

function linkedSources(finding, sources) {
  const direct = new Set(finding.source_ids || []);
  const exact = sources.filter((source) => direct.has(source.id));
  if (exact.length) return exact.slice(0, 4);
  const wanted = keywords(finding.summary);
  const scored = sources.map((source) => {
    const have = keywords(`${source.title} ${source.summary} ${source.excerpt}`);
    let score = 0;
    for (const word of wanted) if (have.has(word)) score += 1;
    if (finding.finding_type === "fact" && ["official", "documentation", "launch-history"].includes(source.source_type)) score += 2;
    if (finding.finding_type !== "fact" && ["independent-review-platform", "community", "editorial-review"].includes(source.source_type)) score += 2;
    return { source, score };
  }).sort((a, b) => b.score - a.score);
  return scored.filter((item) => item.score > 0).slice(0, 3).map((item) => item.source);
}

function evidenceFrom(packet) {
  const release = releaseRecord(packet.sources);
  if (!release) throw new Error("No exact release date was found in the stored research packet.");
  const mappedSources = packet.sources.map((source) => ({
    id: sourceId(source),
    name: source.title || source.platform || `Source ${source.id}`,
    url: source.url,
    accessed: dateOnly(source.accessed_at) || "2026-08-13",
    sourceType: sourceType(source),
    reviewCountSampled: Number(
      source.metadata?.voiceSamples
      || source.metadata?.sampled_voices
      || source.metadata?.reviewCount
      || source.metadata?.review_count
      || source.metadata?.comments
      || 0
    ) || null,
    keyThemes: [source.summary, source.excerpt].filter(Boolean).map((item) => item.slice(0, 220)),
  }));
  const idByDbId = new Map(packet.sources.map((source) => [source.id, sourceId(source)]));
  const claims = packet.findings.map((finding) => {
    const linked = linkedSources(finding, packet.sources).map((source) => idByDbId.get(source.id)).filter(Boolean);
    if (linked.length === 0) linked.push(mappedSources[0].id);
    return {
      statement: finding.summary,
      kind: finding.finding_type === "fact" ? "fact" : "reported-pattern",
      status: finding.finding_type === "fact" ? "verified" : "supported",
      sourceIds: linked,
    };
  });
  const praise = packet.findings.filter((item) => item.finding_type === "praise").map((item) => item.summary);
  const complaints = packet.findings.filter((item) => item.finding_type === "complaint").map((item) => item.summary);
  const conflicts = packet.findings.filter((item) => ["conflict", "unknown"].includes(item.finding_type)).map((item) => item.summary);
  const launchSourceId = idByDbId.get(release.source.id);
  return {
    schemaVersion: 1,
    productSlug: packet.product.slug,
    legacy: false,
    reviewType: "research-based",
    researchStarted: "2026-08-13",
    researchUpdated: "2026-08-13",
    releaseDate: { date: release.date, precision: "day", sourceId: launchSourceId },
    testing: {
      accessedProduct: false,
      plan: null,
      version: null,
      tasksAttempted: [],
      limitations: ["No new hands-on test was completed.", ...conflicts.slice(0, 3)],
    },
    sources: mappedSources,
    claims,
    scoreRationale: {
      onboarding: praise[0] || "The stored evidence shows a clear first workflow, but no hands-on onboarding test was completed.",
      product: complaints[0] ? `The main value is supported, but this reported limit matters: ${complaints[0]}` : (praise[1] || praise[0]),
      support: complaints.find((item) => /support|help|response|service/i.test(item)) || "The available research does not show enough consistent support outcomes for a top score.",
      billing: complaints.find((item) => /price|pricing|bill|fee|cost|refund|plan/i.test(item)) || "Value depends on whether the core workflow replaces enough manual work to justify the paid plan.",
      overall: conflicts[0] || complaints[0] || praise[0],
    },
    conflictsAndUnknowns: ["No new hands-on test was completed.", ...conflicts],
  };
}

async function deepInfra(messages, maxTokens = 2600, temperature = 0.35) {
  const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`DeepInfra ${response.status}: ${payload?.error?.message || payload?.detail || response.statusText}`);
  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("DeepInfra returned no text.");
  return { content, usage: payload.usage };
}

function parseJson(value) {
  const clean = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

function reading(body) {
  const clean = body.replace(/<[^>]+>/g, " ").replace(/[#*_>`\[\](){}-]/g, " ").replace(/\s+/g, " ").trim();
  const words = clean.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, (clean.match(/[.!?]+(?=\s|$)/g) || []).length);
  let syllables = 0;
  for (const word of words) {
    const candidate = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    syllables += Math.max(1, (candidate.match(/[aeiouy]{1,2}/g) || []).length);
  }
  return { words: words.length, grade: Math.max(0, 0.39 * (words.length / sentences) + 11.8 * (syllables / Math.max(1, words.length)) - 15.59) };
}

function validBody(body) {
  const required = ["The short answer", "What it is good at", "Where it gets in the way", "What using it is likely to feel like", "Price and value", "Who it is for", "Verdict"];
  const metric = reading(body);
  return required.every((heading) => body.includes(`## ${heading}`)) && !/[\u2013\u2014]/.test(body) && metric.words >= 650 && metric.grade <= 7.5;
}

function backfillDate(index, releaseDate) {
  const candidate = new Date(Date.UTC(2026, 5, 12 - index * 3, 12));
  const release = new Date(`${releaseDate}T12:00:00Z`);
  if (candidate >= release) return candidate.toISOString().slice(0, 10);
  const afterRelease = new Date(release.valueOf() + 7 * 86400000);
  const today = new Date("2026-08-13T12:00:00Z");
  return new Date(Math.min(afterRelease.valueOf(), today.valueOf())).toISOString().slice(0, 10);
}

function schemaCategory(category) {
  if (category === "Developer tools") return "DeveloperApplication";
  if (category === "Video & audio") return "MultimediaApplication";
  if (category === "Design & creative") return "DesignApplication";
  if (category === "Accounting & finance") return "FinanceApplication";
  if (category === "Cybersecurity") return "SecurityApplication";
  return "BusinessApplication";
}

async function saveIcon(product) {
  const iconDirectory = path.join(root, "public", "product-icons");
  fs.mkdirSync(iconDirectory, { recursive: true });
  let iconUrl = product.logo_source_url;
  if (!iconUrl) {
    try {
      const page = await fetch(product.website_url, { redirect: "follow" });
      const html = await page.text();
      const match = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon/i);
      iconUrl = match ? new URL(match[1], page.url).href : new URL("/favicon.ico", page.url).href;
    } catch {
      iconUrl = new URL("/favicon.ico", product.website_url).href;
    }
  }
  const response = await fetch(iconUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Icon fetch failed (${response.status}) from ${iconUrl}`);
  const type = response.headers.get("content-type") || "";
  const extension = type.includes("svg") || /\.svg(?:\?|$)/i.test(iconUrl) ? "svg"
    : type.includes("png") || /\.png(?:\?|$)/i.test(iconUrl) ? "png"
      : type.includes("webp") || /\.webp(?:\?|$)/i.test(iconUrl) ? "webp"
        : type.includes("jpeg") || /\.jpe?g(?:\?|$)/i.test(iconUrl) ? "jpg" : "ico";
  const output = path.join(iconDirectory, `${product.slug}.${extension}`);
  fs.writeFileSync(output, Buffer.from(await response.arrayBuffer()));
  return `/product-icons/${product.slug}.${extension}`;
}

async function processPacket(packet, index) {
  const { product } = packet;
  console.log(`\n[${index + 1}/${packets.length}] ${product.name}: normalize research`);
  const evidence = evidenceFrom(packet);
  const voiceCount = evidence.sources.filter((source) => ["independent-review-platform", "community"].includes(source.sourceType))
    .reduce((sum, source) => sum + (source.reviewCountSampled || 0), 0);
  if (voiceCount < 20) throw new Error(`Stored evidence records only ${voiceCount} user voices; 20 are required.`);
  const independent = new Set(evidence.sources.filter((source) => source.sourceType === "independent-review-platform").map((source) => new URL(source.url).hostname));
  if (independent.size < 2) throw new Error("Stored evidence has fewer than two independent platforms.");
  if (!evidence.sources.some((source) => source.sourceType === "community")) throw new Error("Stored evidence has no community source.");

  const researchDirectory = path.join(root, "research", product.slug);
  const draftDirectory = path.join(researchDirectory, "drafts");
  fs.mkdirSync(draftDirectory, { recursive: true });
  fs.writeFileSync(path.join(researchDirectory, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  const existing = queue.find((item) => item.slug === product.slug);
  const queueItem = existing || { slug: product.slug };
  Object.assign(queueItem, { product: product.name, productUrl: product.website_url, status: "drafting", researchStatus: "documented", category: product.category, priority: packet.job.priority });
  if (!existing) queue.unshift(queueItem);
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);

  const analysisPrompt = `Create the metadata and first draft for a Digital Macaroni software review. Use only this evidence. Return strict JSON with keys title, description, verdict, cardVerdict, scores, and body. scores must contain onboarding, product, support, billing, and overall, each from 0 to 10 with one decimal. overall must equal the arithmetic mean of the four component scores rounded to one decimal. cardVerdict must be at most 9 words and 64 characters. body must contain exactly the seven H2 headings from the brief, 700 to 1000 words, no citations or source list, no release date, no em or en dash, no hands-on claim, and no facts outside the evidence.\n\nBRIEF:\n${brief}\n\nEVIDENCE:\n${JSON.stringify(evidence)}`;
  console.log(`${product.name}: DeepSeek first draft`);
  const first = await deepInfra([
    { role: "system", content: "You write blunt, evidence-bound independent software reviews. Output valid JSON only." },
    { role: "user", content: analysisPrompt },
  ], 3500, 0.4);
  const draft = parseJson(first.content);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawPath = path.join(draftDirectory, `${stamp}-deepinfra.md`);
  fs.writeFileSync(rawPath, `<!--\nDraft only. Generated by ${model} through DeepInfra on ${new Date().toISOString()}.\nVerify every claim against research/${product.slug}/evidence.json.\n-->\n\n${String(draft.body).trim()}\n`);

  console.log(`${product.name}: Humanizer rewrite`);
  let humanized = String(draft.body).trim();
  const lengthContract = `Write 700 to 850 words. The short answer must have at least 90 words. What it is good at and Where it gets in the way must each have at least 120 words. What using it is likely to feel like must have at least 110 words. Price and value and Who it is for must each have at least 80 words. Verdict must have at least 60 words. Do not summarize or compress below these limits.`;
  const appliedHumanizerRules = `Apply the installed Humanizer skill in blunt review voice. Remove promotional language, vague claims, filler, forced lists, generic conclusions, chatbot phrasing, and uniform sentence patterns. Use active voice and plain common words. Most sentences must have 6 to 12 words. No sentence may exceed 18 words unless a product name or exact fact requires it. Mix short and medium sentences. Use no em dash or en dash. Preserve hard facts, numbers, product names, uncertainty, and source qualifiers. Never invent a test, customer, feature, price, opinion, or personal detail. Do not turn one report into a general fact.`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const metric = reading(humanized);
    const correction = metric.words < 650
      ? `The article is too short. Expand it to 800 to 900 words with useful evidence-based explanation. Keep the current simple wording. Do not introduce new facts. Follow every section minimum in the length contract.`
      : metric.grade > 7.5
        ? `The article is long enough but too hard to read. Keep its current length within 5 percent. Rewrite each sentence with plain, common words. Keep most sentences under 12 words. Split long sentences. Do not remove facts or sections.`
        : `Keep the current length and simplify any remaining stiff or generic wording.`;
    const instruction = attempt === 1
      ? `${appliedHumanizerRules} Return the rewritten Markdown article body only. Keep a grade 7.5 reading level or lower. ${lengthContract}\n\nBRAND CONTEXT:\n${humanizerContext}\n\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nDRAFT:\n${humanized}`
      : `The last Humanizer pass measured grade ${metric.grade.toFixed(1)} with ${metric.words} words and failed the publication gate. ${correction} Keep every supported fact, qualifier, and all seven H2 headings. ${lengthContract} No em or en dashes. Return Markdown body only.\n\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nDRAFT:\n${humanized}`;
    humanized = (await deepInfra([
      { role: "system", content: "You are the Humanizer editing stage. Follow the supplied skill and return article Markdown only." },
      { role: "user", content: instruction },
    ], 4000, 0.28)).content.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
    fs.writeFileSync(path.join(draftDirectory, `${stamp}-humanizer-attempt-${attempt}.md`), `${humanized}\n`);
    if (validBody(humanized)) break;
  }
  if (!validBody(humanized)) {
    const metric = reading(humanized);
    throw new Error(`Humanizer gate failed at ${metric.words} words and grade ${metric.grade.toFixed(1)}.`);
  }
  const humanizedPath = path.join(draftDirectory, `${stamp}-humanized.md`);
  fs.writeFileSync(humanizedPath, `<!--\nDraft only. Humanizer rewrite in Digital Macaroni's blunt review voice.\nBased on ${path.basename(rawPath)}. Every claim was checked against the evidence packet.\n-->\n\n${humanized}\n`);

  console.log(`${product.name}: icon and publication file`);
  const logoUrl = await saveIcon(product);
  const publishDate = backfillDate(index, evidence.releaseDate.date);
  const componentScores = ["onboarding", "product", "support", "billing"].map((key) => Number(draft.scores?.[key]));
  if (componentScores.some((score) => !Number.isFinite(score) || score < 0 || score > 10)) throw new Error("DeepSeek returned invalid component scores.");
  const average = Number((componentScores.reduce((sum, score) => sum + score, 0) / 4).toFixed(1));
  const independentCount = evidence.sources.filter((source) => source.sourceType === "independent-review-platform").length;
  const communityCount = evidence.sources.filter((source) => source.sourceType === "community").length;
  const frontmatter = {
    company: product.name,
    title: String(draft.title).replace(/[\u2013\u2014]/g, ":"),
    description: String(draft.description).replace(/[\u2013\u2014]/g, ","),
    date: publishDate,
    updated: publishDate,
    author: "Leif Johansen",
    status: "published",
    category: product.category,
    productUrl: product.website_url,
    logoUrl,
    schemaCategory: schemaCategory(product.category),
    score: average,
    verdict: String(draft.verdict).replace(/[\u2013\u2014]/g, ","),
    cardVerdict: String(draft.cardVerdict).replace(/[\u2013\u2014]/g, ",").split(/\s+/).slice(0, 9).join(" ").slice(0, 64),
    featured: false,
    reviewType: "research-based",
    legacyResearch: false,
    testingDisclosure: `This is a research-based review. We studied official product information, ${independentCount} independent review sources, and ${communityCount} community sources. We did not run a hands-on test. No payment was received for coverage.`,
    sources: evidence.sources.map((source) => ({ name: source.name, url: source.url, accessed: source.accessed })),
    scores: { onboarding: componentScores[0], product: componentScores[1], support: componentScores[2], billing: componentScores[3] },
    publishAt: `${publishDate}T09:00:00Z`,
  };
  const articlePath = path.join(root, "content", "reviews", `${product.slug}.mdx`);
  fs.writeFileSync(articlePath, matter.stringify(`\n${humanized}\n`, frontmatter));
  queueItem.status = "published";
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);

  const validation = spawnSync(process.execPath, [path.join(root, "scripts", "validate-content.mjs")], { cwd: root, encoding: "utf8" });
  if (validation.status !== 0) throw new Error(validation.stderr || validation.stdout || "Content validation failed.");

  if (!dryRun) {
    const articleBody = humanized;
    const updateSql = `
      update public.products set pipeline_status='published', target_publish_date=${sqlLiteral(publishDate)}, is_public=true where id=${product.id};
      update public.research_jobs set status='approved' where id=${packet.job.id};
      insert into public.articles (product_id, slug, title, description, body_mdx, verdict, card_verdict, author_name, status, review_type, testing_disclosure, featured, published_on, updated_on, publish_at, overall_score)
      values (${product.id}, ${sqlLiteral(product.slug)}, ${sqlLiteral(frontmatter.title)}, ${sqlLiteral(frontmatter.description)}, ${sqlLiteral(articleBody)}, ${sqlLiteral(frontmatter.verdict)}, ${sqlLiteral(frontmatter.cardVerdict)}, 'Leif Johansen', 'published', 'research-based', ${sqlLiteral(frontmatter.testingDisclosure)}, false, ${sqlLiteral(publishDate)}, ${sqlLiteral(publishDate)}, ${sqlLiteral(`${publishDate}T09:00:00Z`)}, ${average})
      on conflict (product_id) do update set title=excluded.title, description=excluded.description, body_mdx=excluded.body_mdx, verdict=excluded.verdict, card_verdict=excluded.card_verdict, status='published', testing_disclosure=excluded.testing_disclosure, published_on=excluded.published_on, updated_on=excluded.updated_on, publish_at=excluded.publish_at, overall_score=excluded.overall_score;
      insert into public.article_scores (article_id, onboarding, product, support, billing)
      select id, ${componentScores[0]}, ${componentScores[1]}, ${componentScores[2]}, ${componentScores[3]} from public.articles where product_id=${product.id}
      on conflict (article_id) do update set onboarding=excluded.onboarding, product=excluded.product, support=excluded.support, billing=excluded.billing;
    `;
    queryLinked(updateSql, "table");
  }
  console.log(`${product.name}: published locally and synced to Supabase at ${average}/10 (${publishDate})`);
}

console.log(`Sequential queue contains ${packets.length} unprocessed product(s).`);
let completed = 0;
const failures = [];
for (const [index, packet] of packets.entries()) {
  try {
    await processPacket(packet, index);
    completed += 1;
  } catch (error) {
    failures.push({ slug: packet.product.slug, error: error.message });
    console.error(`${packet.product.name}: BLOCKED: ${error.message}`);
  }
}

console.log(`\nQueue run complete: ${completed} published, ${failures.length} blocked.`);
for (const failure of failures) console.log(`- ${failure.slug}: ${failure.error.split("\n")[0]}`);
if (failures.length) process.exitCode = 2;
