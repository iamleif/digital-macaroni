# OpenStatus writer's notebook

## Research scope

- Research-based review; no Digital Macaroni account or deployment
- Pricing and documentation checked 2026-08-14
- Large code-community signal but only three formal public reviews plus one vendor-adjacent testimonial

## Reader and job

- Primary reader: a technical startup or software team that needs to notice outages and tell customers what is happening
- Plain example: check an API every minute from several places, alert the on-call person when it fails, and post one clear incident update for customers
- Cost of failure: customers discover the outage first, the wrong person is paged, a false alarm wakes the team, or the status page claims everything is fine

## Product facts

- HTTP, TCP, and DNS monitors, multi-region checks, logs, alerts, incidents, maintenance, and public status pages
- Notifications through email, Slack, Discord, webhooks, WhatsApp, SMS, PagerDuty, OpsGenie, and Grafana OnCall
- Open-source AGPL-3.0 code and self-hosting documentation
- API, CLI, Terraform, SDKs, private locations, and OpenTelemetry export
- Hobby: one monitor, one page, three components, ten-minute checks
- Starter: $30 monthly; 20 monitors, six regions per monitor, one-minute checks, one page
- Pro: $100 monthly; 50 monitors, all 28 regions, 30-second checks, five pages, private locations
- Scale: $500 monthly; 50 monitors, ten pages, white label, longer retention
- Annual billing gives two months free; 30-day refund policy

## Experience records

### The service failed before the monitor noticed

- No direct evidence that this happened to a current customer; this is the central failure case for any monitor
- Consequence: force a real disposable failure and measure detection plus delivery

### Customers saw a clear incident page

- Monitoring plus public status pages is a product strength
- Consequence: test technical detection and plain customer communication as one route

### A team self-hosted the monitor beside the app

- Self-hosting is a differentiator and a design risk
- Consequence: place monitoring outside the failure zone it must detect

## Feature translation

### Monitor

- A repeated check asking whether a site, API, network port, or DNS record responds correctly

### Multi-region

- Running the check from several geographic locations so one local network problem does not become a false global outage

### Status page

- The public page where customers see which parts work, which do not, and what the team is doing

### Private location

- A check run from inside the company's own network for a service that the public internet cannot reach

## Conflict ledger

- The hosted product removes operating work; self-hosting returns that work to the buyer.
- Many repository stars show interest, not detection accuracy or customer satisfaction.
- A combined monitor and page simplifies incidents, but an incident tool must remain available while the main product fails.
- Low base prices can change sharply when white-label, identity, IP, or extra-page add-ons are required.

## Missing evidence

- No endpoint, region, timeout, certificate, DNS, alert, escalation, false-positive, incident, maintenance, subscriber, theme, accessibility, self-hosting, upgrade, export, or support test
- No long-term reliability or alert-delivery measurement

## Spoken language bank

- break something you can safely break
- does the right person hear about it first
- the page must not stay green
- explain the outage without making customers decode logs
- host the watchdog outside the thing it watches
- stars are attention, not proof
