import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");

const headlines = {
  "akiflow": "Excellent daily planning, but too expensive for casual use.",
  "better-stack": "Useful incident tools that become expensive as needs grow.",
  "breakcold": "A useful LinkedIn sales CRM with shaky billing support.",
  "carrd": "The best cheap choice for a simple website.",
  "claap": "Useful meeting recordings, if your team actually watches them.",
  "companyhub-crm": "Flexible CRM records wrapped in a dated-looking interface.",
  "deftform": "Capable low-cost forms that still need reliability testing.",
  "documenso": "A credible signing tool with very different hosting options.",
  "dorik": "An easy website builder with firm design limits.",
  "dub": "Worth using when every shared link affects revenue.",
  "encharge": "Clear email automation that depends on clean customer data.",
  "fathom-analytics": "Simple private analytics that skip deeper visitor behavior.",
  "featurebase": "Customer requests become clear decisions and useful updates.",
  "fibery": "Flexible connected workspaces that need a dedicated owner.",
  "fillout": "Excellent forms with database connections that save real work.",
  "folk": "A useful contact manager for small relationship-focused teams.",
  "formbricks": "Powerful targeted surveys with setup and licensing headaches.",
  "freshsales": "Good sales software if its reports fit your process.",
  "frill": "A focused feedback board that requires regular upkeep.",
  "guidde": "Fast software guides that still require careful editing.",
  "jitter": "Easy motion design without learning complex tools first.",
  "lemon-squeezy": "Valuable tax help, once approvals and payouts work reliably.",
  "linear": "Fast project tracking that becomes rigid on complex work.",
  "lodgify": "A useful booking website with calendar reliability concerns.",
  "missive": "Excellent shared email, provided search and notifications work.",
  "morgen": "One useful daily plan, provided every connection stays synced.",
  "moxie": "Freelancer software that lacks serious project management depth.",
  "noloco": "Fast client portals that require careful database testing.",
  "openphone": "An easy shared phone system with real reliability concerns.",
  "openstatus": "Promising monitoring software with too little customer history.",
  "pipedream": "Powerful automation for developers, confusing for everyone else.",
  "pirsch-analytics": "Private analytics that must match your actual sales numbers.",
  "planable": "Excellent client approvals with limited social management tools.",
  "plane": "Serious project software that makes hosting your responsibility.",
  "plausible-analytics": "Simple analytics when one dashboard answers enough questions.",
  "posthog": "Powerful product analytics that can overwhelm smaller teams.",
  "publer": "Affordable social publishing with limited reports and controls.",
  "puzzle": "Clear startup finances that still require expert verification.",
  "recall": "Useful AI summaries, but never your only information archive.",
  "salesflare": "A smart small-team CRM with a firm ceiling.",
  "saner-ai": "A thoughtful AI assistant that still needs close supervision.",
  "screen-studio": "Polished recordings with movement that explains each step.",
  "senja": "Easy testimonial collection depends on asking better questions.",
  "supademo": "Quick product demos that need someone managing every update.",
  "tally": "A simple form builder with surprising depth underneath.",
  "tella": "Polished screen videos with several frustrating rough edges.",
  "testimonial-to": "Easy testimonial collection still needs careful proof checking.",
  "tidycal": "Cheap scheduling that still needs careful calendar testing.",
  "trigger-dev": "Powerful background jobs that demand safe retry handling.",
  "twenty": "A strong open CRM with demanding maintenance work.",
  "typedream": "Fast website building with limited control over complex layouts.",
  "typingmind": "A powerful AI workspace for people who want control.",
  "umami": "Clear private analytics without tools for deeper analysis.",
  "unkey": "Useful API key management once access becomes customer-facing.",
  "vista-social": "Broad social media software that suits active teams best.",
  "voicenotes": "Excellent for daily thoughts, risky for important recordings.",
  "weweb": "Flexible app building that still requires technical judgment.",
  "wispr-flow": "Excellent voice writing on Mac, inconsistent everywhere else.",
  "wrike": "Powerful cross-team planning with expensive setup and seats.",
};

const reviewFiles = fs.readdirSync(reviewDirectory).filter((file) => file.endsWith(".mdx"));
const reviewSlugs = reviewFiles.map((file) => file.slice(0, -4)).sort();
const mappedSlugs = Object.keys(headlines).sort();

if (JSON.stringify(reviewSlugs) !== JSON.stringify(mappedSlugs)) {
  throw new Error("Headline map must contain every review slug exactly once.");
}

for (const file of reviewFiles) {
  const slug = file.slice(0, -4);
  const reviewPath = path.join(reviewDirectory, file);
  const parsed = matter(fs.readFileSync(reviewPath, "utf8"));
  parsed.data.verdict = headlines[slug];
  parsed.data.cardVerdict = headlines[slug];
  fs.writeFileSync(reviewPath, matter.stringify(parsed.content, parsed.data));
}

console.log(`Shortened ${reviewFiles.length} review headlines.`);
