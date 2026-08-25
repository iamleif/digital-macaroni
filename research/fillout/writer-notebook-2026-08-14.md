# Fillout writer's notebook

## Research scope

- Research-based review; no hands-on form build
- Pricing checked 2026-08-14
- 29 G2, 13 Product Hunt, and 4 visible Trustpilot voices
- Affiliate hands-on review used only as supporting context

## Reader and job

- Primary reader: a small team collecting applications, requests, orders, bookings, or updates into Airtable, Notion, Sheets, or another work system
- Plain example: show different questions by service, take a payment, write the answers to the right record, email a receipt, and create a PDF
- Cost of failure: a valid person cannot submit, a payment succeeds without a record, data updates the wrong row, or an email never arrives

## Product facts

- Unlimited forms and seats on every standard plan
- Free: 1,000 responses monthly with logic, payments, scheduling, PDFs, workflows, uploads, and integrations
- Starter: $15 monthly billed yearly, 2,000 responses, all field types, custom endings, login forms, redirect
- Pro: $40, 5,000 responses, custom email, no branding, fonts, CSS, share links
- Business: $75, unlimited responses, analytics, custom domain, custom code, partial submissions, pre-fetch
- Monthly billing costs more
- Integrations include Airtable, Notion, Google Sheets, webhooks, HubSpot, and Mailchimp

## Experience records

### A team put a better front end on Airtable or Notion

- Deep integrations are a repeated reason to choose Fillout
- Consequence: test create, update, linked record, and duplicate behavior against a copy of real data

### A form used branches and calculations

- Strong logic and approachable setup receive frequent praise
- Consequence: map valid, invalid, empty, and resumed paths before launch

### A payment, formatting, or support edge case went wrong

- Small negative sample covers high-impact failures
- Consequence: test recovery and reconciliation, not only the happy path

## Feature translation

### Conditional logic

- Shows or skips questions based on earlier answers

### Pre-fill

- Opens a form with known answers already filled in

### Hidden field

- Passes information such as a customer ID or campaign without showing it to the respondent

### Partial submission

- Saves answers from someone who starts but does not finish the form

## Conflict ledger

- The free plan is unusually capable, while several business controls require Pro or Business.
- Easy first setup can hide complicated branches and data-update risks.
- Support is broadly positive with a small negative tail.

## Missing evidence

- No mobile, logic, integration, payment, email, PDF, partial-response, analytics, export, or support test
- No high-volume test
- No accessibility or sensitive-data assessment

## Spoken language bank

- test every ending, not just the submit button
- use a copy of the real database
- a payment and a record must agree
- the free plan is enough for a serious test
- no seat charge is useful for a wide internal team
