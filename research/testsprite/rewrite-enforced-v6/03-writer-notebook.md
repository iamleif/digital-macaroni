# TestSprite writer's notebook

## Research scope

- Review type: research-based
- Product access: none
- Official sources: website, documentation, pricing, and release material
- Independent sources: Product Hunt, G2, Trustpilot, and one detailed community article
- Main limit: too little detailed independent material for a broad reliability claim

## Reader and job

- Primary reader: a small software team or solo developer
- Job: create useful regression tests without writing every case by hand
- Current alternative: a small manual test list or a thin automated suite
- Cost of failure: a missed bug reaches customers, or a false alarm delays a release

## Product facts

- A product document and a running app can be used to generate a test plan.
- TestSprite checks frontend paths and backend APIs.
- An MCP connection lets an AI coding assistant trigger tests from an editor.
- Auto-Heal can update a test when a page element changes.
- The free plan includes 150 monthly credits. Starter and Standard raise the limits.

## Experience record

- Context: a mid-size SaaS product serving more than one locale
- Task: check a form using a day-first date
- Result: TestSprite expected a month-first date and marked a valid value as wrong
- Follow-up: a locale setting existed but was hard to find
- Confidence: useful single account, not a general failure rate

## Repeated patterns

The packet supports the product's ability to create readable tests and reduce routine maintenance. It does not contain enough detailed accounts to prove how often those tests find real bugs or create false alarms.

## Feature translation

- Spec-driven testing: turn the written product rules into checks against the app.
- Auto-Heal: repair the part of a test that points to a changed screen element.
- MCP: let the coding assistant ask TestSprite to set up and run tests.
- Credits: the usage unit that limits how much testing each plan includes.

## Conflict ledger

TestSprite can reduce test-writing work, and every generated result still needs a human owner. Both are true because creating a test and deciding whether its conclusion is correct are separate jobs.

## Missing evidence

- Typical credit use on a real production app
- Support response quality
- Long-term test stability across many releases
- False alarm rate outside the documented locale example

## Spoken language bank

Use: running app, product document, test plan, failed check, false alarm, reproduce the steps, monthly credits.

Avoid: autonomous QA transformation, comprehensive quality platform, effortless coverage.
