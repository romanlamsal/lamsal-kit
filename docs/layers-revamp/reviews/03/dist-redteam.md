# Red team review, distilled set

Read: `reviews/03/distilled-world.md` only. Domain throughout: selling tea online, TypeScript on Node, Postgres.
Notation: "holds" means a designer who wants the design can defend it from the words of heading, Except
and Against; "fails" means no such defence exists. Where the verdict turns on a word, both readings are given.

## Summary

- **D1. Distributed monolith (sync mesh with cycles).** Holds all 19. P15 escapes through its own
  "unless a business rule needs another system's answer now", self-certified per call. Finding: no
  property against cycles between systems or against a use case depending on every system; P15's
  exception unbounded; retried acting calls covered by no property (P9 names deliveries only).
- **D2. One shared database schema.** 2a (all systems write the same rows) fails P11 under row-as-record,
  holds under column-as-record. 2b (own tables, cross-reads through SQL views shaped like the published
  language) holds all 19. 2c (CDC row events as published events) holds all 19. Finding: P11 says
  "through its published language", not "through its open host service"; nothing keeps published
  events out of the store's terms; a system reading another's view is not "downstream" by definition so
  P13 does not protect it.
- **D3. One system owning everything.** Holds all 19 (P11, P13, P16 vacuous; P19 met by prefixing terms).
  Finding: nothing ties a system's boundary to anything; P19 is satisfiable by renaming; P3 names no unit.
- **D4. Everything in one shared kernel.** Holds all 19; P2's "one place" met by the kernel package,
  P11 vacuous because every sharer "decides", P13 vacuous because no one system changes the kernel.
  Finding: shared kernel unbounded; Owner presumes one decider; P2 does not say whose domain.
- **D5. Entity services under one orchestrator.** Holds all 19 on the designer's readings (P3, P11 fail
  only on strict readings). Finding: nothing requires a system to keep the records its rules decide
  (Owner's "wherever it is kept" invites it); P15's exception again.
- **D6. Pinball choreography.** Holds all 19 (P3 fails only on a strict reading). Finding: no property
  says where a cross-system sequence lives; events used as disguised commands unconstrained.
- **D7. Ports looked up from an ambient registry.** Holds all 19 under "hands" = "makes available".
  Finding: P5's "hands it" has two readings; Courier and Factory imply arguments but bind nothing.
- **D8. Vendor-shaped domain (Prisma, Stripe, Shopify types as model).** Holds all 19 by declaring each
  vendor, the store's ORM included, an upstream external system and conforming. Finding: P1's Except
  covers any upstream, store and ORM included; P12's "by choice" accepts any choice.
- **D9. Business rules in vendor configuration (Shopify, Zapier, ShipStation, Stripe Radar).** Holds all
  19: the glossary lets external configuration hold rules this codebase writes, F9 exempts it from
  every property. Finding: rules this codebase writes can leave every property by moving into
  configuration; nothing requires them versioned or tested.
- **D10. Common library as rule bucket (VAT, shipping cost).** Fails P2; fails P5 only if the common
  library is "outside", which the glossary does not say. Finding: "outside" omits the common library,
  making P5's Except dead text on one reading.
- **D11. Leaky event log (others handle private events).** Fails P13 while the writer changes them;
  holds once it freezes them. Finding: "Private: meant only for..." binds nothing.
- **D12. One transaction across two in-process systems via an ambient transaction.** Fails P16. No finding.
- **D13. Business rules as swappable driven adapters (pricing policy port).** Fails P2 and P4. No finding.

## Design: D1. Distributed monolith

### Design

Systems, each its own process and own Postgres database (so its own store): Catalog, Pricing, Customer,
Inventory, Ordering, Payment, Shipping. All talk by synchronous HTTP; each caller holds a driven port per
callee with an anti-corruption-layer adapter.

- `PlaceOrder` (Ordering) calls Customer.getCustomer, Catalog.getProducts, Pricing.priceCart,
  Inventory.hold (tentative operation), Payment.authorize (tentative operation), Shipping.quote, then
  commits the order, then confirms hold and captures through the outbox.
- Pricing.priceCart calls Catalog.getProducts and Customer.getTier. Shipping.quote calls
  Inventory.getWarehouse and Catalog.getWeights. Catalog.getProductPage calls Inventory.getStock and
  Pricing.getPrice. Inventory.hold calls Catalog.getProduct (for weight class). Payment.authorize calls
  Ordering.getOrder (for the line items Stripe wants). Cycles: Catalog <-> Inventory, Catalog <-> Pricing
  (Pricing reads products, Catalog reads prices), Ordering <-> Payment.
- Every call is backed by a domain rule that "needs the answer now":

```ts
// ordering/domain/place-order.ts (pure)
export type PlacementFacts = {
  customer: CurrentCustomer      // rule: a blocked customer cannot order, as of placement
  prices: PricesInForce          // rule: an order is priced at the price in force at placement
  hold: StockHold                // rule: no order without held stock
  authorization: PaymentAuth     // rule: no order without authorized payment
  shippingQuote: CurrentQuote    // rule: shipping charged at the carrier's current rate
}
export function placeOrder(cart: Cart, facts: PlacementFacts): Result<Order, PlacementRefused> { ... }
```

Any one of seven systems down takes checkout down; Inventory down takes the product page down.

### Properties

- **P1 holds.** Each domain models its slice; ACL adapters keep upstream terms at the adapters, so
  "shaped by nothing that serves it" holds.
- **P2 holds.** Every rule, including each "needs now" rule, is in a domain ("lives in one place: the domain").
- **P3 holds / fails by reading.** Member discounts sit in Pricing, tiers in Customer; they change
  together. Holds if "sit together" means within a system's domain module per rule, fails if it means the
  same system. The text names no unit.
- **P4 holds.** Same response for HTTP and message callers; fakes and real adapters answer alike.
- **P5 holds.** Every remote call goes through a driven port assembly hands the service, adapters translate:
  "each port speaks the system's terms".
- **P6 holds.** Each port has a fake; "can run with nothing outside the process, in a test".
- **P7 holds.** Each use case writes its own store in one transaction.
- **P8 holds.** Hold and authorization are tentative; confirm and capture go through the outbox after commit,
  so "nothing final follows from it before it commits".
- **P9 holds vacuously** for the few messages (outbox confirm/capture use message ids). Not covered:
  Ordering times out on Payment.authorize and retries; P9 speaks of "a repeated delivery", not a repeated call.
- **P10 holds.** Each remote read is stale by commit (P16 forbids a cross-system transaction), and each is
  accepted by a rule ("price in force at placement"): "or on stale ones a business rule accepts".
- **P11 holds.** All reads and changes go through open host services.
- **P12 holds.** ACLs; nothing enters but by choice.
- **P13 holds.** Published languages versioned (`/v1`, `/v2`); each side of a cycle keeps the other's version.
- **P14 holds.** Messages and records versioned.
- **P15 holds through its exception.** "unless a business rule needs another system's answer now": each
  call has its rule. No text limits which rules may need an answer now or how many systems one use case may need.
- **P16 holds.** No cross-system transaction.
- **P17 holds.** Hold and authorization have expiries; failure releases both: "ends, and only in a state a
  business rule allows".
- **P18 holds vacuously.**
- **P19 holds.**

### Forces

- **F7 not withstood in substance.** Checkout availability is the product of seven systems'; P15 lets it.
- **F2 not withstood.** Moving "member discount" from Pricing to Customer rewires two call chains and a cycle;
  "the cut between systems moves" costs every caller.
- **F8 not withstood.** In a cycle each system is the other's upstream; neither "changes on its own terms".
- **F1, F3, F4, F5, F6, F9 withstood.**

## Design: D2. Every system reads one shared database schema

### Design

One Postgres database, one schema `public`, one store for all systems (the glossary's "Two clients are one
store when one transaction can carry the writes of both"; "A store may keep records of several owners").

- **2a.** Tables `orders`, `products`, `stock`. Ordering writes `orders.status`, `orders.lines`; Payment writes
  `orders.paid_at`, `orders.payment_ref`; Shipping writes `orders.shipped_at`, `orders.tracking`. Every system's
  adapters select from every table.
- **2b.** Each system writes only its own tables (`ordering_orders`, `catalog_products`...). For reads, each
  system defines versioned SQL views whose columns are exactly its published types, and other systems'
  driven adapters select from them, joining freely:

```sql
create view pl_ordering.order_v1 as
  select id, customer_id, placed_at, status::text as status, total_cents from ordering_orders;
```
```ts
// shipping/adapters/driven/pg-order-source.ts, implements Shipping's driven port OrderSource
const rows = await sql<OrderV1[]>`select o.*, p.weight_g from pl_ordering.order_v1 o
  join pl_catalog.product_v1 p on ...  where o.status = 'paid'`
```
  Shipping reads in one statement, then writes its own `shipping_shipments` in a separate transaction.
- **2c.** No views: Debezium reads the WAL of `ordering_orders`, the row change `{before, after, lsn}` is the
  published event `ordering.orders.changed`, Shipping handles it. The outbox is the table; the outbox reader
  is the Debezium connector, configured by assembly.

### Properties

- **P1 holds** (2b, 2c), since the repository maps rows to the model. 2c freezes the table, not the model.
- **P2 holds.**
- **P3 holds.**
- **P4 holds.**
- **P5 holds.** Shipping reaches Ordering's records through its driven port `OrderSource`, handed by assembly.
  Ordering's code is reached by no one, so "and is reached from it" is not engaged.
- **P6 holds.** `OrderSource` has a fake.
- **P7 holds.**
- **P8 holds.**
- **P9 holds.** 2c: the LSN is an id "the same on every delivery".
- **P10 holds.** In 2b Shipping could even read and write in one serializable transaction, its reads would then
  "still hold"; split, the stale read is accepted by a rule.
- **P11 2a fails / holds by reading; 2b, 2c hold.** 2a: if a record is a row, Payment and Shipping "change the
  records" Ordering owns: fails. If a record is "what a write changes" at column grain, each column's owner
  writes it: holds for writes; reads of raw tables fail unless the table schema is published language.
  2b: reads go through views whose shape is the published language: "or reads them except through its
  published language" is met word for word. 2c: the published event is the row; it is published language
  by being published.
- **P12 holds.** Chosen.
- **P13 holds.** 2b: Ordering changes its tables and redefines `order_v1`. 2c: Ordering keeps the table shape
  and maps in its repository. Also: a system reading a view does not "call the upstream's open host service,
  send its commands, handle its events", so by the glossary it is not downstream at all and P13 does not speak of it.
- **P14 holds.** Views versioned.
- **P15 holds.** The shared Postgres is a store, not "another system"; its outage stops all systems and P15 does not see it.
- **P16 holds / fails by reading.** Split transactions hold. One transaction reading Ordering's view and writing
  Shipping's table "spans two systems" only if a read counts.
- **P17 holds.**
- **P18 holds.** 2c: per-key ordering and LSN comparison.
- **P19 holds.**

### Forces

- **F1 not withstood.** Ordering moving its records to another store breaks Shipping's adapter; the glossary's
  "Swapping one changes nothing on the system's side of the port" protects only the swapping system.
- **F8 not withstood in substance.** Ordering's migrations (locks, rewrites) hit every reader; views are frozen
  by readers Ordering cannot see.
- **F7 / a missing force.** One store down is every system down. No force names shared infrastructure failing.
- **F2 withstood**, F3 not: a partial edit to a view's base table breaks systems the editor did not read.
- **F4, F5, F6, F9 withstood.**

## Design: D3. One system owning everything

### Design

One system, `TeaShop`, several processes (web, worker, scheduler) of the same system. Domain modules in
`src/domain/`: catalog, pricing, ordering, inventory, payment, shipping, loyalty, accounting, marketing,
subscriptions, wholesale. One glossary; where a word has two senses the glossary prefixes it:
`CatalogProduct`, `StockItem`, `WholesaleOrder`, `RetailOrder`, `InvoiceLine`, `OrderLine`. Aggregates kept
small. Domain modules import each other freely (`shipping/rules.ts` imports `ordering/RetailOrder` and
`catalog/CatalogProduct`). `PlaceOrder` writes RetailOrder, StockItem, LoyaltyAccount and Invoice in one
transaction. External systems Stripe, DHL, Xero behind ACL adapters. Four teams edit it.

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds / fails by reading.** Shipping rules and loyalty rules sit in different files: "stay apart" holds
  at file grain. Fails only if "apart" means different systems.
- **P4 holds.**
- **P5 holds.** Externals through ports.
- **P6 holds.**
- **P7 holds.** One transaction across four aggregates.
- **P8 holds.**
- **P9 holds.**
- **P10 holds.** Contention on LoyaltyAccount and StockItem is tied by rules ("points at placement",
  "no order without stock"). With a god aggregate (one `Order` with payment, shipping, loyalty, invoice
  fields saved whole) it would fail: refund and dispatch would fail each other with no rule tying them.
  Small aggregates avoid it.
- **P11 holds vacuously.** No other system of ours; Stripe writes nothing in our store.
- **P12 holds.** ACLs.
- **P13 holds vacuously.** No downstream.
- **P14 holds.**
- **P15 holds.** Stripe needed now by rule.
- **P16 holds vacuously.** Every transaction is within one system.
- **P17 holds.** Little spans systems.
- **P18 holds.**
- **P19 holds.** Each prefixed term has one meaning. P19 is met by renaming, not by cutting.

### Forces

- **F3 not withstood.** Nothing bounds what an edit must read; any domain module reaches any other.
- **F2 not withstood.** "the cut between systems moves": the first cut (selling wholesale through a
  separate system, or replacing accounting with Xero outright) turns every cross-module transaction into a
  P16 violation to undo.
- **F1, F4, F5, F6, F7, F8, F9 withstood.**

## Design: D4. Everything in one shared kernel

### Design

`packages/tea-kernel`: `Product`, `Order`, `OrderLine`, `Customer`, `Money`, `StockLevel`, and every rule:
pricing, discounts, VAT, shipping eligibility, reservation, cancellation window. Systems Storefront,
Ordering, Warehouse, Accounting each have `domain/index.ts` that re-exports the kernel plus a few local
types. Each system has its own store. Ordering publishes `OrderPlaced` whose payload type is the kernel's
`Order`. Warehouse keeps orders too (picking) and applies the kernel's `canCancel(order)` itself when a
customer cancels at the warehouse desk; Ordering applies the same function online.

```ts
// warehouse/domain/index.ts
export * from "@tea/kernel"
export { pickList } from "./pick-list"
```

### Properties

- **P1 holds.**
- **P2 holds.** Each rule has one source location, the kernel, and the kernel is in every domain ("each
  importing it into its domain"): "lives in one place: the domain".
- **P3 holds / fails by reading.** Pricing and picking rules sit in one package, apart in files.
- **P4 holds.**
- **P5 holds.** The kernel is part of each domain, not outside.
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds vacuously.** Owner is "the system whose business rules decide what a record holds"; kernel rules
  are every sharer's, so Ordering and Warehouse both decide orders; neither is "other".
- **P12 holds.** The kernel is chosen.
- **P13 holds vacuously / fails by reading.** No system changes the kernel alone ("agree on together"), so no
  "system changes its model". If Ordering's model is the kernel, any change changes Warehouse: fails.
- **P14 holds.** Additive kernel changes only.
- **P15 holds.**
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.** Within each system.

### Forces

- **F2 not withstood.** Every rule change is a release of every system.
- **F3 not withstood.** An edit to `canCancel` for the online shop changes the warehouse desk unseen.
- **F8 not withstood.** No system changes "on its schedule"; all move in lockstep.
- **F4 partly.** Mixed kernel versions during a deploy; held only by discipline.
- **F1, F5, F6, F7, F9 withstood.**

## Design: D5. Entity services under one orchestrator

### Design

Systems Products, Customers, Orders, Stock, Payments: each a CRUD open host service (`create/get/update/
delete/list`, optimistic `version`), own store, no rules beyond field validation. System Checkout holds a
process manager `CheckoutProcess` with every rule: pricing, discount, stock sufficiency, order status
machine. Each step sends commands: `UpdateOrder{id, status: "paid", version}`, `SetStock{sku, qty, version}`.
System Returns holds a second process manager with its own rules on the same order status ("returned only
after shipped") and sends `UpdateOrder` too.

```ts
// checkout/domain/checkout-process.ts (pure)
export function onPaymentCaptured(p: CheckoutProcess, order: OrderView): Step[] {
  if (order.status !== "reserved") return [fail("order not reserved")]
  return [cmd("Orders.UpdateOrder", { id: order.id, status: "paid", version: order.version })]
}
```

### Properties

- **P1 holds** generously: an entity schema is a model of something in the business domain.
- **P2 holds.** Each rule lives in one domain (Checkout's or Returns').
- **P3 holds / fails by reading.** Order status rules are split between Checkout and Returns and change together
  (adding "partially shipped"); holds rule by rule.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.** Checkout's own records are only its process state.
- **P8 holds.**
- **P9 holds.**
- **P10 holds.** `version` on every update: "commits only on reads that still hold".
- **P11 holds / fails by reading.** Owner is "the system whose business rules decide what a record holds,
  wherever it is kept". Checkout and Returns both decide order status. If either owns, the other changes its
  records through Orders: fails. Designer's reading: Orders keeps them and only validates, so Orders owns by the
  fallback "of a record no business rule decides, the system that keeps it", and every change goes through its
  open host service: holds. The glossary does not say which.
- **P12 holds.** ACL in Checkout.
- **P13 holds.** Entity services version their CRUD API.
- **P14 holds.**
- **P15 holds through its exception.** Checkout keeps none of the records its rules decide, so every step
  "needs another system's answer now".
- **P16 holds.**
- **P17 holds.** Compensating steps.
- **P18 holds.** Versions reject stale steps.
- **P19 holds.**

### Forces

- **F7 not withstood.** Every checkout step needs Orders, Stock, Payments, Products up.
- **F2 not withstood.** A new order rule touches Checkout, Returns and the Orders schema.
- **F6 not withstood in substance.** An invariant across Checkout and Returns (refund once) has no aggregate to
  hold it; P10 is met per update, not per invariant.
- **F1, F3, F4, F5, F8, F9 withstood.**

## Design: D6. Pinball choreography

### Design

Systems Ordering, Fraud, Inventory, Payment, Shipping, Loyalty, Notification. `OrderPlaced` (Ordering) ->
Fraud handles, publishes `OrderCleared` -> Inventory handles, reserves, publishes `StockReserved` -> Payment
handles, captures, publishes `PaymentCaptured` -> Shipping handles, publishes `ShipmentCreated` -> Loyalty
awards. Each event carries an order snapshot so no one calls back. Each system keeps a replica of the facts
its guard needs, so each sequence rule is a domain rule:

```ts
// payment/domain/may-capture.ts (pure)
export const mayCapture = (o: OrderFacts) => o.fraudCleared && o.stockReserved && !o.cancelled
```

Inventory does not care that Payment exists; `StockReserved` is published only so Payment proceeds. Adding
an age check for the matcha liqueur gift box between Fraud and Inventory changes Inventory's subscription,
Inventory's guard, Payment's guard and Ordering's timeout. Ordering cancels after 48 h without `ShipmentCreated`.

### Properties

- **P1 holds.**
- **P2 holds.** Every guard in a domain.
- **P3 holds / fails by reading.** The checkout sequence changes as one but sits in five systems; holds per guard.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.**
- **P8 holds.** Outbox per system.
- **P9 holds.** Inbox dedupe by message id.
- **P10 holds.** Replica staleness accepted by guards.
- **P11 holds.** Only published events read.
- **P12 holds.** ACLs per handler.
- **P13 holds.** Versioned events.
- **P14 holds.**
- **P15 holds** fully: everything asynchronous.
- **P16 holds.**
- **P17 holds.** Ordering's 48 h timeout plus `PaymentFailed` / `ReservationExpired` compensations: "ends".
- **P18 holds.** Guards wait for all facts.
- **P19 holds.**

### Forces

- **F2 not withstood.** Inserting or reordering a step edits four systems; "the cut between systems moves" is
  costly because the sequence has no home.
- **F3 not withstood.** No partial read shows the sequence; it exists only in the sum of subscriptions and guards.
- **F1, F4, F5, F6, F7, F8, F9 withstood.**

## Design: D7. Ports looked up from an ambient registry

### Design

Per-process registry in each system; assembly registers every implementation; services, adapters and even
domain-adjacent helpers resolve what they need. Repositories read the transaction from per-request
`AsyncLocalStorage`.

```ts
// ordering/assembly.ts
registry.set(OrderRepo, new PgOrderRepository(pool))
registry.set(Payments, new StripePayments(stripe))

// ordering/service/place-order.ts
export async function placeOrder(cmd: PlaceOrderCommand): Promise<PlaceOrderResult> {
  const orders = resolve(OrderRepo)       // typed: Token<OrderRepository>
  const payments = resolve(Payments)
  ...
}

// test
beforeEach(() => { registry.set(OrderRepo, new FakeOrderRepository()) })
```

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.**
- **P4 holds.**
- **P5 holds / fails by reading.** "only through ports assembly hands it": assembly put each port in the
  registry; the registration is "the only place where port and implementation meet". Holds if "hands" means
  provides; fails if it means passes as argument. The glossary's Factory ("takes what an implementation needs")
  and Courier ("when assembly cannot hand it over as an argument") imply the latter but are definitions, not
  properties. "Reach ... however the code got hold of it" says reach is indifferent to means.
- **P6 holds.** Fakes registered per test (parallel tests sharing the registry leak, but each "can run").
- **P7 holds.** Ambient transaction.
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.**
- **P13 holds.**
- **P14 holds.**
- **P15 holds.**
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**

### Forces

- **F3 not withstood.** A use case's reach is invisible in its signature; a partial edit adding `resolve(X)`
  makes it reach something new, failing at runtime where X is unregistered.
- **F1 withstood**, but a new caller (a second process) must replicate every registration blind.
- **F2, F4, F5, F6, F7, F8, F9 withstood.**

## Design: D8. Vendor-shaped domain

### Design

Ordering's domain uses Prisma's generated types as its model; driving ports take Prisma inputs. Payment's
model is `Stripe.PaymentIntent`. Catalog's model is Shopify's generated Admin API types. The designer
declares Postgres-through-Prisma an external system (bought or adopted, in our process, "driven through its
API") and Ordering a conformist of it; Payment conforms to Stripe; Catalog conforms to Shopify.

```ts
// ordering/domain/can-cancel.ts: type-only imports, so it "loads on every runtime"
import type { Prisma } from "@prisma/client"
type OrderWithPayment = Prisma.OrderGetPayload<{ include: { lines: true; payment: true } }>
export const canCancel = (o: OrderWithPayment): boolean =>
  o.status === "PENDING" && o.payment?.stripe_status !== "succeeded"

// ordering/ports/driving.ts
export type PlaceOrder = (input: Prisma.OrderCreateInput) => Promise<OrderWithPayment>
```

Outbound events are translated to a hand-written `OrderPlacedV1`.

### Properties

- **P1 holds through its Except.** "the terms of an upstream this system conforms to (P12)": Prisma/Postgres,
  Stripe, Shopify are each such an upstream; "its business rules stay its own, written in those terms" (canCancel).
  Fails only if a store cannot be an external system, which the glossary never says (External system: "bought or
  adopted ... in its own process or in ours").
- **P2 holds.**
- **P3 holds.**
- **P4 holds.**
- **P5 holds.** "each port speaks the system's terms": conformism makes Prisma's terms the system's ("its published
  language is used untranslated, in any layer"). The driving-port definition ("in the system's terms, not its
  store's") clashes, but only if the store is not an upstream.
- **P6 holds.** Fakes return Prisma-shaped objects.
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.** "only by choice": chosen three times.
- **P13 holds.** Outbound translation.
- **P14 holds.**
- **P15 holds.**
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.** `status` (Prisma enum) and `stripe_status` are distinct names.

### Forces

- **F1 not withstood.** Replacing Prisma with Drizzle rewrites the domain; P1's Except swallows the force P1 is against.
- **F9 / F8 not withstood.** A Stripe API version bump rewrites Payment's domain; P12 only asks that it was chosen.
- **F2 not withstood.** "Pay by invoice for wholesale tea" has no place in `Stripe.PaymentIntent`.
- **F3, F4, F5, F6, F7 withstood.**

## Design: D9. Business rules in vendor configuration

### Design

The shop runs on external systems the team configures: Shopify (catalog, cart, checkout; discount Functions:
"3 tins of Sencha, 10% off", "members free shipping over 40 EUR"), Shopify Flow and Zapier ("order paid and
matcha > 100 g: tag gift, add free sample"; "stock < 10: email supplier"), ShipStation automation ("AT/CH via
Post, DE via DHL, > 2 kg via DPD"), Stripe Radar ("block if card country differs from shipping country and
amount > 200 EUR"), Xero bank rules. The codebase holds one thin system, Glue: hooks from Shopify and
ShipStation, a nightly reconciliation, a few calls to Xero. Rules are edited in vendor UIs; none is in the
repository or any test.

### Properties

The glossary: an external system's "configuration may hold business rules this codebase writes, in the external
system's terms; its architecture stays its own". F9: it "holds none of these properties".

- **P1 holds** for Glue (almost no model).
- **P2 holds by the glossary's permission.** Each rule lives in one place, an external system's configuration.
  Fails only if "the domain" means a domain this codebase writes, which P2 does not say.
- **P3 holds / fails by reading.** Expanding to Switzerland changes shipping, VAT, fraud and discount rules
  together across four vendors.
- **P4 holds.**
- **P5 holds.** Glue reaches vendors through ports.
- **P6 holds.** Glue's use cases run on fakes; the business rules are not Glue's use cases.
- **P7 holds.**
- **P8 holds.**
- **P9 holds.** Glue's hooks dedupe by event id.
- **P10 holds.**
- **P11 holds.** Zapier changes Shopify's orders through Shopify's API, so Shopify does the changing.
- **P12 holds.** Glue chose.
- **P13 holds vacuously.**
- **P14 holds.**
- **P15 holds.** Shopify needed now.
- **P16 holds.**
- **P17 holds.** Nightly reconciliation repairs half-run zaps.
- **P18 holds.** F9 exempts vendors; Glue tolerates order.
- **P19 holds.**

### Forces

- **F2 not withstood.** Rules change in UIs with no review or deploy.
- **F3 not withstood.** No reader of the repository sees any rule.
- **F4 not withstood in substance.** A configuration change applies instantly to orders in flight, unversioned.
- **F9 not withstood.** Vendors change their configuration languages.
- **F1, F5, F6, F7, F8 withstood** by Glue.

## Design: D10. Common library as rule bucket

### Design

`@tea/common` holds `vatRate(country, category)` (tea at the reduced rate, teaware at the standard),
`shippingCost(weightG, country)`, `orderNumber()`, `Money`, `logger`. Ordering's and Invoicing's services
import `vatRate` and `shippingCost`; Ordering's domain imports `Money`.

### Properties

- **P1 holds.**
- **P2 fails.** VAT and shipping-cost rules live in the common library, not "the domain".
- **P3 holds.**
- **P4 holds.**
- **P5 holds / fails by reading.** If the common library is "outside", the services reach it without a port and
  the Except does not apply ("whose output changes neither how a use case acts nor what it answers": `vatRate`
  changes the answer): fails; and the domain importing `Money` also fails (the Except covers "a service or an
  adapter" only). If it is not outside (Outside lists "other systems and third parties"; it is "a package of no
  system"), P5 is not engaged and its Except is dead text: holds.
- **P6–P19 hold.**

### Forces

- **F2, F3 not withstood.** A VAT change reaches every system unseen. P2 catches it, so no new property is
  needed; the "outside" ambiguity remains.

## Design: D11. Leaky event log

### Design

Every system writes every domain event, private ones included, to one topic. Shipping handles Ordering's
private `OrderLineQuantityChanged` to replan parcels early.

### Properties

- **P1–P12 hold.** P11 covers records; a private message is not a record.
- **P13 fails** while Ordering refactors its private events: Shipping, which "handles its events", must change.
  Holds again once Ordering freezes them, making them published in all but name.
- **P14–P19 hold.**

### Forces

- **F8 not withstood** until frozen; then F2 not withstood by Ordering (its model is pinned by its private events).

## Design: D12. One transaction across two in-process systems

### Design

Ordering and Inventory share a process and the Postgres store. `PlaceOrder` calls Inventory's driving port
`reserve` in-process through a driven port; Inventory's repository takes the transaction from per-request
`AsyncLocalStorage`, so both writes commit together.

### Properties

- **P1–P15 hold.** (P11 holds: Inventory changes its own records.)
- **P16 fails.** "No transaction spans two systems."
- **P17–P19 hold.**

### Forces

- **F8 not withstood.** Caught by P16.

## Design: D13. Business rules as swappable driven adapters

### Design

Ordering's service takes a driven port `PricingPolicy`; assembly picks `BlackFridayPricing` (50% off
Oolong) or `StandardPricing` by environment variable.

### Properties

- **P1 holds.**
- **P2 fails.** The pricing rule lives in an adapter.
- **P3 holds.**
- **P4 fails.** "responds the same ... whatever serves it": swapping the adapter changes the price.
- **P5–P19 hold.**

### Forces

- **F1 not withstood.** Caught by P2 and P4.

## Findings

### N1. Cycles between systems (D1)

Missing: nothing forbids two systems each depending on the other; "Upstream" presumes one direction ("the one
the other depends on") and becomes both at once.

> **P20.** Systems depend on each other without cycles: no system is upstream of its own upstream
> *Except:* a shared kernel, which its sharers change together.
> *Against:* F2, F7, F8.

Makes redundant: nothing; it gives "Upstream system ... changes on its own terms" a precondition.

### N2. P15's exception is self-certifying (D1, D5)

Missing: any bound on which rules may need another system now. Every call can be given a rule. Note that
P10 with P16 already makes a remote read stale by commit, so a read's "now" differs from a replica's only in lag.

Change P15's heading to:

> **P15.** A use case works while other systems are down or slow; it needs another system up only to obtain a
> commitment a business rule requires before it answers (a tentative operation or its confirmation), and what it
> only reads of another system it reads from a snapshot or replica
> *Except:* an answering use case whose business rule accepts no copy at all (a parcel's live position).
> *Against:* F7.

Makes redundant: "unless a business rule needs another system's answer now".

### N3. Retried acting calls (D1)

Missing: P9 covers "a repeated delivery"; a caller retrying an acting call after a timeout (F7: "slow") is not a
delivery. P17 catches the double charge only as an end state, and puts no duty on the callee.

> **P9.** A repeated delivery, or a repeated acting call from another system, changes no record of this system,
> and answers as the first did
> *Against:* F5, F7, F9.

Makes redundant: "succeeds where the first did" (the glossary's Idempotent says "answers as the first did").

### N4. Shared schema through published-shaped views; store-shaped published events (D2)

Missing: P11 permits reading "through its published language", which a SQL view or a CDC row stream satisfies
without the owner's code running; a system reading a view is not "downstream" by the glossary, so P13 does not
cover it; nothing says a published event is in the system's terms rather than its store's.

> **P11.** No other system reaches the records a system owns: it calls the owner's open host service or handles
> what the owner publishes
> *Except:* a replica, refreshed from what the owner publishes or returns.
> *Against:* F1, F8.

Glossary, Published language: append "It speaks the system's terms, not its store's." Makes redundant: P11's
"or reads them except through its published language", and the driving-port clause "not its store's" (now covered
by Published language for the open host service).

Optionally, a force for the shared store:

> **F10. Shared infrastructure fails together.** A store, bus or host several systems use stops for all of them at once.

with P15 extended to "while other systems, or what they share with it, are down or slow".

### N5. System boundary follows nothing (D3)

Missing: no property places a system's boundary. P19 is met by prefixing (`CatalogProduct`, `StockItem`), so
"one bounded context" is a label. If the document means to allow a single large system, it should say so; if not:

> **P19.** Within one system each term has one meaning, and a word the business uses in two senses is two
> systems' word, not one system's two prefixed terms
> *Except:* a sense only an upstream uses, kept at the adapters (anti-corruption layer).
> *Against:* F2, F3.

Makes redundant: nothing; supersedes current P19.

Also missing, for later cuts: nothing keeps a system cuttable. Proposed:

> **P21.** A use case's transaction changes one aggregate, or several a business rule ties
> *Against:* F2, F6.

Makes P7's "land together" carry fewer records; does not replace it.

### N6. P3 names no unit (D1, D3, D4, D5, D6, D9)

Every design passed P3 at file grain. Change P3's heading to:

> **P3.** Business rules that change together sit in one system, and within it in one aggregate or domain
> module; rules that change for different reasons sit in different modules, and no shared kernel holds a rule
> only some of its sharers change for
> *Against:* F2.

Makes redundant: nothing; fixes D4's kernel, D5's split status rules, D6's scattered sequence on the strict reading.

### N7. Records kept away from their rules; owner presumes one decider (D4, D5)

Missing: Owner ("the system whose business rules decide what a record holds, wherever it is kept") allows the
decider and the keeper to differ and several deciders at once.

> **P22.** A system keeps the records its business rules decide, and no other system's rules decide them
> *Except:* replicas and snapshots, whose records copy another's decisions.
> *Against:* F2, F6, F7.

Glossary, Owner: "The one system whose business rules decide what a record holds; it keeps it." Makes redundant:
Owner's "wherever it is kept" and "of a record no business rule decides, the system that keeps it".

### N8. P2's "one place" satisfied by sharing (D4, D9)

Missing: P2 does not say whose domain. Change P2's heading to:

> **P2.** A business rule lives in one place: the domain of the system that owns what it decides

Makes redundant: nothing; closes the shared-kernel and vendor-configuration readings of "one place".

### N9. Cross-system sequence has no home (D6)

Missing: the glossary defines Choreography and Orchestration; no property constrains either.

> **P23.** A sequence across systems that a business rule orders lives in one system's domain; an event states a
> fact of its publisher's domain, never only that another system should act next
> *Except:* reactions each system would make without knowing the sequence exists.
> *Against:* F2, F3.

Makes redundant: nothing.

### N10. "hands" in P5 (D7)

Change P5's heading to "... only through ports assembly passes it as arguments; each port speaks the system's
terms", and add to the Except: "and a driving adapter that reaches what assembly produced through a courier".
Optionally:

> **P24.** What a module reaches is visible in what it is given: no domain, service or driven adapter reads a port
> from an ambient value
> *Except:* a driving adapter's courier.
> *Against:* F3.

Makes redundant: nothing; makes Factory and Courier binding.

### N11. Conforming to a store, ORM or framework; conforming everywhere (D8)

Missing: P1's Except accepts any upstream; nothing says a store is not an external system; P12 accepts any choice.

Glossary, External system: append "A store, and a library or framework the system's code runs on, is none."
P1 Except: "the published language of an upstream system this system conforms to, never a store's, library's or
framework's terms; its business rules stay its own, written in those terms." P12:

> **P12.** Another system's model enters this one only by choice, and only where every business rule of this system
> can be written in it
> *Against:* F8, F9.

Makes redundant: nothing; narrows P1's Except.

### N12. Rules this codebase writes, outside the codebase (D9)

Missing: the glossary lets an external system's configuration hold rules this codebase writes; F9 exempts it from
every property.

> **P25.** A business rule this codebase writes is in the repository and checked by its tests
> *Except:* a rule only an external system can enforce: its configuration is deployed from the repository and
> checked by an integration or end-to-end test.
> *Against:* F2, F3, F9.

Makes redundant: nothing; qualifies the glossary's "Its configuration may hold business rules this codebase writes".

### N13. Outside omits the common library; private binds nothing (D10, D11)

Glossary, Outside: "Other systems, the common library and third parties ...", and P5's Except extended from "a
service or an adapter" to any layer, so a domain may use logging-free helpers; or say outright that the common
library is not outside and delete P5's Except. P11: add "or handles the messages it keeps private". Makes
redundant: P5's Except on the second option.

### N14. Forces the designs exposed

> **F11. Dependencies accumulate.** A call or subscription between systems is easier to add than to remove; the
> graph between systems only grows.

Against it: N1, N2. And a force for D9:

> **F12. Configuration changes outside the code.** What an external system is configured with changes without a
> deploy, a review or a test.

Against it: N12.

## Words the designs hinged on

- **own / Owner.** "The system whose business rules decide" presumes one decider (D4: every sharer decides; D5: two
  orchestrators decide). "wherever it is kept" lets keeper and decider differ (D5). "decide" vs "validate": does an
  entity service's field validation decide?
- **keeps.** Used of a system ("the system that keeps it", "Each system keeps its records") and of a store ("A store
  may keep records of several owners"). In D2 the store keeps all; which system keeps?
- **upstream / downstream.** "depends on" undefined; mutual dependence makes each both (D1). Reading another's view
  or CDC stream is none of "calls ... sends ... handles", so the reader is not downstream and P13 is silent (D2).
- **outside.** Are npm libraries "third parties"? Is the common library outside (D10)? Is a store an external system,
  hence an upstream one may conform to (D8)?
- **record.** Row, column, aggregate (D2a). Is a view row a record? Is a message on a topic a record (D11)?
- **message.** "Private: meant only for": intention, not constraint (D11). Is a CDC row change a message (D2c)? It has
  an id the same on every delivery, so yes.
- **call.** In-process or remote; P15's "down or slow" has no meaning for an in-process system (D12). A retried call
  is not a "delivery" (D1, N3).
- **hands (P5).** Argument or registry (D7).
- **sit together / stay apart (P3).** File, module, aggregate, package, system (D1, D3, D4, D5, D6, D9).
- **one place / the domain (P2).** Source location or system; whose domain; external configuration (D4, D9).
- **reads (P10).** Own records only, or remote answers and replicas too (D1).
- **spans (P16).** Writes only, or reads too (D2b).
- **through its published language (P11).** Through the open host service, or in published shape (D2b, D2c).
- **by choice (P12).** Any choice (D8).
- **its model (P13).** Whose model is a shared kernel (D4).
- **needs ... now (P15).** Self-certified by writing a rule (D1, D5).
- **the system's terms (P5, driving port).** Conformism makes any upstream's terms the system's, the store's included (D8).
- **ends (P17).** A timeout-cancelled state counts if a rule allows it (D6); any state can be made "allowed".
- **business rule.** P10, P15, P17 each defer to "a business rule"; the designer writes the rules, so each deferral is
  an exit (D1, D5, D6).

## Notes

- The distilled file names `general-rules.md` as a source but lists no rules. Glossary terms used by no property:
  Pure, Factory, Courier, Ambient value, Acting call, Settle, Hook, Scheduled task, Probe, Tooling, Snapshot,
  Specification, Reconciliation, Saga, Choreography, Orchestration, Tentative operation, Repository, Aggregate.
  A property-only reader sees no stance on any of them; several designs fail only by a definition ("Domain ... is
  pure", driving port "not its store's", Repository "over exactly one aggregate"), which then act as rules.
- P11 read literally forbids any other system changing owned records, even through a command; it holds only because
  the owner's use case does the writing. Worth saying.
- P13's Against reads "F8, seen from upstream"; every other Against is a list of ids.
- P5's Except allows little: `orderNumber()` and `Money` arithmetic change what a use case answers, so only logging,
  tracing and similar pass. If that is intended, Money must sit in a shared kernel; the text does not say so.
- Several properties fail only for a god aggregate (P10 in D3), not for a god system; the document guards aggregate
  size implicitly and system size not at all.
- Designs that fail (D10, D11, D12, D13) show P2, P4, P13, P16 biting as intended.
