# Red team review, raw set

Read: `glossary.md`, `the-world.md`, nothing else. A verdict is judged on heading, Except and Against
only. "Holds" means the design can claim the binding text under a reading the text permits; where
one word decides it, the word is named and the reading given. The Why is noted apart, as "Why
alone". Domain: a tea shop online, TypeScript on Node, Postgres.

## Summary

- **A. Distributed monolith.** Holds every property. P15 holds through "unless a business rule
  needs another system's answer now": any rule naming "current" qualifies, and P10 pushes that
  way, since no read of another system "still holds" at commit. Only the Why of P15 refuses it.
  Finding 1.
- **B. Shared database schema.** Holds if P11's "through its published language" means "in its
  terms" (the table schema is declared part of the published language) and P16's "spans" means
  "writes". Fails P11 only under the channel reading. Nothing protects a system's store from its
  readers. Findings 2, 3.
- **C. One system owns everything.** Holds. P11, P13 and P16 are empty, and P19 holds by
  renaming. It is only bad at scale, and neither document says at what size. Finding 4 (weak).
- **D. Everything in one shared kernel.** Holds. Every system is owner, so "other" in P11 is
  empty. P13 holds vacuously (billing has no model of its own) or because the whole thing is one
  system run as four processes. P3's "apart" is met by keeping rules in different files.
  Findings 4, 5.
- **E. Entity services under one orchestrator.** Holds if "changes" in P11 means "decides the
  change" (the glossary's owner/keeper split leans that way) and "a use case's writes" in P7
  leaves out what its commands cause. Findings 1, 6.
- **F. Pinball choreography.** Holds unless the fulfilment flow counts as one business rule (P2)
  or is shown to change together (P3). Neither can be settled at design time. Nothing binding
  tells pinball apart from choreography. Finding 7.
- **G. Ports from an ambient registry.** Holds. Assembly registering implementations meets
  "ports assembly hands it". Only the Why of P5 refuses it. Finding 8.
- **H. Vendor-shaped domain.** Holds by declaring Postgres-through-Drizzle (or TypeORM) an
  upstream external system "in ours [process]" and conforming to it, which P1's Except allows.
  Only the Why of P1 refuses it. Finding 9.
- **I. Business model in the common library.** Holds. The common library is not "outside" (P5)
  and not "another system's model" (P12), and an imported rule "lives" in the importing domain,
  as the shared kernel entry implies. Finding 5.
- **J. Tooling side door.** Holds. A CI-cron script writes billing's records and imports
  billing's domain, but tooling is not a system (P11), not "outside" (P5) and not a use case
  (P7, P10). Findings 6, 10.
- **K. Lying fakes.** Fails P4 ("whatever serves it"). P6's heading alone would let it through,
  and the fidelity sentence in P6's Why repeats P4. Finding 11 (editorial).
- **L. Global serialization.** Holds P10, because waiting is not "failing". Mostly out of scope
  (throughput). Finding 12.
- **M. Commands dressed as events.** Holds. No property says that the system doing the work
  defines how it is asked, and no Why refuses it. Finding 13.
- **N. Unversioned open host service / lockstep deploy.** Holds. P14 covers only "a record or a
  message", and P13 covers only the model, not the published language. Finding 14.

## Design: A. Distributed monolith

### Design

Systems, each with its own Postgres database: Catalog (teas, descriptions), Pricing (base
prices, discounts, tiers), Inventory (stock), Customer (accounts, addresses, tier), Checkout
(carts, orders), Billing (Stripe), Shipping (DHL). Each offers an open host service over HTTP.
The cut follows nouns.

Every use case reads every other system live:

- Checkout's `viewCart` (answering) calls `Catalog.teas`, `Inventory.levels`,
  `Customer.tier` and `Pricing.quote`.
- `placeOrder` makes the same calls, then `Inventory.reserve` and `Billing.authorize`
  (tentative), commits the order with outbox rows, and confirms or captures after commit.
- `Pricing.quote` calls `Catalog.category` and `Customer.tier`.
- `Catalog.teas` calls `Pricing.basePrice` to show prices. The calls form cycles.

Checkout's domain states "a cart shows the current price, the current stock and the customer's
current tier" and "an order is placed at the price quoted during placing". The design team wrote
both rules so that every call counts as "needed now".

```ts
// checkout/service/view-cart.ts
export const viewCart = (deps: {
  carts: CartRepository; catalog: TeaCatalog; stock: StockLevels;
  customers: CustomerTiers; pricing: PriceQuotes;
}) => async (cartId: CartId): Promise<CartView> => {
  const cart = await deps.carts.load(cartId);
  const [teas, levels, tier] = await Promise.all([
    deps.catalog.teas(cart.teaIds()), deps.stock.levels(cart.teaIds()), deps.customers.tier(cart.customerId),
  ]);
  const quote = await deps.pricing.quote(cart.lines, tier);
  return cartView(cart, teas, levels, quote); // domain
};
```

Variant A2: all published languages sit in one `@tea/contracts` package, every system pins the
same version, and the whole fleet deploys together after the outbox drains.

### Properties

- **P1 holds.** "shaped by nothing that serves it": checkout's domain is `Cart`, `Order` and
  `CartView`. The HTTP clients sit behind ports written in checkout's terms.
- **P2 holds.** "lives in one place: the domain": discount rules live in Pricing's domain,
  availability in Inventory's, "a cart shows current prices" in Checkout's. Each is written once.
- **P3 holds on the heading.** "change together ... change for different reasons": with a noun
  cut, each system can claim its rules change for its own reason (Pricing for marketing,
  Inventory for the warehouse). Whether rules "change together" is a claim about future changes,
  and the heading gives no test for it at design time.
- **P4 holds.** The route, a CLI and a test reach `placeOrder` alike, and a fake answers as the
  HTTP adapter does.
- **P5 holds.** The driven ports `TeaCatalog`, `StockLevels`, `CustomerTiers` and `PriceQuotes`
  are in checkout's terms and "assembly hands" them as arguments.
- **P6 holds.** Fakes stand in for all five ports.
- **P7 holds.** The order and its outbox rows commit in one checkout transaction.
- **P8 holds.** `reserve` and `authorize` are tentative operations, confirmed through the outbox
  after commit.
- **P9 holds.** Handlers keep the ids of the messages they have handled.
- **P10 holds.** "or on stale ones a business rule accepts": checkout's rule accepts the quote
  taken during the call. Note that P10 rewards live calls. With no shared transaction (P16), a
  read of another system never "still holds" at commit, so the freshest stale read is the easiest
  one to defend.
- **P11 holds.** All cross-system reads go through open host services.
- **P12 holds.** Each driven adapter translates.
- **P13 holds.** Each open host service is versioned.
- **P14 holds.** Records and messages carry versions.
- **P15 holds.** "unless a business rule needs another system's answer now": checkout's domain
  says the cart shows the current price, stock and tier, so every call is needed now. The
  glossary's "Business rule. What the business domain allows, requires or forbids." gives no test
  that separates a requirement of the business from one the designers chose.
- **P16 holds.** No transaction is shared.
- **P17 holds.** Reservations and authorizations are tentative, and each either confirms or
  expires.
- **P18 holds.** Handlers compare versions.
- **P19 holds.** Each system has its own glossary.
- **Variant A2** holds everything above too: P14 holds because no message outlives the deploy
  that wrote it, and P13 holds because the model can still change behind the contracts.

Why alone:

- P15's Why ("Where every use case calls another system, this one is down whenever any of them
  is"; "A use case needing only data this system keeps, replicas included, runs anyway") describes
  A and refuses it.
- P3's Why ("A business change made across several systems needs all of them to change in step")
  refuses A once a change crosses the noun cut.

### Forces

- **F7 not withstood.** `viewCart` is up only when five systems are up, and one slow Pricing
  slows every page.
- **F8 strained.** Checkout is downstream of five published languages, and every change in one of
  them is checkout's to absorb.
- **F2 strained.** "the cut between systems moves": a rule such as "discount overstocked teas"
  adds a Pricing → Inventory call, and the cycles grow.
- **F4 (A2).** A2 cannot replace one system without replacing all of them.
- Withstands F1, F3, F5, F6 and F9.

## Design: B. Every system reads one shared database schema

### Design

One Postgres database and one schema. The tables are `teas` and `prices` (Catalog),
`stock_levels` (Inventory), `carts`, `orders` and `order_lines` (Checkout), `invoices` (Billing)
and `shipments` (Shipping). Each system writes only its own tables, through its own
repositories.

Each system's Offer exports its Drizzle table definitions as "the schemas" of its published
language: catalog's open host service has a driving port `listTeaPrices()` whose return type is
`typeof prices.$inferSelect`. Catalog promises additive change only, and its repository maps its
model to the frozen tables.

Other systems read those tables directly through their own driven ports, which are in their own
terms. Checkout's `placeOrder` transaction locks Inventory's rows `FOR SHARE`, so that its stock
read still holds at commit.

```ts
// checkout/adapters/driven/catalog-tables-tea-prices.ts
import { teas, prices } from "@tea/catalog/published"; // Drizzle tables in catalog's Offer
export const catalogTablesTeaPrices = (db: NodePgDatabase): TeaPrices => ({
  priceOf: async (ids) => {
    const rows = await db.select({ id: teas.id, cents: prices.amountCents })
      .from(teas).innerJoin(prices, eq(prices.teaId, teas.id)).where(inArray(teas.id, ids));
    return new Map(rows.map((r) => [teaId(r.id), Money.cents(r.cents)]));
  },
});
// checkout/adapters/driven/pg-checkout-unit.ts, inside placeOrder's transaction
await tx.select().from(stockLevels).where(inArray(stockLevels.teaId, ids)).for("share");
```

Variant B2, the view replica: `create view checkout.tea_replica as select id, name,
amount_cents as price from catalog.prices ...`. It is "kept under the owner's ids and projected
into this system's terms" and lags by zero.

### Properties

- **P1 holds.** Every domain is its own; the row mapping lives in adapters.
- **P2 holds.** No rules live in SQL.
- **P3 holds.** The cut is by context.
- **P4 holds.**
- **P5 holds.** "only through ports assembly hands it; each port speaks the system's terms":
  `TeaPrices` is checkout's port, and only the adapter behind it knows the tables.
- **P6 holds.** Fakes stand in for the ports.
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds, and more strongly than with calls.** The `FOR SHARE` lock makes the stock read
  "still hold" at commit. On the second clause, "fail each other only where a business rule
  ties them": Inventory's restock waits on checkout but does not fail, and a restock and a
  checkout of one tea are tied by the stock rule.
- **P11 hinges on "through".**
  - The first clause, "No other system changes the records a system owns", holds: writes stay
    with each owner.
  - The second clause, "or reads them except through its published language", depends on the
    reading. If "through" means "in the terms of", the table schema is among "the schemas ...
    its open host service's driving ports ... return" (glossary: Published language), so it
    holds.
  - If "through" means "by way of the open host service or published messages", it fails.
  - Verdict: holds under the first reading.
- **P12 holds.** Checkout translates rows into its own terms, by choice.
- **P13 holds.** "changes its model without its downstream systems changing": catalog's model
  moves while its repository keeps the published tables still.
- **P14 holds.** Tables change only by addition.
- **P15 holds, and more strongly than with calls.** Catalog's process can be down and checkout
  still reads its tables. When the shared Postgres is down, everything stops, but the store is not
  "another system", so P15 is silent there.
- **P16 hinges on "spans".** The transaction belongs to checkout's use case and writes only
  checkout's records, but it reads and locks Inventory's. If "spans" means writes, it holds; if it
  means touches, it fails. Verdict: holds under the first reading.
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**
- **Variant B2** fails P11 under the channel reading, like B, and holds under the terms
  reading. It meets the glossary's Replica on every word except "refreshed from what the owner
  publishes", which in turn hinges on whether a table is "published".

Why alone:

- P11's Why ("the owner's business rules, which decide what a record means, are bypassed")
  refuses B: checkout reads raw `prices` where catalog's rule would pick the regional price.
- P16's Why ("commits only where both systems' business rules and code let it") refuses the
  `FOR SHARE` lock.
- P13's Why does not refuse B, since the published tables do hold still.

### Forces

- **F1 not withstood.** "What serves a port is replaced": catalog cannot replace or split its
  store (move prices to another database, rename a table) without checkout's adapter breaking.
  Catalog's store is no longer its own.
- **F8 not withstood.** Catalog's physical schema is its published language, so every index,
  partition or column choice is a contract.
- **F6 strained.** Locks cross systems: Inventory's use cases wait on checkout's transactions.
- **F3 not withstood.** An agent editing catalog's repository sees nothing that says checkout
  reads the table.
- Withstands F7 better than A.

## Design: C. One system owns everything

### Design

One bounded context, "Shop", runs as one process with one Postgres. Its domain modules are
`catalog/`, `cart/`, `checkout/`, `billing/`, `shipping/`, `loyalty/` and `wholesale/`. One
glossary of about 400 terms keeps each term to one meaning by prefixes: `RetailOrder`,
`WholesaleOrder`, `InvoiceableOrder`, `ShippableParcel`.

Modules import each other's domain types and functions freely, for example `billing/invoice.ts`
imports `checkout/retail-order.ts`. Aggregates are small. Stripe and DHL sit behind
anti-corruption layers. Every team works in the one domain package.

### Properties

- **P1 holds.**
- **P2 holds.** Each rule is written once.
- **P3 holds on the heading, depending on "apart".** "rules that change for different reasons
  stay apart": billing's rules sit in `billing/` and checkout's in `checkout/`, so they are
  apart as folders. The heading does not say whether "apart" also forbids `billing` importing
  `checkout`'s `RetailOrder`.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.** One store makes every use case's writes land together.
- **P8 holds.**
- **P9 holds.**
- **P10 holds.** Aggregates are small.
- **P11 holds.** The only other systems are Stripe and DHL, which keep their own records.
- **P12 holds.** The anti-corruption layers are a choice.
- **P13 holds vacuously.** No system of this codebase is downstream.
- **P14 holds.**
- **P15 holds.** The only other systems are Stripe and DHL. Stripe is needed now for a charge.
  DHL booking runs asynchronously.
- **P16 holds vacuously.**
- **P17 holds** for the work with Stripe and DHL.
- **P18 holds.**
- **P19 holds by renaming.** "each term has one meaning": `RetailOrder` and `InvoiceableOrder`
  are two terms. The heading asks for one meaning per term, not one model per system.

Why alone:

- P3's Why ("A billing change that reaches checkout through a shared `Order` edits code that had
  no reason to change") refuses the cross-module imports.
- P3's Why ("also where a system splits once the business domain is better known") hints at a
  split but does not require one.
- P19's Why ("Renaming one, or splitting the system, ends it") accepts renaming as a remedy as
  good as splitting.

### Forces

- **F2 not withstood at size.** "the cut between systems moves": there is no cut to move, and
  a change to wholesale rules runs through modules retail also imports.
- **F3 not withstood at size.** An agent reading `checkout/` cannot know that billing and
  shipping import `RetailOrder`.
- Withstands F1 and F4–F9; there are few other systems for them to act on.
- For a small tea shop, C may be the right design, and P3's provenance ("start with wider
  boundaries") points that way. The finding is only that nothing says when it stops being right.

## Design: D. Everything in one shared kernel

### Design

Catalog, Checkout, Billing and Shipping are separate systems, each with its own process, store,
services, ports and adapters. Every domain type and every business rule sits in `@tea/kernel`,
and each system's `domain/` re-exports it.

The systems talk by events whose payloads are kernel types. Each store holds kernel-shaped
records. A change to the kernel redeploys everything; the glossary already says "A change to it
is a change to each".

```ts
// packages/kernel/src/order.ts
export type Order = { id: OrderId; lines: OrderLine[]; status: OrderStatus; invoice?: InvoiceDraft; shipment?: ShipmentPlan };
export const totalOf = (o: Order, tier: Tier): Money => /* pricing rule */;
export const invoiceFor = (o: Order, country: Country): InvoiceDraft => /* billing rule */;
export const canShip = (o: Order): boolean => /* shipping rule */;
// billing/src/domain/index.ts
export * from "@tea/kernel";
// checkout publishes
type OrderPlaced = { id: MessageId; order: Order };
```

### Properties

- **P1 holds.**
- **P2 holds.** "lives in one place: the domain": each rule lives once, in the kernel, which the
  glossary says each system imports "into its domain".
- **P3 holds on the heading, depending on "apart".** `invoiceFor` and `canShip` sit in
  different files of one package.
- **P4 holds.**
- **P5 holds.** The kernel is a choice of each domain, not "outside".
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds, depending on "owns".** The Owner entry reads "The system whose business rules
  decide what a record holds". The rules that decide an order are kernel rules, imported into
  every system's domain, so every system is owner and "no other system" is empty. Even with one
  owner per record, writes stay in each store and reads go through events in the published
  language, which is kernel types.
- **P12 holds.** "only by choice": the kernel was chosen.
- **P13 has two readings.**
  - If billing's model is the kernel, billing changing it changes checkout, which handles
    billing's events and so is downstream. Under this reading P13 fails.
  - If the kernel is "a model several systems share" and not billing's own, billing has no model
    of its own to change, and P13 holds vacuously.
  - A third way out: the glossary's System is "code with its own domain". Billing has none, so it
    is not a system, and D is one system "run as one or more processes" (Scope). Then P11, P13
    and P16 are all vacuous.
  - Verdict: holds under the second and third readings.
- **P14 holds.** Kernel changes stay compatible across versions.
- **P15 holds.** Communication is by events.
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.** The kernel gives every term one meaning everywhere, which is stronger than P19
  asks for.

Why alone:

- P3's Why (the shared `Order`) and P13's Why ("A downstream system that reads this one's model
  breaks at every refactoring here") refuse D.
- P12's Why ("each change there is a change here, found late") half refuses it: the changes are
  found early, but they still come.

### Forces

- **F2 not withstood.** A billing rule change edits and redeploys every system.
- **F8 not withstood by construction.** Every system changes on every other's schedule.
- **F3 not withstood.** An agent editing `canShip` edits checkout's domain too.
- **F4 strained.** Mixed versions read kernel-shaped events.
- Withstands F1, F5, F6, F7 and F9.

## Design: E. Entity services under one orchestrator

### Design

Five entity systems each own one table: Teas, Customers, Orders, Stock and Payments (Stripe
behind it). Each offers `create`, `get`, `update(id, patch, expectedVersion)` and `delete`, and
publishes `XUpdated` events. Each domain is the record type plus field checks: `onHand >= 0`,
email format.

One system, "Shop", holds every business rule: pricing, discounts, availability, the order
lifecycle and loyalty. It holds them as process managers, in the glossary's sense of
Orchestration. Shop keeps replicas of the entity systems from their events. Each step writes the
process manager's state and outbox commands in one Shop transaction, and the commands carry
`expectedVersion`.

```ts
// shop/domain/place-order-process.ts
export const decide = (p: PlaceOrderProcess): Decision => {
  switch (p.step) {
    case "pricing":
      return { step: "reserving", send: [orders.update(p.orderId, { totalCents: totalOf(p.lines, p.tier).cents, status: "priced" }, p.orderVersion)] };
    case "reserving":
      return { step: "charging", send: [stock.update(p.teaId, { onHand: p.onHand - p.qty }, p.stockVersion)] };
    case "charging":
      return { step: "done", send: [payments.create({ orderId: p.orderId, amountCents: p.totalCents })] };
  }
};
```

### Properties

- **P1 holds.** Each domain models its slice. Shop's models the business.
- **P2 holds.** "lives in one place: the domain": all rules sit in Shop's domain.
- **P3 holds on the heading.** "sit together": every rule is in Shop. "Stay apart" is met by
  Shop's modules.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds, depending on "a use case's writes" and "own".** Each Shop use case writes its
  process state and outbox in one transaction. The stock and order writes are use cases of Stock
  and Orders, one write each. If "a use case's writes" includes the writes its commands cause in
  records Shop owns (Shop's rules decide `onHand` and `totalCents`), P7 fails. Under the plain
  reading it holds.
- **P8 holds.** Commands go out through the outbox.
- **P9 holds.** Commands carry ids and versions.
- **P10 holds.** `expectedVersion` makes Stock refuse a stale decision. Two orders for different
  teas touch different stock records.
- **P11 hinges on "changes".**
  - The Owner entry reads "The system whose business rules decide what a record holds, wherever
    it is kept", so `stock_levels.onHand` is Shop's, kept by Stock.
  - "No other system changes the records a system owns": Stock performs the write.
  - If "changes" means "performs the write", P11 fails. If it means "decides the change", P11
    holds.
  - The glossary separates owner from keeper ("A store may keep records of several owners"), and
    a keeper must write. That leans towards "decides": otherwise every case where owner and
    keeper differ fails P11.
  - Verdict: holds.
- **P12 holds.**
- **P13 holds.** The entity systems are upstream and their published languages stay still.
- **P14 holds.**
- **P15 holds.** Shop answers from its replicas. Steps wait in the process manager while an
  entity system is down.
- **P16 holds.**
- **P17 holds.** Process managers end in completed or compensated states.
- **P18 holds.** Versions settle the order of updates.
- **P19 holds.** Shop renames: `RetailOrder`, `InvoiceLine`.

Why alone:

- P11's Why ("Where another system writes the records this one owns, this one's business rules
  stop holding for them") refuses E under the "performs" reading.
- P1's Why ("a domain that is the vendor's model with nothing of its own has no business rules
  left to protect") describes the entity systems, but it is said of conformists.

### Forces

- **F2 not withstood.** Every business change lands in Shop. Every new field needs an entity
  system to change for Shop's reasons, so the upstream "changes on its own terms" is false in
  practice.
- **F8 inverted.** The upstreams exist only to serve one downstream.
- **F7.** Shop is a single point through which every business use case passes. It is "this
  system", so F7 does not name it.
- **F6.** Read-modify-write across systems by version means retries under contention.
- Withstands F1, F3 (partly), F4, F5 and F9.

## Design: F. Pinball choreography

### Design

The systems are Checkout, Inventory, Billing, Loyalty, Shipping and Notifications. No one holds
the sequence. Each reaction is a policy in the reacting system's domain:

| Event | Handled by | Does | Emits |
| --- | --- | --- | --- |
| (none) | Checkout | `placeOrder` | `OrderPlaced` |
| `OrderPlaced` | Inventory | reserves stock | `StockReserved` or `StockShort` |
| `StockReserved` | Billing | captures payment | `PaymentCaptured` or `PaymentDeclined` |
| `PaymentDeclined` | Inventory | releases stock | |
| `StockShort`, `PaymentDeclined` | Checkout | cancels the order | `OrderCancelled` |
| `PaymentCaptured` | Loyalty | awards points | `PointsAwarded` |
| `PointsAwarded` | Shipping | books DHL (the label prints the points balance) | `ShipmentBooked` |
| `ShipmentBooked` | Notifications | sends the mail | |
| `ShipmentBooked` | Inventory | commits stock | |
| `OrderCancelled` | Billing | refunds | |
| `OrderCancelled` | Loyalty | revokes points | |
| `OrderCancelled` | Shipping | cancels the booking | |

Payloads accrete: `StockReserved` carries the order total because Billing needs it.

```ts
// shipping/domain/policies.ts
export const onPointsAwarded = (e: PointsAwardedV3, known: OrderFacts): ShippingDecision =>
  known.cancelled(e.orderId) ? { kind: "ignore" } : { kind: "book", orderId: e.orderId, labelNote: `${e.balance} points` };
```

### Properties

- **P1 holds.**
- **P2 holds, depending on "a business rule".** The business's rule is "ship only paid orders,
  after awarding points". It lives as two policies, Loyalty's `onPaymentCaptured` and Shipping's
  `onPointsAwarded`. If each policy is a business rule, each "lives in one place"; if the flow is
  one rule, it lives in three. Granularity is the designer's call. Verdict: holds.
- **P3 is contestable.** "rules that change together sit together": when the business makes
  subscribers ship before payment, Billing, Loyalty and Shipping change together and P3 fails.
  At design time a designer can call each policy its system's own reason, and the heading cannot
  be judged without the change.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.**
- **P13 holds.** Events are versioned.
- **P14 holds.**
- **P15 holds.** Everything is asynchronous.
- **P16 holds.**
- **P17 holds with care.** Every system compensates on `OrderCancelled`. "Ends" excludes cycles,
  so the flow has none.
- **P18 holds.** Billing records a cancel that arrives before `StockReserved` and refuses the
  later charge.
- **P19 holds.**

Why alone:

- P3's Why ("A business change made across several systems needs all of them to change in step")
  refuses pinball once the flow changes.
- The glossary's Choreography ("No one holds the whole sequence") is offered as a legitimate
  option, so nothing binding separates choreography from pinball.

### Forces

- **F2 not withstood.** The flow is the business, and changing it means coordinated edits across
  four systems.
- **F3 not withstood.** An agent editing Shipping's trigger cannot see that Notifications and
  Inventory depend on `ShipmentBooked`'s timing.
- **F8 strained.** Each system handles two to four upstreams' events, and the payloads grow.
- Withstands F1, F4, F5, F6, F7 and F9.

## Design: G. Ports looked up from an ambient registry

### Design

A process-wide container is an ambient value "set once for the process's life". Assembly
registers every implementation, and services resolve ports by token at call time. Tests
re-register fakes.

```ts
// checkout/assembly.ts
container.register(OrderRepository, { useFactory: () => new PgOrderRepository(pool) });
container.register(PaymentAuthorizer, { useFactory: () => new StripeAuthorizer(stripe) });
// checkout/service/place-order.ts
export async function placeOrder(cmd: PlaceOrder): Promise<OrderPlaced> {
  const orders = container.resolve(OrderRepository);
  const payments = container.resolve(PaymentAuthorizer);
  // ...
}
```

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.**
- **P4 holds.** Whatever is registered serves the use case alike.
- **P5 hinges on "hands".** "only through ports assembly hands it": assembly registered the
  implementation, the port meets its implementation only in assembly (glossary: Assembly, "the
  only place where port and implementation meet"), and the service reads only what assembly put
  there. If "hands" means "makes available", P5 holds. If it means "passes as an argument", P5
  fails. The heading does not say "as arguments".
  - The glossary's Courier ("when assembly cannot hand it over as an argument") implies the
    argument reading, but only in passing, and a courier is itself free to be a registry.
  - Verdict: holds.
- **P6 holds.** `container.register(OrderRepository, { useValue: fakeOrders })`. The heading
  says nothing about tests sharing a global.
- **P7 holds.**
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

Why alone: P5's Why ("A port the system finds for itself, read from a registry, is in no
signature, and what serves it changes where nobody looks") refuses G word for word.

### Forces

- **F3 not withstood.** A service's signature no longer says what it reaches. An agent adds
  `container.resolve(StripeClient)` to a domain function, and the only guard is the glossary's
  word "pure".
- **F1 strained.** Re-registering at run time changes what serves a port where nobody looks.
- Withstands F2 and F4–F9.

## Design: H. Vendor-shaped domain

### Design

Checkout declares Postgres-through-Drizzle an external system: "a bounded context whose code this
codebase does not write ... in its own process or in ours". Checkout is its conformist: "its
published language is used untranslated, in any layer including the domain".

Domain types are Drizzle-inferred rows, and business rules are written over them. Driving ports
take hand-written command types, so the glossary's driving port, "in the system's terms, not its
store's", is not engaged. Driven ports such as `OrderRepository.save(o: Order)` take rows.

The variants:

- Framework: NestJS with TypeORM entity classes as domain classes (`extends BaseEntity`, column
  decorators).
- Carrier: `Stripe.PaymentIntent` as the order's payment state.

```ts
// checkout/domain/order.ts
import type { InferSelectModel } from "drizzle-orm";
import type { orders, orderLines } from "../adapters/driven/pg/schema";
export type Order = InferSelectModel<typeof orders> & { lines: InferSelectModel<typeof orderLines>[] };
export const canCancel = (o: Order): boolean => o.status === "placed" && o.shipped_at === null;
```

### Properties

- **P1 holds through the Except.** "Except: the terms of an upstream this system conforms to
  (P12); its business rules stay its own, written in those terms": Drizzle/Postgres is the
  upstream, and `canCancel` is checkout's own rule in Drizzle's terms.
- **P2 holds.**
- **P3 holds.**
- **P4 holds.** "responds the same ... whatever serves it": the fakes return Drizzle row shapes
  and responses are equal. Replacing Postgres would rewrite the domain, but the heading speaks of
  responses, not code.
- **P5 holds.** "each port speaks the system's terms": by conformity, Drizzle's terms are the
  system's.
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.** "only by choice": a written choice to conform.
- **P13 holds.** Events are hand-written. The model is the table, and the published language
  holds still.
- **P14 holds.**
- **P15 holds.**
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**

Why alone: P1's Why ("Shaped by a store, a framework or a carrier, the domain changes when one is
replaced") refuses H. Its other sentence ("a domain that is the vendor's model with nothing of its
own") does not, since the rules stay checkout's own.

### Forces

- **F1 not withstood.** Replacing Postgres, splitting a table or a major Drizzle upgrade that
  changes inference rewrites the domain and its rules.
- **F8.** If the store is an upstream, it now "changes on its own terms", that is, on the ORM's
  release schedule.
- Withstands F2–F7 and F9.

## Design: I. Business model in the common library

### Design

`@tea/common` is "a package of no system that every system may import". It holds `Money`,
`Tea`, `Order`, `OrderStatus`, `vatFor(country, net)`, `loyaltyTierFor(points)` and
`isShippable(order)`. Every system's domain imports it.

Unlike a shared kernel, there is no "agree on together": any team edits it. Services also call
`vatFor`, claiming the P5 Except.

```ts
// packages/common/src/tax.ts
export const vatFor = (country: Country, net: Money): Money => net.times(VAT_RATES[country]);
// billing/src/domain/invoice.ts
import { vatFor, type Order } from "@tea/common";
```

### Properties

- **P1 holds.**
- **P2 holds, depending on "lives".** "lives in one place: the domain": the rule is written once,
  in the library, and imported into domains. If an imported rule "lives" in the importing domain,
  as the glossary's Shared kernel ("each importing it into its domain") implies, P2 holds. If not,
  P2 fails, but then every shared kernel fails P2 too. Verdict: holds.
- **P3 holds on the heading, depending on "apart".** `vatFor` and `isShippable` are separate
  functions.
- **P4 holds.**
- **P5 holds.**
  - The common library is not "outside" (glossary: "Other systems and third parties"; this is our
    code and "of no system"), so the domain importing it does not engage P5.
  - Services calling `vatFor` claim the Except, "whose output changes neither how a use case acts
    nor what it answers". `vatFor` changes what the use case answers, so for services the Except
    fails. Routing the call through the domain avoids the question.
  - Verdict: holds.
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.** "Another system's model": the common library is no system, so P12 is silent.
- **P13 holds.** A change to the library is not "a system changes its model", so P13 is silent.
- **P14 holds.**
- **P15 holds.**
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.** Within each system, `Order` has one meaning: the library's.

Why alone: P2's Why ("A business rule anywhere else ... is one a reader of the domain misses")
half refuses I: the reader sees the import. No other Why touches it.

### Forces

- **F2 not withstood.** A VAT change edits a package nobody owns and every system imports.
- **F3 not withstood.** An agent fixing `isShippable` for Shipping changes checkout's behaviour.
- **F8 not withstood in effect.** It is not named, because the library is no "other system".
- Withstands F1 and F4–F7, F9.

## Design: J. Tooling side door

### Design

`tools/nightly-invoicing.ts` runs from a CI cron, so it "runs in no process of the deployed
application", which is the glossary's Tooling. It imports billing's pure domain and both systems'
Drizzle schemas. It reads paid orders from checkout's tables, writes invoices into billing's and
sets `orders.invoiced_at`, in one transaction on the shared Postgres (or two, on two databases).

It publishes no `InvoiceIssued`; billing's outbox is not written. Alongside it, `tools/fix-stock.ts`
lets ops set stock levels by hand, and `tools/kpi-export.ts` reads every table for BI.

```ts
// tools/nightly-invoicing.ts
import { invoiceFor } from "@tea/billing/domain";
import { orders } from "@tea/checkout/adapters/driven/pg/schema";
import { invoices } from "@tea/billing/adapters/driven/pg/schema";
await db.transaction(async (tx) => {
  const due = await tx.select().from(orders).where(and(eq(orders.status, "paid"), isNull(orders.invoicedAt)));
  for (const o of due) {
    await tx.insert(invoices).values(invoiceRow(invoiceFor(orderFromRow(o))));
    await tx.update(orders).set({ invoicedAt: new Date() }).where(eq(orders.id, o.id));
  }
});
```

### Properties

- **P1 holds.**
- **P2 holds.** The tool calls billing's domain, so rules are not copied.
- **P3 holds.**
- **P4 holds.** Invoicing is not a use case, so P4 is silent on it.
- **P5 hinges on "outside".** "A system ... is reached from it [the outside], only through ports":
  tooling is neither "other systems" nor "third parties", so it is not outside, and its import of
  billing's domain and its writes to billing's tables do not engage P5. Verdict: holds.
- **P6 holds.**
- **P7 holds.** "A use case's writes": the tool is not a use case.
- **P8 hinges on "follows".** "nothing that follows from it is lost after": nothing was ever made
  to follow, since the tool emits nothing. If the business requires a mail on invoicing, one can
  argue it "follows" and is lost. Under the narrow reading P8 holds.
- **P9 holds.**
- **P10 holds, provided the tool bumps the version column.** If it does, checkout's `cancelOrder`
  version check still catches the race. Otherwise checkout's use case commits on a read that no
  longer holds, and P10 fails for checkout. The design bumps it.
- **P11 holds.** "No other system changes the records a system owns": tooling is not a system.
  `kpi-export` reads past the published language, and that is not "another system" either.
- **P12 holds.**
- **P13 holds.**
- **P14 holds.**
- **P15 holds.**
- **P16 holds.** "No transaction spans two systems": the transaction is the tool's, which is no
  system. Under the reading where the records' owners count, it spans two and fails. Verdict:
  holds.
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**

Why alone:

- P11's Why ("this one's business rules stop holding for them") refuses J.
- P2's Why lists "a store trigger, a hook, a service", but not tooling.

### Forces

- **F3 not withstood.** An agent changing billing's schema or rules cannot see that the tool
  writes the tables.
- **F4 not withstood.** If the tool stops between two databases' transactions, half the orders are
  invoiced.
- **F8.** Billing's schema change breaks the tool.
- **F2.** The invoicing rule's trigger lives outside every system.
- Withstands F1, F5, F6, F7 and F9.

## Design: K. Lying fakes

### Design

Every driven port has a fake that always succeeds and remembers nothing:

```ts
const fakeOrders: OrderRepository = { load: async () => undefined, save: async () => {} };
const fakeStock: StockLevels = { levels: async () => new Map(), reserve: async () => ({ ok: true }) };
```

The default suite runs every use case against these fakes. There are no integration tests.

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.**
- **P4 fails.** "responds the same ... whatever serves it": the fake serves the use case, and
  `placeOrder` then `orderStatus` answers "not found" with the fake and "placed" with Postgres. A
  fake that never raises a version conflict also answers differently from the store under
  overlap.
- **P5 holds.**
- **P6 holds on its heading.** "can run with nothing outside the process, in a test": it runs.
- **P7 holds.**
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
- Glossary: Fake reads "A working implementation"; "working" has two readings (it runs, or it
  behaves).

Why alone: P6's Why ("What stands in for the outside behaves as the outside does wherever the use
case can tell, or a passing test proves nothing") refuses K, but P4's heading already binds it.

### Forces

- **F1 not withstood in practice.** Nothing checks that a real adapter matches its fake.
- **F3.** Edits are "verified" by tests that cannot fail.
- K is caught on a heading (P4). It is listed to show that the binding sits in P4, not in P6.

## Design: L. Global serialization

### Design

Every acting use case of checkout begins with `select pg_advisory_xact_lock(42)`. No other
system is called while the lock is held (tentative operations come before it), and there is no
`lock_timeout`. All checkouts, address changes and cart edits run one at a time.

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.**
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds, depending on "fail".** "commits only on reads that still hold": every read still
  holds. "fail each other only where a business rule ties them": no use case fails, they wait.
  If "fail" includes "wait", P10 fails. Once the driving adapter's HTTP timeout turns a wait into
  a failure, P10 fails too. Verdict: holds.
- **P11 holds.**
- **P12 holds.**
- **P13 holds.**
- **P14 holds.**
- **P15 holds.** No other system is called under the lock. With a Stripe call inside the lock,
  `updateAddress` would wait on a slow Stripe and P15 would fail.
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**

Why alone: P10's Why ("Two checkouts of different teas that fail each other were tied by the
code, not the business") would refuse L if "fail" were read broadly.

### Forces

- **F6.** "Callers overlap": the design answers F6 by refusing overlap. That is withstood
  literally and defeated in effect.
- The doc's Scope puts "throughput and load" out of scope, which covers most of L's harm. What
  remains in scope is that a slow use case of one kind stalls unrelated ones: a coupling no
  business rule asked for.

## Design: M. Commands dressed as events

### Design

Checkout publishes `ShipmentRequested { orderId, address, parcels }`, Returns publishes
`PickupRequested`, and Wholesale publishes `PalletShipmentRequested`. Shipping subscribes to all
three, "no receiver can refuse" an event, and on failure it publishes `ShipmentRequestFailed`.

Each requester's published language decides what Shipping must understand, so Shipping is
downstream of every system that wants something shipped. Shipping translates each one in its own
anti-corruption layer.

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.** Shipping's rules sit in Shipping.
- **P4 holds.**
- **P5 holds.**
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.** "only by choice": one anti-corruption layer per requester.
- **P13 holds.** Checkout changes its model while `ShipmentRequested` stays still.
- **P14 holds.**
- **P15 holds.**
- **P16 holds.**
- **P17 holds.** The failure event ends the work in an allowed state.
- **P18 holds.**
- **P19 holds.**
- Glossary: an event "says something happened". A request having happened is something that
  happened, so it qualifies.

Why alone: no Why refuses M.

### Forces

- **F8 not withstood.** It multiplies on the system that does the work: every requester's schedule
  becomes Shipping's.
- **F2 not withstood.** A new service level (express) must enter three requesters' events before
  Shipping can offer it.
- Withstands F1, F3–F7 and F9.

## Design: N. Unversioned open host service, lockstep deploy

### Design

Catalog's open host service `GET /teas/:id` returns `{ id, name, priceCents }`. One deploy
changes it to `{ id, name, price: { amount, currency } }`. Catalog's events and records are
versioned with care, so P14 holds for them.

During the rolling deploy (F4), half of catalog's processes answer in the old shape and half in
the new, and checkout's adapter breaks on one of the two. In the lockstep variant, all published
languages live in `@tea/contracts` and the fleet deploys together.

### Properties

- **P1 holds.**
- **P2 holds.**
- **P3 holds.**
- **P4 holds.**
- **P5 holds.** Checkout's port is in its own terms; only its adapter breaks.
- **P6 holds.**
- **P7 holds.**
- **P8 holds.**
- **P9 holds.**
- **P10 holds.**
- **P11 holds.**
- **P12 holds.**
- **P13 holds.** "changes its model without its downstream systems changing": catalog changed its
  published language, and P13 speaks only of the model.
- **P14 holds.** "A record or a message": a response is neither. The glossary's Message "has an
  id, the same on every delivery", and a response has none.
- **P15 holds.** "while other systems are down or slow": catalog is up and fast, it just answers
  differently.
- **P16 holds.**
- **P17 holds.**
- **P18 holds.**
- **P19 holds.**

Why alone:

- P13's Why ("The published language holds still while the model moves") refuses N.
- P14's provenance (Khononov on multiple versions of the published language) refuses it as well.

### Forces

- **F8 not withstood.** It is exactly F8: "published language change[s] on its schedule".
- **F4 not withstood.** Old and new processes answer differently during a deploy.
- The lockstep variant gives up F4's "one at a time" and replaces it with all at once.

## Findings

### 1. P15's exception is unbounded, and P10 pushes toward live reads

From A and E.

**What is missing.** "unless a business rule needs another system's answer now" admits any rule
that says "current", and the glossary's Business rule gives no test for a real one. P10 makes it
worse: a read of another system never "still holds" at commit (P16), so it stands only where "a
business rule accepts" staleness. The default is therefore the freshest read, which means a live
call.

**Proposed P15:**

> ### P15. A use case works while other systems are down or slow
>
> *Except:* a business rule that needs another system to act now, as the payment provider to
> charge; needing another system's data fresher than it publishes it is no such rule.
> *Against:* F7.

**Proposed P10 heading:**

> A use case commits only on reads that still hold, or on stale ones a business rule accepts;
> what it read of another system is stale. Use cases fail each other only where a business rule
> ties them.

**Makes redundant:** P15's Why sentence "A use case needing only data this system keeps, replicas
included, runs anyway."

### 2. P11 names a language where it means a channel

From B.

**What is missing.** "reads them except through its published language" is met by reading the
owner's tables whose schema the owner declared published.

**Proposed change:** "... or reads them except through its open host service and the messages it
publishes". The full rewrite is in finding 6.

**Makes redundant:** P11's Why sentence "A system that reads them past the owner's published
language breaks at the owner's next schema change".

### 3. A system's store is not protected as its own; P16 counts only writes

From B and H.

**What is missing.** No property lets a system replace its store (F1) without others changing.
P13 protects only the model. P16's "spans" lets one system's transaction lock another's records.

**Proposed P13:**

> ### P13. A system changes its model and its store without its downstream systems changing

**Proposed P16:**

> ### P16. No transaction reads or writes the records of two systems
>
> *Against:* F6, F8.

**Makes redundant:** nothing. The new P13 subsumes part of P11's Why ("breaks at the owner's next
schema change").

### 4. "Apart" in P3 is undefined, and nothing bounds a system or a shared model

From C, D and I.

**What is missing.** "stay apart" is met by separate files that import each other's types. The
harm P3's Why names (the shared `Order`) is not in the binding text.

**Proposed P3:**

> ### P3. Business rules that change together sit together; code that changes for one reason imports nothing that changes for another
>
> *Against:* F2, F3.

**Makes redundant:** P3's Why sentence "A billing change that reaches checkout through a shared
`Order` edits code that had no reason to change."

**Optional, for C:** a force for the people side, which the doc otherwise omits:

> **F10. Work on the code is divided.** Several people change different parts at once, each
> answerable for theirs.

With it, C becomes testable: a system larger than one group can answer for fails a property built
on F10. This is weak; C may be meant to stand, since P3's provenance says "start with wider
boundaries".

### 5. Shared code has no bound: the shared kernel and the common library can hold every rule

From D and I.

**What is missing.** The glossary defines the shared kernel and the common library, but no
property limits what either holds. The common library is neither "outside" (P5) nor "another
system's model" (P12), so business rules in it pass every property.

**Proposed new property:**

> ### P20. Systems share as code only what changes for all of them together
>
> *Except:* the common library, which holds no business rule and no term of a domain.
> *Against:* F2, F8.

**Proposed P2 heading:**

> A business rule lives in one place: the domain of one system, or a shared kernel its systems
> agree on

**Makes redundant:** P5's Except becomes clearer (the common library holds nothing a use case
answers by). Part of P3's Why.

### 6. Records can be changed by code that is not the owner's use case

From E, J and the writes in B.

**What is missing.** P11 binds "other system[s]" only.

- Tooling is no system, so it writes freely (J).
- An entity system writing records whose rules are Shop's passes when "changes" is read as
  "decides" (E), and the owner/keeper split in the glossary favours that reading.
- The glossary's Owner says "The system", but a shared kernel makes it many systems (D).

**Proposed P11:**

> ### P11. Only the owner's use cases change a record, and no code outside the owner reads it except through the owner's open host service and the messages it publishes
>
> *Except:* records an external system keeps for this one, changed as the configuration this
> system wrote decides; a migration of the owner's that keeps what a record means (P14).
> *Against:* F3, F8.

**Proposed glossary change, Owner:** "The one system whose business rules decide ..."

**Makes redundant:** P11's Why sentence "Where another system writes the records this one owns,
this one's business rules stop holding for them", and finding 2's sentence change.

### 7. Nothing tells choreography from pinball

From F.

**What is missing.** The glossary allows "No one holds the whole sequence". No property says
where a sequence the business orders must live, and "a business rule" has no granularity, so one
flow can be cut into per-system policies.

**Proposed new property:**

> ### P21. A sequence across systems that a business rule orders is held by one system; a system reacts to another's event only for a business rule of its own
>
> *Against:* F2, F3.

**Makes redundant:** P3's Why sentence "A business change made across several systems needs all
of them to change in step" (for flows).

### 8. "Assembly hands it" admits a registry

From G.

**What is missing.** The heading does not say "as arguments". The glossary's Courier is the only
hint, and a courier is unconstrained.

**Proposed P5 heading:**

> A system reaches the outside, and is reached from it, only through ports it receives from
> assembly as arguments, or, in a driving adapter, by courier; each port speaks the system's
> terms

**Proposed glossary change, Courier, add:** "It carries what assembly produced to one process's
driving adapters, and no other code reads it."

**Makes redundant:** P5's Why sentence "A port the system finds for itself, read from a registry,
is in no signature, and what serves it changes where nobody looks."

### 9. A store, an ORM or a framework can be declared an upstream and conformed to

From H.

**What is missing.** The glossary's External system ("in its own process or in ours") admits an
ORM or a database as a bounded context. P1's Except then admits their terms into the domain.

**Proposed P1 Except:**

> *Except:* the terms of an upstream system this one conforms to (P12), never those of what
> serves its own ports: its store, its framework, its runtime; its business rules stay its own,
> written in those terms.

**Proposed glossary change, Store, add:** "A store is no system."

**Makes redundant:** P1's Why sentence "Shaped by a store, a framework or a carrier, the domain
changes when one is replaced". Mind "carrier": DHL is an external upstream one may legitimately
conform to, so the Why and the Except disagree on carriers.

### 10. Tooling is not "outside"

From J.

**What is missing.** Tooling reaches a system's domain and store past every port, and no property
sees it.

**Proposed glossary change, Outside:** "Other systems, third parties, the operating system among
them, and tooling, whether they drive the system or it drives them."

With finding 6, J then fails on both P5 and P11.

**Makes redundant:** nothing.

### 11. Editorial: fake fidelity is bound by P4, not P6

From K.

**What is missing.** Nothing is missing; the binding is in a different place than P6's Why
suggests. P6's Why sentence "What stands in for the outside behaves as the outside does wherever
the use case can tell" restates P4's "whatever serves it".

**Proposed change:** cite P4 there, or move the clause into P6's heading:

> Every use case can run with nothing outside the process, in a test, and responds there as it
> does in production (P4)

**Glossary:** "working" in Fake has two readings.

### 12. "Fail each other" omits waiting

From L.

**What is missing.** Serializing unrelated use cases holds P10.

**Proposed P10 second clause:**

> use cases fail or wait on each other only where a business rule ties them

This is low priority, given that Scope puts throughput out.

### 13. Nothing says who defines how work is asked for

From M.

**What is missing.** A request dressed as an event makes the worker downstream of every
requester, and no property or Why objects.

**Proposed new property:**

> ### P22. What a system is asked to do is asked in its own published language
>
> *Against:* F2, F8.

**Proposed glossary change, Event:** "An *event* says something happened in the system that
publishes it; it asks no one to act."

**Makes redundant:** nothing.

### 14. The published language of calls has no stability property

From N.

**What is missing.** P14 covers "a record or a message", P13 the model. A response's shape can
break downstream at any deploy. Lockstep deployment is not ruled out either.

**Proposed P14 heading:**

> A record, a message, or anything of a published language means the same to all code that reads
> it, whenever it was written

**Proposed P13, combined with finding 3:**

> A system changes its model and its store, and deploys, without its downstream systems changing
> or deploying in step

**Makes redundant:** P13's Why sentence "The published language holds still while the model
moves."

## Words the designs hinged on

- **own / owner** (P7, P11; designs D and E). Is it the system whose rules decide, or the system
  that keeps the record? P7's "its own system's records" can be read either way. With a shared
  kernel, "The system whose business rules decide" is every system at once.
- **keeps** (Owner, Scope; designs B and E). "of a record no business rule decides, the system
  that keeps it": in a shared store, which system keeps? Is it the one that writes or the one
  whose schema it is? Scope's "Each system keeps its records in a store" suggests one store per
  system; the Owner entry says one store keeps records of several owners.
- **changes** (P11; designs E and J). Does it mean performs the write, or decides the change? The
  owner/keeper split forces "decides", which lets a keeper write on another system's say.
- **through** (P11; design B). Does it mean in the terms of the published language, or by way of
  the open host service and messages?
- **downstream / upstream** (P13; designs C, D and M). These are defined only "of two systems that
  talk". Systems that share a database or a kernel do not talk, so they have no downstream and P13
  is empty. Is a store an upstream (design H)? Is a requester of work upstream of the worker
  (design M)?
- **outside** (P5; designs I and J). "Other systems and third parties": is the common library
  outside? Is tooling? Is the store (Postgres, a third party) outside, and is it then a system?
  P5's Except treats the common library as outside, while the definition says it is not.
- **record** (P11, P14; design N). "What a store holds and a write changes": a call's response is
  no record. Is a cache in another process a store?
- **message** (P14; design N). "What one system tells another ... so that it may act" covers a
  response, but "It has an id, the same on every delivery" excludes it.
- **call** (Scope: "Systems reach each other through calls and messages"; designs B and J). It is
  undefined. Is a SQL read of another's table a call to that system?
- **hands** (P5; design G). Does it mean passes as an argument, or makes reachable?
- **apart** (P3; designs C, D and I). In different files, modules or systems? With or without
  imports between them?
- **spans** (P16; design B). Writes of two systems' records, or any reads and locks too? And is a
  transaction run by no system (tooling) spanning?
- **fail** (P10; design L). Do waiting and timing out count?
- **a business rule** (P2, P15; designs A and F). Granularity is free, so one flow can be counted
  as many rules. Is a rule the business holds different from one the designers wrote?
- **needs ... now** (P15; design A). Is it needs the other system to act, or needs its data
  fresh?
- **its model** (P13; design D). Does it include a shared kernel the system imports?
- **lives** (P2; design I). Written in, or imported into?
- **serves** (P1, P4; designs H and K). Is a fake what "serves" (P4 says yes in its Why)? Is a
  conformed-to store an upstream or what serves?
- **choice** (P12; design H). Any written choice qualifies; nothing weighs it.
- **follows / lost** (P8; design J). What never was made to follow cannot be lost.
- **working** (Fake; design K). Does it mean runs, or behaves like the real thing?

## Notes

- **Contradiction, external configuration vs P2.** The glossary's External system says "Its
  configuration may hold business rules this codebase writes". P2 says "A business rule lives in
  one place: the domain" and has no Except. Either P2 needs an Except for configuration this
  codebase writes in an external system's terms, or the glossary's sentence is barred.
- **P5's Except vs Outside.** By the glossary the common library is not outside, so the Except
  only matters if it is. The Except also covers only "a service or an adapter", leaving the
  domain's use of the library unaddressed, which is design I's route.
- **P10 and P16 together.** P16 guarantees that no read of another system still holds at commit.
  P10 then requires a business rule accepting that staleness on every cross-system decision, which
  the text does not say. Designs A (live calls) and B (cross-system locks) are both ways of
  dodging it.
- **P1's Why vs Except on carriers.** The Why names "a carrier" among what must not shape the
  domain, while the Except allows a conformed upstream, and a carrier is one.
- **Glossary System, "code with its own domain".** It makes D's systems arguably not systems, and
  E's entity systems arguably not systems either, which turns both designs into "one system run as
  several processes". The Scope allows that, and P11, P13 and P16 then go vacuous.
- **Style.** Two headings carry their exception in the heading instead of an Except: P10 ("or on
  stale ones a business rule accepts") and P15 ("unless a business rule needs ..."). Both are the
  loopholes in A.
- **Designs tried and caught on a heading.** Not written up in full:
  - Handlers that settle every message they fail on (swallowing): caught by P17 ("only in a state
    a business rule allows"), and arguably by P8 ("lost").
  - Content-based routing on the bus that decides which orders get manual review: caught by P2.
  - A conformist to Stripe, Shopify and DHL at once: caught by P19 (three meanings of
    "Customer").
  - Rules in stored procedures: caught by P2 and the glossary's Pure.
  - One aggregate per customer: caught by P10's second clause.
  - Sending mail before commit: caught by P8.
  - An external BI tool reading production tables: caught by P11, since it is an external system.
    The same done by tooling is design J.
  - Lying fakes (K): caught by P4.
- **Force coverage.** No design here breaks F5 or F9 that the properties do not already catch.
  The weak points are F1 (the store as anyone's contract: B, H), F2 and F3 (shared code and
  sequences: D, F, I) and F8 (published language of calls: N, M).
