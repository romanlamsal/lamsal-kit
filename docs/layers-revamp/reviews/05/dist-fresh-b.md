# Fresh repository draft B, distilled set (property rules)

Online tea shop, TypeScript 5.6 strict on Node 22, pnpm monorepo. One Postgres 16 instance, Drizzle ORM,
Payload CMS 3 (inside Next.js 15 App Router), Stripe, a 3PL HTTP API with webhooks, a bank HTTP API
polled for incoming transfers, a mail provider's HTTP API, pino, OpenTelemetry (OTLP to Jaeger),
`AsyncLocalStorage` (through OpenTelemetry's context manager only). Bus: `pg-boss` 10 on the same
Postgres. Tests: Vitest. Lint: ESLint (typescript-eslint, `@typescript-eslint/no-explicit-any: error`)
plus `dependency-cruiser` for reach.

## Systems and what each owns

| System | Kind | Owns (its business rules decide) | Keeps (where) |
|---|---|---|---|
| `shop` | system, core | `Order` (a cart is an `Order` in status `cart`; lines with price, sku, tax class snapshots; card payment state: payment ref, disputed flag, refund state; payment deadline) | Postgres schema `shop`: `orders`, `order_lines`, `order_refunds`; replica `catalog_items` (of Payload's products, owner Payload, keeper shop); replica `customer_standings` (of billing's dunning cases, keeper shop); `outbox`; `handled_messages` |
| `billing` | system, supporting | `Invoice`, `CreditNote`, `NumberSeries` (gapless counters per kind and year), `DunningCase` (one per debtor), `BankFeed` (poll cursor), `UnmatchedTransfer` | schema `billing`: `invoices`, `invoice_lines`, `credit_notes`, `credit_note_lines`, `number_series`, `dunning_cases`, `dunning_items`, `bank_feeds`, `unmatched_transfers`, `applied_transfers`; `outbox`; `handled_messages` |
| `fulfillment` | system, supporting | `FulfillmentOrder` (reservation lines, release flag, hold deadline, shipment booking and dispatch), `StockItem` (per sku: on-hand as last fetched from the 3PL, open reservations), `Article` (per sku: 3PL article-master registration) | schema `fulfillment`: `fulfillment_orders`, `fulfillment_lines`, `stock_items`, `stock_reservations`, `articles`; `outbox`; `handled_messages` |

External systems:

| External system | Runs | Owns | Reached by |
|---|---|---|---|
| Payload CMS | in the `web` process, its own pool, schema `payload` | `products` (copy, images, slug, price, sku, tax class, `version`), `media`, `users` (editors/operators). Price above zero (`min: 1` on `priceCents`) and sku unique (`unique: true`, sku not updatable after create) are Payload's own business rules, in its configuration (D2) | its admin UI (editors); its outbox `payload.cms_outbox`, written in its own transaction and relayed (D16); fulfillment's hook `stockFieldHook` it calls in-process |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | shop's `StripePaymentGateway` (driven adapter); Stripe calls shop's hook `/api/hooks/stripe` |
| 3PL | vendor | consignments, article master, physical inventory | fulfillment's `TplWarehouse` (driven adapter); 3PL calls fulfillment's hook `/api/hooks/tpl` |
| Bank | vendor | account transactions | billing's scheduled task `bankPoll` (driving adapter) |
| Mail provider | vendor | sent mails | `shop` and `billing` each through their own mailer port and adapter |

Shared kernel: `@tea/kernel-money` (`Money` in integer cents, currency `EUR`, `add`, `multiply`,
`allocate`, `roundHalfUp`, `netFromGross(gross, rateBasisPoints)`). Imported by the domains of `shop`
and `billing`; `fulfillment` needs none. It imports only `zod`.

Code that is no system:
- Common library: `@tea/messaging` (`Envelope`, `OutboxReader`, `Bus`, `MessageHandler`,
  `ScheduledTask`, `createRelay`, `createPgBossBus`, Drizzle helpers implementing outbox, handled-message
  and unit-of-work ports by shape, `StaleWrite`, `PredecessorMissing`), `@tea/courier`
  (`createCourier<T>(key)`), `@tea/telemetry` (`logger`, `tracer`, `startTelemetry`,
  `withRequestContext`, `runInMessageContext`, `injectTrace`, `metricsExporter`).
- Assembly: `apps/web/src/assembly.ts`, `apps/worker/src/assembly.ts`, and each system's
  `builder.ts` (the system builders). The Payload outbox reader is assembly's:
  `apps/worker/src/cms-outbox-reader.ts`.
- Probes: `apps/web/src/probes.ts`, `apps/worker/src/probes-server.ts` (`/health`, `/metrics`).
- Payload's configuration `packages/cms` is external-system configuration, code this codebase writes;
  it holds Payload's published language `@tea/cms/published`.
- Tooling: `tooling/migrate`, `tooling/eslint-plugin`, `tooling/test-support`, Payload type
  generation, `dependency-cruiser` config.

## Ports and adapters

Conventions for every system. `Tx` is an opaque object per system, a literal brand so that one
system's `Tx` is not assignable to another's; the Drizzle transaction behind it is found in a
`WeakMap` that only that system's Drizzle adapters read, and is removed when the transaction ends
(a write through a closed `Tx` throws). Every port that writes takes `Tx` as a required first
parameter. Repositories `save` with an optimistic version: insert when `version === 0`, otherwise
`UPDATE … WHERE id = $1 AND version = $2`, zero rows throws `StaleWrite`; the aggregate's version is
raised by one on each save. Query ports (answering use cases only) take no `Tx`.

```ts
// @tea/messaging (common library)
export type MessageId = string & { readonly __brand: 'MessageId' };
export interface Envelope {
  readonly id: MessageId; readonly type: string; readonly payload: unknown;
  readonly writtenAt: string; readonly notBefore: string | null;
  readonly trace: { readonly traceparent?: string; readonly baggage?: string };
}
export interface OutboxReader {
  readonly name: string;
  deliverBatch(limit: number, deliver: (batch: readonly Envelope[]) => Promise<void>): Promise<number>;
  prune(deliveredBefore: Date): Promise<number>;
}
export interface Bus { publish(envelope: Envelope): Promise<void> }
export interface MessageHandler {
  readonly queue: string; readonly subscribesTo: readonly string[];
  handle(envelope: Envelope): Promise<void>;
}
export interface ScheduledTask {
  readonly queue: string; readonly cron: string;
  run(tick: { readonly id: MessageId; readonly at: Date }): Promise<void>;
}
export type Delivered<T> = { readonly messageId: MessageId } & T;
export class StaleWrite extends Error {}
export class PredecessorMissing extends Error {}
```

### shop

```ts
// src/ports/driving.ts  (shop's own terms: domain types)
export interface ShopDrivingPorts {
  // answering
  catalog(): Promise<readonly CatalogEntry[]>;
  catalogEntry(slug: Slug): Promise<CatalogEntry | null>;
  viewCart(cartId: OrderId): Promise<CartView | null>;
  checkoutOptions(input: { cartId: OrderId; customerEmail: EmailAddress }): Promise<CheckoutOptions>;
  orderOverview(filter: OrderOverviewFilter): Promise<readonly OrderSummary[]>;
  orderDetail(orderId: OrderId): Promise<OrderDetail | null>;
  // acting, called by a caller
  setCartLine(input: { cartId: OrderId | null; productRef: ProductRef; quantity: Quantity }):
    Promise<{ ok: true; cartId: OrderId } | { ok: false; refusal: 'product-not-listed' | 'cart-closed' }>;
  placeOrder(input: { cartId: OrderId; customer: CustomerDetails; paymentMethod: PaymentMethod; locale: Locale }):
    Promise<
      | { ok: true; orderId: OrderId; payment: { kind: 'card'; clientSecret: ClientSecret } | { kind: 'invoice' } }
      | { ok: false; refusal: 'cart-empty' | 'cart-closed' | 'pay-by-invoice-not-offered' | 'product-not-listed' }
    >;
  requestRefund(input: { orderId: OrderId; requestedBy: OperatorRef }):
    Promise<{ ok: true; refundId: RefundId } | { ok: false; refusal: 'not-paid-by-card' | 'charge-disputed' | 'refund-exists' }>;
  // acting, called for a message
  syncCatalogItem(m: Delivered<CatalogItemChange>): Promise<void>;
  recordCustomerStanding(m: Delivered<StandingChange>): Promise<void>;
  recordCardPaymentSucceeded(m: Delivered<{ paymentRef: PaymentRef; orderId: OrderId; amount: Money }>): Promise<void>;
  recordChargeDisputed(m: Delivered<{ paymentRef: PaymentRef }>): Promise<void>;
  recordStockUnavailable(m: Delivered<{ orderId: OrderId; skus: readonly Sku[] }>): Promise<void>;
  recordOrderShipped(m: Delivered<{ orderId: OrderId; tracking: Tracking; shippedAt: Instant }>): Promise<void>;
  expireUnpaidOrder(m: Delivered<{ orderId: OrderId }>): Promise<void>;
  sendOrderConfirmation(m: Delivered<OrderConfirmationRequest>): Promise<void>;          // executor
  cancelCardPayment(m: Delivered<{ orderId: OrderId; paymentRef: PaymentRef }>): Promise<void>; // executor
  issueCardRefund(m: Delivered<CardRefundRequest>): Promise<{ providerRefundRef: ProviderRefundRef } | { refused: RefundRefusal }>; // executor
  revalidateCatalogPages(m: Delivered<{ slug: Slug | null }>): Promise<void>;           // executor
}

// src/ports/driven.ts
export interface Tx { readonly system: 'shop' }
export interface UnitOfWork { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export interface Orders { load(tx: Tx, id: OrderId): Promise<Order | null>; save(tx: Tx, order: Order): Promise<void> }
export interface CatalogItems {
  load(tx: Tx, ref: ProductRef): Promise<CatalogItem | null>;
  loadMany(tx: Tx, refs: readonly ProductRef[]): Promise<readonly CatalogItem[]>;
  save(tx: Tx, item: CatalogItem): Promise<void>;
}
export interface CustomerStandings { load(tx: Tx, id: CustomerId): Promise<CustomerStanding | null>; save(tx: Tx, s: CustomerStanding): Promise<void> }
export interface HandledMessages {
  isHandled(messageId: MessageId, consumer: ConsumerName): Promise<boolean>;
  claim(tx: Tx, messageId: MessageId, consumer: ConsumerName): Promise<'claimed' | 'already-handled'>;
}
export interface Outbox { write(tx: Tx, messages: readonly ShopOutgoing[]): Promise<void> }
export interface Clock { now(): Instant }
export interface Ids { orderId(): OrderId; messageId(): MessageId; refundId(): RefundId }
export interface PaymentGateway {
  openCardPayment(r: { orderId: OrderId; amount: Money; idempotencyKey: string }): Promise<{ paymentRef: PaymentRef; clientSecret: ClientSecret }>;
  cancelCardPayment(r: { paymentRef: PaymentRef; idempotencyKey: string }): Promise<'cancelled' | { refused: 'already-captured' }>;
  refundCardPayment(r: { paymentRef: PaymentRef; amount: Money; refundId: RefundId }): Promise<{ issued: ProviderRefundRef } | { refused: RefundRefusal }>;
  findRefund(r: { paymentRef: PaymentRef; refundId: RefundId }): Promise<ProviderRefundRef | null>;
}
export interface OrderMailer { sendConfirmation(mail: OrderConfirmationMail): Promise<void> }
export interface CatalogPageCache { invalidate(target: { slug: Slug | null }): Promise<void> }
export interface OrderQueries {
  cart(id: OrderId): Promise<CartView | null>;
  overview(filter: OrderOverviewFilter): Promise<readonly OrderSummary[]>;
  detail(id: OrderId): Promise<OrderDetail | null>;
}
export interface CatalogQueries { listed(): Promise<readonly CatalogEntry[]>; bySlug(slug: Slug): Promise<CatalogEntry | null> }
export interface StandingQueries { standing(id: CustomerId): Promise<CustomerStanding | null> }
```

Driven adapters (each with a fake in `src/fakes/driven/`):
`createDrizzleUnitOfWork(db)`, `DrizzleOrders`, `DrizzleCatalogItems`, `DrizzleCustomerStandings`,
`DrizzleOrderQueries`, `DrizzleCatalogQueries`, `DrizzleStandingQueries`; handled messages and outbox
from `@tea/messaging` helpers bound to shop's tables and shop's message codec (`src/messages/codec.ts`);
`SystemClock`, `UuidV7Ids`; `StripePaymentGateway(stripe: Stripe)` (Stripe's `idempotencyKey`
option; `refunds.list({ payment_intent })` filtered by `metadata.refundId`; a Stripe
`card_error`/`charge_disputed` maps to a refusal, a network error or 5xx is thrown as a failure);
`HttpOrderMailer(mailApi)`; `HttpCatalogPageCache(baseUrl, secret)` whose far side is the web route
`revalidate-route.ts` calling Next's `revalidateTag('catalog')` and `revalidateTag('product:'+slug)`.

Driving adapters: Next server actions `cart-actions.ts` (`setCartLineAction`), `checkout-actions.ts`
(`checkoutOptionsAction`, `placeOrderAction`); RSC loaders `catalog-loaders.ts` (cached with
`unstable_cache` under tags `catalog`, `product:<slug>`); `ops-orders.ts` (ops page loader, refund
action; identifies the operator with `payload.auth({ headers })` and passes `requestedBy`); hook
`stripe-webhook.ts` (`stripe.webhooks.constructEvent`, `payment_intent.succeeded` and
`charge.dispute.created`; other types answered 200 without a call); bus handlers `handlers.ts`
(`createShopHandlers(ports): readonly MessageHandler[]`). Courier: `shopCourier =
createCourier<ShopDrivingPorts>('tea.shop')`, read inside each action/route/loader call.

Outbox reader: `src/outbox-reader.ts` `createShopOutboxReader(db): OutboxReader`.

### billing

```ts
// src/ports/driving.ts
export interface BillingDrivingPorts {
  invoiceOverview(filter: InvoiceFilter): Promise<readonly InvoiceSummary[]>;
  unmatchedTransfers(): Promise<readonly UnmatchedTransferView[]>;
  bankFeedCursor(): Promise<BankCursor | null>;
  ingestBankTransfers(input: { from: BankCursor | null; to: BankCursor; transfers: readonly IncomingTransfer[] }):
    Promise<{ ok: true } | { ok: false; refusal: 'cursor-moved' }>;
  assignUnmatchedTransfer(input: { transferRef: BankTransferRef; invoiceNumber: InvoiceNumber; assignedBy: OperatorRef }):
    Promise<{ ok: true } | { ok: false; refusal: 'unknown-transfer' | 'already-assigned' | 'unknown-invoice' }>;
  openInvoice(m: Delivered<BillableOrderPlaced>): Promise<void>;
  markOrderPaid(m: Delivered<{ orderRef: OrderRef; paidAt: Instant }>): Promise<void>;
  markOrderDispatched(m: Delivered<{ orderRef: OrderRef; dispatchedAt: Instant }>): Promise<void>;
  voidPendingInvoice(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  assignNumber(m: Delivered<{ document: DocumentRef; series: SeriesKey }>): Promise<void>;
  issueInvoice(m: Delivered<{ invoiceId: InvoiceId; number: InvoiceNumber }>): Promise<void>;
  openCreditNote(m: Delivered<{ orderRef: OrderRef; refundRef: RefundRef; amount: Money; refundedAt: Instant }>): Promise<void>;
  issueCreditNote(m: Delivered<{ creditNoteId: CreditNoteId; number: CreditNoteNumber }>): Promise<void>;
  trackInvoiceForDunning(m: Delivered<OpenItem>): Promise<void>;
  settleDunningItem(m: Delivered<{ debtorId: DebtorId; invoiceId: InvoiceId }>): Promise<void>;
  startDunningRun(m: Delivered<{ at: Instant }>): Promise<void>;
  reviewDunningCase(m: Delivered<{ debtorId: DebtorId; runDate: CalendarDate }>): Promise<void>;
  applyIncomingTransfer(m: Delivered<{ transfer: IncomingTransfer; assignedInvoice: InvoiceNumber | null }>): Promise<void>;
  sendBillingMail(m: Delivered<BillingMailRequest>): Promise<void>;   // executor: invoice, credit note, dunning letter
}

// src/ports/driven.ts
export interface Tx { readonly system: 'billing' }
export interface UnitOfWork { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export interface Invoices {
  load(tx: Tx, id: InvoiceId): Promise<Invoice | null>;
  loadByOrder(tx: Tx, orderRef: OrderRef): Promise<Invoice | null>;
  loadByNumber(tx: Tx, number: InvoiceNumber): Promise<Invoice | null>;
  save(tx: Tx, invoice: Invoice): Promise<void>;
}
export interface CreditNotes { load(tx: Tx, id: CreditNoteId): Promise<CreditNote | null>; loadByRefund(tx: Tx, r: RefundRef): Promise<CreditNote | null>; save(tx: Tx, c: CreditNote): Promise<void> }
export interface NumberSeriesStore { load(tx: Tx, key: SeriesKey): Promise<NumberSeries | null>; save(tx: Tx, s: NumberSeries): Promise<void> }
export interface DunningCases {
  load(tx: Tx, id: DebtorId): Promise<DunningCase | null>;
  save(tx: Tx, c: DunningCase): Promise<void>;
  dueForReview(tx: Tx, runDate: CalendarDate): Promise<readonly DebtorId[]>;
}
export interface BankFeeds { load(tx: Tx): Promise<BankFeed | null>; save(tx: Tx, f: BankFeed): Promise<void> }
export interface UnmatchedTransfers { load(tx: Tx, r: BankTransferRef): Promise<UnmatchedTransfer | null>; save(tx: Tx, u: UnmatchedTransfer): Promise<void> }
export interface HandledMessages { /* as shop, Tx = billing.Tx */ }
export interface Outbox { write(tx: Tx, messages: readonly BillingOutgoing[]): Promise<void> }
export interface Clock { now(): Instant }
export interface Ids { invoiceId(): InvoiceId; creditNoteId(): CreditNoteId; messageId(): MessageId }
export interface BillingMailer { send(mail: InvoiceMail | CreditNoteMail | DunningLetter): Promise<void> }
export interface InvoiceQueries {
  overview(filter: InvoiceFilter): Promise<readonly InvoiceSummary[]>;
  unmatchedTransfers(): Promise<readonly UnmatchedTransferView[]>;
  bankFeedCursor(): Promise<BankCursor | null>;
}
```

Driven adapters: `createDrizzleUnitOfWork`, `DrizzleInvoices`, `DrizzleCreditNotes`,
`DrizzleNumberSeries`, `DrizzleDunningCases`, `DrizzleBankFeeds`, `DrizzleUnmatchedTransfers`,
`DrizzleInvoiceQueries`, messaging helpers, `SystemClock`, `UuidV7Ids`, `HttpBillingMailer`
(renders invoice, credit note and letter from the domain's document values). Driving adapters: bus
handlers `handlers.ts`; scheduled tasks `scheduled.ts`: `dunningRun` (cron `0 5 * * *` UTC, calls
`startDunningRun` with the tick) and `bankPoll` (cron `*/15 * * * *`: answering `bankFeedCursor`,
then `GET /transfers?after=<cursor>` on the bank API directly, as the outside it adapts, then one
`ingestBankTransfers` call); `ops-invoices.ts` (ops page loader, assign action). Courier
`billingCourier`. Outbox reader `createBillingOutboxReader(db)`.

### fulfillment

```ts
// src/published/stock-levels.ts  (open host service types, in fulfillment's published language)
export const StockLevelsRequestV1 = z.object({ skus: z.array(z.string().min(1)).max(500) });
export const StockLevelV1 = z.object({ sku: z.string(), available: z.number().int(), asOf: z.string().datetime() });
// src/ports/driving.ts
export type StockLevelsPort = (req: z.infer<typeof StockLevelsRequestV1>) => Promise<readonly z.infer<typeof StockLevelV1>[]>; // open host service
export interface FulfillmentDrivingPorts {
  stockLevels: StockLevelsPort;
  shipmentOverview(filter: ShipmentFilter): Promise<readonly ShipmentSummary[]>;
  openFulfillmentOrder(m: Delivered<OrderToFulfil>): Promise<void>;
  releaseForShipment(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  cancelFulfillmentOrder(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  reserveStockLine(m: Delivered<LineRequest>): Promise<void>;
  releaseStockLine(m: Delivered<LineRequest>): Promise<void>;
  consumeStockLine(m: Delivered<LineRequest>): Promise<void>;
  recordLineOutcome(m: Delivered<{ orderRef: OrderRef; lineNo: number; outcome: 'reserved' | 'refused' }>): Promise<void>;
  expireReservationHold(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  syncArticle(m: Delivered<ArticleChange>): Promise<void>;
  registerArticle(m: Delivered<{ sku: Sku; title: ArticleTitle; articleVersion: number }>): Promise<void>;      // executor
  reconsiderWaitingOrders(m: Delivered<{ sku: Sku }>): Promise<void>;
  reconsiderFulfillmentOrder(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
  bookShipment(m: Delivered<BookingRequest>): Promise<{ consignment: ConsignmentRef } | { refused: BookingRefusal }>; // executor
  recordDispatch(m: Delivered<{ orderRef: OrderRef; dispatch: DispatchInfo }>): Promise<void>;
  refreshStockLevel(m: Delivered<{ sku: Sku }>): Promise<void>;
  reviewOverdueDispatch(m: Delivered<{ orderRef: OrderRef }>): Promise<void>;
}

// src/ports/driven.ts
export interface Tx { readonly system: 'fulfillment' }
export interface UnitOfWork { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export interface FulfillmentOrders {
  load(tx: Tx, ref: OrderRef): Promise<FulfillmentOrder | null>;
  save(tx: Tx, o: FulfillmentOrder): Promise<void>;
  waitingForArticle(tx: Tx, sku: Sku): Promise<readonly OrderRef[]>;
}
export interface StockItems { load(tx: Tx, sku: Sku): Promise<StockItem | null>; save(tx: Tx, s: StockItem): Promise<void> }
export interface Articles { load(tx: Tx, sku: Sku): Promise<Article | null>; loadMany(tx: Tx, skus: readonly Sku[]): Promise<readonly Article[]>; save(tx: Tx, a: Article): Promise<void> }
export interface HandledMessages { /* as shop, Tx = fulfillment.Tx */ }
export interface Outbox { write(tx: Tx, messages: readonly FulfillmentOutgoing[]): Promise<void> }
export interface Clock { now(): Instant }
export interface Ids { messageId(): MessageId }
export interface Warehouse {
  upsertArticle(a: { sku: Sku; title: ArticleTitle }): Promise<'registered' | { refused: string }>;
  findConsignment(ref: OrderRef): Promise<ConsignmentRef | null>;
  createConsignment(c: ConsignmentRequest): Promise<{ booked: ConsignmentRef } | { refused: BookingRefusal }>;
  consignmentStatus(ref: ConsignmentRef): Promise<'open' | { dispatched: DispatchInfo } | 'unreachable'>;
  stockOnHand(sku: Sku): Promise<number>;
}
export interface FulfillmentQueries {
  stockLevels(skus: readonly Sku[]): Promise<readonly StockLevel[]>;
  shipments(filter: ShipmentFilter): Promise<readonly ShipmentSummary[]>;
}
```

Driven adapters: `createDrizzleUnitOfWork`, `DrizzleFulfillmentOrders`, `DrizzleStockItems`,
`DrizzleArticles`, `DrizzleFulfillmentQueries`, messaging helpers, `SystemClock`, `UuidV7Ids`,
`TplWarehouse(baseUrl, apiKey)` (`fetch`; PUT `/articles/{sku}` upsert; GET
`/consignments?reference=`; POST `/consignments`; 4xx with a business code is a refusal, 5xx and
timeouts throw, except `consignmentStatus`, which maps them to `'unreachable'`). Driving adapters:
hook `tpl-webhook.ts` (HMAC-SHA256 check of the body; `consignment.dispatched` → `recordDispatch`,
`inventory.changed` → `refreshStockLevel`); hook `payload-stock-field.ts` (`stockFieldHook:
FieldHook`, Payload calls it as `afterRead` of the virtual field `availableStock`; one
`stockLevels` call per read, translating to a number); bus handlers `handlers.ts`; `ops-shipments.ts`.
Courier `fulfillmentCourier`. Offer exports `stockLevels`'s types and its fake
`@tea/fulfillment/fakes` (`createStockLevelsFake(table)`), used by `packages/cms` tests. Outbox
reader `createFulfillmentOutboxReader(db)`.

## Calls and messages

No system of this codebase calls another synchronously. Between `shop`, `billing` and
`fulfillment` everything is an event (choreography, D6); there are no commands across systems.
Commands are private, written by a system to itself to have an executor make a change outside its
transaction.

Synchronous calls:

| Caller → callee | Through | When | Refusal comes back as |
|---|---|---|---|
| browser → `shop` | server actions, RSC loaders | cart, checkout, catalog | result union, rendered |
| `shop.placeOrder` → Stripe | `PaymentGateway.openCardPayment`, key `${orderId}:${cartVersion}` | card checkout, inside the open shop transaction, carrying none of it (tentative operation) | Stripe error → use case fails, no order; nothing is confirmed, the PaymentIntent lapses unconfirmed |
| `shop` executors → Stripe | `cancelCardPayment`, `refundCardPayment`, `findRefund` | worker | refusal value, committed on the `Order` |
| `shop` executor → mail provider | `OrderMailer` | worker | failure only (throws, retried) |
| `shop` executor → `web` | `HttpCatalogPageCache` POST `/api/internal/shop/revalidate` | worker | failure only |
| `fulfillment` executors and handlers → 3PL | `Warehouse` | worker | refusal value committed on `Article` / `FulfillmentOrder` |
| `billing` `bankPoll` → bank | driving adapter, `fetch` | every 15 min | bank down: the tick fails, next tick resumes from the cursor |
| `billing` executor → mail provider | `BillingMailer` | worker | failure only |
| Payload admin → `fulfillment` | hook `stockFieldHook` → `stockLevels` (open host service), in-process | product read in admin | none; answering |
| Stripe → `shop` | hook `POST /api/hooks/stripe` | Stripe events | 2xx only after the use case returned; 4xx on bad signature; 5xx on failure (Stripe resends) |
| 3PL → `fulfillment` | hook `POST /api/hooks/tpl` | dispatch, inventory notices | same |
| ops browser → each system | its own ops page (one system per page) | dashboard | result union |
| relay → bus | `Bus.publish` (`pg-boss publish`) | worker loop | failure: outbox row stays unmarked |

Messages. Type names carry the schema version. "Pub" = published (in the writer's published
language), "Priv" = private. Every subscriber queue is `<system>.<handler>`; `pg-boss` routes by type
through `subscribe(type, queue)` (D9).

| Type | Writer | Kind | Subscribers (queue → driving port) | Delay | Thing and version (P18) |
|---|---|---|---|---|---|
| `cms.ProductChanged.v1` | Payload (`afterChange`/`afterDelete`, its transaction, `cms_outbox`) | Pub event | `shop.sync-catalog-item` → `syncCatalogItem`; `fulfillment.sync-article` → `syncArticle` | – | product, `version` |
| `shop.OrderPlaced.v1` | shop `placeOrder` | Pub event | `fulfillment.open-fulfillment-order`; `billing.open-invoice` | – | order, `orderVersion` |
| `shop.OrderReleasedForShipment.v1` | shop `placeOrder` (invoice) / `recordCardPaymentSucceeded` | Pub event | `fulfillment.release-for-shipment` | – | order |
| `shop.OrderPaid.v1` | shop `recordCardPaymentSucceeded` | Pub event | `billing.mark-order-paid` | – | order |
| `shop.OrderCancelled.v1` | shop `expireUnpaidOrder`, `recordStockUnavailable` | Pub event | `fulfillment.cancel-fulfillment-order`; `billing.void-pending-invoice` | – | order |
| `shop.OrderRefunded.v1` | shop `issueCardRefund` (refund of an invoiced order) | Pub event | `billing.open-credit-note` | – | refund id |
| `shop.SendOrderConfirmation` | shop `placeOrder` | Priv command | `shop.send-order-confirmation` | – | – |
| `shop.PaymentDeadlineReached` | shop `placeOrder` (card) | Priv event | `shop.expire-unpaid-order` | `notBefore = paymentDueBy` | – |
| `shop.CancelCardPayment` | shop `expireUnpaidOrder`, `recordStockUnavailable` | Priv command | `shop.cancel-card-payment` | – | – |
| `shop.IssueCardRefund` | shop `requestRefund`, `recordCardPaymentSucceeded` (late), `cancelCardPayment` (captured), `recordStockUnavailable` (paid) | Priv command | `shop.issue-card-refund` | – | – |
| `shop.RevalidateCatalogPages` | shop `syncCatalogItem` | Priv command | `shop.revalidate-catalog-pages` | – | – |
| `fulfillment.StockReservationRefused.v1` | fulfillment `recordLineOutcome`, `releaseForShipment` (lapsed, re-reserve refused) | Pub event | `shop.record-stock-unavailable` | – | fulfillment order, version |
| `fulfillment.ShipmentDispatched.v1` | fulfillment `recordDispatch`, `reviewOverdueDispatch` | Pub event | `shop.record-order-shipped`; `billing.mark-order-dispatched` | – | fulfillment order, version |
| `fulfillment.ReserveStockLine` / `ReleaseStockLine` / `ConsumeStockLine` | fulfillment `FulfillmentOrder` use cases | Priv commands | `fulfillment.reserve-stock-line` / `release-stock-line` / `consume-stock-line` | – | commutative by line |
| `fulfillment.StockLineOutcome` | fulfillment `reserveStockLine` | Priv event | `fulfillment.record-line-outcome` | – | line |
| `fulfillment.ReservationHoldExpired` | fulfillment `openFulfillmentOrder` (card) | Priv event | `fulfillment.expire-reservation-hold` | `notBefore = holdUntil` | – |
| `fulfillment.RegisterArticle` | fulfillment `syncArticle`, `bookShipment` (refused for unknown article) | Priv command | `fulfillment.register-article` | – | article version |
| `fulfillment.ArticleRegistered` | fulfillment `registerArticle` | Priv event | `fulfillment.reconsider-waiting-orders` | – | – |
| `fulfillment.ReconsiderFulfillmentOrder` | fulfillment `reconsiderWaitingOrders` | Priv command | `fulfillment.reconsider-fulfillment-order` | – | – |
| `fulfillment.BookShipment` | fulfillment ready check | Priv command | `fulfillment.book-shipment` | – | – |
| `fulfillment.DispatchOverdue` | fulfillment ready check | Priv event | `fulfillment.review-overdue-dispatch` | `notBefore = readyAt + 72h` | – |
| `billing.DebtorStageChanged.v1` | billing `reviewDunningCase`, `settleDunningItem` | Pub event | `shop.record-customer-standing` | – | debtor, `caseVersion` |
| `billing.AssignNumber` | billing `markOrderPaid`, `markOrderDispatched`, `openCreditNote` | Priv command | `billing.assign-number` | – | – |
| `billing.InvoiceNumberAssigned` / `CreditNoteNumberAssigned` | billing `assignNumber` | Priv event | `billing.issue-invoice` / `billing.issue-credit-note` | – | – |
| `billing.SendBillingMail` | billing `issueInvoice`, `issueCreditNote`, `reviewDunningCase` | Priv command | `billing.send-billing-mail` | – | – |
| `billing.InvoiceOpened` / `InvoiceSettled` | billing `issueInvoice` / `applyIncomingTransfer` | Priv events | `billing.track-invoice-for-dunning` / `billing.settle-dunning-item` | – | – |
| `billing.ReviewDunningCase` | billing `startDunningRun` | Priv command | `billing.review-dunning-case` | – | – |
| `billing.IncomingTransferReceived` (id `bank:<transferId>`) | billing `ingestBankTransfers`, `assignUnmatchedTransfer` (id `assign:<transferId>`) | Priv event | `billing.apply-incoming-transfer` | – | commutative (applied set) |
| scheduled ticks `billing.dunning-run`, `billing.bank-poll` | `pg-boss` schedule | clock | `startDunningRun` / poll adapter | cron | tick id `dunning-run:<date>` |

How a refusal comes back across messages: a refusing use case commits the refusal as the step's
outcome and acknowledges. Fulfillment's refusal reaches shop as `fulfillment.StockReservationRefused.v1`;
an external system's refusal (Stripe, 3PL) is recorded on the aggregate of the system that asked,
where its own use cases and ops pages read it. A failure (store down, `StaleWrite`, bug,
`PredecessorMissing`) throws; the handler does not acknowledge; `pg-boss` retries with backoff
(`retryLimit: 12`, `retryBackoff: true`, `retryDelay: 5`), then moves the job to the dead-letter
queue `dead-letters`, kept 30 days, counted by the metric `bus_dead_letters`.

## Processes

Deployables (one container image, three commands):

1. `web` — `next start` in `apps/web`: storefront, server actions, ops pages, Payload admin and REST
   (`/admin`, `/api/[...slug]`), hooks `/api/hooks/stripe` and `/api/hooks/tpl`, the internal route
   `/api/internal/shop/revalidate`, probes `/health` and `/metrics`. Entry `instrumentation.ts`:
   `register()` (Node runtime only) calls `startTelemetry('web')`, then `assembleWeb(loadWebConfig(process.env))`.
   `middleware.ts` sets `x-request-id`.
2. `worker` — `node dist/main.js` in `apps/worker`: relay, bus consumers (every handler of every
   system and the `pg-boss` schedules), probes on `:9464` (`/health`, `/metrics`). Entry `main.ts`:
   `startTelemetry('worker')` → `assembleWorker(loadWorkerConfig(process.env))` → `bus.register(handlers, tasks)`
   → `relay.start()`; `SIGTERM` → `relay.stop()`, `boss.stop({ graceful: true, timeout: 30_000 })`, pools `end()`.
3. `migrate` (tooling, run as a pre-deploy job) — `node tooling/migrate/dist/main.js`: in order,
   `roles.sql` (roles `shop_app`, `billing_app`, `fulfillment_app`, `cms_relay`, `bus`, `probe`; each
   system role `USAGE, SELECT, INSERT, UPDATE, DELETE` on its own schema only; `cms_relay` `SELECT,
   UPDATE` on `payload.cms_outbox` only); `pg-boss` schema (`new PgBoss({ migrate: true })` once);
   `payload migrate` (Payload's schema plus this codebase's migration creating `payload.cms_outbox` and
   the `products.version` column); Drizzle migrations of `shop`, `billing`, `fulfillment` from each
   package's `migrations/` folder. Migrations are expand/contract only (P14).

Assembly, web (`apps/web/src/assembly.ts`): parse config once (zod over `process.env`, the only
reader of the environment); create one `pg.Pool` per system role (`max: 5`), wrap each in Drizzle with
that system's schema; create the Stripe client; call `buildShopForWeb({ db, stripe })` (web runs no executor, so no mailer or page cache),
`buildBillingForWeb({ db })`, `buildFulfillmentForWeb({ db })`. Each builder builds its system's adapters
and services and fills its own courier (`shopCourier.fill(ports)`). Payload's config is imported by Next
before `register()` runs; its `stockFieldHook` reads `fulfillmentCourier.get()` only when called. Probes
get the pools: `setProbes({ pools })` into the `probes` courier.

Assembly, worker (`apps/worker/src/assembly.ts`): same pools plus the `bus` pool for `pg-boss`
(`migrate: false`) and the `cms_relay` pool; Stripe, 3PL, bank, mail clients from config;
`buildShopForWorker(...)`, `buildBillingForWorker(...)`, `buildFulfillmentForWorker(...)` each return
`{ handlers: readonly MessageHandler[]; tasks: readonly ScheduledTask[]; outboxReader: OutboxReader }`;
assembly adds `createCmsOutboxReader(cmsRelayDb)`; it hands the handlers and tasks to
`createPgBossBus(boss)` and all four readers to `createRelay({ readers, bus, pollMs: 500, batch: 100 })`.

Relay: per reader, in a transaction of the reader's own store: `SELECT … WHERE delivered_at IS NULL
ORDER BY seq LIMIT 100 FOR UPDATE SKIP LOCKED`, `bus.publish` each (`boss.publish(type, envelope,
{ startAfter: notBefore })`), then `UPDATE … SET delivered_at = now()`, commit. Two relays during a
rolling deploy skip each other's locked rows. Delivered rows pruned after 7 days.

Bus handler wrapper (`createPgBossBus.register`): `boss.createQueue(queue, policy)`, `boss.subscribe(type,
queue)` for each type, `boss.work(queue, { batchSize: 1 }, ([job]) => runInMessageContext(job.data,
() => handler.handle(job.data)))`; the job completes only when `handle` resolves.

Telemetry: `startTelemetry` starts the OpenTelemetry `NodeSDK` (OTLP HTTP exporter to Jaeger's
collector, W3C trace-context and baggage propagators, http/undici/pg auto-instrumentation) and a
`PrometheusExporter({ preventServerStart: true })` whose `collect()` the `/metrics` routes serialize.
The request id travels as baggage `request.id`; `withRequestContext` puts it there from
`x-request-id`; `logger` (pino to stdout) adds `trace_id`, `span_id`, `request_id` in a `mixin`; the
outbox helpers put `traceparent` and `baggage` on the envelope via `injectTrace()`;
`runInMessageContext` extracts them, so a handler's spans continue the request's trace across
processes.

## Directory tree

```
tea-shop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.domain.json                 # lib ["ES2022"], types [], no DOM
├── eslint.config.js
├── .dependency-cruiser.cjs
├── vitest.workspace.ts                  # projects: unit (default), integration, e2e
├── docker-compose.yml                   # postgres:16, jaeger
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts               # withPayload, transpilePackages
│   │   ├── instrumentation.ts
│   │   ├── middleware.ts
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── assembly.ts
│   │   │   ├── probes.ts
│   │   │   └── ui/shop/
│   │   │       ├── cart-form.tsx
│   │   │       ├── checkout-form.tsx    # parses with shop's domain schema in the browser
│   │   │       └── product-card.tsx
│   │   └── app/
│   │       ├── (shop)/
│   │       │   ├── page.tsx
│   │       │   ├── products/[slug]/page.tsx
│   │       │   ├── cart/page.tsx
│   │       │   └── checkout/page.tsx
│   │       ├── (ops)/ops/
│   │       │   ├── orders/page.tsx
│   │       │   ├── invoices/page.tsx
│   │       │   └── shipments/page.tsx
│   │       ├── (payload)/
│   │       │   ├── layout.tsx
│   │       │   ├── admin/[[...segments]]/page.tsx
│   │       │   └── api/[...slug]/route.ts
│   │       ├── api/hooks/stripe/route.ts        # export { POST } from '@tea/shop/next/stripe-webhook'
│   │       ├── api/hooks/tpl/route.ts           # export { POST } from '@tea/fulfillment/next/tpl-webhook'
│   │       ├── api/internal/shop/revalidate/route.ts
│   │       ├── health/route.ts
│   │       └── metrics/route.ts
│   └── worker/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── config.ts
│           ├── assembly.ts
│           ├── cms-outbox-reader.ts
│           └── probes-server.ts
├── packages/
│   ├── common/
│   │   ├── messaging/src/
│   │   │   ├── envelope.ts
│   │   │   ├── outbox-reader.ts
│   │   │   ├── bus.ts
│   │   │   ├── pg-boss-bus.ts
│   │   │   ├── relay.ts
│   │   │   ├── drizzle-outbox.ts            # outboxTable(schema), createOutboxWriter(codec, txHandle), createOutboxReader(db, table)
│   │   │   ├── drizzle-handled-messages.ts  # handledMessagesTable(schema), createHandledMessages(db, table, txHandle)
│   │   │   ├── drizzle-unit-of-work.ts      # createUnitOfWork<Brand>(db, brand) + txHandle
│   │   │   ├── errors.ts                    # StaleWrite, PredecessorMissing
│   │   │   └── index.ts
│   │   ├── courier/src/index.ts             # createCourier<T>(key): globalThis[Symbol.for(key)]
│   │   └── telemetry/src/
│   │       ├── start-telemetry.ts
│   │       ├── logger.ts
│   │       ├── tracing.ts
│   │       ├── request-context.ts
│   │       ├── message-context.ts
│   │       ├── metrics.ts
│   │       └── index.ts
│   ├── kernel/money/
│   │   ├── src/money.ts
│   │   ├── src/index.ts
│   │   └── test/money.test.ts
│   ├── cms/                                  # Payload: external system, our configuration
│   │   ├── package.json                      # exports ./config, ./published
│   │   ├── src/
│   │   │   ├── payload.config.ts
│   │   │   ├── collections/products.ts
│   │   │   ├── collections/media.ts
│   │   │   ├── collections/users.ts
│   │   │   ├── hooks/emit-product-changed.ts # version bump + cms_outbox insert in req's transaction
│   │   │   ├── published/product-changed.ts  # ProductChangedV1 zod schema
│   │   │   ├── published/index.ts
│   │   │   ├── payload-types.ts              # generated
│   │   │   └── migrations/
│   │   │       ├── 20261101_000000_initial.ts
│   │   │       └── 20261101_000100_cms_outbox_and_version.ts
│   │   └── test/hooks/emit-product-changed.int.test.ts
│   └── systems/
│       ├── shop/
│       │   ├── package.json                  # exports: ./published ./builder ./domain ./next/*
│       │   ├── GLOSSARY.md
│       │   ├── drizzle.config.ts
│       │   ├── migrations/0000_init.sql …
│       │   ├── src/
│       │   │   ├── domain/
│       │   │   │   ├── ids.ts                # OrderId, ProductRef, CustomerId (uuidv5 of email, computed by caller-supplied hash), Sku, Slug
│       │   │   │   ├── order.ts              # Order aggregate + OrderSchema
│       │   │   │   ├── order-line.ts
│       │   │   │   ├── catalog-item.ts       # replica entry, keep-higher-version
│       │   │   │   ├── customer-standing.ts  # replica entry
│       │   │   │   ├── payment-methods.ts    # payByInvoiceOffered specification
│       │   │   │   ├── payment-deadline.ts   # CARD_PAYMENT_WINDOW = 30 min
│       │   │   │   ├── refund-policy.ts
│       │   │   │   ├── late-payment.ts       # captured after cancel → refund
│       │   │   │   ├── repeat-policies.ts    # confirmation mail repeat accepted; refund look-up after 23 h
│       │   │   │   ├── stale-acceptance.ts   # replica price and standing accepted stale
│       │   │   │   ├── mail-content.ts       # sender address, subject lines per locale
│       │   │   │   └── index.ts
│       │   │   ├── published/
│       │   │   │   ├── order-events.ts       # OrderPlacedV1 … OrderRefundedV1, MoneyV1
│       │   │   │   └── index.ts
│       │   │   ├── messages/
│       │   │   │   ├── private.ts            # private message schemas
│       │   │   │   └── codec.ts              # ShopOutgoing ↔ Envelope
│       │   │   ├── ports/
│       │   │   │   ├── driving.ts
│       │   │   │   └── driven.ts
│       │   │   ├── service/
│       │   │   │   ├── create-shop-service.ts
│       │   │   │   ├── use-cases/            # one file per use case, none imports another
│       │   │   │   │   ├── set-cart-line.ts
│       │   │   │   │   ├── place-order.ts
│       │   │   │   │   ├── request-refund.ts
│       │   │   │   │   ├── sync-catalog-item.ts
│       │   │   │   │   ├── record-customer-standing.ts
│       │   │   │   │   ├── record-card-payment-succeeded.ts
│       │   │   │   │   ├── record-charge-disputed.ts
│       │   │   │   │   ├── record-stock-unavailable.ts
│       │   │   │   │   ├── record-order-shipped.ts
│       │   │   │   │   ├── expire-unpaid-order.ts
│       │   │   │   │   ├── send-order-confirmation.ts
│       │   │   │   │   ├── cancel-card-payment.ts
│       │   │   │   │   ├── issue-card-refund.ts
│       │   │   │   │   ├── revalidate-catalog-pages.ts
│       │   │   │   │   └── queries.ts
│       │   │   │   ├── steps/handle-once.ts  # claim-then-act inside a given Tx; opens nothing
│       │   │   │   └── translate/
│       │   │   │       ├── to-published.ts   # Order → OrderPlacedV1 …
│       │   │   │       └── to-private.ts
│       │   │   ├── adapters/
│       │   │   │   ├── driven/
│       │   │   │   │   ├── drizzle/
│       │   │   │   │   │   ├── schema.ts
│       │   │   │   │   │   ├── unit-of-work.ts
│       │   │   │   │   │   ├── orders.ts
│       │   │   │   │   │   ├── catalog-items.ts
│       │   │   │   │   │   ├── customer-standings.ts
│       │   │   │   │   │   ├── order-queries.ts
│       │   │   │   │   │   ├── catalog-queries.ts
│       │   │   │   │   │   └── standing-queries.ts
│       │   │   │   │   ├── stripe/payment-gateway.ts
│       │   │   │   │   ├── mail/order-mailer.ts
│       │   │   │   │   ├── page-cache/http-page-cache.ts
│       │   │   │   │   ├── page-cache/revalidate-route.ts
│       │   │   │   │   └── system/
│       │   │   │   │       ├── clock.ts
│       │   │   │   │       └── ids.ts
│       │   │   │   └── driving/
│       │   │   │       ├── courier.ts
│       │   │   │       ├── next/
│       │   │   │       │   ├── cart-actions.ts
│       │   │   │       │   ├── checkout-actions.ts
│       │   │   │       │   ├── catalog-loaders.ts
│       │   │   │       │   ├── ops-orders.ts
│       │   │   │       │   └── stripe-webhook.ts
│       │   │   │       └── bus/
│       │   │   │           ├── handlers.ts
│       │   │   │           ├── from-cms.ts          # cms.ProductChangedV1 → CatalogItemChange
│       │   │   │           ├── from-billing.ts      # billing.DebtorStageChangedV1 → StandingChange
│       │   │   │           └── from-fulfillment.ts
│       │   │   ├── fakes/driven/
│       │   │   │   ├── in-memory-store.ts    # staged writes per Tx, commit/rollback, one-aggregate guard
│       │   │   │   ├── orders.ts
│       │   │   │   ├── catalog-items.ts
│       │   │   │   ├── customer-standings.ts
│       │   │   │   ├── handled-messages.ts
│       │   │   │   ├── outbox.ts
│       │   │   │   ├── clock.ts
│       │   │   │   ├── ids.ts
│       │   │   │   ├── payment-gateway.ts
│       │   │   │   ├── order-mailer.ts
│       │   │   │   ├── page-cache.ts
│       │   │   │   └── queries.ts
│       │   │   ├── outbox-reader.ts
│       │   │   └── builder.ts                # buildShopForWeb, buildShopForWorker
│       │   └── test/
│       │       ├── domain/order.test.ts
│       │       ├── domain/payment-methods.test.ts
│       │       ├── service/use-cases/place-order.test.ts
│       │       ├── service/use-cases/record-card-payment-succeeded.test.ts
│       │       ├── service/use-cases/…        # one per use case
│       │       ├── ports/orders.contract.ts
│       │       ├── ports/payment-gateway.contract.ts
│       │       ├── ports/…contract.ts         # one per driven port
│       │       ├── fakes/driven/orders.test.ts            # contract on fake (unit)
│       │       ├── adapters/driven/drizzle/orders.int.test.ts
│       │       ├── adapters/driven/stripe/payment-gateway.e2e.test.ts
│       │       └── published/compat.test.ts               # JSON-schema snapshots
│       ├── billing/
│       │   ├── package.json · GLOSSARY.md · drizzle.config.ts · migrations/
│       │   ├── src/
│       │   │   ├── domain/
│       │   │   │   ├── invoice.ts            # pending → issued(open|paid) | void; VAT lines
│       │   │   │   ├── credit-note.ts
│       │   │   │   ├── number-series.ts      # gapless next()
│       │   │   │   ├── vat.ts                # tea 700 bp, accessory 1900 bp, by date
│       │   │   │   ├── payment-terms.ts      # due = dispatch + 14 days
│       │   │   │   ├── dunning-case.ts
│       │   │   │   ├── dunning-ladder.ts     # +7 reminder, +21 first, +35 final, +49 collection
│       │   │   │   ├── business-calendar.ts  # Europe/Berlin dates via Intl
│       │   │   │   ├── transfer-matching.ts
│       │   │   │   ├── bank-feed.ts
│       │   │   │   ├── unmatched-transfer.ts
│       │   │   │   ├── repeat-policies.ts
│       │   │   │   └── index.ts
│       │   │   ├── published/debtor-events.ts · published/index.ts
│       │   │   ├── messages/private.ts · messages/codec.ts
│       │   │   ├── ports/driving.ts · ports/driven.ts
│       │   │   ├── service/create-billing-service.ts · service/use-cases/*.ts · service/translate/*.ts
│       │   │   ├── adapters/driven/drizzle/*.ts · adapters/driven/mail/billing-mailer.ts · adapters/driven/system/*.ts
│       │   │   ├── adapters/driving/courier.ts · adapters/driving/next/ops-invoices.ts
│       │   │   ├── adapters/driving/bus/handlers.ts · bus/from-shop.ts · bus/from-fulfillment.ts
│       │   │   ├── adapters/driving/scheduled/dunning-run.ts · scheduled/bank-poll.ts
│       │   │   ├── fakes/driven/*.ts
│       │   │   ├── outbox-reader.ts
│       │   │   └── builder.ts
│       │   └── test/ (mirrors src: domain/, service/use-cases/, ports/*.contract.ts, adapters/…int.test.ts, published/compat.test.ts)
│       └── fulfillment/
│           ├── package.json · GLOSSARY.md · drizzle.config.ts · migrations/
│           ├── src/
│           │   ├── domain/
│           │   │   ├── fulfillment-order.ts  # lines, released, holdUntil, booking, dispatch, endings
│           │   │   ├── stock-item.ts
│           │   │   ├── article.ts
│           │   │   ├── reservation-hold.ts   # holdUntil = paymentDueBy + 15 min
│           │   │   ├── dispatch-deadline.ts  # 72 h
│           │   │   ├── repeat-policies.ts    # look up consignment before create; race accepted
│           │   │   ├── stale-acceptance.ts   # article registration read stale
│           │   │   └── index.ts
│           │   ├── published/fulfillment-events.ts · published/stock-levels.ts · published/index.ts
│           │   ├── messages/private.ts · messages/codec.ts
│           │   ├── ports/driving.ts · ports/driven.ts
│           │   ├── service/create-fulfillment-service.ts · service/use-cases/*.ts · service/translate/*.ts
│           │   ├── adapters/driven/drizzle/*.ts · adapters/driven/tpl/warehouse.ts · adapters/driven/system/*.ts
│           │   ├── adapters/driving/courier.ts · adapters/driving/next/tpl-webhook.ts · adapters/driving/next/ops-shipments.ts
│           │   ├── adapters/driving/payload/stock-field.ts
│           │   ├── adapters/driving/bus/handlers.ts · bus/from-shop.ts · bus/from-cms.ts
│           │   ├── fakes/driven/*.ts
│           │   ├── fakes/offer/stock-levels.ts
│           │   ├── outbox-reader.ts
│           │   └── builder.ts
│           └── test/ (mirrors src)
└── tooling/
    ├── migrate/src/main.ts
    ├── migrate/sql/roles.sql
    ├── eslint-plugin/src/foreign-terms-qualified.ts
    ├── eslint-plugin/src/no-domain-doubles.ts
    └── test-support/src/postgres-container.ts   # testcontainers + runs tooling/migrate
```

## How each property holds

**P1.** Each system's `src/domain/**` may import only its own domain, `@tea/kernel-money` and `zod`
(`dependency-cruiser` rule `domain-closed-list`, with `tsPreCompilationDeps: true` so `import type`
counts, and transitive: the kernel itself may import only `zod`). No system conforms to anything
(D8), so no upstream published language is on the list. The domain compiles under
`tsconfig.domain.json` (`lib: ["ES2022"]`, `types: []`, no DOM): `Buffer`, `process`, `window`,
`node:*`, `fetch` and `crypto` do not type-check there. Time and ids come in as arguments (`now:
Instant`, `orderId: OrderId`); dates in the business calendar use `Intl.DateTimeFormat` with the
domain constant `Europe/Berlin`, which every runtime has. Drizzle tables live in
`adapters/driven/drizzle/schema.ts`, Payload types only in the handlers that parse its messages, Stripe
types only in the gateway and hook.

**P2.** Every business rule of a system and its numbers are in its domain: 30-minute card window,
15-minute hold grace, 72-hour dispatch deadline, VAT basis points per tax class and date, 14-day
payment terms, the dunning ladder, pay-by-invoice offer, refund eligibility, late-payment refund,
repeat policies, stale acceptances. Record shapes are zod schemas in the domain; Drizzle adapters
parse rows with them (`OrderSchema.parse`), server actions and the checkout form parse input with
them, types are `z.infer`. No env value decides a rule (only `apps/*/src/config.ts` reads
`process.env`, ESLint `no-restricted-properties`); no check constraint or trigger beyond primary and
unique keys. `checkoutOptions` (the guard) and `placeOrder` (enforcement) both call
`payByInvoiceOffered`. Tests use the real domain; `tooling/eslint-plugin/no-domain-doubles` refuses
`vi.mock` of any `domain/` path. Price above zero and sku unique are Payload's own rules about
Payload's records (D2), stated once in `collections/products.ts`; no system of ours restates them.
Published schemas restate constraints as the contract's own (quantity positive in `OrderPlacedV1`).

**P3.** A record's rules sit with its owner: order and payment rules in `shop`, invoice, VAT,
numbering and dunning in `billing`, reservation, hold and shipping in `fulfillment`, product rules in
Payload. Shop does not compute fulfillment's hold: `OrderPlaced` carries `paymentDueBy`, shop's fact
about shop's order, and `fulfillment/domain/reservation-hold.ts` decides `holdUntil` from it. Billing
decides "in dunning" and publishes it; shop decides only what checkout offers. The shared kernel holds
`Money` and its arithmetic, no record schema; the common library holds no schema of any system (its
`Envelope.payload` is `unknown`).

**P4.** Services compute from driving-port arguments and driven-port returns only. Systems never read
`process`, the environment or `AsyncLocalStorage` (ESLint `no-restricted-globals: process` and
`no-restricted-imports: node:async_hooks` under `packages/systems/**`); time and ids come from
`Clock` and `Ids`. Operator identity (`requestedBy`, `assignedBy`) and `locale` are arguments, and the
locale travels in `OrderPlaced`/`SendOrderConfirmation` for the mail executor. Each driving adapter
makes at most one acting call per request or message: the Stripe and 3PL hooks one per event, the bank
poll one answering call and one acting call per tick, handlers one per envelope, ops actions one. The
checkout page's hidden invoice option is a guard the service repeats. Telemetry (pino, tracer,
baggage) is the only ambient input and decides nothing.

**P5.** Services import only `ports/`, `domain/`, `published/`, `messages/`, the kernel and
`@tea/messaging` errors (`dependency-cruiser` rule `service-reach`); adapters may also import their
outside's client (`stripe`, `drizzle-orm`, `pg` types, `fetch`). Every port is declared in the
system's terms. Package `exports` expose only the offer (`./published`, `./builder`, fulfillment's
`./fakes`) plus way-in subpaths (`./next/*` restricted by `dependency-cruiser` to `apps/web/app/**`,
`./domain` restricted to the same system's UI under `apps/web/src/ui/<system>/**`, fulfillment's
`./payload/*` restricted to `packages/cms/**`). Clients, pools and config are built only in
`apps/*/src/assembly.ts` and the builders; framework-constructed adapters (server actions, routes,
Payload's hook) read their system's courier on every call (`createCourier` keeps the value on
`globalThis[Symbol.for(key)]` so Next's separate module graphs see the one instance; `get()` before
`fill()` throws). The relay knows readers only as `OutboxReader` values handed by assembly. Telemetry
is the common-library exception.

**P6.** Every driven port has a fake in `src/fakes/driven/`, written for the port (the
`in-memory-store` stages writes per `Tx`, applies them on commit, discards them on rollback, and
fails a stale save). Service tests run on fakes only. One contract suite per port in
`test/ports/<port>.contract.ts` (`describeOrdersContract(make: () => Promise<Orders & …>)`) runs on
the fake in the `unit` project and on the real adapter in `integration` (Postgres from
`testcontainers`, migrated by `tooling/migrate`, roles included) or `e2e` (Stripe test mode with the
dispute test card, 3PL sandbox, mail sandbox); selecting the project is the flag. The OpenTelemetry
API is a no-op without SDK; pino writes to stdout and never throws; no module opens a pool at load.

**P7.** Each acting use case is one `uow.run(async (tx) => …)`: claim the message (if called for
one), load one aggregate, ask the domain, `save` it, `outbox.write` its messages, return; `run`
commits once after the callback resolves and rolls back whole on any throw (no savepoints, no
`ON CONFLICT … DO UPDATE` writes besides the claim's `DO NOTHING`). `Tx` is a required parameter of
every writing port and dies with the transaction. The fake `in-memory-store` throws when two
aggregate keys are saved in one `Tx`, so every service test checks "at most one aggregate". Use-case
modules may not import one another (`dependency-cruiser`); shared steps in `service/steps/` receive a
`Tx` and open none. Cart and order are one aggregate (D4), so placing an order is one save. Gapless
numbering uses a separate `NumberSeries` aggregate reached by message (D14).

**P8.** Every message goes into its system's `outbox` table inside the use case's transaction
(`Outbox.write(tx, …)`). The relay marks a row only after `pg-boss` has stored the job; `pg-boss`
keeps jobs in Postgres across stops, retries until the handler resolves, and parks failures in
`dead-letters`; handlers and hooks answer only after the use case returned. The only call made beside
a transaction that is not an executor's is `openCardPayment`, a tentative operation: an unconfirmed
PaymentIntent gives nothing. Executors (`sendOrderConfirmation`, `cancelCardPayment`,
`issueCardRefund`, `revalidateCatalogPages`, `registerArticle`, `bookShipment`, `sendBillingMail`)
decide nothing again; they make the change and record the answer. Payload writes `ProductChanged`
into `payload.cms_outbox` in its own transaction from `afterChange`/`afterDelete` (through
`getTransaction(req.payload.db, req)`), so no product change is acted on before Payload commits and
no pending record is needed.

**P9.** `handled_messages(consumer, message_id)` primary key, claimed by `INSERT … ON CONFLICT DO
NOTHING RETURNING` inside the committing transaction; `'already-handled'` commits nothing and
returns the committed answer (executors re-read the recorded provider ref). An overlapping repeat
waits on the unique index and finds the claim. Hooks use the vendor's event id, polled transfers
`bank:<transferId>`, ticks `dunning-run:<date>`. Changes outside the transaction carry a key from the
message: Stripe `idempotencyKey` (`refundId`, `cancel:<orderId>`, `${orderId}:${cartVersion}`), and
after 23 h `findRefund` first; 3PL article upsert by sku is idempotent; consignments are looked up by
`reference = orderId` before creation, the residual race accepted by
`fulfillment/domain/repeat-policies.ts`; a second confirmation mail or dunning letter is accepted by
each system's `repeat-policies.ts`; page revalidation repeated is no change.

**P10.** Acting use cases read their aggregate through repositories with the committing `Tx`;
`save` compares `version` and throws `StaleWrite`; new aggregates insert on a primary key (orders by
generated id, fulfillment orders by order ref, stock items and articles by sku, series by
`(kind, year)`, unmatched transfers by bank ref). A lost race rolls back and is retried by the caller
or redelivery, never inside the use case. Stale reads are named rules: shop's replica price and
customer standing (`shop/domain/stale-acceptance.ts`), fulfillment's article registration (monotonic),
billing's issued invoice when opening a credit note (issued invoices never change). Aggregates are cut
by what rules tie: `StockItem` per sku (orders of different teas never collide), `DunningCase` per
debtor, `NumberSeries` per kind and year (all issuances of a year collide, tied by gaplessness),
`FulfillmentOrder` per order. No counters or statistics are written in use cases.

**P11.** One Postgres role per system with grants on its own schema only, so another system's tables
cannot be read or written by its client at all. Systems learn of each other only through published
events into their own replicas or aggregates; Payload's products reach shop and fulfillment only as
`cms.ProductChanged.v1`. No system writes Payload's records; Payload keeps no record of ours (its
`availableStock` is virtual, read through fulfillment's open host service). The cms outbox reader is
assembly's, with the `cms_relay` role limited to `cms_outbox`. Each ops page is one system's driving
adapter over that system's own queries.

**P12.** Every downstream relation is an anti-corruption layer (D8). A foreign published language
(`@tea/cms/published`, `@tea/shop/published`, `@tea/billing/published`, `@tea/fulfillment/published`,
`stripe`, the 3PL and bank wire shapes) may be imported only by files under
`adapters/driving/bus/from-*.ts`, the hooks and the driven adapters that call that upstream
(`dependency-cruiser` rule `foreign-pl-in-adapters`, `import type` included). Those files translate
to the system's own types before calling a driving port. Published-language modules import only
`zod` (rule `published-closed`), so no published language reaches another's or the kernel.

**P13.** Other systems' code can import only `exports` subpaths (Node resolution refuses deep
imports; `dependency-cruiser` repeats it), and of those only `./published` (schemas and inferred
types) and fulfillment's `./fakes`; builders are imported only by `apps/*/src/assembly.ts`.
`src/published/**` imports nothing of its system (rule `published-closed`); services translate
`Order` to `OrderPlacedV1` in `service/translate/to-published.ts`, so a model change that meets the
contract fails to compile there. `test/published/compat.test.ts` snapshots each published schema as
JSON Schema (`zod-to-json-schema`); a change to a snapshot of an existing version fails review unless
additive (P14).

**P14.** One zod schema per message type: published in `src/published/`, private in
`src/messages/private.ts`, Payload's in `@tea/cms/published`; the writer's codec and every handler
parse with it. Type names carry `.v1`; a change that cannot be read both ways ships as `.v2`, written
beside `.v1` by the writer while any `.v1` subscriber queue exists, readers of `.v1` kept until the
outbox, the queues and `dead-letters` hold no `.v1`. Records: child tables instead of JSON blobs,
`UPDATE` statements that set only the columns the code knows, expand/contract migrations (add
nullable or defaulted columns first, readers deployed before writers, drop last), new enum values
shipped to readers before any writer emits them. Fulfillment's `stockLevels` is called in-process
only, so no driving port is out of the process.

**P15.** No synchronous call between our systems. Checkout by invoice reads shop's replica
`customer_standings`; prices come from shop's replica `catalog_items`; storefront pages read the
replica too, so Payload, billing and fulfillment can be down while customers browse and check out by
invoice. Checkout by card calls Stripe because the customer pays now
(`shop/domain/payment-methods.ts` names it); it fails visibly when Stripe is down. Everything else is
a message. Payload's stock field depends on fulfillment's answering use case, which reads only
fulfillment's store.

**P16.** `Tx` travels only as an argument; each system's `Tx` is a distinct brand and its Drizzle
handle lives in a `WeakMap` private to that system's adapters, so no other system's code can use it.
Driving ports take only domain or published-language types (`dependency-cruiser` forbids
`drizzle-orm`, `pg` and `@tea/messaging`'s unit-of-work types in `ports/driving.ts`). Systems may not
import `node:async_hooks`. Roles confine each transaction to its own schema. No code calls Payload's
Local API with a `req`; Payload's hook calls `stockLevels` with plain values.

**P17.** Every waiting part holds its moment in its own aggregate and ends by a domain rule:
- shop `Order` awaiting card payment: `paymentDueBy`, `PaymentDeadlineReached` delayed to it →
  cancelled (`OrderCancelled`, `CancelCardPayment`); cancel refused as already captured → refund;
  late `payment_intent.succeeded` on a cancelled order → refund; stock refused → cancel, plus refund
  if paid or PaymentIntent cancel if not; refund refused by Stripe → recorded, accepted, shown on the
  ops page.
- fulfillment `FulfillmentOrder` holding stock: `holdUntil`, `ReservationHoldExpired` → lapsed,
  lines released; release after lapse → re-reserve or `StockReservationRefused`; booking refused for
  an unknown article → register and retry once, then `needs-attention` (accepted); `DispatchOverdue`
  at +72 h → reconcile with `consignmentStatus`; `'open'` or `'unreachable'` → `needs-attention`
  (accepted, decided without an answer).
- billing open invoice: due date and ladder end at `collection` (accepted, operator hands over);
  unmatched transfers accepted for operator assignment; pending invoice voided on `OrderCancelled`.
Shop's `paid`-awaiting-shipment and billing's pending invoice hold nothing and are no wait.
Refusals are committed outcomes; failures throw, are retried, and park in `dead-letters`.

**P18.** Messages about one thing that override each other carry that thing's version, raised in the
committing transaction: `orderVersion`, `caseVersion`, fulfillment order version, Payload's
`products.version` (raised in `afterChange` by `UPDATE … SET version = version + 1 RETURNING version`
in Payload's transaction, under the row lock of the update). Receivers keep the higher
(`CatalogItem`, `CustomerStanding`, `Article`). Fulfillment records what arrives early
(`OrderCancelled` or `OrderReleasedForShipment` before `OrderPlaced` creates a `FulfillmentOrder` in
`cancelled-unseen` / `released-unseen`). Billing throws `PredecessorMissing` when `OrderPaid`,
`ShipmentDispatched` or `OrderCancelled` find no invoice and is redelivered after `OrderPlaced`
lands. Stripe statuses only move an `Order` forward; 3PL `inventory.changed` is a notice answered by
`stockOnHand(sku)`; reserve/release/consume and applied transfers commute. Conflicts between Stripe
and fulfillment about one order are decided by shop's domain (stock refused after payment → refund).

**P19.** Each system has `GLOSSARY.md` as its one register; a term enters there before code uses it.
Foreign terms are qualified: `cms.ProductChangedV1`, `stripe.PaymentIntent`, `tpl.Consignment`,
`shopEvents.OrderPlacedV1`, enforced by `tooling/eslint-plugin/foreign-terms-qualified` (namespace
imports required for foreign published languages and vendor SDKs). Billing calls shop's customer a
`Debtor` and keeps no `Order`; fulfillment's order is `FulfillmentOrder`; shop's cart is an `Order`
in status `cart`, written so in shop's glossary.

## Decisions the document left to me

**D1. The cut into systems.** Chose `shop`, `billing`, `fulfillment`, plus five external systems.
Also holding every property: a separate `payment` system for Stripe, or one wider system for
billing and shop.

**D2. Who owns products.** Chose Payload: price above zero and sku unique are Payload's own rules
in its configuration. Also holding: a `catalog` system of ours that owns products, with Payload as
keeper calling catalog's veto hook and its use cases.

**D3. Card payment inside `shop`.** Chose to keep `Order` payment state, refunds and disputes in
shop. Also holding: a `payment` system that publishes `PaymentSucceeded`/`RefundIssued`.

**D4. The cart is an `Order` in status `cart`.** Chose this so placing is one aggregate save. Also
holding: a separate `Cart` aggregate, cleared by a private message after `OrderPlaced`.

**D5. Customer identity.** Chose `CustomerId` as the UUIDv5 of the normalized email, computed in the
checkout action, with no customer aggregate (accounts and auth fall under security, out of scope).
Also holding: a `Customer` aggregate created by its own use case before checkout.

**D6. Choreography, events only between systems.** Also holding: shop as process manager sending
commands declared in fulfillment's and billing's published languages.

**D7. Open host services.** Chose none for `shop` and `billing`, and one for `fulfillment`
(`stockLevels`, called by Payload through a hook). Also holding: in-process open host services for the
ops pages, as long as each page stays a driving adapter of one system.

**D8. Anti-corruption layer for every upstream.** No conformist. Also holding: shop conforming to
Payload's `ProductChangedV1` inside its replica, with the terms taken from `@tea/cms/published`.

**D9. Bus.** Chose `pg-boss` on the same Postgres, routing by type through publish/subscribe, one queue
per handler. Also holding: handlers filtering one shared queue; any broker that persists and redelivers.

**D10. Clock.** Chose messages held back (`notBefore` → `startAfter`) for deadlines, `pg-boss` cron
for the dunning run and bank poll. Also holding: sweeps over due aggregates.

**D11. Transaction port.** Chose an opaque branded `Tx` with a `WeakMap` to the Drizzle transaction
and a `UnitOfWork.run` port. Also holding: a per-system class wrapping the Drizzle transaction with
private fields.

**D12. Concurrency.** Chose optimistic version columns. Also holding: `SELECT … FOR UPDATE` at load.

**D13. Repeat detection.** Chose a `handled_messages(consumer, message_id)` claim plus records. Also
holding: records only, where every write is a set-to-value.

**D14. Gapless numbers.** Chose a `NumberSeries` aggregate per kind and year, reached by
`AssignNumber` and answered by `…NumberAssigned`; a number exists once its message commits and is
never revoked (void only before numbering, credit notes after). Also holding: assigning the number
when the invoice is drafted, with drafting itself done by the series aggregate.

**D15. One database, schema and role per system.** Also holding: one role with lint-only boundaries
(weaker but holding P11/P16 by rule).

**D16. Payload's outbox and version.** Chose a table `payload.cms_outbox` written in `afterChange`
and `afterDelete` through `req`'s transaction, and `version` raised by `UPDATE … RETURNING` there.
Also holding: a Postgres trigger that only raises the version; a notice message answered by a Local
API fetch.

**D17. Processes.** Chose `web` (Next + Payload) and `worker`, with migrations as a tooling job.
Also holding: hooks in a separate `hooks` process; relay separate from consumers.

**D18. Courier.** Chose one courier per system on `globalThis[Symbol.for(...)]`, filled by that
system's builder during `instrumentation.register()`. Also holding: one process-wide courier
holding every system's driving ports, read through a typed accessor per system.

**D19. Monorepo and enforcement.** Chose pnpm, one package per system with `exports`,
`dependency-cruiser` and ESLint, a domain tsconfig without Node or DOM types. Also holding: Nx
module boundaries; eslint-plugin-boundaries.

**D20. Telemetry.** Chose OTel NodeSDK with OTLP to Jaeger, request id as baggage, trace carried on the
envelope, pino with a mixin, Prometheus exporter without its own server. Also holding:
`prom-client` for metrics; request id as its own envelope field.

**D21. Card payment deadline.** Chose 30 minutes, expiry decided on the `Order` alone (no Stripe
call), then `CancelCardPayment`; a captured refusal leads to a refund. Also holding: asking Stripe
at the deadline, with the decision made on no answer.

**D22. Late payment.** Chose to refund. Also holding: reinstating the order and re-reserving.

**D23. Messages that arrive before their predecessor.** Chose recording early messages in
fulfillment and fail-and-retry in billing. Also holding: either means everywhere.

**D24. Repeats outside the transaction.** Chose Stripe idempotency keys with a look-up after 23 h,
3PL look-up before create with the race accepted, mail repeats accepted. Also holding: a
reconciliation cancelling duplicate consignments.

**D25. Admin dashboard.** Chose three pages, each a driving adapter of one system, operator
identified through Payload auth. Also holding: a `backoffice` system keeping replicas of all three.

**D26. Stock in Payload's admin.** Chose a virtual field filled by fulfillment's hook calling
`stockLevels`. Also holding: a stored field only fulfillment's driven adapter writes, configured
read-only for editors.

**D27. Storefront data and revalidation.** Chose shop's replica (with `descriptionHtml` and
`imageUrl` rendered by Payload into its message) and an executor posting to the web route that calls
`revalidateTag`. Also holding: the storefront reading Payload's Local API as a page of no system, with
revalidation from a handler running in `web`.

**D28. Bank transfers.** Chose polling with a `BankFeed` cursor aggregate, one acting call writing one
message per transfer. Also holding: one acting call per polled transfer.

**D29. 3PL inventory.** Chose webhook as a notice and a fetch of on-hand. Also holding: a scheduled
full stock sync.

**D30. Refund scope.** Chose full refunds, one per order. Also holding: partial refunds with one
credit note each.

**D31. When orders are placed and invoiced.** Chose placing at checkout for both methods
(confirmation mail then); card invoices at `OrderPaid`, invoice-order invoices at
`ShipmentDispatched`, due 14 days later; prices are gross, VAT derived per line. Also holding: a card
order placed only once paid, with stock reserved as a tentative operation before.

**D32. Dunning.** Chose a `DunningCase` per debtor, ladder +7/+21/+35/+49 days, `inDunning` = any
stage above `none`, daily run at 05:00 UTC with the run date taken in Europe/Berlin. Also holding:
dunning per invoice with the stage derived.

**D33. Refusals at driving ports.** Chose result unions; failures throw. Also holding: typed error
classes declared in the system's terms.

**D34. Published money shape.** Chose each published language declaring its own `MoneyV1`
(`amountMinor`, `currency`), not the kernel's `Money`. Also holding: carrying the kernel's `Money` in
messages, a coupling chosen together.

**D35. Tests.** Chose Vitest projects `unit`/`integration`/`e2e`, contract suites per port,
`testcontainers`, `e2e` never automatic. Also holding: any runner with the same parameterized suites.

## Sentences I had to pick a reading for

**S1.** Glossary, External system: "Business rules its configuration holds are its own, in its terms,
even where this codebase writes them", with P2: "the business rules it holds are the external
system's own where they decide a record the external system keeps and no business rule of this system
decides." Reading A: any rule over a record Payload keeps and no system of ours decides is Payload's,
so price above zero and sku unique may live in Payload's configuration. Reading B: these are the tea
shop's business rules and must sit in a domain of ours, Payload being a keeper. Took A. Changed: no
`catalog` system; shop and fulfillment are downstream of Payload; Payload's message is its published
language in `packages/cms`.

**S2.** P8: "An external system this codebase configures, whose transaction can write a message to
an outbox, MUST tell of its change by such a message." Reading A: "can" means feasible with code we
write (a hook writing through `req`'s transaction). Reading B: only where the vendor offers an outbox
feature. Took A. Changed: `payload.cms_outbox`, its assembly-provided reader, and no pending records
for Payload's changes.

**S3.** P5: "from a courier that only assembly fills", with the glossary's "System builder. The part
of assembly a system provides". Reading A: a builder in the system's package is assembly and may fill
its system's courier. Reading B: only the app's assembly file may fill couriers. Took A. Changed:
`buildShopForWeb` fills `shopCourier`; the app's assembly never imports a courier.

**S4.** The three lines after P5's Provenance ("- Port: carry … settle.", "- Assembly: …", "- Courier:
say assembly fills it…"). Reading A: editorial to-dos, not rules. Reading B: amendments in force.
Took A, and checked the draft holds under B as well (all ports in the system's terms; builders are
assembly). Nothing changed.

**S5.** P7: "A use case MUST save at most one aggregate". Reading A: replica entries are aggregates;
claims and outbox rows are not. Reading B: any record counts. Took A. Changed: `syncCatalogItem`
saves only the `CatalogItem` and sends page revalidation as a private message; the fake store's
one-aggregate guard ignores claims and outbox writes.

**S6.** P7: "The same transaction MUST carry … the record of the message it is called for", for
executors whose outside call comes before the transaction. Reading A: an `isHandled` read before the
call, the claim written in the committing transaction after it. Reading B: claim first, in a
transaction that must stay open across the call. Took A. Changed: executors' shape (read, call with
key, transaction with claim and outcome).

**S7.** P17: "Where its part waits on another system, it MUST hold the moment it stops waiting in an
aggregate of its own, if: it holds something until the answer comes". Reading A: fulfillment, holding
reserved stock until shop releases or cancels, waits. Reading B: only shop, which asked, waits.
Took A. Changed: `holdUntil`, `ReservationHoldExpired`, the `lapsed` state and re-reservation.

**S8.** P15: "unless a business rule of its system needs that system's current answer", against the
Why's "at the payment deadline a reconciliation asks Stripe whether the order was paid". Reading A:
the Why's reconciliation is one permitted case. Reading B: it is expected. Took A (the Why binds
nothing) and decided expiry on the `Order` alone. Changed: no Stripe call at the deadline; a
captured-refusal of the cancel leads to a refund.

**S9.** P9: "by the message's id claimed there under a key the store refuses twice". Reading A: the
key is the message id. Reading B: the message id per consumer. Took B, since one system may have
several handlers of one message. Changed: primary key `(consumer, message_id)`.

**S10.** P6 Why: "a transaction port whose fake commits nothing". Reading A: the fake has no commit
semantics at all. Reading B: it reaches no store, but stages and applies writes as a transaction does
where the use case can tell. Took B. Changed: `in-memory-store` with commit/rollback, asserted by the
`UnitOfWork` contract suite.

**S11.** P1: "MUST load on every runtime of the language". Reading A: browsers, Node, Deno, Bun and
edge runtimes. Reading B: the runtimes this codebase deploys to. Took A. Changed: domain tsconfig
with `lib: ["ES2022"]` and no types; no `crypto.randomUUID` or `fetch` in domains; only `Intl` for
calendar dates.

**S12.** P4: "an ambient value or a configuration value MUST NOT change either". Reading A: a cron
expression decides when a way in is called, not how a use case acts. Reading B: the schedule's time
zone is a configuration value that changes which invoices are due. Took A, but kept the time zone out
of it. Changed: the run date is computed in the domain from the tick's instant with
`Europe/Berlin`; the cron runs in UTC.

**S13.** P13: "Code of another system MUST import of a system only its offer". Reading A: Payload's
configuration importing fulfillment's hook reaches fulfillment "by a driving adapter's way in" (P5).
Reading B: it is code of another system and may import only the offer. Took A. Changed: fulfillment
exports `./payload/*` restricted to `packages/cms`; the offer stays published language, builders and
the `stockLevels` fake.

**S14.** Glossary, Open host service: "The driving ports a system offers to other systems", with P13
Provenance "where this rule asks it of every downstream". Reading A: every system must offer driving
ports to each downstream. Reading B: a system with event-only downstreams may offer no driving ports.
Took B. Changed: shop and billing offers hold published language and builders only; only fulfillment
offers a driving port.

**S15.** P3: "A shared kernel MUST hold no such rule and no record's schema". Reading A: `Money`'s
own zod schema is a value's schema and allowed. Reading B: any schema used inside records is refused.
Took A. Changed: `@tea/kernel-money` exports `MoneySchema`.

**S16.** P18: "The system that writes messages about one thing MUST let a use case called for one
tell that order". Reading A: published and private messages alike, only where receivers keep the
last. Reading B: published messages only. Took A. Changed: private messages that override carry a
version (`RegisterArticle.articleVersion`); commuting ones carry none.

**S17.** P16: "A transaction MUST read and write only records owned by the system that opened it."
Reading A: the cms outbox reader's transaction is assembly's, no system's, outside the Scope.
Reading B: it is Payload's records read in a transaction of ours and needs justification. Took A,
and limited it anyway. Changed: role `cms_relay` with rights on `cms_outbox` only.

**S18.** P17: "A status that only shows how far another system has got, with nothing of this
system's hanging on it, is no wait." Reading A: billing's pending invoice awaiting `OrderPaid` holds
nothing and is no wait. Reading B: a pending document is held. Took A. Changed: no deadline on
pending invoices; they end by `OrderPaid`, `ShipmentDispatched` or `OrderCancelled`.

**S19.** P5: "Anything outside a system MUST reach into it only through its offer or by a driving
adapter's way in." Reading A: the worker's POST to `/api/internal/shop/revalidate` is shop's driven
adapter reaching its own far side, no way into shop. Reading B: it is a way in and needs a driving
port. Took A. Changed: `revalidate-route.ts` lives under `adapters/driven/page-cache/` and calls
only `revalidateTag`.

**S20.** P10: "Its writes MUST NOT fail on a change to records that no business rule ties to the use
case's goal." Reading A: gaplessness ties every number assignment in a series, so they may fail each
other. Reading B: invoices of different customers are untied and must not collide. Took A. Changed:
one `NumberSeries` row per kind and year, contended by design, and kept out of the invoice aggregate
so only assignment contends.
