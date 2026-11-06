# Fresh repository draft B, raw set

Brief: online tea shop. Sources read: `glossary.md`, `the-world.md`. Terms are the glossary's;
where a name below is not a glossary term it is a code name (in backticks) or plain description.

## Systems and what each owns

Five systems this codebase writes, five external systems, and code that is no system.

| System | Kind | Owns (records its business rules decide) | Keeps, owned by another |
|---|---|---|---|
| `catalog` | ours | Product aggregate: productId, revision, sku, slug, gross price, tax class, title, description, image references as published to the shop; publication refusals | none |
| `ordering` | ours | Cart aggregate; Order aggregate (the process manager of checkout, payment, shipping, refund, cancellation); order lines with snapshots of price, sku, tax class, title | Offer replica of `catalog` (productId, revision, sku, slug, title, gross price, tax class, withdrawn) |
| `fulfillment` | ours | Reservation aggregate (tentative and confirmed holds per order); Shipment aggregate; SkuRegistration aggregate | StockItem on-hand counts: replica of the warehouse's inventory, under sku |
| `payments` | ours | CardPayment aggregate; ExpectedTransfer aggregate; BankTransaction aggregate (imported, matched or unmatched); Refund aggregate (card refund or bank payout) | bank import cursor is its own record |
| `billing` | ours | Invoice aggregate; CreditNote aggregate; NumberSeries aggregate (one per document kind and year); reminder state on Invoice; VAT rates by tax class and date (domain code, not records) | none |
| Payload CMS | external system, run by us in our processes | product documents and their versions (the editors' working copies), media, admin users; owned by Payload because no business rule of ours decides what a draft holds | none |
| Stripe | external system, run by its vendor | PaymentIntents, refunds | none |
| warehouse partner | external system, run by its vendor | registered SKUs, physical inventory, outbound orders, shipping events | none |
| bank | external system, run by its vendor | account transactions, outgoing transfers | none |
| mail provider | external system, run by its vendor | sent mails | none |

Not systems:

- **Shared kernel** `shared-kernel`: `Money` (EUR, integer cents), `Sku`, `TaxClass` (identity only:
  `standard`, `reduced`; rates are `billing`'s). Imported into the domain of `catalog`, `ordering`,
  `fulfillment`, `payments`, `billing`.
- **Common library** `lib/*`: store clients (one pg pool and Drizzle client per system role), logger
  (pino), tracer (OpenTelemetry), the relay, the bus, the courier, the scheduler for scheduled
  tasks, the outbox table definition and generic outbox reader, a transport-only mail client and
  HTTP client.
- **Probes**: `/health/live`, `/health/ready`, `/metrics` in every process.
- **Assembly** per process, calling each system's system builder.
- **Tooling**: architecture test over the source tree, seed script, developer CLI.

Upstream/downstream map (arrow points from upstream to downstream):

- Payload CMS -> `catalog` (anti-corruption layer: Payload hooks and Payload version messages are
  translated in `catalog`'s driving adapters).
- `catalog` -> `ordering` (events, anti-corruption layer into the Offer replica).
- `catalog` -> `fulfillment` (events, anti-corruption layer into SkuRegistration).
- `fulfillment` -> `ordering`; `payments` -> `ordering`; `billing` -> `ordering`: `ordering` sends
  their commands and handles their events, translating in its adapters (anti-corruption layer).
- warehouse partner -> `fulfillment`; Stripe -> `payments`; bank -> `payments`; mail provider ->
  `ordering`, `billing` (all anti-corruption layer).
- `payments` and `billing` do not talk to each other; `ordering` carries what each needs. No cycle.

## Ports and adapters

Common to every system of ours (named once, present in each):

- Driven ports: `Transactions` (runs one use case's writes in one transaction of the system's
  store and hands the use case the repositories and the outbox port bound to it); the outbox port
  `Outbox` (typed in the system's own terms: a union of what the system has to say); `Clock`;
  `Ids` (UUIDv7).
- Driven adapters: Drizzle implementations over the system's own Postgres schema and role; fakes
  (in-memory maps with version checks and rollback on throw) for every repository, `Transactions`,
  `Outbox`, `Clock`, `Ids`; `SystemClock` from the common library.
- Outbox reader: provided by the system (`outbox-reader.ts`), reads the system's `outbox` table,
  marks delivered rows.
- System builders: `build<System>(config, clients)` returning `{ ports, handlers, scheduledTasks,
  outboxReader }`; a second builder `build<System>Fakes()` returns the same over fakes.

### `catalog`

- Driving ports (each acts or answers):
  - `checkProductDraft(draft)` answers: violations of catalog's specifications (sku format, slug
    format, price above zero, tax class known, sku unchanged once published, slug and sku unique
    among other products).
  - `checkDraftDeletion(productId)` answers: refused once the product was ever published.
  - `publishRevision(editorialVersion)` acts: accept or refuse a Payload version into the Product
    aggregate; writes `ProductPublished` or `ProductWithdrawn`, or a publication refusal.
  - `getPublicationStatus(productId)` answers.
  - `listPublishedProducts()`, `getPublishedProduct(slug)` answer.
- Driven ports: `ProductRepository` (repository over Product), `Transactions`, `Outbox`, `Clock`.
- Driving adapters:
  - hooks Payload calls: field `validate` and `beforeChange` on the `products` collection ->
    `checkProductDraft`; `beforeDelete` -> `checkDraftDeletion`; a UI field component ->
    `getPublicationStatus`. Each translates Payload's document into catalog's terms and catalog's
    violations into Payload `ValidationError`s.
  - handler `onPayloadProductVersion` -> `publishRevision` (translates the Payload version
    document).
  - shop pages in `apps/web` -> `listPublishedProducts`, `getPublishedProduct` via the courier.
- Driven adapters: Drizzle (`catalog` schema), fakes.
- Published language: events `catalog.ProductPublished@1`, `catalog.ProductWithdrawn@1`
  (productId, revision, sku, slug, title, gross price, tax class, image URLs); open host service
  schemas and errors for the answering ports Payload hooks and pages call.

### `ordering`

- Driving ports:
  - acts: `addToCart`, `changeCartLine`, `placeOrder(orderId, cartId, customer, address,
    paymentMethod, seenOfferRevisions)`, `refundOrder(orderId, lines, reason)`.
  - acts, from messages: `refreshOffer`, `recordStockReserved`, `recordStockRefused`,
    `recordReservationExpired`, `recordCardPaymentOpened`, `recordPaymentReceived`,
    `recordInvoiceIssued`, `recordInvoiceLapsed`, `recordShipmentShipped`,
    `recordShipmentRefused`, `recordCreditNoteIssued`, `recordRefundPaid`, `recordRefundFailed`,
    `sendOrderConfirmation` (private).
  - acts, from the clock: `advanceOverdueOrders` (deadlines of the process manager).
  - answers: `getCart`, `getCheckoutStatus(orderId)`, `getOrder`, `listOrders`.
- Driven ports: `CartRepository`, `OrderRepository`, `OfferRepository` (the replica, repository
  over Offer), `Transactions`, `Outbox` (its union holds ordering-terms requests: request stock,
  release stock, request shipment, request card payment, cancel card payment, expect transfer,
  request invoice, settle invoice, cancel invoice, request credit note, request refund, confirm
  order by mail), `CustomerMail` (`sendOrderConfirmation(order)`), `Clock`, `Ids`.
- Driving adapters: server actions and pages in `apps/web` (cart, checkout, order status page) via
  the courier; Payload admin views (hooks: Payload calls them) for the dashboard's order list and
  the refund action; handlers per subscribed message (each translates the upstream's published
  language into ordering's input: anti-corruption layer); scheduled task `advanceOverdueOrders`.
- Driven adapters: Drizzle (`ordering` schema); the Drizzle outbox adapter serializes each
  ordering-terms request into the receiving system's published command (`fulfillment.ReserveStock@1`
  etc.): this is where upstream terms start; mail provider adapter for `CustomerMail`; fakes.
- Published language: open host service schemas for `getOrder`, `listOrders`, `refundOrder`
  (dashboard). Publishes no events: nobody downstream.

### `fulfillment`

- Driving ports:
  - acts, from commands: `reserveStock(reservationId, lines, holdUntil)`, `releaseStock`,
    `shipOrder(reservationId, address)`.
  - acts, from events: `registerSku` (from `catalog.ProductPublished`).
  - acts, private: `submitShipment(shipmentId)`, `submitSkuRegistration(sku)`.
  - acts, from hooks: `recordShipmentShipped`, `recordShipmentFailed`, `recordStockLevel`.
  - acts, from the clock: `expireReservations`, `reconcileWithWarehouse` (reconciliation of
    shipments, on-hand counts, registered SKUs).
  - answers: `getAvailability(skus)`, `listShipments`.
- Driven ports: `StockItemRepository`, `ReservationRepository`, `ShipmentRepository`,
  `SkuRegistrationRepository`, `Transactions`, `Outbox`, `Warehouse` (in fulfillment's terms:
  `register(skuRegistration)`, `submit(shipment)`, `findShipment(shipmentId)`,
  `countOnHand(skus)`), `Clock`, `Ids`.
- Driving adapters: handlers; hook for the warehouse webhook (route in `apps/web`, verifies
  signature, translates, calls the use case, answers 2xx only after commit); scheduled tasks; page
  and dashboard adapters calling the answering ports.
- Driven adapters: Drizzle (`fulfillment` schema); warehouse API adapter (anti-corruption layer:
  external reference = shipmentId, look up before create); fakes, including a fake warehouse that
  repeats and reorders its webhook calls on demand.
- Published language: commands it takes `fulfillment.ReserveStock@1`,
  `fulfillment.ReleaseStock@1`, `fulfillment.ShipOrder@1`; events `StockReserved@1`,
  `StockReservationRefused@1`, `StockReservationExpired@1`, `ShipmentShipped@1`,
  `ShipmentRefused@1`; open host service schemas for `getAvailability`, `listShipments`.

### `payments`

- Driving ports:
  - acts, from commands: `openCardPayment(paymentId, orderId, amount)`, `cancelCardPayment`,
    `expectTransfer(orderId, reference, amount)`, `refundPayment(refundId, orderId, amount)`.
  - acts, from hooks: `recordCardEvent` (Stripe webhook).
  - acts, from the clock: `importBankTransactions` (reconciliation with the bank),
    `reconcileCardPayments` (reconciliation with Stripe), `reconcileRefunds`.
  - answers: `getCardPaymentSession(orderId)` (client secret for the pay page),
    `listUnmatchedTransfers` (dashboard).
- Driven ports: `CardPaymentRepository`, `ExpectedTransferRepository`,
  `BankTransactionRepository`, `RefundRepository`, `Transactions`, `Outbox`, `CardGateway`
  (`open(payment)`, `cancel`, `refund`, `find`), `BankAccount` (`transactionsSince(cursor)`,
  `payOut(refund)`), `Clock`, `Ids`.
- Driving adapters: handlers; hook for the Stripe webhook (route in `apps/web`, signature check,
  event id as message id); scheduled tasks; pay page adapter.
- Driven adapters: Drizzle (`payments` schema); Stripe adapter (idempotency key = paymentId or
  refundId; Stripe's terms stop here); bank API adapter; fakes, including a fake gateway that can
  say yes and fail afterwards.
- Published language: commands it takes `payments.OpenCardPayment@1`, `CancelCardPayment@1`,
  `ExpectTransfer@1`, `RefundPayment@1`; events `CardPaymentOpened@1`, `CardPaymentCancelled@1`,
  `PaymentReceived@1`, `RefundPaid@1`, `RefundFailed@1`.

### `billing`

- Driving ports:
  - acts, from commands: `issueInvoice(orderId, customer, lines, settledBy | dueInDays)`,
    `settleInvoice`, `cancelInvoice`, `issueCreditNote(refundId, invoiceId, lines)`.
  - acts, private: `sendInvoiceDocument`, `sendReminder`.
  - acts, from the clock: `remindOverdueInvoices`.
  - answers: `listInvoices`, `getInvoiceDocument`.
- Driven ports: `InvoiceRepository`, `CreditNoteRepository`, `NumberSeriesRepository`,
  `Transactions`, `Outbox`, `BillingMail` (`sendInvoice`, `sendReminder`, `sendCreditNote`),
  `DocumentRenderer` (invoice and credit note as PDF), `Clock`, `Ids`.
- Driving adapters: handlers; scheduled task; dashboard views; invoice download route.
- Driven adapters: Drizzle (`billing` schema); mail provider adapter; PDF renderer adapter; fakes.
- Published language: commands it takes `billing.IssueInvoice@1`, `SettleInvoice@1`,
  `CancelInvoice@1`, `IssueCreditNote@1`; events `InvoiceIssued@1`, `InvoiceLapsed@1`,
  `InvoiceCancelled@1`, `CreditNoteIssued@1`.

### Payload CMS (external system)

- Driven through its API: the Local API (`getPayload(config)`), used by assembly's outbox reader
  over product versions.
- Driving through its hooks: collection `validate`/`beforeChange`/`beforeDelete` hooks, UI field
  components and admin custom views, all of them driving adapters of `catalog`, `ordering`,
  `fulfillment`, `payments`, `billing`.
- Its configuration (`payload.config.ts`, collections) is written by us; it holds field shapes and
  access, and no business rule: every rule it applies is a call to a `catalog` driving port.
- Its outbox: the `products` versions Payload commits; the outbox reader over it is provided by
  assembly (`apps/worker/src/payload-outbox-reader.ts`), with its read marks kept by the relay in
  the `relay` schema.

## Calls and messages

Synchronous calls (in-process, caller's driving adapter or driven adapter -> port):

| Caller | Called | Port | Kind |
|---|---|---|---|
| Payload `products` hooks | `catalog` | `checkProductDraft`, `checkDraftDeletion`, `getPublicationStatus` | answers |
| shop pages (`apps/web`) | `catalog` | `listPublishedProducts`, `getPublishedProduct` | answers |
| shop pages | `fulfillment` | `getAvailability` | answers |
| cart, checkout server actions | `ordering` | `addToCart`, `changeCartLine`, `placeOrder` | acts |
| order status page | `ordering` | `getCheckoutStatus` | answers |
| pay page | `payments` | `getCardPaymentSession` | answers |
| Stripe webhook hook | `payments` | `recordCardEvent` | acts |
| warehouse webhook hook | `fulfillment` | `recordShipmentShipped`, `recordShipmentFailed`, `recordStockLevel` | acts |
| Payload admin views (dashboard) | `ordering`, `billing`, `fulfillment`, `payments` | `listOrders`, `getOrder`, `refundOrder`, `listInvoices`, `getInvoiceDocument`, `listShipments`, `listUnmatchedTransfers` | answers; `refundOrder` acts |
| `payments` `CardGateway` adapter | Stripe | API | driven |
| `payments` `BankAccount` adapter | bank | API | driven |
| `fulfillment` `Warehouse` adapter | warehouse partner | API | driven |
| `ordering`, `billing` mail adapters | mail provider | API | driven |

No system calls another system of ours synchronously. Every exchange between our systems is a
message.

Messages (all go outbox -> relay -> bus -> handler; id = UUIDv7 written with the message, or the
external id for Payload versions):

| Written by | Message | Kind | Handled by | Use case |
|---|---|---|---|---|
| Payload (versions) | `payload.ProductVersion` | event, published (external) | `catalog` | `publishRevision` |
| `catalog` | `ProductPublished`, `ProductWithdrawn` | event, published | `ordering`; `fulfillment` (`ProductPublished` only) | `refreshOffer`; `registerSku` |
| `ordering` | `fulfillment.ReserveStock` | command, published | `fulfillment` | `reserveStock` |
| `fulfillment` | `StockReserved` / `StockReservationRefused` | event, published | `ordering` | `recordStockReserved` / `recordStockRefused` |
| `ordering` (card) | `payments.OpenCardPayment` | command | `payments` | `openCardPayment` |
| `payments` | `CardPaymentOpened` | event | `ordering` | `recordCardPaymentOpened` |
| `payments` (from Stripe hook) | `PaymentReceived` | event | `ordering` | `recordPaymentReceived` |
| `ordering` (card, on paid) | `billing.IssueInvoice` (settledBy card payment), `fulfillment.ShipOrder`, private `ConfirmOrderByMail` | commands, private message | `billing`, `fulfillment`, `ordering` | `issueInvoice`, `shipOrder`, `sendOrderConfirmation` |
| `ordering` (invoice, on reserved) | `billing.IssueInvoice` (due in 14 days), private `ConfirmOrderByMail` | command, private | `billing`, `ordering` | |
| `billing` | `InvoiceIssued` | event | `ordering` | `recordInvoiceIssued` -> for invoice orders writes `payments.ExpectTransfer` |
| `billing` | private `SendInvoiceDocument`, `SendReminder` | private | `billing` | `sendInvoiceDocument`, `sendReminder` |
| `payments` (bank import) | `PaymentReceived` | event | `ordering` | -> `billing.SettleInvoice`, `fulfillment.ShipOrder` |
| `fulfillment` | private `SubmitShipment`, `SubmitSkuRegistration` | private | `fulfillment` | warehouse calls |
| `fulfillment` (from warehouse hook) | `ShipmentShipped` / `ShipmentRefused` | event | `ordering` | `recordShipmentShipped` / `recordShipmentRefused` |
| `fulfillment` (clock) | `StockReservationExpired` | event | `ordering` | `recordReservationExpired` |
| `billing` (clock) | `InvoiceLapsed` | event | `ordering` | -> cancel order: `fulfillment.ReleaseStock`, `billing.CancelInvoice` |
| `ordering` (clock, card unpaid after 30 min) | `fulfillment.ReleaseStock`, `payments.CancelCardPayment` | commands | `fulfillment`, `payments` | |
| `ordering` (`refundOrder`, or payment for a cancelled order, or shipment refused after payment) | `billing.IssueCreditNote`, `payments.RefundPayment` | commands | `billing`, `payments` | |
| `billing` | `CreditNoteIssued`, `InvoiceCancelled` | event | `ordering` | record on Order |
| `payments` | `RefundPaid` / `RefundFailed` | event | `ordering` | record on Order; failed shows on dashboard |

A refused command is answered by an event of the system that refused it (`StockReservationRefused`,
`ShipmentRefused`, `RefundFailed`), never by a reply.

Order process manager states (`ordering` domain): `reserving` -> `refused` | `awaitingPayment`
(card) | `awaitingTransfer` (invoice) -> `paid` -> `shipping` -> `shipped`; side states
`cancelled`, `refunding`, `refunded`, `refundFailed`. Each state with a deadline:
`reserving` 5 min, `awaitingPayment` 30 min, `shipping` 72 h (dashboard alert, no automatic step).

## Processes

| Process | Runs | Why |
|---|---|---|
| `web` (Next.js + Payload, 1..n replicas) | Payload admin and dashboard, shop pages (cached), cart, checkout, pay page, order status page, Stripe and warehouse webhook hooks, probes. Assembly builds all five systems' answering and acting ports with real driven adapters, no relay, no bus. | Payload 3 runs inside Next.js; request work only; writes outboxes, never delivers them, so a slow warehouse or Stripe never holds a request beyond the use case that calls it. |
| `worker` (1..n replicas) | relay (all five system outbox readers + Payload versions outbox reader), bus, every handler, every scheduled task, Payload Local API (no admin), probes on a small HTTP server. | Long-running loops do not fit a request server; scaled and restarted apart from `web`; several replicas safe because the relay leases rows (`FOR UPDATE SKIP LOCKED`) and each scheduled task takes a Postgres advisory lock per tick. |
| `migrate` (one-shot per deploy, before new `web`/`worker`) | Drizzle migrations per system schema (expand step), Payload migrations. | Schema expands before any new code runs, so old and new processes share it during the rolling deploy. |

Every system runs in both `web` and `worker`; a system is not a process. All in one Postgres
instance, one schema and one database role per system plus `payload` and `relay`.

## Directory tree

```
.
├── package.json                    # pnpm workspace root, scripts only
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── docker-compose.yml              # postgres, jaeger for integration tests and local runs
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── payload.config.ts       # external system configuration: collections, hooks wiring, admin views
│   │   ├── instrumentation.ts      # OpenTelemetry SDK boot, OTLP to Jaeger, Prometheus reader
│   │   ├── src/
│   │   │   ├── config.ts           # env -> typed config, read only here
│   │   │   ├── assembly.ts         # calls system builders, sets the courier
│   │   │   ├── payload/
│   │   │   │   ├── collections/{products,media,users}.ts
│   │   │   │   └── views/dashboard/{orders,invoices,shipments,transfers}.tsx
│   │   │   └── app/
│   │   │       ├── (shop)/page.tsx, products/[slug]/page.tsx
│   │   │       ├── (shop)/cart/{page.tsx,actions.ts}
│   │   │       ├── (shop)/checkout/{page.tsx,actions.ts}
│   │   │       ├── (shop)/orders/[orderId]/{page.tsx,pay/page.tsx}
│   │   │       ├── (payload)/admin/[[...segments]]/page.tsx
│   │   │       ├── api/webhooks/stripe/route.ts      # re-exports payments hook
│   │   │       ├── api/webhooks/warehouse/route.ts   # re-exports fulfillment hook
│   │   │       ├── api/invoices/[invoiceId]/route.ts # re-exports billing adapter
│   │   │       └── health/{live,ready}/route.ts, metrics/route.ts   # probes
│   │   └── test/                   # mirrors src
│   ├── worker/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.ts             # instrumentation first, then assembly, relay, scheduler, probes
│   │   │   ├── instrumentation.ts
│   │   │   ├── config.ts
│   │   │   ├── assembly.ts         # handlers -> bus, outbox readers -> relay, scheduled tasks -> scheduler
│   │   │   ├── payload-outbox-reader.ts   # assembly's outbox reader over Payload product versions
│   │   │   └── probes.ts           # /health/live, /health/ready, /metrics
│   │   └── test/
│   └── migrate/
│       ├── package.json
│       └── src/main.ts
├── systems/
│   ├── catalog/
│   │   ├── package.json            # exports only "./published-language" and "./builder"
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── product.ts                 # aggregate, revision, publish/withdraw/refuse
│   │   │   │   ├── specifications/{sku-format,slug-format,price-positive,sku-immutable,unique-identity}.ts
│   │   │   │   └── editorial-version.ts       # catalog's terms for what an editor submits
│   │   │   ├── service/
│   │   │   │   ├── check-product-draft.ts
│   │   │   │   ├── check-draft-deletion.ts
│   │   │   │   ├── publish-revision.ts
│   │   │   │   ├── get-publication-status.ts
│   │   │   │   └── list-published-products.ts, get-published-product.ts
│   │   │   ├── ports/
│   │   │   │   ├── driving.ts                 # one interface per use case, catalog terms
│   │   │   │   └── driven/{product-repository,transactions,outbox,clock,ids}.ts
│   │   │   ├── published-language/
│   │   │   │   ├── events.ts                  # ProductPublished@1, ProductWithdrawn@1 (zod)
│   │   │   │   ├── open-host-service.ts       # inputs, outputs, errors of answering ports
│   │   │   │   └── translate.ts               # domain -> published language
│   │   │   ├── adapters/
│   │   │   │   ├── driven/drizzle/{schema,product-repository,transactions,outbox}.ts
│   │   │   │   ├── driven/drizzle/migrations/
│   │   │   │   ├── driven/fake/{product-repository,transactions,outbox,clock,ids}.ts
│   │   │   │   └── driving/
│   │   │   │       ├── payload/{products-hooks,publication-status-field}.ts
│   │   │   │       └── handlers/on-payload-product-version.ts
│   │   │   ├── outbox-reader.ts
│   │   │   └── builder.ts
│   │   └── test/                   # mirrors src; test/adapters/driven/drizzle/* are integration tests
│   ├── ordering/
│   │   ├── src/
│   │   │   ├── domain/{cart,order,offer,checkout-deadlines,order-lines}.ts
│   │   │   ├── domain/specifications/{prices-as-seen,may-ship,refund-due}.ts
│   │   │   ├── service/{add-to-cart,change-cart-line,place-order,refund-order,refresh-offer,record-*,advance-overdue-orders,send-order-confirmation,get-*,list-orders}.ts
│   │   │   ├── ports/driving.ts
│   │   │   ├── ports/driven/{cart-repository,order-repository,offer-repository,transactions,outbox,customer-mail,clock,ids}.ts
│   │   │   ├── published-language/open-host-service.ts
│   │   │   ├── adapters/driven/drizzle/{schema,*-repository,transactions,outbox,outgoing-commands}.ts
│   │   │   ├── adapters/driven/drizzle/migrations/
│   │   │   ├── adapters/driven/mail/customer-mail.ts
│   │   │   ├── adapters/driven/fake/
│   │   │   ├── adapters/driving/web/{cart-actions,checkout-actions,status}.ts
│   │   │   ├── adapters/driving/payload/{orders-view,refund-action}.ts
│   │   │   ├── adapters/driving/handlers/{on-product-published,on-stock-reserved,on-payment-received,...}.ts
│   │   │   ├── adapters/driving/scheduled/advance-overdue-orders.ts
│   │   │   ├── outbox-reader.ts
│   │   │   └── builder.ts
│   │   └── test/
│   ├── fulfillment/                # same shape; adapters/driven/warehouse/, adapters/driving/hooks/warehouse-webhook.ts
│   ├── payments/                   # same shape; adapters/driven/{stripe,bank}/, adapters/driving/hooks/stripe-webhook.ts
│   └── billing/                    # same shape; domain/{invoice,credit-note,number-series,vat-rates,reminder-schedule}.ts, adapters/driven/{mail,pdf}/
├── shared-kernel/
│   ├── package.json
│   ├── src/{money,sku,tax-class}.ts
│   └── test/
├── lib/                            # common library
│   ├── db/                         # pools per role, Drizzle client factory, transaction helper, retry on serialization/version conflict
│   ├── outbox/                     # outbox table factory, message envelope, generic outbox reader
│   ├── relay/                      # polling + LISTEN/NOTIFY, leases, backoff, parking, external read marks (relay schema)
│   ├── bus/                        # subscription by message type@version, handled-message ledger helper
│   ├── courier/                    # per-process ambient value holding what assembly produced
│   ├── scheduler/                  # cron ticks + advisory lock per scheduled task
│   ├── logger/                     # pino, mixin adds trace id from OpenTelemetry context
│   ├── tracing/                    # tracer, trace context into and out of message envelopes
│   ├── mail-client/                # transport only, no terms
│   └── http-client/
└── tooling/
    ├── architecture-test/          # dependency-cruiser rules + test asserting about the source tree
    ├── seed/
    └── cli/                        # developer CLI: replay parked messages locally, inspect outboxes
```

## How each property holds

### P1. The domain models the business domain, not what serves it

Each system's `src/domain` imports only `shared-kernel`, zod and its own files; the architecture
test (tooling) fails on any other import, including Drizzle, Next, Payload, Stripe, pino. The
domain's names are the shop's: Product, Offer, Order, Reservation, Shipment, CardPayment,
ExpectedTransfer, Invoice, CreditNote. Stripe's PaymentIntent, the warehouse's outbound order and
Payload's document exist only in adapters (anti-corruption layer everywhere). The exception is
used once: the shared kernel, taken by choice (P12).

### P2. A business rule lives in one place: the domain

Every rule is a domain function or specification: sku/slug/price/tax class rules and sku
immutability in `catalog/domain`; prices as seen, ship only once paid, payment for a cancelled
order is refunded, deadlines in `ordering/domain`; reservation hold and expiry in
`fulfillment/domain`; transfer matching (reference holds invoice number, amount at least the open
amount) in `payments/domain`; VAT by tax class and date, gapless numbering, reminder schedule in
`billing/domain`. Services only sequence: load, ask the domain, save. Payload's configuration
holds no rule: its `validate`, `beforeChange`, `beforeDelete` hooks call `catalog`'s
`checkProductDraft` / `checkDraftDeletion`, so editors get inline refusals from the one copy.
No store triggers, no check constraints carrying rules; unique indexes on sku and slug back the
uniqueness specification and are generated from the same domain constant list of unique keys.

### P3. Business rules that change together sit together; rules that change for different reasons share nothing either would have to change

Cut by reason to change: product content and pricing (`catalog`), the customer's order and its
lifecycle (`ordering`), stock and warehouse (`fulfillment`), money movement and providers
(`payments`), tax law and legal documents (`billing`). No shared `Order`: each system has its own
lines (`OrderLine`, `ReservationLine`, `InvoiceLine`) built from messages. The shared kernel is
three values that change for no business reason of one system alone. `payments` and `billing`
do not know each other: a tax change never touches payment code. One pnpm package per system,
so moving a cut is moving a package.

### P4. A use case responds the same whoever calls it and whatever serves it

A service is a factory taking driven ports and returning one driving port; driving adapters only
translate input and output (server action, Payload hook, webhook hook, handler, scheduled task,
test) and call the same port. The system builder builds the same services over Drizzle adapters
or over fakes. Use cases that act take an idempotency id from the caller (`orderId` from the
checkout form, message id, Stripe event id), so every caller gets the same response on a repeat.

### P5. A system reaches the outside, and is reached from it, only through its ports; each port speaks the system's terms

Outside reached only via driven ports named in the system's terms (`Warehouse.submit(shipment)`,
`CardGateway.open(payment)`, `CustomerMail.sendOrderConfirmation(order)`, `Clock.now()`).
Reached only via driving ports, through driving adapters. Each system package exports only
`published-language` and `builder`; the architecture test forbids importing another system's
`src` and forbids `process.env` outside `apps/*/src/config.ts`. Another system's records are
unreachable: each system connects with its own Postgres role holding privileges on its own
schema only. Payload's records are read only through Payload's Local API, never its tables.
Logger and tracer are per-process ambient values from the common library (see readings).

### P6. Every use case can run with nothing outside the process

Every driven port has a fake in `adapters/driven/fake`; `build<System>Fakes()` gives the whole
system on fakes, and the default suite runs every use case that way. Fakes behave as the outside
where the use case can tell: fake repositories enforce version checks and unique keys, fake
`Transactions` rolls back on throw, fake outbox is visible only after commit, fake `CardGateway`
can succeed then fail later and delivers events twice and out of order, fake `Warehouse` likewise,
fake `Clock` is set by the test. One contract suite per port runs against the fake (default
suite) and the Drizzle adapter (integration test, Postgres in a container); the Stripe, warehouse,
bank and mail adapters have end-to-end tests against test mode and sandboxes.

### P7. A use case's writes to its own system's records land together or not at all

Every acting use case runs inside `Transactions.run`, one Postgres transaction on the system's
own store: aggregate saves, the replica update, the handled-message ledger row and the outbox rows
commit together. Repositories save whole aggregates. The cart checkout and the order placement
are one transaction in `ordering`.

### P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after

Messages and mails leave only through the outbox port, written in the use case's transaction;
the relay delivers only committed rows, at least once. Mails are sent by handlers of private
messages, after commit. Calls outside made before a commit are tentative operations only:
Stripe PaymentIntent creation (charges nothing until the customer confirms; `reconcileCardPayments`
cancels intents with no CardPayment after 1 h), warehouse SKU registration and shipment
submission happen in handlers of private messages after commit, keyed by our id. Payload's save
calls only answering use cases of `catalog` before Payload commits; `catalog` acts on the version
only once Payload committed it, via the Payload versions outbox. Webhook hooks answer 2xx only after
the use case committed, so Stripe and the warehouse redeliver anything lost to a stop.

### P9. A repeated delivery changes nothing in this system

Every handler writes `(handler, messageId)` into the system's handled-message ledger in the use
case's transaction; a unique key makes a second delivery, overlapping or later, either wait and
then find the row (skip) or lose the insert and roll back. Hooks do the same with Stripe event ids
and warehouse event ids. Aggregate transitions are idempotent on their own as well (a paid order
receiving `PaymentReceived` again is unchanged). Outside repeats allowed by business rules: a
confirmation, invoice or reminder mail may arrive twice (provider idempotency key = message id
where offered); Stripe and the warehouse are called with our id as idempotency key or external
reference, looked up before create.

### P10. A use case commits only on reads that still hold, or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them

Optimistic version column on every aggregate; save fails on a changed version and the use case
retries from load (bounded). Aggregates are small so only tied work collides: stock per sku
(StockItem), so two checkouts of different teas never fail each other, two checkouts of the last
unit do. Reservation of several skus locks StockItems in sku order. Gapless numbering is a tie
by business rule: `NumberSeries` per kind and year serializes issuing. Stale reads accepted by
business rules: the cached shop page (up to 60 s); the Offer replica, guarded by "an order is placed
only at the prices the customer last saw at checkout" (`placeOrder` carries `seenOfferRevisions`
and refuses on mismatch); reminders read invoice status that may lag an unimported transfer
(reminder text says to ignore it if paid).

### P11. No other system changes the records a system owns

One schema and one Postgres role per system, privileges only on its own schema (granted by
`migrate`); Payload's role owns `payload` only; the relay's role reads and marks outboxes through
each system's outbox reader and owns `relay`. Replicas (Offer, on-hand counts) are written only by
their keeper's use cases from what the owner publishes or returns.

### P12. Another system's model enters this one only by choice

Anti-corruption layer for every upstream: handlers translate events, the outbox adapter
translates requests into the upstream's commands, hooks translate Payload, Stripe and warehouse
payloads; upstream published language imports allowed only under `src/adapters` (architecture
test). The one model taken as is: the shared kernel (`Money`, `Sku`, `TaxClass`), a deliberate
choice by all five systems.

### P13. A system changes its model without its downstream systems changing

Published language is its own module per system (`published-language/`), versioned per message
and per open host service schema (`ProductPublished@1`), mapped from the domain in
`translate.ts`. Downstream adapters read only the published language. A model change edits the
mapping, not the language; a language change adds `@2` beside `@1`.

### P14. A record or a message means the same to all code that reads it, whenever it was written

Messages: envelope `{ id, type, version, occurredAt, traceparent, payload }`; a payload of a given
`type@version` never changes meaning. A new meaning is a new version; the producer writes both
versions until every downstream handler reads the new one; handlers keep accepting every
version that may still sit in an outbox; deploy order: handlers first, producers after.
Records: expand/contract migrations (`migrate` expands before new code, contract only in a later
deploy once no process reads the old shape); repositories update only columns their code knows;
every aggregate row carries `schemaVersion`, and code refuses to save an aggregate whose
`schemaVersion` is newer than it knows (the use case fails and is retried, by then on new code),
so an old process cannot save back and drop what it does not know. Optimistic versions stop an
old process overwriting a newer write it did not load.

### P15. A system works while others are down or slow, as far as its own data reaches

No synchronous call between our systems; each holds what its use cases need: `ordering` the
Offer replica and snapshots, `fulfillment` on-hand counts, `payments` expected transfers. Stripe
down: card orders wait in `awaitingPayment` and the pay page fails visibly; invoice checkout still
works. Warehouse down: submissions retry from the outbox. Bank down: import catches up from its
cursor. Mail provider down: mails retry. Payload down affects only editing; the shop reads
`catalog`.

### P16. No transaction spans two systems

One store per system (own role, own pool, own schema); `Transactions` opens transactions on that
pool only; Payload's own transaction is never joined (its hooks call answering use cases only).
Cross-system work is messages.

### P17. Work spanning systems ends, and only in a state a business rule allows

Orchestration: the Order aggregate in `ordering` is the process manager; each state has a
deadline enforced by `advanceOverdueOrders`. Every tentative operation confirms or cancels:
reservations carry `holdUntil` and are confirmed by `ShipOrder` or released (`ReleaseStock`,
`expireReservations`); PaymentIntents confirmed by the customer or cancelled (order deadline,
`reconcileCardPayments`). Compensations (saga): stock refused -> order refused, nothing charged;
card unpaid in 30 min -> release stock, cancel payment; payment arrives for a cancelled order ->
refund; shipment refused after payment -> refund + credit note; invoice lapsed after the last
reminder -> release stock, cancel invoice by credit note. Accepted divergences: refund failed ->
credit note stands, shown on the dashboard for manual payout. Reconciliations repair: `payments`
vs Stripe and bank, `fulfillment` vs warehouse (shipments, on-hand counts, registered SKUs).
Waiting states are customer-visible (order status page) and each has a deadline.

### P18. The order messages arrive in does not change the outcome

Handlers decide on what the system already knows, not on arrival order: replicas apply a
`catalog` revision only if newer than the stored one; a `ReleaseStock` for an unknown reservation
writes a released Reservation as a tombstone, so a later `ReserveStock` with that id is refused;
transitions out of final states are ignored (`PaymentReceived` on a cancelled order -> refund
rule; a Stripe `payment_failed` after `succeeded` -> unchanged); Stripe and warehouse hooks read
the current object from the provider when an event is older than the stored state. A message
whose aggregate is not known yet and that cannot be recorded as a tombstone is retried with
backoff by the relay, parked after 20 attempts and shown on `/metrics` and the dashboard.

## Decisions the documents left to me

1. **Five systems of ours (`catalog`, `ordering`, `fulfillment`, `payments`, `billing`).** Split by
   reason to change; `payments` (providers) and `billing` (tax law, documents) apart.
   > "Rules that change for the same reason and stand apart from the rest are also where a system splits once the business domain is better known."
   > "Hence, when designing bounded contexts, start with wider boundaries."
2. **No customer system; guest checkout, customer data as snapshot on Order.** none.
3. **Payload CMS is an external system run in our processes; it owns its drafts, `catalog` owns
   what the shop sells.**
   > "A bounded context whose code this codebase does not write, though it may configure it: bought or adopted, run by its vendor or by us, in its own process or in ours."
   > "of a record no business rule decides, the system that keeps it."
4. **Payload configuration holds no business rule; its hooks call `catalog`'s answering use cases.**
   > "Its configuration may hold business rules this codebase writes, in the external system's terms; its architecture stays its own."
   > "A business rule anywhere else, in a store trigger, a hook, a service, is one a reader of the domain misses and writes again."
5. **Payload's committed product versions are its outbox; assembly provides the outbox reader;
   read marks kept in a `relay` schema.**
   > "The *outbox reader* is what the relay reads the outbox through, and marks it by; the system provides it, and for an external system's outbox, assembly does."
6. **Editors cannot delete a product once published; refusal is `catalog`'s rule via a hook.** none.
7. **Orchestration, with Order in `ordering` as process manager; no choreography.**
   > "One system's *process manager* holds the sequence across systems: an aggregate whose state is where the sequence stands. Each step is a use case of that system that sends commands to the others."
8. **Order aggregate is the process manager itself, no separate aggregate.**
   > "an aggregate whose state is where the sequence stands"
9. **No synchronous calls between our systems; all messages, reservation included.**
   > "A use case needing only data this system holds runs anyway; one needing another system now fails visibly, and that is expected."
10. **Refused commands answered by events of the refusing system, no replies.**
    > "A *command* says do this, to the one system that offers it, which may refuse."
11. **`payments` and `billing` never talk; `ordering` relays (ExpectTransfer, SettleInvoice).** none.
12. **Every order gets an invoice: card orders after payment, settled; invoice orders after
    reservation, due in 14 days.** none.
13. **Gapless numbers: counter aggregate per document kind and year, incremented in the issuing
    transaction; credit notes their own series.**
    > "use cases fail each other only where a business rule ties them"
14. **Prices are gross; VAT computed by `billing` from tax class and date; `TaxClass` identity in
    the shared kernel, rates in `billing`.**
    > "A model several systems of this codebase share as code and agree on together, each importing it into its domain: `Money`, `Sku`."
15. **Ships only once paid, invoice orders included.**
    > "an order ships only once paid."
16. **Reservation hold times: card 1 h, invoice until due date plus reminder period; reminders at
    due+7, +14, lapse at +21.** none.
17. **Bank integration by polling (scheduled task), refunds of transfers by bank payout.** none
    (brief lists webhooks for Stripe and warehouse only).
18. **Stock availability = warehouse on-hand (replica) minus own reservations; product unsellable
    until its SKU is registered.**
    > "A copy of another system's data, kept under the owner's ids and shaped as this system writes it: translated, compacted or projected."
19. **Shop page cached 60 s time-based per `web` replica, no cross-process invalidation; checkout
    guards price with `seenOfferRevisions`.**
    > "A stale read is one a business rule accepts, with what happens meanwhile."
20. **Processes `web`, `worker`, `migrate`.** none.
21. **One store per system: own schema, own role, own pool, in the one Postgres instance.**
    > "Two clients are one store when their writes commit together, two stores until they do."
22. **Idempotency by handled-message ledger per handler in the system's store.**
    > "Delivery repeats, so every handling tolerates a second arrival, one overlapping the first included."
23. **Message envelope versioned per type; consumers deployed before producers; dual publish.**
    > "the upstream can "simultaneously expose multiple versions of the published language, allowing the consumer to migrate to the new version gradually"."
24. **`schemaVersion` on records, old code refuses to save newer records.**
    > "An old process saves back a record the new code wrote and drops what it does not know"
25. **Courier: per-process ambient value set by assembly, read by Next routes, server actions and
    Payload hooks.**
    > "How a driving adapter reaches what assembly produced when assembly cannot hand it over as an argument."
26. **Logger and tracer as per-process ambient values from the common library, not ports; trace
    context carried in message envelopes.**
    > "Plumbing every system may import: store clients, a logger, a tracer, the relay, the bus, the courier."
27. **Monorepo with one package per system, exports restricted; architecture test as tooling.**
    > "a test that asserts about the source tree."
28. **Fakes live in `src/adapters/driven/fake`, not in `test/`.**
    > "A working implementation of a port that reaches nothing outside the process: a repository over an in-memory map."
29. **Payload media on a persistent volume of `web` (no object store in the brief).** none.
30. **Dashboard is Payload admin custom views calling each system's answering ports; no
    dashboard system, no combined read model.** none.
31. **No shipping mail, no restock on refund, no customer-initiated cancellation.** none.
32. **Relay retries with backoff, parks after 20 attempts; parked messages on `/metrics` and the
    dashboard.** none.
33. **Probes: `/health/live`, `/health/ready` (pools reachable, Payload initialised), `/metrics`
    (Prometheus reader of OpenTelemetry metrics: outbox depth, relay lag, parked count);
    traces to Jaeger over OTLP.**
    > "Code a process runs to report on itself rather than on a system: whether it is alive or ready, its metrics."
34. **Migrations run in a deployed one-shot process, not tooling.**
    > "Code that runs in no process of the deployed application: a developer CLI, a seed script, a test that asserts about the source tree."

## Sentences I had to pick a reading for

1. > "Its configuration may hold business rules this codebase writes, in the external system's terms; its architecture stays its own."
   - A: business rules may be written into Payload's configuration itself, an allowed second place.
   - B: the configuration may be where a rule is applied, but the rule must still live in a domain (P2: "A business rule anywhere else, in a store trigger, a hook, a service, is one a reader of the domain misses and writes again.").
   - Took B: Payload config calls `catalog`'s driving ports.
2. > "The *outbox reader* is what the relay reads the outbox through, and marks it by; the system provides it, and for an external system's outbox, assembly does."
   - A: only external systems that ship a real outbox have one.
   - B: whatever an external system commits durably and in order enough to read (Payload's versions) may serve as its outbox.
   - Took B, and marks are kept outside Payload (in `relay`) since the external system's records are its own.
3. > "An *event* says something happened; no receiver can refuse it."
   - A: the receiver must apply what the event says.
   - B: the receiver must handle and record it, but its own rules decide what follows.
   - Took B: `catalog` handles every Payload version and may record a publication refusal.
4. > "A *command* says do this, to the one system that offers it, which may refuse."
   - A: refusal is a reply to the sender.
   - B: refusal is a fact of the receiver, told as its own event.
   - Took B.
5. > "Two clients are one store when their writes commit together, two stores until they do."
   - A: one Postgres instance is one store, since its writes can commit together.
   - B: clients that never share a transaction are two stores, even on one instance.
   - Took B: one role, pool and schema per system is one store.
6. > "A store may keep records of several owners."
   - A: one table may mix owners.
   - B: one store (instance) may hold several systems' records, each in its own place.
   - Took B per system schema; a system's own store keeps only replica records of others.
7. > "Hook. A driving adapter an upstream system calls."
   - A: only callbacks of external systems (Stripe webhook, Payload hook).
   - B: any driving adapter invoked by another system, ours included.
   - Took B in principle; in this draft only external systems call ours synchronously, so both readings give the same adapters.
8. > "Owner. The system whose business rules decide what a record holds, wherever it is kept; of a record no business rule decides, the system that keeps it."
   - A: Payload's product documents are `catalog`'s, since `catalog`'s rules check them on save.
   - B: they are Payload's: drafts may hold anything; `catalog`'s rules decide only what `catalog` records.
   - Took B, which keeps P11 (`catalog` never writes Payload's records).
9. > "Seen from the caller, this system's driving port lies behind one of the caller's driven ports."
   - A: applies to synchronous calls only.
   - B: also to messages: the command written to the caller's outbox is the receiver's driving port reached through the caller's outbox port.
   - Took B: `ordering`'s outbox adapter serializes into the receiver's commands.
10. > "Outside. Other systems and third parties, the operating system among them, whether they drive the system or it drives them: a store, a mail provider, the clock, the file system."
    - A: logging and tracing to stdout/OTLP are reaching the outside and need driven ports (P5).
    - B: logger and tracer are per-process ambient values of the common library, as the glossary lists them, not a use case reaching the outside.
    - Took B.
11. > "A repeated delivery changes nothing in this system"
    - A: the second delivery leaves the system as the first left it.
    - B: no delivery, even the first, may change anything (absurd).
    - Took A.
12. > "Each message is handled against what the system already knows, whatever came first."
    - A: a message that arrives early is recorded so the later one is judged against it (tombstone).
    - B: a message that arrives early waits until what it depends on is known.
    - Took A where a record can be made, B (retry with backoff) otherwise.
13. > "Work waiting on another system's answer is still a state a customer finds."
    - A: waiting states must be shown to the customer.
    - B: waiting states must themselves be states a business rule allows, with an end.
    - Took both: shown on the order status page and bounded by deadlines.
14. > "Probe. Code a process runs to report on itself rather than on a system: whether it is alive or ready, its metrics."
    - A: outbox depth and parked messages are about systems, not probes.
    - B: they report on the process's relay and bus, so they are probe metrics.
    - Took B; business figures (orders, revenue) are not probes and stay on the dashboard.
15. > "Tooling. Code that runs in no process of the deployed application: a developer CLI, a seed script, a test that asserts about the source tree."
    - A: migrations are tooling (run by a developer or CI).
    - B: migrations run as a deployed one-shot process.
    - Took B.
16. > "A *driving adapter* adapts one caller to a driving port."
    - A: one adapter per (caller, port) pair.
    - B: one adapter per way in, possibly reaching several ports (a dashboard view, a page).
    - Took B, together with "There are as many driving adapters as there are ways into the process".
17. > "*Except:* another system's model this system chose to take (P12)."
    - A: covers conformist only.
    - B: covers the shared kernel too.
    - Took B: the shared kernel is the only model taken unchanged.
