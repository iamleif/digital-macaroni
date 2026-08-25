# PostHog writer's notebook

## Research scope

- Research-based review; no hands-on project
- Pricing checked 2026-08-14
- 1,045 G2, 242 Product Hunt, 54 community voices, repository, and documentation

## Reader and job

- Primary reader: a technical product team deciding what users do, where they struggle, and whether a new feature helps
- Plain example: watch signup failures, release a fix to 10% of users, compare completion, then roll back if errors rise
- Cost of failure: wrong events, exposed private data, slower pages, a biased test, a flag left on, or runaway usage

## Product facts

- Product and web analytics, replay, flags, experiments, surveys, errors, warehouse, pipelines, logs, AI and messaging tools
- Free: one project, one-year retention, unlimited people
- Monthly free units: 1M events, 5K replays, 1M flag requests, 100K errors, 1,500 survey replies, more product-specific allowances
- Pay-as-you-go: six projects, seven-year retention, email support
- Product-by-product billing limits
- US or EU cloud region; open code and self-host route

## Experience records

### A team moved from a broken funnel to the exact sessions

- Integrated analytics and replay are broad praise
- Consequence: prove one question can move from number to context without stitching accounts

### A replay captured a private field

- General high-risk test case, not a documented incident in the packet
- Consequence: test masking before staff or customer data enters production

### A tiny client event fired on every render

- General instrumentation failure case
- Consequence: inspect volume and bill by event name before adding a card

## Feature translation

### Session replay

- A reconstruction of screen changes and interactions, not a literal video recording

### Feature flag

- A switch that turns a feature on for chosen users without a new app release

### Experiment

- A controlled comparison between versions to see whether a chosen result changes

### Event

- A named action sent to analytics, such as signup started or payment completed

## Conflict ledger

- The same breadth can replace several products and overwhelm a small team.
- Automatic capture speeds setup and can create noisy or expensive data.
- Replay adds context and raises privacy plus page-performance work.
- Self-hosting controls data and creates a large service to operate.

## Missing evidence

- No SDK, identity, event, property, cohort, funnel, retention, replay, mask, flag, experiment, survey, error, warehouse, cost, cap, export, self-host, upgrade, or support test
- No privacy, security, accessibility, or performance audit

## Spoken language bank

- one feature from question to rollback
- name the decision before the event
- watch the failed sessions, not random recordings
- a flag is also an emergency switch
- mask before capture
- price every noisy event
