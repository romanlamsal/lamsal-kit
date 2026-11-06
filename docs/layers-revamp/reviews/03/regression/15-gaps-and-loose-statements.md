Base 8937ad5, head 042da0f.

Judged on `distill.mjs` run at head (HEAD = 042da0f), diffed against the same script at 8937ad5.
"Pre-existing" marks a breach the change did not cause.

## Checklist

- R03-1: resolved — Reach: what a service or driving adapter reaches through a port of its system it reaches as the port; repository and driving port stop the reach.
- R03-2: resolved — TX-28 now lets the hook's use case record the change as pending (a private message), TX-44 makes the handler wait for confirmation; TX-22 is met by that message.
- R03-3: out of scope — rests on the glossary's Tentative operation and TX-36, neither touched (settled by issue 20).
- R03-4: resolved — TX-37 now lets the handler ask its records "whether it has made it already"; TX-41 covers the keyless repeat.
- R03-5: resolved — SYS-16 lets a published language state a constraint a business rule also states.
- R03-6: resolved — Reach: the driving adapter reaches the driving port of its system, not the service behind it; SVC-2's line holds.
- R03-7: unchanged — TX-37's Relies-on line on TX-31 still drops "that takes an idempotency key".
- R03-8: out of scope — SYS-1 and Offer untouched.
- R03-9: unchanged — `randomUUID()` still fails Pure's handing clause; DOM-1 now also wants "loads on every runtime of the language".
- R03-10: unchanged — `new Date()` reaches the operating system (Outside); SVC-7 binds the driving adapter as before.
- R03-11: out of scope — ASM-2 untouched; System builder lost only its list of returns.
- R03-12: out of scope — SYS-9 and Offer untouched; assembly still imports shop's `createPayloadCatalog`.
- R03-13: out of scope — TX-1's Statement untouched (Why only).
- R03-14: out of scope — SVC-4 untouched; TX-23's new Scope does not reach a part write.
- R03-15: unchanged — TX-28 as reworded: `tx-28-ok-after-change-hook-records-revalidation-request` now complies; the other two still save a price or publish before Payload commits.
- R03-16: unchanged — TX-37 as sharpened still refuses `givesUpWaiting` in the handler; the example is not yet moved.
- R03-17: out of scope — TX-22, TX-36, TX-3 untouched.
- R03-18: unchanged — ASM-3's widened Scope and DOM-1's new clause still go unreached by the listed ok files; the Decision accepts out-of-Scope ok examples.
- R03-19: out of scope — SYS-2 untouched; SYS-16 permits restating, not declaring the published language in the domain.
- R03-20: unchanged — TX-5 untouched; in `sys-13-ok` TX-23 now fails the second save instead of doubling, still not idempotent.
- R03-21: unchanged — TX-19 as reworded: `tx-6-ok`'s `applyOutcome` lets a failed after a succeeded end failed, not as written.
- R03-22: unchanged — TX-23's Scope now holds for a save never loaded and refuses the blind upsert; `tx-2-ok` still shows it as ok.
- R03-23: unchanged — SYS-16 clears `sys-14-ok`'s published constraint; `tx-12-ok`'s ownership check stays in the service (DOM-7).
- R03-24: newly broken — Reach now stops only at a port of its system; the common library's `Transactions` is none, so the service reaches the store (SVC-7), and ASM-7's Scope fails for a transaction whose commit changes how the use case acts (see Newly broken N1).
- R03-25: unchanged — where conforming is recorded is now the repository's (Assumptions); `tx-35-ok` records nothing, SVC-6 still unmet.
- R03-26: unchanged — TX-30 now adds "so that the waiting ends"; payment still has no rule ending its wait on the session; TX-24, TX-32 parts untouched.
- R03-27: out of scope — fixture facts.
- R03-28: out of scope — System's "a module is of the system…" came with issue 20.
- R03-29: out of scope — the "takes configuration and what the process holds once" clause untouched.
- R03-30: out of scope — Outside and Pure's handing clause untouched.
- R03-31: out of scope — catalog's config rules, issue 20.
- R03-32: out of scope — nothing on `PaymentFailed`.
- R03-33: resolved — Assumptions now list what the configuration reads of the system's records (SYS-9), which is raw's stock replica.
- R03-34: out of scope — Store untouched.
- R03-35: resolved — TX-27's Scope now holds for "what the owner answered".
- R03-36: resolved — Assumptions: an external system "is no system of this codebase where a rule says one".
- R03-37: out of scope — Settle went with issue 20; DRV-7's "acknowledge" untouched.
- R03-38: resolved — TX-37: a claim or a record step keeping the first answer decides nothing beyond "whether it has made it already".
- R03-39: out of scope — fixture reading.
- R03-40: out of scope — Tentative operation, issue 20.
- R03-41: resolved — ASM-3's Scope now covers the read "through what it calls"; a request id changes no act or answer; the crossing is Not covered.
- R03-42: out of scope — Idempotent, issue 20.
- R03-43: resolved — Pure loses the runtime clause (`node:crypto` outside domain and published language is pure); DOM-1 and SYS-14 keep it; zod loads everywhere.
- R03-44: resolved — ASM-4 admits a probe.
- R03-45: resolved — Assumptions: where a system records conforming is the repository's.
- R03-46: resolved — Double entered; "contract suite" defined in TST-6's Statement.
- R03-47: resolved — TX-37 admits the claim; TX-28's carve-out is "recording … as pending", with TX-44.
- R03-48: unchanged — TX-38 still makes `tx-33-ok`'s refund of an order never invoiced fail on every delivery.
- R03-49: out of scope — Store untouched.
- R03-50: out of scope — External system, issue 20.
- R03-51: out of scope — Offer, issue 20.
- R03-52: resolved — "every runtime of the language" now binds only DOM-1 and SYS-14, where browser and other processes import.
- R03-53: out of scope — Pure's handing clause untouched.
- R03-54: out of scope — P9 untouched.
- R03-55: out of scope — P15 untouched; TX-40 concerns reads, not the stock hold.
- R03-56: out of scope — P8 untouched.
- R03-57: unchanged — TX-45 and "so that … ends" close refusals and waits; a TX-38 stop still parks with no rule ending it.
- R03-58: unchanged — P5's Except untouched; with Reach narrowed it now has to carry the common library's `Transactions`, which its "output changes neither" excludes (N1).
- R03-59: unchanged — C6 bounded by TX-40, still open.

## Examples in the affected set

No breach file flips by this change. Six adversarial breach files (asm-1, asm-8-lazy, drv-1-callback,
drv-6, svc-2-loaded, svc-4-second) met their Statement at 8937ad5 by their own text and still do.

- asm-1-breach-one-assembly-run-twice.md: holds — ASM-1 met, as the file says; untouched, not a flip.
- asm-2-ok-assembly-hands-upstreams-to-builder.md: breach — SYS-9: assembly imports shop's driven adapter `createPayloadCatalog` (pre-existing, R03-12); ASM-11 holds.
- asm-2-ok-shop-reads-invoice-through-driven-port.md: breach — SVC-8 (new): shop's `Invoices` port returns billing's `Invoice`, newly broken N2; also TX-40 SHOULD (new), no rule needs billing's answer now.
- asm-3-breach-current-user-from-request-context.md: breach — ASM-3, now explicit: the service reads through the helper it calls.
- asm-3-breach-current-user-getter-through-factory.md: breach — ASM-3, "through what it calls" names it directly.
- asm-3-breach-locale-read-from-request-context.md: breach — ASM-3.
- asm-3-breach-repository-scopes-rows-by-ambient-customer.md: breach — ASM-3.
- asm-3-breach-service-reads-request-user.md: breach — ASM-3.
- asm-3-ok-actor-through-driving-port.md: breach — TX-28: the hook's use case saves the price before Payload commits, beyond recording the change as pending (pre-existing, R03-15).
- asm-3-ok-confirmation-message-carries-locale.md: holds — ASM-3's Scope unreached (R03-18).
- asm-3-ok-hook-passes-editor.md: breach — TX-28: publishes `productPageInvalidated` before Payload commits, no pending record (pre-existing, R03-15); `new Date()` R03-10.
- asm-3-ok-trace-context-crosses-bus-in-envelope.md: holds — ASM-3, ASM-7; the crossing is now Not covered.
- asm-4-breach-driven-adapter-reads-courier.md: breach — ASM-4: a driven adapter is neither of the two readers.
- asm-4-ok-route-handler-reads-courier.md: holds — ASM-4.
- asm-8-breach-courier-filled-with-lazy-factory.md: holds — ASM-8 met, as the file says; untouched, not a flip.
- asm-8-breach-route-fills-courier-lazily.md: breach — ASM-8, ASM-1.
- asm-8-ok-register-fills-courier-before-requests.md: breach — SYS-9, `createPayloadCatalog` (pre-existing, R03-12).
- asm-9-ok-transaction-handed-as-argument.md: breach — TX-1 load outside the transaction (R03-13), SVC-4 `carts.clear` (R03-14), both pre-existing; its `TransactionPort` is shop's, so Reach stops; TX-43 holds.
- dom-1-breach-domain-imports-common-tracing-module.md: breach — DOM-1: the tracer module is no port of shop's, reach goes on to `node:async_hooks`, which loads on no browser; the file's defence falls.
- dom-1-breach-order-id-from-node-crypto.md: breach — DOM-1's runtime clause; `randomUUID` fails Pure.
- dom-1-breach-order-number-hash-from-node-crypto.md: breach — DOM-1: `node:crypto`, `node:buffer` do not load on every runtime of the language.
- dom-1-breach-order-type-from-drizzle-table.md: breach — DOM-1.
- dom-1-ok-order-schema-imports.md: breach — SYS-2, the published language is the domain module (pre-existing, R03-19); DOM-1 holds.
- drv-1-breach-callback-in-acting-call.md: holds — DRV-1 met, as the file says; TX-43 holds (the callback hands no transaction); not a flip.
- drv-1-breach-invoice-batch-in-one-transaction.md: breach — DRV-1, TX-1.
- drv-1-ok-session-through-answering-service.md: breach — SVC-7, `new Date()` in the adapter (pre-existing, R03-10).
- drv-3-ok-server-action-reads-courier.md: breach — SVC-7, `new Date()` (pre-existing, R03-10).
- drv-6-breach-courier-read-memoized-on-first-run.md: holds — DRV-6 met, as the file says; not a flip.
- drv-8-breach-adapter-reads-repository-to-check-owner.md: breach — DRV-8 (a driven port of its system, reached as the port), SVC-2.
- drv-8-breach-mailer-subscribed-to-bus-in-assembly.md: breach — DRV-8.
- drv-8-breach-server-action-updates-order-table.md: breach — DRV-8.
- dvn-4-ok-payload-adapter-imports-external-package.md: holds — DVN-4: Payload's package is catalog's published language (Assumptions), the outside; SVC-8 holds.
- svc-1-ok-driven-ports-in-service-layer.md: holds — SVC-1, SVC-6, SVC-8.
- svc-2-breach-loaded-order-passed-through-port.md: holds — SVC-2 as sharpened still met: the decision falls on the Order the call saves; not a flip.
- svc-2-breach-server-action-checks-before-cancel.md: breach — SVC-2.
- svc-2-ok-cancel-order-decides-itself.md: breach — TX-5, a repeat throws `CancelRefused` (pre-existing, R03-20); sharpened SVC-2 holds.
- svc-3-breach-place-order-calls-clear-cart.md: breach — SVC-3, TX-1.
- svc-3-ok-place-order-writes-cart-itself.md: breach — DRV-8: the handler calls `MailSender` itself (pre-existing).
- svc-4-breach-mark-paid-updates-column.md: breach — SVC-4, SVC-6.
- svc-4-breach-second-repository-patches-order-status.md: holds — SVC-4 met, as the file says; TX-23's Scope fails for a part write; not a flip.
- svc-4-ok-mark-paid-through-repository.md: breach — TX-35 (sharpened): a late `PaymentSucceeded` throws `NotPayable` and is redelivered, so its part of the work never ends; intended by the Decision.
- svc-6-breach-drizzle-transaction-in-port.md: breach — SVC-6, SVC-7; now SVC-8 too.
- svc-6-ok-opaque-transaction.md: breach — SVC-7 via `Transactions`, newly broken N1; TX-43 (new, intended): the Payload adapter hands shop's transaction to catalog.
- svc-6-ok-place-order-dependencies.md: holds — where `transactions` is declared is not shown.
- svc-7-breach-server-action-raw-sql-through-common-pool.md: breach — SVC-7.
- svc-7-breach-service-queries-handed-drizzle-client.md: breach — SVC-7.
- svc-7-ok-order-overview-through-query-port.md: holds — SVC-7, SVC-8.
- svc-7-ok-payment-reaches-stripe-through-gateway-port.md: holds — DRV-8 admits Stripe's package as an upstream's published language (Assumptions).
- sys-13-ok-checkout-process-sends-receivers-commands.md: breach — TX-5 (pre-existing, R03-20); TX-23 now fails the repeated save rather than doubling.
- sys-14-breach-money-imports-common-logger.md: breach — SYS-14.
- sys-14-ok-money-returns-remainder.md: holds — SYS-14; SYS-16 admits `quantity` positive in shop's published language.
- sys-1-breach-shop-exports-order-repository.md: breach — SYS-1, TX-12.
- sys-1-ok-shop-hooks-via-builder.md: holds — ASM-11 admits hooks as driving adapters; System builder no longer lists returns (issue 20's N1 gone).
- sys-9-breach-dashboard-imports-drizzle-tables.md: breach — SYS-9, TX-12.
- tx-12-breach-order-detail-joins-invoices-table.md: breach — TX-12, SYS-9.
- tx-12-breach-query-port-on-billing-open-host-service.md: breach — SVC-8 (new): `InvoiceLookup` takes Drizzle's `SQL`, returns billing's rows; TX-12 still met as written.
- tx-12-breach-replica-refreshed-from-fulfillment-tables.md: breach — TX-12: no events, no handler.
- tx-12-ok-invoice-number-through-billing-port.md: breach — SVC-8 (new), newly broken N2; TX-40 SHOULD (new); DOM-7 (pre-existing, R03-23).
- tx-12-ok-shipment-status-replica-from-fulfillment-messages.md: holds — TX-12: events delivered to shop's handler.
- tx-17-breach-order-placed-addressed-to-fulfillment.md: breach — TX-17.
- tx-17-ok-fulfillment-subscribes-to-order-placed.md: breach — DOM-1 `randomUUID` (R03-9), SYS-2 (R03-19), pre-existing; TX-17 holds.
- tx-19-breach-not-found-read-as-already-released.md: breach — TX-19 as reworded.
- tx-1-breach-cart-cleared-after-order-committed.md: breach — TX-1.
- tx-1-breach-order-saved-without-transaction.md: breach — TX-1; TX-23 too, an upsert.
- tx-1-breach-repository-reads-ambient-unit-of-work.md: breach — TX-1, ASM-9.
- tx-1-ok-one-invoice-transaction-per-message.md: holds — TX-1, TX-5, DRV-7 as reworded.
- tx-1-ok-place-order-service-holds-transaction.md: breach — SVC-4 `carts.clear` (pre-existing, R03-14); `TransactionPort` is shop's.
- tx-1-ok-refund-and-payment-in-one-transaction.md: breach — TX-5 (pre-existing, R03-20).
- tx-22-breach-claim-rolled-back-after-3pl-call.md: breach — TX-22, TX-5; TX-41 too.
- tx-22-ok-order-confirmation-mail-through-outbox.md: breach — DOM-1 `randomUUID` (R03-9), SVC-4 `carts.clear` (R03-14), pre-existing.
- tx-22-ok-payment-requests-checkout-session.md: breach — TX-30: no rule of payment's ends the wait (pre-existing, R03-26).
- tx-28-ok-after-change-hook-records-revalidation-request.md: breach — TX-29 as listed; TX-37 `givesUpWaiting` (R03-16); TX-28 and TX-44 now met.
- tx-30-breach-payment-pending-until-webhook.md: breach — TX-30.
- tx-30-ok-payment-asks-stripe-at-deadline.md: breach — TX-1, a transaction per payment in one use case (pre-existing); TX-30 holds, TX-27 now in Scope and met by `settleFromStatus`.
- tx-32-breach-dunning-stage-changed-without-version.md: breach — TX-32, TX-19.
- tx-32-ok-dunning-stage-changed-carries-version.md: holds — TX-32, TX-19 as reworded, TX-23.
- tx-33-ok-billing-handles-payment-refunded.md: breach — TX-38 with TX-21, refund of an order never invoiced (pre-existing, R03-48).
- tx-34-breach-refund-refusal-thrown.md: breach — TX-34.
- tx-34-ok-refund-refusal-published.md: holds — TX-34.
- tx-35-breach-late-payment-dropped.md: breach — TX-35.
- tx-35-ok-late-payment-refunded.md: breach — SVC-6, no conformity recorded (pre-existing, R03-25).
- tx-3-ok-checkout-requests-checkout-session.md: holds — TX-43: the call after commit carries nothing.
- tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md: holds — TX-5, TX-19 as reworded, TX-23.
- tx-7-breach-amount-unit-changed-in-place.md: breach — TX-7.
- tx-7-breach-customer-id-renamed-quantity-narrowed.md: breach — TX-7.
- tx-7-ok-gift-message-added-optional.md: breach — TX-7 (sharpened): old code reads a new row without its gift message, not "as new code meant it"; newly broken N3.

## Previous builds

- **Reach** ("a port of its system"). dist `### Systems` (`builder.ts` imports `TransactionPort` from
  `@teeladen/common/postgres`) and `### common library`: every service's `transaction.run` now
  reaches the store past no port of its system, so SVC-7 is breached (N1). raw `### shop` ("Service
  layer: ports"): `TransactionPort`, `Clock`, `Ids` are shop's own, so reach stops there; complies.
- **Pure**. raw `### payment`, `stripe-webhook-route.ts` (`node:crypto` `createHmac`): now pure code
  of no system, so it complies with DRV-8; issue 20's N2 is gone. raw `### Systems` kernel and both
  builds' published languages (zod only) meet DOM-1/SYS-14's runtime clause.
- **System builder / ASM-11**. raw `### shop` "Builders and export paths" (`buildShopRoutes`,
  `buildShopCatalogHooks`), `### payment` (`buildPaymentRoutes`), `### fulfillment` (`hooks.threePl`);
  dist `### Systems` (`buildShopCatalogHooks`, `scheduled`, `payment.hooks`, `stock.hooks`): all
  driving adapters, port implementations or outbox readers; now comply (issue 20's N1 is gone).
- **Assumptions, external system**. raw `### catalog` `stock-replica.ts` and dist `### catalog`'s
  virtual `stock` field now fall under SYS-9; both reach fulfillment through its offer (published
  language; hook from `buildFulfillmentQueries`). Both comply.
- **SVC-2**. raw `### fulfillment` `apply-shop-order.ts`: `planShipment(… registeredAmong …)` decides
  by registrations it does not save, and accepts the race ("TX-24's delay"), so TX-24's Scope fails
  and SVC-2's MUST binds: now breaches; `release-awaiting-shipments.ts` the same. dist `### shop`
  `checkout.ts`: `mayPayByInvoice` on the replica fallback `d.dunning.stageOf`, not saved; TX-24
  excludes replicas, so SVC-2 binds: now breaches (N4).
- **SVC-8**. dist `### common library`: `TransactionPort.run(work: (tx: Tx))` with
  `Tx = PgTransaction<…>`; every repository port handed `tx` takes Drizzle's type: now breaches.
  raw ports take the opaque `Transaction`: complies.
- **TX-27** (Scope widened). raw `### shop` `invoice-eligibility.ts`, `catalog-product.ts`: business
  rules accept a moved answer; now in Scope, complies. dist `### shop` `checkout.ts`: the dunning rule
  accepts staleness; `linesFrom(current, catalog)` copies catalog's price with no such rule: now
  breaches.
- **TX-37** (sharpened). Every handler's claim in both builds now complies; raw `cancel-if-overdue.ts`,
  `raise-dunning-stage.ts`, `reconcile-payment.ts` ask for changes their own transaction commits:
  Scope fails, as before.
- **TX-40** (new). dist `### shop` `checkout.ts` asks billing's open host service first though its rule
  accepts the replica: deviates (SHOULD). raw `### The checkout saga` says shop's rule needs billing's
  answer now: Scope fails.
- **TX-41** (new). dist finding `tx-37-breach-order-confirmation-mail-without-key`: no rule accepts a
  second mail: breaches. Both builds' 3PL and Resend take keys: Scope fails.
- **TX-43** (new). raw `### shop` `checkout.ts` calls billing inside its transaction handing none;
  dist calls before: both comply.
- **TX-45** (new). raw `### payment` `execute-stripe-refund.ts` commits Stripe's failed refund as
  `RefundRefused`: complies. raw `cancel-payment-intent.ts` with `gateway.cancelIntent` (Stripe
  refuses to cancel an intent that succeeded meanwhile) and raw `### fulfillment` `book-shipment.ts`,
  `register-article.ts` (`!res.ok` throws), dist `### fulfillment` `book-shipment.ts` (`.then`, no
  refusal path): a refusal throws and is redelivered: now breach.
- **TX-12, TX-17, TX-19, DRV-7, TX-30, TX-35** (reworded). Both builds' backoffice handlers, single
  events, version checks, settle-after-commit handlers, lapse and deadline rules: comply as before.
- **ASM-3, ASM-4**. dist `logger` mixin and both builds' outbox `traceHeaders`/`currentTraceContext`:
  now in ASM-3's Scope, comply. dist `### Cross-cutting reads` probe with its own client: still allowed.
- **SYS-16**. raw shop's published `quantity: z.number().int().positive()`: now permitted.

## Newly broken

### N1 (R03-24): a service through the common library's `Transactions`

~~~md
---
breaches: [SVC-7]
satisfies: [SVC-6, TX-1, ASM-9]
situation: shop's service opens the common library's transaction
finding: regression
---

# Cancel-order runs through `Transactions`, an interface of the common library

```ts
// common/transaction.ts — common library
export interface Transactions { run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> }
export const createTransactions = (db: Db): Transactions => ({ run: (work) => db.transaction((d) => work(wrap(d))) })

// shop/service/cancel-order.ts
export const createCancelOrder = (d: { transactions: Transactions; orders: OrderRepository }): CancelOrder =>
  ({ orderId }) => d.transactions.run(async (tx) => {
    const order = await d.orders.byId(orderId, tx)
    await d.orders.save(cancel(order), tx)
  })
```

`Transactions` is no port of shop's, so the service reaches what is behind it, `db.transaction`: the
store, through no port of its system (SVC-7). ASM-7's Scope fails: the commit's outcome decides
whether the use case's writes land and whether it throws. At 8937ad5 the interface stopped the
reach. Hits `svc-6-ok-opaque-transaction`, the dist build.
~~~

### N2: SVC-8 against Conformist

~~~md
---
breaches: [SVC-8]
satisfies: [SVC-1, SVC-6, TX-12]
situation: shop conforms to billing and declares the driven port it reads the invoice through
finding: regression
---

# Shop's port returns billing's `Invoice`

```ts
// shop/service/ports/invoices.ts
import type { Invoice } from "@teeladen/billing/published"   // shop conforms to billing
export interface Invoices { forOrder(orderId: string): Promise<Invoice | null> }
```

A conformist uses billing's published language untranslated in any layer, so `Invoice` is shop's
term; it is also the term of what lies behind the port, which SVC-8 refuses. DOM-1 and SVC-6 have a
conformist entry, SVC-8 none. Hits `asm-2-ok-shop-reads-invoice-through-driven-port`,
`tx-12-ok-invoice-number-through-billing-port`.
~~~

### N3: TX-7 against an added optional field

~~~md
---
breaches: [TX-7]
satisfies: []
situation: shop's OrderPlaced gains an optional gift message; fulfillment's worker deploys later
finding: regression
---

# A gift message old fulfillment code strips

```ts
// shop/domain/messages/order-placed.ts
export const orderPlacedSchema = z.object({ /* fields as before */ giftMessage: z.string().max(200).optional() })
// fulfillment, old code: z.object drops giftMessage; the parcel ships without the note
```

Both directions parse. Old code reads a new row as an order without a gift message, not "as new
code meant it". The clause that refuses an ignored `paidByInvoice` refuses every optional field an
old reader ignores; `tx-7-ok-gift-message-added-optional` breaches.
~~~

### N4: SVC-2 against TX-24 and TX-27

~~~md
---
breaches: [SVC-2]
satisfies: [TX-27, TX-1]
situation: checkout refuses pay-by-invoice by shop's dunning replica
finding: regression
---

# Checkout decides by the replica and saves the Order and Cart

```ts
// shop/domain/order.ts
export const mayPayByInvoice = (stage: DunningStage | undefined) => stage === undefined || stage === "none"  // a lagging stage is accepted

// shop/service/checkout.ts
async ({ cartId, customerId, payBy }) => transaction.run(async (tx) => {
  const cart = await carts.byId(cartId, tx)
  if (payBy === "invoice" && !mayPayByInvoice(await dunning.stageOf(customerId, tx))) throw new InvoiceNotOffered()
  await orders.save(placeOrder({ id: orderIdFor(cartId), customerId, payBy, lines: cart.lines, now: clock.now() }), tx)
  await carts.save(checkedOut(cart), tx)
})
```

The decision rests on the replica, which the call does not save. Read as the Decision reads SVC-2
("reload and save again breaches": what it decides by is what the call saves), its MUST refuses
what TX-27 admits. TX-24, the narrower Scope, leaves replicas out, and decisions that need not hold
at commit, so SVC-2 governs exactly where the stricter rule makes least sense. Hits raw
fulfillment's `planShipment` by `registeredAmong`, dist checkout.
~~~

## Noticed

- TX-46's Scope is a driving adapter asking; both builds poll the bank from a service through a driven port, which no Scope reaches.
- `svc-3-ok-place-order-writes-cart-itself`: its handler calls the `MailSender` driven port (DRV-8), unlisted.
- `tx-30-ok-payment-asks-stripe-at-deadline`: one use case commits a transaction per payment (TX-1), unlisted in the checklist.
- ASM-7's MAY names an imported ready-made instance; whether a received common-library instance may be called through no port is unsaid.
