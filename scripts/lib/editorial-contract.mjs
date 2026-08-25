import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const EDITORIAL_STAGES = Object.freeze([
  "research_brief",
  "source_packet",
  "writer_notebook",
  "argument_card",
  "spoken_brief",
  "raw_draft",
  "copy_edit",
  "humanized_draft",
  "humanizer_report",
  "final_draft",
]);

export const REQUIRED_VALIDATION_CHECKS = Object.freeze([
  "structure",
  "source_integrity",
  "stance",
  "buyer_guidance",
  "humanizer",
  "similarity",
  "readability",
  "disclosure",
]);

export const EDITORIAL_VALIDATOR_VERSION = "editorial-contract-v2";

export const REVIEW_WRITER_FINGERPRINT_FILES = Object.freeze([
  ".agents/skills/digital-macaroni-review-writer/SKILL.md",
  ".agents/skills/digital-macaroni-review-writer/references/writer-notebook.md",
  ".agents/skills/digital-macaroni-review-writer/references/voice-examples.md",
  "humanizer-context.md",
  "research/ARTICLE_BRIEF.md",
]);

export const HUMANIZER_FINGERPRINT_FILES = Object.freeze([
  ".agents/skills/digital-macaroni-humanizer/SKILL.md",
  ".agents/skills/digital-macaroni-humanizer/references/ai-writing-patterns.md",
  ".agents/skills/digital-macaroni-humanizer/scripts/audit-prose.mjs",
  "humanizer-context.md",
]);

export const REWRITE_PIPELINE_FINGERPRINT_FILES = Object.freeze([
  "scripts/rewrite-existing-review-set.mjs",
  "scripts/editorial-pipeline.mjs",
  "scripts/lib/editorial-contract.mjs",
  "scripts/lib/editorial-validator.mjs",
  "scripts/lib/local-editorial-model.mjs",
  "scripts/lib/rewrite-checkpoints.mjs",
  "supabase/migrations/20260818054449_enforce_editorial_pipeline.sql",
  "supabase/migrations/20260818054906_close_product_insert_bypass.sql",
  "supabase/migrations/20260818055222_bind_editorial_stage_evidence.sql",
  "supabase/migrations/20260818055728_verify_research_and_validator_identity.sql",
  "supabase/migrations/20260818103110_allow_editorial_validator_v2.sql",
]);

export function canonicalBody(value) {
  return String(value).replace(/\r\n?/g, "\n").trim();
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function fileBundleSha256(root, relativePaths) {
  const hash = crypto.createHash("sha256");
  for (const relativePath of [...relativePaths].sort()) {
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) throw new Error(`Editorial contract file is missing: ${relativePath}.`);
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(fs.readFileSync(filePath));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

export function editorialSkillFingerprints(root) {
  return {
    reviewWriterSha256: fileBundleSha256(root, REVIEW_WRITER_FINGERPRINT_FILES),
    humanizerSha256: fileBundleSha256(root, HUMANIZER_FINGERPRINT_FILES),
  };
}

export function rewritePipelineFingerprint(root) {
  return fileBundleSha256(root, REWRITE_PIPELINE_FINGERPRINT_FILES);
}

export function bodySha256(value) {
  return sha256(canonicalBody(value));
}

export function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function assertCompleteValidationReport(report) {
  if (report?.passed !== true) throw new Error("Editorial validation did not pass.");
  for (const check of REQUIRED_VALIDATION_CHECKS) {
    if (report?.checks?.[check] !== true) {
      throw new Error(`Validation report is missing a passing ${check} check.`);
    }
  }
}

export function assertValidationForBody(report, body) {
  assertCompleteValidationReport(report);
  const expectedSha256 = bodySha256(body);
  if (report.bodySha256 !== expectedSha256) {
    throw new Error(`Editorial validation fingerprint ${report.bodySha256 ?? "missing"} does not match body ${expectedSha256}.`);
  }
}
