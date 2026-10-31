# Fresh repository draft A, raw set

Online tea shop. TypeScript on Node 22, pnpm workspaces, Next.js 15 (App Router) hosting Payload 3,
one Postgres 17 instance, Drizzle ORM and drizzle-kit, Stripe (`stripe` SDK), a 3PL warehouse API
with webhooks, a bank API polled for incoming transfers, a mail provider over HTTP, pino,
OpenTelemetry SDK exporting OTLP to Jaeger and Prometheus format on `/metrics`, `AsyncLocalStorage`
for per-request ambient values. Code names are in backticks; every other noun is a glossary term.

## Systems and what each owns

| System | Kind | Owns (its business rules decide) | Keeps (store) |
|---|---|---|---|
| `sales` | system of this codebase, core | carts; orders and their lifecycle (`Order` is the process manager of an order across `fulfillment`, Stripe and the mail provider); card payments of orders, disputes, refunds; which payment method a customer is offered; order-confirmation mail state; the shop page's content | Postgres schema `sales`, role `sales_rw`: `cart`, `cart_line`, `order`, `order_line` (snapshot of price, sku, tax class), `refund`, `product_listing` (replica of `catalog` products), `customer_standing` (replica of `billing` dunning stage), `processed_message`, `outbox` |
| `billing` | system of this codebase | billable orders (snapshot of order lines as `billing` needs them), invoices, credit notes, gapless number series, VAT by tax class, incoming bank transfers and their matching, unmatched transfers, customer accounts and their dunning stage, invoice and reminder mail state | schema `billing`, role `billing_rw`: `billable_order`, `billable_line`, `invoice`, `invoice_line`, `credit_note`, `number_series`, `incoming_transfer`, `customer_account`, `bank_cursor`, `processed_message`, `outbox` |
| `fulfillment` | system of this codebase | stock per sku (on hand, held), reservations (tentative operations held for `sales`), shipments, registration of each sku in the 3PL article master | schema `fulfillment`, role `fulfillment_rw`: `stock_item`, `stock_hold`, `released_reservation`, `shipment`, `shipment_line`, `article`, `processed_message`, `outbox` |
| `catalog` | external system: Payload CMS, adopted, run by us, in our `web` and `worker` processes, configured by this codebase | products: copy, images, slug, price, sku, tax class, on-sale flag; editors (Payload users); media | schema `payload`, role `payload_rw`: Payload's own tables (`products`, `media`, `users`, ...) plus `catalog_outbox`, a hidden Payload collection this codebase configures as `catalog`'s outbox |

External systems (driven through their API, driving through hooks):

| External system | Driven through | Driving through | Downstream of it | Relationship |
|---|---|---|---|---|
| Payload (`catalog`) | Payload Local API (`payload.find`), from `sales` reconciliation only | `catalog.ProductChanged` messages from `catalog_outbox`; Payload field hook that `fulfillment` provides (stock display) | `sales`, `fulfillment` | anti-corruption layer in both |
| Stripe | `stripe` SDK: PaymentIntents, Refunds | `POST /hooks/stripe` | `sales` | anti-corruption layer |
| 3PL warehouse | REST: article master upsert, shipment create, article list | `POST /hooks/3pl` | `fulfillment` | anti-corruption layer |
| Bank | REST: list incoming transfers since a cursor | none (polled) | `billing` | anti-corruption layer |
| Mail provider | REST: send | none | `sales`, `billing` | anti-corruption layer |
| Operating system | clock, randomness, environment, stdout | timers (scheduled tasks), signals | all | driven ports `Clock`, `Ids`; environment read only by assembly |

Relationships between systems of this codebase (each line one relationship, upstream first):

- `catalog` -> `sales`: events (`catalog.ProductChanged`). `sales` keeps a replica.
- `catalog` -> `fulfillment`: events (`catalog.ProductChanged`). `fulfillment` registers articles.
- `fulfillment` -> `sales`: open host service (`reserveStock`), commands `sales` sends (`ConfirmReservation`, `ReleaseReservation`, `ShipOrder`), events (`OrderShipped`, `ReservationRefused`, `ShipmentRefused`).
- `fulfillment` -> `catalog`: open host service (`stockLevels`) reached by the Payload field hook.
- `fulfillment` -> `billing`: event `OrderShipped`.
- `sales` -> `billing`: events `OrderPlaced`, `OrderPaid`, `OrderCancelled`, `OrderRefunded`.
- `billing` -> `sales`: event `CustomerDunningStageChanged`. `sales` keeps a replica.

Every downstream system of this codebase is an anti-corruption layer; none is a conformist.

Shared kernel: none. Each domain has its own `Money` (integer euro cents).

Code that is no system:

| Code | What it is |
|---|---|
| `packages/common` (`@teashop/common`) | common library: `Result`, `Envelope`, `OutboxReader`, `Handler`, `ScheduledTask` interfaces; the relay; the Postgres bus and an in-memory bus; the scheduler; pino logger, OTel tracing and metrics setup, request context on `AsyncLocalStorage`; `systemClock`, `randomIds` |
| `apps/web/src/assembly.ts`, `apps/worker/src/assembly.ts` | assembly of each process |
| `apps/worker/src/catalog-outbox-reader.ts` | outbox reader of the external system `catalog`, provided by assembly |
| `apps/web/src/courier.ts` | courier for Next.js route modules and the Payload config module |
| `apps/web/app/**` route and page files | three-line shims Next.js requires at fixed paths; each forwards to one driving adapter a system provides |
| `apps/*/src/probes/*` | probes: `/health`, `/metrics` |
| `tooling/migrate`, `tooling/roles.sql`, `.dependency-cruiser.cjs`, `docker-compose.yml` | tooling |

## Ports and adapters

### Common library types every system sees

```ts
// packages/common/src/result.ts
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// packages/common/src/envelope.ts
export type Json = string | number | boolean | null | readonly Json[] | { readonly [k: string]: Json };
export type Envelope<TType extends string = string, TPayload extends Json = Json> = {
  readonly id: string;                 // uuid v7, the same on every delivery
  readonly type: TType;                // e.g. "sales.OrderPlaced"
  readonly version: number;            // schema version of payload
  readonly kind: "event" | "command";
  readonly visibility: "published" | "private";
  readonly producer: "sales" | "billing" | "fulfillment" | "catalog";
  readonly key: string;                // aggregate id the message is about
  readonly sequence: number;           // per-key revision, strictly increasing per producer and key
  readonly occurredAt: string;         // ISO-8601
  readonly trace: { readonly traceparent: string | null; readonly requestId: string | null };
  readonly payload: TPayload;
};

// packages/common/src/outbox-reader.ts
export interface OutboxReader {
  readonly producer: Envelope["producer"];
  readPending(limit: number): Promise<readonly Envelope[]>;
  markRelayed(ids: readonly string[]): Promise<void>;
}

// packages/common/src/handler.ts
export type HandlerOutcome = { readonly kind: "settled" } | { readonly kind: "retryLater"; readonly reason: string; readonly countsAsAttempt: boolean };
export interface Handler {
  readonly name: string;                              // "sales.syncProductListing"
  readonly system: Envelope["producer"];
  readonly subscribesTo: { readonly type: string; readonly versions: readonly number[] };
  readonly processGroup: "web" | "worker";
  handle(message: Envelope): Promise<HandlerOutcome>;
}

// packages/common/src/scheduled-task.ts
export interface ScheduledTask { readonly name: string; readonly cron: string; run(): Promise<void> }
```

### `sales`

Driving ports (one function type per use case, `systems/sales/src/service/driving-ports.ts`):

```ts
import type { Result } from "@teashop/common";
import type { Address, CartId, CartView, CustomerId, OrderDetail, OrderId, OrderStatus, OrderSummary,
  PaymentRef, ProductCard, ProductPage, RefundId } from "../domain/index.js";

// answering
export type ListProducts = () => Promise<readonly ProductCard[]>;
export type ViewProduct = (input: { slug: string }) => Promise<ProductPage | null>;
export type ViewCart = (input: { cartId: CartId }) => Promise<CartView | null>;
export type DueUnpaidOrders = (input: { limit: number }) => Promise<readonly OrderId[]>;
export type ListOrders = (input: { status: OrderStatus | null; page: number }) => Promise<readonly OrderSummary[]>;
export type ViewOrder = (input: { orderId: OrderId }) => Promise<OrderDetail | null>;

// acting, reached by HTTP
export type SetCartLine = (input: { cartId: CartId | null; productId: string; quantity: number })
  => Promise<Result<CartView, "product_not_on_sale" | "quantity_invalid" | "cart_checked_out">>;
export type Checkout = (input: {
  cartId: CartId;
  customer: { email: string; name: string };
  shippingAddress: Address;
  paymentMethod: "card" | "invoice";
  expectedTotalCents: number;
}) => Promise<Result<CheckoutOutcome, CheckoutError>>;
export type CheckoutOutcome = {
  orderId: OrderId;
  payment: { method: "card"; clientSecret: string } | { method: "invoice" };
};
export type CheckoutError =
  | { kind: "cart_not_found" } | { kind: "cart_empty" }
  | { kind: "invoice_not_offered" }
  | { kind: "price_changed"; totalCents: number }
  | { kind: "product_not_on_sale"; productIds: readonly string[] }
  | { kind: "out_of_stock"; productIds: readonly string[] }
  | { kind: "stock_unavailable" }
  | { kind: "payment_provider_unavailable"; orderId: OrderId };
export type RequestRefund = (input: { orderId: OrderId })
  => Promise<Result<{ refundId: RefundId }, "not_found" | "not_paid_by_card" | "disputed" | "already_refunded">>;

// acting, reached by the Stripe hook
export type RecordCardPayment = (input: { messageId: string; paymentRef: PaymentRef; outcome: "succeeded" | "failed" })
  => Promise<Result<void, "unknown_payment">>;
export type RecordDispute = (input: { messageId: string; paymentRef: PaymentRef }) => Promise<Result<void, "unknown_payment">>;
export type RecordRefundOutcome = (input: { messageId: string; refundId: RefundId; outcome: "succeeded" | "failed" })
  => Promise<Result<void, "unknown_refund">>;

// acting, reached by handlers
export type SyncProductListing = (input: { messageId: string; revision: number; listing: IncomingListing }) => Promise<void>;
export type RefreshShopPage = (input: { slugs: readonly string[] }) => Promise<void>;
export type RecordCustomerStanding = (input: { messageId: string; revision: number; customerId: CustomerId; inDunning: boolean }) => Promise<void>;
export type RecordShipment = (input: { messageId: string; orderId: OrderId; shippedAt: Date; trackingUrl: string | null }) => Promise<void>;
export type RecordFulfillmentRefusal = (input: { messageId: string; orderId: OrderId; reason: "out_of_stock" | "undeliverable" }) => Promise<void>;
export type SendOrderConfirmation = (input: { messageId: string; orderId: OrderId }) => Promise<void>;
export type CancelCardPayment = (input: { messageId: string; orderId: OrderId }) => Promise<void>;
export type IssueCardRefund = (input: { messageId: string; orderId: OrderId; refundId: RefundId }) => Promise<void>;

// acting, reached by scheduled tasks
export type BeginCancellation = (input: { orderId: OrderId }) => Promise<Result<void, "not_found" | "not_due">>;
export type ReconcileCardPayments = () => Promise<{ repaired: number }>;
export type ReconcileProductListings = () => Promise<{ repaired: number }>;

export type IncomingListing = {
  productId: string; slug: string; title: string; summary: string; descriptionHtml: string;
  imageUrls: readonly string[]; priceCents: number; sku: string; taxClass: "tea" | "accessories"; onSale: boolean;
};
export type SalesDrivingPorts = {
  listProducts: ListProducts; viewProduct: ViewProduct; viewCart: ViewCart; dueUnpaidOrders: DueUnpaidOrders;
  listOrders: ListOrders; viewOrder: ViewOrder; setCartLine: SetCartLine; checkout: Checkout; requestRefund: RequestRefund;
  recordCardPayment: RecordCardPayment; recordDispute: RecordDispute; recordRefundOutcome: RecordRefundOutcome;
  syncProductListing: SyncProductListing; refreshShopPage: RefreshShopPage; recordCustomerStanding: RecordCustomerStanding;
  recordShipment: RecordShipment; recordFulfillmentRefusal: RecordFulfillmentRefusal; sendOrderConfirmation: SendOrderConfirmation;
  cancelCardPayment: CancelCardPayment; issueCardRefund: IssueCardRefund; beginCancellation: BeginCancellation;
  reconcileCardPayments: ReconcileCardPayments; reconcileProductListings: ReconcileProductListings;
};
```

`sales` offers no open host service: no other system calls it synchronously. Its published
language is its four events.

Driven ports (`systems/sales/src/service/driven-ports.ts`):

```ts
import type { Json, Result } from "@teashop/common";
import type { Cart, CartId, CustomerId, CustomerStanding, Money, Order, OrderId, PaymentRef,
  ProductListing, Refund, RefundId, SalesOutgoing, Sku } from "../domain/index.js";

export interface Clock { now(): Date }
export interface Ids { orderId(): OrderId; cartId(): CartId; refundId(): RefundId }

export class ConcurrencyConflict extends Error {}
export class NewerModelVersion extends Error {}

export interface SalesUnitOfWork {
  /** One Postgres transaction. With idempotencyKey: if the key was recorded, returns the stored
   *  result and runs nothing; otherwise records key and result with the work's writes. */
  run<T extends Json>(work: (tx: SalesTx) => Promise<T>, options?: { idempotencyKey: string }): Promise<T>;
}
export type SalesTx = {
  carts: CartRepository; orders: OrderRepository; refunds: RefundRepository;
  listings: ProductListingReplica; standings: CustomerStandingReplica; outbox: SalesOutbox;
};
export interface CartRepository { load(id: CartId): Promise<Cart | null>; save(cart: Cart): Promise<void> }
export interface OrderRepository {
  load(id: OrderId): Promise<Order | null>;
  findByPaymentRef(ref: PaymentRef): Promise<Order | null>;
  save(order: Order): Promise<void>; // optimistic: throws ConcurrencyConflict, NewerModelVersion
}
export interface RefundRepository { load(id: RefundId): Promise<Refund | null>; save(refund: Refund): Promise<void> }
export interface ProductListingReplica {
  getMany(productIds: readonly string[]): Promise<readonly ProductListing[]>;
  get(productId: string): Promise<ProductListing | null>;
  put(listing: ProductListing): Promise<void>;
}
export interface CustomerStandingReplica { get(id: CustomerId): Promise<CustomerStanding | null>; put(s: CustomerStanding): Promise<void> }
export interface SalesOutbox { add(message: SalesOutgoing): void } // SalesOutgoing: union in sales terms, mapped to published language in the adapter

export interface SalesQueries { // read side, outside any transaction
  listedProducts(): Promise<readonly ProductListing[]>;
  listingBySlug(slug: string): Promise<ProductListing | null>;
  cartView(id: CartId): Promise<CartView | null>;
  dueUnpaidOrders(now: Date, limit: number): Promise<readonly OrderId[]>;
  ordersAwaitingProvider(olderThan: Date): Promise<readonly { orderId: OrderId; paymentRef: PaymentRef | null }[]>;
  orders(status: OrderStatus | null, page: number): Promise<readonly OrderSummary[]>;
  orderDetail(id: OrderId): Promise<OrderDetail | null>;
}
export interface StockReservations {
  hold(input: { orderId: OrderId; lines: readonly { sku: Sku; quantity: number }[]; holdUntil: Date })
    : Promise<Result<void, { kind: "out_of_stock"; skus: readonly Sku[] } | { kind: "unavailable" }>>;
}
export interface CardPayments {
  start(input: { orderId: OrderId; amount: Money; customerEmail: string })
    : Promise<Result<{ paymentRef: PaymentRef; clientSecret: string }, "unavailable">>;
  cancel(ref: PaymentRef): Promise<Result<"cancelled" | "already_succeeded", "unavailable">>;
  refund(input: { refundId: RefundId; paymentRef: PaymentRef; amount: Money })
    : Promise<Result<"pending" | "succeeded", "disputed" | "unavailable">>;
  status(ref: PaymentRef): Promise<Result<"open" | "succeeded" | "cancelled", "unavailable">>;
}
export interface OrderMail {
  sendConfirmation(mail: { to: string; orderId: OrderId; lines: readonly { title: string; quantity: number; price: Money }[]; total: Money; paymentMethod: "card" | "invoice" }, idempotencyKey: string)
    : Promise<Result<void, "unavailable">>;
}
export interface ShopPageCache { invalidate(slugs: readonly string[]): Promise<void> }
export interface ProductSource { all(): AsyncIterable<{ revision: number; listing: IncomingListing }> }
```

Driven adapters:

| Port | Adapter (file) | Reaches |
|---|---|---|
| `SalesUnitOfWork` and the repositories, replicas, outbox | `adapters/driven/postgres/unit-of-work.ts`, `order-repository.ts`, `cart-repository.ts`, `refund-repository.ts`, `listing-replica.ts`, `standing-replica.ts`, `outbox.ts` | Postgres, pool of role `sales_rw`, Drizzle |
| `SalesQueries` | `adapters/driven/postgres/sales-queries.ts` | same |
| `StockReservations` | `adapters/driven/fulfillment/in-process-stock-reservations.ts`: wraps `FulfillmentOpenHost.reserveStock`, translates `sku` errors back to `Sku`, maps a thrown error to `unavailable` | `fulfillment`'s open host service, in-process |
| `CardPayments` | `adapters/driven/stripe/stripe-card-payments.ts`: `paymentIntents.create` with `Idempotency-Key: pi:{orderId}` and `metadata.orderId`; `cancel`; `refunds.create` with `Idempotency-Key: refund:{refundId}`; Stripe error code `charge_disputed` -> `disputed` | Stripe |
| `OrderMail` | `adapters/driven/mail/http-order-mail.ts` (idempotency key in the provider's idempotency header) | mail provider |
| `ShopPageCache` | `adapters/driven/next/next-shop-page-cache.ts`: `revalidateTag("product:" + slug)`, `revalidateTag("shop")` | Next.js data cache, `web` process only |
| `ProductSource` | `adapters/driven/payload/payload-product-source.ts`: `payload.find({ collection: "products", pagination, depth: 1 })`, translated to `IncomingListing` | Payload Local API, `worker` only |
| `Clock`, `Ids` | `systemClock`, `randomIds` from `@teashop/common` | OS |
| fakes | `adapters/driven/fakes/in-memory-unit-of-work.ts` (copy-on-commit maps, version checks, unique checks, idempotency keys, rollback on throw), `fake-card-payments.ts`, `fake-stock-reservations.ts`, `fake-order-mail.ts`, `fake-shop-page-cache.ts`, `fake-product-source.ts`, `fixed-clock.ts`, `sequential-ids.ts` | nothing |

Driving adapters:

| Way in | Adapter (file) | Calls |
|---|---|---|
| `GET /` and `GET /products/[slug]` pages | `adapters/driving/next/shop-page-data.ts`: `unstable_cache` around `listProducts` / `viewProduct`, tags `shop`, `product:{slug}` | `listProducts`, `viewProduct` |
| `GET/PUT /api/cart` | `adapters/driving/http/cart-routes.ts` (`cartId` in an http-only cookie) | `viewCart`, `setCartLine` |
| `POST /api/checkout` | `adapters/driving/http/checkout-route.ts`: zod-parses body, maps `CheckoutError` to 404/409/422/503 | `checkout` |
| `GET /ops/orders`, `GET /ops/orders/[id]`, `POST /ops/orders/[id]/refund` | `adapters/driving/http/ops-order-routes.ts` | `listOrders`, `viewOrder`, `requestRefund` |
| hook `POST /hooks/stripe` | `adapters/driving/hooks/stripe-hook.ts`: `stripe.webhooks.constructEvent`; `payment_intent.succeeded` / `payment_intent.payment_failed` / `charge.dispute.created` / `refund.updated` translated; message id = Stripe event id; answers 200 after the use case returns, 500 on throw, 200 for event types it ignores | `recordCardPayment`, `recordDispute`, `recordRefundOutcome` |
| handlers (`adapters/driving/handlers/*.ts`) | one per message type: `catalog-product-changed.ts`, `listing-changed.ts` (group `web`), `billing-dunning-stage-changed.ts`, `fulfillment-order-shipped.ts`, `fulfillment-reservation-refused.ts`, `fulfillment-shipment-refused.ts`, `send-order-confirmation.ts`, `cancel-card-payment.ts`, `issue-card-refund.ts` | the use case of the same name |
| scheduled tasks (`adapters/driving/scheduled/*.ts`) | `cancel-overdue-orders.ts` (every minute: `dueUnpaidOrders` then `beginCancellation` each), `reconcile-card-payments.ts` (03:10), `reconcile-product-listings.ts` (03:20) | as named |

System builders (`systems/sales/src/builder.ts`, the only file importing both `service/` and `adapters/`):

```ts
export type SalesConfig = {
  pool: pg.Pool;                                  // role sales_rw
  stripe: { secretKey: string; webhookSecret: string };
  mail: { baseUrl: string; apiKey: string; from: string };
  stock: FulfillmentOpenHost;                     // from @teashop/fulfillment/offer
  pageCache: "next" | "none";                     // "none" in worker
  productSource: Payload | null;                  // Payload instance in worker, null in web
  clock: Clock; ids: Ids; logger: Logger;
  policy: { paymentWindowMinutes: number; reservationHoldMinutes: number };
};
export type SalesParts = {
  ports: SalesDrivingPorts;
  http: { cart: RouteHandlers; checkout: RouteHandler; opsOrders: RouteHandlers };
  pages: { shop: ShopPageData };
  hooks: { stripe: RouteHandler };
  handlers: readonly Handler[];
  scheduled: readonly ScheduledTask[];
  outboxReader: OutboxReader;
};
export function buildSales(config: SalesConfig): SalesParts;
export function buildSalesWithFakes(overrides?: Partial<SalesFakes>): { parts: SalesParts; fakes: SalesFakes };
```

### `billing`

Driving ports:

```ts
export type NoteOrderPlaced = (input: { messageId: string; sequence: number; orderId: string; customerId: CustomerId;
  customerEmail: string; billingAddress: Address; paymentMethod: "card" | "bank_transfer"; placedAt: Date;
  lines: readonly { sku: string; description: string; quantity: number; unitPriceGross: Money; vatCategory: "reduced" | "standard" }[] }) => Promise<void>;
export type NoteOrderPaid = (input: { messageId: string; orderId: string; paidAt: Date }) => Promise<void>;
export type NoteOrderShipped = (input: { messageId: string; orderId: string; shippedAt: Date }) => Promise<void>;
export type NoteOrderCancelled = (input: { messageId: string; orderId: string }) => Promise<void>;
export type NoteOrderRefunded = (input: { messageId: string; orderId: string; refundId: string; amount: Money }) => Promise<void>;
export type ImportBankTransfers = () => Promise<Result<{ matched: number; unmatched: number }, "bank_unavailable">>;
export type MatchTransferManually = (input: { transferId: string; invoiceNumber: string })
  => Promise<Result<void, "transfer_not_found" | "invoice_not_open" | "already_matched" | "amount_differs">>;
export type CustomersDueForDunning = (input: { limit: number }) => Promise<readonly CustomerId[]>;
export type AdvanceDunning = (input: { customerId: CustomerId }) => Promise<void>;
export type SendInvoiceMail = (input: { messageId: string; invoiceId: string }) => Promise<void>;
export type SendDunningReminder = (input: { messageId: string; customerId: CustomerId; stage: 1 | 2 | 3; invoiceIds: readonly string[] }) => Promise<void>;
export type ListInvoices = (input: { status: "open" | "paid" | "overdue" | null; page: number }) => Promise<readonly InvoiceSummary[]>;
export type ViewInvoice = (input: { invoiceId: string }) => Promise<InvoiceDetail | null>;
export type ListUnmatchedTransfers = (input: { page: number }) => Promise<readonly TransferSummary[]>;
```

`billing` offers no open host service. Published language: event `billing.CustomerDunningStageChanged`.

Driven ports:

```ts
export interface BillingUnitOfWork { run<T extends Json>(work: (tx: BillingTx) => Promise<T>, options?: { idempotencyKey: string }): Promise<T> }
export type BillingTx = {
  billableOrders: BillableOrderRepository; invoices: InvoiceRepository; creditNotes: CreditNoteRepository;
  numberSeries: NumberSeriesRepository; transfers: IncomingTransferRepository; accounts: CustomerAccountRepository;
  bankCursor: BankCursorRepository; outbox: BillingOutbox;
};
export interface NumberSeriesRepository { loadForUpdate(series: "invoice" | "credit_note", year: number): Promise<NumberSeries>; save(s: NumberSeries): Promise<void> } // SELECT ... FOR UPDATE
export interface BillableOrderRepository { load(orderId: string): Promise<BillableOrder | null>; save(o: BillableOrder): Promise<void> }
export interface InvoiceRepository { load(id: string): Promise<Invoice | null>; findOpenByNumber(n: InvoiceNumber): Promise<Invoice | null>; findOpenByCustomer(c: CustomerId): Promise<readonly Invoice[]>; save(i: Invoice): Promise<void> }
export interface CreditNoteRepository { save(c: CreditNote): Promise<void> }
export interface IncomingTransferRepository { load(bankTransactionId: string): Promise<IncomingTransfer | null>; save(t: IncomingTransfer): Promise<void> }
export interface CustomerAccountRepository { load(id: CustomerId): Promise<CustomerAccount | null>; save(a: CustomerAccount): Promise<void> }
export interface BankCursorRepository { get(): Promise<string | null>; set(cursor: string): Promise<void> }
export interface BillingOutbox { add(message: BillingOutgoing): void }
export interface BillingQueries { customersDueForDunning(now: Date, limit: number): Promise<readonly CustomerId[]>; invoices(...): Promise<readonly InvoiceSummary[]>; invoice(id: string): Promise<InvoiceDetail | null>; unmatched(page: number): Promise<readonly TransferSummary[]> }
export interface BankStatements {
  since(cursor: string | null): Promise<Result<{ transfers: readonly { bankTransactionId: string; amount: Money; reference: string; payerName: string; bookedAt: Date }[]; nextCursor: string }, "unavailable">>;
}
export interface BillingMail {
  sendInvoice(mail: InvoiceMail, idempotencyKey: string): Promise<Result<void, "unavailable">>;
  sendReminder(mail: ReminderMail, idempotencyKey: string): Promise<Result<void, "unavailable">>;
}
export interface Clock { now(): Date }
export interface Ids { invoiceId(): string; creditNoteId(): string; transferId(): string }
```

Adapters: Postgres (`adapters/driven/postgres/*`, role `billing_rw`), `adapters/driven/bank/http-bank-statements.ts`,
`adapters/driven/mail/http-billing-mail.ts`, fakes in `adapters/driven/fakes/`. Driving adapters: handlers
`sales-order-placed.ts`, `sales-order-paid.ts`, `sales-order-cancelled.ts`, `sales-order-refunded.ts`,
`fulfillment-order-shipped.ts`, `send-invoice-mail.ts`, `send-dunning-reminder.ts`; scheduled tasks
`import-bank-transfers.ts` (every 5 minutes), `run-dunning.ts` (daily 06:00:
`customersDueForDunning` then `advanceDunning` each); HTTP `ops-invoice-routes.ts` (`GET /ops/invoices`,
`GET /ops/invoices/[id]`, `GET /ops/transfers`, `POST /ops/transfers/[id]/match`). The `sales-order-placed`
handler is where `sales`' `taxClass: "tea" | "accessories"` becomes `billing`'s `vatCategory: "reduced" | "standard"`.

Builder: `buildBilling(config: { pool; bank: { baseUrl; apiKey; accountId }; mail; clock; ids; logger; policy: { invoiceDueDays: 14; dunningStepDays: 7 } }): BillingParts` (same shape as `SalesParts` minus `pages`, `hooks`).

### `fulfillment`

Open host service (driving ports offered to other systems, `systems/fulfillment/src/published/open-host.ts`):

```ts
export type ReserveStock = (input: { reservationId: string; lines: readonly { sku: string; quantity: number }[]; holdUntil: string })
  => Promise<Result<{ reservationId: string }, ReserveStockError>>;
export type ReserveStockError = { code: "insufficient_stock"; skus: readonly string[] } | { code: "unknown_sku"; skus: readonly string[] };
export type StockLevels = (input: { skus: readonly string[] })
  => Promise<readonly { sku: string; onHand: number; held: number; available: number }[]>;
export type FulfillmentOpenHost = { reserveStock: ReserveStock; stockLevels: StockLevels };
```

`reserveStock` is idempotent on `reservationId`: the same id answers as the first call did.

Other driving ports:

```ts
export type ConfirmReservation = (input: { messageId: string; reservationId: string }) => Promise<void>;
export type ReleaseReservation = (input: { messageId: string; reservationId: string }) => Promise<void>;
export type AcceptShipOrder = (input: { messageId: string; orderId: string; lines: readonly { sku: string; quantity: number }[]; address: Address }) => Promise<void>;
export type RegisterArticle = (input: { messageId: string; revision: number; sku: string; name: string }) => Promise<void>;
export type PushArticle = (input: { messageId: string; sku: string }) => Promise<void>;
export type DispatchShipment = (input: { messageId: string; shipmentId: string }) => Promise<void>;
export type RecordShipmentReport = (input: { messageId: string; shipmentId: string; status: "shipped" | "undeliverable"; occurredAt: Date; trackingUrl: string | null })
  => Promise<Result<void, "unknown_shipment">>;
export type DueReservations = (input: { limit: number }) => Promise<readonly string[]>;
export type ExpireReservation = (input: { reservationId: string }) => Promise<void>;
export type ReceiveStock = (input: { sku: string; quantity: number; note: string }) => Promise<Result<void, "unknown_sku" | "quantity_invalid">>;
export type ReconcileArticleMaster = () => Promise<Result<{ repaired: number }, "warehouse_unavailable">>;
export type ListShipments = (input: { status: ShipmentStatus | null; page: number }) => Promise<readonly ShipmentSummary[]>;
```

Driven ports:

```ts
export interface FulfillmentUnitOfWork { run<T extends Json>(work: (tx: FulfillmentTx) => Promise<T>, options?: { idempotencyKey: string }): Promise<T> }
export type FulfillmentTx = { stockItems: StockItemRepository; shipments: ShipmentRepository; articles: ArticleRepository; outbox: FulfillmentOutbox };
export interface StockItemRepository { loadMany(skus: readonly Sku[]): Promise<readonly StockItem[]>; loadByReservation(id: ReservationId): Promise<readonly StockItem[]>; save(items: readonly StockItem[]): Promise<void> }
export interface ShipmentRepository { load(id: ShipmentId): Promise<Shipment | null>; findWaitingFor(sku: Sku): Promise<readonly Shipment[]>; save(s: Shipment): Promise<void> }
export interface ArticleRepository { load(sku: Sku): Promise<Article | null>; loadMany(skus: readonly Sku[]): Promise<readonly Article[]>; save(a: Article): Promise<void> }
export interface FulfillmentOutbox { add(message: FulfillmentOutgoing): void }
export interface FulfillmentQueries { stockLevels(skus: readonly Sku[]): Promise<readonly StockLevel[]>; dueReservations(now: Date, limit: number): Promise<readonly ReservationId[]>; shipments(...): Promise<readonly ShipmentSummary[]>; articles(): Promise<readonly Article[]> }
export interface Warehouse {
  upsertArticle(input: { sku: Sku; name: string }): Promise<Result<void, { kind: "rejected"; reason: string } | { kind: "unavailable" }>>;
  placeShipment(input: { shipmentId: ShipmentId; lines: readonly { sku: Sku; quantity: number }[]; address: Address })
    : Promise<Result<{ warehouseRef: string }, { kind: "rejected"; reason: string } | { kind: "unavailable" }>>;
  registeredArticles(): Promise<Result<readonly Sku[], "unavailable">>;
}
export interface Clock { now(): Date }
```

Adapters: Postgres (role `fulfillment_rw`), `adapters/driven/warehouse/http-warehouse.ts` (`PUT /articles/{sku}`,
`PUT /shipments/{shipmentId}`, both idempotent by path), fakes. Driving adapters: hook `hooks/warehouse-hook.ts`
(`POST /hooks/3pl`, HMAC-checked, message id = the 3PL's event id, else uuid v5 of
`shipmentId|status|occurredAt`); hook `hooks/payload-stock-field.ts` (a Payload `FieldHook` for `afterRead`
on the virtual field `stock`, calling `stockLevels`, answering `null` when it throws); handlers
`catalog-product-changed.ts`, `confirm-reservation.ts`, `release-reservation.ts`, `ship-order.ts`,
`push-article.ts`, `dispatch-shipment.ts`; scheduled tasks `expire-reservations.ts` (every minute),
`reconcile-article-master.ts` (03:30); HTTP `ops-shipment-routes.ts` (`GET /ops/shipments`,
`GET /ops/stock`, `POST /ops/stock/receive`).

Offer (`systems/fulfillment/src/offer.ts`): published language (command and event zod schemas, open host
types), `buildFulfillment`, and `createFakeFulfillmentOpenHost(initial: Record<string, number>): FulfillmentOpenHost`.

### `catalog` (external system, configured)

No ports of ours: Payload's architecture stays its own. This codebase writes its configuration:

```ts
// systems/catalog/src/config.ts
export type CatalogDeps = { databaseUrl: string; secret: string; stockField: FieldHook };
export function buildCatalogConfig(deps: CatalogDeps): Promise<SanitizedConfig>; // payload buildConfig + @payloadcms/db-postgres, schemaName "payload"
```

- `collections/products.ts`: `title`, `slug` (unique), `summary`, `description` (lexical rich text),
  `images` (upload -> `media`), `priceCents` (number, `validate: v => Number.isInteger(v) && v > 0`),
  `sku` (text, `unique: true`, `access.update: () => false`), `taxClass` (select `tea` | `accessories`),
  `onSale` (checkbox), `stock` (number, `virtual: true`, admin `readOnly`, `hooks.afterRead: [deps.stockField]`).
  `access.delete: () => false`. `hooks.afterChange: [writeProductChanged]`.
- `collections/catalog-outbox.ts`: hidden collection `catalog_outbox` (`id` uuid, `sequence` serial, `type`,
  `version`, `key`, `payload` json, `relayedAt` nullable). `writeProductChanged` calls
  `req.payload.create({ collection: "catalog_outbox", data, req })`, passing `req` so the write joins the
  product's transaction.
- `published/product-changed.ts`: zod schema `catalog.ProductChanged` v1 (the fields of `IncomingListing` plus
  `productId`, `revision` = the outbox row's `sequence`).

`apps/worker/src/catalog-outbox-reader.ts` (assembly) implements `OutboxReader` for it over the `payload` schema.

## Calls and messages

Synchronous calls:

| Caller | Callee | What | Refusal comes back as |
|---|---|---|---|
| browser | `web` routes of `sales`, `billing`, `fulfillment` | HTTP JSON | `Result` error -> 4xx with `{ error: { kind } }` |
| `sales` (`InProcessStockReservations`) | `fulfillment` open host `reserveStock` | at checkout, in-process function call, no transaction open on the `sales` side | `{ ok: false, error: { code: "insufficient_stock", skus } }` -> `sales` `out_of_stock` -> HTTP 409; throw -> `stock_unavailable` -> 503 |
| Payload (`catalog`) via `fulfillment`'s field hook | `fulfillment` open host `stockLevels` | admin reads a product | throw -> field shows empty |
| `sales` | Stripe | `paymentIntents.create`, `retrieve`, `cancel`; `refunds.create` | Stripe error -> `unavailable` (503 at checkout, `retryLater` in handlers); `charge_disputed` -> `disputed` |
| `sales` | mail provider | send confirmation | `unavailable` -> `retryLater` |
| `sales` (worker) | Payload Local API | reconciliation of listings | throw -> task logs, retries next night |
| `sales` (web) | Next.js `revalidateTag` | refresh shop page | none |
| `fulfillment` | 3PL | upsert article, place shipment, list articles | `rejected` -> domain decides (see messages), `unavailable` -> `retryLater` |
| `billing` | bank | transfers since cursor | `unavailable` -> task ends, next run retries |
| `billing` | mail provider | invoice, reminder | `unavailable` -> `retryLater` |
| Stripe | `sales` hook `/hooks/stripe` | webhook | settled by 2xx; 500 makes Stripe redeliver |
| 3PL | `fulfillment` hook `/hooks/3pl` | shipment report | settled by 2xx; `unknown_shipment` -> 404, 3PL redelivers |

Messages (all asynchronous; written to the producer's outbox in the use case's transaction, read by
the relay through the outbox reader, delivered by the bus):

| Message | Kind | Visibility | Published by (when) | Subscribed by (handler, process group) | Refusal |
|---|---|---|---|---|---|
| `catalog.ProductChanged` v1 | event | published | `catalog` (Payload `afterChange`, same transaction) | `sales.syncProductListing` (worker); `fulfillment.registerArticle` (worker) | none |
| `sales.ListingChanged` v1 | event | private | `sales.syncProductListing` | `sales.refreshShopPage` (web) | none |
| `sales.OrderPlaced` v1 | event | published | `sales.checkout` | `billing.noteOrderPlaced` | none |
| `sales.OrderPaid` v1 | event | published | `sales.recordCardPayment`, `sales.cancelCardPayment` when Stripe says already succeeded | `billing.noteOrderPaid` | none |
| `sales.OrderCancelled` v1 | event | published | `sales.cancelCardPayment`, `sales.recordFulfillmentRefusal` | `billing.noteOrderCancelled` | none |
| `sales.OrderRefunded` v1 | event | published | `sales.recordRefundOutcome` (succeeded) | `billing.noteOrderRefunded` | none |
| `sales.SendOrderConfirmation` v1 | command | private | `sales.checkout` | `sales.sendOrderConfirmation` (worker) | never refused |
| `sales.CancelCardPayment` v1 | command | private | `sales.beginCancellation` | `sales.cancelCardPayment` (worker) | never refused |
| `sales.IssueCardRefund` v1 | command | private | `sales.requestRefund`, `sales.recordFulfillmentRefusal` (paid order) | `sales.issueCardRefund` (worker) | `disputed` from Stripe -> refund marked refused in the same use case |
| `fulfillment.ConfirmReservation` v1 | command | published | `sales.checkout` | `fulfillment.confirmReservation` | `fulfillment.ReservationRefused` when the hold expired and stock no longer suffices |
| `fulfillment.ReleaseReservation` v1 | command | published | `sales.cancelCardPayment`, `sales.checkout` when it fails after holding | `fulfillment.releaseReservation` | never refused; unknown id leaves a tombstone |
| `fulfillment.ShipOrder` v1 | command | published | `sales.recordCardPayment` (card), `sales.checkout` (invoice) | `fulfillment.acceptShipOrder` | `fulfillment.ShipmentRefused` (no hold and no stock, or 3PL rejects) |
| `fulfillment.ReservationRefused` v1 | event | published | `fulfillment.confirmReservation` | `sales.recordFulfillmentRefusal` | none |
| `fulfillment.ShipmentRefused` v1 | event | published | `fulfillment.acceptShipOrder`, `fulfillment.dispatchShipment`, `fulfillment.recordShipmentReport` (undeliverable) | `sales.recordFulfillmentRefusal` | none |
| `fulfillment.OrderShipped` v1 | event | published | `fulfillment.recordShipmentReport` (shipped) | `sales.recordShipment`; `billing.noteOrderShipped` | none |
| `fulfillment.PushArticle` v1 | command | private | `fulfillment.registerArticle`, `fulfillment.reconcileArticleMaster` | `fulfillment.pushArticle` | 3PL `rejected` -> article marked `rejected`, shown on `/ops/stock` |
| `fulfillment.DispatchShipment` v1 | command | private | `fulfillment.acceptShipOrder`, `fulfillment.pushArticle` (last article of a waiting shipment registered) | `fulfillment.dispatchShipment` | 3PL `rejected` -> `ShipmentRefused` |
| `billing.CustomerDunningStageChanged` v1 | event | published | `billing.advanceDunning`, `billing.importBankTransfers`, `billing.matchTransferManually` | `sales.recordCustomerStanding` | none |
| `billing.SendInvoiceMail` v1 | command | private | invoice issue (in `noteOrderPaid`, `noteOrderShipped`, `noteOrderPlaced`) | `billing.sendInvoiceMail` | never refused |
| `billing.SendDunningReminder` v1 | command | private | `billing.advanceDunning` | `billing.sendDunningReminder` | never refused |

A refused command is settled (acknowledged) like a handled one; the refusal travels back as a
published event carrying the command's id as `causationId`. A handler that throws or returns
`retryLater` does not settle: the bus redelivers after `min(2^attempt, 600)` seconds and parks the
delivery after 10 counted attempts; parked deliveries list on `/ops/bus` and can be replayed.

The order flows, as `sales`' process manager `Order` decides them:

- Card: `checkout` holds stock (tentative, 30 min) -> commits `Order` `awaiting_payment` with deadline now
  + 60 min, `OrderPlaced`, `ConfirmReservation`, `SendOrderConfirmation` -> starts the PaymentIntent and
  returns `clientSecret` -> Stripe hook `payment_intent.succeeded` -> `paid`, `OrderPaid`, `ShipOrder` ->
  `OrderShipped` -> `shipped`. Deadline passed -> `cancelling`, `CancelCardPayment` -> Stripe `cancelled` ->
  `cancelled`, `OrderCancelled`, `ReleaseReservation`; Stripe `already_succeeded` -> `paid` as above.
- Invoice: `checkout` refuses `invoice_not_offered` when `customer_standing.inDunning`; else holds stock ->
  commits `Order` `placed_on_invoice`, `OrderPlaced`, `ConfirmReservation`, `ShipOrder`,
  `SendOrderConfirmation` -> `OrderShipped` -> `shipped`. `billing` issues the invoice on `OrderShipped`,
  due 14 days later.
- Refund: `requestRefund` (`paid` or `shipped`, by card, not disputed, not refunded) -> `Refund` `requested`,
  `IssueCardRefund` -> Stripe -> hook `refund.updated` -> `refunded`, `OrderRefunded` -> `billing` credit
  note. A dispute recorded before `issueCardRefund` runs makes it mark the refund `refused`.
- Fulfillment refusal: order not yet shipped -> `cancelled`, `OrderCancelled`; if paid, also a `Refund`
  and `IssueCardRefund`.

## Processes

| Deployable | Entry point | Runs | Assembly |
|---|---|---|---|
| `web` (one instance) | `next start` in `apps/web`; `apps/web/instrumentation.ts` `register()` starts OTel and the bus consumer for group `web` | shop pages, cart and checkout routes, Stripe and 3PL hooks, `/ops/*`, Payload admin `/admin` and API `/api/payload/*`, probes `/health`, `/metrics` | `apps/web/src/assembly.ts`, reached through the courier `apps/web/src/courier.ts` (route modules and `apps/web/payload.config.ts` cannot be handed arguments) |
| `worker` (one or more) | `node apps/worker/dist/main.js` | relay, bus consumer group `worker`, scheduler, Payload initialised by `getPayload` for the Local API, probe server on `:9464` (`/health`, `/metrics`) | `apps/worker/src/assembly.ts`, called by `main.ts` with arguments; no courier |
| `migrate` (job before each rollout) | `node tooling/migrate/dist/main.js` | `roles.sql`, bus migrations, `sales`, `billing`, `fulfillment` drizzle migrations each as its own role, `payload migrate` | tooling, no assembly |

Assembly in `web`:

```ts
export function assembleWeb(env: WebEnv): WebParts {
  const pools = {
    sales: new pg.Pool({ connectionString: env.salesDatabaseUrl }),
    billing: new pg.Pool({ connectionString: env.billingDatabaseUrl }),
    fulfillment: new pg.Pool({ connectionString: env.fulfillmentDatabaseUrl }),
    bus: new pg.Pool({ connectionString: env.busDatabaseUrl }),
  };
  const shared = { clock: systemClock, logger: rootLogger };
  const fulfillment = buildFulfillment({ pool: pools.fulfillment, warehouse: env.warehouse, ids: randomIds.fulfillment, ...shared });
  const sales = buildSales({ pool: pools.sales, stripe: env.stripe, mail: env.mail, stock: fulfillment.openHost,
    pageCache: "next", productSource: null, ids: randomIds.sales, policy: env.salesPolicy, ...shared });
  const billing = buildBilling({ pool: pools.billing, bank: env.bank, mail: env.mail, ids: randomIds.billing, policy: env.billingPolicy, ...shared });
  const consumer = createPostgresBusConsumer({ pool: pools.bus, group: "web",
    handlers: [...sales.handlers, ...billing.handlers, ...fulfillment.handlers].filter((h) => h.processGroup === "web") });
  return { sales, billing, fulfillment, consumer, stockField: fulfillment.hooks.payloadStockField, probes: createProbes(pools) };
}
```

`worker` assembles the same three systems with `pageCache: "none"` and `productSource: payload`, builds
the relay with `[sales.outboxReader, billing.outboxReader, fulfillment.outboxReader,
createCatalogOutboxReader(payloadPool)]`, the bus consumer for group `worker`, and the scheduler with all
`scheduled` tasks. At start the bus checks every handler: a handler subscribing to a private type of
another system fails assembly.

Relay: every 500 ms and on `LISTEN outbox_written`, per reader `readPending(100)` -> insert one
`bus.delivery` row per subscribed handler (`ON CONFLICT (message_id, handler) DO NOTHING`) -> `markRelayed`.
Bus: `bus.delivery(id, message_id, handler, process_group, envelope jsonb, status pending|settled|parked,
attempts, available_at, lease_until)`. A consumer claims with `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE
SKIP LOCKED LIMIT 10) SET lease_until = now() + 30s`; an expired lease is claimable again, so a delivery can
run twice at once. Settled rows stay 14 days. Scheduler: `croner`; each run takes
`pg_try_advisory_lock(hashtext(task.name))` on the bus pool so one worker runs it.

Migrations: drizzle-kit per system (`systems/<s>/drizzle.config.ts`, `schemaFilter: ["<s>"]`,
`migrations.schema: "<s>"`), Payload migrations under `systems/catalog/migrations`. Each rollout runs only
expanding migrations (new tables, nullable or defaulted columns, widened enums, new indexes
concurrently). Contracting migrations (drop, narrow, not null) ship one release later, after no process
of the old code runs. Every aggregate table has `version int` (optimistic concurrency) and
`model_version int` (see P14).

Observability: `@opentelemetry/sdk-node` with http, undici, pg instrumentations, OTLP/HTTP exporter to
Jaeger, W3C trace context. `apps/web/middleware.ts` takes or creates `x-request-id`. Each driving adapter
wrapper (`withRequestContext` in the common library) puts `{ requestId }` into `AsyncLocalStorage`; pino's
`mixin` adds `requestId`, `trace_id`, `span_id`. Outbox adapters copy the active `traceparent` and
`requestId` into the envelope; the bus consumer starts the handler span as a child of that `traceparent`
and restores `requestId`. Metrics: OTel `MeterProvider` with `PrometheusExporter({ preventServerStart: true })`;
`/metrics` serves it: HTTP, pg pool, bus lag and parked count, process runtime.

## Directory tree

```
teashop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .dependency-cruiser.cjs
├── docker-compose.yml                         # postgres:17, jaegertracing/all-in-one
├── packages/
│   └── common/
│       ├── package.json                       # @teashop/common
│       ├── drizzle.config.ts                  # schema "bus"
│       ├── drizzle/0000_bus.sql
│       ├── src/
│       │   ├── index.ts
│       │   ├── result.ts
│       │   ├── envelope.ts
│       │   ├── outbox-reader.ts
│       │   ├── handler.ts
│       │   ├── scheduled-task.ts
│       │   ├── system-clock.ts
│       │   ├── random-ids.ts
│       │   ├── relay/relay.ts
│       │   ├── bus/bus-schema.ts
│       │   ├── bus/postgres-bus-consumer.ts
│       │   ├── bus/in-memory-bus.ts
│       │   ├── bus/parked.ts
│       │   ├── scheduler/scheduler.ts
│       │   └── observability/
│       │       ├── logger.ts
│       │       ├── tracing.ts
│       │       ├── metrics.ts
│       │       └── request-context.ts
│       └── test/
│           ├── relay/relay.test.ts
│           └── bus/postgres-bus-consumer.integration.test.ts
├── systems/
│   ├── catalog/
│   │   ├── package.json                       # @teashop/catalog
│   │   ├── migrations/                        # payload migrate
│   │   ├── src/
│   │   │   ├── offer.ts
│   │   │   ├── config.ts
│   │   │   ├── collections/products.ts
│   │   │   ├── collections/media.ts
│   │   │   ├── collections/users.ts
│   │   │   ├── collections/catalog-outbox.ts
│   │   │   ├── hooks/write-product-changed.ts
│   │   │   └── published/product-changed.ts
│   │   └── test/
│   │       ├── collections/products.integration.test.ts
│   │       └── hooks/write-product-changed.integration.test.ts
│   ├── sales/
│   │   ├── package.json                       # @teashop/sales, exports "./offer"
│   │   ├── GLOSSARY.md
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/0000_init.sql
│   │   ├── src/
│   │   │   ├── offer.ts                       # published language, buildSales, buildSalesWithFakes
│   │   │   ├── builder.ts
│   │   │   ├── published/
│   │   │   │   ├── order-placed.ts
│   │   │   │   ├── order-paid.ts
│   │   │   │   ├── order-cancelled.ts
│   │   │   │   └── order-refunded.ts
│   │   │   ├── domain/
│   │   │   │   ├── index.ts
│   │   │   │   ├── money.ts
│   │   │   │   ├── ids.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── checkout.ts                # prepare order from cart, listings, standing
│   │   │   │   ├── order.ts                   # process manager
│   │   │   │   ├── order-line.ts              # snapshot of price, sku, tax class
│   │   │   │   ├── refund.ts
│   │   │   │   ├── product-listing.ts
│   │   │   │   ├── customer-standing.ts
│   │   │   │   ├── payment-methods.ts         # specification invoiceOffered
│   │   │   │   └── outgoing.ts                # SalesOutgoing
│   │   │   ├── service/
│   │   │   │   ├── driving-ports.ts
│   │   │   │   ├── driven-ports.ts
│   │   │   │   ├── retry-on-conflict.ts
│   │   │   │   ├── checkout.ts
│   │   │   │   ├── set-cart-line.ts
│   │   │   │   ├── browse.ts                  # listProducts, viewProduct, viewCart
│   │   │   │   ├── record-card-payment.ts
│   │   │   │   ├── record-dispute.ts
│   │   │   │   ├── request-refund.ts
│   │   │   │   ├── issue-card-refund.ts
│   │   │   │   ├── record-refund-outcome.ts
│   │   │   │   ├── begin-cancellation.ts
│   │   │   │   ├── cancel-card-payment.ts
│   │   │   │   ├── send-order-confirmation.ts
│   │   │   │   ├── sync-product-listing.ts
│   │   │   │   ├── refresh-shop-page.ts
│   │   │   │   ├── record-customer-standing.ts
│   │   │   │   ├── record-shipment.ts
│   │   │   │   ├── record-fulfillment-refusal.ts
│   │   │   │   ├── reconcile-card-payments.ts
│   │   │   │   ├── reconcile-product-listings.ts
│   │   │   │   └── ops-queries.ts             # listOrders, viewOrder, dueUnpaidOrders
│   │   │   └── adapters/
│   │   │       ├── driving/
│   │   │       │   ├── next/shop-page-data.ts
│   │   │       │   ├── http/cart-routes.ts
│   │   │       │   ├── http/checkout-route.ts
│   │   │       │   ├── http/ops-order-routes.ts
│   │   │       │   ├── hooks/stripe-hook.ts
│   │   │       │   ├── handlers/catalog-product-changed.ts
│   │   │       │   ├── handlers/listing-changed.ts
│   │   │       │   ├── handlers/billing-dunning-stage-changed.ts
│   │   │       │   ├── handlers/fulfillment-order-shipped.ts
│   │   │       │   ├── handlers/fulfillment-reservation-refused.ts
│   │   │       │   ├── handlers/fulfillment-shipment-refused.ts
│   │   │       │   ├── handlers/send-order-confirmation.ts
│   │   │       │   ├── handlers/cancel-card-payment.ts
│   │   │       │   ├── handlers/issue-card-refund.ts
│   │   │       │   ├── scheduled/cancel-overdue-orders.ts
│   │   │       │   ├── scheduled/reconcile-card-payments.ts
│   │   │       │   └── scheduled/reconcile-product-listings.ts
│   │   │       └── driven/
│   │   │           ├── postgres/schema.ts
│   │   │           ├── postgres/unit-of-work.ts
│   │   │           ├── postgres/cart-repository.ts
│   │   │           ├── postgres/order-repository.ts
│   │   │           ├── postgres/refund-repository.ts
│   │   │           ├── postgres/listing-replica.ts
│   │   │           ├── postgres/standing-replica.ts
│   │   │           ├── postgres/outbox.ts
│   │   │           ├── postgres/outbox-reader.ts
│   │   │           ├── postgres/sales-queries.ts
│   │   │           ├── stripe/stripe-card-payments.ts
│   │   │           ├── fulfillment/in-process-stock-reservations.ts
│   │   │           ├── mail/http-order-mail.ts
│   │   │           ├── next/next-shop-page-cache.ts
│   │   │           ├── payload/payload-product-source.ts
│   │   │           └── fakes/
│   │   │               ├── in-memory-unit-of-work.ts
│   │   │               ├── in-memory-sales-queries.ts
│   │   │               ├── fake-card-payments.ts
│   │   │               ├── fake-stock-reservations.ts
│   │   │               ├── fake-order-mail.ts
│   │   │               ├── fake-shop-page-cache.ts
│   │   │               ├── fake-product-source.ts
│   │   │               ├── fixed-clock.ts
│   │   │               └── sequential-ids.ts
│   │   └── test/
│   │       ├── domain/order.test.ts
│   │       ├── domain/checkout.test.ts
│   │       ├── domain/payment-methods.test.ts
│   │       ├── service/checkout.test.ts
│   │       ├── service/record-card-payment.test.ts
│   │       ├── service/cancel-card-payment.test.ts
│   │       ├── service/sync-product-listing.test.ts
│   │       ├── adapters/driven/contracts/unit-of-work.contract.ts
│   │       ├── adapters/driven/contracts/card-payments.contract.ts
│   │       ├── adapters/driven/fakes/in-memory-unit-of-work.test.ts
│   │       ├── adapters/driven/postgres/unit-of-work.integration.test.ts
│   │       ├── adapters/driven/stripe/stripe-card-payments.e2e.test.ts
│   │       ├── adapters/driving/hooks/stripe-hook.test.ts
│   │       └── adapters/driving/http/checkout-route.test.ts
│   ├── billing/
│   │   ├── package.json                       # @teashop/billing
│   │   ├── GLOSSARY.md
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/0000_init.sql
│   │   ├── src/
│   │   │   ├── offer.ts
│   │   │   ├── builder.ts
│   │   │   ├── published/customer-dunning-stage-changed.ts
│   │   │   ├── domain/
│   │   │   │   ├── money.ts
│   │   │   │   ├── vat.ts                     # reduced 7 %, standard 19 %
│   │   │   │   ├── billable-order.ts          # accumulates placed/paid/shipped/cancelled/refunded facts
│   │   │   │   ├── invoice.ts
│   │   │   │   ├── credit-note.ts
│   │   │   │   ├── number-series.ts           # gapless
│   │   │   │   ├── incoming-transfer.ts
│   │   │   │   ├── transfer-matching.ts       # specification matches(transfer, invoice)
│   │   │   │   ├── customer-account.ts        # dunning stage
│   │   │   │   ├── dunning-policy.ts
│   │   │   │   └── outgoing.ts
│   │   │   ├── service/
│   │   │   │   ├── driving-ports.ts
│   │   │   │   ├── driven-ports.ts
│   │   │   │   ├── note-order-placed.ts
│   │   │   │   ├── note-order-paid.ts
│   │   │   │   ├── note-order-shipped.ts
│   │   │   │   ├── note-order-cancelled.ts
│   │   │   │   ├── note-order-refunded.ts
│   │   │   │   ├── issue-due-documents.ts     # shared sequence: invoice/credit note when facts allow
│   │   │   │   ├── import-bank-transfers.ts
│   │   │   │   ├── match-transfer-manually.ts
│   │   │   │   ├── advance-dunning.ts
│   │   │   │   ├── send-invoice-mail.ts
│   │   │   │   ├── send-dunning-reminder.ts
│   │   │   │   └── ops-queries.ts
│   │   │   └── adapters/
│   │   │       ├── driving/handlers/{sales-order-placed,sales-order-paid,sales-order-cancelled,sales-order-refunded,fulfillment-order-shipped,send-invoice-mail,send-dunning-reminder}.ts
│   │   │       ├── driving/scheduled/{import-bank-transfers,run-dunning}.ts
│   │   │       ├── driving/http/ops-invoice-routes.ts
│   │   │       ├── driven/postgres/{schema,unit-of-work,billable-order-repository,invoice-repository,credit-note-repository,number-series-repository,incoming-transfer-repository,customer-account-repository,bank-cursor-repository,outbox,outbox-reader,billing-queries}.ts
│   │   │       ├── driven/bank/http-bank-statements.ts
│   │   │       ├── driven/mail/http-billing-mail.ts
│   │   │       └── driven/fakes/{in-memory-unit-of-work,in-memory-billing-queries,fake-bank-statements,fake-billing-mail,fixed-clock,sequential-ids}.ts
│   │   └── test/
│   │       ├── domain/number-series.test.ts
│   │       ├── domain/billable-order.test.ts
│   │       ├── domain/transfer-matching.test.ts
│   │       ├── domain/dunning-policy.test.ts
│   │       ├── service/note-order-shipped.test.ts
│   │       ├── service/import-bank-transfers.test.ts
│   │       └── adapters/driven/postgres/number-series-repository.integration.test.ts
│   └── fulfillment/
│       ├── package.json                       # @teashop/fulfillment, exports "./offer"
│       ├── GLOSSARY.md
│       ├── drizzle.config.ts
│       ├── drizzle/0000_init.sql
│       ├── src/
│       │   ├── offer.ts                       # open host types, published language, buildFulfillment, createFakeFulfillmentOpenHost
│       │   ├── builder.ts
│       │   ├── published/{open-host,confirm-reservation,release-reservation,ship-order,order-shipped,reservation-refused,shipment-refused}.ts
│       │   ├── domain/{stock-item,reservation,shipment,article,address,outgoing}.ts
│       │   ├── service/{driving-ports,driven-ports,reserve-stock,stock-levels,confirm-reservation,release-reservation,accept-ship-order,register-article,push-article,dispatch-shipment,record-shipment-report,expire-reservation,receive-stock,reconcile-article-master,ops-queries}.ts
│       │   └── adapters/
│       │       ├── driving/hooks/{warehouse-hook,payload-stock-field}.ts
│       │       ├── driving/handlers/{catalog-product-changed,confirm-reservation,release-reservation,ship-order,push-article,dispatch-shipment}.ts
│       │       ├── driving/scheduled/{expire-reservations,reconcile-article-master}.ts
│       │       ├── driving/http/ops-shipment-routes.ts
│       │       ├── driven/postgres/{schema,unit-of-work,stock-item-repository,shipment-repository,article-repository,outbox,outbox-reader,fulfillment-queries}.ts
│       │       ├── driven/warehouse/http-warehouse.ts
│       │       ├── driven/fakes/{in-memory-unit-of-work,in-memory-fulfillment-queries,fake-warehouse,fixed-clock}.ts
│       │       └── offered-fakes/fake-open-host.ts
│       └── test/
│           ├── domain/stock-item.test.ts
│           ├── domain/shipment.test.ts
│           ├── service/reserve-stock.test.ts
│           ├── service/confirm-reservation.test.ts
│           ├── adapters/offered-fakes/fake-open-host.test.ts   # same contract as the real open host
│           └── adapters/driven/warehouse/http-warehouse.e2e.test.ts
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── instrumentation.ts
│   │   ├── middleware.ts
│   │   ├── payload.config.ts                  # buildCatalogConfig({ stockField: (args) => courier().stockField(args), ... })
│   │   ├── src/
│   │   │   ├── env.ts
│   │   │   ├── assembly.ts
│   │   │   ├── courier.ts
│   │   │   └── probes/{health,metrics}.ts
│   │   └── app/
│   │       ├── (shop)/page.tsx
│   │       ├── (shop)/products/[slug]/page.tsx
│   │       ├── (shop)/cart/page.tsx
│   │       ├── api/cart/route.ts
│   │       ├── api/checkout/route.ts
│   │       ├── hooks/stripe/route.ts
│   │       ├── hooks/3pl/route.ts
│   │       ├── ops/orders/page.tsx
│   │       ├── ops/orders/[id]/page.tsx
│   │       ├── ops/orders/[id]/refund/route.ts
│   │       ├── ops/invoices/page.tsx
│   │       ├── ops/invoices/[id]/page.tsx
│   │       ├── ops/transfers/page.tsx
│   │       ├── ops/transfers/[id]/match/route.ts
│   │       ├── ops/shipments/page.tsx
│   │       ├── ops/stock/page.tsx
│   │       ├── ops/stock/receive/route.ts
│   │       ├── ops/bus/page.tsx
│   │       ├── (payload)/admin/[[...segments]]/page.tsx
│   │       ├── (payload)/api/payload/[...slug]/route.ts
│   │       ├── health/route.ts
│   │       └── metrics/route.ts
│   └── worker/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── env.ts
│           ├── assembly.ts
│           ├── catalog-outbox-reader.ts
│           └── probes/server.ts
└── tooling/
    ├── roles.sql                              # roles sales_rw, billing_rw, fulfillment_rw, payload_rw, bus_rw; grants per schema
    └── migrate/
        ├── package.json
        └── src/main.ts
```

Dependency rules in `.dependency-cruiser.cjs` (run in CI with biome and `tsc --noEmit`):

- `systems/*/src/domain/**` imports only `systems/<same>/src/domain/**`, plus `import type` from `@teashop/common`.
- `systems/*/src/service/**` imports its own `domain/`, `service/`, and `@teashop/common`; no package that reaches the outside (`pg`, `drizzle-orm`, `stripe`, `payload`, `next/*`, `node:fs`, `node:net`, `node:http`), no `process.env`, no `Date.now`/`new Date()`/`Math.random`/`crypto.randomUUID` (biome `noRestrictedGlobals` plus a grep check).
- `systems/*/src/adapters/**` may import its own `service/`, `domain/`, `published/`, other systems' `@teashop/<s>/offer` and outside packages; never another system's `src/` beyond `offer`.
- `systems/*/src/builder.ts` is the only file importing both `service/` and `adapters/`.
- `apps/**` imports systems only through `@teashop/<s>/offer`.
- `systems/*/src/published/**` imports nothing from `domain/`.

## How each property holds

**P1.** Each system's `domain/` holds its model (`Order`, `Cart`, `Invoice`, `NumberSeries`, `StockItem`,
`Shipment`, ...) as plain TypeScript values and functions, written in the system's `GLOSSARY.md` terms.
The dependency rules let `domain/` import nothing but itself and types from the common library, so no
store type (Drizzle row), carrier type (Stripe object, 3PL payload, Payload document) or framework type
can appear in it. Replacing Stripe, the 3PL or the bank changes an adapter file under
`adapters/driven/` and `builder.ts`. No system of this codebase is a conformist, so the Except is
unused. `catalog` is an external system: its model is Payload's (F9), not held to P1.

**P2.** Every business rule of this codebase's systems is a domain function: payment deadline and
the state machine of an order (`sales/domain/order.ts`), invoice offered only outside dunning
(`payment-methods.ts`), snapshot of price/sku/tax class (`order-line.ts`), refund refused for disputed
charges (`order.ts`), VAT by category (`billing/domain/vat.ts`), gapless numbering (`number-series.ts`:
`next()` returns `last + 1`, the adapter only locks the row), matching (`transfer-matching.ts`), dunning
stages (`dunning-policy.ts`), availability and hold expiry (`stock-item.ts`), articles registered before
dispatch (`shipment.ts`). Services hold sequences only; adapters translate only; tests assert outcomes
and do not restate rules. Store constraints carry no rule of ours: unique indexes exist only for ids and
idempotency keys. The two `catalog` rules (price above zero, sku unique) live once, in Payload's
collection config (S5); no system of ours checks them again.

**P3.** The cut follows reasons to change: selling and taking money (`sales`), accounting law, VAT,
numbering and collections (`billing`), warehouse and stock (`fulfillment`), editorial content
(`catalog`). Card payments stay inside `sales` (wider boundary) since a payment change and an order
change happen together. Each system has its own `Money` and its own view of an order (`Order`,
`BillableOrder`, `Shipment`), so a VAT change edits `billing` only and a checkout change edits
`sales` only. Inside a system, one module per aggregate, so a rule change touches one file.

**P4.** Driving adapters parse, call one driving port, and render; none decides anything. The same
`checkout` function is called by `checkout-route.ts`, by `service/checkout.test.ts` and could be by a
CLI; the same `recordCardPayment` by the Stripe hook and by `reconcile-card-payments`. Each driven
port has a real adapter and a fake; both pass one contract suite
(`test/adapters/driven/contracts/*.contract.ts`), run against the fake in the default suite and against
Postgres/Stripe as integration and end-to-end tests, so a use case cannot tell them apart.

**P5.** Each system receives every implementation through its system builder's config: pools, Stripe
keys, `FulfillmentOpenHost`, `Clock`, `Ids`. No system module reads `process.env`, constructs a client
at module level, or looks up a registry; the dependency rules forbid outside packages in `domain/` and
`service/`, and only `builder.ts` joins service and adapters. The operating system is outside (S19), so
time and randomness come through `Clock` and `Ids`. Every port type is written in the system's terms
(`Money`, `OrderId`, `Sku`, `"out_of_stock"`), never a Drizzle row, a Stripe `PaymentIntent` or an HTTP
status. The Except is used by pino logging and OTel spans from `@teashop/common`, reached by services
and adapters, whose output changes no answer. Driving adapters reached by Next.js and Payload get what
assembly produced through the courier, never through a system-level global.

**P6.** `buildSalesWithFakes()` (and the same per system) wires every driven port to a fake under
`adapters/driven/fakes/`, plus `createFakeFulfillmentOpenHost` for `sales`' tests. The in-memory unit of
work behaves as Postgres does where a use case can tell: it copies on commit, discards on throw, throws
`ConcurrencyConflict` on a stale `version`, enforces idempotency keys and unique ids, and returns
stored results for repeated keys. `FakeCardPayments` keeps intents with states and refuses refunds of
disputed charges like Stripe. The default suite runs every use case so; the contract suites prove each
fake against its real adapter.

**P7.** Every acting use case writes its system's records inside one `uow.run` call, which is one
Postgres transaction on the system's pool: aggregates, replicas, outbox rows and the idempotency key
commit together or roll back together. A use case that needs two transactions (`checkout`: fix the order
id on the cart, then place the order; then attach the payment reference) is built so every state between
them is one the domain allows (`Cart.pendingOrderId`, `Order` without `paymentRef`), and the next attempt
continues from it.

**P8.** Nothing leaves a system before its commit except tentative operations. Messages go into the
outbox in the transaction and the relay reads only committed rows. Mails, Stripe cancels and refunds,
3PL calls and shop page revalidation are private commands or events run by handlers after the commit.
Before the commit, `checkout` holds stock in `fulfillment` (a tentative operation: confirmed by
`ConfirmReservation` written in the same commit as the order, cancelled by expiry after 30 minutes or by
`ReleaseReservation`). The PaymentIntent is created after the order commits; it moves no money until the
customer confirms it. In `catalog`, the outbox row is written through Payload with the product's `req`,
so it commits with the product; revalidation follows `sales`' replica commit, never Payload's hook.

**P9.** Every handler passes the message id as `idempotencyKey` to `uow.run`; the key and the use case's
result are stored in `processed_message` in the same transaction. A repeat finds the key and returns
the stored result without writing; an overlapping repeat collides on the key's primary key, rolls back,
retries and then finds it. Hooks use the external event id (Stripe) or a derived uuid v5 (3PL). The bus
dedups `(message_id, handler)` and the relay can re-insert harmlessly. Effects outside: Stripe calls
carry idempotency keys derived from our ids; 3PL calls are `PUT` by our id; mail carries the provider's
idempotency header, and where the provider still sends twice, `sales/domain/order.ts` and
`billing/domain/dunning-policy.ts` state that a confirmation or reminder may arrive twice. Use cases whose
first run succeeded succeed again (stored result), so nothing parks for a change already made.

**P10.** Every aggregate row has `version`; repositories `UPDATE ... WHERE id = $1 AND version = $2` and
throw `ConcurrencyConflict` on zero rows; `retry-on-conflict.ts` reruns the use case up to 3 times, then
answers `conflict` (HTTP 409, or `retryLater` in a handler). Aggregates are cut at the business rules
that tie records: `StockItem` per sku (two checkouts of different teas never collide; the last unit of
one tea goes to one of them), `Order` per order, `CustomerAccount` per customer. `NumberSeries` per
series and year is locked `FOR UPDATE`, which ties all invoice issues together because gaplessness
does. Stale reads accepted by a rule: the listing replica's price is the price of the order
(`checkout.ts` documents that the price is the one `sales` shows), the standing replica decides invoice
availability (`payment-methods.ts` documents that a customer entering dunning during the lag may still
pick invoice once).

**P11.** One Postgres instance, one schema and one login role per system; `roles.sql` grants each role
rights on its own schema only, and each system's pool logs in as its role, so no system can read or
write another's tables. Other systems learn about records only from published messages and open host
service answers, and keep what they need as replicas or snapshots. The relay reads outboxes through each
system's outbox reader, whose rows are already published language; the `catalog` outbox reader in
assembly reads `payload.catalog_outbox` only, never `payload.products`.

**P12.** Every relationship is an anti-corruption layer. Other systems' published language is imported
only by handlers, hooks and driven adapters (`catalog-product-changed.ts` turns Payload fields into
`IncomingListing`; `sales-order-placed.ts` turns `taxClass` into `vatCategory`;
`in-process-stock-reservations.ts` turns `ReserveStockError` into `out_of_stock`); the dependency rules
forbid `domain/` and `service/` from importing any `offer`. Choosing conformity later means writing the
upstream type into the port, a visible edit to `driven-ports.ts`.

**P13.** Each system's published language lives in `src/published/`, which imports nothing from
`domain/`; outbox adapters map `SalesOutgoing` (domain terms) to `OrderPlacedV1` etc. A domain
refactor changes the mapping, not the schema. A schema change is a new version (`OrderPlacedV2`) published
alongside v1 until every subscriber lists v2 in `subscribesTo.versions`; the open host's types change the
same way, by adding a new port next to the old one.

**P14.** Messages: every envelope carries `type` and `version`; zod schemas per version; a producer emits
a new version only in the release after every consumer accepts it. A handler meeting a version it does not
know returns `retryLater` with `countsAsAttempt: false`, so a process running newer code takes it, and an
old process never reads it with a meaning it lacks. Records: expand-then-contract migrations keep every
column old code knows meaning what it meant; every aggregate row carries `model_version`, the code's
constant for that aggregate; a repository refuses to save (throws `NewerModelVersion`, so the use case
answers `retryLater`/503) a row whose stored `model_version` is above its own, so an old process cannot
write back a record it partly understands. Repositories write only the columns they map. Downstream
systems receive versioned messages and never read tables (P11).

**P15.** Browse, cart and invoice checkout need only `sales`' own records and replicas
(`product_listing`, `customer_standing`) plus `fulfillment`'s hold. Mails, refunds, 3PL calls, bank
polling and cancellations at Stripe run from outboxes and retry until the other system is back. Two
use cases need another system now, by rule: card checkout (the customer pays now, so Stripe is asked
now; it answers `payment_provider_unavailable` and the order waits for a retry or the deadline) and every
checkout's stock hold (an order is placed only with stock held; `fulfillment` runs in the same process on
the same Postgres instance, so it is down only when `sales` is). The Payload admin shows an empty stock
field when `fulfillment` throws. The shop page is served from the Next.js cache whatever `sales` does.

**P16.** Each unit of work opens a transaction on its own system's pool; the roles make a transaction that
writes two schemas fail. Services never hold a transaction open while calling another system: `checkout`
calls `reserveStock` between its two transactions, and `fulfillment` commits its hold on its own pool.

**P17.** Every cross-system state has an exit a rule names. A hold ends confirmed, released, or expired
after 30 minutes; a late `ConfirmReservation` holds again or answers `ReservationRefused`, which cancels
the order (refunding if paid). `awaiting_payment` ends at the deadline in `cancelling`, which ends in
`cancelled` or `paid` by Stripe's answer. A refund ends `refunded` or `refused`. A shipment waiting for
articles ends when `reconcile-article-master` re-pushes them, or `ShipmentRefused` cancels the order. An
order placed without a PaymentIntent (stop after commit) ends at its deadline. Missed Stripe webhooks are
repaired by `reconcile-card-payments`, missed listings by `reconcile-product-listings`. Transfers that
match nothing end in `unmatched`, a state `billing`'s rules name, cleared by manual matching. It does not
hold for parked deliveries: a delivery parked after 10 failures waits on `/ops/bus` for an operator, a
state no business rule names.

**P18.** Every handler decides against the state it holds, not against arrival order. Replicas apply a
`catalog.ProductChanged` or `CustomerDunningStageChanged` only when its `revision` is above the stored
one. `BillableOrder` accumulates facts (placed, paid, shipped, cancelled, refunded) and issues an invoice
or credit note when the facts it holds allow, whichever came first. `StockItem` keeps a tombstone in
`released_reservation`, so a `ConfirmReservation` after `ReleaseReservation` changes nothing, and
`ShipOrder` before `ConfirmReservation` confirms the hold itself. `Order` records an `OrderShipped` that
arrives after a refusal cancelled it as `shipped_after_cancel`, a state its rules allow and `/ops/orders`
lists, and treats a payment success after `cancelled` as a late payment to refund.

**P19.** Each system has a `GLOSSARY.md` and its own names for overlapping things: `Order` in `sales`,
`BillableOrder` and `Invoice` in `billing`, `Shipment` and `Reservation` in `fulfillment`; `taxClass`
in `sales`, `vatCategory` in `billing`; `Product` exists only in `catalog`, `ProductListing` in `sales`,
`Article` and `StockItem` in `fulfillment`. Another system's term enters a file only in the adapter
that translates it.

## Decisions the documents left to me

D1. **The cut into systems.** Chose `sales`, `billing`, `fulfillment`, and Payload as the external system
`catalog`. Also holding every property: a separate `payments` system; `inventory` split from `shipping`;
`dunning` split from `invoicing`.

D2. **What Payload is.** Chose: the external system `catalog`, run by us in our processes, its rules in its
configuration. Also holding: a `catalog` system of ours whose domain holds the product rules, with Payload
as its admin driving adapter and its store.

D3. **Card payments inside `sales`.** Chose `sales` as anti-corruption layer to Stripe. Also holding: a
`payments` system offering `startPayment`/`refund` and publishing `PaymentSucceeded`.

D4. **How `sales` knows products.** Chose a replica fed by `catalog.ProductChanged`, with nightly
reconciliation through the Local API. Also holding: answering calls to the Payload Local API at browse and
checkout, accepting that `catalog` must be up.

D5. **Where the shop page belongs.** Chose `sales`; cache revalidation through the private event
`sales.ListingChanged` handled in `web`. Also holding: a `storefront` system with its own replica.

D6. **How checkout learns dunning state.** Chose a replica of `billing.CustomerDunningStageChanged`. Also
holding: a synchronous `billing` open host port `invoiceOffered(customerId)`.

D7. **Stock reservation at checkout.** Chose a synchronous tentative hold in `fulfillment` (30 min),
confirmed by command after the order commits, refusing checkout when stock is short. Also holding:
reserving after `OrderPlaced` and cancelling the order when stock is short.

D8. **Orchestration over choreography** for the order: `sales`' `Order` is the process manager sending
`ConfirmReservation`, `ReleaseReservation`, `ShipOrder`. Also holding: `fulfillment` reacting to
`OrderPlaced`/`OrderPaid`/`OrderCancelled` events.

D9. **Card checkout order of steps.** Chose commit order first, then PaymentIntent (idempotency key
`pi:{orderId}`), `clientSecret` re-fetched on retry. Also holding: PaymentIntent before commit as a
tentative operation, cancelled by reconciliation when no order exists.

D10. **Which orders have a payment deadline.** Chose card orders only, 60 minutes after placement. Also
holding: any deadline length; a deadline for invoice orders before shipment.

D11. **When invoice orders ship and are invoiced.** Read "paid orders ship" as card-paid or placed on
invoice; invoice issued on `OrderShipped`, due 14 days later. Also holding: invoice issued on placement.

D12. **Order-confirmation mail timing.** Chose on placement (checkout commit), for both methods. Also
holding: after payment for card orders.

D13. **Refunds.** Chose full refunds only, requested by an operator, executed by private command after
commit, refused for disputed charges in the domain and by Stripe. Also holding: partial refunds.

D14. **How a refused command answers.** Chose a published `...Refused` event with `causationId`; the
command is settled. Also holding: the sender polling an open host status port.

D15. **Relay and bus.** Chose my own on Postgres (`bus` schema, `SKIP LOCKED`, 30 s lease, backoff, park
after 10, `LISTEN/NOTIFY`). Also holding: pg-boss, or a broker.

D16. **Idempotency mechanism.** Chose `processed_message` with stored result inside the use case's
transaction. Also holding: natural idempotency per aggregate state only.

D17. **Concurrency.** Chose optimistic `version` with 3 retries; pessimistic only for `NumberSeries`.
Also holding: `SELECT ... FOR UPDATE` per aggregate everywhere.

D18. **Store separation on one instance.** Chose one schema and one login role per system. Also holding:
one database per system on the same instance.

D19. **Payload's outbox.** Chose a hidden Payload collection written with `req`, `revision` = outbox
sequence, its reader in `worker` assembly. Also holding: a Postgres trigger on `payload.products`
writing the outbox.

D20. **Bank API.** Chose polling every 5 minutes with a stored cursor. Also holding: a bank hook.

D21. **Customer identity.** Chose `customerId` = lowercased email address; no accounts. Also holding: a
`customers` system with logins.

D22. **Money.** Chose integer euro cents, Payload field `priceCents`. Also holding: decimal strings.

D23. **Product lifecycle in Payload.** Chose sku immutable after create, no delete, `onSale` flag. Also
holding: deletable products publishing `ProductWithdrawn`.

D24. **Who owns stock counts.** Chose `fulfillment`: on-hand raised by `receiveStock` from `/ops/stock`,
lowered on the 3PL's shipped report. Also holding: stock levels synced from the 3PL.

D25. **Deployables.** Chose `web` (Next.js plus Payload, one instance) and `worker` (relay, bus, scheduler,
n instances). Also holding: everything in one process; Payload separate.

D26. **Courier.** Chose a lazy per-process singleton on `globalThis` in `apps/web/src/courier.ts`. Also
holding: a container put into `AsyncLocalStorage` by middleware.

D27. **Transaction handling.** Chose explicit `uow.run(tx => ...)`, never an ambient transaction. Also
holding: a per-request ambient transaction in `AsyncLocalStorage`.

D28. **Observability wiring.** Chose OTel SDK in both processes, `traceparent` and `requestId` in the
envelope, pino `mixin` from `AsyncLocalStorage`, `/metrics` via the OTel Prometheus exporter, no business
metrics. Also holding: prom-client; business metrics emitted by adapters.

D29. **Migrations.** Chose drizzle-kit per system plus `payload migrate`, run by a `migrate` job,
expand-only per release, contract one release later; `model_version` per aggregate row. Also holding:
a single migrations folder; blue/green with a stopped old version.

D30. **Message versioning.** Chose integer version per type, consumers list accepted versions, unknown
version answers `retryLater` without counting. Also holding: upcasters at the consumer.

D31. **Relationship patterns.** Chose anti-corruption layer everywhere, no conformist. Also holding:
`billing` conforming to `sales`' order lines.

D32. **Shared kernel.** Chose none; `Money` per system. Also holding: a `Money`/`TaxClass` shared kernel.

D33. **Port granularity.** Chose one function type per driving port (one use case), driven ports as
interfaces per aggregate or per outside party, grouped in a `Tx` object per unit of work. Also holding:
one driving interface per system.

D34. **Repository layout.** Chose a pnpm monorepo with `systems/*`, `apps/*`, `packages/common`,
`tooling/`, boundaries by dependency-cruiser. Also holding: one package with folder rules.

D35. **Scheduler.** Chose `croner` in `worker` with a Postgres advisory lock per task. Also holding: an
OS cron calling a CLI entry.

D36. **Reconciliations.** Chose nightly: card payments against Stripe, listings against Payload, article
master against the 3PL. Also holding: hourly, or none for listings.

D37. **Tests.** Chose default suite on fakes; contract suites shared by fake and real adapter;
integration tests on `docker-compose` Postgres; end-to-end tests on Stripe test mode and the 3PL sandbox.
Also holding: testcontainers.

D38. **Ops dashboard.** Chose one page set per system under `/ops`, each a driving adapter of one system;
no page combines systems. Also holding: a page calling several systems' driving ports.

D39. **Stock in the CMS.** Chose a virtual Payload field whose `afterRead` hook `fulfillment` provides.
Also holding: a Payload admin custom component calling an HTTP route of `fulfillment`.

D40. **Fulfillment refusal.** Chose: `sales` cancels the order and refunds if paid. Also holding: an
`attention` state for operators.

D41. **Dunning policy.** Chose stage 1 at due + 7 days, stage 2 at + 14, stage 3 at + 21 (handed to
collection by hand); "in dunning" = stage at least 1; back to 0 when no invoice is overdue. Also holding:
any steps.

D42. **Transfer matching.** Chose: reference contains an open invoice number and amount equals the open
amount; else unmatched. Also holding: fuzzy matching by payer name.

D43. **Price check at checkout.** Chose `expectedTotalCents` from the client, refused with
`price_changed` when the replica moved. Also holding: silently using the replica's price.

## Sentences I had to pick a reading for

S1. "A module is pure when calling it reaches nothing outside the process, it loads on every runtime,
and it hands its caller nothing the caller did not pass." (phrase "loads on every runtime") Readings: (a)
its import graph uses no runtime-specific module or global (no `node:*`, no `process`, no DOM); (b) it
merely does not fail at load time on other runtimes, using such globals lazily. Took (a). Changed: the
dependency rule bans `node:*` and `process` in `domain/`.

S2. Same sentence, phrase "hands its caller nothing the caller did not pass". Readings: (a) its result
is a function of its arguments only, so no hidden input such as time or randomness; (b) it returns no
reference to state it keeps (no shared mutable state handed out). Took (a), and (b) follows. Changed:
domain functions take `now: Date` and ids as arguments; `Clock` and `Ids` are driven ports used by services.

S3. "A module reaches what running it reads or calls, however the code got hold of it." Readings: (a)
type-only imports reach nothing, being erased; (b) any import counts. Took (a). Changed: `domain/` may
`import type { Result }` from the common library.

S4. P5 Except: "code of the common library reached by a service or an adapter, whose output changes
neither how a use case acts nor what it answers." Readings: (a) the domain may not reach the common
library at runtime (the Except names only services and adapters); (b) the domain, being pure, may reach
any pure common code. Took (a). Changed: no runtime import of `@teashop/common` in `domain/`; no shared
`Money` there.

S5. "Its configuration may hold business rules this codebase writes, in the external system's terms;
its architecture stays its own." against P2 "A business rule lives in one place: the domain". Readings:
(a) for an external system the configuration is where its rules live, which is the one place; (b) the
rules belong in a domain of ours and the configuration may only copy them. Took (a). Changed: price above
zero and unique sku exist only in `collections/products.ts`; no `catalog` system of ours.

S6. "The *outbox reader* is what the relay reads the outbox through, and marks it by; the system
provides it, and for an external system's outbox, assembly does." Readings: (a) assembly's code
implements the reader for an external system; (b) assembly only wires a reader written elsewhere (e.g.
in the external system's configuration). Took (a). Changed: `apps/worker/src/catalog-outbox-reader.ts`.

S7. "Two clients are one store when one transaction can carry the writes of both, two stores until it
can." Readings: (a) "can" as configured (credentials, roles); (b) "can" in principle on the same server.
Took (a). Changed: one login role per system with schema-only grants, so the four schemas are four stores
on one instance.

S8. "A replica's records are its keeper's; what they copy stays the owner's to decide." Readings: (a)
`sales` may write its replica rows only as the owner's messages or answers say, never by its own rules;
(b) `sales` may add its own fields to replica rows. Took (a). Changed: `product_listing` holds only
`catalog` fields plus `revision`; `sales` decisions about listings (e.g. none today) would sit in a
separate table.

S9. "*Private*: meant only for the system that wrote it." Readings: (a) private messages use the same
outbox, relay and bus, restricted to the writer's handlers; (b) private messages bypass the bus. Took
(a). Changed: `visibility` in the envelope; assembly fails on a foreign subscriber to a private type.

S10. "A handler settles a message by telling what delivered it that the message is done: the bus,
through its acknowledgement; the external system behind a hook, through the hook's answer." Readings:
(a) done = handled, refusal included; (b) done = succeeded. Took (a). Changed: refused commands are
acknowledged and answered by a `...Refused` event; only throws and `retryLater` leave a delivery
unsettled.

S11. "Of two systems that talk, the one the other depends on: it offers the open host service the other
calls, the commands the other sends, the events the other handles, and the published language both are
written in." Readings: (a) one direction per pair of systems, so `sales` and `billing` must not both
handle each other's events; (b) one direction per relationship, a pair may hold two. Took (b). Changed:
`sales` -> `billing` (order events) and `billing` -> `sales` (dunning event) coexist; same for
`fulfillment`/`sales`.

S12. "It names one use case the system offers and what a caller must bring, in the system's terms, not
its store's." Readings: (a) one port per use case; (b) a port interface may group several use cases,
each method naming one. Took (a). Changed: one function type per use case; `SalesDrivingPorts` only
bundles them for handing over.

S13. "A specialized driven port over exactly one aggregate: loads it, saves it, finds it." Readings: (a)
one aggregate type; (b) one aggregate instance. Took (a). Changed: `OrderRepository` over `Order`;
`StockItemRepository.save(items)` saves several instances of one type in one call.

S14. P9 "A repeated delivery changes no record of this system, and succeeds where the first did".
Readings: (a) "delivery" includes hook calls from external systems; (b) only bus deliveries. Took (a).
Changed: Stripe and 3PL hooks pass event ids as idempotency keys too.

S15. P8 "What is asked of another system, or of this one, before the commit stays tentative, confirmed
only after it." Readings: (a) whatever is asked before the commit must be a tentative operation with an
explicit confirm; (b) it suffices that nothing irreversible follows before the commit. Took (a) for the
stock hold (explicit `ConfirmReservation`), and avoided the question for Stripe by creating the
PaymentIntent after the commit.

S16. P15 "unless a business rule needs another system's answer now". Readings: (a) "stock is reserved
when an order is placed" is such a rule, so checkout may fail when `fulfillment` cannot answer; (b) it is
not, so reservation must follow placement asynchronously. Took (a). Changed: synchronous `reserveStock`
in checkout, `stock_unavailable` as an error.

S17. P10 "A stale read is one a business rule accepts, with what happens meanwhile." Readings: (a) the
acceptance must be stated where the rule is written; (b) acceptance can be implied by the brief. Took (a).
Changed: `checkout.ts` and `payment-methods.ts` state which replica they read and what the lag allows.

S18. P14 "A record or a message means the same to all code that reads it, whenever it was written".
Readings: (a) old code must understand newer records and messages; (b) no code may read them with a
different meaning, and refusing to read counts. Took (b). Changed: `model_version` refusal on save and
`retryLater` for unknown message versions.

S19. "Other systems and third parties, the operating system among them, whether they drive the system
or it drives them." Readings: (a) clock and randomness are the operating system, hence outside; (b) only
I/O is. Took (a). Changed: `Clock` and `Ids` driven ports in every system.

S20. "Code that runs in no process of the deployed application." Readings: (a) a release-time migration
job is no process of the deployed application; (b) it is one, being deployed. Took (a). Changed:
`tooling/migrate`, free to import every system's Drizzle schema.

S21. "Code a process runs to report on itself rather than on a system." Readings: (a) `/health` pinging
the database reports on the process's connections, so it is a probe; (b) the database is the systems'
store, so it reports on systems. Took (a); and kept business counts out of `/metrics` so it stays a
probe. Changed: probes under `apps/*/src/probes`, using the pools directly.

S22. "The one place in a process where every port gets its implementation, and the only place where port
and implementation meet." with "**System builder.** The part of assembly a system provides". Readings:
(a) the system builder is part of assembly, so port and adapter meet there; (b) they meet only in
`apps/*/assembly.ts`. Took (a). Changed: `builder.ts` per system constructs adapters; apps call builders.

S23. "What a system makes public for other code: its published language, its open host service's driving
port types, its system builders and the fakes of those ports." Readings: (a) "those ports" = the open
host service's driving ports; (b) all ports including driven. Took (a). Changed: only
`createFakeFulfillmentOpenHost` is offered; driven-port fakes stay inside each system.

S24. "There are as many driving adapters as there are ways into the process." Readings: (a) each route,
hook, handler and scheduled task is a way in; (b) each protocol server (one HTTP server) is one. Took (a).
Changed: one adapter file per route group, hook, message type and task.

S25. "It has an id, the same on every delivery of it." Readings: (a) for a message from an external
system its own event id serves; where it has none, an id derived from its content; (b) we mint an id on
receipt. Took (a); (b) would give each redelivery a new id. Changed: uuid v5 for 3PL reports lacking an id.

S26. "**Hook.** A driving adapter an external system calls." Readings: (a) a function Payload invokes
in-process (field hook) is a hook; (b) only HTTP webhooks are. Took (a). Changed:
`fulfillment/adapters/driving/hooks/payload-stock-field.ts`.

S27. P11 "...or reads them except through its published language". Readings: (a) the relay and the
`catalog` outbox reader read outbox rows, which are published language, so this holds; (b) any direct
table read by code not of the owner breaks it. Took (a). Changed: outbox rows are stored already in
published-language form; the readers never touch other tables.

S28. "An *event* says something happened; no receiver can refuse it." Readings: (a) a receiver may still
decide it changes nothing (stale revision) and settle; (b) every event must change the receiver's state.
Took (a). Changed: replicas ignore lower revisions and settle.

S29. "An *acting* use case changes the system and may return what it did; an *answering* one changes
nothing." Readings: (a) a use case that only drives the outside (cache revalidation) is acting; (b) it is
answering, changing no record. Took (a). Changed: `refreshShopPage` is an acting use case and runs as a
handler.

S30. P17 "Completing, undoing and accepting the divergence are each something a business rule allows."
Readings: (a) a waiting-for-operator state counts as allowed only where a domain rule names it; (b) any
operator queue counts. Took (a). Changed: P17 reported as not holding for parked deliveries; `unmatched`
transfers do count, being named in `billing`'s domain.
