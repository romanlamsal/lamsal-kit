# Fresh repository draft A, distilled set

Tea shop. TypeScript on Node 22, pnpm workspaces, one Postgres 17 instance, Drizzle ORM, Payload CMS 3
(on Next.js 15), Stripe, a 3PL warehouse API with webhooks, a bank API, Resend as mail provider, pino,
OpenTelemetry exporting OTLP to Jaeger, `AsyncLocalStorage`. Added by me: Fastify 5 (HTTP), pg-boss 10
(bus), zod (published-language schemas at adapters), vitest, testcontainers, dependency-cruiser,
Biome, prom-client.

## Systems and what each owns

| System | Kind | Owns (records whose content its business rules decide) | Keeps (store) |
|---|---|---|---|
| `catalog` | external system: Payload CMS, run by us inside the `web` process; we write its configuration | products: copy, images, slug, price, sku, tax class. Business rules in its configuration: price above zero, sku unique | Postgres schema `payload`, role `payload_app`; images on the `media` volume; its outbox is the Payload collection `catalog-outbox` in the same schema |
| `ordering` | ours | customers, carts, orders and order lines (each line a snapshot of price, sku, tax class), payment deadline, who is offered pay by invoice | schema `ordering`, role `ordering_app`. Also keeps two replicas: `catalog_items` (owner `catalog`), `customer_standings` (owner `billing`) |
| `payments` | ours | card payments, their refunds, dispute state; rule "a disputed charge is not refunded" | schema `payments`, role `payments_app` |
| `billing` | ours | billable orders, invoices, credit notes, gapless number series, VAT by tax class, incoming transfers and their matching, debtors and their dunning stage | schema `billing`, role `billing_app` |
| `fulfilment` | ours | stock reservations and reserved quantities, articles and their 3PL registration state, shipments | schema `fulfilment`, role `fulfilment_app`. Also keeps a replica: on-hand quantity per sku (owner: the 3PL) |

External systems besides `catalog`:

| External system | Driven through | Drives us through (hook) | Downstream of it |
|---|---|---|---|
| Stripe | Stripe SDK: PaymentIntents, Refunds | `POST /hooks/stripe` (signed webhooks) | `payments`, anti-corruption layer |
| 3PL warehouse | REST API: articles, orders, stock | `POST /hooks/warehouse` (shipment reports) | `fulfilment`, anti-corruption layer |
| Bank | REST API: transactions since cursor (polled) | none | `billing`, anti-corruption layer |
| Resend | Resend SDK with `Idempotency-Key` | none | `ordering`, `billing`, each with its own adapter |

`catalog` is upstream of `ordering` and `fulfilment`; both translate it (anti-corruption layer). No
relation in this codebase is conformist.

Upstream/downstream between our systems:
- `fulfilment` upstream of `ordering` for `ReserveStock`; `ordering` upstream of `fulfilment` for its
  events and `GetOrderStatus`.
- `payments` upstream of `ordering` for `StartCardPayment` and `RefundPayment`; `ordering` upstream of
  `payments` for `OrderCancelled`.
- `ordering`, `payments`, `fulfilment` upstream of `billing`; `billing` upstream of `ordering` for
  `DebtorStandingChanged` and `InvoicePaid`.

Shared kernel: `@teashop/kernel`, holding only `Money` (integer euro cents, currency `EUR`, add,
multiply, allocate). Imported into the domains of `ordering`, `payments`, `billing`.

Code that is no system:
- Common library `@teashop/common`: `Result`, message `Envelope`, `MessageHandler` and `OutboxReader`
  types, Drizzle outbox table factory and outbox writer/reader plumbing, Drizzle unit of work,
  conflict retry, `requestContext` (`AsyncLocalStorage`), pino logger, OTel tracer helpers, test
  helpers (fake clock, sequential ids, in-memory outbox).
- `@teashop/messaging`: relay loop and pg-boss bus wiring. Imported only by `apps/worker` and
  `apps/api`; no system imports it.
- `apps/*`: process entry points, assembly, probes (`/health`, `/metrics`), config parsing.
- The web UI in `apps/web`: storefront pages, ops dashboard views inside the Payload admin, the
  read-only stock field. User interfaces are out of scope; they are listed only as callers.
- Tooling: `tooling/check-migrations.ts`, `tooling/check-published-language.ts`, drizzle-kit configs,
  dependency-cruiser and Biome config, `infra/postgres/*.sql`.

## Ports and adapters

Common shapes (common library and shared kernel):

```ts
// @teashop/common/result
export type Result<T, E extends { kind: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// @teashop/kernel
export type Money = { readonly cents: number; readonly currency: "EUR" };

// @teashop/common/message
export type Envelope<P = unknown> = {
  readonly id: string;                 // uuid v7, same on every delivery and in every version
  readonly system: "catalog" | "ordering" | "payments" | "billing" | "fulfilment";
  readonly kind: "event" | "command";
  readonly visibility: "published" | "private";
  readonly type: string;               // "OrderPlaced"
  readonly version: number;            // 1
  readonly occurredAt: string;         // ISO
  readonly payload: P;
  readonly headers: { traceparent?: string; tracestate?: string; requestId?: string };
};
export type Topic = `${Envelope["system"]}.${string}.v${number}`;
export interface MessageHandler {
  readonly queue: string;              // "billing.on-order-placed"
  readonly topics: readonly Topic[];
  handle(message: Envelope): Promise<void>;   // resolve = settle; throw = redeliver
}
export interface OutboxReader {
  readonly source: Envelope["system"];
  drain(limit: number, deliver: (m: Envelope) => Promise<void>): Promise<number>;
}
export interface ScheduledTask {
  readonly name: string;               // "ordering.cancel-overdue-orders"
  readonly cron: string;
  run(): Promise<void>;
}
export interface Clock { now(): Date }
```

Every system's service gets a unit of work that hands it the repositories and outbox port of one
transaction:

```ts
export interface UnitOfWork<Tx> { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
```

### `ordering`

Domain (`systems/ordering/core/src/domain`): `Cart`, `Order` (state machine `awaitingPayment |
readyToShip | cancelled`, flags `paid`, `refundRequested`, `needsAttention`), `OrderLine`
(snapshot), `Customer`, `CatalogItem` (replica), `CustomerStanding` (replica), specification
`mayPayByInvoice(standing)`, `paymentDeadline(placedAt)`, `orderIdFor(cartId, cartVersion)`.

Driving ports. Open host service, in `@teashop/ordering-offer`:

```ts
export type GetOrderStatusV1 = (input: { orderId: string }) => Promise<
  | { found: false }
  | { found: true; status: "awaitingPayment" | "readyToShip" | "cancelled" }>;
```

Internal driving ports, in `core/src/service/ports/driving.ts`:

```ts
export type AddToCart = (i: { cartId: CartId | null; sku: Sku; quantity: number })
  => Promise<Result<CartView, { kind: "cartNotFound" } | { kind: "itemUnavailable"; sku: Sku }>>;
export type ChangeCartLine = (i: { cartId: CartId; sku: Sku; quantity: number })   // 0 removes
  => Promise<Result<CartView, { kind: "cartNotFound" } | { kind: "cartCheckedOut" }>>;
export type ViewCart = (i: { cartId: CartId }) => Promise<Result<CartView, { kind: "cartNotFound" }>>;
export type Checkout = (i: {
  cartId: CartId;
  customer: { email: string; name: string; billingAddress: Address; shippingAddress: Address };
  paymentMethod: "card" | "invoice";
}) => Promise<Result<CheckoutOutcome, CheckoutRefusal>>;
export type CheckoutOutcome =
  | { orderId: OrderId; total: Money; paymentMethod: "card"; clientSecret: string }
  | { orderId: OrderId; total: Money; paymentMethod: "invoice" };
export type CheckoutRefusal =
  | { kind: "cartNotFound" } | { kind: "cartEmpty" }
  | { kind: "itemUnavailable"; skus: Sku[] } | { kind: "outOfStock"; skus: Sku[] }
  | { kind: "invoiceNotOffered" }
  | { kind: "stockUnavailable" }                         // fulfilment did not answer
  | { kind: "paymentUnavailable"; orderId: OrderId };   // order placed, card payment not started
export type ResumeCardPayment = (i: { orderId: OrderId }) => Promise<Result<{ clientSecret: string },
  { kind: "orderNotFound" } | { kind: "notAwaitingPayment" } | { kind: "paymentUnavailable" }>>;
export type CancelOverdueOrders = () => Promise<{ cancelled: number }>;
export type RecordCardPaymentSucceeded = (i: { orderId: OrderId; paymentId: string; amount: Money })
  => Promise<Result<void, { kind: "orderNotFound" }>>;
export type RecordInvoicePaid = (i: { orderId: OrderId }) => Promise<Result<void, { kind: "orderNotFound" }>>;
export type RecordRefundRefused = (i: { orderId: OrderId; reason: string }) => Promise<Result<void, { kind: "orderNotFound" }>>;
export type SendOrderConfirmation = (i: { orderId: OrderId }) => Promise<Result<void, { kind: "orderNotFound" } | { kind: "mailUnavailable" }>>;
export type RefreshCatalogItem = (i: CatalogItemFacts) => Promise<void>;
export type RefreshCustomerStanding = (i: { customerId: CustomerId; inDunning: boolean; standingVersion: number }) => Promise<void>;
export type ReconcileCatalog = () => Promise<{ refreshed: number }>;
export type ListOrders = (i: { status?: OrderStatus; after?: OrderId; limit: number }) => Promise<OrderSummary[]>;
```

Driven ports, in `core/src/service/ports/driven.ts`:

```ts
export type OrderingTx = {
  carts: CartRepository; orders: OrderRepository; customers: CustomerRepository;
  catalogItems: CatalogItemReplica; standings: CustomerStandingReplica;
  confirmations: OrderConfirmationRepository; outbox: OrderingOutbox;
};
export interface CartRepository { load(id: CartId): Promise<Cart | null>; save(c: Cart): Promise<void> }
export interface OrderRepository {
  load(id: OrderId): Promise<Order | null>; save(o: Order): Promise<void>;
  overdue(now: Date, limit: number): Promise<OrderId[]>;
  page(i: { status?: OrderStatus; after?: OrderId; limit: number }): Promise<Order[]>;
}
export interface CustomerRepository { byEmail(email: string): Promise<Customer | null>; save(c: Customer): Promise<void> }
export interface CatalogItemReplica { many(skus: Sku[]): Promise<CatalogItem[]>; save(i: CatalogItem): Promise<void> }
export interface CustomerStandingReplica { load(id: CustomerId): Promise<CustomerStanding | null>; save(s: CustomerStanding): Promise<void> }
export interface OrderConfirmationRepository { sent(id: OrderId): Promise<boolean>; markSent(id: OrderId, at: Date): Promise<void> }
export interface OrderingOutbox { add(m: OrderingMessage): void }   // OrderPlaced | OrderReadyToShip | OrderCancelled | RefundRequested | ConfirmationDue
export interface StockReservations {
  reserve(orderId: OrderId, lines: { sku: Sku; quantity: number }[])
    : Promise<Result<void, { kind: "outOfStock"; skus: Sku[] } | { kind: "unavailable" }>>;
}
export interface CardPayments {
  start(i: { orderId: OrderId; amount: Money; customerEmail: string })
    : Promise<Result<{ clientSecret: string }, { kind: "unavailable" }>>;
}
export interface CatalogSource { changedSince(cursor: string | null): AsyncIterable<CatalogItemFacts> }
export interface MailSender {
  send(m: { idempotencyKey: string; to: string; subject: string; text: string; html: string })
    : Promise<Result<void, { kind: "rejected" } | { kind: "unavailable" }>>;
}
export interface OrderingIds { newCartId(): CartId; newCustomerId(): CustomerId; newMessageId(): string }
// plus Clock, UnitOfWork<OrderingTx>
```

Driven adapters (`core/src/adapters/driven`): `drizzle/schema.ts`, `drizzle-cart-repository.ts`,
`drizzle-order-repository.ts`, `drizzle-customer-repository.ts`, `drizzle-catalog-item-replica.ts`,
`drizzle-customer-standing-replica.ts`, `drizzle-order-confirmation-repository.ts`,
`drizzle-ordering-outbox.ts` (translates `OrderingMessage` into every live published version),
`drizzle-unit-of-work.ts`, `in-process-stock-reservations.ts` (calls `fulfilment`'s `ReserveStockV1`,
translates), `in-process-card-payments.ts` (calls `payments`' `StartCardPaymentV1`, translates),
`payload-catalog-source.ts` (Payload REST `GET /api/products?where[updatedAt][greater_than]=`),
`resend-mail-sender.ts`, `system-clock.ts`, `uuid-v7-ids.ts`. Fakes (`core/src/adapters/fake`):
`in-memory-ordering-store.ts` (all repositories, replicas, outbox and unit of work over maps,
copy-on-commit), `fake-stock-reservations.ts`, `fake-card-payments.ts`, `fake-catalog-source.ts`,
`recording-mail-sender.ts`.

Driving adapters (`core/src/adapters/driving`):
- `http/ordering-routes.ts` (Fastify plugin): `POST /ordering/carts`, `PUT
  /ordering/carts/:cartId/lines/:sku`, `GET /ordering/carts/:cartId`, `POST /ordering/checkouts`,
  `POST /ordering/orders/:orderId/card-payment`, `GET /ordering/orders`.
- Handlers: `on-product-changed.ts` (`catalog.ProductChanged.v1`), `on-debtor-standing-changed.ts`
  (`billing.DebtorStandingChanged.v1`), `on-payment-succeeded.ts` (`payments.PaymentSucceeded.v1`),
  `on-invoice-paid.ts` (`billing.InvoicePaid.v1`), `on-refund-refused.ts`
  (`payments.RefundRefused.v1`), `on-confirmation-due.ts` (private `ordering.ConfirmationDue.v1`).
- Scheduled tasks: `cancel-overdue-orders.ts` (every minute), `reconcile-catalog.ts` (03:00 daily).
- In-process open host service: `get-order-status.ts` exports the `GetOrderStatusV1` function
  built over the internal `GetOrderStatus` port.

### `payments`

Domain: `Payment` aggregate (`intentCreated | succeeded | canceled`, `disputed: boolean`, `refund:
Refund | null` with `requested | submitted | succeeded | refused`), `requestRefund()` returns refusal
when disputed, not succeeded or already refunded.

Open host service, in `@teashop/payments-offer`:

```ts
export type StartCardPaymentV1 = (i: { orderId: string; amountCents: number; currency: "EUR"; customerEmail: string })
  => Promise<Result<{ paymentId: string; clientSecret: string },
       { kind: "processorUnavailable" } | { kind: "alreadySettled" }>>;
// published command, delivered by the bus
export const RefundPaymentV1 = z.object({ orderId: z.string(), reason: z.literal("paidAfterCancellation") });
```

Internal driving ports:

```ts
export type StartCardPayment = (i: { orderId: string; amount: Money; customerEmail: string })
  => Promise<Result<{ paymentId: PaymentId; clientSecret: string }, { kind: "processorUnavailable" } | { kind: "alreadySettled" }>>;
export type RecordIntentSucceeded = (i: { paymentId: PaymentId; intentId: string }) => Promise<Result<void, { kind: "paymentNotFound" }>>;
export type RecordIntentCanceled = (i: { paymentId: PaymentId }) => Promise<Result<void, { kind: "paymentNotFound" }>>;
export type RecordDisputeOpened = (i: { intentId: string }) => Promise<Result<void, { kind: "paymentNotFound" }>>;
export type RecordRefundSettled = (i: { refundId: RefundId; outcome: "succeeded" | "failed" }) => Promise<Result<void, { kind: "refundNotFound" }>>;
export type RequestRefund = (i: { by: { paymentId: PaymentId } | { orderId: string }; reason: RefundReason; commandId?: string })
  => Promise<Result<{ refundId: RefundId }, { kind: "paymentNotFound" }
       | { kind: "notRefundable"; reason: "disputed" | "notSucceeded" | "alreadyRefunded" }>>;
export type ExecuteRefund = (i: { refundId: RefundId }) => Promise<Result<void, { kind: "processorUnavailable" }>>;
export type CancelCardPayment = (i: { orderId: string }) => Promise<Result<void, { kind: "processorUnavailable" }>>;
export type ReconcileCardPayments = () => Promise<{ repaired: number }>;
export type ListPayments = (i: { orderId?: string; after?: PaymentId; limit: number }) => Promise<PaymentSummary[]>;
```

Driven ports:

```ts
export type PaymentsTx = { payments: PaymentRepository; outbox: PaymentsOutbox };
export interface PaymentRepository {
  load(id: PaymentId): Promise<Payment | null>; byOrder(orderId: string): Promise<Payment | null>;
  byIntent(intentId: string): Promise<Payment | null>; byRefund(id: RefundId): Promise<Payment | null>;
  unsettledOlderThan(t: Date, limit: number): Promise<Payment[]>; save(p: Payment): Promise<void>;
}
export interface PaymentsOutbox { add(m: PaymentsMessage): void }  // PaymentSucceeded | PaymentRefunded | RefundRefused | RefundDue
export interface CardProcessor {
  createIntent(i: { idempotencyKey: string; paymentId: PaymentId; orderId: string; amount: Money; email: string })
    : Promise<Result<{ intentId: string; clientSecret: string }, { kind: "unavailable" }>>;
  cancelIntent(intentId: string): Promise<Result<void, { kind: "alreadySucceeded" } | { kind: "unavailable" }>>;
  refund(i: { idempotencyKey: RefundId; intentId: string; amount: Money })
    : Promise<Result<{ processorRefundId: string }, { kind: "disputed" } | { kind: "unavailable" }>>;
  intentState(intentId: string): Promise<Result<"pending" | "succeeded" | "canceled", { kind: "unavailable" }>>;
}
export interface PaymentsIds { paymentIdFor(orderId: string): PaymentId; newRefundId(): RefundId; newMessageId(): string }
// plus Clock, UnitOfWork<PaymentsTx>
```

Driven adapters: `drizzle-payment-repository.ts`, `drizzle-payments-outbox.ts`,
`drizzle-unit-of-work.ts`, `stripe-card-processor.ts` (Stripe SDK, `idempotencyKey` option,
metadata `paymentId`, `orderId`), `system-clock.ts`, `uuid-ids.ts` (`paymentIdFor` is uuid v5 of the
order id). Fakes: `in-memory-payments-store.ts`, `fake-card-processor.ts`.

Driving adapters: `http/payments-routes.ts` (`GET /payments/payments`, `POST
/payments/payments/:paymentId/refunds`); hook `hooks/stripe-hook.ts` (`POST /hooks/stripe`, raw body,
`stripe.webhooks.constructEvent`, maps `payment_intent.succeeded`, `payment_intent.canceled`,
`charge.dispute.created`, `refund.updated` to the internal ports, ignores the rest with 200);
handlers `on-refund-payment.ts` (command `payments.RefundPayment.v1`), `on-order-cancelled.ts`
(`ordering.OrderCancelled.v1`), `on-refund-due.ts` (private `payments.RefundDue.v1`); scheduled
task `reconcile-card-payments.ts` (hourly); in-process open host service
`start-card-payment.ts`.

### `billing`

Domain: `BillableOrder` (collects facts `placed`, `paidByCard`, `shipped`, `cancelled` in any order;
decides when an invoice is due to be issued), `Invoice` (lines with VAT rate, net, VAT, gross;
`open | paid`, `dueDate`, `allocations`), `CreditNote`, `vatRateFor(taxClass)` in `vat.ts`
(`tea` 7, `accessories` 19), `InvoiceNumber.format(series, year, n)`, `IncomingTransfer`
(`unmatched | matched`), specification `matchesInvoice(transfer, invoice)` in
`transfer-matching.ts`, `Debtor` (dunning stage 0 to 3) and `dunningPolicy` in `dunning-policy.ts`.

Open host service: none synchronous. Published language in `@teashop/billing-offer`: events
`InvoicePaid.v1`, `DebtorStandingChanged.v1`.

Internal driving ports:

```ts
export type RecordOrderPlaced = (i: { orderId: string; debtor: DebtorFacts; paymentMethod: "card" | "invoice";
  lines: { sku: string; name: string; quantity: number; unitPrice: Money; taxClass: TaxClass }[] }) => Promise<void>;
export type RecordCardPayment = (i: { orderId: string; paidAt: Date }) => Promise<void>;
export type RecordShipment = (i: { orderId: string; shippedAt: Date }) => Promise<void>;
export type RecordOrderCancelled = (i: { orderId: string }) => Promise<void>;
export type RecordRefund = (i: { orderId: string; refundId: string; amount: Money; refundedAt: Date }) => Promise<void>;
export type ImportBankTransfers = () => Promise<Result<{ imported: number; matched: number }, { kind: "bankUnavailable" }>>;
export type AssignTransfer = (i: { transferId: TransferId; invoiceNumber: string })
  => Promise<Result<void, { kind: "transferNotFound" } | { kind: "alreadyMatched" } | { kind: "invoiceNotOpen" }>>;
export type RunDunning = () => Promise<{ advanced: number; cleared: number }>;
export type SendDunningReminder = (i: { debtorId: DebtorId; stage: 1 | 2 | 3 }) => Promise<Result<void, { kind: "mailUnavailable" }>>;
export type MailDocument = (i: { number: string }) => Promise<Result<void, { kind: "mailUnavailable" }>>;
export type ListInvoices = (i: { status?: "open" | "paid"; after?: string; limit: number }) => Promise<InvoiceSummary[]>;
export type ListUnmatchedTransfers = (i: { limit: number }) => Promise<TransferSummary[]>;
```

Driven ports:

```ts
export type BillingTx = {
  billableOrders: BillableOrderRepository; invoices: InvoiceRepository; creditNotes: CreditNoteRepository;
  numbers: NumberSeries; transfers: IncomingTransferRepository; debtors: DebtorRepository;
  cursors: ImportCursorRepository; outbox: BillingOutbox;
};
export interface NumberSeries { next(series: "RE" | "GS", year: number): Promise<number> }  // inside the tx
export interface InvoiceRepository {
  byNumber(n: string): Promise<Invoice | null>; byOrder(orderId: string): Promise<Invoice | null>;
  openFor(debtorId: DebtorId): Promise<Invoice[]>; open(): Promise<Invoice[]>; save(i: Invoice): Promise<void>;
}
export interface IncomingTransferRepository { insertNew(t: IncomingTransfer): Promise<boolean>; load(id: TransferId): Promise<IncomingTransfer | null>; save(t: IncomingTransfer): Promise<void> }
export interface DebtorRepository { load(id: DebtorId): Promise<Debtor | null>; withOverdue(asOf: Date): Promise<DebtorId[]>; save(d: Debtor): Promise<void> }
export interface BankAccount {
  transfersSince(cursor: string | null)
    : Promise<Result<{ transfers: IncomingTransferFacts[]; nextCursor: string }, { kind: "unavailable" }>>;
}
export interface DocumentRenderer { pdf(doc: Invoice | CreditNote): Promise<Uint8Array> }
export interface BillingOutbox { add(m: BillingMessage): void } // InvoicePaid | DebtorStandingChanged | DocumentIssued | ReminderDue
// plus BillableOrderRepository, CreditNoteRepository, ImportCursorRepository, MailSender (own copy), Clock, ids, UnitOfWork<BillingTx>
```

Driven adapters: Drizzle repositories, `drizzle-number-series.ts` (`INSERT ... ON CONFLICT (series,
year) DO UPDATE SET next = number_series.next + 1 RETURNING next - 1`), `bank-api-account.ts`,
`pdfkit-document-renderer.ts`, `resend-mail-sender.ts`, outbox, unit of work. Fakes for each.

Driving adapters: `http/billing-routes.ts` (`GET /billing/invoices`, `GET /billing/transfers?status=unmatched`,
`POST /billing/transfers/:transferId/assignment`); handlers `on-order-placed.ts`,
`on-order-cancelled.ts`, `on-payment-succeeded.ts`, `on-payment-refunded.ts`,
`on-shipment-dispatched.ts`, `on-document-issued.ts` (private), `on-reminder-due.ts` (private);
scheduled tasks `import-bank-transfers.ts` (every 10 minutes), `run-dunning.ts` (06:00
Europe/Berlin daily).

### `fulfilment`

Domain: `StockItem` per sku (`onHand` replica value, `reserved`; `reserve(q)` refuses when `onHand -
reserved < q`), `Reservation` (`tentative | held | consumed | released`), `Article` (`pending |
registered | rejected`), `Shipment` (`waitingForArticles | ready | submitted | dispatched |
blocked`; accepts `dispatched` from any earlier state).

Open host service, in `@teashop/fulfilment-offer`:

```ts
export type ReserveStockV1 = (i: { reservationId: string; lines: { sku: string; quantity: number }[] })
  => Promise<Result<{ reservationId: string }, { kind: "insufficientStock"; skus: string[] }>>;
```

Internal driving ports:

```ts
export type ReserveStock = (i: { reservationId: ReservationId; lines: { sku: Sku; quantity: number }[] })
  => Promise<Result<{ reservationId: ReservationId }, { kind: "insufficientStock"; skus: Sku[] }>>;
export type HoldReservation = (i: { reservationId: ReservationId }) => Promise<void>;     // on OrderPlaced
export type ReleaseReservation = (i: { reservationId: ReservationId }) => Promise<void>;  // on OrderCancelled
export type ReconcileTentativeReservations = () => Promise<{ held: number; released: number }>;
export type RecordProductChanged = (i: { sku: Sku; description: string; changedAt: Date }) => Promise<void>;
export type RegisterArticle = (i: { sku: Sku }) => Promise<Result<void, { kind: "warehouseUnavailable" }>>;
export type CreateShipment = (i: { orderId: string; lines: { sku: Sku; quantity: number }[]; address: Address }) => Promise<void>;
export type SubmitShipment = (i: { shipmentId: ShipmentId }) => Promise<Result<void, { kind: "warehouseUnavailable" }>>;
export type ResumeShipments = (i: { sku: Sku }) => Promise<void>;
export type RecordShipmentReport = (i: { reference: ShipmentId; trackingNumber: string; shippedAt: Date })
  => Promise<Result<void, { kind: "shipmentNotFound" }>>;
export type SyncStockLevels = () => Promise<Result<{ updated: number }, { kind: "warehouseUnavailable" }>>;
export type ReconcileShipments = () => Promise<{ repaired: number }>;
export type GetStock = (i: { sku: Sku }) => Promise<{ sku: Sku; onHand: number; reserved: number; available: number } | null>;
export type ListShipments = (i: { status?: ShipmentStatus; after?: ShipmentId; limit: number }) => Promise<ShipmentSummary[]>;
```

Driven ports:

```ts
export type FulfilmentTx = { stock: StockItemRepository; reservations: ReservationRepository;
  articles: ArticleRepository; shipments: ShipmentRepository; outbox: FulfilmentOutbox };
export interface StockItemRepository { lockMany(skus: Sku[]): Promise<StockItem[]>; save(s: StockItem): Promise<void> } // FOR UPDATE, sku order
export interface ReservationRepository { load(id: ReservationId): Promise<Reservation | null>; tentativeOlderThan(t: Date): Promise<Reservation[]>; save(r: Reservation): Promise<void> }
export interface Warehouse {
  upsertArticle(a: { sku: Sku; description: string }): Promise<Result<void, { kind: "rejected"; reason: string } | { kind: "unavailable" }>>;
  submitOrder(s: { reference: ShipmentId; lines: { sku: Sku; quantity: number }[]; address: Address })
    : Promise<Result<void, { kind: "unknownArticle"; skus: Sku[] } | { kind: "unavailable" }>>;
  findOrder(reference: ShipmentId)
    : Promise<Result<{ status: "open" | "shipped"; trackingNumber?: string; shippedAt?: Date } | null, { kind: "unavailable" }>>;
  stockLevels(): AsyncIterable<{ sku: Sku; onHand: number }>;
}
export interface OrderLookup { statusOf(orderId: string): Promise<Result<"placed" | "cancelled" | "unknown", { kind: "unavailable" }>> }
export interface FulfilmentOutbox { add(m: FulfilmentMessage): void } // ShipmentDispatched | ArticleDue | ArticleRegistered | ShipmentDue
// plus ArticleRepository, ShipmentRepository, Clock, ids, UnitOfWork<FulfilmentTx>
```

Driven adapters: Drizzle repositories, outbox, unit of work, `warehouse-api.ts` (3PL REST;
`PUT /articles/{sku}`, `POST /orders` with `externalReference`, `GET /orders?externalReference=`,
`GET /stock`), `in-process-order-lookup.ts` (calls `ordering`'s `GetOrderStatusV1`, translates).
Fakes for each.

Driving adapters: `http/fulfilment-routes.ts` (`GET /fulfilment/shipments`); hooks
`hooks/stock-for-cms.ts` (`GET /fulfilment/stock/:sku`, called by the Payload admin stock field) and
`hooks/warehouse-hook.ts` (`POST /hooks/warehouse`); handlers `on-product-changed.ts`,
`on-order-placed.ts`, `on-order-cancelled.ts`, `on-order-ready-to-ship.ts`, `on-article-due.ts`,
`on-article-registered.ts`, `on-shipment-due.ts` (last three private); scheduled tasks
`reconcile-tentative-reservations.ts` (every 5 minutes), `sync-stock-levels.ts` (every 15 minutes),
`reconcile-shipments.ts` (hourly); in-process open host service `reserve-stock.ts`.

### `catalog` (external)

Payload configuration in `systems/catalog/payload`: collection `products` (`title`, `description`
richText, `images` upload to `media`, `slug` unique, `sku` text `unique: true`, `priceCents`
number with `validate: (v) => (Number.isInteger(v) && v > 0) || "Price must be above zero"`,
`taxClass` select `tea | accessories`, ui field `stock` rendered by server component
`StockField`), collection `catalog-outbox` (hidden, access only for API key user `relay`), collection
`media`. Products `afterChange` hook: `req.payload.create({ collection: "catalog-outbox", data:
{ type: "ProductChanged", version: 1, payload }, req })` (same transaction as the product save), then
`revalidateTag("products")`. Published language in `@teashop/catalog-offer`:
`ProductChangedV1 = z.object({ productId, sku, title, slug, priceCents, taxClass, updatedAt })` and
`ProductDocV1` (REST shape read by `payload-catalog-source.ts`).

## Calls and messages

Synchronous calls between systems (all in-process inside `api`):

| Caller use case | Callee | Through | Refusal comes back as |
|---|---|---|---|
| `ordering` `Checkout` | `fulfilment` `ReserveStockV1` (tentative operation, reservation id = order id) | `StockReservations` adapter | `Result` `{ kind: "insufficientStock" }` translated to `outOfStock`; a thrown error translated to `stockUnavailable`; HTTP 409 / 503 |
| `ordering` `Checkout`, `ResumeCardPayment` | `payments` `StartCardPaymentV1` (which calls Stripe `paymentIntents.create`, idempotency key `pi:<orderId>`) | `CardPayments` adapter | `processorUnavailable` translated to `paymentUnavailable` with the order id; HTTP 503 `{ error: { kind, orderId } }`, browser retries `POST /ordering/orders/:id/card-payment` |
| `fulfilment` `ReconcileTentativeReservations` | `ordering` `GetOrderStatusV1` | `OrderLookup` adapter | thrown error translated to `unavailable`; reservation left for next run |

Synchronous calls to external systems: `payments` to Stripe (create, cancel, refund, retrieve);
`fulfilment` to 3PL (upsert article, submit order, find order, stock); `billing` to bank
(transactions); `ordering` and `billing` to Resend; `ordering` `ReconcileCatalog` to Payload REST.
Every one returns `Result` with `unavailable` for timeouts and 5xx; handlers throw on `unavailable`
so the bus redelivers, scheduled tasks log and wait for their next run.

Hooks (external systems calling in): Stripe to `POST /hooks/stripe`; 3PL to `POST /hooks/warehouse`;
Payload admin stock field to `GET /fulfilment/stock/:sku`. A hook settles by answering 2xx after the
use case committed, 4xx for a bad signature or unknown reference (Stripe and 3PL stop retrying), 5xx
on any thrown error (they retry).

UI callers (not systems): storefront and ops views in `web` call `api` over HTTP with
`x-request-id` and `traceparent`.

Messages. All asynchronous: written to the writer's outbox in the use case's transaction, moved by
the relay to pg-boss, delivered to one pg-boss queue per handler. Topic `<system>.<Type>.v<n>`.

| Message | Kind | Visibility | Publisher | Subscribers (handler, use case) |
|---|---|---|---|---|
| `catalog.ProductChanged.v1` | event | published | `catalog` (Payload `afterChange`) | `ordering` `on-product-changed` (`RefreshCatalogItem`); `fulfilment` `on-product-changed` (`RecordProductChanged`) |
| `ordering.OrderPlaced.v1` | event | published | `ordering` `Checkout` | `fulfilment` (`HoldReservation`); `billing` (`RecordOrderPlaced`) |
| `ordering.OrderReadyToShip.v1` | event | published | `ordering` `Checkout` (invoice), `RecordCardPaymentSucceeded` (card) | `fulfilment` (`CreateShipment`) |
| `ordering.OrderCancelled.v1` | event | published | `ordering` `CancelOverdueOrders` | `fulfilment` (`ReleaseReservation`); `payments` (`CancelCardPayment`); `billing` (`RecordOrderCancelled`) |
| `payments.RefundPayment.v1` | command | published (offered by `payments`) | `ordering` `RecordCardPaymentSucceeded` on a cancelled order | `payments` `on-refund-payment` (`RequestRefund`) |
| `ordering.ConfirmationDue.v1` | command | private | `ordering` `Checkout` | `ordering` (`SendOrderConfirmation`) |
| `payments.PaymentSucceeded.v1` | event | published | `payments` `RecordIntentSucceeded` | `ordering` (`RecordCardPaymentSucceeded`); `billing` (`RecordCardPayment`) |
| `payments.PaymentRefunded.v1` | event | published | `payments` `RecordRefundSettled` | `billing` (`RecordRefund`) |
| `payments.RefundRefused.v1` | event | published | `payments` `RequestRefund` (when it refuses a `RefundPayment` command) and `ExecuteRefund` (Stripe says disputed) | `ordering` (`RecordRefundRefused`) |
| `payments.RefundDue.v1` | command | private | `payments` `RequestRefund` | `payments` (`ExecuteRefund`) |
| `billing.InvoicePaid.v1` | event | published | `billing` `ImportBankTransfers`, `AssignTransfer` | `ordering` (`RecordInvoicePaid`) |
| `billing.DebtorStandingChanged.v1` | event | published | `billing` `RunDunning`, and any use case that clears overdue invoices | `ordering` (`RefreshCustomerStanding`) |
| `billing.DocumentIssued.v1` | command | private | `billing` (invoice or credit note issued) | `billing` (`MailDocument`) |
| `billing.ReminderDue.v1` | command | private | `billing` `RunDunning` | `billing` (`SendDunningReminder`) |
| `fulfilment.ShipmentDispatched.v1` | event | published | `fulfilment` `RecordShipmentReport`, `ReconcileShipments` | `billing` (`RecordShipment`) |
| `fulfilment.ArticleDue.v1` | command | private | `fulfilment` `RecordProductChanged` | `fulfilment` (`RegisterArticle`) |
| `fulfilment.ArticleRegistered.v1` | event | private | `fulfilment` `RegisterArticle` | `fulfilment` (`ResumeShipments`) |
| `fulfilment.ShipmentDue.v1` | command | private | `fulfilment` `CreateShipment`, `ResumeShipments` | `fulfilment` (`SubmitShipment`) |

Refusals of commands: `RefundPayment` refused by `payments` comes back as the event
`payments.RefundRefused.v1` carrying the command's message id; the handler settles the command
either way. Private commands are not refused by business rules; when the external call is
`unavailable` the handler throws and pg-boss redelivers (retry limit 12, exponential backoff, then the
`dead-letters` queue). Events are never refused: a handler whose use case finds nothing to do
settles.

Choreography throughout; no process manager.

## Processes

| Deployable | Entry | Runs | Replicas |
|---|---|---|---|
| `web` | `apps/web`: `next start` (Next.js 15 with Payload 3), `instrumentation.ts` registers OTel | Payload admin and REST API (`catalog`), storefront pages, ops views in the Payload admin, `StockField` | 2 |
| `api` | `node --import ./dist/instrumentation.js ./dist/main.js` | Fastify: every system's HTTP driving adapters and hooks, in-process open host services, `/health`, `/metrics` | 2 |
| `worker` | `node --import ./dist/instrumentation.js ./dist/main.js` | relay over five outbox readers, pg-boss consumers for every handler, pg-boss schedules for every scheduled task, `/health` and `/metrics` on port 9464 | 2 |
| `migrate` | one-shot job, run before each rollout: `pnpm --filter @teashop/web payload migrate && node apps/migrate/dist/main.js` | Payload migrations; drizzle-orm `migrate()` per system with that system's owner role; `PgBoss.start()` with `migrate: true` | 1, exits |

Assembly. `apps/api/src/assembly.ts` and `apps/worker/src/assembly.ts` are the only places where
port and implementation meet. Each system provides system builders in `core/src/build`; a builder
takes the system's config object and returns its driving port implementations, constructing its
own driven adapters, pool and defaults inside. Order in `api`:

```ts
export function assemble(c: ApiConfig): ApiServices {
  const orderingQueries = buildOrderingQueries(c.ordering);                // GetOrderStatusV1, ListOrders, ViewCart
  const payments = buildPayments(c.payments);                              // StartCardPaymentV1, RequestRefund, hooks' ports
  const fulfilment = buildFulfilment(c.fulfilment, { getOrderStatus: orderingQueries.getOrderStatusV1 });
  const ordering = buildOrderingCommands(c.ordering, {
    reserveStock: fulfilment.reserveStockV1, startCardPayment: payments.startCardPaymentV1 });
  const billing = buildBilling(c.billing);
  return { ordering: { ...orderingQueries, ...ordering }, payments, fulfilment, billing };
}
```

`apps/api/src/main.ts` creates the Fastify instance, registers `requestContext` and probes, and
registers each system's route and hook plugins with that system's ports. `apps/worker/src/main.ts`
builds the same services, then `buildOrderingHandlers(services.ordering)` etc. return
`MessageHandler[]` and `ScheduledTask[]`, which assembly hands to the bus; the outbox readers
(`ordering.outboxReader` etc.; for `catalog`, assembly's own `PayloadOutboxReader` over Payload REST
with the `relay` API key) go to the relay.

Relay (`@teashop/messaging/relay.ts`): per reader, loop `drain(100, deliver)` every 250 ms, backing
off to 2 s when empty. Our readers run `BEGIN; SELECT ... WHERE delivered_at IS NULL ORDER BY seq
LIMIT 100 FOR UPDATE SKIP LOCKED; deliver each; UPDATE delivered_at; COMMIT` on the system's own pool.
The Payload reader lists `catalog-outbox?where[deliveredAt][exists]=false`, delivers, then `PATCH`es
`deliveredAt`. `deliver` is `boss.publish(topic, envelope)`. Bus (`@teashop/messaging/bus.ts`):
`createQueue(handler.queue, { retryLimit: 12, retryBackoff: true, expireInSeconds: 300, deadLetter:
"dead-letters" })`, `subscribe(topic, queue)` per topic, `work(queue, { batchSize: 1 })`, which
restores trace context and request id from `headers` and calls `handler.handle`; resolve completes
the job (settle).

Ambient values: per process, the config and logger; per request, `requestContext`
(`AsyncLocalStorage<{ requestId: string }>`) set by the Fastify `onRequest` hook (`x-request-id` or
new uuid) and by the bus worker from envelope headers. The pino `mixin` reads it and the active OTel
span; the outbox writer copies `requestId`, `traceparent` and `tracestate` into `headers`.

Courier: only in `web`. Next.js pages and Payload components cannot take arguments from assembly, so
`apps/web/src/assembly/courier.ts` exports `webServices()`, memoised on `globalThis`, returning the
`api` HTTP client built by `apps/web/src/assembly/assembly.ts`.

Database layout: `infra/postgres/001-roles-and-schemas.sql` creates per system an owner role
(`ordering_owner`, DDL, used only by `migrate`) and an app role (`ordering_app`, DML on its schema
only, `search_path=ordering`), likewise `payload_owner/payload_app`, `pgboss_app`, and `probe`
(login, no grants). Each process opens one pool per system role it uses.

Migrations: drizzle-kit per system (`systems/<s>/core/drizzle.config.ts`, `schemaFilter: [s]`,
`migrations: { schema: s, table: "__migrations" }`), output `systems/<s>/core/migrations`. Expand and
contract: a migration file may drop, rename or retype only when named `*_contract.sql`, which
`tooling/check-migrations.ts` allows only for objects the previous release's code no longer reads (it
checks the tag of the previous release with a grep over the Drizzle schema). Payload migrations are
generated with `payload migrate:create`.

Probes: `/health` runs `SELECT 1` on the `probe` pool, 200 or 503. `/metrics` serves the prom-client
registry: default Node metrics, HTTP duration histogram, `outbox_oldest_undelivered_seconds` per
source, `bus_queue_depth` per queue, `bus_dead_letters`.

Observability: OTel `NodeSDK` with `getNodeAutoInstrumentations()` (http, undici, fastify, pg, pino)
and OTLP HTTP exporter to `http://jaeger:4318`; W3C propagation over HTTP; messages carry
`traceparent` in envelope headers and consumers start a span linked to it.

## Directory tree

```
teashop/
├── package.json
├── pnpm-workspace.yaml                      # apps/*, packages/*, systems/*/*
├── tsconfig.base.json
├── biome.json                               # override for systems/*/core/src/domain/**: noRestrictedGlobals Date, process, crypto, Buffer, fetch, setTimeout
├── .dependency-cruiser.cjs
├── vitest.workspace.ts                      # projects: default (excludes *.integration.test.ts, *.e2e.test.ts), integration, e2e
├── docker-compose.yml                       # postgres:17, jaegertracing/all-in-one, for local and integration tests
├── infra/
│   └── postgres/
│       └── 001-roles-and-schemas.sql
├── tooling/
│   ├── check-migrations.ts
│   └── check-published-language.ts          # JSON Schema of every offer schema vs committed snapshots
├── packages/
│   ├── kernel/                              # @teashop/kernel, shared kernel
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── money.ts
│   │   └── test/
│   │       └── money.test.ts
│   ├── common/                              # @teashop/common, common library
│   │   ├── package.json                     # exports: ./result ./message ./outbox ./persistence ./context ./observability ./testing
│   │   ├── src/
│   │   │   ├── result.ts
│   │   │   ├── message/envelope.ts
│   │   │   ├── message/message-handler.ts
│   │   │   ├── message/scheduled-task.ts
│   │   │   ├── outbox/outbox-table.ts       # outboxTable(pgSchema) -> drizzle table
│   │   │   ├── outbox/outbox-reader.ts      # OutboxReader + drizzleOutboxReader(db, table, source)
│   │   │   ├── outbox/outbox-writer.ts      # writes envelopes in the given tx, copies headers from context
│   │   │   ├── persistence/unit-of-work.ts  # drizzleUnitOfWork(db, makeTx)
│   │   │   ├── persistence/concurrency-conflict.ts
│   │   │   ├── persistence/retry-on-conflict.ts
│   │   │   ├── context/request-context.ts
│   │   │   ├── observability/logger.ts
│   │   │   ├── observability/tracer.ts
│   │   │   ├── time/clock.ts                # Clock type and systemClock
│   │   │   └── testing/
│   │   │       ├── fake-clock.ts
│   │   │       ├── sequential-ids.ts
│   │   │       └── in-memory-outbox.ts
│   │   └── test/
│   │       ├── outbox/outbox-reader.integration.test.ts
│   │       └── persistence/retry-on-conflict.test.ts
│   └── messaging/                           # @teashop/messaging, no system; apps only
│       ├── package.json
│       ├── src/
│       │   ├── relay.ts
│       │   ├── bus.ts
│       │   └── schedules.ts
│       └── test/
│           ├── relay.test.ts
│           └── bus.integration.test.ts
├── systems/
│   ├── catalog/
│   │   ├── offer/                           # @teashop/catalog-offer
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── product-changed.v1.ts
│   │   │       └── product-doc.v1.ts
│   │   └── payload/                         # @teashop/catalog-payload, configuration of the external system
│   │       ├── package.json
│   │       ├── glossary.md
│   │       ├── src/
│   │       │   ├── payload.config.ts        # postgresAdapter({ schemaName: "payload" })
│   │       │   ├── collections/products.ts
│   │       │   ├── collections/catalog-outbox.ts
│   │       │   ├── collections/media.ts
│   │       │   ├── collections/users.ts
│   │       │   ├── hooks/write-product-changed.ts
│   │       │   └── migrations/
│   │       └── test/
│   │           └── collections/products.integration.test.ts
│   ├── ordering/
│   │   ├── offer/                           # @teashop/ordering-offer
│   │   │   ├── package.json
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── events/order-placed.v1.ts
│   │   │   │   ├── events/order-ready-to-ship.v1.ts
│   │   │   │   ├── events/order-cancelled.v1.ts
│   │   │   │   ├── ports/get-order-status.v1.ts
│   │   │   │   └── testing/fake-get-order-status.ts
│   │   │   └── test/
│   │   │       └── events/order-placed.v1.test.ts
│   │   └── core/                            # @teashop/ordering; exports ./build only
│   │       ├── package.json
│   │       ├── glossary.md
│   │       ├── CLAUDE.md                    # points agents at glossary.md and the layer rules
│   │       ├── drizzle.config.ts
│   │       ├── migrations/
│   │       │   └── 0000_init.sql
│   │       ├── src/
│   │       │   ├── domain/
│   │       │   │   ├── ids.ts
│   │       │   │   ├── cart.ts
│   │       │   │   ├── order.ts
│   │       │   │   ├── order-line.ts
│   │       │   │   ├── customer.ts
│   │       │   │   ├── catalog-item.ts
│   │       │   │   ├── customer-standing.ts
│   │       │   │   ├── may-pay-by-invoice.ts
│   │       │   │   ├── payment-deadline.ts
│   │       │   │   └── order-id-for.ts
│   │       │   ├── service/
│   │       │   │   ├── ports/driving.ts
│   │       │   │   ├── ports/driven.ts
│   │       │   │   ├── messages.ts          # OrderingMessage, in ordering's terms
│   │       │   │   └── use-cases/
│   │       │   │       ├── add-to-cart.ts
│   │       │   │       ├── change-cart-line.ts
│   │       │   │       ├── view-cart.ts
│   │       │   │       ├── checkout.ts
│   │       │   │       ├── resume-card-payment.ts
│   │       │   │       ├── cancel-overdue-orders.ts
│   │       │   │       ├── record-card-payment-succeeded.ts
│   │       │   │       ├── record-invoice-paid.ts
│   │       │   │       ├── record-refund-refused.ts
│   │       │   │       ├── send-order-confirmation.ts
│   │       │   │       ├── refresh-catalog-item.ts
│   │       │   │       ├── refresh-customer-standing.ts
│   │       │   │       ├── reconcile-catalog.ts
│   │       │   │       ├── get-order-status.ts
│   │       │   │       └── list-orders.ts
│   │       │   ├── adapters/
│   │       │   │   ├── driven/
│   │       │   │   │   ├── drizzle/schema.ts
│   │       │   │   │   ├── drizzle/cart-repository.ts
│   │       │   │   │   ├── drizzle/order-repository.ts
│   │       │   │   │   ├── drizzle/customer-repository.ts
│   │       │   │   │   ├── drizzle/catalog-item-replica.ts
│   │       │   │   │   ├── drizzle/customer-standing-replica.ts
│   │       │   │   │   ├── drizzle/order-confirmation-repository.ts
│   │       │   │   │   ├── drizzle/ordering-outbox.ts
│   │       │   │   │   ├── drizzle/unit-of-work.ts
│   │       │   │   │   ├── in-process-stock-reservations.ts
│   │       │   │   │   ├── in-process-card-payments.ts
│   │       │   │   │   ├── payload-catalog-source.ts
│   │       │   │   │   ├── resend-mail-sender.ts
│   │       │   │   │   └── uuid-ids.ts
│   │       │   │   ├── fake/
│   │       │   │   │   ├── in-memory-ordering-store.ts
│   │       │   │   │   ├── fake-stock-reservations.ts
│   │       │   │   │   ├── fake-card-payments.ts
│   │       │   │   │   ├── fake-catalog-source.ts
│   │       │   │   │   └── recording-mail-sender.ts
│   │       │   │   └── driving/
│   │       │   │       ├── http/ordering-routes.ts
│   │       │   │       ├── http/error-status.ts
│   │       │   │       ├── handlers/on-product-changed.ts
│   │       │   │       ├── handlers/on-debtor-standing-changed.ts
│   │       │   │       ├── handlers/on-payment-succeeded.ts
│   │       │   │       ├── handlers/on-invoice-paid.ts
│   │       │   │       ├── handlers/on-refund-refused.ts
│   │       │   │       ├── handlers/on-confirmation-due.ts
│   │       │   │       ├── scheduled/cancel-overdue-orders.ts
│   │       │   │       ├── scheduled/reconcile-catalog.ts
│   │       │   │       └── open-host/get-order-status.v1.ts
│   │       │   └── build/
│   │       │       ├── index.ts
│   │       │       ├── config.ts            # OrderingConfig + defaults (deadline 30 min, retry 3)
│   │       │       ├── build-ordering-queries.ts
│   │       │       ├── build-ordering-commands.ts
│   │       │       ├── build-ordering-drivers.ts   # handlers, scheduled tasks, routes, outbox reader
│   │       │       └── build-ordering-for-test.ts  # every driven port faked
│   │       └── test/
│   │           ├── domain/order.test.ts
│   │           ├── domain/may-pay-by-invoice.test.ts
│   │           ├── service/use-cases/checkout.test.ts
│   │           ├── service/use-cases/record-card-payment-succeeded.test.ts
│   │           ├── service/use-cases/cancel-overdue-orders.test.ts
│   │           ├── adapters/driven/contract/order-repository.contract.ts
│   │           ├── adapters/driven/drizzle/order-repository.integration.test.ts
│   │           ├── adapters/fake/in-memory-ordering-store.test.ts
│   │           ├── adapters/driven/payload-catalog-source.e2e.test.ts
│   │           └── adapters/driving/http/ordering-routes.test.ts
│   ├── payments/
│   │   ├── offer/                           # StartCardPaymentV1, RefundPaymentV1, PaymentSucceededV1, PaymentRefundedV1, RefundRefusedV1, fakes
│   │   └── core/                            # same layout; domain/payment.ts, domain/refund.ts;
│   │                                        # adapters/driven/stripe-card-processor.ts; adapters/driving/hooks/stripe-hook.ts;
│   │                                        # build/build-payments.ts, build-payments-drivers.ts, build-payments-for-test.ts
│   ├── billing/
│   │   ├── offer/                           # InvoicePaidV1, DebtorStandingChangedV1
│   │   └── core/                            # domain/billable-order.ts, invoice.ts, credit-note.ts, vat.ts, invoice-number.ts,
│   │                                        # incoming-transfer.ts, transfer-matching.ts, debtor.ts, dunning-policy.ts;
│   │                                        # adapters/driven/drizzle/number-series.ts, bank-api-account.ts, pdfkit-document-renderer.ts,
│   │                                        # resend-mail-sender.ts; build/build-billing.ts, build-billing-drivers.ts, build-billing-for-test.ts
│   └── fulfilment/
│       ├── offer/                           # ReserveStockV1, ShipmentDispatchedV1, fakes
│       └── core/                            # domain/stock-item.ts, reservation.ts, article.ts, shipment.ts;
│                                            # adapters/driven/warehouse-api.ts, in-process-order-lookup.ts;
│                                            # adapters/driving/hooks/warehouse-hook.ts, hooks/stock-for-cms.ts;
│                                            # build/build-fulfilment.ts, build-fulfilment-drivers.ts, build-fulfilment-for-test.ts
└── apps/
    ├── api/
    │   ├── package.json
    │   ├── Dockerfile
    │   ├── src/
    │   │   ├── instrumentation.ts
    │   │   ├── config.ts                    # zod over process.env -> ApiConfig
    │   │   ├── assembly.ts
    │   │   ├── server.ts                    # Fastify instance, request context, error logging
    │   │   ├── probes/health.ts
    │   │   ├── probes/metrics.ts
    │   │   └── main.ts
    │   └── test/
    │       └── assembly.integration.test.ts
    ├── worker/
    │   ├── package.json
    │   ├── Dockerfile
    │   ├── src/
    │   │   ├── instrumentation.ts
    │   │   ├── config.ts
    │   │   ├── assembly.ts
    │   │   ├── outbox/payload-outbox-reader.ts
    │   │   ├── probes/health.ts
    │   │   ├── probes/metrics.ts
    │   │   └── main.ts
    │   └── test/
    │       └── outbox/payload-outbox-reader.integration.test.ts
    ├── migrate/
    │   ├── package.json
    │   └── src/main.ts
    └── web/
        ├── package.json
        ├── next.config.ts                   # withPayload
        ├── instrumentation.ts
        └── src/
            ├── assembly/assembly.ts
            ├── assembly/courier.ts
            ├── api-client/api-client.ts
            ├── cms/stock-field.tsx          # server component, GET /fulfilment/stock/:sku
            ├── cms/ops-views/orders.tsx
            ├── cms/ops-views/invoices.tsx
            ├── cms/ops-views/shipments.tsx
            └── app/
                ├── (payload)/admin/[[...segments]]/page.tsx
                ├── (payload)/api/[...slug]/route.ts
                ├── (shop)/page.tsx          # unstable_cache tag "products"
                ├── (shop)/products/[slug]/page.tsx
                ├── (shop)/cart/page.tsx
                ├── (shop)/checkout/page.tsx
                ├── health/route.ts
                └── metrics/route.ts
```

dependency-cruiser rules (`.dependency-cruiser.cjs`), all `error`:
- `systems/*/core/src/domain/**` may import only `domain/**` of the same system, `@teashop/kernel`,
  `@teashop/common/result`.
- `systems/*/core/src/service/**` may import only its own `domain/**`, `service/**`,
  `@teashop/kernel`, `@teashop/common/{result,time,observability}`.
- `@teashop/*-offer` packages of other systems may be imported only from `src/adapters/**` and
  `src/build/**`.
- No package may import another system's `core`. Only `apps/**` may import `*/core/build`.
- `drizzle-orm`, `pg`, `stripe`, `resend`, `payload`, `pg-boss`, `fastify`, `node:*` only from
  `src/adapters/**`, `src/build/**`, `packages/common/src/{outbox,persistence,context,observability}`,
  `packages/messaging`, `apps/**`.

## How each property holds

**P1.** Each system's domain is plain TypeScript in `core/src/domain`, written from the business
rules in the brief and named from the system's `glossary.md`. dependency-cruiser stops it importing
Drizzle, Stripe, Payload, pg-boss, Fastify or another system's offer; aggregates expose `rehydrate`
and `snapshot` so repositories map rows to them in the adapter, and nothing about table shape, Stripe
objects or 3PL fields reaches the domain. No relation is conformist, so the Except does not arise.
For `catalog` the model is Payload's collection configuration, shaped by Payload; it is an external
system (F9), and the property is claimed for the four systems we write.

**P2.** Every rule sits in one domain module: payment deadline in `ordering/domain/payment-deadline.ts`,
invoice offering in `ordering/domain/may-pay-by-invoice.ts`, line snapshot in `order-line.ts`, refund
of disputed charges in `payments/domain/payment.ts`, VAT in `billing/domain/vat.ts`, matching in
`transfer-matching.ts`, dunning in `dunning-policy.ts`, number format and "issuing consumes the next
number" in `invoice-number.ts` and `invoice.ts`, stock in `fulfilment/domain/stock-item.ts`,
article-before-shipment in `shipment.ts`. Price above zero and sku unique live in the Payload
products collection, which is `catalog`'s rule set (see S1); `ordering` does not re-check them. Use
cases only load, call one domain method, save and add outbox messages; review rule plus the
dependency-cruiser rule that services import nothing that could hold a rule's data. One part does not
fully hold: that numbers are gapless is kept by `drizzle/number-series.ts` (counter row in the issuing
transaction), so the gaplessness guarantee rests on that adapter and its integration test, not on the
domain.

**P3.** Rules are cut by system and by reason to change: tax law (`vat.ts`), credit policy
(`dunning-policy.ts`), offering policy (`may-pay-by-invoice.ts`, which reads only `inDunning`;
what counts as in dunning is `billing`'s rule), payment terms (`payment-deadline.ts`), refund policy
(`payment.ts`), warehouse requirements (`shipment.ts`, `article.ts`). Each is one module with one
test file; the files that change together (dunning stages and reminder mail stage texts) sit in
`billing` together.

**P4.** Each use case is built once per process by the system builder and every driving adapter
calls that same function; no driving port takes a caller kind, except `RequestRefund.reason`, which is
recorded, never branched on. Driving adapters only translate. Each driven port has a contract suite
(`test/adapters/driven/contract/*.contract.ts`) run against the fake in the default suite and against
the real adapter in integration tests, so swapping an implementation keeps the use case's answers.

**P5.** Services are factories taking their driven ports as arguments; builders construct the
adapters, and assembly calls builders, so the only way out is a port handed in. dependency-cruiser
forbids domain and service from importing I/O libraries, `node:*`, adapters or other systems. Every
port type is in the system's terms; other systems' published language appears only in adapters, which
translate. Time and ids are ports (`Clock`, `*Ids`) because they change answers. The Except covers the
pino logger, OTel tracer and `requestContext` from `@teashop/common`, used directly by services and
adapters; their output goes to stdout and Jaeger and never back into a use case.

**P6.** Every system has `build<System>ForTest()` returning all its driving ports over fakes:
in-memory store (repositories, replicas, outbox, unit of work with copy-on-commit), fake clock,
sequential ids, fake external adapters, and the fakes of other systems' open host service from their
offer packages. Every use case has tests in the default suite through these builders; vitest's default
project excludes `*.integration.test.ts` and `*.e2e.test.ts`.

**P7.** Each use case calls `uow.run` once; inside, repositories and the outbox port share one Drizzle
transaction on the system's own pool, so its records and outgoing messages commit together or roll
back together. Use cases with an external call make it before the transaction (Stripe
`createIntent` with idempotency key `pi:<orderId>`, then one commit storing the payment) or from a
handler after an earlier commit (`ExecuteRefund`, `SubmitShipment`, `RegisterArticle`, mails), never
between two commits. `Checkout` calls `ReserveStock` (another system's records, a tentative
operation) before its single commit, and `StartCardPayment` after it.

**P8.** Outgoing messages are outbox rows in the same transaction; the relay sees only committed
rows; HTTP responses are sent after the commit; handlers and hooks settle only after commit;
external effects (mail, Stripe refund, 3PL submit, article upsert) happen only in handlers of
committed private commands, so a rolled-back use case triggers none of them and a committed one
cannot lose them. The only call made before commit is the stock reservation, which is tentative and
released by `ReconcileTentativeReservations` when no order committed.

**P9.** Repeats are no-ops by state, not by an inbox table, so a repeat writes no record:
`OrderPlaced` holds a reservation already `held`; `PaymentSucceeded` on a paid order does nothing and
returns ok; `RecordOrderPlaced` on an existing `BillableOrder` does nothing; invoices are unique per
order id, credit notes per refund id; incoming transfers insert `ON CONFLICT (bank_tx_id) DO
NOTHING`; shipments are unique per order id; replicas keep the higher version. A repeat answers as
the first: the same `Result`. External effects carry keys: Stripe `Idempotency-Key`, Resend
`Idempotency-Key` (`<messageId>`), 3PL `findOrder(reference)` before `submitOrder`, article `PUT`.
A redelivery while the first still runs meets a version conflict or a row lock, retries, and then
sees the first's result. Hooks repeat the same way (Stripe and 3PL events map to the same state
transitions). Does not fully hold for mails: if a process stops after Resend accepted but before
`markSent` committed and the redelivery comes after Resend's 24-hour key window (only possible by
replaying a dead letter), the mail goes twice.

**P10.** Aggregates carry `version`; repositories `UPDATE ... WHERE id = $1 AND version = $2` and throw
`ConcurrencyConflict` on zero rows; `retryOnConflict` reruns the whole use case up to 3 times with
fresh reads, so a commit always rests on reads still current. Conflicts between use cases no rule
ties are absorbed by the retry, and concerns that would collide on one row without a rule tying them
sit in separate tables (`order_confirmations` apart from `orders`). Where a rule ties them the loser
gets a refusal: two checkouts on the last unit (row locks on `stock_items`, second gets
`insufficientStock`), refund versus dispute (second sees `disputed`), auto-match versus manual
assignment of one transfer (`alreadyMatched`). Gapless numbers serialize on the counter row, which
waits, not fails. Stale reads accepted by a rule: `ordering` checks out on its replicas of price and
dunning standing; the rule "an order takes the price and standing `ordering` knew at checkout" is in
`ordering/glossary.md` and in `checkout.ts`'s domain call.

**P11.** Each system's schema is reachable only by its own Postgres role; no role holds grants on
another schema, so another system cannot read or write it even by mistake. Other systems see a
system's data only through its open host service ports, its published events and commands, or its
replicas built from those. `catalog`'s outbox and products are read over Payload's REST API with an
API key, never through SQL. The relay reads each outbox through the reader its owner system provides,
on the owner's pool.

**P12.** Other systems' published language is imported only in adapters and builders
(dependency-cruiser), and each such adapter translates into the system's own types; Stripe, 3PL, bank,
Resend and Payload types never leave `src/adapters`. The shared kernel `Money` is the one model shared
by choice, recorded in each system's glossary.

**P13.** A system's published language lives in its offer package, separate from its domain; the
outbox adapter maps internal messages to published payloads, so a model change touches that mapping
only. A breaking change adds `v2` beside `v1`: the outbox adapter writes one row per live version
(same message id, topic per version), the open host service keeps `startCardPaymentV1` as a thin
function over the new internal port, and `v1` goes only after `tooling/check-published-language.ts`
and a grep show no subscriber. That tool fails CI when a committed `v1` JSON Schema snapshot changes.

**P14.** Records: expand and contract migrations only, enforced by `tooling/check-migrations.ts`; a
column never changes meaning, a new meaning gets a new column; `migrate` runs before the rolling
deploy, so old and new code run against a schema both understand. jsonb columns carry
`schemaVersion` and repositories read every version still present. Messages: a published or private
schema is frozen once released (snapshot check); consumers subscribe to exact versions and parse with
that version's zod schema, so a message means the same to every reader, whenever it sat in the outbox
or queue.

**P15.** Only three use cases wait on another system: `Checkout` on `fulfilment` for the reservation
(rule: an order is placed only with its stock reserved), `Checkout` with card and
`ResumeCardPayment` on `payments` and Stripe (rule: a card order's checkout answer carries the
payment's client secret). Both callees are in-process; only Stripe is remote, and when it is down
invoice checkout still works and card checkout returns `paymentUnavailable` with a placed order that
can resume or lapse at its deadline. Product data and dunning standing are replicas, so `catalog` and
`billing` being down does not stop checkout. Everything else crosses by message and waits in the
outbox or queue.

**P16.** Each system has its own role and pool; a Postgres transaction runs on one connection with one
role, and no role can write another schema, so no transaction can carry two systems' writes. The
relay commits the outbox mark on the owner's pool and pg-boss's insert in its own; no two-phase commit
exists anywhere.

**P17.** Every cross-system sequence has an end state the rules allow and a mechanism that reaches
it: reservation without order is released by `ReconcileTentativeReservations`; unpaid card orders are
cancelled at the deadline, releasing stock and cancelling the intent; a payment after cancellation is
refunded, or recorded `needsAttention` when Stripe says disputed (allowed: disputed charges are not
refunded); shipments wait for article registration and end `blocked` when the 3PL rejects an article,
shown in ops; `ReconcileCardPayments` and `ReconcileShipments` repair lost webhooks; unpaid invoices
end at dunning stage 3. Retries are bounded by pg-boss (12, exponential). Does not fully hold: a
message whose handler fails permanently (a bug, a schema the consumer cannot parse) ends in
`dead-letters` and waits for a human to fix and replay it; `bus_dead_letters` alerts.

**P18.** Aggregates that receive messages accept them in any order and reach the same state:
`BillableOrder` collects `placed`, `paidByCard`, `shipped`, `cancelled` as facts and issues once the
set allows; `Reservation` released before held stays released; `Shipment` accepts `dispatched`
before `submitted` is recorded. `Order` receives only `PaymentSucceeded`, `InvoicePaid` and
`RefundRefused`, each touching its own flag, so their order does not matter; a payment arriving after
the deadline cancelled the order is a race with the clock, not with another message, and its outcome
(refund) is the same whichever handler runs first. Replicas carry the owner's version (`updatedAt` for
products, `standingVersion` for debtors) and ignore older ones.

**P19.** Each system has `glossary.md` at its root and a `CLAUDE.md` pointing agents at it, so a
partial reader meets the terms first. Terms whose meaning differs across systems get different names:
`Product` (`catalog`), `CatalogItem` (`ordering` replica), `Article` (`fulfilment`); `Customer`
(`ordering`), `Debtor` (`billing`); "paid" in `ordering` means settled by card or invoice payment,
never "released to ship" (`readyToShip`). Nothing mechanical checks a term's meaning; this rests on
the glossary and review.

## Decisions the document left to me

**D1. Cut into systems.** Chose `catalog` (external), `ordering`, `payments`, `billing`,
`fulfilment`. Also holding: `payments` folded into `ordering`; dunning as its own system apart from
invoicing; stock and shipping as two systems.

**D2. Role of Payload.** Chose Payload as the external system owning products, its configuration
holding price-above-zero and sku-unique. Also holding: our own `catalog` system with its domain and
Drizzle store, Payload as UI only, driven through a hook.

**D3. Processes.** Chose `web`, `api`, `worker`, `migrate`, all systems co-located in `api` and
`worker`. Also holding: one process per system, with HTTP between them.

**D4. Stores.** Chose one Postgres instance, one schema and app role per system, separate pools.
Also holding: one database per system on the instance; one role for all with discipline only (P11,
P16 would then rest on review).

**D5. Bus and relay.** Chose pg-boss pub/sub with a queue per handler, and a polling relay with `FOR
UPDATE SKIP LOCKED`. Also holding: a hand-written `deliveries` table; LISTEN/NOTIFY plus polling;
RabbitMQ.

**D6. How `catalog` tells us about products.** Chose a `catalog-outbox` Payload collection written in
the product's transaction, read by an assembly-provided outbox reader over Payload REST. Also holding:
Payload `afterChange` HTTP hook to our systems plus a reconciliation sweep.

**D7. Product data at checkout.** Chose a replica in `ordering` with lag accepted by rule. Also
holding: synchronous Payload call at checkout, with a declared rule needing it now.

**D8. Dunning check at checkout.** Chose a replica of `inDunning` in `ordering`, stale accepted. Also
holding: synchronous call to a `billing` open host service.

**D9. Stock reservation.** Chose a synchronous tentative operation at checkout, held on
`OrderPlaced`, released on `OrderCancelled`, orphans reconciled through `GetOrderStatusV1`. Also
holding: asynchronous reservation after placement with cancellation on shortfall; a TTL instead of
reconciliation.

**D10. When the card payment starts.** Chose after the order commits, with a resume endpoint. Also
holding: before the order (intent first, order on success).

**D11. Payment deadline.** Chose card orders only, 30 minutes after placement, swept every minute;
invoice orders are ready to ship at placement. Also holding: a delayed private message per order.

**D12. Invoice timing.** Chose: card orders on `PaymentSucceeded`; invoice orders at placement with
due date set at shipment plus 14 days. Also holding: invoice orders invoiced at shipment.

**D13. Number series.** Chose a counter row per series and year, `RE` for invoices, `GS` for credit
notes, format `RE-2026-000123`. Also holding: one series for both.

**D14. Prices.** Chose gross EUR integer cents in `catalog`; `billing` derives net and VAT per line,
half-up. Also holding: net prices.

**D15. Refunds.** Chose full refunds only, from ops or from `ordering`'s `RefundPayment` command.
Also holding: partial refunds by amount.

**D16. Bank.** Chose polling every 10 minutes with a cursor. Also holding: a bank hook.

**D17. Matching.** Chose: reference contains the invoice number and amount at most the open amount;
partial payments kept open; unmatched transfers assigned by hand. Also holding: fuzzy matching on
name and amount.

**D18. Dunning.** Chose stages 1, 2, 3 at 7, 21, 35 days overdue, one stage per daily run;
`billing` publishes `inDunning = stage >= 1`. Also holding: other thresholds; publishing the stage and
letting `ordering` decide (would move part of the rule).

**D19. Mail.** Chose Resend with idempotency keys, an adapter in each system that sends mail. Also
holding: a `notifications` system taking commands.

**D20. Idempotency.** Chose state-based no-ops, unique keys, external idempotency keys; no inbox
table. Also holding: none that writes an inbox row (see S3).

**D21. Concurrency.** Chose optimistic versions with whole-use-case retry, row locks for stock and
number series. Also holding: `SERIALIZABLE` transactions with retry.

**D22. Versioning.** Chose `type` plus `version` in the envelope, zod schemas in offer packages, one
outbox row per live version, JSON Schema snapshots in CI. Also holding: upcasting at consumers.

**D23. Package layout.** Chose per system an `offer` package and a `core` package, `core` exporting
only `./build`; three builders per system. Also holding: one package per system with `exports` for
`./offer` and `./build` (needs care with cyclic workspace deps between `ordering` and `fulfilment`).

**D24. Refusals.** Chose `Result` with a `kind` union on every port; HTTP status mapping in each
driving adapter. Also holding: typed error classes.

**D25. Boundary enforcement.** Chose dependency-cruiser plus Biome `noRestrictedGlobals` in domain
folders. Also holding: TypeScript project references per layer.

**D26. Observability.** Chose OTel NodeSDK with auto-instrumentation and OTLP to Jaeger, pino with
mixin, request id in `AsyncLocalStorage` and in envelope headers, prom-client. Also holding: OTel
metrics with the Prometheus exporter.

**D27. Courier.** Chose a `globalThis` memo in `web` only. Also holding: Next.js server-only module
singleton.

**D28. Customers.** Chose `ordering` owning `Customer`, keyed by email, guest checkout; `billing`'s
`Debtor` id is the customer id. Also holding: a separate identity system.

**D29. Shared kernel.** Chose `Money` only. Also holding: no shared kernel, each system its own money
type.

**D30. Upstream relations.** Chose anti-corruption layer everywhere. Also holding: conformist to
`catalog-offer`'s `ProductChangedV1` in `ordering`.

**D31. On-hand stock.** Chose a replica of the 3PL's counts, synced every 15 minutes and adjusted on
shipment reports. Also holding: asking the 3PL on each `GetStock`.

**D32. Article master.** Chose registration on every `ProductChanged`, shipments waiting for it.
Also holding: registration on first shipment.

**D33. Stock in the CMS and ops dashboard.** Chose Payload server components calling `api` over HTTP.
Also holding: a replica of stock written back into a Payload field.

**D34. Choreography or orchestration.** Chose choreography. Also holding: an `ordering` process
manager for checkout to shipment.

**D35. Libraries not named by the brief.** Chose Fastify, pg-boss, zod, vitest, testcontainers,
pdfkit, prom-client. Also holding: Hono, Graphile Worker, valibot.

## Sentences I had to pick a reading for

**S1.** P2: "A business rule lives in one place: the domain". Reading A: the domain of the system
owning the rule, which for an external system is its configuration. Reading B: our code's domain
layer only. I took A. Changed: price above zero and sku unique stay in Payload's collection config;
there is no `catalog` domain package. Under B I would have built our own `catalog` system (D2).

**S2.** Glossary, Outbox: "the system provides it, and for an external system's outbox, assembly
does." Reading A: an outbox we configure inside the external system. Reading B: something the
external system offers natively (a Stripe events list). I took A. Changed: the `catalog-outbox`
Payload collection and `apps/worker/src/outbox/payload-outbox-reader.ts`; Stripe stays on its hook.

**S3.** P9: "A repeated delivery changes no record of this system, and succeeds where the first
did". Reading A: no record at all, including bookkeeping (an inbox row or `lastSeenAt`). Reading B: no
business record; bookkeeping allowed. Also "succeeds where the first did": the repeat succeeds only
if the first did, or the repeat gives the same answer. I took A and "same answer". Changed: no inbox
table; idempotency by state (D20); refusals repeat as the same refusal.

**S4.** P10: "use cases fail each other only where a business rule ties them". Reading A: a
transient conflict that a retry absorbs is not a failure. Reading B: no conflict may occur at all.
I took A. Changed: `retryOnConflict` and splitting unrelated concerns into separate tables.

**S5.** P15: "unless a business rule needs another system's answer now". Reading A: product
requirements such as "the browser needs the `client_secret` in the checkout response" count as a
business rule. Reading B: only rules of the business domain count. I took A. Changed: synchronous
Stripe call in `Checkout`; under B card checkout would answer before the intent exists and the
browser would poll.

**S6.** P7: "A use case's writes to its own system's records land together or not at all". Reading
A: one transaction per use case. Reading B: each step's writes together, several steps allowed.
I took A. Changed: `StartCardPayment` calls Stripe before its single commit with a deterministic
idempotency key, instead of committing `intentRequested` first.

**S7.** P11: "or reads them except through its published language". Reading A: any read path
counts, including the relay reading an outbox and the replica refresh. Reading B: only other systems'
code. I took A for external systems too. Changed: Payload's outbox is read over REST, not SQL.

**S8.** Glossary, Store: "Two clients are one store when one transaction can carry the writes of
both". Reading A: capability of the server (one Postgres instance means one store). Reading B:
capability as configured (roles and pools). I took B and configured for it. Changed: per-system
roles and pools, which make P16 and P11 mechanical.

**S9.** Glossary, Pure: "it loads on every runtime". Reading A: every JavaScript runtime (browser,
edge, Deno). Reading B: every runtime this codebase deploys to. I took A. Changed: domain bans
`node:*`, `Buffer`, `process` through dependency-cruiser and Biome.

**S10.** P5 Except: "whose output changes neither how a use case acts nor what it answers". Reading
A: output means what the code hands back to its caller. Reading B: any effect, including logs.
I took A. Changed: logger, tracer and request context imported directly; `Clock` and ids made ports.

**S11.** Glossary, Message: "It has an id, the same on every delivery of it." Reading A: one message
published in two versions is one message, one id. Reading B: each version is its own message. I took
A. Changed: outbox key is `(id, version)`; consumers deduplicate by state anyway.

**S12.** Glossary, Offer: "its system builders and the fakes of those ports". Reading A: fakes of the
open host service's driving ports only. Reading B: fakes of every port the system has. I took A.
Changed: offer packages export fakes of `ReserveStockV1`, `StartCardPaymentV1`, `GetOrderStatusV1`;
driven-port fakes stay in `core` and reach other code only through `build<System>ForTest()`.

**S13.** Glossary, Driving adapter: "There are as many driving adapters as there are ways into the
process." Reading A: one per way in per process, so one HTTP adapter for all systems. Reading B: one
per way in per system. I took B. Changed: the Fastify instance is process plumbing in `apps/api`;
each system ships its own route and hook plugins.

**S14.** Glossary, Tentative operation: "its confirmation gives it". Reading A: confirmation makes
the hold firm (order placed). Reading B: confirmation hands the thing over (shipment). I took A.
Changed: `Reservation` goes `tentative`, `held`, `consumed`; `HoldReservation` on `OrderPlaced`.

**S15.** Glossary, Hook: "A driving adapter an external system calls." Reading A: includes our code
running inside the external system's UI (the Payload stock field). Reading B: only the external
system's own callbacks. I took A. Changed: `GET /fulfilment/stock/:sku` lives under `fulfilment`'s
hooks and translates there.

**S16.** P13: "A system changes its model without its downstream systems changing". Reading A: the
published language may stay fixed while the model changes, and old versions must remain until
downstream moves. Reading B: only the internal model; a published-language change may force
downstream changes. I took A. Changed: one outbox row per live version, `V1` port functions kept as
adapters, snapshot check.

**S17.** P17: "Work spanning systems ends". Reading A: eventually, with a human allowed in the loop.
Reading B: without human action. I took B and reported dead letters as where it does not hold.
Changed: none in code; the P17 paragraph says "does not fully hold".
