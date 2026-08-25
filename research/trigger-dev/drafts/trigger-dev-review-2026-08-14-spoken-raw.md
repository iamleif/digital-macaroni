# Trigger.dev review: what happens after the job crashes?

Trigger.dev runs work in the background after a web request has ended. A developer writes the job in TypeScript, deploys it, and can see each run, log, retry, wait, and failure in one place.

This is useful for imports, reports, emails, order processing, video work, AI tasks, and other jobs that may take too long for a normal page request.

The difficult part is not starting the job. It is knowing what happened after the process crashed halfway through.

We would move one reversible production job first. Send the same event twice. Crash after an outside action. Force a rate limit. Wait across a new deploy. Cancel and replay the run. Then compare the final database state and bill with the old system.

## A durable job remembers enough to continue

Trigger.dev describes its tasks as durable. This means the system records the run and can recover after a worker stops, an outside service fails, or the task waits for later work.

Take an order workflow. It may confirm payment, reserve stock, create a shipment, send a receipt, and update a sales report. A crash after stock is reserved should not forget the order or reserve the stock again.

Build the test task with clear steps. Record the order ID, input, attempt number, outside response, and final state. Add a forced error after each step, one at a time.

After recovery, every order should have one correct result. There should be no second charge, duplicate shipment, missing email, or job that looks successful while the database says otherwise.

The run screen and logs should let another developer explain exactly where the task stopped and why it continued.

## Retries need protection from duplicate work

A retry runs failed work again. It is helpful when an API has a short outage. It is dangerous when the first attempt completed the outside action but lost the reply.

The task must be idempotent. That means receiving the same event twice produces one real-world result. Use a stable order or request ID. Store completion before moving on where the workflow allows it. Use the outside service's duplicate-protection key when one exists.

Send the same event twice at the same moment. Return a timeout after the outside service succeeds. Retry manually. Replay an old run. Increase concurrency so two workers reach the same record.

Then reconcile Trigger.dev with the payment provider, database, email service, and any other system that owns the result.

Retries do not make unsafe code safe. They make its behavior repeatable.

## Long waits should not hold a worker open

Some jobs wait for a day, a customer reply, an approval, or a future date. Trigger.dev can checkpoint the run. A checkpoint is saved progress that lets the worker stop and resume later.

The current cloud pricing says waits longer than five seconds do not count as compute time. Time between attempts and time before code starts also do not count.

Create a task that waits for 24 hours. While it waits, deploy a new version, change a secret, cancel one run, and let another resume. Check which code version continues and which settings it sees.

Send the outside event before the wait begins, during the wait, and twice after it resumes. The task should not miss the signal or continue twice.

This behavior matters more than a demo that sleeps for ten seconds. A business workflow can remain open across several releases.

## Local development should match the deployed task

Trigger.dev lets a developer run tasks locally with hot reloading. That shortens the route from code change to test.

Use the same input, environment variables, package versions, machine size, and outside test services locally and in a preview environment. Compare logs, timeouts, file access, network calls, and result.

Test a large payload, missing secret, unavailable package, build failure, and rollback. Keep task code in version control beside the application code. Record which deployed task version created each result.

A visual workflow tool can hide logic in a separate editor. Trigger.dev keeps the logic in code, which suits a TypeScript team. It is a weak fit when the people who operate the workflow cannot read or change that code.

Python scripts can run from a TypeScript task through a build extension. That is not the same as a Python-first task system. Test packaging, logs, errors, and local parity before moving a Python-heavy service.

## The dashboard should answer an incident

Run history, logs, alerts, and dashboards are central reasons to choose Trigger.dev instead of a small queue.

Give an on-call developer an intentionally failed order without telling them the cause. That person should find the run from the order ID, see every attempt, identify the last confirmed side effect, and choose a safe next action.

Test alert delay and duplication. Stop a retry storm. Cancel one run and a group of runs. Replay only after checking whether the outside action already happened.

Free keeps logs and query access for one day. Hobby keeps them for seven days. Pro keeps them for 30 days. Decide how far back the business needs to investigate a missing order or incorrect bill.

Export logs or send them to the main monitoring system if long retention matters. A job that failed 45 days ago still needs an explanation.

## Version 2 complaints need the version label

Trigger.dev's own account says version 2 had timeouts, hard-to-maintain code, limits on long work, and double billing. The version 3 redesign moved execution to Trigger.dev's own worker system and replaced the queue design.

A self-hosting complaint about stuck or lost webhooks came from version 2. It identifies the reason to test recovery. It does not prove that version 3 loses the same work.

Migration and documentation friction still appear in newer developer accounts. Build the real integration from current version 3 documentation. Note every point where the team has to use Discord, inspect source code, or guess.

Do not let old failure reports condemn a rebuilt product. Do not let a rebuild remove the need for current failure tests either.

## Self-hosting transfers the operations job

Trigger.dev is open source under the Apache 2.0 license and provides a self-hosting route.

That can reduce dependence on the hosted service. It does not create a free managed platform. The team must run the database, workers, queues, networking, secrets, upgrades, backups, monitoring, and recovery that the cloud plan otherwise handles.

Install the current self-hosted version in a clean environment. Restore it from backup. Upgrade it. Roll it back. Lose a worker during a task. Fill the disk. Rotate secrets. Measure staff time as well as cloud cost.

Choose self-hosting for a clear security, location, control, or cost reason. Avoid it as a vague escape hatch from vendor dependence.

## What the cloud plans cost

Free costs $0 per month and includes $5 of monthly usage credit, 20 concurrent runs, five team members, ten schedules, one-day logs, and community support.

Hobby costs $10 per month and includes $10 credit, 50 concurrent runs, five team members, 100 schedules, seven-day logs, and more alerts plus realtime connections.

Pro costs $50 per month and includes $50 credit, at least 200 concurrent runs, 25 team members, 1,000 schedules, 30-day logs, more dashboards, and dedicated Slack support. Extra concurrency, seats, preview branches, dashboards, schedules, and realtime connections have separate monthly prices.

Enterprise uses custom pricing.

Cloud use is charged by task compute seconds and run starts. A default Small 1x worker costs $0.0000338 per second. Each run invocation adds $0.000025, or $0.25 per 10,000 starts. Larger machines cost more.

Use a representative month of old jobs. Group by task, duration, machine size, attempts, and run count. Include retry storms and development work. Waiting time over five seconds is checkpointed and does not count as compute, but the resumed work and run rules still need checking against the current bill.

Set budget and spike alerts. The pricing page says standard alerts fire at 75%, 90%, 100%, 200%, and 500% of the monthly budget, with spike detection for sudden use. An alert is not a hard spending cap unless the account says it is.

## Who should choose Trigger.dev?

We recommend Trigger.dev for a TypeScript team that has outgrown web-request jobs or a basic queue and wants retries, long waits, versioned code, logs, and run history without operating the worker system.

We would skip it for a handful of tiny cron jobs, a non-TypeScript team, or a very high volume of short work that a simpler queue runs safely for less.

We did not deploy a task, cause a crash, retry a side effect, wait through a release, measure cold start, run load, inspect a bill, self-host, or contact support. Formal review coverage is thin. The strongest independent material comes from developer discussions and public technical work.

Our rule is to move one reversible job. Send duplicates. Crash it after an outside action. Force a rate limit. Wait through a deploy. Cancel, retry, and replay it. Compare the final state with the systems that own the money, inventory, messages, and files.

Then load-test the real pattern and price the month. Keep Trigger.dev if recovery becomes easier to prove than it was with the old queue. If the team cannot explain why a replay is safe, the new dashboard has only made the unsafe job easier to run again.
