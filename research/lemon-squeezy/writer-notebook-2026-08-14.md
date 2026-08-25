# Lemon Squeezy writer's notebook

## Research scope

- Research-based review; no hands-on store or transaction
- Fees and payout rules checked 2026-08-14
- 75 Product Hunt voices, 20 recent Trustpilot complaints, and several mixed community threads
- High-stakes seller cash flow; conservative editorial stance

## Reader and job

- Primary reader: a small software or digital-product seller that wants another company to handle checkout, global sales tax, subscriptions, licensing, and billing support
- Plain example: sell a $20 subscription to a buyer in France, collect VAT, provision access, receive a refund request, and reconcile the later payout
- Cost of failure: store rejection stops launch, a paid customer has no access, a webhook fails, or revenue remains held while support does not answer

## Product facts

- Merchant of record: Lemon Squeezy is the legal seller to the customer for the covered transaction and handles tax collection and filing
- Base platform fee: 5% + $0.50 on total order value
- Add 1.5% for non-US payment, 1.5% for PayPal, 0.5% for subscription
- Bank payout outside US: 1%; PayPal outside US: 3% capped at $30
- Recovered-cart fee 5%; merchant affiliate referral fee 3%
- Payouts created on 1st and 15th, 13-day hold, available on 14th and 28th, one to five bank days
- $50 payout threshold
- Checkout, subscriptions, licensing, downloads, customer portal, refunds, dunning, API, webhooks

## Experience records

### A small seller avoided global tax registration work

- Main repeated benefit of merchant-of-record model
- Consequence: compare total fee with the accounting and compliance work actually removed

### A store failed or stalled in approval

- Repeated current complaint with opaque communication
- Consequence: finish approval before setting launch date or moving customers

### A first payout moved or remained under review

- Several recent sellers describe delays and weak status replies
- Consequence: keep cash reserve and prove multiple payouts before dependence

## Feature translation

### Merchant of record

- Lemon Squeezy is the seller shown to the customer and takes responsibility for collecting and filing covered sales taxes, while paying the creator net proceeds

### Webhook

- A signed message sent to the seller's app when a purchase, renewal, refund, or other event occurs

### Dunning

- Messages and payment retries used to recover a failed subscription payment

### Chargeback

- A payment reversed after the cardholder disputes it

## Conflict ledger

- Offloaded tax work comes with higher fees and control over payouts.
- Early maker praise and recent seller complaints describe different stages of the relationship.
- A working test checkout does not prove approval, live risk review, support, or payout behavior.

## Missing evidence

- No approval, identity, checkout, PayPal, international, subscription, tax, license, webhook, refund, chargeback, dunning, customer portal, payout, invoice, export, accounting, or support test
- No legal or tax opinion
- Future Stripe migration terms unclear

## Spoken language bank

- do not announce launch before the store is approved
- the first payout is part of the product
- calculate the fee on the tax-inclusive order
- a sale is not complete until access and accounting agree
- keep another route and enough cash for a delayed payout
