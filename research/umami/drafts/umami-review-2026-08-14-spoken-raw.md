# Umami review: simple website analytics you can own

Umami is for people who want useful website numbers without spending half the morning inside Google Analytics. It shows where visitors came from and which pages they opened. It can also count a signup or purchase.

The dashboard is easy to understand. The tracking code is small. The standard setup does not use cookies or build a lasting profile of each visitor. You can use Umami's hosted service or run it on your own server.

We recommend Umami for a small website or software company that cares about privacy. It works when a team can make decisions from a short set of reports. We would not use it as the only data tool for a product team that needs to see how each person uses an app over time.

The right test is simple. Send a known set of visits and campaign links through Umami. Add form entries, signups, and payments. Keep it only if the key totals agree with the real records. The team should also be able to answer its weekly questions without another dashboard.

## The dashboard gets the common questions right

Most site owners ask the same questions every week. How many people visited? Which pages brought them in? Did a campaign produce signups? Did anybody click the main button or finish a purchase?

Umami puts those answers in a clean dashboard. It covers pageviews and visitors. It also shows referral sites, campaign tags, devices, browsers, countries, and chosen actions. A chosen action is called a custom event. It can be a form entry or file download. It can also be a new account or another step the site is set up to send.

Goals can mark the actions that matter. Funnels show how many people completed each step in a fixed route, such as landing page, pricing, signup, and payment. Journeys show the pages people visited around a chosen point. Umami also includes retention, revenue, individual sessions, and an API for pulling data into another system.

That is more than a bare traffic counter. It is enough for many company sites and newsletters. It can also cover help sites and small software products. A normal teammate can open the dashboard and understand it. The company does not need a data expert for every answer.

Build the hardest report the team uses today before moving. If the weekly meeting needs signups by campaign, plan, country, and device, make that exact view. If it needs refunds, account roles, feature use, and a six-month customer history, Umami may already be too small for the job.

## Compare its counts with something real

No two data tools produce the same numbers. One may block known bots. Another may count a visit in a different way. A browser add-on may stop the tracking script. A gap does not mean Umami is wrong. A gap in signups or sales still needs an answer.

Run Umami beside the current tool for a full campaign or sales cycle. Visit the site from a phone and computer. Arrive through a tagged email link and a search result. Try another website and a direct address too. Submit a form and start signup. Make a low-value test purchase where that is safe.

Compare page traffic with server logs where possible. Compare new accounts with the account database and purchases with the payment provider. Check whether one click creates one event, and whether a page refresh or payment notice creates a duplicate.

Test ad blockers and common privacy extensions. Exclude office traffic if the company does not want employees in the numbers. Check referrals across a main site, help center, checkout, and any other connected domain.

Write down which differences the team accepts. A useful dashboard does not need to copy Google Analytics. It does need to stay close enough to the records the company trusts.

## Privacy is a good reason to choose it

Umami's standard tracker does not use cookies or fingerprint visitors. It does not follow them across unrelated sites or collect personal data. The company says its tracking script is under 2KB. With your own server, the data stays on systems you control.

That is a clear improvement for a team that wants less invasive measurement. It can also make the website simpler for visitors and reduce the amount of tracking work that needs to be explained.

It does not provide legal clearance. A website may still use ad pixels or chat tools. Video, testing tools, and forms may also collect personal details. A developer can send a person's details inside a custom event. The normal Umami tracker may avoid that data while the custom setup adds it back.

List every script on the site and every company that gets data. Check the exact fields sent with custom events. Make the privacy notice match the real setup. Then ask the right legal or privacy person whether consent is needed where the company works.

Umami can make the analytics part cleaner. It cannot audit everything else on the page.

## Self-hosting gives control and creates a job

Run Umami on your own server and the app and database are under your control. The setup uses Docker. It packs the software so a skilled user can start it without adding every part by hand.

People who already run servers find the setup manageable and the resource use low. That helps a developer compare tools that run on private servers. It does not mean a nontechnical owner should take charge of a live database.

Setup is the first hour. Someone still has to secure the server and add updates. That person must watch disk use and failures too. The database needs a backup and a tested way to restore it. Data control means little if the history cannot be recovered.

Create a production-like test instance. Send enough traffic and custom events to exercise the reports. Back up the database and configuration, delete the test copy, and rebuild it on a clean server. Upgrade a clone before updating the live instance. Confirm that websites, users, events, goals, and reports survive.

Add server cost and staff time to the comparison. Self-hosting makes sense when control, policy, or existing infrastructure justifies the work. It is rarely the cheapest choice for a small site once a capable person's time is included.

## Umami Cloud removes most of that work

Umami Cloud is the hosted version run by the product's own team. The Hobby plan is free for personal projects and low-traffic sites. Paid plans have a 14-day trial and can be billed monthly or yearly.

Cloud usage counts more than page hits. A custom event counts too, and every stored property attached to event data also counts. A busy site that sends several details with every action can use its allowance faster than the pageview total suggests.

Build the event plan before choosing a paid tier. Estimate normal traffic and campaign spikes. Add bots, custom events, and the fields stored with each event. Check the exact limit and renewal amount in the live account. The public docs do not state every current paid price.

The cloud service lets customers export their data. Its servers are in the United States and European Union. Check the chosen region and how long it keeps data. Review user access, deletion, its data agreement, and the export format. Do this before moving a site with firm privacy or recovery rules.

Cloud is the sensible choice when the team wants Umami's reports without running another live service. Choose your own server for control. Do not choose it just to avoid a modest fee.

## The simple reports eventually run out of room

Umami has grown well beyond its early pageview dashboard. It now covers funnels and journeys. It has reports for return visits, campaigns, revenue, speed, goals, and each session. That is enough for more teams than the simple screen may suggest.

The limit appears when a company wants to study a product in detail. A product analytics tool may group people by account, plan, feature use, signup month, or a long chain of actions. It may support tests, complex retention groups, and many ways to compare behavior.

Umami is built around anonymous website measurement. That makes it easier to understand and better for privacy. It also gives the team less history to work with when the question becomes specific.

The API and advanced docs get mixed feedback in recent production talks. Test the real link instead of assuming each screen is easy to copy through the API. Pull the fields for one report. Handle pages and dates. Then check the totals against the dashboard.

Do not reject Umami because it cannot answer a question nobody uses. Do not choose it because the clean home screen hides a report the business needs every month.

## Who should choose Umami?

Choose Umami for a company site or newsletter that needs clear traffic and signup numbers. It also suits a help site or small software product. It is most useful when the team wants tracking without cookies. Data control and the choice to run it on your own server are strong reasons too.

Use Umami Cloud when nobody wants to maintain another server. Self-host only when the company already has the skills and a real reason to own the full system.

Choose a deeper product data tool when decisions depend on account history or feature use. The same is true for tests, detailed return groups, or hard sales credit. A large shop may need richer reports for products and refunds. Coupons and customer history can need more room too.

We did not install Umami or compare its counts. We did not send events or restore a database. We also did not test a paid plan or contact support. The formal review samples are small. Community talks include far more self-hosters than ordinary owners.

Our rule is to run Umami beside the current analytics setup through one real campaign. Test blockers, bots, internal traffic, campaign links, goals, events, revenue, and exports. Compare the results with actual signups and payments.

If self-hosting, prove backup, restore, monitoring, and upgrade on a copy. If using cloud, calculate event data as well as page hits.

Keep Umami when the short dashboard answers the questions people ask. If the team must export the data and rebuild each key report elsewhere, Umami is not doing enough.
