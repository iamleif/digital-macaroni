# Trigger.dev private argument card

- Buyer: a TypeScript team whose web requests, cron jobs, or basic queues now contain long work and fragile recovery code
- Job: run background work to a known final state through crashes, waits, retries, deploys, and outside service failures
- Thesis: Trigger.dev is worth adopting when its stored runs and retries make one important workflow safer to operate; it is excess machinery for tiny jobs and unsafe when retries can repeat side effects
- Main reason to buy: normal TypeScript code with managed execution, waits, retries, logs, history, and rollback
- Main reason to hesitate: current reliability is untested here, pricing has several moving parts, version migration and docs can hurt, and self-hosting is real operations work
- Decision rule: migrate one reversible job, send duplicates, crash after a side effect, force rate limits, wait across a deploy, cancel and replay, compare final state with the source of truth, then load-test and price it
- Evidence limit: research-based; no Digital Macaroni deployment
