# Documenso writer's notebook

## Research scope

- Research-based review; no signing or deployment test
- Hosted price and current self-host requirements checked 2026-08-14
- Formal customer evidence: one G2 review; community deployment discussions provide more detail
- GitHub: about 13.1k stars and 2.7k forks at research time

## Reader and job

- Primary reader: a small team seeking a lower-cost hosted signature tool, or a technical organization that specifically needs control over deployment and data
- Plain example: upload a contract, place name, date, and signature fields, send it to two people, track completion, and download the signed file and audit record
- Cost of failure: the recipient cannot sign, the request email never arrives, or the final record does not meet the organization's legal or compliance needs

## Product facts

- Hosted and self-hosted paths
- Free: five documents monthly and up to ten recipients per document
- Individual: $25 monthly billed $300 yearly, unlimited documents
- Teams: $40 monthly billed $480 yearly, five users, extra users $8 monthly
- Platform: $250 monthly billed $3,000 yearly, unlimited documents and users, wider API and embedded use
- Self-hosted core is AGPL-3.0; enterprise features require a license
- Production needs PostgreSQL, outbound email, signing certificate, domain, secure proxy, storage, backups, and updates

## Experience records

### A team completed self-hosting and used the signing flow

- Source: Reddit self-hosting discussion
- Result: successful users described a pleasant daily product after setup
- Consequence: the product can work well, but setup skill changes the experience

### The app opened but documents would not sign

- Source: official most-common-pitfall warning and community reports
- Result: missing or unreadable certificate caused signing failure
- Consequence: a health check alone is not enough; complete a real document after each deployment or update

### Invitation email delivery needed configuration

- Source: official requirements
- Result: without a working mail service, recipients could not receive signing requests
- Consequence: test delivery, spam handling, reminders, and bounces before launch

## Feature translation

### Signing certificate

- What it does: adds a digital seal to the completed PDF so later changes can be detected
- Main limit: the server administrator must create, protect, renew, and back it up when self-hosting

### Audit log

- What it does: records actions around the signing process
- Main limit: legal sufficiency depends on the document and jurisdiction

### Embedded signing

- What it does: lets a user sign inside another product instead of visiting Documenso directly

## Conflict ledger

- Self-hosting gives control but transfers security and reliability work to the operator.
- Repository popularity is strong, while independent customer review coverage is weak.
- A five-minute local start is not a production signing service.

## Missing evidence

- No hosted recipient or multi-signer test
- No audit-log or completed-PDF inspection
- No backup, restore, update, or mail-delivery test
- No legal or compliance opinion
- No support request

## Spoken language bank

- hosted and self-hosted are different decisions
- the app can open even when signing is broken
- test the final signed file, not just the login screen
- self-hosting means owning email, backups, updates, and security
- ask counsel which signature level the document needs
