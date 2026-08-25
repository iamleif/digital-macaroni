import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  nextCheckpointStage,
  openCheckpointRun,
  readCheckpoint,
  recordCheckpoint,
  recordStageFailure,
  markCheckpointComplete,
  verifyCheckpointRun,
} from "../lib/rewrite-checkpoints.mjs";

const checks = {
  structure: true,
  source_integrity: true,
  stance: true,
  buyer_guidance: true,
  humanizer: true,
  similarity: true,
  readability: true,
  disclosure: true,
};

function createRun() {
  const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dm-editorial-checkpoint-"));
  const manifest = openCheckpointRun({
    runDirectory,
    slug: "test-product",
    model: "test-model",
    sourceBodySha256: "a".repeat(64),
    evidenceSha256: "d".repeat(64),
    pipelineSha256: "f".repeat(64),
    publicationDate: "2026-01-01",
    reviewWriterSha256: "b".repeat(64),
    humanizerSha256: "c".repeat(64),
  });
  return { runDirectory, manifest };
}

test("checkpoints cannot skip a stage", () => {
  const { runDirectory, manifest } = createRun();
  assert.equal(nextCheckpointStage(manifest), "research_brief");
  assert.throws(() => recordCheckpoint(runDirectory, manifest, "writer_notebook", "Notebook"), /out of order/);
  assert.equal(nextCheckpointStage(manifest), "research_brief");
});

test("completed checkpoints resume without rewriting", () => {
  const { runDirectory, manifest } = createRun();
  const first = recordCheckpoint(runDirectory, manifest, "research_brief", "Research brief");
  const resumed = recordCheckpoint(runDirectory, manifest, "research_brief", "Research brief");
  assert.equal(resumed.sha256, first.sha256);
  assert.equal(readCheckpoint(runDirectory, manifest, "research_brief"), "Research brief");
  assert.equal(nextCheckpointStage(manifest), "source_packet");
});

test("a completed stage is immutable", () => {
  const { runDirectory, manifest } = createRun();
  recordCheckpoint(runDirectory, manifest, "research_brief", "Research brief");
  assert.throws(() => recordCheckpoint(runDirectory, manifest, "research_brief", "Changed brief"), /immutable/);
});

test("checkpoint verification detects file tampering", () => {
  const { runDirectory, manifest } = createRun();
  recordCheckpoint(runDirectory, manifest, "research_brief", "Research brief");
  fs.writeFileSync(path.join(runDirectory, "01-research-brief.md"), "Tampered\n");
  assert.throws(() => verifyCheckpointRun(runDirectory, manifest), /hash mismatch/);
});

test("a failed stage preserves every completed predecessor", () => {
  const { runDirectory, manifest } = createRun();
  recordCheckpoint(runDirectory, manifest, "research_brief", "Research brief");
  recordCheckpoint(runDirectory, manifest, "source_packet", "Source packet");
  const researchHash = manifest.stages.research_brief.sha256;
  recordStageFailure(runDirectory, manifest, "writer_notebook", 1, new Error("Notebook missing buyer"), "Bad notebook");
  assert.equal(manifest.stages.research_brief.sha256, researchHash);
  assert.equal(nextCheckpointStage(manifest), "writer_notebook");
  assert.equal(manifest.failures.length, 1);
});

test("final draft must byte-match the Humanizer-reviewed body", () => {
  const { runDirectory, manifest } = createRun();
  const fixtures = {
    research_brief: "Research brief",
    source_packet: "Source packet",
    writer_notebook: "Writer notebook",
    argument_card: "Argument card",
    spoken_brief: "Spoken brief",
    raw_draft: "Raw draft",
    copy_edit: "Copy edit",
    humanized_draft: "Exact humanized body",
  };
  const metadata = {
    writer_notebook: { model: "test-model", attempt: 1, reviewWriterSha256: "b".repeat(64) },
    argument_card: { model: "test-model", attempt: 1 },
    spoken_brief: { model: "test-model", attempt: 1 },
    raw_draft: { model: "test-model", attempt: 1 },
    copy_edit: { model: "test-model", attempt: 1, title: "Title", description: "Description", verdict: "A valid accepted verdict for this exact draft" },
    humanized_draft: {
      model: "test-model",
      attempt: 1,
      humanizerSha256: "c".repeat(64),
      reportSha256: "e".repeat(64),
    },
  };
  for (const [stage, content] of Object.entries(fixtures)) {
    const stageMetadata = stage === "humanized_draft"
      ? { ...metadata[stage], copyEditSha256: manifest.stages.copy_edit.sha256 }
      : (metadata[stage] ?? {});
    recordCheckpoint(runDirectory, manifest, stage, content, stageMetadata);
  }
  recordCheckpoint(runDirectory, manifest, "humanizer_report", "Passed report", {
    model: "test-model",
    passed: true,
    bodySha256: manifest.stages.humanized_draft.sha256,
    humanizerSha256: "c".repeat(64),
    reportSha256: "e".repeat(64),
  });
  assert.throws(() => recordCheckpoint(runDirectory, manifest, "final_draft", "Changed after review"), /exactly match/);
  recordCheckpoint(runDirectory, manifest, "final_draft", "Exact humanized body");
  assert.equal(nextCheckpointStage(manifest), null);
});

test("a completed checkpoint requires an exact-body passing validation", () => {
  const { runDirectory, manifest } = createRun();
  const metadata = {
    writer_notebook: { model: "test-model", attempt: 1, reviewWriterSha256: "b".repeat(64) },
    argument_card: { model: "test-model", attempt: 1 },
    spoken_brief: { model: "test-model", attempt: 1 },
    raw_draft: { model: "test-model", attempt: 1 },
    copy_edit: { model: "test-model", attempt: 1, title: "Title", description: "Description", verdict: "A valid accepted verdict for this exact draft" },
    humanized_draft: { model: "test-model", attempt: 1, humanizerSha256: "c".repeat(64), reportSha256: "e".repeat(64) },
  };
  for (const stage of ["research_brief", "source_packet", "writer_notebook", "argument_card", "spoken_brief", "raw_draft", "copy_edit", "humanized_draft"]) {
    const stageMetadata = stage === "humanized_draft"
      ? { ...metadata[stage], copyEditSha256: manifest.stages.copy_edit.sha256 }
      : (metadata[stage] ?? {});
    recordCheckpoint(runDirectory, manifest, stage, stage === "humanized_draft" ? "Exact body" : stage, stageMetadata);
  }
  recordCheckpoint(runDirectory, manifest, "humanizer_report", "Passed report", {
    model: "test-model",
    passed: true,
    bodySha256: manifest.stages.humanized_draft.sha256,
    humanizerSha256: "c".repeat(64),
    reportSha256: "e".repeat(64),
  });
  recordCheckpoint(runDirectory, manifest, "final_draft", "Exact body");
  assert.throws(() => markCheckpointComplete(runDirectory, manifest, { passed: true, checks, bodySha256: "f".repeat(64) }), /does not match body/);
  markCheckpointComplete(runDirectory, manifest, { passed: true, checks, bodySha256: manifest.stages.final_draft.sha256 });
  assert.equal(manifest.status, "complete");
  assert.equal(verifyCheckpointRun(runDirectory, manifest), true);
});

test("checkpoint identity binds model and evidence", () => {
  const { runDirectory } = createRun();
  assert.throws(() => openCheckpointRun({
    runDirectory,
    slug: "test-product",
    model: "changed-model",
    sourceBodySha256: "a".repeat(64),
    evidenceSha256: "d".repeat(64),
    pipelineSha256: "f".repeat(64),
    publicationDate: "2026-01-01",
    reviewWriterSha256: "b".repeat(64),
    humanizerSha256: "c".repeat(64),
  }), /model/);
});
