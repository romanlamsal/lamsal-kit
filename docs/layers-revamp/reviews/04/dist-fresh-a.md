# Fresh repository draft A, distilled set (property rules)

Stack picked: Node 22, TypeScript 5 strict, pnpm workspace. Next.js 15 (App Router) hosts the
storefront, the ops pages and Payload CMS 3 in one `web` process; a `worker` process runs the relay,
the bus handlers and the scheduled tasks; a `migrate` job runs before each deploy. One Postgres 16
instance, Drizzle ORM, one Postgres schema, one role and one pool per system. Bus: pg-boss 10 in the
same instance (schema `pgboss`). zod 3 for every schema. date-fns 4 with `@date-fns/tz`. pino to
stdout, OpenTelemetry NodeSDK exporting OTLP to Jaeger, `@opentelemetry/exporter-prometheus` for
`/metrics`. Stripe via `stripe`, mail provider Postmark via `postmark`, 3PL and bank via `fetch`.
Lint: Biome (style), dependency-cruiser (import rules), ast-grep (syntax rules), per-layer
`tsconfig.json` (runtime rules). Tests: vitest, `@testcontainers/postgresql` for the integration run.

## Systems and what each owns

Systems of this codebase. "Owns" is the glossary's Owner: records its business rules decide.
"Keeps" is where they sit.

| System | Kind | Owns | Keeps |
|---|---|---|---|
| `catalog` | system of this codebase | `Product` (the sellable product: sku, slug, name, description as HTML, images, price, tax class, listed or withdrawn, version); `ProductRevision` (catalog's verdict on one Payload document revision: adopted, superseded or refused with violations); the `catalogStatus` field on Payload's product document, which Payload keeps for catalog | schema `catalog`: `products`, `product_revisions`, `outbox`, `handled_messages`. In Payload's store: `products.catalog_status` (kept by Payload, written only through catalog's adapter) |
| `shop` | system of this codebase | `Cart`; `Order` (lines with a snapshot of price, sku and tax class; payment facet with the card payment deadline; shipping facet; refund facet); `Customer` (id, email) | schema `shop`: `carts`, `cart_lines`, `orders`, `order_lines`, `customers`, replica `product_offers` (of catalog's `ProductChanged`), replica `payment_standings` (of billing's dunning stage), `outbox`, `handled_messages` |
| `payment` | system of this codebase | `CardPayment` (one per order: Stripe intent reference, amount, status, disputed flag, expiry); `Refund` | schema `payment`: `card_payments`, `refunds`, `outbox`, `handled_messages` |
| `billing` | system of this codebase | `Invoice` (gapless number, order id, customer, lines with VAT rate, due date, applied transfers, status); `CreditNote`; `NumberSeries` (one per series and year); `DunningAccount` (per customer: stage); `IncomingTransfer` (bank transaction, matched or unmatched); `OrderCancellationNote` (an order cancelled before billing saw it placed) | schema `billing`: `invoices`, `invoice_lines`, `credit_notes`, `number_series`, `dunning_accounts`, `incoming_transfers`, `order_cancellation_notes`, `outbox`, `handled_messages` |
| `fulfillment` | system of this codebase | `StockItem` (per sku: on hand as last read from the 3PL, reservations by order); `FulfillmentOrder` (per order: placed, short, reserved, cancelled; a cancel that came first is kept); `Shipment` (lines, address, consignment reference, status, dispatch-expected-by); `Article` (per sku: 3PL article-master registration, shipments waiting on it) | schema `fulfillment`: `stock_items`, `stock_reservations`, `fulfillment_orders`, `shipments`, `shipment_lines`, `articles`, `outbox`, `handled_messages` |

External systems.

| External system | Where it runs | Owns | How it is reached |
|---|---|---|---|
| Payload CMS 3 | in-process in `web`, schema `payload`, role `teashop_payload` | the editorial product document (copy, images, slug, price, sku and tax class as typed by editors, `revision`), media, admin users, Payload's `outbox` collection | catalog's veto hook (`beforeChange`); Payload's own `afterChange` writes Payload's outbox in Payload's transaction; catalog's executor writes `catalogStatus` through Payload's REST API with the `catalog-service` API key; fulfillment's admin field component renders stock. Configuration written by us in `packages/cms`; its published language (generated types and outbox message schemas) in `packages/cms-language` |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | payment's driven adapter (API, idempotency keys); payment's hook `/api/webhooks/stripe` |
| 3PL warehouse | vendor | consignments, article master, physical inventory | fulfillment's driven adapter (REST); fulfillment's hook `/api/webhooks/3pl` |
| Bank | vendor | account transactions | billing's scheduled task polls it |
| Postmark | vendor | sent mails | shop's and billing's mail adapters |
| Jaeger | ours, outside the app | traces | telemetry only (OTLP) |

Postgres is the store, not a system. pg-boss is the bus, run by the common library.

Shared kernel `@teashop/kernel` (`packages/kernel`), imported by every domain and agreed on by all
five systems:
- `Money` (`{ cents: number; currency: "EUR" }`, `add`, `times`, `sum`, `splitGross(gross, ratePercent)` rounding half-up to the cent),
- `TaxClass` (`"tea" | "accessories"`, `TAX_CLASSES`, `parseTaxClass`),
- `Sku` (branded string, `parseSku`, format `^[A-Z0-9-]{3,32}$`).
Values and computations only, no record schema, no rate.

Code that is no system:
- assembly: `apps/web/src/assembly/**`, `apps/web/instrumentation.ts`, `apps/worker/src/assembly/**` (including the outbox reader for Payload's outbox);
- common library `@teashop/lib`: envelope, Postgres outbox writer and reader factories, relay, pg-boss bus, unit-of-work factory, claim-table factory, courier factory, system clock and uuidv7 generator, telemetry (logger, tracer, request context, NodeSDK start), in-memory transactional store for fakes;
- probes: `/health` and `/metrics` in `web` (`apps/web/src/app/(probes)/`) and on the worker's port 9464 (`apps/worker/src/probes/`);
- Payload's configuration and published language (external system's code, written here): `packages/cms`, `packages/cms-language`;
- the app shell: Next root layout, the ops navigation (links only, imports no system);
- tooling: `apps/migrate`, `scripts/`, `tools/schema-compat`, `infra/`.

## Ports and adapters

### Common shape, declared by each system for itself

Every system declares these in its own `src/ports/driven/`, in its own names. The common library
implements them by shape; assembly hands the implementation in. Shown for `shop`; the others are
the same with their prefix (`CatalogTx`, `PaymentTx`, `BillingTx`, `FulfillmentTx`).

```ts
// packages/shop/src/ports/driven/transaction.ts
export const shopTx: unique symbol = Symbol("shop.tx");
export interface ShopTx { readonly [shopTx]: true }
export interface ShopUnitOfWork { run<T>(work: (tx: ShopTx) => Promise<T>): Promise<T> }

// packages/shop/src/ports/driven/errors.ts
export class StaleWrite extends Error { constructor(readonly aggregate: string, readonly id: string) { super(`${aggregate} ${id} changed since read`) } }

// packages/shop/src/ports/driven/clock.ts
export interface Clock { now(): Date }

// packages/shop/src/ports/driven/ids.ts
export interface ShopIds { orderId(): OrderId; cartId(): CartId; customerId(): CustomerId; refundId(): RefundId; messageId(): MessageId }

// packages/shop/src/ports/driven/outbox.ts
export type ShopOutgoing =
  | { id: MessageId; visibility: "published"; message: shopPl.ShopEvent }      // shop's own published language
  | { id: MessageId; visibility: "private"; message: ShopPrivateMessage };       // shop's private schemas
export interface ShopOutbox { add(messages: readonly ShopOutgoing[], tx: ShopTx): Promise<void> }

// packages/shop/src/ports/driven/message-claims.ts
export type ShopHandlerName = "applyProductChange" | "applyPaymentStanding" | "recordCardPaymentSucceeded" | /* one per handler */ "sendOrderConfirmation";
export type Claim<R> = { kind: "first" } | { kind: "repeat"; result: R };
export interface ShopMessageClaims {
  claim<R>(messageId: MessageId, handler: ShopHandlerName, result: z.ZodType<R>, tx: ShopTx): Promise<Claim<R>>;
  settle<R>(messageId: MessageId, handler: ShopHandlerName, result: R, tx: ShopTx): Promise<void>;
}
```

Implementations:
- `ShopPgTx` (`adapters/driven/postgres/tx.ts`): `class ShopPgTx implements ShopTx { readonly [shopTx] = true as const; constructor(readonly db: PgTx) {} }` and `pgOf(tx: ShopTx): PgTx`, which narrows by `instanceof` and throws `ForeignTransaction` otherwise. No cast. The unit of work is `pgUnitOfWork(db, (t) => new ShopPgTx(t))` from `@teashop/lib/postgres`, `READ COMMITTED`.
- Outbox: `pgOutboxWriter(outboxTable, pgOf)` from `@teashop/lib/outbox` writes an `Envelope` row (`INSERT ... ON CONFLICT (id) DO NOTHING`), adding `traceparent` and `requestId` from the ambient telemetry context to `headers`.
- Claims: `pgMessageClaims(handledMessagesTable, pgOf)`: `INSERT INTO handled_messages (message_id, handler) ... ON CONFLICT DO NOTHING RETURNING`; no row returned means repeat, and the stored `result` jsonb is parsed with the given schema. Primary key `(message_id, handler)`.
- Clock and ids: `systemClock` and `uuidv7Ids` from `@teashop/lib`, wrapped by each builder into the system's id port.
- Fakes, in `src/fakes/`: `InMemoryShopStore` (copy-on-write state; `run` clones, commits by swap, discards on throw), and per port an in-memory class over it that enforces the same version check (`StaleWrite`) and the same unique keys; `FixedClock`; `SequentialShopIds`.

The envelope, common library (`@teashop/lib/messaging`):

```ts
export type Envelope = {
  id: string;                                 // writer's message id, same on every delivery
  type: string;                               // "shop.OrderPlaced"
  schemaVersion: number;                      // 1
  source: string;                             // writing system
  visibility: "published" | "private";
  writtenAt: string;                          // ISO instant, informational only
  payload: unknown;                           // parsed by the reader with the message's one schema
  headers: { traceparent?: string; requestId?: string };
};
export type BusSubscription = { queue: string; messageTypes: readonly string[]; handle(envelope: Envelope): Promise<void> };
export type OutboxReader = { name: string; fetchUnsent(limit: number): Promise<{ envelopes: readonly Envelope[]; markSent(): Promise<void>; release(): Promise<void> }> };
export type ScheduledTask = { name: string; cron: string; tz: "Europe/Berlin"; run(): Promise<void> };
```

Each system's handlers are driving adapters: one `BusSubscription` per handler, queue
`<system>.<handlerName>`. A handler parses `payload` with the message's schema (the upstream's
published language for another system's message, the system's own private schema otherwise),
translates to the system's terms, makes exactly one call to one driving port, and returns. pg-boss
completes the job only when `handle` resolves.

### catalog

Domain (`packages/catalog/src/domain/`): `Product`, `ProductRevisionInput`, `ProductRevision`,
specification `reviewRevision(candidate, existingBySku, current): RevisionVerdict` (price above
zero, sku format via kernel, sku unique, sku not changed once a product was listed under it,
slug format), `adoptRevision(...)`, `withdraw(...)`.

Driving ports:

```ts
// packages/catalog/src/ports/driving/index.ts
export type ProductRevisionInput = {
  editorialDocumentId: string; editorialRevision: number;
  sku: string; slug: string; name: string; descriptionHtml: string;
  images: readonly { url: string; alt: string }[]; priceCents: number; taxClass: string;
};
export type RevisionVerdict = { kind: "acceptable" } | { kind: "refused"; violations: readonly RevisionViolation[] };
export type RevisionViolation = { field: "price" | "sku" | "slug" | "taxClass"; code: "not_positive" | "taken" | "malformed" | "frozen" };

export type ReviewProductRevision = (input: ProductRevisionInput) => Promise<RevisionVerdict>;                                 // answering, veto hook
export type AdoptProductRevision  = (m: Incoming<ProductRevisionInput>) => Promise<AdoptionOutcome>;                            // acting
export type WithdrawProduct       = (m: Incoming<{ editorialDocumentId: string; editorialRevision: number }>) => Promise<void>; // acting
export type ReportRevisionOutcome = (m: Incoming<{ editorialDocumentId: string; editorialRevision: number; outcome: AdoptionOutcome }>) => Promise<void>; // acting, executor
export type AdoptionOutcome = { kind: "adopted"; productVersion: number } | { kind: "superseded" } | { kind: "refused"; violations: readonly RevisionViolation[] };
export type Incoming<T> = { messageId: MessageId; body: T };
export type CatalogWebPorts = { reviewProductRevision: ReviewProductRevision };
export type CatalogWorkerPorts = { adoptProductRevision: AdoptProductRevision; withdrawProduct: WithdrawProduct; reportRevisionOutcome: ReportRevisionOutcome };
```

Driven ports:

```ts
export interface Products {
  findById(id: ProductId, tx: CatalogTx): Promise<Product | null>;
  findBySku(sku: Sku, tx: CatalogTx): Promise<Product | null>;
  findByEditorialDocumentId(docId: string, tx: CatalogTx): Promise<Product | null>;
  insert(p: Product, tx: CatalogTx): Promise<void>;          // unique (sku), unique (editorial_document_id)
  save(p: Product, tx: CatalogTx): Promise<void>;            // WHERE version = p.version, else StaleWrite
}
export interface ProductRevisions { insert(r: ProductRevision, tx: CatalogTx): Promise<void> } // unique (editorial_document_id, editorial_revision)
export interface ProductReadModel { findBySku(sku: Sku): Promise<Product | null>; findByEditorialDocumentId(docId: string): Promise<Product | null> } // answering reads, own pool
export interface EditorialProducts { setCatalogStatus(docId: string, revision: number, status: CatalogStatus): Promise<void> }
export type CatalogStatus = { state: "live" | "withdrawn" } | { state: "refused"; messages: readonly string[] };
// plus CatalogUnitOfWork, CatalogOutbox, CatalogMessageClaims, Clock, CatalogIds
```

Adapters:
- driven: `adapters/driven/postgres/{schema.ts,tx.ts,products.ts,product-revisions.ts,product-read-model.ts,outbox.ts,message-claims.ts,outbox-reader.ts}`; `adapters/driven/payload-rest/editorial-products.ts` (`PATCH {PAYLOAD_URL}/api/products/:id` with `Authorization: users API-Key ...` of `catalog-service`, body `{ catalogStatus, catalogStatusRevision }`; the request is a set, so its repeat changes nothing).
- driving: `adapters/driving/payload/veto-hook.ts` (`CollectionBeforeChangeHook` from `payload`; translates the document into `ProductRevisionInput`, reads `catalogWebCourier.get()` each call, calls `reviewProductRevision`, throws Payload's `ValidationError` with one entry per violation; hands catalog nothing of `req`); `adapters/driving/bus/{product-document-published.ts,product-document-unpublished.ts,report-revision-outcome.ts}` (the first two parse with `@teashop/cms-language` as `cms.ProductDocumentPublishedV1`, convert Lexical JSON to HTML with `@payloadcms/richtext-lexical/html`, and hand catalog its own `ProductRevisionInput`).

### shop

Domain: `Cart`, `Order`, `Customer`, `ProductOffer` (replica), `PaymentStanding` (replica),
`placeOrder(...)`, `canPayByInvoice(standing)`, `CARD_PAYMENT_WINDOW_MINUTES = 30`,
`PAYMENT_STATUS_GRACE_MINUTES = 60`, `onLateCardPayment`, `onStockShortfall`,
`onDispatchAfterCancellation`, `MAIL_REPEAT_ACCEPTED` (with the rule's text).

Driving ports:

```ts
// packages/shop/src/ports/driving/index.ts
export type BrowseProducts      = () => Promise<readonly ProductOfferView[]>;
export type ShowProduct         = (input: { slug: Slug }) => Promise<ProductOfferView | null>;
export type ShowCart            = (input: { cartId: CartId }) => Promise<CartView>;
export type ShowCheckoutOptions = (input: { cartId: CartId; email: EmailAddress }) => Promise<CheckoutOptions>;
export type AddToCart           = (input: { cartId: CartId | null; sku: Sku; quantity: Quantity }) => Promise<CartView>;
export type ChangeCartLine      = (input: { cartId: CartId; sku: Sku; quantity: number }) => Promise<CartView>;
export type PlaceOrder          = (input: {
  cartId: CartId; email: EmailAddress; shippingAddress: PostalAddress;
  paymentMethod: "card" | "invoice"; locale: "de" | "en";
}) => Promise<
  | { kind: "placed"; orderId: OrderId; card: { clientSecret: ClientSecret } | null }
  | { kind: "refused"; reason: "cart_empty" | "product_not_listed" | "invoice_not_offered" | "card_amount_not_accepted" }>;
export type RequestRefund       = (input: { orderId: OrderId; actor: Actor }) => Promise<{ kind: "requested"; refundId: RefundId } | { kind: "refused"; reason: "not_permitted" | "not_card_paid" | "refund_open" }>;
export type ListOrdersForOps    = (input: { actor: Actor; page: number; filter: OpsOrderFilter }) => Promise<OpsOrderPage>;
export type RaisePaymentDeadlineNotices = () => Promise<{ raised: number }>;            // acting: writes notices to outbox

export type ApplyProductChange           = (m: Incoming<ProductChange>) => Promise<void>;
export type ApplyPaymentStanding         = (m: Incoming<{ customerId: CustomerId; inDunning: boolean; sourceVersion: number }>) => Promise<void>;
export type RecordCardPaymentSucceeded   = (m: Incoming<{ orderId: OrderId }>) => Promise<CardPaymentRecordOutcome>;
export type ExpireUnpaidOrder            = (m: Incoming<{ orderId: OrderId }>) => Promise<ExpiryOutcome>;
export type CancelForStockShortfall      = (m: Incoming<{ orderId: OrderId }>) => Promise<void>;
export type RecordInvoiceSettled         = (m: Incoming<{ orderId: OrderId }>) => Promise<void>;
export type RecordShipmentDispatched     = (m: Incoming<{ orderId: OrderId; shipmentVersion: number }>) => Promise<void>;
export type RecordShipmentBookingRefused = (m: Incoming<{ orderId: OrderId; reason: string }>) => Promise<void>;
export type RecordRefundCompleted        = (m: Incoming<{ orderId: OrderId; refundId: RefundId }>) => Promise<void>;
export type RecordRefundRefused          = (m: Incoming<{ orderId: OrderId; refundId: RefundId; reason: "charge_disputed" | "provider_declined" }>) => Promise<void>;
export type SendOrderConfirmation        = (m: Incoming<OrderConfirmationRequest>) => Promise<void>;   // executor
export type RevalidateStorefront         = (m: Incoming<{ tags: readonly StorefrontTag[] }>) => Promise<void>; // executor
```

Driven ports:

```ts
export interface Carts { get(id: CartId, tx: ShopTx): Promise<Cart | null>; insert(c: Cart, tx: ShopTx): Promise<void>; save(c: Cart, tx: ShopTx): Promise<void> }
export interface Orders {
  get(id: OrderId, tx: ShopTx): Promise<Order | null>;
  insert(o: Order, tx: ShopTx): Promise<void>;
  save(o: Order, tx: ShopTx): Promise<void>;                                   // version compare
  awaitingCardPaymentPastDeadline(now: Date, limit: number, tx: ShopTx): Promise<readonly OrderId[]>;
}
export interface Customers { findByEmail(email: EmailAddress, tx: ShopTx): Promise<Customer | null>; insert(c: Customer, tx: ShopTx): Promise<void> } // unique (email)
export interface ProductOffers {
  getBySkus(skus: readonly Sku[], tx: ShopTx): Promise<ReadonlyMap<Sku, ProductOffer>>;
  applyIfNewer(o: ProductOffer, tx: ShopTx): Promise<"applied" | "older">;  // ON CONFLICT (sku) DO UPDATE ... WHERE source_version < excluded.source_version
}
export interface PaymentStandings {
  get(customerId: CustomerId, tx: ShopTx): Promise<PaymentStanding>;          // absent row = not in dunning
  applyIfNewer(s: PaymentStanding, tx: ShopTx): Promise<"applied" | "older">;
}
export interface StorefrontQueries { listed(): Promise<readonly ProductOfferView[]>; bySlug(slug: Slug): Promise<ProductOfferView | null>; cart(id: CartId): Promise<CartView>; standing(email: EmailAddress): Promise<PaymentStanding> }
export interface OpsOrderQueries { page(filter: OpsOrderFilter, page: number): Promise<OpsOrderPage> }
export interface CardPaymentGateway {                                          // shop's terms; adapter calls payment's open host service
  request(input: { orderId: OrderId; amount: Money; email: EmailAddress }): Promise<{ kind: "requested"; clientSecret: ClientSecret } | { kind: "refused"; reason: "amount_not_accepted" }>;
  status(orderId: OrderId): Promise<"paid" | "not_paid" | "unknown">;
}
export interface PaymentRequests {                                             // shop's terms; adapter writes payment's commands to shop's outbox
  refund(r: { refundId: RefundId; orderId: OrderId; reason: "customer_request" | "order_cancelled" | "late_payment" }, tx: ShopTx): Promise<void>;
  cancelCardPayment(r: { orderId: OrderId }, tx: ShopTx): Promise<void>;
}
export interface OrderConfirmationMailer { send(mail: OrderConfirmationRequest): Promise<void> }
export interface StorefrontCache { revalidate(tags: readonly StorefrontTag[]): Promise<void> }
// plus ShopUnitOfWork, ShopOutbox, ShopMessageClaims, Clock, ShopIds
```

`placeOrder`, the one service shown in full because every other acting service has its shape:

```ts
// packages/shop/src/service/place-order.ts
export const placeOrderService = (d: {
  uow: ShopUnitOfWork; carts: Carts; orders: Orders; customers: Customers; offers: ProductOffers;
  standings: PaymentStandings; cardPayments: CardPaymentGateway; outbox: ShopOutbox; clock: Clock; ids: ShopIds;
}): PlaceOrder => (input) => d.uow.run(async (tx) => {
  const cart = await d.carts.get(input.cartId, tx);
  const offers = await d.offers.getBySkus(cart?.skus() ?? [], tx);
  const customer = (await d.customers.findByEmail(input.email, tx)) ?? Customer.create(d.ids.customerId(), input.email);
  const standing = await d.standings.get(customer.id, tx);
  const decision = Order.place({ id: d.ids.orderId(), cart, offers, customer, standing, input, now: d.clock.now() });
  if (decision.kind === "refused") return decision;                     // nothing written, tx commits empty
  let card: { clientSecret: ClientSecret } | null = null;
  if (decision.order.paymentMethod === "card") {                       // tentative operation, beside the tx, no tx passed
    const r = await d.cardPayments.request({ orderId: decision.order.id, amount: decision.order.total, email: input.email });
    if (r.kind === "refused") return { kind: "refused", reason: "card_amount_not_accepted" } as const;
    card = { clientSecret: r.clientSecret };
  }
  if (customer.isNew) await d.customers.insert(customer, tx);
  await d.orders.insert(decision.order, tx);
  await d.carts.save(decision.cart, tx);                                // checked out; version compare
  await d.outbox.add(decision.messages(d.ids), tx);                     // OrderPlaced, SendOrderConfirmation; OrderReleasedForShipment too for an invoice order
  return { kind: "placed", orderId: decision.order.id, card } as const;
});
```

Adapters:
- driven: `adapters/driven/postgres/{schema.ts,tx.ts,carts.ts,orders.ts,customers.ts,product-offers.ts,payment-standings.ts,storefront-queries.ts,ops-order-queries.ts,outbox.ts,message-claims.ts,outbox-reader.ts}`; `adapters/driven/payment-system/card-payment-gateway.ts` (anti-corruption: imports `@teashop/payment/ports` and `@teashop/payment/published-language` as namespaces, calls `CardPaymentDesk`, maps `"succeeded"` to `"paid"`, `"pending" | "failed" | "cancelled"` to `"not_paid"`, `"not_found"` to `"unknown"`); `adapters/driven/payment-system/payment-requests.ts` (builds `payment.RefundCardPaymentV1` and `payment.CancelCardPaymentV1` with payment's schema and writes them with `pgOutboxWriter` into shop's outbox); `adapters/driven/postmark/order-confirmation-mailer.ts` (Postmark template `order-confirmation`, locale from the message); `adapters/driven/next-revalidate/storefront-cache.ts` (`POST {WEB_INTERNAL_URL}/api/internal/revalidate` with bearer token) and its server half `adapters/driven/next-revalidate/route.ts` (calls `revalidateTag` for each tag; part of the same driven adapter, deployed in `web`).
- driving: `adapters/driving/next/{storefront-pages.tsx,cart-actions.ts,checkout-action.ts,ops-orders-page.tsx,refund-action.ts,courier.ts}` (`checkout-action.ts` is `"use server"`, parses the form with the domain's `PlaceOrderInputSchema`, calls `placeOrder` once, returns `{ orderId, clientSecret }` or the refusal; storefront pages use `"use cache"` with `cacheTag("products")` and `cacheTag("product:" + slug)`); `adapters/driving/bus/*.ts` (one per subscription below); `adapters/driving/schedule/payment-deadline-task.ts` (every minute, calls `raisePaymentDeadlineNotices` once).

### payment

Domain: `CardPayment` (status `pending → succeeded | failed | cancelled`, `failed → succeeded`
allowed, `succeeded` terminal; `disputed` set-only), `Refund` (`requested → executing → succeeded |
refused`), `MIN_CARD_AMOUNT_CENTS = 50`, `CARD_PAYMENT_EXPIRY_MINUTES = 120`, `canRefund(payment)`
(not disputed, succeeded, no open refund).

Open host service, on the offer (`@teashop/payment/ports`, types from `@teashop/payment/published-language`):

```ts
// packages/payment/src/published-language/card-payment-desk.ts
export const StartCardPaymentInputV1 = z.object({ orderId: z.string().uuid(), amountCents: z.number().int().positive(), currency: z.literal("EUR"), email: z.string().email() });
export type StartCardPaymentInputV1 = z.infer<typeof StartCardPaymentInputV1>;
export type StartCardPaymentResultV1 = { kind: "started"; clientSecret: string } | { kind: "refused"; reason: "amount_below_minimum" };
export type CardPaymentStatusV1 = "pending" | "succeeded" | "failed" | "cancelled" | "not_found";

// packages/payment/src/ports/driving/card-payment-desk.ts  (exported as @teashop/payment/ports)
export interface CardPaymentDesk {
  startCardPayment(input: pl.StartCardPaymentInputV1): Promise<pl.StartCardPaymentResultV1>;   // acting: commits CardPayment(pending), creates the Stripe intent
  getCardPaymentStatus(input: { orderId: string }): Promise<pl.CardPaymentStatusV1>;           // answering: asks Stripe for the intent's live status
}
```

Fake on the offer: `@teashop/payment/fakes` exports `FakeCardPaymentDesk` (table of order id to
status, `clientSecret` = `"pi_fake_" + orderId + "_secret"`, refuses below 50 cents).

Internal driving ports:

```ts
export type RecordStripeEvent = (m: Incoming<
  | { kind: "intent_succeeded"; intentRef: string }
  | { kind: "intent_failed"; intentRef: string }
  | { kind: "dispute_opened"; intentRef: string }
  | { kind: "refund_updated"; providerRefundRef: string; status: "succeeded" | "failed" }>) => Promise<void>;
export type AcceptRefundRequest     = (m: Incoming<{ refundId: string; orderId: string; reason: string }>) => Promise<void>; // decides, may refuse
export type ExecuteStripeRefund     = (m: Incoming<{ refundId: RefundId }>) => Promise<"succeeded" | "refused">;            // executor
export type CancelCardPayment       = (m: Incoming<{ orderId: string }>) => Promise<void>;                                 // decides
export type ExecuteIntentCancellation = (m: Incoming<{ paymentId: PaymentId }>) => Promise<void>;                          // executor
export type RaiseExpiryNotices      = () => Promise<{ raised: number }>;
export type ExpireCardPayment       = (m: Incoming<{ paymentId: PaymentId }>) => Promise<void>;
```

Driven ports:

```ts
export interface CardPayments { byOrderId(id: OrderRef, tx: PaymentTx): Promise<CardPayment | null>; byIntentRef(ref: IntentRef, tx: PaymentTx): Promise<CardPayment | null>; insert(p: CardPayment, tx: PaymentTx): Promise<void>; save(p: CardPayment, tx: PaymentTx): Promise<void>; pendingPastExpiry(now: Date, limit: number, tx: PaymentTx): Promise<readonly PaymentId[]> }
export interface Refunds { get(id: RefundId, tx: PaymentTx): Promise<Refund | null>; byProviderRef(ref: string, tx: PaymentTx): Promise<Refund | null>; openForPayment(id: PaymentId, tx: PaymentTx): Promise<Refund | null>; insert(r: Refund, tx: PaymentTx): Promise<void>; save(r: Refund, tx: PaymentTx): Promise<void> }
export interface CardProvider {                                               // payment's terms; adapter speaks Stripe
  createIntent(i: { paymentId: PaymentId; orderRef: OrderRef; amount: Money; email: string; idempotencyKey: string }): Promise<{ intentRef: IntentRef; clientSecret: string }>;
  intentStatus(ref: IntentRef): Promise<"pending" | "succeeded" | "failed" | "cancelled">;
  refund(r: { intentRef: IntentRef; amount: Money; idempotencyKey: string }): Promise<{ kind: "succeeded"; providerRefundRef: string } | { kind: "refused"; reason: "charge_disputed" | "provider_declined" }>;
  cancelIntent(ref: IntentRef, idempotencyKey: string): Promise<void>;
}
// plus PaymentUnitOfWork, PaymentOutbox, PaymentMessageClaims, Clock, PaymentIds
```

Adapters: driven `postgres/*`, `stripe/card-provider.ts` (Stripe client built in the builder from
`STRIPE_SECRET_KEY`; idempotency keys: `create-intent:{orderId}`, `refund:{refundId}`,
`cancel-intent:{paymentId}`; maps Stripe error code `charge_disputed` to the refusal, every other
`StripeCardError` on refund to `provider_declined`, everything else thrown). Driving:
`next/stripe-webhook-route.ts` (`POST`, `stripe.webhooks.constructEvent` with the raw body, routes
four event types to `recordStripeEvent` with `messageId = event.id`, answers 200 for other types,
400 for a bad signature, 500 when the call throws); `bus/*.ts`; `schedule/expiry-task.ts`
(every 15 minutes).

### billing

Domain: `Invoice`, `CreditNote`, `NumberSeries` (`next()` gapless; series `INV-{yyyy}`, `CN-{yyyy}`
by the Europe/Berlin year), `vatRatePercent(taxClass)` (`tea` 7, `accessories` 19),
`INVOICE_DUE_DAYS = 14`, dunning schedule (`reminder_1` at due + 7 days, `reminder_2` at + 14,
`final_notice` at + 28, final notice accepted as the end of automatic dunning and handed to ops),
`matchTransfer(transfer, openInvoices)` (invoice number in the remittance text and amount not above
the open amount; otherwise unmatched), `MAIL_REPEAT_ACCEPTED`.

Driving ports:

```ts
export type IssueInvoiceForOrder   = (m: Incoming<BillableOrder & { trigger: "placed" | "paid" }>) => Promise<{ invoiceNumber: string } | { skipped: "card_not_yet_paid" | "invoice_order_already_invoiced" }>;
export type CancelInvoiceForOrder  = (m: Incoming<{ orderRef: OrderRef }>) => Promise<void>;      // credit note for an invoice-paid order cancelled before payment
export type IssueCreditNoteForRefund = (m: Incoming<{ orderRef: OrderRef; refundRef: string; amount: Money }>) => Promise<void>;
export type IntakeBankTransfers    = (input: { transfers: readonly PolledTransfer[] }) => Promise<{ queued: number }>;  // acting: one private message per transfer
export type ApplyIncomingTransfer  = (m: Incoming<PolledTransfer>) => Promise<"applied" | "unmatched">;
export type AssignTransferToInvoice = (input: { actor: Actor; transferId: TransferId; invoiceNumber: string }) => Promise<{ kind: "assigned" } | { kind: "refused"; reason: "not_permitted" | "amount_exceeds_open" | "invoice_settled" }>;
export type ScheduleDunning        = (input: { runDate: BusinessDate }) => Promise<{ queued: number }>; // acting: one DunningDue per customer with an overdue invoice
export type AdvanceDunning         = (m: Incoming<{ customerRef: CustomerRef; runDate: BusinessDate }>) => Promise<void>;
export type SendInvoiceMail        = (m: Incoming<{ invoiceId: InvoiceId }>) => Promise<void>;   // executor
export type SendReminderMail       = (m: Incoming<{ invoiceId: InvoiceId; stage: DunningStage }>) => Promise<void>; // executor
export type ListInvoicesForOps     = (input: { actor: Actor; page: number; filter: OpsInvoiceFilter }) => Promise<OpsInvoicePage>;
export type ListUnmatchedTransfers = (input: { actor: Actor }) => Promise<readonly UnmatchedTransferView[]>;
```

Driven ports: `Invoices` (`get`, `byOrderRef`, `openByCustomer`, `byNumber`, `insert` unique
`(order_ref)` and `(number)`, `save` version compare), `CreditNotes` (`insert` unique
`(refund_ref)` and `(number)`), `NumberSeriesRepo` (`get(key, tx)`, `save` version compare,
`insert` unique `(key)`), `DunningAccounts` (`get`, `insert`, `save`), `IncomingTransfers`
(`insert` unique `(bank_transaction_id)`, `get`, `save`), `OverdueQueries`
(`customersWithOverdue(runDate, tx)`), `BillingOpsQueries`, `InvoiceMailer`, `ReminderMailer`,
plus `BillingUnitOfWork`, `BillingOutbox`, `BillingMessageClaims`, `Clock`, `BillingIds`.

Adapters: driven `postgres/*`, `postmark/{invoice-mailer.ts,reminder-mailer.ts}`. Driving:
`bus/*.ts`; `schedule/bank-poll-task.ts` (every 5 minutes: `GET /accounts/{id}/transactions?bookedFrom=now-3d`
with the bank client built in the builder, parses with its own schema of the bank's response,
calls `intakeBankTransfers` once with all credit transactions); `schedule/dunning-task.ts`
(06:00 Europe/Berlin daily, calls `scheduleDunning` once); `next/{ops-invoices-page.tsx,assign-transfer-action.ts}`.

### fulfillment

Domain: `StockItem.reserve(orderId, qty)` / `release(orderId)`, `FulfillmentOrder` (all-or-nothing
reservation; a cancel that arrives first leaves `cancelled` and the later placement reserves
nothing), `Shipment` (`awaiting_articles → booking → booked → dispatched → delivered`,
`booking_refused`, `overdue`; status moves forward only), `Article` (`pending | registered |
refused`, `awaitingShipments`), `DISPATCH_EXPECTED_HOURS = 48`,
`DUPLICATE_CONSIGNMENT_RACE_ACCEPTED` (the rule text: a consignment created twice by an overlapping
redelivery is cancelled by ops from the shipments page).

Driving ports:

```ts
export type ReserveForOrder       = (m: Incoming<{ orderRef: OrderRef; lines: readonly { sku: Sku; quantity: number }[] }>) => Promise<"reserved" | "short" | "already_cancelled">;
export type ReleaseForOrder       = (m: Incoming<{ orderRef: OrderRef }>) => Promise<void>;
export type CreateShipment        = (m: Incoming<{ orderRef: OrderRef; lines: readonly ShipmentLineInput[]; address: ShippingAddress }>) => Promise<void>;
export type BookShipment          = (m: Incoming<{ shipmentId: ShipmentId }>) => Promise<{ consignmentRef: string } | { refused: string }>; // executor
export type NoteCatalogProduct    = (m: Incoming<{ sku: Sku; name: string; sourceVersion: number }>) => Promise<void>;
export type RegisterArticle       = (m: Incoming<{ sku: Sku }>) => Promise<void>;                     // executor
export type ReleaseShipmentsAwaitingArticle = (m: Incoming<{ sku: Sku }>) => Promise<void>;
export type RecordConsignmentStatus = (m: Incoming<{ consignmentRef: string; status: "dispatched" | "delivered" }>) => Promise<void>;
export type RefreshInventory      = (m: Incoming<{ sku: Sku }>) => Promise<void>;
export type RaiseDispatchDueNotices = () => Promise<{ raised: number }>;
export type CheckOverdueShipment  = (m: Incoming<{ shipmentId: ShipmentId }>) => Promise<void>;
export type ShowStockLevel        = (input: { sku: Sku }) => Promise<{ onHand: number; reserved: number; available: number } | null>;
export type ListShipmentsForOps   = (input: { actor: Actor; page: number; filter: OpsShipmentFilter }) => Promise<OpsShipmentPage>;
```

Driven ports: `StockItems` (`getMany(skus, tx)`, `save` version compare, `insert` unique
`(sku)`), `FulfillmentOrders` (`get`, `insert` unique `(order_ref)`, `save`), `Shipments` (`get`,
`byOrderRef`, `byConsignmentRef`, `insert` unique `(order_ref)`, `save`,
`bookedPastDispatchExpectation(now, limit, tx)`), `Articles` (`getMany`, `insert`, `save`),
`StockQueries`, `ShipmentOpsQueries`, and:

```ts
export interface Warehouse {                                                // fulfillment's terms; adapter speaks the 3PL
  findConsignment(reference: ShipmentId): Promise<{ consignmentRef: string; status: "open" | "dispatched" | "delivered" } | null>;
  createConsignment(c: { reference: ShipmentId; lines: readonly { sku: Sku; quantity: number }[]; address: ShippingAddress }): Promise<{ kind: "created"; consignmentRef: string } | { kind: "refused"; reason: string }>;
  upsertArticle(a: { sku: Sku; name: string }): Promise<{ kind: "registered" } | { kind: "refused"; reason: string }>;
  onHand(sku: Sku): Promise<number>;
}
```

Adapters: driven `postgres/*`, `tpl-http/warehouse.ts` (base URL and key from the builder's
config; 4xx with a validation body maps to `refused`, everything else throws). Driving:
`next/tpl-webhook-route.ts` (HMAC-SHA256 over the raw body; `consignment.status_changed` to
`recordConsignmentStatus`, `inventory.adjusted` to `refreshInventory`, `messageId` = the 3PL's
event id); `payload/stock-field.tsx` (Payload admin UI field, server component, reads
`fulfillmentWebCourier.get()` each render, calls `showStockLevel`); `next/ops-shipments-page.tsx`;
`bus/*.ts`; `schedule/dispatch-due-task.ts` (hourly).

### Builders (offer, imported only by assembly)

```ts
// @teashop/shop/builder
export type ShopConfig = { postmarkToken: string; mailFrom: string; webInternalUrl: string; revalidateToken: string };
export function buildShopForWeb(d: { config: ShopConfig; db: NodePgDatabase; cardPaymentDesk: paymentPorts.CardPaymentDesk }): { fillCourier(): void };
export function buildShopForWorker(d: { config: ShopConfig; db: NodePgDatabase; cardPaymentDesk: paymentPorts.CardPaymentDesk }): {
  subscriptions: readonly BusSubscription[]; scheduled: readonly ScheduledTask[]; outboxReader: OutboxReader };
// @teashop/payment/builder
export function buildPaymentForWeb(d: { config: { stripeSecretKey: string; stripeWebhookSecret: string }; db: NodePgDatabase }): { cardPaymentDesk: CardPaymentDesk; fillCourier(): void };
export function buildPaymentForWorker(d: { config: { stripeSecretKey: string }; db: NodePgDatabase }): { cardPaymentDesk: CardPaymentDesk; subscriptions: readonly BusSubscription[]; scheduled: readonly ScheduledTask[]; outboxReader: OutboxReader };
// catalog, billing, fulfillment: same pair, config of their own (Payload URL + catalog-service key; bank URL, account, key, Postmark; 3PL URL, key, webhook secret).
```

`fillCourier()` writes the system's driving ports into its courier slot
(`createCourier<ShopWebPorts>("teashop.shop.web")`, a `globalThis` slot keyed by
`Symbol.for(...)`; `get()` throws `CourierEmpty` until filled). The slot module sits in the
system's `adapters/driving/next/courier.ts`; only the builder imports its `fill`.

## Calls and messages

### Synchronous calls

| From | To | Port | Process | Why it waits | Refusal comes back as | Failure comes back as |
|---|---|---|---|---|---|---|
| shop `placeOrder` | payment | `CardPaymentDesk.startCardPayment` (via shop's `CardPaymentGateway`) | `web`, in-process, no transaction passed | the browser needs `client_secret` in the checkout response | `{ kind: "refused", reason: "amount_below_minimum" }`, mapped to `card_amount_not_accepted`; shop's tx commits nothing | thrown error; shop's tx rolls back; server action answers 503 |
| shop `expireUnpaidOrder` | payment | `CardPaymentDesk.getCardPaymentStatus` (via `CardPaymentGateway.status`) | `worker`, in-process | rule: at the deadline, ask whether the card was paid before cancelling | none (answering) | thrown; before deadline + 60 min the use case fails and is redelivered; after, the rule cancels without the answer |
| payment `startCardPayment`, `getCardPaymentStatus`, executors | Stripe | `CardProvider` | `web`, `worker` | tentative operation now; status at the deadline; the change a message asks for | `charge_disputed` / `provider_declined` result values | thrown |
| Payload `beforeChange` | catalog | `reviewProductRevision` via veto hook | `web`, in-process, `req` not passed | the editor's save is vetoed before Payload writes | `ValidationError` thrown into Payload, shown on the field | thrown, Payload aborts the save |
| Payload admin field | fulfillment | `showStockLevel` via stock field | `web`, in-process | fulfillment's own store, no other system waited on | none | field renders "stock unavailable" |
| catalog executor | Payload | `EditorialProducts.setCatalogStatus` (REST) | `worker` → `web` | the change `ReportRevisionOutcome` asks for | none (a set) | thrown, redelivered |
| fulfillment executors, `refreshInventory`, `checkOverdueShipment` | 3PL | `Warehouse` | `worker`, `web` (hook) | the change a message asks for; current inventory on an inventory notice; consignment status at the dispatch deadline | `{ kind: "refused", reason }` | thrown |
| billing bank-poll task | bank | (driving adapter's own client) | `worker` | nobody waits; a down bank delays the poll | n/a | task logs, next tick retries |
| shop and billing mail executors | Postmark | `OrderConfirmationMailer`, `InvoiceMailer`, `ReminderMailer` | `worker` | the change a message asks for | n/a | thrown, redelivered |
| shop executor | `web` | `StorefrontCache.revalidate` (internal HTTP) | `worker` → `web` | the change a message asks for | n/a | thrown, redelivered |
| Stripe | payment | hook `/api/webhooks/stripe` | `web` | Stripe's delivery | 400 on bad signature | 500, Stripe resends |
| 3PL | fulfillment | hook `/api/webhooks/3pl` | `web` | 3PL's delivery | 401 on bad HMAC | 500, 3PL resends |

No call between systems carries a transaction. Shop is the only system that calls another system
of this codebase synchronously, and only payment.

### Messages

All go writer's outbox → relay → pg-boss → handler. Id column: how the id is made; it is stored in
the outbox row and is the same on every delivery.

| Message | Kind | Writer | Subscribers (queue → use case) | Version of the thing | Id |
|---|---|---|---|---|---|
| `cms.ProductDocumentPublished` v1 | event (Payload's, written in Payload's tx by Payload config) | Payload | `catalog.adoptProductRevision` | `revision` (configured into Payload, raised in `beforeChange`) | `crypto.randomUUID()` in the hook |
| `cms.ProductDocumentUnpublished` v1 | event | Payload | `catalog.withdrawProduct` | `revision` | uuid |
| `catalog.ProductChanged` v1 | published event | catalog | `shop.applyProductChange`, `fulfillment.noteCatalogProduct` | `Product.version` | uuidv7 |
| `catalog.ReportRevisionOutcome` v1 | private command | catalog | `catalog.reportRevisionOutcome` | — | uuidv7 |
| `shop.OrderPlaced` v1 (order id, customer, email, billing address, lines with sku, quantity, unit gross price, tax class, payment method) | published event | shop | `fulfillment.reserveForOrder`, `billing.issueInvoiceForOrder` (acts on `paymentMethod = "invoice"`) | — (one per order) | uuidv7 |
| `shop.OrderPaid` v1 (same snapshot as `OrderPlaced`) | published event | shop | `billing.issueInvoiceForOrder` (acts on `"card"`) | — | uuidv7 |
| `shop.OrderReleasedForShipment` v1 (lines, address) | published event | shop | `fulfillment.createShipment` | — | uuidv7 |
| `shop.OrderCancelled` v1 | published event | shop | `fulfillment.releaseForOrder`, `billing.cancelInvoiceForOrder` | — | uuidv7 |
| `payment.RefundCardPayment` v1 | command (payment's published language) | shop, through `PaymentRequests` | `payment.acceptRefundRequest` | — | `refund:{refundId}` |
| `payment.CancelCardPayment` v1 | command | shop | `payment.cancelCardPayment` | — | `cancel-card:{orderId}` |
| `shop.SendOrderConfirmation` v1 | private command | shop | `shop.sendOrderConfirmation` | — | uuidv7 |
| `shop.RevalidateStorefront` v1 | private command | shop | `shop.revalidateStorefront` | — | uuidv7 |
| `shop.PaymentDeadlinePassed` v1 | private event | shop (`raisePaymentDeadlineNotices`) | `shop.expireUnpaidOrder` | — | `deadline:{orderId}` (insert does nothing on conflict) |
| `payment.CardPaymentSucceeded` v1 | published event | payment | `shop.recordCardPaymentSucceeded` | `CardPayment.version` | uuidv7 |
| `payment.CardRefunded` v1 | published event | payment | `shop.recordRefundCompleted`, `billing.issueCreditNoteForRefund` | — | uuidv7 |
| `payment.RefundRefused` v1 | published event | payment | `shop.recordRefundRefused` | — | uuidv7 |
| `payment.ExecuteStripeRefund` v1, `payment.CancelStripeIntent` v1 | private commands | payment | `payment.executeStripeRefund`, `payment.executeIntentCancellation` | — | uuidv7 |
| `payment.CardPaymentExpiryDue` v1 | private event | payment | `payment.expireCardPayment` | — | `expiry:{paymentId}` |
| `billing.InvoiceSettled` v1 | published event | billing | `shop.recordInvoiceSettled` | — | uuidv7 |
| `billing.CustomerPaymentStandingChanged` v1 (`customerId`, `stage`) | published event | billing | `shop.applyPaymentStanding` | `DunningAccount.version` | uuidv7 |
| `billing.BankTransferReceived` v1 | private event | billing (`intakeBankTransfers`) | `billing.applyIncomingTransfer` | — | `bank:{bankTransactionId}` |
| `billing.DunningDue` v1 | private event | billing (`scheduleDunning`) | `billing.advanceDunning` | — | `dunning:{customerId}:{runDate}` |
| `billing.SendInvoiceMail` v1, `billing.SendReminderMail` v1 | private commands | billing | billing executors | — | uuidv7 |
| `fulfillment.StockShortfall` v1 | published event | fulfillment | `shop.cancelForStockShortfall` | — | uuidv7 |
| `fulfillment.ShipmentDispatched` v1 | published event | fulfillment | `shop.recordShipmentDispatched` | `Shipment.version` | uuidv7 |
| `fulfillment.ShipmentBookingRefused` v1 | published event | fulfillment | `shop.recordShipmentBookingRefused` | — | uuidv7 |
| `fulfillment.BookShipment` v1, `fulfillment.RegisterArticle` v1 | private commands | fulfillment | fulfillment executors | — | uuidv7 |
| `fulfillment.ArticleRegistered` v1 | private event | fulfillment (`registerArticle`) | `fulfillment.releaseShipmentsAwaitingArticle` | — | uuidv7 |
| `fulfillment.ShipmentDispatchDue` v1 | private event | fulfillment | `fulfillment.checkOverdueShipment` | — | `dispatch-due:{shipmentId}` |

Stripe events and 3PL webhooks reach their hooks directly, not through the bus; their ids are
Stripe's `event.id` and the 3PL's `eventId`.

Integration style: choreography. Each system reacts to the others' events; the only commands
between systems are shop's two commands to payment. No process manager.

### How a refusal comes back

- Synchronous call: a typed `{ kind: "refused", reason }` result, never an exception; exceptions mean failure.
- Command to another system: the receiver commits the refusal as the step's outcome and publishes
  an event in its own published language naming no sender (`payment.RefundRefused`); the sender's
  handler ends its part by a business rule (shop marks the refund refused, order flagged for ops).
- An event cannot be refused. Where the receiver cannot do what it implies, it commits its outcome
  and publishes it (`fulfillment.StockShortfall`, `fulfillment.ShipmentBookingRefused`).
- Payload's save: veto hook throws `ValidationError`. A refusal at adoption (sku raced) is committed
  as `ProductRevision` refused and reported back into Payload's `catalogStatus` by the executor.
- A failure (store down, `StaleWrite`, bug, partner down) throws: no commit, no ack, pg-boss retries
  with backoff (`retryLimit: 12`, `retryDelay: 10`, `retryBackoff: true`, about 11 hours), then
  moves the job to `<queue>__dlq`, which the worker exports as metric `bus_dead_letter_depth`.

## Processes

### `web` (Next.js standalone server, N replicas)

Entry: `apps/web/instrumentation.ts`:

```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("@teashop/lib/telemetry/node-sdk");
  startTelemetry({ serviceName: "teashop-web" });          // NodeSDK, OTLP → Jaeger, Prometheus reader
  const { readWebConfig } = await import("./src/assembly/config");
  const { assembleWeb } = await import("./src/assembly/web-assembly");
  assembleWeb(readWebConfig(process.env));
}
```

`assembleWeb` (`apps/web/src/assembly/web-assembly.ts`) does, in order: one `pg.Pool` per system
role (`max: 5`) and one probe pool (`max: 1`); `buildPaymentForWeb` (returns `cardPaymentDesk`);
`buildShopForWeb({ cardPaymentDesk })`; `buildCatalogForWeb`; `buildBillingForWeb`;
`buildFulfillmentForWeb`; each `fillCourier()`; `fillProbeCourier({ ping })`. Payload is built by
Payload's own Next integration from `@teashop/cms/config` (its own pool, role `teashop_payload`);
the catalog veto hook and fulfillment stock field that its config names read their couriers, which
`register()` has filled before the server accepts a request.

Ways in: storefront and cart pages and server actions (shop), checkout server action (shop),
`/ops/orders` and refund action (shop), `/ops/invoices` and assign-transfer action (billing),
`/ops/shipments` (fulfillment), `/api/webhooks/stripe` (payment), `/api/webhooks/3pl`
(fulfillment), Payload admin `/admin` and Payload REST `/api/payload/*` (Payload, with catalog's
hook and fulfillment's field inside), `/api/internal/revalidate` (server half of shop's
`StorefrontCache` adapter), `/health` and `/metrics` (probes). Request id: a `withRequestContext`
wrapper from `@teashop/lib/telemetry` around every route handler and server action reads
`x-request-id` or makes one, and runs the call inside the `AsyncLocalStorage` request context that
pino's `mixin` and the outbox writer read; OpenTelemetry's HTTP and Next instrumentation carry
`traceparent`.

### `worker` (Node, N replicas)

Entry: `node --import ./dist/otel.js ./dist/main.js` (`apps/worker/src/otel.ts` starts NodeSDK
before anything else loads). `apps/worker/src/main.ts`:

```ts
const config = readWorkerConfig(process.env);
const w = await assembleWorker(config);
await w.bus.start(w.subscriptions);           // pg-boss: createQueue per subscription with deadLetter, subscribe(type, queue), work(queue, handler)
w.relay.start({ intervalMs: 500, batch: 100 });
await w.scheduler.start(w.scheduledTasks);    // pg-boss schedule(name, cron, { tz })
startProbeServer({ port: 9464, ping: w.ping, metrics: w.metricsHandler });
onSignal("SIGTERM", async () => { w.relay.stop(); await w.bus.stop({ graceful: true, timeout: 30_000 }); await w.closePools(); });
```

`assembleWorker` builds pools, then `buildPaymentForWorker` (its `cardPaymentDesk` handed to shop),
`buildShopForWorker`, `buildCatalogForWorker`, `buildBillingForWorker`,
`buildFulfillmentForWorker`, collects their `subscriptions`, `scheduled` and `outboxReader`s, adds
`payloadOutboxReader(payloadPool)` (`apps/worker/src/assembly/payload-outbox-reader.ts`, reads
Payload's `payload.outbox` table), and constructs `createRelay(readers, bus)` and
`createPgBossBus(busPool)` from the common library.

Relay loop per reader: `fetchUnsent(100)` opens a transaction on the reader's own pool, `SELECT ...
WHERE sent_at IS NULL ORDER BY written_seq LIMIT 100 FOR UPDATE SKIP LOCKED`; the relay
`bus.publish(envelope)` for each (pg-boss `publish`, which inserts one job per subscribed queue,
`singletonKey` = envelope id + queue); then `markSent()` sets `sent_at` and commits. A crash
between publish and mark republishes; handlers' claims absorb it. Sent rows are deleted after 30
days by a common-library maintenance task.

Bus handler wrapper (common library): extracts `traceparent` with the W3C propagator, starts a
consumer span, runs the subscription inside the request context with the envelope's `requestId`,
calls `handle`, rethrows on error.

### `migrate` (one-off job before each deploy)

`apps/migrate/src/main.ts`, tooling, run with the owner roles:
1. `infra/sql/roles.sql` (idempotent): schemas `catalog`, `shop`, `payment`, `billing`,
   `fulfillment`, `payload`, `pgboss`; per schema an owner role `teashop_<s>_owner` and an app role
   `teashop_<s>_app` with `USAGE` and DML on its own schema only; `teashop_probe` with `CONNECT`
   only.
2. `drizzle-orm/node-postgres/migrator` for each system's `packages/<s>/drizzle/` with its owner role.
3. `payload migrate` for `packages/cms/migrations/`.
4. pg-boss schema migration (`new PgBoss({ schema: "pgboss", migrate: true }).start()` then `stop()`).

Release discipline (P14): a release only adds (nullable column, new table, new message version
beside the old); dropping or tightening ships in a later release, once no process of the previous
image runs and the outboxes and dead-letter queues hold no message in the old version.

### Configuration

Read once per process by `apps/*/src/assembly/config.ts` with a zod schema; nothing else reads
`process.env`. Values: one `DATABASE_URL_<SYSTEM>` per role, `DATABASE_URL_PAYLOAD`,
`DATABASE_URL_BUS`, `DATABASE_URL_PROBE`, `PAYLOAD_SECRET`, `PAYLOAD_URL`,
`CATALOG_SERVICE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TPL_BASE_URL`,
`TPL_API_KEY`, `TPL_WEBHOOK_SECRET`, `BANK_BASE_URL`, `BANK_ACCOUNT_ID`, `BANK_API_KEY`,
`POSTMARK_TOKEN`, `MAIL_FROM`, `WEB_INTERNAL_URL`, `REVALIDATE_TOKEN`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_LEVEL`. No business number among them.

## Directory tree

```
teashop/
├── package.json                       # scripts: check, test, test:integration, test:e2e, build
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── biome.json                         # noExplicitAny: error
├── .dependency-cruiser.cjs            # layer and offer rules, generated allowances from upstreams.json
├── sgconfig.yml
├── rules/                             # ast-grep
│   ├── no-env-outside-assembly.yml
│   ├── no-ambient-transaction.yml
│   ├── no-clock-or-random-in-core.yml
│   ├── upstream-namespace-import.yml
│   ├── courier-read-per-call.yml
│   ├── no-domain-double.yml
│   └── no-client-at-module-load.yml
├── docker-compose.yml                 # postgres:16, jaeger all-in-one
├── infra/sql/roles.sql
├── tools/schema-compat/
│   ├── check.ts                       # zod → JSON Schema per message version, diff against snapshots
│   └── snapshots/<system>/<Message>.v<n>.json
├── scripts/
│   ├── seed-dev.ts
│   └── replay-dead-letters.ts
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts             # withPayload, transpilePackages: @teashop/*
│   │   ├── instrumentation.ts
│   │   └── src/
│   │       ├── assembly/
│   │       │   ├── config.ts
│   │       │   └── web-assembly.ts
│   │       └── app/
│   │           ├── layout.tsx                         # app shell
│   │           ├── (shop)/page.tsx                    # re-exports shop's storefront page
│   │           ├── (shop)/products/[slug]/page.tsx
│   │           ├── (shop)/cart/page.tsx
│   │           ├── (shop)/checkout/page.tsx
│   │           ├── (shop)/ops/orders/page.tsx
│   │           ├── (shop)/api/internal/revalidate/route.ts
│   │           ├── (billing)/ops/invoices/page.tsx
│   │           ├── (fulfillment)/ops/shipments/page.tsx
│   │           ├── (fulfillment)/api/webhooks/3pl/route.ts
│   │           ├── (payment)/api/webhooks/stripe/route.ts
│   │           ├── (ops-shell)/ops/layout.tsx         # links only
│   │           ├── (probes)/health/route.ts
│   │           ├── (probes)/metrics/route.ts
│   │           └── (payload)/admin/[[...segments]]/page.tsx, api/payload/[...slug]/route.ts, importMap.js
│   ├── worker/
│   │   ├── package.json
│   │   └── src/
│   │       ├── otel.ts
│   │       ├── main.ts
│   │       ├── assembly/
│   │       │   ├── config.ts
│   │       │   ├── worker-assembly.ts
│   │       │   └── payload-outbox-reader.ts
│   │       └── probes/server.ts                       # node:http, /health, /metrics on 9464
│   └── migrate/
│       └── src/main.ts
└── packages/
    ├── kernel/
    │   ├── package.json                               # exports "."
    │   ├── tsconfig.json                              # lib ES2023, types []
    │   ├── src/{money.ts,tax-class.ts,sku.ts,index.ts}
    │   └── test/{money.test.ts,tax-class.test.ts,sku.test.ts}
    ├── lib/
    │   ├── package.json                               # exports ./messaging ./outbox ./relay ./bus ./postgres ./claims ./courier ./clock ./ids ./telemetry ./telemetry/node-sdk ./testing
    │   ├── src/
    │   │   ├── messaging/envelope.ts
    │   │   ├── outbox/{outbox-table.ts,pg-outbox-writer.ts,pg-outbox-reader.ts}
    │   │   ├── relay/relay.ts
    │   │   ├── bus/{pg-boss-bus.ts,handler-wrapper.ts,scheduler.ts}
    │   │   ├── postgres/{pool.ts,unit-of-work.ts,pg-tx.ts}
    │   │   ├── claims/{handled-messages-table.ts,pg-message-claims.ts}
    │   │   ├── courier/courier.ts
    │   │   ├── clock/system-clock.ts
    │   │   ├── ids/uuidv7.ts
    │   │   ├── telemetry/{logger.ts,tracer.ts,request-context.ts,with-request-context.ts,node-sdk.ts,metrics.ts}
    │   │   └── testing/{in-memory-transactional-store.ts,fixed-clock.ts}
    │   └── test/ (mirrors src)
    ├── cms-language/                                  # Payload's published language
    │   ├── package.json
    │   └── src/{payload-types.ts,outbox-messages.ts,index.ts}
    ├── cms/                                           # Payload's configuration
    │   ├── package.json                               # exports ./config
    │   ├── migrations/
    │   └── src/
    │       ├── payload.config.ts
    │       ├── collections/{products.ts,media.ts,users.ts,outbox.ts}
    │       ├── hooks/{raise-revision.ts,write-outbox.ts}
    │       └── access/{catalog-service-only.ts,editors.ts}
    ├── catalog/
    │   ├── package.json                               # exports ./published-language ./builder ./payload
    │   ├── GLOSSARY.md
    │   ├── upstreams.json                             # { "cms": "anti-corruption" }
    │   ├── drizzle.config.ts
    │   ├── drizzle/0000_init.sql …
    │   ├── src/
    │   │   ├── domain/{tsconfig.json,product.ts,product-revision.ts,review-revision.ts,schemas.ts,index.ts}
    │   │   ├── published-language/{tsconfig.json,product-changed.v1.ts,index.ts}
    │   │   ├── private-messages/report-revision-outcome.v1.ts
    │   │   ├── ports/driving/index.ts
    │   │   ├── ports/driven/{transaction.ts,errors.ts,clock.ts,ids.ts,outbox.ts,message-claims.ts,products.ts,product-revisions.ts,product-read-model.ts,editorial-products.ts}
    │   │   ├── service/{review-product-revision.ts,adopt-product-revision.ts,withdraw-product.ts,report-revision-outcome.ts,once.ts}
    │   │   ├── adapters/driven/postgres/{schema.ts,tx.ts,products.ts,product-revisions.ts,product-read-model.ts,outbox.ts,message-claims.ts,outbox-reader.ts}
    │   │   ├── adapters/driven/payload-rest/editorial-products.ts
    │   │   ├── adapters/driving/payload/{veto-hook.ts,courier.ts,index.ts}
    │   │   ├── adapters/driving/bus/{product-document-published.ts,product-document-unpublished.ts,report-revision-outcome.ts}
    │   │   ├── fakes/{in-memory-catalog-store.ts,products.ts,product-revisions.ts,outbox.ts,message-claims.ts,unit-of-work.ts,editorial-products.ts}
    │   │   └── builder/index.ts
    │   └── test/
    │       ├── domain/review-revision.test.ts
    │       ├── service/{adopt-product-revision.test.ts,withdraw-product.test.ts,report-revision-outcome.test.ts}
    │       ├── contracts/{products.contract.ts,product-revisions.contract.ts,outbox.contract.ts,message-claims.contract.ts,unit-of-work.contract.ts,editorial-products.contract.ts}
    │       ├── adapters/driving/payload/veto-hook.test.ts
    │       └── domain/loads-everywhere.test.ts
    ├── shop/
    │   ├── package.json                               # exports ./published-language ./builder ./next
    │   ├── GLOSSARY.md
    │   ├── upstreams.json                             # { "catalog": "anti-corruption", "payment": "anti-corruption", "billing": "anti-corruption", "fulfillment": "anti-corruption" }
    │   ├── drizzle/…
    │   ├── src/
    │   │   ├── domain/{tsconfig.json,cart.ts,order.ts,customer.ts,product-offer.ts,payment-standing.ts,place-order.ts,policies.ts,schemas.ts,index.ts}
    │   │   ├── published-language/{order-placed.v1.ts,order-paid.v1.ts,order-released-for-shipment.v1.ts,order-cancelled.v1.ts,index.ts}
    │   │   ├── private-messages/{send-order-confirmation.v1.ts,revalidate-storefront.v1.ts,payment-deadline-passed.v1.ts}
    │   │   ├── ports/driving/index.ts
    │   │   ├── ports/driven/{transaction.ts,errors.ts,clock.ts,ids.ts,outbox.ts,message-claims.ts,carts.ts,orders.ts,customers.ts,product-offers.ts,payment-standings.ts,storefront-queries.ts,ops-order-queries.ts,card-payment-gateway.ts,payment-requests.ts,order-confirmation-mailer.ts,storefront-cache.ts}
    │   │   ├── service/{browse-products.ts,show-product.ts,show-cart.ts,show-checkout-options.ts,add-to-cart.ts,change-cart-line.ts,place-order.ts,request-refund.ts,list-orders-for-ops.ts,raise-payment-deadline-notices.ts,expire-unpaid-order.ts,record-card-payment-succeeded.ts,cancel-for-stock-shortfall.ts,record-invoice-settled.ts,record-shipment-dispatched.ts,record-shipment-booking-refused.ts,record-refund-completed.ts,record-refund-refused.ts,apply-product-change.ts,apply-payment-standing.ts,send-order-confirmation.ts,revalidate-storefront.ts,once.ts}
    │   │   ├── adapters/driven/postgres/{schema.ts,tx.ts,carts.ts,orders.ts,customers.ts,product-offers.ts,payment-standings.ts,storefront-queries.ts,ops-order-queries.ts,outbox.ts,message-claims.ts,outbox-reader.ts}
    │   │   ├── adapters/driven/payment-system/{card-payment-gateway.ts,payment-requests.ts}
    │   │   ├── adapters/driven/postmark/order-confirmation-mailer.ts
    │   │   ├── adapters/driven/next-revalidate/{storefront-cache.ts,route.ts}
    │   │   ├── adapters/driving/next/{courier.ts,storefront-pages.tsx,cart-actions.ts,checkout-action.ts,checkout-form.tsx,ops-orders-page.tsx,refund-action.ts,index.ts}
    │   │   ├── adapters/driving/bus/{product-changed.ts,payment-standing-changed.ts,card-payment-succeeded.ts,payment-deadline-passed.ts,stock-shortfall.ts,invoice-settled.ts,shipment-dispatched.ts,shipment-booking-refused.ts,card-refunded.ts,refund-refused.ts,send-order-confirmation.ts,revalidate-storefront.ts}
    │   │   ├── adapters/driving/schedule/payment-deadline-task.ts
    │   │   ├── fakes/{in-memory-shop-store.ts,carts.ts,orders.ts,customers.ts,product-offers.ts,payment-standings.ts,storefront-queries.ts,ops-order-queries.ts,card-payment-gateway.ts,payment-requests.ts,order-confirmation-mailer.ts,storefront-cache.ts,outbox.ts,message-claims.ts,unit-of-work.ts}
    │   │   └── builder/{index.ts,web.ts,worker.ts}
    │   └── test/ (domain/, service/, contracts/, adapters/ mirroring src)
    ├── payment/
    │   ├── package.json                               # exports ./published-language ./ports ./fakes ./builder ./next
    │   ├── GLOSSARY.md
    │   ├── upstreams.json                             # { "stripe": "anti-corruption", "shop": "anti-corruption" }
    │   ├── drizzle/…
    │   ├── src/
    │   │   ├── domain/{card-payment.ts,refund.ts,policies.ts,schemas.ts,index.ts}
    │   │   ├── published-language/{card-payment-desk.ts,card-payment-succeeded.v1.ts,card-refunded.v1.ts,refund-refused.v1.ts,refund-card-payment.v1.ts,cancel-card-payment.v1.ts,index.ts}
    │   │   ├── private-messages/{execute-stripe-refund.v1.ts,cancel-stripe-intent.v1.ts,card-payment-expiry-due.v1.ts}
    │   │   ├── ports/driving/{card-payment-desk.ts,index.ts}
    │   │   ├── ports/driven/{transaction.ts,…,card-payments.ts,refunds.ts,card-provider.ts}
    │   │   ├── service/{start-card-payment.ts,get-card-payment-status.ts,record-stripe-event.ts,accept-refund-request.ts,execute-stripe-refund.ts,cancel-card-payment.ts,execute-intent-cancellation.ts,raise-expiry-notices.ts,expire-card-payment.ts,once.ts}
    │   │   ├── adapters/driven/postgres/…
    │   │   ├── adapters/driven/stripe/card-provider.ts
    │   │   ├── adapters/driving/next/{courier.ts,stripe-webhook-route.ts}
    │   │   ├── adapters/driving/bus/…
    │   │   ├── adapters/driving/schedule/expiry-task.ts
    │   │   ├── fakes/{fake-card-payment-desk.ts,card-provider.ts,…}
    │   │   └── builder/…
    │   └── test/ (…, contracts/card-payment-desk.contract.ts runs FakeCardPaymentDesk and the real service)
    ├── billing/
    │   ├── package.json                               # exports ./published-language ./builder ./next
    │   ├── GLOSSARY.md
    │   ├── upstreams.json                             # { "shop": "anti-corruption", "payment": "anti-corruption", "bank": "anti-corruption" }
    │   └── src/ domain/{invoice.ts,credit-note.ts,number-series.ts,vat.ts,dunning.ts,transfer-matching.ts,policies.ts}, published-language/{invoice-settled.v1.ts,customer-payment-standing-changed.v1.ts}, upstream/bank/schemas.ts (the bank's transaction list, stated once), private-messages/…, ports/…, service/…, adapters/driven/{postgres,postmark}/…, adapters/driving/{bus,next,schedule}/… (bank-poll-task.ts, dunning-task.ts), fakes/…, builder/…
    └── fulfillment/
        ├── package.json                               # exports ./published-language ./builder ./next ./payload
        ├── GLOSSARY.md
        ├── upstreams.json                             # { "shop": "anti-corruption", "catalog": "anti-corruption", "3pl": "anti-corruption" }
        └── src/ domain/{stock-item.ts,fulfillment-order.ts,shipment.ts,article.ts,policies.ts}, published-language/{stock-shortfall.v1.ts,shipment-dispatched.v1.ts,shipment-booking-refused.v1.ts}, upstream/tpl/schemas.ts (the 3PL's API and webhook shapes, stated once), private-messages/…, ports/…, service/…, adapters/driven/{postgres,tpl-http}/…, adapters/driving/{bus,next,payload,schedule}/…, fakes/…, builder/…
```

The Next route files under `apps/web/src/app/(<system>)/` are one-line re-exports of
`@teashop/<system>/next` (or `/payload`): code of that system wherever the framework wants the file.
dependency-cruiser maps each route group to its system, so the `(shop)` group may import
`@teashop/shop/next` and nothing of another system.

## How each property holds

**P1. The domain models the business domain and is shaped by nothing that serves it.** Holds.
dependency-cruiser rule `domain-closed-list`: a module under `packages/*/src/domain/` may import
its own system's domain, `@teashop/kernel`, and the npm packages `zod`, `date-fns`, `@date-fns/tz`;
every other target is an error, `import type` included (`tsPreCompilationDeps: true`), so
`drizzle-orm`, `payload`, `stripe`, `next`, `@teashop/lib`, the system's own published language,
ports and any other system are refused by default rather than listed. No system conforms, so no
upstream's published language is on any domain's list. Pure: ast-grep `no-clock-or-random-in-core`
fails `Date.now()`, argument-less `new Date()`, `Math.random`, `crypto.*` and `performance.now` in
`src/domain` and `src/service`; the domain takes `now: Date` and ids as arguments. Every runtime:
each `src/domain/tsconfig.json` (and the kernel's) sets `lib: ["ES2023"]` and `types: []`, so
`Buffer`, `process`, `window`, `document` and `node:*` do not compile there;
`test/domain/loads-everywhere.test.ts` bundles each domain with esbuild `platform: "neutral"` and
fails on any unresolved import. Shop's `checkout-form.tsx` imports `PlaceOrderInputSchema` from
shop's domain into the browser bundle, which is the case this guards.

**P2. A business rule lives in one place: the domain.** Holds. Every rule named in the brief is a
function or constant in one domain: price above zero, sku format, sku unique, sku frozen once
listed (catalog `review-revision.ts`); invoice not offered in dunning (shop `canPayByInvoice`);
line snapshot (shop `Order.place`); 30-minute card payment window and 60-minute grace (shop
`policies.ts`); card refundable unless disputed, 50-cent minimum (payment `policies.ts`); VAT 7/19
by tax class, 14-day due, gapless series, dunning schedule, transfer matching (billing); all-or-nothing
reservation, 48-hour dispatch expectation (fulfillment). Payload's `products` collection declares
no `min`, no `unique`, no `validate` on price or sku; its `beforeChange` runs catalog's veto hook,
which asks catalog's domain. Payload's tax-class select takes `TAX_CLASSES` from the kernel instead
of listing them. Driving adapters parse with the domain's schemas (`PlaceOrderInputSchema`,
`AddToCartInputSchema`); Postgres adapters parse loaded rows with the domain's schemas; types are
`z.infer` of those schemas, never declared beside them. Migrations hold primary keys, unique keys
and child-to-root foreign keys only: no `CHECK`, no trigger (a review item on every migration
file). No configuration value carries a business number; the zod config schema has none. Tests run
the real domain: ast-grep `no-domain-double` fails `vi.mock` of any `src/domain` path. Payment's
`StartCardPaymentInputV1` says `amountCents` positive in the contract's own terms (P13's MAY);
the minimum of 50 cents stays in payment's domain.

**P3. Business rules that change together sit together; rules that change for different reasons
stay apart.** Holds. Each rule sits in the domain of the owner of the record it decides: a
product's validity in catalog (Payload decides nothing about catalog's `Product`), an order's
deadline and payment-method eligibility in shop, a reservation in fulfillment (shop asks for no
hold time; fulfillment holds a reservation until `OrderCancelled`), a card payment's refundability
in payment, an invoice's VAT and number in billing, a customer's dunning stage in billing. Shop's
invoice eligibility is shop's rule about shop's own request, deciding by shop's replica of
billing's stage; billing decides the stage. The kernel holds `Money`, `TaxClass` and `Sku` as
values and their arithmetic or parsing, no rate, no record schema; the VAT rate per class is
billing's. The common library holds no rule; its envelope's `payload` is `unknown`.

**P4. A use case responds the same whoever calls it and whatever serves it.** Holds. Each service
is a factory taking only ports and returning a driving port function; its inputs are its
arguments and what its ports return. Time and ids come through `Clock` and `<System>Ids`. The
caller's identity arrives as `actor: Actor`, and permission is a domain rule the service asks
(`canIssueRefund(actor)`, `canAssignTransfer(actor)`), not a route guard. The business time zone is
the domain constant `BUSINESS_ZONE = "Europe/Berlin"` used through `TZDate`, never the process
`TZ`; Postgres columns are `timestamptz`; no repository filters by an ambient value. Config values
reach adapters only as client options (keys, URLs). Each driving adapter makes one acting call per
call it handles: a server action calls one port; a hook routes one event to one port; a bus
handler one; a scheduled task one (`raisePaymentDeadlineNotices`, `intakeBankTransfers`,
`scheduleDunning`, `raiseDispatchDueNotices`, `raiseExpiryNotices`), the fan-out being messages that
use case writes. The checkout page's `showCheckoutOptions` is a guard; `placeOrder` decides
invoice eligibility again on its own read. Executors take the locale and recipient from the message,
not from a request. Telemetry (pino, OpenTelemetry API, the request context holding only
`requestId`) is ambient and changes no answer.

**P5. A system reaches the outside, and is reached from it, only through ports assembly hands it;
each port speaks the system's terms.** Holds. dependency-cruiser `service-reach`: `src/service/`
imports only its domain, its `ports/`, its published language, its `private-messages/`, the kernel,
`zod` and `@teashop/lib/telemetry`. `adapter-isolation`: `adapters/driven/<a>/` never imports
`adapters/driven/<b>/` (shop's `PaymentRequests` adapter writes through the common library's
`pgOutboxWriter`, not shop's outbox adapter). Ports are declared in system terms (`Carts`,
`CardPaymentGateway`, `Warehouse`, never `Sql` or `Stripe`); interfaces of `@teashop/lib` are
implemented by shape and are no port. Package `exports` make anything past the offer unresolvable;
`builder` is importable only from `apps/*/src/assembly/**` (dependency-cruiser `builder-only-in-assembly`).
ast-grep `no-env-outside-assembly` fails `process.env` outside `apps/*/src/assembly/config.ts`,
`apps/web/instrumentation.ts` and `@teashop/lib/telemetry/node-sdk.ts`; `no-client-at-module-load`
fails a top-level `new Pool`, `new Stripe`, `new PgBoss`, `new ServerClient` or exported instance
anywhere but inside a function. Builders construct the Stripe, Postmark, 3PL, bank and Payload REST
clients from the config they receive. Framework-constructed adapters (server actions, route
handlers, server components, Payload's hook and field) read their system's courier inside the
handler body on every call (ast-grep `courier-read-per-call` fails `.get()` at module top level);
only builders' `fillCourier` fill it. The relay gets outbox readers from assembly, Payload's from
assembly. Builders return driving ports, bus subscriptions, scheduled tasks and outbox readers,
never a repository.

**P6. Every use case can run with nothing outside the process, in a test.** Holds. Every driven
port has a fake in its declaring system's `src/fakes/`; payment's `FakeCardPaymentDesk` is on
payment's offer for shop's tests. Service tests in the default suite run on fakes only. One
contract suite per port in `test/contracts/<port>.contract.ts`,
`describe.each(implementations())`, where `implementations()` yields the fake always and the real
adapter when `PORT_IMPL=real` (vitest project `integration`: a `@testcontainers/postgresql`
instance prepared by the same `roles.sql` and Drizzle migrations `migrate` runs, connected with the
system's app role) or `PORT_IMPL=e2e` (Stripe test mode, 3PL sandbox, Postmark test token, a
running `web` for Payload REST and revalidation; not run automatically). The suites assert what
service tests rely on: `StaleWrite` on a stale save, unique-key refusal on insert, rollback
discarding every write of the run, claim repeat returning the stored result, outbox
insert-on-conflict doing nothing, `refund` on a disputed charge answering `refused`, a 3PL
validation 4xx answering `refused`. Telemetry: the OpenTelemetry API is a no-op without an SDK;
pino writes to stdout and never throws; no module opens a client at load (P5's rule).

**P7. A use case's writes to its own system's records land together or not at all.** Holds. Each
acting service wraps its body in `uow.run`; every port that writes takes `tx` as a required
parameter; the Postgres write adapters are constructed with no database handle at all, only
`pgOf`, so they can write nowhere but in the transaction they are handed (answering query adapters
get the pool and write nothing). A throw anywhere rolls the whole run back; no service catches a
write's failure. dependency-cruiser `no-service-calls-service` forbids `src/service/x` importing
`src/service/y` (except the `once.ts` claim helper). Driving adapters make one acting call (P4).
Checkout writes customer, order, cart and outbox in one transaction.

**P8. An uncommitted write is not yet a fact.** Holds. Every message is written by the outbox port
in the use case's transaction. Every effect outside is a private command handled by an executor:
mails, Stripe refund and cancellation, 3PL booking and article registration, Payload `catalogStatus`,
storefront revalidation. The one call beside a transaction is `startCardPayment`, a tentative
operation (the intent gives nothing until the customer confirms it; P17 ends it). The chain: relay
marks after `publish` returns; pg-boss jobs live in Postgres across any stop; a job completes only
when `handle` resolves, which is after `uow.run` committed; hooks answer 200 only after the call
returned. Executors decide nothing: they read the record they act for only to get the data and the
key, call, record the owner's answer (`consignmentRef`, `providerRefundRef`) and return; whether
the change is still wanted is the deciding system's (P17). Payload: the veto hook changes nothing;
Payload's `afterChange` writes `cms.ProductDocumentPublished` into Payload's outbox collection with
Payload's own `req`, so it commits with the editor's change, and assembly's `payloadOutboxReader`
hands it to the relay after the commit. Catalog acts only on that message.

**P9. A repeated delivery changes no record of this system, and succeeds where the first did.**
Holds. Every acting use case called for a message (bus, hook, polled item) starts with
`claims.claim(messageId, handler, resultSchema, tx)` inside the transaction that commits its
writes; the key `(message_id, handler)` is a primary key, so an overlapping repeat blocks on the
first's uncommitted insert and then finds it; a repeat commits nothing and returns the stored
result. A first delivery that committed a refusal stored it, so its repeat publishes nothing. Keys
outside: Stripe idempotency keys from the message (`refund:{refundId}`, `cancel-intent:{paymentId}`,
`create-intent:{orderId}`); 3PL booking looks up the consignment by the shipment id as reference
before creating one, and fulfillment's `DUPLICATE_CONSIGNMENT_RACE_ACCEPTED` accepts the overlap
that remains; 3PL article upsert and Payload `catalogStatus` are sets; Postmark takes no key and
shop's and billing's `MAIL_REPEAT_ACCEPTED` accept a second mail. Polled bank transactions enter as
messages with id `bank:{bankTransactionId}`.

**P10. A use case commits only on reads that still hold, or on stale ones a business rule
accepts.** Holds. All reads of an acting use case go through `tx` (the write adapters have nothing
else). Every aggregate has `version`; `save` is `UPDATE ... WHERE id = $1 AND version = $2` and
throws `StaleWrite` on zero rows; new aggregates insert under unique keys. What decisions read sits
in the aggregates saved: `StockItem` holds its reservations; `Order` holds its deadline and payment
facet, so `expireUnpaidOrder` and `recordCardPaymentSucceeded` fail each other; `Cart` is saved on
checkout; `NumberSeries` is saved by every issuance; `DunningAccount` is saved by both
`applyIncomingTransfer` and `advanceDunning`; `Article.awaitingShipments` is saved by
`createShipment` and `registerArticle`. No use case retries itself. Stale data with a rule: shop's
`canPayByInvoice` on its standing replica (rule text: a customer who entered dunning since the last
standing change reached shop is still offered invoice); the price snapshot from the offer replica
(rule: an order takes the price the shop's offer holds at checkout); the payment status at the
deadline (rule: a payment that succeeds after the answer is refunded as a late payment). Untied
failures avoided: one `StockItem` per sku, one `FulfillmentOrder` per order, notice-raising sweeps
write only outbox rows, no counters or statistics in any use case. All invoice issuance serializes
on its year's `NumberSeries`, which the gapless rule ties.

**P11. No other system changes the records a system owns, or reads them except through its
published language.** Holds. Each system's pool connects as `teashop_<s>_app`, which has grants on
its own schema only; no SQL of one system can name another's table, and dependency-cruiser keeps
`adapters/driven/postgres/schema.ts` private to its system. Reads of another system go through
payment's open host service or through published events into replicas. Outboxes are read only by
their owners' readers. Payload: `catalogStatus` has field access `create` and `update` allowed
only to the `catalog-service` API user (`access/catalog-service-only.ts`); editors read it; its key
lives only in catalog's builder config; `teashop_payload` has no grant on `catalog`. Catalog's
`Product` is in catalog's schema, changed only by catalog's use cases; Payload's editorial document
is Payload's. The stock in Payload's admin is rendered by fulfillment's own driving adapter calling
fulfillment's own port.

**P12. Another system's model enters this one only by choice.** Holds. Each system has
`upstreams.json` naming every upstream and its choice; all are `"anti-corruption"`. The
dependency-cruiser config is generated from these files: another system's published language,
`@teashop/cms-language`, `stripe`, and a system's own `upstream/<x>/schemas.ts` are importable only
from that system's `adapters/driving/bus/**`, its webhook route, its Payload hook and its
`adapters/driven/<upstream>-*/**`; never from domain, service, ports or its own published language.
A `"conformist"` entry would add that upstream's published language to the domain's list. The
3PL's and bank's shapes, which come as documentation, are stated once each in fulfillment's and
billing's `upstream/` modules. Published languages import only `zod` and the kernel; the kernel
imports nothing of `@teashop`.

**P13. A system changes its model without its downstream systems changing.** Holds. Package
`exports` expose `./published-language`, payment's `./ports` and `./fakes`, `./builder` (assembly
only), `./next` and `./payload` (the system's own framework files only). Published-language modules
are hand-written zod schemas; dependency-cruiser `pl-closed` lets them import `zod` and the kernel
only, so no domain schema, enum or table definition reaches them, and no generator writes them.
Services translate with `service/to-published.ts` (`toOrderPlacedV1(order)`), where a model change
that meets the contract fails to compile. Commands are declared by their receiver (payment's
`RefundCardPaymentV1`). Private messages sit in `private-messages/`, not exported, so no other
system can subscribe to one. Payment's `CardPaymentDesk` takes and returns only payment's published
language.

**P14. A record or a message means the same to all code that reads it, whenever it was written.**
Holds. Each message version has one file (`order-placed.v1.ts`) exporting one zod schema that the
writing service's mapper produces and every handler parses with; the envelope carries `type` and
`schemaVersion`; queues subscribe by type and version. `tools/schema-compat/check.ts` (in `pnpm
check`) renders every schema to JSON Schema and diffs it against the committed snapshot: a change
to an existing version fails unless it only adds an optional field and the schema file carries a
`@compat` note stating what an old reader reads in its absence, which review judges by "as the
writer meant it"; anything else is a `v2` file, written beside `v1` until no reader of `v1` runs
and no `v1` waits in an outbox or dead-letter queue. Records: write adapters update only the
columns they map (`set({...})` listing columns, never a full-row rewrite), child rows by id;
migrations follow the expand/contract release rule. Payment's open host service is called only
in-process, outside P14's Scope; its messages are in it.

**P15. A use case works while other systems are down or slow, unless a business rule needs
another system's answer now.** Holds. Shop reads catalog and billing data only from its replicas;
it asks fulfillment and billing nothing; it asks payment only at checkout (`client_secret` now) and
at the payment deadline (rule needs the answer; after the grace it decides without one). Every
other cross-system effect is a message. Executors wait on the system the message asks a change of.
`refreshInventory` and `checkOverdueShipment` read the 3PL's current state because their rule is
"on hand is the 3PL's count when it notifies" and "at the dispatch deadline, ask, then decide
regardless". Nobody waits on catalog, billing or fulfillment synchronously. Payload's stock field
reads fulfillment's own store.

**P16. No transaction spans two systems.** Holds. A transaction exists only on one system's pool,
whose role reaches only that system's schema. It travels as an argument of opaque type `ShopTx` (a
branded interface a Drizzle transaction is not assignable to); ast-grep `no-ambient-transaction`
fails `AsyncLocalStorage` outside `@teashop/lib/telemetry/request-context.ts`, whose store type
is `{ requestId: string }`. dependency-cruiser `driving-ports-take-no-tx` forbids
`ports/driving/**` and `published-language/**` importing `ports/driven/transaction.ts`. Shop's
call to payment passes payment's published-language input only; payment opens its own transaction
on its own pool. Catalog's veto hook passes nothing of Payload's `req`; catalog writes Payload only
over REST, where no `transactionID` exists.

**P17. Work spanning systems ends, and only in a state a business rule allows.** Holds. Each part
that waits holds its deadline in its own aggregate and ends by a domain rule:
shop `Order` awaiting card payment ends paid, or cancelled at `paymentDeadline` (asking payment,
deciding without an answer after the grace), and a later payment ends refunded (`onLateCardPayment`);
shop's refund facet holds `refundExpectedBy` (7 days) after which the rule accepts it as an ops
case shown on `/ops/orders`; a `RefundRefused` (disputed) is accepted with the order flagged;
`StockShortfall` cancels the order and refunds or cancels the card payment (`onStockShortfall`);
`ShipmentBookingRefused` is accepted and flagged. Payment `CardPayment` pending ends at
`expiresAt` by cancelling the intent; a `Refund` pending at Stripe holds `expectedBy` (5 days)
after which it is accepted as stalled for ops. Fulfillment `Shipment` holds `dispatchExpectedBy`
(and the same field while awaiting articles), checked by `checkOverdueShipment`, which ends in
`dispatched` or accepted `overdue`. Billing: an open invoice ends settled or at `final_notice`,
accepted as handed to ops; an unmatched transfer is accepted until ops assigns it. Refusals are
committed outcomes (`Refund.refused`, `FulfillmentOrder.short`, `Shipment.booking_refused`,
`ProductRevision.refused`, `Article.refused`) and published or reported; failures throw and
never commit an outcome. Each adapter separates the two (Stripe card error vs network; 3PL 4xx with
a validation body vs anything else).

**P18. The order messages arrive in does not change the outcome.** Holds. Overriding facts carry
the writer's aggregate version, raised in the committing transaction: `ProductChanged`,
`CustomerPaymentStandingChanged`, `CardPaymentSucceeded`, `ShipmentDispatched`, Payload's
`revision`; receivers keep the highest (`applyIfNewer` with `WHERE source_version <
excluded.source_version`; catalog marks a lower revision `superseded`). Non-overriding pairs are
ordered by what they say: fulfillment's `FulfillmentOrder` records a cancel that arrives first, and
the later `OrderPlaced` reserves nothing; billing's `OrderCancellationNote` does the same for an
invoice order. A message that needs a predecessor not yet there fails and is redelivered
(`CardPaymentSucceeded` before the order exists, a 3PL status before the consignment is recorded,
`OrderReleasedForShipment` before the reservation). Stripe events carry no version: payment's
statuses only move forward and `disputed` is set-only. 3PL inventory notices carry none: the
handler reads the current count. Writers that could conflict over one shop `Order` write separate
facets; where payment's success meets shop's own deadline cancellation, `onLateCardPayment`
decides.

**P19. Within one system, each term has one meaning.** Holds. Each system keeps
`packages/<s>/GLOSSARY.md`; a term enters it before code uses it (review item). Names kept apart
where words collide: catalog `Product`, shop `ProductOffer`, Payload's document `cms.Product`
(called `editorialDocument` in catalog's code); shop `Order`, billing `BillableOrder` and
`OrderRef`, fulfillment `FulfillmentOrder`, payment `OrderRef`; shop `Customer`, billing
`CustomerRef`. ast-grep `upstream-namespace-import` requires `import * as <name>` for another
system's published language, `@teashop/cms-language` and `stripe`, so every upstream term reads
`payment.CardPaymentStatusV1`, `cms.Product`, `Stripe.Event`. Architecture words (event, handler,
outbox) appear in no system's glossary as business terms.

## Decisions the document left to me

- **D1. System cut.** Chose five systems: catalog, shop, payment, billing, fulfillment. Would also have held: payment folded into shop; dunning split from billing; catalog folded into Payload as an external owner with no catalog system.
- **D2. Who owns the product an editor types.** Chose two records: Payload owns the editorial document, catalog owns the adopted `Product` and the `catalogStatus` kept in Payload; Payload asks catalog by veto and tells it by its outbox. Would also have held: catalog owns the product kept only in its tables with a custom Payload admin view that calls catalog's acting use case, Payload keeping nothing of it.
- **D3. Choreography, no orchestration.** Chose events between systems and two commands from shop to payment. Would also have held: a process manager `Checkout` in shop sending `ReserveStock`, `IssueInvoice`, `BookShipment` commands declared in each receiver's published language.
- **D4. Bus.** Chose pg-boss 10 in the same Postgres. Would also have held: RabbitMQ with quorum queues and manual ack; SQS with a DLQ; a hand-written jobs table.
- **D5. Relay.** Chose a polling loop in `worker`, 500 ms, `FOR UPDATE SKIP LOCKED`, 100 per batch, mark after publish. Would also have held: `LISTEN/NOTIFY` wake-ups; logical replication.
- **D6. Store layout.** Chose one Postgres schema, owner role, app role and pool per system. Would also have held: one role for all with only dependency-cruiser guarding table access.
- **D7. Repository layout.** Chose a pnpm workspace with one package per system, offer as package `exports`. Would also have held: one package with path aliases and dependency-cruiser alone.
- **D8. Enforcement tooling.** Chose dependency-cruiser, ast-grep, per-layer tsconfig, Biome. Would also have held: ESLint with `eslint-plugin-boundaries` and `no-restricted-syntax`.
- **D9. Processes.** Chose `web` (Next.js with Payload in-process), `worker`, `migrate` job. Would also have held: Payload standalone in its own process; one process per system's worker.
- **D10. Courier.** Chose a `globalThis` slot per system keyed by `Symbol.for`, filled in `instrumentation.ts`, read inside each handler body. Would also have held: a slot read through a per-request `AsyncLocalStorage` that assembly fills per request.
- **D11. Transaction token.** Chose an opaque branded per-system `Tx`, narrowed by `instanceof` in the Postgres adapters. Would also have held: a unit of work handing the service repositories already bound to the transaction.
- **D12. Concurrency means.** Chose a `version` column compared on every save plus unique keys. Would also have held: `SELECT ... FOR UPDATE` at load, or `SERIALIZABLE`.
- **D13. Repeat detection.** Chose a `handled_messages` claim per `(message_id, handler)` with the stored result. Would also have held: records-only idempotency for handlers whose writes are all sets.
- **D14. Effects outside.** Chose a private command and an executor for every mail, API change and cache revalidation. Would also have held: a record field as outbox (`mailSentAt`) polled by a task.
- **D15. Message schemas.** Chose one zod file per message version, `type` plus `schemaVersion` on the envelope, JSON-Schema snapshot diff in CI. Would also have held: Avro or protobuf with a registry.
- **D16. Business values.** Chose card window 30 min, grace 60 min, intent expiry 120 min, invoice due 14 days, dunning at due + 7/14/28 days, dispatch expected 48 h, refund expected 7 days (shop) and 5 days (payment), 50-cent card minimum. Any other values hold.
- **D17. Money.** Chose gross EUR prices in integer cents, VAT split per line rounding half-up, full refunds only. Would also have held: net prices; partial refunds with a credit note each.
- **D18. When invoices are issued.** Chose card orders at `OrderPaid`, invoice orders at `OrderPlaced`, a cancellation credit note if an invoice order is cancelled. Would also have held: invoice orders at `ShipmentDispatched`.
- **D19. Payment deadline scope.** Chose the deadline for card orders only; invoice orders go to dunning. Would also have held: a deadline for invoice orders counted from dispatch.
- **D20. Stock.** Chose the 3PL as the source of on-hand, all-or-nothing reservation, shortfall cancelling the order. Would also have held: partial reservation with backorder; shop keeping a stock replica to refuse at checkout.
- **D21. Ops dashboard.** Chose one page per system under `/ops/*`, each its system's driving adapter. Would also have held: a `backoffice` system with replicas of all three fed by events.
- **D22. Fan-out from scheduled tasks.** Chose one acting use case per tick that writes one private message per item into the outbox (deterministic ids, insert-or-nothing). Would also have held: the task enqueuing to the bus directly with the item's id.
- **D23. 3PL repeat booking.** Chose lookup by shipment reference before create, plus a written rule accepting the race. Would also have held: if the 3PL takes a key, the shipment id as key.
- **D24. Mail.** Chose Postmark, sent by each system's own executor, repeats accepted by rule. Would also have held: a `notifications` system taking commands.
- **D25. Storefront revalidation.** Chose an internal `POST /api/internal/revalidate` in `web` called by shop's executor. Would also have held: `web` running its own pg-boss consumer for `shop.RevalidateStorefront` and calling `revalidateTag` in-process.
- **D26. Telemetry.** Chose pino to stdout with an OTel mixin, NodeSDK with OTLP to Jaeger, Prometheus exporter, request id in an `AsyncLocalStorage` context and on the envelope. Would also have held: pino-otel transport to a collector.
- **D27. Customers and callers.** Chose shop owning `Customer` keyed by email, `Actor` passed as an argument for ops use cases. Would also have held: an `identity` system.
- **D28. Conformance record.** Chose `upstreams.json` per system; every relation anti-corruption. Would also have held: payment conforming to Stripe with Stripe's types in its domain, given they load without Node types.
- **D29. Shared kernel.** Chose `Money`, `TaxClass`, `Sku`. Would also have held: no kernel, each system declaring its own money type and translating.
- **D30. Tests.** Chose vitest, `test/` mirroring `src/`, contract suites switched by `PORT_IMPL`, testcontainers with production migrations. Would also have held: a shared CI Postgres.
- **D31. Business time.** Chose date-fns with `@date-fns/tz` and `BUSINESS_ZONE` in each domain that needs days. Would also have held: the Temporal polyfill.
- **D32. Payload's outbox and version.** Chose a Payload `outbox` collection written in `afterChange` with `req`, and a `revision` field raised in `beforeChange`. Would also have held: the pending-record route (P8's third sentence) with catalog reading Payload's committed state.
- **D33. Where domain becomes published language.** Chose mappers in `service/to-published.ts`. Would also have held: mappers in the outbox adapter.

## Sentences I had to pick a reading for

- **S1.** P11 Why: "Where the business wants editors to change the record in the external system's admin, the record is the external system's to own", against P2 Why: "Where the external system has to ask before it writes, catalog's veto of a sku change, the rule stays in catalog's domain, and the external system reaches it through its hook". Reading A: a record editors change in Payload is Payload's, so catalog's rules can only be about a record of catalog's own fed from it. Reading B: catalog owns the product Payload keeps, and the veto hook makes the editor's write pass catalog's rules, which counts as "nothing but the owner's use cases changes the record". Took A. Changed: two records (Payload's editorial document, catalog's `Product`), the outbox flow from Payload to catalog, the `catalogStatus` field written back, and the price on the shop page coming from catalog, not Payload.
- **S2.** P8: "A use case called for such a message MUST make the change, deciding nothing again". Reading A: "such a message" is only the one asking for a change its writer decided but did not commit (an executor's message). Reading B: every handler for any message. Took A. Changed: executors (mails, Stripe refund, 3PL booking, catalog status) decide nothing; handlers of other systems' events (`reserveForOrder`, `acceptRefundRequest`, `expireUnpaidOrder` on a deadline notice) decide by their own rules.
- **S3.** Glossary Store: "Two clients are one store when one transaction can carry the writes of both, two stores until it can." Reading A: one Postgres instance is one store whatever roles connect. Reading B: per-system roles whose grants keep a transaction to one schema make separate stores. Took B. Changed: nothing needs a cross-store write; Payload's outbox lives in Payload's store and Payload's reader is assembly's; each system's outbox is in its own store.
- **S4.** P7: "a scheduled task polling a bank hands each transfer on as a message of its own", with P4's "at most one acting call per call it handles". Reading A: the task enqueues to the bus directly. Reading B: the task makes one acting call whose use case writes one message per item. Took B. Changed: `intakeBankTransfers`, `raisePaymentDeadlineNotices`, `scheduleDunning`, `raiseExpiryNotices`, `raiseDispatchDueNotices`; no driving adapter holds the bus.
- **S5.** P6: "Each driven port MUST have a fake, which the system declaring the port SHOULD provide". Reading A: the system writes the fake itself. Reading B: the system exports it, and may build it on a common-library helper. Took B. Changed: `@teashop/lib/testing` holds `InMemoryTransactionalStore`; each system's `src/fakes/` builds its own fakes on it and owns their contract suites.
- **S6.** P5: "from a courier that only assembly fills and a driving adapter reads each time it runs". Reading A: the courier lives in assembly. Reading B: it may live with the driving adapters as long as only assembly writes it. Took B, since a system builder is assembly. Changed: slots in `adapters/driving/next/courier.ts`, `fill` reachable only through the builder.
- **S7.** P1: "MUST load on every runtime of the language". Reading A: every runtime that exists (Node, Deno, Bun, browsers, edge). Reading B: the language's standard library only, no host API. Took B, checked by `types: []` and `lib: ["ES2023"]` plus a neutral-platform bundle. Changed: the domain tsconfig and the loads-everywhere test.
- **S8.** P15: "or for the change that a message it is called for asks of that system". Reading A: a handler may wait on another system only for a change. Reading B: also for a read a rule needs now, the first exception, as P18's "takes the thing's current state from the owner" implies. Took B. Changed: `refreshInventory` reads the 3PL's count; `checkOverdueShipment` asks the 3PL, both with the rule written in fulfillment's domain.
- **S9.** P2: "with every value it decides by that is the same for every candidate and that no record holds". Reading A: VAT rates, which change by law on a date, are domain constants. Reading B: they are a record the business changes at runtime. Took A, with the rates in billing's domain as a dated table. Changed: a VAT change is a deploy.
- **S10.** P3: "A shared kernel MUST hold no such rule and no record's schema, only values and what computes values from arguments." Reading A: `TaxClass` and the sku format are values. Reading B: they are catalog's rules about its product. Took A. Changed: both in the kernel; Payload's select takes `TAX_CLASSES` from it.
- **S11.** P9: "by the message's id claimed there under a key the store refuses twice". Reading A: the key is the message id. Reading B: the message id per handler. Took B, since one system may run two handlers for one message. Changed: primary key `(message_id, handler)`.
- **S12.** P4: "MUST NOT withhold a call the service would accept". Reading A: hiding the invoice option when the answering call says not eligible withholds nothing, since the service reads the same replica. Reading B: any UI omission is withholding. Took A. Changed: the checkout page hides the option; `placeOrder` still decides and refuses `invoice_not_offered`.
- **S13.** P17: "the moment it decides on none coming MUST be held in an aggregate of its own". Reading A: a field of an aggregate the waiting system owns. Reading B: any durable timer of its own (a delayed bus job). Took A. Changed: deadline fields on `Order`, `CardPayment`, `Refund`, `Shipment`; sweeps only raise notices.
- **S14.** P12: "A system MUST record each upstream it conforms to". Reading A: only conformist relations are recorded. Reading B: record every upstream with its choice. Took B, since the linter needs the full list. Changed: `upstreams.json` lists every upstream, the 3PL and the bank included.
- **S15.** P2: "A condition the store checks beyond the key, a check constraint, a trigger, decides, and is refused." Reading A: `NOT NULL`, column types and child-to-root foreign keys are shape the adapter keeps in step, like the key. Reading B: they too are conditions beyond the key. Took A. Changed: migrations keep `NOT NULL`, types and child-to-root foreign keys, no `CHECK`, no trigger.
- **S16.** P5: "Anything outside a system MUST reach into it only through its offer or by a driving adapter's way in." Reading A: Payload's configuration naming catalog's hook and fulfillment's field is a way in. Reading B: it is an import past the offer. Took A. Changed: `./payload` subpaths on catalog and fulfillment, importable only from `packages/cms`.
- **S17.** P8: "or as a request for a tentative operation made beside the transaction". Reading A: only a request to an external system. Reading B: a call to another system of this codebase that commits a pending record there counts too. Took B. Changed: `startCardPayment` commits `CardPayment(pending)` in payment beside shop's transaction; payment's expiry ends it if shop never commits.
- **S18.** P11 Scope: "configuration this codebase writes for an external system, reads or changes a record another system owns". Reading A: the stock shown in Payload's admin is Payload's configuration reading fulfillment's records. Reading B: the field component is fulfillment's driving adapter, so fulfillment reads its own. Took B. Changed: the stock field lives in fulfillment's package and calls fulfillment's own port.
- **S19.** P10: "use cases fail each other only where a business rule ties them". Reading A: the gapless rule ties every invoice issuance, so one `NumberSeries` per year is right. Reading B: issuances for different orders are untied and must not fail each other. Took A. Changed: all issuances in a year save the same `NumberSeries` and retry on `StaleWrite`.
