# Affected set, 8ab0943..ec52645

Mechanical: `affected.mjs` over glossary.md, the-world.md and property-rules.md as distilled.
Whitespace-normalized; whether a meaning changed is not judged.

## Changed rule fields, property-rules.md

`*` marks a binding field (Heading, Scope, Statement); a section is listed whole.

- P7: Why, Provenance
- P8: Statement*, Why, Provenance
- P9: Heading*, Scope*, Statement*, Why, Provenance
- P13: Statement*, Why, Provenance
- P15: Statement*, Why, Provenance
- P17: Why

## Changed blocks, the-world.md

`*` marks Heading, Except, Against or a force. No rule names the property it serves: every rule
is read against the change (README, Tiers).

- F5: whole*
- P8: Why
- P9: Heading*, Why

## Changed glossary entries

- Tentative operation

## Uses of changed terms, head

Scope/Statement: a use in Heading, Scope or Statement; the-world `*`: in Heading, Except, Against or a force.

### Tentative operation

- Scope/Statement: P17 (Scope, Statement, Why, Provenance)
- Why/Provenance only: P7 (Why, Provenance), P15 (Why)
- the-world: P8 (Provenance), P17 (Provenance)

## Examples of review 05 hanging on the change

By the rule id in the file name: its rule changed in Heading, Scope or Statement, or uses a
changed term there (terms listed).

- P8: Statement changed
  - p8-ok-payload-outbox-product-changed.md (dist-implementer.md)
  - p8-ok-confirmation-mail-after-commit.md (dist-implementer.md)
  - p8-ok-durable-bus-acks-after-commit.md (dist-implementer.md)
  - p8-ok-saga-1-order-placed-in-outbox.md (dist-implementer.md)
  - p8-ok-revalidate-after-listing-commits.md (dist-implementer.md)
- P9: Heading, Scope, Statement changed
  - p9-ok-stripe-webhook-claimed-in-transaction.md (dist-implementer.md)
  - p9-ok-bank-poll-hands-on-transfer-ids.md (dist-implementer.md)
  - p9-ok-article-registration-asks-before-create.md (dist-implementer.md)
- P13: Statement changed
  - p13-ok-saga-3-payment-events-in-published-language.md (dist-implementer.md)
  - p13-ok-command-declared-by-receiver.md (dist-implementer.md)
- P15: Statement changed
  - p15-ok-listing-replica-refreshed-on-notice.md (dist-implementer.md)
  - p15-ok-checkout-returns-client-secret.md (dist-implementer.md)
- P17: Tentative operation
  - p17-breach-intent-before-payment-record.md (dist-implementer.md)
  - p17-ok-payment-expiry-outlives-stripe-retries.md (dist-implementer.md)
  - p17-ok-refund-refused-for-dispute.md (dist-implementer.md)
  - p17-ok-reservation-hold-ends-without-shop.md (dist-implementer.md)
  - p17-ok-saga-5-deadline-in-order.md (dist-implementer.md)
  - p17-ok-saga-6-invoice-order-is-no-wait.md (dist-implementer.md)
  - p17-ok-saga-7-late-payment-refunded.md (dist-implementer.md)
