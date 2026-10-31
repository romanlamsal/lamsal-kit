# Fresh repository draft B, distilled set

Repository `teashop`: pnpm monorepo, TypeScript 5 strict, Node 22, one Postgres 17 instance, Drizzle ORM
(node-postgres), Payload CMS 3 (inside Next.js 15), Fastify 5, pg-boss 10 as bus, Stripe, a 3PL API,
a bank API, Resend as mail provider, pino, OpenTelemetry (OTLP to Jaeger, Prometheus exporter for
`/metrics`), vitest, Biome, dependency-cruiser.

## Systems and what each owns

### Our systems

| System | Kind | Owns (its business rules decide these records) | Keeps (store: schema, role, tables) |
|---|---|---|---|
| `sales` | system; core subdomain; its Order aggregate is the process manager of every order | carts; customers (email, name, addresses); orders: line Snapshots (product id, sku, title, unit price, tax class at order time), payment method, payment deadline, order state | schema `sales`, role `sales_app`: `carts`, `cart_items`, `customers`, `orders`, `order_lines`, `outbox`, `processed_messages`. Replicas: `catalog_entries` (owner: Payload CMS), `payment_standings` (owner: `billing`) |
| `payments` | system; supporting subdomain; anti-corruption layer over Stripe | card payments (order id, amount, Stripe reference, state), refunds, dispute flag | schema `payments`, role `payments_app`: `card_payments`, `refunds`, `outbox`, `processed_messages` |
| `billing` | system; supporting subdomain | invoices and their lines with VAT rate, credit notes, `NumberSeries` (one per document kind and year), bank transfers and their match, customer accounts with dunning stage, bank import cursor | schema `billing`, role `billing_app`: `invoices`, `invoice_lines`, `credit_notes`, `credit_note_lines`, `number_series`, `bank_transfers`, `bank_import_cursor`, `customer_accounts`, `outbox`, `processed_messages` |
| `warehouse` | system; supporting subdomain; anti-corruption layer over the 3PL | reservations (tentative holds and confirmed reservations, one per order), shipments, article registrations in the 3PL article master | schema `warehouse`, role `warehouse_app`: `reservations`, `reservation_lines`, `shipments`, `shipment_lines`, `articles`, `outbox`, `processed_messages`. Replica: `stock_levels` (owner: the 3PL) |

### External systems

| External system | Run by, where | Owns | Keeps | Driven through (its API) | Driving through (hooks) |
|---|---|---|---|---|---|
| Payload CMS 3 | adopted, run by us inside process `web`; configured by `packages/cms` | products (title, copy, images, slug, price, sku, tax class, status), media, editor accounts. Business rules written in its configuration, in its terms: price > 0, sku unique, sku unchanged after creation, tax class one of `tea`, `accessories` | schema `payload`, role `payload_app`, including its outbox `payload.cms_outbox` | no system drives it at runtime; tooling drives its Local API | `stock` field `afterRead` hook → `warehouse` |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | Stripe | `payments`' `StripeCardGateway` | `POST /hooks/stripe` → `payments` |
| 3PL | vendor | article master, outbound orders, physical stock | 3PL | `warehouse`' `ThreePlFulfilment` | `POST /hooks/3pl` → `warehouse` |
| Bank | vendor | account transactions | bank | `billing`' `BankApiStatements` | none: polled by a scheduled task |
| Resend | vendor | sent mails | Resend | `sales`' and `billing`' mailer adapters | none |
| Next.js page cache | adopted, run by us inside `web` | cached shop pages | Next's cache in `web` | `sales`' `NextShopPageCache` via `POST /api/revalidate` | none |

### Shared kernel

`@teashop/kernel-money` (`packages/kernel-money`): `Money` (integer cents, currency `EUR`), `money()`,
`add`, `subtract`, `times(quantity)`, `sum`, `isPositive`, `compare`. Imported into the domains of
`sales`, `payments` and `billing`, agreed by the three; `warehouse` does not import it. Pure.

### Code that is no system

- Common library `@teashop/common` (`packages/common`): `Result`, port helper types (`Acting`,
  `Answering`, `IdempotencyKey`, `Clock`, `Ids`, `Codec`), clock and id implementations, the message
  envelope, outbox and `processed_messages` table factories, the generic Postgres outbox reader, the
  Drizzle `UnitOfWork` helper, the relay, the pg-boss bus, the handler runner, the scheduler, logger,
  telemetry, request context (`AsyncLocalStorage`), probes, the Fastify request-context plugin.
- `@teashop/cms` (`packages/cms`): configuration of the external system Payload CMS: collections with
  its business rules, the `stock` field, the outbox write in Payload's transaction, the outbox reader
  factory assembly uses, the `cms.ProductChanged.v1` schema.
- `apps/*`: entry points, assembly, the courier of `web`, probe routes, and the Next pages that host
  driving adapters (shop pages → `sales`; ops pages → `sales`, `billing`, `warehouse`, `payments`).
- `tooling/*` (tooling): dependency-cruiser rules, Biome plugin, `republish-products`, migration check.
- pg-boss is the bus; Postgres hosts the stores.

## Ports and adapters

### Shapes every system uses (common library)

```ts
// packages/common/src/result.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// packages/common/src/ports.ts
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };
export type Json = string | number | boolean | null | readonly Json[] | { readonly [k: string]: Json };
export interface Codec<T> { encode(value: T): Json; decode(json: Json): T }
/** An acting use case: a repeat with the same key answers what the first committed call answered. */
export type Acting<I, O, E> = (input: I, call: { readonly idempotencyKey: IdempotencyKey }) => Promise<Result<O, E>>;
export type Answering<I, O, E = never> = (input: I) => Promise<Result<O, E>>;
export interface Clock { now(): Date }
export interface Ids { next(): string } // UUIDv7

// packages/common/src/messaging/envelope.ts
export interface Envelope<TType extends string = string, TPayload = Json> {
  readonly id: string;                         // UUIDv7, the same on every delivery
  readonly type: TType;                        // '<system>.<Name>.v<N>', private: '<system>.private.<Name>.v<N>'
  readonly kind: 'event' | 'command' | 'private';
  readonly occurredAt: string;                 // ISO-8601
  readonly payload: TPayload;
  readonly trace: { readonly traceparent?: string; readonly tracestate?: string; readonly requestId?: string };
}
export interface OutboxReader {
  readonly name: string;
  /** In one transaction: claim up to `limit` undelivered rows (FOR UPDATE SKIP LOCKED, id order),
   *  hand them to `deliver`, mark them delivered, commit. Returns the number claimed. */
  claim(limit: number, deliver: (batch: readonly Envelope[]) => Promise<void>): Promise<number>;
}
export interface Bus { deliver(envelope: Envelope): Promise<void> } // event → publish, command/private → send
export interface Handler {
  readonly queue: string;                                      // e.g. 'billing.issue-invoice-for-paid-order'
  readonly accepts: { readonly kind: Envelope['kind']; readonly type: string };
  handle(envelope: Envelope): Promise<void>;                   // resolves → settled; throws → redelivered
}
export class Deferred extends Error {}                         // a prerequisite has not arrived yet
export interface ScheduledTask { readonly name: string; readonly cron: string; readonly tz: 'Europe/Berlin'; run(slot: string): Promise<void> }
```

Every system's unit of work has this shape (its `Tx` differs):

```ts
export interface UnitOfWork<Tx> {
  /** One store transaction. With a key: first inserts (consumer, key) into processed_messages;
   *  if present, returns the stored answer without running `work`. Commits the outbox rows `work` added. */
  run<T>(key: IdempotencyKey | null, work: (tx: Tx) => Promise<T>, codec: Codec<T>): Promise<T>;
}
```

### `sales`

Driving ports (`systems/sales/src/ports/driving.ts`):

```ts
export type PaymentMethod = 'card' | 'invoice';
export interface Buyer { readonly email: Email; readonly name: string; readonly billingAddress: Address; readonly shippingAddress: Address }

export type AddToCart = Acting<{ cartId: CartId | null; productId: ProductId; quantity: number }, CartView, { code: 'not_offered' } | { code: 'cart_closed' }>;
export type ChangeCartQuantity = Acting<{ cartId: CartId; productId: ProductId; quantity: number }, CartView, { code: 'cart_not_found' } | { code: 'cart_closed' }>;
export type GetCart = Answering<{ cartId: CartId }, CartView, { code: 'cart_not_found' }>;
export type BrowseCatalog = Answering<{ page: number }, CatalogPage>;
export type GetCatalogEntry = Answering<{ slug: string }, CatalogEntryView, { code: 'not_found' }>;

export type PlaceOrder = Acting<
  { cartId: CartId; buyer: Buyer; paymentMethod: PaymentMethod },
  { orderId: OrderId; payment: { method: 'card'; cardConfirmationSecret: string; payBy: Date } | { method: 'invoice' } },
  | { code: 'cart_not_found' } | { code: 'cart_empty' } | { code: 'not_offered'; productIds: readonly ProductId[] }
  | { code: 'out_of_stock'; skus: readonly Sku[] } | { code: 'invoice_not_offered' }
  | { code: 'stock_check_unavailable' } | { code: 'card_payments_unavailable' }
>;
export type ListOrders = Answering<OrderQuery, OrderSummaryPage>;
export type GetOrder = Answering<{ orderId: OrderId }, OrderDetail, { code: 'not_found' }>;

// reached by handlers and scheduled tasks
export type RefreshCatalogEntry = Acting<CatalogEntryChange, void, never>;
export type RefreshPaymentStanding = Acting<{ customerId: CustomerId; inDunning: boolean; version: number }, void, never>;
export type RecordPayment = Acting<{ orderId: OrderId; via: PaymentMethod; amount: Money; at: Date }, void, never>;
export type RecordDispatch = Acting<{ orderId: OrderId; trackingNumber: string | null; at: Date }, void, never>;
export type RecordFulfilmentImpossible = Acting<{ orderId: OrderId; reason: 'stock_unavailable' | 'reservation_released' }, void, never>;
export type RecordCardCancellationRefused = Acting<{ orderId: OrderId }, void, never>;
export type RecordLateRefundRefused = Acting<{ orderId: OrderId; reason: 'disputed' | 'not_refundable' }, void, never>;
export type SendOrderConfirmation = Acting<{ orderId: OrderId }, void, never>;
export type InvalidateShopPage = Acting<{ slugs: readonly string[] }, void, never>;
export type CancelOverdueOrders = Acting<{ limit: number }, { cancelled: number }, never>;
```

Driven ports (`systems/sales/src/ports/driven.ts`):

```ts
export interface SalesTx {
  readonly orders: OrderRepository; readonly carts: CartRepository; readonly customers: CustomerRepository;
  readonly catalog: CatalogEntryRepository; readonly standings: PaymentStandingRepository; readonly outbox: SalesOutbox;
}
export type SalesUnitOfWork = UnitOfWork<SalesTx>;
export interface OrderRepository {
  get(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;                       // throws ConcurrencyConflict on version mismatch
  overdue(at: Date, limit: number): Promise<readonly Order[]>;
  find(query: OrderQuery): Promise<OrderSummaryPage>;
}
export interface CartRepository { get(id: CartId): Promise<Cart | null>; save(cart: Cart): Promise<void> }
export interface CustomerRepository { byEmail(email: Email): Promise<Customer | null>; save(c: Customer): Promise<void> }
export interface CatalogEntryRepository {
  get(id: ProductId): Promise<CatalogEntry | null>; bySlug(slug: string): Promise<CatalogEntry | null>;
  many(ids: readonly ProductId[]): Promise<readonly CatalogEntry[]>; page(n: number): Promise<CatalogPage>;
  save(entry: CatalogEntry): Promise<void>;
}
export interface PaymentStandingRepository { get(id: CustomerId): Promise<PaymentStanding>; save(s: PaymentStanding): Promise<void> }
export interface SalesOutbox { add(...decisions: readonly OrderDecision[]): void } // OrderDecision: sales domain union
export interface StockHolds {
  hold(input: { holdId: OrderId; lines: readonly { sku: Sku; quantity: number }[] }):
    Promise<Result<{ expiresAt: Date }, { code: 'out_of_stock'; skus: readonly Sku[] } | { code: 'unavailable' }>>;
}
export interface CardPayments {
  start(input: { orderId: OrderId; amount: Money }): Promise<Result<{ confirmationSecret: string }, { code: 'unavailable' }>>;
}
export interface OrderConfirmationMailer { send(mail: OrderConfirmation, dedupeKey: string): Promise<void> }
export interface ShopPageCache { invalidate(slugs: readonly string[]): Promise<void> }
// plus Clock, Ids from the common library
```

`OrderDecision` (domain, `systems/sales/src/domain/order/order-decision.ts`), in sales' terms:
`confirm-stock-hold`, `release-stock`, `ship`, `cancel-card-payment`, `refund-late-payment`,
`announce-paid`, `announce-shipped`, `send-confirmation`, `invalidate-shop-page`.

Adapters:

- Driven: `PostgresSalesUnitOfWork`, `PostgresOrderRepository`, `PostgresCartRepository`,
  `PostgresCustomerRepository`, `PostgresCatalogEntryRepository`, `PostgresPaymentStandingRepository`,
  `PostgresSalesOutbox` (translates each `OrderDecision` into an envelope of the receiver's published
  language: `warehouse.*` commands from `@teashop/warehouse/offer`, `payments.*` commands from
  `@teashop/payments/offer`, own events from `sales`' published language, private messages),
  `WarehouseStockHolds` (wraps `warehouse`' `HoldStock`), `PaymentsCardPayments` (wraps `payments`'
  `StartCardPayment`), `ResendOrderConfirmationMailer`, `NextShopPageCache`; `systemClock`,
  `uuidv7Ids` from the common library. Outbox reader: `buildSalesOutboxReader`.
- Fakes: `InMemorySalesUnitOfWork` (every repository plus a recording outbox), `FakeStockHolds`,
  `FakeCardPayments`, `RecordingOrderConfirmationMailer`, `RecordingShopPageCache`, `fixedClock`,
  `sequentialIds`.
- Driving: Fastify plugins `cartRoutes` (`POST /carts`, `POST /carts/:cartId/items`,
  `PATCH /carts/:cartId/items/:productId`, `GET /carts/:cartId`) and `checkoutRoute`
  (`POST /checkout`, key = cart id; maps `cardConfirmationSecret` to `clientSecret` for Stripe.js);
  handlers (see Calls and messages); scheduled task `cancel-overdue-orders`; Next pages in `apps/web`
  (shop pages call `BrowseCatalog`, `GetCatalogEntry`; ops orders page calls `ListOrders`, `GetOrder`).

System builders (`systems/sales/src/builders/build-sales.ts`, exported by the offer):

```ts
export interface SalesConfig { pool: Pool; resendApiKey: string; mailFrom: string; webBaseUrl: string; revalidateSecret: string }
export interface SalesUpstream { holdStock: HoldStock; startCardPayment: StartCardPayment }
export function buildSalesHttp(cfg: SalesConfig, up: SalesUpstream): { cartRoutes: FastifyPluginAsync; checkoutRoute: FastifyPluginAsync };
export function buildSalesQueries(cfg: Pick<SalesConfig, 'pool'>): { browseCatalog: BrowseCatalog; getCatalogEntry: GetCatalogEntry; listOrders: ListOrders; getOrder: GetOrder };
export function buildSalesHandlers(cfg: SalesConfig): readonly Handler[];
export function buildSalesScheduledTasks(cfg: SalesConfig): readonly ScheduledTask[];
export function buildSalesOutboxReader(cfg: { pool: Pool }): OutboxReader;
export function buildSalesForTests(over?: Partial<SalesTestDeps>): SalesTestKit; // every driving port on fakes
```

### `payments`

Driving ports:

```ts
// open host service (in the offer)
export type StartCardPayment = Acting<{ orderId: string; amount: Money }, { paymentId: string; confirmationSecret: string }, { code: 'gateway_unavailable' } | { code: 'already_settled' }>;
export type RefundCardPayment = Acting<{ orderId: string; amount: Money; reason: 'customer_request' | 'late_payment' },
  { refundId: string }, { code: 'not_found' } | { code: 'not_captured' } | { code: 'disputed' } | { code: 'exceeds_refundable'; refundable: Money }>;
export type GetCardPayment = Answering<{ orderId: string }, CardPaymentView, { code: 'not_found' }>;
export type ListCardPayments = Answering<CardPaymentQuery, CardPaymentPage>;
// internal
export type CancelCardPayment = Acting<{ orderId: string }, void, { code: 'already_captured' }>;
export type RecordGatewayEvent = Acting<GatewayEvent, void, never>;
export type GatewayEvent =
  | { kind: 'captured'; gatewayRef: GatewayRef; amount: Money; at: Date } | { kind: 'failed'; gatewayRef: GatewayRef; at: Date }
  | { kind: 'cancelled'; gatewayRef: GatewayRef } | { kind: 'refund_settled'; gatewayRefundRef: string; at: Date }
  | { kind: 'refund_failed'; gatewayRefundRef: string } | { kind: 'disputed'; gatewayRef: GatewayRef; at: Date };
export type SubmitRefund = Acting<{ refundId: RefundId }, void, never>;
export type ExpireAbandonedPayments = Acting<{ olderThanMinutes: number }, { cancelled: number }, never>;
export type ReconcileCardPayments = Acting<{ sinceMinutes: number }, { repaired: number }, never>;
```

Driven ports:

```ts
export interface PaymentsTx { readonly payments: CardPaymentRepository; readonly outbox: PaymentsOutbox }
export type PaymentsUnitOfWork = UnitOfWork<PaymentsTx>;
export interface CardPaymentRepository {
  get(id: PaymentId): Promise<CardPayment | null>; byOrder(orderId: string): Promise<CardPayment | null>;
  byGatewayRef(ref: GatewayRef): Promise<CardPayment | null>; byRefund(id: RefundId | string): Promise<CardPayment | null>;
  awaitingSince(before: Date, limit: number): Promise<readonly CardPayment[]>; save(p: CardPayment): Promise<void>;
}
export interface PaymentsOutbox { add(...m: readonly PaymentsDecision[]): void }
export interface CardGateway {
  open(i: { paymentId: PaymentId; amount: Money; dedupeKey: string }): Promise<Result<{ gatewayRef: GatewayRef; confirmationSecret: string }, GatewayDown>>;
  changeAmount(ref: GatewayRef, amount: Money): Promise<Result<void, GatewayDown | { code: 'not_changeable' }>>;
  cancel(ref: GatewayRef): Promise<Result<void, GatewayDown | { code: 'already_captured' }>>;
  refund(i: { refundId: RefundId; gatewayRef: GatewayRef; amount: Money }): Promise<Result<{ gatewayRefundRef: string }, GatewayDown | { code: 'rejected'; reason: string }>>;
  recentlyChanged(sinceMinutes: number): Promise<Result<readonly GatewayEvent[], GatewayDown>>;
}
export type GatewayDown = { code: 'gateway_down' };
```

Adapters: driven `PostgresPaymentsUnitOfWork`, `PostgresCardPaymentRepository`,
`PostgresPaymentsOutbox`, `StripeCardGateway` (`stripe` SDK; idempotency keys `pi:<paymentId>`,
`re:<refundId>`; Stripe's terms stop here). Fakes: `InMemoryPaymentsUnitOfWork`, `FakeCardGateway`; in
the offer: `fakeStartCardPayment`, `fakeRefundCardPayment`. Driving: hook `stripeWebhookRoute`
(`POST /hooks/stripe`, raw body, `stripe.webhooks.constructEvent`, key = Stripe event id, translates
`payment_intent.succeeded|payment_failed|canceled`, `refund.updated`, `charge.dispute.created` into
`GatewayEvent`, answers 200 after commit); handlers `CancelCardPayment.v1`, `RefundCardPayment.v1`,
private `SubmitRefund.v1`; scheduled tasks `expire-abandoned-payments`, `reconcile-card-payments`; ops
page actions call `RefundCardPayment`, `ListCardPayments`.

Builders: `buildPaymentsOpenHost(cfg)` → `{ startCardPayment, refundCardPayment, getCardPayment, listCardPayments }`,
`buildPaymentsStripeHook(cfg)` → `FastifyPluginAsync`, `buildPaymentsHandlers`,
`buildPaymentsScheduledTasks`, `buildPaymentsOutboxReader`, `buildPaymentsForTests`.

### `billing`

Driving ports:

```ts
export interface BillableOrder {
  orderId: string; customerId: string; customer: { email: string; name: string; billingAddress: Address };
  lines: readonly { sku: string; title: string; quantity: number; unitGross: Money; taxCategory: 'reduced' | 'standard' }[];
}
export type IssueInvoiceForPaidOrder = Acting<BillableOrder & { paidAt: Date }, { invoiceNumber: string }, never>;
export type IssueInvoiceForShippedOrder = Acting<BillableOrder & { shippedAt: Date }, { invoiceNumber: string }, never>;
export type IssueCreditNote = Acting<{ orderId: string; refundId: string; amount: Money; at: Date }, { creditNoteNumber: string }, never>; // throws Deferred while the order has no invoice
export type ImportBankTransfers = Acting<{ maxPages: number }, { imported: number; matched: number }, { code: 'bank_unavailable' }>;
export type AssignBankTransfer = Acting<{ transferId: string; invoiceNumber: string }, void,
  { code: 'already_matched' } | { code: 'invoice_not_open' } | { code: 'amount_mismatch'; open: Money }>;
export type RunDunning = Acting<Record<string, never>, { reminded: number }, never>;
export type SendReminder = Acting<{ invoiceId: string; stage: 1 | 2 | 3 }, void, never>;
export type ListInvoices = Answering<InvoiceQuery, InvoicePage>;
export type ListBankTransfers = Answering<{ state: 'matched' | 'unmatched'; page: number }, BankTransferPage>;
```

Driven ports:

```ts
export interface BillingTx {
  readonly invoices: InvoiceRepository; readonly creditNotes: CreditNoteRepository; readonly numberSeries: NumberSeriesRepository;
  readonly transfers: BankTransferRepository; readonly importCursor: ImportCursorRepository;
  readonly accounts: CustomerAccountRepository; readonly outbox: BillingOutbox;
}
export type BillingUnitOfWork = UnitOfWork<BillingTx>;
export interface NumberSeriesRepository { get(kind: 'invoice' | 'credit_note', year: number): Promise<NumberSeries>; save(s: NumberSeries): Promise<void> }
export interface InvoiceRepository {
  get(id: InvoiceId): Promise<Invoice | null>; byOrder(orderId: string): Promise<Invoice | null>;
  byNumber(n: string): Promise<Invoice | null>; openPastDue(at: Date): Promise<readonly Invoice[]>;
  find(q: InvoiceQuery): Promise<InvoicePage>; save(i: Invoice): Promise<void>;
}
export interface BankStatements {
  transfersSince(cursor: string | null): Promise<Result<{ transfers: readonly IncomingTransfer[]; next: string | null }, { code: 'bank_down' }>>;
}
export interface ReminderMailer { send(mail: Reminder, dedupeKey: string): Promise<void> }
// CreditNoteRepository, BankTransferRepository, ImportCursorRepository, CustomerAccountRepository, BillingOutbox: same pattern
```

Adapters: driven `PostgresBillingUnitOfWork` and one Postgres repository per aggregate,
`PostgresBillingOutbox`, `BankApiStatements` (bank's transaction id becomes `IncomingTransfer.bankRef`),
`ResendReminderMailer`. Fakes: `InMemoryBillingUnitOfWork`, `FakeBankStatements`,
`RecordingReminderMailer`. Driving: handlers for `sales.OrderPaid.v1`, `sales.OrderShipped.v1`,
`payments.CardPaymentRefunded.v1`, private `SendReminder.v1`; scheduled tasks `import-bank-transfers`,
`run-dunning`; ops pages call `ListInvoices`, `ListBankTransfers`, `AssignBankTransfer`.

Builders: `buildBillingQueries`, `buildBillingOps` (`assignBankTransfer`), `buildBillingHandlers`,
`buildBillingScheduledTasks`, `buildBillingOutboxReader`, `buildBillingForTests`.

### `warehouse`

Driving ports:

```ts
// open host service (in the offer)
export type HoldStock = Acting<{ holdId: string; lines: readonly { sku: string; quantity: number }[] }, { expiresAt: Date },
  { code: 'out_of_stock'; skus: readonly string[] } | { code: 'hold_closed' }>;         // key = 'hold:<holdId>:<lines hash>'
export type GetStockLevels = Answering<{ skus: readonly string[] }, Readonly<Record<string, number>>>; // available units
export type ListShipments = Answering<ShipmentQuery, ShipmentPage>;
// internal
export type ConfirmStockHold = Acting<{ orderId: string; lines: readonly ReservedLine[] }, void, { code: 'stock_unavailable' }>;
export type ReleaseStock = Acting<{ orderId: string }, void, never>;
export type ShipOrder = Acting<{ orderId: string; shipTo: Address; lines: readonly ReservedLine[] }, { shipmentId: string },
  { code: 'reservation_released' } | { code: 'stock_unavailable' }>;
export type SyncArticle = Acting<{ productId: string; sku: string; title: string; offered: boolean; version: string }, void, never>;
export type RegisterArticle = Acting<{ sku: string }, void, never>;
export type SubmitShipment = Acting<{ shipmentId: string }, void, never>;
export type RecordDispatch = Acting<{ providerRef: string; trackingNumber: string | null; at: Date }, void, never>;
export type ExpireStockHolds = Acting<{ limit: number }, { expired: number }, never>;
export type ReconcileStockLevels = Acting<Record<string, never>, { updated: number }, never>;
export type ReconcileShipments = Acting<Record<string, never>, { repaired: number }, never>;
```

Driven ports:

```ts
export interface WarehouseTx {
  readonly reservations: ReservationRepository; readonly stockLevels: StockLevelRepository;
  readonly shipments: ShipmentRepository; readonly articles: ArticleRepository; readonly outbox: WarehouseOutbox;
}
export type WarehouseUnitOfWork = UnitOfWork<WarehouseTx>;
export interface StockLevelRepository {
  /** Loads and row-locks (SELECT ... FOR UPDATE, sku order) the levels and their active reservations. */
  lockForAllocation(skus: readonly string[]): Promise<readonly StockLevel[]>;
  available(skus: readonly string[]): Promise<Readonly<Record<string, number>>>;
  save(level: StockLevel): Promise<void>;
}
export interface FulfilmentProvider {
  upsertArticle(a: { sku: string; title: string }): Promise<Result<void, ProviderDown>>;
  createOutboundOrder(s: { shipmentId: string; shipTo: Address; lines: readonly { sku: string; quantity: number }[] }):
    Promise<Result<{ providerRef: string }, ProviderDown | { code: 'rejected'; reason: string }>>;
  availableStock(): Promise<Result<Readonly<Record<string, number>>, ProviderDown>>;
  outboundStatus(providerRef: string): Promise<Result<{ dispatchedAt: Date | null; trackingNumber: string | null }, ProviderDown>>;
}
export type ProviderDown = { code: 'provider_down' };
// ReservationRepository, ShipmentRepository, ArticleRepository, WarehouseOutbox: same pattern
```

Adapters: driven `PostgresWarehouseUnitOfWork`, one Postgres repository per aggregate,
`PostgresWarehouseOutbox`, `ThreePlFulfilment` (`fetch`; external order reference = shipment id, a
"reference already exists" answer is read as success; the 3PL's "order" is this system's shipment).
Fakes: `InMemoryWarehouseUnitOfWork`, `FakeFulfilmentProvider`; in the offer `fakeHoldStock`,
`fakeGetStockLevels`. Driving: hook `threePlWebhookRoute` (`POST /hooks/3pl`, key = 3PL event id,
translates `shipment.dispatched` into `RecordDispatch`); hook `createStockFieldHook(getStockLevels)`
→ `(sku: string) => Promise<number | null>` for Payload's `stock` field; handlers
`cms.ProductChanged.v1` (anti-corruption: Payload product → `SyncArticle`), commands
`ConfirmStockHold.v1`, `ReleaseStock.v1`, `ShipOrder.v1`, private `RegisterArticle.v1`,
`SubmitShipment.v1`; scheduled tasks `expire-stock-holds`, `reconcile-stock-levels`,
`reconcile-shipments`; ops shipments page calls `ListShipments`.

Builders: `buildWarehouseOpenHost` → `{ holdStock, getStockLevels, listShipments }`,
`buildWarehouseHooks` → `{ threePlRoute: FastifyPluginAsync; stockFieldHook }`,
`buildWarehouseHandlers`, `buildWarehouseScheduledTasks`, `buildWarehouseOutboxReader`,
`buildWarehouseForTests`.

### Payload CMS configuration (external system, `packages/cms`)

```ts
export interface CmsDeps { databaseUrl: string; secret: string; stockOf(sku: string): Promise<number | null> }
export function buildPayloadConfig(deps: CmsDeps): Promise<SanitizedConfig>;   // collections products, media, editors
export function createCmsOutboxReader(pool: Pool): OutboxReader;               // used by assembly of `worker`
export const ProductChangedV1: z.ZodType<{
  productId: string; slug: string; title: string; sku: string; priceCents: number;
  taxClass: 'tea' | 'accessories'; status: 'published' | 'draft' | 'deleted'; updatedAt: string;
}>;
```

`products` collection: `price` number field `min: 1` (cents), `sku` text `unique: true` with
`validate` refusing a change once the document exists, `taxClass` select `tea | accessories`, virtual
read-only `stock` field whose `afterRead` calls `deps.stockOf(sku)` and returns `null` on error.
`afterChange` and `afterDelete` call `writeProductChanged(req, doc)`, which inserts into
`payload.cms_outbox` through `req.payload.db.sessions[await req.transactionID].db` so the row commits
with the product. The table joins Payload's schema through `postgresAdapter({ afterSchemaInit })`.

## Calls and messages

### Synchronous calls

| # | Caller → callee | Caller's driven port → callee's driving port | How | Refusal comes back as |
|---|---|---|---|---|
| C1 | `sales` (`PlaceOrder`) → `warehouse` | `StockHolds.hold` → `HoldStock` | in-process, own transaction in `warehouse` | `Err({ code: 'out_of_stock', skus })`; throw/timeout (2 s) → `{ code: 'unavailable' }`; `PlaceOrder` answers `out_of_stock` (HTTP 409) or `stock_check_unavailable` (503) |
| C2 | `sales` (`PlaceOrder`, card) → `payments` | `CardPayments.start` → `StartCardPayment` | in-process, own transaction in `payments`, then Stripe | `gateway_unavailable` → `card_payments_unavailable` (503); the hold from C1 expires by itself |
| C3 | Payload `stock` field → `warehouse` | hook → `GetStockLevels` | in-process in `web` | error → field shows nothing ("unavailable") |
| C4 | `payments` → Stripe | `CardGateway` | HTTPS | Stripe errors mapped to `GatewayDown` / `rejected` / `already_captured` |
| C5 | `warehouse` → 3PL | `FulfilmentProvider` | HTTPS | `ProviderDown` → handler throws, redelivered; `rejected` → shipment `rejected`, shown on ops page |
| C6 | `billing` → bank | `BankStatements` | HTTPS | `bank_down` → task ends, next slot retries from the cursor |
| C7 | `sales`, `billing` → Resend | mailers | HTTPS, header `Idempotency-Key: <dedupeKey>` | throw → handler redelivered |
| C8 | `sales` → Next.js page cache | `ShopPageCache` | `POST <web>/api/revalidate` with tags | non-2xx → handler redelivered |
| C9 | Stripe → `payments` | hook `/hooks/stripe` → `RecordGatewayEvent` | HTTPS | settles with 200 after commit; 400 bad signature; 500 → Stripe redelivers |
| C10 | 3PL → `warehouse` | hook `/hooks/3pl` → `RecordDispatch` | HTTPS | 200 after commit; 500 → 3PL redelivers |

Ops pages in `web` and the HTTP routes of `api` are driving adapters, not calls between systems.

### Messages

All go outbox → relay → bus (pg-boss). Events: relay calls `boss.publish(type, envelope)`, each
subscriber has its own queue (`boss.subscribe(type, queue)`). Commands and private messages: relay
calls `boss.send(type, envelope)` to the one queue named after the type. Each queue: `retryLimit: 12`,
`retryDelay: 5`, `retryBackoff: true`, `deadLetter: '<queue>.dead'`. A handler settles by resolving
(pg-boss completes the job); throwing, including `Deferred`, fails it and pg-boss redelivers. A
command's refusal comes back as an event `<Command>Refused` (or a named equivalent) published by the
receiver, which the sender subscribes to; the receiver records the refusal in its
`processed_messages` row so a redelivery answers the same.

| # | Type | Kind | Publisher | Subscriber (queue → driving port) | Sync | Refusal |
|---|---|---|---|---|---|---|
| M1 | `cms.ProductChanged.v1` | event, published | Payload CMS (`cms_outbox`, reader from assembly) | `sales.refresh-catalog-entry` → `RefreshCatalogEntry`; `warehouse.sync-article` → `SyncArticle` | no | events are not refused |
| M2 | `warehouse.ConfirmStockHold.v1` | command | `sales` | `warehouse` → `ConfirmStockHold` | no | M8 |
| M3 | `warehouse.ReleaseStock.v1` | command | `sales` | `warehouse` → `ReleaseStock` | no | never refused (release of an unknown hold writes a released tombstone) |
| M4 | `warehouse.ShipOrder.v1` | command | `sales` | `warehouse` → `ShipOrder` | no | M9 |
| M5 | `payments.CancelCardPayment.v1` | command | `sales` | `payments` → `CancelCardPayment` | no | M12 |
| M6 | `payments.RefundCardPayment.v1` | command | `sales` (late payment) | `payments` → `RefundCardPayment` | no | M13 |
| M7 | `warehouse.ShipmentDispatched.v1` | event | `warehouse` | `sales.record-dispatch` → `RecordDispatch` | no | — |
| M8 | `warehouse.StockHoldConfirmationRefused.v1` | event | `warehouse` | `sales.record-fulfilment-impossible` → `RecordFulfilmentImpossible` | no | — |
| M9 | `warehouse.ShipOrderRefused.v1` | event | `warehouse` | `sales.record-fulfilment-impossible` | no | — |
| M10 | `payments.CardPaymentSucceeded.v1` | event | `payments` | `sales.record-card-payment` → `RecordPayment` | no | — |
| M11 | `payments.CardPaymentRefunded.v1` | event | `payments` | `billing.issue-credit-note` → `IssueCreditNote` | no | — |
| M12 | `payments.CardPaymentCancellationRefused.v1` | event | `payments` | `sales.record-card-cancellation-refused` | no | — |
| M13 | `payments.RefundRefused.v1` | event | `payments` | `sales.record-late-refund-refused` | no | — |
| M14 | `sales.OrderPaid.v1` (full order: buyer, lines with sku, title, qty, unit price, tax class, method) | event | `sales` | `billing.issue-invoice-for-paid-order` (acts only when method = card) | no | — |
| M15 | `sales.OrderShipped.v1` (full order, shippedAt) | event | `sales` | `billing.issue-invoice-for-shipped-order` (acts only when method = invoice) | no | — |
| M16 | `billing.InvoicePaid.v1` | event | `billing` | `sales.record-invoice-payment` → `RecordPayment` | no | — |
| M17 | `billing.DunningStageChanged.v1` (`customerId`, `stage`, `version`) | event | `billing` | `sales.refresh-payment-standing` → `RefreshPaymentStanding` | no | — |
| M18 | `sales.private.SendOrderConfirmation.v1` | private | `sales` | `sales` → `SendOrderConfirmation` | no | — |
| M19 | `sales.private.InvalidateShopPage.v1` | private | `sales` | `sales` → `InvalidateShopPage` | no | — |
| M20 | `payments.private.SubmitRefund.v1` | private | `payments` | `payments` → `SubmitRefund` | no | Stripe rejection → refund `failed`, M13 if reason late payment |
| M21 | `warehouse.private.RegisterArticle.v1` | private | `warehouse` | `warehouse` → `RegisterArticle` | no | — |
| M22 | `warehouse.private.SubmitShipment.v1` | private | `warehouse` | `warehouse` → `SubmitShipment` | no | — |
| M23 | `billing.private.SendReminder.v1` | private | `billing` | `billing` → `SendReminder` | no | — |

### The order, end to end (orchestration by `sales`' Order as process manager; a saga)

1. `PlaceOrder`: read cart, catalog Replica, standing Replica; `Order.place` checks offer, invoice
   allowed (`mayPayByInvoice`), takes line Snapshots → C1 `hold` (holdId = order id = cart id) → C2
   for card → one `sales` transaction: save order, close cart, outbox: M2, M18, and for invoice orders
   M4 → answer `{ orderId, payment }`.
2. Card: M10 → `RecordPayment` → order `paid` → M4 + M14. Unpaid at `payBy` (placed + 30 min):
   `cancel-overdue-orders` → `cancelled` → M3 + M5.
3. M7 → `RecordDispatch` → `shipped` → M15. Invoice orders: M16 → `paid` → M14 (billing ignores it).
4. M8 or M9 → `RecordFulfilmentImpossible` → `cancelled` → M3, plus M5 (card unpaid) or M6 (card paid).
5. M10 on a `cancelled` order, or M12 → `refund-late-payment` → M6 (refund key `late:<orderId>`, so
   both paths make one refund).

## Processes

| Deployable | Entry point | Runs | Instances |
|---|---|---|---|
| `web` | `next start` in `apps/web`; `apps/web/instrumentation.ts` | Payload admin and REST, shop pages, ops pages, `POST /api/revalidate`, `GET /health`, `GET /metrics` | 1 |
| `api` | `node apps/api/dist/main.js` | Fastify: cart, checkout, `/hooks/stripe`, `/hooks/3pl`, `/health`, `/metrics` | 2+ |
| `worker` | `node apps/worker/dist/main.js` | pg-boss workers for every handler, all scheduled tasks, the relay, probe server on `:9100` | 1+ |
| `migrate` | `node apps/migrate/dist/main.js` | one-shot job before every rollout | job |

One container image, four commands. Each process starts telemetry first
(`startTelemetry(serviceName)` from the common library), then assembly.

### Assembly per process

- `api` (`apps/api/src/assembly.ts`): pools `sales_app`, `payments_app`, `warehouse_app`, `probe`;
  `buildWarehouseOpenHost`, `buildWarehouseHooks`, `buildPaymentsOpenHost`, `buildPaymentsStripeHook`;
  `buildSalesHttp(cfg, { holdStock, startCardPayment })`; registers the plugins plus
  `requestContextPlugin` and `probeRoutes`. No courier: Fastify takes the plugins as arguments.
- `worker` (`apps/worker/src/assembly.ts`): pools of all four systems, `relay`, `pgboss`, `probe`;
  handlers and scheduled tasks from every system's builders; outbox readers from every system's
  builder and `createCmsOutboxReader(relayPool)` for Payload; `createPgBossBus(boss)`;
  `createRelay({ readers, bus, intervalMs: 250, batch: 100 })`; `runHandlers(boss, handlers)`;
  `schedule(boss, tasks)` (`boss.schedule(name, cron, slot, { tz })`, key = `<task>@<slot>`).
- `web` (`apps/web/src/assembly.ts`, called from `instrumentation.ts` `register()` when
  `NEXT_RUNTIME === 'nodejs'`): pools `sales_app`, `billing_app`, `warehouse_app`, `payments_app`,
  `probe`; `buildSalesQueries`, `buildBillingQueries`, `buildBillingOps`, `buildWarehouseOpenHost`,
  `buildPaymentsOpenHost`, `createStockFieldHook(getStockLevels)`. Courier: `apps/web/src/courier.ts`
  stores the result in `globalThis.__teashopWeb` (declared `var __teashopWeb: WebContainer | undefined`);
  pages, server actions, route handlers and `payload.config.ts` (`stockOf: (sku) =>
  container().stockFieldHook(sku)`) read it through `container()`, which throws if assembly has not run.
- Ambient values: per process, the parsed config (`config.ts`, zod over `process.env`); per request,
  `requestContext` (`AsyncLocalStorage<{ requestId: string }>`), set by the Fastify plugin, by a
  `withRequestContext` wrapper around Next route handlers and server actions, and by the handler runner from `envelope.trace`. The
  logger's `mixin` reads it; outbox adapters copy it plus `propagation.inject` into `envelope.trace`;
  the handler runner extracts it and opens a CONSUMER span. Use cases read no ambient value.

### Scheduled tasks

| Task | Cron (Europe/Berlin) | Port |
|---|---|---|
| `sales.cancel-overdue-orders` | `* * * * *` | `CancelOverdueOrders` |
| `payments.expire-abandoned-payments` | `*/10 * * * *` | `ExpireAbandonedPayments` (awaiting > 60 min) |
| `payments.reconcile-card-payments` | `0 * * * *` | `ReconcileCardPayments` (Reconciliation against Stripe) |
| `billing.import-bank-transfers` | `*/5 * * * *` | `ImportBankTransfers` |
| `billing.run-dunning` | `0 6 * * *` | `RunDunning` |
| `warehouse.expire-stock-holds` | `* * * * *` | `ExpireStockHolds` (holds live 15 min) |
| `warehouse.reconcile-stock-levels` | `*/15 * * * *` | `ReconcileStockLevels` (Reconciliation against the 3PL) |
| `warehouse.reconcile-shipments` | `30 * * * *` | `ReconcileShipments` (submitted shipments without dispatch hook) |

### Migrations

`apps/migrate/src/main.ts`, run with role `migrator` (owner of every schema), in order:
1. `apps/migrate/sql/000_roles_and_schemas.sql`, idempotent: schemas `sales`, `payments`, `billing`,
   `warehouse`, `payload`, `pgboss`; roles `sales_app`, `payments_app`, `billing_app`,
   `warehouse_app`, `payload_app`, `relay`, `pgboss_app`, `probe`; each `*_app` gets `USAGE` and
   DML on its own schema only (default privileges); `relay` gets `SELECT, UPDATE` on the five outbox
   tables only; `probe` gets `CONNECT` only.
2. pg-boss: `new PgBoss({ schema: 'pgboss', migrate: true }).start()` then `stop()`; other processes
   start pg-boss with `migrate: false`.
3. Payload: `payload migrate` with `packages/cms/src/migrations` (`push: false` outside development).
4. Drizzle, per system: `migrate(db, { migrationsFolder: 'systems/<s>/drizzle', migrationsSchema: '<s>' })`.

Every migration is expand-only; a contract migration ships in a later release than the code that stopped
reading the column. `tooling/check-migrations-expand-only.ts` fails CI on `DROP`, `RENAME`, type change
or `NOT NULL` without default in a migration not listed in `tooling/contract-migrations.json`.
Shutdown: on `SIGTERM` `api` closes Fastify, `worker` calls `boss.stop({ graceful: true, timeout: 30000 })`
and stops the relay loop after its batch, then pools end.

## Directory tree

```
teashop/
├── package.json                          # scripts: typecheck, lint, test, test:int, test:e2e, build
├── pnpm-workspace.yaml                   # apps/*, packages/*, systems/*, tooling
├── tsconfig.base.json                    # strict, noUncheckedIndexedAccess, moduleResolution nodenext
├── biome.json                            # overrides for systems/*/src/domain/** and service/**
├── .dependency-cruiser.cjs               # boundaries (see P5, P12, P16)
├── vitest.workspace.ts                   # default suite excludes *.int.test.ts, *.e2e.test.ts
├── docker-compose.yml                    # postgres:17, jaegertracing/all-in-one
├── .env.example
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── src/{main.ts, assembly.ts, config.ts, server.ts}
│   │   └── test/server.test.ts
│   ├── worker/
│   │   ├── package.json
│   │   ├── src/{main.ts, assembly.ts, config.ts, probe-server.ts}
│   │   └── test/assembly.test.ts
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts                # withPayload
│   │   ├── instrumentation.ts
│   │   ├── src/
│   │   │   ├── assembly.ts
│   │   │   ├── courier.ts
│   │   │   ├── config.ts
│   │   │   ├── payload.config.ts         # buildPayloadConfig({ stockOf: courier-backed })
│   │   │   └── app/
│   │   │       ├── (payload)/admin/[[...segments]]/page.tsx
│   │   │       ├── (payload)/api/[...slug]/route.ts
│   │   │       ├── (shop)/page.tsx                      # unstable_cache, tags ['catalog'], revalidate 600
│   │   │       ├── (shop)/products/[slug]/page.tsx      # tags ['product:<slug>']
│   │   │       ├── (ops)/ops/orders/page.tsx
│   │   │       ├── (ops)/ops/invoices/page.tsx
│   │   │       ├── (ops)/ops/transfers/page.tsx
│   │   │       ├── (ops)/ops/shipments/page.tsx
│   │   │       ├── (ops)/ops/dead-letters/page.tsx
│   │   │       ├── (ops)/ops/actions.ts                 # refund, assign transfer, requeue dead letter
│   │   │       ├── api/revalidate/route.ts              # revalidateTag per tag
│   │   │       ├── health/route.ts
│   │   │       └── metrics/route.ts
│   │   └── test/courier.test.ts
│   └── migrate/
│       ├── package.json
│       ├── src/main.ts
│       └── sql/000_roles_and_schemas.sql
├── packages/
│   ├── common/
│   │   ├── package.json                  # exports ./result ./ports ./messaging ./db ./observability ./http ./testing
│   │   ├── src/
│   │   │   ├── result.ts
│   │   │   ├── ports.ts
│   │   │   ├── clock.ts                  # systemClock, fixedClock
│   │   │   ├── ids.ts                    # uuidv7Ids, sequentialIds
│   │   │   ├── messaging/{envelope.ts, outbox-table.ts, outbox-reader.ts, processed-messages-table.ts,
│   │   │   │              relay.ts, pg-boss-bus.ts, handler-runner.ts, scheduler.ts, dead-letters.ts}
│   │   │   ├── db/{pool.ts, unit-of-work.ts, concurrency.ts}   # ConcurrencyConflict, retryOnConflict(3)
│   │   │   ├── observability/{telemetry.ts, logger.ts, request-context.ts, trace-propagation.ts}
│   │   │   ├── http/{request-context-plugin.ts, probe-routes.ts, problem.ts}
│   │   │   └── testing/{recording-outbox.ts, in-memory-unit-of-work.ts}
│   │   └── test/{result.test.ts, messaging/relay.test.ts, messaging/handler-runner.test.ts,
│   │             db/unit-of-work.int.test.ts, messaging/outbox-reader.int.test.ts}
│   ├── kernel-money/
│   │   ├── package.json
│   │   ├── src/{index.ts, money.ts}
│   │   └── test/money.test.ts
│   └── cms/
│       ├── package.json                  # exports ./config ./offer
│       ├── src/
│       │   ├── build-payload-config.ts
│       │   ├── collections/{products.ts, media.ts, editors.ts}
│       │   ├── fields/stock-field.ts
│       │   ├── hooks/write-product-changed.ts
│       │   ├── outbox/{schema.ts, reader.ts}
│       │   ├── published-language/product-changed.v1.ts
│       │   ├── offer.ts
│       │   ├── payload-types.ts          # generated
│       │   └── migrations/
│       └── test/{collections/products.test.ts, hooks/write-product-changed.int.test.ts}
├── systems/
│   ├── sales/
│   │   ├── package.json                  # name @teashop/sales, exports { "./offer": "./src/offer.ts" }
│   │   ├── GLOSSARY.md
│   │   ├── drizzle.config.ts             # schemaFilter ['sales']
│   │   ├── drizzle/                      # generated SQL migrations
│   │   ├── src/
│   │   │   ├── offer.ts                  # published language, builders, (no open host service fakes: none offered)
│   │   │   ├── published-language/{order-paid.v1.ts, order-shipped.v1.ts, index.ts}
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts
│   │   │   │   ├── order/{order.ts, order-line.ts, order-state.ts, order-decision.ts, payment-deadline.ts}
│   │   │   │   ├── cart/cart.ts
│   │   │   │   ├── catalog/catalog-entry.ts
│   │   │   │   └── customer/{customer.ts, payment-standing.ts, may-pay-by-invoice.ts}
│   │   │   ├── ports/{driving.ts, driven.ts}
│   │   │   ├── service/
│   │   │   │   ├── add-to-cart.ts, change-cart-quantity.ts, get-cart.ts
│   │   │   │   ├── browse-catalog.ts, get-catalog-entry.ts
│   │   │   │   ├── place-order.ts, list-orders.ts, get-order.ts
│   │   │   │   ├── refresh-catalog-entry.ts, refresh-payment-standing.ts
│   │   │   │   ├── record-payment.ts, record-dispatch.ts, record-fulfilment-impossible.ts
│   │   │   │   ├── record-card-cancellation-refused.ts, record-late-refund-refused.ts
│   │   │   │   ├── send-order-confirmation.ts, invalidate-shop-page.ts
│   │   │   │   └── cancel-overdue-orders.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/postgres/{schema.ts, unit-of-work.ts, order-repository.ts, cart-repository.ts,
│   │   │   │   │                    customer-repository.ts, catalog-entry-repository.ts,
│   │   │   │   │                    payment-standing-repository.ts, outbox.ts, outbox-reader.ts}
│   │   │   │   ├── driven/{warehouse-stock-holds.ts, payments-card-payments.ts,
│   │   │   │   │           resend-order-confirmation-mailer.ts, next-shop-page-cache.ts}
│   │   │   │   ├── driving/http/{cart-routes.ts, checkout-route.ts}
│   │   │   │   ├── driving/handlers/{refresh-catalog-entry.ts, refresh-payment-standing.ts,
│   │   │   │   │                     record-card-payment.ts, record-invoice-payment.ts, record-dispatch.ts,
│   │   │   │   │                     record-fulfilment-impossible.ts, record-card-cancellation-refused.ts,
│   │   │   │   │                     record-late-refund-refused.ts, send-order-confirmation.ts,
│   │   │   │   │                     invalidate-shop-page.ts}
│   │   │   │   └── driving/scheduled/cancel-overdue-orders.ts
│   │   │   ├── fakes/{in-memory-unit-of-work.ts, fake-stock-holds.ts, fake-card-payments.ts,
│   │   │   │          recording-mailer.ts, recording-shop-page-cache.ts}
│   │   │   └── builders/build-sales.ts
│   │   └── test/
│   │       ├── domain/order/{order.test.ts, payment-deadline.test.ts}
│   │       ├── domain/customer/may-pay-by-invoice.test.ts
│   │       ├── service/{place-order.test.ts, record-payment.test.ts, cancel-overdue-orders.test.ts, ...}
│   │       ├── adapters/driven/postgres/{order-repository.int.test.ts, unit-of-work.int.test.ts, outbox.int.test.ts}
│   │       ├── adapters/driven/order-repository.contract.ts   # run against fake and Postgres
│   │       ├── adapters/driving/http/checkout-route.test.ts
│   │       └── adapters/driving/handlers/refresh-catalog-entry.test.ts
│   ├── payments/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│   │   ├── src/
│   │   │   ├── offer.ts
│   │   │   ├── published-language/{start-card-payment.ts, refund-card-payment.ts, cancel-card-payment.v1.ts,
│   │   │   │                        refund-card-payment.v1.ts, card-payment-succeeded.v1.ts,
│   │   │   │                        card-payment-refunded.v1.ts, card-payment-cancellation-refused.v1.ts,
│   │   │   │                        refund-refused.v1.ts}
│   │   │   ├── domain/{ids.ts, card-payment.ts, refund.ts, may-refund.ts}
│   │   │   ├── ports/{driving.ts, driven.ts}
│   │   │   ├── service/{start-card-payment.ts, cancel-card-payment.ts, refund-card-payment.ts,
│   │   │   │            submit-refund.ts, record-gateway-event.ts, expire-abandoned-payments.ts,
│   │   │   │            reconcile-card-payments.ts, get-card-payment.ts, list-card-payments.ts}
│   │   │   ├── adapters/driven/postgres/{schema.ts, unit-of-work.ts, card-payment-repository.ts, outbox.ts, outbox-reader.ts}
│   │   │   ├── adapters/driven/stripe-card-gateway.ts
│   │   │   ├── adapters/driving/hooks/stripe-webhook-route.ts
│   │   │   ├── adapters/driving/handlers/{cancel-card-payment.ts, refund-card-payment.ts, submit-refund.ts}
│   │   │   ├── adapters/driving/scheduled/{expire-abandoned-payments.ts, reconcile-card-payments.ts}
│   │   │   ├── fakes/{in-memory-unit-of-work.ts, fake-card-gateway.ts, fake-open-host.ts}
│   │   │   └── builders/build-payments.ts
│   │   └── test/ (mirrors src; stripe-card-gateway.e2e.test.ts against Stripe test mode)
│   ├── billing/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│   │   ├── src/
│   │   │   ├── offer.ts
│   │   │   ├── published-language/{invoice-paid.v1.ts, dunning-stage-changed.v1.ts}
│   │   │   ├── domain/{ids.ts, invoice.ts, credit-note.ts, vat.ts, number-series.ts, bank-transfer.ts,
│   │   │   │           matches-invoice.ts, customer-account.ts, dunning-policy.ts}
│   │   │   ├── ports/{driving.ts, driven.ts}
│   │   │   ├── service/{issue-invoice-for-paid-order.ts, issue-invoice-for-shipped-order.ts,
│   │   │   │            issue-credit-note.ts, import-bank-transfers.ts, assign-bank-transfer.ts,
│   │   │   │            run-dunning.ts, send-reminder.ts, list-invoices.ts, list-bank-transfers.ts}
│   │   │   ├── adapters/driven/postgres/{schema.ts, unit-of-work.ts, invoice-repository.ts,
│   │   │   │                             credit-note-repository.ts, number-series-repository.ts,
│   │   │   │                             bank-transfer-repository.ts, import-cursor-repository.ts,
│   │   │   │                             customer-account-repository.ts, outbox.ts, outbox-reader.ts}
│   │   │   ├── adapters/driven/{bank-api-statements.ts, resend-reminder-mailer.ts}
│   │   │   ├── adapters/driving/handlers/{issue-invoice-for-paid-order.ts, issue-invoice-for-shipped-order.ts,
│   │   │   │                               issue-credit-note.ts, send-reminder.ts}
│   │   │   ├── adapters/driving/scheduled/{import-bank-transfers.ts, run-dunning.ts}
│   │   │   ├── fakes/{in-memory-unit-of-work.ts, fake-bank-statements.ts, recording-reminder-mailer.ts}
│   │   │   └── builders/build-billing.ts
│   │   └── test/ (mirrors src)
│   └── warehouse/
│       ├── package.json, GLOSSARY.md, drizzle.config.ts, drizzle/
│       ├── src/
│       │   ├── offer.ts
│       │   ├── published-language/{hold-stock.ts, get-stock-levels.ts, confirm-stock-hold.v1.ts,
│       │   │                        release-stock.v1.ts, ship-order.v1.ts, shipment-dispatched.v1.ts,
│       │   │                        stock-hold-confirmation-refused.v1.ts, ship-order-refused.v1.ts}
│       │   ├── domain/{ids.ts, reservation.ts, stock-level.ts, can-allocate.ts, article.ts, shipment.ts}
│       │   ├── ports/{driving.ts, driven.ts}
│       │   ├── service/{hold-stock.ts, get-stock-levels.ts, confirm-stock-hold.ts, release-stock.ts,
│       │   │            ship-order.ts, sync-article.ts, register-article.ts, submit-shipment.ts,
│       │   │            record-dispatch.ts, expire-stock-holds.ts, reconcile-stock-levels.ts,
│       │   │            reconcile-shipments.ts, list-shipments.ts}
│       │   ├── adapters/driven/postgres/{schema.ts, unit-of-work.ts, reservation-repository.ts,
│       │   │                             stock-level-repository.ts, shipment-repository.ts,
│       │   │                             article-repository.ts, outbox.ts, outbox-reader.ts}
│       │   ├── adapters/driven/three-pl-fulfilment.ts
│       │   ├── adapters/driving/hooks/{three-pl-webhook-route.ts, payload-stock-field-hook.ts}
│       │   ├── adapters/driving/handlers/{sync-article.ts, confirm-stock-hold.ts, release-stock.ts,
│       │   │                               ship-order.ts, register-article.ts, submit-shipment.ts}
│       │   ├── adapters/driving/scheduled/{expire-stock-holds.ts, reconcile-stock-levels.ts, reconcile-shipments.ts}
│       │   ├── fakes/{in-memory-unit-of-work.ts, fake-fulfilment-provider.ts, fake-open-host.ts}
│       │   └── builders/build-warehouse.ts
│       └── test/ (mirrors src; three-pl-fulfilment.e2e.test.ts against the 3PL sandbox)
└── tooling/
    ├── package.json
    ├── biome/no-ambient-effects.grit       # Date.now(), new Date() without args, Math.random() in domain/service
    ├── republish-products.ts               # writes cms.ProductChanged.v1 for every product (first deploy, recovery)
    ├── check-migrations-expand-only.ts
    └── contract-migrations.json
```

## How each property holds

**P1.** Domain modules are plain TypeScript (classes, functions, branded ids) importing only their own
domain, `@teashop/kernel-money` and `@teashop/common/result`. dependency-cruiser forbids
`systems/*/src/domain/**` importing anything else (`drizzle-orm`, `pg`, `stripe`, `payload`,
`fastify`, `zod`, `node:*`, other systems). Repositories map rows to aggregates in adapters; Stripe,
3PL, Payload and bank shapes stop at the anti-corruption adapters. No system conforms to an upstream
(D25), so the Except is unused; the shared kernel is our own model, agreed, not an upstream's. Holds.

**P2.** Each business rule has one home. `sales` domain: line Snapshot at order time
(`Order.place`), invoice not offered in dunning (`mayPayByInvoice` Specification), payment deadline
(`payment-deadline.ts`), ship when paid by card or at once for invoice, cancel and refund rules
(`Order`). `payments` domain: refund only captured, not disputed, not above refundable (`mayRefund`).
`billing` domain: VAT 7% `reduced` / 19% `standard` (`vat.ts`), one invoice per paid card order or per
shipped invoice order, gapless numbers (`NumberSeries.next()`), credit note per refund, transfer
matching (`matchesInvoice`), dunning stages (`dunning-policy.ts`). `warehouse` domain: availability and
holds (`canAllocate`, `Reservation`), ship only registered skus (`Shipment`). Product rules (price > 0,
sku unique, sku unchanged, tax classes) live once, in Payload's collection configuration, read per S1;
no system of ours repeats them (`sales` takes Payload's records as they come). Driving adapters
validate shape with zod only. Holds under reading S1; nothing mechanical stops a rule being copied into
an adapter, review does.

**P3.** The system cut follows reasons to change: selling (`sales`), card money with Stripe
(`payments`), tax law and accounts receivable (`billing`), goods and the 3PL (`warehouse`), catalogue
copy (Payload). Inside a domain, one folder per aggregate; Specifications sit beside the aggregate they
judge. VAT and numbering change with tax law and sit together in `billing`; dunning stages (credit
policy) sit in `billing` too, while the use of the stage at checkout is a `sales` rule. Holds.

**P4.** A use case is a factory (`createPlaceOrder(deps)`) returning the driving port; every caller
(Fastify route, handler, scheduled task, Next page, test) calls that same function. Driving adapters
only translate. Behind each driven port, real and fake adapters pass one contract suite
(`test/adapters/driven/*.contract.ts`), run against the fake in the default suite and against Postgres
in integration tests. Holds.

**P5.** Services receive every driven port as a factory argument; only `builders/` imports both
`service/` and `adapters/`, and builders are called only from `apps/*/src/assembly.ts`.
dependency-cruiser forbids `service/**` importing `adapters/**`, `node:*`, `pg`, `drizzle-orm`, SDKs,
`fetch` wrappers, and Biome's `noRestrictedGlobals` (`fetch`, `process`, `setTimeout`, `crypto`) plus
`tooling/biome/no-ambient-effects.grit` cover globals in `domain/**` and `service/**`. Ports are typed
in the system's own terms (its ids, its `Money`, its `Address`). The only common-library code a
service reaches that touches the outside is the logger (stdout) and the tracer (exporter), whose output
changes nothing a use case does (S3). Cross-system calls go through a driven port whose adapter wraps
the other system's driving port, handed in by assembly. Holds.

**P6.** Every system exports `build<System>ForTests()`, wiring every use case to fakes
(`InMemory*UnitOfWork`, recording outbox, `Fake*Gateway`/`Provider`/`Statements`, `fixedClock`,
`sequentialIds`). The default suite (`vitest`, excluding `*.int.test.ts` and `*.e2e.test.ts`) runs every
use case with nothing outside the process. Holds.

**P7.** Each use case writes through one `UnitOfWork.run`: one Drizzle `db.transaction` on the
system's own pool, with every repository, the outbox and `processed_messages` bound to it. Effects
outside the store are not writes to this system's records: they happen before the transaction only when
tentative (C1, C2) or after it via private messages. Holds.

**P8.** Nothing final leaves a use case before commit: mails (M18, M23), refunds (M20), 3PL orders
(M22), article registration (M21), page revalidation (M19) and every cross-system message are outbox
rows in the same transaction and run only after the relay sees them committed. What runs before commit
is a Tentative operation: the stock hold (expires after 15 min unless M2 confirms it) and the Stripe
PaymentIntent (charges only after the browser gets the secret, which it gets only after commit;
otherwise `expire-abandoned-payments` cancels it). Nothing is lost after commit: outbox rows stay until
the relay marks them after the bus accepted them; pg-boss redelivers failed jobs and keeps exhausted
ones as dead letters on `/ops/dead-letters`. Payload writes its outbox row in its own product
transaction. Hooks answer 2xx only after commit, so Stripe and the 3PL redeliver otherwise. Holds; the
page cache of a second `web` instance would miss a revalidation, which is why `web` runs one instance
with a 600 s fallback (D19).

**P9.** Every acting call carries an `IdempotencyKey`: message id for handlers, provider event id for
hooks, `<task>@<slot>` for scheduled tasks, cart id for checkout, a form-generated UUID for ops
actions. `UnitOfWork.run` inserts `(consumer, key)` into `processed_messages` first; a concurrent
redelivery blocks on that primary key until the first commits, then finds the row and returns the stored
answer, refusals included, without running the work. Effects outside the store carry provider dedupe
keys: Stripe `Idempotency-Key` (`pi:`, `re:`), Resend `Idempotency-Key` (`order-confirmation:<orderId>`,
`reminder:<invoiceId>:<stage>`), 3PL external reference = shipment id, article upsert by sku. Bank
transfers are keyed by the bank's transaction id. Against F9: Resend and Stripe keep keys for 24 h;
beyond that a redelivered private message could send a second mail, but no record changes. Holds for
records; external effects deduped within the providers' windows.

**P10.** Aggregates carry `version`; `save` runs `UPDATE ... WHERE id = $1 AND version = $2` and
throws `ConcurrencyConflict` on zero rows; services wrap `run` in `retryOnConflict(3)`, re-reading
everything. Stale reads a business rule accepts: the catalog Replica price at checkout (the listed price
is the price) and the payment standing Replica (a customer entering dunning moments ago may still pick
invoice). Where rules tie use cases: holds on the same sku (`lockForAllocation` takes row locks in sku
order), invoices of the same year (`NumberSeries` version conflict, retried), the same order. Use cases
on other aggregates do not touch each other. Holds.

**P11.** Each system connects with its own role, which has privileges on its own schema only; no other
role can write it (`relay` may only `SELECT, UPDATE` outbox tables). Others learn its records only from
its published language: events (M7-M17), open host service results (C1-C3), or the answering ports the
ops pages call. Payload's products reach `sales` and `warehouse` only as `cms.ProductChanged.v1`.
Holds.

**P12.** Every downstream adapter that touches an upstream translates: handlers parse the upstream's
schema with zod and map to the system's own port input; driven adapters map the system's port to the
upstream's. dependency-cruiser allows imports of `@teashop/<other>/offer` and `@teashop/cms/offer`
only from `src/adapters/**`, and forbids every other path into another system (package `exports`
expose only `./offer`). The one model shared inward, `kernel-money`, is a declared dependency of the
three domains that chose it. Holds.

**P13.** A system's domain never leaves it: the offer exports published-language types and zod schemas
that are separate from domain types, mapped in its outbox adapter and open host service adapter.
Message types carry `.vN`; a breaking change adds `vN+1`, the publisher writes both until every
subscriber has moved, then drops the old one. Open host service ports change additively; a breaking
change adds a second port (`HoldStockV2`) beside the first. Holds.

**P14.** A message version is immutable once published; outbox rows store the serialized published
language, so a row written by old code still parses with the same schema. Handlers keep accepting every
version still possibly in outboxes or queues (CI greps the version registry against
`tooling/contract-migrations.json` releases). Records: expand-only migrations, contracts a release
later; a new enum value is first released as readable by all code, then written in a later release, so
during a rolling deploy old processes never meet a value they misread. Holds.

**P15.** Use cases and what they need now: card `PlaceOrder` needs `warehouse` (no overselling, D8)
and Stripe (the browser needs `client_secret` in the response); invoice `PlaceOrder` needs `warehouse`
only. Everything else works with others down: catalog and standing are Replicas, mails, 3PL and Stripe
refunds go through private messages, bank import resumes from its cursor, the Payload stock field shows
nothing instead of failing the editor's page, ops pages render each panel independently. Holds, with
the two named business-rule exceptions.

**P16.** Each system's store is its own role and pool (S4): a transaction opened on `sales_app`
cannot write `warehouse.*`. Cross-system calls (C1, C2) commit in the callee's transaction before the
caller opens its own. dependency-cruiser forbids importing another system's `adapters/**`. Payload
commits its product and outbox row in its own transaction on `payload_app`. Holds.

**P17.** Every cross-system piece of work has an end: a hold ends confirmed (M2) or expired; a card
payment ends captured, cancelled (M5, or expired after 60 min), refunded; an order ends `shipped` and
`paid`, or `cancelled` with stock released and the card cancelled or refunded; a refusal (M8, M9, M12,
M13) drives the order to one of those. Allowed end states are the `OrderState` terminal values.
Retries are bounded (pg-boss `retryLimit: 12`, backoff); an exhausted message becomes a dead letter on
`/ops/dead-letters`, which an operator requeues or settles; reconciliations repair missed hooks hourly.
Holds; a dead letter ends by an operator.

**P18.** Order-independent handling: Replicas apply a change only if its `version` is newer (Payload
`updatedAt`, billing stage `version`); `Reservation` and `Order` states are monotone with terminal
states that win (`released` beats a later `ConfirmStockHold`; `ShipOrder` before `ConfirmStockHold`
confirms; a late payment on a `cancelled` order refunds, from either M10 or M12, under one refund key);
a message whose prerequisite has not arrived (credit note before its invoice) throws `Deferred` and is
redelivered after it has. Holds.

**P19.** Each system has a `GLOSSARY.md`; translations at anti-corruption adapters keep one meaning
inside: Payload's "product" is `sales`' "catalog entry" and `warehouse`' "article"; the 3PL's
"order" is `warehouse`' "shipment"; `sales`' "payment" means only the order's payment state, `payments`'
"card payment" the Stripe-backed record; "tax class" (`sales`) becomes "tax category" (`billing`).
Nothing mechanical checks term use; review against the glossary does. Holds by review only.

## Decisions the document left to me

**D1. System cut.** Chose `sales`, `payments`, `billing`, `warehouse`, plus Payload as external
system. Also holding every property: `payments` inside `sales`; `warehouse` split into `inventory` and
`fulfilment`; dunning split from `billing`.

**D2. Who owns products.** Chose Payload CMS as external system owning products, its configuration
holding price > 0, sku unique, sku unchanged, tax classes. Also holding: a `catalog` system of ours
owning products, Payload reduced to an editing UI calling `catalog`'s driving ports from its hooks.

**D3. How product data reaches `sales` and `warehouse`.** Chose an outbox in Payload's schema written
in Payload's transaction, relayed as `cms.ProductChanged.v1`, kept as Replicas. Also holding:
synchronous reads of Payload's Local API at cart and checkout time (with checkout then needing Payload
now, which P15 would only allow with a business rule).

**D4. Bus and relay.** Chose pg-boss 10 on the same Postgres, relay polling every 250 ms with
`FOR UPDATE SKIP LOCKED`, inside `worker`. Also holding: RabbitMQ or NATS JetStream; relay woken by
`LISTEN/NOTIFY`; relay as its own deployable.

**D5. Outbox layout and format.** Chose one `outbox` table per system schema, rows already in the
published language (`Envelope`), translated at write. Also holding: domain-shaped rows translated by
the relay through the system-provided outbox reader.

**D6. Idempotency.** Chose a `processed_messages (consumer, key, answer jsonb)` table per system,
inserted first in the use case's transaction. Also holding: idempotency from each aggregate's state
alone, per use case.

**D7. Stores.** Chose one Postgres instance, one schema plus role plus pool per system. Also holding:
one database per system on the same instance.

**D8. Stock at checkout.** Chose a synchronous Tentative operation (`HoldStock`, 15 min) before the
order commits, confirmed by M2; business rule: no overselling. Also holding: place the order first,
reserve by command, cancel on refusal (choreographed or orchestrated).

**D9. Cross-system order flow.** Chose orchestration with `sales`' `Order` aggregate as process
manager toward `warehouse` and `payments`; choreography for `billing`, which only reacts to events.
Also holding: full choreography.

**D10. How refusals of commands come back.** Chose a `<Command>Refused` event published by the
receiver and subscribed by the sender; synchronous refusals as `Result` errors. Also holding: a reply
message addressed to the sender's private queue.

**D11. Dunning standing at checkout.** Chose a Replica in `sales` from M17, stale reads accepted by
rule. Also holding: a synchronous call to `billing` at checkout, named as a P15 exception.

**D12. Payment deadline.** Chose: card orders only, 30 min after placement; invoice orders are never
deadline-cancelled, their unpaid invoices go to dunning. Also holding: a 24 h card deadline; a
deadline for invoice orders counted from invoice due date, ending in cancellation of what has not shipped.

**D13. When invoices are issued.** Chose: card orders on `OrderPaid` (issued paid); invoice orders on
`OrderShipped` (open, due 14 days). Also holding: invoice orders invoiced at placement.

**D14. Gapless numbers.** Chose a `NumberSeries` aggregate per kind and year in `billing`'s domain,
saved with optimistic version in the invoice's transaction. Also holding: a counter row taken with
`SELECT ... FOR UPDATE` in the repository adapter.

**D15. Bank transfers.** Chose polling every 5 min from a stored cursor; automatic match only on invoice
number in the reference and exact open amount; the rest stays unmatched for `AssignBankTransfer` on the
ops page. Also holding: bank webhooks into a `billing` hook.

**D16. Mail.** Chose Resend with `Idempotency-Key`; one mailer port per sending system, mails sent from
private messages. Also holding: a `notifications` system taking commands from `sales` and `billing`.

**D17. Stock on hand.** Chose the 3PL as owner of physical stock, copied into `warehouse`' Replica
`stock_levels` every 15 min; available = Replica − holds and reservations not yet submitted to the 3PL.
Also holding: `warehouse` owning stock and recording goods receipts itself.

**D18. Article registration.** Chose `SyncArticle` on M1 queuing private `RegisterArticle`; shipments
wait in `waiting_for_articles` until their skus are registered; sku immutable after creation. Also
holding: registering at first `ShipOrder` for that sku.

**D19. Shop page cache.** Chose Next `unstable_cache` with tags, revalidated by `sales`' private M19
through `POST /api/revalidate`, `web` at one instance with a 600 s time fallback. Also holding: a shared
Next `cacheHandler` and several `web` instances; a CDN purge.

**D20. Processes.** Chose `web` (Next + Payload), `api` (Fastify), `worker` (handlers, schedules,
relay), `migrate` (job). Also holding: checkout and hooks as Next route handlers in `web`; one process
per system.

**D21. Cross-system synchronous calls.** Chose in-process: assembly hands `warehouse`' and
`payments`' driving ports to `sales`' driven adapters. Also holding: HTTP between per-system processes.

**D22. Courier.** Chose `globalThis.__teashopWeb`, set in `instrumentation.ts`, only in `web`; `api`
and `worker` pass everything as arguments. Also holding: an `AsyncLocalStorage` per-process container.

**D23. Concurrency control.** Chose optimistic `version` per aggregate with 3 retries, and row locks
in sku order for allocation. Also holding: `SERIALIZABLE` transactions with retry on `40001`.

**D24. Out-of-order handling.** Chose versioned Replicas, monotone states with winning terminals,
`Deferred` redelivery for missing prerequisites, dead letters for exhaustion. Also holding: pending
records held until the prerequisite arrives, no redelivery.

**D25. Upstream relationships.** Chose an anti-corruption layer toward every upstream (Payload,
Stripe, 3PL, bank, Resend and between our systems), and `kernel-money` as the only shared kernel. Also
holding: `sales` conformist to `warehouse`' published language (P1's Except then applies).

**D26. Boundary enforcement.** Chose package `exports` exposing only `./offer`, dependency-cruiser
rules, Biome restricted globals and a GritQL plugin. Also holding: ESLint `import/no-restricted-paths`
and TypeScript project references.

**D27. Versioning.** Chose `.vN` in message type names, both versions published during migration,
expand/contract migrations across two releases. Also holding: version in a header with upcasters in
handlers.

**D28. Observability.** Chose OTel `NodeSDK` with OTLP exporter to Jaeger and `PrometheusExporter`
(`preventServerStart`, served on `/metrics`), pino with an `AsyncLocalStorage` mixin and
`@opentelemetry/instrumentation-pino`, `x-request-id` header, `traceparent` and `requestId` carried in
`Envelope.trace`. Also holding: `prom-client` for metrics.

**D29. Tests.** Chose vitest; default suite on `build*ForTests` fakes; integration tests with
Testcontainers Postgres (`*.int.test.ts`); end-to-end against Stripe test mode and the 3PL sandbox
(`*.e2e.test.ts`). Also holding: a shared Docker Postgres for integration tests.

**D30. Ops dashboard.** Chose composition: ops pages call each system's answering ports. Also
holding: an `operations` system keeping Replicas of orders, invoices and shipments.

**D31. Identities.** Chose customer keyed by email in `sales`; order id = cart id (one order per cart),
UUIDv7 everywhere else. Also holding: a separate order id stored on the cart at checkout start.

**D32. Refunds.** Chose admin refund as `RefundCardPayment` (refusal answered synchronously), Stripe
call later through private M20; late payments refunded automatically by `sales` via M6. Also holding:
Stripe refund call inside the use case before commit, recording the result after (Stripe's
idempotency covering a crash).

**D33. Migrations.** Chose Drizzle per system schema, Payload's migrations, pg-boss's own, run by a
`migrate` job with role `migrator` before rollout. Also holding: migrations run by each process at
start behind an advisory lock.

**D34. Money and tax.** Chose gross prices in integer cents EUR in the shared kernel; net and VAT per
invoice line computed in `billing` from gross by category. Also holding: net prices, VAT added.

## Sentences I had to pick a reading for

**S1.** "Its configuration may hold business rules this codebase writes, in the external system's
terms; its architecture stays its own." with P2 "A business rule lives in one place: the domain".
Readings: (a) for an external system, its configuration is the one place, P2's "the domain" meaning
the owning system's home of rules; (b) P2 wins, so rules we write must sit in a domain of ours and the
external system only calls it. Took (a). Draft: no `catalog` system; price, sku and tax-class rules sit
in `packages/cms/src/collections/products.ts`, and no layer rules apply inside `packages/cms`.

**S2.** "The *outbox reader* is what the relay reads the outbox through, and marks it by; the system
provides it, and for an external system's outbox, assembly does." Readings: (a) an external system can
have an outbox (one we configure it to write) and assembly builds its reader; (b) it means our outbox
of messages bound for an external system. Took (a). Draft: Payload writes `payload.cms_outbox` in its
transaction; `worker`'s assembly calls `createCmsOutboxReader`.

**S3.** "*Except:* code of the common library reached by a service or an adapter, whose output changes
neither how a use case acts nor what it answers." Readings: (a) the relative clause restricts: only
common-library code with no effect on behaviour is exempt (logger, tracer); (b) it describes all
common-library code, which is then exempt wholesale. Took (a). Draft: `Clock` and `Ids`
implementations live in the common library but are still driven ports handed by assembly; the logger
and tracer are reached directly.

**S4.** "Two clients are one store when one transaction can carry the writes of both, two stores until
it can." Readings: (a) "can" as technically possible: one Postgres instance is one store for every
system, P16 kept by discipline; (b) "can" as granted: per-system roles make separate stores. Took (b).
Draft: roles `*_app` with privileges on their own schema only, one pool per role, `relay` limited to
outbox tables.

**S5.** "A repeated delivery changes no record of this system, and succeeds where the first did."
Readings: (a) a repeat answers exactly what the first committed call answered, refusals included;
(b) a repeat must succeed whenever the first succeeded, nothing said about refusals. Took (a), also
reading "delivery" to cover hook calls and scheduled firings. Draft: `processed_messages` stores the
answer, refusals included; hooks and scheduled tasks pass keys too.

**S6.** "nothing final follows from it before it commits" (P8). Readings: (a) a Tentative operation is
not final and may precede the commit; (b) no call to another system may precede the commit. Took (a).
Draft: `HoldStock` and `StartCardPayment` run before `sales` commits the order; refunds, mails, 3PL
orders only after.

**S7.** "A use case's writes to its own system's records land together or not at all" (P7). Readings:
(a) outbox and `processed_messages` rows are records of the system and must land with the rest;
(b) only domain records count. Took (a). Draft: outbox and `processed_messages` share the
`UnitOfWork` transaction.

**S8.** "Orchestration. One system's *process manager* holds the sequence across systems: an aggregate
whose state is where the sequence stands". Readings: (a) any aggregate whose state is the sequence,
the `Order` itself; (b) a separate aggregate dedicated to the sequence (`OrderSaga`). Took (a). Draft:
no `Checkout` or `OrderSaga` aggregate; `Order` returns `OrderDecision`s that become commands.

**S9.** "unless a business rule needs another system's answer now" (P15). Readings: (a) any
requirement of the brief counts, including "the browser needs `client_secret` in the checkout
response"; (b) only a rule of the domain counts. Took (a) for Stripe and made "no overselling" an
explicit `sales` rule for stock. Draft: card checkout calls `payments` and `warehouse` synchronously.

**S10.** "There are as many driving adapters as there are ways into the process." Readings: (a) a way
in is a transport, so one Fastify server is one driving adapter spanning systems; (b) a way in is a
transport into one system, so each system's routes on that server are its own driving adapter. Took
(b). Draft: Fastify plugins live in each system's `adapters/driving/http` or `hooks`, composed by
`apps/api/src/server.ts`.

**S11.** "*Private*: meant only for the system that wrote it." Readings: (a) a private message travels
the same outbox, relay and bus as published ones; (b) it stays inside the system, processed by a local
loop over its outbox. Took (a). Draft: private types `<system>.private.*` sent by the relay to a queue
only that system's handler consumes.

**S12.** "Offer. What a system makes public for other code: its published language, its open host
service's driving port types, its system builders and the fakes of those ports." Readings: (a) "those
ports" are the open host service's driving ports; (b) all ports the system has, driven included. Took
(a). Draft: offers export `fakeHoldStock`, `fakeStartCardPayment`; driven-port fakes stay in
`src/fakes/`, reached only through `build*ForTests`.

**S13.** "Common library. A package of no system that every system may import." Readings: (a) one
package, which also takes the plumbing (relay, bus, runner) that apps use; (b) any number of packages,
with plumbing elsewhere as code of no system. Took (a). Draft: one `@teashop/common` with subpath
exports, relay and pg-boss bus inside it.

**S14.** "Ambient value. ... per request, what the current request carries." Readings: (a) a message
delivery or scheduled firing is a request; (b) only inbound HTTP is. Took (a). Draft: the handler
runner and scheduler open a `requestContext` scope from `envelope.trace` or a new id.

**S15.** "Shared kernel. A model several systems of this codebase share as code and agree on together,
each importing it into its domain." Readings: (a) only the systems that agree import it; (b) every
system of the codebase must. Took (a). Draft: `kernel-money` in `sales`, `payments`, `billing`; not in
`warehouse`.

**S16.** "Hook. A driving adapter an external system calls." Readings: (a) only code of ours that the
external system calls into a system of ours is a hook; Payload's `afterChange` writing its own outbox is
configuration of Payload; (b) every function registered in an external system's hook slots is a hook.
Took (a). Draft: `write-product-changed.ts` sits in `packages/cms`, the stock field hook in
`warehouse`' `adapters/driving/hooks`.

**S17.** "System builder. ... it takes configuration and returns implementations." Readings: (a)
configuration may include live resources such as a `pg.Pool`; (b) only plain values, the builder opening
its own connections. Took (a). Draft: assembly creates one pool per role and passes it to builders,
and closes them at shutdown.

**S18.** "use cases fail each other only where a business rule ties them" (P10). Readings: (a) waiting
on a lock is not failing, only an aborted use case is; (b) any interference, blocking included. Took
(a). Draft: row locks for allocation and `processed_messages` key blocking are accepted; aborts happen
only on version conflicts of one aggregate.

**S19.** "A record or a message means the same to all code that reads it, whenever it was written"
(P14). Readings: (a) "all code" includes older code still running during a rolling deploy; (b) only
code current at read time. Took (a). Draft: new enum values readable a release before they are
written; contract migrations a release later.
