# Noloco writer's notebook

## Research scope

- Research-based review; no product test
- Current Free, Build, and Enterprise pricing checked on 2026-08-14
- G2 shows 4.8 from 36 reviews; Capterra has 13 reviews
- Main limit: community evidence is thin and one serious complaint involves a disputed older plan

## Reader and job

- Primary reader: an agency or service firm running work in spreadsheets or tables that clients also need to see
- Plain example: clients sign in to see only their projects, upload a file, and approve a delivery
- Wrong reader: a startup building a highly custom public product for millions of records
- Cost of failure: moving a large database before checking sync speed, row limits, and permissions

## Product facts

- Builds list, table, card, board, calendar, chart, and form screens from records
- Connects to Airtable, Sheets, Postgres, Xano, HubSpot, MySQL, Supabase, and other sources on Build
- Role and record rules control what each person can see
- Workflows can send mail, change records, or call another service
- Free: unlimited team seats, 50 clients, 2,000 records, unlimited apps
- Build: $79 monthly, 10 team seats, 1,000 clients, 25,000 records, 3,000 workflow runs
- Extra team seats cost $6; extra 25,000 records cost $25 monthly up to 250,000

## Experience records

### Spreadsheet became a client portal

- Source: Product Hunt, G2, and Capterra
- Result: businesses built a cleaner login area over data they already kept
- Consequence: clients no longer need direct access to the messy working table

### Support helped a fast first build

- Source: repeated G2 pattern
- Result: users praise quick replies and help getting an app into use
- Consequence: support is part of the value for a non-technical operations team

### Large Xano app exceeded a workable fit

- Source: one detailed G2 review and vendor reply
- Result: reviewer reports sync failures, duplicate cleanup, severe editor delay, row limits, and a refund dispute; Noloco says limits always existed and the use case exceeded the supported design
- Consequence: test with real volume and get limits in writing before moving a large system

## Repeated patterns

- Fast path from table to portal or internal app
- Strong permissions and workflow options for business operations
- Support receives frequent praise
- Visual customization and less common features can hit limits
- Price and records matter as the system grows

## Feature translation

### Client portal

- What it does: gives each client a login to see and change only their own work
- Main limit: permission rules must be tested with separate accounts

### Synced records

- What it does: copies or reads rows from an outside database so Noloco can display them
- Main limit: large or changing data sets can create speed, delay, and limit problems

### Workflow

- What it does: performs a repeated action after a record changes or someone clicks a button
- Main limit: Free allows 100 runs and Build 3,000, so frequent tasks need counting

## Conflict ledger

- Noloco can be faster than custom software for standard business processes, but its boundaries become important for unusual scale or design.
- Current pricing makes extra records cheaper than the older plan structure, but the cap still needs planning.

## Missing evidence

- No hands-on portal build
- No permission or external sync test
- No test with 25,000 records
- No support request

## Spoken language bank

- put a clean client login over the table you already use
- clients see their own projects, not the working spreadsheet
- test with real rows before moving everything
- count people, records, and workflow runs
- fast for a known business process, limited as a blank canvas
