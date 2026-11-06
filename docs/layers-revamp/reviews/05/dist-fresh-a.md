# Fresh repository draft A, distilled set (property rules)

Repository `teashop`: a pnpm monorepo, Node 22, TypeScript 5 strict (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`). Next.js 15 hosts Payload CMS 3 and the shop UI. One Postgres 16
instance, Drizzle ORM over `pg`. Stripe, a 3PL warehouse API with webhooks, a bank API, Postmark as
the mail provider. pg-boss on the same Postgres as the bus. zod for every schema. pino and
OpenTelemetry (OTLP to Jaeger). Vitest and testcontainers for tests. ESLint and dependency-cruiser
hold the import rules. Everything below is a decision, numbered in D1 onward.

---

## Systems and what each owns

### Systems of this codebase

| System | Kind | Owns (records whose business rules it holds) | Keeps (where its records lie) |
|---|---|---|---|
| `catalog` | system; upstream of `shop` and `fulfillment`; downstream of Payload (anti-corruption layer) | `Product`: copy, images, slug, price (above zero), sku (unique), tax class (`tea`, `accessories`) | Nothing of `Product`: Payload keeps it, in `payload.products` (external keeper, P11). Its own store: schema `catalog`: `outbox`, `handled_messages` |
| `shop` | system; process manager of the order through payment and fulfillment (orchestration); upstream of `billing`; downstream of `catalog`, `payment`, `fulfillment`, `billing` | `Order` (from the first cart line to the end of its life: cart, placed, paid, cancelled, refund and dispatch state, order lines as snapshots), `Customer` | Schema `shop`: `orders`, `order_lines`, `customers`, replica `catalog_entries` (of catalog's `Product`), replica `credit_standings` (of billing's dunning stage), `outbox`, `handled_messages` |
| `payment` | system; upstream of `shop` (open host service `PaymentIntents`) and `billing`; downstream of Stripe (anti-corruption layer) | `CardPayment` (one per order, wraps one Stripe PaymentIntent; open, succeeded, cancelled, lapsed; disputed flag), `Refund` | Schema `payment`: `card_payments`, `refunds`, `outbox`, `handled_messages` |
| `billing` | system; upstream of `shop` (dunning, invoice settled); downstream of `shop`, `payment`, bank, Postmark | `Invoice` (gapless number per year, lines with VAT rate by tax class, applied transfers), `CreditNote` (gapless number per year, one per refund), `UnmatchedTransfer`, `CustomerDunning` (stage per customer), `BankCursor` | Schema `billing`: `invoices`, `invoice_lines`, `invoice_transfers`, `credit_notes`, `credit_note_lines`, `unmatched_transfers`, `customer_dunnings`, `bank_cursors`, `outbox`, `handled_messages` |
| `fulfillment` | system; upstream of `shop` (dispatch events) and of Payload (stock levels); downstream of `shop`, `catalog`, 3PL | `Fulfillment` (one per order: lines, stock hold, dispatch state, 3PL dispatch id, tracking), `Article` (sku registration in the 3PL article master), `StockCount` | Schema `fulfillment`: `fulfillments`, `fulfillment_lines`, `articles`, `stock_counts`, `outbox`, `handled_messages` |

One Postgres instance holds all schemas. By the glossary it is one store (one transaction could
carry writes to every schema); each system's transactions read and write only its own schema (P16).

### External systems

| External system | Where it runs | What it keeps / does | Reached by |
|---|---|---|---|
| Payload CMS 3 | in our processes: `apps/web` (admin UI, REST) and `apps/worker` (Local API only) | its users (editors), media, its outbox `payload.outbox_messages`; keeps catalog's `Product` records in `payload.products` | driven: Local API from catalog's `PayloadKeptProducts`; driving: its hooks into catalog (`reviewProductBeforeChange`) and fulfillment (`StockLevelField`); its outbox through the outbox reader assembly provides |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | payment's `StripeCardProvider` (API, idempotency keys); payment's Stripe hook |
| 3PL warehouse | vendor | article master, outbound dispatches, physical stock | fulfillment's `HttpWarehouse`; fulfillment's warehouse hook |
| Bank | vendor | account statement | billing's scheduled task `pollBankTransfers` (driving adapter, reaches the bank API itself, P15) |
| Postmark | vendor | sends mail; takes no idempotency key | shop's and billing's `PostmarkMailer` |

Outside that is no bounded context: Next.js (framework, drives shop/payment/fulfillment/billing/catalog
through route files), pg-boss (the bus), Postgres (the store), Jaeger (telemetry sink), the operating
system (clock, random, environment).

### Shared kernel

`@teashop/kernel`: `Money` only (`{ amountMinor: integer, currency: "EUR" }`, `MoneySchema`,
`add`, `times`, `sum`, `netFromGross(gross, rateBasisPoints)` with half-up rounding to the cent,
`isPositive`). Shared by `shop`, `payment`, `billing`, `catalog` domains and their published
languages. It holds no record's schema and no business rule about a record (P3).

### Code that is no system

| Code | What it is |
|---|---|
| `packages/platform` (`@teashop/platform`) | common library: `telemetry` (pino logger with OTel mixin, `tracer`, `withRequestContext`), `courier` (`createCourier<T>()`), `clock` (`systemClock`), `ids` (`uuidV7Ids`), `config` (`parseConfig`), `pg` (pool factory) |
| `packages/messaging` (`@teashop/messaging`) | common library: `Envelope`, `OutboxReader`, `Subscription`, `Schedule`, `Bus`, `PgBossBus`, `startRelay`, `makeEnvelope` |
| `packages/payload-config` | the external system's configuration this codebase writes: collections, access, hook wiring, Payload migrations (incl. the revision trigger) |
| `packages/payload-published` | Payload's published language as this codebase configures it: generated `payload-types.ts`, `ProductNoticeV1` (the message Payload writes to its outbox) |
| `apps/web/src/assembly.ts`, `apps/worker/src/assembly.ts`, `apps/cli/src/assembly.ts` | assembly, one per process |
| `apps/*/src/probes/*`, `apps/web/app/health/route.ts`, `apps/web/app/metrics/route.ts` | probes |
| `apps/web/app/**/layout.tsx`, `apps/web/middleware.ts`, `apps/web/instrumentation.ts` | UI shell, request id, process start; no system |
| `apps/migrate`, `tools/*` | tooling |

---

## Ports and adapters

### Shapes every system repeats (each declares its own copy, in its own terms)

```ts
// packages/<sys>/src/service/ports/transaction.ts
export class ShopTx { readonly #system = "shop" as const; }        // opaque; nothing else is assignable
export interface ShopTransactions {
  /** One transaction; commits once after `work` resolves; rolls back whole if it throws. */
  run<T>(work: (tx: ShopTx) => Promise<T>): Promise<T>;
}

// packages/<sys>/src/service/ports/incoming.ts
export interface Incoming<T> { readonly messageId: string; readonly body: T; }

// packages/<sys>/src/service/ports/message-claims.ts
export interface MessageClaims {
  /** Inserts (consumer, messageId) under a primary key; 'repeat' when the row exists (blocks on an in-flight claim). */
  claim(tx: ShopTx, consumer: string, messageId: string): Promise<"first" | "repeat">;
}

// packages/<sys>/src/service/ports/clock.ts, ids.ts
export interface Clock { now(): Date; }
export interface Ids { next(): string; }          // UUIDv7 in production, sequential in the fake

// packages/<sys>/src/service/ports/errors.ts
export class StaleWrite extends Error {}          // version compared on save failed, or key already taken
```

Every repository method takes the transaction as a required first parameter. Every acting use case
is one `transactions.run(...)`. The Drizzle adapter keeps a `WeakMap<ShopTx, DrizzleTx>` in
`adapters/driven/drizzle/store.ts` (table definitions plus that registry; it implements no port).
The in-memory fake of `ShopTransactions` snapshots the in-memory stores at `run` and restores them
when `work` throws.

Aggregate versions: each domain transition returns the aggregate with `version + 1`; the adapter
inserts when `version === 1` and otherwise updates `WHERE id = $id AND version = $version - 1`;
zero rows, or a unique violation (`23505`), throws `StaleWrite`.

### `catalog`

```ts
// driving ports — packages/catalog/src/service/driving/
export interface ProductReview {                                   // answering; called by Payload's beforeChange hook
  review(draft: ProductDraft): Promise<ReviewVerdict>;
}
export type ReviewVerdict =
  | { ok: true }
  | { ok: false; problems: readonly { field: "price" | "sku" | "slug" | "taxClass" | "title"; problem: string }[] };

export interface CatalogInbound {                                  // acting; handler of Payload's ProductNoticeV1
  publishProductState(m: Incoming<{ productId: ProductId }>): Promise<void>;
}

// driven ports — packages/catalog/src/service/ports/
export interface KeptProducts {                                    // catalog's own records, kept by Payload; read only
  current(productId: ProductId): Promise<Product | null>;          // in catalog's terms; null when deleted
}
export interface CatalogOutbox { write(tx: CatalogTx, event: CatalogEvent): Promise<void>; }
// + CatalogTransactions, MessageClaims, Clock, Ids
```

Domain: `src/domain/product.ts` (`ProductSchema`, `TaxClass = z.enum(["tea","accessories"])`,
`Sku`, `Slug`, `reviewDraft(draft): ReviewVerdict`; price must be positive; sku and slug are the
product's keys, enforced by the store's unique indexes).

Adapters:
- driven: `drizzle/outbox.ts`, `drizzle/message-claims.ts`, `drizzle/transactions.ts`;
  `payload/payload-kept-products.ts` (`new PayloadKeptProducts(payload: Payload)`; Local API
  `findByID({ collection: "products", id, depth: 1, req: undefined })`, translates Payload's
  `Product` and Lexical rich text to `Product` with `descriptionHtml`); fakes in `in-memory/`.
- driving: `payload/product-hooks.ts` (`reviewProductBeforeChange: CollectionBeforeChangeHook`;
  `taxClassOptions` derived from `TaxClass.options`), `handlers/on-payload-product-notice.ts`.
- outbox reader: `outbox-reader.ts` (`createCatalogOutboxReader(db)`).

### `shop`

```ts
// driving ports — packages/shop/src/service/driving/
export interface Storefront {                                      // answering
  listProducts(): Promise<readonly ProductCard[]>;
  productBySlug(slug: string): Promise<ProductPage | null>;
}
export interface Cart {
  addLine(input: { orderId: OrderId | null; sku: Sku; quantity: number }): Promise<CartResult>;   // acting
  setQuantity(input: { orderId: OrderId; sku: Sku; quantity: number }): Promise<CartResult>;     // acting
  view(orderId: OrderId): Promise<CartView | null>;                                               // answering
}
export type CartResult =
  | { ok: true; orderId: OrderId; cart: CartView }
  | { ok: false; refusal: "productUnavailable" | "orderAlreadyPlaced" | "quantityOutOfRange" };

export interface Accounts {
  register(input: { email: Email; name: string; address: Address }): Promise<
    { ok: true; customerId: CustomerId } | { ok: false; refusal: "emailTaken" }>;                // acting
  identify(email: Email): Promise<CustomerId | null>;                                             // answering
}

export interface Checkout {
  paymentOptions(customerId: CustomerId): Promise<readonly PaymentMethod[]>;                      // answering (guard)
  placeOrder(input: {
    orderId: OrderId; customerId: CustomerId; paymentMethod: PaymentMethod;                       // "card" | "invoice"
    shippingAddress: Address; billingAddress: Address;
  }): Promise<PlaceOrderResult>;                                                                  // acting
}
export type PlaceOrderResult =
  | { ok: true; orderId: OrderId; payment: { method: "card"; clientSecret: string } | { method: "invoice" } }
  | { ok: false; refusal: "cartEmpty" | "productUnavailable" | "payByInvoiceNotOffered" | "orderAlreadyPlaced" | "cardPaymentRefused" };

export interface OrderOperations {
  list(filter: OrderListFilter): Promise<readonly OrderSummary[]>;                                // answering
  requestRefund(input: { orderId: OrderId; requestedBy: string }): Promise<
    { ok: true; refundId: RefundId } | { ok: false; refusal: "notPaidByCard" | "refundAlreadyRequested" }>; // acting
}

export interface ShopInbound {                                     // one acting call each; called by handlers / scheduled task
  recordCatalogEntry(m: Incoming<CatalogEntryRevision>): Promise<void>;
  withdrawCatalogEntry(m: Incoming<{ productId: string; version: number }>): Promise<void>;
  recordCreditStanding(m: Incoming<{ customerId: CustomerId; inDunning: boolean; version: number }>): Promise<void>;
  recordCardPaymentSucceeded(m: Incoming<{ orderId: OrderId; paymentRef: string; amount: Money }>): Promise<void>;
  recordCardPaymentCancelled(m: Incoming<{ orderId: OrderId }>): Promise<void>;
  recordCardPaymentCancellationRefused(m: Incoming<{ orderId: OrderId; reason: "alreadySucceeded" }>): Promise<void>;
  recordRefundCompleted(m: Incoming<{ orderId: OrderId; refundId: RefundId }>): Promise<void>;
  recordRefundRefused(m: Incoming<{ orderId: OrderId; refundId: RefundId; reason: RefundRefusal }>): Promise<void>;
  recordDispatchProgress(m: Incoming<{ orderId: OrderId; status: "booked" | "shipped"; trackingNumber: string | null; version: number }>): Promise<void>;
  recordDispatchRefused(m: Incoming<{ orderId: OrderId; reason: string }>): Promise<void>;
  recordReleaseRefused(m: Incoming<{ orderId: OrderId; reason: string }>): Promise<void>;
  recordHoldExpired(m: Incoming<{ orderId: OrderId }>): Promise<void>;
  recordInvoiceSettled(m: Incoming<{ orderId: OrderId; version: number }>): Promise<void>;
  sendOrderConfirmation(m: Incoming<OrderConfirmation>): Promise<void>;                 // private executor
  refreshStorefront(m: Incoming<{ slugs: readonly string[] }>): Promise<void>;          // private executor
  reviewPaymentDeadline(m: Incoming<{ orderId: OrderId }>): Promise<void>;              // private notice
  noticePassedPaymentDeadlines(): Promise<{ notices: number }>;                         // scheduled task
}

// driven ports — packages/shop/src/service/ports/
export interface Orders {                                          // repository over `Order`
  get(tx: ShopTx, id: OrderId): Promise<Order | null>;
  save(tx: ShopTx, order: Order): Promise<void>;                   // throws StaleWrite
  paymentDeadlinesPassed(tx: ShopTx, asOf: Date, limit: number): Promise<readonly OrderId[]>;
}
export interface Customers {                                       // repository over `Customer`
  get(tx: ShopTx, id: CustomerId): Promise<Customer | null>;
  byEmail(tx: ShopTx, email: Email): Promise<Customer | null>;
  save(tx: ShopTx, customer: Customer): Promise<void>;             // unique email key -> StaleWrite
}
export interface CatalogEntries {                                  // repository over replica `CatalogEntry`
  get(tx: ShopTx, productId: string): Promise<CatalogEntry | null>;
  bySkus(tx: ShopTx, skus: readonly Sku[]): Promise<ReadonlyMap<Sku, CatalogEntry>>;
  save(tx: ShopTx, entry: CatalogEntry): Promise<void>;
}
export interface CreditStandings {                                 // repository over replica `CreditStanding`
  get(tx: ShopTx, customerId: CustomerId): Promise<CreditStanding | null>;
  save(tx: ShopTx, standing: CreditStanding): Promise<void>;
}
export interface StorefrontQueries { cards(): Promise<readonly ProductCard[]>; page(slug: string): Promise<ProductPage | null>; }
export interface OrderQueries { list(filter: OrderListFilter): Promise<readonly OrderSummary[]>; cart(orderId: OrderId): Promise<CartView | null>; }
export interface ShopOutbox {                                      // outbox port
  write(tx: ShopTx, message: { kind: "event"; event: ShopEvent } | { kind: "private"; message: ShopPrivateMessage }): Promise<void>;
}
export interface CardPayments {                                    // anti-corruption layer over payment's open host service
  open(request: { orderId: OrderId; amount: Money; customerEmail: Email }): Promise<
    { ok: true; paymentRef: string; clientSecret: string } | { ok: false; refusal: "alreadyPaid" }>; // throws CardPaymentsUnavailable
}
export interface PaymentRequests {                                 // writes payment's commands to shop's outbox
  requestRefund(tx: ShopTx, r: { refundId: RefundId; orderId: OrderId; paymentRef: string; amount: Money }): Promise<void>;
  requestCancellation(tx: ShopTx, r: { orderId: OrderId; paymentRef: string }): Promise<void>;
}
export interface FulfillmentRequests {                             // writes fulfillment's commands to shop's outbox
  requestHold(tx: ShopTx, order: PlacedOrder): Promise<void>;
  requestRelease(tx: ShopTx, orderId: OrderId): Promise<void>;
  requestDispatch(tx: ShopTx, order: PlacedOrder): Promise<void>;
}
export interface Mailer { sendOrderConfirmation(mail: OrderConfirmationMail): Promise<void>; }
export interface StorefrontCache { invalidate(slugs: readonly string[]): Promise<void>; }
// + ShopTransactions, MessageClaims, Clock, Ids
```

Adapters:
- driven, Drizzle (`adapters/driven/drizzle/`): `store.ts`, `transactions.ts`, `orders.ts`,
  `customers.ts`, `catalog-entries.ts`, `credit-standings.ts`, `storefront-queries.ts`,
  `order-queries.ts`, `outbox.ts`, `message-claims.ts`, `payment-requests.ts` (builds
  `payment.RefundCardPayment.v1` / `payment.CancelCardPayment.v1` and inserts into `shop.outbox`),
  `fulfillment-requests.ts` (builds `fulfillment.HoldStock.v1`, `ReleaseStock.v1`,
  `DispatchOrder.v1`).
- driven, other: `payment-ohs/payment-ohs-card-payments.ts` (`new PaymentOhsCardPayments(intents:
  PaymentIntents)`, translates to `OpenCardPaymentV1`), `postmark/postmark-mailer.ts`,
  `next-revalidate/next-revalidate-storefront-cache.ts` (POSTs `{ tags }` to
  `${baseUrl}/api/internal/revalidate`) and its server half `next-revalidate/route.ts` (calls
  `revalidateTag`; the web app's route file re-exports it).
- driven fakes (`adapters/driven/in-memory/`): one per port above, including
  `in-memory-card-payments.ts` (answers from a table, can be told to throw
  `CardPaymentsUnavailable`), `fixed-clock.ts`, `sequential-ids.ts`, `recording-mailer.ts`,
  `recording-storefront-cache.ts`.
- driving (`adapters/driving/`): `next/courier.ts`; `next/pages/*.tsx` (storefront, product page,
  cart, checkout, register: server components reading the shop courier on each render);
  `next/actions/cart.ts`, `next/actions/checkout.ts`, `next/actions/accounts.ts`,
  `next/actions/order-operations.ts` (`"use server"`); `next/ops/orders-slot.tsx`;
  `next/client/checkout-form.tsx` (client component; parses with the domain's `AddressSchema`,
  confirms with `@stripe/stripe-js`); `handlers/*.ts` (one per subscription, below);
  `scheduled/notice-passed-payment-deadlines.ts`.
- outbox reader: `outbox-reader.ts`.

### `payment`

```ts
// open host service (offer) — @teashop/payment/ports
export interface PaymentIntents {
  open(request: OpenCardPaymentV1): Promise<OpenCardPaymentResultV1>;   // acting; throws CardPaymentUnavailableError
}
// @teashop/payment/published
export const OpenCardPaymentV1 = z.object({ orderRef: z.string().min(1), amount: MoneySchema, customerEmail: z.string().email() });
export const OpenCardPaymentResultV1 = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), paymentRef: z.string(), clientSecret: z.string() }),
  z.object({ ok: z.literal(false), refusal: z.literal("alreadyPaid") }),
]);
export class CardPaymentUnavailableError extends Error { readonly code = "cardPaymentUnavailable"; }

// internal driving ports
export interface PaymentInbound {
  recordProviderEvent(m: Incoming<ProviderEvent>): Promise<void>;                        // Stripe hook
  refund(m: Incoming<{ refundId: string; orderRef: string; paymentRef: PaymentId; amount: Money }>): Promise<void>;
  executeRefund(m: Incoming<{ refundId: string }>): Promise<void>;                        // private executor
  cancel(m: Incoming<{ orderRef: string; paymentRef: PaymentId }>): Promise<void>;
  executeCancellation(m: Incoming<{ paymentId: PaymentId }>): Promise<void>;              // private executor
  reviewIntentLapse(m: Incoming<{ paymentId: PaymentId }>): Promise<void>;                // private notice
  noticeLapsedIntents(): Promise<{ notices: number }>;                                     // scheduled task
}
export type ProviderEvent =
  | { kind: "intentSucceeded"; providerIntentId: string; amount: Money }
  | { kind: "intentCancelled"; providerIntentId: string }
  | { kind: "chargeDisputed"; providerIntentId: string }
  | { kind: "refundFailed"; providerRefundId: string };

// driven ports
export interface CardPaymentRecords {                               // repository over `CardPayment`
  get(tx: PaymentTx, id: PaymentId): Promise<CardPayment | null>;
  byOrderRef(tx: PaymentTx, orderRef: string): Promise<CardPayment | null>;   // unique key order_ref
  byProviderIntentId(tx: PaymentTx, providerIntentId: string): Promise<CardPayment | null>;
  lapsedBefore(tx: PaymentTx, asOf: Date, limit: number): Promise<readonly PaymentId[]>;
  save(tx: PaymentTx, payment: CardPayment): Promise<void>;
}
export interface Refunds {                                          // repository over `Refund`
  get(tx: PaymentTx, id: string): Promise<Refund | null>;
  byProviderRefundId(tx: PaymentTx, providerRefundId: string): Promise<Refund | null>;
  save(tx: PaymentTx, refund: Refund): Promise<void>;
}
export interface CardProvider {                                     // payment's terms; Stripe behind it
  createIntent(r: { paymentId: PaymentId; amount: Money; customerEmail: string; idempotencyKey: string }): Promise<{ providerIntentId: string; clientSecret: string }>;
  updateIntentAmount(r: { providerIntentId: string; amount: Money; idempotencyKey: string }): Promise<void>;
  cancelIntent(r: { providerIntentId: string; idempotencyKey: string }): Promise<"cancelled" | "alreadyCancelled" | "alreadySucceeded">;
  refund(r: { providerIntentId: string; amount: Money; refundId: string; idempotencyKey: string }): Promise<
    { outcome: "accepted"; providerRefundId: string } | { outcome: "declined"; reason: "disputed" | "alreadyRefunded" }>;
  findRefund(refundId: string): Promise<{ providerRefundId: string } | null>;   // by metadata.refund_id
}                                                                   // all throw CardProviderUnavailable on network/5xx
export interface PaymentOutbox { write(tx: PaymentTx, message: { kind: "event"; event: PaymentEvent } | { kind: "private"; message: PaymentPrivateMessage }): Promise<void>; }
// + PaymentTransactions, MessageClaims, Clock, Ids
```

Adapters: driven `drizzle/*` (store, transactions, card-payment-records, refunds, outbox,
message-claims), `stripe/stripe-card-provider.ts` (`new StripeCardProvider(stripe: Stripe)`),
fakes in `in-memory/` (incl. `table-card-provider.ts`); offer fake `offer/fakes.ts`
(`FakePaymentIntents implements PaymentIntents`); driving `next/stripe-hook.ts` (route `POST`),
`next/courier.ts`, `handlers/*.ts`, `scheduled/notice-lapsed-intents.ts`; `outbox-reader.ts`.

### `fulfillment`

```ts
// open host service (offer) — @teashop/fulfillment/ports; called by fulfillment's own Payload field hook
export interface StockLevelQueries { levelFor(sku: string): Promise<StockLevelV1 | null>; }   // answering

// internal driving ports
export interface FulfillmentInbound {
  hold(m: Incoming<{ orderRef: string; lines: readonly FulfillmentLine[] }>): Promise<void>;          // HoldStock
  release(m: Incoming<{ orderRef: string }>): Promise<void>;                                           // ReleaseStock
  requestDispatch(m: Incoming<{ orderRef: string; lines: readonly FulfillmentLine[]; recipient: Recipient }>): Promise<void>; // DispatchOrder
  bookDispatch(m: Incoming<{ fulfillmentId: FulfillmentId }>): Promise<void>;                         // private executor
  recordWarehouseReport(m: Incoming<{ fulfillmentId: FulfillmentId; status: "shipped"; trackingNumber: string }>): Promise<void>; // 3PL hook
  syncArticle(m: Incoming<{ sku: string; title: string; version: number }>): Promise<void>;           // catalog's ProductRevised
  registerArticle(m: Incoming<{ sku: string }>): Promise<void>;                                       // private executor
  reviewFulfillmentDeadline(m: Incoming<{ fulfillmentId: FulfillmentId }>): Promise<void>;            // private notice
  noticePassedFulfillmentDeadlines(): Promise<{ notices: number }>;                                    // scheduled task
}
export interface StockCounting { record(input: { sku: string; counted: number; countedBy: string }): Promise<{ ok: true } | { ok: false; refusal: "negativeCount" }>; } // CLI
export interface FulfillmentOperations { list(filter: FulfillmentListFilter): Promise<readonly FulfillmentSummary[]>; }

// driven ports
export interface Fulfillments {
  get(tx: FulfillmentTx, id: FulfillmentId): Promise<Fulfillment | null>;
  byOrderRef(tx: FulfillmentTx, orderRef: string): Promise<Fulfillment | null>;   // unique key order_ref
  deadlinesPassed(tx: FulfillmentTx, asOf: Date, limit: number): Promise<readonly FulfillmentId[]>;
  save(tx: FulfillmentTx, f: Fulfillment): Promise<void>;
}
export interface Articles { get(tx: FulfillmentTx, sku: string): Promise<Article | null>; registeredAmong(tx: FulfillmentTx, skus: readonly string[]): Promise<ReadonlySet<string>>; save(tx: FulfillmentTx, a: Article): Promise<void>; }
export interface StockCounts { get(tx: FulfillmentTx, sku: string): Promise<StockCount | null>; save(tx: FulfillmentTx, c: StockCount): Promise<void>; }
export interface StockLevelReadModel { levelFor(sku: string): Promise<StockLevel | null>; }   // counted − shipped since count − held
export interface FulfillmentQueries { list(filter: FulfillmentListFilter): Promise<readonly FulfillmentSummary[]>; }
export interface Warehouse {                                        // fulfillment's terms; 3PL behind it
  upsertArticle(a: { sku: string; title: string }): Promise<void>;                        // PUT by sku
  createDispatch(d: { fulfillmentId: FulfillmentId; lines: readonly FulfillmentLine[]; recipient: Recipient }): Promise<
    { outcome: "accepted"; warehouseDispatchId: string } | { outcome: "rejected"; reason: string }>; // 409 on duplicate externalReference -> findDispatch
  findDispatch(fulfillmentId: FulfillmentId): Promise<{ warehouseDispatchId: string } | null>;
}                                                                   // throws WarehouseUnavailable
export interface FulfillmentOutbox { write(tx: FulfillmentTx, message: { kind: "event"; event: FulfillmentEvent } | { kind: "private"; message: FulfillmentPrivateMessage }): Promise<void>; }
// + FulfillmentTransactions, MessageClaims, Clock, Ids
```

Adapters: driven `drizzle/*`, `warehouse/http-warehouse.ts` (`new HttpWarehouse({ baseUrl, apiKey,
fetch })`), fakes in `in-memory/`; offer fake `offer/fakes.ts` (`FakeStockLevelQueries`); driving
`next/warehouse-hook.ts` (route `POST`, HMAC-SHA256 check with `node:crypto`),
`payload/stock-level-field.tsx` (Payload UI field server component), `next/ops/shipments-slot.tsx`,
`next/courier.ts`, `handlers/*.ts`, `scheduled/notice-passed-fulfillment-deadlines.ts`,
`cli/stock-count.ts`; `outbox-reader.ts`.

### `billing`

```ts
// internal driving ports
export interface BillingInbound {
  invoiceOrder(m: Incoming<InvoiceableOrder>): Promise<void>;           // shop OrderPlaced(invoice) / OrderPaid(card)
  creditRefund(m: Incoming<{ refundRef: string; orderRef: string; amount: Money }>): Promise<void>;   // payment RefundCompleted
  applyTransfer(m: Incoming<BankTransfer>): Promise<void>;              // private, one per bank item
  applyAssignedTransfer(m: Incoming<{ transferId: string }>): Promise<void>;   // private
  reviewDunning(m: Incoming<{ customerRef: string }>): Promise<void>;   // private notice
  sendReminder(m: Incoming<ReminderRequest>): Promise<void>;            // private executor
  noticeDunningDue(): Promise<{ notices: number }>;                     // scheduled task
}
export type InvoiceableOrder = {
  orderRef: string; customerRef: string; customerEmail: string; billingAddress: BillingAddress;
  terms: "prepaid" | "onAccount"; lines: readonly { sku: string; title: string; unitGross: Money; quantity: number; taxClass: "tea" | "accessories" }[];
};
export interface BankStatements {
  cursor(): Promise<string | null>;                                     // answering
  record(input: { expectedCursor: string | null; nextCursor: string; transfers: readonly BankTransfer[] }): Promise<
    { ok: true; recorded: number } | { ok: false; refusal: "cursorMoved" }>;   // acting: saves BankCursor, writes one message per transfer
}
export interface BillingOperations {
  invoices(filter: InvoiceListFilter): Promise<readonly InvoiceSummary[]>;       // answering
  unmatchedTransfers(): Promise<readonly UnmatchedTransferSummary[]>;             // answering
  assignTransfer(input: { transferId: string; invoiceNumber: string; assignedBy: string }): Promise<
    { ok: true } | { ok: false; refusal: "invoiceNotFound" | "alreadyAssigned" }>;  // acting
}

// driven ports
export interface Invoices {
  get(tx: BillingTx, id: InvoiceId): Promise<Invoice | null>;
  byOrderRef(tx: BillingTx, orderRef: string): Promise<Invoice | null>;          // unique key order_ref
  byNumber(tx: BillingTx, number: InvoiceNumber): Promise<Invoice | null>;
  lastNumber(tx: BillingTx, year: number): Promise<number>;                      // 0 when none
  openForCustomer(tx: BillingTx, customerRef: string): Promise<readonly Invoice[]>;
  customersWithOverdue(tx: BillingTx, asOfDate: LocalDate): Promise<readonly string[]>;
  save(tx: BillingTx, invoice: Invoice): Promise<void>;                          // unique (year, seq) -> StaleWrite
}
export interface CreditNotes { lastNumber(tx: BillingTx, year: number): Promise<number>; byRefundRef(tx: BillingTx, refundRef: string): Promise<CreditNote | null>; save(tx: BillingTx, note: CreditNote): Promise<void>; }
export interface UnmatchedTransfers { get(tx: BillingTx, transferId: string): Promise<UnmatchedTransfer | null>; save(tx: BillingTx, t: UnmatchedTransfer): Promise<void>; }
export interface CustomerDunnings { get(tx: BillingTx, customerRef: string): Promise<CustomerDunning | null>; save(tx: BillingTx, d: CustomerDunning): Promise<void>; }
export interface BankCursors { get(tx: BillingTx): Promise<BankCursor | null>; save(tx: BillingTx, c: BankCursor): Promise<void>; }
export interface BillingQueries { invoices(filter: InvoiceListFilter): Promise<readonly InvoiceSummary[]>; unmatched(): Promise<readonly UnmatchedTransferSummary[]>; cursor(): Promise<string | null>; }
export interface DunningMailer { sendReminder(mail: ReminderMail): Promise<void>; }
export interface BillingOutbox { write(tx: BillingTx, message: { kind: "event"; event: BillingEvent } | { kind: "private"; message: BillingPrivateMessage }): Promise<void>; }
// + BillingTransactions, MessageClaims, Clock, Ids
```

Adapters: driven `drizzle/*`, `postmark/postmark-dunning-mailer.ts`, fakes in `in-memory/`;
driving `scheduled/poll-bank-transfers.ts` (`pollBankTransfers({ statements, bank: BankApiClient })`;
the bank client is the outside this driving adapter adapts), `scheduled/notice-dunning-due.ts`,
`handlers/*.ts`, `next/ops/invoices-slot.tsx`, `next/actions/assign-transfer.ts`,
`next/courier.ts`, `cli/assign-transfer.ts`; `outbox-reader.ts`.

### Assembly side (no system)

```ts
// @teashop/messaging
export interface Envelope { readonly id: string; readonly type: string; readonly writer: string; readonly writtenAt: string; readonly body: unknown; readonly trace: Readonly<Record<string, string>>; }
export interface OutboxReader { readonly name: string; relayBatch(publish: (e: Envelope) => Promise<void>, limit: number): Promise<number>; }
export interface Subscription { readonly queue: string; readonly messageType: string; readonly subscriber: string; handle(e: Envelope): Promise<void>; }
export interface Schedule { readonly name: string; readonly cron: string; readonly tz: "Europe/Berlin"; run(): Promise<void>; }
export interface Bus { publish(e: Envelope): Promise<void>; subscribe(s: Subscription): Promise<void>; schedule(s: Schedule): Promise<void>; }
export function startRelay(input: { readers: readonly OutboxReader[]; bus: Bus; intervalMs: number; signal: AbortSignal }): Promise<void>;

// @teashop/platform/courier
export interface Courier<T> { fill(value: T): void; read(): T; }       // read() throws when unfilled
export function createCourier<T>(name: string): Courier<T>;

// system builders, e.g. @teashop/shop/builder
export interface ProcessResources { readonly pool: Pool; readonly clock: { now(): Date }; readonly ids: { next(): string }; }
export function buildShopForWeb(config: ShopConfig, process: ProcessResources, upstream: { paymentIntents: PaymentIntents }): void; // fills the shop courier
export function buildShopForWorker(config: ShopConfig, process: ProcessResources, upstream: { paymentIntents: PaymentIntents }): {
  subscriptions: readonly Subscription[]; schedules: readonly Schedule[]; outboxReader: OutboxReader };
export function buildShopForCli(config: ShopConfig, process: ProcessResources, upstream: { paymentIntents: PaymentIntents }): { commands: readonly CliCommand[] };
// @teashop/payment/builder additionally: buildPaymentIntents(config, process): PaymentIntents
```

---

## Calls and messages

### Synchronous calls between systems

| Caller | Callee | Port | When | Transaction | Refusal / failure back |
|---|---|---|---|---|---|
| `shop` (`placeOrder`, card) via `PaymentOhsCardPayments` | `payment` | `PaymentIntents.open` (in-process) | while shop's transaction is open, before its writes | none crosses; payment opens its own | refusal: `{ ok: false, refusal: "alreadyPaid" }` → shop answers `cardPaymentRefused`; failure: `CardPaymentUnavailableError` → `CardPaymentsUnavailable` → shop's transaction rolls back, server action answers "payment unavailable, try again" |
| `payment` (`open`, `executeRefund`, `executeCancellation`) | Stripe | REST via `stripe` SDK, idempotency keys | `open`: driving-port call; others: message-called | none | Stripe 4xx decline → `declined` result committed as refusal; network/5xx → `CardProviderUnavailable` thrown → failure |
| Payload (beforeChange on `products`) | `catalog` | `ProductReview.review` via catalog's hook | before Payload commits | Payload's `req` is not passed | refusal: hook throws Payload `ValidationError` with field paths → the editor sees it, Payload rolls back |
| Payload (admin field render) | `fulfillment` | `StockLevelQueries.levelFor` via fulfillment's hook | render of the product edit view | none | `null` renders "no count yet"; a throw renders Payload's field error |
| `catalog` (`publishProductState`) | Payload | Local API `findByID` | message-called | none (`req` omitted) | `NotFound` → product withdrawn; other throw → failure, redelivered |
| `fulfillment` (`bookDispatch`, `registerArticle`) | 3PL | REST | message-called | none | `422` → `rejected` committed as refusal; `409` → `findDispatch`; network/5xx → failure |
| `billing` (`pollBankTransfers`) | bank | REST, cursor | scheduled task | none | bank down: the poll throws, pg-boss runs the next tick |
| `shop` (`sendOrderConfirmation`), `billing` (`sendReminder`) | Postmark | REST | message-called | claim open, send, commit | 4xx/5xx → failure, redelivered (repeat accepted, P9) |
| `shop` (`refreshStorefront`) | web process's Next cache | HTTP POST `/api/internal/revalidate` | message-called | none | non-2xx → failure, redelivered |
| Stripe | `payment` | hook `POST /api/hooks/stripe` | after Stripe's commit | none | `400` on bad signature; `200` after the use case committed; `500` on failure (Stripe resends) |
| 3PL | `fulfillment` | hook `POST /api/hooks/warehouse` | after the 3PL's commit | none | same as Stripe |

No other system of this codebase calls another synchronously.

### Messages

All go through the writer's outbox, the relay, and pg-boss. Queue per handler, named
`<subscriber>.<handler>`; pg-boss fans a published type out to every queue subscribed to it;
`retryLimit: 10`, `retryDelay: 5`, `retryBackoff: true`, then `deadLetter: "<queue>.dlq"`. A
handler acknowledges by resolving after its use case returned; it never catches the use case's error.

| Type | Kind | Writer | Subscribers (handler → driving port) | Refusal back |
|---|---|---|---|---|
| `payload.ProductNotice.v1` `{ productId, operation }` | event (notice) | Payload, in its transaction (afterChange/afterDelete hook writes `outbox-messages` with `req`) | catalog `onPayloadProductNotice` → `publishProductState` | none (event) |
| `catalog.ProductRevised.v1` `{ productId, version, slug, title, descriptionHtml, imageUrls, price, sku, taxClass }` | published event | catalog | shop `onProductRevised` → `recordCatalogEntry`; fulfillment `onProductRevised` → `syncArticle` | none |
| `catalog.ProductWithdrawn.v1` `{ productId, version }` | published event | catalog | shop `onProductWithdrawn` → `withdrawCatalogEntry` | none |
| `shop.OrderPlaced.v1` `{ orderId, version, customerId, customerEmail, billingAddress, shippingAddress, lines[{ sku, title, unitGross, taxClass, quantity }], total, paymentMethod, placedAt }` | published event | shop | billing `onOrderPlaced` → `invoiceOrder` (only `paymentMethod: "invoice"`; card orders the handler acknowledges without a call, untranslatable as invoiceable) | none |
| `shop.OrderPaid.v1` `{ ...OrderPlaced fields, paidAt }` | published event | shop | billing `onOrderPaid` → `invoiceOrder` (`terms: "prepaid"`) | none |
| `shop.OrderCancelled.v1` `{ orderId, version, reason }` | published event | shop | none today (dashboard is shop's own) | none |
| `fulfillment.HoldStock.v1` `{ orderRef, lines[{ sku, quantity }] }` | command, fulfillment's published language | shop | fulfillment `onHoldStock` → `hold` | never refused (holds beyond stock are backorders, D6) |
| `fulfillment.ReleaseStock.v1` `{ orderRef }` | command | shop | fulfillment `onReleaseStock` → `release` | `fulfillment.ReleaseRefused.v1` `{ orderRef, reason: "dispatchInProgress" \| "shipped" }` → shop `recordReleaseRefused` |
| `fulfillment.DispatchOrder.v1` `{ orderRef, lines, recipient }` | command | shop | fulfillment `onDispatchOrder` → `requestDispatch` | `fulfillment.DispatchRefused.v1` `{ orderRef, reason }` (released hold, or 3PL `422`) → shop `recordDispatchRefused` |
| `fulfillment.DispatchBooked.v1`, `fulfillment.DispatchShipped.v1` `{ orderRef, version, trackingNumber? }` | published events | fulfillment | shop `onDispatchProgress` → `recordDispatchProgress` | none |
| `fulfillment.HoldExpired.v1` `{ orderRef }` | published event | fulfillment | shop `onHoldExpired` → `recordHoldExpired` | none |
| `payment.RefundCardPayment.v1` `{ refundId, orderRef, paymentRef, amount }` | command, payment's published language | shop | payment `onRefundCardPayment` → `refund` | `payment.RefundRefused.v1` `{ refundId, orderRef, reason: "disputed" \| "alreadyRefunded" \| "notSucceeded" }` → shop `recordRefundRefused` |
| `payment.CancelCardPayment.v1` `{ orderRef, paymentRef }` | command | shop | payment `onCancelCardPayment` → `cancel` | `payment.CardPaymentCancellationRefused.v1` `{ orderRef, reason: "alreadySucceeded" }` → shop |
| `payment.CardPaymentSucceeded.v1` `{ paymentRef, orderRef, amount, version }` | published event | payment | shop `onCardPaymentSucceeded` → `recordCardPaymentSucceeded` | none |
| `payment.CardPaymentCancelled.v1` `{ paymentRef, orderRef, version }` | published event | payment | shop → `recordCardPaymentCancelled` | none |
| `payment.RefundCompleted.v1` `{ refundId, orderRef, amount }` | published event | payment | shop → `recordRefundCompleted`; billing `onRefundCompleted` → `creditRefund` | none |
| `payment.RefundFailedAfterAcceptance.v1` `{ refundId, orderRef }` | published event | payment | shop → order flagged for operations | none |
| `billing.DunningStageChanged.v1` `{ customerRef, stage: 0..3, inDunning, version }` | published event | billing | shop `onDunningStageChanged` → `recordCreditStanding` | none |
| `billing.InvoiceSettled.v1` `{ orderRef, invoiceNumber, version }` | published event | billing | shop `onInvoiceSettled` → `recordInvoiceSettled` | none |
| `shop.private.SendOrderConfirmation.v1`, `shop.private.RefreshStorefront.v1`, `shop.private.PaymentDeadlineReached.v1` | private | shop | shop only | none |
| `payment.private.ExecuteRefund.v1`, `payment.private.ExecuteCancellation.v1`, `payment.private.IntentLapseReached.v1` | private | payment | payment only | none |
| `fulfillment.private.BookDispatch.v1`, `fulfillment.private.RegisterArticle.v1`, `fulfillment.private.FulfillmentDeadlineReached.v1` | private | fulfillment | fulfillment only | none |
| `billing.private.ApplyTransfer.v1` (id = `bank:<transferId>`), `billing.private.ApplyAssignedTransfer.v1`, `billing.private.DunningReviewDue.v1`, `billing.private.SendReminder.v1`, `billing.private.InvoiceSettledForDunning.v1` | private | billing | billing only | none |

`PgBossBus.subscribe` throws at assembly when a subscription's type starts with `<x>.private.` and
its subscriber is not `<x>`.

### The main flows

- Card checkout: `placeOrder` opens shop's transaction, loads the `Order` (cart), `CatalogEntry`s,
  `Customer`; domain snapshots lines; calls `CardPayments.open` (payment opens or reuses the
  `CardPayment` for `orderRef`, Stripe key `open:<orderRef>`); domain places the order with
  `paymentDueAt = placedAt + 30 min`; saves; writes `OrderPlaced`, `HoldStock`,
  `SendOrderConfirmation`; commits; returns `clientSecret`. Browser confirms with Stripe.
  Stripe → payment hook → `CardPaymentSucceeded` → shop `recordCardPaymentSucceeded` → order paid,
  `OrderPaid`, `DispatchOrder` → fulfillment books the 3PL → `DispatchBooked` / `DispatchShipped`.
  Billing issues the prepaid invoice from `OrderPaid`.
- Invoice checkout: domain checks `CreditStanding` (replica); places with `paymentMethod:
  "invoice"`; writes `OrderPlaced`, `HoldStock`, `DispatchOrder`, `SendOrderConfirmation`. Billing
  issues an on-account invoice, due in 14 days, from `OrderPlaced`. Bank transfer → poll →
  `ApplyTransfer` → invoice settled → `InvoiceSettled` → shop marks paid.
- Deadline: every minute `noticePassedPaymentDeadlines` writes `PaymentDeadlineReached{orderId}`
  per overdue order; `reviewPaymentDeadline` decides by the `Order`: still awaiting card payment
  and `paymentDueAt <= now` → cancelled, `OrderCancelled`, `ReleaseStock`, `CancelCardPayment`;
  otherwise nothing.
- Late payment: `CardPaymentSucceeded` on a cancelled order → shop's rule `onLatePayment` →
  refund requested (`RefundCardPayment`), order stays cancelled.
- Refund: operator in `/ops` → `requestRefund` → `RefundCardPayment` → payment `refund` decides
  (`refundable`: succeeded, not disputed, not refunded) → refusal committed and published, or
  `Refund` accepted plus `ExecuteRefund` → executor calls Stripe (key `refund:<refundId>`, checks
  `findRefund` first) → `RefundCompleted` → shop and billing (credit note).
- Product change: editor saves → catalog veto → Payload commits product and notice → relay →
  catalog fetches current state → `ProductRevised` → shop replica + `RefreshStorefront` →
  revalidation; fulfillment `Article` + `RegisterArticle` → 3PL article upsert.

---

## Processes

| Deployable | Entry point | Runs | Assembly |
|---|---|---|---|
| `teashop-web` (Docker image, `next start`, one replica) | `apps/web/instrumentation.ts` `register()` (Node runtime only): imports `src/otel.ts` (NodeSDK, OTLP exporter, `AsyncLocalStorageContextManager`, http/undici/pg instrumentations), then `src/assembly.ts` `assembleWeb(loadWebConfig(process.env))` | shop pages and server actions, Payload admin `/admin` and Payload REST `/api/payload/*`, `/ops` dashboard, hooks `/api/hooks/stripe` and `/api/hooks/warehouse`, `/api/internal/revalidate`, `/health`, `/metrics` | builds one `pg.Pool`; `buildPaymentIntents`; `buildCatalogForWeb`, `buildShopForWeb`, `buildPaymentForWeb`, `buildBillingForWeb`, `buildFulfillmentForWeb` (each fills its system's courier); fills `probeCourier` with `{ pool }`. No relay, no handlers, no schedules |
| `teashop-worker` (`node --import ./dist/otel.js dist/main.js`, two replicas) | `apps/worker/src/main.ts` | relay, all handlers, all scheduled tasks, probe server on `:9464` (`/health`, `/metrics`) | `pg.Pool`; `getPayload({ config })` (Local API, for catalog's `PayloadKeptProducts`); `buildPaymentIntents`; every `build<Sys>ForWorker`; `createPayloadOutboxReader(pool)` (assembly provides the external system's outbox reader); `new PgBossBus(new PgBoss({ db: poolAdapter(pool), schema: "pgboss" }))`; subscribes every returned subscription, schedules every returned schedule, `startRelay({ readers: [catalog, shop, payment, billing, fulfillment, payload], bus, intervalMs: 500 })` |
| `teashop` CLI (bin in the worker image) | `apps/cli/src/main.ts` (commander) | `teashop fulfillment stock-count <sku> <n> --by <name>`, `teashop billing assign-transfer <transferId> <invoiceNumber> --by <name>` | `pg.Pool`; `build<Sys>ForCli` for fulfillment and billing; commands are driving adapters handed their driving port |
| `teashop-migrate` (job before every deploy; tooling) | `apps/migrate/src/main.ts` | `payload migrate` (Payload's schema, incl. `products_raise_revision` trigger and `outbox_messages`), then each system's Drizzle migrations from `packages/<sys>/migrations` with `migrationsSchema: "<sys>"` in order catalog, shop, payment, billing, fulfillment, then `PgBoss` schema migration | none (tooling) |

Scheduled tasks (pg-boss `schedule`, `tz: "Europe/Berlin"`): `shop.notice-passed-payment-deadlines`
`* * * * *`; `payment.notice-lapsed-intents` `0 * * * *`; `fulfillment.notice-passed-fulfillment-deadlines`
`*/15 * * * *`; `billing.poll-bank-transfers` `*/5 * * * *`; `billing.notice-dunning-due` `0 6 * * *`.
pg-boss runs each once across worker replicas.

Configuration: each app's `src/config.ts` is a zod schema parsed once by `parseConfig` in the
entry point (`DATABASE_URL`, `DB_POOL_MAX`, `PAYLOAD_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `WAREHOUSE_BASE_URL`, `WAREHOUSE_API_KEY`, `WAREHOUSE_WEBHOOK_SECRET`,
`BANK_BASE_URL`, `BANK_TOKEN`, `POSTMARK_SERVER_TOKEN`, `STOREFRONT_REVALIDATE_URL`,
`REVALIDATE_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`). No configuration value decides a business rule.

Deploy order: `teashop-migrate` (expand only), worker rolling, web. Contract migrations ship one
release later (P14).

Telemetry: `apps/web/middleware.ts` sets `x-request-id` when absent; every driving adapter in Next
wraps its body in `withRequestContext(headers, fn)`, which puts `request.id` into OTel baggage;
pino's mixin adds `trace_id`, `span_id`, `request_id` from the active context; outbox adapters copy
`propagation.inject` output into `Envelope.trace`; `PgBossBus` runs each handler inside
`propagation.extract(envelope.trace)`; undici instrumentation carries `traceparent` and `baggage`
on outgoing HTTP.

---

## Directory tree

```
teashop/
├── package.json                      # scripts: typecheck, lint, test, test:integration, test:e2e, check:published
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs                 # no-restricted-imports, no-restricted-syntax (namespace imports, vi.mock of domain)
├── .dependency-cruiser.cjs           # layer and reach rules (P1, P5, P12, P13, P16)
├── vitest.workspace.ts
├── docker-compose.yml                # postgres:16, jaeger
├── squawk.toml                       # migration linter: no drop/rename/not-null-without-default
├── .github/workflows/ci.yml          # typecheck, lint, depcruise, default suite, integration suite, check:published, squawk
├── tools/
│   ├── check-published-compat.ts     # compares published schemas to snapshots
│   └── published-snapshots/          # one JSON schema per published message and OHS type
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts            # withPayload
│   │   ├── instrumentation.ts
│   │   ├── middleware.ts
│   │   ├── src/
│   │   │   ├── assembly.ts
│   │   │   ├── config.ts
│   │   │   ├── otel.ts
│   │   │   └── probes/
│   │   │       ├── courier.ts
│   │   │       ├── health.ts
│   │   │       └── metrics.ts
│   │   └── app/
│   │       ├── (shop)/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx                          # export { default, generateMetadata } from "@teashop/shop/driving/next/pages/storefront"
│   │       │   ├── products/[slug]/page.tsx
│   │       │   ├── cart/page.tsx
│   │       │   ├── checkout/page.tsx
│   │       │   ├── orders/[orderId]/page.tsx
│   │       │   └── account/register/page.tsx
│   │       ├── (payload)/
│   │       │   ├── admin/[[...segments]]/page.tsx    # Payload generated
│   │       │   ├── admin/importMap.js                # Payload generated
│   │       │   ├── api/payload/[...slug]/route.ts    # Payload generated
│   │       │   └── layout.tsx                        # Payload generated
│   │       ├── ops/
│   │       │   ├── layout.tsx                        # renders {orders}{invoices}{shipments}; imports no system
│   │       │   ├── page.tsx
│   │       │   ├── @orders/page.tsx                  # re-export from @teashop/shop/driving/next/ops
│   │       │   ├── @invoices/page.tsx                # re-export from @teashop/billing/driving/next/ops
│   │       │   └── @shipments/page.tsx               # re-export from @teashop/fulfillment/driving/next/ops
│   │       ├── api/
│   │       │   ├── hooks/stripe/route.ts             # export { POST } from "@teashop/payment/driving/next/stripe-hook"
│   │       │   ├── hooks/warehouse/route.ts          # export { POST } from "@teashop/fulfillment/driving/next/warehouse-hook"
│   │       │   └── internal/revalidate/route.ts      # export { POST } from "@teashop/shop/driven/next-revalidate"
│   │       ├── health/route.ts
│   │       └── metrics/route.ts
│   ├── worker/
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── assembly.ts
│   │       ├── config.ts
│   │       ├── otel.ts
│   │       ├── payload-outbox-reader.ts
│   │       └── probes/server.ts
│   ├── cli/
│   │   ├── package.json
│   │   └── src/{main.ts,assembly.ts,config.ts}
│   └── migrate/
│       ├── package.json
│       └── src/main.ts
└── packages/
    ├── kernel/
    │   ├── package.json              # "@teashop/kernel"
    │   ├── tsconfig.json             # lib ES2023, types []
    │   ├── src/{index.ts,money.ts}
    │   └── test/money.test.ts
    ├── platform/
    │   ├── package.json              # exports ./telemetry ./courier ./clock ./ids ./config ./pg
    │   ├── src/
    │   │   ├── telemetry/{logger.ts,tracer.ts,request-context.ts,index.ts}
    │   │   ├── courier.ts
    │   │   ├── clock.ts
    │   │   ├── ids.ts
    │   │   ├── config.ts
    │   │   └── pg.ts
    │   └── test/{courier.test.ts,config.test.ts}
    ├── messaging/
    │   ├── package.json
    │   ├── src/{envelope.ts,outbox-reader.ts,subscription.ts,bus.ts,pg-boss-bus.ts,relay.ts,index.ts}
    │   └── test/{relay.test.ts,pg-boss-bus.integration.test.ts}
    ├── payload-published/
    │   ├── package.json              # "@teashop/payload-published"
    │   └── src/{index.ts,payload-types.ts,product-notice.ts}
    ├── payload-config/
    │   ├── package.json
    │   ├── src/
    │   │   ├── payload.config.ts     # postgresAdapter({ pool, schemaName: "payload" }), lexical
    │   │   ├── collections/{products.ts,media.ts,users.ts,outbox-messages.ts}
    │   │   ├── hooks/write-product-notice.ts
    │   │   └── access/editors.ts
    │   └── migrations/
    │       ├── 20261101_000000_init.ts
    │       └── 20261101_000100_products_revision_trigger.ts
    ├── catalog/
    │   ├── package.json              # exports ./published ./builder ./driving/payload
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── migrations/0000_init.sql
    │   ├── tsconfig.json
    │   ├── tsconfig.domain.json      # include src/domain/**; lib ES2023; types []
    │   ├── src/
    │   │   ├── domain/{product.ts,errors.ts}
    │   │   ├── service/
    │   │   │   ├── driving/{product-review.ts,catalog-inbound.ts}
    │   │   │   ├── ports/{transaction.ts,incoming.ts,message-claims.ts,clock.ts,ids.ts,errors.ts,kept-products.ts,outbox.ts}
    │   │   │   ├── use-cases/{review-product.ts,publish-product-state.ts}
    │   │   │   └── index.ts          # createCatalogServices(deps)
    │   │   ├── published/{index.ts,product-revised.ts,product-withdrawn.ts}
    │   │   ├── offer/builder.ts
    │   │   ├── adapters/
    │   │   │   ├── driven/drizzle/{store.ts,transactions.ts,outbox.ts,message-claims.ts}
    │   │   │   ├── driven/payload/payload-kept-products.ts
    │   │   │   ├── driven/in-memory/{transactions.ts,outbox.ts,message-claims.ts,kept-products.ts,fixed-clock.ts,sequential-ids.ts}
    │   │   │   ├── driving/payload/{courier.ts,product-hooks.ts}
    │   │   │   └── driving/handlers/on-payload-product-notice.ts
    │   │   └── outbox-reader.ts
    │   └── test/
    │       ├── domain/product.test.ts
    │       ├── service/use-cases/{review-product.test.ts,publish-product-state.test.ts}
    │       ├── service/ports/{outbox.contract.ts,message-claims.contract.ts,kept-products.contract.ts,transaction.contract.ts}
    │       ├── adapters/driven/in-memory/{outbox.test.ts,message-claims.test.ts,kept-products.test.ts,transactions.test.ts}
    │       ├── adapters/driven/drizzle/{outbox.integration.test.ts,message-claims.integration.test.ts,transactions.integration.test.ts}
    │       └── adapters/driven/payload/payload-kept-products.integration.test.ts
    ├── shop/
    │   ├── package.json              # exports ./published ./builder ./driving/next/* ./driven/next-revalidate
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── migrations/{0000_init.sql,meta/_journal.json}
    │   ├── tsconfig.json
    │   ├── tsconfig.domain.json
    │   ├── src/
    │   │   ├── domain/
    │   │   │   ├── ids.ts                    # OrderId, CustomerId, RefundId, Sku (branded zod)
    │   │   │   ├── address.ts
    │   │   │   ├── order.ts                  # OrderSchema, openCart, addLine, setQuantity, place, recordCardPayment, reviewDeadline, requestRefund, ...
    │   │   │   ├── order-line.ts             # snapshotLine(entry, quantity)
    │   │   │   ├── customer.ts
    │   │   │   ├── catalog-entry.ts          # replica; applyRevision keeps the higher version; tombstone on withdrawal
    │   │   │   ├── credit-standing.ts        # replica; applyStanding keeps the higher version
    │   │   │   ├── checkout-policy.ts        # mayPayByInvoice, CARD_PAYMENT_WINDOW_MINUTES = 30
    │   │   │   ├── late-payment.ts           # onLatePayment -> refund
    │   │   │   ├── mail.ts                   # ORDER_MAIL_SENDER, confirmationMail(order)
    │   │   │   ├── acceptances.ts            # stale reads and repeats this system accepts
    │   │   │   └── refusals.ts
    │   │   ├── service/
    │   │   │   ├── driving/{storefront.ts,cart.ts,accounts.ts,checkout.ts,order-operations.ts,shop-inbound.ts}
    │   │   │   ├── ports/{transaction.ts,incoming.ts,message-claims.ts,clock.ts,ids.ts,errors.ts,orders.ts,customers.ts,catalog-entries.ts,credit-standings.ts,storefront-queries.ts,order-queries.ts,outbox.ts,card-payments.ts,payment-requests.ts,fulfillment-requests.ts,mailer.ts,storefront-cache.ts}
    │   │   │   ├── private-messages.ts       # zod schemas of shop.private.*
    │   │   │   ├── handle-once.ts            # claim-then-work helper
    │   │   │   ├── to-published.ts           # domain -> shop published language
    │   │   │   ├── use-cases/{add-line.ts,set-quantity.ts,register.ts,place-order.ts,request-refund.ts,record-catalog-entry.ts,withdraw-catalog-entry.ts,record-credit-standing.ts,record-card-payment-succeeded.ts,record-card-payment-cancelled.ts,record-cancellation-refused.ts,record-refund-completed.ts,record-refund-refused.ts,record-dispatch-progress.ts,record-dispatch-refused.ts,record-release-refused.ts,record-hold-expired.ts,record-invoice-settled.ts,send-order-confirmation.ts,refresh-storefront.ts,review-payment-deadline.ts,notice-passed-payment-deadlines.ts,queries.ts}
    │   │   │   └── index.ts                  # createShopServices(deps): { storefront, cart, accounts, checkout, orderOperations, inbound }
    │   │   ├── published/{index.ts,order-placed.ts,order-paid.ts,order-cancelled.ts,common.ts}
    │   │   ├── offer/builder.ts
    │   │   ├── adapters/
    │   │   │   ├── driven/drizzle/{store.ts,transactions.ts,orders.ts,customers.ts,catalog-entries.ts,credit-standings.ts,storefront-queries.ts,order-queries.ts,outbox.ts,message-claims.ts,payment-requests.ts,fulfillment-requests.ts}
    │   │   │   ├── driven/payment-ohs/payment-ohs-card-payments.ts
    │   │   │   ├── driven/postmark/postmark-mailer.ts
    │   │   │   ├── driven/next-revalidate/{next-revalidate-storefront-cache.ts,route.ts}
    │   │   │   ├── driven/in-memory/{transactions.ts,orders.ts,customers.ts,catalog-entries.ts,credit-standings.ts,storefront-queries.ts,order-queries.ts,outbox.ts,message-claims.ts,payment-requests.ts,fulfillment-requests.ts,card-payments.ts,recording-mailer.ts,recording-storefront-cache.ts,fixed-clock.ts,sequential-ids.ts}
    │   │   │   ├── driving/next/courier.ts
    │   │   │   ├── driving/next/pages/{storefront.tsx,product.tsx,cart.tsx,checkout.tsx,order.tsx,register.tsx}
    │   │   │   ├── driving/next/actions/{cart.ts,checkout.ts,accounts.ts,order-operations.ts}
    │   │   │   ├── driving/next/client/{checkout-form.tsx,add-to-cart-button.tsx}
    │   │   │   ├── driving/next/ops/orders-slot.tsx
    │   │   │   ├── driving/handlers/{on-product-revised.ts,on-product-withdrawn.ts,on-dunning-stage-changed.ts,on-card-payment-succeeded.ts,on-card-payment-cancelled.ts,on-cancellation-refused.ts,on-refund-completed.ts,on-refund-refused.ts,on-refund-failed.ts,on-dispatch-progress.ts,on-dispatch-refused.ts,on-release-refused.ts,on-hold-expired.ts,on-invoice-settled.ts,on-send-order-confirmation.ts,on-refresh-storefront.ts,on-payment-deadline-reached.ts}
    │   │   │   └── driving/scheduled/notice-passed-payment-deadlines.ts
    │   │   └── outbox-reader.ts
    │   └── test/                             # mirrors src: domain/*.test.ts, service/use-cases/*.test.ts,
    │                                         # service/ports/*.contract.ts, adapters/driven/in-memory/*.test.ts,
    │                                         # adapters/driven/drizzle/*.integration.test.ts,
    │                                         # adapters/driven/payment-ohs/payment-ohs-card-payments.test.ts (on FakePaymentIntents),
    │                                         # adapters/driven/payment-ohs/payment-ohs-card-payments.e2e.test.ts,
    │                                         # adapters/driven/postmark/postmark-mailer.e2e.test.ts
    ├── payment/
    │   ├── package.json              # exports ./published ./ports ./fakes ./builder ./driving/next/*
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── migrations/0000_init.sql
    │   ├── tsconfig.domain.json
    │   ├── src/
    │   │   ├── domain/{ids.ts,card-payment.ts,refund.ts,refund-policy.ts,lapse-policy.ts,acceptances.ts}
    │   │   ├── service/{driving/payment-inbound.ts,ports/*.ts,private-messages.ts,handle-once.ts,to-published.ts,use-cases/{open-card-payment.ts,record-provider-event.ts,refund.ts,execute-refund.ts,cancel.ts,execute-cancellation.ts,review-intent-lapse.ts,notice-lapsed-intents.ts},index.ts}
    │   │   ├── published/{index.ts,open-card-payment.ts,errors.ts,refund-card-payment.ts,cancel-card-payment.ts,card-payment-succeeded.ts,card-payment-cancelled.ts,cancellation-refused.ts,refund-completed.ts,refund-refused.ts,refund-failed-after-acceptance.ts}
    │   │   ├── offer/{ports.ts,fakes.ts,builder.ts}
    │   │   ├── adapters/{driven/drizzle/*.ts,driven/stripe/stripe-card-provider.ts,driven/in-memory/*.ts,driving/next/{courier.ts,stripe-hook.ts,translate-stripe-event.ts},driving/handlers/*.ts,driving/scheduled/notice-lapsed-intents.ts}
    │   │   └── outbox-reader.ts
    │   └── test/                     # mirrors src; offer/payment-intents.contract.ts runs on FakePaymentIntents (default) and the real service (e2e, Stripe test mode)
    ├── billing/
    │   ├── package.json              # exports ./published ./builder ./driving/next/*
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── migrations/0000_init.sql
    │   ├── tsconfig.domain.json
    │   ├── src/
    │   │   ├── domain/{ids.ts,local-date.ts,vat.ts,invoice.ts,invoice-number.ts,credit-note.ts,transfer-matching.ts,unmatched-transfer.ts,customer-dunning.ts,dunning-policy.ts,bank-cursor.ts,mail.ts,acceptances.ts}
    │   │   ├── service/{driving/{billing-inbound.ts,bank-statements.ts,billing-operations.ts},ports/*.ts,private-messages.ts,handle-once.ts,to-published.ts,use-cases/{invoice-order.ts,credit-refund.ts,record-bank-statement.ts,apply-transfer.ts,assign-transfer.ts,apply-assigned-transfer.ts,notice-dunning-due.ts,review-dunning.ts,send-reminder.ts,queries.ts},index.ts}
    │   │   ├── published/{index.ts,dunning-stage-changed.ts,invoice-settled.ts}
    │   │   ├── offer/builder.ts
    │   │   ├── adapters/{driven/drizzle/*.ts,driven/postmark/postmark-dunning-mailer.ts,driven/in-memory/*.ts,driving/next/{courier.ts,ops/invoices-slot.tsx,actions/assign-transfer.ts},driving/handlers/{on-order-placed.ts,on-order-paid.ts,on-refund-completed.ts,on-apply-transfer.ts,on-apply-assigned-transfer.ts,on-dunning-review-due.ts,on-invoice-settled-for-dunning.ts,on-send-reminder.ts},driving/scheduled/{poll-bank-transfers.ts,bank-api-client.ts,notice-dunning-due.ts},driving/cli/assign-transfer.ts}
    │   │   └── outbox-reader.ts
    │   └── test/                     # mirrors src
    └── fulfillment/
        ├── package.json              # exports ./published ./ports ./fakes ./builder ./driving/next/* ./driving/payload
        ├── GLOSSARY.md
        ├── drizzle.config.ts
        ├── migrations/0000_init.sql
        ├── tsconfig.domain.json
        ├── src/
        │   ├── domain/{ids.ts,fulfillment.ts,hold-policy.ts,dispatch-policy.ts,article.ts,stock-count.ts,stock-level.ts,acceptances.ts}
        │   ├── service/{driving/{fulfillment-inbound.ts,stock-counting.ts,fulfillment-operations.ts,stock-level-queries.ts},ports/*.ts,private-messages.ts,handle-once.ts,to-published.ts,use-cases/{hold.ts,release.ts,request-dispatch.ts,book-dispatch.ts,record-warehouse-report.ts,sync-article.ts,register-article.ts,review-fulfillment-deadline.ts,notice-passed-fulfillment-deadlines.ts,record-stock-count.ts,queries.ts},index.ts}
        │   ├── published/{index.ts,hold-stock.ts,release-stock.ts,dispatch-order.ts,dispatch-booked.ts,dispatch-shipped.ts,dispatch-refused.ts,release-refused.ts,hold-expired.ts,stock-level.ts}
        │   ├── offer/{ports.ts,fakes.ts,builder.ts}
        │   ├── adapters/{driven/drizzle/*.ts,driven/warehouse/http-warehouse.ts,driven/in-memory/*.ts,driving/next/{courier.ts,warehouse-hook.ts,ops/shipments-slot.tsx},driving/payload/{courier.ts,stock-level-field.tsx},driving/handlers/*.ts,driving/scheduled/notice-passed-fulfillment-deadlines.ts,driving/cli/stock-count.ts}
        │   └── outbox-reader.ts
        └── test/                     # mirrors src; adapters/driven/warehouse/http-warehouse.e2e.test.ts against the 3PL sandbox
```

Each system's `package.json` `exports` lists only the paths named in its comment; anything else is
unresolvable from outside the package.

---

## How each property holds

**P1.** Each system's `src/domain/**` is type-checked by its own `tsconfig.domain.json` with
`"lib": ["ES2023"]` and `"types": []`, so `process`, `Buffer`, `window`, the DOM and `node:*`
fail to compile there. dependency-cruiser rule `domain-reach` (`reachable: true`, type-only imports
counted via `tsPreCompilationDeps: true`) allows a domain module to reach only its own
`src/domain/**`, `@teashop/kernel`, and `zod`; nothing else, including the system's own
`published/`, `service/`, `adapters/`, and every other system. Its `ProductSchema`, `OrderSchema`
and so on are zod schemas. The domain takes `now: Date` and ids as arguments. `Intl.DateTimeFormat`
(ECMA-402) is the only global the billing domain uses, for the `Europe/Berlin` calendar date. No
system conforms to an upstream (D21), so the conformist exception is unused. The kernel has the same
tsconfig and reaches only `zod`.

**P2.** Each business rule is one function or constant in its owner's domain: price positive and
the review verdict in `catalog/domain/product.ts`; `mayPayByInvoice` and
`CARD_PAYMENT_WINDOW_MINUTES` in `shop/domain/checkout-policy.ts`; VAT 700/1900 basis points by tax
class in `billing/domain/vat.ts`; payment term 14 days and reminder thresholds in
`billing/domain/dunning-policy.ts`; `refundable` in `payment/domain/refund-policy.ts`; hold expiry
48 h in `fulfillment/domain/hold-policy.ts`. Record shapes are zod schemas in the domain and the
types are `z.infer` of them; Drizzle adapters parse every loaded row with the domain schema. The
Payload `products` collection declares no `min` on price and no select list of its own: its tax
class options are `taxClassOptions` derived from `TaxClass.options`, and price is vetoed by
catalog's hook calling the domain. sku and slug are unique indexes (the key the store enforces).
Driving adapters parse input with domain schemas (the checkout form uses `AddressSchema` in the
browser and the server action). No configuration value is read by a domain or a service.
ESLint forbids `vi.mock` / `vi.doMock` on any `src/domain/` path; use-case tests run the real
domain on fakes of driven ports. Published languages state their own constraints
(`quantity: z.number().int().positive()` in `HoldStock.v1`).

**P3.** Each rule sits in the domain of the record's owner (table above). Shop asks; owners decide:
`HoldStock.v1` carries no hold time (fulfillment's 48 h), `DispatchOrder.v1` carries no carrier
choice, `RefundCardPayment.v1` carries no refundability verdict, `OrderPlaced.v1` carries tax
class but no VAT rate (billing's). `@teashop/kernel` holds `Money` and computations on arguments
only; its review checklist and a dependency-cruiser rule forbid the kernel importing anything but
`zod`. The common library holds no schema of any system; the envelope's `body` is `unknown`.

**P4.** Services and domains take everything that varies by caller as driving-port arguments
(customer id, operator name `requestedBy`/`assignedBy`/`countedBy`, payment method) and everything
that varies by what serves them through driven ports (`Clock`, `Ids`, repositories, providers).
dependency-cruiser forbids `src/service/**` and `src/adapters/driven/**` to import `node:async_hooks`,
`next/headers`, `next/server`, `@teashop/platform/config`, and to read `process.env` (ESLint
`no-process-env` on all packages except `apps/*/src/config.ts`). Driving adapters reach only driving
ports: each handler factory is handed exactly one acting function (`(m: Incoming<X>) => Promise<void>`)
and each server action calls one acting method; where an answering call precedes it
(`paymentOptions` before rendering checkout, `cursor()` before `record`) the acting service decides
again. Unknown Stripe/3PL event types and envelopes that fail parsing are the only calls withheld.
Telemetry (`withRequestContext`, pino, tracer) is ambient and decides nothing.

**P5.** Ports are interfaces in `src/service/ports/` in each system's terms (`CardProvider`, not
`Stripe`; `Warehouse`, not the 3PL's DTOs; `ShopTx`, not a Drizzle type). dependency-cruiser:
`src/service/**` may import its own `domain`, `published`, `service`, `@teashop/kernel`, `zod`,
`@teashop/platform/telemetry`; a driven adapter may import its own ports, domain, published
language, `store.ts` of its own adapter folder, and the one outside library it adapts (Drizzle
adapters `drizzle-orm`/`pg`; `stripe-card-provider.ts` `stripe`; `payload-kept-products.ts`
`payload`); no adapter imports another adapter module. Outside code reaches a system only through
its `package.json` exports: `./published`, `./ports`, `./fakes`, `./builder` for code of this
codebase, `./driving/*` only for `apps/web/app/**` and `packages/payload-config` (ESLint
`no-restricted-imports` per directory). Every adapter is constructed in a system builder from
the configuration and `ProcessResources` assembly passes; nothing exports a ready-made instance
(ESLint `no-restricted-syntax` on top-level `new` of `Pool`, `Stripe`, `PgBoss`, `Payload`
outside `apps/*/src/assembly.ts` and `offer/builder.ts`). Framework-constructed driving adapters
(route files, server actions, pages, Payload hooks and fields) read their system's courier inside
the function body on every call; only the system's builder imports the module that fills it.

**P6.** Every driven port has a fake in the declaring system's `adapters/driven/in-memory/`;
payment's and fulfillment's open host services have fakes in `offer/fakes.ts`. Use-case tests
build services with `createXServices({ ...inMemory })` only. One contract suite per port in
`test/service/ports/<port>.contract.ts` (`export function describeOrdersContract(make: () =>
Promise<Orders & Inspect>)`) asserts what use cases rely on: stale save throws `StaleWrite`,
duplicate key throws `StaleWrite`, rollback leaves nothing, `claim` returns `"repeat"`, the gateway
answers a disputed refund with `declined`. It runs on the fake in the default suite and on the
real adapter in `*.integration.test.ts` against a testcontainers Postgres migrated by the
system's real migrations (not `drizzle-kit push`), or in `*.e2e.test.ts` against Stripe test mode,
the 3PL sandbox, Postmark's test token and the bank sandbox. Fakes are written for the port, none
wraps the real adapter. pino writes to stdout; the OTel API is a no-op without the SDK; no module
opens a pool at load.

**P7.** Every acting use case is `transactions.run(async (tx) => { ... })` exactly once, saves at
most one aggregate, and passes `tx` to every write (repositories, outbox port, `MessageClaims`, the
request ports that write to the outbox). `run` commits after the callback resolves and rolls back
on any throw; no savepoints. dependency-cruiser forbids `use-cases/*` importing other `use-cases/*`
(no service calls another), and ESLint forbids importing the Drizzle `db` outside `store.ts` and
`transactions.ts` (adapters reach the store only through `registry.resolve(tx)`). Everything a goal
needs beyond its one aggregate goes as a message in the same transaction: cart and order are one
`Order` (D5); invoice numbering saves only the `Invoice` (D13); sweeps and the bank poll write one
message per item and save at most the `BankCursor`.

**P8.** Outbox rows are inserted through the outbox port in the use case's transaction; mails,
3PL calls, Stripe refunds and cancellations, article upserts and cache revalidations leave only as
private executor messages. The single call beside a transaction is `CardPayments.open`, a request
for a tentative operation (a PaymentIntent gives nothing until the customer confirms it). The
relay marks a row only after `bus.publish` resolved (pg-boss insert committed), inside a
`FOR UPDATE SKIP LOCKED` transaction; pg-boss keeps jobs in Postgres through any stop and retries
until the handler resolves, then parks in `.dlq`. Handlers and hooks answer only after their use
case returned. Executors decide nothing: `bookDispatch` reads the `Fulfillment` only to find the
booking already recorded. Payload is told by its own outbox written in its transaction (afterChange
and afterDelete hooks with `req`), so catalog never acts on an uncommitted product; the
beforeChange hook only vetoes.

**P9.** Every message-called acting use case starts with `handleOnce(tx, CONSUMER, m.messageId)`
in its committing transaction (`INSERT ... ON CONFLICT DO NOTHING RETURNING` on primary key
`(consumer, message_id)`); `"repeat"` commits nothing and returns what the committed records say
(e.g. the recorded `warehouseDispatchId`). Hook messages carry Stripe's event id and the 3PL's
event id; bank items carry `bank:<transferId>`, and `record` inserts their outbox rows with that id
`ON CONFLICT DO NOTHING`. Changes outside carry keys from the message: Stripe
`idempotencyKey: "refund:" + refundId` plus `findRefund(refundId)` before creating;
`cancel:<paymentId>`; 3PL `externalReference = fulfillmentId` (409 → `findDispatch`); article
upsert is a PUT by sku. Postmark takes no key: `shop/domain/acceptances.ts` exports
`confirmationMailRepeat = "accepted"` and billing's `reminderMailRepeat = "accepted"`, and the
executors reference them.

**P10.** Acting use cases read in their committing transaction. Every aggregate carries `version`;
saves compare it, inserts hit unique keys (`orders.id`, `customers.email`, `card_payments.order_ref`,
`fulfillments.order_ref`, `invoices.order_ref`, `invoices (year, seq)`, `credit_notes.refund_ref`,
`credit_notes (year, seq)`, `catalog_entries.product_id`); both throw `StaleWrite`, which no use case
catches: server actions answer "changed meanwhile, try again", handlers rethrow for redelivery.
Reads not covered by the saved aggregate are each named in the domain's `acceptances.ts` with what
follows: shop's `CatalogEntry` at checkout (the order stands at the snapshot price), `CreditStanding`
at checkout (an invoice order for a customer who just entered dunning stands), `Customer` email at
checkout (the mail goes to the address read); billing's open invoices at dunning review (a reminder
that crosses a payment says "disregard if paid"); payment's live Stripe answers. Aggregates are cut
by business rule: `Order` holds catalog data only as line snapshots, `Fulfillment` holds no stock
total (availability is computed), `CustomerDunning` holds no invoices. Gapless numbering is the one
place issuances fail each other, and the gapless rule ties them.

**P11.** No system has a database role, Drizzle table definition or import that touches another
schema (dependency-cruiser: `adapters/driven/drizzle/**` of system X may not import another system's
`store.ts`; integration tests run each system on a database user granted only its schema plus
`pgboss`). Reads of others go through published events into replicas (`catalog_entries`,
`credit_standings`) or the one open host service (`PaymentIntents`). Changes go through commands
(`HoldStock`, `RefundCardPayment` ...). The relay reads outboxes through each owner's
`outbox-reader.ts`. Payload keeps catalog's products: Payload access lets only the `editors` role
change `products`, every write path (admin, REST, Local API) runs catalog's beforeChange veto,
`revision` has `access.update: () => false` and is raised only by the trigger, no API key with write
access exists, and the stock field reads fulfillment through `StockLevelQueries`.

**P12.** Every system is an anti-corruption layer to every upstream (D21). dependency-cruiser
allows `@teashop/<other>/published`, `@teashop/payload-published`, `stripe`, and the 3PL/bank DTO
modules only from `src/adapters/driving/handlers/**`, `src/adapters/driving/next/*-hook.ts`,
`src/adapters/driving/payload/**`, and the named driven adapters that carry calls or commands
(`payment-ohs-card-payments.ts`, `payment-requests.ts`, `fulfillment-requests.ts`,
`stripe-card-provider.ts`, `http-warehouse.ts`, `payload-kept-products.ts`, `bank-api-client.ts`).
`src/published/**` may import only `zod`, `@teashop/kernel`, and its own `published/**`; the
kernel imports only `zod`. No generator copies one system's types into another; the only
generation is Payload's `payload-types.ts` into Payload's own published-language package.

**P13.** Other systems import only `./published`, `./ports`, `./fakes`; `./builder` is importable
only from `apps/*/src/assembly.ts` (ESLint per directory, and `package.json` `exports`). Builders
return services behind driving ports, subscriptions, schedules, CLI commands, and the outbox reader;
none returns a repository. Every message and the `PaymentIntents` signature are built from
published-language schemas by `to-published.ts` in the service and parsed by the writer's outbox
adapter before insert. `src/published/**` reaches nothing of its own system (dependency-cruiser);
`tools/check-published-compat.ts` also fails when a published module is generated.

**P14.** Each message has one zod schema in its writer's `published/` (or `private-messages.ts`),
exported as `{ type: "shop.OrderPlaced.v1", schema }`; the outbox adapter parses with it before
insert and every handler parses with it. `check:published` snapshots each schema as JSON Schema and
fails CI on a removed field, a renamed field, a new required field, a changed type, or a changed
enum; the fix is a `.v2` type written beside `.v1` until `.v1` queues and outboxes are empty and no
subscriber reads it, then `.v1` is removed. Absence-as-meaning is a review item in the PR template
("does an old reader read a missing field as a fact?"). Records: migrations are expand/contract
(squawk blocks drop, rename, `SET NOT NULL` without default); new columns and enum values ship in
release N readable and unwritten, written in N+1; repositories update only the columns they declare
and upsert child rows by key, so an old process saving a row leaves new columns as they were.
`PaymentIntents` is called in-process only, so its port is out of P14's scope.

**P15.** Use cases a caller is held on depend only on their own store: storefront, cart, accounts,
operations, catalog review, stock levels. Two exceptions, each a business rule: `placeOrder` with
card (the customer pays now; `shop/domain/checkout-policy.ts` `cardPaysAtCheckout`) calls payment,
whose `open` calls Stripe for the same reason. Pay-by-invoice offering reads the `CreditStanding`
replica, never billing. Everything else is a command or event through the outbox. Message-called
use cases call Stripe, the 3PL, Payload, Postmark and the revalidation route and fail for
redelivery while those are down. The bank poll is a scheduled task nobody is held on.

**P16.** Transactions are `ShopTx`/`PaymentTx`/... tokens passed as arguments; nothing puts a
transaction in `AsyncLocalStorage` (OTel's context manager is the only user, and it carries no
transaction). Driving ports and `PaymentIntents` take no transaction parameter and no store type
(dependency-cruiser forbids `src/service/driving/**` and `offer/ports.ts` to import `ports/transaction.ts`,
`drizzle-orm` or `pg`). Each system's Drizzle instance is built over its own `pgSchema("<sys>")`
tables only. Catalog's Payload Local API call passes no `req`; catalog's and fulfillment's Payload
hooks pass nothing of Payload's `req` into their driving ports.

**P17.** Every wait that holds something has its moment in an aggregate and a sweep: `Order.paymentDueAt`
(30 min, cancel, release, cancel the card payment); `CardPayment.lapsesAt` (24 h, cancel at Stripe);
`Fulfillment.holdExpiresAt` (48 h without a dispatch request, release and publish `HoldExpired`) and
`Fulfillment.dispatchOverdueAt` (5 days booked without shipment report, flagged for operations and
accepted). Each sweep only writes notices; the per-item use case decides by the aggregate. Endings
per state are domain functions (`reviewDeadline`, `onLatePayment` → refund, `onDispatchRefused` →
`needsAttention` accepted for an operator, `onHoldExpired` → accepted, `dunning-policy.ts` → stage 3
plus 14 days `handedToCollection` accepted, unmatched transfer accepted until assigned). Refusals
are committed as outcomes and published in the refuser's published language (`RefundRefused`,
`CardPaymentCancellationRefused`, `DispatchRefused`, `ReleaseRefused`); failures (`StaleWrite`,
`*Unavailable`, `InvoiceNotYetIssued`, `ArticlesNotRegistered`) are thrown, committing nothing,
retried, and parked in `.dlq` where `/ops` lists dead-letter counts.

**P18.** Messages that override carry the thing's version, raised in the committing transaction:
`ProductRevised.version` (Payload `revision`, raised by a Postgres trigger on `payload.products`),
`DunningStageChanged.version` (`CustomerDunning.version`), `CardPaymentSucceeded.version`,
`Dispatch*.version`, `InvoiceSettled.version`; receivers keep the higher and drop lower or equal
(`catalog-entry.ts`, `credit-standing.ts`, order's dispatch status). Payload notices are answered by
fetching current state. Commuting messages are applied by what they say: `ReleaseStock` before
`HoldStock` creates the `Fulfillment` released, and the later hold finds it so; `DispatchOrder`
before `HoldStock` creates it held and requested. A message whose predecessor is missing (refund
before invoice, payment success for an unknown order) throws and is redelivered. Where two writers
meet on one `Order` (payment's success and shop's own deadline), `late-payment.ts` decides.
Stripe events update `CardPayment` by a forward-only status order (`open < succeeded`, `open <
cancelled`, disputed sticky).

**P19.** Each system has `GLOSSARY.md` beside its `package.json`, and a term enters it before
code uses it (PR template checkbox). Other systems' types are imported only as namespaces
(`import * as billing from "@teashop/billing/published"`, `import type * as stripe ...`), enforced
by ESLint `no-restricted-syntax` on named imports from those modules, so every foreign word reads
`billing.DunningStageChangedV1`, `payload.Product`, `stripe.PaymentIntent`. References to another
system's ids are named `orderRef`, `customerRef`, `paymentRef`, `refundRef` in the receiver's terms.
Shop's `Order` is one meaning (an order from first cart line on; "cart" is its first stage);
billing's customer is `customerRef`; fulfillment avoids `Order` entirely (`Fulfillment`,
`orderRef`).

---

## Decisions the document left to me

D1. **Where the systems are cut.** Chose five: `catalog`, `shop`, `payment`, `billing`,
`fulfillment`. Would also have held: `payment` inside `shop` (fewer messages, Stripe adapters in
shop); `catalog` merged into `shop` with Payload's notice handled by shop.

D2. **Who owns products.** Chose `catalog` as owner, Payload as external keeper, catalog's veto
called from beforeChange. Would also have held: Payload as an external owner whose configuration
holds price and sku rules as its own, with shop and fulfillment as anti-corruption layers to
Payload's published language.

D3. **Framework and where Payload runs.** Chose Next.js 15 hosting Payload 3 in `apps/web`, and
Payload's Local API in `apps/worker`. Would also have held: Payload in its own deployable reached
over REST.

D4. **Choreography or orchestration.** Chose orchestration by shop's `Order` as process manager
for payment and fulfillment; choreography for billing (it reacts to shop's and payment's events).
Would also have held: full choreography with fulfillment and payment reacting to shop's events.

D5. **Cart and order.** Chose one aggregate `Order` whose first stage is the cart. Would also have
held: a `Cart` aggregate emptied by a private message after `placeOrder`.

D6. **Stock refusal.** Chose: holds are never refused; holding beyond the count is a backorder;
the 3PL's rejection is the refusal. Would also have held: per-sku `Stock` aggregates with a saga
inside fulfillment that refuses an order when any line is short.

D7. **Fulfillment aggregate.** Chose one `Fulfillment` per order holding both stock hold and
dispatch. Would also have held: separate `Hold` and `Dispatch` aggregates linked by private
messages.

D8. **Bus and relay.** Chose pg-boss on the same Postgres, queue per handler, fan-out by type,
10 retries with backoff, dead-letter queue per queue; relay polling outboxes every 500 ms with
`SKIP LOCKED`. Would also have held: RabbitMQ or SQS with the same relay.

D9. **How the clock starts deadline use cases.** Chose sweeps (cron per system) that write one
notice per item. Would also have held: delayed messages (`startAfter`) written with the change.

D10. **Transaction handle.** Chose a per-system class token with a private field, mapped to the
Drizzle transaction by a `WeakMap` in the adapters' `store.ts`, a required first parameter of every
repository method. Would also have held: passing the Drizzle transaction typed behind a system-owned
interface.

D11. **Concurrency control.** Chose optimistic versions bumped by domain transitions and compared
on save, plus unique keys. Would also have held: `SELECT ... FOR UPDATE` at load.

D12. **Repeat detection.** Chose a `handled_messages` table per system with key `(consumer,
message_id)`, claimed first in the transaction. Would also have held: key `message_id` alone per
system, or records-only detection for the use cases whose writes are status sets.

D13. **Gapless numbers.** Chose `lastNumber(year) + 1` read in the transaction and a unique
`(year, seq)` key on `invoices` and `credit_notes`, saving only the new document. Would also have
held: an `InvoiceSeries` aggregate assigning numbers to already-saved draft invoices by a private
message.

D14. **Business numbers.** Chose card payment window 30 min; PaymentIntent lapse 24 h; hold expiry
48 h; dispatch overdue 5 days; payment term 14 days; reminders at 7, 14, 21 days overdue, at least 7
days apart; collection hand-over 14 days after stage 3; invoice and credit-note series per calendar
year in `Europe/Berlin`. Any other values hold the same properties.

D15. **Late payment on a cancelled order.** Chose refund. Would also have held: reinstating the
order, or keeping the money as credit.

D16. **Refunds.** Chose full refunds only, requested by an operator on `/ops` through shop. Would
also have held: partial refunds, or refunds requested directly in payment.

D17. **When invoices are issued.** Chose: card orders on `OrderPaid`, invoice orders on
`OrderPlaced`, due 14 days after issue. Would also have held: invoice orders invoiced on
`DispatchShipped`.

D18. **Bank transfers.** Chose polling every 5 minutes with a cursor kept in a `BankCursor`
aggregate, one private message per transfer, match by invoice number in the remittance reference
and full amount, else `UnmatchedTransfer` assigned by an operator. Would also have held: a bank
webhook as a hook.

D19. **Mail provider.** Chose Postmark; repeats accepted. Would also have held: any provider,
including one with idempotency keys.

D20. **3PL keys and articles.** Chose `externalReference = fulfillmentId` with 409 → lookup;
article upsert on every `ProductRevised`; booking fails and retries until all lines' articles are
registered. Would also have held: upserting articles inside `bookDispatch` before booking.

D21. **Conformist or anti-corruption layer.** Chose anti-corruption layer toward every upstream,
external ones included. Would also have held: shop conforming to catalog's published language.

D22. **Shared kernel.** Chose `Money` only. Would also have held: no kernel, each published
language declaring its own amount.

D23. **Offer layout and couriers.** Chose `package.json` exports `./published`, `./ports`,
`./fakes`, `./builder`, `./driving/*`; one courier per system, created in its driving adapters and
filled by its builder. Would also have held: one courier per process filled by the app's assembly.

D24. **Where driving adapters for Next live.** Chose in the system packages, with one-line
re-export files under `apps/web/app`. Would also have held: route files in `apps/web/app` written as
the system's code with directory-scoped lint.

D25. **Operations dashboard.** Chose Next parallel routes, one slot per system, each slot that
system's driving adapter. Would also have held: an `operations` system with replicas of orders,
invoices and shipments.

D26. **Telemetry plumbing.** Chose request id in OTel baggage, trace carrier on the envelope,
pino mixin, prom-client registries behind `/metrics` probes. Would also have held: OTel metrics with
the Prometheus exporter.

D27. **Lint tooling.** Chose ESLint plus dependency-cruiser plus a domain-only tsconfig. Would also
have held: Biome plus dependency-cruiser.

D28. **Test tooling.** Chose Vitest, testcontainers Postgres with real migrations, contract suites
as functions under `test/service/ports`, `*.integration.test.ts` and `*.e2e.test.ts` outside the
default suite, e2e run by hand. Would also have held: a shared CI Postgres.

D29. **Migrations.** Chose drizzle-kit per system schema, Payload migrations for Payload's schema
and its revision trigger, squawk, expand/contract across two releases, a migrate job before deploy.
Would also have held: migrating on process start under an advisory lock.

D30. **Message versioning.** Chose `.vN` in the type name and a snapshot compatibility check. Would
also have held: a `schemaVersion` field on the envelope.

D31. **Storefront cache.** Chose `revalidateTag` through an internal route the shop's
`StorefrontCache` adapter calls; one web replica. Would also have held: a shared Next cache handler
in Postgres and several replicas.

D32. **Payload's message.** Chose a notice (`productId`, `operation`) written by Payload hooks with
`req`, a `revision` raised by a Postgres trigger, catalog fetching current state. Would also have
held: Payload's hook writing the full document with the revision read back.

D33. **Customer identity.** Chose registration before checkout and a cookie holding the customer
id (authentication out of scope). Would also have held: guest checkout with customer resolved by
email in a prior acting call.

D34. **How acceptances are written down.** Chose named exports in each domain's `acceptances.ts`
referenced by the service at the decision. Would also have held: JSDoc on the deciding function.

D35. **Mail sender.** Chose sender addresses as domain constants. Would also have held: a record
edited by a use case.

D36. **Gross or net prices.** Chose gross prices in the catalog; billing derives net and VAT with
`netFromGross`. Would also have held: net prices.

D37. **Refusal and failure in code.** Chose refusals as `{ ok: false, refusal }` unions from domain
and driving ports, failures as thrown errors. Would also have held: a `Result` library.

D38. **Ports declared where.** Chose `src/service/ports/` (driven) and `src/service/driving/`
(driving). Would also have held: ports in the domain, kept pure.

D39. **Currency.** Chose EUR only. Would also have held: multi-currency `Money`.

---

## Sentences I had to pick a reading for

S1. P8: "A use case called for such a message MUST make the change, deciding nothing again". Reading
A: every use case called for a message the system wrote itself executes without deciding, so the
per-item use case of a sweep must cancel whatever the sweep chose. Reading B: "such a message" is
one asking for a change its writer's transaction decided and did not commit; a sweep's notice decides
nothing and the use case it starts decides by the aggregate, as P17 ("the use case it starts decides
by the aggregate") says. Took B. Changed: sweeps write notices (`PaymentDeadlineReached`,
`IntentLapseReached`, `FulfillmentDeadlineReached`, `DunningReviewDue`) and the per-item use cases
decide; executors (`SendOrderConfirmation`, `ExecuteRefund`, `BookDispatch` ...) decide nothing.

S2. P11: "this codebase MUST configure it so that nothing but the owner's use cases changes the
record". Reading A: only a write performed by catalog's acting use case, through Payload's API,
may change a product, so editors' admin saves would have to be routed into a catalog use case that
writes back. Reading B: a change Payload makes after catalog's use case accepted it is the owner's
change, Payload executing ("the keeper hands the change to the owner's use case, and keeps the
record as before"). Took B. Changed: catalog's `ProductReview.review` is an answering use case called
by the beforeChange hook on every write path; no catalog use case writes products.

S3. P7: "what else its goal needs MUST be asked for by such a message" beside P8's "or as a request
to another system for a tentative operation, which the transaction does not carry". Reading A: P7
forbids `placeOrder` to call payment at all. Reading B: P8 names the tentative operation as the one
request that may leave by call. Took B. Changed: `placeOrder` calls `CardPayments.open` while its
transaction is open; payment's `open` is the only cross-system acting call in the codebase.

S4. P10: "A decision on data whose change fails no transaction of this store MUST rest on a business
rule". Reading A: only data in another store or system (replicas of remote owners, live answers).
Reading B: any data the decision reads that the saved aggregate's version does not cover, even rows
of this system in this store. Took B. Changed: `acceptances.ts` names checkout's reads of
`CatalogEntry`, `CreditStanding` and `Customer`, and billing's read of open invoices at dunning review.

S5. P1: "That pure code ... MUST load on every runtime of the language". Reading A: ECMA-262 plus
ECMA-402 (`Intl` with time zones) as every engine ships them. Reading B: ECMA-262 only, since a
small-ICU runtime may lack `Europe/Berlin`. Took A. Changed: billing's domain computes calendar dates
with `Intl.DateTimeFormat({ timeZone: "Europe/Berlin" })` instead of taking a local date argument.

S6. P5: "from a courier that only assembly fills and a driving adapter reads each time it runs".
Reading A: one courier per process, filled in the app's assembly. Reading B: any number, as long as
only assembly's parts fill them; a system builder is assembly. Took B. Changed: one courier per
system (`shop/adapters/driving/next/courier.ts` ...), filled by that system's builder, carrying only
what that system's driving adapters call.

S7. P5: "reach a driving adapter by its way in, the file the framework finds or the hook the
external system calls, which is no export". Reading A: a driving adapter must sit in the file the
framework finds, nothing imported. Reading B: the framework's file and Payload's config entry are the
way in, and the import they need is part of that way in, not of the offer. Took B. Changed: the
`./driving/*` export paths exist and are importable only from `apps/web/app/**` and
`packages/payload-config`.

S8. P17: "Where its part waits on another system, it MUST hold the moment it stops waiting in an
aggregate of its own, if: it holds something until the answer comes". Reading A: fulfillment holding
stock until shop's `DispatchOrder` or `ReleaseStock` is a wait of its own. Reading B: shop's process
manager holds the deadline and fulfillment only follows commands. Took A. Changed:
`Fulfillment.holdExpiresAt`, a fulfillment sweep, and `HoldExpired.v1` handled by shop.

S9. P11: "MUST read it only through that open host service or the owner's published events". Reading
A: Payload's stock field may call fulfillment only through a driving port fulfillment offers as open
host service. Reading B: a hook of fulfillment calling an internal driving port is enough, since the
hook is fulfillment's code. Took A. Changed: `StockLevelQueries` and `StockLevelV1` are on
fulfillment's offer with a fake.

S10. P9: "by the message's id claimed there under a key the store refuses twice". Reading A: the key
is the message id per system. Reading B: the key is per consuming use case. Took B. Changed:
`handled_messages` primary key `(consumer, message_id)`, so `RefundCompleted` handled by two shop
handlers in future would not shadow each other.

S11. P6 Why: "a transaction port whose fake commits nothing". Reading A: the fake runs the work and
does nothing on throw. Reading B: it commits nothing to an outside store but does roll back, since
use-case tests rely on "a failure commits nothing" (P17). Took B. Changed: the in-memory
`Transactions` snapshots the in-memory stores and restores them on throw, and the transaction
contract suite asserts rollback on both implementations.

S12. P7: "the record of the message it is called for". Reading A: written only when repeats are told
by claimed id. Reading B: written by every message-called acting use case. Took B. Changed: every
message-called acting use case goes through `handleOnce`, including those whose records alone would
tell a repeat.

S13. P15: "unless a business rule of its system needs that system's current answer". Reading A: the
rule must be shop's for shop's call and payment's for payment's call to Stripe. Reading B: payment's
call inherits shop's need. Took A. Changed: payment's domain states `intentOpensAtRequest` (an intent
is opened at Stripe when asked, since the caller is held for its secret), and shop's states
`cardPaysAtCheckout`.

S14. Glossary, Driving adapter: "There are as many driving adapters as there are ways into the
process". Reading A: one per transport (one bus adapter per process, one Next adapter). Reading B:
one per entry the outside can take (each route file, each server action, each subscription, each
schedule, each Payload hook). Took B. Changed: one handler module per subscription, each handed one
acting function, which is how P4's one acting call is made structural.
