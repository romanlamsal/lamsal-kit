# Fresh repository draft B, raw set

Repository `teashop`: a pnpm workspace, TypeScript `strict`, Node 22, ESM. Next.js 15 hosts Payload 3
(Payload 3 runs only inside Next.js, so Next.js comes with the brief's Payload) and the storefront.
Postgres 16 (one instance), Drizzle ORM, `pg-boss` as the bus, Stripe Node SDK, pino,
OpenTelemetry Node SDK exporting OTLP to Jaeger, `vitest`, Biome, `dependency-cruiser`.

Three systems of ours: **ordering**, **billing**, **fulfilment**. Five external systems: Payload
CMS (`cms`), Stripe, the 3PL (`warehouse`), the bank, the mail provider. One shared kernel. One
common library.

## Systems and what each owns

### Systems of this codebase

| System | Kind | Owns (its business rules decide these records) | Keeps (store) |
|---|---|---|---|
| **ordering** | system, package `@teashop/ordering` | `Cart`, `Order` (aggregate and *process manager* of the order's course across systems; holds the order-line snapshots of price, sku, tax class), `Customer` (email, name, addresses; guests keyed by normalised email) | Postgres schema `ordering`, role `ordering`: `carts`, `cart_lines`, `orders`, `order_lines`, `order_commands_sent`, `customers`; **replicas** `catalog_items` (of cms products, under cms ids) and `customer_standings` (of billing's dunning standing, under billing's customer refs); `outbox`; `processed_calls` |
| **billing** | system, package `@teashop/billing` | `CardPayment` (one per order paid by card; the Stripe PaymentIntent behind it; disputed or not), `Refund`, `Invoice` (lines with VAT rate by tax class, number), `CreditNote`, `NumberSequence` (gapless counters per document kind and year), `BankTransfer` (incoming; matched or unmatched), `DunningCase` (per customer: stage, version) | schema `billing`, role `billing`: `card_payments`, `refunds`, `invoices`, `invoice_lines`, `credit_notes`, `credit_note_lines`, `number_sequences`, `bank_transfers`, `bank_cursor`, `dunning_cases`, `dunning_reminders`, `outbox`, `processed_calls` |
| **fulfilment** | system, package `@teashop/fulfilment` | `StockItem` (per sku: on hand, reserved), `Reservation` (per order: held, confirmed, released, lapsed, consumed; expiry), `Article` (sku's registration in the 3PL article master), `Shipment` (per order: requested, submitted, dispatched, delivered, `needs-attention`) | schema `fulfilment`, role `fulfilment`: `stock_items`, `reservations`, `reservation_lines`, `articles`, `shipments`, `shipment_lines`, `outbox`, `processed_calls` |

Context map. ordering is **downstream** of billing and of fulfilment and is a **conformist** to
both (it sends their commands, handles their events and calls their open host service in their
published language). ordering is downstream of `cms` behind an **anti-corruption layer**. billing
and fulfilment know nothing of ordering: every message between them and ordering is in the
upstream's published language. fulfilment is downstream of `cms` (anti-corruption layer) and of
the 3PL (anti-corruption layer). billing is downstream of Stripe, the bank and the mail provider
(anti-corruption layer each). ordering is downstream of the mail provider (anti-corruption layer).

### External systems

| External system | Run by | Owns | How this codebase drives it | How it drives this codebase |
|---|---|---|---|---|
| `cms`: Payload CMS 3, configured by `packages/cms` | us, inside the `web` process | products (copy as Lexical rich text, images, slug, price in EUR, sku, tax class, draft/published), media, editor users, its own outbox collection `outbox-messages` | ordering's driven adapter `PayloadCatalogSource` (REST `GET /api/products`) for the nightly **reconciliation** | its outbox (written by `afterChange`/`afterDelete` collection hooks in its own transaction) relayed as `cms.product-changed.v1` / `cms.product-deleted.v1`; its admin UI renders fulfilment's **hook** `StockField` and the three systems' admin views (**hooks**) |
| Stripe | vendor | PaymentIntents, charges, refunds, disputes | billing's driven adapter `StripeCardGateway` | **hook** `POST /hooks/stripe` (billing) |
| `warehouse`: the 3PL | vendor | physical stock, article master, shipments | fulfilment's driven adapter `HttpWarehouse` | **hook** `POST /hooks/warehouse` (fulfilment) |
| bank | vendor | account transactions | billing's driven adapter `HttpBankStatements` (polled) | none |
| mail provider | vendor | sent mail | `HttpOrderMailer` (ordering), `HttpBillingMailer` (billing) | none |

Business rules this codebase writes into `cms`'s configuration, in its terms: price above zero
(`validate` on field `price`, also rejecting more than two decimals), sku unique (`unique: true`
on field `sku`), slug unique (`unique: true`). Tax class is a `select` with options `tea`,
`accessories`.

### Shared kernel

`@teashop/kernel` (`packages/kernel`), pure, imported into the domain of ordering, billing and
fulfilment:

- `Money` (`{ cents: number; currency: "EUR" }`, integer cents, `add`, `multiply`, `isPositive`),
- `Sku` (branded string, `parseSku`),
- `TaxClass` (`"tea" | "accessories"`).

The VAT rates are not in it; they are billing's.

### Code that is no system

- **Common library** `@teashop/common` (`packages/common`): `pure` entry (`Result`, `Instant`,
  `Json`, `ActingMeta`, `Acting`, `Answering`, `Page`), `messaging` (`Envelope`, `OutboxReader`,
  `Handler`, `ScheduledTask`, the relay `startRelay`, the bus `createPgBossBus`, the handler
  runtime, `createInMemoryBus` for tests), `observability` (pino logger with trace mixin, OTel setup,
  `withRequestContext`, metrics renderer), `db` (`createPool`, `processedCalls` helpers,
  `ConcurrencyConflict`, `retryOnConflict`), `http` (problem+json helpers), `courier`.
- **Assembly**: `apps/web/src/assembly.ts`, `apps/worker/src/assembly.ts`,
  `apps/worker/src/cms-outbox-reader.ts` (the **outbox reader** of an external system's outbox is
  assembly's), `apps/web/src/payload.config.ts` (Payload's own wiring: database adapter, collections
  from `packages/cms`, admin component paths).
- **Probes**: `/health` (pings Postgres with a dedicated role `probe`) and `/metrics` in each
  process; built from `@teashop/common/observability`.
- **External-system configuration**: `packages/cms` (collections, field rules, outbox hooks,
  Lexical-to-HTML rendering). It is `cms`'s, not a system of ours.
- **UI**: storefront pages and checkout page in `apps/web/src/app/(shop)` (out of scope; they call
  ordering's driving ports through the web courier).
- **Tooling**: `drizzle.config.ts` per system, `tooling/check-migrations.ts`,
  `tooling/replay-parked.ts`, Biome GritQL plugins, `.dependency-cruiser.cjs`, `docker-compose.yml`
  (Postgres, Jaeger for local runs and integration tests).

## Ports and adapters

### Common library types (`@teashop/common/pure`, `@teashop/common/messaging`)

```ts
// packages/common/src/pure/index.ts — pure; the only common-library entry a domain may import
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const refuse = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type Instant = number & { readonly __brand: "Instant" }; // epoch milliseconds
export type Json =
  | string | number | boolean | null
  | readonly Json[]
  | { readonly [key: string]: Json };

/** Every acting call carries one key; a repeat with the same key answers as the first and writes nothing. */
export type ActingMeta = { readonly idempotencyKey: string };
export type Acting<I, O extends Json, E extends Json> =
  (input: I, meta: ActingMeta) => Promise<Result<O, E>>;
export type Answering<I, O> = (input: I) => Promise<O>;
export type Page<T> = { readonly items: readonly T[]; readonly next: string | null };
```

```ts
// packages/common/src/messaging/*.ts
export type Envelope<TType extends string = string, TPayload extends Json = Json> = {
  readonly id: string;              // uuidv7; the same on every delivery
  readonly type: TType;             // "<system>.<name>.v<n>"
  readonly occurredAt: Instant;
  readonly payload: TPayload;
  readonly trace: { readonly traceparent: string | null; readonly baggage: string | null };
};

export interface OutboxReader {
  readonly name: string;                                        // "ordering", "billing", "fulfilment", "cms"
  claim(limit: number): Promise<readonly Envelope[]>;           // oldest undelivered first
  markDelivered(ids: readonly string[]): Promise<void>;
  wakeups(signal: AbortSignal): AsyncIterable<void>;            // LISTEN outbox_<name>
}

export type RegisteredHandler = {
  readonly queue: string;                                       // "<system>.<handler>"
  readonly subscribesTo: string;                                // message type
  readonly deliver: (envelope: Envelope) => Promise<void>;      // resolves: settle (ack); throws: redeliver
};
export function defineHandler<T extends Json>(spec: {
  queue: string;
  subscribesTo: string;
  parse: (payload: Json) => T;                                  // zod parse of the published language
  handle: (envelope: Envelope<string, T>) => Promise<void>;
}): RegisteredHandler;

export type ScheduledTask = {
  readonly name: string;
  readonly cron: string;
  readonly run: (firedAt: Instant) => Promise<void>;
};

export interface Bus {
  publish(envelope: Envelope): Promise<void>;
  subscribe(handlers: readonly RegisteredHandler[]): Promise<void>;
  schedule(tasks: readonly ScheduledTask[]): Promise<void>;
}
export function createPgBossBus(boss: PgBoss, logger: Logger): Bus;
export function startRelay(readers: readonly OutboxReader[], bus: Bus, signal: AbortSignal): Promise<void>;
export function createInMemoryBus(options: { duplicate: boolean; reorder: boolean }): Bus & { deliverAll(): Promise<void> };

// packages/common/src/courier.ts
export function createCourier<T>(name: string): { set(value: T): void; get(): T }; // get() throws until set

// packages/common/src/db/concurrency.ts
export class ConcurrencyConflict extends Error {}
export function retryOnConflict<T>(attempts: number, run: () => Promise<T>): Promise<T>;
```

Every system's service is a factory: `createOrderingService(deps: OrderingDeps): OrderingPorts`
(likewise billing, fulfilment). Each system declares its own `Clock` and id ports; the common
library supplies the adapters `systemClock` and `uuidv7Ids`.

### ordering

Driving ports (`packages/ordering/src/ports/driving.ts`). Each type is one use case.

```ts
import type { Acting, Answering, Instant, Page } from "@teashop/common/pure";
import type { Money, Sku, TaxClass } from "@teashop/kernel";
import type { CustomerStandingChanged, PaymentReceived, RefundRefused } from "@teashop/billing";
import type { ReservationLapsed, ShipmentDispatched, ShipmentRefused } from "@teashop/fulfilment";

export type CartId = string & { readonly __brand: "CartId" };
export type OrderId = string & { readonly __brand: "OrderId" };
export type CustomerId = string & { readonly __brand: "CustomerId" };
export type ProductId = string & { readonly __brand: "ProductId" }; // cms id: the replica keeps the owner's ids
export type Address = {
  readonly name: string; readonly line1: string; readonly line2: string | null;
  readonly postalCode: string; readonly city: string; readonly country: string;
};
export type PaymentMethod = "card" | "invoice";

export type CartLineView = {
  readonly productId: ProductId; readonly name: string; readonly unitPrice: Money;
  readonly quantity: number; readonly lineTotal: Money;
};
export type CartView = { readonly cartId: CartId; readonly version: number; readonly lines: readonly CartLineView[]; readonly total: Money };
export type CartRefusal = { readonly code: "product-unavailable" } | { readonly code: "quantity-invalid" };

// storefront and checkout
export type AddToCart = Acting<{ cartId: CartId; productId: ProductId; quantity: number }, CartView, CartRefusal>;
export type SetCartLineQuantity = Acting<{ cartId: CartId; productId: ProductId; quantity: number }, CartView, CartRefusal>;
export type ViewCart = Answering<{ cartId: CartId }, CartView | null>;
export type CheckoutOptions = Answering<{ cartId: CartId; email: string }, { readonly paymentMethods: readonly PaymentMethod[] }>;

export type PlaceOrderInput = {
  readonly cartId: CartId; readonly cartVersion: number; readonly expectedTotal: Money;
  readonly email: string; readonly shippingAddress: Address; readonly billingAddress: Address;
  readonly paymentMethod: PaymentMethod;
};
export type PlacedOrder = {
  readonly orderId: OrderId; readonly total: Money;
  readonly payment: { readonly method: "card"; readonly confirmationSecret: string } | { readonly method: "invoice" };
};
export type PlaceOrderRefusal =
  | { readonly code: "cart-empty" }
  | { readonly code: "cart-changed"; readonly currentVersion: number }
  | { readonly code: "price-changed"; readonly total: Money }
  | { readonly code: "product-unavailable"; readonly productIds: readonly ProductId[] }
  | { readonly code: "out-of-stock"; readonly skus: readonly Sku[] }
  | { readonly code: "invoice-not-offered" }
  | { readonly code: "card-payment-unavailable" };
export type PlaceOrder = Acting<PlaceOrderInput, PlacedOrder, PlaceOrderRefusal>;

export type CatalogItemView = {
  readonly productId: ProductId; readonly slug: string; readonly name: string;
  readonly descriptionHtml: string; readonly imageUrls: readonly string[];
  readonly price: Money; readonly taxClass: TaxClass; readonly sellable: boolean;
};
export type BrowseCatalog = Answering<Record<string, never>, readonly CatalogItemView[]>;
export type ProductBySlug = Answering<{ slug: string }, CatalogItemView | null>;

// steps reached by handlers and scheduled tasks
export type CatalogItemSource = {      // ordering's terms, after the cms anti-corruption layer
  readonly productId: ProductId; readonly sourceVersion: string; readonly slug: string;
  readonly name: string; readonly descriptionHtml: string; readonly imageUrls: readonly string[];
  readonly price: Money; readonly sku: Sku; readonly taxClass: TaxClass | null; // null: a value ordering does not know
  readonly published: boolean;
};
export type SyncCatalogItem = Acting<CatalogItemSource, null, never>;
export type RemoveCatalogItem = Acting<{ productId: ProductId; sourceVersion: string }, null, never>;
export type RefreshStorefront = Acting<Record<string, never>, null, never>;
export type ApplyCustomerStanding = Acting<CustomerStandingChanged, null, never>;
export type RecordPaymentReceived = Acting<PaymentReceived, null, never>;
export type RecordShipmentDispatched = Acting<ShipmentDispatched, null, never>;
export type RecordShipmentRefused = Acting<ShipmentRefused, null, never>;
export type RecordReservationLapsed = Acting<ReservationLapsed, null, never>;
export type RecordRefundRefused = Acting<RefundRefused, null, never>;
export type SendOrderConfirmation = Acting<{ orderId: OrderId }, null, never>;
export type CancelOverdueOrders = Acting<{ now: Instant }, { cancelled: number }, never>;
export type RebuildCatalogReplica = Acting<{ now: Instant }, { upserted: number; removed: number }, never>;

// operations
export type OrderStatus = "awaiting-payment" | "awaiting-shipment" | "shipped" | "completed" | "cancelled" | "needs-attention";
export type OrderSummary = { readonly orderId: OrderId; readonly placedAt: Instant; readonly email: string; readonly total: Money; readonly status: OrderStatus; readonly paymentMethod: PaymentMethod; readonly paid: boolean };
export type OrderDetail = OrderSummary & {
  readonly lines: readonly { sku: Sku; name: string; unitPrice: Money; taxClass: TaxClass; quantity: number }[];
  readonly shippingAddress: Address; readonly history: readonly { at: Instant; step: string }[];
};
export type ListOrders = Answering<{ status: OrderStatus | null; cursor: string | null; limit: number }, Page<OrderSummary>>;
export type GetOrder = Answering<{ orderId: OrderId }, OrderDetail | null>;

export type OrderingPorts = {
  addToCart: AddToCart; setCartLineQuantity: SetCartLineQuantity; viewCart: ViewCart;
  checkoutOptions: CheckoutOptions; placeOrder: PlaceOrder;
  browseCatalog: BrowseCatalog; productBySlug: ProductBySlug;
  syncCatalogItem: SyncCatalogItem; removeCatalogItem: RemoveCatalogItem; refreshStorefront: RefreshStorefront;
  applyCustomerStanding: ApplyCustomerStanding; recordPaymentReceived: RecordPaymentReceived;
  recordShipmentDispatched: RecordShipmentDispatched; recordShipmentRefused: RecordShipmentRefused;
  recordReservationLapsed: RecordReservationLapsed; recordRefundRefused: RecordRefundRefused;
  sendOrderConfirmation: SendOrderConfirmation; cancelOverdueOrders: CancelOverdueOrders;
  rebuildCatalogReplica: RebuildCatalogReplica; listOrders: ListOrders; getOrder: GetOrder;
};
```

Driven ports (`packages/ordering/src/ports/driven.ts`).

```ts
import type { ActingMeta, Instant, Json } from "@teashop/common/pure";
import type { ZodType } from "zod";
import type { Cart, CatalogItem, Customer, CustomerStanding, EmailAddress, Order, OrderCommand } from "../domain";
// conformist: the upstreams' driving ports are ordering's driven ports, untranslated
import type { StartCardPayment } from "@teashop/billing";
import type { ReleaseStock, ReserveStock } from "@teashop/fulfilment";

export interface OrderingUnitOfWork {
  /** One transaction in ordering's store. Records meta.idempotencyKey with the answer in the same transaction. */
  act<T extends Json>(meta: ActingMeta, work: (tx: OrderingTx) => Promise<T>): Promise<T>;
  /** The stored answer of an earlier call with this key, before any cross-system call is made. */
  answered<T extends Json>(meta: ActingMeta, schema: ZodType<T>): Promise<T | undefined>;
  read<T>(work: (reads: OrderingReads) => Promise<T>): Promise<T>;
}
export type OrderingTx = {
  readonly carts: CartRepository; readonly orders: OrderRepository; readonly customers: CustomerRepository;
  readonly catalog: CatalogReplica; readonly standings: CustomerStandingReplica; readonly outbox: OrderingOutbox;
};
export type OrderingReads = {
  readonly carts: Pick<CartRepository, "load">; readonly orders: OrderQueries;
  readonly catalog: Pick<CatalogReplica, "get" | "bySlug" | "list">; readonly standings: Pick<CustomerStandingReplica, "get">;
};

export interface CartRepository { load(id: CartId): Promise<Cart | null>; save(cart: Cart): Promise<void> } // save throws ConcurrencyConflict on a stale version
export interface OrderRepository {
  load(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  findOverdue(now: Instant, limit: number): Promise<readonly OrderId[]>;
}
export interface OrderQueries {
  list(filter: { status: OrderStatus | null; cursor: string | null; limit: number }): Promise<Page<Order>>;
  load(id: OrderId): Promise<Order | null>;
}
export interface CustomerRepository { findByEmail(email: EmailAddress): Promise<Customer | null>; save(customer: Customer): Promise<void> }
export interface CatalogReplica {
  get(ids: readonly ProductId[]): Promise<readonly CatalogItem[]>;
  bySlug(slug: string): Promise<CatalogItem | null>;
  list(): Promise<readonly CatalogItem[]>;
  put(item: CatalogItem, expectedSourceVersion: string | null): Promise<void>; // ConcurrencyConflict if the row moved
}
export interface CustomerStandingReplica {
  get(customerId: CustomerId): Promise<CustomerStanding | null>;
  put(standing: CustomerStanding, expectedVersion: number | null): Promise<void>;
}

export type OrderingPrivateMessage =
  | { readonly type: "ordering.order-placed.v1"; readonly payload: { readonly orderId: OrderId } }
  | { readonly type: "ordering.catalog-changed.v1"; readonly payload: Record<string, never> };
/** OrderCommand: the domain's union of fulfilment's and billing's commands, in their published language. */
export interface OrderingOutbox { append(message: OrderCommand | OrderingPrivateMessage): void }

export type OrderConfirmationMail = {
  readonly to: EmailAddress; readonly orderId: OrderId; readonly lines: readonly { name: string; quantity: number; lineTotal: Money }[];
  readonly total: Money; readonly paymentMethod: PaymentMethod;
};
export interface OrderMailer { sendOrderConfirmation(mail: OrderConfirmationMail, idempotencyKey: string): Promise<void> }
export interface StorefrontCache { invalidateCatalog(): Promise<void> }
export interface CatalogSource { all(): AsyncIterable<CatalogItemSource> }
export interface Clock { now(): Instant }
export interface OrderingIds {
  orderIdFor(cartId: CartId, cartVersion: number): OrderId; // uuidv5: a repeat of one checkout yields one order
  customerId(): CustomerId;
  cartId(): CartId;
}
export type OrderingUpstreams = { readonly reserveStock: ReserveStock; readonly releaseStock: ReleaseStock; readonly startCardPayment: StartCardPayment };

export type OrderingDeps = {
  readonly uow: OrderingUnitOfWork; readonly upstreams: OrderingUpstreams; readonly mailer: OrderMailer;
  readonly storefront: StorefrontCache; readonly catalogSource: CatalogSource; readonly clock: Clock; readonly ids: OrderingIds;
};
```

Domain (`packages/ordering/src/domain/`, pure): `Cart`; `Order` with transitions
`place`, `recordPayment`, `recordDispatch`, `recordReservationLapsed`, `recordShipmentRefused`,
`recordRefundRefused`, `cancelIfOverdue`, each returning `{ order: Order; commands: readonly OrderCommand[]; events: readonly "order-placed"[] }`;
`placeOrder(cart, items, customer, standing, input, now, orderId)`: `Result<{ order; commands }, PlaceOrderRefusal>`;
specification `invoicePaymentOffered(standing: CustomerStanding | null): boolean`;
`paymentDeadline(placedAt: Instant, method: PaymentMethod): Instant | null` (card: placed + 60
min; invoice: none); `CatalogItem.supersedes(current: CatalogItem | null): boolean`;
`CustomerStanding.supersedes`.

Order states, held by the `Order` aggregate as *process manager*:

| From | On | To | Commands it decides |
|---|---|---|---|
| (new) | placed, card | `awaiting-payment`, deadline = placed + 60 min | `fulfilment.confirm-reservation.v1` |
| (new) | placed, invoice | `awaiting-shipment` | `fulfilment.confirm-reservation.v1`, `fulfilment.ship-order.v1` |
| `awaiting-payment` | payment received (card) | `awaiting-shipment`, paid | `fulfilment.ship-order.v1`, `billing.issue-invoice.v1` (`paid-by-card`) |
| `awaiting-payment` | deadline passed | `cancelled` | `fulfilment.release-reservation.v1`, `billing.cancel-card-payment.v1` |
| `awaiting-payment`, `awaiting-shipment` (not shipped) | reservation lapsed | `cancelled` | `billing.cancel-card-payment.v1`; if paid: `billing.refund-card-payment.v1` (full, `order-cancelled`) |
| `cancelled` | payment received | `cancelled` | `billing.refund-card-payment.v1` (full, `order-cancelled`) |
| `awaiting-shipment` | shipment dispatched | card: `completed`; invoice: `shipped` | invoice: `billing.issue-invoice.v1` (`pay-by-invoice`, shippedAt) |
| `shipped` (invoice) | payment received (bank transfer) | `completed` | none |
| `awaiting-shipment` (invoice) | payment received (bank transfer) | `awaiting-shipment`, paid | none |
| any | payment with a known payment id, dispatch with a known shipment id | unchanged | none |
| any not cancelled | shipment refused, refund refused | `needs-attention` | none |

Adapters.

- Driving, HTTP (`adapters/driving/http/`), each `(ports) => (req: Request) => Promise<Response>`:
  `add-to-cart.ts` (`POST /api/cart/items`), `set-cart-line-quantity.ts` (`PATCH /api/cart/items`),
  `view-cart.ts` (`GET /api/cart`), `checkout-options.ts` (`GET /api/checkout/options`),
  `place-order.ts` (`POST /api/checkout`). Acting routes require an `Idempotency-Key` header (400
  without); they parse the body with zod and map refusals to problem+json.
- Driving, handlers (`adapters/driving/handlers/`), each a `RegisteredHandler`:
  `on-cms-product-changed.ts` (anti-corruption layer: `CmsProductChanged` to `CatalogItemSource`:
  euros to cents, unknown tax class to `null`, `status === "published"` to `published`),
  `on-cms-product-deleted.ts`, `on-payment-received.ts`, `on-customer-standing-changed.ts`,
  `on-shipment-dispatched.ts`, `on-shipment-refused.ts`, `on-reservation-lapsed.ts`,
  `on-refund-refused.ts`, `on-order-placed.ts` (private), `on-catalog-changed.ts` (private).
- Driving, scheduled tasks (`adapters/driving/scheduled/`): `cancel-overdue-orders.ts`
  (`* * * * *`), `rebuild-catalog-replica.ts` (`0 3 * * *`).
- Driving, **hooks** Payload renders (`adapters/driving/admin/`): `orders-view.tsx`,
  `order-view.tsx` (React server components), reaching ports through `orderingAdminCourier`
  (`adapters/driving/admin/courier.ts`).
- Driven (`adapters/driven/`): `drizzle/schema.ts` (tables in `pgSchema("ordering")`),
  `drizzle/unit-of-work.ts` (`DrizzleOrderingUnitOfWork`), `drizzle/cart-repository.ts`,
  `drizzle/order-repository.ts`, `drizzle/customer-repository.ts`, `drizzle/catalog-replica.ts`,
  `drizzle/customer-standing-replica.ts`, `drizzle/outbox.ts` (buffers appends, inserts them at
  commit with the active trace context, issues `NOTIFY outbox_ordering`), `drizzle/outbox-reader.ts`
  (`OutboxReader` for the relay), `mail/http-order-mailer.ts`, `cms/payload-catalog-source.ts`
  (anti-corruption layer over Payload REST), `storefront/http-storefront-cache.ts` (POSTs
  `/api/revalidate` on `web` with a shared secret), `ids.ts` (uuidv7, uuidv5).
- Fakes (`adapters/driven/memory/`): `MemoryOrderingUnitOfWork` (copy-on-write maps, discarded on
  throw; a mutex per idempotency key and per aggregate id mimics row locks; version checks throw
  `ConcurrencyConflict` as Drizzle does), `MemoryOrderMailer` (records), `MemoryStorefrontCache`,
  `MemoryCatalogSource`, `FixedClock`, `SequenceIds`.

### billing

Published language and open host service (`packages/billing/src/offer/published-language.ts`,
hand-written zod schemas; types are `z.infer` of them):

```ts
import type { Acting, Instant } from "@teashop/common/pure";
import type { Money, Sku, TaxClass } from "@teashop/kernel";

export type BillingAddress = { name: string; line1: string; line2: string | null; postalCode: string; city: string; country: string };

// open host service
export type StartCardPayment = Acting<
  { orderRef: string; customerRef: string; amount: Money; expiresAt: Instant },
  { paymentId: string; confirmationSecret: string },
  { code: "amount-not-positive" } | { code: "provider-unavailable" }
>;

// commands billing takes
export type IssueInvoiceCommand = {
  orderRef: string; customerRef: string;
  customer: { name: string; email: string; billingAddress: BillingAddress };
  lines: readonly { sku: Sku; description: string; unitPrice: Money; taxClass: TaxClass; quantity: number }[]; // gross prices
  basis: { kind: "paid-by-card"; paymentId: string } | { kind: "pay-by-invoice"; shippedAt: Instant };
};
export type CancelCardPaymentCommand = { orderRef: string };
export type RefundCardPaymentCommand = { orderRef: string; refundRequestRef: string; amount: Money; reason: "order-cancelled" | "customer-request" };

// events billing publishes
export type PaymentReceived = { orderRef: string; paymentId: string; method: "card" | "bank-transfer"; amount: Money; receivedAt: Instant };
export type CustomerStandingChanged = { customerRef: string; inDunning: boolean; stage: "none" | "first-reminder" | "second-reminder" | "final-notice" | "collection"; standingVersion: number };
export type RefundRefused = { orderRef: string; refundRequestRef: string; reason: "charge-disputed" | "exceeds-refundable" | "not-captured" };

export const billingMessageTypes = {
  issueInvoice: "billing.issue-invoice.v1", cancelCardPayment: "billing.cancel-card-payment.v1",
  refundCardPayment: "billing.refund-card-payment.v1", paymentReceived: "billing.payment-received.v1",
  customerStandingChanged: "billing.customer-standing-changed.v1", refundRefused: "billing.refund-refused.v1",
} as const;
```

Driving ports (`packages/billing/src/ports/driving.ts`):

```ts
export type IssueInvoice = Acting<IssueInvoiceCommand, { invoiceNumber: string }, never>; // a second for one orderRef answers the first
export type CancelCardPayment = Acting<CancelCardPaymentCommand, null, never>;
export type RefundCardPayment = Acting<RefundCardPaymentCommand, { refundId: string }, { code: "charge-disputed" } | { code: "exceeds-refundable" } | { code: "not-captured" }>;
export type RecordCardPaymentSucceeded = Acting<{ providerRef: string; amount: Money; succeededAt: Instant }, null, never>;
export type RecordCardPaymentFailed = Acting<{ providerRef: string; failedAt: Instant }, null, never>;
export type RecordDisputeOpened = Acting<{ providerRef: string; openedAt: Instant }, null, never>;
export type RecordDisputeClosed = Acting<{ providerRef: string; outcome: "won" | "lost"; closedAt: Instant }, null, never>;
export type SubmitRefund = Acting<{ refundId: string }, null, never>;           // private step
export type SettleRefund = Acting<{ refundId: string; outcome: "succeeded" | "failed"; at: Instant }, null, never>;
export type CancelProviderPayment = Acting<{ paymentId: string }, null, never>;  // private step
export type ImportBankTransfers = Acting<{ now: Instant }, { imported: number; matched: number }, never>;
export type MatchTransfer = Acting<{ transferId: string; invoiceNumber: string }, null, { code: "amount-mismatch" } | { code: "invoice-not-open" } | { code: "transfer-already-matched" }>;
export type RunDunning = Acting<{ today: Instant }, { remindersQueued: number }, never>;
export type SendDunningReminder = Acting<{ reminderId: string }, null, never>;   // private step
export type ExpireCardPayments = Acting<{ now: Instant }, { cancelled: number }, never>;
export type ReconcileCardPayments = Acting<{ now: Instant }, { repaired: number }, never>;
export type ListInvoices = Answering<{ status: "open" | "paid" | "overdue" | null; cursor: string | null; limit: number }, Page<InvoiceSummary>>;
export type GetInvoice = Answering<{ invoiceNumber: string }, InvoiceDetail | null>;
export type ListUnmatchedTransfers = Answering<{ cursor: string | null; limit: number }, Page<TransferSummary>>;
export type ListCardPayments = Answering<{ orderRef: string }, readonly CardPaymentSummary[]>;

export type BillingPorts = {
  startCardPayment: StartCardPayment; issueInvoice: IssueInvoice; cancelCardPayment: CancelCardPayment;
  refundCardPayment: RefundCardPayment; recordCardPaymentSucceeded: RecordCardPaymentSucceeded;
  recordCardPaymentFailed: RecordCardPaymentFailed; recordDisputeOpened: RecordDisputeOpened;
  recordDisputeClosed: RecordDisputeClosed; submitRefund: SubmitRefund; settleRefund: SettleRefund;
  cancelProviderPayment: CancelProviderPayment; importBankTransfers: ImportBankTransfers;
  matchTransfer: MatchTransfer; runDunning: RunDunning; sendDunningReminder: SendDunningReminder;
  expireCardPayments: ExpireCardPayments; reconcileCardPayments: ReconcileCardPayments;
  listInvoices: ListInvoices; getInvoice: GetInvoice; listUnmatchedTransfers: ListUnmatchedTransfers;
  listCardPayments: ListCardPayments;
};
```

Driven ports (`packages/billing/src/ports/driven.ts`):

```ts
export interface BillingUnitOfWork {
  act<T extends Json>(meta: ActingMeta, work: (tx: BillingTx) => Promise<T>): Promise<T>;
  answered<T extends Json>(meta: ActingMeta, schema: ZodType<T>): Promise<T | undefined>;
  read<T>(work: (reads: BillingReads) => Promise<T>): Promise<T>;
}
export type BillingTx = {
  readonly cardPayments: CardPaymentRepository; readonly refunds: RefundRepository;
  readonly invoices: InvoiceRepository; readonly creditNotes: CreditNoteRepository;
  readonly numbers: NumberSequenceRepository; readonly transfers: BankTransferRepository;
  readonly dunning: DunningCaseRepository; readonly bankCursor: BankCursorStore; readonly outbox: BillingOutbox;
};
export interface CardPaymentRepository {
  load(id: PaymentId): Promise<CardPayment | null>; byOrderRef(orderRef: string): Promise<CardPayment | null>;
  byProviderRef(providerRef: string): Promise<CardPayment | null>; save(p: CardPayment): Promise<void>;
  findExpired(now: Instant, limit: number): Promise<readonly PaymentId[]>;
}
export interface RefundRepository { load(id: RefundId): Promise<Refund | null>; byRequestRef(ref: string): Promise<Refund | null>; save(r: Refund): Promise<void> }
export interface InvoiceRepository {
  load(number: InvoiceNumber): Promise<Invoice | null>; byOrderRef(orderRef: string): Promise<Invoice | null>;
  openByCustomer(customerRef: string): Promise<readonly Invoice[]>; customersWithOverdue(today: Instant): Promise<readonly string[]>;
  save(i: Invoice): Promise<void>;
}
export interface CreditNoteRepository { save(c: CreditNote): Promise<void> }
export interface NumberSequenceRepository {
  /** Locks the sequence row until the transaction ends: issuance of one kind and year is serialised. */
  loadForUpdate(kind: "invoice" | "credit-note", year: number): Promise<NumberSequence>;
  save(s: NumberSequence): Promise<void>;
}
export interface BankTransferRepository { add(t: BankTransfer): Promise<"added" | "known">; load(id: TransferId): Promise<BankTransfer | null>; save(t: BankTransfer): Promise<void> }
export interface DunningCaseRepository { load(customerRef: string): Promise<DunningCase | null>; save(c: DunningCase): Promise<void> }
export interface BankCursorStore { get(): Promise<BankCursor | null>; set(c: BankCursor): Promise<void> }
export interface BillingOutbox { append(message: BillingOutgoing): void } // PaymentReceived | CustomerStandingChanged | RefundRefused | private steps

export interface CardGateway {
  createPayment(req: { paymentId: PaymentId; orderRef: string; amount: Money; expiresAt: Instant }): Promise<{ providerRef: string; confirmationSecret: string }>; // idempotent on paymentId
  cancelPayment(providerRef: string): Promise<"cancelled" | "already-succeeded">;
  refund(req: { refundId: RefundId; providerRef: string; amount: Money }): Promise<"succeeded" | "pending" | "failed">; // idempotent on refundId
  paymentsCreatedSince(since: Instant): AsyncIterable<{ providerRef: string; paymentId: PaymentId | null; status: "pending" | "succeeded" | "cancelled" | "failed" }>;
}
export interface BankStatements {
  since(cursor: BankCursor | null): Promise<{ transfers: readonly IncomingTransfer[]; next: BankCursor }>;
}
export type IncomingTransfer = { bankTransactionId: string; amount: Money; reference: string; payerName: string; bookedAt: Instant };
export interface BillingMailer { sendDunningReminder(mail: DunningReminderMail, idempotencyKey: string): Promise<void> }
export interface Clock { now(): Instant }
export interface BillingIds { paymentId(): PaymentId; refundId(): RefundId; transferId(): TransferId; reminderId(): ReminderId }
```

Domain (`packages/billing/src/domain/`): `card-payment.ts` (pending, succeeded, failed, cancelled;
`disputed`; `requestRefund` refuses `charge-disputed`, `not-captured`, `exceeds-refundable`),
`refund.ts` (requested, succeeded, failed; `settle` issues the credit note decision), `invoice.ts`
(`issue` from the command: number, issue date, due date = shippedAt + 14 days for
`pay-by-invoice`, paid at issue for `paid-by-card`), `vat.ts` (`vatRate(taxClass)`: tea 7 %,
accessories 19 %; net from gross per line, rounded half-up to cents), `number-sequence.ts`
(`next()`: `RE-2026-000123`, `GS-2026-000017`), `credit-note.ts`, `transfer-matching.ts`
(`match(transfer, openInvoices)`: an invoice number in the reference and an equal amount, or
none), `dunning.ts` (stage from the oldest overdue invoice: `first-reminder` at due + 7 days,
`second-reminder` at due + 21, `final-notice` at due + 35, `collection` at due + 49; `inDunning`
iff stage is not `none`; each stage change raises the case version and decides one reminder).

Adapters. Driving: `adapters/driving/hooks/stripe-hook.ts` (`POST /hooks/stripe`; verifies
`Stripe-Signature`; anti-corruption layer from `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.dispute.created`, `charge.dispute.closed`,
`refund.updated` to the ports above; key = Stripe event id; other types answered 200 and
ignored); handlers `on-issue-invoice.ts`, `on-cancel-card-payment.ts`, `on-refund-card-payment.ts`,
`on-submit-refund.ts` (private), `on-cancel-provider-payment.ts` (private),
`on-send-dunning-reminder.ts` (private); scheduled tasks `import-bank-transfers.ts`
(`*/10 * * * *`), `run-dunning.ts` (`0 6 * * *`), `expire-card-payments.ts` (`* * * * *`),
`reconcile-card-payments.ts` (`30 3 * * *`); admin **hooks** `invoices-view.tsx`,
`invoice-view.tsx` (refund button calls `refundCardPayment` with reason `customer-request`),
`unmatched-transfers-view.tsx` (manual match calls `matchTransfer`). Driven:
`drizzle/*` (as ordering, schema `billing`), `stripe/stripe-card-gateway.ts` (anti-corruption
layer; `client_secret` becomes `confirmationSecret`; `idempotencyKey` = our payment or refund id;
`metadata.paymentId`, `metadata.orderRef`), `bank/http-bank-statements.ts`,
`mail/http-billing-mailer.ts`. Fakes: `memory/*`, `FakeCardGateway` (deterministic secrets,
idempotent per key as Stripe is, scriptable failures and refused cancels), `FakeBankStatements`.

### fulfilment

Published language and open host service (`packages/fulfilment/src/offer/published-language.ts`):

```ts
export type ReserveStock = Acting<
  { orderRef: string; lines: readonly { sku: Sku; quantity: number }[]; expiresAt: Instant },
  { reservationId: string },
  { code: "insufficient-stock"; skus: readonly Sku[] }
>;
export type ReleaseStock = Acting<{ orderRef: string }, null, never>;
export type StockLevels = Answering<{ skus: readonly Sku[] }, readonly { sku: Sku; onHand: number; reserved: number; available: number }[]>;

// commands fulfilment takes
export type ConfirmReservationCommand = { orderRef: string };
export type ReleaseReservationCommand = { orderRef: string };
export type ShipOrderCommand = {
  orderRef: string;
  shipTo: { name: string; line1: string; line2: string | null; postalCode: string; city: string; country: string };
  lines: readonly { sku: Sku; name: string; quantity: number }[];
};
// events fulfilment publishes
export type ReservationLapsed = { orderRef: string; lapsedAt: Instant };
export type ShipmentDispatched = { orderRef: string; shipmentId: string; dispatchedAt: Instant; trackingUrl: string | null };
export type ShipmentRefused = { orderRef: string; reason: "no-reservation" };

export const fulfilmentMessageTypes = {
  confirmReservation: "fulfilment.confirm-reservation.v1", releaseReservation: "fulfilment.release-reservation.v1",
  shipOrder: "fulfilment.ship-order.v1", reservationLapsed: "fulfilment.reservation-lapsed.v1",
  shipmentDispatched: "fulfilment.shipment-dispatched.v1", shipmentRefused: "fulfilment.shipment-refused.v1",
} as const;
```

Driving ports (`packages/fulfilment/src/ports/driving.ts`):

```ts
export type ConfirmReservation = Acting<ConfirmReservationCommand, null, never>;
export type ShipOrder = Acting<ShipOrderCommand, { shipmentId: string }, never>;            // refusal goes out as ShipmentRefused
export type RegisterArticle = Acting<{ sku: Sku; name: string; sourceVersion: string }, null, never>;
export type SubmitShipment = Acting<{ shipmentId: string }, null, never>;                   // private step
export type RecordShipmentDispatched = Acting<{ shipmentId: string; warehouseRef: string; dispatchedAt: Instant; trackingUrl: string | null }, null, never>;
export type RecordShipmentDelivered = Acting<{ shipmentId: string; deliveredAt: Instant }, null, never>;
export type LapseExpiredReservations = Acting<{ now: Instant }, { lapsed: number }, never>;
export type SyncStockLevels = Acting<{ now: Instant }, { updated: number }, never>;
export type ReconcileShipments = Acting<{ now: Instant }, { repaired: number; needsAttention: number }, never>;
export type ListShipments = Answering<{ status: ShipmentStatus | null; cursor: string | null; limit: number }, Page<ShipmentSummary>>;
export type GetShipment = Answering<{ orderRef: string }, ShipmentDetail | null>;

export type FulfilmentPorts = {
  reserveStock: ReserveStock; releaseStock: ReleaseStock; stockLevels: StockLevels;
  confirmReservation: ConfirmReservation; shipOrder: ShipOrder; registerArticle: RegisterArticle;
  submitShipment: SubmitShipment; recordShipmentDispatched: RecordShipmentDispatched;
  recordShipmentDelivered: RecordShipmentDelivered; lapseExpiredReservations: LapseExpiredReservations;
  syncStockLevels: SyncStockLevels; reconcileShipments: ReconcileShipments;
  listShipments: ListShipments; getShipment: GetShipment;
};
```

Driven ports (`packages/fulfilment/src/ports/driven.ts`):

```ts
export interface FulfilmentUnitOfWork {
  act<T extends Json>(meta: ActingMeta, work: (tx: FulfilmentTx) => Promise<T>): Promise<T>;
  answered<T extends Json>(meta: ActingMeta, schema: ZodType<T>): Promise<T | undefined>;
  read<T>(work: (reads: FulfilmentReads) => Promise<T>): Promise<T>;
}
export type FulfilmentTx = {
  readonly stock: StockItemRepository; readonly reservations: ReservationRepository;
  readonly articles: ArticleRepository; readonly shipments: ShipmentRepository; readonly outbox: FulfilmentOutbox;
};
export interface StockItemRepository { load(skus: readonly Sku[]): Promise<readonly StockItem[]>; save(items: readonly StockItem[]): Promise<void> } // sorted by sku; version-checked
export interface ReservationRepository { byOrderRef(orderRef: string): Promise<Reservation | null>; save(r: Reservation): Promise<void>; findExpired(now: Instant, limit: number): Promise<readonly string[]> }
export interface ArticleRepository { load(sku: Sku): Promise<Article | null>; save(a: Article): Promise<void> }
export interface ShipmentRepository {
  load(id: ShipmentId): Promise<Shipment | null>; byOrderRef(orderRef: string): Promise<Shipment | null>;
  save(s: Shipment): Promise<void>; findSubmittedBefore(at: Instant, limit: number): Promise<readonly ShipmentId[]>;
}
export interface FulfilmentOutbox { append(message: FulfilmentOutgoing): void }
export interface Warehouse {
  registerArticle(article: { sku: Sku; name: string }): Promise<void>;                       // upsert at the 3PL
  submitShipment(s: { shipmentId: ShipmentId; shipTo: ShipTo; lines: readonly { sku: Sku; quantity: number }[] }): Promise<{ warehouseRef: string }>; // idempotent on shipmentId
  stockCounts(): Promise<readonly { sku: Sku; onHand: number; countedAt: Instant }[]>;
  shipmentStatus(shipmentId: ShipmentId): Promise<{ status: "unknown" | "open" | "dispatched" | "delivered"; warehouseRef: string | null; dispatchedAt: Instant | null }>;
}
export interface Clock { now(): Instant }
export interface FulfilmentIds { reservationId(): string; shipmentId(): ShipmentId }
```

Domain (`packages/fulfilment/src/domain/`): `stock-item.ts` (`reserve(qty)`: refused when
`onHand - reserved < qty`; `release`, `consume`, `applyCount`), `reservation.ts` (held with
expiry, confirmed, released by command, lapsed, consumed; `confirm` on a lapsed one re-reserves or
decides `ReservationLapsed`; `confirm` on a released one does nothing), `article.ts`,
`shipment.ts` (requested, submitted, dispatched, delivered, `needs-attention`; may be submitted only
when every sku's `Article` is registered), `reserve.ts` (`reserveLines(items, lines, now, expiresAt)`:
all or none).

Adapters. Driving: hooks `adapters/driving/hooks/warehouse-hook.ts` (`POST /hooks/warehouse`;
HMAC `X-Signature`; anti-corruption layer from the 3PL's `shipment.dispatched`,
`shipment.delivered`; key = 3PL event id; our `shipmentId` travels as the 3PL's external
reference) and `adapters/driving/cms/stock-field.tsx` (a Payload `ui` field component; calls
`stockLevels` through `fulfilmentCmsCourier`; renders "unavailable" on failure); handlers
`on-cms-product-changed.ts` (anti-corruption layer to `registerArticle`),
`on-confirm-reservation.ts`, `on-release-reservation.ts`, `on-ship-order.ts`,
`on-submit-shipment.ts` (private); scheduled tasks `lapse-expired-reservations.ts` (`* * * * *`),
`sync-stock-levels.ts` (`*/15 * * * *`), `reconcile-shipments.ts` (`0 * * * *`); admin **hooks**
`shipments-view.tsx`. Driven: `drizzle/*` (schema `fulfilment`), `warehouse/http-warehouse.ts`.
Fakes: `memory/*`, `FakeWarehouse`.

### cms (external system; our configuration)

```ts
// packages/cms/src/published-language.ts — what cms publishes through its outbox
export type CmsProductChanged = {
  productId: string; updatedAt: string;            // ISO; the version readers compare
  slug: string; title: string; descriptionHtml: string; imageUrls: readonly string[];
  price: number;                                   // EUR, at most two decimals, > 0
  sku: string; taxClass: string; status: "draft" | "published";
};
export type CmsProductDeleted = { productId: string; deletedAt: string };
// packages/cms/src/index.ts
export function cmsCollections(options: { stockField: string /* import-map path */ }): CollectionConfig[];
```

`collections/products.ts` declares the fields and rules; `hooks/write-product-outbox.ts`
(`afterChange`, `afterDelete`) calls `req.payload.create({ collection: "outbox-messages", data, req })`,
passing `req` so the write joins Payload's transaction; `collections/outbox-messages.ts` is hidden,
with access `() => false` for every operation from the admin and REST.

## Calls and messages

### Synchronous calls between systems (in-process function calls)

| Caller (use case) | Callee port | When | How a refusal comes back | Infrastructure failure |
|---|---|---|---|---|
| ordering `placeOrder` | fulfilment `reserveStock` (key `ordering:<orderId>:reserve`, `expiresAt` = deadline + 15 min, or placed + 15 min for invoice) | before ordering opens its transaction | `{ ok: false, error: { code: "insufficient-stock", skus } }`; ordering answers `out-of-stock` | throws; ordering answers 503 |
| ordering `placeOrder` | billing `startCardPayment` (key `ordering:<orderId>:card`, `expiresAt` = payment deadline) | card only, after the reservation, before ordering's transaction | `provider-unavailable` becomes `card-payment-unavailable`; ordering then calls `releaseStock` | throws; ordering calls `releaseStock`, answers 503 |
| ordering `placeOrder` | fulfilment `releaseStock` (key `ordering:<orderId>:release`) | a later step before ordering's commit failed | never refuses | logged; the reservation lapses at `expiresAt` |
| Payload admin (`cms`) | fulfilment `stockLevels` via **hook** `StockField` | editor opens a product | n/a (answering) | field shows "unavailable" |
| Payload admin (`cms`) | ordering `listOrders`/`getOrder`; billing `listInvoices`/`getInvoice`/`listUnmatchedTransfers`/`listCardPayments`/`refundCardPayment`/`matchTransfer`; fulfilment `listShipments`/`getShipment` via admin **hooks** | operator | `Result` errors rendered in the view | error boundary |

Calls to external systems: billing → Stripe (`createPayment`, `cancelPayment`, `refund`,
`paymentsCreatedSince`); billing → bank (`since`); billing → mail; fulfilment → 3PL
(`registerArticle`, `submitShipment`, `stockCounts`, `shipmentStatus`); ordering → mail; ordering
→ `cms` REST (`CatalogSource.all`, reconciliation only); ordering → `web` `/api/revalidate`
(`StorefrontCache`). Each throws on failure; the handler or scheduled task that ran it throws, and
the bus redelivers.

### Hooks (external systems driving this codebase)

| Route / place | System | Settles when | Refusal |
|---|---|---|---|
| `POST /hooks/stripe` | billing | 200 after the port's transaction commits | 400 on bad signature (Stripe stops); 500 on throw (Stripe retries up to 3 days) |
| `POST /hooks/warehouse` | fulfilment | 200 after commit | 401 bad HMAC; 500 on throw (3PL retries) |
| Payload `ui` field `StockField` | fulfilment | render | n/a |
| Payload custom views `/admin/operations/*` | ordering, billing, fulfilment | render / server action | problem shown in the view |

### Messages

Every message: written to the writer's `outbox` in the transaction that decided it; relayed by
`startRelay` to `pg-boss` after commit; delivered to every queue subscribed to its type. A
handler settles by resolving (pg-boss completes the job); a throw redelivers with exponential
backoff (`retryLimit: 10`, `retryDelay: 5`, `retryBackoff: true`), then the job moves to
`<queue>.parked`. A command's business refusal is never a throw: the handler settles it and the
receiving system publishes a refusal event in its own published language.

| Type | Kind | Published / private | Writer (outbox) | Handlers (queue) | Refusal |
|---|---|---|---|---|---|
| `cms.product-changed.v1` | event | published | `cms` (`outbox-messages`, read by assembly's `cmsOutboxReader`) | `ordering.on-cms-product-changed`, `fulfilment.on-cms-product-changed` | n/a |
| `cms.product-deleted.v1` | event | published | `cms` | `ordering.on-cms-product-deleted` | n/a |
| `fulfilment.confirm-reservation.v1` | command | published (fulfilment's) | ordering | `fulfilment.on-confirm-reservation` | lapsed and stock gone: fulfilment publishes `fulfilment.reservation-lapsed.v1` |
| `fulfilment.release-reservation.v1` | command | published (fulfilment's) | ordering | `fulfilment.on-release-reservation` | never refused |
| `fulfilment.ship-order.v1` | command | published (fulfilment's) | ordering | `fulfilment.on-ship-order` | no live reservation: `fulfilment.shipment-refused.v1` |
| `fulfilment.reservation-lapsed.v1` | event | published | fulfilment | `ordering.on-reservation-lapsed` | n/a |
| `fulfilment.shipment-dispatched.v1` | event | published | fulfilment | `ordering.on-shipment-dispatched` | n/a |
| `fulfilment.shipment-refused.v1` | event | published | fulfilment | `ordering.on-shipment-refused` | n/a |
| `fulfilment.submit-shipment.v1` | command | private | fulfilment | `fulfilment.on-submit-shipment` | n/a |
| `billing.issue-invoice.v1` | command | published (billing's) | ordering | `billing.on-issue-invoice` | never refused; a second for one `orderRef` answers the first |
| `billing.cancel-card-payment.v1` | command | published (billing's) | ordering | `billing.on-cancel-card-payment` | already succeeded: settled, nothing changes (its `payment-received` is already on its way, and ordering refunds) |
| `billing.refund-card-payment.v1` | command | published (billing's) | ordering | `billing.on-refund-card-payment` | disputed, not captured, too much: `billing.refund-refused.v1` |
| `billing.payment-received.v1` | event | published | billing | `ordering.on-payment-received` | n/a |
| `billing.customer-standing-changed.v1` | event | published | billing | `ordering.on-customer-standing-changed` | n/a |
| `billing.refund-refused.v1` | event | published | billing | `ordering.on-refund-refused` | n/a |
| `billing.submit-refund.v1` | command | private | billing | `billing.on-submit-refund` | n/a |
| `billing.cancel-provider-payment.v1` | command | private | billing | `billing.on-cancel-provider-payment` | n/a |
| `billing.send-dunning-reminder.v1` | command | private | billing | `billing.on-send-dunning-reminder` | n/a |
| `ordering.order-placed.v1` | event | private | ordering | `ordering.on-order-placed` (confirmation mail) | n/a |
| `ordering.catalog-changed.v1` | event | private | ordering | `ordering.on-catalog-changed` (storefront revalidation) | n/a |

### Scheduled tasks (the clock, through `pg-boss` cron in `worker`)

| Task | Cron | Port | Idempotency key |
|---|---|---|---|
| `ordering.cancel-overdue-orders` | `* * * * *` | `cancelOverdueOrders` | `ordering.cancel-overdue-orders:<minute>`; per order inside: `cancel:<orderId>` |
| `ordering.rebuild-catalog-replica` (**reconciliation**) | `0 3 * * *` | `rebuildCatalogReplica` | `...:<date>` |
| `billing.import-bank-transfers` | `*/10 * * * *` | `importBankTransfers` | `...:<cursor>` |
| `billing.run-dunning` | `0 6 * * *` | `runDunning` | `...:<date>` |
| `billing.expire-card-payments` | `* * * * *` | `expireCardPayments` | `...:<minute>` |
| `billing.reconcile-card-payments` (**reconciliation**) | `30 3 * * *` | `reconcileCardPayments` | `...:<date>` |
| `fulfilment.lapse-expired-reservations` | `* * * * *` | `lapseExpiredReservations` | `...:<minute>` |
| `fulfilment.sync-stock-levels` (**reconciliation**) | `*/15 * * * *` | `syncStockLevels` | `...:<quarter-hour>` |
| `fulfilment.reconcile-shipments` (**reconciliation**) | `0 * * * *` | `reconcileShipments` | `...:<hour>` |

### The checkout, end to end

1. `POST /api/checkout` with `Idempotency-Key: K`; `withRequestContext` sets request id and trace.
2. ordering `placeOrder`: `uow.answered(K)` returns a stored answer if any. Else reads cart, replica
   items, customer, standing (`uow.read`); domain `placeOrder` decides or refuses
   (`cart-changed`, `price-changed`, `product-unavailable`, `invoice-not-offered`); `orderId =
   ids.orderIdFor(cartId, cartVersion)`.
3. `reserveStock` (fulfilment commits a `held` reservation in its own transaction).
4. Card: `startCardPayment` (billing creates the PaymentIntent with Stripe idempotency key
   `paymentId`, commits `CardPayment(pending, expiresAt)`), returns `confirmationSecret`.
5. `retryOnConflict(3, () => uow.act(K, tx => …))`: saves customer, order (with commands), empties
   cart, appends `fulfilment.confirm-reservation.v1` (and for invoice `fulfilment.ship-order.v1`),
   `ordering.order-placed.v1`; stores the answer under K; commits.
6. 201 `{ orderId, total, payment }`. The browser confirms the PaymentIntent with the secret.
7. Stripe → `/hooks/stripe` `payment_intent.succeeded` → billing commits `succeeded` + publishes
   `billing.payment-received.v1` → ordering `recordPaymentReceived` → `fulfilment.ship-order.v1`,
   `billing.issue-invoice.v1` → fulfilment records shipment, private `submit-shipment` → 3PL →
   `/hooks/warehouse` `shipment.dispatched` → `fulfilment.shipment-dispatched.v1` → ordering
   `completed`.

## Processes

### Deployables

| Process | Entry point | Runs | Ways in (driving adapters) |
|---|---|---|---|
| `web` | `node apps/web/.next/standalone/server.js` (Next.js standalone); `apps/web/src/instrumentation.ts` `register()` runs first | Next.js, Payload (`cms`), ordering/billing/fulfilment services for HTTP | storefront pages (UI), `/api/cart*`, `/api/checkout*`, `/api/revalidate` (UI cache), `/hooks/stripe`, `/hooks/warehouse`, Payload admin with its **hooks**, Payload REST `/api/*` (cms's own), probes `/health`, `/metrics` |
| `worker` | `node --import ./dist/otel.js ./dist/main.js` (`apps/worker`) | relay, bus consumers, scheduled tasks, all three systems' services | handlers, scheduled tasks, probes on `:9464` (`/health`, `/metrics`) |
| `migrate` | `node ./dist/main.js` (`apps/migrate`), one-shot job before each rollout | roles and grants, `pg-boss` schema, each system's Drizzle migrations, Payload migrations | none |

`web` runs one or more instances; `worker` runs one or more instances (each relay takes
`pg_try_advisory_lock(hashtext('relay:<name>'))` on a dedicated connection, so one instance relays
each outbox at a time; all instances consume).

### Assembly

`apps/web/src/assembly.ts` (called once from `instrumentation.ts`):

```ts
export async function assemble(env: WebEnv): Promise<WebApp> {
  const pools = {
    ordering: createPool(env.ORDERING_DATABASE_URL, { max: 10 }),
    billing: createPool(env.BILLING_DATABASE_URL, { max: 5 }),
    fulfilment: createPool(env.FULFILMENT_DATABASE_URL, { max: 5 }),
    probe: createPool(env.PROBE_DATABASE_URL, { max: 1 }),
  };
  const fulfilment = buildFulfilment({ pool: pools.fulfilment, warehouse: env.warehouse, clock: systemClock });
  const billing = buildBilling({ pool: pools.billing, stripe: env.stripe, bank: env.bank, mail: env.mail, clock: systemClock });
  const ordering = buildOrdering({
    pool: pools.ordering, mail: env.mail, storefront: env.storefront, cmsApi: env.cmsApi, clock: systemClock,
    upstreams: {
      reserveStock: fulfilment.ports.reserveStock,
      releaseStock: fulfilment.ports.releaseStock,
      startCardPayment: billing.ports.startCardPayment,
    },
  });
  fulfilmentCmsCourier.set({ stockLevels: fulfilment.ports.stockLevels });
  orderingAdminCourier.set(ordering.adminPorts);
  billingAdminCourier.set(billing.adminPorts);
  fulfilmentAdminCourier.set(fulfilment.adminPorts);
  return {
    routes: { ...ordering.routes, ...billing.hooks, ...fulfilment.hooks }, // (req: Request) => Promise<Response>
    probes: { health: createHealthProbe(pools.probe), metrics: renderMetrics },
  };
}
```

`webCourier.set(await assemble(readWebEnv()))` in `instrumentation.ts`; each route file is one
line, e.g. `export const POST = withRequestContext((req) => webCourier.get().routes.placeOrder(req));`.

`apps/worker/src/assembly.ts` builds the same three systems with the `worker` variants of the
builders (`buildOrderingWorker`, …), which return `{ ports, handlers, scheduledTasks, outboxReader }`;
adds `cmsOutboxReader(createPool(env.CMS_DATABASE_URL))`; returns
`{ handlers, scheduledTasks, outboxReaders }`. `main.ts`: start `pg-boss`
(`migrate: false`), `bus.subscribe(handlers)`, `bus.schedule(scheduledTasks)`,
`startRelay(outboxReaders, bus, signal)`, `startProbeServer(9464)`; on `SIGTERM`: abort the relay,
`boss.stop({ graceful: true, timeout: 30_000 })`, end pools.

System builders (`packages/<system>/src/build.ts`, exported as `@teashop/<system>/build`):

```ts
export function buildOrdering(config: OrderingWebConfig): {
  ports: OrderingPorts; adminPorts: Pick<OrderingPorts, "listOrders" | "getOrder">;
  routes: { addToCart: Route; setCartLineQuantity: Route; viewCart: Route; checkoutOptions: Route; placeOrder: Route };
};
export function buildOrderingWorker(config: OrderingWorkerConfig): {
  ports: OrderingPorts; handlers: readonly RegisteredHandler[]; scheduledTasks: readonly ScheduledTask[]; outboxReader: OutboxReader;
};
export function buildOrderingInMemory(overrides: Partial<OrderingDeps>): { ports: OrderingPorts; deps: OrderingDeps }; // tests
```

### Migrations and deploy order

- `apps/migrate/sql/roles.sql` (idempotent): roles `ordering`, `billing`, `fulfilment`, `cms`,
  `bus`, `probe`, `migrator`; schemas `ordering`, `billing`, `fulfilment`, `cms`, `pgboss`, each
  owned by `migrator`; `GRANT USAGE` and DML on a schema to its role only; `probe` gets `CONNECT`
  only.
- `pg-boss` schema: `new PgBoss({ connectionString: MIGRATOR_URL, schema: "pgboss", migrate: true }).start()` then stop.
- Per system: `migrate(drizzle(pool), { migrationsFolder: "packages/<s>/drizzle", migrationsSchema: "<s>", migrationsTable: "__migrations" })`, in the order fulfilment, billing, ordering (order is irrelevant: no migration touches two schemas).
- Payload: `const payload = await getPayload({ config }); await payload.db.migrate();` with migrations in `packages/cms/migrations` (Payload `push: false` outside development).
- Migrations are expand-only (`NNNN_<name>.sql`); destructive changes go in `NNNN_<name>.contract.sql`, shipped one release after the code stopped reading the column; `tooling/check-migrations.ts` fails CI on `DROP`, `RENAME`, `ALTER … TYPE`, `SET NOT NULL` outside `.contract.sql`.
- Rollout: `migrate` → `worker` (consumers of any new message version first) → `web`. A new message version is written by producers only in the release after the one that taught its consumers.

## Directory tree

```
teashop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .dependency-cruiser.cjs
├── vitest.workspace.ts
├── docker-compose.yml
├── tooling/
│   ├── biome/no-math-random.grit
│   ├── biome/no-top-level-let.grit
│   ├── check-migrations.ts
│   └── replay-parked.ts
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── instrumentation.ts
│   │       ├── otel.ts
│   │       ├── env.ts
│   │       ├── courier.ts
│   │       ├── assembly.ts
│   │       ├── payload.config.ts
│   │       └── app/
│   │           ├── (shop)/layout.tsx
│   │           ├── (shop)/page.tsx
│   │           ├── (shop)/products/[slug]/page.tsx
│   │           ├── (shop)/cart/page.tsx
│   │           ├── (shop)/checkout/page.tsx
│   │           ├── (payload)/layout.tsx
│   │           ├── (payload)/admin/[[...segments]]/page.tsx
│   │           ├── (payload)/admin/[[...segments]]/not-found.tsx
│   │           ├── (payload)/admin/importMap.js
│   │           ├── (payload)/api/[...slug]/route.ts
│   │           ├── api/cart/route.ts
│   │           ├── api/cart/items/route.ts
│   │           ├── api/checkout/route.ts
│   │           ├── api/checkout/options/route.ts
│   │           ├── api/revalidate/route.ts
│   │           ├── hooks/stripe/route.ts
│   │           ├── hooks/warehouse/route.ts
│   │           ├── health/route.ts
│   │           └── metrics/route.ts
│   ├── worker/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── otel.ts
│   │       ├── env.ts
│   │       ├── assembly.ts
│   │       ├── cms-outbox-reader.ts
│   │       ├── probe-server.ts
│   │       └── main.ts
│   └── migrate/
│       ├── package.json
│       ├── sql/roles.sql
│       └── src/main.ts
└── packages/
    ├── common/
    │   ├── package.json            # exports ./pure ./messaging ./observability ./db ./http ./courier ./testing
    │   ├── src/
    │   │   ├── pure/index.ts
    │   │   ├── pure/result.ts
    │   │   ├── pure/instant.ts
    │   │   ├── pure/json.ts
    │   │   ├── pure/acting.ts
    │   │   ├── messaging/envelope.ts
    │   │   ├── messaging/outbox-reader.ts
    │   │   ├── messaging/handler.ts
    │   │   ├── messaging/scheduled-task.ts
    │   │   ├── messaging/relay.ts
    │   │   ├── messaging/pg-boss-bus.ts
    │   │   ├── messaging/trace-propagation.ts
    │   │   ├── observability/logger.ts
    │   │   ├── observability/otel-sdk.ts
    │   │   ├── observability/request-context.ts
    │   │   ├── observability/metrics.ts
    │   │   ├── observability/health-probe.ts
    │   │   ├── db/pool.ts
    │   │   ├── db/processed-calls.ts
    │   │   ├── db/concurrency.ts
    │   │   ├── http/problem.ts
    │   │   ├── http/route.ts
    │   │   ├── courier.ts
    │   │   ├── clock.ts
    │   │   ├── ids.ts
    │   │   └── testing/in-memory-bus.ts
    │   └── test/ (mirrors src)
    ├── kernel/
    │   ├── package.json
    │   ├── src/index.ts
    │   ├── src/money.ts
    │   ├── src/sku.ts
    │   ├── src/tax-class.ts
    │   └── test/money.test.ts
    ├── cms/
    │   ├── package.json
    │   ├── migrations/
    │   └── src/
    │       ├── index.ts
    │       ├── published-language.ts
    │       ├── collections/products.ts
    │       ├── collections/media.ts
    │       ├── collections/users.ts
    │       ├── collections/outbox-messages.ts
    │       ├── hooks/write-product-outbox.ts
    │       └── hooks/render-description.ts
    ├── ordering/
    │   ├── package.json            # exports "." (offer), "./build", "./fakes", "./cms-admin"
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── drizzle/0000_init.sql
    │   ├── src/
    │   │   ├── offer/index.ts
    │   │   ├── offer/fakes.ts
    │   │   ├── build.ts
    │   │   ├── domain/index.ts
    │   │   ├── domain/cart.ts
    │   │   ├── domain/order.ts
    │   │   ├── domain/order-line.ts
    │   │   ├── domain/order-command.ts
    │   │   ├── domain/customer.ts
    │   │   ├── domain/email-address.ts
    │   │   ├── domain/catalog-item.ts
    │   │   ├── domain/customer-standing.ts
    │   │   ├── domain/place-order.ts
    │   │   ├── domain/payment-deadline.ts
    │   │   ├── domain/invoice-payment-offered.ts
    │   │   ├── service/index.ts
    │   │   ├── service/cart.ts
    │   │   ├── service/checkout.ts
    │   │   ├── service/catalog.ts
    │   │   ├── service/order-course.ts
    │   │   ├── service/operations.ts
    │   │   ├── ports/driving.ts
    │   │   ├── ports/driven.ts
    │   │   └── adapters/
    │   │       ├── driving/http/add-to-cart.ts
    │   │       ├── driving/http/set-cart-line-quantity.ts
    │   │       ├── driving/http/view-cart.ts
    │   │       ├── driving/http/checkout-options.ts
    │   │       ├── driving/http/place-order.ts
    │   │       ├── driving/handlers/on-cms-product-changed.ts
    │   │       ├── driving/handlers/on-cms-product-deleted.ts
    │   │       ├── driving/handlers/on-payment-received.ts
    │   │       ├── driving/handlers/on-customer-standing-changed.ts
    │   │       ├── driving/handlers/on-shipment-dispatched.ts
    │   │       ├── driving/handlers/on-shipment-refused.ts
    │   │       ├── driving/handlers/on-reservation-lapsed.ts
    │   │       ├── driving/handlers/on-refund-refused.ts
    │   │       ├── driving/handlers/on-order-placed.ts
    │   │       ├── driving/handlers/on-catalog-changed.ts
    │   │       ├── driving/scheduled/cancel-overdue-orders.ts
    │   │       ├── driving/scheduled/rebuild-catalog-replica.ts
    │   │       ├── driving/admin/courier.ts
    │   │       ├── driving/admin/orders-view.tsx
    │   │       ├── driving/admin/order-view.tsx
    │   │       ├── driven/drizzle/schema.ts
    │   │       ├── driven/drizzle/unit-of-work.ts
    │   │       ├── driven/drizzle/cart-repository.ts
    │   │       ├── driven/drizzle/order-repository.ts
    │   │       ├── driven/drizzle/customer-repository.ts
    │   │       ├── driven/drizzle/catalog-replica.ts
    │   │       ├── driven/drizzle/customer-standing-replica.ts
    │   │       ├── driven/drizzle/outbox.ts
    │   │       ├── driven/drizzle/outbox-reader.ts
    │   │       ├── driven/mail/http-order-mailer.ts
    │   │       ├── driven/cms/payload-catalog-source.ts
    │   │       ├── driven/storefront/http-storefront-cache.ts
    │   │       ├── driven/ids.ts
    │   │       ├── driven/memory/unit-of-work.ts
    │   │       ├── driven/memory/order-mailer.ts
    │   │       ├── driven/memory/storefront-cache.ts
    │   │       └── driven/memory/catalog-source.ts
    │   └── test/
    │       ├── domain/order.test.ts
    │       ├── domain/place-order.test.ts
    │       ├── domain/invoice-payment-offered.test.ts
    │       ├── service/checkout.test.ts
    │       ├── service/order-course.test.ts
    │       ├── ports/driven.contract.ts
    │       ├── adapters/driven/memory/unit-of-work.test.ts
    │       ├── adapters/driven/drizzle/unit-of-work.integration.test.ts
    │       ├── adapters/driving/handlers/on-cms-product-changed.test.ts
    │       └── adapters/driving/http/place-order.test.ts
    ├── billing/
    │   ├── package.json            # exports "." (offer), "./build", "./fakes", "./cms-admin"
    │   ├── GLOSSARY.md
    │   ├── drizzle.config.ts
    │   ├── drizzle/0000_init.sql
    │   ├── src/
    │   │   ├── offer/index.ts
    │   │   ├── offer/published-language.ts
    │   │   ├── offer/published-language.v1.json
    │   │   ├── offer/fakes.ts
    │   │   ├── build.ts
    │   │   ├── domain/card-payment.ts
    │   │   ├── domain/refund.ts
    │   │   ├── domain/invoice.ts
    │   │   ├── domain/vat.ts
    │   │   ├── domain/number-sequence.ts
    │   │   ├── domain/credit-note.ts
    │   │   ├── domain/bank-transfer.ts
    │   │   ├── domain/transfer-matching.ts
    │   │   ├── domain/dunning.ts
    │   │   ├── service/index.ts
    │   │   ├── service/card-payments.ts
    │   │   ├── service/refunds.ts
    │   │   ├── service/invoicing.ts
    │   │   ├── service/bank-transfers.ts
    │   │   ├── service/dunning.ts
    │   │   ├── service/operations.ts
    │   │   ├── ports/driving.ts
    │   │   ├── ports/driven.ts
    │   │   └── adapters/
    │   │       ├── driving/hooks/stripe-hook.ts
    │   │       ├── driving/handlers/on-issue-invoice.ts
    │   │       ├── driving/handlers/on-cancel-card-payment.ts
    │   │       ├── driving/handlers/on-refund-card-payment.ts
    │   │       ├── driving/handlers/on-submit-refund.ts
    │   │       ├── driving/handlers/on-cancel-provider-payment.ts
    │   │       ├── driving/handlers/on-send-dunning-reminder.ts
    │   │       ├── driving/scheduled/import-bank-transfers.ts
    │   │       ├── driving/scheduled/run-dunning.ts
    │   │       ├── driving/scheduled/expire-card-payments.ts
    │   │       ├── driving/scheduled/reconcile-card-payments.ts
    │   │       ├── driving/admin/courier.ts
    │   │       ├── driving/admin/invoices-view.tsx
    │   │       ├── driving/admin/invoice-view.tsx
    │   │       ├── driving/admin/unmatched-transfers-view.tsx
    │   │       ├── driven/drizzle/schema.ts
    │   │       ├── driven/drizzle/unit-of-work.ts
    │   │       ├── driven/drizzle/card-payment-repository.ts
    │   │       ├── driven/drizzle/refund-repository.ts
    │   │       ├── driven/drizzle/invoice-repository.ts
    │   │       ├── driven/drizzle/credit-note-repository.ts
    │   │       ├── driven/drizzle/number-sequence-repository.ts
    │   │       ├── driven/drizzle/bank-transfer-repository.ts
    │   │       ├── driven/drizzle/dunning-case-repository.ts
    │   │       ├── driven/drizzle/bank-cursor-store.ts
    │   │       ├── driven/drizzle/outbox.ts
    │   │       ├── driven/drizzle/outbox-reader.ts
    │   │       ├── driven/stripe/stripe-card-gateway.ts
    │   │       ├── driven/bank/http-bank-statements.ts
    │   │       ├── driven/mail/http-billing-mailer.ts
    │   │       ├── driven/ids.ts
    │   │       ├── driven/memory/unit-of-work.ts
    │   │       ├── driven/memory/card-gateway.ts
    │   │       ├── driven/memory/bank-statements.ts
    │   │       └── driven/memory/billing-mailer.ts
    │   └── test/ (mirrors src; adds offer/published-language.test.ts,
    │             adapters/driven/stripe/stripe-card-gateway.e2e.test.ts)
    └── fulfilment/
        ├── package.json            # exports "." (offer), "./build", "./fakes", "./cms", "./cms-admin"
        ├── GLOSSARY.md
        ├── drizzle.config.ts
        ├── drizzle/0000_init.sql
        ├── src/
        │   ├── offer/index.ts
        │   ├── offer/published-language.ts
        │   ├── offer/published-language.v1.json
        │   ├── offer/fakes.ts
        │   ├── build.ts
        │   ├── domain/stock-item.ts
        │   ├── domain/reservation.ts
        │   ├── domain/reserve.ts
        │   ├── domain/article.ts
        │   ├── domain/shipment.ts
        │   ├── service/index.ts
        │   ├── service/reservations.ts
        │   ├── service/shipping.ts
        │   ├── service/articles.ts
        │   ├── service/stock.ts
        │   ├── service/operations.ts
        │   ├── ports/driving.ts
        │   ├── ports/driven.ts
        │   └── adapters/
        │       ├── driving/hooks/warehouse-hook.ts
        │       ├── driving/cms/courier.ts
        │       ├── driving/cms/stock-field.tsx
        │       ├── driving/handlers/on-cms-product-changed.ts
        │       ├── driving/handlers/on-confirm-reservation.ts
        │       ├── driving/handlers/on-release-reservation.ts
        │       ├── driving/handlers/on-ship-order.ts
        │       ├── driving/handlers/on-submit-shipment.ts
        │       ├── driving/scheduled/lapse-expired-reservations.ts
        │       ├── driving/scheduled/sync-stock-levels.ts
        │       ├── driving/scheduled/reconcile-shipments.ts
        │       ├── driving/admin/courier.ts
        │       ├── driving/admin/shipments-view.tsx
        │       ├── driven/drizzle/schema.ts
        │       ├── driven/drizzle/unit-of-work.ts
        │       ├── driven/drizzle/stock-item-repository.ts
        │       ├── driven/drizzle/reservation-repository.ts
        │       ├── driven/drizzle/article-repository.ts
        │       ├── driven/drizzle/shipment-repository.ts
        │       ├── driven/drizzle/outbox.ts
        │       ├── driven/drizzle/outbox-reader.ts
        │       ├── driven/warehouse/http-warehouse.ts
        │       ├── driven/ids.ts
        │       ├── driven/memory/unit-of-work.ts
        │       └── driven/memory/warehouse.ts
        └── test/ (mirrors src; adds adapters/driven/warehouse/http-warehouse.e2e.test.ts)
```

Test suites (`vitest.workspace.ts`): default suite = `**/*.test.ts` excluding
`*.integration.test.ts` and `*.e2e.test.ts`; `pnpm test:integration` starts Postgres from
`docker-compose.yml` and runs `*.integration.test.ts`; `pnpm test:e2e` runs `*.e2e.test.ts` against
Stripe test mode and the 3PL sandbox.

## How each property holds

**P1. The domain models the business domain and is shaped by nothing that serves it.** Each
`src/domain/` holds hand-written types and functions; Drizzle tables live in
`adapters/driven/drizzle/schema.ts` and map to domain types through `toDomain`/`toRow` functions
in each repository; Stripe, 3PL, Payload and bank shapes stop in their adapters. The
`.dependency-cruiser.cjs` rule `domain-is-pure` forbids a domain module to import anything but its
own domain, `@teashop/kernel`, `@teashop/common/pure` and, for ordering only, the offers of billing
and fulfilment (rule `ordering-conforms-to-billing-and-fulfilment`): those are the only terms that
enter ordering's domain from outside, and ordering's own business rules (deadline, transitions,
invoice offer, snapshot) are its own functions written over them. Replacing Stripe touches
`stripe-card-gateway.ts` and `stripe-hook.ts`; replacing the 3PL touches `http-warehouse.ts` and
`warehouse-hook.ts`; no domain file changes.

**P2. A business rule lives in one place: the domain.** Each rule of the brief has one home:
invoice not offered in dunning, `ordering/domain/invoice-payment-offered.ts`; order line snapshot,
`order-line.ts`; payment deadline, `payment-deadline.ts` and `order.ts`; confirmation once placed,
`order.ts` (decides `order-placed`); refund refused when disputed and credit note per refund,
`billing/domain/card-payment.ts`, `refund.ts`; VAT by tax class, `vat.ts`; gapless numbers,
`number-sequence.ts`; one invoice per order, `invoice.ts`; transfer matching,
`transfer-matching.ts`; dunning stages, `dunning.ts`; reserve and release, `fulfilment/domain/
reservation.ts`, `stock-item.ts`; sku registered before shipping, `shipment.ts`. Price above zero
and sku unique live once, in `cms`'s configuration (`packages/cms/src/collections/products.ts`),
which is the external system's domain (S2); ordering does not check them again. Services hold
sequence only: no service branches on a domain state other than a `Result` the domain returned.
There are no store triggers and no check constraints; the only database constraints are primary
keys, `processed_calls` keys, `bank_transfers.bank_transaction_id` (identity of the bank's record)
and foreign keys inside one aggregate.

**P3. Business rules that change together sit together; rules that change for different reasons
stay apart.** The cut follows reasons to change: what is sold and how it is described (`cms`);
how a customer orders and how the order proceeds (ordering); what money is owed and how it is
collected, card, invoice, VAT, dunning (billing); what is in the warehouse and how it leaves
(fulfilment). A VAT change edits `billing/domain/vat.ts` only, because order lines carry the tax
class, not the rate. A dunning-schedule change edits `billing/domain/dunning.ts` only, because
ordering reads one boolean, `inDunning`. A 3PL change edits fulfilment only. Card payments,
invoices and dunning share one system (wider boundary); the place they split if needed is
`service/dunning.ts` + `domain/dunning.ts`, which touch the rest of billing only through
`InvoiceRepository.openByCustomer`.

**P4. A use case responds the same whoever calls it and whatever serves it.** Each use case is one
function in the object `createXService(deps)` returns. The HTTP route, the handler, the scheduled
task, the Payload admin view and the tests call that same function: `refundCardPayment` is reached
by `on-refund-card-payment.ts` and by `invoice-view.tsx` alike. Driven ports are filled by
`build.ts` with Drizzle and HTTP adapters, or by `buildXInMemory` with fakes; the service code is
the same object either way. Driving adapters translate only: parse, call, map `Result` to status.

**P5. A system reaches the outside, and is reached from it, only through ports assembly hands it;
each port speaks the system's terms.** Services receive every driven port in `deps`; no system
module reads `process.env` (Biome `noProcessEnv` on `packages/**`), imports from `apps/**`, or
holds a module-level client. Builders are imported only by `apps/*/src/assembly.ts`
(`dependency-cruiser` rule `builders-only-in-assembly`). Driving adapters that the host loads by
path (Next route files, Payload components) reach assembly's output through couriers set once by
assembly; couriers are imported only under `adapters/driving/**` and `apps/web/src/app/**` (rule
`courier-only-in-driving-adapters`). Port files may import only domain, kernel, `common/pure`,
`zod` types and the conformed offers (rule `ports-speak-system-terms`), so no Drizzle row,
`Stripe.PaymentIntent` or Payload document type appears in a signature. The exception used: the
logger, tracing, metrics and `retryOnConflict` from the common library, imported directly by
services and adapters; none changes what a use case does or answers. Clock and ids are ports,
because their output does.

**P6. Every use case can run with nothing outside the process, in a test.** Every driven port has a
memory fake in `adapters/driven/memory/`; `buildXInMemory` assembles a service from them, and
cross-system tests wire the three in-memory systems through `createInMemoryBus({ duplicate, reorder })`.
Fakes behave as the outside does where a use case can tell: memory units of work roll back on
throw, block a second call with the same key until the first ends, and throw `ConcurrencyConflict`
on stale versions; `FakeCardGateway` answers repeated keys as Stripe does and can refuse a cancel
after success. Each driven port has one contract suite (`test/ports/driven.contract.ts`) run in
the default suite against the fake and in `*.integration.test.ts` against Drizzle on Postgres;
gateway fakes share contract suites with `*.e2e.test.ts` against Stripe test mode and the 3PL
sandbox.

**P7. A use case's writes to its own system's records land together or not at all.** `uow.act` is
one `db.transaction` on the system's pool; every repository, the outbox and the
`processed_calls` row are bound to that transaction's client, and an acting use case gets no other
way to write. `placeOrder` saves customer, order, cart and outbox rows in one transaction; its
calls to fulfilment and billing happen before it opens the transaction, and their writes are
theirs. A retry after `ConcurrencyConflict` reruns the whole transaction.

**P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and
nothing that follows from it is lost after.** Outgoing messages are rows of the deciding
transaction; the relay reads only committed rows and marks them after `pg-boss` accepted them.
Every effect outside (mail, Stripe refund and cancel, 3PL submission, storefront revalidation) runs
in a handler of a private message the deciding transaction wrote. What `placeOrder` asks of other
systems before its commit is a **tentative operation**: fulfilment's `held` reservation (confirmed
by `confirm-reservation` after the commit; lapsed by `lapse-expired-reservations` at `expiresAt`);
billing's pending card payment, whose PaymentIntent moves no money until the browser confirms it
with a secret the browser receives only in the response sent after the commit (cancelled by
`expire-card-payments` at `expiresAt`; PaymentIntents billing never recorded are cancelled by
`reconcile-card-payments`). `cms` writes its outbox through `req` inside Payload's transaction, so
`cms.product-changed.v1` exists only for committed product changes.

**P9. A repeated delivery changes no record of this system, and succeeds where the first did.**
Every acting call carries an idempotency key: the message id for handlers, the Stripe or 3PL event
id for hooks, the `Idempotency-Key` header for HTTP, `<task>:<slot>` for scheduled tasks.
`uow.act` first runs `INSERT INTO processed_calls (key) VALUES ($1) ON CONFLICT DO NOTHING
RETURNING key`; a repeat finds the row, writes nothing, and returns the stored answer, so it
succeeds where the first did; an overlapping repeat waits on the first's uncommitted row and then
does the same. Domain transitions are also idempotent on natural ids (a known payment id, a known
shipment id, an issued invoice for the `orderRef`). Outbound calls carry keys too: Stripe
`idempotencyKey`, 3PL shipment by `shipmentId`, article by sku upsert. The mail provider may
send twice; ordering's and billing's domains declare their mails `at-least-once` (a business rule
accepting a duplicate confirmation or reminder), and the mailers pass the key as a header the
provider may use.

**P10. A use case commits only on reads that still hold, or on stale ones a business rule
accepts; use cases fail each other only where a business rule ties them.** Every aggregate row has
a `version`; `save` runs `UPDATE … WHERE id = $1 AND version = $2` and throws
`ConcurrencyConflict` on zero rows; the service reruns the use case up to three times, rereading.
Stock is one aggregate per sku: two checkouts of the last tin of one tea conflict and the second,
rerun, is refused `out-of-stock`; checkouts of different teas touch different rows. Gapless
numbering locks one `number_sequences` row per kind and year; invoices wait for each other, as the
gapless rule ties them. Stale reads accepted by rules: the catalog replica's price (the customer
sends `expectedTotal`, a different total is refused `price-changed`); the customer-standing replica
(a customer who entered dunning seconds ago may still be offered invoice, accepted); stock on hand
between two `sync-stock-levels` runs; the editor's stock field. Isolation is `READ COMMITTED`
throughout.

**P11. No other system changes the records a system owns, or reads them except through its
published language.** Each system connects as its own Postgres role with DML grants on its own
schema only; Payload connects as `cms`. No SQL names two schemas. ordering reads billing's and
`cms`'s data only through their messages (replicas) and fulfilment's through `reserveStock`; the
operations dashboard reads each system through its answering ports, not by joining tables.
Package `exports` hide every system's `adapters/` and `domain/` from other packages. The relay's
marking of `cms.outbox_messages` is done by assembly's outbox reader, which is no system (S15).

**P12. Another system's model enters this one only by choice.** Every touch of an external
system goes through an **anti-corruption layer** named in the tree: `cms` → ordering
`on-cms-product-changed.ts`, `payload-catalog-source.ts`; `cms` → fulfilment
`on-cms-product-changed.ts`; Stripe → `stripe-card-gateway.ts`, `stripe-hook.ts`; bank →
`http-bank-statements.ts`; 3PL → `http-warehouse.ts`, `warehouse-hook.ts`; mail → each mailer.
ordering's conformity to billing and fulfilment is a recorded choice: one named
`dependency-cruiser` rule allows it, ordering's `GLOSSARY.md` lists the upstream terms it uses as
they are, and any other import of another system into a domain fails the lint.

**P13. A system changes its model without its downstream systems changing.** billing's and
fulfilment's published languages are hand-written zod schemas in `src/offer/published-language.ts`,
not derived from domain types; the service maps domain results to them, and outbox writers map
domain decisions to them. `test/offer/published-language.test.ts` (default suite) renders the
schemas with `z.toJSONSchema` and compares them with the committed `published-language.v1.json`;
the only accepted changes are new optional fields. A breaking change is a new `.v2` type published
alongside `.v1` until ordering has moved, then `.v1` is removed. `cms`'s published language is
our configuration's `published-language.ts`, written by the outbox hook from the Payload document,
so a Payload field rename changes the hook, not the message.

**P14. A record or a message means the same to all code that reads it, whenever it was written.**
Messages: the version is in the type; a version's schema only ever gains optional fields; readers
strip unknown fields (zod objects); a new enum value is a new version; producers write a new
version only in the release after its consumers deployed; handlers keep accepting every version a
running producer or a waiting outbox row may hold. Records: migrations are expand-only, with
`.contract.sql` a release later (`check-migrations.ts`); repositories write named columns only, so
an older process saving an aggregate leaves columns it does not know untouched; new columns are
nullable or defaulted until contracted; a row an older process cannot parse (`toDomain` meets an
unknown status) throws instead of being saved back, and the call is retried after the rollout.
Rollout order is `migrate`, `worker`, `web`. Replicas compare `sourceVersion`/`standingVersion`, so
an old message never overwrites a newer fact.

**P15. A use case works while other systems are down or slow, unless a business rule needs
another system's answer now.** ordering serves the shop, the cart and checkout options from its
replicas. Card checkout needs billing and Stripe now (the customer pays now: brief); if Stripe is
down it is refused `card-payment-unavailable` and invoice checkout still works. Every checkout needs
fulfilment's reservation now (stock is reserved when the order is placed; S19); fulfilment is
in-process with its own pool. Mail, 3PL, bank and revalidation run in handlers and scheduled tasks
that retry while those systems are down; no HTTP use case waits for them. Outbound calls have
timeouts: Stripe `timeout: 8000, maxNetworkRetries: 1`; 3PL, bank, mail `AbortSignal.timeout(10_000)`.

**P16. No transaction spans two systems.** Each system's unit of work opens transactions on its own
pool with its own role; grants make a transaction that writes two schemas impossible, so each
schema is its own store. `placeOrder` makes its cross-system calls outside its transaction.
`pg-boss` jobs are written by the relay in the bus's own transaction, apart from any system's.

**P17. Work spanning systems ends, and only in a state a business rule allows.** The `Order`
aggregate is the *process manager*; every wait it or an upstream holds has an end: awaiting payment
ends at the deadline (cancelled, reservation released, payment cancelled); a payment arriving
after cancellation is refunded; a held reservation lapses at `expiresAt` and the order is cancelled
(refunded if paid); a pending card payment is cancelled at `expiresAt`; a submitted shipment with no
dispatch after 48 h is checked against the 3PL by `reconcile-shipments` and becomes dispatched or
`needs-attention`; an open invoice runs through dunning to `collection`; an unmatched transfer stays
`unmatched` in the operations view until matched by hand; a refused refund or shipment puts the
order in `needs-attention`. `needs-attention`, `collection` and `unmatched` are states the business
rules name, listed in the operations views. A message that fails ten times parks in
`<queue>.parked`; the parked count is a metric and an operations view, and
`tooling/replay-parked.ts` returns them to the queue.

**P18. The order messages arrive in does not change the outcome.** Each handler acts on what the
system already knows: replicas apply a change only if its version is newer (deletes keep a
tombstone with its version); the `Order` table above accepts payment before or after cancellation
and lapse before or after payment; fulfilment treats `ship-order` before `confirm-reservation` as
confirming, `confirm` after `release` as nothing, `confirm` after lapse as a new reservation attempt;
the 3PL's dispatch hook finds the shipment by our `shipmentId`, so it works before
`submit-shipment` recorded the 3PL's reference; Stripe's `refund.updated` finds the refund by
`metadata.refundId` before or after the API's own answer. A payment for an order ordering does not
know cannot precede the order (the browser gets the secret only after the commit); the handler
throws and parks it for an operator.

**P19. Within one system, each term has one meaning.** Each system package has a `GLOSSARY.md`;
the split gives each meaning its own system and its own word: `cms` says product; ordering says
catalog item (its replica) and order; billing says `orderRef` (an opaque reference) and card
payment, invoice, credit note; fulfilment says article (the 3PL registration), stock item,
reservation, shipment, and `orderRef`. ordering's "payment method" is the customer's choice;
billing's "card payment" is the money movement. Pull requests touching `domain/` must touch the
system's `GLOSSARY.md` when they add a term (review checklist in the PR template).

## Decisions the documents left to me

- **D1. The cut into systems.** Chose ordering, billing, fulfilment, with `cms` external. Would also
  hold: a separate `payments` system for Stripe, or a separate `dunning` system, or catalog as a
  system of ours; any cut where each rule has one home.
- **D2. Who owns products.** Chose `cms` (Payload) as owner, rules in its configuration. Would also
  hold: a `catalog` system of ours owning products, with Payload's hooks calling its driving port
  to validate and Payload as its store.
- **D3. Host for HTTP.** Chose Next.js 15 (required by Payload 3) for storefront, API routes and
  hooks. Would also hold: a separate Fastify server for API and hooks, Next.js only for Payload and
  pages.
- **D4. Processes.** Chose `web`, `worker`, `migrate`. Would also hold: handlers and scheduled tasks
  inside `web`; one process per system.
- **D5. The bus.** Chose `pg-boss` on the same Postgres instance, schema `pgboss`. Would also hold:
  BullMQ on Redis, RabbitMQ, NATS JetStream.
- **D6. The relay.** Chose polling of each outbox with `LISTEN/NOTIFY` wakeup and an advisory lock per
  outbox, in `worker`. Would also hold: logical replication (Debezium), or writing pg-boss jobs in
  the deciding transaction.
- **D7. Stores.** Chose one Postgres schema, role and pool per system. Would also hold: one role
  for all with schema-per-system and lint only (P11, P16 then held by convention).
- **D8. Idempotency mechanism.** Chose a `processed_calls` table per system storing answers, keyed by
  a key every acting call carries. Would also hold: idempotency purely from domain state and natural
  keys.
- **D9. Concurrency.** Chose optimistic `version` per aggregate with three reruns, row lock for number
  sequences, `READ COMMITTED`. Would also hold: `SERIALIZABLE` with retries; pessimistic locks per
  aggregate.
- **D10. Checkout sequence.** Chose tentative reservation and card payment before ordering's commit,
  confirmed by commands after. Would also hold: commit the order first, then reserve and start the
  payment synchronously, with the deadline as backstop.
- **D11. Coordination.** Chose *orchestration*: `Order` is the *process manager*; billing and
  fulfilment never know ordering. Would also hold: *choreography*, billing and fulfilment reacting to
  ordering's events.
- **D12. Relationships.** Chose ordering conformist to billing and fulfilment; anti-corruption layer
  to every external system. Would also hold: anti-corruption layers everywhere.
- **D13. Replicas.** Chose catalog and customer-standing replicas in ordering. Would also hold:
  synchronous answering calls to billing for the standing (billing is in-process), at the cost
  of P15 when billing's pool is down.
- **D14. Shared kernel contents.** Chose `Money`, `Sku`, `TaxClass`; `Result` and `Instant` in the
  common library's pure entry. Would also hold: no shared kernel, each system its own `Money`.
- **D15. Port shape and refusals.** Chose one function type per use case, `Result` for business
  refusals, throws for infrastructure. Would also hold: interfaces grouping use cases; typed error
  classes.
- **D16. Courier.** Chose a typed process-wide courier per consumer, set in `instrumentation.ts`.
  Would also hold: Payload `config.custom`; a per-request `AsyncLocalStorage` value.
- **D17. Published-language format.** Chose hand-written zod with JSON-schema snapshots and `.vN`
  type names. Would also hold: AsyncAPI/JSON Schema files with generated types.
- **D18. Migrations.** Chose Drizzle Kit SQL per system, Payload's own migrations, a one-shot
  `migrate` job, expand/contract with a CI check. Would also hold: migrations at process start
  behind an advisory lock.
- **D19. Bank integration.** Chose polling every 10 minutes with a cursor. Would also hold: bank
  webhooks as hooks.
- **D20. Source of stock on hand.** Chose the 3PL's stock counts, reconciled every 15 minutes. Would
  also hold: stock entered by operators in fulfilment.
- **D21. Payment deadline.** Chose card orders only, 60 minutes; invoice orders have none and go to
  dunning. Would also hold: any duration; a deadline for invoice orders before shipping.
- **D22. Invoice timing.** Chose card orders invoiced on payment, invoice orders on dispatch, due 14
  days after. Would also hold: invoicing invoice orders at placement.
- **D23. Credit note timing.** Chose at refund success. Would also hold: at refund request with a
  cancelling document on failure.
- **D24. Dunning schedule.** Chose daily at 06:00, stages at due + 7, 21, 35, 49 days. Would also
  hold: any schedule.
- **D25. Article master registration.** Chose on every `cms.product-changed.v1` and re-checked at
  submission. Would also hold: only at submission.
- **D26. Cancelled-but-paid.** Chose an automatic full refund. Would also hold: reinstating the
  order if stock allows.
- **D27. Customer identity.** Chose ordering owns customers, guests keyed by normalised email. Would
  also hold: a separate `identity` system or an external identity provider.
- **D28. Observability.** Chose OTel Node SDK with OTLP to Jaeger, W3C trace context and baggage
  (`request.id`) over HTTP and in envelopes, pino `mixin` reading the active context (OTel's
  `AsyncLocalStorage` context manager), Prometheus exporter rendered at `/metrics`. Would also hold:
  a separate `AsyncLocalStorage` for the request id.
- **D29. `cms` outbox.** Chose a hidden Payload collection written with `req`. Would also hold: a raw
  table written through Payload's transaction session.
- **D30. Storefront revalidation.** Chose ordering's private `catalog-changed` event → handler →
  `/api/revalidate` → `revalidateTag("catalog")`, plus a 300 s time backstop. Would also hold:
  a Payload `afterChange` hook revalidating directly (P8 then breaks on rollback, so with an
  after-commit guard only).
- **D31. Repository layout and enforcement.** Chose pnpm workspace, package `exports`,
  `dependency-cruiser`, Biome with GritQL plugins. Would also hold: one package with path rules only.
- **D32. Tests.** Chose vitest; default suite on fakes; integration on docker Postgres; e2e on Stripe
  test mode and 3PL sandbox. Would also hold: testcontainers in place of compose.
- **D33. Parking.** Chose `pg-boss` dead-letter queues after ten attempts with backoff, replay tool.
  Would also hold: a `parked` table per system.
- **D34. Money and time representation.** Chose integer cents in EUR, gross prices; `Instant` as
  epoch milliseconds; `cms` keeps euros with two decimals and the anti-corruption layer converts.
  Would also hold: decimal strings; ISO strings.
- **D35. Ids.** Chose uuidv7 via id ports; `orderId` uuidv5 of cart id and version. Would also hold:
  an order id taken from the idempotency key.
- **D36. Media storage.** Chose Payload's local `staticDir` on a mounted volume. Would also hold: an
  S3 storage adapter.

## Sentences I had to pick a reading for

- **S1.** Glossary, System: "It is code with its own domain and its own glossary." Reading A: the
  Payload configuration we write is code with its own model, so a system of ours. Reading B: it is
  configuration of an external system ("though it may configure it"). Took B. Changed: `cms` is an
  external system; `packages/cms` has no ports, no service, no domain directory.
- **S2.** World, P2: "A business rule lives in one place: the domain." Reading A: the domain of one of
  our systems, so price above zero and sku unique must sit in a system of ours that Payload calls.
  Reading B: the domain of the system that owns the rule, an external system's configuration counting
  as its model (glossary, External system: "Its configuration may hold business rules this codebase
  writes"). Took B. Changed: those rules sit in `collections/products.ts`; no catalog system;
  ordering does not re-check them.
- **S3.** Glossary, Pure: "it loads on every runtime". Reading A: every JavaScript runtime (Node,
  browser, edge, Deno). Reading B: every runtime this application deploys to. Took A. Changed: domains
  import no `node:` module and no npm package; Biome forbids `Buffer`, `process`, `crypto`; time is
  `Instant`, a number.
- **S4.** Glossary, Pure: "it hands its caller nothing the caller did not pass." Reading A: the output
  is a function of the input (no clock, randomness, module state). Reading B: it returns only
  references to what was passed. Took A. Changed: `now` and ids are arguments; `Math.random` and
  top-level `let` are banned in domains by GritQL plugins; `uuidv5` for `orderId` is an id port.
- **S5.** Glossary, Owner: "A replica's records are its keeper's; what they copy stays the owner's to
  decide." Reading A: ordering may drop and rebuild replica rows, `cms` decides their values. Reading
  B: the replica rows are `cms`'s records kept by ordering. Took A. Changed:
  `rebuild-catalog-replica` may delete rows; P11 is not engaged by ordering writing them.
- **S6.** Glossary, Outbox: "for an external system's outbox, assembly does." Reading A: an external
  system may have an outbox that configuration we write fills. Reading B: only external systems that
  ship an outbox of their own. Took A. Changed: Payload's `outbox-messages` collection and
  `apps/worker/src/cms-outbox-reader.ts`.
- **S7.** Glossary, Adapter: "There are as many driving adapters as there are ways into the
  process." Reading A: a way in is a transport (HTTP server, bus consumer, clock), one adapter each.
  Reading B: a way in is each entry (route, subscribed type, schedule, rendered component). Took B.
  Changed: one file per route, handler, task and admin view.
- **S8.** Glossary, Hook: "A driving adapter an external system calls." Reading A: only network
  callbacks (webhooks). Reading B: anything an external system invokes, Payload-rendered components
  included. Took B. Changed: `StockField` and the admin views are hooks and settle by rendering; they
  reach ports by courier.
- **S9.** Glossary, Port: "It names one use case the system offers". Reading A: one driving port per
  use case. Reading B: a port may group the use cases of one conversation. Took A. Changed: driving
  ports are single function types; `XPorts` is only a record of them.
- **S10.** Glossary, Conformist: "its ports become the downstream's driven ports". Reading A: the
  same TypeScript type is reused. Reading B: the downstream declares its own port of the same shape.
  Took A. Changed: ordering's `OrderingUpstreams` imports `ReserveStock`, `StartCardPayment` from the
  upstream offers; assembly passes the upstream function directly.
- **S11.** Glossary, Shared kernel: "each importing it into its domain". Reading A: model only, used in
  domains (and therefore everywhere). Reading B: any shared code, published-language types included.
  Took A. Changed: kernel holds `Money`, `Sku`, `TaxClass`; published languages stay in each offer.
- **S12.** Glossary, Common library: "A package of no system that every system may import." Reading A:
  every layer, the domain included. Reading B: services and adapters only (P5's Except names only
  those). Took a middle: the domain may import only the `pure` entry. Changed: `@teashop/common/pure`
  exists as its own export.
- **S13.** World, P5 Except: "code of the common library … whose output changes neither how a use
  case acts nor what it answers." Reading A: the clause qualifies which common-library code is
  exempt. Reading B: it describes all common-library code. Took A. Changed: `Clock` and id
  generation are ports per system; only logger, tracing, metrics, `retryOnConflict` are imported
  directly.
- **S14.** World, P5: "only through ports assembly hands it". Reading A: a courier is assembly handing
  it over. Reading B: anything read from a holder is the "registry" P5's Why forbids. Took A,
  confined to driving adapters. Changed: couriers for Next routes and Payload components; services
  never read one.
- **S15.** World, P11: "No other system changes the records a system owns". Reading A: the relay
  marking `cms`'s outbox rows is not a system. Reading B: it is a write from outside `cms`. Took A
  (the glossary gives that outbox reader to assembly). Changed: assembly's reader updates
  `cms.outbox_messages.delivered_at` with the `cms` role.
- **S16.** World, P8: "nothing final follows from it before it commits". Reading A: no irreversible
  effect; a tentative operation may precede the commit. Reading B: no effect outside at all before
  the commit. Took A (P8's Why: "What is asked of another system … before the commit stays
  tentative"). Changed: `reserveStock` and `startCardPayment` run before ordering's commit, each
  with an expiry.
- **S17.** World, P9: "A repeated delivery changes no record of this system". Reading A: bus
  deliveries only. Reading B: any repeat of an acting call (HTTP retry, webhook redelivery,
  scheduled-task rerun). Took B. Changed: every acting port takes `ActingMeta`; HTTP acting routes
  demand `Idempotency-Key`.
- **S18.** World, P10: "use cases fail each other only where a business rule ties them". Reading A:
  waiting is not failing. Reading B: blocking counts. Took A. Changed: gapless numbering by row lock;
  optimistic reruns hidden from callers.
- **S19.** World, P15: "unless a business rule needs another system's answer now". Reading A: "stock
  is reserved when an order is placed" needs fulfilment's answer now. Reading B: the reservation may
  follow the order and overselling be repaired after. Took A. Changed: `reserveStock` is a
  synchronous tentative call in `placeOrder`, refusal `out-of-stock`.
- **S20.** World, P17: "Waiting on another system's answer is a state too, and it ends like any other:
  in one a business rule allows." Reading A: every wait has an automatic deadline. Reading B: a wait
  visible to an operator is an allowed state. Took A, with operator states (`needs-attention`,
  `unmatched`, `collection`) as the allowed end of a deadline. Changed: expiries on reservations and
  card payments, 48 h shipment check, dunning to `collection`.
- **S21.** Glossary, Store: "Two clients are one store when one transaction can carry the writes of
  both, two stores until it can." Reading A: one Postgres instance is one store. Reading B: what
  one transaction can carry depends on roles and grants. Took B. Changed: a role per system makes
  each schema a store; P16 holds by grants.
- **S22.** Glossary, Orchestration: "One system's process manager holds the sequence across systems:
  an aggregate whose state is where the sequence stands". Reading A: the business aggregate itself
  may be the process manager. Reading B: a dedicated `OrderProcess` aggregate. Took A. Changed:
  `Order` carries both lines and course state.
- **S23.** Glossary, Message: "A command says do this, to the one system that offers it". Reading A:
  the command's schema is the receiver's published language. Reading B: the sender's. Took A.
  Changed: `ship-order`, `issue-invoice` etc. are defined in fulfilment's and billing's offers; billing
  and fulfilment never import ordering.
- **S24.** Glossary, Offer: "its system builders and the fakes of those ports". Reading A: fakes of the
  open host service's ports only. Reading B: fakes of all its ports. Took A. Changed: `./fakes` exports
  fakes of `ReserveStock`, `StartCardPayment` etc.; driven-port fakes stay inside each package.
- **S25.** Glossary, Snapshot: "A value an aggregate copies when a use case needs it, projected into
  this system's terms". Reading A: may be copied from a replica. Reading B: must come from the owner's
  answer. Took A. Changed: order lines copy price, sku, tax class from `catalog_items`; checkout does
  not call `cms`.
- **S26.** Glossary, Scheduled task: "A driving adapter the clock calls." Reading A: a `pg-boss` cron
  job delivered through the bus is still the clock calling. Reading B: only an in-process timer is.
  Took A. Changed: schedules live in `pg-boss`, run in `worker`, keyed by slot.
- **S27.** Glossary, Probe: "Code a process runs to report on itself rather than on a system." Reading
  A: `/health` pinging Postgres reports on the process's reach, so a probe. Reading B: it reports on
  the store, so outside the definition. Took A. Changed: `/health` uses a `probe` role and no system
  port.
