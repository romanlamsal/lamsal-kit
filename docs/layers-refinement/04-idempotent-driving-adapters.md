# Idempotency stated for outbox receivers only

**Status:** applied, uncommitted · **Kind:** real gap · **Touches:** "A driving adapter acts
through one service and asks through the domain"; Transactions (the outbox bullets)

## Context

In `domain.md`, Stripe and the 3PL deliver webhooks at least once and out of order; Payload may
retry a hook.

## Problem

Only the outbox bullets say "Handling the same message twice changes nothing the second time."
An agent writing a Stripe webhook handler applies the payment twice on a redelivery. Every
driving adapter whose caller retries needs the same property.

## Resolution

Appended to the driving-adapter paragraph:

> Where its caller delivers at least once — a relay, a webhook, a product's hook — handling the
> same delivery twice changes nothing the second time.

The outbox bullet keeps its own sentence; dropping it there is an option if the duplication
bothers a reviewer.

## Grounding

Vernon, *IDDD* ch. 8, describes idempotent receivers for published events *(from memory,
unverified)*. Cockburn's hexagonal article says nothing on delivery guarantees.

## Done when

Approved and committed.
