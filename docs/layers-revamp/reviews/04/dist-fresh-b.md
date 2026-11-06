# Fresh repository draft B, distilled set (property rules)

Tea shop, TypeScript on Node 22. Next.js 15 hosting Payload CMS 3, one Postgres 16, Drizzle ORM, Stripe, a 3PL warehouse
API with webhooks, a bank API, a mail provider, pino, OpenTelemetry to Jaeger. pnpm workspace; zod for every schema;
Vitest; Biome for lint and format; dependency-cruiser for import boundaries; pg-boss as the bus.

Names that are not glossary terms are in backticks.

## Systems and what each owns

Four systems of this codebase, cut by whose business rules decide which record (P3). Payload owns the product
records outright: the brief has editors change them in Payload's admin, so they are Payload's (P11's Why, S1, S2).

| system | kind | owns (its business rules decide) | keeps (Postgres schema, role) |
|---|---|---|---|
| `shop` | system, core | `Cart`, `Order` (with `OrderLine` snapshots of price, sku, tax class), `Customer`; when an order is ready for shipment; payment deadline; whether pay by invoice is offered; late-payment handling | schema `shop`, role `shop_app`: `carts`, `cart_lines`, `orders`, `order_lines`, `customers`; replicas `catalog_entries` (from Payload), `stock_availability` (from fulfillment), `dunning_statuses` (from billing); `outbox`, `handled_messages` |
| `payment` | system, supporting | `CardPayment` (Stripe PaymentIntent mirror in payment's terms, its refunds, its dispute flag); refundability; expiry of unconfirmed payments | schema `payment`, role `payment_app`: `card_payments`, `refunds`; `outbox`, `handled_messages` |
| `billing` | system, supporting | `Invoice`, `CreditNote`, `InvoiceNumberSeries`, `CreditNoteNumberSeries`, `InvoiceableOrder` (billing's own record of what it must invoice), `IncomingTransfer`, `CustomerDunning`, `DunningRun`; VAT by tax class; gapless numbering; matching; dunning stages; what "in dunning" means | schema `billing`, role `billing_app`: tables of each aggregate; `outbox`, `handled_messages` |
| `fulfillment` | system, supporting | `Stock` (per product, with its reservations), `OrderAllocation`, `Shipment`, `Article` (3PL article-master state); reservation, release, booking, dispatch | schema `fulfillment`, role `fulfillment_app`: tables of each aggregate; `outbox`, `handled_messages` |

External systems:

| external system | runs | owns | how this codebase meets it |
|---|---|---|---|
| Payload CMS 3 | in-process, inside the `web` process | `products` (copy, images, slug, `priceCents`, `sku`, `taxClass`, `revision`), `media`, editor `users`; price above zero (`min: 1` on `priceCents`) and sku unique (`unique: true`) are its configuration's own rules | configured in package `@tea/cms`; its store is schema `payload`, role `payload_app`; its transaction writes `payload.outbox_messages` (hidden collection) in an `afterChange`/`afterDelete` hook; assembly hands the relay an outbox reader for it; its admin shows stock through a UI field calling fulfillment's open host service over HTTP |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | payment's driven adapter `StripePaymentProvider` (API); payment's hook `/api/payment/webhooks/stripe` |
| 3PL warehouse | vendor | consignments, article master | fulfillment's driven adapter `WarehouseClient`; fulfillment's hook `/api/fulfillment/webhooks/warehouse` |
| bank | vendor | account transactions | billing's scheduled task `bankPollTask` lists incoming transfers |
| mail provider | vendor | mail delivery | `shop` and `billing` each have a driven adapter `MailProviderMailer` (HTTP API) |
| Jaeger | ours, separate | traces | OTLP exporter registered by each process's entry point |
| Prometheus | ours, separate | metrics | scrapes probes `/api/metrics` (web) and `:9464/metrics` (worker) |

Next.js is the outside too (a framework that drives the system); it reaches each system only through driving adapters.

Shared kernel: `@tea/money` (`packages/money`). `Money` = `{ cents: number (integer), currency: "EUR" }`, its zod
value schema, `add`, `subtract`, `times(quantity)`, `sum`, `share(amount, numerator, denominator)` with half-up
rounding, `isPositive`. Values and what computes them from arguments, no record's schema (P3). Imported by every
system's domain and published language.

Code that is no system:

- Common library `@tea/kit` (`packages/kit`): `message-def` (envelope type, `defineMessage`), `messaging` (outbox and
  handled-messages table factories, outbox writer helper, generic Postgres outbox reader, relay, pg-boss bus, handler
  and scheduled-task interfaces, trace propagation onto the envelope), `postgres` (`TxRegistry`, pool factory),
  `telemetry` (ready-made pino `logger`, `tracer` from `@opentelemetry/api`, prom-client registry), `clock`
  (`systemClock`, `uuidV7`), `testing` (Postgres testcontainer migrated by the real migrations, port contract runner).
  No business rule, no system's schema.
- Payload configuration `@tea/cms` (`packages/cms`): an external system's configuration, written here.
- Assembly: `apps/web/src/assembly/*`, `apps/worker/src/assembly/*`.
- Probes: `apps/web/src/probes/*`, `apps/worker/src/probes/*`.
- Tooling: `apps/migrate` (run as a one-off job before a deploy, in no process of the deployed application),
  `tooling/*` (CI checks, DB role script).

## Ports and adapters

### Shapes every system repeats (each declares its own copy, in its own terms)

```ts
// packages/<sys>/src/service/ports/tx.ts
export interface Tx { readonly system: "shop" }                 // opaque token; "payment" | "billing" | "fulfillment" elsewhere
export interface Transactions { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }

// packages/<sys>/src/service/ports/driven.ts (common part)
export interface Clock { now(): Instant }                        // Instant: domain brand over Date
export interface HandledMessages {
  find(tx: Tx, id: MessageId): Promise<HandledOutcome | null>;   // HandledOutcome: per-system JSON union
  record(tx: Tx, id: MessageId, outcome: HandledOutcome): Promise<void>; // PK on message_id: a concurrent repeat fails at commit
}
export interface Outbox { add(tx: Tx, message: Outgoing): Promise<void> } // Outgoing: union of the system's published events + private messages

// packages/<sys>/src/service/ports/delivered.ts
export type MessageId = string & { readonly __brand: "shop.MessageId" };
export interface Delivered<T> { readonly messageId: MessageId; readonly body: T }
```

Driven adapters common to all four: `DrizzleTransactions` (wraps `db.transaction`, mints a frozen `Tx` token,
registers the Drizzle transaction in a `TxRegistry` `WeakMap<Tx, PgTx>`, removes it after commit or rollback),
`DrizzleHandledMessages`, `DrizzleOutbox` (validates with the message's schema, writes `id`, `type`, `version`,
`payload`, `headers` with W3C `traceparent`/`baggage`), `systemClock`/`uuidV7` from `@tea/kit/clock` (implement the
ports by shape). Fakes in `src/adapters/driven/memory/`: `InMemoryTransactions` (copy-on-write state, swapped in on
success, discarded on throw), `InMemoryHandledMessages`, `InMemoryOutbox` (exposes `committed()`), `FixedClock`,
`SequentialIds`. Each in-memory repository fails a save whose version does not match, as the Drizzle one does.

### shop

Driving ports (`packages/shop/src/service/ports/driving.ts`), none on an open host service: no other system calls shop.

```ts
export interface ShopStorefront {
  browseProducts(q: { page: number }): Promise<ProductListing>;                       // answering
  getProduct(q: { slug: Slug }): Promise<ProductPage | null>;                         // answering
  getCart(q: { cartId: CartId }): Promise<CartView>;                                  // answering
  getCheckoutOptions(q: { customerId: CustomerId }): Promise<CheckoutOptions>;        // answering: { payByInvoice: boolean }
  registerCustomer(c: { email: Email; name: PersonName; billingAddress: Address }): Promise<CustomerId>;
  addToCart(c: { cartId: CartId | null; productId: ProductId; quantity: Quantity }): Promise<AddToCartResult>;
  removeFromCart(c: { cartId: CartId; productId: ProductId }): Promise<CartView>;
  checkout(c: {
    cartId: CartId; customerId: CustomerId; paymentMethod: PaymentMethod;             // "card" | "invoice"
    shippingAddress: Address; billingAddress: Address; locale: Locale;
  }): Promise<CheckoutResult>;
}
export type CheckoutResult =
  | { kind: "awaiting-card-payment"; orderId: OrderId; clientPaymentToken: ClientPaymentToken }
  | { kind: "placed-on-invoice"; orderId: OrderId }
  | { kind: "refused"; reason: "cart-empty" | "product-unavailable" | "pay-by-invoice-not-offered" | "card-payment-refused" };

export interface ShopBackoffice {
  listOrders(q: OrderFilter): Promise<OrderSummary[]>;
  getOrder(q: { orderId: OrderId }): Promise<OrderDetail | null>;
}

export interface ShopMessagePorts {   // each called by exactly one handler or scheduled task
  applyCatalogChange(m: Delivered<CatalogChange>): Promise<void>;
  applyStockAvailability(m: Delivered<{ productId: ProductId; available: Quantity; version: number }>): Promise<void>;
  applyDunningStatus(m: Delivered<{ customerId: CustomerId; inDunning: boolean; version: number }>): Promise<void>;
  recordCardPaymentSucceeded(m: Delivered<{ orderId: OrderId; paymentRef: PaymentRef }>): Promise<void>;
  recordRefundCompleted(m: Delivered<{ orderId: OrderId; refundRequestId: RefundRequestId | null; amount: Money }>): Promise<void>;
  recordRefundRefused(m: Delivered<{ orderId: OrderId; refundRequestId: RefundRequestId; reason: string }>): Promise<void>;
  recordStockShortfall(m: Delivered<{ orderId: OrderId }>): Promise<void>;
  recordShipmentDispatched(m: Delivered<{ orderId: OrderId; dispatchedAt: Instant; trackingNumber: string }>): Promise<void>;
  recordShipmentBookingRefused(m: Delivered<{ orderId: OrderId; reason: string }>): Promise<void>;
  recordInvoiceSettled(m: Delivered<{ orderId: OrderId }>): Promise<void>;
  schedulePaymentDeadlineChecks(): Promise<{ scheduled: number }>;
  expireOrderPayment(m: Delivered<{ orderId: OrderId }>): Promise<void>;
  sendOrderConfirmation(m: Delivered<OrderConfirmationMail>): Promise<void>;
  revalidateProductPages(m: Delivered<{ slugs: Slug[] }>): Promise<void>;
}
```

Driven ports (`packages/shop/src/service/ports/driven.ts`), besides the common ones:

```ts
export interface Carts { get(tx: Tx, id: CartId): Promise<Cart | null>; save(tx: Tx, cart: Cart): Promise<void> }
export interface Orders {
  get(tx: Tx, id: OrderId): Promise<Order | null>;
  save(tx: Tx, order: Order): Promise<void>;                     // insert on version 0, else UPDATE ... WHERE version = $prev
  findPastPaymentDeadline(tx: Tx, now: Instant, limit: number): Promise<OrderId[]>;
}
export interface Customers { get(tx: Tx, id: CustomerId): Promise<Customer | null>; save(tx: Tx, c: Customer): Promise<void> }
export interface CatalogReplica {
  getMany(tx: Tx, ids: ProductId[], accepted: StalenessRule<"catalog">): Promise<CatalogEntry[]>;
  get(tx: Tx, id: ProductId): Promise<CatalogEntry | null>;      // for applying a change, no staleness decision
  save(tx: Tx, entry: CatalogEntry): Promise<void>;
}
export interface StockReplica {
  getMany(tx: Tx, ids: ProductId[], accepted: StalenessRule<"stock">): Promise<StockAvailability[]>;
  get(tx: Tx, id: ProductId): Promise<StockAvailability | null>;
  save(tx: Tx, s: StockAvailability): Promise<void>;
}
export interface DunningReplica {
  get(tx: Tx, id: CustomerId, accepted: StalenessRule<"dunning">): Promise<DunningStatus | null>;
  save(tx: Tx, s: DunningStatus): Promise<void>;
}
export interface StorefrontQueries {
  listPublished(page: number, accepted: StalenessRule<"catalog">): Promise<ProductListing>;
  bySlug(slug: Slug, accepted: StalenessRule<"catalog">): Promise<ProductPage | null>;
  cart(id: CartId): Promise<CartView>;
}
export interface OrderQueries { list(f: OrderFilter): Promise<OrderSummary[]>; detail(id: OrderId): Promise<OrderDetail | null> }
export interface CardPayments {                                  // waits on payment: checkout needs the token now
  request(r: { orderId: OrderId; amount: Money; customerEmail: Email }):
    Promise<{ kind: "requested"; paymentRef: PaymentRef; clientPaymentToken: ClientPaymentToken } | { kind: "refused"; reason: string }>;
  status(orderId: OrderId): Promise<"succeeded" | "pending" | "none">;
}
export interface PaymentRequests {                               // writes payment's commands into shop's outbox, in tx
  requestRefund(tx: Tx, r: { refundRequestId: RefundRequestId; orderId: OrderId; amount: Money; reason: RefundReason }): Promise<void>;
  requestCancellation(tx: Tx, r: { orderId: OrderId }): Promise<void>;
}
export interface Mailer { sendOrderConfirmation(m: OrderConfirmationMail): Promise<void> } // OrderConfirmationMail carries sender, recipient, locale, lines
export interface PageCache { invalidate(slugs: Slug[]): Promise<void> }
export interface Ids { orderId(): OrderId; cartId(): CartId; customerId(): CustomerId }
```

`StalenessRule<K>` is a branded value exported only by `shop/src/domain/accepted-staleness.ts`; each one is a business
rule stating what is accepted stale and what follows when it changed meanwhile (P10).

Driven adapters: `DrizzleCarts`, `DrizzleOrders`, `DrizzleCustomers`, `DrizzleCatalogReplica`, `DrizzleStockReplica`,
`DrizzleDunningReplica`, `DrizzleStorefrontQueries`, `DrizzleOrderQueries` (`src/adapters/driven/drizzle/`);
`PaymentSystemCardPayments` (calls `PaymentOpenHost`, translates `paymentPl.*` to shop's terms;
`src/adapters/driven/payment-system/card-payments.ts`); `OutboxPaymentRequests` (builds `paymentPl.RefundCardPaymentV1`
/ `CancelCardPaymentV1` and writes them through the outbox writer in the same `Tx`;
`src/adapters/driven/payment-system/payment-requests.ts`); `MailProviderMailer`; `RevalidatingPageCache` (POSTs
`{ tags }` to the `web` process's `/api/shop/internal/revalidate`, whose route handler, part of this adapter, calls
`revalidateTag`). Fakes for each in `src/adapters/driven/memory/`.

Driving adapters:
- Next pages and server actions in `src/adapters/driving/next/`: `StorefrontPage`, `ProductPage`, `CartPage`,
  `CheckoutPage`, `addToCartAction`, `removeFromCartAction`, `checkoutAction`, `registerCustomerAction`,
  `AdminOrdersPage`, `AdminOrderPage`. Each parses input with the domain's schema, reads the customer id from the
  session cookie and passes it as an argument, makes at most one acting call, returns JSON or renders.
- Handlers in `src/adapters/driving/handlers/`: `cms/catalog-product-changed.ts` (parses `cmsPl.ProductChangedV1`),
  `fulfillment/stock-availability-changed.ts`, `fulfillment/stock-shortfall.ts`, `fulfillment/shipment-dispatched.ts`,
  `fulfillment/shipment-booking-refused.ts`, `billing/dunning-status-changed.ts`, `billing/invoice-paid.ts`,
  `payment/card-payment-succeeded.ts`, `payment/card-payment-refunded.ts`, `payment/card-refund-refused.ts`,
  `private/expire-order-payment.ts`, `private/send-order-confirmation.ts`, `private/revalidate-product-pages.ts`.
- Scheduled task `src/adapters/driving/scheduled/payment-deadline-task.ts` (cron `* * * * *`): one acting call,
  `schedulePaymentDeadlineChecks()`.

### payment

Open host service (in the offer, `packages/payment/src/offer/open-host.ts`; every type from `@tea/payment/published`):

```ts
export interface PaymentOpenHost {
  requestCardPayment(r: CardPaymentRequestV1):                   // { orderId, amountCents, currency, customerEmail }
    Promise<{ ok: true; value: CardPaymentRequestedV1 }          // { paymentId, clientSecret }
          | { ok: false; error: CardPaymentRequestErrorV1 }>;    // { code: "amount-not-positive" }
  getCardPaymentStatus(q: { orderId: string }): Promise<CardPaymentStatusV1>; // { status: "succeeded" | "pending" | "none" }
}
export function createPaymentOpenHostFake(opts?: { clientSecretPrefix?: string }): PaymentOpenHost & {
  confirm(orderId: string): Promise<void>;                       // drives the fake provider to "succeeded"
};
```

The fake is payment's real services built on payment's in-memory adapters and `FakePaymentProvider`, so it runs the
same code payment's suite runs.

Internal driving ports:

```ts
export interface PaymentBackoffice {
  refundCardPayment(c: RefundCommand): Promise<RefundOutcome>;   // RefundCommand: { refundRequestId, orderId, amount: Money | "remaining", reason }
  listPayments(q: PaymentFilter): Promise<PaymentSummary[]>;
}
export type RefundOutcome = { kind: "accepted"; refundId: RefundId } | { kind: "refused"; reason: "disputed" | "exceeds-refundable" | "not-captured" };

export interface PaymentMessagePorts {
  recordProviderNotification(m: Delivered<ProviderNotification>): Promise<void>; // translated Stripe event
  refundCardPayment(m: Delivered<RefundCommand>): Promise<void>;                // payment's RefundCardPayment command
  cancelCardPayment(m: Delivered<{ orderId: OrderRef }>): Promise<void>;        // payment's CancelCardPayment command
  scheduleExpiryChecks(): Promise<{ scheduled: number }>;
  expireCardPayment(m: Delivered<{ paymentId: PaymentId }>): Promise<void>;
  executeRefund(m: Delivered<{ paymentId: PaymentId; refundId: RefundId }>): Promise<void>;
  executeIntentCancellation(m: Delivered<{ paymentId: PaymentId }>): Promise<void>;
}
export type ProviderNotification =
  | { kind: "intent-succeeded"; providerRef: ProviderPaymentRef; at: Instant }
  | { kind: "intent-failed"; providerRef: ProviderPaymentRef }
  | { kind: "refund-succeeded"; providerRefundId: ProviderRefundId; refundId: RefundId }
  | { kind: "refund-failed"; providerRefundId: ProviderRefundId; refundId: RefundId; reason: string }
  | { kind: "dispute-opened"; providerRef: ProviderPaymentRef };
```

Driven ports:

```ts
export interface Payments {
  get(tx: Tx, id: PaymentId): Promise<CardPayment | null>;
  getByOrder(tx: Tx, orderId: OrderRef): Promise<CardPayment | null>;
  getByProviderRef(tx: Tx, ref: ProviderPaymentRef): Promise<CardPayment | null>;
  save(tx: Tx, p: CardPayment): Promise<void>;                   // refunds are rows of the aggregate, saved with it
  findExpired(tx: Tx, now: Instant, limit: number): Promise<PaymentId[]>;
}
export interface PaymentProvider {
  createIntent(r: { paymentId: PaymentId; orderId: OrderRef; amount: Money; idempotencyKey: string }):
    Promise<{ providerRef: ProviderPaymentRef; clientSecret: ClientSecret }>;
  intentStatus(ref: ProviderPaymentRef): Promise<"open" | "processing" | "succeeded" | "canceled">;
  findIntentByPayment(id: PaymentId): Promise<ProviderPaymentRef | null>;
  cancelIntent(ref: ProviderPaymentRef, idempotencyKey: string): Promise<{ kind: "cancelled" } | { kind: "refused"; reason: "already-succeeded" }>;
  refund(r: { providerRef: ProviderPaymentRef; amount: Money; refundId: RefundId }):
    Promise<{ kind: "submitted"; providerRefundId: ProviderRefundId } | { kind: "declined"; reason: string }>;
}
export interface PaymentQueries { list(f: PaymentFilter): Promise<PaymentSummary[]> }
export interface Ids { paymentId(): PaymentId; refundId(): RefundId }
```

Driven adapters: Drizzle ones; `StripePaymentProvider` (`stripe` SDK; idempotency keys `payment:{paymentId}`,
`cancel:{paymentId}`, `refund:{refundId}`; `refund` first lists the intent's refunds and returns the one whose
`metadata.refundId` matches before creating; maps `card_declined`/`charge_disputed` and 4xx business errors to
`declined`, network and 5xx to a thrown error); `FakePaymentProvider` (table of intents).

Driving adapters: hook `stripeWebhookRoute` (`src/adapters/driving/next/stripe-webhook-route.ts`: raw body,
`stripe.webhooks.constructEvent`, translates `Stripe.Event` to `ProviderNotification`, one acting call, answers 200
only after it returns, 400 on a bad signature, 500 on failure); handlers `commands/refund-card-payment.ts`, `commands/cancel-card-payment.ts` (parse payment's own command schemas),
`private/expire-card-payment.ts`, `private/execute-refund.ts`, `private/execute-intent-cancellation.ts`; scheduled
`expiry-task.ts` (every 5 min); admin `AdminPaymentsPage`, `refundAction`.

### billing

No open host service. Driving ports:

```ts
export interface BillingBackoffice {
  listInvoices(q: InvoiceFilter): Promise<InvoiceSummary[]>;
  listUnmatchedTransfers(): Promise<TransferSummary[]>;
  assignTransfer(c: { bankTransferId: BankTransferId; invoiceNumber: InvoiceNumber }): Promise<AssignOutcome>;
}
export interface BillingMessagePorts {
  noteOrderPlaced(m: Delivered<OrderToInvoice>): Promise<void>;   // lines with TaxClass, payment method, customer, addresses
  noteOrderPaid(m: Delivered<{ orderRef: OrderRef; paidAt: Instant }>): Promise<void>;
  noteOrderShipped(m: Delivered<{ orderRef: OrderRef; shippedAt: Instant }>): Promise<void>;
  noteOrderCancelled(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  noteRefund(m: Delivered<{ orderRef: OrderRef; refundRef: RefundRef; amount: Money }>): Promise<void>;
  recordIncomingTransfer(m: Delivered<IncomingTransferFacts>): Promise<void>; // messageId = "bank:" + bank transfer id
  scheduleDunningRun(): Promise<{ scheduled: number }>;
  advanceCustomerDunning(m: Delivered<{ customerRef: CustomerRef; runDate: BusinessDate }>): Promise<void>;
  sendDunningReminder(m: Delivered<DunningReminderMail>): Promise<void>;
  mailInvoice(m: Delivered<{ invoiceId: InvoiceId }>): Promise<void>;
  mailCreditNote(m: Delivered<{ creditNoteId: CreditNoteId }>): Promise<void>;
}
```

Driven ports:

```ts
export interface InvoiceableOrders { get(tx: Tx, ref: OrderRef): Promise<InvoiceableOrder | null>; save(tx: Tx, o: InvoiceableOrder): Promise<void> }
export interface Invoices {
  get(tx: Tx, id: InvoiceId): Promise<Invoice | null>;
  getByNumber(tx: Tx, n: InvoiceNumber): Promise<Invoice | null>;
  openOverdueForCustomer(tx: Tx, c: CustomerRef, asOf: BusinessDate): Promise<Invoice[]>;
  customersWithOverdue(tx: Tx, asOf: BusinessDate): Promise<CustomerRef[]>;
  save(tx: Tx, i: Invoice): Promise<void>;
}
export interface InvoiceNumberSeriesRepo { get(tx: Tx, year: number): Promise<InvoiceNumberSeries | null>; save(tx: Tx, s: InvoiceNumberSeries): Promise<void> }
export interface CreditNoteNumberSeriesRepo { get(tx: Tx, year: number): Promise<CreditNoteNumberSeries | null>; save(tx: Tx, s: CreditNoteNumberSeries): Promise<void> }
export interface CreditNotes { get(tx: Tx, id: CreditNoteId): Promise<CreditNote | null>; save(tx: Tx, c: CreditNote): Promise<void> }
export interface IncomingTransfers { get(tx: Tx, id: BankTransferId): Promise<IncomingTransfer | null>; save(tx: Tx, t: IncomingTransfer): Promise<void> }
export interface CustomerDunnings { get(tx: Tx, c: CustomerRef): Promise<CustomerDunning | null>; save(tx: Tx, d: CustomerDunning): Promise<void> }
export interface DunningRuns { save(tx: Tx, r: DunningRun): Promise<void> }  // PK run_date
export interface InvoiceDocuments { render(i: Invoice | CreditNote): Promise<Uint8Array> } // in-process PDF (pdfkit)
export interface Mailer { send(m: BillingMail): Promise<void> }
export interface BillingQueries { /* invoices, transfers for the dashboard */ }
export interface Ids { invoiceId(): InvoiceId; creditNoteId(): CreditNoteId }
```

Driven adapters: Drizzle ones, `PdfkitInvoiceDocuments`, `MailProviderMailer`, fakes.

Driving adapters: handlers `shop/order-placed.ts`, `shop/order-paid.ts`, `shop/order-shipped.ts`,
`shop/order-cancelled.ts` (parse `shopPl.*`), `payment/card-payment-refunded.ts` (parses `paymentPl.*`),
`private/advance-customer-dunning.ts`, `private/send-dunning-reminder.ts`, `private/mail-invoice.ts`,
`private/mail-credit-note.ts`; scheduled `bank-poll-task.ts` (every 5 min; holds `BankClient`, built by billing's
builder from configuration; lists incoming transfers of the last 3 days, parses each with the bank's schema, translates
to `IncomingTransferFacts`, one acting call `recordIncomingTransfer` per transfer with its bank id as message id) and
`dunning-task.ts` (06:00 Europe/Berlin daily, one acting call `scheduleDunningRun()`); admin `AdminInvoicesPage`,
`AdminTransfersPage`, `assignTransferAction`.

### fulfillment

Open host service (`packages/fulfillment/src/offer/open-host.ts`):

```ts
export interface FulfillmentOpenHost {
  getStockLevels(q: { productIds: string[] }): Promise<StockLevelV1[]>; // { productId, onHand, reserved, available }
}
export function createFulfillmentOpenHostFake(seed?: StockLevelV1[]): FulfillmentOpenHost;
```

Reached over HTTP as `GET /api/fulfillment/v1/stock-levels?productIds=` by Payload's admin field (another process: the
editor's browser).

Internal driving ports:

```ts
export interface FulfillmentBackoffice {
  recordStockCount(c: { productId: ProductRef; onHand: Quantity; countedAt: Instant }): Promise<void>;
  listShipments(q: ShipmentFilter): Promise<ShipmentSummary[]>;
}
export interface FulfillmentMessagePorts {
  allocateOrder(m: Delivered<OrderToAllocate>): Promise<void>;             // from shop's OrderPlaced
  releaseOrder(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;      // from shop's OrderCancelled
  requestShipment(m: Delivered<OrderToShip>): Promise<void>;              // from shop's OrderReadyForShipment
  noteArticleChange(m: Delivered<ArticleChange>): Promise<void>;          // from Payload's ProductChanged
  registerArticle(m: Delivered<{ productId: ProductRef; revision: number }>): Promise<void>;
  bookShipment(m: Delivered<{ shipmentId: ShipmentId }>): Promise<void>;
  recordWarehouseNotification(m: Delivered<WarehouseNotification>): Promise<void>; // dispatched / delivered
  scheduleDispatchChecks(): Promise<{ scheduled: number }>;
  checkDispatch(m: Delivered<{ shipmentId: ShipmentId }>): Promise<void>;
}
```

Driven ports:

```ts
export interface Stocks { getMany(tx: Tx, ids: ProductRef[]): Promise<Stock[]>; save(tx: Tx, s: Stock): Promise<void> } // absent => Stock.empty(id)
export interface OrderAllocations { get(tx: Tx, ref: OrderRef): Promise<OrderAllocation | null>; save(tx: Tx, a: OrderAllocation): Promise<void> }
export interface Shipments {
  get(tx: Tx, id: ShipmentId): Promise<Shipment | null>;
  getByConsignment(tx: Tx, c: ConsignmentId): Promise<Shipment | null>;
  findDispatchOverdue(tx: Tx, now: Instant, limit: number): Promise<ShipmentId[]>;
  save(tx: Tx, s: Shipment): Promise<void>;
}
export interface Articles { get(tx: Tx, id: ProductRef): Promise<Article | null>; save(tx: Tx, a: Article): Promise<void> }
export interface Warehouse {
  upsertArticle(a: { sku: Sku; name: string }): Promise<{ kind: "registered" } | { kind: "refused"; reason: string }>; // PUT by sku
  bookConsignment(b: { shipmentId: ShipmentId; lines: { sku: Sku; quantity: Quantity }[]; address: Address }):
    Promise<{ kind: "booked"; consignmentId: ConsignmentId } | { kind: "refused"; reason: string }>; // externalReference = shipmentId
  consignmentStatus(shipmentId: ShipmentId): Promise<{ kind: "dispatched"; at: Instant; trackingNumber: string } | { kind: "pending" } | { kind: "unknown" }>;
}
export interface StockQueries { levels(ids: ProductRef[]): Promise<StockLevel[]> }
export interface ShipmentQueries { list(f: ShipmentFilter): Promise<ShipmentSummary[]> }
export interface Ids { shipmentId(): ShipmentId }
```

Driven adapters: Drizzle ones; `WarehouseClient` (fetch; 409 on a duplicate `externalReference` read as `booked` with
the existing consignment id; 422 as `refused`; 5xx and timeouts thrown); `FakeWarehouse`.

Driving adapters: handlers `shop/order-placed.ts`, `shop/order-cancelled.ts`, `shop/order-ready-for-shipment.ts`,
`cms/product-changed.ts`, `private/register-article.ts`, `private/book-shipment.ts`, `private/check-dispatch.ts`;
hook `warehouseWebhookRoute` (HMAC check, translates to `WarehouseNotification`, messageId = the 3PL's event id);
route `stockLevelsRoute` (versioned path, PL types); scheduled `dispatch-check-task.ts` (hourly); admin
`AdminShipmentsPage`, `AdminStockPage`, `recordStockCountAction`.

### Payload (external system, configured in `@tea/cms`)

Not a system; listed because this codebase writes its configuration. `products` collection: `beforeChange` hook
`bumpRevision` sets `revision = (originalDoc?.revision ?? 0) + 1`; `afterChange`/`afterDelete` hook
`writeProductOutbox` calls `req.payload.create({ collection: "outbox-messages", data, req })`, so the row commits in
Payload's own transaction. Message schema `ProductChangedV1` in `packages/cms/src/published/`. UI field
`StockLevelField` (`admin.components.Field`) fetches fulfillment's stock-levels route. No hook of Payload calls a
system.

## Calls and messages

### Synchronous calls

| caller | callee | what | synchronous | refusal comes back as |
|---|---|---|---|---|
| shop `checkout` via `PaymentSystemCardPayments` | payment `PaymentOpenHost.requestCardPayment` | in-process call, inside shop's open transaction, carrying none | yes | `{ ok: false, error }` in payment's published language, translated to `{ kind: "refused" }`; shop answers `card-payment-refused`, writes nothing. Thrown failure: checkout throws, transaction rolls back |
| payment `requestCardPayment` | Stripe `paymentIntents.create` (tentative operation) | before payment's transaction opens | yes | Stripe error: thrown, nothing committed |
| shop `expireOrderPayment` via `CardPayments.status` | payment `getCardPaymentStatus` | answering, before shop's transaction | yes | none (answering); failure throws, handler fails, bus redelivers |
| payment `expireCardPayment`, executors | Stripe | intent status, cancel, refund | yes | `declined`/`refused` union committed as outcome; failure thrown |
| fulfillment executors | 3PL | `upsertArticle`, `bookConsignment`, `consignmentStatus` | yes | `refused` union committed as outcome; failure thrown |
| billing `bankPollTask` | bank API | list transfers | yes | failure: task fails, next tick retries |
| shop, billing mail executors | mail provider | send | yes | failure thrown, redelivered |
| shop `RevalidatingPageCache` (worker) | `web` route `/api/shop/internal/revalidate` | HTTP | yes | non-2xx thrown, redelivered |
| Payload admin `StockLevelField` (browser) | fulfillment `GET /api/fulfillment/v1/stock-levels` | HTTP, answering | yes | 400 on bad ids |
| browser | shop server actions, pages | HTTP | yes | `CheckoutResult` union as JSON |
| admin browser | each system's admin actions | HTTP | yes | `RefundOutcome`, `AssignOutcome` unions as JSON |
| Stripe | payment hook | HTTP | yes | non-2xx: Stripe resends |
| 3PL | fulfillment hook | HTTP | yes | non-2xx: 3PL resends |

### Messages

All asynchronous: written to the writer's outbox in its transaction, relayed to pg-boss by the worker, delivered to
one pg-boss queue per subscribing handler (`<subscriber>.<handler>`), retried with backoff (limit 10), then parked in
queue `dead-letters`.

| message (type, version) | kind | written by | handled by | carries a thing-version |
|---|---|---|---|---|
| `cms.ProductChanged` v1 | published event (Payload's) | Payload (configured) | shop `catalog-product-changed`, fulfillment `product-changed` | `revision` |
| `shop.OrderPlaced` v1 | published event | shop `checkout` | fulfillment `order-placed`, billing `order-placed` | order `version` |
| `shop.OrderPaid` v1 | published event | shop `recordCardPaymentSucceeded`, `expireOrderPayment` (paid at reconciliation) | billing `order-paid` | order `version` |
| `shop.OrderReadyForShipment` v1 | published event | shop (card: on paid; invoice: at checkout) | fulfillment `order-ready-for-shipment` | order `version` |
| `shop.OrderCancelled` v1 | published event | shop (deadline, shortfall, booking refused) | fulfillment `order-cancelled`, billing `order-cancelled` | order `version` |
| `shop.OrderShipped` v1 | published event | shop `recordShipmentDispatched` | billing `order-shipped` | order `version` |
| `shop.SendOrderConfirmation` v1 | private | shop `checkout` | shop `send-order-confirmation` | |
| `shop.ExpireOrderPayment` v1 | private, id `shop.expire:{orderId}` | shop `schedulePaymentDeadlineChecks` | shop `expire-order-payment` | |
| `shop.RevalidateProductPages` v1 | private | shop `applyCatalogChange` | shop `revalidate-product-pages` | |
| `payment.RefundCardPayment` v1 | command, payment's | shop (via `OutboxPaymentRequests`) | payment `refund-card-payment` | |
| `payment.CancelCardPayment` v1 | command, payment's | shop | payment `cancel-card-payment` | |
| `payment.CardPaymentSucceeded` v1 | published event | payment | shop `card-payment-succeeded` | payment `version` |
| `payment.CardPaymentCancelled` v1 | published event | payment | (none yet) | payment `version` |
| `payment.CardPaymentRefunded` v1 | published event | payment | shop `card-payment-refunded`, billing `card-payment-refunded` | payment `version` |
| `payment.CardRefundRefused` v1 | published event | payment | shop `card-refund-refused` | payment `version` |
| `payment.ExpireCardPayment`, `payment.ExecuteRefund`, `payment.ExecuteIntentCancellation` v1 | private | payment | payment | |
| `billing.CustomerDunningStatusChanged` v1 | published event | billing | shop `dunning-status-changed` | dunning `version` |
| `billing.InvoicePaid` v1 | published event | billing | shop `invoice-paid` | invoice `version` |
| `billing.AdvanceCustomerDunning` v1 | private, id `billing.dunning:{customer}:{runDate}` | billing `scheduleDunningRun` | billing | |
| `billing.SendDunningReminder`, `billing.MailInvoice`, `billing.MailCreditNote` v1 | private | billing | billing | |
| `fulfillment.StockAvailabilityChanged` v1 | published event | fulfillment | shop `stock-availability-changed` | stock `version` |
| `fulfillment.StockShortfall` v1 | published event | fulfillment `allocateOrder`/`requestShipment` | shop `stock-shortfall` | allocation `version` |
| `fulfillment.ShipmentDispatched` v1 | published event | fulfillment | shop `shipment-dispatched` | shipment `version` |
| `fulfillment.ShipmentBookingRefused` v1 | published event | fulfillment `bookShipment` | shop `shipment-booking-refused` | shipment `version` |
| `fulfillment.RegisterArticle`, `fulfillment.BookShipment`, `fulfillment.CheckDispatch` v1 | private | fulfillment | fulfillment | |

Refusals of a message-carried step are committed by the refusing use case and published as an event of the refuser's
own published language naming no sender: `CardRefundRefused`, `StockShortfall`, `ShipmentBookingRefused`. A failure
(timeout, 5xx, lost version race) throws, commits nothing, and is redelivered; a failure no retry cures parks in
`dead-letters`, shown on `/admin/dead-letters` (a probe page of the web process).

### The flows

- Card checkout: `checkout` opens shop's transaction, loads the cart, reads catalog and stock replicas, decides the
  order, calls `CardPayments.request` (payment: creates the Stripe intent with key `payment:{paymentId}`, then saves
  `CardPayment(requested, expiresAt)` in payment's own transaction), saves the order and the emptied cart, writes
  `OrderPlaced` and `SendOrderConfirmation`, commits, returns the token. Browser confirms with Stripe. Stripe →
  payment hook → `CardPaymentSucceeded` → shop marks paid, writes `OrderPaid` and `OrderReadyForShipment` →
  fulfillment requests and books the shipment; billing issues the invoice.
- Invoice checkout: same, no payment call; `getCheckoutOptions` and `checkout` both decide by the dunning replica;
  writes `OrderPlaced` and `OrderReadyForShipment`. Billing issues the invoice on `OrderShipped`, due 14 days later.
- Payment deadline: every minute `schedulePaymentDeadlineChecks` writes one `ExpireOrderPayment` per overdue card
  order; its handler asks payment for the status, then in shop's transaction either marks paid or cancels (writes
  `OrderCancelled` and `CancelCardPayment`).
- Late payment: `CardPaymentSucceeded` for a cancelled order → shop writes `RefundCardPayment`
  (`refundRequestId = late:{orderId}`); `CardRefundRefused` (disputed) → shop marks `latePaymentKept`, shown on the
  dashboard.
- Refund by staff: admin → payment `refundCardPayment` → refused at once if disputed; else `ExecuteRefund` → Stripe →
  webhook → `CardPaymentRefunded` → billing credit note, shop marks the order refunded.
- Bank: poll → `recordIncomingTransfer` → matched invoice paid (`InvoicePaid`), dunning recomputed
  (`CustomerDunningStatusChanged`), or transfer kept `unmatched` for `assignTransfer`.
- Product change: Payload commit → its outbox → relay → shop replica + `RevalidateProductPages`; fulfillment
  `Article` + `RegisterArticle`.

## Processes

| deployable | entry point | what runs | assembly |
|---|---|---|---|
| `web` | `apps/web` (`next start`); `instrumentation.ts` `register()` | storefront pages and server actions, admin dashboard, Payload admin at `/cms` and its API, hooks for Stripe and the 3PL, fulfillment's stock-levels route, shop's revalidate route, probes `/api/health`, `/api/metrics` | `register()` starts the OTel `NodeSDK` (OTLP to Jaeger, `AsyncLocalStorageContextManager`, W3C trace context and baggage propagators), parses `WebConfig` from the environment (`assembly/config.ts`, zod), creates one `pg.Pool` per role, calls `buildPaymentForWeb`, `buildShopForWeb({ paymentOpenHost })`, `buildBillingForWeb`, `buildFulfillmentForWeb`; each builder fills its own system's courier; assembly fills the probe courier |
| `worker` | `apps/worker/src/main.ts` (`node dist/main.js`) | relay, pg-boss consumers (every handler), scheduled tasks (pg-boss cron), executors; probe server on `:9464` (`/health`, `/metrics`) | `buildWorker(config)`: pools, `PgBoss` (schema `pgboss`), `pgBossBus`, `buildPaymentForWorker`, `buildShopForWorker({ paymentOpenHost })`, `buildBillingForWorker`, `buildFulfillmentForWorker`; subscribes every returned handler, schedules every returned task, starts the relay over the four systems' outbox readers and `pgOutboxReader({ name: "payload", pool: pools.payload, table: "payload.outbox_messages" })`; SIGTERM stops the relay, then `boss.stop({ graceful: true })` |
| `migrate` (tooling) | `apps/migrate/src/main.ts` | run before every deploy | `payload migrate` for `@tea/cms`; Drizzle `migrate()` for `shop`, `payment`, `billing`, `fulfillment` (each its own `migrations/` folder, its own `__drizzle_migrations` table in its schema); `PgBoss.start()` once to install `pgboss` |

Roles and schemas are created by `tooling/db/roles.sql` (ops). Each role has `USAGE`/DML on its own schema only;
`migrate` connects as the owner role.

Builder shape (one per process kind per system; `packages/shop/src/builder/`):

```ts
export const ShopConfigSchema = z.object({ mail: z.object({ baseUrl: z.string().url(), apiKey: z.string() }),
  webInternalUrl: z.string().url(), revalidateSecret: z.string().min(32) });
export function buildShopForWeb(i: { config: ShopConfig; pool: Pool; paymentOpenHost: PaymentOpenHost }): void; // fills shop's courier
export function buildShopForWorker(i: { config: ShopConfig; pool: Pool; paymentOpenHost: PaymentOpenHost }): {
  handlers: Handler[]; scheduledTasks: ScheduledTask[]; outboxReader: OutboxReader;
};
```

Courier: `packages/<sys>/src/adapters/driving/next/courier.ts` keeps the filled ports under
`globalThis[Symbol.for("tea.<sys>.courier")]`, because Next.js bundles `instrumentation.ts` and route modules into
separate module graphs; `fill()` is exported only to the same package's builder; every page, action and route calls
`shopPorts()` inside its function body on each run; an empty courier throws.

Common library interfaces assembly wires:

```ts
export interface Envelope { id: string; type: string; version: number; occurredAt: string; payload: unknown; headers: Record<string, string> }
export interface OutboxReader { name: string; fetchUnrelayed(limit: number): Promise<Envelope[]>; markRelayed(ids: string[]): Promise<void> }
export interface Handler { name: string; accepts: readonly { type: string; version: number }[]; handle(e: Envelope): Promise<void> }
export interface ScheduledTask { name: string; cron: string; tz: "Europe/Berlin" | "UTC"; run(): Promise<void> }
export interface Bus { subscribe(h: Handler): Promise<void>; schedule(t: ScheduledTask): Promise<void>; publish(e: Envelope): Promise<void> }
```

The relay polls each reader every 500 ms under a Postgres advisory lock per reader, publishes each envelope, then marks
it; a stop between publishing and marking republishes (handled by P9). Relayed rows are deleted after 14 days by a
worker job.

Telemetry: `apps/web/middleware.ts` sets `x-request-id` when absent and puts it in OTel baggage as `request.id`; pino's
`mixin` adds `trace_id`, `span_id`, `request_id` from the active context; `DrizzleOutbox` writes `traceparent`,
`tracestate`, `baggage` into `headers`; `pgBossBus` extracts them and runs the handler in that context under a
consumer span.

## Directory tree

```
tea-shop/
├── package.json                      # scripts: typecheck, lint (biome + depcruise), test, test:int, test:e2e
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json                        # noProcessEnv on, overridden off for apps/*/src/assembly/config.ts
├── .dependency-cruiser.cjs           # layer, offer and upstream rules, generated from conformance.json
├── vitest.workspace.ts               # default project excludes *.int.test.ts, *.e2e.test.ts
├── docker-compose.yml                # postgres:16, jaegertracing/all-in-one (dev only)
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts            # withPayload(nextConfig)
│   │   ├── instrumentation.ts
│   │   ├── middleware.ts             # request id
│   │   └── src/
│   │       ├── payload.config.ts     # export { default } from "@tea/cms/config"
│   │       ├── assembly/
│   │       │   ├── config.ts
│   │       │   ├── telemetry.ts
│   │       │   └── build-web.ts
│   │       ├── probes/
│   │       │   ├── courier.ts
│   │       │   ├── database-ping.ts
│   │       │   └── dead-letters.ts
│   │       └── app/
│   │           ├── (payload)/cms/[[...segments]]/page.tsx          # Payload-generated
│   │           ├── (payload)/api/[...slug]/route.ts                # Payload-generated
│   │           ├── (shop)/page.tsx                                 # export { StorefrontPage as default } from "@tea/shop/next"
│   │           ├── (shop)/products/[slug]/page.tsx
│   │           ├── (shop)/cart/page.tsx
│   │           ├── (shop)/checkout/page.tsx
│   │           ├── (shop)/actions.ts                               # "use server"; re-exports shop's actions
│   │           ├── admin/shop/orders/page.tsx
│   │           ├── admin/shop/orders/[orderId]/page.tsx
│   │           ├── admin/payment/payments/page.tsx
│   │           ├── admin/payment/actions.ts
│   │           ├── admin/billing/invoices/page.tsx
│   │           ├── admin/billing/transfers/page.tsx
│   │           ├── admin/billing/actions.ts
│   │           ├── admin/fulfillment/shipments/page.tsx
│   │           ├── admin/fulfillment/stock/page.tsx
│   │           ├── admin/fulfillment/actions.ts
│   │           ├── admin/dead-letters/page.tsx                     # probe
│   │           ├── api/payment/webhooks/stripe/route.ts
│   │           ├── api/fulfillment/webhooks/warehouse/route.ts
│   │           ├── api/fulfillment/v1/stock-levels/route.ts
│   │           ├── api/shop/internal/revalidate/route.ts
│   │           ├── api/health/route.ts                             # probe
│   │           └── api/metrics/route.ts                            # probe
│   ├── worker/
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── assembly/config.ts
│   │       ├── assembly/telemetry.ts
│   │       ├── assembly/build-worker.ts
│   │       └── probes/server.ts
│   └── migrate/
│       ├── package.json
│       └── src/main.ts
├── packages/
│   ├── kit/                          # common library
│   │   ├── package.json              # exports ./message-def ./messaging ./postgres ./telemetry ./clock ./testing
│   │   └── src/
│   │       ├── message-def/envelope.ts
│   │       ├── message-def/define-message.ts
│   │       ├── messaging/outbox-table.ts
│   │       ├── messaging/handled-messages-table.ts
│   │       ├── messaging/write-envelope.ts
│   │       ├── messaging/pg-outbox-reader.ts
│   │       ├── messaging/relay.ts
│   │       ├── messaging/pg-boss-bus.ts
│   │       ├── messaging/handler.ts
│   │       ├── messaging/scheduled-task.ts
│   │       ├── messaging/propagation.ts
│   │       ├── postgres/tx-registry.ts
│   │       ├── postgres/pool.ts
│   │       ├── telemetry/logger.ts
│   │       ├── telemetry/tracer.ts
│   │       ├── telemetry/metrics.ts
│   │       ├── clock/system-clock.ts
│   │       ├── clock/uuid-v7.ts
│   │       ├── testing/postgres-container.ts
│   │       └── testing/port-contract.ts
│   ├── money/                        # shared kernel
│   │   ├── package.json
│   │   ├── src/money.ts
│   │   └── test/money.test.ts
│   ├── cms/                          # Payload configuration (external system)
│   │   ├── package.json              # exports ./config ./published
│   │   ├── migrations/
│   │   └── src/
│   │       ├── payload.config.ts
│   │       ├── payload-types.ts      # generated
│   │       ├── collections/products.ts
│   │       ├── collections/media.ts
│   │       ├── collections/users.ts
│   │       ├── collections/outbox-messages.ts
│   │       ├── hooks/bump-revision.ts
│   │       ├── hooks/write-product-outbox.ts
│   │       ├── admin/stock-level-field.tsx
│   │       ├── published/product-changed.v1.ts
│   │       └── published/index.ts
│   ├── shop/
│   │   ├── package.json              # exports ./published ./builder ./next
│   │   ├── GLOSSARY.md
│   │   ├── conformance.json
│   │   ├── drizzle.config.ts
│   │   ├── migrations/0000_init.sql
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── tsconfig.json     # lib ES2023, types [], no DOM
│   │   │   │   ├── ids.ts
│   │   │   │   ├── instant.ts
│   │   │   │   ├── address.ts
│   │   │   │   ├── customer.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── catalog-entry.ts
│   │   │   │   ├── stock-availability.ts
│   │   │   │   ├── dunning-status.ts
│   │   │   │   ├── order-line.ts
│   │   │   │   ├── order.ts
│   │   │   │   ├── payment-method.ts
│   │   │   │   ├── checkout-policy.ts       # placeOrder, pay-by-invoice offer
│   │   │   │   ├── payment-deadline.ts      # 30 minutes
│   │   │   │   ├── late-payment.ts
│   │   │   │   ├── fulfilment-outcomes.ts   # shortfall, booking refused
│   │   │   │   ├── accepted-staleness.ts
│   │   │   │   ├── mail.ts                  # sender, confirmation mail repeat accepted
│   │   │   │   └── replica-versions.ts      # keep-highest
│   │   │   ├── service/
│   │   │   │   ├── ports/tx.ts
│   │   │   │   ├── ports/delivered.ts
│   │   │   │   ├── ports/driving.ts
│   │   │   │   ├── ports/driven.ts
│   │   │   │   ├── messages/private.ts      # private message schemas
│   │   │   │   ├── to-published.ts          # domain → shop's published language
│   │   │   │   ├── handle-once.ts
│   │   │   │   ├── storefront.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── checkout.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── replicas.ts
│   │   │   │   ├── payment-outcomes.ts
│   │   │   │   ├── payment-deadline.ts
│   │   │   │   ├── fulfilment-outcomes.ts
│   │   │   │   ├── confirmation-mail.ts
│   │   │   │   ├── page-cache.ts
│   │   │   │   ├── backoffice.ts
│   │   │   │   └── create-shop-services.ts
│   │   │   ├── published/
│   │   │   │   ├── index.ts
│   │   │   │   ├── order-placed.v1.ts
│   │   │   │   ├── order-paid.v1.ts
│   │   │   │   ├── order-ready-for-shipment.v1.ts
│   │   │   │   ├── order-cancelled.v1.ts
│   │   │   │   └── order-shipped.v1.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/drizzle/schema.ts
│   │   │   │   ├── driven/drizzle/transactions.ts
│   │   │   │   ├── driven/drizzle/carts.ts
│   │   │   │   ├── driven/drizzle/orders.ts
│   │   │   │   ├── driven/drizzle/customers.ts
│   │   │   │   ├── driven/drizzle/catalog-replica.ts
│   │   │   │   ├── driven/drizzle/stock-replica.ts
│   │   │   │   ├── driven/drizzle/dunning-replica.ts
│   │   │   │   ├── driven/drizzle/storefront-queries.ts
│   │   │   │   ├── driven/drizzle/order-queries.ts
│   │   │   │   ├── driven/drizzle/outbox.ts
│   │   │   │   ├── driven/drizzle/handled-messages.ts
│   │   │   │   ├── driven/payment-system/card-payments.ts
│   │   │   │   ├── driven/payment-system/payment-requests.ts
│   │   │   │   ├── driven/mail/mail-provider-mailer.ts
│   │   │   │   ├── driven/page-cache/revalidating-page-cache.ts
│   │   │   │   ├── driven/page-cache/revalidate-route.ts    # far side of the adapter, served by web
│   │   │   │   ├── driven/memory/*.ts                       # one fake per driven port
│   │   │   │   ├── driving/next/courier.ts
│   │   │   │   ├── driving/next/index.ts                    # the ./next export
│   │   │   │   ├── driving/next/storefront-page.tsx
│   │   │   │   ├── driving/next/product-page.tsx
│   │   │   │   ├── driving/next/cart-page.tsx
│   │   │   │   ├── driving/next/checkout-page.tsx
│   │   │   │   ├── driving/next/actions.ts
│   │   │   │   ├── driving/next/admin-orders-page.tsx
│   │   │   │   ├── driving/next/admin-order-page.tsx
│   │   │   │   ├── driving/handlers/cms/catalog-product-changed.ts
│   │   │   │   ├── driving/handlers/fulfillment/stock-availability-changed.ts
│   │   │   │   ├── driving/handlers/fulfillment/stock-shortfall.ts
│   │   │   │   ├── driving/handlers/fulfillment/shipment-dispatched.ts
│   │   │   │   ├── driving/handlers/fulfillment/shipment-booking-refused.ts
│   │   │   │   ├── driving/handlers/billing/dunning-status-changed.ts
│   │   │   │   ├── driving/handlers/billing/invoice-paid.ts
│   │   │   │   ├── driving/handlers/payment/card-payment-succeeded.ts
│   │   │   │   ├── driving/handlers/payment/card-payment-refunded.ts
│   │   │   │   ├── driving/handlers/payment/card-refund-refused.ts
│   │   │   │   ├── driving/handlers/private/expire-order-payment.ts
│   │   │   │   ├── driving/handlers/private/send-order-confirmation.ts
│   │   │   │   ├── driving/handlers/private/revalidate-product-pages.ts
│   │   │   │   └── driving/scheduled/payment-deadline-task.ts
│   │   │   └── builder/
│   │   │       ├── index.ts
│   │   │       ├── config.ts
│   │   │       ├── build-for-web.ts
│   │   │       └── build-for-worker.ts
│   │   └── test/
│   │       ├── domain/order.test.ts
│   │       ├── domain/checkout-policy.test.ts
│   │       ├── domain/payment-deadline.test.ts
│   │       ├── service/checkout.test.ts
│   │       ├── service/payment-outcomes.test.ts
│   │       ├── service/payment-deadline.test.ts
│   │       ├── contracts/orders.contract.ts
│   │       ├── contracts/carts.contract.ts
│   │       ├── contracts/catalog-replica.contract.ts
│   │       ├── contracts/handled-messages.contract.ts
│   │       ├── contracts/outbox.contract.ts
│   │       ├── adapters/driven/memory/orders.test.ts         # runs the contract on the fake
│   │       ├── adapters/driven/drizzle/orders.int.test.ts    # runs it on Postgres migrated by migrations/
│   │       ├── adapters/driven/payment-system/card-payments.test.ts  # contract on payment's offer fake
│   │       └── adapters/driving/handlers/payment/card-payment-succeeded.test.ts
│   ├── payment/
│   │   ├── package.json              # exports ./published ./offer ./builder ./next
│   │   ├── GLOSSARY.md
│   │   ├── conformance.json
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── domain/{tsconfig.json,ids.ts,card-payment.ts,refund.ts,expiry.ts,refundability.ts,unconfirmed-intent.ts,double-refund-race.ts}
│   │   │   ├── service/{ports/*.ts,messages/private.ts,to-published.ts,handle-once.ts,request-card-payment.ts,provider-notifications.ts,refunds.ts,cancellation.ts,expiry.ts,backoffice.ts,create-payment-services.ts}
│   │   │   ├── published/{index.ts,card-payment-request.v1.ts,card-payment-status.v1.ts,refund-card-payment.v1.ts,cancel-card-payment.v1.ts,card-payment-succeeded.v1.ts,card-payment-cancelled.v1.ts,card-payment-refunded.v1.ts,card-refund-refused.v1.ts}
│   │   │   ├── offer/{index.ts,open-host.ts,fake.ts}
│   │   │   ├── adapters/driven/{drizzle/*.ts,stripe/stripe-payment-provider.ts,memory/*.ts,memory/fake-payment-provider.ts}
│   │   │   ├── adapters/driving/{next/courier.ts,next/index.ts,next/stripe-webhook-route.ts,next/admin-payments-page.tsx,next/actions.ts,handlers/commands/*.ts,handlers/private/*.ts,scheduled/expiry-task.ts}
│   │   │   └── builder/{index.ts,config.ts,build-for-web.ts,build-for-worker.ts}
│   │   └── test/{domain/,service/,contracts/payment-provider.contract.ts,contracts/payments.contract.ts,adapters/driven/stripe/stripe-payment-provider.e2e.test.ts,adapters/driven/memory/,offer/open-host.test.ts}
│   ├── billing/
│   │   ├── package.json              # exports ./published ./builder ./next
│   │   ├── GLOSSARY.md
│   │   ├── conformance.json
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── domain/{tsconfig.json,ids.ts,tax-class.ts,vat.ts,invoice.ts,invoice-number-series.ts,credit-note.ts,credit-note-number-series.ts,invoiceable-order.ts,incoming-transfer.ts,transfer-matching.ts,customer-dunning.ts,dunning-run.ts,business-date.ts,due-date.ts,mail.ts}
│   │   │   ├── service/{ports/*.ts,messages/private.ts,to-published.ts,handle-once.ts,invoicing.ts,credit-notes.ts,transfers.ts,dunning.ts,mailing.ts,backoffice.ts,create-billing-services.ts}
│   │   │   ├── published/{index.ts,customer-dunning-status-changed.v1.ts,invoice-paid.v1.ts}
│   │   │   ├── adapters/driven/{drizzle/*.ts,pdf/pdfkit-invoice-documents.ts,mail/mail-provider-mailer.ts,memory/*.ts}
│   │   │   ├── adapters/driving/{next/courier.ts,next/index.ts,next/admin-invoices-page.tsx,next/admin-transfers-page.tsx,next/actions.ts,handlers/shop/*.ts,handlers/payment/card-payment-refunded.ts,handlers/private/*.ts,scheduled/bank-poll-task.ts,scheduled/bank-client.ts,scheduled/dunning-task.ts}
│   │   │   └── builder/{index.ts,config.ts,build-for-web.ts,build-for-worker.ts}
│   │   └── test/{domain/vat.test.ts,domain/invoice-number-series.test.ts,domain/customer-dunning.test.ts,service/,contracts/,adapters/}
│   └── fulfillment/
│       ├── package.json              # exports ./published ./offer ./builder ./next
│       ├── GLOSSARY.md
│       ├── conformance.json
│       ├── drizzle.config.ts
│       ├── migrations/
│       ├── src/
│       │   ├── domain/{tsconfig.json,ids.ts,stock.ts,order-allocation.ts,shipment.ts,article.ts,dispatch-deadline.ts}
│       │   ├── service/{ports/*.ts,messages/private.ts,to-published.ts,handle-once.ts,allocation.ts,shipments.ts,articles.ts,warehouse-notifications.ts,stock-counts.ts,stock-levels.ts,create-fulfillment-services.ts}
│       │   ├── published/{index.ts,stock-level.v1.ts,stock-availability-changed.v1.ts,stock-shortfall.v1.ts,shipment-dispatched.v1.ts,shipment-booking-refused.v1.ts}
│       │   ├── offer/{index.ts,open-host.ts,fake.ts}
│       │   ├── adapters/driven/{drizzle/*.ts,warehouse/warehouse-client.ts,memory/*.ts,memory/fake-warehouse.ts}
│       │   ├── adapters/driving/{next/courier.ts,next/index.ts,next/warehouse-webhook-route.ts,next/stock-levels-route.ts,next/admin-shipments-page.tsx,next/admin-stock-page.tsx,next/actions.ts,handlers/shop/*.ts,handlers/cms/product-changed.ts,handlers/private/*.ts,scheduled/dispatch-check-task.ts}
│       │   └── builder/{index.ts,config.ts,build-for-web.ts,build-for-worker.ts}
│       └── test/{domain/stock.test.ts,domain/order-allocation.test.ts,service/,contracts/warehouse.contract.ts,adapters/driven/warehouse/warehouse-client.e2e.test.ts,...}
└── tooling/
    ├── db/roles.sql
    ├── check-migrations.ts           # CI: no DROP/RENAME without a "contract" marker, no CHECK/TRIGGER
    ├── check-foreign-names.ts        # CI (ts-morph): upstream PL imported only as a namespace
    └── check-no-domain-doubles.ts    # CI: no vi.mock of a path under /domain/
```

## How each property holds

**P1.** Each system's `src/domain/` has its own `tsconfig.json` with `"lib": ["ES2023"]`, `"types": []` and no DOM, so
`Buffer`, `process`, `window` and `node:*` fail to compile there. dependency-cruiser rule `domain-allowlist`: a module
under `packages/*/src/domain/` may import only its own domain, `zod` and `@tea/money`; type-only imports are counted
(`tsPreCompilationDeps: true`). No system conforms to an upstream (`conformance.json`), so no upstream published
language is on the list; Payload's generated `payload-types.ts`, Stripe's types and Drizzle's row types never reach a
domain. Time and ids enter domain functions as arguments (`Order.place({ ..., now, orderId })`). Business dates use
`Intl.DateTimeFormat` with the zone `"Europe/Berlin"` stated as a domain constant, which is ES2023 and loads on every
runtime.

**P2.** Every business rule of a system is one function or constant in its domain: shop `paymentDeadlineFor(placedAt)`
(30 min), `payByInvoiceOffered(status)`, `latePaymentResponse`, `fulfilmentOutcomeResponse`; payment
`refundability`, `expiryFor` (60 min); billing `vatRateFor(taxClass, date)` (tea 7 %, accessories 19 % from
2007-01-01, a dated table), `dueDateFor(shippedAt)` (+14 days), `dunningStageFor`, `inDunning(stage)` (stage >= 1),
`matchTransfer`; fulfillment `Stock.reserve`, `dispatchDeadlineFor`. Record shapes are zod schemas in the domain with
types inferred; Drizzle adapters parse rows with them and server actions parse input with them. Code elsewhere asks:
`getCheckoutOptions` asks the domain the same function `checkout` uses; shop reads billing's `inDunning`, never a stage
number. Migrations hold keys only: `tooling/check-migrations.ts` rejects `CHECK` and `TRIGGER`. Tests use real domain
modules (`tooling/check-no-domain-doubles.ts`). "Price above zero" and "sku unique" are Payload's configuration's own
rules about Payload's records; no system states them again. Published languages restate contract constraints
(`quantity` positive) under P13's MAY.

**P3.** Each rule sits in the domain of the owner of the record it decides: payment deadline, pay-by-invoice offer,
readiness for shipment and line snapshots in shop (`Order`); VAT, numbering, dunning and what "in dunning" means in
billing; refundability in payment; reservation and booking in fulfillment. Commands carry only what the sender's own
rules decide about its request (shop's `RefundCardPayment` carries `amount` and `reason`; payment decides whether).
`@tea/money` holds `Money` and its rounding only. `@tea/kit` holds no schema of any system; its envelope is untyped
above `payload: unknown`.

**P4.** Services compute from driving-port arguments and driven-port returns only: the clock and ids are ports; the
customer id, locale and addresses are arguments filled by the driving adapter; business numbers are domain constants,
never configuration. Driven adapters use configuration only to reach their outside (URLs, keys, account ids); the
mail sender address is `shop/domain/mail.ts`'s constant passed in the mail, not configuration; adapters store and
pass instants as UTC ISO strings and never read `TZ`. Every driving adapter makes at most one acting call: the bank
poll makes one per transfer, each its own call it handles (S3); sweeps make one acting call that writes one private
message per item. UI guards (hiding pay by invoice) are repeated by the service, which decides afresh. The only ambient
values are telemetry (OTel context, logger), which no service reads to decide.

**P5.** Services import only their own ports, domain, published language, `@tea/money`, `zod` and
`@tea/kit/telemetry` (dependency-cruiser `service-reach`); driven adapters additionally their one outside library each
(`drizzle-orm`+`pg` for Drizzle adapters, `stripe` only in `stripe/`, `fetch` in HTTP clients). Ports are written in
the system's terms (`Orders.save(tx, order)`, never a SQL string). Every implementation, client and configuration value
reaches a system through its builder, called only by `apps/*/src/assembly/build-*.ts`; `process.env` is read only in
`apps/*/src/assembly/config.ts` (Biome `noProcessEnv`). Driving adapters the framework constructs read their system's
courier on each run; only the system's builder (assembly's part) fills it. Package `exports` make anything outside the
offer and `./next` unresolvable from other packages; dependency-cruiser restricts `@tea/<sys>/next` to
`apps/web/src/app/**/<sys>/**` and `(shop)/**` for shop, and `@tea/<sys>/builder` to `apps/*/src/assembly/**`.
Telemetry is the one ready-made import, and it changes no answer.

**P6.** Every driven port has an in-memory fake in the declaring system's `src/adapters/driven/memory/`; payment and
fulfillment export fakes of their open host services in their offers, built from their real services on in-memory
adapters. Service tests run on fakes only and are in the default suite. Each driven port has one contract suite in
`test/contracts/<port>.contract.ts` (`describePortContract(name, makeImpl)` from `@tea/kit/testing`), run on the fake in
the default suite and on the real adapter in `*.int.test.ts` against a Postgres testcontainer migrated by the system's
real `migrations/`, or in `*.e2e.test.ts` against Stripe test mode, the 3PL sandbox and the mail provider sandbox.
The contracts assert what service tests rely on: a stale save fails, a duplicate key fails, a handled-message
record conflicts on repeat, `refund` on a disputed charge returns `declined`. Telemetry uses the OTel API (no-op
without an SDK) and pino to stdout; no module opens a pool or connection when loaded.

**P7.** `Transactions.run` is opened by the service once per acting use case; every writing driven port method takes
the `Tx` as a required first parameter; Drizzle adapters resolve it through the `TxRegistry` and never touch the pool
directly (dependency-cruiser forbids `pool.ts` imports in repositories; the pool is injected only into
`DrizzleTransactions` and query adapters). Checkout writes order, cart and outbox rows in one transaction; transfer
application writes transfer, invoice, dunning and outbox rows in one. A service module may not import another use-case
module of its system (dependency-cruiser `no-service-to-service`); shared steps live in the domain. A thrown error
rolls back the whole transaction; no savepoints are used.

**P8.** Every message goes through the `Outbox` port inside the use case's transaction. The relay marks a row only after
`boss.publish` resolves; pg-boss keeps jobs in Postgres across stops, retries with backoff and parks in
`dead-letters` without deleting; each consumer completes its job only when the handler's acting call returns, and a
thrown error fails the job. Hooks answer 2xx only after their use case returned. Executors (mail, Stripe refund and
cancel, 3PL booking and article upsert, page revalidation) decide nothing: they act on what the committed message says
and record the answer. The one tentative operation is the Stripe PaymentIntent, created by payment beside its
transaction and confirmed only by the browser after shop's commit. Payload tells of product changes through its own
outbox row written in its own transaction (`req` passed to `payload.create`), so no change reaches a system before
Payload commits; Stripe and the 3PL call hooks with committed facts.

**P9.** Every acting use case called for a message runs through `handleOnce(tx, handled, messageId, work)`: it reads
`handled_messages` first and returns the stored outcome on a repeat; otherwise it runs and inserts
`(message_id, outcome)` in the same transaction, so an overlapping repeat fails at commit on the primary key and its
redelivery finds the claim. Message ids: outbox `uuidV7` for ours, Stripe event id, 3PL event id, `bank:{transferId}`,
deterministic ids for sweep messages. Outside changes carry keys from the message: Stripe `payment:{paymentId}`,
`cancel:{paymentId}`, `refund:{refundId}` (plus a lookup by `metadata.refundId` before creating, since Stripe keeps
keys 24 h); 3PL `externalReference = shipmentId`, article upsert by sku (a PUT). The mail provider takes no key:
`shop/domain/mail.ts` and `billing/domain/mail.ts` state that a repeated mail is accepted.

**P10.** Every aggregate has a `version` column; `save` runs `UPDATE ... WHERE id = $1 AND version = $2` and throws
`StaleAggregate` on zero rows; a new aggregate's insert throws it on a key conflict. Use cases read through the `Tx`
they write with. Data decided on that this store cannot fail on is read only through methods that require a
`StalenessRule` from the domain: catalog price (the order keeps the price the replica held), stock availability
(fulfillment's reservation decides; a shortfall cancels), dunning status (a customer entering dunning in the last
seconds may still order on invoice; dunning continues on the invoice), and payment's status at the deadline (a payment
arriving after the check is handled as a late payment). Boundaries: `Stock` per product holds its reservations, so
orders of different teas never conflict; `InvoiceNumberSeries` per year serialises issuing, as gapless numbering
requires; `CustomerDunning` per customer; no statistics in any use case. No use case retries itself; a lost race
throws and the bus redelivers.

**P11.** One Postgres schema and one login role per system; each pool connects with its role, which has privileges on
its own schema only, so a cross-schema join or write fails at the store. Other systems' data is read only through open
host services (payment, fulfillment) or published events into replicas; changed only through payment's commands.
Payload owns the products and its configuration writes only Payload's tables; its admin reads stock through
fulfillment's route. No external system keeps a record a system of this codebase owns, so the second sentence has
nothing to configure (S1).

**P12.** Every system has `conformance.json` naming each upstream and `"translates"` for each; all four are
anti-corruption layers. `.dependency-cruiser.cjs` is generated from these files: an upstream's published language
(`@tea/<other>/published`, `@tea/<other>/offer`, `@tea/cms/published`, `stripe`) may be imported only from the
listed adapter directories (`adapters/driven/<upstream>-system/`, `adapters/driving/handlers/<upstream>/`, the hook and
driven adapter for an external upstream). A `published/` module may import only `zod`, `@tea/money` and
`@tea/kit/message-def`; `@tea/money` imports nothing.

**P13.** Other packages can resolve only `./published`, `./offer` and `./builder` of a system (plus `./next` for the
web app's route files, which are that system's own modules). A `published/` module imports nothing of its system
(dependency-cruiser `published-isolated`); `service/to-published.ts` translates domain values to it, so a model change
breaks that file's compilation, not a downstream. No generator writes into `published/`. Every message and every
open-host return is a published-language value, never an aggregate. Contract constraints are restated there in the
contract's own terms (`quantity: z.number().int().positive()`).

**P14.** One schema per message, declared once with `defineMessage({ type, version, schema })` in the writer's
`published/` (or `service/messages/private.ts`, or `@tea/cms/published`); writer (`DrizzleOutbox`) and every handler
parse with it. The envelope carries `type` and `version`; handlers subscribe per pair. Compatible change (judged by
what an old reader would read as true): add an optional field. Otherwise a new version, written beside the old one by
the writer until every subscriber of the old one has moved and `dead-letters` holds none. Records: expand/contract
migrations, readers deployed before writers; repositories `UPDATE` only the columns they know, and no aggregate state
lives in `jsonb`, so an old process does not drop a new column; `tooling/check-migrations.ts` refuses a drop or rename
without a `contract` marker. Fulfillment's stock-levels route, called from another process, is versioned in its path
(`/v1/`). Payment's open host service is called in-process only, so it is outside this property's scope.

**P15.** Only three waits exist: card checkout on payment and Stripe (the customer pays now); the payment deadline
reconciliation on payment and Stripe (the business rule asks at the deadline); executors on the system their message
asks to act. Everything else reads replicas in its own schema (catalog, stock availability, dunning status) or
snapshots (order lines, `InvoiceableOrder` lines), and asks for action by messages. Invoice checkout, cart, browsing,
dunning and invoicing work while Stripe, payment's provider, the 3PL, the bank or the mail provider is down.

**P16.** Each pool's role sees one schema, so a transaction reads and writes one owner's records. `Tx` is an opaque
token per system and travels only as an argument; `AsyncLocalStorage` carries only telemetry context. No driving port
type mentions `Tx`, a pool or a Drizzle type (dependency-cruiser: `ports/driving.ts` and `offer/` may not import
`ports/tx.ts`, `drizzle-orm` or `pg`). Shop's call to payment is made with no transaction argument, and payment opens
its own. No system calls Payload's Local API, so no `req` crosses.

**P17.** Every waiting part holds its deadline in its own aggregate and ends by a domain rule. Shop: `Order.paymentDeadline`;
at the deadline paid → `OrderPaid`, else cancel and ask payment to cancel; late payment → refund requested; refund
refused → `latePaymentKept` (accepted, shown to operations); shortfall or booking refused → cancel, plus a refund if
paid. Payment: `CardPayment.expiresAt` → reconcile with Stripe, record success or cancel the intent; an intent created
but never recorded is accepted as giving nothing (`unconfirmed-intent.ts`); refunds pending at Stripe are reconciled at
the same sweep. Fulfillment: `Shipment.dispatchBy` → `checkDispatch` asks the 3PL, records dispatch or marks
`dispatchOverdue` for operations (accepted). Billing: unpaid invoices end through dunning stages to `collection`
(accepted); unmatched transfers end as `unmatched` for manual assignment (accepted); a refund for an order not yet
invoiced waits on `InvoiceableOrder` and is credited when the invoice is issued. Refusals are committed and published
(`CardRefundRefused`, `StockShortfall`, `ShipmentBookingRefused`); adapters return a `refused`/`declined` union for a
business answer and throw for everything else.

**P18.** Every published event carries the version of the thing it tells of (the aggregate's version, raised in the
committing transaction; Payload's configured `revision`). Replicas (`catalog_entries`, `stock_availability`,
`dunning_statuses`) keep the highest version and drop lower ones. Non-overriding messages are applied by meaning:
fulfillment's `OrderAllocation` records a cancel that arrives before its order (`cancelledBeforePlaced`) and a
ready-for-shipment that arrives first creates the allocation from its own lines; billing's `InvoiceableOrder` records
`OrderPaid`, `OrderShipped` and refunds before `OrderPlaced` and issues once the lines arrive; shop's
`recordCardPaymentSucceeded` fails on an unknown order and is redelivered. Different writers about one order (payment's
success, shop's own deadline) are settled by shop's `latePaymentResponse`. Stripe notifications carry no version:
`CardPayment` states only move forward.

**P19.** Each system has `GLOSSARY.md`, the register of its terms; a term is added there before code uses it. Words
from other systems are kept apart by name: billing's `InvoiceableOrder`, fulfillment's `OrderAllocation` and
`OrderRef`, shop's `CatalogEntry` for Payload's product, payment's `ProviderNotification` for a Stripe event (so
"event" keeps the architecture's meaning). Upstream published languages and Stripe's types are imported only as
namespaces (`import * as shopPl from "@tea/shop/published"`, `Stripe.PaymentIntent`), checked by
`tooling/check-foreign-names.ts`.

## Decisions the document left to me

- **D1. System cut.** Chose `shop`, `payment`, `billing`, `fulfillment`, with Payload as an external owner of products.
  Would also hold: `payment` folded into `shop`; a `catalog` system owning products with Payload as keeper.
- **D2. Product ownership.** Chose Payload as the products' owner; price above zero and sku unique are its
  configuration's rules. Would also hold: a `catalog` system owning them, Payload reaching catalog's domain through a
  `beforeChange` hook (veto) and catalog's use cases as the only writers (needs custom admin fields calling catalog).
- **D3. Repository layout.** Chose a pnpm workspace with one package per system, the offer enforced by package
  `exports`. Would also hold: one package with path-based lint rules only.
- **D4. Bus.** Chose pg-boss on the same Postgres (schema `pgboss`), one queue per subscribing handler, retry limit 10
  with backoff, `dead-letters` queue. Would also hold: RabbitMQ or NATS JetStream with durable queues.
- **D5. Relay.** Chose polling every 500 ms in the worker under an advisory lock, marking after publish. Would also
  hold: `LISTEN/NOTIFY` wake-ups; publishing to pg-boss in the same transaction as marking.
- **D6. Outbox placement.** Chose one `outbox` table per system schema. Would also hold: a field on each changed record.
- **D7. Store layout.** Chose one Postgres, one schema and one login role per system, plus `payload` and `pgboss`.
  Would also hold: one role for all, with P11 enforced by lint only.
- **D8. Transaction port.** Chose an opaque per-system `Tx` token mapped to the Drizzle transaction in a `WeakMap`,
  required on every writing port method. Would also hold: a unit-of-work object exposing repositories bound to it.
- **D9. Concurrency.** Chose optimistic `version` columns on every aggregate. Would also hold: `SELECT ... FOR UPDATE`
  on load.
- **D10. Repeat detection.** Chose `handled_messages(message_id PK, outcome jsonb)`, read first, inserted with the
  writes. Would also hold: insert-first `ON CONFLICT DO NOTHING` inside the transaction; record-based detection only.
- **D11. Early messages.** Chose recording the early message in the receiving aggregate in fulfillment and billing,
  and fail-and-redeliver in shop's payment handler. Would also hold: fail-and-redeliver everywhere.
- **D12. Choreography.** Chose choreography (each system reacts to the others' events; shop sends payment two
  commands). Would also hold: an `OrderProcess` process manager in shop issuing commands to fulfillment and billing.
- **D13. Checkout's synchronous call.** Chose shop calling payment's open host service in-process, inside shop's open
  transaction but carrying none, before saving the order. Would also hold: calling before opening the transaction and
  re-reading the cart inside.
- **D14. Payment creates the intent first, then records it.** Chose Stripe call, then one transaction; an intent
  without a record is accepted as giving nothing. Would also hold: calling Stripe while payment's transaction is open,
  carrying none.
- **D15. Business numbers.** Chose payment deadline 30 min, unconfirmed intent expiry 60 min, invoice due 14 days after
  shipment, dunning stages at 7/21/35 days overdue, dispatch deadline 3 days after booking, all domain constants.
  Would also hold: any numbers, or records changed by a use case.
- **D16. Invoice orders.** Chose ready for shipment at placement, invoice issued on `OrderShipped`. Would also hold:
  invoice issued at placement with the due date set on shipment.
- **D17. Billing's order data.** Chose `InvoiceableOrder` built from `OrderPlaced` (snapshot lines). Would also hold:
  the lines carried on `OrderPaid` and `OrderShipped` instead, with no early-message bookkeeping.
- **D18. Sweeps.** Chose one acting call per tick that writes one private message per item (dunning, payment deadline,
  payment expiry, dispatch check). Would also hold: a batch use case per tick in one transaction (rejected: unrelated
  items would fail each other).
- **D19. Bank.** Chose polling every 5 min over a 3-day window, no cursor, repeats absorbed by message id. Would also
  hold: a stored cursor; a bank webhook if offered.
- **D20. Stock source.** Chose stock counts entered by staff on the admin dashboard; stock keyed by Payload product id.
  Would also hold: a 3PL stock webhook; keying by sku.
- **D21. Article registration.** Chose upserting each line's article at the 3PL before every booking, plus
  registration on product change. Would also hold: holding shipments until articles are registered.
- **D22. 3PL idempotency.** Chose `externalReference = shipmentId`, 409 read as booked. Would also hold: a
  `consignmentStatus` lookup before booking, the remaining race accepted by a rule.
- **D23. Mail repeats.** Chose a domain rule accepting a repeated mail (shop, billing). Would also hold: a provider
  idempotency header where the provider has one.
- **D24. Couriers.** Chose one courier per system on `globalThis[Symbol.for(...)]`, filled by the system's web
  builder from `instrumentation.ts`, read per invocation. Would also hold: a module variable if Next.js shared module
  graphs.
- **D25. Where Next.js-facing adapters live.** Chose inside each system package (`adapters/driving/next/`), exported
  as `./next` and re-exported by one-line files under `apps/web/src/app/**/<sys>/`. Would also hold: the code in
  `apps/web` directly, owned by the system by directory.
- **D26. Offer fakes.** Chose the upstream's real services on its in-memory adapters. Would also hold: a hand-written
  table-driven fake run by the upstream's suite.
- **D27. Contract runs.** Chose testcontainers Postgres migrated by real migrations for `*.int.test.ts`; Stripe test
  mode, 3PL and mail sandboxes for `*.e2e.test.ts`. Would also hold: a shared CI database.
- **D28. Boundary checks.** Chose dependency-cruiser (generated from `conformance.json`) plus per-layer tsconfig and
  three ts-morph scripts. Would also hold: ESLint `import/no-restricted-paths`.
- **D29. Conformance record.** Chose `conformance.json` per system listing every upstream, all `"translates"`. Would
  also hold: a section in `GLOSSARY.md`; payment conforming to Stripe.
- **D30. Message format.** Chose zod schemas via `defineMessage`, an envelope with `type`, `version`, `headers`,
  `uuidV7` ids; subscriptions per type and version. Would also hold: JSON Schema with a registry.
- **D31. Record evolution.** Chose expand/contract, column-scoped updates, no `jsonb` aggregate state. Would also hold:
  a record `schema_version` with upcasting on load.
- **D32. Page cache.** Chose `revalidateTag` through an internal HTTP route of `web`, called by shop's executor in the
  worker. Would also hold: running that executor inside `web`.
- **D33. Payload's outbox.** Chose a hidden Payload collection written in `afterChange`/`afterDelete` with `req`, and a
  `revision` number field. Would also hold: a pending record in shop confirmed by a read of Payload.
- **D34. Telemetry.** Chose OTel `NodeSDK` per process, W3C trace context and baggage `request.id` on envelope headers,
  pino `mixin`. Would also hold: a request id column on the outbox.
- **D35. Staleness rules as values.** Chose `StalenessRule<K>` branded domain values required by replica read methods.
  Would also hold: rules stated as domain comments and reviewed.
- **D36. Dashboard.** Chose per-system admin pages under `/admin/<sys>/`, no dashboard system. Would also hold: a
  `backoffice` system downstream of the three with replicas.
- **D37. Refunds.** Chose staff refunds through payment's admin action, partial amounts allowed up to the refundable
  remainder. Would also hold: refunds only of whole payments; refunds initiated from shop's order page by a command.
- **D38. Customers.** Chose customer accounts in shop (`Customer`), customer id from the session cookie. Would also
  hold: guest checkout keyed by email.
- **D39. Processes.** Chose `web`, `worker`, `migrate`. Would also hold: separate worker processes per system.
- **D40. Refusal vs failure in code.** Chose discriminated unions for refusals at every port; thrown errors for
  failures. Would also hold: typed error classes.
- **D41. Stock availability in shop.** Chose a replica from `StockAvailabilityChanged`. Would also hold: no
  availability in shop at all, shortfall cancelling afterwards.
- **D42. Invoice numbering.** Chose one gapless series per calendar year (`2026-000123`), credit notes in their own
  series. Would also hold: one series for all time.
- **D43. Domain library list.** Chose `zod` and `@tea/money` only. Would also hold: adding `date-fns`.

## Sentences I had to pick a reading for

- **S1.** P11 Statement: "Where an external system keeps a record a system of this codebase owns, this codebase MUST
  configure it so that nothing but the owner's use cases changes the record". Reading A: products are a system's
  records (their rules are the shop's), so Payload must be configured so editors cannot change them except through that
  system's use cases. Reading B: since the brief has editors change them in the admin, the owner is Payload and the
  sentence does not apply. Took B (backed by P11's Why: "the record is the external system's to own"). Changed: no
  `catalog` system; no veto hook; shop keeps a replica and snapshots.
- **S2.** P2 Why: "the business rules it holds are the external system's own where they decide a record the external
  system keeps and no business rule of this system decides." Reading A: "price above zero, sku unique" from the brief
  are business rules of the tea shop and must be in a domain. Reading B: they decide a record Payload owns and no rule
  of a system here decides it, so they are Payload's. Took B. Changed: `min: 1` and `unique: true` in
  `collections/products.ts`, nothing in any domain.
- **S3.** P4 Statement: "with at most one acting call per call it handles". Reading A: a polling scheduled task
  handles one call (the tick) and may make one acting call. Reading B: each polled item is a call it handles (P7 Why:
  "a scheduled task polling a bank hands each transfer on as a message of its own"). Took B for the bank poll (one
  acting call per transfer, message id from the bank) and A for sweeps over own state (one acting call that writes
  messages). Changed: `bankPollTask` loops; the sweeps do not.
- **S4.** P4 Statement: "Code behind a driven port MUST use an ambient value or a configuration value only to reach the
  outside it adapts, and in nothing it writes or returns." Reading A: the outbox adapter may not write the ambient trace
  context into the envelope. Reading B: telemetry is excluded (P4 Why: "Telemetry is no input ... nothing here refuses
  them"). Took B. Changed: `DrizzleOutbox` writes `traceparent`/`baggage` headers from the active context.
- **S5.** Same sentence, "in nothing it writes". Reading A: a mail's sender address from configuration is written
  content and refused. Reading B: it is how the adapter reaches the provider. Took A. Changed: sender is a constant in
  `shop/domain/mail.ts` and `billing/domain/mail.ts`, passed in the mail.
- **S6.** P10 Statement: "A decision on data whose change fails no transaction of this store MUST rest on a business
  rule". Reading A: a replica kept in this store can be made to fail the transaction (lock or version check), so it
  falls under the first sentence. Reading B: the staleness that matters is against the owner, which no transaction of
  this store sees (P10 Why: "a replica lags its owner"). Took B. Changed: replica reads take no lock and require a
  `StalenessRule`.
- **S7.** P9 Statement: "finding the first delivery's writes committed MUST commit nothing and return as the first
  delivery returned". Reading A: return the same kind of result (no error). Reading B: return the same value. Took B.
  Changed: `handled_messages.outcome jsonb` stores and replays the first outcome.
- **S8.** P17 Statement: "A refusal of a step MUST be committed as the step's outcome and reach the system that decided
  the step". Reading A: any refusal, including a synchronous call's. Reading B: a step of work spanning systems carried
  by a message; a synchronous refusal reaches the decider as the answer. Took B. Changed: `requestCardPayment` and
  staff refunds return refusals without a committed record being required; command-carried refusals are committed and
  published.
- **S9.** P17 Statement: "the moment it decides on none coming MUST be held in an aggregate of its own". Reading A: an
  aggregate of the waiting system. Reading B: a dedicated aggregate for the wait (a process record). Took A. Changed:
  deadlines are fields of `Order`, `CardPayment`, `Shipment`.
- **S10.** P12 Statement: "A system MUST record each upstream it conforms to". Reading A: record only conformances.
  Reading B: record the choice for every upstream. Took B. Changed: `conformance.json` lists every upstream with
  `"translates"`, so the lint rules can be generated from it.
- **S11.** P11 Statement: "MUST read it only through that open host service or the owner's published events". For
  Payload, Assumptions make "its API ... the open host service and its package the published language". Reading A:
  outbox messages we configured Payload to write are not Payload's API or package. Reading B: the configuration we
  write is part of Payload's package, so its message schema is Payload's published language. Took B. Changed:
  `@tea/cms/published` holds `ProductChangedV1`; shop and fulfillment handle it as an upstream's event.
- **S12.** Glossary: "Hook. A driving adapter an external system calls." Reading A: Payload's `afterChange` that writes
  the outbox is a hook, a driving adapter of some system. Reading B: it is Payload's configuration and calls no system.
  Took B. Changed: the hook is in `@tea/cms`, not in any system package, and reaches no driving port.
- **S13.** Assumptions: "It is no system of this codebase where a rule says one." Reading A: an external system is never
  counted where a rule says "system of this codebase". Reading B: it is no system of this codebase unless a rule says it
  is one. Took A. Changed: Payload's configuration is not bound by P11's first sentence as "code of a system".
- **S14.** P13 Statement: "of that only what is typed by its published language". Reading A: by type; the offer's fake
  is typed by the published language even though it loads the upstream's services. Reading B: by reach; nothing that
  loads the upstream's model. Took A (P13 Why: "a fake in a production process ... is not ruled here"). Changed: offer
  fakes are built from the real services.
- **S15.** P6 Statement: "on every other implementation against the outside it reaches in the deployed application,
  set up as it is there". Reading A: the live Stripe account and production 3PL. Reading B: the vendor's test mode or
  sandbox is that outside, set up as production is. Took B. Changed: `*.e2e.test.ts` against test mode and sandboxes,
  never run by default.
- **S16.** P14 Scope: "an open host service's driving port called from another process". Reading A: only system to
  system. Reading B: any caller in another process, including a browser running Payload's admin. Took B. Changed:
  `/api/fulfillment/v1/stock-levels` is versioned in its path.
- **S17.** P18 Statement: "Where a later message about one thing overrides an earlier". Reading A: messages carrying
  state (stage, availability, product data). Reading B: every message about the thing, including status transitions
  like `OrderPaid` after `OrderPlaced`. Took A for the replica-filling events and still put the aggregate version on
  every published event. Changed: replicas keep the highest version; transition events are applied by meaning.
- **S18.** P2 Statement: "with every value it decides by that is the same for every candidate". Reading A: one fixed
  number. Reading B: a dated table is the same for every candidate of a given date. Took B. Changed: VAT rates are a
  dated table in `billing/domain/vat.ts`.
- **S19.** Glossary: "There are as many driving adapters as there are ways into the process." Reading A: one per
  transport (the Next.js server, the bus). Reading B: one per route, action, handler, hook and task. Took B. Changed:
  each route file, action, handler and task is its own driving adapter reading the courier.
