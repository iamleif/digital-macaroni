import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { bodySha256, REQUIRED_VALIDATION_CHECKS } from "./editorial-contract.mjs";
import { auditProse } from "../../.agents/skills/digital-macaroni-humanizer/scripts/audit-prose.mjs";

function words(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function readability(body) {
  const clean = body.replace(/<[^>]+>/g, " ").replace(/[#*_>`\[\](){}-]/g, " ").replace(/\s+/g, " ").trim();
  const sentences = Math.max(1, (clean.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const tokens = words(clean);
  const syllables = tokens.reduce((total, word) => {
    const candidate = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    return total + Math.max(1, candidate.match(/[aeiouy]{1,2}/g)?.length ?? 1);
  }, 0);
  const grade = 0.39 * (tokens.length / sentences) + 11.8 * (syllables / Math.max(1, tokens.length)) - 15.59;
  return {
    grade: Math.max(0, Number(grade.toFixed(1))),
    averageSentenceWords: Number((tokens.length / sentences).toFixed(1)),
    wordCount: tokens.length,
  };
}

function shingles(body, size = 5) {
  const tokens = words(body);
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(" "));
  }
  return result;
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function aggregationVoiceMatches(body) {
  const pattern = /(?:^|[.!?]\s+)(?:other\s+|some\s+|many\s+|most\s+|a few\s+)?(?:reviews?|reviewers?|the evidence|evidence from|users?|customers?|sources?|reports?|complaints?|feedback)\b[^.!?\n]{0,48}\b(?:shows?|show|says?|say|finds?|found|praises?|praise|describes?|describe|reports?|report|suggests?|suggest|indicates?|indicate|points?|point|comes?|come|is|are|was|were|has|have)\b/gi;
  return body.match(pattern) ?? [];
}

export function validateEditorialDraft({ slug, body, data, reviewDirectory }) {
  const normalizedBody = body.trim();
  const headings = [...normalizedBody.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const headingFingerprint = headings.join(" | ").toLowerCase();
  const stockHeadingPatterns = [
    /^how\b.*\bworks\b/i,
    /^where\b/i,
    /^who should\b/i,
    /^who it(?:'s| is) for\b/i,
    /^what\b.*\bdoes\b/i,
    /^what users (?:like|dislike)\b/i,
    /^(?:the )?verdict\b/i,
    /^pricing(?: and value)?\b/i,
  ];
  const stockHeadingCount = headings.filter((heading) => stockHeadingPatterns.some((pattern) => pattern.test(heading))).length;
  const audiencePair = headings.some((heading) => /^who should (?:choose|use|buy)/i.test(heading))
    && headings.some((heading) => /^who should skip/i.test(heading));
  const genericTemplate = stockHeadingCount >= 3 || audiencePair;
  const opening = words(normalizedBody).slice(0, 180).join(" ");
  const fullText = words(normalizedBody).join(" ");
  const reading = readability(normalizedBody);
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const humanizerAudit = auditProse(normalizedBody);
  const aggregationCount = aggregationVoiceMatches(normalizedBody).length;

  const ownShingles = shingles(normalizedBody);
  let maximumSimilarity = 0;
  let mostSimilarSlug = null;
  for (const file of fs.readdirSync(reviewDirectory).filter((name) => name.endsWith(".mdx"))) {
    const candidateSlug = file.replace(/\.mdx$/, "");
    if (candidateSlug === slug) continue;
    const candidate = matter(fs.readFileSync(path.join(reviewDirectory, file), "utf8"));
    const similarity = jaccard(ownShingles, shingles(candidate.content));
    if (similarity > maximumSimilarity) {
      maximumSimilarity = similarity;
      mostSimilarSlug = candidateSlug;
    }
  }

  const checks = {
    structure: headings.length >= 3 && headings.length <= 8 && !genericTemplate,
    source_integrity: sources.length >= 6 && new Set(sources.map((source) => {
      try { return new URL(source.url).hostname.replace(/^www\./, ""); } catch { return ""; }
    }).filter(Boolean)).size >= 3,
    stance: /\b(recommend|worth|best|strong|weak|skip|avoid|only|unless|better|worse|fit)\b/.test(opening)
      && /\b(?:recommend|skip|our verdict)\b/i.test(normalizedBody)
      && !/\b(we (?:reviewed|researched|looked at|analyzed)|our research|in this review)\b/.test(opening),
    buyer_guidance: /\b(choose|buy|use|consider|good fit|best for)\b/.test(fullText)
      && /\b(skip|avoid|look elsewhere|not for|wrong fit|better off|unless)\b/.test(fullText),
    humanizer: humanizerAudit.passed
      && aggregationCount <= 2
      && !humanizerAudit.warnings.some((warning) => warning.code === "telegraphic_run"),
    similarity: maximumSimilarity < 0.18,
    readability: reading.wordCount >= 700 && reading.averageSentenceWords <= 18 && reading.grade <= 7.5,
    disclosure: data.reviewType === "research-based"
      && /\b(research|sources|not hands-on|not personally tested)\b/i.test(data.testingDisclosure ?? ""),
  };

  const passed = REQUIRED_VALIDATION_CHECKS.every((check) => checks[check] === true);
  return {
    passed,
    checks,
    metrics: {
      ...reading,
      h2Count: headings.length,
      sourceCount: sources.length,
      maximumSimilarity: Number(maximumSimilarity.toFixed(4)),
      mostSimilarSlug,
      humanizerAudit,
      stockHeadingCount,
      aggregationCount,
    },
    bodySha256: bodySha256(normalizedBody),
  };
}
