# 19 — Examples after the review

**Status:** open

## Context

164 files in `examples/`, 70 of them ok. The full review's raw Implementer (spec 02) read all 70
against every rule and flagged 26; the distilled Implementer read the 14 the rules name. 55 of 67
rules have `*Examples:* —`. Issue 08's example items are folded in below. Order:
`specs/02-review-findings.md`, step 10, last of the writing steps: the examples illustrate the
rules as issues 12 to 16 leave them, the fixture as issue 17 leaves it.

Settled when it was opened:

- Fan-out by section of `general-rules.md`: Domain, Service, Driving adapters, Driven adapters,
  Assembly, Transactions, Other systems, Tests. One fresh subagent per section, given the
  distilled output regenerated from the documents as they then stand, `domain.md`, and its
  section's example files, nothing else. Each context starts empty, so the distilled costs it
  nothing, and it carries every rule, so a file is checked against all of them, not the ones it
  lists.
- Each writer, per rule of its section: checks every file naming the rule against every rule,
  fixes or deletes; writes the missing breach and ok; fills the rule's Examples line; names the
  fixture's shapes, never its own (issue 17). It reports a detour instead of building it
  (issue 18), as a finding file.
- Then one Implementer pass over the whole set, as the README's reader: every ok file against
  every rule. What it flags is fixed before the issue closes.
- Round 1's finding files: a `gap-*` file whose situation issue 15 ruled becomes a breach or an
  ok example of that rule, or goes.
- From issue 04's proposal: a MAY's breaches are listed under the rule that governs once the
  MAY's Scope fails. The README's examples entry gains it.

## Problem

### Ok files that fail a rule they list

- `asm-9-ok-transaction-handed-as-argument`, `svc-3-ok-place-order-writes-cart-itself`,
  `svc-4-ok-mark-paid-through-repository`: TX-1, a load before the transaction.
- `asm-2-ok-payload-adapter-takes-instance`, `asm-7-ok-logger-and-tracer-imported-ready-made`:
  DVN-4, an import from `./` (issue 14 decides).
- `dom-4-ok-order-line-copies-price`: DOM-4's Scope holds nowhere, both references cross
  systems; "sku: shop's own commercial field" contradicts the fixture.

### Ok files listing a rule whose Scope the code does not reach

`svc-7-ok-order-overview-through-query-port` TX-1; `svc-6-ok-opaque-transaction` DOM-1;
`sys-14-ok-money-returns-remainder` DOM-1; `tx-3-ok-checkout-requests-checkout-session` TX-3;
`tx-22-ok-payment-requests-checkout-session` TX-22;
`tx-29-ok-catalog-writes-product-changed-in-payload-transaction` TX-22.

### Ok files that breach a rule they do not list

- SVC-7, `new Date()` in a server action: `drv-1-ok-session-through-answering-service`,
  `drv-3-ok-server-action-reads-courier`, `drv-6-ok-server-action-reads-at-run-time`,
  `asm-3-ok-hook-passes-editor`.
- TX-1, a load outside the transaction: `svc-2-ok-cancel-order-decides-itself`,
  `tx-30-ok-payment-asks-stripe-at-deadline` (four readers).
- DRV-8, an upstream's published language imported by a handler:
  `sys-9-ok-billing-imports-from-export-path`, `tx-1-ok-one-invoice-transaction-per-message`
  (issue 14 decides).
- DRV-8, a handler typed by a driven port calling it with no use case:
  `svc-3-ok-place-order-writes-cart-itself`.
- SYS-2, the published language declared with the domain:
  `tx-17-ok-fulfillment-subscribes-to-order-placed`, `tx-7-ok-gift-message-added-optional`.
- SYS-1, an export path exporting an adapter or a courier accessor:
  `asm-2-ok-assembly-hands-upstreams-to-builder`,
  `asm-8-ok-register-fills-courier-before-requests`, `drv-6-ok-server-action-reads-at-run-time`;
  `sys-12-ok-shop-price-read-only-in-payload-admin`'s `ChangePriceButton` (three readers).
- TX-28: `asm-3-ok-actor-through-driving-port`, an `afterChange` hook commits before Payload.
- TX-19: `tx-6-ok-payment-succeeded-written-with-payment`, `payment_failed` after `succeeded`
  fails a paid payment.
- ASM-2: `asm-7-ok-logger-and-tracer-imported-ready-made`, a default `fetch`.
- `svc-7-ok-payment-reaches-stripe-through-gateway-port`: the hook imports `stripe` (four
  readers; issue 14).
- `sys-13-ok-checkout-process-sends-receivers-commands`: loses the `client_secret` (issue 17)
  and never acknowledges on redelivery (TX-5).

### Other

- `svc-7-ok-payment-reaches-stripe-through-gateway-port`'s TX-5 and
  `sys-12-ok-shop-price-read-only-in-payload-admin`'s SVC-4 rest on prose, not code.
- `tx-34-ok-refund-refusal-published` decides by payment and saves only the refund (TX-24).
- `tx-29-ok-catalog-writes-product-changed-in-payload-transaction` hands fulfillment's handlers to
  the server bus and carries no version.
- `tx-33-ok-billing-handles-payment-refunded` never acknowledges a refund of an order with no
  invoice (distilled Implementer).
- `tx-12-ok-shipment-status-replica-from-fulfillment-messages` calls the replica "shop's own
  aggregate" and filters a listing by it (TX-27).
- `tx-1-ok-refund-and-payment-in-one-transaction` throws on a refused refund; called for shop's
  `RefundPayment`, that is TX-34's breach.
- The `asm-1-*` examples name a port `tx`.
- `svc-6-ok-place-order-dependencies` and `drv-1-ok-session-through-answering-service` use a
  courier accessor whose imports are not shown; their DRV-8 claim depends on where it lives.

### Missing

- 55 rules with `*Examples:* —`. Eleven have no file on disk: DRV-7, ASM-10, TX-20, TX-21, TX-23,
  TX-24, TX-25, TX-26, TX-27, TST-10, TST-12. The other 44 have files the line does not name.
- ASM-7 has no breach example; its old one, deleted by issue 11, breached TX-1 in its loop.
- TX-7 has no example of an open host service called from another process, its Scope since issue
  01.
- The `tx-2-*` files show writes only; TX-2's Scope covers reads since issue 10.
- Examples that still import a published language re-exporting the domain, or declare driven
  ports outside `service/ports`, predate SYS-2's flip and SVC-1's move (issue 08).
- `OrderQueries` in the TST-11 examples groups two use cases in one driving port.
- Examples sending commands named for their sender's model (issue 01's glossary change).
- Eight examples keep the old backdrop, shop syncing its price into Payload, for rules they do
  not touch: `asm-1-breach-payload-config-builds-shop`, `asm-2-breach-adapter-builds-payload`,
  `asm-2-ok-payload-adapter-takes-instance`, `asm-2-ok-assembly-hands-upstreams-to-builder`,
  `asm-3-ok-actor-through-driving-port`, `asm-3-ok-hook-passes-editor`,
  `sys-1-ok-shop-export-paths`, `svc-6-ok-opaque-transaction`.
- Round 1's finding files: `gap-admin-dashboard-belongs-to-no-system`,
  `gap-health-and-metrics-endpoints` (issue 15).
- Whatever still cites a retired id is a finding.

## Decision

—

## Consequences

—
