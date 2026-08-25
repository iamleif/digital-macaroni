Formbricks is survey software for links, websites, email, and questions shown inside a product. You can ask a visitor about a page, ask a new customer about setup, or ask someone why they canceled.

It can be hosted by Formbricks or run on your own server. The core code is open source, and developers get APIs and software kits for connecting surveys to a website or app.

The important part is not the survey design. It is whether the right person sees the right question at the right time, once. That can make Formbricks much more useful than a simple survey link. It is also where the work becomes technical.

We recommend Formbricks when control over survey data matters and you have the technical help to run it properly.

## In-product surveys are the main reason to look

A link survey waits for someone to open a URL. An in-product survey appears while a person uses the site or app. The team can show it after a real event, such as finishing setup, using a new feature, or pressing Cancel.

That timing gives the answer context. Asking everyone whether setup was easy is vague. Asking a new customer after they complete the last setup step can reveal exactly where the process worked or failed.

Formbricks supports targeting rules. Targeting decides who can see the survey and when. Rules may use a person's plan, language, activity, or other saved details. The product also supports hidden fields and known respondent details so an answer can connect to the right context.

This is powerful, but a mistake can make the survey annoying or misleading. A repeated event might show it twice. A shared computer might attach an answer to the wrong account. A customer might see a cancellation survey after changing their mind. A survey intended for new users might reach an experienced admin.

During the trial, use test accounts with different plans and histories. Trigger the same event twice. Sign out and switch users. Open the app on a phone. Dismiss the survey and return later. Who becomes eligible again? Which record receives each answer? Confirm both.

The builder itself receives strong praise for clean setup, customization, logic, and integrations. The API and product targeting are also common positives. None of that replaces an identity test. The colors can be perfect while the response belongs to the wrong person.

## Cloud and self-hosted are different choices

Formbricks Cloud removes the server work. You add the survey to the product, while Formbricks operates the service and stores the response data in its cloud setup. The current pricing page says the cloud service is hosted in Frankfurt.

Self-hosting means the team runs Formbricks on infrastructure it controls. This can help an organization meet a specific deployment or data rule. It also means the team owns the database, secure web access, email, storage, backups, monitoring, updates, and incident response.

The minimum server requirements look modest: one CPU, 2 GB of memory, and 8 GB of storage. Those numbers only tell you that the software can run. Can it survive a failed update? Can it send follow-up email and restore old responses? Can it stay online during a product launch? The server size does not prove any of that.

Some technical users describe self-hosting as easy. Others describe setup and changes as difficult. Both can be true. A team already running web services may find the Docker setup familiar. A team choosing self-hosting mainly to avoid a cloud bill may discover that the server was the cheapest part.

We would start with Cloud unless the organization can state a clear reason to self-host. If self-hosting matters, set up a test deployment and restore it from backup. Update a copy before updating the live service. Complete a real survey after each change. Monitor the public survey route, not only the admin login.

## Open source does not mean every feature is free

The Formbricks core uses the AGPLv3 license. The Community Edition can be self-hosted for commercial use. It includes unlimited surveys, responses, and users. You can run surveys through a link, website, app, or email and connect them through APIs, webhooks, and other tools.

Some advanced features use a separate Enterprise license. These include team roles, customer groups, audit logs, sign-on controls, and spam protection. Higher plans also remove Formbricks branding and add more feedback tools, dashboards, support, and workspace capacity.

One permission detail is especially important. In the Community Edition, each user has admin rights. A company that needs people to manage only certain projects or surveys requires the paid role system.

This open-core split is the main source of frustration in the critical feedback. Some self-hosters expected an advanced feature to remain in the free edition. Formbricks has also moved some features between editions in the past.

The solution is not to debate the label after deployment. Write down every required feature first. Match each one against the current Community and Enterprise table. Include branding, roles, identity, spam, audit history, and support. Also decide how the license affects private code changes. Get the paid terms in writing if the list crosses into Enterprise.

## Formbricks pricing

The Cloud Hobby plan is free for one workspace and 250 responses a month. It includes link and in-product surveys, all question types, logic, hidden fields, partial responses, file uploads, single-use links, and full API access.

Cloud Pro costs $74 a month when billed yearly and includes 2,000 responses across three workspaces. It adds unlimited seats, branding removal, respondent identity, contact and segment tools, integrations, follow-up email, webhooks, mobile app software kits, and AI translation.

Cloud Scale costs $325 a month when billed yearly and includes 5,000 responses across five workspaces. It adds teams and roles, response quotas, advanced feedback management, custom charts, two-factor authentication, and spam protection. Enterprise add-ons require contact with sales.

Annual billing gives two months free, which means month-to-month prices are higher. The Pro trial lasts 14 days and does not require a card.

The jump from free to Pro is large for a small team that needs 300 responses or one paid control. Self-hosting can remove response limits in the Community Edition, but it trades a subscription for infrastructure and staff work. It may still be the right deal when data control is the reason, not when the only goal is avoiding $74.

## The customer evidence needs restraint

Product Hunt shows 23 very positive reviews, and G2 has 15 reviews with a high score. Those samples praise the builder, privacy, self-hosting, customization, integrations, and support. They are useful but small and favorable.

The negative counter-sample is also small. It points mainly to enterprise gates, branding, expense, setup, and a product that is still growing into the depth of the largest feedback suites.

We did not create a survey, deploy a server, or contact support. We therefore would not use the high ratings as proof that every workflow is mature. The right approach is a narrow test of the actual survey and deployment choice.

## Who should choose Formbricks?

Formbricks suits a software team that wants feedback tied to product behavior. It is also worth considering when open code or self-hosted data is a firm requirement.

It is unnecessary when a simple emailed survey link already answers the question. It may also be too early for a large company with strict rules and specialized reports. Older business survey suites go much deeper there.

Our decision rule is clear. Run one real survey with real eligibility, identity, and frequency rules. Make events arrive twice, switch accounts, dismiss and return, and test mobile. Check that each answer reaches the right user and report.

For self-hosting, add a second list. Match every required feature to the license, send email, restrict access, restore a backup, update a test copy, and monitor the live survey path. Choose Formbricks only when the survey works and someone owns the service behind it.

Formbricks offers a serious mix of product surveys, open code, and deployment control. The value is real. So is the work hidden behind a short question shown at exactly the right moment.
