import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import { auditProse } from "../.agents/skills/digital-macaroni-humanizer/scripts/audit-prose.mjs";
import {
  EDITORIAL_STAGES,
  assertValidationForBody,
  bodySha256,
  canonicalBody,
  editorialSkillFingerprints,
  isSha256,
  rewritePipelineFingerprint,
  sha256,
} from "./lib/editorial-contract.mjs";
import { validateEditorialDraft } from "./lib/editorial-validator.mjs";
import { ollamaJson, stringObjectSchema } from "./lib/local-editorial-model.mjs";
import {
  markCheckpointComplete,
  nextCheckpointStage,
  openCheckpointRun,
  readCheckpoint,
  recordCheckpoint,
  recordStageFailure,
} from "./lib/rewrite-checkpoints.mjs";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");
const researchDirectory = path.join(root, "research");
const model = option("model") ?? process.env.REWRITE_MODEL ?? "qwen3:8b";
const only = option("only");
const limitOption = option("limit");
const limit = limitOption === undefined ? Number.POSITIVE_INFINITY : Number(limitOption);
const expectedCountOption = option("expected-count");
const expectedCount = expectedCountOption === undefined ? null : Number(expectedCountOption);
const shouldSync = flag("sync");
const maxAttempts = Number(option("attempts") ?? 4);
const runName = option("run-name") ?? "rewrite-enforced-v6";

const { reviewWriterSha256, humanizerSha256 } = editorialSkillFingerprints(root);
const pipelineSha256 = rewritePipelineFingerprint(root);

const systemPrompt = `You are writing a research-based Digital Macaroni software review. Write like an informed person explaining software to a friend. Take a clear editorial position. Use plain, connected English with ordinary articles and connective words. Separate verified facts, reported patterns, and editorial judgment. Never invent hands-on use, prices, features, customer stories, quotations, or certainty. Never imply that Digital Macaroni installed, watched, heard, or tested the product unless the evidence explicitly records that test. Do not narrate source counts or use the phrases "reviews show," "the evidence shows," or "in this review." Do not use em dashes or en dashes. Avoid analyst language, marketing copy, fake drama, rule-of-three lists, "not X, but Y," repeated contrasts, clipped maxim chains, and generic review templates. Use stable product terms instead of decorative synonyms. Article headings must express this product's specific argument; do not use stock headings beginning with How, Where, Who should, What users, Pricing, or Verdict. Return only the JSON shape requested.`;

function option(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, content);
  fs.renameSync(temporaryPath, filePath);
}

function publicationDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const normalized = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`Invalid publication date: ${normalized || "missing"}.`);
  return normalized;
}

function exactBodyMatch(left, right) {
  return Buffer.from(canonicalBody(left), "utf8").equals(Buffer.from(canonicalBody(right), "utf8"));
}

function wordCount(value) {
  return String(value).toLowerCase().match(/[a-z0-9']+/g)?.length ?? 0;
}

function shingles(value, size = 5) {
  const words = String(value).toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const result = new Set();
  for (let index = 0; index <= words.length - size; index += 1) result.add(words.slice(index, index + size).join(" "));
  return result;
}

function similarity(left, right) {
  const a = shingles(left);
  const b = shingles(right);
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function normalizeModelProse(value) {
  let normalized = canonicalBody(value).replace(/\s*[—–]\s*/g, ", ");
  const h2Count = (normalized.match(/^##\s+/gm) ?? []).length;
  const h3Count = (normalized.match(/^###\s+/gm) ?? []).length;
  if (h2Count === 0 && h3Count >= 3 && h3Count <= 6) normalized = normalized.replace(/^###\s+/gm, "## ");
  return normalized;
}

function normalizeBodyProse(value) {
  const normalized = normalizeModelProse(value);
  if ((normalized.match(/^##\s+/gm) ?? []).length > 0) return normalized;
  const paragraphs = normalized.split(/\n\s*\n/);
  let promoted = 0;
  const repaired = paragraphs.map((paragraph, index) => {
    if (index === 0) return paragraph;
    const match = paragraph.match(/^([^.!?\n]{12,100}[.!?])\s+([\s\S]+)$/);
    if (!match) return paragraph;
    const headingWords = wordCount(match[1]);
    if (headingWords < 3 || headingWords > 12 || wordCount(match[2]) < 35) return paragraph;
    promoted += 1;
    return `## ${match[1].replace(/[.!?]+$/, "")}\n\n${match[2]}`;
  });
  return promoted >= 3 && promoted <= 6 ? repaired.join("\n\n") : normalized;
}

function compactEvidence(parsed, evidence) {
  return {
    product: {
      company: parsed.data.company,
      category: parsed.data.category,
      score: parsed.data.score,
      scoreBreakdown: parsed.data.scores,
      testingDisclosure: parsed.data.testingDisclosure,
    },
    testing: {
      accessedProduct: evidence.testing?.accessedProduct,
      tasksAttempted: evidence.testing?.tasksAttempted,
      limitations: evidence.testing?.limitations,
    },
    sources: (evidence.sources ?? []).map((source) => ({
      id: source.id,
      name: source.name,
      type: source.sourceType,
      sampled: source.reviewCountSampled,
      themes: source.keyThemes,
    })),
    claims: evidence.claims,
    scoreRationale: evidence.scoreRationale,
    conflictsAndUnknowns: evidence.conflictsAndUnknowns,
  };
}

function validateEvidencePacket(slug, evidence) {
  const sources = Array.isArray(evidence.sources) ? evidence.sources : [];
  const independentPlatforms = new Set(sources
    .filter((source) => source.sourceType === "independent-review-platform")
    .map((source) => {
      try { return new URL(source.url).hostname.replace(/^www\./, ""); } catch { return source.name; }
    }));
  const communitySources = sources.filter((source) => source.sourceType === "community");
  const sampledVoices = sources
    .filter((source) => ["independent-review-platform", "community"].includes(source.sourceType))
    .reduce((total, source) => total + (Number(source.reviewCountSampled) || 0), 0);
  if (sources.length < 6) throw new Error(`${slug} has fewer than six recorded sources.`);
  if (!sources.some((source) => source.sourceType === "official")) throw new Error(`${slug} has no official source.`);
  if (independentPlatforms.size < 2) throw new Error(`${slug} has fewer than two independent review platforms.`);
  if (communitySources.length < 1) throw new Error(`${slug} has no community source.`);
  if (sampledVoices < 20) throw new Error(`${slug} has fewer than twenty sampled user voices.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.releaseDate?.date ?? "")) throw new Error(`${slug} has no verified release date.`);
  if ((evidence.claims?.length ?? 0) < 3) throw new Error(`${slug} has fewer than three recorded claims.`);
}

function researchBrief(slug, parsed, evidence) {
  const limits = evidence.testing?.limitations ?? evidence.conflictsAndUnknowns ?? [];
  return `# ${parsed.data.company} research brief\n\n- Existing published review rewrite\n- Slug: ${slug}\n- Publication date preserved: ${parsed.data.date}\n- Review type: ${parsed.data.reviewType}\n- Product test performed: ${Boolean(evidence.testing?.accessedProduct)}\n- Recorded sources: ${evidence.sources?.length ?? 0}\n- Recorded claims: ${evidence.claims?.length ?? 0}\n\n## Evidence limits\n\n${limits.map((item) => `- ${item}`).join("\n")}`;
}

function sourcePacket(parsed, evidence) {
  const sources = (evidence.sources ?? []).map((source, index) => `${index + 1}. ${source.name}\n   - URL: ${source.url}\n   - Accessed: ${source.accessed}\n   - Type: ${source.sourceType}\n   - Themes: ${(source.keyThemes ?? []).join(", ")}`).join("\n");
  const claims = (evidence.claims ?? []).map((claim) => `- ${claim.statement} [${claim.status}; ${claim.kind}; ${(claim.sourceIds ?? []).join(", ")}]`).join("\n");
  return `# ${parsed.data.company} source packet\n\n## Sources\n\n${sources}\n\n## Claims\n\n${claims}`;
}

function validatePlanningArtifact(stage, content) {
  const normalized = normalizeModelProse(content);
  const minimums = { writer_notebook: 100, argument_card: 55, spoken_brief: 100 };
  if (wordCount(normalized) < minimums[stage]) throw new Error(`${stage} is too thin (${wordCount(normalized)} words).`);
  if (stage === "writer_notebook" && !/buyer|reader/i.test(normalized)) throw new Error("Writer notebook does not identify the buyer or reader.");
  if (stage === "argument_card" && !/thesis|judgment|recommend|decision/i.test(normalized)) throw new Error("Argument card has no editorial thesis or decision.");
  if (stage === "spoken_brief" && !/choose|use|buy|skip|avoid|worth|recommend/i.test(normalized)) throw new Error("Spoken brief has no buyer decision.");
  return normalized;
}

function validateBodyArtifact(stage, content, minimumWords) {
  const body = normalizeBodyProse(content);
  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);
  if (body.startsWith("---")) throw new Error(`${stage} contains frontmatter.`);
  if (/—|–/.test(body)) throw new Error(`${stage} contains an em dash or en dash.`);
  if (wordCount(body) < minimumWords) throw new Error(`${stage} is too short (${wordCount(body)} words).`);
  if (headings.length < 3 || headings.length > 6) throw new Error(`${stage} must contain three to six H2 headings.`);
  if (/\b(?:we|i) (?:used|tested|installed|tried|watched|heard)\b/i.test(body)) throw new Error(`${stage} invents or implies first-person product use.`);
  return body;
}

function validateVerdict(verdict) {
  const words = verdict.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (words.length < 8 || words.length > 9 || verdict.length > 64) throw new Error("Verdict must contain eight or nine words and no more than 64 characters.");
}

async function generateStage({ stage, runDirectory, manifest, prompt, schema, validate, metadata = {}, numPredict = 2_400 }) {
  if (manifest.stages[stage]) return readCheckpoint(runDirectory, manifest, stage);
  let feedback = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let candidate = null;
    try {
      const result = await ollamaJson({
        model,
        system: systemPrompt,
        prompt: `${prompt}${feedback ? `\n\nThe previous attempt failed this stage's gate. Correct these exact problems:\n${feedback}` : ""}`,
        schema,
        numPredict,
      });
      candidate = result;
      const accepted = validate(result);
      const content = typeof accepted === "string" ? accepted : accepted.content;
      const acceptedMetadata = typeof accepted === "string" ? {} : accepted.metadata;
      recordCheckpoint(runDirectory, manifest, stage, content, { ...metadata, ...acceptedMetadata, model, attempt });
      return content;
    } catch (error) {
      feedback = error.message;
      const candidateText = typeof candidate === "string" ? candidate : JSON.stringify(candidate, null, 2);
      recordStageFailure(runDirectory, manifest, stage, attempt, error, candidateText);
      if (attempt === maxAttempts) throw new Error(`${stage} failed after ${maxAttempts} attempts: ${feedback}`);
    }
  }
  throw new Error(`${stage} failed.`);
}

function frontmatterFromManifest(parsed, manifest) {
  const metadata = manifest.stages.copy_edit?.metadata ?? {};
  return {
    ...parsed.data,
    title: metadata.title,
    description: metadata.description,
    verdict: metadata.verdict,
    cardVerdict: metadata.verdict,
    status: "draft",
  };
}

function runCommand(args) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/editorial-pipeline.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Command failed: ${args.join(" ")}`);
  return result.stdout.trim();
}

function supabaseQuery(sql) {
  const result = spawnSync("supabase", ["db", "query", "--linked", sql], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Supabase query failed.");
  return JSON.parse(result.stdout).rows ?? [];
}

function syncCheckpointRun(slug, runDirectory, manifest) {
  const receipt = supabaseQuery(`
    select j.id as research_job_id,
      count(s.id) filter (where s.excerpt is not null and length(btrim(s.excerpt)) >= 20) as source_count,
      count(s.id) filter (where s.source_type <> 'official' and s.excerpt is not null and length(btrim(s.excerpt)) >= 20) as independent_source_count
    from public.products p
    join public.research_jobs j on j.product_id = p.id and j.status = 'approved'
    left join public.research_sources s on s.product_id = p.id
    where p.slug = '${slug.replaceAll("'", "''")}'
    group by j.id, j.completed_at
    order by j.completed_at desc nulls last, j.id desc
    limit 1;
  `)[0];
  if (!receipt || Number(receipt.source_count) < 6 || Number(receipt.independent_source_count) < 3) {
    throw new Error(`${slug} has no approved excerpt-backed Supabase research receipt.`);
  }

  const openRun = supabaseQuery(`
    select r.id, r.status, r.publication_date::text, r.review_writer_sha256, r.humanizer_sha256,
      coalesce(
        json_agg(json_build_object('stage', a.stage, 'sha256', a.content_sha256) order by private.editorial_stage_position(a.stage))
          filter (where a.id is not null),
        '[]'::json
      ) as artifacts
    from private.editorial_runs r
    left join private.editorial_artifacts a on a.run_id = r.id
    where r.slug = '${slug.replaceAll("'", "''")}' and r.status not in ('published', 'blocked')
    group by r.id
    order by r.id desc limit 1;
  `)[0];
  if (openRun) {
    const remoteArtifacts = typeof openRun.artifacts === "string" ? JSON.parse(openRun.artifacts) : openRun.artifacts;
    const identityMatches = openRun.publication_date === manifest.publicationDate
      && openRun.review_writer_sha256 === manifest.reviewWriterSha256
      && openRun.humanizer_sha256 === manifest.humanizerSha256;
    const artifactPrefixMatches = remoteArtifacts.every((artifact) => manifest.stages[artifact.stage]?.sha256 === artifact.sha256);
    if (!identityMatches || !artifactPrefixMatches) {
      runCommand(["reject", slug, "--reason=Replaced by a completed enforced rewrite whose immutable artifacts or skill fingerprints differ."]);
    }
  }

  runCommand(["ensure", slug]);
  const stageFlags = {
    research_brief: [
      `--research-job-id=${receipt.research_job_id}`,
      `--source-count=${receipt.source_count}`,
      `--independent-source-count=${receipt.independent_source_count}`,
    ],
    humanizer_report: ["--passed"],
  };
  for (const stage of EDITORIAL_STAGES.filter((candidate) => manifest.stages[candidate])) {
    runCommand(["record", slug, stage, path.join(runDirectory, manifest.stages[stage].file), ...(stageFlags[stage] ?? [])]);
  }
}

async function rewrite(slug) {
  const filePath = path.join(reviewDirectory, `${slug}.mdx`);
  const evidencePath = path.join(researchDirectory, slug, "evidence.json");
  if (!fs.existsSync(evidencePath)) throw new Error(`${slug} has no evidence packet.`);
  const source = fs.readFileSync(filePath, "utf8");
  const parsed = matter(source);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  validateEvidencePacket(slug, evidence);
  validateVerdict(parsed.data.verdict);
  if (parsed.data.cardVerdict !== parsed.data.verdict) throw new Error(`${slug} does not have identical existing verdict and card verdict metadata.`);
  const preservedPublicationDate = publicationDate(parsed.data.date);
  if (preservedPublicationDate < evidence.releaseDate.date) {
    throw new Error(`${slug} publication date predates its verified product release date.`);
  }
  const evidenceSha256 = sha256(fs.readFileSync(evidencePath, "utf8"));

  const runDirectory = path.join(researchDirectory, slug, runName);
  const manifest = openCheckpointRun({
    runDirectory,
    slug,
    model,
    sourceBodySha256: bodySha256(parsed.content),
    evidenceSha256,
    pipelineSha256,
    publicationDate: preservedPublicationDate,
    reviewWriterSha256,
    humanizerSha256,
  });
  if (manifest.status === "complete") {
    const finalBody = readCheckpoint(runDirectory, manifest, "final_draft");
    assertValidationForBody(manifest.validation, finalBody);
    if (!exactBodyMatch(parsed.content, finalBody)) throw new Error(`${slug} article body changed after its completed exact-body checkpoint.`);
    if (publicationDate(parsed.data.date) !== manifest.publicationDate) throw new Error(`${slug} publication date changed after its completed checkpoint.`);
    if (shouldSync) syncCheckpointRun(slug, runDirectory, manifest);
    return manifest.validation;
  }

  if (!manifest.stages.research_brief) recordCheckpoint(runDirectory, manifest, "research_brief", researchBrief(slug, parsed, evidence), { generated: "deterministic" });
  if (!manifest.stages.source_packet) recordCheckpoint(runDirectory, manifest, "source_packet", sourcePacket(parsed, evidence), { generated: "deterministic" });
  const evidenceText = JSON.stringify(compactEvidence(parsed, evidence), null, 2);

  const notebook = await generateStage({
    stage: "writer_notebook",
    runDirectory,
    manifest,
    schema: stringObjectSchema(["content"]),
    prompt: `Build the private writer's notebook for ${parsed.data.company}. Include research scope, reader and job, product facts, experience records without invented fields, repeated patterns, feature translations, conflict ledger, missing evidence, and a spoken-language bank. Keep facts, reports, and editorial judgment separate. Aim for 300 to 600 words.\n\nEvidence:\n${evidenceText}`,
    metadata: { reviewWriterSha256 },
    validate: (result) => {
      return validatePlanningArtifact("writer_notebook", result.content);
    },
  });

  const argument = await generateStage({
    stage: "argument_card",
    runDirectory,
    manifest,
    schema: stringObjectSchema(["content"]),
    prompt: `Write the private argument card for ${parsed.data.company}. Include the buyer, job, thesis, reason to buy, reason to hesitate, decision rule, and evidence limit. Make a firm, defensible editorial choice in 120 to 220 words. Do not write article prose.\n\nWriter's notebook:\n${notebook}`,
    validate: (result) => {
      return validatePlanningArtifact("argument_card", result.content);
    },
    numPredict: 1_000,
  });

  const spoken = await generateStage({
    stage: "spoken_brief",
    runDirectory,
    manifest,
    schema: stringObjectSchema(["content"]),
    prompt: `Explain the ${parsed.data.company} recommendation aloud in 180 to 320 words. Say what it is in ordinary language, who benefits, what its main feature lets them do, whether it is good enough, when it does not matter, which recorded customer outcomes changed the opinion, and what a friend should check before paying. Do not mention research methods.\n\nArgument card:\n${argument}\n\nEvidence:\n${evidenceText}`,
    validate: (result) => {
      return validatePlanningArtifact("spoken_brief", result.content);
    },
    numPredict: 1_200,
  });

  const raw = await generateStage({
    stage: "raw_draft",
    runDirectory,
    manifest,
    schema: stringObjectSchema(["body"]),
    prompt: `Draft a completely new ${parsed.data.company} review from the spoken brief and evidence. Write 700 to 950 words with three to five product-specific H2 headings. Open with the answer and central tradeoff. Let the argument develop instead of resetting in each section. Put buyer exclusions inside the relevant reasoning instead of using paired fit/skip sections. Do not include frontmatter or a source list. Do not reuse an earlier article's outline, headings, opening, or phrasing.\n\nSpoken brief:\n${spoken}\n\nEvidence:\n${evidenceText}`,
    validate: (result) => validateBodyArtifact("raw_draft", result.body, 700),
    numPredict: 2_200,
  });

  const copy = await generateStage({
    stage: "copy_edit",
    runDirectory,
    manifest,
    schema: stringObjectSchema(["title", "description", "body"]),
    prompt: `Copy-edit this ${parsed.data.company} draft. Fix factual overstatement, paragraph order, grammar, missing articles and connective words, generic headings, repetition, clipped rhythm, and unsupported implications. Preserve the clear recommendation. Return a natural review title, a one-sentence description, and a 700 to 1,000 word body. The existing compliant verdict metadata will be preserved separately. The body must be a real edit, not an unchanged copy.\n\nEvidence:\n${evidenceText}\n\nRaw draft:\n${raw}`,
    validate: (result) => {
      if (!result.title.trim() || !result.description.trim()) throw new Error("Title and description are required.");
      const body = validateBodyArtifact("copy_edit", result.body, 700);
      if (bodySha256(body) === bodySha256(raw) || similarity(body, raw) > 0.97) throw new Error("Copy edit did not materially edit the raw draft.");
      return { content: body, metadata: { title: result.title.trim(), description: result.description.trim(), verdict: parsed.data.verdict } };
    },
    numPredict: 2_400,
  });

  const proposedData = frontmatterFromManifest(parsed, manifest);
  let humanizedResult = null;
  let humanizedValidation = null;
  if (!manifest.stages.humanized_draft) {
    let feedback = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let candidate = null;
      try {
        candidate = await ollamaJson({
          model,
          system: systemPrompt,
          prompt: `Humanize this copy-edited ${parsed.data.company} review without changing supported facts or weakening its recommendation. Keep the final body between 700 and 1,000 words. Restore ordinary syntax and necessary small words. Break repeated paragraph choreography, repeated contrasts, telegraphic sentence runs, stock headings, and neat miniature conclusions. Preserve honest uncertainty. Return the final body and a specific 80- to 160-word report describing paragraph-level changes, any retained warnings and why, and confirmation that no experience was invented.\n\nEvidence:\n${evidenceText}\n\nCopy-edited draft:\n${copy}${feedback ? `\n\nThe previous candidate failed. Correct every reported problem:\n${feedback}` : ""}`,
          schema: stringObjectSchema(["body", "report"]),
          numPredict: 4_500,
        });
        const body = validateBodyArtifact("humanized_draft", candidate.body, 700);
        if (bodySha256(body) === bodySha256(copy)) throw new Error("Humanizer returned the unchanged copy edit.");
        const report = validateEditorialDraft({ slug, body, data: proposedData, reviewDirectory });
        const oldBodySimilarity = similarity(parsed.content, body);
        if (!report.passed || oldBodySimilarity >= 0.22) {
          throw new Error(JSON.stringify({ checks: report.checks, metrics: report.metrics, oldBodySimilarity }, null, 2));
        }
        if (wordCount(candidate.report) < 55 || !/no experience|experience was not|did not invent/i.test(candidate.report)) {
          throw new Error("Humanizer report must explain its edits and confirm that no experience was invented.");
        }
        humanizedResult = candidate;
        humanizedValidation = { ...report, oldBodySimilarity: Number(oldBodySimilarity.toFixed(4)), model };
        const acceptedHumanizerReport = canonicalBody(candidate.report);
        const acceptedHumanizerReportSha256 = sha256(acceptedHumanizerReport);
        atomicWrite(path.join(runDirectory, "attempts", "accepted-humanizer-report.md"), `${acceptedHumanizerReport}\n`);
        recordCheckpoint(runDirectory, manifest, "humanized_draft", body, {
          model,
          attempt,
          copyEditSha256: bodySha256(copy),
          humanizerSha256,
          reportSha256: acceptedHumanizerReportSha256,
        });
        break;
      } catch (error) {
        feedback = error.message;
        recordStageFailure(runDirectory, manifest, "humanized_draft", attempt, error, JSON.stringify(candidate, null, 2));
        if (attempt === maxAttempts) throw new Error(`humanized_draft failed after ${maxAttempts} attempts: ${feedback}`);
      }
    }
  }

  const humanized = readCheckpoint(runDirectory, manifest, "humanized_draft");
  if (!humanizedValidation) {
    const report = validateEditorialDraft({ slug, body: humanized, data: proposedData, reviewDirectory });
    const oldBodySimilarity = similarity(parsed.content, humanized);
    if (!report.passed || oldBodySimilarity >= 0.22) throw new Error("A completed Humanizer checkpoint no longer passes the current validator. Start a new run directory.");
    humanizedValidation = { ...report, oldBodySimilarity: Number(oldBodySimilarity.toFixed(4)), model };
  }

  if (!manifest.stages.humanizer_report) {
    const audit = auditProse(humanized);
    const acceptedReportPath = path.join(runDirectory, "attempts", "accepted-humanizer-report.md");
    const editorialReport = humanizedResult?.report
      ?? (fs.existsSync(acceptedReportPath) ? fs.readFileSync(acceptedReportPath, "utf8") : null);
    if (!editorialReport || wordCount(editorialReport) < 55 || !/no experience|experience was not|did not invent/i.test(editorialReport)) {
      throw new Error("The accepted Humanizer report sidecar is missing or incomplete; the exact-body stage will not advance.");
    }
    const acceptedReportSha256 = sha256(canonicalBody(editorialReport));
    if (!isSha256(manifest.stages.humanized_draft.metadata.reportSha256)
        || acceptedReportSha256 !== manifest.stages.humanized_draft.metadata.reportSha256) {
      throw new Error("The accepted Humanizer report sidecar does not match the immutable Humanizer draft receipt.");
    }
    const reportBody = `${canonicalBody(editorialReport)}\n\n## Exact-body audit\n\n- Body SHA-256: ${bodySha256(humanized)}\n- Humanizer skill SHA-256: ${humanizerSha256}\n- Passed: ${humanizedValidation.checks.humanizer}\n- Audit: \`${JSON.stringify(audit)}\``;
    if (audit.passed !== true || audit.sha256 !== bodySha256(humanized)) throw new Error("Humanizer did not pass an audit of the exact accepted body.");
    recordCheckpoint(runDirectory, manifest, "humanizer_report", reportBody, {
      model,
      passed: true,
      bodySha256: bodySha256(humanized),
      humanizerSha256,
      reportSha256: acceptedReportSha256,
    });
  }
  if (!manifest.stages.final_draft) recordCheckpoint(runDirectory, manifest, "final_draft", humanized, { exactHumanizedDraft: true });
  const finalBody = readCheckpoint(runDirectory, manifest, "final_draft");
  if (!exactBodyMatch(finalBody, humanized)) throw new Error("Final draft differs byte-for-byte from the exact Humanizer-reviewed body.");
  assertValidationForBody(humanizedValidation, finalBody);

  atomicWrite(path.join(runDirectory, "validation.json"), `${JSON.stringify(humanizedValidation, null, 2)}\n`);
  const rewrittenSource = matter.stringify(`${canonicalBody(finalBody)}\n`, proposedData);
  const rewritten = matter(rewrittenSource);
  if (!exactBodyMatch(rewritten.content, finalBody)) throw new Error("Serialized article body does not match the approved Humanizer output.");
  if (publicationDate(rewritten.data.date) !== preservedPublicationDate) throw new Error("Serialized article changed the preserved publication date.");
  atomicWrite(filePath, rewrittenSource);
  const written = matter(fs.readFileSync(filePath, "utf8"));
  if (!exactBodyMatch(written.content, finalBody)) throw new Error("Written article body does not match the approved Humanizer output.");
  if (publicationDate(written.data.date) !== preservedPublicationDate) throw new Error("Written article changed the preserved publication date.");
  markCheckpointComplete(runDirectory, manifest, humanizedValidation);
  if (shouldSync) syncCheckpointRun(slug, runDirectory, manifest);
  return humanizedValidation;
}

if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) throw new Error("--attempts must be an integer from 1 to 8.");
if (limitOption !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit must be a positive integer.");
if (expectedCountOption !== undefined && (!Number.isInteger(expectedCount) || expectedCount < 1)) throw new Error("--expected-count must be a positive integer.");

const existingSlugs = fs.readdirSync(reviewDirectory)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.replace(/\.mdx$/, ""))
  .sort();
if (expectedCount !== null && existingSlugs.length !== expectedCount) {
  throw new Error(`Existing-review set contains ${existingSlugs.length} articles; expected ${expectedCount}.`);
}
const publicationDates = Object.fromEntries(existingSlugs.map((slug) => {
  const parsed = matter(fs.readFileSync(path.join(reviewDirectory, `${slug}.mdx`), "utf8"));
  return [slug, publicationDate(parsed.data.date)];
}));
const setManifestPath = path.join(researchDirectory, `${runName}-set.json`);
if (fs.existsSync(setManifestPath)) {
  const setManifest = JSON.parse(fs.readFileSync(setManifestPath, "utf8"));
  if (setManifest.checkpointVersion !== 4
      || setManifest.runName !== runName
      || setManifest.pipelineSha256 !== pipelineSha256
      || !exactBodyMatch(JSON.stringify(setManifest.slugs), JSON.stringify(existingSlugs))
      || !exactBodyMatch(JSON.stringify(setManifest.publicationDates), JSON.stringify(publicationDates))) {
    throw new Error(`Existing-review set identity changed. Refusing to expand or alter ${runName}.`);
  }
} else {
  atomicWrite(setManifestPath, `${JSON.stringify({
    checkpointVersion: 4,
    runName,
    pipelineSha256,
    articleCount: existingSlugs.length,
    slugs: existingSlugs,
    publicationDates,
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`);
}

const slugs = existingSlugs
  .filter((slug) => !only || slug === only)
  .slice(0, limit);
if (only && slugs.length !== 1) throw new Error(`Existing review not found: ${only}.`);

console.log(`Enforced rewrite pipeline: ${slugs.length} existing reviews, model ${model}, sync ${shouldSync ? "on" : "off"}.`);
const results = [];
const failures = [];
for (const [index, slug] of slugs.entries()) {
  try {
    const validation = await rewrite(slug);
    results.push({ slug, bodySha256: validation.bodySha256, wordCount: validation.metrics.wordCount, grade: validation.metrics.grade });
    console.log(`[${index + 1}/${slugs.length}] ${slug}: complete (${validation.metrics.wordCount} words, grade ${validation.metrics.grade}).`);
  } catch (error) {
    failures.push({ slug, error: error.message });
    console.error(`[${index + 1}/${slugs.length}] ${slug}: blocked (${error.message}).`);
  }
}

const batchManifest = { checkpointVersion: 4, pipelineSha256, model, sync: shouldSync, results, failures, updatedAt: new Date().toISOString() };
atomicWrite(path.join(researchDirectory, `${runName}-batch.json`), `${JSON.stringify(batchManifest, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
