# Implementer review, raw set

## Summary

No `cannot-comply` findings. In every situation of the fixture, some code follows every rule whose
Scope holds. That holds under one reading, stated in Notes N1: fixture lines that name a mechanism
are situations to place, not facts that cannot change. Five readings could still turn into
cannot-comply findings once the fixture states one more fact (Notes N2, N3, N4, N5, N18).

Other results:
- Existing ok examples: 70 checked, 6 fail a rule under their own `satisfies`. 6 more claim a rule
  whose Scope their code does not reach. 15 breach a rule they do not list, and 1 breaks a fixture
  fact.
- Relies-on: 6 findings, across 12 rules.

## Findings

None. No situation of the fixture has a rule whose Scope holds and whose Statement no code can
meet. Each candidate examined is in `## How the fixture is built`, showing the compliant shape, or
in `## Notes`, showing what it hangs on.

## How the fixture is built

Reading used throughout: a fixture line that names business behavior or a third party's behavior is
a fact (the client_secret in the same request, Stripe stops after three days, Payload's
transactions, the cycle). A fixture line that names a code mechanism ("while holding its own
ambient transaction", "a unit of work kept ambient") is a situation the rules place, and the ok
build is the shape the rules allow (Notes N1).

Ownership follows the systems table: catalog owns "the product: copy, images, slug, price, sku, tax
class". Shop owns no product field. It keeps snapshots on its order lines.

### Systems

**catalog (Payload, external system).** Outside the rules (Assumptions), except shop's adapters
over the Local API, the hooks Payload calls, and the config parts that touch other systems: SYS-12
(nothing applies: catalog keeps no record of ours) and TX-29. Catalog's business rules sit in its
collection config, in Payload's terms.

**shop.** Cart and Order, on Drizzle. Layers: `shop/domain`, `shop/service` (ports under
`service/ports`), `shop/published`, `shop/adapters`, `shop/driving`, `shop/builders`. Export paths:
`@teeladen/shop` (published language plus driving port types as `export type`), `@teeladen/shop/build`
(builders), `@teeladen/shop/testing` (fake). Rules: SYS-1, SYS-9, SYS-10, SYS-2, SVC-1, SVC-6,
DRV-8, DVN-4, DOM-1.

**payment.** Payment and Refund. Stripe sits behind `PaymentGateway`, in payment's terms. Rules:
SVC-7, DVN-4, ASM-2 (the adapter receives the `Stripe` client), TST-5, TST-12, TST-6, TST-8.

**billing.** Invoice, CustomerDunning (stage with version), InvoiceNumberSequence. All writes go
through repositories (SVC-4). The sequence is an aggregate saved in the issuing transaction, so
TX-23 serializes allocations and a rollback returns the number.

**fulfillment.** Stock (with its reservations, TX-24), OrderFulfillment (the per-order state
machine, TX-19), Shipment, SkuRegistration. Its worker process has its own assembly (ASM-1). It
also offers its open host service, `stockLevels`, to the web process's assembly (C6).

**common library.** Pino logger, OpenTelemetry tracer, relay, bus, `createTransactionPort(pool)`
with a branded opaque `Transaction`, courier. Rules: ASM-5, ASM-6, ASM-7, ASM-9. The ambient unit of
work in `AsyncLocalStorage` stays in the library, unused. No service or adapter opens a transaction
through it (ASM-9, Notes N1).

**shared kernel.** `Money` and `Sku`, each importing only zod (SYS-14). Every domain imports them
(DOM-1). They are not in the common library (ASM-6).

**external systems (Stripe, 3PL, bank, mail provider).** Each sits behind a driven port in its
system's terms, with a driven adapter importing the vendor package or `fetch` handed in (DVN-4,
ASM-2). Hooks in from Stripe and the 3PL verify and translate in the hook file itself, which
imports only the framework, a computing library (`node:crypto` HMAC, zod) and the system's driving
port (DRV-8, Notes N5).

### catalog

**C1. Editors set copy, price, sku, tax class; rules in Payload's config; `req.user` from Payload's
auth.** No rule's Scope holds: an external system's config and auth are its own (Assumptions).

```ts
// catalog/collections/products.ts — catalog's config, catalog's rules
fields: [
  { name: "price", type: "number", required: true, validate: (v: number) => v > 0 || "price above zero" },
  { name: "sku", type: "text", unique: true, required: true },
  { name: "taxClass", type: "select", options: ["tea", "accessories"], required: true },
]
```

**C2. `afterChange` hooks call shop's services.** Built instead per TX-29: catalog's config writes
`ProductChanged` into its own `outbox` collection with `req`, so it commits in Payload's
transaction. No shop hook runs inside Payload's save, so TX-28 has nothing to place. Rules: TX-29,
TX-20 (the relay reads catalog's outbox through a reader assembly builds), ASM-5. Shape as
`tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`, with `version: doc.updatedAt`
added to the message (TX-32 holds once any receiver keeps the latest: see C4).

**C3. `beforeChange` asks shop how many open orders carry a sku and refuses the change.** Shop's
hook is an answering call, and catalog vetoes by the answer. Rules: TX-28 (an answer changes
nothing), DRV-1 (zero acting calls), DRV-3, ASM-4, DRV-6 (the hook reads the courier when it runs),
SVC-7 (the service reads through `OpenOrdersBySku`, a driven port), SVC-1. Shape as
`tx-28-ok-before-change-hook-vetoes-sku-change.md`. The count can go stale before Payload commits:
Notes N10.

**C4. Shop reads product, price and tax class through the Local API.** `CatalogProducts` is shop's
driven port. Its adapter imports `payload` (DVN-4: "an external system's package") and receives
the `Payload` instance (ASM-2). The read runs in no transaction of shop's: catalog's store is not
shop's. Rules: SVC-7, DVN-4, ASM-2, TX-12 (Notes N3), TST-5 (integration test against a Payload
built on a test Postgres).

```ts
// shop/adapters/payload/catalog-products.ts — driven adapter
import type { Payload } from "payload"
import type { CatalogProducts } from "../../service/ports/catalog-products"
import { skuSchema } from "@teeladen/kernel"
import { taxClassSchema } from "../../domain/order"
export const payloadCatalogProducts = (payload: Payload): CatalogProducts => ({
  async byIds(ids) {
    const { docs } = await payload.find({ collection: "products", where: { id: { in: ids } }, depth: 0, limit: ids.length })
    return docs.map((d) => ({ productId: String(d.id), sku: skuSchema.parse(d.sku),
      unitPrice: { amount: d.price, currency: "EUR" }, taxClass: taxClassSchema.parse(d.taxClass) }))
  },
})
```

**C5. Payload's own transactions; its transaction can write to its own collection, which the
relay reads.** Rules: TX-29, TX-20, ASM-5. Assembly builds `payloadOutboxReader(payload, {
collection: "outbox" })` and hands it to `createRelay({ readers })`. The reader marks a document
delivered only after `bus.publish` resolves (TX-20).

**C6. Editors see each product's stock in Payload's admin, read-only; fulfillment owns it.** A
Payload admin field component, which Payload renders, reads fulfillment's open host service
`stockLevels`, built into the web process by its assembly. Nothing writes stock from Payload, so
SYS-12's Scope does not hold, and no replica exists for TX-26 to govern. Rules: TX-12, DRV-3,
ASM-4, DRV-6, DRV-1 (answering only), SYS-9.

```ts
// fulfillment/driving/payload/stock-field.tsx — rendered by Payload (framework-constructed)
export async function StockField({ data }: { data: { sku: string } }) {
  const { fulfillment } = courier.read()                         // read when it runs
  const [level] = await fulfillment.stockLevels({ skus: [data.sku] })
  return <output>{level?.available ?? "–"}</output>
}
```

**C7. Config needs hooks, hooks need services, services need the Payload instance.** Shop's hooks
are built by a system builder that takes the courier. Assembly builds the hooks, then Payload, then
the services, then fills the courier. Rules: DRV-3, ASM-4, ASM-8, ASM-1, SYS-1, SYS-9. Shape as
`sys-1-ok-shop-hooks-via-builder.md`. Where the stack imports the config statically, the config
holds a forwarding hook that reads the hooks assembly built from the courier (DRV-3's Why).

### shop

**SH1. Checkout returns the `client_secret` in the same request; payment creates it.**
- The route makes one acting call (DRV-1).
- Checkout loads the cart, reads catalog for the snapshot (C4), and saves Order and cleared Cart
  plus `OrderPlaced` and `SendOrderConfirmation` in one transaction (TX-1, TX-6, SVC-4, SVC-3).
- After the commit it asks payment, through shop's driven port `PaymentIntents`, for an intent.
  Assembly binds that port to payment's service (ASM-2).
- The request is a tentative operation, outside TX-3's Scope and outside TX-22's Scope at payment.
- Payment's driving port takes no transaction (TX-25). The transaction is an argument, never ambient
  (ASM-9).
- If the request fails, the order waits for its deadline (TX-30, saga step 5).
- Ids and `now` come from shop's `Clock` and `Ids` driven ports (SVC-7), never from the route.

```ts
// shop/service/checkout.ts
export const createCheckout = (d: CheckoutDeps): Checkout => async ({ cartId, customerId, locale, paymentMethod }) => {
  const now = d.clock.now()
  const order = await d.transaction.run(async (tx) => {
    const cart = await d.carts.byId(cartId, tx)
    if (!cart) throw new CartNotFound(cartId)
    const dunning = await d.dunning.byCustomerId(customerId, tx)              // replica (SH2)
    const products = await d.catalog.byIds(cart.lines.map((l) => l.productId)) // C4, snapshot source
    const order = placeOrder({ id: d.ids.next(), cart, products, customerId, paymentMethod, dunning, now }) // domain decides
    await d.orders.save(order, tx)
    await d.carts.save(clearCart(cart), tx)
    await d.outbox.write(toOrderPlaced(order, d.ids.next()), tx)
    await d.outbox.write(toSendOrderConfirmation(order, locale, d.ids.next()), tx)
    return order
  })
  if (order.paymentMethod === "invoice") return { orderId: order.id, clientSecret: null }
  const { clientSecret } = await d.payments.createIntent({ orderId: order.id, amount: order.total })
  return { orderId: order.id, clientSecret }
}
```

**SH2. Pay-by-invoice, not for a customer in dunning.** Shop keeps a `DunningReplica` written by
its handler of billing's `DunningStageChanged`, which carries billing's version (TX-26, TX-32,
TX-19, TX-5). `placeOrder` refuses invoice to a customer whose replica stage is not `none`. The
domain states the rule that accepts the lag (TX-27). SVC-2 holds: checkout loads the replica inside
its own transaction. TX-24's Scope excludes the replica. `OrderPlaced` carries `paymentMethod`, and
the Order carries `paymentDeadline: null` for invoice orders (saga 6).

```ts
// shop/domain/order.ts
/** Accepts a replica that lags billing: a customer who entered dunning a moment ago may still pay by invoice (TX-27). */
export const mayPayByInvoice = (d: DunningReplica | undefined): boolean => (d?.stage ?? "none") === "none"
```

**SH3. Checkout copies each line's price, sku and tax class from catalog's product.** These are
snapshots on `OrderLine`: `productId`, `sku`, `unitPrice`, `taxClass`. DOM-4's Scope does not hold
(catalog is another system). DOM-3: the line's shape is stated once in `shop/domain/order.ts`.
`OrderPlaced` and `OrderPaid` carry `taxClass` per line for billing (B2), in shop's published
language. That language is declared apart from the domain (SYS-2), and the service translates to
it (SVC-6).

**SH4. Order-confirmation mail once the order commits.** `SendOrderConfirmation` is a private
message written in checkout's transaction (TX-22, TX-6). Its handler calls one use case,
`sendConfirmationMail` (DRV-1, DRV-7). That use case renders from the message (locale, email,
lines: ASM-3) and calls the `MailSender` driven port (SVC-7) with `idempotencyKey: message.id`
(TX-31). TX-5 holds only if the provider takes a key: Notes N2.

**SH5. Calls billing's open host service in-process while holding its own ambient transaction.**
Built without the ambient transaction. Shop's `InvoiceLookup` driven port is bound by assembly to
billing's `getInvoiceByOrder`, and the answering use case holds no transaction. A writing use case
that calls it keeps its `tx` as an argument, which billing's port does not take. Rules: ASM-9,
TX-25, SVC-7, ASM-2, TX-12. Shape as `tx-12-ok-invoice-number-through-billing-port.md`.

### payment

**P1. Stripe behind an anti-corruption layer on the way out.** `PaymentGateway` is in payment's
terms. `stripePaymentGateway(stripe: Stripe)` imports `stripe` (DVN-4) and receives the client
(ASM-2). The contract suite runs on fake and real behind a flag (TST-6, TST-8). The real run against
Stripe's test mode is end-to-end and not automatic (TST-5, TST-12).

**P2. Creates a PaymentIntent when checkout calls; returns `client_secret` in the same call.**
- `CreatePaymentIntent` is a driving port in payment's service layer, exported as a type (SVC-1,
  SYS-10), and takes no transaction (TX-25).
- The use case calls `gateway.authorize({ paymentId, amount }, { idempotencyKey: "pi-" + orderId })`.
  That is a tentative operation at Stripe, outside TX-22's Scope.
- It then saves a `pending` Payment with `answerDueBy` in one transaction (TX-1, SVC-4).
- The pending Payment is a tentative operation payment holds, so TX-30 applies (P3).

**P3. Stripe webhooks: at least once, out of order, in Stripe's terms; no resend after three
days.**
- The hook verifies the signature with an HMAC, translates with zod inline, makes one acting call
  `recordStripeEvent`, and answers 2xx only after it returns (DRV-8, DRV-1, DRV-7).
- The use case claims `event.id` in its transaction (TX-5) and loads the Payment in the transaction
  (TX-1, SVC-2).
- The domain treats `succeeded` and `canceled` as terminal. A `payment_failed` attempt is no
  outcome, so `PaymentFailed` is published only for a canceled or abandoned intent. Order of
  arrival then changes nothing (TX-19).
- Messages carry the Payment's version (TX-32).
- At `answerDueBy` a scheduled task makes one acting call. That use case writes one private
  `SettleOverduePayment` per overdue Payment, in one transaction. Each handler's use case asks
  Stripe and settles that one Payment (TX-30, TX-1, DRV-1, TX-22 for any cancellation at Stripe).

```ts
// payment/driving/stripe-webhook.ts — hook; imports: next (framework), node:crypto, zod, payment's driving port type
export async function POST(req: Request) {
  const { recordStripeEvent, webhookSecret } = courier.read().payment
  const raw = await req.text()
  if (!validStripeSignature(raw, req.headers.get("stripe-signature"), webhookSecret)) return new Response(null, { status: 400 })
  const outcome = toOutcome(stripeEventSchema.parse(JSON.parse(raw)))      // inline zod schema of Stripe's event
  if (outcome) await recordStripeEvent(outcome)                           // throws → 500 → Stripe resends (DRV-7)
  return new Response(null, { status: 200 })
}
```

**P4. Refunds when shop asks; not a disputed charge.** Payment's published language declares
`RefundPayment` (SYS-13). Payment alone subscribes to it (TX-33). In one transaction the use case
claims the command id, loads the Payment and asks `decideRefund`. A refusal writes `RefundRefused`
and commits (TX-34). Otherwise it saves Refund and Payment and writes a private
`StripeRefundRequested` (TX-1, TX-22). That handler calls Stripe with `idempotencyKey: refund.id`
(TX-31). Stripe's confirmation leads to `PaymentRefunded` (TX-6, TX-17). Shape as
`tx-34-ok-refund-refusal-published.md` and `tx-1-ok-refund-and-payment-in-one-transaction.md`.

### billing

**B1. Invoice on `OrderPaid`, or on `OrderPlaced` for invoice orders.**
- Handlers make one call each (DRV-1, DRV-7).
- `issueInvoice` claims the message id (TX-5), loads `Invoice.byOrderId` and the sequence in the
  transaction, and asks the domain.
- An order already invoiced, because `OrderPaid` arrived after the invoice order's `OrderPlaced`,
  is a no-op by business rule. That is not TX-5, since it is a different message (saga 6).
- The Invoice's key is the order id, so a concurrent second issue fails on save (TX-24 data in the
  saved aggregates; Assumptions: "a record with the same key exists").
- The handler parses shop's message: Notes N5.

```ts
// billing/domain/invoice.ts
export const onOrderMessage = (existing: Invoice | null, m: OrderForInvoice, next: InvoiceNumber): Invoice | null =>
  existing ? null : m.paymentMethod === "invoice" || m.type === "OrderPaid" ? issue(m, next) : null
```

**B2. VAT per line from the tax class: 7% tea, 19% accessories.** It is a domain function in
billing, tested directly (TST-3, DOM-1). The tax class arrives on shop's message line (SH3).
Rounding uses the kernel's `Money` (SYS-14).

**B3. Bank API reports transfers in the bank's terms; some match no invoice.** A scheduled task
makes one acting call (DRV-1). `matchIncomingTransfers` reads `BankTransfers.since(cursor)`, a
driven port whose adapter translates the bank's terms (SVC-7, DVN-4, ASM-2). In one transaction it
records each transfer by its bank id (Transfer key unique: a repeat changes nothing), saves matched
Invoices as paid, saves unmatched transfers as `UnmatchedTransfer` (a business rule decides what an
unmatched transfer becomes), and writes `InvoicePaid` and `DunningStageChanged` (TX-1, TX-6, TX-32,
TX-24). TST-5 for the bank adapter: Notes N4.

**B4. Scheduled dunning; the stage rises per reminder and clears on payment.** The tick's one
acting call writes a private `RaiseDunning { id: "dunning-" + customerId + "-" + day }` per customer
with an overdue invoice (DRV-1, TX-15). Each handler's use case loads CustomerDunning and that
customer's open invoices in its transaction. The domain decides. It saves with version (TX-23) and
writes `DunningStageChanged` with the version (TX-32) and `SendReminderMail` (TX-22). A payment
clearing the stage concurrently makes one save fail, and redelivery retries (TX-23, P10).

**B5. Credit note for each refund.** Billing handles payment's `PaymentRefunded` event, not the
`RefundPayment` command (TX-33, TX-17, TX-5). For a refund of an order billing never invoiced (saga
7), a business rule in billing's domain decides (TX-35, Notes N14).

### fulfillment

**F1. Reserve on `OrderPlaced`; release on `OrderCancelled`.** `applyOrderMessage` claims the id
(TX-5), loads OrderFulfillment and the Stock for each sku in the transaction, and saves both (TX-24:
the stock with its reservations in `Stock`, so TX-23 fails a concurrent reservation). The
Reservation carries `expiresAt`, taken from the order's payment deadline on `OrderPlaced`. A
scheduled task releases expired ones, and that business rule ends the wait for shop's answer
(TX-30).

**F2. `OrderPaid`/`OrderCancelled` before `OrderPlaced`; a dropped cancel.** OrderFulfillment is a
state machine keyed by order id. "Not found" creates a record with the early fact (TX-19). Shape as
`tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md`, extended by `paid` and
`cancelled` flags. A cancel that never arrives is ended by the reservation's expiry (F1, TX-30).

**F3. 3PL webhooks in the 3PL's terms.** The hook verifies, translates with zod inline, makes one
acting call `recordShipmentStatus`, and answers after it returns (DRV-8, DRV-1, DRV-7). The use case
sets the status by rank (`booked < dispatched < delivered`), keeps the higher (TX-19, TX-5), and
writes `ShipmentStatusChanged` with the Shipment's version (TX-32, TX-6).

**F4. Article master needs each SKU before shipping; register new SKUs.**
- Fulfillment handles catalog's `ProductChanged` (C2) and, as a fallback, every `OrderPlaced` line.
- `noteSku` saves a SkuRegistration (`pending`) and writes a private `RegisterSku` when the sku is
  new (TX-22).
- The handler's use case calls `warehouse.registerArticle(sku, { idempotencyKey: sku })` (TX-31) and
  records `registered`.
- `bookShipment` checks the SkuRegistration in its transaction. While it is pending, it throws and
  redelivery retries. Its business rule gives up after a set time and parks the order for manual
  handling (TX-30).

**F5. Worker: own entry point, own assembly.** One `main.ts` (ASM-1). Handlers are constructed by
the builder with their service (ASM-2). There is no courier in the worker. OpenTelemetry is preloaded
(CL2). Shape as `asm-1-ok-fulfillment-worker-one-assembly.md`.

### common library

**CL0. Unit of work kept ambient in `AsyncLocalStorage`.** Not used by any system. Every
transaction is a `Transaction` argument (ASM-9, TX-1, TX-2). The ambient value that remains is
telemetry (ASM-7). See Notes N1.

**CL1. OpenTelemetry's own ambient context; no-op span when empty.** `tracer` and `logger` are
imported ready-made (ASM-7). Nothing decides by them (ASM-3).

**CL2. Auto-instrumentation before any other import.** It is preloaded by `node --import ./otel.js`
in the worker, and started first inside `register()` in the web process with `pg` imported
dynamically after it. Neither builds a port, so each process keeps one assembly (ASM-1).

**CL3. Request id and trace context cross systems; the transaction does not.** The outbox adapter
writes `traceparent` and the request id as envelope headers. The bus restores them around the
handler (ASM-3, ASM-7). No record or message schema field holds them. No port takes a transaction
(TX-25, ASM-9). Shape as `asm-3-ok-trace-context-crosses-bus-in-envelope.md`.

### The checkout saga

1. **Order placed, `OrderPlaced` published; fulfillment reserves.** SH1 and F1. Shop names no
   handler (TX-17). Fulfillment's assembly subscribes.
2. **Shop calls payment; returns `client_secret`.** SH1 and P2.
3. **Stripe's webhook; payment publishes `PaymentSucceeded`/`PaymentFailed`.** P3. Each message is
   written with the Payment in one transaction (TX-6).
4. **On success: order paid, `OrderPaid`; billing invoices; fulfillment ships.**
   - Shop's handler use case `applyPaymentSucceeded` claims the id and loads the Order in the
     transaction (TX-5, TX-1, SVC-2).
   - The domain `onPaymentSucceeded` marks it paid, or for a cancelled order goes to step 7 (TX-35).
   - Billing does B1.
   - Fulfillment's use case decides the shipment and writes a private `BookShipment { shipmentId }`
     (TX-22). That handler books with `idempotencyKey: shipmentId` (TX-31), as in
     `tx-31-ok-3pl-booking-keyed-by-shipment-id.md`.
5. **`PaymentFailed` or deadline: cancel, `OrderCancelled`; fulfillment releases.**
   - `cancelOrder` loads and decides in its transaction (SVC-2, TX-1, TX-23).
   - The deadline task makes one acting call. That use case writes a private `CancelOverdueOrder`
     per order past its deadline, and each handler calls `cancelOrder` (DRV-1, TX-1).
   - Invoice orders carry no deadline (saga 6).
   - Payment arriving at the same moment as the deadline: TX-23 fails the later save.

```ts
// shop/domain/order.ts
export const canBeCancelledBy = (o: Order, by: Requester, now: Date): boolean => {
  if (o.status !== "placed") return false
  switch (by.kind) {
    case "customer": return by.customerId === o.customerId
    case "payment-failed": return o.paymentMethod === "card"
    case "deadline": return o.paymentDeadline !== null && new Date(o.paymentDeadline) <= now   // none for invoice orders
  }
}
```

6. **Paid by invoice.** `OrderPlaced { paymentMethod: "invoice" }`. Billing invoices it (B1) and
   fulfillment ships it on that message. Billing's `InvoicePaid` reaches shop's handler, which marks
   the order paid and writes `OrderPaid`. Billing (B1) and fulfillment (OrderFulfillment already
   `shipped`) treat that `OrderPaid` as a no-op by domain rule (TX-19, TX-5).
7. **Payment after the deadline cancelled the order.** Shop's domain decides on a refund. Shop
   writes payment's `RefundPayment` to its outbox (TX-35, TX-3, SYS-13). Payment refunds or
   publishes `RefundRefused` (TX-34). On `RefundRefused`, shop's domain decides again (TX-35). Shape
   as `tx-35-ok-late-payment-refunded.md`.

### Cross-cutting reads

**X1. Admin dashboard joins orders, invoices and shipments in the one Postgres.**
- It is placed in shop, as an answering use case `adminOverview`.
- It reads through the driven port `AdminOverviewQuery`, whose Drizzle adapter joins shop's
  `orders` with shop's replicas `invoice_replica` and `shipment_replica` (SVC-7, TX-12).
- Shop's handlers write those replicas from billing's `InvoiceIssued`/`InvoicePaid` and
  fulfillment's `ShipmentStatusChanged` (TX-26, TX-32, TX-19, TX-5).
- The admin page is a driving adapter reading the courier (DRV-3, ASM-4). Notes N18.

**X2. A Payload edit revalidates the cached shop page.**
- Catalog writes `ProductChanged` in its transaction (C2, TX-29).
- Shop's handler use case decides and writes a private `RevalidateProductPage` (TX-22: the cache
  is outside shop's store, so the change goes through shop's outbox).
- That handler runs in the web process and calls the `PageCache` driven port, whose adapter calls
  the framework's `revalidatePath` (SVC-7, DVN-4).
- Revalidating twice is no change (TX-5).

**X3. `/health` pings the database; `/metrics` is scraped.** Both are probes, outside the layers
(Assumptions). `/health` opens one `pg.Client` per call, runs `select 1` and closes it. It reads no
courier, which ASM-4 allows only to driving adapters (Notes N19). `/metrics` imports the common
library's metrics exporter ready-made (ASM-7).

## Existing ok examples that do not hold

70 files checked: every `*-ok-*` file in `examples/`. Only one has a non-empty `breaches`:
`tx-28-ok-after-change-hook-records-revalidation-request.md` breaches TX-29, and it holds. Payload
can write the message in its transaction, and the config tells by an `afterChange` hook instead.

### A rule under `satisfies` that the code does not meet (6 files)

| file | rule | the rule's sentence | what the code does instead |
| --- | --- | --- | --- |
| `asm-9-ok-transaction-handed-as-argument.md` | TX-1 | "Its service MUST run it in one transaction: open it, hand it to each call into its store, commit it." | `const cart = await deps.carts.load(cartId)` runs before `deps.tx.begin()`, with no transaction. |
| `svc-3-ok-place-order-writes-cart-itself.md` | TX-1 | same | `const cart = await carts.findById(input.cartId)` runs outside `transactions.run`. The cart cleared inside is a save of that out-of-transaction load. |
| `svc-4-ok-mark-paid-through-repository.md` | TX-1 | same | `const order = await orders.findById(orderId)` runs outside `transactions.run`. The status check `order.status !== "placed"` decides by that read. |
| `asm-2-ok-payload-adapter-takes-instance.md` | DVN-4 | "The import MUST be one of: a client of something outside the process, an external system's package, the port it implements, its system's domain, a shared kernel, the common library, the export path of an upstream, a library that computes from its arguments." | `import { asPayloadTx } from "./transaction"`: a sibling module of the adapter, which the closed list does not name (Notes N6). |
| `asm-7-ok-logger-and-tracer-imported-ready-made.md` | DVN-4 | same | `import { toWarehouseOrder, fromWarehouseShipment } from "./warehouse-translation"`: same as above. |
| `dom-4-ok-order-line-copies-price.md` | DOM-4 | Scope: "an aggregate needs something of another aggregate of the same system." | Both references cross systems: `productId: z.string(), // catalog's document id` and `paymentId: z.string().nullable(), // payment's aggregate`. The Scope holds nowhere, so the example shows nothing of DOM-4. Its comment `sku: skuSchema, // shop's own commercial field` also contradicts the fixture, where catalog owns sku. |

### A rule under `satisfies` whose Scope the code does not reach (6 files)

These do not fail. They demonstrate nothing for the named rule.
- `svc-7-ok-order-overview-through-query-port.md`, TX-1: the use case answers. TX-1's Scope is "a
  use case writes".
- `svc-6-ok-opaque-transaction.md`, DOM-1: no domain module in the snippet.
- `sys-14-ok-money-returns-remainder.md`, DOM-1: no domain module in the snippet. "billing's
  domain" appears only in prose.
- `tx-3-ok-checkout-requests-checkout-session.md`, TX-3: by its own text, "TX-3's Scope … does not
  hold for the request". No other change to payment's data is in the code.
- `tx-22-ok-payment-requests-checkout-session.md`, TX-22: the request is outside the Scope by its
  own text. `record-payment` writes only payment's store.
- `tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`, TX-22: only the comment
  `// fulfillment's handler writes RegisterSku …` touches it.

### A rule not listed that the code breaches (15 files, plus 1 that breaks a fixture fact)

| file | rule | the rule's sentence | the code |
| --- | --- | --- | --- |
| `asm-2-ok-assembly-hands-upstreams-to-builder.md` | SYS-1 | "Everything it exports MUST be one of: its published language, its open host service's driving port types, a system builder, a fake of its open host service's driving ports." | `import { buildShop, createPayloadCatalog } from "@teeladen/shop"`: a driven adapter on shop's export path. `asm-8-ok-register-fills-courier-before-requests.md` calls the same `createPayloadCatalog(payload)`. |
| `asm-3-ok-actor-through-driving-port.md` | TX-28 | "The use case it calls MUST NOT change this system beyond recording a tentative operation." | `syncPriceAfterChange`, an `afterChange` hook, calls `syncPrice`, which does `deps.products.save(...)` and `deps.tx.commit(t)` before Payload commits. |
| `asm-3-ok-hook-passes-editor.md` | SVC-7, TX-1 | "It MUST do so through a port of its system." / TX-1 as above | The hook passes `changedAt: new Date()`, reaching the clock without a port. `productCommercial.findById(productId)` runs outside `transactions.run`. |
| `drv-1-ok-session-through-answering-service.md` | SVC-7 | "It MUST do so through a port of its system." | `now: new Date()` in the server action. |
| `drv-3-ok-server-action-reads-courier.md` | SVC-7 | same | `placedAt: new Date()` in the server action. |
| `drv-6-ok-server-action-reads-at-run-time.md` | SVC-7, DRV-8, SYS-1 | SVC-7 as above. DRV-8: "The import MUST be one of: the framework that calls it, a driving port of its system, its system's domain, a shared kernel, its system's published language, the common library, a library that computes from its arguments." SYS-1 as above. | `now: new Date()`. `import { shopServices } from "@teeladen/shop/courier-key"`: an export path of shop exporting a courier accessor, which is neither published language, port type, builder nor fake, imported by a driving adapter. |
| `svc-2-ok-cancel-order-decides-itself.md` | TX-1 | as above | `const order = await orders.findById(orderId)` outside `transactions.run`. SVC-2's own Statement holds: the decision is in the acting call. |
| `svc-3-ok-place-order-writes-cart-itself.md` | DRV-8 | as above | The handler `createSendOrderConfirmationHandler = ({ mail }: { mail: MailSender })` types itself by a driven port and calls it directly, with no use case. |
| `sys-9-ok-billing-imports-from-export-path.md` | DRV-8 | as above | The handler does `import { orderPaidSchema, type OrderPaid } from "@teeladen/shop"`: an upstream's published language, which DRV-8 does not list (Notes N5). |
| `tx-1-ok-one-invoice-transaction-per-message.md` | DRV-8 | as above | `import type { OrderPaid } from "@teeladen/shop/published"` in a handler. |
| `tx-17-ok-fulfillment-subscribes-to-order-placed.md` | SYS-2 | "The modules that declare it MUST NOT import the domain." | `shop/published.ts` re-exports `orderPlacedSchema` from `./domain/messages`, where `orderPlaced = (order: Order)` takes the domain's `Order`. The published language is declared in, and with, the domain. |
| `tx-7-ok-gift-message-added-optional.md` | SYS-2 | same | `sku: skuSchema, // re-used from the domain` in `shop/domain/messages/order-placed.ts`, which declares `orderPlacedSchema`. |
| `tx-30-ok-payment-asks-stripe-at-deadline.md` | TX-1 | as above | One use case, `settleOverduePayments`, runs `transaction.run` once per overdue payment inside a `for` loop. `payments.overdue(clock.now())` runs outside any transaction. |
| `tx-6-ok-payment-succeeded-written-with-payment.md` | TX-19 | "It MUST reach the same result whatever order the messages arrive in." | `applyOutcome` maps any non-`succeeded` outcome to `failed(payment, outcome)` with `paymentFailed`, whatever the Payment's state. A `payment_failed` arriving after `succeeded` fails a paid Payment and publishes `PaymentFailed`. `tx-5-ok-stripe-webhook-claims-event-id.md` claims the domain orders them, but this is that domain. |
| `asm-7-ok-logger-and-tracer-imported-ready-made.md` | ASM-2 | "It MUST receive it from its caller." | `fetchImpl: typeof fetch = fetch`: when the caller passes none, the factory takes the global client itself. |
| `sys-13-ok-checkout-process-sends-receivers-commands.md` | fixture | "Checkout must return a Stripe `client_secret` in the same request; payment creates it." | Payment is asked by `createPayment(...)` in the outbox, asynchronously, after `StockReserved`. No `client_secret` can reach the checkout response. |

`sys-13-ok-checkout-process-sends-receivers-commands.md` breaks a fixture fact, not a rule; it is
listed here because it is an ok example of the fixture that cannot be the fixture.

## Relies-on findings

**R1. SVC-2, line DRV-8.**
- Line: "DRV-8: a driving adapter reaches its system through driving ports, importing no driven
  port, driven adapter or service of it."
- DRV-8 Scope: "a driving adapter imports a module." Statement: "The import MUST be one of: the
  framework that calls it, a driving port of its system, its system's domain, a shared kernel, its
  system's published language, the common library, a library that computes from its arguments."
- Beyond: DRV-8 rules imports only. "reaches its system through driving ports" is not guaranteed.
  The common library, on DRV-8's list, holds store clients, and SVC-7's Why says so: "The import
  lists, SVC-6 and DRV-8, let a service or a driving adapter hold a store client". The reach is
  SVC-7's, and SVC-7 says only "a port of its system", not a driving port.

**R2. SVC-4, line DRV-8.**
- Line: "DRV-8: a driving adapter imports a driving port of its system, and no repository."
- DRV-8 Scope and Statement: as in R1.
- Beyond: DRV-8 permits a driving port, it does not require one. Only "no repository" is
  guaranteed.

**R3. DRV-7 read as a guarantee to acknowledge.** Lines in TX-15, TX-3, TX-22, TX-31, TX-35, TX-34
and TX-21: "DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not
before."
- DRV-7 Scope: "a handler is delivered a message." Statement: "It MUST NOT acknowledge it unless the
  use case it calls has succeeded."
- Beyond: DRV-7 forbids an early acknowledgment. It does not require one after success.
- The line is load-bearing in TX-34, whose Why says "it has succeeded, and the handler
  acknowledges", and in TX-35, where "It returns … and the customer's card stays charged" needs the
  acknowledgment to happen.

**R4. TX-3 and TX-22, line TX-6.**
- Line: "TX-6: a message about a change commits in the transaction that commits the change."
- TX-6 Scope: "a use case writes a message about a change it makes." Statement: "It MUST write the
  message in the transaction that commits the change."
- Beyond: the line drops "it makes". Under TX-3 the message asks the owner for a change this use
  case does not make, such as `RefundPayment` in step 7. Under TX-22 the use case "writes a message
  instead of making it" (TX-22's Why).
- For those messages TX-6's Scope does not hold. That the message commits with the use case's other
  writes is TX-1's guarantee (one transaction per writing use case), not TX-6's.
- TX-15's identical line holds only where the message tells of a change the use case made.

**R5. TX-22, line TX-31.**
- Line: "TX-31: a use case called for a message passes the external system a key the message
  carries, where the external system takes one."
- TX-31 Scope: "a use case called for a message changes something in an external system that takes
  an idempotency key." Statement: "It SHOULD pass a key the message carries."
- Beyond: the line states a SHOULD as unconditional. A deviation through an ADR is allowed. Compare
  SVC-2's TX-24 line, "by default, …", and SVC-4's TST-4 line, "by default, …".

**R6. TST-6, line TST-4.**
- Line: "TST-4: a service's test hands it fakes for its driven ports."
- TST-4 Scope: "a service is tested." Statement: "The test SHOULD hand it fakes for its driven
  ports."
- Beyond: as R5. SVC-4's line on the same rule says "by default".

All other Relies-on lines were checked against their named rule's Scope and Statement and hold:
DOM-1, SVC-1, SVC-6, SVC-3, DRV-8, DRV-1, DRV-3, DVN-4, ASM-2, ASM-10, ASM-7, ASM-4, ASM-8, ASM-9,
ASM-5, TX-1, TX-2, TX-23, TX-24, TX-25, TX-28, TX-29, TX-6, TX-20, TX-5, TX-19, TX-12, TX-26,
SYS-9, SYS-10, SYS-2, TST-3, TST-10, TST-4, TST-8, TST-11. TX-15, TX-3, TX-22, TX-31, TX-35, TX-34
and TX-21 hold except for R3, R4 and R5.

## Notes

**N1. Fixture mechanisms read as situations, not facts.** Two lines turn on this:
"Calls billing's open host service in-process while holding its own ambient transaction." and "a
unit of work kept ambient in `AsyncLocalStorage`". Against them stands ASM-9: "It MUST NOT be an
ambient value." Read as facts, ASM-9 is cannot-comply for shop. Read as situations ("This file
holds situations, never rulings"), the ok build hands the transaction as an argument. I took the
second reading. Under the first reading, this note becomes a finding.

**N2. TX-5 and a mail provider without an idempotency key.** TX-5: "It MUST be idempotent." TX-22's
Why: "Where the owner takes no key, a repeat stays possible, which a business rule has to allow: a
second mail." The fixture only says "Also used: a mail provider (shop, billing)." and does not say
whether it takes a key.
- Without a key, two shapes remain. Claim-then-send commits the claim before the call, so a crash
  between them loses the mail, against "Sends an order-confirmation mail once the order commits".
  Send-then-claim sends twice on redelivery, against TX-5.
- That would be a cannot-comply finding for TX-5 under SH4 and B4.
- The same question applies to the 3PL for bookings and registrations: TX-31 holds only "where the
  external system takes one".

**N3. Is an external system's API its open host service?** TX-12: "It MUST read it from the
owner's open host service or from its published events." The glossary defines "Open host service.
The driving ports a system offers to other systems." and says an external system "is driven
through its API". I read Payload's Local API as catalog's offer (C4). If it is not, shop must keep
a product replica from catalog's `ProductChanged`, which would then have to carry price, sku and
tax class with a version, and the fixture line "shop reads the product … through Payload's Local
API" would not be built.

**N4. TST-5 for the 3PL and bank adapters.** TST-5: "The test MUST NOT replace what the adapter
talks to with a double." The fixture does not say whether the 3PL or the bank offers a test system.
If one does not, no test of that adapter meets TST-5.

**N5. DRV-8 omits an upstream's published language and an external system's package.** DRV-8's
list names "its system's published language" only. DOM-1, SVC-6 and DVN-4 admit an upstream's
export path or package. A handler of an upstream's event complies only in one of two ways:
- under a conformist, by importing a schema that its own domain re-exports from the upstream;
- under an anti-corruption layer, by restating the upstream's schema inline with zod, as the Stripe
  and 3PL hooks do (P3, F3).

Neither breaks a fixture fact, so it is no finding. The restated schema is exactly the second
statement that TX-7 and P14 warn of. Three existing ok examples do the direct import (table above).

**N6. Closed import lists name no other module of the same layer or adapter.** This affects DVN-4,
DRV-8 and SVC-6. DOM-1 names "another domain module" and SYS-14 names "another module of the same
published language". DVN-4, DRV-8 and SVC-6 name nothing like it. Read literally, a translation
helper beside an adapter, or a `service/translate/*.ts` beside a service, cannot be imported. I
applied the literal reading to the two DVN-4 rows above. The build inlines.

**N7. ASM-3 and a request id written to a record.** `asm-3-ok-actor-through-driving-port.md`'s
adapter writes `requestId: requestContext.getStore()?.requestId` into an audit column. ASM-3: "The
value MUST NOT change how the use case acts or what it answers." Its Why counts what gets recorded
("the user an audit column records arrive as arguments") and exempts telemetry. Whether a request
id is telemetry I could not decide. My build keeps it on envelope headers and logs only (CL3).

**N8. ASM-4 and a typed courier accessor.** In `drv-3-ok-server-action-reads-courier.md`,
`shopServices()` in `shop/courier-key.ts` calls `resolve`. ASM-4: "It MUST be a driving adapter
that assembly cannot construct, or cannot hand what it calls when it constructs it." Whether the
code that reads is the accessor or the action calling it, I could not decide.
`svc-6-ok-place-order-dependencies.md` and `drv-1-ok-session-through-answering-service.md` use the
same accessor, with imports not shown. Their DRV-8 claim depends on where it lives.

**N9. SYS-12 and Payload's Local API.** `sys-12-ok-shop-price-read-only-in-payload-admin.md`
refuses access to the admin and REST, while "the Local API overrides access". SYS-12: "The external
system's own ways in MUST NOT change it." The Local API is both shop's way in and Payload's own,
including code in catalog's config. I could not decide whether access rules alone meet it. The
example's SVC-4 claim shows no write in its code.

**N10. The sku veto reads a count that can change before Payload commits.** No rule's Scope holds
for this. SVC-2's Scope is "a use case decides by what this system has stored", and the deciding
use case is catalog's, outside the rules. Shop's answering use case decides nothing. The fixture
situation is built as given (C3). It is a P10 gap, not a finding.

**N11. Examples that give shop the price and sku.** `asm-2-ok-payload-adapter-takes-instance.md`,
`asm-3-ok-actor-through-driving-port.md`, `svc-6-ok-opaque-transaction.md`,
`sys-1-ok-shop-export-paths.md` (`productCommercialSchema`) and `dom-4-ok-order-line-copies-price.md`
give shop the price or sku. The fixture has catalog own them. Only
`sys-12-ok-shop-price-read-only-in-payload-admin.md` marks itself as a variant.
`svc-6-ok-opaque-transaction.md` and `asm-2-ok-payload-adapter-takes-instance.md` also hand shop's
transaction into Payload (`req: { transactionID: asPayloadTx(tx) }`): one transaction across shop
and catalog. No rule's Scope reaches it, since TX-25's Scope is "a system declares a driving port".
P16 is left uncovered for an external system's ways in.

**N12. Checkout Session versus PaymentIntent.** `tx-22-ok-payment-requests-checkout-session.md` and
`tx-3-ok-checkout-requests-checkout-session.md` build a Stripe Checkout Session. The fixture says
payment "Creates a Stripe PaymentIntent when shop's checkout calls it". The rules' reading
(tentative operation) is the same for both.

**N13. Choreography versus orchestration.** It is not a rule's call (Assumptions). The fixture's
five steps read as choreography. `sys-13-ok-checkout-process-sends-receivers-commands.md`
orchestrates and loses the same-request `client_secret` (table above). The process manager's steps
also claim no message id, and `reserveStock({...})` mints a new command per delivery, so TX-5
depends on `processes.save(started(orderId))` failing on a duplicate key, which the snippet does
not show.

**N14. "Issues a credit note for each refund" against saga step 7.** Step 7 refunds an order that
was cancelled and never invoiced. I built a business rule in billing's domain under TX-35's Scope
("a payment came for an order it has cancelled" generalizes to "a refund for an order never
invoiced"). Whether a credit note without an invoice is what the fixture means, it does not say.

**N15. Billing's second `OrderPaid` for an invoice order.**
`tx-1-ok-one-invoice-transaction-per-message.md` claims only the message id. For an invoice order
(saga 6), the later `OrderPaid` is another message and issues a second invoice. No rule turns on
this. My build keys the Invoice by order (B1).

**N16. A decision by a synchronous read of another system.** TX-27's Scope is "a use case decides
by a replica". TX-24's Scope is "a use case decides by what this system has stored, other than a
replica, and the decision has to hold when the use case commits". A decision by a synchronous read
of another system's open host service falls in neither, so no rule asks a business rule to accept
its staleness (P10). I built SH2 on a replica to stay inside TX-27.

**N17. TX-5 and a redelivery that throws.** `svc-4-ok-mark-paid-through-repository.md` throws
`NotPayable` on the second delivery of the same message. The state is unchanged, but the handler
never acknowledges and the message parks. Whether that is "the same result as performing it once"
(glossary: Idempotent) I could not decide. The build claims ids (saga 4).

**N18. The admin dashboard.** "An admin dashboard joins orders, invoices and shipments in the one
Postgres." I built it in shop over shop's replicas (X1). If the line means the owners' own tables,
TX-12 ("It MUST read it from the owner's open host service or from its published events") is
cannot-comply for it.

**N19. `/health` and the courier.** ASM-4: "It MUST be a driving adapter that assembly cannot
construct, or cannot hand what it calls when it constructs it." A probe is no driving adapter, so it
cannot read the process's pool from the courier. My build opens its own client per ping, which pings
the database but not the process's pool. Whether that meets "`/health` pings the database" as meant,
the fixture does not say.

**N20. Rule-name example files.** `tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`
is named under TX-29's Examples as "ok". `tx-28-ok-after-change-hook-records-revalidation-request.md`
is named there as "breach", which matches its front matter `breaches: [TX-29]`. Both hold.
