# Fresh repository draft A, raw set

Online tea shop. TypeScript on Node, Payload CMS, one Postgres instance, Drizzle, Stripe, a
warehouse API, a bank API, a mail provider, pino, OpenTelemetry to Jaeger.

## Systems and what each owns

Five systems this codebase writes, five external systems, one shared kernel.

### Systems this codebase writes

| System | Owns (aggregates) | Changes when |
|---|---|---|
| **catalog** | `Product` (published product: slug, name, copy, image URLs, sku, gross price, tax class, catalog version), `SkuClaim` (one per sku, which product holds it) | merchandising rules change: what may be published, sku rules |
| **ordering** | `Cart`, `Order` (the process manager of an order's whole sequence), `ProductReplica` (replica of catalog products plus fulfillment availability, ordering's records) | checkout and order-lifecycle rules change |
| **payments** | `CardPayment` (one per Stripe PaymentIntent), `BankTransaction` (one per booked incoming bank transaction), `Refund`, `BankImportCursor` | how money moves: card capture, voids, refunds, bank import |
| **billing** | `Invoice`, `InvoiceNumberSeries` (one per year), `CreditNote`, `CreditNoteNumberSeries` (one per year), `UnmatchedTransfer` | tax and accounting rules change: VAT rates per tax class, numbering, dunning, credit notes |
| **fulfillment** | `StockItem` (one per sku: on-hand replica of the warehouse, held quantity, version), `Reservation` (one per order), `Shipment` (one per order), `SkuRegistration` (one per sku) | stock and shipping rules change, warehouse partner changes |

Product edits (copy, images, slug, price, sku, tax class as typed by editors) are **not** a
system of ours: they are records of the external system Payload (see below). Catalog owns only
what it published from them.

The admin dashboard is not a system: it is a set of driving adapters, one per system, arranged on
one Payload admin page (Decisions D12).

### External systems

| External system | Process | Relationship |
|---|---|---|
| **cms** (Payload CMS) | in ours (web and worker), run by us, configured by us | upstream of catalog; catalog is an anti-corruption layer toward it |
| **Stripe** | its vendor's | upstream of payments; payments is an anti-corruption layer toward it |
| **warehouse partner** | its vendor's | upstream of fulfillment; fulfillment is an anti-corruption layer toward it |
| **bank** | its vendor's | upstream of payments; anti-corruption layer |
| **mail provider** | its vendor's | upstream of ordering and billing; each is an anti-corruption layer toward it |

Postgres is a store, the clock is outside, Jaeger is reached only through the tracer of the common
library.

### Shared kernel

`src/kernel/`: `Money` (EUR minor units, integer arithmetic, rounding), `Sku` (format and
equality), `TaxClass` (`standard` | `reduced`, the names only; rates are billing's business rule).
Imported into the domains of catalog, ordering, billing and fulfillment.

### Upstream/downstream

- catalog upstream of ordering (ordering handles catalog events) and of fulfillment (fulfillment
  handles catalog events).
- fulfillment upstream of ordering (ordering sends its commands, handles its events).
- payments upstream of ordering (ordering calls its open host service, sends its commands,
  handles its events) and of billing (billing handles its events).
- billing upstream of ordering (ordering sends its commands, handles its events).
- ordering upstream of no one; it publishes no events.

Every downstream system is an anti-corruption layer toward each upstream; there is no conformist
relationship. The shared kernel is the only model shared as code.

### Stores

One Postgres instance, one schema per system (`catalog`, `ordering`, `payments`, `billing`,
`fulfillment`) plus `cms` for Payload. Each system's builder creates its own Drizzle client over
its own pool, logging in as its own database role with privileges on its own schema only. By the
glossary these are six stores: no two clients' writes commit together. All driven ports of one
system that write share that system's client, so they form one store.

## Ports and adapters

Common to every system:

- **Driving ports**: `ports/driving.ts`, one interface per use case, typed in the system's terms;
  each says whether it acts or answers. The service is the factory for each.
- **Driven ports** always present: `UnitOfWork` (opens one transaction on the system's store and
  hands the use case its repositories, `Outbox` and `Inbox` bound to it), one **repository** per
  aggregate, the **outbox port** `Outbox` (takes messages in the system's terms), `Inbox` (records
  a handled message id), `Clock`.
- **Driven adapters**: `adapters/driven/postgres/` (Drizzle), `adapters/driven/fake/` (a fake per
  driven port: in-memory maps with the same optimistic-version conflicts and the same
  all-or-nothing transaction as the Postgres adapters), and one folder per external system.
- **Driving adapters**: handlers (one per subscribed message type), hooks (one per upstream call
  into the system), scheduled tasks, server functions and server components (web), Payload
  admin views.
- **Outbox reader**: `adapters/driven/postgres/outbox-reader.ts`, provided by the system.
- **Open host service and published language**: `published/v1/` (zod schemas and types of the
  open host service's driving ports, published events, commands taken, refusal errors). Never
  derived from domain types; mapped to and from them in adapters.

### catalog

- Driving ports, acting: `publishProductRevision`, `withdrawProduct`, `reconcileWithCms`.
- Driving ports, answering: `listPublishedProducts`, `getPublishedProduct(slug)`,
  `reviewProductDraft(draft)`, `getRevisionVerdict(productId)`.
- Open host service: `listPublishedProducts`, `getPublishedProduct`.
- Driven ports: `ProductRepository`, `SkuClaimRepository`, `Outbox`, `Inbox`, `UnitOfWork`,
  `CmsProducts` (reads cms's published product documents, in catalog's terms), `Clock`.
- Driven adapters: Postgres; `cms/payload-products.ts` over the Payload Local API (translates
  Payload documents and Lexical rich text to catalog's `ProductRevision`, copy as HTML); fakes.
- Driving adapters: handlers `cms-product-published.handler.ts`,
  `cms-product-unpublished.handler.ts` (hooks in effect: the upstream cms writes them, translated
  here); hook `cms-verdict-field.tsx` (a Payload UI field server component Payload renders on the
  product edit page, calls `reviewProductDraft` and `getRevisionVerdict`); server components
  `shop-page.ts` (shop listing and product pages); scheduled task `reconcile-cms.scheduled.ts`.

### ordering

- Driving ports, acting: `addToCart`, `changeCartLine`, `removeCartLine`, `placeOrder(cartId,
  customer, paymentMethod, expectedTotal)`, `recordProductPublished`, `recordProductWithdrawn`,
  `recordAvailability`, `recordSkuRegistered`; process manager steps `recordStockReserved`,
  `recordStockRefused`, `recordReservationReleased`, `recordCardAuthorized`, `recordCardFailed`,
  `recordCardCaptured`, `recordCaptureFailed`, `recordCardVoided`, `recordInvoiceIssued`,
  `recordInvoiceRefused`, `recordInvoicePaid`, `recordInvoiceDefaulted`, `recordShipped`,
  `recordRefundSucceeded`, `recordRefundFailed`, `recordCreditNoteIssued`; admin `cancelOrder`,
  `refundOrder(orderId, lines)`; `expireStalledOrders`; `sendOrderMail` (private message).
- Driving ports, answering: `getCart`, `getOrderForCustomer(orderId, accessToken)`, `listOrders`,
  `getOrder`.
- Driven ports: `CartRepository`, `OrderRepository`, `ProductReplicaRepository`, `Outbox`,
  `Inbox`, `UnitOfWork`, `CardPayments` (open a card payment for an order, in ordering's terms),
  `OrderMailer`, `Clock`, `IdGenerator`.
- Driven adapters: Postgres; `payments/card-payments.ts` (calls payments' open host service
  in-process, translates); `outbox/command-mappers.ts` (maps ordering's outgoing intents to
  fulfillment's, payments' and billing's published commands); `mail/` over the mail provider's
  API; fakes.
- Driving adapters: server functions `cart.actions.ts`, `checkout.actions.ts`; server component
  `order-status.ts`; handlers for each catalog, fulfillment, payments and billing event it
  subscribes to and for its private `SendOrderMail`; scheduled task
  `expire-stalled-orders.scheduled.ts`; admin view `orders.view.tsx` (list, detail, cancel,
  refund).

### payments

- Driving ports, acting: `openCardPayment(reference, amount, email)` (open host service),
  `recordCardPaymentChange(intentId)`, `capturePayment`, `voidPayment`, `refundPayment`,
  `executeRefund` (private), `importBankTransactions`, `reconcileCardPayments`.
- Driving ports, answering: `getCardPayment`, `listPayments`, `listBankTransactions`.
- Driven ports: `CardPaymentRepository`, `BankTransactionRepository`, `RefundRepository`,
  `BankImportCursorRepository`, `Outbox`, `Inbox`, `UnitOfWork`, `CardProcessor` (create intent
  with manual capture, capture, cancel, refund, get current state, list changed since),
  `BankAccount` (list booked transactions since, initiate outgoing transfer, get transfer
  status), `Clock`.
- Driven adapters: Postgres; `stripe/` (Stripe SDK, idempotency keys); `bank/` (bank API);
  fakes.
- Driving adapters: hook `stripe-webhook.ts` (signature check, translates the Stripe event to an
  intent id, calls `recordCardPaymentChange`); handlers for commands `CapturePayment`,
  `VoidPayment`, `RefundPayment` and private `ExecuteRefund`; scheduled tasks
  `import-bank.scheduled.ts`, `reconcile-stripe.scheduled.ts`; admin view `payments.view.tsx`.

### billing

- Driving ports, acting: `issueInvoice`, `cancelInvoice`, `issueCreditNote` (commands),
  `recordBankTransfer` (event), `assignTransfer` (admin), `sendDueReminders` (scheduled),
  `mailInvoiceDocument` (private: invoice, reminder, credit note).
- Driving ports, answering: `listInvoices`, `getInvoice`, `renderInvoiceDocument`,
  `listCreditNotes`, `listUnmatchedTransfers`.
- Driven ports: `InvoiceRepository`, `InvoiceNumberSeriesRepository`, `CreditNoteRepository`,
  `CreditNoteNumberSeriesRepository`, `UnmatchedTransferRepository`, `Outbox`, `Inbox`,
  `UnitOfWork`, `DocumentRenderer` (invoice and credit note as PDF), `BillingMailer`, `Clock`.
- Driven adapters: Postgres; `pdf/` (PDF library); `mail/` (mail provider); fakes.
- Driving adapters: handlers for `IssueInvoice`, `CancelInvoice`, `IssueCreditNote`,
  payments' `BankTransferReceived`, private `MailBillingDocument`; scheduled task
  `send-reminders.scheduled.ts`; admin view `invoices.view.tsx` (list, document download, assign
  unmatched transfer).

### fulfillment

- Driving ports, acting: `registerSku` (event), `submitSkuRegistration` (private),
  `reserveStock`, `releaseReservation`, `requestShipment` (commands), `submitShipment` (private),
  `recordShipmentShipped`, `recordStockLevel` (warehouse hooks), `reconcileWithWarehouse`.
- Driving ports, answering: `listShipments`, `getShipment`, `listStock`.
- Driven ports: `StockItemRepository`, `ReservationRepository`, `ShipmentRepository`,
  `SkuRegistrationRepository`, `Outbox`, `Inbox`, `UnitOfWork`, `Warehouse` (register sku,
  create shipment by our reference, find shipment by our reference, get stock levels), `Clock`.
- Driven adapters: Postgres; `warehouse/` (warehouse API); fakes.
- Driving adapters: hook `warehouse-webhook.ts`; handlers for catalog's `ProductPublished`,
  commands `ReserveStock`, `ReleaseReservation`, `ShipOrder`, private `SubmitSkuRegistration`,
  `SubmitShipment`; scheduled task `reconcile-warehouse.scheduled.ts`; admin view
  `shipments.view.tsx`.

### cms (external system, our configuration)

- Collections `products` (drafts and versions enabled), `media`, `users`, hidden `outbox`.
- `afterChange` hook on `products` writes one `outbox` document per published or unpublished
  version, through `req`, so inside Payload's own transaction. No business rule in the
  configuration: field types and `required` only.
- Its outbox reader is provided by the worker's assembly (`processes/worker/cms-outbox-reader.ts`)
  over the `cms` schema.

### Assembly, system builders, courier

- Each system has one system builder, `builder.ts`: takes `{ databaseUrl, role, apiKeys, logger,
  tracer, clock }`, returns `{ services, handlers, scheduledTasks, outboxReader, adminViews }`.
  `services` implement the driving ports; nothing else of the system is exported.
- Assembly: `processes/web/assembly.ts` and `processes/worker/assembly.ts`. Only there do ports
  meet implementations (the system builder's internals pick Postgres adapters; tests pick fakes
  through the same builder with `{ store: "fake" }`).
- Courier in web: per-process ambient value `courier.get()` holding the assembled container,
  built once (memoized promise) from `instrumentation.ts`; per-request ambient value
  (AsyncLocalStorage) holding request id and trace context. Server functions, server components,
  route handlers and Payload components reach services only through the courier.
- Worker: assembly hands handlers to the bus and outbox readers to the relay as arguments; only
  the per-request ambient value (message id, trace context) is used.

## Calls and messages

### Synchronous calls (in-process, through driving ports)

| Caller | Called | Use case |
|---|---|---|
| browser → web server components | catalog | `listPublishedProducts`, `getPublishedProduct` (cached, see D24) |
| browser → web server functions | ordering | cart use cases, `placeOrder`, `getOrderForCustomer` |
| ordering (`CardPayments` driven adapter) | payments open host service | `openCardPayment` (inside `placeOrder` for card orders, before ordering commits) |
| Payload admin (UI field) | catalog | `reviewProductDraft`, `getRevisionVerdict` |
| Payload admin (dashboard views) | ordering, payments, billing, fulfillment | answering use cases; `cancelOrder`, `refundOrder`, `assignTransfer` |
| Stripe → `/api/webhooks/stripe` | payments | `recordCardPaymentChange` |
| warehouse → `/api/webhooks/warehouse` | fulfillment | `recordShipmentShipped`, `recordStockLevel` |
| clock → worker scheduler | each system | scheduled tasks |

Outward calls through driven adapters: Stripe API (payments), bank API (payments), warehouse API
(fulfillment), mail provider (ordering, billing), Payload Local API (catalog, reconciliation
only), Postgres (all), OTLP exporter to Jaeger (common library).

### Messages

Envelope (common library): `{ id, type, version, occurredAt, traceparent, payload }`. Commands
carry the issuing aggregate's reference as correlation id.

| Message | Kind | Written by | Handled by |
|---|---|---|---|
| `cms.ProductPublished` / `cms.ProductUnpublished` | published event (external system's outbox) | cms `afterChange` | catalog |
| `catalog.ProductPublished` (full state, `catalogVersion`) | published event | catalog | ordering (replica), fulfillment (sku registration) |
| `catalog.ProductWithdrawn` | published event | catalog | ordering |
| `catalog.RevisionRefused` | private event | catalog | none; kept for the verdict field |
| `fulfillment.ReserveStock` | published command | ordering (offered by fulfillment) | fulfillment |
| `fulfillment.ReleaseReservation` | published command | ordering | fulfillment |
| `fulfillment.ShipOrder` | published command | ordering | fulfillment |
| `fulfillment.StockReserved` / `StockReservationRefused` / `ReservationReleased` / `ReleaseRefused` | published events | fulfillment | ordering |
| `fulfillment.OrderShipped` | published event | fulfillment | ordering |
| `fulfillment.SkuRegistered` / `AvailabilityChanged` | published events | fulfillment | ordering (replica) |
| `fulfillment.SubmitSkuRegistration` / `SubmitShipment` | private commands | fulfillment | fulfillment |
| `payments.CapturePayment` / `VoidPayment` / `RefundPayment` | published commands | ordering | payments |
| `payments.CardAuthorized` / `CardFailed` / `CardCaptured` / `CaptureFailed` / `CardVoided` | published events | payments | ordering |
| `payments.BankTransferReceived` | published event | payments | billing |
| `payments.RefundSucceeded` / `RefundFailed` | published events | payments | ordering |
| `payments.ExecuteRefund` | private command | payments | payments |
| `billing.IssueInvoice` / `CancelInvoice` / `IssueCreditNote` | published commands | ordering | billing |
| `billing.InvoiceIssued` / `InvoiceRefused` / `InvoicePaid` (carries settling bank transaction ids) / `InvoiceDefaulted` / `CreditNoteIssued` | published events | billing | ordering |
| `billing.MailBillingDocument` | private command | billing | billing |
| `ordering.SendOrderMail` | private command | ordering | ordering |

A refused command is answered by an event of the system that offers it (`...Refused`).

### The order sequence (orchestration, `Order` is the process manager)

Card:
1. `placeOrder`: domain checks cart against `ProductReplica` (published, registered, available),
   compares `expectedTotal`, snapshots lines (sku, quantity, gross price, tax class). Calls
   `CardPayments.open` (payments creates a PaymentIntent with manual capture: tentative). Commits
   `Order(awaitingPayment)`, empty `Cart`, `ReserveStock` in one transaction. Returns order id and
   client secret.
2. Customer confirms in Stripe Elements. Stripe webhook → `CardAuthorized`.
3. `StockReserved` and `CardAuthorized`, in either order, are recorded as facts; when both hold,
   the step sends `CapturePayment`.
4. `CardCaptured` → `Order(paid)`: `IssueInvoice` (settled by card), `ShipOrder`, `SendOrderMail`
   (confirmation).
5. `OrderShipped` → `Order(shipped)`.
Undo: `StockReservationRefused` → `VoidPayment`, `SendOrderMail` (cancelled, not charged);
`CardFailed`, authorization deadline passed or `CaptureFailed` → `ReleaseReservation`,
cancelled.

Invoice by bank transfer:
1. `placeOrder` → `Order(awaitingStock)`, `ReserveStock`.
2. `StockReserved` → `IssueInvoice` (due in 14 days) → `InvoiceIssued` → `SendOrderMail`
   (confirmation with payment instructions); billing mails the invoice document.
3. payments' `importBankTransactions` → `BankTransferReceived` → billing matches by invoice
   number in the remittance text → `InvoicePaid` → `Order(paid)`, `ShipOrder`.
4. Reminders: billing's scheduled task at due+7, due+14; at due+28 `InvoiceDefaulted` →
   `ReleaseReservation`, `CancelInvoice` (billing issues a cancelling credit note) → cancelled.

Refund (admin): `refundOrder` → `RefundPayment` (card: Stripe refund; bank: outgoing transfer to
the payer's account from `BankTransaction`) → `RefundSucceeded` → `IssueCreditNote` →
`CreditNoteIssued` → refunded. `RefundFailed` → order shows `refundFailed`, admin retries or
records an off-system refund.

## Processes

| Process | Runs | Why |
|---|---|---|
| **web** (Next.js app hosting Payload 3) | Payload admin and dashboard, shop pages, cart and checkout server functions, Stripe and warehouse webhooks, probes `/health`, `/ready`, `/metrics`. Assembly builds the services of all five systems (no relay, no bus, no scheduled tasks) and Payload. | Request-driven, scaled by requests; Payload is a Next.js app so its admin and the shop share one runtime; webhooks need a public HTTP endpoint. |
| **worker** (plain Node) | relay over six outbox readers (five systems plus cms), bus with every handler, scheduler with every scheduled task, Payload Local API (catalog's reconciliation), probes on a small HTTP server. Assembly builds all five systems. | Delivery and scheduled tasks must not depend on a request's lifetime or be killed with a serverless timeout; one or more instances, any may stop at any instruction (F4). |

Tooling, not deployed: `tooling/migrate.ts` (Drizzle migrations per schema plus Payload
migrations; expand before rollout, contract after), `tooling/seed.ts`, architecture tests.

Several worker instances may run: the relay claims rows with `FOR UPDATE SKIP LOCKED` and a lease;
each scheduled task takes a Postgres advisory lock per run and its use case is idempotent per
period.

## Directory tree

```
tea-shop/
├── package.json
├── tsconfig.json
├── biome.json
├── drizzle.config.ts
├── src/
│   ├── kernel/                          # shared kernel
│   │   ├── money.ts
│   │   ├── sku.ts
│   │   └── tax-class.ts
│   ├── common/                          # common library
│   │   ├── db/client.ts                 # pool + drizzle per system role
│   │   ├── db/unit-of-work.ts           # transaction + optimistic version helpers
│   │   ├── messaging/envelope.ts
│   │   ├── messaging/outbox-table.ts    # table factory each system instantiates in its schema
│   │   ├── messaging/inbox-table.ts
│   │   ├── messaging/relay.ts
│   │   ├── messaging/bus.ts
│   │   ├── logging/logger.ts            # pino
│   │   ├── tracing/tracer.ts            # OpenTelemetry, OTLP to Jaeger
│   │   ├── metrics/meter.ts             # OpenTelemetry metrics, Prometheus reader
│   │   ├── courier/courier.ts           # per-process + per-request ambient values
│   │   ├── scheduling/scheduler.ts
│   │   ├── probes/probes.ts
│   │   └── result.ts
│   ├── external/
│   │   └── cms/                         # Payload: external system, our configuration
│   │       ├── payload.config.ts
│   │       ├── collections/products.ts
│   │       ├── collections/media.ts
│   │       ├── collections/users.ts
│   │       ├── collections/outbox.ts
│   │       ├── hooks/write-outbox.ts
│   │       ├── published/v1/messages.ts # cms.ProductPublished, cms.ProductUnpublished
│   │       └── migrations/
│   ├── systems/
│   │   ├── catalog/
│   │   │   ├── glossary.md
│   │   │   ├── domain/
│   │   │   │   ├── product.ts
│   │   │   │   ├── product-revision.ts
│   │   │   │   ├── sku-claim.ts
│   │   │   │   └── specifications.ts
│   │   │   ├── service/
│   │   │   │   ├── publish-product-revision.ts
│   │   │   │   ├── withdraw-product.ts
│   │   │   │   ├── review-product-draft.ts
│   │   │   │   ├── get-revision-verdict.ts
│   │   │   │   ├── list-published-products.ts
│   │   │   │   ├── get-published-product.ts
│   │   │   │   └── reconcile-with-cms.ts
│   │   │   ├── ports/
│   │   │   │   ├── driving.ts
│   │   │   │   └── driven.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driving/
│   │   │   │   │   ├── cms-product-published.handler.ts
│   │   │   │   │   ├── cms-product-unpublished.handler.ts
│   │   │   │   │   ├── cms-verdict-field.tsx
│   │   │   │   │   ├── shop-page.ts
│   │   │   │   │   └── reconcile-cms.scheduled.ts
│   │   │   │   └── driven/
│   │   │   │       ├── postgres/schema.ts
│   │   │   │       ├── postgres/product.repository.ts
│   │   │   │       ├── postgres/sku-claim.repository.ts
│   │   │   │       ├── postgres/outbox.ts
│   │   │   │       ├── postgres/outbox-reader.ts
│   │   │   │       ├── postgres/inbox.ts
│   │   │   │       ├── postgres/unit-of-work.ts
│   │   │   │       ├── postgres/migrations/
│   │   │   │       ├── cms/payload-products.ts
│   │   │   │       └── fake/
│   │   │   ├── published/
│   │   │   │   ├── v1/events.ts
│   │   │   │   └── v1/open-host.ts
│   │   │   └── builder.ts
│   │   ├── ordering/
│   │   │   ├── glossary.md
│   │   │   ├── domain/
│   │   │   │   ├── cart.ts
│   │   │   │   ├── order.ts             # process manager: states, facts, next steps
│   │   │   │   ├── order-line.ts        # snapshot
│   │   │   │   ├── product-replica.ts
│   │   │   │   ├── deadlines.ts
│   │   │   │   └── specifications.ts
│   │   │   ├── service/                 # one file per use case
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/
│   │   │   │   │   ├── cart.actions.ts
│   │   │   │   │   ├── checkout.actions.ts
│   │   │   │   │   ├── order-status.ts
│   │   │   │   │   ├── handlers/        # one per subscribed message type
│   │   │   │   │   ├── expire-stalled-orders.scheduled.ts
│   │   │   │   │   └── admin/orders.view.tsx
│   │   │   │   └── driven/
│   │   │   │       ├── postgres/
│   │   │   │       ├── payments/card-payments.ts
│   │   │   │       ├── outbox/command-mappers.ts
│   │   │   │       ├── mail/order-mailer.ts
│   │   │   │       └── fake/
│   │   │   ├── published/v1/            # empty of events; driving ports only for the web
│   │   │   └── builder.ts
│   │   ├── payments/
│   │   │   ├── glossary.md
│   │   │   ├── domain/{card-payment.ts,bank-transaction.ts,refund.ts}
│   │   │   ├── service/
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/{stripe-webhook.ts,handlers/,import-bank.scheduled.ts,
│   │   │   │   │            reconcile-stripe.scheduled.ts,admin/payments.view.tsx}
│   │   │   │   └── driven/{postgres/,stripe/,bank/,fake/}
│   │   │   ├── published/v1/{open-host.ts,events.ts,commands.ts}
│   │   │   └── builder.ts
│   │   ├── billing/
│   │   │   ├── glossary.md
│   │   │   ├── domain/{invoice.ts,number-series.ts,credit-note.ts,vat-rates.ts,
│   │   │   │           dunning.ts,transfer-matching.ts}
│   │   │   ├── service/
│   │   │   ├── ports/{driving.ts,driven.ts}
│   │   │   ├── adapters/
│   │   │   │   ├── driving/{handlers/,send-reminders.scheduled.ts,admin/invoices.view.tsx}
│   │   │   │   └── driven/{postgres/,pdf/,mail/,fake/}
│   │   │   ├── published/v1/{events.ts,commands.ts}
│   │   │   └── builder.ts
│   │   └── fulfillment/
│   │       ├── glossary.md
│   │       ├── domain/{stock-item.ts,reservation.ts,shipment.ts,sku-registration.ts}
│   │       ├── service/
│   │       ├── ports/{driving.ts,driven.ts}
│   │       ├── adapters/
│   │       │   ├── driving/{warehouse-webhook.ts,handlers/,reconcile-warehouse.scheduled.ts,
│   │       │   │            admin/shipments.view.tsx}
│   │       │   └── driven/{postgres/,warehouse/,fake/}
│   │       ├── published/v1/{events.ts,commands.ts}
│   │       └── builder.ts
│   └── processes/
│       ├── web/
│       │   ├── next.config.ts
│       │   ├── instrumentation.ts       # tracer, logger, assembly into the courier
│       │   ├── assembly.ts
│       │   └── app/
│       │       ├── (shop)/page.tsx
│       │       ├── (shop)/products/[slug]/page.tsx
│       │       ├── (shop)/cart/page.tsx
│       │       ├── (shop)/checkout/page.tsx
│       │       ├── (shop)/orders/[id]/page.tsx
│       │       ├── (payload)/admin/[[...segments]]/page.tsx
│       │       ├── (payload)/admin/dashboard.tsx   # arranges the systems' admin views
│       │       ├── api/webhooks/stripe/route.ts     # re-exports payments' hook
│       │       ├── api/webhooks/warehouse/route.ts  # re-exports fulfillment's hook
│       │       ├── health/route.ts
│       │       ├── ready/route.ts
│       │       └── metrics/route.ts
│       └── worker/
│           ├── main.ts
│           ├── assembly.ts
│           ├── cms-outbox-reader.ts
│           └── probes-server.ts
├── tooling/
│   ├── migrate.ts
│   ├── seed.ts
│   └── dependency-rules.ts
└── test/                                # mirrors src/
    ├── kernel/
    ├── common/
    ├── systems/<system>/domain/          # default suite
    ├── systems/<system>/service/         # default suite, fakes via builder
    ├── systems/<system>/adapters/driven/ # contract suite: fake (default), postgres (integration),
    │                                     # stripe/bank/warehouse sandbox (end-to-end)
    └── tooling/architecture.test.ts      # default suite, asserts about the source tree
```

## How each property holds

**P1. The domain models the business domain, not what serves it.** `domain/` imports only the
shared kernel, zod and itself; an architecture test (tooling) fails on any import of
`drizzle-orm`, `stripe`, `payload`, `next`, `pino`, `@opentelemetry/*`, `common/`, or another
layer. Stripe, Payload, warehouse and bank shapes are translated in driven and driving adapters
(every relation is an anti-corruption layer), so the domain holds `CardPayment`, not
`PaymentIntent`. Time arrives as an argument from the `Clock` driven port.

**P2. A business rule lives in one place: the domain.** Business rules are specifications and
aggregate methods in `domain/`. The service only loads, asks, saves. Payload's configuration holds
types and `required` only; the catalog verdict field shows what catalog's
`reviewProductDraft` answers instead of validating itself. No store triggers, no check
constraints carrying rules; uniqueness of skus is the `SkuClaim` aggregate (its id is the sku),
gaplessness is the `InvoiceNumberSeries` aggregate. VAT rates per tax class with effective dates
are in `billing/domain/vat-rates.ts`; dunning steps in `billing/domain/dunning.ts`; order
deadlines in `ordering/domain/deadlines.ts`. Handlers and hooks translate and call one driving
port, nothing else.

**P3. Business rules that change together sit together; rules that change for different reasons
share nothing either would have to change.** The cut: catalog (merchandising), ordering (checkout
and order lifecycle), payments (money movement), billing (tax and accounting), fulfillment (stock
and shipping). No aggregate is shared: `Order` is ordering's; billing has its own `Invoice` lines
built from the command's snapshot. The shared kernel holds only `Money`, `Sku`, `TaxClass` names,
which change together for all. Each system's published language is its own folder; downstream
systems translate it in adapters, so an upstream's model change touches only its mappers.

**P4. A use case responds the same whoever calls it and whatever serves it.** Every caller goes
through the same driving port; driving adapters only parse input into the port's terms and map
the port's result (a typed result union of success and refusals) to their medium. The system
builder returns the same services over Postgres adapters or fakes. The same service tests run on
fakes; contract tests prove each fake and its real adapter answer alike.

**P5. A system reaches the outside, and is reached from it, only through its ports; each port
speaks the system's terms.** Services see only `ports/driven.ts`; the outside (Stripe, bank,
warehouse, mail provider, Postgres, Payload, clock) is behind driven adapters. Entries (server
functions, webhooks, handlers, scheduled tasks, admin views, Payload UI field) are driving
adapters calling `ports/driving.ts`. Another system reaches this one only through its `published/`
folder; the architecture test forbids importing anything else of another system. Each system's
database role has privileges on its own schema only, so no system reads another's records.

**P6. Every use case can run with nothing outside the process.** Each driven port has a fake in
`adapters/driven/fake/`, including a fake `UnitOfWork` that discards writes when the use case
throws and a fake repository that raises the same optimistic-version conflict as Postgres. The
fake clock is set by the test. One contract suite per driven port runs against the fake in the
default suite and against Postgres (integration test) or the vendor's sandbox (end-to-end test),
so the fake behaves as the outside does where the use case can tell.

**P7. A use case's writes to its own system's records land together or not at all.** Every acting
use case runs inside one `UnitOfWork` transaction on its system's store: all repositories, the
outbox port and the inbox are bound to that transaction. `placeOrder` saves the order, empties
the cart and writes `ReserveStock` in one commit.

**P8. An uncommitted write is not yet a fact.** Messages leave only through the outbox port,
written in the use case's transaction; the relay reads only committed rows. Mails, Stripe
captures, refunds, warehouse submissions and bank transfers are private messages handled after
commit. Payload's changes reach catalog through Payload's own outbox, written inside Payload's
transaction. What `placeOrder` asks before its commit is tentative: a PaymentIntent with manual
capture moves no money until `CapturePayment`, sent only after the order committed and stock was
reserved; an intent whose order never committed is cancelled by payments' Stripe reconciliation
after its authorization deadline. A webhook answers 2xx only after its use case committed, so the
vendor retries otherwise.

**P9. A repeated delivery changes nothing in this system.** Each handler's use case records the
message id in the `Inbox` (unique on handler and message id) in the same transaction as its
writes; a second delivery finds it and returns, and an overlapping one fails at commit and rolls
back. Use cases are also idempotent by key: `ReserveStock` for an order with a `Reservation` is a
no-op, `IssueInvoice` for an order with an invoice republishes `InvoiceIssued`, `BankTransaction`
is keyed by the bank's id, `CardPayment` by intent id. Webhooks: Stripe and warehouse event ids go
through the same `Inbox`. Outside effects: Stripe calls carry idempotency keys (message id); bank
transfers carry the refund id as end-to-end id and are looked up before re-initiating; warehouse
shipments are created under our shipment id after a lookup by it; mails carry the message id as
the provider's idempotency key, and where it still repeats, ordering's and billing's domains state
the rule that a repeated mail is allowed.

**P10. A use case commits only on reads that still hold, or on stale ones a business rule
accepts; use cases fail each other only where a business rule ties them.** Every aggregate has a
version; repositories save with `WHERE version = :read`, a conflict rolls back and the service
retries the use case a bounded number of times, then refuses. Aggregates are cut by real business
rules: one `StockItem` per sku (two checkouts of different teas never conflict; two of the last
unit of one tea do, by the rule that stock is not oversold), one `InvoiceNumberSeries` per year
(issuances serialize, by the gapless rule), one `Cart` per customer, one `Order` per order. Stale
reads accepted by business rules: the cached shop page may lag catalog by up to 60 seconds;
ordering's `ProductReplica` lags catalog and fulfillment, and the rule is that an order is placed
at the replica's price only if it equals the total the customer confirmed (`expectedTotal`),
otherwise `placeOrder` refuses with the new total; availability in the replica is advisory, the
`StockItem` reservation decides.

**P11. No other system changes the records a system owns.** Each system writes only its schema,
through its own role; the others change it only by calling its driving ports or sending it
commands, which it may refuse. Payload's product documents are Payload's (no business rule of ours
decides them; catalog only answers); catalog's `Product` is written only by catalog's use cases.
Replicas (`ProductReplica`, `StockItem.onHand`) are the keeper's records, refreshed only by the
keeper's handlers and hooks.

**P12. Another system's model enters this one only by choice.** The choice is made per relation
and recorded in each system's `glossary.md`: every relation is an anti-corruption layer. Upstream
published languages, Stripe, Payload, warehouse and bank types are allowed only in the adapter
files that touch that upstream (enforced by the architecture test listing, per system, which
adapter folders may import which upstream `published/` or vendor SDK). The shared kernel is the
one model taken as is, by agreement.

**P13. A system changes its model without its downstream systems changing.** Downstream systems
see only `published/v1/`, written by hand and mapped from the domain in the system's own outbox
adapter and open host service adapter; a domain refactoring changes the mapper, not the schema.
A breaking change adds `published/v2/`, published side by side with `v1` until every subscriber
has moved.

**P14. A record or a message means the same to all code that reads it, whenever it was written.**
Messages: every envelope has `type` and `version`; a schema version is never changed, only added;
handlers accept every version still possible in any outbox and upcast older ones in the adapter;
producers write both versions during a migration. Records: migrations are expand/contract
(tooling): expand (nullable columns, new tables) before rollout, contract only after no process
of the old code runs. Repositories update only the columns they map, never whole rows or JSON
blobs, so an old process saving back a record leaves columns it does not know untouched; a column
the new code derives from others is recomputed when its row's `written_by` version is older. The
cms outbox message carries its own version, so a Payload configuration change is a new version.

**P15. A system works while others are down or slow, as far as its own data reaches.** Checkout
reads ordering's `ProductReplica`, not catalog or fulfillment; every step after `placeOrder` goes
through the outbox, so fulfillment, billing and payments being down delays, not breaks, ordering.
Invoice checkout needs nothing outside ordering; card checkout needs payments and Stripe and fails
visibly when they are down. The shop page is served from cache with stale-while-revalidate.
Webhooks and bank import write into the system's own records first; a down mail provider, warehouse
or bank leaves private messages waiting, retried with backoff. Fulfillment reserves against its
`StockItem` replica without calling the warehouse.

**P16. No transaction spans two systems.** One client, pool and role per system; the
`UnitOfWork` of one system cannot bind another's repositories; the architecture test forbids a
service importing another system's builder or adapters. The synchronous `openCardPayment` call
commits in payments' own transaction before ordering's, and is tentative (P8). Payload has its
own pool and schema.

**P17. Work spanning systems ends, and only in a state a business rule allows.** Orchestration:
ordering's `Order` is the process manager; its domain lists every state, the facts it waits for,
the next commands, the compensating commands (void authorization, release reservation, cancel
invoice by credit note, refund then credit note) and a deadline for every waiting state
(authorization 1 hour, reservation answer 1 hour, capture 1 hour, transfer per billing's dunning
which ends in `InvoiceDefaulted`, shipment 5 working days). `expireStalledOrders` acts on passed
deadlines: cancel and compensate, or, for shipment, mark `needsAttention`, visible on the
dashboard with a metric. Tentative operations (authorization, reservation) each end confirmed
(capture, `ShipOrder`) or cancelled (void, release). Reconciliations: payments against Stripe
(intents, captures, refunds) and against the bank (refund transfers), fulfillment against the
warehouse (shipments, sku registrations, stock levels), catalog against Payload (latest published
version per product). Messages failing a handler after N attempts are parked, counted in a
metric and shown on the dashboard for re-drive, never dropped.

**P18. The order messages arrive in does not change the outcome.** The process manager records
facts (`stockReserved`, `cardAuthorized`, `invoicePaid`) and decides from the set, not the
sequence; a fact for a cancelled order triggers its compensation (an authorization arriving after
cancellation sends `VoidPayment`). Fulfillment keeps a `Reservation` row in `released` when
`ReleaseReservation` arrives first, so a later `ReserveStock` for that order is refused.
Replicas keep the owner's version (`catalogVersion`, the warehouse's stock timestamp) and ignore
older ones. Stripe webhooks do not apply the event's state: the hook refetches the intent and
`CardPayment` moves only forward on its state order. Billing sums transfers per invoice, which
commutes; a transfer arriving before its invoice is issued stays an `UnmatchedTransfer` and is
matched when `IssueInvoice` is handled.

## Decisions the documents left to me

**D1. Five systems: catalog, ordering, payments, billing, fulfillment.** Payments and billing
split because card and bank mechanics change for other reasons than tax and numbering law. No
notifications system, no dashboard system.
Bore on it: "Code split into systems, each one bounded context (glossary: System), run as one or
more processes."; "Rules that change for the same reason and stand apart from the rest are also
where a system splits once the business domain is better known."; "Refactoring logical boundaries
is considerably less expensive than refactoring physical boundaries. Hence, when designing
bounded contexts, start with wider boundaries."

**D2. Payload is an external system in our processes; catalog is downstream of it as an
anti-corruption layer.** Product edits are Payload's records; catalog publishes its own `Product`
from them.
Bore on it: "A bounded context whose code this codebase does not write, though it may configure
it: bought or adopted, run by its vendor or by us, in its own process or in ours."; "Its
configuration may hold business rules this codebase writes, in the external system's terms; its
architecture stays its own."; "It is driven through its API and driving through its hooks."

**D3. Payload's changes reach catalog through an outbox inside Payload's store, written by an
`afterChange` hook through `req`; the worker's assembly provides its outbox reader.**
Bore on it: "The *outbox reader* is what the relay reads the outbox through, and marks it by; the
system provides it, and for an external system's outbox, assembly does."; "An external system
holds none of these properties, and its contract follows its own model".

**D4. Catalog's verdict in Payload is shown, not enforced; catalog refuses an invalid revision
itself and keeps the previous published product.**
Bore on it: "The system whose business rules decide what a record holds, wherever it is kept; of
a record no business rule decides, the system that keeps it."; "No other system changes the
records a system owns"; "A business rule anywhere else, in a store trigger, a hook, a service, is
one a reader of the domain misses and writes again."

**D5. Orchestration, with ordering's `Order` as process manager.**
Bore on it: "One system's *process manager* holds the sequence across systems: an aggregate whose
state is where the sequence stands. Each step is a use case of that system that sends commands to
the others."; "Each system reacts to the others' events and decides for itself what to do next.
No one holds the whole sequence."; "Khononov (pdf 271): saga and process manager for processes
across bounded contexts that need compensating actions."

**D6. Invoice orders ship only after the transfer arrived (pay before shipping).**
Bore on it: "What the business domain allows, requires or forbids: an order ships only once paid."

**D7. Every order gets an invoice; card orders are invoiced after capture, already settled.**
Bore on it: none.

**D8. Card payments use Stripe manual capture: authorization is the tentative operation, capture
its confirmation, void its cancellation.**
Bore on it: "A request to another system for a commitment that leaves open the possibility of
cancellation. It changes nothing it asks for: its confirmation does."; "What is asked of another
system, or of this one, before the commit stays tentative, confirmed only after it."

**D9. `placeOrder` calls payments' open host service synchronously for card orders (client secret
needed at once); every other cross-system step is a message.**
Bore on it: "A use case needing only data this system holds runs anyway; one needing another
system now fails visibly, and that is expected."; "Seen from the caller, this system's driving
port lies behind one of the caller's driven ports."

**D10. Mails are sent by the system whose rules decide their content (ordering, billing), via
private messages to itself.**
Bore on it: "What one system tells another, or itself, so that it may act."; "*Private*: meant
only for the system that wrote it."; "A message or a mail sent before the commit announces what
may never happen; one sent after it is lost to a stop in between."

**D11. A repeated mail is allowed by a business rule; the provider's idempotency key reduces it.**
Bore on it: "Outside the system this may not hold: a mail provider may send twice (F9). Where an
effect outside can repeat, a business rule allows the repeat."

**D12. The admin dashboard is a page of driving adapters (one admin view per system) inside
Payload's admin, not a system or a read model.**
Bore on it: "Out of scope: throughput and load, security, user interfaces."; "A *driving adapter*
adapts one caller to a driving port."

**D13. One schema, one role, one client per system in the one Postgres instance: six stores.**
Bore on it: "What lies behind one or more driven ports whose writes can be committed in one
transaction. Two clients are one store when their writes commit together, two stores until they
do."; "A store may keep records of several owners."; "No transaction spans two systems".

**D14. Relay and bus run in the worker; at-least-once delivery; a message is marked delivered
when every subscribed handler succeeded; a lease guards a claimed row; parked after N attempts.**
Bore on it: "The mechanism that reads outboxes and hands each message to the bus. Assembly hands
it the outbox readers."; "What delivers a message to the handlers subscribed to it. Assembly
hands it the handlers."; "Khononov (pdf 173): the outbox \"guarantees delivery of the messages at
least once\"."

**D15. Deduplication by an `Inbox` table per system, written in the use case's transaction.**
Bore on it: "It has an id, the same on every delivery of it."; "A message can arrive more than
once, a redelivery while the first attempt still runs, and after one sent later."

**D16. Two processes: web and worker.**
Bore on it: "run as one or more processes"; "A process can stop between any two of its
instructions: a crash, a deploy, a timeout."

**D17. Courier in web: a memoized per-process container plus AsyncLocalStorage per request; none
needed in the worker for services.**
Bore on it: "How a driving adapter reaches what assembly produced when assembly cannot hand it
over as an argument. Example implementations are per-process ambient values or the stack's
context objects."; "Two scopes: per process, set once for the process's life, like what assembly
produced, a ready-made logger or an environment variable; per request, what the current request
carries, like a request id, a trace context or a locale."

**D18. Shared kernel `Money`, `Sku`, `TaxClass` (names only).**
Bore on it: "A model several systems of this codebase share as code and agree on together, each
importing it into its domain: `Money`, `Sku`. A change to it is a change to each."

**D19. Catalog prices are gross; VAT rates per tax class with effective dates live in billing's
domain; invoices snapshot the rate.**
Bore on it: "A value an aggregate copies from another aggregate or from a message when a use case
needs it, and keeps as its own fact from then on: the price the order was placed at."

**D20. Gapless numbers from a series aggregate per year, incremented in the issuing transaction
(no database sequence).**
Bore on it: "A process stopping between two writes leaves records no business rule allows";
"use cases fail each other only where a business rule ties them".

**D21. Refunds are started by an admin; money first, credit note after `RefundSucceeded`; a
default cancels the invoice by a credit note.**
Bore on it: none.

**D22. Bank transactions are imported by a scheduled task polling the bank API; matching to
invoices is billing's rule.**
Bore on it: "A driving adapter the clock calls."

**D23. Dunning: reminders at due+7 and due+14, default at due+28, then cancellation.**
Bore on it: "Completing, undoing and accepting the divergence are each something a business rule
allows."

**D24. Shop page cached by time-based revalidation (60 s) with stale-while-revalidate; checkout
confirms the total.**
Bore on it: "A stale read is one a business rule accepts, with what happens meanwhile."

**D25. Ordering keeps a `ProductReplica` of catalog products, fulfillment sku registration and
availability; fulfillment keeps a replica of warehouse stock levels in `StockItem`.**
Bore on it: "A copy of another system's data, kept under the owner's ids and shaped as this
system writes it: translated, compacted or projected. It is refreshed from what the owner
publishes or returns to it, and lags the owner."; "Khononov, Event-carried state transfer (pdf
264): \"the consumers can continue functioning even if the producer is not available.\""

**D26. Every relation is an anti-corruption layer; none conformist.**
Bore on it: "Taking another's terms as they are is as much a choice as translating them.";
"A downstream system that takes the upstream as it is"; "The upstream's terms stop at
those adapters."

**D27. Published language as hand-written zod schemas in `published/vN/`; versions added, never
changed.**
Bore on it: "the upstream can \"simultaneously expose multiple versions of the published language,
allowing the consumer to migrate to the new version gradually\""; "The published language holds
still while the model moves."

**D28. Expand/contract migrations as tooling; repositories update only mapped columns.**
Bore on it: "An old process saves back a record the new code wrote and drops what it does not
know"; "Code that runs in no process of the deployed application: a developer CLI, a seed script,
a test that asserts about the source tree."

**D29. Fakes live in `src/` next to the real adapters (assembly may pick them); contract suites
run on both.**
Bore on it: "A working implementation of a port that reaches nothing outside the process: a
repository over an in-memory map."; "What stands in for the outside behaves as the outside does
wherever the use case can tell, or a passing test proves nothing."

**D30. An architecture test (dependency rules) in the default suite enforces layers, cross-system
imports and vendor SDK placement.**
Bore on it: "People and agents change code having read only part of it."; "An agent editing one
file sees that file, not the architecture."

**D31. Probes `/health` (alive), `/ready` (store clients connected, relay loop ticked recently in
the worker), `/metrics` (OpenTelemetry metrics through a Prometheus reader, including outbox lag
and parked messages); traces exported over OTLP to Jaeger, `traceparent` carried in the message
envelope.**
Bore on it: "Code a process runs to report on itself rather than on a system: whether it is alive
or ready, its metrics. `/health`, `/metrics`."

**D32. Guest checkout; the order page is reached with an access token from the confirmation
mail.** Bore on it: "Out of scope: throughput and load, security, user interfaces."

**D33. Webhooks call their use case synchronously and answer 2xx only after commit; no raw-event
store.**
Bore on it: "nothing final follows from it before it commits, and nothing that follows from it is
lost after".

**D34. A refused command is answered by an event of the offering system (`...Refused`).**
Bore on it: "A *command* says do this, to the one system that offers it, which may refuse.";
"the events it publishes, and the commands it takes from other systems."

**D35. Scheduled tasks run in the worker's in-process scheduler, one Postgres advisory lock per
task run; each scheduled use case is idempotent per period.**
Bore on it: "A driving adapter the clock calls."; "Other systems and third parties, the operating
system among them, whether they drive the system or it drives them: a store, a mail provider, the
clock, the file system."

**D36. The cart is emptied when the order is placed, not when it is paid.**
Bore on it: "A process stopping between two writes leaves records no business rule allows: the
order placed, the cart still full."

**D37. No shipping costs, no customer accounts, no shipped mail.** Bore on it: none.

**D38. Each system has a `glossary.md` file.**
Bore on it: "It is code with its own domain and its own glossary."

**D39. Tests live in `test/` mirroring `src/`; default suite runs domain, service on fakes,
contract suites on fakes and the architecture test.**
Bore on it: "The tests run by default: every test that is neither an integration test nor an
end-to-end test."

## Sentences I had to pick a reading for

1. "Two clients are one store when their writes commit together, two stores until they do."
   (a) Store is the database instance: one Postgres, one store. (b) Store is what one
   transaction can span as the code is built: separate clients, separate stores. Took (b).

2. "The *outbox reader* is what the relay reads the outbox through, and marks it by"
   (a) "marks it by": marks messages in the outbox as delivered through the reader. (b) a
   cursor the relay advances. Took (a); for cms the reader marks its own `outbox` documents.

3. "It is driven through its API and driving through its hooks."
   (a) "its hooks" are the external system's extension points. (b) they are our driving
   adapters (glossary hooks) the external system calls. Took both: our hooks, registered at its
   extension points (Payload hooks, Stripe and warehouse webhooks).

4. "of a record no business rule decides, the system that keeps it."
   (a) A draft in Payload that catalog's rule merely judges is decided by no business rule of
   ours, so Payload's. (b) If catalog's verdict can block a save, catalog's rule decides it and
   catalog owns it, kept by Payload. Took (a) and made the verdict advisory (D4).

5. "It changes nothing it asks for: its confirmation does."
   (a) A tentative operation must leave the asked-for resource untouched, so a stock hold that
   lowers availability is not tentative. (b) It must not do the final change (sell, charge); a
   hold is allowed. Took (b): authorization holds funds, reservation holds stock; capture and
   shipping are the changes.

6. "Each use case either acts or answers."
   (a) An acting use case returns nothing. (b) It returns its outcome (success with the ids it
   created, or a refusal), not a query result. Took (b): `placeOrder` returns order id and the
   client secret the customer needs to finish.

7. "There are as many driving adapters as there are ways into the process, like a server
   function, a CLI command, a webhook."
   (a) One driving adapter per kind of entry (one HTTP adapter). (b) One per caller-and-port
   pair, as "A *driving adapter* adapts one caller to a driving port." says. Took (b).

8. "A *command* says do this, to the one system that offers it, which may refuse."
   (a) Refusal is silent (the command is dropped). (b) Refusal is something the sender learns.
   Took (b), as an event of the offering system.

9. "A driving adapter an upstream system calls." (Hook)
   (a) Only external systems' callbacks (webhooks). (b) Any upstream calling in, including
   another system of ours. Took (b) in principle; in this draft our systems reach each other by
   messages and by open host service calls, so hooks are the Stripe, warehouse and Payload ones.

10. "A repeated delivery changes nothing in this system"
    (a) Only messages delivered by our bus. (b) Also webhook deliveries from external systems.
    Took (b): webhook event ids go through the `Inbox`.

11. "A system works while others are down or slow, as far as its own data reaches"
    (a) Own data excludes replicas (they copy another's). (b) Includes them, since "A replica's
    records are its keeper's". Took (b).

12. "Code a process runs to report on itself rather than on a system"
    (a) Readiness may not check the store (that would report on the outside). (b) It may check
    the process's own connections. Took (b); probes never call a use case.

13. "Code that runs in no process of the deployed application"
    (a) A migration step run by the deploy pipeline is a process of the deployed application.
    (b) It is not, since the application's processes are web and worker. Took (b): migrations
    are tooling.

14. "Work waiting on another system's answer is still a state a customer finds."
    (a) Every waiting state needs a deadline that ends it. (b) Every waiting state must itself be
    one a business rule allows and the customer can see. Took both: each waiting state is named
    on the order page and has a deadline in `ordering/domain/deadlines.ts`.

15. "A specialized driven port over exactly one aggregate"
    (a) One aggregate instance. (b) One aggregate type. Took (b).

16. "A *driving port* is the way in. It names one use case the system offers and what a caller
    must bring, in the system's terms, not its store's."
    (a) A message handler's port may take the upstream's message type. (b) It takes this
    system's terms; the handler translates. Took (b).

17. "A downstream system that translates the upstream's published
    language into its own in every adapter that touches the upstream: the driven adapters that
    call into it and the driving adapters it calls into."
    (a) "it" in "it calls into" is the downstream (its driving adapters that call the upstream).
    (b) "it" is the upstream (the downstream's hooks and handlers the upstream reaches). Took
    (b): handlers of upstream events and hooks translate.

18. "A use case's writes to its own system's records land together or not at all"
    (a) Writes to replicas kept by the system count as its own records. (b) Only records it owns.
    Took (a): replica updates share the use case's transaction.

19. "Domain. The model: business rules, schemas, specifications. It is pure and knows no
    runtime."
    (a) "schemas" are the domain's own validation schemas (zod allowed). (b) Store schemas.
    Took (a); store schemas live in `adapters/driven/postgres/schema.ts`, published language
    schemas in `published/`.
