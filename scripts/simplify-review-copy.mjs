import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const edits = {
  claap: [
    ["Instead of writing that the button near the end of a six-minute demo is wrong, a designer can leave the note at the second the button appears.", "A designer does not need to explain where a problem appears in a six-minute demo. They can leave the note at the exact second the button appears."],
    ["Someone must give each recording a clear name, put it in the right place, and write the final decision where the team expects to find it.", "Someone must give each recording a clear name and put it in the right place. The final decision also needs to live where the team expects to find it."],
    ["They should not get the last word when a meeting includes a price, date, customer promise, product name, or person responsible for a task.", "They should not get the last word on prices, dates, customer promises, or product names. The same goes for the person who owns a task."]
  ],
  "companyhub-crm": [
    ["When a contact is created or imported, the CRM can pull the last six months of email and keep later conversations with that address on the contact record.", "When a contact is created or imported, CompanyHub can pull in the last six months of email. New messages with that address then stay on the contact record."],
    ["It can follow a business that has outgrown a spreadsheet without forcing every useful detail into a note or a long list of custom fields.", "It can follow a business that has outgrown a spreadsheet. You do not have to force every useful detail into a note or a long list of extra fields."],
    ["A salesperson should be able to start the day, see the promised calls and overdue replies, open the customer history, and record what happened.", "A salesperson should be able to start the day and see the promised calls and overdue replies. From there, they should be able to open the customer history and record what happened."],
    ["It is less convincing when normal contacts and deals are enough, or when a polished interface and a large market of tested connections matter most.", "It is less convincing when normal contacts and deals are enough. We would also skip it if a polished interface and a large set of tested connections matter most."]
  ],
  deftform: [
    ["Normal forms are quick to make, paid packages include unlimited responses and team members, and one-time prices can be far cheaper than a monthly form subscription.", "Normal forms are quick to make. Paid packages include unlimited responses and team members. The one-time prices can also cost far less than a monthly form subscription."],
    ["The builder includes common field types, file uploads, signatures, payments through Stripe, and an AI tool that can turn a written prompt into a first draft.", "The builder has the usual field types, file uploads, signatures, and Stripe payments. Its AI tool can also turn a written prompt into a first draft."],
    ["The result supports a trial, not a claim that Deftform has the same proof as a mature form service with thousands of reviews.", "That is enough reason to run a trial. It is not enough proof to treat Deftform like a mature service with thousands of reviews."]
  ],
  featurebase: [
    ["The harder question is whether an agent can turn a messy conversation into a clean request, merge duplicates, keep private notes private, and notify the right people when the change ships.", "The harder question starts with a messy support chat. Can the agent turn it into a clean request, merge copies, protect private notes, and tell the right people when the change ships?"],
    ["This can be much cheaper than a person answering every basic question, but only if the answer is correct and the customer can reach a human when it is not.", "This can cost much less than having a person answer every basic question. That only works when the answer is right and the customer can reach a human when it is not."],
    ["A customer can submit an idea, vote on another request, read the roadmap, check recent updates, search the help center, or start a support conversation.", "A customer can submit an idea or vote on another request. They can also read the roadmap, check updates, search the help center, or start a support chat."]
  ],
  fillout: [
    ["It includes 1,000 responses a month, multi-page forms, embedding, payments, scheduling, PDF generation, conditional logic, file uploads, workflows, saved progress, calculations, pre-filled answers, hidden fields, and most integrations.", "It includes 1,000 responses a month, multi-page forms, payments, scheduling, and file uploads. You also get PDF creation, workflows, saved progress, calculations, pre-filled answers, hidden fields, and most integrations."],
    ["An existing client can open a private link with known details already filled in, change an address, and update the right record instead of creating a duplicate.", "An existing client can open a private link with known details already filled in. They can change an address and update the right record instead of making a copy."],
    ["Both can also cause a serious mistake if the link is shared with the wrong person or the hidden value points to the wrong record.", "Both can also cause a serious mistake. That can happen if the link reaches the wrong person or a hidden value points to the wrong record."]
  ],
  folk: [
    ["A partnership manager, agency owner, recruiter, or small sales team can see who a person is, what happened last, and what should happen next.", "A partnership manager, agency owner, recruiter, or small sales team can see who a person is. They can also see what happened last and what should happen next."],
    ["Look elsewhere if managers need to rebuild the numbers outside folk or if the team spends more time fixing contact history than using it.", "Look elsewhere if managers need to rebuild the numbers outside folk. Do the same if the team spends more time fixing contact history than using it."],
    ["The test is whether simplicity survives your real data, privacy needs, and reporting, not whether the demo looks cleaner than the CRM you dislike.", "The real test is whether that simplicity survives your data, privacy needs, and reports. A clean demo is not enough."]
  ],
  formbricks: [
    ["These include removing Formbricks branding, team roles, customer segments, audit logs, sign-on controls, spam protection, detailed feedback tools, advanced dashboards, support targets, and wider workspace limits.", "These include team roles, customer groups, audit logs, sign-on controls, and spam protection. Higher plans also remove Formbricks branding and add more feedback tools, dashboards, support, and workspace capacity."],
    ["It includes unlimited surveys, responses, and users, along with link, website, app, and email surveys, logic, styling, APIs, software kits, webhooks, follow-up email, and integrations.", "It includes unlimited surveys, responses, and users. You can run surveys through a link, website, app, or email and connect them through APIs, webhooks, and other tools."],
    ["It may also be too early for a large company that needs every specialized experience-management report and governance process found in an older enterprise suite.", "It may also be too early for a large company with strict rules and specialized reports. Older business survey suites go much deeper there."]
  ],
  frill: [
    ["The pricing page also shows Privacy, Surveys, and White Labeling as add-ons, so confirm whether a lower plan can buy one separately and what the final monthly total will be.", "The pricing page also shows Privacy, Surveys, and White Labeling as add-ons. Check whether your plan can buy the one you need and what the final monthly bill will be."],
    ["An active idea is a request currently on the board; the exact handling of archived or completed ideas should be checked during the trial.", "An active idea is a request that is still on the board. Check how archived and completed ideas count during the trial."],
    ["If the company already has a support product that handles requests, roadmaps, and updates well, adding Frill may create another place to maintain.", "Your current support tool may already handle requests, roadmaps, and updates. If it does, Frill may create one more place to maintain."]
  ],
  "lemon-squeezy": [
    ["It is a harder choice for a company that needs daily or highly predictable access to cash, cannot tolerate account-review uncertainty, or already operates direct payments and tax compliance well at lower cost.", "It is a harder choice when a company needs daily or highly predictable access to cash. We would also skip it if account reviews create too much risk or direct payments and tax already cost less."],
    ["Lemon Squeezy can suit a small software or digital-product seller that values global tax handling, subscriptions, licenses, and billing support more than the lowest processing fee.", "Lemon Squeezy can suit a small software or digital product seller that wants help with tax and billing. It makes the most sense when that help matters more than the lowest payment fee."],
    ["For a founder who would otherwise register and file sales tax in many places, the service can be worth much more than the payment button.", "Some founders would otherwise register and file sales tax in many places. For them, the service is worth much more than the payment button."]
  ],
  pipedream: [
    ["It is harder to recommend when nontechnical staff must own changes, when the exact connector is missing and nobody wants to maintain it, or when strict cost forecasting matters more than flexible compute.", "It is harder to recommend when nontechnical staff must own changes. We would also skip it if the connector is missing, nobody wants to maintain code, or costs must be easy to predict."],
    ["Trouble starts when one field needs an unusual format, the app exposes a new API route, or the workflow must call a service that has no complete connector.", "Trouble starts when one field needs an unusual format or an app changes its API. The same is true when a service has no complete connector."],
    ["Pipedream provides the web address that receives the message, handles many of the app logins, runs the steps, and keeps a history of what happened.", "Pipedream gives you the web address that receives the message and handles many of the app logins. It then runs the steps and keeps a history of what happened."]
  ],
  "pirsch-analytics": [
    ["Standard includes custom events, goals, session analysis, ecommerce revenue, automatic reports, alerts, a URL shortener, Google Search Console data, APIs, SDKs, webhooks, and imports from Google Analytics, Plausible, and Fathom.", "Standard adds custom events, goals, session analysis, shop revenue, reports, and alerts. It also has a URL shortener, Search Console data, developer tools, and imports from Google Analytics, Plausible, and Fathom."],
    ["Do not send names, email addresses, full IP addresses, payment data, search text with personal details, or raw form answers just because the API accepts fields.", "Do not send names, email addresses, full IP addresses, or payment data. The same warning applies to search text with personal details and raw form answers."],
    ["Pirsch is worth testing for a small company that wants simple EU-hosted traffic and conversion analytics, especially when server-side events and a developer API matter.", "Pirsch is worth testing for a small company that wants simple, EU-hosted traffic reports. It becomes more useful when server events and a developer API matter."]
  ],
  plane: [
    ["The current pricing page includes dashboards, cycle charts, project overviews, and advanced widgets across its paid plans, but the name of a feature does not prove the exact report exists.", "The paid plans include dashboards, cycle charts, project overviews, and advanced widgets. A feature name does not prove that the exact report you need exists."],
    ["Ask a normal team member to find yesterday's decision, the reason a bug was closed, the file attached six months ago, and every unfinished item for the next release.", "Ask a normal team member to find yesterday's decision and the reason a bug was closed. Then ask for an old file and every unfinished item for the next release."],
    ["A team should choose Plane for the way daily work runs, then decide whether it also wants to operate the project system itself.", "Choose Plane for the way your daily work runs. After that, decide whether your team also wants to operate the project system itself."]
  ],
  "plausible-analytics": [
    ["Complete a form, download a file, click an outside link, start signup, and buy a low-value test item where safe.", "Complete a form and download a file. Click an outside link and start signup. Buy a low-value test item where that is safe."],
    ["A long read should not be treated as a zero-second failure merely because the person found everything on one page.", "A long read is not a zero-second failure. The person may have found everything on one page."],
    ["This can remove a large amount of invasive tracking and may reduce the need for analytics consent in many setups.", "This can remove a lot of invasive tracking. In many setups, it may also reduce the need for analytics consent."],
    ["If the answer requires an export and a private explanation of six definitions, simplicity has not solved the problem.", "The answer should not require an export and a private lesson on six terms. If it does, simplicity has not solved the problem."]
  ],
  publer: [
    ["Business starts at $10 a month and adds fuller analytics, exports, suggested posting times, competitor details, hashtag data, unlimited AI prompts, and more tools for repeated content.", "Business starts at $10 a month and adds fuller reports, exports, and suggested posting times. It also includes competitor details, hashtag data, unlimited AI prompts, and more tools for repeated content."],
    ["We would also look elsewhere if a large agency needs detailed roles, several approval stages, or a mobile app that matches every part of the web product.", "A large agency may need detailed roles and several approval stages. We would also look elsewhere if the phone app must match every part of the web product."],
    ["You can see the week on a calendar, change the words for each network, upload many posts at once, and repeat posts that stay useful.", "You can see the week on a calendar and change the words for each network. You can also upload many posts at once and repeat posts that stay useful."]
  ],
  puzzle: [
    ["Include a monthly subscription, an annual prepayment, a midterm upgrade, a refund, a discount, a cancelled contract, and a start date that differs from the payment date.", "Include a monthly plan, an annual prepayment, a midterm upgrade, and a refund. Add a discount, a cancelled contract, and a start date that differs from the payment date."],
    ["The pricing page currently shows standard annual list rates of $25 per month for Starter, $60 for Core, $100 for Complete, and $300 for Scale.", "The annual list price is $25 a month for Starter and $60 for Core. Complete is $100 a month, while Scale is $300."],
    ["A chart of accounts is the list of places where money is recorded, such as cash, subscription revenue, payroll cost, loans, and prepaid software.", "A chart of accounts is the list of places where money is recorded. Examples include cash, subscription revenue, payroll, loans, and prepaid software."],
    ["It is harder to recommend for a company with complex entities, inventory, unusual tax rules, deep firm controls, or reports the trial cannot produce.", "It is harder to recommend for a company with complex entities, inventory, or unusual tax rules. Skip it if you need deep firm controls or reports that the trial cannot produce."]
  ],
  salesflare: [
    ["If the second person still needs to search Slack, ask a colleague, and read an entire email chain, the company has moved the mess rather than fixed it.", "The second person should not need to search Slack, ask a colleague, and read a whole email chain. If they do, the company has moved the mess instead of fixing it."],
    ["They can help a small team stay consistent, but they need an escape route when the person replies, opts out, changes company, or asks not to be tracked.", "These messages can help a small team stay consistent. They still need to stop when a person replies, opts out, changes company, or asks not to be tracked."],
    ["After a test meeting, add a note, change the deal stage, assign a task, find the last email, call the contact, and hand the lead to somebody else.", "After a test meeting, add a note and change the deal stage. Then assign a task, find the last email, call the contact, and hand the lead to somebody else."],
    ["It is a poor match for a company that needs deep customization, complex permissions, unusual sales routes, or detailed management reporting that the trial cannot reproduce.", "It is a poor match for a company that needs deep changes, complex permissions, or unusual sales routes. We would skip it if the trial cannot reproduce the reports managers need."]
  ]
};

for (const [slug, pairs] of Object.entries(edits)) {
  const file = path.join(root, "content", "reviews", `${slug}.mdx`);
  const parsed = matter(fs.readFileSync(file, "utf8"));
  for (const [before, after] of pairs) {
    if (!parsed.content.includes(before)) throw new Error(`Could not find edit in ${slug}: ${before.slice(0, 60)}`);
    parsed.content = parsed.content.replace(before, after);
  }
  parsed.content = parsed.content.replace(/^(\s*-\s+[^\n.!?]+)$/gm, "$1.");
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
}

console.log("Readability copy edit complete.");
