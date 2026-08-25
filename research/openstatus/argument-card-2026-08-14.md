# OpenStatus private argument card

- Buyer: a technical software team that needs uptime checks and a customer-facing status page
- Job: detect a failure, alert the right person, communicate it, and show recovery
- Thesis: OpenStatus has a sensible combination of monitoring and status communication, but its thin customer history means it should be chosen only after the team forces a real disposable failure through the entire route
- Main reason to buy: open-source code, self-hosting, multi-region monitoring, developer tooling, and status pages live together
- Main reason to hesitate: little independent long-term customer evidence and meaningful operational work if self-hosted
- When it is unnecessary: an existing monitor already detects the right failures and feeds a status page and on-call route that the team trusts
- Decision rule: break a disposable endpoint, corrupt one response without taking it offline, fail one region, silence one alert route, post an incident, add a subscriber, recover, and measure every delay and wrong message
- Evidence limit: research-based; no Digital Macaroni monitor or incident test
