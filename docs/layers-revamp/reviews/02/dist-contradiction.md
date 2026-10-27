# Contradiction review, distilled set

## Summary

No pair found. Every candidate below either has a narrower Scope that governs, is lifted by a MAY,
or has code that meets both Statements; the snippets under `## Candidates rejected` give that code.
Two places where one rule alone may have no satisfying code (TX-19 with scarce or numbered
allocation) are under `## Notes`. They are not pairs.

## Findings

None.

## Candidates rejected

### 1. ASM-2 × DRV-3: narrower Scope

Situation: "Payload's config needs the hooks, the hooks need services, the services need the
Payload instance: a cycle."

- ASM-2 *Scope:* "a factory needs a port's implementation, a store client, any other client of
  something outside the process, or a configuration value." *Statement:* "It MUST receive it from
  its caller."
- DRV-3 *Scope:* "a driving adapter assembly cannot construct, or cannot hand what it calls when it
  constructs it: the framework finds and calls it, or what it calls is built from what it is built
  into." *Statement:* "It MUST read what it calls from a courier."

Both Scopes hold for a hook written as a factory. DRV-3's is narrower (driving adapters that
assembly cannot hand anything, out of all factories), and "Where two Scopes hold, the narrower
governs." Code meets both anyway: the factory receives the courier from its caller and reads the
services when it runs.

```ts
// shop/payload/hooks/product-changed.ts
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>   // ASM-2: received from its caller
  async ({ doc }) => {
    await courier.read().requestPageRevalidation({ productId: doc.id, slug: doc.slug, version: doc.updatedAt }) // DRV-3, DRV-6
    return doc
  }
```

### 2. SYS-14 × ASM-7 and DOM-1 × ASM-7: a MAY

Situation: the shared kernel's `Money` logs its rounding (the sys-14 breach example).

SYS-14's Statement, "The import MUST be one of: another module of the same published language or
shared kernel, a shared kernel, a library that computes from its arguments.", forbids importing
the logger. ASM-7 says of "a logger, a tracer": "It MAY be imported as a ready-made instance." The
preamble reads a MAY as "a permission where another rule would forbid". So no code is forced into a
breach: the MAY lifts the import, or the module simply leaves the logger out
(`sys-14-ok-money-returns-remainder.md`). Not a contradiction. Whether the MAY really reaches this
far is under Notes.

### 3. SVC-7 × ASM-7: a MAY

Situation: the common library's "OpenTelemetry tracer exporting to Jaeger", used in a service.

SVC-7 *Scope:* "a service or a driving adapter reaches the outside: a store, a mail provider, the
clock, another system." *Statement:* "It MUST do so through a port of its system." A ready-made
tracer reaches Jaeger without a port. ASM-7's MAY covers it ("whose output changes nothing the
system does or returns: a logger, a tracer").

### 4. DRV-1 × TX-3 (and TX-22): code meets both

Situation: "Checkout must return a Stripe `client_secret` in the same request; payment creates it."

- DRV-1 *Scope:* "a driving adapter handles one call from its caller: a request, a message, a tick."
  *Statement:* "It MUST make at most one acting call."
- TX-3 *Scope:* "a use case of this system changes data another system of this codebase owns."
  *Statement:* "It MUST do so by writing a message to this system's outbox."

Shop can't call payment synchronously to create the Payment, and its adapter can't make a second
acting call. DRV-1 only limits *acting* calls, though, so an answering call can follow the acting one:

```ts
// shop/next/checkout-action.ts — driving adapter; the framework calls it, so it reads the courier (DRV-3)
"use server"
export async function checkoutAction(input: CheckoutInput) {
  const { placeOrder, paymentClientSecret } = courier.read()
  const { orderId } = await placeOrder(input)              // the one acting call: Order and OrderPlaced commit together (TX-3, TX-6)
  return paymentClientSecret({ orderId, waitUpToMs: 5000 }) // answering: payment's open host service (TX-12), polled until payment has it
}

// payment/service/start-payment.ts — called for shop's OrderPlaced
(event) => transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const payment = newPayment(event)
  await payments.save(payment, tx)
  await outbox.write(createPaymentIntent({ paymentId: payment.id, amount: payment.amount }), tx) // private; TX-22
})
// its handler calls the gateway with idempotencyKey: paymentId (TX-31) and records the client_secret
```

The cost is latency and a dependency on payment while the request waits. That is a property (P15),
not a rule.

### 5. TX-1 × DRV-1: code meets both

Situation: "Scheduled dunning runs over unpaid invoices"; likewise payment's overdue settlement in
`tx-30-ok-payment-asks-stripe-at-deadline.md`.

A tick may make one acting call (DRV-1), and a use case that writes runs "in one transaction"
(TX-1). Several unrelated aggregates per tick fit both: the one use case writes one private message
per invoice in one transaction, and each message's handler acts on one aggregate (also TX-15).

```ts
// billing/service/start-dunning-run.ts — the tick's one acting call
() => transaction.run(async (tx) => {
  for (const id of await invoices.unpaidIds(clock.now(), tx)) await outbox.write(sendReminder({ invoiceId: id }), tx)
})
```

### 6. TX-5 × TX-22: code meets both

Situation: shop "Sends an order-confirmation mail once the order commits", through a mail provider
that may take no idempotency key (TX-31 covers only providers that take one).

TX-22 sends the mail through the outbox, so the sending use case is "called for a delivered
message" and "MUST be idempotent" (TX-5). If the claim commits first, the use case is idempotent by
the glossary ("repeating it leads to the same result as performing it once"):

```ts
// shop/service/send-order-confirmation.ts — called for shop's private SendOrderConfirmation
(message) => {
  return transaction.run((tx) => handled.claim(message.id, tx))   // commits before the send
    .then((claimed) => (claimed ? mailer.send(confirmationFor(message)) : undefined))
}
```

Both rules hold. A crash between the claim and the send loses the mail, which P8 forbids and no rule
does. Gap, not contradiction.

### 7. DOM-3 × SYS-2 (with DOM-1, SYS-14): code meets both

Situation: billing publishes `DunningStageChanged`, whose `stage` takes the values the
`CustomerDunning` record's stage takes.

- DOM-3 *Scope:* "a business rule about the shape of a record: which fields it has, what each holds,
  which values a status takes." *Statement:* "It MUST be stated once, as a schema in the domain."
- SYS-2 *Statement:* "The modules that declare it MUST NOT import the domain." DOM-1's list leaves
  out the system's own published language, so the domain can't import it back.

The published enum describes a message, not a record. It is a contract that billing's service
translates into, so the business rule is stated once:

```ts
// billing/domain/customer-dunning.ts — the business rule, once
export const dunningStageSchema = z.enum(["none", "reminder", "second-reminder", "collection"])

// billing/published/messages.ts — the contract; imports zod only (SYS-2, SYS-14)
export const publishedStageSchema = z.enum(["none", "reminder", "second-reminder", "collection"])

// billing/service/clear-dunning.ts — SVC-6 admits both
const toPublished = (s: DunningStage): PublishedStage => s   // the type checker fails here if either side changes alone
```

The hinge is under Notes.

### 8. DOM-3 × DOM-1/DVN-4: code meets both

Situation: shop's `orders` table in "shared Postgres via Drizzle"; the table states the Order's
fields and status again.

DVN-4 admits "its system's domain" in a driven adapter. So the table takes the status from the
domain schema and leaves the domain alone (DOM-1):

```ts
// shop/drizzle/schema.ts — driven adapter
import { orderStatusSchema } from "@teeladen/shop/domain/order"   // internal import within shop
export const orderStatus = pgEnum("order_status", orderStatusSchema.options)
export const orders = pgTable("orders", { id: text("id").primaryKey(), status: orderStatus("status").notNull(), body: jsonb("body").$type<Order>() })
```

### 9. SVC-1 × SYS-10: code meets both

Situation: shop's open host service driving port types, exported for billing and the checkout form.

SVC-1: "It MUST be declared in the service layer." SYS-10: "Loading it MUST load no module of the
system outside its published language." A type-only re-export loads nothing:

```ts
// shop/published/index.ts — export path
export * from "./messages"                                        // published language
export type { PlaceOrder, CountOpenOrdersWithSku } from "../service/ports/driving"   // erased at load
```

### 10. SYS-1 × SYS-9 × DRV-3: code meets both

Situation: the Payload config cycle. The config module must hold shop's hooks.

SYS-1 lets shop export "a system builder", and a builder "may return one thing or many". So the
config takes hooks from shop's builder, and the hooks read the courier when they run (DRV-6):

```ts
// shop/index.ts — export path
export const buildShopPayloadHooks = (courier: Courier<ShopServices>) => ({ productChanged: productChanged(courier), openOrdersWithSku: openOrdersWithSku(courier) })
```

### 11. TX-29 × TX-28 / catalog's veto: Scope not held, and code meets both

Situation: "catalog's `beforeChange` asks shop how many open orders carry a sku, and refuses to
change a sku one does."

TX-29 *Scope:* "an external system this codebase configures tells this system of its change, and its
transaction can write a message to an outbox." The veto doesn't tell shop of a change. It asks shop
before deciding whether to make one, and a message after the commit could not veto. The other side
of the tension is catalog's business rule, which isn't a rule of the document. TX-28 is met by
`tx-28-ok-before-change-hook-vetoes-sku-change.md`. TX-28 and TX-29 are met together by
`tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`.

### 12. SVC-2 × TX-28: Scope not held

Situation: the sku veto. SVC-2 *Scope:* "a use case decides by what this system has stored". Shop's
use case answers ("its use case writes nothing") and decides nothing. Catalog acts, and catalog is
an external system that "sits outside the rules". The tx-28-ok veto example meets both.

### 13. SVC-2 × TX-19: code meets both

Situation: "Reserves stock on `OrderPlaced`", with two orders for the last unit.

- SVC-2 *Scope:* "a use case decides by what this system has stored: whether this caller is allowed,
  whether the stock suffices, whether the order is still open." *Statement:* "The service that acts
  MUST enforce the decision itself, in the call that acts."
- TX-19 *Statement:* "It MUST reach the same result whatever order the messages arrive in."

SVC-2 says where a decision is enforced, not that one must refuse. A reservation that never refuses
and lets stock go negative is order-independent, and SVC-2 is met in the one call:

```ts
// fulfillment/domain/stock.ts
export const reserve = (stock: Stock, orderId: string, qty: number): Stock =>
  stock.reservations[orderId] ? stock : { ...stock, available: stock.available - qty, reservations: { ...stock.reservations, [orderId]: qty } }
```

With the business rule "reserve only what suffices", no code may exist. See Notes.

### 14. TX-19 × TX-35: code meets both

Situation: payment publishes `PaymentFailed` for a failed attempt and later `PaymentSucceeded`;
shop receives them in either order.

TX-35's "A business rule of its system MUST decide what follows" holds both ways. Order-independence
comes from payment publishing a failure only once Stripe can no longer succeed (the PaymentIntent is
cancelled, by payment's deadline rule, TX-30). Each status also carries a rising version (TX-32), so
shop never sees a failure that a success can follow.

```ts
// payment/domain/payment.ts
export const onStripeEvent = (p: Payment, e: StripeOutcome): Payment =>
  e === "attempt_failed" ? p                                     // not terminal: the customer may retry
  : e === "succeeded" ? { ...p, status: "succeeded", version: p.version + 1 }
  : p.status === "succeeded" ? p : { ...p, status: "failed", version: p.version + 1 }   // "canceled": terminal at Stripe
```

### 15. TX-7 × TX-32: code meets both

Situation: adding `version` to `DunningStageChanged` (the tx-32 examples).

TX-7's Statement: "The change MUST keep what old code writes readable by new code, and what new code
writes readable by old code, each field keeping its meaning." The field is optional on read and
always written:

```ts
// billing/published/messages.ts
version: z.number().int().positive().optional(),   // old readers ignore it; new readers treat undefined as "older than any"
```

### 16. TX-17 × TX-34: code meets both

Situation: payment refuses shop's `RefundPayment` ("A payment whose charge the customer disputes at
Stripe is not refunded").

TX-34 must publish the refusal and TX-17 must not name shop. A correlation id names no system:

```ts
// payment/published/messages.ts
export const refundRefusedSchema = z.object({ id: z.string().uuid(), type: z.literal("RefundRefused"), commandId: z.string().uuid(), orderId: z.string(), reason: z.enum(["disputed", "already-refunded"]) })
```

### 17. TST-6 × TST-12 (with TST-5): SHOULD, and code meets both

Situation: payment's `PaymentGateway` has a fake and a Stripe adapter.

TST-6: "One contract suite MUST be written against the port and run against both." TST-12: "It
SHOULD NOT run automatically." "Run" doesn't say "automatically":

```ts
// packages/payment/test/stripe/payment-gateway.contract.test.ts
const gateway = process.env.GATEWAY === "stripe" ? stripePaymentGateway(new Stripe(testKey)) : fakePaymentGateway()   // TST-8: a flag
```

The default suite runs the fake, and someone runs `GATEWAY=stripe` by hand.

### 18. ASM-3 × "trace context should cross system boundaries": code meets both

Situation: "Request id and trace context should cross system boundaries; the transaction must not."

ASM-3 *Statement:* "The value MUST NOT change how the use case acts or what it answers." The outbox
adapter puts the ambient trace context into an envelope header. The use case never reads it, and
the payload in the system's terms doesn't change:

```ts
// shop/drizzle/outbox.ts — driven adapter a service calls
write: (m, tx) => tx.insert(outbox).values({ id: m.id, type: m.type, payload: m, headers: propagation.inject(context.active(), {}) })
```

The hinge is under Notes.

### 19. ASM-2 × ASM-10: disjoint Scopes

A "configuration value" (ASM-2) varies by process. ASM-10's Scope is "something the same in every
instance, process and test". No value falls under both.

### 20. DRV-8 × SVC-7: code meets both

A driving adapter that must reach the outside "MUST do so through a port of its system" (SVC-7).
DRV-8 admits only "a driving port of its system". The adapter delegates to a use case, and the use
case reaches outside through driven ports (as `svc-7-ok-payment-reaches-stripe-through-gateway-port.md`
does through its hook calling `settlePayment`).

## Notes

- **TX-19 alone, with scarce or numbered allocation.** Two situations seem to have no code under
  TX-19, but no second rule of the document forces them. The pressure is a business rule from the
  fixture, so neither is a pair. One is fulfillment reserving the last unit of stock, "only what
  suffices", for two `OrderPlaced` messages. The other is billing's "gapless invoice numbers"
  assigned on `OrderPaid`. Under F5 ("after one sent later"), an earlier message can arrive after
  the later one has already been acted on irreversibly (a shipment booked, an invoice number
  issued). Then no code reaches "the same result whatever order the messages arrive in". The
  decision hangs on what "the same result" means: the final state, the business outcome (every
  order invoiced, numbers gapless), or which order got which unit or number. The document doesn't
  define "result".
- **Does ASM-7's MAY lift import lists?** "MAY: a permission where another rule would forbid" and
  "It MAY be imported as a ready-made instance" together seem to admit the logger into the domain
  (DOM-1) and the shared kernel (SYS-14). That reading makes
  `sys-14-breach-money-imports-common-logger.md` no breach. If the MAY only lifts ASM-2's "MUST
  receive it from its caller", the example stands. The text doesn't say which.
- **DOM-3 and a published enum.** Candidate 7 depends on whether a published message's field counts
  as "a business rule about the shape of a record". The glossary's Record is "What a store holds and
  a write changes: a row", and an outbox row is one. If the message's shape is a business rule
  about a record, DOM-3 wants it in the domain and SYS-2 forbids the published language to import
  it. That would be a contradiction, with the shared kernel as the only way out, a place
  `Money`/`Sku` don't suggest for one system's status.
- **ASM-3 and metadata.** Candidate 18 depends on whether writing an ambient value into an outbox
  row is part of "how the use case acts".
- **Examples that breach a rule they don't list** (defects, not contradictions):
  - `tx-30-ok-payment-asks-stripe-at-deadline.md` runs one `transaction.run` per payment in one use
    case, against TX-1's "Its service MUST run it in one transaction".
  - `sys-12-ok-shop-price-read-only-in-payload-admin.md` exports a driving adapter at
    `@teeladen/shop/payload#ChangePriceButton`, which SYS-1's list doesn't hold, unless Payload's
    import map, as external code "outside the rules", may reach past export paths.
  - `svc-7-ok-payment-reaches-stripe-through-gateway-port.md`'s hook types its parameter with
    `Stripe`. DRV-8's list has no "external system's package", which DVN-4's has.
