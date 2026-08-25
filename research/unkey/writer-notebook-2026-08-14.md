# Unkey writer's notebook

## Decision

Unkey earns a trial when API keys have become part of the product. Skip it for a small internal service that only needs a few hashed keys in one database.

## Reader

A developer or technical founder who needs to issue customer API keys, revoke them, set limits, and see usage without building a small security product inside the main product.

## Plain-language translations

- API key: a secret code that lets software call an API.
- Rate limit: a rule that caps how often a key can call the service.
- Gateway: the checkpoint in front of an API that rejects a bad or overused key before the request reaches the app.
- Active key: a key that was used at least once during the billing month.

## Failure test

Create a key, use it, revoke it, and confirm the next request fails. Repeat with an expired key, an exhausted monthly allowance, a burst over the rate limit, and an Unkey outage. A key system is only useful when the refusal path works.

## Evidence limit

No Digital Macaroni deployment or load test. Formal review coverage is tiny. The verdict rests on the product design, the official architecture record, independent technical discussion, and a narrow outside hands-on review.
