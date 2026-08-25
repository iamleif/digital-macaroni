import fs from "node:fs";

const edits = {
  "companyhub-crm": [
    ["A message sent from CompanyHub goes out at once, but it may not appear in the contact history until the next sync.", "A message sent from CompanyHub goes out at once. It may not appear in the contact history until the next sync."],
    ["Someone has to decide which records exist, how they connect, which fields are required, and who is responsible for each update.", "Someone has to decide which records exist and how they connect. The team also needs rules for required fields and who owns each update."]
  ],
  plane: [
    ["Plane has importers for Jira, Linear, Asana, ClickUp, CSV, Confluence, Notion, and workspace members, but the exact mapping needs to be checked.", "Plane can import from Jira, Linear, Asana, ClickUp, CSV, Confluence, and Notion. It can also import workspace members, but you still need to check the exact mapping."],
    ["Show planned versus finished work, work added after the cycle began, blocked items, changed scope, time, progress by module, and release risk.", "Show planned work against finished work and flag anything added after the cycle began. Include blocked items, changed scope, time, module progress, and release risk."]
  ],
  puzzle: [
    ["Scale starts with higher volume, subledgers, backup and restore, fewer transaction or connection limits, 300 AI credits, and dedicated onboarding and support.", "Scale starts with higher volume, subledgers, backup and restore, and fewer limits. It also has 300 AI credits and dedicated setup and support."],
    ["We did not connect an account, migrate books, close a month, verify a report, test a tax export, or contact support.", "We did not connect an account, move books, close a month, or verify a report. We also did not test a tax export or contact support."]
  ]
};

for (const [slug, pairs] of Object.entries(edits)) {
  const file = `content/reviews/${slug}.mdx`;
  let text = fs.readFileSync(file, "utf8");
  for (const [before, after] of pairs) {
    if (!text.includes(before)) throw new Error(`Missing edit in ${slug}: ${before}`);
    text = text.replace(before, after);
  }
  fs.writeFileSync(file, text);
}

console.log("Last readability edits complete.");
