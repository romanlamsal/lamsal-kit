# Adversarial review, raw set

Read: glossary.md, the-world.md, general-rules.md, domain.md, all 165 files of examples/. Nothing else.
Binding text only: a rule's Scope + Statement; a property's heading, Except, Against. Reach is read as
the glossary defines it, "what running it reads or calls, however the code got hold of it" (N1).

## Summary

- `dom-1-breach-order-type-imported-as-type-from-drizzle.md` — DOM-1 — P1 — Reach is runtime, so `import type` from the Drizzle schema reaches nothing and the existing breach becomes ok by one keyword.
- `dom-1-breach-discount-campaign-held-in-domain-module.md` — DOM-1 (and ASM-3, SYS-14 Scopes) — P4 — DOM-1 bounds what the domain reaches past itself, not the domain's own module state, so a per-process campaign kept in a domain `let` passes every Statement.
- `dom-1-breach-catalog-document-restated-inline.md` — DOM-1 — P1, P12 — catalog's Payload document restated as an inline type in shop's domain reaches nothing, and no Statement keeps another system's model out of a non-conformist domain.
- `dom-7-breach-checkout-rules-in-shared-kernel.md` — DOM-7, DOM-1, SYS-14 — P3 — no Statement bounds what a shared kernel holds, so shop's and billing's own business rules move into it and every importer changes for each owner's reasons.
- `dom-7-breach-payment-deadline-minutes-from-env.md` — DOM-7 with ASM-2 — P2, P4 — the number in a business rule arrives as a "configuration value" ASM-2 sanctions, and lives in two env files that differ.
- `dom-4-breach-order-hydrates-payment-on-every-load.md` — DOM-4 — P15 — DOM-4's Scope is "of the same system", so an Order holding payment's aggregate, refreshed from payment's open host service on every load, is unruled.
- `svc-7-breach-driven-port-in-sql-terms.md` — SVC-7, SVC-1, SVC-6 — P5 — a driven port `Sql.rows(text, values)` is a port of the system declared in its service layer; no Statement requires a driven port to speak the system's terms.
- `svc-1-breach-port-typed-as-adapter-return.md` — SVC-1, SVC-6 — P5 — a service typed by `ReturnType<typeof createDrizzleOrderRepository>` declares no port, so SVC-1's Scope never opens, and the type-only import reaches nothing.
- `drv-8-breach-handler-publishes-through-bus-context.md` — DRV-8, DRV-1 — P8 — "what calls it" is on DRV-8's list, so a handler publishes through the bus's context after the use case commits, and a crash between loses the event.
- `drv-7-breach-use-case-commits-after-returning.md` — DRV-7, TX-1 — P8 — "succeeded" is defined only in DRV-7's Why; a service that returns before its detached transaction commits lets the hook answer 200 for a write that then rolls back.
- `dvn-4-breach-repository-announces-row-changes.md` — DVN-4, TX-2 — P13, P2 — a repository writes `OrderStatusChanged` with the storage row through the common library's outbox helper, which DVN-4's list admits.
- `asm-2-breach-adapter-method-reads-env.md` — ASM-2 — P5 — ASM-2 binds the factory, not the functions it returns, so the 3PL client reads its URL and key from the environment at each call.
- `asm-3-breach-audit-column-from-ambient-user.md` — ASM-3 — P4 — an audit column filled from the ambient user changes neither how the use case acts nor what it answers; only the Why refuses it.
- `asm-3-breach-handler-locale-from-trace-baggage.md` — ASM-3 — P14 — ASM-3's Scope stops at services and driven adapters, so a handler takes the locale from OTel baggage and passes it as an argument.
- `asm-5-breach-relay-finds-outbox-tables-through-handed-pool.md` — ASM-5 — P5 — the relay reaches every outbox "through what assembly hands it", the pool, and lists the tables by name, the breach the Why names.
- `asm-6-breach-money-type-in-common-library.md` — ASM-6, DOM-1 — P3 — a TypeScript type is no schema, no aggregate and no business rule read literally, and a type-only import reaches nothing.
- `asm-9-breach-ambient-request-connection.md` — ASM-9 — P16 — the transaction is an argument everywhere, but the request's connection is ambient, and billing's in-process read runs inside shop's open transaction.
- `tx-2-breach-outbox-adapter-also-publishes-early.md` — TX-2, TX-6 — P8 — the outbox adapter writes the row in the handed transaction and also pushes the event to a Redis stream, which is "the outside", not "its store".
- `tx-23-breach-save-of-an-aggregate-not-loaded-through-it.md` — TX-23, SVC-4 — P10 — an upsert that never loaded, and a save of an aggregate loaded through a query port, are outside TX-23's Scope and write over a concurrent change.
- `tx-23-breach-failed-save-swallowed.md` — TX-23 — P10 — the save fails as required, returns `"stale"`, and the use case commits `OrderPaid` anyway; the rollback is only in the Why.
- `tx-24-breach-credit-limit-read-through-query-port.md` — TX-24, SVC-2 — P10 — TX-24 is a SHOULD whose deviation needs no business rule, so two checkouts both pass a credit limit read from data neither saves.
- `tx-25-breach-port-returns-a-function-of-a-transaction.md` — TX-25 — P16 — billing's driving port takes no transaction; it returns a function that takes one, and shop runs billing's read inside shop's transaction.
- `tx-36-breach-hold-that-confirms-itself.md` — TX-36 (with the glossary) — P8 — a "tentative" refund that executes unless cancelled is asked by a call inside shop's transaction; the transaction rolls back and the refund goes out.
- `tx-28-breach-pending-price-read-as-current.md` — TX-28 — P8 — the hook's use case records only a tentative operation, and checkout prices orders by it before Payload commits.
- `tx-30-breach-business-rule-keeps-waiting.md` — TX-30 — P17 — the business rule TX-30 asks for decides "look again in an hour", forever; "Each ends the waiting" is only in the Why.
- `tx-35-breach-business-rule-parks-the-event.md` — TX-35 — P17 — a business rule written in the domain decides "a human reviews it" by throwing, and the late payment parks in a dead-letter queue with the card charged.
- `tx-20-breach-relay-cursor-skips-late-commit.md` — TX-20 — P8 — a reader that advances a cursor past a sequence gap never reads the message a slower transaction commits later, so TX-20 never binds.
- `tx-21-breach-poison-message-redelivered-forever.md` — TX-21, TX-38 — P17 — a bus that redelivers until acknowledged with no attempt limit satisfies TX-21, and with per-key order a poison message stalls the order's work for good.
- `tx-7-breach-field-meaning-changed-schema-unchanged.md` — TX-7 — P14 — `stage: "collection"` changes meaning while the schema stays byte for byte, so TX-7's Scope ("the schema … changes") never opens.
- `tx-7-breach-old-process-saves-record-without-new-column.md` — TX-7 — P14 — TX-7 covers messages and cross-process ports, not records: an old process's save drops a column the new code wrote.
- `tx-12-breach-shop-reads-billing-outbox-rows.md` — TX-12 — P11 — shop reads "the owner's published events" from billing's outbox table, parsed with billing's published language.
- `sys-13-breach-command-published-as-event.md` — SYS-13, TX-33, TX-17 — P3, P2 — `OrderReadyForReservation` is published as an event, carries fulfillment's hold period and location chosen by shop, and so escapes SYS-13's Scope.
- `sys-2-breach-published-type-picked-from-domain-type.md` — SYS-2 — P13 — `import type { Order }` and `Pick<Order, …>` in the published-language module reach nothing, so SYS-2 holds while the contract moves with the model.
- `sys-12-breach-editors-create-and-delete.md` — SYS-12 — P11 — "MUST NOT change it" leaves Payload's create, duplicate and delete free to write shop's price by catalog's rules.
- `tst-6-breach-real-run-flag-never-set.md` — TST-6, TST-8, TST-12 — P6 — the contract suite runs against the real Stripe adapter only behind a flag that TST-12 says not to set automatically, and nothing says when it runs.

## Findings

**DOM family**

### dom-1-breach-order-type-imported-as-type-from-drizzle.md
```yaml
breaches: []
satisfies: [DOM-1]
situation: shop's Order type is inferred from its Drizzle table
finding: adversarial
```
# The domain takes `Order` from the Drizzle table through `import type`
```ts
// shop/domain/order.ts — the same code as dom-1-breach-order-type-from-drizzle-table, one keyword added
import type { orders } from "../adapters/drizzle/schema"        // erased: running this module reaches nothing

export type Order = typeof orders.$inferSelect

export const canBeCancelled = (order: Order, now: Date): boolean =>
    order.status === "placed" && order.paymentDeadline > now
```
DOM-1's Statement is about what the domain reaches, and Reach is "what running it reads or calls". A type-only
import is erased at compile time, so running `order.ts` reads and calls nothing past the domain. DOM-1's list is
never consulted and the Statement calls this ok. The Why's runtime test passes too: the browser bundle has no
Drizzle in it. P1 still fails, as the existing breach example describes. A column renamed for storage renames a
domain field. The fake repository has to produce Drizzle's `$inferSelect` row. A second store has to imitate
Postgres's `timestamp` mapping. The same blind spot runs through every reach list: SVC-6 (`import type {
NodePgDatabase }` in a port, see Why findings), DRV-8, DVN-4, SYS-14 and SYS-2
(`sys-2-breach-published-type-picked-from-domain-type.md`). Wording: "What it reaches or names, its types
included, MUST be one of …". Alternatively, define Reach as "what it imports or what running it reads or calls".

### dom-1-breach-discount-campaign-held-in-domain-module.md
```yaml
breaches: []
satisfies: [DOM-1, ASM-3, SYS-14]
situation: shop runs a 10% discount campaign; checkout runs in the web process, reordering a past order runs in the admin process
finding: adversarial
```
# The domain keeps the running campaign in a module variable
```ts
// shop/domain/pricing.ts
let campaignPercent = 0                                                 // the domain's own state, per process
export const startCampaign = (percent: number): void => { campaignPercent = percent }
export const linePrice = (unitPrice: Money, quantity: number): Money =>
    percentOff(times(unitPrice, quantity), campaignPercent)            // kernel's percentOff, pure

// shop/service/start-campaign.ts — an acting use case, called from the back office's server action
export const createStartCampaign = (): StartCampaign => async ({ percent }) => { startCampaign(percent) }

// shop/service/checkout.ts and shop/service/reorder.ts both call the domain's placeOrder → linePrice
```
DOM-1: the domain reaches nothing past itself (zod, the kernel). ASM-3: its Scope is "a service, or a driven
adapter a service calls, reads an ambient value". The service reads nothing. The domain function reads the
per-process value, and the domain is not in ASM-3's Scope. SYS-14 has the same hole for a kernel module with
state, for example a rounding mode set at startup. The glossary says the domain "is pure", but that is a
definition, and no Statement requires a domain module to be pure.

P4 fails. The back office ran `startCampaign(10)` in the web process. A reorder from the admin process prices at
0%. The web process prices at 0% again after its next deploy. The campaign is a decision of the system that no
record holds, so it never commits, and P7 reads oddly here.

Wording: a Statement "The modules of the domain and of a shared kernel MUST be pure (glossary)". The definition
already excludes state: such a module hands its caller what no caller passed.

### dom-1-breach-catalog-document-restated-inline.md
```yaml
breaches: []
satisfies: [DOM-1, DOM-3]
situation: shop reads the product through Payload's Local API; shop has an anti-corruption layer toward catalog
finding: adversarial
```
# Catalog's Payload document, restated as a type in shop's domain
```ts
// shop/domain/cart.ts — imports nothing of catalog: the document is restated by hand
type CatalogProductDoc = {
    id: string; title: string; slug: string; price: number; sku: string
    taxClass: "tea" | "accessory"
    _status: "draft" | "published"                      // Payload's drafts feature
    layout: ReadonlyArray<{ blockType: string }>
}
export const addLine = (cart: Cart, doc: CatalogProductDoc, quantity: number): Cart => {
    if (doc._status !== "published") throw new NotForSale(doc.id)
    return { ...cart, lines: [...cart.lines, { productId: doc.id, sku: doc.sku, unitPrice: { cents: doc.price, currency: "EUR" }, quantity }] }
}

// shop/service/ports/catalog-products.ts — "in the domain's types"
export interface CatalogProducts { byId(productId: string): Promise<CatalogProductDoc | null> }

// shop/adapters/payload/catalog-products.ts — Payload's generated Product is structurally assignable; no translation
export const payloadCatalogProducts = (payload: Payload): CatalogProducts => ({
    byId: (productId) => payload.findByID({ collection: "products", id: productId, disableErrors: true }),
})
```
DOM-1 rules on reach. The inline type reaches nothing. DOM-3 binds a business rule of this system about a
record's shape, and this is catalog's shape, not a rule of shop's. The glossary's Anti-corruption layer says
"the upstream's terms stop at those adapters", but that is a definition. No Statement requires a system that
does not conform to keep another system's terms out of its domain.

P1 fails: the domain is shaped by what serves it. When Payload renames `_status` or editors add a block,
shop's domain changes. P12 also fails: catalog's model entered unnoticed, with no import for a linter or reader
to find. Wording: "The domain MUST NOT state another system's model or published language, imported or
restated, unless its system conforms to that system."

### dom-7-breach-checkout-rules-in-shared-kernel.md
```yaml
breaches: []
satisfies: [DOM-7, DOM-1, SYS-14, ASM-6]
situation: billing needs the order's total and deadline; shop and billing share the kernel package with Money and Sku
finding: adversarial
```
# Checkout's and billing's own rules move into the shared kernel "because both need them"
```ts
// kernel/src/order.ts — @teeladen/kernel, imported by shop's and billing's domains
import { z } from "zod"
import { moneySchema } from "./money"

export const kernelOrderSchema = z.object({
    id: z.string(), status: z.enum(["placed", "paid", "cancelled"]),
    total: moneySchema, placedAt: z.string().datetime(), payByInvoice: z.boolean(),
})
export type KernelOrder = z.infer<typeof kernelOrderSchema>
export const paymentDeadline = (o: KernelOrder): Date => new Date(Date.parse(o.placedAt) + 30 * 60_000)   // checkout's rule
export const mayPayByInvoice = (stage: "none" | "reminder" | "collection"): boolean => stage === "none" // checkout's rule
export const vatRateFor = (taxClass: "tea" | "accessory"): number => (taxClass === "tea" ? 7 : 19)     // billing's rule
```
DOM-1 lists a shared kernel. SYS-14 holds: the kernel reaches zod and itself. ASM-6 holds because this is not
the common library. DOM-7 holds: each rule is stated once, and a shared kernel is "imported into its domain"
(glossary), so the rule is in the domain of each importer. No Statement bounds what a shared kernel may hold. No
Statement requires the systems that import it to be the ones whose business rules decide each part of it.

P3 fails, as P3's own Why describes: "A billing change that reaches checkout through a shared `Order` edits
code that had no reason to change." Billing's VAT change bumps the kernel and redeploys shop. Billing's
reviewers approve checkout's 30-minute deadline. Wording: "A shared kernel MUST hold only what every system
that imports it decides together; a business rule that one system alone decides MUST be stated in that
system's domain."

### dom-7-breach-payment-deadline-minutes-from-env.md
```yaml
breaches: []
satisfies: [DOM-7, ASM-2, ASM-3]
situation: shop's Order holds the payment deadline; orders are placed by the web process and by the admin process (phone orders)
finding: adversarial
```
# The rule's form is in the domain, its number in two env files
```ts
// shop/domain/order.ts — stated once, in the domain
export const paymentDeadline = (placedAt: Date, minutes: number): Date => new Date(placedAt.getTime() + minutes * 60_000)

// shop/build.ts — system builder: "it takes configuration and returns implementations" (glossary)
export const buildShop = (deps: ShopDeps, config: { paymentDeadlineMinutes: number }) => ({
    checkout: createCheckout({ ...deps, deadlineMinutes: config.paymentDeadlineMinutes }),
    placePhoneOrder: createPlacePhoneOrder({ ...deps, deadlineMinutes: config.paymentDeadlineMinutes }),
})

// apps/web/instrumentation.ts and apps/admin/main.ts — each process's assembly
buildShop(deps, { paymentDeadlineMinutes: Number(process.env.PAYMENT_DEADLINE_MINUTES) })
// infra/web.env: PAYMENT_DEADLINE_MINUTES=30      infra/admin.env: PAYMENT_DEADLINE_MINUTES=1440
```
ASM-2 makes the builder receive a configuration value from its caller, and its Why calls such a value "what a
test varies". ASM-3 holds: nothing is ambient, and the number arrives through a signature. DOM-7 holds: the
deadline rule is a domain function. DOM-7 never says whether the number a rule decides by belongs to the rule,
and nothing defines "configuration value".

P2 fails: a reader of the domain finds no 30. P4 fails: the same use case gets a different deadline depending on
which process's env it runs under. That is the harm of ASM-3's `TZ` example, reintroduced through a signature
that ASM-2 approves. Wording: DOM-7 "…stated once, in the domain, with every value it decides by that no use
case's caller supplies", and a glossary entry for configuration value that excludes such values.

### dom-4-breach-order-hydrates-payment-on-every-load.md
```yaml
breaches: []
satisfies: [DOM-4, DOM-1, DVN-4, TX-12, SYS-9]
situation: shop's Order refers to payment's Payment; shop conforms to payment's published language
finding: adversarial
```
# The Order holds payment's Payment, and its repository refreshes it on every load
```ts
// shop/domain/order.ts — shop conforms to payment, so its domain imports payment's published language (DOM-1)
import { paymentViewSchema } from "@teeladen/payment"
export const orderSchema = z.object({
    id: z.string(), status: z.enum(["placed", "paid", "cancelled"]),
    lines: z.array(orderLineSchema), payment: paymentViewSchema.nullable(),
})
export const mayCancel = (o: Order): boolean => o.status === "placed" && o.payment?.status !== "processing"

// shop/adapters/drizzle/order-repository.ts — calls payment's open host service, "the outside" (DVN-4)
import type { PaymentByOrder } from "@teeladen/payment"
export const createOrderRepository = (paymentByOrder: PaymentByOrder): OrderRepository => ({
    byId: async (id, tx) => {
        const row = await asDrizzle(tx).query.orders.findFirst({ where: eq(orders.id, id), with: { lines: true } })
        return row ? orderSchema.parse({ ...fromRow(row), payment: await paymentByOrder({ orderId: id }) }) : null
    },
})
```
DOM-4's Scope is "another aggregate of the same system", and Payment is payment's. DVN-4 lists "the outside",
which the glossary's Outside defines as other systems among others. DVN-4's Why types the in-process adapter by
the upstream's export path, as done here. TX-12 holds because the read goes through payment's open host
service. The dom-4 examples are about catalog's Product and payment's id, both outside DOM-4's Scope (N8).

P15 fails. While payment is down, every load of an Order fails: cancel, mark paid, the deadline task, the order
page. No business rule needs payment's answer now. The glossary's Snapshot speaks of "this system's terms", so
it was written for the cross-system case that DOM-4's Scope leaves out. Wording: Scope "an aggregate needs
something of another aggregate, of its system or another".

**SVC family**

### svc-7-breach-driven-port-in-sql-terms.md
```yaml
breaches: []
satisfies: [SVC-7, SVC-1, SVC-6, ASM-2]
situation: catalog's beforeChange asks shop how many open orders carry a sku
finding: adversarial
```
# A driven port that takes SQL
```ts
// shop/service/ports/sql.ts — a driven port of shop, declared in its service layer
import type { Transaction } from "@teeladen/common/transaction"
export interface Sql {
    rows<T>(text: string, values: readonly unknown[], parse: (row: unknown) => T, tx: Transaction): Promise<T[]>
}

// shop/service/count-open-orders-with-sku.ts — the answering use case behind the hook
export const createCountOpenOrdersWithSku = ({ sql, transaction }: Deps): CountOpenOrdersWithSku =>
    ({ sku }) => transaction.run(async (tx) => {
        const [r] = await sql.rows(
            "select count(*)::int as n from orders o join order_lines l on l.order_id = o.id where l.sku = $1 and o.status in ('placed','paid')",
            [sku], countRowSchema.parse, tx)
        return { openOrders: r?.n ?? 0 }
    })

// shop/adapters/pg/sql.ts — the driven adapter, one line
export const createPgSql = (): Sql => ({ rows: async (text, values, parse, tx) => (await asPg(tx).query(text, [...values])).rows.map(parse) })
```
SVC-1 holds because the port is declared in the service layer. SVC-6 holds because the service reaches a port
of its system and the common library's opaque transaction. SVC-7 holds because the outside is reached "through
a port of its system". ASM-2 holds because the adapter arrives from the caller. The glossary requires the
system's terms only of a driving port ("in the system's terms, not its store's"). A driven port is just "a way
out of the system". SVC-7's Why says a port of the system is in the system's terms "(SVC-1)", but SVC-1 says
only where a port is declared.

P5 fails: "each port speaks the system's terms". Table and column names, and what "open" means, now sit in the
service. P6 degrades too: the fake of `Sql` is an SQL interpreter or a real Postgres. Wording: a glossary
clause "A driven port … in the system's terms, not its store's or the outside's", or SVC-1 "…in the service
layer, in its system's terms".

### svc-1-breach-port-typed-as-adapter-return.md
```yaml
breaches: []
satisfies: [SVC-1, SVC-6]
situation: shop's order page reads an order with its lines
finding: adversarial
```
# No port is declared: the service's dependency is the adapter's inferred type
```ts
// shop/adapters/drizzle/order-queries.ts
export const createDrizzleOrderQueries = (db: NodePgDatabase) => ({
    byId: (id: string) => db.query.orders.findFirst({ where: eq(orders.id, id), with: { lines: true } }),
})

// shop/service/get-order-detail.ts — answering use case
import type { createDrizzleOrderQueries } from "../adapters/drizzle/order-queries"        // erased
type Deps = { orders: ReturnType<typeof createDrizzleOrderQueries> }
export const createGetOrderDetail = ({ orders }: Deps): GetOrderDetail =>
    async ({ orderId }) => { const row = await orders.byId(orderId); return row ? toOrderDetail(row) : null }
```
SVC-1's Scope is "a system declares a port", and shop declares none, so SVC-1 never opens. SVC-6 is a reach
list, and the type-only import reaches nothing (N1). SVC-7 is arguable either way: the service does reach the
store through the object it was handed. Whether that object is "a port of its system" is unclear when nobody
declared one.

P5 fails. The dependency is Drizzle's relational query result with `with: { lines }`. Its fake has to reproduce
Drizzle's nested row types, and replacing Drizzle changes the service. Wording: SVC-1 Scope "a service depends
on something it is handed" with Statement "that MUST be a port its system declares in its service layer".

**DRV family**

### drv-8-breach-handler-publishes-through-bus-context.md
```yaml
breaches: []
satisfies: [DRV-8, DRV-1, TX-6]
situation: fulfillment reserves stock on OrderPlaced; some skus are short
finding: adversarial
```
# The handler publishes `StockShort` through the context the bus hands it
```ts
// common/src/bus.ts — the bus hands each handler a context, as most brokers' client libraries do
export type HandlerContext = { publish(message: Envelope): Promise<void> }
export type Handler = (message: Envelope, ctx: HandlerContext) => Promise<void>

// fulfillment/driving/handlers/order-placed.ts
export const createOrderPlacedHandler = ({ reserveStock }: { reserveStock: ReserveStock }): Handler =>
    async (message, ctx) => {
        const placed = orderPlacedSchema.parse(message.payload)
        const result = await reserveStock({ messageId: message.id, orderId: placed.orderId, lines: placed.lines })   // the one acting call; commits
        if (result.short.length > 0)
            await ctx.publish({ id: crypto.randomUUID(), name: "StockShort", payload: { orderId: placed.orderId, skus: result.short }, occurredAt: new Date().toISOString() })
    }
```
DRV-8 lists "what calls it", and the bus calls the handler. DRV-1 holds with one acting call. TX-6, TX-3 and
TX-22 bind use cases, and this message belongs to the adapter.

P8 fails. The process dies after `reserveStock` commits and before `publish`. The redelivery finds the message
id claimed, returns, and acknowledges. `StockShort` is never published, shop never learns, and the order waits
out its deadline (P17). The id is fresh per attempt, unlike the glossary's message id, which is the same on
every delivery. Deciding to announce a shortage also sits in an adapter (P2). Wording: DRV-8 "what calls it,
for what it handed the adapter and the adapter's answer to it", or "a driving adapter MUST NOT write or publish
a message".

### drv-7-breach-use-case-commits-after-returning.md
```yaml
breaches: []
satisfies: [DRV-7, TX-1, TX-5]
situation: Stripe webhooks arrive at least once; Stripe stops resending after three days
finding: adversarial
```
# The service returns before its transaction commits; the hook answers 200
```ts
// payment/service/record-stripe-event.ts
export const createRecordStripeEvent = ({ transaction, handled, payments, outbox }: Deps): RecordStripeEvent =>
    async (outcome) => {
        void transaction.run(async (tx) => {                             // "answer Stripe fast, commit behind it"
            if (!(await handled.claim(outcome.eventId, tx))) return
            const payment = await payments.byIntentId(outcome.intentId, tx)
            if (!payment) throw new UnknownIntent(outcome.intentId)
            const next = applyOutcome(payment, outcome)
            await payments.save(next.payment, tx)                         // fails on a concurrent save (TX-23)
            for (const m of next.messages) await outbox.write(m, tx)
        }).catch((e: unknown) => logger.error({ err: e }, "stripe event not recorded"))
    }

// payment/driving/stripe-webhook.ts
await recordStripeEvent(toPaymentOutcome(event))          // returned without error
return new Response(null, { status: 200 })
```
DRV-7's Statement says "unless the use case it calls has succeeded", and the call returned without error. That
"one that writes succeeds when it has committed" appears only in DRV-7's Why. TX-1 holds: the service opens the
transaction, hands it on and commits it, just later.

P8 fails. The save loses to a concurrent one and rolls back after the 200. Stripe never resends, and
`PaymentSucceeded` is lost to everything downstream (P17: shop's deadline cancels a paid order). Wording: "…unless
the use case it calls has returned and, where it writes, committed."

**DVN family**

### dvn-4-breach-repository-announces-row-changes.md
```yaml
breaches: []
satisfies: [DVN-4, TX-2, ASM-6]
situation: shop's order status changes on payment, cancel and deadline; billing wants to know
finding: adversarial
```
# The repository writes `OrderStatusChanged` from the row, through the common library's outbox helper
```ts
// common/src/outbox.ts — generic plumbing; no schema of any system
export const appendToOutbox = async (tx: Transaction, table: OutboxTable, name: string, payload: unknown): Promise<void> => {
    await asDrizzle(tx).insert(table).values({ id: crypto.randomUUID(), name, payload, occurredAt: new Date().toISOString() })
}

// shop/adapters/drizzle/order-repository.ts
import { appendToOutbox } from "@teeladen/common/outbox"
export const createDrizzleOrderRepository = (): OrderRepository => ({
    save: async (order, tx) => {
        const row = toOrderRow(order)
        const before = await asDrizzle(tx).query.orders.findFirst({ where: eq(orders.id, order.id) })
        await asDrizzle(tx).insert(orders).values(row).onConflictDoUpdate({ target: orders.id, set: row })
        if (before?.status !== row.status) await appendToOutbox(tx, shopOutbox, "OrderStatusChanged", row)   // "status events for free"
    },
})
```
DVN-4 lists the common library. TX-2 holds because every call runs in the handed transaction. TX-6 binds "a use
case writes a message", and the use case wrote none. SYS-2 binds modules that declare the published language,
and none declares `OrderStatusChanged`: its payload is the storage row.

P13 fails. Billing handles `OrderStatusChanged`. When shop renames `payment_deadline` for storage reasons,
billing's handler breaks. P2 fails because which changes are announced is decided in a repository. Wording:
DVN-4 "…the common library, for nothing that writes a message", or a TX rule "A message MUST be written by a
use case, in a shape its system's published language or private messages declare".

**ASM family**

### asm-2-breach-adapter-method-reads-env.md
```yaml
breaches: []
satisfies: [ASM-2, ASM-3, DVN-4]
situation: fulfillment books shipments with the 3PL warehouse API
finding: adversarial
```
# The factory needs nothing; the method it returns reads the environment
```ts
// fulfillment/adapters/warehouse-client.ts
export const createWarehouseClient = (fetchImpl: typeof fetch = fetch): Warehouse => ({
    async book(request, { idempotencyKey }) {
        const res = await fetchImpl(`${process.env.WAREHOUSE_URL}/shipments`, {
            method: "POST",
            headers: { authorization: `Bearer ${process.env.WAREHOUSE_KEY}`, "idempotency-key": idempotencyKey },
            body: JSON.stringify(toWarehouseBooking(request)),
        })
        return fromWarehouseBooking(await res.json())
    },
})
```
ASM-2's Scope is "a factory needs … a configuration value". The factory reads nothing. The `book` it returns
reads at call time, so the Why's harm at load does not happen and the Statement holds. ASM-3's Scope covers this
read: a driven adapter a service calls reads a per-process ambient value. While the 3PL answers, the URL changes
neither how the use case acts nor what it answers.

P5 fails: "only through ports assembly hands it". Which 3PL serves the `Warehouse` port is decided by the
environment of the process that runs the call. A staging worker started with production's `WAREHOUSE_URL`
books real parcels. The contract suite (TST-5) talks to whatever CI's environment points at. Wording: "A
factory, and every function it returns, MUST receive it from the factory's caller."

### asm-3-breach-audit-column-from-ambient-user.md
```yaml
breaches: []
satisfies: [ASM-3]
situation: Payload's afterChange hook calls shop's syncPrice; a CLI reimport and a handler call it too
finding: adversarial
```
# The repository records who changed the price from the request context
```ts
// shop/adapters/drizzle/product-commercial-repository.ts — a driven adapter a service calls
import { requestContext } from "@teeladen/common/request-context"
save: async (fields, tx) => {
    await asDrizzle(tx).update(productCommercial).set({ price: fields.price.cents, sku: fields.sku })
        .where(eq(productCommercial.productId, fields.productId))
    await asDrizzle(tx).insert(priceChanges).values({
        productId: fields.productId, price: fields.price.cents,
        changedBy: requestContext.getStore()?.user?.id ?? null,           // decides nothing; answers nothing
    })
}
```
The use case decides nothing by `changedBy` and answers the same, so ASM-3's Statement ("MUST NOT change how
the use case acts or what it answers") holds. It holds just as it does for the request-id column in
`asm-3-ok-actor-through-driving-port.md`. Only the Why rules that "the user an audit column records arrive as
arguments".

P4 fails if "responds" includes the records a use case leaves, which is how the glossary's Use case reads ("how
the system responds"). The same price change records the editor from the hook and `null` from the CLI or the
handler. Wording: "…MUST NOT change how the use case acts, what it records, or what it answers; telemetry
excepted".

### asm-3-breach-handler-locale-from-trace-baggage.md
```yaml
breaches: []
satisfies: [ASM-3, ASM-7, DRV-1]
situation: the order-confirmation mail is rendered in the language the customer checked out in
finding: adversarial
```
# The handler takes the locale from OTel baggage and passes it as an argument
```ts
// shop/driving/handlers/send-order-confirmation.ts — the bus restored the envelope's trace context
// (asm-3-ok-trace-context-crosses-bus-in-envelope.md); the web request put `locale` into baggage
import { context, propagation } from "@opentelemetry/api"
export const createSendOrderConfirmationHandler = ({ sendOrderConfirmation }: Deps): Handler =>
    async (message) => {
        const locale = propagation.getBaggage(context.active())?.getEntry("locale")?.value === "en" ? "en" : "de"
        await sendOrderConfirmation({ ...sendOrderConfirmationSchema.parse(message.payload), locale })   // an argument, as ASM-3 asks
    }
```
ASM-3's Scope is "a service, or a driven adapter a service calls", and a handler is a driving adapter. DRV-1's
Why counts "putting per-request ambient values in" as preparing the call. The service receives the locale as an
argument. ASM-7 lets telemetry ride through the common library.

P14 fails. The same `SendOrderConfirmation` means "send in English" to a process whose OTel SDK propagates
baggage. It means "send in German" when there are no headers: a redelivery from the dead-letter queue, a worker
without the preload, or a relay whose reader carries none, like catalog's Payload outbox reader in
`tx-29-ok-…`. Wording: ASM-3 Scope "code of a system reads an ambient value" with telemetry the only exemption,
or "a handler MUST take what it passes from the message".

### asm-5-breach-relay-finds-outbox-tables-through-handed-pool.md
```yaml
breaches: []
satisfies: [ASM-5, ASM-2, ASM-6]
situation: the common library's relay in the web process and in the fulfillment worker
finding: adversarial
```
# Assembly hands the relay a pool; the relay finds the outboxes by name
```ts
// common/src/relay.ts — imports no system; everything it uses is handed to it
export const createRelay = ({ pool, bus }: { pool: Pool; bus: Bus }): Relay => ({
    tick: async () => {
        const { rows: tables } = await pool.query<{ table_name: string }>(
            "select table_name from information_schema.tables where table_name like '%\\_outbox'")
        for (const { table_name } of tables) {
            const { rows } = await pool.query<OutboxRow>(`select * from ${table_name} where delivered_at is null order by seq limit 100`)
            for (const row of rows) {
                await bus.publish(toEnvelope(row))
                await pool.query(`update ${table_name} set delivered_at = now() where id = $1`, [row.id])
            }
        }
    },
})
// apps/fulfillment-worker/main.ts
const relay = createRelay({ pool, bus })
```
ASM-5's Statement is "MUST reach it through what assembly hands it". The relay reaches every system's outbox
through the pool, and assembly handed it the pool. The Statement calls this ok. The Why names this exact breach:
"a relay that lists the outbox tables by name knows every system's store and misses an outbox kept in another
shape".

P5 fails: billing is reached past the outbox reader it provides (glossary: Outbox reader, "the system provides
it"). Billing then moves its messages to a field on the invoice record, which TX-6's Why allows, and delivery
stops without notice. The fulfillment worker relays shop's and billing's outboxes, and loads neither. Wording:
"MUST reach it only through the system's outbox readers and handlers that assembly hands it."

### asm-6-breach-money-type-in-common-library.md
```yaml
breaches: []
satisfies: [ASM-6, DOM-1]
situation: shop, payment and billing all compute with money
finding: adversarial
```
# `Money` as a type, not a schema, in the common library
```ts
// common/src/types.ts — "types only: no schema, no aggregate, no rule"
export type Money = { readonly cents: number; readonly currency: "EUR" }

// billing/domain/invoice.ts
import type { Money } from "@teeladen/common/types"            // erased: the domain reaches nothing (DOM-1)
export const invoiceTotal = (lines: readonly InvoiceLine[]): Money =>
    lines.reduce<Money>((sum, l) => ({ cents: sum.cents + l.gross.cents, currency: "EUR" }), { cents: 0, currency: "EUR" })
```
Read literally, ASM-6 forbids "no schema, no aggregate, no business rule of any system". A type alias is not a
runtime schema, not an aggregate, and states no rule beyond its shape. "Schema" is undefined (N2). DOM-1 holds
because a type-only import reaches nothing (N1). The common library's own exclusion from DOM-1's list is thus
bypassed by `import type`.

P3 fails. Payment needs CHF for Stripe and widens `currency` in `common/types`. Billing's `invoiceTotal` now
compiles against a currency that billing's rules forbid, and every system recompiles for payment's reason. That
is `asm-6-breach-money-and-message-names-in-common-library.md` with the schema removed. Wording: "…no model: no
schema, no type, no aggregate, no business rule, of any system or of none".

### asm-9-breach-ambient-request-connection.md
```yaml
breaches: []
satisfies: [ASM-9, TX-25, TX-1]
situation: shop calls billing's open host service in-process while holding its own transaction
finding: adversarial
```
# The transaction is an argument everywhere; the request's connection is ambient
```ts
// common/src/request-db.ts — "one connection per request, so row-level security sees the customer"
export const requestDb = new AsyncLocalStorage<NodePgDatabase>()
export const withRequestDb = async <T>(pool: Pool, customerId: string, fn: () => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    try { await client.query("select set_config('app.customer_id', $1, false)", [customerId]); return await requestDb.run(drizzle(client), fn) }
    finally { client.release() }
}

// shop/adapters/drizzle/transaction-port.ts — the Transaction itself is handed as an argument (ASM-9 holds)
begin: async () => { const db = requestDb.getStore() ?? poolDb; await db.execute(sql`begin`); return toTransaction(db) }

// billing/adapters/drizzle/invoice-queries.ts — billing's answering port takes no transaction (TX-25)
forOrder: async (orderId) => (requestDb.getStore() ?? poolDb).query.invoices.findFirst({ where: eq(invoices.orderId, orderId) })
```
No transaction is ambient. Shop's transaction begins on the request's connection and travels as an argument.
Billing's port takes none (TX-25). Billing's answering use case writes nothing, so TX-1 does not apply to it.
The ambient value is a connection. When shop calls `billing.forOrder` inside its open transaction, billing's read
runs on that same connection: inside shop's transaction, seeing shop's uncommitted writes and waiting on its
locks.

P16 fails, and so does the fixture's "the transaction must not" cross system boundaries. ASM-3 refuses this only
where the answer differs, one case at a time. Wording: ASM-9 "A transaction, or anything that reaches a store,
MUST NOT be an ambient value, whatever type it is declared as", which is TX-25's phrasing.

**TX family**

### tx-2-breach-outbox-adapter-also-publishes-early.md
```yaml
breaches: []
satisfies: [TX-2, TX-6, DVN-4]
situation: shop places the order and publishes OrderPlaced; fulfillment reserves stock on it
finding: adversarial
```
# The outbox adapter writes the row in the transaction, and pushes the event to Redis at once
```ts
// shop/adapters/drizzle/outbox.ts
export const createShopOutbox = (redis: Redis): ShopOutbox => ({
    write: async (message, tx) => {
        await asDrizzle(tx).insert(shopOutbox).values({ id: message.id, type: message.type, payload: message })  // in the handed transaction
        await redis.xadd("teeladen:events", "*", "envelope", JSON.stringify(message))                         // "fast path; the relay is the fallback"
    },
})
```
TX-2 says "each call it makes into its store MUST run inside that transaction". The call into its store does.
Redis is not its store. It is "the outside", which is on DVN-4's list. TX-6 holds because the message is
written in the transaction that commits the change. TX-22 binds a use case that decides a change, and the use
case decided only to write a message. "A second transaction behind a port": the adapter commits a second
effect on its own.

P8 fails. Fulfillment reserves stock for an `OrderPlaced` whose order then rolls back, for example when the
cart's save loses to a concurrent one (TX-23). Wording: TX-2 "Each call it makes into a store or to the
outside MUST run inside that transaction, or follow from a message committed in it."

### tx-23-breach-save-of-an-aggregate-not-loaded-through-it.md
```yaml
breaches: []
satisfies: [TX-23, SVC-4, TX-5, TX-6]
situation: billing's dunning stage rises with each reminder and clears once the customer pays
finding: adversarial
```
# An upsert that never loaded, and a save of what a query port loaded
```ts
// billing/service/clear-dunning.ts — on InvoicePaid: "nothing to load, the stage is simply none"
export const createClearDunning = ({ transaction, handled, dunnings, outbox }: Deps): ClearDunning =>
    (event) => transaction.run(async (tx) => {
        if (!(await handled.claim(event.id, tx))) return
        const cleared = newCustomerDunning({ customerId: event.customerId, stage: "none" })   // domain: a fresh aggregate, version 1
        await dunnings.save(cleared, tx)                                                        // whole aggregate, its repository; an upsert
        await outbox.write(dunningStageChanged(cleared), tx)
    })

// billing/service/send-reminders.ts — the scheduled run lists through a query port, saves through the repository
const due = await dunningQueries.dueForReminder(asOf, tx)        // returns CustomerDunning aggregates
for (const d of due) await dunnings.save(raise(d), tx)           // not "loaded through it"
```
TX-23's Scope is "a repository saves an aggregate that was loaded through it". Neither save is in it. SVC-4
holds: whole aggregate, its repository. SVC-2 does not apply to `clearDunning`, which decides nothing by stored
state. TX-24 is a SHOULD. TX-5 holds: a repeat of the same message upserts the same values.

P10 fails. The reminder run raised the stage for a second unpaid invoice a moment earlier. The upsert writes
`none` over it, and its version restarts at 1. Shop's replica then holds a higher version and drops this `none`
as well (TX-32's ordering turned against itself). Wording: "A repository's save MUST fail where the aggregate
has changed in the store since the use case read it, by any port, and where an aggregate saved as new already
exists."

### tx-23-breach-failed-save-swallowed.md
```yaml
breaches: []
satisfies: [TX-23, TX-1, TX-6]
situation: shop's payment and its deadline arrive together (TX-23's own case)
finding: adversarial
```
# The save fails as TX-23 asks, and the use case commits `OrderPaid` anyway
```ts
// shop/service/ports/order-repository.ts
export interface OrderRepository {
    byId(id: string, tx: Transaction): Promise<Order | null>
    save(order: Order, tx: Transaction): Promise<"saved" | "stale">
}
// shop/adapters/drizzle/order-repository.ts — fails where the version moved
save: async (order, tx) =>
    (await asDrizzle(tx).update(orders).set(toRow(order))
        .where(and(eq(orders.id, order.id), eq(orders.version, order.version - 1))).returning()).length === 1 ? "saved" : "stale"

// shop/service/mark-order-paid.ts (inside transaction.run)
await orders.save(paid, tx)                        // "stale" ignored
await outbox.write(orderPaid(paid), tx)            // commits
```
TX-23 holds: the save fails and writes nothing where the order changed. TX-1 and TX-6 hold. The ruling that
the failure ends the use case ("A save that fails tells the second use case so, and its transaction rolls
back") is only in the Why.

P10 fails. `OrderPaid` commits on a read ("the order is placed") that no longer holds: the deadline's cancel
stands, `OrderPaid` and `OrderCancelled` are both out, and fulfillment ships an order it released. That is
TX-23's own scenario, restored by one ignored return value. Wording: "…MUST fail, and fail the use case's
transaction with it."

### tx-24-breach-credit-limit-read-through-query-port.md
```yaml
breaches: []
satisfies: [TX-24, SVC-2, TX-1]
situation: pay-by-invoice up to 500 € of open invoice orders per customer (variant of the fixture's pay-by-invoice)
finding: adversarial
```
# The decision is enforced in the acting call, on data the use case does not save
```ts
// shop/service/checkout.ts (inside transaction.run)
const open = await openInvoiceOrders.totalFor(customerId, tx)        // a query port over shop's orders
if (!mayPayByInvoice(open, cart.total)) throw new PayByInvoiceRefused(customerId)   // the domain decides, in the call that acts (SVC-2)
await orders.save(placeOrder(cart, customerId, "invoice"), tx)
await carts.save(clearCart(cart), tx)
await outbox.write(orderPlaced(order), tx)
```
Two tabs, one customer, 300 € open. Each checkout adds 150 €, each reads 300 €, both commit: 600 € open. SVC-2
holds. TX-24 is a SHOULD, and its Statement attaches no condition to deviating from it. That deviation is
allowed only "where it is a business rule across aggregates" appears only in the Why. TX-27 requires a business
rule to accept a replica's lag. Nothing requires one to accept this system's own data changing before the
commit.

P10 fails: "commits only on reads that still hold, or on stale ones a business rule accepts", and no business
rule accepted these. Wording: "…SHOULD belong to aggregates the use case saves; where it does not, the decision
MUST be one a business rule of its system accepts on data that changes before the commit."

### tx-25-breach-port-returns-a-function-of-a-transaction.md
```yaml
breaches: []
satisfies: [TX-25, TX-12, SYS-1]
situation: shop's order detail shows the invoice billing issued; billing is in-process
finding: adversarial
```
# The driving port takes no transaction; it returns a function that takes one
```ts
// billing/service/invoice-for-order.ts — a driving port of billing's open host service
export type InvoiceForOrder = (input: { orderId: string }) => (tx: Transaction) => Promise<InvoiceSummary | null>
export const createInvoiceForOrder = ({ invoices }: Deps): InvoiceForOrder =>
    ({ orderId }) => async (tx) => toSummary(await invoices.byOrderId(orderId, tx))     // runs in whatever the caller hands

// shop/service/mark-order-paid.ts — "read the invoice in the same snapshot as the order"
const invoice = await billing.invoiceForOrder({ orderId })(tx)          // shop's transaction, inside billing's repository
```
TX-25 says "MUST NOT take a transaction, nor anything else that reaches a store". The port takes an order id.
What it returns takes the transaction. TX-12 holds because the read goes through billing's open host service.
SYS-1 holds because the port type is on the offer.

P16 fails. Billing's read runs in shop's transaction, at shop's isolation, holding shop's locks, which is the
harm TX-25's Why names ("one transaction across two systems' data"). The port stops working once billing runs in
its own process. Wording: "MUST NOT take, return or hand to a callback a transaction, or anything that takes or
reaches one."

### tx-36-breach-hold-that-confirms-itself.md
```yaml
breaches: []
satisfies: [TX-36, TX-30]
situation: shop cancels a paid order and asks payment for the refund
finding: adversarial
```
# A "tentative" refund that executes unless cancelled, asked by a call inside shop's transaction
```ts
// payment/service/request-refund.ts — a hold: it executes after ten minutes unless cancelled (payment's rule, TX-30)
export const createRequestRefund = ({ transaction, refunds }: Deps): RequestRefund =>
    ({ orderId, amount }) => transaction.run((tx) => refunds.save(pendingRefund({ orderId, amount, executeAfterMinutes: 10 }), tx))

// shop/service/cancel-order.ts
await transaction.run(async (tx) => {
    const order = await orders.byId(orderId, tx)
    await orders.save(cancel(order), tx)
    await refundRequests.request({ orderId, amount: order.total })      // TX-36: a tentative operation, asked by a call
    await outbox.write(orderCancelled(order), tx)
})   // the save loses to markPaid's (TX-23): rolled back; the order stays paid and ships
```
The glossary says a tentative operation "holds what it asks for without giving it: its confirmation gives it,
its cancellation releases it". It does not say who confirms, or what happens when nothing does. Here a lapse
counts as confirmation. TX-36's MAY applies, and TX-3's Why carves the call out of TX-3's MUST. TX-30 holds
because payment's rule decides what happens: execute.

P8 fails: "what is asked … before the commit stays tentative, confirmed only after it". The refund goes out for
an order that stays paid and ships. Wording: glossary "…gives nothing unless the asker confirms it after its
own commit; left unconfirmed, it is released", or TX-36 "where what is asked is released, not given, when no
confirmation comes".

### tx-28-breach-pending-price-read-as-current.md
```yaml
breaches: []
satisfies: [TX-28, TX-30]
situation: variant of the sys-12 examples: shop copies the price at checkout; an editor's save calls shop's hook before Payload commits
finding: adversarial
```
# The hook records only a tentative operation; checkout prices by it
```ts
// shop/service/record-price-pending.ts — the use case the afterChange hook calls
export const createRecordPricePending = ({ transaction, pending }: Deps): RecordPricePending =>
    ({ productId, price, version }) => transaction.run((tx) => pending.save({ productId, price, version, status: "pending" }, tx))   // nothing more (TX-28)

// shop/service/checkout.ts — "freshest price wins"
const price = (await pending.latest(line.productId, tx))?.price ?? (await catalog.byId(line.productId))?.price
```
TX-28 holds: the hook's use case changes nothing beyond recording a tentative operation, and TX-30's rule
expires unconfirmed rows after ten minutes. No Statement says how other use cases may treat a recorded
tentative operation before its confirmation.

P8 fails: "nothing final follows from it before it commits". An order is placed at a price that Payload then
rolls back, because a later hook refused the save. Wording: TX-28 "…and no use case MAY decide by it before
its confirmation". The glossary's tentative operation is "a request to another system", which a pending record
of an external system's own change is not (N12).

### tx-30-breach-business-rule-keeps-waiting.md
```yaml
breaches: []
satisfies: [TX-30, DOM-7]
situation: Stripe stops resending a webhook after three days
finding: adversarial
```
# The business rule TX-30 asks for decides to keep waiting
```ts
// payment/domain/payment.ts
export const whenAnswerOverdue = (p: Payment, now: Date): Payment =>
    ({ ...p, answerDueBy: new Date(now.getTime() + 60 * 60_000).toISOString() })      // "the webhook will come; look again in an hour"

// payment/service/settle-overdue-payments.ts — a scheduled task applies it every five minutes, forever
for (const p of await payments.overdue(clock.now(), tx)) await payments.save(whenAnswerOverdue(p, clock.now()), tx)
```
TX-30's Statement is "A business rule of this system MUST decide what happens when the confirmation or answer
does not come". One does: a rule in the domain. "Each ends the waiting" is only in the Why.

P17 fails: "Work spanning systems ends". The webhook endpoint was down over a weekend and Stripe stopped
resending. The payment stays pending for weeks, shop's deadline cancels the order, and the card stays charged.
Wording: "…MUST decide, within a bound it states, a state that ends the waiting."

### tx-35-breach-business-rule-parks-the-event.md
```yaml
breaches: []
satisfies: [TX-35, DOM-7, DRV-7]
situation: a payment succeeds after shop's deadline cancelled the order
finding: adversarial
```
# The business rule, written in the domain, is "a human decides", and it throws
```ts
// shop/domain/order.ts
export const onPaymentSucceeded = (order: Order): Order => {
    if (order.status === "cancelled") throw new LatePaymentNeedsReview(order.id)     // business rule, written down: manual review
    return markPaid(order)
}
```
TX-35 says "A business rule of its system MUST decide what follows". One does, in the domain, written down. This
answers the Why's complaint that "Neither is written down as a choice". The throw fails the use case, and the
bus redelivers until it parks the event (TX-21). TX-38 does not apply, because a business rule stops it. TX-34
binds commands only.

P17 fails: "ends, and only in a state a business rule allows". "Parked until someone reads the dead-letter
queue" is no end, and the customer's card stays charged. Wording: "…MUST decide what follows, and the use case
MUST commit that decision as its outcome."

### tx-20-breach-relay-cursor-skips-late-commit.md
```yaml
breaches: []
satisfies: [TX-20, ASM-5]
situation: shop's outbox reader, handed to the relay by assembly
finding: adversarial
```
# The reader advances a cursor past a gap; the late commit is never read
```ts
// shop/adapters/drizzle/outbox-reader.ts — the reader shop provides
export const createShopOutboxReader = (db: NodePgDatabase): OutboxReader => {
    let cursor = 0
    return {
        next: async (limit) => {
            const rows = await db.select().from(shopOutbox).where(gt(shopOutbox.seq, cursor)).orderBy(shopOutbox.seq).limit(limit)
            cursor = rows.at(-1)?.seq ?? cursor
            return rows.map(toEnvelope)
        },
        markDelivered: async () => {},                    // the cursor is the mark
    }
}
```
Checkout A takes sequence value 41 and checkout B takes 42. B commits first. The relay reads 42 and moves past
41. A commits. Nothing ever reads 41. TX-20's Scope is "the relay reads a message from an outbox", so it never
binds message 41.

P8 fails: "nothing that follows from it is lost after". A's `OrderPlaced` is lost, fulfillment reserves nothing,
and the deadline's `OrderCancelled` tells fulfillment about an order it never heard of. Wording: "Every message
committed to an outbox MUST be handed to the bus at least once."

### tx-21-breach-poison-message-redelivered-forever.md
```yaml
breaches: []
satisfies: [TX-21, TX-38, DRV-7]
situation: fulfillment handles OrderPlaced and OrderCancelled per order, in order
finding: adversarial
```
# The bus redelivers until acknowledged, per key in order, with no attempt limit
```ts
// common/src/bus.ts — keeps every message in Postgres; "never lose a message"
export const createBus = ({ handlers, pool }: BusDeps): Bus => ({
    deliver: async () => {
        for (const key of await partitionsWithWork(pool)) {
            const head = await oldestUnacknowledged(pool, key)                       // per orderId, in order
            const handler = handlers[head.name]
            if (!handler) continue
            try { await handler(head); await acknowledge(pool, head.id) }
            catch { await retryLater(pool, head.id, Math.min(2 ** head.attempts, 3600)) }   // backs off; never parks
        }
    },
})
```
An `OrderPlaced` line holds a sku that a data fix left without a stock record. The domain's `reserve` throws on
an invariant, with no business rule involved, so TX-38 makes the use case fail. TX-21 holds: the bus keeps the
message and delivers it again, until it is acknowledged, which never happens. Every later message of that order
waits behind it, including its `OrderCancelled`. Nothing parks it where someone looks. Parking is only in the
Why.

P17 fails: the order's work never ends and nobody is told. With one partition per sku instead of per order,
other orders stall too. Wording: TX-21 "…until the handler acknowledges it or, after a bounded number of
attempts, it is parked where it stays until retried".

### tx-7-breach-field-meaning-changed-schema-unchanged.md
```yaml
breaches: []
satisfies: [TX-7, TX-32]
situation: billing's dunning stage; shop keeps a replica for pay-by-invoice and blocks accounts at collection
finding: adversarial
```
# `stage: "collection"` changes meaning; the schema does not change
```ts
// billing/published/messages.ts — identical before and after the deploy
export const dunningStageChangedSchema = z.object({
    id: z.string().uuid(), type: z.literal("DunningStageChanged"), customerId: z.string(),
    stage: z.enum(["none", "reminder", "second-reminder", "collection"]),
    version: z.number().int().positive(),
})
// before: "collection" = handed to the collection agency
// after:  "collection" = third reminder; the agency hand-over became a private step of billing's
```
TX-7's Scope is "the schema of a message changes, … or a new message or port takes over from another". Nothing
changed in the schema, so "each field keeping its meaning" never binds.
`tx-7-breach-amount-unit-changed-in-place.md` needed `int` → `number` to enter the Scope. With `z.number()` on
both sides it would have stayed outside.

P14 fails. Shop's code blocks the account of every customer at the third reminder, both on messages that waited
in the outbox from before the deploy and on new ones. Wording: Scope "the schema, or the meaning of a field, of
a message changes, …".

### tx-7-breach-old-process-saves-record-without-new-column.md
```yaml
breaches: []
satisfies: [TX-7, TX-23, SVC-4]
situation: rolling deploy: web on v42, worker still on v41; v42 added gift wrap to order lines
finding: adversarial
```
# The old process saves back a record the new code wrote, and drops what it does not know
```ts
// shop/adapters/drizzle/order-repository.ts — v41, still running in the worker
save: async (order, tx) => {
    const db = asDrizzle(tx)
    await db.update(orders).set(toOrderRow(order)).where(and(eq(orders.id, order.id), eq(orders.version, order.version - 1)))
    await db.delete(orderLines).where(eq(orderLines.orderId, order.id))
    await db.insert(orderLines).values(order.lines.map(toLineRow(order.id)))      // v41 knows no order_lines.gift_wrap
}
```
v42 web places an order with `gift_wrap = true`. The v41 worker marks it paid, deletes the lines and re-inserts
them, and `gift_wrap` takes the column default. TX-23 holds because the worker loaded after the web saved. SVC-4
holds. TX-7's Scope is messages and open host service ports called from another process. It does not cover
records, and no other rule covers a record's shape across a deploy.

P14 fails, as P14's own Why puts it: "An old process saves back a record the new code wrote and drops what it
does not know". Wording: TX-7 Scope "…the shape of a message, of a record, or of what an open host service's
driving port …".

### tx-12-breach-shop-reads-billing-outbox-rows.md
```yaml
breaches: []
satisfies: [TX-12, SYS-9]
situation: shop's order detail shows the invoice number billing issued
finding: adversarial
```
# "From its published events": shop reads them from billing's outbox table
```ts
// shop/adapters/drizzle/invoice-lookup.ts — implements shop's InvoiceLookup
import { invoiceIssuedSchema } from "@teeladen/billing"          // billing's published language, from its export path
export const createInvoiceLookup = (db: NodePgDatabase): InvoiceLookup => ({
    byOrderId: async (orderId) => {
        const { rows } = await db.execute(sql`select payload from billing_outbox
            where type = 'InvoiceIssued' and payload->>'orderId' = ${orderId} order by seq desc limit 1`)
        return rows[0] ? toInvoiceSummary(invoiceIssuedSchema.parse(rows[0].payload)) : null
    },
})
```
TX-12 says "MUST read it from the owner's open host service or from its published events". These are
`InvoiceIssued` events, parsed with billing's published language. SYS-9 holds because the import comes from the
export path.

P11 fails: "or reads them except through its published language". The outbox table is billing's storage. When
billing prunes delivered rows after a day, or moves its outbox into a field on the invoice as TX-6's Why allows,
shop's lookup returns `null` for every older order. Billing's rule for the current invoice of a corrected order
is never asked. Wording: "…or from its published events as the bus delivers them to this system's handlers".

**SYS family**

### sys-13-breach-command-published-as-event.md
```yaml
breaches: []
satisfies: [SYS-13, TX-33, TX-17, SYS-2]
situation: shop places the order; fulfillment reserves the stock on it
finding: adversarial
```
# A command in disguise: shop publishes `OrderReadyForReservation`
```ts
// shop/published/messages.ts — an event: something happened in shop
export const orderReadyForReservationSchema = z.object({
    id: z.string().uuid(), type: z.literal("OrderReadyForReservation"), orderId: z.string(),
    lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
    reserveUntil: z.string().datetime(),            // fulfillment's hold period, worked out in shop's domain
    location: z.enum(["main", "overflow"]),          // which of fulfillment's stock locations, chosen by shop
})
// shop/service/place-order.ts:        await outbox.write(orderReadyForReservation(order), tx)
// fulfillment/driving/handlers.ts:    OrderReadyForReservation: (m) => reserveStock({ orderId: m.orderId, lines: m.lines, until: m.reserveUntil, at: m.location })
```
SYS-13's Scope is "a system sends a command", and this message is published as an event. Its name says
something happened, and no receiver refuses it. SYS-13 and TX-33 are silent. TX-17 holds because no system is
named. SYS-2 holds.

P3 fails: fulfillment's reservation rules (hold period, location) change in shop's domain and in shop's
published language. P2 fails too: fulfillment's business rule is stated in shop. This is the "passive-aggressive
command" that SYS-13's own Provenance cites. Wording: SYS-13 Scope "a system writes a message that names what
another system is to do, or carries a value only the receiver's business rules decide".

### sys-2-breach-published-type-picked-from-domain-type.md
```yaml
breaches: []
satisfies: [SYS-2, SYS-10]
situation: shop publishes OrderPaid; billing issues the invoice from it
finding: adversarial
```
# The published module picks its type from the domain's, by `import type`
```ts
// shop/published/messages.ts
import { z } from "zod"
import { moneySchema } from "@teeladen/kernel"
import type { Order } from "../domain/order"            // erased: loading this module reaches nothing of the domain

export type OrderPaid = { type: "OrderPaid"; messageId: string } & Pick<Order, "id" | "customerId" | "total" | "paidAt">
export const orderPaidSchema: z.ZodType<OrderPaid> = z.object({
    type: z.literal("OrderPaid"), messageId: z.string().uuid(),
    id: z.string(), customerId: z.string(), total: moneySchema, paidAt: z.string().datetime(),
})
```
SYS-2 says "MUST NOT reach the domain, nor be generated from it". Reach is runtime, the import is erased, and
nothing is generated. SYS-10 holds. The Why names "picks from them" as the breach, but only the Why does.

P13 fails. Shop renames `Order.total` to `grandTotal` for a pricing rule. `OrderPaid` changes with it, the
schema stops satisfying its annotation, and the fix that compiles renames the published field. The contract
moves with the model. Wording: "The modules that declare it MUST NOT import from the domain, types included,
nor be generated from it."

### sys-12-breach-editors-create-and-delete.md
```yaml
breaches: []
satisfies: [SYS-12]
situation: variant of the sys-12 examples: shop's business rules decide the price, kept on Payload's products document
finding: adversarial
```
# Update is refused; create, duplicate and delete stay Payload's defaults
```ts
// catalog/collections/products.ts — catalog's config
{
    name: "price", type: "number",
    access: { update: () => false },           // Payload's own ways in do not change shop's price (SYS-12)
}
// access.create: default — the REST API and the admin's "Duplicate" create a product with whatever price is sent
// collection access.delete: default — an editor deleting the product deletes shop's price with it
```
SYS-12 says "The external system's own ways in MUST NOT change it". A record that does not exist yet is no
"it", and a deleted one is arguably not "changed".

P11 fails: "No other system changes the records a system owns". Catalog's ways in create shop's price records
by catalog's rules (above zero), and shop's margin rule never runs. No message tells shop of the new product's
price, or of a deleted price it still quotes in carts. Wording: "…MUST NOT create, change or delete it."

**TST family**

### tst-6-breach-real-run-flag-never-set.md
```yaml
breaches: []
satisfies: [TST-6, TST-8, TST-12]
situation: payment's PaymentGateway driven port has a fake and a real adapter against Stripe's test mode
finding: adversarial
```
# One contract suite, against both, behind a flag nothing sets
```ts
// payment/test/contracts/payment-gateway.contract.test.ts
const implementations = [
    { name: "fake", open: openFakeGateway },
    ...(process.env.TEELADEN_STRIPE_E2E === "1" ? [{ name: "stripe test mode", open: openStripeGateway }] : []),
]
describe.each(implementations)("PaymentGateway: $name", ({ open }) => paymentGatewayContract(open))
// CI runs the default suite. The Stripe run is an end-to-end test, which TST-12 says not to run automatically.
```
TST-6 holds: one suite, written against the port, run against both whenever anyone sets the flag. TST-8 holds
because the choice is a flag. TST-12 holds. No Statement says when, or how often, the real run happens. TST-6's
Why places it "outside" the default suite, and TST-12 keeps it off automation.

P6 fails: "What stands in for the outside behaves as the outside does … or a passing test proves nothing" (P6's
Why, see Why findings). The fake keeps a field Stripe renamed two API versions ago for months. Wording: TST-6
"…run against both: against the fake in the default suite, against the real adapter at least before each
release".

## Rules that held

- **DOM-3.** Tried a driving adapter calling `addressSchema.extend({ postalCode: z.string() })`, and a hand-written `type Order` beside the schema with `satisfies`. Both state the shape a second time, and "stated once" refuses them.
- **SVC-2.** Tried a check in the driving adapter before the acting call. "The service that acts MUST enforce the decision itself, in the call that acts" refuses it. The data-by-query-port variant is a TX-24 finding. `svc-2-breach-loaded-order-passed-through-port.md` is still open (Why findings W1).
- **SVC-3.** Tried a service calling its system's own handler function, which calls the other service. SVC-6's list has no driving adapter and refuses it. The existing behind-a-port example is still open (W4).
- **SVC-4.** Tried `OrderStatusRepository.markPaid`, and an Order repository whose save also clears the Cart. "Not by writing a part … through the repository or past it" and "the aggregate's repository" refuse them. `svc-4-breach-second-repository-patches-order-status.md` is resolved by the current wording.
- **SVC-6.** Tried the service importing the `stripe` package as "the published language of an external system it conforms to" and calling it. SVC-7 refuses the call. The type-only gap is W2.
- **DRV-1.** Tried a retry loop around the acting call, which makes several acting calls. Tried an "answering" call that bumps `lastSeenAt`, which is acting by the glossary. Both are refused. A composite `execute([...])` call is the existing callback finding.
- **DRV-3.** Tried a Payload hook importing the service module or assembly. It does not read from a courier, so it is refused.
- **DRV-6.** Tried memoizing on the first run. "Each time it runs" refuses it (the existing memoize example is resolved). Capturing `courier.read` as a function at load and calling it per run reads each time and is harmless.
- **ASM-1.** Tried the preloaded `otel.ts`. It builds no port implementation, so it is no assembly. `asm-1-breach-one-assembly-run-twice.md` is still open (W5).
- **ASM-4.** Tried a driven adapter reading the courier. It is refused. A service reading a registry that is not "the courier" falls outside ASM-4's Scope, since the courier is defined by purpose, but ASM-3 refuses it where the located instance changes how the use case acts. ASM-4's Why claims otherwise (W26).
- **ASM-7.** Tried a ready-made common-library audit writer called with no port. TX-1 refuses it ("hand it to each call into its store"). Tried a ready-made Slack alert. TX-22 refuses it (a change outside the transaction, so an outbox). Tried a feature-flag client. Its output changes how the use case acts, so it is outside the Scope.
- **ASM-8.** Tried a route that fills the courier on a cold start. It is refused. `asm-8-breach-courier-filled-with-lazy-factory.md` is still open (W8).
- **ASM-10.** Tried a clock imported as "the same in every test". SVC-7's MUST (the outside through a port) wins over a SHOULD. Tried VAT rates imported from the common library. ASM-6 refuses that.
- **TX-1.** Tried a claim port that takes no transaction and autocommits, called before `run`. The use case does not run "in one transaction" and the claim is a call into its store not handed the transaction, so it is refused. That also closes TX-2's "is handed" Scope for this case.
- **TX-15, TX-29, TX-31.** SHOULDs. Deviations are allowed and the properties hold. For TX-31, a reconciliation's second message is no repeated delivery, so P9 is untouched.
- **TX-3.** Tried shop writing a private message that its own handler turns into an update of billing's invoices. The handler's use case is in TX-3's Scope again and must use a message, so it is refused at the second hop. Tried shop's handler refunding at Stripe directly. Payment's rules decide whether a refund exists, so payment owns the Stripe refund ("wherever it is kept"). Refused the same way.
- **TX-22.** Tried a use case that makes the change and also writes the message "for retry". "And not make the change itself" refuses it.
- **TX-37.** Tried a handler deciding *what* from current state, not *whether*. Its harm is the deciding system's, through TX-35.
- **TX-6.** Tried an outbox port with its own transaction. The message is not written "in the transaction that commits the change", so it is refused.
- **TX-5.** Tried an upsert redelivered after a later change, which restores the old value. Under the glossary it is idempotent ("as performing it once left them"), but TX-19 refuses it, since arrival order changes the result. See R6.
- **TX-19.** Tried throwing on an early cancel until `OrderPlaced` arrives. The result is eventually the same. Where it never arrives, that is the TX-21 finding.
- **TX-32.** Tried a timestamp as version and a process-local counter. "Rising with each change" refuses each where it does not rise.
- **TX-17.** Tried a routing key `fulfillment-reservations` in the outbox write. Read broadly, it names the handling system. See N17 on which property TX-17 serves.
- **TX-33.** Tried billing subscribing to `Payment*` by wildcard. That is still a handler subscribed to a published command, so it is refused.
- **TX-39.** Tried relabelling a private message as published. It is no longer private, and it becomes an event others may handle.
- **TX-34.** Tried a generic `CommandRefused { commandId }`. It is in its own published language and names no sender, so it is ok and harmless. A refusal in the sender's published language is refused.
- **TX-38.** Tried catching a store error and returning. "MUST fail" refuses it. Endless redelivery is the TX-21 finding.
- **TX-26.** Tried the owner's own handler writing the keeper's replica table from its events. TX-3 refuses it, because the owner changes the keeper's records.
- **TX-27.** Tried a business rule that accepts any lag. P10 admits it ("stale ones a business rule accepts").
- **TX-12 (query-port variant).** `tx-12-breach-query-port-on-billing-open-host-service.md`'s `findInvoices(where: SQL)` is no driving port under the glossary ("in the system's terms, not its store's"), so it is no open host service, and TX-12 refuses it. Resolved.
- **SYS-1.** Tried a wildcard `exports` entry. It exports what is not the offer, so it is refused. `sys-1-breach-builder-returns-repositories.md` is still open (W14).
- **SYS-15.** Tried `await import("@teeladen/billing/testing")` in assembly behind a staging flag. It is an import, so it is refused.
- **SYS-9.** Tried shop putting its repository on `globalThis` for billing to read, and raw SQL against another system's tables. Reach ("however the code got hold of it") refuses both.
- **SYS-10.** Tried a published-language path importing another system's domain (SYS-14 refuses it) and a value re-export of a service (refused).
- **SYS-14.** Tried `Money` importing the common logger (the existing example), which is refused. A kernel holding one system's rules is the DOM-7 finding. Kernel module state is the DOM-1 finding.
- **TST-3, TST-10, TST-7, TST-11, TST-12.** SHOULDs. Nothing to breach.
- **TST-4.** The sandbox "fake" (`tst-4-breach-fake-mailer-calls-sandbox.md`) is no fake under the glossary ("reaches nothing outside the process"). Resolved.
- **TST-5.** Tried tables pushed from the adapter's own definitions and a differently configured client. "Set up the way production sets it up" refuses both.
- **TST-8.** Tried a comment toggle. It is an edit, so it is refused.

## Why findings

### Breaches only the Why refuses

- **W1. SVC-2.** The Why says "the acting service loads the data in the transaction that writes". The Statement says neither "loads" nor "in the transaction". `svc-2-breach-loaded-order-passed-through-port.md` is still open. Its Scope ("decides by what this system has stored") arguably excludes a use case that decides by an Order it was handed. `svc-2-ok-cancel-order-decides-itself.md` itself loads outside `transactions.run` (N7).
- **W2. SVC-6.** The Why says "A store client's type in a port's signature is the store's name in the service, one step removed." The Statement is a reach list, and a type-only import reaches nothing. `svc-6-breach-drizzle-transaction-in-port.md`'s port file (`import type { NodePgDatabase }`) is refused only if "reach" is read as "import" (N1). The service's `db.transaction` call is refused by SVC-7.
- **W3. SVC-7.** The Why says "a port of the system is declared in its service layer (SVC-1), in the system's [terms]". No Statement requires the system's terms of a driven port (`svc-7-breach-driven-port-in-sql-terms.md`).
- **W4. SVC-3.** The Why's harm (a second transaction with no rollback) is unchanged when the other service sits behind a driven port. `svc-3-breach-clear-cart-service-behind-driven-port.md` is still open. The Statement says "call that service", and Reach's "however the code got hold of it" covers reach, not "call".
- **W5. ASM-1.** The Why says "two instances of what exists once". `asm-1-breach-one-assembly-run-twice.md` is still open: one assembly, run twice.
- **W6. ASM-3.** The Why says "the user an audit column records arrive as arguments". The Statement binds only acting and answering (`asm-3-breach-audit-column-from-ambient-user.md`).
- **W7. ASM-5.** The Why says "a relay that lists the outbox tables by name". The Statement admits it through a handed pool (`asm-5-breach-relay-finds-outbox-tables-through-handed-pool.md`).
- **W8. ASM-8.** The Why says "filled by anything but assembly, a second place produces instances". `asm-8-breach-courier-filled-with-lazy-factory.md` is still open: assembly fills it, with factories.
- **W9. ASM-9.** The Why's harm (the transaction becomes billing's) arrives through an ambient connection (`asm-9-breach-ambient-request-connection.md`).
- **W10. DRV-7.** The Why says "one that writes succeeds when it has committed". The Statement does not define "succeeded" (`drv-7-breach-use-case-commits-after-returning.md`).
- **W11. TX-23.** The Why says "its transaction rolls back with nothing of it committed" (`tx-23-breach-failed-save-swallowed.md`).
- **W12. TX-24.** The Why says "Where the decision cannot sit in the aggregates one use case saves, it is a business rule across aggregates". The SHOULD's deviation is unconditioned (`tx-24-breach-credit-limit-read-through-query-port.md`).
- **W13. TX-30.** The Why says "Each ends the waiting." The Statement only asks that a rule decide (`tx-30-breach-business-rule-keeps-waiting.md`).
- **W14. SYS-1.** The Why says "a downstream that imports one couples to the inside". `sys-1-breach-builder-returns-repositories.md` is still open, since nothing bounds what a builder returns.
- **W15. SYS-2.** The Why says "picks from them". A type-level `Pick` reaches nothing (`sys-2-breach-published-type-picked-from-domain-type.md`).
- **W16. TX-7.** The Why lists "a meaning changed, an amount from cents to euros" as breaking. The Scope opens only on a schema change (`tx-7-breach-field-meaning-changed-schema-unchanged.md`).
- **W17. TX-21.** The Why says "after several parks the message in a dead-letter queue". The Statement has no bound (`tx-21-breach-poison-message-redelivered-forever.md`). Conversely, the Statement ("deliver it again, until the handler acknowledges it") arguably refuses the parking the Why permits, since a parked message is not delivered again until someone acts.
- **W18. DOM-4.** `dom-4-breach-order-line-copies-whole-product-document.md` is now refused, not by DOM-4 but by the glossary's Snapshot ("projected into this system's terms"). All three dom-4 examples are outside DOM-4's Scope anyway (N8).

### Whys that rule

- **W19. DOM-1.** "The list is closed: a reach of a kind it does not name is a question for this rule, not a permission." An interpretive ruling.
- **W20. DOM-3.** "The published language's schemas … fall outside the Scope" is a Scope ruling. A message waiting in an outbox is a record ("What a store holds"), so its schema shapes a record.
- **W21. DOM-7.** "A key the keeper enforces, a unique index, a unique field, is no second statement" grants an exemption the Statement ("stated once") refuses. "About a record this system's business rules decide, it is a second statement" is a ruling. "Catalog's veto of a sku change, stays here" is a ruling that contradicts `tx-28-ok-before-change-hook-vetoes-sku-change.md` ("The rule is catalog's, in its config") (N10).
- **W22. SVC-1 and SVC-6.** "A conformist declares no port for its upstream" is a ruling. `asm-2-ok-shop-reads-invoice-through-driven-port.md` and `tx-12-ok-invoice-number-through-billing-port.md` both declare one (`Invoices`, `InvoiceLookup`), typed by billing's export path.
- **W23. DRV-1.** "It is a question to a service that answers, and the answer becomes an argument". "One asked whether to act is a guard … lets nothing through that the acting service would refuse". "A bus that delivers several messages at once gets one call per message". Three rulings. The second carries a condition no Statement states.
- **W24. DRV-3.** "Where the framework offers a factory seam, assembly constructs the adapter." A ruling. ASM-4 is what refuses a constructible adapter reading the courier.
- **W25. ASM-3.** "A value the handler needs from the request … reaches it in the message, or by a query the message points to, or not at all." A ruling.
- **W26. ASM-4.** "Code that is no factory, a service function, passes every other rule". This is a factual claim that ASM-3 contradicts: a courier read by a service is a per-process ambient value.
- **W27. ASM-8.** "A system builder filling it is assembly filling it." **ASM-10.** "Nothing a test swaps falls under this rule." Both are Scope rulings.
- **W28. TX-3 and TX-22.** "Asking for a tentative operation is TX-36's" (TX-3) and "A request designed as a tentative operation is the way around" (TX-22) are exemptions from MUSTs. Only the Whys carry them, and TX-36 is a MAY, which cannot lift a MUST. `tx-22-ok-payment-requests-checkout-session.md` decides a change its transaction does not commit (a Stripe Checkout Session) and makes it by a call, which TX-22's Statement refuses. `tx-3-ok-…` holds only because payment stores nothing.
- **W29. TX-15.** "A use case relies on a write when its goal … is not reached without it". The Statement's key term is defined in the Why.
- **W30. TX-19.** "The use case keeps the higher and drops the lower" and "Between two publishers, which message wins is the domain's decision". Rulings.
- **W31. SYS-12.** "A record whose changes have to come through the external system's ways in is the external system's to own" reassigns ownership in a Why.
- **W32. SYS-13.** "A sender that conforms writes it from its service; one with an anti-corruption layer hands its own terms to a driven port, whose adapter writes the receiver's command to the outbox". A ruling on where.
- **W33. TST-4.** "A test that proves the transaction itself … needs the real store." **TST-6.** "The run against the fake is in the default suite, the run against the real adapter outside it." Rulings.

### Property Whys refusing what heading, Except and Against admit

- **W34. P6.** The heading is "can run with nothing outside the process, in a test". The Why adds "What stands in for the outside behaves as the outside does wherever the use case can tell, or a passing test proves nothing", a fidelity requirement the heading does not state. A test against an unfaithful fake satisfies the heading.
- **W35. P9.** The heading speaks of records of this system ("changes no record of this system"). The Why adds "Where an effect outside can repeat, a business rule allows the repeat". The heading admits a repeated mail with no business rule. The ruling is only in the Why, and Against includes F9.
- **W36. P5.** The Why says "A port the system finds for itself, read from a registry, is in no signature." That refuses the courier, a registry that framework-built driving adapters read, which the heading ("ports assembly hands it") admits as assembly's way of handing.
- **W37. P10.** The Why says "A stale read is one a business rule accepts, with what happens meanwhile". The phrase "with what happens meanwhile" adds a condition to the heading's "stale ones a business rule accepts".

## Relies-on findings

1. **R1.** SVC-2 → DRV-8: "a driving adapter reaches no driven port, driven adapter or service of its system". SVC-4 → DRV-8: "a driving adapter reaches a driving port of its system, and no repository". DRV-8 guarantees a list ("what calls it, a driving port of its system, …, the common library, pure code of no system"). Under Reach ("however the code got hold of it"), calling a driving port reaches the service behind it, and the service's repositories, so "reaches no service" and "no repository" are negatives DRV-8 does not give. "What calls it" and "the common library" are also open doors (`drv-8-breach-handler-publishes-through-bus-context.md`).
2. **R2.** SVC-2 → SYS-1: "a system exports no service, driven port or adapter to other code". SYS-1 guarantees "Everything it exports MUST be of its offer", and the offer includes "its system builders", which return services and, unbounded, repositories (W14). The line claims the substance; SYS-1 gives the form.
3. **R3.** SVC-2 → TX-24: "by default, the data a decision has to hold … belongs to aggregates the use case saves". TX-24 is a SHOULD with an unconditioned deviation. SVC-2's Why states "where what it loaded changes before the commit, its save fails" as given. That holds only where TX-24 was followed. The "by default" in the line is not carried into the Why.
4. **R4.** TX-1 → DRV-1: "a driving adapter makes at most one acting call per call it handles, a message included". DRV-1 guarantees "a driving adapter handles one call from its caller → at most one acting call", which is per call, not per message. A batch delivery is one call carrying many messages, and DRV-1 lets one acting call cover it. TX-1's Why ("each message gets a transaction of its own") needs per-message. Only DRV-1's Why argues the batch case.
5. **R5.** TX-15, TX-3, TX-22 → TX-20: "the relay hands each message it reads from an outbox to the bus at least once". The line is faithful. But the relying Whys ("redelivery retries it until it lands", "retried alone") need every committed message read, and TX-20 binds only what is read (`tx-20-breach-relay-cursor-skips-late-commit.md`).
6. **R6.** TX-15, TX-3, TX-37, TX-20, TX-21 → TX-5: "a repeated delivery changes nothing". TX-5 guarantees "a use case called for a delivered message MUST be idempotent". (a) TX-5 binds the use case, not the delivery: what a handler does around the use case is not covered. (b) The glossary's Idempotent is "leaves the records as performing it once left them, and answers as the first did", not "changes nothing". A repeat that arrives after an intervening change restores the earlier state and is still idempotent by that definition. "Changes nothing" is P9's heading, which TX-5 does not reach.
7. **R7.** TX-37 → TX-31: "by default, a use case called for a message passes the external system a key the message carries…". TX-31's Scope is "changes something in an external system *that takes an idempotency key*", and the line drops that qualifier. TX-37's Why ("The call reaches idempotence through the owner's idempotency key (TX-31)") states a SHOULD as given, for every external system, including the fixture's 3PL that `tx-22-breach-claim-rolled-back-after-3pl-call.md` says "has no idempotency key".
8. **R8.** TX-36 → TX-30: "a business rule of this system decides what happens when a confirmation or an answer does not come". TX-30's Scope is "this system holds a tentative operation, or waits on another system's answer". The asker in TX-36 may hold and wait on nothing: `tx-22-ok-payment-requests-checkout-session.md` "stores nothing". TX-30 then never binds it, and the hold lapses by the other system's rule (Stripe's expiry), which is no rule of this system.
9. **R9.** SYS-2 → SVC-6: "what the service layer reaches includes its system's domain and its published language". SVC-6 guarantees "What it reaches MUST be one of: …", a restriction. "Includes" claims the positive of a negative rule.
10. **R10.** SYS-15 → SYS-1 and TST-11 → SYS-1: "an export path may hold a fake of the system's open host service's driving ports". SYS-1 is a restriction ("MUST be of its offer"). "May hold" is the positive read off it. This is harmless, but it is the same pattern as R9.
11. **R11.** TST-6 → TST-4: "a service's test hands it fakes for its driven ports". TST-4 is a SHOULD. The line states it as given, without "by default", unlike SVC-4's line to TST-4.
12. **R12.** TST-11 → TST-6: "one contract suite is written against the port and run against the fake and the real adapter". TST-6's Scope is "a driven port has a fake and a real adapter". TST-11's port is an upstream's *driving* port, whose fake the upstream exports. TST-6 does not bind the upstream for its own driving port, so the line names a wider thing. TST-8 → TST-6 also drops "asserting each behavior of the fake a service's test relies on".
13. **R13.** TST-3 and TST-10 → DOM-1: "the domain reaches nothing but a shared kernel, the published language of an upstream its system conforms to and pure code of no system". The line is faithful, but both Whys conclude "The domain is pure". DOM-1 bounds what the domain reaches past itself, not its own module state (`dom-1-breach-discount-campaign-held-in-domain-module.md`), and not its types (N1).
14. **R14.** SVC-6 → ASM-2: "a factory receives port implementations, store clients and other clients … from its caller". ASM-2's Scope is "a factory *needs* …", and the line drops the qualifier. ASM-2 also binds the factory, not the service function it returns (`asm-2-breach-adapter-method-reads-env.md`), so the line does not cover the service code SVC-6 is about.
15. **R15.** TX-34 → TX-38: "a use case called for a message that is stopped by no business rule … fails and commits nothing". TX-38's Scope is "a delivered message cannot complete, and what stops it is no business rule". This is close enough; noted for "delivered".
16. **R16.** ASM-7 → ASM-2 and ASM-7 → SVC-7: both lines quote MUSTs that ASM-7's MAY contradicts ("instead of receiving one", "through no port"). Neither named rule carves out ASM-7, and the documents state no precedence between a MAY and a MUST.
17. **R17.** Lines that the relying rule never uses: SVC-1 → SYS-10, since SVC-1's Why argues nothing about loading. SVC-4 → TX-3, since SVC-4's Why does not mention another system's data.
18. **R18.** Leans without a line:
    - TX-1's Provenance says "by ASM-9", with no ASM-9 line.
    - SVC-7's Why leans on SVC-1 for "in the system's [terms]", which SVC-1 does not give (W3).
    - SVC-6, DRV-8, DVN-4 and ASM-7 Whys lean on ASM-6 ("holds no model (ASM-6)") without lines.
    - TX-3 and TX-22 Whys lean on TX-36 for their carve-out (W28). The line runs the other way.
    - TX-23's Why ("A handler's use case runs again on redelivery") leans on TX-21 and DRV-7.
    - TX-24's Why leans on TX-27, and TX-12's Why on TX-26 (how a replica is filled).
    - TX-30's Why ("the delivery rules reach no message the other system stopped sending") leans on TX-21.
    - DRV-7's Statement covers hooks, where redelivery is the external system's (F9). No rule can give a line, and the Why's guarantee holds only for the bus.

## Notes

1. **N1. Reach and types.** I read Reach as runtime: "what running it reads or calls". `import type` is erased, so it reaches nothing. Every reach list (DOM-1, SVC-6, DRV-8, DVN-4, SYS-14, SYS-2's "reach the domain") is blind to types. Several existing breach examples (`dom-1-breach-order-type-from-drizzle-table`, `svc-6-breach-drizzle-transaction-in-port`) hold only if "reach" is read as "import". I also read "however the code got hold of it" as covering globals, closures and couriers. Whether calling a port reaches what implements it is unsettled, and R1 and W4 depend on it.
2. **N2. Undefined words.** Undefined: "schema" (DOM-3, ASM-6: a runtime validator or any type?), "configuration value" (ASM-2, ASM-10), "succeeded" (DRV-7, TX-38), "relies on" (TX-15, defined in its Why), "store's terms" (glossary Port), "open order" (domain.md, used by tx-28-ok's adapter query). In the-world.md, "carrier" (P1, P5 Whys) and "registry" (P5 Why) are not glossary terms, though the-world says it uses glossary terms only.
3. **N3. Pure versus examples.** Under the glossary's Pure, a module "hands its caller nothing the caller did not pass", so `crypto.randomUUID()` and `new Date()` are impure, and DOM-1 refuses them in the domain. `dom-1-breach-order-id-from-node-crypto.md` suggests `globalThis.crypto` as the fix. `tx-17-ok-fulfillment-subscribes-to-order-placed.md` (`shop/domain/messages/order-placed.ts`) and `tx-22-ok-order-confirmation-mail-through-outbox.md` (`shop/domain/messages/send-order-confirmation.ts`) call `randomUUID()` in shop's domain, which breaches DOM-1 as written.
4. **N4. Driven ports.** The glossary requires the system's terms only of a driving port. A driven port is "a way out of the system". P5's heading, "each port speaks the system's terms", is delivered by no Statement (SVC-7 finding).
5. **N5. Idempotent versus P9.** The glossary's Idempotent ("as performing it once left them") is weaker than P9's "changes no record of this system". See R6.
6. **N6. Tentative operation.** The glossary does not say who confirms, or whether a lapse may give what was asked (TX-36 finding). TX-28's Why calls "a pending record … of the external system's change" a tentative operation, but the glossary's is "a request to another system for a commitment". The two senses differ (N12).
7. **N7. Ok examples read outside the transaction.** These read outside the transaction of a writing use case, which TX-1's Statement refuses ("hand it to each call into its store"): `svc-2-ok-cancel-order-decides-itself.md`, `svc-3-ok-place-order-writes-cart-itself.md`, `svc-4-ok-mark-paid-through-repository.md`, `asm-3-ok-hook-passes-editor.md`, `tx-30-ok-payment-asks-stripe-at-deadline.md` (`payments.overdue(clock.now())` outside the transaction), and `tx-3-ok-…`. TX-23 catches the stale save, but TX-1's wording does not allow these reads.
8. **N8. DOM-4's Scope.** The Scope is "another aggregate of the same system". `dom-4-breach-order-line-embeds-product.md`, `dom-4-breach-order-line-copies-whole-product-document.md` (catalog's Product) and the `paymentId` in `dom-4-ok-order-line-copies-price.md` (payment's Payment) are all about other systems' aggregates, outside the Scope.
9. **N9.** `asm-2-ok-shop-reads-invoice-through-driven-port.md` comments "driven port, in the domain" on `packages/shop/service/ports/invoices.ts`. The path is the service layer and the comment contradicts it.
10. **N10. Sku veto.** The fixture sentence I hung on: "catalog's `beforeChange` asks shop how many open orders carry a sku, and refuses to change a sku one does." DOM-7's Why makes the veto shop's rule ("stays here"). `tx-28-ok-before-change-hook-vetoes-sku-change.md` makes it catalog's ("No rule of shop's decides the sku"). The same example's adapter `openOrders.countWithSku` states what "open" means in SQL, a second statement of a business rule under DOM-7 if "open" is one.
11. **N11. TX-22 and telemetry.** TX-22's Scope ("decides a change that the transaction it runs in does not commit, of something no other system of this codebase owns") literally covers a log line or span a use case emits. Read so, `asm-7-ok-logger-and-tracer-imported-ready-made.md` breaches TX-22. I read "decides" as excluding telemetry. No text says so.
12. **N12. Recording a tentative operation.** TX-28 says "recording a tentative operation", but the use case the hook calls records a request of its own. The glossary's tentative operation is another system's commitment. I read TX-28 as "recording that a change is pending".
13. **N13. TX-28's "this system".** `tx-28-breach-after-change-hook-revalidates-page.md` treats revalidating the Next.js page cache as a change to "this system". If the cache is the outside, TX-28's Statement does not refuse it, and TX-22 does.
14. **N14. Gap examples.** `gap-admin-dashboard-belongs-to-no-system.md` and `gap-health-and-metrics-endpoints.md` cite retired ids (SYS-3, SYS-5, SYS-7, TX-13, ARR-1). They also quote SYS-9's old Scope ("code of one system"). The current Scope, "code outside a system reaches it", does cover the dashboard.
15. **N15. "The domain".** DOM-3 and DOM-7 say "the domain" unqualified. I read it as the domain of the system whose rule it is, with a shared kernel counting as in each importer's domain (glossary: "importing it into its domain"). That reading drives the DOM-7 kernel finding.
16. **N16. Fixture sentences used.** "Request id and trace context should cross system boundaries; the transaction must not" (ASM-9 and ASM-3 baggage findings). "Stripe stops resending a webhook after three days" (DRV-7, TX-30). "`OrderPaid` or `OrderCancelled` can arrive before `OrderPlaced`" (TX-21). "Scheduled dunning runs over unpaid invoices; a customer's dunning stage rises with each reminder and clears once they pay" (TX-23, TX-7). "Checkout also offers pay-by-invoice … Not to a customer billing has put into dunning" (TX-24 variant, TX-7).
17. **N17. TX-17's property.** TX-17's harm ("a publisher that names its handlers changes whenever a system starts or stops listening") maps onto no property heading. P13 is about the upstream changing its model, and P3 is about business rules. The closest is P3.
18. **N18. Scopes that rest on intent.** "a driving adapter assembly cannot construct" (DRV-3, ASM-4) and "whose output changes neither how a use case acts nor what it answers" (ASM-7) are judged by intent, and no linter can hold them.
19. **N19. Examples lines.** Most rules have `—` under Examples, while the examples directory holds examples for them (DOM-1, DOM-3, DOM-4, SVC-1 to SVC-6, DRV-1 to DRV-8, ASM-*, TX-1, TX-2, TX-5 to TX-7, TX-12, TX-15, TX-17, TX-19, TST-*). By the README's rule shape these rules read as "unfinished".
