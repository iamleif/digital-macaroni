import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const publish = process.argv.includes("--publish");
const slugs = [
  "akiflow", "better-stack", "carrd", "claap", "companyhub-crm", "deftform", "documenso", "dorik",
  "dub", "encharge", "fathom-analytics", "featurebase", "fibery", "fillout", "folk", "formbricks",
  "freshsales", "frill", "guidde", "jitter", "lemon-squeezy", "missive", "morgen", "moxie", "noloco",
  "openstatus", "pipedream", "pirsch-analytics", "planable", "plane", "plausible-analytics", "posthog",
  "publer", "puzzle", "salesflare", "screen-studio", "senja", "supademo", "vista-social", "weweb",
];

const titles = {
  "akiflow": "Akiflow review: is the daily planner worth the price?",
  "better-stack": "Better Stack review: do the joined tools improve incident response?",
  "carrd": "Carrd review: the best cheap builder for one-page sites",
  "claap": "Claap review: do short recordings replace enough meetings?",
  "companyhub-crm": "CompanyHub CRM review: flexible records in a plain package",
  "deftform": "Deftform review: a cheap form builder that needs a hard trial",
  "dub": "Dub review: when does a short link need real management?",
  "encharge": "Encharge review: visual email paths with a higher setup cost",
  "jitter": "Jitter review: fast motion design without After Effects",
  "missive": "Missive review: shared email without duplicate replies",
  "noloco": "Noloco review: can a no-code portal handle real operations?",
  "publer": "Publer review: affordable scheduling with limits beyond publishing",
  "senja": "Senja review: easy testimonial collection needs better questions",
  "vista-social": "Vista Social review: broad social tools need a broad team",
  "weweb": "WeWeb review: less coding does not mean less technical work",
};

const cards = {
  "akiflow":"Strong daily planning at a demanding price.", "better-stack":"Joined incident tools with modular costs.",
  "carrd":"Excellent one-page sites at a tiny price.", "claap":"Useful recordings only when people watch them.",
  "companyhub-crm":"Flexible CRM records in a plain interface.", "deftform":"Cheap capable forms that need reliability testing.",
  "documenso":"Credible open signing, with two different hosting choices.", "dorik":"Quick normal websites with clear design limits.",
  "dub":"Useful link control once clicks affect revenue.", "encharge":"Clear email paths that need clean product data.",
  "fathom-analytics":"Clear private traffic reports, limited deeper analysis.", "featurebase":"Strong customer loop beyond a feedback board.",
  "fibery":"Connected work that needs a committed owner.", "fillout":"Strong forms with unusually useful database links.",
  "folk":"Useful shared contacts for small relationship teams.", "formbricks":"Strong targeted surveys with setup and license checks.",
  "freshsales":"Good sales value when reports pass the test.", "frill":"Focused feedback that only works with upkeep.",
  "guidde":"Fast software guides that demand careful second edits.", "jitter":"Fast polished motion without a professional tool.",
  "lemon-squeezy":"Tax help worth testing through real payouts.", "missive":"Excellent shared email after search and mobile tests.",
  "morgen":"One daily plan only if every sync holds.", "moxie":"Useful freelancer operations without deep project control.",
  "noloco":"Fast client portals with data and scale checks.", "openstatus":"Promising monitoring with too little customer history.",
  "pipedream":"Powerful developer automation that needs technical ownership.", "pirsch-analytics":"Private analytics that must match real business records.",
  "planable":"Excellent client approval, incomplete social management.", "plane":"Serious project software with real hosting duties.",
  "plausible-analytics":"Excellent simple analytics when the shorter view suffices.", "posthog":"Powerful product data when one decision leads.",
  "publer":"Affordable publishing with reporting and agency limits.", "puzzle":"Clear startup finance that still needs verification.",
  "salesflare":"Smart small-team CRM with a clear ceiling.", "screen-studio":"Fast polished demos when the movement helps.",
  "senja":"Easy testimonial collection needs focused questions.", "supademo":"Quick demos that still need an update owner.",
  "vista-social":"Broad social tools for teams that need breadth.", "weweb":"Flexible app building that still demands technical judgment.",
};

const scores = {
  "akiflow":[7.9,8.2,8.2,8.0,6.6], "better-stack":[8.3,8.5,8.6,8.0,7.6], "carrd":[8.6,9.2,8.7,7.4,9.4],
  "claap":[7.8,8.1,8.0,7.3,7.6], "companyhub-crm":[7.4,7.6,7.5,7.3,7.2], "deftform":[7.3,8.0,7.4,6.5,8.3],
  "documenso":[7.9,7.8,8.1,7.3,8.2], "dorik":[7.8,8.5,7.7,7.2,8.0], "dub":[8.2,8.6,8.4,7.8,8.0],
  "encharge":[7.8,7.6,8.2,7.7,6.9], "fathom-analytics":[8.4,9.0,8.3,8.2,8.1], "featurebase":[8.0,8.3,8.2,7.7,7.7],
  "fibery":[8.0,6.9,8.7,8.0,8.0], "fillout":[8.7,9.1,8.8,8.1,9.0], "folk":[7.9,8.4,8.1,7.6,7.7],
  "formbricks":[8.0,7.3,8.5,7.6,8.4], "freshsales":[8.1,8.3,8.4,7.8,8.0], "frill":[7.8,8.4,7.8,7.4,7.8],
  "guidde":[7.7,8.3,7.8,7.2,7.4], "jitter":[8.5,9.0,8.5,8.0,8.5], "lemon-squeezy":[8.1,7.7,8.5,7.8,8.0],
  "missive":[8.4,8.7,8.6,8.0,8.1], "morgen":[7.9,8.0,8.0,7.5,7.7], "moxie":[8.0,8.4,8.1,7.7,8.0],
  "noloco":[7.9,8.3,8.0,7.5,7.6], "openstatus":[7.5,7.8,7.7,7.1,7.6], "pipedream":[8.5,8.2,9.0,8.0,8.4],
  "pirsch-analytics":[8.1,8.6,8.1,7.8,8.0], "planable":[8.5,8.8,8.7,8.1,8.0], "plane":[8.0,8.0,8.4,7.4,8.2],
  "plausible-analytics":[8.6,9.0,8.5,8.3,8.4], "posthog":[8.7,7.8,9.3,8.2,9.0], "publer":[8.1,8.7,8.1,7.7,8.6],
  "puzzle":[7.8,8.3,7.8,7.4,7.6], "salesflare":[8.2,8.8,8.3,8.0,8.0], "screen-studio":[8.6,9.2,8.7,8.1,8.4],
  "senja":[8.2,9.0,8.2,7.8,8.0], "supademo":[7.9,8.6,8.0,7.4,7.7], "vista-social":[8.0,8.1,8.1,7.5,8.2],
  "weweb":[8.1,7.2,8.8,7.6,8.0],
};

function finalPath(slug) {
  const directory = path.join(root, "research", slug, "drafts");
  const file = fs.readdirSync(directory).find((name) => name.includes("spoken") && name.includes("final"));
  if (!file) throw new Error(`${slug}: final spoken draft not found`);
  return path.join(directory, file);
}

function argumentValue(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`^- \\*{0,2}${escaped}\\*{0,2}:\\s*(.+)$`, "mi"))?.[1]?.trim();
}

function cleanDescription(body) {
  const first = body.split(/\n\n+/).find((part) => part.trim() && !part.trim().startsWith("#")) ?? "";
  const clean = first.replace(/[*_`\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).replace(/\s+\S*$/, "")}...`;
}

const queuePath = path.join(root, "research", "queue.json");
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));

for (const slug of slugs) {
  const packet = JSON.parse(fs.readFileSync(path.join(root, "research", "backlog-packets", `${slug}.json`), "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(root, "research", slug, "evidence.json"), "utf8"));
  const draft = fs.readFileSync(finalPath(slug), "utf8").trim();
  const body = draft.replace(/^# .*\n+/, "").trim();
  const draftTitle = draft.match(/^# (.+)$/m)?.[1] ?? `${packet.product.name} review`;
  const title = titles[slug] ?? draftTitle;
  const argument = fs.readFileSync(path.join(root, "research", slug, "argument-card-2026-08-14.md"), "utf8");
  const verdict = argumentValue(argument, "Thesis") ?? argumentValue(argument, "Main judgment") ?? cleanDescription(body);
  const [overall, onboarding, product, support, billing] = scores[slug];
  const sources = evidence.sources.map(({ name, url, accessed }) => ({ name, url, accessed }));
  const disclosure = `This is a research-based review. We studied official product information, independent review platforms, community discussions, and independent coverage where available. We did not run a hands-on test. No payment was received for coverage.`;
  const frontmatter = {
    company: packet.product.name,
    title,
    description: cleanDescription(body),
    date: "2026-08-14",
    author: "Leif Johansen",
    status: publish ? "published" : "draft",
    category: packet.product.category,
    productUrl: packet.product.website_url,
    schemaCategory: packet.product.category === "Developer tools" ? "DeveloperApplication" : "BusinessApplication",
    score: overall,
    verdict,
    cardVerdict: cards[slug],
    featured: false,
    reviewType: "research-based",
    legacyResearch: false,
    testingDisclosure: disclosure,
    sources,
    scores: { onboarding, product, support, billing },
    publishAt: "2026-08-14T00:00:00Z",
  };
  fs.writeFileSync(path.join(root, "content", "reviews", `${slug}.mdx`), matter.stringify(`${body}\n`, frontmatter));

  const item = queue.find((entry) => entry.slug === slug);
  const next = {
    slug,
    product: packet.product.name,
    productUrl: packet.product.website_url,
    status: publish ? "published" : "draft",
    researchStatus: "documented",
    category: packet.product.category,
    priority: packet.job.priority ?? 3,
  };
  if (item) Object.assign(item, next);
  else queue.push(next);
}

fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`${publish ? "Published" : "Prepared"} ${slugs.length} completed reviews.`);
import "./lib/legacy-publisher-disabled.mjs";
