import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const queuePath = path.join(root, "research", "queue.json");
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const targets = queue.filter((item) => item.status === "draft");

function previousSlot(date) {
  const next = new Date(`${date}T12:00:00Z`);
  do next.setUTCDate(next.getUTCDate() - 1);
  while (![2, 5].includes(next.getUTCDay()));
  return next.toISOString().slice(0, 10);
}

let assignedDate = "2026-08-14";
for (const item of targets) {
  const reviewPath = path.join(root, "content", "reviews", `${item.slug}.mdx`);
  const parsed = matter(fs.readFileSync(reviewPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(root, "research", item.slug, "evidence.json"), "utf8"));

  while (assignedDate <= evidence.releaseDate.date) assignedDate = previousSlot(assignedDate);
  parsed.data.status = "published";
  parsed.data.date = assignedDate;
  delete parsed.data.updated;
  parsed.data.publishAt = `${assignedDate}T09:00:00Z`;
  fs.writeFileSync(reviewPath, matter.stringify(parsed.content, parsed.data));

  const finalDraft = path.join(root, "research", item.slug, "drafts", `${item.slug}-review-2026-08-14-spoken-final.md`);
  const copyDraft = path.join(root, "research", item.slug, "drafts", `${item.slug}-review-2026-08-14-spoken-copy-edit.md`);
  fs.mkdirSync(path.dirname(finalDraft), { recursive: true });
  fs.writeFileSync(finalDraft, parsed.content.trimStart());
  fs.writeFileSync(copyDraft, parsed.content.trimStart());

  item.status = "published";
  item.researchStatus = "documented";
  item.date = assignedDate;
  assignedDate = previousSlot(assignedDate);
}

fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`Prepared ${targets.length} reviews for publication.`);
import "./lib/legacy-publisher-disabled.mjs";
