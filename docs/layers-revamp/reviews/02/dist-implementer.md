# Implementer review, distilled set

## Summary

- `tx-22-breach-payment-creates-intent-in-checkout-call.md`, TX-22 (with TX-1, SVC-3): payment can't create the PaymentIntent through its outbox and still return the `client_secret` in the call shop's checkout makes.
- `tx-3-breach-checkout-calls-payment-for-client-secret.md`, TX-3: shop's checkout changes payment's data, so it may only write a message; then payment never gets "the same call" in which to return the `client_secret`.

## Findings

### tx-22-breach-payment-creates-intent-in-checkout-call.md

```yaml
breaches: [TX-22]
satisfies: [SVC-7, TX-1, TX-30]
situation: payment creates a Stripe PaymentIntent when shop's checkout calls it, and returns its client_secret in the same call
finding: cannot-comply
```

# Payment creates the PaymentIntent inside the call shop makes; the outbox would come too late

```ts
// payment/service/create-payment.ts — closest code: the change at Stripe happens in the call
export const createCreatePayment =
  ({ payments, gateway, transaction, clock }: Deps): CreatePayment =>
  async ({ paymentId, orderId, amount }) => {
    const { externalRef, clientSecret } =
      await gateway.authorize({ paymentId, amount })                     // creates the PaymentIntent at Stripe, now
    await transaction.run((tx) =>
      payments.save(newPayment({ paymentId, orderId, amount, externalRef, now: clock.now() }), tx))   // domain sets answerDueBy (TX-30)
    return { paymentId, clientSecret }
  }

// the same use case under TX-22: no client_secret exists when it returns
  async ({ paymentId, orderId, amount }) => {
    await transaction.run(async (tx) => {
      await payments.save(newPayment({ paymentId, orderId, amount, now: clock.now() }), tx)
      await outbox.write(createPaymentIntent({ paymentId, amount }), tx)   // private; its handler calls Stripe after the commit
    })
    return { paymentId, clientSecret: /* not yet created */ }
  }
```

TX-22's Scope holds: creating a PaymentIntent "changes something outside its store that no system
of this codebase owns". The previous Implementer read Stripe's PaymentIntent the same way:
tx-30-ok cancels one "through payment's outbox (TX-22)". The Statement: "The change MUST go
through this system's outbox, on behalf of its owner." The relay hands that message to payment's
handler only after the call's transaction commits, so the call returns before Stripe has issued
a `client_secret`. Waiting inside the same call for the handler's result doesn't fix this. TX-1
says "Its service MUST run it in one transaction: open it, hand it to each call into its store,
commit it", and the reads after the commit can't be handed that transaction. Under SVC-3, the
use case "MUST NOT call that service", so it can't hand the wait to another service. The
fixture's fact goes unmet: "Creates a Stripe PaymentIntent when shop's checkout calls it, and
returns its `client_secret` in the same call." The existing
`svc-7-ok-payment-reaches-stripe-through-gateway-port.md` uses the closest code shown here, but
lists no TX-22. The finding depends on how the glossary sentence on tentative operations is read
(see Notes).

### tx-3-breach-checkout-calls-payment-for-client-secret.md

```yaml
breaches: [TX-3]
satisfies: [TX-1, TX-6, SVC-7, TX-25]
situation: checkout must return a Stripe client_secret in the same request; payment creates it
finding: cannot-comply
```

# Shop's checkout calls payment's driving port after its commit, to hand the browser the client_secret

```ts
// shop/service/ports/payment-requests.ts — driven port onto payment's open host service; no transaction (TX-25)
export interface PaymentRequests {
  createPayment(input: { orderId: string; amount: Money }): Promise<{ paymentId: string; clientSecret: string }>
}

// shop/service/checkout.ts — closest code
export const createCheckout =
  ({ carts, orders, products, payments, outbox, transaction, clock }: Deps): Checkout =>
  async ({ cartId, paymentMethod }) => {
    const order = await transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      const placed = placeOrder(cart, await products.forSkus(skusOf(cart)), paymentMethod, clock.now())   // domain: snapshots, deadline
      await orders.save(placed, tx)
      await outbox.write(orderPlaced(placed), tx)                                      // TX-6
      return placed
    })
    if (order.paymentMethod === "invoice") return { orderId: order.id }
    const { clientSecret } = await payments.createPayment({ orderId: order.id, amount: order.total })   // payment records a Payment
    return { orderId: order.id, clientSecret }
  }

// under TX-3 the call becomes a message, and nothing comes back
      await outbox.write(createPayment({ orderId: placed.id, amount: placed.total }), tx)   // payment's command (SYS-13)
```

The call makes payment record a Payment (payment owns Payment, per the fixture), so TX-3's Scope
holds: "a use case of this system changes data another system of this codebase owns". The
Statement is "It MUST do so by writing a message to this system's outbox." Once checkout writes
`CreatePayment` instead, payment's handler creates the Payment and the PaymentIntent, and no call
from shop's checkout exists that could return the `client_secret`. Checkout could stay in the
request and keep reading payment's open host service (TX-12) until the `client_secret` shows up.
That meets "Checkout must return a Stripe `client_secret` in the same request", but it breaks
"Creates a Stripe PaymentIntent when shop's checkout calls it, and returns its `client_secret` in
the same call", and saga step 2: "shop calls payment, which creates a Stripe PaymentIntent".
This finding is weaker than the TX-22 one. It rests on payment's "same call" sentence, not on
shop's "same request".

## How the fixture is built

Choreographed, as the saga reads. The Assumptions leave the choice to an ADR. Transactions are
passed explicitly. Every acting use case has the shape `transaction.run(async (tx) => { claim?;
load; domain decides; save; outbox.write })`.

### catalog (Payload)

- **Editors set copy, price, sku, tax class; rules in Payload's collection config; `req.user`.**
  Outside the rules (Assumptions: "An external system sits outside the rules"). The only parts
  that fall under the rules are the hooks it calls and how it tells of a change.
- **afterChange hooks call shop's services.** Built as tx-29-ok instead (TX-29). Catalog's
  `afterChange` writes `ProductChanged` into catalog's `outbox` collection with `req`, so it
  commits with the edit. Assembly builds `payloadOutboxReader(payload)` and hands it to the relay
  (TX-20). Shop's and fulfillment's handlers act on the message (DRV-7, TX-5, TX-19). The message
  carries `version: doc.updatedAt` (TX-32, see Notes).
- **beforeChange asks shop how many open orders carry a sku, refuses.** Built as tx-28-ok: shop's
  hook reads its services from a courier (DRV-3, DRV-6) and makes one answering call (DRV-1). The
  use case writes nothing (TX-28) and reads through a driven port (SVC-7). The veto is catalog's
  rule, in catalog's config.
- **Shop reads the product, price and tax class via the Local API.** Shop has a driven port in
  its own terms; its adapter wraps `payload.find` (SVC-1, SVC-7, DVN-4, TX-12). The adapter
  receives the Payload instance (ASM-2).
  ```ts
  // shop/service/ports/product-catalog.ts
  export interface ProductCatalog { forSkus(skus: Sku[]): Promise<CatalogProduct[]> }   // { sku, price: Money, taxClass }
  // shop/payload/product-catalog.ts
  export const payloadProductCatalog = (payload: Payload): ProductCatalog => ({ forSkus: async (skus) => (await payload.find({ collection: "products", where: { sku: { in: skus } } })).docs.map(toCatalogProduct) })
  ```
- **Payload's own transactions; hook inside one; outbox collection.** No shop or fulfillment use
  case runs inside Payload's save except the beforeChange answer (TX-28). Shop's driving ports
  take no `req` or `transactionID` (TX-25, ASM-9).
- **Stock shown read-only in Payload's admin; fulfillment owns it.** A virtual field / admin
  component calls fulfillment's hook (read from a courier, DRV-3). The hook makes one answering
  call, `stockOf({ sku })`, built by fulfillment's builder in the server assembly. Payload stores
  no stock, so SYS-12's Scope does not hold, and reads aren't changes, so neither does TX-28.
- **Config needs hooks, hooks need services, services need Payload: a cycle.** Hooks read a
  courier at run time (DRV-3, DRV-6, ASM-4). Assembly: config with courier-reading hooks, then
  `getPayload`, then system builders with `payload`, then `courier.fill(...)`, before any request
  is served (ASM-1, ASM-8).

### shop

- **Checkout returns the client_secret in the same request.** See finding
  `tx-3-breach-checkout-calls-payment-for-client-secret.md`. The server function is a driving
  adapter the framework finds: courier (DRV-3), one acting call (DRV-1).
- **Pay-by-invoice, not for a customer in dunning.** Shop keeps a dunning replica from
  `DunningStageChanged` (TX-26, TX-32, TX-19, as in tx-32-ok). Shop's domain rule `mayPayByInvoice(replica)`
  accepts the lag (TX-27). Its alternative is a read of billing's open host service before the
  transaction (TX-12, TX-25).
- **Checkout copies each line's price, sku, tax class.** These are snapshots on the Order
  (glossary: Snapshot), from `ProductCatalog` (TX-12). The Order schema is in shop's domain
  (DOM-3) and imports `Money` and `Sku` from the shared kernel (DOM-1).
- **Order-confirmation mail once the order commits.** Checkout writes a private
  `SendOrderConfirmation` in its transaction (TX-6, TX-22). The handler calls a `Mailer` port and
  passes the message id as its key where the provider takes one (TX-31, TX-5, see Notes).
- **Calls billing's open host service while holding an ambient transaction.** The transaction
  is not ambient (ASM-9). It is passed to shop's store calls only (TX-1, TX-2). Billing's port
  takes none (TX-25). The call is a read before `transaction.run`.
  ```ts
  const stage = await billing.dunningStageOf({ customerId })   // no tx crosses
  await transaction.run(async (tx) => { /* load, decide, save, outbox */ })
  ```
- **Cart and Order.** Checkout loads the Cart through its repository (SVC-4, TX-23). Clearing
  the cart goes to a private `CartCheckedOut` handler (TX-15).

### payment

- **Stripe behind an anti-corruption layer on the way out.** `PaymentGateway` port, Stripe
  adapter (SVC-7, DVN-4), as in svc-7-ok-payment.
- **Creates a PaymentIntent when shop calls, returns the client_secret in the same call.** See
  finding `tx-22-breach-payment-creates-intent-in-checkout-call.md`. Stripe calls carry the
  payment id as the idempotency key (TX-31).
- **Webhooks: at least once, out of order, Stripe's terms.** A hook in the framework's route
  verifies the signature with `node:crypto` and parses Stripe's payload with payment's own zod
  schema. It doesn't import `stripe` (DRV-8, see Notes). It makes one acting call (DRV-1) with
  `event.id` as message id. The use case claims the id (TX-5), settles by Stripe's current state
  read through the gateway, not by arrival order (TX-19), and writes `PaymentSucceeded` /
  `PaymentFailed` with the Payment's version (TX-6, TX-32). It answers 2xx only on success (DRV-7).
- **Stripe stops resending after three days.** Built as tx-30-ok (TX-30), but one acting call
  per tick (DRV-1): the tick writes one private `SettleOverduePayment` per overdue payment in one
  transaction (TX-1, TX-15). Each handler asks Stripe and saves (TX-23).
- **Refunds when shop asks; not a disputed charge.** Built as tx-34-ok (TX-34, TX-5, TX-1,
  SYS-13, TX-33). The disputed flag and the refund are kept on one Payment aggregate, so a
  concurrent dispute fails the save (TX-24, TX-23). The Stripe refund goes through payment's
  outbox (TX-22) keyed by refund id (TX-31). `PaymentRefunded` follows Stripe's confirmation
  (tx-33-ok). TX-30 covers an absent confirmation.

### billing

- **Invoice on `OrderPaid`, or on `OrderPlaced` for an order paid by invoice.** A handler per
  message claims the id (TX-5). The Invoice is keyed by order id, so the later `OrderPaid` of an
  invoice order finds it and does nothing (TX-19). Lines come from the message (TX-12).
- **VAT from tax class.** `vatRateFor(taxClass)` is a domain function in billing (P2, TST-3).
  The tax class arrives on the order line in shop's published language.
- **Gapless invoice numbers.** An `InvoiceNumbers` aggregate is saved in the same transaction as
  the Invoice (TX-1, TX-24, TX-23). A number is allocated only if the invoice commits.
- **Bank transfers in the bank's terms; some match none.** Bank adapter behind a `BankAccount`
  port translates (SVC-7, DVN-4). A scheduled task makes one acting call (DRV-1) that stores
  transfers by bank transaction id (TX-5) and matches by domain rule. The unmatched are kept as
  `UnmatchedTransfer`. A match writes `InvoicePaid` (TX-6) and leaves the dunning clear to a
  private message (TX-15).
- **Scheduled dunning; stage rises and clears.** The tick writes one private `RunDunning` per
  customer (DRV-1, TX-1). The handler raises `CustomerDunning` (TX-23), writes the reminder mail
  privately (TX-22) and `DunningStageChanged` with its version (TX-32), as in tx-32-ok.
- **Credit note for each refund.** Handler of `PaymentRefunded` as in tx-33-ok (TX-33, TX-17,
  TX-5). A refund for an order with no invoice is billing's domain to decide (see Notes).

### fulfillment

- **Reserve on `OrderPlaced`, release on `OrderCancelled`.** There is one Reservation per order
  id, and Stock per sku is saved with it (SVC-2, TX-24). Insufficient stock is a domain decision
  (see Notes).
- **`OrderPaid`/`OrderCancelled` before `OrderPlaced`; a dropped cancel.** The Reservation keeps
  the highest order version seen (TX-19, TX-32). A cancel ahead of the placement leaves a
  cancelled tombstone, and the later placement reserves nothing. The bus redelivers until ack
  (TX-21, DRV-7). A rule expires a reservation past the order's payment deadline, carried on
  `OrderPlaced` (TX-30).
  ```ts
  // fulfillment/domain/reservation.ts
  export const apply = (r: Reservation | undefined, m: OrderMessage): Reservation =>
    r && r.orderVersion >= m.orderVersion ? r : transition(r, m)
  ```
- **3PL webhooks in the 3PL's terms.** Hook, adapter-side translation, one acting call (DRV-1).
  The status is taken from the 3PL's current state through the `Warehouse` port (TX-19), and
  `ShipmentStatusChanged` carries the Shipment's version (TX-32).
- **Shipping:** built as tx-31-ok (TX-22, TX-31).
- **Article master needs each sku first.** Fulfillment's handler of catalog's `ProductChanged`
  writes `RegisterSku` (TX-22, as tx-29-ok says). Booking waits for the registered sku, and a
  rule decides when it doesn't come (TX-30).
- **Worker with its own entry and assembly.** The worker's assembly builds fulfillment's handlers
  and hands them to its bus (ASM-1). The server's assembly builds only fulfillment's answering
  services for the stock hook.

### common library and shared kernel

- **Pino, OTel tracer.** Imported ready-made (ASM-7). The common library holds no model (ASM-6)
  and imports no system (ASM-5).
- **OTel ambient context, no-op span when empty.** Read by services only for spans, so it changes
  nothing the use case does (ASM-3).
- **Auto-instrumentation before any import.** The entry point loads it via `--import`, ahead of
  assembly. It is plumbing, not a factory of a port.
- **Request id and trace cross; the transaction doesn't.** In-process calls carry them through
  `AsyncLocalStorage`. Messages get them in metadata from the driving adapter's input (ASM-3, see
  Notes). Transactions are explicit only (ASM-9).
- **Relay, bus, Drizzle client factory.** Assembly hands the relay outbox readers and the bus
  handlers (TX-20, TX-21). Clients go to adapters as arguments (ASM-2).
- **Ambient unit of work in `AsyncLocalStorage`.** Dropped (ASM-9). `transaction.run` hands
  `tx` to each store call (TX-1, TX-2).
- **`Money`, `Sku`.** Shared kernel importing only zod (SYS-14), as sys-14-ok.

### The checkout saga

1. **Shop places the order, publishes `OrderPlaced`; fulfillment reserves.** Order and
   `OrderPlaced` are written in one transaction (TX-1, TX-6). The event names no handler (TX-17).
   Fulfillment as above.
2. **Shop calls payment; returns client_secret.** Both findings.
3. **Webhook to payment; `PaymentSucceeded`/`PaymentFailed`.** As under payment.
4. **Shop marks paid, publishes `OrderPaid`; billing invoices, fulfillment ships.** Shop's
   handler as tx-35-ok's paid branch (TX-5, TX-23). Billing and fulfillment as above.
5. **Deadline or `PaymentFailed` cancels; `OrderCancelled`; release.** The deadline sits on the
   Order (TX-30). The tick makes one acting call that writes a private `CancelOverdueOrder` per
   order (DRV-1). Each handler cancels and writes `OrderCancelled` (TX-6) with its version
   (TX-32). Fulfillment releases.
6. **Pay by invoice.** `OrderPlaced` carries `paymentMethod: "invoice"`. Billing and fulfillment
   act on it. Billing matches the transfer and publishes `InvoicePaid`. Shop marks the order paid
   and writes `OrderPaid` (TX-5). The receivers find their work done (TX-19).
7. **Late success after the deadline cancel.** Built as tx-35-ok (TX-35, TX-3, SYS-13, TX-5).

### Cross-cutting reads

- **Admin dashboard joins orders, invoices, shipments in the one Postgres.** Hosted by shop (the
  fixture names no host). Shop keeps replicas of invoices and shipments from billing's and
  fulfillment's events (TX-26), in its own tables. A `BackofficeOverview` query port's adapter
  joins `orders` with them in SQL (SVC-7, TX-12 doesn't hold: "A replica's records are its
  keeper's"). It answers, decides nothing, and doesn't hit TX-27.
- **A Payload edit revalidates the cached shop page.** Shop's handler of `ProductChanged` calls
  a `PageCache` port (SVC-7, TX-5, TX-19). Runs in the Next server process.
- **`/health`, `/metrics`.** Probes, outside the layers. They receive the db client and the
  registry from assembly.

## Existing ok examples that do not hold

Files checked: 14. That is every `-ok-` path distilled.md names: 14 unique paths, re-counted
by extracting them from the file. 55 rules show `*Examples:* —`, which marks them unfinished, so
there is no ok example for every rule.

- `svc-7-ok-order-overview-through-query-port.md`, **TX-1**. The rule is "*Scope:* a use case
  writes. *Statement:* Its service MUST run it in one transaction: open it, hand it to each call
  into its store, commit it." The code answers and writes nothing, so the Scope does not hold.
  The file says so itself ("writes nothing, so it holds no transaction"). Listing TX-1 under
  `satisfies` claims a rule that "says nothing" here.
- `sys-14-ok-money-returns-remainder.md`, **DOM-1**. The rule is "*Scope:* a domain module
  imports a module. *Statement:* The import MUST be one of: another domain module, a shared
  kernel, …". The snippet shows only `shared-kernel/money.ts` and `shop/published/messages.ts`.
  Neither is a domain module, since DOM-1 lists "a shared kernel" apart from "another domain
  module". No domain module's import is shown, so the Scope does not hold in the code. Billing's
  domain importing `Money` appears only in prose.

The other 12 hold for every rule under their `satisfies` and `breaches`, with the reservations in
Notes.

## Notes

- **The TX-22 finding depends on the glossary's tentative operation.** "It changes nothing it asks
  for: its confirmation does." Under one reading, an unconfirmed PaymentIntent changes nothing
  outside payment's store. Then TX-22's Scope ("changes something outside its store") does not
  hold, and the synchronous creation complies. I read it as changing Stripe's record, as tx-30-ok
  does for the cancellation, and as TX-28 does when it treats "recording a tentative operation"
  as a change.
- **Mail and TX-5:** "It MUST be idempotent." The handler that sends a mail can only meet this
  if the mail provider takes an idempotency key (TX-31). The fixture doesn't say whether it does.
  Without one, a crash between send and ack sends a second mail. The same open question applies
  to the 3PL article master's registration call.
- **DOM-3 against SYS-2 and DOM-1.** The statuses are "It MUST be stated once, as a schema in
  the domain", "The modules that declare it MUST NOT import the domain", and DOM-1, which doesn't
  list a system's own published language. So `DunningStageChanged.stage` (tx-32-ok) restates the
  domain's stage values. I couldn't decide whether a published enum is a second statement of the
  business rule or a separate contract. It's no finding: `inDunning: boolean` would avoid it.
- **sys-12-ok and SYS-12:** "The external system's own ways in MUST NOT change it." The price
  stays writable through Payload's Local API, which "overrides access", and shop's repository
  relies on that. I couldn't decide whether the Local API counts as one of Payload's "own ways
  in" or as shop's way of driving it ("It is driven through its API").
- **ASM-3:** "The value MUST NOT change how the use case acts or what it answers." If the outbox
  adapter stamps the ambient trace context onto each message, the written record changes with an
  ambient value. I couldn't decide whether metadata counts as "how the use case acts". The
  driving adapter can pass it as input instead.
- **Unlisted breaches in ok examples.** These are outside task 3's check, since the rules aren't
  listed in the files:
  - **svc-7-ok-payment.** `authorize` creates the PaymentIntent in the call (TX-22, first
    finding). The hook takes `stripe: Stripe` and so imports `stripe`, which DRV-8's list
    doesn't allow.
  - **tx-30-ok.** It runs one transaction per overdue payment inside one use case, and
    `payments.overdue(...)` isn't handed a transaction (TX-1).
  - **sys-13-ok.** On redelivery, `onOrderPlaced` saves `started(orderId)` again, which fails on
    the existing key. The message never acks (TX-5).
  - **sys-12-ok.** `@teeladen/shop/payload#ChangePriceButton` exports a driving adapter from
    shop's export path, which SYS-1's list doesn't allow.
  - **tx-34-ok.** It decides by `payment` (disputed) but saves only `refund` (TX-24 SHOULD).
  - **tx-29-ok.** The server assembly hands `fulfillment.handlers` to its bus, though fulfillment
    "runs in its own worker process". `ProductChanged` carries no version: TX-32, if a later
    product change "overrides an earlier".
- **Not verifiable from code.** In svc-7-ok-payment, TX-5 rests on prose: `SettlePayment` isn't
  shown. In sys-12-ok, SVC-4 rests on prose: the repository isn't shown.
- **Money's shape differs across examples.** It is `{ cents, currency }` in sys-14-ok,
  `amount.amount` in svc-7-ok-payment, and `{ amount, currency: "EUR" }` in sys-12-ok.
- **tx-33-ok, credit note for a refund with no invoice.** For saga step 7, the order was
  cancelled, so billing never invoiced it. `invoices.byOrderId` finds nothing, and the fixture
  says "Issues a credit note for each refund". The domain has to decide. With the code as
  written, the message is never acknowledged.
- **Fulfillment on `OrderPlaced` with too little stock.** "An event says something happened; no
  receiver can refuse it." The fixture doesn't say what fulfillment does. A domain rule of
  fulfillment's is needed, likely under TX-35.
- **ASM-8:** "Assembly MUST fill it before any driving adapter reads it." This holds only if
  Payload's init (`onInit`, seeding) runs no collection hook. The cycle means the courier can be
  filled only after `getPayload`.
