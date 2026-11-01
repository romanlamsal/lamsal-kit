Base 042da0f, head 28801e5.

Judged on `distill.mjs` run at head (HEAD = 28801e5). Changed: TX-47 new; SVC-2, SVC-8, TX-7
Statements lose the first close's clauses; TX-1 Relies-on only; glossary untouched.
"Pre-existing" marks a breach the change did not cause.

## Checklist

- R03-1: out of scope — resolved at 042da0f; Reach and the reach lists untouched.
- R03-2: out of scope — TX-28, TX-44 untouched.
- R03-3: out of scope — Tentative operation, TX-36 untouched.
- R03-4: out of scope — TX-37, TX-41 untouched.
- R03-5: out of scope — SYS-16 untouched.
- R03-6: out of scope — SVC-2's Relies-on lines untouched; only its Statement and Why changed.
- R03-7: out of scope — TX-37's line on TX-31 untouched.
- R03-8: out of scope — SYS-1, Offer untouched.
- R03-9: out of scope — DOM-1, Pure untouched.
- R03-10: out of scope — SVC-7 untouched; TX-47's Scope is a service, not a driving adapter.
- R03-11: out of scope — ASM-2 untouched; TX-47's line on it binds nobody.
- R03-12: out of scope — SYS-9 untouched.
- R03-13: out of scope — TX-1's Statement untouched (Relies-on only); TX-47 rules opening and committing, not where loads run.
- R03-14: out of scope — SVC-4 untouched.
- R03-15: out of scope — TX-28 untouched.
- R03-16: out of scope — TX-37 untouched.
- R03-17: out of scope — TX-22, TX-36, TX-3 untouched.
- R03-18: out of scope — ASM-3, TX-15, TX-1, DOM-1, DOM-4 Scopes untouched.
- R03-19: out of scope — SYS-2 untouched.
- R03-20: out of scope — TX-5 untouched; SVC-2's change does not reach `svc-2-ok`'s repeat throwing.
- R03-21: out of scope — TX-19 untouched.
- R03-22: out of scope — TX-23 untouched.
- R03-23: out of scope — DOM-7 untouched; SVC-8's change clears `tx-12-ok`'s port, not its ownership check.
- R03-24: resolved — the contest is settled by rule: TX-47 has a service open, commit or roll back only through a driven port of its system, so the common library's `Transactions` in `svc-6-ok`, `svc-1-ok`, `sys-10-ok` breaches TX-47 (and SVC-7), which the Decision now intends; the files' labels are issue 19's.
- R03-25: out of scope — SVC-6 untouched; SVC-8's conformist sentence is Why.
- R03-26: out of scope — TX-24, TX-30, TX-32 untouched.
- R03-27: out of scope — fixture facts.
- R03-28: out of scope — System untouched.
- R03-29: out of scope — ASM-2, System builder untouched.
- R03-30: out of scope — Outside, Pure untouched.
- R03-31: out of scope — catalog's rules untouched.
- R03-32: out of scope — nothing on `PaymentFailed`.
- R03-33: out of scope — Assumptions untouched.
- R03-34: out of scope — Store untouched.
- R03-35: out of scope — TX-27 untouched; SVC-2's dropped clause never reached a live answer.
- R03-36: out of scope — Assumptions untouched.
- R03-37: out of scope — DRV-7 untouched.
- R03-38: out of scope — "decides" in SVC-2's Scope untouched; the dropped clause was on the state saved.
- R03-39: out of scope — fixture reading.
- R03-40: out of scope — Tentative operation untouched.
- R03-41: out of scope — ASM-3 untouched.
- R03-42: out of scope — Idempotent untouched.
- R03-43: out of scope — Pure untouched.
- R03-44: out of scope — ASM-4 untouched.
- R03-45: out of scope — Assumptions untouched.
- R03-46: out of scope — Double, TST-6 untouched.
- R03-47: out of scope — TX-37, TX-28 untouched.
- R03-48: out of scope — TX-38 untouched.
- R03-49: out of scope — Store untouched.
- R03-50: out of scope — External system untouched.
- R03-51: out of scope — Offer untouched.
- R03-52: out of scope — DOM-1, SYS-14 untouched.
- R03-53: out of scope — Pure untouched.
- R03-54: out of scope — P9 untouched.
- R03-55: out of scope — P15 untouched.
- R03-56: out of scope — P8 untouched.
- R03-57: out of scope — TX-38, TX-45 untouched.
- R03-58: resolved — the rule no longer leans on the Except: TX-47 routes the transaction through a driven port of its system, P5's main clause, so the Except need not carry the common library's `Transactions` and its "output changes neither" reading stands.
- R03-59: out of scope — `choices.md` untouched.

## Previous regression's N1 to N4

- N1: resolved — TX-47 makes the breach intended: a service opens a transaction through a driven port of its system (`asm-9-ok`'s `TransactionPort` in shop's service layer); the common library's `Transactions` breaches TX-47 and SVC-7, and no rule claims ASM-7 admits it.
- N2: resolved — SVC-8 now asks only "the system's terms"; a conformist uses billing's published language untranslated in any layer (glossary: Conformist), so `asm-2-ok-shop-reads-invoice-through-driven-port` and `tx-12-ok-invoice-number-through-billing-port` hold SVC-8.
- N3: resolved — TX-7 asks "readable by old code, each field keeping its meaning"; the gift message is read and no field changes meaning. The fix lets `paidByInvoice` through as well (Newly broken, TX-7).
- N4: resolved — SVC-2 asks "in the call that acts" only; raw `planShipment` and dist checkout's replica fallback decide in the acting call, and TX-27 governs the replica. The fix lets reload-and-save-again through (Newly broken, SVC-2).

## Examples in the affected set

No breach file flips. `svc-2-breach-loaded-order-passed-through-port` met SVC-2 at 8937ad5 and 042da0f by its own text and still does.

- asm-9-ok-transaction-handed-as-argument.md: breach — TX-1, cart loaded outside the transaction (R03-13), SVC-4 `carts.clear` (R03-14), both pre-existing; TX-47 holds: `TransactionPort` is shop's driven port, `begin`/`commit`/`rollback` through it.
- drv-1-breach-invoice-batch-in-one-transaction.md: breach — DRV-1, TX-1; TX-47's Scope fails, the handler is no service.
- drv-8-breach-adapter-reads-repository-to-check-owner.md: breach — DRV-8 (driven port reached), SVC-2 (the adapter decides; the acting service is not shown enforcing).
- svc-2-breach-loaded-order-passed-through-port.md: holds — SVC-2 met: the acting service decides itself in the acting call; not a flip.
- svc-2-breach-server-action-checks-before-cancel.md: breach — SVC-2: the adapter decides, `cancelOrder` enforces nothing; TX-1, its load outside the transaction.
- svc-2-ok-cancel-order-decides-itself.md: breach — TX-1 load outside the transaction (R03-13), TX-5 repeat throws (R03-20), pre-existing; SVC-2 holds.
- svc-3-breach-place-order-calls-clear-cart.md: breach — SVC-3, TX-1.
- svc-3-ok-place-order-writes-cart-itself.md: breach — TX-1 load outside (R03-13), DRV-8 handler calls `MailSender`, pre-existing.
- svc-4-ok-mark-paid-through-repository.md: breach — TX-1 load outside (R03-13), TX-35 late `PaymentSucceeded` throws `NotPayable`, pre-existing.
- svc-6-ok-place-order-dependencies.md: holds — where `transactions` is declared is not shown; TX-47 binds if it is the common library's, as the prose's "the common library's transaction" may mean.
- svc-7-ok-order-overview-through-query-port.md: holds — SVC-7, SVC-8; TX-1's Scope fails (R03-18).
- tx-1-breach-cart-cleared-after-order-committed.md: breach — TX-1.
- tx-1-breach-order-saved-without-transaction.md: breach — TX-1; TX-23 too, an upsert.
- tx-1-breach-repository-reads-ambient-unit-of-work.md: breach — TX-1, ASM-9; TX-47 too, unlisted: the service opens the common library's `unitOfWork`.
- tx-1-ok-one-invoice-transaction-per-message.md: holds — TX-1, TX-5, DRV-7; TX-47: `transaction`'s declaration not shown.
- tx-1-ok-place-order-service-holds-transaction.md: breach — SVC-4 `carts.clear` (R03-14), pre-existing; TX-47 holds, `TransactionPort` from shop's ports.
- tx-1-ok-refund-and-payment-in-one-transaction.md: breach — TX-5 (R03-20), pre-existing.
- tx-22-breach-claim-rolled-back-after-3pl-call.md: breach — TX-22, TX-5, TX-41.
- tx-22-ok-payment-requests-checkout-session.md: breach — TX-30, no rule of payment's ends the wait (R03-26), pre-existing.
- tx-3-ok-checkout-requests-checkout-session.md: holds — TX-3, TX-36, TX-1, TX-43.
- tx-34-breach-refund-refusal-thrown.md: breach — TX-34.
- tx-34-ok-refund-refusal-published.md: holds — TX-34, TX-5, TX-1.
- tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md: holds — TX-5, TX-19, TX-23.
- tx-7-breach-amount-unit-changed-in-place.md: breach — TX-7: `amount` does not keep its meaning.
- tx-7-breach-customer-id-renamed-quantity-narrowed.md: breach — TX-7: new rows unreadable by old code and old by new.
- tx-7-ok-gift-message-added-optional.md: breach — SYS-2, the published schema in the domain reaching domain schemas (R03-19), pre-existing; TX-7 holds again (N3).

## Previous builds

- **TX-47** (new). raw `### shop` "Service layer: ports" (`export interface TransactionPort` in
  `packages/shop/src/service/ports/index.ts`), `### payment` ("TransactionPort … as in shop") and
  `### common library` (`createDrizzleTransactions`, "Implements each system's TransactionPort"):
  every service opens through its system's port; complies. dist `### Systems` (`builder.ts`:
  `import type { Database, TransactionPort } from "@teeladen/common/postgres"`) and `### common
  library` (`packages/common/postgres/transaction.ts` declares `TransactionPort`): every service's
  `transaction.run` (shop `checkout.ts`, `cancel-order.ts`; payment `settle-payment.ts`; billing
  `issue-invoice.ts`; fulfillment `apply-order-signal.ts`; backoffice `apply-replica-event.ts`) now
  breaches TX-47, beside SVC-7 since 042da0f; intended.
- **SVC-2** (clause dropped). raw `### fulfillment` `apply-shop-order.ts`
  (`planShipment(… registeredAmong …)`) and `release-awaiting-shipments.ts` (`readyToBook`): decided
  in the acting call; comply again. dist `### shop` `checkout.ts` (`mayPayByInvoice` on the
  `d.dunning.stageOf` fallback): decided in checkout itself; complies again.
- **SVC-8** (clause dropped). Neither build declares a conformist port (raw `### Systems`: "all
  anti-corruption layers"; dist `### shop`: "Shop does not conform to payment"): nothing flips. dist
  `### common library` `Tx = PgTransaction<…>` in every repository port's `tx`: Drizzle's terms are
  not shop's; still breaches. raw opaque `Transaction`: still complies.
- **TX-7** (clause dropped). Neither build changes a message, record or port schema: Scope fails;
  nothing flips.
- **TX-1** (Relies-on only): nothing.

## Newly broken

### TX-7 against `paidByInvoice` (from N3's fix)

~~~md
---
breaches: [TX-7]
satisfies: []
situation: shop's OrderPlaced gains an optional paidByInvoice; billing's worker deploys later
finding: regression
---

# `paidByInvoice` old billing strips, waiting for an `OrderPaid` that never comes

```ts
// shop/published/messages.ts — new code
export const orderPlacedSchema = z.object({ /* fields as before */ paidByInvoice: z.boolean().optional() })
// shop, new code: an invoice order publishes OrderPaid only after InvoicePaid
// billing, old code: invoices on OrderPaid only; z.object strips paidByInvoice
```

Old rows parse in new code, new rows in old code, and no existing field changes meaning: the
Statement is met. Old billing never invoices the order, so `InvoicePaid` and `OrderPaid` never come.
At 042da0f "as new code meant it" refused it. The Scope's "a new message takes over from another"
widens the Scope, not the Statement, and old code reads the message as written.
~~~

### SVC-2 against reload-and-save-again (from N4's fix)

~~~md
---
breaches: [SVC-2]
satisfies: [TX-1, TX-23, TX-24]
situation: shop's cancelOrder hits a version conflict after a PaymentSucceeded marked the order paid
finding: regression
---

# Cancel reloads after the conflict and saves the cancel it decided on the old state

```ts
// shop/service/cancel-order.ts
export const createCancelOrder = ({ transactions, orders, outbox }: Deps): CancelOrder =>
  ({ orderId, requestedBy, now }) => transactions.run(async (tx) => {
    let order = await orders.byId(orderId, tx)
    if (!canBeCancelledBy(order, requestedBy, now)) throw new CancelRefused(orderId)   // decided on v1
    try { await orders.save(cancel(order, now), tx) }
    catch (e) {
      if (!(e instanceof VersionConflict)) throw e
      order = await orders.byId(orderId, tx)                                         // v2: paid meanwhile
      await orders.save(cancel(order, now), tx)                                      // not asked again
    }
    await outbox.write(orderCancelled(order), tx)
  })
```

SVC-2: the service decides itself, in the call that acts. TX-23: the second save matches what the use
case loaded before it. TX-24: what it decided by belongs to the Order it saves. A paid order is
cancelled. At 042da0f "on the state that call saves" refused it; the Decision hands it to TX-23 and
TX-24, which refuse it only if "what the use case loaded" means the first load.
~~~

## Noticed

- `svc-1-ok-place-order-port-beside-service`, `sys-10-ok-port-types-exported-as-types` type the service's `transactions` as the common library's `Transactions`: TX-47; issue 19's list names only `svc-6-ok-opaque-transaction`.
- `asm-9-ok-transaction-handed-as-argument`, TX-47's one ok example, breaches TX-1 (R03-13) and SVC-4 (R03-14).
