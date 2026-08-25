# Pipedream private argument card

- Buyer: a developer or technical operations team that needs flexible API workflows without operating a server for each one
- Job: receive events, transform data, call several services, and recover safely from failures
- Thesis: Pipedream is a strong choice when a developer owns the automation and needs to move between prebuilt actions and code; it is a poor home for business-critical rules that nobody outside engineering can read
- Main reason to buy: rapid API work with managed authentication, infrastructure, event history, and an unrestricted code path
- Main reason to hesitate: code ownership, duplicate and failure handling, missing niche components, and compute-based cost
- When it is unnecessary: a simple visual automation already covers the process and the business team must own changes
- Decision rule: run one real workflow with duplicate, late, bad, and out-of-order events; expire a credential, force a rate limit, replay failures, hand the workflow to its backup owner, and measure credits during the worst normal week
- Evidence limit: research-based; no Digital Macaroni workflow or bill
