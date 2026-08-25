import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";

const root = process.cwd();
const slug = process.argv[2];
const scheduleArgument = process.argv.find((argument) => argument.startsWith("--at="));

if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Usage: npm run publish:review -- <slug> [--at=2026-08-20T09:00:00Z]");
  process.exit(1);
}

const reviewPath = path.join(root, "content", "reviews", `${slug}.mdx`);
if (!fs.existsSync(reviewPath)) {
  console.error(`Review not found: content/reviews/${slug}.mdx`);
  process.exit(1);
}

const original = fs.readFileSync(reviewPath, "utf8");
const parsed = matter(original);
if (parsed.data.status !== "draft") {
  console.error(`${slug} is not a draft.`);
  process.exit(1);
}

const publishAt = scheduleArgument?.slice("--at=".length);
if (publishAt && Number.isNaN(Date.parse(publishAt))) {
  console.error("The --at value must be a valid ISO date/time.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
parsed.data.status = "published";
parsed.data.date = parsed.data.date || today;
delete parsed.data.updated;
if (publishAt) parsed.data.publishAt = publishAt;
else delete parsed.data.publishAt;

const queuePath = path.join(root, "research", "queue.json");
const originalQueue = fs.readFileSync(queuePath, "utf8");
const queue = JSON.parse(originalQueue);
const queueEntry = queue.find((item) => item.slug === slug);
if (!queueEntry) {
  console.error(`${slug} is missing from research/queue.json.`);
  process.exit(1);
}
queueEntry.status = "published";

fs.writeFileSync(reviewPath, matter.stringify(parsed.content, parsed.data));
fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);

const validation = spawnSync(process.execPath, [path.join(root, "scripts", "validate-content.mjs")], {
  cwd: root,
  encoding: "utf8",
});

if (validation.status !== 0) {
  fs.writeFileSync(reviewPath, original);
  fs.writeFileSync(queuePath, originalQueue);
  process.stderr.write(validation.stderr || validation.stdout);
  console.error("Publication was rolled back because validation failed.");
  process.exit(1);
}

process.stdout.write(validation.stdout);
console.log(`${slug} is ready to publish${publishAt ? ` at ${publishAt}` : " now"}. Commit and deploy the validated changes.`);
import "./lib/legacy-publisher-disabled.mjs";
