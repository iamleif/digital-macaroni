import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import {
  EDITORIAL_STAGES,
  EDITORIAL_VALIDATOR_VERSION,
  assertCompleteValidationReport,
  bodySha256,
  canonicalBody,
  editorialSkillFingerprints,
  sha256,
} from "./lib/editorial-contract.mjs";
import { validateEditorialDraft } from "./lib/editorial-validator.mjs";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");
const command = process.argv[2] ?? "help";
const slug = process.argv[3];
const positional = process.argv.slice(4).filter((argument) => !argument.startsWith("--"));

function option(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  const string = String(value);
  if (string.includes("\0")) throw new Error("SQL values cannot contain NUL bytes.");
  return `'${string.replaceAll("'", "''")}'`;
}

function query(sql) {
  const result = spawnSync("supabase", ["db", "query", "--linked", sql], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  try {
    return JSON.parse(result.stdout).rows ?? [];
  } catch {
    console.error("Supabase returned unreadable query output.");
    process.exit(1);
  }
}

function requireSlug() {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error("A valid review slug is required.");
    process.exit(1);
  }
}

function review() {
  const filePath = path.join(reviewDirectory, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) throw new Error(`Review not found: content/reviews/${slug}.mdx`);
  const source = fs.readFileSync(filePath, "utf8");
  return { filePath, source, ...matter(source) };
}

function currentRun(requiredStatus) {
  const statusFilter = requiredStatus ? `and r.status = ${sqlLiteral(requiredStatus)}` : "";
  const rows = query(`
    select r.*, p.name as product_name,
      (select count(*) from private.editorial_artifacts a where a.run_id = r.id) as artifact_count
    from private.editorial_runs r
    join public.products p on p.id = r.product_id
    where r.slug = ${sqlLiteral(slug)} ${statusFilter}
    order by r.id desc limit 1;
  `);
  if (!rows[0]) throw new Error(`No ${requiredStatus ? `${requiredStatus} ` : ""}editorial run found for ${slug}.`);
  return rows[0];
}

function predecessor(runId) {
  return query(`
    select stage, content_sha256
    from private.editorial_artifacts
    where run_id = ${runId}
    order by private.editorial_stage_position(stage) desc
    limit 1;
  `)[0] ?? null;
}

if (command === "help") {
  console.log(`Enforced editorial pipeline

  start <slug>
  ensure <slug>   # resume the matching open run or start one
  record <slug> <stage> <file> [research flags | --passed]
  status <slug>
  reject <slug> --reason=<why this immutable run cannot continue>
  approve <slug> --by=<human> --sha=<displayed fingerprint> --statement=<explicit approval>
  validate <slug>
  publish <slug>

Stages: ${EDITORIAL_STAGES.join(" -> ")}`);
  process.exit(0);
}

requireSlug();

if (command === "start" || command === "ensure") {
  const parsed = review();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.date ?? "")) throw new Error(`${slug} has no publication date to preserve.`);
  const product = query(`select id from public.products where slug = ${sqlLiteral(slug)} limit 1;`)[0];
  if (!product) throw new Error(`Supabase product not found for ${slug}.`);

  const { reviewWriterSha256: writerHash, humanizerSha256: humanizerHash } = editorialSkillFingerprints(root);
  if (command === "ensure") {
    const existing = query(`
      select id, slug, publication_date::text, status, review_writer_sha256, humanizer_sha256
      from private.editorial_runs
      where product_id = ${product.id} and status not in ('published', 'blocked')
      order by id desc limit 1;
    `)[0];
    if (existing) {
      if (existing.slug !== slug
          || existing.publication_date !== parsed.data.date
          || existing.review_writer_sha256 !== writerHash
          || existing.humanizer_sha256 !== humanizerHash) {
        throw new Error(`Open editorial run ${existing.id} does not match the current slug, date, or skill fingerprints.`);
      }
      console.log(JSON.stringify({ ...existing, resumed: true }, null, 2));
      process.exit(0);
    }
  }
  const row = query(`
    insert into private.editorial_runs (
      product_id, slug, publication_date, review_writer_sha256, humanizer_sha256
    ) values (
      ${product.id}, ${sqlLiteral(slug)}, ${sqlLiteral(parsed.data.date)},
      ${sqlLiteral(writerHash)}, ${sqlLiteral(humanizerHash)}
    ) returning id, slug, publication_date::text, status, review_writer_sha256, humanizer_sha256;
  `)[0];
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}

if (command === "status") {
  const run = currentRun();
  const artifacts = query(`
    select stage, content_sha256, created_at
    from private.editorial_artifacts
    where run_id = ${run.id}
    order by private.editorial_stage_position(stage);
  `);
  console.log(JSON.stringify({ run, artifacts, nextStage: EDITORIAL_STAGES[artifacts.length] ?? null }, null, 2));
  process.exit(0);
}

if (command === "reject") {
  const run = currentRun();
  const reason = option("reason");
  if (!reason || reason.trim().length < 12) {
    throw new Error("Rejecting a run requires --reason with a specific editorial explanation.");
  }
  if (["published", "blocked"].includes(run.status)) {
    throw new Error(`Run ${run.id} cannot be rejected from status ${run.status}.`);
  }
  const row = query(`
    update private.editorial_runs
    set status = 'blocked', blocked_reason = ${sqlLiteral(reason)}
    where id = ${run.id}
    returning id, slug, status, blocked_reason, final_body_sha256;
  `)[0];
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}

if (command === "record") {
  const stage = positional[0];
  const artifactPath = positional[1];
  if (!EDITORIAL_STAGES.includes(stage) || !artifactPath) {
    throw new Error("Usage: record <slug> <stage> <file> [stage-specific flags]");
  }
  const run = currentRun();
  const existing = query(`
    select stage, content_sha256, created_at
    from private.editorial_artifacts
    where run_id = ${run.id} and stage = ${sqlLiteral(stage)}
    limit 1;
  `)[0];
  const content = canonicalBody(fs.readFileSync(path.resolve(root, artifactPath), "utf8"));
  if (existing) {
    if (existing.content_sha256 !== sha256(content)) {
      throw new Error(`Stage ${stage} already exists with a different immutable fingerprint.`);
    }
    console.log(JSON.stringify({ ...existing, resumed: true }, null, 2));
    process.exit(0);
  }
  const previous = predecessor(run.id);
  const metadata = previous ? { predecessorSha256: previous.content_sha256 } : {};

  if (stage === "research_brief") {
    metadata.researchJobId = Number(option("research-job-id"));
    metadata.sourceCount = Number(option("source-count"));
    metadata.independentSourceCount = Number(option("independent-source-count"));
  }
  if (stage === "writer_notebook") metadata.reviewWriterSha256 = run.review_writer_sha256;
  if (stage === "humanized_draft" || stage === "humanizer_report") metadata.humanizerSha256 = run.humanizer_sha256;
  if (stage === "humanizer_report") metadata.passed = flag("passed");

  const row = query(`
    insert into private.editorial_artifacts (run_id, stage, content, metadata)
    values (${run.id}, ${sqlLiteral(stage)}, ${sqlLiteral(content)}, ${sqlLiteral(JSON.stringify(metadata))}::jsonb)
    returning stage, content_sha256, created_at;
  `)[0];
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}

if (command === "approve") {
  const run = currentRun("awaiting_approval");
  const approvedBy = option("by");
  const approvedHash = option("sha");
  const statement = option("statement");
  if (!approvedBy || !approvedHash || !statement) {
    throw new Error("Approval requires --by, --sha, and --statement. The SHA must be copied from the displayed final draft.");
  }
  const row = query(`
    insert into private.editorial_approvals (run_id, body_sha256, approved_by, approval_statement)
    values (${run.id}, ${sqlLiteral(approvedHash)}, ${sqlLiteral(approvedBy)}, ${sqlLiteral(statement)})
    returning run_id, body_sha256, approved_by, created_at;
  `)[0];
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}

if (command === "validate") {
  const run = currentRun("approved");
  const parsed = review();
  const report = validateEditorialDraft({
    slug,
    body: parsed.content,
    data: parsed.data,
    reviewDirectory,
  });
  if (report.bodySha256 !== run.final_body_sha256) {
    throw new Error(`Local body ${report.bodySha256} does not match final draft ${run.final_body_sha256}.`);
  }
  if (!report.passed) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  assertCompleteValidationReport(report);
  query(`
    insert into private.editorial_validations (
      run_id, body_sha256, validator_version, passed, report
    ) values (
      ${run.id}, ${sqlLiteral(report.bodySha256)}, ${sqlLiteral(EDITORIAL_VALIDATOR_VERSION)}, true,
      ${sqlLiteral(JSON.stringify(report))}::jsonb
    );
  `);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (command === "publish") {
  const run = currentRun("validated");
  const parsed = review();
  const body = canonicalBody(parsed.content);
  const fingerprint = bodySha256(body);
  if (fingerprint !== run.validated_body_sha256) throw new Error("Local body is not the exact approved and validated body.");
  if (parsed.data.date !== run.publication_date) throw new Error("Local publication date does not match the preserved run date.");

  const score = Number(parsed.data.score);
  if (!Number.isFinite(score)) throw new Error("Review has no numeric score.");
  const publishAt = parsed.data.publishAt ?? `${parsed.data.date}T00:00:00Z`;
  const validationReport = JSON.stringify({
    passed: true,
    validator: EDITORIAL_VALIDATOR_VERSION,
    editorialRunId: run.id,
    bodySha256: fingerprint,
  });

  query(`
    update public.articles
    set title = ${sqlLiteral(parsed.data.title)},
        description = ${sqlLiteral(parsed.data.description)},
        body_mdx = ${sqlLiteral(body)},
        verdict = ${sqlLiteral(parsed.data.verdict)},
        card_verdict = ${sqlLiteral(parsed.data.cardVerdict)},
        author_name = ${sqlLiteral(parsed.data.author ?? "Leif Johansen")},
        status = 'published',
        review_type = ${sqlLiteral(parsed.data.reviewType)},
        testing_disclosure = ${sqlLiteral(parsed.data.testingDisclosure)},
        featured = ${Boolean(parsed.data.featured)},
        published_on = ${sqlLiteral(parsed.data.date)},
        publish_at = ${sqlLiteral(publishAt)},
        overall_score = ${score},
        editorial_run_id = ${run.id},
        approved_body_sha256 = ${sqlLiteral(fingerprint)},
        validation_report = ${sqlLiteral(validationReport)}::jsonb
    where product_id = ${run.product_id};

    update public.products
    set pipeline_status = 'published', target_publish_date = ${sqlLiteral(parsed.data.date)}, is_public = true
    where id = ${run.product_id};
  `);

  parsed.data.status = "published";
  parsed.data.editorialRunId = Number(run.id);
  parsed.data.approvedBodySha256 = fingerprint;
  fs.writeFileSync(parsed.filePath, matter.stringify(`${body}\n`, parsed.data));
  console.log(`${slug} published through editorial run ${run.id}; date preserved as ${parsed.data.date}.`);
  process.exit(0);
}

throw new Error(`Unknown command: ${command}`);
