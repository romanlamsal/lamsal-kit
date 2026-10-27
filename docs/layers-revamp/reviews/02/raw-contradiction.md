# Contradiction review, raw set

## Summary

No pair found. For every candidate, the two Scopes do not both hold, a MAY resolves it, or some
code meets both Statements. That code is given under Candidates rejected. Closest call:
ASM-2/DRV-3 on catalog's hook cycle. It turns on how "receive it from its caller" is read (Notes 1).

## Findings

None. No situation in `domain.md` was found where complying with one rule is the breach of
another and no code satisfies both.

## Candidates rejected

### 1. ASM-2 vs DRV-3: shop's hooks in catalog's config (the Payload cycle)

Situation: "Payload's config needs the hooks, the hooks need services, the services need the
Payload instance: a cycle."

- ASM-2 *Scope:* "a factory needs a port's implementation, a store client, any other client of
  something outside the process, or a configuration value." *Statement:* "It MUST receive it from
  its caller."
- DRV-3 *Scope:* "a driving adapter assembly cannot construct, or cannot hand what it calls when it
  constructs it: the framework finds and calls it, or what it calls is built from what it is built
  into." *Statement:* "It MUST read what it calls from a courier."

Both Scopes hold for the hook's factory: assembly builds it, and the services it calls do not exist
yet. Neither Scope is a subset of the other. A server function has no factory, so it is outside
ASM-2, and ASM-2 covers every factory. So neither rule governs as the narrower one. The code below
meets both, if receiving the courier from assembly counts as receiving the implementation from the
caller:

```ts
// shop/payload/hooks/product-changed.ts
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>   // received from assembly, its caller
  async ({ doc }) => {
    await courier.read().requestPageRevalidation({ productId: doc.id, slug: doc.slug, version: doc.updatedAt })
    return doc
  }

// apps/server/assembly.ts
const courier = createCourier<ShopServices>()
const payload = await getPayload({ config: buildCatalogConfig({ productChanged: productChanged(courier) }) })
courier.fill(buildShop({ payload, db }))                                          // the caller supplies what the courier yields
```

The factory needs a courier, and gets it from its caller. The services reach the hook only through
what the caller filled. The other reading makes this a contradiction (Notes 1).

### 2. ASM-2 vs ASM-7: pino logger and OpenTelemetry tracer in a service

Resolved by the MAY. ASM-7 *Scope:* "plumbing of the common library whose output changes nothing
the system does or returns: a logger, a tracer." *Statement:* "It MAY be imported as a ready-made
instance." It is a permission where ASM-2 ("It MUST receive it from its caller") would forbid.

### 3. SVC-7 vs ASM-7: the tracer exporting to Jaeger, called from a service

SVC-7 *Scope:* "a service or a driving adapter reaches the outside: a store, a mail provider, the
clock, another system." *Statement:* "It MUST do so through a port of its system." ASM-7 permits
the import only. It does not permit reaching the outside through no port. A permission is not an
obligation, so code that keeps telemetry behind a port meets both:

```ts
// shop/service/ports/telemetry.ts — driven port
export interface Telemetry { span<T>(name: string, run: () => Promise<T>): Promise<T> }

// shop/service/place-order.ts
export const createPlaceOrder = ({ telemetry, orders, outbox, transaction }: Deps): PlaceOrder =>
  (input) => telemetry.span("placeOrder", () => transaction.run(async (tx) => { /* … */ }))
```

Not a contradiction. ASM-7 does not reach what its Why claims (Notes 2).

### 4. TX-5 vs TX-22: the order-confirmation mail, mail provider without an idempotency key

- TX-5 *Scope:* "a use case is called for a delivered message." *Statement:* "It MUST be
  idempotent."
- TX-22 *Scope:* "a use case of this system changes something outside its store that no system of
  this codebase owns: a mail sent, a shipment booked with an external system." *Statement:* "The
  change MUST go through this system's outbox, on behalf of its owner."

At-least-once sending repeats the mail. Code that claims the id and commits before it sends meets
both Statements:

```ts
// shop/service/send-order-confirmation.ts — called by shop's handler of its private SendOrderConfirmation
export const createSendOrderConfirmation = ({ handled, mailer, transaction }: Deps): SendOrderConfirmation =>
  async (message) => {
    const first = await transaction.run((tx) => handled.claim(message.id, tx))   // commits the claim
    if (!first) return                                                         // a repeat changes nothing
    await mailer.send(confirmationMail(message))                               // at most once
  }
```

The change went through the outbox, and a repeat leads to the same result as once. The price is a
mail lost to a crash between the claim and the send. No rule's Statement forbids that loss (Notes 3).

### 5. TX-1 + DRV-1 vs TX-30: payment's overdue payments, billing's scheduled dunning run

- TX-1 *Scope:* "a use case writes." *Statement:* "Its service MUST run it in one transaction: open
  it, hand it to each call into its store, commit it."
- DRV-1 *Scope:* "a driving adapter handles one call from its caller: a request, a message, a
  tick." *Statement:* "It MUST make at most one acting call."
- TX-30 *Scope:* "this system holds a tentative operation, or waits on another system's answer."
  *Statement:* "A business rule of this system MUST decide what happens when the confirmation or
  answer does not come."

One tick allows one acting call, and that call allows one transaction. One transaction over every
overdue payment fails all of them when one changes. Fanning out meets all three:

```ts
// payment/service/start-overdue-settlement.ts — the scheduled task's one acting call, one transaction
export const createStartOverdueSettlement = ({ payments, outbox, transaction, clock }: Deps): StartOverdueSettlement =>
  () => transaction.run(async (tx) => {
    for (const p of await payments.overdue(clock.now(), tx))
      await outbox.write(settleOverduePayment({ paymentId: p.id }), tx)        // private, one per payment
  })

// payment/service/settle-overdue-payment.ts — one per message: asks Stripe, then one transaction
export const createSettleOverduePayment = ({ payments, gateway, outbox, transaction }: Deps): SettleOverduePayment =>
  async ({ paymentId }) => {
    const status = await gateway.status((await payments.byId(paymentId)).externalRef)
    await transaction.run(async (tx) => {
      const next = settleFromStatus(await payments.byId(paymentId, tx), status)
      await payments.save(next, tx)
      await outbox.write(messageFor(next), tx)
    })
  }
```

The same shape serves billing's dunning run. Example defect noted under Notes 4.

### 6. TX-3 / TX-22 vs "Checkout must return a Stripe `client_secret` in the same request"

Only one rule is involved. The other side is the fixture's requirement. Shop asks payment for a
payment, and payment asks Stripe for a PaymentIntent. Read as tentative operations, they fall
outside both Scopes: the glossary says a tentative operation "changes nothing it asks for: its
confirmation does". TX-30 then binds payment. Code: svc-7's
`examples/svc-7-ok-payment-reaches-stripe-through-gateway-port.md` calls Stripe synchronously
through `PaymentGateway`. The hinge is in Notes 5.

### 7. TX-24 vs TX-15: a decision by an aggregate the use case would otherwise not write

Situation: payment refuses a refund for a disputed charge. The decision reads `Payment`, and the
use case saves `Refund`.

- TX-24 *Statement:* "The data it decides by SHOULD belong to aggregates the use case saves."
- TX-15 *Scope:* "a use case writes more aggregates of this system than it relies on."
  *Statement:* "It SHOULD leave each write it does not rely on to a handler, through a message in
  its outbox."

When the save of `Payment` is what keeps the decision valid, the use case relies on that write.
So TX-15's Scope does not hold for it:

```ts
// payment/service/refund-payment.ts (inside transaction.run)
const payment = await payments.byOrderId(command.orderId, tx)
const decision = decideRefund(payment, command.amount)          // domain: disputed? already refunded?
await payments.save(decision.payment, tx)                       // relied on: fails if a dispute landed meanwhile (TX-23)
await refunds.save(decision.refund, tx)
```

### 8. DOM-3 vs SYS-2: billing's dunning stage values in the domain and in `DunningStageChanged`

DOM-3 *Scope:* "a business rule about the shape of a record: which fields it has, what each holds,
which values a status takes." *Statement:* "It MUST be stated once, as a schema in the domain."
SYS-2 *Statement:* "The modules that declare it MUST NOT import the domain." The message schema
states the shape of a message, not of a record, so DOM-3's Scope does not reach it. Code is in
`examples/tx-32-ok-dunning-stage-changed-carries-version.md`, with its own enum in
`billing/published/messages.ts`. Under the stricter reading, `stage: z.string()` in the published
schema meets both.

### 9. TX-7 vs TX-32: adding the version to `DunningStageChanged` while old messages wait

TX-32 *Statement:* "Each MUST carry a version of what it tells of, rising with each change." TX-7
*Statement:* "The change MUST keep what old code writes readable by new code, and what new code
writes readable by old code, each field keeping its meaning." A required field added breaks one
direction. Code that meets both: new code always writes `version`, and reads it as optional.

```ts
// billing/published/messages.ts
export const dunningStageChangedSchema = z.object({
  id: z.string().uuid(), type: z.literal("DunningStageChanged"), customerId: z.string(),
  stage: z.enum(["none", "reminder", "second-reminder", "collection"]),
  version: z.number().int().positive().optional(),   // every message billing writes from now on carries it
})
```

### 10. TST-5 / TST-6 vs TST-12: payment's Stripe gateway, fake and real adapter

TST-6 *Statement:* "One contract suite MUST be written against the port and run against both."
TST-5 *Statement:* "The test MUST NOT replace what the adapter talks to with a double." TST-12
*Statement:* "It SHOULD NOT run automatically." The run against Stripe is an end-to-end test. It
runs on purpose, behind TST-8's flag, and meets all three:

```ts
// payment/test/stripe/gateway.contract.test.ts
const gateway = process.env.PAYMENT_GATEWAY === "stripe" ? stripePaymentGateway(new Stripe(key)) : fakePaymentGateway()
describe.skipIf(process.env.PAYMENT_GATEWAY === "stripe" && !process.env.RUN_E2E)("PaymentGateway contract", () => { /* … */ })
```

### 11. DRV-8 vs translating Stripe's webhook in payment's hook

DRV-8 *Statement:* "The import MUST be one of: the framework that calls it, a driving port of its
system, its system's domain, a shared kernel, its system's published language, the common library,
a library that computes from its arguments." The list has no external system's package and no
upstream's export path. No rule requires the hook to import them, so code that verifies and
translates without the import meets DRV-8:

```ts
// payment/stripe/webhook.ts — hook
import { createHmac, timingSafeEqual } from "node:crypto"          // computes from its arguments
export const stripeWebhook = (secret: string, settlePayment: SettlePayment) =>
  async (rawBody: string, signature: string) => {
    if (!validSignature(rawBody, signature, secret)) throw new BadSignature()
    const e = JSON.parse(rawBody) as { id: string; type: string; data: { object: { id: string } } }
    if (e.type === "payment_intent.succeeded") await settlePayment({ messageId: e.id, externalRef: e.data.object.id, outcome: "succeeded" })
  }
```

Example defect noted under Notes 6.

### 12. SVC-2 vs TX-28: catalog's `beforeChange` checks open orders by another call

SVC-2 *Scope:* "a use case decides by what this system has stored". The decision to refuse the sku
change is catalog's, in an external system's config. Shop's use case only answers. The acting
call is Payload's save, not a service of this codebase. SVC-2's Scope does not hold for shop.
Code: `examples/tx-28-ok-before-change-hook-vetoes-sku-change.md`.

### 13. TX-26 / SYS-12 vs "Editors see each product's stock in Payload's admin, read-only; fulfillment owns it"

There is no conflict when catalog keeps no copy and reads fulfillment's open host service on
display:

```ts
// catalog/collections/products.ts
{ name: "stock", type: "number", virtual: true, admin: { readOnly: true },
  hooks: { afterRead: [async ({ data }) => (await fulfillment.stockOf({ sku: data?.sku })).available] } }
```

No record of fulfillment's is kept by Payload, so SYS-12's Scope fails. No replica is written, so
TX-26's Scope fails.

### 14. ASM-4 vs the `/health` probe pinging the database

ASM-4 *Statement:* "It MUST be a driving adapter that assembly cannot construct, or cannot hand what
it calls when it constructs it." A probe is no driving adapter, so it may not read the courier.
ASM-2's Scope is "a factory", and a route the framework calls is none. A probe that opens its own
connection meets every rule:

```ts
// apps/server/app/health/route.ts
import { Pool } from "pg"
const probe = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
export const GET = async () => ((await probe.query("select 1")).rowCount === 1 ? new Response("ok") : new Response("down", { status: 503 }))
```

### 15. DVN-4 vs SYS-13's anti-corruption route (adapter writes the receiver's command to the outbox)

DVN-4 lists "the port it implements", not the outbox port. The adapter writes the outbox row with
the store client, inside the transaction it is handed:

```ts
// shop/drizzle/reservation-requests.ts — implements shop's ReservationRequests port
import { reserveStock } from "@teeladen/fulfillment/published"      // the export path of an upstream
export const drizzleReservationRequests = (): ReservationRequests => ({
  request: (order, tx: Tx) => tx.insert(outboxTable).values(reserveStock({ orderId: order.id, lines: order.lines })),
})
```

### 16. SYS-1 vs DRV-3: shop's hooks referenced from catalog's static config

SYS-1 *Statement:* "Everything it exports MUST be one of: its published language, its open host
service's driving port types, a system builder, a fake of its open host service's driving ports."
A forwarding hook kept in catalog's config reads the courier, typed by shop's open host service
port type. Shop exports no adapter:

```ts
// catalog/collections/products.ts
import type { CountOpenOrdersWithSku } from "@teeladen/shop"        // open host service port type
import { courier } from "@teeladen/common/courier"
const openOrders = (sku: string) => courier.read<{ countOpenOrdersWithSku: CountOpenOrdersWithSku }>().countOpenOrdersWithSku({ sku })
```

### 17. TX-19 vs TX-35: a late payment after shop's deadline cancelled the order

TX-19 is about message order. The deadline is a scheduled task, not a message. Shop's outcome
depends on whether the order is already cancelled, not on the order messages arrive in.
`examples/tx-35-ok-late-payment-refunded.md` meets both.

### 18. ASM-8 vs DRV-3: Payload instantiated by its Next.js routes

Assembly calls `getPayload({ config })` in the server's startup hook, before any request. Payload
caches that instance for its routes, and assembly fills the courier before any hook runs.

### 19. TX-12 vs the admin dashboard joining orders, invoices and shipments

The dashboard's system keeps replicas from `OrderPlaced`, `InvoiceIssued` and shipment events
(TX-26), and joins its own tables. TX-12 is met.

### 20. DOM-4 vs TX-24: fulfillment's Stock and Reservation

`Stock` holds its reserved quantity, `Reservation` holds `stockId`, and the use case saves both.
DOM-4 is met (id), and so is TX-24 (the data decided by is in a saved aggregate).

## Relies-on findings

### R1. SVC-2 → DRV-8

- Line: "DRV-8: a driving adapter reaches its system through driving ports, importing no driven
  port, driven adapter or service of it."
- DRV-8 *Scope:* "a driving adapter imports a module." *Statement:* "The import MUST be one of: the
  framework that calls it, a driving port of its system, its system's domain, a shared kernel, its
  system's published language, the common library, a library that computes from its arguments."
- Beyond: DRV-8 rules imports only. "reaches its system through driving ports" is not guaranteed.
  `examples/svc-7-breach-server-action-raw-sql-through-common-pool.md` lists `satisfies: [DRV-8]`
  for an adapter that reads and writes `orders` through the common library's `pool`. Reaching is
  SVC-7's ruling.

### R2. SVC-4 → DRV-8 (minor)

- Line: "DRV-8: a driving adapter imports a driving port of its system, and no repository."
- DRV-8 as above. It permits a driving port and does not require one. "and no repository" holds.
  "imports a driving port" is not guaranteed.

### R3. DRV-7 lines in TX-15, TX-3, TX-22, TX-31, TX-35, TX-34 and TX-21

- Line, as worded in each: "DRV-7: a handler acknowledges a message once the use case it calls has
  succeeded, not before."
- DRV-7 *Scope:* "a handler is delivered a message." *Statement:* "It MUST NOT acknowledge it unless
  the use case it calls has succeeded."
- Beyond: DRV-7 guarantees "not before". It does not guarantee that the handler acknowledges once
  the use case succeeded. A handler that never acknowledges meets DRV-7. TX-34 rests on the
  positive half. Its Why says the use case "has succeeded, and the handler acknowledges", which is
  what stops redelivery of a refused command.

### R4. TX-22 → TX-31

- Line: "TX-31: a use case called for a message passes the external system a key the message
  carries, where the external system takes one."
- TX-31 *Scope:* "a use case called for a message changes something in an external system that
  takes an idempotency key." *Statement:* "It SHOULD pass a key the message carries."
- Beyond: TX-31 is a SHOULD. The line states it as given and drops "by default". SVC-2's TX-24
  line and SVC-4's TST-4 line both keep it.

### R5. TST-6 → TST-4

- Line: "TST-4: a service's test hands it fakes for its driven ports."
- TST-4 *Scope:* "a service is tested." *Statement:* "The test SHOULD hand it fakes for its driven
  ports."
- Beyond: a SHOULD stated as given. SVC-4's line to the same rule says "by default".

### R6. TX-6 lines in TX-15, TX-3 and TX-22

- Line: "TX-6: a message about a change commits in the transaction that commits the change."
- TX-6 *Scope:* "a use case writes a message about a change it makes." *Statement:* "It MUST write
  the message in the transaction that commits the change."
- Beyond: the line drops "it makes". In TX-22 the use case "writes a message instead of making it".
  In TX-3 the message asks the owner for a change this use case does not make. In TX-15 the
  message carries a write the use case leaves to a handler. TX-6's Scope does not hold for these
  messages. TX-28's Why says the same: "TX-6 binds a message to a change the use case makes". What
  these rules need, the message committing with the use case's other writes, comes from TX-1 and
  TX-2, not TX-6.

### R7. TX-19 → TX-32

- Line: "TX-32: messages of one system of which a later one overrides an earlier carry a version of
  what they tell of, rising with each change."
- TX-32 *Scope:* "a system writes messages of which a later one overrides an earlier: two changes
  of a customer's dunning stage, two statuses of one shipment." *Statement:* "Each MUST carry a
  version of what it tells of, rising with each change."
- Beyond: "one system" covers external systems as well, since the glossary calls one "A bounded
  context". TX-19's Scope reaches their messages: TX-5's Why says "A hook that tells of something
  is delivered a message too". Assumptions say "An external system sits outside the rules", so
  TX-32 guarantees no version on the events of Stripe or the 3PL. Undecided part in Notes 7.

### R8. SYS-10 → SVC-1 (minor)

- Line: "SVC-1: a system's ports are declared in its service layer."
- SVC-1 *Scope:* "a system declares a port, driving or driven." *Statement:* "It MUST be declared in
  the service layer."
- Beyond: SVC-1 covers the ports a system declares. A conformist's driven ports are the upstream's
  driving port types (glossary: Conformist), and it does not declare them. "a system's ports" is
  wider. This does not affect SYS-10's use of the line.

All other Relies-on lines match the Scope and Statement of the rule they name.

## Notes

1. ASM-2/DRV-3 hangs on ASM-2's "It MUST receive it from its caller", where "it" is "a port's
   implementation". Read strictly, the hook's factory receives a courier, not the implementation.
   In the Payload cycle the implementation does not exist when the factory runs, so no code meets
   both, and the pair is a contradiction that neither Scope settles as the narrower. Read as "comes
   from the caller", the courier assembly hands in and fills meets both. ASM-4's Why treats this
   read as allowed, but ASM-4 is a MUST about who may read, not a MAY against ASM-2.
2. ASM-7's Statement permits importing ("MAY be imported as a ready-made instance"). Its Relies on
   names SVC-7, and its Why says "a service calls it where it imports it, through no port". The
   Statement does not permit the call through no port, so a service that imports the tracer and
   records spans still breaches SVC-7 ("It MUST do so through a port of its system") if exporting
   to Jaeger counts as reaching the outside.
3. TX-5's "It MUST be idempotent", with the glossary's "repeating it leads to the same result as
   performing it once": it is unclear whether "result" includes a second mail outside. TX-5's Why
   counts "sends the mail twice" as the harm. TX-22's Why says "a repeat stays possible, which a
   business rule has to allow: a second mail". Under TX-5's reading, only at-most-once code
   complies.
4. `examples/tx-30-ok-payment-asks-stripe-at-deadline.md` runs one `transaction.run` per payment
   inside one use case. Against TX-1 ("Its service MUST run it in one transaction"), this is an
   unlisted breach in an example, not a contradiction (see candidate 5).
5. TX-3 and TX-22 leave tentative operations out only in their Whys. The Scopes rely on the glossary's
   "changes nothing it asks for". Payment still writes a pending `Payment` to its own store when
   shop asks. Whether that is "changes data another system of this codebase owns" (TX-3 Scope) for
   shop is undecided.
6. `examples/svc-7-ok-payment-reaches-stripe-through-gateway-port.md` says "`stripe` is imported by
   the driven adapter and the hook". DRV-8's list has no external system's package. This is an
   unlisted DRV-8 breach in the example. The glossary's anti-corruption layer translates "in every
   adapter that touches the upstream", but DRV-8 gives a driving adapter no way to import the
   upstream's published language.
7. Whether "one system" in R7 includes external systems hangs on the glossary's "A system is one
   bounded context" against Assumptions' "An external system sits outside the rules".
8. TX-22's Scope holds for the handler's own use case too: "changes something outside its store".
   Read literally, it would need yet another outbox hop. Read as satisfied, the change "went
   through" the outbox because the use case was called for the outbox's message.
9. `examples/sys-12-ok-shop-price-read-only-in-payload-admin.md` (variant) references
   `@teeladen/shop/payload#ChangePriceButton`, a driving adapter on a shop export path. SYS-1's list
   does not admit that. This is an example defect, not a contradiction (see candidate 16).
