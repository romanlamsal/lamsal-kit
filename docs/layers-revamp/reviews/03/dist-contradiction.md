# Contradiction review, distilled set

## Summary

- Read: `distilled.md` (73 rules), `domain.md`, the 29 example files `distilled.md` names (30 references; `tx-28-ok-after-change-hook-records-revalidation-request.md` is listed under TX-28 and TX-29). All paths exist.
- **Unconditional contradictions found: none.** In every fixture situation tested I found code that meets both Statements, or a narrower Scope, or a MAY.
- **Closest calls (they need a particular reading, and even then an escape exists):**
  - c1, TX-37 vs SVC-2 (and TX-34). Read so that shop's `RefundPayment` asks for money back at Stripe, TX-37 stops payment from applying its dispute rule in the use case that refunds. TX-34 can then never apply. One escape is left: the dispute check moves to an answering use case that asks Stripe live.
  - c2, SVC-1 vs SYS-10, if "loading" means type-level loading.
  - c19, ASM-2 vs ASM-10, if a value that is the same everywhere counts as a "configuration value". This is MUST vs SHOULD.
  - c8, TX-28 vs TX-22, if an outbox message is not "recording a tentative operation". TX-29's path escapes it.
- **Single rules with no satisfying code under a strict reading** (Notes): TX-19 for a scarce resource (the last tin of stock, gapless invoice numbers); TX-5 for a mail provider with no idempotency key; TST-5 for Stripe, the 3PL and the bank (the only real thing "set up the way production sets it up" is live). TX-38 + TX-21 + DRV-7 force endless redelivery when an outside system refuses for good: no rule pair conflicts, but P17 cannot be reached.
- **MAYs with an unnamed target:** TX-36, taken to lift TX-22 and TX-3. ASM-7, taken to lift ASM-2 and SVC-7, not TX-22.
- **Example defects seen while checking** (one rule met, another breached, not contradictions):
  - `tx-30-ok…` breaches TX-1: one transaction per payment, and a load outside any transaction.
  - `tx-28-ok-after-change…` breaches TX-37/TX-38: `givesUpWaiting` returns without revalidating.
  - `tx-29-ok…` breaches TX-22: shop's `ProductChanged` handler revalidates directly.
  - `sys-12-ok…` breaches SYS-1: a driving adapter exported on `@teeladen/shop/payload`.
  - `svc-7-ok-payment…`: its hook acknowledges event types it does not handle (DRV-7, strict reading), and its port carries Stripe's `clientSecret`.
  - `tx-35-ok…`: SVC-6 holds only if shop conforms to payment, which the fixture does not say.

## Findings

None. No fixture situation was found where both Scopes hold, neither is narrower, no MAY lifts one, and every attempt at code meets one Statement and breaches the other. The strongest candidates are c1, c2, c19 and c8 below. Each lists the reading that makes it bite and the code that escapes.

## Candidates rejected

### Cross systems

**c1. TX-37 vs SVC-2 (and TX-34): payment refunds when shop asks, but not a disputed charge.**
Both Scopes can hold for payment's use case called for shop's `RefundPayment`:
- SVC-2 holds where the dispute is stored in payment.
- TX-37 holds where "the change the message asks for" is the money going back at Stripe, which payment's transaction does not commit (reading B).

Under reading B:
- The use case that applies `decideRefund` breaches TX-37: it decides again by a business rule and by the state of its records. `tx-34-ok-refund-refusal-published.md` is that code.
- A use case that refunds without deciding, with the dispute decided in an answering use case on stored data, breaches SVC-2: the service that acts does not enforce.
- TX-34's Scope ("refuses it: a business rule of its system says no") then becomes reachable only by breaching TX-37.

Escape 1, reading A: the command asks for a change of payment-owned data, which is how TX-3 frames every cross-system command ("changes data another system of this codebase owns"). That change is a `Refund` record, which the transaction commits. TX-37's Scope then fails for this use case, and binds only the private `StripeRefundRequested` handler. That is `tx-34-ok` plus:
```ts
// payment/service/execute-stripe-refund.ts — called for payment's private StripeRefundRequested; decides nothing
export const createExecuteStripeRefund = ({ gateway, refunds, transaction }: Deps): ExecuteStripeRefund =>
  async ({ refundId, externalRef, amount }) => {
    const ref = await gateway.refund({ externalRef, amount }, { idempotencyKey: refundId })   // TX-31
    await transaction.run((tx) => refunds.recordExecution(refundId, ref, tx))
  }
```
Escape 2, under reading B: payment does not store the dispute. The check runs in an answering use case that asks Stripe live, so SVC-2's Scope ("decides by what this system has stored") fails, and the refund use case decides nothing:
```ts
// payment/service/is-refundable.ts — answering, on payment's open host service
export const createIsRefundable = ({ payments, gateway }: Deps): IsRefundable =>
  async ({ orderId }) => {
    const p = await payments.byOrderId(orderId)
    return { refundable: !isDisputed(await gateway.disputeStatus(p.externalRef)) }   // domain rule on Stripe's answer
  }
// shop/service/apply-payment-succeeded.ts (excerpt, inside transaction.run) — asks, then sends
if (outcome.refund && (await paymentAccount.isRefundable({ orderId: order.id })).refundable)
  await outbox.write(refundPayment(outcome.refund), tx)
```
The cost: TX-34 is dead under reading B, and a dispute opened between the answer and the refund is refunded (P10). See N8.

**c2. SVC-1 vs SYS-10: a conformist downstream imports an open host service's driving port type (shop to billing, in-process).**
SVC-1 declares the port in the service layer. SYS-10 says the path exporting it loads no module outside the published language. A service-layer module is outside the published language: it is in a layer, and the offer is outside the layers. So under a type-level reading of "loading", the two clash.
- Escape 1, runtime reading: the type-only re-export is erased, so loading the path loads nothing.
  ```ts
  // billing/service/ports/dunning-status.ts — driving port, service layer (SVC-1); imports only billing's published language
  import type { DunningStatusQuery, DunningStatus } from "../../published/dunning"
  export type GetDunningStatus = (q: DunningStatusQuery) => Promise<DunningStatus>
  // billing/open-host.ts — export path
  export type { GetDunningStatus } from "./service/ports/dunning-status"   // erased: loads no module at runtime
  export * from "./published/dunning"
  ```
- Escape 2, under either reading: billing exports no port types. Shop declares its own driven port from billing's published types, so SYS-10's Scope holds only for the published-language path.

See N11.

**c3. SYS-13 / TX-3 vs SVC-6: shop sends payment's `RefundPayment` without conforming to payment.**
SVC-6 lets a service reach another system's published language only if its system conforms to that upstream. SYS-13 needs the command to be the receiver's.
Escape: the service writes in shop's terms through shop's outbox port, and a driven adapter translates. DVN-4 lists "the outside", which I read as including other systems' published language (N16).
```ts
// shop/service/ports/outbox.ts
export type ShopMessage = OrderPlaced | OrderPaid | { type: "RefundRequested"; orderId: string; amount: Money }
// shop/drizzle/outbox.ts — driven adapter
import { refundPayment } from "@teeladen/payment/published"
const toWire = (m: ShopMessage) => (m.type === "RefundRequested" ? refundPayment({ orderId: m.orderId, amount: m.amount }) : m)
export const drizzleOutbox = (db: Database): ShopOutbox => ({ write: (m, tx) => tx.insert(outbox).values(row(toWire(m))) })
```

**c4. TX-7 vs TX-33: `ReserveStock` moves from shop's published language to fulfillment's (`sys-13-breach` to `sys-13-ok`) during a rolling deploy.**
TX-7 says new fulfillment code must read the `ReserveStock` that old shop code still writes, and TX-33 says fulfillment may handle only its own command. Subscribing to shop's declaration breaches TX-33.
Escape: fulfillment declares `ReserveStock` with the same type literal and a compatible shape, so old shop messages parse as fulfillment's command:
```ts
// fulfillment/published/commands.ts
export const reserveStockSchema = z.object({
  id: z.string().uuid(), type: z.literal("ReserveStock"), orderId: z.string(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
  reserveUntil: z.string().datetime().optional(),   // kept, same meaning, while old writers live (TX-7)
})
```

**c5. DOM-3 vs SYS-2: a shape rule such as "quantity is a positive integer" appears in shop's `OrderPlaced` and in the `Order` schema.**
SYS-2 bars the published language from importing the domain schema, and DOM-3 wants the rule stated once, in the domain.
- Escape 1: the published-language schema states the wire shape only (`quantity: z.number()`), so the rule is stated once, in the domain.
- Escape 2: the rule moves to the shared kernel, which DOM-1 and SYS-14 both admit.

**c6. TX-12 / TX-24 / TX-27 / SVC-2: pay-by-invoice, "not to a customer billing has put into dunning".**
- By replica: TX-27 holds if shop's rule accepts lag (`tx-32-ok`).
- Otherwise, by billing's open host service: TX-12 holds. TX-24 and SVC-2 say nothing, because billing's answer is not "what this system has stored".

Neither route clashes. P10 is left open across systems (N22).

**c7. TX-12 vs the admin dashboard joining orders, invoices and shipments in one Postgres.**
Code: the dashboard calls the three open host services and joins in memory, or keeps replicas from events (TX-26). No SQL across owners.

### Hooks

**c8. TX-28 vs TX-22: an `afterChange` hook before Payload commits; shop wants the page revalidated.**
TX-28 lets the hook's use case only "record a tentative operation". TX-22 makes a use case that decides the revalidation write a message. If a private outbox message is not a tentative operation (the glossary: "a request to another system for a commitment"), the hook route has no use case that both decides and complies.
- Escape 1: TX-29's route, with no shop hook in the save: `tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`, shop's part fixed as in c11.
- Escape 2, hook kept: the hook's use case decides nothing. It records the pending catalog version as a tentative-operation record. A scheduled task's use case later decides (TX-22), and a TX-37 handler revalidates.

See N9.

**c9. TX-28 / TX-30 vs TX-37 / TX-38: the revalidation handler waits for catalog's commit, and a rolled-back save never arrives.**
`tx-28-ok-after-change…` returns without revalidating after ten minutes. That decides by a business rule whether to make the change (TX-37), and succeeds without completing (TX-38).
Code meeting all four: shop's rule ends the wait by making the change anyway, which is harmless because the page rebuilds from what is committed.
```ts
export const createRevalidateProductPage = ({ catalogVersions, pages, clock }: Deps): RevalidateProductPage =>
  async ({ productId, slug, version, writtenAt }) => {
    const committed = await catalogVersions.of(productId)
    if ((committed !== null && committed >= version) || givesUpWaiting(writtenAt, clock.now()))
      return pages.revalidate(`/products/${slug}`)          // TX-30: shop's rule decides; TX-37: the change is made
    throw new NotCommittedYet(productId)                    // TX-38: no business rule stops it yet
  }
```

**c10. TX-28 / SVC-2 / DOM-7 vs catalog's `beforeChange` sku veto.**
The veto is catalog's rule, in the external system's config, which sits outside the rules: only SYS-12 and TX-29 reach that config. Shop's use case only answers (`tx-28-ok-before-change…`).
If the rule were shop's, SVC-2 would need a shop service that acts. Code: shop's hook use case records a tentative hold on the sku, which TX-28 permits. Checkout refuses lines whose sku is held. Catalog's `ProductChanged` (TX-29) or a deadline (TX-30) releases the hold.

**c11. TX-22 vs TX-29: shop's handler of catalog's `ProductChanged` revalidates directly (`tx-29-ok…` comment).**
Revalidation is a change outside shop's transaction that the handler decides. Code: the handler writes private `RevalidateProductPage` (TX-22), and a TX-37 handler revalidates. Fulfillment's part of the same example already does this.

**c12. TX-25 vs the wish to commit shop's write inside Payload's transaction.**
No rule asks for it, and TX-28 + TX-29 cover the case. Code: shop takes no `req`, and catalog's own outbox carries the change.

**c13. DRV-7 vs hooks that receive event types their system does not act on (Stripe, the 3PL).**
A literal DRV-7 forbids acknowledging without a successful use case. Code: subscribe the endpoint to handled types only, or route every type to a use case that records "ignored". See N18.

**c14. DRV-8 vs Stripe's webhook hook, which needs a signing secret and Stripe's SDK.**
DRV-8 lists neither configuration nor the outside. Code: the factory receives the secret (ASM-2), and the hook verifies with pure HMAC or `Stripe.webhooks` (the upstream's published language, which DRV-8 admits). Reading a passed value is not reach (N17).

**c15. SYS-12 vs an owner writing its record kept in Payload (stock, or the price in the variant).**
If the Local API is one of Payload's "own ways in", SYS-12 leaves the owner no way to write. Code: the owner's adapter writes through the Local API while access refuses the admin and REST (`sys-12-ok`), or writes the column directly over the shared Postgres. See N15.

### Assembly cycles

**c16. DRV-3 vs ASM-2: Payload config needs the hooks, the hooks need services, the services need the Payload instance.**
ASM-2 wants the hook factory to receive the services from its caller. DRV-3's Scope is narrower ("a driving adapter assembly … cannot hand what it calls when it constructs it") and governs. Code:
```ts
// apps/server/assembly.ts
const courier = createCourier<ShopServices>()                       // common library
const hooks = shop.buildHooks({ courier })                          // system builder; factories receive the courier (ASM-2)
const payload = await getPayload({ config: buildConfig({ collections: [products(hooks)] }) })
courier.fill(shop.buildServices({ payload, db }))                   // ASM-8: before any edit can fire a hook
```

**c17. ASM-8 / ASM-4 / DRV-6 vs Payload calling hooks during `getPayload`.**
The fixture has no `onInit` seed, and hooks fire only on edits, after assembly. The code in c16 meets all three.

**c18. SYS-1 / SYS-9 vs Payload/Next loading the config by path (`@payload-config`).**
Code: the config module calls the process's assembly. Hooks come from shop's system builder, which is part of the offer, so shop exports no driving adapter on a path. `sys-12-ok`'s `@teeladen/shop/payload#ChangePriceButton` does export one (N20).

**c19. ASM-2 vs ASM-10: a factory needs a value that is the same in every instance, process and test.**
Example: Payload's collection slug `"outbox"` in `payloadOutboxReader(payload, { collection: "outbox" })`. If the slug is a "configuration value", ASM-2's MUST and ASM-10's SHOULD both hold, and neither Scope is narrower.
- Escape 1: by reading, a value identical everywhere is no configuration value (N12).
- Escape 2: literally, an imported default overridden by the caller meets both.
  ```ts
  import { OUTBOX_COLLECTION } from "./catalog-slugs"
  export const payloadOutboxReader = (payload: Payload, { collection = OUTBOX_COLLECTION } = {}): OutboxReader => …
  ```
At worst this is a MUST vs a SHOULD, which a codebase may deviate from.

**c20. ASM-7 vs ASM-2 / SVC-7 / TX-22: services log and trace through the common library's ready-made pino and OpenTelemetry instances.**
ASM-7 is a MAY. It lifts ASM-2 ("instead of receiving one from its caller") and SVC-7 ("through no port of its system"). I did not take it to lift TX-22: a log line is a "decided change" only under a reading I reject (N10). If it were one, a service that does not log satisfies TX-22, and ASM-7 obliges nothing.

**c21. ASM-9 vs the fixture's ambient unit of work, and shop calling billing while holding it.**
The fixture situation simply breaches ASM-9. Code: pass `tx` explicitly to shop's store calls only (TX-1, TX-2), and call billing's driving port without it (TX-25).

### Transactions vs calls

**c22. TX-3 / TX-22 vs "checkout must return a Stripe `client_secret` in the same request".**
TX-36 is a MAY and lifts both (N1). Code: `tx-3-ok-checkout-requests-checkout-session.md` and `tx-22-ok-payment-requests-checkout-session.md`.

**c23. TX-1 vs TX-36: checkout also records the session reference on the order, or payment records a pending `Payment` (as `tx-30-ok` assumes).**
Two transactions around the call would breach TX-1. Code: make the order id first, call, then write in one transaction (the session is tentative and expires):
```ts
const orderId = ids.next()
const { clientSecret, sessionRef } = await sessions.request({ orderId, amount: cart.total, expiresAt })
await transaction.run(async (tx) => { /* load cart, place order with sessionRef, save, outbox */ })
```
Payment can run one transaction around save-pending then call Stripe.

**c24. TX-1 vs reconciliation over many payments (`tx-30-ok`: a transaction per payment, and `payments.overdue` outside any).**
Code: the scheduled use case writes one private `ReconcilePayment` per overdue payment in one transaction. Each handler asks Stripe and settles in one transaction. This meets TX-1, TX-15, TX-22, TX-30 and TX-37 (the handler reads Stripe, not its own records, to settle; settling is a change its transaction commits, so TX-37's Scope does not hold).

**c25. TX-15 vs TX-24: checkout decides by the `Cart` and clears it.**
TX-15 suggests leaving the cart write to a handler. TX-24 wants the cart saved so that TX-23 catches a concurrent edit. Code: save the cart in the transaction (`tx-3-ok`). Saving it to guard the decision is relying on it, so TX-15's Scope fails (N13).

**c26. TX-6 vs TX-36: a message about a change made outside the store.**
Code: write no such message, or write it about the use case's own record of the change, in the transaction that commits that record (N19).

**c27. SVC-3 vs DRV-1: a caller needs two acting things of one system.**
Code: one use case holds the sequence.

**c28. TX-23 / TX-38: gapless invoice numbers under concurrency.**
The losing save fails, the handler fails without committing, and the bus redelivers. No clash.

### Outbox vs synchronous answers

**c29. TX-34 vs a synchronous call that payment refuses.**
TX-34's Scope is a command, a message. A refused call throws to shop, and shop's deadline cancels the order. No clash.

**c30. TX-5 vs TX-37: deduplication by a claim reads the state of the handler's records.**
Code 1: dedupe by the external key and keep no claim (`tx-31-ok…`). Code 2: read "deciding whether to make it" as excluding "was it already made". See N4.

**c31. TX-19 / TX-5: fulfillment gets `OrderCancelled` before `OrderPlaced`.**
Code: `OrderCancelled` with no reservation records a tombstone, and `OrderPlaced` for a tombstoned order reserves nothing. Same result in either order.

**c32. TX-19: shop gets `PaymentFailed` / `PaymentSucceeded` reordered.**
Code: payment's messages carry the payment's version (TX-32). Shop cancels only at the deadline, or on a terminal failure, and a lower version is ignored. The deadline task is no message, so TX-19 says nothing about deadline against late payment, which TX-35 covers (`tx-35-ok`).

**c33. TX-32 / TX-19: dunning replica.** `tx-32-ok-dunning-stage-changed-carries-version.md`.

**c34. TX-38 vs TX-30 / TX-35: the 3PL or Stripe refuses for good the change a private message asks for.**
TX-37 forbids deciding against it, TX-38 forbids recording the stop, and TX-21 + DRV-7 redeliver forever. No rule demands an end, so no pair clashes. Code: fail forever, which meets every rule. P17 is lost (N7).

### Tests

**c35. TST-5 vs TST-6 vs TST-12: the contract suite against Stripe's adapter.**
TST-6 runs the suite against the real adapter. TST-5 makes that the real Stripe, and TST-12 says not automatically. Code: run it by flag (TST-8), by hand. No clash (but N5).

**c36. TST-11 vs SYS-15.** Billing exports one fake on `@teeladen/billing/fake`, and tests import it. No clash.

**c37. TST-4 / P6 vs ASM-7's ready-made tracer exporting to Jaeger.**
Code: `@opentelemetry/api` returns a no-op tracer when the SDK is not started (fixture: "returns a no-op span when it is empty"). A service test then reaches nothing and stays in the default suite.

**c38. TST-5 vs Payload set up by production config, which needs shop's hooks.**
Code: the test boots Payload through the process's assembly against a test database.

## Notes

**N1. TX-36's MAY, target unnamed.** I took it to lift TX-22 (payment's or shop's call to Stripe for a change no system of this codebase owns) and TX-3 (shop changing data payment owns, where payment records a pending `Payment`), because "apart from its outbox" points at the two rules that require the outbox. I did not take it to lift TX-1 or TX-6.

**N2. ASM-7's MAY, target unnamed.** I took it to lift ASM-2 ("instead of receiving one from its caller") and SVC-7 ("through no port of its system"). Its Scope covers services and adapters only, so it lifts nothing for the domain (DOM-1) or the shared kernel (SYS-14). I did not take it to lift TX-22.

**N3. TX-19 has no satisfying code under a strict reading.** "The same result whatever order the messages arrive in":
- Two `OrderPlaced` messages for the last tin: whichever arrives first gets the stock.
- Billing's gapless invoice numbers follow arrival order.

No code makes either independent of arrival order, short of reallocating already-shipped stock. TX-19 is satisfiable only read per subject: the messages about one order or aggregate.

**N4. TX-5 and a mail provider with no idempotency key** (the order-confirmation mail, billing's mail). If "records" in Idempotent include the provider's, no code is idempotent: send-then-crash sends twice, and claim-then-crash sends none. P9's "no record of this system" suggests this system's records only, and then TX-5 is satisfiable (c30).

**N5. TST-5 with Stripe, the 3PL and the bank API.** "The real thing … set up the way production sets it up" is the live account: real charges, real parcels, real transfers. No test meets this literally. Read "set up the way production sets it up" as same configuration, test-mode credentials.

**N6. TST-5 and Drizzle.** Production sets Postgres up through migrations generated from the adapter's own table definitions, yet TST-5 forbids "a real one the adapter's own definitions set up". I read the latter as an ad-hoc setup in the test (`push(schema)`), and the committed migration files as production's way.

**N7. TX-38: "what stops it is no business rule of its system".**
- Undefined when an outside refusal (the 3PL rejecting an address; Stripe refusing to cancel a PaymentIntent that already succeeded, or to refund a disputed charge) meets a business rule of this system that says what follows.
- Read as the cause, TX-38 forbids recording the outcome. With TX-21 and DRV-7 the message is then redelivered forever, and P17 is unreachable.
- Read as "no business rule decides the outcome", a rule that turns the refusal into an outcome lifts it.
- TX-35 does not help: it needs an event.

**N8. TX-37: "the change the message asks for".** Undefined for a command whose requested change is partly the receiver's record and partly outside (c1). Under the outside reading, TX-34 becomes unreachable.

**N9. TX-28: "recording a tentative operation".** The glossary defines a tentative operation as a request to another system. `tx-28-ok-after-change…` treats a private outbox message to shop itself as one. The rule does not say whether that counts (c8).

**N10. TX-22: "decides a change".** It is open whether log lines, spans, cache revalidation and mail count. I counted revalidation and mail, but not logs or spans.

**N11. SYS-10: "loading".** Runtime module evaluation or type-level resolution (c2).

**N12. ASM-2: "configuration value"** is undefined, and it overlaps ASM-10 (c19).

**N13. TX-15: "relies on"** is undefined, and it decides whether TX-15 meets TX-24 (c25).

**N14. SVC-2: "the call that acts".** It could be the deciding use case's call or the later call that makes the change. I read it as the deciding use case. The other reading turns every TX-22 → TX-37 flow into SVC-2 vs TX-37.

**N15. SYS-12: "own ways in".** It is open whether the Local API, used by the owner's adapter, counts (c15).

**N16. DVN-4 / TX-12 for other systems.**
- DVN-4 lists "the outside" but not other systems' published language. I read the outside as including it.
- TX-12's "open host service" for an external system: I read it as Payload's Local API.

**N17. Reach and values.** "Reaches what running it reads" would, literally, put configuration strings and argument values under DRV-8's and DVN-4's lists. I read reach as modules, systems and the outside.

**N18. DRV-7** for messages the receiving system does not act on: read literally, it forbids acknowledging them (c13).

**N19. TX-6** for a change made outside the store under TX-36: no transaction commits that change (c26).

**N20. Example defects** (each meets one rule and breaches another; not contradictions):
- `tx-30-ok-payment-asks-stripe-at-deadline.md` breaches TX-1: one transaction per payment, and `payments.overdue` outside any. Fix in c24.
- `tx-28-ok-after-change-hook-records-revalidation-request.md` breaches TX-37 and TX-38 through `givesUpWaiting` → `return`. Fix in c9.
- `tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`: shop's handler revalidates directly, which breaches TX-22. Fix in c11.
- `sys-12-ok-shop-price-read-only-in-payload-admin.md` exports a driving adapter on `@teeladen/shop/payload`, which breaches SYS-1 (variant, not the fixture).
- `svc-7-ok-payment-reaches-stripe-through-gateway-port.md`:
  - its hook returns 200 for event types it does not handle (DRV-7, strict reading);
  - `PaymentGateway.authorize` returns `clientSecret`, Stripe's term, in payment's port (P5, anti-corruption layer).
- `tx-35-ok-late-payment-refunded.md` imports payment's published language into shop's service, which SVC-6 admits only if shop conforms to payment. The fixture does not say it does.
- `tx-31-breach-3pl-booking-keyed-by-fresh-uuid.md` also breaches SVC-7: `randomUUID()` reaches the OS without a port. It is incidental to the breach the example is about.

**N21. Paths.** All 29 named example files exist. `tx-28-ok-after-change-hook-records-revalidation-request.md` is named twice: under TX-28 as ok, and under TX-29 as breach.

**N22. Cross-system decisions and P10.** Two fixture decisions rest on another system's answer and cannot hold at commit:
- pay-by-invoice by billing's answer;
- catalog's sku veto by shop's answer.

TX-25 and P16 forbid the shared transaction that would fix this, and no rule asks for anything else (TX-24 and SVC-2 cover only "what this system has stored"). That is a gap against P10, not a contradiction.
