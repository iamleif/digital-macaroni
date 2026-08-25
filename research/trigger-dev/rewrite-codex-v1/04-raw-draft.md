Trigger.dev runs background work after a web request ends. A developer writes the task in TypeScript and can inspect its waits, attempts, logs, and final result.

That helps with imports, reports, emails, AI tasks, and order work. The hard part is recovery after a crash. I recommend Trigger.dev to TypeScript teams whose old queue makes that recovery hard to prove.

## Break one reversible job first

Move a job whose result can be checked and repaired. Send the same event twice, crash after an outside action, force a rate limit, wait through a deploy, cancel, retry, and replay.

Record the input, stable request ID, attempt, outside response, step, and final state. Reconcile Trigger.dev with the database and every system that owns money, stock, messages, or files.

## Retries can repeat real work

A retry is useful after a short outage. It is dangerous when the outside service succeeded but its reply was lost.

Use a stable duplicate-protection key where the service supports one. Store completed steps and make the same event produce one result. Increase concurrency and let two workers reach the same record.

## Wait across a deploy

Create a task that waits for a day. Deploy new code, change a secret, cancel one run, and let another resume. Check which code and settings each run uses.

Send the awaited event early, during the wait, and twice after resume. The job must not miss it or continue twice.

## Make the dashboard answer an incident

Give another developer a failed order and its ID. That person should find every attempt, identify the last confirmed side effect, and choose a safe next action.

Test alert delays, retry storms, cancellation, and replay. Match log retention to how far back the business investigates errors.

## Treat version and hosting claims carefully

Trigger.dev says version 2 had timeout, architecture, and billing problems. Version 3 replaced that execution design. Old version 2 failures define useful tests, but they do not prove current failures.

Self-hosting transfers databases, workers, networking, secrets, upgrades, backups, monitoring, and recovery to the team. Choose it for a clear control or cost reason.

## Price the real workload

Free included $5 monthly credit. Hobby cost $10 with $10 credit. Pro cost $50 with $50 credit. Compute time, run starts, larger machines, added capacity, seats, branches, dashboards, and retention can change the bill.

Model a representative month by task, duration, machine, attempt, and run count. Include retry storms and development work. Set budget and spike alerts.

## Who should choose Trigger.dev?

Choose it for TypeScript teams with long jobs that need waits, retries, and strong run history. Skip it for tiny cron tasks or teams that cannot own TypeScript service code.

Digital Macaroni did not deploy a task, cause a crash, run load, inspect a bill, self-host, or contact support. Technical evidence is stronger than formal review coverage.

Keep Trigger.dev when the team can prove recovery and replay safety. A better dashboard does not make an unsafe task safe.

