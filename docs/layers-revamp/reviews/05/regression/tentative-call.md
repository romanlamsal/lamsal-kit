Base 8ab0943, head 89f239e.

Changed: P8 Statement (call after the commit to another system, not only an external one), P13 Statement s3 (published language may reach a shared kernel), P15 Statement s2 (or by the call after the commit that P8 allows); Why/Provenance of P7, P8, P15, P17; the-world P8 Why; term Tentative operation (asked of another aggregate or another system, by a message or a call).

## Previous regression

- NB-1: resolved — P8 s1 now admits the call to payment after shop's commit, idempotent by the committed `Order` (payment keyed by `orderReference`), shop's deadline ending the change; P7 s2 and P15 s2 point to it; the built placements inside `tx.run` / the open transaction still breach P8 s1, but no longer cannot-comply.
- NB-2: unchanged — P8 s1 still refuses Fresh B's Stripe call inside the open shop transaction ("Made before the commit"); P15 s2 now names "the call after the commit" and refuses it too; compliant placement as before.
- NB-3: resolved — P13 s3 "reach nothing of their system outside it but a shared kernel" admits `OrderPlacedV1` and payment's `published/index.ts` importing the kernel's `Money`; P13 Why ("may carry its `Money`") agrees again. Opens a gap for downstreams that share no kernel (Newly broken 1).

## Checklist

- R05-1: out of scope — P2, P3 Statements and Owner untouched (was resolved).
- R05-2: out of scope — P7 Statement's tie untouched; P7 Why's "must not reach its final state" binds nobody (was resolved).
- R05-3: out of scope — P7 Statement and P10 s1 untouched (was resolved).
- R05-4: out of scope — P7 Statement untouched (was resolved).
- R05-5: resolved — P8 s1 still names payment's complying code (committed `Payment`, `intent:${paymentId}`, expiry ends it); Tentative operation now "by a message or a call", so P17 s2's first bullet reaches the Stripe intent again and the natural code breaches P17 s2 as well as P8 s1 (was resolved).
- R05-6: out of scope — P4 untouched.
- R05-7: out of scope — P13's MAY and P2 Why untouched; s3 change is the kernel clause only.
- R05-8: out of scope — P14 untouched.
- R05-9: out of scope — P8's "MUST make the change, deciding nothing again" clause untouched.
- R05-10: resolved — P15 s2 now "by a message, or by the call after the commit that P8 allows": the call to have another system act (payment→Stripe, shop→payment) is in the Statement, after the commit only; P15 Why's "may call an external system after its transaction commits" is narrower but only permissive.
- R05-11: out of scope — P11 untouched.
- R05-12: out of scope — P7's "record of the message" clause and P9 untouched.
- R05-13: out of scope — P16 untouched.
- R05-14: out of scope — P2 Statement untouched.
- R05-15: resolved — Tentative operation still "one aggregate asks", asker holds cancel: Fresh A `HoldStock` remains one fulfillment took (P17 s2 bullet 1); Fresh B's hold on an event still rests on "holds something"; P15 Why's `ReserveStock` "tentative operation" binds nobody (was resolved).
- R05-16: out of scope — P9 untouched.
- R05-17: out of scope — P6 untouched.
- R05-18: out of scope — P1 untouched.
- R05-19: out of scope — P11 untouched.
- R05-20: out of scope — no layer or term for the route touched.
- R05-21: out of scope — P10 s2 and Store untouched (last: unchanged).
- R05-22: out of scope — P13 s1 untouched.
- R05-23: out of scope — P5 untouched.
- R05-24: out of scope — Driving adapter untouched.
- R05-25: out of scope — P18 untouched.
- R05-26: out of scope — P3 Statement untouched; P13 s3's kernel clause decides nothing on a value's schema.
- R05-27: out of scope — P13 s3's "nor be generated from the rest of it" untouched; an external system shares no kernel.
- R05-28: out of scope — P12 untouched.
- R05-29: out of scope — P15 Why's deadline paragraph untouched.
- R05-30: out of scope — no P5 Glossary notes in the head's distilled set (was resolved).
- R05-31: unchanged — "provisional" (P8) still no glossary term; P7 Why adds "intent" ("commits its intent"), none either.
- R05-32: out of scope — P13 s2 and Upstream's commands untouched; P15 Why calling `ReserveStock` a tentative operation binds nobody.
- R05-33: unchanged — C8 still settled by P8 s1 (call after the commit), now to payment too: Impl's and Fresh A's "inside shop's open transaction" still breach, an after-commit placement now complies; C2, C9 still differ freely.
- R05-34: out of scope — fixture gaps.

## Examples in the affected set

- p8-ok-payload-outbox-product-changed: holds — P8 s3, s4 untouched; s1's widening reaches no call here.
- p8-ok-confirmation-mail-after-commit: holds — P8 s1 message in the transaction; executor decides nothing.
- p8-ok-durable-bus-acks-after-commit: holds — P8 s2 untouched.
- p8-ok-saga-1-order-placed-in-outbox: holds — P8 s1; P13 s3 now admits `@teeladen/kernel/money`, `/sku` in `OrderPlacedV1` (was a breach by NB-3).
- p8-ok-revalidate-after-listing-commits: holds — P8 s1, every rule.
- p13-ok-saga-3-payment-events-in-published-language: holds — P13 s3 admits payment's published `Money`; shop shares the kernel.
- p13-ok-command-declared-by-receiver: holds — P13 s2; `RefundPaymentV1`'s `Money` admitted by s3.
- p15-ok-listing-replica-refreshed-on-notice: holds — P15 s1 does not reach a use case called for a message; s2 unaffected.
- p15-ok-checkout-returns-client-secret: breach — P8 s1: `payments.start` is made inside `tx.run`, before the commit; also P7 s2 and P15 s2 (not "the call after the commit"). Unchanged verdict, now with a compliant placement (P8 Why's own checkout case).
- p17-breach-intent-before-payment-record: breach — P8 s1 (`openIntent` before payment's commit) and P17 s2 bullet 1 again: the Stripe intent asked by a call is a Tentative operation, and on rollback no aggregate holds its moment.
- p17-ok-payment-expiry-outlives-stripe-retries: holds — P17 s2 now by bullet 1 as well as bullet 2; `expiresAt` in `Payment`.
- p17-ok-refund-refused-for-dispute: holds — every rule; refund asked by message.
- p17-ok-reservation-hold-ends-without-shop: holds — P17 s2 "holds something"; Impl reserves on an event, no tentative operation asked.
- p17-ok-saga-5-deadline-in-order: holds — P17; "payment's tentative operation" exists again (shop asks payment by a call), shop's `paymentDueBy` holds the asker's moment.
- p17-ok-saga-6-invoice-order-is-no-wait: holds — P17 s3 no wait.
- p17-ok-saga-7-late-payment-refunded: holds — P17 s1, s4.

No breach example flips.

## Previous builds

### P8 s1 (call after the commit to another system)

- Impl `p15-ok-checkout-returns-client-secret`, "The checkout saga" step 2: call inside `tx.run` still breaches P8 s1, P7 s2, P15 s2. Complies once moved: `tx.run` inserts the `Order` (with `paymentDueBy`) and its messages, then `payments.start({ orderId })`; payment's `byOrderReference` makes a repeat return the same `Payment`, `expireOrder` ends the change. Cost: `withPaymentRef` cannot be saved in the same use case (P7 "commits once after the last write"); `expireIfUnpaid`'s `cancelPayment: o.paymentRef` is empty for unpaid orders, so payment's own `expiresAt` ends the intent. NB-1 resolved.
- Fresh A "Synchronous calls between systems", "The main flows", P8 ("the single call beside a transaction is `CardPayments.open`"), S3: inside shop's open transaction still breaches P8 s1, P7 s2, P15 s2; after the commit, keyed `open:<orderRef>` with payment's unique `order_ref`, complies. The `alreadyPaid` → `cardPaymentRefused` rollback then can no longer undo the order.
- Fresh B "Calls and messages" (`shop.placeOrder` → Stripe inside the open transaction), P8: unchanged breach of P8 s1, now P15 s2 too (NB-2).
- Impl `makeStartPayment` (payment→Stripe after its commit): complies, unchanged.
- Nothing else slips through. No build makes another acting call between systems of this codebase (Fresh A: "No other system of this codebase calls another synchronously"; Fresh B: none; Impl: only shop→payment). A call after the commit where a message would serve still breaches P15 s1 for a use case not called for a message (no business rule needs the answer now); for one called for a message, P8 s1's exception needs "its caller needs another system's answer before the use case returns", which no handler does, so P8 s1 and P15 s2 still require the message. Impl `p16-ok-billing-call-carries-no-transaction` is an answering call: P8 s1 does not reach it, P15 s1 unchanged.

### P15 s2 ("or by the call after the commit that P8 allows")

- Impl D6, Fresh A S3, S13: the Statement/Why gap closes (R05-10). The inside-transaction calls of all three builds are now refused by s2's text as well, since the call it admits is only the one after the commit.

### Tentative operation (aggregate or system, by message or call)

- Stripe intents asked by call are tentative operations again: P17 s2 bullet 1 reaches payment (Impl `Payment.expiresAt`, Fresh A `CardPayment.lapsesAt`) and Fresh B's shop (`Order.paymentDueBy`); all comply. Impl natural `openIntent` before commit: breach of P17 s2 again (R05-5).
- Shop→payment by call is a tentative operation shop asks for: shop's `paymentDueBy` (Impl, Fresh A `paymentDueAt`) holds its moment; payment, which took it, holds its own; comply.
- `ReserveStock` (P15 Why): Impl and Fresh B reserve on `OrderPlaced`, an event, no commitment asked; still comply by "holds something". Fresh A `HoldStock`: still one fulfillment took; `holdExpiresAt` complies.
- Airline hold: P8 Why only; no build.
- Within one system "by a call": no Statement admits a call between aggregates; P7 still requires one transaction per use case and its Why refuses a service calling another. Impl T3 option B, Fresh B `ReserveStockLine` (by message) unchanged.

### P13 s3 (shared kernel admitted)

- Impl `OrderPlacedV1` (`@teeladen/kernel/money`, `/sku`), Impl payment `published/index.ts` (`Money`), Fresh A P12 (`src/published/**` may import `@teashop/kernel`): now comply (NB-3). Fresh B D34 (`MoneyV1` per published language): complies.
- P1: the kernel stays closed for its sharers' domains (Fresh A, Fresh B kernels import only `zod`; a kernel reaching one sharer's domain is another system's domain for the rest). No build changes status.
- P13 s1: a downstream importing an offer typed by a published language that carries the kernel imports "what is typed by ... a shared kernel": admitted. Where the downstream shares no kernel, nothing refuses it: Fresh A fulfillment (not among the kernel's sharers: shop, payment, billing, catalog) parses `catalog.ProductRevised.v1` with its `price`. Newly broken 1.

### P7, P17 Why; the-world P8 Why

- Bind nobody; no build changes status.

## Newly broken

### 1. p13-breach-kernel-reaches-non-sharing-downstream.md
```yaml
breaches: []        # every Statement admits it; the P13 property fails
satisfies: [P1, P12, P13, P14]
situation: catalog's published event carries the shared kernel's Money; fulfillment, which shares no kernel, handles it
finding: regression
```
```ts
// packages/catalog/src/published/product-revised.ts (Fresh A)
import { z } from "zod";
import { MoneySchema } from "@teashop/kernel";      // shared by catalog, shop, payment, billing; not fulfillment
export const ProductRevisedV1 = z.object({ productId: z.string(), version: z.number().int(), sku: z.string(), title: z.string(), price: MoneySchema });
```
```ts
// packages/fulfillment/src/adapters/driving/handlers/on-product-revised.ts
import { ProductRevisedV1 } from "@teashop/catalog/published";
export const onProductRevised = (p: FulfillmentInbound) => async (e: Envelope) => {
  const m = ProductRevisedV1.parse(e.body);         // parses the kernel's Money
  await p.syncArticle({ messageId: e.id, body: { sku: m.sku, title: m.title, version: m.version } });
};
```
P13 s3 now admits the kernel in catalog's published module; P13 s1 admits fulfillment's import (offer, typed by a published language and a shared kernel); P12 admits it in a handler. The kernel is part of each sharer's domain model (glossary: Shared kernel), agreed by its sharers only: a change to `Money` agreed by catalog, shop, payment and billing changes `ProductRevisedV1` and breaks fulfillment's parse, a downstream changing with its upstream's model. P13 Why's "that coupling is chosen together" holds only for sharers. At 8ab0943 P13 s3 refused the import.

## Noticed

- P15 Why still says "A use case may call an external system after its transaction commits" and its checkout case asks Stripe; P8 Why's checkout asks payment.
- the-world P8 Why "Nothing is asked of another system before the commit" against P16 Why's allowed call to another system's open host service while the transaction is open (answering).
- Tentative operation names "another aggregate ... by a call"; no Statement says what such a call within one system is.
- Impl's payment domain states no rule needing Stripe's answer now (P15 s1); only shop's `needsPaymentNow` (Fresh A S13).
