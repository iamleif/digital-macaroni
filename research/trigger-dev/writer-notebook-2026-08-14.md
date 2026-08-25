# Trigger.dev writer's notebook

- Reader: TypeScript team moving long or failure-prone work out of a web request
- Plain example: an order arrives, payment is confirmed, inventory changes, an email is sent, and a report runs later
- Cost of failure: duplicate charge, missing email, stuck order, retry storm, stale code resume, hidden cost, or no way to explain the final state
- Durable task: work that records progress so it can recover after a crash
- Idempotent: safe to receive the same event twice without repeating the real-world effect
- Checkpoint: stored progress that lets a waiting task stop using compute and resume later
- Free $0 with $5 credit; Hobby $10 with $10; Pro $50 with $50; Enterprise custom
- Compute and run charges apply; waits over five seconds are checkpointed and do not count as compute
- Thesis: useful for TypeScript teams that need failure recovery and run history, but only after one real job proves correct state under forced failure
- Decision language: crash it after the charge; send the event twice; wait through a deploy; replay the run; reconcile the database
