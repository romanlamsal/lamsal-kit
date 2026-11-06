# Fresh repository draft B, distilled set

`teashop`: pnpm monorepo, TypeScript 5 strict, Node 22, Next.js 15 (app router) hosting Payload CMS 3, Drizzle on one
Postgres 16 instance, Stripe, a 3PL API with webhooks, a bank API, a mail provider, pino, OpenTelemetry to Jaeger,
`prom-client` for `/metrics`, vitest, Biome, dependency-cruiser. Money is integer euro cents, gross. Ids are uuidv7 unless
an owner's id is kept.

## Systems and what each owns

| System | Kind | Owns (its business rules decide) | Keeps (records; Postgres schema = store) |
|---|---|---|---|
| `shop` | system | carts; customers (identified by e-mail); which payment methods checkout offers; orders, their lines (snapshots of price, sku, tax class) and their lifecycle; the card payment deadline (placed + 60 min). Its `Order` aggregate is the process manager of the order across systems (orchestration). | schema `shop`: `carts`, `cart_lines`, `customers`, `orders`, `order_lines`, `listings` (replica of cms products), `debtor_standings` (replica of billing), `page_cache_entries`, `page_cache_tags`, `idempotency`, `outbox` |
| `billing` | system | card payments (open, void, succeeded, disputed); refunds and whether a payment may be refunded; invoices, credit notes, VAT rate per tax class (tea 7 %, accessories 19 %); gapless numbering; bank transfers and matching; debtors and their dunning stage | schema `billing`: `card_payments`, `refunds`, `refund_lines`, `invoices`, `invoice_lines`, `credit_notes`, `credit_note_lines`, `number_series`, `bank_transfers`, `bank_cursor`, `debtors`, `dunning_reminders`, `idempotency`, `outbox` |
| `fulfillment` | system | stock per sku (on hand, reserved, available); reservations and their 30 min hold; articles and their registration with the 3PL; shipments | schema `fulfillment`: `stock_items`, `reservations`, `reservation_lines`, `articles`, `shipments`, `shipment_lines`, `idempotency`, `outbox` |
| `backoffice` | system | the order overview: how an order's order, invoice, credit-note and shipment states read together, and when an order needs attention (paid and not dispatched after 3 days; refund failed or refused; cancelled with an open invoice) | schema `backoffice`: `order_overviews`, `overview_invoices`, `overview_shipments`, `unmatched_transfers` (all replicas), `idempotency` |

External systems:

| External system | Run by | Owns | Talks to us through |
|---|---|---|---|
| `cms` (Payload CMS 3) | us, in the `web` process | products: copy, images, slug, price, sku, tax class; its own rules price > 0 and sku unique, held in the collection config we write (`min: 1` on `price`, `unique: true` on `sku`) | its API (admin UI, REST); its outbox collection `outbox` (schema `payload`), written by a product `afterChange`/`afterDelete` hook inside Payload's own transaction; its field hook on `products.stock` |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | API driven by `billing`; webhooks into `billing` |
| 3PL warehouse | vendor | physical stock, article master, warehouse orders | API driven by `fulfillment`; webhooks into `fulfillment` |
| Bank | vendor | account transactions | API polled by `billing` |
| Mail provider | vendor | mail delivery | API driven by `shop` and `billing` |

Shared kernel: `@teashop/kernel-money` (`kernels/money`): `Money` (`{ cents: number; currency: 'EUR' }`), `add`, `multiply`,
`sum`, `isPositive`, `compare`. Imported into the domains of `shop`, `billing`, `backoffice`. Nothing else is shared.

Code that is no system:

- Common libraries: `@teashop/result` (the `Result` type), `@teashop/observability` (pino logger, OpenTelemetry SDK setup,
  `AsyncLocalStorage` request context, `prom-client` registry), `@teashop/messaging` (envelope, outbox and idempotency table
  factories, Drizzle outbox reader, relay, bus, scheduler), `@teashop/postgres` (pool factory, Drizzle unit-of-work helper,
  optimistic-version helper).
- Assembly and courier: `apps/web/src/assembly.ts`, `apps/web/src/courier.ts`, the one-line Next.js route shims,
  `apps/web/src/payload.config.ts`, `apps/worker/src/assembly.ts`, `apps/worker/src/cms-outbox-reader.ts`.
- Probes: `/health` and `/metrics` in `web` and in `worker`.
- The `migrate` job (`apps/migrate`), which runs the systems' and the CMS's migrations.
- Tooling: `tooling/*` (dependency rules, migration and published-language checks, dead-letter requeue script).

Relationships (upstream → downstream, pattern):

| Upstream | Downstream | Pattern |
|---|---|---|
| `cms` | `shop`, `fulfillment` | anti-corruption layer (handlers translate `cms.product.*`) |
| `fulfillment` | `shop` | anti-corruption layer (`FulfillmentStockHolds`, outbox translation, fulfillment-event handler) |
| `billing` | `shop`, `backoffice` | anti-corruption layer |
| `shop` | `backoffice` | anti-corruption layer |
| `fulfillment` | `backoffice` | anti-corruption layer |
| Stripe | `billing` | anti-corruption layer |
| 3PL | `fulfillment` | anti-corruption layer |
| Bank, mail provider | `billing`; `shop`, `billing` | anti-corruption layer |

Each pair has one direction: the downstream calls the upstream's open host service, sends the upstream's commands and
handles the upstream's events. `billing` and `fulfillment` never import or name `shop`; `shop` sends them commands.

## Ports and adapters

### Common types (common libraries)

```ts
// libs/result/src/index.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Refused<R extends { readonly code: string }> = { readonly ok: false; readonly refusal: R };
export type Result<T, R extends { readonly code: string }> = Ok<T> | Refused<R>;

// libs/messaging/src/envelope.ts
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };
export type Envelope<TType extends string = string, TPayload = unknown> = {
  readonly id: string;                         // uuidv7; same on every delivery
  readonly type: TType;                        // "billing.IssueInvoice"
  readonly version: number;                    // payload schema version
  readonly kind: 'event' | 'command';
  readonly visibility: 'published' | 'private';
  readonly source: 'shop' | 'billing' | 'fulfillment' | 'cms';
  readonly occurredAt: string;                 // ISO 8601
  readonly correlationId: string;              // order id where there is one
  readonly causationId: string | null;         // id of the message or idempotency key that caused it
  readonly requestId: string | null;
  readonly traceparent: string | null;         // W3C trace context at write time
  readonly payload: TPayload;
};
export type OutboxReader = {
  readonly source: Envelope['source'];
  lease(limit: number, leaseMs: number): Promise<ReadonlyArray<Envelope>>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, error: string, retryAt: Date): Promise<void>;
};
export type Handler = {
  readonly name: string;                       // "billing.commands"
  readonly subscribesTo: ReadonlyArray<string>;
  handle(message: Envelope): Promise<void>;    // throws => relay retries the message
};
export type Bus = { deliver(message: Envelope): Promise<void> };
export type ScheduledTask = { readonly name: string; readonly cron: string; run(at: Date): Promise<void> };
export type Codec<A> = { encode(a: A): unknown; decode(json: unknown): A };   // built from zod schemas
```

Every acting driving port takes an `idempotencyKey`: the `Idempotency-Key` header for HTTP, the message id for handlers,
the vendor event id for hooks, `task:<name>:<scheduled ISO time>` for scheduled tasks, a key derived from the caller's own
for synchronous calls between systems. Every repository of an aggregate saves with an optimistic `version` check and throws
`ConcurrencyConflict` (from `@teashop/postgres`) on mismatch; the service retries the whole use case up to three times.

Driving ports are one function type per use case. Driven ports are interfaces. Services are factories:
`createPlaceOrder(deps): PlaceOrder`.

### `shop`

Driving ports (`systems/shop/src/ports/driving.ts`):

```ts
export type BrowseCatalog = (q: { page: number }) => Promise<CatalogPage>;
export type ViewListing = (q: { slug: string }) => Promise<ListingView | null>;
export type ViewCart = (q: { cartId: CartId }) => Promise<CartView | null>;
export type ChangeCartLine = (c: { idempotencyKey: IdempotencyKey; cartId: CartId | null; listingId: ListingId; quantity: number })
  => Promise<Result<CartView, { code: 'LISTING_NOT_SELLABLE' } | { code: 'QUANTITY_OUT_OF_RANGE' }>>;
export type StartCheckout = (q: { cartId: CartId; email: string })
  => Promise<Result<{ paymentMethods: ReadonlyArray<'card' | 'invoice'>; total: Money }, { code: 'CART_EMPTY' }>>;
export type PlaceOrder = (c: {
  idempotencyKey: IdempotencyKey; cartId: CartId; paymentMethod: 'card' | 'invoice';
  customer: { email: string; name: string; address: PostalAddress };
}) => Promise<Result<
  { orderId: OrderId; paymentMethod: 'card'; cardClientSecret: string } | { orderId: OrderId; paymentMethod: 'invoice' },
  | { code: 'CART_EMPTY' } | { code: 'LISTING_NOT_SELLABLE'; listingIds: ReadonlyArray<ListingId> }
  | { code: 'INVOICE_NOT_OFFERED' } | { code: 'OUT_OF_STOCK'; skus: ReadonlyArray<Sku> } | { code: 'CARD_PAYMENT_UNAVAILABLE' }
>>;
export type ViewOrder = (q: { orderId: OrderId }) => Promise<OrderView | null>;
// fed by handlers (anti-corruption layer translates first)
export type SyncListing = (c: { idempotencyKey: IdempotencyKey; listing: ListingSource }) => Promise<void>;
export type WithdrawListing = (c: { idempotencyKey: IdempotencyKey; listingId: ListingId; sourceSeq: number }) => Promise<void>;
export type RecordDebtorStanding = (c: { idempotencyKey: IdempotencyKey; customerId: CustomerId; inDunning: boolean; standingVersion: number }) => Promise<void>;
export type RecordCardPaymentSucceeded = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
export type RecordCardPaymentVoided = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
export type RecordInvoiceSettled = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
export type RecordPaymentRefunded = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId; outcome: 'refunded' | 'refundFailed' | 'refundRefused' }) => Promise<void>;
export type RecordStockLapsed = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
export type RecordShipmentRefused = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
export type RecordShipmentDispatched = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId; dispatchedAt: Date; trackingNumber: string | null }) => Promise<void>;
export type RecordInvoiceCancellationRefused = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
// private message
export type SendOrderConfirmation = (c: { idempotencyKey: IdempotencyKey; orderId: OrderId }) => Promise<void>;
```

Driven ports (`systems/shop/src/ports/driven.ts`):

```ts
export interface ShopUnitOfWork { run<T>(work: (tx: ShopTx) => Promise<T>): Promise<T> }
export type ShopTx = {
  readonly carts: CartRepository; readonly orders: OrderRepository; readonly customers: CustomerRepository;
  readonly listings: ListingReplica; readonly standings: DebtorStandingReplica;
  readonly pageCache: PageCacheInvalidation; readonly idempotency: IdempotencyStore; readonly outbox: ShopOutbox;
};
export interface OrderRepository { load(id: OrderId): Promise<Order | null>; save(order: Order): Promise<void> }
export interface CartRepository { load(id: CartId): Promise<Cart | null>; save(cart: Cart): Promise<void>; remove(id: CartId): Promise<void> }
export interface CustomerRepository { findByEmail(email: EmailAddress): Promise<Customer | null>; save(customer: Customer): Promise<void> }
export interface ListingReplica {
  load(id: ListingId): Promise<Listing | null>; findBySlug(slug: string): Promise<Listing | null>;
  page(offset: number, limit: number): Promise<ReadonlyArray<Listing>>; save(listing: Listing): Promise<void>;
}
export interface DebtorStandingReplica { load(id: CustomerId): Promise<DebtorStanding | null>; save(s: DebtorStanding): Promise<void> }
export interface PageCacheInvalidation { invalidate(tags: ReadonlyArray<string>): Promise<void> }   // same transaction
export interface IdempotencyStore {
  claim<A>(key: IdempotencyKey, port: string, codec: Codec<A>): Promise<{ claimed: true } | { claimed: false; answer: A }>;
  complete<A>(key: IdempotencyKey, port: string, codec: Codec<A>, answer: A): Promise<void>;
}
export type ShopOutgoing =
  | { type: 'OrderPlaced'; order: Order } | { type: 'OrderStatusChanged'; order: Order }
  | { type: 'ConfirmStockHold'; order: Order } | { type: 'ReleaseStockHold'; order: Order }
  | { type: 'RequestShipment'; order: Order; recipient: Customer } | { type: 'RequestInvoice'; order: Order; customer: Customer }
  | { type: 'RequestInvoiceCancellation'; order: Order } | { type: 'RequestCardRefund'; order: Order }
  | { type: 'SendOrderConfirmation'; order: Order };                                          // private
export interface ShopOutbox { add(message: ShopOutgoing, cause: IdempotencyKey): Promise<void> }
// outside the transaction
export interface StockHolds {
  hold(orderId: OrderId, lines: ReadonlyArray<{ sku: Sku; quantity: number }>, key: IdempotencyKey):
    Promise<{ held: true } | { held: false; short: ReadonlyArray<Sku> }>;
}
export interface CardPayments {
  open(req: { orderId: OrderId; customerId: CustomerId; total: Money; deadline: Date; lines: ReadonlyArray<OrderLine> }, key: IdempotencyKey):
    Promise<{ opened: true; clientSecret: string } | { opened: false }>;
}
export interface OrderMailer { sendConfirmation(mail: OrderConfirmationMail, dedupeKey: string): Promise<void> }
export interface Clock { now(): Date }
export interface ShopIds { order(): OrderId; cart(): CartId; customer(): CustomerId }
```

Adapters:

- Driving: `adapters/driving/http/cart-route.ts` (`PUT /api/cart/lines` → `ChangeCartLine`, `GET /api/cart` → `ViewCart`),
  `http/checkout-route.ts` (`POST /api/checkout/options` → `StartCheckout`, `POST /api/checkout` → `PlaceOrder`; refusals →
  409/422 `{ code }`; `CARD_PAYMENT_UNAVAILABLE` → 503), `http/order-route.ts` (`GET /api/orders/:id` → `ViewOrder`),
  `pages/catalog-loaders.ts` (RSC loaders for `/`, `/products/[slug]`, tagged `catalog` and `listing:<slug>` → `BrowseCatalog`,
  `ViewListing`), `pages/next-cache-handler.ts` (Next.js `cacheHandler` over `page_cache_entries`/`page_cache_tags`),
  `handlers/cms-product-handler.ts` (`cms.product.changed` v1, `cms.product.deleted` v1 → `SyncListing`, `WithdrawListing`;
  translates Payload's document into `ListingSource`), `handlers/billing-events-handler.ts`,
  `handlers/fulfillment-events-handler.ts`, `handlers/private-handler.ts` (`shop.SendOrderConfirmation`).
- Driven: `adapters/driven/drizzle/{schema,unit-of-work,order-repository,cart-repository,customer-repository,listing-replica,debtor-standing-replica,page-cache-invalidation,idempotency-store,outbox}.ts`;
  `outbox-translation.ts` (`ShopOutgoing` → envelopes in shop's, fulfillment's or billing's published language);
  `fulfillment-stock-holds.ts` (`StockHolds` over fulfillment's `ReserveStock`); `billing-card-payments.ts` (`CardPayments`
  over billing's `OpenCardPayment`); `mail-order-mailer.ts` (HTTP to the mail provider, `Idempotency-Key: <dedupeKey>`);
  `system-clock.ts`; `uuidv7-ids.ts`; `fake/{in-memory-unit-of-work,fake-stock-holds,fake-card-payments,recording-order-mailer,fixed-clock,sequential-ids}.ts`.

`PlaceOrder` in sequence (`systems/shop/src/service/place-order.ts`):

```ts
export const createPlaceOrder = (d: { uow: ShopUnitOfWork; stockHolds: StockHolds; cardPayments: CardPayments; clock: Clock; ids: ShopIds }): PlaceOrder =>
  async (c) => {
    // 1. tx: claim key; replay answer if claimed; read cart, listings, standing; Order.draft(...) decides lines (snapshots),
    //    payment-method eligibility, deadline; returns refusal or draft. Draft (order id, customer id) stored under the key.
    // 2. stockHolds.hold(orderId, lines, `${key}:hold`)            -> refusal OUT_OF_STOCK (hold expires by itself)
    // 3. card only: cardPayments.open(..., `${key}:card`)          -> refusal CARD_PAYMENT_UNAVAILABLE (hold expires)
    // 4. tx: orders.save(Order.place(draft)); carts.remove; customers.save;
    //    outbox: OrderPlaced, ConfirmStockHold, SendOrderConfirmation, invoice only: RequestShipment, RequestInvoice;
    //    idempotency.complete(key, answer incl. clientSecret)
  };
```

### `billing`

Driving ports (`systems/billing/src/ports/driving.ts`; the first three are its open host service):

```ts
export type OpenCardPayment = (c: { idempotencyKey: IdempotencyKey; orderRef: string; debtorId: string; amount: Money; expiresAt: Date; lines: ReadonlyArray<ChargeLine> })
  => Promise<Result<{ clientSecret: string }, { code: 'GATEWAY_UNAVAILABLE' } | { code: 'AMOUNT_DIFFERS_FROM_LINES' }>>;
export type RequestRefund = (c: { idempotencyKey: IdempotencyKey; orderRef: string; lines: 'all' | ReadonlyArray<{ invoiceLineNo: number; quantity: number }> })
  => Promise<Result<{ refundId: string }, { code: 'NO_CARD_PAYMENT' } | { code: 'CHARGE_DISPUTED' } | { code: 'NOTHING_LEFT_TO_REFUND' }>>;
export type MatchTransfer = (c: { idempotencyKey: IdempotencyKey; transferId: string; invoiceNumber: string })
  => Promise<Result<void, { code: 'TRANSFER_ALREADY_MATCHED' } | { code: 'INVOICE_NOT_OPEN' } | { code: 'AMOUNT_DIFFERS' }>>;
// commands it takes
export type IssueInvoice = (c: { idempotencyKey: IdempotencyKey; orderRef: string; debtor: DebtorDetails; lines: ReadonlyArray<ChargeLine> }) => Promise<Result<{ invoiceNumber: string }, never>>;
export type CancelInvoice = (c: { idempotencyKey: IdempotencyKey; orderRef: string }) => Promise<Result<{ creditNoteNumber: string }, { code: 'INVOICE_SETTLED' } | { code: 'NO_INVOICE' }>>;
//   RefundCardPayment command → RequestRefund with lines: 'all'
// hook (Stripe)
export type RecordCardPaymentSucceeded = (c: { idempotencyKey: IdempotencyKey; gatewayPaymentId: string; amount: Money; succeededAt: Date }) => Promise<void>;
export type RecordCardPaymentCanceled = (c: { idempotencyKey: IdempotencyKey; gatewayPaymentId: string }) => Promise<void>;
export type RecordChargeDisputed = (c: { idempotencyKey: IdempotencyKey; gatewayPaymentId: string; disputedAt: Date }) => Promise<void>;
export type RecordRefundOutcome = (c: { idempotencyKey: IdempotencyKey; refundId: string; outcome: 'succeeded' | 'failed'; failureCode: string | null }) => Promise<void>;
// scheduled tasks
export type VoidExpiredCardPayments = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ voidsRequested: number }>;
export type ImportBankTransfers = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ imported: number; matched: number }>;
export type RunDunning = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ stagesRaised: number }>;
export type ReconcileCardPayments = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ repaired: number }>;
// private messages
export type VoidCardPaymentAtGateway = (c: { idempotencyKey: IdempotencyKey; cardPaymentId: string }) => Promise<void>;
export type SubmitRefund = (c: { idempotencyKey: IdempotencyKey; refundId: string }) => Promise<void>;
export type SendInvoiceMail = (c: { idempotencyKey: IdempotencyKey; documentNumber: string }) => Promise<void>;
export type SendDunningReminder = (c: { idempotencyKey: IdempotencyKey; debtorId: string; stage: 1 | 2 | 3 }) => Promise<void>;
```

Driven ports:

```ts
export interface BillingUnitOfWork { run<T>(work: (tx: BillingTx) => Promise<T>): Promise<T> }
export type BillingTx = {
  readonly cardPayments: CardPaymentRepository; readonly refunds: RefundRepository; readonly invoices: InvoiceRepository;
  readonly creditNotes: CreditNoteRepository; readonly numberSeries: NumberSeriesRepository;   // load() locks the row (FOR UPDATE)
  readonly transfers: BankTransferRepository; readonly bankCursor: BankCursorRepository; readonly debtors: DebtorRepository;   // load() locks the row
  readonly idempotency: IdempotencyStore; readonly outbox: BillingOutbox;
};
export interface CardGateway {
  createPayment(p: { amount: Money; reference: string; key: IdempotencyKey }): Promise<{ gatewayPaymentId: string; clientSecret: string }>;
  cancelPayment(gatewayPaymentId: string, key: IdempotencyKey): Promise<{ outcome: 'canceled' | 'alreadySucceeded' }>;
  refund(r: { gatewayPaymentId: string; amount: Money; refundId: string }): Promise<{ outcome: 'submitted' | 'refusedDisputed' }>;
  paymentsCreatedSince(since: Date): Promise<ReadonlyArray<{ gatewayPaymentId: string; reference: string; status: 'open' | 'succeeded' | 'canceled'; amount: Money }>>;
}
export interface BankStatements { since(cursor: string | null): Promise<{ transfers: ReadonlyArray<IncomingTransfer>; cursor: string }> }
export interface BillingMailer { send(mail: InvoiceMail | DunningReminderMail, dedupeKey: string): Promise<void> }
export interface Clock { now(): Date }
export interface BillingIds { cardPayment(): string; refund(): string; transfer(): string }
export interface BillingOutbox { add(message: BillingOutgoing, cause: IdempotencyKey): Promise<void> }
```

Adapters:

- Driving: `adapters/driving/hooks/stripe-hook.ts` (`POST /api/hooks/stripe`; `stripe.webhooks.constructEvent`;
  `payment_intent.succeeded`, `payment_intent.canceled`, `charge.dispute.created`, `refund.updated` → the four `Record*`
  ports, key = Stripe event id; unknown types → 200 and ignored); `handlers/commands-handler.ts` (`billing.IssueInvoice`,
  `billing.CancelInvoice`, `billing.RefundCardPayment`); `handlers/private-handler.ts`; `tasks/{void-expired-card-payments
  (* * * * *),import-bank-transfers (*/5 * * * *),run-dunning (0 6 * * * Europe/Berlin),reconcile-card-payments (17 * * * *)}.ts`.
- Driven: `drizzle/*` as in shop plus `number-series-repository.ts`; `stripe-card-gateway.ts` (`stripe` SDK,
  idempotency keys); `bank-api-statements.ts`; `mail-billing-mailer.ts`; `outbox-translation.ts`; `system-clock.ts`;
  `uuidv7-ids.ts`; `fake/{in-memory-unit-of-work,fake-card-gateway,fake-bank-statements,recording-billing-mailer}.ts`.

### `fulfillment`

Driving ports (first two are its open host service):

```ts
export type ReserveStock = (c: { idempotencyKey: IdempotencyKey; reservationId: string; lines: ReadonlyArray<{ sku: string; quantity: number }> })
  => Promise<Result<{ holdUntil: Date }, { code: 'INSUFFICIENT_STOCK'; skus: ReadonlyArray<string> }>>;
export type GetStockLevels = (q: { skus: ReadonlyArray<string> }) => Promise<ReadonlyArray<{ sku: string; onHand: number; reserved: number; available: number }>>;
// commands it takes
export type ConfirmReservation = (c: { idempotencyKey: IdempotencyKey; reservationId: string }) => Promise<Result<void, { code: 'RESERVATION_LAPSED' }>>;
export type ReleaseReservation = (c: { idempotencyKey: IdempotencyKey; reservationId: string }) => Promise<Result<void, never>>;
export type ShipOrder = (c: { idempotencyKey: IdempotencyKey; shipmentRef: string; reservationId: string; recipient: Recipient; lines: ReadonlyArray<{ sku: string; quantity: number }> })
  => Promise<Result<{ shipmentId: string }, { code: 'RESERVATION_LAPSED' }>>;
// from cms events
export type RegisterArticle = (c: { idempotencyKey: IdempotencyKey; sku: string; name: string; sourceSeq: number }) => Promise<void>;
// hook (3PL)
export type RecordDispatch = (c: { idempotencyKey: IdempotencyKey; shipmentRef: string; dispatchedAt: Date; carrier: string; trackingNumber: string | null }) => Promise<void>;
// scheduled tasks
export type ExpireHolds = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ lapsed: number }>;
export type ReconcileStock = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ adjusted: number }>;
export type ReconcileShipments = (c: { idempotencyKey: IdempotencyKey }) => Promise<{ repaired: number }>;
// private messages
export type SubmitArticle = (c: { idempotencyKey: IdempotencyKey; sku: string }) => Promise<void>;
export type SubmitShipment = (c: { idempotencyKey: IdempotencyKey; shipmentId: string }) => Promise<void>;
```

Driven ports:

```ts
export type FulfillmentTx = {
  readonly stockItems: StockItemRepository;    // lockMany(skus) locks rows FOR UPDATE in sku order
  readonly reservations: ReservationRepository; readonly articles: ArticleRepository; readonly shipments: ShipmentRepository;
  readonly idempotency: IdempotencyStore; readonly outbox: FulfillmentOutbox;
};
export interface FulfillmentUnitOfWork { run<T>(work: (tx: FulfillmentTx) => Promise<T>): Promise<T> }
export interface Warehouse {
  upsertArticle(a: { sku: string; name: string }): Promise<void>;                        // PUT, idempotent
  findOrder(shipmentRef: string): Promise<WarehouseOrderState | null>;
  submitOrder(o: { shipmentRef: string; recipient: Recipient; lines: ReadonlyArray<{ sku: string; quantity: number }> }): Promise<void>;
  stockReport(): Promise<{ asOf: Date; levels: ReadonlyArray<{ sku: string; onHand: number }> }>;
}
export interface Clock { now(): Date }
export interface FulfillmentIds { shipment(): string }
```

Adapters:

- Driving: `hooks/tpl-hook.ts` (`POST /api/hooks/3pl`; `shipment.dispatched` → `RecordDispatch`, key = 3PL event id);
  `hooks/cms-stock-field-hook.ts` (`createStockFieldHook(courier: () => Promise<GetStockLevels>): FieldHook` for Payload's
  virtual read-only `stock` field; failures answer `null`, shown as "unknown"); `handlers/commands-handler.ts`;
  `handlers/cms-product-handler.ts`; `handlers/private-handler.ts`; `tasks/{expire-holds (* * * * *),reconcile-stock
  (0 3 * * *),reconcile-shipments (23 * * * *)}.ts`.
- Driven: `drizzle/*`; `tpl-warehouse.ts`; `outbox-translation.ts`; `system-clock.ts`; `uuidv7-ids.ts`;
  `fake/{in-memory-unit-of-work,fake-warehouse}.ts`.

### `backoffice`

```ts
export type RefundLines = 'all' | ReadonlyArray<{ invoiceLineNo: number; quantity: number }>;
// driving
export type ListOrderOverviews = (q: { filter: 'all' | 'needsAttention'; page: number }) => Promise<OverviewPage>;
export type ViewOrderOverview = (q: { orderId: string }) => Promise<OrderOverviewView | null>;
export type ListUnmatchedTransfers = (q: { page: number }) => Promise<UnmatchedTransferPage>;
export type RefundOrder = (c: { idempotencyKey: IdempotencyKey; orderId: string; lines: RefundLines })
  => Promise<Result<void, { code: 'NOT_REFUNDABLE'; reason: 'noCardPayment' | 'disputed' | 'nothingLeft' }>>;
export type AssignTransfer = (c: { idempotencyKey: IdempotencyKey; transferId: string; invoiceNumber: string })
  => Promise<Result<void, { code: 'NOT_ASSIGNABLE'; reason: 'alreadyMatched' | 'invoiceNotOpen' | 'amountDiffers' }>>;
export type ProjectOrder = (c: { idempotencyKey: IdempotencyKey; orderId: string; change: OrderFacts; version: number }) => Promise<void>;
export type ProjectInvoice = (c: { idempotencyKey: IdempotencyKey; orderId: string; change: InvoiceFacts; version: number }) => Promise<void>;
export type ProjectShipment = (c: { idempotencyKey: IdempotencyKey; orderId: string; change: ShipmentFacts; version: number }) => Promise<void>;
export type ProjectTransfer = (c: { idempotencyKey: IdempotencyKey; transferId: string; change: TransferFacts }) => Promise<void>;
// driven
export interface BackofficeUnitOfWork { run<T>(work: (tx: { overviews: OrderOverviewRepository; transfers: UnmatchedTransferReplica; idempotency: IdempotencyStore }) => Promise<T>): Promise<T> }
export interface Refunds { request(orderId: string, lines: RefundLines, key: IdempotencyKey): Promise<{ accepted: true } | { accepted: false; reason: 'noCardPayment' | 'disputed' | 'nothingLeft' }> }
export interface TransferAssignments { assign(transferId: string, invoiceNumber: string, key: IdempotencyKey): Promise<{ assigned: true } | { assigned: false; reason: 'alreadyMatched' | 'invoiceNotOpen' | 'amountDiffers' }> }
export interface Clock { now(): Date }
```

Adapters: driving `http/ops-routes.ts` (`/ops`, `/ops/orders/:id`, `/ops/transfers`, `POST /ops/orders/:id/refund`,
`POST /ops/transfers/:id/assign`), `handlers/{shop,billing,fulfillment}-events-handler.ts`; driven `drizzle/*`,
`billing-refunds.ts` (over billing's `RequestRefund`), `billing-transfer-assignments.ts` (over `MatchTransfer`),
`system-clock.ts`, `fake/*`.

### `cms` (external; configuration we write)

`externals/cms/src/build-cms-config.ts`:

```ts
export function buildCmsConfig(i: { databaseUrl: string; secret: string; stockField: FieldHook; serverUrl: string }): Promise<SanitizedConfig>;
```

Collections `products` (title, description, images → `media`, slug unique, price number `min: 1` in cents, sku text
`unique: true`, taxClass select `tea | accessories`, `stock` virtual number `admin.readOnly`, `hooks.afterRead: [stockField]`),
`media`, `users`, `outbox` (hidden: `messageId`, `type`, `version`, `payload` json, `deliveredAt`, `leaseUntil`,
`attempts`, `lastError`, `deadLetteredAt`). `hooks/write-product-outbox.ts` on `afterChange`/`afterDelete` calls
`req.payload.create({ collection: 'outbox', data, req })`, so the outbox row commits in Payload's transaction. Payload's
database adapter is `@payloadcms/db-postgres` with `schemaName: 'payload'`.

### Offers (each system's `src/offer/index.ts`)

- `shop`: published language `shop.OrderPlaced` v1, `shop.OrderStatusChanged` v1 (zod schemas + inferred types). No open
  host service.
- `billing`: types of `OpenCardPayment`, `RequestRefund`, `MatchTransfer`; commands `billing.IssueInvoice` v1,
  `billing.CancelInvoice` v1, `billing.RefundCardPayment` v1; its events (below); fakes `fakeOpenCardPayment`,
  `fakeRequestRefund`, `fakeMatchTransfer`; system builder `buildBilling`.
- `fulfillment`: types of `ReserveStock`, `GetStockLevels`; commands `fulfillment.ConfirmReservation` v1,
  `fulfillment.ReleaseReservation` v1, `fulfillment.ShipOrder` v1; its events; fakes `fakeReserveStock`,
  `fakeGetStockLevels`; system builders `buildFulfillment`, `createStockFieldHook`.
- `backoffice`: system builder only.

System builder shape (one per system, same shape):

```ts
export function buildShop(i: {
  config: ShopConfig;                                     // { databaseUrl; mail: { apiUrl; apiKey; from } }, zod-validated
  process: { logger: Logger; meter: Registry };          // what the process holds once
  upstream: { reserveStock: ReserveStock; openCardPayment: OpenCardPayment };   // other systems' driving ports
}): {
  web: { routes: ShopRoutes; pages: ShopPageLoaders; pageCacheStore: PageCacheStore };
  worker: { handlers: ReadonlyArray<Handler>; tasks: ReadonlyArray<ScheduledTask> };
  outboxReader: OutboxReader;
  probe: () => Promise<boolean>;                         // select 1 on its pool
  close(): Promise<void>;
};
```

`buildBilling` and `buildFulfillment` also return `offer: { openCardPayment, requestRefund, matchTransfer }` and
`offer: { reserveStock, getStockLevels }`: the services themselves, which assembly hands to the downstream builders.
Each builder creates its own `pg.Pool` from its `databaseUrl` (its own role).

## Calls and messages

### Synchronous calls between systems (in-process function calls, assembly-wired)

| Caller (driven port → adapter) | Callee driving port | When | Refusal comes back as |
|---|---|---|---|
| `shop` `StockHolds` → `FulfillmentStockHolds` | `fulfillment` `ReserveStock` | `PlaceOrder`, step 2 | `Result` refusal `INSUFFICIENT_STOCK{skus}` → `{ held: false, short }` → `PlaceOrder` refuses `OUT_OF_STOCK` → HTTP 409 |
| `shop` `CardPayments` → `BillingCardPayments` | `billing` `OpenCardPayment` | `PlaceOrder` (card), step 3 | `GATEWAY_UNAVAILABLE` → `{ opened: false }` → `CARD_PAYMENT_UNAVAILABLE` → HTTP 503; the hold lapses after 30 min |
| `cms` field hook (`createStockFieldHook`) | `fulfillment` `GetStockLevels` | editor opens a product | answering, no refusal; a thrown error → field `null` |
| `backoffice` `Refunds` → `BillingRefunds` | `billing` `RequestRefund` | ops refund | `Result` refusal → `NOT_REFUNDABLE{reason}` → HTTP 409 |
| `backoffice` `TransferAssignments` → `BillingTransferAssignments` | `billing` `MatchTransfer` | ops assigns a transfer | `Result` refusal → `NOT_ASSIGNABLE{reason}` → HTTP 409 |

### Calls to external systems (all from driven adapters; HTTP)

| From | To | Calls | Synchronous inside a use case? |
|---|---|---|---|
| `billing` `StripeCardGateway` | Stripe | `paymentIntents.create` (idempotency key), `.cancel`, `.list`; `refunds.create` (idempotency key = refund id) | `create` inside `OpenCardPayment` before commit; the rest only from private-message handlers and tasks |
| `billing` `BankApiStatements` | bank | `GET /transactions?cursor=` | task only |
| `billing` `MailBillingMailer`, `shop` `MailOrderMailer` | mail provider | `POST /send` with `Idempotency-Key` | private-message handlers only |
| `fulfillment` `TplWarehouse` | 3PL | `PUT /articles/{sku}`, `GET /orders?reference=`, `POST /orders`, `GET /stock` | private-message handlers and tasks only |

### Hooks (external systems driving us)

| External | Endpoint / mechanism | Driving port | Answer |
|---|---|---|---|
| Stripe | `POST /api/hooks/stripe` (web) | billing `Record*` | 200 after commit or for ignored types; 400 bad signature; 500 on failure → Stripe retries |
| 3PL | `POST /api/hooks/3pl` (web) | fulfillment `RecordDispatch` | same |
| Payload | `products.stock` `afterRead` | fulfillment `GetStockLevels` | value or `null` |

### Messages (all asynchronous: outbox → relay → bus → handler; at-least-once, any order)

Published events:

| Type v1 | Written by | Delivered to | Payload (essentials) |
|---|---|---|---|
| `cms.product.changed` | `cms` (Payload outbox) | `shop` cms-product-handler, `fulfillment` cms-product-handler | Payload `doc`, `previousDoc.slug`, `previousDoc.sku`, `seq` |
| `cms.product.deleted` | `cms` | `shop`, `fulfillment` | `id`, `slug`, `sku`, `seq` |
| `shop.OrderPlaced` | `shop` | `backoffice` | order id, customer e-mail, method, lines, total, placedAt |
| `shop.OrderStatusChanged` | `shop` | `backoffice` | order id, fulfilment status, payment status, `statusVersion` |
| `billing.CardPaymentSucceeded` | `billing` | `shop`, `backoffice` | orderRef, amount, succeededAt |
| `billing.CardPaymentVoided` | `billing` | `shop` | orderRef |
| `billing.InvoiceIssued` | `billing` | `backoffice` | orderRef, number, totals, dueOn |
| `billing.InvoiceSettled` | `billing` | `shop`, `backoffice` | orderRef, number, how (card/transfer) |
| `billing.CreditNoteIssued` | `billing` | `backoffice` | orderRef, number, invoice number, total |
| `billing.CardPaymentRefunded` | `billing` | `shop`, `backoffice` | orderRef, refundId, amount, fullyRefunded |
| `billing.RefundFailed` | `billing` | `shop`, `backoffice` | orderRef, refundId, failureCode |
| `billing.ChargeDisputed` | `billing` | `backoffice` | orderRef |
| `billing.DebtorStandingChanged` | `billing` | `shop` | debtorId, stage, inDunning, `standingVersion` |
| `billing.UnmatchedTransferRecorded`, `billing.TransferMatched` | `billing` | `backoffice` | transfer id, amount, remittance, invoice number |
| `billing.CancelInvoiceRefused`, `billing.RefundCardPaymentRefused` | `billing` | `shop` | `commandId`, orderRef, code |
| `fulfillment.ConfirmReservationRefused`, `fulfillment.ShipOrderRefused` | `fulfillment` | `shop` | `commandId`, reservationId/shipmentRef, code `RESERVATION_LAPSED` |
| `fulfillment.ShipmentSubmitted` | `fulfillment` | `backoffice` | shipmentRef, `version` |
| `fulfillment.ShipmentDispatched` | `fulfillment` | `shop`, `backoffice` | shipmentRef, dispatchedAt, carrier, tracking, `version` |

Commands (written to the sender's outbox, in the receiver's published language; delivered only to the receiver):

| Type v1 | Sender | Receiver | Refusal comes back as |
|---|---|---|---|
| `fulfillment.ConfirmReservation` | `shop` | `fulfillment` | event `fulfillment.ConfirmReservationRefused` |
| `fulfillment.ReleaseReservation` | `shop` | `fulfillment` | never refused |
| `fulfillment.ShipOrder` | `shop` | `fulfillment` | event `fulfillment.ShipOrderRefused` |
| `billing.IssueInvoice` | `shop` | `billing` | never refused |
| `billing.CancelInvoice` | `shop` | `billing` | event `billing.CancelInvoiceRefused` |
| `billing.RefundCardPayment` | `shop` | `billing` | event `billing.RefundCardPaymentRefused` |

Rule: a refusal of an acting use case that is offered as a command is committed with its idempotency answer and published as
`<system>.<Command>Refused` with `commandId` = the idempotency key, whoever called; a synchronous caller also gets it as
the `Result`.

Private messages: `shop.SendOrderConfirmation`; `billing.VoidCardPaymentAtGateway`, `billing.SubmitRefund`,
`billing.SendInvoiceMail`, `billing.SendDunningReminder`; `fulfillment.SubmitArticle`, `fulfillment.SubmitShipment`.

### The order, end to end (orchestrated by `shop`'s `Order`)

`Order` has two dimensions: `fulfilment: 'awaitingPayment' | 'releasedForShipment' | 'shipped' | 'cancelled'` and
`payment: 'unpaid' | 'paid' | 'refundPending' | 'refunded' | 'refundFailed' | 'refundRefused'`, plus `stockLapsed`.

- Card: placed (`awaitingPayment`, deadline = placed + 60 min; billing's card payment `expiresAt` = deadline) →
  `CardPaymentSucceeded`: `paid`, `releasedForShipment`, sends `ShipOrder` → `ShipmentDispatched`: `shipped`.
  `CardPaymentVoided` (billing voided at `expiresAt`): `cancelled`, sends `ReleaseReservation`.
- Invoice: placed → `releasedForShipment` at once; sends `ConfirmReservation`, `ShipOrder`, `IssueInvoice` →
  `ShipmentDispatched`: `shipped`; `InvoiceSettled`: `paid` (either order).
- Stock lapsed (`ConfirmReservationRefused`/`ShipOrderRefused`): unpaid card → `stockLapsed`, waits for void or payment;
  paid card or a payment arriving afterwards → `cancelled`, `refundPending`, sends `RefundCardPayment`; invoice →
  `cancelled`, sends `CancelInvoice`. Refunds end in `refunded`, `refundFailed` or `refundRefused` (disputed), the last two
  shown as needing attention in `backoffice`.

## Processes

| Deployable | Entry point | Runs | Replicas |
|---|---|---|---|
| `web` | `apps/web` (`next start`); `src/instrumentation.ts` `register()` starts OpenTelemetry (`NodeSDK`, OTLP exporter → Jaeger, http/pg/undici instrumentations) | shop pages and APIs, checkout, Payload admin and API, `/ops` dashboard, Stripe and 3PL hooks, `/health`, `/metrics` | N, rolled one at a time |
| `worker` | `apps/worker/src/main.ts` | relay (one loop per outbox reader: shop, billing, fulfillment, cms), bus with all handlers, scheduler (`croner`; each run under `pg_try_advisory_lock(hashtext(task))`), probe server on `:9091` (`/health`, `/metrics`) | N, rolled one at a time |
| `migrate` | `apps/migrate/src/main.ts` | one-shot before every rollout | 1 |

Assembly:

- `apps/web/src/assembly.ts`: `assembleWeb(config: WebConfig): WebProcess`. Builds the process-held logger (pino, `mixin`
  reading request id and trace/span ids from `AsyncLocalStorage`) and the `prom-client` registry; calls `buildFulfillment`,
  `buildBilling`, then `buildShop` with `upstream: { reserveStock: fulfillment.offer.reserveStock, openCardPayment:
  billing.offer.openCardPayment }`, then `buildBackoffice` with `billing.offer.requestRefund`, `billing.offer.matchTransfer`.
  Returns `{ shop: shop.web, billing: billing.web, fulfillment: fulfillment.web, backoffice: backoffice.web, health, metrics }`.
- Courier (web): `apps/web/src/courier.ts` exports `web(): Promise<WebProcess>`, a per-process memoised call of
  `assembleWeb(loadWebConfig(process.env))`. Next.js route files, RSC pages, the Next.js `cacheHandler` and Payload's
  config are modules Next.js loads itself, so assembly cannot pass them arguments; each is a one-line shim:
  `export const POST = (r: Request) => web().then((w) => w.shop.routes.checkout.post(r));`.
  `apps/web/src/payload.config.ts`: `export default buildCmsConfig({ ..., stockField: createStockFieldHook(() => web().then((w) => w.fulfillment.getStockLevels)) })`.
- `apps/web/src/middleware.ts`: sets `x-request-id` (incoming or new uuidv7) on request and response; route shims wrap
  in `runWithRequestContext({ requestId }, ...)` from `@teashop/observability`.
- `apps/worker/src/assembly.ts`: same builders; returns `{ readers, bus, tasks, close }`. `createCmsOutboxReader(pool)`
  (`apps/worker/src/cms-outbox-reader.ts`) is the outbox reader for the external system, over `payload.outbox` on a pool
  with role `cms_outbox_reader` (SELECT/UPDATE on that one table). The worker needs no courier.
- Relay (`@teashop/messaging`): `UPDATE outbox SET lease_until = now() + 30s WHERE id IN (SELECT id FROM outbox WHERE
  delivered_at IS NULL AND dead_lettered_at IS NULL AND retry_at <= now() AND (lease_until IS NULL OR lease_until < now())
  ORDER BY seq LIMIT 50 FOR UPDATE SKIP LOCKED) RETURNING *`; for each row, restores `requestId` and `traceparent` into
  `AsyncLocalStorage`/OpenTelemetry context, `bus.deliver`, then `markDelivered`; on throw `markFailed` with retry at
  `min(2^attempts s, 15 min)`; after 25 attempts sets `dead_lettered_at` and increments `outbox_dead_letters_total`.
  Bus: map of type → handlers; delivers to each in turn; any throw fails the whole delivery (the others are idempotent).
  A message whose `version` a handler does not know throws `UnknownMessageVersion`, so an older worker retries it until a
  newer one takes it.
- Outbox writer (`@teashop/messaging` table factory used by each system's Drizzle outbox adapter) stamps `requestId` and
  `traceparent` from the current context.

Configuration values (env, zod-validated in `apps/*/src/config.ts`): `SHOP_DATABASE_URL`, `BILLING_DATABASE_URL`,
`FULFILLMENT_DATABASE_URL`, `BACKOFFICE_DATABASE_URL`, `CMS_DATABASE_URL`, `CMS_OUTBOX_READER_DATABASE_URL`,
`PAYLOAD_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TPL_BASE_URL`, `TPL_API_KEY`, `TPL_WEBHOOK_SECRET`,
`BANK_BASE_URL`, `BANK_API_KEY`, `BANK_ACCOUNT_ID`, `MAIL_API_URL`, `MAIL_API_KEY`, `MAIL_FROM`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_LEVEL`; `migrate` also `DATABASE_ADMIN_URL`.

Migrations (`apps/migrate`):

1. `bootstrap.sql` as admin, idempotent: schemas `shop`, `billing`, `fulfillment`, `backoffice`, `payload`; one login role
   per schema owning it; no cross-schema grants; `cms_outbox_reader` granted SELECT/UPDATE on `payload.outbox`.
2. Payload: `payload migrate` (migrations in `externals/cms/migrations`) with the `cms` role.
3. Each system: `drizzle-orm/node-postgres/migrator` `migrate(db, { migrationsFolder: 'systems/<s>/migrations',
   migrationsSchema: '<s>' })` with the system's role. Generated by `drizzle-kit generate` from
   `systems/<s>/drizzle.config.ts` (`schemaFilter: ['<s>']`).
4. Policy: a release ships expand migrations only (add table, add nullable column, add enum value). Contract migrations
   (drop, rename, type change) live in `migrations/contract/` and ship one release after the last code reading the old
   shape is gone. `tooling/check-migrations.ts` fails CI on destructive DDL outside `contract/`.

Rollout: `migrate` → worker replicas one by one → web replicas one by one.

Probes: `/health` runs `select 1` through each system's `probe()` and Payload's pool; 200 or 503. `/metrics` returns
`registry.metrics()` (default Node metrics, `http_request_duration_seconds`, `outbox_pending{source}`,
`outbox_oldest_pending_seconds{source}`, `outbox_dead_letters_total{source,type}`, `scheduled_task_runs_total{task,outcome}`).

## Directory tree

```
teashop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── vitest.workspace.ts
├── docker-compose.yml                      # postgres 16, jaeger (dev and integration tests)
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts                  # cacheHandler: ./src/next-cache-handler.ts
│   │   └── src/
│   │       ├── instrumentation.ts
│   │       ├── middleware.ts
│   │       ├── config.ts
│   │       ├── assembly.ts
│   │       ├── courier.ts
│   │       ├── payload.config.ts
│   │       ├── next-cache-handler.ts       # shim → shop.web.pageCacheStore
│   │       └── app/
│   │           ├── (shop)/page.tsx
│   │           ├── (shop)/products/[slug]/page.tsx
│   │           ├── (shop)/cart/page.tsx
│   │           ├── (shop)/checkout/page.tsx
│   │           ├── (shop)/orders/[orderId]/page.tsx
│   │           ├── (payload)/admin/[[...segments]]/page.tsx
│   │           ├── (payload)/admin/importMap.js
│   │           ├── (payload)/api/[...slug]/route.ts
│   │           ├── ops/page.tsx
│   │           ├── ops/orders/[orderId]/page.tsx
│   │           ├── ops/transfers/page.tsx
│   │           ├── api/cart/route.ts
│   │           ├── api/cart/lines/route.ts
│   │           ├── api/checkout/route.ts
│   │           ├── api/checkout/options/route.ts
│   │           ├── api/orders/[orderId]/route.ts
│   │           ├── api/ops/orders/[orderId]/refund/route.ts
│   │           ├── api/ops/transfers/[transferId]/assign/route.ts
│   │           ├── api/hooks/stripe/route.ts
│   │           ├── api/hooks/3pl/route.ts
│   │           ├── health/route.ts
│   │           └── metrics/route.ts
│   ├── worker/
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── config.ts
│   │       ├── assembly.ts
│   │       ├── cms-outbox-reader.ts
│   │       └── probe-server.ts
│   └── migrate/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── bootstrap.sql
│           ├── run-payload-migrations.ts
│           └── run-system-migrations.ts
├── externals/
│   └── cms/
│       ├── package.json
│       ├── migrations/                     # payload migrate:create output
│       └── src/
│           ├── build-cms-config.ts
│           ├── collections/products.ts
│           ├── collections/media.ts
│           ├── collections/users.ts
│           ├── collections/outbox.ts
│           ├── hooks/write-product-outbox.ts
│           └── published-language.ts       # cms.product.changed/deleted v1 schemas
├── kernels/
│   └── money/
│       ├── package.json
│       ├── src/money.ts
│       └── test/money.test.ts
├── libs/
│   ├── result/src/index.ts
│   ├── observability/
│   │   ├── src/{logger.ts,tracing.ts,request-context.ts,metrics.ts}
│   │   └── test/request-context.test.ts
│   ├── messaging/
│   │   ├── src/{envelope.ts,outbox-table.ts,idempotency-table.ts,drizzle-outbox-reader.ts,drizzle-idempotency-store.ts,relay.ts,bus.ts,scheduler.ts,codec.ts}
│   │   └── test/{relay.test.ts,bus.test.ts,drizzle-outbox-reader.int.test.ts}
│   └── postgres/
│       ├── src/{pool.ts,unit-of-work.ts,versioned-save.ts,concurrency-conflict.ts}
│       └── test/unit-of-work.int.test.ts
├── systems/
│   ├── shop/
│   │   ├── package.json                    # exports: "./offer", "./builders"
│   │   ├── drizzle.config.ts
│   │   ├── GLOSSARY.md
│   │   ├── migrations/{0000_init.sql,meta/,contract/}
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts
│   │   │   │   ├── listing.ts              # replica record + sellable
│   │   │   │   ├── cart.ts
│   │   │   │   ├── customer.ts
│   │   │   │   ├── debtor-standing.ts      # replica record
│   │   │   │   ├── invoice-payment-offered.ts   # specification
│   │   │   │   ├── order-line.ts           # snapshot
│   │   │   │   ├── payment-deadline.ts
│   │   │   │   └── order.ts                # aggregate, process manager
│   │   │   ├── service/
│   │   │   │   ├── browse-catalog.ts
│   │   │   │   ├── view-listing.ts
│   │   │   │   ├── view-cart.ts
│   │   │   │   ├── change-cart-line.ts
│   │   │   │   ├── start-checkout.ts
│   │   │   │   ├── place-order.ts
│   │   │   │   ├── view-order.ts
│   │   │   │   ├── sync-listing.ts
│   │   │   │   ├── withdraw-listing.ts
│   │   │   │   ├── record-debtor-standing.ts
│   │   │   │   ├── record-card-payment-succeeded.ts
│   │   │   │   ├── record-card-payment-voided.ts
│   │   │   │   ├── record-invoice-settled.ts
│   │   │   │   ├── record-payment-refunded.ts
│   │   │   │   ├── record-stock-lapsed.ts
│   │   │   │   ├── record-shipment-refused.ts
│   │   │   │   ├── record-shipment-dispatched.ts
│   │   │   │   ├── record-invoice-cancellation-refused.ts
│   │   │   │   ├── send-order-confirmation.ts
│   │   │   │   └── with-idempotency.ts     # claim → run → complete, retry on ConcurrencyConflict
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/
│   │   │   │   │   ├── http/{cart-route.ts,checkout-route.ts,order-route.ts,refusal-to-http.ts}
│   │   │   │   │   ├── pages/{catalog-loaders.ts,next-cache-handler.ts}
│   │   │   │   │   └── handlers/{cms-product-handler.ts,billing-events-handler.ts,fulfillment-events-handler.ts,private-handler.ts}
│   │   │   │   └── driven/
│   │   │   │       ├── drizzle/{schema.ts,unit-of-work.ts,order-repository.ts,cart-repository.ts,customer-repository.ts,listing-replica.ts,debtor-standing-replica.ts,page-cache-invalidation.ts,outbox.ts}
│   │   │   │       ├── outbox-translation.ts
│   │   │   │       ├── fulfillment-stock-holds.ts
│   │   │   │       ├── billing-card-payments.ts
│   │   │   │       ├── mail-order-mailer.ts
│   │   │   │       ├── system-clock.ts
│   │   │   │       ├── uuidv7-ids.ts
│   │   │   │       └── fake/{in-memory-unit-of-work.ts,fake-stock-holds.ts,fake-card-payments.ts,recording-order-mailer.ts,fixed-clock.ts,sequential-ids.ts}
│   │   │   ├── offer/
│   │   │   │   ├── published-language/events.ts
│   │   │   │   └── index.ts
│   │   │   └── builders/
│   │   │       ├── build-shop.ts
│   │   │       ├── build-shop-for-test.ts  # every port faked
│   │   │       └── index.ts
│   │   └── test/                           # mirrors src/
│   │       ├── domain/{order.test.ts,cart.test.ts,invoice-payment-offered.test.ts,payment-deadline.test.ts}
│   │       ├── service/{place-order.test.ts,record-card-payment-succeeded.test.ts,record-stock-lapsed.test.ts,...}
│   │       └── adapters/
│   │           ├── driving/handlers/cms-product-handler.test.ts
│   │           └── driven/
│   │               ├── order-repository.contract.ts     # run against fake and drizzle
│   │               ├── fake/in-memory-unit-of-work.test.ts
│   │               ├── drizzle/order-repository.int.test.ts
│   │               └── fulfillment-stock-holds.test.ts  # uses fulfillment's offer fake
│   ├── billing/
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── GLOSSARY.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── domain/{ids.ts,vat.ts,number-series.ts,charge-line.ts,card-payment.ts,refund.ts,invoice.ts,credit-note.ts,bank-transfer.ts,transfer-matches-invoice.ts,debtor.ts,dunning.ts}
│   │   │   ├── service/{open-card-payment.ts,request-refund.ts,match-transfer.ts,issue-invoice.ts,cancel-invoice.ts,record-card-payment-succeeded.ts,record-card-payment-canceled.ts,record-charge-disputed.ts,record-refund-outcome.ts,void-expired-card-payments.ts,import-bank-transfers.ts,run-dunning.ts,reconcile-card-payments.ts,void-card-payment-at-gateway.ts,submit-refund.ts,send-invoice-mail.ts,send-dunning-reminder.ts,with-idempotency.ts}
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/{hooks/stripe-hook.ts,handlers/commands-handler.ts,handlers/private-handler.ts,tasks/void-expired-card-payments.ts,tasks/import-bank-transfers.ts,tasks/run-dunning.ts,tasks/reconcile-card-payments.ts}
│   │   │   │   └── driven/{drizzle/...,outbox-translation.ts,stripe-card-gateway.ts,bank-api-statements.ts,mail-billing-mailer.ts,system-clock.ts,uuidv7-ids.ts,fake/...}
│   │   │   ├── offer/{published-language/open-host-service.ts,published-language/commands.ts,published-language/events.ts,fakes.ts,index.ts}
│   │   │   └── builders/{build-billing.ts,build-billing-for-test.ts,index.ts}
│   │   └── test/ ...                       # mirrors src/
│   ├── fulfillment/
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── GLOSSARY.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── domain/{stock-item.ts,reservation.ts,hold-period.ts,article.ts,shipment.ts}
│   │   │   ├── service/{reserve-stock.ts,get-stock-levels.ts,confirm-reservation.ts,release-reservation.ts,ship-order.ts,register-article.ts,record-dispatch.ts,expire-holds.ts,reconcile-stock.ts,reconcile-shipments.ts,submit-article.ts,submit-shipment.ts,with-idempotency.ts}
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/{hooks/tpl-hook.ts,hooks/cms-stock-field-hook.ts,handlers/commands-handler.ts,handlers/cms-product-handler.ts,handlers/private-handler.ts,tasks/expire-holds.ts,tasks/reconcile-stock.ts,tasks/reconcile-shipments.ts}
│   │   │   │   └── driven/{drizzle/...,outbox-translation.ts,tpl-warehouse.ts,system-clock.ts,uuidv7-ids.ts,fake/...}
│   │   │   ├── offer/{published-language/open-host-service.ts,published-language/commands.ts,published-language/events.ts,fakes.ts,index.ts}
│   │   │   └── builders/{build-fulfillment.ts,build-fulfillment-for-test.ts,index.ts}
│   │   └── test/ ...
│   └── backoffice/
│       ├── package.json
│       ├── drizzle.config.ts
│       ├── GLOSSARY.md
│       ├── migrations/
│       ├── src/
│       │   ├── domain/{order-overview.ts,needs-attention.ts,unmatched-transfer.ts}
│       │   ├── service/{list-order-overviews.ts,view-order-overview.ts,list-unmatched-transfers.ts,refund-order.ts,assign-transfer.ts,project-order.ts,project-invoice.ts,project-shipment.ts,project-transfer.ts}
│       │   ├── ports/{driving.ts,driven.ts}
│       │   ├── adapters/
│       │   │   ├── driving/{http/ops-routes.ts,handlers/shop-events-handler.ts,handlers/billing-events-handler.ts,handlers/fulfillment-events-handler.ts}
│       │   │   └── driven/{drizzle/...,billing-refunds.ts,billing-transfer-assignments.ts,system-clock.ts,fake/...}
│       │   ├── offer/index.ts
│       │   └── builders/{build-backoffice.ts,build-backoffice-for-test.ts,index.ts}
│       └── test/ ...
└── tooling/
    ├── dependency-cruiser.cjs
    ├── check-migrations.ts
    ├── check-published-language.ts
    ├── published-language-snapshots/       # JSON Schema per message type and version
    └── requeue-dead-letters.ts
```

Dependency rules (`tooling/dependency-cruiser.cjs`, CI and default `pnpm lint`):

- `systems/*/src/domain/**` may import only its own `domain/**` and `@teashop/kernel-money`.
- `systems/*/src/service/**` may import its `domain/**`, `ports/**`, `@teashop/result`, `@teashop/observability`
  (logger, tracer only), the `IdempotencyKey`/`Codec` types of `@teashop/messaging`.
- `systems/*/src/ports/**` may import its `domain/**`, `@teashop/result`, `@teashop/kernel-money`, messaging types.
- `@teashop/<other system>` may be imported only as `/offer` and only from `adapters/**` and `builders/**`; `/builders`
  only from `apps/**`. Package `exports` hide everything else.
- `drizzle-orm`, `pg`, `stripe`, `payload`, `next`, `node:*` only in `adapters/**`, `builders/**`, `libs/**`, `apps/**`,
  `externals/**`.
- Biome `noRestrictedGlobals` in `domain/**` and `service/**`: `Date.now`, `fetch`, `crypto`, `process`, `setTimeout`.

## How each property holds

**P1.** Domain files import only their own domain and the money kernel (dependency rule), so no Drizzle row type, Stripe
object, Payload document or Next.js type can shape them. Every upstream's terms are translated in adapters
(`cms-product-handler.ts`, `fulfillment-stock-holds.ts`, `outbox-translation.ts`, `stripe-hook.ts`, `tpl-warehouse.ts`);
no system conforms, so the Except is not used. Drizzle schemas are mapped to aggregates in the repository adapters, never
used as the model.

**P2.** Each business rule is one function or method in one system's `domain/`: VAT rate per tax class
(`billing/domain/vat.ts`), gapless numbering (`number-series.ts`), dunning stages (`dunning.ts`), transfer matching
(`transfer-matches-invoice.ts`), refundability (`card-payment.ts`), availability and hold period (`stock-item.ts`,
`hold-period.ts`), payment-method offer (`invoice-payment-offered.ts`), deadline (`payment-deadline.ts`), the order's
next step (`order.ts`), needs-attention (`needs-attention.ts`). Services only sequence load → domain → save → outbox;
adapters only translate. Price > 0 and sku uniqueness are the CMS's own rules, held once in its collection config; no
system of ours restates them. Not checked mechanically beyond the import rules (a service could still hold an `if`);
held by the layout and by review.

**P3.** The cut follows reasons to change: selling (`shop`), money and tax law (`billing`), stock and the warehouse
contract (`fulfillment`), what operations look at (`backoffice`), product content (`cms`). Inside a system, rules that
move together share a module (VAT and line totals in `vat.ts`/`invoice.ts`; stage thresholds and reminder text keys in
`dunning.ts`), and rules that move apart do not (payment deadline in `shop`, card payment expiry mechanics in `billing`).

**P4.** A driving port knows no caller: HTTP, handlers, hooks, tasks and other systems all pass the same command shape,
and their adapters only translate. Answers to acting calls are stored under the idempotency key and replayed unchanged.
Driven adapters are reached only through ports, and each port's fake and real adapter pass the same contract test
(`*.contract.ts`), so swapping one does not change the use case's response.

**P5.** Services are factories over ports; system builders create every adapter and assembly hands each builder its
upstream ports; there are no module-level singletons in systems. Dependency rules and Biome restrictions keep `pg`,
`drizzle-orm`, `stripe`, `payload`, `next`, `node:*`, `fetch`, `Date.now`, `crypto` out of domain and service; the
clock and ids are driven ports. Each port is typed in the system's terms (`StockHolds.hold(orderId, lines)` not
`ReserveStock`; `CardGateway.createPayment` not `stripe.PaymentIntent`). The Except covers `@teashop/observability`:
services and adapters log and open spans, whose output changes no answer. The courier in `web` hands adapters what
assembly produced; it is assembly's, not reachable from domain or service.

**P6.** Every driven port has a fake in `adapters/driven/fake/`; cross-system ports are faked by the caller's own fake
(`FakeStockHolds`), and translations to the upstream are tested against the upstream's offer fakes. `build<System>ForTest()`
wires a system entirely from fakes, and the default suite runs every use case through it. The in-memory unit of work
copies state on `run` and swaps it in only when the work resolves, so rollback is tested too.

**P7.** A use case's writes go through one `uow.run` that opens one Drizzle transaction on the system's pool; all
repositories, the idempotency record, the outbox rows and (in `shop`) the page-cache tag bumps take that transaction's
handle. Use cases with two transactions (`PlaceOrder`: claim, then commit) write nothing durable in the first but the
claim and the draft, which the second completes or a retry resumes.

**P8.** Final effects happen only after commit: mail, Stripe cancels and refunds, 3PL submissions run from private
messages in the outbox, committed with the change; cache visibility follows the committed tag row. The only effects
before commit are tentative operations: the fulfillment hold (gives nothing until `ConfirmReservation` or `ShipOrder`,
lapses after 30 min) and the Stripe PaymentIntent (gives nothing until the browser confirms with the client secret, which
only the committed answer returns; orphans are cancelled by `ReconcileCardPayments` after 2 h). Nothing is lost after
commit: outbox rows stay until delivered, relay retries; Payload's outbox row is written with `req`, so it commits with
the product.

**P9.** Every acting port claims its idempotency key (`INSERT ... ON CONFLICT DO NOTHING` on `(key, port)`) in its
transaction; a repeated key writes nothing and returns the stored answer, refusals included. A redelivery while the first
still runs blocks on the unique index until the first commits, then reads its answer; if the first rolled back, nothing was
stored and the repeat performs it. Handlers use the message id, hooks the vendor event id (Stripe and the 3PL both
redeliver: F9). Outward calls repeat safely: Stripe calls carry idempotency keys; `PUT /articles/{sku}` is idempotent;
`SubmitShipment` asks `GET /orders?reference=` before `POST`; mails carry `Idempotency-Key` (a duplicate mail, if the
provider ignores it, changes no record of ours).

**P10.** Aggregates save with optimistic `version`; a conflict reruns the use case on fresh reads, so nothing commits on a
read that no longer holds. Rows a business rule ties are locked: `stock_items` (availability), `number_series` (gapless),
`debtors` (stage). Untied use cases touch different rows. Stale reads accepted by rule: listing price, sku and tax class
come from the replica (the customer buys at the price shown); invoice payment is offered on the last standing billing
published (rule in `invoice-payment-offered.ts`: a customer who entered dunning less than a relay lag ago may still pick
invoice).

**P11.** Each system's Postgres role owns its schema and has no grant on any other; `payload` likewise; the only
cross-schema grant is `cms_outbox_reader` on `payload.outbox`, the CMS's published channel. Systems learn of each other
only from events, commands and open host services in published language; package `exports` hide every other module.
Editors see stock through `GetStockLevels`, not through `fulfillment.stock_items`.

**P12.** Every upstream's language is translated at the adapters that touch it (table of relationships above), so the
domain only ever holds the system's own terms. The money kernel is shared by agreement. Dependency rules forbid any
domain or service importing another system's offer or an SDK type.

**P13.** Downstreams see only the published language in `offer/published-language`, separate zod schemas mapped from
the domain in adapters, so a model change needs only a new mapping. Changing the published language means a new
`version` written beside the old for at least one release; `tooling/check-published-language.ts` fails CI when an
existing version's JSON Schema changes incompatibly.

**P14.** Messages: `type` and `version` fix a payload's meaning for ever; readers decode by version and upcast; an
unknown version is retried, never guessed. Records: expand-only migrations per release, contract one release later, no
column or enum value reused or renamed (`check-migrations.ts`); a meaning change is a new column. Rolling deploys run old
and new code on the same rows, which both read the same way. Payload's outbox payload carries `version` from the CMS
config.

**P15.** Only four things call another system while a user waits: reserving stock and opening a card payment at checkout
(the business needs stock now and Stripe's client secret now), the editors' stock field, and ops refunds and transfer
assignment. All else is outbox-driven: a down 3PL, bank, mail provider or Stripe delays shipments, imports, mails, voids
and refunds without failing any use case; invoice checkout works with Stripe down; browsing works with the CMS broken
(replica). The stock field shows "unknown" if fulfillment fails.

**P16.** A unit of work spans one system's pool, and its transaction handle type is not exported; a write to another
schema would be refused by Postgres privileges. Cross-system work is a sequence of single-system transactions joined by
outbox messages.

**P17.** `shop`'s `Order` holds every cross-system sequence and has a next step for each reply, including refusals, so
each branch ends in `shipped`/`paid`, `cancelled`, `refunded`, `refundFailed` or `refundRefused`, all allowed. Waiting
states have clocks: card payment expiry in `billing`, hold expiry in `fulfillment`. Lost replies are recovered by
reconciliations (`ReconcileCardPayments` hourly, `ReconcileShipments` hourly, `ReconcileStock` nightly). Holds only while
messages are delivered: a dead-lettered message (25 failed attempts) stops its branch until ops requeue it
(`outbox_dead_letters_total` alert, `tooling/requeue-dead-letters.ts`); `backoffice` lists orders stuck over 3 days.

**P18.** Replicas apply a change only when its version is newer (`seq` for listings, `standingVersion`, `statusVersion`,
shipment and invoice `version` in `backoffice`). The `Order` transitions commute: void and success are exclusive (Stripe
arbitrates `cancel` vs `succeeded`), lapse plus payment ends in cancelled-and-refunded in either order, `InvoiceSettled`
and `ShipmentDispatched` touch different dimensions. In `fulfillment`, `ReleaseReservation` before `ConfirmReservation`
leaves a released tombstone that refuses the late confirm the same way, `ShipOrder` confirms implicitly, and a dispatch
webhook for a shipment still `pending` is accepted.

**P19.** Each system has a `GLOSSARY.md`, and terms are kept apart by name: `cms` product; `shop` listing, customer,
order, payment method; `billing` card payment, debtor, invoice, credit note, transfer; `fulfillment` article, stock item,
reservation, shipment (the 3PL's "order" is `warehouseOrder`, adapter-only). Held by review; nothing checks it.

## Decisions the document left to me

**D1. The cut into systems.** Chose `shop`, `billing`, `fulfillment`, `backoffice` plus external `cms`. Also held:
splitting `billing` into payments/invoicing/dunning, `fulfillment` into inventory/shipping (more commands, same
properties); dropping `backoffice` and having the dashboard call each system's answering ports (P15 then weaker only for
the dashboard, still held since no business rule depends on it).

**D2. Payload as an external system run in our process.** Chose: Payload owns products and its own price/sku rules.
Also held: an own `catalog` system with Payload as admin UI writing through `catalog`'s ports (Payload then reduced to a
driving adapter).

**D3. Orchestration over choreography.** Chose `shop`'s `Order` as process manager sending commands. Also held:
choreography with `fulfillment` and `billing` reacting to `shop.OrderPlaced`, if refusals are published as events.

**D4. Relationship patterns.** Chose anti-corruption layer everywhere; shared kernel = `Money` only. Also held:
conformist downstreams to our own systems' published language (P12 by choice).

**D5. Which calls are synchronous.** Chose stock reservation and card payment opening at checkout, CMS stock field, ops
refund and transfer assignment. Also held: asynchronous reservation with the order pending until a reply (worse UX).

**D6. Stock reservation as a tentative operation.** Chose a 30 min hold confirmed by `ConfirmReservation`/`ShipOrder`
from `shop`. Also held: reserve inside `shop` against a stock replica (then oversell must be a rule accepted).

**D7. Payment deadline and who cancels.** Chose 60 min after placing, card orders only; `billing` voids the PaymentIntent
at `expiresAt` and `shop` cancels on `CardPaymentVoided`. Also held: a `shop` deadline task sending a void command.

**D8. Dunning check at checkout.** Chose a replica of debtor standing in `shop`, staleness accepted by rule. Also held: a
synchronous call to a `billing` answering port.

**D9. Idempotency.** Chose an `idempotency` table per system keyed `(key, port)` storing the answer; every acting port
takes a key. Also held: per-handler inbox of message ids plus natural-key upserts.

**D10. Outbox, relay, bus.** Chose per-system outbox tables, lease-based polling relay in `worker`, in-process bus,
exponential backoff capped at 15 min, dead letter after 25 attempts. Also held: Postgres `LISTEN/NOTIFY` wake-ups, or a
broker (pg-boss, NATS) behind the bus.

**D11. Concurrency control.** Chose optimistic versions on aggregates, row locks for stock items, number series, debtors;
READ COMMITTED. Also held: SERIALIZABLE with retry.

**D12. Store layout.** Chose one database, one schema and one role per system and per CMS. Also held: one database per
system on the same instance.

**D13. Deployables.** Chose `web` (Next.js + Payload), `worker`, `migrate`. Also held: relay and tasks inside `web`.

**D14. Courier.** Chose a memoised per-process assembly promise in `apps/web/src/courier.ts`. Also held: Payload's and
Next.js' own request context carrying it.

**D15. Scheduled tasks.** Chose `croner` in `worker` with advisory locks. Also held: a pg-boss cron or an external cron.

**D16. Bank transfers.** Chose polling every 5 min with a stored cursor. Also held: a bank webhook hook in `billing`.

**D17. When invoices are issued and sent.** Chose: card orders on payment success (settled at issue), invoice orders at
placing (due in 14 days); every invoice mailed by `billing`. Also held: invoice orders invoiced at dispatch.

**D18. Refunds.** Chose line-level refunds (whole order = all lines), card only, credit note on Stripe's success. Also
held: amount-only refunds with VAT split pro rata.

**D19. Gapless numbering.** Chose locked `number_series` rows per series and year: `RE-2026-000001`, `GS-2026-000001`.
Also held: one shared series.

**D20. Prices and VAT arithmetic.** Chose gross euro cents; per line net = round(gross × 100 / (100 + rate)), VAT = gross
− net. Also held: net prices in the CMS.

**D21. Transfer matching.** Chose: remittance contains the invoice number and the amount equals the open amount;
otherwise unmatched, assigned by ops. Also held: fuzzy matching by amount and debtor name proposed to ops.

**D22. Dunning.** Chose stages 1/2/3 at 7/21/35 days past due, daily at 06:00 Europe/Berlin; in dunning = stage ≥ 1;
back to 0 when nothing is overdue. Also held: any other thresholds.

**D23. Shop page revalidation.** Chose a Postgres-backed Next.js `cacheHandler` in `shop`'s schema whose tag rows
`SyncListing` bumps in its own transaction. Also held: a private message whose handler calls an internal revalidate route.

**D24. Published language format and versioning.** Chose zod schemas per type and integer `version`, JSON Schema
snapshots checked in CI. Also held: JSON Schema or protobuf as source.

**D25. Migration policy.** Chose expand/contract one release apart, enforced by `check-migrations.ts`. Also held:
blue/green with full downtime-free copies (heavier).

**D26. Observability.** Chose `AsyncLocalStorage` request context, pino `mixin`, `traceparent` and `requestId` stored
on every envelope and restored by the relay, OTLP to Jaeger, `prom-client`. Also held: OpenTelemetry metrics with a
Prometheus exporter.

**D27. Port granularity.** Chose one function type per driving port, interfaces for driven ports, a unit-of-work port
exposing transactional repositories. Also held: one driving interface per system with one method per use case.

**D28. Refusal shape.** Chose `Result` unions for synchronous answers and `<Command>Refused` events for commands. Also
held: a generic `CommandRefused` event.

**D29. Repository layout and enforcement.** Chose pnpm workspaces, one package per system exporting `./offer` and
`./builders`, dependency-cruiser and Biome rules. Also held: a single package with path-based lint rules.

**D30. Test layout.** Chose vitest, `test/` mirroring `src/`, contract tests run against fake and real adapters,
`*.int.test.ts` (integration, Postgres in docker) outside the default suite. Also held: Testcontainers per test file.

**D31. Customer identity.** Chose guest customers keyed by normalised e-mail in `shop`; `billing`'s debtor id is `shop`'s
customer id. Also held: an own `accounts` system.

**D32. Stock source of truth.** Chose `fulfillment` counts, decremented on dispatch, set nightly from the 3PL stock
report plus dispatches after its `asOf`. Also held: 3PL stock webhooks.

**D33. Article registration.** Chose registering on every `cms.product.changed` (by `seq`), with `SubmitShipment`
retrying until all its articles are registered. Also held: registering at first `ShipOrder`.

**D34. Hold length and card payment deadline values.** Chose 30 min and 60 min. Also held: any values with deadline ≥
hold, since `ConfirmReservation` follows the commit.

## Sentences I had to pick a reading for

**S1.** "Another bounded context is another system, even when it is imported in-process."
Readings: (a) Payload, running inside `web`, is a system (external); (b) in-process code is a library the importing system
owns. Took (a). Changed: Payload has its own schema, outbox and relationship to `shop` and `fulfillment`; no system
imports Payload types in its domain.

**S2.** "Business rules its configuration holds are its own, in its terms, even where this codebase writes them."
Readings: (a) price > 0 and sku unique, written by us in Payload's config, are the CMS's rules and need no home in our
domains; (b) they are also our rules and must be modelled in a system of ours (P2). Took (a). Changed: no catalog
system; `shop` does not re-check price or sku.

**S3.** "The outbox reader is what the relay reads the outbox through, and marks it by; the system provides it, and for
an external system's outbox, assembly does."
Readings: (a) an external system can have an outbox in our store that we configure, read by an assembly-written reader;
(b) only a vendor's event feed counts, read through an adapter of the receiving system. Took (a). Changed: Payload
`outbox` collection, `apps/worker/src/cms-outbox-reader.ts`, role `cms_outbox_reader`.

**S4.** "It names one use case the system offers and what a caller must bring" (driving port).
Readings: (a) one port per use case; (b) a port is an interface whose methods are use cases. Took (a). Changed: every
driving port is a function type; offers list functions.

**S5.** "There are as many driving adapters as there are ways into the process."
Readings: (a) one per transport (HTTP, bus, clock, Payload); (b) one per entry (route group, hook, handler, task). Took
(b). Changed: many small adapter files per system rather than one HTTP adapter for the process.

**S6.** "Two clients are one store when one transaction can carry the writes of both, two stores until it can."
Readings: (a) one Postgres instance is one store for all systems, P16 kept by discipline; (b) clients whose roles cannot
write each other's schemas are different stores. Took (b). Changed: one role and pool per system; privileges are the
mechanism for P11 and P16.

**S7.** "Who starts the call decides which. Seen from the caller, this system's driving port lies behind one of the
caller's driven ports."
Readings: (a) the caller's driven adapter calls the callee's driving port directly in-process; (b) there must be a
transport and a driving adapter on the callee's side. Took (a). Changed: `FulfillmentStockHolds` and
`BillingCardPayments` call the services assembly hands them; no internal HTTP.

**S8.** "Upstream system. ... it offers the open host service the other calls, the commands the other sends, the events
the other handles"
Readings: (a) one pair has one direction, so a system that calls another's open host service must not also be handled by
it; (b) direction is per interaction. Took (a). Changed: orchestration (D3); `shop` sends commands instead of `billing`
and `fulfillment` handling `shop`'s events.

**S9.** "P5 Except: the outside reached through code of the common library ... where its output changes neither how a
use case acts nor what it answers."
Readings: (a) only logging, tracing, metrics; (b) also clock and id generation from a library. Took (a), since the clock
changes how a use case acts (deadline, holds). Changed: `Clock` and `*Ids` are driven ports with fakes.

**S10.** "P9. A repeated delivery changes no record of this system, and succeeds where the first did"
Readings: (a) only bus deliveries; (b) any repeated arrival, webhooks and retried HTTP calls included (Against F9).
Took (b); also: "succeeds where the first did" means replaying a committed answer, refusals included, while a rolled
back first attempt left nothing to replay. Changed: idempotency key on every acting port; refusals stored.

**S11.** "P10 ... or on stale ones a business rule accepts"
Readings: (a) the acceptance must be an explicit rule in the domain; (b) any lag a designer judges harmless. Took (a).
Changed: `invoice-payment-offered.ts` states it accepts the replica's lag; listing snapshots are accepted in `order.ts`.

**S12.** "P15. ... unless a business rule needs another system's answer now"
Readings: (a) checkout stock and Stripe's client secret qualify; (b) only what the brief states as a rule. Took (a).
Changed: two synchronous calls in `PlaceOrder`, each handled as a tentative operation.

**S13.** "Tentative operation. ... It gives nothing until it is confirmed, by the requester or by whoever else the other
system takes the confirmation from"
Readings: (a) a stock hold that blocks availability "gives nothing" to the requester while still holding stock; (b) a
hold that blocks stock already gives something. Took (a). Changed: holds count against availability but ship nothing
until confirmed, and lapse by themselves.

**S14.** "Hook. A driving adapter an external system calls."
Readings: (a) a Payload field hook calling our code is a hook of the called system; (b) it is the CMS calling an open
host service through its own driven port. Took (a). Changed: `cms-stock-field-hook.ts` lives in `fulfillment`'s driving
adapters and is offered through its builders.

**S15.** "Offer. ... its published language, the driving port types of its open host service and their fakes, and its
system builders."
Readings: (a) fakes of the open host service's driving ports, for downstream tests; (b) fakes of the system's driven
ports. Took (a). Changed: `offer/fakes.ts` in `billing` and `fulfillment`; driven-port fakes stay inside each system.

**S16.** "System builder. ... it takes configuration and what the process holds once, builds its system's own from
them"
Readings: (a) the builder creates its own pool from its configuration; (b) assembly creates pools and passes them. Took
(a). Changed: builders take `databaseUrl` and return `close()`; assembly passes only logger and registry.

**S17.** "Probe. Code a process runs to report on itself rather than on a system."
Readings: (a) `/health` pinging the database is a probe; (b) it reports on systems' stores, so it is a system's use
case. Took (a). Changed: `/health` lives in `apps/*`, calling each builder's `probe()`.

**S18.** "Tooling. Code that runs in no process of the deployed application."
Readings: (a) the migration runner is tooling; (b) it is a deployed one-shot process. Took (b). Changed: `apps/migrate`
is a deployable; only CI checks and the requeue script are tooling.

**S19.** "P11. No other system changes the records a system owns, or reads them except through its published language"
Readings: (a) assembly's outbox reader reading `payload.outbox` is reading the CMS's records; (b) the outbox content is
published language and the reader its channel. Took (b). Changed: one narrow cross-schema grant on `payload.outbox`.

**S20.** "An order unpaid at its payment deadline is cancelled." (brief)
Readings: (a) card orders only; invoice orders ship before payment and go to dunning; (b) all orders, including invoice
orders after shipping. Took (a). Changed: deadline only on card orders, carried as the card payment's `expiresAt`.

**S21.** "Pay by invoice is not offered to a customer in dunning." (brief)
Readings: (a) dunning stage ≥ 1; (b) any overdue invoice. Took (a). Changed: `DebtorStandingChanged` carries stage and
`inDunning`.

**S22.** "Bank API that reports incoming transfers." (brief)
Readings: (a) we fetch; (b) it pushes. Took (a). Changed: `ImportBankTransfers` task and `bank_cursor`; no bank hook.

**S23.** "Out of scope: throughput and load, security, user interfaces." against the brief's shop page, admin UI and
dashboard
Readings: (a) design the driving adapters and processes behind them, not the UI; (b) leave them out. Took (a). Changed:
pages appear only as loaders and route shims; signature checks named, not designed.

**S24.** "P13. A system changes its model without its downstream systems changing"
Readings: (a) model = domain model, the published language may change by new versions; (b) also its published language.
Took (a). Changed: separate published-language schemas, versioned, old versions kept one release.
