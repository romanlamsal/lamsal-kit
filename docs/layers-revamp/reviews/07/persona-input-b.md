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

