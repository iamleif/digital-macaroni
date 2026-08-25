# PostHog review: take one feature to rollback

PostHog can replace a surprising number of product tools. It tracks what people do. It reconstructs sessions. It controls feature rollouts, runs tests and surveys, catches errors, and moves data.

The parts are meant to share the same events and user context. A team can see that signup completion fell, open the failed sessions, release a fix to 10% of people, and compare the result.

That closed route is the reason to use PostHog. Turning on every product at once is not. We would take one real feature from question to rollback before deciding how much of the suite to adopt.

## Start with the decision, not the tracking code

PostHog can begin collecting activity quickly. A snippet or SDK can automatically capture page views, clicks, and other actions. Quick data feels like progress, but it can create a large pile nobody trusts.

Write the question first. For example: “Why do new team owners leave before inviting a colleague?” The decision may be whether to change the invite step.

Name the few events needed to answer it. They might be signup completed, invite page viewed, invite sent, invite failed, and first colleague joined. State exactly when each one fires and which fields belong with it.

Use a test account and perform each action once. Check that PostHog receives one event with the right time, account, app version, and result. Refresh the page. Go back. Open two tabs. Retry a failed request. Make sure one action does not appear two or three times.

Then compare the count with the product database. The number of successful invites should match the source record closely enough to explain any gap.

Automatic capture can help find an action the team did not plan. It should not become the permanent name for every important product event. A clear event such as “invite sent” will survive a button label change. A captured CSS selector may not.

Assign an owner to the event list. Delete unused events and private fields. Analytics gets harder, slower, and more expensive when nobody cleans it.

## Replay should answer a narrow question

Session replay rebuilds what happened on a screen from page changes and user input. It is not a literal camera video. It can show a dead click, a form error, a screen that shifted, or the route a person took before leaving.

Do not spend an afternoon watching random sessions. Start with the failed invite group from the analysis. Open only those sessions and look for a repeated obstacle.

Before production, test privacy masking. Enter a name, email, password, payment detail, private message, and customer file into a test account. Open the replay as a normal analyst. Sensitive values should be hidden or excluded.

Check the page source and network too. A hidden replay field should not send the secret first and cover it only in the viewer. Limit who can access replays. Set retention around a real need.

Measure page and app performance before and after replay. Use a slow phone and weak network. Watch script load, main-thread work, memory, data use, and errors. SDK bugs and replay overhead appear as mixed concerns in the public sample.

If replay makes the product slower for every user so a few staff members can inspect it, sample fewer sessions or turn it off. Context is useful only when collection does not create the next problem.

## A feature flag is also an emergency switch

A feature flag is a switch that turns a feature on for chosen users without requiring another app release. The team can show the new invite flow to staff, then 10% of customers, then everyone.

Test the flag when PostHog is fast, slow, and unavailable. Decide which version appears when the flag cannot be read. For a risky new feature, the safe answer may be the old version. For an urgent security fix, the answer may differ.

Avoid a visible flash where the old screen loads and then changes. Check server and client decisions for the same user. A person should not move between versions during one task unless the test is designed that way.

Roll the change to 10%. Watch invite completion, errors, support messages, and page speed. Keep a stop rule. For example, roll back if errors rise above a chosen number or completion falls by five points.

Use the flag to roll back. Then confirm that every server and app version obeys it. An emergency switch that takes 30 minutes to reach mobile clients is not an instant rollback.

Flags need cleanup. Remove the old route and the flag after the decision. A product full of permanent switches becomes difficult to test and reason about.

## An experiment needs one answer

An experiment gives different groups different versions and compares a chosen result. It does not turn a small random change into proof.

Choose the main result before starting. For the invite flow, that could be the share of new owners whose colleague joins within seven days. Pick safety measures too, such as error rate or support contacts.

Make sure people stay in the same group. Do not stop the test the first afternoon one version looks ahead. Account for seasonality, small samples, several devices, and many measures. Ask somebody who understands test design to review a high-stakes result.

PostHog can connect feature flags, events, groups, surveys, and experiments. That is useful. It reduces the work of moving users and results between services.

The tool cannot decide whether the event measures a meaningful outcome. It cannot repair a biased sample. It cannot explain why the result matters to the business. Write the decision that follows each possible outcome before looking at the chart.

## The suite can reduce tool stitching

PostHog now includes product and web analytics, replay, flags, experiments, surveys, error tracking, a data warehouse, pipelines, logs, AI monitoring, workflows, and more.

A software team might otherwise buy one product for each of those jobs. Separate tools bring separate identity rules, scripts, access controls, bills, and data exports. Connecting a replay account to the same person and release shown in analytics can take work.

PostHog's broad platform can remove that stitching. This is the strongest reason to grow with it.

The same breadth creates a dense interface and a real learning curve. More than a thousand G2 reviews repeat both sides. Users praise setup, replay, free capacity, and the integrated tools. They also mention confusion, missing edges, and the time needed to learn the wider product.

Adopt products in the order of a real question. Analytics may come first. Replay may help explain a key failure. Flags may then control the fix. Do not add surveys, error tracking, pipelines, and a warehouse only because their free limits exist.

Each new product needs an owner, privacy decision, retention rule, cost limit, and removal plan.

## Pricing is generous and has many meters

PostHog Free needs no card. It includes one project, one year of retention, unlimited team members, and a separate monthly allowance for many products.

The current free allowances include:

- 1 million analytics events
- 5,000 web session recordings
- 2,500 mobile recordings
- 1 million feature flag requests
- 100,000 error exceptions
- 1,500 survey replies
- 1 million managed warehouse rows
- 10,000 data pipeline trigger events
- 100,000 AI monitoring events
- 500 PostHog AI credits
- 10 GB of logs
- 10,000 workflow emails per channel

Pay-as-you-go starts at $0 because the same allowances remain free. It adds six projects, seven years of retention, and email support. Usage above each free amount is charged separately. Rates fall as volume grows.

The first paid analytics band after one million costs $0.00005 per event. The first paid replay band costs $0.005 per web recording. The first paid flag band costs $0.0001 per request. Surveys start at $0.10 per reply after the free 1,500.

Those small units can become large totals. A client event fired on every screen render can use millions of events. A flag checked repeatedly in a busy service can use far more requests than the number of users. Full replay can grow with every visit.

Use a free project with real sampling. Review volume by event, recording, flag, and product. Forecast a normal month, a launch, an error storm, and doubled traffic.

Set a separate billing limit for each product. Decide what happens at the limit. Dropping replay is different from refusing a flag check or losing an analytics event. Add the price of platform packages only if the team needs their access, support, or control features.

## Self-hosting is a data platform

PostHog publishes code and has a long self-hosting history. Running it is not like hosting a small website.

Product events arrive continuously. Replays and logs create heavy storage. Databases need enough memory and disk. The team owns backups, upgrades, queues, monitoring, email, object storage, security, and recovery.

Community discussions repeatedly warn that self-hosting takes meaningful work. Some teams recommend the large cloud free tier instead. That is sensible when data policy does not require a private deployment.

If self-hosting is required, estimate event volume, replay storage, retention, query load, and growth. Build a production-like copy. Fill it with test volume. Lose a worker, fill a disk, restore from backup, and upgrade the clone.

Compare every needed cloud product with the current self-hosted edition. Open code does not guarantee the same feature or support route. Add engineer time and on-call work to the cost.

## Who should choose PostHog?

PostHog is a strong choice for a technical product team that wants analytics, replay, flags, and tests to use the same product language. It can be especially good for a startup that would otherwise connect several vendors.

It is too much for a site that only needs simple traffic numbers. It can also be the wrong choice when nobody will govern events, privacy, flags, and cost.

We did not install an SDK, capture an event, view a replay, run a flag or test, inspect a bill, self-host the stack, or contact support. The large G2 sample and active technical community give the patterns weight without filling those gaps.

Our rule is one feature from question to rollback. Define the decision and events. Validate them against the database. Mask replay and measure its page cost. Release the change to 10% behind a flag. Set a stop rule. Check the experiment. Roll back and verify it.

Then estimate each product's usage, set caps, remove unused tracking, and give the route to a second owner.

Adopt more of PostHog only if this one route helps the team make a better decision. If the team collects more data and ships the same guesses, the large platform has only produced a larger dashboard.
