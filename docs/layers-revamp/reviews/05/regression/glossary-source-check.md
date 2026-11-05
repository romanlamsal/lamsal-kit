Base 1892b7e, head 8ab0943.

Changed: rules P1 Statement, P7 Statement, P8 Statement (Why, Provenance of P2–P17 as listed in the affected set); terms Service, Port (driving), Tentative operation, Saga, Choreography, Orchestration, Upstream system, Downstream system, Anti-corruption layer, Shared kernel, Repository, Transaction, Store, Factory; System wording only; P5's leaked Glossary notes gone from the distilled set. the-world.md unchanged.

## Checklist

- R05-1: resolved — P2 Why now has the owner ask and the asked system answer about its own records, "no owner" of the asked record; the fixture's wording (catalog's beforeChange decides, shop's hook only answers `openOrdersCarrying`) leaves catalog the one Owner (P3); Impl's placement with `count > 0 → throw` in shop's hook still breaches P3 and P2.
- R05-2: resolved — P7 Statement admits several aggregates "where a business rule ties them"; series and invoice saved together comply where billing's domain states the gapless rule (Why's ticket-number case); P10 s3 accepts the contention.
- R05-3: resolved — P7 admits each sku's `Stock` saved with the `Reservation` where fulfillment's domain states the tie (Why's three-flights case), each save version-compared (P10 s1); the plain-read snippet still breaches P10 s1.
- R05-4: resolved — P7 admits `Order` inserted and `Cart` emptied in one transaction where shop's domain states the tie (Why's basket case).
- R05-5: resolved — P8 s1 now names the complying code as its exception: payment commits `Payment` (with `expiresAt`), then calls Stripe after the commit, idempotent by the committed record (`intent:${paymentId}`), a later step (expiry) ending the change; P7 s2 points to "the call after the commit that P8 allows". The natural code is now refused by P8 s1 directly. Shop's call into payment breaks instead (Newly broken 1).
- R05-6: out of scope — P4 Statement untouched (Why: "repository adapter" wording).
- R05-7: out of scope — P2 Why's published-language item and P13's MAY untouched.
- R05-8: out of scope — P14 untouched.
- R05-9: out of scope — P8's "MUST make the change, deciding nothing again" clause untouched.
- R05-10: unchanged — P15 s2 still "MUST ask for by a message"; P15 Why now allows a call to an external system after the commit, so the disagreement stays for payment→Stripe; for shop→payment Statement and Why now agree in refusing it (Newly broken 1).
- R05-11: out of scope — P11 Statement untouched.
- R05-12: out of scope — P7's "the record of the message it is called for" clause and P9 untouched.
- R05-13: out of scope — P16 Statement untouched.
- R05-14: out of scope — P2 Statement untouched.
- R05-15: resolved — Tentative operation is now a commitment asked by message whose asker holds the right to cancel; Fresh A's `HoldStock` is one fulfillment took, so P17 s2 ("a tentative operation it took") reaches fulfillment and reading A is the text's; Fresh B's hold on an event still rests on "holds something".
- R05-16: out of scope — P9 untouched.
- R05-17: out of scope — P6 Statement untouched; Transaction's added reads do not touch the fake's commit.
- R05-18: out of scope — P1's "load on every runtime" clause untouched.
- R05-19: out of scope — P11 untouched; P2's "hook of the owner" sentence concerns writes.
- R05-20: out of scope — no layer or term for the route touched.
- R05-21: unchanged — P10 s2 untouched; Store now "keeps records", a replica row still kept in shop's store, so the split stands.
- R05-22: out of scope — P13 s1 untouched; Upstream per call keeps fulfillment upstream of Payload's stock field.
- R05-23: out of scope — P5 untouched.
- R05-24: out of scope — Driving adapter untouched.
- R05-25: out of scope — P18 untouched.
- R05-26: out of scope — P3 Statement untouched; Shared kernel "part of the domain model" decides nothing on a value's schema.
- R05-27: out of scope — Assumptions wording only; P13 s3 untouched.
- R05-28: out of scope — P12 Statement untouched (names adapters, not the Anti-corruption layer).
- R05-29: out of scope — P15 Why's deadline paragraph untouched.
- R05-30: resolved — the head's distilled set carries no P5 Glossary notes.
- R05-31: unchanged — "pending" became "provisional" (P8), still no glossary term; "process manager" left the glossary but stays in P17 Provenance; "tie" (P7, P10) has none.
- R05-32: out of scope — Upstream's commands ("takes the commands the other sends") mean what they meant; P13 s2 untouched.
- R05-33: unchanged — C2 and C9 still differ freely; C8 is now settled by P8 s1 (call after the commit only, and only to an external system), which puts both "inside shop's open transaction" placements in breach (Newly broken 1, 2).
- R05-34: out of scope — fixture gaps.

## Examples in the affected set

- p2-breach-sku-veto-asks-shop: breach — P3 Statement and P2 Statement: shop's hook still decides catalog's sku (`count > 0 → throw`); the P10 charge falls (catalog's rule, external configuration, Assumptions).
- p7-breach-gapless-invoice-number: holds — P7 Statement now admits the tied series and invoice; loosened rule, intended (commit message, P7 Why ticket numbers).
- p7-breach-multi-sku-reservation: breach — P10 s1 for the shown snippet (plain read, `reservations.insert`); its P7 half (a `Stock` per sku saved together) now holds by P7's tie, intended.
- p7-breach-cart-cleared-with-order: holds — P7 Statement admits `Order` and `Cart` saved together where shop's domain states the tie; loosened rule, intended (P7 Why basket).
- p17-breach-intent-before-payment-record: breach — P8 s1 now refuses `openIntent` before payment's commit; P17 s2's first bullet no longer reaches it (a call is no Tentative operation).
- p7-ok-shop-write-scope: holds — every rule; repository adapters bound to the scope.
- p16-ok-common-transaction-runner-by-shape: holds — every rule.
- p3-ok-shared-kernel-values-only: holds — the kernel, now a module of each sharing domain, reaches only pure code of no system (P1); its importers in a published language breach P13 s3 (Newly broken 3).
- p12-ok-payment-stripe-acl: holds — P12 names adapters; the Anti-corruption layer's redefinition changes no Statement.
- p6-ok-fakes-for-external-systems: holds — every rule.
- p5-ok-fulfillment-worker-assembly: holds — every rule; Factory binds nobody.
- Impl "The checkout saga": breach — step 2 (shop calls payment's `startPayment` inside its transaction) now breaches P8 s1, P7 s2 and P15 s2; steps 1, 3–7 hold.

Two breach examples flip (gapless, cart), both the intended loosening of P7.

## Previous builds

### P8 Statement (call after the commit, only to an external system; tentative-op-by-call gone; provisional record)

- Impl, `p15-ok-checkout-returns-client-secret` and "The checkout saga" step 2: shop's checkout calls payment's acting open host service inside `tx.run`. Was the tentative-op exception; now refused by P8 s1 (payment is no External system), and the after-commit variant is refused too. Newly broken 1.
- Impl, `p17-breach-intent-before-payment-record` complying code (`makeStartPayment`): complies, now P8's named exception (committed `Payment`, key `intent:${paymentId}`, expiry ends the change). Natural code: breach, now by P8 s1.
- Fresh A, "Synchronous calls between systems", "The main flows", "How each property holds" P8 ("the single call beside a transaction is `CardPayments.open`, a request for a tentative operation"): shop→payment inside shop's open transaction now breaches P8 s1, P7 s2, P15 s2. Newly broken 1. Payment's `open`→Stripe complies only if made after payment's commit, idempotent by the committed `CardPayment` (unique `order_ref`, key `open:<orderRef>`); the build does not say which.
- Fresh B, "Calls and messages" (`shop.placeOrder` → Stripe "inside the open shop transaction ... (tentative operation)") and "How each property holds" P8: now breaches P8 s1. Complies once moved after the commit, keyed by the committed order id; the `paymentRef` then cannot be saved in the same use case (P7 "commits once after the last write"). Newly broken 2.
- Impl `p8-ok-payload-outbox-product-changed`, Fresh A/B Payload outboxes: "pending" → "provisional" changes nothing; still comply.

### P7 Statement (tied aggregates; call after the commit)

- As `p7-ties-p2-owner.md`, re-judged: Impl natural codes for gapless, multi-sku (`Stock` per sku) and cart now comply where the domain states the tie; complying codes, Fresh A D5, D6/D7, D13, Fresh B D4, D14 still comply (P7 permits, does not require).
- Fresh B "How each property holds" P7: the fake `in-memory-store` throwing on two aggregates in one `Tx` is now stricter than P7; no Fresh B use case saves tied aggregates, so P6 parity holds.

### P15 Why (call to an external system after the commit)

- Impl, Fresh A: shop→payment now refused by Statement and Why alike (Newly broken 1). Payment→Stripe after the commit: Why allows, s2 still reads "by a message" (R05-10).

### Tentative operation (aggregate to aggregate, by message, asker holds cancel)

- P7 Why ("the first asks it for a tentative operation ... P8 and P15 deliver how it is asked"): P8 now delivers only the message; no build relied on another reading except the shop→payment call above.
- P17 Scope/Statement ("a tentative operation it took or asked for"): Stripe intents asked by call leave the first bullet; Impl `p17-ok-payment-expiry-outlives-stripe-retries`, Fresh A `CardPayment.lapsesAt`, Fresh B `Order.paymentDueBy` still comply by the second bullet (a business rule limits the wait). Fresh A `HoldStock`/`ReleaseStock` is now a tentative operation; `Fulfillment.holdExpiresAt` complies. Impl `p17-ok-saga-5-deadline-in-order` ("undoing payment's tentative operation"): no tentative operation exists there now; still complies by shop's deadline.
- Intra-system tentative operations (Impl T3 option B, Fresh B `ReserveStockLine`): glossary now names them; P17 Scope (work spanning systems) does not reach them; P7 Why's "within the system they are saved together" permits, not requires; still comply.
- the-world P8 Why ("What is asked of another system, or of this one, before the commit stays tentative"): binds nobody; now speaks against the glossary (by message) and P8 s1 (after the commit). No build changes by it.

### Service ("implementation of a driving port")

- No build changes status. Helpers in the service layer (Impl `service/translate.ts`, Fresh B `service/steps/`) implement no driving port; P5 s1 still binds them through the service's Reach.

### Anti-corruption layer (a layer, not a system)

- No Statement names it (P12 names adapters). Impl "Shop is an anti-corruption layer towards payment", Fresh A/B tables: wording only; `p12-ok-payment-stripe-acl` holds.

### Shared kernel (part of each sharing domain)

- P1 new Statement: Impl, Fresh A ("How each property holds" P1), Fresh B (P1) domains reach own domain, kernel, `zod`; still comply.
- P13 s3 ("modules that declare a published language MUST reach nothing of their system outside it"): the kernel now belongs to each sharing system's domain. Impl `p8-ok-saga-1-order-placed-in-outbox` (`OrderPlacedV1` imports `@teeladen/kernel/money`, `/sku`), Impl payment `published/index.ts` (`Money`), Fresh A "How each property holds" P12 (`src/published/**` may import `@teashop/kernel`): now breach. Fresh B D34 (each published language declares `MoneyV1`, imports only `zod`): complies. P13 Why ("a published message may carry its `Money`") says otherwise. Newly broken 3.
- P13 s1 ("import of a system only its offer"): billing importing the kernel imports a module of shop's domain and of its own; reading unsettled, no build changes status.

### Repository, Transaction, Store

- Repository: Why/Provenance only; binds nobody. Impl repository ports returning non-aggregates (`lockLevels`, `openCountForSku`, `customersWithOverdue`) do not match "loads, saves and finds them whole"; no rule reaches it.
- Transaction ("reads and writes"): P10 s1's read inside the transaction now in the definition; P16's read clause unchanged; all three builds read through the scope or `Tx`; no change.
- Store ("keeps records"): Impl S10 (one Postgres, one store) reads the same; P9, P10, P16 unchanged for the builds.

### Upstream / Downstream (per call or message), Saga, Choreography, Orchestration, Factory

- No build changes status. Mutual upstreams (shop↔billing) now explicit; P12, P13 hold as before. Fresh A's shop orchestrates by commands except the one call (Newly broken 1); "process manager" left the glossary, P17 Scope unaffected. Factory binds nobody.

## Newly broken

### 1. p15-breach-checkout-calls-payment-for-client-secret.md
```yaml
breaches: [P8, P7, P15]
satisfies: [P4, P10, P16]
situation: checkout must return a Stripe client_secret in the same request; payment creates it when shop's checkout calls it
finding: regression
```
```ts
// packages/shop/src/service/checkout.ts
export const makeCheckout = (d: { tx: ShopTransactions; payments: PaymentGateway; ids: IdGenerator; clock: Clock }): Checkout =>
  async (input) => {
    const order = await d.tx.run(async (s) => {
      const placed = placeOrderFrom(await s.carts.get(input.cartId), d.ids.next(), d.clock.now());
      await s.orders.insert(placed);
      await s.outbox.add(orderPlaced(d.ids.next(), placed));
      return placed;
    });
    const started = await d.payments.start({ orderId: order.id, amount: orderTotal(order) }); // payment's acting open host service
    return { kind: "placed", orderId: order.id, clientSecret: started.clientSecret };
  };
```
P8 s1: a change shop decides that its transaction does not commit leaves only by message, or by a call after the commit to an External system; payment is a system of this codebase. Impl's built placement (the call inside `tx.run`) and Fresh A's (`PaymentIntents.open` inside the open transaction) breach the same sentence and the Why's "made before the commit". P7 s2 ("or by the call after the commit that P8 allows") and P15 s2 ("MUST ask for by a message"; Why now names only external systems) refuse it too. A message cannot return the secret in the request; a driving adapter making both calls breaches P4. With payment a system as the fixture has it, no placement complies: cannot-comply. Only folding payment into shop (Fresh B D3) or a second request from the browser complies.

### 2. p8-breach-card-intent-inside-open-transaction.md
```yaml
breaches: [P8]
satisfies: [P9, P15, P16]
situation: shop (payment folded in) opens a Stripe PaymentIntent at checkout and returns its client_secret
finding: regression
```
```ts
// packages/systems/shop/src/service/place-order.ts (Fresh B)
await uow.run(async (tx) => {
  const placed = placeCardOrder(cart, now, ids.orderId());
  const pay = await gateway.openCardPayment({ orderId: placed.id, amount: total(placed), idempotencyKey: `${placed.id}:${cart.version}` }); // before the commit
  await orders.save(tx, withPaymentRef(placed, pay.paymentRef));
  await outbox.write(tx, [orderPlaced(placed)]);
});
```
P8 s1 allows the call to Stripe only after the commit, idempotent by a committed record; made inside the open transaction it stands when the transaction rolls back. Compliant placement exists: commit the order, then call with a key from its committed id.

### 3. p13-breach-published-language-carries-kernel-money.md
```yaml
breaches: [P13]
satisfies: [P12, P14]
situation: shop publishes OrderPlaced carrying the shared kernel's Money
finding: regression
```
```ts
// packages/shop/src/published/order-placed.ts
import { z } from "zod";
import { Money } from "@teeladen/kernel/money";   // part of shop's domain model (glossary: Shared kernel)
export const OrderPlacedV1 = z.object({ orderId: z.string().uuid(), total: Money });
```
P13 s3: the modules that declare a published language MUST reach nothing of their system outside it; the kernel now belongs to each sharing system's domain (glossary: Shared kernel, System). Impl (shop, payment) and Fresh A breach; Fresh B (D34) complies. P13 Why still allows it, so the change opened a Statement/Why disagreement.

## Noticed

- R05-10 persists for payment→Stripe: P15 s2 "by a message" against the Why's call after the commit.
- Fresh A does not say whether payment's `open` calls Stripe before or after its commit.
- Impl's payment domain states no rule that needs Stripe's answer now (P15 s1); only shop's `needsPaymentNow` does (Fresh A S13).
