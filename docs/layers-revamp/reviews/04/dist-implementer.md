# Implementer review, distilled set (property rules)

## Summary

- **T1 tension, P4 x P5: trace context and request id on the outbox envelope.** The fixture wants them carried across systems. P5's first sentence lets an adapter call common-library telemetry ready-made, and P4's Why lets it be written on the envelope. P4's Statement, sentence 2, forbids a driven adapter to use an ambient value "in nothing it writes". Code complies only by threading a `TraceCarrier` argument through every driving port into the outbox port, or by not carrying the trace at all.
- **T2 tension, P4 x P10: batch work started by the clock (dunning run, overdue orders).** One transaction over every customer fails on payments to unrelated customers, which P10's sentence 3 forbids. Looping acting calls in the scheduled task makes several acting calls for one handled call, which P4's sentence 3 forbids. Code complies only by fanning out: one acting call writes one private message per candidate, and P10's sentence 2 then needs a business rule that accepts the candidate list stale.
- **T3 tension, P18 x P15: catalog's `ProductChanged` without a version.** Payload carries no version raised in its transaction. P18's fallback for an external writer is to "take the thing's current state from the owner", and that makes the replica refresh wait on catalog for an answer no business rule needs now (P15). Code complies only by configuring a version into Payload's store (a revision column raised by a trigger under the row lock).
- **T4 tension, P10 x P15: a live read of another system.** P10's sentence 2 requires a business rule that accepts another system's live answer stale. P15's Why says that where a rule accepts a lagging value, "the replica serves". Read literally, P15's first exception is never open for reads, and the reconciliation at the payment deadline (Stripe) has nothing to read. It complies only by a rule that tells call-duration staleness apart from replica lag (reading S3).
- **Statement and Why disagree on P4** (ambient trace context written by the outbox adapter), **P5** (the Why numbers the sentences in an order the Statement does not have), **P7** ("hands to each call" against "argument or ambient value ... this rule needs only that every write is carried") and **P8** (the Why calls TX-29 "a SHOULD", and the Statement has no SHOULD).
- **Purpose not told for P4 sentence 2** (configuration in what a driven adapter writes, when a driving adapter may pass the same value as an argument), **P9 sentence 3** (a *business* rule required for repeats that have no business meaning, such as cache revalidation) and **P17 sentence 2** (a deadline required where the wait has no consequence: invoice orders).
- **The fixture placed against the rules:**
  - The ambient unit of work in the common library goes unused.
  - "afterChange hooks call shop's services" becomes a catalog outbox document written in Payload's transaction.
  - "beforeChange asks shop" becomes catalog's configuration calling shop's open host service as a downstream would.
  - The admin dashboard becomes a new `backoffice` system with its own replica.
  - "shop reads product via Local API" moves out of checkout into a reconciliation.
  - Invoice orders get a settlement deadline that only accepts.
- **Counts:**
  - cannot-comply: 0
  - tension: 4
  - ok examples written: 52
  - purpose-not-told: 3
  - readings picked: 19

## Findings

### p4-tension-trace-context-on-envelope.md
```yaml
breaches: [P4]
satisfies: [P5, P8, P14]
situation: common library — request id and trace context should cross system boundaries
finding: tension
```
# Outbox adapter writes the ambient trace context into the envelope
```ts
// packages/common/src/messaging/drizzle-outbox.ts — implements each system's Outbox<Tx> port by shape
import { context, propagation } from "@opentelemetry/api";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DrizzleTx } from "../db/drizzle-transactions";
import { outboxColumns } from "./outbox-table";

export const drizzleOutbox = <M extends { readonly type: string }>(table: PgTable & typeof outboxColumns) => ({
  async add(tx: DrizzleTx, message: { id: string; deliverAt: Date | null; body: M }): Promise<void> {
    const trace: Record<string, string> = {};
    propagation.inject(context.active(), trace); // ambient value -> written into a record
    await tx.insert(table).values({ id: message.id, type: message.body.type, body: message.body, trace, deliverAt: message.deliverAt });
  },
});
```
```ts
// closest code that satisfies P4 sentence 2: the carrier is an argument from the driving adapter down
// systems/shop/service/driving-ports.ts
import type { TraceCarrier } from "@teeladen/common/telemetry/carrier"; // Record<string, string>
export interface Checkout { checkout(input: CheckoutInput, telemetry: TraceCarrier): Promise<CheckoutResult> }
// systems/shop/service/ports.ts
export interface ShopOutbox<Tx> { add(tx: Tx, message: ShopOutgoing, telemetry: TraceCarrier): Promise<void> }
// apps/web/app/(shop)/checkout/actions.ts — the driving adapter injects the active context and passes it on
const carrier: TraceCarrier = {}; propagation.inject(context.active(), carrier);
await shopCourier.get().checkout.checkout(input, carrier);
```
The fixture asks that request id and trace context cross system boundaries. A published message is the only way across that is not in-process, so the context has to be written into the outbox row in the use case's transaction.

P5's first sentence lets an adapter reach the outside "also through code of the common library whose output changes neither how a use case acts nor what it answers", and the OpenTelemetry propagation API is such code. P4's Why says the same thing outright: "a trace context the adapter puts in per request and the outbox adapter carries on the envelope ... nothing here refuses them".

P4's Statement does refuse it: "Code behind a driven port MUST use an ambient value ... only to reach the outside it adapts, and in nothing it writes or returns." The outbox adapter is code behind a driven port, the active context is an ambient value, and the row is something it writes.

Code can satisfy both rules, at a cost:
- **Thread the carrier.** The carrier becomes a parameter of every driving port and every outbox call, which is the parameter P5's Why refuses to impose for telemetry ("adds a parameter to every signature for nothing the system's behavior depends on").
- **Drop it.** The trace breaks at the outbox, and the fixture's "should cross" goes unmet.

For the build I took the threaded carrier only on ports that write messages. Request id rides in OTel baggage inside the same carrier.

### p4-tension-batch-on-the-clock.md
```yaml
breaches: [P4, P10]
satisfies: [P7, P9, P17]
situation: billing — scheduled dunning over unpaid invoices; shop — overdue orders past the payment deadline
finding: tension
```
# A clock tick over many customers: one transaction fails untied, a loop is many acting calls
```ts
// systems/billing/adapters/driving/schedule/dunning-tick.ts — BREACH of P4 s3: many acting calls per tick
export const dunningTick = (ports: { dueForDunning: DueForDunning; advanceDunning: AdvanceDunning }) => async (): Promise<void> => {
  const due = await ports.dueForDunning.list();            // answering
  for (const c of due) await ports.advanceDunning.advance({ customerId: c.customerId }); // N acting calls
};

// systems/billing/service/run-dunning.ts — BREACH of P10 s3: one transaction saves every account
export const createRunDunning = <Tx>(d: { tx: Transactions<Tx>; accounts: CustomerAccounts<Tx>; clock: Clock; outbox: BillingOutbox<Tx> }) => ({
  async run(): Promise<void> {
    await d.tx.run(async (tx) => {
      for (const account of await d.accounts.overdue(tx, d.clock.now())) {
        await d.accounts.save(tx, advance(account, d.clock.now()).account); // version-checked: a payment to ANY customer fails the run
      }
    });
  },
});
```
```ts
// the code that satisfies both: one acting call that fans out, a stated business rule for the stale candidate list
// systems/billing/domain/dunning.ts
export const DUNNING_DAY_ZONE = "Europe/Berlin";
/** Business rule (P10 s2): the candidate list of a dunning run is read once and may be stale. A customer
 * who pays between the run and their own step is checked afresh by that step, which then does nothing. */
export const planDunningRun = (candidates: readonly { customerId: string }[], now: Date): DunningRunMessage[] =>
  candidates.map((c) => ({ id: `dunning:${dunningDay(now, DUNNING_DAY_ZONE)}:${c.customerId}`, type: "billing.AdvanceDunning.private", customerId: c.customerId }));

// systems/billing/service/schedule-dunning.ts — the scheduled task's one acting call
export const createScheduleDunning = <Tx>(d: { tx: Transactions<Tx>; accounts: CustomerAccounts<Tx>; outbox: BillingOutbox<Tx>; clock: Clock }): ScheduleDunning => ({
  async schedule(): Promise<void> {
    await d.tx.run(async (tx) => {
      const now = d.clock.now();
      for (const m of planDunningRun(await d.accounts.overdueCandidates(tx, now), now)) await d.outbox.addOnce(tx, m); // insert ... on conflict (id) do nothing
    });
  },
});

// systems/billing/service/advance-dunning.ts — one customer, own transaction, decides afresh (P10 s1)
export const createAdvanceDunning = <Tx>(d: AdvanceDunningDeps<Tx>): AdvanceDunning => ({
  async advance(msg) {
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.id, AdvanceResult);
      if (!claim.first) return claim.result;
      const account = await d.accounts.load(tx, msg.customerId);
      const step = advance(account, d.clock.now()); // nothing overdue any more -> { kind: "nothingDue" }
      if (step.kind === "advanced") { await d.accounts.save(tx, step.account); for (const m of step.messages) await d.outbox.add(tx, m); }
      await d.handled.settle(tx, msg.id, step.result);
      return step.result;
    });
  },
});
```
The two pulls:
- **P4's sentence 3:** a driving adapter makes "at most one acting call per call it handles", and a clock tick is one call.
- **P10's sentence 3:** a use case's writes "MUST NOT fail on a change to records that no business rule ties to the use case's goal". One transaction that saves every overdue account fails whenever any one of those customers pays.

The Why of P4 allows "a use case over a batch is one acting call in one transaction", but that is exactly the transaction P10 forbids here. Both rules hold only through the fan-out: one acting call writes one private message per candidate, and each handler decides in its own transaction.

The fan-out then decides by a candidate list that no failing write covers, so P10's sentence 2 needs a business rule that accepts it stale. That rule is real code, the doc comment plus `planDunningRun`, which the business would not otherwise have stated.

The same shape is forced on shop's overdue orders whenever they are found by a scan. I avoided it there with a delayed private message written at checkout (see the saga, step 5), which only works because the bus can defer delivery.

### p18-tension-external-writer-without-version.md
```yaml
breaches: [P15]
satisfies: [P18, P8, P11]
situation: catalog — shop reads the product, price and tax class included, through Payload's Local API
finding: tension
```
# Replica refresh that takes the current state from Payload waits on catalog
```ts
// systems/shop/service/refresh-product-offer.ts — P18 fallback, P15 breach
export const createRefreshProductOffer = <Tx>(d: { tx: Transactions<Tx>; catalog: ProductCatalog; offers: ProductOffers<Tx>; handled: HandledMessages<Tx> }) => ({
  async refresh(notice: { messageId: string; productId: string }): Promise<void> {
    const current = await d.catalog.current(notice.productId); // waits on catalog (Local API); no business rule needs it now
    await d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, notice.messageId, z.null());
      if (!claim.first) return;
      await d.offers.put(tx, current);
      await d.handled.settle(tx, notice.messageId, null);
    });
  },
});
```
```ts
// the code that satisfies both: a version configured into the external system, carried on the message
// catalog/migrations/0003_products_revision.sql — this codebase configures Payload's store
// ALTER TABLE products ADD COLUMN revision integer NOT NULL DEFAULT 0;
// CREATE FUNCTION products_bump_revision() RETURNS trigger AS $$ BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END $$ LANGUAGE plpgsql;
// CREATE TRIGGER products_revision BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION products_bump_revision();

// systems/shop/domain/product-offer.ts
export const applyProductChange = (held: ProductOffer | undefined, incoming: ProductOffer): ProductOffer =>
  held !== undefined && held.revision >= incoming.revision ? held : incoming; // keep the highest (P18 s2)
```
Payload is an external writer, so P18's writer clause "cannot bind it". Its Why gives the receiver two fallbacks. The first is "a status that only moves forward", which a price does not. The second is to "take the thing's current state from the owner when it handles one, the message as no more than a notice".

The second fallback makes the handler wait on catalog. P15's sentence 1 allows a wait only "for an answer a business rule of its system needs before the use case returns, or for the change that a message it is called for asks of that system", and no business rule needs the price now just to refresh a replica.

`updatedAt` is carried but is set by each Payload process's clock, and P18's Why refuses that order.

What satisfies both is configuring a version into the external system, which P18's Why names: "Where this codebase configures the external system, a version can be configured in." The revision must be raised under the row lock, so it is a trigger in Payload's store and not a `beforeChange` that reads `originalDoc`, because two concurrent edits read the same revision there.

The cost is a migration in an external system's tables. P2's Why lists "a trigger ... in the store" among refused statements; this trigger decides no business rule, so I took it as outside P2's Scope.

### p10-tension-live-answer-vs-replica.md
```yaml
breaches: []
satisfies: [P10, P15, P17]
situation: payment — Stripe stops resending after three days; reconciliation at the payment's deadline
finding: tension
```
# A reconciliation needs Stripe's answer now, and P10 needs that answer accepted stale
```ts
// systems/payment/domain/payment.ts
/** Business rule (P15 s1, P10 s2): at the payment's deadline payment needs Stripe's answer now, because no
 * replica of Stripe's state exists beyond the webhooks that did not come. The answer is accepted stale for
 * the length of the call: a change Stripe makes meanwhile arrives as a webhook and is applied by version. */
export const RECONCILE_ATTEMPTS = 3;
export const reconcile = (p: Payment, answer: ProcessorStatus | "unreachable", now: Date): ReconcileStep => {
  if (answer === "unreachable") return p.reconcileAttempts + 1 >= RECONCILE_ATTEMPTS
    ? fail(p, "unconfirmedAtDeadline", now)          // decides on no answer (P17 s2)
    : retryLater(p, now);
  return answer.state === "succeeded" ? succeed(p, now) : answer.state === "canceled" ? fail(p, "canceled", now) : cancelAndFail(p, now);
};
```
P10's sentence 2 says another system's answer "is stale the moment it returns", so a decision on it needs "a business rule ... that accepts the data stale".

P15's Why draws the line for the first exception this way: "where one accepts a value that lags, nothing needs the answer now and the replica serves; where none accepts it, the answer is needed now."

Read together and literally, every live read needs a rule accepting staleness (P10), and every such rule sends the read to a replica (P15). The first exception would then hold only for actions (a PaymentIntent), never for reads, yet P15's own Why gives a read as its example: "at the payment deadline a reconciliation asks Stripe". For payment there is no replica to read, because the replica would be filled by exactly the webhooks that stopped coming.

Code complies only under reading S3: a rule that accepts staleness for the length of a call is not a rule that accepts the replica's lag, which is unbounded while the bus or the webhook source is down. The cost is a business rule whose second half (stale for the call's duration) exists to answer P10, not the business.

## How the fixture is built

```
packages/
  kernel/src/{money.ts, sku.ts, index.ts}                    # shared kernel: values only (P3)
  common/src/
    telemetry/{logger.ts, tracer.ts, node-sdk.ts, carrier.ts}
    messaging/{envelope.ts, outbox-table.ts, drizzle-outbox.ts, outbox-reader.ts, relay.ts, pg-bus.ts, handled-messages.ts}
    db/{drizzle-client.ts, drizzle-transactions.ts}
    courier.ts
    # unit-of-work.ts (ambient AsyncLocalStorage) — deleted, see common library
catalog/                                                     # external system: Payload config this codebase writes
  payload.config.ts
  collections/{products.ts, catalog-outbox.ts}
  courier.ts                                                 # what catalog's config calls into, filled by web assembly
  migrations/0003_products_revision.sql
  published/{index.ts, product-changed.ts}                   # catalog's published language beside payload-types
  payload-types.ts                                           # generated by Payload
systems/
  shop/
    offer/{index.ts, builder.ts, published/{events.ts, open-orders.ts}, fakes/open-orders.fake.ts}
    domain/{order.ts, cart.ts, checkout.ts, product-offer.ts, customer-standing.ts, late-payment.ts, confirmation-mail.ts}
    service/{ports.ts, driving-ports.ts, checkout.ts, card-payment-outcome.ts, invoice-paid.ts, payment-deadline.ts,
             reservation-refused.ts, refund-outcome.ts, refresh-product-offer.ts, refresh-customer-standing.ts,
             send-order-confirmation.ts, open-orders.ts, revalidate-product-page.ts, reconcile-product-offers.ts}
    adapters/driven/{drizzle/*.ts, payment/in-process-card-payments.ts, payload/product-catalog.ts,
                     mail/provider-confirmations.ts, next/page-cache.ts, clock.ts, ids.ts}
    adapters/driving/{courier.ts, next/checkout-action.ts, bus/subscriptions.ts}
    conforms.ts                                              # [] — shop conforms to no upstream (P12)
    test/...                                                 # mirrors the tree
  payment/  (offer, domain/payment.ts, service/*, adapters/driven/stripe/*, adapters/driving/{stripe-webhook.ts, bus/*}, conforms.ts)
  billing/  (offer, domain/{invoice.ts, invoice-number.ts, vat.ts, dunning.ts, transfer-matching.ts, credit-note.ts}, service/*,
             adapters/driven/{drizzle/*, mail/*}, adapters/driving/{schedule/*, bus/*}, adapters/driving/bank/poll-transfers.ts, conforms.ts)
  fulfillment/ (offer, domain/{stock.ts, fulfillment-order.ts, shipment.ts, article.ts}, service/*,
                adapters/driven/{drizzle/*, threepl/*}, adapters/driving/{bus/*, threepl-webhook.ts, payload/stock-field.ts}, conforms.ts)
  backoffice/ (offer, domain/dashboard-row.ts, service/*, adapters/driven/drizzle/*, adapters/driving/{bus/*, next/dashboard-page.ts}, conforms.ts)
apps/
  web/{instrumentation.ts, assembly.ts, config.ts, app/(shop)/checkout/actions.ts, app/api/stripe/webhook/route.ts,
       app/api/health/route.ts, app/api/metrics/route.ts, app/(payload)/...}
  worker/{main.ts, instrumentation.ts, assembly.ts}          # relay, bus consumers of shop/payment/billing/backoffice, scheduled tasks
  worker-fulfillment/{main.ts, instrumentation.ts, assembly.ts, http.ts}  # fulfillment's handlers and 3PL webhook
```

### Systems

There are five systems of this codebase (shop, payment, billing, fulfillment and a new `backoffice`), one external system that this codebase configures (catalog = Payload), four external systems it only calls (Stripe, the 3PL, the bank and the mail provider), a shared kernel and a common library.

- Every system has `offer/` as its only export path (P5, P13): the published language, the driving port types of its open host service with their fakes, and its builders. A linter on import paths refuses `@teeladen/<system>/(domain|service|adapters)` from outside that system.
- The shared Postgres holds every system's tables under one schema per system (`shop.*`, `billing.*` ...) and Payload's own tables. "One Postgres" is one store per glossary for clients that one transaction can carry. Each system's transaction touches only its own schema (P16, sentence 1).
- Every system has its own `handled_messages(message_id pk, result jsonb)` table and its own outbox table (P8, P9).
- `conforms.ts` is where a system records the upstreams it conforms to (P12). Shop, payment, billing and fulfillment record none: each translates in its adapters. Backoffice records none either (see the cross-cutting reads).

Shared types used by every service (shop shown; each system declares its own copy in its own terms, P5):

```ts
// systems/shop/service/ports.ts — driven ports, declared in shop's service layer, generic over the store's transaction type
import type { z } from "zod";
import type { Order, OrderId } from "../domain/order";
import type { Cart, CartId } from "../domain/cart";
import type { ProductOffer } from "../domain/product-offer";
import type { CustomerStanding } from "../domain/customer-standing";
import type { ShopOutgoing } from "../domain/messages";
import type { Money } from "@teeladen/kernel";
import type { TraceCarrier } from "@teeladen/common/telemetry/carrier";

export interface Transactions<Tx> { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export interface Clock { now(): Date }
export interface Ids { orderId(): OrderId; messageId(): string; refundId(): string }
export interface Orders<Tx> {
  load(tx: Tx, id: OrderId): Promise<Order | undefined>;
  loadByCardPayment(tx: Tx, paymentRef: string): Promise<Order | undefined>;
  insert(tx: Tx, order: Order): Promise<void>;            // fails on an existing id (key)
  save(tx: Tx, order: Order): Promise<void>;              // where version = order.version; fails otherwise
  countOpenCarrying(tx: Tx, sku: string): Promise<number>;
}
export interface Carts<Tx> { load(tx: Tx, id: CartId): Promise<Cart | undefined>; save(tx: Tx, cart: Cart): Promise<void> }
export interface ProductOffers<Tx> { find(tx: Tx, productIds: readonly string[]): Promise<ReadonlyMap<string, ProductOffer>>; put(tx: Tx, offer: ProductOffer): Promise<void> }
export interface CustomerStandings<Tx> { find(tx: Tx, customerId: string): Promise<CustomerStanding | undefined>; put(tx: Tx, s: CustomerStanding): Promise<void> }
export interface ShopOutbox<Tx> { add(tx: Tx, message: ShopOutgoing, telemetry: TraceCarrier): Promise<void> }
export interface HandledMessages<Tx> {
  claim<R>(tx: Tx, messageId: string, result: z.ZodType<R>): Promise<{ first: true } | { first: false; result: R }>;
  settle<R>(tx: Tx, messageId: string, result: R): Promise<void>;
}
export interface CardPayments {               // shop's anti-corruption port toward payment
  request(input: { orderId: OrderId; amount: Money; payBy: Date }): Promise<{ kind: "opened"; paymentRef: string; clientSecret: string } | { kind: "refused" }>;
}
export interface OrderConfirmations { send(mail: OrderConfirmationMail): Promise<void> }
export interface PageCache { invalidateProduct(slug: string): Promise<void> }
export interface ProductCatalog { all(): Promise<readonly ProductOffer[]> }   // used by the reconciliation only
```

```ts
// packages/common/src/db/drizzle-transactions.ts — implements every system's Transactions<Tx> by shape
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
export type DrizzleTx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];
export const drizzleTransactions = (db: NodePgDatabase) => ({
  run: <T>(work: (tx: DrizzleTx) => Promise<T>): Promise<T> => db.transaction(work), // rolls back whole on throw (P7)
});
```

The services are generic over `Tx`. Assembly instantiates them with `DrizzleTx`, and the tests with `FakeTx`. No service is typed by Drizzle (P5); the transaction is an argument of every write (P7, P16); no driving port mentions `Tx` (P16, sentence 4).

### catalog

Catalog is external (Payload). Its configuration sits outside the rules, except where it touches a system (Assumptions). This codebase writes:

```ts
// catalog/collections/products.ts — catalog's own business rules in its own config (P2 Why, P3: owner is catalog)
import type { CollectionConfig, CollectionAfterChangeHook, CollectionBeforeChangeHook } from "payload";
import { APIError } from "payload";
import type { Product } from "../payload-types";
import { ProductChangedV1 } from "../published/product-changed";
import { catalogCourier } from "../courier";

const vetoSkuChangeWhileOpenOrders: CollectionBeforeChangeHook<Product> = async ({ data, originalDoc, operation }) => {
  if (operation !== "update" || originalDoc === undefined || data.sku === undefined || data.sku === originalDoc.sku) return data;
  const { openOrders } = catalogCourier.get();                  // shop's open host service, handed by assembly
  const { count } = await openOrders.countCarrying({ sku: originalDoc.sku }); // no req passed (P16)
  if (count > 0) throw new APIError(`SKU ${originalDoc.sku} is on ${count} open order(s)`, 409); // catalog's rule, catalog decides (P3)
  return data;
};

const writeProductChanged: CollectionAfterChangeHook<Product> = async ({ doc, req }) => {
  const message = ProductChangedV1.parse({
    type: "catalog.ProductChanged.v1", productId: String(doc.id), revision: doc.revision, slug: doc.slug, sku: doc.sku,
    title: doc.title, priceCents: doc.priceCents, taxClass: doc.taxClass, published: doc._status === "published",
  });
  await req.payload.create({ collection: "catalog-outbox", data: { messageId: crypto.randomUUID(), type: message.type, body: message }, req }); // same Payload transaction (P8 Why, TX-29)
  return doc;
};

export const Products: CollectionConfig = {
  slug: "products",
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "sku", type: "text", required: true, unique: true },              // catalog's rule: sku unique
    { name: "priceCents", type: "number", required: true, min: 1 },           // catalog's rule: price above zero
    { name: "taxClass", type: "select", required: true, options: ["tea", "accessory"] },
    { name: "revision", type: "number", admin: { readOnly: true } },          // raised by trigger (T3)
    { name: "stock", type: "ui", admin: { components: { Field: "@teeladen/fulfillment/payload#StockField" } } }, // not kept (see below)
  ],
  hooks: { beforeChange: [vetoSkuChangeWhileOpenOrders], afterChange: [writeProductChanged] },
};
```

```ts
// catalog/courier.ts — filled by the web process's assembly, read by catalog's config each time it runs
import { createCourier } from "@teeladen/common/courier";
import type { OpenOrders } from "@teeladen/shop";            // shop's offer: open host service type
export const catalogCourier = createCourier<{ openOrders: OpenOrders }>("catalog");
```

```ts
// catalog/published/product-changed.ts — catalog's published language: Payload's package + this schema (reading S10)
import { z } from "zod";
export const ProductChangedV1 = z.object({
  type: z.literal("catalog.ProductChanged.v1"), productId: z.string(), revision: z.number().int().nonnegative(),
  slug: z.string(), sku: z.string(), title: z.string(), priceCents: z.number().int(),
  taxClass: z.enum(["tea", "accessory"]), published: z.boolean(),
});
export type ProductChangedV1 = z.infer<typeof ProductChangedV1>;
```

How each catalog situation is placed:
- **Payload's own rules** (price above zero, sku unique) stay in Payload's collection config. Catalog owns the product (fixture table), so these are "the external system's own" (P2 Why, P3 Why). No system of this codebase restates them: shop's domain does not check `price > 0` on its replica.
- **`req.user`.** No use case of this codebase needs the editor. The config passes nothing of `req` to shop (P16), so `req.user` stays Payload's.
- **The `afterChange` situation** ("hooks call shop's services") is placed as catalog's outbox. Catalog's `afterChange` writes a `catalog-outbox` document through `req`, so the message commits with the product change (P8, sentence 3, preferred route TX-29). The web process assembly hands the relay a `payloadOutboxReader`, since the outbox belongs to an external system (glossary: Outbox). No shop service is called from `afterChange`, so nothing in shop acts on an uncommitted change (P8, sentence 3).
- **The `beforeChange` veto.** The veto is catalog's rule about catalog's record (P3: "it asks, the owner decides"). Shop supplies only input, through its open host service `OpenOrders.countCarrying`: an answering use case whose idea of an open order is shop's domain (P2, P3). Catalog's config calls it as a downstream would, importing only shop's offer (P13) and taking the instance from a courier that assembly fills (P5). See reading S5 for the other way to read the hook.
- **Payload's transactions.** Nothing of this codebase calls Payload with a `req` (P16), and the config calls shop with no `req`. The relay reads catalog's outbox only through the reader assembly writes (P11).
- **Stock in Payload's admin.** The stock is not kept in Payload: a UI field renders it by calling fulfillment's open host service (P11, sentence 1). It is not an `afterRead` hook, which would also fire on every Local API read (N21).
- **The cycle** (config needs hooks, hooks need services, services need the Payload instance) is broken by couriers. The config reads `catalogCourier` and the field reads `fulfillmentQueriesCourier` each time they run. Web assembly runs `getPayload(config)`, then the builders, then fills the couriers (P5, sentence 3).
- **Price ownership.** The editors set the price, so it is catalog's (P11 Why, last paragraph). Shop keeps a replica (`ProductOffer`) and a snapshot on each order line.

```ts
// apps/web/assembly/catalog-outbox-reader.ts — assembly provides the reader for an external system's outbox
import type { Payload } from "payload";
import type { OutboxReader } from "@teeladen/common/messaging/outbox-reader";
export const payloadOutboxReader = (payload: Payload): OutboxReader => ({
  async pending(limit) {
    const r = await payload.find({ collection: "catalog-outbox", where: { deliveredAt: { exists: false } }, limit, sort: "createdAt" });
    return r.docs.map((d) => ({ id: d.messageId, type: d.type, body: d.body, trace: {}, deliverAt: null }));
  },
  async markDelivered(ids) {
    await payload.update({ collection: "catalog-outbox", where: { messageId: { in: [...ids] } }, data: { deliveredAt: new Date().toISOString() } });
  },
});
```

### shop

Shop owns Cart and Order.
- **Its domain** holds `Order` (with the payment deadline), `Cart`, `ProductOffer` (a replica of catalog's product), `CustomerStanding` (a replica of billing's dunning stage) and the business rules over them.
- **It is an anti-corruption layer** toward catalog, payment, billing and fulfillment. Catalog's `ProductChangedV1`, billing's `DunningStageChangedV1`/`InvoicePaidV1`, payment's events and fulfillment's `ReservationRefusedV1` are parsed with their owners' schemas in shop's handlers and translated (P12, P19).
- **It sends** `RefundPaymentV1` and `CancelCardPaymentV1` (payment's commands, declared in payment's published language, P13) through its outbox.

```ts
// systems/shop/domain/order.ts — shop's rules about Order (P2, P3)
import { z } from "zod";
import { MoneySchema, SkuSchema, add, times, money, type Money } from "@teeladen/kernel";

export const PAYMENT_DEADLINE_MINUTES = 30;              // shop's rule, a value no record holds (P2)
export const INVOICE_SETTLEMENT_WAIT_DAYS = 120;         // P17 s2: when shop stops waiting for InvoicePaid

export const OrderId = z.string().uuid().brand<"OrderId">();
export type OrderId = z.infer<typeof OrderId>;
export const TaxClass = z.enum(["tea", "accessory"]);    // shop's term for catalog's tax class, a snapshot value
export const OrderLine = z.object({
  productId: z.string(), sku: SkuSchema, quantity: z.number().int().positive(), unitPrice: MoneySchema, taxClass: TaxClass,
});
export type OrderLine = z.infer<typeof OrderLine>;
export const OrderSchema = z.object({
  id: OrderId, customerId: z.string(), locale: z.enum(["de", "en"]), lines: z.array(OrderLine).min(1),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("card"), paymentRef: z.string(), deadline: z.coerce.date() }),
    z.object({ method: z.literal("invoice"), settlementWaitEnds: z.coerce.date() }),
  ]),
  status: z.enum(["awaitingPayment", "paid", "cancelled", "settledElsewhere"]),
  refund: z.object({ refundId: z.string(), state: z.enum(["requested", "issued", "refused"]) }).nullable(),
  version: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;
export const orderTotal = (lines: readonly OrderLine[]): Money => lines.reduce((s, l) => add(s, times(l.unitPrice, l.quantity)), money(0));
export const nextVersion = (o: Order): number => o.version + 1;   // the version the next save commits, carried on messages (P18)
export const isOpen = (o: Order): boolean => o.status === "awaitingPayment" || o.status === "paid"; // "open order" for the sku veto
```

```ts
// systems/shop/domain/checkout.ts — the decision, made in the committing transaction (P10 s1)
import type { Money } from "@teeladen/kernel";
import { equals } from "@teeladen/kernel";
export type CheckoutRefusal = "cartEmpty" | "offerUnavailable" | "invoiceNotOffered" | "amountChanged";
export type PlaceInput = {
  id: OrderId; cart: Cart; offers: ReadonlyMap<string, ProductOffer>; standing: CustomerStanding | undefined;
  method: "card" | "invoice"; card: { paymentRef: string; requested: Money } | undefined; now: Date;
};
export type Placed = { kind: "placed"; order: Order; cart: Cart; messages: ShopOutgoing[] };
export const priceCart = (cart: Cart, offers: ReadonlyMap<string, ProductOffer>): { kind: "priced"; lines: OrderLine[] } | { kind: "refused"; reason: CheckoutRefusal } => {
  if (cart.items.length === 0) return { kind: "refused", reason: "cartEmpty" };
  const lines: OrderLine[] = [];
  for (const item of cart.items) {
    const offer = offers.get(item.productId);
    if (offer === undefined || !offer.published) return { kind: "refused", reason: "offerUnavailable" };
    lines.push({ productId: offer.productId, sku: offer.sku, quantity: item.quantity, unitPrice: offer.price, taxClass: offer.taxClass }); // snapshot
  }
  return { kind: "priced", lines };
};
export const placeOrder = (i: PlaceInput): Placed | { kind: "refused"; reason: CheckoutRefusal } => {
  const priced = priceCart(i.cart, i.offers);
  if (priced.kind === "refused") return priced;
  if (i.method === "invoice" && !mayPayByInvoice(i.standing)) return { kind: "refused", reason: "invoiceNotOffered" };
  if (i.method === "card" && (i.card === undefined || !equals(i.card.requested, orderTotal(priced.lines)))) return { kind: "refused", reason: "amountChanged" };
  const payment = i.method === "card" && i.card !== undefined
    ? { method: "card" as const, paymentRef: i.card.paymentRef, deadline: addMinutes(i.now, PAYMENT_DEADLINE_MINUTES) }
    : { method: "invoice" as const, settlementWaitEnds: addDays(i.now, INVOICE_SETTLEMENT_WAIT_DAYS) };
  const order: Order = { id: i.id, customerId: i.cart.customerId, locale: i.cart.locale, lines: priced.lines, payment, status: "awaitingPayment", refund: null, version: 0 };
  return { kind: "placed", order, cart: emptied(i.cart), messages: placedMessages(order) };
};
```

```ts
// systems/shop/domain/customer-standing.ts — replica of billing's dunning stage, in shop's terms (P12, P19)
export type CustomerStanding = { customerId: string; inDunning: boolean; billingVersion: number };
/** Business rule (P10 s2): the standing is shop's copy of billing's dunning stage and lags it. An invoice order
 * placed by a customer who entered dunning meanwhile stands; billing's dunning takes it from there. */
export const mayPayByInvoice = (s: CustomerStanding | undefined): boolean => s === undefined || !s.inDunning;
export const applyStanding = (held: CustomerStanding | undefined, incoming: CustomerStanding): CustomerStanding =>
  held !== undefined && held.billingVersion >= incoming.billingVersion ? held : incoming; // P18 s2
```

```ts
// systems/shop/service/checkout.ts — the checkout use case
export const createCheckout = <Tx>(d: {
  tx: Transactions<Tx>; carts: Carts<Tx>; orders: Orders<Tx>; offers: ProductOffers<Tx>; standings: CustomerStandings<Tx>;
  outbox: ShopOutbox<Tx>; payments: CardPayments; clock: Clock; ids: Ids;
}): Checkout => ({
  async checkout(input, telemetry) {
    const orderId = d.ids.orderId();
    let card: { paymentRef: string; requested: Money; clientSecret: string } | undefined;
    if (input.method === "card") {
      const priced = await d.tx.run(async (tx) => {                       // answering read, commits nothing
        const cart = await d.carts.load(tx, input.cartId);
        return cart === undefined ? undefined : priceCart(cart, await d.offers.find(tx, cart.items.map((i) => i.productId)));
      });
      if (priced === undefined || priced.kind === "refused") return { kind: "refused", reason: priced?.reason ?? "cartEmpty" };
      const amount = orderTotal(priced.lines);
      const opened = await d.payments.request({ orderId, amount, payBy: addMinutes(d.clock.now(), PAYMENT_DEADLINE_MINUTES) }); // tentative, beside the tx (P8), needed now (P15)
      if (opened.kind === "refused") return { kind: "refused", reason: "paymentRefused" };
      card = { paymentRef: opened.paymentRef, requested: amount, clientSecret: opened.clientSecret };
    }
    return d.tx.run(async (tx) => {                                        // the committing transaction (P7)
      const cart = await d.carts.load(tx, input.cartId);
      if (cart === undefined) return { kind: "refused", reason: "cartEmpty" };
      const ids = cart.items.map((i) => i.productId);
      const placed = placeOrder({ id: orderId, cart, offers: await d.offers.find(tx, ids), standing: await d.standings.find(tx, cart.customerId),
        method: input.method, card, now: d.clock.now() });
      if (placed.kind === "refused") return placed;                        // a card PI opened for nothing lapses at payment's deadline (P17)
      await d.orders.insert(tx, placed.order);
      await d.carts.save(tx, placed.cart);                                 // version-checked: a concurrent cart edit fails this checkout (P10)
      for (const m of placed.messages) await d.outbox.add(tx, m, telemetry);
      return { kind: "placed", orderId, clientSecret: card?.clientSecret ?? null };
    });
  },
});
```

`placedMessages(order)` returns three messages. `OrderPlacedV1` is a published event; the published `orderVersion` is `nextVersion(order)`, the version this transaction commits (P18). `SendOrderConfirmation` is private (P8). For card orders there is a third, `PaymentDeadlineReached`, private and `deliverAt = order.payment.deadline`.

```ts
// systems/shop/offer/published/events.ts — shop's published language, its own statement (P13 s3 + MAY)
import { z } from "zod";
import { MoneySchema, SkuSchema } from "@teeladen/kernel";
const LineV1 = z.object({ sku: SkuSchema, quantity: z.number().int().positive(), unitPrice: MoneySchema, taxClass: z.enum(["tea", "accessory"]) });
const OrderFactsV1 = { orderId: z.string(), orderVersion: z.number().int().positive(), customerId: z.string(),
  paymentMethod: z.enum(["card", "invoice"]), lines: z.array(LineV1).min(1), total: MoneySchema };
export const OrderPlacedV1 = z.object({ type: z.literal("shop.OrderPlaced.v1"), ...OrderFactsV1, placedAt: z.string().datetime() });
export const OrderPaidV1 = z.object({ type: z.literal("shop.OrderPaid.v1"), ...OrderFactsV1 });
export const OrderCancelledV1 = z.object({ type: z.literal("shop.OrderCancelled.v1"), orderId: z.string(), orderVersion: z.number().int().positive(), reason: z.enum(["paymentFailed", "paymentDeadlinePassed", "outOfStock"]) });
export type OrderPlacedV1 = z.infer<typeof OrderPlacedV1>;
```

```ts
// systems/shop/offer/published/open-orders.ts — open host service offered to catalog's config
import { z } from "zod";
export const CountCarryingInput = z.object({ sku: z.string() });
export const CountCarryingResult = z.object({ count: z.number().int().nonnegative() });
export interface OpenOrders { countCarrying(input: z.input<typeof CountCarryingInput>): Promise<z.infer<typeof CountCarryingResult>> }
```

```ts
// systems/shop/adapters/driving/next/checkout-action.ts — kept at apps/web/app/(shop)/checkout/actions.ts, shop's driving adapter
"use server";
import { context, propagation } from "@opentelemetry/api";
import { shopCourier } from "@teeladen/shop/adapters/driving/courier";  // the system's own module (glossary: System)
import { CheckoutForm } from "./checkout-form-schema";                 // parses with the domain's schemas
import { currentCustomer } from "./session";                          // working out who the caller is (P4 s3)

export async function checkoutAction(form: FormData): Promise<{ ok: true; orderId: string; clientSecret: string | null } | { ok: false; reason: string }> {
  const parsed = CheckoutForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, reason: "invalidInput" };        // cannot translate -> withholds (P4 s3)
  const customer = await currentCustomer();
  if (customer === undefined) return { ok: false, reason: "unauthenticated" };
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const r = await shopCourier.get().checkout.checkout({ cartId: parsed.data.cartId, customerId: customer.id, method: parsed.data.method }, carrier); // one acting call
  return r.kind === "placed" ? { ok: true, orderId: r.orderId, clientSecret: r.clientSecret } : { ok: false, reason: r.reason };
}
```

How each shop situation is placed:
- **`client_secret` in the same request.** Payment's PaymentIntent is a tentative operation, requested beside shop's transaction (P8) because a business rule needs the answer now (P15: the customer pays now), carrying no transaction (P16). It is asked *before* shop's transaction opens, so that `paymentRef` lands on the order in the one commit (P7: no write after the commit). If shop's commit fails, the intent is never confirmed and payment's deadline cancels it (P17).
- **Pay-by-invoice, not in dunning.** `mayPayByInvoice` reads shop's replica `CustomerStanding` (P15), which billing's `DunningStageChangedV1` events fill, versioned (P18). The rule accepts the replica stale (P10, sentence 2).
- **Copying price, sku and tax class.** These are snapshots in `OrderLine` taken from the `ProductOffer` replica (P10 Why: a snapshot covers nothing of the other system). Catalog's live state is not read at checkout (T3, T4, reading S3).
- **Confirmation mail once the order commits.** A private `SendOrderConfirmation` goes into the outbox in the checkout transaction (P8). Its handler sends through `OrderConfirmations`, deciding nothing again, and a second mail is accepted by a stated rule (P9, sentence 3).
- **"Calls billing's open host service in-process while holding its own ambient transaction".** No shop use case calls billing (N8). The common library's ambient unit of work is deleted (P16, sentence 2). Where shop does call another system in-process (payment), the call carries no transaction, because none of shop's driving ports and none of payment's take one (P16).

### payment

Payment owns Payment and Refund, and holds both in one `Payment` aggregate, so that a dispute and a refund decision on the same charge fail each other (P10). Stripe sits behind payment's anti-corruption port `CardProcessor` (P12). Stripe's types stay in `adapters/driven/stripe/*` and in the webhook hook, named as Stripe's (`Stripe.PaymentIntent`, P19).

```ts
// systems/payment/domain/payment.ts
export type PaymentState = "awaitingConfirmation" | "succeeded" | "failed";
export type Payment = {
  id: string; orderId: string; amount: Money; processorRef: string; state: PaymentState;
  confirmBy: Date; reconcileAttempts: number; disputed: boolean;
  refunds: readonly { refundId: string; amount: Money; state: "requested" | "issued" | "refused"; processorRef: string | null }[];
  version: number;
};
export const CONFIRMATION_GRACE_MINUTES = 15;   // payment's rule: how long after shop's confirmBy it waits on Stripe
export const outcomeExpectedBy = (p: Payment): Date => addMinutes(p.confirmBy, CONFIRMATION_GRACE_MINUTES);
/** Payment's rule (P18, Stripe sends no version): succeeded is final; failed may still turn into succeeded
 * (a late webhook after payment gave up), and is published again so the order's system can decide (P17). */
export const applyOutcome = (p: Payment, o: "succeeded" | "canceled"): { payment: Payment; publish: "PaymentSucceeded" | "PaymentFailed" | null } => {
  if (p.state === "succeeded") return { payment: p, publish: null };
  if (o === "succeeded") return { payment: { ...p, state: "succeeded" }, publish: "PaymentSucceeded" };
  return p.state === "failed" ? { payment: p, publish: null } : { payment: { ...p, state: "failed" }, publish: "PaymentFailed" };
};
export const decideRefund = (p: Payment, req: { refundId: string; amount: Money }):
  | { kind: "refused"; reason: "disputed" | "notCaptured" | "exceedsCaptured"; payment: Payment }
  | { kind: "accepted"; payment: Payment } => {
  const refused = (reason: "disputed" | "notCaptured" | "exceedsCaptured") =>
    ({ kind: "refused" as const, reason, payment: { ...p, refunds: [...p.refunds, { refundId: req.refundId, amount: req.amount, state: "refused" as const, processorRef: null }] } });
  if (p.disputed) return refused("disputed");                       // fixture: a disputed charge is not refunded
  if (p.state !== "succeeded") return refused("notCaptured");
  if (greaterThan(add(refundedSoFar(p), req.amount), p.amount)) return refused("exceedsCaptured");
  return { kind: "accepted", payment: { ...p, refunds: [...p.refunds, { refundId: req.refundId, amount: req.amount, state: "requested", processorRef: null }] } };
};
```

```ts
// systems/payment/service/ports.ts (excerpt)
export interface CardProcessor {
  openIntent(i: { paymentId: string; amount: Money }): Promise<{ kind: "opened"; processorRef: string; clientSecret: string } | { kind: "refused" }>;
  cancelIntent(i: { processorRef: string }): Promise<{ kind: "canceled" } | { kind: "alreadySucceeded" }>;
  status(i: { processorRef: string }): Promise<ProcessorStatus>;      // used by the reconciliation only (T4)
  refund(i: { refundId: string; processorRef: string; amount: Money }): Promise<{ kind: "issued"; processorRef: string } | { kind: "declined"; reason: string }>;
}
```

```ts
// systems/payment/adapters/driven/stripe/stripe-card-processor.ts — anti-corruption: Stripe's terms stop here
import Stripe from "stripe";
export const stripeCardProcessor = (stripe: Stripe): CardProcessor => ({
  async openIntent({ paymentId, amount }) {
    try {
      const pi = await stripe.paymentIntents.create(
        { amount: amount.cents, currency: "eur", metadata: { paymentId }, automatic_payment_methods: { enabled: true } },
        { idempotencyKey: `open:${paymentId}` });
      if (pi.client_secret === null) throw new Error(`Stripe returned no client_secret for ${pi.id}`);
      return { kind: "opened", processorRef: pi.id, clientSecret: pi.client_secret };
    } catch (e) {
      if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "amount_too_small") return { kind: "refused" };
      throw e;                                                       // a failure, not a refusal (P17 s3)
    }
  },
  async refund({ refundId, processorRef, amount }) {
    const earlier = await stripe.refunds.list({ payment_intent: processorRef, limit: 100 });
    const done = earlier.data.find((r) => r.metadata?.refundId === refundId);       // key outlived Stripe's 24h (P9 s2)
    if (done !== undefined) return { kind: "issued", processorRef: done.id };
    try {
      const r = await stripe.refunds.create({ payment_intent: processorRef, amount: amount.cents, metadata: { refundId } }, { idempotencyKey: `refund:${refundId}` });
      return { kind: "issued", processorRef: r.id };
    } catch (e) {
      if (e instanceof Stripe.errors.StripeInvalidRequestError && (e.code === "charge_disputed" || e.code === "charge_already_refunded"))
        return { kind: "declined", reason: e.code };                // the adapter tells a decline from a failure (P17 Why)
      throw e;
    }
  },
  async cancelIntent({ processorRef }) { /* paymentIntents.cancel; "payment_intent_unexpected_state" + status succeeded -> alreadySucceeded */ return cancelOrReport(stripe, processorRef); },
  async status({ processorRef }) { return toProcessorStatus(await stripe.paymentIntents.retrieve(processorRef)); },
});
```

```ts
// systems/payment/service/payment-intents.ts — payment's open host service, called in-process by shop
export const createPaymentIntents = <Tx>(d: { tx: Transactions<Tx>; payments: Payments<Tx>; cards: CardProcessor; outbox: PaymentOutbox<Tx>; ids: Ids; clock: Clock }): PaymentIntents => ({
  async createPaymentIntent(raw) {
    const input = CreatePaymentIntentInputV1.parse(raw);
    const paymentId = d.ids.paymentId();
    const opened = await d.cards.openIntent({ paymentId, amount: input.amount });   // tentative, beside the tx (P8)
    if (opened.kind === "refused") return { kind: "refused", reason: "amountInvalid" };
    await d.tx.run(async (tx) => {
      const payment = openPayment({ id: paymentId, orderId: input.orderId, amount: input.amount, processorRef: opened.processorRef, confirmBy: new Date(input.confirmBy) });
      await d.payments.insert(tx, payment);
      await d.outbox.add(tx, { id: d.ids.messageId(), deliverAt: outcomeExpectedBy(payment), body: { type: "payment.ReconcileAtDeadline.private", paymentId } }); // P17 s2
    });
    return { kind: "created", paymentId, clientSecret: opened.clientSecret };
  },
});
```

```ts
// systems/payment/adapters/driving/stripe-webhook.ts — kept at apps/web/app/api/stripe/webhook/route.ts; a hook (glossary)
import type Stripe from "stripe";
import { paymentCourier } from "@teeladen/payment/adapters/driving/courier";
export async function POST(request: Request): Promise<Response> {
  const { verifyStripeEvent, cardOutcomes } = paymentCourier.get();     // a verifier function, not a Stripe client (P5)
  const signature = request.headers.get("stripe-signature");
  if (signature === null) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try { event = verifyStripeEvent(await request.text(), signature); } catch { return new Response("bad signature", { status: 400 }); }
  const message = toCardMessage(event);                                 // Stripe -> payment's terms, id = Stripe's event id (P9)
  if (message === undefined) return new Response(null, { status: 204 }); // a type with no driving port (P4 s3)
  const result = await cardOutcomes.record(message);                     // returns after commit; the 2xx is the ack (P8)
  return Response.json(result);
}
const toCardMessage = (e: Stripe.Event): CardMessage | undefined => {
  switch (e.type) {
    case "payment_intent.succeeded": return { messageId: e.id, kind: "outcome", processorRef: e.data.object.id, outcome: "succeeded" };
    case "payment_intent.canceled": return { messageId: e.id, kind: "outcome", processorRef: e.data.object.id, outcome: "canceled" };
    case "charge.dispute.created": return { messageId: e.id, kind: "disputed", processorRef: stringId(e.data.object.payment_intent) };
    default: return undefined;   // payment_intent.payment_failed: an attempt, the customer may retry (N15)
  }
};
```

How each payment situation is placed:
- **Stripe behind an anti-corruption layer on the way out.** The `CardProcessor` port is in payment's terms and `stripeCardProcessor` is its adapter (P5, P12). The Stripe client is built by payment's builder from the configuration it receives (P5 Why), and the fake is `fakeCardProcessor` (P6).
- **The PaymentIntent and its `client_secret` in the same call.** This is `createPaymentIntent`, which opens the intent beside payment's transaction (P8), saves `Payment`, and writes a delayed `ReconcileAtDeadline` (P17, sentence 2).
- **Webhooks: at least once, out of order, in Stripe's terms, three days.**
  - The hook verifies and translates; it never calls Stripe (P5 Why).
  - The use case claims Stripe's event id in its transaction (P9).
  - `applyOutcome` is forward-only with one stated exception (P18).
  - The hook answers only after the commit (P8).
  - The three days are covered by payment's own deadline and reconciliation (P17, T4).
- **Refund when shop asks; no refund on a disputed charge.** Shop sends `RefundPaymentV1`, a command in payment's published language. Payment's handler runs `decideRefund` in the `Payment` aggregate:
  - A dispute refuses it, and the refusal is committed and published as `RefundRefusedV1` (P17, sentence 3).
  - Otherwise payment writes a private `IssueStripeRefund`, whose executor calls `cards.refund` with `refundId` as the key (P9, sentence 2) and records Stripe's answer: `issued` → `RefundIssuedV1`; `declined` → refusal committed.
  - A dispute that arrives from Stripe while a refund request is pending is decided by payment's rule (P18, sentence 3). `disputed` is set on the aggregate, and the next refund decision reads it in its committing transaction.

### billing

Billing owns Invoice, the dunning stage (on `CustomerAccount`) and the gapless invoice numbers (`InvoiceNumberSeries`, one aggregate per year). It translates shop's `OrderPlacedV1`/`OrderPaidV1` and payment's `RefundIssuedV1` in its handlers.

```ts
// systems/billing/domain/vat.ts — billing's rule, stated once (P2); billing's own tax-class term (P19)
export const BillingTaxClass = z.enum(["tea", "accessory"]);
export type BillingTaxClass = z.infer<typeof BillingTaxClass>;
export const VAT_PERCENT = { tea: 7, accessory: 19 } as const satisfies Record<BillingTaxClass, number>;
export const vatOf = (gross: Money, taxClass: BillingTaxClass): Money => shareOfGross(gross, VAT_PERCENT[taxClass]); // kernel computes, billing decides the rate
```

```ts
// systems/billing/domain/invoice-number.ts — gapless: the number is taken in the invoice's own transaction
export type InvoiceNumberSeries = { year: number; last: number; version: number };
export const takeNumber = (s: InvoiceNumberSeries): { series: InvoiceNumberSeries; number: string } => {
  const n = s.last + 1;
  return { series: { ...s, last: n }, number: `RE-${s.year}-${String(n).padStart(6, "0")}` };
};
```

```ts
// systems/billing/service/invoice-order.ts — one use case for both triggers
export const createInvoiceOrder = <Tx>(d: InvoiceOrderDeps<Tx>): InvoiceOrder => ({
  async invoice(msg) {                                         // msg: billing's translation of OrderPlacedV1 / OrderPaidV1
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.messageId, InvoiceResult);
      if (!claim.first) return claim.result;
      const existing = await d.invoices.findByOrder(tx, msg.orderId);
      const decision = decideInvoicing({ existing, trigger: msg.trigger, paymentMethod: msg.paymentMethod }); // "invoiceOnPlaced" | "invoiceOnPaid" | "alreadyInvoiced" | "notYet"
      if (decision.kind !== "issue") { await d.handled.settle(tx, msg.messageId, decision.result); return decision.result; }
      const now = d.clock.now();
      const series = await d.series.load(tx, yearOf(now, BILLING_ZONE));
      const taken = takeNumber(series);
      const invoice = issueInvoice({ id: d.ids.invoiceId(), number: taken.number, order: msg, now });  // lines with vatOf(...) snapshots
      await d.series.save(tx, taken.series);                   // version-checked: every invoice contends here, by a business rule (P10 s3)
      await d.invoices.insert(tx, invoice);                    // unique (orderId): one invoice per order
      const account = applyInvoiceToAccount(await d.accounts.load(tx, invoice.customerId), invoice);
      await d.accounts.save(tx, account.account);
      for (const m of [...invoiceMessages(invoice), ...account.messages]) await d.outbox.add(tx, m);
      await d.handled.settle(tx, msg.messageId, { kind: "issued", invoiceId: invoice.id });
      return { kind: "issued", invoiceId: invoice.id };
    });
  },
});
```

```ts
// systems/billing/adapters/driving/bank/poll-transfers.ts — scheduled task; the clock calls it, the bank is the outside it adapts (S14)
import type { BankClient, BankTransfer } from "./bank-client";           // the bank API's schema, stated once here (P14)
export const pollTransfers = (deps: { bank: BankClient; applyTransfer: ApplyIncomingTransfer; cursor: TransferCursor }) => async (): Promise<void> => {
  const since = await deps.cursor.lastBookingDate();                       // answering call
  for (const t of await deps.bank.transfers({ bookedFrom: minusDays(since, 3) })) {
    await deps.applyTransfer.apply(toIncomingTransfer(t));                  // one acting call per polled item = per message (S1)
  }
};
const toIncomingTransfer = (t: BankTransfer): IncomingTransferMessage => ({
  messageId: `bank:${t.transactionId}`, amount: money(t.amountCents), reference: t.remittanceInformation ?? "", bookedOn: t.bookingDate,
});
```

```ts
// systems/billing/domain/transfer-matching.ts — billing's rules for transfers
/** Business rule (P17 s1, accepting): a transfer that matches no open invoice by reference is kept as
 * unmatched for a clerk; an amount short of the invoice is applied and leaves the invoice open for the rest. */
export const matchTransfer = (t: IncomingTransfer, candidate: Invoice | undefined):
  | { kind: "unmatched"; record: UnmatchedTransfer }
  | { kind: "applied"; invoice: Invoice; paidInFull: boolean } => {
  if (candidate === undefined || candidate.state !== "open") return { kind: "unmatched", record: { transferId: t.messageId, amount: t.amount, reference: t.reference } };
  if (candidate.appliedTransfers.includes(t.messageId)) return { kind: "applied", invoice: candidate, paidInFull: candidate.state === "paid" }; // P9 by records
  const invoice = applyPayment(candidate, t);
  return { kind: "applied", invoice, paidInFull: invoice.state === "paid" };
};
```

How each billing situation is placed:
- **An invoice on `OrderPaid`, or on `OrderPlaced` for invoice orders.** One use case serves both, and `decideInvoicing` is billing's rule:
  - A card order's `OrderPlaced` → `notYet`.
  - An invoice order's `OrderPlaced` → `issue`.
  - Any `OrderPaid` with an invoice already there → `alreadyInvoiced`.
  - A card order's `OrderPaid` with no invoice → `issue`.

  A unique `orderId` on invoices makes two racing triggers fail each other (P10). Because `OrderPaidV1` carries the lines (P4 Why: the message carries what its handler needs), a card `OrderPaid` that arrives before its `OrderPlaced` invoices correctly (P18).
- **VAT by tax class.** `VAT_PERCENT` is stated once in billing's domain (P2). The rate is copied onto each invoice line as a snapshot. Prices are gross, so shop computes no VAT (N10).
- **Bank transfers.** The scheduled task polls the bank and hands each transfer on as a message under the bank's transaction id (P9 Why). `applyIncomingTransfer` claims that id, matches it, and either applies it or records it unmatched (P17). When an invoice becomes paid, it also clears the dunning stage on `CustomerAccount` in the same transaction (both aggregates, tied by the rule "clears once they pay", P7, P10) and publishes `InvoicePaidV1` and `DunningStageChangedV1` with the account's version (P18).
- **Scheduled dunning.** See T2: `scheduleDunning` fans out, and `advanceDunning` runs one customer per transaction. A reminder mail is a private message, sent by an executor (P8).
- **Credit notes.** On `RefundIssuedV1`, billing records a credit note against the order's invoice. If no invoice exists yet, it records the refund as pending (P18); if the reason is `orderCancelledBeforePayment`, its rule says no credit note at all. See the credit-note ok example.

### fulfillment

Fulfillment owns Stock (one aggregate per sku that holds its reservations), Shipment and `FulfillmentOrder` (its own record of what it knows of each order). It also owns `Article` (a replica of catalog's product, kept for the 3PL article master). Its handlers run in `apps/worker-fulfillment`, a process with its own entry point and assembly. That process also serves the 3PL webhook over `node:http`.

```ts
// systems/fulfillment/domain/stock.ts — reservations inside Stock, so two reservations of the last unit fail each other (P10)
export type Stock = { sku: Sku; onHand: number; reservations: readonly { orderId: string; quantity: number }[]; version: number };
export const available = (s: Stock): number => s.onHand - s.reservations.reduce((n, r) => n + r.quantity, 0);
export const reserve = (s: Stock, orderId: string, quantity: number): { kind: "reserved"; stock: Stock } | { kind: "short"; sku: Sku } =>
  s.reservations.some((r) => r.orderId === orderId) ? { kind: "reserved", stock: s }                              // P9 by records
  : available(s) >= quantity ? { kind: "reserved", stock: { ...s, reservations: [...s.reservations, { orderId, quantity }] } }
  : { kind: "short", sku: s.sku };
export const release = (s: Stock, orderId: string): Stock => ({ ...s, reservations: s.reservations.filter((r) => r.orderId !== orderId) });
```

```ts
// systems/fulfillment/domain/fulfillment-order.ts — what fulfillment knows of shop's order; order of writing from shop's version (P18)
export type FulfillmentOrder = {
  orderId: string; shopVersion: number; lines: readonly FulfillmentLine[] | null; method: "card" | "invoice" | null;
  state: "unseen" | "reserved" | "readyToShip" | "shipping" | "released" | "cancelledUnseen" | "refused"; version: number;
};
export type ShopOrderFact =
  | { kind: "placed"; shopVersion: number; lines: FulfillmentLine[]; method: "card" | "invoice" }
  | { kind: "paid"; shopVersion: number; lines: FulfillmentLine[]; method: "card" | "invoice" }
  | { kind: "cancelled"; shopVersion: number };
export const learn = (o: FulfillmentOrder, fact: ShopOrderFact): { order: FulfillmentOrder; todo: "reserve" | "reserveAndShip" | "ship" | "release" | "nothing" } => {
  if (fact.shopVersion <= o.shopVersion) return { order: o, todo: "nothing" };   // an older fact than one already applied
  const next = { ...o, shopVersion: fact.shopVersion };
  switch (fact.kind) {
    case "cancelled": return o.state === "reserved" ? { order: { ...next, state: "released" }, todo: "release" } : { order: { ...next, state: "cancelledUnseen" }, todo: "nothing" };
    case "placed": return fact.method === "invoice"
      ? { order: { ...next, lines: fact.lines, method: "invoice", state: "readyToShip" }, todo: "reserveAndShip" }   // saga step 6
      : { order: { ...next, lines: fact.lines, method: "card", state: "reserved" }, todo: "reserve" };
    case "paid": return o.state === "readyToShip" || o.state === "shipping"
      ? { order: next, todo: "nothing" }                                                                              // invoice order, already acted on
      : { order: { ...next, lines: fact.lines, method: fact.method, state: "readyToShip" }, todo: o.state === "reserved" ? "ship" : "reserveAndShip" };
  }
};
```

```ts
// systems/fulfillment/service/book-shipment.ts — executor for the private BookShipment: makes the change, decides nothing again (P8)
export const createBookShipment = <Tx>(d: BookShipmentDeps<Tx>): BookShipment => ({
  async book(msg) {
    const prior = await d.tx.run((tx) => d.handled.peek(tx, msg.id, BookResult));
    if (prior !== undefined) return prior;
    const existing = await d.threePl.findConsignment({ reference: msg.shipmentId });   // 3PL takes no key: ask first (P9 s3)
    const booked = existing ?? (await d.threePl.createConsignment({ reference: msg.shipmentId, lines: msg.lines, address: msg.address }));
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.id, BookResult);
      if (!claim.first) return claim.result;
      const shipment = await d.shipments.load(tx, msg.shipmentId);
      const step = booked.kind === "refused" ? recordBookingRefused(shipment, booked.reason) : recordBooked(shipment, booked.consignmentId);
      await d.shipments.save(tx, step.shipment);
      for (const m of step.messages) await d.outbox.add(tx, m);
      await d.handled.settle(tx, msg.id, step.result);
      return step.result;
    });
  },
});
```

```ts
// systems/fulfillment/domain/shipment.ts (excerpt)
/** Business rule (P9 s3): the 3PL takes no idempotency key. A consignment is looked up by our shipment id
 * before one is created; a second consignment created by two overlapping attempts is accepted and cancelled
 * by the warehouse team from the daily duplicate report. */
export const DUPLICATE_CONSIGNMENT_ACCEPTED = "cancelledFromDailyReport" as const;
```

How each fulfillment situation is placed:
- **Reserve on `OrderPlaced`, release on `OrderCancelled`.** These are `learn` plus `reserve`/`release`, in one transaction across the order's Stock aggregates and `FulfillmentOrder` (P7).
  - A shortage commits `refused` and publishes `ReservationRefusedV1` from fulfillment's published language, naming no sender (P17, sentence 3).
  - A lost race on the last unit is a failure: the transaction rolls back, the message is redelivered, and the redelivery then finds the shortage (P17, P10).
- **`OrderPaid` or `OrderCancelled` before `OrderPlaced`.** `FulfillmentOrder` records what the early message says, and the version from shop decides what an older one may still change (P18). A cancel that arrives first leaves `cancelledUnseen`, and the late `OrderPlaced` (v1 < v2) reserves nothing.
- **3PL webhooks in the 3PL's terms.** A hook in `worker-fulfillment/http.ts` verifies and translates, the use case claims the 3PL event id (P9), shipment statuses move forward only (P18), and the hook answers after the commit (P8).
- **The article master.** Catalog's `ProductChangedV1` reaches fulfillment's handler, `registerArticle` updates the `Article` replica (highest revision wins) and writes a private `RegisterArticleAt3PL`. Its executor PUTs the article under the sku, which is idempotent by key (P9, sentence 2).
  - A booking that the 3PL rejects because an article is unknown is a *failure*, retried, and not a refusal (P17, sentence 3).
  - The shipment's own deadline ends fulfillment's part if registration never lands (P17, sentence 2).
- **The worker's own entry point and assembly.** `apps/worker-fulfillment/main.ts` loads telemetry first, then `assembly.ts`, which calls `buildFulfillmentWorker` and subscribes its handlers to the bus (P5). The web process's assembly calls only `buildFulfillmentQueries` for the stock field (N9).

### common library

```ts
// packages/common/src/courier.ts
export interface Courier<T> { fill(value: T): void; get(): T }
export const createCourier = <T>(name: string): Courier<T> => {
  let held: T | undefined;
  return {
    fill: (value) => { held = value; },
    get: () => { if (held === undefined) throw new Error(`courier ${name} read before assembly filled it`); return held; }, // fails loudly (P5 Why)
  };
};
```

```ts
// packages/common/src/telemetry/logger.ts and tracer.ts — ready-made, imported by services and adapters (P5 exception)
import pino from "pino";
export const logger = pino({ level: "info" });                            // stdout; nothing outside the process to fail (P6 s3)
export { trace } from "@opentelemetry/api";                              // no-op span with no SDK registered (P6 Why)
// packages/common/src/telemetry/node-sdk.ts — imported only by entry points
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
export const startTelemetry = (c: { serviceName: string; jaegerOtlpUrl: string; metricsPort: number }): NodeSDK => {
  const sdk = new NodeSDK({ serviceName: c.serviceName, traceExporter: new OTLPTraceExporter({ url: c.jaegerOtlpUrl }),
    metricReader: new PrometheusExporter({ port: c.metricsPort }), instrumentations: [getNodeAutoInstrumentations()] });
  sdk.start();
  return sdk;
};
```

```ts
// packages/common/src/messaging/relay.ts — marks only after the bus holds the batch (P8)
export const runRelay = async (readers: readonly OutboxReader[], bus: BusPublisher, signal: AbortSignal): Promise<void> => {
  while (!signal.aborted) {
    let moved = 0;
    for (const reader of readers) {
      const batch = await reader.pending(100);
      if (batch.length === 0) continue;
      await bus.publish(batch);                                            // durable: Postgres-backed queue
      await reader.markDelivered(batch.map((m) => m.id));
      moved += batch.length;
    }
    if (moved === 0) await sleepUnlessAborted(500, signal);
  }
};
```

```ts
// packages/common/src/messaging/pg-bus.ts (excerpt) — durable, redelivers until a handler acknowledges, parks after N
export type Subscription = { type: string; handle: (envelope: Envelope) => Promise<void> };
// consumer loop: lock a due row (deliver_at <= now, visible_at <= now) FOR UPDATE SKIP LOCKED, set visible_at = now + 60s, commit;
// await handle(envelope); on success DELETE the row (the ack); on throw: attempts++, visible_at = now + backoff(attempts),
// attempts >= 12 -> move to bus_dead_letters (still held, P8 Why)
```

How each common-library situation is placed:
- **pino and the OTel tracer** are imported ready-made by services and adapters (P5's telemetry clause). With no SDK registered in tests, the spans are no-ops and the logger writes to stdout (P6, sentence 3).
- **The Jaeger exporter** is registered only by entry points.
- **The relay and the bus** are common-library code that assembly hands outbox readers and subscriptions (glossary).
- **The Drizzle client factory** is called by assembly only (P5, sentence 3).
- **The ambient unit of work** is deleted. P16's sentence 2 refuses a transaction kept ambient, and P5's Why refuses a service opening its transaction "through the common library's interface". Each system declares `Transactions<Tx>`, and the common library implements it by shape.
- **OTel's ambient context** is telemetry, and P4's Why lets it be ambient.
- **Auto-instrumentation must load first.** Every entry point loads `startTelemetry` before any import of a system (see the ok example).
- **The request id and trace context** cross systems through the outbox envelope (T1). In-process calls carry them through OTel's own ambient context. No transaction crosses: no driving port takes one (P16).

### The checkout saga

1. **Place and reserve.** Shop's `checkout` commits the order, the emptied cart and `OrderPlacedV1` (v1) in one transaction (P7, P8). The relay hands the event to the bus. Fulfillment's handler runs `learn` + `reserve` over the Stock aggregates (P10) and, on a shortage, publishes `ReservationRefusedV1` (P17). Shop's handler for that event runs `onReservationRefused`: cancel the order if it is unpaid, and request a refund if it is paid (P17, P18 sentence 3: shop's rule decides between payment's and fulfillment's news).
2. **The PaymentIntent.** Before step 1's commit, shop's `checkout` calls payment's `createPaymentIntent` through `CardPayments` → `inProcessCardPayments` (an anti-corruption adapter, no transaction). The intent is tentative (P8) and needed now (P15). The `client_secret` returns to the browser in the action's answer.
3. **Stripe's webhook.** It reaches payment's hook, which claims the event id and applies `applyOutcome`. Payment publishes `PaymentSucceededV1` or `PaymentFailedV1`, each with `paymentVersion` (P9, P18).
4. **Success.** Shop's handler `cardPaymentOutcome.succeeded` loads the order by `paymentRef`. While the order is `awaitingPayment` it marks it paid and publishes `OrderPaidV1` (v2) (P9 by records: a paid order stays paid and nothing is published again). Billing issues the invoice and fulfillment ships (`learn` → `ship`, private `BookShipment`, executor).
5. **Failure or deadline.** Shop's Order holds `payment.deadline` (P17, sentence 2). The delayed private `PaymentDeadlineReached`, written at checkout, arrives at the deadline. Its handler and `PaymentFailedV1`'s handler both call `cancelForPayment`: when the order is still `awaitingPayment`, it is cancelled, `OrderCancelledV1` (v2) is published, and `CancelCardPaymentV1` is sent to payment. The deadline and a success meet on one aggregate, the version check decides which commits first, and the other is redelivered against the new state (P10, P17). Fulfillment releases the reservation.
6. **Paid by invoice.** `OrderPlacedV1.paymentMethod = "invoice"`, a required field from v1 on (P14). Billing invoices it on that message and fulfillment reserves and ships it. Billing matches the transfer and publishes `InvoicePaidV1`; shop marks the order paid and publishes `OrderPaidV1`, which billing and fulfillment receive and treat as `alreadyInvoiced`/`nothing`. Shop's card deadline does not apply. Its `settlementWaitEnds` does: at that moment shop's rule *accepts* the order as `settledElsewhere` (P17, sentences 1 and 2; reading S8).
7. **Late payment.** `PaymentSucceededV1` reaches an order shop already cancelled. `onCardPaymentSucceeded` returns `refund`: shop sets `refund.requested` and sends `RefundPaymentV1` with `reason: "orderCancelledBeforePayment"` (P17, sentence 1: undo, asked of the system that took the step). Payment's `decideRefund` then either issues the refund (`RefundIssuedV1` → shop marks `refund.issued`; billing's rule creates no credit note for this reason) or refuses it (disputed → `RefundRefusedV1` → shop's rule records the refusal and flags the order for customer service, accepting).

```ts
// systems/shop/domain/late-payment.ts — the late payment, decided by shop's rule (P17)
export const onCardPaymentSucceeded = (o: Order, refundId: string): { order: Order; messages: ShopOutgoing[]; result: PaymentOutcomeResult } => {
  switch (o.status) {
    case "awaitingPayment": { const paid: Order = { ...o, status: "paid" }; return { order: paid, messages: [orderPaid(paid)], result: { kind: "markedPaid" } }; }
    case "paid": case "settledElsewhere": return { order: o, messages: [], result: { kind: "alreadyPaid" } };
    case "cancelled": {
      if (o.refund !== null) return { order: o, messages: [], result: { kind: "refundAlreadyRequested" } };
      const next: Order = { ...o, refund: { refundId, state: "requested" } };
      return { order: next, messages: [refundPayment(next, "orderCancelledBeforePayment")], result: { kind: "refundRequested", refundId } };
    }
  }
};
```

### Cross-cutting reads

- **The admin dashboard** cannot join `shop.orders`, `billing.invoices` and `fulfillment.shipments` (P11, sentence 1). Nor can it call three open host services per page view (P15: no business rule needs those answers now). It is placed as a new system, `backoffice`. Its handlers keep a replica `backoffice.order_overview` from `OrderPlacedV1`, `OrderPaidV1`, `OrderCancelledV1`, `InvoiceIssuedV1`, `InvoicePaidV1` and `ShipmentDispatchedV1`, each kept by its writer's version (P18). The dashboard page, backoffice's driving adapter, calls backoffice's answering use case, which queries backoffice's own table. The join happens only in backoffice's own records.
- **Revalidating the cached shop page on a Payload edit.**
  1. Catalog's `ProductChangedV1` (committed with the edit, through catalog's outbox) reaches shop's handler `revalidateProductPage`.
  2. That handler calls the `PageCache` port.
  3. The adapter POSTs to the web process's revalidation route, which calls `revalidateTag`.

  Revalidating after the commit is what P8 requires: revalidating before it would cache the old product again. A second revalidation is accepted by a stated rule (P9, sentence 3). The route itself is UI and is not covered (Assumptions).
- **`/health` and `/metrics`.** `/health` is a probe: it reads the pool from a `probeCourier` that the web assembly fills and runs `select 1`. It reaches no system. `/metrics` is served by the OTel Prometheus exporter that the entry point registers. Probes sit outside the layers (Assumptions).

## Ok examples

### p1-ok-shop-domain-reach.md
```yaml
breaches: []
satisfies: [P1, P12, P5]
situation: shop — Cart, Order, snapshot of catalog's product
finding:
```
# Shop's domain reaches only the kernel and pure libraries
```ts
// systems/shop/domain/order.ts — imports
import { z } from "zod";                                                           // pure, no outside terms, every runtime
import { MoneySchema, SkuSchema, add, times, money, type Money } from "@teeladen/kernel"; // shared kernel
// not here: "drizzle-orm", "payload", "../payload-types", "@teeladen/catalog", "@teeladen/billing", "node:crypto", "../service/ports"
```
Shop's domain reaches only what P1's closed list names: the shared kernel and pure code of no system that loads on every runtime (zod; `big.js` through the kernel). Payload's generated `Product` and catalog's `ProductChangedV1` never reach it (P12: shop records no conformance). The domain takes the time and the ids as arguments (`placeOrder({ now, id })`), so it reaches no clock (P1's pure test). The ports are declared in `service/`, not in the domain (P5 Why).

### p2-ok-payload-collection-rules.md
```yaml
breaches: []
satisfies: [P2, P3, P11]
situation: catalog — price above zero, sku unique in Payload's collection config
finding:
```
# Catalog's own rules stay in catalog's config, and shop does not restate them
```ts
// catalog/collections/products.ts
{ name: "sku", type: "text", required: true, unique: true },
{ name: "priceCents", type: "number", required: true, min: 1 },
// systems/shop/domain/product-offer.ts — shop copies, it does not re-decide
export const toProductOffer = (m: { productId: string; revision: number; slug: string; sku: Sku; title: string; price: Money; taxClass: TaxClass; published: boolean }): ProductOffer => ({ ...m });
```
Catalog owns the product (fixture table), so the rules about what a product holds are catalog's and are stated in its configuration. P2's Why: "the business rules it holds are the external system's own where they decide a record the external system keeps and no business rule of this system decides." Shop's replica parses price and sku with the kernel's value schemas, which are value rules and not catalog's rules. It does not check `price > 0`, which would be a second statement of catalog's rule (P2, P3).

### p3-ok-sku-veto-catalog-decides.md
```yaml
breaches: []
satisfies: [P3, P2, P13, P16, P8, P5]
situation: catalog — beforeChange asks shop how many open orders carry a sku and refuses the change
finding:
```
# Shop answers a count; catalog decides the veto
```ts
// systems/shop/service/open-orders.ts — answering use case of shop's open host service
export const createOpenOrders = <Tx>(d: { tx: Transactions<Tx>; orders: Orders<Tx> }): OpenOrders => ({
  async countCarrying(raw) {
    const { sku } = CountCarryingInput.parse(raw);
    return { count: await d.tx.run((tx) => d.orders.countOpenCarrying(tx, sku)) }; // "open" is shop's isOpen (P2)
  },
});
// catalog/collections/products.ts — catalog's rule
if (count > 0) throw new APIError(`SKU ${originalDoc.sku} is on ${count} open order(s)`, 409);
```
The veto decides what catalog's product may hold, so it belongs to catalog (P3: "it asks, the owner decides"). Shop's part is an answering use case that applies its own definition of "open" (`isOpen` in shop's domain, used by the repository's query through a shared status list) and decides no catalog record.

What crosses is shop's published language (P13). Catalog's config imports only shop's offer type `OpenOrders` and gets the instance from a courier (P5). No `req` is passed, so shop's read runs outside Payload's transaction (P16), and since the answer changes nothing, P8's sentence 3 has nothing to defer.

### p3-ok-kernel-values-only.md
```yaml
breaches: []
satisfies: [P3, P1, P12]
situation: shared kernel — Money, Sku
finding:
```
# The kernel holds values and computations from arguments, no record schema
```ts
// packages/kernel/src/money.ts
import Big from "big.js";
import { z } from "zod";
export const MoneySchema = z.object({ cents: z.number().int(), currency: z.literal("EUR") });
export type Money = z.infer<typeof MoneySchema>;
export const money = (cents: number): Money => ({ cents, currency: "EUR" });
export const add = (a: Money, b: Money): Money => money(a.cents + b.cents);
export const times = (a: Money, n: number): Money => money(a.cents * n);
export const equals = (a: Money, b: Money): boolean => a.cents === b.cents && a.currency === b.currency;
export const greaterThan = (a: Money, b: Money): boolean => a.cents > b.cents;
export const shareOfGross = (gross: Money, percent: number): Money =>
  money(new Big(gross.cents).times(percent).div(100 + percent).round(0, Big.roundHalfUp).toNumber());
// packages/kernel/src/sku.ts
export const SkuSchema = z.string().regex(/^[A-Z0-9-]{3,32}$/).brand<"Sku">();
export type Sku = z.infer<typeof SkuSchema>;
```
The kernel holds no `Order`, `Invoice` or `Stock` schema and no rule about a record (P3, sentence 2). `shareOfGross` computes from its arguments, while the rate it is given is billing's (`VAT_PERCENT`). The kernel imports no system's published language (P12, sentence 3). It is pure, in no outside terms, and loads on every runtime (P1).

### p2-ok-vat-rate-in-billing-domain.md
```yaml
breaches: []
satisfies: [P2, P3, P19]
situation: billing — VAT rate follows from the tax class: 7% tea, 19% accessories
finding:
```
# The rate is stated once in billing's domain and snapshotted on the line
```ts
// systems/billing/domain/invoice.ts
export const invoiceLine = (l: { sku: string; quantity: number; unitGross: Money; taxClass: BillingTaxClass }): InvoiceLine => {
  const gross = times(l.unitGross, l.quantity);
  return { ...l, gross, vatPercent: VAT_PERCENT[l.taxClass], vat: vatOf(gross, l.taxClass) }; // the rate copied as the invoice's own fact
};
// systems/billing/adapters/driving/bus/order-handlers.ts — translation, shop's term to billing's
const taxClass = BillingTaxClass.parse(line.taxClass);
```
The rates are values the rule decides by, the same for every candidate and held by no record, so they sit in the domain (P2) and not in configuration. The invoice record is billing's, so the rule is billing's (P3). Shop's `OrderPaidV1` carries the tax class, not a rate: shop does not state billing's rule. `BillingTaxClass` is billing's own term, translated in the handler (P19).

### p4-ok-checkout-one-acting-call.md
```yaml
breaches: []
satisfies: [P4, P5, P2]
situation: shop — checkout server action; saga step 1
finding:
```
# The server action translates, finds the caller and makes one acting call
```ts
// apps/web/app/(shop)/checkout/actions.ts — shop's driving adapter (see How the fixture is built, shop)
const parsed = CheckoutForm.safeParse(Object.fromEntries(form));
if (!parsed.success) return { ok: false, reason: "invalidInput" };
const customer = await currentCustomer();
if (customer === undefined) return { ok: false, reason: "unauthenticated" };
const r = await shopCourier.get().checkout.checkout({ cartId: parsed.data.cartId, customerId: customer.id, method: parsed.data.method }, carrier);
// systems/shop/adapters/driving/next/checkout-form-schema.ts
export const CheckoutForm = z.object({ cartId: CartId, method: z.enum(["card", "invoice"]) }); // domain's CartId schema
```
The action parses with the domain's schemas (P2), works out who the caller is, and makes exactly one acting call (P4, sentence 3). It refuses neither the invoice method nor a customer in dunning: the service decides that on every way in (P4, sentence 1). It reads the courier each time it runs (P5, sentence 3).

### p4-ok-driven-adapter-no-ambient.md
```yaml
breaches: []
satisfies: [P4, P5]
situation: shop — order-confirmation mail; locale and links
finding:
```
# The mail adapter renders from arguments only; the locale and the shop's origin travel in the message
```ts
// systems/shop/domain/confirmation-mail.ts
export type OrderConfirmationMail = { orderId: OrderId; to: string; locale: "de" | "en"; lines: readonly OrderLine[]; total: Money; orderUrl: string };
// systems/shop/adapters/driven/mail/provider-confirmations.ts
export const providerConfirmations = (client: MailClient, from: string): OrderConfirmations => ({
  async send(mail) {
    await client.send({ from, to: mail.to, subject: subjectFor(mail.locale), html: renderConfirmation(mail) }); // `from`: see S6
  },
});
```
The locale and the order URL are arguments, carried in `SendOrderConfirmation`. That message was written by checkout, and the origin came from the action, which read it from the request (P4 Why: "a handler that needs a value of the request that wrote its message gets it in the message"). No `process.env.TZ` and no ambient request reaches the rendering. The `from` address is a configuration value handed to the factory by assembly (P5, sentence 3). It is written into the mail, which strictly falls under P4's sentence 2 (reading S6, purpose-not-told); I keep it only because it is the same in every process, which ASM-10 covers.

### p5-ok-courier-breaks-payload-cycle.md
```yaml
breaches: []
satisfies: [P5, P13]
situation: catalog — config needs hooks, hooks need services, services need the Payload instance
finding:
```
# Web assembly builds Payload, then the systems, then fills the couriers
```ts
// apps/web/assembly.ts
import { getPayload } from "payload";
import config from "@teeladen/catalog/payload.config";
import { catalogCourier } from "@teeladen/catalog/courier";
import { createDrizzleClient } from "@teeladen/common/db/drizzle-client";
import { buildShopWeb } from "@teeladen/shop";
import { buildPaymentWeb } from "@teeladen/payment";
import { buildFulfillmentQueries } from "@teeladen/fulfillment";
import { buildBackofficeWeb } from "@teeladen/backoffice";
import { probeCourier } from "./probe-courier";
export async function assemble(c: WebConfig): Promise<void> {
  const db = createDrizzleClient({ url: c.databaseUrl, poolSize: c.poolSize });
  const payload = await getPayload({ config });
  const payment = buildPaymentWeb({ db, stripe: { apiKey: c.stripeKey, webhookSecret: c.stripeWebhookSecret } }); // fills payment's courier
  const shop = buildShopWeb({ db, payload, paymentIntents: payment.paymentIntents, mail: c.mail, revalidateUrl: c.revalidateUrl }); // fills shop's courier
  buildFulfillmentQueries({ db });                         // fills the stock field's courier
  buildBackofficeWeb({ db });
  catalogCourier.fill({ openOrders: shop.openOrders });    // catalog's config is no system: assembly fills its courier directly
  probeCourier.fill({ db });
}
```
Payload's config is imported before any service exists, and the functions it holds read couriers at run time. Assembly is the only filler: system builders fill their own couriers, and assembly fills catalog's directly. A reader that runs before assembly fails loudly (P5 Why). Assembly reaches each system only through its offer: builders and open host service types (P5, sentence 2; P13).

### p5-ok-instrumentation-entry.md
```yaml
breaches: []
satisfies: [P5, P6]
situation: common library — auto-instrumentation must load before any other import; worker's own entry point
finding:
```
# Entry points start telemetry, then import assembly
```ts
// apps/web/instrumentation.ts — Next.js runs register() once before serving
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("@teeladen/common/telemetry/node-sdk");
  const { readWebConfig } = await import("./config");
  const c = readWebConfig(process.env);
  startTelemetry({ serviceName: "web", jaegerOtlpUrl: c.jaegerOtlpUrl, metricsPort: c.metricsPort });
  const { assemble } = await import("./assembly");          // after the patch, so pg and http are instrumented
  await assemble(c);
}
// apps/worker-fulfillment/main.ts — run as `node --import ./instrumentation.js main.js`
import { readWorkerConfig } from "./config";
import { assemble } from "./assembly";
const c = readWorkerConfig(process.env);
const running = await assemble(c);                           // buildFulfillmentWorker + bus subscriptions + http hook server
process.on("SIGTERM", () => void running.stop());
```
Telemetry is registered only where the process starts, so tests that load services register nothing and the OTel API answers with no-ops (P6, sentence 3). Configuration is read in one place per process and handed on as arguments (P5, sentence 3). The worker has its own entry point and assembly, as the fixture says.

### p5-ok-probes.md
```yaml
breaches: []
satisfies: [P5, P11]
situation: cross-cutting — /health pings the database; /metrics is scraped
finding:
```
# Probes read what assembly made and reach no system
```ts
// apps/web/app/api/health/route.ts — a probe (glossary)
import { sql } from "drizzle-orm";
import { probeCourier } from "../../../probe-courier";
export async function GET(): Promise<Response> {
  try { await probeCourier.get().db.execute(sql`select 1`); return Response.json({ ok: true }); }
  catch { return Response.json({ ok: false }, { status: 503 }); }
}
// /metrics: PrometheusExporter registered in startTelemetry({ metricsPort }) — served by the SDK, no route of ours
```
A probe reports on the process, sits outside the layers (Assumptions), and touches no system's records (P11) or driving ports. The pool reaches it from assembly through a courier, not built in place (P5's mechanism, applied here for the same reason even though the probe is no system's code).

### p5-ok-worker-assembly.md
```yaml
breaches: []
satisfies: [P5, P8, P11]
situation: fulfillment — runs in its own worker process; relay reads every outbox
finding:
```
# Each worker's assembly hands the relay the readers that each owner provides
```ts
// apps/worker/assembly.ts
import { buildShopWorker } from "@teeladen/shop";
import { buildPaymentWorker } from "@teeladen/payment";
import { buildBillingWorker } from "@teeladen/billing";
import { buildBackofficeWorker } from "@teeladen/backoffice";
import { payloadOutboxReader } from "./catalog-outbox-reader";
export async function assemble(c: WorkerConfig): Promise<Running> {
  const db = createDrizzleClient({ url: c.databaseUrl, poolSize: c.poolSize });
  const payload = await getPayload({ config });
  const bus = createPgBus({ db });
  const shop = buildShopWorker({ db, payload, mail: c.mail, revalidateUrl: c.revalidateUrl });
  const payment = buildPaymentWorker({ db, stripe: { apiKey: c.stripeKey } });
  const billing = buildBillingWorker({ db, bank: c.bank, mail: c.mail });
  const backoffice = buildBackofficeWorker({ db });
  const relay = runRelay([shop.outboxReader, payment.outboxReader, billing.outboxReader, payloadOutboxReader(payload)], bus, c.signal);
  const consumers = bus.consume([...shop.subscriptions, ...payment.subscriptions, ...billing.subscriptions, ...backoffice.subscriptions], c.signal);
  const schedules = startSchedules([...shop.schedules, ...billing.schedules], c.signal);
  return { stop: () => Promise.all([relay, consumers, schedules]).then(() => undefined) };
}
// apps/worker-fulfillment/assembly.ts: buildFulfillmentWorker({ db, threePl: c.threePl }) -> { outboxReader, subscriptions, webhook }
```
The relay reaches each outbox only through the reader its owner's builder returns (P11, P5). For catalog, assembly provides the reader (glossary: Outbox). No relay lists table names. Fulfillment's outbox reader is handed to a relay in `worker-fulfillment`, so a process that does not load fulfillment relays nothing of it (P5 Why).

### p6-ok-orders-contract-suite.md
```yaml
breaches: []
satisfies: [P6, P10]
situation: shop — Order stored via Drizzle; checkout test on fakes
finding:
```
# One suite per port, parameterized by implementation
```ts
// systems/shop/test/service/ports/orders.contract.ts
export const ordersContract = <Tx>(name: string, make: () => Promise<{ tx: Transactions<Tx>; orders: Orders<Tx> }>) =>
  describe(`Orders contract (${name})`, () => {
    it("should fail a save whose version changed since the load", async () => {
      // given
      const { tx, orders } = await make();
      await tx.run((t) => orders.insert(t, anOrder({ version: 0 })));
      const stale = await tx.run((t) => orders.load(t, anOrderId));
      await tx.run(async (t) => { const o = await orders.load(t, anOrderId); if (o) await orders.save(t, { ...o, status: "paid" }); });
      // when
      const saving = tx.run(async (t) => { if (stale) await orders.save(t, { ...stale, status: "cancelled" }); });
      // then
      await expect(saving).rejects.toThrow(StaleWrite);
    });
  });
// systems/shop/test/service/ports/orders.fake.test.ts — default suite
ordersContract("fake", async () => fakeShopStore());
// systems/shop/test/adapters/driven/drizzle/orders.integration.test.ts — DB migrated by the production migrations
ordersContract("drizzle", async () => drizzleShopStore(await migratedDatabase()));
```
Every driven port of shop (`Transactions`, `Orders`, `Carts`, `ProductOffers`, `CustomerStandings`, `ShopOutbox`, `HandledMessages`, `CardPayments`, `OrderConfirmations`, `PageCache`, `ProductCatalog`, `Clock`, `Ids`) has a fake in `systems/shop/offer/fakes` or `test/fakes`, provided by shop (P6, sentence 1). The stale-save behavior that checkout's tests rely on is asserted on the fake and on the real adapter against the database as the migrations set it up (P6, sentence 2; P10).

### p6-ok-otel-noop-in-tests.md
```yaml
breaches: []
satisfies: [P6, P5]
situation: common library — OpenTelemetry keeps its own ambient context and returns a no-op span when empty
finding:
```
# Services trace ready-made; tests register nothing
```ts
// systems/fulfillment/adapters/driven/threepl/threepl-client.ts
import { trace } from "@teeladen/common/telemetry/tracer";
const tracer = trace.getTracer("fulfillment.threepl");
export const threePlConsignments = (http: ThreePlHttp): ThreePlConsignments => ({
  async createConsignment(c) {
    return tracer.startActiveSpan("3pl.createConsignment", async (span) => {
      try { return toBooking(await http.post("/consignments", toThreePlConsignment(c))); } finally { span.end(); }
    });
  },
  /* findConsignment, putArticle */
});
```
The tracer is common-library telemetry, reached through no port (P5's clause). With no SDK registered, as in every test, `startActiveSpan` runs the callback with a no-op span, so the use case acts the same without the outside (P6, sentence 3).

### p7-ok-checkout-one-transaction.md
```yaml
breaches: []
satisfies: [P7, P8, P10, P16]
situation: shop — places the order, empties the cart, publishes OrderPlaced; saga step 1
finding:
```
# Order, cart and messages commit in one transaction the service opens
```ts
// systems/shop/service/checkout.ts (excerpt)
return d.tx.run(async (tx) => {
  /* loads and placeOrder(...) */
  await d.orders.insert(tx, placed.order);
  await d.carts.save(tx, placed.cart);
  for (const m of placed.messages) await d.outbox.add(tx, m, telemetry); // OrderPlacedV1, SendOrderConfirmation, PaymentDeadlineReached
  return { kind: "placed", orderId, clientSecret: card?.clientSecret ?? null };
});
```
Every write the goal needs, order and emptied cart, sits in the transaction the service opens, and the transaction is an argument of every write (P7, P16). The messages commit with the change they tell of (P8). A throw anywhere rolls back the whole transaction, because `db.transaction` rolls back on rejection (P7). No status is set after the commit: `paymentRef` came from the call made before the transaction.

### p8-ok-payment-intent-tentative.md
```yaml
breaches: []
satisfies: [P8, P15, P16, P12, P13]
situation: shop — checkout must return a Stripe client_secret in the same request; payment creates it; saga step 2
finding:
```
# Shop's anti-corruption adapter calls payment's open host service with no transaction
```ts
// systems/shop/adapters/driven/payment/in-process-card-payments.ts
import type { PaymentIntents } from "@teeladen/payment";   // payment's offer
export const inProcessCardPayments = (payment: PaymentIntents): CardPayments => ({
  async request({ orderId, amount, payBy }) {
    const r = await payment.createPaymentIntent({ orderId, amount, confirmBy: payBy.toISOString() });
    return r.kind === "created" ? { kind: "opened", paymentRef: r.paymentId, clientSecret: r.clientSecret } : { kind: "refused" };
  },
});
// systems/payment/offer/published/payment-intents.ts
export const CreatePaymentIntentInputV1 = z.object({ orderId: z.string(), amount: MoneySchema, confirmBy: z.string().datetime() });
export const CreatePaymentIntentResultV1 = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("created"), paymentId: z.string(), clientSecret: z.string() }),
  z.object({ kind: z.literal("refused"), reason: z.literal("amountInvalid") }),
]);
export interface PaymentIntents { createPaymentIntent(i: z.input<typeof CreatePaymentIntentInputV1>): Promise<z.infer<typeof CreatePaymentIntentResultV1>> }
```
The PaymentIntent gives nothing until the customer confirms it, so it is a tentative operation, asked beside the transaction (P8; reading S13). The customer pays now, so the wait is a business rule's (P15). Payment's driving port takes no transaction, and the call carries none (P16). What crosses is payment's published language (P13), and payment's terms stop in shop's adapter (P12). `confirmBy` is shop's request, decided by shop's rule (P3 Why: "the hold time is shop's to ask").

### p8-ok-catalog-outbox-in-payload-transaction.md
```yaml
breaches: []
satisfies: [P8, P11, P16, P14]
situation: catalog — Payload transaction can write a document the relay reads; afterChange situation
finding:
```
# The change and its message commit together in Payload's transaction
```ts
// catalog/collections/products.ts (excerpt)
const writeProductChanged: CollectionAfterChangeHook<Product> = async ({ doc, req }) => {
  const message = ProductChangedV1.parse({ type: "catalog.ProductChanged.v1", productId: String(doc.id), revision: doc.revision, /* ... */ });
  await req.payload.create({ collection: "catalog-outbox", data: { messageId: crypto.randomUUID(), type: message.type, body: message }, req });
  return doc;
};
// catalog/collections/catalog-outbox.ts
export const CatalogOutbox: CollectionConfig = { slug: "catalog-outbox", admin: { hidden: true }, access: { read: () => false, update: () => false },
  fields: [{ name: "messageId", type: "text", unique: true, required: true }, { name: "type", type: "text", required: true },
           { name: "body", type: "json", required: true }, { name: "deliveredAt", type: "date" }] };
```
Payload calls `afterChange` before its transaction commits. Writing the message through `req` puts it in that transaction, so no system acts on a product change that may roll back (P8, sentence 3; the Why's TX-29 route). The outbox is catalog's own record, and the relay reaches it through the reader assembly provides (P11). Nothing of `req` reaches a system of this codebase (P16). The message is built with the one schema that every reader parses with (P14).

### p8-ok-confirmation-mail-via-outbox.md
```yaml
breaches: []
satisfies: [P8, P9, P2]
situation: shop — sends an order-confirmation mail once the order commits
finding:
```
# The mail leaves only by a message committed with the order
```ts
// systems/shop/service/send-order-confirmation.ts — executor of the private SendOrderConfirmation
export const createSendOrderConfirmation = <Tx>(d: { tx: Transactions<Tx>; handled: HandledMessages<Tx>; mails: OrderConfirmations }) => ({
  async send(msg: SendOrderConfirmationMessage): Promise<void> {
    await d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.id, z.null());
      if (!claim.first) return;                                  // a delivery after a commit sends nothing
      await d.mails.send(msg.mail);                              // decides nothing again (P8)
      await d.handled.settle(tx, msg.id, null);
    });                                                          // a stop after send, before commit -> sent again: accepted
  },
});
// systems/shop/domain/confirmation-mail.ts
/** Business rule (P9 s3): the mail provider takes no key. A second confirmation mail for one order is accepted. */
export const CONFIRMATION_MAY_REPEAT = true as const;
```
The mail is decided in checkout's transaction and leaves only after the commit, through the bus (P8). The executor makes the change and re-checks nothing about the order. A repeat after a committed claim sends nothing (P9, sentence 1). The repeat no claim can stop, a stop between send and commit, is accepted by a business rule stated in the domain (P9, sentence 3; P2).

### p8-ok-hook-acks-after-commit.md
```yaml
breaches: []
satisfies: [P8, P9, P4, P5, P12]
situation: payment — Stripe webhooks arrive at least once, in Stripe's terms
finding:
```
# The hook's 2xx is sent only after the use case committed
```ts
// apps/web/app/api/stripe/webhook/route.ts — payment's hook (see How the fixture is built, payment)
const message = toCardMessage(event);
if (message === undefined) return new Response(null, { status: 204 });
const result = await cardOutcomes.record(message);   // throws -> 500 -> Stripe resends
return Response.json(result);
```
For a hook, the external system is the holder and the answer is the acknowledgement (P8 Why). The hook awaits the use case, so a failure answers 500 and Stripe sends the event again. The hook verifies with a function handed by assembly and never calls Stripe (P5). Stripe's types stop at `toCardMessage` (P12). A type with no driving port is not translatable, so withholding it is the adapter's call (P4, sentence 3).

### p9-ok-stripe-event-claim.md
```yaml
breaches: []
satisfies: [P9, P18, P7, P10]
situation: payment — webhooks at least once, sometimes twice at once, out of order
finding:
```
# Stripe's event id is claimed in the transaction that applies the outcome
```ts
// systems/payment/service/card-outcomes.ts
export const createCardOutcomes = <Tx>(d: CardOutcomesDeps<Tx>): CardOutcomes => ({
  async record(m) {
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, m.messageId, CardOutcomeResult);  // unique key: an overlapping twin fails at commit
      if (!claim.first) return claim.result;                                      // returns as the first did
      const payment = await d.payments.loadByProcessorRef(tx, m.processorRef);
      if (payment === undefined) throw new UnknownPayment(m.processorRef);        // not found is no repeat (P9 Why): fail, redeliver
      const step = m.kind === "disputed" ? markDisputed(payment) : applyOutcome(payment, m.outcome);
      await d.payments.save(tx, step.payment);                                    // version-checked (P10)
      if (step.publish !== null) await d.outbox.add(tx, paymentEvent(step.publish, step.payment));  // carries payment.version + 1 (P18)
      const result = { kind: step.publish ?? "noChange" } as const;
      await d.handled.settle(tx, m.messageId, result);
      return result;
    });
  },
});
```
```ts
// packages/common/src/messaging/handled-messages.ts — implements each system's HandledMessages<Tx> by shape
export const drizzleHandledMessages = (table: HandledTable) => ({
  async claim<R>(tx: DrizzleTx, messageId: string, result: z.ZodType<R>): Promise<{ first: true } | { first: false; result: R }> {
    const inserted = await tx.insert(table).values({ messageId, result: null }).onConflictDoNothing().returning({ id: table.messageId });
    if (inserted.length === 1) return { first: true };
    const [row] = await tx.select().from(table).where(eq(table.messageId, messageId));
    return { first: false, result: result.parse(row?.result) };
  },
  async settle<R>(tx: DrizzleTx, messageId: string, result: R): Promise<void> {
    await tx.update(table).set({ result }).where(eq(table.messageId, messageId));
  },
});
```
The claim commits with the writes or not at all (P7, P9). A twin delivered at the same moment blocks on the key, then finds the claim the first one committed and returns its result. A `charge.dispute.created` and a `payment_intent.succeeded` in any order leave the same `Payment`, because the two concern different fields and succeeded is final (P18).

### p9-ok-stripe-refund-key.md
```yaml
breaches: []
satisfies: [P9, P17, P8]
situation: payment — refunds a payment when shop asks for it
finding:
```
# The refund executor passes the refund id to Stripe and looks it up past Stripe's 24 hours
```ts
// systems/payment/service/issue-refund.ts — executor of the private IssueStripeRefund
export const createIssueRefund = <Tx>(d: IssueRefundDeps<Tx>): IssueRefund => ({
  async issue(msg) {
    const answer = await d.cards.refund({ refundId: msg.refundId, processorRef: msg.processorRef, amount: msg.amount }); // key from the message
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.id, IssueResult);
      if (!claim.first) return claim.result;
      const payment = await d.payments.load(tx, msg.paymentId);
      const step = answer.kind === "issued" ? refundIssued(payment, msg.refundId, answer.processorRef) : refundDeclined(payment, msg.refundId, answer.reason);
      await d.payments.save(tx, step.payment);
      await d.outbox.add(tx, step.event);                       // RefundIssuedV1 | RefundRefusedV1
      await d.handled.settle(tx, msg.id, step.result);
      return step.result;
    });
  },
});
```
The change outside the transaction carries `refundId`, the same on every delivery, and Stripe answers a repeat with the first refund (P9, sentence 2). Past Stripe's 24-hour key window, the adapter finds the earlier refund by its metadata (the stripe adapter above). A Stripe decline is committed as a refusal; a timeout throws and is retried (P17, sentence 3). The executor makes the change and does not decide again whether a refund is wanted (P8).

### p9-ok-polled-transfer-as-message.md
```yaml
breaches: []
satisfies: [P9, P4, P15, P12, P14]
situation: billing — the bank API reports incoming transfers in the bank's terms
finding:
```
# Each polled transfer is handed on as one message under the bank's id
```ts
// systems/billing/service/apply-incoming-transfer.ts
export const createApplyIncomingTransfer = <Tx>(d: ApplyTransferDeps<Tx>): ApplyIncomingTransfer => ({
  async apply(t) {
    return d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, t.messageId, TransferResult);     // "bank:<transactionId>"
      if (!claim.first) return claim.result;                                     // the next poll's overlap changes nothing
      const step = matchTransfer(t, await d.invoices.findOpenByReference(tx, t.reference));
      const out = step.kind === "unmatched" ? await keepUnmatched(tx, d, step.record) : await applyToInvoice(tx, d, step);
      await d.handled.settle(tx, t.messageId, out);
      return out;
    });
  },
});
```
The poll re-reads three days back, so items repeat, and the bank's transaction id makes each one claimable (P9 Why: "an adapter that hands the use case rows without it leaves nothing to claim"). The scheduled task makes one acting call per polled item, each item read as the call it handles (P4; reading S1). Nobody waits on the poll (P15 Why). The bank's schema is stated once, in the adapter that carries the call (P12, P14).

### p9-ok-article-registration-keyed-by-sku.md
```yaml
breaches: []
satisfies: [P9, P8, P15, P12]
situation: fulfillment — the 3PL's article master needs each SKU before it ships one
finding:
```
# Registration is a PUT under the sku, made by an executor
```ts
// systems/fulfillment/service/register-article-at-3pl.ts
export const createRegisterArticleAt3pl = <Tx>(d: RegisterDeps<Tx>): RegisterArticleAt3pl => ({
  async register(msg) {
    await d.threePl.putArticle({ sku: msg.sku, title: msg.title, weightGrams: msg.weightGrams }); // PUT /articles/{sku}: repeat = same article
    await d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, msg.id, z.null());
      if (!claim.first) return;
      await d.articles.save(tx, markRegistered(await d.articles.load(tx, msg.sku), msg.revision));
      await d.handled.settle(tx, msg.id, null);
    });
  },
});
```
The key is the sku, carried by the message and the same on every delivery, and the 3PL answers a repeat by keeping one article (P9, sentence 2). The use case waits on the 3PL because waiting is the change its message asks for (P15, second exception). The executor decides nothing again (P8). The 3PL's article shape is translated in `threePl` (P12).

### p9-ok-mail-repeat-accepted.md
```yaml
breaches: []
satisfies: [P9, P2, P8]
situation: billing — dunning reminder mail (mail provider used by shop and billing)
finding:
```
# Billing's reminder mail: no key, a stated acceptance in billing's domain
```ts
// systems/billing/domain/dunning.ts
/** Business rule (P9 s3): the mail provider takes no key. A reminder mailed twice for one stage is accepted;
 * the stage itself rose once, by the claimed AdvanceDunning message. */
export const REMINDER_MAY_REPEAT = true as const;
// systems/billing/service/send-reminder.ts — executor; the claim makes a committed send final
await d.tx.run(async (tx) => { const c = await d.handled.claim(tx, msg.id, z.null()); if (!c.first) return; await d.mails.sendReminder(msg.mail); await d.handled.settle(tx, msg.id, null); });
```
Billing states its own acceptance, in its own domain. Shop's `CONFIRMATION_MAY_REPEAT` is a different rule about a different mail (P2, P3). The stage change and the mail are split: the stage commits in `advanceDunning` with the private `SendReminder` message (P8), so a repeated mail never repeats the stage.

### p10-ok-stock-aggregate-holds-reservations.md
```yaml
breaches: []
satisfies: [P10, P7, P17]
situation: fulfillment — reserves stock on OrderPlaced; two orders race for the last unit
finding:
```
# Reserving saves the Stock that holds the reservations
```ts
// systems/fulfillment/service/learn-order.ts (excerpt)
for (const line of todoLines) {
  const stock = await d.stocks.load(tx, line.sku);
  const r = reserve(stock, order.orderId, line.quantity);
  if (r.kind === "short") return refuseReservation(tx, d, order, r.sku);   // committed outcome + ReservationRefusedV1
  await d.stocks.save(tx, r.stock);                                         // where version = stock.version
}
```
The data the decision reads (`available`) is in the aggregate the use case saves. When two `OrderPlaced` race for the last unit, the second save fails, its transaction rolls back, and the redelivery decides afresh on the new stock (P10, sentence 1). Orders of different teas save different Stocks and do not fail each other (P10, sentence 3). The shortage found by the redelivery is a business refusal, committed (P17).

### p10-ok-order-line-snapshot.md
```yaml
breaches: []
satisfies: [P10, P15, P11]
situation: shop — checkout copies each line's price, sku and tax class from catalog's product
finding:
```
# The order keeps a snapshot; the replica is shop's own record
```ts
// systems/shop/domain/product-offer.ts
/** Business rule (P10 s2): the offer is shop's replica of catalog's product and lags it. An order placed
 * at the replica's price keeps that price; a change catalog made meanwhile applies to later orders. */
export type ProductOffer = { productId: string; revision: number; slug: string; sku: Sku; title: string; price: Money; taxClass: TaxClass; published: boolean };
```
The order line is a snapshot, so later price changes touch nothing of it, and it covers nothing of catalog's record (P10 Why). Checkout reads shop's own replica, not catalog: the replica is the keeper's record (P11 Why, "What is not reached is not refused"), and checkout keeps working while catalog's side is slow (P15). The stale price is accepted by a stated rule (P10, sentence 2).

### p10-ok-dunning-replica-stale-accepted.md
```yaml
breaches: []
satisfies: [P10, P15, P3, P12, P19]
situation: shop — pay-by-invoice, not to a customer billing has put into dunning
finding:
```
# Shop decides by its replica of billing's stage, under a stated rule
```ts
// systems/shop/service/refresh-customer-standing.ts — handler of billing's DunningStageChangedV1
export const createRefreshCustomerStanding = <Tx>(d: { tx: Transactions<Tx>; standings: CustomerStandings<Tx>; handled: HandledMessages<Tx> }) => ({
  async apply(m: { messageId: string; customerId: string; inDunning: boolean; billingVersion: number }): Promise<void> {
    await d.tx.run(async (tx) => {
      const claim = await d.handled.claim(tx, m.messageId, z.null());
      if (!claim.first) return;
      await d.standings.put(tx, applyStanding(await d.standings.find(tx, m.customerId), { customerId: m.customerId, inDunning: m.inDunning, billingVersion: m.billingVersion }));
      await d.handled.settle(tx, m.messageId, null);
    });
  },
});
// systems/shop/adapters/driving/bus/subscriptions.ts — billing's term stops here
{ type: "billing.DunningStageChanged.v1", handle: async (e) => { const b = DunningStageChangedV1.parse(e.body);
  await shop.refreshCustomerStanding.apply({ messageId: e.id, customerId: b.customerId, inDunning: b.stage > 0, billingVersion: b.customerVersion }); } }
```
The rule "not to a customer in dunning" decides what shop's order holds, so it is shop's (P3), stated in `mayPayByInvoice`. Billing's stage enters shop only as input, translated to `inDunning` in the handler (P12, P19). Checkout reads the replica (P15) under a rule that accepts it stale (P10, sentence 2).

### p10-ok-gapless-counter.md
```yaml
breaches: []
satisfies: [P10, P7, P2]
situation: billing — gapless invoice numbers
finding:
```
# The number is taken from a series aggregate saved in the invoice's transaction
```ts
// systems/billing/adapters/driven/drizzle/invoice-number-series.ts
export const drizzleSeries = (): InvoiceNumberSeriesRepo<DrizzleTx> => ({
  async load(tx, year) {
    await tx.insert(series).values({ year, last: 0, version: 0 }).onConflictDoNothing();
    const [row] = await tx.select().from(series).where(eq(series.year, year));
    if (row === undefined) throw new Error(`series ${year} missing`);
    return row;
  },
  async save(tx, s) {
    const r = await tx.update(series).set({ last: s.last, version: s.version + 1 }).where(and(eq(series.year, s.year), eq(series.version, s.version))).returning({ year: series.year });
    if (r.length !== 1) throw new StaleWrite(`series ${s.year}`);
  },
});
```
A Postgres sequence would leave gaps on rollback, while a counter saved in the invoice's transaction rolls back with it (P7). Every invoice creation contends on the series. That is the business rule (gapless numbering) tying them, so they fail each other where the business says the two cannot both stand (P10, sentence 3 kept). The numbering format is stated once in billing's domain (P2).

### p10-ok-payment-aggregate-holds-refunds.md
```yaml
breaches: []
satisfies: [P10, P17, P18]
situation: payment — Payment, Refund; a disputed charge is not refunded
finding:
```
# Dispute and refund meet on one aggregate
```ts
// systems/payment/service/request-refund.ts — handler of shop's RefundPaymentV1 (payment's command)
return d.tx.run(async (tx) => {
  const claim = await d.handled.claim(tx, cmd.messageId, RefundResult);
  if (!claim.first) return claim.result;
  const payment = await d.payments.load(tx, cmd.paymentId);
  const decision = decideRefund(payment, { refundId: cmd.refundId, amount: cmd.amount });
  await d.payments.save(tx, decision.payment);            // a dispute recorded meanwhile fails this save -> redelivered, decided afresh
  await d.outbox.add(tx, decision.kind === "refused" ? refundRefused(decision.payment, cmd.refundId, decision.reason) : issueStripeRefund(decision.payment, cmd.refundId));
  const result = { kind: decision.kind } as const;
  await d.handled.settle(tx, cmd.messageId, result);
  return result;
});
```
The refund decision reads `disputed` from the aggregate it saves, so a concurrent dispute fails it (P10). The dispute (from Stripe) and the refund request (from shop) are messages from two writers about one payment, and payment's rule decides between them: once a dispute is recorded, a refund is refused (P18, sentence 3). The refusal is committed and reaches shop as `RefundRefusedV1` (P17, sentence 3).

### p11-ok-stock-through-fulfillment-ohs.md
```yaml
breaches: []
satisfies: [P11, P16, P13, P5]
situation: catalog — editors see each product's stock in Payload's admin, read-only; fulfillment owns it
finding:
```
# The admin field asks fulfillment's open host service; Payload keeps no stock
```ts
// systems/fulfillment/adapters/driving/payload/stock-field.tsx — a server component Payload's admin renders (fulfillment's driving adapter)
import type { UIFieldServerComponent } from "payload";
import { fulfillmentQueriesCourier } from "../courier";
export const StockField: UIFieldServerComponent = async ({ data }) => {
  const sku = typeof data?.sku === "string" ? data.sku : undefined;
  if (sku === undefined) return null;
  const level = await fulfillmentQueriesCourier.get().stockLevels.forSku({ sku }); // answering use case, no req passed
  return <output aria-readonly>{level.available} available, {level.reserved} reserved</output>;
};
```
Catalog's configuration reads a record fulfillment owns, and does so through fulfillment's open host service (P11, sentence 1). The field is a `ui` field, so Payload keeps no stock and P11's sentence 2 has nothing to configure. The component is fulfillment's driving adapter, which reads its courier each time it renders (P5). The answer is fulfillment's published language (P13), and no transaction crosses (P16).

### p11-ok-backoffice-replica.md
```yaml
breaches: []
satisfies: [P11, P15, P18, P13, P12]
situation: cross-cutting — an admin dashboard joins orders, invoices and shipments in the one Postgres
finding:
```
# The dashboard joins only backoffice's own replica
```ts
// systems/backoffice/service/order-overview.ts — answering use case
export const createOrderOverview = <Tx>(d: { tx: Transactions<Tx>; rows: OverviewRows<Tx> }): OrderOverview => ({
  page: (q) => d.tx.run((tx) => d.rows.page(tx, q)),          // SELECT from backoffice.order_overview only
});
// systems/backoffice/domain/dashboard-row.ts
export type OverviewRow = { orderId: string; orderStatus: "placed" | "paid" | "cancelled"; shopVersion: number;
  invoiceNumber: string | null; invoiceState: "open" | "paid" | null; billingVersion: number;
  shipmentState: "booked" | "dispatched" | null; fulfillmentVersion: number };
export const applyShopFact = (r: OverviewRow, f: { status: OverviewRow["orderStatus"]; version: number }): OverviewRow =>
  f.version > r.shopVersion ? { ...r, orderStatus: f.status, shopVersion: f.version } : r; // one version per writer (P18)
```
A join across `shop.orders`, `billing.invoices` and `fulfillment.shipments` reads three owners' records past their published languages (P11). Calling three open host services per page view makes the dashboard wait on three systems for answers no business rule needs now (P15). Backoffice is placed as a system with handlers for the three systems' published events, each parsed with its owner's schema and translated (P12, P13). Each column group is kept by its writer's version (P18). The fixture's "join" happens only inside backoffice's own records.

### p12-ok-stripe-acl.md
```yaml
breaches: []
satisfies: [P12, P19, P5, P1]
situation: payment — Stripe behind an anti-corruption layer on the way out
finding:
```
# Stripe's terms stop at payment's adapters
```ts
// systems/payment/conforms.ts
export const conformsTo = [] as const;                      // payment translates Stripe (P12 record)
// systems/payment/domain/payment.ts — no "stripe" import; payment's own words: processorRef, clientSecret, disputed
// systems/payment/adapters/driven/stripe/to-processor-status.ts
import type Stripe from "stripe";
export const toProcessorStatus = (pi: Stripe.PaymentIntent): ProcessorStatus =>
  pi.status === "succeeded" ? { state: "succeeded" } : pi.status === "canceled" ? { state: "canceled" } : { state: "open" };
```
Payment records that it conforms to no upstream, so Stripe's package is reached only by the adapters that carry calls between payment and Stripe (P12, sentence 2): the `CardProcessor` adapter and the webhook hook. Stripe's `PaymentIntent` is named as Stripe's in those modules (P19), the domain is untouched by it (P1), and the port speaks payment's terms (P5).

### p12-ok-3pl-hook.md
```yaml
breaches: []
satisfies: [P12, P9, P18, P8]
situation: fulfillment — 3PL webhooks report shipments in the 3PL's terms
finding:
```
# The 3PL webhook translates, claims and answers after commit
```ts
// systems/fulfillment/adapters/driving/threepl-webhook.ts — served by apps/worker-fulfillment/http.ts
export const threePlWebhook = (deps: { verify: (body: string, sig: string) => ThreePlEvent; shipments: ShipmentEvents }) =>
  async (body: string, signature: string | undefined): Promise<{ status: number; body: string }> => {
    if (signature === undefined) return { status: 400, body: "missing signature" };
    const e = deps.verify(body, signature);                                    // the 3PL's schema, stated once here
    const status = ({ PICKED: "picked", SHIPPED: "dispatched", DELIVERED: "delivered" } as const)[e.status];
    if (status === undefined) return { status: 204, body: "" };
    const r = await deps.shipments.report({ messageId: `3pl:${e.eventId}`, consignmentId: e.consignmentId, status });
    return { status: 200, body: JSON.stringify(r) };
  };
// systems/fulfillment/domain/shipment.ts
const RANK = { booked: 0, picked: 1, dispatched: 2, delivered: 3 } as const;
export const report = (s: Shipment, status: keyof typeof RANK): Shipment => RANK[status] > RANK[s.status] ? { ...s, status } : s; // forward only (P18)
```
The 3PL's terms stop in the webhook (P12). Its event id is claimed by `shipments.report` (P9). Statuses only move forward, so the order of arrival does not matter (P18, external writer). The handler answers after `report` commits (P8). `dispatched` also decrements `Stock.onHand` and publishes `ShipmentDispatchedV1`.

### p13-ok-shop-pl-own-schema.md
```yaml
breaches: []
satisfies: [P13, P14, P2]
situation: shop — publishes OrderPlaced; fulfillment and billing parse it
finding:
```
# The published language is declared apart from the domain, and the service translates
```ts
// systems/shop/domain/messages.ts — translation from the model to the contract
import type { OrderPlacedV1 } from "../offer/published/events";
export const orderPlacedV1 = (o: Order, placedAt: Date): OrderPlacedV1 => ({
  type: "shop.OrderPlaced.v1", orderId: o.id, orderVersion: nextVersion(o), customerId: o.customerId,
  paymentMethod: o.payment.method, total: orderTotal(o.lines), placedAt: placedAt.toISOString(),
  lines: o.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice, taxClass: l.taxClass })),
});
```
`offer/published/events.ts` imports only zod and the kernel, and nothing from `domain/` (P13, sentence 3). It restates `quantity` as positive and lists the tax classes in its own terms (P13's MAY), which is the contract's own statement and no second statement of shop's rule (P2 Why). The domain's message builder imports the contract, so a change to the model that the contract does not follow fails to compile there. Every reader parses with `OrderPlacedV1` (P14, sentence 1).

### p13-ok-payment-events-in-payment-pl.md
```yaml
breaches: []
satisfies: [P13, P12, P19]
situation: saga step 3 — Stripe's webhook reaches payment, which publishes PaymentSucceeded or PaymentFailed
finding:
```
# What crosses is payment's published language, and shop translates it
```ts
// systems/payment/offer/published/events.ts
export const PaymentSucceededV1 = z.object({ type: z.literal("payment.PaymentSucceeded.v1"), paymentId: z.string(), orderId: z.string(), paymentVersion: z.number().int().positive() });
export const PaymentFailedV1 = z.object({ type: z.literal("payment.PaymentFailed.v1"), paymentId: z.string(), orderId: z.string(), paymentVersion: z.number().int().positive(), reason: z.enum(["canceled", "unconfirmedAtDeadline"]) });
// systems/shop/adapters/driving/bus/subscriptions.ts
{ type: "payment.PaymentSucceeded.v1", handle: async (e) => { const p = PaymentSucceededV1.parse(e.body);
  await shop.cardPaymentOutcome.succeeded({ messageId: e.id, paymentRef: p.paymentId, paymentVersion: p.paymentVersion }); } }
```
Payment is upstream (shop handles its events), so what crosses is payment's published language (P13, sentence 2). Neither Stripe's `PaymentIntent` nor its status names appear in it. Shop's handler is the adapter that carries the message and translates `paymentId` to its own `paymentRef` (P12, P19).

### p14-ok-orderplaced-payment-method-required.md
```yaml
breaches: []
satisfies: [P14, P18]
situation: saga step 6 — OrderPlaced says the order is paid by invoice
finding:
```
# The payment method is required from the first version; a later change is a new version
```ts
// systems/shop/offer/published/events.ts (excerpt)
paymentMethod: z.enum(["card", "invoice"]),           // required in v1: no reader ever reads its absence as "card"
// a future third method breaks old readers' enum -> OrderPlacedV2 written beside V1:
// systems/shop/domain/messages.ts (future)
export const placedMessages = (o: Order): ShopOutgoing[] =>
  o.payment.method === "voucher" ? [orderPlacedV2(o)] : [orderPlacedV1(o), orderPlacedV2(o)]; // V1 only where it can still say it truly
```
Because `paymentMethod` is part of v1, billing never has to read "no field" as "card", which is the case P14's Why refuses. A new method added later is an enum value added, which breaks old readers. It ships as a new version written beside the old, with the old version written only for orders it can describe truly (P14, sentence 3).

### p16-ok-call-carries-no-transaction.md
```yaml
breaches: []
satisfies: [P16, P7, P5]
situation: shop — "calls billing's open host service in-process while holding its own ambient transaction"; common library unit of work
finding:
```
# The transaction is an argument; no driving port takes one
```ts
// BREACH as the fixture describes it — packages/common/src/db/unit-of-work.ts (deleted)
// export const uow = new AsyncLocalStorage<DrizzleTx>();   billing's repositories would find shop's tx here
// systems/shop/service/ports.ts — the transaction is visible in every write's signature
export interface Orders<Tx> { insert(tx: Tx, order: Order): Promise<void>; save(tx: Tx, order: Order): Promise<void> /* ... */ }
// systems/payment/offer/published/payment-intents.ts — no Tx, no db, no req in the driving port
export interface PaymentIntents { createPaymentIntent(i: z.input<typeof CreatePaymentIntentInputV1>): Promise<z.infer<typeof CreatePaymentIntentResultV1>> }
```
The ambient unit of work is deleted, so the transaction travels only as an argument (P16, sentence 2). The other system's driving port takes nothing that reaches a store (P16, sentence 4), so even an in-process call made while shop's transaction is open carries none. Shop calls no billing open host service at all: what it needed of billing comes from its replica (N8).

### p16-ok-local-api-without-req.md
```yaml
breaches: []
satisfies: [P16, P11, P15, P17]
situation: catalog — shop reads the product through Payload's Local API; Payload has its own transactions
finding:
```
# Shop's reconciliation reads Payload with no req
```ts
// systems/shop/adapters/driven/payload/product-catalog.ts
import type { Payload } from "payload";
import type { Product as PayloadProduct } from "@teeladen/catalog/payload-types";
export const payloadProductCatalog = (payload: Payload): ProductCatalog => ({
  async all() {
    const r = await payload.find({ collection: "products", pagination: false, depth: 0 }); // no req: Payload's own read, no shared transaction
    return r.docs.map(toProductOffer);
  },
});
const toProductOffer = (p: PayloadProduct): ProductOffer => ({ productId: String(p.id), revision: p.revision ?? 0, slug: p.slug, sku: SkuSchema.parse(p.sku),
  title: p.title, price: money(p.priceCents), taxClass: TaxClass.parse(p.taxClass), published: p._status === "published" });
// systems/shop/service/reconcile-product-offers.ts — nightly; repairs shop's replica only (glossary: Reconciliation)
```
The Local API is called without `req`, so nothing of shop's commit is bound to Payload's (P16). Reading through catalog's API is reading through its open host service (Assumptions, P11). The fixture's Local API read is placed in a nightly reconciliation, not in checkout (T3, T4). The reconciliation keeps the higher revision, so it never overwrites a newer replica row.

### p17-ok-payment-deadline-in-order.md
```yaml
breaches: []
satisfies: [P17, P10, P8, P4]
situation: saga step 5 — on PaymentFailed, or once the deadline passes, shop cancels and publishes OrderCancelled
finding:
```
# The deadline lives on the Order, and a delayed private message wakes it
```ts
// systems/shop/domain/order.ts
export const cancelForPayment = (o: Order, why: "paymentFailed" | "paymentDeadlinePassed", now: Date): { order: Order; messages: ShopOutgoing[] } => {
  if (o.status !== "awaitingPayment" || o.payment.method !== "card") return { order: o, messages: [] };
  if (why === "paymentDeadlinePassed" && now < o.payment.deadline) return { order: o, messages: [] };
  const cancelled: Order = { ...o, status: "cancelled" };
  return { order: cancelled, messages: [orderCancelled(cancelled, why), cancelCardPayment(cancelled)] };
};
// systems/shop/domain/messages.ts — written at checkout, in the checkout transaction
export const paymentDeadlineReached = (o: Order & { payment: { method: "card"; deadline: Date } }): ShopOutgoing =>
  ({ kind: "private", deliverAt: o.payment.deadline, body: { type: "shop.PaymentDeadlineReached.private", orderId: o.id } });
```
The moment shop stops waiting is held in its own aggregate (P17, sentence 2). It is woken by a delayed message committed with the order (P8), so no scheduled scan is needed (avoiding T2 here). A late `PaymentSucceeded` and the deadline meet on one `Order`, and whichever commits first wins by the version check (P10). Cancelling also asks payment to cancel the intent, which undoes the tentative operation shop asked for (P17, sentence 1). Each handler makes one acting call (P4).

### p17-ok-late-payment-refunded.md
```yaml
breaches: []
satisfies: [P17, P18, P9, P13]
situation: saga step 7 — a payment succeeds after shop's deadline cancelled the order; the customer gets the money back
finding:
```
# Shop's rule refunds a payment for a cancelled order, asked of payment
```ts
// systems/shop/domain/late-payment.ts — see The checkout saga
case "cancelled": {
  if (o.refund !== null) return { order: o, messages: [], result: { kind: "refundAlreadyRequested" } };
  const next: Order = { ...o, refund: { refundId, state: "requested" } };
  return { order: next, messages: [refundPayment(next, "orderCancelledBeforePayment")], result: { kind: "refundRequested", refundId } };
}
// systems/payment/offer/published/commands.ts — the command is the receiver's (P13)
export const RefundPaymentV1 = z.object({ type: z.literal("payment.RefundPayment.v1"), paymentId: z.string(), refundId: z.string(), amount: MoneySchema,
  reason: z.enum(["customerReturn", "orderCancelledBeforePayment", "outOfStockAfterPayment"]) });
```
Of the three endings P17 allows, shop's rule chooses undoing, asked of payment, which took the step (P17, sentence 1). Returning silently would end in a half no rule allows, so it is not an option. A second `PaymentSucceeded` (a repeat, or one with a higher version after a failed one) finds `refund` set and changes nothing (P9 by records, P18). The command is declared in payment's published language (P13).

### p17-ok-refund-refused-committed.md
```yaml
breaches: []
satisfies: [P17, P13, P12]
situation: payment — a payment whose charge the customer disputes is not refunded; shop asked
finding:
```
# The refusal is an outcome and reaches shop as an event
```ts
// systems/shop/service/refund-outcome.ts — handler of payment's RefundRefusedV1
export const onRefundRefused = (o: Order, reason: "disputed" | "notCaptured" | "exceedsCaptured" | "declinedByProcessor"): { order: Order; messages: ShopOutgoing[] } =>
  /** Business rule (P17 s1, accepting): a refused refund is recorded; customer service is told and the order ends as cancelled-with-refund-refused. */
  ({ order: { ...o, refund: o.refund && { ...o.refund, state: "refused" } }, messages: [notifyCustomerService(o, reason)] });
```
Payment commits the refusal (`refunds[].state = "refused"`) and publishes `RefundRefusedV1` in its own published language, naming no sender (P17, sentence 3; P13). Shop's rule then ends shop's part by accepting the refusal (P17, sentence 1). A failure, such as a lost race or Stripe being down, is never committed as `refused`: it throws and is redelivered.

### p17-ok-payment-deadline-reconciliation.md
```yaml
breaches: []
satisfies: [P17, P15, P10, P9]
situation: payment — Stripe stops resending a webhook after three days
finding:
```
# Payment ends its own wait at its own deadline
```ts
// systems/payment/service/reconcile-at-deadline.ts — handler of the delayed private ReconcileAtDeadline
return d.tx.run(async (tx) => {
  const claim = await d.handled.claim(tx, msg.id, ReconcileResult);
  if (!claim.first) return claim.result;
  const payment = await d.payments.load(tx, msg.paymentId);
  if (payment.state !== "awaitingConfirmation") { await d.handled.settle(tx, msg.id, { kind: "settled" }); return { kind: "settled" } as const; }
  const answer = await statusOrUnreachable(d.cards, payment.processorRef);  // needed now (T4), beside the tx, no tx carried
  const step = reconcile(payment, answer, d.clock.now());
  await d.payments.save(tx, step.payment);
  for (const m of step.messages) await d.outbox.add(tx, m);                  // PaymentFailedV1 | PaymentSucceededV1 | next ReconcileAtDeadline
  await d.handled.settle(tx, msg.id, step.result);
  return step.result;
});
```
The moment payment stops waiting is on its own aggregate (`confirmBy` + grace). With no answer it decides, after a bounded number of attempts, rather than asking forever (P17, sentence 2). Each retry is a new message with its own id. A webhook arriving after the decision is applied by `applyOutcome`, which lets succeeded follow failed, and shop then refunds (P17, step 7).

### p17-ok-unmatched-transfer.md
```yaml
breaches: []
satisfies: [P17, P2, P9]
situation: billing — some transfers match no invoice: a wrong reference, an amount short
finding:
```
# An unmatched transfer ends by a stated rule
```ts
// systems/billing/service/apply-incoming-transfer.ts (excerpt)
const keepUnmatched = async <Tx>(tx: Tx, d: ApplyTransferDeps<Tx>, u: UnmatchedTransfer): Promise<TransferResult> => {
  await d.unmatched.insert(tx, u);                                              // a clerk's worklist, billing's record
  return { kind: "unmatched", transferId: u.transferId };
};
```
The two cases end by billing's rule in `matchTransfer` (P2). A transfer that matches nothing is accepted as unmatched, for a clerk. A short amount is applied, and the invoice stays open with the rest due, so dunning continues. Neither is a failure that would be retried forever, and neither is dropped (P17, sentence 1). The claim makes the next poll's overlap a no-op (P9).

### p17-ok-invoice-order-settlement-wait.md
```yaml
breaches: []
satisfies: [P17, P2]
situation: saga step 6 — paid by invoice; shop's deadline does not apply; shop waits on InvoicePaid
finding:
```
# Shop's wait for InvoicePaid ends by accepting
```ts
// systems/shop/domain/order.ts
/** Business rule (P17 s2): shop does not chase invoice orders; billing's dunning does. When settlementWaitEnds
 * passes without InvoicePaid, the order is accepted as settledElsewhere; a later InvoicePaid still marks it paid. */
export const endSettlementWait = (o: Order, now: Date): Order =>
  o.payment.method === "invoice" && o.status === "awaitingPayment" && now >= o.payment.settlementWaitEnds ? { ...o, status: "settledElsewhere" } : o;
```
The fixture says the card deadline does not apply to invoice orders, and that holds. P17's sentence 2 still requires shop's wait on billing's `InvoicePaid` to end at a moment held in shop's aggregate, so shop holds one whose ending only accepts (reading S8; purpose-not-told 3). A late `InvoicePaid` still marks the order paid and publishes `OrderPaidV1`.

### p18-ok-cancel-before-placed.md
```yaml
breaches: []
satisfies: [P18, P9, P10]
situation: fulfillment — OrderPaid or OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved
finding:
```
# The early cancel is recorded; the late place reserves nothing
```ts
// systems/fulfillment/test/domain/fulfillment-order.test.ts
it.each([
  ["cancel then place", [cancelled(2), placed(1, "card")], "cancelledUnseen", "nothing"],
  ["place then cancel", [placed(1, "card"), cancelled(2)], "released", "release"],
  ["paid then place", [paid(2, "card"), placed(1, "card")], "readyToShip", "nothing"],
] as const)("should end as written order would leave it: %s", (_name, facts, state, lastTodo) => {
  // given
  const start = unseenOrder("o-1");
  // when
  const end = facts.reduce<{ order: FulfillmentOrder; todo: string }>((acc, f) => learn(acc.order, f), { order: start, todo: "nothing" });
  // then
  expect([end.order.state, end.todo]).toEqual([state, lastTodo]);
});
```
The cancel that arrives first is recorded as `cancelledUnseen` at shop's version 2, so a later `OrderPlaced` v1 is older and reserves nothing (P18, sentence 1). Fulfillment reads "not found" as a state to record, not as "already handled". Shop's order version, raised in the transaction that commits each change, is carried on every order message (P18, sentence 2).

### p18-ok-billing-invoice-trigger.md
```yaml
breaches: []
satisfies: [P18, P9, P10]
situation: billing — creates an invoice on OrderPaid, or on OrderPlaced for an order paid by invoice
finding:
```
# One decision covers both triggers in any order
```ts
// systems/billing/domain/invoice.ts
export const decideInvoicing = (i: { existing: Invoice | undefined; trigger: "placed" | "paid"; paymentMethod: "card" | "invoice" }):
  | { kind: "issue" } | { kind: "skip"; result: { kind: "notYet" | "alreadyInvoiced" } } =>
  i.existing !== undefined ? { kind: "skip", result: { kind: "alreadyInvoiced" } }
  : i.paymentMethod === "invoice" || i.trigger === "paid" ? { kind: "issue" }
  : { kind: "skip", result: { kind: "notYet" } };
```
For a card order the invoice comes from `OrderPaid`, which carries the lines, whichever arrives first. For an invoice order it comes from `OrderPlaced`, and the later `OrderPaid` finds it already invoiced (P18). Two triggers racing for one order fail each other on the unique `orderId` and are redelivered (P10), and the redelivery finds `alreadyInvoiced`. That is billing's business rule (one invoice per order) and not a P9 repeat.

### p18-ok-credit-note-waits-for-invoice.md
```yaml
breaches: []
satisfies: [P18, P17, P9]
situation: billing — issues a credit note for each refund
finding:
```
# A refund before its invoice is recorded; a refund of a never-invoiced order needs no note
```ts
// systems/billing/domain/credit-note.ts
/** Business rule: a refund for an order cancelled before payment was never invoiced and gets no credit note.
 * A refund that arrives before the order's invoice is kept and credited when the invoice is issued. */
export const onRefundIssued = (invoice: Invoice | undefined, r: { refundId: string; amount: Money; reason: RefundReason }):
  | { kind: "none" } | { kind: "pending"; pending: PendingCredit } | { kind: "credit"; invoice: Invoice } =>
  r.reason === "orderCancelledBeforePayment" ? { kind: "none" }
  : invoice === undefined ? { kind: "pending", pending: { refundId: r.refundId, amount: r.amount } }
  : { kind: "credit", invoice: creditOn(invoice, r) };
```
A `RefundIssued` overtaking the `OrderPaid` that would create the invoice is recorded and applied when the invoice is issued, where `issueInvoice` reads the pending credits. That way the records end as the order of writing would leave them (P18, sentence 1). The step-7 refund ends at once by the stated rule (P17, sentence 1). The claim on the message id keeps a repeat from writing a second credit note (P9). Credit notes take their numbers from their own gapless series.

### p18-ok-dunning-stage-version.md
```yaml
breaches: []
satisfies: [P18, P7]
situation: billing — dunning stage rises with each reminder and clears once they pay
finding:
```
# Every stage change carries the account's version, raised in its commit
```ts
// systems/billing/domain/dunning.ts
export const dunningStageChanged = (a: CustomerAccount): BillingOutgoing => ({
  kind: "published", body: { type: "billing.DunningStageChanged.v1", customerId: a.customerId, stage: a.dunningStage, customerVersion: a.version + 1 },
});
```
The reminder (stage up) and the payment (stage cleared) override each other. Billing alone knows the order in which it changed the account, so it carries `customerVersion`, raised by the save that commits the change (P18, sentence 2). Shop keeps the highest (`applyStanding`), and a reminder overtaken by the clearing is dropped. Clearing happens in the transaction that applies the transfer, both aggregates together (P7).

### p19-ok-billing-order-named-apart.md
```yaml
breaches: []
satisfies: [P19, P12]
situation: billing — handles shop's OrderPaid; the word "order"
finding:
```
# Billing has no Order; it names shop's order as shop's
```ts
// systems/billing/domain/invoice.ts
export type Invoice = { id: string; number: string; shopOrderId: string; customerId: string; lines: readonly InvoiceLine[]; state: "open" | "paid"; appliedTransfers: readonly string[]; credits: readonly Credit[]; version: number };
// systems/billing/adapters/driving/bus/order-handlers.ts
const shopOrder = OrderPaidV1.parse(e.body);                // a local named for whose order it is
await billing.invoiceOrder.invoice({ messageId: e.id, shopOrderId: shopOrder.orderId, trigger: "paid", paymentMethod: shopOrder.paymentMethod, lines: shopOrder.lines.map(toInvoiceInput) });
```
Billing's glossary has no "order" term. The word appears only as `shopOrderId` and `shopOrder`, both meaning shop's order (P19, sentence 2). Fulfillment does the same with `FulfillmentOrder` for its own record of an order and `shopVersion` for shop's version. Shop's published `OrderPlaced` keeps shop's meaning wherever it is read.

### p15-ok-fulfillment-down-checkout-up.md
```yaml
breaches: []
satisfies: [P15, P8]
situation: saga step 1 — shop places the order; fulfillment reserves the stock
finding:
```
# Checkout asks fulfillment by an event and does not wait
```ts
// systems/shop/domain/messages.ts
export const placedMessages = (o: Order): ShopOutgoing[] => [
  { kind: "published", deliverAt: null, body: orderPlacedV1(o, new Date(0)) /* placedAt passed by the service */ },
  { kind: "private", deliverAt: null, body: sendOrderConfirmation(o) },
  ...(o.payment.method === "card" ? [paymentDeadlineReached(o)] : []),
];
```
Checkout returns while fulfillment's worker is down. Fulfillment reserves when it is back, because the event is in the outbox and then the bus (P15: "what else it needs another system to do it MUST ask for by a message"; P8). A shortage discovered later is answered by `ReservationRefusedV1` and shop's rule (P17), not by a synchronous check at checkout.

### p8-ok-revalidate-after-catalog-commit.md
```yaml
breaches: []
satisfies: [P8, P9, P5, P4]
situation: cross-cutting — a Payload edit should revalidate the cached shop page
finding:
```
# Revalidation follows catalog's committed message
```ts
// systems/shop/service/revalidate-product-page.ts
export const createRevalidateProductPage = (d: { cache: PageCache }) => ({
  async revalidate(m: { slug: string }): Promise<void> { await d.cache.invalidateProduct(m.slug); },   // writes nothing; repeat accepted (S16)
});
// systems/shop/domain/product-offer.ts
/** Business rule (P9 s3): a product page revalidated twice for one change is accepted. */
export const REVALIDATION_MAY_REPEAT = true as const;
// systems/shop/adapters/driven/next/page-cache.ts
export const nextPageCache = (http: { post(url: string, body: unknown): Promise<void> }, revalidateUrl: string): PageCache => ({
  invalidateProduct: (slug) => http.post(revalidateUrl, { tag: `product:${slug}` }),       // URL: reaching the outside it adapts (P4 s2)
});
```
The page is revalidated only after catalog's change committed, because the message was written in Payload's transaction (P8). Done earlier, the revalidation would cache the old product again. The use case writes nothing, so its repeat is accepted by a stated rule (P9, sentence 3; S16). The revalidation URL is configuration used only to reach the outside the adapter adapts (P4, sentence 2), handed in by assembly (P5).

### p15-ok-checkout-waits-on-payment.md
```yaml
breaches: []
satisfies: [P15, P17]
situation: shop — checkout must return a Stripe client_secret; Stripe may be down
finding:
```
# Card checkout fails visibly while payment's provider is down; invoice checkout does not
```ts
// systems/shop/domain/checkout.ts
/** Business rule (P15 s1): the customer pays by card now, so checkout needs payment's answer before it returns.
 * With payment's provider down, card checkout fails; pay-by-invoice needs no other system's answer. */
export const CARD_NEEDS_PAYMENT_NOW = true as const;
// systems/shop/test/service/checkout.test.ts
it("should place an invoice order while card payments fail", async () => {
  // given
  const shop = shopOnFakes({ payments: failingCardPayments(), standings: [{ customerId: "c-1", inDunning: false, billingVersion: 1 }] });
  await shop.carts.seed(aCart({ customerId: "c-1" }));
  // when
  const r = await shop.checkout.checkout({ cartId: aCartId, customerId: "c-1", method: "invoice" }, {});
  // then
  expect(r.kind).toBe("placed");
});
```
Only card checkout waits on another system, and the wait is stated as a business rule (P15, sentence 1). Invoice checkout reads replicas only, so it runs while payment, billing and Stripe are down. A card checkout that fails before shop's commit leaves no order, and payment's deadline cancels the orphaned intent (P17).

### p7-ok-dunning-per-customer.md
```yaml
breaches: []
satisfies: [P7, P10, P8, P9]
situation: billing — a customer's dunning stage rises with each reminder
finding:
```
# One customer's step: stage, reminder message and event in one transaction
```ts
// systems/billing/domain/dunning.ts
export const REMINDERS_BEFORE_COLLECTION = 3;
export const advance = (a: CustomerAccount, now: Date): AdvanceStep => {
  if (!hasOverdue(a, now)) return { kind: "nothingDue", result: { kind: "nothingDue" } };
  const next: CustomerAccount = { ...a, dunningStage: Math.min(a.dunningStage + 1, REMINDERS_BEFORE_COLLECTION), lastReminderOn: now };
  return { kind: "advanced", account: next, messages: [sendReminder(next), dunningStageChanged(next)], result: { kind: "advanced", stage: next.dunningStage } };
};
```
The stage, the reminder (as a private message) and the published stage change commit together (P7, P8). The step decides on `CustomerAccount` read in its committing transaction, so a payment that clears the account concurrently fails one of the two (P10, sentence 1). The two are tied by the rule "clears once they pay", so that failure is allowed (P10, sentence 3). The run-day message id makes a second run on the same day a repeat (P9).

## Rules whose purpose the text does not tell

1. **P4, sentence 2, configuration "in nothing it writes".** The Why argues from returns: "a driven adapter that turns an instant into a date by the process's `TZ` returns what depends on which process ran it", and the ambient tenant. For writes, its only cases are "the user an audit column records and the locale a mail is rendered in". A per-environment mail `From` or a Stripe `return_url` base is configuration that a driven adapter writes to its outside. The rule forbids it. Yet P4's sentence 1 lets a driving adapter pass the very same configuration value as an argument (it fills the "arguments its driving port takes"), and P5's sentence 3 lets assembly hand it to the adapter's factory. I could not tell what the ban on *writing* it protects, if the same value may enter one hop earlier: whether it is visibility in a signature, testability, or "same response whatever serves it" (a staging adapter writing a staging URL is arguably the point of swapping it). I guessed visibility, and I kept `from` in the factory as ASM-10's same-in-every-process case.
2. **P9, sentence 3, "a business rule of its system MUST accept the change made twice".** For a mail the business has a stake, and the Why gives the second parcel. For a cache revalidation, a metrics push or a `revalidateTag`, the repeat has no business meaning, and the rule still demands a *business* rule, which P2 then places in the domain. I wrote `REVALIDATION_MAY_REPEAT` into shop's domain only to satisfy the letter. The text does not say whether it protects the business's decision (then technical effects should be exempt) or only that someone wrote the acceptance down (then any module would do).
3. **P17, sentence 2, for a wait whose ending changes nothing.** The Why's harms are an order stuck as "payment pending" and stock reserved for nobody. For invoice orders, shop's "waiting" on `InvoicePaid` holds nothing: billing chases payment, and the stock shipped. The rule still requires a moment in shop's aggregate, and the only ending that makes sense there is accepting (`settledElsewhere`). The text does not tell whether P17 means to catch such a wait. If its purpose is "no half found by a customer", this wait has no half; if it is "every wait is bounded", the deadline is required but protects nothing visible.

## Statement and Why disagree

1. **P4: ambient trace context written by a driven adapter.**
   - Statement: "Code behind a driven port MUST use an ambient value or a configuration value only to reach the outside it adapts, and in nothing it writes or returns."
   - Why: "Telemetry is no input: a logger or tracer imported ready-made, a trace context the adapter puts in per request and the outbox adapter carries on the envelope, change neither how the use case acts nor what it answers, so nothing here refuses them."
   - The outbox adapter is code behind a driven port, the trace context is an ambient value, and the envelope row is something it writes. The Statement refuses what the Why allows (T1).
2. **P8: TX-29 as a SHOULD.**
   - Why: "Better still, TX-29: where the external system's transaction can write a message to an outbox, configured so, the message commits with the change ... It is a SHOULD because not every external system's transaction can; deviating, the pending clause holds."
   - Statement: "a change another system tells of before committing it MUST change nothing in this system beyond a record of it as pending until it is confirmed."
   - The Statement has no SHOULD. As written, configuring the external outbox is not asked at all; it is merely one way to have nothing told before commit.
3. **P5: the Why numbers sentences the Statement does not have.**
   - Statement order: (1) "A service MUST reach the outside only as a port ... either also through code of the common library ..."; (2) "Anything outside a system MUST reach into it only through its offer or by a driving adapter's way in."; (3) "A port's implementation, a client of the outside or a configuration value MUST reach code of a system as an argument ... or from a courier".
   - Why: "The three sentences close those three gaps: what code reaches, how it gets hold of it, and what may reach in." It then says "The second clause of the first sentence turns the seam around" (about reach-in, which is the Statement's sentence 2), "The second sentence is 'assembly hands it'" (the Statement's sentence 3), and "The third sentence is the property's exception" (a clause of the Statement's sentence 1).
   - A reader who maps the Why onto the Statement by number reads the courier as the exception and the telemetry clause as reach-in.
4. **P7: is the transaction handed?**
   - Statement: "in one transaction, which its service opens, hands to each call that writes, and commits once after the last write."
   - Why: "Whether the transaction travels as an argument or as an ambient value, and through which port the service opens it, matter for other reasons, P16's and P5's; this rule needs only that every write is carried by it."
   - The Statement's "hands to each call" is an argument; the Why says P7 is indifferent to an ambient transaction. P16 settles the outcome, but the two disagree on what P7 itself requires.

## Readings picked

S1. **P4, sentence 3: "with at most one acting call per call it handles".**
- Reading A: the scheduled task handles one call (the tick), so a loop over polled bank transfers breaks it.
- Reading B: each polled item is a message (P9's Scope: "a driving adapter asked another system for it"), so each is a call handled, as with the bus.
- Taken: B. P7's Why ("a scheduled task polling a bank hands each transfer on as a message of its own") and P9's Why support it.
- What changed: `pollTransfers` loops over `applyTransfer.apply` with no outbox detour. For dunning, where no item is a message from another system, I took A, and that produced T2.

S2. **P10, sentence 2: "A decision on data whose change fails no transaction of this store".**
- Reading A: only data that *cannot* be covered (replicas, another system's answers).
- Reading B: also in-store data the code chooses not to cover, because covering it would fail untied use cases (the Why: "A business rule across aggregates that cannot sit in the aggregates one use case saves is in the same place").
- Taken: B.
- What changed: the dunning and overdue candidate lists rest on stated stale-accepting rules instead of serializable reads.

S3. **P15, sentence 1: "an answer a business rule of its system needs before the use case returns", against the Why's "where one accepts a value that lags, nothing needs the answer now".**
- Reading A: any acceptance of staleness sends the read to a replica.
- Reading B: "lags" means the replica's unbounded lag; accepting a live answer stale for the length of the call is not accepting lag.
- Taken: B.
- What changed: payment's reconciliation may call Stripe (T4). Checkout still uses replicas, by choice.

S4. **P2, Statement "in its domain", and P3, Statement "in the domain of the record's owner", where the owner is external (catalog).**
- Reading A: there is no such domain, so the rule has nowhere to go.
- Reading B: for an external owner, its configuration is where its rules live (glossary: External system).
- Taken: B. The price and sku rules stay in Payload's config, and shop does not restate them.

S5. **Catalog's `beforeChange` that "asks shop".**
- Reading A: it is a hook, shop's driving adapter, so Payload's config imports a shop module that is not on shop's offer. Under P13's sentence 1 ("Code of another system MUST import of a system only its offer") that is a breach whenever catalog's config counts as code of another system.
- Reading B: catalog's config calls shop's open host service as a downstream would, importing only the offer type and taking the instance from a courier assembly fills.
- Taken: B; it complies under both readings of "code of another system".
- What changed: no shop hook exists for Payload. The only driving adapter Payload's admin calls is fulfillment's stock field, which Payload's config names by module path string (the way in, P5 Why), not by import.

S6. **P4, sentence 2: "in nothing it writes or returns".**
- Reading A: writes to the system's records only.
- Reading B: also what it writes to its outside (a mail, a request).
- Taken: B, from the Why's "the locale a mail is rendered in arrive as arguments".
- What changed: the locale and the order URL ride in messages; `from` stays configuration only as ASM-10's same-everywhere case.

S7. **P7, "hands to each call that writes".**
- Reading A: an explicit argument on each write.
- Reading B: repositories bound to the transaction.
- Taken: A, with ports generic over `Tx`, so no service is typed by Drizzle and no cast is needed.

S8. **P17, sentence 2: "Where its part waits on another system".**
- Reading A: shop's invoice order "awaiting payment" waits on billing's `InvoicePaid`.
- Reading B: shop's part ended at `OrderPlaced`, and `InvoicePaid` is news, not an awaited answer.
- Taken: A, because the order's status says it waits.
- What changed: `settlementWaitEnds` and `settledElsewhere`, against the fixture's "shop's deadline does not apply" (purpose-not-told 3).

S9. **P9, sentence 3: "a business rule of its system MUST accept the change made twice" — what that is in code.**
- Taken: a named constant with a doc comment in the domain (`CONFIRMATION_MAY_REPEAT`, `REMINDER_MAY_REPEAT`, `DUPLICATE_CONSIGNMENT_ACCEPTED`, `REVALIDATION_MAY_REPEAT`).
- What changed: nothing at runtime. A rule that changes no behavior is only documentation that P2 places in the domain.

S10. **Catalog's published language** (Assumptions: "its package the published language").
- Reading A: only Payload's generated types.
- Reading B: the generated types plus the message schemas this codebase writes for catalog's outbox.
- Taken: B. `catalog/published/product-changed.ts` is catalog's, and shop and fulfillment parse with it.

S11. **P11, sentence 1: "the owner's published events delivered to a handler of the reading system", where the reader is an external system's configuration (catalog's admin reads stock).**
- Catalog has no handler of this codebase.
- Taken: the open host service branch.
- What changed: the stock field calls fulfillment's answering port; no stock replica in Payload.

S12. **P2, Statement: "Code anywhere else that needs what it decides MUST get it from that statement, directly or through the system".**
- Reading A: "directly" lets another system import the domain function.
- Reading B: "directly" applies inside the system only, and outside it "through the system", as the Why's "Deriving, outside the system, is asking" says.
- Taken: B. P13 forbids A anyway.

S13. **P8, sentence 1: "a request for a tentative operation made beside the transaction".**
- Reading A: during the open transaction.
- Reading B: any time apart from it, before it opens included.
- Taken: B.
- What changed: checkout asks payment before opening its transaction, so no transaction is held over a network call and `paymentRef` commits with the order.

S14. **P5, sentence 1: "an adapter only as such a port or as the outside it adapts", for the scheduled bank poll.**
- Reading A: a scheduled task adapts the clock only, so its bank call needs a port it cannot call (P4: driving adapters reach only driving ports).
- Reading B: it adapts the bank as well, which drives billing by being polled.
- Taken: B, from P15's Why: "a scheduled task that polls a bank ... is a driving adapter that waits".

S15. **P6, sentence 2: "against the outside it reaches in the deployed application, set up as it is there".**
- Reading A: production itself.
- Reading B: the provider's sandbox counts.
- Taken: B, from the Why's "held to the provider's test mode answering the same".
- What changed: the Stripe suites run in test mode. The 3PL suite needs a sandbox the fixture does not mention (N11).

S16. **P9, sentence 1, for a use case that writes nothing (revalidation).**
- Reading A: it must still claim the message id, creating a write only for that.
- Reading B: with no writes there is no transaction to tell a repeat in, so sentence 1 is vacuous and sentence 3 governs.
- Taken: B.
- What changed: `revalidateProductPage` has no claim.

S17. **P18, sentence 2: "Where a later message about one thing overrides an earlier".**
- Reading A: `OrderPlaced`, `OrderPaid` and `OrderCancelled` are transitions, not overrides, so no version is needed.
- Reading B: they all tell of the order's state, so they override.
- Taken: B; shop carries `orderVersion` on each.
- What changed: fulfillment and backoffice order shop's facts by version, and fulfillment's early-message handling falls out of it.

S18. **P14, sentence 1: "one schema ... that its writer and every reader parse with", for Stripe's events.**
- Stripe's package offers TypeScript types, not a runtime parser.
- Taken: Stripe's package types as the one schema, with `constructEvent` as the parse. The external writer is outside the rules (Why: "this rule cannot ask anything of them").

S19. **P12, sentence 2, for shop's browser code using Stripe.js with the `client_secret`.**
- Reading A: shop's browser code is shop's (P13 Why), so shop reaches Stripe's package outside an adapter, which is a breach unless shop records conforming to Stripe.
- Reading B: UI code is not covered (Assumptions: "where UI code goes, which is components.md").
- Taken: B.
- What changed: nothing is placed for the payment form, and the gap is left to `components.md`.

## Notes

N1. **Ids referenced but not defined in the reading set:** SYS-1, SYS-2, SYS-9, SYS-12, SYS-13, SYS-14, SYS-16, TX-1, TX-3, TX-5, TX-6, TX-12, TX-15, TX-20, TX-21, TX-22, TX-23, TX-25, TX-26, TX-27, TX-29, TX-30, TX-31, TX-34, TX-35, TX-36, TX-37, TX-38, TX-40, TX-41, TX-43, TX-44, TX-45, TX-46, DOM-1, DOM-3, DOM-7, DOM-8, DOM-9, ASM-2, ASM-3, ASM-5, ASM-6, ASM-9, SVC-2, SVC-6, SVC-7, SVC-8, DRV-1, DRV-7, DRV-8, TST-8, TST-10, TST-11. The Assumptions use three of them as the *only* definition of what an external system's configuration may touch: "(SYS-12)", "(TX-29)", "(SYS-9)".

N2. **Documents referenced but absent:**
- "general-rules" (P1 Why: "(general-rules, Assumptions)"; P2 Why: "(general-rules Assumptions)"), where this file's own Assumptions are meant.
- "the quarry", "Review 02", `components.md`, "the stack document".
- "The Appendix is for the author" (no Appendix in the file).
- The world's "the general rules are one such set".

N3. **Price ownership.** The fixture's table gives catalog the price. P11's Why opens "Payload keeps shop's price beside catalog's product" and closes "the price in the catalog is catalog's". I followed the fixture and the closing sentence.

N4. **P2's Why, "catalog's veto of a sku change, the rule stays in catalog's domain, and the external system reaches it through its hook, a driving adapter that asks the domain".** In the fixture catalog is external and has no domain in this codebase. Placed per S4 and S5: the rule is in catalog's config, and shop's answering service provides the count.

N5. **P15's Why, "at the payment deadline a reconciliation asks Stripe whether the order was paid".** Shop does not reach Stripe in the fixture, so this is placed in payment, at payment's own deadline.

N6. **Fixture: "afterChange hooks call shop's services".** Read as a situation, not a fact. Placed as catalog's outbox in Payload's transaction (P8, sentence 3). No shop service is called from `afterChange`.

N7. **Fixture: "shop reads the product ... through Payload's Local API".** Read as a situation. Placed in a nightly reconciliation of shop's replica. Checkout reads the replica (T3, T4).

N8. **Fixture: "Calls billing's open host service in-process while holding its own ambient transaction".** The purpose is not stated. The only thing shop needs of billing (the dunning stage) comes from a replica, so no call exists. Read as the breach situation of P16; the ambient unit of work is deleted from the common library.

N9. **Fixture: "fulfillment ... runs in its own worker process".** Read as: fulfillment's handlers and 3PL webhook run there. Its answering port for the stock field is also built in the web process, from the same builder, against the same store. If it means that no fulfillment code loads in web, the stock field must call the worker over HTTP, and P14 then holds that port's schema across processes.

N10. **Fixture: VAT.** Whether catalog prices are gross or net is not stated. Taken as gross, so only billing knows VAT rates. With net prices, shop needs the rate for the total charged, and the rate would have to move to the shared kernel or come to shop through billing's offer (P2, P3).

N11. **Fixture: the 3PL's idempotency and sandbox are not stated.** Taken as no key and lookup-before-create, plus a stated rule for the remaining race (P9, sentence 3). Without a sandbox, P6's sentence 2 suite for the 3PL adapter would book real consignments.

N12. **Fixture: "Request id".** Its use is not stated. Taken as telemetry (OTel baggage). If any use case decides by it, it is an input and P4 puts it in the driving port's arguments.

N13. **Fixture: "/health pings the database".** The glossary's Probe "reports on itself rather than on a system". A database ping reports on the store; taken as the process's own connection, so a probe.

N14. **Fixture: "Payload's own auth supplies `req.user`".** No use case of this codebase needs the editor, so nothing is placed beyond never passing `req` on. If shop's veto answer depended on the editor, the config would pass the editor id as an argument (P4).

N15. **Fixture, step 5: "On `PaymentFailed` ... shop cancels".** Stripe's `payment_intent.payment_failed` is a declined *attempt*, and the customer can retry on the same intent. Placed so that payment publishes `PaymentFailedV1` only on a terminal outcome (canceled, or unconfirmed at the deadline). Otherwise the first declined card cancels the order and step 7 becomes routine.

N16. **Fixture, step 6: "shop's deadline does not apply".** Kept for the card deadline. P17's sentence 2 adds `settlementWaitEnds` (S8).

N17. **Fixture: "Issues a credit note for each refund".** Step 7's refund has no invoice. "Each" read as each refund of an invoiced order, by a stated rule (credit-note ok example).

N18. **Fixture: "A Payload edit should revalidate the cached shop page".** `revalidateTag` works only inside Next's request scope, so the adapter POSTs to a revalidation route of the web app. That route is UI and not covered. This is a mechanism read, not a rule question.

N19. **T3's revision trigger** assumes that Payload's `afterChange` `doc` reflects the trigger-set column, i.e. that Payload re-reads after the update in the same transaction. Unverified; if not, the hook re-reads the row through `req`.

N20. **Glossary "Courier".** Where it lives and who may import it are not said. Taken as one courier per system, in that system's driving-adapter folder, filled by that system's builder. Catalog's courier is filled by web assembly directly, and `probeCourier` lives in the app.

N21. **Payload's `afterRead`** would fire on every Local API read, including shop's reconciliation. A stock lookup there would make shop's reads wait on fulfillment. Hence a `ui` field rendered by the admin only.

N22. **The dashboard.** The rules leave no way to build "joins orders, invoices and shipments in the one Postgres" except a new system with its own replica and the three systems publishing `InvoiceIssued` and `ShipmentDispatched` events that nothing else needed. Not a finding (no two rules pull apart), but it is the largest cost the fixture pays.

N23. **Fixture: "open orders".** Undefined in the fixture. Defined in shop's domain as `awaitingPayment | paid`. Whether a shipped-and-paid order is still "open" for the sku veto is shop's to decide, and it changes catalog's behavior without catalog changing.

N24. **The Conventions say "ids are theirs"** for TST-3, TST-7, TST-12 and ASM-10. Their originals are not in the set, so ASM-10 is read from its one-line text only.

N25. **P5 Statement, "either also through code of the common library".** "Either" refers back to "a service" and "an adapter", but sits after the adapter clause and reads at first as "either of the two ways an adapter reaches". Taken as applying to both.

N26. **Fixture: "gapless invoice numbers".** Whether numbering restarts per year and whether credit notes share the series are not stated. Taken: per-year series, separate series for credit notes.

N27. **Glossary "Message": "An *event* says something happened; no receiver can refuse it."** Fulfillment *can* fail to act on `OrderPlaced` (a shortage) and publishes a refusal. Read as "cannot refuse the fact", while the receiver may still decline what it would do about it.
