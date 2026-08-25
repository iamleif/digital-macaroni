# Writer notebook

## Buyer and job

Trigger.dev runs long TypeScript background tasks with retries, waits, schedules, logs, and run history. The buyer has outgrown web-request jobs or a basic queue.

## Thesis

Managed durable jobs improve recovery only when every retry, replay, and duplicate event is safe for outside actions.

## Best fit

A TypeScript team that wants code-first jobs and visibility without operating workers.

## Skip

Tiny cron jobs, non-TypeScript teams, and very high volumes of short work that a simpler queue handles safely.

## Evidence boundary

No deployment, failure, load, bill, self-hosting, or support test was run. Version 2 failures do not prove version 3 behavior.

## Decisive test

Move one reversible job. Send duplicates, crash after an outside action, force a rate limit, wait through a deploy, cancel, retry, replay, and reconcile every final state.

