# Fresh repository draft B, distilled set (property rules)

Tea shop from `brief.md`, built against `distilled.md` alone. TypeScript on Node 24, one Postgres 17
instance, Next.js 15 (App Router) with Payload 3 embedded, Stripe, a 3PL with webhooks, a bank API,
Postmark as mail provider. Libraries picked: Drizzle ORM over `pg`, Zod 4, `@js-temporal/polyfill`,
pg-boss 10 as the bus, pino and the OpenTelemetry API for observation, Vitest, Biome,
dependency-cruiser, testcontainers.

## Systems and what each owns

| System | Kind | Owns (records whose business rules it states) | Keeps (records it keeps for another owner, or copies) |
|---|---|---|---|
| `shop` | system of this codebase | `Cart`, `Order` (lines with price, sku, tax class snapshot; payment method; payment deadline; booking-overdue moment; dropped lines; status), `Stock` per sku (reservations of placed orders; the 3PL figure and its version as last reported), `SentMail` log of shop's mails, handled-message ids | replica `CatalogProduct` (Payload's product, projected into shop's terms, plus `listedAt3pl`), replica `DebtorStatus` per email (billing's) |
| `payment` | system of this codebase | `CardPayment` per order (amount, email, Stripe intent id once known, status, dispute state), `CardRefund` (refund id, amount, reason, status, Stripe refund id), `SentMail`, handled-message ids | none |
| `fulfillment` | system of this codebase | `Article` per sku (listed in the 3PL article master or not), `Shipment` per order (lines asked, 3PL order id, status, lines shipped), `SkuStock` per sku (3PL free-to-ship figure, version counter), handled-message ids | none |
| `billing` | system of this codebase | `Invoice` (number, date, lines, VAT per rate, payments applied, credit notes applied, due date, dunning stage and next moment), `CreditNote`, `NumberSeries` per kind and calendar year, `Transfer` (bank id, amount, reference, status, allocations, payback), `Refund` (requested by operator, card or invoice), `Debtor` per email (past-due invoice ids, version), `DisputeLoss` pending, `BankImportCursor`, `SentMail`, handled-message ids | snapshot of order lines on the invoice (copied from shop's `OrderShipped`) |
| Payload CMS | external system, in our `web` process, configured by this codebase | product documents (copy, images, slug, price, sku, tax class): its own records; the rules "price above zero", "sku unique", "sku fixed once saved" are its configuration's rules, in its terms (D2) | its own outbox collection `outbox` |
| Stripe | external system, run by vendor | PaymentIntents, charges, refunds, disputes | — |
| 3PL | external system, run by vendor | article master, warehouse orders, stock free to ship | — |
| Bank API | external system, run by vendor | incoming transfers | — |
| Postmark | external system, run by vendor | sent mails | — |

**Shared kernel** `src/kernel/`: `Money` (EUR, integer cents, add, subtract, multiply by quantity,
`vatPartOfGross(rate)` with half-up rounding), `EmailAddress` (trimmed, lowercased, validated). Value
types and what computes with them from arguments, no record schema, no rule about a record. Imported
by the domains of `shop`, `payment`, `billing`. `fulfillment` shares none.

**Code that is no system**

- Common library `src/lib/`: `messaging/` (envelope schema, `OutboxReader` interface, relay, bus over
  pg-boss, `MessageHandler` type), `courier/` (`createCourier`), `postgres/` (pool factory, the
  `TransactionRegistry` helper adapters use), `observability/` (logger courier, OTel helpers),
  `http/` (signature verify helpers). No business rule, no layers.
- Assembly: `src/processes/*/assembly.ts`, plus `src/processes/shared/payload-outbox-reader.ts`
  (assembly provides the outbox reader for Payload's outbox).
- Probes: `src/processes/web/probes/` (health, delivery console listing outbox backlog per reader
  and parked jobs).
- Tooling: migrations runner, schema-compatibility check, replica backfill script, test helpers.
- Payload configuration: `src/external/payload/` (external system's configuration; its hooks that
  call into a system are that system's driving adapters, kept in the system's folder).

## Ports and adapters

Conventions used by every system:

```ts
// branded ids per system, e.g. shop/domain/ids.ts
type OrderId = string & { readonly __brand: 'shop.OrderId' };
// every acting driving port that a handler calls takes the message id
type MessageRef = { readonly messageId: string };
// business refusals are returned; failures throw
```

Transaction port shape, same in each system, in its own terms (D5):

```ts
// shop/services/ports/driven/transaction.ts
export interface ShopTransaction { readonly system: 'shop'; commit(): Promise<void>; rollback(): Promise<void>; }
export interface ShopTransactions { open(): Promise<ShopTransaction>; }
```

The Postgres adapter keeps the Drizzle handle per open transaction in a `WeakMap<ShopTransaction,
ShopDb>` inside `shop/adapters/driven/postgres/transaction.ts` (`dbOf(tx)`), so repository adapters
get the handle without a cast and nothing outside the adapter layer can. The fake keeps staged writes
per transaction in the same way and applies them on `commit`.

### shop

Driving ports (`src/systems/shop/services/ports/driving/`), all implemented by services:

```ts
export interface Carts {
  setCartLine(input: { cartId: CartId | null; sku: Sku; quantity: number }): Promise<
    | { outcome: 'set'; cartId: CartId; cart: CartView }
    | { outcome: 'notForSale'; sku: Sku }
    | { outcome: 'cartCheckedOut'; cartId: CartId }>;
  viewCart(cartId: CartId): Promise<CartView | null>;                       // answering, current prices
}
export interface Checkout {
  paymentMethodsFor(email: EmailAddress): Promise<ReadonlyArray<PaymentMethod>>;   // answering
  placeOrder(input: {
    cartId: CartId;                       // idempotency key of the call
    email: EmailAddress;
    deliveryAddress: GermanDeliveryAddress;
    paymentMethod: PaymentMethod;         // 'card' | 'invoice'
    confirmedPrices: ReadonlyArray<{ sku: Sku; unitPriceGross: Money }>;
  }): Promise<
    | { outcome: 'placed'; orderId: OrderId; payment: { method: 'card'; secret: CardPaymentSecret } | { method: 'invoice' } | { method: 'card'; settled: 'paid' | 'cancelled' } }
    | { outcome: 'pricesChanged'; lines: ReadonlyArray<{ sku: Sku; confirmed: Money; current: Money }> }
    | { outcome: 'shortLines'; lines: ReadonlyArray<{ sku: Sku; requested: number; available: number }> }
    | { outcome: 'invoiceNotOffered' }
    | { outcome: 'notForSale'; skus: ReadonlyArray<Sku> }
    | { outcome: 'cartEmpty' }>;
}
export interface Storefront {                                                 // answering
  listProducts(): Promise<ReadonlyArray<ProductView>>;
  productBySlug(slug: string): Promise<ProductView | null>;
  availability(sku: Sku): Promise<{ availableStock: number; forSale: boolean } | null>;
}
export interface OrderProgress {                                              // called by handlers
  recordCardPaymentSucceeded(input: MessageRef & { orderId: OrderId; amount: Money }): Promise<'paid' | 'refundRequested' | 'alreadyRecorded'>;
  expireUnpaidOrder(input: MessageRef & { orderId: OrderId }): Promise<'cancelled' | 'notDue' | 'alreadySettled'>;
  recordShipmentBooked(input: MessageRef & { orderId: OrderId; stockVersions: ReadonlyArray<{ sku: Sku; version: number }> }): Promise<void>;
  recordShipmentRefused(input: MessageRef & { orderId: OrderId; reason: string }): Promise<void>;
  flagBookingOverdue(input: MessageRef & { orderId: OrderId }): Promise<'flagged' | 'notDue'>;
  applyShipmentReport(input: MessageRef & { orderId: OrderId; lines: ReadonlyArray<{ sku: Sku; shipped: number }> }): Promise<'shipped' | 'cancelledNothingShipped'>;
}
export interface StockReports {
  applyStockLevel(input: MessageRef & { sku: Sku; freeToShip: number; version: number }): Promise<void>;
}
export interface CatalogReplica {
  refreshProduct(input: MessageRef & { catalogProductId: string }): Promise<void>;   // notice, then ask Payload
  markListed(input: MessageRef & { sku: Sku }): Promise<void>;
}
export interface DebtorReplica {
  applyDebtorStatus(input: MessageRef & { email: EmailAddress; inDunning: boolean; version: number }): Promise<void>;
}
export interface ShopMails {
  sendOrderMail(input: MessageRef & { orderId: OrderId; kind: 'confirmation' | 'cancelled' | 'linesDropped' }): Promise<void>;
}
export interface ShopOps {                                                    // answering
  order(orderId: OrderId): Promise<OrderOpsView | null>;
  delayed(): Promise<ReadonlyArray<DelayedOrderView>>;                        // booking overdue, refused
}
```

Driven ports (`src/systems/shop/services/ports/driven/`):

```ts
export interface Orders {
  byId(tx: ShopTransaction, id: OrderId): Promise<Order | null>;
  byCart(tx: ShopTransaction, cartId: CartId): Promise<Order | null>;
  save(tx: ShopTransaction, order: Order): Promise<void>;        // insert or version-compared update
}
export interface CartsRepository { byId(tx: ShopTransaction, id: CartId): Promise<Cart | null>; save(tx: ShopTransaction, cart: Cart): Promise<void>; }
export interface StockRepository { bySkus(tx: ShopTransaction, skus: ReadonlyArray<Sku>): Promise<ReadonlyArray<Stock>>; save(tx: ShopTransaction, stock: Stock): Promise<void>; }
export interface CatalogProducts { bySkus(tx: ShopTransaction, skus: ReadonlyArray<Sku>): Promise<ReadonlyArray<CatalogProduct>>; byCatalogId(tx: ShopTransaction, id: string): Promise<CatalogProduct | null>; save(tx: ShopTransaction, p: CatalogProduct): Promise<void>; all(): Promise<ReadonlyArray<CatalogProduct>>; }
export interface DebtorStatuses { byEmail(tx: ShopTransaction, email: EmailAddress): Promise<DebtorStatus | null>; save(tx: ShopTransaction, s: DebtorStatus): Promise<void>; }
export interface HandledMessages { claim(tx: ShopTransaction, messageId: string): Promise<'claimed' | 'seen'>; }
export interface SentMails { record(tx: ShopTransaction, mail: SentMailRecord): Promise<void>; byOrder(orderId: OrderId): Promise<ReadonlyArray<SentMailRecord>>; }
export interface ShopTransactions { open(): Promise<ShopTransaction>; }
export interface Clock { now(): Temporal.Instant; }
export interface IdGenerator { orderId(): OrderId; cartId(): CartId; messageId(): string; }

// outbox port, split by what shop asks, in shop's terms; adapters translate to upstream languages
export interface FulfilmentRequests { requestShipment(tx: ShopTransaction, order: Order): Promise<void>; }      // -> fulfillment BookShipment.v1
export interface PaymentRequests {
  requestRefund(tx: ShopTransaction, refund: { refundId: string; orderId: OrderId; amount: Money; reason: 'linesDropped' | 'paidAfterCancellation' }): Promise<void>;  // -> payment RefundCardPayment.v1
  cancelCardPayment(tx: ShopTransaction, orderId: OrderId): Promise<void>;   // -> payment CancelCardPayment.v1
}
export interface ShopEvents { orderShipped(tx: ShopTransaction, order: Order): Promise<void>; }               // -> shop OrderShipped.v1
export interface ShopSchedule {
  paymentDeadline(tx: ShopTransaction, orderId: OrderId, at: Temporal.Instant): Promise<void>;
  bookingOverdue(tx: ShopTransaction, orderId: OrderId, at: Temporal.Instant): Promise<void>;
  orderMail(tx: ShopTransaction, orderId: OrderId, kind: OrderMailKind): Promise<void>;
}

// calls to other systems
export interface CardPayments {          // ACL in front of payment's open host service
  start(input: { orderId: OrderId; amount: Money; email: EmailAddress }): Promise<{ secret: CardPaymentSecret }>;
}
export interface CatalogSource {          // ACL in front of Payload's REST API
  product(catalogProductId: string): Promise<CatalogProductFacts | null>;
}
export interface CustomerMailer { send(mail: ShopMail): Promise<{ providerId: string }>; }
```

Adapters:

- Driven, Postgres (`adapters/driven/postgres/`): `orders.ts`, `carts.ts`, `stock.ts`,
  `catalog-products.ts`, `debtor-statuses.ts`, `handled-messages.ts`, `sent-mails.ts`,
  `transaction.ts` (`createShopTransactions(pool)`), `outbox.ts` (implements `FulfilmentRequests`,
  `PaymentRequests`, `ShopEvents`, `ShopSchedule`, parsing every payload with the receiving upstream's
  or shop's own published-language schema before insert), `outbox-reader.ts` (the outbox reader
  for the relay), `tables.ts` (Drizzle table definitions for schema `shop`).
- Driven, other: `payment/card-payments.ts` (calls `payment`'s `CardPaymentsService` in-process,
  maps `clientSecret` to shop's `CardPaymentSecret`), `payload/catalog-source.ts` (fetch
  `/api/products/:id` with an API key; parses with Payload's generated `Product` type and a Zod schema
  stated once in `src/external/payload/schemas.ts`; maps to `CatalogProductFacts`),
  `postmark/customer-mailer.ts`, `system/clock.ts`, `system/ids.ts` (uuid v7).
- Driven, fakes (`adapters/driven/memory/`): one per driven port above.
- Driving: `http/checkout-route.ts` (`POST /api/checkout`), `http/cart-routes.ts`,
  `ui/` server components for storefront and ops sections, `payload/availability-field.ts` (Payload
  `afterRead` hook for the virtual fields `availableStock` and `forSale`, a hook calling
  `Storefront.availability`), `handlers/*.ts` (one per subscribed message type), `courier.ts`.

### payment

Driving ports:

```ts
// open host service, exported in payment's offer
export interface CardPaymentsService {
  start(input: { orderId: string; amountCents: number; email: string }): Promise<{ clientSecret: string }>;  // idempotency key: orderId
  status(orderId: string): Promise<CardPaymentStatusV1 | null>;                                              // answering
}
// internal
export interface StripeEvents {
  recordStripeEvent(input: { eventId: string; event: StripeFact }): Promise<'recorded' | 'ignored' | 'alreadyRecorded'>;
}
export interface RefundRequests {
  requestRefund(input: MessageRef & { refundId: RefundId; orderId: string; amount: Money; reason: RefundReason }): Promise<'accepted' | 'refused'>;
  executeRefund(input: MessageRef & { refundId: RefundId }): Promise<'refunded' | 'declined'>;
  cancelIntent(input: MessageRef & { orderId: string }): Promise<void>;
}
export interface PaymentMails { sendRefundMail(input: MessageRef & { refundId: RefundId }): Promise<void>; }
export interface PaymentOps { byOrder(orderId: string): Promise<PaymentOpsView | null>; overdueRefunds(): Promise<ReadonlyArray<RefundOpsView>>; }
```

`StripeFact` is payment's own union (`intentSucceeded`, `intentFailed`, `refundUpdated`,
`disputeOpened`, `disputeClosed{won|lost}`), built by the hook from Stripe's event.

Driven ports: `CardPaymentsRepository`, `CardRefunds`, `HandledMessages`, `SentMails`,
`PaymentTransactions`, `Clock`, `IdGenerator`, `PaymentEvents` (outbox: `CardPaymentSucceeded.v1`,
`CardRefundSucceeded.v1`, `CardRefundRefused.v1`, `ChargeDisputed.v1`, `DisputeLost.v1`),
`PaymentSchedule` (private: `ExecuteRefund`, `CancelIntent`, `RefundMail`), `CustomerMailer`, and

```ts
export interface CardGateway {
  openIntent(input: { paymentId: PaymentId; orderId: string; amount: Money }, key: string): Promise<{ intentId: string; clientSecret: string }>;
  cancelIntent(intentId: string, key: string): Promise<'cancelled' | 'alreadySucceeded' | 'alreadyCancelled'>;
  findRefund(intentId: string, refundId: RefundId): Promise<{ gatewayRefundId: string; state: 'pending' | 'succeeded' | 'failed' } | null>;
  refund(input: { intentId: string; refundId: RefundId; amount: Money }, key: string): Promise<{ gatewayRefundId: string } | { declined: 'disputed' | 'exceedsCharge' | 'other'; detail: string }>;
}
```

Adapters: `stripe/card-gateway.ts` (Stripe SDK client from assembly; tells a decline from a
failure: Stripe `card_error`/`charge_disputed` codes are declines, network and 5xx throw),
`postgres/*`, `memory/*`, driving `stripe/hook.ts` (`POST /api/hooks/stripe`, raw body,
`stripe.webhooks.constructEvent`, maps to `StripeFact`, awaits the use case, answers 200 only after
it returns), `handlers/*`, `http/` none else.

### fulfillment

Driving ports:

```ts
export interface Shipments {
  bookShipment(input: MessageRef & { orderId: string; address: ShipAddress; lines: ReadonlyArray<{ sku: Sku; quantity: number }> }): Promise<'booked' | 'refused' | 'alreadyBooked'>;
  recordShipmentReport(input: { eventId: string; warehouseOrderId: string; lines: ReadonlyArray<{ sku: Sku; shipped: number }> }): Promise<'recorded' | 'alreadyRecorded' | 'unknownOrder'>;
}
export interface StockLevels {
  stockChanged(input: { eventId: string; sku: Sku }): Promise<void>;            // hook notice -> private RefreshStockLevel
  refreshStockLevel(input: MessageRef & { sku: Sku }): Promise<'reported' | 'unchanged'>;
  scheduleFullRefresh(input: MessageRef): Promise<void>;                         // nightly: one message per sku
}
export interface Articles {
  ensureListed(input: MessageRef & { catalogProductId: string }): Promise<'listed' | 'alreadyListed' | 'noSku'>;
}
export interface FulfillmentOps { shipment(orderId: string): Promise<ShipmentOpsView | null>; delayed(): Promise<ReadonlyArray<ShipmentOpsView>>; }
```

Driven ports: `ShipmentsRepository`, `ArticlesRepository`, `SkuStockRepository`, `HandledMessages`,
`FulfillmentTransactions`, `Clock`, `IdGenerator`, `FulfillmentEvents` (outbox:
`ArticleListed.v1`, `ShipmentBooked.v1`, `ShipmentRefused.v1`, `ShipmentReported.v1`,
`StockLevelReported.v1`), `FulfillmentSchedule` (private `RefreshStockLevel`), `CatalogSource`
(fulfillment's own ACL to Payload REST), and

```ts
export interface Warehouse {
  upsertArticle(article: { sku: Sku; name: string }): Promise<void>;                          // PUT by sku: repeat changes nothing
  createOrder(order: { reference: ShipmentId; address: ShipAddress; lines: ReadonlyArray<{ sku: Sku; quantity: number }> }): Promise<{ warehouseOrderId: string } | { refused: string }>;
  orderByReference(reference: ShipmentId): Promise<{ warehouseOrderId: string } | null>;
  stockLevel(sku: Sku): Promise<number>;
  allSkus(): Promise<ReadonlyArray<Sku>>;
}
```

Adapters: `threepl/warehouse.ts` (HTTP client from assembly; a 409 on duplicate reference maps to
`orderByReference`), `postgres/*`, `memory/*`, driving `threepl/hook.ts` (`POST /api/hooks/3pl`,
HMAC check, event id from header), `handlers/*`, `schedules/nightly-stock.ts`.

### billing

Driving ports:

```ts
export interface Invoicing {
  invoiceShippedOrder(input: MessageRef & ShippedOrderFacts): Promise<'invoiced' | 'alreadyInvoiced'>;
  sendDocumentMail(input: MessageRef & { document: { kind: 'invoice' | 'creditNote' | 'reminder'; id: string } }): Promise<void>;
}
export interface Refunds {
  refundOrder(input: { orderId: string; scope: { kind: 'full' } | { kind: 'lines'; lines: ReadonlyArray<{ sku: Sku; quantity: number }> }; operator: OperatorId; requestKey: string }): Promise<
    | { outcome: 'creditNoteIssued'; creditNoteNumber: string }              // invoice order
    | { outcome: 'cardRefundRequested'; refundId: RefundId }               // card order, credit note follows success
    | { outcome: 'exceedsInvoiced' } | { outcome: 'notInvoiced' }>;
  recordCardRefundOutcome(input: MessageRef & { refundId: RefundId; outcome: 'succeeded' | 'refused'; reason?: string }): Promise<void>;
  recordDisputeLost(input: MessageRef & { orderId: string; amount: Money; disputeId: string }): Promise<void>;
  recordPayback(input: { transferId: TransferId | null; invoiceNumber: string; amount: Money; operator: OperatorId; requestKey: string }): Promise<'recorded' | 'exceedsSurplus'>;
}
export interface BankTransfers {
  importTransfers(input: { batch: ReadonlyArray<BankTransferFacts>; cursor: string }): Promise<{ newTransfers: number }>;
  matchTransfer(input: MessageRef & { transferId: TransferId }): Promise<'paidInvoice' | 'needsOperator' | 'alreadyMatched'>;
  assignTransfer(input: { transferId: TransferId; allocations: ReadonlyArray<{ invoiceNumber: string; amount: Money }>; payback: Money | null; operator: OperatorId; requestKey: string }): Promise<'assigned' | 'allocationsExceedTransfer' | 'exceedsOpenAmount' | 'alreadyAssigned'>;
}
export interface Dunning {
  scheduleDueDunning(input: MessageRef & { today: Temporal.PlainDate }): Promise<{ scheduled: number }>;
  advanceInvoiceDunning(input: MessageRef & { invoiceId: InvoiceId }): Promise<'reminded' | 'handedOver' | 'markedPastDue' | 'nothingDue'>;
  recomputeDebtor(input: MessageRef & { email: EmailAddress }): Promise<void>;
  takeOverInvoice(input: { invoiceId: InvoiceId; operator: OperatorId }): Promise<'takenOver' | 'notHandedOver'>;
}
export interface BillingOps { byOrder(orderId: string): Promise<BillingOpsView>; transfersNeedingOperator(): Promise<ReadonlyArray<TransferOpsView>>; bankImportStatus(): Promise<{ lastSuccessAt: Temporal.Instant | null }>; overdueRefunds(): Promise<ReadonlyArray<RefundOpsView>>; }
```

Driven ports: `InvoicesRepository`, `CreditNotes`, `NumberSeriesRepository`, `TransfersRepository`,
`RefundsRepository`, `Debtors`, `DisputeLosses`, `BankImportCursors`, `HandledMessages`,
`SentMails`, `BillingTransactions`, `Clock`, `IdGenerator`, `BillingEvents` (outbox:
`DebtorStatusChanged.v1`), `PaymentRequests` (ACL: writes `payment`'s `RefundCardPayment.v1`),
`BillingSchedule` (private: `MatchTransfer`, `AdvanceInvoiceDunning`, `RecomputeDebtor`,
`DocumentMail`, `RefundOverdue`), `DocumentRenderer` (`render(doc: InvoiceDocument | CreditNoteDocument | ReminderDocument): Promise<Uint8Array>`), `CustomerMailer`, and

```ts
export interface BankStatements { transfersSince(cursor: string | null): Promise<{ transfers: ReadonlyArray<BankTransferFacts>; cursor: string }>; }
```

Adapters: `bank/bank-statements.ts`, `pdf/document-renderer.ts` (pdfkit), `postmark/customer-mailer.ts`,
`postgres/*`, `memory/*`, driving `schedules/bank-poll.ts`, `schedules/dunning-sweep.ts`,
`handlers/*`, `ui/` ops sections and `http/ops-actions.ts` (server actions for refund, assign,
payback, take-over).

## Calls and messages

Calls between systems (all in-process; none carries a transaction; every driving port takes plain
published-language values):

| Caller | Callee | Port | Sync | Refusal comes back as |
|---|---|---|---|---|
| `shop` checkout service, after its commit | `payment` | `CardPaymentsService.start` | yes, browser waits for the secret (P15 exception) | none expected; Stripe failure throws, checkout route answers 503 "retry", browser retries with same `cartId` |
| `shop` and `fulfillment` adapters | Payload REST | `GET /api/products/:id` | yes, inside a use case called for a message | 404 -> `null`; 5xx throws, bus redelivers |
| `payment` adapter | Stripe API | intents, refunds | yes | decline returned as `{declined}` and committed as `CardRefundRefused`; network failure throws |
| `fulfillment` adapter | 3PL API | articles, orders, stock | yes, in handlers | 3PL refusal returned as `{refused}` and committed as `ShipmentRefused`; 5xx throws |
| `billing` scheduled task | Bank API | `transfersSince` | yes | outage throws; cursor stays, next run repeats |
| each system's mail handler | Postmark | send | yes | 4xx validation -> operator view via parked message; 5xx throws |
| Payload | `shop` hook | `Storefront.availability` (answering) | yes | none |
| Stripe | `payment` hook | `StripeEvents.recordStripeEvent` | yes, 200 after commit | non-2xx makes Stripe resend |
| 3PL | `fulfillment` hook | `Shipments.recordShipmentReport`, `StockLevels.stockChanged` | yes, 200 after commit | non-2xx makes the 3PL resend |

Messages (all through outbox, relay, pg-boss; never synchronous; every handler acknowledges only when
its use case has returned committed):

| Message | Kind | Written by (outbox) | Handled by | Notes |
|---|---|---|---|---|
| `payload.ProductSaved.v1` `{productId}` | published event (Payload's) | Payload `afterChange` hook, in Payload's transaction, into `payload.outbox` | `shop` `CatalogReplica.refreshProduct`; `fulfillment` `Articles.ensureListed` | notice; both ask Payload REST for the product now (P18) |
| `fulfillment.ArticleListed.v1` `{sku}` | published event | `fulfillment` | `shop` `CatalogReplica.markListed` | sku now for sale |
| `fulfillment.BookShipment.v1` `{orderId, address, lines}` | command, fulfillment's published language | `shop` (adapter `FulfilmentRequests`) | `fulfillment` `Shipments.bookShipment` | sent when card order paid or invoice order placed |
| `fulfillment.ShipmentBooked.v1` `{orderId, shipmentId, stockVersions[]}` | published event | `fulfillment` | `shop` `recordShipmentBooked` | stock versions drive reservation release |
| `fulfillment.ShipmentRefused.v1` `{orderId, reason}` | published event | `fulfillment` | `shop` `recordShipmentRefused` | refusal of the command, committed as outcome |
| `fulfillment.ShipmentReported.v1` `{orderId, lines[{sku, ordered, shipped}]}` | published event | `fulfillment` | `shop` `applyShipmentReport` | |
| `fulfillment.StockLevelReported.v1` `{sku, freeToShip, version}` | published event | `fulfillment` | `shop` `applyStockLevel` | receiver keeps highest version |
| `fulfillment.private.RefreshStockLevel` `{sku}` | private | `fulfillment` | `fulfillment` `refreshStockLevel` | after hook notice, after booking, nightly |
| `shop.OrderShipped.v1` `{orderId, email, paymentMethod, shippedAt, billingAddress, lines[{sku, name, quantity, unitPriceGrossCents, taxClass}]}` | published event | `shop` | `billing` `invoiceShippedOrder` | event-carried state; billing snapshots lines |
| `shop.private.PaymentDeadlinePassed` `{orderId}`, deliverAfter = placedAt + 30 min | private | `shop` | `shop` `expireUnpaidOrder` | clock by held-back message |
| `shop.private.BookingOverdue` `{orderId}`, deliverAfter = asked + 4 h | private | `shop` | `shop` `flagBookingOverdue` | |
| `shop.private.OrderMail` `{orderId, kind}` | private | `shop` | `shop` `sendOrderMail` | |
| `payment.RefundCardPayment.v1` `{refundId, orderId, amountCents, reason}` | command, payment's published language | `shop`, `billing` | `payment` `requestRefund` | |
| `payment.CancelCardPayment.v1` `{orderId}` | command | `shop` | `payment` `cancelIntent` (via private `CancelIntent`) | |
| `payment.CardPaymentSucceeded.v1` `{orderId, paymentId, amountCents}` | published event | `payment` | `shop` `recordCardPaymentSucceeded` | |
| `payment.CardRefundSucceeded.v1` / `CardRefundRefused.v1` `{refundId, orderId, amountCents, reason?}` | published event, names no requester | `payment` | `billing` `recordCardRefundOutcome` (ignores refund ids it holds no `Refund` for); `shop` subscribes to neither | refusal reaches the deciding system as event |
| `payment.ChargeDisputed.v1`, `payment.DisputeLost.v1` | published event | `payment` | `billing` `recordDisputeLost` (lost only) | |
| `payment.private.ExecuteRefund`, `CancelIntent`, `RefundMail` | private | `payment` | `payment` | |
| `billing.DebtorStatusChanged.v1` `{email, inDunning, version}` | published event | `billing` | `shop` `applyDebtorStatus` | |
| `billing.private.MatchTransfer`, `AdvanceInvoiceDunning`, `RecomputeDebtor`, `DocumentMail`, `RefundOverdue` | private | `billing` | `billing` | |

Business processes: the order is orchestrated by `shop` (it tells `fulfillment` and `payment` by
commands which step to take); invoicing, refunds after invoicing and dunning are choreographed
(`billing` reacts to `shop`'s and `payment`'s events and decides its own next step).

Key sequences, concretely:

1. Checkout (card). `placeOrder` opens a shop transaction; claims nothing (the call's key is
   `cartId`, unique on `orders.cart_id`); loads cart, replicas, `Stock` of each sku; domain
   `decidePlacement(...)` returns refusal or `Order` + reservations; saves `Order`, `Cart`
   (`checkedOut`), every touched `Stock` (version-compared), writes `PaymentDeadlinePassed`
   (deliverAfter = deadline); commits. After commit calls `CardPayments.start`. `payment.start`
   claims by `orderId` (unique), commits `CardPayment{status: awaitingCharge}`, then after commit calls
   `openIntent` with key `payment:<paymentId>` and returns `clientSecret`. Repeat of the whole call
   finds the order by cart, calls `start` again, which finds the `CardPayment` and calls Stripe with
   the same key (Stripe answers the same intent; the 30-minute window is inside Stripe's 24-hour key
   retention).
2. Paid. Stripe hook -> `recordStripeEvent` claims `stripe:<eventId>`, marks `CardPayment` succeeded,
   writes `CardPaymentSucceeded`. Shop: order `awaitingPayment` -> `paid`, writes `BookShipment`,
   `OrderMail{confirmation}`, `BookingOverdue`. Order `cancelled` -> domain decides
   `refundInFull`, writes `RefundCardPayment{refundId: <orderId>:late}`.
3. Deadline. `expireUnpaidOrder`: order not paid -> `cancelled`, reservations removed from `Stock`
   (saved), `CancelCardPayment`, `OrderMail{cancelled}`.
4. Booking. `bookShipment` claims message id; if `Shipment` booked, answers `alreadyBooked`;
   else commits nothing yet, calls `Warehouse.createOrder` with `reference = shipmentId`
   (= `ship:<orderId>`), then in its transaction saves `Shipment{booked}`, raises `SkuStock.version`
   of each sku, writes `ShipmentBooked{stockVersions}` and one `RefreshStockLevel` per sku.
5. Stock. `refreshStockLevel` reads `SkuStock` (version v0), asks the 3PL, then in a transaction
   loads `SkuStock` again, fails if version is not v0 (redelivered), else saves v0+1 and writes
   `StockLevelReported{version: v0+1}`. Shop's `Stock` keeps a reservation counted until it has a
   report whose version is greater than the reservation's `bookedAtVersion`, then drops it.
6. Shipment report. Shop drops unshipped quantities; card order with drops writes
   `RefundCardPayment{<orderId>:dropped}`; nothing shipped -> `cancelled`; else writes
   `OrderShipped`; mails for drops/cancellation.
7. Invoice. `invoiceShippedOrder` claims message id, loads `NumberSeries(invoice, year in
   Europe/Berlin)`, domain builds `Invoice` (net, VAT per rate, gross; card -> paid; invoice -> due
   +14 days, first dunning moment = due + 1 day), saves invoice and series (both, tied by the
   gapless rule), applies a pending `DisputeLoss` as credit note if one exists, writes
   `DocumentMail`.
8. Transfers. Bank poll every 5 min -> `importTransfers` inserts `Transfer` rows (bank id unique,
   on conflict nothing), writes `MatchTransfer` per inserted row, saves cursor. `matchTransfer`:
   domain `autoMatch(transfer, invoiceByReference)` -> pays invoice (saves `Transfer` and `Invoice`
   together; the transfer is applied once by rule) or `needsOperator`; writes `RecomputeDebtor`.
9. Dunning. Daily 06:00 Europe/Berlin -> `scheduleDueDunning` writes one `AdvanceInvoiceDunning` per
   invoice with `nextDunningAt <= today` and open; handler advances stage by domain
   `nextDunningStep(invoice, today)`, writes reminder mail and `RecomputeDebtor`.

## Processes

| Process | Entry point | Runs | Assembly |
|---|---|---|---|
| `web` | `next start` (`next.config.ts` with `withPayload`) ; `src/instrumentation.ts` `register()` calls `assembleWeb()` once per process | storefront pages, `/api/checkout`, `/api/cart/*`, `/api/hooks/stripe`, `/api/hooks/3pl`, ops pages and server actions under `/ops`, Payload admin under `/admin`, probes `/health`, `/ops/delivery` | `src/processes/web/assembly.ts` |
| `worker` | `node dist/processes/worker/main.js` | relay (polls every 500 ms), all handlers via `boss.work`, scheduled tasks via `boss.schedule` (`billing.bank-poll` `*/5 * * * *`, `billing.dunning-sweep` `0 6 * * *`, `fulfillment.stock-nightly` `0 3 * * *`, all tz Europe/Berlin) | `src/processes/worker/assembly.ts` |
| `migrate` (tooling) | `node dist/tooling/migrate.js` before each deploy | applies `src/systems/*/migrations/*.sql` (drizzle-kit generated, then hand-checked), `payload migrate`, `pg-boss` schema install; creates roles `shop_app`, `payment_app`, `fulfillment_app`, `billing_app`, `payload_app`, `bus_app` with grants on their own schema only | none |

Assembly, `web`:

```ts
export async function assembleWeb(config: WebConfig): Promise<void> {
  installTelemetry(config.otel);                       // registers OTel provider; sets logger transport in logger courier
  const pools = createPools(config.database);          // one pg.Pool per role
  const clock = systemClock(); const stripe = new Stripe(config.stripe.secretKey);
  const payment = buildPaymentForWeb({ pool: pools.payment, stripe, stripeWebhookSecret: config.stripe.webhookSecret, postmark: config.postmark, clock });
  buildShopForWeb({ pool: pools.shop, cardPayments: payment.cardPayments, catalogApi: config.payloadApi, clock });
  buildFulfillmentForWeb({ pool: pools.fulfillment, warehouse: config.threePl, clock });
  buildBillingForWeb({ pool: pools.billing, clock });
  fillDeliveryProbe({ readers: [...], boss: await startBoss(pools.bus) });
}
```

Each `build<System>ForWeb` is that system's system builder: it builds its services from the factories,
fills that system's courier (`shopCourier.fill({ checkout, carts, storefront, ops })`) and returns
only what another system's builder takes (`payment` returns `{ cardPayments: CardPaymentsService }`).
Route files read `shopCourier.get()` per request. `buildShopForWeb` is the only place
`shopCourier.fill` is called.

Assembly, `worker`:

```ts
export async function assembleWorker(config: WorkerConfig) {
  installTelemetry(config.otel);
  const pools = createPools(config.database);
  const boss = await startBoss(pools.bus);
  const payment = buildPaymentForWorker({...});      // -> { handlers, outboxReader, schedules }
  const shop = buildShopForWorker({..., cardPayments: payment.cardPayments });
  const fulfillment = buildFulfillmentForWorker({...});
  const billing = buildBillingForWorker({...});
  const payloadReader = createPayloadOutboxReader(pools.payload);    // assembly provides it
  const bus = createBus(boss, { retryLimit: 25, retryBackoff: true, retryDelay: 15, deadLetterSuffix: '__parked' });
  bus.register([...shop.handlers, ...payment.handlers, ...fulfillment.handlers, ...billing.handlers]);
  assertPrivateSubscriptions(bus);                    // private types only by the writer's handlers
  bus.registerSchedules([...billing.schedules, ...fulfillment.schedules]);
  createRelay({ readers: [shop.outboxReader, payment.outboxReader, fulfillment.outboxReader, billing.outboxReader, payloadReader], bus, pollMs: 500 }).start();
}
```

Relay: for each reader, `readBatch(100)` (`SELECT ... WHERE delivered_at IS NULL ORDER BY seq FOR
UPDATE SKIP LOCKED`), `bus.publish(envelope)` (pg-boss `publish(type, envelope, { id, startAfter })`),
then `markDelivered`. Parked jobs stay in `<queue>__parked` with retention 3650 days; the delivery
probe lists and requeues them.

Configuration values: `DATABASE_URL_<ROLE>`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`THREEPL_BASE_URL`, `THREEPL_API_KEY`, `THREEPL_WEBHOOK_SECRET`, `BANK_BASE_URL`, `BANK_TOKEN`,
`POSTMARK_TOKEN`, `POSTMARK_FROM_STREAM`, `PAYLOAD_SECRET`, `PAYLOAD_API_KEY`, `OTEL_EXPORTER_URL`.
Read only in `src/processes/*/config.ts` (Zod-parsed); no business number among them.

## Directory tree

```
.
├── package.json
├── tsconfig.json                       # paths: @/kernel/*, @/lib/*, @/systems/*, @/external/*
├── biome.json                          # noRestrictedGlobals (process, Buffer, window, document) in src/systems/*/domain, src/kernel
├── .dependency-cruiser.cjs             # reach rules, see P1, P5, P12, P13
├── next.config.ts
├── payload.config.ts                   # re-exports src/external/payload/config.ts (Next.js alias @payload-config)
├── drizzle/
│   ├── shop.config.ts
│   ├── payment.config.ts
│   ├── fulfillment.config.ts
│   └── billing.config.ts
├── src/
│   ├── instrumentation.ts              # register(): assembleWeb(loadWebConfig())
│   ├── app/
│   │   ├── (store)/page.tsx            # renders shop/adapters/driving/ui/ProductList
│   │   ├── (store)/products/[slug]/page.tsx
│   │   ├── (store)/cart/page.tsx
│   │   ├── (store)/checkout/page.tsx
│   │   ├── api/checkout/route.ts       # export { POST } from '@/systems/shop/adapters/driving/http/checkout-route'
│   │   ├── api/cart/lines/route.ts
│   │   ├── api/hooks/stripe/route.ts   # export { POST } from '@/systems/payment/adapters/driving/stripe/hook'
│   │   ├── api/hooks/3pl/route.ts
│   │   ├── health/route.ts             # probe
│   │   ├── ops/orders/[orderId]/page.tsx   # journey: shop, payment, fulfillment, billing sections
│   │   ├── ops/delayed/page.tsx
│   │   ├── ops/transfers/page.tsx
│   │   ├── ops/invoices/[invoiceId]/page.tsx
│   │   ├── ops/delivery/page.tsx       # probe
│   │   └── (payload)/admin/[[...segments]]/page.tsx   # Payload generated
│   ├── kernel/
│   │   ├── money.ts
│   │   └── email-address.ts
│   ├── lib/
│   │   ├── messaging/envelope.ts
│   │   ├── messaging/outbox-reader.ts
│   │   ├── messaging/postgres-outbox.ts   # helpers to insert/read an outbox table given a Drizzle handle
│   │   ├── messaging/relay.ts
│   │   ├── messaging/bus.ts
│   │   ├── messaging/handler.ts
│   │   ├── courier/courier.ts
│   │   ├── postgres/pools.ts
│   │   ├── postgres/transaction-registry.ts
│   │   ├── observability/log.ts        # logger courier, read per call
│   │   ├── observability/telemetry.ts  # installTelemetry, envelope trace helpers
│   │   └── http/hmac.ts
│   ├── external/
│   │   └── payload/
│   │       ├── config.ts
│   │       ├── collections/products.ts # fields, min price, unique sku, sku update denied, delete denied, virtual fields
│   │       ├── collections/outbox.ts   # hidden collection, admin off
│   │       ├── hooks/write-outbox.ts   # afterChange: payload.create({ collection: 'outbox', data, req })
│   │       ├── schemas.ts              # Zod schema of the REST product, stated once
│   │       ├── published-language.ts   # ProductSaved.v1 schema
│   │       └── payload-types.ts        # generated
│   ├── systems/
│   │   ├── shop/
│   │   │   ├── glossary.md
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts
│   │   │   │   ├── sku.ts
│   │   │   │   ├── tax-class.ts
│   │   │   │   ├── address.ts          # GermanDeliveryAddress schema
│   │   │   │   ├── cart.ts
│   │   │   │   ├── catalog-product.ts  # replica shape, forSale specification
│   │   │   │   ├── stock.ts            # Stock aggregate, available(), reserve(), applyReport()
│   │   │   │   ├── order.ts            # Order aggregate, transitions
│   │   │   │   ├── placement.ts        # decidePlacement(): price check, stock check, payment method
│   │   │   │   ├── payment-methods.ts  # invoice not offered in dunning; stale replica accepted
│   │   │   │   ├── deadlines.ts        # CARD_PAYMENT_WINDOW = 30 min, BOOKING_OVERDUE_AFTER = 4 h
│   │   │   │   ├── shipment-report.ts  # dropped lines, refund amount, nothing shipped
│   │   │   │   ├── late-payment.ts     # paid after cancellation -> refund in full
│   │   │   │   ├── debtor-status.ts    # replica, keeps highest version
│   │   │   │   └── mail-repeats.ts     # duplicate order mail accepted
│   │   │   ├── services/
│   │   │   │   ├── ports/driving/{carts,checkout,storefront,order-progress,stock-reports,catalog-replica,debtor-replica,shop-mails,shop-ops}.ts
│   │   │   │   ├── ports/driven/{orders,carts,stock,catalog-products,debtor-statuses,handled-messages,sent-mails,transaction,clock,ids,fulfilment-requests,payment-requests,shop-events,shop-schedule,card-payments,catalog-source,customer-mailer}.ts
│   │   │   │   ├── place-order.ts      # createCheckout(deps): Checkout
│   │   │   │   ├── carts.ts
│   │   │   │   ├── storefront.ts
│   │   │   │   ├── order-progress.ts
│   │   │   │   ├── stock-reports.ts
│   │   │   │   ├── catalog-replica.ts
│   │   │   │   ├── debtor-replica.ts
│   │   │   │   ├── shop-mails.ts
│   │   │   │   └── shop-ops.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/postgres/{tables,transaction,orders,carts,stock,catalog-products,debtor-statuses,handled-messages,sent-mails,outbox,outbox-reader}.ts
│   │   │   │   ├── driven/memory/{transaction,orders,carts,stock,catalog-products,debtor-statuses,handled-messages,sent-mails,outbox,card-payments,catalog-source,customer-mailer,clock,ids}.ts
│   │   │   │   ├── driven/payment/card-payments.ts
│   │   │   │   ├── driven/payload/catalog-source.ts
│   │   │   │   ├── driven/postmark/customer-mailer.ts
│   │   │   │   ├── driven/system/{clock,ids}.ts
│   │   │   │   ├── driving/courier.ts
│   │   │   │   ├── driving/http/{checkout-route,cart-routes}.ts
│   │   │   │   ├── driving/payload/availability-field.ts
│   │   │   │   ├── driving/ui/{ProductList,ProductPage,CartView,CheckoutForm,OrderSection,DelayedOrders}.tsx
│   │   │   │   └── driving/handlers/{card-payment-succeeded,payment-deadline,booking-overdue,shipment-booked,shipment-refused,shipment-reported,stock-level-reported,product-saved,article-listed,debtor-status-changed,order-mail}.ts
│   │   │   ├── offer/
│   │   │   │   ├── index.ts            # re-exports published-language only
│   │   │   │   ├── published-language/order-shipped.v1.ts
│   │   │   │   ├── published-language/private.ts   # private message schemas (not re-exported by index.ts)
│   │   │   │   └── builders.ts         # buildShopForWeb, buildShopForWorker (importable from src/processes only)
│   │   │   └── migrations/0001_init.sql ...
│   │   ├── payment/
│   │   │   ├── glossary.md
│   │   │   ├── domain/{ids,card-payment,card-refund,refund-policy,dispute,mail-repeats}.ts
│   │   │   ├── services/ports/driving/{card-payments-service,stripe-events,refund-requests,payment-mails,payment-ops}.ts
│   │   │   ├── services/ports/driven/{card-payments,card-refunds,handled-messages,sent-mails,transaction,clock,ids,payment-events,payment-schedule,card-gateway,customer-mailer}.ts
│   │   │   ├── services/{card-payments-service,stripe-events,refund-requests,payment-mails,payment-ops}.ts
│   │   │   ├── adapters/driven/{postgres,memory,stripe,postmark,system}/...
│   │   │   ├── adapters/driving/{courier.ts,stripe/hook.ts,handlers/*.ts,ui/PaymentSection.tsx}
│   │   │   ├── offer/index.ts
│   │   │   ├── offer/published-language/{card-payments-service.v1,refund-card-payment.v1,cancel-card-payment.v1,card-payment-succeeded.v1,card-refund-succeeded.v1,card-refund-refused.v1,charge-disputed.v1,dispute-lost.v1,errors}.ts
│   │   │   ├── offer/driving-ports.ts  # CardPaymentsService type
│   │   │   ├── offer/fakes/card-payments-service.ts
│   │   │   ├── offer/builders.ts
│   │   │   └── migrations/...
│   │   ├── fulfillment/
│   │   │   ├── glossary.md
│   │   │   ├── domain/{ids,article,shipment,sku-stock,ship-address}.ts
│   │   │   ├── services/ports/driving/{shipments,stock-levels,articles,fulfillment-ops}.ts
│   │   │   ├── services/ports/driven/{shipments,articles,sku-stock,handled-messages,transaction,clock,ids,fulfillment-events,fulfillment-schedule,warehouse,catalog-source}.ts
│   │   │   ├── services/{shipments,stock-levels,articles,fulfillment-ops}.ts
│   │   │   ├── adapters/driven/{postgres,memory,threepl,payload,system}/...
│   │   │   ├── adapters/driving/{courier.ts,threepl/hook.ts,handlers/*.ts,schedules/nightly-stock.ts,ui/ShipmentSection.tsx}
│   │   │   ├── offer/published-language/{book-shipment.v1,article-listed.v1,shipment-booked.v1,shipment-refused.v1,shipment-reported.v1,stock-level-reported.v1}.ts
│   │   │   ├── offer/{index,builders}.ts
│   │   │   └── migrations/...
│   │   └── billing/
│   │       ├── glossary.md
│   │       ├── domain/{ids,tax-rates,invoice,credit-note,number-series,transfer,auto-match,refund,dunning,debtor,dispute-loss,calendar,mail-repeats}.ts
│   │       ├── services/ports/driving/{invoicing,refunds,bank-transfers,dunning,billing-ops}.ts
│   │       ├── services/ports/driven/{invoices,credit-notes,number-series,transfers,refunds,debtors,dispute-losses,bank-import-cursors,handled-messages,sent-mails,transaction,clock,ids,billing-events,payment-requests,billing-schedule,document-renderer,customer-mailer,bank-statements}.ts
│   │       ├── services/{invoicing,refunds,bank-transfers,dunning,billing-ops}.ts
│   │       ├── adapters/driven/{postgres,memory,bank,pdf,postmark,payment,system}/...
│   │       ├── adapters/driving/{courier.ts,handlers/*.ts,schedules/{bank-poll,dunning-sweep}.ts,http/ops-actions.ts,ui/*.tsx}
│   │       ├── offer/published-language/debtor-status-changed.v1.ts
│   │       ├── offer/{index,builders}.ts
│   │       └── migrations/...
│   ├── processes/
│   │   ├── web/{assembly,config}.ts
│   │   ├── web/probes/{health,delivery}.ts
│   │   ├── worker/{assembly,config,main}.ts
│   │   └── shared/payload-outbox-reader.ts
│   └── tooling/
│       ├── migrate.ts
│       ├── schema-compat.ts            # compares PL JSON Schemas with schema-snapshots/
│       └── backfill-catalog-replica.ts
├── schema-snapshots/                   # committed JSON Schema per published and private message type
└── test/
    ├── kernel/money.test.ts
    ├── systems/shop/domain/{placement,stock,order,shipment-report,payment-methods}.test.ts
    ├── systems/shop/services/{place-order,order-progress,stock-reports}.test.ts       # on fakes
    ├── systems/shop/adapters/driven/contracts/{orders,carts,stock,catalog-products,handled-messages,outbox,transaction,card-payments,catalog-source}.contract.ts
    ├── systems/shop/adapters/driven/{orders,carts,stock,...}.test.ts                 # runs the contract on memory, and on postgres when TEST_IMPL=real
    ├── systems/payment/...                                                           # same shape; card-gateway contract real run = Stripe test mode (end-to-end)
    ├── systems/payment/offer/fakes/card-payments-service.test.ts                     # payment's suite on its fake and its service
    ├── systems/fulfillment/...                                                       # warehouse contract real run = 3PL sandbox (end-to-end)
    ├── systems/billing/...
    ├── lib/messaging/{relay,bus}.test.ts
    ├── integration/{place-order-atomic,outbox-with-change,claim-race}.test.ts        # real Postgres via testcontainers, migrations applied
    └── support/{postgres-container,migrate-test-db}.ts
```

## How each property holds

**P1.** Every module in `src/systems/*/domain/` may import only its own domain folder, `@/kernel/*`,
`zod`, `@js-temporal/polyfill`. dependency-cruiser rule `domain-closed-list` (with
`tsPreCompilationDeps: true`, so `import type` counts) refuses anything else, including the system's
own `offer/`, services and adapters; Biome `noRestrictedGlobals` refuses `process`, `Buffer`,
`window`, `document`, `setTimeout`, `Date.now`, `crypto` there; CI bundles each domain with esbuild
`platform: 'neutral'` and fails on any unresolved Node built-in. The domain takes `now` and ids as
arguments. No system conforms to an upstream, so no upstream language is on the list. Payload's
generated types appear only in `adapters/driven/payload/*` and `driving/handlers/product-saved.ts`.

**P2.** Each rule has one function or constant in its system's domain: `CARD_PAYMENT_WINDOW`,
`BOOKING_OVERDUE_AFTER` (shop), `INVOICE_PAYMENT_TERM = 14 days`, the dunning offsets 7/14/14/14
(`billing/domain/dunning.ts`), VAT rates 7% and 19% (`billing/domain/tax-rates.ts`), the auto-match
rule, number-series format. No business number is a configuration value. Driving adapters parse with
the domain's Zod schemas (`GermanDeliveryAddress`, `EmailAddress`) and restate nothing; Drizzle
repository adapters parse rows with the same schemas. No trigger or check constraint in migrations;
only primary keys and unique keys (`orders.cart_id`, `transfers.bank_transfer_id`,
`invoices.number`, `handled_messages.message_id`). Service tests use the real domain, never a double
of it. Payload's own field rules (price above zero, sku unique and immutable) decide Payload's own
records (D2) and are stated once, in `collections/products.ts`; shop reads price as given.
Fulfillment's rules are not computed in shop: `BookShipment` carries lines and address only.

**P3.** Rules sit with the record's owner: order and stock rules in `shop/domain`, refund and
dispute rules in `payment/domain`, invoice, number, dunning and transfer rules in `billing/domain`,
article and shipment rules in `fulfillment/domain`. Shop asks payment for a refund with an amount
shop's rule computed about shop's order (the dropped lines); whether it may be refunded (disputed,
over the charge) is payment's rule. Billing does not check disputes. The kernel holds `Money` and
`EmailAddress` only, no record schema; the envelope in `lib/messaging` holds no system's shape.

**P4.** Services decide from driving-port arguments and driven-port returns only; time comes from
the `Clock` port, ids from `IdGenerator`, `Europe/Berlin` is a domain constant, not `TZ`. Driving
adapters make one acting call each: the checkout route calls `placeOrder` only (the payment start
lives inside the service, after commit); a handler calls one driving port per message; the bank poll
calls `importTransfers` once per batch, which writes one `MatchTransfer` per transfer; the dunning
sweep calls `scheduleDueDunning` once. Ops server actions pass the operator id as an argument, read
by the action from the session. No adapter guards beyond translation; the Stripe hook drops only event
types payment has no `StripeFact` for. Repository adapters filter by nothing ambient.

**P5.** Services import only their own `ports/`, domain and kernel (dependency-cruiser
`service-reach`). Driven adapters import their port, their outside's client type, `lib/*`, and no
other adapter. Clients (pools, Stripe, 3PL and bank HTTP clients, Postmark) are built in
`src/processes/*/assembly.ts` from `config.ts` and handed to system builders as arguments. Nothing
under `src/systems` reads `process.env` (Biome rule). Framework-constructed driving adapters (route
handlers, server components, Payload hooks) read their system's courier per request; only the
system's builder fills it; `get()` throws before `fill`. Logging goes through `lib/observability/log.ts`,
whose transport assembly sets; OTel through the global provider assembly registers. Ports are in each
system's terms (`CardGateway`, `Warehouse`, `BankStatements`, `CatalogSource`, never `Sql`).

**P6.** Every driven port has a fake in `adapters/driven/memory/`; `payment` exports the fake of its
`CardPaymentsService` in its offer and runs its own suite on it and on its service. One contract
suite per port in `test/.../contracts/*.contract.ts`, a function `(make: () => Promise<Impl>) =>
void`; each adapter test file calls it with the memory factory, and with the real factory when
`TEST_IMPL=real` (Postgres via testcontainers with the system's migrations applied; Stripe test mode,
3PL sandbox, bank sandbox, Postmark test server as end-to-end tests). The fake `Orders` and `Stock`
reject a stale-version save like the real ones, and the contract asserts it. Observation is no-op
with no provider: tests run without a collector.

**P7.** Each acting service opens one transaction through its transaction port, passes it to every
writing port as a required first parameter, commits once at the end, rolls back on any throw
(`try { ...; await tx.commit() } catch (e) { await tx.rollback(); throw e }`). Several aggregates are
saved together only where a domain rule ties them, named in the service: order + cart + stock
(placement), invoice + number series (gapless numbering), transfer + invoices (one booking per
transfer), shipment + sku stock (booking moves the stock version). Services never call another
service of their system. Statistics and mails go by message.

**P8.** All outgoing messages are rows in `<schema>.outbox` written with the transaction handle
(`dbOf(tx)`). The relay marks a row only after pg-boss has inserted the job; pg-boss keeps it in
Postgres; a handler resolves only after its use case returned; failed jobs retry with backoff and
then park, never dropped. Calls after commit: shop -> payment `start`, payment -> Stripe `openIntent`,
both made from a committed record and repeated by the browser's retry under the same key. Executors
(`bookShipment`, `executeRefund`, `sendOrderMail`) decide nothing again. Payload's change reaches
systems only through its outbox row written in its own transaction (`req` passed to
`payload.create`), with `createPayloadOutboxReader` from assembly. Hooks answer after commit.

**P9.** Every handled use case claims `messageId` in `handled_messages` inside its transaction
(`INSERT ... ON CONFLICT DO NOTHING RETURNING`; no row -> `seen` -> commit nothing, answer from
committed records). Hook events use the vendor id (`stripe:<id>`, `3pl:<id>`); polled transfers use
the bank id as unique key. Keys to outside: Stripe intent `payment:<paymentId>`, Stripe refund
`refund:<refundId>` plus `findRefund` by metadata before creating (Stripe keeps keys 24 h; parked
messages may wait longer); 3PL order reference `ship:<orderId>` unique at the 3PL plus
`orderByReference`; 3PL article upsert by sku. Refund ids are derived (`<orderId>:dropped`,
`<orderId>:late`, billing's refund uuid generated in the operator's request with `requestKey`
unique). Mails take no key: each system's `mail-repeats.ts` states that a duplicate mail is accepted.
Checkout's key is `cartId`; ops actions carry `requestKey`.

**P10.** Repositories save with `UPDATE ... WHERE id = $1 AND version = $2`; zero rows -> throw
`StaleWrite`, the use case fails, the caller or the bus repeats from the read. Stock decisions read
`Stock` inside the placement transaction and save it, so two checkouts for the last unit fail each
other, and checkouts of different skus do not. Stale data accepted by rule: shop's `DebtorStatus`
replica for invoice offering (`payment-methods.ts`), shop's `CatalogProduct` price (the customer
confirms what was shown), billing's `Debtor` recompute reading invoices it does not save (followed
by another `RecomputeDebtor` from every change that alters past-due state). `refreshStockLevel`
re-reads `SkuStock` in its transaction and fails if the version moved since its pre-call read.
Aggregates hold others by id or snapshot (order lines snapshot price, sku, tax class).

**P11.** Each system's pool connects with its own Postgres role granted only its schema; Payload's
role only `payload`; the relay reaches outboxes only through readers each system (or assembly, for
Payload) builds with that system's pool. Other systems' records are read only through published
events (replicas) or open host services (`CardPaymentsService`, Payload REST). Payload keeps no record
of ours: availability and for-sale are virtual fields computed by shop's hook at read.

**P12.** No system conforms; each translates in its adapters (D30). dependency-cruiser
`upstream-language-only-in-adapters`: imports of another system's `offer/published-language/*` and
of `@/external/payload/*`, `stripe` are allowed only from `adapters/driven/<upstream>/`,
`adapters/driving/handlers/`, `adapters/driving/stripe/`, `adapters/driving/threepl/`. Published
language folders may import only `zod` (rule `pl-closed`), so no published language reaches another.

**P13.** Cross-system imports may target only `offer/index.ts`, `offer/driving-ports.ts`,
`offer/fakes/*`, `offer/published-language/*` (not `private.ts`); `offer/builders.ts` only from
`src/processes/**`. Published-language modules import nothing of their system and are hand-written:
services translate domain to published language in the outbox adapters, so a model change fails to
compile at that translation. Published constraints (`quantity` int > 0, `taxClass` enum) are the
contract's own.

**P14.** One Zod schema per message type and version, used by the outbox adapter before insert and
by every handler. `tooling/schema-compat.ts` in CI converts every schema to JSON Schema and compares
with `schema-snapshots/`: anything but an optional field added fails unless it is a new `.v2` file;
the writer then writes both versions until the old one's queues and outboxes are empty and no
subscriber remains. Migrations expand then contract across two deploys; repository adapters update
named columns only, so an old process leaves new columns untouched; no jsonb record column is
rewritten whole. The open host service called in-process is outside the scope.

**P15.** Only two use cases wait on another system: `placeOrder` (card, the browser needs the secret
now, checkout's rule) and `payment.start` (answers to checkout's rule). Everything else other systems
must do goes by command or event. Checkout reads stock, prices, for-sale and dunning from shop's own
records and replicas, so it works while billing, fulfillment, Payload and the 3PL are down; invoice
checkout works while Stripe is down. Handlers that call outside (3PL, Stripe, Postmark, Payload REST)
fail and are redelivered.

**P16.** Transactions open per system pool and touch only the system's schema (enforced by roles).
Driving ports take plain published-language or domain values, never a transaction, pool or Drizzle
handle (dependency-cruiser forbids `drizzle-orm`, `pg` imports under `services/ports/driving` and
`offer/`). No `AsyncLocalStorage` for transactions. The Payload hook passes nothing of `req` into
shop; shop never calls Payload's Local API.

**P17.** Every wait holds its end in an aggregate: card payment (`Order.paymentDeadline`, 30 min,
message held back to it; ends cancelled), booking (`Order.bookingOverdueAt`, 4 h; ends by flagging
the order to operators, the business accepting the wait from then on, D22), billing's card refund
(`Refund.overdueAt`, 1 day; flagged to operators), dunning (`Invoice.nextDunningAt`; ends in
handed-over). Late answers meet the aggregate: payment after cancellation -> refund in full; refusals
are committed as outcomes (`ShipmentRefused`, `CardRefundRefused`) and published; lost races and
outages throw and park.

**P18.** Overriding messages carry a per-thing version: `StockLevelReported.version` (from
`SkuStock`), `DebtorStatusChanged.version` (from `Debtor`); receivers keep the higher and drop lower
or equal. Payload's `ProductSaved` is a notice; receivers ask Payload REST for the product now. Shop's
handlers for messages about orders tolerate any order: `ShipmentBooked` before `CardPaymentSucceeded`
cannot happen (commanded only after paid); `CardPaymentSucceeded` after cancellation is ruled by
`late-payment.ts`; `ShipmentReported` for an order whose booking record is not yet applied fails and
is redelivered. Billing's refund outcome for an unknown refund id of its own fails and is redelivered;
one not its own (shop's) is ignored by id prefix.

**P19.** Each system has `glossary.md`; terms differ by system on purpose: shop `Order`, billing
`Invoice` with `orderId` reference and `ShippedOrderFacts`, payment `CardPayment`, fulfillment
`Shipment`. Upstream names are named apart in adapters (`StripePaymentIntent`, `PayloadProduct`,
`ThreePlOrder`, `ShopOrderShippedV1`). Shop's replica is `CatalogProduct`, not `Product`.

## Decisions the document left to me

**D1. System cut.** Chose four systems (`shop` with cart, checkout, orders and stock; `payment`;
`fulfillment`; `billing`) plus Payload as external system; no mail, customer or ops system. Also held
every property: a separate `inventory` system with stock reserved as a tentative operation by command;
a `catalog` system of our own.

**D2. Owner of product records.** Chose Payload: its configuration's rules (price above zero, sku
unique and fixed) are its own. Also held: a `catalog` system owning the rules, Payload as external
keeper, editor saves vetoed by a `beforeChange` hook calling catalog's specification.

**D3. Where stock lives.** Chose `shop`, with `Stock` saved in the placement transaction. Also held:
`fulfillment` owning stock and checkout waiting on a synchronous reservation call (P15 exception).

**D4. When a reservation stops counting.** Chose per-sku version from `fulfillment`: counted until a
stock report with a version above the booking's. Also held: counted until the 3PL's next stock
webhook after `ShipmentBooked`, if the 3PL's webhook guaranteed post-booking figures.

**D5. Transaction port shape.** Chose `open(): Promise<XTransaction>` with `commit`/`rollback`, handle
looked up in a `WeakMap` by the adapter. Also held: `run(work: (tx) => Promise<T>)`.

**D6. Store layout.** Chose one Postgres, one schema and one role per system, Payload and bus.
Also held: one role with dependency rules only (P11 by code review and lint).

**D7. Libraries.** Chose Drizzle + `pg`, Zod 4, Temporal polyfill, pino, OTel, Vitest, Biome,
dependency-cruiser. Also held: Kysely, Valibot, date-fns.

**D8. Bus.** Chose pg-boss in the same Postgres, pub/sub per message type, queue per handler, 25
retries with backoff, park queue kept 10 years. Also held: RabbitMQ with quorum queues, SQS + DLQ.

**D9. Outbox.** Chose a table per system and per Payload, relay polling every 500 ms with `SKIP
LOCKED`. Also held: outbox field on the aggregate row; LISTEN/NOTIFY wake-up.

**D10. Clock mechanism.** Chose held-back messages for the payment deadline, booking overdue and
refund overdue; sweeps for dunning, bank poll, nightly stock. Also held: sweeps for all.

**D11. Telling repeats.** Chose a `handled_messages` table per system plus unique business keys.
Also held: status-only idempotency where all writes are set-not-toggle.

**D12. Refusal vs failure.** Chose returned discriminated unions for refusals, throws for failures.
Also held: `Result` type library.

**D13. Card payment start.** Chose in-process call to `payment` after shop's commit, payment
committing `CardPayment` then calling Stripe with a key from its id, secret not stored. Also held:
storing the secret in `CardPayment` from a later `payment_intent.created` event.

**D14. Refund ownership.** Chose `payment` deciding every card refund; `shop` asking for pre-invoice
refunds; `billing` asking for operator refunds and issuing the credit note on success. Also held:
billing issuing the credit note first and a reversing one on refusal (rejected since invoices and
credit notes are never changed, a second note is a correction too).

**D15. Mails.** Chose each system mails its own (private message, handler, Postmark), duplicates
accepted by a domain rule. Also held: a `mailing` system taking `SendMail` commands.

**D16. Invoice date and number.** Chose assigned at invoice creation by `billing` from the clock,
saved with `NumberSeries`. Also held: invoice date = shipment report date (with series ordering
risk handled by the same aggregate).

**D17. Dunning status of a customer.** Chose `Debtor` aggregate per email in `billing`, recomputed by
private message, published with a version, replica in `shop`. Also held: shop asking billing on the
open call (dunning becoming a P15 dependency, rejected by me for availability).

**D18. Product replica freshness and order.** Chose notice-then-ask (Payload REST). Also held: a
revision field raised in Payload's transaction carried on the message.

**D19. 3PL double booking.** Chose a 3PL contract requirement: unique order reference with 409 on
duplicate, plus lookup. Also held: 3PL idempotency-key header, if offered.

**D20. Stripe refund repeats beyond 24 h.** Chose `findRefund` by metadata `refundId` before
`refund`, plus `Idempotency-Key`. Also held: a reconciliation that finds a second Stripe refund for
one `refundId` and hands it to operators (a business rule accepting correction afterwards).

**D21. Bank intake.** Chose a 5-minute poll, one import use case per batch inserting transfers by
bank id and writing one `MatchTransfer` each. Also held: one acting call per polled item.

**D22. How waits end.** Chose: payment 30 min -> cancel; booking 4 h -> operator flag (accepted wait);
card refund 1 day -> operator flag. Also held: booking cancelled after N days with refund.

**D23. Processes.** Chose `web` (Next.js + Payload), `worker`, `migrate` as tooling. Also held:
separate handler workers per system.

**D24. Courier placement.** Chose one courier per system in `adapters/driving/courier.ts`, filled by
its builder; web assembly run from `instrumentation.ts`. Also held: one process-wide courier in
`src/processes/web`.

**D25. Reach enforcement.** Chose dependency-cruiser rules, Biome restricted globals, esbuild
neutral bundle of each domain. Also held: ESLint `import/no-restricted-paths`, a package per layer.

**D26. Schema compatibility.** Chose JSON Schema snapshots and a CI diff; expand-contract migrations;
column-wise updates. Also held: a schema registry with full compatibility.

**D27. Contract suites.** Chose memory by default, `TEST_IMPL=real` flag; vendor sandboxes as
end-to-end tests run by hand. Also held: nightly CI job for the real run.

**D28. Operator views.** Chose per-system UI sections composed on one Next.js page by `orderId`;
delivery console as probe. Also held: a backoffice system with replicas of all.

**D29. Shared kernel.** Chose `Money`, `EmailAddress`. Also held: no kernel, each system its own
`Money`.

**D30. Conform or translate.** Chose anti-corruption layer everywhere (Stripe, 3PL, bank, Payload,
between own systems). Also held: `billing` conforming to `shop`'s `OrderShipped.v1`.

**D31. Process style.** Chose orchestration by `shop` for the order, choreography for billing.
Also held: full choreography (`fulfillment` booking on `OrderPaid`/`OrderPlaced` events).

**D32. Calendar.** Chose `Europe/Berlin` as a domain constant in `billing/domain/calendar.ts` and
`shop/domain/deadlines.ts`. Also held: dates passed as arguments by the Clock port in Berlin date.

**D33. Dispute lost before invoice.** Chose `DisputeLoss` record applied as credit note when the
invoice is created. Also held: invoice created net of the loss (rejected: invoice over shipped
quantities is the brief's).

**D34. 3PL refuses a booking.** Chose `ShipmentRefused` -> order flagged to operators, stock kept
reserved. Also held: auto-cancel with refund.

## Sentences I had to pick a reading for

**S1.** "Anything outside a system MUST reach into it only through its offer or by a driving
adapter's way in." (P5) Readings: (a) Payload's configuration, written in this codebase, may import
`shop/adapters/driving/payload/availability-field.ts` because that is the hook the external system
calls; (b) only a file the framework discovers is a way in, so the config must import it through
shop's offer. Took (a). Changed: the hook lives in shop's driving adapters, imported by
`src/external/payload/collections/products.ts`, not exported in the offer.

**S2.** "Business rules its configuration holds are its own, in its terms, even where this codebase
writes them" (glossary: External system) against "A rule about a record this system's business rules
decide, written into the external system's field validation, is this system's rule stated outside its
domain." (P2) Readings: (a) whichever system owns the record decides, ownership is a choice; (b) any
rule the brief states belongs to some system of this codebase. Took (a). Changed: no `catalog`
system; price and sku rules in Payload config (D2).

**S3.** "It returns the transaction, typed in the system's terms." (glossary: Transaction port)
Readings: (a) the port literally returns a transaction object; (b) a callback-scoped transaction
counts as returned. Took (a). Changed: `open()`/`commit()`/`rollback()` and explicit try/rollback in
every service.

**S4.** "that its service commits once after the last write" (P7) with "a call to another system
after the commit" (P8). Readings: (a) after commit the service may still call out, the call is no
write; (b) the use case ends at commit, the call must be another driving adapter's call. Took (a).
Changed: `placeOrder` calls `CardPayments.start` after commit; `payment.start` calls Stripe after its
commit.

**S5.** "A service that calls another service of its system to reuse its writes is the same split"
(P7). Readings: (a) only same-system services are barred; another system's open host service may be
called; (b) any service-to-service call. Took (a). Changed: shop's service calls payment's service
through `CardPayments`.

**S6.** "the store refusing a second claim of it" (P9) with "an insert that does nothing on conflict
is no failed write" (P7). Readings: (a) `ON CONFLICT DO NOTHING` returning no row is the store's
refusal, told by the returned row; (b) the claim must raise a unique violation and roll back. Took
(a). Changed: `HandledMessages.claim` returns `'seen'` and the use case commits nothing and answers;
concurrent overlap waits on the index and then sees the row.

**S7.** "A status that only shows how far another system has got, with nothing of this system's
hanging on it, is no wait." (P17) Readings: (a) shop awaiting booking holds stock, so it is a wait
needing a moment; (b) stock is the 3PL's, nothing of shop hangs. Took (a). Changed:
`Order.bookingOverdueAt`, `BookingOverdue` message, operator flag.

**S8.** "by completing its part, by a business process step that undoes an earlier one … or by
accepting the state as it stands" (P17). Readings: (a) flagging to operators and keeping the wait is
accepting; (b) accepting must be a terminal state with nothing open. Took (a). Changed: booking and
refund overdue end in a flag, not a cancel.

**S9.** "Which one is the architecture's." (Assumptions, clock) Readings: (a) one mechanism for the
whole codebase; (b) chosen per use case. Took (b). Changed: held-back messages for deadlines, sweeps
for dunning and polls.

**S10.** "for an external system's outbox, assembly does" (glossary: Outbox). Readings: (a) the
reader's code lives in assembly; (b) assembly only wires a reader written elsewhere (e.g. common
library). Took (a). Changed: `src/processes/shared/payload-outbox-reader.ts`.

**S11.** "from a courier that only assembly fills" and "a system builder being assembly" (P5).
Readings: (a) a builder filling its own system's courier is assembly filling it; (b) only
`processes/*/assembly.ts` may call `fill`. Took (a). Changed: `buildShopForWeb` fills `shopCourier`;
assembly never touches system internals.

**S12.** "MUST load on every runtime of the language." (P1) Readings: (a) ECMAScript only, no
host globals (Node, browser, edge); (b) Node and browser only. Took (a). Changed: esbuild
`platform: 'neutral'` check, `Date.now` and `crypto` also restricted in domain.

**S13.** "The modules that declare a published language MUST reach nothing of their system outside
it" (P13) with the shared kernel "imported into its domain". Readings: (a) the kernel is the
system's domain, so a published language may not import `Money`; (b) the kernel is shared and may be
used. Took (a). Changed: published languages carry `amountCents: number`; adapters translate.

**S14.** "A shared kernel MUST hold no such rule and no record's schema, only value types and what
computes with them from arguments." (P3) Readings: (a) `EmailAddress` normalization is a value
type's computation; (b) it decides customer identity on records, so a rule. Took (a). Changed:
`EmailAddress` in kernel, used by shop's order and billing's debtor.

**S15.** "A use case MUST decide by data read inside the transaction that commits the decision" (P10)
for a decision whose input comes from a call made before the transaction. Readings: (a) the outside
answer is stale data a rule accepts, the store-held data must be re-read inside; (b) nothing read
before the transaction may feed it. Took (a). Changed: `refreshStockLevel` re-reads `SkuStock` in its
transaction and fails if the version moved; `bookShipment` checks `Shipment` again inside.

**S16.** "on every other implementation against the outside it reaches in the deployed application,
set up as it is there" (P6). Readings: (a) for vendors, their sandbox/test mode is that outside; (b)
only production counts, making vendor contract runs impossible. Took (a). Changed: Stripe test mode,
3PL and bank sandboxes as end-to-end runs behind `TEST_IMPL=real`.

**S17.** "MUST NOT withhold a call the service would accept." (P4) for webhook event types.
Readings: (a) an event type with no driving port is untranslatable and may be dropped by the adapter;
(b) every event must reach a use case. Took (a). Changed: Stripe hook maps five event types to
`StripeFact` and answers 200 to others without a call.

**S18.** "and MUST read it only through that open host service or the owner's published events
delivered to a handler of the reading system." (P11) for Payload's admin showing shop's stock.
Readings: (a) Payload calling shop's hook is shop answering through its own driving adapter, no read
of shop's records by Payload; (b) Payload is reading shop's records and needs an open host service.
Took (a). Changed: virtual fields with an `afterRead` hook, no stock stored in Payload.
