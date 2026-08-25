import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");
const researchDirectory = path.join(root, "research");
const queuePath = path.join(researchDirectory, "queue.json");
const sourcePolicyPath = path.join(researchDirectory, "source-policy.json");
const taxonomyPath = path.join(root, "lib", "review-taxonomy.ts");
const requiredScores = ["onboarding", "product", "support", "billing"];
const validStatuses = new Set(["draft", "published"]);
const validReviewTypes = new Set(["hands-on", "research-based", "legacy-editorial"]);
const validSchemaCategories = new Set([
  "GameApplication", "SocialNetworkingApplication", "TravelApplication", "ShoppingApplication",
  "SportsApplication", "LifestyleApplication", "BusinessApplication", "DesignApplication",
  "DeveloperApplication", "DriverApplication", "EducationalApplication", "HealthApplication",
  "FinanceApplication", "SecurityApplication", "BrowserApplication", "CommunicationApplication",
  "DesktopEnhancementApplication", "EntertainmentApplication", "MultimediaApplication",
  "HomeApplication", "UtilitiesApplication", "ReferenceApplication",
]);
const validQueueStatuses = new Set(["queued", "researching", "draft", "ready", "published", "needs-update"]);
const errors = [];
const warnings = [];
const reviews = [];
const publicationDates = new Map();

const taxonomySource = fs.readFileSync(taxonomyPath, "utf8");
const taxonomyMatch = taxonomySource.match(/REVIEW_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/);
const validReviewCategories = new Set(taxonomyMatch ? [...taxonomyMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]) : []);
if (validReviewCategories.size === 0) errors.push("lib/review-taxonomy.ts: could not load review categories");

let sourcePolicy = {};
try {
  sourcePolicy = JSON.parse(fs.readFileSync(sourcePolicyPath, "utf8"));
} catch (error) {
  errors.push(`research/source-policy.json: ${error.message}`);
}

function issue(collection, slug, message) {
  collection.push(`${slug}: ${message}`);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function words(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function readability(value) {
  const clean = value
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`\[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = Math.max(1, (clean.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const tokens = words(clean);
  const syllables = tokens.reduce((total, word) => {
    let candidate = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const count = candidate.match(/[aeiouy]{1,2}/g)?.length ?? 1;
    return total + Math.max(1, count);
  }, 0);
  const grade = 0.39 * (tokens.length / sentences) + 11.8 * (syllables / Math.max(1, tokens.length)) - 15.59;
  return { grade: Math.max(0, grade), averageSentenceWords: tokens.length / sentences };
}

function shingles(value, size = 5) {
  const tokens = words(value);
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(" "));
  }
  return result;
}

function similarity(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function aggregationVoiceMatches(body) {
  const prose = body.replace(/^## What using it is likely to feel like$/m, "## Experience");
  const pattern = /(?:^|[.!?]\s+)(?:other\s+|some\s+|many\s+|most\s+|a few\s+)?(?:reviews?|reviewers?|the evidence|evidence from|users?|customers?|sources?|reports?|complaints?|feedback)\b[^.!?\n]{0,48}\b(?:shows?|show|says?|say|finds?|found|praises?|praise|describes?|describe|reports?|report|suggests?|suggest|indicates?|indicate|points?|point|comes?|come|is|are|was|were|has|have)\b/gi;
  return prose.match(pattern) || [];
}

let queue = [];
try {
  queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  if (!Array.isArray(queue)) throw new Error("queue must be an array");
} catch (error) {
  errors.push(`research/queue.json: ${error.message}`);
}

const queueBySlug = new Map();
for (const item of queue) {
  if (!item || typeof item.slug !== "string") {
    errors.push("research/queue.json: every item needs a slug");
    continue;
  }
  if (queueBySlug.has(item.slug)) issue(errors, item.slug, "appears more than once in research/queue.json");
  queueBySlug.set(item.slug, item);
  if (!validQueueStatuses.has(item.status)) issue(errors, item.slug, `has unsupported queue status “${item.status}”`);
  if (!isUrl(item.productUrl)) issue(errors, item.slug, "needs a valid productUrl in research/queue.json");
  if (!validReviewCategories.has(item.category)) issue(errors, item.slug, "needs a supported category in research/queue.json");
}

const reviewFiles = fs.readdirSync(reviewDirectory).filter((file) => file.endsWith(".mdx"));
for (const file of reviewFiles) {
  const slug = file.replace(/\.mdx$/, "");
  const source = fs.readFileSync(path.join(reviewDirectory, file), "utf8");
  const parsed = matter(source);
  const data = parsed.data;
  const requiredText = ["company", "title", "description", "category", "verdict", "cardVerdict", "author", "testingDisclosure"];

  for (const field of requiredText) {
    if (typeof data[field] !== "string" || data[field].trim().length === 0) issue(errors, slug, `missing ${field}`);
  }
  if (!validStatuses.has(data.status)) issue(errors, slug, `status must be draft or published`);
  if (!validReviewTypes.has(data.reviewType)) issue(errors, slug, `reviewType must be hands-on, research-based, or legacy-editorial`);
  if (!validReviewCategories.has(data.category)) issue(errors, slug, `category must use the shared review taxonomy`);
  const verdictWords = words(data.verdict ?? "").length;
  if (verdictWords < 8 || verdictWords > 9) issue(errors, slug, `verdict headline must be 8 or 9 words (found ${verdictWords})`);
  const cardVerdictWords = words(data.cardVerdict ?? "").length;
  if (cardVerdictWords < 8 || cardVerdictWords > 9) issue(errors, slug, `cardVerdict must be 8 or 9 words (found ${cardVerdictWords})`);
  if ((data.cardVerdict ?? "").length > 64) issue(errors, slug, "cardVerdict must be 64 characters or fewer");
  if (!isUrl(data.productUrl)) issue(errors, slug, "needs a valid productUrl");
  if (!validSchemaCategories.has(data.schemaCategory)) {
    issue(errors, slug, "schemaCategory must use a Google-supported SoftwareApplication category");
  }
  if (!isDate(data.date)) issue(errors, slug, "date must use YYYY-MM-DD");
  if (Object.hasOwn(data, "updated")) issue(errors, slug, "updated must be removed; reviews expose only their original publication date");
  if (data.status === "published" && isDate(data.date)) {
    const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay();
    if (![2, 5].includes(weekday)) issue(errors, slug, "published date must fall on Tuesday or Friday");
    const existingSlug = publicationDates.get(data.date);
    if (existingSlug) issue(errors, slug, `published date is already used by ${existingSlug}`);
    else publicationDates.set(data.date, slug);
  }
  if (data.publishAt && Number.isNaN(Date.parse(data.publishAt))) issue(errors, slug, "publishAt must be a valid ISO date/time");
  if (data.publishAt && isDate(data.date) && data.publishAt.slice(0, 10) !== data.date) issue(errors, slug, "publishAt must use the publication date");
  if (typeof data.score !== "number" || data.score < 0 || data.score > 10) issue(errors, slug, "overall score must be between 0 and 10");

  for (const scoreName of requiredScores) {
    const score = data.scores?.[scoreName];
    if (typeof score !== "number" || score < 0 || score > 10) issue(errors, slug, `${scoreName} score must be between 0 and 10`);
  }

  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    issue(errors, slug, "needs at least one source");
  } else {
    for (const [index, sourceEntry] of data.sources.entries()) {
      if (!sourceEntry?.name) issue(errors, slug, `source ${index + 1} needs a name`);
      if (!isUrl(sourceEntry?.url)) issue(errors, slug, `source ${index + 1} needs a valid URL`);
      if (!isDate(sourceEntry?.accessed)) issue(errors, slug, `source ${index + 1} needs an accessed date`);
    }
  }

  const queueEntry = queueBySlug.get(slug);
  if (!queueEntry) issue(errors, slug, "is missing from research/queue.json");
  if (queueEntry && queueEntry.productUrl !== data.productUrl) issue(errors, slug, "productUrl does not match research/queue.json");
  if (queueEntry && queueEntry.category !== data.category) issue(errors, slug, "category does not match research/queue.json");
  if (queueEntry && data.status === "published" && queueEntry.status !== "published") {
    issue(errors, slug, "is published in frontmatter but not in research/queue.json");
  }

  const evidencePath = path.join(researchDirectory, slug, "evidence.json");
  let evidence = null;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  } catch (error) {
    issue(errors, slug, `cannot read research/${slug}/evidence.json (${error.message})`);
  }

  if (evidence) {
    if (evidence.productSlug !== slug) issue(errors, slug, "evidence productSlug does not match the review filename");
    if (evidence.reviewType !== data.reviewType) issue(errors, slug, "evidence reviewType does not match frontmatter");

    if (data.legacyResearch) {
      issue(warnings, slug, "legacy editorial review still needs a full evidence refresh");
    } else {
      const evidenceSources = Array.isArray(evidence.sources) ? evidence.sources : [];
      const sourceIds = new Set(evidenceSources.map((item) => item.id));
      if (evidenceSources.length < (sourcePolicy.minimumTotalSources ?? 6)) {
        issue(errors, slug, `new research needs at least ${sourcePolicy.minimumTotalSources ?? 6} evidence sources`);
      }
      if (sourceIds.size !== evidenceSources.length) issue(errors, slug, "evidence source IDs must be unique");
      for (const evidenceSource of evidenceSources) {
        if (!evidenceSource.id || !evidenceSource.name || !isUrl(evidenceSource.url) || !isDate(evidenceSource.accessed)) {
          issue(errors, slug, "every evidence source needs an id, name, valid URL, and accessed date");
        }
      }

      const independentSources = evidenceSources.filter((item) => item.sourceType === "independent-review-platform");
      const independentPlatforms = new Set(independentSources.map((item) => {
        try { return new URL(item.url).hostname.replace(/^www\./, ""); } catch { return item.name; }
      }));
      const communitySources = evidenceSources.filter((item) => item.sourceType === "community");
      const voiceSample = evidenceSources
        .filter((item) => item.sourceType === "independent-review-platform" || item.sourceType === "community")
        .reduce((total, item) => total + (Number(item.reviewCountSampled) || 0), 0);
      if (independentPlatforms.size < (sourcePolicy.minimumIndependentPlatforms ?? 2)) {
        issue(errors, slug, `new research needs at least ${sourcePolicy.minimumIndependentPlatforms ?? 2} independent review platforms`);
      }
      if (communitySources.length < (sourcePolicy.minimumCommunitySources ?? 1)) {
        issue(errors, slug, `new research needs at least ${sourcePolicy.minimumCommunitySources ?? 1} relevant community source`);
      }
      if (voiceSample < (sourcePolicy.minimumVoiceSamples ?? 20)) {
        issue(errors, slug, `new research needs at least ${sourcePolicy.minimumVoiceSamples ?? 20} sampled user reviews or community comments`);
      }
      if (!evidenceSources.some((item) => item.sourceType === "official")) {
        issue(errors, slug, "new research needs at least one official product source");
      }
      if (!isDate(evidence.releaseDate?.date)) {
        issue(errors, slug, "new research needs a verified releaseDate");
      } else {
        if (!sourceIds.has(evidence.releaseDate?.sourceId)) issue(errors, slug, "releaseDate must reference an evidence source");
        if (isDate(data.date) && data.date < evidence.releaseDate.date) {
          issue(errors, slug, `review date ${data.date} is earlier than the product release date ${evidence.releaseDate.date}`);
        }
      }

      const claims = Array.isArray(evidence.claims) ? evidence.claims : [];
      if (claims.length < 3) issue(errors, slug, "new published research needs at least three documented claims");
      for (const [index, claim] of claims.entries()) {
        if (!claim.statement) issue(errors, slug, `claim ${index + 1} needs a statement`);
        if (claim.kind === "fact") {
          if (claim.status !== "verified") issue(errors, slug, `factual claim ${index + 1} is not verified`);
          if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) issue(errors, slug, `factual claim ${index + 1} needs source IDs`);
          for (const sourceId of claim.sourceIds ?? []) {
            if (!sourceIds.has(sourceId)) issue(errors, slug, `factual claim ${index + 1} references unknown source “${sourceId}”`);
          }
        }
      }

      for (const scoreName of [...requiredScores, "overall"]) {
        if (typeof evidence.scoreRationale?.[scoreName] !== "string" || evidence.scoreRationale[scoreName].trim().length < 20) {
          issue(errors, slug, `evidence needs a substantive ${scoreName} score rationale`);
        }
      }

      if (data.reviewType === "hands-on") {
        if (!evidence.testing?.accessedProduct) issue(errors, slug, "hands-on reviews must confirm product access in evidence.testing");
        if (!Array.isArray(evidence.testing?.tasksAttempted) || evidence.testing.tasksAttempted.length < 2) {
          issue(errors, slug, "hands-on reviews need at least two recorded testing tasks");
        }
      }
    }
  }

  const wordCount = words(parsed.content).length;
  if (/\u2014|\u2013/.test(parsed.content) || /\u2014|\u2013/.test(JSON.stringify(data))) {
    issue(errors, slug, "em dashes and en dashes are not allowed in published review copy or metadata");
  }
  const reading = readability(parsed.content);
  if (data.reviewType === "research-based" && !data.legacyResearch) {
    const aggregationCount = aggregationVoiceMatches(parsed.content).length;
    if (aggregationCount > 2) {
      issue(errors, slug, `reads like source aggregation (${aggregationCount} aggregation-led sentences; maximum is 2)`);
    }
    if (!/\b(?:recommend|skip|our verdict)\b/i.test(parsed.content)) {
      issue(errors, slug, "needs an owned editorial recommendation in the article body");
    }
  }
  if (wordCount < 450) issue(warnings, slug, `article body is only ${wordCount} words`);
  const readabilityIssues = [];
  if (reading.grade > 7.5) readabilityIssues.push(`reading level is grade ${reading.grade.toFixed(1)}; target grade 6 and maximum grade 7.5`);
  if (reading.averageSentenceWords > 18) readabilityIssues.push(`average sentence length is ${reading.averageSentenceWords.toFixed(1)} words; maximum is 18`);
  for (const message of readabilityIssues) {
    issue(data.legacyResearch ? warnings : errors, slug, message);
  }
  reviews.push({ slug, title: data.title, verdict: data.verdict, content: parsed.content, shingles: shingles(parsed.content) });
}

for (let leftIndex = 0; leftIndex < reviews.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < reviews.length; rightIndex += 1) {
    const left = reviews[leftIndex];
    const right = reviews[rightIndex];
    if (left.title === right.title) errors.push(`${left.slug}/${right.slug}: duplicate title`);
    if (left.verdict === right.verdict) errors.push(`${left.slug}/${right.slug}: duplicate verdict`);
    const overlap = similarity(left.shingles, right.shingles);
    if (overlap >= 0.72) errors.push(`${left.slug}/${right.slug}: article bodies are ${(overlap * 100).toFixed(1)}% similar`);
  }
}

if (warnings.length > 0) {
  console.warn(`\nContent warnings (${warnings.length})`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error(`\nContent validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\nContent validation passed for ${reviews.length} reviews${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);
