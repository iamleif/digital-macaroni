import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

function bodyOnly(source) {
  const normalized = String(source).replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 4);
  return end === -1 ? normalized : normalized.slice(end + 5).trim();
}

function proseOnly(source) {
  return bodyOnly(source)
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/^>.*$/gm, "")
    .replace(/`[^`]+`/g, "")
    .trim();
}

function sentences(paragraph) {
  return paragraph.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function words(value) {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

export function auditProse(source) {
  const body = bodyOnly(source);
  const prose = proseOnly(source);
  const paragraphs = prose.split(/\n\s*\n/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const allWords = words(prose);
  const failures = [];
  const warnings = [];

  const compressedValue = /\b(?:is|are|was|were)\s+not\s+(?:broadly|generally|particularly|especially)\s+(?:good|bad|strong|poor)\s+value\b/i;
  if (compressedValue.test(prose)) {
    failures.push({ code: "missing_article", message: "A compressed value judgment is missing a natural article, such as 'a good value'." });
  }

  const stagedMeta = /\b(?:feature parity is not the standard here|the decision is simple|this is where (?:the )?(?:promise|product|idea) becomes|that distinction matters)\b/i;
  if (stagedMeta.test(prose)) {
    failures.push({ code: "editorial_stage_direction", message: "The draft contains an abstract sentence that directs interpretation instead of adding evidence." });
  }

  paragraphs.forEach((paragraph, index) => {
    const contrastHits = paragraph.match(/\b(?:not|but|however|still|either|instead|rather than)\b/gi) ?? [];
    if (contrastHits.length >= 4) {
      failures.push({
        code: "concession_chain",
        paragraph: index + 1,
        message: `Paragraph ${index + 1} contains ${contrastHits.length} contrast markers and reads mechanically balanced.`,
      });
    }

    if (/\bshould not\b[^.?!]*[.?!]\s*(?:they|it|this|that)\s+should not\b/i.test(paragraph)) {
      failures.push({ code: "paired_negation", paragraph: index + 1, message: `Paragraph ${index + 1} uses consecutive 'should not' constructions.` });
    }

    const paragraphSentences = sentences(paragraph);
    const shortRun = paragraphSentences.reduce((best, sentence) => {
      const length = words(sentence).length;
      const current = length <= 8 ? best.current + 1 : 0;
      return { current, maximum: Math.max(best.maximum, current) };
    }, { current: 0, maximum: 0 }).maximum;
    if (shortRun >= 3) {
      warnings.push({ code: "telegraphic_run", paragraph: index + 1, message: `Paragraph ${index + 1} has ${shortRun} consecutive very short sentences.` });
    }
  });

  const articleCount = allWords.filter((word) => ["a", "an", "the"].includes(word)).length;
  const articleRate = allWords.length ? articleCount / allWords.length : 0;
  if (allWords.length >= 300 && articleRate < 0.045) {
    warnings.push({ code: "low_article_rate", message: `Article-word rate is ${(articleRate * 100).toFixed(1)}%; read aloud for missing connective words.` });
  }

  const paragraphSentenceCounts = paragraphs.map((paragraph) => sentences(paragraph).length).filter((count) => count > 0);
  if (paragraphSentenceCounts.length >= 8) {
    const frequency = new Map();
    for (const count of paragraphSentenceCounts) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    const dominant = Math.max(...frequency.values());
    if (dominant / paragraphSentenceCounts.length >= 0.6) {
      warnings.push({ code: "uniform_paragraph_shape", message: "Most paragraphs contain the same number of sentences." });
    }
  }

  const negativeParallelisms = prose.match(/\bnot\s+(?:only|just|merely)\b|\bnot\b[^.!?]{0,80}\bbut\b/gi) ?? [];
  if (negativeParallelisms.length >= 3) {
    failures.push({ code: "negative_parallelism_density", message: `The draft uses ${negativeParallelisms.length} explicit negative parallelisms.` });
  }

  return {
    passed: failures.length === 0,
    sha256: crypto.createHash("sha256").update(body, "utf8").digest("hex"),
    metrics: {
      words: allWords.length,
      paragraphs: paragraphs.length,
      articleWordRate: Number(articleRate.toFixed(4)),
      negativeParallelisms: negativeParallelisms.length,
    },
    failures,
    warnings,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node audit-prose.mjs <draft-file>");
    process.exit(2);
  }
  const report = auditProse(fs.readFileSync(file, "utf8"));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
