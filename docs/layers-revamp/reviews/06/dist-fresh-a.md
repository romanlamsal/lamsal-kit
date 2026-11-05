# Fresh repository draft A, distilled set (property rules)

Repository `teashop`: pnpm monorepo, TypeScript 5.x strict, Node 24, one Postgres 17 instance. I picked these
libraries: Next.js 15 App Router (Payload 3 runs in it), Payload 3 with `@payloadcms/db-postgres`, Drizzle ORM
on `pg`, `zod` 4, `temporal-polyfill`, `uuid` (v5 and v7), `pg-boss` 10 as the bus, `stripe`, `pdfkit`, `pino`,
`@opentelemetry/api`, `vitest` with `@testcontainers/postgresql`, `dependency-cruiser`, `biome`.

Every system below has the same architecture: domain, services, repositories, driven adapters, driving
adapters, an offer, a system builder.

## Systems and what each owns

| System | Kind | Owns (business rules decide) | Keeps (records in its store) |
|---|---|---|---|
| `shop` | system of this codebase | `Cart`, `Order` (with line snapshots of price, sku, tax class), `Stock` per sku (available-stock rule, reservations), the price-confirmation, for-sale and invoice-offer decisions, the 30-minute payment deadline, the shipment-booking wait | schema `shop`: carts, orders, order_lines, stock, stock_reservations, `ProductOffer` replica (from Payload), `ListedArticle` replica (from fulfilment), `CustomerStanding` replica (from billing), outbox, handled_messages |
| `payment` | system of this codebase | `Payment` (one per card order: PaymentIntent, status, dispute state), `CardRefund` (each refund through Stripe, its reason, its outcome) | schema `payment`: payments, card_refunds, outbox, handled_messages |
| `fulfilment` | system of this codebase | `Shipment` (one per order: lines asked, 3PL booking, dispatch), `Article` (sku in the 3PL's article master, last warehouse stock report) | schema `fulfilment`: shipments, shipment_lines, articles, outbox, handled_messages |
| `billing` | system of this codebase | `Invoice` (lines, totals, credits, payments, paybacks, dunning stage), `CreditNote`, `NumberSeries` (per kind and calendar year), `IncomingTransfer`, `Refund` (operator's refund of an invoiced order), `CustomerAccount` (dunning standing per email), `BankFeed` (last poll), `PendingDisputeLoss` | schema `billing`: the same tables, outbox, handled_messages, handled_requests |
| `mailing` | system of this codebase | `Mail` (one customer mail, its delivery state, the duplicate-acceptance rule) | schema `mailing`: mails, outbox, handled_messages |
| `operations` | system of this codebase | `TrailEntry` (one line of a checkout's end-to-end trail), the delayed-work view | schema `operations`: trail_entries, handled_messages |

External systems:

| External system | Where it runs | Driven through | Driving through | Its published language here |
|---|---|---|---|---|
| Payload CMS | in-process in `web` and `worker`, schema `payload` in the same Postgres | Local API (`payload.findByID`) from shop's and fulfilment's driven adapters | its outbox (hidden collection `outbox-messages`, read by the relay) and shop's Payload hook (virtual fields) | `@teashop/cms/published`: generated `payload-types.ts` (`Product`) and the `ProductSaved` message schema this codebase configures |
| Stripe | vendor | `stripe` package from payment's driven adapter | webhook to payment's hook | `stripe` package types |
| 3PL warehouse | vendor | HTTP client in fulfilment's driven adapter | webhooks to fulfilment's hook; stock list polled by fulfilment's scheduled task | `fulfilment/src/adapters/warehouse-api/wire.ts`, stated once from the vendor's documentation |
| Bank API | vendor | none | polled by billing's scheduled task | `billing/src/adapters/bank-api/wire.ts`, stated once from the vendor's documentation |
| Mail provider | vendor | HTTP client in mailing's driven adapter | none | `mailing/src/adapters/mail-provider/wire.ts` |

Payload owns the product record: copy, images, slug, price, sku, tax class. Price above zero, sku unique and
sku fixed once saved are rules of Payload's configuration (`packages/cms`), Payload's own in its terms. No system
of this codebase writes a product.

Shared kernel: `@teashop/kernel`, shared by `shop`, `payment`, `billing`, `mailing`. It holds `Money` (EUR, integer
cents, `add`, `subtract`, `multiply(qty)`, `isPositive`, `netFromGross(rate)` with half-up rounding to cents) and
`EmailAddress` (trimmed, lowercased; one customer per normalized address). Values and functions of arguments
only; no record schema, no record rule. `fulfilment` and `operations` do not import it.

Code that is no system:

| Code | What it is |
|---|---|
| `@teashop/common` | common library: `Envelope` schema, `Handler`, `ScheduledTask`, `OutboxReader`, relay, bus over pg-boss, `Courier`, `WriteConflict`, `deriveId` (uuid v5), telemetry (`@opentelemetry/api` re-export, `pino` logger to stdout) |
| `@teashop/cms` | configuration of the external system Payload, written by this codebase |
| `@teashop/assembly` | assembly code shared by both processes' assemblies: configuration schema, `buildAllSystems`, the Payload outbox reader |
| `apps/web/assembly`, `apps/worker/src/assembly` | each process's assembly |
| `apps/web/probes`, `apps/worker/src/probes` | probes: outbox backlog per reader, pg-boss queue and dead-letter counts, health |
| `tooling/migrate`, `tooling/depcruise`, `tooling/lint-migrations` | tooling |

## Ports and adapters

Conventions common to every system:

```ts
// packages/<system>/src/ports/driven/transactions.ts
export interface Transactions<Tx> {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>   // commits once when work resolves, rolls back whole when it throws
}
// packages/<system>/src/ports/driven/clock.ts
export interface Clock { now(): Temporal.Instant }
// packages/<system>/src/ports/driven/handled-messages.ts
export interface HandledMessages<Tx> {
  claim(tx: Tx, handler: string, messageId: string): Promise<'first' | 'repeat'>
  // INSERT INTO handled_messages(handler, message_id) VALUES (...) ON CONFLICT DO NOTHING RETURNING 1
  // An overlapping second insert waits on the unique index until the first commits or rolls back.
}
```

Services are generic over `Tx`. Assembly instantiates them with the Drizzle transaction type, tests with `FakeTx`;
no service, port or domain module names Drizzle. Every service factory has the shape
`make<UseCase><Tx>(deps: {...driven ports}): <DrivingPort>`. Every aggregate carries `version: number`; every
repository `save` runs `UPDATE ... WHERE id = $1 AND version = $2` and throws `WriteConflict` on zero rows; every
`insert` throws `WriteConflict` on a unique violation. Use cases called for a message take
`{ messageId: string, ...payload in the system's terms }`.

### shop

Driving ports (`src/ports/driving/`):

```ts
export interface ShopDrivingPorts {
  // answering
  listProducts(): Promise<readonly ProductOfferView[]>
  productBySlug(slug: string): Promise<ProductOfferView | null>
  viewCart(cartId: CartId): Promise<CartView | null>               // current prices from ProductOffer
  checkoutOptions(email: EmailAddress): Promise<{ invoiceOffered: boolean }>
  productStatus(skus: readonly Sku[]): Promise<ReadonlyMap<Sku, { available: number; forSale: boolean }>>
  opsOrders(filter: OrderFilter): Promise<readonly OrderSummary[]>
  opsOrder(orderId: OrderId): Promise<OrderDetail | null>
  // acting, called by driving adapters of the storefront
  setCartLine(input: { cartId: CartId | null; productId: ProductId; quantity: number }): Promise<{ cartId: CartId }>
  placeOrder(input: CheckoutRequest): Promise<PlaceOrderResult>
  // acting, called by handlers and scheduled tasks
  refreshProductOffer(input: { messageId: string; productId: ProductId }): Promise<void>
  recordArticleListed(input: { messageId: string; sku: Sku }): Promise<void>
  applyWarehouseStock(input: { messageId: string; sku: Sku; free: number; reportedAt: Temporal.Instant; version: number }): Promise<void>
  applyCustomerStanding(input: { messageId: string; email: EmailAddress; inDunning: boolean; version: number }): Promise<void>
  recordCardPayment(input: { messageId: string; orderId: OrderId }): Promise<void>
  recordPassedToWarehouse(input: { messageId: string; orderId: OrderId; bookedAt: Temporal.Instant }): Promise<void>
  recordDispatch(input: { messageId: string; orderId: OrderId; bookedAt: Temporal.Instant; lines: readonly DispatchedLine[] }): Promise<void>
  sweepPaymentDeadlines(): Promise<void>                          // writes one PaymentDeadlinePassed per order
  expireUnpaidCardOrder(input: { messageId: string; orderId: OrderId }): Promise<void>
  sweepBookingWaits(): Promise<void>                              // writes one ShipmentBookingOverdue per order
  flagBookingOverdue(input: { messageId: string; orderId: OrderId }): Promise<void>
}

export type CheckoutRequest = {
  cartId: CartId
  email: EmailAddress
  address: DeliveryAddress                                       // domain schema: country 'DE', 5-digit postcode
  paymentMethod: 'card' | 'invoice'
  seenPrices: ReadonlyArray<{ productId: ProductId; unitPrice: Money }>
}
export type PlaceOrderResult =
  | { kind: 'placed'; orderId: OrderId }                           // invoice order
  | { kind: 'awaitingCard'; orderId: OrderId; clientSecret: string }
  | { kind: 'cardUnavailable'; orderId: OrderId }                  // order placed, payment not reachable; resubmit same cart
  | { kind: 'pricesChanged'; lines: ReadonlyArray<{ productId: ProductId; seen: Money; current: Money }> }
  | { kind: 'shortStock'; lines: ReadonlyArray<{ productId: ProductId; requested: number; available: number }> }
  | { kind: 'notForSale'; productIds: readonly ProductId[] }
  | { kind: 'invoiceNotOffered' }
  | { kind: 'cartEmpty' }
```

Open host service (`src/offer/ports.ts`, on the offer as `@teashop/shop/ports`):

```ts
export interface ShopOpenHost {
  overdueShipmentRequests(): Promise<readonly OverdueShipmentRequestV1[]>   // for operations' delayed view
}
```

Driven ports (`src/ports/driven/`):

```ts
export interface CartRepository<Tx> { byId(tx: Tx, id: CartId): Promise<Cart | null>; insert(tx: Tx, c: Cart): Promise<void>; save(tx: Tx, c: Cart): Promise<void> }
export interface OrderRepository<Tx> {
  byId(tx: Tx, id: OrderId): Promise<Order | null>
  byCartId(tx: Tx, cartId: CartId): Promise<Order | null>          // orders.cart_id UNIQUE
  insert(tx: Tx, o: Order): Promise<void>
  save(tx: Tx, o: Order): Promise<void>                            // order_lines upserted by line id, known columns only
  cardOrdersUnpaidPast(tx: Tx, at: Temporal.Instant, limit: number): Promise<readonly OrderId[]>
  shipmentRequestsUnbookedPast(tx: Tx, at: Temporal.Instant, limit: number): Promise<readonly OrderId[]>
}
export interface StockRepository<Tx> { bySkus(tx: Tx, skus: readonly Sku[]): Promise<readonly Stock[]>; save(tx: Tx, s: Stock): Promise<void> }
export interface ProductOfferRepository<Tx> {
  byIdsForDecision(tx: Tx, ids: readonly ProductId[]): Promise<readonly ProductOffer[]>  // SELECT ... FOR SHARE
  byId(tx: Tx, id: ProductId): Promise<ProductOffer | null>
  put(tx: Tx, o: ProductOffer): Promise<void>                       // insert or version-checked update
  list(tx: Tx): Promise<readonly ProductOffer[]>; bySlug(tx: Tx, slug: string): Promise<ProductOffer | null>
}
export interface ListedArticleRepository<Tx> { listedSkus(tx: Tx, skus: readonly Sku[]): Promise<ReadonlySet<Sku>>; markListed(tx: Tx, sku: Sku): Promise<void> }  // FOR SHARE in placeOrder
export interface CustomerStandingRepository<Tx> { forDecision(tx: Tx, e: EmailAddress): Promise<CustomerStanding>; save(tx: Tx, s: CustomerStanding): Promise<void> }  // FOR SHARE
export interface ShopOutbox<Tx> {
  publish(tx: Tx, e: ShopEvent): Promise<void>                      // ShopEvent: union of shop's published language types
  enqueue(tx: Tx, m: ShopPrivateMessage): Promise<void>            // id chosen by caller; ON CONFLICT (id) DO NOTHING
}
export interface FulfilmentRequests<Tx> { requestShipment(tx: Tx, order: Order): Promise<void> }  // writes fulfilment's ShipOrder.v1 into shop's outbox
export interface CustomerMails<Tx> {
  orderConfirmed(tx: Tx, o: Order): Promise<void>
  orderCancelled(tx: Tx, o: Order): Promise<void>
  linesDropped(tx: Tx, o: Order, dropped: readonly DroppedLine[]): Promise<void>
}                                                                   // each writes mailing's DeliverMail.v1 into shop's outbox
export interface CardPayments {                                     // payment's open host service, in shop's terms
  open(r: { orderId: OrderId; amount: Money; email: EmailAddress }): Promise<{ kind: 'opened'; clientSecret: string } | { kind: 'unavailable' }>
  state(orderId: OrderId): Promise<'paid' | 'unpaid'>
}
export interface CatalogSource { current(productId: ProductId): Promise<CatalogProduct> }   // Payload, in shop's terms
export interface ShopIds { order(): OrderId; cart(): CartId; line(): OrderLineId }
```

Adapters:

| Adapter | Implements | Reaches |
|---|---|---|
| `adapters/driven/postgres/*` (`transactions.ts`, `carts.ts`, `orders.ts`, `stock.ts`, `product-offers.ts`, `listed-articles.ts`, `customer-standing.ts`, `handled-messages.ts`, `outbox.ts`, `fulfilment-requests.ts`, `customer-mails.ts`, `mail-templates/*.ts`, `schema.ts`, `outbox-reader.ts`) | every store-backed driven port, and the outbox reader | Postgres through Drizzle, role `shop_app`, schema `shop`; fulfilment's and mailing's published language for the commands it writes |
| `adapters/driven/payment/card-payments.ts` | `CardPayments` | payment's open host service (`@teashop/payment/ports`, `/published`) |
| `adapters/driven/payload/catalog-source.ts` | `CatalogSource` | Payload Local API, `@teashop/cms/published` |
| `adapters/driven/system/clock.ts`, `ids.ts` | `Clock`, `ShopIds` | `Temporal.Now`, uuid v7 |
| `adapters/driven/fake/*` | a fake per driven port | nothing outside the process |
| `apps/web/app/(shop)/**` server actions and pages | driving adapters of the storefront and of the ops order pages | Next.js, `cookies()` for the cart id, the courier |
| `adapters/driving/handlers/*` | handlers: `on-product-saved`, `on-article-registered`, `on-article-stock-changed`, `on-customer-dunning-changed`, `on-card-payment-succeeded`, `on-shipment-booked`, `on-shipment-dispatched`, `on-payment-deadline-passed`, `on-shipment-booking-overdue` | upstream published languages, `@teashop/common` `Handler` |
| `adapters/driving/scheduled/*` | scheduled tasks `sweep-payment-deadlines` (every minute), `sweep-booking-waits` (every 15 minutes) | `@teashop/common` `ScheduledTask` |
| `adapters/driving/cms/product-status-hook.ts` | hook: Payload `afterRead` of the virtual fields `availableStock` and `forSale` | Payload hook types, the courier |

Example of the transaction adapter and a typed repository, no casts:

```ts
// adapters/driven/postgres/schema.ts
export const shop = pgSchema('shop')
export const orders = shop.table('orders', { id: uuid('id').primaryKey(), cartId: uuid('cart_id').notNull().unique(), version: integer('version').notNull(), /* ... */ })
export type ShopDb = NodePgDatabase<typeof schemaTables>
export type ShopPgTx = Parameters<Parameters<ShopDb['transaction']>[0]>[0]
// adapters/driven/postgres/transactions.ts
export const makePgTransactions = (db: ShopDb): Transactions<ShopPgTx> => ({ run: (work) => db.transaction(work) })
```

### payment

Driving ports:

```ts
export interface PaymentDrivingPorts {
  // open host service (also on the offer as PaymentOpenHost)
  openCardPayment(r: OpenCardPaymentV1): Promise<OpenCardPaymentResultV1>      // { kind:'opened', clientSecret } | { kind:'unavailable' }
  cardPaymentState(r: { orderId: string }): Promise<CardPaymentStateV1>         // 'succeeded' | 'notSucceeded'; asks Stripe live
  // hook
  applyStripeEvent(input: { messageId: string; kind: StripeEventKind; objectId: string }): Promise<void>
  // handlers
  onOrderCancelled(input: { messageId: string; orderId: OrderRef }): Promise<void>
  onOrderLinesDropped(input: { messageId: string; orderId: OrderRef; amount: Money; dropId: string }): Promise<void>
  acceptRefundRequest(input: { messageId: string; refundId: string; orderId: OrderRef; amount: Money }): Promise<void>
  issueCardRefund(input: { messageId: string; cardRefundId: CardRefundId }): Promise<void>
  cancelIntent(input: { messageId: string; paymentId: PaymentId }): Promise<void>
  // ops, answering
  opsPayments(filter: PaymentFilter): Promise<readonly PaymentSummary[]>
}
export type StripeEventKind = 'intentChanged' | 'disputeChanged'               // translated in the hook
```

Driven ports:

```ts
export interface PaymentRepository<Tx> { byOrderId(tx: Tx, orderId: OrderRef): Promise<Payment | null>; byIntentId(tx: Tx, id: string): Promise<Payment | null>; insert(tx: Tx, p: Payment): Promise<void>; save(tx: Tx, p: Payment): Promise<void>; lockById(tx: Tx, id: PaymentId): Promise<Payment> }  // lockById: FOR UPDATE
export interface CardRefundRepository<Tx> { lockById(tx: Tx, id: CardRefundId): Promise<CardRefund | null>; insert(tx: Tx, r: CardRefund): Promise<void>; save(tx: Tx, r: CardRefund): Promise<void> }
export interface CardGateway {                                     // Stripe, in payment's terms
  openIntent(r: { key: string; paymentId: PaymentId; orderId: OrderRef; amount: Money }): Promise<{ intentId: string; clientSecret: string }>
  intentState(intentId: string): Promise<{ state: 'open' | 'succeeded' | 'cancelled'; captured: Money }>
  cancelIntent(r: { key: string; intentId: string }): Promise<'cancelled' | 'alreadySucceeded'>
  refund(r: { key: string; cardRefundId: CardRefundId; intentId: string; amount: Money }): Promise<{ kind: 'refunded'; gatewayRefundId: string } | { kind: 'refused'; reason: 'disputed' | 'exceedsCaptured' }>
  findRefund(cardRefundId: CardRefundId, intentId: string): Promise<{ gatewayRefundId: string } | null>   // by metadata
  disputeState(disputeId: string): Promise<{ intentId: string; state: 'open' | 'won' | 'lost'; amount: Money }>
}
export interface PaymentOutbox<Tx> { publish(tx: Tx, e: PaymentEvent): Promise<void>; enqueue(tx: Tx, m: PaymentPrivateMessage): Promise<void> }
export interface RefundMails<Tx> { cardRefunded(tx: Tx, r: CardRefund, email: EmailAddress): Promise<void> }   // writes DeliverMail.v1
// plus Transactions<Tx>, HandledMessages<Tx>, Clock, PaymentIds
```

Adapters: `adapters/driven/postgres/*` (role `payment_app`), `adapters/driven/stripe/card-gateway.ts` (the `stripe`
client built in payment's system builder from the secret key; idempotency key on every write), `adapters/driven/fake/*`,
`apps/web/app/(payment)/api/stripe/webhook/route.ts` (hook: `stripe.webhooks.constructEvent` with the webhook secret
from the courier, answers 200 only after `applyStripeEvent` resolves, 500 otherwise), `adapters/driving/handlers/*`
(`on-order-cancelled`, `on-order-lines-dropped`, `on-refund-card-payment`, `on-issue-card-refund`, `on-cancel-intent`),
`apps/web/app/(payment)/ops/payments/page.tsx`.

### fulfilment

Driving ports:

```ts
export interface FulfilmentDrivingPorts {
  acceptShipOrder(input: { messageId: string; request: ShipmentRequest }): Promise<void>
  bookShipment(input: { messageId: string; shipmentId: ShipmentId }): Promise<void>
  recordDispatch(input: { messageId: string; warehouseOrderRef: string; lines: readonly WarehouseLineReport[] }): Promise<void>   // hook
  recordStockReport(input: { messageId: string; sku: Sku; free: number; reportedAt: Temporal.Instant }): Promise<void>         // hook and stock sync
  registerArticle(input: { messageId: string; productId: string }): Promise<void>
  sweepShipments(): Promise<void>                                  // requested > 1h without booking: new BookShipment
  opsShipments(filter: ShipmentFilter): Promise<readonly ShipmentSummary[]>
}
export interface FulfilmentOpenHost { delayedShipments(): Promise<readonly DelayedShipmentV1[]>; unregisteredArticles(): Promise<readonly UnregisteredArticleV1[]> }
```

Driven ports:

```ts
export interface ShipmentRepository<Tx> { lockById(tx: Tx, id: ShipmentId): Promise<Shipment | null>; byWarehouseRef(tx: Tx, ref: string): Promise<Shipment | null>; insert(tx: Tx, s: Shipment): Promise<void>; save(tx: Tx, s: Shipment): Promise<void>; requestedUnbookedPast(tx: Tx, at: Temporal.Instant): Promise<readonly ShipmentId[]> }
export interface ArticleRepository<Tx> { lockBySku(tx: Tx, sku: Sku): Promise<Article | null>; insert(tx: Tx, a: Article): Promise<void>; save(tx: Tx, a: Article): Promise<void> }
export interface Warehouse {                                       // 3PL, in fulfilment's terms
  registerArticle(a: { sku: Sku; title: string }): Promise<{ kind: 'registered' } | { kind: 'refused'; reason: string }>   // 3PL keys its article master by sku
  findBooking(shipmentId: ShipmentId): Promise<WarehouseBooking | null>                                                    // by client reference = shipment id
  book(s: Shipment): Promise<{ kind: 'booked'; booking: WarehouseBooking } | { kind: 'refused'; reason: string }>
  stockList(): Promise<readonly { sku: Sku; free: number; reportedAt: Temporal.Instant }[]>
}
export interface CatalogSource { current(productId: string): Promise<{ sku: Sku; title: string }> }    // Payload
export interface FulfilmentOutbox<Tx> { publish(tx: Tx, e: FulfilmentEvent): Promise<void>; enqueue(tx: Tx, m: FulfilmentPrivateMessage): Promise<void> }
// plus Transactions<Tx>, HandledMessages<Tx>, Clock
```

Adapters: `adapters/driven/postgres/*` (role `fulfilment_app`), `adapters/driven/warehouse-api/warehouse.ts` and
`wire.ts`, `adapters/driven/payload/catalog-source.ts`, `adapters/driven/fake/*`,
`apps/web/app/(fulfilment)/api/warehouse/webhook/route.ts` (hook: HMAC check, routes `shipment.dispatched` to
`recordDispatch` and `stock.changed` to `recordStockReport`), `adapters/driving/handlers/*` (`on-ship-order`,
`on-book-shipment`, `on-product-saved`, `on-stock-reported`), `adapters/driving/scheduled/stock-sync.ts` (every 30
minutes: `stockList()` read by the driving adapter through the 3PL client; one private `StockReported` message per item,
id `deriveId('stock', sku + reportedAt)`, through one acting call `recordStockList`), `adapters/driving/scheduled/sweep-shipments.ts`.
`recordStockList(input: { items })` is one more acting driving port that only writes the per-item messages.

### billing

Driving ports:

```ts
export interface BillingDrivingPorts {
  issueInvoice(input: { messageId: string; shipped: ShippedOrder }): Promise<void>
  sweepInvoiceDeadlines(): Promise<void>                           // writes InvoiceDeadlineReached per invoice
  applyInvoiceDeadline(input: { messageId: string; invoiceId: InvoiceId; deadline: Temporal.Instant }): Promise<void>
  updateCustomerAccount(input: { messageId: string; email: EmailAddress; invoiceId: InvoiceId; overdue: boolean; invoiceVersion: number }): Promise<void>
  latestTransferBookingDate(): Promise<Temporal.PlainDate | null>  // answering, for the bank poll window
  recordBankStatement(input: { polledAt: Temporal.Instant; transfers: readonly ReportedTransfer[] }): Promise<void>   // one private TransferReported per item
  bookIncomingTransfer(input: { messageId: string; transfer: ReportedTransfer }): Promise<void>
  // operators, acting; every call carries requestId (hidden form field, same on resubmit)
  refundOrder(input: { requestId: string; operator: OperatorId; invoiceId: InvoiceId; lines: readonly RefundLine[] | 'all' }): Promise<RefundResult>
  assignTransfer(input: { requestId: string; operator: OperatorId; transferId: TransferId; allocations: readonly { invoiceNumber: InvoiceNumber; amount: Money }[] }): Promise<AssignResult>
  recordTransferPayback(input: { requestId: string; operator: OperatorId; transferId: TransferId; amount: Money }): Promise<PaybackResult>
  recordInvoicePayback(input: { requestId: string; operator: OperatorId; invoiceId: InvoiceId; amount: Money }): Promise<PaybackResult>
  takeOverInvoice(input: { requestId: string; operator: OperatorId; invoiceId: InvoiceId }): Promise<TakeOverResult>
  // handlers of payment's answers
  completeCardRefund(input: { messageId: string; refundId: RefundId }): Promise<void>
  recordCardRefundRefused(input: { messageId: string; refundId: RefundId; reason: 'disputed' | 'exceedsCaptured' }): Promise<void>
  recordLostDispute(input: { messageId: string; orderId: OrderRef; disputeId: string; amount: Money }): Promise<void>
  // ops, answering
  opsInvoices(f: InvoiceFilter): Promise<readonly InvoiceSummary[]>; opsInvoice(id: InvoiceId): Promise<InvoiceDetail | null>
  opsCreditNotes(f: CreditNoteFilter): Promise<readonly CreditNoteSummary[]>; opsTransfers(f: TransferFilter): Promise<readonly TransferSummary[]>
  invoicePdf(id: InvoiceId): Promise<Uint8Array>; creditNotePdf(id: CreditNoteId): Promise<Uint8Array>
}
export interface BillingOpenHost { bankFeedStatus(): Promise<BankFeedStatusV1> }
```

Driven ports: `InvoiceRepository<Tx>` (`byOrderId`, `byNumber`, `byId`, `insert`, `save`, `deadlinesPast(at)`),
`CreditNoteRepository<Tx>`, `NumberSeriesRepository<Tx>` (`get(tx, kind, year)` creating the row at 0, `save`),
`IncomingTransferRepository<Tx>`, `RefundRepository<Tx>`, `CustomerAccountRepository<Tx>`, `BankFeedRepository<Tx>`,
`PendingDisputeLossRepository<Tx>`, `HandledRequests<Tx>` (`claim(tx, useCase, requestId): 'first' | { repeat: unknown }`,
`record(tx, useCase, requestId, result)`), `BillingOutbox<Tx>`, `CardRefunds<Tx>` (writes payment's
`RefundCardPayment.v1` into billing's outbox), `DocumentMails<Tx>` (`invoiceIssued`, `creditNoteIssued`,
`reminder(stage)`: write `DeliverMail.v1` with the PDF attached), `Documents` (`invoicePdf(invoice)`,
`creditNotePdf(note)`, `reminderPdf(invoice, stage)`: pure, `pdfkit`), `Transactions<Tx>`, `HandledMessages<Tx>`,
`Clock`, `BillingIds`.

Adapters: `adapters/driven/postgres/*` (role `billing_app`), `adapters/driven/documents/*` (pdfkit layouts),
`adapters/driven/fake/*`, `adapters/driving/handlers/*` (`on-order-shipped`, `on-invoice-deadline-reached`,
`on-invoice-standing-changed`, `on-transfer-reported`, `on-card-refunded`, `on-card-refund-refused`,
`on-card-dispute-lost`), `adapters/driving/scheduled/sweep-invoice-deadlines.ts` (every 15 minutes),
`adapters/driving/scheduled/bank-poll.ts` (every 5 minutes; asks `latestTransferBookingDate()`, polls the bank from
that date minus 3 days, makes one acting call `recordBankStatement`), `adapters/bank-api/wire.ts`,
`apps/web/app/(billing)/ops/**` pages and server actions.

### mailing

```ts
export interface MailingDrivingPorts {
  acceptMail(input: { messageId: string; mail: OutgoingMail }): Promise<void>   // records Mail pending + private SendMail
  sendMail(input: { messageId: string; mailId: MailId }): Promise<void>
  sweepPendingMails(): Promise<void>                               // pending > 15 min: new SendMail (duplicate accepted)
}
export interface MailingOpenHost { delayedMails(): Promise<readonly DelayedMailV1[]> }
export interface MailRepository<Tx> { lockById(tx: Tx, id: MailId): Promise<Mail | null>; insert(tx: Tx, m: Mail): Promise<void>; save(tx: Tx, m: Mail): Promise<void>; pendingPast(tx: Tx, at: Temporal.Instant): Promise<readonly MailId[]> }
export interface MailProvider { send(m: OutgoingMail): Promise<{ kind: 'sent'; providerMessageId: string } | { kind: 'refused'; reason: string }> }
// plus Transactions<Tx>, HandledMessages<Tx>, MailingOutbox<Tx>, Clock
```

Adapters: `adapters/driven/postgres/*` (role `mailing_app`), `adapters/driven/mail-provider/mail-provider.ts`,
`adapters/driven/fake/*`, `adapters/driving/handlers/on-deliver-mail.ts`, `on-send-mail.ts`,
`adapters/driving/scheduled/sweep-pending-mails.ts`.

### operations

```ts
export interface OperationsDrivingPorts {
  recordTrailEntry(input: { messageId: string; entry: TrailEntryInput }): Promise<void>   // one per subscribed event
  trail(orderId: string): Promise<readonly TrailEntry[]>
  delayedWork(): Promise<DelayedWork>                              // each section 'unavailable' if its source fails
}
export interface TrailRepository<Tx> { insert(tx: Tx, e: TrailEntry): Promise<'inserted' | 'exists'>; byOrderId(tx: Tx, orderId: string): Promise<readonly TrailEntry[]> }   // unique (source_message_id)
export interface DelayedWorkSources {
  overdueShipmentRequests(): Promise<readonly DelayedItem[]>; delayedShipments(): Promise<readonly DelayedItem[]>
  unregisteredArticles(): Promise<readonly DelayedItem[]>; delayedMails(): Promise<readonly DelayedItem[]>; bankFeed(): Promise<DelayedItem | null>
}
```

Adapters: `adapters/driven/postgres/*` (role `operations_app`), `adapters/driven/open-hosts/delayed-work-sources.ts`
(calls the four open host services, translates), `adapters/driven/fake/*`, `adapters/driving/handlers/on-*.ts` (one
per subscribed event, each translating to `TrailEntryInput`), `apps/web/app/(operations)/ops/trail/[orderId]/page.tsx`,
`apps/web/app/(operations)/ops/delayed/page.tsx`.

### Offer of each system

`package.json` `exports` of each system package:

```json
{
  "./published": "./src/published/index.ts",
  "./ports": "./src/offer/ports.ts",
  "./fakes": "./src/offer/fakes.ts",
  "./builder": "./src/builder.ts",
  "./internal/*": "./src/*"
}
```

`./internal/*` exists for the system's own driving adapters kept in `apps/web/app/(<system>)/`; dependency-cruiser
refuses it to every module not mapped to that system.

System builder signatures:

```ts
buildPayment(config: PaymentConfig): PaymentBuild                                         // builds pool, Stripe client
buildShop(config: ShopConfig, held: { payload: Payload; payment: PaymentOpenHost }): ShopBuild
buildFulfilment(config: FulfilmentConfig, held: { payload: Payload }): FulfilmentBuild
buildBilling(config: BillingConfig): BillingBuild                                         // builds pool, bank client
buildMailing(config: MailingConfig): MailingBuild                                         // builds pool, provider client
buildOperations(config: OperationsConfig, held: { shop: ShopOpenHost; fulfilment: FulfilmentOpenHost; billing: BillingOpenHost; mailing: MailingOpenHost }): OperationsBuild
buildShopCmsHooks(courier: Courier<ShopDrivingPorts>): { availableStockAfterRead: FieldHook; forSaleAfterRead: FieldHook }

interface <System>Build {
  ports: <System>DrivingPorts               // for this system's own driving adapters (courier, handlers)
  openHost: <System>OpenHost                // for other systems
  handlers: readonly Handler[]
  scheduledTasks: readonly ScheduledTask[]
  outboxReader: OutboxReader
  close(): Promise<void>
}
```

## Calls and messages

Choreography throughout: each system reacts to the others' events and decides its own next step; commands go to
the one system that offers them. No system holds the whole order sequence.

### Synchronous calls

| Caller | Callee | Driving port / API | When | How a refusal comes back |
|---|---|---|---|---|
| browser | shop (server action) | `placeOrder`, `setCartLine` | checkout, cart | `PlaceOrderResult` union; `WriteConflict` mapped to "try again" |
| shop `placeOrder` service, after its commit | payment (in-process) | `openCardPayment` | card orders | `{ kind: 'unavailable' }` (Stripe down) becomes `cardUnavailable`; any thrown error likewise |
| shop `expireUnpaidCardOrder` | payment (in-process) | `cardPaymentState` | at the payment deadline | thrown error: use case fails, message redelivered |
| shop `refreshProductOffer`, fulfilment `registerArticle` | Payload (in-process) | Local API `findByID({ collection: 'products', id, depth: 1 })`, never with a `req` | after `ProductSaved` | thrown error: redelivery |
| Payload admin (`afterRead` of virtual fields) | shop (hook) | `productStatus` | editor opens a product | answering; error shows the field empty |
| operations `delayedWork` | shop, fulfilment, billing, mailing (in-process) | each open host service | operator opens delayed page | per-section `unavailable` |
| payment adapters | Stripe | PaymentIntents create (key `pi:<paymentId>`), retrieve, cancel (key `cancel:<paymentId>`), refunds create (key `refund:<cardRefundId>`), refunds list, disputes retrieve | as below | adapter maps decline codes to `refused`, timeouts and 5xx to thrown failures |
| fulfilment adapters | 3PL | create article (key: sku), get order by client reference, create order (client reference = shipment id), list stock | as below | 4xx validation answer to `refused`, timeouts and 5xx thrown |
| billing scheduled task | bank | list booked transactions from a date | every 5 minutes | thrown: next poll |
| mailing adapter | mail provider | send | per `SendMail` | 4xx address error to `refused`, others thrown |
| Stripe | payment hook | webhook | intent and dispute events | hook answers 500 until the use case commits; Stripe resends |
| 3PL | fulfilment hook | webhook | dispatch, stock change | 500 until committed; 3PL resends |

### Messages

All messages travel in the common library's `Envelope` (`id`, `type`, `schemaVersion`, `writer`, `visibility`,
`occurredAt`, `trace`, `payload`). Each subscriber has its own pg-boss queue `<system>.<handler>`.

| Message | Kind | Writer (outbox) | Subscribers | P18 means |
|---|---|---|---|---|
| `cms.ProductSaved.v1 { productId }` | event, published (Payload's language) | Payload, hidden collection `outbox-messages`, in Payload's transaction (`afterChange`) | shop `on-product-saved`, fulfilment `on-product-saved` | notice; receiver fetches current state |
| `fulfilment.ArticleRegistered.v1 { sku }` | event | fulfilment | shop `on-article-registered` | forward-only fact |
| `fulfilment.ArticleStockChanged.v1 { sku, free, reportedAt, version }` | event | fulfilment | shop `on-article-stock-changed` | `version` = `Article.version`; shop keeps the higher |
| `fulfilment.ShipOrder.v1 { orderId, lines[{ lineId, sku, quantity }], address, email }` | command (fulfilment's language) | shop | fulfilment `on-ship-order` | one per order; shipment id derived from order id |
| `fulfilment.ShipmentBooked.v1 { orderId, shipmentId, bookedAt }` | event | fulfilment | shop `on-shipment-booked`, operations | forward-only status |
| `fulfilment.ShipmentDispatched.v1 { orderId, shipmentId, bookedAt, lines[{ lineId, sku, ordered, shipped }], dispatchedAt }` | event | fulfilment | shop `on-shipment-dispatched`, operations | carries `bookedAt`, so it stands without `ShipmentBooked` |
| `shop.OrderPlaced.v1 { orderId, email, paymentMethod, lines, total, placedAt }` | event | shop | operations | trail only |
| `shop.OrderPaid.v1 { orderId, paidAt }` | event | shop | operations | trail only |
| `shop.OrderCancelled.v1 { orderId, reason: 'paymentDeadline' \| 'nothingShipped', paymentMethod }` | event | shop | payment `on-order-cancelled`, operations | terminal; payment records it whatever came first |
| `shop.OrderLinesDropped.v1 { orderId, dropId, lines[{ lineId, sku, quantity, amount }], amount, paymentMethod }` | event | shop | payment `on-order-lines-dropped`, operations | one per dispatch, `dropId` = shipment id |
| `shop.OrderShipped.v1 { orderId, email, address, paymentMethod, lines[{ lineId, sku, title, quantity, unitPriceGross, taxClass }], shippedAt }` | event | shop | billing `on-order-shipped`, operations | one per order |
| `payment.CardPaymentSucceeded.v1 { orderId, paymentId, amount, succeededAt }` | event | payment | shop `on-card-payment-succeeded`, operations | forward-only |
| `payment.RefundCardPayment.v1 { refundId, orderId, amount }` | command (payment's language) | billing | payment `on-refund-card-payment` | keyed by `refundId` |
| `payment.CardRefunded.v1 { cardRefundId, refundId?, orderId, amount, reason }` | event | payment | billing `on-card-refunded` (only with `refundId`), operations | keyed |
| `payment.CardRefundRefused.v1 { refundId, orderId, reason }` | event | payment | billing `on-card-refund-refused`, operations | keyed, terminal |
| `payment.CardDisputeLost.v1 { orderId, disputeId, amount }` | event | payment | billing `on-card-dispute-lost`, operations | keyed by dispute |
| `billing.InvoiceIssued.v1`, `CreditNoteIssued.v1`, `InvoicePaymentApplied.v1`, `ReminderSent.v1`, `InvoiceHandedToOperators.v1` (each with `orderId`) | events | billing | operations | trail only |
| `billing.CustomerDunningChanged.v1 { email, inDunning, version }` | event | billing | shop `on-customer-dunning-changed` | `version` = `CustomerAccount.version` |
| `mailing.DeliverMail.v1 { mailId, to, subject, html, text, attachments[{ filename, contentType, base64 }], tags }` | command (mailing's language) | shop, payment, billing | mailing `on-deliver-mail` | keyed by `mailId`, chosen by the sender (`deriveId('mail', kind + subject id)`) |
| `mailing.MailSent.v1 { mailId, tags, sentAt }` | event | mailing | operations (uses `tags.orderId`) | keyed |
| `shop.private.PaymentDeadlinePassed { orderId }`, `shop.private.ShipmentBookingOverdue { orderId }` | private | shop | shop | decided by the aggregate at handling |
| `payment.private.IssueCardRefund { cardRefundId }`, `payment.private.CancelIntent { paymentId }` | private | payment | payment | keyed |
| `fulfilment.private.BookShipment { shipmentId }`, `fulfilment.private.StockReported { sku, free, reportedAt }` | private | fulfilment | fulfilment | keyed; `reportedAt` compared |
| `billing.private.TransferReported { bankTransactionId, ... }`, `InvoiceDeadlineReached { invoiceId, deadline }`, `InvoiceStandingChanged { invoiceId, email, overdue, invoiceVersion }` | private | billing | billing | message id from bank id; deadline compared to aggregate; `invoiceVersion` |
| `mailing.private.SendMail { mailId }` | private | mailing | mailing | keyed |

How a refusal comes back across systems: a command's refusal is an event of the receiver's own published language
naming no sender (`CardRefundRefused`; a 3PL refusal becomes `ShipmentDispatched` with every line `shipped: 0`). A
synchronous call's refusal is a variant of its result union. A failure is never a refusal: the use case throws, commits
nothing, the handler does not acknowledge, pg-boss retries.

### The flows, in sequence

1. Checkout, invoice: `placeOrder` commits `Order`, `Cart` checked out, `Stock` reservations, `OrderPlaced`,
   `ShipOrder`, `DeliverMail` (confirmation).
2. Checkout, card: `placeOrder` commits `Order` (`paymentDueAt = placedAt + 30 min`), `Cart`, `Stock`, `OrderPlaced`;
   then calls `openCardPayment`; returns `clientSecret`. Stripe confirms in the browser; declines retry on the same
   intent. `payment_intent.succeeded` at payment's hook: `applyStripeEvent` retrieves the intent, records success,
   publishes `CardPaymentSucceeded`. Shop's `recordCardPayment` marks paid, writes `OrderPaid`, `ShipOrder`, `DeliverMail`.
3. Deadline: `sweepPaymentDeadlines` writes `PaymentDeadlinePassed`; `expireUnpaidCardOrder` reads the order (paid
   meanwhile: nothing), asks `cardPaymentState` (succeeded: same as step 2), else cancels: releases reservations,
   `OrderCancelled`, `DeliverMail`. Payment's `onOrderCancelled`: intent not succeeded, enqueue `CancelIntent`; succeeded,
   create the full `CardRefund` (id `deriveId('refund-full', paymentId)`) and enqueue `IssueCardRefund`. A success that
   arrives after `OrderCancelled` creates the same full refund.
4. Fulfilment: `acceptShipOrder` inserts `Shipment` (id `deriveId('shipment', orderId)`), enqueues `BookShipment`.
   `bookShipment` locks the shipment row, `findBooking` by client reference, else `book`; records booking, publishes
   `ShipmentBooked`. Shop's `recordPassedToWarehouse` marks reservations passed at `bookedAt`.
5. Dispatch webhook: `recordDispatch` publishes `ShipmentDispatched`. Shop's `recordDispatch` drops unshipped lines and
   quantities: something shipped, `OrderShipped` (+ `OrderLinesDropped` and its mail if any); nothing shipped,
   `OrderCancelled` and its mail. Payment refunds dropped amounts and cancelled paid orders (refund mail). Billing's
   `issueInvoice` takes the next number, commits `Invoice` (card: paid; invoice: due 14 days after its date), mails the PDF.
6. Transfers: bank poll, `recordBankStatement`, one `TransferReported` per transfer, `bookIncomingTransfer` applies it to
   the invoice when the reference names exactly one invoice number and the amount equals its open amount, else leaves it
   `unassigned` for operators.
7. Dunning: `sweepInvoiceDeadlines`, `applyInvoiceDeadline` moves `pastDue` (due date passed), `reminder1` (+7 days),
   `reminder2` (+14), `final` (+14), `handedToOperators` (+14); each reminder mails its PDF; `pastDue` and paid write
   `InvoiceStandingChanged`; `updateCustomerAccount` raises `CustomerAccount.version`, publishes `CustomerDunningChanged`.
8. Operator refund: `refundOrder` records `Refund`. Invoice order: issues the `CreditNote` at once, lowering the open
   amount; a surplus shows as negative open amount for `recordInvoicePayback`. Card order: writes `RefundCardPayment`;
   `CardRefunded` completes it with the `CreditNote` and its mail; `CardRefundRefused` marks it refused for operators.
9. Dispute: payment's hook gets `charge.dispute.*`, retrieves the dispute; any dispute makes further refunds refused;
   lost publishes `CardDisputeLost`; billing issues a `CreditNote` for the amount, or keeps `PendingDisputeLoss` until
   the invoice is issued and issues it in the same transaction.

## Processes

| Deployable | Entry point | Runs | Replicas |
|---|---|---|---|
| `web` | `apps/web/instrumentation.ts` (`register()`), Next.js standalone server, `export const runtime = 'nodejs'` on every route | storefront, checkout, ops pages, Stripe and 3PL hooks, Payload admin and REST, Payload's `afterChange` outbox write, shop's Payload hook | 2+ |
| `worker` | `apps/worker/src/main.ts` | relay (every 1 s per outbox reader, `FOR UPDATE SKIP LOCKED`), bus workers for every handler, pg-boss cron for every scheduled task, probe HTTP on `:9100` | 1+ (pg-boss cron fires once cluster-wide) |
| `migrate` | `tooling/migrate/src/main.ts` | tooling, a release job before each deploy | 1, then exits |

Assembly of `web` (`apps/web/assembly/index.ts`, called from `register()`):

1. `parseConfig(process.env)` (`@teashop/assembly/config`, zod): per-system `DATABASE_URL`s (one role each),
   `PAYLOAD_SECRET`, Stripe keys, 3PL base URL and keys, mail provider key, bank credentials.
2. `payload = await getPayload({ config })`; `payload.config.ts` built by `buildCmsConfig({ productHooks:
   buildShopCmsHooks(shopCourier) })`.
3. `buildAllSystems(config, { payload })` (`@teashop/assembly`): payment, then shop (handed `payment.openHost`),
   fulfilment, billing, mailing, operations (handed the four open hosts).
4. Fill couriers (`apps/web/assembly/couriers.ts`): `shopCourier.fill(shop.ports)`, likewise payment, fulfilment,
   billing, operations, plus `webhookSecretsCourier.fill({ stripe, warehouse })`. Couriers live on `globalThis` under
   `Symbol.for('teashop.courier.<name>')`, since Next.js may load `instrumentation.ts` and route modules as separate
   module instances. Driving adapters call `courier.get()` on every request; `get()` throws when unfilled.
5. No relay, no bus workers in `web`.

Assembly of `worker` (`apps/worker/src/assembly/index.ts`): steps 1 to 3 as in `web`; then `boss = new PgBoss({
connectionString: config.busUrl, schema: 'pgboss', migrate: false })`; `bus = createPgBossBus(boss, { retryLimit:
1000, retryDelay: 5, retryBackoff: true, retryDelayMax: 3600, expireInSeconds: 900, deadLetter: 'dlq.<queue>',
deleteAfterDays: 3650 })`; `bus.subscribe([...each build's handlers])`; `bus.schedule([...each build's scheduledTasks])`;
`startRelay([...each build's outboxReader, payloadOutboxReader(config.payloadDbUrl)], bus)`; probe server. On SIGTERM:
stop relay, `boss.stop({ graceful: true })`, `close()` every build.

Migrations (`tooling/migrate`): in order, `bootstrap.sql` (schemas `shop`, `payment`, `fulfilment`, `billing`,
`mailing`, `operations`, `payload`, `pgboss`; roles `<system>_app` with `USAGE`/DML on their own schema only, no grant
across schemas); each system's Drizzle SQL migrations from `packages/<system>/migrations/` as its own role with
`migrationsSchema: '<system>'`; `payload migrate` from `packages/cms/migrations/`; pg-boss `migrate: true` start and
stop. `tooling/lint-migrations` fails CI on `CHECK (`, `CREATE TRIGGER`, `REFERENCES <other schema>.` and on a
destructive statement (`DROP COLUMN`, `ALTER ... TYPE`, `RENAME`) not in a file marked `-- contract` (see P14).

## Directory tree

```
teashop/
├── package.json                      scripts: typecheck, lint, test, test:int, test:e2e, depcruise
├── pnpm-workspace.yaml
├── biome.json                        noProcessEnv except apps/*/assembly/config.ts and packages/assembly/src/config.ts
├── tsconfig.base.json
├── vitest.workspace.ts               projects: unit (default suite), integration (*.int.test.ts), e2e (*.e2e.test.ts)
├── .dependency-cruiser.cjs           extends tooling/depcruise/rules.cjs
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts            withPayload(...)
│   │   ├── instrumentation.ts
│   │   ├── payload.config.ts
│   │   ├── assembly/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   └── couriers.ts
│   │   ├── probes/
│   │   │   └── health.ts
│   │   ├── app/
│   │   │   ├── (payload)/admin/[[...segments]]/page.tsx
│   │   │   ├── (payload)/api/[...slug]/route.ts
│   │   │   ├── (shop)/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── products/[slug]/page.tsx
│   │   │   │   ├── cart/page.tsx
│   │   │   │   ├── cart/actions.ts            setCartLineAction
│   │   │   │   ├── checkout/page.tsx
│   │   │   │   ├── checkout/actions.ts        placeOrderAction
│   │   │   │   ├── checkout/address-form.tsx  client component, parses with shop's DeliveryAddress
│   │   │   │   ├── checkout/pay/card-form.tsx client component, Stripe.js with clientSecret
│   │   │   │   └── ops/orders/{page.tsx,[orderId]/page.tsx}
│   │   │   ├── (payment)/
│   │   │   │   ├── api/stripe/webhook/route.ts
│   │   │   │   └── ops/payments/page.tsx
│   │   │   ├── (fulfilment)/
│   │   │   │   ├── api/warehouse/webhook/route.ts
│   │   │   │   └── ops/shipments/page.tsx
│   │   │   ├── (billing)/
│   │   │   │   ├── ops/invoices/{page.tsx,[invoiceId]/page.tsx,[invoiceId]/pdf/route.ts,actions.ts}
│   │   │   │   ├── ops/credit-notes/{page.tsx,[creditNoteId]/pdf/route.ts}
│   │   │   │   └── ops/transfers/{page.tsx,actions.ts}
│   │   │   ├── (operations)/
│   │   │   │   ├── ops/trail/[orderId]/page.tsx
│   │   │   │   └── ops/delayed/page.tsx
│   │   │   └── api/health/route.ts
│   │   └── test/                      driving adapter tests (codebase's choice: route handlers on fakes via courier)
│   └── worker/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── assembly/{index.ts,config.ts}
│           └── probes/{server.ts,backlog.ts}
├── packages/
│   ├── common/
│   │   ├── package.json
│   │   ├── src/{envelope.ts,handler.ts,scheduled-task.ts,outbox-reader.ts,relay.ts,bus.ts,courier.ts,errors.ts,derive-id.ts,telemetry.ts,logger.ts,index.ts}
│   │   └── test/{relay.test.ts,courier.test.ts,derive-id.test.ts}
│   ├── kernel/
│   │   ├── package.json
│   │   ├── src/{money.ts,email-address.ts,index.ts}
│   │   └── test/{money.test.ts,email-address.test.ts}
│   ├── assembly/
│   │   ├── package.json
│   │   └── src/{config.ts,build-all-systems.ts,payload-outbox-reader.ts}
│   ├── cms/
│   │   ├── package.json              exports: ".", "./published"
│   │   ├── src/
│   │   │   ├── config.ts             buildCmsConfig({ productHooks })
│   │   │   ├── collections/products.ts
│   │   │   ├── collections/media.ts
│   │   │   ├── collections/outbox-messages.ts
│   │   │   ├── hooks/write-product-saved.ts
│   │   │   ├── published/{index.ts,product-saved.ts,payload-types.ts}
│   │   └── migrations/
│   ├── shop/
│   │   ├── package.json
│   │   ├── GLOSSARY.md
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── builder.ts
│   │   │   ├── offer/{ports.ts,fakes.ts}
│   │   │   ├── published/{index.ts,order-placed.ts,order-paid.ts,order-cancelled.ts,order-lines-dropped.ts,order-shipped.ts,overdue-shipment-request.ts}
│   │   │   ├── messages/private.ts
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts             branded CartId, OrderId, OrderLineId, ProductId, Sku
│   │   │   │   ├── delivery-address.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── order.ts           states, line snapshots, dropping, paymentDueAt, bookingExpectedBy
│   │   │   │   ├── stock.ts           available(), reserve(), release(), markPassed(), applyWarehouse()
│   │   │   │   ├── product-offer.ts   replica, forSale
│   │   │   │   ├── customer-standing.ts
│   │   │   │   ├── checkout.ts        priceChanges(), shortLines(), invoiceOffered(), decidePlacement()
│   │   │   │   ├── deadlines.ts       PAYMENT_WINDOW = 30 min, BOOKING_WAIT = 48 h
│   │   │   │   ├── staleness.ts       accepted stale reads, stated as rules
│   │   │   │   └── repeats.ts         repeat acceptance (second empty cart)
│   │   │   ├── ports/
│   │   │   │   ├── driving/{index.ts,checkout.ts,cart.ts,catalog.ts,ops.ts,messages.ts}
│   │   │   │   └── driven/{transactions.ts,clock.ts,ids.ts,handled-messages.ts,carts.ts,orders.ts,stock.ts,product-offers.ts,listed-articles.ts,customer-standing.ts,outbox.ts,fulfilment-requests.ts,customer-mails.ts,card-payments.ts,catalog-source.ts}
│   │   │   ├── services/
│   │   │   │   ├── place-order.ts, set-cart-line.ts, view-cart.ts, checkout-options.ts, list-products.ts, product-by-slug.ts, product-status.ts
│   │   │   │   ├── refresh-product-offer.ts, record-article-listed.ts, apply-warehouse-stock.ts, apply-customer-standing.ts
│   │   │   │   ├── record-card-payment.ts, record-passed-to-warehouse.ts, record-dispatch.ts
│   │   │   │   ├── sweep-payment-deadlines.ts, expire-unpaid-card-order.ts, sweep-booking-waits.ts, flag-booking-overdue.ts
│   │   │   │   ├── ops-orders.ts, overdue-shipment-requests.ts
│   │   │   │   └── translate/to-published.ts
│   │   │   └── adapters/
│   │   │       ├── driven/
│   │   │       │   ├── postgres/{schema.ts,transactions.ts,carts.ts,orders.ts,stock.ts,product-offers.ts,listed-articles.ts,customer-standing.ts,handled-messages.ts,outbox.ts,outbox-reader.ts,fulfilment-requests.ts,customer-mails.ts}
│   │   │       │   ├── postgres/mail-templates/{order-confirmed.ts,order-cancelled.ts,lines-dropped.ts}
│   │   │       │   ├── payment/card-payments.ts
│   │   │       │   ├── payload/catalog-source.ts
│   │   │       │   ├── system/{clock.ts,ids.ts}
│   │   │       │   └── fake/{store.ts,transactions.ts,carts.ts,orders.ts,stock.ts,product-offers.ts,listed-articles.ts,customer-standing.ts,handled-messages.ts,outbox.ts,fulfilment-requests.ts,customer-mails.ts,card-payments.ts,catalog-source.ts,clock.ts,ids.ts}
│   │   │       └── driving/
│   │   │           ├── handlers/{on-product-saved.ts,on-article-registered.ts,on-article-stock-changed.ts,on-customer-dunning-changed.ts,on-card-payment-succeeded.ts,on-shipment-booked.ts,on-shipment-dispatched.ts,on-payment-deadline-passed.ts,on-shipment-booking-overdue.ts}
│   │   │           ├── scheduled/{sweep-payment-deadlines.ts,sweep-booking-waits.ts}
│   │   │           └── cms/product-status-hook.ts
│   │   └── test/
│   │       ├── domain/{cart.test.ts,order.test.ts,stock.test.ts,checkout.test.ts,...}
│   │       ├── services/{place-order.test.ts,record-dispatch.test.ts,expire-unpaid-card-order.test.ts,...}
│   │       └── ports/driven/
│   │           ├── orders.contract.ts, orders.fake.test.ts, orders.pg.int.test.ts
│   │           ├── stock.contract.ts, stock.fake.test.ts, stock.pg.int.test.ts
│   │           ├── ... one contract + fake + real per driven port
│   │           └── card-payments.contract.ts, card-payments.fake.test.ts, card-payments.payment.int.test.ts
│   ├── payment/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, migrations/
│   │   ├── src/
│   │   │   ├── builder.ts
│   │   │   ├── offer/{ports.ts,fakes.ts}
│   │   │   ├── published/{index.ts,open-card-payment.ts,card-payment-state.ts,card-payment-succeeded.ts,refund-card-payment.ts,card-refunded.ts,card-refund-refused.ts,card-dispute-lost.ts}
│   │   │   ├── messages/private.ts
│   │   │   ├── domain/{ids.ts,payment.ts,card-refund.ts,refund-policy.ts,dispute.ts}
│   │   │   ├── ports/driving/{index.ts,...}, ports/driven/{transactions.ts,clock.ts,ids.ts,handled-messages.ts,payments.ts,card-refunds.ts,card-gateway.ts,outbox.ts,refund-mails.ts}
│   │   │   ├── services/{open-card-payment.ts,card-payment-state.ts,apply-stripe-event.ts,on-order-cancelled.ts,on-order-lines-dropped.ts,accept-refund-request.ts,issue-card-refund.ts,cancel-intent.ts,ops-payments.ts,translate/to-published.ts}
│   │   │   └── adapters/
│   │   │       ├── driven/postgres/{schema.ts,transactions.ts,payments.ts,card-refunds.ts,handled-messages.ts,outbox.ts,outbox-reader.ts,refund-mails.ts,mail-templates/card-refunded.ts}
│   │   │       ├── driven/stripe/card-gateway.ts
│   │   │       ├── driven/system/{clock.ts,ids.ts}
│   │   │       ├── driven/fake/{...one per driven port}
│   │   │       └── driving/handlers/{on-order-cancelled.ts,on-order-lines-dropped.ts,on-refund-card-payment.ts,on-issue-card-refund.ts,on-cancel-intent.ts}
│   │   └── test/{domain/,services/,ports/driven/card-gateway.contract.ts,card-gateway.fake.test.ts,card-gateway.stripe.e2e.test.ts,...}
│   ├── fulfilment/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, migrations/
│   │   ├── src/
│   │   │   ├── builder.ts, offer/{ports.ts,fakes.ts}
│   │   │   ├── published/{index.ts,ship-order.ts,shipment-booked.ts,shipment-dispatched.ts,article-registered.ts,article-stock-changed.ts,delayed-shipment.ts,unregistered-article.ts}
│   │   │   ├── messages/private.ts
│   │   │   ├── domain/{ids.ts,shipment.ts,article.ts,booking-outcome.ts}
│   │   │   ├── ports/driving/..., ports/driven/{transactions.ts,clock.ts,handled-messages.ts,shipments.ts,articles.ts,warehouse.ts,catalog-source.ts,outbox.ts}
│   │   │   ├── services/{accept-ship-order.ts,book-shipment.ts,record-dispatch.ts,record-stock-report.ts,record-stock-list.ts,register-article.ts,sweep-shipments.ts,ops-shipments.ts,delayed-shipments.ts,translate/to-published.ts}
│   │   │   └── adapters/
│   │   │       ├── driven/postgres/{schema.ts,transactions.ts,shipments.ts,articles.ts,handled-messages.ts,outbox.ts,outbox-reader.ts}
│   │   │       ├── driven/warehouse-api/{warehouse.ts,wire.ts,client.ts}
│   │   │       ├── driven/payload/catalog-source.ts
│   │   │       ├── driven/system/clock.ts, driven/fake/{...}
│   │   │       └── driving/{handlers/{on-ship-order.ts,on-book-shipment.ts,on-product-saved.ts,on-stock-reported.ts},scheduled/{stock-sync.ts,sweep-shipments.ts}}
│   │   └── test/{...; ports/driven/warehouse.contract.ts, warehouse.fake.test.ts, warehouse.sandbox.e2e.test.ts}
│   ├── billing/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, migrations/
│   │   ├── src/
│   │   │   ├── builder.ts, offer/{ports.ts,fakes.ts}
│   │   │   ├── published/{index.ts,invoice-issued.ts,credit-note-issued.ts,invoice-payment-applied.ts,reminder-sent.ts,invoice-handed-to-operators.ts,customer-dunning-changed.ts,bank-feed-status.ts}
│   │   │   ├── messages/private.ts
│   │   │   ├── domain/{ids.ts,calendar.ts,vat.ts,invoice.ts,credit-note.ts,number-series.ts,dunning.ts,incoming-transfer.ts,transfer-matching.ts,refund.ts,customer-account.ts,bank-feed.ts,pending-dispute-loss.ts}
│   │   │   ├── ports/driving/..., ports/driven/{...}
│   │   │   ├── services/{issue-invoice.ts,sweep-invoice-deadlines.ts,apply-invoice-deadline.ts,update-customer-account.ts,latest-transfer-booking-date.ts,record-bank-statement.ts,book-incoming-transfer.ts,refund-order.ts,assign-transfer.ts,record-transfer-payback.ts,record-invoice-payback.ts,take-over-invoice.ts,complete-card-refund.ts,record-card-refund-refused.ts,record-lost-dispute.ts,ops-*.ts,translate/to-published.ts}
│   │   │   └── adapters/
│   │   │       ├── driven/postgres/{schema.ts,transactions.ts,invoices.ts,credit-notes.ts,number-series.ts,incoming-transfers.ts,refunds.ts,customer-accounts.ts,bank-feed.ts,pending-dispute-losses.ts,handled-messages.ts,handled-requests.ts,outbox.ts,outbox-reader.ts,card-refunds.ts,document-mails.ts,mail-templates/*.ts}
│   │   │       ├── driven/documents/{invoice-pdf.ts,credit-note-pdf.ts,reminder-pdf.ts}
│   │   │       ├── driven/system/{clock.ts,ids.ts}, driven/fake/{...}
│   │   │       ├── bank-api/{client.ts,wire.ts}
│   │   │       └── driving/{handlers/{on-order-shipped.ts,on-invoice-deadline-reached.ts,on-invoice-standing-changed.ts,on-transfer-reported.ts,on-card-refunded.ts,on-card-refund-refused.ts,on-card-dispute-lost.ts},scheduled/{sweep-invoice-deadlines.ts,bank-poll.ts}}
│   │   └── test/{...}
│   ├── mailing/
│   │   ├── package.json, GLOSSARY.md, drizzle.config.ts, migrations/
│   │   └── src/{builder.ts,offer/{ports.ts,fakes.ts},published/{index.ts,deliver-mail.ts,mail-sent.ts,delayed-mail.ts},messages/private.ts,domain/{mail.ts,sender.ts,repeats.ts},ports/...,services/{accept-mail.ts,send-mail.ts,sweep-pending-mails.ts,delayed-mails.ts},adapters/{driven/{postgres/...,mail-provider/{mail-provider.ts,wire.ts},system/clock.ts,fake/...},driving/{handlers/{on-deliver-mail.ts,on-send-mail.ts},scheduled/sweep-pending-mails.ts}}}
│   └── operations/
│       ├── package.json, GLOSSARY.md, drizzle.config.ts, migrations/
│       └── src/{builder.ts,domain/{trail-entry.ts,delayed-work.ts},ports/...,services/{record-trail-entry.ts,trail.ts,delayed-work.ts},adapters/{driven/{postgres/...,open-hosts/delayed-work-sources.ts,fake/...},driving/handlers/{on-order-placed.ts,on-order-paid.ts,...one per subscribed event}}}
└── tooling/
    ├── migrate/{package.json,src/main.ts,bootstrap.sql}
    ├── depcruise/rules.cjs
    └── lint-migrations/src/main.ts
```

## How each property holds

**P1.** Each system's `src/domain/**` is checked by `tooling/depcruise/rules.cjs` rule `domain-closed-list`: a domain
module may resolve only to its own `src/domain/**`, `@teashop/kernel` (for the four sharing systems), `zod`,
`temporal-polyfill`; any other target, `import type` included (`tsPreCompilationDeps: true`), fails CI. The kernel
is held to the same list. Each domain and the kernel compile under `tsconfig.domain.json` with `"lib": ["ES2023"]` and
`"types": []`, so `process`, `Buffer`, `window` and the DOM are undeclared and fail typecheck; `node:*` is not on the
list. Domain functions take `now: Temporal.Instant` and ids as arguments; `Temporal.Now` appears only in
`adapters/driven/system/clock.ts`. Shop's domain loads in the browser (`checkout/address-form.tsx` parses with
`DeliveryAddress`), which exercises the runtime test. No system conforms to an upstream, so no upstream's language
is on any list. Rows, Payload's generated `Product`, Stripe's types appear only under `adapters/**`.

**P2.** Every business rule of the brief has one statement: shop's domain holds the 30-minute window, the
placement decision (prices, stock, for-sale, invoice offer), available stock, dropping lines, nothing-shipped
cancellation, the 48-hour booking wait; payment's holds the late-payment and cancelled-order refund, the dispute
ban, which refunds get a refund mail; fulfilment's holds "a refused booking ships nothing"; billing's holds VAT
rates per tax class, the Berlin calendar year, gapless series, invoice and credit-note totals, due date 14 days,
the 7/14/14/14 dunning schedule, past due and customer-in-dunning, open amount, the matching rule, the
card-invoice-is-paid rule, lost dispute as refund; mailing's holds the accepted duplicate and the sender the
customer sees. Price above zero, sku unique and fixed are Payload's own, in `packages/cms/src/collections/products.ts`,
because Payload owns the product record and no rule of a system here decides it. The numbers are domain constants, no
configuration value. Server actions parse with the domain's zod schemas and ask domain functions; repositories parse
rows with the same schemas; published languages state their own constraints (`quantity` positive) as the contract's.
`tooling/lint-migrations` refuses check constraints and triggers; only primary and unique keys reach the store. Tests
call the domain directly; dependency-cruiser refuses an import of `vitest`'s `vi.mock` targeting `src/domain/**`
(rule `no-domain-double`), and service tests get fakes for driven ports only.

**P3.** Every record's rules sit in its owner's domain (table in "Systems and what each owns"). Shop asks fulfilment
to ship lines and asks no reservation time; fulfilment decides booking; shop's `Stock` is shop's because the
available-stock rule is about shop's orders. Billing decides invoices from shop's `OrderShipped` facts and computes
VAT itself; shop's language carries `taxClass`, not a rate. Payment refunds an amount shop or billing asks for; it
decides only whether it may (dispute, captured). `@teashop/kernel` holds `Money` and `EmailAddress`, no record schema
and no record rule; the common library holds the envelope, which holds no system's shape. Replicas (`ProductOffer`,
`ListedArticle`, `CustomerStanding`) hold what their owners decided; shop's rules over them decide only shop's records.

**P4.** Each use case is one service function deciding from its driving port's arguments and its driven ports'
answers. Biome `noProcessEnv` refuses `process.env` outside the two assembly config files; Clock and id ports replace
`Date.now` and `crypto.randomUUID` (dependency-cruiser rule `services-no-globals` plus biome `noRestrictedGlobals`
for `Date` in `src/services/**` and `src/domain/**`). The operator, the cart id from the cookie and the email arrive
as arguments. Every driving adapter makes at most one acting call: the bank poll makes one answering call and one
acting call; the stock sync and the sweeps make one acting call that writes one message per item; webhook routes
route by event type to exactly one acting port. Guards in pages (hiding the invoice option) are repeated in
`placeOrder`. Telemetry (`@opentelemetry/api`, `pino` to stdout) is the only ambient code reached; the envelope's
`trace` field is stamped by outbox adapters from the active span and changes nothing a use case decides.

**P5.** Services import only their own domain, ports, private messages, published language, the kernel and from
`@teashop/common` only `WriteConflict`, `deriveId` and telemetry (rule `services-reach`); `adapters/driven/<set>/**`
may import the outside it adapts and its own set's files, never another set or a service (rule `adapter-sets`). Ports
take and return domain types or published-language types, never a Drizzle, Stripe or Payload type. Nothing outside a
system reaches it except through `package.json` `exports` (`./published`, `./ports`, `./fakes`, `./builder`) or its
driving adapters' ways in (routes, hooks, pg-boss queues); `./internal/*` is refused to modules not mapped to the
system. Clients (pools, `Stripe`, 3PL and bank and mail clients) are built inside the system builders from the
configuration values assembly passes; no module exports an instance. Framework-constructed driving adapters (server
actions, route handlers, Payload hooks) read the `globalThis` courier on each call; only `apps/*/assembly` fills it.
The Payload outbox reader is built by `@teashop/assembly` and handed to the relay.

**P6.** Every driven port has a fake under its system's `adapters/driven/fake/`. `fake/store.ts` keeps maps per
aggregate type; `FakeTransactions.run` works on a copy and on commit checks every saved version and unique key against
the current maps, throwing `WriteConflict` as Postgres does. Each driven port has one contract suite,
`<port>.contract.ts`, exporting `describe<Port>Contract(makeSubject)`, run by `<port>.fake.test.ts` in the default
suite and by `<port>.pg.int.test.ts` (Postgres 17 testcontainer, all migrations applied by `tooling/migrate` with the
production roles) or `<port>.<vendor>.e2e.test.ts` (Stripe test mode, 3PL sandbox, mail provider sandbox) outside it.
Assertions include stale save fails, duplicate insert fails, claim returns `repeat`, Stripe refund on a disputed charge
answers `refused`. Upstreams' offers export fakes of their open host service (`@teashop/payment/fakes`); shop's ACL
port `CardPayments` has shop's own fake and its contract runs real against payment's service on fakes
(`card-payments.payment.int.test.ts` uses payment's Postgres adapters, so integration). Telemetry is a no-op without
an SDK; the logger writes stdout and never throws.

**P7.** Each acting service makes one `transactions.run` and every write port takes `tx` as a required first
parameter. Aggregates saved together only where a stated rule ties them: `placeOrder` (order, cart, stocks: no unit
to two orders, a cart checks out once), `recordPassedToWarehouse`, `recordDispatch` and `expireUnpaidCardOrder` (order,
stocks), `issueInvoice` (invoice, invoice series, and credit note plus credit series for a pending dispute loss: gapless
numbering), `bookIncomingTransfer` and `assignTransfer` (transfer, invoices: a transfer applied once in full),
`completeCardRefund` and `refundOrder` for invoice orders (refund, credit note, invoice, credit series). Everything
else goes by message: customer standing, mails, trail entries. Outbox rows and claims are written with `tx`. No
savepoints; no service imports another service (rule `no-service-to-service`); a thrown error inside `run` rolls
back whole.

**P8.** Outbox rows are written in the use case's transaction; the relay marks a row `published_at` only after
`boss.send` resolved, in the same reader transaction that selected it; pg-boss keeps jobs in Postgres through any
stop, retries, parks in `dlq.<queue>` kept 10 years; each `Handler.handle` awaits its use case and rethrows, so pg-boss
completes the job only after the commit. Hooks answer 200 only after their use case returned. Calls after a commit are
made from a committed record: `placeOrder` to `openCardPayment` (repeated by a resubmitted checkout for the same cart,
ended by the payment deadline); `bookShipment`, `issueCardRefund`, `cancelIntent`, `sendMail`, `registerArticle` call
the outside from a committed `Shipment`, `CardRefund`, `Payment`, `Mail`, `Article` record, and `sweepShipments`,
`sweepPendingMails` and redelivery repeat them. Executors decide nothing again: `bookShipment` books the shipment as
requested, `issueCardRefund` refunds the accepted amount. Payload tells of product changes only through its own outbox,
written in its `afterChange` with `req` so it joins Payload's transaction; shop's Payload hook is `afterRead` and
changes nothing. Stripe's and the 3PL's webhooks tell of committed facts; payment retrieves the object anyway.

**P9.** Every acting use case and its repeat:

| Use case | Repeat told by | Outside call key |
|---|---|---|
| shop `placeOrder` | `orders.cart_id` unique: repeat returns the same order and calls `openCardPayment` again | payment answers by `Payment` for the order |
| shop `setCartLine` | cart version; no cart id: a second empty cart, accepted (`domain/repeats.ts`) | none |
| every handler-called use case of every system | `handled_messages` claim in its transaction | as below |
| payment `openCardPayment` | `payments.order_id` unique; found: return stored `clientSecret` | Stripe key `pi:<paymentId>`, `paymentId = deriveId('payment', orderId)` |
| payment `issueCardRefund` | `CardRefund` row locked `FOR UPDATE`, status `issued` returns | Stripe key `refund:<cardRefundId>`; past 24 h `findRefund` by metadata first |
| payment `cancelIntent` | `Payment` status | Stripe key `cancel:<paymentId>` |
| fulfilment `bookShipment` | `Shipment` row locked `FOR UPDATE`, status `booked` returns | `findBooking(shipmentId)` before `book`, client reference = shipment id; no race left since the row lock serializes attempts |
| fulfilment `registerArticle` | `Article` status | 3PL article key = sku |
| billing operator actions | `handled_requests (use_case, request_id)` claim, stored result returned | none |
| billing `issueInvoice` | `invoices.order_id` unique | none |
| billing `bookIncomingTransfer` | claim of `deriveId('transfer', bankTransactionId)`, and `IncomingTransfer` primary key = bank id | none |
| mailing `sendMail` | `Mail` row locked `FOR UPDATE`, status `sent` returns | provider takes none: a stop between send and commit, or the sweep, sends twice; `domain/repeats.ts` states the duplicate as accepted |

Repeats succeed: claims that return `repeat` make the use case return without writing; nothing throws "already done".

**P10.** Every acting use case reads in the transaction that commits. Aggregates are version-checked on save; new
aggregates fail on unique keys (`cart_id`, `order_id`, `bank_transaction_id`, `(kind, year)`). Replicas a decision reads
are read `FOR SHARE`, so a refresh cannot change them before the decision commits. Executors that call the outside hold
`FOR UPDATE` on their own row to commit. No use case retries inside itself; a `WriteConflict` fails it and the caller or
redelivery decides afresh. Accepted stale data, stated in `shop/src/domain/staleness.ts`: the `ProductOffer` lags
Payload by under a minute and the order takes the price the customer confirmed against the offer; `CustomerStanding`
lags billing, a customer entering dunning a moment ago may still choose invoice; `ListedArticle` lags fulfilment; the
warehouse figure lags the 3PL and the next report corrects it; payment's `cardPaymentState` is stale on return and a
later success refunds. Aggregates are small: `Stock` per sku (two checkouts of different teas never conflict), `Order`
per order, `Invoice` per invoice, `NumberSeries` per kind and year (invoices fail each other by the gapless rule).
`CustomerAccount` updates by message so two invoices of one customer do not fail each other.

**P11.** Each system connects as its own role, with DML on its own schema only, so no system can join or write
another's tables; Payload connects as `payload_app` to schema `payload`. Reads of another system go through its open
host service (`openCardPayment`, `cardPaymentState`, the delayed-work queries) or its events into a handler (replicas).
Payload is read through its Local API; the relay reads Payload's outbox through the reader assembly provides. Payload
keeps no record a system here owns: the editor's stock and for-sale fields are `virtual`, filled by shop's hook at read
time and never stored. Commands are the only way to change another system's records (`ShipOrder`,
`RefundCardPayment`, `DeliverMail`).

**P12.** Every system has an anti-corruption layer to every upstream; none conforms. An upstream's published language
(`@teashop/<other>/published`, `@teashop/cms/published`, `stripe`, `payload`, each `wire.ts`) may be imported only from
`src/adapters/**`, from the system's `apps/web/app/(<system>)/api/**` hooks and from `builder.ts` (rule `acl`);
handlers parse with the upstream's schema and call with the system's own terms. `src/published/**` may import only
`zod` and siblings (rule `published-closed`), so no published language reaches another's or the kernel.

**P13.** Other systems import only the four export paths; dependency-cruiser restricts `./builder` to
`packages/assembly/**` and `apps/*/assembly/**`, `./fakes` to `test/**`. Published language modules are written by
hand under `src/published/`, import nothing of their system, and no generator writes them. Services translate domain
to published types in `services/translate/to-published.ts`; the outbox adapter's `publish(tx, e: ShopEvent)` parses
`e` with its schema before insert, so only the published language crosses. Commands are declared by their receiver
(`ShipOrder` in fulfilment, `RefundCardPayment` in payment, `DeliverMail` in mailing). Private message schemas live in
`src/messages/private.ts`, which is not exported.

**P14.** Each message type has one zod schema, in its writer's published language or its private messages file, used
by the writer's outbox adapter and every handler. `type` carries the version (`shop.OrderShipped.v1`); handlers
subscribe per version. Allowed in place: an optional field whose absence old readers read truly. Anything else is a
`.v2` beside `.v1`: the writer writes both while any subscriber of `.v1` runs, readers handle both, `.v1` is dropped
when the probe shows no `.v1` row unpublished in any outbox and no `.v1` job in any queue or dead-letter queue. Records:
expand/contract, two deploys apart; repositories update only the columns they name and upsert child rows by id, so an
old process's save leaves new columns alone; contract migrations are files marked `-- contract`, run only once no old
image runs. In-process open host services are compiled with their callers and are outside the Scope.

**P15.** Use cases a caller is held on, and what they depend on: `placeOrder` for card orders depends on payment and
Stripe now (the customer pays now; the browser needs `clientSecret`); `cardUnavailable` is the visible failure, the order
stays and the deadline ends it. Every other storefront use case reads only shop's records and replicas. Operator use
cases write commands (`refundOrder` for card orders) and depend on no other system. `productStatus` reads shop only.
`delayedWork` asks four in-process open hosts because operations' rule is that the delayed view shows the owners'
current state (`operations/src/domain/delayed-work.ts`); a source down shows its section `unavailable` and the rest
answers. Everything else other systems do is asked by message. Use cases called for a message (`refreshProductOffer`,
`bookShipment`, `expireUnpaidCardOrder`, ...) call other systems while running and fail into redelivery when they are down.

**P16.** Each system's transaction runs on its own pool and role, so it can touch only its own schema. `Tx` is a type
parameter of driven ports only; `src/ports/driving/**` and `src/offer/ports.ts` may not import anything from
`ports/driven/transactions.ts` or a store client (rule `driving-ports-no-tx`). No `AsyncLocalStorage` holds a
transaction (biome `noRestrictedImports` of `node:async_hooks` outside `@teashop/common/telemetry.ts`). Payload's Local
API is never called with `req`; shop's Payload hook passes only skus to `productStatus`. `placeOrder` calls payment
after its own commit.

**P17.** Each part and how it ends, all stated in the owner's domain:

| Part | Waits on | Held deadline | Endings |
|---|---|---|---|
| shop card order | payment success | `Order.paymentDueAt` (30 min) | paid: ship; unpaid at deadline (after asking payment): cancel, stock freed |
| shop shipment request | fulfilment booking (holds stock reservation) | `Order.bookingExpectedBy` (48 h) | booked: reservation passed; overdue: flagged for operators, state accepted as it stands, reservation kept (brief allows no cancellation) |
| payment `Payment` | shop's cancel or Stripe's success (tentative operation, shop holds the right to cancel) | none of its own, shop's deadline ends it | succeeded; cancelled at Stripe; succeeded after cancel: full refund |
| payment `CardRefund` | Stripe | none, executor retries | refunded; refused, published |
| fulfilment `Shipment` | 3PL booking, dispatch | sweep after 1 h re-asks booking | booked; refused: ships nothing; dispatched |
| billing `Refund` for card orders | payment's answer (nothing held) | none: a status | refunded: credit note; refused: shown to operators |

Refusals are committed as outcomes (`CardRefundRefused`, a refused booking recorded and published as nothing shipped,
a refused article registration recorded as `Article.refused` and shown in the delayed view). Failures throw, commit
nothing, retry with backoff for weeks, park in a dead-letter queue the probe and the ops delayed page show.

**P18.** Each subscribed message is handled against the aggregate whatever arrived first (means per message in the
messages table): notices answered by fetching current state (`ProductSaved`, Stripe events); per-thing versions
(`ArticleStockChanged`, `CustomerDunningChanged`, `InvoiceStandingChanged`'s `invoiceVersion`); forward-only status
(`ArticleRegistered`, `ShipmentBooked`, `CardPaymentSucceeded`); facts that stand alone (`ShipmentDispatched` carries
`bookedAt`, so shop marks the reservation passed without `ShipmentBooked`; `OrderCancelled` and Stripe's success meet in
`Payment` and refund either way); keyed outcomes (`CardRefunded`, `CardRefundRefused` reference a `Refund` that exists
since billing wrote the command). Fulfilment's `Article` keeps the latest `reportedAt` per sku (the 3PL is the only
writer of that clock) and raises its version only then. Payment and billing never both tell shop of one thing.

**P19.** Each system package has `GLOSSARY.md`; a term enters it before code uses it. Names apart where words meet:
Payload's product is `CatalogProduct` in shop and fulfilment adapters, shop's replica is `ProductOffer`, fulfilment's
sku in the 3PL is `Article`; shop's `Stock` is available stock, the 3PL's figure is `warehouseFree` in shop and
`Article.free` in fulfilment; payment's `CardRefund` is money returned through Stripe, billing's `Refund` is an
operator's correction of an invoiced order; billing names shop's order only `orderId`; Stripe's `PaymentIntent` is
`StripePaymentIntent` in payment's adapter, payment's own term is `Payment`. Messages carry no `Event` suffix.

## Decisions the document left to me

**D1. The cut into systems.** Chose `shop`, `payment`, `fulfilment`, `billing`, `mailing`, `operations`, with stock
inside shop. Also holds: stock in fulfilment with checkout taking a tentative reservation by a call after committing
a pending order; transfers and dunning as their own system; no `mailing`, each system sending its own mails; no
`operations`, the trail read by an ops page asking each system.

**D2. Who owns the product record.** Chose Payload (external system), its configuration holding price, sku and tax
class rules. Also holds: a `catalog` system of this codebase owning commercial fields and vetoing in a Payload
`beforeValidate` hook through its specification, Payload keeping only copy and images.

**D3. How Payload tells of a change.** Chose a hidden Payload collection `outbox-messages` written in `afterChange`
with `req` (same Payload transaction), read by a relay reader assembly builds. Also holds: a provisional record from
a hook before commit, confirmed by a later read.

**D4. Conformist or anti-corruption layer.** Chose anti-corruption layer to every upstream. Also holds: payment
conforming to Stripe, its domain typed by `stripe` types.

**D5. Shared kernel.** Chose `Money` and `EmailAddress`, shared by four systems. Also holds: no kernel, each system
with its own money value.

**D6. Bus and relay.** Chose pg-boss in the same Postgres, queue per handler, polling relay every second, retry for
weeks, dead-letter queues kept. Also holds: a broker (RabbitMQ, SQS); relay by `LISTEN/NOTIFY`.

**D7. Store layout.** Chose one schema and one role per system in the one Postgres, one pool per system. Also holds:
one role for all with lint-only enforcement.

**D8. Transaction port.** Chose `Transactions<Tx>.run(work)` with `Tx` a type parameter of services and driven ports.
Also holds: an opaque branded `Tx` token mapped to the Drizzle transaction in the adapter; explicit `begin/commit`.

**D9. Concurrency means.** Chose version columns, unique keys, `FOR SHARE` on replicas read for a decision, `FOR
UPDATE` on executor rows. Also holds: `SERIALIZABLE` isolation with retries by redelivery.

**D10. Repeat detection.** Chose `handled_messages` claim by insert-on-conflict in the transaction, `handled_requests`
with stored result for operator calls, records for checkout. Also holds: records only, statuses set never toggled.

**D11. Ids and time.** Chose uuid v7 through id ports, uuid v5 (`deriveId`) for every id derived from another,
`Temporal.Instant` from `temporal-polyfill`. Also holds: `Date` and ids from Postgres sequences.

**D12. Courier.** Chose one `globalThis` symbol per system, filled in Next.js `instrumentation.ts`. Also holds: a module
singleton if Next.js shares module instances.

**D13. Processes.** Chose `web` (Next.js + Payload) and `worker` (relay, bus, cron), migrations as a release job.
Also holds: one process running everything; a process per system.

**D14. Libraries.** Chose Next.js 15, Drizzle, zod, vitest, testcontainers, dependency-cruiser, biome, pdfkit, pino.
Also holds: any equivalents.

**D15. Scheduled tasks.** Chose pg-boss cron; each sweep is one acting call writing one private message per item, ids
derived so a re-run inserts nothing new. Also holds: delayed messages (`startAfter`) written at placement.

**D16. Bank.** Chose polling every 5 minutes, window from the last booking date minus 3 days, one acting call per poll
writing a message per transfer, keyed by the bank's id. Also holds: one acting call per transfer from the poll adapter.

**D17. 3PL duplicate shipment.** Chose row lock on the shipment, lookup by client reference before create. Also holds:
relying on a 3PL that refuses a duplicate client reference.

**D18. Card payment opening.** Chose a synchronous in-process call from shop's service after its commit; payment stores
the `clientSecret`. Also holds: payment's own route the browser calls with the order id after checkout.

**D19. Payment deadline.** Chose a sweep plus a reconciliation asking payment, which asks Stripe. Also holds: deciding
on payment's last event alone and refunding a late success.

**D20. Operator refunds of card orders.** Chose billing commanding payment and issuing the credit note only on
`CardRefunded`. Also holds: credit note first, a refused card refund leaving it for operators to pay back by hand.

**D21. Customer standing.** Chose a `CustomerAccount` aggregate fed by private messages with invoice versions,
published with its own version. Also holds: invoice and account saved in one transaction.

**D22. Mails.** Chose a `mailing` system taking rendered mails with PDFs inline as base64, pending record, sweep resend.
Also holds: mailing fetching PDFs from billing's open host service at send time.

**D23. Booking wait.** Chose a 48-hour deadline on the order that flags operators. Also holds: no deadline, treating the
booking as status only.

**D24. Trail.** Chose an `operations` system keyed by `orderId`, mails linked through `tags.orderId`. Also holds:
correlation id on the envelope and a trail from tracing.

**D25. Delayed view.** Chose owners' open host queries plus a probe for outbox backlog and dead-letter queues. Also
holds: operations keeping replicas of delayed states from events.

**D26. Mechanism for reach rules.** Chose `package.json` `exports`, dependency-cruiser rules per layer, per-layer
`tsconfig` `lib`/`types`, biome restrictions, and route groups mapped to systems. Also holds: ESLint
`no-restricted-imports`; one package per layer.

**D27. Test layout.** Chose one contract file per port, a fake test in the default suite, a Postgres integration test
and vendor end-to-end tests outside it. Also holds: one test file with `describe.each` over implementations gated by
an env flag.

**D28. Operator request keys.** Chose a `requestId` hidden form field claimed in `handled_requests`; the operator as an
argument. Also holds: refund id generated by billing and a records-only repeat check.

**D29. Products never deleted.** Chose Payload `access.delete: () => false`. Also holds: a `ProductDeleted` message ending
for-sale.

**D30. Evolution practice.** Chose `.vN` types, both written during migration, expand/contract migrations two deploys
apart, lint on contract statements. Also holds: a schema registry with compatibility checks.

**D31. Editor fields.** Chose Payload virtual fields filled by shop's `afterRead` hook calling `productStatus`. Also holds:
fulfilment and shop writing status fields into Payload through its Local API, fields read-only for editors.

**D32. Calendar.** Chose `Europe/Berlin` in billing's domain for invoice dates, years and due dates. Also holds: UTC
dates.

**D33. Telemetry.** Chose `@opentelemetry/api` ambient and pino to stdout; trace context on the envelope. Also holds:
no tracing.

**D34. Business numbers.** Chose domain constants (30 min, 14 days, 7/14/14/14, 7 %/19 %, 48 h). Also holds: records
changed by use cases where the business wants runtime changes.

**D35. Brief readings.** Chose: one dispatch webhook per shipment listing every line's shipped quantity; a 3PL booking
refusal counts as nothing shipped; stock by webhook plus a 30-minute sync; past due means after the due date; a lost
dispute before invoicing becomes a credit note right after invoicing; operator refunds cover invoiced lines only; refund
mails for card refunds not asked by billing, credit note mails for the rest. Each other reading also holds the properties.

## Sentences I had to pick a reading for

**S1.** "A module is of the system whose layer or offer it belongs to, wherever the codebase keeps it." (Glossary:
System). Reading A: a Next.js route file in `apps/web` that adapts a way in is that system's driving adapter. Reading B:
modules must sit in the system's package, and route files may only re-export. Took A: route groups `(shop)`,
`(billing)` and so on are mapped to systems in dependency-cruiser, and they may import `./internal/*` of their system.

**S2.** "Business rules its configuration holds are its own, in its terms, even where this codebase writes them"
(Glossary: External system), with P2's "the business rules it holds are the external system's own where they decide a
record the external system keeps and no business rule of this system decides." Reading A: once Payload owns the
product, price above zero and sku rules in its configuration are Payload's. Reading B: they are the tea shop's rules
and need a system of this codebase. Took A: no `catalog` system; Payload's field validation holds them.

**S3.** "An external system this codebase configures, whose transaction can write a message to an outbox, MUST tell of
its change by such a message." (P8). Reading A: "can" means the configuration can make it do so (a hook joining the
transaction). Reading B: only a built-in outbox feature counts. Took A: the `outbox-messages` collection and an
`afterChange` hook with `req`.

**S4.** "the system provides it, and for an external system's outbox, assembly does." (Glossary: Outbox) with "Assembly.
The one place in a process". Reading A: assembly code shared by two processes may live in a package their assemblies
call. Reading B: each process's assembly directory writes its own. Took A: `@teashop/assembly` holds the Payload outbox
reader and `buildAllSystems`, imported only by `apps/*/assembly`.

**S5.** "an adapter or an outbox reader only as such a port or as the outside it adapts, each also through code of the
common library whose output changes neither how a use case acts nor what it answers." (P5). Reading A: an adapter may
not write outbox rows through a common-library helper, since the write's output matters. Reading B: a helper is just
the adapter's code. Took A: each system writes its own outbox SQL; the common library gives only the `Envelope` schema.

**S6.** "The same driven adapter querying a second store, or a hook calling the external system through the package it
parsed with, reaches an outside it does not adapt" with "a driven adapter that imports another driven adapter's module"
(P5). Reading A: files touching one outside form one adapter set and may share a schema module. Reading B: every port's
adapter is its own module group, sharing nothing. Took A: `adapters/driven/postgres/*` share `schema.ts`; cross-set
imports are refused. Outgoing commands and mail templates live in the `postgres` set because they write the outbox.

**S7.** "A use case MUST decide by data read inside the transaction that commits the decision, and the store MUST fail
that transaction's writes where the data has changed" (P10). Reading A: a replica in this store is such data, so its
refresh must fail or wait for the decision. Reading B: replicas are covered by the second sentence as stale data.
Took A for the row and B for the lag behind the owner: `FOR SHARE` on replicas in `placeOrder`, plus `staleness.ts`.

**S8.** "it MUST hold the moment it stops waiting in an aggregate of its own, if: it holds something until the answer
comes" (P17). Reading A: shop's stock reservation waiting on fulfilment's booking is something held. Reading B: the
reservation is shop's own state and the booking only progress. Took A: `Order.bookingExpectedBy` and the overdue flag.

**S9.** "by accepting the state as it stands" (P17). Reading A: flagging for operators and keeping the state is an
accepted ending. Reading B: acceptance must end the work with no further handling. Took A for the overdue booking and
for dunning's hand-over.

**S10.** "A message that only tells that a thing changed is answered by asking its sender for the thing's state" (P15)
and "or by answering what the thing is now" (P18). Reading A: Payload's `ProductSaved` may be a bare notice, shop and
fulfilment fetching through the Local API. Reading B: Payload's message must carry the product with a version. Took A:
`ProductSaved { productId }`, handlers fetch; a version raised in Payload would race between concurrent saves.

**S11.** "Code of another system MUST import of a system only its offer, and of that only what is typed by its
published language, a shared kernel or pure code of no system." (P13). Reading A: builders are on the offer for
assembly, and the sentence binds systems' code only. Reading B: builders, typed by no published language, may not be on
the offer. Took A: `./builder` export, restricted to assembly by lint.

**S12.** "Each driven port MUST have a fake" (P6) with "A downstream with an anti-corruption layer declares its own
driven port ... and fakes that". Reading A: shop's `CardPayments`, `CatalogSource` need shop's own fakes even though
payment's offer exports a fake of its open host. Reading B: the upstream's fake serves. Took A: shop's service tests run on shop's
`FakeCardPayments`; payment's offer fake is used by no test of shop's use cases.

**S13.** "Pure code of no system ... MUST load on every runtime of the language." (P1). Reading A: `temporal-polyfill`
and `zod` pass, since they load anywhere and read no ambient value when the zone is passed. Reading B: a polyfill
installing globals is ambient. Took A, using the non-global import (`import { Temporal } from 'temporal-polyfill'`).

**S14.** "A configuration value that chooses what lies behind a port, a key, a URL, a pool size, changes nothing for
the same records" (P4). Reading A: per-system database URLs with roles are such values. Reading B: a role that limits
what a system can read changes what it answers. Took A: roles only refuse what P11 already forbids.

**S15.** "What crosses between two systems, by a call or in a message, MUST be of the upstream system's published
language, or of a shared kernel both share." (P13). Reading A: published languages use plain cents and strings, never
the kernel's `Money`, even between systems sharing it. Reading B: sharers may pass `Money` across. Took A, since P13's
Why says a published language carries none of the kernel and P12 forbids a published language reaching a kernel.

**S16.** "with at most one acting call per call or message it handles" (P4). Reading A: a service's call to another
system after its commit is inside the use case, not a second acting call of the driving adapter. Reading B: any second
acting use case reached during one adapter call counts. Took A: `placeOrder` calls `openCardPayment` itself.

**S17.** "read it only through that open host service or the owner's published events delivered to a handler of the
reading system" (P11). Reading A: Payload's admin reading shop's stock through shop's `afterRead` hook is a read through
shop's driving port. Reading B: Payload's configuration must hold a replica fed by events. Took A: virtual fields.

**S18.** "A status that only shows how far another system has got, with nothing of this system's hanging on it, is no
wait." (P17). Reading A: billing's card `Refund` awaiting payment holds nothing, so needs no deadline. Reading B: the
credit note hangs on it, so it waits. Took A: no deadline; the refund's status shows on the ops page.
