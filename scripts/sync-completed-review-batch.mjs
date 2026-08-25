import fs from "node:fs";
import { spawnSync } from "node:child_process";

const queue = JSON.parse(fs.readFileSync("research/queue.json", "utf8"));
const requested = process.argv.slice(2);
const slugs = requested.length ? requested : queue.filter((item) => item.status === "published").map((item) => item.slug);
const failed = [];

for (const [index, slug] of slugs.entries()) {
  console.log(`[${index + 1}/${slugs.length}] Syncing ${slug}`);
  const result = spawnSync(process.execPath, ["--env-file-if-exists=.env.local", "scripts/sync-one-review-cli.mjs", slug], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) failed.push(slug);
}

if (failed.length) {
  console.error(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log(`Synced and verified ${slugs.length} reviews.`);
import "./lib/legacy-publisher-disabled.mjs";
