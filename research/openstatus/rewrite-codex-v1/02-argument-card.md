# OpenStatus argument card

## Buyer

A technical team that wants service checks, incident updates, and public status pages in one open product.

## Decision

Use OpenStatus only after a forced outage proves detection, alerts, customer updates, and recovery.

## Why

The product places monitoring and public communication close together. Its short customer history cannot prove dependable paging or urgent support.

## Walk-away conditions

Leave if a real failure stays green, the right person misses the alert, customers see unclear or stale updates, recovery fires early, or self-hosting shares the same failure path as production.

## Verdict

Worth testing when outage drills prove every critical path.
