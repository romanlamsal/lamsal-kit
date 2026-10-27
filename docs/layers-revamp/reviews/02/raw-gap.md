# Gap review, raw set

## Summary

- `gap-vat-rate-in-billing-service.md`: billing's VAT rule (7% tea, 19% accessories) is written in a service, and no rule's Scope says where a business rule that is no record shape and no decision by stored state lives.
- `gap-checkout-decides-by-billings-live-dunning-stage.md`: checkout refuses pay-by-invoice by billing's dunning stage read live through billing's open host service; the lag rules hold only for this system's stored data (SVC-2, TX-24) or a replica (TX-27).
- `gap-order-line-copies-catalog-price.md`: the order line copies catalog's price, sku and tax class; DOM-4 holds only between aggregates of the same system, and the copy is neither a glossary snapshot nor a replica.
- `gap-payload-admin-reads-fulfillment-stock-table.md`: catalog's config, code this codebase writes, reads fulfillment's stock table past its ports; no Scope holds for an external system's configuration reading a system's records.
- `gap-admin-dashboard-in-no-system.md`: the admin dashboard sits in no system and joins three systems' tables with the common pool; every Scope that would rule the join needs a system, a service or a driving adapter.
- `gap-health-probe-builds-own-pool.md`: `/health` builds its own store client at module load; probes sit outside the layers, and ASM-4 leaves them no way to the client assembly built.
- `gap-instrumentation-built-before-assembly.md`: auto-instrumentation builds and configures the tracer provider from the environment before assembly runs; no Scope reaches where telemetry is built.

## Findings

### gap-vat-rate-in-billing-service.md

```yaml
breaches: []
satisfies: []
situation: each invoice line needs its VAT rate, which follows from the tax class on the order's line: 7% for tea, 19% for accessories
finding: gap
```

# Billing's service maps tax class to VAT rate inline

```ts
// billing/service/issue-invoice.ts — called by billing's handler of shop's OrderPaid
import { percentOf } from "@teeladen/shared-kernel/money"                 // shared kernel: on SVC-6's list

const vatPercent = { tea: 7, accessory: 19 } as const                    // the VAT rule, in the service

export const createIssueInvoice = ({ transaction, handled, invoices, numbers, outbox }: Deps): IssueInvoice =>
  (event) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(event.id, tx))) return
      const lines = event.lines.map((l) => ({
        sku: l.sku,
        net: l.unitPrice,
        vat: percentOf(l.unitPrice, vatPercent[l.taxClass]).amount,
      }))
      const invoice = newInvoice(event.orderId, await numbers.next(tx), lines)
      await invoices.save(invoice, tx)
      await outbox.write(invoiceIssued(invoice), tx)
    })
```

Every import is on SVC-6's list, the write goes through the repository (SVC-4) in one transaction
(TX-1), the message commits with the change (TX-6), the delivery is claimed (TX-5). What the code
decided is where a business rule lives: the VAT rate per tax class sits in the service, where a reader
of billing's domain misses it and the credit-note use case (B5) writes it a second time.

Closest Scopes, none of which holds:
- DOM-3: "a business rule about the shape of a record: which fields it has, what each holds, which
  values a status takes." The rule computes an amount from a tax class; the invoice line's fields and
  the values each takes are the same whichever rate applies.
- SVC-2: "a use case decides by what this system has stored: whether this caller is allowed, whether
  the stock suffices, whether the order is still open." The tax class arrives on the message; nothing
  stored is decided by. Where it holds, its Statement says "The service that acts MUST enforce the
  decision itself, in the call that acts", which places the enforcing, not the rule.
- TST-3: "a business rule is tested." Holds for a test of the rule, and rules what the test calls,
  not where the rule is written.
- TX-27, TX-30, TX-35 each require "a business rule of its system" to decide, without placing it.

The glossary's "It holds no business rule of its own; the business rules are the domain's" (Service)
is a definition; the glossary's own header says "What a term may do is in the rules."

### gap-checkout-decides-by-billings-live-dunning-stage.md

```yaml
breaches: []
satisfies: []
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning; shop calls billing's open host service in-process
finding: gap
```

# Checkout refuses pay-by-invoice by billing's dunning stage, read live

```ts
// shop/service/place-order.ts — checkout
export const createPlaceOrder = ({ transaction, carts, orders, billing, outbox, clock }: Deps): PlaceOrder =>
  ({ customerId, cartId, payBy }) =>
    transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      const stage = payBy === "invoice"
        ? await billing.dunningStageOf({ customerId })     // shop's driven port over billing's open host service; takes no transaction (TX-25)
        : undefined
      const order = placeOrder(cart, { payBy, stage, now: clock.now() })   // domain: refuses "invoice" unless stage is "none"
      await orders.save(order, tx)
      await carts.save(emptied(cart), tx)
      await outbox.write(orderPlaced(order), tx)
    })
```

The read goes to the owner's open host service, as TX-12 asks. Between it and shop's commit, billing's
scheduled dunning run raises the customer to `reminder` and commits; shop commits an invoice order for
a customer in dunning, and no save of shop's fails on a change in billing. That is the harm TX-27
names for a replica ("no save in this store fails on a change there"). What the code decided is that
the answer may be stale by the commit, and no business rule says it accepts that.

Closest Scopes:
- SVC-2: "a use case decides by what this system has stored" and TX-24: "a use case decides by what
  this system has stored, other than a replica, and the decision has to hold when the use case
  commits". The dunning stage is stored by billing, not by shop.
- TX-27: "a use case decides by a replica." Nothing is copied: the stage is read live from the owner.
- TX-12: "a use case of this system reads data another system owns." Holds; its Statement, "It MUST
  read it from the owner's open host service or from its published events", rules where the data
  comes from, not what a decision on it must accept.
- TX-30: "this system holds a tentative operation, or waits on another system's answer." Holds for
  the call; its Statement rules "what happens when the confirmation or answer does not come", not an
  answer that comes and is stale by the commit.

The same decision recurs in SH3: checkout copies catalog's price read through the Local API, and an
editor's save can commit between the read and shop's commit.

### gap-order-line-copies-catalog-price.md

```yaml
breaches: []
satisfies: []
situation: checkout copies each line's price, sku and tax class from catalog's product
finding: gap
```

# The order line holds catalog's price, sku and tax class as shop's own values

```ts
// shop/domain/order.ts
export const orderLineSchema = z.object({
  productId: z.string(),                         // catalog's id
  sku: skuSchema,                                // copied from catalog's product
  unitPrice: moneySchema,                        // copied: the price the order was placed at
  taxClass: z.enum(["tea", "accessory"]),        // copied: billing's VAT follows from it
  quantity: z.number().int().positive(),
})

// shop/service/place-order.ts
const products = await catalog.byIds(cart.lines.map((l) => l.productId))   // shop's driven port over Payload's Local API
const order = placeOrder(cart, products)                                    // domain copies the three values per line
```

The code decided how shop's aggregate holds another system's data: copied values, kept as shop's
fact. It could as well have held `productId` alone and read price and tax class from catalog when
`OrderPaid` is written, or held catalog's whole product. Nothing rules between them.

Closest Scopes:
- DOM-4: "an aggregate needs something of another aggregate of the same system." Catalog's product is
  another system's record, and catalog is an external system.
- Glossary, Snapshot: "A value an aggregate copies from another aggregate or from a message when a
  use case needs it". The value is copied from the answer of catalog's API, neither another aggregate
  nor a message, so by the glossary it is no snapshot.
- TX-26 ("a replica is written") and TX-27 ("a use case decides by a replica"): a replica "is
  refreshed from what the owner publishes or returns to it"; the line's copy is never refreshed.
- TX-12: "a use case of this system reads data another system owns." Holds for the read; rules the
  source, not how the aggregate holds what it read.

### gap-payload-admin-reads-fulfillment-stock-table.md

```yaml
breaches: []
satisfies: []
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
finding: gap
```

# Catalog's config reads fulfillment's stock table in an afterRead hook

```ts
// catalog/collections/products.ts — catalog's config: an external system's code this codebase writes
import { sql } from "drizzle-orm"

fields: [
  {
    name: "stock", type: "number", virtual: true,
    admin: { readOnly: true },
    hooks: {
      afterRead: [
        async ({ data, req }) => {
          const { rows } = await req.payload.db.drizzle.execute(
            sql`select coalesce(sum(on_hand - reserved), 0)::int as stock
                from fulfillment_stock where sku = ${data?.sku}`,   // fulfillment's table, in the shared Postgres
          )
          return rows[0]?.stock ?? 0
        },
      ],
    },
  },
]
```

The code decided that catalog reads fulfillment's records from its table, past fulfillment's ports. A
rename in fulfillment's schema breaks the admin with no compile error, and fulfillment's business rules
on what a stock figure means (on hand less reserved) are restated in catalog's config.

Closest Scopes:
- TX-12: "a use case of this system reads data another system owns." The reader is catalog's config,
  no use case of a system of this codebase.
- Assumptions: "What a system of this codebase does with it is inside them: the adapters that call it,
  the hooks it calls, and the parts of its configuration that touch the system: what may change the
  system's records it keeps (SYS-12), how it tells the system of a change (TX-29)." The read touches
  fulfillment and is neither of the two parts named.
- SYS-12: "a record this system owns is kept by an external system." Fulfillment keeps its stock in its
  own tables, not in Payload's.
- SYS-9: "code outside a system imports from it." The SQL names fulfillment's table and imports nothing
  of fulfillment.
- SVC-7: "a service or a driving adapter reaches the outside". Catalog's hook is neither, of any system
  of this codebase.

### gap-admin-dashboard-in-no-system.md

```yaml
breaches: []
satisfies: []
situation: an admin dashboard joins orders, invoices and shipments in the one Postgres
finding: gap
```

# The admin dashboard is a page of no system, joining three systems' tables

```tsx
// apps/admin/app/dashboard/page.tsx — admin dashboard, in no system
import { pool } from "@teeladen/common/postgres"          // the common library's store client

export default async function Dashboard() {
  const { rows } = await pool.query<DashboardRow>(`
    select o.id, o.status, i.number as invoice, s.status as shipment
    from orders o
    left join invoices i on i.order_id = o.id
    left join shipments s on s.order_id = o.id
    order by o.placed_at desc limit 100`)
  return <OrdersTable rows={rows} />
}
```

The code decided that the dashboard belongs to no system. Placed in shop, the same join is a use case
of shop reading billing's and fulfillment's data, and TX-12 holds. Placed nowhere, it reads shop's,
billing's and fulfillment's records in their stores' terms, and a column renamed in any of them
breaks it at runtime.

Closest Scopes:
- TX-12: "a use case of this system reads data another system owns." The page is no system's use case.
- SVC-7: "a service or a driving adapter reaches the outside". The page is no service, and no driving
  adapter: driving adapters are "Callers adapted to driving ports", and the page calls none.
- SYS-9: "code outside a system imports from it." The page imports nothing from any system; the SQL
  names their tables.
- DRV-8: "a driving adapter imports a module." Not a driving adapter; its one import is the common
  library anyway.
- Assumptions name what sits outside the layers: "Assembly, a system's export paths and the common
  library sit outside the layers. So do probes." and tooling. The page is none of them: it runs in a
  process of the deployed application (not tooling), and reports on systems, not on its process (not
  a probe: "Code a process runs to report on itself rather than on a system"). No rule says code
  outside those belongs to a system.

### gap-health-probe-builds-own-pool.md

```yaml
breaches: []
satisfies: []
situation: /health pings the database
finding: gap
```

# The `/health` route builds its own store client at module load

```ts
// apps/server/app/health/route.ts — probe, found and called by the framework
import { sql } from "drizzle-orm"
import { createDatabase } from "@teeladen/common/postgres"         // the common library's Drizzle client factory

const db = createDatabase({ url: process.env.DATABASE_URL ?? "" })  // a second pool, beside the one assembly built

export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: "ok" })
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 })
  }
}
```

The code decided how a probe reaches the store: a client of its own, built from the environment. It
pings a pool no use case uses: assembly's pool is exhausted, `/health` answers ok. The one way to
the client assembly built, the courier, is closed to it.

Closest Scopes:
- ASM-2: "a factory needs a port's implementation, a store client, any other client of something
  outside the process, or a configuration value." The route module is no factory ("A function that
  takes what an implementation needs and returns it").
- ASM-4: "code reads the courier." Does not hold here. Where it would, its Statement, "It MUST be a
  driving adapter that assembly cannot construct, or cannot hand what it calls when it constructs it",
  bars the probe, which is no driving adapter.
- SVC-7: "a service or a driving adapter reaches the outside". A probe is neither; Assumptions: "Not
  everything gets a layer. [...] So do probes."
- ASM-7: "plumbing of the common library whose output changes nothing the system does or returns". A
  store client's output changes what the system returns.
- ASM-1: Scope "a process" holds; Statement "It MUST have one assembly." The route makes no port meet
  an implementation, so it is no second assembly, and the Statement does not reach the second pool.

`/metrics` is covered: ASM-7 holds for the meter it reads.

### gap-instrumentation-built-before-assembly.md

```yaml
breaches: []
satisfies: []
situation: auto-instrumentation must load before any other import
finding: gap
```

# Instrumentation builds and configures the tracer provider before assembly runs

```ts
// apps/server/instrumentation.ts — loaded first: node --import ./instrumentation.js ./server.js
import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "teeladen-server",
  traceExporter: new OTLPTraceExporter({ url: process.env.JAEGER_OTLP_URL }),  // configuration read in place
  instrumentations: [getNodeAutoInstrumentations()],                           // patches pg and http before anything imports them
}).start()
```

The code decided that a client of something outside the process, the Jaeger exporter, is built and
configured outside assembly, in a module that has to run before assembly imports anything, and
reads its configuration from the environment itself.

Closest Scopes:
- ASM-1: Scope "a process" holds; Statement "It MUST have one assembly." Assembly is "The one place in
  a process where every port gets its implementation"; the tracer provider is no port's
  implementation, so this module is no second assembly and the Statement does not reach it.
- ASM-2: "a factory needs [...] any other client of something outside the process, or a
  configuration value." The module is a side effect at load, no factory.
- ASM-7: "It MAY be imported as a ready-made instance." Rules who may import the tracer, not who
  builds it, from what configuration, or when.
- ASM-8: "Assembly MUST fill it before any driving adapter reads it." Orders loading for the courier
  only.

## Coverage

Rule ids are those whose Scope holds for the situation or for a decision its code has to make. `none`
marks a decision no Scope holds for; each has a finding above unless marked otherwise.

### Systems

| situation | rules whose Scope holds |
| --- | --- |
| catalog: external system Payload, owns the product, in Payload's tables | none for catalog itself (Assumptions: "An external system sits outside the rules"); for what systems do with it: DVN-4, SVC-7, TX-12, TX-28, TX-29, DRV-3, DRV-7; SYS-12 does not hold (catalog owns, catalog keeps) |
| shop: owns Cart, Order, shared Postgres via Drizzle | DOM-1, DOM-3, DOM-4, SVC-1, SVC-6, SVC-4, SVC-7, DVN-4, ASM-2, TX-1, TX-2, TX-23, TX-6, TST-3, TST-4, TST-5, TST-6 |
| payment: owns Payment, Refund | as shop, plus TX-22, TX-31, TX-30 |
| billing: owns Invoice, dunning stage, gapless invoice numbers | as shop, plus SVC-2, TX-24 (next number, by stored state), TX-32 (stage messages) |
| fulfillment: owns Stock, Reservation, Shipment; own worker process | as shop, plus SVC-2, TX-24, ASM-1, ASM-8 |
| common library: pino, OTel tracer to Jaeger | ASM-5, ASM-6, ASM-7 |
| common library: outbox relay and bus | TX-20, TX-21, ASM-5 |
| common library: Drizzle client factory | ASM-2 (receives its configuration value), ASM-5 |
| common library: unit of work ambient in `AsyncLocalStorage` | ASM-9, ASM-3, TX-1 |
| shared kernel: `Money`, `Sku` | SYS-14, DOM-1, ASM-6 does not hold (not the common library) |
| external systems Stripe, 3PL, bank API; mail provider | SVC-7, DVN-4, TX-22, TX-31, TX-5, DRV-7, TST-5, TST-12 |

### Edge cases

| situation | rules whose Scope holds |
| --- | --- |
| catalog: editors set copy, price, sku, tax class; rules in Payload's collection config (price above zero, sku unique) | none, by Assumptions ("An external system sits outside the rules [...] even where this codebase writes its configuration"); no finding, see Notes |
| catalog: Payload's auth supplies `req.user` | DRV-1 (shop's hooks work out the caller), ASM-3 (if a service reads it ambient) |
| catalog: `afterChange` hooks call shop's services | TX-28, TX-29, DRV-1, DRV-3, DRV-6, DRV-7, TX-25 |
| catalog: `beforeChange` asks shop for open orders with a sku, refuses | TX-28 (veto), DRV-1, SVC-7; catalog's refusal itself: none, by Assumptions |
| catalog: shop reads product, price, tax class through Local API | TX-12, SVC-7, SVC-6, DVN-4, TST-5 |
| catalog: Payload's own transactions, hook inside one; Payload's transaction can write to its own collection | TX-28, TX-29, TX-25, ASM-9 |
| catalog: editors see stock in Payload's admin, read-only | none (gap-payload-admin-reads-fulfillment-stock-table.md); SYS-12 does not hold |
| catalog: config, hooks, services, Payload instance in a cycle | DRV-3, ASM-8, ASM-4, DRV-6 |
| shop: checkout returns Stripe `client_secret` in the same request | SVC-7, ASM-2, DVN-4, TX-25, ASM-9, DRV-1, TX-30 (waits on payment's answer); TX-3 does not hold if creating a PaymentIntent is tentative, see Notes |
| shop: pay-by-invoice, not to a customer in dunning | by replica: TX-12, TX-26, TX-27, TX-32, TX-19; read live: TX-12, TX-30, and for the staleness none (gap-checkout-decides-by-billings-live-dunning-stage.md) |
| shop: checkout copies price, sku, tax class from catalog | TX-12, SVC-7, DOM-3 (shop's order line shape); how the line holds it: none (gap-order-line-copies-catalog-price.md); deciding by the live read: none (same gap as the dunning stage) |
| shop: order-confirmation mail once the order commits | TX-22, TX-6, TX-31, TX-5, DRV-7, ASM-3 (locale) |
| shop: calls billing's open host service in-process holding its ambient transaction | ASM-9, TX-25, SVC-7, ASM-2 |
| payment: Stripe behind an anti-corruption layer on the way out | SVC-7, DVN-4, SVC-6; ACL vs conformist: none, by Assumptions ("which a repository's ADRs decide") |
| payment: creates PaymentIntent on checkout's call, returns `client_secret` | TX-1, TX-30, SVC-7, DVN-4; TX-22 does not hold ("A request designed as a tentative operation changes nothing (glossary) and falls outside the Scope") |
| payment: Stripe webhooks at least once, out of order, Stripe's terms; stop after three days | TX-5, TX-19, DRV-7, DRV-1, TX-30 |
| payment: refunds when shop asks; disputed charge not refunded | TX-33, TX-34, SYS-13, TX-22, TX-31, SVC-2 |
| billing: invoice on `OrderPaid`, or on `OrderPlaced` when paid by invoice | TX-5, TX-19, TX-12, DRV-7, SVC-2, TX-24 (one invoice per order) |
| billing: VAT rate from the line's tax class | TX-12 (tax class arrives on shop's message); where the rule lives: none (gap-vat-rate-in-billing-service.md) |
| billing: bank API reports transfers in the bank's terms; matches open invoices; some match none | TX-5, DRV-7, SVC-7, DVN-4, SVC-2, TX-24; unmatched: TX-35 undecided, see Notes |
| billing: scheduled dunning, stage rises, clears on payment | DRV-1, SVC-7 (clock), TX-32, TX-19, TX-1, TX-23 |
| billing: credit note for each refund | TX-33, TX-5 |
| fulfillment: reserves on `OrderPlaced`, releases on `OrderCancelled` | TX-5, TX-19, SVC-2, TX-24, TX-23; stock short: TX-35 undecided, see Notes |
| fulfillment: `OrderPaid` / `OrderCancelled` before `OrderPlaced` | TX-19, TX-5 |
| fulfillment: 3PL webhooks in the 3PL's terms | TX-5, TX-19, DRV-7, DVN-4; TX-32 does not hold (the 3PL is no system of the rules) |
| fulfillment: registers each new SKU with the 3PL before shipping one | TX-22, TX-31, TX-26 (fulfillment's copy of skus), TX-19, TX-29 |
| fulfillment: worker process with its own entry point and assembly | ASM-1, ASM-8 |
| common library: OTel ambient context, no-op span when empty | ASM-7, ASM-3 |
| common library: auto-instrumentation loads before any other import | ASM-1 (Scope only), ASM-7; where telemetry is built: none (gap-instrumentation-built-before-assembly.md) |
| common library: request id and trace context cross systems, the transaction does not | ASM-9, TX-25 (transaction); ASM-3 (outbox adapter reading them ambient), TX-7 (message headers), DRV-1 (handler puts them back) |

### The checkout saga

| step | rules whose Scope holds |
| --- | --- |
| 1. shop places the order, publishes `OrderPlaced`; fulfillment reserves | TX-1, TX-6, TX-15, TX-17, TX-7, SVC-4; fulfillment: TX-5, TX-19, SVC-2, TX-24 |
| 2. shop calls payment, PaymentIntent, `client_secret` to the browser | as edge case "checkout returns `client_secret`" |
| 3. Stripe's webhook reaches payment, which publishes `PaymentSucceeded` / `PaymentFailed` | TX-5, TX-19, DRV-7, TX-6, TX-17, TX-30 |
| 4. shop marks paid, publishes `OrderPaid`; billing invoices, fulfillment ships | TX-5, TX-6, TX-23, TX-12; fulfillment's shipment: TX-22, TX-31 |
| 5. deadline or `PaymentFailed` cancels, `OrderCancelled`; fulfillment releases | DRV-1 (scheduled task), SVC-7 (clock), TX-23, TX-30, TX-5, TX-19 |
| 6. paid by invoice: billing invoices and fulfillment ships on `OrderPlaced`; `InvoicePaid`; `OrderPaid` after the fact | TX-5, TX-19, TX-12, TX-17, SVC-2, TX-24 |
| 7. payment after the deadline cancelled the order | TX-35, TX-3, SYS-13, TX-33, TX-34 |
| the saga as a whole: choreographed or orchestrated | none, by Assumptions ("which a repository's ADRs decide"); SYS-13 where commands are sent |

### Cross-cutting reads

| situation | rules whose Scope holds |
| --- | --- |
| admin dashboard joins orders, invoices, shipments | in a system: TX-12, SVC-7; in no system: none (gap-admin-dashboard-in-no-system.md) |
| a Payload edit revalidates the cached shop page | TX-28, TX-29, TX-30, DRV-3, DRV-7 |
| `/health` pings the database | ASM-1 (Scope only); how it reaches the store: none (gap-health-probe-builds-own-pool.md) |
| `/metrics` is scraped | ASM-7 |

## Relies-on findings

### SVC-2, line on DRV-8

- Line: "DRV-8: a driving adapter reaches its system through driving ports, importing no driven
  port, driven adapter or service of it."
- DRV-8: *Scope:* "a driving adapter imports a module." *Statement:* "The import MUST be one of: the
  framework that calls it, a driving port of its system, its system's domain, a shared kernel, its
  system's published language, the common library, a library that computes from its arguments."
- Beyond it: "reaches its system through driving ports". DRV-8 rules imports only. A driving adapter
  that imports the common library's `pool` and writes shop's table passes DRV-8; the document's own
  `svc-7-breach-server-action-raw-sql-through-common-pool.md` lists DRV-8 under `satisfies` for
  exactly that. What makes the adapter reach the outside through a port is SVC-7, which the line
  does not name.

### SVC-4, line on DRV-8

- Line: "DRV-8: a driving adapter imports a driving port of its system, and no repository."
- DRV-8: as above.
- Beyond it: "imports a driving port of its system". DRV-8's closed list permits that import and
  requires none. The part SVC-4 needs, no repository, holds.

### TX-3, TX-15, TX-21, TX-22, TX-31, TX-34, TX-35, line on DRV-7

- Line, in each: "DRV-7: a handler acknowledges a message once the use case it calls has succeeded,
  not before."
- DRV-7: *Scope:* "a handler is delivered a message." *Statement:* "It MUST NOT acknowledge it unless
  the use case it calls has succeeded."
- Beyond it: that the handler acknowledges once the use case has succeeded. DRV-7 forbids the early
  acknowledgement only; a handler that never acknowledges satisfies it. Most citing rules need only
  "not before". TX-34 needs the other half: its Why has the refusal commit so that "it has succeeded,
  and the handler acknowledges", and the bus stops redelivering. Nothing guarantees that acknowledgement.

### TX-22, line on TX-31

- Line: "TX-31: a use case called for a message passes the external system a key the message carries,
  where the external system takes one."
- TX-31: *Scope:* "a use case called for a message changes something in an external system that takes
  an idempotency key." *Statement:* "It SHOULD pass a key the message carries."
- Beyond it: the line states as given what TX-31 makes a default. A codebase deviates by ADR. SVC-2's
  line on TX-24 and SVC-4's line on TST-4 carry "by default" for a SHOULD; this one drops it.

### TST-6, line on TST-4

- Line: "TST-4: a service's test hands it fakes for its driven ports."
- TST-4: *Scope:* "a service is tested." *Statement:* "The test SHOULD hand it fakes for its driven
  ports."
- Beyond it: as above, a SHOULD stated as given. SVC-4 cites the same rule as "by default, a
  service's test hands it fakes for its driven ports."

## Notes

- File names. The documents name an example `<rule>-<ok|breach>-<slug>.md`, and a gap has no rule.
  The proposed names use `gap-<slug>.md`. Hung on: "An example file is named
  `<rule>-<ok|breach>-<slug>.md`".
- Payload's collection-config rules (price above zero, sku unique). Marked `none`, no finding: the
  Assumptions place them outside on purpose. Hung on: "An external system sits outside the rules:
  its exports, its layers and its transactions are its own, even where this codebase writes its
  configuration."
- VAT finding and DOM-3. Read as outside DOM-3's Scope. A reader who takes the invoice line's VAT
  field as "what each holds" puts the rate in DOM-3, and the finding narrows to a business rule in a
  service. Hung on: "a business rule about the shape of a record: which fields it has, what each
  holds".
- Unmatched bank transfers (B3) and short stock on `OrderPlaced` (F1). Both are decisions the code
  has to make. Whether TX-35's Scope holds depends on whether the bank's report, or `OrderPlaced`
  meeting short stock, counts as such an event. Both examples in the Scope are about this system's own
  step (a command it sent, an order it cancelled). TX-34 does not hold for either: the bank is no
  system of this codebase and `OrderPlaced` is an event. Hung on: "a use case is called for an event
  that tells this system its part of work spanning systems cannot go on as it stands".
- Local API as open host service. TX-12's Statement names "the owner's open host service", the
  glossary defines it as "The driving ports a system offers to other systems", and says an external
  system "is driven through its API". Whether Payload's Local API counts decides whether shop's read
  satisfies TX-12 or breaches it.
- PaymentIntent as tentative operation. TX-3 and TX-22 exclude tentative operations, and TX-30's Why
  treats "a PaymentIntent nobody confirmed and that changes nothing" as one, so the synchronous
  create is read as outside both. Hung on the glossary: "It changes nothing it asks for: its
  confirmation does."
- Request id on outbox messages. Whether an outbox adapter that stamps the ambient request id and
  trace context on a message changes "what it answers" is undecided. ASM-3's Why extends the harm to
  "what gets recorded too". Hung on: "The value MUST NOT change how the use case acts or what it
  answers."
- TX-5 against TX-22. TX-5 makes every use case called for a delivered message idempotent with no
  exception. TX-22's Why lets the mail use case repeat where the provider takes no key. Hung on TX-5:
  "It MUST be idempotent." and TX-22: "Where the owner takes no key, a repeat stays possible, which a
  business rule has to allow: a second mail."
- TX-19 and 3PL statuses. TX-19 relies on TX-32 for versions on overriding messages. TX-32's Scope,
  "a system writes messages of which a later one overrides an earlier", does not reach the 3PL's
  shipment webhooks, so nothing gives fulfillment a version to order them by. The line itself is
  accurate, so this is no Relies-on finding.
