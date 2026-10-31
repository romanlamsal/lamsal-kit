# 17 — Fixture facts

**Status:** open

## Context

`domain.md` holds situations, never rulings. The full review's readers (spec 02) hung on
sentences that read as a fact where a rule needs a situation, on facts the fixture leaves open,
and on shapes it does not give, which every example writer invented for itself. Order:
`specs/02-review-findings.md`, step 8, before the examples are rewritten.

Settled when it was opened:

- Decisions first: each item is put to the user as one grill round, with a recommendation; the
  answers go into `domain.md`.
- A fact that turns out to be a rule leaves the fixture for issue 15.
- Shapes go into the fixture once, as code: the examples copy them and invent none.

## Problem

### Sentences that read as facts

- "While holding its own ambient transaction" and "a unit of work kept ambient": read as a fact,
  ASM-9 cannot be complied with (raw Implementer N1, distilled Adversarial).
- "Issues a credit note for each refund" against saga step 7, a refund of an order never
  invoiced.
- The checkout saga: the examples read it as choreography and the four Fresh repo drafts built
  orchestration with Order as process manager.
  `sys-13-ok-checkout-process-sends-receivers-commands` orchestrates and cannot return the
  `client_secret`. Say which, or that both are open.

### Facts left open

- Payload's Local API: catalog's open host service, or Payload's way in (TX-12, SYS-12).
- The mail provider, the 3PL and the bank: which take an idempotency key; which offer a test
  system (TST-5); whether the bank is polled or calls a hook.
- `OrderPlaced` with too little stock: a refusal, or a situation of its own (TX-35).
- The sku veto reads a count that can change before Payload commits: catalog's business rule has
  a P10 hole; say what it accepts.
- Checkout Session or PaymentIntent: the examples build the first, the fixture says the second.
- Billing's second `OrderPaid` for an invoice order is another message: a second invoice unless
  the Invoice is keyed by order.
- The admin dashboard: over the owners' tables or over replicas (issue 15).
- Catalog's config reading fulfillment's stock: a read of a table, or of fulfillment's open host
  service (issue 15).
- Since review 03 (both Implementers): `PaymentFailed`, terminal or not. Stripe's
  `payment_failed` lets the customer retry on the same intent; published as is, shop cancels and a
  later success is refunded. Both builds publish it only once the intent cannot succeed.
- An order wanting more than is on hand: refused, with a fulfillment event and a shop rule
  (TX-35), or reserved below zero and shipped when stock arrives. Both builds chose the second.
- The sku veto: catalog's rule in catalog's config with shop answering a count, or shop's rule,
  which then needs an acting use case and a hold per sku (raw Implementer N9). DOM-7's Why says
  shop; the fixture says catalog. "Open order" undefined; read as waiting for payment.
- The customer: who owns identity, email and the shipping address; `OrderPlaced` carries what
  (raw Implementer N24).
- Since issue 20: the one Postgres is one store for every system, or a schema and a role per
  system make it one store each (glossary: Store). All four Fresh drafts chose the second.

### Shapes

- Money differs across the examples. Five examples give shop the price or the sku the fixture
  gives catalog (`asm-2-ok-payload-adapter-takes-instance`, `asm-3-ok-actor-through-driving-port`,
  `svc-6-ok-opaque-transaction`, `sys-1-ok-shop-export-paths`, `dom-4-ok-order-line-copies-price`);
  only `sys-12-ok-shop-price-read-only-in-payload-admin` marks itself a variant.
- To write once: Money, Sku, TaxClass, the ids, the checkout object and what payment returns to
  the browser, the message envelope.

## Decision

—

## Consequences

—
