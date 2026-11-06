# Implementer review, distilled set (property rules)

Read: `reviews/05/distilled.md` and `domain.md`, nothing else. Rule ids are the property ids (P1..P19).
Package names are `@teeladen/<name>`; paths are relative to the repository root.

## Summary

- **No cannot-comply found.** Every fixture situation has code that follows every rule whose
  Scope holds; where the fixture names a mechanism the rules refuse (ambient unit of work,
  `afterChange` calling shop, dashboard join, Local API at checkout) a compliant placement exists.
- **Tension T1, catalog's sku veto (P2, P3, P10, P11, P16).** `beforeChange` asking shop makes shop
  an owner of the product's sku (P2's Why: a system that has to be asked owns the record), while
  catalog's config also decides the sku (unique) and the table says catalog owns it; Owner is
  singular (P3). Complying costs either dropping the veto (orders keep a sku snapshot) or moving the
  sku to shop, kept in Payload under P11's second sentence, with locks or a stale rule for the race.
- **Tension T2, gapless invoice numbers (P7, P8, P10).** One aggregate per use case forbids
  incrementing a number series and issuing the invoice in one commit. Complies via an
  `InvoiceSeries` counter aggregate whose number travels by message to a draft invoice: two hops,
  a draft state the business never had, a hot row.
- **Tension T3, multi-sku reservation (P7, P10).** One `OrderPlaced` reserves several skus; one
  aggregate per use case and "the store fails the writes where read data changed" pull apart.
  Complies by row locks held to the commit on each sku's `Stock` row (relies on reading S6) or by
  one message per line with per-sku `Stock` aggregates and a collecting `Reservation`.
- **Tension T4, cart cleared with the order (P7, P10).** The world's own P7 example ("the order
  placed, the cart still full") is the state the rule produces for a moment: `Cart` and `Order` are
  two aggregates. Complies by a versioned `ClearCart` message plus a shop rule accepting the cart
  read stale (or a lock), and a cart page that hides lines already ordered.
- **Tension T5, PaymentIntent before the Payment record (P17 vs P7/P8).** Calling Stripe before
  payment's commit leaves, on a failed commit, a tentative operation no aggregate holds a moment
  for (P17 sentence 2). Complies only by committing the `Payment` with its expiry first and calling
  Stripe after the commit, which forbids recording the intent id in the same use case (P7 "commits
  once after the last write"); the id arrives later with the webhook.
- **P8's fourth sentence replaces the fixture's `afterChange → shop` mechanism**: Payload's
  transaction writes `catalog.ProductChanged` into its own `outbox` collection, the relay reads it
  through an outbox reader assembly provides.
- **P16 refuses the common library's ambient unit of work**; replaced by a transaction-scope port
  each system declares and the common library implements by shape.
- **P15 moves checkout off live reads**: product price/tax class and dunning stage come from
  shop's replicas, each with a shop business rule accepting them stale (P10); only payment is asked
  live, by a shop rule that needs its answer now.
- **P11/P16 refuse the dashboard join**; placed as a `backoffice` system answering from its own
  replicas (a system the fixture's table does not list).
- **Statement/Why disagreements found: 7** (P4 per-poll vs per-item; P2's Why vs P13's MAY; P14's
  "each message" vs external writers; P8 "MUST make the change" vs a refused change; P7's handled
  record vs P9's "or by the records"; P15 sentence 2 vs the tentative call its Why allows; P11's
  read channels vs a command carrying the owner's data).
- Counts: **cannot-comply 0; tension 5; ok examples written 53; purpose-not-told 2; readings
  picked 21.**

## Findings

### p2-breach-sku-veto-asks-shop.md
```yaml
breaches: [P2, P3, P10]
satisfies: [P4, P5, P11, P16]
situation: catalog's beforeChange asks shop for open orders carrying a sku and refuses the change
finding: tension
```
# Catalog's sku veto makes shop an owner of the product's sku

The fixture as written (breaches):
```ts
// packages/shop/src/adapters/driving/payload-sku-guard.ts — shop's hook; Payload calls it in beforeChange
import { ValidationError, type CollectionBeforeChangeHook } from "payload";
import { shopPorts } from "@teeladen/web/assembly/courier";

export const guardSkuChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (operation !== "update" || !originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data;
  const { openOrdersCarrying } = shopPorts();                              // courier, read each run
  const { count } = await openOrdersCarrying({ sku: String(originalDoc.sku) }); // answering call, no req handed
  if (count > 0) throw new ValidationError({ errors: [{ path: "sku", message: `${count} offene Bestellungen` }] });
  return data;
};
```
```ts
// packages/catalog/src/collections/products.ts — catalog's configuration (external system)
{ name: "sku", type: "text", required: true, unique: true }               // catalog's rule: sku unique
```
Why this breaches. P2's Why: "A system that has to be asked before a record is written holds a rule
that decides what the record holds, so the record is that system's (glossary: Owner)." Shop has to
be asked before the product's sku is written, so shop's rule decides the sku field. Catalog's
config also decides it (unique, required) and the systems table says catalog owns it. P3: "Owner is
singular: two systems' rules deciding one record is the breach." The veto rule is stated in shop's
service/hook path against a record catalog keeps, and catalog's rule about the same field sits in
Payload's config: one of them is in the wrong domain whichever system is owner. P10 as well: the
count is read in shop's transaction (or none), Payload commits later in its own (P16 forbids sharing
one), so an order placed between the answer and Payload's commit carries the old sku; no business
rule accepts that staleness, and no store failure covers it.

Complying, option A (cheap; drops the veto): shop's order lines hold a snapshot of the sku
(see `p10-ok-order-line-snapshot`); a sku change in catalog changes no open order. P2's Why: "A
system asked only to protect records of its own decides nothing about the record written: it
copies what it needs and is not asked." No hook, no ownership question.

Complying, option B (keeps the veto; moves the sku): the sku becomes shop's record, kept by Payload.
```ts
// packages/catalog/src/collections/products.ts — P11 sentence 2: nothing but shop's use cases change it
{ name: "sku", type: "text", required: true, unique: true,                // unique: a store key, P2's second exception
  access: { update: () => false, create: () => false },                   // editors and REST cannot write it
  admin: { readOnly: true } },
```
```ts
// packages/shop/src/adapters/driving/payload-sku-request.ts — the keeper hands the change to the owner's use case
export const requestSkuChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const wanted = req.context.requestedSku;                                // set by a custom admin action, not the field
  if (typeof wanted !== "string" || !originalDoc) return data;
  await shopPorts().requestSkuChange({ catalogId: String(originalDoc.id), sku: wanted, requestedBy: String(req.user?.id) });
  return data;                                                            // keeps the record as before (P11's Why)
};
```
```ts
// packages/shop/src/service/request-sku-change.ts — shop decides; the write to Payload goes by message (P8)
export const makeRequestSkuChange = (d: { tx: ShopTransactions; ids: IdGenerator }): RequestSkuChange =>
  async (input) => d.tx.run(async (s) => {
    const listing = await s.listings.lockByCatalogId(input.catalogId);     // FOR UPDATE, held to commit
    if (!listing) return { kind: "refused", reason: "unknown-product" } as const;
    const open = await s.orders.openCountForSku(listing.sku);             // checkout takes FOR SHARE on the same row
    const decided = changeSku(listing, Sku.parse(input.sku), open);       // domain: refused when open > 0
    if (decided.kind === "refused") return decided;
    await s.listings.save(decided.listing);
    await s.outbox.add(writeSkuToCatalog(d.ids.next(), decided.listing)); // executor writes Payload via Local API
    return { kind: "accepted" } as const;
  });
```
Cost of B: the sku leaves catalog's ownership (the fixture's table changes), Payload's `unique` is
kept only as a store key, every checkout takes a share lock on the listing row of each sku it orders
(or shop states a rule accepting the race), the editor sees the new sku only after shop's executor
has run, and an admin action replaces the plain field edit. Both options follow every rule; the
fixture's combination (catalog owns the sku *and* shop vetoes it) does not.

### p7-breach-gapless-invoice-number.md
```yaml
breaches: [P7]
satisfies: [P7, P8, P9, P10, P18]
situation: billing's gapless invoice numbers
finding: tension
```
# Gapless numbering needs the series and the invoice in one commit

Natural code (breaches P7, two aggregates in one transaction):
```ts
// packages/billing/src/service/issue-invoice.ts
await d.tx.run(async (s) => {
  const series = await s.series.forYear(year);            // aggregate 1
  const order = await s.invoiceable.get(orderId);          // aggregate 2
  const numbered = issueInvoice(order, series.next);
  await s.series.save(advance(series));
  await s.invoiceable.save(numbered);                      // P7: "MUST save at most one aggregate"
});
```
Complying code (cost: a draft state and two message hops):
```ts
// packages/billing/src/domain/invoice-series.ts
export const InvoiceSeries = z.object({ year: z.number().int(), next: z.number().int().positive(), version: z.number().int() });
/** Business rule: invoice numbers of a year run without gap; a number, once assigned, is issued. */
export const assignNumber = (series: InvoiceSeries, invoiceableOrderId: string) => ({
  series: { ...series, next: series.next + 1 },
  assigned: { invoiceableOrderId, number: `${series.year}-${String(series.next).padStart(6, "0")}` },
});
```
```ts
// packages/billing/src/service/assign-invoice-number.ts — called for the private AssignInvoiceNumber
export const makeAssignInvoiceNumber = (d: BillingDeps) => async (m: { messageId: string; invoiceableOrderId: string; year: number }) =>
  d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;                          // P9: a repeat assigns no second number
    const series = await s.series.forYear(m.year);                            // one aggregate saved
    const { series: next, assigned } = assignNumber(series, m.invoiceableOrderId);
    await s.series.save(next);                                                // version compared: two assignments fail each other,
    await s.outbox.add(privateMessage("billing.InvoiceNumberAssigned", d.ids.next(), assigned)); // tied by the gapless rule (P10)
  });
```
```ts
// packages/billing/src/service/issue-numbered-invoice.ts — called for InvoiceNumberAssigned
export const makeIssueNumberedInvoice = (d: BillingDeps) => async (m: { messageId: string; invoiceableOrderId: string; number: string }) =>
  d.tx.run(async (s) => {
    const order = await s.invoiceable.get(m.invoiceableOrderId);
    if (!order) throw new Error(`draft ${m.invoiceableOrderId} not committed yet`); // fails, redelivered (P18 second means)
    const r = issueDraft(order, m.number, d.clock.now());                     // records: a second delivery finds it issued (P9)
    if (r.kind === "already-issued") return;
    await s.invoiceable.save(r.order);
    await s.outbox.add(invoiceIssued(d.ids.next(), r.order), sendInvoiceMail(d.ids.next(), r.order));
  });
```
P7's Why says a rule that needs two records changed at once draws them into one aggregate; the
gapless rule ties the series to every invoice of the year, so that aggregate would be all invoices
of a year, loaded whole (glossary: Aggregate). The series-as-counter keeps gaplessness inside one
aggregate because the assignment commits with its message (P8) and the message is delivered at least
once; the invoice is a draft until the number arrives. Every invoice issuance contends on one row,
which P10's third sentence accepts because the gapless rule ties them. The same holds for credit
notes (`CreditNoteSeries`).

### p7-breach-multi-sku-reservation.md
```yaml
breaches: [P7, P10]
satisfies: [P7, P9, P10, P18]
situation: fulfillment reserves stock on OrderPlaced for an order of several skus
finding: tension
```
# One order, several skus, one aggregate per use case

Natural code (breaches): either saves a `Stock` per sku (P7: several aggregates) or saves one
`Reservation` decided on `Stock` rows it does not save (P10: two orders read a stock of one, both
commit).
```ts
// packages/fulfillment/src/service/reserve-for-order.ts — breaches P10 sentence 1
const levels = await s.stock.levels(skus);                 // plain read, nothing fails on change
const r = reserve(order, levels);                          // two concurrent orders both see 1 left
await s.reservations.insert(r);
```
Complying code A (lock discipline, cost: every writer of reservations must take the row lock; see S6):
```ts
// packages/fulfillment/src/adapters/driven/pg-stock.ts
async lockLevels(skus: readonly Sku[]): Promise<StockLevel[]> {
  const sorted = [...skus].sort();                         // fixed order: no deadlock between two orders
  const rows = await this.tx.select().from(stock).where(inArray(stock.sku, sorted)).orderBy(stock.sku).for("update");
  const held = await this.tx.select({ sku: reservationLines.sku, qty: sql<number>`sum(${reservationLines.quantity})::int` })
    .from(reservationLines).innerJoin(reservations, eq(reservations.orderId, reservationLines.orderId))
    .where(and(inArray(reservationLines.sku, sorted), eq(reservations.status, "held"))).groupBy(reservationLines.sku);
  return rows.map((r) => StockLevel.parse({ sku: r.sku, onHand: r.onHand, reserved: held.find((h) => h.sku === r.sku)?.qty ?? 0 }));
}
```
```ts
// packages/fulfillment/src/service/record-order-fact.ts — one aggregate saved: the Reservation
const levels = await s.stock.lockLevels(placed.lines.map((l) => l.sku)); // lock taken at the read, held to the commit
const next = applyOrderFact(current, fact, levels, d.clock.now());       // domain: reserve, or backorder what is short
await s.reservations.upsert(next);                                       // insert fails on an existing order id (P10 "come to exist")
```
Complying code B (no lock discipline, cost: three hops and per-line tombstones): the use case for
`OrderPlaced` saves the `Reservation` with lines `pending` and writes one private `ReserveLine` per
line; each `ReserveLine` saves one `Stock` aggregate (per sku, holding its active holds, version
compared) and writes `LineReserved`; the `Reservation` collects them. A `ReleaseLine` that arrives
before its `ReserveLine` is kept on the `Stock` as a release for `(orderId, sku)` (P18).

P10's third sentence is kept either way: two orders of the same sku fail each other (the stock count
ties them), orders of different skus lock different rows.

### p7-breach-cart-cleared-with-order.md
```yaml
breaches: [P7, P10]
satisfies: [P7, P8, P10, P18]
situation: checkout places the order and empties the cart
finding: tension
```
# The order placed, the cart still full

Natural code (breaches P7):
```ts
await s.orders.insert(order);
await s.carts.save(emptied(cart));                         // second aggregate in one transaction
```
Complying code:
```ts
// packages/shop/src/service/checkout.ts (excerpt)
const cart = await s.carts.get(input.cartId);              // read in the committing transaction, not saved
// ...
await s.orders.insert(order);                              // the one aggregate
await s.outbox.add(clearCart(d.ids.next(), { cartId: cart.id, upToVersion: cart.version, orderId: order.id }));
```
```ts
// packages/shop/src/domain/cart.ts
/** Business rule: lines added to a cart while its checkout runs stay in the cart and are not in the order. */
export const clearOrderedLines = (cart: Cart, upToVersion: number): Cart =>
  ({ ...cart, lines: cart.lines.filter((l) => l.addedAtVersion > upToVersion), version: cart.version + 1 });
```
```ts
// packages/shop/src/service/cart-view.ts — answering: a cart whose order exists shows nothing already ordered
export const makeCartView = (d: { carts: CartQueries; orders: OrderQueries }) => async (cartId: CartId) => {
  const [cart, ordered] = await Promise.all([d.carts.get(cartId), d.orders.latestForCart(cartId)]);
  return cart && ordered ? clearOrderedLines(cart, ordered.cartVersion) : cart;
};
```
The world's P7 Why names "the order placed, the cart still full" as records no business rule allows;
the rule's own Why ("Where the caller has to see one change at once, the use case saves that
aggregate and the rest follows") produces that state until `ClearCart` is handled. The cost is a
business rule (stale cart accepted, P10 sentence 2), a cart version on every line, and a read path
that hides the transient state. A lock (`FOR UPDATE` on the cart row in checkout) removes the
staleness but not the second aggregate.

### p17-breach-intent-before-payment-record.md
```yaml
breaches: [P17]
satisfies: [P7, P8, P15, P17]
situation: payment creates a Stripe PaymentIntent when shop's checkout calls it
finding: tension
```
# The tentative operation must not precede the aggregate that holds its moment

Natural code (breaches P17 when the commit fails):
```ts
// packages/payment/src/service/start-payment.ts
d.tx.run(async (s) => {
  const intent = await d.provider.openIntent({ ... });   // tentative operation taken
  await s.payments.insert(openPayment({ intent, ... })); // commit fails → no aggregate holds a moment for the intent
});
```
Stripe PaymentIntents do not lapse on their own; with the `Payment` rolled back, payment holds a
tentative operation for which "it MUST hold the moment it stops waiting in an aggregate of its own"
cannot be met. P8's Why hands this to P17 ("it lapses or is cancelled by a business rule, and P17
delivers that the waiting ends"); P17 reaches only what an aggregate records.

Complying code (cost: intent id unknown to payment until Stripe's webhook; cancellation by search):
```ts
// packages/payment/src/service/start-payment.ts
export const makeStartPayment = (d: { tx: PaymentTransactions; provider: PaymentProvider; clock: Clock; ids: IdGenerator }): StartPayment =>
  async (input) => {
    const payment = await d.tx.run(async (s) => {
      const existing = await s.payments.byOrderReference(input.orderReference);
      if (existing) return existing;                                   // same checkout call repeated
      const opened = openPayment({ id: d.ids.next(), orderReference: input.orderReference, amount: input.amount, now: d.clock.now() });
      await s.payments.insert(opened);                                 // holds expiresAt (P17) before anything is asked
      return opened;
    });                                                                // the one commit, after the last write (P7)
    const intent = await d.provider.openIntent({ paymentId: payment.id, amount: payment.amount }); // tentative, after the commit (P8)
    return { paymentId: payment.id, clientSecret: intent.clientSecret };
  };
```
```ts
// packages/payment/src/adapters/driven/stripe-provider.ts (excerpt)
async openIntent({ paymentId, amount }) {
  const pi = await this.stripe.paymentIntents.create(
    { amount: toCents(amount), currency: "eur", metadata: { paymentId }, automatic_payment_methods: { enabled: true } },
    { idempotencyKey: `intent:${paymentId}` },                         // a retry of the same payment gets the same intent
  );
  if (pi.client_secret === null) throw new ProviderAnsweredIncomplete("client_secret");
  return { clientSecret: pi.client_secret };
},
async cancelIntentFor(paymentId) {                                   // at expiry: find the intent by its metadata
  const found = await this.stripe.paymentIntents.search({ query: `metadata['paymentId']:'${paymentId}'` });
  const pi = found.data[0];
  if (!pi) return { kind: "none" } as const;
  if (pi.status === "succeeded") return { kind: "already-succeeded", providerRef: pi.id } as const;
  await this.stripe.paymentIntents.cancel(pi.id, {}, { idempotencyKey: `cancel:${paymentId}` });
  return { kind: "cancelled", providerRef: pi.id } as const;
},
```
P7 forbids a second write after the commit, so the intent's id is learned from
`payment_intent.succeeded` (its `metadata.paymentId`) or from the search at expiry. A stop between
the commit and the Stripe call leaves a `Payment` with no intent, which the expiry ends. The
fixture's "returns its `client_secret` in the same call" holds.

## How the fixture is built

### Systems

Two processes: `web` (Next.js with Payload mounted, all systems' driving adapters except
fulfillment's handlers and its 3PL hook, the relay, the scheduled tasks of shop, payment and
billing) and `worker` (fulfillment's handlers, its 3PL hook over a small HTTP server, its scheduled
tasks). One Postgres holds every system's tables and Payload's; by the glossary it is one store
(S10) with records of several owners, so P16 keeps each transaction to one owner's records. A
seventh system, `backoffice`, is added for the dashboard (N6).

```
apps/
  web/
    instrumentation.ts                 # Next register(): telemetry first, then assembly (P5, common library)
    src/payload.config.ts              # catalog's configuration; Payload's routes import it at module load
    src/assembly/
      config.ts                        # reads process.env once into typed configuration values
      courier.ts                       # couriers; fill() imported only by assembly/index.ts (lint rule)
      index.ts                         # the web process's assembly
      catalog-outbox-reader.ts         # assembly provides the outbox reader of the external catalog
    src/app/
      (shop)/checkout/actions.ts       # shop driving adapter: server function
      (shop)/products/[slug]/page.tsx  # shop driving adapter: RSC, answering
      (backoffice)/dashboard/page.tsx  # backoffice driving adapter
      api/stripe/webhook/route.ts      # payment's hook
      api/internal/revalidate/route.ts # Next's data cache, reached by shop's PageCache adapter (N7)
      health/route.ts                  # probe
      (payload)/...                    # Payload admin and REST routes (generated)
    src/payload/
      sku-guard.ts                     # shop's hook in beforeChange (finding T1)
      stock-field.tsx                  # fulfillment's driving adapter, rendered by Payload's admin
  worker/
    src/instrumentation.ts             # loaded with node --import, before main
    src/main.ts                        # entry
    src/assembly.ts                    # the worker process's assembly
    src/three-pl-hook.ts               # fulfillment's hook
packages/
  kernel/src/{money,sku}.ts            # shared kernel
  common/src/
    logger.ts  telemetry/start.ts  courier.ts  envelope.ts
    db/create-db.ts  db/pg-transaction.ts  db/pg-inbox.ts  db/pg-outbox.ts
    outbox/relay.ts  bus/pg-boss-bus.ts  schedule.ts
  catalog/src/                         # code this codebase writes for the external catalog
    collections/{products,outbox,users}.ts
    hooks/write-product-changed.ts
    published/{payload-types.ts,product-changed.ts}  # catalog's published language (Assumptions)
    offer.ts
  shop/        src/{domain,service,adapters/driven,adapters/driving,published,builders,offer.ts}  test/
  payment/     (same layout)
  billing/     (same layout)
  fulfillment/ (same layout; adapters/three-pl/wire.ts states the 3PL's schema once)
  backoffice/  (same layout)
```

Per system the same layers (Assumptions):

- `domain/` pure, imports only `zod`, `decimal.js`, `date-fns`/`date-fns-tz`, `@teeladen/kernel`.
- `service/` one factory per use case; `service/ports.ts` declares the driven ports in the system's
  terms, including a `Transactions` port handing a write scope (`p7-ok-shop-write-scope`).
- `adapters/driven/` Drizzle repositories, outbox, inbox, external clients' adapters.
- `adapters/driving/` handlers, hooks and translators; Next files that must live under `app/` are
  modules of the system they call (glossary: System, "wherever the repository keeps it").
- `published/` the published language: zod schemas, named `<system>.<Message>.v<n>`.
- `builders/` system builders; `offer.ts` re-exports `published/`, driving port types of the open
  host service, their fakes, and the builders.

```ts
// packages/shop/src/offer.ts — the only import path other code of this codebase uses (P5, P13)
export * from "./published";                                    // OrderPlacedV1, OrderPaidV1, OrderCancelledV1, ...
export type { OpenOrdersCarrying } from "./service/open-orders-carrying"; // driving port type of the open host service
export { fakeOpenOrdersCarrying } from "../test-support/fakes";        // its fake, scenario data in the published language
export { buildShop, buildShopOutboxReader } from "./builders";         // for assembly only (P13 sentence 1)
```

### catalog

External system (Payload CMS). This codebase writes its configuration; its business rules there are
its own (glossary: External system). Its published language is what Payload's API is typed by,
`payload-types.ts` generated from this configuration, plus the message schema this codebase writes
for the outbox document (Assumptions; N13).

```ts
// packages/catalog/src/collections/products.ts — catalog's configuration
import type { CollectionConfig } from "payload";
import { writeProductChanged } from "../hooks/write-product-changed";

export const products = (hooks: { beforeChange: NonNullable<CollectionConfig["hooks"]>["beforeChange"] }): CollectionConfig => ({
  slug: "products",
  access: { read: () => true, update: ({ req }) => Boolean(req.user), create: ({ req }) => Boolean(req.user) },
  fields: [
    { name: "title", type: "text", required: true, localized: true },
    { name: "copy", type: "richText", localized: true },
    { name: "images", type: "upload", relationTo: "media", hasMany: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "sku", type: "text", required: true, unique: true },               // catalog's rule: sku unique
    { name: "price", type: "number", required: true,
      validate: (v: number | null | undefined) => (typeof v === "number" && v > 0) || "Preis muss über 0 liegen" }, // catalog's rule
    { name: "taxClass", type: "select", required: true, options: ["tea", "accessory"] },
    { name: "stock", type: "ui", admin: { components: { Field: "/src/payload/stock-field#StockField" } } },
  ],
  hooks: { beforeChange: hooks.beforeChange, afterChange: [writeProductChanged] },
});
```
```ts
// packages/catalog/src/collections/outbox.ts — catalog's own outbox, in its own store tables
import type { CollectionConfig } from "payload";
export const outbox: CollectionConfig = {
  slug: "outbox",
  access: { read: () => false, create: () => false, update: () => false, delete: () => false }, // Local API only
  fields: [
    { name: "type", type: "text", required: true },
    { name: "payload", type: "json", required: true },
    { name: "deliveredAt", type: "date", index: true },
  ],
};
```
```ts
// packages/catalog/src/published/product-changed.ts — the one schema writer and readers parse with (P14)
import { z } from "zod";
export const PRODUCT_CHANGED_V1 = "catalog.ProductChanged.v1" as const;
/** A notice: the product changed; readers ask catalog what it is now (P18). */
export const ProductChangedV1 = z.object({ productId: z.string().min(1), operation: z.enum(["create", "update", "delete"]) });
export type ProductChangedV1 = z.infer<typeof ProductChangedV1>;
```
```ts
// packages/catalog/src/hooks/write-product-changed.ts — inside Payload's transaction (P8 sentence 4)
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload";
import { PRODUCT_CHANGED_V1, ProductChangedV1 } from "../published/product-changed";

export const writeProductChanged: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  const payload = ProductChangedV1.parse({ productId: String(doc.id), operation });
  await req.payload.create({ collection: "outbox", data: { type: PRODUCT_CHANGED_V1, payload }, req }); // req: same transactionID
  return doc;
};
export const writeProductDeleted: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await req.payload.create({ collection: "outbox", data: { type: PRODUCT_CHANGED_V1, payload: { productId: String(doc.id), operation: "delete" } }, req });
};
```
```ts
// apps/web/src/payload.config.ts — catalog's configuration as Payload's Next routes need it
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { products } from "@teeladen/catalog/collections/products";
import { outbox } from "@teeladen/catalog/collections/outbox";
import { users } from "@teeladen/catalog/collections/users";
import { guardSkuChange } from "./payload/sku-guard";          // only under option B of T1; option A passes []

export default buildConfig({
  collections: [products({ beforeChange: [] /* option A */ }), outbox, users],
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }), // catalog's own, outside the rules (S16)
  secret: process.env.PAYLOAD_SECRET ?? "",
  typescript: { outputFile: "../../packages/catalog/src/published/payload-types.ts" },
});
```
Placement of each catalog situation: editors' rules and `req.user` stay in catalog's config
(`p2-ok-catalog-config-rules-are-catalogs`); `afterChange` writes catalog's outbox instead of
calling shop (`p8-ok-payload-outbox-product-changed`, N1); `beforeChange` veto: finding T1; shop
reads through the Local API in its replica refresh (`p15-ok-listing-replica-refreshed-on-notice`,
`p11-ok-shop-reads-catalog-through-local-api`); Payload's transaction: hooks of this codebase hand
no `req` to a driving port (`p16-ok-sku-guard-hook-hands-no-req`); stock in the admin:
`p11-ok-stock-field-through-fulfillment-ohs`; the cycle: `p5-ok-payload-cycle-courier`.

### shop

Records: `Cart`, `Order`, `ListedProduct` (replica of catalog's product), `InvoiceEligibility`
(replica of billing's dunning stage), `handled_messages`, `outbox`.

```ts
// packages/shop/src/service/ports.ts — driven ports, shop's terms only
import type { Money } from "@teeladen/kernel/money";
import type { Sku } from "@teeladen/kernel/sku";
import type { Cart, CartId, Order, OrderId, ListedProduct, InvoiceEligibility, CustomerId, CatalogProduct, Mail } from "../domain";
import type { ShopOutgoing } from "./outgoing";

export interface Clock { now(): Date }
export interface IdGenerator { next(): string }
export interface Orders {
  get(id: OrderId): Promise<Order | undefined>;
  insert(order: Order): Promise<void>;                 // fails on an existing id (key)
  save(order: Order): Promise<void>;                   // fails with StaleAggregate when the version moved
  overdue(asOf: Date, limit: number): Promise<OrderId[]>;
}
export interface Carts { get(id: CartId): Promise<Cart | undefined>; save(cart: Cart): Promise<void> }
export interface Listings {
  bySkus(skus: readonly Sku[]): Promise<ListedProduct[]>;
  byCatalogId(id: string): Promise<ListedProduct | undefined>;
  save(listing: ListedProduct): Promise<void>;
  remove(catalogId: string): Promise<void>;
}
export interface Eligibilities { get(id: CustomerId): Promise<InvoiceEligibility | undefined>; save(e: InvoiceEligibility): Promise<void> }
export interface Outbox { add(...messages: ShopOutgoing[]): Promise<void> }
export interface Inbox { claim(messageId: string): Promise<boolean> }   // true on the first claim
export interface ShopScope { orders: Orders; carts: Carts; listings: Listings; eligibilities: Eligibilities; outbox: Outbox; inbox: Inbox }
export interface ShopTransactions { run<T>(work: (scope: ShopScope) => Promise<T>): Promise<T> }

export interface PaymentGateway { start(req: { orderId: OrderId; amount: Money }): Promise<{ paymentRef: string; clientSecret: string }> }
export interface Catalog { product(catalogId: string): Promise<CatalogProduct | "gone"> }
export interface Mailer { send(mail: Mail): Promise<void> }
export interface PageCache { revalidateProduct(slug: string): Promise<void> }
```
```ts
// packages/shop/src/service/outgoing.ts — what shop's services hand the Outbox port, in shop's terms only:
// its own published language, its private messages, and its requests to payment (translated by the adapter)
import type { Money } from "@teeladen/kernel/money";
import type { OrderPlacedV1, OrderPaidV1, OrderCancelledV1 } from "../published";
import type { ClearCart, SendOrderConfirmation, ExpireOrder, RevalidateProductPage } from "./private-messages";

type Msg<T extends string, P> = { id: string; type: T; payload: P };
export type ShopOutgoing =
  | Msg<"shop.OrderPlaced.v1", OrderPlacedV1> | Msg<"shop.OrderPaid.v1", OrderPaidV1> | Msg<"shop.OrderCancelled.v1", OrderCancelledV1>
  | Msg<"shop.request.Refund", { paymentRef: string; amount: Money }> | Msg<"shop.request.CancelPayment", { paymentRef: string }>
  | Msg<"shop.private.ClearCart", ClearCart> | Msg<"shop.private.SendOrderConfirmation", SendOrderConfirmation>
  | Msg<"shop.private.ExpireOrder", ExpireOrder> | Msg<"shop.private.RevalidateProductPage", RevalidateProductPage>;
```
Shop is an anti-corruption layer towards payment on every path: the `PaymentGateway` adapter
translates `startPayment`, the handlers translate payment's events, and shop's outbox adapter
translates `shop.request.Refund` into payment's `RefundPayment` command before it writes the row
(`p13-ok-command-declared-by-receiver`). A first draft typed `Outbox.add` with payment's command
types; that put payment's terms in shop's service while the gateway translated, P12's "third state"
(N25).

```ts
// packages/shop/src/builders/index.ts — system builder (assembly's part, P5)
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Payload } from "payload";
import type { StartPayment } from "@teeladen/payment/offer";
import { pgTransactions } from "../adapters/driven/pg-transactions";
import { payloadCatalog } from "../adapters/driven/payload-catalog";
import { paymentGateway } from "../adapters/driven/payment-gateway";
import { providerMailer, type MailClient } from "../adapters/driven/mailer";
import { httpPageCache } from "../adapters/driven/page-cache";
import { pgShopQueries } from "../adapters/driven/pg-queries";
import * as uc from "../service";
import { shopHandlers } from "../adapters/driving/handlers";
import { pgOutboxReader } from "@teeladen/common/db/pg-outbox";
import { shopOutbox } from "../adapters/driven/schema";
import type { Clock, IdGenerator } from "../service/ports";

export interface ShopBuilderInput {
  db: NodePgDatabase; payload: Payload; startPayment: StartPayment; mail: MailClient;
  clock: Clock; ids: IdGenerator; fetch: typeof globalThis.fetch;
  config: { revalidateUrl: string; revalidateSecret: string };
}
export const buildShop = (i: ShopBuilderInput) => {
  const tx = pgTransactions(i.db);
  const queries = pgShopQueries(i.db);
  const payments = paymentGateway(i.startPayment);
  const catalog = payloadCatalog(i.payload);
  const mailer = providerMailer(i.mail);
  const pageCache = httpPageCache(i.fetch, i.config.revalidateUrl, i.config.revalidateSecret);
  const ports = {
    checkout: uc.makeCheckout({ tx, payments, clock: i.clock, ids: i.ids }),
    whoIs: uc.makeWhoIs(queries),
    cartView: uc.makeCartView(queries),
    listing: uc.makeListing(queries),
    openOrdersCarrying: uc.makeOpenOrdersCarrying(queries),
    recordPaymentOutcome: uc.makeRecordPaymentOutcome({ tx, clock: i.clock, ids: i.ids }),
    recordInvoicePaid: uc.makeRecordInvoicePaid({ tx, ids: i.ids }),
    recordRefundOutcome: uc.makeRecordRefundOutcome({ tx }),
    expireOrder: uc.makeExpireOrder({ tx, clock: i.clock, ids: i.ids }),
    requestExpiries: uc.makeRequestExpiries({ tx, clock: i.clock, ids: i.ids }),
    clearOrderedLines: uc.makeClearOrderedLines({ tx }),
    sendOrderConfirmation: uc.makeSendOrderConfirmation({ tx, mailer }),
    refreshListing: uc.makeRefreshListing({ tx, catalog, ids: i.ids }),
    revalidateProductPage: uc.makeRevalidateProductPage({ pageCache }),
    refreshInvoiceEligibility: uc.makeRefreshInvoiceEligibility({ tx }),
  };
  return { ports, handlers: shopHandlers(ports) };
};
export type ShopPorts = ReturnType<typeof buildShop>["ports"];
export const buildShopOutboxReader = (db: NodePgDatabase) => pgOutboxReader(db, shopOutbox);
```
Placement of each shop situation: client_secret `p15-ok-checkout-returns-client-secret`;
pay-by-invoice and dunning `p10-ok-pay-by-invoice-dunning-replica`; copying price, sku, tax class
`p10-ok-order-line-snapshot`; the confirmation mail `p8-ok-confirmation-mail-after-commit`; the
in-process call to billing `p16-ok-billing-call-carries-no-transaction`.

### payment

Records: `Payment` aggregate (refunds and the dispute flag inside it, S19), `handled_messages`,
`outbox`. Stripe behind payment's own `PaymentProvider` port (anti-corruption layer).

```ts
// packages/payment/src/service/ports.ts
import type { Money } from "@teeladen/kernel/money";
export interface PaymentProvider {
  openIntent(req: { paymentId: string; amount: Money }): Promise<{ clientSecret: string }>;
  cancelIntentFor(paymentId: string): Promise<{ kind: "none" } | { kind: "cancelled"; providerRef: string } | { kind: "already-succeeded"; providerRef: string }>;
  refund(req: { providerRef: string; amount: Money; refundId: string }): Promise<{ kind: "made"; providerRefundId: string } | { kind: "refused"; reason: "disputed" | "declined" }>;
  findRefund(req: { providerRef: string; refundId: string }): Promise<{ providerRefundId: string } | undefined>;
  currentState(providerRef: string): Promise<"awaiting-customer" | "succeeded" | "failed" | "cancelled">;
}
export interface Payments {
  get(id: string): Promise<Payment | undefined>;
  byOrderReference(ref: string): Promise<Payment | undefined>;
  insert(p: Payment): Promise<void>;                   // unique order_reference: a second payment for one order fails
  save(p: Payment): Promise<void>;                     // version compared
  expiredBefore(asOf: Date, limit: number): Promise<string[]>;
}
export interface PaymentScope { payments: Payments; outbox: Outbox; inbox: Inbox }
export interface PaymentTransactions { run<T>(work: (s: PaymentScope) => Promise<T>): Promise<T> }
```
```ts
// packages/payment/src/published/index.ts — payment's published language
import { z } from "zod";
import { Money } from "@teeladen/kernel/money";
export const StartPaymentInput = z.object({ orderReference: z.string().uuid(), amount: Money });
export const StartPaymentResult = z.object({ paymentId: z.string().uuid(), clientSecret: z.string().min(1) });
export type StartPayment = (input: z.infer<typeof StartPaymentInput>) => Promise<z.infer<typeof StartPaymentResult>>;

const PaymentFact = { paymentId: z.string().uuid(), orderReference: z.string().uuid(), paymentVersion: z.number().int().nonnegative() };
export const PaymentSucceededV1 = z.object({ ...PaymentFact, amount: Money });
export const PaymentFailedV1 = z.object(PaymentFact);
export const PaymentRefundedV1 = z.object({ ...PaymentFact, refundId: z.string().uuid(), amount: Money });
export const RefundRefusedV1 = z.object({ ...PaymentFact, refundId: z.string().uuid(), reason: z.enum(["disputed", "declined"]) });
export const RefundPaymentV1 = z.object({ paymentId: z.string().uuid(), amount: Money, reason: z.enum(["order-cancelled", "customer-request"]) }); // command payment takes
export const CancelPaymentV1 = z.object({ paymentId: z.string().uuid() });                                                                       // command payment takes
export type RefundPaymentV1 = z.infer<typeof RefundPaymentV1>;
export type CancelPaymentV1 = z.infer<typeof CancelPaymentV1>;
```
```ts
// packages/payment/src/domain/payment.ts (excerpt)
export const INTENT_LIFETIME_HOURS = 24;          // business rule: an unconfirmed card payment is given up after a day
export const Payment = z.object({
  id: z.string().uuid(), orderReference: z.string().uuid(), amount: Money,
  status: z.enum(["awaiting-customer", "succeeded", "failed", "expired", "cancelled"]),
  providerRef: z.string().nullable(), disputed: z.boolean(), expiresAt: z.date(),
  refunds: z.array(z.object({ id: z.string().uuid(), amount: Money, status: z.enum(["pending", "made", "refused"]), providerRefundId: z.string().nullable() })),
  version: z.number().int().nonnegative(),
});
export type Payment = z.infer<typeof Payment>;
/** Business rules: status moves forward only; success is success whatever came before it (the money was
 *  taken); a failed attempt ends the payment and its intent is cancelled. */
export const applyProviderEvent = (p: Payment, e: ProviderEvent): { payment: Payment; events: PaymentEvent[]; cancelIntent: boolean } => {
  switch (e.kind) {
    case "intent-succeeded":
      return p.status === "succeeded" ? { payment: p, events: [], cancelIntent: false }
        : { payment: { ...p, status: "succeeded", providerRef: e.providerRef }, events: [{ kind: "succeeded" }], cancelIntent: false };
    case "attempt-failed":
      return p.status !== "awaiting-customer" ? { payment: p, events: [], cancelIntent: false }
        : { payment: { ...p, status: "failed", providerRef: e.providerRef }, events: [{ kind: "failed" }], cancelIntent: true };
    case "disputed":
      return { payment: { ...p, disputed: true }, events: [], cancelIntent: false };
  }
};
```
Placement: anti-corruption layer `p12-ok-payment-stripe-acl`; creating the intent: finding T5 and
`p15-ok-checkout-returns-client-secret`; webhooks `p9-ok-stripe-webhook-claimed-in-transaction`;
three days `p17-ok-payment-expiry-outlives-stripe-retries`; refund and dispute
`p17-ok-refund-refused-for-dispute`; the Stripe client `p5-ok-stripe-client-built-by-payment-builder`.

### billing

Records: `InvoiceableOrder` (per shop order: the facts billing learned of it, its invoice, its credit
notes), `InvoiceSeries`, `CreditNoteSeries`, `CustomerDunning`, `UnmatchedTransfer`,
`handled_messages`, `outbox`. Bank behind billing's `BankStatements` port; mail behind `Mailer`.

```ts
// packages/billing/src/domain/invoiceable-order.ts (excerpt) — named apart from shop's Order (P19)
export const VatCategory = z.enum(["reduced", "standard"]);
export const InvoiceableOrder = z.object({
  shopOrderId: z.string().uuid(), customerId: z.string().uuid(),
  placed: z.object({ method: z.enum(["card", "invoice"]), lines: z.array(InvoiceableLine) }).nullable(),
  paid: z.boolean(), cancelled: z.boolean(), lastOrderVersion: z.number().int(),
  invoice: z.discriminatedUnion("state", [
    z.object({ state: z.literal("none") }),
    z.object({ state: z.literal("draft"), lines: z.array(InvoiceLine) }),
    z.object({ state: z.literal("issued"), number: z.string(), lines: z.array(InvoiceLine), issuedAt: z.date(), dueAt: z.date(),
               appliedTransfers: z.array(z.object({ transferId: z.string(), amount: Money })), settled: z.boolean() }),
  ]),
  refunds: z.array(z.object({ refundId: z.string().uuid(), amount: Money, creditNote: z.enum(["none", "draft", "issued"]) })),
  version: z.number().int().nonnegative(),
});
```
```ts
// packages/billing/src/service/ports.ts (excerpt)
export interface BankStatements { transfersSince(since: Date): Promise<BankTransfer[]> } // BankTransfer in billing's terms
export interface BillingScope {
  invoiceable: InvoiceableOrders; series: InvoiceSeriesRepo; creditSeries: CreditNoteSeriesRepo;
  dunning: CustomerDunnings; unmatched: UnmatchedTransfers; outbox: Outbox; inbox: Inbox;
}
export interface BillingTransactions { run<T>(work: (s: BillingScope) => Promise<T>): Promise<T> }
```
Placement: invoice on `OrderPaid`/`OrderPlaced` `p18-ok-billing-facts-in-any-order`; VAT
`p2-ok-vat-rate-in-billing-domain`; bank transfers `p9-ok-bank-poll-hands-on-transfer-ids` and
`p7-ok-transfer-match-saves-one-aggregate`; dunning `p7-ok-dunning-run-writes-one-message-per-customer`;
credit notes `p18-ok-credit-note-whatever-arrives-first`; gapless numbers: finding T2.

### fulfillment

Records: `Stock` (per sku: on hand), `Reservation` (per shop order: the facts known of the order,
its lines and hold), `Shipment`, `Article` (the sku's registration at the 3PL), `handled_messages`,
`outbox`. Runs its handlers in the worker; its answering open host service `StockLevels` is also
built in the web process for Payload's admin (N5).

```ts
// packages/fulfillment/src/adapters/three-pl/wire.ts — the 3PL's schema, stated once in code (P12, P14)
import { z } from "zod";
export const ThreePlConsignmentRequest = z.object({ external_ref: z.string(), items: z.array(z.object({ article_no: z.string(), qty: z.number().int() })), recipient: z.object({ name: z.string(), street: z.string(), zip: z.string(), city: z.string(), country: z.string() }) });
export const ThreePlConsignment = z.object({ consignment_id: z.string(), external_ref: z.string(), state: z.enum(["NEW", "PICKED", "SHIPPED", "DELIVERED", "CANCELLED"]) });
export const ThreePlWebhookEvent = z.object({ event_id: z.string(), consignment: ThreePlConsignment });
export const ThreePlArticle = z.object({ article_no: z.string(), name: z.string(), weight_g: z.number().int().positive() });
export const ThreePlError = z.object({ code: z.enum(["UNKNOWN_ARTICLE", "DUPLICATE_REF", "VALIDATION"]), message: z.string() });
```
```ts
// apps/worker/src/assembly.ts — the worker's assembly
import { createDb } from "@teeladen/common/db/create-db";
import { createPgBossBus } from "@teeladen/common/bus/pg-boss-bus";
import { buildFulfillment } from "@teeladen/fulfillment/offer";
import type { WorkerConfig } from "./config";
import PgBoss from "pg-boss";
import { randomUUID } from "node:crypto";

export const assembleWorker = async (config: WorkerConfig) => {
  const { db, close } = createDb(config.database);
  const boss = new PgBoss({ connectionString: config.database.url, schema: "bus" });
  await boss.start();
  const fulfillment = buildFulfillment({
    db, fetch: globalThis.fetch,
    clock: { now: () => new Date() }, ids: { next: () => randomUUID() },
    threePl: config.threePl, catalogApi: config.catalogApi,      // configuration values as arguments
  });
  const bus = createPgBossBus(boss, fulfillment.handlers);
  await bus.start();
  return { hookPorts: fulfillment.hookPorts, scheduled: fulfillment.scheduled, boss, stop: async () => { await boss.stop(); await close(); } };
};
```
Placement: reserve/release `p7-breach-multi-sku-reservation` (T3) and
`p17-ok-reservation-hold-ends-without-shop`; early `OrderPaid`/`OrderCancelled`
`p18-ok-cancel-before-placed-kept`; 3PL webhooks `p12-ok-3pl-hook-translates-and-acks-after-commit`;
article master `p9-ok-article-registration-asks-before-create`; worker `p5-ok-fulfillment-worker-assembly`.

### common library

```ts
// packages/common/src/logger.ts — telemetry, imported ready-made (P5 exception)
import pino from "pino";
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" }); // stdout; never throws when nothing listens (P6)
```
```ts
// packages/common/src/telemetry/start.ts — called by each process entry before anything else loads
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
export const startTelemetry = (cfg: { serviceName: string; jaegerOtlpUrl: string | undefined; metricsPort: number }) => {
  const sdk = new NodeSDK({
    serviceName: cfg.serviceName,
    ...(cfg.jaegerOtlpUrl ? { traceExporter: new OTLPTraceExporter({ url: cfg.jaegerOtlpUrl }) } : {}),
    metricReader: new PrometheusExporter({ port: cfg.metricsPort }),   // /metrics, scraped (probe)
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return sdk;
};
```
```ts
// packages/common/src/db/create-db.ts — a factory; assembly calls it (P5)
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
export const createDb = (cfg: { url: string; poolSize: number }): { db: NodePgDatabase; close: () => Promise<void> } => {
  const pool = new Pool({ connectionString: cfg.url, max: cfg.poolSize });
  return { db: drizzle(pool), close: () => pool.end() };
};
```
```ts
// packages/common/src/db/pg-transaction.ts — implements each system's Transactions port by shape;
// the transaction travels as the callback's argument, never ambient (P16)
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
export type PgTx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];
export const pgTransactionRunner = <Scope>(db: NodePgDatabase, bind: (tx: PgTx) => Scope) => ({
  run: <T>(work: (scope: Scope) => Promise<T>): Promise<T> => db.transaction((tx) => work(bind(tx))),
});
```
```ts
// packages/common/src/envelope.ts — what the relay and the bus carry; holds no system's shape (P3, P14)
export interface Envelope { id: string; type: string; payload: unknown; writtenAt: string; trace: Record<string, string> }
```
```ts
// packages/common/src/db/pg-outbox.ts — outbox writer (inside the transaction) and outbox reader (for the relay)
import { propagation, context } from "@opentelemetry/api";
import { isNull, inArray, asc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTx } from "./pg-transaction";
import type { OutboxTable } from "./outbox-table";
import type { Envelope } from "../envelope";

export const pgOutboxWriter = <M extends { id: string; type: string; payload: unknown }>(tx: PgTx, table: OutboxTable) => ({
  add: async (...messages: M[]): Promise<void> => {
    if (messages.length === 0) return;
    const trace: Record<string, string> = {};
    propagation.inject(context.active(), trace);                    // telemetry on the envelope (P4: no input)
    await tx.insert(table).values(messages.map((m) => ({ id: m.id, type: m.type, payload: m.payload, trace })))
      .onConflictDoNothing();                                       // same id twice is the same message
  },
});
export const pgOutboxReader = (db: NodePgDatabase, table: OutboxTable) => ({
  pending: async (limit: number): Promise<Envelope[]> =>
    (await db.select().from(table).where(isNull(table.deliveredAt)).orderBy(asc(table.writtenAt)).limit(limit))
      .map((r) => ({ id: r.id, type: r.type, payload: r.payload, writtenAt: r.writtenAt.toISOString(), trace: r.trace })),
  markDelivered: async (ids: readonly string[]): Promise<void> => {
    if (ids.length > 0) await db.update(table).set({ deliveredAt: new Date() }).where(inArray(table.id, [...ids]));
  },
});
```
```ts
// packages/common/src/outbox/relay.ts — assembly hands it the outbox readers
import type { Envelope } from "../envelope";
export interface OutboxReader { pending(limit: number): Promise<Envelope[]>; markDelivered(ids: readonly string[]): Promise<void> }
export interface BusPublisher { publish(e: Envelope): Promise<void> }  // resolves once the bus holds it durably
export const createRelay = (readers: readonly OutboxReader[], bus: BusPublisher) => ({
  tick: async (): Promise<void> => {
    for (const reader of readers) {
      const batch = await reader.pending(100);
      for (const e of batch) await bus.publish(e);
      await reader.markDelivered(batch.map((e) => e.id));          // only after the bus holds each (P8)
    }
  },
});
```
```ts
// packages/common/src/bus/pg-boss-bus.ts — durable bus; a handler's promise resolving is the acknowledgement
import type PgBoss from "pg-boss";
import type { Envelope } from "../envelope";
export interface Handler { readonly type: string; readonly name: string; handle(e: Envelope): Promise<void> }
export const createPgBossBus = (boss: PgBoss, handlers: readonly Handler[]) => ({
  publish: async (e: Envelope): Promise<void> => {
    for (const h of handlers.filter((x) => x.type === e.type)) {
      await boss.send(`${h.name}`, e, { singletonKey: `${h.name}:${e.id}`, retryLimit: 20, retryBackoff: true, deadLetter: `${h.name}.dead` });
    }
  },
  start: async (): Promise<void> => {
    for (const h of handlers) {
      await boss.createQueue(h.name);
      await boss.createQueue(`${h.name}.dead`);
      await boss.work<Envelope>(h.name, async ([job]) => { if (job) await h.handle(job.data); }); // throws → retried, then dead-lettered
    }
  },
});
```
The bus's `publish` fans out per handler in the publishing process, so the web relay must know the
worker's handler names: assembly of web registers fulfillment's handler descriptors (names, types)
without building its services. How the bus finds handlers is the repository's (Assumptions); I
note it only because P5's "assembly hands it the handlers" then crosses processes (N24).

```ts
// packages/common/src/courier.ts
export interface Courier<T> { read(): T }
export const createCourier = <T>(name: string): { courier: Courier<T>; fill: (value: T) => void } => {
  let slot: { value: T } | undefined;
  return {
    courier: { read: () => { if (!slot) throw new Error(`courier ${name} read before assembly filled it`); return slot.value; } },
    fill: (value) => { if (slot) throw new Error(`courier ${name} filled twice`); slot = { value }; },
  };
};
```
The fixture's "unit of work kept ambient in `AsyncLocalStorage`" is not built; the runner above
replaces it (`p16-ok-common-transaction-runner-by-shape`, N2). OpenTelemetry's ambient context and
the request id stay ambient (`p16-ok-request-id-crosses-transaction-does-not`).

### The checkout saga

Choreography: each system reacts to the others' events; shop's `Order` holds shop's part, payment's
`Payment` payment's, fulfillment's `Reservation` fulfillment's, billing's `InvoiceableOrder`
billing's. Message flow:

| step | writer → message | receiver use case | example |
| --- | --- | --- | --- |
| 1 | shop `checkout` → `shop.OrderPlaced.v1`, private `ClearCart`, `SendOrderConfirmation` | fulfillment `recordOrderFact`, billing `recordOrderFact` | `p8-ok-saga-1-order-placed-in-outbox` |
| 2 | shop `checkout` calls payment `startPayment` (tentative) | – | `p15-ok-checkout-returns-client-secret`, T5 |
| 3 | Stripe → payment hook → `payment.PaymentSucceeded.v1` / `PaymentFailed.v1` | shop `recordPaymentOutcome` | `p13-ok-saga-3-payment-events-in-published-language` |
| 4 | shop → `shop.OrderPaid.v1` | billing `recordOrderFact` (invoice), fulfillment `recordOrderFact` (ship) | `p18-ok-saga-4-order-paid-versioned` |
| 5 | shop `expireOrder` / `recordPaymentOutcome` → `shop.OrderCancelled.v1`, `payment.CancelPayment.v1` | fulfillment release, payment cancel intent | `p17-ok-saga-5-deadline-in-order` |
| 6 | billing `recordIncomingTransfer` → `billing.InvoicePaid.v1`; shop → `OrderPaid` | shop `recordInvoicePaid`; billing, fulfillment no-op | `p17-ok-saga-6-invoice-order-is-no-wait` |
| 7 | shop `recordPaymentOutcome` on a cancelled order → `payment.RefundPayment.v1` | payment `requestRefund` → `PaymentRefunded` / `RefundRefused` | `p17-ok-saga-7-late-payment-refunded` |

```ts
// packages/shop/src/domain/order-payment.ts — shop's part of steps 3, 5, 6, 7 on one aggregate
export type PaymentOutcome = { kind: "succeeded" | "failed"; paymentId: string; paymentVersion: number; amount?: Money };
export type OrderDecision = { order: Order; publish: Array<"paid" | "cancelled">; refund?: { paymentId: string; amount: Money }; cancelPayment?: string };

/** Business rules of shop:
 *  - an order is paid by whichever comes first, payment's success or billing's invoice settled; the later changes nothing;
 *  - a card order whose payment failed is cancelled;
 *  - a payment that succeeds for a cancelled order is refunded whole (step 7);
 *  - a lower payment version than the order last saw is older news and changes nothing (P18). */
export const applyPaymentOutcome = (o: Order, p: PaymentOutcome): OrderDecision => {
  if (p.paymentVersion <= o.lastPaymentVersion) return { order: o, publish: [] };
  const seen = { ...o, lastPaymentVersion: p.paymentVersion, paymentRef: p.paymentId };
  if (p.kind === "succeeded") {
    if (o.status === "awaiting-payment") return { order: { ...seen, status: "paid" }, publish: ["paid"] };
    if (o.status === "cancelled" && o.refund === "none")
      return { order: { ...seen, refund: "requested" }, publish: [], refund: { paymentId: p.paymentId, amount: p.amount ?? orderTotal(o) } };
    return { order: seen, publish: [] };
  }
  if (o.status === "awaiting-payment") return { order: { ...seen, status: "cancelled" }, publish: ["cancelled"] };
  return { order: seen, publish: [] };
};
export const expireIfUnpaid = (o: Order, asOf: Date): OrderDecision =>
  o.status === "awaiting-payment" && o.paymentDueBy !== null && asOf >= o.paymentDueBy
    ? { order: { ...o, status: "cancelled" }, publish: ["cancelled"], ...(o.paymentRef ? { cancelPayment: o.paymentRef } : {}) }
    : { order: o, publish: [] };
```

### Cross-cutting reads

- Dashboard: `backoffice` system with replicas of orders, invoices and shipments
  (`p11-ok-dashboard-on-backoffice-replicas`); the join on the one Postgres is refused by P11 and
  P16.
- Revalidation: catalog's outbox → shop refreshes its listing → private `RevalidateProductPage`
  after the listing commits (`p8-ok-revalidate-after-listing-commits`).
- `/health` and `/metrics`: probes outside the layers (`p5-ok-probes-outside-layers`).

## Ok examples

### p11-ok-shop-reads-catalog-through-local-api.md
```yaml
breaches: []
satisfies: [P5, P11, P12, P16, P19]
situation: catalog (Payload) owns the product; shop reads it through the Local API
```
# Shop's catalog adapter reads through Payload's API, in shop's terms
```ts
// packages/shop/src/adapters/driven/payload-catalog.ts — driven adapter behind shop's Catalog port
import type { Payload } from "payload";
import type { Product as PayloadProduct } from "@teeladen/catalog/published/payload-types"; // catalog's published language
import { CatalogProduct } from "../../domain/listing";                                  // shop's terms
import { money } from "@teeladen/kernel/money";
import type { Catalog } from "../../service/ports";

const toShop = (p: PayloadProduct): CatalogProduct =>
  CatalogProduct.parse({ catalogId: String(p.id), slug: p.slug, sku: p.sku, title: p.title,
                         unitPrice: money(p.price.toFixed(2)), taxClass: p.taxClass });   // projection happens here

export const payloadCatalog = (payload: Payload): Catalog => ({
  product: async (catalogId) => {
    const found = await payload.find({ collection: "products", where: { id: { equals: catalogId } }, limit: 1, locale: "de", depth: 0 });
    const doc = found.docs[0];                                         // no req: no Payload transaction carried (P16)
    return doc ? toShop(doc) : "gone";
  },
});
```
P11: the read goes through catalog's API, its open host service by the Assumptions, never through
`payload.products` in the shared Postgres. P12: shop is an anti-corruption layer towards catalog;
`PayloadProduct` appears only in this adapter (and the handler of `ProductChanged`). P19: catalog's
product is named `PayloadProduct` here, shop's own copy is `CatalogProduct`/`ListedProduct`. P5: the
`Payload` instance is an argument chosen by assembly. P16: no `req` is passed, so no
`transactionID` joins catalog's writes to anything of shop's.

### p7-ok-shop-write-scope.md
```yaml
breaches: []
satisfies: [P5, P7, P10, P14, P16]
situation: shop's records in the shared Postgres via Drizzle
```
# A transaction port that hands the write scope as an argument
```ts
// packages/shop/src/adapters/driven/pg-transactions.ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { pgTransactionRunner } from "@teeladen/common/db/pg-transaction";
import { pgInbox } from "@teeladen/common/db/pg-inbox";
import { shopOutboxAdapter } from "./shop-outbox";
import { pgOrders } from "./pg-orders";
import { pgCarts } from "./pg-carts";
import { pgListings } from "./pg-listings";
import { pgEligibilities } from "./pg-eligibilities";
import { shopHandled } from "./schema";
import type { ShopTransactions } from "../../service/ports";

export const pgTransactions = (db: NodePgDatabase): ShopTransactions =>
  pgTransactionRunner(db, (tx) => ({
    orders: pgOrders(tx), carts: pgCarts(tx), listings: pgListings(tx), eligibilities: pgEligibilities(tx),
    outbox: shopOutboxAdapter(tx), inbox: pgInbox(tx, shopHandled),
  }));
```
```ts
// packages/shop/src/adapters/driven/pg-orders.ts (excerpt)
import { and, eq } from "drizzle-orm";
import type { PgTx } from "@teeladen/common/db/pg-transaction";
import { Order } from "../../domain/order";
import { orders, orderLines } from "./schema";
export class StaleAggregate extends Error {}

export const pgOrders = (tx: PgTx) => ({
  get: async (id: Order["id"]) => {
    const [row] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!row) return undefined;
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, id));
    return Order.parse(fromRows(row, lines));                          // parsed with the domain's schema (P2, P14)
  },
  save: async (o: Order) => {
    const updated = await tx.update(orders).set({ ...toRow(o), version: o.version + 1 })
      .where(and(eq(orders.id, o.id), eq(orders.version, o.version))).returning({ id: orders.id });
    if (updated.length !== 1) throw new StaleAggregate(`order ${o.id}`); // P10: the store fails a stale save
  },
  // insert, overdue ...
});
```
P7: the service opens one transaction through `ShopTransactions`, every writing port in the scope is
bound to it, the runner commits once after the callback returns and rolls back whole on a throw.
There is no global repository in any service's reach, so a write beside the transaction cannot be
written in a service. P5: the port speaks shop's terms; `PgTx` appears only in adapters. P16: the
transaction travels only as an argument. P10: reads happen through the same scope. P14:
`toRow` sets only the columns this code knows (`p14-ok-record-save-keeps-unknown-columns`).

### p12-ok-payment-stripe-acl.md
```yaml
breaches: []
satisfies: [P5, P12, P19]
situation: payment puts Stripe behind an anti-corruption layer on the way out
```
# Stripe's terms stop at payment's adapters
```ts
// packages/payment/src/adapters/driving/stripe-events.ts — translator used by the hook
import type Stripe from "stripe";
import type { ProviderEvent } from "../../domain/payment";

export const translateStripeEvent = (e: Stripe.Event): ProviderEvent | null => {
  switch (e.type) {
    case "payment_intent.succeeded":
      return { kind: "intent-succeeded", providerRef: e.data.object.id, paymentId: e.data.object.metadata.paymentId ?? null };
    case "payment_intent.payment_failed":
      return { kind: "attempt-failed", providerRef: e.data.object.id, paymentId: e.data.object.metadata.paymentId ?? null };
    case "charge.dispute.created": {
      const pi = e.data.object.payment_intent;
      return typeof pi === "string" ? { kind: "disputed", providerRef: pi, paymentId: null } : null;
    }
    default:
      return null;                                                    // no driving port for it: withheld (P4)
  }
};
```
P12: `Stripe.Event`, `PaymentIntent`, `Dispute` appear in the driven adapter and in this driving-side
translator only; payment's domain, services, ports and published language speak `Payment`,
`ProviderEvent`, `providerRef`. P5: the adapter touches Stripe through Stripe's package. P19:
Stripe's customer would be `StripeCustomer` in these modules, never `Customer`.

### p19-ok-billing-invoiceable-order.md
```yaml
breaches: []
satisfies: [P3, P19, P2]
situation: billing owns Invoice, dunning stage, gapless invoice numbers
```
# Billing's records under billing's names
```ts
// packages/billing/src/adapters/driving/shop-order-events.ts — handler parsing shop's published language
import { OrderPlacedV1, OrderPaidV1, OrderCancelledV1 } from "@teeladen/shop/offer";
import type { Envelope } from "@teeladen/common/envelope";
import type { BillingPorts } from "../../builders";

export const onShopOrderPlaced = (ports: BillingPorts) => async (e: Envelope) => {
  const shopOrder = OrderPlacedV1.parse(e.payload);                 // shop's order, named as shop's
  await ports.recordOrderFact({
    messageId: e.id, shopOrderId: shopOrder.orderId, orderVersion: shopOrder.orderVersion,
    fact: { kind: "placed", customerId: shopOrder.customerId, method: shopOrder.paymentMethod,
            lines: shopOrder.lines.map((l) => ({ sku: l.sku, title: l.title, quantity: l.quantity,
                                                  unitPriceGross: l.unitPriceGross, vatCategory: toVatCategory(l.taxClass) })) },
  });
};
const toVatCategory = (t: "tea" | "accessory") => (t === "tea" ? "reduced" : "standard") as const;
```
P19: in billing, "order" is shop's word for shop's order; billing's own record is `InvoiceableOrder`,
the example P19's Why names. P3: invoice, invoice number series and dunning stage are decided only
by billing's rules in billing's domain. P2: the mapping from tax class to VAT category is a
translation in the handler; the rates live once in billing's domain (`p2-ok-vat-rate-in-billing-domain`).

### p5-ok-fulfillment-worker-assembly.md
```yaml
breaches: []
satisfies: [P5, P4, P6]
situation: fulfillment's worker process has its own entry point and its own assembly
```
# One assembly per process
```ts
// apps/worker/src/main.ts — entry; started as `node --import ./dist/instrumentation.js dist/main.js`
import { serve } from "@hono/node-server";
import { readWorkerConfig } from "./config";
import { assembleWorker } from "./assembly";
import { threePlHookApp } from "./three-pl-hook";
import { scheduleEvery } from "@teeladen/common/schedule";

const config = readWorkerConfig(process.env);               // the only read of the environment
const worker = await assembleWorker(config);
serve({ fetch: threePlHookApp(worker.hookPorts, config.threePl.webhookSecret).fetch, port: config.port });
await scheduleEvery(worker.boss, "fulfillment.release-expired-holds", "*/5 * * * *", worker.scheduled.releaseExpiredHolds);
await scheduleEvery(worker.boss, "fulfillment.retry-unbooked", "*/15 * * * *", worker.scheduled.retryUnbooked);
process.on("SIGTERM", () => void worker.stop());
```
P5: every port of fulfillment gets its implementation in `assembleWorker` (see "fulfillment" above),
the configuration arrives as arguments, the hook receives its ports as an argument (it is
constructed by assembly, not by a framework, so it needs no courier). The web process has its own
assembly for what it builds of fulfillment (`StockLevels`, the outbox reader). P4: the scheduled
tasks are driving adapters making one acting call per tick.

### p16-ok-common-transaction-runner-by-shape.md
```yaml
breaches: []
satisfies: [P16, P5, P7]
situation: the common library's unit of work kept ambient in AsyncLocalStorage
```
# The fixture's ambient unit of work, and what replaces it
Refused (P16 "never as an ambient value"; P5: the service reaches the store through the common library):
```ts
// packages/common/src/db/unit-of-work.ts — NOT built
const als = new AsyncLocalStorage<PgTx>();
export const unitOfWork = <T>(db: NodePgDatabase, fn: () => Promise<T>) => db.transaction((tx) => als.run(tx, fn));
export const currentTx = (): PgTx => als.getStore() ?? raise("no unit of work");
// shop's checkout → billing's open host service in-process → billing's repository calls currentTx()
// and reads shop's uncommitted order inside shop's transaction
```
Built instead: `pgTransactionRunner` (see common library) hands the scope as the callback's
argument. Billing's repositories are bound to billing's own runner, built by billing's builder from
the same `db`; nothing in a call from shop to billing can carry shop's scope, because billing's
driving ports take none (P16 sentence 3) and shop's scope is not ambient. P5: shop's service opens
its transaction through `ShopTransactions`, shop's port, which the common library implements by
shape and assembly hands in.

### p3-ok-shared-kernel-values-only.md
```yaml
breaches: []
satisfies: [P3, P1, P12, P19]
situation: shared kernel holds Money and Sku
```
# Values and what computes values from arguments
```ts
// packages/kernel/src/money.ts
import Decimal from "decimal.js";
import { z } from "zod";
export const Money = z.object({ amount: z.string().regex(/^-?\d+\.\d{2}$/), currency: z.literal("EUR") });
export type Money = z.infer<typeof Money>;
const d = (m: Money) => new Decimal(m.amount);
const of = (x: Decimal): Money => ({ amount: x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2), currency: "EUR" });
export const money = (amount: string): Money => of(new Decimal(amount));
export const add = (a: Money, b: Money): Money => of(d(a).plus(d(b)));
export const times = (m: Money, q: number): Money => of(d(m).times(q));
export const sum = (ms: readonly Money[]): Money => ms.reduce(add, money("0"));
/** gross → net at a rate given as an argument; the rate is the caller's rule */
export const netOfGross = (gross: Money, rate: string): Money => of(d(gross).dividedBy(new Decimal(1).plus(rate)));
export const isPositive = (m: Money): boolean => d(m).greaterThan(0);
```
```ts
// packages/kernel/src/sku.ts
import { z } from "zod";
export const Sku = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/).brand<"Sku">();
export type Sku = z.infer<typeof Sku>;
```
P3: no record's schema (no `Order`, no `Product`), no rule deciding a record; `netOfGross` takes the
rate as an argument, so VAT rates stay in billing (S7). P1: pure, every runtime (`decimal.js`,
`zod`). P12: imports no system's published language. P19: `Money` and `Sku` mean the kernel's
meaning in every sharing system.

### p6-ok-fakes-for-external-systems.md
```yaml
breaches: []
satisfies: [P6]
situation: external systems Stripe, 3PL, bank API, mail provider
```
# Each driven port over an external system has a fake its declaring system writes
```ts
// packages/payment/test-support/fake-payment-provider.ts — written by payment, which declares the port
import type { PaymentProvider } from "../src/service/ports";
export const fakePaymentProvider = (scenario: { disputed?: ReadonlySet<string>; down?: boolean } = {}): PaymentProvider & { intents: Map<string, string> } => {
  const intents = new Map<string, string>();               // paymentId → providerRef
  const refunds = new Map<string, string>();
  return {
    intents,
    openIntent: async ({ paymentId }) => {
      if (scenario.down) throw new Error("provider unavailable");
      if (!intents.has(paymentId)) intents.set(paymentId, `pi_${paymentId}`);  // idempotent per payment, as Stripe with the key
      return { clientSecret: `${intents.get(paymentId)}_secret` };
    },
    refund: async ({ providerRef, refundId }) => {
      if (scenario.disputed?.has(providerRef)) return { kind: "refused", reason: "disputed" };  // a refusal, not a failure
      const existing = refunds.get(refundId) ?? `re_${refundId}`;
      refunds.set(refundId, existing);
      return { kind: "made", providerRefundId: existing };
    },
    findRefund: async ({ refundId }) => (refunds.has(refundId) ? { providerRefundId: refunds.get(refundId) ?? "" } : undefined),
    cancelIntentFor: async (paymentId) => (intents.has(paymentId) ? { kind: "cancelled", providerRef: intents.get(paymentId) ?? "" } : { kind: "none" }),
    currentState: async () => "awaiting-customer",
  };
};
```
Likewise `fakeThreePl` (fulfillment), `fakeBankStatements` (billing), `fakeMailer` (shop and
billing each, since each declares its own `Mailer`), `fakeCatalog` (shop), `fixedClock`,
`sequentialIds`. P6: the external system writes no fake (F9); the declaring system does. Each fake
is held to the real adapter by the port's suite (`p6-ok-port-suite-parameterized`); the dispute is
answered as a refusal on both sides.

### p2-ok-catalog-config-rules-are-catalogs.md
```yaml
breaches: []
satisfies: [P2, P3, P4]
situation: editors set copy, price, sku, tax class; rules in Payload's collection config; req.user
```
# Catalog's rules about catalog's record stay in catalog's configuration
```ts
// packages/catalog/src/collections/products.ts (excerpt)
{ name: "price", type: "number", required: true,
  validate: (v: number | null | undefined) => (typeof v === "number" && v > 0) || "Preis muss über 0 liegen" },
{ name: "sku", type: "text", required: true, unique: true },
```
```ts
// packages/shop/src/domain/listing.ts — shop does not restate catalog's rule; it parses what catalog decided
export const CatalogProduct = z.object({
  catalogId: z.string().min(1), slug: z.string().min(1), sku: Sku, title: z.string().min(1),
  unitPrice: Money, taxClass: TaxClass,
});
```
P2's third exception: these rules decide a record the external system keeps and no business rule of
this codebase decides, so they are catalog's own. Shop's `CatalogProduct` has no `price > 0`
refinement (S12): a listing whose price catalog decided is copied as decided. P3: the product's rules
sit with its owner. P4: `req.user` (Payload's auth) decides catalog's access only; no driving port of
shop takes it ambiently; where shop needs the editor (option B of T1) the hook passes
`requestedBy` as an argument.

### p8-ok-payload-outbox-product-changed.md
```yaml
breaches: []
satisfies: [P8, P14, P16, P18]
situation: afterChange hooks were to call shop's services; Payload's transaction can write its own collection
```
# Catalog tells of its change by a message in its own transaction
Refused (P8 sentence 3 and 4): an `afterChange` that calls `shop.refreshListing(...)` runs before
Payload's commit, so shop revalidates a page for a change that may roll back; and since Payload's
transaction can write a message, P8 sentence 4 asks for the message.

Built: `writeProductChanged` (see catalog above) writes `catalog.ProductChanged.v1` into the
`outbox` collection with `req`, so the document commits with the product or not at all. The relay
reads it through `catalogOutboxReader` (assembly's) after the commit. Shop and fulfillment each
subscribe:
```ts
// packages/shop/src/adapters/driving/catalog-events.ts
import { ProductChangedV1 } from "@teeladen/catalog/offer";
export const onProductChanged = (ports: ShopPorts) => async (e: Envelope) => {
  const notice = ProductChangedV1.parse(e.payload);                  // the one schema (P14)
  await ports.refreshListing({ messageId: e.id, catalogId: notice.productId });
};
```
P16: catalog's own outbox write rides Payload's own transaction, records of one owner. P18: the
message is a notice; readers fetch what the product is now, so order of arrival does not matter.

### p16-ok-sku-guard-hook-hands-no-req.md
```yaml
breaches: []
satisfies: [P16, P4, P5]
situation: Payload has its own transactions; a hook may run inside one
```
# A hook of this codebase passes nothing of Payload's `req` to a driving port
```ts
// apps/web/src/payload/sku-guard.ts — shop's hook (option B of T1); only what shop's port takes crosses
export const guardSkuChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const sku = typeof data.sku === "string" ? data.sku : undefined;
  if (!originalDoc || sku === undefined || sku === originalDoc.sku) return data;
  await shopPorts().requestSkuChange({ catalogId: String(originalDoc.id), sku, requestedBy: String(req.user?.id ?? "unknown") });
  const { sku: _ignored, ...rest } = data;                            // the keeper keeps the record as before
  return rest;
};
```
P16: `req` (with `req.transactionID`) never reaches shop; shop's use case runs and commits in its own
transaction. The driving port's input type (`{ catalogId; sku; requestedBy }`) takes nothing that
reaches a store, so the compiler holds it. P4: one acting call, the user arrives as an argument.
P5: the services come from the courier, read on every run.

### p15-ok-listing-replica-refreshed-on-notice.md
```yaml
breaches: []
satisfies: [P15, P9, P11, P12, P18, P8]
situation: shop reads the product, price and tax class included, through Payload's Local API
```
# Shop asks catalog when told of a change, not while a customer waits
```ts
// packages/shop/src/service/refresh-listing.ts — use case called for catalog.ProductChanged
export const makeRefreshListing = (d: { tx: ShopTransactions; catalog: Catalog; ids: IdGenerator }) =>
  async (m: { messageId: string; catalogId: string }) => {
    const current = await d.catalog.product(m.catalogId);            // asks catalog now: called for a message (P15)
    await d.tx.run(async (s) => {
      const known = await s.listings.byCatalogId(m.catalogId);
      const decided = refreshListing(known, current);               // domain: unchanged | upsert | remove
      if (decided.kind === "unchanged") return;                     // a repeat changes no record (P9, by the records)
      if (decided.kind === "remove") await s.listings.remove(m.catalogId);
      else await s.listings.save(decided.listing);
      await s.outbox.add(revalidate(d.ids.next(), decided.slug));   // the page follows the commit (P8)
    });
  };
```
P15: checkout and the product page read the `ListedProduct` replica, so they work while Payload's
Local API fails; only this message-called use case asks catalog. P18: two notices out of order both
fetch the latest state. P9: the use case tells a repeat by its records (an unchanged listing writes
nothing). P11/P12: through the API, translated in the adapter. The fetch runs before the transaction
opens, so no transaction is held open across catalog's answer; the decision is on that answer,
stale by the commit, which shop's rule accepts (`p10-ok-order-line-snapshot`).

### p11-ok-relay-reads-catalog-outbox-through-assembly.md
```yaml
breaches: []
satisfies: [P11, P5, P8]
situation: the relay reads Payload's outbox collection
```
# Assembly provides the reader of an external system's outbox
```ts
// apps/web/src/assembly/catalog-outbox-reader.ts
import type { Payload } from "payload";
import type { OutboxReader } from "@teeladen/common/outbox/relay";

export const catalogOutboxReader = (payload: Payload): OutboxReader => ({
  pending: async (limit) => {
    const r = await payload.find({ collection: "outbox", where: { deliveredAt: { exists: false } }, sort: "createdAt", limit, depth: 0 });
    return r.docs.map((doc) => ({ id: String(doc.id), type: doc.type, payload: doc.payload, writtenAt: doc.createdAt, trace: {} }));
  },
  markDelivered: async (ids) => {
    if (ids.length === 0) return;
    await payload.update({ collection: "outbox", where: { id: { in: [...ids] } }, data: { deliveredAt: new Date().toISOString() } });
  },
});
```
Glossary (Outbox): "for an external system's outbox, assembly does" provide the reader. P11: the
relay and the reader are no system; no system of this codebase reads catalog's outbox table. P5:
the reader reaches catalog through Payload's API, the instance handed by assembly. P8: marked only
after the bus holds each message.

### p11-ok-stock-field-through-fulfillment-ohs.md
```yaml
breaches: []
satisfies: [P11, P5, P13, P1]
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
```
# Payload's admin shows fulfillment's answer, not fulfillment's table
```tsx
// apps/web/src/payload/stock-field.tsx — fulfillment's driving adapter; Payload's admin renders it
import { Sku } from "@teeladen/kernel/sku";
import { fulfillmentPorts } from "../assembly/courier";

export async function StockField({ data }: { data?: { sku?: unknown } }) {
  const sku = Sku.safeParse(data?.sku);
  if (!sku.success) return <p>Keine gültige SKU</p>;
  const level = await fulfillmentPorts().stockLevel({ sku: sku.data });   // fulfillment's open host service, answering
  return <p>Bestand: {level.onHand} · reserviert {level.reserved} · verfügbar {level.available}</p>;
}
```
```ts
// packages/fulfillment/src/published/stock-level.ts — fulfillment's published language
export const StockLevelV1 = z.object({ sku: Sku, onHand: z.number().int(), reserved: z.number().int(), available: z.number().int() });
export type StockLevelQuery = (q: { sku: Sku }) => Promise<z.infer<typeof StockLevelV1>>;
```
P11: catalog's configuration (code this codebase writes for an external system) reads fulfillment's
record only through fulfillment's open host service. No field of the product holds stock, so
nothing in Payload can change it (P11 sentence 2 not reached). P13: what crosses is fulfillment's
published language. P5: Payload's admin constructs the component, so it reads the courier on each
render.

### p5-ok-payload-cycle-courier.md
```yaml
breaches: []
satisfies: [P5]
situation: Payload's config needs the hooks, the hooks need services, the services need the Payload instance
```
# The cycle is cut by a courier only assembly fills
```ts
// apps/web/src/assembly/courier.ts
import { createCourier } from "@teeladen/common/courier";
import type { ShopPorts } from "@teeladen/shop/offer";
import type { PaymentHookPorts } from "@teeladen/payment/offer";
import type { FulfillmentQueries } from "@teeladen/fulfillment/offer";
import type { Probe } from "./probe";

const shop = createCourier<ShopPorts>("shop");
const payment = createCourier<PaymentHookPorts>("payment");
const fulfillment = createCourier<FulfillmentQueries>("fulfillment");
const probe = createCourier<Probe>("probe");
export const shopPorts = () => shop.courier.read();
export const paymentPorts = () => payment.courier.read();
export const fulfillmentPorts = () => fulfillment.courier.read();
export const probePorts = () => probe.courier.read();
/** imported by ./index.ts only; biome noRestrictedImports forbids it elsewhere */
export const fillers = { shop: shop.fill, payment: payment.fill, fulfillment: fulfillment.fill, probe: probe.fill };
```
```ts
// apps/web/src/assembly/index.ts (excerpt) — the order breaks the cycle
const payload = await getPayload({ config: payloadConfig });             // config holds hooks that read the courier when they run
const shop = buildShop({ db, payload, startPayment: payment.ports.startPayment, mail: mailClient, clock, ids, fetch: globalThis.fetch, config: cfg.shop });
fillers.shop(shop.ports);                                               // before any request is served
```
P5's Why names this case: "a hook Payload's config takes before shop's services take the Payload
instance, cannot be handed it either. These read from a courier." Only assembly fills (the fillers
are not exported to anything else); the hooks, server functions and the stock field read on every
run; a read before filling throws.

### p15-ok-checkout-returns-client-secret.md
```yaml
breaches: []
satisfies: [P15, P8, P16, P7, P10, P4, P17]
situation: checkout must return a Stripe client_secret in the same request; payment creates it (saga step 2)
```
# Shop asks payment now because its rule needs the answer now
```ts
// packages/shop/src/service/checkout.ts
export const makeCheckout = (d: { tx: ShopTransactions; payments: PaymentGateway; clock: Clock; ids: IdGenerator }): Checkout =>
  async (input) => d.tx.run(async (s) => {
    const cart = await s.carts.get(input.cartId);
    if (!cart || cart.customerId !== input.customerId) return { kind: "refused", reason: "no-cart" } as const;
    const listings = await s.listings.bySkus(cart.lines.map((l) => l.sku));
    const eligibility = await s.eligibilities.get(input.customerId);
    const decided = placeOrder({ id: OrderId.parse(d.ids.next()), cart, listings, eligibility, method: input.method,
                                 shipTo: input.shipTo, now: d.clock.now() });
    if (decided.kind === "refused") return decided;
    let order = decided.order;
    let clientSecret: string | null = null;
    if (needsPaymentNow(order)) {                                      // domain: card orders are paid at checkout
      const started = await d.payments.start({ orderId: order.id, amount: orderTotal(order) }); // carries no transaction
      order = withPaymentRef(order, started.paymentRef);
      clientSecret = started.clientSecret;
    }
    await s.orders.insert(order);
    await s.outbox.add(orderPlaced(d.ids.next(), order), clearCart(d.ids.next(), cart, order),
                       sendConfirmation(d.ids.next(), order, input.locale));
    return { kind: "placed", orderId: order.id, clientSecret } as const;
  });
```
```ts
// packages/shop/src/domain/order.ts (excerpt)
/** Business rule: a card order is paid by the customer at checkout, so payment's answer is needed now. */
export const needsPaymentNow = (o: Order): boolean => o.method === "card";
```
P15: the one live dependency is backed by a rule of shop's domain. P8: the payment is a tentative
operation asked by a call beside the transaction, which the transaction does not carry; it is
confirmed only by the customer, after shop's commit returned the secret. P16: `payments.start`
takes an order id and an amount, no scope. P7: one aggregate, its messages, one commit. P17: if
shop's commit fails after payment committed, payment's `Payment` holds its own expiry (T5). P10:
cart, listings and eligibility are read in the committing transaction; the replicas are stale by
shop's rules (`p10-ok-pay-by-invoice-dunning-replica`, `p10-ok-order-line-snapshot`).

### p10-ok-pay-by-invoice-dunning-replica.md
```yaml
breaches: []
satisfies: [P10, P15, P11, P12, P18, P2]
situation: pay-by-invoice, not to a customer billing has put into dunning
```
# A replica of the dunning stage, and the rule that accepts it stale
```ts
// packages/shop/src/domain/invoice-eligibility.ts
export const InvoiceEligibility = z.object({ customerId: CustomerId, blocked: z.boolean(), billingVersion: z.number().int().nonnegative() });
export type InvoiceEligibility = z.infer<typeof InvoiceEligibility>;
/** Business rule: pay-by-invoice is refused to a customer billing has put into dunning, as far as shop's copy
 *  knows. A customer put into dunning since the copy was refreshed may still order by invoice; billing's dunning
 *  covers that invoice like any other. */
export const mayPayByInvoice = (e: InvoiceEligibility | undefined): boolean => e === undefined || !e.blocked;
/** keeps the higher version: billing writes one counter per customer (P18) */
export const applyDunningChange = (known: InvoiceEligibility | undefined, next: InvoiceEligibility): InvoiceEligibility | undefined =>
  known && known.billingVersion >= next.billingVersion ? undefined : next;
```
```ts
// packages/shop/src/adapters/driving/billing-events.ts — anti-corruption layer towards billing
import { DunningStageChangedV1 } from "@teeladen/billing/offer";
export const onDunningStageChanged = (ports: ShopPorts) => async (e: Envelope) => {
  const billingChange = DunningStageChangedV1.parse(e.payload);
  await ports.refreshInvoiceEligibility({ messageId: e.id, customerId: billingChange.customerId,
                                          blocked: billingChange.stage !== "none", billingVersion: billingChange.customerVersion });
};
```
P15: checkout does not call billing. P10 sentence 2: a decision on data whose change fails no
transaction of shop's store rests on a rule of shop that accepts it stale and says what follows.
P11: the read is billing's published event at shop's handler. P12: billing's `DunningStage` stops
at the handler; shop's domain knows `blocked`. P18: billing's per-customer version; the lower is
dropped. P2: the rule is stated once, in shop's domain.

### p10-ok-order-line-snapshot.md
```yaml
breaches: []
satisfies: [P10, P2, P11, P12, P3]
situation: checkout copies each line's price, sku and tax class from catalog's product
```
# A snapshot, the order's own fact from then on
```ts
// packages/shop/src/domain/place-order.ts (excerpt)
/** Business rule: an order is placed at the price, sku and tax class its listing shows when the customer
 *  checks out; a catalog change shop has not copied yet does not reprice the order, and a later one never does. */
const snapshotLine = (cartLine: CartLine, listing: ListedProduct): OrderLine =>
  OrderLine.parse({ sku: listing.sku, title: listing.title, quantity: cartLine.quantity,
                    unitPrice: listing.unitPrice, taxClass: listing.taxClass });
export const placeOrder = (i: PlaceOrderInput): PlaceOrderResult => {
  const bySku = new Map(i.listings.map((p) => [p.sku, p] as const));
  const lines: OrderLine[] = [];
  for (const l of i.cart.lines) {
    const listing = bySku.get(l.sku);
    if (!listing) return { kind: "refused", reason: "product-gone" };
    lines.push(snapshotLine(l, listing));
  }
  if (i.method === "invoice" && !mayPayByInvoice(i.eligibility)) return { kind: "refused", reason: "invoice-not-offered" };
  return { kind: "placed", order: newOrder(i, lines) };
};
```
P10: the order holds the price as its own fact (a snapshot), so it covers nothing of catalog's
record and fails no use case of catalog's; the listing is a replica, its staleness accepted by the
rule above. P11/P12: the values came through catalog's API into shop's terms. P3: the price is
catalog's fact, the order line's copy is shop's record decided by shop's rule.

### p8-ok-confirmation-mail-after-commit.md
```yaml
breaches: []
satisfies: [P8, P9, P4, P2, P15]
situation: shop sends an order-confirmation mail once the order commits
```
# The mail is a private message in checkout's transaction; a handler sends it
```ts
// packages/shop/src/service/send-order-confirmation.ts — called for shop.private.SendOrderConfirmation
export const makeSendOrderConfirmation = (d: { tx: ShopTransactions; mailer: Mailer }) =>
  async (m: { messageId: string; orderId: OrderId; locale: "de" | "en" }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;                    // repeat: nothing, success
    const order = await s.orders.get(m.orderId);
    if (!order) throw new Error(`order ${m.orderId} not visible yet`);
    await d.mailer.send(orderConfirmation(order, m.locale));            // decides nothing again (P8)
  });                                                                   // claim commits after the send
```
```ts
// packages/shop/src/domain/mail.ts
export const ORDER_MAIL_SENDER = "Teeladen <bestellung@teeladen.example>"; // the business's sender (P4's Why), not configuration
/** Business rule: the mail provider takes no key; a confirmation sent twice after a stop between send and commit is accepted. */
export const confirmationRepeat = "accepted" as const;
```
P8: the message commits with the order; the handler acknowledges only after the claim commits. P9:
claim and send in one transaction; a stop between send and commit resends, which shop's rule
accepts (P9 third sentence). P4: the locale arrives in the message. P15: called for a message, so it
may wait on the mail provider.

### p16-ok-billing-call-carries-no-transaction.md
```yaml
breaches: []
satisfies: [P16, P10, P15, P12]
situation: shop calls billing's open host service in-process while holding its own transaction
```
# Where shop's rule needs billing's current answer, the call carries nothing of shop's transaction
Placed as the alternative to the replica: a shop whose rule demands billing's current answer.
```ts
// packages/shop/src/adapters/driven/billing-dunning.ts — anti-corruption adapter behind shop's DunningNow port
import type { CurrentDunningStage } from "@teeladen/billing/offer";
export const billingDunningNow = (current: CurrentDunningStage): DunningNow => ({
  blocked: async (customerId) => (await current({ customerId })).stage !== "none",
});
```
```ts
// packages/shop/src/service/checkout.ts (variant excerpt)
const blocked = input.method === "invoice" ? await d.dunningNow.blocked(input.customerId) : false; // inside tx.run, carries no scope
```
```ts
// packages/billing/src/service/current-dunning-stage.ts — billing answers in its own read, no transaction of shop's
export const makeCurrentDunningStage = (q: DunningQueries): CurrentDunningStage => async ({ customerId }) =>
  ({ stage: (await q.stageOf(customerId)) ?? "none" });
```
P16: shop's scope is an argument of shop's callback only; billing's driving port takes
`{ customerId }`; billing reads through its own `db`, outside shop's transaction. P10: billing's
answer is stale by shop's commit; the variant needs shop's rule "a stage billing changes between its
answer and shop's commit is accepted". P15: this variant is allowed only with a shop rule "billing's
current stage decides"; without it the replica is the code (`p10-ok-pay-by-invoice-dunning-replica`),
which is what I built.

### p5-ok-stripe-client-built-by-payment-builder.md
```yaml
breaches: []
satisfies: [P5, P6]
situation: payment's Stripe client
```
# The client only payment's adapters use is built by payment's builder from configuration
```ts
// packages/payment/src/builders/index.ts
import Stripe from "stripe";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { stripeProvider } from "../adapters/driven/stripe-provider";
import { stripeWebhookVerifier } from "../adapters/driving/stripe-webhook-verifier";
import { pgPaymentTransactions } from "../adapters/driven/pg-transactions";
import * as uc from "../service";

export const STRIPE_API_VERSION = "2025-01-27.acacia" as const;   // same everywhere: imported (Convention)
export interface PaymentBuilderInput {
  db: NodePgDatabase; clock: Clock; ids: IdGenerator;
  config: { stripeSecretKey: string; stripeWebhookSecret: string };
}
export const buildPayment = (i: PaymentBuilderInput) => {
  const stripe = new Stripe(i.config.stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
  const tx = pgPaymentTransactions(i.db);
  const provider = stripeProvider(stripe);
  const ports = {
    startPayment: uc.makeStartPayment({ tx, provider, clock: i.clock, ids: i.ids }),
    recordProviderEvent: uc.makeRecordProviderEvent({ tx, clock: i.clock, ids: i.ids }),
    requestRefund: uc.makeRequestRefund({ tx, ids: i.ids }),
    executeRefund: uc.makeExecuteRefund({ tx, provider, ids: i.ids }),
    cancelPayment: uc.makeCancelPayment({ tx, ids: i.ids }),
    executeIntentCancel: uc.makeExecuteIntentCancel({ tx, provider, ids: i.ids }),
    requestExpiries: uc.makeRequestPaymentExpiries({ tx, clock: i.clock, ids: i.ids }),
    expirePayment: uc.makeExpirePayment({ tx, clock: i.clock, ids: i.ids }),
  };
  return { ports, hookPorts: { recordProviderEvent: ports.recordProviderEvent, webhook: stripeWebhookVerifier(stripe, i.config.stripeWebhookSecret) },
           handlers: paymentHandlers(ports) };
};
```
P5's Why: "a system builder is assembly's own part, and the client only its adapters use, the
payment provider's SDK, it builds from the configuration it receives." No module exports a Stripe
instance; a test builds payment with `fakePaymentProvider` through the service factories (P6).

### p9-ok-stripe-webhook-claimed-in-transaction.md
```yaml
breaches: []
satisfies: [P9, P8, P4, P18, P12, P5]
situation: Stripe webhooks arrive at least once, out of order, in Stripe's terms
```
# The hook acknowledges only after the claim and the change commit together
```ts
// apps/web/src/app/api/stripe/webhook/route.ts — payment's hook
import type Stripe from "stripe";
import { paymentPorts } from "@/assembly/courier";
import { translateStripeEvent } from "@teeladen/payment/adapters/driving/stripe-events";

export async function POST(request: Request): Promise<Response> {
  const { recordProviderEvent, webhook } = paymentPorts();          // read on every run
  const raw = await request.text();
  let event: Stripe.Event;
  try { event = webhook.verify(raw, request.headers.get("stripe-signature")); }
  catch { return new Response("bad signature", { status: 400 }); }  // cannot translate: withheld
  const translated = translateStripeEvent(event);
  if (!translated) return new Response(null, { status: 204 });      // no driving port for this type
  await recordProviderEvent({ messageId: event.id, event: translated }); // one acting call; a throw answers 500
  return new Response(null, { status: 200 });                        // the acknowledgement, after the commit
}
```
```ts
// packages/payment/src/service/record-provider-event.ts
export const makeRecordProviderEvent = (d: { tx: PaymentTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; event: ProviderEvent }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;                   // claimed under a unique key (P9)
    const payment = m.event.paymentId ? await s.payments.get(m.event.paymentId) : await s.payments.byProviderRef(m.event.providerRef);
    if (!payment) throw new PaymentNotYetVisible(m.event.providerRef); // fails, Stripe resends (P18 second means)
    const r = applyProviderEvent(payment, m.event);                    // forward-only status (P18)
    if (r.payment === payment) return;
    const saved = { ...r.payment, version: payment.version + 1 };
    await s.payments.save(r.payment);
    await s.outbox.add(...r.events.map((e) => published(d.ids.next(), saved, e)),
                       ...(r.cancelIntent ? [executeIntentCancel(d.ids.next(), saved)] : []));
  });
```
P9: the event id claimed inside the transaction that commits the change; a concurrent duplicate
blocks on the unique key and returns as a repeat once the first commits; a repeat succeeds. P8: the
200 is sent after the commit (a hook's answer is its acknowledgement). P18: Stripe sends in any
order; `applyProviderEvent` lets status move forward only, and payment's events carry
`paymentVersion` (the version the save commits) for shop. P4: one acting call. P12: Stripe's terms
stop at the translator. P5: the hook parses with Stripe's package and calls nothing at Stripe.

### p17-ok-payment-expiry-outlives-stripe-retries.md
```yaml
breaches: []
satisfies: [P17, P15, P9, P7, P10]
situation: Stripe stops resending a webhook after three days
```
# Payment's part ends on its own deadline, not on Stripe's retries
```ts
// packages/payment/src/service/request-payment-expiries.ts — scheduled task's one acting call
export const makeRequestPaymentExpiries = (d: { tx: PaymentTransactions; clock: Clock; ids: IdGenerator }) =>
  async () => d.tx.run(async (s) => {
    const due = await s.payments.expiredBefore(d.clock.now(), 500);
    await s.outbox.add(...due.map((paymentId) => expirePaymentMessage(`expire:${paymentId}`, paymentId))); // one message per item (P7)
  });
```
```ts
// packages/payment/src/service/expire-payment.ts — called for payment.private.ExpirePayment
export const makeExpirePayment = (d: { tx: PaymentTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; paymentId: string }) => d.tx.run(async (s) => {
    const p = await s.payments.get(m.paymentId);
    if (!p) return;
    const r = expire(p, d.clock.now());                     // domain: decides by the aggregate (the clock may come late)
    if (r.payment === p) return;                            // succeeded meanwhile, or already expired: by the records (P9)
    await s.payments.save(r.payment);                       // a concurrent webhook save fails one of the two (P10)
    await s.outbox.add(paymentFailed(d.ids.next(), r.payment), executeIntentCancel(d.ids.next(), r.payment));
  });
```
```ts
// packages/payment/src/domain/payment.ts (excerpt)
/** Business rule: a payment not confirmed by its expiry is given up: it is failed and its intent cancelled.
 *  A success the provider reports after that is still a success (the money was taken) and is published. */
export const expire = (p: Payment, now: Date): { payment: Payment } =>
  p.status === "awaiting-customer" && now >= p.expiresAt ? { payment: { ...p, status: "expired" } } : { payment: p };
```
```ts
// packages/payment/src/service/execute-intent-cancel.ts — executor; records the provider's answer
// tx: claim; ask provider.cancelIntentFor(paymentId); "already-succeeded" → applyProviderEvent(intent-succeeded)
// → PaymentSucceeded (shop refunds, saga step 7); "cancelled" | "none" → record cancelled; a timeout throws (retried)
```
P17: the moment payment stops waiting (`expiresAt`, 24 h, inside Stripe's three days) is in payment's
own aggregate; at it, payment ends its part (failed and cancelling) without any answer from Stripe.
A success Stripe reports later meets the same aggregate and wins by the business rule. A webhook
lost after three days is caught by the cancel executor's answer (`already-succeeded`). P15: the
executor is called for a message, so it may wait on Stripe. P9: the expiry message id is
deterministic per payment and the use case tells a repeat by its records.

### p17-ok-refund-refused-for-dispute.md
```yaml
breaches: []
satisfies: [P17, P10, P7, P9, P8, P13, P2]
situation: payment refunds when shop asks; a disputed payment is not refunded
```
# A refusal is committed as the outcome and reaches shop
```ts
// packages/payment/src/service/request-refund.ts — called for payment.RefundPayment.v1 (payment's own command)
export const makeRequestRefund = (d: { tx: PaymentTransactions; ids: IdGenerator }) =>
  async (m: { messageId: string; paymentId: string; amount: Money; reason: "order-cancelled" | "customer-request" }) =>
    d.tx.run(async (s) => {
      if (!(await s.inbox.claim(m.messageId))) return;
      const p = await s.payments.get(m.paymentId);
      if (!p) throw new PaymentNotYetVisible(m.paymentId);
      const r = requestRefund(p, { refundId: d.ids.next(), amount: m.amount });  // domain decides on the aggregate it saves
      await s.payments.save(r.payment);                                         // a dispute webhook racing fails one (P10)
      await s.outbox.add(r.kind === "refused"
        ? refundRefused(d.ids.next(), r.payment, r.refundId, "disputed")       // the step's outcome, published (P17)
        : executeRefund(d.ids.next(), r.payment, r.refundId));                 // the change, by private message (P8)
    });
```
```ts
// packages/payment/src/domain/refund.ts
/** Business rule: a payment whose charge the customer disputes is not refunded; the dispute returns the money. */
export const requestRefund = (p: Payment, req: { refundId: string; amount: Money }) =>
  p.disputed
    ? { kind: "refused" as const, refundId: req.refundId, payment: { ...p, refunds: [...p.refunds, { id: req.refundId, amount: req.amount, status: "refused" as const, providerRefundId: null }] } }
    : { kind: "accepted" as const, refundId: req.refundId, payment: { ...p, refunds: [...p.refunds, { id: req.refundId, amount: req.amount, status: "pending" as const, providerRefundId: null }] } };
/** Business rule: the provider keeps a refund key for a day; before refunding, the provider is asked whether
 *  a refund with this id exists, so a redelivery after a day refunds nothing twice. */
export const refundRepeat = "ask-provider-first" as const;
```
```ts
// packages/payment/src/service/execute-refund.ts — executor
export const makeExecuteRefund = (d: { tx: PaymentTransactions; provider: PaymentProvider; ids: IdGenerator }) =>
  async (m: { messageId: string; paymentId: string; refundId: string }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const p = await s.payments.get(m.paymentId);
    const refund = p?.refunds.find((x) => x.id === m.refundId);
    if (!p || !refund || p.providerRef === null) throw new Error("refund not executable yet");
    const existing = await d.provider.findRefund({ providerRef: p.providerRef, refundId: refund.id }); // refundRepeat
    const answer = existing ? { kind: "made" as const, providerRefundId: existing.providerRefundId }
                            : await d.provider.refund({ providerRef: p.providerRef, amount: refund.amount, refundId: refund.id });
    const r = recordRefundAnswer(p, refund.id, answer);                     // records, decides nothing again
    await s.payments.save(r.payment);
    await s.outbox.add(answer.kind === "made" ? paymentRefunded(d.ids.next(), r.payment, refund) : refundRefused(d.ids.next(), r.payment, refund.id, answer.reason));
  });
```
Refunds are records of the `Payment` aggregate (S19), so the dispute flag and the refund decision
are saved together (P7 one aggregate, P10 the cheapest means). P17: the refusal commits as the
outcome and is published as `RefundRefused` in payment's language, naming no sender; shop ends its
part on it (`p17-ok-saga-7-late-payment-refunded`). The adapter tells a refusal (`charge_disputed`)
from a failure (a timeout throws). P9: Stripe's idempotency key covers a day; beyond it payment's
rule asks the provider first.

### p18-ok-billing-facts-in-any-order.md
```yaml
breaches: []
satisfies: [P18, P9, P7, P17, P2]
situation: billing creates an invoice on OrderPaid, or on OrderPlaced for an order paid by invoice
```
# Billing records what it learns of an order and invoices when the facts suffice
```ts
// packages/billing/src/domain/invoiceable-order.ts (excerpt)
export type OrderFact =
  | { kind: "placed"; customerId: string; method: "card" | "invoice"; lines: InvoiceableLine[] }
  | { kind: "paid" } | { kind: "cancelled" } | { kind: "refunded"; refundId: string; amount: Money };

/** Business rules of billing:
 *  - a card order is invoiced once placed and paid; an invoice order once placed, unless cancelled first;
 *  - an order already invoiced is not invoiced again whatever arrives later (OrderPaid of an invoice order, step 6);
 *  - a cancelled order never invoiced gets no invoice and no credit note. */
export const learn = (o: InvoiceableOrder, fact: OrderFact, orderVersion: number | null): { order: InvoiceableOrder; draftNow: boolean } => {
  const known = applyFact(o, fact, orderVersion);                       // facts accumulate; none overrides another
  const draftNow = known.invoice.state === "none" && known.placed !== null && !known.cancelled
                   && (known.placed.method === "invoice" || known.paid);
  return { order: draftNow ? { ...known, invoice: { state: "draft", lines: invoiceLines(known.placed?.lines ?? []) } } : known, draftNow };
};
```
```ts
// packages/billing/src/service/record-order-fact.ts — for OrderPlaced, OrderPaid, OrderCancelled, PaymentRefunded
export const makeRecordOrderFact = (d: { tx: BillingTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; shopOrderId: string; orderVersion: number | null; fact: OrderFact }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const known = (await s.invoiceable.get(m.shopOrderId)) ?? emptyInvoiceableOrder(m.shopOrderId);
    const r = learn(known, m.fact, m.orderVersion);
    await s.invoiceable.upsert(r.order);                                 // insert of a new id fails if it came to exist (P10)
    if (r.draftNow) await s.outbox.add(assignInvoiceNumber(d.ids.next(), m.shopOrderId, d.clock.now().getUTCFullYear()));
  });
```
P18: `OrderPaid` before `OrderPlaced` records "paid" and drafts when "placed" arrives; the outcome
equals the order of writing. P9: claimed id; an equal order version is a repeat of facts already
known. P7: one aggregate per use case, numbering by message (T2). P17: billing's part ends in an
issued invoice, or in "never invoiced" by its rule.

### p2-ok-vat-rate-in-billing-domain.md
```yaml
breaches: []
satisfies: [P2, P3, P12]
situation: each invoice line needs its VAT rate from the tax class: 7% tea, 19% accessories
```
# The rates are stated once, in billing's domain
```ts
// packages/billing/src/domain/vat.ts
import { netOfGross, type Money } from "@teeladen/kernel/money";
/** Business rule (German VAT): reduced 7 %, standard 19 %. A change of rate is a change here and a deploy. */
export const VAT_RATES = { reduced: "0.07", standard: "0.19" } as const satisfies Record<VatCategory, string>;
export const invoiceLine = (l: InvoiceableLine) => {
  const rate = VAT_RATES[l.vatCategory];
  const grossTotal = times(l.unitPriceGross, l.quantity);
  return { ...l, vatRate: rate, net: netOfGross(grossTotal, rate), gross: grossTotal };
};
```
P2: the values a rule decides by are part of it; no `VAT_REDUCED` environment variable, no rate in
Payload's tax-class options, no copy in shop. P3: the rule decides what billing's invoice line holds,
so it sits in billing's domain, not in the kernel (S7). P12: shop's `taxClass` is translated to
billing's `VatCategory` in billing's handler.

### p9-ok-bank-poll-hands-on-transfer-ids.md
```yaml
breaches: []
satisfies: [P9, P4, P15, P12, P5]
situation: the bank API reports incoming transfers in the bank's terms
```
# Each polled transfer is a message under the bank's id
```ts
// packages/billing/src/adapters/driving/bank-poll.ts — scheduled task (driving adapter the clock calls)
import type { BankApiClient, BankApiTransfer } from "../bank/client";   // the bank's terms
export const bankPoll = (bank: BankApiClient, ports: Pick<BillingPorts, "recordIncomingTransfer">, lookbackDays: number) =>
  async (): Promise<void> => {
    const since = new Date(Date.now() - lookbackDays * 86_400_000);      // overlapping window: repeats are claimed
    const page: BankApiTransfer[] = await bank.listIncoming({ bookedFrom: since.toISOString().slice(0, 10) });
    for (const t of page) {
      await ports.recordIncomingTransfer({                               // one acting call per item (P4, S4)
        messageId: `bank:${t.transactionId}`,                            // the bank's id, the same every poll (P9)
        transfer: { amount: money(t.amount.value), reference: t.remittanceInformationUnstructured ?? "", payer: t.debtorName ?? "", bookedOn: t.bookingDate },
      });
    }
  };
```
P9: "an adapter that hands the use case rows without it leaves nothing to claim, and the next poll
credits the invoice again"; here the bank's transaction id is the message id. P15: a scheduled task
nobody is held on; a bank that is down delays the poll. P12: `BankApiTransfer` stops in this adapter.
P5: the bank client is an argument. `Date.now()` here is the driving adapter adapting the clock (S9).

### p7-ok-transfer-match-saves-one-aggregate.md
```yaml
breaches: []
satisfies: [P7, P9, P10, P17, P18]
situation: billing matches transfers to open invoices; some match none (wrong reference, amount short)
```
# A match saves the invoice's order; no match saves the transfer
```ts
// packages/billing/src/service/record-incoming-transfer.ts
export const makeRecordIncomingTransfer = (d: { tx: BillingTransactions; ids: IdGenerator }) =>
  async (m: { messageId: string; transfer: IncomingTransfer }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const number = invoiceNumberIn(m.transfer.reference);                // domain: parse "2026-000123" from the reference
    const target = number ? await s.invoiceable.byInvoiceNumber(number) : undefined;
    const r = applyTransfer(target, { ...m.transfer, transferId: m.messageId });
    if (r.kind === "unmatched") { await s.unmatched.insert(r.unmatched); return; } // the one aggregate: kept for a person
    await s.invoiceable.save(r.order);                                   // the other one aggregate
    if (r.settledNow) await s.outbox.add(invoicePaid(d.ids.next(), r.order), reassessDunning(d.ids.next(), r.order.customerId));
  });
```
```ts
// packages/billing/src/domain/transfer.ts (excerpt)
/** Business rules: a transfer whose reference names an open invoice is applied to it; short leaves it open for the
 *  rest, more settles it and keeps the surplus as credit on the invoice; a reference naming none is kept unmatched
 *  for manual matching or return. */
```
P7: one aggregate either way; the dunning stage clears by message (`ReassessDunning`), not in this
transaction. P10: the matched order is saved with its version; a concurrent match on the same
invoice fails one. P9: claimed transfer id; the transfer id is also kept in `appliedTransfers`.
P17: an unmatched transfer is a state billing's rule accepts (kept for a person); billing waits on no
other system for it. P18: transfers are different things; a return of a transfer (bank's reversal)
would be a later message about the same transfer id, applied against what billing knows.

### p7-ok-dunning-run-writes-one-message-per-customer.md
```yaml
breaches: []
satisfies: [P7, P10, P2, P18, P4, P8]
situation: scheduled dunning over unpaid invoices; stage rises with each reminder and clears once they pay
```
# One acting call per run, one use case per customer
```ts
// packages/billing/src/service/start-dunning-run.ts — the scheduled task's one acting call
export const makeStartDunningRun = (d: { tx: BillingTransactions; clock: Clock }) => async (m: { runId: string }) =>
  d.tx.run(async (s) => {
    const customers = await s.invoiceable.customersWithOverdue(d.clock.now());
    await s.outbox.add(...customers.map((c) => considerDunning(`dunning:${m.runId}:${c}`, c))); // P7: one message per item
  });
```
```ts
// packages/billing/src/service/consider-dunning.ts — per customer
export const makeConsiderDunning = (d: { tx: BillingTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; customerId: string }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const dunning = (await s.dunning.get(m.customerId)) ?? noDunning(m.customerId);
    const overdue = await s.invoiceable.overdueFor(m.customerId, d.clock.now());   // other aggregates, read not saved
    const r = nextDunningStep(dunning, overdue, d.clock.now());
    if (r.kind === "none") return;
    await s.dunning.save(r.dunning);                                                  // version compared
    await s.outbox.add(dunningStageChanged(d.ids.next(), r.dunning), ...(r.remind ? [sendReminder(d.ids.next(), r.dunning, overdue)] : []));
  });
```
```ts
// packages/billing/src/domain/dunning.ts (excerpt)
export const DUNNING = { reminderEveryDays: 14, stages: ["none", "reminder-1", "reminder-2", "collection"] as const, zone: "Europe/Berlin" } as const;
/** Business rule: a reminder decided while a transfer of the customer is being matched is accepted; the stage clears
 *  when the match commits (ReassessDunning). */
```
P7: the run writes messages only; each customer's change is its own use case saving one aggregate.
P10 sentence 2: the overdue invoices are read stale, accepted by the rule above. P2: interval, stages
and calendar zone in the domain (no `TZ`, no environment). P18: `DunningStageChanged` carries the
customer's dunning version, raised in the committing transaction. P8: the reminder mail is a
message.

### p18-ok-credit-note-whatever-arrives-first.md
```yaml
breaches: []
satisfies: [P18, P17, P7, P13]
situation: billing issues a credit note for each refund
```
# A refund learned before the invoice waits on the aggregate, not on the bus
```ts
// packages/billing/src/adapters/driving/payment-events.ts
import { PaymentRefundedV1 } from "@teeladen/payment/offer";
export const onPaymentRefunded = (ports: BillingPorts) => async (e: Envelope) => {
  const refunded = PaymentRefundedV1.parse(e.payload);
  await ports.recordOrderFact({ messageId: e.id, shopOrderId: refunded.orderReference, orderVersion: null, // not shop's fact: no order version
                                fact: { kind: "refunded", refundId: refunded.refundId, amount: refunded.amount } });
};
```
```ts
// packages/billing/src/domain/invoiceable-order.ts (excerpt)
/** Business rules: a refund of an issued invoice gets a credit note; a refund learned before the invoice is issued
 *  is kept and gets its credit note when the invoice is issued; a refund of an order never invoiced (cancelled,
 *  saga step 7) gets none. Payment's refunds and shop's order facts do not conflict: each adds what it tells. */
```
P18 sentence 3: two writers (shop, payment) tell of one order; billing's rule says how both
combine. P18 sentence 1: whichever arrives first, the records end as the order of writing would
leave them. P17: the credit note's number goes by `AssignCreditNoteNumber` like invoices (T2). P13:
billing reads payment's `orderReference` as payment's published language carries it. The fixture's
"for each refund" yields to billing's rule for never-invoiced orders (N20).

### p18-ok-cancel-before-placed-kept.md
```yaml
breaches: []
satisfies: [P18, P9, P7]
situation: OrderPaid or OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved
```
# The early message is recorded, not dropped as "not found"
```ts
// packages/fulfillment/src/domain/reservation.ts (excerpt)
export const Reservation = z.object({
  orderId: z.string().uuid(),
  placed: z.object({ method: z.enum(["card", "invoice"]), lines: z.array(ReservationLine), paymentDueBy: z.date().nullable(), shipTo: Address }).nullable(),
  paid: z.boolean(), cancelled: z.boolean(), lastOrderVersion: z.number().int(),
  hold: z.discriminatedUnion("state", [
    z.object({ state: z.literal("none") }),
    z.object({ state: z.literal("held"), until: z.date().nullable() }),
    z.object({ state: z.literal("released") }),
    z.object({ state: z.literal("shipping"), shipmentId: z.string().uuid() }),
  ]),
  version: z.number().int().nonnegative(),
});
/** Business rules: an order known cancelled reserves nothing when its placement arrives; an order known paid
 *  ships as soon as it is placed; facts about an order accumulate whatever order they arrive in. */
export const applyOrderFact = (r: Reservation, fact: OrderFact, orderVersion: number, levels: readonly StockLevel[], now: Date): ReservationDecision => {
  if (orderVersion <= r.lastOrderVersion && fact.kind !== "placed") return { reservation: r, messages: [] }; // older or repeated news
  const known = accumulate(r, fact, orderVersion);
  if (known.cancelled) return release(known);                    // releases a hold if any, reserves nothing otherwise
  if (known.placed && known.hold.state === "none") return holdOrShip(known, levels, now);
  if (known.placed && known.paid && known.hold.state === "held") return ship(known);
  return { reservation: known, messages: [] };
};
```
```ts
// packages/fulfillment/src/service/record-order-fact.ts
export const makeRecordOrderFact = (d: FulfillmentDeps) =>
  async (m: { messageId: string; orderId: string; orderVersion: number; fact: OrderFact }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const current = (await s.reservations.get(m.orderId)) ?? unknownOrder(m.orderId);   // "not found" is no repeat (P9)
    const skus = m.fact.kind === "placed" ? m.fact.lines.map((l) => l.sku) : current.placed?.lines.map((l) => l.sku) ?? [];
    const levels = await s.stock.lockLevels(skus);                                       // T3 option A
    const r = applyOrderFact(current, m.fact, m.orderVersion, levels, d.clock.now());
    await s.reservations.upsert(r.reservation);
    await s.outbox.add(...r.messages.map((x) => toMessage(d.ids.next(), x)));             // BookShipment, EnsureArticle ...
  });
```
P18: the fixture's harm ("a dropped cancel leaves stock reserved for a dead order") cannot happen:
the cancel creates a `Reservation` with `cancelled: true`, and the later `OrderPlaced` meets it. P9:
claimed id; `OrderPlaced` is not skipped by an older version because placement carries the lines
whatever version it has. P7: one aggregate saved.

### p17-ok-reservation-hold-ends-without-shop.md
```yaml
breaches: []
satisfies: [P17, P2, P3, P18, P10]
situation: fulfillment reserves on OrderPlaced and releases on OrderCancelled
```
# Fulfillment holds stock, so it holds its own moment to stop waiting
```ts
// packages/fulfillment/src/domain/hold.ts
/** Business rule of fulfillment: stock for a card order is held until the payment deadline shop states on the
 *  order, plus an hour of fulfillment's grace; then it is released whatever shop sends. A paid order whose hold was
 *  released is reserved again if stock allows, else back-ordered. Invoice orders are not held; they ship. */
export const HOLD_GRACE_MINUTES = 60;
export const holdUntil = (placed: { method: "card" | "invoice"; paymentDueBy: Date | null }): Date | null =>
  placed.method === "card" && placed.paymentDueBy ? addMinutes(placed.paymentDueBy, HOLD_GRACE_MINUTES) : null;
```
```ts
// packages/fulfillment/src/service/release-expired-holds.ts — scheduled task's one acting call
export const makeReleaseExpiredHolds = (d: FulfillmentDeps) => async () => d.tx.run(async (s) => {
  const due = await s.reservations.heldUntilBefore(d.clock.now(), 500);
  await s.outbox.add(...due.map((orderId) => releaseHold(`release:${orderId}`, orderId)));
});
```
P17: fulfillment's part waits on shop's `OrderPaid` or `OrderCancelled` and holds stock meanwhile,
so its moment (`hold.until`) is in its own aggregate and ends the wait if shop's message never comes
(the fixture's dropped cancel). P2/P3: `paymentDueBy` is a fact of shop's order that shop publishes;
the grace and the hold are fulfillment's rule in fulfillment's domain (P3's Why: "where fulfillment
holds stock until the time asked, the hold time is shop's to ask"). P10: the release and a late
`OrderPaid` meet on the same `Reservation`; which wins is the rule's ("reserved again").

### p12-ok-3pl-hook-translates-and-acks-after-commit.md
```yaml
breaches: []
satisfies: [P12, P8, P9, P18, P4, P5]
situation: 3PL webhooks report shipments in the 3PL's terms
```
# The hook parses with the 3PL's schema, calls once, answers after the commit
```ts
// apps/worker/src/three-pl-hook.ts — fulfillment's hook, constructed by the worker's assembly
import { Hono } from "hono";
import { ThreePlWebhookEvent } from "@teeladen/fulfillment/adapters/three-pl/wire";
import { verifyThreePlSignature } from "@teeladen/fulfillment/adapters/three-pl/signature"; // pure HMAC check
import type { FulfillmentHookPorts } from "@teeladen/fulfillment/offer";

const toShipmentStatus = { NEW: "booked", PICKED: "picked", SHIPPED: "dispatched", DELIVERED: "delivered", CANCELLED: "cancelled" } as const;
export const threePlHookApp = (ports: FulfillmentHookPorts, secret: string) =>
  new Hono().post("/hooks/3pl", async (c) => {
    const raw = await c.req.text();
    if (!verifyThreePlSignature(raw, c.req.header("x-signature") ?? "", secret)) return c.body(null, 401);
    const parsed = ThreePlWebhookEvent.safeParse(JSON.parse(raw));
    if (!parsed.success) return c.body(null, 422);                                  // cannot translate: withheld
    const ev = parsed.data;
    await ports.recordCarrierEvent({ messageId: `3pl:${ev.event_id}`, consignmentId: ev.consignment.consignment_id,
                                     shipmentId: ev.consignment.external_ref, status: toShipmentStatus[ev.consignment.state] });
    return c.body(null, 204);                                                         // after the commit
  });
```
```ts
// packages/fulfillment/src/domain/shipment.ts (excerpt)
const ORDER = ["booked", "picked", "dispatched", "delivered"] as const;
/** Business rule: a shipment's status only moves forward; "cancelled" ends it only before "dispatched". */
export const advance = (s: Shipment, next: ShipmentStatus): Shipment => /* forward-only by ORDER */ s;
```
P12: `consignment`, `state`, `external_ref` stop at the hook; fulfillment's use case sees shipment
terms. P8: the 3PL is the holder; the 204 is the acknowledgement after the use case committed. P9:
the 3PL's event id claimed. P18: the 3PL's status only moves forward, which the receiver uses as
the means the external system offers. P4: one acting call. P5: the hook's ports arrive as an
argument from the worker's assembly.

### p9-ok-article-registration-asks-before-create.md
```yaml
breaches: []
satisfies: [P9, P8, P15, P11, P17, P7]
situation: the 3PL's article master needs each SKU before it ships one; fulfillment registers each new SKU
```
# Registering at the 3PL, which takes no key
```ts
// packages/fulfillment/src/service/ensure-article.ts — called for catalog.ProductChanged and private EnsureArticle
export const makeEnsureArticle = (d: { tx: FulfillmentTransactions; threePl: ThreePl; catalog: CatalogReader; ids: IdGenerator }) =>
  async (m: { messageId: string; sku?: Sku; catalogProductId?: string }) => {
    const product = await d.catalog.product(m);                       // catalog's REST API (P11), called for a message (P15)
    if (product === "gone") return;
    await d.tx.run(async (s) => {
      if (!(await s.inbox.claim(m.messageId))) return;
      const article = (await s.articles.get(product.sku)) ?? newArticle(product.sku);
      if (article.registered && sameMasterData(article, product)) return;            // by the records (P9)
      const atThreePl = await d.threePl.findArticle(product.sku);                     // P9: no key; ask before creating
      const answer = atThreePl ?? (await d.threePl.registerArticle(toMasterData(product)));
      const r = recordRegistration(article, product, answer);                          // records the 3PL's answer (P8)
      await s.articles.save(r.article);
      if (r.newlyRegistered) await s.outbox.add(articleRegistered(d.ids.next(), product.sku));
    });
  };
```
```ts
// packages/fulfillment/src/domain/article.ts (excerpt)
/** Business rule: the 3PL takes no key; an article is looked up before it is registered; the race that remains
 *  (two registrations of one new sku at once) is accepted, since the 3PL refuses a duplicate article number. */
export const articleRepeat = "ask-first-race-accepted" as const;
/** Business rule: a shipment the 3PL refused for an unknown article stays unbooked with that reason and is
 *  requested again when the article is registered. */
```
P9 third sentence: no key reaches the 3PL, so a business rule says what follows (ask first, accept the
narrow race). P8: decides nothing again beyond "made already?". P15: a message-called use case may
wait on catalog and the 3PL. P11: catalog's product through its API. P17: the unbooked shipment's
refusal is committed as the outcome (`UNKNOWN_ARTICLE` is a refusal, a timeout is a failure). P7:
one aggregate (`Article`); the shipments retry by `ArticleRegistered`.

### p6-ok-otel-noop-in-tests.md
```yaml
breaches: []
satisfies: [P5, P6, P4]
situation: OpenTelemetry keeps its own ambient context and returns a no-op span when it is empty
```
# Telemetry through no port, harmless with nothing registered
```ts
// packages/fulfillment/src/adapters/driven/three-pl-client.ts (excerpt)
import { trace, SpanStatusCode } from "@opentelemetry/api";
const tracer = trace.getTracer("fulfillment.three-pl");
export const threePlClient = (fetchFn: typeof fetch, baseUrl: string, apiKey: string): ThreePl => ({
  registerArticle: (a) => tracer.startActiveSpan("3pl.registerArticle", async (span) => {
    try { return await post(fetchFn, `${baseUrl}/articles`, apiKey, a); }
    catch (e) { span.setStatus({ code: SpanStatusCode.ERROR }); throw e; }
    finally { span.end(); }
  }),
  // ...
});
```
P5's exception: the tracer is common-library-level telemetry imported ready-made; its output changes
neither how a use case acts nor what it answers. P6 sentence 3: with no SDK registered (the default
suite) every span is a no-op and nothing is exported; the logger writes to stdout. P4: telemetry is
no input. The domain imports neither (P1).

### p5-ok-instrumentation-loads-first.md
```yaml
breaches: []
satisfies: [P5, P6]
situation: auto-instrumentation must load before any other import
```
# The process entry starts telemetry, then assembly
```ts
// apps/worker/src/instrumentation.ts — node --import ./dist/instrumentation.js dist/main.js
import { startTelemetry } from "@teeladen/common/telemetry/start";
startTelemetry({ serviceName: "teeladen-worker", jaegerOtlpUrl: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, metricsPort: Number(process.env.METRICS_PORT ?? 9464) });
```
```ts
// apps/web/instrumentation.ts — Next calls register() once, before routes load
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("@teeladen/common/telemetry/start");
  startTelemetry({ serviceName: "teeladen-web", jaegerOtlpUrl: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, metricsPort: Number(process.env.METRICS_PORT ?? 9464) });
  const { readWebConfig } = await import("./src/assembly/config");
  const { assembleWeb } = await import("./src/assembly");
  await assembleWeb(readWebConfig(process.env));                    // fills the couriers
}
```
P5: the entry is no code of a system; reading the environment here is the process's, and the values
reach systems only as arguments of `assembleWeb`. P6: tests never load these files.

### p16-ok-request-id-crosses-transaction-does-not.md
```yaml
breaches: []
satisfies: [P16, P4, P5]
situation: request id and trace context should cross system boundaries; the transaction must not
```
# Telemetry ambient and on the envelope; the transaction an argument
```ts
// packages/common/src/telemetry/request-context.ts — per-request ambient value, telemetry only
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../logger";
const requestStore = new AsyncLocalStorage<{ requestId: string }>();
export const withRequest = <T>(requestId: string, fn: () => Promise<T>): Promise<T> => requestStore.run({ requestId }, fn);
export const log = () => logger.child({ requestId: requestStore.getStore()?.requestId }); // used by adapters and services for logs
```
```ts
// apps/web/src/app/(shop)/checkout/actions.ts (excerpt)
return withRequest(headers().get("x-request-id") ?? crypto.randomUUID(), () => shop.checkout(input));
```
The request id rides `AsyncLocalStorage` into billing's open host service in-process (it is in the
same async context) and is put on the envelope beside the W3C trace context by `pgOutboxWriter`.
The transaction is in no `AsyncLocalStorage` (P16): it is the scope argument of a callback, which
no call into another system takes. P4: the request id decides nothing; if a record had to keep it
(an audit column), it would arrive as an argument. Two separate stores, so carrying one never
carries the other.

### p8-ok-durable-bus-acks-after-commit.md
```yaml
breaches: []
satisfies: [P8, P9]
situation: the common library's outbox relay and bus
```
# A chain of holders, each letting go once the next holds
```ts
// packages/shop/src/adapters/driving/handlers.ts (excerpt) — handlers return only after the use case committed
export const shopHandlers = (p: ShopPorts): Handler[] => [
  { name: "shop.on-payment-succeeded", type: "payment.PaymentSucceeded.v1",
    handle: async (e) => { const m = PaymentSucceededV1.parse(e.payload);
      await p.recordPaymentOutcome({ messageId: e.id, orderId: OrderId.parse(m.orderReference),
        outcome: { kind: "succeeded", paymentId: m.paymentId, paymentVersion: m.paymentVersion, amount: m.amount } }); } },
  { name: "shop.on-payment-failed", type: "payment.PaymentFailed.v1",
    handle: async (e) => { const m = PaymentFailedV1.parse(e.payload);
      await p.recordPaymentOutcome({ messageId: e.id, orderId: OrderId.parse(m.orderReference),
        outcome: { kind: "failed", paymentId: m.paymentId, paymentVersion: m.paymentVersion } }); } },
  // ... no try/catch that swallows: a throw is a non-acknowledgement
];
```
P8: outbox (committed with the change) → relay marks only after `boss.send` resolved → pg-boss keeps
the job in Postgres across any process stop, retries with backoff, dead-letters into a queue it
keeps → the worker resolves only after the use case's `tx.run` returned. P9: every link may
repeat; every use case claims.

### p8-ok-saga-1-order-placed-in-outbox.md
```yaml
breaches: []
satisfies: [P7, P8, P13, P14, P18]
situation: saga step 1: shop places the order and publishes OrderPlaced; fulfillment reserves
```
# The event is written with the order, in shop's published language, versioned
```ts
// packages/shop/src/published/order-placed.ts
import { z } from "zod";
import { Money } from "@teeladen/kernel/money";
import { Sku } from "@teeladen/kernel/sku";
export const ORDER_PLACED_V1 = "shop.OrderPlaced.v1" as const;
export const OrderPlacedV1 = z.object({
  orderId: z.string().uuid(), orderVersion: z.number().int().nonnegative(), customerId: z.string().uuid(),
  paymentMethod: z.enum(["card", "invoice"]), paymentDueBy: z.string().datetime().nullable(),
  lines: z.array(z.object({ sku: Sku, title: z.string().min(1), quantity: z.number().int().positive(),
                            unitPriceGross: Money, taxClass: z.enum(["tea", "accessory"]) })).min(1),
  shipTo: z.object({ name: z.string(), street: z.string(), postalCode: z.string(), city: z.string(), country: z.literal("DE") }),
});
export type OrderPlacedV1 = z.infer<typeof OrderPlacedV1>;
```
```ts
// packages/shop/src/service/translate.ts — the service translates domain → published language (P13)
export const orderPlaced = (id: string, o: Order): ShopOutgoing => ({
  id, type: ORDER_PLACED_V1,
  payload: OrderPlacedV1.parse({ orderId: o.id, orderVersion: o.version, customerId: o.customerId, paymentMethod: o.method,
    paymentDueBy: o.paymentDueBy?.toISOString() ?? null,
    lines: o.lines.map((l) => ({ sku: l.sku, title: l.title, quantity: l.quantity, unitPriceGross: l.unitPrice, taxClass: l.taxClass })),
    shipTo: o.shipTo }),
});
```
P7/P8: in checkout's transaction with the order. P13: the published module imports `zod` and the
kernel only, nothing of shop's domain; the service translates. P14: one schema, parsed by the writer
here and by every reader; `paymentMethod` is required from v1, so the P14 Why's `paidByInvoice`
trap does not arise. P18: `orderVersion` is the order's version, raised in the transaction that
commits each change.

### p13-ok-saga-3-payment-events-in-published-language.md
```yaml
breaches: []
satisfies: [P13, P14, P18, P12]
situation: saga step 3: Stripe's webhook reaches payment, which publishes PaymentSucceeded or PaymentFailed
```
# What crosses is payment's language, never payment's `Payment`
```ts
// packages/payment/src/service/translate.ts
export const published = (id: string, p: Payment, e: PaymentEvent): PaymentOutgoing =>
  e.kind === "succeeded"
    ? { id, type: "payment.PaymentSucceeded.v1", payload: PaymentSucceededV1.parse({ paymentId: p.id, orderReference: p.orderReference, paymentVersion: p.version, amount: p.amount }) }
    : { id, type: "payment.PaymentFailed.v1", payload: PaymentFailedV1.parse({ paymentId: p.id, orderReference: p.orderReference, paymentVersion: p.version }) };
```
P13 sentence 2: what shop handles is payment's published language; `Payment` (with `disputed`,
`refunds`, `expiresAt`) stays inside payment. P14: one schema per message in payment's
`published/`. P18: `paymentVersion` lets shop drop older news. P12: shop parses with payment's
schema in its handler and translates (`p8-ok-durable-bus-acks-after-commit`).

### p18-ok-saga-4-order-paid-versioned.md
```yaml
breaches: []
satisfies: [P18, P10, P7, P9, P8]
situation: saga step 4: shop marks the order paid and publishes OrderPaid; billing invoices, fulfillment ships
```
# One aggregate decides; a version tells receivers the order
```ts
// packages/shop/src/service/record-payment-outcome.ts
export const makeRecordPaymentOutcome = (d: { tx: ShopTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; orderId: OrderId; outcome: PaymentOutcome }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const order = await s.orders.get(m.orderId);
    if (!order) throw new OrderNotVisible(m.orderId);                 // fail, redelivered (P18)
    const r = applyPaymentOutcome(order, m.outcome);
    if (r.order === order) return;
    await s.orders.save(r.order);                                    // fails if the deadline's cancel committed meanwhile (P10)
    const saved = { ...r.order, version: order.version + 1 };
    await s.outbox.add(
      ...r.publish.map((k) => (k === "paid" ? orderPaid(d.ids.next(), saved) : orderCancelled(d.ids.next(), saved))),
      ...(r.refund ? [requestRefund(d.ids.next(), { paymentRef: r.refund.paymentId, amount: r.refund.amount })] : []),
    );
  });
```
P10: a payment success and the deadline's expiry race on one `Order`; the second save fails and is
redelivered, then decides afresh on what committed. P18: `OrderPaid` carries the saved version; billing
and fulfillment combine facts whatever their arrival (`p18-ok-billing-facts-in-any-order`,
`p18-ok-cancel-before-placed-kept`). P9: claimed; a second `PaymentSucceeded` for a paid order
changes nothing (`r.order === order`).

### p17-ok-saga-5-deadline-in-order.md
```yaml
breaches: []
satisfies: [P17, P2, P10, P7, P8]
situation: saga step 5: on PaymentFailed, or once the deadline passes, shop cancels and publishes OrderCancelled
```
# Shop's payment deadline is a business fact in shop's aggregate
```ts
// packages/shop/src/domain/order.ts (excerpt)
export const PAYMENT_WINDOW_MINUTES = 30;                          // business rule, not configuration (P2)
export const paymentDueBy = (method: "card" | "invoice", placedAt: Date): Date | null =>
  method === "card" ? addMinutes(placedAt, PAYMENT_WINDOW_MINUTES) : null;   // invoice orders: no deadline (step 6)
```
```ts
// packages/shop/src/service/expire-order.ts — called for shop.private.ExpireOrder (one per overdue order)
export const makeExpireOrder = (d: { tx: ShopTransactions; clock: Clock; ids: IdGenerator }) =>
  async (m: { messageId: string; orderId: OrderId }) => d.tx.run(async (s) => {
    const order = await s.orders.get(m.orderId);
    if (!order) return;
    const r = expireIfUnpaid(order, d.clock.now());                // decides by the aggregate: paid meanwhile → nothing
    if (r.order === order) return;                                 // repeat or late clock, by the records (P9)
    await s.orders.save(r.order);
    const saved = { ...r.order, version: order.version + 1 };
    await s.outbox.add(orderCancelled(d.ids.next(), saved), ...(r.cancelPayment ? [requestPaymentCancel(d.ids.next(), r.cancelPayment)] : []));
  });
```
P17: the moment is in shop's `Order` (`paymentDueBy`); the clock may come late, the use case decides
by the aggregate. Undoing payment's tentative operation is asked of payment (`CancelPayment`), which
may refuse it by reporting success, which leads to step 7. P10: the cancel and a late success meet on
one aggregate. P7: the sweep writes one `ExpireOrder` per overdue order. P8: `OrderCancelled` with
the change.

### p17-ok-saga-6-invoice-order-is-no-wait.md
```yaml
breaches: []
satisfies: [P17, P18, P9, P11]
situation: saga step 6: paid by invoice; billing invoices and fulfillment ships on OrderPlaced; InvoicePaid; OrderPaid already acted on
```
# A status that only shows billing's progress
```ts
// packages/shop/src/service/record-invoice-paid.ts — called for billing.InvoicePaid.v1
export const makeRecordInvoicePaid = (d: { tx: ShopTransactions; ids: IdGenerator }) =>
  async (m: { messageId: string; orderId: OrderId; invoiceVersion: number }) => d.tx.run(async (s) => {
    if (!(await s.inbox.claim(m.messageId))) return;
    const order = await s.orders.get(m.orderId);
    if (!order) throw new OrderNotVisible(m.orderId);
    const r = settleByInvoice(order);                              // awaiting-invoice-payment → paid; anything else: unchanged
    if (r.order === order) return;
    await s.orders.save(r.order);
    await s.outbox.add(orderPaid(d.ids.next(), { ...r.order, version: order.version + 1 }));
  });
```
P17: shop's invoice order holds nothing of shop's while billing collects (the stock is
fulfillment's, already shipping), and no shop rule limits the wait: "A status that only shows how
far another system has got, with nothing of this system's hanging on it, is no wait." Billing ends
the matter by its own dunning. P18: `OrderPaid` reaching billing and fulfillment after they acted on
`OrderPlaced` is a further fact their rules already cover (no second invoice, no second shipment).
It is no repeated delivery (a different message id), so P9 is not what keeps it harmless; the
records are. P11: shop learns of the invoice by billing's event.

### p17-ok-saga-7-late-payment-refunded.md
```yaml
breaches: []
satisfies: [P17, P10, P8, P11, P13]
situation: saga step 7: a payment succeeds after shop's deadline cancelled the order; the customer gets the money back
```
# The late success meets the cancelled order; shop asks payment to undo
```ts
// packages/shop/src/service/record-refund-outcome.ts — called for payment.PaymentRefunded.v1 / RefundRefused.v1
export const makeRecordRefundOutcome = (d: { tx: ShopTransactions }) =>
  async (m: { messageId: string; orderId: OrderId; outcome: "refunded" | "refused-disputed" | "refused-declined" }) =>
    d.tx.run(async (s) => {
      if (!(await s.inbox.claim(m.messageId))) return;
      const order = await s.orders.get(m.orderId);
      if (!order) throw new OrderNotVisible(m.orderId);
      await s.orders.save(endRefund(order, m.outcome));
    });
```
```ts
// packages/shop/src/domain/refund.ts
/** Business rules: a refund refused because the charge is disputed is accepted: the dispute returns the money.
 *  A refund the provider declined for another reason is accepted and shown to support on the order. */
export const endRefund = (o: Order, outcome: "refunded" | "refused-disputed" | "refused-declined"): Order => ({ ...o, refund: outcome });
```
P17: shop's part ends by undoing (refund asked of payment, the system that took the payment) or by
accepting payment's refusal, each by a rule of shop's domain; nothing throws until it parks. Shop's
"refund requested" holds nothing of shop's and no rule limits it, so it is no wait (P17 sentence 3);
payment's part holds the refund until Stripe answers. P10: the success and the cancel met on one
aggregate (`applyPaymentOutcome`). P8: the refund request commits with the order's change. P13:
`RefundPayment` is payment's command, translated in shop's outbox adapter.

### p11-ok-dashboard-on-backoffice-replicas.md
```yaml
breaches: []
satisfies: [P11, P16, P15, P12, P13, P19]
situation: an admin dashboard joins orders, invoices and shipments in the one Postgres
```
# The join runs over backoffice's own replicas
Refused (P11: a read past the owners' published language; P16 if run in a transaction):
```sql
select o.id, o.status, i.number, s.state from shop.orders o
left join billing.invoiceable_orders i on i.shop_order_id = o.id
left join fulfillment.shipments s on s.order_id = o.id;
```
Built:
```ts
// packages/backoffice/src/adapters/driving/handlers.ts — replicas fed by the owners' published events
export const backofficeHandlers = (p: BackofficePorts): Handler[] => [
  { name: "backoffice.on-order-placed", type: "shop.OrderPlaced.v1", handle: async (e) => {
      const m = OrderPlacedV1.parse(e.payload);
      await p.recordOrder({ messageId: e.id, orderId: m.orderId, version: m.orderVersion, status: "placed", method: m.paymentMethod, total: totalOf(m.lines) }); } },
  { name: "backoffice.on-invoice-issued", type: "billing.InvoiceIssued.v1", handle: async (e) => {
      const m = InvoiceIssuedV1.parse(e.payload);
      await p.recordInvoice({ messageId: e.id, orderId: m.shopOrderId, number: m.number, version: m.invoiceVersion }); } },
  { name: "backoffice.on-shipment-changed", type: "fulfillment.ShipmentChanged.v1", handle: async (e) => {
      const m = ShipmentChangedV1.parse(e.payload);
      await p.recordShipment({ messageId: e.id, orderId: m.orderId, state: m.state, version: m.shipmentVersion }); } },
];
```
```ts
// packages/backoffice/src/adapters/driven/pg-overview.ts — answering, over backoffice's own tables
export const pgOverview = (db: NodePgDatabase): OverviewQueries => ({
  page: async ({ limit, before }) => (await db.select().from(orderView)
    .leftJoin(invoiceView, eq(invoiceView.orderId, orderView.orderId))
    .leftJoin(shipmentView, eq(shipmentView.orderId, orderView.orderId))
    .where(before ? lt(orderView.placedAt, before) : undefined).orderBy(desc(orderView.placedAt)).limit(limit)).map(toOverviewRow),
});
```
P11: each owner's records reach backoffice only as published events at backoffice's handlers. P16:
no transaction reads two owners' records. P15: the dashboard answers while billing or fulfillment
is down. P12/P19: each upstream's terms translated in the handlers (`InvoiceRow`, `ShipmentRow`).
P13: billing and fulfillment must publish `InvoiceIssued` and `ShipmentChanged` carrying what the
dashboard shows: the cost is a published language grown for a reader (N6).

### p8-ok-revalidate-after-listing-commits.md
```yaml
breaches: []
satisfies: [P8, P9, P4]
situation: a Payload edit should revalidate the cached shop page
```
# The page is revalidated after the change it shows has committed twice over
```ts
// packages/shop/src/service/revalidate-product-page.ts — called for shop.private.RevalidateProductPage; writes nothing
export const makeRevalidateProductPage = (d: { pageCache: PageCache }) =>
  async (m: { messageId: string; slug: string }) => { await d.pageCache.revalidateProduct(m.slug); };
```
```ts
// packages/shop/src/adapters/driven/page-cache.ts — Next's data cache is the outside it adapts
export const httpPageCache = (fetchFn: typeof fetch, url: string, secret: string): PageCache => ({
  revalidateProduct: async (slug) => {
    const r = await fetchFn(url, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
                                   body: JSON.stringify({ tags: [`product:${slug}`] }) });
    if (!r.ok) throw new Error(`revalidate failed: ${r.status}`);      // fails, redelivered
  },
});
```
```ts
// apps/web/src/app/api/internal/revalidate/route.ts — Next's cache endpoint (calls no driving port)
import { revalidateTag } from "next/cache";
export async function POST(req: Request): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${process.env.REVALIDATE_SECRET}`) return new Response(null, { status: 401 });
  const { tags } = (await req.json()) as { tags: string[] };           // JSON body typed at the boundary
  for (const t of tags) revalidateTag(t);
  return new Response(null, { status: 204 });
}
```
P8: Payload's change committed (outbox document), shop's listing committed (the message is written in
`refreshListing`'s transaction), then the page is revalidated; a revalidation from the hook would
show a change that may roll back, or the old listing. P9: a cache refreshed twice ends as once; the
use case writes nothing and claims nothing (S2). P4: one acting call per message.

### p5-ok-probes-outside-layers.md
```yaml
breaches: []
satisfies: [P5]
situation: /health pings the database; /metrics is scraped
```
# Probes report on the process and sit outside the layers
```ts
// apps/web/src/app/health/route.ts — probe
import { probePorts } from "@/assembly/courier";
export async function GET(): Promise<Response> {
  const ok = await probePorts().ping().then(() => true, () => false);  // assembly's pool, no second pool
  return Response.json({ db: ok ? "up" : "down" }, { status: ok ? 200 : 503 });
}
```
```ts
// apps/web/src/assembly/index.ts (excerpt)
fillers.probe({ ping: async () => { await db.execute(sql`select 1`); } });
```
`/metrics` is the OpenTelemetry Prometheus exporter started by `startTelemetry`. Assumptions: probes
sit outside the layers; the health route touches the store client directly. It reads the courier
(S16) so it reuses assembly's pool rather than opening its own.

### p14-ok-record-save-keeps-unknown-columns.md
```yaml
breaches: []
satisfies: [P14, P2]
situation: a deploy runs old and new shop code side by side over the same orders
```
# A save writes only the columns its code knows
```ts
// packages/shop/src/adapters/driven/pg-orders.ts (excerpt)
const toRow = (o: Order) => ({
  status: o.status, paymentDueBy: o.paymentDueBy, paymentRef: o.paymentRef,
  lastPaymentVersion: o.lastPaymentVersion, refund: o.refund,
});                                       // update … set <these>: a column added by newer code is not overwritten
```
P14: "the old process loads a row the new code wrote, drops the field it does not know, and saves
the row back" cannot happen, because the save is a column-wise update, not a whole-row or JSON
document replacement; lines are immutable after placement. A new column ships nullable first,
readers before writers. P2: rows are parsed with the domain's `Order` schema.

### p19-ok-names-apart.md
```yaml
breaches: []
satisfies: [P19, P12]
situation: shop, payment and billing each meet another system's "Order", "Payment", "Product", "Customer"
```
# One word, one meaning per system
| system | its term | another system's word, named apart |
| --- | --- | --- |
| shop | `Order`, `Cart`, `ListedProduct`, `CatalogProduct` (shop's projection), `paymentRef` | `PayloadProduct` (catalog), `PaymentSucceededV1` (payment), `billingChange` (billing) |
| payment | `Payment`, `Refund`, `orderReference` | `Stripe.PaymentIntent`, `StripeCustomer` |
| billing | `InvoiceableOrder`, `Invoice`, `CustomerDunning`, `VatCategory` | `shopOrder` (handler local), `BankApiTransfer` |
| fulfillment | `Reservation`, `Stock`, `Shipment`, `Article` | `ThreePlConsignment`, `ThreePlArticle` |

P19 sentence 3: a local holding billing's order in shop would be `billingOrder`, never `order`.
P12: each such name lives only in the adapter that meets it.

### p1-ok-shop-domain-pure.md
```yaml
breaches: []
satisfies: [P1, P2, P4]
situation: shop's domain used by checkout and by the browser's form
```
# The domain takes time and ids as arguments and loads in the browser
```ts
// packages/shop/src/domain/checkout-form.ts — parsed by the server action and by the client form
import { z } from "zod";
export const CheckoutForm = z.object({
  method: z.enum(["card", "invoice"]),
  shipTo: z.object({ name: z.string().min(1), street: z.string().min(1), postalCode: z.string().regex(/^\d{5}$/), city: z.string().min(1), country: z.literal("DE") }),
  locale: z.enum(["de", "en"]),
});
```
```ts
// packages/shop/src/domain/order.ts (excerpt)
export const newOrder = (i: { id: OrderId; cart: Cart; method: "card" | "invoice"; shipTo: Address; now: Date }, lines: OrderLine[]): Order =>
  Order.parse({ id: i.id, customerId: i.cart.customerId, cartId: i.cart.id, cartVersion: i.cart.version, lines, method: i.method,
                status: i.method === "card" ? "awaiting-payment" : "awaiting-invoice-payment", placedAt: i.now,
                paymentDueBy: paymentDueBy(i.method, i.now), paymentRef: null, lastPaymentVersion: -1, refund: "none", shipTo: i.shipTo, version: 0 });
```
P1: imports `zod`, `date-fns` (`addMinutes`) and the kernel; no `node:` module, no logger, no
`Date.now()`, no `process`. P2: the client form parses with the same `CheckoutForm`. P4: the time and
the id arrive as arguments from the service, which has them from its `Clock` and `IdGenerator` ports.

### p6-ok-port-suite-parameterized.md
```yaml
breaches: []
satisfies: [P6, P10]
situation: shop's Orders port, on the fake and on Postgres migrated as production
```
# One suite per port, a flag away from the real run
```ts
// packages/shop/test/adapters/driven/orders.contract.ts
import { describe, it, expect } from "vitest";
import type { ShopTransactions } from "../../../src/service/ports";
import { anOrder, paid, cancelled } from "../../support/orders";

export const ordersContract = (name: string, make: () => Promise<ShopTransactions>) =>
  describe(`Orders port (${name})`, () => {
    it("should fail a save of an order loaded before another save committed", async () => {
      // given
      const tx = await make();
      const order = anOrder();
      await tx.run((s) => s.orders.insert(order));
      const stale = await tx.run((s) => s.orders.get(order.id));
      await tx.run(async (s) => { const fresh = await s.orders.get(order.id); if (fresh) await s.orders.save(paid(fresh)); });
      // when
      const attempt = tx.run(async (s) => { if (stale) await s.orders.save(cancelled(stale)); });
      // then
      await expect(attempt).rejects.toThrow(/order/);
    });
    it("should write nothing when the work throws", async () => {
      // given
      const tx = await make();
      const order = anOrder();
      // when
      await tx.run(async (s) => { await s.orders.insert(order); throw new Error("boom"); }).catch(() => undefined);
      // then
      expect(await tx.run((s) => s.orders.get(order.id))).toBeUndefined();
    });
  });
```
```ts
// packages/shop/test/adapters/driven/orders.fake.test.ts — default suite
ordersContract("fake", async () => fakeShopTransactions());
```
```ts
// packages/shop/test/adapters/driven/orders.pg.integration.test.ts — integration suite, migrations as in production
describe.runIf(process.env.SHOP_PG_URL !== undefined)("postgres", () => {
  ordersContract("postgres", async () => pgTransactions(await migratedWithDrizzleKit(process.env.SHOP_PG_URL ?? "")));
});
```
P6: the suite asserts what tests of use cases rely on (stale save fails, rollback whole), on the fake
and on Postgres set up by the same migrations as production, not pushed from table definitions. P10:
the stale-save behavior is asserted on both, so the fake cannot pass what production writes over.

### p4-ok-checkout-server-action-one-acting-call.md
```yaml
breaches: []
satisfies: [P4, P5, P2]
situation: shop's checkout reached by a server function
```
# The server function translates and makes one acting call
```ts
// apps/web/src/app/(shop)/checkout/actions.ts — shop's driving adapter
"use server";
import { cookies, headers } from "next/headers";
import { shopPorts } from "@/assembly/courier";
import { CheckoutForm } from "@teeladen/shop/domain/checkout-form";
import { withRequest } from "@teeladen/common/telemetry/request-context";

export async function checkoutAction(form: FormData) {
  const shop = shopPorts();                                             // courier, read each run (P5)
  const session = await shop.whoIs({ sessionId: (await cookies()).get("sid")?.value ?? "" }); // answering call → argument
  if (!session) return { error: "login" } as const;
  const parsed = CheckoutForm.safeParse({ method: form.get("method"), locale: form.get("locale"),
    shipTo: { name: form.get("name"), street: form.get("street"), postalCode: form.get("postalCode"), city: form.get("city"), country: "DE" } });
  if (!parsed.success) return { error: "invalid" } as const;            // cannot translate: withheld
  const requestId = (await headers()).get("x-request-id") ?? crypto.randomUUID();
  const r = await withRequest(requestId, () => shop.checkout({ ...parsed.data, customerId: session.customerId, cartId: session.cartId }));
  return r.kind === "placed" ? { orderId: r.orderId, clientSecret: r.clientSecret } : { error: r.reason };
}
```
P4: who the caller is comes from an answering call and becomes an argument; the form is parsed
with the domain's schema; one acting call; the pay-by-invoice check is the service's (no guard here
the service would not repeat). P5: the services come from the courier. P2: no second validator.

### p13-ok-command-declared-by-receiver.md
```yaml
breaches: []
satisfies: [P13, P12, P11, P2]
situation: shop asks payment to refund (step 7) and to cancel an intent (step 5)
```
# The receiver's command, translated by the sender's outbox adapter
```ts
// packages/shop/src/adapters/driven/shop-outbox.ts — the driven adapter behind shop's Outbox port
import { RefundPaymentV1, CancelPaymentV1 } from "@teeladen/payment/offer";   // payment's published language
import { pgOutboxWriter } from "@teeladen/common/db/pg-outbox";
import type { PgTx } from "@teeladen/common/db/pg-transaction";
import type { Outbox } from "../../service/ports";
import type { ShopOutgoing } from "../../service/outgoing";
import { shopOutbox } from "./schema";

type Row = { id: string; type: string; payload: unknown };
const toRow = (m: ShopOutgoing): Row => {
  switch (m.type) {
    case "shop.request.Refund":
      return { id: m.id, type: "payment.RefundPayment.v1",
               payload: RefundPaymentV1.parse({ paymentId: m.payload.paymentRef, amount: m.payload.amount, reason: "order-cancelled" }) };
    case "shop.request.CancelPayment":
      return { id: m.id, type: "payment.CancelPayment.v1", payload: CancelPaymentV1.parse({ paymentId: m.payload.paymentRef }) };
    default:
      return m;                                                           // shop's own published and private messages
  }
};
export const shopOutboxAdapter = (tx: PgTx): Outbox => {
  const writer = pgOutboxWriter<Row>(tx, shopOutbox);
  return { add: (...messages) => writer.add(...messages.map(toRow)) };
};
```
P13: "a command is the receiver's": payment declares `RefundPayment` and `CancelPayment` in its
published language; a change to how payment takes refunds is a change of payment's contract on
payment's terms. P12: payment's terms reach shop only in adapters that carry a call or a message
between the two (the gateway, the handlers, this outbox adapter), so shop is consistently an
anti-corruption layer towards payment. P11: payment's record changes only through payment's
command. P2: shop does not decide whether a disputed payment is refundable; payment does.

## Rules whose purpose the text does not tell

1. **P16, "It MUST travel only as an argument, never as an ambient value"**, inside a system that
   makes no in-process call into another system (fulfillment's worker: its handlers call no other
   system's driving port in-process). Every harm the Why names is a transaction reaching another
   system ("billing's repositories find shop's client"). For a transaction that cannot cross, the
   text gives no reason; I guessed the rule protects against the in-process upstream that F2 may
   add later, and against P7's "a write made beside it" the type checker cannot see. I followed it
   anyway.
2. **P2, "with every value it decides by that is the same for every candidate and that no record
   holds"**: the qualifier "the same for every candidate" is not explained. A fixed table that
   varies by candidate segment (dunning every 14 days for consumers, 30 for business customers) is
   not the same for every candidate and is held by no record. Read literally it falls outside the
   MUST and could live in configuration; the Why's harm (two images, two deadlines) applies to it
   in full. I guessed the qualifier only separates the candidate's own data ("the order's total")
   and put such tables in the domain.

## Statement and Why disagree

1. **P4, polled items.** Statement: "A driving adapter MUST reach the system only through its
   driving ports, with at most one acting call per call or message it handles". Why: "So does a
   poll: each item it returns, handed on under the id the other system gives it, is a message (P9),
   and the adapter makes one acting call per item". The clock calls the bank poll once; the
   Statement allows one acting call, the Why N. The glossary's Message ("What one system tells
   another ... so that it may act. It has an id") does not obviously cover a row the adapter fetched.
   Took the Why (S4).
2. **P2's Why vs P13's MAY.** P2 Why: "That constraint is the contract's, not the business rule's
   ... Leaving it behind is no error, so it is no statement of the rule." P13 Statement: "and MAY
   state in their own terms what a business rule of the domain also states". The document's own
   key: "MAY: permission where another rule would forbid". If P2 does not count the contract's
   constraint as a statement, no rule forbids it and the MAY grants nothing; if the MAY is needed,
   P2's Statement does forbid it, against P2's Why.
3. **P14, messages external systems write.** Statement: "Each message MUST have one schema, stated
   once, that its writer and every reader parse with." (Scope: "a message"). Why: "An external
   system's schemas change on its schedule (F9) and this rule cannot ask anything of them". Stripe's
   webhook events are messages (P9's Scope counts them); Stripe's writer parses with nothing of this
   codebase. Took the Why: the Statement binds writers of this codebase and the readers here (S8).
4. **P8, the executor's change.** Statement: "A use case called for such a message MUST make the
   change, deciding nothing again". Why: "Making the change without deciding, it records the owner's
   answer where there is one". P17 Statement: "A refusal of a step MUST be committed as the step's
   outcome". When the 3PL refuses (`UNKNOWN_ARTICLE`) or Stripe refuses a refund, the executor cannot
   make the change; the Statement reads as a breach, the Why and P17 as compliance. Took "attempt
   and record the answer" (S5).
5. **P7 vs P9 on the handled-message record.** P7 Statement: "The same transaction MUST carry the
   messages the use case writes to the outbox and the record of the message it is called for". P9
   Statement: "by the message's id claimed there ... or by the records it writes there". P7 reads as
   requiring a handled-message record always; P9 allows telling the repeat by the records alone. Took
   P9's reading: "the record" is whichever record tells the repeat, if any (S3).
6. **P15, the tentative call.** Statement, second sentence: "What else it needs another system to do
   it MUST ask for by a message." Checkout needs payment to *do* something (create an intent), and
   the first sentence's exception is attached only to "depend on another system answering". Why:
   "A use case may ask another system for a tentative operation by a call, apart from its outbox;
   P8 rules that such a call is safe, this rule when it is made: where a business rule needs the
   answer now." Read alone, the Statement forbids the call the Why allows. Took the Why: "what else"
   means beyond what a rule needs answered now.
7. **P11, data the owner hands over.** Statement: "MUST read it only through that open host service
   or the owner's published events delivered to a handler of the reading system." Why: "Data the
   owner hands over, the order lines in a `ReserveStock` command shop sends fulfillment, a field of
   an event, is a message in a published language, not a record of the owner's store, and the
   receiver reads it as handed." A command is neither the owner's open host service nor its
   published event; the Statement leaves it out, the Why lets it in by declaring it no read of a
   record. Took the Why.

## Readings picked

- **S1. P6, "on every other implementation against the outside it reaches in the deployed
  application, set up as it is there".** (a) the very instance production reaches (Stripe live, the
  production 3PL account, the bank account); (b) the same kind of outside configured as production
  configures it (Stripe test mode with the same webhook endpoint configuration, the 3PL's sandbox).
  Took (b). Under (a) the 3PL suite books real parcels and the bank suite needs real transfers.
  Under (b) an external system with no sandbox (the fixture does not say whether the 3PL or the bank
  offers one) leaves the suite with no compliant target short of production (N10).
- **S2. P9, "The use case MUST tell a repeat inside the transaction that commits its writes".**
  (a) every acting use case called for a message opens a transaction and claims; (b) a use case
  with no writes has no transaction to tell it in and only the third sentence applies. Took (b) for
  `revalidateProductPage` (a cache refreshed twice is no change); took (a) by choice for the
  confirmation mail, so a redelivery after a committed send sends nothing.
- **S3. P7, "the record of the message it is called for".** (a) always a handled-message row; (b)
  whatever record tells the repeat. Took (b): `refreshListing`, `expireOrder` and `expirePayment`
  tell repeats by their records and write no claim.
- **S4. P4, "per call or message it handles"** for the bank poll. (a) one acting call per poll; (b)
  one per polled item, each a message. Took (b). Under (a) the poll would call one use case that
  writes one message per transfer (P7's other route), also compliant.
- **S5. P8, "MUST make the change"**. (a) succeed in making it; (b) attempt it and record the
  owner's answer, refusal included. Took (b).
- **S6. P10, "the store MUST fail that transaction's writes where the data has changed, or come to
  exist, since the read"** with a row lock. (a) only a mechanism the store applies to every writer
  (version, unique key, isolation level); (b) a lock taken at the read and held to the commit, which
  the Why admits, even where the data "come to exist" (new reservation rows) is guarded only because
  every writer takes the same lock. Took (b) for T3 option A and the listing lock in T1 option B;
  under (a) only T3 option B complies.
- **S7. P3, "only values and what computes values from arguments"** vs "a business rule that decides
  what a record holds". `vatRate(taxClass)` computes a value from an argument and also decides what
  an invoice line holds. (a) kernel allowed; (b) billing's domain. Took (b); the kernel's
  `netOfGross` takes the rate as an argument.
- **S8. P14, "Each message"**: (a) every message, external writers included; (b) messages this
  codebase writes or parses. Took (b): Stripe's and the 3PL's events are parsed with one schema each
  (Stripe's package types; `wire.ts`) on this side only; catalog's outbox message, which this
  codebase writes, has one zod schema both sides parse with.
- **S9. P5, "A port's implementation, a client of the outside or a configuration value MUST reach
  code of a system as an argument"**: (a) any API that reaches outside (`fetch`, `Date`,
  `crypto.randomUUID`, `revalidateTag`); (b) constructed, stateful clients (a pool, an SDK
  instance). Took (a) where cheap: `fetch`, the clock and the id generator are handed in by assembly;
  the driving adapters that adapt the clock or the request (`Date.now()` in the bank poll,
  `crypto.randomUUID()` for a missing request id) use them directly as "the outside it adapts".
- **S10. Glossary Store, "Two clients are one store when one transaction can carry the writes of
  both"**: Payload's pool and shop's Drizzle pool open separate connections to one Postgres
  database. (a) "can" as wired: two stores; (b) "can" in principle: one database, one store. Took
  (b). Under (a) P7's "a record of this system kept in a second store" and P8's "an outbox in each"
  would apply to Payload's tables, which changes nothing here because catalog's records are
  catalog's.
- **S11. P18, "messages that tell of the same thing" / "conflict over one thing"**. Payment's events
  tell of a payment, billing's `InvoicePaid` of an invoice, both change shop's `Order`. (a) the thing
  is what the message is about (version per payment, per invoice; the conflict on the order is a
  sentence-3 case); (b) the thing is the record the receiver changes. Took (a): shop keeps
  `lastPaymentVersion`, and shop's rule decides between payment and billing ("whichever first").
- **S12. P2, catalog's "a price above zero"** and shop's own order line. (a) shop's line schema
  `isPositive(unitPrice)` restates catalog's rule (P2 forbids); (b) it is shop's own rule about
  shop's record. Took (a): shop's schemas carry no positivity on catalog-decided prices; shop's
  `quantity` positivity is shop's own rule (cart lines are shop's).
- **S13. P15, "depend on another system answering while it runs"** for catalog reached in-process
  through Payload's Local API on the same Postgres. (a) in-process and same database: no separate
  availability, no dependency; (b) another system regardless (the Why: "An upstream in the same
  process is no exception"). Took (b): checkout reads the replica.
- **S14. P2's Why, "A system that has to be asked before a record is written holds a rule that
  decides what the record holds, so the record is that system's"**. (a) binding: a consequence of the
  glossary's Owner, deciding ownership; (b) an illustration. Took (a); it drives T1.
- **S15. P17, "Where its part waits on another system"**: billing's invoice order waits on the
  customer's transfer, reported by the bank. (a) the bank is the other system: P17 applies; (b) the
  customer is no system: P17 does not reach it. Took (b) and still held the due date in the invoice
  (dunning needs it).
- **S16. P5 third sentence, "reach code of a system"**: (a) binds probes, Payload's configuration and
  process entries; (b) binds only code of a system's layers and offer. Took (b): `payload.config.ts`
  reads `DATABASE_URL` at module load (catalog's own, Assumptions), entries read the environment, the
  health probe reads a courier by choice.
- **S17. P1, "MUST load on every runtime of the language"**: which runtimes. Took Node, Bun, Deno,
  browsers and WinterCG edge runtimes; `Intl` (used by `date-fns-tz`) exists on all of them.
- **S18. P13 sentence 1, "Code of another system"**: (a) includes the configuration this codebase
  writes for an external system; (b) does not. Took (a) as the safer: the stock field imports only
  fulfillment's offer; I placed it as fulfillment's driving adapter, where (a) and (b) agree.
- **S19. P7, "MUST save at most one aggregate"** with the fixture's "payment owns Payment, Refund".
  (a) Refund is its own aggregate: the refund decision reads the `Payment`'s dispute flag unsaved and
  needs a stale rule (P10); (b) refunds are records of the `Payment` aggregate. Took (b).
- **S20. P12, "reach that published language ... only by its adapters that carry a call or a
  message"** and the adapters' tests. Shop's test of its payment gateway adapter imports payment's
  fake (typed by payment's published language). (a) tests of an adapter count as the adapter; (b)
  they are other code of shop and breach. Took (a); P13's Why ("The downstream's own tests ... fake
  the upstream through the fake the offer exports") supports it.
- **S21. P10, "whose change fails no transaction of this store"** for shop's replicas. A replica
  row is in shop's store, but its refresh fails no checkout, since checkout reads it and does not
  save it. (a) the replica's change "fails no transaction", so a stale rule is needed; (b)
  the replica is shop's own record, read in the committing transaction, so sentence 1 covers it.
  Took (a): the staleness that matters is against the owner, which no store failure covers; shop's
  rules accept it.

## Notes

- **N1.** "afterChange hooks call shop's services" read as a mechanism: replaced by catalog's outbox
  (P8 sentence 4, since the fixture says Payload's transaction can write a collection the relay
  reads). No `afterChange` of this codebase calls a system.
- **N2.** "a unit of work kept ambient in `AsyncLocalStorage`" read as a mechanism: refused by P16,
  replaced by the scope runner.
- **N3.** "shop reads the product ... through Payload's Local API" kept as a fact, placed in
  `refreshListing` (message-called), not in checkout.
- **N4.** "Calls billing's open host service in-process while holding its own ambient transaction":
  the call is placed as the variant for a shop rule needing billing's current stage; "ambient" is
  refused. The built code uses the replica.
- **N5.** "runs in its own worker process" read as: fulfillment's handlers, hook and sweeps run in
  the worker. Its answering `StockLevels` and its outbox reader are also built in the web process
  (Payload's admin needs the one, the relay the other). Nothing in the rules forbids a system built
  in two processes; the fixture may have meant fulfillment's code never loads in web.
- **N6.** "An admin dashboard joins ... in the one Postgres" read as a mechanism. Placed as a
  `backoffice` system the fixture does not list; billing and fulfillment then publish
  `InvoiceIssued` and `ShipmentChanged`, which the fixture does not name.
- **N7.** "A Payload edit should revalidate the cached shop page": `revalidateTag` works inside
  Next's request handling; a bus consumer in the same process may not reach Next's cache. Read as a
  fact of Next; shop's `PageCache` adapter calls an internal route. That route calls no driving port
  and is neither layer nor probe; the glossary has no name for code that is the outside a driven
  adapter reaches but lives in this repository.
- **N8.** Stripe PaymentIntents do not lapse by themselves; that fact (not in the fixture) drives T5.
- **N9.** The fixture does not say what happens when stock is short at `OrderPlaced`. I assumed
  fulfillment back-orders; a rule that refuses would need a `ReservationRefused` event and a shop
  rule cancelling the order (P17).
- **N10.** The fixture does not say whether the 3PL takes an idempotency key or offers a sandbox; I
  assumed neither (P9 rule "ask first", S1). The 3PL's article master holds data fulfillment decides
  (name, weight copied from catalog): if that article is a record fulfillment owns kept by the 3PL,
  P11 sentence 2 asks this codebase to configure the 3PL so nothing but fulfillment changes it, which
  a vendor portal may not allow.
- **N11.** "publishes `PaymentSucceeded` or `PaymentFailed`": Stripe's `payment_intent.payment_failed`
  is not final (the customer may retry in the same intent). I followed the fixture: payment fails the
  payment on it and cancels the intent; a success after that is step 7.
- **N12.** catalog's sku and the kernel's `Sku`: catalog (external) cannot share the kernel
  (glossary: "several systems of this codebase"), so Payload's config does not import `Sku`. A sku
  catalog allows but `Sku` refuses makes shop's listing refresh fail; I made the refresh drop such a
  product from the listing and log it. The fixture is silent on sku format.
- **N13.** Assumptions: an external system's published language includes "the types generated from
  this codebase's configuration of it". P13 sentence 3: a published language MUST NOT "be generated
  from the rest of it". Catalog's `payload-types.ts` is generated from catalog's whole configuration;
  the Assumptions' "its exports ... are its own" seems to exempt catalog from P13, but the two
  sentences meet on the same file. A Payload config change is then a compile break in shop's adapter
  (accepted, F9).
- **N14.** The world's P7 Why calls "the order placed, the cart still full" records no business rule
  allows; the property rule makes that state transient and expected (T4).
- **N15.** Words used by the rules and not in the glossary: *envelope* (P3, P4, P14), *export path*
  (P1, P12), *dead-letter queue* (P8, P9, P17), *sweep* (Assumptions), *candidate* (P2; the
  glossary's Specification uses it), *thing* (P18), *part* and *step* (P17; Saga has "steps"),
  *contract* (P2, P13, used for published language), *way in* (P4, P5; Port says "the way in"),
  *pending* (P8), *veto* (P8, P2), *executor* (P8 Provenance), *notice* (P18), *claim* (P9),
  *register* (P19, for the system glossary), *integration suite* (Assumptions; the glossary has
  integration test), *deploy* and *image* (P2, P4, P14).
- **N16.** "Stripe stops resending a webhook after three days" hung on: payment's expiry (24 h) and
  the cancel executor's `already-succeeded` answer catch a success whose webhook was lost.
- **N17.** "Request id ... should cross system boundaries" read as telemetry only; if a record ever
  keeps it, P4 makes it an argument.
- **N18.** "Payload's own auth supplies `req.user`" hung on: catalog's access control only; shop
  receives an editor id as an argument where it needs one.
- **N19.** The fixture gives no shipping address; `OrderPlaced` carries `shipTo`, since fulfillment
  needs it and P4's Why has the message carry what its handler needs.
- **N20.** "Issues a credit note for each refund" vs saga step 7: a refund of a cancelled, never
  invoiced order has no invoice to credit. Billing's rule issues none; read literally the fixture
  asks for one.
- **N21.** "`OrderPaid`, which billing and fulfillment have already acted on for this order": a
  different message, not a repeated delivery; harmless by each receiver's records and rules, not by
  P9.
- **N22.** "a mail provider (shop, billing)": each system declares its own `Mailer` port and writes
  its own fake; assembly builds one mail client and hands it to both builders.
- **N23.** The 3PL's webhooks need an HTTP endpoint; the fixture's worker gets one (a Hono server),
  since its handlers are fulfillment's.
- **N24.** The relay runs in the web process and publishes per handler; with pg-boss that means the
  web assembly knows the worker's handler names and types. "Assembly hands it the handlers" (Bus)
  then spans two processes' assemblies; how the bus finds handlers is the repository's
  (Assumptions), so I note it only.
- **N25.** A pitfall the rules catch but do not name: an `Outbox` port typed by an upstream's
  command types puts the upstream's terms into the service while the system's gateways translate,
  which P12 calls the third state. The outbox adapter is where an anti-corruption layer translates
  outgoing commands; P12's Why says so for `ReserveStock`, but the P2/P13 discussion of commands
  ("shop's `ReserveStock`, declared in shop's published language") reads at first like the sender's
  service builds them.
