# Featurebase writer's notebook

## Research scope

- Research-based review; no hands-on use
- Current prices checked 2026-08-14; new plan structure dates from after December 2025
- Main customer pools: 49 G2 and 18 Product Hunt
- Small negative samples kept as incident warnings, not treated as the normal outcome

## Reader and job

- Primary reader: a software company that receives product ideas and support questions in several places
- Plain example: a customer asks for a feature, other customers vote, the team plans it, publishes the change, and links the support conversation to that history
- Cost of failure: feedback loses customer context, AI sends a wrong answer, support work breaks during an incident, or usage charges surprise the buyer

## Product facts

- Feedback portal, widget, roadmap, changelog, surveys, help center, inbox, live chat, reports, automations, and AI agent
- One free seat with unlimited conversations
- Growth: $29 per seat annually or $37 monthly
- Professional: $59 annually or $75 monthly, with 20 Lite seats
- Enterprise: $99 annually or $129 monthly, with 50 Lite seats
- Fibi: $0.49 per AI resolution
- Copilot unlimited: $19 per agent monthly
- Whitelabeling: $69 monthly
- Outbound email and translation have included amounts and later usage charges

## Experience records

### A team moved feedback, roadmap, and support closer together

- Large review pools value fewer separate tools and connected context
- Consequence: the strongest benefit appears only when the team uses the loop, not merely the portal

### AI gave an inaccurate answer

- G2 sample contains errors that required human follow-up
- Consequence: test known hard questions and make handoff obvious

### A customer had a billing or stability incident

- Small samples describe poor follow-through, contrary to broad support praise
- Consequence: test escalation and document commercial terms before moving all support

## Feature translation

### Feedback board

- A public or private place where customers submit ideas and vote on existing requests

### Changelog

- A list of product updates that tells customers what changed

### AI resolution

- A support conversation the AI answers and closes without a human agent

### Lite seat

- Limited access for teammates who need to view or take small actions without a full paid agent seat

## Conflict ledger

- One suite means less tool switching and more dependence on one vendor.
- Support is a repeated strength and the subject of the harshest small-sample criticism.
- AI can lower support work but creates accuracy and billing risks.

## Missing evidence

- No import, identity, widget, inbox, roadmap, changelog, AI, report, billing, or support test
- No outage or export test
- No five-seat cost simulation with real message volume

## Spoken language bank

- follow one request from support to shipped update
- do not test the feedback board by itself
- make the AI answer questions you already know
- calculate seats and usage together
- one system also means one point of failure
