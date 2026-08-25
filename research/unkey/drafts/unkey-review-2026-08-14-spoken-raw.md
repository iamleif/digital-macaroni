---
company: Unkey
title: 'Unkey review: when API keys become a real product'
description: >-
  Unkey handles API keys, limits, usage, and API deployment. It saves real work
  once keys serve customers, but a small internal app may not need it.
date: '2026-08-14'
updated: '2026-08-14'
author: Leif Johansen
status: draft
category: Developer tools
productUrl: 'https://www.unkey.com'
schemaCategory: DeveloperApplication
score: 7.8
verdict: >-
  Use Unkey when API access is part of what you sell. Keep simple internal keys
  in your own system.
cardVerdict: 'Useful when API keys become customer infrastructure.'
featured: false
reviewType: research-based
legacyResearch: false
testingDisclosure: >-
  This is a research-based review. We studied official documentation, public
  source code, independent technical discussions, and the limited outside
  reviews available. We did not deploy or load-test Unkey. No payment was
  received for coverage.
sources:
  - name: Unkey product documentation
    url: 'https://www.unkey.com/docs/introduction'
    accessed: '2026-08-14'
  - name: Unkey pricing
    url: 'https://www.unkey.com/pricing'
    accessed: '2026-08-14'
  - name: Unkey security overview
    url: 'https://www.unkey.com/docs/security/overview'
    accessed: '2026-08-14'
  - name: Why Unkey left serverless
    url: 'https://www.unkey.com/blog/serverless-exit'
    accessed: '2026-08-13'
  - name: Unkey source repository
    url: 'https://github.com/unkeyed/unkey'
    accessed: '2026-08-14'
  - name: Unkey reviews on Product Hunt
    url: 'https://www.producthunt.com/products/unkey'
    accessed: '2026-08-14'
  - name: Self-managed API key discussion
    url: 'https://www.reddit.com/r/nextjs/comments/1t2nktx/is_it_fine_to_self_manage_api_keys/'
    accessed: '2026-08-13'
  - name: API key management discussion
    url: 'https://www.reddit.com/r/devops/comments/1cyri37'
    accessed: '2026-08-13'
  - name: Independent hands-on Unkey review
    url: 'https://www.buildmvpfast.com/blog/unkey-open-source-api-key-management-rate-limiting-2026'
    accessed: '2026-08-14'
scores:
  onboarding: 8
  product: 8.2
  support: 7.1
  billing: 7.8
publishAt: '2026-08-14T00:00:00Z'
---
The easiest version of an API key is one database row. Make a long random code, store a scrambled copy, and compare it whenever a request arrives. A small internal tool may never need more than that.

Unkey starts making sense when the key becomes part of the product you sell. Customers need their own keys. One key needs to expire next week. Another needs access to one service but not another. A third needs a monthly allowance so one customer cannot run up the entire server bill.

At that point, the simple database row has turned into a security and billing system. Unkey handles that system. It can issue and revoke keys, enforce limits, record usage, and stop a bad request before it reaches your app. It can now host the API as well.

We recommend Unkey for a team selling access to an API or protecting several public services. We would skip it for a small internal app with a few keys and one database. The extra service is only worth adding when it removes work you truly have.

## What Unkey actually does

An API lets one piece of software ask another for data or an action. The API key is the secret code attached to that request. It tells the service which customer is calling and what that customer is allowed to do.

Unkey can create that code and check it on every request. It stores a SHA-256 hash of the key instead of the original secret. In normal language, Unkey keeps a one-way fingerprint. If its database is exposed, the original keys are not sitting there ready to copy.

The product also handles expiration, revocation, permissions, and usage credits. Revocation is the emergency stop. If a key leaks, you can cancel it. A usage credit is a unit from a customer's allowance. A plan with 10,000 calls a month can stop or change behavior after the customer uses all 10,000.

Rate limiting handles short bursts. You can let a customer make 100 calls a minute without allowing 10,000 calls in ten seconds. This protects the service from mistakes and basic abuse.

Unkey has grown beyond key management. Its current platform can take an API from a code repository, build it, run it in selected regions, and put a gateway in front of it. The gateway is the checkpoint that checks keys, limits, and network rules before traffic reaches the app.

That wider platform is useful if you want one company to run both the API and the door in front of it. It is also a much larger decision than adding key checks to an app you already host.

## The reason to buy it

A home-built key table is not foolish. It is the right answer for many small products. The problem is the work that arrives later.

A customer asks for two keys so production and testing stay separate. Another wants a key that can read data but cannot change it. Sales creates three plans with different monthly limits. Support needs to see why a key stopped working. Security wants an audit record. Finance wants usage numbers for billing.

None of those jobs is especially hard alone. Together, they become permanent product work. The team has to design the rules, keep them fast, stop abuse, explain failures, and update the system without breaking current customers.

This is the point of Unkey. It gives the team one set of tools for the whole path. The developer can issue a key, attach a customer identity, set permissions and limits, then inspect what happened. The product team can build plans around the same records instead of joining data from a homemade key table, a separate limiter, and an analytics service.

The strongest use case is a paid developer product. Think of a data service, an AI tool, or an automation API. Customers need clear access, predictable limits, and a way to replace a leaked key. Unkey saves the team from rebuilding those basics.

## When it is too much

Do not buy a security product just because security sounds important. First count the real jobs your key system has today.

A small company may have one internal script that calls one private service. Five employees use it. Keys rarely change. Nobody buys an allowance and no outside customer needs a dashboard. A hashed key in the main database can be easier to understand and easier to recover.

Adding Unkey in that situation creates another account, another bill, another network call, and another service that can fail. You also need someone to understand how the app behaves when Unkey is slow or unavailable.

The decision changes when keys cross teams, products, or regions. It also changes when a key controls something a customer pays for. Permissions, instant revocation, limits, and a useful activity record are no longer nice extras. They are part of the service.

Our rule is simple. Keep the key system in your app while it remains one small table and a few clear checks. Test Unkey when the work spills into several tables, background jobs, dashboards, billing rules, or services.

## Test the refusal path

A key system earns trust when it says no at the right time. A nice dashboard and a successful first request prove very little.

Create a test key and use it once. Revoke it, then send the same request again. The second request must fail. Repeat the test with an expired key and a key that has used its full monthly allowance.

Then test the rate limit. Send a safe burst that crosses the rule. Check which requests pass, which fail, and what the customer sees. A vague server error is not good enough. The response should make the problem clear without exposing private details.

Next, create two permission levels. Give one key read access and another permission to make a change. Try the change with the read-only key. If it works, stop the trial until the rule is fixed.

Finally, plan for an Unkey problem. Decide whether requests should fail closed or fail open. Failing closed means nobody gets in when the key service cannot answer. That protects data but can cause an outage. Failing open keeps the API available but may let an invalid request through. Many paid or sensitive APIs should fail closed, but the team needs to accept the cost.

This test matters more than a low-latency number on a product page. It shows what happens to your customer when the system is under pressure.

## The architecture rewrite matters

Unkey has been unusually direct about the problems in its first design. The company says its serverless version built up latency, cache, local-development, and operating problems. It rewrote the platform around stateful Go servers.

We see that as useful honesty, not automatic proof that every problem is gone. Young infrastructure changes quickly. A full rewrite can remove old limits while introducing new failure cases.

The current design therefore deserves a fresh test. Measure key checks from the regions where your customers live. Run the test long enough to catch normal traffic changes. Check the status page and decide who responds when verification slows down.

The public source code is valuable here. A technical team can inspect how the product works, follow issues, and understand more than it could with a closed service. Open code does not make self-hosting easy, though. Running a security service means owning its database, networking, updates, monitoring, backups, and incidents.

Choose the managed service unless you already have a strong reason and the staff to run it. Treat self-hosting as an engineering project, not a free checkbox.

## Price and value

Unkey's current deployment plans start at $5 a month for Starter, $25 for Pro, and $50 for Business. Each plan includes the same amount in usage credit as its base price. Enterprise pricing is custom.

The monthly plan is only the start of the bill. Unkey also charges for compute, memory, temporary disk, data leaving the service, and active keys. An active key is one that was used at least once during the month. The pricing page has a calculator for these costs.

That model can be fair because the bill grows with the service. It can also be harder to predict than one flat price. Put real traffic into the calculator. Include the busiest month, not the quiet week used for a demo.

If you only use Unkey for keys and rate limits in an API hosted elsewhere, compare the cost with the engineering time it replaces. Do not compare it with the price of one database table. Compare it with revocation, permissions, limits, usage records, alerts, support tools, and the person who maintains all of them.

For a public API with paying customers, that trade can be very good. For five internal keys, the value is weak.

## Support and proof

The biggest reason we stop at 7.8 is not the feature list. It is the small amount of outside proof.

Unkey has an active public code base and a visible developer community. Product Hunt has only three reviews. Conventional business review sites provide almost nothing useful. That is not evidence of a bad product. It means we cannot use a long customer history to judge reliability or support.

A technical buyer should treat the trial like part of the review. Ask support one question that requires investigation. File a safe test issue. Read recent public issues and releases. Check how the team explains outages and breaking changes.

Repository stars show attention. They do not tell you whether a key check stayed available during your busiest hour. Only real use, monitoring, and a clear fallback plan can answer that.

## Who should use Unkey?

Use Unkey when customers call your API and keys control plans, permissions, limits, or money. It also fits a team with several services that wants one place to issue access and understand usage.

It is especially useful when developers are about to build a key dashboard, a rate limiter, an activity log, and billing counters as four separate projects. Unkey turns those jobs into one product decision.

Skip it when the keys belong to a tiny internal app, the rules are simple, and the team can safely keep hashed keys in its own database. You can adopt a service later when the work becomes real.

We would also pause if the team cannot explain what happens during a verification outage. Putting Unkey in front of every request makes it important infrastructure. That is fine, but it needs the same monitoring and failure plan as the API itself.

## Verdict

Unkey solves a real problem that is easy to underestimate. Creating a random key takes minutes. Running a key system for paying customers does not.

The product is worth testing when API access is part of what you sell. Its keys, permissions, limits, usage records, and gateway fit together well. The wider deployment platform makes the offer more complete, though it also asks the buyer to trust more of the stack to a young company.

Start with one noncritical API. Test valid, revoked, expired, over-limit, and wrongly permitted keys. Measure the result from the regions that matter. Estimate a busy-month bill and write down the outage rule.

If those checks work, Unkey can remove a dull and risky block of infrastructure from your roadmap. If your needs still fit in one small database table, keep the table and spend the time on your actual product.

