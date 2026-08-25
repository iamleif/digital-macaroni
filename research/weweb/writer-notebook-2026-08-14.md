# WeWeb writer's notebook

## Research scope

- Research-based review; no product test
- Current official pricing structure and 2026 product direction checked on 2026-08-14
- Capterra shows 4.8 from 35 reviews; other independent samples are smaller
- Current pricing begins at $20 but live totals depend on seat, hosting, domain, and region

## Reader and job

- Primary reader: a founder or operations person building a custom browser app without hand-coding every screen
- Plain app example: a customer portal where each client signs in and sees only their own projects
- Cost of failure: a visually finished app that exposes another customer's data or breaks on a phone

## Product facts

- WeWeb builds pages, buttons, forms, menus, and browser behavior
- Data can live in WeWeb's newer backend or outside services such as Supabase and Xano
- Sign-in and permission rules decide what each user can see and change
- Paid seats start at $20 monthly and do not charge for each end user
- Custom domains and WeWeb hosting are add-ons
- Paid plans support code export, GitHub sync, and self-hosting
- Free can publish with a WeWeb address and branding

## Experience records

### Builder escaped a rigid template

- Source: Reddit and review platforms
- Result: users moved from simpler builders to get more control over layout and app behavior
- Consequence: WeWeb makes sense when template workarounds become the real project

### Customer data needed a permission rule

- Source: Reddit
- Result: builder had to understand sign-in and database rules so users could not see one another's data
- Consequence: visual building does not remove security work

### AI changed working sign-in logic

- Source: one detailed Reddit account
- Result: generated work replaced an auth guard with sample data
- Consequence: review each change and keep a known working version

## Repeated patterns

- Strong control over the browser interface
- Useful links to Supabase, Xano, and other data services
- Faster after the builder learns the system
- Steep learning around data, auth, state, phone layouts, and debugging
- Some complaints about editor speed, price, and behavior outside common paths

## Feature translation

### Frontend

- What it does: the pages, forms, buttons, and information a user sees in the browser
- Main limit: it still needs safe, correct data behind it

### Backend

- What it does: stores accounts and records, checks permissions, and runs work that should not happen in the browser
- Main limit: a second service can mean another bill and another system to learn

### Code export

- What it does: downloads the built browser app so it can run outside WeWeb
- Main limit: outside services and WeWeb-specific connectors may still need replacement or setup

## Conflict ledger

- More control removes template limits but creates more decisions and more ways to make a mistake.
- Code export reduces lock-in, but it does not turn a non-developer into someone ready to maintain exported code.

## Missing evidence

- No hands-on customer portal build
- No permission or security test
- No phone-layout or editor-speed test
- No export and self-host test

## Spoken language bank

- build the screens without hand-coding every one
- each customer must see only their own records
- no code does not mean no technical thinking
- build sign-in and permissions before polishing the dashboard
- count the builder, backend, and hosting bills together
