# Gap review, raw set

## Summary

- `gap-order-line-holds-catalog-document.md`: DOM-4 reaches only aggregates "of the same system", so nothing decides what shop's Order may hold of catalog's product: the whole document, untranslated, or a snapshot.
- `gap-pay-by-invoice-asks-billing-live.md`: a decision made on another system's data read live through its open host service, stale by commit, falls between TX-24 (own stored data) and TX-27 (replica), and no rule asks a business rule to accept it (P10).
- `gap-sku-veto-races-checkout.md`: catalog's beforeChange vetoes by shop's count while checkout copies catalog's sku. Each side decides on the other's data in its own transaction, and no Scope reaches the race (P10).
- `gap-record-schema-change-across-deploy.md`: TX-7 covers messages and cross-process ports, not records, so an old process can load an Order written by new code, drop the new field and save it back (P14).
- `gap-invoice-order-waits-on-no-answer.md`: a pay-by-invoice order waits on billing's `InvoicePaid` without having asked billing anything. Under TX-30's "answer" that is no waiting TX-30 reaches, and nothing ends it (P17).
- `gap-bank-transfers-polled-not-delivered.md`: transfers billing polls from the bank are no delivered message, so TX-5, TX-19, TX-35 and TX-38 do not hold. A transfer reported twice is recorded twice, and an unmatched one is left to no rule (P9, P17).
- `gap-outside-effect-repeats-unaccepted.md`: P9's "a business rule allows the repeat" has no Statement. A parked message retried after the external system's key window acts twice, and TX-37 forbids the guard (P9).
- `gap-payload-admin-reads-fulfillment-stock.md`: code in catalog's configuration reads fulfillment's stock table directly. It is no use case (TX-12), imports nothing (SYS-9), and is not on the Assumptions' list of configuration inside the rules (P11).
- `gap-product-changed-declared-per-reader.md`: a message an external system's configuration writes has no declaring home, so shop and fulfillment each restate `ProductChanged`'s schema (P14).
- `gap-order-paid-two-meanings-in-billing.md`: step 6 makes shop's `OrderPaid` mean two things inside a conformist billing, and no rule carries P19.

## Findings

### gap-order-line-holds-catalog-document.md
```yaml
breaches: []
satisfies: [DOM-1, TX-12, SVC-4, TX-1, DVN-4]
situation: checkout copies each line's price, sku and tax class from catalog's product
finding: gap
```
# The order line keeps catalog's whole product document
```ts
// catalog/src/product-document.ts — catalog's config package, which this codebase writes: the document the Local API returns
export const productDocumentSchema = z.object({
  id: z.string(), slug: z.string(), title: z.string(),
  price: z.number().int().positive(), sku: z.string(), taxClass: z.enum(["tea", "accessories"]),
  layout: z.array(layoutBlockSchema), seo: seoSchema.optional(), updatedAt: z.string().datetime(),
})
export type ProductDocument = z.infer<typeof productDocumentSchema>

// shop/src/domain/order.ts — shop conforms to catalog: the document, untranslated, copied at placement
import { productDocumentSchema, type ProductDocument } from "@teeladen/catalog/product-document"
import { type Money, times } from "@teeladen/kernel"

export const orderLineSchema = z.object({ quantity: z.number().int().positive(), product: productDocumentSchema })
export type OrderLine = z.infer<typeof orderLineSchema>
export const placeLine = (product: ProductDocument, quantity: number): OrderLine => ({ quantity, product: structuredClone(product) })
export const lineTotal = (line: OrderLine): Money => times({ amount: line.product.price, currency: "EUR" }, line.quantity)

// shop/src/adapters/payload/catalog-products.ts — driven adapter over the Local API
export const payloadCatalogProducts = (payload: Payload): CatalogProducts => ({
  byId: async (id) => productDocumentSchema.parse(await payload.findByID({ collection: "products", id })),
})
```
The code decided that each Order record holds another system's record whole, in that system's
terms, frozen at placement. Every stored order carries catalog's document in the shape it had
that day.

- DOM-4, *Scope:* "an aggregate needs something of another aggregate of the same system." Does
  not hold: the product is catalog's. The glossary defines a Snapshot ("projected into this
  system's terms"), but no Statement asks for one across systems.
- DOM-1, *Scope:* "the domain reaches past itself." Holds and is satisfied: "the published
  language of an upstream its system conforms to". It bounds where the import comes from, not
  how much of the other system's record the aggregate keeps.
- TX-12, *Scope:* "a use case of this system reads data another system owns." Holds and is
  satisfied: the read goes through catalog's API. Its question is the read, not the copy.
- TX-7, *Scope:* "the schema of a message changes, or of what an open host service's driving port
  takes, returns or raises …". An order record is neither.

Properties: P14. An order written under one version of catalog's document is read after catalog's
config adds a required block for its editors, and it stops parsing. P13 and P3 seen from catalog:
an editor-facing change in catalog's config reaches shop's model and its records. P12 lets shop
conform, but what the copy keeps is left open. Under an anti-corruption layer DOM-1 forces the
projection, so the gap exists only for a conformist (N5).

### gap-pay-by-invoice-asks-billing-live.md
```yaml
breaches: []
satisfies: [TX-12, SVC-7, ASM-2, DOM-7, TX-30, TX-1]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning; shop calls billing's open host service in-process
finding: gap
```
# Checkout asks billing for the dunning stage, then commits on the answer
```ts
// shop/src/service/ports/dunning-stages.ts — driven port; assembly hands in billing's open host service, in-process today
import type { DunningStage } from "@teeladen/billing"          // shop conforms to billing
export interface DunningStages { of(customerId: string): Promise<DunningStage> }

// shop/src/domain/payment-method.ts
export const mayPayByInvoice = (stage: DunningStage | "unanswered"): boolean => stage === "none"   // billing silent: no invoice

// shop/src/service/checkout.ts
export const createCheckout =
  ({ transaction, carts, orders, outbox, dunning }: CheckoutDeps): Checkout =>
  async ({ cartId, customerId, paymentMethod, locale }) => {
    if (paymentMethod === "invoice") {
      const stage = await dunning.of(customerId).catch((): "unanswered" => "unanswered")
      if (!mayPayByInvoice(stage)) throw new PayByInvoiceRefused(customerId)
    }
    return transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId, paymentMethod)
      await orders.save(order, tx)
      await carts.save(clearCart(cart), tx)
      await outbox.write(orderPlaced(order), tx)                    // paymentMethod: "invoice"
      await outbox.write(sendOrderConfirmation(order, locale), tx)
      return { orderId: order.id }
    })
  }
```
The code decided that the pay-by-invoice check rests on billing's stage, read live before shop's
transaction opens, and that nothing keeps that stage from changing until shop commits. Billing's
dunning run raises the customer to "reminder" between `of` and the commit, and shop commits an
invoice order for a customer in dunning.

- TX-27, *Scope:* "a use case decides by a replica." Does not hold: shop keeps no copy, and
  billing answers live.
- TX-24, *Scope:* "a use case decides by what this system has stored, other than a replica, and
  the decision has to hold when the use case commits." Does not hold: the stage is stored by
  billing, not by shop.
- SVC-2, *Scope:* "a use case decides by what this system has stored." Does not hold, for the
  same reason.
- TX-12 holds and is satisfied: the read goes through the owner's open host service.
- TX-30, *Scope:* "this system … waits on another system's answer." Holds for the call (N3) and
  is satisfied by `mayPayByInvoice("unanswered")`. It covers billing staying silent, not billing's
  answer going stale.

Property: P10, "A use case commits only on reads that still hold, or on stale ones a business rule
accepts." A stale replica is TX-27's and a stale read of shop's own store is TX-24's. A live read
of another system falls between them, and no rule asks a business rule to accept it. Checkout's
copy of catalog's price is the same case: an editor raises it between the read and shop's commit.

### gap-sku-veto-races-checkout.md
```yaml
breaches: []
satisfies: [TX-28, DRV-1, DRV-3, TX-25, TX-12]
situation: catalog's beforeChange asks shop how many open orders carry a sku and refuses to change a sku one does; checkout copies the sku
finding: gap
```
# The veto counts before Payload commits; checkout copies the old sku in between
```ts
// catalog/collections/products.ts — catalog's config; beforeChange runs inside the editor's save (req.transactionID)
beforeChange: [
  async ({ data, originalDoc }) => {
    if (!originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data
    const { openOrders } = await shop.openOrdersWithSku({ sku: originalDoc.sku })   // shop's hook, reads the courier
    if (openOrders > 0) throw new APIError("This sku is on an open order.", 409)
    return data
  },
],

// shop/src/service/count-open-orders-with-sku.ts — answering use case, outside Payload's transaction
export const createCountOpenOrdersWithSku =
  ({ openOrders }: { openOrders: OpenOrdersQuery }): CountOpenOrdersWithSku =>
  async ({ sku }) => ({ openOrders: await openOrders.countWithSku(sku) })

// shop/src/service/checkout.ts — reads the product through the Local API, then commits shop's order
const products = await Promise.all(cart.lines.map((line) => catalog.byId(line.productId)))   // sku "TEA-00042", still committed
await transaction.run(async (tx) => {
  const order = placeOrder(cart, products, customerId)                                       // each line copies the sku
  await orders.save(order, tx)
  await outbox.write(orderPlaced(order), tx)
})
```
The race runs in three steps:

1. An editor saves a change from TEA-00042 to TEA-00043. `beforeChange` counts 0 open orders.
2. Checkout reads the product while Payload's save is uncommitted, so it still sees TEA-00042. It
   commits an open order carrying that sku.
3. Payload commits the change.

An open order now carries a sku catalog no longer has, which is the state the veto exists to
prevent. The code decided that each system decides by the other's data in its own transaction and
leaves the interleaving to chance.

- TX-28, *Scope:* "an external system calls a hook before its change commits." Holds and is
  satisfied: shop's use case changes nothing.
- TX-24, *Scope:* "a use case decides by what this system has stored …". Does not hold. The code
  that decides is catalog's `beforeChange`, an external system's. Shop's answering use case decides
  nothing. Checkout decides by catalog's product, which shop does not store.
- TX-27 and SVC-2 do not hold: there is no replica, and the deciding code is catalog's.
- TX-25, *Scope:* "a system declares a driving port." Holds and is satisfied. It is also why the
  count cannot run in Payload's transaction, so the lock in the one shared Postgres that would close
  the race is ruled out, and nothing replaces it.
- The Assumptions keep two parts of an external system's configuration inside the rules: "what may
  change the system's records it keeps (SYS-12), how it tells the system of a change (TX-29)". A
  veto by this system's data is neither.

Property: P10. Two commits, each on a read the other has made stale, and no business rule accepts
either.

### gap-record-schema-change-across-deploy.md
```yaml
breaches: []
satisfies: [SVC-4, TX-23, TX-1, TX-2, DOM-3]
situation: fulfillment runs in its own worker process; shop's handlers and shop's open host service run in processes deployed apart from the web process
finding: gap
```
# The Order gains a field; an old process loads it, drops it, saves it back
```ts
// shop/src/domain/order.ts — this deploy adds a gift message to the Order
export const orderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  status: z.enum(["placed", "paid", "cancelled"]),
  customerId: z.string(),
  lines: z.array(orderLineSchema).min(1),
  paymentDeadline: z.string().datetime().nullable(),
  giftMessage: z.string().max(200).optional(),          // new
})

// shop/src/adapters/drizzle/order-repository.ts — the Order kept whole in one jsonb column
export const createDrizzleOrderRepository = (): OrderRepository => ({
  byId: async (id, tx) => {
    const [row] = await asDrizzleTx(tx).select().from(orders).where(eq(orders.id, id))
    return row ? orderSchema.parse(row.document) : null                 // zod strips keys this build does not know
  },
  save: async (order, tx) => {
    const next = { ...order, version: order.version + 1 }
    const result = await asDrizzleTx(tx).update(orders).set({ version: next.version, document: next })
      .where(and(eq(orders.id, order.id), eq(orders.version, order.version)))
    if (result.rowCount === 0) throw new OrderChangedSinceLoad(order.id)
  },
})
```
The code decided that a record's shape changes in place, with no rule for processes still running
the old build. The web process, on the new build, places an order with a gift message. The worker
process still runs the old build: shop's `PaymentSucceeded` handler, and shop's open host service,
which the worker builds in-process as in `asm-1-ok-fulfillment-worker-one-assembly.md`. The old
handler loads the order, zod strips `giftMessage`, and `markPaid` saves the whole order. The version
matches, so the save succeeds and the gift message is gone. A migration that renames a column while
old processes run fails the same way.

- TX-7, *Scope:* "the schema of a message changes, or of what an open host service's driving port
  takes, returns or raises where code of another process calls it; or a new message or port takes
  over from another." Records are not named.
- TX-23 holds and is satisfied: the version is compared. It catches a concurrent change, not a
  write by code that cannot see the field.
- SVC-4 (save whole) and DOM-3 (one schema) hold and are satisfied, and both make the loss
  complete.

Property: P14, verbatim: "An old process saves back a record the new code wrote and drops what it
does not know." Its Against names F4.

### gap-invoice-order-waits-on-no-answer.md
```yaml
breaches: []
satisfies: [DOM-7, TX-5, TX-17, TX-6]
situation: checkout saga step 6, paid by invoice; shop's deadline does not apply
finding: gap
```
# A pay-by-invoice order stays placed until an InvoicePaid that may never come
```ts
// shop/src/domain/order.ts
export const placeOrder = (id: string, cart: Cart, customerId: string, method: PaymentMethod, placedAt: Date): Order =>
  orderSchema.parse({
    id, customerId, lines: cart.lines, status: "placed", paymentMethod: method,
    paymentDeadline: method === "card" ? new Date(placedAt.getTime() + 30 * 60_000).toISOString() : null,   // fixture: no deadline
  })
export const isPastDeadline = (order: Order, now: Date): boolean =>
  order.status === "placed" && order.paymentDeadline !== null && new Date(order.paymentDeadline) < now

// shop/src/driving/handlers.ts — the only way out of "placed" for an invoice order
InvoicePaid: async (message: InvoicePaid) => { await markOrderPaid({ messageId: message.id, orderId: message.orderId }) },
```
The code decided that an invoice order ends only by billing's event. The customer never pays.
Billing's dunning rises to "collection" and billing publishes `DunningStageChanged` for the
customer and nothing for the order. Shop's order stays placed for good. Catalog's veto counts it as
open, so its sku can never change again.

- TX-30, *Scope:* "this system holds a tentative operation, or waits on another system's answer."
  Does not hold under N3. Shop requested nothing: `OrderPlaced` is an event, and "no receiver can
  refuse it" (glossary: Message). Billing invoiced on its own reading of that event, and
  `InvoicePaid` answers no question shop asked. Card orders show the contrast: there shop asks
  payment for a PaymentIntent, TX-30 holds, and the deadline is its business rule.
- TX-35, *Scope:* "a use case is called for an event that tells this system its part of work
  spanning systems cannot go on as it stands." No such event comes. `DunningStageChanged` tells of
  a customer's stage, not of shop's part.
- TX-21 keeps a message until it is acknowledged, but nobody writes one.

Property: P17, "Waiting on another system's answer is a state too, and it ends like any other: in
one a business rule allows." Fulfillment's reservation has the same shape: it waits for `OrderPaid`
or `OrderCancelled` without having asked for either. There TX-21 (no dropping) and shop's TX-30
deadline bound the wait, so the fixture's "dropped cancel" can only be a parked one.

### gap-bank-transfers-polled-not-delivered.md
```yaml
breaches: []
satisfies: [TX-1, TX-2, TX-12, TX-23, SVC-7, DRV-1, DOM-7]
situation: the bank API reports incoming transfers in the bank's terms; billing matches them to open invoices; some match none
finding: gap
```
# A scheduled import records each reported transfer under billing's own id
```ts
// billing/src/service/import-bank-transfers.ts — called by a scheduled task every five minutes
export const createImportBankTransfers =
  ({ transaction, bank, cursors, transfers, invoices, outbox, ids }: Deps): ImportBankTransfers =>
  async () =>
    transaction.run(async (tx) => {
      const since = await cursors.bank(tx)
      const page = await bank.transfersSince(since)                     // driven port; its adapter translates the bank's terms
      for (const reported of page.transfers) {
        const invoice = await invoices.openByReference(reported.reference, tx)
        const outcome = matchTransfer(invoice, reported)                // domain: paid | unmatched (wrong reference, amount short)
        await transfers.save(transferRecord(ids.next(), reported, outcome), tx)   // billing's id; the bank's is not kept
        if (outcome.kind === "paid") {
          await invoices.save(outcome.invoice, tx)
          await outbox.write(invoicePaid(outcome.invoice), tx)
        }
      }
      await cursors.saveBank(page.next, tx)
    })
```
The bank answers "since" inclusively, which is what it offers (F9). The next run gets the last
transfer of the page again. Its invoice is now paid, so `matchTransfer` finds none open and records
a second transfer as "unmatched". Billing's handling of unmatched money then pays it back to a
customer who paid once. The code decided that billing recognizes a reported transfer by nothing. It
also decided that an unmatched transfer is recorded and nothing follows.

- TX-5 and TX-19, *Scope:* "a use case is called for a delivered message." Do not hold. The use
  case is called by the clock. What the bank returns answers billing's own call: no message
  ("What one system tells another … so that it may act", glossary).
- TX-26, *Scope:* "a replica is written." Does not hold: a record under billing's ids is no
  replica ("kept under the owner's ids", glossary: Replica).
- TX-35 ("called for an event that tells …") and TX-38 ("called for a delivered message cannot
  complete") do not hold either. Nothing requires a business rule to say what follows an
  unmatched transfer.
- TX-12 holds and is satisfied: the bank's data comes from its API. TX-23 holds and is satisfied:
  overlapping runs fail on the cursor's or the invoice's version. TX-30 holds for the call and is
  met by billing's rule that a run the bank does not answer moves no cursor.

Properties: P9 (its Against names F9: a repeated report changes a record), P18, and P17 for the
unmatched transfer. N4 covers the reading.

### gap-outside-effect-repeats-unaccepted.md
```yaml
breaches: []
satisfies: [TX-5, TX-22, TX-31, TX-37, DRV-7, TX-21]
situation: shop sends an order-confirmation mail; fulfillment books shipments with the 3PL; a parked message is retried after the external system's key window
finding: gap
```
# The idempotency key expires while the message is parked
```ts
// shop/src/service/send-order-confirmation.ts — called by shop's handler of its private SendOrderConfirmation
export const createSendOrderConfirmation =
  ({ mailer }: { mailer: MailSender }): SendOrderConfirmation =>
  async (message) => {
    await mailer.send(renderOrderConfirmation(message, message.locale), { idempotencyKey: message.orderId })
  }

// fulfillment/src/service/book-shipment.ts — called by fulfillment's handler of its private BookShipment
export const createBookShipment =
  ({ warehouse, shipments, transaction }: Deps): BookShipment =>
  async ({ shipmentId, lines, address }) => {
    const booking = await warehouse.book({ lines, address }, { idempotencyKey: shipmentId })   // the 3PL keeps keys for 24 h
    await transaction.run((tx) => shipments.recordBooking(shipmentId, booking.ref, tx))
  }
```
The 3PL books the parcel, but its answer times out. The use case fails and the bus backs off and
parks the message (TX-21). The outage is fixed two days later and the parked message is retried.
The 3PL has forgotten the key and books a second parcel. The mail goes out twice the same way. The
code decided that a repeat outside the key window is simply made.

- TX-5 holds and is satisfied. Idempotence is about records: `recordBooking` records one booking,
  and the mail writes nothing. A second parcel is no record of fulfillment's.
- TX-31 holds and is satisfied: the key comes from the message, and it is "the same on every
  message asking for that change". Its Why notes the window ("a message parked longer … acts again
  when it is retried"); its Statement does not reach past it.
- TX-37 holds and is satisfied, and it shuts the one guard left: the use case may not decide again
  "by the state of its records", such as a booking or a sent mail already recorded.

Property: P9, "Where an effect outside can repeat, a business rule allows the repeat." No Statement
asks for that business rule. Nothing in fulfillment's domain says a second parcel is allowed, and
nothing in shop's says a second mail is. The same holds for a 3PL that takes no key at all (TX-31's
Scope then fails).

### gap-payload-admin-reads-fulfillment-stock.md
```yaml
breaches: []
satisfies: []
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
finding: gap
```
# A field in catalog's admin reads fulfillment's stock table
```tsx
// catalog/collections/products.ts — catalog's config, which this codebase writes
{ name: "stock", type: "ui", admin: { components: { Field: "@teeladen/catalog/admin#StockField" } } },

// catalog/admin/stock-field.tsx — a server component Payload's admin renders; same Postgres
import type { Payload } from "payload"
import { sql } from "drizzle-orm"

export const StockField = async ({ data, payload }: { data: { sku: string }; payload: Payload }) => {
  const { rows } = await payload.db.drizzle.execute<{ available: number }>(
    sql`select on_hand - reserved as available from fulfillment_stock where sku = ${data.sku}`)
  return <output>{rows[0]?.available ?? "–"}</output>
}
```
The code decided that editors read fulfillment's records past fulfillment's published language.
When fulfillment renames `reserved` or splits it by order status, the admin breaks at runtime.
Fulfillment's rule for what counts as available is bypassed. The compliant path exists: a hook
calling an answering driving port of fulfillment through the courier, under DRV-8 and DRV-3. Nothing
requires it.

- TX-12, *Scope:* "a use case of this system reads data another system owns." Does not hold: the
  field is code of catalog, an external system, not a use case of a system of this codebase.
- SYS-9, *Scope:* "code outside a system reaches it." Does not hold under N1: the field imports
  nothing of fulfillment and reads its records by a string.
- DRV-8, *Scope:* "a driving adapter reaches past itself." Does not hold: the field calls no
  driving port and adapts no caller to one.
- SYS-12, *Scope:* "a record this system owns is kept by an external system." Does not hold: stock
  is kept in fulfillment's own tables.
- The Assumptions keep catalog's configuration inside the rules only where it decides "what may
  change the system's records it keeps (SYS-12), how it tells the system of a change (TX-29)". A
  read is neither.

Property: P11, "No other system … reads them except through its published language."

### gap-product-changed-declared-per-reader.md
```yaml
breaches: []
satisfies: [TX-29, TX-6, DRV-8, TX-5]
situation: Payload's transaction writes a document to a collection of its own, which the relay reads; shop revalidates the page, fulfillment registers new skus
finding: gap
```
# Catalog's config writes ProductChanged; each reader declares its own schema
```ts
// catalog/collections/products.ts — catalog's config writes the message in the editor's transaction (TX-29)
afterChange: [async ({ doc, previousDoc, req }) => {
  await req.payload.create({ collection: "outbox", req,
    data: { type: "ProductChanged", productId: doc.id, slug: doc.slug, sku: doc.sku, previousSku: previousDoc?.sku ?? null } })
  return doc
}],

// shop/src/driving/handlers/product-changed.ts
const productChangedSchema = z.object({ type: z.literal("ProductChanged"), productId: z.string(), slug: z.string() })

// fulfillment/src/driving/handlers/product-changed.ts
const productChangedSchema = z.object({
  type: z.literal("ProductChanged"), productId: z.string(), sku: z.string(), previousSku: z.string().nullable().default(null),
})
```
The code decided that the message's shape is stated three times: once by the writer's object
literal and once by each reader. Catalog's config renames `previousSku` to `skuBefore`. Shop's
handler is unaffected. Fulfillment's handler defaults the missing field to null, reads every change
as a new sku, and asks the 3PL to register skus it already has.

- SYS-2 ("a system declares its published language") and SYS-1 ("a system exports a path …") do not
  hold: catalog's "exports … are its own" (Assumptions). The glossary counts the events catalog
  publishes as its published language, but no rule gives that language a home.
- DOM-3, *Scope:* "a business rule about the shape of a record." Does not hold: a message is no
  record, and DOM-3's Why puts published schemas outside it.
- TX-7, *Scope:* "the schema of a message changes." Has no single schema to bind: the writer
  declares none, and each reader's is its own.
- DRV-8 holds and is satisfied: each handler reaches its own module.

Property: P14, "A record or a message means the same to all code that reads it." For a system of
this codebase, SYS-1, SYS-2 and SYS-13 put the one declaration on the owner's export path. For an
external system's message written by this codebase, nothing does.

### gap-order-paid-two-meanings-in-billing.md
```yaml
breaches: []
satisfies: [DOM-1, DOM-7, TX-5, TX-19]
situation: checkout saga step 6: shop publishes OrderPaid, which billing has already acted on for an invoice order
finding: gap
```
# In billing, "paid" means a captured card, an echo of billing's own InvoicePaid, and a settled invoice
```ts
// billing/src/domain/invoicing.ts — billing conforms to shop: OrderPlaced and OrderPaid untranslated
import type { OrderPaid, OrderPlaced } from "@teeladen/shop"

export const onOrderPlaced = (existing: Invoice | null, m: OrderPlaced, number: InvoiceNumber): Invoice | null =>
  m.paymentMethod === "invoice" && existing === null ? issue(m, number, "open") : null
export const onOrderPaid = (existing: Invoice | null, m: OrderPaid, number: InvoiceNumber): Invoice | null =>
  existing === null ? issue(m, number, "paid") : null      // card: invoice now, born paid; invoice order: our own InvoicePaid, echoed
export const isPaid = (invoice: Invoice): boolean => invoice.status === "paid"   // billing's own: money on our account
```
The code decided that billing takes shop's term as it is. Inside billing, `OrderPaid` now means
"Stripe captured the card, invoice now" for card orders. For invoice orders it means "the invoice
we issued was settled and shop heard of it". Next to both stands billing's own `paid`. A change
made for one meaning breaks code written for another. Shop starts publishing `OrderPaid` for a
partial payment by invoice, `onOrderPaid` finds the invoice existing and ignores it, and the reader
of `onOrderPaid` cannot tell which meaning the branch serves.

- DOM-1 holds and is satisfied: billing conforms, so shop's published language is on its list.
- DOM-7 holds and is satisfied: the decision is in the domain.
- TX-5 and TX-19 hold and are satisfied.
- No rule's Scope is a term of a system. P19 ("Within one system, each term has one meaning") is
  carried by no Statement. P12 lets billing conform, but nothing weighs that choice against P19
  when the upstream's term already means two things.

Property: P19.

## Candidates rejected

- Payload's config needs the hooks, the hooks need services, the services need the Payload
  instance: DRV-3 ("a driving adapter assembly cannot construct, or cannot hand what it calls when
  it constructs it"), ASM-4, ASM-8.
- Editors' rules in Payload's collection config (price above zero, sku unique): the Assumptions put
  an external system's own rules about its own records outside the rules. DOM-7's Why places them.
- Whose business rule the sku veto is: the glossary's Owner and the fixture ("catalog … owns … sku")
  make it catalog's. DOM-7's Why says otherwise (N13), but the Why binds nobody.
- Catalog's beforeChange and afterChange hooks inside Payload's transaction: TX-28 and TX-29.
- Shop reads the product through the Local API: TX-12, DVN-4 and SVC-7 hold. The holding of what
  it reads is gap 1.
- Stock written onto Payload's product document by fulfillment: SYS-12 ("a record this system owns
  is kept by an external system"). Stock shown through a hook calling fulfillment's answering port:
  DRV-8 and DRV-3.
- Checkout returns `client_secret` in the same request: TX-36 ("a use case asks another system for
  a tentative operation"). See N14.
- Order-confirmation mail once the order commits: TX-22, TX-37, TX-31, TX-5. Repeats past the key
  window are gap 7.
- Shop calls billing's open host service holding its ambient transaction: ASM-9 ("a transaction")
  and TX-25.
- Stripe behind an anti-corruption layer on the way out, webhooks in Stripe's terms: SVC-6 decides
  whether Stripe's types reach the service (N12). The bank's and the 3PL's terms work the same way,
  under SVC-6 and DVN-4.
- Stripe webhooks repeated and out of order: TX-5 and TX-19, which hold for hooks per TX-5's Why,
  and DRV-7. An unknown intent: TX-38. Stripe stops after three days: TX-30.
- A refund refused for a disputed charge: TX-34. A credit note per refund: TX-33.
- VAT rate from the tax class: DOM-7 (billing's rule). SYS-14 keeps catalog's tax class enum out of
  shop's published language.
- Dunning stage raised and cleared out of order: TX-32, TX-19, TX-27. Overlapping dunning runs in
  several web processes: TX-23 and TX-24.
- `OrderCancelled` before `OrderPlaced`: TX-19. A dropped cancel: TX-21 forbids dropping, and
  shop's card deadline is TX-30's. The invoice-order wait is gap 5.
- Registering a new sku with the 3PL before shipping: TX-22, TX-37, TX-38. The booking that fails
  on an unknown article is retried.
- A payment that succeeds after shop's deadline cancelled the order: TX-35.
- `OrderPaid` for an invoice order reaching billing and fulfillment, which have already acted:
  whether to act again is a business rule (DOM-7, TX-19). The term is gap 10.
- The deadline scheduled task cancelling many orders: DRV-1 and TX-1, with TX-15 possibly relieving
  them (N18).
- The upstream's fake used by downstream tests, with no contract suite: shop's driven port has the
  fake and, as its real implementation, payment's service handed in. Glossary: "Driven adapters.
  Implementations of driven ports." So TST-6's Scope holds for the downstream. Relies-on R7 remains.
- Retention of handled-message ids: TX-5's MUST admits no window, so purging breaches it.
- Several relays over one outbox: TX-20 and TX-5.
- OpenTelemetry's no-op span, the auto-instrumentation preload, and request id and trace context
  crossing systems: ASM-7, ASM-3, ASM-9, TX-25. Where the preload sits bears on no property:
  telemetry changes no outcome.
- `/health` and `/metrics`: these are probes (glossary). The Assumptions put probes outside the
  layers, and what stays open bears on no property (N6).
- The admin dashboard: still open, recorded as `gap-admin-dashboard-belongs-to-no-system.md` (N6).

## Relies-on findings

- **R1. TX-37, TX-3, TX-15, TX-20, TX-21 rely on TX-5: "a repeated delivery changes nothing."** TX-5
  guarantees that the use case is idempotent, and the glossary defines Idempotent as leaving "the
  records as performing it once left them, and answers as the first did". That covers records and
  answers, not effects outside the store. TX-37's use case exists to make a change "the transaction
  it runs in does not commit", so for it the line promises exactly what TX-5 leaves out (gap 7).
- **R2. TX-19 relies on TX-32: "messages of one system of which a later one overrides an earlier
  carry a version of what they tell of."** TX-32 binds a system of this codebase. The Assumptions
  put external systems outside the rules. TX-19's Scope ("a use case is called for a delivered
  message") includes hooks per TX-5's Why: Stripe's events and the 3PL's shipment reports override
  each other and carry no version any rule guarantees. Catalog's `ProductChanged` is open too.
- **R3. TX-22 and TX-15 rely on TX-6: "a message about a change commits in the transaction that
  commits the change."** TX-6's Scope is "a use case writes a message about a change it makes". A
  TX-22 message asks for a change the use case does "not make … itself". TX-15's message hands over
  a write the use case leaves to a handler. Neither is a change the writer makes. TX-1 carries the
  commit, not TX-6. TX-3's command to another system's handler is arguably the same case.
- **R4. TX-37 relies on TX-31: "by default, a use case called for a message passes the external
  system a key the message carries."** TX-31's Scope adds "an external system that takes an
  idempotency key". For the 3PL without a key (`tx-22-breach-claim-rolled-back-after-3pl-call.md`)
  nothing passes one, and "by default" accounts for the SHOULD, not the Scope.
- **R5. DOM-1 relies on SYS-10 ("loading a path that exports a system's published language loads
  no module of that system outside its published language") and on SYS-14.** Both bind systems of
  this codebase. DOM-1 admits "the published language of an upstream its system conforms to",
  which includes external upstreams. Catalog's generated Payload types and Stripe's types come from
  packages that neither rule bounds.
- **R6. SVC-6 relies on SYS-1: "an upstream exports nothing but its offer."** SVC-6 lists "the
  published language of an external system it conforms to", and its Why says "its package takes
  that place". An external system's package (`stripe`, `payload`) exports its whole client, and
  SYS-1 does not bind it.
- **R7. TST-11 relies on TST-6: "one contract suite is written against the port and run against
  the fake and the real adapter."** TST-6's Scope is "a driven port has a fake and a real adapter".
  It binds each downstream's driven port, so it puts a suite on each downstream, if anywhere. It
  does not give "the upstream's contract suite", which TST-11's Why counts on ("passes the
  upstream's contract suite once").
- **R8. SVC-2 relies on DRV-8: "a driving adapter reaches no driven port, driven adapter or service
  of its system". SVC-4 relies on it too: "… and no repository".** DRV-8 lists "a driving port of
  its system". A Port is "an interface, never the code behind it", and Reach counts "what running it
  reads or calls, however the code got hold of it". Calling through a driving port calls the
  service, so DRV-8 does not guarantee "no service". It guarantees "no repository" only if Reach is
  not transitive (N1).

## Notes

- **N1.** Reach is read as non-transitive: what a module itself reads or calls. SYS-9's "reaches
  it" is read as reaching a system's code, by import. Its Why and Statement speak of export paths
  and the offer. Records are TX-12's. Under the wider reading (records included), gap 8 becomes a
  SYS-9 breach.
- **N2.** "Of this codebase" (TX-3, TX-22, SYS-13) is read as a system whose code this codebase
  writes. External systems are systems ("Another bounded context is another system"; External
  system: "A bounded context") and upstreams, but not "of this codebase". The Assumptions' two
  configuration parts inside the rules, SYS-12 and TX-29, are read as a closed list.
- **N3.** TX-30's "answer" is read as a reply to a request this system made, a synchronous call
  included. An event a system reacts to unasked is no answer. TX-30's Why reads wider ("A system
  waiting for another's message holds a state the message is to end"). Under that reading gap 5
  closes.
- **N4.** "The bank API reports incoming transfers" is read as billing polling the API. If the
  bank calls a hook instead, TX-5's Why makes each report a delivered message, and gap 6 narrows
  to its unmatched-transfer half and to repeats the bank sends under new ids.
- **N5.** DOM-4's Scope says "of the same system".
  `dom-4-ok-order-line-copies-price.md`, `dom-4-breach-order-line-embeds-product.md` and
  `dom-4-breach-order-line-copies-whole-product-document.md` apply it to catalog's product, so
  their verdicts do not follow from its Scope. The embed's join of Payload's table is TX-12's.
- **N6.** The existing gap examples cite retired ids. `gap-admin-dashboard-belongs-to-no-system.md`
  cites SYS-3, SYS-5, SYS-7 and TX-13, and quotes SYS-9 as "code of one system", which now reads
  "code outside a system reaches it". `gap-health-and-metrics-endpoints.md` cites ARR-1. The
  glossary now has Probe, and the Assumptions put probes outside the layers. A dashboard reading
  through the courier now meets ASM-4 ("code reads the courier") and DRV-8 ("a driving port of its
  system") with no system to be "its".
- **N7.** `svc-7-breach-server-action-raw-sql-through-common-pool.md` calls `new Date()` in a
  driving adapter a reach of the clock through no port (glossary Outside: "the operating system
  among them"). `drv-1-ok-session-through-answering-service.md`,
  `drv-3-ok-server-action-reads-courier.md`, `drv-6-ok-server-action-reads-at-run-time.md` and
  `asm-3-ok-hook-passes-editor.md` do the same and are ok.
- **N8.** Pure's third clause is "hands its caller nothing the caller did not pass". Yet
  `randomUUID()` sits in shop's domain message factories in
  `tx-17-ok-fulfillment-subscribes-to-order-placed.md` and
  `tx-22-ok-order-confirmation-mail-through-outbox.md`, and
  `dom-1-breach-order-id-from-node-crypto.md` offers `globalThis.crypto` as a remedy. DOM-1
  admits "pure code of no system".
- **N9.** TX-1 says "hand it to each call into its store", reads included. Yet
  `svc-2-ok-cancel-order-decides-itself.md`, `svc-4-ok-mark-paid-through-repository.md` and the
  ASM-3 cancel examples load before opening the transaction. `tx-30-ok-payment-asks-stripe-at-deadline.md`
  runs one transaction per payment inside one use case.
- **N10.** The glossary defines Settle and no rule uses it. DRV-7 says "acknowledge it, to the bus
  or by its answer".
- **N11.** Glossary Store: "Two clients are one store when one transaction can carry the writes of
  both." The shared Postgres, Payload's tables included, is therefore one store. TX-1 ("each call
  into its store, reads included") and TX-2 then pull shop's Local API read of catalog into shop's
  transaction (`req.transactionID`), against P16. TX-25 binds only "a system declares a driving
  port", not an external system's API. This is a conflict, not a gap.
- **N12.** The fixture's "anti-corruption layer on the way out", with webhooks "in Stripe's terms",
  matches neither the glossary's anti-corruption layer ("in every adapter that touches the
  upstream") nor its conformist. SVC-6's "external system it conforms to" then fails, so payment's
  webhook adapter translates.
- **N13.** DOM-7's Why says "catalog's veto of a sku change, stays here". The example
  `tx-28-ok-before-change-hook-vetoes-sku-change.md` puts the rule in catalog's config. The
  glossary's Owner sides with the example.
- **N14.** Creating a PaymentIntent or Checkout Session is a change no transaction of payment's
  commits, of something no system of this codebase owns, so TX-22's Scope holds beside TX-36's.
  `tx-22-ok-payment-requests-checkout-session.md` lists both as satisfied. No rule says a MAY lifts
  a MUST whose Scope also holds.
- **N15.** The fixture names no owner for the customer: identity, email, address. Billing's
  dunning stage is a customer's, and shop's checkout identifies one.
- **N16.** The shared kernel holds business rules (the `Sku` format, `EUR`). DOM-7 says "in the
  domain", which is read as including the kernel imported into it (glossary: "each importing it
  into its domain").
- **N17.** P3 and P19 are carried by no rule's Statement. P15 is carried only by TX-30, under N3's
  synchronous-call reading.
- **N18.** DRV-1's Why makes a batch "one acting call in one transaction". Shop's deadline task
  cancelling all expired orders in one transaction then fails them all on one concurrent payment,
  P10's harm. Whether TX-15 relieves it depends on whether the batch "relies on" each cancel, which
  only TX-15's Why defines.
- **N19.** Undefined words relied on: "answer" (TX-30), "tells" (TX-35), "relies on" (TX-15,
  defined only in its Why), "hold" (TX-36), and "export path" for an external system (SVC-6's Why:
  "its package takes that place"; DOM-1 is silent).
