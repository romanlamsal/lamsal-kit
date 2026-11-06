# Fresh repository draft A, distilled set (property rules)

Tea shop of the brief, TypeScript on Node 24, one Postgres instance, Payload CMS, Stripe, a 3PL API
with webhooks, a bank API, a mail provider. Glossary terms are used as `distilled.md` spells them;
names that are not glossary terms are in backticks.

Libraries I picked (the brief names none of them): Next.js 15 (the host Payload 3 needs), Drizzle ORM
on `pg` for the systems' repository adapters, `pg-boss` as the bus, `zod` 4 for schemas,
`@js-temporal/polyfill` for time, `stripe` (Node SDK), `pdfkit` for PDFs, `pino` for logs,
`@opentelemetry/api` for traces, `vitest`, ESLint (typescript-eslint) plus `dependency-cruiser` for
reach rules, pnpm workspaces.

## Systems and what each owns

| System | Kind | Owns (owner: its business rules decide these records) | Keeps (records it stores; replicas and snapshots included) |
|---|---|---|---|
| `shop` | system of this codebase | carts; orders (lines, payment method, payment deadline, handover deadline, dropped lines, refunds it asked for, status); stock reservations | its replica of the 3PL's free stock per sku (`Stock.freeAt3pl`, owner the 3PL); its replica of products for sale (`CatalogItem`, owner Payload; for-sale flag from `fulfillment`'s events); its replica of each customer's dunning flag (`CustomerDunning`, owner `billing`); snapshots of price, sku, tax class, title on each order line; sent-mail log; outbox; handled messages |
| `payment` | system of this codebase | card payments (`Payment`: one per order, its refunds, its dispute state) | the provider reference of the Stripe PaymentIntent and refunds (snapshot of Stripe's ids); outbox; handled messages |
| `fulfillment` | system of this codebase | articles (sku registered in the 3PL article master or not); shipments (handover state, warehouse reference, reported lines, rejection) | outbox; handled messages |
| `billing` | system of this codebase | invoices; credit notes; the two number series per calendar year; bank transfers and their assignment; paybacks; refund requests after invoicing; dunning stage per invoice; customer standing (in dunning or not) | snapshot of order lines, address and email on each invoice; bank poll cursor; sent-document log; outbox; handled messages |
| Payload CMS (`cms`) | external system, in our process, configured by this codebase (`packages/cms`) | products (copy, images, slug, `priceCents`, sku, tax class, version): its configuration holds "price above zero", "sku unique" and "sku fixed once saved" as its own rules; editors and operators as users | its own outbox collection `cms_outbox`; media |
| Stripe | external system, vendor-run | PaymentIntents, charges, refunds, disputes | |
| 3PL warehouse | external system, vendor-run | article master, free stock per sku, warehouse orders (consignments), what it shipped | |
| Bank API | external system, vendor-run | incoming transfers | |
| Mail provider | external system, vendor-run | delivery of mails | |
| `@tea/kernel` | shared kernel of `shop`, `payment`, `billing` | no records | `Money` (EUR integer cents, sum, multiply, compare, allocate), `EmailAddress` (trimmed, lowercased; equality is "same customer") |
| `@tea/lib` | common library | no records, no business rule | `Result`, the message envelope, the relay, the `pg-boss` bus adapter, the scheduler, the Postgres outbox reader factory, outbox/handled-messages table factories, system clock, uuid v7/v5 ids, `Log`, the mail-provider HTTP client, the port-suite test helper, the courier interface |
| `apps/web`, `apps/worker` | assembly and process entry points; no system | no records | configuration loading, one assembly per process |
| `apps/web/src/process-courier.ts`, `@tea/lib/messaging/backlog-probe` | probe | no records | backlog of each outbox and each bus queue, for the operators' "delayed" view |
| `tools/migrate` | tooling | no records | runs every system's migrations, Payload's migrations, the `pg-boss` schema install, role grants |

Business processes, for the record:

- Order process (`shop` orchestrates by commands): placed, then for card orders paid (`payment`),
  handed to the 3PL and reported shipped (`fulfillment`), lines dropped and refunded where the 3PL
  could not ship (`payment`), cancelled where nothing shipped or the payment deadline passed.
- Invoicing and collection (choreography: `billing` reacts to `shop.OrderShipped.v1`, `payment`'s
  refund and dispute events): invoice, mail, card invoice shown paid, transfer matching, dunning,
  credit notes.
- Catalog (choreography on Payload's outbox): Payload tells of a product save; `fulfillment`
  registers the sku with the 3PL; `shop` keeps its replica, for sale once `fulfillment` says the
  article is registered.

Upstream relations, each a choice (P12): every system of this codebase translates every upstream in
an anti-corruption layer. No system conforms to anything. `shop` is downstream of Payload,
`payment` (open host service and events), `fulfillment` (events; it sends `fulfillment`'s command)
and `billing` (events). `billing` is downstream of `shop` and `payment`. `fulfillment` is downstream
of Payload, the 3PL and `shop` (it takes `shop`'s requests in its own command). `payment` is
downstream of Stripe and takes `shop`'s and `billing`'s requests in its own commands.

## Ports and adapters

Common types used below (`@tea/lib`, `@tea/kernel`):

```ts
// @tea/lib/result
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// @tea/lib/messaging/envelope
export type Envelope = {
  readonly id: string;              // uuid; the message's id, same on every delivery
  readonly type: string;            // e.g. "shop.OrderShipped.v1"
  readonly occurredAt: string;      // ISO instant, informative only (never used for ordering)
  readonly correlationId: string | null; // the order id where there is one
  readonly traceparent: string | null;   // W3C trace context, observation
  readonly payload: unknown;        // parsed by the one schema of `type`
};

// @tea/lib/messaging/outbox-reader
export interface OutboxReader {
  readonly name: string;
  fetchUnrelayed(limit: number): Promise<readonly Envelope[]>;
  markRelayed(ids: readonly string[]): Promise<void>;
  backlog(): Promise<{ readonly pending: number; readonly oldestAt: Date | null }>;
  purgeRelayedBefore(before: Date): Promise<number>;
}

// @tea/lib/messaging/handler
export interface MessageHandler {
  readonly name: string;                    // also the bus queue name
  readonly subscribes: readonly string[];   // envelope types
  handle(envelope: Envelope): Promise<void>; // resolves only after the use case committed
}
export interface ScheduledTask {
  readonly name: string;
  readonly cron: string;                    // UTC
  run(): Promise<void>;
}

// @tea/lib/courier
export interface Courier<T> { read(): T }

// @tea/kernel
export type Money = { readonly cents: number }; // EUR only; branded by schema
export type EmailAddress = string & { readonly __brand: 'EmailAddress' };
```

Every system's transaction port has the same shape in its own terms; shown once for `shop`:

```ts
export interface ShopTx { readonly system: 'shop' }
export interface ShopTransactions { run<T>(work: (tx: ShopTx) => Promise<T>): Promise<T> }
```

Its Postgres adapter is `class PgShopTx implements ShopTx { readonly system = 'shop' as const;
constructor(readonly db: DrizzleTx) {} }`; every repository adapter of `shop` narrows with
`if (!(tx instanceof PgShopTx)) throw new TypeError(...)`. The fake is `class FakeShopTx implements
ShopTx`, working on a copy of the in-memory tables that replaces them when `work` resolves and is
dropped when it throws. No cast anywhere.

### `shop`

Driving ports (`packages/shop/src/ports/driving.ts`). Each type is one driving port, one use case.

```ts
import type { EmailAddress, Money } from '@tea/kernel';
import type { Result } from '@tea/lib/result';
import type { CartId, OrderId, Sku, GermanAddress, PaymentMethod, CatalogItemView, CartView,
  OrderTimelineEntry, OrderSummary, OrderFilter } from '../domain';

// answering, storefront
export type ListProductsForSale = () => Promise<readonly CatalogItemView[]>;
export type GetProductBySlug = (slug: string) => Promise<CatalogItemView | null>;
export type ViewCart = (cartId: CartId) => Promise<CartView | null>;
export type GetPaymentOptions = (email: EmailAddress) => Promise<readonly PaymentMethod[]>;
// answering, editors (Payload field) and operators
export type GetAvailableStock = (sku: Sku) =>
  Promise<{ readonly available: number; readonly freeAt3plAsOf: Date | null } | null>;
export type GetOrderTimeline = (orderId: OrderId) => Promise<readonly OrderTimelineEntry[]>;
export type ListOrders = (filter: OrderFilter) => Promise<readonly OrderSummary[]>;

// acting, storefront
export type SetCartLine = (input: {
  readonly cartId: CartId | null; readonly sku: Sku; readonly quantity: number;
}) => Promise<Result<{ readonly cartId: CartId },
  { readonly kind: 'notForSale' } | { readonly kind: 'cartCheckedOut'; readonly orderId: OrderId }>>;

export type CheckoutInput = {
  readonly cartId: CartId;                         // the idempotency key of checkout
  readonly email: EmailAddress;
  readonly address: GermanAddress;
  readonly paymentMethod: PaymentMethod;           // 'card' | 'invoice'
  readonly seenPrices: ReadonlyMap<Sku, Money>;    // what the customer last saw
};
export type CheckoutAccepted = {
  readonly orderId: OrderId;
  readonly payment: { readonly kind: 'card'; readonly clientSecret: string } | { readonly kind: 'invoice' };
};
export type CheckoutRefusal =
  | { readonly kind: 'cartEmpty' }
  | { readonly kind: 'notForSale'; readonly skus: readonly Sku[] }
  | { readonly kind: 'pricesChanged'; readonly lines: readonly { readonly sku: Sku; readonly price: Money }[] }
  | { readonly kind: 'insufficientStock'; readonly lines: readonly { readonly sku: Sku; readonly available: number }[] }
  | { readonly kind: 'invoiceNotOffered' }
  | { readonly kind: 'orderClosed'; readonly orderId: OrderId };   // a repeat after the order was cancelled
export type Checkout = (input: CheckoutInput) => Promise<Result<CheckoutAccepted, CheckoutRefusal>>;

// acting, called for messages (handlers, scheduled tasks)
type Msg = { readonly messageId: string };
export type SyncCatalogItem = (m: Msg & { readonly productId: string }) => Promise<void>;
export type MarkArticleRegistered = (m: Msg & { readonly sku: Sku }) => Promise<void>;
export type RecordFreeStock = (m: Msg & { readonly sku: Sku; readonly free: number; readonly asOf: Date }) => Promise<void>;
export type RecordHandover = (m: Msg & { readonly orderId: OrderId; readonly acceptedAt: Date;
  readonly skus: readonly Sku[] }) => Promise<void>;
export type MarkReservationHandedOver = (m: Msg & { readonly orderId: OrderId; readonly sku: Sku; readonly acceptedAt: Date }) => Promise<void>;
export type ReleaseReservation = (m: Msg & { readonly orderId: OrderId; readonly sku: Sku }) => Promise<void>;
export type RecordShipmentReport = (m: Msg & { readonly orderId: OrderId;
  readonly shipped: readonly { readonly sku: Sku; readonly quantity: number }[] }) => Promise<void>;
export type RecordShipmentRejected = (m: Msg & { readonly orderId: OrderId; readonly reason: string }) => Promise<void>;
export type RecordCardPaymentSucceeded = (m: Msg & { readonly orderId: OrderId; readonly amount: Money }) => Promise<void>;
export type RecordCardRefundOutcome = (m: Msg & { readonly refundId: string;
  readonly outcome: 'refunded' | 'refused'; readonly reason: string | null }) => Promise<void>;
export type RecordCustomerDunning = (m: Msg & { readonly email: EmailAddress;
  readonly inDunning: boolean; readonly version: number }) => Promise<void>;
export type RequestDeadlineChecks = () => Promise<void>;      // scheduled, writes one message per due order
export type ExpireUnpaidOrder = (m: Msg & { readonly orderId: OrderId }) => Promise<void>;
export type FlagOverdueHandover = (m: Msg & { readonly orderId: OrderId }) => Promise<void>;
export type SendCustomerMail = (m: Msg & { readonly mail: CustomerMail }) => Promise<void>;

export type ShopDrivingPorts = {
  readonly listProductsForSale: ListProductsForSale; readonly getProductBySlug: GetProductBySlug;
  readonly viewCart: ViewCart; readonly getPaymentOptions: GetPaymentOptions;
  readonly getAvailableStock: GetAvailableStock; readonly getOrderTimeline: GetOrderTimeline;
  readonly listOrders: ListOrders; readonly setCartLine: SetCartLine; readonly checkout: Checkout;
  readonly syncCatalogItem: SyncCatalogItem; readonly markArticleRegistered: MarkArticleRegistered;
  readonly recordFreeStock: RecordFreeStock; readonly recordHandover: RecordHandover;
  readonly markReservationHandedOver: MarkReservationHandedOver;
  readonly releaseReservation: ReleaseReservation; readonly recordShipmentReport: RecordShipmentReport;
  readonly recordShipmentRejected: RecordShipmentRejected;
  readonly recordCardPaymentSucceeded: RecordCardPaymentSucceeded;
  readonly recordCardRefundOutcome: RecordCardRefundOutcome;
  readonly recordCustomerDunning: RecordCustomerDunning;
  readonly requestDeadlineChecks: RequestDeadlineChecks; readonly expireUnpaidOrder: ExpireUnpaidOrder;
  readonly flagOverdueHandover: FlagOverdueHandover; readonly sendCustomerMail: SendCustomerMail;
};
```

Driven ports (`packages/shop/src/ports/driven.ts`):

```ts
import type { Temporal } from '@js-temporal/polyfill';

export interface ShopTx { readonly system: 'shop' }
export interface ShopTransactions { run<T>(work: (tx: ShopTx) => Promise<T>): Promise<T> }

export interface Carts {
  get(tx: ShopTx, id: CartId): Promise<Cart | null>;
  save(tx: ShopTx, cart: Cart): Promise<void>;                // version-checked; insert fails on existing id
}
export interface Orders {
  get(tx: ShopTx, id: OrderId): Promise<Order | null>;
  findByCart(tx: ShopTx, cartId: CartId): Promise<Order | null>;
  listPaymentOverdue(tx: ShopTx, now: Temporal.Instant, limit: number): Promise<readonly OrderId[]>;
  listHandoverOverdue(tx: ShopTx, now: Temporal.Instant, limit: number): Promise<readonly OrderId[]>;
  list(tx: ShopTx, filter: OrderFilter): Promise<readonly Order[]>;
  save(tx: ShopTx, order: Order): Promise<void>;
}
export interface StockLevels {
  getMany(tx: ShopTx, skus: readonly Sku[]): Promise<ReadonlyMap<Sku, Stock>>; // absent sku -> Stock.empty(sku)
  save(tx: ShopTx, stock: Stock): Promise<void>;
}
export interface CatalogItems {
  get(tx: ShopTx, sku: Sku): Promise<CatalogItem | null>;
  getMany(tx: ShopTx, skus: readonly Sku[]): Promise<ReadonlyMap<Sku, CatalogItem>>;
  bySlug(tx: ShopTx, slug: string): Promise<CatalogItem | null>;
  listForSale(tx: ShopTx): Promise<readonly CatalogItem[]>;
  save(tx: ShopTx, item: CatalogItem): Promise<void>;
}
export interface CustomerDunningReplica {
  get(tx: ShopTx, email: EmailAddress): Promise<CustomerDunning | null>;
  save(tx: ShopTx, entry: CustomerDunning): Promise<void>;
}
export interface SentMails {
  record(tx: ShopTx, mail: SentMail): Promise<void>;
  listByOrder(tx: ShopTx, orderId: OrderId): Promise<readonly SentMail[]>;
}
// the outbox port: messages in shop's terms; the adapter writes each in its one schema
export type ShopOutgoing =
  | { readonly kind: 'orderShipped'; readonly id: string; readonly order: Order }                 // shop.OrderShipped.v1 (published)
  | { readonly kind: 'shipmentRequested'; readonly id: string; readonly order: Order }            // fulfillment.ShipOrder.v1 (command)
  | { readonly kind: 'cardRefundRequested'; readonly id: string; readonly orderId: OrderId; readonly refund: OrderRefund } // payment.RefundCardPayment.v1
  | { readonly kind: 'cardPaymentCancelRequested'; readonly id: string; readonly orderId: OrderId } // payment.CancelCardPayment.v1
  | { readonly kind: 'reservationReleaseDue'; readonly id: string; readonly orderId: OrderId; readonly sku: Sku }   // private
  | { readonly kind: 'reservationHandedOver'; readonly id: string; readonly orderId: OrderId; readonly sku: Sku; readonly acceptedAt: Date } // private
  | { readonly kind: 'paymentDeadlineReached'; readonly id: string; readonly orderId: OrderId }   // private
  | { readonly kind: 'handoverDeadlineReached'; readonly id: string; readonly orderId: OrderId }  // private
  | { readonly kind: 'customerMailDue'; readonly id: string; readonly mail: CustomerMail };       // private
export interface ShopOutbox {
  append(tx: ShopTx, messages: readonly ShopOutgoing[]): Promise<void>; // insert ... on conflict (id) do nothing
}
export interface ShopMessageClaims {
  claim(tx: ShopTx, handler: string, messageId: string): Promise<'first' | 'repeat'>;
}
// anti-corruption layer to payment's open host service (in-process call)
export interface CardPayments {
  open(request: { readonly orderId: OrderId; readonly amount: Money; readonly idempotencyKey: string }):
    Promise<{ readonly kind: 'opened'; readonly clientSecret: string } | { readonly kind: 'closed' }>;
}
// anti-corruption layer to Payload's Local API
export interface ProductSource {
  fetch(productId: string): Promise<CatalogItemSource | 'deleted'>;
}
export interface MailSender { send(mail: RenderedMail): Promise<void> }
export interface Clock { now(): Temporal.Instant }
export interface Ids { newId(): string }
```

Domain (`packages/shop/src/domain`), the shapes the ports above carry: `Cart { id, version, lines:
{sku, quantity}[], checkedOutAs: OrderId | null }`; `Order { id, version, cartId, email, address,
paymentMethod, placedAt, paymentDueBy | null, handoverDueBy | null, lines: { sku, title, quantity,
unitPrice: Money, taxClass }[], status: 'awaitingPayment' | 'awaitingHandover' | 'handedOver' |
'shipped' | 'cancelled', droppedLines, refunds: OrderRefund[], cancelReason, handoverOverdue }`;
`Stock { sku, version, freeAt3pl, freeAsOf, reservations: { orderId, quantity, handedOverAt |
null }[] }`; `CatalogItem { sku, version, productId, slug, title, descriptionHtml, imageUrls,
price: Money, taxClass, inPayload: boolean, articleRegistered: boolean }`; `CustomerDunning { email,
inDunning, billingVersion }`. Domain functions: `placeOrder(cart, items, stocks, dunning, input,
now, newIds)`, `available(stock)`, `paymentOptions(dunning)`, `recordShipment(order, shipped)`,
`expire(order, now)`, `applyCardPayment(order, amount)`, `applyFreeStock(stock, report)`,
`mailRepeatPolicy` (`'accept'`), constants `PAYMENT_WINDOW = Temporal.Duration.from({ minutes: 30 })`,
`HANDOVER_GRACE = Temporal.Duration.from({ hours: 48 })`, `SHOP_SENDER`.

Adapters:

- Driven: `adapters/driven/postgres/*` (one adapter of the store `shop` schema: `tx.ts`, `carts.ts`,
  `orders.ts`, `stock-levels.ts`, `catalog-items.ts`, `customer-dunning.ts`, `sent-mails.ts`,
  `outbox.ts`, `message-claims.ts`); `adapters/driven/payment/card-payments.ts` (calls `payment`'s
  `OpenCardPayment` handed in by assembly, maps to and from `payment`'s published language);
  `adapters/driven/payload/product-source.ts` (`payload.findByID({ collection: 'products', id,
  depth: 1 })`, no `req`, typed by `@tea/cms/published`'s generated `Product`, Lexical rendered to
  HTML here); `adapters/driven/mail/mail-sender.ts` (mail-provider client from `@tea/lib`,
  templates in `adapters/driven/mail/templates/*.ts`).
- Driving: `adapters/driving/next/` (server actions `setCartLineAction`, `checkoutAction`; RSC data
  functions for storefront pages; `AvailableStockField` Payload `ui` field component; ops server
  components `OrderTimeline`, `OrdersTable`); `adapters/driving/handlers/` (one handler per
  subscribed type, listed under Calls and messages); `adapters/driving/scheduled/`
  (`deadline-sweep.ts`, every minute). All Next.js driving adapters read `shop`'s courier inside
  their function body.
- Outbox reader: `createPgOutboxReader(pool, 'shop')` from `@tea/lib`, returned by the system builder.

System builder (`packages/shop/src/builder.ts`, exported as `@tea/shop/builder`):

```ts
import type { Pool } from 'pg';
import type { Payload } from 'payload';
import type { OpenCardPayment } from '@tea/payment/published';
import type { MessageHandler, ScheduledTask, OutboxReader } from '@tea/lib/messaging';
import type { Log } from '@tea/lib/log';

export type ShopBuilderInput = {
  readonly config: { readonly mailApiKey: string; readonly mailApiBaseUrl: string; readonly publicBaseUrl: string };
  readonly pool: Pool;                 // role shop_rw, search_path shop
  readonly payload: Payload;
  readonly openCardPayment: OpenCardPayment;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly log: Log;
};
export type BuiltShop = {
  readonly ports: ShopDrivingPorts;
  readonly handlers: readonly MessageHandler[];
  readonly scheduledTasks: readonly ScheduledTask[];
  readonly outboxReaders: readonly OutboxReader[];
};
export function buildShop(input: ShopBuilderInput): BuiltShop; // also fills shop's courier
```

### `payment`

Open host service, in `payment`'s published language (`packages/payment/src/published/`):

```ts
export const OpenCardPaymentRequestV1 = z.object({
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),   // the contract's own constraint (P13 MAY)
  currency: z.literal('EUR'),
  idempotencyKey: z.string().min(1),
});
export type OpenCardPaymentRequestV1 = z.infer<typeof OpenCardPaymentRequestV1>;
export type OpenCardPaymentResultV1 =
  | { readonly ok: true; readonly value: { readonly paymentId: string; readonly clientSecret: string } }
  | { readonly ok: false; readonly error: { readonly code: 'paymentClosed'; readonly status: 'succeeded' | 'cancelled' } };
export type OpenCardPayment = (request: OpenCardPaymentRequestV1) => Promise<OpenCardPaymentResultV1>;
```

Its fake, `@tea/payment/fakes`: `createFakeOpenCardPayment(scenario?: { closed?: readonly string[] })`,
run by `payment`'s own suite for `OpenCardPayment`.

Other driving ports:

```ts
type Msg = { readonly messageId: string };
export type RecordStripeNotice = (m: Msg & { readonly subject:
  { readonly kind: 'paymentIntent'; readonly providerRef: string } |
  { readonly kind: 'refund'; readonly providerRef: string } |
  { readonly kind: 'dispute'; readonly providerRef: string } }) => Promise<void>;
export type RequestCardRefund = (m: Msg & { readonly refundId: string; readonly orderId: string;
  readonly amount: Money; readonly reason: RefundReason }) => Promise<void>;
export type RequestCardPaymentCancel = (m: Msg & { readonly orderId: string }) => Promise<void>;
export type ExecuteProviderRefund = (m: Msg & { readonly paymentId: PaymentId; readonly refundId: string }) => Promise<void>;
export type ExecuteIntentCancel = (m: Msg & { readonly paymentId: PaymentId }) => Promise<void>;
export type RequestPaymentReconciliation = () => Promise<void>;  // scheduled hourly
export type ReconcilePayment = (m: Msg & { readonly paymentId: PaymentId }) => Promise<void>;
export type GetPaymentTimeline = (orderId: string) => Promise<readonly PaymentTimelineEntry[]>;
export type ListPayments = (filter: PaymentFilter) => Promise<readonly PaymentSummary[]>;
```

Driven ports:

```ts
export interface PaymentTx { readonly system: 'payment' }
export interface PaymentTransactions { run<T>(work: (tx: PaymentTx) => Promise<T>): Promise<T> }
export interface Payments {
  get(tx: PaymentTx, id: PaymentId): Promise<Payment | null>;
  findByOrder(tx: PaymentTx, orderId: string): Promise<Payment | null>;
  findByProviderRef(tx: PaymentTx, providerRef: string): Promise<Payment | null>;
  listNeedingReconciliation(tx: PaymentTx, now: Temporal.Instant, limit: number): Promise<readonly PaymentId[]>;
  save(tx: PaymentTx, payment: Payment): Promise<void>;
}
export type PaymentOutgoing =
  | { readonly kind: 'cardPaymentSucceeded'; readonly id: string; readonly payment: Payment }   // payment.CardPaymentSucceeded.v1
  | { readonly kind: 'cardRefunded'; readonly id: string; readonly payment: Payment; readonly refundId: string } // payment.CardRefunded.v1
  | { readonly kind: 'cardRefundRefused'; readonly id: string; readonly refundId: string; readonly orderId: string; readonly reason: RefundRefusal } // payment.CardRefundRefused.v1
  | { readonly kind: 'cardDisputeLost'; readonly id: string; readonly payment: Payment }        // payment.CardDisputeLost.v1
  | { readonly kind: 'providerRefundDue'; readonly id: string; readonly paymentId: PaymentId; readonly refundId: string } // private
  | { readonly kind: 'intentCancelDue'; readonly id: string; readonly paymentId: PaymentId }    // private
  | { readonly kind: 'reconciliationDue'; readonly id: string; readonly paymentId: PaymentId }; // private
export interface PaymentOutbox { append(tx: PaymentTx, messages: readonly PaymentOutgoing[]): Promise<void> }
export interface PaymentMessageClaims { claim(tx: PaymentTx, handler: string, messageId: string): Promise<'first' | 'repeat'> }
export interface CardProvider {   // Stripe, in payment's terms
  openIntent(r: { readonly paymentId: PaymentId; readonly orderId: string; readonly amount: Money }, idempotencyKey: string):
    Promise<{ readonly providerRef: string; readonly clientSecret: string }>;
  intentState(providerRef: string): Promise<ProviderIntentState>;   // { status: 'open'|'succeeded'|'cancelled'; received: Money; succeededAt: Date|null }
  findIntentByPayment(paymentId: PaymentId): Promise<string | null>; // provider search by metadata
  cancelIntent(providerRef: string): Promise<'cancelled' | 'alreadySucceeded'>;
  refund(r: { readonly refundId: string; readonly providerRef: string; readonly amount: Money }, idempotencyKey: string):
    Promise<{ readonly kind: 'refunded' | 'pending'; readonly providerRefundRef: string } |
            { readonly kind: 'declined'; readonly reason: 'disputed' | 'exceedsCaptured' | 'other' }>;
  findRefund(providerRef: string, refundId: string): Promise<{ readonly providerRefundRef: string; readonly status: 'refunded' | 'pending' | 'failed' } | null>;
  refundState(providerRefundRef: string): Promise<{ readonly refundId: string; readonly status: 'refunded' | 'pending' | 'failed' }>;
  disputeState(providerDisputeRef: string): Promise<{ readonly providerRef: string; readonly status: 'open' | 'won' | 'lost'; readonly amount: Money }>;
}
export interface Clock { now(): Temporal.Instant }
export interface Ids { newId(): string }
```

Domain: `Payment { id, version, orderId, amount, idempotencyKey, providerRef | null, status:
'opening' | 'open' | 'succeeded' | 'cancelRequested' | 'cancelled', succeededAt, refunds: { refundId,
amount, reason, status: 'requested' | 'pending' | 'refunded' | 'refused', providerRefundRef,
firstAttemptAt }[], dispute: { ref, status } | null }`. Rules: refundable amount, "a disputed charge
gets no further refund", "a lost dispute counts as a refund of its amount", `providerKeyStillValid
(firstAttemptAt, now)` (23 hours), `RECONCILE_AFTER` (1 hour).

Adapters: `adapters/driven/postgres/*`; `adapters/driven/stripe/card-provider.ts` (Stripe client
built by the system builder from `stripeSecretKey`); driving `adapters/driving/next/stripe-hook.ts`
(hook), `adapters/driving/handlers/*`, `adapters/driving/scheduled/reconciliation-sweep.ts`, ops
components. Builder: `buildPayment({ config: { stripeSecretKey, stripeWebhookSecret }, pool, clock,
ids, log })` returns `{ ports, openCardPayment, handlers, scheduledTasks, outboxReaders }`.

### `fulfillment`

Driving ports:

```ts
type Msg = { readonly messageId: string };
export type AcceptShipOrder = (m: Msg & ShipOrderV1) => Promise<void>;            // command from shop
export type NoteProductSaved = (m: Msg & { readonly productId: string }) => Promise<void>;
export type RegisterArticle = (m: Msg & { readonly sku: Sku }) => Promise<void>;  // executor
export type HandOverShipment = (m: Msg & { readonly shipmentId: ShipmentId }) => Promise<void>; // executor
export type RelayStockReport = (m: Msg & { readonly sku: Sku; readonly free: number; readonly asOf: Date }) => Promise<void>;
export type AcceptStockSnapshot = (items: readonly { readonly sku: Sku; readonly free: number; readonly asOf: Date }[]) => Promise<void>;
export type RecordWarehouseShipmentReport = (m: Msg & { readonly shipmentId: ShipmentId;
  readonly lines: readonly { readonly sku: Sku; readonly shipped: number }[] }) => Promise<void>;
export type GetArticleStatus = (sku: Sku) => Promise<'unknown' | 'pending' | 'registered'>;
export type ListShipments = (filter: ShipmentFilter) => Promise<readonly ShipmentSummary[]>;
export type GetShipmentTimeline = (orderId: string) => Promise<readonly ShipmentTimelineEntry[]>;
```

Driven ports:

```ts
export interface FulfillmentTx { readonly system: 'fulfillment' }
export interface FulfillmentTransactions { run<T>(work: (tx: FulfillmentTx) => Promise<T>): Promise<T> }
export interface Articles { get(tx: FulfillmentTx, sku: Sku): Promise<Article | null>; save(tx: FulfillmentTx, a: Article): Promise<void> }
export interface Shipments {
  get(tx: FulfillmentTx, id: ShipmentId): Promise<Shipment | null>;
  findByOrder(tx: FulfillmentTx, orderId: string): Promise<Shipment | null>;
  list(tx: FulfillmentTx, filter: ShipmentFilter): Promise<readonly Shipment[]>;
  save(tx: FulfillmentTx, s: Shipment): Promise<void>;
}
export type FulfillmentOutgoing =
  | { readonly kind: 'articleRegistered'; readonly id: string; readonly article: Article }          // fulfillment.ArticleRegistered.v1
  | { readonly kind: 'freeStockReported'; readonly id: string; readonly sku: Sku; readonly free: number; readonly asOf: Date } // fulfillment.FreeStockReported.v1
  | { readonly kind: 'orderHandedOver'; readonly id: string; readonly shipment: Shipment }          // fulfillment.OrderHandedOver.v1
  | { readonly kind: 'shipmentReported'; readonly id: string; readonly shipment: Shipment }         // fulfillment.ShipmentReported.v1
  | { readonly kind: 'shipmentRejected'; readonly id: string; readonly shipment: Shipment }         // fulfillment.ShipmentRejected.v1
  | { readonly kind: 'articleRegistrationDue'; readonly id: string; readonly sku: Sku }             // private
  | { readonly kind: 'handoverDue'; readonly id: string; readonly shipmentId: ShipmentId }          // private
  | { readonly kind: 'stockItemReported'; readonly id: string; readonly sku: Sku; readonly free: number; readonly asOf: Date }; // private, from the poll
export interface FulfillmentOutbox { append(tx: FulfillmentTx, messages: readonly FulfillmentOutgoing[]): Promise<void> }
export interface FulfillmentMessageClaims { claim(tx: FulfillmentTx, handler: string, messageId: string): Promise<'first' | 'repeat'> }
export interface Warehouse {   // the 3PL, in fulfillment's terms
  registerArticle(a: { readonly sku: Sku; readonly name: string }): Promise<void>;   // PUT by sku, same made twice
  findConsignment(shipmentId: ShipmentId): Promise<{ readonly warehouseRef: string; readonly acceptedAt: Date } | null>;
  createConsignment(c: { readonly shipmentId: ShipmentId; readonly recipient: Recipient;
    readonly lines: readonly { readonly sku: Sku; readonly quantity: number }[] }):
    Promise<{ readonly kind: 'accepted'; readonly warehouseRef: string; readonly acceptedAt: Date } |
            { readonly kind: 'rejected'; readonly reason: string }>;
}
export interface ProductSource { fetch(productId: string): Promise<{ readonly sku: Sku; readonly name: string } | 'deleted'> }
export interface Clock { now(): Temporal.Instant }
export interface Ids { newId(): string }
```

Domain: `Article { sku, version, name, status: 'pending' | 'registered', registeredAt }`;
`Shipment { id, version, orderId, recipient, lines, status: 'accepted' | 'handedOver' | 'reported' |
'rejected', warehouseRef, acceptedAt, reported: { sku, ordered, shipped }[], rejection }`; rule
`consignmentRepeatPolicy = 'lookUpFirst'` (a second parcel is refused by the business), and the
reading of a 3PL report into shipped and unshipped per line.

Adapters: `adapters/driven/postgres/*`; `adapters/driven/three-pl/warehouse.ts` with
`three-pl/schema.ts` (the 3PL's published language, stated once in code); `adapters/driven/payload/
product-source.ts`; driving `adapters/driving/next/three-pl-hook.ts` (hook),
`adapters/driving/next/article-status-field.tsx` (Payload `ui` field), handlers,
`adapters/driving/scheduled/stock-poll.ts` (daily full stock listing from the 3PL, one acting call
`acceptStockSnapshot`), ops components.

### `billing`

Driving ports:

```ts
type Msg = { readonly messageId: string };
export type InvoiceShippedOrder = (m: Msg & ShippedOrder) => Promise<void>;     // from shop.OrderShipped.v1, translated
export type RecordCardRefundOutcome = (m: Msg & { readonly refundId: string; readonly outcome: 'refunded' | 'refused'; readonly reason: string | null }) => Promise<void>;
export type RecordCardDisputeLost = (m: Msg & { readonly orderId: string; readonly disputeRef: string; readonly amount: Money }) => Promise<void>;
export type GetBankPollCursor = () => Promise<BankCursor | null>;
export type AcceptBankTransfers = (batch: { readonly transfers: readonly ReportedTransfer[]; readonly cursor: BankCursor }) => Promise<void>;
export type MatchReportedTransfer = (m: Msg & { readonly transfer: ReportedTransfer }) => Promise<void>;
export type RequestDunningChecks = () => Promise<void>;                          // scheduled daily
export type AdvanceDunning = (m: Msg & { readonly invoiceId: InvoiceId }) => Promise<void>;
export type RecomputeCustomerStanding = (m: Msg & { readonly email: EmailAddress }) => Promise<void>;
export type SendDocumentMail = (m: Msg & { readonly document: DocumentMail }) => Promise<void>;
export type RequestRefundAnswerChecks = () => Promise<void>;                     // scheduled hourly
export type ExpireRefundRequest = (m: Msg & { readonly refundRequestId: string }) => Promise<void>;
// operators
export type RefundInvoice = (input: { readonly refundRequestId: string;          // idempotency key from the form
  readonly invoiceNumber: string; readonly scope: { readonly kind: 'full' } |
  { readonly kind: 'lines'; readonly lines: readonly { readonly lineNo: number; readonly quantity: number }[] };
  readonly operator: string }) => Promise<Result<{ readonly status: 'credited' | 'awaitingCardRefund' }, RefundInvoiceRefusal>>;
export type AssignTransfer = (input: { readonly transferId: string; readonly allocations:
  readonly { readonly invoiceNumber: string; readonly amount: Money }[]; readonly operator: string }) => Promise<Result<void, AssignRefusal>>;
export type MarkTransferPaidBack = (input: { readonly transferId: string; readonly operator: string }) => Promise<Result<void, TransferRefusal>>;
export type RecordPayback = (input: { readonly paybackId: string; readonly invoiceNumber: string; readonly amount: Money; readonly paidOn: string; readonly operator: string }) => Promise<Result<void, PaybackRefusal>>;
export type TakeOverInvoice = (input: { readonly invoiceNumber: string; readonly operator: string }) => Promise<Result<void, TakeOverRefusal>>;
export type GetBillingTimeline = (orderId: string) => Promise<readonly BillingTimelineEntry[]>;
export type ListInvoices = (f: InvoiceFilter) => Promise<readonly InvoiceSummary[]>;
export type ListCreditNotes = (f: CreditNoteFilter) => Promise<readonly CreditNoteSummary[]>;
export type ListTransfers = (f: TransferFilter) => Promise<readonly TransferSummary[]>;
export type RenderDocument = (documentNumber: string) => Promise<Uint8Array | null>;
```

Driven ports:

```ts
export interface BillingTx { readonly system: 'billing' }
export interface BillingTransactions { run<T>(work: (tx: BillingTx) => Promise<T>): Promise<T> }
export interface Invoices {
  get(tx: BillingTx, id: InvoiceId): Promise<Invoice | null>;
  byNumber(tx: BillingTx, n: string): Promise<Invoice | null>;
  byOrder(tx: BillingTx, orderId: string): Promise<Invoice | null>;
  openByEmail(tx: BillingTx, email: EmailAddress): Promise<readonly Invoice[]>;
  listDunningDue(tx: BillingTx, today: Temporal.PlainDate, limit: number): Promise<readonly { readonly id: InvoiceId; readonly step: DunningStep }[]>;
  save(tx: BillingTx, invoice: Invoice): Promise<void>;
}
export interface CreditNotes { save(tx: BillingTx, c: CreditNote): Promise<void>; byInvoice(tx: BillingTx, id: InvoiceId): Promise<readonly CreditNote[]> }
export interface NumberSeries { get(tx: BillingTx, kind: 'invoice' | 'creditNote', year: number): Promise<Series>; save(tx: BillingTx, s: Series): Promise<void> }
export interface BankTransfers { get(tx: BillingTx, id: string): Promise<BankTransfer | null>; save(tx: BillingTx, t: BankTransfer): Promise<void>; list(tx: BillingTx, f: TransferFilter): Promise<readonly BankTransfer[]> }
export interface BankPollState { get(tx: BillingTx): Promise<BankPoll | null>; save(tx: BillingTx, p: BankPoll): Promise<void> }
export interface RefundRequests { get(tx: BillingTx, id: string): Promise<RefundRequest | null>; listAnswerOverdue(tx: BillingTx, now: Temporal.Instant, limit: number): Promise<readonly string[]>; save(tx: BillingTx, r: RefundRequest): Promise<void> }
export interface CustomerStandings { get(tx: BillingTx, email: EmailAddress): Promise<CustomerStanding | null>; save(tx: BillingTx, s: CustomerStanding): Promise<void> }
export interface SentDocuments { record(tx: BillingTx, d: SentDocument): Promise<void>; listByOrder(tx: BillingTx, orderId: string): Promise<readonly SentDocument[]> }
export type BillingOutgoing =
  | { readonly kind: 'customerDunningChanged'; readonly id: string; readonly standing: CustomerStanding } // billing.CustomerDunningStatusChanged.v1
  | { readonly kind: 'cardRefundRequested'; readonly id: string; readonly request: RefundRequest }          // payment.RefundCardPayment.v1
  | { readonly kind: 'transferReported'; readonly id: string; readonly transfer: ReportedTransfer }        // private
  | { readonly kind: 'dunningStepDue'; readonly id: string; readonly invoiceId: InvoiceId }               // private
  | { readonly kind: 'standingRecomputeDue'; readonly id: string; readonly email: EmailAddress }          // private
  | { readonly kind: 'documentMailDue'; readonly id: string; readonly document: DocumentMail }            // private
  | { readonly kind: 'refundAnswerOverdue'; readonly id: string; readonly refundRequestId: string };      // private
export interface BillingOutbox { append(tx: BillingTx, messages: readonly BillingOutgoing[]): Promise<void> }
export interface BillingMessageClaims { claim(tx: BillingTx, handler: string, messageId: string): Promise<'first' | 'repeat'> }
export interface DocumentRenderer { render(doc: RenderableDocument): Promise<Uint8Array> }  // pdfkit, in-process
export interface MailSender { send(mail: RenderedMail): Promise<void> }
export interface Clock { now(): Temporal.Instant }
export interface Ids { newId(): string }
```

Domain: `Invoice { id, version, number, orderId, email, address, issuedOn: PlainDate, settlement:
'prepaidByCard' | 'dueIn14Days', dueOn, lines: { lineNo, sku, title, quantity, unitGross, taxClass,
vatRate }[], credits: { creditNoteId, amount }[], payments: { ref, amount, kind: 'card' | 'transfer'
| 'payback' }[], dunning: { step: 'none' | 'pastDue' | 'reminder1' | 'reminder2' | 'final' |
'withOperators', nextOn }, takenOverBy }` with `openAmount()` = total less credits less payments;
`CreditNote`; `Series { kind, year, next, version }`; `BankTransfer { id (bank's), amount, reference,
bookedOn, status: 'unassigned' | 'matched' | 'assigned' | 'paidBack', allocations }`; `RefundRequest
{ id, invoiceId, lines, amount, status: 'awaitingCardRefund' | 'credited' | 'refused' |
'withOperators', answerDueBy }`; `CustomerStanding { email, version, inDunning }`. Rules: VAT rate
by tax class and date (`tea` 7 %, `accessories` 19 %), net and VAT per rate from gross, due 14 days,
dunning offsets 7/14/14/14, reference matching (`RE-YYYY-NNNNN`), number formats, `BILLING_TZ =
'Europe/Berlin'`, `REFUND_ANSWER_WAIT = 72 h`, `BILLING_SENDER`, `mailRepeatPolicy = 'accept'`.

Adapters: `adapters/driven/postgres/*`, `adapters/driven/pdf/document-renderer.ts`,
`adapters/driven/mail/mail-sender.ts`; driving `adapters/driving/scheduled/bank-poll.ts` (every 5
minutes: answering call `getBankPollCursor`, bank API listing from cursor minus one day of overlap,
one acting call `acceptBankTransfers`), `scheduled/dunning-sweep.ts` (daily 05:00 UTC),
`scheduled/refund-answer-sweep.ts` (hourly), handlers, ops server actions and components.

### Payload (`@tea/cms`, external system configuration)

- Collection `products`: `title`, `description` (Lexical), `images` (upload, `media`), `slug`
  (unique), `priceCents` (number, integer, `validate: v => v > 0`), `sku` (text, `unique: true`,
  field `access.update: () => false`, `beforeChange` hook refusing a changed sku through any API),
  `taxClass` (`select`: `tea`, `accessories`), `ui` fields `availableStock` →
  `@tea/shop/next#AvailableStockField` and `articleStatus` → `@tea/fulfillment/next#ArticleStatusField`.
- Collection `cms_outbox` (hidden, no admin access): `messageId`, `type`, `payload` (json),
  `relayedAt`. `afterChange` and `afterDelete` hooks on `products` call `req.payload.create({
  collection: 'cms_outbox', data, req })`, passing `req` so the row commits in Payload's own
  transaction.
- Published language (`@tea/cms/published`): generated `payload-types.ts` and
  `product-notices.v1.ts` (`cms.ProductSaved.v1 { productId }`, `cms.ProductDeleted.v1 { productId }`).
- Outbox reader (`@tea/cms/outbox-reader`): `createCmsOutboxReader(pool)`, provided by assembly.

### Ways in from outside, summarized

| Way in | Driving adapter | System | Driving port(s) |
|---|---|---|---|
| Storefront pages, server actions | `@tea/shop/next` | `shop` | storefront ports, `setCartLine`, `checkout` |
| Payload admin `ui` fields | `AvailableStockField`, `ArticleStatusField` | `shop`, `fulfillment` | `getAvailableStock`, `getArticleStatus` |
| `/ops/**` pages and actions | each system's `next/ops/*` component | each | its timeline, list and operator ports |
| `POST /api/hooks/stripe` | hook `stripe-hook.ts` | `payment` | `recordStripeNotice` |
| `POST /api/hooks/3pl` | hook `three-pl-hook.ts` | `fulfillment` | `relayStockReport`, `recordWarehouseShipmentReport` |
| bus | handlers | each | message-driven ports |
| clock | scheduled tasks | each | sweep and poll ports |

## Calls and messages

### Calls between systems (all synchronous)

| Caller → callee | What | When | Refusal / failure back |
|---|---|---|---|
| `shop` (driven adapter `CardPayments`) → `payment` open host service `OpenCardPayment`, in-process | open the card payment for an order, get `client_secret` | in `checkout`, after `shop`'s transaction committed the order; again on every repeat of checkout | refusal in-band: `{ ok: false, error: { code: 'paymentClosed' } }` → `shop` answers `orderClosed`; failure (Stripe down) throws, checkout throws, the server action answers "payment unavailable, retry", the order waits under its payment deadline |
| `payment` → Stripe API | create intent (key `pi:{paymentId}`), retrieve intent, search intent by metadata, cancel intent, create refund (key `refund:{refundId}`), list refunds, retrieve refund, retrieve dispute | in `openCardPayment` after commit; in executors and notice handling | Stripe error codes mapped in `card-provider.ts`: `charge_disputed`, `amount_too_large` → `declined` (a refusal, committed as outcome); network, 5xx, rate limit → throw (failure, retried) |
| `fulfillment` → 3PL API | `PUT /articles/{sku}`, `GET /orders?reference=`, `POST /orders` | in executors `registerArticle`, `handOverShipment`; daily stock listing in the poll | 4xx validation on `POST /orders` → `rejected` (refusal, committed); 5xx, timeout → throw |
| `billing` (scheduled task) → bank API | list transfers since cursor | every 5 minutes | failure: the run throws, the next run tries again from the same cursor |
| `shop`, `billing` → mail provider | send mail (with PDF attachment for `billing`) | in mail handlers | failure throws, bus retries; no key, a repeat is accepted by rule |
| `shop`, `fulfillment` → Payload Local API | `findByID('products')` | in `syncCatalogItem`, `noteProductSaved` | not found → `'deleted'`; failure throws |
| Stripe → `payment` hook | webhook event | Stripe's | 400 on bad signature (withheld), 500 when the use case throws (Stripe resends), 200 after commit |
| 3PL → `fulfillment` hook | stock changed, order shipped | 3PL's | 401 bad HMAC, 422 unparseable, 500 on failure, 200 after commit |

No other synchronous call crosses a system. In particular `shop` never calls `billing` (it keeps a
replica of the dunning flag) and never calls `fulfillment` (commands and events only).

### Messages

All messages go through an outbox in the writer's transaction, the relay, the `pg-boss` bus, one
queue per handler. Asynchronous, at least once, any order.

| Message | Kind | Writer (outbox) | Subscribers (handler → driving port) | Refusal back |
|---|---|---|---|---|
| `cms.ProductSaved.v1 { productId }` | event, notice | Payload (`cms_outbox`) | `shop.catalog-sync` → `syncCatalogItem`; `fulfillment.product-saved` → `noteProductSaved` | events are not refused |
| `cms.ProductDeleted.v1 { productId }` | event, notice | Payload | same two | — |
| `fulfillment.ArticleRegistered.v1 { sku, articleVersion }` | event | `fulfillment` | `shop.article-registered` → `markArticleRegistered` | — |
| `fulfillment.FreeStockReported.v1 { sku, free, asOf }` | event | `fulfillment` | `shop.free-stock` → `recordFreeStock` | — |
| `fulfillment.ShipOrder.v1 { shipmentRequestId, orderId, recipient{name, street, postalCode, city, email}, lines[{sku, quantity}] }` | command, `fulfillment`'s published language | `shop` | `fulfillment.ship-order` → `acceptShipOrder` | `fulfillment.ShipmentRejected.v1` |
| `fulfillment.OrderHandedOver.v1 { orderId, shipmentId, acceptedAt, skus, shipmentVersion }` | event | `fulfillment` | `shop.handover` → `recordHandover` | — |
| `fulfillment.ShipmentReported.v1 { orderId, shipmentId, lines[{sku, ordered, shipped}], shipmentVersion }` | event | `fulfillment` | `shop.shipment-reported` → `recordShipmentReport` | — |
| `fulfillment.ShipmentRejected.v1 { orderId, shipmentId, reason, shipmentVersion }` | event (the refusal of `ShipOrder`) | `fulfillment` | `shop.shipment-rejected` → `recordShipmentRejected` | — |
| `payment.CardPaymentSucceeded.v1 { paymentId, orderId, amountCents, currency, succeededAt }` | event | `payment` | `shop.card-paid` → `recordCardPaymentSucceeded` | — |
| `payment.RefundCardPayment.v1 { refundId, orderId, amountCents, currency, reason }` | command, `payment`'s published language | `shop`, `billing` | `payment.refund` → `requestCardRefund` | `payment.CardRefundRefused.v1` |
| `payment.CancelCardPayment.v1 { orderId }` | command | `shop` | `payment.cancel` → `requestCardPaymentCancel` | not refused; an intent already paid answers by `CardPaymentSucceeded` |
| `payment.CardRefunded.v1 { refundId, orderId, amountCents, currency }` | event | `payment` | `shop.card-refund-outcome`, `billing.card-refund-outcome` → `recordCardRefundOutcome` (each ignores a `refundId` it did not record) | — |
| `payment.CardRefundRefused.v1 { refundId, orderId, reason }` | event | `payment` | same two | — |
| `payment.CardDisputeLost.v1 { orderId, disputeRef, amountCents, currency }` | event | `payment` | `billing.dispute-lost` → `recordCardDisputeLost` | — |
| `shop.OrderShipped.v1 { orderId, email, address, paymentMethod: 'card' \| 'invoice', placedAt, lines[{sku, title, quantity, unitPriceGrossCents, taxClass: 'tea' \| 'accessories'}] }` | event | `shop` | `billing.order-shipped` → `invoiceShippedOrder` | — |
| `billing.CustomerDunningStatusChanged.v1 { email, inDunning, version }` | event | `billing` | `shop.customer-dunning` → `recordCustomerDunning` | — |
| `shop.private.ReservationReleaseDue`, `shop.private.ReservationHandedOver`, `shop.private.PaymentDeadlineReached`, `shop.private.HandoverDeadlineReached`, `shop.private.CustomerMailDue` | private | `shop` | `shop`'s own handlers → `releaseReservation`, `markReservationHandedOver`, `expireUnpaidOrder`, `flagOverdueHandover`, `sendCustomerMail` | — |
| `payment.private.ProviderRefundDue`, `IntentCancelDue`, `ReconciliationDue` | private | `payment` | → `executeProviderRefund`, `executeIntentCancel`, `reconcilePayment` | — |
| `fulfillment.private.ArticleRegistrationDue`, `HandoverDue`, `StockItemReported` | private | `fulfillment` | → `registerArticle`, `handOverShipment`, `relayStockReport` | — |
| `billing.private.TransferReported`, `DunningStepDue`, `StandingRecomputeDue`, `DocumentMailDue`, `RefundAnswerOverdue` | private | `billing` | → `matchReportedTransfer`, `advanceDunning`, `recomputeCustomerStanding`, `sendDocumentMail`, `expireRefundRequest` | — |

Message ids: uuid v7 from the `Ids` port, except where the message must be written at most once
for one fact, where it is uuid v5 of a name: `expire:{orderId}`, `handover-overdue:{orderId}`,
`release:{orderId}:{sku}`, `handed-over:{orderId}:{sku}`, `dunning:{invoiceId}:{step}`,
`refund-overdue:{refundRequestId}`, `bank:{bankTransferId}`, `3pl-stock:{sku}:{asOf}`,
`stripe:{eventId}` and `3pl:{eventId}` for hooks. The outbox insert does nothing on a conflicting id.

## Processes

| Process | Command | Entry point | Runs |
|---|---|---|---|
| `web` (2+ replicas) | `next start` | `apps/web/instrumentation.ts` `register()` → `apps/web/src/assembly.ts` | storefront, Payload admin and REST, ops pages, Stripe and 3PL hooks |
| `worker` (2 replicas) | `node apps/worker/dist/main.js` | `apps/worker/src/main.ts` → `apps/worker/src/assembly.ts` | relay (one active, Postgres advisory lock), `pg-boss` workers for every handler, `pg-boss` schedules for every scheduled task |
| `migrate` (job before each deploy, tooling) | `node tools/migrate/dist/main.js` | `tools/migrate/src/main.ts` | roles and grants, each system's Drizzle migrations, Payload migrations, `pg-boss` schema |

Assembly of `worker` (the `web` one is the same without bus, relay and schedules, and with
`migrate: false` on nothing it starts):

```ts
// apps/worker/src/assembly.ts
import { Pool } from 'pg';
import PgBoss from 'pg-boss';
import { getPayload } from 'payload';
import cmsConfig from '@tea/cms/config';
import { createCmsOutboxReader } from '@tea/cms/outbox-reader';
import { buildPayment } from '@tea/payment/builder';
import { buildShop } from '@tea/shop/builder';
import { buildFulfillment } from '@tea/fulfillment/builder';
import { buildBilling } from '@tea/billing/builder';
import { createPgBossBus, startRelay, scheduleTasks } from '@tea/lib/messaging';
import { systemClock } from '@tea/lib/clock';
import { uuidV7Ids } from '@tea/lib/ids';
import { createPinoLog } from '@tea/lib/log';
import type { WorkerConfig } from './config';

export async function assemble(config: WorkerConfig): Promise<{ stop(): Promise<void> }> {
  const log = createPinoLog(config.log);
  const payload = await getPayload({ config: cmsConfig });
  const common = { clock: systemClock, ids: uuidV7Ids, log };

  const payment = buildPayment({ ...common, config: config.payment, pool: new Pool(config.db.payment) });
  const shop = buildShop({ ...common, config: config.shop, pool: new Pool(config.db.shop), payload,
    openCardPayment: payment.openCardPayment });
  const fulfillment = buildFulfillment({ ...common, config: config.fulfillment, pool: new Pool(config.db.fulfillment), payload });
  const billing = buildBilling({ ...common, config: config.billing, pool: new Pool(config.db.billing) });
  const systems = [payment, shop, fulfillment, billing];

  const boss = new PgBoss({ connectionString: config.db.boss, migrate: false });
  await boss.start();
  const bus = createPgBossBus(boss, { retryLimit: 20, retryBackoff: true, deadLetter: 'parked' });
  await bus.subscribe(systems.flatMap((s) => s.handlers));
  const relay = startRelay({
    readers: [...systems.flatMap((s) => s.outboxReaders), createCmsOutboxReader(new Pool(config.db.cmsOutbox))],
    bus, lockPool: new Pool(config.db.relayLock), intervalMs: 500, log,
  });
  await scheduleTasks(boss, systems.flatMap((s) => s.scheduledTasks));
  return { stop: async () => { await relay.stop(); await boss.stop(); } };
}
```

Configuration values: each process parses `process.env` once, in `apps/*/src/config.ts`, with a
`zod` schema: one database URL per role (`shop_rw`, `payment_rw`, `fulfillment_rw`, `billing_rw`,
`payload_rw`, `boss_rw`, `cms_outbox_reader`), Stripe secret and webhook secret, 3PL base URL, API
key and webhook secret, bank base URL and credentials, mail API key and base URL, public base URL,
OTel exporter endpoint, log level, Payload secret. No business number is among them.

Courier: each system has `src/adapters/driving/courier.ts` exporting `readShopPorts()` (and so on),
reading `globalThis.__teaShopPorts` (declared `var` in `declare global`, so Next.js bundling twice
still finds one slot), throwing until filled; and `courier-fill.ts` exporting `fillShopPorts()`,
which only `builder.ts` may import. Next.js driving adapters call `readShopPorts()` inside each
invocation. `apps/web/src/process-courier.ts` carries the backlog probe for `/ops/delays` the same way.

Migrations: `tools/migrate` runs `sql/0000_roles.sql` (schemas `shop`, `payment`, `fulfillment`,
`billing`, `payload`, `pgboss`; one role per schema with rights on its schema only;
`cms_outbox_reader` with select and update on `payload.cms_outbox` only), then
`drizzle-orm/node-postgres/migrator` per system folder `packages/<system>/src/adapters/driven/
postgres/migrations` with `migrationsSchema: '<system>'`, then `payload migrate`, then `new PgBoss({
migrate: true })` started and stopped. Migrations are generated by `drizzle-kit generate` from each
system's `schema.ts` and committed; every change is expand, deploy, contract (P14).

## Directory tree

```
tea-shop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
├── .dependency-cruiser.cjs
├── vitest.workspace.ts
├── docker-compose.yml
├── Dockerfile
├── packages/
│   ├── kernel/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── GLOSSARY.md
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── money.ts
│   │   │   └── email-address.ts
│   │   └── test/
│   │       ├── money.test.ts
│   │       └── email-address.test.ts
│   ├── lib/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── result.ts
│   │   │   ├── courier.ts
│   │   │   ├── clock/system-clock.ts
│   │   │   ├── ids/uuid-v7.ts
│   │   │   ├── ids/uuid-v5.ts
│   │   │   ├── log.ts
│   │   │   ├── mail-provider/client.ts
│   │   │   ├── messaging/index.ts
│   │   │   ├── messaging/envelope.ts
│   │   │   ├── messaging/handler.ts
│   │   │   ├── messaging/outbox-reader.ts
│   │   │   ├── messaging/relay.ts
│   │   │   ├── messaging/pg-boss-bus.ts
│   │   │   ├── messaging/scheduler.ts
│   │   │   ├── messaging/backlog-probe.ts
│   │   │   ├── postgres/outbox-tables.ts
│   │   │   └── testing/port-suite.ts
│   │   └── test/
│   │       └── messaging/relay.test.ts
│   ├── cms/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── payload.config.ts
│   │   │   ├── collections/products.ts
│   │   │   ├── collections/media.ts
│   │   │   ├── collections/users.ts
│   │   │   ├── collections/cms-outbox.ts
│   │   │   ├── hooks/write-product-notice.ts
│   │   │   ├── hooks/keep-sku-fixed.ts
│   │   │   ├── published/index.ts
│   │   │   ├── published/payload-types.ts
│   │   │   ├── published/product-notices.v1.ts
│   │   │   └── outbox-reader.ts
│   │   └── migrations/
│   │       └── 20261106_000000_init.ts
│   ├── shop/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.domain.json
│   │   ├── GLOSSARY.md
│   │   ├── src/
│   │   │   ├── builder.ts
│   │   │   ├── domain/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ids.ts
│   │   │   │   ├── constants.ts
│   │   │   │   ├── german-address.ts
│   │   │   │   ├── catalog-item.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── stock.ts
│   │   │   │   ├── order.ts
│   │   │   │   ├── place-order.ts
│   │   │   │   ├── payment-options.ts
│   │   │   │   ├── customer-dunning.ts
│   │   │   │   ├── customer-mail.ts
│   │   │   │   └── repeat-policies.ts
│   │   │   ├── published/
│   │   │   │   ├── index.ts
│   │   │   │   └── order-shipped.v1.ts
│   │   │   ├── ports/
│   │   │   │   ├── driving.ts
│   │   │   │   └── driven.ts
│   │   │   ├── services/
│   │   │   │   ├── storefront-queries.ts
│   │   │   │   ├── get-available-stock.ts
│   │   │   │   ├── order-queries.ts
│   │   │   │   ├── set-cart-line.ts
│   │   │   │   ├── checkout.ts
│   │   │   │   ├── sync-catalog-item.ts
│   │   │   │   ├── mark-article-registered.ts
│   │   │   │   ├── record-free-stock.ts
│   │   │   │   ├── record-handover.ts
│   │   │   │   ├── mark-reservation-handed-over.ts
│   │   │   │   ├── release-reservation.ts
│   │   │   │   ├── record-shipment-report.ts
│   │   │   │   ├── record-shipment-rejected.ts
│   │   │   │   ├── record-card-payment-succeeded.ts
│   │   │   │   ├── record-card-refund-outcome.ts
│   │   │   │   ├── record-customer-dunning.ts
│   │   │   │   ├── request-deadline-checks.ts
│   │   │   │   ├── expire-unpaid-order.ts
│   │   │   │   ├── flag-overdue-handover.ts
│   │   │   │   └── send-customer-mail.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/
│   │   │   │   │   ├── postgres/
│   │   │   │   │   │   ├── schema.ts
│   │   │   │   │   │   ├── tx.ts
│   │   │   │   │   │   ├── carts.ts
│   │   │   │   │   │   ├── orders.ts
│   │   │   │   │   │   ├── stock-levels.ts
│   │   │   │   │   │   ├── catalog-items.ts
│   │   │   │   │   │   ├── customer-dunning.ts
│   │   │   │   │   │   ├── sent-mails.ts
│   │   │   │   │   │   ├── outbox.ts
│   │   │   │   │   │   ├── message-claims.ts
│   │   │   │   │   │   └── migrations/
│   │   │   │   │   │       ├── 0000_init.sql
│   │   │   │   │   │       └── meta/_journal.json
│   │   │   │   │   ├── payment/card-payments.ts
│   │   │   │   │   ├── payload/product-source.ts
│   │   │   │   │   └── mail/
│   │   │   │   │       ├── mail-sender.ts
│   │   │   │   │       └── templates/
│   │   │   │   │           ├── order-confirmation.ts
│   │   │   │   │           ├── order-cancelled.ts
│   │   │   │   │           ├── lines-dropped.ts
│   │   │   │   │           └── card-refunded.ts
│   │   │   │   └── driving/
│   │   │   │       ├── courier.ts
│   │   │   │       ├── courier-fill.ts
│   │   │   │       ├── handlers/
│   │   │   │       │   ├── catalog-sync.ts
│   │   │   │       │   ├── article-registered.ts
│   │   │   │       │   ├── free-stock.ts
│   │   │   │       │   ├── handover.ts
│   │   │   │       │   ├── shipment-reported.ts
│   │   │   │       │   ├── shipment-rejected.ts
│   │   │   │       │   ├── card-paid.ts
│   │   │   │       │   ├── card-refund-outcome.ts
│   │   │   │       │   ├── customer-dunning.ts
│   │   │   │       │   └── private.ts
│   │   │   │       ├── scheduled/deadline-sweep.ts
│   │   │   │       └── next/
│   │   │   │           ├── index.ts
│   │   │   │           ├── storefront.ts
│   │   │   │           ├── cart-actions.ts
│   │   │   │           ├── checkout-action.ts
│   │   │   │           ├── available-stock-field.tsx
│   │   │   │           └── ops/
│   │   │   │               ├── order-timeline.tsx
│   │   │   │               └── orders-table.tsx
│   │   │   └── fakes/
│   │   │       ├── in-memory-store.ts
│   │   │       ├── transactions.ts
│   │   │       ├── repositories.ts
│   │   │       ├── outbox.ts
│   │   │       ├── message-claims.ts
│   │   │       ├── card-payments.ts
│   │   │       ├── product-source.ts
│   │   │       ├── mail-sender.ts
│   │   │       ├── clock.ts
│   │   │       └── ids.ts
│   │   └── test/
│   │       ├── domain/place-order.test.ts
│   │       ├── domain/stock.test.ts
│   │       ├── domain/order.test.ts
│   │       ├── services/checkout.test.ts
│   │       ├── services/record-shipment-report.test.ts
│   │       ├── services/expire-unpaid-order.test.ts
│   │       ├── services/record-card-payment-succeeded.test.ts
│   │       └── ports/
│   │           ├── orders.suite.ts
│   │           ├── orders.test.ts
│   │           ├── stock-levels.suite.ts
│   │           ├── stock-levels.test.ts
│   │           ├── transactions.suite.ts
│   │           ├── transactions.test.ts
│   │           ├── outbox.suite.ts
│   │           ├── outbox.test.ts
│   │           ├── card-payments.suite.ts
│   │           └── card-payments.test.ts
│   ├── payment/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.domain.json
│   │   ├── GLOSSARY.md
│   │   ├── src/
│   │   │   ├── builder.ts
│   │   │   ├── domain/{index.ts, ids.ts, payment.ts, refund.ts, dispute.ts, constants.ts}
│   │   │   ├── published/{index.ts, open-card-payment.v1.ts, card-payment-succeeded.v1.ts, refund-card-payment.v1.ts, cancel-card-payment.v1.ts, card-refunded.v1.ts, card-refund-refused.v1.ts, card-dispute-lost.v1.ts, fakes.ts}
│   │   │   ├── ports/{driving.ts, driven.ts}
│   │   │   ├── services/{open-card-payment.ts, record-stripe-notice.ts, request-card-refund.ts, request-card-payment-cancel.ts, execute-provider-refund.ts, execute-intent-cancel.ts, request-payment-reconciliation.ts, reconcile-payment.ts, payment-queries.ts}
│   │   │   ├── adapters/driven/postgres/{schema.ts, tx.ts, payments.ts, outbox.ts, message-claims.ts, migrations/}
│   │   │   ├── adapters/driven/stripe/card-provider.ts
│   │   │   ├── adapters/driving/{courier.ts, courier-fill.ts}
│   │   │   ├── adapters/driving/handlers/{refund.ts, cancel.ts, private.ts}
│   │   │   ├── adapters/driving/scheduled/reconciliation-sweep.ts
│   │   │   ├── adapters/driving/next/{index.ts, stripe-hook.ts, ops/payment-timeline.tsx}
│   │   │   └── fakes/{transactions.ts, payments.ts, outbox.ts, message-claims.ts, card-provider.ts, clock.ts, ids.ts}
│   │   └── test/{domain/payment.test.ts, services/*.test.ts, ports/{payments,card-provider,open-card-payment}.suite.ts + .test.ts}
│   ├── fulfillment/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.domain.json
│   │   ├── GLOSSARY.md
│   │   ├── src/
│   │   │   ├── builder.ts
│   │   │   ├── domain/{index.ts, ids.ts, article.ts, shipment.ts, recipient.ts, repeat-policies.ts}
│   │   │   ├── published/{index.ts, ship-order.v1.ts, article-registered.v1.ts, free-stock-reported.v1.ts, order-handed-over.v1.ts, shipment-reported.v1.ts, shipment-rejected.v1.ts}
│   │   │   ├── ports/{driving.ts, driven.ts}
│   │   │   ├── services/{accept-ship-order.ts, note-product-saved.ts, register-article.ts, hand-over-shipment.ts, relay-stock-report.ts, accept-stock-snapshot.ts, record-warehouse-shipment-report.ts, fulfillment-queries.ts}
│   │   │   ├── adapters/driven/postgres/{schema.ts, tx.ts, articles.ts, shipments.ts, outbox.ts, message-claims.ts, migrations/}
│   │   │   ├── adapters/driven/three-pl/{warehouse.ts, schema.ts, client.ts}
│   │   │   ├── adapters/driven/payload/product-source.ts
│   │   │   ├── adapters/driving/{courier.ts, courier-fill.ts}
│   │   │   ├── adapters/driving/handlers/{ship-order.ts, product-saved.ts, private.ts}
│   │   │   ├── adapters/driving/scheduled/stock-poll.ts
│   │   │   ├── adapters/driving/next/{index.ts, three-pl-hook.ts, article-status-field.tsx, ops/shipments-table.tsx, ops/shipment-timeline.tsx}
│   │   │   └── fakes/{transactions.ts, articles.ts, shipments.ts, outbox.ts, message-claims.ts, warehouse.ts, product-source.ts, clock.ts, ids.ts}
│   │   └── test/{domain/shipment.test.ts, services/*.test.ts, ports/{shipments,warehouse}.suite.ts + .test.ts}
│   └── billing/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.domain.json
│       ├── GLOSSARY.md
│       ├── src/
│       │   ├── builder.ts
│       │   ├── domain/{index.ts, ids.ts, constants.ts, vat.ts, invoice.ts, credit-note.ts, number-series.ts, dunning.ts, bank-transfer.ts, transfer-matching.ts, refund-request.ts, customer-standing.ts, document-mail.ts, repeat-policies.ts}
│       │   ├── published/{index.ts, customer-dunning-status-changed.v1.ts}
│       │   ├── ports/{driving.ts, driven.ts}
│       │   ├── services/{invoice-shipped-order.ts, record-card-refund-outcome.ts, record-card-dispute-lost.ts, accept-bank-transfers.ts, match-reported-transfer.ts, request-dunning-checks.ts, advance-dunning.ts, recompute-customer-standing.ts, send-document-mail.ts, request-refund-answer-checks.ts, expire-refund-request.ts, refund-invoice.ts, assign-transfer.ts, mark-transfer-paid-back.ts, record-payback.ts, take-over-invoice.ts, billing-queries.ts}
│       │   ├── adapters/driven/postgres/{schema.ts, tx.ts, invoices.ts, credit-notes.ts, number-series.ts, bank-transfers.ts, bank-poll-state.ts, refund-requests.ts, customer-standings.ts, sent-documents.ts, outbox.ts, message-claims.ts, migrations/}
│       │   ├── adapters/driven/pdf/{document-renderer.ts, layouts/invoice.ts, layouts/credit-note.ts, layouts/reminder.ts}
│       │   ├── adapters/driven/mail/{mail-sender.ts, templates/*.ts}
│       │   ├── adapters/driving/{courier.ts, courier-fill.ts}
│       │   ├── adapters/driving/handlers/{order-shipped.ts, card-refund-outcome.ts, dispute-lost.ts, private.ts}
│       │   ├── adapters/driving/scheduled/{bank-poll.ts, bank-api.ts, dunning-sweep.ts, refund-answer-sweep.ts}
│       │   ├── adapters/driving/next/{index.ts, ops/invoices.tsx, ops/credit-notes.tsx, ops/transfers.tsx, ops/billing-timeline.tsx, ops/actions.ts, ops/document-route.ts}
│       │   └── fakes/{transactions.ts, repositories.ts, outbox.ts, message-claims.ts, document-renderer.ts, mail-sender.ts, clock.ts, ids.ts}
│       └── test/{domain/{vat,invoice,dunning,transfer-matching,number-series}.test.ts, services/*.test.ts, ports/{invoices,number-series,bank-transfers}.suite.ts + .test.ts}
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── instrumentation.ts
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── assembly.ts
│   │   │   └── process-courier.ts
│   │   └── app/
│   │       ├── (shop)/layout.tsx
│   │       ├── (shop)/page.tsx
│   │       ├── (shop)/products/[slug]/page.tsx
│   │       ├── (shop)/cart/page.tsx
│   │       ├── (shop)/checkout/page.tsx
│   │       ├── (payload)/layout.tsx
│   │       ├── (payload)/admin/[[...segments]]/page.tsx
│   │       ├── (payload)/admin/importMap.js
│   │       ├── (payload)/api/[...slug]/route.ts
│   │       ├── (ops)/ops/layout.tsx
│   │       ├── (ops)/ops/orders/page.tsx
│   │       ├── (ops)/ops/orders/[orderId]/page.tsx
│   │       ├── (ops)/ops/invoices/page.tsx
│   │       ├── (ops)/ops/credit-notes/page.tsx
│   │       ├── (ops)/ops/transfers/page.tsx
│   │       ├── (ops)/ops/shipments/page.tsx
│   │       ├── (ops)/ops/documents/[number]/route.ts
│   │       ├── (ops)/ops/delays/page.tsx
│   │       ├── api/hooks/stripe/route.ts
│   │       ├── api/hooks/3pl/route.ts
│   │       └── api/health/route.ts
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── config.ts
│           └── assembly.ts
└── tools/
    └── migrate/
        ├── package.json
        ├── sql/0000_roles.sql
        └── src/main.ts
```

Package exports: `@tea/shop` exports `./published`, `./builder`, `./next`; `@tea/payment` exports
`./published`, `./fakes`, `./builder`, `./next`; `@tea/fulfillment` and `@tea/billing` export
`./published`, `./builder`, `./next`. Nothing else resolves. Each file under `apps/web/app/` that
belongs to a system is one line, e.g. `export { POST } from '@tea/payment/next/stripe-hook'`.
`dependency-cruiser` allows `./builder` only from `apps/*/src/assembly.ts` and `tools/**`, and
`./next` only from `apps/web/app/**` and `packages/cms/src/collections/products.ts` (the `ui` field
paths).

## How each property holds

**P1.** Each system's `src/domain/**` may import, by a closed `dependency-cruiser` allowlist that
counts `import type`, only its own `src/domain/**`, `@tea/kernel`, `zod` and
`@js-temporal/polyfill`; anything else, including `@tea/lib`, its own `published/`, `ports/`,
`services/`, `adapters/`, another system's offer and every `node:` module, fails CI. Each domain is
also compiled by `tsconfig.domain.json` with `lib: ["ES2023"]` and `types: []`, so `Buffer`,
`process`, `window` and DOM types do not exist there. The domain takes time as `Temporal.Instant`
and ids as arguments. Payload's generated `Product`, Stripe's types and the 3PL schema stop at the
adapters; no system conforms, so the exception is unused.

**P2.** Every business rule is stated once in a system's domain (`constants.ts`, the aggregates,
`place-order.ts`, `vat.ts`, `dunning.ts`, `transfer-matching.ts`, `repeat-policies.ts`), with its
numbers as constants there: 30 minutes, 48 hours, 14 days, 7/14/14/14, 7 % and 19 %, 72 hours,
`Europe/Berlin`. Record shapes are `zod` schemas in the domain with types inferred from them; Postgres
adapters parse rows with those schemas, and Next.js driving adapters parse forms with them (e.g.
`GermanAddress`). No service computes a rule; no store has a check constraint or trigger beyond
primary and unique keys and the version column; tests call real domain functions and never double
them. The published languages state their own constraints (`amountCents` positive) as the contract's.
Payload's "price above zero", "sku unique", "sku fixed" are Payload's own rules on Payload's record
and are stated nowhere else: `shop`'s `CatalogItem` schema says integer cents, not positive.

**P3.** Each record's rules sit in its owner's domain: orders, carts, reservations in `shop`;
payments and refunds at the provider in `payment`; articles and shipments in `fulfillment`;
invoices, credit notes, series, transfers, dunning, standing in `billing`; products in Payload's
configuration. `shop` decides which lines and amounts to refund for dropped lines and late payments;
`payment` decides whether a refund may go out. `fulfillment`'s command `ShipOrder` takes what `shop`
decides (lines, recipient); nothing of `fulfillment`'s rules is computed in `shop`. VAT is
`billing`'s alone: `shop` carries the tax class as a snapshot and never a rate. The kernel holds only
`Money` and `EmailAddress` with their arithmetic and normalization, no record's schema; `@tea/lib`
holds only mechanics; the envelope carries no system's shape.

**P4.** Every input of a use case is an argument of its driving port or what a driven port returns:
`Clock` and `Ids` are driven ports in every system; nothing in `packages/*/src` reads
`process.env` (ESLint `no-restricted-properties` on `process.env` outside `apps/*/src/config.ts`),
imports `node:async_hooks`, calls `Date.now()`, `new Date()` without arguments,
`crypto.randomUUID()`, or local-time methods (`getHours`, `getDate`, `toLocaleDateString`, `setHours`
and the rest, banned by ESLint in `packages/**`); `TZ=UTC` in the image changes nothing because no
code reads it. Business values that look like configuration (senders, VAT, deadlines) are domain
constants. Every driving adapter makes one acting call: the checkout action parses the form, reads
the cart cookie, calls `checkout` once, translates the `Result`; the bank poll makes one answering
call and one acting call; sweeps make one acting call that writes one message per due item; handlers
make one acting call per message. The storefront hides "invoice" for customers in dunning by the
answering port `getPaymentOptions`, and `checkout` refuses `invoiceNotOffered` anyway. Operators'
identity arrives as an argument (`operator`).

**P5.** Services import only their system's `ports/`, `domain/` and `@tea/kernel`
(`dependency-cruiser`), so they reach Postgres, Stripe, the 3PL, Payload, the bank and the mail
provider only as ports in the system's terms (`CardProvider`, `Warehouse`, `ProductSource`,
`MailSender`, repositories, transaction port, outbox port). Each driven adapter imports only its own
port file, the domain, and the one outside it adapts (`drizzle-orm`, `stripe`, the 3PL client,
`payload`); an adapter importing another adapter's folder is refused, except the files of one
adapter folder among themselves. Everything is built by factories called from the system builder,
which takes configuration values, pools, the Payload instance and the other system's driving port
from assembly. The three couriers (per system for Next.js and Payload-constructed driving adapters,
and the process courier for the probe) are filled only by `builder.ts` (only file allowed to import
`courier-fill.ts`), throw until filled, and are read inside each invocation. Other code of this
codebase reaches a system only through its `exports` (offer) or the `./next` way in from `app/`
files. The relay gets outbox readers from builders and assembly, never from imports of systems.
Observation: `pino` logger handed in by assembly, OpenTelemetry API global filled by the process
(`NodeSDK` in `apps/*/src/assembly.ts`), no-op in tests.

**P6.** Each driven port has a fake in the declaring system's `src/fakes/` (in-memory tables with
version checks and unique keys, a transaction fake that applies on success and discards on throw,
an outbox fake readable by tests, a fixed `Clock`, sequential `Ids`, a `CardProvider` answering from
a scenario table, a `Warehouse` with accept/reject scenarios); `payment` exports the fake of its open
host service. Every service test runs on fakes only. Each port has one `*.suite.ts` written against
the port and run by `*.test.ts` through `describePort(name, { fake, real })` from
`@tea/lib/testing`; `PORT_IMPL=fake` (default suite) or `PORT_IMPL=real`. Real runs: Postgres in
`docker-compose`, migrated by `tools/migrate` with the committed migrations, never `drizzle-kit
push` (integration tests); Stripe test mode, 3PL sandbox, mail sandbox, bank sandbox (end-to-end
tests, never run automatically). The suites assert stale saves fail, duplicate inserts fail,
rollback is whole, claims answer `repeat`, outbox insert on a known id does nothing, `CardProvider`
maps a disputed charge to `declined`. Nothing opens a pool or a socket at module load; the OTel API
is a no-op without SDK; tests pass `silentLog`.

**P7.** Each acting service opens one transaction through its transaction port, passes `tx` as a
required parameter to every repository, outbox and claim call, and commits once when `run`
resolves; nothing writes outside it (repository adapters have no other client: the pool is wrapped
only by `createShopTransactions`, and adapters take `tx` only). Several aggregates share a
transaction only where a rule ties them: checkout saves `Cart`, `Order` and each line's `Stock` (no
unit to two orders, order placed whole, cart checked out with it); invoicing saves `Invoice` and
`Series` (gapless); a credit note saves `CreditNote`, `Invoice` and `Series`; matching saves
`BankTransfer` and `Invoice`; assigning saves `BankTransfer` and each `Invoice` allocated. Everything
else that a goal needs goes by message in the same transaction: releasing reservations on
cancellation (one private message per sku), marking reservations handed over, mails, documents,
standing recomputation, published events, commands. Driving adapters make one acting call; no service
calls another service. A failed write throws and `run` rolls back whole; no savepoints.

**P8.** Every message is written by the use case into its system's outbox table in its transaction.
The relay (`@tea/lib/messaging/relay.ts`, one active under an advisory lock) reads each reader,
publishes to `pg-boss` (a Postgres table, outlives every process), then marks relayed; `pg-boss`
retries with backoff and moves exhausted jobs to the `parked` queue, keeping them; a handler's job
completes only when the use case's promise resolved, after commit. Hooks answer 200 only after the
use case returned. Outside changes are made only by executors called for a private message that
already carries the decision (`registerArticle`, `handOverShipment`, `executeProviderRefund`,
`executeIntentCancel`, `sendCustomerMail`, `sendDocumentMail`); they decide nothing again and record
the outside's answer. The one call after a commit is `checkout` → `openCardPayment` (from the
committed order, repeated by the next checkout with the same cart id; the deadline ends it otherwise)
and inside `payment`, `openCardPayment` → Stripe (from the committed `Payment`, same key). Payload
writes its notice into `cms_outbox` inside its own transaction (`req` passed), so no system acts on
a Payload change before it commits and no system code runs inside Payload's transaction.

**P9.** Every use case called for a message first claims `(handler, messageId)` in
`<schema>.handled_messages` inside its transaction (`insert ... on conflict do nothing returning`);
`repeat` commits nothing and returns as the first did (queries are read from committed records, e.g.
the second `openCardPayment` returns the stored intent's secret by calling Stripe with the same key).
Hooks use the provider's event id; the bank poll uses the bank's transfer id; the 3PL stock poll uses
`{sku}:{asOf}`. Calls: `checkout` takes the cart id (the order stores `cartId` unique), `setCartLine`
with no cart accepts a second empty cart by rule, operator actions carry a form-generated id
(`refundRequestId`, `paybackId`) or are told by records (`assignTransfer` on an already-assigned
transfer). Outside changes carry keys: Stripe intents `pi:{paymentId}`, refunds `refund:{refundId}`;
past 23 hours `executeProviderRefund` first asks `findRefund` by metadata
(`providerKeyStillValid`); the 3PL takes no key, so `handOverShipment` looks up the consignment by
shipment id before creating (`consignmentRepeatPolicy`), the remaining race accepted by that rule;
article registration is a put by sku, the same made twice; mails take no key and a repeat is
accepted (`mailRepeatPolicy = 'accept'`, brief: rare duplicate mail acceptable).

**P10.** Every aggregate row has a `version` column; `save` updates `where id = $1 and version = $2`
and throws `StaleWrite` on zero rows; inserts throw on an existing key. Use cases read through the
transaction they commit in (repository methods take `tx`), at Postgres `READ COMMITTED`. Stock is one
aggregate per sku holding its reservations, so two checkouts of the same tea fail each other and two
of different teas never do. On `StaleWrite` the transaction rolls back; handlers let it throw so the
bus redelivers; `checkout` throws and the browser resubmits with the same cart id. Stale data
accepted by rule: `shop` decides payment options by its dunning replica (rule in
`payment-options.ts`: a customer who just entered dunning may still pick invoice), prices by its
catalog replica (rule in `place-order.ts`: the order keeps the price read at placement, the one the
customer confirmed), free stock by its 3PL replica (rule in `stock.ts`: the 3PL's last report less
reservations is what is sold; an oversell the 3PL cannot ship ends as a dropped line). Untied writes
(mail logs, standing, reservation release on cancellation) go by message.

**P11.** No system's role can read or write another system's schema (Postgres grants per role, one
pool per system), so no join or update crosses. `shop` reads Payload's products only through Payload's
Local API and its notices; `billing` learns of orders only from `shop.OrderShipped.v1`; `shop` learns
of dunning only from `billing`'s event; refunds are asked of `payment` by command. No external system
keeps a record a system of this codebase owns: Payload shows stock and article status through `ui`
fields that call `shop` and `fulfillment`, storing nothing. The `cms_outbox_reader` role reads only
Payload's outbox, for the relay.

**P12.** Every system translates every upstream in its adapters (anti-corruption layer): Payload's
`Product` only in `adapters/driven/payload/*` and `handlers/catalog-sync.ts`; Stripe's types only in
`adapters/driven/stripe/*` and `next/stripe-hook.ts`; the 3PL schema only in
`adapters/driven/three-pl/*`, `next/three-pl-hook.ts`, `scheduled/stock-poll.ts`; other systems'
published languages only in the handler that parses them and the outbox or call adapter that writes
them. `dependency-cruiser` forbids `@tea/*/published`, `payload`, `stripe` and `three-pl/schema`
imports in `domain/`, `services/`, `ports/` and `published/`. No published language imports another.

**P13.** Other systems import only `./published` and `./fakes` (types, `zod` schemas, fakes) and
assembly only `./builder`; package `exports` refuse anything else at resolution, and
`dependency-cruiser` refuses deep paths. Each `src/published/**` may import only `zod`; the domain's
schemas are never re-exported or generated into it; services translate between domain and published
types (`orderShipped` built from `Order` in the outbox adapter). Builders return driving ports,
handlers, scheduled tasks and outbox readers, never repositories. Commands are the receiver's
(`ShipOrder` in `fulfillment`, `RefundCardPayment`, `CancelCardPayment` in `payment`); private
messages have no subscribers outside their system (`dependency-cruiser` keeps
`*.private.*` schemas inside `src/`).

**P14.** Each message type has one `zod` schema, in the writer's published language (or in the
system for private ones, or in `@tea/cms/published` for Payload's notice), used by the outbox adapter
to write and by every handler to parse. Types carry their version in the name (`.v1`); a change that
cannot keep both directions as meant is a `.v2` written beside `.v1` until no `.v1` waits in any
outbox, queue or the `parked` queue, then `.v1` is dropped. Record changes are expand, deploy,
contract migrations, readers first; repository adapters update only the columns they know, and
order lines are child rows, not JSON, so an old process saving back loses nothing a new one wrote.
All open host service calls are in-process, so the port half of P14 is not reached until a system
moves out.

**P15.** Only card checkout depends on another system answering now: `payment` and Stripe, because
the browser needs `client_secret` (brief). Invoice checkout, the storefront, cart, payment options and
editor stock run on `shop`'s own records and replicas. Everything else between systems is a message:
shipment, refunds, cancellation of the intent, invoicing, dunning flag, catalog. Use cases called for
messages may ask the outside (executors, `syncCatalogItem` asking Payload, notice handling asking
Stripe); while it is down they fail and the bus redelivers.

**P16.** Each system's transaction port opens a transaction on its own pool, whose role sees only
its schema, so a transaction reads and writes only its owner's records. No driving port type
mentions a transaction, a pool, a Drizzle type or a Payload `req` (`dependency-cruiser` forbids
`drizzle-orm`, `pg` and `payload` imports in `ports/driving.ts` and `published/`). `shop`'s and
`fulfillment`'s `ProductSource` call Payload's `findByID` without `req`. Payload's own transaction
writes only Payload's tables. No `AsyncLocalStorage` anywhere in systems.

**P17.** Waits and their ends, each in an aggregate: `Order.paymentDueBy` (holds stock) → minute
sweep → `expireUnpaidOrder` cancels, releases stock by message, asks `payment` to cancel the intent;
a payment arriving later is refunded by `recordCardPaymentSucceeded` (rule in `order.ts`).
`Order.handoverDueBy` (holds stock until handover) → `flagOverdueHandover` accepts the state as it
stands and marks it for operators, reservations kept. `RefundRequest.answerDueBy` in `billing`
(holds the refundable lines) → `expireRefundRequest` hands it to operators. Dunning steps end at
`withOperators`. Refusals are committed as outcomes and published: `ShipmentRejected` (3PL 4xx) →
`shop` cancels as "nothing shipped" and refunds a paid card order; `CardRefundRefused` (disputed) →
`shop` records the refund refused and shows it to operators, `billing` records the request refused
and issues no credit note; `paymentClosed` answered in-band. Failures (5xx, timeouts, `StaleWrite`,
bugs) throw, are retried and park in `parked`, visible at `/ops/delays`. `payment` reconciles hourly
any `Payment` in `opening` or `cancelRequested` older than an hour by asking Stripe.

**P18.** Each handled message is applied against the aggregate it tells of: notices from Payload and
Stripe are answered by fetching the thing's current state (Payload Local API, Stripe retrieve), so
their order does not matter; `fulfillment`'s events carry `shipmentVersion` and `articleVersion`,
`billing`'s `version`, and the receiver keeps the higher; the 3PL's stock carries the 3PL's `asOf`,
and `Stock` keeps the latest, dropping handed-over reservations with `handedOverAt <= asOf`. Early
messages are recorded or fail: `markArticleRegistered` before the product's notice creates the
`CatalogItem` placeholder keyed by sku with `inPayload: false`; `releaseReservation` before the
reservation exists records a tombstone in `Stock` so the later reservation is not made. Two writers
over one thing: none in this design (each subscriber's records are told of by one writer).

**P19.** Each system has a `GLOSSARY.md` beside its `src/`; a term enters there before code uses it.
Names apart: in `shop` "invoice" means only the payment method (`PaymentMethod 'invoice'`), and
`billing` translates `shop`'s `paymentMethod` into `settlement: 'prepaidByCard' | 'dueIn14Days'` at
its handler; `fulfillment` calls the 3PL's order `consignment` (`warehouseRef`) and its own record
`Shipment`; `payment` calls Stripe's intent `providerRef`; Payload's `Product` is `PayloadProduct`
where adapters import it; messages carry no `Event` suffix.

## Decisions the document left to me

- **D1. System cut.** Picked `shop`, `payment`, `fulfillment`, `billing`, with Payload, Stripe, 3PL,
  bank, mail provider external. Would also hold: `fulfillment` merged into `shop`; `payment` merged
  into `billing`; bank matching or dunning as their own systems; a `catalog` system.
- **D2. Owner of products.** Picked Payload: its configuration holds "price above zero", "sku unique
  and fixed" as its own rules; `shop` keeps a replica. Would also hold: a `catalog` system owning
  products with Payload as external keeper, a veto hook calling `catalog`'s specification, and
  Payload's fields locked to `catalog`'s use cases.
- **D3. Where stock and reservations live.** Picked `shop`, as `Stock` per sku holding the 3PL
  replica and the reservations, saved with the order. Would also hold: `fulfillment` owning stock,
  `shop` asking a synchronous reservation (a tentative operation) before committing.
- **D4. When a handed-over reservation stops counting.** Picked: when a 3PL stock report with
  `asOf >= acceptedAt` arrives. Would also hold: at handover (accepting a short overstatement by
  rule).
- **D5. Anti-corruption layer or conformist per upstream.** Picked anti-corruption layer for every
  upstream. Would also hold: `payment` conforming to Stripe's types; `billing` conforming to `shop`'s
  published language.
- **D6. Bus and relay.** Picked `pg-boss` in the same Postgres (schema `pgboss`), queue per handler,
  `publish`/`subscribe` fan-out, retries with backoff, `parked` dead-letter queue; relay in
  `worker`, single active by advisory lock, marks after `publish`. Would also hold: RabbitMQ, SQS;
  relay sending with `pg-boss`'s `db` option in the reader's transaction.
- **D7. How the bus finds handlers.** Picked by envelope type (subscriptions). Would also hold: each
  handler filtering one firehose queue.
- **D8. How the clock starts use cases.** Picked cron sweeps (`pg-boss` schedules) that write one
  message per due item under a name-derived id. Would also hold: messages held back with
  `startAfter`.
- **D9. Outbox shape.** Picked one outbox table per system schema and one outbox port taking a
  union of messages in the system's terms; the outbox adapter writes each in its one schema,
  including other systems' commands. Would also hold: a separate port per destination writing
  through the outbox port; the outbox as a field on the aggregate.
- **D10. Payload's outbox.** Picked a hidden Payload collection `cms_outbox` written in `afterChange`
  and `afterDelete` with `req`; notices carry only `productId`, receivers fetch. Would also hold: a
  version field on products raised in `beforeChange`, carried in a fat message.
- **D11. Transaction typing.** Picked an opaque `ShopTx` interface per system, implemented by an
  adapter class, narrowed with `instanceof`; the Postgres files of one system are one adapter
  folder. Would also hold: a `WeakMap` from handle to Drizzle transaction; a unit-of-work object
  whose repositories are built per transaction.
- **D12. Concurrency means.** Picked a version column on every aggregate plus unique keys, `READ
  COMMITTED`. Would also hold: `SELECT ... FOR UPDATE` held to commit; `SERIALIZABLE`.
- **D13. Isolation of systems in one Postgres.** Picked one schema, one role and one pool per system.
  Would also hold: one role and schemas, held by lint and review only.
- **D14. Repository layout and reach checks.** Picked pnpm workspace, one package per system with
  `exports` limited to the offer and `./next`; `dependency-cruiser` closed allowlists; ESLint
  restrictions; domain tsconfig without Node types. Would also hold: one package with path aliases
  and the same `dependency-cruiser` rules.
- **D15. Processes.** Picked `web` (Next.js with Payload, storefront, ops, hooks), `worker` (relay,
  handlers, schedules), `migrate` job. Would also hold: hooks in their own process; relay in its own
  process; everything in one process.
- **D16. Couriers.** Picked one per system, slot on `globalThis` declared with `declare global`,
  filled by the system builder, read per invocation, throwing until filled; filled in Next.js
  `instrumentation.ts` `register()`. Would also hold: a module-level slot with `@tea/*` in
  `serverExternalPackages` so modules load once.
- **D17. Where Next.js driving adapters live.** Picked each system's `src/adapters/driving/next`,
  exported as `./next`, re-exported one line per `app/` file. Would also hold: the code itself in
  `app/`, counted as the system's.
- **D18. Card payment shape.** Picked one Stripe PaymentIntent per order, opened by `payment`'s open
  host service after `shop`'s commit; `payment` records the intent's reference from Stripe's
  `payment_intent.created` notice, not after the call; every Stripe event treated as a notice whose
  subject is fetched. Would also hold: recording the reference in a second use case called by the
  driving adapter; applying event payloads directly with a forward-only status.
- **D19. Who decides refunds.** Picked `shop` for refunds before invoicing (late payment, dropped
  lines, nothing shipped) and `billing` for operator refunds after invoicing; for card orders
  `billing` issues the credit note only once `payment` reports `CardRefunded`. Would also hold:
  a `refunds` system; the credit note first and a refused card refund corrected by operators.
- **D20. Mails.** Picked per system: the deciding transaction writes a private message carrying the
  whole mail content; an executor renders, sends, records a sent-mail row. Would also hold: a
  `mailing` system subscribed to everyone's events.
- **D21. 3PL repeat.** Picked look-up by shipment reference before create, residual race accepted.
  Would also hold: a reconciliation that cancels a second consignment.
- **D22. Stripe key lifetime.** Picked: past 23 hours, look up the refund by metadata before
  creating. Would also hold: accepting the rare double refund by rule (the brief forbids it, so not
  for this shop).
- **D23. Bank transfers.** Picked a 5-minute poll with cursor and one day of overlap, one acting call
  writing one message per transfer under the bank's id. Would also hold: a bank webhook hook.
- **D24. Dunning flag to `shop`.** Picked `billing`'s `CustomerStanding` aggregate, recomputed by
  private message, published with its version; `shop` keeps a replica. Would also hold: `shop`
  calling `billing` at checkout under a rule that needs the answer now.
- **D25. Following one checkout.** Picked the order id as `correlationId` and per-system answering
  ports `get*Timeline(orderId)` composed on `/ops/orders/[orderId]`; OTel traces as observation
  beside it. Would also hold: a timeline replica built from all events.
- **D26. Time.** Picked `@js-temporal/polyfill`, instants in UTC, calendar dates in `Europe/Berlin`
  stated in each domain that needs dates. Would also hold: `date-fns` with `@date-fns/tz`.
- **D27. Schemas.** Picked `zod` 4 for domain, published language and external schemas. Would also
  hold: `valibot`, `@effect/schema`.
- **D28. Price confirmation.** Picked: checkout carries the prices the customer saw; any difference
  is refused with current prices. Would also hold: a `seenPrice` stored on each cart line.
- **D29. Cart.** Picked a server-side `Cart` aggregate, id in a cookie set by the server action.
  Would also hold: a cart in the browser and checkout taking lines plus a client-made key.
- **D30. Deadlines I added.** Picked `handoverDueBy` 48 hours in `shop` and `answerDueBy` 72 hours in
  `billing`, both ending by handing to operators. Would also hold: other durations; ending by
  cancelling.
- **D31. Shared kernel content.** Picked `Money` and `EmailAddress`. Would also hold: no kernel at
  all, each system with its own `Money`.
- **D32. Migrations.** Picked Drizzle Kit generated SQL per schema, run by `tools/migrate` before each
  deploy, expand and contract. Would also hold: hand-written SQL with `node-pg-migrate`.
- **D33. Test tooling.** Picked `vitest` workspace, `describePort` with `PORT_IMPL`, Postgres in
  `docker-compose` for integration, vendor sandboxes for end-to-end, run by hand. Would also hold:
  Testcontainers.
- **D34. Observation.** Picked `pino` logger as a builder argument and the OpenTelemetry API global.
  Would also hold: a `Log` driven port; logs through the OTel logs API.
- **D35. Payment deadline ending.** Picked cancel at the deadline without asking Stripe, then ask
  `payment` to cancel the intent; a later success is refunded. Would also hold: ask `payment` to
  cancel first and cancel the order on its answer, with a second deadline.
- **D36. Storefront data.** Picked `shop`'s replica only, Lexical rendered to HTML at projection.
  Would also hold: product copy read from Payload's Local API by the page.
- **D37. Editors' view of stock and article status.** Picked Payload `ui` fields calling `shop` and
  `fulfillment` answering ports through couriers. Would also hold: `fulfillment` mirroring the
  status into a read-only Payload field by message, Payload configured so only that use case writes
  it.
- **D38. Lost dispute before the invoice exists.** Picked: `billing` keeps it on a pending credit and
  issues the credit note right after the invoice. Would also hold: the invoice issued over the
  undisputed amount only.
- **D39. Message ids.** Picked uuid v7, or uuid v5 of a name where one fact must yield one message,
  with insert-on-conflict-do-nothing in the outbox. Would also hold: a unique key on the fact in the
  aggregate instead.
- **D40. Orchestration or choreography.** Picked `shop` orchestrating the order process by commands,
  `billing` joining by choreography. Would also hold: full choreography (`fulfillment` and `payment`
  reacting to `shop`'s events).

## Sentences I had to pick a reading for

- **S1.** P5: "Only assembly fills it, a system builder being assembly, or a second place produces
  instances." Reading A: the system builder, code in the system's package, may fill the system's
  courier. Reading B: only the process's assembly file fills couriers, with what builders return.
  Took A. Draft: `fillShopPorts()` is called inside `buildShop`; `apps/web/src/assembly.ts` fills
  only the process courier.
- **S2.** Glossary, Outbox: "The *outbox port* is the driven port a service writes messages
  through." Reading A: one outbox port per system, which every message passes, so translation into
  other systems' languages sits in its adapter. Reading B: the service may write through other ports
  of its own (P12: "the driven adapter behind a port of shop's own that turns shop's terms into
  fulfillment's `ReserveStock` and writes it to shop's outbox"), which use the outbox port. Took A.
  Draft: one `ShopOutbox` with a union of messages in `shop`'s terms; no `FulfilmentRequests` port.
- **S3.** P7: "that its service commits once after the last write." Reading A: once the service has
  made the call after the commit (P8), it writes nothing more in that use case. Reading B: the call
  after the commit opens a second phase that may commit the answer. Took A. Draft: `openCardPayment`
  never records the intent's reference; the `payment_intent.created` notice does.
- **S4.** P2: "the business rules it holds are the external system's own where they decide a record
  the external system keeps and no business rule of this system decides." Reading A: `shop` copying
  the price as a snapshot is no rule deciding the product, so Payload's rules on products are
  Payload's. Reading B: the brief's catalog rules are the business's and so belong in a system of
  this codebase. Took A. Draft: no `catalog` system; price and sku rules in `packages/cms`.
- **S5.** P8: "A use case called for such a message MUST act on the change, deciding nothing again."
  Reading A: binds only use cases called for a message asking for a decided change that leaves the
  transaction (executors); a deadline message asks for a decision. Reading B: every use case called
  for a private message carries out a decision already made. Took A. Draft: `expireUnpaidOrder`,
  `advanceDunning`, `matchReportedTransfer` decide in their own transaction; executors decide
  nothing.
- **S6.** P9: "the store refusing a second claim of it." Reading A: the second claim must fail as a
  write error. Reading B: an insert that does nothing on conflict and reports the conflict counts as
  the store refusing it. Took B. Draft: `claim` returns `'repeat'` from `on conflict do nothing
  returning`, the use case commits nothing and succeeds.
- **S7.** P10: "A decision on data whose change fails no transaction of this store MUST rest on a
  business rule..." Reading A: only data outside this store (live answers of other systems); a
  replica kept in this store must be version-checked like any read. Reading B: replicas count by
  nature, as the rule's own example says ("a replica lags its owner"). Took B. Draft: checkout does
  not lock or version-check `CatalogItem` and `CustomerDunning`; `place-order.ts` and
  `payment-options.ts` state the rules accepting them stale.
- **S8.** P17: "it MUST hold the moment it stops waiting in an aggregate of its own, if: it holds
  something until the answer comes." Reading A: a reservation waiting for handover, and a refund
  request reserving refundable lines, hold something. Reading B: only an explicit tentative operation
  holds. Took A. Draft: `Order.handoverDueBy` and `RefundRequest.answerDueBy` with their sweeps.
- **S9.** P6: "a transaction port whose fake commits nothing." Reading A: the fake has no commit
  step, writes land in memory at once. Reading B: it commits nothing outside the process but still
  rolls back whole on a throw. Took B, because use-case tests rely on whole rollback and the suite
  holds it to Postgres. Draft: `FakeShopTx` works on a copy and swaps it in on success.
- **S10.** P13: "Code of another system MUST import of a system only its offer." Reading A: an
  `app/` file of the web app is code of no system and may import only offers. Reading B: by the
  glossary ("A module is of the system whose layer ... it belongs to, wherever the codebase keeps
  it") the `app/` file is the system's driving adapter. Took B. Draft: `./next` export outside the
  offer, importable only from `apps/web/app/**` and Payload's field paths.
- **S11.** P8: "An external system this codebase configures, whose transaction can write a message to
  an outbox, MUST tell of its change by such a message." Reading A: "can" by what its configuration
  can be made to do (Payload hooks with `req`). Reading B: only where the vendor offers an outbox
  feature. Took A. Draft: `cms_outbox` collection, no veto or provisional records needed.
- **S12.** Glossary, Hook: "A driving adapter an external system calls." Reading A: Payload's
  `afterChange` that only writes Payload's own collection is configuration, not a hook of any
  system. Reading B: anything Payload calls is a hook of some system. Took A. Draft:
  `write-product-notice.ts` lives in `packages/cms`, calls no system.
- **S13.** Glossary, Tooling: "Code that runs in no process of the deployed application." Reading A:
  the pre-deploy migration job is no process of the application. Reading B: it runs in the deployed
  environment, so it is a process and needs assembly. Took A. Draft: `tools/migrate` reaches
  migration folders by path and has no assembly.
- **S14.** P4: "with at most one acting call per call or message it handles." Reading A: a driving
  adapter retrying the same acting call after `StaleWrite` makes a second acting call. Reading B: a
  retry of the same call is the same call. Took A. Draft: no driving adapter retries; the bus or the
  browser repeats.
- **S15.** P7: "A use case MUST save at most one aggregate, or several only where a business rule
  ties them." Reading A: releasing reservations of one cancelled order across several `Stock`s is not
  tied. Reading B: "its stock is free again" ties them to the cancellation. Took A. Draft: one
  private `ReservationReleaseDue` per sku, and per sku for handover.
- **S16.** P17: "A refusal of a business process step MUST ... reach the system that decided the
  business process step," with "published as an event ... naming no sender." Reading A: the event
  names no sender, each subscriber recognises its own request by an id it recorded. Reading B: the
  refusal is addressed to its asker. Took A. Draft: `CardRefunded`/`CardRefundRefused` go to `shop`
  and `billing`, each ignoring `refundId`s it did not record, which "not found" means here because
  the request was committed before the command left.
- **S17.** P2: "every value it decides by that is the same for every candidate and that no record
  holds." Reading A: the sender address a customer sees is such a value. Reading B: it is a
  configuration value naming the deployment. Took A (P4 says the same). Draft: `SHOP_SENDER`,
  `BILLING_SENDER` in the domains; only the mail API key and URL in configuration.
- **S18.** P1: "MUST load on every runtime of the language." Reading A: what ES2023 plus `Intl`
  gives everywhere; a pure polyfill passes. Reading B: only language built-ins, no package beyond
  those the rule names. Took A. Draft: `@js-temporal/polyfill` and `zod` in the domain allowlist,
  checked by `types: []`.
- **S19.** P13: "A system builder is in the offer for assembly." Reading A: on the offer, but only
  assembly and tooling may import it. Reading B: any code may import it, the harm being only what it
  returns. Took A. Draft: `dependency-cruiser` allows `./builder` only from `apps/*/src/assembly.ts`
  and `tools/**`.
- **S20.** Brief against P17's ending list, the rule in `order.ts`: reading the brief's "A payment
  succeeding after its order was cancelled" as cancelled in `shop`'s records, not succeeded after the
  deadline at Stripe. Reading B: a payment Stripe took before the deadline whose notice came late is
  not "after". Took A, the rule P17 asks to be written down. Draft: `recordCardPaymentSucceeded`
  refunds whenever the order is cancelled, whatever `succeededAt` says.
