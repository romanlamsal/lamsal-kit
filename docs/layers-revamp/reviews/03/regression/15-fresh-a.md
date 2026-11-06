# Fresh repository draft A, distilled set

Tea shop per the brief: TypeScript on Node 22, pnpm workspace, one Postgres 16 instance, Drizzle,
Payload 3 (on Next.js 15), Stripe, a 3PL API with webhooks, a bank API, a mail provider, pino,
OpenTelemetry to Jaeger (OTLP), `AsyncLocalStorage`. Additions I picked: Next.js 15 (Payload 3
requires it), `pg-boss` 10 as the bus, `zod` for the published language, `dependency-cruiser` and
Biome for enforcement, Vitest and Testcontainers for tests.

Glossary terms are used as the document spells them. Names in backticks that are not glossary terms
are code names of this draft.

## Systems and what each owns

### Systems of this codebase

| System | Kind | Owns (aggregates, business rules) | Keeps (store, records) |
|---|---|---|---|
| `ordering` | core; orchestration via a process manager | `Cart`; `Customer` (keyed by normalized e-mail); `Order`, which is the process manager of the order lifecycle (placed, awaiting card payment, paid, shipment requested, shipped, shipment refused, cancelled, refunded); rules: an order line carries a snapshot of price, sku, tax class; pay by invoice is not offered to a customer in dunning; a card order unpaid 60 min after placement is cancelled; invoice orders ship at once, card orders once paid; a card payment arriving for a cancelled order is refunded | Postgres schema `ordering`, login role `ordering_app`: `carts`, `cart_lines`, `customers`, `orders`, `order_lines`, `product_replica` (replica of the catalog, keyed by Payload product id), `dunning_replica` (replica of billing's dunning status), `outbox` |
| `inventory` | supporting | `StockItem` per sku, holding its reservations (tentative, confirmed, expired, released, consumed); rules: a reservation is granted only if available = last reported on hand − dispatched since that report − active reservations covers it; a tentative reservation expires after 30 min; a confirmation revives an expired one; a released one stays released | schema `inventory`, role `inventory_app`: `stock_items`, `reservations`, `reported_levels` (replica of fulfilment's stock reports), `dispatch_ledger` |
| `payments` | supporting | `CardPayment` (tentative, open, succeeded, cancelled, refund requested, refunded, disputed); rules: a card payment can be refunded; a disputed charge is not; refunds are full; a payment unconfirmed 30 min after start is cancelled | schema `payments`, role `payments_app`: `card_payments`, `refunds`, `outbox` |
| `billing` | supporting | `Invoice`, `CreditNote`, `NumberSeries`, `BankTransfer`, `DunningAccount` (per customer); rules: one invoice per paid card order, one per order paid by invoice (issued at placement, due 14 days after issue); VAT by tax class (7% tea, 19% accessories, gross prices); gapless numbers per series and year (`RE-2026-000001`, `GS-2026-000001`); a credit note per refund and per cancellation of an invoiced, unpaid order; a transfer matches an open invoice when its reference holds the invoice number and its amount equals the open amount, otherwise it is unmatched; dunning stages 1, 2, 3 at 7, 21, 35 days overdue, a customer is in dunning at stage 1 or above | schema `billing`, role `billing_app`: `invoices`, `invoice_lines`, `credit_notes`, `number_series`, `bank_transfers`, `dunning_accounts`, `outbox` |
| `fulfilment` | supporting | `Shipment` (requested, submitting, submitted, dispatched, refused); `Article` (sku registration in the 3PL article master: pending, submitting, registered); `StockReport` (what the 3PL last reported per sku, as this system's fact); rules: a shipment is submitted only when every sku is registered; only DE and AT addresses ship | schema `fulfilment`, role `fulfilment_app`: `shipments`, `shipment_lines`, `articles`, `stock_reports`, `outbox` |
| `storefront` | generic; conformist to Payload | which shop pages a product change invalidates (listing, the product's page by slug, the page of its previous slug) | no store; the Next.js data cache is its cache, not a store |

### External systems

| External system | Where it runs | What we configure / how we reach it |
|---|---|---|
| Payload CMS | in our `web` process; schema `payload`, role `payload_app` | We write its configuration (`packages/external/payload-catalog`): collection `products` (title, slug unique, copy, images, `priceCents` integer ≥ 1, `sku` unique and immutable after create, `taxClass` tea or accessories, `active`), a read-only `ui` field `stock`, a hidden collection `catalog-outbox` written in Payload's own transaction, and the admin view `/admin/operations`. Owner of products. Its business rules (price above zero, sku unique) are its own, held by its configuration. |
| Stripe | vendor | `stripe` SDK from `payments` driven adapters; webhooks into a `payments` hook. |
| 3PL warehouse | vendor | HTTP API from `fulfilment` driven adapters; webhooks into a `fulfilment` hook. |
| Bank API | vendor | statement API from a `billing` driven adapter; transfer webhook into a `billing` hook. |
| Mail provider | vendor | HTTP API from `ordering` and `billing` driven adapters. |
| Operating system | host | clock and randomness, behind each system's `Clock` and `IdGenerator` ports. |
| Jaeger, Prometheus | ops | reached only by the common library `@shop/observability` (OTLP export, `/metrics` scrape). |

### Shared kernel

`@shop/kernel-money` (`packages/shared-kernel/money`): `Money` (integer euro cents, currency
`EUR`), `add`, `subtract`, `multiply`, rounding half-up. Imported into the
domains of `ordering`, `payments` and `billing`, agreed by all three; a change to it is a change to
each. Nothing else is shared.

### Code that is no system

| Code | What it is |
|---|---|
| `apps/web/src/assembly`, `apps/worker/src/assembly`, `apps/migrate/src` | assembly of each process, its configuration parsing, the courier (`web`) |
| `apps/web/src/app/(shop)`, `apps/web/src/payload-components` | UI (out of scope); one-line shims that hand requests to driving adapters taken from the courier |
| `packages/platform/bus` | the relay and the bus (`pg-boss`); used by assembly only |
| `packages/lib/observability` | common library: pino logger, OTel SDK setup, request context in `AsyncLocalStorage`, probes |
| `packages/lib/result` | common library: `Result<T, E>` |
| `packages/lib/messaging` | common library: `Envelope` type and schema, Drizzle `outbox` table factory, Postgres outbox reader factory |
| `packages/lib/postgres` | common library: pool factory, `ConcurrencyConflict`, optimistic update helper |
| `tooling/` | tooling: dependency-cruiser rules, relationship registry, migration lint, Testcontainers setup |

## Ports and adapters

Conventions for every system:

- A driving port is one function type, one use case. A service is a factory: `makePlaceOrder(deps): PlaceOrder`.
- Driven ports are interfaces in `src/ports/driven`. Repositories exist only inside a `UnitOfWork` transaction.
- Every acting use case runs through `withConflictRetry` (3 attempts on `ConcurrencyConflict`).
- Refusals are `Result` errors with a `code`; thrown errors mean infrastructure failure only.

```ts
// @shop/result
export type Result<T, E extends { readonly code: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// @shop/kernel-money
export type Money = { readonly cents: number; readonly currency: "EUR" };
```

Every system declares its own `Clock` and `IdGenerator` port in its own terms; one OS clock adapter
(`{ now: () => new Date() }`) and one UUIDv7 adapter in assembly satisfy them structurally.

### `ordering`

Driving ports (`packages/systems/ordering/src/ports/driving.ts`):

```ts
export type AddToCart = (input: { cartId: CartId | null; productId: ProductId; quantity: number }) =>
  Promise<Result<CartView, UnknownProduct | InvalidQuantity>>;
export type ViewCart = (cartId: CartId) => Promise<CartView | null>;
export type GetCheckoutOptions = (input: { cartId: CartId; email: EmailAddress }) =>
  Promise<Result<CheckoutOptions /* { methods: ("card" | "invoice")[]; total: Money } */, CartNotFound | CartEmpty>>;
export type PlaceOrder = (input: {
  cartId: CartId; email: EmailAddress; billingAddress: Address; shippingAddress: Address;
  paymentMethod: "card" | "invoice";
}) => Promise<Result<PlacedOrder, PlaceOrderRefusal>>;
export type PlacedOrder = {
  orderId: OrderId;
  payment: { method: "card"; cardPaymentSecret: string } | { method: "invoice" };
};
export type PlaceOrderRefusal =
  | CartEmpty | CartNotFound | CartChanged
  | { code: "productUnavailable"; productIds: ProductId[] }
  | { code: "outOfStock"; skus: Sku[] }
  | { code: "invoiceNotOffered" }
  | { code: "cardPaymentUnavailable" };
export type CancelOrder = (input: { orderId: OrderId; reason: CancelReason }) =>
  Promise<Result<void, OrderNotFound | { code: "notCancellable"; status: OrderStatus }>>;
export type CancelOverdueOrders = () => Promise<{ cancelled: number }>;
export type SendOrderConfirmation = (orderId: OrderId) => Promise<Result<void, OrderNotFound>>;
export type RecordCardPaymentSucceeded = (input: { orderId: OrderId; succeededAt: Date }) => Promise<Result<void, OrderNotFound>>;
export type RecordCardPaymentRefunded = (input: { orderId: OrderId; refundedAt: Date }) => Promise<Result<void, OrderNotFound>>;
export type RecordCardPaymentDisputed = (input: { orderId: OrderId; disputedAt: Date }) => Promise<Result<void, OrderNotFound>>;
export type RecordRefundRefused = (input: { orderId: OrderId; reason: "disputed" | "notCaptured" }) => Promise<Result<void, OrderNotFound>>;
export type RecordInvoicePaid = (input: { orderId: OrderId; paidAt: Date }) => Promise<Result<void, OrderNotFound>>;
export type RecordShipmentDispatched = (input: { orderId: OrderId; dispatchedAt: Date; trackingNumber: string }) => Promise<Result<void, OrderNotFound>>;
export type RecordShipmentRefused = (input: { orderId: OrderId; reason: string }) => Promise<Result<void, OrderNotFound>>;
export type RefreshProduct = (product: CatalogProduct /* ordering's terms, with sourceVersion */) => Promise<void>;
export type ForgetProduct = (input: { productId: ProductId; sourceVersion: string }) => Promise<void>;
export type RecordDunningStatus = (input: { customerId: CustomerId; inDunning: boolean; sequence: number }) => Promise<void>;
export type ListOrders = (query: { status?: OrderStatus; page: number }) => Promise<OrderSummaryPage>;
```

Driven ports (`src/ports/driven/*.ts`):

```ts
export interface UnitOfWork { run<T>(work: (tx: OrderingTx) => Promise<T>): Promise<T> }
export type OrderingTx = {
  carts: CartRepository; orders: OrderRepository; customers: CustomerRepository;
  products: ProductReplica; dunning: DunningReplica; outbox: OrderingOutbox;
};
export interface CartRepository { load(id: CartId): Promise<Cart | null>; save(cart: Cart): Promise<void> }
export interface OrderRepository {
  load(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;                     // UPDATE ... WHERE version = loaded version
  findOverdue(now: Date, limit: number): Promise<readonly OrderId[]>;
}
export interface CustomerRepository { findByEmail(email: EmailAddress): Promise<Customer | null>; save(c: Customer): Promise<void> }
export interface ProductReplica {
  get(ids: readonly ProductId[]): Promise<ReadonlyMap<ProductId, CatalogProduct>>;
  apply(product: CatalogProduct): Promise<void>;          // keeps the newer sourceVersion
  forget(id: ProductId, sourceVersion: string): Promise<void>;
}
export interface DunningReplica {
  statusOf(customerId: CustomerId): Promise<{ inDunning: boolean }>;
  apply(input: { customerId: CustomerId; inDunning: boolean; sequence: number }): Promise<void>; // keeps the higher sequence
}
export interface OrderingOutbox { write(message: OrderingOutgoing): Promise<void> }
export type OrderingOutgoing =
  | { kind: "orderPlaced"; order: Order } | { kind: "orderPaid"; order: Order }
  | { kind: "orderCancelled"; order: Order } | { kind: "shipmentRequested"; order: Order }
  | { kind: "refundRequested"; orderId: OrderId } | { kind: "confirmationDue"; orderId: OrderId };
export interface StockReservations {
  reserve(input: { orderId: OrderId; lines: readonly { sku: Sku; quantity: number }[] }):
    Promise<Result<void, { code: "outOfStock"; skus: Sku[] }>>;
}
export interface CardPayments {
  start(input: { orderId: OrderId; amount: Money; email: EmailAddress }):
    Promise<Result<{ cardPaymentSecret: string }, { code: "cardPaymentUnavailable" }>>;
}
export interface ConfirmationMailer { send(input: { order: Order; idempotencyKey: string }): Promise<void> }
export interface OrderQueries { list(query: { status?: OrderStatus; page: number }): Promise<OrderSummaryPage> }
export interface Clock { now(): Date }
export interface IdGenerator { orderId(): OrderId; cartId(): CartId; customerId(): CustomerId }
```

Adapters:

- Driven: `postgres/` (Drizzle on pool of `ordering_app`: `unit-of-work.ts`, one file per repository, `product-replica.ts`, `dunning-replica.ts`, `outbox.ts` translating `OrderingOutgoing` into envelopes of ordering's and fulfilment's and payments' published language, `outbox-reader.ts`, `order-queries.ts`); `inventory/stock-reservations.ts` (anti-corruption layer over inventory's `ReserveStock`); `payments/card-payments.ts` (anti-corruption layer over payments' `StartCardPayment`); `mail/confirmation-mailer.ts` (mail provider HTTP, header `Idempotency-Key`); `fakes/` (one in-memory fake per driven port, `in-memory-unit-of-work.ts` snapshots and restores state on throw).
- Driving: `http/cart.ts`, `http/checkout-options.ts`, `http/checkout.ts` (Fetch `Request` to `Response`; maps refusals to 409/422/503); `admin/orders-panel.ts`, `admin/cancel-order-action.ts`; `handlers/` one per subscription: `catalog-product-changed.ts`, `catalog-product-deleted.ts` (anti-corruption layer over Payload's published language), `payments-card-payment-succeeded.ts`, `payments-card-payment-refunded.ts`, `payments-card-payment-disputed.ts`, `payments-refund-refused.ts`, `billing-invoice-paid.ts`, `billing-dunning-status-changed.ts`, `fulfilment-shipment-dispatched.ts`, `fulfilment-shipment-refused.ts`, `send-order-confirmation.ts` (private); `scheduled/cancel-overdue-orders.ts`.

### `inventory`

```ts
// driving (ReserveStock and GetStockLevels form the open host service)
export type ReserveStock = (input: { reservationId: ReservationId; lines: readonly { sku: Sku; quantity: number }[] }) =>
  Promise<Result<{ expiresAt: Date }, InsufficientStock /* { code: "insufficientStock"; skus: Sku[] } */>>;
export type GetStockLevels = (skus: readonly Sku[]) =>
  Promise<ReadonlyMap<Sku, { onHand: number; reserved: number; available: number; reportedAt: Date | null }>>;
export type ConfirmReservation = (reservationId: ReservationId) => Promise<void>;
export type ReleaseReservation = (reservationId: ReservationId) => Promise<void>;
export type RecordDispatch = (input: { dispatchId: string; reservationId: ReservationId; lines: readonly { sku: Sku; quantity: number }[]; dispatchedAt: Date }) => Promise<void>;
export type RecordReportedLevel = (input: { sku: Sku; onHand: number; reportedAt: Date }) => Promise<void>;
export type ExpireReservations = () => Promise<{ expired: number }>;

// driven
export interface UnitOfWork { run<T>(work: (tx: { stockItems: StockItemRepository }) => Promise<T>): Promise<T> }
export interface StockItemRepository {
  load(skus: readonly Sku[]): Promise<readonly StockItem[]>;          // missing sku → empty StockItem
  findByReservation(id: ReservationId): Promise<readonly StockItem[]>;
  findWithExpiredReservations(now: Date, limit: number): Promise<readonly StockItem[]>;
  save(item: StockItem): Promise<void>;
}
export interface Clock { now(): Date }
```

Adapters: `postgres/` (unit of work, `stock-item-repository.ts`); `fakes/`; driving
`payload/stock-field.tsx` (hook: a React server component rendered by Payload admin, calls
`GetStockLevels`), `handlers/ordering-order-placed.ts` (confirm), `handlers/ordering-order-cancelled.ts`
(release), `handlers/fulfilment-shipment-dispatched.ts` (record dispatch), `handlers/fulfilment-stock-level-reported.ts`,
`scheduled/expire-reservations.ts`. `inventory` publishes nothing and has no outbox.

### `payments`

```ts
// driving (StartCardPayment is the open host service)
export type StartCardPayment = (input: { orderRef: OrderRef; amount: Money; email: string }) =>
  Promise<Result<{ secret: string }, { code: "providerUnavailable" }>>;
export type ConfirmCardPayment = (orderRef: OrderRef) => Promise<void>;
export type CancelCardPayment = (orderRef: OrderRef) => Promise<void>;
export type RefundCardPayment = (input: { orderRef: OrderRef; reason: "operator" | "paidAfterCancellation" }) =>
  Promise<Result<{ status: "refundRequested" | "refunded" }, RefundRefusal>>;
export type RefundRefusal = { code: "disputed" } | { code: "notCaptured" } | { code: "unknownPayment" };
export type SubmitRefund = (orderRef: OrderRef) => Promise<void>;                 // private
export type RecordProviderEvent = (event: CardProviderEvent) => Promise<void>;   // succeeded | refunded | disputed | refundFailed
export type CancelUnconfirmedCardPayments = () => Promise<{ cancelled: number }>;
export type ReconcileCardPayments = () => Promise<{ repaired: number }>;

// driven
export interface UnitOfWork { run<T>(work: (tx: { payments: CardPaymentRepository; outbox: PaymentsOutbox }) => Promise<T>): Promise<T> }
export interface CardPaymentRepository {
  loadByOrder(ref: OrderRef): Promise<CardPayment | null>;
  loadByProviderRef(ref: ProviderRef): Promise<CardPayment | null>;
  findUnconfirmedSince(before: Date, limit: number): Promise<readonly CardPayment[]>;
  findOpenSince(before: Date, limit: number): Promise<readonly CardPayment[]>;
  save(p: CardPayment): Promise<void>;
}
export interface PaymentsOutbox { write(message: PaymentsOutgoing): Promise<void> }
export interface CardProvider {
  createIntent(input: { paymentId: CardPaymentId; amount: Money; email: string; idempotencyKey: string }):
    Promise<Result<{ providerRef: ProviderRef; secret: string }, { code: "providerUnavailable" }>>;
  cancelIntent(input: { providerRef: ProviderRef; idempotencyKey: string }):
    Promise<Result<void, { code: "alreadySucceeded" } | { code: "providerUnavailable" }>>;
  refund(input: { providerRef: ProviderRef; amount: Money; idempotencyKey: string }):
    Promise<Result<{ providerRefundRef: string }, { code: "disputed" } | { code: "providerUnavailable" }>>;
  status(providerRef: ProviderRef): Promise<CardProviderEvent | null>;
}
export interface Clock { now(): Date }
export interface IdGenerator { cardPaymentId(): CardPaymentId }
```

Adapters: `stripe/card-provider.ts` (anti-corruption layer; Stripe idempotency keys `pi:<orderRef>`,
`cancel:<paymentId>`, `refund:<paymentId>`; maps `charge_disputed` to `disputed`);
`postgres/`; `fakes/`; driving `hooks/stripe-webhook.ts` (verifies signature, translates
`payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.refund.updated`
failure to `CardProviderEvent`, answers 200 after commit, 500 otherwise), `admin/refund-action.ts`,
`handlers/ordering-order-placed.ts` (confirm), `handlers/ordering-order-cancelled.ts` (cancel),
`handlers/refund-card-payment-command.ts`, `handlers/submit-refund.ts` (private),
`scheduled/cancel-unconfirmed-card-payments.ts`, `scheduled/reconcile-card-payments.ts`.

### `billing`

```ts
// driving
export type IssueInvoiceForOrder = (order: InvoiceableOrder /* orderRef, customerRef, email, address, paymentMethod, lines, trigger: "placed" | "paid" */) =>
  Promise<Result<{ invoiceNumber: InvoiceNumber } | { skipped: "notInvoiceableNow" }, never>>;
export type IssueCreditNoteForRefund = (input: { orderRef: OrderRef; refundRef: string; amount: Money; refundedAt: Date }) =>
  Promise<Result<{ creditNoteNumber: CreditNoteNumber }, { code: "noInvoice" }>>;
export type CloseInvoiceOnCancellation = (input: { orderRef: OrderRef; cancelledAt: Date }) => Promise<void>;
export type RecordIncomingTransfer = (transfer: IncomingTransfer /* transferId, amount, reference, bookedAt */) =>
  Promise<{ outcome: "matched"; invoiceNumber: InvoiceNumber } | { outcome: "unmatched" }>;
export type AssignTransfer = (input: { transferId: TransferId; invoiceNumber: InvoiceNumber }) =>
  Promise<Result<void, { code: "alreadyAssigned" } | { code: "invoiceNotOpen" } | { code: "amountMismatch" }>>;
export type RunDunning = () => Promise<{ advanced: number; cleared: number }>;
export type SendDunningReminder = (input: { customerRef: CustomerRef; stage: 1 | 2 | 3 }) => Promise<void>; // private
export type ReconcileBankTransfers = () => Promise<{ recorded: number }>;
export type ListInvoices = (query: { status?: InvoiceStatus; page: number }) => Promise<InvoicePage>;
export type ListUnmatchedTransfers = (page: number) => Promise<TransferPage>;

// driven
export interface UnitOfWork { run<T>(work: (tx: BillingTx) => Promise<T>): Promise<T> }
export type BillingTx = {
  invoices: InvoiceRepository; creditNotes: CreditNoteRepository; numbers: NumberSeries;
  transfers: BankTransferRepository; dunning: DunningAccountRepository; outbox: BillingOutbox;
};
export interface NumberSeries { next(series: "invoice" | "creditNote", year: number): Promise<number> } // SELECT ... FOR UPDATE
export interface InvoiceRepository {
  loadByOrder(ref: OrderRef): Promise<Invoice | null>; loadByNumber(n: InvoiceNumber): Promise<Invoice | null>;
  findOpen(): Promise<readonly Invoice[]>; findOverdue(asOf: Date): Promise<readonly Invoice[]>; save(i: Invoice): Promise<void>;
}
export interface CreditNoteRepository { loadByRefund(refundRef: string): Promise<CreditNote | null>; save(c: CreditNote): Promise<void> }
export interface BankTransferRepository { load(id: TransferId): Promise<BankTransfer | null>; save(t: BankTransfer): Promise<void> }
export interface DunningAccountRepository { load(c: CustomerRef): Promise<DunningAccount>; save(a: DunningAccount): Promise<void> }
export interface BillingOutbox { write(message: BillingOutgoing): Promise<void> }
export interface BankStatements { listIncoming(since: Date): Promise<readonly IncomingTransfer[]> }
export interface ReminderMailer { send(input: { account: DunningAccount; invoices: readonly Invoice[]; idempotencyKey: string }): Promise<void> }
export interface BillingQueries { invoices(q: { status?: InvoiceStatus; page: number }): Promise<InvoicePage>; unmatched(page: number): Promise<TransferPage> }
export interface Clock { now(): Date }
```

Adapters: `postgres/`; `bank/bank-statements.ts` (anti-corruption layer); `mail/reminder-mailer.ts`;
`fakes/`; driving `hooks/bank-webhook.ts`, `admin/invoices-panel.ts`, `admin/assign-transfer-action.ts`,
`handlers/ordering-order-placed.ts`, `handlers/ordering-order-paid.ts`, `handlers/ordering-order-cancelled.ts`,
`handlers/payments-card-payment-refunded.ts`, `handlers/send-dunning-reminder.ts` (private),
`scheduled/run-dunning.ts`, `scheduled/reconcile-bank-transfers.ts`.

### `fulfilment`

```ts
// driving
export type RequestShipment = (input: { orderRef: OrderRef; address: Address; lines: readonly { sku: Sku; quantity: number }[] }) =>
  Promise<Result<void, { code: "undeliverable"; country: string }>>;
export type SubmitShipment = (orderRef: OrderRef) => Promise<void>;                     // private
export type RegisterArticle = (input: { sku: Sku; title: string; sourceVersion: string }) => Promise<void>;
export type SubmitArticle = (sku: Sku) => Promise<void>;                                 // private
export type RecordWarehouseShipment = (report: WarehouseShipmentReport /* warehouseShipmentId, orderRef, status, lines, at, trackingNumber */) => Promise<void>;
export type ReconcileStockLevels = () => Promise<{ reported: number }>;
export type ReconcileShipments = () => Promise<{ repaired: number }>;
export type ListShipments = (query: { status?: ShipmentStatus; page: number }) => Promise<ShipmentPage>;

// driven
export interface UnitOfWork { run<T>(work: (tx: FulfilmentTx) => Promise<T>): Promise<T> }
export type FulfilmentTx = { shipments: ShipmentRepository; articles: ArticleRepository; stockReports: StockReportRepository; outbox: FulfilmentOutbox };
export interface Warehouse {
  findOutboundOrder(orderRef: OrderRef): Promise<{ warehouseRef: string } | null>;
  createOutboundOrder(input: { orderRef: OrderRef; address: Address; lines: readonly { sku: Sku; quantity: number }[] }):
    Promise<Result<{ warehouseRef: string }, { code: "rejected"; reason: string } | { code: "unavailable" }>>;
  upsertArticle(input: { sku: Sku; title: string }): Promise<Result<void, { code: "unavailable" }>>;
  stockLevels(): Promise<readonly { sku: Sku; onHand: number; at: Date }[]>;
  outboundOrder(warehouseRef: string): Promise<WarehouseShipmentReport | null>;
}
export interface Clock { now(): Date }
export interface IdGenerator { shipmentId(): ShipmentId }
```

Adapters: `warehouse/warehouse.ts` (anti-corruption layer; "outbound order" is the 3PL's term,
"shipment" is ours); `postgres/`; `fakes/`; driving `hooks/warehouse-webhook.ts`,
`admin/shipments-panel.ts`, `handlers/ship-order-command.ts`, `handlers/catalog-product-changed.ts`,
`handlers/submit-shipment.ts`, `handlers/submit-article.ts`, `scheduled/reconcile-stock-levels.ts`,
`scheduled/reconcile-shipments.ts`.

### `storefront`

```ts
// driving
export type ListProducts = () => Promise<readonly ProductCard[]>;
export type GetProductPage = (slug: string) => Promise<ProductPage | null>;
export type InvalidateProductPages = (change: { slug: string; previousSlug: string | null }) => Promise<void>;

// driven (conformist: Payload's generated `Product` type is used untranslated)
import type { Product } from "@shop/payload-catalog/offer";
export interface Catalog { listActive(): Promise<readonly Product[]>; bySlug(slug: string): Promise<Product | null> }
export interface PageCache { invalidate(tags: readonly string[]): Promise<void> }
```

Adapters: `payload/catalog.ts` (Payload Local API, `overrideAccess: false`, wrapped in
`unstable_cache` with tags `products`, `product:<slug>`); `next/page-cache.ts` (`revalidateTag`);
`fakes/`; driving `pages/product-list.ts`, `pages/product-page.ts` (called by the shop UI shims),
`handlers/catalog-product-changed.ts`, `handlers/catalog-product-deleted.ts`.

### Outbox, outbox reader, handler, envelope (`@shop/messaging`)

```ts
export type Envelope = {
  readonly id: string;                 // UUIDv7, the same on every delivery
  readonly type: string;               // "ordering.OrderPlaced"
  readonly version: number;            // 1, 2, ...
  readonly source: string;             // "ordering" | "payload-catalog" | ...
  readonly occurredAt: string;
  readonly headers: { readonly traceparent?: string; readonly tracestate?: string; readonly requestId?: string };
  readonly payload: unknown;
};
export interface OutboxReader {
  readonly source: string;
  readBatch(limit: number): Promise<readonly Envelope[]>;   // undelivered, ordered by seq
  markDelivered(ids: readonly string[]): Promise<void>;
}
export interface Handler {
  readonly name: string;                         // queue name, "inventory.ordering-order-placed"
  readonly subscribesTo: readonly string[];      // envelope types
  handle(envelope: Envelope): Promise<void>;     // throw → retry with backoff
}
```

## Calls and messages

### Synchronous calls

| From | To | Through | When | Refusal comes back as |
|---|---|---|---|---|
| browser (UI) | `ordering` | `POST /api/cart`, `POST /api/checkout/options`, `POST /api/checkout` | cart, checkout | `Result` error → HTTP 409 (`outOfStock`, `cartChanged`), 422 (`invoiceNotOffered`, `cartEmpty`, `productUnavailable`), 503 (`cardPaymentUnavailable`); body `{ code, ... }` |
| `ordering` | `inventory` | `ordering` driven port `StockReservations` → in-process call of `inventory` open host service `ReserveStock` | inside `PlaceOrder`, before the order commits | `insufficientStock` → `ordering` translates to `outOfStock` |
| `ordering` | `payments` | driven port `CardPayments` → `payments` open host service `StartCardPayment` | inside `PlaceOrder` for card, before the order commits | `providerUnavailable` → `cardPaymentUnavailable` |
| `payments` | Stripe | `CardProvider` | `createIntent` in `StartCardPayment`; `cancelIntent`, `refund`, `status` only in handlers and scheduled tasks | Stripe errors mapped to `Result` errors; network errors thrown |
| `fulfilment` | 3PL | `Warehouse` | only in handlers (`SubmitShipment`, `SubmitArticle`) and scheduled tasks | `rejected` → shipment refused; `unavailable` → throw, bus retries |
| `billing` | bank | `BankStatements` | `ReconcileBankTransfers` | thrown, task retries next run |
| `ordering`, `billing` | mail provider | `ConfirmationMailer`, `ReminderMailer` | only in handlers of private messages | thrown, bus retries |
| Payload admin | `inventory` | hook `payload/stock-field.tsx` → `GetStockLevels` | rendering a product in the admin | none (answering); unknown sku shows 0 |
| Payload admin | `ordering`, `payments`, `billing`, `fulfilment` | hooks `admin/*-panel.ts`, `admin/*-action.ts` in the `/admin/operations` view | dashboard, refund, assign transfer, cancel order | `Result` error rendered in the view |
| shop UI | `storefront` | `pages/*.ts` | rendering | none |
| `storefront` | Payload | `Catalog` → Payload Local API (in-process) | rendering (cached) | none |
| `storefront` | Next data cache | `PageCache` → `revalidateTag` | handler | none |
| Stripe | `payments` | hook `POST /api/hooks/stripe` | provider events | non-2xx → Stripe redelivers |
| 3PL | `fulfilment` | hook `POST /api/hooks/warehouse` | shipment reports | non-2xx → 3PL redelivers; reconciliation catches the rest |
| bank | `billing` | hook `POST /api/hooks/bank` | incoming transfers | non-2xx → bank redelivers; reconciliation catches the rest |

### Messages

All asynchronous: written to the publisher's outbox in the use case's transaction, read by the
relay, delivered by the bus. Refusals of commands come back as events of the refusing system.

| Message (type, version) | Kind | Publisher | Subscribers (handler) | Refusal |
|---|---|---|---|---|
| `catalog.ProductChanged` v1 `{productId, slug, previousSlug, sku, title, priceCents, taxClass, active, updatedAt}` | event, published | Payload (`catalog-outbox`, our configuration) | `ordering` (refresh replica), `fulfilment` (register article), `storefront` (invalidate pages, in `web`) | — |
| `catalog.ProductDeleted` v1 `{productId, slug, sku, updatedAt}` | event, published | Payload | `ordering`, `storefront` | — |
| `ordering.OrderPlaced` v1 `{orderId, customerId, email, billingAddress, shippingAddress, paymentMethod, lines[{productId, sku, title, unitPrice, quantity, taxClass}], total, placedAt}` | event, published | `ordering` | `inventory` (confirm reservation), `payments` (confirm card payment), `billing` (invoice if method is invoice) | — |
| `ordering.OrderPaid` v1 `{orderId, paymentMethod, paidAt, lines, total, customerId, email, billingAddress}` | event, published | `ordering` | `billing` (invoice if method is card) | — |
| `ordering.OrderCancelled` v1 `{orderId, reason, cancelledAt}` | event, published | `ordering` | `inventory` (release), `payments` (cancel intent), `billing` (credit note if an unpaid invoice exists) | — |
| `ordering.SendOrderConfirmation` v1 `{orderId}` | command, private | `ordering` | `ordering` | — |
| `fulfilment.ShipOrder` v1 `{orderRef, address, lines[{sku, quantity}]}` | command, published (fulfilment's published language) | `ordering` (process manager step) | `fulfilment` | `fulfilment.ShipmentRefused` |
| `payments.RefundCardPayment` v1 `{orderRef, reason}` | command, published (payments' published language) | `ordering` (paid after cancellation, or operator cancels a paid order) | `payments` | `payments.RefundRefused` |
| `payments.CardPaymentSucceeded` v1 `{orderRef, paymentId, amount, succeededAt}` | event | `payments` | `ordering` | — |
| `payments.CardPaymentRefunded` v1 `{orderRef, refundRef, amount, refundedAt}` | event | `payments` | `ordering`, `billing` (credit note) | — |
| `payments.CardPaymentDisputed` v1 `{orderRef, disputedAt}` | event | `payments` | `ordering` | — |
| `payments.RefundRefused` v1 `{orderRef, reason: "disputed" \| "notCaptured"}` | event | `payments` | `ordering` | — |
| `payments.SubmitRefund` v1 `{orderRef}` | command, private | `payments` | `payments` | — |
| `billing.InvoiceIssued` v1 `{invoiceNumber, orderRef, customerRef, total, dueDate}` | event | `billing` | none yet | — |
| `billing.InvoicePaid` v1 `{invoiceNumber, orderRef, paidAt}` | event | `billing` | `ordering` | — |
| `billing.CreditNoteIssued` v1 `{creditNoteNumber, invoiceNumber, amount}` | event | `billing` | none yet | — |
| `billing.CustomerDunningStatusChanged` v1 `{customerRef, inDunning, stage, sequence}` | event | `billing` | `ordering` (replica) | — |
| `billing.SendDunningReminder` v1 `{customerRef, stage}` | command, private | `billing` | `billing` | — |
| `fulfilment.ShipmentDispatched` v1 `{orderRef, shipmentId, lines, dispatchedAt, trackingNumber}` | event | `fulfilment` | `ordering`, `inventory` (record dispatch) | — |
| `fulfilment.ShipmentRefused` v1 `{orderRef, reason}` | event | `fulfilment` | `ordering` | — |
| `fulfilment.StockLevelReported` v1 `{sku, onHand, reportedAt}` | event | `fulfilment` | `inventory` (replica) | — |
| `fulfilment.SubmitShipment` v1, `fulfilment.SubmitArticle` v1 | commands, private | `fulfilment` | `fulfilment` | — |

Routing: the relay calls `boss.publish(type, envelope)`; each `Handler` is a `pg-boss` queue
subscribed to its types (`boss.subscribe(type, handler.name)`). At startup assembly checks that
every command type has exactly one subscribing system and every private type only its own system.

### Main flows

- **Card checkout.** `PlaceOrder`: read tx (cart, customer, dunning status, product replica) →
  domain `decideCheckout` → `StockReservations.reserve` (tentative, keyed by the new `orderId`) →
  `CardPayments.start` (payments commits a tentative `CardPayment`, then Stripe `createIntent` with
  key `pi:<orderId>`) → write tx: cart still at its read version, save order `awaitingPayment`
  with deadline placedAt+60 min, outbox `OrderPlaced`, `SendOrderConfirmation` → answer with the
  secret. A conflict on the write tx retries the whole use case with the same `orderId`; reserve and
  start are idempotent by it.
- **Payment.** Stripe → hook → `payments` `succeeded` + `CardPaymentSucceeded` → `ordering`
  `paid`, outbox `OrderPaid` + `ShipOrder` → `billing` invoice; `fulfilment` shipment.
- **Invoice checkout.** As above without `CardPayments`; order `shipmentRequested` at once; outbox
  `OrderPlaced`, `ShipOrder`, `SendOrderConfirmation`; `billing` issues the invoice on `OrderPlaced`.
  Bank transfer → hook → match → `InvoicePaid` → `ordering` `paid`.
- **Deadline.** `cancel-overdue-orders` every minute → `OrderCancelled` → inventory releases,
  payments cancels the intent; if Stripe says already succeeded, payments records success and
  publishes `CardPaymentSucceeded`; `ordering` sees a payment on a cancelled order → `RefundCardPayment`.
- **Shipping.** `ShipOrder` → `RequestShipment` (refuses non-DE/AT) → `SubmitShipment` (private)
  once all articles are registered → 3PL; webhook → `ShipmentDispatched` → `ordering` `shipped`,
  `inventory` consumes the reservation.

## Processes

| Process | Image / entry point | Runs | Assembly |
|---|---|---|---|
| `web` (N replicas) | `apps/web`, `next start`; `src/instrumentation.ts` `register()` | Payload admin and REST, shop pages, `/api/cart`, `/api/checkout/*`, `/api/hooks/{stripe,warehouse,bank}`, `/health`; a `pg-boss` consumer for `storefront` handlers only; Prometheus exporter on `:9464/metrics` | `src/assembly/assemble.ts` `assembleWeb(config)`: OTel SDK, `pg-boss` (send-only plus storefront queues), `buildInventory`, `buildPayments`, `buildBilling`, `buildFulfilment`, `buildOrdering(..., { reserveStock, startCardPayment })`, `buildStorefront(..., { payload })`; stores the result in the courier |
| `worker` (N replicas) | `apps/worker`, `node dist/main.js` | relay (one active, `pg_try_advisory_lock(4711)`), `pg-boss` consumers for all handlers except `storefront`, schedules, `node:http` `/health`, `:9464/metrics`; SIGTERM: stop relay, `boss.stop({ graceful: true, timeout: 30_000 })`, close pools | `src/assembly/assemble.ts` `assembleWorker(config)`: every builder except storefront, plus `payload-outbox-reader.ts` built here for Payload's outbox |
| `migrate` (one-shot, before every deploy) | `apps/migrate`, `node dist/main.js` | `bootstrap.ts` (idempotent: schemas, login roles, grants: each role USAGE and DML on its own schema only, `probe` role with CONNECT only), `payload migrate` (Payload's own migrations, including `catalog-outbox`), every system builder's `migrate()` (`drizzle-orm/node-postgres/migrator`, `migrationsSchema` = the system's schema), `pg-boss` schema | `src/main.ts` calls builders' `migrations` export with the `migrator` role |

Configuration values: each app's `src/config.ts` parses `process.env` once with zod into a typed
object; builders receive their slice (`OrderingConfig = { databaseUrl, cardPaymentWindowMinutes: 60, mail: {...} }`).
`process.env` is read nowhere else.

Schedules (`boss.schedule`, cluster-wide once, Europe/Berlin): `ordering.cancel-overdue-orders`
`* * * * *`; `inventory.expire-reservations` `* * * * *`; `payments.cancel-unconfirmed` `*/10 * * * *`;
`payments.reconcile` `15 * * * *`; `billing.run-dunning` `0 6 * * *`; `billing.reconcile-bank`
`30 * * * *`; `fulfilment.reconcile-stock` `0 * * * *`; `fulfilment.reconcile-shipments` `45 * * * *`.

Bus queues: `retryLimit: 12`, `retryBackoff: true`, `retryDelay: 5`, `deadLetter: "dead-letters"`;
dead letters are counted in a metric and listed in `/admin/operations`.

Migrations follow expand/contract: a release ships only additive migrations; drops and renames
ship in a later release after no running code reads the old shape (`tooling/migrations/lint.ts`
fails a migration that drops or renames in the same release that stops using it).

Observability: `@shop/observability` starts `NodeSDK` (OTLP HTTP to Jaeger `:4318`,
instrumentations `http`, `undici`, `pg`, `pino`), W3C trace context. Driving adapters run inside
`runWithRequestContext({ requestId, traceparent })` (ALS, per request); the request id comes from
the `x-request-id` header or is generated. Outbox adapters copy `requestId`, `traceparent`,
`tracestate` into envelope headers; the bus consumer restores them into ALS and starts a consumer
span with the extracted context. pino `mixin` adds `requestId`, `trace_id`, `span_id`.

## Directory tree

```
shop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .dependency-cruiser.cjs
├── docker/
│   ├── web.Dockerfile
│   ├── worker.Dockerfile
│   └── migrate.Dockerfile
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts                     # withPayload
│   │   ├── src/
│   │   │   ├── instrumentation.ts             # OTel, assembleWeb, courier.set, storefront consumer
│   │   │   ├── config.ts
│   │   │   ├── payload.config.ts              # buildPayloadConfig(config.payload)
│   │   │   ├── assembly/
│   │   │   │   ├── assemble.ts
│   │   │   │   └── courier.ts                 # globalThis-keyed Promise<WebAssembly>
│   │   │   ├── payload-components/
│   │   │   │   ├── stock-field.tsx            # shim → courier → inventory stock field
│   │   │   │   └── operations-view.tsx        # shim → courier → four admin panels
│   │   │   └── app/
│   │   │       ├── (payload)/admin/[[...segments]]/page.tsx
│   │   │       ├── (payload)/api/[...slug]/route.ts
│   │   │       ├── (shop)/page.tsx
│   │   │       ├── (shop)/products/[slug]/page.tsx
│   │   │       ├── (shop)/cart/page.tsx
│   │   │       ├── (shop)/checkout/page.tsx
│   │   │       ├── api/cart/route.ts
│   │   │       ├── api/checkout/options/route.ts
│   │   │       ├── api/checkout/route.ts
│   │   │       ├── api/hooks/stripe/route.ts
│   │   │       ├── api/hooks/warehouse/route.ts
│   │   │       ├── api/hooks/bank/route.ts
│   │   │       └── health/route.ts
│   │   └── test/assembly/assemble.test.ts
│   ├── worker/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── config.ts
│   │   │   ├── assembly/
│   │   │   │   ├── assemble.ts
│   │   │   │   └── payload-outbox-reader.ts
│   │   │   └── probe-server.ts                # /health
│   │   └── test/assembly/assemble.test.ts
│   └── migrate/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── config.ts
│           └── bootstrap.ts
├── packages/
│   ├── shared-kernel/money/
│   │   ├── package.json
│   │   ├── src/money.ts
│   │   └── test/money.test.ts
│   ├── lib/
│   │   ├── result/src/result.ts
│   │   ├── messaging/src/{envelope.ts,outbox-table.ts,postgres-outbox-reader.ts}
│   │   ├── postgres/src/{pool.ts,concurrency-conflict.ts,optimistic-update.ts}
│   │   └── observability/src/{logger.ts,otel.ts,request-context.ts,probes/health.ts}
│   ├── platform/bus/
│   │   ├── src/{relay.ts,pg-boss-bus.ts,routing-check.ts,consumer-context.ts}
│   │   └── test/{relay.test.ts,routing-check.test.ts}
│   ├── external/payload-catalog/
│   │   ├── package.json                       # exports "./config", "./offer"
│   │   ├── migrations/                        # Payload's own
│   │   ├── src/
│   │   │   ├── config.ts                      # buildPayloadConfig
│   │   │   ├── collections/{products.ts,catalog-outbox.ts,media.ts,users.ts}
│   │   │   ├── hooks/{write-outbox.ts,sku-immutable.ts}
│   │   │   ├── payload-types.ts               # generated
│   │   │   └── offer/{index.ts,published-language.ts}   # ProductChanged, ProductDeleted, Product
│   │   └── test/hooks/write-outbox.test.ts
│   └── systems/
│       ├── ordering/
│       │   ├── package.json                   # exports "./offer" only
│       │   ├── GLOSSARY.md
│       │   ├── drizzle.config.ts              # schemaFilter ["ordering"]
│       │   ├── drizzle/                       # 0000_init.sql, meta/
│       │   ├── src/
│       │   │   ├── domain/
│       │   │   │   ├── cart.ts
│       │   │   │   ├── customer.ts
│       │   │   │   ├── order.ts               # process manager: status, transitions, next commands
│       │   │   │   ├── order-line.ts          # snapshot of price, sku, tax class
│       │   │   │   ├── checkout.ts            # decideCheckout
│       │   │   │   ├── invoice-payment-offered.ts   # specification
│       │   │   │   ├── payment-deadline.ts
│       │   │   │   ├── catalog-product.ts
│       │   │   │   └── ids.ts
│       │   │   ├── service/
│       │   │   │   ├── add-to-cart.ts
│       │   │   │   ├── view-cart.ts
│       │   │   │   ├── get-checkout-options.ts
│       │   │   │   ├── place-order.ts
│       │   │   │   ├── cancel-order.ts
│       │   │   │   ├── cancel-overdue-orders.ts
│       │   │   │   ├── send-order-confirmation.ts
│       │   │   │   ├── record-card-payment-succeeded.ts
│       │   │   │   ├── record-card-payment-refunded.ts
│       │   │   │   ├── record-card-payment-disputed.ts
│       │   │   │   ├── record-refund-refused.ts
│       │   │   │   ├── record-invoice-paid.ts
│       │   │   │   ├── record-shipment-dispatched.ts
│       │   │   │   ├── record-shipment-refused.ts
│       │   │   │   ├── refresh-product.ts
│       │   │   │   ├── forget-product.ts
│       │   │   │   ├── record-dunning-status.ts
│       │   │   │   ├── list-orders.ts
│       │   │   │   └── with-conflict-retry.ts
│       │   │   ├── ports/
│       │   │   │   ├── driving.ts
│       │   │   │   └── driven/{unit-of-work.ts,repositories.ts,product-replica.ts,dunning-replica.ts,outbox.ts,stock-reservations.ts,card-payments.ts,confirmation-mailer.ts,order-queries.ts,clock.ts,id-generator.ts}
│       │   │   ├── adapters/
│       │   │   │   ├── driven/
│       │   │   │   │   ├── postgres/{schema.ts,unit-of-work.ts,cart-repository.ts,order-repository.ts,customer-repository.ts,product-replica.ts,dunning-replica.ts,outbox.ts,outbox-reader.ts,order-queries.ts}
│       │   │   │   │   ├── inventory/stock-reservations.ts
│       │   │   │   │   ├── payments/card-payments.ts
│       │   │   │   │   ├── mail/confirmation-mailer.ts
│       │   │   │   │   └── fakes/{in-memory-unit-of-work.ts,in-memory-repositories.ts,fake-stock-reservations.ts,fake-card-payments.ts,recording-mailer.ts,fixed-clock.ts,sequential-ids.ts}
│       │   │   │   └── driving/
│       │   │   │       ├── http/{cart.ts,checkout-options.ts,checkout.ts,refusal-status.ts}
│       │   │   │       ├── admin/{orders-panel.ts,cancel-order-action.ts}
│       │   │   │       ├── handlers/{catalog-product-changed.ts,catalog-product-deleted.ts,payments-card-payment-succeeded.ts,payments-card-payment-refunded.ts,payments-card-payment-disputed.ts,payments-refund-refused.ts,billing-invoice-paid.ts,billing-dunning-status-changed.ts,fulfilment-shipment-dispatched.ts,fulfilment-shipment-refused.ts,send-order-confirmation.ts}
│       │   │   │       └── scheduled/cancel-overdue-orders.ts
│       │   │   ├── offer/{index.ts,published-language.ts,builder.ts}
│       │   │   └── builder.ts                 # buildOrdering(config, held, upstream)
│       │   └── test/                          # mirrors src: domain/order.test.ts, service/place-order.test.ts, adapters/driven/postgres/order-repository.integration.test.ts, ...
│       ├── inventory/
│       │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│       │   ├── src/
│       │   │   ├── domain/{stock-item.ts,reservation.ts,availability.ts,ids.ts}
│       │   │   ├── service/{reserve-stock.ts,get-stock-levels.ts,confirm-reservation.ts,release-reservation.ts,record-dispatch.ts,record-reported-level.ts,expire-reservations.ts,with-conflict-retry.ts}
│       │   │   ├── ports/{driving.ts,driven/{unit-of-work.ts,stock-item-repository.ts,clock.ts}}
│       │   │   ├── adapters/
│       │   │   │   ├── driven/{postgres/{schema.ts,unit-of-work.ts,stock-item-repository.ts},fakes/{in-memory-unit-of-work.ts,fixed-clock.ts}}
│       │   │   │   └── driving/{payload/stock-field.tsx,handlers/{ordering-order-placed.ts,ordering-order-cancelled.ts,fulfilment-shipment-dispatched.ts,fulfilment-stock-level-reported.ts},scheduled/expire-reservations.ts}
│       │   │   ├── offer/{index.ts,published-language.ts,fakes.ts,builder.ts}   # ReserveStock, GetStockLevels, FakeInventory
│       │   │   └── builder.ts
│       │   └── test/
│       ├── payments/
│       │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│       │   ├── src/
│       │   │   ├── domain/{card-payment.ts,refund-policy.ts,provider-event.ts,ids.ts}
│       │   │   ├── service/{start-card-payment.ts,confirm-card-payment.ts,cancel-card-payment.ts,refund-card-payment.ts,submit-refund.ts,record-provider-event.ts,cancel-unconfirmed-card-payments.ts,reconcile-card-payments.ts,with-conflict-retry.ts}
│       │   │   ├── ports/{driving.ts,driven/{unit-of-work.ts,card-payment-repository.ts,outbox.ts,card-provider.ts,clock.ts,id-generator.ts}}
│       │   │   ├── adapters/
│       │   │   │   ├── driven/{stripe/card-provider.ts,postgres/{schema.ts,unit-of-work.ts,card-payment-repository.ts,outbox.ts,outbox-reader.ts},fakes/{in-memory-unit-of-work.ts,fake-card-provider.ts}}
│       │   │   │   └── driving/{hooks/stripe-webhook.ts,admin/refund-action.ts,handlers/{ordering-order-placed.ts,ordering-order-cancelled.ts,refund-card-payment-command.ts,submit-refund.ts},scheduled/{cancel-unconfirmed-card-payments.ts,reconcile-card-payments.ts}}
│       │   │   ├── offer/{index.ts,published-language.ts,fakes.ts,builder.ts}   # StartCardPayment, FakeStartCardPayment, RefundCardPayment command
│       │   │   └── builder.ts
│       │   └── test/
│       ├── billing/
│       │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│       │   ├── src/
│       │   │   ├── domain/{invoice.ts,invoice-line.ts,vat-rates.ts,credit-note.ts,number-series.ts,bank-transfer.ts,transfer-matching.ts,dunning-account.ts,dunning-policy.ts,invoicing-policy.ts,ids.ts}
│       │   │   ├── service/{issue-invoice-for-order.ts,issue-credit-note-for-refund.ts,close-invoice-on-cancellation.ts,record-incoming-transfer.ts,assign-transfer.ts,run-dunning.ts,send-dunning-reminder.ts,reconcile-bank-transfers.ts,list-invoices.ts,list-unmatched-transfers.ts,with-conflict-retry.ts}
│       │   │   ├── ports/{driving.ts,driven/{unit-of-work.ts,repositories.ts,number-series.ts,outbox.ts,bank-statements.ts,reminder-mailer.ts,billing-queries.ts,clock.ts}}
│       │   │   ├── adapters/
│       │   │   │   ├── driven/{postgres/{schema.ts,unit-of-work.ts,invoice-repository.ts,credit-note-repository.ts,number-series.ts,bank-transfer-repository.ts,dunning-account-repository.ts,outbox.ts,outbox-reader.ts,billing-queries.ts},bank/bank-statements.ts,mail/reminder-mailer.ts,fakes/{in-memory-unit-of-work.ts,fake-bank-statements.ts,recording-mailer.ts}}
│       │   │   │   └── driving/{hooks/bank-webhook.ts,admin/{invoices-panel.ts,assign-transfer-action.ts},handlers/{ordering-order-placed.ts,ordering-order-paid.ts,ordering-order-cancelled.ts,payments-card-payment-refunded.ts,send-dunning-reminder.ts},scheduled/{run-dunning.ts,reconcile-bank-transfers.ts}}
│       │   │   ├── offer/{index.ts,published-language.ts,builder.ts}
│       │   │   └── builder.ts
│       │   └── test/
│       ├── fulfilment/
│       │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│       │   ├── src/
│       │   │   ├── domain/{shipment.ts,article.ts,stock-report.ts,delivery-countries.ts,submission-lease.ts,ids.ts}
│       │   │   ├── service/{request-shipment.ts,submit-shipment.ts,register-article.ts,submit-article.ts,record-warehouse-shipment.ts,reconcile-stock-levels.ts,reconcile-shipments.ts,list-shipments.ts,with-conflict-retry.ts}
│       │   │   ├── ports/{driving.ts,driven/{unit-of-work.ts,repositories.ts,outbox.ts,warehouse.ts,clock.ts,id-generator.ts}}
│       │   │   ├── adapters/
│       │   │   │   ├── driven/{warehouse/warehouse.ts,postgres/{schema.ts,unit-of-work.ts,shipment-repository.ts,article-repository.ts,stock-report-repository.ts,outbox.ts,outbox-reader.ts},fakes/{in-memory-unit-of-work.ts,fake-warehouse.ts}}
│       │   │   │   └── driving/{hooks/warehouse-webhook.ts,admin/shipments-panel.ts,handlers/{ship-order-command.ts,catalog-product-changed.ts,submit-shipment.ts,submit-article.ts},scheduled/{reconcile-stock-levels.ts,reconcile-shipments.ts}}
│       │   │   ├── offer/{index.ts,published-language.ts,builder.ts}   # ShipOrder command, events
│       │   │   └── builder.ts
│       │   └── test/
│       └── storefront/
│           ├── package.json, GLOSSARY.md
│           ├── src/
│           │   ├── domain/pages-to-invalidate.ts
│           │   ├── service/{list-products.ts,get-product-page.ts,invalidate-product-pages.ts}
│           │   ├── ports/{driving.ts,driven/{catalog.ts,page-cache.ts}}
│           │   ├── adapters/
│           │   │   ├── driven/{payload/catalog.ts,next/page-cache.ts,fakes/{fake-catalog.ts,recording-page-cache.ts}}
│           │   │   └── driving/{pages/{product-list.ts,product-page.ts},handlers/{catalog-product-changed.ts,catalog-product-deleted.ts}}
│           │   ├── offer/{index.ts,builder.ts}
│           │   └── builder.ts
│           └── test/
└── tooling/
    ├── architecture/
    │   ├── relationships.ts                   # per system: upstreams and kind (acl | conformist | shared-kernel)
    │   └── generate-depcruise-rules.ts
    ├── migrations/lint.ts
    └── test/testcontainers-postgres.ts
```

`offer/builder.ts` re-exports `src/builder.ts`; `package.json` `exports` maps `"./offer"` only, so
nothing outside a system can import its domain, service, ports or adapters.

## How each property holds

**P1.** Domain modules import only their own domain, `@shop/kernel-money` and `@shop/result`;
dependency-cruiser rule `domain-imports` fails the build otherwise, so no Drizzle, Stripe, Next,
Payload or `pg-boss` type can shape them. Aggregates are plain readonly objects with functions over
them (`order.ts` exports `markPaid(order, at): Result<Order, ...>`); the Postgres row shape lives in
`adapters/driven/postgres/schema.ts` and is mapped in the repository. The one exception is
`storefront`, which conforms to Payload: its domain and ports use Payload's generated `Product`
type, as the Except allows; its rule (which tags a change invalidates) is written by us.

**P2.** Every business rule of a system is a function in its `domain/`: invoice payment offered
(`invoice-payment-offered.ts`), payment deadline, snapshot of lines, refund policy, VAT rates,
gapless series, transfer matching, dunning stages, availability, delivery countries. Services only
sequence (load, call domain, save, write outbox). HTTP adapters do shape validation (zod) only;
Biome `noMagicNumbers` is on for `service/` and `adapters/` to catch rules
drifting outward. Price above zero and sku unique are Payload's own rules, held once, in its
configuration (`collections/products.ts`).

**P3.** Systems are cut by reason of change: tax law and dunning (billing), card provider rules
(payments), stock policy (inventory), 3PL integration and delivery countries (fulfilment), checkout
and order lifecycle (ordering). "In dunning" is decided where dunning stages live (billing
publishes `inDunning`), while "invoice not offered when in dunning" lives in ordering's checkout,
so a new dunning stage changes billing only. Within a system each aggregate and each policy has its
own module.

**P4.** Driving ports carry no caller identity and no transport: the HTTP route, the admin action
and a handler that call the same use case pass the same input type, and the service depends only on
driven port interfaces. Every driven port has a Postgres or vendor adapter and a fake, and the same
service test suite (`test/service/*.test.ts`) runs against fakes; the integration suite reruns the
repository contract tests (`test/adapters/driven/postgres/*.integration.test.ts`) against
Testcontainers Postgres, so swapping an adapter cannot change a response.

**P5.** Each service receives its driven ports as factory arguments, and only builders (called by
assembly) instantiate adapters; dependency-cruiser allows imports of `adapters/` only from
`builder.ts` and `test/`. Clock and ids are ports, `Date.now`, `new Date()` without arguments,
`Math.random` and `crypto.randomUUID` are banned by Biome `noRestrictedGlobals` in `domain/` and
`service/`. `process.env` is banned outside `apps/*/src/config.ts`. Every port is typed in the
system's terms (`Warehouse.createOutboundOrder` takes `OrderRef`, `Address`, `Sku`), translated in
the adapter. The Except covers `@shop/observability` (logger, spans, metrics): services and
adapters call it directly; its output (log lines, spans) never feeds back into a use case.

**P6.** Every driven port has a fake in `adapters/driven/fakes/`; every open host service a fake in
the upstream's `offer/fakes.ts` (`FakeInventory`, `FakeStartCardPayment`). The default suite builds
each use case with fakes only (`InMemoryUnitOfWork`, `FixedClock`, `SequentialIds`) and runs with
networking disabled (`vitest` setup throws on `net.connect`).

**P7.** Every acting use case writes inside one `UnitOfWork.run`, which is one Drizzle
`db.transaction` on the system's own pool; repositories and the outbox exist only as members of
that transaction's `tx` object, so a write outside it does not compile.

**P8.** Nothing final leaves before a commit: outgoing messages go through the outbox in the same
transaction; mails, 3PL submissions and Stripe refunds and cancellations run only in handlers of
private messages written by a committed use case; Payload writes `catalog-outbox` inside its own
transaction (afterChange with `req`), so page revalidation and article registration follow only
committed product changes. The two calls `PlaceOrder` makes before its commit are tentative
operations: a reservation expires after 30 min and a card payment is cancelled after 30 min unless
`OrderPlaced` confirms them, and the card secret reaches the browser only after the order commits,
so no customer can pay for an order that does not exist. After commit, nothing is lost: the outbox
row stays until the relay marks it, `pg-boss` keeps jobs until completed or dead-lettered, hooks
answer 2xx only after commit so the sender redelivers otherwise.

**P9.** Delivery is at least once; every handler's use case is idempotent by a domain key and
answers as the first time: reservation by `reservationId` (= order id), card payment by `orderRef`,
invoice by `orderRef` (unique), credit note by `refundRef` (unique), bank transfer by bank
transaction id, shipment by `orderRef`, warehouse report by warehouse shipment id, article by
sku+`sourceVersion`, replica rows by owner id with version check. A repeated delivery finds the
state already reached and writes nothing. A refusal is recorded (`refused` shipment state,
`RefundRefusal` on the payment) so a repeat answers the same refusal. Against F9 (Stripe, 3PL,
mail, bank): outgoing calls carry idempotency keys (Stripe, mail) or are preceded by a lookup by our
reference (`Warehouse.findOutboundOrder`) under a `submitting` lease of 5 min, so a call repeated
after a crash finds the first; incoming webhooks are deduplicated by the vendor's id.

**P10.** Aggregates carry `version`; `save` is `UPDATE ... WHERE id = $1 AND version = $2` and
throws `ConcurrencyConflict` on 0 rows; `withConflictRetry` reruns the use case (3 attempts), so a
use case commits only on the reads it made. `PlaceOrder` checks the cart's version again in its
write transaction. Stale reads accepted by a business rule: product replica ("the price is the one
the catalog published when the order was placed", lag of seconds), dunning replica ("a customer who
entered dunning in the last minutes may still choose invoice"), reported stock level (availability
as of the 3PL's last report). Use cases block or fail each other only where rules tie them: all
reservations of one sku (`StockItem` is the unit), all invoices and credit notes of one series and
year (`number_series` row `FOR UPDATE`, gaplessness), one order's lifecycle.

**P11.** One login role per system with grants on its own schema only, and one pool per system
built by its builder, so no other system's code can even connect with rights to change or read
those tables. No cross-schema foreign keys or views. Other systems learn a system's records only
through its published language: its events, its open host service, and its admin panels, which run
inside that system. The dashboard is composed from four panels, each a driving adapter of its own
system. Payload reads stock only through inventory's `GetStockLevels`; `storefront` reads Payload
only through Payload's API.

**P12.** `tooling/architecture/relationships.ts` lists every upstream each system may import and
the kind: ordering ← inventory (anti-corruption layer), payments (anti-corruption layer), billing,
fulfilment, Payload (anti-corruption layer); inventory ← ordering, fulfilment (anti-corruption
layer); payments ← Stripe, ordering (anti-corruption layer); billing ← bank, mail, ordering, payments
(anti-corruption layer); fulfilment ← 3PL, ordering, Payload (anti-corruption layer); storefront ←
Payload (conformist); ordering, payments, billing ← `@shop/kernel-money` (shared kernel).
dependency-cruiser rules are generated from it: an anti-corruption layer's upstream may be imported
only in `adapters/`; a conformist's anywhere; anything unlisted nowhere. Adding a relationship is an
edit to that file, a choice reviewed as such.

**P13.** Published language is a separate set of zod schemas in `offer/published-language.ts`,
mapped from the domain in the outbox adapter and the open host service wrappers; the domain can be
reshaped while the mapping keeps the published shape. When the published language itself must
change, the upstream adds version n+1 and publishes both n and n+1 (two envelopes, two types)
until `relationships.ts` shows no downstream on n; downstreams move on their own schedule.

**P14.** Messages are typed by `type` and `version`; readers use the upstream's
`parse<Type>(envelope)`, which upcasts older versions and strips unknown fields, so a message
written by old code means the same to new code. New versions are published only after every
subscriber can read them (P13). Records follow expand/contract: a release only adds nullable
columns or tables; new code writes both old and new shapes until the contract release, so old and
new processes during a rolling deploy read every row the same; enum-like values are introduced one
release before any code writes them. Payload's outbox messages follow the same versioning, written
by our configuration.

**P15.** Cross-system work is asynchronous; checkout reads only its own replicas (products, dunning
status). Two synchronous dependencies remain, each because a business rule needs the answer now:
no order without reserved stock (inventory, in-process, down only when its schema is), and a card
order is placed only with a payment the customer can complete now (payments and Stripe; when Stripe
is down card checkout answers `cardPaymentUnavailable` and invoice checkout still works). The 3PL,
bank, mail provider and Payload being down delays handlers (retried with backoff) but fails no use
case.

**P16.** A use case opens one transaction on its own system's pool; the roles make a transaction
that writes two schemas impossible, so the schemas are separate stores. Cross-system steps are
messages through outboxes, and in-process open host service calls run in the callee's own
transaction.

**P17.** Every cross-system piece of work has an end: tentative reservations and card payments
expire unless confirmed; the `Order` process manager has terminal states (shipped and paid,
cancelled, refunded) and every non-terminal state has a timer or an incoming message that moves it
(deadline, payment, shipment report); reconciliations repair missed webhooks (`reconcile-card-payments`,
`reconcile-bank-transfers`, `reconcile-shipments`, `reconcile-stock-levels`); a payment on a
cancelled order ends refunded. The states that wait for a person are business-rule states the
operator owns: `shipmentRefused`, `refundRefused`, unmatched transfer, dead letters; all are listed
in `/admin/operations`.

**P18.** Handlers are written against state, not arrival order: replicas apply only newer
`sourceVersion`/`sequence`/`reportedAt`; reservations: released and consumed are terminal, a late
confirmation does not revive a released one; availability is computed from facts (last report,
dispatches after it, active reservations) so `StockLevelReported` and `ShipmentDispatched` commute;
`Order` accepts `CardPaymentSucceeded` before or after cancellation and `ShipmentDispatched` in any
order with `InvoicePaid`; billing issues the card invoice on `OrderPaid` and treats an
`OrderCancelled` that arrives after `OrderPaid` as nothing to close; a credit note for a refund
whose invoice is not yet issued throws so the bus retries until the invoice exists.

**P19.** Each system has its own `GLOSSARY.md`; the same word is used in one sense per system and
translated at the boundary: ordering's "order" is fulfilment's "shipment" and the 3PL's "outbound
order"; Payload's "product" is ordering's `CatalogProduct` and, once copied, an order line's
snapshot; `OrderId` is `ReservationId` in inventory and `OrderRef` in payments, billing and
fulfilment. Branded types (`type OrderRef = string & { readonly __brand: "OrderRef" }`) keep two
meanings of one string apart in the compiler.

## Decisions the document left to me

**D1. Cut into systems.** Chose `ordering`, `inventory`, `payments`, `billing`, `fulfilment`,
`storefront`, with Payload as external system. Would also have held: payments inside billing;
inventory inside fulfilment; fewer, larger systems in general.

**D2. Catalog.** Chose Payload as the external system that owns products; no `catalog` system of
ours. Would also have held: our own `catalog` system whose driving adapter is the Payload admin and
which owns the rules (price above zero, sku unique) in its domain.

**D3. Stores on one Postgres instance.** Chose one schema, one login role and one pool per system
and for Payload. Would also have held: one database per system on the instance; one role for all
with only review and lint keeping transactions apart.

**D4. Bus and relay.** Chose `pg-boss` in schema `pgboss` as the bus and a polling relay (200 ms,
batch 100) with one active instance via advisory lock. Would also have held: RabbitMQ or NATS
JetStream; `LISTEN/NOTIFY`-triggered relay; several relays with `SKIP LOCKED`.

**D5. Idempotent receivers.** Chose idempotency by domain keys and state, no inbox table. Would
also have held: a per-system `processed_messages` table written in the use case's transaction.

**D6. Concurrency control.** Chose optimistic versioning with 3 retries; `FOR UPDATE` only on
`number_series`. Would also have held: pessimistic `SELECT ... FOR UPDATE` per aggregate;
`SERIALIZABLE` isolation with retry.

**D7. Which calls are synchronous.** Chose two: `ReserveStock` and `StartCardPayment`, both from
`PlaceOrder`. Would also have held: asynchronous reservation after `OrderPlaced` with cancellation
on failure (then "stock is reserved when an order is placed" is eventual).

**D8. Tentative operations.** Chose tentative reservation and tentative card payment confirmed by
`OrderPlaced`, with expiry. Would also have held: commit the order first, then reserve and start the
payment in a saga with compensation.

**D9. Orchestration or choreography.** Chose orchestration for the order lifecycle (the `Order`
aggregate is the process manager, sending `ShipOrder` and `RefundCardPayment`) and choreography for
reactions (inventory, billing, payments on ordering's events). Would also have held: full
choreography (fulfilment ships on `OrderPaid`).

**D10. Relationships.** Chose anti-corruption layers everywhere, conformist only for `storefront`
to Payload, shared kernel only for `Money`. Would also have held: no shared kernel (each system its
own money type); ordering conformist to Payload.

**D11. Replicas or calls.** Chose replicas in ordering (products, dunning status) and inventory
(stock reports). Would also have held: synchronous Payload Local API reads at checkout (in-process)
and a synchronous billing call for dunning status, with the P15 consequence that checkout fails when
billing is down unless a rule says so.

**D12. Published language format.** Chose zod schemas plus inferred types in `offer/`, JSON
envelopes with `type` and integer `version`. Would also have held: JSON Schema, protobuf, or
TypeScript types plus hand-written guards.

**D13. Versioning.** Chose upcasting readers, dual publishing during transitions, expand/contract
migrations. Would also have held: a schema registry with compatibility checks; versioned message
types only (`OrderPlacedV2`) without upcasting.

**D14. Refusals.** Chose `Result` unions for synchronous calls, refusal events for commands,
exceptions only for infrastructure. Would also have held: typed error classes thrown and caught at
adapters; a reply queue per command.

**D15. Driving port shape.** Chose one function type per use case and a factory per service.
Would also have held: one interface per system with one method per use case.

**D16. Packaging and enforcement.** Chose one pnpm package per system exporting only `./offer`,
dependency-cruiser rules generated from `relationships.ts`, Biome restricted globals. Would also
have held: one package with ESLint boundaries; TypeScript project references only.

**D17. Clock and ids.** Chose driven ports per system. Would also have held: passing `now` and ids
from driving adapters as use case input (then the port is the input).

**D18. Unit of work.** Chose a `UnitOfWork` port whose transaction object carries the
repositories and the outbox. Would also have held: repositories taking an explicit transaction
handle; ALS-carried transaction.

**D19. Processes.** Chose `web`, `worker`, `migrate`. Would also have held: one process doing
everything; a separate `hooks` process; one worker per system.

**D20. Courier.** Chose a `globalThis`-keyed memoized `Promise<WebAssembly>` in
`apps/web/src/assembly/courier.ts`, set in `instrumentation.ts`, read by route and Payload component
shims. Would also have held: Payload's `req.context` for Payload paths plus a module singleton.

**D21. Ambient values.** Chose ALS per request for `requestId` and trace context, set by every
driving adapter and by the bus consumer, copied into envelope headers by outbox adapters. Would also
have held: passing a context argument explicitly through adapters.

**D22. Scheduled tasks.** Chose `pg-boss` schedules (cluster-wide once). Would also have held:
`croner` in one designated worker; Kubernetes CronJobs invoking a CLI entry point.

**D23. Calls to unreliable external systems.** Chose commit intent, private message, handler calls
under a `submitting` lease with idempotency key or lookup. Would also have held: transactional
calls with the external system's own idempotency only, where it offers one.

**D24. Payload's outgoing messages.** Chose a `catalog-outbox` collection written in Payload's
transaction and an outbox reader built by `worker` assembly. Would also have held: an outbox reader
that polls `payload.products.updated_at` and synthesizes messages.

**D25. Hooks.** Chose Next route handlers in `web`; 2xx only after commit; signature check in the
hook. Would also have held: hooks in `worker` behind its own HTTP server.

**D26. Admin dashboard.** Chose a Payload custom admin view composed of per-system panels, each a
driving adapter of its system. Would also have held: a read-model system `operations` fed by events
from all systems.

**D27. Probes.** Chose `/health` with `SELECT 1` on a `probe` role, `/metrics` via
`@opentelemetry/exporter-prometheus` on `:9464`. Would also have held: `prom-client` on the main
port; per-system readiness.

**D28. Tests.** Chose fakes per driven port inside the system, open host service fakes in the
offer, Testcontainers for integration tests, Stripe test mode and the 3PL sandbox for end-to-end
tests. Would also have held: PGlite in-process as the "fake" store.

**D29. Mail.** Chose a mailer port per system, no notification system. Would also have held: a
`notifications` system subscribing to events.

**D30. Gapless numbering.** Chose a counter row locked in the issuing transaction. Would also have
held: assigning numbers in a single-consumer job after commit (gapless because only committed
invoices get numbers).

**D31. Values the brief leaves open.** Chose card deadline 60 min, invoice orders without
cancellation deadline, invoices due 14 days after issue, dunning stages at 7/21/35 days, gross
prices, full refunds only, sku immutable once created, a credit note also on cancellation of an
invoiced unpaid order, DE and AT deliverable. Any other values would have held every property.

## Sentences I had to pick a reading for

**S1.** "Hook. A driving adapter an external system calls."
Reading A: any of our code an external system calls is a hook, including Payload configuration
callbacks that only write Payload's own data. Reading B: only code that drives a driving port of one
of our systems. Took B. In my draft the `afterChange` that writes `catalog-outbox` is Payload
configuration (in `packages/external/payload-catalog`), while the stock field and the admin panels
are hooks of `inventory`, `ordering`, `billing`, `payments`, `fulfilment`.

**S2.** "The outbox reader is what the relay reads the outbox through, and marks it by; the system provides it, and for an external system's outbox, assembly does."
Reading A: an external system has an outbox of its own (one we configure into it), and assembly
supplies the reader for it. Reading B: assembly builds a reader that turns the external system's
change data into an outbox. Took A. Payload got a `catalog-outbox` collection written in its own
transaction; `apps/worker/src/assembly/payload-outbox-reader.ts` reads it.

**S3.** "A module is pure when calling it reaches nothing outside the process and it hands its caller nothing the caller did not pass."
Reading A: the output is determined by the arguments only (no clock, no randomness, no ambient
state). Reading B: the module returns no object it did not receive or derive, i.e. no hidden
references, but may read the clock. Took A. Domain functions take `now` and ids as arguments;
`Date.now` and `crypto.randomUUID` are banned in `domain/`.

**S4.** "What it reaches through a port of its system it reaches as the port, not as the code behind it." together with "Domain ... It is pure."
Reading A: a domain module that calls a repository port reaches only the interface, so it stays
pure and may hold ports. Reading B: calling a port whose implementation leaves the process is
reaching outside, so the domain holds no ports. Took B. Services load and save; domain functions
receive aggregates and replica values; no port type is imported in `domain/`.

**S5.** "Two clients are one store when one transaction can carry the writes of both, two stores until it can."
Reading A: "can" is physical; all schemas on one Postgres instance are one store. Reading B: "can"
is as configured; clients whose roles cannot write each other's tables are two stores. Took B and
made it true with roles and pools (D3), which is how P16 holds by construction rather than by
discipline.

**S6.** "A use case's writes to its own system's records land together or not at all" (P7)
Reading A: the writes the use case causes, including those of other systems it calls synchronously.
Reading B: only writes to its own system's records. Took B (A collides with P16). `PlaceOrder`'s
reservation and card payment commit in inventory's and payments' transactions and are tentative so
the non-atomicity has an end.

**S7.** "An uncommitted write is not yet a fact: nothing final follows from it before it commits" (P8)
Reading A: no externally visible effect may happen before the commit. Reading B: nothing
irreversible or committing may happen; a tentative operation is not final. Took B. `PlaceOrder`
reserves and creates a Stripe intent before its commit; the secret goes out after. Under A,
`PlaceOrder` would commit first and start the payment in a second step, answering the browser
without the secret or after a second round trip.

**S8.** "A repeated delivery changes no record of this system, and succeeds where the first did" (P9)
Reading A: the repeat succeeds whenever the first succeeded; when the first refused, the repeat is
unconstrained. Reading B, with "Idempotent ... answers as the first did": the repeat gives the same
answer, a refusal included. Took B. Refusals are recorded as state (`refused` shipment,
`RefundRefusal`) so a repeat answers the same without writing.

**S9.** "It names one use case the system offers and what a caller must bring, in the system's terms, not its store's. It does not know how it is reached."
Reading A: a message id or idempotency key in a driving port's input reveals how it is reached and
is forbidden. Reading B: a key is allowed if it is a domain term. Took B in the narrow form: only
domain keys (`orderId`, `refundRef`, `transferId`) appear; no message id. This is why D5 is
domain-key idempotency and not an inbox table, which would need the message id in the port.

**S10.** "use cases fail each other only where a business rule ties them" (P10)
Reading A: "fail" means a use case surfaces a failure to its caller because of another. Reading B:
it also forbids one use case blocking or retrying because of another. Took A. Optimistic retries
inside `withConflictRetry` are not failures; the `number_series` row lock blocks invoice issuance
(tied by gaplessness) without failing it.

**S11.** "A use case works while other systems are down or slow, unless a business rule needs another system's answer now" (P15)
Reading A: only a rule of the domain justifies the dependency; "the browser needs the client
secret" is a product requirement, not a business rule. Reading B: a requirement of the use case's
answer that the business stands behind counts. Took B and wrote it as an ordering rule ("a card
order is placed only with a payment the customer can complete now"). Card checkout fails when Stripe
is down; under A it would have had to place the order and hand out the secret later.

**S12.** "Owner. The system whose business rules decide what a record holds, wherever it is kept ... A replica's records are its keeper's; what they copy stays the owner's to decide." with P11 "No other system changes the records a system owns".
Reading A: replica rows are owned by the keeper, so the keeper writing them is not another system
changing the owner's records. Reading B: the owner's rules decide the content, so the owner owns the
rows and the keeper's writes violate P11. Took A (B makes every replica a violation). The replica
writers in `ordering` and `inventory` only apply published values and never compute them.

**S13.** "Replica. ... It is refreshed from what the owner publishes or returns to it"
Reading A: refreshed only from the owner itself. Reading B: from the owner or a system that holds
the owner's facts as its own. Took: the 3PL report is fulfilment's own fact (`StockReport`, "the
3PL reported X at T"), so fulfilment is the owner of what inventory replicates and reading A holds.
Had I taken the 3PL as owner, inventory would have needed its own 3PL adapter.

**S14.** "Offer. ... its published language, the driving port types of its open host service and their fakes, and its system builders."
Reading A: "their fakes" are fake implementations of the open host service's driving ports. Reading
B: fakes of the types (test fixtures of the schemas). Took A. `inventory/offer/fakes.ts` exports
`FakeInventory` implementing `ReserveStock` and `GetStockLevels`; ordering's tests use it behind its
own `StockReservations` adapter.

**S15.** "There are as many driving adapters as there are ways into the process."
Reading A: one adapter per mechanism (HTTP, bus, clock). Reading B: one per entry point (each route,
each subscription, each schedule, each hook). Took B. The tree has one file per route, handler,
scheduled task and hook.

**S16.** "Assembly. The one place in a process where every port gets its implementation, and the only place where port and implementation meet." with "System builder. The part of assembly a system provides".
Reading A: one module in the app. Reading B: the app's assembly plus the builders, wherever they
live. Took B. Builders sit in `packages/systems/*/src/builder.ts` and are the only non-test files
allowed to import `adapters/`.

**S17.** "the outside reached through code of the common library that a service or an adapter calls, where its output changes neither how a use case acts nor what it answers" (P5 Except)
Reading A: "its output" is what the library returns to its caller. Reading B: what the library
emits to the outside. Took A. Logger, spans and metrics return nothing a use case branches on and
are imported directly; a clock or id helper would return values the use case acts on, so they are
ports.

**S18.** "An event says something happened; no receiver can refuse it."
Reading A: a receiver cannot answer with a refusal but decides itself what follows, including
nothing. Reading B: a receiver must turn every event into a state change. Took A. Event handlers
never publish refusals; ordering reacts to a payment on a cancelled order by deciding a refund, and
billing ignores `OrderPaid` for invoice orders.

**S19.** "A command says do this, to the one system that offers it, which may refuse."
Reading A: the offering system is the one whose published language defines the command, even when
the sender's process manager composes it. Reading B: the sender owns its outgoing commands. Took A.
`ShipOrder` lives in `fulfilment/offer`, `RefundCardPayment` in `payments/offer`; ordering's outbox
adapter translates its `shipmentRequested` decision into them.

**S20.** "Ambient value. ... per request, what the current request carries."
Reading A: only HTTP requests are requests. Reading B: any unit a driving adapter handles (HTTP
request, delivered message, scheduled run). Took B. The bus consumer and the schedule runner set
the ALS request context too.

**S21.** "Probe. Code a process runs to report on itself rather than on a system."
Reading A: pinging the shared database reports on the process (its connectivity). Reading B: it
reports on the stores of the systems and is not a probe. Took A. `/health` is a probe on a
dedicated `probe` role and goes through no system; the admin dashboard reports on systems and so
goes through their driving ports.

**S22.** "Common library. A package of this codebase that belongs to no system, written for every system to import."
Reading A: every package that belongs to no system. Reading B: only those systems import. Took B.
The relay and bus (`packages/platform/bus`) are imported only by assembly and are listed as code
that is no system, not as a common library, so the P5 Except does not extend to them.

**S23.** "Tooling. Code that runs in no process of the deployed application."
Reading A: the migration runner is tooling. Reading B: it runs at every deploy against the stores,
so it is a process of the deployed application. Took B. `apps/migrate` has its own assembly that
calls each builder's migrations with the `migrator` role.

**S24.** "A record or a message means the same to all code that reads it, whenever it was written" (P14)
Reading A: new code reads old records and messages the same (backward). Reading B: also old code
reading records and messages written by new code during a rolling deploy (forward). Took B. Hence
expand/contract with dual writes, values introduced a release before use, and publishing a new
message version only after every reader handles it.

**S25.** "A system changes its model without its downstream systems changing" (P13)
Reading A: covers model changes behind an unchanged published language. Reading B: covers changes to
the published language too. Took B. Upstreams dual-publish versions until no downstream reads the
old one.

**S26.** "Work spanning systems ends, and only in a state a business rule allows" (P17)
Reading A: ends without a person. Reading B: may end in a state a rule allows that hands the case
to a person. Took B. `shipmentRefused`, `refundRefused`, unmatched transfers and dead letters are
end states owned by the operator and shown in `/admin/operations`.

**S27.** "Repository. A specialized driven port over exactly one aggregate"
Reading A: one aggregate type. Reading B: one aggregate instance. Took A. One repository per
aggregate type (`OrderRepository`), with finders returning many instances; dashboard lists go
through separate query ports (`OrderQueries`), not the repository.

**S28.** "Orchestration. ... Each step is a use case of that system that sends the commands its process manager decides to the others."
Reading A: the process manager only sends commands and advances on replies to them. Reading B: it
also advances on events of other systems it did not command. Took B. `Order` advances on
`CardPaymentSucceeded` and `InvoicePaid`, which it never commanded, and sends `ShipOrder` and
`RefundCardPayment`.
