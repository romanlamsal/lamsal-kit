# Fresh repository draft A, distilled set

## Systems and what each owns

Five systems this codebase writes, one shared kernel, and the external systems around them.
Each system is one bounded context with its own domain and glossary, its own Postgres schema
and its own Postgres role in the one Postgres instance; the role may write only its own schema.
Each system's Drizzle client is therefore its own store: its writes never commit together with
another system's.

| System | Owns (records whose business rules it holds) | Keeps but does not own |
|---|---|---|
| `catalog` | Product (aggregate, id = `Sku`): slug, name, gross price, tax class, sellable or withdrawn, the Payload revision it was adopted from; ProductRevisionRefusal (why a Payload revision was not adopted) | the Payload document id, as a reference |
| `ordering` | Cart; Order (aggregate and the *process manager* of checkout, payment, shipping, cancellation and refund); the price, tax class, customer data and addresses each Order snapshots | ProductOffer, a replica of `catalog` products and `fulfillment` availability, keyed by `Sku` |
| `payments` | CardPayment (one per Order, Stripe PaymentIntent reference); BankTransfer (incoming, keyed by bank transaction id); Refund; the Stripe event and bank import cursors | the payer IBAN as a snapshot on BankTransfer |
| `invoicing` | Invoice (lines, VAT per tax class, gapless number, due date, dunning level, matched transfers, paid or cancelled); CreditNote; NumberSequence (per document kind and year); UnmatchedTransfer; the VAT rates per tax class and the dunning schedule (domain code) | billing address and lines, as snapshots from `IssueInvoice` |
| `fulfillment` | StockItem (per `Sku`: reservations, allocations); Reservation (per Order, a tentative operation with a hold-until); SkuRegistration (per `Sku`); Shipment (per Order) | warehouse on-hand stock per `Sku`, a replica of the warehouse partner |

Shared kernel (`src/shared-kernel`): `Money` (EUR cents, integer), `Sku`, `TaxClass` (the codes
only, `standard` and `reduced`; the rates are `invoicing`'s).

External systems:

- **Payload CMS** (v3, run by us, in our web and worker processes, its own `payload` schema and
  role). It owns its documents: the `products` collection (the editor's copy, images, slug,
  price, sku, tax class, draft or published), `media`, and `users` (editors and admins). Its
  configuration is our code; its architecture stays its own.
- **Stripe** (card payments, refunds, webhooks), **warehouse partner API** (SKU registration,
  outbound orders, stock levels, webhooks), **bank API** (account transactions, outgoing
  transfers; polled, no webhooks), **mail provider**. Each owns its own records.
- **The clock** and **the operating system** are outside too; every system reaches the clock
  through its own `Clock` driven port.

No system is conformist. Every relationship is an anti-corruption layer: the upstream's terms
stop at the downstream's adapters. The shared kernel is the one model entering several domains,
by choice.

Upstream and downstream:

- Payload is upstream of `catalog` (Hooks, documents read through Payload's Local API).
- `catalog` is upstream of `ordering` and `fulfillment` (events).
- `fulfillment` is upstream of `ordering` (availability, reservation and shipment events) and
  offers the commands `ordering` sends.
- `payments` is upstream of `ordering` (open host service `startCardPayment`, events, the
  `RefundPayment` command) and of `invoicing` (`BankTransferReceived`).
- `invoicing` is upstream of `ordering` (events, the `IssueInvoice` and `IssueCreditNote`
  commands).
- Stripe, the warehouse partner, the bank API and the mail provider are upstream of the system
  whose adapters talk to them.

## Ports and adapters

Conventions for every system:

- A driving port is one use case: a function type in `ports/driving.ts`, taking and returning
  the system's terms. Each use case either acts or answers. A use case that acts may return
  what its caller needs to go on (an id, a client secret); it never returns a store's row.
- Every acting use case runs in one transaction of its system's store (unit of work). Every
  driven port it writes through (repositories, outbox port, `ProcessedMessages`) is bound to
  that transaction.
- `ProcessedMessages` is the driven port every system has: it records the id of each message a
  handler handed to a use case, under the handler's name, in the use case's transaction.
- Every system has the outbox port `<System>Outbox` and provides its outbox reader through its
  system builder.
- Every system has a `Clock` driven port and an `Ids` driven port (uuid v7).
- Every driven port has a fake under `adapters/driven/fakes`. Every repository has a Drizzle
  driven adapter under `adapters/driven/drizzle`. Each external system has a driven adapter
  under `adapters/driven/<external>`.
- The published language of each system sits in `published-language/`: zod schemas and types
  for its open host service's driving ports (inputs, outputs, errors), the events it publishes,
  and the commands it takes. A message type name carries its version (`ProductPublished.v1`).

### `catalog`

- Driving ports (open host service marked OHS):
  - `browseShop()`: answers the sellable products for the shop page. OHS (the web process's shop page).
  - `getProductBySlug(slug)`: answers. OHS.
  - `adoptProductRevision(payloadDocumentId)`: acts. Loads the Payload document through
    `ProductDrafts`, asks the domain whether the revision may be adopted, saves the Product and
    writes `ProductPublished.v1` or `ProductWithdrawn.v1`, or saves a ProductRevisionRefusal.
  - `reconcileProductDrafts(since)`: acts. A reconciliation: compares Payload's published
    revisions with the revisions Catalog adopted and adopts each one missing.
  - `productAdoptionStatus(payloadDocumentId)`: answers (adopted revision, or the refusal and its reason).
- Driven ports: `ProductRepository`, `ProductRevisionRefusalRepository`, `ProductDrafts`
  (reads Payload documents, returns them in `catalog`'s terms), `CatalogOutbox`,
  `ProcessedMessages`, `Clock`, `Ids`.
- Driving adapters:
  - HTTP: the shop page and the product page (server components in the web process).
  - Hooks Payload calls: `afterChange` and `afterDelete` on `products` (a nudge that calls
    `adoptProductRevision` after Payload's transaction commits; correctness does not depend on
    it), and a read-only UI field in Payload's product form showing `productAdoptionStatus`.
  - Scheduled task: `reconcileProductDrafts` every minute.
  - CLI: `catalog:adopt <payloadDocumentId>`.
- Driven adapters: Drizzle repositories and outbox over schema `catalog`; `ProductDrafts` over
  Payload's Local API (the anti-corruption layer: Payload field names and `_status` stop here);
  fakes.
- Domain: Product, `mayAdopt` (specification: sku format, gross price above zero, tax class
  known, slug format, slug not held by another sellable product, sku unchanged for an existing
  product), `isSellable`.

### `ordering`

- Driving ports:
  - Cart: `addToCart`, `changeCartLine`, `removeCartLine` (act); `viewCart` (answers, prices from ProductOffer).
  - `reviewCheckout(cartId)`: answers lines, total, whether each line is orderable.
  - `placeOrder(cartId, customer, billingAddress, shippingAddress, paymentMethod, expectedTotal)`:
    acts. Refuses when a line is not orderable or the total differs from `expectedTotal`. Saves
    the Order with snapshots and writes the command `ReserveStock`.
  - `startCardPayment(orderId)`: acts. Calls `CardPayments`, returns the Stripe client secret
    in `ordering`'s terms (`PaymentSession`).
  - Process manager steps, each a use case reached by a handler: `recordProductOffer`,
    `recordAvailability`, `recordStockReserved`, `recordStockReservationRefused`,
    `recordReservationExpired`, `recordCardPaymentSucceeded`, `recordCardPaymentFailed`,
    `recordInvoiceIssued`, `recordInvoicePaid`, `recordInvoiceDunningExhausted`,
    `recordOrderShipped`, `recordShipmentFailed`, `recordRefundCompleted`, `recordRefundFailed`,
    `recordCreditNoteIssued`.
  - `expireOrderDeadlines(now)`: acts (scheduled task).
  - Admin: `cancelOrder(orderId)`, `refundOrder(orderId)` (act); `listOrders`, `getOrder` (answer).
  - `sendOrderConfirmation(orderId)`: acts (handler of the private command).
- Driven ports: `CartRepository`, `OrderRepository`, `ProductOfferRepository`,
  `OrderingOutbox`, `ProcessedMessages`, `CardPayments` (behind it lies `payments`'
  `startCardPayment`), `OrderMails`, `Clock`, `Ids`.
- Driving adapters: HTTP (cart, checkout pages and server actions in the web process);
  handlers for `catalog`, `fulfillment`, `payments`, `invoicing` events and for the private
  command `SendOrderConfirmation`; scheduled task `expireOrderDeadlines` every minute; Hooks
  Payload calls (the admin dashboard's orders panel and its refund and cancel actions); CLI
  `ordering:order <id>`.
- Driven adapters: Drizzle over schema `ordering`; `CardPayments` adapter that calls the
  `payments` driving port handed over by assembly and translates its published language;
  `OrderMails` adapter that renders the mail and calls the mail provider; fakes.
- Domain: Cart, Order (state = the facts received: stock reserved, paid, invoiced, shipped,
  cancelled, refunded, and the deadline), `isOrderable`, `orderTotal`, `dueCommands(order)`
  (which commands the current facts call for), `mayRefund`, `mayCancel`, the deadlines (card
  payment window 30 minutes; invoice-order reservation hold 45 days).

### `payments`

- Driving ports:
  - `startCardPayment(orderRef, amount)`: acts. OHS. Saves a CardPayment, then creates the
    PaymentIntent through `CardPaymentProvider` with the CardPayment id as idempotency key,
    saves the intent reference, returns the client secret.
  - `recordStripeEvent(event)`: acts. Records the outcome of a PaymentIntent or Refund, writes
    `CardPaymentSucceeded.v1`, `CardPaymentFailed.v1`, `RefundCompleted.v1` or `RefundFailed.v1`.
  - `importBankTransactions()`: acts. Reads bank transactions since the cursor, saves each new
    BankTransfer, writes `BankTransferReceived.v1`.
  - `reconcileCardPayments()`: acts. A reconciliation over open CardPayments and Refunds against Stripe.
  - `refundPayment(command)`: acts (handler of the command `RefundPayment`). Saves a Refund and
    writes the private command `ExecuteRefund`.
  - `executeRefund(refundId)`: acts. Calls Stripe or the bank with the Refund id as
    idempotency key, records the result.
  - `listPayments`: answers.
- Driven ports: `CardPaymentRepository`, `BankTransferRepository`, `RefundRepository`,
  `ImportCursorRepository`, `CardPaymentProvider`, `BankAccount`, `PaymentsOutbox`,
  `ProcessedMessages`, `Clock`, `Ids`.
- Driving adapters: Hook `/webhooks/stripe` (verifies the signature, uses the Stripe event id
  as message id); handlers for `RefundPayment` and `ExecuteRefund`; scheduled tasks
  `importBankTransactions` every 5 minutes and `reconcileCardPayments` every 10 minutes; Hook
  for the dashboard's payments panel.
- Driven adapters: Drizzle over schema `payments`; `CardPaymentProvider` over the Stripe SDK
  (anti-corruption layer: Stripe's objects stop there); `BankAccount` over the bank API; fakes.

### `invoicing`

- Driving ports:
  - `issueInvoice(command)`: acts (handler of `IssueInvoice`). Takes the next number from
    NumberSequence, computes VAT per tax class from gross lines, saves the Invoice (open, or paid
    when the command names a card payment), writes `InvoiceIssued.v1` and the private command
    `SendInvoiceMail`.
  - `issueCreditNote(command)`: acts (handler of `IssueCreditNote`). Numbers it from its own
    sequence, saves it, marks the Invoice cancelled or credited, writes `CreditNoteIssued.v1` and
    `SendCreditNoteMail`.
  - `matchBankTransfer(transfer)`: acts (handler of `BankTransferReceived`). Matches the
    reference to an invoice number; on a match records the payment and, when settled, writes
    `InvoicePaid.v1`; else saves an UnmatchedTransfer.
  - `issueDueReminders(now)`: acts. For each open Invoice the dunning schedule says is due,
    raises its dunning level and writes `SendReminderMail`; past the last level writes
    `InvoiceDunningExhausted.v1`.
  - `sendInvoiceMail`, `sendReminderMail`, `sendCreditNoteMail`: act (handlers of the private commands).
  - `listInvoices`, `getInvoice`, `invoiceDocument(number)`, `listUnmatchedTransfers`: answer.
  - `assignTransfer(transferId, invoiceNumber)`: acts (admin).
- Driven ports: `InvoiceRepository`, `CreditNoteRepository`, `NumberSequenceRepository`,
  `UnmatchedTransferRepository`, `InvoicingOutbox`, `ProcessedMessages`, `InvoiceMails`,
  `InvoiceDocuments` (renders a PDF from an Invoice or CreditNote), `Clock`, `Ids`.
- Driving adapters: handlers; scheduled task `issueDueReminders` daily at 06:00
  Europe/Berlin; Hooks for the dashboard's invoices panel and the PDF download; CLI
  `invoicing:reminders --dry-run`.
- Driven adapters: Drizzle over schema `invoicing`; mail provider adapter; PDF renderer; fakes.
- Domain: Invoice, CreditNote, NumberSequence, `vatOf(gross, taxClass, date)`, the rates per
  tax class with their effective dates, the dunning schedule (reminder 1 at due + 7 days,
  reminder 2 at due + 21 days, exhausted at due + 35 days), `isSettled`, `matchReference`.

### `fulfillment`

- Driving ports:
  - `registerSku(sku)`: acts (handler of `ProductPublished`). Saves SkuRegistration pending,
    writes the private command `SubmitSkuRegistration`.
  - `submitSkuRegistration(sku)`: acts. Calls `Warehouse` (idempotent by sku), records
    registered, writes `SkuRegistered.v1`.
  - `reserveStock(command)`: acts (handler of `ReserveStock`). Reserves every line or none;
    writes `StockReserved.v1` or `StockReservationRefused.v1`, and `StockLevelChanged.v1`.
  - `releaseReservation(command)`: acts. Writes `ReservationReleased.v1`, `StockLevelChanged.v1`.
  - `shipOrder(command)`: acts. Confirms the Reservation, saves a Shipment, writes the private
    command `SubmitShipment`.
  - `submitShipment(shipmentId)`: acts. Creates the warehouse outbound order with the Shipment
    id as client reference, records the warehouse reference.
  - `recordWarehouseEvent(event)`: acts (Hook). Shipment shipped or cancelled, stock level
    changed; writes `OrderShipped.v1`, `ShipmentFailed.v1`, `StockLevelChanged.v1`.
  - `expireReservations(now)`, `reconcileStockLevels()`, `reconcileShipments()`: act.
  - `listShipments`, `getShipment`: answer.
- Driven ports: `StockItemRepository`, `ReservationRepository`, `SkuRegistrationRepository`,
  `ShipmentRepository`, `Warehouse`, `FulfillmentOutbox`, `ProcessedMessages`, `Clock`, `Ids`.
- Driving adapters: Hook `/webhooks/warehouse`; handlers; scheduled tasks
  `expireReservations` every minute, `reconcileStockLevels` and `reconcileShipments` every 15
  minutes; Hook for the dashboard's shipments panel.
- Driven adapters: Drizzle over schema `fulfillment`; `Warehouse` over the warehouse API
  (anti-corruption layer); fakes.
- Domain: StockItem, Reservation, Shipment, `available(stockItem)` = on-hand − reserved −
  allocated, `mayReserve`, `isExpired`.

### Assembly, per process

- Each system has one system builder, `systems/<system>/builder.ts`: takes configuration (its
  database role's URL, external credentials, which adapters: real or fake) and returns its
  driving ports, its handlers with their subscriptions, its scheduled tasks, its outbox reader,
  and its Hooks.
- `processes/web/assembly.ts` and `processes/worker/assembly.ts` call the builders, hand
  `payments`' `startCardPayment` to `ordering`'s builder for its `CardPayments` adapter, hand
  the handlers to the bus and the outbox readers to the relay (worker only). Nothing else
  imports an adapter.
- Courier: Next.js route modules, server components and Payload's configuration cannot be
  handed arguments. They reach what assembly produced through `getApp()`, a per-process ambient
  value memoized on first call. The trace context and request id are per-request ambient values
  (OpenTelemetry context over AsyncLocalStorage).

## Calls and messages

Synchronous calls:

| Caller | Callee | What |
|---|---|---|
| browser → web | `catalog` | `browseShop`, `getProductBySlug` |
| browser → web | `ordering` | cart use cases, `reviewCheckout`, `placeOrder`, `startCardPayment` |
| `ordering` (`CardPayments`) | `payments` (OHS) | `startCardPayment` |
| `payments` | Stripe | create PaymentIntent, create Refund, list PaymentIntents and events |
| `payments` | bank API | list transactions, create outgoing transfer |
| `fulfillment` | warehouse API | register SKU, create outbound order, read stock levels and shipment status |
| `catalog` (`ProductDrafts`) | Payload Local API | read product documents |
| `ordering`, `invoicing` | mail provider | send mail |
| Payload | `catalog` Hooks | `afterChange`, `afterDelete`, status field |
| Payload admin | Hooks of `ordering`, `invoicing`, `payments`, `fulfillment` | dashboard panels, refund, cancel, assign transfer |
| Stripe | `payments` Hook | webhooks |
| warehouse partner | `fulfillment` Hook | webhooks |
| clock | scheduled tasks | as listed above |

Messages. Every message has an envelope: `id` (uuid v7, the same on every delivery),
`type` with version, `kind` (event or command), published or private, `source`, `subject`
(the aggregate id), `sequence` (the aggregate's version when written), `occurredAt`,
`traceparent`, `payload`.

| Message | Kind | Written by | Handled by |
|---|---|---|---|
| `catalog.ProductPublished.v1` | published event | `catalog` | `ordering` (`recordProductOffer`), `fulfillment` (`registerSku`) |
| `catalog.ProductWithdrawn.v1` | published event | `catalog` | `ordering` (`recordProductOffer`) |
| `fulfillment.ReserveStock.v1` | published command | `ordering` | `fulfillment` |
| `fulfillment.ReleaseReservation.v1` | published command | `ordering` | `fulfillment` |
| `fulfillment.ShipOrder.v1` | published command | `ordering` | `fulfillment` |
| `fulfillment.StockReserved.v1`, `StockReservationRefused.v1`, `ReservationReleased.v1`, `ReservationExpired.v1` | published events | `fulfillment` | `ordering` |
| `fulfillment.StockLevelChanged.v1` | published event | `fulfillment` | `ordering` (`recordAvailability`) |
| `fulfillment.SkuRegistered.v1` | published event | `fulfillment` | none today |
| `fulfillment.OrderShipped.v1`, `ShipmentFailed.v1` | published events | `fulfillment` | `ordering` |
| `fulfillment.SubmitSkuRegistration`, `SubmitShipment` | private commands | `fulfillment` | `fulfillment` |
| `payments.RefundPayment.v1` | published command | `ordering` | `payments` |
| `payments.CardPaymentSucceeded.v1`, `CardPaymentFailed.v1` | published events | `payments` | `ordering` |
| `payments.RefundCompleted.v1`, `RefundFailed.v1` | published events | `payments` | `ordering` |
| `payments.BankTransferReceived.v1` | published event | `payments` | `invoicing` |
| `payments.ExecuteRefund` | private command | `payments` | `payments` |
| `invoicing.IssueInvoice.v1`, `IssueCreditNote.v1` | published commands | `ordering` | `invoicing` |
| `invoicing.InvoiceIssued.v1`, `InvoicePaid.v1`, `InvoiceDunningExhausted.v1`, `CreditNoteIssued.v1` | published events | `invoicing` | `ordering` |
| `invoicing.SendInvoiceMail`, `SendReminderMail`, `SendCreditNoteMail` | private commands | `invoicing` | `invoicing` |
| `ordering.SendOrderConfirmation` | private command | `ordering` | `ordering` |

A command's receiver either acts on it or refuses it; either way it publishes the outcome as an
event (`StockReservationRefused`, `RefundFailed`). No command waits for a reply.

The checkout saga, orchestrated by `ordering`'s Order:

1. `placeOrder` saves the Order (placed) and writes `ReserveStock` (hold until: 1 hour for card,
   45 days for invoice).
2. Card: the browser calls `startCardPayment`; the customer pays on Stripe; `CardPaymentSucceeded`
   arrives, before or after `StockReserved`. Invoice: on `StockReserved`, Order writes
   `IssueInvoice` (open, due in 14 days).
3. When the Order holds both "stock reserved" and "paid" (card) it writes `IssueInvoice`
   (paid by card), `ShipOrder` and `SendOrderConfirmation`. For invoice orders,
   `InvoiceIssued` leads to `SendOrderConfirmation`, and `InvoicePaid` with "stock reserved" leads to `ShipOrder`.
4. `OrderShipped` ends it.

Compensations: `StockReservationRefused` or `ReservationExpired` after payment → `ReserveStock`
once more, then `RefundPayment` and `IssueCreditNote` if refused again; before payment → Order
cancelled (and, if invoiced, `IssueCreditNote`). `CardPaymentFailed` or the card payment window
passing → `ReleaseReservation`, Order cancelled. `InvoiceDunningExhausted` →
`ReleaseReservation`, `IssueCreditNote`, Order cancelled. `ShipmentFailed` → `RefundPayment`,
`IssueCreditNote`. `CardPaymentSucceeded` after cancellation → `RefundPayment`. Admin
`refundOrder` (shipped orders, full refund only) → `RefundPayment`, `IssueCreditNote`.

## Processes

| Process | Runs | Why |
|---|---|---|
| `web` (Next.js with Payload 3 mounted; n instances) | Payload admin and its Hooks (catalog nudge and status field, dashboard panels and admin actions); shop, cart and checkout pages; the Stripe and warehouse Hooks; `/health/live`, `/health/ready`, `/metrics` | Request-bound work that must answer in a request's time. Payload 3's admin runs on Next.js. Webhooks only record and commit, so a slow handler never makes Stripe or the warehouse retry. |
| `worker` (Node; n instances) | the relay over every system's outbox reader, the bus consumers with every handler, every scheduled task, Payload's Local API for `catalog`'s `ProductDrafts`; the same probes on its own port | Work that waits on other systems or the clock stays out of requests, so a down or slow external system holds no customer request (P15), and a web deploy stops no message in flight. Several instances are safe: deliveries are claimed with `FOR UPDATE SKIP LOCKED`, scheduled tasks take a Postgres advisory lock per task and are idempotent anyway. |
| `migrate` (one-off, before each rollout) | Drizzle migrations of each system's schema, Payload's migrations | Expand-and-contract migrations land before new code, so old and new processes run side by side during a rolling deploy. |

Every system's code is loaded in both `web` and `worker`; each process's assembly builds only
what its driving adapters call into. Systems stay apart in-process by their ports, builders and
database roles, not by process boundaries.

## Directory tree

```
/
├── package.json
├── tsconfig.json
├── biome.json
├── .dependency-cruiser.cjs          # layer and system import rules
├── docker-compose.yml               # postgres, jaeger (local and integration tests)
├── docs/adr/
├── src/
│   ├── shared-kernel/
│   │   ├── money.ts
│   │   ├── sku.ts
│   │   └── tax-class.ts
│   ├── common/                      # common library
│   │   ├── db/                      # pg pool per role, drizzle client, unit of work, versioned save
│   │   ├── messaging/
│   │   │   ├── envelope.ts
│   │   │   ├── outbox-table.ts      # table factory each system's schema uses
│   │   │   ├── processed-messages-table.ts
│   │   │   ├── relay.ts
│   │   │   └── bus.ts               # messaging.deliveries, claim, retry, dead letter
│   │   ├── logging/                 # pino, trace id mixin
│   │   ├── tracing/                 # OpenTelemetry SDK, Jaeger exporter, message propagation
│   │   ├── probes/                  # health and metrics (OpenTelemetry Prometheus exporter)
│   │   ├── scheduling/              # cron runner with advisory locks
│   │   ├── courier.ts               # getApp()
│   │   └── system-clock.ts
│   ├── systems/
│   │   ├── catalog/
│   │   │   ├── domain/
│   │   │   ├── service/
│   │   │   ├── ports/
│   │   │   │   ├── driving.ts
│   │   │   │   └── driven.ts
│   │   │   ├── published-language/
│   │   │   │   ├── events.ts
│   │   │   │   └── open-host-service.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driving/
│   │   │   │   │   ├── http/
│   │   │   │   │   ├── payload-hooks/
│   │   │   │   │   ├── scheduled/
│   │   │   │   │   └── cli/
│   │   │   │   └── driven/
│   │   │   │       ├── drizzle/     # schema.ts, repositories, outbox, outbox reader
│   │   │   │       ├── payload/     # ProductDrafts over the Local API
│   │   │   │       └── fakes/
│   │   │   ├── migrations/
│   │   │   └── builder.ts
│   │   ├── ordering/                # same layout; driving: http, handlers, scheduled, payload-hooks (dashboard), cli
│   │   │                            #   driven: drizzle, payments (CardPayments), mail, fakes
│   │   ├── payments/                # driving: webhooks (Stripe Hook), handlers, scheduled, payload-hooks
│   │   │                            #   driven: drizzle, stripe, bank, fakes
│   │   ├── invoicing/               # driving: handlers, scheduled, payload-hooks, cli
│   │   │                            #   driven: drizzle, mail, pdf, fakes
│   │   └── fulfillment/             # driving: webhooks (warehouse Hook), handlers, scheduled, payload-hooks
│   │                                #   driven: drizzle, warehouse, fakes
│   ├── external/
│   │   └── payload/
│   │       ├── payload.config.ts    # imports Hooks from systems/*/adapters/driving/payload-hooks
│   │       ├── collections/         # products.ts, media.ts, users.ts
│   │       └── admin/               # dashboard view layout; panels are the systems' Hooks
│   └── processes/
│       ├── web/
│       │   ├── app/
│       │   │   ├── (shop)/          # thin route modules calling catalog and ordering adapters
│       │   │   ├── (payload)/       # Payload admin and API
│       │   │   ├── webhooks/stripe/route.ts
│       │   │   ├── webhooks/warehouse/route.ts
│       │   │   └── health/, metrics/
│       │   ├── instrumentation.ts   # OpenTelemetry start
│       │   ├── assembly.ts
│       │   └── config.ts
│       ├── worker/
│       │   ├── main.ts
│       │   ├── assembly.ts
│       │   └── config.ts
│       └── migrate/
│           └── main.ts
├── tooling/
│   ├── cli/                         # dev commands: replay dead letters, inspect outboxes
│   └── seed/
└── test/                            # mirrors src/: default suite over fakes;
    ├── systems/…                    #   *.integration.test.ts against Postgres in a container;
    ├── common/…                     #   *.e2e.test.ts against Stripe test mode, warehouse sandbox, mail sandbox
    └── tooling/architecture.test.ts # asserts the import rules over the source tree
```

## How each property holds

**P1. The domain models the business domain, not what serves it.** `domain/` of each system
holds Product, Order, Invoice, StockItem and their specifications, in `Money`, `Sku`,
`TaxClass` and the system's own terms. It imports nothing but the shared kernel and its own
files: no Drizzle, Payload, Stripe, Next.js, pino or OpenTelemetry. dependency-cruiser rules,
checked by `test/tooling/architecture.test.ts` in the default suite, fail any other import.
The only other model taken is the shared kernel, by choice (P12); no system is conformist.

**P2. A business rule lives in one place: the domain.** Services only sequence: load through
repositories, ask the domain, save, write to the outbox port. Driving adapters only translate
a caller to a driving port; driven adapters only translate a port to a store or an external
system. Payload's configuration holds no business rule of ours: whether a Payload revision is
adopted is `catalog`'s specification `mayAdopt`. VAT exists only in `invoicing`'s domain;
prices everywhere else are gross. The checkout sequence is `ordering`'s Order
(`dueCommands`), not spread across handlers. The slug uniqueness rule is stated in
`mayAdopt`; the unique index in `catalog.products` is only the store's way of turning a race
into a conflict (P10).

**P3. Business rules that change together sit together; rules that change for different
reasons share nothing either would have to change.** The cut follows reasons to change:
merchandising (`catalog`), the order flow (`ordering`), payment providers (`payments`), tax and
accounting law (`invoicing`), logistics (`fulfillment`). Within a system, each aggregate has
its own domain module. Systems share only the shared kernel, which holds values and no rule
any one system changes alone. VAT rates sit with numbering and dunning in `invoicing`; tax
class codes sit in the shared kernel because `catalog` assigns them and `invoicing` prices them.

**P4. A use case responds the same whoever calls it and whatever serves it.** All behaviour
is behind driving ports; the HTTP route, the Hook, the handler, the CLI command and the test
all call the same function. Driving adapters translate and do nothing else. Driven ports
speak the system's terms, so swapping a Drizzle adapter for a fake or Stripe for another
provider changes nothing on the system's side of the port. Each use case's tests run once
over fakes in the default suite; each driven adapter has an integration test or an
end-to-end test against the same port contract.

**P5. A system reaches the outside, and is reached from it, only through its ports; each
port speaks the system's terms.** Every way in is a driving adapter onto a driving port
(HTTP, Hook, handler, scheduled task, CLI); every way out is a driven port (repositories,
outbox port, `CardPayments`, `ProductDrafts`, `Warehouse`, `BankAccount`, `CardPaymentProvider`,
`OrderMails`, `InvoiceMails`, `Clock`, `Ids`). The clock is reached through `Clock`, never
`new Date()` in domain or service. Port signatures carry no vendor type: `CardPaymentProvider`
takes `Money` and an order reference, not a Stripe object; `ProductDrafts` returns
`ProductDraft`, not a Payload document. Assembly is the only place port and implementation
meet. dependency-cruiser forbids `domain/` and `service/` from importing `adapters/`, vendor
packages, or another system; it forbids adapters from importing another system's internals
(only its `published-language/`).

**P6. Every use case can run with nothing outside the process.** Every driven port has a
fake under `adapters/driven/fakes` (repositories over in-memory maps, an in-memory outbox and
`ProcessedMessages`, a fixed `Clock`, fake Stripe, bank, warehouse, mail and Payload drafts).
Each system builder takes `adapters: "real" | "fake"`. The default suite runs every use case
against fakes; the dev CLI can run the whole shop with fakes for every external system.

**P7. A use case's writes to its own system's records land together or not at all.** Each
acting use case runs inside one Drizzle transaction on its system's store; its repositories,
its outbox port and `ProcessedMessages` all write through that transaction. A use case writes
only its own system's records. Work that needs another system's change writes a message
instead (P16). Invoice number, Invoice and `InvoiceIssued` commit in one transaction.

**P8. An uncommitted write is not yet a fact: nothing final follows from it before it
commits, and nothing that follows from it is lost after.** Nothing that follows from a write
is done inside the write's transaction: messages, mails, Stripe refunds, warehouse orders and
SKU registrations are written as messages to the outbox port in that transaction and acted on
only after commit, by a handler. The relay delivers every committed outbox row until it is
marked, so nothing that follows is lost. Hooks answer the webhook with 2xx only after their
use case commits, so Stripe and the warehouse resend otherwise. `startCardPayment` commits the
CardPayment before calling Stripe, and calls it with the CardPayment id as idempotency key, so
a stop between the call and saving the intent reference is repaired by the next call or by
`reconcileCardPayments`; an unconfirmed PaymentIntent is not final. `catalog` adopts a Payload
revision only after Payload committed it (the `afterChange` nudge runs after commit), and
`reconcileProductDrafts` adopts any revision whose nudge was lost. Gapless numbers come from a
NumberSequence row updated in the invoice's own transaction: a rolled-back invoice rolls back
its number.

**P9. A repeated delivery changes nothing in this system.** Every handler hands its use case
the message id; the use case first inserts `(message id, handler)` into `ProcessedMessages`
under a unique key, in its own transaction. A repeat finds the row and changes nothing; a
redelivery while the first attempt still runs blocks on the unique key and finds the row once
the first commits, or proceeds alone if it rolled back. Hooks use the external event id
(Stripe event id, warehouse event id) as message id; `importBankTransactions` keys
BankTransfer by the bank's transaction id. Calls out are made idempotent where the external
system allows (Stripe idempotency key = CardPayment or Refund id; warehouse SKU registration is
a put by sku); where it does not (warehouse outbound order), `submitShipment` first looks up
the Shipment id as client reference and creates only if none exists. Scheduled tasks act only
on state that still calls for it (a dunning level already raised is not raised again). Mail
is at least once: a stop between the send and the commit repeats a mail outside the system,
and no record in the system changes.

**P10. A use case commits only on reads that still hold, or on stale ones a business rule
accepts; use cases fail each other only where a business rule ties them.** Every aggregate
has a `version`; a repository saves with `where id = ? and version = ?` and fails on zero rows;
the service retries the use case from the load (three times), then refuses. Aggregates are
cut so only use cases tied by a business rule meet on one: two reservations of the same `Sku`
meet on its StockItem (no overselling); two invoices meet on the NumberSequence row
(gaplessness; taken with `select … for update`, so they queue rather than fail); two carts or
two orders never meet. Stale reads a business rule accepts: the shop page and the ProductOffer
replica may lag (`isOrderable` decides on the replica, `reserveStock` decides on StockItem);
`placeOrder` refuses when the total from the replica differs from `expectedTotal`, the total
the customer reviewed.

**P11. No other system changes the records a system owns.** Each system has a Postgres role
with write privileges only on its own schema; Payload has its own role on `payload`; the relay
and bus have a role on `messaging` and may only read and mark outboxes. Another system's
records change only by that system's own use case, reached through its driving ports or its
handlers. `catalog` never writes Payload's documents and Payload never writes `catalog`'s
products. ProductOffer and the warehouse stock replica are their keeper's records; what they
copy stays the owner's to decide.

**P12. Another system's model enters this one only by choice.** Every relationship is an
anti-corruption layer: a downstream's handlers and driven adapters parse the upstream's
published language and translate it into the downstream's terms; nothing past those adapters
sees it. Stripe, the warehouse API, the bank API, the mail provider and Payload stop at their
adapters. The one model taken into domains is the shared kernel, an explicit choice. A new
conformist relationship takes an ADR.

**P13. A system changes its model without its downstream systems changing.** The published
language is separate from the domain: `published-language/` holds versioned schemas, and the
system's adapters map its domain onto them. A domain change changes the mapping, not the
schema. A schema change that breaks adds `.v2` beside `.v1`; the upstream writes both until
every downstream handles `.v2`, then stops `.v1`. The open host service's driving ports
(`startCardPayment`, `browseShop`) keep their input and output schemas the same way.

**P14. A record or a message means the same to all code that reads it, whenever it was
written.** A message type carries its version in its name and never changes meaning; a
handler accepts every version still in an outbox or in `messaging.deliveries`. Records change
only by expand-and-contract migrations run by `migrate` before rollout: add, backfill, switch
readers, drop in a later release; a column never changes meaning in place, so old and new
processes during a rolling deploy read each record the same. Snapshots (price, tax class,
addresses on Order; lines on Invoice) are facts that never get reinterpreted by later
rule changes; VAT rates carry effective dates so an old invoice's VAT means what it meant.

**P15. A system works while others are down or slow, as far as its own data reaches.**
Systems tell each other things by messages, so a writer never waits for its readers.
`ordering` checks out from its ProductOffer replica, not from `catalog` or `fulfillment`;
`invoicing` issues from what `IssueInvoice` carries. The shop page is served with
`Cache-Control: s-maxage=60, stale-while-revalidate=86400`. External calls happen in the
worker with timeouts and retries with backoff, never in a customer request, except
`startCardPayment`, which can only work while Stripe does; invoice checkout still works then.
Webhooks only record and commit. A system down or slow leaves its messages waiting in outboxes
and `messaging.deliveries`; they are handled when it returns.

**P16. No transaction spans two systems.** Each system builder opens its own pool on its own
role; a unit of work belongs to one system and cannot write another schema. Cross-system work
is a saga of messages (P17). `catalog`'s Hooks never join Payload's transaction (no
`req.transactionID` passed on). The relay reads and marks an outbox and inserts deliveries in
separate transactions; a repeated fan-out is absorbed by `on conflict do nothing` on
`(message id, subscription)`.

**P17. Work spanning systems ends, and only in a state a business rule allows.** Checkout,
cancellation and refund are a saga orchestrated by `ordering`'s Order, the process manager:
each waiting state has a deadline in the Order, and `expireOrderDeadlines` moves an Order past
its deadline on to its compensation (release, refund, credit note, cancel). Each command's
receiver publishes an outcome, whether it acted or refused. Reservations are a tentative
operation with a hold-until that `fulfillment` expires itself even if `ordering` never
confirms. Invoices end paid, credited, or exhausted by dunning, which `ordering` turns into a
cancellation. A delivery that fails after its retries goes to the dead letter and an alert;
the Order's deadline still fires. The states Order may end in are listed by the domain:
shipped, cancelled, refunded, and `refundFailed`, which the business accepts as an admin task
shown on the dashboard.

**P18. The order messages arrive in does not change the outcome.** Order's state is the set
of facts received, and `dueCommands` is a function of that set, so `CardPaymentSucceeded`
before or after `StockReserved` leads to the same commands, written once (the Order records
which it wrote). A fact arriving after a terminal state has a fixed answer (payment after
cancellation → `RefundPayment`). Replica updates carry the owner's `sequence`; ProductOffer
and the warehouse stock replica apply an update only when its sequence is above the one
stored. `matchBankTransfer` sums transfers per invoice, so their order does not matter.

## Decisions the document left to me

1. **Which systems.** Five: `catalog`, `ordering`, `payments`, `invoicing`, `fulfillment`, cut
   by reason to change. Bore on it: "A system is one bounded context. It is code with its own
   domain and its own glossary."; "Business rules that change together sit together; rules
   that change for different reasons share nothing either would have to change"; "Business
   rules change, the model grows, the cut between systems moves."
2. **Payload as an external system, upstream of `catalog`, behind an anti-corruption layer;
   `catalog` keeps its own Product records.** Payload owns its documents; `catalog` adopts
   published revisions into its own records and refuses those its rules reject, without
   vetoing Payload's save. Bore on it: "**External system.** A bounded context whose code this
   codebase does not write, though it may configure it: bought or adopted, run by its vendor or
   by us, in its own process or in ours."; "**Owner.** The system whose business rules decide
   what a record holds, wherever it is kept"; "No other system changes the records a system
   owns"; "A business rule lives in one place: the domain".
3. **Editor feedback on a refused revision is shown after save, not by blocking the save.**
   A blocking `beforeChange` would make `catalog`'s rules decide what Payload's documents
   hold, making `catalog` their owner while Payload writes them. Bore on it: "**Owner.** The
   system whose business rules decide what a record holds, wherever it is kept"; "No other
   system changes the records a system owns".
4. **Orchestration, with `ordering`'s Order as process manager.** Bore on it:
   "**Orchestration.** One system's *process manager* holds the sequence across systems: an
   aggregate whose state is where the sequence stands. Each step is a use case of that system
   that sends commands to the others."; "Work spanning systems ends, and only in a state a
   business rule allows".
5. **A command's outcome comes back as an event the receiver publishes, acted or refused.**
   Bore on it: "A *command* says do this, to the one system that offers it, which may refuse."
6. **Bus and relay on Postgres** (`messaging.deliveries`, claimed with `for update skip
   locked`, retried with backoff, dead letter after 10 attempts), no broker. Bore on it:
   "**Bus.** What delivers a message to the handlers subscribed to it. Assembly hands it the
   handlers."; "**Relay.** The mechanism that reads outboxes and hands each message to the bus.
   Assembly hands it the outbox readers."; the brief names one Postgres instance and no broker.
7. **One schema and one role per system in the one Postgres instance, so each system is its
   own store.** Bore on it: "**Store.** What lies behind one or more driven ports whose writes
   can be committed in one transaction. Two clients are one store when their writes commit
   together, two stores until they do."; "No transaction spans two systems"; "A store may keep
   records of several owners."
8. **Processes: `web`, `worker`, one-off `migrate`.** Bore on it: "run as one or more
   processes"; "A deploy replaces processes one at a time, and records and messages outlive the
   code that wrote them."
9. **Gapless numbers by a NumberSequence row locked and updated in the invoice's
   transaction**, one sequence per document kind and year. Bore on it: "A use case's writes to
   its own system's records land together or not at all"; "use cases fail each other only
   where a business rule ties them".
10. **Prices are gross; VAT is computed only by `invoicing`.** Bore on it: "A business rule
    lives in one place: the domain".
11. **Shared kernel: `Money`, `Sku`, `TaxClass` codes.** Bore on it: "**Shared kernel.** A
    model several systems of this codebase share as code and agree on together, each importing
    it into its domain: `Money`, `Sku`. A change to it is a change to each."
12. **`ordering` keeps a ProductOffer replica (catalog products and fulfillment
    availability).** Bore on it: "**Replica.** A copy of another system's data, kept under the
    owner's ids and shaped as this system writes it"; "A system works while others are down or
    slow, as far as its own data reaches".
13. **`placeOrder` takes the reviewed total and refuses on a difference.** Bore on it: "A use
    case commits only on reads that still hold, or on stale ones a business rule accepts".
14. **Optimistic concurrency by aggregate version, three retries.** Bore on it: the same
    sentence of P10, and "**Aggregate.** A cluster of records changed as one unit and addressed
    by one id; a repository loads and saves it whole."
15. **Every call out with a side effect follows a private command, never the writing
    transaction.** Bore on it: "nothing final follows from it before it commits, and nothing
    that follows from it is lost after"; "*Private*: meant only for the system that wrote it."
16. **Mail is at least once; each system sends its own mails through its own port; no
    notifications system.** Bore on it: "A repeated delivery changes nothing in this system".
17. **Two mails at checkout: `ordering`'s order confirmation, `invoicing`'s invoice mail.**
    Bore on it: none.
18. **Card orders get an invoice too, issued paid.** Bore on it: none.
19. **Payments owns both card payments and incoming bank transfers; `invoicing` matches
    transfers to invoices.** Bore on it: none.
20. **Bank API is polled by a scheduled task.** Bore on it: "**Scheduled task.** A driving
    adapter the clock calls."; "An external system holds none of these properties, and its
    contract follows its own model".
21. **Reservation before payment is not required; card payment may start right after
    placement.** Bore on it: "The order messages arrive in does not change the outcome".
22. **Deadlines and schedules:** card payment window 30 minutes, card reservation hold 1 hour,
    invoice due 14 days, reminders at due + 7 and + 21 days, dunning exhausted at + 35 days,
    invoice reservation hold 45 days. Bore on it: "Work spanning systems ends, and only in a
    state a business rule allows".
23. **Refunds are full refunds of a shipped or paid order, started by an admin; bank-transfer
    refunds go out through the bank API to the payer IBAN.** Bore on it: none.
24. **Guest checkout; customer data snapshotted on Order.** Bore on it: "**Snapshot.** A
    value an aggregate copies from another aggregate or from a message when a use case needs it,
    and keeps as its own fact from then on".
25. **The admin dashboard is Payload custom views; each panel is a Hook of the system whose
    data it shows**, calling that system's answering driving ports. Bore on it: "**Hook.** A
    driving adapter an upstream system calls."; "A *driving adapter* adapts one caller to a
    driving port."
26. **Cached shop page by HTTP cache headers (CDN plus Next.js), not a replica.** Bore on it:
    "Out of scope: throughput and load, security, user interfaces."
27. **Courier: `getApp()`, a per-process ambient value; trace context per request through
    OpenTelemetry context.** Bore on it: "**Courier.** How a driving adapter reaches what
    assembly produced when assembly cannot hand it over as an argument."; "**Ambient value.**"
    (both scopes).
28. **Probes in the common library, served by both processes; metrics through OpenTelemetry's
    Prometheus exporter, traces to Jaeger.** Bore on it: "**Probe.** Code a process runs to
    report on itself rather than on a system".
29. **Fakes live in `src/systems/*/adapters/driven/fakes`, tests under `test/`.** Bore on it:
    "**Fake.** A working implementation of a port that reaches nothing outside the process".
30. **No conformist relationship; anti-corruption layer everywhere.** Bore on it: "Another
    system's model enters this one only by choice".
31. **Message envelope, versions in type names, expand-and-contract migrations.** Bore on it:
    "A record or a message means the same to all code that reads it, whenever it was written".
32. **Import rules enforced by dependency-cruiser in a default-suite test.** Bore on it:
    "Edits are partial. People and agents change code having read only part of it."; "**Tooling.**
    Code that runs in no process of the deployed application: … a test that asserts about the
    source tree."
33. **Payload 3, hence Next.js as `web`'s HTTP stack.** Bore on it: none.
34. **`ProcessedMessages` as a per-system driven port, written in the use case's transaction.**
    Bore on it: "It has an id, the same on every delivery of it."; "A repeated delivery changes
    nothing in this system".
35. **Product id is the `Sku`; a published product's sku never changes.** Bore on it:
    "**Replica.** … kept under the owner's ids".
36. **Scheduled tasks guarded by advisory locks in a multi-instance worker.** Bore on it: none.
37. **Dead letter after retries, alert, manual replay by a dev CLI command.** Bore on it:
    "Other systems fail. Another system can be down, slow, or fail after it said yes."

## Sentences I had to pick a reading for

1. "Its configuration may hold business rules this codebase writes, in the external system's
   terms; its architecture stays its own." Read with P2, "A business rule lives in one place:
   the domain". Reading A: Payload's configuration may hold a rule's code, an exception to P2.
   Reading B: it may hold a rule only as a call into one system's domain. Took: neither is
   needed here; Payload's configuration holds no rule of ours, and if one were needed it would
   be B.
2. "**Owner.** The system whose business rules decide what a record holds, wherever it is
   kept". Reading A: a system whose rule vetoes a write to another's record thereby owns it.
   Reading B: only the system whose rules compute or set the content owns it. Took A, which is
   why `catalog` does not veto Payload's save (decision 3).
3. "Two clients are one store when their writes commit together, two stores until they do."
   Reading A: "commit together" means they actually do in this code. Reading B: they could,
   being one database. Took A: one Postgres instance with a role per system is five stores
   plus Payload's.
4. "Each use case either acts or answers." Reading A: an acting use case returns nothing.
   Reading B: an acting use case may return what its caller needs to continue. Took B
   (`startCardPayment` returns a client secret; `placeOrder` returns the order id).
5. "A repeated delivery changes nothing in this system". Reading A: nothing in this system's
   records. Reading B: nothing this system causes, outside included. Took A; mail is at least
   once, and calls out use idempotency keys where the external system offers them.
6. "A *command* says do this, to the one system that offers it, which may refuse." Reading A:
   the refusal goes back synchronously to the sender. Reading B: the receiver records the
   refusal and tells it as an event. Took B.
7. "The *outbox reader* is what the relay reads the outbox through, and marks it by; the
   system provides it, and for an external system's outbox, assembly does." Reading A: an
   external system's event feed (Stripe's events list) should be read as its outbox by the
   relay. Reading B: only an external system that keeps an outbox in a store we reach has one.
   Took B; Stripe and the warehouse reach us through Hooks, missed ones are caught by
   reconciliation.
8. "**Hook.** A driving adapter an upstream system calls." Reading A: only external callbacks
   (webhooks, Payload hooks). Reading B: anything an upstream invokes, including Payload's
   admin rendering a dashboard panel for a person. Took B.
9. "Every use case can run with nothing outside the process". Reading A: in tests, with fakes.
   Reading B: in production, with nothing reachable. Took A; `startCardPayment` needs Stripe in
   production.
10. "A system works while others are down or slow, as far as its own data reaches." Reading A:
    card checkout must keep working with Stripe down. Reading B: what needs Stripe's answer may
    stop; the rest works. Took B.
11. "**Process manager** … an aggregate whose state is where the sequence stands. Each step is
    a use case of that system that sends commands to the others." With "It holds no business
    rule of its own; … What it holds is the sequence within one use case". Reading A: which
    command is next is the service's sequence. Reading B: it is a business rule of the
    aggregate, and the service only writes what the aggregate says is due. Took B
    (`dueCommands` in the domain).
12. "use cases fail each other only where a business rule ties them". Reading A: a unique
    index enforcing a rule is a second place for the rule (against P2). Reading B: it only
    detects the race the rule makes a conflict. Took B (slug).
13. "**Shared kernel.** … `Money`, `Sku`." Reading A: the examples are the whole kernel.
    Reading B: they are examples. Took B and added `TaxClass` codes.
14. "A *driving port* … names one use case the system offers". Reading A: one interface per
    use case. Reading B: one interface per caller grouping several use cases. Took A.
15. "**Scheduled task.** A driving adapter the clock calls." Reading A: the clock calls it once
    per tick across the deployment. Reading B: once per process. Took B, guarded by an advisory
    lock and idempotent use cases.
16. "**Tentative operation.** … It changes nothing it asks for: its confirmation does." Reading
    A: a stock reservation is tentative because warehouse stock changes only on shipping.
    Reading B: a reservation already changes availability, so it is not tentative. Took A:
    on-hand stock changes on `ShipOrder`; availability is a derived value.
17. "**Replica.** … It is refreshed from what the owner publishes or returns to it". Reading
    A: a warehouse stock replica refreshed by our reconciliation polling counts. Reading B:
    only pushed updates. Took A.
