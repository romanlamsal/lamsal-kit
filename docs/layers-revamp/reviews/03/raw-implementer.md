# Implementer review, raw set

## Summary

Findings (cannot-comply):

- `svc-6-breach-service-reaches-repository-behind-port.md` — SVC-6, DRV-8 (with SVC-4, TX-1, DRV-1; glossary Reach, Port): calling a port reaches the code behind it, which neither list names, so every writing service and every driving adapter that calls its port breaches one of them.

Existing ok examples that do not hold:

- `asm-9-ok-transaction-handed-as-argument.md` — TX-1 (listed, not met): the cart is loaded before `tx.begin()`; SVC-4 breached by `carts.clear(cartId, t)`; checkout reads no catalog product (fixture).
- `svc-3-ok-place-order-writes-cart-itself.md` — TX-1 (listed, not met): `carts.findById` runs outside the transaction; DRV-8 breached: the handler calls the `MailSender` driven port; checkout reads no catalog product (fixture).
- `svc-4-ok-mark-paid-through-repository.md` — TX-1 (listed, not met): `orders.findById` outside the transaction; TX-35 breached: a late `PaymentSucceeded` on a cancelled order throws `NotPayable`.
- `tx-22-ok-payment-requests-checkout-session.md` — TX-22 (listed) is not met by `requestCheckoutSession`, only overridden by TX-36's MAY, and is out of Scope for `recordPayment`.
- `asm-3-ok-actor-through-driving-port.md` — ASM-3 (listed) holds only under a narrow reading, since its Why counts what an audit column records; TX-28 breached: `syncPrice` commits from an afterChange hook; shop writes catalog's price (fixture).
- `sys-1-ok-shop-export-paths.md` — SYS-1 (listed, not met): exports `PlaceOrder`, `Checkout`, `OrderDetails`, which no other system calls, and `productCommercialSchema` for data shop does not own.
- `asm-3-ok-confirmation-message-carries-locale.md` — ASM-3 Scope not reached: no service or driven adapter reads an ambient value.
- `asm-3-ok-hook-passes-editor.md` — ASM-3 Scope not reached; TX-28 breached: an afterChange use case publishes `productPageInvalidated`; SVC-7 breached by `new Date()` in the hook; shop owns product price (fixture).
- `drv-1-ok-session-through-answering-service.md` — ASM-3 Scope not reached; SVC-7 breached by `now: new Date()` in the server action.
- `svc-2-ok-cancel-order-decides-itself.md` — ASM-3 Scope not reached; TX-1 breached (load outside the transaction); TX-5 breached: a redelivered `PaymentFailed` throws `CancelRefused`.
- `tx-22-ok-order-confirmation-mail-through-outbox.md` — ASM-3 Scope not reached; SVC-4 breached (`carts.clear`); DOM-1 breached (`randomUUID()` in the domain).
- `tx-15-ok-customer-stats-follow-order-paid-by-message.md` — TX-15 Scope not reached: no use case shown writes more than it relies on, and compliant code never does.
- `svc-7-ok-order-overview-through-query-port.md` — TX-1 Scope not reached: the use case answers.
- `tx-3-ok-checkout-requests-checkout-session.md` — TX-3 Scope not reached, since the example's own point is that payment's data does not change; checkout reads no catalog product (fixture).
- `tx-31-ok-3pl-booking-keyed-by-shipment-id.md` — TX-22 Scope not reached: the use case decides nothing; SVC-4 breached by `shipments.recordBooking`.
- `dom-4-ok-order-line-copies-price.md` — DOM-4 Scope not reached: product and payment belong to other systems; sku and price are called shop's and the line has no tax class (fixture).
- `svc-6-ok-opaque-transaction.md` — DOM-1 Scope not shown; SVC-7 contested: the service opens the store's transaction through a common-library interface; shop writes catalog's price and sku (fixture).
- `sys-12-ok-shop-price-read-only-in-payload-admin.md` — SVC-4 Scope not shown; SYS-1 breached: `@teeladen/shop/payload#ChangePriceButton` exports a driving adapter.
- `asm-2-ok-assembly-hands-upstreams-to-builder.md` — SYS-1/SYS-9 breached: assembly imports shop's driven adapter `createPayloadCatalog`; ASM-2 breached: `buildPayment` builds the Stripe client from a key; shop writes catalog's price (fixture).
- `asm-8-ok-register-fills-courier-before-requests.md` — SYS-1/SYS-9 and ASM-2 breached, as in the previous file.
- `asm-2-ok-handler-receives-service.md` — SYS-9 breached: worker assembly holds fulfillment's repositories and outbox and hands them to the builder.
- `asm-1-ok-fulfillment-worker-one-assembly.md` — ASM-2 breached under the reading that a builder needing a client receives it: the 3PL client is built in the builder from config and uses the global `fetch`.
- `asm-7-ok-logger-and-tracer-imported-ready-made.md` — ASM-2 breached under the same reading: `fetchImpl: typeof fetch = fetch` takes the client in place when the caller omits it.
- `tst-8-ok-real-run-behind-env-flag.md` — ASM-2 breached: `createStripeGateway({ secretKey })` builds the Stripe client inside the adapter's factory.
- `asm-2-ok-payload-adapter-takes-instance.md` — fixture broken: shop writes `price` and `sku`, which catalog owns.
- `svc-1-ok-place-order-port-beside-service.md` — SYS-1 breached: exports `PlaceOrder` and `CancelOrder`, which only shop's own adapters reach; SVC-7 contested (common-library `Transactions`).
- `sys-10-ok-port-types-exported-as-types.md` — SYS-1 breached: exports `Checkout`; SVC-7 contested (common-library `Transactions`).
- `asm-4-ok-route-handler-reads-courier.md` — SYS-1 breached: the export path carries `CheckoutInput` for a port that no other system calls.
- `drv-3-ok-server-action-reads-courier.md` — SYS-1 breached: the courier-key path is not offer; SVC-7 breached by `placedAt: new Date()`.
- `drv-6-ok-server-action-reads-at-run-time.md` — SYS-1 (courier-key path) and SVC-7 (`now: new Date()`) breached.
- `tx-1-ok-place-order-service-holds-transaction.md` — SVC-4 breached by `carts.clear(cart.id, tx)`; checkout reads no catalog product (fixture).
- `tx-17-ok-fulfillment-subscribes-to-order-placed.md` — DOM-1 breached (`randomUUID()` in the domain); SYS-2 breached (published schemas live in `domain/messages`); `OrderPlaced` lacks payment method and tax class (fixture).
- `tx-7-ok-gift-message-added-optional.md` — SYS-2 breached: the published `orderPlacedSchema` sits in the domain and reuses the domain's `skuSchema`.
- `dom-1-ok-order-schema-imports.md` — SYS-2 breached: the domain module is offered to billing as published language; `Money` and `Sku` are redeclared in shop's domain although they belong to the shared kernel (fixture).
- `tx-2-ok-reservation-lines-written-in-handed-transaction.md` — TX-23 breached: a blind upsert compares no version.
- `tx-30-ok-payment-asks-stripe-at-deadline.md` — TX-1 breached: one use case opens one transaction per payment and loads outside any.
- `tx-28-ok-after-change-hook-records-revalidation-request.md` — TX-37 breached: the handler's use case decides again by shop's `givesUpWaiting` rule.
- `tx-28-ok-before-change-hook-vetoes-sku-change.md` — DOM-7 contested: DOM-7's Why puts the sku veto rule in shop, and the example puts it in catalog's config.
- `tx-6-ok-payment-succeeded-written-with-payment.md` — TX-19 breached: a `failed` delivered after `succeeded` flips the Payment and publishes `PaymentFailed`.
- `tx-1-ok-one-invoice-transaction-per-message.md` — fixture broken: step 6's `OrderPaid` for an invoice order issues a second invoice.
- `tx-1-ok-refund-and-payment-in-one-transaction.md` — TX-5 and TX-34 breached once the use case is called for shop's refund request, as the fixture has it.
- `sys-13-ok-checkout-process-sends-receivers-commands.md` — TX-5 breached: a redelivered `StockReserved` sends a second `CreatePayment`; checkout cannot return `client_secret` in the same request (fixture).
- `sys-2-ok-shop-messages-union.md` — fixture broken: `OrderPlaced` has no payment method or tax class, and `OrderPaid` has no lines.
- `sys-14-ok-money-returns-remainder.md` — fixture broken: `OrderPlaced` has no payment method or tax class.
- `svc-6-ok-place-order-dependencies.md` — fixture broken: placing the order writes no `OrderPlaced` and reads no catalog product.
- `tx-12-ok-invoice-number-through-billing-port.md` — DOM-7 breached: the rule for who may see an order is decided in the service.

Relies-on findings:

- SVC-2's Relies-on line on DRV-8 claims a driving adapter "reaches no ... service of its system". By the glossary's Reach, calling a driving port reaches the service behind it, and DRV-8 does not exclude that.
- TX-37's Relies-on line on TX-31 drops TX-31's Scope condition "that takes an idempotency key". For the fixture's 3PL, whose key support is not stated, TX-31 guarantees nothing.

## Findings

### svc-6-breach-service-reaches-repository-behind-port.md
```yaml
breaches: [SVC-6, DRV-8]
satisfies: [SVC-4, TX-1, DRV-1, SVC-7]
situation: shop's checkout saves the Order through its repository; the checkout route calls checkout
finding: cannot-comply
```
# A service must call its repository, and calling it reaches what no list names
```ts
// packages/shop/src/service/checkout.ts — SVC-4 makes this call mandatory
await d.orders.save(placed, tx)          // OrderRepository: a port of shop (on SVC-6's list)
// running this line calls createDrizzleOrderRepository(...).save, the code behind the port

// packages/shop/src/adapters/driven/drizzle/order-repository.ts — what the call reaches
export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  save: async (order, tx) => { /* asDrizzle(tx).update(orders)… */ },
  // …
})

// packages/shop/src/adapters/driving/next/checkout-route.ts — the driving side, same shape
const { checkout } = slot.read()         // what assembly put in the courier: createCheckout(...)
return Response.json(await checkout(input))   // calls the service function itself
```
The glossary defines **Reach**: "A module reaches what running it reads or calls, however the code
got hold of it". It defines **Port**: "An interface, never the code behind it". SVC-6's Scope holds
for the checkout service, which reaches past itself. Its list names "a port of its system", but not
a driven adapter and not the outside. Running `d.orders.save(...)` calls the Drizzle adapter's
`save`. That function is code behind the port, not the port, so the service reaches a driven
adapter, and SVC-6 has no entry for it. SVC-7 is narrower and governs the reach of the outside: the
store, through a port. Nothing narrower governs the reach of the adapter's own in-process code, so
SVC-6 governs it. SVC-4 is a MUST: "write it by saving the whole aggregate through the aggregate's
repository". TX-1 makes the same kind of call to the transaction port. No writing use case can
comply with both SVC-4 and SVC-6.

The driving side is the same. DRV-8 lists "a driving port of its system", and calling it reaches
the service behind the port, which DRV-8 does not list. DRV-8's Statement alone does not force the
call, but the glossary does: a driving adapter "adapts one way in to the driving ports it calls". A
handler "acts on messages", and DRV-7 speaks of "the use case it calls". The closest code is the
code above: it reaches exactly the implementation assembly handed it and nothing else.

The conflict dissolves under either of two readings. One reads "a port of its system" in the SVC-6
and DRV-8 lists as "a port of its system and the implementation assembly hands for it". The other
reads Reach as direct import or reference only. That second reading contradicts "however the code
got hold of it", which is there exactly so that a reach through an injected object counts (see
`svc-7-breach-service-queries-handed-drizzle-client.md`).

## How the fixture is built

### Systems

Placement decisions, in brief:

- **Kept as facts:**
  - one shared Postgres;
  - Drizzle for shop, payment, billing, fulfillment and backoffice;
  - Payload with its Local API, its `req.transactionID` and its `req.user`;
  - Stripe PaymentIntents;
  - fulfillment in its own worker process, with its own entry point and assembly;
  - pino, an OpenTelemetry tracer exporting to Jaeger, the relay and bus, and a Drizzle client factory, all in the common library;
  - the shared kernel `Money` and `Sku`.
- **Read as situations and placed otherwise:**
  - The "unit of work kept ambient in `AsyncLocalStorage`" becomes an explicit opaque transaction (ASM-9).
  - The "ambient" in "calls billing's open host service in-process while holding its own ambient transaction" goes; the call stays (TX-25, ASM-9).
  - "`afterChange` hooks call shop's services" becomes catalog's own outbox (TX-29 SHOULD).
  - "joins orders, invoices and shipments in the one Postgres" becomes a join over the backoffice system's own replica tables (SYS-9, TX-12).
  - See N1–N4.

One store: every system's tables live in one Postgres and the common library's `createDrizzleTransactions` can carry writes of any of them, so by the glossary they are one store; ownership is by Postgres schema (`shop.*`, `payment.*`, …), not by store. Payload uses its own pool and its own transactions: a second store (N14).

```
packages/
  kernel/                         @teeladen/kernel       shared kernel: Money, Sku (zod only)
  common/                         @teeladen/common       common library (plumbing, no model)
    src/{logger,tracer,meter,transaction,drizzle,envelope,relay,bus,run-handler,slot,clock,ids}.ts
  catalog/                        @teeladen/catalog      Payload config this codebase writes (external system)
    src/{collections/products.ts, collections/catalog-outbox.ts, messages/product-changed.ts,
         stock-replica.ts, index.ts}
  shop/                           @teeladen/shop
    src/domain/{order,cart,catalog-product,checkout,invoice-eligibility,page-revalidation,private-messages}.ts
    src/published/{messages,open-host}.ts
    src/service/ports/*.ts
    src/service/{checkout,identify-session,apply-payment-succeeded,apply-payment-failed,start-deadline-sweep,
                 cancel-if-overdue,apply-invoice-paid,apply-refund-answer,open-orders-with-sku,
                 decide-page-revalidation,revalidate-pages,send-order-confirmation,translate}.ts
    src/adapters/driven/{drizzle/*,payload/catalog-products.ts,upstream/{payment-requests,dunning-standings}.ts,
                         mail/resend-mailer.ts,next/page-cache.ts}
    src/adapters/driving/{next/checkout-route.ts,handlers/*.ts,payload/open-orders-hook.ts}
    src/builders/{slot,services,routes,catalog-hooks}.ts
    index.ts  build.ts  testing.ts
  payment/   same shape; src/adapters/driven/stripe/* and src/adapters/driving/next/stripe-webhook-route.ts
  billing/   same shape; src/adapters/driven/bank/* (anti-corruption layer to the bank API)
  fulfillment/ same shape; src/adapters/driven/threepl/*, src/adapters/driving/http/threepl-hook.ts
  backoffice/  same shape; the admin dashboard's system (Cross-cutting reads)
apps/
  web/                 Next.js + Payload admin: otel.mjs, instrumentation.ts (assembly), payload.config.ts,
                       payload-outbox-reader.ts, probe-server.ts,
                       app/api/checkout/route.ts, app/api/stripe/webhook/route.ts, app/admin/orders/page.tsx,
                       app/(payload)/…  (Payload's own routes)
  fulfillment-worker/  otel.mjs, main.ts (assembly), probe-server.ts
```

Processes and what each assembly builds:

| process | builders called | relay reads | bus delivers to |
| --- | --- | --- | --- |
| web | `buildShop`, `buildPayment`, `buildBilling`, `buildBackoffice`; Payload via `getPayload` | shop, payment, billing outboxes; catalog's outbox (reader built by assembly) | shop, payment, billing, backoffice handlers; catalog's stock replica handler |
| fulfillment-worker | `buildFulfillment` | fulfillment's outbox | fulfillment's handlers; 3PL hook on the worker's own HTTP server |

Upstream relations (all anti-corruption layers, so no domain imports another system's published language; DOM-1's conformist entry is unused):

| downstream | upstream | how |
| --- | --- | --- |
| shop | catalog | Local API through `CatalogProducts` driven port; `ProductChanged` message from catalog's outbox |
| shop | payment | `RequestPayment` open host service in-process through `PaymentRequests`; payment's events; payment's `RefundPayment` command |
| shop | billing | `DunningStanding` open host service in-process through `DunningStandings`; `InvoicePaid` |
| billing | shop, payment | `OrderPlaced`, `OrderPaid`; `PaymentRefunded` |
| fulfillment | shop, catalog | `OrderPlaced`, `OrderPaid`, `OrderCancelled`; `ProductChanged` |
| catalog (config) | shop, fulfillment | `OpenOrdersWithSku` port via shop's hook; `StockLevelChanged` replica |
| backoffice | shop, billing, fulfillment | events only (replica) |

Shared kernel:

```ts
// packages/kernel/src/money.ts — shared kernel: values computed from arguments, zod only (SYS-14)
import { z } from "zod"
export const moneySchema = z.object({ amount: z.number().int(), currency: z.literal("EUR") }) // minor units
export type Money = z.infer<typeof moneySchema>
export const zero: Money = { amount: 0, currency: "EUR" }
export const add = (a: Money, b: Money): Money => ({ amount: a.amount + b.amount, currency: a.currency })
export const times = (m: Money, n: number): Money => ({ amount: m.amount * n, currency: m.currency })
export const sameMoney = (a: Money, b: Money): boolean => a.amount === b.amount && a.currency === b.currency
/** Share of a gross amount that is tax at `basisPoints` (700 = 7 %), rounded half up to the cent. */
export const includedTax = (gross: Money, basisPoints: number): Money =>
  ({ amount: Math.round((gross.amount * basisPoints) / (10_000 + basisPoints)), currency: gross.currency })

// packages/kernel/src/sku.ts
import { z } from "zod"
export const skuSchema = z.string().regex(/^[A-Z]{3}-\d{5}$/).brand<"Sku">()
export type Sku = z.infer<typeof skuSchema>

// packages/kernel/index.ts
export * from "./src/money"
export * from "./src/sku"
```

### catalog

Catalog is an external system (Payload). Its config is code this codebase writes. The rules reach only
the parts that touch other systems:

- what may change records another system owns (SYS-12; none here);
- how it tells of a change (TX-29);
- the veto hook it calls (TX-28);
- the stock replica it keeps (TX-26, by my reading, N12).

Its own rules (price above zero, sku unique, a sku on an open order does not change) are catalog's
(DOM-7 Why, first clause; N9).

```ts
// packages/catalog/src/collections/products.ts — catalog's config; catalog's business rules live here
import { APIError, type CollectionConfig } from "payload"

export type ShopVeto = { openOrdersWithSku(input: { sku: string }): Promise<{ openOrders: number }> }

export const products = (shop: ShopVeto): CollectionConfig => ({
  slug: "products",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "copy", type: "richText" },
    { name: "images", type: "upload", relationTo: "media", hasMany: true },
    { name: "sku", type: "text", required: true, unique: true },                  // catalog's rule: sku unique
    { name: "price", type: "number", required: true, min: 1 },                    // catalog's rule: price above zero (cents)
    { name: "taxClass", type: "select", required: true, options: ["tea", "accessory"] },
    {
      name: "stock", type: "group",                                               // fulfillment's figure, a replica
      access: { create: () => false, update: () => false },                       // admin and REST cannot write it
      admin: { readOnly: true },
      fields: [{ name: "available", type: "number" }, { name: "version", type: "number" }],
    },
  ],
  hooks: {
    // the veto (fixture): catalog asks shop, catalog refuses; Payload rolls its own save back
    beforeChange: [
      async ({ data, originalDoc }) => {
        if (!originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data
        const { openOrders } = await shop.openOrdersWithSku({ sku: originalDoc.sku })
        if (openOrders > 0) throw new APIError("This sku is on an open order.", 409)
        return data
      },
    ],
    // how catalog tells of a change (TX-29): a message written in the editor's own transaction
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        if (context.origin === "stock-replica") return doc               // a replica refresh is no product change
        await req.payload.create({
          collection: "catalog-outbox",
          data: {
            type: "ProductChanged",
            productId: doc.id,
            slug: doc.slug,
            previousSlug: previousDoc?.slug ?? null,
            sku: doc.sku,
            previousSku: previousDoc?.sku ?? null,
            changedBy: req.user ? String(req.user.id) : null,            // Payload's auth, carried as data (ASM-3)
          },
          req,                                                             // carries req.transactionID: commits with the edit
        })
        return doc
      },
    ],
  },
})

// packages/catalog/src/collections/catalog-outbox.ts — catalog's outbox, a collection of Payload's own
import type { CollectionConfig } from "payload"
export const catalogOutbox: CollectionConfig = {
  slug: "catalog-outbox",
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "type", type: "text", required: true },
    { name: "productId", type: "text", required: true },
    { name: "slug", type: "text", required: true },
    { name: "previousSlug", type: "text" },
    { name: "sku", type: "text", required: true },
    { name: "previousSku", type: "text" },
    { name: "changedBy", type: "text" },
    { name: "deliveredAt", type: "date" },
  ],
}

// packages/catalog/src/messages/product-changed.ts — catalog's published language, zod only
import { z } from "zod"
export const productChangedSchema = z.object({
  id: z.string(), type: z.literal("ProductChanged"), productId: z.string(), slug: z.string(),
  previousSlug: z.string().nullable(), sku: z.string(), previousSku: z.string().nullable(), changedBy: z.string().nullable(),
})
export type ProductChanged = z.infer<typeof productChangedSchema>

// packages/catalog/src/stock-replica.ts — catalog keeps fulfillment's stock figure, from fulfillment's events (TX-26)
import type { Payload } from "payload"
import { stockLevelChangedSchema } from "@teeladen/fulfillment"
import type { Subscription } from "@teeladen/common"
export const createStockReplicaHandler = (payload: Payload): Subscription => ({
  system: "catalog", type: "StockLevelChanged",
  handle: async (envelope) => {
    const event = stockLevelChangedSchema.parse(envelope.payload)
    const found = await payload.find({ collection: "products", where: { sku: { equals: event.sku } }, limit: 1 })
    const product = found.docs[0]
    if (!product) return                                                      // a sku catalog no longer lists
    if ((product.stock?.version ?? 0) >= event.version) return                // TX-19: the higher version stays
    await payload.update({
      collection: "products", id: product.id,
      data: { stock: { available: event.available, version: event.version } },
      context: { origin: "stock-replica" },                                   // Local API overrides access; no ProductChanged
    })
  },
})

// packages/catalog/index.ts
export { products } from "./src/collections/products"
export { catalogOutbox } from "./src/collections/catalog-outbox"
export { productChangedSchema, type ProductChanged } from "./src/messages/product-changed"
export { createStockReplicaHandler } from "./src/stock-replica"
```

The config cycle (fixture: config needs hooks, hooks need services, services need the Payload
instance) is cut as in `sys-1-ok-shop-hooks-via-builder.md`. Shop's builder returns the veto hook,
which reads shop's slot (courier) when it runs. Shop's services, built with the Payload instance,
fill the slot.

```ts
// apps/web/payload.config.ts — Payload's config module; loaded by Payload's own routes and by assembly
import { buildConfig } from "payload"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { products, catalogOutbox } from "@teeladen/catalog"
import { buildShopCatalogHooks } from "@teeladen/shop/build"

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? "",
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),   // Payload's own pool: its own store
  collections: [products(buildShopCatalogHooks()), catalogOutbox, /* media, users */],
})

// apps/web/payload-outbox-reader.ts — catalog provides no reader; assembly builds it (glossary: Outbox)
import type { Payload } from "payload"
import type { Envelope, OutboxReader } from "@teeladen/common"
export const payloadOutboxReader = (payload: Payload): OutboxReader => ({
  async next(limit) {
    const page = await payload.find({ collection: "catalog-outbox", where: { deliveredAt: { exists: false } }, limit, sort: "createdAt" })
    return page.docs.map((d): Envelope => ({
      id: String(d.id), type: d.type, headers: {}, writtenAt: d.createdAt,
      payload: { id: String(d.id), type: d.type, productId: d.productId, slug: d.slug, previousSlug: d.previousSlug ?? null,
                 sku: d.sku, previousSku: d.previousSku ?? null, changedBy: d.changedBy ?? null },
    }))
  },
  async markDelivered(ids) {
    await payload.update({ collection: "catalog-outbox", where: { id: { in: [...ids] } }, data: { deliveredAt: new Date().toISOString() } })
  },
})
```

### shop

Shop owns Cart and Order. It is downstream of catalog, payment and billing through
anti-corruption layers.

**Domain** (zod, kernel, nothing else; DOM-1). Ids and the current time arrive as arguments
(N7).

```ts
// packages/shop/src/domain/order.ts
import { z } from "zod"
import { moneySchema, skuSchema, add, times, zero, type Money } from "@teeladen/kernel"

export const taxClassSchema = z.enum(["tea", "accessory"])               // shop's terms; the catalog adapter translates
export const paymentMethodSchema = z.enum(["card", "invoice"])
export const localeSchema = z.enum(["de", "en"])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const orderLineSchema = z.object({                                 // a snapshot, copied at checkout, never reloaded
  productId: z.string(), sku: skuSchema, title: z.string(),
  unitPrice: moneySchema, taxClass: taxClassSchema, quantity: z.number().int().positive(),
})
export type OrderLine = z.infer<typeof orderLineSchema>

export const orderSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),                                   // raised by every change; compared on save (TX-23)
  customerId: z.string(),
  email: z.string().email(),
  paymentMethod: paymentMethodSchema,
  status: z.enum(["placed", "paid", "cancelled"]),
  cancelReason: z.enum(["payment_failed", "deadline_passed"]).nullable(),
  lines: z.array(orderLineSchema).min(1),
  placedAt: z.string().datetime(),
  paymentDeadline: z.string().datetime().nullable(),                      // card orders only
  paymentRef: z.string().nullable(),
  refund: z.object({
    refundId: z.string(),
    status: z.enum(["requested", "done", "refused", "unanswered"]),
    reason: z.string().nullable(),
    requestedAt: z.string().datetime(),
  }).nullable(),
})
export type Order = z.infer<typeof orderSchema>

/** Business rule: a card order is paid within 30 minutes or cancelled (TX-30: shop's deadline ends shop's wait). */
export const PAYMENT_WINDOW_MS = 30 * 60_000
/** Business rule: an invoice order waits on billing as long as billing pursues it; shop accepts that state (TX-30). */
export const INVOICE_ORDER_WAIT: "accepted" = "accepted"
/** Business rule: a refund payment has not answered in 7 days is flagged for staff (TX-30). */
export const REFUND_ANSWER_MS = 7 * 24 * 3_600_000

export const orderTotal = (o: Order): Money => o.lines.reduce((s, l) => add(s, times(l.unitPrice, l.quantity)), zero)

export const placeOrder = (i: {
  id: string; customerId: string; email: string; paymentMethod: PaymentMethod; lines: OrderLine[]; now: Date
}): Order =>
  orderSchema.parse({
    id: i.id, version: 1, customerId: i.customerId, email: i.email, paymentMethod: i.paymentMethod,
    status: "placed", cancelReason: null, lines: i.lines, placedAt: i.now.toISOString(),
    paymentDeadline: i.paymentMethod === "card" ? new Date(i.now.getTime() + PAYMENT_WINDOW_MS).toISOString() : null,
    paymentRef: null, refund: null,
  })

const next = (o: Order, change: Partial<Order>): Order => orderSchema.parse({ ...o, ...change, version: o.version + 1 })

export type PaymentSucceededOutcome =
  | { kind: "paid"; order: Order }
  | { kind: "refund"; order: Order; refundId: string; amount: Money }
  | { kind: "nothing" }

/** Business rule (domain.md step 7, TX-35): money for a cancelled order goes back. */
export const onPaymentSucceeded = (o: Order, p: { paymentRef: string; amount: Money; refundId: string; now: Date }): PaymentSucceededOutcome => {
  if (o.status === "placed") return { kind: "paid", order: next(o, { status: "paid", paymentRef: p.paymentRef }) }
  if (o.status === "paid" || o.refund) return { kind: "nothing" }
  return {
    kind: "refund", refundId: p.refundId, amount: p.amount,
    order: next(o, { paymentRef: p.paymentRef, refund: { refundId: p.refundId, status: "requested", reason: null, requestedAt: p.now.toISOString() } }),
  }
}
/** PaymentFailed is payment's terminal failure (N11): a placed card order is cancelled; anything else stands. */
export const onPaymentFailed = (o: Order): Order | null =>
  o.status === "placed" && o.paymentMethod === "card" ? next(o, { status: "cancelled", cancelReason: "payment_failed" }) : null
export const isPastDeadline = (o: Order, now: Date): boolean =>
  o.status === "placed" && o.paymentDeadline !== null && new Date(o.paymentDeadline).getTime() < now.getTime()
export const cancelIfPastDeadline = (o: Order, now: Date): Order | null =>
  isPastDeadline(o, now) ? next(o, { status: "cancelled", cancelReason: "deadline_passed" }) : null
/** domain.md step 6: an invoice order becomes paid when billing tells it the invoice is paid; the deadline never applied. */
export const onInvoicePaid = (o: Order): Order | null =>
  o.paymentMethod === "invoice" && o.status === "placed" ? next(o, { status: "paid" }) : null
/** TX-35: payment refused the refund (a disputed charge). Business rule: accept, record why, staff contacts the customer. */
export const onRefundAnswer = (o: Order, a: { refundId: string; refused: boolean; reason: string | null }): Order | null =>
  o.refund && o.refund.refundId === a.refundId && o.refund.status === "requested"
    ? next(o, { refund: { ...o.refund, status: a.refused ? "refused" : "done", reason: a.reason } })
    : null
export const flagUnansweredRefund = (o: Order, now: Date): Order | null =>
  o.refund?.status === "requested" && now.getTime() - new Date(o.refund.requestedAt).getTime() > REFUND_ANSWER_MS
    ? next(o, { refund: { ...o.refund, status: "unanswered" } })
    : null
/** "Open order", for catalog's sku veto: one still waiting for its payment (N9). */
export const isOpen = (o: Order): boolean => o.status === "placed"

// packages/shop/src/domain/cart.ts
import { z } from "zod"
export const cartSchema = z.object({
  id: z.string(), version: z.number().int().positive(), customerId: z.string(),
  lines: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
})
export type Cart = z.infer<typeof cartSchema>
export const belongsTo = (c: Cart, customerId: string): boolean => c.customerId === customerId
export const clearCart = (c: Cart): Cart => cartSchema.parse({ ...c, lines: [], version: c.version + 1 })

// packages/shop/src/domain/catalog-product.ts — what shop knows of a product, in shop's terms
import type { Money, Sku } from "@teeladen/kernel"
import type { z } from "zod"
import type { Cart } from "./cart"
import { type OrderLine, taxClassSchema } from "./order"
export type CatalogProduct = { productId: string; sku: Sku; title: string; price: Money; taxClass: z.infer<typeof taxClassSchema> }
export class ProductUnavailable extends Error { constructor(readonly productId: string) { super(productId) } }
/** Business rule: the order pays catalog's price as read during this checkout; an edit after the read does not reach it (N15). */
export const linesFrom = (cart: Cart, products: ReadonlyMap<string, CatalogProduct>): OrderLine[] =>
  cart.lines.map((l) => {
    const p = products.get(l.productId)
    if (!p) throw new ProductUnavailable(l.productId)
    return { productId: p.productId, sku: p.sku, title: p.title, unitPrice: p.price, taxClass: p.taxClass, quantity: l.quantity }
  })

// packages/shop/src/domain/invoice-eligibility.ts
export type DunningStanding = { inDunning: boolean }
/** Business rule (fixture): pay-by-invoice, but not to a customer billing has put into dunning. An answer billing gave
 *  during this checkout is accepted even if billing raises the stage before shop commits (P10, N15). */
export const needsDunningCheck = (m: PaymentMethod): boolean => m === "invoice"
export const mayPayByInvoice = (s: DunningStanding): boolean => !s.inDunning
export class InvoiceNotOffered extends Error {}

// packages/shop/src/domain/checkout.ts — the shape of a checkout request, stated once (DOM-3)
import { z } from "zod"
export const checkoutRequestSchema = z.object({ cartId: z.string(), paymentMethod: paymentMethodSchema, locale: localeSchema })
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

// packages/shop/src/domain/page-revalidation.ts
export const pagesToRevalidate = (c: { slug: string; previousSlug: string | null }): string[] =>
  [...new Set(["/", `/products/${c.slug}`, ...(c.previousSlug && c.previousSlug !== c.slug ? [`/products/${c.previousSlug}`] : [])])]

// packages/shop/src/domain/private-messages.ts — messages meant only for shop (glossary: Private)
import { z } from "zod"
export const sendOrderConfirmationSchema = z.object({
  id: z.string(), type: z.literal("SendOrderConfirmation"), orderId: z.string(), email: z.string().email(),
  locale: localeSchema, lines: z.array(orderLineSchema), total: moneySchema,
})
export const revalidatePagesSchema = z.object({ id: z.string(), type: z.literal("RevalidatePages"), paths: z.array(z.string()) })
export const cancelIfOverdueSchema = z.object({ id: z.string(), type: z.literal("CancelIfOverdue"), orderId: z.string() })
export const sendOrderConfirmation = (o: Order, locale: z.infer<typeof localeSchema>, id: string) =>
  sendOrderConfirmationSchema.parse({ id, type: "SendOrderConfirmation", orderId: o.id, email: o.email, locale, lines: o.lines, total: orderTotal(o) })
export const confirmationMail = (m: z.infer<typeof sendOrderConfirmationSchema>) =>
  ({ to: m.email, subject: m.locale === "de" ? "Deine Bestellung" : "Your order", lines: m.lines, total: m.total })
```

**Published language** (zod and kernel only, no domain import, SYS-2/SYS-14). The order
messages carry the order's version, since a later one overrides an earlier for any receiver
keeping the order's state (TX-32). They also carry the payment method (domain.md step 6: "OrderPlaced
says so") and each line's tax class (billing's VAT).

```ts
// packages/shop/src/published/messages.ts
import { z } from "zod"
import { moneySchema, skuSchema } from "@teeladen/kernel"
const line = z.object({ sku: skuSchema, quantity: z.number().int().positive(), unitPrice: moneySchema, taxClass: z.enum(["tea", "accessory"]) })
const order = { id: z.string(), orderId: z.string(), orderVersion: z.number().int().positive(), customerId: z.string() }
export const orderPlacedSchema = z.object({ type: z.literal("OrderPlaced"), ...order, paymentMethod: z.enum(["card", "invoice"]), lines: z.array(line), total: moneySchema, placedAt: z.string().datetime() })
export const orderPaidSchema = z.object({ type: z.literal("OrderPaid"), ...order, paymentMethod: z.enum(["card", "invoice"]), lines: z.array(line), total: moneySchema })
export const orderCancelledSchema = z.object({ type: z.literal("OrderCancelled"), ...order, reason: z.enum(["payment_failed", "deadline_passed"]) })
export type OrderPlaced = z.infer<typeof orderPlacedSchema>
export type OrderPaid = z.infer<typeof orderPaidSchema>
export type OrderCancelled = z.infer<typeof orderCancelledSchema>

// packages/shop/src/published/open-host.ts — what catalog's hook sends and gets back
import { z } from "zod"
export const openOrdersWithSkuInputSchema = z.object({ sku: z.string() })
export type OpenOrdersWithSkuInput = z.infer<typeof openOrdersWithSkuInputSchema>
export type OpenOrdersWithSkuAnswer = { openOrders: number }
```

**Service layer: ports** (all declared here, SVC-1. `Transaction` is the common library's opaque
type; the port that opens it is shop's own, SVC-7).

```ts
// packages/shop/src/service/ports/index.ts
import type { Transaction } from "@teeladen/common"
import type { Money, Sku } from "@teeladen/kernel"
import type { Order } from "../../domain/order"
import type { Cart } from "../../domain/cart"
import type { CatalogProduct } from "../../domain/catalog-product"
import type { DunningStanding } from "../../domain/invoice-eligibility"
import type { OrderPlaced, OrderPaid, OrderCancelled } from "../../published/messages"
import type { z } from "zod"
import type { sendOrderConfirmationSchema, revalidatePagesSchema, cancelIfOverdueSchema, confirmationMail } from "../../domain/private-messages"

export interface TransactionPort { run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> }
export interface Clock { now(): Date }
export interface Ids { next(): string }
export interface OrderRepository {
  byId(id: string, tx: Transaction): Promise<Order | null>
  save(order: Order, tx: Transaction): Promise<void>                       // fails where the version moved (TX-23)
  overdueIds(now: Date, tx: Transaction): Promise<string[]>
  withRequestedRefundIds(tx: Transaction): Promise<string[]>
}
export interface CartRepository { byId(id: string, tx: Transaction): Promise<Cart | null>; save(cart: Cart, tx: Transaction): Promise<void> }
export interface OpenOrderQueries { countPlacedWithSku(sku: string): Promise<number> }     // answering read, skips the aggregate (SVC-7 Why)
export interface HandledMessages { claim(messageId: string, tx: Transaction): Promise<boolean> }
export type ShopOutgoing =
  | OrderPlaced | OrderPaid | OrderCancelled
  | z.infer<typeof sendOrderConfirmationSchema> | z.infer<typeof revalidatePagesSchema> | z.infer<typeof cancelIfOverdueSchema>
export interface ShopOutbox { write(message: ShopOutgoing, tx: Transaction): Promise<void> }
export interface RefundRequests {                                            // shop's terms; the adapter writes payment's command (SYS-13)
  request(r: { refundId: string; orderId: string; amount: Money }, tx: Transaction): Promise<void>
}
export interface CatalogProducts { byIds(productIds: readonly string[]): Promise<ReadonlyMap<string, CatalogProduct>> }
export interface PaymentRequests { request(r: { orderId: string; amount: Money; email: string }): Promise<{ clientSecret: string }> }
export interface DunningStandings { of(customerId: string): Promise<DunningStanding> }
export interface Sessions { customerOf(token: string): Promise<{ customerId: string; email: string } | null> }
export interface Mailer { send(mail: ReturnType<typeof confirmationMail>, idempotencyKey: string): Promise<void> }
export interface PageCache { revalidate(paths: readonly string[]): Promise<void> }
export type { Sku }
```

**Services.** Each acting use case runs in one transaction it opens (TX-1) and loads what it
decides by inside it (SVC-2). Each use case called for a message claims the message id first
(TX-5).

```ts
// packages/shop/src/service/checkout.ts — driving port beside its service (SVC-1); not offered to other systems, not exported
import { placeOrder, orderTotal, type PaymentMethod } from "../domain/order"
import { belongsTo, clearCart } from "../domain/cart"
import { linesFrom } from "../domain/catalog-product"
import { needsDunningCheck, mayPayByInvoice, InvoiceNotOffered } from "../domain/invoice-eligibility"
import { sendOrderConfirmation } from "../domain/private-messages"
import { toOrderPlaced } from "./translate"
import type * as P from "./ports"

export type Checkout = (i: {
  cartId: string; paymentMethod: PaymentMethod; locale: "de" | "en"; customer: { customerId: string; email: string }
}) => Promise<{ orderId: string; clientSecret: string | null }>
export class CartNotFound extends Error {}

export const createCheckout = (d: {
  transactions: P.TransactionPort; carts: P.CartRepository; orders: P.OrderRepository; outbox: P.ShopOutbox
  catalog: P.CatalogProducts; dunning: P.DunningStandings; payments: P.PaymentRequests; clock: P.Clock; ids: P.Ids
}): Checkout => async ({ cartId, paymentMethod, locale, customer }) => {
  const order = await d.transactions.run(async (tx) => {
    const cart = await d.carts.byId(cartId, tx)
    if (!cart || !belongsTo(cart, customer.customerId)) throw new CartNotFound(cartId)
    const products = await d.catalog.byIds(cart.lines.map((l) => l.productId))   // catalog's store, catalog's API: no tx
    // the fixture's in-process call to billing's open host service, made while shop's transaction is open;
    // nothing of the transaction crosses: billing's port takes none (TX-25) and none is ambient (ASM-9)
    if (needsDunningCheck(paymentMethod) && !mayPayByInvoice(await d.dunning.of(customer.customerId))) throw new InvoiceNotOffered()
    const placed = placeOrder({ id: d.ids.next(), ...customer, paymentMethod, lines: linesFrom(cart, products), now: d.clock.now() })
    await d.orders.save(placed, tx)
    await d.carts.save(clearCart(cart), tx)
    await d.outbox.write(toOrderPlaced(placed, d.ids.next()), tx)                 // TX-6
    await d.outbox.write(sendOrderConfirmation(placed, locale, d.ids.next()), tx) // the mail, asked for (TX-22)
    return placed
  })
  if (order.paymentMethod === "invoice") return { orderId: order.id, clientSecret: null }
  // after the commit: a tentative operation, asked by a call (TX-36); the deadline in the Order ends the wait (TX-30)
  const { clientSecret } = await d.payments.request({ orderId: order.id, amount: orderTotal(order), email: order.email })
  return { orderId: order.id, clientSecret }
}

// packages/shop/src/service/translate.ts — the service translates between domain and published language (SVC-6)
import type { Order } from "../domain/order"
import { orderTotal } from "../domain/order"
import type { OrderPlaced, OrderPaid, OrderCancelled } from "../published/messages"
const lines = (o: Order) => o.lines.map(({ sku, quantity, unitPrice, taxClass }) => ({ sku, quantity, unitPrice, taxClass }))
export const toOrderPlaced = (o: Order, id: string): OrderPlaced => ({ type: "OrderPlaced", id, orderId: o.id, orderVersion: o.version,
  customerId: o.customerId, paymentMethod: o.paymentMethod, lines: lines(o), total: orderTotal(o), placedAt: o.placedAt })
export const toOrderPaid = (o: Order, id: string): OrderPaid => ({ type: "OrderPaid", id, orderId: o.id, orderVersion: o.version,
  customerId: o.customerId, paymentMethod: o.paymentMethod, lines: lines(o), total: orderTotal(o) })
export const toOrderCancelled = (o: Order, id: string): OrderCancelled => ({ type: "OrderCancelled", id, orderId: o.id,
  orderVersion: o.version, customerId: o.customerId, reason: o.cancelReason ?? "deadline_passed" })

// packages/shop/src/service/identify-session.ts — answering
export type IdentifySession = (i: { token: string }) => Promise<{ customerId: string; email: string } | null>
export const createIdentifySession = (d: { sessions: P.Sessions }): IdentifySession => ({ token }) => d.sessions.customerOf(token)

// packages/shop/src/service/apply-payment-succeeded.ts — called for payment's PaymentSucceeded
export type ApplyPaymentSucceeded = (i: { messageId: string; orderId: string; paymentRef: string; amount: Money }) => Promise<void>
export class OrderNotFound extends Error {}
export const createApplyPaymentSucceeded = (d: {
  transactions: P.TransactionPort; handled: P.HandledMessages; orders: P.OrderRepository; outbox: P.ShopOutbox
  refunds: P.RefundRequests; clock: P.Clock; ids: P.Ids
}): ApplyPaymentSucceeded => (i) =>
  d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(i.messageId, tx))) return
    const order = await d.orders.byId(i.orderId, tx)
    if (!order) throw new OrderNotFound(i.orderId)                   // no business rule stops it: fail, retry (TX-38)
    const outcome = onPaymentSucceeded(order, { paymentRef: i.paymentRef, amount: i.amount, refundId: d.ids.next(), now: d.clock.now() })
    if (outcome.kind === "nothing") return
    await d.orders.save(outcome.order, tx)
    if (outcome.kind === "paid") await d.outbox.write(toOrderPaid(outcome.order, d.ids.next()), tx)
    else await d.refunds.request({ refundId: outcome.refundId, orderId: order.id, amount: outcome.amount }, tx)   // TX-3, SYS-13
  })

// packages/shop/src/service/apply-payment-failed.ts
export const createApplyPaymentFailed = (d: { transactions: P.TransactionPort; handled: P.HandledMessages; orders: P.OrderRepository; outbox: P.ShopOutbox; ids: P.Ids }) =>
  (i: { messageId: string; orderId: string }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(i.messageId, tx))) return
      const order = await d.orders.byId(i.orderId, tx)
      if (!order) throw new OrderNotFound(i.orderId)
      const cancelled = onPaymentFailed(order)
      if (!cancelled) return                                           // paid or already cancelled: the domain says it stands
      await d.orders.save(cancelled, tx)
      await d.outbox.write(toOrderCancelled(cancelled, d.ids.next()), tx)
    })

// packages/shop/src/service/start-deadline-sweep.ts — the scheduled task's one acting call: one message per due order
export const createStartDeadlineSweep = (d: { transactions: P.TransactionPort; orders: P.OrderRepository; outbox: P.ShopOutbox; clock: P.Clock; ids: P.Ids }) =>
  () => d.transactions.run(async (tx) => {
    for (const orderId of await d.orders.overdueIds(d.clock.now(), tx))
      await d.outbox.write({ type: "CancelIfOverdue", id: d.ids.next(), orderId }, tx)
  })

// packages/shop/src/service/cancel-if-overdue.ts — called for shop's private CancelIfOverdue; decides again (own records, TX-37 n/a)
export const createCancelIfOverdue = (d: { transactions: P.TransactionPort; handled: P.HandledMessages; orders: P.OrderRepository; outbox: P.ShopOutbox; clock: P.Clock; ids: P.Ids }) =>
  (i: { messageId: string; orderId: string }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(i.messageId, tx))) return
      const order = await d.orders.byId(i.orderId, tx)
      if (!order) throw new OrderNotFound(i.orderId)
      const now = d.clock.now()
      const cancelled = cancelIfPastDeadline(order, now)
      if (cancelled) {
        await d.orders.save(cancelled, tx)                               // loses to a concurrent paid mark: StaleAggregate, retried, then nothing
        await d.outbox.write(toOrderCancelled(cancelled, d.ids.next()), tx)
        return
      }
      const flagged = flagUnansweredRefund(order, now)
      if (flagged) await d.orders.save(flagged, tx)
    })

// packages/shop/src/service/apply-invoice-paid.ts — domain.md step 6
export const createApplyInvoicePaid = (d: { transactions: P.TransactionPort; handled: P.HandledMessages; orders: P.OrderRepository; outbox: P.ShopOutbox; ids: P.Ids }) =>
  (i: { messageId: string; orderId: string }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(i.messageId, tx))) return
      const order = await d.orders.byId(i.orderId, tx)
      if (!order) throw new OrderNotFound(i.orderId)
      const paid = onInvoicePaid(order)
      if (!paid) return
      await d.orders.save(paid, tx)
      await d.outbox.write(toOrderPaid(paid, d.ids.next()), tx)        // billing and fulfillment already acted on OrderPlaced
    })

// packages/shop/src/service/apply-refund-answer.ts — for payment's PaymentRefunded and RefundRefused
export const createApplyRefundAnswer = (d: { transactions: P.TransactionPort; handled: P.HandledMessages; orders: P.OrderRepository }) =>
  (i: { messageId: string; orderId: string; refundId: string; refused: boolean; reason: string | null }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(i.messageId, tx))) return
      const order = await d.orders.byId(i.orderId, tx)
      if (!order) throw new OrderNotFound(i.orderId)
      const answered = onRefundAnswer(order, i)
      if (answered) await d.orders.save(answered, tx)
    })

// packages/shop/src/service/open-orders-with-sku.ts — open host service for catalog's veto; answering; takes no transaction (TX-25)
import type { OpenOrdersWithSkuInput, OpenOrdersWithSkuAnswer } from "../published/open-host"
export type OpenOrdersWithSku = (i: OpenOrdersWithSkuInput) => Promise<OpenOrdersWithSkuAnswer>
export const createOpenOrdersWithSku = (d: { openOrders: P.OpenOrderQueries }): OpenOrdersWithSku =>
  async ({ sku }) => ({ openOrders: await d.openOrders.countPlacedWithSku(sku) })   // adapter counts isOpen orders (status placed)

// packages/shop/src/service/decide-page-revalidation.ts — called for catalog's ProductChanged: decides, writes a message (TX-22)
export const createDecidePageRevalidation = (d: { transactions: P.TransactionPort; handled: P.HandledMessages; outbox: P.ShopOutbox; ids: P.Ids }) =>
  (i: { messageId: string; slug: string; previousSlug: string | null }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(i.messageId, tx))) return
      await d.outbox.write({ type: "RevalidatePages", id: d.ids.next(), paths: pagesToRevalidate(i) }, tx)
    })

// packages/shop/src/service/revalidate-pages.ts — called for shop's private RevalidatePages: makes the change, decides nothing (TX-37);
// a repeat revalidates again, which changes no record (TX-5, second means)
export const createRevalidatePages = (d: { pages: P.PageCache }) => (i: { paths: readonly string[] }) => d.pages.revalidate(i.paths)

// packages/shop/src/service/send-order-confirmation.ts — called for shop's private SendOrderConfirmation (TX-37)
export const createSendOrderConfirmation = (d: { mailer: P.Mailer }) =>
  (m: z.infer<typeof sendOrderConfirmationSchema>) =>
    d.mailer.send(confirmationMail(m), `order-confirmation:${m.orderId}`)   // TX-31: the same on every message asking for this mail
```

**Driven adapters.** Each imports only the outside, its port, its domain, the kernel and the
common library (DVN-4).

```ts
// packages/shop/src/adapters/driven/drizzle/order-repository.ts
import { and, eq, inArray, lt, sql } from "drizzle-orm"
import { asDrizzle, StaleAggregate, type Db } from "@teeladen/common"
import { orderSchema, type Order } from "../../../domain/order"
import type { OrderRepository } from "../../../service/ports"
import { orders } from "./schema"                                                   // shop.orders: id, version, customer_id, status, deadline, body jsonb

export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  async byId(id, tx) {
    const [row] = await asDrizzle(tx).select().from(orders).where(eq(orders.id, id))
    return row ? orderSchema.parse(row.body) : null
  },
  async save(order, tx) {
    const t = asDrizzle(tx)
    const values = { id: order.id, version: order.version, customerId: order.customerId, status: order.status,
                     paymentDeadline: order.paymentDeadline, refundStatus: order.refund?.status ?? null, body: order }
    if (order.version === 1) { await t.insert(orders).values(values); return }    // a duplicate id fails on the key
    const updated = await t.update(orders).set(values)
      .where(and(eq(orders.id, order.id), eq(orders.version, order.version - 1))).returning({ id: orders.id })
    if (updated.length === 0) throw new StaleAggregate("Order", order.id)          // TX-23
  },
  async overdueIds(now, tx) {
    const rows = await asDrizzle(tx).select({ id: orders.id }).from(orders)
      .where(and(eq(orders.status, "placed"), lt(orders.paymentDeadline, now.toISOString())))
    return rows.map((r) => r.id)
  },
  async withRequestedRefundIds(tx) {
    const rows = await asDrizzle(tx).select({ id: orders.id }).from(orders).where(eq(orders.refundStatus, "requested"))
    return rows.map((r) => r.id)
  },
})
// shop's open-order query, cart repository, handled-messages and outbox reader are the same shape;
// the outbox adapter is shown with the common library (trace headers)

// packages/shop/src/adapters/driven/drizzle/refund-requests.ts — shop's terms in, payment's command out (SYS-13 Why)
import { refundPayment } from "@teeladen/payment"                                   // payment's published language: the outside (DVN-4)
import { asDrizzle, traceHeaders } from "@teeladen/common"
import type { RefundRequests } from "../../../service/ports"
import { shopOutbox } from "./schema"
export const createRefundRequests = (): RefundRequests => ({
  async request(r, tx) {
    const command = refundPayment({ id: r.refundId, refundId: r.refundId, orderId: r.orderId, amount: r.amount })
    await asDrizzle(tx).insert(shopOutbox).values({ id: command.id, type: command.type, payload: command, headers: traceHeaders() })
  },
})

// packages/shop/src/adapters/driven/payload/catalog-products.ts — anti-corruption layer over Payload's Local API
import type { Payload } from "payload"
import { skuSchema, moneySchema } from "@teeladen/kernel"
import { taxClassSchema } from "../../../domain/order"
import type { CatalogProducts } from "../../../service/ports"
export const createPayloadCatalogProducts = (payload: Payload): CatalogProducts => ({
  async byIds(ids) {
    const found = await payload.find({ collection: "products", where: { id: { in: [...ids] } }, limit: ids.length, depth: 0 })
    return new Map(found.docs.map((doc) => [String(doc.id), {
      productId: String(doc.id), sku: skuSchema.parse(doc.sku), title: doc.title,
      price: moneySchema.parse({ amount: doc.price, currency: "EUR" }), taxClass: taxClassSchema.parse(doc.taxClass),
    }]))
  },
})

// packages/shop/src/adapters/driven/upstream/payment-requests.ts — payment's open host service in-process today
import type { RequestPayment } from "@teeladen/payment"                              // the upstream's driving port type
import type { PaymentRequests } from "../../../service/ports"
export const createPaymentRequests = (requestPayment: RequestPayment): PaymentRequests => ({
  request: ({ orderId, amount, email }) => requestPayment({ orderId, amount, customerEmail: email }),
})

// packages/shop/src/adapters/driven/upstream/dunning-standings.ts
import type { DunningStandingQuery } from "@teeladen/billing"
import type { DunningStandings } from "../../../service/ports"
export const createDunningStandings = (dunningStanding: DunningStandingQuery): DunningStandings => ({
  of: async (customerId) => ({ inDunning: (await dunningStanding({ customerId })).stage !== "none" }),
})

// packages/shop/src/adapters/driven/mail/resend-mailer.ts
import type { Resend } from "resend"
import type { Mailer } from "../../../service/ports"
export const createResendMailer = (resend: Resend, from: string): Mailer => ({
  async send(mail, idempotencyKey) {
    const { error } = await resend.emails.send({ from, to: mail.to, subject: mail.subject, react: OrderConfirmationEmail(mail) },
                                               { idempotencyKey })
    if (error) throw new Error(error.message)                                    // the handler does not settle (DRV-7)
  },
})

// packages/shop/src/adapters/driven/next/page-cache.ts — the cached shop page lives in Next's cache
import { revalidatePath } from "next/cache"
import type { PageCache } from "../../../service/ports"
export const nextPageCache: PageCache = { revalidate: async (paths) => { for (const p of paths) revalidatePath(p) } }
```

**Driving adapters.**

```ts
// packages/shop/src/builders/slot.ts — shop's courier slot; filled by buildShop, read by the adapters the framework calls
import { createSlot } from "@teeladen/common"
import type { Checkout } from "../service/checkout"
import type { IdentifySession } from "../service/identify-session"
import type { OpenOrdersWithSku } from "../service/open-orders-with-sku"
export type ShopCourier = { checkout: Checkout; identifySession: IdentifySession; openOrdersWithSku: OpenOrdersWithSku }
export const shopSlot = createSlot<ShopCourier>("shop")

// packages/shop/src/adapters/driving/next/checkout-route.ts — Next calls it; it reads the slot each time it runs (DRV-3, DRV-6)
import { cookies } from "next/headers"
import { checkoutRequestSchema } from "../../../domain/checkout"
import { InvoiceNotOffered } from "../../../domain/invoice-eligibility"
import type { Slot } from "@teeladen/common"
import type { ShopCourier } from "../../../builders/slot"
export const createCheckoutRoute = (slot: Slot<ShopCourier>) => async (request: Request): Promise<Response> => {
  const { identifySession, checkout } = slot.read()
  const token = (await cookies()).get("session")?.value
  const customer = token ? await identifySession({ token }) : null              // answering call: an argument of the act (DRV-1)
  if (!customer) return Response.json({ error: "sign-in" }, { status: 401 })
  const parsed = checkoutRequestSchema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ errors: parsed.error.issues }, { status: 400 })
  try {
    return Response.json(await checkout({ ...parsed.data, customer }))            // the one acting call
  } catch (e) {
    if (e instanceof InvoiceNotOffered) return Response.json({ error: "invoice-not-offered" }, { status: 409 })
    throw e
  }
}

// packages/shop/src/adapters/driving/payload/open-orders-hook.ts — shop's hook in catalog's config (catalog calls it)
import { openOrdersWithSkuInputSchema } from "../../../published/open-host"
export const createOpenOrdersHook = (slot: Slot<ShopCourier>) => ({
  openOrdersWithSku: (input: { sku: string }) => slot.read().openOrdersWithSku(openOrdersWithSkuInputSchema.parse(input)),
})

// packages/shop/src/adapters/driving/handlers/index.ts — one call per delivered message (DRV-1); a throw leaves it unsettled (DRV-7)
import { paymentSucceededSchema, paymentFailedSchema, paymentRefundedSchema, refundRefusedSchema } from "@teeladen/payment"
import { invoicePaidSchema } from "@teeladen/billing"
import { productChangedSchema } from "@teeladen/catalog"
import type { Subscription } from "@teeladen/common"
export const createShopHandlers = (s: ShopServices): Subscription[] => [
  { system: "shop", type: "PaymentSucceeded", handle: async (e) => {
      const m = paymentSucceededSchema.parse(e.payload)                         // payment's terms stop here
      await s.applyPaymentSucceeded({ messageId: m.id, orderId: m.orderId, paymentRef: m.paymentId, amount: m.amount }) } },
  { system: "shop", type: "PaymentFailed", handle: async (e) => {
      const m = paymentFailedSchema.parse(e.payload); await s.applyPaymentFailed({ messageId: m.id, orderId: m.orderId }) } },
  { system: "shop", type: "PaymentRefunded", handle: async (e) => {
      const m = paymentRefundedSchema.parse(e.payload)
      await s.applyRefundAnswer({ messageId: m.id, orderId: m.orderId, refundId: m.refundId, refused: false, reason: null }) } },
  { system: "shop", type: "RefundRefused", handle: async (e) => {
      const m = refundRefusedSchema.parse(e.payload)
      await s.applyRefundAnswer({ messageId: m.id, orderId: m.orderId, refundId: m.refundId, refused: true, reason: m.reason }) } },
  { system: "shop", type: "InvoicePaid", handle: async (e) => {
      const m = invoicePaidSchema.parse(e.payload); await s.applyInvoicePaid({ messageId: m.id, orderId: m.orderId }) } },
  { system: "shop", type: "ProductChanged", handle: async (e) => {
      const m = productChangedSchema.parse(e.payload)
      await s.decidePageRevalidation({ messageId: m.id, slug: m.slug, previousSlug: m.previousSlug }) } },
  { system: "shop", type: "SendOrderConfirmation", handle: (e) => s.sendOrderConfirmation(sendOrderConfirmationSchema.parse(e.payload)) },
  { system: "shop", type: "RevalidatePages", handle: (e) => s.revalidatePages(revalidatePagesSchema.parse(e.payload)) },
  { system: "shop", type: "CancelIfOverdue", handle: async (e) => {
      const m = cancelIfOverdueSchema.parse(e.payload); await s.cancelIfOverdue({ messageId: m.id, orderId: m.orderId }) } },
]
```

**Builders and export paths.**

```ts
// packages/shop/src/builders/services.ts — system builder: receives clients, config, upstreams (ASM-2); builds the rest
export const buildShop = (deps: {
  db: Db; payload: Payload; mail: { resend: Resend; from: string }
  upstreams: { requestPayment: RequestPayment; dunningStanding: DunningStandingQuery }
  clock: Clock; ids: Ids
}) => {
  const transactions = createDrizzleTransactions(deps.db)
  const orders = createDrizzleOrderRepository(deps.db)
  const carts = createDrizzleCartRepository(deps.db)
  const outbox = createDrizzleShopOutbox()
  const handled = createDrizzleHandledMessages("shop")
  const { clock, ids } = deps
  const services = {
    checkout: createCheckout({ transactions, carts, orders, outbox, clock, ids,
      catalog: createPayloadCatalogProducts(deps.payload),
      dunning: createDunningStandings(deps.upstreams.dunningStanding),
      payments: createPaymentRequests(deps.upstreams.requestPayment) }),
    identifySession: createIdentifySession({ sessions: createDrizzleSessions(deps.db) }),
    openOrdersWithSku: createOpenOrdersWithSku({ openOrders: createDrizzleOpenOrderQueries(deps.db) }),
    applyPaymentSucceeded: createApplyPaymentSucceeded({ transactions, handled, orders, outbox, refunds: createRefundRequests(), clock, ids }),
    applyPaymentFailed: createApplyPaymentFailed({ transactions, handled, orders, outbox, ids }),
    applyInvoicePaid: createApplyInvoicePaid({ transactions, handled, orders, outbox, ids }),
    applyRefundAnswer: createApplyRefundAnswer({ transactions, handled, orders }),
    startDeadlineSweep: createStartDeadlineSweep({ transactions, orders, outbox, clock, ids }),
    cancelIfOverdue: createCancelIfOverdue({ transactions, handled, orders, outbox, clock, ids }),
    decidePageRevalidation: createDecidePageRevalidation({ transactions, handled, outbox, ids }),
    revalidatePages: createRevalidatePages({ pages: nextPageCache }),
    sendOrderConfirmation: createSendOrderConfirmation({ mailer: createResendMailer(deps.mail.resend, deps.mail.from) }),
  }
  shopSlot.fill({ checkout: services.checkout, identifySession: services.identifySession, openOrdersWithSku: services.openOrdersWithSku })
  return {
    openHost: { openOrdersWithSku: services.openOrdersWithSku },
    handlers: createShopHandlers(services),
    schedules: [{ name: "shop.deadline-sweep", everyMs: 60_000, run: services.startDeadlineSweep }],
    outboxReader: createDrizzleShopOutboxReader(deps.db),
  }
}

// packages/shop/src/builders/routes.ts — a builder for the routes Next finds by file; reads nothing until a request runs
export const buildShopRoutes = () => ({ checkout: { POST: createCheckoutRoute(shopSlot) } })
// packages/shop/src/builders/catalog-hooks.ts — a builder for the hook Payload's config holds
export const buildShopCatalogHooks = () => createOpenOrdersHook(shopSlot)

// packages/shop/index.ts — published language and the open host service's port type (SYS-1, SYS-10)
export { orderPlacedSchema, orderPaidSchema, orderCancelledSchema } from "./src/published/messages"
export type { OrderPlaced, OrderPaid, OrderCancelled } from "./src/published/messages"
export { openOrdersWithSkuInputSchema } from "./src/published/open-host"
export type { OpenOrdersWithSkuInput, OpenOrdersWithSkuAnswer } from "./src/published/open-host"
export type { OpenOrdersWithSku } from "./src/service/open-orders-with-sku"
// packages/shop/build.ts — system builders
export { buildShop } from "./src/builders/services"
export { buildShopRoutes } from "./src/builders/routes"
export { buildShopCatalogHooks } from "./src/builders/catalog-hooks"
// packages/shop/testing.ts — fake of the open host service's port, on a path of its own (SYS-15)
export { fakeOpenOrdersWithSku } from "./src/testing/fake-open-orders-with-sku"

// apps/web/app/api/checkout/route.ts — the file Next finds; it holds no wiring
import { buildShopRoutes } from "@teeladen/shop/build"
export const { POST } = buildShopRoutes().checkout
```

### payment

Payment owns Payment and Refund. Stripe sits behind an anti-corruption layer both ways: the
gateway on the way out and the webhook route on the way in. Payment's `PaymentFailed` means the
PaymentIntent can no longer succeed (canceled at Stripe, or abandoned by payment's
reconciliation). A declined card attempt is no failure, because the customer may retry on the same
intent (N11). This keeps payment's two events exclusive, so shop's results do not depend on their
order (TX-19).

```ts
// packages/payment/src/domain/payment.ts
import { z } from "zod"
import { moneySchema, sameMoney, type Money } from "@teeladen/kernel"
export const paymentSchema = z.object({
  id: z.string(), version: z.number().int().positive(), orderId: z.string(), amount: moneySchema, intentRef: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]), disputed: z.boolean(), refunded: moneySchema,
  answerDueBy: z.string().datetime(),
})
export type Payment = z.infer<typeof paymentSchema>
/** Business rule (TX-30): Stripe's answer is due an hour after the intent; after that payment asks Stripe itself. */
export const ANSWER_WINDOW_MS = 60 * 60_000
export const openPayment = (existing: Payment | null, i: { id: string; orderId: string; amount: Money; intentRef: string; now: Date }): Payment | null =>
  existing ? null                                                       // one Payment per order: a repeated request records nothing
  : paymentSchema.parse({ ...i, version: 1, status: "pending", disputed: false, refunded: { amount: 0, currency: "EUR" },
                          answerDueBy: new Date(i.now.getTime() + ANSWER_WINDOW_MS).toISOString() })
export type IntentOutcome = { kind: "succeeded" | "attempt_failed" | "canceled" | "disputed" }
export type Published = "PaymentSucceeded" | "PaymentFailed" | null
const next = (p: Payment, c: Partial<Payment>): Payment => paymentSchema.parse({ ...p, ...c, version: p.version + 1 })
/** Stripe's events in any order: succeeded and canceled are terminal and exclusive at Stripe; a late, contradicting one changes nothing. */
export const applyOutcome = (p: Payment, o: IntentOutcome): { payment: Payment; publish: Published } | null => {
  if (o.kind === "disputed") return p.disputed ? null : { payment: next(p, { disputed: true }), publish: null }
  if (p.status !== "pending" || o.kind === "attempt_failed") return null
  return o.kind === "succeeded" ? { payment: next(p, { status: "succeeded" }), publish: "PaymentSucceeded" }
                                : { payment: next(p, { status: "failed" }), publish: "PaymentFailed" }
}
/** Reconciliation (TX-30): settle by what Stripe holds; still open past the due time is abandoned and its intent canceled. */
export const settleOverdue = (p: Payment, stripe: "succeeded" | "canceled" | "open", now: Date):
  { payment: Payment; publish: Published; cancelIntent: boolean } | null => {
  if (p.status !== "pending" || new Date(p.answerDueBy).getTime() > now.getTime()) return null
  if (stripe === "succeeded") return { payment: next(p, { status: "succeeded" }), publish: "PaymentSucceeded", cancelIntent: false }
  return { payment: next(p, { status: "failed" }), publish: "PaymentFailed", cancelIntent: stripe === "open" }
}
/** A Payment Stripe tells of that payment never recorded (process stopped between Stripe's answer and the commit). */
export const paymentFromIntent = (i: { id: string; orderId: string; amount: Money; intentRef: string; now: Date }): Payment =>
  paymentSchema.parse({ ...i, version: 1, status: "pending", disputed: false, refunded: { amount: 0, currency: "EUR" },
                        answerDueBy: new Date(i.now.getTime() + ANSWER_WINDOW_MS).toISOString() })

// packages/payment/src/domain/refund.ts
export const refundSchema = z.object({ id: z.string(), version: z.number().int().positive(), paymentId: z.string(),
  orderId: z.string(), amount: moneySchema, status: z.enum(["requested", "confirmed", "failed"]), stripeRef: z.string().nullable() })
export type Refund = z.infer<typeof refundSchema>
export type RefundDecision = { refused: true; reason: "disputed" | "exceeds_payment" | "not_paid" } | { refused: false; payment: Payment; refund: Refund }
/** Fixture: a payment whose charge the customer disputes is not refunded. */
export const decideRefund = (p: Payment | null, r: { refundId: string; amount: Money }): RefundDecision => {
  if (!p || p.status !== "succeeded") return { refused: true, reason: "not_paid" }
  if (p.disputed) return { refused: true, reason: "disputed" }
  if (p.refunded.amount + r.amount.amount > p.amount.amount) return { refused: true, reason: "exceeds_payment" }
  return { refused: false,
    payment: paymentSchema.parse({ ...p, refunded: { amount: p.refunded.amount + r.amount.amount, currency: "EUR" }, version: p.version + 1 }),
    refund: refundSchema.parse({ id: r.refundId, version: 1, paymentId: p.id, orderId: p.orderId, amount: r.amount, status: "requested", stripeRef: null }) }
}
/** Records Stripe's answer to the refund call; a repeat records the same (TX-37: no decision). */
export const recordRefundAnswer = (r: Refund, a: { stripeRef: string; status: "pending" | "succeeded" | "failed" }): Refund | null =>
  r.stripeRef === a.stripeRef && (a.status === "pending" || r.status !== "requested") ? null
  : refundSchema.parse({ ...r, stripeRef: a.stripeRef, status: a.status === "succeeded" ? "confirmed" : a.status === "failed" ? "failed" : r.status, version: r.version + 1 })
```

```ts
// packages/payment/src/published/index.ts — commands payment takes, events it publishes, its open host service's I/O
import { z } from "zod"
import { moneySchema } from "@teeladen/kernel"
export const requestPaymentInputSchema = z.object({ orderId: z.string(), amount: moneySchema, customerEmail: z.string().email() })
export type RequestPaymentInput = z.infer<typeof requestPaymentInputSchema>
export type RequestPaymentResult = { clientSecret: string }
export const refundPaymentSchema = z.object({ type: z.literal("RefundPayment"), id: z.string(), refundId: z.string(), orderId: z.string(), amount: moneySchema })
export type RefundPayment = z.infer<typeof refundPaymentSchema>
export const refundPayment = (c: Omit<RefundPayment, "type">): RefundPayment => refundPaymentSchema.parse({ type: "RefundPayment", ...c })
export const paymentSucceededSchema = z.object({ type: z.literal("PaymentSucceeded"), id: z.string(), paymentId: z.string(), orderId: z.string(), amount: moneySchema })
export const paymentFailedSchema = z.object({ type: z.literal("PaymentFailed"), id: z.string(), paymentId: z.string(), orderId: z.string() })
export const paymentRefundedSchema = z.object({ type: z.literal("PaymentRefunded"), id: z.string(), refundId: z.string(), orderId: z.string(), amount: moneySchema })
export const refundRefusedSchema = z.object({ type: z.literal("RefundRefused"), id: z.string(), refundId: z.string(), orderId: z.string(),
  reason: z.enum(["disputed", "exceeds_payment", "not_paid", "processor_refused"]) })   // names no sender (TX-34)
```

```ts
// packages/payment/src/service/ports/index.ts
export interface PaymentGateway {                                              // payment's terms; Stripe behind it
  createIntent(i: { reference: string; amount: Money; idempotencyKey: string }): Promise<{ ref: string; clientSecret: string }>
  intentStatus(ref: string): Promise<"succeeded" | "canceled" | "open">
  cancelIntent(ref: string, idempotencyKey: string): Promise<void>
  refund(i: { intentRef: string; amount: Money; idempotencyKey: string }): Promise<{ stripeRef: string; status: "pending" | "succeeded" | "failed" }>
}
export interface PaymentRepository {
  byOrderId(orderId: string, tx: Transaction): Promise<Payment | null>
  byIntentRef(ref: string, tx: Transaction): Promise<Payment | null>
  byId(id: string, tx: Transaction): Promise<Payment | null>
  overdueIds(now: Date, tx: Transaction): Promise<string[]>
  save(p: Payment, tx: Transaction): Promise<void>
}
export interface RefundRepository { byId(id: string, tx: Transaction): Promise<Refund | null>; byStripeRef(ref: string, tx: Transaction): Promise<Refund | null>; save(r: Refund, tx: Transaction): Promise<void> }
// TransactionPort, Clock, Ids, HandledMessages, PaymentOutbox: as in shop

// packages/payment/src/service/request-payment.ts — open host service shop calls in-process (TX-36: a tentative operation, by call)
export type RequestPayment = (i: RequestPaymentInput) => Promise<RequestPaymentResult>
export const createRequestPayment = (d: { gateway: PaymentGateway; payments: PaymentRepository; transactions: TransactionPort; clock: Clock; ids: Ids }): RequestPayment =>
  async (i) => {
    // asked first, keyed by the order: a repeat gets the same intent back; nothing at Stripe is given until the customer confirms
    const intent = await d.gateway.createIntent({ reference: i.orderId, amount: i.amount, idempotencyKey: `intent:${i.orderId}` })
    await d.transactions.run(async (tx) => {
      const opened = openPayment(await d.payments.byOrderId(i.orderId, tx),
        { id: d.ids.next(), orderId: i.orderId, amount: i.amount, intentRef: intent.ref, now: d.clock.now() })
      if (opened) await d.payments.save(opened, tx)
    })
    return { clientSecret: intent.clientSecret }
  }

// packages/payment/src/service/record-stripe-outcome.ts — called by payment's Stripe hook; Stripe redelivers for three days
export const createRecordStripeOutcome = (d: { transactions: TransactionPort; handled: HandledMessages; payments: PaymentRepository; outbox: PaymentOutbox; clock: Clock; ids: Ids }) =>
  (o: { eventId: string; intentRef: string; orderId: string; amount: Money; outcome: IntentOutcome }) =>
    d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(o.eventId, tx))) return                 // TX-5: Stripe's event id
      const loaded = await d.payments.byIntentRef(o.intentRef, tx)
      const payment = loaded
        ?? paymentFromIntent({ id: d.ids.next(), orderId: o.orderId, amount: o.amount, intentRef: o.intentRef, now: d.clock.now() })
      if (!loaded) await d.payments.save(payment, tx)                      // first record of an intent payment never recorded
      const applied = applyOutcome(payment, o.outcome)
      if (!applied) return
      await d.payments.save(applied.payment, tx)
      if (applied.publish) await d.outbox.write(toPublished(applied.publish, applied.payment, d.ids.next()), tx)   // TX-6
    })

// packages/payment/src/service/start-reconciliation.ts + reconcile-payment.ts — TX-30, one message per overdue payment
export const createStartReconciliation = (d: { transactions: TransactionPort; payments: PaymentRepository; outbox: PaymentOutbox; clock: Clock; ids: Ids }) =>
  () => d.transactions.run(async (tx) => {
    for (const paymentId of await d.payments.overdueIds(d.clock.now(), tx))
      await d.outbox.write({ type: "ReconcilePayment", id: d.ids.next(), paymentId }, tx)          // private
  })
export const createReconcilePayment = (d: { transactions: TransactionPort; handled: HandledMessages; payments: PaymentRepository; gateway: PaymentGateway; outbox: PaymentOutbox; clock: Clock; ids: Ids }) =>
  async (m: { messageId: string; paymentId: string; intentRef: string }) => {
    const atStripe = await d.gateway.intentStatus(m.intentRef)                                     // a read of the outside, before the transaction
    await d.transactions.run(async (tx) => {
      if (!(await d.handled.claim(m.messageId, tx))) return
      const payment = await d.payments.byId(m.paymentId, tx)
      const settled = payment && settleOverdue(payment, atStripe, d.clock.now())                  // decides again on its own records (TX-37 n/a)
      if (!settled) return
      await d.payments.save(settled.payment, tx)
      if (settled.publish) await d.outbox.write(toPublished(settled.publish, settled.payment, d.ids.next()), tx)
      if (settled.cancelIntent) await d.outbox.write({ type: "CancelPaymentIntent", id: d.ids.next(), intentRef: payment.intentRef }, tx)   // TX-22
    })
  }
// packages/payment/src/service/cancel-payment-intent.ts — called for the private CancelPaymentIntent: no decision (TX-37)
export const createCancelPaymentIntent = (d: { gateway: PaymentGateway }) =>
  (m: { intentRef: string }) => d.gateway.cancelIntent(m.intentRef, `cancel:${m.intentRef}`)        // TX-31: key from what the change is about

// packages/payment/src/service/refund-payment.ts — called for shop's RefundPayment, payment's own command (SYS-13, TX-33)
export const createRefundPayment = (d: { transactions: TransactionPort; handled: HandledMessages; payments: PaymentRepository; refunds: RefundRepository; outbox: PaymentOutbox; ids: Ids }) =>
  (c: RefundPayment) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(c.id, tx))) return
    const decision = decideRefund(await d.payments.byOrderId(c.orderId, tx), { refundId: c.refundId, amount: c.amount })
    if (decision.refused) {                                                                          // TX-34: an outcome, published
      await d.outbox.write({ type: "RefundRefused", id: d.ids.next(), refundId: c.refundId, orderId: c.orderId, reason: decision.reason }, tx)
      return
    }
    await d.payments.save(decision.payment, tx)
    await d.refunds.save(decision.refund, tx)
    await d.outbox.write({ type: "ExecuteStripeRefund", id: d.ids.next(), refundId: decision.refund.id }, tx)   // private (TX-22)
  })
// packages/payment/src/service/execute-stripe-refund.ts — called for the private ExecuteStripeRefund: makes the call, records the answer
export const createExecuteStripeRefund = (d: { transactions: TransactionPort; refunds: RefundRepository; payments: PaymentRepository; gateway: PaymentGateway; outbox: PaymentOutbox; ids: Ids }) =>
  async (m: { refundId: string; intentRef: string; amount: Money }) => {
    const answer = await d.gateway.refund({ intentRef: m.intentRef, amount: m.amount, idempotencyKey: `refund:${m.refundId}` })   // TX-31
    await d.transactions.run(async (tx) => {
      const refund = await d.refunds.byId(m.refundId, tx)
      const recorded = refund && recordRefundAnswer(refund, answer)
      if (!recorded) return
      await d.refunds.save(recorded, tx)
      if (recorded.status === "confirmed") await d.outbox.write(paymentRefunded(recorded, d.ids.next()), tx)
      if (recorded.status === "failed")
        await d.outbox.write({ type: "RefundRefused", id: d.ids.next(), refundId: recorded.id, orderId: recorded.orderId, reason: "processor_refused" }, tx)
    })
  }
// record-refund-update.ts (Stripe's refund.updated through the same hook) loads by stripeRef and applies recordRefundAnswer the same way
```

The private `ExecuteStripeRefund` message carries `refundId`, `intentRef` and `amount`.
`refundPayment` writes them from the Payment it loaded (abbreviated above to `refundId`), so the
handler's use case needs no read before its call.

```ts
// packages/payment/src/adapters/driven/stripe/gateway.ts — the anti-corruption layer on the way out
import type Stripe from "stripe"
import type { PaymentGateway } from "../../../service/ports"
export const createStripeGateway = (stripe: Stripe): PaymentGateway => ({
  async createIntent({ reference, amount, idempotencyKey }) {
    const i = await stripe.paymentIntents.create({ amount: amount.amount, currency: "eur", metadata: { orderId: reference } }, { idempotencyKey })
    if (!i.client_secret) throw new Error(`intent ${i.id} without client_secret`)
    return { ref: i.id, clientSecret: i.client_secret }
  },
  async intentStatus(ref) {
    const i = await stripe.paymentIntents.retrieve(ref)
    return i.status === "succeeded" ? "succeeded" : i.status === "canceled" ? "canceled" : "open"
  },
  async cancelIntent(ref, idempotencyKey) {
    const i = await stripe.paymentIntents.retrieve(ref)
    if (i.status === "canceled") return                                                // a repeat is no change
    await stripe.paymentIntents.cancel(ref, {}, { idempotencyKey })
  },
  async refund({ intentRef, amount, idempotencyKey }) {
    const r = await stripe.refunds.create({ payment_intent: intentRef, amount: amount.amount }, { idempotencyKey })
    return { stripeRef: r.id, status: r.status === "succeeded" ? "succeeded" : r.status === "failed" || r.status === "canceled" ? "failed" : "pending" }
  },
})

// packages/payment/src/adapters/driving/next/stripe-webhook-route.ts — hook: the anti-corruption layer on the way in
import { createHmac, timingSafeEqual } from "node:crypto"                                // computes from arguments (DRV-8)
export const createStripeWebhookRoute = (slot: Slot<PaymentCourier>) => async (request: Request): Promise<Response> => {
  const { recordStripeOutcome, webhookSecret } = slot.read()                               // DRV-6
  const body = await request.text()
  if (!signedByStripe(body, request.headers.get("stripe-signature"), webhookSecret)) return new Response(null, { status: 400 })
  const outcome = toPaymentTerms(stripeEventSchema.parse(JSON.parse(body)))             // Stripe's terms stop here
  if (!outcome) return new Response(null, { status: 200 })                                // an event type payment has no use case for
  await recordStripeOutcome(outcome)                                                       // the one acting call (DRV-1)
  return new Response(null, { status: 200 })                                              // settled only after it succeeded (DRV-7)
}
const toPaymentTerms = (e: StripeEvent) => {
  const o = e.data.object
  switch (e.type) {
    case "payment_intent.succeeded": return { eventId: e.id, intentRef: o.id, orderId: o.metadata.orderId, amount: eurCents(o.amount), outcome: { kind: "succeeded" as const } }
    case "payment_intent.payment_failed": return { eventId: e.id, intentRef: o.id, orderId: o.metadata.orderId, amount: eurCents(o.amount), outcome: { kind: "attempt_failed" as const } }
    case "payment_intent.canceled": return { eventId: e.id, intentRef: o.id, orderId: o.metadata.orderId, amount: eurCents(o.amount), outcome: { kind: "canceled" as const } }
    case "charge.dispute.created": return { eventId: e.id, intentRef: o.payment_intent, orderId: o.metadata.orderId, amount: eurCents(o.amount), outcome: { kind: "disputed" as const } }
    default: return null
  }
}
// signedByStripe: HMAC-SHA256 of `${t}.${body}` compared with v1; the timestamp tolerance is left out, since it needs the clock (N7)
```

`buildPayment({ db, stripe, webhookSecret, clock, ids })` receives the Stripe client from assembly
(ASM-2). It fills `paymentSlot` with `{ recordStripeOutcome, webhookSecret }` and returns:

- `openHost: { requestPayment }`;
- handlers for `RefundPayment`, `ReconcilePayment`, `CancelPaymentIntent`, `ExecuteStripeRefund`;
- schedules: `payment.reconcile` every 5 minutes;
- its outbox reader.

The export paths are:

- `@teeladen/payment`: the published language and `export type { RequestPayment }`;
- `@teeladen/payment/build`: `buildPayment`, `buildPaymentRoutes`;
- `@teeladen/payment/testing`: `fakeRequestPayment` (SYS-15).

```ts
// apps/web/app/api/stripe/webhook/route.ts
import { buildPaymentRoutes } from "@teeladen/payment/build"
export const { POST } = buildPaymentRoutes().stripeWebhook
```

### billing

Billing owns Invoice, the customer's dunning stage (`CustomerDunning`), the gapless invoice
numbers (`InvoiceNumberSequence`), CreditNote, and the bank transfers it imported. It handles
shop's and payment's events through an anti-corruption layer in its handlers.

```ts
// packages/billing/src/domain/invoice.ts
import { z } from "zod"
import { moneySchema, skuSchema, add, times, zero, includedTax, type Money } from "@teeladen/kernel"
/** Business rule (fixture): VAT follows from the line's tax class: 7 % tea, 19 % accessories; prices are gross. */
export const VAT_BASIS_POINTS = { tea: 700, accessory: 1_900 } as const
export type TaxClass = keyof typeof VAT_BASIS_POINTS
export const invoiceLineSchema = z.object({ sku: skuSchema, quantity: z.number().int().positive(), gross: moneySchema,
  taxClass: z.enum(["tea", "accessory"]), vatBasisPoints: z.number().int(), vat: moneySchema })
export const invoiceSchema = z.object({
  id: z.string(), version: z.number().int().positive(), number: z.string(), orderId: z.string(), customerId: z.string(),
  lines: z.array(invoiceLineSchema).min(1), total: moneySchema, status: z.enum(["open", "paid"]),
  reference: z.string(), issuedAt: z.string().datetime(), dueAt: z.string().datetime(),
})
export type Invoice = z.infer<typeof invoiceSchema>
export type OrderToInvoice = {                                                 // billing's terms for what shop's events tell
  orderId: string; customerId: string; paymentMethod: "card" | "invoice"; event: "placed" | "paid"
  lines: ReadonlyArray<{ sku: z.infer<typeof skuSchema>; quantity: number; unitPrice: Money; taxClass: TaxClass }>
}
/** Business rule (fixture): an invoice order is invoiced when placed, a card order when paid; one invoice per order. */
export const invoicesNow = (o: OrderToInvoice, existing: Invoice | null): boolean =>
  existing === null && ((o.paymentMethod === "invoice" && o.event === "placed") || (o.paymentMethod === "card" && o.event === "paid"))
export const PAYMENT_TERM_DAYS = 14
export const issueInvoice = (o: OrderToInvoice, n: { id: string; number: string; now: Date }): Invoice => {
  const lines = o.lines.map((l) => {
    const gross = times(l.unitPrice, l.quantity)
    return { sku: l.sku, quantity: l.quantity, gross, taxClass: l.taxClass, vatBasisPoints: VAT_BASIS_POINTS[l.taxClass], vat: includedTax(gross, VAT_BASIS_POINTS[l.taxClass]) }
  })
  return invoiceSchema.parse({ id: n.id, version: 1, number: n.number, orderId: o.orderId, customerId: o.customerId, lines,
    total: lines.reduce((s, l) => add(s, l.gross), zero), status: o.paymentMethod === "card" ? "paid" : "open",
    reference: `TL-${n.number}`, issuedAt: n.now.toISOString(),
    dueAt: new Date(n.now.getTime() + PAYMENT_TERM_DAYS * 86_400_000).toISOString() })
}

// packages/billing/src/domain/invoice-number-sequence.ts — gapless: the number is taken in the transaction that saves the invoice
export const sequenceSchema = z.object({ year: z.number().int(), version: z.number().int().positive(), last: z.number().int().nonnegative() })
export type InvoiceNumberSequence = z.infer<typeof sequenceSchema>
export const takeNumber = (s: InvoiceNumberSequence): { sequence: InvoiceNumberSequence; number: string } =>
  ({ sequence: { ...s, last: s.last + 1, version: s.version + 1 }, number: `${s.year}-${String(s.last + 1).padStart(6, "0")}` })

// packages/billing/src/domain/bank-transfer.ts
export const bankTransferSchema = z.object({ id: z.string(), version: z.number().int().positive(), bankRef: z.string(),
  amount: moneySchema, reference: z.string(), bookedAt: z.string().datetime(),
  status: z.enum(["unmatched", "matched", "needs-review"]), invoiceId: z.string().nullable(), reason: z.string().nullable() })
export type BankTransfer = z.infer<typeof bankTransferSchema>
/** Business rule: a transfer settles an open invoice when it names its reference and pays its total; anything else
 *  (a wrong reference, an amount short) waits for a clerk, accepted as it stands (TX-30). */
export const matchTransfer = (t: BankTransfer, invoice: Invoice | null): { transfer: BankTransfer; invoice: Invoice | null } => {
  if (t.status !== "unmatched") return { transfer: t, invoice: null }
  if (!invoice || invoice.status !== "open")
    return { transfer: { ...t, status: "needs-review", reason: "no open invoice for reference", version: t.version + 1 }, invoice: null }
  if (t.amount.amount < invoice.total.amount)
    return { transfer: { ...t, status: "needs-review", reason: "amount short", version: t.version + 1 }, invoice: null }
  return { transfer: { ...t, status: "matched", invoiceId: invoice.id, version: t.version + 1 },
           invoice: { ...invoice, status: "paid", version: invoice.version + 1 } }
}

// packages/billing/src/domain/customer-dunning.ts
export const dunningStages = ["none", "reminder", "second-reminder", "collection"] as const
export const customerDunningSchema = z.object({ customerId: z.string(), version: z.number().int().positive(), stage: z.enum(dunningStages) })
export type CustomerDunning = z.infer<typeof customerDunningSchema>
/** Business rule (fixture): the stage rises with each reminder while an invoice is overdue, and clears once nothing is. */
export const raiseIfOverdue = (d: CustomerDunning, overdue: readonly Invoice[]): CustomerDunning | null => {
  const at = dunningStages.indexOf(d.stage)
  return overdue.length === 0 || at === dunningStages.length - 1 ? null : { ...d, stage: dunningStages[at + 1], version: d.version + 1 }
}
export const clearIfSettled = (d: CustomerDunning, overdue: readonly Invoice[]): CustomerDunning | null =>
  overdue.length === 0 && d.stage !== "none" ? { ...d, stage: "none", version: d.version + 1 } : null

// packages/billing/src/domain/credit-note.ts
/** Business rule: a credit note corrects an invoice. A refund of money never invoiced (domain.md step 7: the order
 *  was cancelled before it was paid, so it was never invoiced) gets none; billing records that and does nothing more (N10). */
export const creditNoteFor = (invoice: Invoice | null, r: { refundId: string; amount: Money }, n: { id: string; now: Date }) =>
  invoice ? { id: n.id, refundId: r.refundId, invoiceId: invoice.id, amount: r.amount, issuedAt: n.now.toISOString() } : null
```

```ts
// packages/billing/src/published/index.ts
import { z } from "zod"
import { moneySchema } from "@teeladen/kernel"
export const invoiceIssuedSchema = z.object({ type: z.literal("InvoiceIssued"), id: z.string(), invoiceId: z.string(), number: z.string(), orderId: z.string(), total: moneySchema })
export const invoicePaidSchema = z.object({ type: z.literal("InvoicePaid"), id: z.string(), invoiceId: z.string(), orderId: z.string() })
export const dunningStageChangedSchema = z.object({ type: z.literal("DunningStageChanged"), id: z.string(), customerId: z.string(),
  stage: z.enum(["none", "reminder", "second-reminder", "collection"]), version: z.number().int().positive() })   // TX-32
export const dunningStandingInputSchema = z.object({ customerId: z.string() })
export type DunningStandingAnswer = { stage: "none" | "reminder" | "second-reminder" | "collection" }
// packages/billing/index.ts also has: export type { DunningStandingQuery } from "./src/service/dunning-standing"
```

```ts
// packages/billing/src/service/invoice-order.ts — called for shop's OrderPlaced and OrderPaid
export const createInvoiceOrder = (d: { transactions: TransactionPort; handled: HandledMessages; invoices: InvoiceRepository;
  sequences: SequenceRepository; outbox: BillingOutbox; clock: Clock; ids: Ids }) =>
  (m: { messageId: string; order: OrderToInvoice }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const existing = await d.invoices.byOrderId(m.order.orderId, tx)          // step 6: OrderPaid finds the invoice OrderPlaced made
    if (!invoicesNow(m.order, existing)) return
    const now = d.clock.now()
    const { sequence, number } = takeNumber(await d.sequences.forYear(now.getUTCFullYear(), tx))
    const invoice = issueInvoice(m.order, { id: d.ids.next(), number, now })
    await d.sequences.save(sequence, tx)                                       // version-checked: concurrent issues serialize (TX-23)
    await d.invoices.save(invoice, tx)                                          // unique (order_id): a racing duplicate fails and retries (TX-38)
    await d.outbox.write({ type: "InvoiceIssued", id: d.ids.next(), invoiceId: invoice.id, number, orderId: invoice.orderId, total: invoice.total }, tx)
  })

// packages/billing/src/service/import-bank-transfers.ts — the scheduled task's one acting call (fixture: the bank reports transfers)
export const createImportBankTransfers = (d: { bank: BankStatements; transactions: TransactionPort; transfers: BankTransferRepository;
  cursor: ImportCursorRepository; outbox: BillingOutbox; ids: Ids }) => () =>
  d.transactions.run(async (tx) => {
    const since = await d.cursor.read(tx)                                       // inside the transaction (TX-1)
    const page = await d.bank.transfersSince(since)                             // a read of the outside; the bank's terms stop in the adapter
    for (const t of page.transfers) {
      if (await d.transfers.byBankRef(t.bankRef, tx)) continue                  // the bank reports a transfer again: no change (TX-5 second means)
      const transfer = bankTransferSchema.parse({ ...t, id: d.ids.next(), version: 1, status: "unmatched", invoiceId: null, reason: null })
      await d.transfers.save(transfer, tx)
      await d.outbox.write({ type: "MatchTransfer", id: d.ids.next(), transferId: transfer.id }, tx)    // private
    }
    await d.cursor.save(page.next, since, tx)                                    // version-checked against `since`: two runs, one wins
  })
// packages/billing/src/service/match-transfer.ts — called for billing's private MatchTransfer
export const createMatchTransfer = (d: { transactions: TransactionPort; handled: HandledMessages; transfers: BankTransferRepository;
  invoices: InvoiceRepository; dunnings: CustomerDunningRepository; outbox: BillingOutbox; clock: Clock; ids: Ids }) =>
  (m: { messageId: string; transferId: string }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const transfer = await d.transfers.byId(m.transferId, tx)
    if (!transfer) throw new Error(`transfer ${m.transferId} missing`)
    const r = matchTransfer(transfer, await d.invoices.byReference(transfer.reference, tx))
    await d.transfers.save(r.transfer, tx)
    if (!r.invoice) return
    await d.invoices.save(r.invoice, tx)
    await d.outbox.write({ type: "InvoicePaid", id: d.ids.next(), invoiceId: r.invoice.id, orderId: r.invoice.orderId }, tx)
    const dunning = await d.dunnings.byCustomer(r.invoice.customerId, tx)
    const cleared = dunning && clearIfSettled(dunning, await d.invoices.overdueOf(r.invoice.customerId, d.clock.now(), tx))
    if (cleared) {
      await d.dunnings.save(cleared, tx)                                         // a concurrent raise fails one of the two (TX-23)
      await d.outbox.write({ type: "DunningStageChanged", id: d.ids.next(), customerId: cleared.customerId, stage: cleared.stage, version: cleared.version }, tx)
    }
  })

// packages/billing/src/service/start-dunning-run.ts + raise-dunning-stage.ts — scheduled daily; one message per customer
export const createStartDunningRun = (d: { transactions: TransactionPort; invoices: InvoiceRepository; outbox: BillingOutbox; clock: Clock; ids: Ids }) =>
  () => d.transactions.run(async (tx) => {
    for (const customerId of await d.invoices.customersWithOverdue(d.clock.now(), tx))
      await d.outbox.write({ type: "RaiseDunningStage", id: d.ids.next(), customerId }, tx)
  })
export const createRaiseDunningStage = (d: { transactions: TransactionPort; handled: HandledMessages; invoices: InvoiceRepository;
  dunnings: CustomerDunningRepository; outbox: BillingOutbox; clock: Clock; ids: Ids }) =>
  (m: { messageId: string; customerId: string }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const current = (await d.dunnings.byCustomer(m.customerId, tx)) ?? { customerId: m.customerId, version: 1, stage: "none" }
    const raised = raiseIfOverdue(current, await d.invoices.overdueOf(m.customerId, d.clock.now(), tx))   // decided again, on its own records
    if (!raised) return
    await d.dunnings.save(raised, tx)
    await d.outbox.write({ type: "DunningStageChanged", id: d.ids.next(), customerId: raised.customerId, stage: raised.stage, version: raised.version }, tx)
    await d.outbox.write({ type: "SendDunningReminder", id: d.ids.next(), customerId: raised.customerId, stage: raised.stage, dunningVersion: raised.version }, tx)
  })
// send-dunning-reminder.ts: mailer.send(reminderMail(m), `dunning:${m.customerId}:${m.dunningVersion}`) — no decision (TX-37, TX-31)

// packages/billing/src/service/issue-credit-note.ts — called for payment's PaymentRefunded (an event, TX-33)
export const createIssueCreditNote = (d: { transactions: TransactionPort; handled: HandledMessages; invoices: InvoiceRepository;
  creditNotes: CreditNoteRepository; clock: Clock; ids: Ids }) =>
  (m: { messageId: string; refundId: string; orderId: string; amount: Money }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const note = creditNoteFor(await d.invoices.byOrderId(m.orderId, tx), m, { id: d.ids.next(), now: d.clock.now() })
    if (note) await d.creditNotes.save(note, tx)
  })

// packages/billing/src/service/dunning-standing.ts — open host service shop calls in-process; answers, takes no transaction (TX-25)
export type DunningStandingQuery = (i: z.infer<typeof dunningStandingInputSchema>) => Promise<DunningStandingAnswer>
export const createDunningStanding = (d: { dunningReads: DunningReads }): DunningStandingQuery =>
  async ({ customerId }) => ({ stage: (await d.dunningReads.stageOf(customerId)) ?? "none" })   // its own pool, never shop's transaction
```

```ts
// packages/billing/src/adapters/driven/bank/statements.ts — anti-corruption layer: the bank's terms stop here
export const createBankStatements = (http: { fetch: typeof fetch; baseUrl: string; token: string }): BankStatements => ({
  async transfersSince(cursor) {
    const res = await http.fetch(`${http.baseUrl}/accounts/main/transactions?after=${encodeURIComponent(cursor ?? "")}`,
                                 { headers: { authorization: `Bearer ${http.token}` } })
    if (!res.ok) throw new Error(`bank ${res.status}`)
    const body = bankPageSchema.parse(await res.json())                         // e.g. { entries: [{ entryReference, amount: { value, ccy }, remittanceInfo, bookingDate }], next }
    return {
      next: body.next,
      transfers: body.entries.filter((e) => e.creditDebitIndicator === "CRDT").map((e) => ({
        bankRef: e.entryReference, amount: { amount: Math.round(Number(e.amount.value) * 100), currency: "EUR" as const },
        reference: (e.remittanceInfo ?? "").trim(), bookedAt: new Date(e.bookingDate).toISOString(),
      })),
    }
  },
})
```

The handlers parse shop's `orderPlacedSchema` and `orderPaidSchema` and translate each into
`OrderToInvoice` (`event: "placed"` or `"paid"`). They also parse payment's
`paymentRefundedSchema`. Each calls one use case.

`buildBilling({ db, bank: { fetch, baseUrl, token }, mail: { resend, from }, clock, ids })` returns:

- `openHost: { dunningStanding }`;
- the handlers;
- two schedules: `billing.bank-import` every 10 minutes and `billing.dunning-run` daily;
- its outbox reader.

### fulfillment

Fulfillment owns Stock, Reservation and Shipment. It runs in the worker process with its own entry
point and assembly. The 3PL sits behind an anti-corruption layer both ways: the warehouse client
out, and a hook on the worker's own HTTP server in.

The fulfillment worker keeps `OrderFulfillment`, a replica of shop's order state (glossary:
Replica): it is keyed by shop's order id and filled from shop's events, so TX-26 and TX-27 hold for it. The
reservation itself is held as quantities in each sku's `Stock` aggregate, so the decision to
reserve is made on aggregates the use case saves (TX-24).

```ts
// packages/fulfillment/src/domain/order-fulfillment.ts
import { z } from "zod"
import { skuSchema, type Sku } from "@teeladen/kernel"
const line = z.object({ sku: skuSchema, quantity: z.number().int().positive() })
export const orderFulfillmentSchema = z.object({
  orderId: z.string(), version: z.number().int().positive(),
  shopVersion: z.number().int().nonnegative(),                               // highest shop order version seen (TX-19)
  shopStatus: z.enum(["unknown", "placed", "paid", "cancelled"]),
  paymentMethod: z.enum(["card", "invoice"]).nullable(),
  lines: z.array(line),
  reservation: z.enum(["none", "held", "released", "lapsed"]),
  heldSince: z.string().datetime().nullable(),
  shipmentId: z.string().nullable(),
})
export type OrderFulfillment = z.infer<typeof orderFulfillmentSchema>
export type Line = z.infer<typeof line>
export type ShopOrderState = { orderId: string; shopVersion: number; status: "placed" | "paid" | "cancelled";
                               paymentMethod: "card" | "invoice" | null; lines: Line[] | null }   // fulfillment's terms
/** TX-27, business rule: this copy lags shop. Holding stock on a lagging "placed" is accepted, because a later cancel releases it
 *  or the hold lapses. Shipping on a lagging "paid" is accepted, because shop never turns paid back. */
export type Plan = { fulfillment: OrderFulfillment; reserve: Line[]; release: Line[]; ship: boolean }
export const applyShopOrder = (f: OrderFulfillment | null, m: ShopOrderState, now: Date): Plan | null => {
  const cur = f ?? orderFulfillmentSchema.parse({ orderId: m.orderId, version: 1, shopVersion: 0, shopStatus: "unknown",
    paymentMethod: null, lines: [], reservation: "none", heldSince: null, shipmentId: null })
  if (m.shopVersion <= cur.shopVersion) return null                      // an older or repeated state: the higher version stands
  const lines = m.lines ?? cur.lines
  const method = m.paymentMethod ?? cur.paymentMethod
  const hold = m.status !== "cancelled"
  const reserve = hold && cur.reservation !== "held" ? lines : []         // a paid order whose hold lapsed is held again (TX-35)
  const release = !hold && cur.reservation === "held" ? cur.lines : []    // a cancel before the placement releases nothing (fixture)
  const ship = cur.shipmentId === null && (m.status === "paid" || (m.status === "placed" && method === "invoice"))
  return {
    reserve, release, ship,
    fulfillment: orderFulfillmentSchema.parse({ ...cur, version: f ? cur.version + 1 : 1, shopVersion: m.shopVersion, shopStatus: m.status,
      paymentMethod: method, lines, reservation: hold ? "held" : release.length > 0 ? "released" : cur.reservation,
      heldSince: reserve.length > 0 ? now.toISOString() : cur.heldSince }),
  }
}
/** Business rule (TX-30): a card order's hold lapses 48 h after it was taken if shop has not said paid or cancelled,
 *  because shop's OrderCancelled may be parked where no delivery rule reaches it. */
export const HOLD_MS = 48 * 3_600_000
export const lapseIfDue = (f: OrderFulfillment, now: Date): OrderFulfillment | null =>
  f.reservation === "held" && f.shopStatus === "placed" && f.paymentMethod === "card" && f.heldSince !== null
    && now.getTime() - new Date(f.heldSince).getTime() > HOLD_MS
    ? { ...f, reservation: "lapsed", version: f.version + 1 } : null

// packages/fulfillment/src/domain/stock.ts
export const stockSchema = z.object({ sku: skuSchema, version: z.number().int().positive(), onHand: z.number().int(), reserved: z.number().int().nonnegative() })
export type Stock = z.infer<typeof stockSchema>
/** Business rule (N18): a reservation is taken even beyond what is on hand (backorder); the 3PL ships when goods arrive. */
export const reserveOn = (s: Stock, quantity: number): Stock => ({ ...s, reserved: s.reserved + quantity, version: s.version + 1 })
export const releaseOn = (s: Stock, quantity: number): Stock => ({ ...s, reserved: Math.max(0, s.reserved - quantity), version: s.version + 1 })
export const available = (s: Stock): number => s.onHand - s.reserved

// packages/fulfillment/src/domain/shipment.ts
export const shipmentSchema = z.object({ id: z.string(), version: z.number().int().positive(), orderId: z.string(), lines: z.array(line),
  status: z.enum(["awaiting-articles", "booking-requested", "booked", "dispatched"]), bookingRef: z.string().nullable(), trackingUrl: z.string().nullable() })
export type Shipment = z.infer<typeof shipmentSchema>
/** Fixture: the 3PL ships no sku it has not registered. A shipment waits until each of its skus is registered.
 *  The registration's own handler releases it, and a sweep repairs a release missed by a race (TX-24's delay). */
export const planShipment = (id: string, f: OrderFulfillment, registered: ReadonlySet<Sku>): Shipment =>
  shipmentSchema.parse({ id, version: 1, orderId: f.orderId, lines: f.lines, bookingRef: null, trackingUrl: null,
    status: f.lines.every((l) => registered.has(l.sku)) ? "booking-requested" : "awaiting-articles" })
export const readyToBook = (s: Shipment, registered: ReadonlySet<Sku>): Shipment | null =>
  s.status === "awaiting-articles" && s.lines.every((l) => registered.has(l.sku)) ? { ...s, status: "booking-requested", version: s.version + 1 } : null
/** Records the 3PL's answer; a repeat delivery keeps the first booking (TX-37: no decision, a set, not a toggle). */
export const recordBooking = (s: Shipment, ref: string): Shipment | null =>
  s.bookingRef !== null ? null : { ...s, status: "booked", bookingRef: ref, version: s.version + 1 }
export const recordDispatch = (s: Shipment, trackingUrl: string): Shipment | null =>
  s.status === "dispatched" ? null : { ...s, status: "dispatched", trackingUrl, version: s.version + 1 }

// packages/fulfillment/src/domain/article-registration.ts
export const articleRegistrationSchema = z.object({ sku: skuSchema, version: z.number().int().positive(), status: z.enum(["pending", "registered"]) })
export type ArticleRegistration = z.infer<typeof articleRegistrationSchema>
/** Fixture: each new sku is registered with the 3PL's article master. */
export const registrationFor = (existing: ArticleRegistration | null, sku: Sku): ArticleRegistration | null =>
  existing ? null : { sku, version: 1, status: "pending" }
```

```ts
// packages/fulfillment/src/published/index.ts
export const stockLevelChangedSchema = z.object({ type: z.literal("StockLevelChanged"), id: z.string(), sku: skuSchema,
  available: z.number().int(), version: z.number().int().positive() })                // a later one overrides an earlier (TX-32)
export const shipmentDispatchedSchema = z.object({ type: z.literal("ShipmentDispatched"), id: z.string(), orderId: z.string(),
  shipmentId: z.string(), trackingUrl: z.string().url() })
```

```ts
// packages/fulfillment/src/service/apply-shop-order.ts — called for shop's OrderPlaced, OrderPaid, OrderCancelled
export const createApplyShopOrder = (d: { transactions: TransactionPort; handled: HandledMessages; fulfillments: OrderFulfillmentRepository;
  stock: StockRepository; registrations: ArticleRegistrationRepository; shipments: ShipmentRepository; outbox: FulfillmentOutbox; clock: Clock; ids: Ids }) =>
  (m: { messageId: string; state: ShopOrderState }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const plan = applyShopOrder(await d.fulfillments.byOrderId(m.state.orderId, tx), m.state, d.clock.now())
    if (!plan) return
    for (const l of plan.reserve) {
      const s = reserveOn(await d.stock.bySku(l.sku, tx), l.quantity)
      await d.stock.save(s, tx)                                               // version-checked: two holds on one sku serialize (TX-24)
      await d.outbox.write({ type: "StockLevelChanged", id: d.ids.next(), sku: s.sku, available: available(s), version: s.version }, tx)
    }
    for (const l of plan.release) {
      const s = releaseOn(await d.stock.bySku(l.sku, tx), l.quantity)
      await d.stock.save(s, tx)
      await d.outbox.write({ type: "StockLevelChanged", id: d.ids.next(), sku: s.sku, available: available(s), version: s.version }, tx)
    }
    let fulfillment = plan.fulfillment
    if (plan.ship) {
      const shipment = planShipment(d.ids.next(), fulfillment, await d.registrations.registeredAmong(fulfillment.lines.map((l) => l.sku), tx))
      await d.shipments.save(shipment, tx)
      fulfillment = { ...fulfillment, shipmentId: shipment.id }
      if (shipment.status === "booking-requested")
        await d.outbox.write({ type: "BookShipment", id: d.ids.next(), shipmentId: shipment.id, lines: shipment.lines }, tx)   // TX-22
    }
    await d.fulfillments.save(fulfillment, tx)
  })

// note-catalog-product.ts — called for catalog's ProductChanged (TX-29): decides, writes a message (TX-22)
export const createNoteCatalogProduct = (d: { transactions: TransactionPort; handled: HandledMessages; registrations: ArticleRegistrationRepository; outbox: FulfillmentOutbox; ids: Ids }) =>
  (m: { messageId: string; sku: Sku; title: string }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(m.messageId, tx))) return
    const registration = registrationFor(await d.registrations.bySku(m.sku, tx), m.sku)
    if (!registration) return
    await d.registrations.save(registration, tx)
    await d.outbox.write({ type: "RegisterArticle", id: d.ids.next(), sku: m.sku, title: m.title }, tx)   // private
  })
// register-article.ts — called for the private RegisterArticle: makes the 3PL call, records the answer (TX-37, TX-31)
export const createRegisterArticle = (d: { warehouse: Warehouse; transactions: TransactionPort; registrations: ArticleRegistrationRepository; outbox: FulfillmentOutbox; ids: Ids }) =>
  async (m: { sku: Sku; title: string }) => {
    await d.warehouse.upsertArticle({ sku: m.sku, title: m.title }, `article:${m.sku}`)
    await d.transactions.run(async (tx) => {
      const r = await d.registrations.bySku(m.sku, tx)
      if (!r || r.status === "registered") return                              // a repeat records nothing
      await d.registrations.save({ ...r, status: "registered", version: r.version + 1 }, tx)
      await d.outbox.write({ type: "ArticleRegistered", id: d.ids.next(), sku: m.sku }, tx)            // private
    })
  }
// release-awaiting-shipments.ts — called for the private ArticleRegistered and by the hourly sweep (repairs a missed release)
export const createReleaseAwaitingShipments = (d: { transactions: TransactionPort; shipments: ShipmentRepository; registrations: ArticleRegistrationRepository; outbox: FulfillmentOutbox; ids: Ids }) =>
  (m: { sku: Sku | null }) => d.transactions.run(async (tx) => {
    for (const s of await d.shipments.awaitingArticles(m.sku, tx)) {
      const ready = readyToBook(s, await d.registrations.registeredAmong(s.lines.map((l) => l.sku), tx))
      if (!ready) continue
      await d.shipments.save(ready, tx)
      await d.outbox.write({ type: "BookShipment", id: d.ids.next(), shipmentId: ready.id, lines: ready.lines }, tx)
    }
  })
// book-shipment.ts — called for the private BookShipment (TX-37); the key is what the change is about (TX-31)
export const createBookShipment = (d: { warehouse: Warehouse; transactions: TransactionPort; shipments: ShipmentRepository }) =>
  async (m: { shipmentId: string; lines: Line[] }) => {
    const booking = await d.warehouse.book({ reference: m.shipmentId, lines: m.lines }, `shipment:${m.shipmentId}`)
    await d.transactions.run(async (tx) => {
      const s = await d.shipments.byId(m.shipmentId, tx)
      const booked = s && recordBooking(s, booking.ref)
      if (booked) await d.shipments.save(booked, tx)                             // the whole aggregate, version-checked (SVC-4)
    })
  }
// record-dispatch.ts — called by the 3PL hook
export const createRecordDispatch = (d: { transactions: TransactionPort; handled: HandledMessages; shipments: ShipmentRepository; outbox: FulfillmentOutbox; ids: Ids }) =>
  (e: { eventId: string; bookingRef: string; trackingUrl: string }) => d.transactions.run(async (tx) => {
    if (!(await d.handled.claim(e.eventId, tx))) return
    const s = await d.shipments.byBookingRef(e.bookingRef, tx)
    if (!s) throw new Error(`no shipment booked as ${e.bookingRef}`)            // the 3PL resends; a stop no business rule decides (TX-38)
    const dispatched = recordDispatch(s, e.trackingUrl)
    if (!dispatched) return
    await d.shipments.save(dispatched, tx)
    await d.outbox.write({ type: "ShipmentDispatched", id: d.ids.next(), orderId: s.orderId, shipmentId: s.id, trackingUrl: e.trackingUrl }, tx)
  })
// start-hold-sweep.ts + lapse-hold.ts — hourly: one LapseHold per due order; the handler re-decides on its own records and releases stock
```

```ts
// packages/fulfillment/src/adapters/driven/threepl/warehouse.ts — anti-corruption layer out
export const createThreePlWarehouse = (c: { fetch: typeof fetch; baseUrl: string; apiKey: string }): Warehouse => ({
  async upsertArticle(a, key) {
    const res = await c.fetch(`${c.baseUrl}/articles/${encodeURIComponent(a.sku)}`, { method: "PUT",
      headers: { "x-api-key": c.apiKey, "idempotency-key": key, "content-type": "application/json" },
      body: JSON.stringify({ article_number: a.sku, description: a.title }) })
    if (!res.ok) throw new Error(`3pl article ${res.status}`)
  },
  async book(s, key) {
    const res = await c.fetch(`${c.baseUrl}/consignments`, { method: "POST",
      headers: { "x-api-key": c.apiKey, "idempotency-key": key, "content-type": "application/json" },
      body: JSON.stringify({ client_reference: s.reference, items: s.lines.map((l) => ({ article_number: l.sku, qty: l.quantity })) }) })
    if (!res.ok) throw new Error(`3pl booking ${res.status}`)
    return { ref: threePlConsignmentSchema.parse(await res.json()).consignment_id }
  },
})

// packages/fulfillment/src/adapters/driving/http/threepl-hook.ts — anti-corruption layer in; assembly builds it with the service
import type { IncomingMessage, ServerResponse } from "node:http"
export const createThreePlHook = (recordDispatch: RecordDispatch, secret: string) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readBody(req)
    if (!signedBy3pl(body, req.headers["x-3pl-signature"], secret)) { res.writeHead(401).end(); return }
    const e = threePlEventSchema.parse(JSON.parse(body))                       // the 3PL's terms stop here
    if (e.event === "consignment.dispatched")
      await recordDispatch({ eventId: e.event_id, bookingRef: e.consignment_id, trackingUrl: e.tracking.url })
    res.writeHead(204).end()                                                   // a throw above answers 500 (server wrapper): the 3PL resends (DRV-7)
  }
```

```ts
// apps/fulfillment-worker/otel.mjs — preloaded: node --import ./otel.mjs ./main.js (auto-instrumentation before any other import)
import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
new NodeSDK({ serviceName: "teeladen-fulfillment", traceExporter: new OTLPTraceExporter({ url: process.env.JAEGER_OTLP_URL }),
              instrumentations: [getNodeAutoInstrumentations()] }).start()

// apps/fulfillment-worker/main.ts — the worker's own entry point and its one assembly (ASM-1)
import { createServer } from "node:http"
import { Pool } from "pg"
import PgBoss from "pg-boss"
import { createDb, createBus, createRelay, startSchedules, systemClock, randomIds } from "@teeladen/common"
import { buildFulfillment } from "@teeladen/fulfillment/build"
import { healthProbe, metricsProbe, routeRequests } from "./probe-server"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = createDb(pool)
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL })
const fulfillment = buildFulfillment({
  db, clock: systemClock, ids: randomIds,
  warehouse: { fetch, baseUrl: process.env.THREEPL_URL ?? "", apiKey: process.env.THREEPL_KEY ?? "" },
  threePlSecret: process.env.THREEPL_WEBHOOK_SECRET ?? "",
})
const bus = createBus({ boss, subscriptions: fulfillment.handlers })
const relay = createRelay({ readers: [fulfillment.outboxReader], bus })
await boss.start()
await bus.start()
startSchedules([...fulfillment.schedules, { name: "fulfillment.relay", everyMs: 1_000, run: relay.tick }])
createServer(routeRequests({
  "POST /hooks/3pl": fulfillment.hooks.threePl,                               // built by the builder with recordDispatch: no courier
  "GET /health": healthProbe(pool),
  "GET /metrics": metricsProbe,
})).listen(Number(process.env.PORT ?? 8080))
```

The `buildFulfillment` builder takes `{ db, warehouse: { fetch, baseUrl, apiKey }, threePlSecret, clock, ids }`
and returns:

- `handlers` for shop's three order events (translated into `ShopOrderState`), catalog's
  `ProductChanged`, and the private `RegisterArticle`, `ArticleRegistered`, `BookShipment` and
  `LapseHold`;
- `hooks.threePl`;
- `schedules`: the hold sweep and the awaiting-shipment sweep, both hourly;
- `outboxReader`.

The fake on `@teeladen/fulfillment/testing` is unneeded, because no one calls fulfillment's
open host service.

### common library

The common library holds plumbing only, with no schema, aggregate or business rule (ASM-6). The
fixture's "unit of work kept ambient in `AsyncLocalStorage`" is replaced by an opaque `Transaction`
handed as an argument (ASM-9). `AsyncLocalStorage` remains only inside OpenTelemetry's own context.
The library knows no system: the relay and the bus get readers and subscriptions from assembly
(ASM-5).

```ts
// packages/common/src/transaction.ts — opaque: no store's name reaches a service or a domain
export class Transaction { readonly #opaque = true }                      // nominal by its private field; only drizzle.ts makes one

// packages/common/src/drizzle.ts — the Drizzle client factory and the narrowing driven adapters use
import type { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Transaction } from "./transaction"
export type Db = NodePgDatabase
export type DrizzleTx = Parameters<Parameters<Db["transaction"]>[0]>[0]
export const createDb = (pool: Pool): Db => drizzle(pool)
const open = new WeakMap<Transaction, DrizzleTx>()
/** Implements each system's TransactionPort (declared in that system's service layer, SVC-1/SVC-7). */
export const createDrizzleTransactions = (db: Db) => ({
  run: <T>(work: (tx: Transaction) => Promise<T>): Promise<T> =>
    db.transaction(async (dtx) => {
      const tx = new Transaction()
      open.set(tx, dtx)
      try { return await work(tx) } finally { open.delete(tx) }
    }),
})
export const asDrizzle = (tx: Transaction): DrizzleTx => {
  const dtx = open.get(tx)
  if (!dtx) throw new Error("transaction not open")                        // used after commit, or never opened here
  return dtx
}
export class StaleAggregate extends Error { constructor(kind: string, id: string) { super(`${kind} ${id} changed since it was loaded`) } }

// packages/common/src/clock.ts, ids.ts — implementations; each system declares its own Clock/Ids port (SVC-7)
export const systemClock = { now: (): Date => new Date() }
export const randomIds = { next: (): string => crypto.randomUUID() }

// packages/common/src/slot.ts — the courier: one value per slot, filled by assembly, read by framework-called adapters
export type Slot<T> = { fill(value: T): void; read(): T }
export const createSlot = <T>(name: string): Slot<T> => {
  let value: T | undefined
  return {
    fill: (v) => { value = v },
    read: () => { if (value === undefined) throw new Error(`courier "${name}" empty: assembly has not run`); return value },
  }
}

// packages/common/src/envelope.ts, relay.ts
export type Envelope = { id: string; type: string; payload: unknown; headers: Record<string, string>; writtenAt: string }
export interface OutboxReader { next(limit: number): Promise<readonly Envelope[]>; markDelivered(ids: readonly string[]): Promise<void> }
export interface Publisher { publish(e: Envelope): Promise<void> }
export const createRelay = (deps: { readers: readonly OutboxReader[]; bus: Publisher }) => ({
  async tick(): Promise<void> {
    for (const reader of deps.readers) {
      const batch = await reader.next(100)
      for (const e of batch) await deps.bus.publish(e)                     // handed over before it is marked (TX-20)
      if (batch.length > 0) await reader.markDelivered(batch.map((e) => e.id))
    }
  },
})

// packages/common/src/bus.ts — durable bus on pg-boss: kept in Postgres through any stop, retried, parked in a dead-letter queue (TX-21)
import type PgBoss from "pg-boss"
export type Subscription = { system: string; type: string; handle(e: Envelope): Promise<void> }
export const createBus = (deps: { boss: PgBoss; subscriptions: readonly Subscription[] }) => ({
  async start(): Promise<void> {
    for (const s of deps.subscriptions) {
      const queue = `${s.system}.${s.type}`
      await deps.boss.createQueue(queue, { retryLimit: 12, retryBackoff: true, deadLetter: `${queue}.dead` })
      await deps.boss.subscribe(s.type, queue)                             // the receiver subscribes; the publisher names nobody (TX-17)
      await deps.boss.work<Envelope>(queue, async ([job]) => runHandler(s.handle, job.data))   // a throw: no settle, retried (DRV-7)
    }
  },
  publish: async (e: Envelope): Promise<void> => { await deps.boss.publish(e.type, e) },
})

// packages/common/src/run-handler.ts — trace context and request id cross on the envelope; the transaction does not
import { context, propagation } from "@opentelemetry/api"
export const runHandler = (handle: (e: Envelope) => Promise<void>, e: Envelope): Promise<void> =>
  context.with(propagation.extract(context.active(), e.headers), () => handle(e))

// packages/common/src/tracer.ts, logger.ts, meter.ts — telemetry, imported ready-made by services and adapters (ASM-7)
import { trace, context, propagation } from "@opentelemetry/api"
export const tracer = trace.getTracer("teeladen")                         // a no-op tracer where no SDK is registered (fixture)
export const traceHeaders = (): Record<string, string> => {               // traceparent + baggage (request id)
  const h: Record<string, string> = {}
  propagation.inject(context.active(), h)
  return h
}
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" })
export const metrics = new Registry()                                      // prom-client; /metrics serves it

// packages/common/src/schedule.ts — scheduled tasks are driving adapters assembly constructs with what they call
export type Schedule = { name: string; everyMs: number; run(): Promise<void> }
export const startSchedules = (schedules: readonly Schedule[]): void => {
  for (const s of schedules) setInterval(() => { s.run().catch((e) => logger.error({ err: e, schedule: s.name }, "schedule failed")) }, s.everyMs)
}
```

Every system's outbox is a Drizzle adapter of the same shape. It reads the ambient trace context
through the common library: telemetry, which changes neither what a use case does nor what it
answers (ASM-3, ASM-7; N23).

```ts
// packages/shop/src/adapters/driven/drizzle/outbox.ts
import { asDrizzle, traceHeaders } from "@teeladen/common"
import type { ShopOutbox } from "../../../service/ports"
import { shopOutbox } from "./schema"
export const createDrizzleShopOutbox = (): ShopOutbox => ({
  async write(message, tx) {
    await asDrizzle(tx).insert(shopOutbox).values({ id: message.id, type: message.type, payload: message, headers: traceHeaders() })
  },
})
```

The web process's assembly:

```ts
// apps/web/otel.mjs — NODE_OPTIONS="--import ./otel.mjs next start": auto-instrumentation loads before Next imports pg (fixture)

// apps/web/instrumentation.ts — the one assembly of the web process (ASM-1); Next awaits register() before the first request
import { createDb, createBus, createRelay, startSchedules, systemClock, randomIds } from "@teeladen/common"
import { buildShop } from "@teeladen/shop/build"
import { buildPayment } from "@teeladen/payment/build"
import { buildBilling } from "@teeladen/billing/build"
import { buildBackoffice } from "@teeladen/backoffice/build"
import { createStockReplicaHandler } from "@teeladen/catalog"

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { Pool } = await import("pg")
  const { default: PgBoss } = await import("pg-boss")
  const { default: Stripe } = await import("stripe")
  const { Resend } = await import("resend")
  const { getPayload } = await import("payload")
  const { default: config } = await import("./payload.config")
  const { payloadOutboxReader } = await import("./payload-outbox-reader")
  const { startProbeServer } = await import("./probe-server")

  const env = process.env
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const db = createDb(pool)
  const boss = new PgBoss({ connectionString: env.DATABASE_URL })
  const resend = new Resend(env.RESEND_KEY)
  const clock = systemClock, ids = randomIds
  const payload = await getPayload({ config })                     // its config holds shop's hook; the hook reads the slot when it runs
  const billing = buildBilling({ db, clock, ids, bank: { fetch, baseUrl: env.BANK_URL ?? "", token: env.BANK_TOKEN ?? "" },
                                 mail: { resend, from: "rechnung@teeladen.example" } })
  const payment = buildPayment({ db, clock, ids, stripe: new Stripe(env.STRIPE_SECRET_KEY ?? ""), webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "" })
  const shop = buildShop({ db, payload, clock, ids, mail: { resend, from: "bestellung@teeladen.example" },
                           upstreams: { requestPayment: payment.openHost.requestPayment, dunningStanding: billing.openHost.dunningStanding } })
  const backoffice = buildBackoffice({ db, clock })
  const bus = createBus({ boss, subscriptions: [...shop.handlers, ...payment.handlers, ...billing.handlers, ...backoffice.handlers,
                                                 createStockReplicaHandler(payload)] })
  const relay = createRelay({ readers: [shop.outboxReader, payment.outboxReader, billing.outboxReader, payloadOutboxReader(payload)], bus })
  await boss.start()
  await bus.start()
  startSchedules([...shop.schedules, ...payment.schedules, ...billing.schedules, { name: "web.relay", everyMs: 1_000, run: relay.tick }])
  startProbeServer({ port: Number(env.PROBE_PORT ?? 9464), pool })   // /health and /metrics: probes, outside the layers (N4)
}
```

The builders fill the slots inside `register()`: shop's in `buildShop`, payment's in
`buildPayment`, backoffice's in `buildBackoffice`. A builder filling a slot is assembly filling it
(ASM-8's Why). Next awaits `register()` before it serves a request, and Payload's admin is served
through Next.

### The checkout saga

The saga is choreographed: each system reacts to the others' events. Commands go only where a
system asks another for a change it owns: shop's `RefundPayment`, which is payment's command
(SYS-13).

| step | where | what commits together | what crosses |
| --- | --- | --- | --- |
| 1 | shop `checkout` (web) | Order v1, cleared Cart, `OrderPlaced`, `SendOrderConfirmation` | relay → bus → fulfillment `applyShopOrder` reserves on `Stock` (TX-24) and emits `StockLevelChanged`; billing `invoiceOrder` invoices only if `paymentMethod: "invoice"`; backoffice records the row |
| 2 | shop `checkout` after commit → payment `requestPayment` (in-process, TX-36) | payment: Payment `pending` with `answerDueBy` | `client_secret` back to the route; on failure the route answers 5xx and the Order's deadline cancels it (TX-30) |
| 3 | payment's Stripe hook → `recordStripeOutcome` | Payment `succeeded` + `PaymentSucceeded`; or (intent canceled) `failed` + `PaymentFailed` | events to shop; `payment_failed` attempts change nothing (N11) |
| 4 | shop `applyPaymentSucceeded` | Order v2 `paid` + `OrderPaid` | billing `invoiceOrder` (card: invoices now; VAT from each line's tax class; gapless number); fulfillment `applyShopOrder` plans the Shipment → `BookShipment` (or waits for article registration) |
| 5 | shop `applyPaymentFailed`, or `startDeadlineSweep` → `CancelIfOverdue` → `cancelIfOverdue` | Order v2 `cancelled` + `OrderCancelled` | fulfillment releases; an `OrderCancelled` before `OrderPlaced` arrives at a higher version, so the later placement holds nothing (TX-19) |
| 6 | billing `invoiceOrder` on `OrderPlaced` (invoice); `importBankTransfers` → `MatchTransfer` → `matchTransfer` | Invoice `paid` + `InvoicePaid` (+ cleared dunning + `DunningStageChanged`) | shop `applyInvoicePaid` → Order `paid` + `OrderPaid`; billing finds the invoice (`invoicesNow` false); fulfillment finds `shipmentId` set (`ship` false) |
| 7 | shop `applyPaymentSucceeded` on a cancelled Order | Order v3 with `refund: requested` + payment's `RefundPayment` (through `RefundRequests`) | payment `refundPayment`: `RefundRefused` (disputed) or Refund + `ExecuteStripeRefund` → Stripe → `PaymentRefunded`; billing's credit note only against an invoice (N10); shop records the answer |

The failure paths, each decided by a business rule:

- **The webhook never comes** (Stripe stops after three days). Payment's `answerDueBy` runs
  reconciliation, which settles by what Stripe holds, or abandons the payment and cancels the intent
  through the outbox (TX-30, TX-22).
- **`OrderCancelled` parked in a dead-letter queue.** Fulfillment's hold lapses after 48 h (TX-30).
  A later `OrderPaid` holds again and ships (TX-35).
- **Refund unanswered for 7 days.** Shop flags it `unanswered` in `cancelIfOverdue`'s sweep (TX-30).
- **Billing down during an invoice checkout.** The checkout fails visibly, because shop's rule needs
  billing's answer now (P15). Card checkouts do not call billing.

Two code fragments the table leans on, not shown above:

```ts
// packages/billing/src/adapters/driving/handlers.ts — shop's events in billing's terms (anti-corruption layer)
import { orderPlacedSchema, orderPaidSchema } from "@teeladen/shop"
import { paymentRefundedSchema } from "@teeladen/payment"
const toInvoicing = (m: { orderId: string; customerId: string; paymentMethod: "card" | "invoice"; lines: OrderPlaced["lines"] }, event: "placed" | "paid"): OrderToInvoice =>
  ({ orderId: m.orderId, customerId: m.customerId, paymentMethod: m.paymentMethod, event, lines: m.lines })
export const createBillingHandlers = (s: BillingServices): Subscription[] => [
  { system: "billing", type: "OrderPlaced", handle: async (e) => { const m = orderPlacedSchema.parse(e.payload); await s.invoiceOrder({ messageId: m.id, order: toInvoicing(m, "placed") }) } },
  { system: "billing", type: "OrderPaid", handle: async (e) => { const m = orderPaidSchema.parse(e.payload); await s.invoiceOrder({ messageId: m.id, order: toInvoicing(m, "paid") }) } },
  { system: "billing", type: "PaymentRefunded", handle: async (e) => { const m = paymentRefundedSchema.parse(e.payload); await s.issueCreditNote({ messageId: m.id, refundId: m.refundId, orderId: m.orderId, amount: m.amount }) } },
  // private: MatchTransfer, RaiseDunningStage, SendDunningReminder
]

// packages/fulfillment/src/adapters/driving/handlers.ts — shop's three order events as one state, by version
const handleOrder = (s: FulfillmentServices) => async (e: Envelope) => {
  const m = shopOrderEventSchema.parse(e.payload)            // z.discriminatedUnion over shop's three schemas
  await s.applyShopOrder({ messageId: m.id, state: {
    orderId: m.orderId, shopVersion: m.orderVersion,
    status: m.type === "OrderPlaced" ? "placed" : m.type === "OrderPaid" ? "paid" : "cancelled",
    paymentMethod: m.type === "OrderCancelled" ? null : m.paymentMethod,
    lines: m.type === "OrderCancelled" ? null : m.lines.map(({ sku, quantity }) => ({ sku, quantity })),
  } })
}
```

### Cross-cutting reads

**Admin dashboard.** The fixture says the dashboard "joins orders, invoices and shipments in the
one Postgres". Joining the three systems' own tables is code outside each system reaching it past
its offer (SYS-9). It would also be a read of their records past their published language (TX-12,
P11). It is placed in a system of its own, backoffice, which keeps replicas of the three systems'
events (TX-26). The page joins backoffice's own replica tables, so the join stays one Postgres
query (N3).

```ts
// packages/backoffice/src/domain/order-overview.ts — replicas, in backoffice's terms, under the owners' ids
export const orderRowSchema = z.object({ orderId: z.string(), version: z.number().int().positive(), orderVersion: z.number().int().positive(),
  status: z.enum(["placed", "paid", "cancelled"]), total: moneySchema.nullable(), placedAt: z.string().datetime().nullable() })
export type OrderRow = z.infer<typeof orderRowSchema>
/** TX-19: the higher order version stands; fields only an earlier message carries are kept. */
export const applyOrderEvent = (cur: OrderRow | null, e: { orderId: string; orderVersion: number; status: OrderRow["status"];
  total: Money | null; placedAt: string | null }): OrderRow | null =>
  cur && cur.orderVersion >= e.orderVersion ? null
  : orderRowSchema.parse({ orderId: e.orderId, version: (cur?.version ?? 0) + 1, orderVersion: e.orderVersion, status: e.status,
      total: e.total ?? cur?.total ?? null, placedAt: e.placedAt ?? cur?.placedAt ?? null })
export type InvoiceRow = { orderId: string; number: string; paid: boolean }        // set once on InvoiceIssued, paid on InvoicePaid
export type ShipmentRow = { orderId: string; trackingUrl: string }                 // set on ShipmentDispatched
// record-order-event.ts, record-invoice-issued.ts, record-invoice-paid.ts, record-shipment-dispatched.ts:
// claim the message id, load the row, apply, save, all in one transaction (TX-1, TX-5)

// packages/backoffice/src/service/ports/index.ts
export interface OrdersOverviewQuery { recent(since: Date): Promise<OverviewLine[]> }   // answering; the join sits in the adapter (SVC-7)
// packages/backoffice/src/service/orders-overview.ts
export const createOrdersOverview = (d: { query: OrdersOverviewQuery; clock: Clock }) =>
  () => d.query.recent(new Date(d.clock.now().getTime() - 30 * 86_400_000))

// packages/backoffice/src/adapters/driven/drizzle/orders-overview-query.ts — the one join, over backoffice's own tables
export const createOrdersOverviewQuery = (db: Db): OrdersOverviewQuery => ({
  recent: (since) => db.select({ orderId: orderRows.orderId, status: orderRows.status, total: orderRows.total,
      invoiceNumber: invoiceRows.number, invoicePaid: invoiceRows.paid, trackingUrl: shipmentRows.trackingUrl })
    .from(orderRows)
    .leftJoin(invoiceRows, eq(invoiceRows.orderId, orderRows.orderId))
    .leftJoin(shipmentRows, eq(shipmentRows.orderId, orderRows.orderId))
    .where(gte(orderRows.placedAt, since.toISOString())).orderBy(desc(orderRows.placedAt)),
})

// packages/backoffice/src/adapters/driving/next/orders-page.ts — a server component Next finds; reads backoffice's slot when it renders
export const createOrdersPage = (slot: Slot<{ ordersOverview: () => Promise<OverviewLine[]> }>) =>
  async function OrdersPage() { return OrdersTable({ rows: await slot.read().ordersOverview() }) }

// apps/web/app/admin/orders/page.tsx
import { buildBackofficePages } from "@teeladen/backoffice/build"
export default buildBackofficePages().orders
```

The admin's authentication is out of scope (the-world.md Scope: security).

**A Payload edit revalidates the cached shop page.** Catalog tells of the edit with a message its
own transaction writes (TX-29; catalog section). The `ProductChanged` reaches shop in two hops.
Shop's `decidePageRevalidation` decides the paths and writes the private `RevalidatePages`
(TX-22). `revalidatePages` then makes the change and decides nothing (TX-37). The page cache lives
in the web process, and so do shop's handlers. A rolled-back edit writes no message, so no page is
revalidated for an edit that never happened (TX-28 is out of Scope, because no hook runs before
the commit). Fulfillment's `noteCatalogProduct` handles the same message for the 3PL's article
master.

**`/health` and `/metrics`.** These are probes (glossary), outside the layers (Assumptions).
Assembly constructs them and hands them the pool, on a probe server it starts itself. A Next route
could reach the pool only through the courier, which ASM-4 keeps for driving adapters, or through
a ready-made pool, which is what `asm-2-breach-ready-made-store-client.md` shows (N4).

```ts
// apps/web/probe-server.ts — started by assembly; /health pings the database the process uses, /metrics serves the registry
import { createServer } from "node:http"
import type { Pool } from "pg"
import { metrics } from "@teeladen/common"
export const startProbeServer = (d: { port: number; pool: Pool }): void => {
  createServer(async (req, res) => {
    if (req.url === "/health") {
      try { await d.pool.query("select 1"); res.writeHead(200).end("ok") }
      catch { res.writeHead(503).end("database down") }
      return
    }
    if (req.url === "/metrics") { res.writeHead(200, { "content-type": metrics.contentType }).end(await metrics.metrics()); return }
    res.writeHead(404).end()
  }).listen(d.port)
}
```

**Request id and trace context across systems.** The request id travels as OpenTelemetry baggage.
Each outbox adapter puts `traceHeaders()` on the envelope, and `runHandler` restores them before
the handler runs. A handler with no envelope context gets OpenTelemetry's no-op span (fixture). The
transaction crosses nothing: no driving port takes one (TX-25), and none is ambient (ASM-9).

## New ok examples

These cover fixture situations that no existing `*-ok-*` file covers, or covers only with a breach (listed below the examples).

### tx-25-ok-checkout-asks-billing-while-holding-its-transaction.md
```yaml
breaches: []
satisfies: [TX-25, ASM-9, TX-12, TX-1, TX-6]
situation: shop calls billing's open host service in-process while holding its own transaction (pay-by-invoice, dunning)
```
# Checkout asks billing about dunning inside its transaction; nothing of the transaction crosses
```ts
// packages/billing/src/service/dunning-standing.ts — billing's open host service: answers, takes no transaction
export type DunningStandingQuery = (i: { customerId: string }) => Promise<{ stage: "none" | "reminder" | "second-reminder" | "collection" }>
export const createDunningStanding = (d: { dunningReads: DunningReads }): DunningStandingQuery =>
  async ({ customerId }) => ({ stage: (await d.dunningReads.stageOf(customerId)) ?? "none" })

// packages/shop/src/adapters/driven/upstream/dunning-standings.ts — shop's driven port, billing's service behind it
export const createDunningStandings = (q: DunningStandingQuery): DunningStandings => ({
  of: async (customerId) => ({ inDunning: (await q({ customerId })).stage !== "none" }),
})

// packages/shop/src/service/checkout.ts (inside transactions.run)
if (needsDunningCheck(paymentMethod) && !mayPayByInvoice(await d.dunning.of(customer.customerId))) throw new InvoiceNotOffered()
const placed = placeOrder({ id: d.ids.next(), ...customer, paymentMethod, lines: linesFrom(cart, products), now: d.clock.now() })
await d.orders.save(placed, tx)
```
Shop's transaction is open when it calls billing, as the fixture has it. It is a value in shop's
signatures only:

- billing's `DunningStandingQuery` takes none (TX-25);
- the common library keeps none ambient (ASM-9);
- billing's `DunningReads` adapter reads on billing's own pool connection.

Billing's reads therefore cannot join shop's uncommitted writes, and moving billing out of process
changes one line of assembly. The read goes through billing's open host service (TX-12). Whether
pay-by-invoice is offered is shop's business rule (`mayPayByInvoice`), and so is accepting an
answer that billing may change before shop commits. No rule requires that acceptance for a live
answer (N15).

### dom-7-ok-billing-invoices-once-per-order.md
```yaml
breaches: []
satisfies: [DOM-7, TX-5, TX-19, TX-1, TX-6, TX-23]
situation: billing invoices on OrderPaid, or on OrderPlaced for pay-by-invoice; OrderPaid for an invoice order comes after (step 6); VAT by tax class; gapless numbers
```
# Which message invoices an order is billing's rule, in billing's domain
```ts
// packages/billing/src/domain/invoice.ts
export const VAT_BASIS_POINTS = { tea: 700, accessory: 1_900 } as const
export const invoicesNow = (o: OrderToInvoice, existing: Invoice | null): boolean =>
  existing === null && ((o.paymentMethod === "invoice" && o.event === "placed") || (o.paymentMethod === "card" && o.event === "paid"))

// packages/billing/src/service/invoice-order.ts — both handlers call this one use case
(m) => d.transactions.run(async (tx) => {
  if (!(await d.handled.claim(m.messageId, tx))) return
  if (!invoicesNow(m.order, await d.invoices.byOrderId(m.order.orderId, tx))) return
  const now = d.clock.now()
  const { sequence, number } = takeNumber(await d.sequences.forYear(now.getUTCFullYear(), tx))
  const invoice = issueInvoice(m.order, { id: d.ids.next(), number, now })      // each line: vat = includedTax(gross, VAT_BASIS_POINTS[taxClass])
  await d.sequences.save(sequence, tx)
  await d.invoices.save(invoice, tx)
  await d.outbox.write(invoiceIssued(invoice, d.ids.next()), tx)
})
```
The handlers translate and call. Neither knows which payment method invoices on which event:
`invoicesNow` states that once (DOM-7). A message id is claimed per message, and step 6's
`OrderPaid` carries a new id. What stops a second invoice is the business rule "one invoice per
order", checked on the record in the transaction that would write it. The same holds whatever order
`OrderPlaced` and `OrderPaid` arrive in (TX-19). The number comes from the year's sequence
aggregate, saved in the same transaction and version-checked (TX-23). A rolled-back issue gives its
number back, and two concurrent issues fail one of them. The number stays gapless without a lock
outside the store.

### drv-1-ok-scheduled-sweep-writes-one-message-per-due-order.md
```yaml
breaches: []
satisfies: [DRV-1, TX-1, TX-30, TX-5]
situation: shop's Order holds the payment deadline; once it passes, shop cancels the order (step 5)
```
# The deadline task makes one acting call; each due order is cancelled in its own transaction
```ts
// packages/shop/src/service/start-deadline-sweep.ts — the task's one acting call: one transaction, one message per due order
() => d.transactions.run(async (tx) => {
  for (const orderId of await d.orders.overdueIds(d.clock.now(), tx))
    await d.outbox.write({ type: "CancelIfOverdue", id: d.ids.next(), orderId }, tx)
})
// packages/shop/src/service/cancel-if-overdue.ts — called for the private message; decides again on shop's own records
(i) => d.transactions.run(async (tx) => {
  if (!(await d.handled.claim(i.messageId, tx))) return
  const order = await d.orders.byId(i.orderId, tx)
  if (!order) throw new OrderNotFound(i.orderId)
  const cancelled = cancelIfPastDeadline(order, d.clock.now())
  if (!cancelled) return                                            // paid meanwhile, or a sweep's duplicate
  await d.orders.save(cancelled, tx)
  await d.outbox.write(toOrderCancelled(cancelled, d.ids.next()), tx)
})
// apps/web/instrumentation.ts — assembly constructs the scheduled task with what it calls (no courier)
startSchedules([{ name: "shop.deadline-sweep", everyMs: 60_000, run: shop.services.startDeadlineSweep }])
```
The scheduled task is a driving adapter that makes one acting call (DRV-1). A batch use case in one
transaction would comply as well (DRV-1's Why). Here each order gets its own transaction, so a
`PaymentSucceeded` that wins the race on one order fails only that order's cancellation (TX-23),
not the whole minute's. Two sweeps that see the same order write two messages. The second finds the
order cancelled and changes nothing (TX-5). The deadline in the Order is the business rule that
ends shop's wait for payment (TX-30). The same shape runs:

- payment's reconciliation (`ReconcilePayment`);
- billing's dunning run (`RaiseDunningStage`);
- fulfillment's hold sweep (`LapseHold`).

### tx-5-ok-bank-transfers-imported-then-matched.md
```yaml
breaches: []
satisfies: [TX-5, TX-1, TX-6, TX-30, DOM-7]
situation: the bank API reports incoming transfers in the bank's terms; billing matches them to open invoices; some match none
```
# Billing imports what the bank reports, then matches each transfer by a message of its own
```ts
// packages/billing/src/service/import-bank-transfers.ts — scheduled; the bank's terms stop in the BankStatements adapter
() => d.transactions.run(async (tx) => {
  const since = await d.cursor.read(tx)
  const page = await d.bank.transfersSince(since)
  for (const t of page.transfers) {
    if (await d.transfers.byBankRef(t.bankRef, tx)) continue                     // reported again: no change
    const transfer = newTransfer(t, d.ids.next())
    await d.transfers.save(transfer, tx)
    await d.outbox.write({ type: "MatchTransfer", id: d.ids.next(), transferId: transfer.id }, tx)
  }
  await d.cursor.save(page.next, since, tx)
})
// packages/billing/src/domain/bank-transfer.ts
/** A transfer settles an open invoice when it names its reference and pays its total; a wrong reference or an amount short
 *  waits for a clerk, accepted as it stands. */
export const matchTransfer = (t: BankTransfer, invoice: Invoice | null) => /* matched | needs-review with a reason */
```
The bank may report a transfer twice, and billing's import may run twice over one page. The bank's
own reference is the key, so a repeat changes no record. The cursor is saved version-checked
against the value it was read at, so two overlapping runs fail one of them. Matching is its own use
case per transfer. A transfer that matches nothing is recorded `needs-review` with a reason: a
business rule's answer to "the payment this invoice waits for has not come in a form we can use"
(TX-30). It is neither retried until it parks nor dropped. A match marks the invoice paid, clears
the dunning stage if nothing else is overdue, and publishes `InvoicePaid` and `DunningStageChanged`
(versioned) in that one transaction.

### tx-22-ok-fulfillment-registers-new-sku-on-catalog-message.md
```yaml
breaches: []
satisfies: [TX-22, TX-37, TX-31, TX-5, TX-6]
situation: the 3PL's article master needs each SKU before it ships one; fulfillment registers each new SKU there
```
# Catalog's message makes fulfillment decide; a message of fulfillment's makes the 3PL call
```ts
// packages/fulfillment/src/service/note-catalog-product.ts — called for catalog's ProductChanged
(m) => d.transactions.run(async (tx) => {
  if (!(await d.handled.claim(m.messageId, tx))) return
  const registration = registrationFor(await d.registrations.bySku(m.sku, tx), m.sku)   // new sku? domain decides
  if (!registration) return
  await d.registrations.save(registration, tx)
  await d.outbox.write({ type: "RegisterArticle", id: d.ids.next(), sku: m.sku, title: m.title }, tx)
})
// packages/fulfillment/src/service/register-article.ts — called for the private RegisterArticle
async (m) => {
  await d.warehouse.upsertArticle({ sku: m.sku, title: m.title }, `article:${m.sku}`)    // key: what the change is about
  await d.transactions.run(async (tx) => {
    const r = await d.registrations.bySku(m.sku, tx)
    if (!r || r.status === "registered") return
    await d.registrations.save({ ...r, status: "registered", version: r.version + 1 }, tx)
    await d.outbox.write({ type: "ArticleRegistered", id: d.ids.next(), sku: m.sku }, tx)
  })
}
```
The decision commits with the message (TX-22). The use case for `RegisterArticle` makes the 3PL
call without deciding again (TX-37) and records the answer, as a set rather than a toggle, so a
repeat records nothing. The 3PL key is the sku, the same on any message asking to register it
(TX-31). A reconciliation that asks again therefore registers once. A shipment planned before the
registration commits waits as `awaiting-articles`. `ArticleRegistered`, and an hourly sweep for a
release missed by a race, move it to `BookShipment` (TX-24's delay, repaired by a later use case).

### drv-7-ok-3pl-webhook-settled-after-dispatch-recorded.md
```yaml
breaches: []
satisfies: [DRV-7, DRV-1, TX-5, TX-6, ASM-2]
situation: 3PL webhooks report shipments in the 3PL's terms; fulfillment runs in its own worker
```
# The worker's own HTTP server hosts the 3PL hook; it answers only after the use case committed
```ts
// packages/fulfillment/src/adapters/driving/http/threepl-hook.ts
export const createThreePlHook = (recordDispatch: RecordDispatch, secret: string) => async (req: IncomingMessage, res: ServerResponse) => {
  const body = await readBody(req)
  if (!signedBy3pl(body, req.headers["x-3pl-signature"], secret)) { res.writeHead(401).end(); return }
  const e = threePlEventSchema.parse(JSON.parse(body))                       // consignment_id, event_id, tracking: the 3PL's terms
  if (e.event === "consignment.dispatched") await recordDispatch({ eventId: e.event_id, bookingRef: e.consignment_id, trackingUrl: e.tracking.url })
  res.writeHead(204).end()
}
// apps/fulfillment-worker/main.ts
createServer(routeRequests({ "POST /hooks/3pl": fulfillment.hooks.threePl, "GET /health": healthProbe(pool), "GET /metrics": metricsProbe }))
```
The hook is built by fulfillment's builder with the service it calls. Assembly constructs it, so
no courier is needed (DRV-3 Scope does not hold). It parses and translates the 3PL's event, then
makes one call. It answers only once that call returned, and a throw becomes a 500 that the 3PL
resends (DRV-7). The 3PL's event id is claimed in the use case's transaction (TX-5), and
`recordDispatch` is a set. `ShipmentDispatched` commits with the shipment (TX-6). "Its worker
process has its own entry point and its own assembly" stays true: the HTTP listener is part of that
one entry point.

### tx-30-ok-fulfillment-hold-lapses.md
```yaml
breaches: []
satisfies: [TX-30, TX-35, TX-27, TX-24]
situation: fulfillment reserves stock on OrderPlaced and waits for shop's OrderPaid or OrderCancelled; a dropped cancel leaves stock reserved for a dead order
```
# Fulfillment's own rule ends its wait; a payment after the lapse holds again
```ts
// packages/fulfillment/src/domain/order-fulfillment.ts
export const HOLD_MS = 48 * 3_600_000
export const lapseIfDue = (f: OrderFulfillment, now: Date): OrderFulfillment | null =>
  f.reservation === "held" && f.shopStatus === "placed" && f.paymentMethod === "card" && f.heldSince !== null
    && now.getTime() - new Date(f.heldSince).getTime() > HOLD_MS ? { ...f, reservation: "lapsed", version: f.version + 1 } : null
// in applyShopOrder: `const reserve = hold && cur.reservation !== "held" ? lines : []` — a lapsed hold is taken again on OrderPaid
```
Shop's deadline guarantees an `OrderCancelled` only as far as delivery reaches. A message parked in
a dead-letter queue reaches nothing (TX-30's Why). Fulfillment therefore keeps a deadline in its
own aggregate and releases the stock when it passes. An `OrderPaid` that arrives after the lapse
tells fulfillment that its part cannot go on as it stands. The business rule (TX-35) holds the
stock again and ships, since a paid order is never cancelled by shop. The hold itself is quantities
on each sku's `Stock`, saved version-checked, so two holds on the last unit serialize (TX-24).
`OrderFulfillment` lags shop, and the rule above is the one that accepts that (TX-27).

### tx-26-ok-catalog-keeps-stock-replica-read-only.md
```yaml
breaches: []
satisfies: [TX-26, TX-32, TX-19, SYS-12]
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
```
# Catalog keeps fulfillment's figure as a replica; editors cannot write it
```ts
// packages/fulfillment/src/service/apply-shop-order.ts (inside the transaction that saves the Stock)
await d.outbox.write({ type: "StockLevelChanged", id: d.ids.next(), sku: s.sku, available: available(s), version: s.version }, tx)
// packages/catalog/src/collections/products.ts
{ name: "stock", type: "group", access: { create: () => false, update: () => false }, admin: { readOnly: true },
  fields: [{ name: "available", type: "number" }, { name: "version", type: "number" }] }
// packages/catalog/src/stock-replica.ts — catalog's handler; Local API, which overrides access
if ((product.stock?.version ?? 0) >= event.version) return
await payload.update({ collection: "products", id: product.id, data: { stock: { available: event.available, version: event.version } },
                       context: { origin: "stock-replica" } })
```
Fulfillment publishes the figure and names no keeper (TX-17). Catalog, the keeping system, writes
its copy from fulfillment's events (TX-26). A later level overrides an earlier one, so each carries
the `Stock` aggregate's version (TX-32), and the copy keeps the higher (TX-19). Editors read it in
the admin. The admin and the REST API cannot write it, which is SYS-12's means applied to a replica:
what the copy holds stays fulfillment's to decide (glossary: Owner). The admin shows the figure
while the fulfillment worker is down. The `origin` context keeps a replica refresh from posing as a
product change in catalog's outbox. How far the rules reach into a handler written in an external
system's configuration is N12.

### tx-36-ok-payment-creates-intent-then-records-it.md
```yaml
breaches: []
satisfies: [TX-36, TX-1, TX-30, TX-5]
situation: payment creates a Stripe PaymentIntent when shop's checkout calls it and returns its client_secret in the same call
```
# The intent is asked for first, keyed by the order; the Payment commits after
```ts
// packages/payment/src/service/request-payment.ts
async (i) => {
  const intent = await d.gateway.createIntent({ reference: i.orderId, amount: i.amount, idempotencyKey: `intent:${i.orderId}` })
  await d.transactions.run(async (tx) => {
    const opened = openPayment(await d.payments.byOrderId(i.orderId, tx),
      { id: d.ids.next(), orderId: i.orderId, amount: i.amount, intentRef: intent.ref, now: d.clock.now() })
    if (opened) await d.payments.save(opened, tx)
  })
  return { clientSecret: intent.clientSecret }
}
```
An unconfirmed PaymentIntent gives nothing until the customer confirms it, so it is a tentative
operation. Payment may ask for it by a call (TX-36), and shop may ask payment the same way, after
its own commit. If the process stops between Stripe's answer and payment's commit, the intent
exists and no Payment records it. Two things end that state:

- Stripe's webhook carries the order id in the intent's metadata, and `recordStripeOutcome` records
  the Payment it never saw;
- if no webhook comes, nothing is charged.

A repeated request gets the same intent from Stripe by the key, and records nothing a second time.
The Payment carries `answerDueBy`, and reconciliation acts on it (TX-30).

### tx-30-ok-payment-reconciles-one-message-per-overdue-payment.md
```yaml
breaches: []
satisfies: [TX-30, TX-1, TX-22, TX-37, TX-31]
situation: Stripe stops resending a webhook after three days
```
# Reconciliation in two hops: the sweep decides which, each payment settles in its own transaction
```ts
// payment/src/service/start-reconciliation.ts — scheduled every 5 minutes; one transaction
() => d.transactions.run(async (tx) => {
  for (const paymentId of await d.payments.overdueIds(d.clock.now(), tx))
    await d.outbox.write({ type: "ReconcilePayment", id: d.ids.next(), paymentId }, tx)
})
// payment/src/service/reconcile-payment.ts — asks Stripe (a read), then settles by payment's rule on the record it loads in the transaction
const atStripe = await d.gateway.intentStatus(m.intentRef)
await d.transactions.run(async (tx) => {
  if (!(await d.handled.claim(m.messageId, tx))) return
  const payment = await d.payments.byId(m.paymentId, tx)
  const settled = payment && settleOverdue(payment, atStripe, d.clock.now())
  if (!settled) return
  await d.payments.save(settled.payment, tx)
  if (settled.publish) await d.outbox.write(toPublished(settled.publish, settled.payment, d.ids.next()), tx)
  if (settled.cancelIntent) await d.outbox.write({ type: "CancelPaymentIntent", id: d.ids.next(), intentRef: payment.intentRef }, tx)
})
// payment/src/service/cancel-payment-intent.ts — no decision; a key from what the change is about
(m) => d.gateway.cancelIntent(m.intentRef, `cancel:${m.intentRef}`)
```
This is the compliant shape of `tx-30-ok-payment-asks-stripe-at-deadline.md`. That file runs one
use case through N transactions and loads outside any of them, which breaches TX-1. Here each use
case opens one transaction, and everything it decides by is loaded inside it. Abandoning an intent
nobody confirmed is decided in payment's transaction, and its cancellation at Stripe goes out
through the outbox (TX-22). The handler makes the call and decides nothing (TX-37).

### tx-35-ok-shop-records-refused-refund.md
```yaml
breaches: []
satisfies: [TX-35, TX-30, TX-5]
situation: shop asked for a refund (step 7); payment refuses a disputed charge
```
# Shop's domain decides what a refused or unanswered refund leaves
```ts
// packages/shop/src/domain/order.ts
export const onRefundAnswer = (o: Order, a: { refundId: string; refused: boolean; reason: string | null }): Order | null =>
  o.refund && o.refund.refundId === a.refundId && o.refund.status === "requested"
    ? next(o, { refund: { ...o.refund, status: a.refused ? "refused" : "done", reason: a.reason } }) : null
export const flagUnansweredRefund = (o: Order, now: Date): Order | null =>
  o.refund?.status === "requested" && now.getTime() - new Date(o.refund.requestedAt).getTime() > REFUND_ANSWER_MS
    ? next(o, { refund: { ...o.refund, status: "unanswered" } }) : null
```
Payment publishes `RefundRefused` and succeeds (TX-34). Shop holds the order the event meets, so
shop's rule decides: accept the refusal, record why, and leave the customer to staff. It neither
returns silently nor throws until the message parks (TX-35). A refund that payment never answers is
a wait like any other. After seven days shop's rule flags it (TX-30).

### tx-32-ok-shop-order-events-carry-order-version.md
```yaml
breaches: []
satisfies: [TX-32, TX-19, TX-5]
situation: OrderPaid or OrderCancelled can arrive before OrderPlaced at fulfillment
```
# Shop's order events carry the Order's version; fulfillment keeps the highest
```ts
// packages/shop/src/published/messages.ts
const order = { id: z.string(), orderId: z.string(), orderVersion: z.number().int().positive(), customerId: z.string() }
// packages/fulfillment/src/domain/order-fulfillment.ts
if (m.shopVersion <= cur.shopVersion) return null
```
For a receiver that keeps an order's state, a later order event overrides an earlier one, so each
carries the version the Order's save compared and raised (TX-32, TX-23). Fulfillment applies only
a higher version. Some orders of arrival:

- `OrderCancelled` (v2) before `OrderPlaced` (v1): fulfillment records the cancel and never holds
  the stock.
- `OrderPaid` (v2) before `OrderPlaced` (v1): fulfillment holds the stock and ships from the paid
  message's lines.
- The placement then arrives: in either case it changes nothing.

The result is the same whatever the order (TX-19). Backoffice's order rows use the same version.

### sys-1-ok-route-file-calls-route-builder.md
```yaml
breaches: []
satisfies: [SYS-1, SYS-9, DRV-3, DRV-6, ASM-4, ASM-8]
situation: Next finds shop's checkout route by its file in apps/web; checkout is no open host service
```
# The route file holds no code of shop's; a builder on shop's build path returns the adapter
```ts
// apps/web/app/api/checkout/route.ts
import { buildShopRoutes } from "@teeladen/shop/build"
export const { POST } = buildShopRoutes().checkout
// packages/shop/src/builders/routes.ts
export const buildShopRoutes = () => ({ checkout: { POST: createCheckoutRoute(shopSlot) } })
// packages/shop/src/builders/services.ts (in assembly)
shopSlot.fill({ checkout: services.checkout, identifySession: services.identifySession, openOrdersWithSku: services.openOrdersWithSku })
```
`Checkout` is offered to no other system, so its port type and request schema are no offer, and
shop cannot export them (SYS-1). The route file, outside shop's package, imports only a builder
from shop's build path (SYS-9). The adapter is shop's code and reads shop's slot when it runs
(DRV-6), because nothing can hand it the service when Next loads the file (DRV-3, ASM-4). Assembly
fills the slot through `buildShop` before Next serves a request (ASM-8). Calling the route builder
in the route file is not a second assembly: no port meets an implementation there (N5).

### svc-7-ok-clock-and-ids-through-ports.md
```yaml
breaches: []
satisfies: [SVC-7, DOM-1, ASM-2, DRV-8]
situation: shop places the order: its id, its placedAt and its payment deadline
```
# Neither the server action nor the domain reads the clock or draws a random id
```ts
// packages/shop/src/service/ports/index.ts
export interface Clock { now(): Date }
export interface Ids { next(): string }
// packages/shop/src/service/checkout.ts
const placed = placeOrder({ id: d.ids.next(), ...customer, paymentMethod, lines, now: d.clock.now() })
// packages/shop/src/domain/order.ts — computes from its arguments only
paymentDeadline: i.paymentMethod === "card" ? new Date(i.now.getTime() + PAYMENT_WINDOW_MS).toISOString() : null
// apps/web/instrumentation.ts
buildShop({ ..., clock: systemClock, ids: randomIds })
```
A clock and a random source reach outside the process (DOM-1's Why for the clock; the operating
system for randomness). So the domain takes both as arguments (DOM-1). The service reaches them
through ports of its own system (SVC-7) and gets them from its factory (ASM-2). The driving adapter
passes neither (DRV-8 has no clock on its list). A test hands a fixed clock and counting ids.
Compare `drv-1-ok-session-through-answering-service.md` and the other examples that put
`new Date()` in a driving adapter. `svc-7-breach-server-action-raw-sql-through-common-pool.md`
counts that as reaching the clock past a port.

### asm-1-ok-probes-served-by-assembly.md
```yaml
breaches: []
satisfies: [ASM-1, ASM-7]
situation: /health pings the database; /metrics is scraped
```
# Assembly starts the probe server and hands it the pool its systems use
```ts
// apps/web/instrumentation.ts (assembly)
startProbeServer({ port: Number(env.PROBE_PORT ?? 9464), pool })
// apps/web/probe-server.ts
if (req.url === "/health") { try { await d.pool.query("select 1"); res.writeHead(200).end("ok") } catch { res.writeHead(503).end() } }
if (req.url === "/metrics") res.writeHead(200, { "content-type": metrics.contentType }).end(await metrics.metrics())
```
Probes report on the process, not on a system, and sit outside the layers (Assumptions). The probe
pings the pool every system in the process uses, because assembly hands it that pool. It builds no
second pool, imports no ready-made one and reads no courier (ASM-4 keeps the courier for driving
adapters). Services and adapters record metrics into the common library's registry, imported
ready-made (ASM-7). The probe serves that registry. The cost is a second port for the probes. A
probe that must live at `/health` on Next's own port has no rule-compliant way to the pool (N4).

### tx-12-ok-backoffice-dashboard-joins-its-replicas.md
```yaml
breaches: []
satisfies: [TX-12, TX-26, SYS-9, SVC-7, TX-19]
situation: an admin dashboard joins orders, invoices and shipments in the one Postgres
```
# The dashboard's system keeps the three owners' events and joins its own tables
```ts
// packages/backoffice/src/adapters/driven/drizzle/orders-overview-query.ts
db.select({ orderId: orderRows.orderId, status: orderRows.status, invoiceNumber: invoiceRows.number, trackingUrl: shipmentRows.trackingUrl })
  .from(orderRows)
  .leftJoin(invoiceRows, eq(invoiceRows.orderId, orderRows.orderId))
  .leftJoin(shipmentRows, eq(shipmentRows.orderId, orderRows.orderId))
// packages/backoffice/src/domain/order-overview.ts — the higher order version stands
export const applyOrderEvent = (cur: OrderRow | null, e: OrderEventInBackofficeTerms) => cur && cur.orderVersion >= e.orderVersion ? null : /* … */
```
The join runs in the one Postgres, over backoffice's tables (shop's, billing's and fulfillment's
data never enters it):

- `order_rows`, from shop's events;
- `invoice_rows`, from `InvoiceIssued` and `InvoicePaid`;
- `shipment_rows`, from `ShipmentDispatched`.

TX-12 holds, because backoffice reads the owners' data from their published events, and TX-26,
because backoffice writes its replicas from them. SYS-9 holds, because backoffice imports only the
owners' schemas from their export paths. The dashboard lags by the relay's moment. A column
another system renames breaks nothing here, and the owners' rules, which decide what an order's
status means, have already spoken in the events. Compare
`sys-9-breach-dashboard-imports-drizzle-tables.md` and `gap-admin-dashboard-belongs-to-no-system.md`.

### tx-37-ok-pages-revalidated-without-deciding-again.md
```yaml
breaches: []
satisfies: [TX-22, TX-37, TX-5, TX-29]
situation: a Payload edit should revalidate the cached shop page
```
# Shop decides the paths on catalog's message; its own message makes the change
```ts
// packages/shop/src/service/decide-page-revalidation.ts — called for catalog's ProductChanged
(i) => d.transactions.run(async (tx) => {
  if (!(await d.handled.claim(i.messageId, tx))) return
  await d.outbox.write({ type: "RevalidatePages", id: d.ids.next(), paths: pagesToRevalidate(i) }, tx)
})
// packages/shop/src/service/revalidate-pages.ts — called for shop's private RevalidatePages
(i) => d.pages.revalidate(i.paths)
```
Catalog's message exists only if the edit committed (TX-29), so nothing here waits on a
confirmation. Which paths to revalidate is shop's decision. The new slug, the old slug and the
listing are a business rule in `pagesToRevalidate`, committed with a message (TX-22). The
revalidation is a change outside shop's transaction, and the use case that makes it decides
nothing (TX-37). A repeat revalidates again and changes no record (TX-5, second means). Compare
`tx-28-ok-after-change-hook-records-revalidation-request.md`, whose handler decides again by a
business rule (TX-37).

### sys-13-ok-shop-asks-for-refund-through-driven-port.md
```yaml
breaches: []
satisfies: [SYS-13, TX-3, TX-6, DVN-4, TX-33]
situation: a payment succeeds after shop's deadline cancelled the order; the customer gets the money back (step 7)
```
# Shop states the refund in its terms; its adapter writes payment's command into shop's outbox
```ts
// packages/shop/src/service/ports/index.ts
export interface RefundRequests { request(r: { refundId: string; orderId: string; amount: Money }, tx: Transaction): Promise<void> }
// packages/shop/src/adapters/driven/drizzle/refund-requests.ts
import { refundPayment } from "@teeladen/payment"
async request(r, tx) {
  const command = refundPayment({ id: r.refundId, refundId: r.refundId, orderId: r.orderId, amount: r.amount })
  await asDrizzle(tx).insert(shopOutbox).values({ id: command.id, type: command.type, payload: command, headers: traceHeaders() })
}
// apps/web/instrumentation.ts — only payment subscribes a handler to RefundPayment (TX-33)
```
The command is payment's, declared in payment's published language (SYS-13). Shop's service
speaks shop's terms through a driven port. The adapter, which may reach another system's published
language as "the outside" (DVN-4), writes payment's command into shop's outbox, in the transaction
that records the requested refund on the Order (TX-3, TX-6). The shape is the one SYS-13's Why
describes for a sender with an anti-corruption layer.

## Existing ok examples that do not hold

### Rule under satisfies the code does not meet

- **`asm-9-ok-transaction-handed-as-argument.md` — TX-1.** `deps.carts.load(cartId)` is a call into
  shop's store made before `deps.tx.begin()`, so the transaction is not handed to it. TX-1: "hand it
  to each call into its store". `placeOrder(cart)` then decides on a cart no transaction holds.
- **`svc-3-ok-place-order-writes-cart-itself.md` — TX-1.** `carts.findById(input.cartId)` runs before
  `transactions.run`, so the cart that `placeOrderFromCart` and `clearCart` decide by is read
  outside the transaction.
- **`svc-4-ok-mark-paid-through-repository.md` — TX-1.** `orders.findById(orderId)` runs before
  `transactions.run`. The decision (`isPaidBy`, `status !== "placed"`) is made on a read outside
  the transaction. SVC-2's own Relies-on line on TX-1 says "reads included".
- **`tx-22-ok-payment-requests-checkout-session.md` — TX-22.**
  - `requestCheckoutSession` decides a change outside its transaction (a Session at Stripe) and
    makes it by a call. TX-22's Statement forbids that. Only TX-36's MAY permits it, so TX-22 is
    overridden here, not satisfied. The example's own prose says so ("may request it in the call
    (TX-36)").
  - `recordPayment` decides no outside change, so TX-22's Scope does not hold for it.
  - Either way, TX-22 does not belong under `satisfies`.
- **`asm-3-ok-actor-through-driving-port.md` — ASM-3, met only under a narrow reading.** The driven
  adapter reads the ambient `requestId` and writes it into the audit column `price_changes.request_id`.
  ASM-3's Why says "That reaches what gets recorded too: … the user an audit column records arrive
  as arguments". Under that reading, an ambient value written into a record changes how the use case
  acts, so ASM-3 is breached. Under the reading "acts = what it decides", it holds. The example and
  ASM-3's Why disagree on the reading.
- **`sys-1-ok-shop-export-paths.md` — SYS-1.**
  - `index.ts` exports `PlaceOrder`, `Checkout` and `OrderDetails` as "driving port types". In the
    fixture, only shop's own server action, routes and hooks call them. The glossary defines the open
    host service as "the driving ports a system offers to other systems", and SYS-1's Why says such
    a port "is no offer either". So these exports are not of shop's offer.
  - `orderSchema`, `cartSchema` and `productCommercialSchema` are schemas of those ports. They are
    not published language, and `productCommercialSchema` publishes price and sku as shop's, which
    catalog owns (fixture).

### Rule under satisfies whose Scope the code does not reach

- **`asm-3-ok-confirmation-message-carries-locale.md` — ASM-3.** No service and no driven adapter reads
  an ambient value. The route reads `Accept-Language`, but it is a driving adapter, outside ASM-3's
  Scope. Where the Scope does not hold, the rule says nothing, so the example illustrates the
  alternative to ASM-3 and does not satisfy it.
- **`asm-3-ok-hook-passes-editor.md` — ASM-3.** Same: no service or driven adapter reads an ambient value.
- **`drv-1-ok-session-through-answering-service.md` — ASM-3.** Same. `cookies()` is read by a driving
  adapter.
- **`svc-2-ok-cancel-order-decides-itself.md` — ASM-3.** Same.
- **`tx-22-ok-order-confirmation-mail-through-outbox.md` — ASM-3.** Same: the locale is an argument
  everywhere, so nothing is read ambiently.
- **`tx-15-ok-customer-stats-follow-order-paid-by-message.md` — TX-15.** `markOrderPaid` writes the Order,
  which it relies on, and `recordSale` writes CustomerStats, which it relies on. No use case shown
  writes more aggregates than it relies on. TX-15's Scope never holds for code that complies (N8).
- **`svc-7-ok-order-overview-through-query-port.md` — TX-1.** The use case answers and writes nothing.
  TX-1's Scope is "a use case writes", and the example's own last sentence says so.
- **`tx-3-ok-checkout-requests-checkout-session.md` — TX-3.** The example's claim is that the call
  "changes nothing of payment's", in which case "a use case of this system changes data another
  system of this codebase owns" does not hold. Checkout's `OrderPlaced` leads fulfillment and
  billing to change their own data, but by their decisions, not by checkout's change.
- **`tx-31-ok-3pl-booking-keyed-by-shipment-id.md` — TX-22.** `bookShipment` decides nothing. TX-37's Why
  says "Deciding nothing, this use case falls outside TX-22's Scope", and the prose agrees ("The use
  case decides nothing"). The use case that decided is not shown.
- **`dom-4-ok-order-line-copies-price.md` — DOM-4.** DOM-4's Scope is "an aggregate needs something of
  another aggregate of the same system". The product is catalog's, and the payment is payment's
  aggregate, both in other systems. The snapshot is right by P1/P12 and the glossary, but DOM-4 does
  not reach it.
- **`svc-6-ok-opaque-transaction.md` — DOM-1.** No domain module is shown, and nothing shown is in
  DOM-1's Scope.
- **`sys-12-ok-shop-price-read-only-in-payload-admin.md` — SVC-4.** No use case writing an aggregate
  record is shown, only a driving adapter calling `changePrice`. The Scope is asserted in prose and
  absent from the code.

### Rule not listed that the code breaches, plus fixture facts broken

- **`asm-2-ok-assembly-hands-upstreams-to-builder.md` — SYS-1, SYS-9, ASM-2; fixture.**
  - Assembly imports `createPayloadCatalog`, a driven adapter of shop, from `@teeladen/shop`. SYS-1
    lets no adapter onto an export path, and SYS-9's Why says assembly "reaches a system through its
    builders, not its adapters".
  - `buildPayment({ tx, stripe: { secretKey } })` makes the builder, a factory by ASM-2's Why, build
    the Stripe client from a key. ASM-2: a factory needing "any other client of something outside
    the process … MUST receive it from its caller". Compare `asm-2-breach-stripe-client-as-ready-made-plumbing.md`.
  - Fixture: `syncPrice` and `createProductCommercialRepository` make shop write product price,
    which catalog owns.
- **`asm-8-ok-register-fills-courier-before-requests.md` — SYS-1, SYS-9, ASM-2.** The same
  `createPayloadCatalog` import and the same `stripe: { secretKey }`.
- **`asm-2-ok-handler-receives-service.md` — SYS-9.** The worker's assembly calls
  `buildFulfillmentHandlers({ stock, reservations, transactions, outbox })`, handing it
  fulfillment's repositories and outbox port implementation. Assembly can only have built those by
  importing fulfillment's driven adapters past its builders, which SYS-1 would not let onto an export
  path.
- **`asm-1-ok-fulfillment-worker-one-assembly.md` — ASM-2 (conditional).** `buildFulfillment` takes
  `warehouse: { baseUrl, apiKey }` and builds the 3PL client itself on the global `fetch`. If the
  builder "needs" the HTTP client, it must receive it (N6). The same holds for
  `buildPayment`-style key-only configuration.
- **`asm-7-ok-logger-and-tracer-imported-ready-made.md` — ASM-2 (conditional).**
  `fetchImpl: typeof fetch = fetch`: a caller that omits the argument gets the global client, which
  the factory takes in place.
- **`tst-8-ok-real-run-behind-env-flag.md` — ASM-2.** `createStripeGateway({ secretKey })` builds the
  Stripe client inside the adapter's factory, where `svc-7-ok-payment-reaches-stripe-through-gateway-port.md`
  hands the adapter `stripe: Stripe`.
- **`asm-2-ok-payload-adapter-takes-instance.md` — fixture.** Shop's repository writes `sku` and `price`
  onto Payload's products document. domain.md has catalog own "price, sku, tax class", and editors
  set them in the admin.
- **`svc-6-ok-opaque-transaction.md` — SVC-7 (contested); fixture.**
  - `Transactions` is declared in the common library ("common library port"), and services open
    the store's transaction through it. SVC-7 has a service reach the outside "through a port of its
    system", and its Why says such a port "is declared in its service layer (SVC-1)". SVC-6's Why
    ("the opaque transaction a service opens") reads the other way.
    `asm-9-ok-transaction-handed-as-argument.md` declares `TransactionPort` in shop's service layer,
    which meets both.
  - Fixture: shop writes catalog's price and sku. Shop's transaction is also narrowed to Payload's
    `transactionID`, so one transaction spans shop's and catalog's writes (P16; TX-3 if catalog
    counts as "of this codebase", N17).
- **`svc-1-ok-place-order-port-beside-service.md` — SYS-1; SVC-7 (contested).** `PlaceOrder` and
  `CancelOrder` are exported, but the situation names only shop's server action and Payload hooks as
  callers. Both are shop's own driving adapters (glossary: Hook). `Transactions` comes from
  `@teeladen/common/transaction` (see the previous item).
- **`sys-10-ok-port-types-exported-as-types.md` — SYS-1; SVC-7 (contested).** `Checkout` is exported,
  and no other system calls checkout. "A test in billing that wants `Checkout`" has nothing to fake.
  `Transactions` comes from `@teeladen/common/transactions`.
- **`asm-4-ok-route-handler-reads-courier.md` — SYS-1.** `@teeladen/shop/language` exports
  `CheckoutInput`, the input of a port no other system calls, so it is not published language
  (glossary: what another system needs to talk to this one).
- **`drv-3-ok-server-action-reads-courier.md` — SYS-1; SVC-7.**
  - Shop exports `shopServicesKey` and `shopServices` from `shop/courier-key.ts`, used by drv-6 as
    `@teeladen/shop/courier-key`. A courier key and an accessor that reads it are none of
    "published language, … driving port types, … system builders and the fakes".
  - `placedAt: new Date()` reads the clock in a driving adapter. DOM-1's Why counts a clock as
    reaching outside, and SVC-7 then requires a port. `svc-7-breach-server-action-raw-sql-through-common-pool.md`
    says "`new Date()` reaches the clock the same way".
- **`drv-6-ok-server-action-reads-at-run-time.md` — SYS-1; SVC-7.** It imports
  `@teeladen/shop/courier-key` and calls `now: new Date()`.
- **`drv-1-ok-session-through-answering-service.md` — SVC-7.** `now: new Date()` in the server action.
- **`asm-3-ok-hook-passes-editor.md` — TX-28, SVC-7; fixture.**
  - `afterChange` runs before Payload commits. The use case writes and commits
    `productPageInvalidated({ … })`, telling of a change that Payload may still roll back. That is
    neither a veto nor "a private message for a handler that checks the external system's committed
    state".
  - `changedAt: new Date()` reads the clock in the hook.
  - Fixture: `ProductCommercial` (price, sku) is treated as shop's.
- **`asm-3-ok-actor-through-driving-port.md` — TX-28; fixture.** `syncPriceAfterChange` is an
  `afterChange` hook, and `syncPrice` commits a price save in its own transaction before Payload
  commits the edit. The fixture has catalog own the price.
- **`svc-2-ok-cancel-order-decides-itself.md` — TX-1, TX-5.**
  - `orders.findById(orderId)` runs outside the transaction.
  - The prose names the `PaymentFailed` handler as a caller. A redelivery finds the order cancelled,
    `canBeCancelledBy` says no, and `CancelRefused` is thrown. The repeat does not "answer as the
    first did" (glossary: Idempotent), so the bus redelivers until it parks.
- **`svc-3-ok-place-order-writes-cart-itself.md` — DRV-8, TX-31.** The `SendOrderConfirmation` handler
  calls `mail.sendOrderConfirmation(...)`. `MailSender` is a driven port, and DRV-8's list has none.
  The use case it should call is missing. No idempotency key reaches the provider either, although
  `MailSender` in `svc-1-ok-driven-ports-in-service-layer.md` takes one.
- **`svc-4-ok-mark-paid-through-repository.md` — TX-35.** A `PaymentSucceeded` for an order the
  deadline cancelled (domain.md step 7) throws `NotPayable`. It is redelivered until it parks, and
  no business rule decides what follows. Compare `tx-35-breach-late-payment-dropped.md`.
- **`asm-9-ok-transaction-handed-as-argument.md` — SVC-4.** `deps.carts.clear(cartId, t)` writes the
  cart without saving the aggregate through its repository, and no version is compared.
- **`tx-1-ok-place-order-service-holds-transaction.md` — SVC-4.** `carts.clear(cart.id, tx)`: the same
  problem.
- **`tx-22-ok-order-confirmation-mail-through-outbox.md` — SVC-4, DOM-1.**
  - `carts.clear(cart.id, tx)`.
  - `randomUUID()` in `shop/domain/messages/send-order-confirmation.ts`. A random id "hands its
    caller [something] the caller did not pass" (glossary: Pure), so it is no pure code. DOM-1's list
    has nothing else it could be.
- **`tx-17-ok-fulfillment-subscribes-to-order-placed.md` — DOM-1, SYS-2; fixture.**
  - `randomUUID()` in `shop/domain/messages/order-placed.ts`.
  - `shop/published.ts` re-exports the published schemas from `./domain/messages`, where
    `orderPlaced(order: Order)` builds them, so the modules that declare the published language are
    domain modules (SYS-2).
  - Fixture: `OrderPlaced` carries neither the payment method (step 6: "OrderPlaced says so") nor the
    line's tax class that billing's VAT needs.
- **`tx-7-ok-gift-message-added-optional.md` — SYS-2.** `orderPlacedSchema` lives in
  `shop/domain/messages/order-placed.ts`, and its own comment says `skuSchema` is "re-used from the
  domain".
- **`dom-1-ok-order-schema-imports.md` — SYS-2; fixture.**
  - The prose says "billing, reading shop's published language, gets the same module": the domain's
    `orderSchema` is offered as published language.
  - Fixture: `Money` and `Sku` are the shared kernel, but here they are `./money` and `./sku`, domain
    modules of shop.
- **`tx-2-ok-reservation-lines-written-in-handed-transaction.md` — TX-23.** `save` upserts with
  `onConflictDoUpdate` and compares no version. A reservation loaded, changed elsewhere and saved
  here overwrites the other change. TX-23 is a MUST for every save of a loaded aggregate, and
  `tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md` saves loaded reservations
  through this port.
- **`tx-31-ok-3pl-booking-keyed-by-shipment-id.md` — SVC-4.** `shipments.recordBooking(shipmentId, ref, tx)`
  writes part of the Shipment aggregate through a repository method that is not a whole save.
- **`tx-30-ok-payment-asks-stripe-at-deadline.md` — TX-1.**
  - `settleOverduePayments` is one use case that opens one transaction per overdue payment, not one
    transaction.
  - It loads `payments.overdue(clock.now())` outside any transaction, and settles each payment from
    that stale load.
- **`tx-28-ok-after-change-hook-records-revalidation-request.md` — TX-37.** `revalidateProductPage` is
  called for `RevalidateProductPage`, which asks for a change its transaction does not commit (a page
  revalidation). It decides again whether to make it, by `givesUpWaiting(writtenAt, clock.now())`: "a
  business rule of its system". TX-37 forbids exactly that. The example meets TX-30 in the one place
  TX-37 rules out. The check of catalog's committed version is a check of the external system's
  state, which TX-37 does not name.
- **`tx-28-ok-before-change-hook-vetoes-sku-change.md` — DOM-7 (contested).** DOM-7's Why says: "A
  business rule of this system that an external system asks before it writes, catalog's veto of a
  sku change, stays here". The example states the veto rule in catalog's config ("The rule is
  catalog's"). Whose rule it is decides whether DOM-7's Scope holds. If it is shop's, the rule is
  stated outside shop's domain (N9).
- **`tx-6-ok-payment-succeeded-written-with-payment.md` — TX-19.** `applyOutcome` returns
  `failed(payment, outcome)` for any non-success, whatever the payment holds. Stripe delivers out of
  order, so a `payment_failed` that arrives after `succeeded` turns a paid Payment failed and
  publishes `PaymentFailed`, and shop cancels a paid order. The result depends on arrival order.
- **`tx-1-ok-one-invoice-transaction-per-message.md` — fixture.** Step 6: an invoice order is invoiced
  on `OrderPlaced`, and later "shop … publishes `OrderPaid`, which billing … [has] already acted on
  for this order". This handler issues an invoice on every `OrderPaid`. The new message id passes
  `handled.claim`, and a second invoice is issued with a second gapless number. The example also
  never invoices on `OrderPlaced`.
- **`tx-1-ok-refund-and-payment-in-one-transaction.md` — TX-5, TX-34 (on the fixture's caller).**
  domain.md: payment "refunds a payment when shop asks for it". By TX-3 that request is a message, so
  this use case is called for a delivered message.
  - It claims no id, so a redelivery refunds again while `mayRefund` still passes (TX-5).
  - A business-rule refusal (`RefundExceedsPayment`) is thrown rather than published (TX-34).
- **`sys-13-ok-checkout-process-sends-receivers-commands.md` — TX-5; fixture.**
  - `onOrderPlaced` and `onStockReserved` claim nothing. A redelivered `StockReserved` runs
    `whenStockReserved` again and writes a second `CreatePayment` with a new id, so the result
    changes.
  - Fixture: "Checkout must return a Stripe `client_secret` in the same request". A payment created
    by a command through the outbox cannot answer within the request.
- **`sys-12-ok-shop-price-read-only-in-payload-admin.md` — SYS-1.**
  `"@teeladen/shop/payload#ChangePriceButton"` puts a driving adapter of shop on an export path that
  catalog's config imports. That is no offer, and catalog reaches shop past it (SYS-9).
- **`dom-4-ok-order-line-copies-price.md` — fixture.** "`sku`: shop's own commercial field" and "shop
  raises the price" contradict catalog owning price and sku. The line has no tax class, which
  checkout copies (fixture) and billing needs.
- **`sys-2-ok-shop-messages-union.md` — fixture.** `OrderPlaced` has no payment method (step 6) and no
  tax class (billing's VAT). `OrderPaid` carries no lines, although billing invoices card orders on it
  (fixture) and `sys-9-ok-billing-imports-from-export-path.md` reads `event.lines`.
- **`sys-14-ok-money-returns-remainder.md` — fixture.** `orderPlacedSchema` has neither payment method
  nor tax class.
- **`svc-6-ok-place-order-dependencies.md` — fixture.** Placing the order writes no `OrderPlaced`
  (step 1: "shop places the order and publishes `OrderPlaced`") and reads no catalog product.
- **`tx-3-ok-checkout-requests-checkout-session.md`, `tx-1-ok-place-order-service-holds-transaction.md`,
  `asm-9-ok-transaction-handed-as-argument.md`, `svc-3-ok-place-order-writes-cart-itself.md` —
  fixture.** "Checkout copies each line's price, sku and tax class from catalog's product". These
  checkouts build the order from the cart alone and never read catalog.
- **`tx-12-ok-invoice-number-through-billing-port.md` — DOM-7.**
  `if (!order || order.customerId !== customerId) return null` decides in the service who may see an
  order. That is a business rule, and DOM-7 puts business rules in the domain. Compare `belongsTo`
  in this fixture's shop domain.

## Relies-on findings

- **SVC-2, line on DRV-8.** The line reads "DRV-8: a driving adapter reaches no driven port, driven
  adapter or service of its system."
  - DRV-8 guarantees that what a driving adapter reaches is one of: "what calls it, a driving port of
    its system, its system's domain, a shared kernel, its system's published language, the published
    language of an upstream, the common library, pure code of no system".
  - It excludes driven ports and driven adapters. It does not exclude the service: the glossary's
    Reach ("however the code got hold of it") makes a call through the driving port a reach of the
    service behind it.
  - SVC-2's argument needs only "no driven port, no repository, no store", so the line should say
    that (see the cannot-comply finding for the same Reach/Port gap).
- **TX-37, line on TX-31.** The line reads "TX-31: by default, a use case called for a message passes
  the external system a key the message carries, the same on every message asking for that change."
  - TX-31's Scope is "a use case called for a message changes something in an external system that
    takes an idempotency key". The line drops that condition.
  - For an external system with no key, TX-31 guarantees nothing. `tx-22-breach-claim-rolled-back-after-3pl-call.md`
    says this 3PL "lacks" one, and the fixture does not say.
  - TX-37's Why ("The call reaches idempotence through the owner's idempotency key") therefore
    stands on a rule that may not apply. Without a key, TX-37 plus TX-5 leaves only a record step
    that keeps the first answer (as `recordBooking` here does), while the outside effect repeats.

Every other Relies-on line of the rules this build touches was checked against its rule's Scope and
Statement and holds:

- DOM-1 → SYS-10, SYS-14; SVC-1 → SYS-10; SVC-6 → ASM-2, SYS-1;
- SVC-2 → TX-1, TX-2, TX-23, TX-24, SYS-1; SVC-3 → TX-1, ASM-9; SVC-4 → all;
- DRV-8 → ASM-2, DRV-3; DRV-1 → SVC-2, TX-1; DRV-3 → ASM-8; DRV-7 → TX-21, TX-1;
- DVN-4 → SYS-1, SYS-9;
- ASM-2 → ASM-1; ASM-10, ASM-7 → ASM-2, SVC-7; ASM-4 → ASM-1; ASM-8 → DRV-6, ASM-4, ASM-1;
  ASM-9 → TX-25; ASM-5 → ASM-2;
- TX-1 → TX-2, DRV-1; TX-2 → TX-1; TX-23 → TX-1, TX-2, SVC-4; TX-24 → TX-23, TX-1; TX-25 → TX-1;
- TX-15 → all; TX-3 → all; TX-22 → all; TX-36 → all; TX-31 → TX-21, DRV-7;
  TX-28 → TX-25, TX-1, TX-30; TX-29 → all; TX-35 → all; TX-6 → TX-1, TX-2; TX-20 → TX-5;
  TX-21 → all; TX-5 → TX-1, TX-2; TX-19 → TX-32; TX-34 → all; TX-38 → all;
  TX-12 → SYS-2, TX-7; TX-26 → TX-3, TX-17;
- SYS-15 → SYS-1 (via the glossary's Offer); SYS-9 → SYS-1; SYS-10 → SVC-1, SYS-2; SYS-2 → TX-7, SVC-6;
- TST-3, TST-10 → DOM-1; TST-4 → ASM-2, TST-5; TST-6 → TST-4; TST-8 → TST-6; TST-11 → TST-6, SYS-1.

## Notes

**N1. "A unit of work kept ambient in `AsyncLocalStorage`" (common library) and "while holding its own ambient transaction" (shop).**
I read both as situations. ASM-9 forbids a transaction as an ambient value, so the common library
offers an opaque `Transaction` handed as an argument. The in-process call to billing stays, made
inside shop's open transaction, and nothing of the transaction crosses. "Calls billing's open host
service in-process" is kept as a fact: it is the dunning check for pay-by-invoice.

**N2. "`afterChange` hooks call shop's services."**
Placed as catalog writing `ProductChanged` to its own outbox collection in Payload's transaction.
The fixture says Payload's transaction "can also write a document to a collection of its own, which
the relay can read". TX-29 asks for this placement (SHOULD). Followed literally, a hook calling shop
before Payload commits leaves shop only a tentative operation and a confirmation it must wait for
(TX-28, TX-30). It also runs into TX-37 if the handler that confirms is the one that acts (see
`tx-28-ok-after-change-hook-…`). The beforeChange veto keeps its hook, as the fixture has it.

**N3. "An admin dashboard joins orders, invoices and shipments in the one Postgres."**
I read the mechanism (a join across three systems' tables) as a situation, because that join is
SYS-9's and TX-12's breach. Placed as a system of its own (backoffice) with replicas. The join stays
a join in the one Postgres, over backoffice's tables. This adds a system to the fixture's table. The
alternative, three answering open host services joined in memory by code of no system, is the
existing gap example.

**N4. Probes.**
`/health` and `/metrics` are probes, outside the layers. Served on a probe server that assembly
starts, they get the pool as an argument. Served as Next route files on Next's port instead, they
are constructed by the framework, which leaves:

- the courier, which ASM-4 reserves for driving adapters, and a probe is not one;
- a ready-made pool, which no rule forbids to a probe (ASM-2's Scope is factories, ASM-7's is
  services and adapters), though `asm-2-breach-ready-made-store-client.md` shows its harm;
- a second pool of the probe's own.

So the rules are silent where the existing gap example says they are. The fixture's "`/health`
pings the database" is met. Whether it is "the" database pool the systems use is met only by the
probe-server placement.

**N5. Where a system's code is: by package or by role.**
Next finds route and server action files under `apps/web/app`. If a file there is shop's code (a
driving adapter, by role), it may import shop's domain and service types by deep path, and SYS-1
and SYS-9 are not engaged. A path-based linter, which SYS-9's Why relies on, would still flag it.
If the file is code outside shop (by location), it can import only shop's offer. Checkout's port and
request schema are not offer (SYS-1's Why), so the file can hold no adapter code. I resolved this
with a route builder on shop's build path, whose result the route file re-exports. That is
compliant only if calling a system builder at a route module's load is not "a second assembly". I
read that as allowed, because no port meets an implementation there. No rule or glossary entry says
which reading of "code of a system" holds. Several existing ok examples (`dom-3-ok`, `drv-3-ok`,
`drv-6-ok`, `svc-6-ok-place-order-dependencies`) put shop's driving adapters in `app/` and import
shop's domain or port types from shop's paths.

**N6. "Needs" in ASM-2 and the system builder.**
ASM-2's Why calls a system builder "a factory for its system". A builder needs port
implementations: it hands them to its services. Read literally, it must receive them, and then
assembly constructs adapters, which SYS-1 and SYS-9 forbid it to reach. I read "needs" as "needs
from outside the system": store clients, other clients of the outside, configuration values and
upstreams. The builder constructs its adapters from those.

So assembly constructs `new Stripe(key)`, `new Resend(key)` and `fetch` and hands them over. That
contradicts the glossary's System builder ("builds what it needs of the system without knowing its
internals or their defaults: it takes configuration and returns implementations"), because assembly
now knows that payment uses Stripe. The glossary binds nobody, so ASM-2 governs.

**N7. Clock and randomness are "the outside".**
DOM-1's Why: "a clock reach[es] outside". `svc-7-breach-server-action-raw-sql-through-common-pool.md`:
"`new Date()` reaches the clock the same way". The glossary's Outside includes the operating system.
So:

- every system declares `Clock` and `Ids` driven ports;
- the domain takes `now` and ids as arguments;
- no driving adapter reads the clock;
- no service calls `crypto.randomUUID()`, which is not on SVC-6's list as pure code (glossary: Pure,
  "hands its caller nothing the caller did not pass").

Consequence: Stripe's signature tolerance check needs the time. A webhook route verifying it with
the system clock reaches the outside past a port. My route verifies the HMAC only and leaves replay
protection out (security is out of scope by the-world.md). Several existing ok examples call
`new Date()` in driving adapters; they are listed above.

**N8. Scopes that compliant code leaves.**
ASM-3 ("a service … reads an ambient value") and TX-15 ("a use case writes more aggregates … than
it relies on") are worded so that the compliant alternative is outside their Scope. "Where the Scope
does not hold the rule says nothing", so an ok example of passing the value as an argument, or of
moving the write to a handler, satisfies nothing. For TX-15 every compliant use case is out of
Scope, and the rule's Statement ("SHOULD leave each write … to a handler") can only be met by code
the rule does not reach. Neither is a cannot-comply, but both make "satisfies" on the ok examples
misleading.

**N9. Whose rule is the sku veto?**
The fixture: "catalog's `beforeChange` asks shop how many open orders carry a sku, and refuses to
change a sku one does". DOM-7's Why: "A business rule of this system that an external system asks
before it writes, catalog's veto of a sku change, stays here". I placed it as the fixture says:
catalog's rule, catalog's config, shop's answering port.

If the rule is shop's (DOM-7's Why), SVC-2 binds as well: shop decides by what it has stored, and
"the service that acts" must enforce it "in the call that acts". The act is Payload's save, so shop
would need an acting use case: a `SkuGuard` aggregate per sku, saved by checkout and by the hook's
use case as a tentative hold (TX-28 allows that), confirmed by catalog's `ProductChanged`, and
lapsing by a rule (TX-30). Every checkout of a tea would then contend on that tea's guard. "Open
order" is undefined in the fixture. I took it as an order still waiting for payment (`status:
placed`).

**N10. "Issues a credit note for each refund."**
Step 7's refund is for an order cancelled before payment, which billing never invoiced: billing
invoices card orders on `OrderPaid`, and none came. A credit note corrects an invoice, so I made
billing's rule "a credit note only against an invoice" and record nothing else. That reads "each
refund" as "each refund of invoiced money". The other reading needs a credit note without an
invoice, which the fixture does not explain.

**N11. "`PaymentFailed`" read as terminal.**
Stripe's `payment_intent.payment_failed` is not terminal: the customer can retry on the same intent.
If payment published `PaymentFailed` on it and shop cancelled (step 5), then a later success would
be refunded (step 7). Delivered in the other order, the same pair leaves the order paid. That is a
TX-19 breach for shop's use cases, and versioning payment's messages does not cure it, because
shop's cancel is not undone by a higher version.

So payment publishes `PaymentFailed` only when the intent can no longer succeed: canceled at Stripe,
or abandoned by payment's reconciliation. Step 5 still holds ("On `PaymentFailed`, or once the
deadline passes, shop cancels"), with fewer `PaymentFailed`s.

**N12. External-system code inside the rules.**
The Assumptions list the parts of an external system's configuration that the rules reach: "what
may change the system's records it keeps (SYS-12), how it tells the system of a change (TX-29)".
Catalog's stock replica handler (a bus subscriber in catalog's package, writing through the Local
API) is neither. I treated it as in, for TX-26, TX-19 and TX-32, because it is code this codebase
writes that touches fulfillment's data. The rules do not say whether the list is closed.

Fulfillment "runs in its own worker process". I kept fulfillment's code out of the web process
entirely, so the stock figure reaches the admin as a replica, not by calling fulfillment. The 3PL
webhook is served by the worker's own HTTP listener.

**N13. Assumptions about third parties the fixture leaves open.**

- The 3PL takes an idempotency key on bookings and article upserts. Without one, see the Relies-on
  finding on TX-37.
- The bank API is polled. "Reports" could also be a hook; polling needs no TX-5 id, because the
  bank's entry reference is the record key.
- The mail provider takes idempotency keys. Resend does.
- The 3PL signs its webhooks.

**N14. Stores.**
All Drizzle-backed systems share one Postgres and one pool, and `createDrizzleTransactions` can
carry writes of any of them. By the glossary's Store definition ("two clients are one store when one
transaction can carry the writes of both") they are one store. Ownership separates them, not the
store. Payload uses its own pool and transactions, so catalog is a second store, even in the same
database. The rules never need "one store per system". TX-1's "a use case that writes writes one
store" holds.

**N15. Stale answers from another system's live open host service.**
Pay-by-invoice decides by billing's answer, and the order line by catalog's price, both read during
shop's transaction and possibly changed before it commits. P10 needs "a stale read a business rule
accepts". TX-27 requires that only for replicas, and TX-24's Scope excludes other systems' data.
No rule requires the business rule for a live answer from another system's open host service. I
wrote both acceptances into shop's domain anyway (`mayPayByInvoice`, `linesFrom` comments). This is
a gap, not a cannot-comply.

**N16. Next's `revalidatePath` from a bus handler.**
The page cache lives in the web process, so shop's `RevalidatePages` handler runs there. Next may
refuse `revalidatePath` outside a request or server action context, and with several web instances
only one instance's cache is revalidated. Both are stack matters: the adapter may need a shared
cache handler or `revalidateTag` over a shared cache. No rule is affected.

**N17. Undefined or loosely used words.**

- **"of this codebase"** (TX-3, TX-22, TX-34). Is catalog, an external system this codebase
  configures, "another system of this codebase"? TX-3 versus TX-22 depends on it whenever shop
  writes catalog's records (`svc-6-ok-opaque-transaction.md`). I avoided such writes.
- **"acknowledge"** (DRV-7, TX-21, TX-34, TX-38). The glossary defines **Settle** ("tells what
  delivered it that the message is done: the bus, through its acknowledgement; the external system
  behind a hook, through the hook's answer"), and no rule uses it. DRV-7's Statement spells out
  "to the bus or by its answer to the external system", which is Settle.
- **"open order"** (fixture): see N9.
- **"decides"** (SVC-2's Scope, TX-22, TX-37). Is a count returned to an external system that then
  decides a decision of this system's (N9)? Is a record step that keeps the first answer
  (`recordBooking`) "deciding again by the state of its records" (TX-37)? I read it as not, because
  the change is made regardless.
- **"handler"**. Next's "route handler" is a driving adapter but not a glossary Handler (it acts on
  requests, not messages). Payload's collection "hooks" in catalog's own config (the `beforeChange`
  that throws, the `afterChange` that writes the outbox) are catalog's code, not shop's Hooks.
- **"needs"** (ASM-2, ASM-10): see N6.
- **"a port of its system"** (SVC-7, SVC-6, DRV-8): see the cannot-comply finding and the SVC-7
  contest above.

**N18. Reservation beyond stock.**
The fixture does not say what happens when an order wants more than is on hand. I made it a
business rule: reserve anyway (backorder). Refusing would need a `ReservationFailed` event and a
saga step the fixture lacks (TX-35 on shop's side).

**N19. Fulfillment's order state is a replica.**
`OrderFulfillment` copies shop's order status under shop's order id, so it is a replica by the
glossary. TX-26 (written from shop's events) and TX-27 (decisions on it need a business rule
accepting the lag) apply. The rule is written into the domain. `tx-5-ok-fulfillment-claims-…`
keeps the same kind of record and states no such rule.

**N20. Catalog's messages and TX-32.**
`ProductChanged` messages do not override each other for their receivers:

- shop revalidates by paths;
- fulfillment registers each new sku once.

So they carry no version. A receiver that kept a copy of the product (slug, sku) would make them
override each other, and then catalog's config would owe a version. Payload's document `updatedAt`
is no version, because it comes from a clock (TX-32's Why).

**N21. A PaymentIntent as a tentative operation.**
The glossary: a tentative operation "holds what it asks for without giving it". An unconfirmed
PaymentIntent holds no funds. It reserves only the possibility of a charge the customer completes.
I counted it as tentative, following TX-36's and TX-30's Whys, which name the `client_secret` and
"a PaymentIntent nobody confirmed". Read strictly, "holds what it asks for" does not fit, and then
both shop's call to payment and payment's call to Stripe need the outbox (TX-3, TX-22). The fixture
fact "return its `client_secret` in the same call" could then not be met: that would be a
cannot-comply.

**N22. Catalog reads outside shop's transaction.**
Shop's `CatalogProducts.byIds` reads through Payload's Local API, on Payload's own pool, inside the
callback of shop's transaction but not in it. That is right: catalog's records are not shop's store
(N14). TX-1 ("each call into its store") does not reach it.

**N23. The request id and ambient reads in driven adapters.**
Each outbox adapter reads the ambient trace context and request id (OpenTelemetry baggage) and
writes them into the outbox row's `headers`. ASM-3's Why counts "what gets recorded". I read the
envelope headers as telemetry: ASM-3's last line keeps telemetry ambient, and the headers are not
part of the message's schema. Under the stricter reading, the only alternative is to carry the
request id through every driving port into every message, which ASM-7's Why calls pointless. The
fixture's "request id … should cross system boundaries" then has no ambient route.

**N24. Address and identity.**
The fixture names no shipping address and no customer identity. The fixture code carries
`customerId` and `email` from the session (an answering service, DRV-1). It omits the shipping
address, which would travel in `OrderPlaced` like the payment method.
