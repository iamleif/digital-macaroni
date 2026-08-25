import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const today = "2026-08-14";

function updateEvidence(slug, mutate) {
  const file = path.join(root, "research", slug, "evidence.json");
  const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(evidence);
  evidence.researchUpdated = today;
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
}

function source(evidence, id) {
  const found = evidence.sources.find((item) => item.id === id);
  if (!found) throw new Error(`Missing source ${id} for ${evidence.productSlug}`);
  return found;
}

updateEvidence("carrd", (e) => {
  e.sources.push({ id: "product-hunt", name: "Carrd reviews on Product Hunt", url: "https://www.producthunt.com/products/carrd/reviews", accessed: today, sourceType: "independent-review-platform", reviewCountSampled: 24, keyThemes: ["Ease", "One-page scope", "Value", "Limits"] });
  e.claims[4].sourceIds.push("product-hunt");
  e.claims[5].sourceIds.push("product-hunt");
});
updateEvidence("companyhub-crm", (e) => { source(e, "reddit-crm").sourceType = "community"; });
updateEvidence("documenso", (e) => {
  e.sources.push({ id: "product-hunt", name: "Documenso reviews on Product Hunt", url: "https://www.producthunt.com/products/documenso/reviews", accessed: today, sourceType: "independent-review-platform", reviewCountSampled: 13, keyThemes: ["Signing flow", "Open source", "Setup"] });
});
updateEvidence("fillout", (e) => { source(e, "launch").sourceType = "community"; });
updateEvidence("frill", (e) => { source(e, "appsumo").sourceType = "community"; });
updateEvidence("guidde", (e) => {
  e.sources.push({ id: "reddit-documentation", name: "AI documentation tool discussion on Reddit", url: "https://www.reddit.com/r/SaaS/comments/1ppuxz7/anyone_else_frustrated_with_ai_documentation/", accessed: today, sourceType: "community", reviewCountSampled: 3, keyThemes: ["Editing", "Documentation upkeep", "AI output"] });
});
updateEvidence("lemon-squeezy", (e) => { source(e, "trustpilot").sourceType = "independent-review-platform"; });
updateEvidence("moxie", (e) => {
  e.sources.push({ id: "reddit-freelance", name: "Freelance client management discussion on Reddit", url: "https://www.reddit.com/r/graphic_design/comments/1o3foez/need_recommendation_for_freelance_client/", accessed: today, sourceType: "community", reviewCountSampled: 4, keyThemes: ["Client portal", "Contracts", "Freelance workflow"] });
});
updateEvidence("openstatus", (e) => { const github = source(e, "github"); github.sourceType = "community"; github.reviewCountSampled = 10; });
updateEvidence("pipedream", (e) => { source(e, "pricing-docs").sourceType = "official"; });
updateEvidence("pirsch-analytics", (e) => { const ph = source(e, "product-hunt"); ph.sourceType = "independent-review-platform"; ph.reviewCountSampled = 5; });
updateEvidence("plausible-analytics", (e) => {
  source(e, "g2").reviewCountSampled = 4;
  source(e, "reddit-alternatives").reviewCountSampled = 5;
  source(e, "reddit-simple").reviewCountSampled = 5;
  source(e, "reddit-duration").reviewCountSampled = 5;
});
updateEvidence("publer", (e) => { e.releaseDate = { date: "2012-11-22", precision: "range", sourceId: "official-story" }; });
updateEvidence("puzzle", (e) => {
  const ph = source(e, "product-hunt");
  ph.sourceType = "independent-review-platform";
  e.sources.push({ id: "capterra", name: "Puzzle listing on Capterra", url: "https://www.capterra.com/p/10028909/Puzzle/", accessed: today, sourceType: "independent-review-platform", reviewCountSampled: 0, keyThemes: ["Feature listing", "Pricing", "Review coverage limit"] });
});
updateEvidence("screen-studio", (e) => { const ph = source(e, "product-hunt"); ph.sourceType = "independent-review-platform"; ph.reviewCountSampled = 181; });
updateEvidence("vista-social", (e) => {
  e.sources.push({ id: "twitter-history", name: "Vista Social public profile history", url: "https://twstalker.com/vistasocialapp", accessed: today, sourceType: "independent-listing", reviewCountSampled: null, keyThemes: ["Public presence since July 2021"] });
  e.sources.push({ id: "official-user-limits", name: "Vista Social profile and user limits", url: "https://support.vistasocial.com/hc/en-us/articles/16791787436059-How-many-profiles-and-users-can-I-have-on-my-subscription", accessed: today, sourceType: "official", reviewCountSampled: null, keyThemes: ["Included profiles", "Included users"] });
  e.releaseDate = { date: "2021-07-01", precision: "month", sourceId: "twitter-history" };
  e.claims[2].status = "verified";
  e.claims[2].sourceIds = ["official-pricing", "official-user-limits"];
});

const recommendations = {
  documenso: "We recommend starting with the hosted version and one real, low-risk document before you even think about running it on your own server.",
  dorik: "We recommend Dorik for a simple business site when speed matters more than deep control over the design.",
  "fathom-analytics": "We recommend Fathom when you want useful traffic numbers without turning analytics into a second job.",
  featurebase: "We recommend Featurebase for teams that will actually use feedback, a public roadmap, and product updates together.",
  fibery: "We recommend Fibery for teams with unusual workflows and enough time to shape the system around them.",
  folk: "We recommend folk for a small team that wants a flexible contact list without the weight of a large sales system.",
  formbricks: "We recommend Formbricks when control over survey data matters and you have the technical help to run it properly.",
  freshsales: "We recommend Freshsales for a growing sales team that wants the main sales tools in one account.",
  frill: "We recommend Frill when you need a simple place for customers to submit ideas and see what you plan to build.",
  guidde: "We recommend Guidde when your team makes lots of short how-to guides and can still review every step before sharing them.",
  "lemon-squeezy": "We recommend Lemon Squeezy for a small software business that wants help with tax and billing, but only after checking approval and payout rules.",
  linear: "We recommend Linear for product and engineering teams that value speed and can live with its opinionated way of working.",
  moxie: "We recommend Moxie for a solo freelancer who wants proposals, contracts, invoices, and client work in one place.",
  openstatus: "We recommend OpenStatus for a technical team that wants an open status page and is comfortable with a younger product.",
  "pirsch-analytics": "We recommend Pirsch for a small site that wants clear, private traffic reports and does not need a huge marketing stack.",
  planable: "We recommend Planable for a content team that loses time passing drafts and approvals through email or chat.",
  "plausible-analytics": "We recommend Plausible when simple, private website numbers matter more than the depth of Google Analytics.",
  salesflare: "We recommend Salesflare for a small business-to-business sales team that wants the system to fill in more of the record for them.",
  "screen-studio": "We recommend Screen Studio for Mac users who want polished product videos without learning a full video editor.",
  supademo: "We recommend Supademo when a clickable walkthrough will explain your product faster than another help article or sales call."
};

for (const [slug, sentence] of Object.entries(recommendations)) {
  const file = path.join(root, "content", "reviews", `${slug}.mdx`);
  const parsed = matter(fs.readFileSync(file, "utf8"));
  if (!/\b(?:recommend|skip|our verdict)\b/i.test(parsed.content)) {
    const paragraphs = parsed.content.trim().split(/\n\n/);
    paragraphs.splice(Math.min(3, paragraphs.length), 0, sentence);
    parsed.content = `${paragraphs.join("\n\n")}\n`;
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  }
}

console.log("Evidence and recommendation pass complete.");
