# Implementer review, distilled set

## Summary

- **cannot-comply, TX-22 × TX-28**: a hook catalog calls before its change commits cannot get a change outside shop's transaction made (page revalidation) when catalog does not write the message itself (TX-29 deviated from, or its Scope fails): TX-22 asks for an outbox message, TX-28 forbids any change of shop beyond recording a tentative operation, and an outbox row is a change.
- **cannot-comply, TX-3/TX-22 × fixture "checkout returns the PaymentIntent's `client_secret` in the same request"**: holds only if an unconfirmed PaymentIntent is a tentative operation (TX-36). If it is not, both the call shop → payment (TX-3) and payment → Stripe (TX-22) must go through outboxes and no `client_secret` reaches the browser in the request. The examples sidestep with a Checkout Session.
- **cannot-comply (on one reading), TX-5 × TX-37**: a handler that changes an external system taking no idempotency key (mail provider) cannot be idempotent without checking its own records, which TX-37 forbids. Holds only if "the records" in Idempotent includes the external system's records.
- **tension, DOM-7/DOM-3 × SYS-2 × DOM-1**: a published language cannot state a shop rule (`quantity` positive, tax class enum) without stating it a second time: SYS-2 forbids reaching the domain, DOM-1 forbids the domain reaching its own published language. Code can comply only by leaving the rule out of the published schema, or by moving it into the shared kernel.
- **fixture mechanisms the rules rule out, rebuilt**: ambient unit of work (ASM-9); shop calling billing while holding its ambient transaction (ASM-9, TX-25); `afterChange` hooks calling shop's services (TX-28, TX-29); admin dashboard joining the owners' tables (TX-12, P11). Each goal still builds. Code below.
- **tx-30-ok-payment-asks-stripe-at-deadline**: (c) TX-1: one use case runs one transaction per overdue payment.
- **tx-31-ok-3pl-booking-keyed-by-shipment-id**: (c) SVC-4: `shipments.recordBooking(id, ref, tx)` writes part of the Shipment. (b) TX-22 does not hold for book-shipment, which decides nothing; TX-37 is the rule that holds.
- **tx-28-ok-after-change-hook-records-revalidation-request**: (a) TX-28: the hook's use case writes an outbox row, which is no tentative operation. (c) TX-37: the handler decides again by shop's rule (`givesUpWaiting`).
- **sys-13-ok-checkout-process-sends-receivers-commands**: (c) TX-5: `onOrderPlaced` and `onStockReserved` claim no message id. A redelivered `StockReserved` writes a second `CreatePayment` with a fresh id.
- **tx-33-ok-billing-handles-payment-refunded**: (c) TX-19/TX-38: `PaymentRefunded` before the invoice, or for an order never invoiced (saga step 7), reaches `creditNoteFor(undefined)`. The outcome then depends on the order messages arrive in, and the use case fails forever.
- **tx-35-ok-late-payment-refunded**: (c) SVC-6: shop's service imports payment's published language. That is allowed only for an upstream shop conforms to, and the example does not say shop conforms.
- **sys-14-ok-money-returns-remainder**: (c) DOM-7/DOM-3: shop's published `orderPlacedSchema` restates the shop rule `quantity` positive outside the domain.
- **sys-12-ok-shop-price-read-only-in-payload-admin**: (c) SYS-1/SYS-9: shop exports `@teeladen/shop/payload#ChangePriceButton`, a driving adapter that is not of its offer, and catalog's config imports it by path.
- **tx-22-ok-payment-requests-checkout-session**: (a) TX-22 is met only through TX-36's permission, not by an outbox message. (c) TX-30: payment asks for a tentative operation, and no rule of payment's decides what happens when no confirmation comes; the expiry is shop's deadline, passed in. (d) a Checkout Session where the fixture names a PaymentIntent.
- **tx-3-ok-checkout-requests-checkout-session**: (b) TX-3: the checkout changes no data another system owns, as the example itself says. (d) it has no pay-by-invoice path and does not copy price, sku and tax class from catalog.
- **svc-7-ok-order-overview-through-query-port**: (b) TX-1: the use case writes nothing.
- **svc-7-ok-payment-reaches-stripe-through-gateway-port**: (a) TX-5 is claimed, but no code shows it. (d) `amount.amount` contradicts the shared kernel's `Money` `{ cents, currency }` in sys-14.
- **tx-34-ok-refund-refusal-published**: (c) TX-24 (SHOULD): it decides by the Payment's dispute and saves only the Refund. A dispute committed meanwhile is not caught.
- **tx-29-ok-catalog-writes-product-changed-in-payload-transaction**: (d) fulfillment's handlers sit on `apps/server`'s bus, though fulfillment runs in its own worker with its own assembly. `ProductChanged` carries no version. TX-32 is moot only because catalog is external.
- **purpose not told**: DRV-1, SVC-3, TX-37, TX-24, ASM-10, SYS-10, SYS-15, TX-39, DOM-4, TST-8, TX-28's "tentative operation" carve-out. Details below.

## Findings

### tx-28-breach-pre-commit-hook-cannot-ask-for-revalidation.md
```yaml
breaches: [TX-22]
satisfies: [TX-28, DRV-1, DRV-3, DRV-6, TX-25]
situation: a Payload edit should revalidate the cached shop page; catalog does not write ProductChanged in its transaction
finding: cannot-comply
```
# A hook before Payload's commit can neither revalidate nor ask for it

```ts
// packages/shop/payload/hooks/product-changed.ts — shop's hook, in catalog's afterChange
export const productChanged =
  (courier: Courier<ShopHookServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc }) => {
    await courier.read().revalidateProductPage({ productId: doc.id, slug: doc.slug })  // DRV-6: read per run
    return doc
  }

// packages/shop/service/revalidate-product-page.ts — writes no record of shop's (TX-28 holds)
export const createRevalidateProductPage =
  ({ pages }: { pages: ProductPages }): RevalidateProductPage =>
  ({ slug }) => pages.revalidate(`/products/${slug}`)          // TX-22: a change its (absent) transaction does not commit
```

Scope of TX-29 fails when Payload's transaction cannot write to an outbox: Payload on another database
adapter, or a collection that no relay reads. TX-29 is a SHOULD, so a codebase may also deviate from it
where its Scope holds. In both cases catalog tells shop of the edit through a hook. Payload runs that
hook inside `req.transactionID`, before the commit, so TX-28's Scope holds. Revalidating is a change
outside shop's transaction to something no system of the codebase owns (Next's cache), so TX-22's
Scope holds too: write a message to shop's outbox and do not make the change yourself. Writing that
message changes shop: an outbox row is a record that a write changes. A private request to itself is
no "request to another system for a commitment", so it is no tentative operation, and TX-28 forbids it.
The code above follows TX-28 and breaches TX-22. The tx-28-ok pattern follows TX-22 and breaches TX-28.
No third form exists: answering changes nothing, and the hook may not hold the request in memory past
its return (P8). Either TX-28 lets "a private message that asks for a change once the caller's change
is confirmed" count as a tentative operation, or TX-29 has to be a MUST whose Scope covers every
external system that calls a hook.

### tx-36-breach-checkout-payment-intent-in-request.md
```yaml
breaches: [TX-3, TX-22]
satisfies: [TX-1, TX-6, TX-30, SVC-7, TX-25]
situation: checkout must return a Stripe client_secret in the same request; payment creates a PaymentIntent when checkout calls it
finding: cannot-comply
```
# Checkout gets the PaymentIntent's client_secret by call; outboxes would arrive too late

```ts
// packages/shop/service/checkout.ts — after shop's commit
const { clientSecret } = await payments.open({ orderId: order.id, amount: order.total, payBy: order.paymentDeadline })
//      ^ shop's driven port PaymentOpening; assembly hands in payment's openPayment

// packages/payment/service/open-payment.ts — acting: records a pending Payment, creates the PaymentIntent
export const createOpenPayment =
  ({ transaction, payments, gateway }: Deps): OpenPayment =>
  ({ orderId, amount, payBy }) =>
    transaction.run(async (tx) => {
      const existing = await payments.byOrderId(orderId, tx)
      if (existing) return { clientSecret: await gateway.secretOf(existing.externalRef) }
      const payment = openPayment({ id: paymentIdFor(orderId), orderId, amount, answerDueBy: payBy })
      const intent = await gateway.createIntent({ paymentId: payment.id, amount })  // Stripe change, by call
      await payments.save(withExternalRef(payment, intent.externalRef), tx)
      return { clientSecret: intent.clientSecret }
    })
```

The fixture asks for both: payment creates a PaymentIntent when checkout calls it, and checkout returns
its `client_secret` in the same request. Shop's call creates payment's Payment, data payment owns, so
TX-3 says: through shop's outbox. Payment's call creates an object at Stripe, which no system of this
codebase owns, so TX-22 says: through payment's outbox. A handler runs after the request has answered,
so the browser gets no secret. Only TX-36 lets both go by call, and only for a tentative operation:
"holds what it asks for without giving it: its confirmation gives it, its cancellation releases it".
A PaymentIntent without `confirm` holds nothing: no authorization, no money. Its "confirmation" comes
from the customer's browser, not from the system that asked. With `capture_method: "manual"`, confirming
holds an authorization and capturing gives it, which reads as tentative. Then the confirmation is a
second call payment makes after `PaymentSucceeded`, a step the fixture's saga does not have. The
examples swap in a Checkout Session and call that tentative (N4, N9). Under the fixture's own words,
the code above is the closest: one transaction, Stripe idempotency keyed by the payment id, and payment's
deadline rule (TX-30). It breaches TX-3 and TX-22 unless the glossary admits an unconfirmed
PaymentIntent.

### tx-37-breach-order-confirmation-mail-without-key.md
```yaml
breaches: [TX-5]
satisfies: [TX-37, TX-22, TX-6, DRV-7]
situation: shop sends an order-confirmation mail once the order commits; the mail provider takes no idempotency key
finding: cannot-comply
```
# The mail handler may not check whether it already sent the mail

```ts
// packages/shop/service/send-order-confirmation.ts — called for shop's private SendOrderConfirmation
export const createSendOrderConfirmation =
  ({ mailer }: { mailer: Mailer }): SendOrderConfirmation =>
  (message) => mailer.send(orderConfirmationMail(message))   // no claim: TX-37 forbids deciding by its records
```

TX-37's Scope holds: the message asks for a change (a sent mail) that no transaction of shop's commits.
So the use case must not decide again "by the state of its records", and `handled.claim(message.id)`
is exactly that: the mail is sent or not by a row. TX-31's Scope fails: the provider takes no key.
TX-5 asks the use case to be idempotent: "repeating it leaves the records as performing it once left
them". A redelivery after a crash between `send` and the acknowledgement sends a second mail. If "the
records" means only this system's records (P9: "changes no record of this system"), the code complies
and the duplicate mail is allowed. If it means every record the operation touches, the mail
provider's included, then no code meets both TX-5 and TX-37. A claim breaches TX-37, and without a
claim the second mail goes out. The glossary does not say which reading holds (N7).

## How the fixture is built

### Systems

Two processes: `apps/web` (Next.js with Payload: shop, payment, billing, catalog, backoffice, plus
fulfillment's answering queries) and `apps/worker` (fulfillment). Each has one assembly (ASM-1).
The bus is Postgres-backed and shared by both. Each process relays the outboxes of the systems it
assembles.

```
apps/
  web/
    instrumentation.ts          # OTel SDK first, then assembly (probe + assembly, outside the layers)
    assembly.ts                 # the one assembly of the web process (ASM-1)
    payload.config.ts           # built by assembly from catalog's config factory
    app/(shop)/checkout/actions.ts         # shop driving adapter, reads courier (DRV-3, DRV-6)
    app/api/stripe/webhook/route.ts        # payment hook, reads courier
    app/api/health/route.ts                # probe
    app/api/metrics/route.ts               # probe
    app/admin/dashboard/page.tsx           # backoffice driving adapter
  worker/
    main.ts                     # entry: OTel first, then assembly
    assembly.ts                 # fulfillment's assembly (ASM-1), relay + bus consumers + 3PL hook server
packages/
  shared-kernel/   money.ts  sku.ts
  common/          logger.ts  tracing.ts  postgres.ts  transaction.ts  outbox/  relay.ts  bus.ts  courier.ts  metrics.ts
  catalog-config/  collections/products.ts  collections/outbox.ts    # catalog's config: external system, this codebase writes it
  shop/
    domain/        order.ts  cart.ts  line.ts  dunning-replica.ts
    service/       ports/  checkout.ts  place-order… cancel-overdue-orders.ts  apply-payment-outcome.ts  …
    drizzle/       schema.ts  order-repository.ts  outbox.ts  …          # driven adapters
    payload/       catalog-products.ts                                     # driven adapter over the Local API (ACL)
    billing/       customer-standing.ts                                    # driven adapter over billing's open host service
    next/          product-pages.ts                                        # driven adapter: revalidatePath
    driving/       handlers.ts  hooks/open-orders-with-sku.ts             # handlers, hooks
    published/     index.ts messages.ts ports.ts                           # offer: published language + OHS port types
    builder.ts                                                             # offer: system builder(s)
    fakes/         index.ts                                                # offer: fakes, own path (SYS-15)
  payment/  (same shape; stripe/ = ACL adapters: gateway.ts, webhook.ts)
  billing/  (same shape; bank/ = ACL adapter; scheduled/ = dunning + bank tasks)
  fulfillment/ (same shape; tpl/ = 3PL ACL adapter + hook)
  backoffice/  (same shape; replicas only)
```

Every system's `package.json` `exports` lists only `./published`, `./builder`, `./fakes` (SYS-1,
SYS-9, SYS-15). `./published` re-exports types with `export type` and zod schemas that import only
zod and the shared kernel (SYS-2, SYS-10, SYS-14).

```ts
// packages/shop/builder.ts — system builders: configuration in, implementations out
import type { Database, TransactionPort } from "@teeladen/common/postgres"
import type { Bus } from "@teeladen/common/bus"

export type ShopConfig = {
  db: Database
  transaction: TransactionPort
  payload: () => Payload                    // lazy: breaks the Payload cycle for services (N17)
  payments: PaymentOpening                  // payment's openPayment, behind shop's driven port
  standing: CustomerStandingLookup          // billing's open host service, behind shop's driven port
  clock: Clock
  revalidate: (path: string) => void
  mailer: Mailer
}

// answers only; needs no Payload, so assembly can hand it to catalog's config directly
export const buildShopCatalogHooks = ({ db }: Pick<ShopConfig, "db">) => {
  const countOpenOrdersWithSku = createCountOpenOrdersWithSku({ openOrders: drizzleOpenOrders(db) })
  return { openOrdersWithSku: openOrdersWithSkuHook(countOpenOrdersWithSku) }
}

export const buildShop = (c: ShopConfig) => {
  const orders = drizzleOrderRepository(c.db)
  const carts = drizzleCartRepository(c.db)
  const outbox = drizzleOutbox(c.db, "shop_outbox")
  const services = {
    checkout: createCheckout({ transaction: c.transaction, carts, orders, outbox,
      catalog: payloadCatalogProducts(c.payload), standing: c.standing, dunning: drizzleDunningReplica(c.db),
      payments: c.payments, clock: c.clock }),
    cancelOverdueOrders: createCancelOverdueOrders({ transaction: c.transaction, orders, outbox, clock: c.clock }),
    cancelOrder: createCancelOrder({ transaction: c.transaction, orders, outbox, clock: c.clock, handled: drizzleHandled(c.db, "shop") }),
    applyPaymentOutcome: createApplyPaymentOutcome({ transaction: c.transaction, orders, outbox, handled: drizzleHandled(c.db, "shop") }),
    applyInvoicePaid: createApplyInvoicePaid({ transaction: c.transaction, orders, outbox, handled: drizzleHandled(c.db, "shop") }),
    recordDunningStage: createRecordDunningStage({ transaction: c.transaction, dunning: drizzleDunningReplica(c.db) }),
    revalidateProductPage: createRevalidateProductPage({ pages: nextProductPages(c.revalidate) }),
    sendOrderConfirmation: createSendOrderConfirmation({ mailer: c.mailer }),
  }
  return {
    services,                                         // what courier-read driving adapters call
    handlers: buildShopHandlers(services),            // handed to the bus by assembly
    outboxReader: drizzleOutboxReader(c.db, "shop_outbox"),
    scheduled: { cancelOverdueOrders: scheduled(() => services.cancelOverdueOrders()) },
  }
}
```

```ts
// apps/web/instrumentation.ts — Next calls register() once, before serving
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  await import("@teeladen/common/tracing/register")       // auto-instrumentation before any other import
  const { assemble } = await import("./assembly")
  await assemble()                                        // fills the courier before any request (ASM-8)
}

// apps/web/assembly.ts — the only place port and implementation meet
import { createDrizzle, createTransactionPort } from "@teeladen/common/postgres"
import { createBus } from "@teeladen/common/bus"
import { createRelay } from "@teeladen/common/relay"
import { shopCourier, paymentCourier, backofficeCourier } from "./couriers"
import { buildShop, buildShopCatalogHooks } from "@teeladen/shop/builder"
import { buildPayment } from "@teeladen/payment/builder"
import { buildBilling } from "@teeladen/billing/builder"
import { buildFulfillmentQueries } from "@teeladen/fulfillment/builder"
import { buildBackoffice } from "@teeladen/backoffice/builder"
import { productsCollection, outboxCollection } from "@teeladen/catalog-config"
import { payloadOutboxReader } from "@teeladen/common/relay/payload"

export async function assemble() {
  const env = readEnv()
  const db = createDrizzle(env.DATABASE_URL)
  const transaction = createTransactionPort(db)
  const clock = systemClock
  let payloadInstance: Payload | undefined
  const payload = () => { if (!payloadInstance) throw new Error("payload not initialised"); return payloadInstance }

  const billing = buildBilling({ db, transaction, clock, bank: bankClient(env), mailer: mailer(env) })
  const payment = buildPayment({ db, transaction, clock, stripe: new Stripe(env.STRIPE_KEY), signingSecret: env.STRIPE_WHSEC })
  const stock = buildFulfillmentQueries({ db })
  const shop = buildShop({ db, transaction, clock, payload,
    payments: payment.openHost.openPayment,                 // payment's driving port behind shop's driven port
    standing: billing.openHost.customerStanding,            // billing's driving port behind shop's driven port
    revalidate: revalidatePath, mailer: mailer(env) })
  const backoffice = buildBackoffice({ db, transaction })

  payloadInstance = await getPayload({ config: buildConfig({
    collections: [
      productsCollection({ shop: buildShopCatalogHooks({ db }), stock: stock.hooks }),
      outboxCollection,
    ],
    db: postgresAdapter({ pool: { connectionString: env.DATABASE_URL } }),
  }) })

  shopCourier.fill(shop.services)
  paymentCourier.fill(payment.hooks)
  backofficeCourier.fill(backoffice.services)

  const bus = createBus(db, { handlers: [...shop.handlers, ...payment.handlers, ...billing.handlers, ...backoffice.handlers] })
  createRelay({ readers: [shop.outboxReader, payment.outboxReader, billing.outboxReader,
                          payloadOutboxReader(payload, { collection: "outbox" })], bus }).start()
  createScheduler({ "*/5 * * * *": [shop.scheduled.cancelOverdueOrders, payment.scheduled.settleOverdue],
                    "0 6 * * *": [billing.scheduled.runDunning], "*/15 * * * *": [billing.scheduled.importTransfers] }).start()
}
```

```ts
// apps/worker/assembly.ts — fulfillment's process, its own entry and assembly
export async function assemble() {
  const env = readEnv()
  const db = createDrizzle(env.DATABASE_URL)
  const fulfillment = buildFulfillment({ db, transaction: createTransactionPort(db), clock: systemClock,
    warehouse: tplClient(env.TPL_URL, env.TPL_KEY), tplSecret: env.TPL_SECRET })
  const bus = createBus(db, { handlers: fulfillment.handlers })
  createRelay({ readers: [fulfillment.outboxReader], bus }).start()
  createScheduler({ "*/10 * * * *": [fulfillment.scheduled.lapseReservations] }).start()
  createServer(fulfillment.hooks.tplWebhook).listen(env.PORT)   // assembly constructs it: no courier
}
```

### catalog

Catalog is an external system (Payload). Its config sits in `packages/catalog-config`. Its own rules
(price above zero, sku unique, sku frozen on open orders) stay in that config, outside the rules. What
touches our systems is inside them. It tells of changes by its own outbox (TX-29), it keeps no record
of ours (SYS-12 does not hold), and editors see stock through fulfillment's hook. Its config is a
factory, so assembly hands it hooks instead of catalog importing system paths.

```ts
// packages/catalog-config/collections/products.ts
export const productsCollection = ({ shop, stock }: { shop: ShopCatalogHooks; stock: StockHooks }): CollectionConfig => ({
  slug: "products",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "price", type: "number", required: true, validate: (v: number) => v > 0 || "price above zero" },
    { name: "sku", type: "text", required: true, unique: true },
    { name: "taxClass", type: "select", options: ["tea", "accessories"], required: true },
    { name: "stock", type: "number", virtual: true, admin: { readOnly: true },          // fulfillment's, read-only
      hooks: { afterRead: [({ siblingData }) => stock.onHand({ sku: siblingData.sku })] } },
  ],
  hooks: {
    beforeChange: [async ({ data, originalDoc }) => {                                   // catalog's rule, as tx-28-ok-before-change
      if (!originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data
      const { openOrders } = await shop.openOrdersWithSku({ sku: originalDoc.sku })
      if (openOrders > 0) throw new APIError("This sku is on an open order.", 409)
      return data
    }],
    afterChange: [async ({ doc, previousDoc, req }) => {                                // TX-29: the message commits with the edit
      await req.payload.create({ collection: "outbox", req, data: {
        type: "ProductChanged", productId: doc.id, slug: doc.slug, sku: doc.sku,
        previousSku: previousDoc?.sku ?? null, updatedAt: doc.updatedAt } })
      return doc
    }],
  },
})
```

```ts
// packages/fulfillment/driving/hooks/stock-on-hand.ts — fulfillment's hook, catalog's admin calls it
export const stockOnHandHook = (stockOnHand: StockOnHand) => ({
  onHand: async ({ sku }: { sku: string }): Promise<number | null> =>
    skuSchema.safeParse(sku).success ? (await stockOnHand({ sku: skuSchema.parse(sku) })).onHand : null,
})
```

Shop reads catalog through a driven port in shop's terms. Its adapter is the anti-corruption layer
over the Local API. Catalog's "open host service" is read as Payload's API (N6).

```ts
// packages/shop/service/ports/catalog-products.ts
export type CatalogLine = { productId: string; sku: Sku; unitPrice: Money; taxClass: TaxClass }
export interface CatalogProducts { linesFor(productIds: string[]): Promise<Map<string, CatalogLine>> }

// packages/shop/payload/catalog-products.ts — driven adapter; Payload's terms stop here
export const payloadCatalogProducts = (payload: () => Payload): CatalogProducts => ({
  async linesFor(ids) {
    const { docs } = await payload().find({ collection: "products", where: { id: { in: ids } }, limit: ids.length, depth: 0 })
    return new Map(docs.map((d) => [d.id, {
      productId: d.id, sku: skuSchema.parse(d.sku),
      unitPrice: { cents: Math.round(d.price * 100), currency: "EUR" },
      taxClass: d.taxClass === "tea" ? "tea" : "accessory",
    }]))
  },
})
```

No transaction is handed to it. Payload's store and shop's Drizzle client are two stores: no one
transaction carries both (glossary: Store). The read runs before shop's transaction opens. The cycle
the fixture names (config → hooks → services → Payload) is broken twice: hooks that need no Payload
are built before it (`buildShopCatalogHooks`), and adapters that need Payload take `() => Payload`.
Courier reads remain for Next's server actions and route handlers, which assembly cannot construct.

### shop

Domain: the Order aggregate holds its lines as snapshots of catalog's product (glossary: Snapshot),
its payment method, and the payment deadline. Each rule is stated once (DOM-7). Order's shape is a
zod schema in the domain (DOM-3).

```ts
// packages/shop/domain/order.ts
import { z } from "zod"
import { moneySchema, sum, type Money } from "@teeladen/shared-kernel/money"
import { skuSchema } from "@teeladen/shared-kernel/sku"

export const orderLineSchema = z.object({
  productId: z.string(), sku: skuSchema, quantity: z.number().int().positive(),
  unitPrice: moneySchema, taxClass: z.enum(["tea", "accessory"]),        // snapshot, shop's own fact from now on
})
export const orderSchema = z.object({
  id: z.string(), customerId: z.string(), version: z.number().int(),
  lines: z.array(orderLineSchema).min(1),
  payBy: z.enum(["card", "invoice"]),
  status: z.enum(["placed", "paid", "cancelled"]),
  paymentDeadline: z.string().datetime().nullable(),                     // null for invoice orders (saga step 6)
})
export type Order = z.infer<typeof orderSchema>

export const PAYMENT_WINDOW_MINUTES = 30
export const mayPayByInvoice = (stage: DunningStage | undefined) => stage === undefined || stage === "none"  // stale replica accepted (TX-27)

export const placeOrder = (input: { id: string; customerId: string; lines: OrderLine[]; payBy: "card" | "invoice"; now: Date }): Order => ({
  id: input.id, customerId: input.customerId, version: 0, lines: input.lines, payBy: input.payBy, status: "placed",
  paymentDeadline: input.payBy === "card" ? new Date(input.now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString() : null,
})
export const isOverdue = (o: Order, now: Date) => o.status === "placed" && o.paymentDeadline !== null && new Date(o.paymentDeadline) <= now
export const cancel = (o: Order): Order => ({ ...o, status: "cancelled" })

export type PaymentOutcome =
  | { kind: "paid"; order: Order }
  | { kind: "refund"; order: Order; amount: Money }                    // saga step 7: the money goes back
  | { kind: "cancelled"; order: Order }
  | { kind: "unchanged"; order: Order }
export const onPaymentSucceeded = (o: Order, amount: Money): PaymentOutcome =>
  o.status === "cancelled" ? { kind: "refund", order: o, amount }
  : o.status === "paid" ? { kind: "unchanged", order: o }
  : { kind: "paid", order: { ...o, status: "paid" } }
export const onPaymentFailed = (o: Order): PaymentOutcome =>
  o.status === "placed" ? { kind: "cancelled", order: cancel(o) } : { kind: "unchanged", order: o }
export const onInvoicePaid = (o: Order): PaymentOutcome =>
  o.status === "placed" && o.payBy === "invoice" ? { kind: "paid", order: { ...o, status: "paid" } } : { kind: "unchanged", order: o }
export const total = (o: Order): Money => sum(o.lines.map((l) => times(l.unitPrice, l.quantity)))
```

Checkout copies price, sku and tax class from catalog. Pay-by-invoice is refused to a customer in
dunning. The fixture's "calls billing's open host service in-process while holding its own ambient
transaction" becomes a call made through a driven port before shop's transaction opens. Shop's
transaction is never ambient (ASM-9), and billing's driving port takes none (TX-25). Two sources are
shown: the call, as the fixture has it, and the replica from tx-32-ok as the fallback while billing is
down (P15).

```ts
// packages/shop/service/ports/customer-standing.ts — driven port, shop's terms
export interface CustomerStandingLookup { dunningStage(customerId: string): Promise<DunningStage> }

// packages/shop/billing/customer-standing.ts — driven adapter over billing's open host service (ACL)
import type { CustomerStanding } from "@teeladen/billing/published"
export const billingStanding = (billing: CustomerStanding): CustomerStandingLookup => ({
  async dunningStage(customerId) {
    const r = await billing({ customerId })
    return r.dunning === "clear" ? "none" : r.dunning === "reminded" ? "reminder" : "collection"
  },
})

// packages/shop/service/checkout.ts — acting use case; one transaction (TX-1)
export const createCheckout = (d: CheckoutDeps): Checkout =>
  async ({ cartId, customerId, payBy, locale }) => {
    const cart = await d.carts.byId(cartId)                             // read only, re-read in tx below
    if (!cart) throw new CartNotFound(cartId)
    const catalog = await d.catalog.linesFor(cart.items.map((i) => i.productId))   // catalog's data, its API (TX-12)
    const stage = payBy === "invoice"
      ? await d.standing.dunningStage(customerId).catch(() => d.dunning.stageOf(customerId))  // P15 fallback to replica
      : undefined
    if (payBy === "invoice" && !mayPayByInvoice(stage)) return { kind: "refused", reason: "dunning" } as const

    const order = await d.transaction.run(async (tx) => {
      const current = await d.carts.byId(cartId, tx)
      if (!current || current.version !== cart.version) throw new CartChanged(cartId)   // read still holds (P10)
      const order = placeOrder({ id: orderIdFor(cartId), customerId, payBy, now: d.clock.now(),
                                 lines: linesFrom(current, catalog) })                 // domain: snapshot each line
      await d.orders.save(order, tx)                                     // key = orderIdFor(cartId): a second checkout fails
      await d.carts.save(checkedOut(current), tx)                        // relied on: SVC-2, TX-24
      await d.outbox.write(orderPlaced(order), tx)                       // published event (TX-6)
      await d.outbox.write(sendOrderConfirmation(order, locale), tx)     // private; mail after commit (TX-22)
      return order
    })
    if (order.payBy === "invoice") return { kind: "placed", orderId: order.id } as const
    const { clientSecret } = await d.payments.open({ orderId: order.id, amount: total(order), payBy: order.paymentDeadline! })
    return { kind: "awaiting-payment", orderId: order.id, clientSecret } as const      // see finding tx-36-breach-checkout-…
  }
```

```ts
// apps/web/app/(shop)/checkout/actions.ts — driving adapter; Next constructs it, so courier (DRV-3)
"use server"
import { shopCourier } from "../../../couriers"
export async function checkoutAction(form: FormData) {
  const input = checkoutFormSchema.parse(Object.fromEntries(form))       // shop's published language
  return shopCourier.read().checkout({ ...input, customerId: await customerFromSession() })  // DRV-6, one acting call (DRV-1)
}
```

The deadline (saga step 5) is a scheduled task that makes one acting call (DRV-1). It cancels each
overdue order through a private message, so each order is its own transaction (TX-1). A conflict with
a concurrent `PaymentSucceeded` fails only that order, and the race is decided by the rule in
`onPaymentSucceeded`.

```ts
// packages/shop/service/cancel-overdue-orders.ts — decides nothing it commits but messages
export const createCancelOverdueOrders = ({ transaction, orders, outbox, clock }: Deps): CancelOverdueOrders =>
  () => transaction.run(async (tx) => {
    for (const id of await orders.overdueIds(clock.now(), tx)) await outbox.write(cancelIfOverdue({ orderId: id }), tx) // private
  })

// packages/shop/service/cancel-order.ts — handler of private CancelIfOverdue; decides in its own transaction
export const createCancelOrder = ({ transaction, orders, outbox, handled, clock }: Deps): CancelOrder =>
  (m) => transaction.run(async (tx) => {
    if (!(await handled.claim(m.id, tx))) return                        // TX-5
    const order = await orders.byId(m.orderId, tx)
    if (!isOverdue(order, clock.now())) return                          // paid meanwhile: rule says keep
    await orders.save(cancel(order), tx)                                // TX-23: fails if a payment saved first
    await outbox.write(orderCancelled(order), tx)
  })

// packages/shop/service/apply-payment-outcome.ts — PaymentSucceeded / PaymentFailed from payment
export const createApplyPaymentOutcome = ({ transaction, orders, outbox, handled }: Deps): ApplyPaymentOutcome =>
  (e) => transaction.run(async (tx) => {
    if (!(await handled.claim(e.id, tx))) return
    const order = await orders.byId(e.orderId, tx)
    const outcome = e.type === "PaymentSucceeded" ? onPaymentSucceeded(order, e.amount) : onPaymentFailed(order)
    if (outcome.kind === "unchanged") return
    await orders.save(outcome.order, tx)
    if (outcome.kind === "paid") await outbox.write(orderPaid(outcome.order), tx)
    if (outcome.kind === "cancelled") await outbox.write(orderCancelled(outcome.order), tx)
    if (outcome.kind === "refund") await outbox.requestRefund({ orderId: order.id, amount: outcome.amount }, tx) // TX-3
  })
```

Shop does not conform to payment, so `requestRefund` is a method of shop's outbox port in shop's
terms. Its Drizzle adapter serializes payment's `RefundPayment`, the command payment's published
language declares (SYS-13). Payment's terms stop in the adapter (DVN-4: the outside).

```ts
// packages/shop/drizzle/outbox.ts — driven adapter; the ACL toward payment's command
import { refundPaymentSchema } from "@teeladen/payment/published"
export const drizzleOutbox = (db: Database, table: OutboxTable): ShopOutbox => ({
  write: (m, tx) => insertOutbox(tx, table, m.id, m.type, m, currentTraceContext()),   // ASM-3: trace ctx only
  requestRefund: ({ orderId, amount }, tx) => {
    const command = refundPaymentSchema.parse({ id: refundIdFor(orderId), type: "RefundPayment", orderId, amount })
    return insertOutbox(tx, table, command.id, command.type, command, currentTraceContext())
  },
})
```

`refundIdFor(orderId)` is deterministic, so a redelivered `PaymentSucceeded` that slips past the
claim writes the same command id. Shop's handling of `RefundRefused` (tx-34-ok) goes to the domain:
the order is cancelled and the money is with the customer's dispute, so shop records
`refund: "refused-disputed"` on the order for support (TX-35). Invoice orders take `InvoicePaid`:

```ts
// packages/shop/service/apply-invoice-paid.ts — saga step 6
(e) => transaction.run(async (tx) => {
  if (!(await handled.claim(e.id, tx))) return
  const outcome = onInvoicePaid(await orders.byId(e.orderId, tx))
  if (outcome.kind !== "paid") return
  await orders.save(outcome.order, tx)
  await outbox.write(orderPaid(outcome.order), tx)                    // payBy: "invoice" on it; billing and fulfillment no-op
})
```

The order-confirmation mail is a private message and a handler (TX-22). Its idempotency is the
finding `tx-37-breach-order-confirmation-mail-without-key`. Where the provider takes a key, the
handler passes `confirmation-${orderId}` (TX-31). The `beforeChange` answer is
tx-28-ok-before-change as it stands. Page revalidation is a handler of catalog's `ProductChanged`:

```ts
// packages/shop/driving/handlers.ts — shop's handlers; ACL over catalog's message
export const buildShopHandlers = (s: ShopServices): Handler[] => [
  handler("ProductChanged", productChangedSchema /* catalog's, declared in catalog-config */, (m) =>
    s.revalidateProductPage({ slug: m.slug })),                          // idempotent: revalidating twice is revalidating
  handler("PaymentSucceeded", paymentSucceededSchema, (m) => s.applyPaymentOutcome(m)),
  handler("PaymentFailed", paymentFailedSchema, (m) => s.applyPaymentOutcome(m)),
  handler("InvoicePaid", invoicePaidSchema, (m) => s.applyInvoicePaid(m)),
  handler("DunningStageChanged", dunningStageChangedSchema, (m) => s.recordDunningStage(m)),   // tx-32-ok
  handler("RefundRefused", refundRefusedSchema, (m) => s.recordRefundRefused(m)),
  handler("CancelIfOverdue", cancelIfOverdueSchema, (m) => s.cancelOrder(m)),                // private, TX-39
  handler("SendOrderConfirmation", sendOrderConfirmationSchema, (m) => s.sendOrderConfirmation(m)),
]
```

`handler(...)` comes from the common library. It parses, calls, and settles the message only when the
call resolves (DRV-7).

### payment

Stripe is behind an anti-corruption layer both ways: `stripe/gateway.ts` (driven) and
`stripe/webhook.ts` (hook), as in svc-7-ok-payment. Creating the PaymentIntent by call is the
finding `tx-36-breach-checkout-payment-intent-in-request`, and the code that comes closest is shown
there. Payment's Payment aggregate records the intent, `answerDueBy` = shop's deadline + 1h (payment's
rule), and its attempts.

```ts
// packages/payment/domain/payment.ts
export const paymentSchema = z.object({
  id: z.string(), orderId: z.string(), version: z.number().int(), amount: moneySchema, externalRef: z.string(),
  status: z.enum(["open", "succeeded", "failed", "abandoned"]),
  answerDueBy: z.string().datetime(), disputed: z.boolean(),
})
// a failed attempt is not final while the intent is open: the customer may retry (N8)
export const applyStripeOutcome = (p: Payment, o: "succeeded" | "attempt-failed" | "canceled"): Next =>
  p.status !== "open" ? { payment: p, publish: [] }                                  // terminal states absorb (TX-19)
  : o === "succeeded" ? { payment: { ...p, status: "succeeded" }, publish: ["PaymentSucceeded"] }
  : o === "canceled" ? { payment: { ...p, status: "failed" }, publish: ["PaymentFailed"] }
  : { payment: p, publish: [] }
```

```ts
// packages/payment/service/settle-payment.ts — called by the Stripe hook for each webhook
export const createSettlePayment = ({ transaction, payments, handled, outbox }: Deps): SettlePayment =>
  ({ messageId, paymentId, outcome }) => transaction.run(async (tx) => {
    if (!(await handled.claim(messageId, tx))) return                   // Stripe's event id (TX-5)
    const payment = await payments.byId(paymentId, tx)                  // metadata.paymentId, not the PI id
    const next = applyStripeOutcome(payment, outcome)
    if (next.payment === payment) return
    await payments.save(next.payment, tx)
    for (const type of next.publish) await outbox.write(paymentEvent(type, next.payment), tx)
  })
```

`succeeded` after `attempt-failed` and the reverse both end `succeeded` (TX-19). Stripe's three-day
limit is met by tx-30-ok's rule, run as a fan-out: one transaction writes `SettleOverdue` per
payment, and each handler asks Stripe and settles one (TX-1; the existing example's loop breaches it).
An abandoned intent is cancelled through payment's outbox (`CancelPaymentIntent`, TX-22, key
`cancel-${paymentId}`, TX-31). Refunds follow tx-34-ok: the dispute flag is set by the
`charge.dispute.created` webhook through the same hook. To meet TX-24, `decideRefund` also saves the
Payment, so a dispute committed meanwhile fails the save (TX-23), and on redelivery the refund is
refused:

```ts
// packages/payment/service/refund-payment.ts — handler of RefundPayment (payment's own command, TX-33)
(command) => transaction.run(async (tx) => {
  if (!(await handled.claim(command.id, tx))) return
  const payment = await payments.byOrderId(command.orderId, tx)
  const decision = decideRefund(payment, command.amount)                 // domain: disputed / already refunded
  if (decision.refused) return outbox.write(refundRefused(command.orderId, decision.reason), tx)  // TX-34
  await payments.save(decision.payment, tx)                             // refundedTotal raised: the decision holds (TX-24)
  await refunds.save(decision.refund, tx)
  await outbox.write(stripeRefundRequested(decision.refund), tx)         // private; handler: stripe.refunds.create key refund.id
})
```

Stripe's `charge.refunded` webhook → `recordRefund` → `PaymentRefunded` (tx-33-ok). A refund Stripe
does not confirm within 24h is asked for by the same deadline task (TX-30).

### billing

```ts
// packages/billing/domain/invoice.ts
export const VAT_PERCENT = { tea: 7, accessory: 19 } as const                     // the VAT rule, once (DOM-7)
export const invoiceFor = (order: OrderToInvoice, number: InvoiceNumber, issuedOn: string): Invoice => ({
  id: order.orderId, number, customerId: order.customerId, issuedOn, version: 0,       // one invoice per order: id = orderId
  lines: order.lines.map((l) => { const net = times(l.unitPrice, l.quantity)
    return { ...l, vatPercent: VAT_PERCENT[l.taxClass], vat: percentOf(net, VAT_PERCENT[l.taxClass]).amount, net } }),
  paidCents: order.payBy === "card" ? totalCents : 0, status: order.payBy === "card" ? "paid" : "open",
  dueOn: order.payBy === "invoice" ? null : issuedOn,                                   // due date set when the order ships
})
// gapless numbers: a sequence aggregate, saved in the same transaction as the invoice
export const nextNumber = (s: InvoiceSequence): [InvoiceSequence, InvoiceNumber] =>
  [{ ...s, last: s.last + 1, version: s.version + 1 }, `${s.year}-${String(s.last + 1).padStart(6, "0")}`]
export const shouldInvoice = (b: OrderBilling, m: "OrderPlaced" | "OrderPaid", payBy: PayBy) =>
  b.invoiceId === null && !b.cancelled && ((m === "OrderPlaced" && payBy === "invoice") || (m === "OrderPaid" && payBy === "card"))
```

```ts
// packages/billing/service/issue-invoice.ts — handler of shop's OrderPlaced and OrderPaid
export const createIssueInvoice = ({ transaction, handled, orderBillings, sequences, invoices, outbox, clock }: Deps): IssueInvoice =>
  (m) => transaction.run(async (tx) => {
    if (!(await handled.claim(m.id, tx))) return
    const billing = (await orderBillings.byOrderId(m.orderId, tx)) ?? newOrderBilling(m.orderId)
    if (!shouldInvoice(billing, m.type, m.payBy)) return                  // OrderPaid of an invoice order: already invoiced (step 6)
    const [seq, number] = nextNumber(await sequences.forYear(year(clock.now()), tx))
    const invoice = invoiceFor(toOrderToInvoice(m), number, isoDate(clock.now()))
    await sequences.save(seq, tx)                                         // TX-23: a concurrent issue fails; redelivered (TX-38)
    await invoices.save(invoice, tx)
    await orderBillings.save(withInvoice(billing, invoice.id), tx)         // pending refunds become credit notes, see below
    await outbox.write(invoiceIssued(invoice), tx)
  })
```

`OrderPlaced` and `OrderPaid` both carry lines, tax class, customer and `payBy` in shop's published
language. So either message alone is enough, in either order (TX-19). Credit notes need `OrderBilling`
too, because tx-33-ok depends on order. Billing also subscribes to `OrderCancelled`:

```ts
// packages/billing/domain/order-billing.ts — what billing knows of one order, order-independent
export const onRefunded = (b: OrderBilling, r: { refundId: string; amount: Money }): OrderBilling =>
  ({ ...b, refunds: [...b.refunds, r] })                                  // credit note issued when an invoice exists
export const creditNotesDue = (b: OrderBilling) =>
  b.invoiceId === null ? [] : b.refunds.filter((r) => !b.creditedRefundIds.includes(r.refundId))
// an order cancelled and never invoiced (saga step 7): its refund needs no credit note; billing's rule
export const onCancelled = (b: OrderBilling): OrderBilling => ({ ...b, cancelled: true })
```

Bank transfers are pulled by a scheduled task. The bank's terms stop in `bank/statements.ts`. Each
transfer is matched on its own (fan-out). A transfer that matches nothing is an outcome by billing's
rule (an `UnmatchedTransfer` for review), not a failure (TX-38 does not hold):

```ts
// packages/billing/service/import-transfers.ts — one acting call per tick (DRV-1), one transaction
() => transaction.run(async (tx) => {
  const cursor = await cursors.bank(tx)
  const page = await bank.transfersSince(cursor.position)                // driven port, billing's terms
  for (const t of page.transfers) await outbox.write(matchTransfer(t), tx)  // private, id = bank's transaction id
  await cursors.save(advance(cursor, page.next), tx)
})
// packages/billing/service/match-transfer.ts — handler of private MatchTransfer
(m) => transaction.run(async (tx) => {
  if (!(await handled.claim(m.id, tx))) return
  const invoice = await invoices.byReference(m.reference, tx)
  const result = matchTransfer(invoice, m)                                 // domain: exact, short, none
  if (result.kind === "none") return unmatched.save(unmatchedTransfer(m), tx)
  await invoices.save(result.invoice, tx)
  if (result.invoice.status === "paid") await outbox.write(invoicePaid(result.invoice), tx)   // saga step 6
  if (result.invoice.status === "paid") await outbox.write(reviewDunning({ customerId: invoice.customerId }), tx) // TX-15
})
```

Dunning: `runDunning` (scheduled, one acting call) writes one private `RemindCustomer` per customer with
an overdue invoice. Its handler loads `CustomerDunning` and the customer's overdue invoices. It raises
the stage and marks each invoice reminded, and saves all of them, so a payment matched meanwhile fails
the save (TX-24, TX-23). It publishes `DunningStageChanged` with the version (tx-32-ok) and writes
`SendReminderMail` (TX-22). `ReviewDunning` clears the stage once no invoice is overdue. Invoice
orders get `dueOn` when fulfillment publishes `ShipmentDispatched`. Billing's open host service for
shop:

```ts
// packages/billing/published/ports.ts — OHS driving port type; no transaction (TX-25)
export type CustomerStanding = (input: { customerId: string }) => Promise<{ dunning: "clear" | "reminded" | "collection" }>
```

### fulfillment

One `OrderFulfillment` aggregate per order. It absorbs `OrderPlaced`, `OrderPaid` and `OrderCancelled`
in any order. Cancelled is terminal, so a cancel that came first leaves a tombstone, and a later
`OrderPlaced` reserves nothing. `Stock` is one aggregate per sku. A shortage backorders (N15).

```ts
// packages/fulfillment/domain/order-fulfillment.ts
export const apply = (f: OrderFulfillment, e: OrderSignal): Decision => {
  const next = { ...f, placed: f.placed ?? (e.type === "OrderPlaced" ? e.order : null),
                 paid: f.paid || e.type === "OrderPaid" || (e.type === "OrderPlaced" && e.order.payBy === "invoice"),
                 cancelled: f.cancelled || e.type === "OrderCancelled", version: f.version + 1 }
  if (next.cancelled) return { next: { ...next, stage: "dead" }, reserve: [], release: f.stage === "reserved" ? f.reserved : [], ship: false }
  if (!next.placed) return { next, reserve: [], release: [], ship: false }               // waits for the lines
  const reserve = f.stage === "none" ? next.placed.lines : []
  const ship = next.paid && f.stage !== "shipping"
  return { next: { ...next, stage: ship ? "shipping" : "reserved", reserved: reserve.length ? reserve : f.reserved,
                   reservedUntil: next.placed.paymentDeadline }, reserve, release: [], ship }
}
```

```ts
// packages/fulfillment/service/apply-order-signal.ts — handler of shop's OrderPlaced / OrderPaid / OrderCancelled
(e) => transaction.run(async (tx) => {
  if (!(await handled.claim(e.id, tx))) return
  const f = (await fulfillments.byOrderId(e.orderId, tx)) ?? emptyFulfillment(e.orderId)
  const d = apply(f, e)
  for (const line of [...d.reserve, ...d.release]) {
    const stock = await stocks.bySku(line.sku, tx)
    await stocks.save(d.reserve.includes(line) ? reserve(stock, line.quantity) : release(stock, line.quantity), tx)
  }
  await fulfillments.save(d.next, tx)
  if (d.ship) {
    const shipment = newShipment(d.next)                                   // id = shipmentIdFor(orderId)
    await shipments.save(shipment, tx)
    await outbox.write(shipWhenRegistered({ shipmentId: shipment.id }), tx)   // private
  }
})
```

A reservation is held while fulfillment waits on shop's answer. Fulfillment's rule decides when it
does not come (TX-30): `lapseReservations` releases a reservation one hour after `reservedUntil` unless
paid, through a fan-out like shop's deadline. A late `OrderPaid` reserves again and ships.

SKU registration before shipping. `ProductChanged` from catalog leads to `registerIfNew`: fulfillment
records `Article{sku, registered: false}` and writes `RegisterSku` (TX-22). Its handler calls the 3PL
keyed by sku (TX-31) and then marks the article registered by saving it whole (SVC-4). Shipping
decides before it books. `shipWhenRegistered` loads the shipment's articles. If all are registered it
writes `BookShipment`. If not, it saves `awaiting: skus`, and each `SkuRegistered` (private) re-runs
it. `BookShipment`'s handler decides nothing (TX-37):

```ts
// packages/fulfillment/service/book-shipment.ts
({ shipmentId, lines, address }) => warehouse.book({ lines, address }, { idempotencyKey: shipmentId })   // TX-31
  .then((booking) => transaction.run(async (tx) => {
    const shipment = await shipments.byId(shipmentId, tx)
    await shipments.save(booked(shipment, booking.ref), tx)               // whole aggregate (SVC-4), unlike tx-31-ok
  }))
```

3PL webhooks reach `tpl/webhook.ts`, a hook the worker's assembly constructs. It translates the 3PL's
statuses and calls `recordShipmentProgress`. That use case keeps the furthest status (booked < picked
< dispatched < delivered: order-independent, TX-19) and publishes `ShipmentDispatched` with the
Shipment's version (TX-32). It acknowledges (2xx) only after the call resolves (DRV-7).

### common library

No model (ASM-6). The message envelope is a schema of no system (N11). Every piece that reaches a
system reaches it through what assembly hands it (ASM-5). The fixture's "unit of work kept ambient
in `AsyncLocalStorage`" is replaced by an explicit transaction port (ASM-9).

```ts
// packages/common/postgres/transaction.ts — the transaction is an argument, never ambient (ASM-9, TX-1, TX-2)
export type Tx = PgTransaction<NodePgQueryResultHKT, Record<string, never>>
export interface TransactionPort { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export const createTransactionPort = (db: Database): TransactionPort => ({ run: (work) => db.transaction(work) })
export const createDrizzle = (url: string): Database => drizzle(new Pool({ connectionString: url }))   // assembly calls it

// packages/common/logger.ts and tracing.ts — ready-made instances (ASM-7): services and adapters import them
export const logger = pino({ mixin: () => ({ requestId: requestContext.getStore()?.requestId, ...activeTraceIds() }) })
export const tracer = trace.getTracer("teeladen")                       // no-op span without a context: tests need nothing

// packages/common/tracing/register.ts — loaded first by both entry points
const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter({ url: process.env.JAEGER_OTLP_URL }),
                          instrumentations: [getNodeAutoInstrumentations()] })
sdk.start()

// packages/common/outbox/envelope.ts — what crosses systems besides the body: id, type, trace context, request id
export const envelopeSchema = z.object({ id: z.string(), type: z.string(), traceparent: z.string().optional(),
                                         requestId: z.string().optional(), body: z.unknown() })
export const currentTraceContext = () => { const c: Record<string, string> = {}; propagation.inject(context.active(), c)
                                           return { traceparent: c.traceparent, requestId: requestContext.getStore()?.requestId } }

// packages/common/bus/handler.ts — settles only on success (DRV-7); restores trace context, never a transaction
export const handler = <S extends z.ZodTypeAny>(type: string, schema: S, call: (m: z.infer<S>) => Promise<unknown>): Handler => ({
  type,
  handle: (env) => context.with(propagation.extract(context.active(), env), () =>
    requestContext.run({ requestId: env.requestId ?? env.id }, async () => { await call(schema.parse({ ...env.body, id: env.id })) })),
})

// packages/common/relay.ts — reads what assembly hands it, at least once (TX-20)
export const createRelay = ({ readers, bus }: { readers: OutboxReader[]; bus: Bus }) => ({ start: () => loop(async () => {
  for (const reader of readers) for (const m of await reader.unsent(100)) { await bus.publish(m); await reader.markSent(m.id) }
}) })

// packages/common/courier.ts
export const createCourier = <T>(name: string) => {
  let value: T | undefined
  return { fill: (v: T) => { value = v }, read: (): T => { if (!value) throw new Error(`${name} courier read before assembly`); return value } }
}
```

The bus is pg-boss over the shared Postgres. It keeps a job until the handler resolves and retries it
otherwise (TX-21). Request id and trace context cross systems on the envelope. The transaction cannot
cross: it is never stored where a callee could find it.

### The checkout saga

| step | code | rules |
| --- | --- | --- |
| 1 place, `OrderPlaced`, reserve | `checkout` (shop), `applyOrderSignal` (fulfillment) | TX-1, TX-6, SVC-4, TX-5, TX-19 |
| 2 PaymentIntent, `client_secret` | `checkout` → `PaymentOpening` → payment `openPayment` | finding tx-36-breach-checkout-payment-intent-in-request |
| 3 webhook → `PaymentSucceeded`/`PaymentFailed` | `stripeWebhook` → `settlePayment` | DRV-7, TX-5, TX-19, TX-30 (tx-30-ok, fanned out) |
| 4 `OrderPaid`, invoice, ship | `applyPaymentOutcome`; `issueInvoice`; `applyOrderSignal` → `shipWhenRegistered` → `bookShipment` | TX-22, TX-31, TX-37, TX-23 |
| 5 deadline / failed → `OrderCancelled`, release | `cancelOverdueOrders` → `cancelOrder`; `onPaymentFailed`; `apply` with cancelled | DRV-1, TX-1, TX-19 |
| 6 invoice order | `OrderPlaced{payBy:"invoice"}` → `issueInvoice`, `apply` ships; `matchTransfer` → `InvoicePaid` → `applyInvoicePaid` → `OrderPaid` (no-ops downstream) | TX-19, TX-5, TX-38 |
| 7 late payment | `onPaymentSucceeded` → `RefundPayment` via outbox ACL; payment refunds or `RefundRefused`; billing: no credit note for an order never invoiced | TX-35, TX-3, SYS-13, TX-34 |

The saga is choreographed. No rule picks choreography or orchestration (sys-13-ok says so). Every
step ends in a state a rule of its system allows (P17): reservations lapse, payments settle at their
deadline, refunds are confirmed or refused.

### Cross-cutting reads

**Admin dashboard.** A join of `orders`, `invoices` and `shipments` reads billing's and fulfillment's
records past their published language (P11, TX-12) from whatever system holds the query. The
dashboard is a fifth system, `backoffice`. It keeps replicas from the published events
(`OrderPlaced/Paid/Cancelled`, `InvoiceIssued/InvoicePaid`, `ShipmentDispatched`), each versioned
(TX-26, TX-32), and joins its own tables through a query port (as svc-7-ok-order-overview). It decides
nothing, so TX-27 does not hold.

```ts
// packages/backoffice/service/ports/order-board.ts
export interface OrderBoard { page(filter: BoardFilter): Promise<BoardRow[]> }   // rows in backoffice's terms
// packages/backoffice/drizzle/order-board.ts — joins backoffice's replica tables, nobody else's
export const drizzleOrderBoard = (db: Database): OrderBoard => ({
  page: (f) => db.select().from(orderReplica)
    .leftJoin(invoiceReplica, eq(invoiceReplica.orderId, orderReplica.orderId))
    .leftJoin(shipmentReplica, eq(shipmentReplica.orderId, orderReplica.orderId))
    .where(boardWhere(f)).orderBy(desc(orderReplica.placedAt)).limit(f.limit),
})
// packages/backoffice/service/apply-replica-event.ts — keeps the higher version (TX-19, TX-5)
(m) => transaction.run(async (tx) => { const cur = await replicas.of(m.type, m.key, tx); if (!cur || cur.version < m.version) await replicas.save(project(m), tx) })
```

**Payload edit revalidates the shop page.** tx-29-ok as it stands (catalog's outbox, shop's handler),
with fulfillment's handlers moved to the worker's bus.

**`/health`, `/metrics`.** Probes, outside the layers. Each reports on the process, not on a system.

```ts
// apps/web/probes/db.ts — the probe's own client, from env
export const probeDb = createDrizzle(process.env.DATABASE_URL!)
// apps/web/app/api/health/route.ts — probe, through no system
import { probeDb } from "../../../probes/db"
export const GET = async () => {
  try { await probeDb.execute(sql`select 1`); return Response.json({ ok: true }) }
  catch { return Response.json({ ok: false }, { status: 503 }) }
}
// apps/web/app/api/metrics/route.ts — probe
export const GET = async () => new Response(await metricsRegistry.metrics(), { headers: { "content-type": metricsRegistry.contentType } })
```

Neither probe reads the courier. ASM-4's Scope ("code reads the courier") holds for a probe too, and
a probe is no driving adapter, so the probe makes its own client from env instead. ASM-2 does not hold:
a probe is no factory. Probes are outside the layers, so nothing forbids it (N16).

## New ok examples

### tx-12-ok-checkout-snapshots-catalog-lines.md
```yaml
breaches: []
satisfies: [TX-12, SVC-7, SVC-2, TX-24]
situation: checkout copies each line's price, sku and tax class from catalog's product
```
# Checkout reads catalog through its port before its transaction and keeps snapshots

```ts
// packages/shop/service/checkout.ts (excerpt)
const catalog = await d.catalog.linesFor(cart.items.map((i) => i.productId))   // CatalogProducts: Payload's Local API behind it
const order = await d.transaction.run(async (tx) => {
  const current = await d.carts.byId(cartId, tx)
  if (!current || current.version !== cart.version) throw new CartChanged(cartId)
  const order = placeOrder({ id: orderIdFor(cartId), customerId, payBy, now: d.clock.now(), lines: linesFrom(current, catalog) })
  await d.orders.save(order, tx)
  /* … */
  return order
})
// packages/shop/domain/line.ts
export const linesFrom = (cart: Cart, catalog: Map<string, CatalogLine>): OrderLine[] =>
  cart.items.map((i) => { const c = catalog.get(i.productId); if (!c) throw new ProductGone(i.productId)
    return { productId: i.productId, sku: c.sku, quantity: i.quantity, unitPrice: c.unitPrice, taxClass: c.taxClass } })
```

Catalog owns the product. Shop reads it through catalog's API behind shop's own port (TX-12, SVC-7)
and copies it into the Order as a snapshot that stays shop's fact. The `beforeChange` veto keeps the
sku of an open order stable on catalog's side. The read runs before shop's transaction: Payload's
client is another store, so it is handed no transaction (TX-2 does not hold). A price edited between the
read and the commit is accepted by shop's rule: the price the customer saw.

### asm-9-ok-shop-asks-billing-outside-its-transaction.md
```yaml
breaches: []
satisfies: [ASM-9, TX-25, TX-12, SVC-7, P15]
situation: shop calls billing's open host service in-process during checkout, for pay-by-invoice
```
# Shop asks billing for the customer's standing; no transaction travels

```ts
// packages/billing/published/ports.ts
export type CustomerStanding = (input: { customerId: string }) => Promise<{ dunning: "clear" | "reminded" | "collection" }>
// packages/billing/service/customer-standing.ts — answering; opens nothing of shop's
export const createCustomerStanding = ({ dunnings }: Deps): CustomerStanding =>
  async ({ customerId }) => publishStanding(await dunnings.byCustomerId(customerId))
// packages/shop/service/checkout.ts (excerpt) — before d.transaction.run
const stage = await d.standing.dunningStage(customerId).catch(() => d.dunning.stageOf(customerId))
if (payBy === "invoice" && !mayPayByInvoice(stage)) return { kind: "refused", reason: "dunning" } as const
```

The fixture's shop holds an ambient unit of work while calling billing, so billing's repository picks up
shop's transaction: one transaction spans two systems (P16). Here the transaction is an argument
(ASM-9), and billing's driving port has no parameter that could carry one (TX-25). Shop calls before it
opens its own. A stage that rises between the answer and shop's commit is a stale read shop's rule
accepts (P10). While billing is down, shop decides by its replica (P15, TX-27).

### tx-12-ok-stock-shown-in-payload-through-fulfillment-hook.md
```yaml
breaches: []
satisfies: [TX-12, SYS-1, SYS-9, DRV-8, SYS-12]
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
```
# A virtual, read-only field asks fulfillment's hook

```ts
// packages/catalog-config/collections/products.ts (excerpt) — assembly hands `stock` in
{ name: "stock", type: "number", virtual: true, admin: { readOnly: true },
  hooks: { afterRead: [({ siblingData }) => stock.onHand({ sku: siblingData.sku })] } }
// packages/fulfillment/builder.ts — the builder returns the hook; no path exports it
export const buildFulfillmentQueries = ({ db }: { db: Database }) => {
  const stockOnHand = createStockOnHand({ stocks: drizzleStockReader(db) })
  return { hooks: stockOnHandHook(stockOnHand) }
}
```

Stock stays in fulfillment's store and is read through fulfillment's driving port. No Payload field
stores it, so there is nothing for Payload's admin to write (SYS-12 does not hold). The hook reaches
only its system's driving port and the shared kernel's `skuSchema` (DRV-8). Catalog gets it from
assembly, not from an exported path (SYS-1, SYS-9). A custom admin component would have needed an
import-map path into fulfillment, a path outside its offer (compare sys-12-ok).

### drv-1-ok-dunning-run-fans-out-reminders.md
```yaml
breaches: []
satisfies: [DRV-1, TX-1, TX-24, TX-23, TX-32, TX-22]
situation: scheduled dunning runs over unpaid invoices; a customer's dunning stage rises with each reminder
```
# The run decides who is due; each reminder is its own use case

```ts
// packages/billing/scheduled/dunning.ts — scheduled task: one acting call
export const dunningTask = (runDunning: RunDunning) => () => runDunning()
// packages/billing/service/run-dunning.ts
() => transaction.run(async (tx) => {
  for (const customerId of await invoices.customersWithOverdue(clock.now(), tx))
    await outbox.write(remindCustomer({ customerId, runOn: isoDate(clock.now()) }), tx)   // id: `${customerId}:${runOn}`
})
// packages/billing/service/remind-customer.ts — handler of private RemindCustomer
(m) => transaction.run(async (tx) => {
  if (!(await handled.claim(m.id, tx))) return
  const dunning = await dunnings.byCustomerId(m.customerId, tx)
  const overdue = await invoices.overdueOf(m.customerId, clock.now(), tx)
  const next = remind(dunning, overdue, clock.now())                      // domain: none if paid meanwhile
  if (!next) return
  for (const inv of next.invoices) await invoices.save(inv, tx)           // decided-by data saved (TX-24)
  await dunnings.save(next.dunning, tx)                                   // version + 1
  await outbox.write(dunningStageChanged(next.dunning), tx)               // carries version (TX-32)
  await outbox.write(sendReminderMail(next.dunning, next.invoices), tx)   // TX-22
})
```

One run, one acting call (DRV-1), one transaction that writes only messages (TX-1). Each customer is
reminded in a transaction of its own. A transfer matched meanwhile saves the invoice first, the save
here fails (TX-23), and the redelivery finds it paid. The message id is per customer per day, so a
second run on the same day duplicates nothing.

### tx-38-ok-unmatched-transfer-is-an-outcome.md
```yaml
breaches: []
satisfies: [TX-38, TX-5, DOM-7]
situation: the bank reports transfers billing cannot match: a wrong reference, an amount short
```
# A transfer that matches no invoice commits as unmatched; a broken bank answer fails

```ts
// packages/billing/domain/transfer-matching.ts
export const matchTransfer = (invoice: Invoice | null, t: Transfer): Match =>
  invoice === null ? { kind: "none" }
  : t.amount.cents < openCents(invoice) ? { kind: "short", invoice: { ...invoice, paidCents: invoice.paidCents + t.amount.cents } }
  : { kind: "exact", invoice: { ...invoice, paidCents: totalCents(invoice), status: "paid" } }
// packages/billing/bank/statements.ts — driven adapter; a malformed bank row throws, the import fails, nothing commits
```

"No invoice carries this reference" is a business situation, and billing's rule sends it to review, so
committing `UnmatchedTransfer` is an outcome a rule allows. A response the adapter cannot parse is no
business rule, so the import fails and commits nothing, the cursor included (TX-38). The next tick
retries it.

### tx-37-ok-shipping-waits-for-sku-registration.md
```yaml
breaches: []
satisfies: [TX-37, TX-22, TX-31, SVC-4, TX-5]
situation: the 3PL's article master needs each SKU before it ships one
```
# The use case that writes BookShipment decides; the one that books does not

```ts
// packages/fulfillment/service/ship-when-registered.ts — handler of private ShipWhenRegistered / SkuRegistered
(m) => transaction.run(async (tx) => {
  if (!(await handled.claim(m.id, tx))) return
  const shipment = await shipments.byId(m.shipmentId, tx)
  const articles = await articles.bySkus(shipment.lines.map((l) => l.sku), tx)
  const next = readyToBook(shipment, articles)                            // domain
  await shipments.save(next.shipment, tx)
  if (next.book) await outbox.write(bookShipment(next.shipment), tx)      // id = shipment.id
})
// packages/fulfillment/service/register-sku.ts — handler of private RegisterSku; decides nothing
(m) => warehouse.registerArticle({ sku: m.sku }, { idempotencyKey: `article-${m.sku}` })
  .then(() => transaction.run(async (tx) => {
    await articles.save(registered(await articles.bySku(m.sku, tx)), tx)
    for (const id of await shipments.awaitingSku(m.sku, tx)) await outbox.write(skuRegistered({ shipmentId: id, sku: m.sku }), tx)
  }))
```

"Is the SKU registered?" is answered where the change is decided, and `BookShipment` is written only
once it holds. The booking handler (`book-shipment.ts` above) books without asking again (TX-37). The
registration handler records its result and asks for nothing new.

### tx-19-ok-fulfillment-absorbs-order-signals.md
```yaml
breaches: []
satisfies: [TX-19, TX-5, TX-30, SVC-4, TX-1]
situation: OrderPaid or OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved
```
# One per-order aggregate absorbs placed, paid, cancelled in any order

See `apply` and `apply-order-signal.ts` under fulfillment. Cancelled absorbs everything. Paid waits for
placed, which carries the lines. Placed reserves once. For cancel→placed, placed→cancel and
cancel→paid→placed, the final state is `dead` with nothing reserved. For paid→placed and placed→paid it
is `shipping`. A cancel that never arrives stops mattering after `reservedUntil` + 1h, when fulfillment's
rule lapses the reservation (TX-30).

### tx-19-ok-credit-note-waits-for-the-invoice.md
```yaml
breaches: []
satisfies: [TX-19, TX-5, TX-38, TX-33]
situation: billing issues a credit note for each refund; the refund may be for an order billing never invoiced
```
# Billing records a refund on the order's billing record and credits it once an invoice exists

```ts
// packages/billing/service/record-refund.ts — handler of payment's PaymentRefunded
(e) => transaction.run(async (tx) => {
  if (!(await handled.claim(e.id, tx))) return
  const billing = onRefunded((await orderBillings.byOrderId(e.orderId, tx)) ?? newOrderBilling(e.orderId),
                             { refundId: e.refundId, amount: e.amount })
  await issueDue(billing, tx)                                             // credit notes for creditNotesDue(billing), numbered gaplessly
})
```

Before the invoice, the refund waits on `OrderBilling`, and `issueInvoice` credits it when the invoice
is saved. On an order shop cancelled (saga step 7) it waits forever, and billing's rule says that is
right: no invoice, nothing to credit. The outcome is the same in either order, and nothing throws for a
missing invoice.

### tx-23-ok-gapless-invoice-number.md
```yaml
breaches: []
satisfies: [TX-23, TX-38, TX-1, SVC-4, DOM-7]
situation: billing's invoice numbers are gapless
```
# The sequence is an aggregate saved with the invoice

See `nextNumber` and `issue-invoice.ts` under billing. Two concurrent issues load sequence version 41.
One saves 42; the other's save fails (TX-23), the transaction rolls back, and no number is spent. The
redelivery takes 43. The use cases fail each other because the gapless rule ties them (P10). A number
exists only if its invoice committed.

### asm-3-ok-trace-context-crosses-on-the-envelope.md
```yaml
breaches: []
satisfies: [ASM-3, ASM-7, ASM-9, SYS-14]
situation: request id and trace context should cross system boundaries; the transaction must not
```
# The outbox adapter stamps the ambient trace context; the bus restores it

See `currentTraceContext`, `envelopeSchema` and `handler` under common library. The outbox adapter is a
driven adapter that a service calls, and it reads two ambient values. Neither changes how a use case
acts or what it answers (ASM-3). The published language's body schema does not change (SYS-14). The
handler runs the use case inside the restored context, so log lines and spans join across systems. No
transaction is ambient anywhere, so none can follow (ASM-9).

### tx-26-ok-backoffice-dashboard-joins-replicas.md
```yaml
breaches: []
satisfies: [TX-12, TX-26, TX-32, SVC-7, TX-19]
situation: an admin dashboard joins orders, invoices and shipments in the one Postgres
```
# The dashboard's system keeps replicas from events and joins its own tables

See backoffice under Cross-cutting reads. The SQL join stays: it joins tables backoffice keeps. Each
row is written only from the owner's versioned events (TX-26), with the higher version kept (TX-19).
The view lags the owners by the relay's delay.

### tx-1-ok-deadline-cancels-one-order-per-transaction.md
```yaml
breaches: []
satisfies: [TX-1, DRV-1, TX-23, TX-5, TX-35]
situation: shop's Order holds the payment deadline; once it passes shop cancels the order
```
# The deadline task decides nothing it cannot commit alone

See `cancel-overdue-orders.ts` and `cancel-order.ts` under shop. The task makes one acting call. That
call writes one private `CancelIfOverdue` per order in one transaction. Each handler cancels in its own
transaction, and re-checks the deadline: the message asks for a change its own transaction commits,
so TX-37 does not hold. A `PaymentSucceeded` saved first makes `isOverdue` false. One saved after finds
the order cancelled, and `onPaymentSucceeded` refunds (TX-35).

## Existing ok examples that do not hold

Checked: the 16 `*-ok-*` files the distilled names. Two pass all four checks:
tx-28-ok-before-change-hook-vetoes-sku-change and tx-32-ok-dunning-stage-changed-carries-version.

### (a) code does not meet a rule it lists

- **tx-28-ok-after-change-hook-records-revalidation-request**, TX-28: `requestPageRevalidation` writes
  a private message to shop's outbox, a change of shop. A request from shop to itself is no "request to
  another system for a commitment", so it is not "recording a tentative operation". This is the finding
  `tx-28-breach-pre-commit-hook-cannot-ask-for-revalidation`.
- **tx-22-ok-payment-requests-checkout-session**, TX-22: `request-checkout-session` makes the Stripe
  change by call and writes no outbox message. It is permitted by TX-36's MAY, not compliant with
  TX-22's Statement. List TX-22 as waived, or drop it.
- **svc-7-ok-payment-reaches-stripe-through-gateway-port**, TX-5: no use case in the code claims
  anything. The hook passes `event.id`, and "the use case behind it claims the id" is prose only.
- **tx-29-ok-catalog-writes-product-changed-in-payload-transaction**, TX-22: fulfillment's `RegisterSku`
  is a comment, not code, so the listed rule is not shown.

### (b) a listed rule's Scope does not hold

- **svc-7-ok-order-overview-through-query-port**, TX-1: the use case writes nothing, which the example
  itself says, so TX-1 says nothing about it.
- **tx-3-ok-checkout-requests-checkout-session**, TX-3: the text says the request "changes nothing of
  payment's". `OrderPlaced` is shop's own event, and the mail goes through TX-22. No data another system
  owns is changed.
- **tx-31-ok-3pl-booking-keyed-by-shipment-id**, TX-22: book-shipment decides no change (its text: "the
  use case decides nothing"). TX-22 holds for the unseen use case that wrote `BookShipment`. The rule
  whose Scope holds here is TX-37, which it meets.

### (c) code breaches a rule it does not list

- **tx-30-ok-payment-asks-stripe-at-deadline**, TX-1: `settleOverduePayments` is one use case that
  writes, and it runs one `transaction.run` per overdue payment. A stop mid-loop leaves part of the
  run committed. A fan-out through private messages complies (shown under payment).
- **tx-31-ok-3pl-booking-keyed-by-shipment-id**, SVC-4: `shipments.recordBooking(shipmentId, ref, tx)`
  writes a part of the Shipment through its repository. Load it and save `booked(shipment, ref)`.
- **tx-28-ok-after-change-hook-records-revalidation-request**, TX-37: `RevalidateProductPage` asks for
  a change no transaction of shop's commits. The handler decides again whether to make it, by shop's
  business rule `givesUpWaiting`, which TX-37 forbids.
- **sys-13-ok-checkout-process-sends-receivers-commands**, TX-5: `onOrderPlaced` and `onStockReserved`
  are called for delivered messages and claim nothing. A redelivered `StockReserved` writes a second
  `CreatePayment` with a new id. A redelivered `OrderPlaced` saves a new process under an existing key,
  fails, and never succeeds "where the first did" (P9).
- **tx-33-ok-billing-handles-payment-refunded**, TX-19 and TX-38: `invoices.byOrderId` finds nothing
  when `PaymentRefunded` comes before `OrderPaid`'s invoice, or for an order shop cancelled and never
  had invoiced (saga step 7). `creditNoteFor(undefined, …)` then throws on every delivery. The result
  depends on arrival order, and what stops it is no rule of billing's.
- **tx-35-ok-late-payment-refunded**, SVC-6: `shop/service/apply-payment-succeeded.ts` imports
  `@teeladen/payment/published`. SVC-6 admits another system's published language only for "an upstream
  its system conforms to", and nothing in the example or fixture says shop conforms to payment (sys-13-ok
  states it for itself). Either state the conformity, or move the command into an outbox adapter
  (shown under shop).
- **sys-14-ok-money-returns-remainder**, DOM-7 (and DOM-3): `orderPlacedSchema` states
  `quantity: z.number().int().positive()`, a shop rule about an order line's shape, outside shop's domain.
  SYS-2 forbids the published language from importing it from the domain, so the rule is stated twice.
  The same holds for sys-13 examples' `ReserveStock` lines.
- **sys-12-ok-shop-price-read-only-in-payload-admin**, SYS-1 and SYS-9:
  `components: { afterInput: ["@teeladen/shop/payload#ChangePriceButton"] }` needs shop to export a
  path holding a driving adapter, which is not of its offer. Catalog's config, code outside shop, reaches
  it by that path.
- **tx-22-ok-payment-requests-checkout-session**, TX-30: payment asks Stripe for a tentative operation.
  Whether payment "holds" it while recording nothing is unclear, but if it does, no business rule of
  payment's decides what happens when the confirmation does not come. The expiry is shop's deadline,
  passed in as `expiresAt`.
- **tx-34-ok-refund-refusal-published**, TX-24 (SHOULD): the refusal decides by the Payment's
  dispute, and the use case saves only the Refund. A dispute committed between load and commit is
  missed. This is allowed as a SHOULD deviation, but unstated.

### (d) contradicts a fixture fact

- **tx-29-ok-catalog-writes-product-changed-in-payload-transaction**: `apps/server/assembly.ts` gives
  `fulfillment.handlers` to its bus. Fixture: fulfillment "runs in its own worker process", which "has
  its own entry point and its own assembly".
- **tx-22-ok-payment-requests-checkout-session** and **tx-3-ok-checkout-requests-checkout-session**: a
  Stripe Checkout Session. Fixture: payment "creates a Stripe PaymentIntent when shop's checkout calls
  it" (saga step 2 likewise). I read this as a fact, which is what makes the finding.
- **tx-3-ok-checkout-requests-checkout-session**: `placeOrder(cart, customerId)` copies nothing from
  catalog (fixture: "copies each line's price, sku and tax class from catalog's product"), and every
  checkout requests a session, while pay-by-invoice orders take "no Stripe payment".
- **tx-22-ok-payment-requests-checkout-session** vs **tx-30-ok-payment-asks-stripe-at-deadline**: one
  has payment record nothing until the webhook, the other loads `payments.overdue(...)` with
  `externalRef`, so payments exist before it. The fixture allows either; the two examples cannot both
  describe payment.
- **svc-7-ok-payment-reaches-stripe-through-gateway-port**: `amount.amount`, and sys-12-ok's
  `{ amount, currency: "EUR" }`, contradict the shared kernel `Money = { cents, currency }` of
  sys-14-ok. `Money` is a fixture fact ("shared kernel: `Money`, `Sku`"), so its shape cannot differ
  between examples.
- **tx-33-ok-billing-handles-payment-refunded**: `apps/worker/assembly.ts` subscribes payment's and
  billing's handlers. The fixture's only worker is fulfillment's.

## Rules whose purpose the text does not tell

- **DRV-1** (at most one acting call): why two acting calls from one adapter are worse than one use
  case that does both. I guess P7, since two calls are two transactions and a stop between them leaves
  half. The Statement does not say whether an acting call into another system's port counts.
- **SVC-3** (a service must not call another of its system): what breaks. I guess nested transactions
  (TX-1, one per use case) and use cases that hide sequences, but the Scope ("needs what another does")
  reads like a ban on reuse.
- **TX-37** (no re-deciding): presumably the decision committed with the message must not be
  overturned by later state. Its Statement also forbids the `handled.claim` check every other handler
  example uses, and the text does not say whether that is meant (finding tx-37-breach…).
- **TX-24** (decided-by data SHOULD belong to saved aggregates): presumably so that TX-23's version
  check guards the decision. The Statement names neither.
- **ASM-10** ("same in every instance, process and test" SHOULD be imported): what goes wrong when it
  is injected instead. Only waste, or something else?
- **SYS-10** (loading the published-language path loads nothing else): browser bundles, import cycles,
  or startup cost? sys-14 hints at the browser, but SYS-10 is not on its list.
- **SYS-15** (fakes on a path no deployed code imports): bundle size, or a fake wired in production by
  mistake?
- **TX-39** (private messages handled by their writer): presumably P11, but a private message is by
  definition "meant only for the system that wrote it". The rule restates the definition, and its
  purpose beyond that is unclear.
- **DOM-4** (id or snapshot between aggregates of one system): presumably the aggregate boundary for
  TX-23. The Statement does not say what is wrong with holding the other aggregate.
- **TST-8** (fake vs real by flag): what the flag protects against, an edited test that stays edited?
- **TX-28**'s carve-out "beyond recording a tentative operation": why a tentative operation, of all
  changes, is safe before the caller's commit. That reading decides the finding above.
- **ASM-4**: whether it keeps probes and other non-adapters away from the courier on purpose (N16).

## Notes

- **N1.** The distilled names 30 example references, 29 unique files. tx-28-ok-after-change-hook-records-revalidation-request is listed under TX-28 (ok) and TX-29 (breach), consistent with its frontmatter. All 29 exist.
- **N2.** "a unit of work kept ambient in `AsyncLocalStorage`" (common library) is read as a situation. ASM-9 rules it out, and the build uses an explicit `TransactionPort`.
- **N3.** "Calls billing's open host service in-process while holding its own ambient transaction" is read as a situation. The call stays and the transaction becomes an argument that is not passed (ASM-9, TX-25).
- **N4.** "Creates a Stripe PaymentIntent when shop's checkout calls it, and returns its `client_secret` in the same call" is read as a fact. The examples' Checkout Session is a different mechanism, and with the fact held the finding tx-36-breach-checkout-payment-intent-in-request follows.
- **N5.** "Driving side: `afterChange` hooks call shop's services" is read as a situation. TX-29 (SHOULD) moves it to catalog's outbox. The `beforeChange` question to shop stays as a hook.
- **N6.** TX-12 says "the owner's open host service". Open host service is "the driving ports a system offers to other systems", and an external system has no driving ports of ours. I read Payload's Local API as catalog's open host service, from "it is driven through its API".
- **N7.** Idempotent: "leaves the records as performing it once left them". Which records is undefined: this system's (P9 says so) or every store the operation touches. The finding tx-37-breach… hangs on it.
- **N8.** "publishes `PaymentSucceeded` or `PaymentFailed`" is read as terminal outcomes. A failed card attempt on an open PaymentIntent publishes nothing, or shop would cancel orders the customer is still paying.
- **N9.** Tentative operation: the definition implies the requester confirms ("its confirmation gives it"). For a PaymentIntent the customer's browser confirms, and for a Checkout Session the customer pays. It is not said whether a confirmation by a third party counts.
- **N10.** "pure code of no system" (DOM-1, SYS-14) is read to include zod. Pure's "loads on every runtime" excludes Node-only packages, so whether a domain may import `node:crypto` for ids is open. Who mints message ids in a published builder (`reserveStock(...)` in sys-13-ok) is open too: a fresh uuid is "something the caller did not pass".
- **N11.** ASM-6 "no schema, no aggregate, no business rule of any system" is read with "of any system" qualifying all three, so the common library's message envelope schema is allowed.
- **N12.** Owner of the admin dashboard is not given. I added a fifth system, `backoffice`. Reading it as shop's use case instead gives the same build with shop keeping the replicas.
- **N13.** Pay-by-invoice "after the order ships" is read as: the invoice's due date is set by `ShipmentDispatched`, and the invoice itself is issued on `OrderPlaced` (fixture, billing).
- **N14.** "a dropped cancel" is read as a cancel handled before the reservation existed and lost, not as a bus that drops (TX-21 forbids that). Both are covered: the tombstone and the lapse rule.
- **N15.** The fixture gives no rule for insufficient stock. I picked backorder (reserve below zero, ship when stock arrives), so no new saga step is needed. A refusal would need a fulfillment event and shop's TX-35 rule.
- **N16.** Probes: ASM-4's Scope ("code reads the courier") does not exclude them, and they are no driving adapters, so a `/health` route cannot read the courier. It builds its own client. No rule says how a probe gets what assembly made.
- **N17.** The Payload cycle (config → hooks → services → Payload) can be broken without a courier: hooks needing no Payload are built first, and adapters take `() => Payload`. Then DRV-3's "cannot construct, or cannot hand" does not hold for Payload's hooks. The courier remains for Next's server actions and route handlers. Whether ASM-8 can be met when Payload runs hooks during `getPayload` (onInit, migrations, jobs) depends on that split.
- **N18.** Catalog's veto (`beforeChange`) races an order opened between shop's answer and Payload's commit. The rule is catalog's, in an external system's config, outside the rules. Only SYS-12 and TX-29 reach into that config, so nothing places this race.
- **N19.** DRV-7 says "acknowledge", while the glossary defines **Settle** ("telling what delivered it that the message is done") and not "acknowledge". I read them as the same.
- **N20.** Undefined or loose words: "open order" (fixture; read as status `placed`), "double" (TST-5, TST-10), "flag" (TST-8), "contract suite" (TST-6), "deploy" (F4), "conforms" (no rule says how a system declares that it conforms to an upstream, though DOM-1, SVC-6 and the glossary's Conformist depend on it).
- **N21.** "Calls billing's open host service in-process": billing's services must exist in the web process. A system's code runs in several processes (fulfillment's queries also run in web), which the world allows ("run as one or more processes").
- **N22.** Missing ids (DOM-2, DOM-5, DOM-6, SVC-5, DRV-2/4/5, DVN-1..3, TX-4, TX-8..11, TX-13, TX-14, TX-16, TX-18, SYS-3..8, SYS-11, TST-1, TST-2, TST-9) are read as dropped rules, not gaps in the distillation.
- **N23.** tx-29-ok's `ProductChanged` has no `id` field. I read Payload's document id of the outbox row as the message id. It also has no version, and TX-32's Scope would hold if catalog were a system of this codebase and any reader kept a replica of products. None does here.
