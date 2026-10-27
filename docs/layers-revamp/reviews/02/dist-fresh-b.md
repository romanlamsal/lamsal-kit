# Fresh repository draft B, distilled set

## Systems and what each owns

Seven systems written in this codebase, five external systems. Each written system is one bounded
context with its own domain, glossary, store and published language. "Owner" and "record" as in
the glossary.

| System | Kind | Owns (records) | Keeps (store) |
|---|---|---|---|
| **Catalog** | ours | product records (copy, images refs, slug, price, sku, tax class, status): its business rules decide them through the veto hooks, so it owns them although Payload CMS keeps them; sku claims; catalog entries (last published version and sku per product) | Postgres schema `catalog` (sku claims, catalog entries, outbox, inbox). Product records are kept by Payload CMS. |
| **Ordering** | ours | carts, orders. The Order aggregate is the *process manager* of checkout, cancellation and refund. Replica of catalog items (price, sku, tax class, status, sku-registered flag) | schema `ordering` |
| **Inventory** | ours | stock items per sku: holds, reservations, replica of on-hand counts from Fulfillment | schema `inventory` |
| **Billing** | ours | invoices (gapless numbers, VAT per tax class), credit notes (own gapless series), number sequences, dunning state (reminders, default) | schema `billing` |
| **Payments** | ours | card payments, bank transfer receipts, refunds, bank statement cursor; replica of open receivables (from `InvoiceIssued`) | schema `payments` |
| **Fulfillment** | ours | sku registrations with the warehouse partner, shipments, stock counts as last reported | schema `fulfillment` |
| **Notifications** | ours | mail log (one row per mail sent, keyed by message id) | schema `notifications` |
| **Payload CMS** | external system, run by us, in our `web` process | editor users, media, product documents and their versions (as keeper; Catalog is owner of the product records); its own job and version tables | schema `payload`, own pool |
| **Stripe** | external system, run by vendor | payment intents, refunds, its events | vendor |
| **Warehouse partner** | external system, run by vendor | physical stock, its sku master, shipments | vendor |
| **Bank** | external system, run by vendor | account statements, outgoing transfers | vendor |
| **Mail provider** | external system, run by vendor | delivery | vendor |

Shared kernel: `Money` (integer minor units + currency) and `Sku`. Every written system imports it
into its domain.

Common library: Drizzle client factory per system, pino logger, OpenTelemetry tracer and meter,
relay, bus, courier, unit-of-work helper, probe server.

Business rules, each in exactly one domain (examples, not exhaustive):
- Catalog: a product is publishable only with slug, positive price, sku, known tax class; a sku
  belongs to one product; a sku does not change once the product was first published; products
  are archived, never deleted.
- Ordering: an order ships only once paid; an item is sellable only when published and its sku is
  registered; the price bound is the one quoted at placement (snapshot); unpaid card orders expire
  after 30 minutes; a payment for a cancelled order is refunded unless stock can be held again;
  a defaulted invoice cancels its order.
- Inventory: no hold or reservation beyond available stock; available = on-hand as of the last
  count minus reservations not dispatched by that count; holds expire after 30 minutes unless
  converted to reservations.
- Billing: invoice and credit note numbers are gapless per series; VAT per tax class at the rate
  valid on the invoice date, extracted from gross prices; due date 14 days; reminder 1 at due + 7,
  reminder 2 at due + 21, default at due + 35; an issued invoice is only ever offset by a credit
  note.
- Payments: a bank transfer matches an open receivable by invoice number in the remittance
  reference and by amount; anything else is unmatched and goes to staff.
- Fulfillment: a shipment is requested only for registered skus; shipment states only move
  forward (requested, accepted, dispatched, delivered).

## Ports and adapters

Conventions for every written system:
- Driving ports: one interface per use case, typed in the system's terms; the subset offered to
  other systems is its open host service, typed in its published language.
- Driven ports: one repository per aggregate, the outbox port, the inbox port (processed message
  ids), a unit-of-work port binding repositories, outbox port and inbox port to one transaction of
  the system's store, a `Clock` port, plus the ports listed below.
- Driven adapters: Drizzle/Postgres for repositories, outbox, inbox, unit of work; one fake per
  driven port (in-memory map, fixed clock). The outbox reader is provided by each system.
- Driving adapters: handlers, hooks, scheduled tasks, Next.js server actions and route handlers,
  Payload admin views, CLI commands. Each translates and calls exactly one driving port.
- One system builder per system per process need: `build<System>(config, common)` returns the
  driving ports, the handlers with their subscriptions, the outbox reader and the scheduled tasks.

### Catalog
- Driving ports: `vetProductChange` (answers: allowed, or refusal with reasons), `claimSku`
  (acts: claims sku for product id, refuses if claimed by another), `recordProductVersion` (acts:
  turns a saved product version into `ProductChanged`), `browseShop` (answers: published products
  for the shop page), `invalidateShopPage` (acts), `reconcileSkuClaims` (reconciliation).
- Driven ports: `CatalogEntryRepository`, `SkuClaimRepository`, `ProductSource` (reads product
  documents of Payload CMS through its API, in catalog terms), `ShopPageCache` (invalidate),
  outbox port, inbox port, unit of work, `Clock`.
- Driven adapters: Postgres for repositories/outbox/inbox; `PayloadProductSource` over Payload's
  Local API (anti-corruption layer: Payload document shape stops here); `NextShopPageCache` (calls
  the web process's internal revalidate route); fakes.
- Driving adapters: Payload hooks `beforeChange` and `beforeDelete` on the products collection
  (hooks, call `claimSku` then `vetProductChange`; translate Payload's arguments); handler
  `onPayloadProductVersion` (Payload's outbox message to `recordProductVersion`, anti-corruption
  layer); handler `onProductChanged` (own published event to `invalidateShopPage`); shop page
  server component (calls `browseShop`); scheduled task `reconcileSkuClaims`.
- Outbox reader: for its own outbox (provided by Catalog); for Payload's outbox (product version
  rows), provided by assembly, reading through Payload's Local API and marking in a relay mark table.
- Upstream of: Ordering, Fulfillment. Downstream of: Payload CMS (anti-corruption layer).

### Ordering
- Driving ports: `addToCart`, `changeCartLine`, `viewCart` (answers), `placeOrder` (acts: holds
  stock, snapshots lines, creates Order), `payForOrder` (acts: obtains a card payment session),
  `refundOrder` (acts, staff), `listOrders`, `getOrder` (answer, dashboard); process manager steps
  as use cases: `onStockReserved`, `onStockReservationRefused`, `onPaymentReceived`,
  `onPaymentFailed`, `onInvoiceIssued`, `onInvoiceDefaulted`, `onShipmentDispatched`,
  `onPaymentRefunded`, `onRefundFailed`, `onCreditNoteIssued`; replica use cases
  `applyProductChanged`, `applySkuRegistered`; `expireUnpaidCardOrders`; `findStuckOrders`
  (reconciliation of process manager timeouts).
- Driven ports: `CartRepository`, `OrderRepository`, `CatalogItemRepository` (replica),
  `StockHolds` (behind which lies Inventory's `holdStock` driving port), `CardPayments` (behind
  which lies Payments' `startCardPayment`), outbox port, inbox port, unit of work, `Clock`,
  `IdGenerator`.
- Driven adapters: Postgres; `InProcessInventoryStockHolds` and `InProcessCardPayments` call the
  other system's open host service in-process and translate its published language into ordering
  terms (anti-corruption layer); fakes.
- Driving adapters: Next.js server actions (cart, checkout, pay), Payload admin views (orders list,
  refund action), handlers for every event and every reply listed under Calls, scheduled tasks
  `expireUnpaidCardOrders` and `findStuckOrders`.
- Outbox reader: provided by Ordering.
- Downstream of: Catalog, Inventory, Payments, Billing, Fulfillment (anti-corruption layer to each).

### Inventory
- Driving ports (open host service): `holdStock` (acts; tentative operation, idempotent by order
  id), `reserveHeldStock` (acts, command), `releaseStock` (acts, command), `availability`
  (answers); internal: `applyStockCount`, `applyShipmentDispatched`, `expireHolds`.
- Driven ports: `StockItemRepository`, outbox port, inbox port, unit of work, `Clock`.
- Driven adapters: Postgres; fakes.
- Driving adapters: in-process call from Ordering's driven adapter; handlers for `ReserveHeldStock`,
  `ReleaseStock` (commands), `StockCounted`, `ShipmentDispatched` (Fulfillment events); scheduled
  task `expireHolds`.
- Outbox reader: provided by Inventory.
- Upstream of: Ordering. Downstream of: Fulfillment (anti-corruption layer).

### Billing
- Driving ports: `issueInvoice` (command), `issueCreditNote` (command), `settleInvoice` (on
  `PaymentReceived`), `runDunning` (acts, clock), `listInvoices`, `getInvoice` (answer).
- Driven ports: `InvoiceRepository`, `CreditNoteRepository`, `NumberSeriesRepository` (one
  aggregate per series, locked for the transaction), outbox port, inbox port, unit of work, `Clock`.
- Driven adapters: Postgres; fakes.
- Driving adapters: handlers for `IssueInvoice`, `IssueCreditNote`, `PaymentReceived`; scheduled
  task `runDunning` (daily); Payload admin view (invoices list).
- Outbox reader: provided by Billing.
- Upstream of: Ordering, Payments, Notifications. Downstream of: Payments (anti-corruption layer).

### Payments
- Driving ports: `startCardPayment` (open host service, acts), `recordStripeNotification` (acts),
  `cancelCardPayment` (command), `refundPayment` (command), `importBankStatement` (acts,
  reconciliation with the bank), `reconcileCardPayments` (reconciliation with Stripe),
  `reconcileRefunds`, `applyInvoiceIssued` (replica of receivables).
- Driven ports: `PaymentRepository`, `RefundRepository`, `BankTransferRepository`,
  `ReceivableRepository` (replica), `BankStatementCursorRepository`, `CardGateway` (create,
  retrieve, cancel payment intent; refund; in payments terms), `BankAccount` (statement lines since
  cursor; initiate outgoing transfer), outbox port, inbox port, unit of work, `Clock`.
- Driven adapters: Postgres; `StripeCardGateway` (anti-corruption layer, sends idempotency keys);
  `BankApiAccount` (anti-corruption layer); fakes.
- Driving adapters: Stripe webhook route (hook: verifies signature, translates, calls
  `recordStripeNotification`); handlers for `CancelCardPayment`, `RefundPayment`,
  `InvoiceIssued`; scheduled tasks `importBankStatement` (every 15 min),
  `reconcileCardPayments` (hourly), `reconcileRefunds` (hourly).
- Outbox reader: provided by Payments.
- Upstream of: Ordering, Billing, Notifications. Downstream of: Stripe, Bank (anti-corruption
  layer), Billing (anti-corruption layer).

### Fulfillment
- Driving ports: `registerSku` (on `ProductChanged`), `shipOrder` (command), `cancelShipment`
  (command), `recordWarehouseNotification` (acts), `reconcileShipments`,
  `reconcileSkuRegistrations`, `pullStockCounts` (reconciliation), `listShipments` (answer).
- Driven ports: `SkuRegistrationRepository`, `ShipmentRepository`, `StockCountRepository`,
  `Warehouse` (register sku, find sku, create shipment by our reference, find shipment by our
  reference, cancel shipment, stock levels; in fulfillment terms), outbox port, inbox port, unit
  of work, `Clock`.
- Driven adapters: Postgres; `WarehouseApi` (anti-corruption layer); fakes.
- Driving adapters: warehouse webhook route (hook); handlers for `ProductChanged`, `ShipOrder`,
  `CancelShipment`; scheduled tasks for the three reconciliations; Payload admin view (shipments).
- Outbox reader: provided by Fulfillment.
- Upstream of: Ordering, Inventory. Downstream of: Catalog, Warehouse partner (anti-corruption
  layer).

### Notifications
- Driving ports: `sendOrderConfirmation`, `sendPaymentReminder`, `sendCreditNote` (each acts,
  idempotent by message id).
- Driven ports: `MailLogRepository`, `Mailer` (in notifications terms: recipient, template,
  model, idempotency key), unit of work.
- Driven adapters: Postgres; `ProviderMailer` (mail provider API); fake mailer.
- Driving adapters: handlers for `OrderConfirmed`, `InvoiceReminded`, `CreditNoteIssued`.
- No outbox: it publishes nothing.
- Conformist to Ordering's and Billing's published language (decision D13).

### External systems seen from our side
- Payload CMS: driven through its Local API (`PayloadProductSource`, the Payload outbox reader),
  driving through its hooks (collection hooks, admin views). Its configuration
  (`payload.config.ts`, collections) is written by us in its terms and holds no business rule: every
  rule it needs is a hook into Catalog.
- Stripe, warehouse partner, bank, mail provider: driven through their APIs via the adapters above;
  Stripe and the warehouse partner drive us through webhooks (hooks).

## Calls and messages

Synchronous calls (in-process, through the callee's open host service):
- Ordering `placeOrder` calls Inventory `holdStock` (tentative operation) before committing the
  Order.
- Ordering `payForOrder` calls Payments `startCardPayment`; Payments calls Stripe (create payment
  intent, idempotency key = order id) and returns a client secret.
- Payload CMS calls Catalog hooks (`claimSku`, `vetProductChange`) inside its write.
- Payload admin views call `listOrders`, `listInvoices`, `listShipments`, and `refundOrder`.
- Shop page calls Catalog `browseShop` (result cached, see D18).
- Stripe calls Payments' webhook; warehouse partner calls Fulfillment's webhook.
- Catalog's `NextShopPageCache` calls the web process's internal revalidate route.

Messages (all go writer's outbox, relay, bus, handlers; every message carries id, type,
`schemaVersion`, occurred-at, aggregate version where it has one, `traceparent`):

| Message | Kind | Written by | Handled by |
|---|---|---|---|
| Payload product version saved | event, Payload's (external outbox) | Payload CMS (version table) | Catalog `onPayloadProductVersion` |
| `ProductChanged` | published event | Catalog | Ordering (replica), Fulfillment (`registerSku`), Catalog (`invalidateShopPage`) |
| `SkuRegistered`, `SkuRegistrationFailed` | published event | Fulfillment | Ordering (replica flag) |
| `ReserveHeldStock`, `ReleaseStock` | published command (Inventory's) | Ordering | Inventory |
| `StockReserved`, `StockReservationRefused`, `StockReleased` | published event | Inventory | Ordering |
| `IssueInvoice`, `IssueCreditNote` | published command (Billing's) | Ordering | Billing |
| `InvoiceIssued` | published event | Billing | Ordering, Payments (receivables replica) |
| `InvoiceSettled` | published event | Billing | Payments (closes receivable) |
| `InvoiceReminded` | published event | Billing | Notifications |
| `InvoiceDefaulted` | published event | Billing | Ordering |
| `CreditNoteIssued` | published event | Billing | Ordering, Notifications |
| `CancelCardPayment`, `RefundPayment` | published command (Payments') | Ordering | Payments |
| `PaymentReceived`, `PaymentFailed` | published event | Payments | Ordering, Billing |
| `PaymentRefunded`, `RefundFailed` | published event | Payments | Ordering |
| `UnmatchedTransferReceived` | published event | Payments | none yet (dashboard metric) |
| `ShipOrder`, `CancelShipment` | published command (Fulfillment's) | Ordering | Fulfillment |
| `ShipmentRequested`, `ShipmentDispatched`, `ShipmentDelivered` | published event | Fulfillment | Ordering; Inventory (`ShipmentDispatched`) |
| `StockCounted` | published event | Fulfillment | Inventory |
| `OrderPlaced`, `OrderConfirmed`, `OrderCancelled`, `OrderRefunded` | published event | Ordering | Notifications (`OrderConfirmed`) |

Commands are refused by publishing the matching refusal event (`StockReservationRefused`,
`RefundFailed`, `SkuRegistrationFailed`); no command has a reply channel of its own.

Sequences (orchestration by the Order process manager):
- Card: `placeOrder` (hold, Order `Placed`, outbox `ReserveHeldStock`, `OrderPlaced`) →
  `StockReserved` → `payForOrder` → Stripe → `PaymentReceived` → Order `Paid`, `IssueInvoice`
  (settled by payment id) and `ShipOrder` → `InvoiceIssued` → Order `Confirmed`, `OrderConfirmed`
  → mail → `ShipmentDispatched` → Order `Shipped`.
- Transfer: `placeOrder` → `StockReserved` → `IssueInvoice` (open, due in 14 days) →
  `InvoiceIssued` → `Confirmed` (mail with invoice number and bank details) → bank import →
  `PaymentReceived` → `Paid`, `ShipOrder` → `Shipped`. Or dunning → `InvoiceDefaulted` → Order
  `Cancelled`, `ReleaseStock`, `IssueCreditNote`.
- Card timeout: `expireUnpaidCardOrders` → Order `Cancelled`, `CancelCardPayment`, `ReleaseStock`.
  A late `PaymentReceived` on a cancelled order: `holdStock` again; if refused, `RefundPayment`.
- Refund: `refundOrder` → Order refund `Requested`, `IssueCreditNote` and `RefundPayment` (and
  `CancelShipment` if not dispatched) → `CreditNoteIssued` + `PaymentRefunded` → refund `Done`;
  `RefundFailed` → refund `NeedsStaff`.
- Choreography elsewhere: mails, replicas, sku registration, shop page invalidation.

## Processes

| Process | Runs | Why |
|---|---|---|
| `web` (Next.js hosting Payload CMS) | Payload CMS; driving adapters for editors (Payload admin, hooks into Catalog), customers (shop page, cart and checkout server actions), staff (admin views), Stripe and warehouse webhooks, internal revalidate route, probes `/health`, `/ready`, `/metrics`. Assembly builds Catalog, Ordering, Inventory, Payments, Billing, Fulfillment (driving ports only, no handlers, no relay). | Payload CMS 3 runs inside Next.js; every caller that arrives over HTTP lands here; request-bound, replaced freely. |
| `worker` | relay, bus, every handler of every system, every scheduled task, Payload CMS initialised headless (Local API only) for `PayloadProductSource` and the Payload outbox reader; probes on its own small HTTP server. | Delivery and scheduled tasks must keep running independently of request lifecycles and web deploys; leases and the inbox let two worker instances overlap during a deploy. |
| Tooling (not deployed) | `migrate` (Drizzle Kit, per system schema, run before each deploy), `seed`, architecture tests. | Runs in no process of the deployed application. |

Assembly is `src/processes/<process>/assembly.ts`, the only file per process importing ports and
adapters together. It calls each system builder and hands the result to the courier.

## Directory tree

```
/
├── package.json
├── tsconfig.json
├── biome.json
├── .dependency-cruiser.cjs              # layer and system boundaries (tooling)
├── docker-compose.yml                   # Postgres, Jaeger for local runs and integration tests
├── src/
│   ├── shared-kernel/
│   │   ├── money.ts
│   │   └── sku.ts
│   ├── common/                          # common library
│   │   ├── db/                          # Drizzle client factory per system role, unit of work
│   │   ├── outbox/                      # outbox table shape, Postgres outbox reader factory
│   │   ├── inbox/
│   │   ├── relay/                       # polls readers, leases, backoff, dead letter
│   │   ├── bus/                         # in-process, subscriptions from assembly
│   │   ├── courier.ts                   # per-process ambient: what assembly produced
│   │   ├── logger.ts                    # pino, trace ids from active span
│   │   ├── telemetry.ts                 # OpenTelemetry SDK, OTLP to Jaeger, Prometheus exporter
│   │   └── probes/                      # health, readiness, metrics handlers
│   ├── systems/
│   │   ├── catalog/
│   │   │   ├── GLOSSARY.md
│   │   │   ├── domain/                  # product-change.ts, sku-claim.ts, catalog-entry.ts, specifications/
│   │   │   ├── service/                 # one file per use case
│   │   │   ├── ports/
│   │   │   │   ├── driving/
│   │   │   │   └── driven/
│   │   │   ├── published-language/      # product-changed.v1.ts, open-host-service.ts
│   │   │   ├── adapters/
│   │   │   │   ├── driven/
│   │   │   │   │   ├── postgres/        # schema.ts, repositories, outbox reader
│   │   │   │   │   ├── payload/         # PayloadProductSource, payload outbox translation
│   │   │   │   │   ├── next/            # NextShopPageCache
│   │   │   │   │   └── fake/
│   │   │   │   └── driving/
│   │   │   │       ├── payload-hooks.ts
│   │   │   │       ├── handlers/
│   │   │   │       ├── scheduled/
│   │   │   │       └── web/             # shop page data loader
│   │   │   ├── migrations/
│   │   │   └── builder.ts               # system builder
│   │   ├── ordering/                    # same shape; domain/order.ts is the process manager
│   │   ├── inventory/                   # same shape
│   │   ├── billing/                     # same shape; domain/vat/, domain/numbering/, domain/dunning/
│   │   ├── payments/                    # same shape; adapters/driven/stripe/, adapters/driven/bank/
│   │   ├── fulfillment/                 # same shape; adapters/driven/warehouse/
│   │   └── notifications/               # same shape, no outbox; adapters/driven/mail/, templates in domain/
│   ├── external/
│   │   └── payload/                     # Payload CMS configuration, its terms only
│   │       ├── payload.config.ts        # imports hooks and admin views from systems/*/adapters/driving
│   │       └── collections/             # products.ts, media.ts, users.ts
│   └── processes/
│       ├── web/
│       │   ├── assembly.ts
│       │   ├── instrumentation.ts       # telemetry, then assembly, then courier
│       │   └── app/                     # Next.js routes: thin re-exports of driving adapters
│       │       ├── (shop)/
│       │       ├── (payload)/admin/
│       │       └── api/
│       │           ├── webhooks/stripe/route.ts
│       │           ├── webhooks/warehouse/route.ts
│       │           ├── internal/revalidate/route.ts
│       │           ├── health/route.ts
│       │           ├── ready/route.ts
│       │           └── metrics/route.ts
│       └── worker/
│           ├── assembly.ts
│           ├── main.ts                  # telemetry, assembly, relay, scheduler, probe server
│           └── schedule.ts              # cron table: scheduled task → time
├── tooling/
│   ├── migrate.ts
│   └── seed.ts
└── test/                                # mirrors src/
    ├── systems/<system>/domain/…        # default suite
    ├── systems/<system>/service/…       # default suite, fakes only
    ├── systems/<system>/adapters/…      # integration tests (Postgres container)
    ├── e2e/                             # end-to-end tests: Stripe test mode, mail sandbox, warehouse sandbox
    └── architecture/                    # tooling: asserts boundaries over the source tree
```

## How each property holds

**P1. The domain models the business domain, not what serves it.** Domains import only the shared
kernel and their own files; no Drizzle, Payload, Stripe, Next.js, pino or OpenTelemetry type
(enforced by `.dependency-cruiser.cjs` and `test/architecture`). Every external system is behind
an anti-corruption layer, so its terms stop at the adapters. The one exception taken (P1's
*Except*) is Notifications, conformist to Ordering's and Billing's published language.

**P2. A business rule lives in one place: the domain.** Each rule listed under Systems sits in one
domain as a specification or aggregate method. Services only sequence. Payload CMS configuration
holds no validation of its own: its hooks call Catalog's `vetProductChange` and `claimSku`. VAT
rates and dunning periods are dated tables in Billing's domain, not configuration. Uniqueness of
sku is decided by Catalog's sku claim (its store's unique index enforces what the domain's claim
rule states, against F6).

**P3. Business rules that change together sit together; rules that change for different reasons share nothing either would have to change.**
The system cut follows reasons to change: product content (Catalog), the order's
sequence (Ordering), oversell (Inventory), tax and invoicing law (Billing), money movement and
payment providers (Payments), the warehouse partner (Fulfillment), customer communication
(Notifications). Within a domain, one module per rule family (`billing/domain/vat`,
`billing/domain/numbering`, `billing/domain/dunning`). Systems share only the shared kernel and
each other's published language.

**P4. A use case responds the same whoever calls it and whatever serves it.** Every driving adapter
only translates and calls exactly one driving port; server action, handler, CLI and test reach the
same service. Driven adapters implement ports with the same semantics, verified by one contract
test suite per port run against the fake and the Postgres or API adapter.

**P5. A system reaches the outside, and is reached from it, only through its ports; each port speaks the system's terms.**
Services depend only on port interfaces; assembly is the only place port and implementation meet.
Webhook routes, Payload hooks and handlers translate inbound shapes; Stripe, warehouse, bank, mail
and Payload adapters translate outbound. Systems call each other only through open host services
typed in published language, translated by the caller's driven adapter. Boundaries enforced by
`.dependency-cruiser.cjs` and `test/architecture` (against F3).

**P6. Every use case can run with nothing outside the process.** Every driven port has a fake;
`Clock` and `IdGenerator` are ports. The default suite runs every use case through its system
builder with fakes. Calls to another system go through a driven port, so a fake stands in for it.

**P7. A use case's writes to its own system's records land together or not at all.** Each acting
use case runs in one unit of work: one Drizzle transaction of its system's store, shared by its
repositories, outbox port and inbox port. One use case, one commit. Calls to the outside that
precede the commit are tentative operations or idempotent (stock hold, payment intent creation).

**P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after.**
Consequences of a write leave only as messages written to the outbox in the same transaction;
the relay reads only committed rows. No mail, Stripe call, warehouse call or cache invalidation
runs inside a use case on the strength of its own uncommitted writes: they run in handlers after
commit. Payload CMS's own write is followed through its version rows (an external outbox) rather
than an after-change hook, so a rolled back editor save produces no `ProductChanged`. Relay leases
expire, so a message whose delivery was interrupted by a stop is delivered again.

**P9. A repeated delivery changes nothing in this system.** Every handler-driven acting use case
inserts the message id (per handler) into the inbox in its unit of work, first; a duplicate hits
the unique key and is a no-op; a concurrent redelivery blocks on the key until the first commits
or rolls back. Hooks from external systems use the external event id the same way (Stripe event
id, warehouse event id, bank booking id). Natural keys back this up: holds by order id, invoices by
order id, credit notes by refund id, sku registrations by sku. Outside effects carry the message id
as idempotency key (Stripe, mail provider, warehouse reference = order id); where an external
system does not deduplicate (F9), Fulfillment looks the shipment up by our reference before
creating it.

**P10. A use case commits only on reads that still hold, or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them.**
Every aggregate has a version column; saves are `UPDATE … WHERE version = $read`; a conflict
retries the use case from its reads (three times), then fails. Aggregates are small (cart, order,
stock item per sku, invoice, number series), so only use cases touching the same aggregate
collide. Collisions tied by rules: holds on the same sku (oversell), numbers of one series
(gapless; the series row is locked for the transaction). Stale reads accepted by rule: the cart
and `placeOrder` price from Ordering's catalog replica (rule: the quoted price binds); the shop page
cache until invalidation; `vetProductChange` reading catalog entries.

**P11. No other system changes the records a system owns.** One Postgres role per system with
privileges only on its own schema; every system's Drizzle client uses its role. Records of another
system arrive only as replicas the keeper writes from published messages. Payload CMS writes
product records only when Catalog's hooks allow the change (reading taken, see readings R1).

**P12. Another system's model enters this one only by choice.** Each downstream relation is
declared in the system's `GLOSSARY.md` as anti-corruption layer or conformist (D13). Anti-corruption
layers translate in the adapters that touch the upstream; the architecture test forbids importing
another system's `published-language` from a domain or service unless the relation is declared
conformist.

**P13. A system changes its model without its downstream systems changing.** Published language is
separate code (`published-language/`), mapped from the domain in adapters; the domain can change
freely behind the mapping. Published language changes are additive within a version; a breaking
change adds a new version (`product-changed.v2.ts`) published alongside the old until no handler
subscribes to the old.

**P14. A record or a message means the same to all code that reads it, whenever it was written.**
Every message carries `type` and `schemaVersion`; handlers upcast older versions. Migrations are
expand then contract across at least two deploys, so old and new processes running together
(F4) read the same columns with the same meaning; a column never changes meaning, a new one is
added. Enumerated states of aggregates (Order, Shipment) are only added to, never renamed.
Snapshots in orders keep the price and tax class as placed, so a later catalog change does not
alter what an old order means.

**P15. A system works while others are down or slow, as far as its own data reaches.** Messages
wait in the outbox while a receiver is down; the relay retries with backoff. Ordering prices carts
from its replica, Payments matches transfers against its receivables replica, Inventory computes
availability from its stock count replica. External calls have timeouts; a failed call in a
handler leaves the message for redelivery. Card checkout needs Stripe; invoice checkout does not.

**P16. No transaction spans two systems.** Each system's store is its own schema, role and pool;
the unit of work opens a transaction on one pool only. Calls to another system happen outside the
caller's transaction (stock hold before `placeOrder` commits). Payload CMS's write and Catalog's
writes are separate transactions: the hooks only answer or claim, and `ProductChanged` is written by
Catalog after reading Payload's committed version.

**P17. Work spanning systems ends, and only in a state a business rule allows.** The Order process
manager holds every cross-system sequence; each state has a successor and a timeout. Terminal
states: `Shipped`/`Delivered`, `Cancelled` (stock released, payment cancelled or refunded, invoice
offset by credit note), `Refunded`, refund `NeedsStaff`. Holds expire (tentative operation), so a
crash between `holdStock` and `placeOrder`'s commit ends with stock released. Unpaid card orders
expire; unpaid invoices run through dunning to default and cancellation. `findStuckOrders` repeats
the pending command of any order past its state's timeout. Reconciliations against Stripe, the
bank, the warehouse partner and sku claims repair what a missed hook left. Messages exhausting
retries go to a dead letter state shown on the dashboard, an allowed state needing staff.

**P18. The order messages arrive in does not change the outcome.** The process manager records
facts independently (stock reserved, paid, invoice issued) and advances when the combination
allows, whichever came first. Replicas apply a message only if its aggregate version is newer than
the one held (`ProductChanged`, `SkuRegistered`, `InvoiceIssued`/`InvoiceSettled`). Stock counts
apply only if their as-of is newer; reservations dispatched before a count's as-of are not
subtracted again. Shipment states only move forward. Stripe and warehouse hooks fetch the current
state from the API on every notification rather than trusting the event's order.

## Decisions the document left to me

**D1. The system cut.** Catalog, Ordering, Inventory, Billing, Payments, Fulfillment,
Notifications. Quotes: "A system is one bounded context. It is code with its own domain and its
own glossary."; "Business rules that change together sit together; rules that change for different
reasons share nothing either would have to change"; "The business changes, and so does what is
known of it. Business rules change, the model grows, the cut between systems moves."

**D2. Payload CMS is an external system; Catalog owns product records it keeps.** Rules about
products live in Catalog, reached through Payload hooks. Quotes: "A bounded context whose code this
codebase does not write, though it may configure it: bought or adopted, run by its vendor or by us,
in its own process or in ours."; "Its configuration may hold business rules this codebase writes,
in the external system's terms; its architecture stays its own."; "The system whose business rules
decide what a record holds, wherever it is kept"; "A driving adapter an upstream system calls.";
"A business rule lives in one place: the domain". I chose to keep Payload's configuration free of
business rules, so that P2 holds without reading Payload's configuration as a domain.

**D3. Payload's version rows are its outbox; assembly provides their outbox reader.** Quotes: "The
*outbox reader* is what the relay reads the outbox through, and marks it by; the system provides
it, and for an external system's outbox, assembly does."; "It is driven through its API and
driving through its hooks." The reader reads through Payload's Local API and marks in a relay
table, never in Payload's tables.

**D4. Orchestration for orders, choreography for side effects.** Order is the process manager;
mails, replicas, sku registration and cache invalidation are choreographed. Quotes: "One system's
*process manager* holds the sequence across systems: an aggregate whose state is where the sequence
stands."; "Each system reacts to the others' events and decides for itself what to do next. No one
holds the whole sequence."; "Work spanning systems ends, and only in a state a business rule
allows".

**D5. One Postgres instance, one store per system.** Schema, role and pool per system. Quotes:
"Two clients are one store when their writes commit together, two stores until they do.";
"No transaction spans two systems"; "No other system changes the records a system owns".

**D6. Outbox, relay, bus, inbox mechanics.** Polling relay with leases and backoff, in-process bus,
per-handler inbox, dead letter after 10 attempts. Quotes: "Where a system's outgoing messages wait
until they are delivered."; "The mechanism that reads outboxes and hands each message to the bus.
Assembly hands it the outbox readers."; "What delivers a message to the handlers subscribed to it.
Assembly hands it the handlers."; "A message can arrive more than once, a redelivery while the
first attempt still runs, and after one sent later."

**D7. Two processes, `web` and `worker`.** Quotes: "run as one or more processes"; "A deploy
replaces processes one at a time, and records and messages outlive the code that wrote them."

**D8. Stock hold is a synchronous tentative operation with a 30 minute expiry, converted by a
command.** Quotes: "A request to another system for a commitment that leaves open the possibility
of cancellation. It changes nothing it asks for: its confirmation does."; "A process can stop
between any two of its instructions".

**D9. Card payment intent is created before Payments commits, with the order id as idempotency
key; automatic capture.** Quotes: "A use case's writes to its own system's records land together
or not at all"; "An external system holds none of these properties".

**D10. Every order gets an invoice; card invoices are issued after payment, already settled;
transfer invoices at placement, due in 14 days.** Quotes: none.

**D11. Gapless numbers by a locked counter row per series; credit notes their own series.**
Quotes: "use cases fail each other only where a business rule ties them".

**D12. Prices are gross; VAT is extracted in Billing; rates are dated tables in Billing's domain.**
Quotes: "A business rule lives in one place: the domain".

**D13. Relations.** Anti-corruption layer everywhere except Notifications, conformist to Ordering's
and Billing's published language (templates follow their messages). Quotes: "Another system's
model enters this one only by choice"; "its ports become the downstream's driven ports and its
published language is used untranslated, in any layer including the domain."; "translates the
upstream's published language into its own in every adapter that touches the upstream".

**D14. Shared kernel: `Money`, `Sku`.** Tax class stays Catalog's published language; Billing
translates. Quotes: "A model several systems of this codebase share as code and agree on together,
each importing it into its domain: `Money`, `Sku`. A change to it is a change to each."

**D15. Replicas: catalog items in Ordering, receivables in Payments, stock counts in Inventory.**
Quotes: "A copy of another system's data, kept under the owner's ids and shaped as this system
writes it"; "A system works while others are down or slow, as far as its own data reaches".

**D16. Order-insensitivity by versions, monotonic states and fetch-on-notify.** Quotes: "The order
messages arrive in does not change the outcome"; "and after one sent later."

**D17. Schema evolution: expand/contract migrations, `schemaVersion` with upcasters, additive
published language, parallel versions for breaking changes.** Quotes: "A record or a message means
the same to all code that reads it, whenever it was written"; "A system changes its model without
its downstream systems changing".

**D18. Shop page cache.** Next.js data cache tagged per product, invalidated by Catalog's handler
on `ProductChanged` via the web process's internal revalidate route; no CDN, no Redis. Quotes: "Out
of scope: throughput and load, security, user interfaces."

**D19. Courier.** Per-process ambient value set by each process's assembly, read by Next.js routes,
server actions, Payload hooks and admin views; per-request ambient values are the OpenTelemetry
context (trace) and the request id, carried in messages as `traceparent`. Quotes: "How a driving
adapter reaches what assembly produced when assembly cannot hand it over as an argument.";
"per request, what the current request carries, like a request id, a trace context or a locale."

**D20. Probes.** `/health` (alive), `/ready` (store reachable, migrations at expected version),
`/metrics` (OpenTelemetry Prometheus exporter: outbox lag, dead letters, delivery attempts) in both
processes; traces over OTLP to Jaeger; pino with trace ids. Quotes: "Code a process runs to report
on itself rather than on a system: whether it is alive or ready, its metrics. `/health`,
`/metrics`."

**D21. Dunning periods and default leading to cancellation and credit note.** Quotes: "Work
spanning systems ends, and only in a state a business rule allows".

**D22. Refunds start in Ordering, from the admin dashboard, as a process manager step.** Quotes:
"Each step is a use case of that system that sends commands to the others."

**D23. Mails: inbox row first, send with message id as idempotency key, commit.** A duplicate mail
after a stop between send and commit is accepted where the provider does not deduplicate. Quotes:
"A repeated delivery changes nothing in this system"; "An external system holds none of these
properties, and its contract follows its own model".

**D24. Scheduled tasks run in `worker` only, guarded by a Postgres advisory lock per task; the
use cases they call stay safe when two run at once.** Quotes: "A driving adapter the clock calls.";
"Two use cases can run against the same records at once."

**D25. Boundaries enforced by tooling.** dependency-cruiser and architecture tests. Quotes: "People
and agents change code having read only part of it."; "Code that runs in no process of the deployed
application: a developer CLI, a seed script, a test that asserts about the source tree."

**D26. Tests.** Default suite: domain and services with fakes; integration tests per Postgres
adapter in a container; end-to-end tests against Stripe test mode, mail sandbox, warehouse
sandbox; one contract suite per driven port run against fake and real adapter. Quotes: "A working
implementation of a port that reaches nothing outside the process"; "The tests run by default:
every test that is neither an integration test nor an end-to-end test."

**D27. Products are archived, never deleted; sku immutable after first publish; sku uniqueness by
Catalog sku claims keyed by a Payload-defaulted product uuid, orphans released by
`reconcileSkuClaims`.** Quotes: "A use case that compares, after the fact, what this system
recorded with what another system holds, and repairs this system's record".

**D28. Sellable = published and sku registered, decided in Ordering's domain from its replica.**
Quotes: none.

**D29. Next.js hosts Payload CMS (Payload 3 requires it); no customer accounts; no shipping costs.**
Quotes: none.

**D30. Commands are refused by a refusal event, not a reply.** Quotes: "A *command* says do this,
to the one system that offers it, which may refuse."

## Sentences I had to pick a reading for

**R1.** "No other system changes the records a system owns" with "The system whose business rules
decide what a record holds, wherever it is kept". (a) No code of another system may write the
record at all, so Payload CMS could not write product records Catalog owns. (b) No other system
decides a change; a keeper executing writes the owner's rules allowed is not changing them. Took
(b): Payload CMS writes product records only through Catalog's hooks.

**R2.** "of a record no business rule decides, the system that keeps it." (a) Ownership per record
(row): if any rule decides any field, the rule's system owns the row. (b) Per field: copy and
images, decided by no rule, would be Payload's, price and sku Catalog's. Took (a): the glossary
defines record as "a row in a relational store".

**R3.** "Two clients are one store when their writes commit together, two stores until they do."
(a) *can* commit together (same Postgres instance makes all schemas one store). (b) *do* commit
together as built. Took (b): per-system pools make separate stores on one instance.

**R4.** "A repeated delivery changes nothing in this system". (a) Nothing in this system's records
changes. (b) Nothing observable anywhere changes, including mails sent. Took (a), with idempotency
keys outward as best effort (D23).

**R5.** "Every use case can run with nothing outside the process". (a) Can be assembled with fakes
and run, e.g. in the default suite. (b) Keeps running in production while the outside is
unreachable. Took (a); (b) is P15's subject.

**R6.** "A use case responds the same whoever calls it and whatever serves it". (a) The same
response for the same state of records, whichever driving or driven adapter. (b) Also no driving
adapter may reuse an earlier response (cache). Took (a): the shop page cache reuses an earlier
response of `browseShop`; the use case itself responds the same.

**R7.** "Work spanning systems ends". (a) Reaches a successful completion. (b) Reaches a state
with no automatic step pending. Took (b), limited to states a business rule names (cancelled,
refunded, refund needs staff, dead letter).

**R8.** "Each use case either acts or answers." (a) An acting use case returns nothing. (b) An
acting use case may return its outcome or refusal; an answering one writes nothing. Took (b):
`holdStock`, `claimSku` and `startCardPayment` act and return their outcome.

**R9.** "The *outbox reader* is what the relay reads the outbox through, and marks it by". (a)
Marks are written into the outbox itself. (b) The reader marks wherever it keeps marks. Took (b)
for Payload's outbox (marks in a relay table, since Payload's tables are not ours); (a) for our
own outboxes.

**R10.** "A specialized driven port over exactly one aggregate". (a) One aggregate type. (b) One
aggregate instance. Took (a).

**R11.** "*Published*: meant for other systems. *Private*: meant only for the system that wrote
it." A command Ordering writes in Inventory's published language: (a) published, because it is
meant for another system; (b) Ordering's private, because Ordering wrote it. Took (a). Catalog
handling its own published `ProductChanged` does not make it private.

**R12.** "Its configuration may hold business rules this codebase writes, in the external system's
terms" with "A business rule lives in one place: the domain". (a) Rules in an external system's
configuration are allowed beside P2, as its configuration counts as that rule's place. (b) P2
binds: the configuration may hold them but should not. Took (b) for Payload CMS (D2).

**R13.** "Hook. A driving adapter an upstream system calls." with Payload CMS calling Catalog
while Catalog owns the records. (a) Payload CMS is upstream of Catalog (Catalog adapts to its hook
API and its Local API). (b) Catalog is upstream, as owner. Took (a): upstream is decided by who
offers the API the other adapts to.

**R14.** "A system changes its model without its downstream systems changing". (a) Model means
domain only; published language may break. (b) Model includes published language. Took (a) for
the domain, and versioned published language so downstream need not change on its change either.

**R15.** "nothing final follows from it before it commits". (a) Any outside call before commit is
forbidden. (b) Only consequences of the uncommitted write itself are forbidden; tentative
operations and idempotent calls the write depends on may precede it. Took (b) (D8, D9).
