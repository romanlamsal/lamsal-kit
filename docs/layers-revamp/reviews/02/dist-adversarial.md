# Adversarial review, distilled set

## Summary

- `dom-1-breach-order-deadline-reads-the-clock.md`: DOM-1, P5. The domain imports nothing off the list and reads the clock through a global, outside any port.
- `dom-3-breach-unit-price-turns-net-in-place.md`: DOM-3, P14. The record's shape is stated once in the domain, then a field's meaning changes in place, and old processes misread new records.
- `svc-7-breach-overview-through-sql-port.md`: SVC-7, P5. The service reaches the store through a port of its system, and that port speaks SQL.
- `svc-3-breach-invoice-number-through-port-over-own-service.md`: SVC-3, P7. The service calls a port whose adapter wraps a sibling service, which commits its own transaction, so a gapless number is spent without an invoice.
- `drv-8-breach-checkout-action-applies-dunning-rule.md`: DRV-8, P4. The driving adapter imports the domain and applies the pay-by-invoice rule itself, so other callers skip it.
- `tx-23-breach-new-reservation-upserted.md`: TX-23, P10. Two use cases create the same aggregate, neither loaded it, the repository upserts, and the cancel is lost.
- `tx-24-breach-reservation-decides-by-stock-snapshot.md`: TX-24, P10. The decision is made on a snapshot inside the saved aggregate, so the Stock it copies is never checked at commit.
- `tx-28-breach-recorded-revalidation-acted-on-unconfirmed.md`: TX-28, P8. The hook's use case only records the request, and its handler acts on it before Payload commits.
- `tx-30-breach-overdue-payment-postponed-forever.md`: TX-30, P17. The business rule that decides when the answer does not come postpones the deadline again.
- `tx-35-breach-refused-refund-asked-again.md`: TX-35, P17. The business rule that decides what follows a refused refund asks for the refund again, without end.
- `tx-7-breach-order-placed-gains-payment-method.md`: TX-7, P14. A new optional field keeps both directions readable, but the message now means something old readers do not act on.
- `tx-17-breach-order-placed-carries-vat-rate.md`: TX-17, P3. The event names no system and is shaped for billing's VAT rule, which now lives in shop.
- `tx-12-breach-shop-reads-billing-outbox-table.md`: TX-12, P13. Shop reads billing's published events straight from billing's outbox table.
- `sys-14-breach-sku-uppercased-by-process-locale.md`: SYS-14, P14. The shared kernel imports only zod and normalizes a sku by the process's locale.

## Findings

### dom-1-breach-order-deadline-reads-the-clock.md

```yaml
breaches: [DOM-1]
satisfies: [SVC-7]
situation: shop's Order holds the payment deadline; once it passes, shop cancels the order
finding: adversarial
```

# Shop's Order schedules and checks its deadline by `Date.now()`

```ts
// shop/domain/order.ts
import { z } from "zod"                                         // a library that computes from its arguments
import { moneySchema } from "@teeladen/shared-kernel/money"     // a shared kernel

export const placeOrder = (cart: Cart, method: PaymentMethod): Order => ({
  id: cart.id, lines: cart.lines, status: "placed", method,
  paymentDeadline: method === "card" ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
})

export const isPastDeadline = (order: Order): boolean =>
  order.paymentDeadline !== null && Date.parse(order.paymentDeadline) < Date.now()

// shop/service/cancel-overdue-orders.ts — the service reaches nothing itself (SVC-7)
for (const order of await orders.open(tx)) if (isPastDeadline(order)) await orders.save(cancel(order), tx)
```

Statement met: every import is "another domain module, a shared kernel, ... a library that computes
from its arguments". `Date` is a global, so nothing is imported. SVC-7's Scope names "a service or a
driving adapter", not the domain.

Property that fails: "**P5.** A system reaches the outside, and is reached from it, only through its
ports". The glossary lists "the clock" under Outside. Shop's domain reaches the clock through no
port. A test of the deadline rule cannot set the time, and step 7 of the saga ("A payment can succeed
after shop's deadline cancelled the order") turns on whichever process's clock runs the check.

### dom-3-breach-unit-price-turns-net-in-place.md

```yaml
breaches: [DOM-3]
satisfies: [DOM-1]
situation: checkout copies each line's price, sku and tax class from catalog's product
finding: adversarial
```

# The order line's `unitPrice` changes from gross to net, and the schema does not change

```ts
// shop/domain/order.ts — before the deploy
export const orderLineSchema = z.object({
  sku: skuSchema, quantity: z.number().int().positive(), taxClass: taxClassSchema,
  unitPrice: moneySchema,                                   // gross, VAT included
})
export const orderTotal = (o: Order) => sum(o.lines.map((l) => times(l.unitPrice, l.quantity)))

// shop/domain/order.ts — after: one schema, still the only statement of the shape
export const orderLineSchema = z.object({
  sku: skuSchema, quantity: z.number().int().positive(), taxClass: taxClassSchema,
  unitPrice: moneySchema,                                   // net, VAT excluded
})
export const orderTotal = (o: Order) => sum(o.lines.map((l) => times(gross(l.unitPrice, l.taxClass), l.quantity)))
```

Statement met: "It MUST be stated once, as a schema in the domain." TX-7's Scope covers "the schema of
a message" and of an open host service's driving port, not a record, so no rule asks the change to
keep old records readable with the same meaning.

Property that fails: "**P14.** A record or a message means the same to all code that reads it,
whenever it was written", against F4: "A deploy replaces processes one at a time, and records and
messages outlive the code that wrote them." During the rollout, an old server process loads an order
the new worker saved and charges its net prices as gross. A new process loads orders placed before
the deploy and adds VAT on top of prices that already include it.

### svc-7-breach-overview-through-sql-port.md

```yaml
breaches: [SVC-7]
satisfies: [SVC-1, SVC-6, ASM-2]
situation: the customer's account page lists their orders with line count and total
finding: adversarial
```

# Shop declares a driven port that takes SQL, and the service writes the query

```ts
// shop/service/ports/sql.ts — a driven port, declared in shop's service layer (SVC-1)
export interface Sql {
  query<T>(text: string, params: readonly unknown[]): Promise<T[]>
}

// shop/service/order-overview.ts — answering use case
import type { Sql } from "./ports/sql"                        // a port declared in its service layer (SVC-6)

export const createOrderOverview =
  ({ sql }: { sql: Sql }): OrderOverview =>                    // received from its caller (ASM-2)
  ({ customerId }) =>
    sql.query<OrderOverviewRow>(
      `select o.id as "orderId", o.status, count(l.id)::int as "lineCount", o.total
         from orders o left join order_lines l on l.order_id = o.id
        where o.customer_id = $1 group by o.id`,
      [customerId],
    )

// shop/drizzle/sql.ts — driven adapter
export const drizzleSql = (db: Database): Sql => ({ query: async (text, params) => (await db.$client.query(text, params)).rows })
```

Statement met: "It MUST do so through a port of its system." `Sql` is shop's port, declared in shop's
service layer.

Property that fails: "**P5.** ... each port speaks the system's terms", against F1: "A store ... is
replaced". Table names, column names and Postgres's dialect sit in the service. A fake `Sql` has to
parse SQL. Replacing the store, or renaming a column, changes the use case. The glossary says only
the driving port speaks "in the system's terms, not its store's"; SVC-7 asks for a port, not one in
the system's terms.

### svc-3-breach-invoice-number-through-port-over-own-service.md

```yaml
breaches: [SVC-3]
satisfies: [TX-1, TX-25, DVN-4, ASM-2, TX-5]
situation: billing creates an invoice on shop's OrderPaid; invoice numbers are gapless
finding: adversarial
```

# Billing's issue-invoice draws its number through a port whose adapter is billing's own allocate service

```ts
// billing/service/ports/invoice-numbers.ts — driven port
export interface InvoiceNumbers { next(): Promise<InvoiceNumber> }

// billing/service/allocate-invoice-number.ts — acting use case, its own transaction
export const createAllocateInvoiceNumber = ({ counters, transaction }: AllocateDeps): AllocateInvoiceNumber =>
  () => transaction.run(async (tx) => {
    const counter = await counters.load("invoice", tx)
    await counters.save(advance(counter), tx)
    return counter.next
  })

// billing/adapters/invoice-numbers.ts — driven adapter; imports nothing, receives a function (DVN-4, ASM-2)
export const invoiceNumbersVia = (allocate: () => Promise<InvoiceNumber>): InvoiceNumbers => ({ next: allocate })

// billing/service/issue-invoice.ts — called for OrderPaid
export const createIssueInvoice = ({ handled, invoices, invoiceNumbers, transaction }: IssueDeps): IssueInvoice =>
  (event) => transaction.run(async (tx) => {
    if (!(await handled.claim(event.id, tx))) return
    const number = await invoiceNumbers.next()                // a port, not a service
    await invoices.save(issueInvoice(number, event), tx)
  })

// apps/worker/assembly.ts
const allocate = createAllocateInvoiceNumber({ counters, transaction })
const issueInvoice = createIssueInvoice({ handled, invoices, transaction, invoiceNumbers: invoiceNumbersVia(allocate) })
```

Statement met: "It MUST NOT call that service." Issue-invoice calls `InvoiceNumbers`, a driven port.
Assembly is "the only place where port and implementation meet", and it wires the allocate service
behind the port.

Property that fails: "**P7.** A use case's writes to its own system's records land together or not at
all", against F4. Allocate commits number 1042 in its own transaction. Then issue-invoice's
transaction fails: the process stops, or `OrderPaid` is redelivered while the first attempt still
runs and its claim fails at commit (F5). The counter moved, no invoice carries 1042, and the gapless
sequence has a gap.

### drv-8-breach-checkout-action-applies-dunning-rule.md

```yaml
breaches: [DRV-8]
satisfies: [DRV-1, DRV-3, DRV-6, SVC-7]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: adversarial
```

# The checkout server action asks the dunning stage and applies the domain's rule before placing the order

```ts
// app/checkout/actions.ts — shop's server action (driving adapter)
"use server"
import { mayPayByInvoice } from "@teeladen/shop/domain"         // its system's domain (DRV-8)
import { courier } from "@teeladen/common/courier"               // the common library (DRV-8)

export async function checkoutAction(input: CheckoutInput) {
  const { dunningStageOf, placeOrder } = courier.read()          // read when it runs (DRV-6)
  if (input.paymentMethod === "invoice") {
    const stage = await dunningStageOf({ customerId: input.customerId })   // answering call
    if (!mayPayByInvoice(stage)) return { ok: false, reason: "invoice not offered" }
  }
  return placeOrder(input)                                        // the one acting call (DRV-1)
}

// shop/service/place-order.ts — places whatever method it is handed
export const createPlaceOrder = ({ orders, outbox, transaction }: Deps): PlaceOrder =>
  (input) => transaction.run(async (tx) => {
    const order = placeNewOrder(input)
    await orders.save(order, tx)
    await outbox.write(orderPlaced(order), tx)
  })
```

Statement met: "The import MUST be one of: ... a driving port of its system, its system's domain, ...
the common library". Both driving ports and the domain function are on that list.

Property that fails: "**P4.** A use case responds the same whoever calls it and whatever serves it",
against F1: "a new caller arrives: a CLI command, a webhook, a test." A support CLI or an agent's new
tool that calls `placeOrder` with `paymentMethod: "invoice"` places an invoice order for a customer
in collection. The rule lives in the domain, but the domain does not decide this use case: the
adapter does.

### tx-23-breach-new-reservation-upserted.md

```yaml
breaches: [TX-23]
satisfies: [SVC-4, TX-1, TX-5, TX-19]
situation: OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved for a dead order
finding: adversarial
```

# Placed and cancel both find no reservation, both create one, and the repository upserts the new one

```ts
// fulfillment/drizzle/reservation-repository.ts
save: async (r, tx) => {
  if (r.loadedVersion === undefined)                                   // created, not loaded: TX-23 says nothing
    await tx.insert(reservations).values(toRow(r))
      .onConflictDoUpdate({ target: reservations.orderId, set: toRow(r) })
  else
    await saveIfVersion(tx, r)                                         // loaded: fails if changed (TX-23)
},

// fulfillment/service/reserve-stock.ts — called for OrderPlaced
transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const existing = await reservations.byOrderId(event.orderId, tx)    // null: the cancel has not committed
  if (existing?.status === "cancelled") return
  await reservations.save(reserve(event.orderId, event.lines), tx)
})

// fulfillment/service/release-stock.ts — called for OrderCancelled
transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const existing = await reservations.byOrderId(event.orderId, tx)    // null: the placed has not committed
  await reservations.save(existing ? release(existing) : cancelledBeforePlaced(event.orderId), tx)
})
```

Statement met: "The save MUST fail where the aggregate has changed in the store since it was loaded."
Its Scope is "a repository saves an aggregate that was loaded through it". Neither aggregate was
loaded, so the rule says nothing. Each use case is idempotent, and run one after the other, either
order ends cancelled.

Property that fails: "**P10.** A use case commits only on reads that still hold", against F6: "Two use
cases can run against the same records at once." Both read "no reservation". The cancel commits
`cancelled`, then the placed commits over it with `reserved`. Neither fails, and the stock stays
reserved for a dead order.

### tx-24-breach-reservation-decides-by-stock-snapshot.md

```yaml
breaches: [TX-24]
satisfies: [DOM-4, SVC-2, SVC-4, TX-1, TX-23]
situation: fulfillment reserves stock on OrderPlaced
finding: adversarial
```

# The reservation copies what is available into a snapshot and decides by it; Stock is read, never saved

```ts
// fulfillment/domain/reservation.ts
export const reservationSchema = z.object({
  orderId: z.string(), sku: skuSchema, quantity: z.number().int().positive(),
  availableWhenReserved: z.number().int(),                     // snapshot of Stock (DOM-4)
  status: z.enum(["reserved", "refused"]),
})
export const reserveAgainst = (draft: Omit<Reservation, "status">): Reservation =>
  ({ ...draft, status: draft.availableWhenReserved >= draft.quantity ? "reserved" : "refused" })

// fulfillment/service/reserve-stock.ts — called for OrderPlaced
transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const stock = await stocks.bySku(line.sku, tx)               // read
  const held = await reservations.sumReserved(line.sku, tx)    // read
  const reservation = reserveAgainst({ orderId: event.orderId, sku: line.sku, quantity: line.quantity,
                                       availableWhenReserved: stock.onHand - held })
  await reservations.save(reservation, tx)                     // the only aggregate saved
})
```

Statement met: "The data it decides by SHOULD belong to aggregates the use case saves." The decision
reads `availableWhenReserved`, a snapshot the Reservation holds "as its own fact", and the use case
saves the Reservation. The service enforces the decision itself (SVC-2). TX-23 guards only the
Reservation, which is new.

Property that fails: "**P10.** A use case commits only on reads that still hold", against F6. Two
orders for the last three units run at once. Each copies "3 available" into its snapshot, each
reserves three, and both commit, because nothing about Stock is saved. Fulfillment has promised six
units of three.

### tx-28-breach-recorded-revalidation-acted-on-unconfirmed.md

```yaml
breaches: [TX-28]
satisfies: [DRV-3, DRV-6, TX-25, TX-5, DRV-7]
situation: an editor saves a product in Payload's admin; an afterChange hook asks shop to revalidate the cached product page
finding: adversarial
```

# The hook's use case only records the request; its handler revalidates and publishes without waiting for Payload's commit

```ts
// shop/payload/hooks/product-changed.ts — shop's hook, in catalog's config
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc }) => {
    await courier.read().requestPageRevalidation({ productId: doc.id, slug: doc.slug })
    return doc
  }

// shop/service/request-page-revalidation.ts — records the request, nothing else
export const createRequestPageRevalidation = ({ outbox, transaction }: Deps): RequestPageRevalidation =>
  (input) => transaction.run((tx) => outbox.write(revalidateProductPage(input), tx))     // private message

// shop/service/revalidate-product-page.ts — called by shop's handler of RevalidateProductPage
export const createRevalidateProductPage = ({ handled, pages, outbox, transaction }: Deps): RevalidateProductPage =>
  (message) => transaction.run(async (tx) => {
    if (!(await handled.claim(message.id, tx))) return
    await pages.revalidate(`/products/${message.slug}`)
    await outbox.write(productPageChanged({ productId: message.productId, slug: message.slug }), tx)   // published
  })
```

Statement met: "The use case it calls MUST NOT change this system beyond recording a tentative
operation." The hook's use case writes one private message, as in
`tx-28-ok-after-change-hook-records-revalidation-request.md`. The Statement binds "the use case it
calls", not the handler of what it records.

Property that fails: "**P8.** An uncommitted write is not yet a fact: nothing final follows from it
before it commits", against F4. Shop's transaction commits at once, the relay hands the message on,
and the handler runs while Payload's save is still open. The page rebuilds from the old price. When
a later hook rolls the save back, `ProductPageChanged` is already published about an edit that never
happened.

### tx-30-breach-overdue-payment-postponed-forever.md

```yaml
breaches: [TX-30]
satisfies: [SVC-7, TX-1, TX-5]
situation: Stripe stops resending a webhook after three days
finding: adversarial
```

# Payment's business rule for an overdue answer is to wait another hour

```ts
// payment/domain/payment.ts
export const isOverdue = (p: Payment, now: Date) => p.status === "pending" && new Date(p.answerDueBy) < now
export const whenAnswerOverdue = (p: Payment, now: Date): Payment =>
  ({ ...p, answerDueBy: new Date(now.getTime() + 60 * 60_000).toISOString() })   // business rule: give Stripe another hour

// payment/service/settle-overdue-payments.ts — called by a scheduled task every five minutes
export const createSettleOverduePayments = ({ payments, transaction, clock }: Deps): SettleOverduePayments =>
  async () => {
    for (const payment of await payments.overdue(clock.now()))
      await transaction.run((tx) => payments.save(whenAnswerOverdue(payment, clock.now()), tx))
  }
```

Statement met: "A business rule of this system MUST decide what happens when the confirmation or answer
does not come." `whenAnswerOverdue` is that rule, in payment's domain.

Property that fails: "**P17.** Work spanning systems ends, and only in a state a business rule
allows", against F7. The webhook endpoint is down for a weekend, and Stripe stops resending on
Monday. The card was charged and the payment stays `pending` forever, pushed back hour after hour.
Shop cancels the order and fulfillment releases the stock, while the money sits with Stripe.

### tx-35-breach-refused-refund-asked-again.md

```yaml
breaches: [TX-35]
satisfies: [TX-34, SYS-13, TX-3, TX-5, TX-6]
situation: a payment succeeds after shop's deadline cancelled the order; payment does not refund a disputed charge
finding: adversarial
```

# Shop's rule for a refused refund is to ask for the refund again

```ts
// shop/domain/order.ts
export const onRefundRefused = (order: Order): RefundOutcome =>
  ({ order, refund: { orderId: order.id, amount: order.paidAmount } })    // business rule: the money goes back

// shop/service/apply-refund-refused.ts — called for payment's RefundRefused
import { refundPayment } from "@teeladen/payment/published"               // payment's command (SYS-13)

(event) => transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const order = await orders.byId(event.orderId, tx)
  const outcome = onRefundRefused(order)
  await orders.save(outcome.order, tx)
  await outbox.write(refundPayment(outcome.refund), tx)                   // a new command, a new id
})
```

Statement met: "A business rule of its system MUST decide what follows." The event is exactly the
Scope's "a command it sent was refused". Payment publishes `RefundRefused` as TX-34 asks, as in
`tx-34-ok-refund-refusal-published.md`.

Property that fails: "**P17.** Work spanning systems ends". The charge stays disputed. Payment refuses,
shop's rule asks again, payment refuses again, and each turn commits under a new message id. TX-5
dedupes nothing, and the two systems trade commands and refusals without end.

### tx-7-breach-order-placed-gains-payment-method.md

```yaml
breaches: [TX-7]
satisfies: [TX-17, TX-6, SYS-14]
situation: checkout starts offering pay-by-invoice; billing invoices and fulfillment ships on OrderPlaced for it
finding: adversarial
```

# `OrderPlaced` gains an optional `paymentMethod`; absent reads as card

```ts
// shop/published/messages.ts
export const orderPlacedSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderPlaced"), orderId: z.string(),
  lines: z.array(orderPlacedLineSchema),
  paymentMethod: z.enum(["card", "invoice"]).optional(),     // new; old messages lack it and mean card
})

// billing/service/on-order-placed.ts — before the change, still running in billing's old processes
(event) => { /* card orders are invoiced on OrderPaid; nothing to do here */ }

// billing/service/on-order-placed.ts — after
(event) => event.paymentMethod === "invoice" ? issueInvoice(event) : undefined
```

Statement met: "The change MUST keep what old code writes readable by new code, and what new code
writes readable by old code, each field keeping its meaning." Old billing parses new messages and
ignores the extra field. New billing reads a missing field as card, which is what it always meant.
No field changes its meaning.

Property that fails: "**P14.** A record or a message means the same to all code that reads it,
whenever it was written". To new billing, `OrderPlaced` with `invoice` means "invoice now". To billing
and fulfillment processes not yet replaced, it means "wait for `OrderPaid`". Shop's deadline does not
apply to the order, no invoice is issued, so no `InvoicePaid` and no `OrderPaid` follow. The order
waits for good (P17 too).

### tx-17-breach-order-placed-carries-vat-rate.md

```yaml
breaches: [TX-17]
satisfies: [TX-6, SYS-2, SYS-14]
situation: each invoice line needs its VAT rate, which follows from the tax class on the order's line
finding: adversarial
```

# Shop's `OrderPlaced` carries the VAT rate per line, computed by shop

```ts
// shop/domain/vat.ts
export const vatRateFor = (taxClass: TaxClass): number => (taxClass === "tea" ? 0.07 : 0.19)

// shop/published/messages.ts — no system named
export const orderPlacedLineSchema = z.object({
  sku: skuSchema, quantity: z.number().int().positive(), unitPrice: moneySchema,
  vatRate: z.number(),                                       // what an invoice line needs
})

// shop/service/place-order.ts
await outbox.write(orderPlaced(order, order.lines.map((l) => ({ ...l, vatRate: vatRateFor(l.taxClass) }))), tx)

// billing/domain/invoice.ts
export const invoiceLineFrom = (l: OrderPlacedLine) => ({ ...l, vat: percentOf(l.unitPrice, l.vatRate * 100) })
```

Statement met: "Its code MUST NOT name a system that handles it." Nothing in shop names billing.

Property that fails: "**P3.** Business rules that change for different reasons share nothing either
would have to change", against F2. The VAT rate is an invoicing rule, and it now sits in shop's domain
and shop's published language. When the rate for tea changes, shop changes its model and its
published event, though nothing about selling changed. TX-7 then binds the change to the published
schema too.

### tx-12-breach-shop-reads-billing-outbox-table.md

```yaml
breaches: [TX-12]
satisfies: [SVC-7, DVN-4]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: adversarial
```

# Shop reads the latest `DunningStageChanged` straight from billing's outbox table

```ts
// shop/service/ports/dunning-stages.ts — driven port, shop's terms
export interface DunningStages { of(customerId: string): Promise<DunningStage> }

// shop/drizzle/dunning-stages.ts — driven adapter
import { dunningStageChangedSchema } from "@teeladen/billing/published"   // the export path of an upstream (DVN-4)
const billingOutbox = pgTable("billing_outbox", { id: uuid("id"), type: text("type"), payload: jsonb("payload"), writtenAt: timestamp("written_at") })

export const drizzleDunningStages = (db: Database): DunningStages => ({
  of: async (customerId) => {
    const [row] = await db.select().from(billingOutbox)
      .where(and(eq(billingOutbox.type, "DunningStageChanged"), sql`${billingOutbox.payload}->>'customerId' = ${customerId}`))
      .orderBy(desc(billingOutbox.writtenAt)).limit(1)
    return row ? dunningStageChangedSchema.parse(row.payload).stage : "none"
  },
})
```

Statement met: "It MUST read it from the owner's open host service or from its published events." The
rows are billing's published events, parsed with billing's published schema.

Property that fails: "**P13.** A system changes its model without its downstream systems changing",
against F8. Billing's outbox is where messages "wait until they are delivered". When billing's relay
deletes delivered rows, renames the table or moves its outbox to a broker, shop's read finds nothing.
It answers `"none"`, and a customer in collection pays by invoice.

### sys-14-breach-sku-uppercased-by-process-locale.md

```yaml
breaches: [SYS-14]
satisfies: [DOM-1, SYS-10]
situation: fulfillment's worker registers each new SKU in the 3PL's article master; shop's server places orders by sku
finding: adversarial
```

# The shared kernel's `Sku` normalizes with `toLocaleUpperCase()`

```ts
// shared-kernel/sku.ts
import { z } from "zod"                                       // a library that computes from its arguments

export const skuSchema = z.string().trim().min(1).transform((s) => s.toLocaleUpperCase()).brand<"Sku">()
export type Sku = z.infer<typeof skuSchema>
```

Statement met: "The import MUST be one of: another module of the same published language or shared
kernel, a shared kernel, a library that computes from its arguments." Zod is the only import.
`toLocaleUpperCase()` with no argument reads the process's default locale, an ambient value set "per
process", and no import list sees it. ASM-3's Scope names a service or driven adapter, not a shared
kernel.

Property that fails: "**P14.** A record or a message means the same to all code that reads it". Shop's
server runs under `en_US` and parses `chai-mint-1` from catalog as `CHAI-MINT-1`. Fulfillment's worker
runs under `tr_TR` and parses the same `OrderPlaced` line as `CHAI-MİNT-1`. It then registers that
sku with the 3PL and reserves stock under a sku no product carries.

## Rules that held

- DOM-4: an id or a snapshot. The snapshot attack lands on TX-24, not here.
- SVC-1: I found no harm that declaring the port elsewhere would prevent. The port-in-store-terms attack goes to SVC-7.
- SVC-6: every way around it I tried goes through a listed import, and the harm then lands on SVC-7 or SVC-3.
- SVC-2: enforcing in the acting call, by stored data, combined with TX-23 and TX-24, held. See Notes for the adapter-decides reading.
- SVC-4: a write outside the repository is a plain breach, and writes of non-aggregate records did no harm I could show.
- DRV-1: a second acting call is a plain breach. Answering calls plus one acting call put the harm on DRV-8.
- DRV-3, DRV-6, ASM-4, ASM-8: courier misuse I tried, such as caching after the first read or reading in non-adapters, did no harm a property names.
- DRV-7: held, except for the "succeeded" reading in Notes.
- DVN-4: what it lets through I could only show as a harm under TX-12.
- ASM-1, ASM-2, ASM-10, ASM-7, ASM-5, ASM-6: no attack showed a property failing.
- ASM-3: held within its Scope. The attacks around it went through the domain and the shared kernel (DOM-1, SYS-14).
- ASM-9: held, except for the "transaction" reading in Notes.
- TX-1, TX-2, TX-25, TX-6, TX-20, TX-21: every way around them I tried breaches one of them plainly, or TX-22.
- TX-3, TX-22: writing through the outbox held. Disguised commands land on TX-17 or SYS-13.
- TX-15, TX-29: SHOULDs with no attack worth an ADR.
- TX-31: a key the message carries, chosen badly, did no harm to P9.
- TX-5: idempotence by stored state gets caught by TX-19.
- TX-19: commutative-counter attacks broke TX-19 itself for the other order's use case.
- TX-32: the version, rising per aggregate, held. Wall-clock versions do not "rise" across processes and so are a plain breach.
- TX-33, SYS-13: subscribing and declaring held, per their examples.
- TX-34: held. Publishing a refusal that cannot be correlated is too contrived to show.
- TX-26, TX-27: P10 accepts "stale ones a business rule accepts", so any rule that accepts satisfies the property too.
- SYS-1, SYS-9: an exported system builder that returns repositories is caught by TX-3 and TX-12.
- SYS-10, SYS-2: held.
- SYS-12: held as far as I can judge Payload. See Notes.

## Rules whose purpose the text does not tell

- TST-3, TST-10, TST-4, TST-5, TST-6, TST-8, TST-12, TST-11, TST-7: no property or force speaks of tests. I guessed P6 for TST-4, TST-6 and TST-8, and F3 for the rest.
- SVC-1: I guessed P5. Where a port's declaration sits changes nothing the properties name.
- ASM-1: I guessed P4 against F1, one wiring per process.
- ASM-10: I guessed F3, so that a reader sees the dependency.
- ASM-5, ASM-6: I guessed P2 and P3, no model in plumbing.
- DRV-1: I guessed P7, one request's writes in one use case's transaction.
- DRV-6: I guessed ASM-8's order, a courier read before assembly fills it. I could not tie it to a property.
- SYS-10: I guessed P13. Its likely harm, a browser bundle pulling in system code, is out of the world's scope.
- TX-33: I guessed P13, the sender of a command not becoming its upstream.

## Notes

- SVC-2: the drv-8 finding hangs on "*Scope:* a use case decides by what this system has stored". In
  the snippet no use case decides; the adapter does. If the Scope reads as "a decision is made by
  stored data", the finding is a plain breach of SVC-2 rather than an adversarial one on DRV-8.
- DRV-7: "It MUST NOT acknowledge it unless the use case it calls has succeeded." The text does not
  say what "succeeded" means. A use case that catches TX-23's conflict and returns `{ ok: false }` has
  returned without committing. If returning counts as success, the handler acknowledges, and
  `PaymentSucceeded` is lost. I left it out because `tx-34-ok-refund-refusal-published.md` calls a
  return "succeeded" only for a return that commits.
- ASM-9: "It MUST NOT be an ambient value." The fixture keeps "a unit of work ... ambient" and has shop
  call billing's open host service "while holding its own ambient transaction". If an ambient
  connection with BEGIN issued, or a unit of work holding the transaction, does not count as "a
  transaction", billing's calls join shop's transaction and P16 fails. I could not show a write by
  billing that TX-3 would not catch first, so it is not a finding.
- SYS-12: "The external system's own ways in MUST NOT change it." Whether Payload's version restore,
  duplicate, or catalog's own collection hooks write a field that has `access.update: () => false`
  depends on Payload internals I cannot check from these files.
- DOM-3 against TX-7: P14 covers "a record or a message", and TX-7's Scope names only messages and
  open host service ports. I filed the record case under DOM-3, the rule whose Scope holds. It may
  belong to TX-7 as a gap in its Scope.
- TX-24: the finding hangs on "The data it decides by SHOULD belong to aggregates the use case saves".
  A snapshot belongs to the aggregate that holds it (glossary: "keeps as its own fact"), so copying
  data into the saved aggregate meets the Statement.
- TX-35 and TX-30 accept any business rule. The findings show the two that never end; a rule that ends
  badly ("keep the money") still satisfies P17's "only in a state a business rule allows".
