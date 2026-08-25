import fs from "node:fs";

const edits = {
  "companyhub-crm": [
    ["The total sample is modest, and direct community discussion is almost absent, so the trial has to carry more weight than the ratings.", "The total sample is modest. Direct community discussion is also almost absent. Your trial therefore has to carry more weight than the ratings."],
    ["Clear navigation matters more than fashionable design, but a sales team still has to be willing to work in it every day.", "Clear navigation matters more than fashionable design. Even so, a sales team still has to be willing to work in it every day."],
    ["Ask them to add a lead, schedule a follow-up, send a message, update a deal, and find the next task without help.", "Ask them to add a lead, schedule a follow-up, and send a message. Then have them update a deal and find the next task without help."]
  ],
  featurebase: [
    ["Featurebase is a good candidate for a growing software team that wants feedback, product updates, help content, and support to share customer context.", "Featurebase is a good candidate for a growing software team that wants its customer work in one place. Feedback, product updates, help content, and support can all share the same context."],
    ["If it helps the same customer move from question to request to update without losing context, the suite can replace several awkward handoffs.", "The same customer can move from a question to a request and then an update. If the context survives that trip, the suite can replace several awkward handoffs."]
  ],
  pipedream: [
    ["For the payment example, state which order grants access, what happens on a refund, which system holds the customer record, and when a person must intervene.", "For the payment example, state which order grants access and what happens on a refund. Name the system that holds the customer record and decide when a person must step in."],
    ["Pipedream is a strong product to test for a developer who needs to connect APIs quickly and wants code-level control without operating another service.", "Pipedream is a strong product to test for a developer who needs to connect APIs quickly. You get control over the code without having to operate another service."]
  ],
  plane: [
    ["Plane is a project tracker for teams that want the parts of Jira they use without starting with years of settings and plugins.", "Plane is a project tracker for teams that only want the useful parts of Jira. You do not start with years of settings and plugins."],
    ["A cycle is a fixed period, often one or two weeks, in which a team plans to finish a selected group of items.", "A cycle is a fixed period, often one or two weeks. The team chooses a group of items to finish during that time."],
    ["The core is open, while some advanced features, official identity connections, access controls, support, and managed or air-gapped deployments belong to paid editions.", "The core is open. Some advanced features, company sign-in, access controls, and support require a paid edition. Managed and isolated deployments also cost money."],
    ["Plane is worth testing for a software, product, or operations team that wants a clean project system with broad planning and wiki features.", "Plane is worth testing for a software, product, or operations team that wants a clean project system. It has broad planning and wiki features without Jira's weight."]
  ],
  "plausible-analytics": [
    ["If that person closes the tab without another event, the tracker has little later proof of the time spent.", "If that person closes the tab without another event, the tracker has little proof of time spent. That can make a useful visit look empty."],
    ["Ask what happens when the allowance is exceeded and how quickly a dashboard can be unlocked after an upgrade.", "Ask what happens when the allowance is exceeded. Also check how quickly an upgrade unlocks the dashboard."],
    ["A business site with fewer valuable visits may consider $9 or $19 inexpensive for a dashboard people actually use.", "A business site may have fewer visits, but each one can be valuable. In that case, $9 or $19 is a fair price for a dashboard people use."],
    ["The website may still run advertising pixels, chat, video embeds, testing tools, or forms that store identifiers.", "The website may still run ad trackers, chat, video embeds, and testing tools. Its forms may also store details that identify a person."]
  ],
  puzzle: [
    ["A company can pay $12,000 for a year of software and record $1,000 of cost each month instead of all $12,000 on day one.", "A company can pay $12,000 for a year of software. Its books may then record $1,000 of cost each month instead of the full amount on day one."],
    ["We would let the accountant close two real difficult months in both systems and prove every important number back to its source.", "We would let the accountant close two difficult months in both systems. Every important number should trace back to its source."],
    ["Export the general ledger, trial balance, statements, chart of accounts, journal entries, reconciliations, attached records, vendor or contractor detail, and audit history.", "Export the general ledger, trial balance, statements, chart of accounts, and journal entries. Then export the matching work, attached records, vendor details, and change history."]
  ],
  salesflare: [
    ["Include two people with the same name, several people from one company, old addresses, aliases, forwarded messages, personal email accounts, and a contact who changed jobs.", "Include two people with the same name and several people from one company. Add old addresses, aliases, forwarded messages, personal email accounts, and a contact who changed jobs."],
    ["It includes the core CRM, automatic data input, email and website tracking, the sidebar, mobile app, personalized email campaigns, and five lead credits each month.", "It includes the core CRM, automatic data input, email and website tracking, the sidebar, and the phone app. You also get personal email campaigns and five lead credits each month."],
    ["We did not connect an inbox, import contacts, run a sequence, test the phone, build a dashboard, export data, change a subscription, or contact support.", "We did not connect an inbox, import contacts, or run an email sequence. We also did not test the phone, build a dashboard, export data, change a plan, or contact support."]
  ],
  twenty: [
    ["Reviews often praise its clean screens and simple flow.", "Its clean screens and simple flow are real strengths."],
    ["Public reports split on upgrades. Some users say small installs moved through each update without much trouble. Other users report failed upgrades that needed hands-on work in the database. Both reports can be true", "Upgrades are the part we would watch. Small installs can move through an update without much trouble. Failed upgrades can also require hands-on work in the database. Both outcomes are possible"],
    ["Reviews point to gaps in marketing tools, mobile use, reports, app links, access rules, and complex flows.", "Marketing tools, mobile use, reports, app links, access rules, and complex flows all need checking."],
    ["A few reviews mention slow replies, but the stored sample is not broad enough to call that a common fault.", "Slow replies appear in the sample, but not often enough to call them a common fault."]
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

console.log("Final copy edits complete.");
