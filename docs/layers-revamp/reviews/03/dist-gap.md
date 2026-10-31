# Gap review, distilled set

## Summary

- **gap-record-meaning-changes-across-deploy**: a stored record changes meaning between releases (shop's `orders.total` starts to include shipping); TX-7 covers messages and cross-process ports only, so nothing keeps records readable across a rolling deploy. P14.
- **gap-bus-acks-message-no-process-subscribes**: a new message reaches a bus whose process has no handler for it yet (catalog's `ProductChanged` before fulfillment's worker is deployed); TX-21 holds only once the bus delivers to a handler, so the message can be marked done and lost. P8.
- **gap-commit-on-ohs-answer**: shop's checkout commits pay-by-invoice on billing's live dunning answer, stale by commit time; TX-27 asks for a business rule on lag only for replicas, TX-24 and SVC-2 only for this system's stored data. P10.
- **gap-aggregate-holds-other-systems-id**: billing's Invoice holds shop's `orderId` and asks shop for lines and tax class at every later use; DOM-4 (id or snapshot) covers aggregates of the same system only. P15, P13.
- **gap-create-by-absence-upsert**: fulfillment creates a Reservation because none exists while a concurrent cancel creates the tombstone; the repository upserts, and TX-23 covers only aggregates loaded through the repository. Stock stays reserved for a dead order. P10.
- **gap-unmatched-bank-transfer**: billing acknowledges a transfer that matches no invoice and records nothing; TX-35 and TX-34 require a business rule to decide only for saga events that report failure and for refused commands. P17.
- **gap-reservation-shortfall-untold**: fulfillment backorders an `OrderPlaced` it cannot fill and tells no one; no rule requires a system to publish that it cannot carry out its part when it learns this from its own records. P17.
- **gap-tentative-call-unkeyed**: payment creates a Stripe PaymentIntent on shop's call without a stable idempotency key; TX-31 asks for a stable key only for a use case called for a message, and TX-36 permits the call without saying how it is keyed. P17, F7.
- **gap-polled-bank-transfers-fresh-ids**: billing pulls bank transfers with an overlapping window and writes one private message per transfer with a fresh id; the message rules key on a delivered message's id, and no rule ties the id to the thing asked for. P9.
- **gap-3pl-webhook-without-id**: the 3PL's webhook carries no event id, so by the glossary it is no message and its hook is no handler; TX-5, TX-19 and DRV-7 do not hold. P9.
- **gap-payload-config-reads-stock-table**: catalog's Payload config reads fulfillment's stock table directly to show stock in the admin; the Assumptions bring only changes (SYS-12) and change notices (TX-29) of an external system's config under the rules. P11, P13.
- **gap-rule-placement-between-systems**: the rule "no pay-by-invoice for a dunned customer" needs billing's state and gates shop's use case, and no rule says which system's domain holds it. DOM-7 assumes the answer and P3 has no rule. P3, P2.

## Findings

### gap-record-meaning-changes-across-deploy.md
```yaml
breaches: []
satisfies: [DOM-3, DOM-7, SVC-4, TX-1, TX-6, TX-23]
situation: shop's Order record changes meaning in a release; processes are replaced one at a time
finding: gap
```
# `orders.total` starts to include shipping; old pods keep writing and reading the old meaning

```ts
// shop/domain/order.ts — release N+1; the shape is stated once, here (DOM-3)
export const orderSchema = z.object({
  id: z.string(), customerId: z.string(), status: z.enum(["placed", "paid", "cancelled"]),
  lines: z.array(orderLineSchema), shippingFee: moneySchema,
  total: moneySchema,                                       // N: sum of lines. N+1: lines + shippingFee
  version: z.number().int(),
})
export const placeOrder = (cart: Cart, customerId: string, shippingFee: Money): Order => ({
  id: cart.id, customerId, status: "placed", lines: cart.lines, shippingFee,
  total: add(sumOfLines(cart.lines), shippingFee),          // N: sumOfLines(cart.lines)
  version: 1,
})
export const refundFor = (order: Order): Money => order.total   // N: add(order.total, order.shippingFee)

// shop/migrations/0042-total-includes-shipping.sql — tooling, run as the deploy starts
// update orders set total_cents = total_cents + shipping_fee_cents;
```
The release moves shipping into `total` and rewrites the stored rows. `OrderPlaced` carries line prices and
no total (as in `sys-14-ok-money-returns-remainder.md`), so no message or port changes. During the rolling
deploy, old pods place orders after the migration has run. Their `total` leaves out shipping, new code
reads it as including shipping, and the customer pays too little. Old pods that refund a late payment on a
migrated order add shipping a second time. Those rows keep the old meaning after the deploy ends, and
nothing tells them apart. The code decided to change a record's meaning in place.

Closest Scopes:
- TX-7, "the schema of a message changes, or of what an open host service's driving port takes, returns or
  raises where code of another process calls it; or a new message or port takes over from another." Not
  held: it names messages and ports, not records, and here neither changes.
- DOM-3, "a business rule about the shape of a record." It holds and is satisfied: the shape is stated once.
  Its statement says where the shape lives, not how the shape may change.
- TX-23, "a repository saves an aggregate that was loaded through it." It holds and is satisfied. It
  catches concurrent writes, not writers that follow different meanings.
- The migration is tooling ("Code that runs in no process of the deployed application"), which the
  Assumptions place outside the rules.

Bears on P14, "A record or a message means the same to all code that reads it, whenever it was written,"
against F4 ("records and messages outlive the code that wrote them"). TX-7 carries P14 for messages, and
nothing carries it for records.

### gap-bus-acks-message-no-process-subscribes.md
```yaml
breaches: []
satisfies: [TX-20, TX-29, TX-22, ASM-1, ASM-5]
situation: fulfillment registers each new SKU with the 3PL; its worker has its own assembly; a deploy replaces processes one at a time
finding: gap
```
# The relay hands `ProductChanged` to a bus that has no handler for it yet, and marks it sent

```ts
// common/relay.ts — common library; assembly hands it the outbox readers (ASM-5)
export const createRelay = ({ readers, bus }: RelayDeps): Relay => ({
  async tick() {
    for (const reader of readers)
      for (const message of await reader.unsent(100)) {
        await bus.publish(message)                    // TX-20: handed to the bus
        await reader.markSent(message.id)
      }
  },
})

// common/bus.ts — durable per-handler queues; the handlers are those this process's assembly handed it
export const createBus = ({ handlers, queues }: BusDeps): Bus => ({
  async publish(message) {
    for (const handler of handlers.filter((h) => h.handles(message.type)))
      await queues.enqueue(handler.name, message)     // kept and redelivered until acknowledged (TX-21)
  },
})

// apps/worker/assembly.ts — release N, still running while the server already runs N+1
const bus = createBus({ handlers: [...fulfillment.handlers], queues })   // N has no ProductChanged handler
const relay = createRelay({ readers: [fulfillment.outboxReader, payloadOutboxReader(payload)], bus })
```
Release N+1 adds catalog's `ProductChanged` written in Payload's transaction (TX-29, as in
`tx-29-ok-catalog-writes-product-changed-in-payload-transaction.md`) and fulfillment's handler that
registers a new SKU. The server deploys first, and an editor creates a product. The relay in the N worker
hands the message to a bus that knows no handler for it. The bus enqueues it nowhere, and the relay marks
it sent. Once the N+1 worker starts, the message is gone, the SKU never reaches the 3PL's article master,
and the first shipment of it fails. The code decided that a message no handler in this process subscribes
to is done.

Closest Scopes:
- TX-20, "the relay reads a message from an outbox." It holds and is satisfied: the relay handed the
  message to the bus.
- TX-21, "the bus delivers a message to a handler." Not held: no handler exists to deliver to.
- DRV-7, "a handler is delivered a message." Not held, for the same reason.
- TX-7, "...or a new message or port takes over from another." Not held: `ProductChanged` takes over from
  nothing. Its statement covers readability, not delivery.
- Assumptions, Not covered: "how the bus finds a message's handlers, by its type or by each handler
  filtering." This covers the mechanism. It does not say whether a message that has no handler yet must be
  kept, and the bus cannot tell "nobody cares" from "the subscriber is not deployed yet."

Bears on P8, "nothing that follows from it is lost after it commits," against F4.

### gap-commit-on-ohs-answer.md
```yaml
breaches: []
satisfies: [TX-12, SVC-7, TX-25, ASM-9, TX-30, DOM-7, TX-1, TX-6, DRV-1]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning; shop calls billing's open host service in-process
finding: gap
```
# Checkout asks billing for the dunning stage, then commits the invoice order on that answer

```ts
// shop/service/ports/dunning-stages.ts — driven port, shop's terms
export type DunningStage = "none" | "dunned"
export interface DunningStages { of(customerId: string): Promise<DunningStage | "unknown"> }

// shop/billing/dunning-stages.ts — driven adapter over billing's open host service, in-process
export const billingDunningStages = (billing: BillingOpenHost): DunningStages => ({
  async of(customerId) {
    try {
      const { stage } = await billing.dunningStageOf({ customerId })
      return stage === "none" ? "none" : "dunned"
    } catch { return "unknown" }
  },
})

// shop/domain/pay-by-invoice.ts — shop's rule, also deciding what "no answer" means (TX-30)
export const mayPayByInvoice = (stage: DunningStage | "unknown"): boolean => stage === "none"

// shop/service/checkout-by-invoice.ts
export const createCheckoutByInvoice =
  ({ transaction, carts, orders, outbox, dunning }: Deps): CheckoutByInvoice =>
  async ({ cartId, customerId }) => {
    const stage = await dunning.of(customerId)                   // billing's answer, before the transaction
    if (!mayPayByInvoice(stage)) throw new PayByInvoiceRefused(customerId)
    return transaction.run(async (tx) => {                       // explicit, not ambient (ASM-9)
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId, { method: "invoice" })
      await orders.save(order, tx)
      await carts.save(clearCart(cart), tx)
      await outbox.write(orderPlaced(order), tx)
      return { orderId: order.id }
    })
  }
```
Billing's scheduled dunning run commits `reminder` for this customer a moment after it answered `none`. Shop
commits a pay-by-invoice order on that stale answer, billing invoices it on `OrderPlaced`, and fulfillment
ships it. A dunned customer received goods on credit, which is what the fixture's rule forbids. The code
decided to commit on another system's answer and accepted nothing about how stale that answer may be.

Closest Scopes:
- TX-27, "a use case decides by a replica." Not held: shop keeps nothing, so there is no replica. Had shop
  kept a replica, a business rule would have to accept the lag. A live answer is just as stale by commit
  time and gets no such rule.
- TX-24, "a use case decides by what this system has stored, other than a replica, and the decision has to
  hold when the use case commits." Not held: billing stores the stage.
- SVC-2, "a use case decides by what this system has stored." Not held, for the same reason.
- TX-12, "a use case of this system reads data another system owns." It holds and is satisfied: the read
  goes through the open host service. Its statement says where to read from, not whether a commit may
  rest on what was read.
- TX-30, "...or waits on another system's answer." It holds on the reading in N6 and is satisfied:
  `"unknown"` refuses. It covers an answer that does not come, not an answer that is stale.

Bears on P10, "A use case commits only on reads that still hold, or on stale ones a business rule
accepts." Catalog's `beforeChange` veto (`tx-28-ok-before-change-hook-vetoes-sku-change.md`) has the same
shape: shop's count of open orders can be stale by the time Payload commits.

### gap-aggregate-holds-other-systems-id.md
```yaml
breaches: []
satisfies: [TX-12, SVC-7, DOM-7, TX-30, TX-5, SVC-4]
situation: billing creates an invoice on OrderPaid; each invoice line needs its VAT rate, which follows from the tax class on the order's line
finding: gap
```
# The Invoice keeps shop's order id and asks shop for lines and tax class whenever it needs an amount

```ts
// billing/domain/invoice.ts
export const invoiceSchema = z.object({
  id: z.string(), number: z.number().int(), orderId: z.string(), customerId: z.string(),
  issuedAt: z.string().datetime(), status: z.enum(["open", "paid"]), version: z.number().int(),
})                                                            // no lines, no amounts: shop has them
export const vatRate = (taxClass: BillingTaxClass): number => (taxClass === "food" ? 7 : 19)
export const amountDue = (lines: readonly BillingLine[]): Money =>
  sum(lines.map((l) => add(l.net, percentOf(l.net, vatRate(l.taxClass)).amount)))

// billing/service/ports/order-lines.ts — driven port, billing's terms, over shop's open host service
export interface OrderLines { of(orderId: string): Promise<readonly BillingLine[] | "unavailable"> }

// billing/service/remind-overdue.ts — the dunning run, one customer per call
export const createRemindOverdue = ({ invoices, orderLines, dunnings, outbox, transaction, clock }: Deps): RemindOverdue =>
  async ({ customerId }) => {
    const overdue = await invoices.overdueOf(customerId, clock.now())
    const lines = await Promise.all(overdue.map((i) => orderLines.of(i.orderId)))   // asks shop, every run
    if (lines.some((l) => l === "unavailable")) return                              // billing's rule: try next run (TX-30)
    await transaction.run(async (tx) => {
      const next = raise(await dunnings.byCustomer(customerId, tx), overdue, lines.flat())   // domain uses amountDue
      await dunnings.save(next, tx)
      await outbox.write(dunningStageChanged(next), tx)
    })
  }
```
The `OrderPaid` handler stores only `orderId`. Every later use of the invoice asks shop for the lines and
their tax class: the PDF, the dunning amount, the bank match. While shop is down, billing cannot remind or
match payments. When shop's open host service drops or renames a field of the lines, billing's issued
invoices break. When shop changes an order after invoicing, the amount of an issued invoice changes with
it. The code decided to hold another system's data as a reference rather than copy it.

Closest Scopes:
- DOM-4, "an aggregate needs something of another aggregate of the same system." It then requires "the
  other's id, or a snapshot." Not held: the order is shop's. No rule makes this choice for an aggregate of
  another system, although the glossary defines Snapshot for exactly this ("projected into this system's
  terms, and keeps unchanged as its own fact").
- TX-27, "a use case decides by a replica," and TX-26, "a replica is written." Neither holds: billing
  keeps no copy.
- TX-12, "a use case of this system reads data another system owns." It holds and is satisfied every time
  billing asks.
- DOM-7, "a business rule of this system." It holds for VAT and dunning, and both sit in the domain. That
  an issued invoice never changes would be a business rule, but the structure here decides it without one.

Bears on P15, "A use case works while other systems are down or slow, unless a business rule needs
another system's answer now": no rule needs shop's answer now, since the lines were known when the invoice
was issued. It also bears on P13. A thin `OrderPaid` (just the order id) is the same decision made on the
message side.

### gap-create-by-absence-upsert.md
```yaml
breaches: []
satisfies: [TX-5, TX-19, TX-24, TX-23, SVC-2, SVC-4, TX-1, DOM-7]
situation: fulfillment reserves on OrderPlaced, releases on OrderCancelled; OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved for a dead order
finding: gap
```
# Two handlers each create the order's Reservation because none exists, and the later commit wins

```ts
// fulfillment/domain/reservation.ts
export type Reservation =
  { orderId: string; status: "held" | "released" | "cancelled-before-placed"; lines: Line[]; version: number }
export const onOrderPlaced = (r: Reservation | undefined, e: OrderPlaced, stock: Stock) =>
  r?.status === "cancelled-before-placed" || r?.status === "released"
    ? { stock, reservation: r }                                         // TX-19: a cancel seen first wins
    : { stock: take(stock, e.lines), reservation: { orderId: e.orderId, status: "held" as const, lines: e.lines, version: 1 } }
export const onOrderCancelled = (r: Reservation | undefined, orderId: string): Reservation =>
  r ? { ...r, status: "released", version: r.version + 1 }
    : { orderId, status: "cancelled-before-placed", lines: [], version: 1 }

// fulfillment/drizzle/reservation-repository.ts — driven adapter
save: async (r, tx) => {
  if (r.version === 1) {                                                // new: nothing was loaded
    await tx.insert(reservations).values(toRow(r))
      .onConflictDoUpdate({ target: reservations.orderId, set: toRow(r) })
    return
  }
  const { rowCount } = await tx.update(reservations).set(toRow(r))
    .where(and(eq(reservations.orderId, r.orderId), eq(reservations.version, r.version - 1)))
  if (rowCount === 0) throw new ConcurrentChange(r.orderId)            // TX-23 for loaded aggregates
},

// fulfillment/service/reserve-stock.ts — for OrderPlaced; release-stock.ts is the same shape for OrderCancelled
(event) => transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const existing = await reservations.byOrderId(event.orderId, tx)     // undefined
  const { stock, reservation } = onOrderPlaced(existing, event, await stocks.current(tx))
  await stocks.save(stock, tx)
  await reservations.save(reservation, tx)
})
```
The two messages arrive at once, at two consumers. Each reads no reservation. The cancel saves the tombstone
and commits. The placement takes the stock and saves `held` over the tombstone, and that commit succeeds as
well. In either arrival order taken one at a time the result is the same (TX-19). Run concurrently, the
fixture's "stock reserved for a dead order" follows. The code decided that saving a new aggregate
overwrites one with the same key.

Closest Scopes:
- TX-23, "a repository saves an aggregate that was loaded through it." Not held: neither use case loaded
  a reservation, because none existed. The Assumptions name the store's ability to fail "where a record
  with the same key exists", but no rule asks for it.
- TX-24, "a use case decides by what this system has stored ... and the decision has to hold when the use
  case commits." It holds and is satisfied to the letter: the data it decides by (the order's reservation)
  belongs to the aggregate it saves. The statement is a SHOULD about where the data sits, not about the
  save failing.
- TX-19, "a use case is called for a delivered message." It holds and is satisfied for each arrival order.
  Overlap is F6, not F5.
- `handled.claim` in every example relies on the same duplicate-key failure, which no rule demands.

Bears on P10, "A use case commits only on reads that still hold." The placement committed on an absence
that no longer held.

### gap-unmatched-bank-transfer.md
```yaml
breaches: []
satisfies: [TX-5, TX-19, DOM-7, SVC-4, TX-1, TX-6, DRV-7]
situation: billing matches bank transfers to open invoices; some match none: a wrong reference, an amount short
finding: gap
```
# A transfer that matches no invoice is acknowledged and leaves no record

```ts
// billing/domain/transfer-matching.ts
export const matchTransfer = (t: Transfer, open: readonly Invoice[]): Invoice | undefined =>
  open.find((i) => i.number === parseReference(t.reference) && equals(i.amountDue, t.amount))

// billing/service/apply-transfer.ts — called for each transfer the bank reports
export const createApplyTransfer = ({ transaction, handled, invoices, outbox }: Deps): ApplyTransfer =>
  (transfer) => transaction.run(async (tx) => {
    if (!(await handled.claim(transfer.bankTransactionId, tx))) return
    const invoice = matchTransfer(transfer, await invoices.openFor(transfer.debtorIban, tx))
    if (!invoice) return                                  // nothing to settle
    await invoices.save(markPaid(invoice, transfer), tx)
    await outbox.write(invoicePaid(invoice), tx)
  })
```
A customer pays invoice 2026-0412 but writes "2026-412". The claim commits, the money sits in the bank
account, and billing has no record of it. The invoice stays open, the dunning run raises the customer, and
shop then refuses them pay-by-invoice. Shop's order is never marked paid, so step 6 of the saga does not
end. A transfer short by one cent ends the same way. The code decided that an unmatched transfer is
nothing.

Closest Scopes:
- TX-35, "a use case is called for an event that tells this system its part of work spanning systems
  cannot go on as it stands." Not held: the report says only that money arrived. Billing concludes from
  its own records that nothing matches, and the event tells it nothing (N7).
- TX-34, "a use case called for a command another system of this codebase sent refuses it." Not held:
  the bank is an external system, and a transfer report is no command.
- TX-38, "a use case called for a delivered message cannot complete, and what stops it is no business
  rule of its system." Not held: billing's own matching rule is what says no match, and the use case
  completes.
- DOM-7, "a business rule of this system." It holds for the matching rule, which is in the domain. It says
  where a rule lives, not that one must exist for the case where nothing matches. `tx-35-breach-late-payment-dropped.md`
  shows that the set does not count an early return as a breach of DOM-7.

Bears on P17, "Work spanning systems ends, and only in a state a business rule allows."

### gap-reservation-shortfall-untold.md
```yaml
breaches: []
satisfies: [DOM-7, TX-24, TX-23, TX-5, TX-19, TX-1]
situation: fulfillment reserves stock on OrderPlaced; the saga is choreographed
finding: gap
```
# Fulfillment backorders what it cannot reserve, and no other system hears of it

```ts
// fulfillment/domain/reservation.ts — fulfillment's rule: what cannot be reserved waits for restock
export const reserve = (stock: Stock, order: OrderPlaced): { stock: Stock; reservation: Reservation } => {
  const short = order.lines.filter((l) => available(stock, l.sku) < l.quantity)
  return short.length === 0
    ? { stock: take(stock, order.lines), reservation: held(order) }
    : { stock, reservation: backordered(order, short) }
}

// fulfillment/service/reserve-stock.ts — called for shop's OrderPlaced
(event) => transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const { stock, reservation } = reserve(await stocks.current(tx), event)
  await stocks.save(stock, tx)
  await reservations.save(reservation, tx)               // no message: nothing happened that others handle
})
```
A tea is out of stock and discontinued. The card customer pays, and shop publishes `OrderPaid`. Fulfillment
finds the order backordered and waits for a restock that never comes. Shop sees a paid order that never
ships and has nothing to handle. The code decided to keep the shortfall to itself. A lost Stripe dispute
has the same shape: payment learns that the money was taken back, publishes nothing, and billing's invoice
stays paid.

Closest Scopes:
- TX-34, "a use case called for a command another system of this codebase sent refuses it." Not held:
  `OrderPlaced` is an event, which "no receiver can refuse" (glossary). In the orchestrated variant
  (`sys-13-ok-checkout-process-sends-receivers-commands.md`) `ReserveStock` is a command, and the refusal
  is published.
- TX-35, "an event that tells this system its part of work spanning systems cannot go on." Not held:
  `OrderPlaced` tells fulfillment nothing of the kind; fulfillment learns it from its own stock.
- TX-38, "...what stops it is no business rule of its system." Not held: fulfillment's own rule stops it.
- TX-30, "this system holds a tentative operation, or waits on another system's answer." Not held:
  fulfillment asked no system for anything, and a supplier's restock is outside the fixture.
- TX-17, "a system publishes an event." It governs how to publish, not whether.

Bears on P17, "Work spanning systems ends." Under choreography, a system that cannot carry out its part
can leave the saga open for everyone else.

### gap-tentative-call-unkeyed.md
```yaml
breaches: []
satisfies: [TX-36, TX-30, SVC-7, DVN-4, TX-1, DRV-1]
situation: payment creates a Stripe PaymentIntent when shop's checkout calls it and returns its client_secret in the same call
finding: gap
```
# Each call creates a new PaymentIntent; a retry after a timeout leaves two live for one order

```ts
// payment/service/create-payment-intent.ts — records nothing; payment's record begins with the webhook
export const createCreatePaymentIntent = ({ gateway }: Deps): CreatePaymentIntent =>
  async ({ orderId, amount, expiresAt }) => {
    const intent = await gateway.createIntent({ amount, reference: orderId, expiresAt })
    return { clientSecret: intent.clientSecret }
  }

// payment/stripe/gateway.ts — driven adapter; no idempotency key
createIntent: async ({ amount, reference }) => {
  const intent = await stripe.paymentIntents.create({ amount: amount.cents, currency: "eur", metadata: { orderId: reference } })
  if (intent.client_secret === null) throw new GatewayError(intent.id)
  return { externalRef: intent.id, clientSecret: intent.client_secret }
},

// shop/service/resume-payment.ts — the order page's "pay now" after checkout's response failed
export const createResumePayment = ({ orders, intents }: Deps): ResumePayment =>
  async ({ orderId }) => {
    const order = await orders.byId(orderId)
    if (!order || order.status !== "placed") throw new NotPayable(orderId)
    return intents.create({ orderId, amount: order.total, expiresAt: order.paymentDeadline })
  }
```
Stripe creates the intent, and the answer is lost on its way back (F7: "fail after it said yes"). Shop's
checkout reports an error, and the customer presses "pay now", which creates a second intent. The first
tab still holds the first `client_secret`. The customer confirms both, is charged twice, and shop receives
two `PaymentSucceeded` events for one order. Payment's deadline rule (TX-30) eventually cancels only
intents nobody confirmed. The code decided that a repeated request for the same tentative operation is a
new one.

Closest Scopes:
- TX-31, "a use case called for a message changes something in an external system that takes an
  idempotency key." It would require "a key ... the same on every message asking for that change". Not
  held: this use case is called by shop's checkout, not for a message.
- TX-36, "a use case asks another system for a tentative operation." It holds, and its MAY permits the
  call. It says nothing about how the call is keyed.
- TX-22, "a use case ... decides a change that the transaction it runs in does not commit." It holds.
  TX-36, the narrower rule, governs, and neither statement mentions a key.
- TX-5, "a use case is called for a delivered message." Not held.

Bears on P17 ("only in a state a business rule allows") against F7. `tx-22-ok-payment-requests-checkout-session.md`
passes `checkout-${orderId}`, but by its own choice: no rule asks for it.

### gap-polled-bank-transfers-fresh-ids.md
```yaml
breaches: []
satisfies: [TX-12, TX-15, TX-1, TX-6, TX-5, TX-39, SVC-7, ASM-2]
situation: the bank API reports incoming transfers in the bank's terms; billing matches them to open invoices
finding: gap
```
# A scheduled import pulls the last two days of transfers and writes a fresh message for each, every run

```ts
// billing/service/import-transfers.ts — called by a scheduled task every 15 minutes
export const createImportTransfers = ({ bank, transaction, outbox, clock }: Deps): ImportTransfers =>
  async () => {
    const transfers = await bank.bookedSince(subDays(clock.now(), 2))      // the bank books late: look back
    await transaction.run(async (tx) => {
      for (const t of transfers)
        await outbox.write(applyTransfer({ id: randomUUID(), transfer: t }), tx)   // private; each applied by a handler (TX-15)
    })
  }

// billing/service/apply-transfer.ts — handler of billing's private ApplyTransfer
(message) => transaction.run(async (tx) => {
  if (!(await handled.claim(message.id, tx))) return                     // TX-5, per message
  const account = await accounts.byReference(message.transfer.reference, tx)
  const next = credit(account, message.transfer)     // domain: pays the oldest open invoice, keeps the rest as balance
  await accounts.save(next, tx)
  for (const m of messagesFor(next)) await outbox.write(m, tx)
})
```
Each transfer stays in the window for two days and is imported about 190 times. Each import writes a new
message with a new id, every claim succeeds, and the customer's balance grows with each run. Every
delivered message is idempotent (TX-5). The repeats are separate messages that ask for the same change.
The code decided that the message id belongs to the import run, not to the bank transaction.

Closest Scopes:
- TX-5 and TX-19, "a use case is called for a delivered message." They hold for `ApplyTransfer` and are
  satisfied: each message is idempotent. They do not reach the earlier step, where one transfer becomes
  many messages.
- TX-31 states the principle, "a key the message carries that is the same on every message asking for
  that change, not only on every delivery of one message". Its Scope, "changes something in an external
  system that takes an idempotency key," does not hold: the change is to billing's own records.
- If the import applied transfers directly, with no message, nothing would be "delivered": Settle names
  only the bus and a hook (N2). TX-5 would not hold either.
- TX-12, "a use case of this system reads data another system owns." It holds and is satisfied: the read
  goes through the bank's API.

Bears on P9, "A repeated delivery changes no record of this system." The bank repeats the transfer on
every call.

### gap-3pl-webhook-without-id.md
```yaml
breaches: []
satisfies: [SVC-7, DRV-8, DRV-1, TX-1, TX-6, TX-32, TX-23]
situation: 3PL webhooks report shipments in the 3PL's terms
finding: gap
```
# The 3PL posts shipment states without an event id; the hook records whatever arrives

```ts
// fulfillment/3pl/webhook.ts — hook; body: { order_ref, state: "DISPATCHED" | "DELIVERED" | "RETURNED", at }
export const threePlWebhook = (recordShipmentState: RecordShipmentState) =>
  async (body: unknown): Promise<{ status: 200 }> => {
    const p = threePlPayloadSchema.parse(body)
    await recordShipmentState({ shipmentId: p.order_ref, state: toShipmentState(p.state) })   // ACL: fulfillment's terms
    return { status: 200 }
  }

// fulfillment/service/record-shipment-state.ts
export const createRecordShipmentState = ({ transaction, shipments, outbox }: Deps): RecordShipmentState =>
  ({ shipmentId, state }) => transaction.run(async (tx) => {
    const shipment = await shipments.byId(shipmentId, tx)
    if (!shipment) throw new UnknownShipment(shipmentId)
    const next = withState(shipment, state)              // domain: the state the 3PL reported, version + 1
    await shipments.save(next, tx)                       // TX-23
    await outbox.write(shipmentStateChanged(next), tx)   // carries next.version (TX-32); shop mails on "dispatched"
  })
```
The 3PL repeats `DISPATCHED`, so a second `ShipmentStateChanged` goes out and the customer gets a second
mail. A late `DISPATCHED` that arrives after `DELIVERED` moves the shipment back to dispatched, and a newer
version publishes that. The code decided that each delivery is new and that the latest one to arrive wins.

Closest Scopes:
- TX-5 and TX-19, "a use case is called for a delivered message." Not held: a message "has an id, the
  same on every delivery of it" (glossary). The 3PL's post has no id, so it is no message (N3).
- DRV-7, "a handler is delivered a message." Not held: a handler "acts on messages", and this hook is
  given none.
- TX-32, "a system writes messages of which a later one overrides an earlier." It holds for fulfillment's
  own messages and is satisfied. The 3PL is not this system, and a correctly rising version only spreads
  the regression further.

Bears on P9, "A repeated delivery changes no record of this system," against F5. P18 speaks only of
"messages" and so does not reach this case either. Stripe's webhooks escape this only because Stripe
sends event ids (`svc-7-ok-payment-reaches-stripe-through-gateway-port.md`).

### gap-payload-config-reads-stock-table.md
```yaml
breaches: []
satisfies: [SYS-12, TX-29]
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
finding: gap
```
# Catalog's config reads fulfillment's stock table from a virtual field

```ts
// catalog/collections/products.ts — catalog's config, an external system's code this codebase writes
import { sql } from "drizzle-orm"

fields: [
  { name: "sku", type: "text", unique: true },
  {
    name: "stock", type: "number", virtual: true, admin: { readOnly: true },
    hooks: {
      afterRead: [
        async ({ siblingData, req }) => {
          const { rows } = await req.payload.db.drizzle.execute<{ available: number }>(
            sql`select on_hand - reserved as available from fulfillment.stock where sku = ${siblingData.sku}`)
          return rows[0]?.available ?? 0
        },
      ],
    },
  },
]
```
Payload's own Postgres client reads fulfillment's table in the shared database. Nothing writes, so there is
no record for SYS-12 to protect. Fulfillment splits `reserved` into `reserved` and `picking`, and the admin
silently shows too much stock. Fulfillment renames the table, and the admin breaks on a change that only
fulfillment made. The code decided that catalog reads another system's records past its published language.
Showing the field is UI and out of scope. Where the value comes from is not.

Closest Scopes:
- The Assumptions bring under the rules only "the parts of its configuration that touch the system: what
  may change the system's records it keeps (SYS-12), how it tells the system of a change (TX-29)."
  Reading is neither (N5).
- SYS-9, "code outside a system reaches it." It holds only if reading a system's records in the shared
  store counts as reaching the system. The glossary says a system "is code", and Reach is defined for
  modules (N4). On that reading it holds and this is a breach, not a gap.
- TX-12, "a use case of this system reads data another system owns." Not held: catalog's config runs no
  use case of a system of this codebase.
- DRV-8 and SVC-7. Not held: this is catalog's code, not a driving adapter of fulfillment. The
  well-governed alternative would be one, calling fulfillment's answering port the way
  `sys-12-ok-shop-price-read-only-in-payload-admin.md` calls shop.

Bears on P11, "No other system ... reads them except through its published language," and on P13.

### gap-rule-placement-between-systems.md
```yaml
breaches: []
satisfies: [DOM-7, TX-26, TX-27, TX-32, TX-5]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: gap
```
# Shop's domain decides which of billing's stages bar pay-by-invoice

```ts
// billing/published/messages.ts — billing's stages, as published
//   DunningStageChanged { customerId, stage: "none" | "reminder" | "second-reminder" | "collection", version }

// shop/domain/dunning-replica.ts — replica from billing's events (TX-26)
export const applyStageChange = (current: DunningReplica | undefined, m: DunningStageChanged): DunningReplica =>
  current && current.version >= m.version ? current : { customerId: m.customerId, stage: m.stage, version: m.version }

// shop/domain/pay-by-invoice.ts — the rule, in shop; it accepts the replica's lag (TX-27)
export const mayPayByInvoice = (r: DunningReplica | undefined): boolean =>
  r === undefined || r.stage === "none"
```
Billing could just as well publish `CreditworthinessChanged { customerId, payByInvoice: boolean, version }`
and keep the rule. Both shapes satisfy every Scope that holds. Billing then introduces payment plans: a
customer in `reminder` who has agreed to a plan may keep buying on invoice. With the rule in shop, a change
to billing's model needs a change to shop's domain. With the rule in billing, shop never notices. The code
decided which system's domain holds a rule that reads one system's state and gates another system's use
case.

Closest Scopes:
- DOM-7, "a business rule of this system." It presumes the rule already belongs to a system. No rule says
  which. The glossary's Owner is defined through rules ("whose business rules decide what a record holds"),
  so it cannot assign them.
- TX-27, "a use case decides by a replica." It holds and is satisfied in the shop-side shape. It governs
  lag, not placement.
- P3 has no rule whose Scope implements it. The examples appeal to it directly
  (`sys-12-breach-shop-price-editable-in-payload-admin.md`: "P3 says the boundary is wrong").

Bears on P3, "Business rules that change together sit together," and on P13.

## Candidates rejected

- **Admin dashboard joins orders, invoices and shipments in one Postgres.** If the dashboard is code of a
  system, as the World Scope's "Code split into systems" implies, TX-12 ("a use case of this system reads
  data another system owns") holds and forbids the join. Code of no system would fall under SYS-9 on the
  N4 reading.
- **`/health` and `/metrics`.** No Scope holds: probes sit outside the layers and no rule names them. The
  fixture's `/health` pings only the store, so no property bears on it. `/metrics` on orders reports on a
  system, so it is no probe but a driving adapter (SVC-7, DRV-8). A probe that also pinged Stripe would
  bear on P15 and is open (N19).
- **Auto-instrumentation loading before any other import.** No Scope holds and no property bears.
- **Order-confirmation mail once the order commits.** TX-22 and TX-6 send it through the outbox. TX-5
  holds for the handler, TX-31 holds if the provider takes a key, and TX-38 forbids committing a claim
  before a failed send. A duplicate mail changes no record of shop's (N12).
- **The dunning run firing twice across a deploy overlap.** DOM-7 puts "a reminder is due" in the domain,
  so a repeated tick finds nothing due. TX-23 catches the overlap.
- **The dunning run over many customers in one transaction.** TX-1 holds, and TX-15 ("writes more
  aggregates of this system than it relies on") hands each customer to a handler.
- **`OrderPaid` reaching billing and fulfillment after they acted on `OrderPlaced` (step 6), one after the
  other.** DOM-7 covers one invoice per order. TX-31's "the same on every message asking for that change"
  covers the 3PL booking. The concurrent case is gap-create-by-absence-upsert.
- **`PaymentRefunded` for an order cancelled before it was invoiced (step 7).** On the broad reading,
  TX-35 holds: billing's part cannot go on. Otherwise DOM-7 holds for the rule "no invoice, no credit
  note".
- **An external system permanently refusing a change a message asked for** (the 3PL rejects an address,
  Stripe refuses to cancel an intent that has succeeded). TX-38 holds ("what stops it is no business rule
  of its system") and requires failing, so the bus redelivers forever. The rule speaks, but it conflicts
  with P17 (N8).
- **A reservation held forever because a cancel was "dropped".** TX-20, TX-21 and DRV-7 keep the cancel,
  and TX-19 applies it in any order. Only the concurrent case is open (gap-create-by-absence-upsert).
- **The sku shape stated in both Payload's config and the shared kernel's `Sku`.** DOM-3 ("a business rule
  about the shape of a record ... stated once") holds unless external configuration is exempt (N5).
- **Request id and trace context crossing systems.** ASM-3 holds for readers, and no property bears.
- **Shop's dunning replica missing customers dunned before it existed.** TX-26 permits a backfill from
  billing's returns, and TX-27 makes a business rule accept the gap.
- **Shop calling billing in-process inside its ambient transaction.** ASM-9, TX-25 and, for acting calls,
  TX-3 cover it.
- **Stock shown in Payload as a field fulfillment writes.** SYS-12 and TX-26 cover it. A direct read is
  gap-payload-config-reads-stock-table.
- **Shop reading Payload's tables with Drizzle instead of the Local API.** TX-12 holds.
- **Stripe webhooks repeated, out of order, or stopping after three days.** Stripe events carry ids, so
  TX-5 and TX-19 hold, and TX-30 covers the three-day cutoff.
- **A refund racing a dispute.** TX-27 covers the dispute state if payment keeps it as a replica, and
  TX-34 covers the refusal.
- **Gapless invoice and credit-note numbers under concurrency.** TX-24 and TX-23 cover them: the counter is
  an aggregate that is loaded and saved.
- **A common-library mailer imported ready-made.** ASM-7 or SVC-7, depending on what "acts" means (N10).
- **Choreography versus orchestration.** The rules are silent (sys-13-ok says so), but the properties do
  not tell the two apart.
- **VAT rates or the payment deadline held as configuration.** DOM-7 and ASM-2 both hold. Which one
  governs depends on an undefined word (N11).
- **The Payload/hooks/services cycle.** DRV-3 and ASM-8 cover it.
- **The shared kernel changing across separately deployed processes.** TX-7 covers messages. Records are
  gap-record-meaning-changes-across-deploy.
- **A bus-level dedupe table in the common library that skips the handler.** TX-21 holds (the bus delivers
  until the handler acknowledges).
- **Booking a shipment before the SKU is registered with the 3PL.** The refusal is transient: TX-38
  retries until registration lands, and TX-30 covers the wait.

## Notes

N1. Paths: distilled.md names 30 example references, 29 of them distinct.
`tx-28-ok-after-change-hook-records-revalidation-request.md` appears twice: under TX-28 as ok and under
TX-29 as a breach. All 29 exist.

N2. I read "delivered" as delivered by the bus or through a hook, because Settle names only those two.
Data a scheduled task pulls is not delivered. gap-polled-bank-transfers-fresh-ids depends on this
reading, and so does part of P9's reach.

N3. I read "It has an id, the same on every delivery of it" (Message) as part of the definition: an input
without a stable id is no message. gap-3pl-webhook-without-id depends on this reading. The fixture does
not say whether the 3PL sends ids.

N4. In SYS-9, "reaches it" is undefined for records. Reach is "what running it reads or calls", but a
System "is code". Whether reading a system's tables in the shared store reaches the system decides
gap-payload-config-reads-stock-table and one branch of the dashboard rejection.

N5. I read the Assumptions' list of an external system's configuration that is inside the rules ("what
may change the system's records it keeps (SYS-12), how it tells the system of a change (TX-29)") as
exhaustive.

N6. I read TX-30's "waits on another system's answer" as including a synchronous call. Read as
asynchronous only, P15 has no rule at all for synchronous calls (shop to billing, shop to payment).

N7. I read TX-35's "an event that tells this system its part ... cannot go on" as the event itself
telling. It does not cover a system that infers this from its own records (gap-unmatched-bank-transfer,
gap-reservation-shortfall-untold).

N8. TX-38's "cannot complete" and "what stops it is no business rule": a permanent refusal by an external
system makes the statement loop forever, against P17. A business rule that classifies the refusal may or
may not take the case out of the Scope; the text does not tell.

N9. "Conforms" (DOM-1, SVC-6, DRV-8 statements): no rule says how a system's conformity to an upstream is
established or recorded, or whether it may differ by direction. The fixture puts Stripe behind an ACL "on
the way out" and says nothing about the webhooks.

N10. In ASM-7 and P5's Except, "output changes neither how a use case acts nor what it answers": it is
undefined whether a side effect (a mail sent, a span exported) counts as acting.

N11. "Configuration value" (ASM-2) is undefined, and so is how it differs from a business rule (DOM-7):
VAT rates, the payment deadline, dunning intervals. ASM-10's "the same in every instance, process and
test" is a third category with an unclear border.

N12. "Idempotent ... leaves the records as performing it once left them" does not say whose records. I
read it, with P9, as this system's records.

N13. Fixture: no system owns a Customer (email, address, locale), yet shop, billing and the mail all need
one. By Owner, the keeper owns it.

N14. Fixture: "The bank API reports incoming transfers" does not say whether by push or by pull.
gap-polled-bank-transfers-fresh-ids picks pull. gap-unmatched-bank-transfer holds either way.

N15. Side observations on examples, not gaps:
- `tx-30-ok-payment-asks-stripe-at-deadline.md` runs one transaction per payment inside one use case,
  while TX-1 says "one transaction" (P7).
- The `ProductChanged` in `tx-29-ok-...` carries no version although a later one overrides an earlier
  (sku, slug). TX-32 holds if catalog's config counts as "a system writes messages", since the Assumptions
  put "how it tells the system of a change" inside the rules.
- `sys-12-ok-...` imports `@teeladen/shop/payload#ChangePriceButton`, a driving adapter's path, which is
  not of shop's offer (SYS-1). Payload's import map needs a path that assembly cannot hand over.
- `tx-22-ok-...` holds a tentative operation but stores nothing, so TX-30's business rule has no record to
  run on.

N16. Rules whose purpose Scope and Statement do not tell:
- DRV-1: why at most one acting call.
- TX-15: "relies on" is undefined.
- TX-37: why deciding again is forbidden, when `tx-28-ok-...`'s handler decides by catalog's committed
  version.
- ASM-10, against ASM-2.
- SYS-15: why the fake gets a path of its own.
- TST-8: a flag, not an edit.

N17. P3 has no rule whose Scope implements it (gap-rule-placement-between-systems). P14 is implemented for
messages (TX-7) but not for records (gap-record-meaning-changes-across-deploy).

N18. TX-23 covers only aggregates that were loaded. The Assumptions name the store's duplicate-key failure,
but no rule requires it, and every example's `handled.claim` silently depends on it.

N19. Probes sit "outside the layers", not outside the rules, yet no rule's Scope holds for them.

N20. The Assumptions' "Not covered: how the bus finds a message's handlers" is read as the mechanism, not
the case where a process has no handler yet (gap-bus-acks-message-no-process-subscribes).

N21. Tooling is outside the rules, so data migrations rewrite records past the domain, the repositories
and the outbox, with no rule speaking (gap-record-meaning-changes-across-deploy).
