import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  [process.execPath, [path.join(root, "scripts", "validate-content.mjs")], "content validation"],
  [npmCommand, ["run", "lint"], "type checking"],
  [npmCommand, ["run", "build"], "production build"],
];

for (const [command, args, label] of checks) {
  console.log(`\nRunning ${label}...`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nPublish check passed.");
