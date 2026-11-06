# 21 — Review 04 fixture findings

**Status:** open

## Context

Review 04 (`reviews/04/checklist.md`, R04-34 to R04-40). `domain.md` stays frozen until the rule
set is settled, so reviews stay comparable; this issue holds the proposals until then.

## Problem

Several fixture lines name a mechanism, not a need. All three readers took them as temptations and
built something else, so they test nothing for the Implementer. Others leave a fact open or
contradict the saga.

Proposals, fixture written as needs:

- R04-34, mechanism lines:
  - l.16, common library "a unit of work kept ambient in `AsyncLocalStorage`": drop.
  - l.28 "`afterChange` hooks call shop's services" → "Shop and fulfillment need to learn of each
    product change."
  - l.28–29 "catalog's `beforeChange` asks shop how many open orders carry a sku, and refuses to
    change a sku one does" → "Catalog refuses to change a sku that an open order carries."
  - l.30–31 "shop reads the product … through Payload's Local API" → "Checkout needs each
    product's price, sku and tax class."
  - l.43 "Calls billing's open host service in-process while holding its own ambient
    transaction": drop; the need is l.40.
- R04-35, `PaymentFailed`: Stripe's `payment_failed` is one declined attempt. Add to payment:
  "Stripe reports each declined attempt; the customer may retry on the same PaymentIntent until it
  is cancelled or lapses." Saga step 3: "…publishes `PaymentSucceeded`, or `PaymentFailed` once no
  attempt can succeed any more."
- R04-36, "open order": add to shop "Which orders count as open is shop's to decide."
- R04-37, credit note: step 7's refund has no invoice. "Issues a credit note for each refund of an
  invoiced order."
- R04-38, the 3PL: add "The 3PL's booking API takes no idempotency key; it offers a sandbox."
- R04-39, dashboard: "An admin dashboard joins orders, invoices and shipments in the one Postgres"
  → "Staff see an order with its invoice and its shipment on one page." A `choices.md` entry for
  it: a composing system over replicas, or per-system pages (issue 22).
- R04-40, the worker process: "Its worker process has its own entry point and its own assembly" →
  "Its handlers and the 3PL's webhook run in its own worker process, with its own entry point and
  assembly."
