# Fresh repository draft B, distilled set (property rules)

Tea shop of the brief, TypeScript on Node 24, one Postgres, Payload, Stripe, a 3PL, a bank API, a mail
provider. Glossary terms as spelled; names that are not glossary terms are code names in backticks.

## Systems and what each owns

Systems of this codebase:

| System | Kind | Owns (its business rules decide these records) | Keeps (records in its store, besides what it owns) |
|---|---|---|---|
| `shop` | system of this codebase | `Cart`, `Order` (lines snapshot price, sku, tax class; payment deadline; dropped lines; refunds it decided), `Stock` (per sku: the reservations of open orders), `SentMail` (shop's mails) | replica `CatalogItem` (of `cms` products), replica `ArticleAvailability` (of `fulfilment` articles), replica `CustomerStanding` (of `billing` debtor standing), the 3PL's free-to-ship figure copied onto each `Stock` (via `fulfilment`'s event); its outbox; `claims` |
| `payment` | system of this codebase | `Payment` (one per card order: status, intent ref, refunded total, dispute), `CardRefund` | outbox; `claims` |
| `fulfilment` | system of this codebase | `Article` (article-master registration per sku), `Shipment` (one per order handed to the 3PL: lines, 3PL ref, accepted-at, shipped lines) | outbox; `claims` |
| `billing` | system of this codebase | `Invoice` (lines, VAT split, due date, payments, credited, paid back, dunning stage), `CreditNote`, `NumberSeries` (per kind and calendar year), `Transfer` (bank transfer and its allocations), `RefundRequest`, `DebtorStanding` (per email), `PendingCorrection` (lost dispute before invoicing), `SentMail` (billing's mails) | outbox; `claims` |
| `backoffice` | system of this codebase, answering use cases only | nothing | nothing |

External systems:

| External system | Run by, where | Owns | This codebase writes |
|---|---|---|---|
| `cms` (Payload 3) | us, inside the `web` process, Postgres schema `cms` | `products` (copy, images, slug, price, sku, tax class; price above zero, sku unique and fixed: its configuration's rules, in its terms), `media`, `users` (editors, operators) | its configuration `external/cms`: collections, the outbox hook, two read-only virtual fields, a revision trigger, its outbox table `cms.outbox`, its published language `@teashop/cms/published` |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | adapter and hook in `payment` |
| 3PL warehouse | vendor | free-to-ship stock, article master, warehouse orders and their shipment | adapter, hook and polling task in `fulfilment` |
| Bank | vendor | incoming transfers | adapter and polling task in `billing` |
| Postmark (mail provider) | vendor | delivery of mails | adapters in `shop` and `billing` |
| Operating system | host | clock, randomness, environment, `TZ` | `Clock` and id driven ports per system |

Shared kernel: `@teashop/kernel` (`packages/kernel`), shared by `shop`, `payment`, `billing`: `Money`
(integer euro cents, add, subtract, multiply by quantity, ratio with explicit rounding), `EmailAddress`
(trimmed, lower-cased; equality is customer identity). Values and what computes values only.

Code that is no system:

- Common library (`packages/*`): `@teashop/messaging` (envelope, outbox appender, outbox reader
  interface and Postgres implementation, relay, pg-boss bus, handler and scheduled-task types),
  `@teashop/pg` (pool, transactions by shape), `@teashop/courier`, `@teashop/telemetry`.
- Assembly: `apps/web/src/assembly`, `apps/worker/src/assembly`, and each system's system builders
  (`systems/*/src/builder`), which are assembly's part.
- Probes: `apps/web/app/api/health/route.ts`, `apps/worker/src/probe.ts`.
- Tooling: `tools/*` (message-compatibility check, migration check, bus replay, seed), `apps/migrate`
  (release-phase job, see S8), test helpers.

## Ports and adapters

Conventions shared by every system:

```ts
// every system, src/service/ports/driven.ts (Tx is opaque to the service; assembly binds it)
export interface Transactions<Tx> {
  /** opens, commits once after `work` resolves, rolls back whole if it throws */
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
export interface Claims<Tx> {
  /** INSERT (use_case, key) ON CONFLICT DO NOTHING; waits on an overlapping uncommitted claim */
  claim(tx: Tx, useCase: string, key: string): Promise<'claimed' | 'alreadyClaimed'>;
}
export interface Clock { now(): Instant }            // Instant: domain value, epoch ms, branded by zod
export interface Ids { next(): string }               // UUIDv7

// every system, src/service/ports/driving.ts
export type Delivery = { readonly key: string };      // message id or call key, claimed in the use case

// service errors (thrown, never committed as outcomes)
export class ConcurrentChange extends Error {}        // save lost to a concurrent commit (P10)
export class UpstreamUnavailable extends Error {}     // another system failed to answer (P15, P17)
```

Repository saves compare a `version` column (`UPDATE ... SET <known columns> ... WHERE id = $1 AND
version = $2`, zero rows: `ConcurrentChange`); inserts fail on the primary or unique key. Child rows
(`order_lines`, `invoice_lines`, `stock_reservations`) are upserted by id with known columns, never
deleted and reinserted.

### `shop`

Driving ports (`systems/shop/src/service/ports/driving.ts`), in `shop`'s domain terms:

```ts
import type { CartId, CartView, DeliveryAddress, Instant, OrderId, OrderSummary, OrderFilter, PaymentMethod,
  PaymentOption, ProductId, ProductView, Quantity, RefundId, Sku, Slug, CatalogRevision, MailId, CustomerMail }
  from '../../domain/index.ts';
import type { EmailAddress, Money } from '@teashop/kernel';

// storefront, answering
export type ListProducts = () => Promise<readonly ProductView[]>;
export type ProductBySlug = (slug: Slug) => Promise<ProductView | null>;
export type ViewCart = (cartId: CartId) => Promise<CartView | null>;
export type PaymentOptions = (email: EmailAddress) => Promise<readonly PaymentOption[]>;

// storefront, acting
export type SetCartLine = (input: { cartId: CartId | null; productId: ProductId; quantity: Quantity }) =>
  Promise<{ kind: 'set'; cart: CartView } | { kind: 'refused'; reason: 'notForSale' | 'cartOrdered' }>;

export type PlaceOrderInput = {
  cartId: CartId;                                  // the call's key (P9)
  email: EmailAddress;
  address: DeliveryAddress;
  paymentMethod: PaymentMethod;                    // 'card' | 'invoice'
  seenPrices: ReadonlyMap<ProductId, Money>;       // what the customer was shown
};
export type CardPaymentHandle = { kind: 'card'; clientSecret: string } | { kind: 'cardUnavailable' };
export type PlaceOrderResult =
  | { kind: 'placed'; orderId: OrderId; payment: CardPaymentHandle | { kind: 'invoice' } }
  | { kind: 'pricesChanged'; lines: readonly { productId: ProductId; seen: Money; current: Money }[] }
  | { kind: 'shortLines'; lines: readonly { productId: ProductId; requested: Quantity; available: Quantity }[] }
  | { kind: 'notForSale'; productIds: readonly ProductId[] }
  | { kind: 'invoiceNotOffered' }
  | { kind: 'cartEmpty' };
export type PlaceOrder = (input: PlaceOrderInput) => Promise<PlaceOrderResult>;
export type PayOrder = (input: { orderId: OrderId }) =>
  Promise<CardPaymentHandle | { kind: 'refused'; reason: 'notAwaitingPayment' }>;

// called for messages, acting
export type ApplyCatalogRevision = (input: CatalogRevision, d: Delivery) => Promise<void>;
export type ApplyArticleRegistered = (input: { sku: Sku }, d: Delivery) => Promise<void>;
export type ApplyStockReport = (input: { sku: Sku; freeToShip: Quantity; asOf: Instant }, d: Delivery) => Promise<void>;
export type MarkOrderPaid = (input: { orderId: OrderId; amount: Money; paidAt: Instant }, d: Delivery) => Promise<void>;
export type CancelIfUnpaid = (input: { orderId: OrderId }, d: Delivery) => Promise<void>;
export type RecordShipmentBooked = (input: { orderId: OrderId; acceptedAt: Instant; shipmentVersion: number }, d: Delivery) => Promise<void>;
export type RecordShipmentRefused = (input: { orderId: OrderId; reason: string; shipmentVersion: number }, d: Delivery) => Promise<void>;
export type RecordShipment = (input: { orderId: OrderId; shippedAt: Instant; shipped: readonly { sku: Sku; quantity: Quantity }[]; shipmentVersion: number }, d: Delivery) => Promise<void>;
export type RecordRefundOutcome = (input: { refundId: RefundId; outcome: 'refunded' | 'refused'; reason: string | null }, d: Delivery) => Promise<void>;
export type ApplyCustomerStanding = (input: { email: EmailAddress; inDunning: boolean; version: number }, d: Delivery) => Promise<void>;
export type SendCustomerMail = (input: { mailId: MailId; mail: CustomerMail }, d: Delivery) => Promise<void>;
export type FlagDelayedBooking = (input: { orderId: OrderId }, d: Delivery) => Promise<void>;

// operators, answering
export type ListOrders = (filter: OrderFilter) => Promise<readonly OrderSummary[]>;
```

Open host service (`systems/shop/src/published/ports.ts`, typed only by `shop`'s published language):

```ts
import type { AvailableStockQueryV1, AvailableStockAnswerV1, TimelineEntryV1, DelayedItemV1 } from './open-host.ts';
export type ShopOpenHost = {
  availableStock(q: AvailableStockQueryV1): Promise<AvailableStockAnswerV1>;     // called by cms's field hook
  orderTimeline(q: { orderId: string }): Promise<readonly TimelineEntryV1[]>;   // called by backoffice
  delayed(): Promise<readonly DelayedItemV1[]>;                                  // called by backoffice
};
```

Driven ports (`systems/shop/src/service/ports/driven.ts`):

```ts
export interface Carts<Tx> { load(tx: Tx, id: CartId): Promise<Cart | null>; save(tx: Tx, cart: Cart): Promise<void> }
export interface Orders<Tx> {
  load(tx: Tx, id: OrderId): Promise<Order | null>;
  findByCart(tx: Tx, cartId: CartId): Promise<Order | null>;     // unique cart_id
  save(tx: Tx, order: Order): Promise<void>;
  list(tx: Tx, filter: OrderFilter): Promise<readonly Order[]>;
}
export interface Stocks<Tx> { loadMany(tx: Tx, skus: readonly Sku[]): Promise<ReadonlyMap<Sku, Stock>>; saveMany(tx: Tx, stocks: readonly Stock[]): Promise<void> }
export interface CatalogItems<Tx> {
  load(tx: Tx, id: ProductId): Promise<CatalogItem | null>;
  loadMany(tx: Tx, ids: readonly ProductId[]): Promise<ReadonlyMap<ProductId, CatalogItem>>;
  bySlug(tx: Tx, slug: Slug): Promise<CatalogItem | null>;
  listForSale(tx: Tx): Promise<readonly CatalogItem[]>;
  save(tx: Tx, item: CatalogItem): Promise<void>;
}
export interface ArticleAvailabilities<Tx> { load(tx: Tx, sku: Sku): Promise<ArticleAvailability | null>; save(tx: Tx, a: ArticleAvailability): Promise<void> }
export interface CustomerStandings<Tx> { load(tx: Tx, email: EmailAddress): Promise<CustomerStanding | null>; save(tx: Tx, s: CustomerStanding): Promise<void> }
export interface SentMails<Tx> { record(tx: Tx, mail: SentMail): Promise<void>; forOrder(tx: Tx, id: OrderId): Promise<readonly SentMail[]> }
export interface ShopOutbox<Tx> { write(tx: Tx, message: ShopOutgoing, meta: { correlationId: string; deliverAfter: Instant | null }): Promise<void> }
// ShopOutgoing: shop's published events (OrderShippedV1, OrderCancelledV1) and shop's private messages

// asking other systems, in shop's terms (anti-corruption layer behind them)
export interface ShipmentRequests<Tx> { request(tx: Tx, order: Order): Promise<void> }                  // writes fulfilment's BookShipment to shop's outbox
export interface CardRefundRequests<Tx> { request(tx: Tx, refund: OrderRefund): Promise<void> }         // writes payment's RefundCardPayment to shop's outbox
export interface CardPayments {                                                                       // call after the commit (P8, P15)
  open(input: { orderId: OrderId; amount: Money; email: EmailAddress }):
    Promise<{ kind: 'opened'; clientSecret: string } | { kind: 'refused'; reason: 'orderCancelled' | 'alreadyPaid' | 'amountMismatch' }>;
  // throws UpstreamUnavailable
}
export interface CustomerMailer { send(mail: CustomerMail): Promise<void> }                           // no key reaches Postmark (P9)
export type { Transactions, Claims, Clock, Ids };
```

Adapters:

| Adapter | Implements / adapts | Module |
|---|---|---|
| Postgres repository adapters, `Tx = PgTx` | `Carts`, `Orders`, `Stocks`, `CatalogItems`, `ArticleAvailabilities`, `CustomerStandings`, `SentMails`, `Claims`, `ShopOutbox` | `src/adapters/driven/postgres/*.ts` (tables in schema `shop`) |
| `createBookShipmentRequests(append: EnvelopeAppender<PgTx>)` | `ShipmentRequests<PgTx>`; translates `Order` to `fulfilment.BookShipmentV1` | `src/adapters/driven/fulfilment/shipment-requests.ts` |
| `createRefundCardPaymentRequests(append)` | `CardRefundRequests<PgTx>`; translates to `payment.RefundCardPaymentV1` | `src/adapters/driven/payment/refund-requests.ts` |
| `createCardPaymentsViaPayment(open: PaymentOpenHost['openCardPayment'])` | `CardPayments`; translates to and from `payment`'s published language | `src/adapters/driven/payment/card-payments.ts` |
| `createPostmarkCustomerMailer(client: ServerClient, templates)` | `CustomerMailer`; renders React Email templates | `src/adapters/driven/postmark/customer-mailer.ts` |
| `createSystemClock()`, `createUuidV7Ids()` | `Clock`, `Ids` | `src/adapters/driven/system/*.ts` |
| Server functions `setCartLineAction`, `placeOrderAction`, `payOrderAction`; RSC loaders `listProducts`, `productBySlug`, `viewCart`, `paymentOptions` | driving adapters, Next; read `shopCourier` per call | `src/adapters/driving/next/*.ts` |
| Ops route `GET /ops/api/shop/orders` | driving adapter | `src/adapters/driving/next/ops-routes.ts` |
| `availableStockField: FieldHook` | hook, Payload `afterRead` of virtual field `availableStock`; calls `ShopOpenHost.availableStock` | `src/adapters/driving/payload/available-stock-field.ts` |
| Handlers (one per subscription, see Calls and messages) | driving adapters for the bus; parse with the writer's schema, call one driving port | `src/adapters/driving/handlers/*.ts` |
| Fakes | every driven port: `createInMemoryShopStore()` returns fake `Transactions<FakeTx>` plus all repositories, `Claims`, `ShopOutbox` sharing one copy-on-commit state with versions and unique keys; `fakeCardPayments(table)`, `fakeCustomerMailer()`, `fixedClock(at)`, `sequenceIds(prefix)` | `src/fakes/*.ts` |
| Offer fake | `fakeShopOpenHost(scenario: { levels; timeline; delayed })`, scenario in published-language terms | `src/offer/fakes.ts` |

### `payment`

Driving ports:

```ts
// called by Stripe's hook, acting, Delivery.key = Stripe event id
export type RecordIntentCreated = (input: { paymentId: PaymentId; intentRef: IntentRef }, d: Delivery) => Promise<void>;
export type ConfirmCardPayment  = (input: { paymentId: PaymentId; orderRef: OrderRef; amount: Money; succeededAt: Instant }, d: Delivery) => Promise<void>;
export type RecordDecline       = (input: { paymentId: PaymentId; declinedAt: Instant; code: string }, d: Delivery) => Promise<void>;
export type RecordDispute       = (input: { intentRef: IntentRef; disputeRef: DisputeRef; amount: Money; openedAt: Instant }, d: Delivery) => Promise<void>;
export type CloseDispute        = (input: { disputeRef: DisputeRef; outcome: 'won' | 'lost'; closedAt: Instant }, d: Delivery) => Promise<void>;
export type UpdateRefundStatus  = (input: { refundId: CardRefundId; status: 'succeeded' | 'failed'; reason: string | null }, d: Delivery) => Promise<void>;
// called for messages
export type CancelForOrder      = (input: { orderRef: OrderRef }, d: Delivery) => Promise<void>;                 // shop.OrderCancelled
export type AcceptRefundRequest = (input: { refundId: CardRefundId; orderRef: OrderRef; amount: Money }, d: Delivery) => Promise<void>; // RefundCardPayment
export type CancelIntent        = (input: { paymentId: PaymentId }, d: Delivery) => Promise<void>;              // private executor
export type ExecuteRefund       = (input: { refundId: CardRefundId }, d: Delivery) => Promise<void>;            // private executor
export type ReconcileIntent     = (input: { paymentId: PaymentId }, d: Delivery) => Promise<void>;              // private, held 1 h
```

Open host service (`systems/payment/src/published/ports.ts`):

```ts
export type PaymentOpenHost = {
  openCardPayment(input: OpenCardPaymentV1): Promise<OpenCardPaymentResultV1>;   // acting; key = orderRef; throws on Stripe outage
  paymentTimeline(q: { orderRef: string }): Promise<readonly PaymentTimelineEntryV1[]>;
  delayed(): Promise<readonly PaymentDelayedItemV1[]>;
};
// OpenCardPaymentV1 = { orderRef: string; amountCents: number; customerEmail: string }
// OpenCardPaymentResultV1 = { kind: 'opened'; clientSecret: string } | { kind: 'refused'; reason: 'orderCancelled' | 'alreadyPaid' | 'amountMismatch' }
```

Driven ports:

```ts
export interface Payments<Tx> { byOrder(tx: Tx, o: OrderRef): Promise<Payment | null>; load(tx: Tx, id: PaymentId): Promise<Payment | null>; byIntent(tx: Tx, i: IntentRef): Promise<Payment | null>; byDispute(tx: Tx, d: DisputeRef): Promise<Payment | null>; save(tx: Tx, p: Payment): Promise<void> }
export interface CardRefunds<Tx> { load(tx: Tx, id: CardRefundId): Promise<CardRefund | null>; save(tx: Tx, r: CardRefund): Promise<void> }
export interface PaymentOutbox<Tx> { write(tx: Tx, m: PaymentOutgoing, meta: { correlationId: string; deliverAfter: Instant | null }): Promise<void> }
export interface CardProcessor {                                   // Stripe behind it; payment's terms
  openIntent(p: { paymentId: PaymentId; orderRef: OrderRef; amount: Money; email: EmailAddress }, key: string): Promise<{ intentRef: IntentRef; clientSecret: string }>;
  intentState(ref: IntentRef): Promise<'open' | 'succeeded' | 'cancelled'>;
  cancelIntent(ref: IntentRef): Promise<'cancelled' | 'alreadySucceeded'>;
  refund(p: { refundId: CardRefundId; intentRef: IntentRef; amount: Money }, key: string): Promise<{ kind: 'succeeded' | 'pending' } | { kind: 'refused'; reason: 'disputed' | 'declinedByProcessor' }>;
  findRefund(refundId: CardRefundId, intentRef: IntentRef): Promise<{ kind: 'succeeded' | 'pending' | 'failed' } | null>;
  // throws UpstreamUnavailable on timeout and 5xx; a refusal is returned, never thrown
}
export type { Transactions, Claims, Clock, Ids };
```

Adapters: Postgres repository adapters (schema `payment`); `createStripeCardProcessor(stripe: Stripe)`
(`src/adapters/driven/stripe/card-processor.ts`, idempotency keys `payment:<paymentId>`,
`refund:<refundId>`, metadata `{ paymentId, orderRef, refundId }`, `findRefund` lists refunds of the
intent's charge by metadata); hook `POST /api/hooks/stripe` (`src/adapters/driving/next/stripe-hook.ts`:
verifies with `stripe.webhooks.constructEvent` through a verifier the courier carries, routes by
`event.type` to one acting driving port, answers 200 after it returns, 500 if it throws, 200 without a
call for a type it has no port for); handlers; fakes `createInMemoryPaymentStore()`,
`fakeCardProcessor(script)`; offer fake `fakePaymentOpenHost(scenario)`.

### `fulfilment`

Driving ports:

```ts
// called by the 3PL's hook and the stock poll, acting
export type RecordShipmentReport = (input: { orderRef: OrderRef; shippedAt: Instant; lines: readonly { sku: Sku; shipped: Quantity }[] }, d: Delivery) => Promise<void>;
export type RecordStockReport    = (input: { sku: Sku; freeToShip: Quantity; asOf: Instant }, d: Delivery) => Promise<void>;
// called for messages
export type NoteProductSaved       = (input: { sku: Sku; name: string }, d: Delivery) => Promise<void>;          // cms.ProductSaved
export type AcceptShipmentRequest  = (input: ShipmentRequest, d: Delivery) => Promise<void>;                      // BookShipment
export type RegisterArticle        = (input: { sku: Sku }, d: Delivery) => Promise<void>;                         // private executor
export type SubmitShipment         = (input: { orderRef: OrderRef }, d: Delivery) => Promise<void>;               // private executor
export type CheckShipmentReport    = (input: { orderRef: OrderRef }, d: Delivery) => Promise<void>;               // private, held 5 days
// operators, answering
export type ListShipments = (filter: ShipmentFilter) => Promise<readonly ShipmentSummary[]>;
```

Open host service:

```ts
export type FulfilmentOpenHost = {
  articleStatus(q: { sku: string }): Promise<ArticleStatusV1>;   // { status: 'unknown' | 'requested' | 'registered' | 'refused'; reason: string | null }
  shipmentTimeline(q: { orderRef: string }): Promise<readonly ShipmentTimelineEntryV1[]>;
  delayed(): Promise<readonly FulfilmentDelayedItemV1[]>;
};
```

Driven ports:

```ts
export interface Articles<Tx> { load(tx: Tx, sku: Sku): Promise<Article | null>; save(tx: Tx, a: Article): Promise<void> }
export interface Shipments<Tx> { load(tx: Tx, o: OrderRef): Promise<Shipment | null>; save(tx: Tx, s: Shipment): Promise<void>; list(tx: Tx, f: ShipmentFilter): Promise<readonly Shipment[]> }
export interface FulfilmentOutbox<Tx> { write(tx: Tx, m: FulfilmentOutgoing, meta: { correlationId: string; deliverAfter: Instant | null }): Promise<void> }
export interface Warehouse {                                       // the 3PL behind it; fulfilment's terms
  registerArticle(a: { sku: Sku; name: string }): Promise<{ kind: 'registered' } | { kind: 'refused'; reason: string }>; // PUT /articles/{sku}
  submit(s: Shipment): Promise<{ kind: 'accepted'; warehouseRef: string; acceptedAt: Instant } | { kind: 'refused'; reason: string }>; // reference = orderRef, unique at the 3PL
  report(o: OrderRef): Promise<{ kind: 'shipped'; shippedAt: Instant; lines: readonly { sku: Sku; shipped: Quantity }[] } | { kind: 'notYet' } | { kind: 'unknown' }>;
  stockLevels(): Promise<readonly { sku: Sku; freeToShip: Quantity; asOf: Instant }[]>;
  // throws UpstreamUnavailable on timeout and 5xx
}
export type { Transactions, Claims, Clock, Ids };
```

Adapters: Postgres (schema `fulfilment`); `createThreePlWarehouse(http: ThreePlHttp)`
(`src/adapters/driven/threepl/warehouse.ts`, `undici` client, HMAC request signing, a duplicate
reference answered by fetching the existing order); hook `POST /api/hooks/3pl`
(`src/adapters/driving/next/threepl-hook.ts`, HMAC check with `node:crypto`, routes `shipment.shipped`
to `RecordShipmentReport`, `stock.changed` to `RecordStockReport`, key = 3PL event id); scheduled task
`pollStockLevels` (02:30 Europe/Berlin, one `RecordStockReport` per item, key `<sku>@<asOf>`);
`articleStatusField: FieldHook` (`src/adapters/driving/payload/article-status-field.ts`); handlers;
fakes `createInMemoryFulfilmentStore()`, `fakeWarehouse(script)`; offer fake.

### `billing`

Driving ports:

```ts
// called for messages
export type IssueInvoice            = (input: ShippedOrder, d: Delivery) => Promise<void>;                     // shop.OrderShipped
export type RecordCardRefundOutcome = (input: { refundId: RefundId; outcome: 'refunded' | 'refused'; reason: string | null }, d: Delivery) => Promise<void>;
export type RecordLostDispute       = (input: { orderRef: OrderRef; disputeRef: string; amount: Money; closedAt: Instant }, d: Delivery) => Promise<void>;
export type AdvanceDunning          = (input: { invoiceNumber: InvoiceNumber }, d: Delivery) => Promise<void>;  // private
export type SendBillingMail         = (input: { mailId: MailId; mail: BillingMail }, d: Delivery) => Promise<void>; // private executor
// clock and bank
export type RequestDunningRun       = () => Promise<{ requested: number }>;                                     // acting: one AdvanceDunning per due invoice
export type TransferPollWindow      = () => Promise<{ since: CalendarDate }>;                                    // answering
export type ReceiveTransfer         = (input: ReportedTransfer, d: Delivery) => Promise<void>;                   // key = bank transfer id
// operators
export type AssignTransfer          = (input: { transferId: TransferId; allocations: readonly { invoiceNumber: InvoiceNumber; amount: Money }[]; operator: OperatorId }) =>
  Promise<{ kind: 'assigned' } | { kind: 'refused'; reason: 'exceedsTransfer' | 'exceedsOpenAmount' | 'alreadyAssigned' | 'unknownInvoice' }>;
export type RecordTransferPayback   = (input: { transferId: TransferId; amount: Money; operator: OperatorId; key: string }) => Promise<{ kind: 'recorded' } | { kind: 'refused'; reason: 'exceedsSurplus' }>;
export type RefundInvoice           = (input: { invoiceNumber: InvoiceNumber; lines: 'all' | readonly { sku: Sku; quantity: Quantity }[]; operator: OperatorId; key: string }) =>
  Promise<{ kind: 'creditNoteIssued'; number: CreditNoteNumber } | { kind: 'cardRefundRequested'; refundId: RefundId } | { kind: 'refused'; reason: 'exceedsInvoiced' | 'notInvoiced' }>;
export type RecordPayback           = (input: { invoiceNumber: InvoiceNumber; amount: Money; operator: OperatorId; key: string }) => Promise<{ kind: 'recorded' } | { kind: 'refused'; reason: 'exceedsCredit' }>;
export type TakeOverInvoice         = (input: { invoiceNumber: InvoiceNumber; operator: OperatorId }) => Promise<{ kind: 'takenOver' } | { kind: 'refused'; reason: 'notWithOperators' }>;
export type ListInvoices = (f: InvoiceFilter) => Promise<readonly InvoiceSummary[]>;
export type ListCreditNotes = (f: CreditNoteFilter) => Promise<readonly CreditNoteSummary[]>;
export type ListTransfers = (f: TransferFilter) => Promise<readonly TransferSummary[]>;
```

Open host service:

```ts
export type BillingOpenHost = {
  invoiceTimeline(q: { orderRef: string }): Promise<readonly BillingTimelineEntryV1[]>;
  delayed(): Promise<readonly BillingDelayedItemV1[]>;
};
```

Driven ports:

```ts
export interface Invoices<Tx> { load(tx: Tx, n: InvoiceNumber): Promise<Invoice | null>; byOrder(tx: Tx, o: OrderRef): Promise<Invoice | null>; dueForDunning(tx: Tx, today: CalendarDate): Promise<readonly InvoiceNumber[]>; lastTransferDate(tx: Tx): Promise<CalendarDate | null>; save(tx: Tx, i: Invoice): Promise<void>; list(tx: Tx, f: InvoiceFilter): Promise<readonly Invoice[]> }
export interface CreditNotes<Tx> { save(tx: Tx, c: CreditNote): Promise<void>; byInvoice(tx: Tx, n: InvoiceNumber): Promise<readonly CreditNote[]> }
export interface NumberSeriesRepo<Tx> { load(tx: Tx, kind: 'invoice' | 'creditNote', year: number): Promise<NumberSeries>; save(tx: Tx, s: NumberSeries): Promise<void> }
export interface Transfers<Tx> { load(tx: Tx, id: TransferId): Promise<Transfer | null>; save(tx: Tx, t: Transfer): Promise<void>; latestBookingDate(tx: Tx): Promise<CalendarDate | null> }
export interface RefundRequests<Tx> { load(tx: Tx, id: RefundId): Promise<RefundRequest | null>; save(tx: Tx, r: RefundRequest): Promise<void> }
export interface DebtorStandings<Tx> { load(tx: Tx, e: EmailAddress): Promise<DebtorStanding>; save(tx: Tx, s: DebtorStanding): Promise<void> }
export interface PendingCorrections<Tx> { byOrder(tx: Tx, o: OrderRef): Promise<readonly PendingCorrection[]>; save(tx: Tx, c: PendingCorrection): Promise<void> }
export interface SentMails<Tx> { record(tx: Tx, m: SentMail): Promise<void> }
export interface BillingOutbox<Tx> { write(tx: Tx, m: BillingOutgoing, meta: { correlationId: string; deliverAfter: Instant | null }): Promise<void> }
export interface CardRefundRequests<Tx> { request(tx: Tx, r: RefundRequest): Promise<void> }   // writes payment's RefundCardPayment
export interface BankStatements { since(d: CalendarDate): Promise<readonly ReportedTransfer[]> }  // throws UpstreamUnavailable
export interface BillingMailer { send(mail: BillingMail, attachment: BillingDocument): Promise<void> }
export interface DocumentRenderer { render(doc: BillingDocument): Promise<Uint8Array> }        // PDF of Invoice, CreditNote, Reminder
export type { Transactions, Claims, Clock, Ids };
```

Adapters: Postgres (schema `billing`); `createRefundCardPaymentRequests(append)`;
`createBankStatements(http)` (`src/adapters/driven/bank/statements.ts`); `createPostmarkBillingMailer`;
`createReactPdfRenderer()` (`@react-pdf/renderer`); scheduled tasks `pollBank` (every 10 min:
`TransferPollWindow`, then `BankStatements.since`, then one `ReceiveTransfer` per item) and
`dunningRun` (00:05 Europe/Berlin: `RequestDunningRun`); ops routes under `/ops/api/billing/*`
(operator id from the Payload session, as an argument); handlers; fakes; offer fake.

### `backoffice`

```ts
// driving
export type FollowCheckout = (input: { orderId: string }) => Promise<CheckoutTrail>;   // sections: shop, payment, fulfilment, billing; each { kind: 'entries'; entries } | { kind: 'unavailable' }
export type ListDelayed = () => Promise<readonly DelayedWork[]>;
// driven, one per upstream, backoffice's terms
export interface TrailSource { entries(orderId: string): Promise<readonly TrailEntry[]>; delayed(): Promise<readonly DelayedWork[]> } // throws UpstreamUnavailable
export type TrailSources = { shop: TrailSource; payment: TrailSource; fulfilment: TrailSource; billing: TrailSource };
```

Adapters: `createShopTrailSource(host: ShopOpenHost)`, `createPaymentTrailSource(host)`,
`createFulfilmentTrailSource(host)`, `createBillingTrailSource(host)` (each parses with its upstream's
published language and translates to `TrailEntry`); ops routes `GET /ops/api/checkouts/[orderId]`,
`GET /ops/api/delayed`; fake `fakeTrailSource(entries)`.

### Common library interfaces (`@teashop/messaging`)

```ts
export type Envelope = {
  id: string; type: string; version: number; occurredAt: string;
  correlationId: string | null; deliverAfter: string | null;
  payload: unknown;                       // parsed only with the schema for (type, version)
  trace: Readonly<Record<string, string>>; // W3C trace context, telemetry
};
export interface EnvelopeAppender<Tx> { append(tx: Tx, e: Envelope): Promise<void> }
export interface OutboxReader { readonly name: string; unrelayed(limit: number): Promise<readonly Envelope[]>; markRelayed(ids: readonly string[]): Promise<void>; oldestUnrelayedAgeSeconds(): Promise<number | null> }
export interface Handler { readonly name: string; readonly subscribesTo: { readonly type: string; readonly version: number }; handle(e: Envelope): Promise<void> }
export interface ScheduledTask { readonly name: string; readonly cron: string; readonly tz: 'Europe/Berlin'; run(): Promise<void> }
export interface Bus { publish(e: Envelope): Promise<void>; start(): Promise<void>; stop(): Promise<void> }
export function createPgOutboxAppender(table: OutboxTable): EnvelopeAppender<PgTx>;
export function createPgOutboxReader(pool: Pool, table: OutboxTable, role: string): OutboxReader;
export function createPgBossBus(input: { boss: PgBoss; handlers: readonly Handler[] }): Bus;
export function createRelay(input: { readers: readonly OutboxReader[]; bus: Bus; intervalMs: number }): { start(): void; stop(): Promise<void> };
// @teashop/pg
export type PgTx = NodePgTransaction<Record<string, never>>;   // drizzle-orm/node-postgres transaction type
export function createPgTransactions(pool: Pool, role: string): { run<T>(work: (tx: PgTx) => Promise<T>): Promise<T> }; // matches Transactions<PgTx> by shape; SET LOCAL ROLE <role> first
// @teashop/courier
export function createCourier<T>(key: string): { fill(value: T): void; read(): T };  // value on globalThis[Symbol.for(key)]; read() throws when unfilled
```

## Calls and messages

Synchronous calls (all calls between systems of this codebase are in-process function calls; none
carries a transaction):

| Caller | Callee | When | Refusal comes back as | Failure comes back as |
|---|---|---|---|---|
| `shop` `PlaceOrder` / `PayOrder` service, through `CardPayments` | `payment` `openCardPayment` | after `shop` commits the order (card) | `{ kind: 'refused', reason }` in `payment`'s published language, translated to `shop`'s; `PlaceOrder` still returns `placed`, `PayOrder` returns `refused` | `UpstreamUnavailable`: `placed` with `cardUnavailable`; browser offers retry through `PayOrder` |
| `payment` `openCardPayment` service, through `CardProcessor` | Stripe `POST /v1/payment_intents`, key `payment:<paymentId>` | after `payment` commits the `Payment` | Stripe error mapped to refused | thrown; `shop` gets `UpstreamUnavailable` |
| `cms` field hook (`availableStockField`) | `shop` `availableStock` | Payload admin reads a product | none (answering) | field shows "unavailable" |
| `cms` field hook (`articleStatusField`) | `fulfilment` `articleStatus` | Payload admin reads a product | none | field shows "unavailable" |
| `backoffice` `FollowCheckout` / `ListDelayed` | each system's `*Timeline` / `delayed` | operator opens a checkout | none | section `unavailable`, rest answered |
| Stripe | `payment` hook | Stripe event | committed refusal: 200 | 500, Stripe resends |
| 3PL | `fulfilment` hook | 3PL event | committed refusal: 200 | 500, 3PL resends |
| `payment` executors | Stripe cancel, refund, retrieve | handling private messages | returned refusal committed as outcome | thrown, bus retries |
| `fulfilment` executors, reconciliation, poll | 3PL `PUT /articles/{sku}`, `POST /orders`, `GET /orders/{ref}`, `GET /stock` | handling private messages, clock | returned refusal committed as outcome | thrown, bus retries / next run |
| `billing` poll | bank `GET /transfers?since=` | every 10 min | none | thrown, next run covers the window |
| `shop` / `billing` mail executors | Postmark `POST /email` | handling private messages | n/a | thrown, bus retries |

Messages. Bus: pg-boss, one queue per handler, routed by `(type, version)`. All handlers run in the
`worker` process. Outbox column `deliver_after` holds a message back (pg-boss `startAfter`).

| Message | Kind | Written by (outbox) | Subscribed by (handler, driving port) | Refusal |
|---|---|---|---|---|
| `cms.ProductSaved` v1 | event, published | `cms` (Payload `afterChange`, in Payload's transaction, `cms.outbox`) | `shop.onProductSaved` (`ApplyCatalogRevision`); `fulfilment.onProductSaved` (`NoteProductSaved`) | events are not refused |
| `fulfilment.ArticleRegistered` v1 | event, published | `fulfilment` `RegisterArticle` | `shop.onArticleRegistered` | |
| `fulfilment.StockReported` v1 | event, published | `fulfilment` `RecordStockReport` | `shop.onStockReported` (`ApplyStockReport`) | |
| `fulfilment.BookShipment` v1 | command, `fulfilment`'s published language | `shop` (`PlaceOrder` invoice; `MarkOrderPaid` card), via `ShipmentRequests` | `fulfilment.onBookShipment` (`AcceptShipmentRequest`) | `fulfilment.ShipmentRefused` |
| `fulfilment.ShipmentBooked` v1 | event | `fulfilment` `SubmitShipment` | `shop.onShipmentBooked` (`RecordShipmentBooked`) | |
| `fulfilment.ShipmentRefused` v1 | event | `fulfilment` `SubmitShipment` (3PL refused) | `shop.onShipmentRefused` (`RecordShipmentRefused`) | |
| `fulfilment.ShipmentShipped` v1 | event | `fulfilment` `RecordShipmentReport` | `shop.onShipmentShipped` (`RecordShipment`) | |
| `payment.CardPaymentSucceeded` v1 | event | `payment` `ConfirmCardPayment`, `ReconcileIntent` | `shop.onCardPaymentSucceeded` (`MarkOrderPaid`) | |
| `shop.OrderCancelled` v1 | event | `shop` `CancelIfUnpaid`, `RecordShipment` (nothing shipped), `RecordShipmentRefused` | `payment.onOrderCancelled` (`CancelForOrder`) | |
| `shop.OrderShipped` v1 | event | `shop` `RecordShipment` (something shipped) | `billing.onOrderShipped` (`IssueInvoice`) | |
| `payment.RefundCardPayment` v1 | command, `payment`'s published language | `shop` (late payment, dropped lines, nothing shipped, refused shipment); `billing` (`RefundInvoice` on card orders) | `payment.onRefundCardPayment` (`AcceptRefundRequest`) | `payment.CardRefundRefused` |
| `payment.CardRefunded` v1 | event, names no sender | `payment` `ExecuteRefund`, `UpdateRefundStatus` | `shop.onCardRefunded`, `billing.onCardRefunded` (each acts only on a `refundId` it holds) | |
| `payment.CardRefundRefused` v1 | event, names no sender | `payment` `AcceptRefundRequest`, `ExecuteRefund`, `UpdateRefundStatus` | `shop.onCardRefundRefused`, `billing.onCardRefundRefused` | |
| `payment.DisputeLost` v1 | event | `payment` `CloseDispute` | `billing.onDisputeLost` (`RecordLostDispute`) | |
| `billing.DebtorStandingChanged` v1 | event | `billing` (`AdvanceDunning`, `ReceiveTransfer`, `AssignTransfer`, credit notes) | `shop.onDebtorStandingChanged` (`ApplyCustomerStanding`) | |
| `shop.PaymentDeadlineDue` | private, held until `payBy` | `shop` `PlaceOrder` (card) | `shop.onPaymentDeadlineDue` (`CancelIfUnpaid`) | |
| `shop.BookingOverdue` | private, held 2 h | `shop` `PlaceOrder` (invoice), `MarkOrderPaid` | `shop.onBookingOverdue` (`FlagDelayedBooking`) | |
| `shop.SendCustomerMail` | private, carries the mail's content | `shop` (confirmation, cancellation, dropped lines, refund) | `shop.onSendCustomerMail` (`SendCustomerMail`) | |
| `payment.CancelIntent`, `payment.ExecuteRefund` | private | `payment` | `payment` executors | |
| `payment.ReconcileIntent` | private, held 1 h | `payment` `openCardPayment` | `payment.onReconcileIntent` | |
| `fulfilment.RegisterArticle`, `fulfilment.SubmitShipment` | private | `fulfilment` | `fulfilment` executors | |
| `fulfilment.CheckShipmentReport` | private, held 5 days | `fulfilment` `SubmitShipment` (accepted), itself | `fulfilment.onCheckShipmentReport` | |
| `billing.AdvanceDunning` | private | `billing` `RequestDunningRun` | `billing.onAdvanceDunning` | |
| `billing.SendBillingMail` | private | `billing` (invoice, credit note, reminder) | `billing.onSendBillingMail` | |

Cross-system work: `shop` orchestrates its order's steps with `payment` and `fulfilment` by commands
and a call; `billing` joins by choreography on `OrderShipped` and `payment`'s events. The card order
is a saga: placed (stock reserved), paid, booked, shipped; undone by cancellation, stock release and
refunds.

How a refusal comes back, in general: in-process call: a returned union of the callee's published
language; command: committed by the receiver as the step's outcome and published as an event that
names no sender; hook: the committed refusal answers 200; server function and ops route: a returned
union rendered as JSON. A failure is thrown, never committed, and is retried by its caller, the bus
or the external system.

## Processes

Deployables, built from one container image (Node 24, pnpm workspace):

| Process | Command | Instances | Entry point | Runs |
|---|---|---|---|---|
| `web` | `next start` (`apps/web`) | 2 or more, rolling | `apps/web/instrumentation.ts` `register()` calls `assembleWeb(loadWebConfig())` | storefront server functions, Payload admin and API, Stripe and 3PL hooks, ops routes, `/api/health` probe |
| `worker` | `node apps/worker/src/main.ts` (Node 24 type stripping, `erasableSyntaxOnly`) | 1 or 2 | `main.ts` calls `assembleWorker(loadWorkerConfig())` | relay (every 1 s), bus handlers, scheduled tasks, `/probe` on port 9464 |
| `migrate` | `node apps/migrate/src/main.ts` | one-shot release job, before rollout | `main.ts` | roles and grants, `payload migrate` for `cms`, each system's SQL migrations, pg-boss schema |

Assembly, `web`:

```ts
// apps/web/src/assembly/web.ts
export function assembleWeb(config: WebConfig): void {
  const pool = createPool(config.database);                         // held once per process
  startTelemetry(config.telemetry);                                 // OTel SDK registration
  const payment = buildPaymentForWeb(config.payment, { pool });     // fills paymentCourier (hook ports, verifier)
  const fulfilment = buildFulfilmentForWeb(config.fulfilment, { pool });
  const billing = buildBillingForWeb(config.billing, { pool });
  const shop = buildShopForWeb(config.shop, { pool }, { openCardPayment: payment.openHost.openCardPayment });
  buildBackofficeForWeb({ shop: shop.openHost, payment: payment.openHost, fulfilment: fulfilment.openHost, billing: billing.openHost });
}
```

Assembly, `worker`:

```ts
// apps/worker/src/assembly/worker.ts
export async function assembleWorker(config: WorkerConfig): Promise<{ stop(): Promise<void> }> {
  const pool = createPool(config.database);
  startTelemetry(config.telemetry);
  const boss = createBoss({ pool, schema: 'bus', migrate: false });  // pg-boss on our pool via executeSql
  const payment = buildPaymentForWorker(config.payment, { pool });
  const fulfilment = buildFulfilmentForWorker(config.fulfilment, { pool });
  const billing = buildBillingForWorker(config.billing, { pool });
  const shop = buildShopForWorker(config.shop, { pool }, { openCardPayment: payment.openHost.openCardPayment });
  const cmsReader = createCmsOutboxReader(pool);                    // assembly provides the external system's outbox reader
  const readers = [shop.outboxReader, payment.outboxReader, fulfilment.outboxReader, billing.outboxReader, cmsReader];
  const bus = createPgBossBus({ boss, handlers: [...shop.handlers, ...payment.handlers, ...fulfilment.handlers, ...billing.handlers] });
  const relay = createRelay({ readers, bus, intervalMs: 1000 });
  await bus.start();
  relay.start();
  await scheduleTasks(boss, [...billing.scheduledTasks, ...fulfilment.scheduledTasks]);
  const probe = startProbe({ readers, boss, port: config.probePort });
  return { stop: async () => { await relay.stop(); await bus.stop(); await probe.close(); await pool.end(); } };
}
```

System builders (each system's `src/builder/index.ts`, exported as `@teashop/<system>/builder`):

```ts
export function buildShopForWeb(config: ShopConfig, held: { pool: Pool }, upstream: { openCardPayment: PaymentOpenHost['openCardPayment'] }): { openHost: ShopOpenHost };
export function buildShopForWorker(config: ShopConfig, held: { pool: Pool }, upstream: { openCardPayment: PaymentOpenHost['openCardPayment'] }): { openHost: ShopOpenHost; handlers: readonly Handler[]; outboxReader: OutboxReader };
// ShopConfig = { postmark: { serverToken: string; messageStream: string } }  (no business values)
```

A builder makes `Transactions` with `createPgTransactions(pool, 'shop_rw')`, the repository adapters,
the Postmark client from its configuration, the services by their factories
(`createPlaceOrder<PgTx>(deps): PlaceOrder`), and in `ForWeb` fills `shopCourier` with
`{ storefront, ops, openHost }`. It returns the open host service and, for the worker, handlers and the
outbox reader; never a repository.

Configuration: `apps/web/src/config.ts` and `apps/worker/src/config.ts` parse `process.env` once with
zod into `WebConfig` / `WorkerConfig` (database URL, pool size, Stripe secret and webhook secret, 3PL
base URL and keys, bank URL and token, Postmark token, OTel endpoint). `external/cms/src/payload.config.ts`
reads its own `DATABASE_URI_CMS` and `PAYLOAD_SECRET` (the external system's configuration).

Store layout: one Postgres database; schemas `shop`, `payment`, `fulfilment`, `billing`, `cms`, `bus`.
Login role `app` is a member of `shop_rw`, `payment_rw`, `fulfilment_rw`, `billing_rw`, `bus_rw`; each
system transaction starts with `SET LOCAL ROLE <system>_rw`, which has privileges on its own schema
only. Payload connects as `cms_rw` (privileges on `cms` only).

Migrations: `apps/migrate` runs, in order: `infra/sql/roles.sql` (idempotent roles and grants);
`payload migrate` with `external/cms/migrations` (includes `cms.outbox` and the `products.revision`
trigger); for each system, drizzle-orm's migrator over `systems/<s>/migrations/*.sql` as
`<system>_owner`, migrations table `<s>.__migrations`; `new PgBoss({ schema: 'bus' }).start()` with
`migrate: true`. Migration SQL is generated by `drizzle-kit generate` from the adapters' table
definitions, then hand-edited, and is the only source of the deployed schema (constraints included).
A release only expands (new tables, nullable columns, new indexes); contracting SQL (`DROP`, `RENAME`,
`SET NOT NULL`, type change) carries `-- contract` and is accepted by `tools/check-migrations` only
when the release before shipped code that no longer reads or writes it.

## Directory tree

```
teashop/
├── package.json                      # pnpm workspace root; scripts: lint, typecheck, test, test:int, test:e2e
├── pnpm-workspace.yaml               # apps/*, systems/*, external/*, packages/*, tools/*
├── tsconfig.base.json                # strict, erasableSyntaxOnly, verbatimModuleSyntax
├── biome.json                        # lint + format; overrides per layer (see P1, P5)
├── biome-plugins/
│   ├── no-module-instances.grit      # no top-level `new Pool|Stripe|ServerClient|PgBoss` in systems/**
│   └── namespace-import-upstream.grit# other systems' offers imported as namespaces only (P19)
├── .dependency-cruiser.cjs           # reach rules (P1, P5, P11, P12, P13, P16)
├── vitest.workspace.ts
├── infra/sql/roles.sql
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts            # withPayload; transpilePackages: @teashop/*
│   │   ├── instrumentation.ts        # register(): assembleWeb(loadWebConfig())
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   └── assembly/web.ts
│   │   └── app/
│   │       ├── (shop)/               # storefront pages (UI, out of scope) importing shop's server functions
│   │       │   ├── page.tsx
│   │       │   ├── products/[slug]/page.tsx
│   │       │   ├── cart/page.tsx
│   │       │   └── checkout/page.tsx
│   │       ├── (payload)/            # Payload's generated admin and REST/GraphQL routes
│   │       │   ├── admin/[[...segments]]/page.tsx
│   │       │   └── api/[...slug]/route.ts
│   │       ├── api/
│   │       │   ├── hooks/stripe/route.ts     # export { POST } from '@teashop/payment/driving/next'
│   │       │   ├── hooks/3pl/route.ts        # export { POST } from '@teashop/fulfilment/driving/next'
│   │       │   └── health/route.ts           # probe
│   │       └── ops/api/
│   │           ├── shop/orders/route.ts
│   │           ├── fulfilment/shipments/route.ts
│   │           ├── billing/invoices/route.ts
│   │           ├── billing/credit-notes/route.ts
│   │           ├── billing/transfers/route.ts
│   │           ├── billing/transfers/[id]/assign/route.ts
│   │           ├── billing/transfers/[id]/payback/route.ts
│   │           ├── billing/invoices/[number]/refund/route.ts
│   │           ├── billing/invoices/[number]/payback/route.ts
│   │           ├── billing/invoices/[number]/take-over/route.ts
│   │           ├── checkouts/[orderId]/route.ts   # backoffice
│   │           └── delayed/route.ts               # backoffice
│   ├── worker/
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── config.ts
│   │       ├── probe.ts              # relay lag per reader, queue backlog and dead letters, last scheduled-task runs
│   │       └── assembly/
│   │           ├── worker.ts
│   │           ├── boss.ts
│   │           └── cms-outbox-reader.ts
│   └── migrate/
│       └── src/main.ts
├── external/
│   └── cms/
│       ├── package.json              # exports: ./config, ./published
│       ├── src/
│       │   ├── payload.config.ts
│       │   ├── payload-types.ts      # generated by `payload generate:types`
│       │   ├── collections/products.ts   # price min 1 (cents), sku unique + update access false, delete access false, virtual fields availableStock, warehouseStatus
│       │   ├── collections/media.ts
│       │   ├── collections/users.ts      # roles: editor, operator
│       │   ├── hooks/write-outbox.ts     # afterChange: insert ProductSaved into cms.outbox in req's transaction
│       │   └── published/
│       │       ├── index.ts
│       │       └── product-saved.ts      # CmsProductSavedV1 zod schema
│       └── migrations/
│           ├── 20261101_000000_initial.ts
│           └── 20261101_000100_outbox_and_revision.ts   # cms.outbox; BEFORE UPDATE trigger raising products.revision
├── packages/
│   ├── kernel/
│   │   ├── package.json              # @teashop/kernel
│   │   ├── src/{index,money,email-address}.ts
│   │   └── test/{money,email-address}.test.ts
│   ├── messaging/
│   │   ├── src/{index,envelope,handler,scheduled-task,pg-outbox-appender,pg-outbox-reader,relay,pgboss-bus}.ts
│   │   └── test/...
│   ├── pg/src/{index,pool,transactions}.ts
│   ├── courier/src/index.ts
│   └── telemetry/src/{index,start,logger}.ts   # OTel API re-export, SDK start, pino to stdout
├── systems/
│   ├── shop/
│   │   ├── package.json              # exports: ./published ./ports ./fakes ./builder ./driving/next ./driving/payload
│   │   ├── GLOSSARY.md
│   │   ├── migrations/
│   │   │   ├── 0001_init.sql         # carts, orders, order_lines, stocks, stock_reservations, catalog_items, article_availabilities, customer_standings, sent_mails, claims, outbox
│   │   │   └── meta/_journal.json
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ids.ts                # CartId, OrderId, ProductId, RefundId, MailId, Sku, Slug (zod .brand())
│   │   │   │   ├── time.ts               # Instant, add minutes
│   │   │   │   ├── delivery-address.ts   # German address schema
│   │   │   │   ├── catalog-item.ts       # replica; applyRevision (keeps higher)
│   │   │   │   ├── cart.ts
│   │   │   │   ├── stock.ts              # Stock, Reservation, available(), reserve, release, markPassed, applyReport
│   │   │   │   ├── order.ts              # Order; PAYMENT_DEADLINE_MINUTES = 30; BOOKING_ALERT_MINUTES = 120
│   │   │   │   ├── checkout.ts           # decideCheckout(cart, items, stocks, standing, input, now)
│   │   │   │   ├── payment-options.ts    # invoice not offered in dunning; stale standing accepted
│   │   │   │   ├── shipment-outcome.ts   # drop unshipped, refund dropped (card), cancel if nothing
│   │   │   │   ├── late-payment.ts       # paid after cancel: refund in full
│   │   │   │   ├── customer-mail.ts      # which mail, when; SHOP_MAIL_SENDER
│   │   │   │   └── repeats.ts            # customerMail repeat accepted
│   │   │   ├── published/
│   │   │   │   ├── index.ts
│   │   │   │   ├── events.ts             # OrderShippedV1, OrderCancelledV1
│   │   │   │   ├── open-host.ts          # AvailableStockQueryV1, AvailableStockAnswerV1, TimelineEntryV1, DelayedItemV1
│   │   │   │   ├── ports.ts              # ShopOpenHost
│   │   │   │   └── __snapshots__/        # JSON Schema snapshots for tools/check-message-compat
│   │   │   ├── messages/private.ts       # PaymentDeadlineDue, BookingOverdue, SendCustomerMail schemas
│   │   │   ├── service/
│   │   │   │   ├── ports/{driving,driven}.ts
│   │   │   │   ├── errors.ts
│   │   │   │   ├── translate.ts          # domain <-> shop's published language
│   │   │   │   ├── storefront/{list-products,product-by-slug,view-cart,payment-options,set-cart-line,place-order,pay-order}.ts
│   │   │   │   ├── handling/{apply-catalog-revision,apply-article-registered,apply-stock-report,mark-order-paid,cancel-if-unpaid,record-shipment-booked,record-shipment-refused,record-shipment,record-refund-outcome,apply-customer-standing,send-customer-mail,flag-delayed-booking}.ts
│   │   │   │   ├── open-host/{available-stock,order-timeline,delayed}.ts
│   │   │   │   └── ops/list-orders.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/postgres/{tables,carts,orders,stocks,catalog-items,article-availabilities,customer-standings,sent-mails,claims,outbox}.ts
│   │   │   │   ├── driven/fulfilment/shipment-requests.ts
│   │   │   │   ├── driven/payment/{card-payments,refund-requests}.ts
│   │   │   │   ├── driven/postmark/{customer-mailer,templates}.tsx
│   │   │   │   ├── driven/system/{clock,ids}.ts
│   │   │   │   ├── driving/next/{index,courier,storefront-actions,storefront-loaders,ops-routes}.ts
│   │   │   │   ├── driving/payload/{index,available-stock-field}.ts
│   │   │   │   └── driving/handlers/{index,on-product-saved,on-article-registered,on-stock-reported,on-card-payment-succeeded,on-payment-deadline-due,on-booking-overdue,on-shipment-booked,on-shipment-refused,on-shipment-shipped,on-card-refunded,on-card-refund-refused,on-debtor-standing-changed,on-send-customer-mail}.ts
│   │   │   ├── fakes/{index,in-memory-store,card-payments,customer-mailer,clock,ids}.ts
│   │   │   ├── offer/fakes.ts
│   │   │   └── builder/{index,web,worker,outbox-reader}.ts
│   │   └── test/                         # mirrors src
│   │       ├── domain/{checkout,stock,order,shipment-outcome,late-payment,payment-options,catalog-item}.test.ts
│   │       ├── service/storefront/place-order.test.ts      # on fakes
│   │       ├── service/handling/*.test.ts
│   │       ├── service/ports/{orders,stocks,carts,claims,outbox,card-payments,customer-mailer}.port-suite.ts
│   │       ├── adapters/driven/postgres/{orders,stocks,carts,claims,outbox}.int.test.ts   # suite on Postgres
│   │       ├── adapters/driven/payment/card-payments.test.ts     # suite on payment's offer fake
│   │       ├── adapters/driven/payment/card-payments.e2e.test.ts # suite on payment's service + Stripe test mode
│   │       └── fakes/{in-memory-store,card-payments}.test.ts      # suite on the fakes
│   ├── payment/        # same shape: domain/{payment,card-refund,dispute,repeats}.ts, published/{events,commands,open-host,ports}.ts, adapters/driven/stripe/card-processor.ts, adapters/driving/next/stripe-hook.ts, ...
│   ├── fulfilment/     # same shape: domain/{article,shipment,stock-report}.ts, published/{events,commands,open-host,ports}.ts, adapters/driven/threepl/warehouse.ts, adapters/driving/next/threepl-hook.ts, adapters/driving/scheduled/poll-stock-levels.ts, adapters/driving/payload/article-status-field.ts, ...
│   ├── billing/        # same shape: domain/{invoice,vat,credit-note,number-series,transfer,matching,dunning,debtor-standing,refund-request,pending-correction,calendar,repeats}.ts, published/{events,open-host,ports}.ts, adapters/driven/{bank,postmark,pdf}/..., adapters/driving/scheduled/{poll-bank,dunning-run}.ts, adapters/driving/next/ops-routes.ts, ...
│   └── backoffice/     # domain/{trail,delayed-work}.ts, service/{follow-checkout,list-delayed}.ts, adapters/driven/{shop,payment,fulfilment,billing}-trail-source.ts, adapters/driving/next/ops-routes.ts, builder/web.ts
└── tools/
    ├── check-message-compat/src/main.ts  # compares published/__snapshots__ and messages with main
    ├── check-migrations/src/main.ts
    ├── bus-replay/src/main.ts            # moves dead letters back to their queue
    └── seed/src/main.ts                  # builds systems through their builders
```

## How each property holds

**P1.** Each system's `src/domain/**` may reach only its own `domain`, `@teashop/kernel` and `zod`;
`.dependency-cruiser.cjs` rule `domain-closed-list` (with `tsPreCompilationDeps: true`, so `import
type` counts, and `reachable` checks, so what a listed module reaches counts) refuses anything else,
including the system's own `published`, `service`, `adapters`, other systems and `@teashop/*` common
library. `@teashop/kernel` is held by the same list (kernel and `zod` only). Biome overrides for
`systems/*/src/domain/**` and `packages/kernel/**` set `noRestrictedGlobals` (`process`, `Buffer`,
`window`, `document`, `setTimeout`, `crypto`) and `noRestrictedSyntax` on `Date.now()`, argument-less
`new Date()` and `Math.random()`; time and ids arrive as arguments. Calendar dates use `Intl.DateTimeFormat`
with `'Europe/Berlin'`, present on every runtime. No system conforms, so the exception is unused; the
domain is typed by none of Payload's, Stripe's or the 3PL's types. The storefront renders the address
form from `shop/src/domain/delivery-address.ts` in the browser.

**P2.** Every business rule of the brief sits once in its owner's domain: payment deadline and late
refund (`shop/domain/order.ts`, `late-payment.ts`), stock availability and reservations
(`shop/domain/stock.ts`), price confirmation and short lines (`shop/domain/checkout.ts`), invoice not
offered in dunning (`shop/domain/payment-options.ts`), line dropping and cancellation
(`shop/domain/shipment-outcome.ts`), which mail when (`shop/domain/customer-mail.ts`,
`billing/domain/*`), VAT rates 7 and 19 and net/VAT/gross split (`billing/domain/vat.ts`), due date
14 days, gapless series, open amount, transfer matching, dunning 7/14/14/14 days and debtor standing
(`billing/domain/*`), refund refusal on dispute (`payment/domain/card-refund.ts`), shipment report
check after 5 days (`fulfilment/domain/shipment.ts`). Each rule's numbers are constants in that
module, never configuration values. Records' shapes are zod schemas in the domain; repository
adapters parse rows with them and types are inferred (`z.infer`), never declared beside them. Driving
adapters parse with the domain's schemas and call no validator of their own. No trigger or check
constraint decides anything; the only store-enforced conditions are keys (`orders.cart_id`,
`claims (use_case, key)`, `payments.order_ref`, `invoices.number`, `transfers.bank_id`) and the
`cms.products.revision` trigger, which only raises a version. Tests call domain functions directly
and use no double of a domain module. Product rules (price above zero, sku unique and fixed) are the
configuration of `cms`, the products' owner, in its terms; no system of this codebase states them
again: `shop`'s replica takes the price as parsed by `cms`'s published schema.

**P3.** Rules sit with the record they decide: `Order` and `Stock` in `shop`, `Payment` and
`CardRefund` in `payment`, `Shipment` and `Article` in `fulfilment`, invoices, credit notes, transfers
and debtor standing in `billing`. `shop` asks `fulfilment` with `BookShipment`, which carries what
`shop` decided about its own order (lines, recipient), and no deadline or rule of `fulfilment`'s. The
refund amount for dropped lines is `shop`'s rule about `shop`'s order; whether a refund is allowed on
a disputed charge is `payment`'s about its `Payment`. `@teashop/kernel` holds `Money` and
`EmailAddress` only: no record's schema, no rule about a record; `dependency-cruiser` keeps
`packages/kernel` free of every system. Common-library packages hold no zod schema of a system and no
aggregate; the envelope's `payload` is `unknown`.

**P4.** Every way in calls one driving port; services decide only from their arguments and their
driven ports' answers. Server functions parse form data with the domain's schemas and make exactly one
acting call (`setCartLine`, `placeOrder`, `payOrder`); the price confirmation travels as the
argument `seenPrices`; the card payment call is inside `placeOrder`'s service, not the server
function. Each handler makes one acting call per message; each hook one per event; the bank poll and
the stock poll make an answering call and then one acting call per polled item; `dunningRun` makes
one acting call that writes one message per invoice. The operator id reaches billing's acting ports as
an argument, taken from the Payload session by the ops route. No service or adapter reads
`AsyncLocalStorage`, `process.env` or `TZ`: Biome `noProcessEnv` is on everywhere but
`apps/*/src/config.ts` and `external/cms/src/payload.config.ts`; time comes through `Clock`; the
calendar zone is a domain constant. Driving adapters withhold a call only where they cannot translate
(unparseable input, unknown event type, unverified signature); every check the domain makes is made by
the acting service in its transaction.

**P5.** Services reach `Transactions`, repositories, outbox port, `CardPayments`, `CardProcessor`,
`Warehouse`, `BankStatements`, mailers, `Clock`, `Ids`: driven ports declared in
`src/service/ports/driven.ts` in the system's terms; dependency-cruiser rule `service-reach` allows a
service only its own domain, service, published language and private messages, `@teashop/kernel`,
`zod` and `@opentelemetry/api`. Each adapter folder has its own allowlist (`adapters/driven/postgres`:
`drizzle-orm`, `pg`, `@teashop/pg`, `@teashop/messaging`; `adapters/driven/stripe`: `stripe`;
`adapters/driven/threepl`: `undici`; `adapters/driving/next`: `next`, `@teashop/courier`; one adapter
folder never imports another). Other code reaches a system only through its package `exports`
(`./published`, `./ports`, `./fakes`, `./builder`) or through a driving adapter's way in
(`./driving/next` imported only by `apps/web/app/**`, `./driving/payload` only by `external/cms`);
Node's `exports` refuses deep imports, dependency-cruiser restricts who imports which path. Every
dependency is a factory argument chosen in `assembleWeb`/`assembleWorker` or a system builder;
`biome-plugins/no-module-instances.grit` refuses a module-level client in `systems/**`. Driving
adapters the framework or Payload constructs read `createCourier(...).read()` inside each call; only
builders call `fill`. Telemetry is the one direct reach: `@opentelemetry/api` and a pino logger to
stdout, neither changing what a use case does.

**P6.** Every driven port has a fake in its system's `src/fakes`, written for the port: an in-memory
store whose fake `Transactions` applies writes copy-on-commit and enforces versions and unique keys,
fake processor, warehouse, bank and mailers driven by a script, fixed clock, sequence ids. Service
tests run on fakes only. One suite per port, `test/service/ports/<port>.port-suite.ts`, exports
`describePort(name, makeImpl)`; it runs on the fake in the default suite (`*.test.ts`), on the
Postgres adapter in `*.int.test.ts` against a Postgres started by testcontainers and migrated by the
real `apps/migrate` code, and on Stripe test mode, the 3PL sandbox, the bank sandbox and a Postmark
test token in `*.e2e.test.ts`, which run on demand only. The suite asserts what use-case tests rely
on: stale save fails, duplicate key fails, claim twice answers `alreadyClaimed`, Stripe refusal on a
disputed charge is a refusal, the 3PL's duplicate reference returns the first order. `shop`'s
`CardPayments` is `shop`'s own port with `shop`'s fake; its suite also runs on the adapter wired to
`payment`'s offer fake. Code reached through no port is telemetry, which with no SDK registered is a
no-op.

**P7.** Each acting service opens one `Transactions.run`, does every write in it with the `tx` each
writing port requires as its first parameter, writes its outbox messages and its claim in it, and
makes any outside call after `run` resolves. Several aggregates are saved together only where a rule
ties them: `PlaceOrder` saves `Order`, `Cart` and the lines' `Stock`s (no unit sold twice; a cart
becomes one order); cancellation and `RecordShipmentBooked` save `Order` and `Stock`s; billing saves
`Invoice` with `NumberSeries` (gapless), `CreditNote` with `NumberSeries` and `Invoice` (open amount),
`Transfer` with its `Invoice`s and `DebtorStanding`, a dunning step with `DebtorStanding`; payment
saves `CardRefund` with `Payment` (refundable total). Everything else follows by message. No service
calls another service. A failed write throws out of `run`, which rolls back whole; no savepoints.

**P8.** Every message goes through the outbox port in the use case's transaction. Outside changes are
made by executor use cases called for private messages (`SendCustomerMail`, `SendBillingMail`,
`RegisterArticle`, `SubmitShipment`, `CancelIntent`, `ExecuteRefund`), which decide nothing and record
the outcome, or as the call after the commit from a committed record (`shop`'s order then
`openCardPayment`; `payment`'s `Payment(opening)` then Stripe), repeated by `PayOrder` or
`ReconcileIntent` and ended by the payment deadline. The relay marks a row relayed only after
`boss.send` resolved; pg-boss keeps jobs in Postgres, retries with backoff and moves exhausted jobs to
`<queue>__dead` with retention of ten years; a handler resolves only after its use case returned, so
pg-boss completes the job after the commit; hooks answer 200 only after the commit. `cms` tells of
product changes by a message its own transaction writes: the `afterChange` hook inserts into
`cms.outbox` through Payload's session for `req.transactionID`, so the third sentence of P8's rule is
not reached; assembly's `createCmsOutboxReader` hands it to the relay.

**P9.** Every acting use case called for a message claims `(useCase, messageId)` in its transaction;
`alreadyClaimed` returns success with nothing committed. Calls carry keys or are told by records:
`placeOrder` by `cartId` (unique `orders.cart_id`; a second call finds the order and returns the same
result, re-asking `payment` for the same intent), `openCardPayment` by `orderRef` (unique
`payments.order_ref`; Stripe key `payment:<paymentId>`), polled transfers by the bank's transfer id
(primary key), stock items by `<sku>@<asOf>`, operator refunds and paybacks by a key the form carries.
Outside changes carry keys naming the change: Stripe `refund:<refundId>` plus `findRefund` before
creating when the request is older than 23 hours; 3PL order reference `orderRef`, unique at the 3PL;
3PL article `PUT /articles/{sku}`. Mails carry no key: each system's `domain/repeats.ts` states
`customerMail: 'accept'` (the brief's rare duplicate), and the executor asks it. `setCartLine` without
a cart may make a second cart: accepted in `shop/domain/cart.ts`. Statuses are set, never toggled,
and transitions are forward-only, so repeats find the target state and commit nothing.

**P10.** Acting use cases read in the committing transaction and save with a version compare; inserts
fail on keys. Data a decision reads is kept in the aggregate saved: available stock is `Stock`'s
`freeToShip` less its reservations, so two checkouts racing for one sku fail one another, and checkouts
of different skus touch different rows. A lost race throws `ConcurrentChange`: handlers let the bus
redeliver, the checkout server function answers 409 and the browser resubmits, nothing reapplies a
decision. Stale reads rest on stated rules: `CatalogItem` lags `cms` by the relay's delay (brief:
within a minute; `checkout.ts` accepts the replica's price as current), `CustomerStanding` lags
`billing` (`payment-options.ts` accepts one more invoice order from a customer who just entered
dunning). Aggregates hold other aggregates by id or snapshot (order lines snapshot price, sku, tax
class); `SentMail` and statistics are not written in deciding transactions.

**P11.** Each system's tables live in its own Postgres schema, and every system transaction runs as
`<system>_rw` with privileges on that schema only, so a query of another system's table fails in the
store; dependency-cruiser refuses imports of another system's `adapters`, `service` or `domain`.
Reads of other systems go through open host services (`availableStock`, `articleStatus`, timelines,
`openCardPayment`) or published events into replicas; changes go through commands
(`BookShipment`, `RefundCardPayment`) or the open host service. Payload connects as `cms_rw`, so its
configuration cannot write `shop`'s tables; it keeps no record a system of this codebase owns (its
two virtual fields are read through `shop`'s and `fulfilment`'s hooks, stored nowhere). The relay
reads outboxes only through readers each system builder, or assembly for `cms`, provides.

**P12.** Every system is an anti-corruption layer to every upstream; none conforms. Another system's
published language may be imported only in `adapters/driven/<upstream>/**`, `adapters/driving/handlers/**`
(the handler of that upstream's message) and the hook or field adapter that speaks to it
(dependency-cruiser rule `upstream-terms-at-adapters`); Stripe's package only in
`payment/adapters/driven/stripe` and the Stripe hook; Payload's types only in `external/cms` and the
two field hooks; the 3PL and bank clients only in their adapters. A published language module may
import only `zod`, the kernel and its own published modules (rule `published-closed`), and the kernel
no system.

**P13.** Other systems import only `@teashop/<s>/published`, `/ports` and, in tests, `/fakes`; only
`apps/*/src/assembly` imports `/builder` (dependency-cruiser `offer-only` and `builders-to-assembly`).
Builders return the open host service, handlers and outbox readers, never repositories. Everything that
crosses is of the upstream's published language: `shop`'s events are `shop`'s, the commands
`BookShipment` and `RefundCardPayment` are the receivers', `cms.ProductSaved` is `cms`'s; services
translate between domain and published language in `service/translate.ts`. `published/**` reaches
nothing of its system outside it, is hand-written, and states its own constraints (`quantity` positive,
`taxClass` enum, `country: 'DE'`). No private message has a subscriber outside its system (rule
enforced in `createPgBossBus`: a handler named `<system>.*` may subscribe to a private type only of the
same system).

**P14.** Each message `(type, version)` has one zod schema, stated once (published in
`published/events.ts` or `commands.ts`, private in `messages/private.ts`), used by the writer's outbox
adapter and every handler; the envelope carries `type` and `version`. `tools/check-message-compat`
(CI) compares JSON Schema snapshots of every message with `main` and refuses a change that is not
optional-field add or remove, or a new value that old readers would read otherwise; such a change is
a new version written beside the old (`OrderShippedV2` beside `V1`) until outboxes and dead letters
hold no `V1` and every subscriber reads `V2`. Records: repository adapters update only the columns
they know and upsert child rows by id, so an old process saving a row drops no column it does not
know; migrations only expand within a release and contract one release later
(`tools/check-migrations`); a new column is read first and written one release later. All open host
services are called in-process, so their ports are compiled with their callers.

**P15.** Storefront use cases read only `shop`'s store: catalog, stock, standing and article
availability are replicas fed by events. `placeOrder` and `payOrder` for card call `payment`, and
`payment` calls Stripe, after the commit, because the business rule "the customer pays now" needs the
`client_secret` before the use case returns; when `payment` or Stripe is down the order is still placed
and the response says `cardUnavailable`. Invoice checkout calls nothing. The `cms` field hooks read
`shop`'s and `fulfilment`'s own records in-process and degrade to "unavailable". `backoffice` answers
with every section it got and marks the others `unavailable`. Ops actions call only their own system.
Executors and reconciliations, called for messages, call Stripe, the 3PL or Postmark and are
redelivered while those are down.

**P16.** `Transactions<Tx>` is the only way to a transaction and `Tx` travels only as an argument of
driven ports; no driving port type mentions `Tx`, `PgTx`, `Pool`, a drizzle type or a Payload `req`
(dependency-cruiser rule `driving-ports-store-free` on `service/ports/driving.ts` and `published/**`),
and `node:async_hooks` is banned in `systems/**`. In-process calls between systems pass published
language values only, and the callee opens its own transaction. `SET LOCAL ROLE <system>_rw` makes a
transaction that touches another schema fail. Payload's field hooks pass nothing of `req` to `shop`
or `fulfilment`; no system calls Payload's Local API.

**P17.** Every wait that holds something has its moment in an aggregate and a held message or sweep
that starts a use case deciding by that aggregate. `Order.payBy` (30 minutes, stock held): at
`PaymentDeadlineDue` an unpaid order is cancelled, stock released, `OrderCancelled` published; a later
`CardPaymentSucceeded` meets the cancelled order and the rule refunds in full. `Payment.reconcileAt`
(1 hour): `ReconcileIntent` asks Stripe; succeeded unrecorded is recorded (the lost webhook), open is
cancelled. `Shipment.reportDueBy` (5 days): `CheckShipmentReport` asks the 3PL; shipped is recorded,
otherwise the shipment is flagged `overdue` for operators and checked again daily, accepted as it
stands. `Order.bookingAlertAt` (2 hours, stock held until passed): the order is flagged for operators
and keeps its reservation; the business accepts a late booking. Refusals are committed as outcomes:
`ShipmentRefused` (shop: nothing ships, cancel, release, refund card), `CardRefundRefused` (shop and
billing mark their request refused, operators see it), payment's `refused` to `openCardPayment`.
Failures (timeouts, 5xx, lost races) throw and are retried, and parked messages stay in dead-letter
queues that the probe counts and `tools/bus-replay` returns.

**P18.** Messages carry what lets the receiver order them: `cms.ProductSaved.revision` (raised by
the trigger under the row lock), `ShipmentBooked`/`Refused`/`Shipped.shipmentVersion`,
`DebtorStandingChanged.version`, `StockReported.asOf` (one writer, the 3PL's clock); receivers keep
the higher and drop the lower or equal. Final states (`ArticleRegistered`, `CardRefunded`, a
`Payment` succeeded) are forward-only. Early messages are recorded: `OrderCancelled` before any
`Payment` creates a cancelled `Payment` so a later `openCardPayment` is refused; `ArticleRegistered`
before the product's replica is kept in `ArticleAvailability`; a 3PL shipment report before the
submit's commit is applied to the requested `Shipment`. Conflicts between writers are decided by the
receiver's rule: `CardPaymentSucceeded` (payment) against the payment deadline (shop) on one `Order`,
whichever commits first, and a late payment refunded.

**P19.** Each system has `GLOSSARY.md`; terms enter it before code uses them. `shop`: Cart, Order,
Order line, Stock, Reservation, Catalog item, Customer (an email address). `payment`: Payment, Card
refund, Dispute, Order ref. `fulfilment`: Article, Shipment, Stock report, Order ref. `billing`:
Invoice, Credit note, Transfer, Allocation, Debtor, Dunning stage, Order ref. Upstream words are named
apart: other systems' offers are imported as namespaces only (`import * as fulfilment from
'@teashop/fulfilment/published'`, Grit plugin), Stripe's types as `Stripe.PaymentIntent`, Payload's as
`CmsProduct`, the 3PL's as `ThreePlOrder`, the bank's as `BankTransferItem`. Message classes carry no
`Event` suffix (`OrderShippedV1`), so no system's word "event" is overloaded.

## Decisions the document left to me

**D1. The cut into systems.** Chose `shop`, `payment`, `fulfilment`, `billing`, `backoffice`, and
`cms` (Payload) as an external system. Also holding: one `shop` system with payment and fulfilment
inside (wider boundaries, Khononov p. 161); `billing` split into `invoicing` and `collections`; no
`backoffice`, with the follow-checkout view as each system's ops routes.

**D2. Who owns products.** Chose `cms` (Payload) as owner, its configuration stating price above
zero, sku unique and immutable; `shop` keeps a replica. Also holding: a `catalog` system of this
codebase as owner, with Payload as external keeper and a veto hook calling `catalog`'s domain.

**D3. Where stock and its reservations live.** Chose `shop`: `Stock` per sku holding the 3PL's
free-to-ship figure and the reservations of open orders, saved with `Order` in one transaction. A
reservation stops counting once a 3PL stock report as of the 3PL's acceptance time or later is
applied. Also holding: stock in `fulfilment` with a synchronous reservation call after `shop`'s
commit (order pending until reserved), under P15's exception.

**D4. Anti-corruption layer or conformist toward each upstream.** Chose an anti-corruption layer
everywhere. Also holding: `billing` or `payment` conforming to `shop`'s published language.

**D5. How the clock starts use cases.** Chose held messages (`deliver_after`, pg-boss `startAfter`)
for per-record moments (payment deadline, intent reconciliation, booking alert, shipment report
check) and a daily sweep for dunning. Also holding: sweeps for all, or held messages for all.

**D6. The bus.** Chose pg-boss in schema `bus` of the one Postgres, one queue per handler, routing by
`(type, version)`, deterministic job id `uuidv5(messageId|queue)`, 12 retries with backoff, dead-letter
queue with ten-year retention. Also holding: a hand-written Postgres queue; an external broker would
break "one Postgres instance".

**D7. Relay and outbox shape.** Chose an outbox table per system schema, relay in `worker` polling
every second, marking after `send`. Also holding: `LISTEN/NOTIFY` wake-up; outbox as a field on the
aggregate.

**D8. Means of failing a stale write.** Chose a `version` column compared on save plus unique keys.
Also holding: `SELECT ... FOR UPDATE` at load; `SERIALIZABLE` isolation.

**D9. How a repeat is told.** Chose one `claims (use_case, key)` table per system plus forward-only
statuses. Also holding: claims folded into each aggregate's table.

**D10. Transaction port shape.** Chose `Transactions<Tx>.run(work)` with the service generic over an
opaque `Tx`, `SET LOCAL ROLE` per system at start. Also holding: explicit `begin/commit/rollback`
port; a branded `Tx` type per system.

**D11. Where ports are declared.** Chose `src/service/ports/{driving,driven}.ts`; open host service
port types in `src/published/ports.ts`. Also holding: ports in the domain.

**D12. Couriers.** Chose one courier per system per way in, stored on `globalThis` under a
`Symbol.for` key (Next may load a module twice), filled by the system's `ForWeb` builder from
`instrumentation.ts`. Also holding: a module-scoped courier.

**D13. Processes.** Chose `web`, `worker`, `migrate` from one image; all systems in both long-running
processes. Also holding: a worker per system; relay in `web`.

**D14. Mails.** Chose per-system mail executors called for private messages carrying the mail's
content, Postmark, React Email templates, `@react-pdf/renderer` for PDFs, `SentMail` written after
sending; duplicates accepted by a domain rule. Also holding: a `mailing` system subscribing to
published events; a `MailDispatch` record written with the decision.

**D15. Price confirmation.** Chose `seenPrices` as an argument of `placeOrder`, refused with
`pricesChanged` when the replica's price differs. Also holding: the cart storing the price shown,
written on each cart view.

**D16. Card payment opening.** Chose `shop` calling `payment.openCardPayment` after its commit;
`payment` commits `Payment(opening)` and a held `ReconcileIntent`, then calls Stripe with key
`payment:<paymentId>`; the intent ref is recorded from `payment_intent.created`; the client secret is
never stored. Also holding: `payment` opening the intent when it handles a `shop` event, the browser
polling for the secret.

**D17. Refund flows.** Chose `shop` requesting refunds before invoicing (late payment, dropped lines,
nothing shipped, refused shipment) without a credit note, and `billing` handling operator refunds:
credit note at once for invoice orders, and for card orders a `RefundRequest`, `RefundCardPayment`, and
the credit note only on `CardRefunded`. Also holding: `billing` issuing the credit note first and a
reversing credit note on refusal.

**D18. Lost dispute before invoicing.** Chose a `PendingCorrection` that `IssueInvoice` turns into a
credit note right after the invoice. Also holding: an invoice issued net of the lost amount.

**D19. Open amount formula.** Chose total less credit notes less payments plus recorded paybacks.
Also holding: paybacks as negative payments.

**D20. Follow one checkout.** Chose a `backoffice` system with answering use cases over the four
open host services, each section degrading to `unavailable`; `orderId` as the correlation key on
every record and envelope. Also holding: a trail replica fed by every published event.

**D21. Bank polling.** Chose a 10-minute scheduled task, window from the latest booking date less five
days, one acting call per item keyed by the bank's id, no cursor record. Also holding: a cursor
record; one acting call writing one message per item.

**D22. 3PL contract assumptions.** Chose: order reference unique at the 3PL (`orderRef`), `PUT
/articles/{sku}` idempotent, stock reports stamped by the 3PL's clock, refused shipment treated as
nothing ships. Also holding: lookup by reference before create with the remaining race accepted.

**D23. Unreported shipments.** Chose a 5-day check that asks the 3PL and then flags for operators.
Also holding: no deadline, operators watching `delayed()` only.

**D24. Debtor standing.** Chose a `DebtorStanding` aggregate per email in `billing`, saved with the
invoice change that alters it, versioned, published on change. Also holding: a notice plus a fetch of
`billing`'s open host service, kept by version.

**D25. Product revision.** Chose a Postgres trigger on `cms.products` raising `revision`, read back
by the outbox hook in Payload's transaction. Also holding: a notice with a fetch through Payload's
Local API.

**D26. Product deletion.** Chose deletion disabled in Payload (`access.delete: () => false`). Also
holding: `ProductRemoved` with a tombstone revision.

**D27. Schemas, lint, boundaries.** Chose zod, Biome (with Grit plugins), dependency-cruiser, package
`exports`. Also holding: ESLint with `eslint-plugin-boundaries`; valibot.

**D28. Tests.** Chose vitest, port suites parameterized by implementation, testcontainers Postgres
migrated by `apps/migrate` code, e2e suites on vendor sandboxes run on demand. Also holding: a CI
Postgres service instead of testcontainers.

**D29. Calendar.** Chose `'Europe/Berlin'` as a domain constant used with `Intl.DateTimeFormat` for
invoice years, due dates and dunning days. Also holding: `@js-temporal/polyfill` in the domain.

**D30. Telemetry.** Chose OpenTelemetry API ambient, trace context on the envelope, pino to stdout.
Also holding: no tracing.

**D31. Operator identity.** Chose Payload `users` with roles, operator id taken from the Payload
session by ops routes and passed as an argument. Also holding: a separate auth provider (security is
out of scope).

**D32. Lost race at checkout.** Chose 409 to the browser, which resubmits once. Also holding: the
service rerunning the whole use case from its read in a new transaction.

**D33. Media storage.** Chose Payload local storage on a persistent volume shared by `web`
instances. Also holding: an S3-compatible bucket.

**D34. Calls between systems.** Chose in-process only; no HTTP between systems of this codebase.
Also holding: `payment` in its own process behind HTTP, with P14's port half then applying.

**D35. Executor before or after the decision record.** Chose decide-then-execute for every outside
change: a deciding use case commits a record and a private message, an executor calls and records
the answer. Also holding: the handler of the cross-system command calling the 3PL directly.

## Sentences I had to pick a reading for

**S1.** "A module is of the system whose layer or offer it belongs to, wherever the codebase keeps
it." Reading A: route files in `apps/web/app/**` that re-export a system's driving adapter are that
system's modules. Reading B: they are the app's, so `apps/web` reaches past the offer. Took A: route
files are one-line re-exports, and `./driving/next` is exported for `apps/web/app/**` only.

**S2.** "A use case called for such a message MUST make the change, deciding nothing again" (P8).
Reading A: it covers every message a use case writes, including held messages and sweep items, so
`CancelIfUnpaid` and `AdvanceDunning` would have to act without checking. Reading B: it covers
messages asking for a change the writer decided; messages the clock delivers start a use case that
decides by the aggregate (P17's "decides by the aggregate"). Took B: `PaymentDeadlineDue` and
`AdvanceDunning` carry no decision, and their use cases decide; executors (`SubmitShipment`,
`ExecuteRefund`, mails) decide nothing.

**S3.** "this codebase MUST configure it so that nothing but the owner's use cases changes the
record" (P11), read with "A system that takes a write the owner's rule decides, in a hook of the
owner, is one of the owner's ways in" (P2). Reading A: an editor's save through Payload checked by a
veto hook is the owner's way in. Reading B: Payload's own write is not one of the owner's use cases,
whatever hook vetoes it. Readings differ only if a system of this codebase owns products; I made
`cms` the owner (D2), so neither applies.

**S4.** "that its service commits once after the last write" (P7). Reading A: no write and no outside
call may follow the commit. Reading B: an outside call after the commit is no write. Took B:
`openCardPayment` commits `Payment(opening)` and then calls Stripe; the intent ref arrives through
the `payment_intent.created` hook in a use case of its own, not a second commit.

**S5.** "with at most one acting call per call or message it handles" (P4). Reading A: a scheduled
task's run is one call, so polling allows one acting call. Reading B: each polled item is a message
(P4's Why, P9), one acting call per item. Took B for the bank and stock polls; for `dunningRun`,
which polls nothing, one acting call that writes a message per invoice.

**S6.** "with every value it decides by that is the same for every candidate and that no record
holds" (P2). Reading A: only business numbers (30 minutes, 7 percent). Reading B: also the calendar
zone in which "14 days" and "calendar year" are counted. Took B: `'Europe/Berlin'` is a domain
constant, not `TZ`.

**S7.** "MUST NOT depend on another system answering while it runs, unless a business rule ... needs
that system's answer now" (P15). Reading A: `backoffice`'s view depends on four systems and needs a
replica. Reading B: a use case that still answers, marking a section unavailable, does not depend on
that system. Took B (D20).

**S8.** "Tooling. Code that runs in no process of the deployed application." Reading A: the release
migration job is a process of the deployed application, so it is no tooling. Reading B: it is a
one-shot job outside the running application, tooling (the rules list "a migration" as tooling).
Took B: `apps/migrate` builds no system and is held only by `tools/check-migrations`.

**S9.** "it holds something until the answer comes" (P17). Reading A: an order waiting for the 3PL's
acceptance holds its reservation and needs a moment. Reading B: the reservation is the order's own
state and the wait is `fulfilment`'s. Took A: `Order.bookingAlertAt`, flagged for operators and
accepted as it stands.

**S10.** "Anything outside a system MUST reach into it only through its offer or by a driving
adapter's way in" (P5). Reading A: `external/cms` importing `@teashop/shop/driving/payload` is
Payload registering a hook, a way in. Reading B: it is a code import past the offer. Took A: the
field hooks are `shop`'s and `fulfilment`'s driving adapters, and `./driving/payload` is importable
only from `external/cms`.

**S11.** "the id of what the change is about, one derived from the record the transaction committed,
or the message's or the call's where it alone asks for the change" (P9). Reading A: a refund's key
must be the message id. Reading B: the refund's own id, carried by the command. Took B: Stripe key
`refund:<refundId>`, the same whether `shop` or `billing` asked and on every attempt.

**S12.** "A shared kernel MUST hold no such rule and no record's schema" (P3). Reading A: `Money`'s
zod schema is a schema and so refused. Reading B: it is a value's schema, not a record's. Took B:
`Money` and `EmailAddress` are zod schemas in the kernel.

**S13.** "and an adapter or an outbox reader only as such a port or as the outside it adapts, each
also through code of the common library whose output changes neither how a use case acts nor what it
answers" (P5). Reading A: an adapter writing its outbox through `createPgOutboxAppender` reaches the
store through the common library, whose output changes what commits, so refused. Reading B: the
adapter reaches its own outside, the store, and the common library is only the client it uses for it.
Took B: the appender and `createPgTransactions` are handed in by the builder.

**S14.** "Each driven port MUST have a fake, which the system declaring the port SHOULD provide"
(P6). Reading A: the upstream writes the fake for a downstream's anti-corruption port. Reading B: the
downstream declares the port and writes the fake; the upstream's offer fake tests the downstream's
adapter. Took B: `shop` fakes `CardPayments`; `payment` exports `fakePaymentOpenHost`.

**S15.** "A driving port MUST NOT take a transaction, nor anything else that reaches a store,
whatever type it is declared as" (P16). Reading A: about declared parameter types only. Reading B:
also what adapters pass at runtime (Payload's `req`). Took B: the field hooks pass only the sku, and
a lint rule bans `PayloadRequest` in `service/**`.

**S16.** "MUST load on every runtime of the language" (P1). Reading A: every JavaScript engine,
Hermes included. Reading B: the runtimes a caller of this codebase can arrive on: Node, browsers,
edge workers. Took B: zod and `Intl` pass; no polyfill.

**S17.** "or an open host service's driving port called from another process" (P14 Scope). Reading A:
`web` and `worker` on different versions during a deploy make in-process calls cross versions.
Reading B: an in-process call is compiled with its caller, whatever version other processes run.
Took B: no versioning of open host service ports; messages between `web` and `worker` are versioned.

**S18.** "A decision on data whose change fails no transaction of this store" (P10). Reading A: a
replica in this system's store is data whose change could fail the transaction, so checkout must
version-check catalog rows. Reading B: the replica's change fails nothing as written, so a business
rule accepting it stale suffices. Took B: checkout reads `CatalogItem` and `CustomerStanding` without
a compare, under stated rules.

**S19.** "There are as many driving adapters as there are ways into the process." Reading A: one 3PL
endpoint routing by event type is one driving adapter. Reading B: one per event type. Took A: one
`/api/hooks/3pl` route, one acting call per event.

**S20.** "A refusal of a step MUST be committed as the step's outcome and reach the system that
decided the step" (P17). Reading A: the refusal must be addressed to the requester. Reading B: an
event naming no sender suffices if the requester can recognize its own step. Took B:
`CardRefundRefused` carries `refundId`; `shop` and `billing` act only on ids they hold, others ignore
it.

**S21.** "Code anywhere else that needs what it decides MUST get it from that statement" (P2).
Reading A: `shop` must parse product prices with a rule of its own. Reading B: where the owner is
external, the owner's published schema is the statement to get it from. Took B: `shop` parses
`cms.ProductSaved` with `cms`'s schema, which constrains `priceCents` positive.
