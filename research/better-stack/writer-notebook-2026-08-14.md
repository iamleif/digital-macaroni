# Better Stack writer's notebook

## Research scope

- Research-based review; no outage test
- Current pricing and monitoring flow checked 2026-08-14
- G2: 4.8 from 319; smaller Product Hunt, Gartner, Trustpilot, and Reddit checks
- Main limit: routine setup reviews do not prove behavior during a rare serious failure

## Reader and job

- Primary reader: a developer or small operations team that needs to know when a site or service fails and tell customers what is happening
- Plain example: Better Stack checks an API, calls the on-call person when it fails, opens the related logs, and updates a public status page
- Cost of failure: a false alert wakes someone for nothing, or a real failure does not reach the right person

## Product facts

- Free includes ten monitors or heartbeats, one status page, email and Slack alerts
- Free data: 3GB each of logs, traces, and web events with three-day retention; 30GB metrics; 100,000 exceptions; 5,000 session replays
- Paid incident responder is $34 monthly or $29 per month annually
- Paid responder adds phone, SMS, app, and webhook alerts, faster checks, schedules, and escalation
- Extra status pages, subscribers, private access, branding removal, data, retention, and some checks cost separately

## Experience records

### A website failed and the right person needed the alert

- Source: official flow and repeated G2 pattern
- Action: a monitor sees a bad response, opens an incident, and follows the on-call order
- Result: one person is called first and another is called if the first does not respond
- Consequence: test the entire chain with a planned failure

### Logs and alerts were kept together

- Source: repeated review pattern
- Result: a developer could move from the failed check to related data without opening another service
- Consequence: useful only if the logs contain the needed request, service, and error details

### The free plan grew into several paid parts

- Source: official pricing and review complaints
- Result: responders, pages, checks, data, and retention changed the total
- Consequence: measure one normal week of data before making an annual forecast

## Feature translation

### Monitor

- What it does: asks a website or service for a valid response every few minutes or seconds

### On-call schedule

- What it does: says who should answer a failure at each hour of the week

### Escalation

- What it does: calls or messages the next person if the first person does not accept the incident

### Status page

- What it does: gives customers a public place to check whether a service is down

## Conflict ledger

- Easy setup is well supported, but serious-failure reliability is harder to infer from reviews.
- The free plan is generous, but it does not represent a growing team's final price.
- Bringing logs and alerts together can save time, but some customers still find log work limited or awkward.

## Missing evidence

- No planned outage or false-alert test
- No on-call phone test
- No log or trace investigation
- No data-volume forecast
- No support request during an incident

## Spoken language bank

- check whether the service answers
- call the person who is responsible tonight
- move to the next person if nobody responds
- give customers one page for updates
- price one normal week of data, not a demo
