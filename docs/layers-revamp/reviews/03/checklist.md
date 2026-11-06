# Review 03, cooperative findings as a checklist

What the two Implementers and the four Fresh drafts of review 03 reported, one line each, with a
stable id. The regression reader (`reviews/regression-reader.md`) marks each item after a change:
`resolved`, `unchanged`, `newly broken`, `out of scope` (the change did not touch it). Items are
never removed; a resolved item keeps its line. Source files: `raw-implementer.md`,
`dist-implementer.md`, `raw-fresh-a.md`, `raw-fresh-b.md`, `dist-fresh-a.md`, `dist-fresh-b.md`.

## Cannot-comply

- R03-1 raw Impl: SVC-6, DRV-8 with SVC-4: calling a port reaches the code behind it, which no
  reach list names (`svc-6-breach-service-reaches-repository-behind-port`).
- R03-2 dist Impl: TX-22 × TX-28: a pre-commit hook can neither revalidate nor ask for it by
  outbox (`tx-28-breach-pre-commit-hook-cannot-ask-for-revalidation`).
- R03-3 dist Impl: TX-3/TX-22 × fixture: an unconfirmed PaymentIntent is no tentative operation
  under the glossary, so no `client_secret` in the request
  (`tx-36-breach-checkout-payment-intent-in-request`).
- R03-4 dist Impl: TX-5 × TX-37: a handler changing a keyless external system cannot be
  idempotent without checking its records (`tx-37-breach-order-confirmation-mail-without-key`).
- R03-5 dist Impl, tension: a published language cannot state a domain rule without stating it
  twice (SYS-2, DOM-1, DOM-7; `sys-14-ok-money-returns-remainder`).

## Relies-on

- R03-6 raw Impl: SVC-2's line on DRV-8 claims no service is reached; under Reach the service
  behind a driving port is.
- R03-7 raw Impl: TX-37's line on TX-31 drops "that takes an idempotency key".

## Ok examples flagged, by cause

- R03-8 SYS-1 "offer": `sys-1-ok-shop-export-paths`, `svc-1-ok-place-order-port-beside-service`,
  `sys-10-ok-port-types-exported-as-types`, `asm-4-ok-route-handler-reads-courier`,
  `drv-3-ok-server-action-reads-courier`, `drv-6-ok-server-action-reads-at-run-time`,
  `sys-12-ok-shop-price-read-only-in-payload-admin` export what is not offer (both Impls).
- R03-9 DOM-1 and Pure: `randomUUID()` in the domain, `tx-17-ok-fulfillment-subscribes-to-order-placed`,
  `tx-22-ok-order-confirmation-mail-through-outbox` (raw Impl).
- R03-10 SVC-7, `new Date()` in a driving adapter: `asm-3-ok-hook-passes-editor`,
  `drv-1-ok-session-through-answering-service`, `drv-3-ok-server-action-reads-courier`,
  `drv-6-ok-server-action-reads-at-run-time` (raw Impl N7).
- R03-11 ASM-2 "needs", clients built in the builder or factory: `asm-1-ok-fulfillment-worker-one-assembly`,
  `asm-7-ok-logger-and-tracer-imported-ready-made`, `tst-8-ok-real-run-behind-env-flag`,
  `asm-2-ok-assembly-hands-upstreams-to-builder`, `asm-8-ok-register-fills-courier-before-requests`
  (raw Impl N6).
- R03-12 SYS-9, assembly reaching a system's adapters or repositories:
  `asm-2-ok-assembly-hands-upstreams-to-builder`, `asm-8-ok-register-fills-courier-before-requests`,
  `asm-2-ok-handler-receives-service` (raw Impl).
- R03-13 TX-1, a load outside the transaction: `asm-9-ok-transaction-handed-as-argument`,
  `svc-3-ok-place-order-writes-cart-itself`, `svc-4-ok-mark-paid-through-repository`,
  `svc-2-ok-cancel-order-decides-itself`, `tx-30-ok-payment-asks-stripe-at-deadline` (both Impls).
- R03-14 SVC-4, a part saved: `asm-9-ok-transaction-handed-as-argument`,
  `tx-22-ok-order-confirmation-mail-through-outbox`, `tx-1-ok-place-order-service-holds-transaction`
  (`carts.clear`), `tx-31-ok-3pl-booking-keyed-by-shipment-id` (`recordBooking`) (both Impls).
- R03-15 TX-28, a hook committing or publishing before Payload: `asm-3-ok-actor-through-driving-port`,
  `asm-3-ok-hook-passes-editor`, `tx-28-ok-after-change-hook-records-revalidation-request` (both).
- R03-16 TX-37, the handler decides again: `tx-28-ok-after-change-hook-records-revalidation-request`
  (`givesUpWaiting`) (both Impls).
- R03-17 TX-22 met only through TX-36, or out of Scope: `tx-22-ok-payment-requests-checkout-session`,
  `tx-31-ok-3pl-booking-keyed-by-shipment-id`, `tx-3-ok-checkout-requests-checkout-session` (both).
- R03-18 Scope not reached, "satisfies" misleading: ASM-3 in `asm-3-ok-confirmation-message-carries-locale`,
  `asm-3-ok-hook-passes-editor`, `drv-1-ok-session-through-answering-service`,
  `svc-2-ok-cancel-order-decides-itself`, `tx-22-ok-order-confirmation-mail-through-outbox`;
  TX-15 in `tx-15-ok-customer-stats-follow-order-paid-by-message`; TX-1 in
  `svc-7-ok-order-overview-through-query-port`; DOM-1 in `svc-6-ok-opaque-transaction`; DOM-4 in
  `dom-4-ok-order-line-copies-price` (raw Impl N8).
- R03-19 SYS-2, published schemas in the domain: `tx-17-ok-fulfillment-subscribes-to-order-placed`,
  `tx-7-ok-gift-message-added-optional`, `dom-1-ok-order-schema-imports` (raw Impl).
- R03-20 TX-5, redelivery throws or doubles: `svc-2-ok-cancel-order-decides-itself`,
  `tx-1-ok-refund-and-payment-in-one-transaction`, `sys-13-ok-checkout-process-sends-receivers-commands`
  (both Impls).
- R03-21 TX-19, order of arrival: `tx-6-ok-payment-succeeded-written-with-payment`,
  `tx-33-ok-billing-handles-payment-refunded` (both Impls).
- R03-22 TX-23, a blind upsert: `tx-2-ok-reservation-lines-written-in-handed-transaction` (raw).
- R03-23 DOM-7, a business rule outside the domain: `tx-12-ok-invoice-number-through-billing-port`,
  `tx-28-ok-before-change-hook-vetoes-sku-change` (contested), `sys-14-ok-money-returns-remainder`
  (both Impls).
- R03-24 SVC-7 contested, the common library's `Transactions` opened by a service:
  `svc-6-ok-opaque-transaction`, `svc-1-ok-place-order-port-beside-service`,
  `sys-10-ok-port-types-exported-as-types` (raw Impl).
- R03-25 SVC-6, an upstream's published language without conforming: `tx-35-ok-late-payment-refunded`
  (dist Impl).
- R03-26 TX-24, TX-30, TX-32 singles: `tx-34-ok-refund-refusal-published` (TX-24),
  `tx-22-ok-payment-requests-checkout-session` (TX-30), `tx-29-ok-catalog-writes-product-changed-in-payload-transaction`
  (no version, handlers on the wrong bus) (dist Impl).
- R03-27 Fixture facts broken: shop writes catalog's price or sku (`asm-2-ok-payload-adapter-takes-instance`,
  `asm-2-ok-assembly-hands-upstreams-to-builder`, `asm-3-ok-actor-through-driving-port`,
  `svc-6-ok-opaque-transaction`, `sys-1-ok-shop-export-paths`, `dom-4-ok-order-line-copies-price`);
  `OrderPlaced` lacks payment method and tax class (`sys-2-ok-shop-messages-union`,
  `sys-14-ok-money-returns-remainder`, `tx-17-ok`); checkout reads no catalog product; a second
  invoice on step 6 (`tx-1-ok-one-invoice-transaction-per-message`); Checkout Session for
  PaymentIntent; `Money` as `amount.amount` (both Impls).

## Words and readings the Implementers hung on

- R03-28 Where a system's code is: by package or by role (raw N5).
- R03-29 ASM-2 "needs" against the glossary's System builder (raw N6).
- R03-30 Clock and randomness as the outside (raw N7).
- R03-31 Whose rule is the sku veto; "open order" (raw N9, dist N18).
- R03-32 `PaymentFailed` terminal or not (raw N11, dist N8).
- R03-33 External-system code inside the rules: is the Assumptions' list closed (raw N12).
- R03-34 Store: one Postgres is one store (raw N14).
- R03-35 Stale answers from a live open host service, no rule needs the business rule (raw N15).
- R03-36 "Of this codebase" for a configured external system (raw N17).
- R03-37 "Acknowledge" against Settle (raw N17, dist N19).
- R03-38 "Decides" in SVC-2, TX-22, TX-37: a count returned, a record step keeping the first
  answer (raw N17).
- R03-39 Reservation beyond stock (raw N18, dist N15).
- R03-40 PaymentIntent as tentative; confirmation by a third party (raw N21, dist N9).
- R03-41 Request id in outbox headers, ASM-3's reach (raw N23).
- R03-42 Idempotent: whose records (dist N7).
- R03-43 zod as pure; `node:crypto`; who mints ids in a published builder (dist N10).
- R03-44 Probes and the courier (dist N16, raw N4).
- R03-45 "Conforms": how a system declares it (dist N20).
- R03-46 Test words: "double", "flag", "contract suite" (dist N20).
- R03-47 TX-37's purpose and the `handled.claim`; TX-28's carve-out (dist purpose list).
- R03-48 Credit note for a refund of an order never invoiced; fails forever under TX-38 (raw N10,
  dist `tx-33-ok`).

## Fresh drafts, sentences three or more read the same way

- R03-49 Store "can carry" as configured by roles, one instance is four stores (4 of 4).
- R03-50 External system's configuration holds rules, read over P2 (4 of 4; C4).
- R03-51 Offer's "fakes of those ports" as open host service ports only (4 of 4).
- R03-52 Pure's "loads on every runtime" as every JavaScript runtime (3).
- R03-53 Pure's "hands nothing" bans clock and randomness from the domain (3).
- R03-54 P9 "delivery" includes hook calls (3).
- R03-55 P15 "needs now" met by the synchronous stock hold (4).
- R03-56 P8 lets a tentative operation precede the commit (3).
- R03-57 P17 and parked deliveries: two drafts report it not holding.
- R03-58 P5's Except restricts to behaviour-free common code (3).
- R03-59 Choices: C8 PaymentIntent before or after the commit (2:2), C9 payments as own system
  (2:2); C1, C2, C3, C6 confirmed open.
