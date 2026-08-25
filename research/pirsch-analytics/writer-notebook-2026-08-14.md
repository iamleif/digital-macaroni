# Pirsch Analytics writer's notebook

## Research scope

- Research-based review; no hands-on website
- Pricing checked 2026-08-14
- Five Product Hunt reviews, one verified G2 review, three community discussions, code history, and recent comparisons
- Satisfaction sample is thin

## Reader and job

- Primary reader: a small site, software company, or agency that wants clear traffic and conversion numbers without a large Google Analytics setup
- Plain example: know which pages people visit, which campaign brought them, and how many reach signup or purchase
- Cost of failure: missing visits, double-counted events, wrong campaign credit, a broken funnel, or a privacy claim the implementation cannot support

## Product facts

- Germany-hosted dashboard and data
- Browser script, server-side API, events, goals, funnels, session analysis, ecommerce revenue, reports, alerts, short links, and imports
- Standard at 10,000 monthly views: $6; up to 50 sites, unlimited people and retention, events and goals
- Plus at 10,000: $12; unlimited sites, funnels, tests, segments, branding, teams, priority support
- Enterprise: custom, including managed cloud or on-premise installation, SAML, raw data, onboarding, and training
- 30-day trial with no card
- Events and part of session extensions count toward usage

## Experience records

### A clean dashboard answered the weekly traffic question

- Simplicity is the strongest repeated praise
- Consequence: define the five questions the owner actually asks before comparing feature lists

### Server tracking counted an automated request

- A general implementation risk, not a documented customer incident
- Consequence: compare real orders and signed-in actions against counted events

### An ad campaign could not be reconciled

- Paid-media attribution is a reported boundary
- Consequence: match campaign tags, ad-platform conversions, and actual sales before switching

## Feature translation

### Server-side tracking

- The website's own server sends the visit or event to Pirsch instead of relying only on code in the visitor's browser

### Goal

- A chosen success action, such as signup, purchase, download, or contact

### Funnel

- The sequence of steps people take toward a goal, showing where they stop

### Attribution

- The rule that decides which campaign or source receives credit for a signup or sale

## Conflict ledger

- Less invasive aggregate analytics is easier to understand and intentionally provides less individual detail.
- Server-side collection is harder to block and easier to count incorrectly.
- An open analytics core does not mean the complete hosted application can be freely self-hosted.
- A low entry fee can rise with visits and custom events.

## Missing evidence

- No script, proxy, server API, unique visitor, bot, internal visit, consent, event, goal, funnel, campaign, import, export, alert, dashboard, billing, or support test
- No legal advice or data-processing review
- No comparison against real source records

## Spoken language bank

- answer five questions every Monday
- compare the dashboard with the orders
- cookie-free is not a legal magic word
- count the same action once
- explain the difference before deleting the old setup
- open core is not the full self-hosted product
