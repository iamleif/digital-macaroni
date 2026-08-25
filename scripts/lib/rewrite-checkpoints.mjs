import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  EDITORIAL_STAGES,
  assertValidationForBody,
  canonicalBody,
  isSha256,
  sha256,
} from "./editorial-contract.mjs";

export const CHECKPOINT_VERSION = 4;

export const STAGE_FILES = Object.freeze({
  research_brief: "01-research-brief.md",
  source_packet: "02-source-packet.md",
  writer_notebook: "03-writer-notebook.md",
  argument_card: "04-argument-card.md",
  spoken_brief: "05-spoken-brief.md",
  raw_draft: "06-raw-draft.md",
  copy_edit: "07-copy-edit.md",
  humanized_draft: "08-humanized-draft.md",
  humanizer_report: "09-humanizer-report.md",
  final_draft: "10-final-draft.md",
});

function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, content);
  fs.renameSync(temporaryPath, filePath);
}

function manifestPath(runDirectory) {
  return path.join(runDirectory, "manifest.json");
}

export function saveManifest(runDirectory, manifest) {
  manifest.updatedAt = new Date().toISOString();
  atomicWrite(manifestPath(runDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function openCheckpointRun({
  runDirectory,
  slug,
  model,
  sourceBodySha256,
  evidenceSha256,
  pipelineSha256,
  publicationDate,
  reviewWriterSha256,
  humanizerSha256,
}) {
  for (const [name, value] of Object.entries({ sourceBodySha256, evidenceSha256, pipelineSha256, reviewWriterSha256, humanizerSha256 })) {
    if (!isSha256(value)) throw new Error(`Checkpoint identity ${name} must be a SHA-256 fingerprint.`);
  }
  if (!slug || !model || !publicationDate) throw new Error("Checkpoint identity requires slug, model, and publication date.");
  fs.mkdirSync(runDirectory, { recursive: true });
  fs.mkdirSync(path.join(runDirectory, "attempts"), { recursive: true });
  const filePath = manifestPath(runDirectory);
  if (fs.existsSync(filePath)) {
    const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (manifest.checkpointVersion !== CHECKPOINT_VERSION) {
      throw new Error(`Checkpoint version ${manifest.checkpointVersion ?? "missing"} cannot resume as version ${CHECKPOINT_VERSION}. Start a new run directory.`);
    }
    const identity = { slug, model, sourceBodySha256, evidenceSha256, pipelineSha256, publicationDate, reviewWriterSha256, humanizerSha256 };
    for (const [key, expected] of Object.entries(identity)) {
      if (key === "sourceBodySha256"
          && manifest.sourceBodySha256 !== expected
          && manifest.stages?.final_draft?.sha256 === expected) {
        continue;
      }
      if (manifest[key] !== expected) throw new Error(`Checkpoint identity changed for ${slug}: ${key}. Start a new run directory.`);
    }
    verifyCheckpointRun(runDirectory, manifest);
    return manifest;
  }

  const manifest = {
    checkpointVersion: CHECKPOINT_VERSION,
    slug,
    model,
    sourceBodySha256,
    publicationDate,
    reviewWriterSha256,
    humanizerSha256,
    evidenceSha256,
    pipelineSha256,
    status: "running",
    stages: {},
    failures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveManifest(runDirectory, manifest);
  return manifest;
}

export function verifyCheckpointRun(runDirectory, manifest) {
  if (manifest.checkpointVersion !== CHECKPOINT_VERSION) throw new Error(`Unsupported checkpoint version ${manifest.checkpointVersion ?? "missing"}.`);
  if (!['running', 'complete'].includes(manifest.status)) throw new Error(`Checkpoint has invalid status ${manifest.status ?? "missing"}.`);
  const unknownStages = Object.keys(manifest.stages ?? {}).filter((stage) => !EDITORIAL_STAGES.includes(stage));
  if (unknownStages.length) throw new Error(`Checkpoint contains unknown stages: ${unknownStages.join(", ")}.`);
  let predecessorSha256 = null;
  let gapFound = false;
  for (const stage of EDITORIAL_STAGES) {
    const receipt = manifest.stages?.[stage];
    if (!receipt) {
      gapFound = true;
      continue;
    }
    if (gapFound) throw new Error(`Checkpoint ${stage} exists after a missing predecessor.`);
    const expectedFile = STAGE_FILES[stage];
    if (receipt.file !== expectedFile) throw new Error(`Checkpoint ${stage} uses an unexpected file.`);
    const artifactPath = path.join(runDirectory, expectedFile);
    if (!fs.existsSync(artifactPath)) throw new Error(`Checkpoint file is missing: ${expectedFile}.`);
    const content = canonicalBody(fs.readFileSync(artifactPath, "utf8"));
    const contentSha256 = sha256(content);
    if (receipt.sha256 !== contentSha256) throw new Error(`Checkpoint hash mismatch for ${stage}.`);
    if ((receipt.predecessorSha256 ?? null) !== predecessorSha256) throw new Error(`Checkpoint predecessor mismatch for ${stage}.`);
    if (!receipt.metadata || typeof receipt.metadata !== "object" || Array.isArray(receipt.metadata)) {
      throw new Error(`Checkpoint ${stage} has invalid metadata.`);
    }
    if (["writer_notebook", "argument_card", "spoken_brief", "raw_draft", "copy_edit", "humanized_draft", "humanizer_report"].includes(stage)
        && receipt.metadata.model !== manifest.model) {
      throw new Error(`Checkpoint ${stage} does not match the run model.`);
    }
    if (stage === "writer_notebook" && receipt.metadata.reviewWriterSha256 !== manifest.reviewWriterSha256) {
      throw new Error("Writer notebook does not match the run writer fingerprint.");
    }
    if (stage === "copy_edit"
        && (![receipt.metadata.title, receipt.metadata.description, receipt.metadata.verdict].every((value) => typeof value === "string" && value.trim()))) {
      throw new Error("Copy edit is missing its accepted title, description, or verdict metadata.");
    }
    if (["humanized_draft", "humanizer_report"].includes(stage)
        && receipt.metadata.humanizerSha256 !== manifest.humanizerSha256) {
      throw new Error(`Checkpoint ${stage} does not match the run Humanizer fingerprint.`);
    }
    if (stage === "humanized_draft" && !isSha256(receipt.metadata.reportSha256)) {
      throw new Error("Humanizer draft is not bound to its accepted editorial report.");
    }
    if (stage === "humanized_draft" && receipt.metadata.copyEditSha256 !== manifest.stages.copy_edit?.sha256) {
      throw new Error("Humanizer draft is not bound to the accepted copy edit.");
    }
    if (stage === "humanizer_report") {
      const humanizedSha256 = manifest.stages.humanized_draft?.sha256;
      if (receipt.metadata.passed !== true || receipt.metadata.bodySha256 !== humanizedSha256) {
        throw new Error("Humanizer report is not bound to a passing audit of the exact Humanizer draft.");
      }
      if (receipt.metadata.reportSha256 !== manifest.stages.humanized_draft?.metadata?.reportSha256) {
        throw new Error("Humanizer report does not match the report accepted with the Humanizer draft.");
      }
    }
    if (stage === "final_draft" && contentSha256 !== manifest.stages.humanized_draft?.sha256) {
      throw new Error("Final draft does not byte-match the Humanizer-reviewed body.");
    }
    predecessorSha256 = contentSha256;
  }
  if (manifest.status === "complete") {
    if (gapFound) throw new Error("Completed checkpoint is missing one or more stages.");
    const finalBody = readCheckpoint(runDirectory, manifest, "final_draft");
    assertValidationForBody(manifest.validation, finalBody);
  }
  return true;
}

export function nextCheckpointStage(manifest) {
  return EDITORIAL_STAGES.find((stage) => !manifest.stages?.[stage]) ?? null;
}

export function readCheckpoint(runDirectory, manifest, stage) {
  const receipt = manifest.stages?.[stage];
  if (!receipt) throw new Error(`Stage ${stage} has not completed.`);
  return canonicalBody(fs.readFileSync(path.join(runDirectory, receipt.file), "utf8"));
}

export function recordCheckpoint(runDirectory, manifest, stage, content, metadata = {}) {
  const normalized = canonicalBody(content);
  if (!normalized) throw new Error(`Stage ${stage} produced empty content.`);
  const existing = manifest.stages?.[stage];
  if (existing) {
    if (existing.sha256 !== sha256(normalized)) throw new Error(`Stage ${stage} is immutable and already has different content.`);
    if (!isDeepStrictEqual(existing.metadata, metadata)) throw new Error(`Stage ${stage} is immutable and already has different metadata.`);
    return existing;
  }
  const expected = nextCheckpointStage(manifest);
  if (stage !== expected) throw new Error(`Stage ${stage} is out of order; expected ${expected ?? "no further stage"}.`);
  if (["writer_notebook", "argument_card", "spoken_brief", "raw_draft", "copy_edit", "humanized_draft", "humanizer_report"].includes(stage)
      && metadata.model !== manifest.model) {
    throw new Error(`Stage ${stage} must use the run model.`);
  }
  if (stage === "writer_notebook" && metadata.reviewWriterSha256 !== manifest.reviewWriterSha256) {
    throw new Error("Writer notebook must use the run writer fingerprint.");
  }
  if (["humanized_draft", "humanizer_report"].includes(stage)
      && metadata.humanizerSha256 !== manifest.humanizerSha256) {
    throw new Error(`Stage ${stage} must use the run Humanizer fingerprint.`);
  }
  if (stage === "humanized_draft" && !isSha256(metadata.reportSha256)) {
    throw new Error("Humanizer draft must identify its accepted editorial report.");
  }
  if (stage === "humanized_draft" && metadata.copyEditSha256 !== manifest.stages.copy_edit?.sha256) {
    throw new Error("Humanizer draft must identify the accepted copy edit.");
  }
  const normalizedSha256 = sha256(normalized);
  if (stage === "humanizer_report") {
    const humanizedSha256 = manifest.stages.humanized_draft?.sha256;
    if (metadata.passed !== true || metadata.bodySha256 !== humanizedSha256) {
      throw new Error("Humanizer report must pass and identify the exact Humanizer-reviewed body.");
    }
    if (metadata.reportSha256 !== manifest.stages.humanized_draft?.metadata?.reportSha256) {
      throw new Error("Humanizer report must match the report accepted with the Humanizer draft.");
    }
  }
  if (stage === "final_draft"
      && (!Buffer.from(normalized, "utf8").equals(Buffer.from(readCheckpoint(runDirectory, manifest, "humanized_draft"), "utf8"))
        || normalizedSha256 !== manifest.stages.humanized_draft?.sha256)) {
    throw new Error("Final draft must exactly match the Humanizer-reviewed body.");
  }
  const previousStage = EDITORIAL_STAGES[EDITORIAL_STAGES.indexOf(stage) - 1];
  const predecessorSha256 = previousStage ? manifest.stages[previousStage].sha256 : null;
  const file = STAGE_FILES[stage];
  atomicWrite(path.join(runDirectory, file), `${normalized}\n`);
  const receipt = {
    file,
    sha256: normalizedSha256,
    predecessorSha256,
    metadata,
    completedAt: new Date().toISOString(),
  };
  manifest.stages[stage] = receipt;
  saveManifest(runDirectory, manifest);
  return receipt;
}

export function recordStageFailure(runDirectory, manifest, stage, attempt, error, candidate = null) {
  if (stage !== nextCheckpointStage(manifest)) {
    throw new Error(`Cannot record a failure for ${stage}; the failed stage is ${nextCheckpointStage(manifest) ?? "none"}.`);
  }
  const message = error instanceof Error ? error.message : String(error);
  const failure = { stage, attempt, message, createdAt: new Date().toISOString() };
  if (candidate) {
    const candidateName = `${String(manifest.failures.length + 1).padStart(3, "0")}-${stage}-attempt-${attempt}.md`;
    atomicWrite(path.join(runDirectory, "attempts", candidateName), `${canonicalBody(candidate)}\n`);
    failure.candidate = path.join("attempts", candidateName);
    failure.candidateSha256 = sha256(canonicalBody(candidate));
  }
  manifest.failures.push(failure);
  saveManifest(runDirectory, manifest);
  return failure;
}

export function markCheckpointComplete(runDirectory, manifest, validation) {
  if (nextCheckpointStage(manifest)) throw new Error(`Cannot complete a run before ${nextCheckpointStage(manifest)}.`);
  verifyCheckpointRun(runDirectory, manifest);
  assertValidationForBody(validation, readCheckpoint(runDirectory, manifest, "final_draft"));
  manifest.status = "complete";
  manifest.validation = validation;
  saveManifest(runDirectory, manifest);
}
