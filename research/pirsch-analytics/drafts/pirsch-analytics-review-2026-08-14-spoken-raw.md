# Pirsch Analytics review: compare it with the orders

Pirsch Analytics is for teams that want to know what people do on a website without spending Monday morning inside a huge reporting tool.

It shows visits, pages, traffic sources, events, goals, funnels, and sales. The dashboard is deliberately simple. Pirsch is hosted in Germany and can collect data through a small browser script or from the website's own server.

We like that direction for a small business. A shorter dashboard is useful when it answers the questions people actually ask. It is not useful when clean charts hide missing or double-counted activity. Run Pirsch beside the current system and compare both with real orders before replacing anything.

## Start with five questions

Do not begin by importing every old report. Write down the five questions the team needs to answer each week.

They might be:

- How many people reached the pricing page?
- Which campaign brought qualified visitors?
- How many started signup?
- Where did they leave the signup route?
- How many paid?

Pirsch can cover this work with page views, custom events, goals, and funnels. A goal is a success action such as a signup or purchase. A funnel is the ordered route toward it, such as landing page, pricing, account creation, checkout, and payment.

Build only what is needed to answer those questions. Give events plain names. “Signup completed” is better than “event_17.” Write down exactly when each one should fire.

Then ask somebody who did not build the setup to answer the five questions. If that person needs a tour of every filter, the dashboard has not made analytics simpler.

A clean interface and quick setup are the strongest themes in Pirsch's small public sample. The product also receives praise for its entry price, privacy approach, developer options, and responsive support.

## Browser and server tracking count different things

The browser script runs on the visitor's device. It can see page changes and clicks, but a blocker, failed script, or browser rule may stop it.

Server-side tracking means the website's own server sends the visit or event to Pirsch. It is useful for recording a completed order after the payment system confirms it. It can also collect events even when browser code is blocked.

That does not make the number automatically correct. Servers handle bots, health checks, payment retries, previews, and internal tools. The same payment notice may arrive twice. A browser event and a server event may both count one signup.

Create a small test sheet. Visit from a phone and computer. Use a common blocker. Sign in and out. Refresh the thank-you page. Send the same server event twice. Trigger a payment retry. Visit from the office network and a staging site.

For each action, state whether Pirsch should count it, count it once, or ignore it. Then compare the dashboard with the test sheet.

For purchases, compare Pirsch with the payment provider and order database. Analytics does not have to match every source to the last digit. Browser privacy rules and definitions create honest differences. The team does need to explain the gap. An unexplained 15% difference is not a decision tool.

## Cookie-free is useful, not magical

Pirsch is designed to work without tracking cookies. It creates an anonymized visitor identifier from request information rather than storing a lasting identifier in the browser. That can reduce invasive tracking and some consent work.

“Cookie-free” does not settle every privacy question. The site still processes data. Custom events can include information that should never be sent. Server tracking can attach account or order details. Other scripts on the same site may still require consent.

Decide what the business truly needs. Do not send names, email addresses, full IP addresses, payment data, search text with personal details, or raw form answers just because the API accepts fields.

Review the setup with the person responsible for privacy and applicable law. Check the data-processing agreement, retention, access, deletion route, and the countries involved in any connected service. Pirsch states that its cloud service and data are in Germany. The implementation still belongs to the website owner.

Test the page before and after a visitor's consent choice. Make sure the written privacy notice matches what the site really sends. We did not perform a legal or technical privacy audit.

## Campaign credit needs a real campaign

Attribution is the rule that decides which source or campaign gets credit for a signup or sale. Simple analytics tools usually do well with direct visits, referring sites, search, and campaign tags in a link. Paid advertising can be harder.

An ad platform may model conversions, connect activity across devices, or use its own view-through window. Pirsch intentionally does not build the same personal tracking profile. The two systems can disagree without either number being a simple lie.

Run one small campaign with unique tags. Click it on a phone, return directly on a laptop, and complete the goal. Try a purchase after several days. Compare Pirsch, the ad platform, the payment system, and the campaign's tagged landing-page visits.

Decide which report answers which question. Pirsch can show what happened on the site. The payment system shows money received. The ad platform estimates the sales influenced under its own rules.

If the marketing team needs deep cross-device or paid-media optimization, Pirsch may not provide enough detail alone. That limit appears in recent buyer discussions. Do not discover it after removing the tags and exports the team already uses.

## Pirsch goes further than a basic traffic counter

Pirsch is not limited to a page-view total. Standard includes custom events, goals, session analysis, ecommerce revenue, automatic reports, alerts, a URL shortener, Google Search Console data, APIs, SDKs, webhooks, and imports from Google Analytics, Plausible, and Fathom.

Plus adds funnels, audience segments, A/B testing, advanced short links, teams, custom domains and themes, broad white-label controls, and priority support. Those additions make Plus useful for an agency that wants clients to enter a branded dashboard.

The developer options are a real strength. Browser tracking can be proxied through the site's own address. Backend SDKs and an API allow the company to send trusted events from its application. Native webhooks can move selected results elsewhere.

The product is still smaller than the leading analytics platforms. Its public review history, integration ecosystem, tutorials, and hiring pool are smaller too. Complex filters and unusual analysis may require an export or another tool.

Build the hardest report the team uses now. Segment a goal by campaign, device, country, and page route. Compare two periods. Export the result. If the answer cannot be produced without rebuilding it in a spreadsheet every week, Pirsch is not replacing that report.

## The price is low at small traffic

Pirsch offers a 30-day trial and does not require a card.

At 10,000 monthly page views, Standard costs $6 per month. It includes up to 50 websites, unlimited members, unlimited data retention, events, goals, session analysis, APIs, imports, and exports.

At the same traffic level, Plus costs $12 per month. It includes unlimited websites plus funnels, tests, segments, teams, custom domains, themes, white-labeling, and priority support.

Enterprise is custom. It covers a managed private cloud or on-premise installation, SAML sign-in, raw data access, personal onboarding, training, consulting, custom work, and dedicated support.

Pricing rises with monthly usage. A page view is not the only billable item. Custom events count toward the allowance, as do 10% of events used to extend sessions. Deleted sites keep counting until the billing period resets.

When the limit is reached, dashboard access is restricted to the day of the limit. Pirsch says it continues collecting for five more days. The account must upgrade within that period or wait for the allowance to reset to avoid a gap.

Estimate page views and every important event. A shop that sends five events per order may move through a traffic tier faster than the headline page count suggests. Add seasonal spikes and staging mistakes.

Prices exclude applicable tax. Payment is available by card, PayPal, and SEPA debit in euros. Check annual pricing in the live calculator because the page changes it with traffic and billing choice.

## Open core does not mean a free full deployment

Pirsch publishes the Go analytics core. Developers can inspect how the basic visitor identification and collection work. That is useful.

The complete dashboard, account system, billing product, and supported application are not offered as a free self-hosted package. On-premise installation is an Enterprise feature.

A buyer who wants ordinary hosted analytics will not care. A buyer choosing Pirsch because “open source” sounds like a future free exit needs to understand the boundary before signing. Ask what code and data can be exported, what an on-premise agreement costs, and how a move would work.

Test the CSV export and API during the trial. Import a small set from the old analytics tool, then export it again. Keep event definitions outside Pirsch so another system can understand them later.

## Who should choose Pirsch Analytics?

Pirsch is worth testing for a small company that wants simple EU-hosted traffic and conversion analytics, especially when server-side events and a developer API matter. Agencies may like Plus for its many sites and branded client access.

It is less suitable when the marketing team depends on deep ad attribution, highly flexible exploration, or a large ecosystem of ready-made reports. It is not a free full self-hosting choice.

The independent satisfaction sample is tiny. Five Product Hunt reviews and one verified G2 review cannot prove broad reliability. Community discussions and comparisons support the product boundaries, but we did not install it or contact support.

Our rule is to run Pirsch beside the current system for a complete campaign and purchase cycle. Test browser and server collection, duplicate events, blockers, bots, internal visits, goals, a funnel, an import, and an export.

Compare both dashboards with real signups, orders, and campaign spend. Keep Pirsch if someone outside the setup can answer the five weekly questions and explain the important differences. If the team cannot explain the numbers, a cleaner chart has not made the decision any clearer.
