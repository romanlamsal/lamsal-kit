# Persona review B

Draft reviewed: `reviews/07/persona-input-b.md` (called "the draft"), against `reviews/07/brief.md`, with
`glossary.md` read for vocabulary. Severity scale: low / moderate / high, as the author would rate it.
Quotation marks only where wording was verified (see Sources) or is well-established; everything else
is paraphrase and marked so.

## Khononov

### Endorse

- **Four bounded contexts, each with its own `glossary.md`** (`src/systems/*/glossary.md`). Learning
  DDD ch. 3 (Managing Domain Complexity) ties a ubiquitous language to one bounded context, and allows
  one team to own several contexts. One team, one codebase, four contexts fits that.
- **Integration patterns named per relation** (ch. 4, Integrating Bounded Contexts): open host service
  (`payment`'s `CardPaymentsService` with primitive-typed published language), anti-corruption layers
  (`CardPayments` in shop "ACL in front of payment's open host service", `CatalogSource` in shop and
  fulfillment), shared kernel kept to value types (`src/kernel/`). He'd see the context map drawn
  explicitly in the "Calls and messages" tables.
- **Outbox, relay, at-least-once delivery, idempotent consumers** (ch. 9, Communication Patterns,
  outbox pattern). Every outbox write sits in the service's transaction; handlers ack after commit.
- **Orchestration and choreography chosen per process and said out loud** ("the order is orchestrated
  by `shop` ... invoicing, refunds after invoicing and dunning are choreographed"). Ch. 9 gives saga
  and process manager as distinct tools for exactly this choice.
- **Event types chosen deliberately** (ch. 15, Event-Driven Architecture): `payload.ProductSaved.v1`
  as event notification plus a fetch; `shop.OrderShipped.v1` as event-carried state transfer, so
  billing snapshots lines and never queries shop. Both match his catalogue of event types.
- **Domain model with pure domain and ports and adapters** (ch. 6 Tackling Complex Business Logic,
  ch. 8 Architectural Patterns) where the rules are real: `shop/domain/placement.ts`,
  `billing/domain/{invoice,number-series,auto-match,dunning}.ts`. Version-compared saves
  (`Orders.save` "insert or version-compared update") are his optimistic-concurrency advice for
  aggregates (ch. 6, paraphrase).
- **Testing shaped by pattern** (ch. 10, Design Heuristics): domain tests, service tests on fakes,
  contract tests on memory and Postgres. For a domain model he points to a test pyramid (paraphrase).

### Flaws

1. **No subdomain analysis; one architecture for all four contexts.** Ch. 1 (Analyzing Business
   Domains) sorts subdomains into core, supporting, generic; ch. 10 then picks the implementation
   pattern per subdomain: transaction script or active record for simple supporting/generic logic,
   domain model for complex core logic, and the architecture follows (layered for the simple ones,
   ports and adapters for domain model) (paraphrase). The draft gives `fulfillment` and `payment`,
   which are mostly translation around the 3PL and Stripe (`Warehouse`, `CardGateway`), the same
   `domain/` + `services/ports/{driving,driven}` + `adapters/{driven,driving}` + `offer/` + fakes +
   contract tests as `billing`. He would classify, then drop `fulfillment` and `payment` to
   transaction scripts behind a thin layered structure. Severity: moderate.
2. **Boundaries narrower than the knowledge justifies, and the narrowness creates the hardest code.**
   He argues (ch. 10/11, paraphrase; see Sources on which chapter) that when knowledge of the domain
   is thin, start with wider bounded contexts and split later. Here "available stock" (brief: 3PL
   figure less placed-not-passed reservations) is cut across two contexts: shop's `Stock` holds
   reservations, fulfillment's `SkuStock` holds the 3PL figure. Key sequence 5 (version counter
   raised on booking, `ShipmentBooked{stockVersions}`, `RefreshStockLevel`, release when report
   version > `bookedAtVersion`) exists only because of that cut. In one context, booking and
   reservation release commit in one transaction. He'd merge stock and booking into one context (or
   fold `fulfillment` into `shop` behind a `Warehouse` port). Severity: moderate to high.
3. **Several aggregates in one transaction without stated reason.** He states (ch. 6, paraphrase)
   that the aggregate is the transactional boundary and one database transaction should commit one
   aggregate; cross-aggregate changes are eventually consistent. The draft commits several
   repeatedly: `placeOrder` saves `Order`, `Cart`, every touched `Stock` (sequence 1);
   `invoiceShippedOrder` saves `Invoice` and `NumberSeries` and applies `DisputeLoss` (sequence 7);
   `matchTransfer` saves `Transfer` and `Invoice` (sequence 8). The brief forces atomicity for
   "no unit is sold to two orders" and gapless numbers, so the cases may be justified, but the draft
   only says "tied by the gapless rule" for one of them. He'd either redraw the aggregates so the
   invariant sits inside one, or state each multi-aggregate commit as a deliberate exception.
   Severity: moderate.
4. **`Order` doubles as process manager.** Ch. 9 describes the process manager as a separate,
   stateful component that sends commands (paraphrase). `Order` carries "payment deadline;
   booking-overdue moment; dropped lines; status" and `OrderProgress` emits `BookShipment`,
   `RefundCardPayment`, `CancelCardPayment`, `BookingOverdue`. Workable, but the business entity
   and the process state are entangled. He'd extract an `OrderFulfilmentProcess` or accept it
   knowingly. Severity: low.
5. **Billing may be generic.** German invoicing with gapless series, credit notes, dunning and bank
   matching is what off-the-shelf accounting tools sell; ch. 1 says generic subdomains are bought or
   adopted (paraphrase). The brief does not name such a tool, so building it stays within the
   constraints; he would still ask the question before investing a domain model. Severity: low.

### Would absolutely not do

Nothing in the draft hits a position he states as a hard refusal; his book frames its guidance as
heuristics (ch. 10). His sharpest objection is flaw 2.

## Evans

### Endorse

- **Explicit bounded contexts, a context map in all but name.** DDD ch. 14 (Maintaining Model
  Integrity): bounded context, context map, open host service, published language, anti-corruption
  layer, shared kernel. The draft names each relation and translates at the edge: shop's
  `adapters/driven/payment/card-payments.ts` "maps `clientSecret` to shop's `CardPaymentSecret`"; the
  Payload REST product is parsed and mapped to `CatalogProductFacts`. That is the ACL as he described
  it: "Create an isolating layer to provide clients with functionality in terms of their own domain
  model" (ch. 14).
- **Payload treated as another context, not as our model.** Product rules live in Payload's config
  "in its terms"; shop keeps a replica `CatalogProduct` projected into its own terms. Exactly the
  stance ch. 14 takes towards a legacy or purchased system.
- **Aggregates drawn around invariants.** `Stock` per sku holding reservations is the aggregate that
  can enforce "no unit sold to two orders"; `Invoice` keeps its lines, payments, credit notes, dunning
  stage. Ch. 6: an aggregate is a cluster treated as a unit for data changes, guarding invariants.
- **Snapshots and immutability as model facts.** Order lines keep price, sku, tax class; invoices
  never change; corrections are credit notes. Value objects in ch. 5: `Money`, `EmailAddress`,
  `GermanDeliveryAddress`.
- **Specifications** (`catalog-product.ts` "forSale specification"; `payment-methods.ts`). Ch. 9
  (Making Implicit Concepts Explicit) introduces Specification for exactly such yes/no rules.
- **Thin application layer.** Services "hold the sequence"; rules sit in `domain/`. Ch. 4 (Isolating
  the Domain): the application layer is "kept thin" and holds no business rules, only coordinates
  tasks.
- **Repositories leave transaction control to the client.** Every repository method takes `tx`; the
  service opens and commits. Ch. 6, Repositories: "Leave transaction control to the client."
- **Domain events in past tense** (`OrderShipped`, `CardPaymentSucceeded`, `DebtorStatusChanged`).
  Not in the 2003 book; he added Domain Events in the DDD Reference (2015).

### Flaws

1. **No core domain.** Ch. 15 (Distillation) asks to identify the core domain, write a domain
   vision statement, and put the best effort there; generic subdomains get less. The draft spends
   identical effort on every context. For a tea shop the differentiating part (curation, catalog)
   is in Payload; of what this codebase writes, checkout and stock arguably are core, billing and
   fulfillment are not. He'd name the core and let the rest be plainer. Severity: moderate.
2. **Ubiquitous language slips in the code.** The system is `fulfillment`, its outbox port in shop is
   `FulfilmentRequests` (`shop/services/ports/driven/fulfilment-requests.ts`); the brief writes
   "Fulfilment". The concept "booking" (`bookShipment`, `BookingOverdue`, `ShipmentBooked`) vs "warehouse
   order" (`createOrder`, `warehouseOrderId`) vs "passed to the 3PL" (brief) are three names for
   one step. "Refund" is `Refund` (billing), `CardRefund` (payment), `requestRefund` with reasons
   (shop). Ch. 2 (Communication and the Use of Language) treats such drift as a modelling defect, not
   cosmetics. Severity: low to moderate.
3. **Shared kernel carries a tax rule.** `src/kernel/money.ts` has `vatPartOfGross(rate)` "with
   half-up rounding". Rounding of VAT is billing's legal rule; `payment` and most of `shop` don't need
   it but now share it, and a change to it is a change to all three. The DDD Reference puts it:
   "Designate with an explicit boundary some subset of the domain model that the teams agree to
   share. Keep this kernel small." He'd keep `Money` arithmetic in the kernel and move VAT into
   `billing/domain/tax-rates.ts`. Severity: low.
4. **Refund rules spread across three contexts.** Billing decides operator refunds
   (`Refunds.refundOrder`) but doesn't consume `payment.ChargeDisputed.v1` (only `DisputeLost`), so
   it accepts a refund the brief forbids ("A disputed charge gets no further refund") and learns of
   the refusal only via `CardRefundRefused`. Shop requests pre-invoice refunds directly from payment.
   He'd put the decision "may this be refunded" in one model (billing, with dispute state as input).
   Severity: moderate.
5. **Repository ports moved out of the domain.** In ch. 6 the repository interface is part of the
   domain layer's vocabulary; here it is in `services/ports/driven/`, with `tx` on each method, and the
   domain never sees it. Not wrong, a functional-core reading of his layering; he'd notice. Severity:
   low.
6. **Multi-aggregate commits** (same cases as Khononov flaw 3). His own text is softer: rules that
   span aggregates are not expected to be consistent at every moment and are resolved by events or
   batch updates (ch. 6, paraphrase). He'd ask whether `Cart.checkedOut` must commit with `Order` or
   could follow by event. Severity: low.

### Would absolutely not do

No outright refusal. The draft does the things he warns hardest against avoiding: models mixed
without boundaries, and a foreign model leaking into the core. Neither happens here.

## Cockburn

### Endorse

- **The intent is met.** His article states it: "Allow an application to equally be driven by users,
  programs, automated test or batch scripts". Shop's services are driven by HTTP routes, server
  components, the Payload `afterRead` hook, message handlers, and by Vitest on fakes
  (`test/systems/shop/services/*.test.ts`), unchanged.
- **Driving and driven, his own terms.** "A primary actor is an actor that drives the application";
  "They could be also called driving adapters and driven adapters." The draft's folder split
  `ports/driving` / `ports/driven`, `adapters/driving` / `adapters/driven` is that.
- **Many adapters per port, the in-memory one included.** "There will typically be multiple adapters
  for any one port"; he motivates the pattern with a database stand-in "that sits in memory and
  doesn't depend on the presence of the real database at all". The draft has `adapters/driven/memory/`
  for every driven port and contract tests run on memory and on Postgres (`TEST_IMPL=real`).
- **Ports named by purpose, not technology.** `FulfilmentRequests`, `PaymentRequests`, `ShopEvents`,
  `ShopSchedule` instead of one "Outbox" port; `CardGateway`, `Warehouse`, `BankStatements` instead
  of "StripeClient", "HttpClient". His Known Uses section reports moving to interfaces "by purpose
  rather than by technology".
- **Hexagons calling hexagons through ports.** Shop's driven `CardPayments` port sits in front of
  payment's driving `CardPaymentsService`; the glossary's "seen from the caller, this system's
  driving port lies behind one of the caller's driven ports" is his picture.

### Flaws

1. **Far too many ports.** He writes "My selection tends to favor a small number, two, three or four
   ports" and calls one port per use case ("every use case could be given its own port, producing
   hundreds of ports") an extreme; "Neither extreme appears optimal." Shop alone has 9 driving ports
   and 17 driven-port files (`ports/driving/{carts,...,shop-ops}.ts`,
   `ports/driven/{orders,...,customer-mailer}.ts`); billing has 19 driven-port files. Clock and id
   generator are ports in their own right. He'd group them into a few purposeful conversations
   (e.g. "storefront and checkout", "order progress", "operations" in; "persistence", "notification",
   "payment provider", "warehouse" out). He also says choosing the wrong number does no particular
   damage, so: severity low to moderate.
2. **Driving ports reveal how they are reached.** `MessageRef = { messageId }` on every acting port a
   handler calls (`OrderProgress.recordCardPaymentSucceeded(input: MessageRef & ...)`), and
   `eventId` on `Shipments.recordShipmentReport`. "The application is blissfully ignorant of the
   nature of the input device." A field named after the bus is a delivery detail in the port. He'd
   rename it to an idempotency key the port defines, and let the handler map message id to it.
   Severity: low.
3. **Transaction threaded through every driven port** (`byId(tx: ShopTransaction, ...)`). The
   article does not mention transactions, so no published position; inference only: every secondary
   conversation now carries a persistence concept, and the fakes must emulate staged writes
   ("keeps staged writes per transaction ... applies them on `commit`"). He'd likely accept it as the
   price of the store, not endorse it. Severity: low (no published basis).
4. **Business rules in a UI framework's configuration.** His article opens on "infiltration of
   business logic into the user interface code" as the problem the pattern solves. "Price above
   zero", "sku unique", "sku fixed once saved" live in `src/external/payload/collections/products.ts`
   and can only be tested with Payload running. The draft's answer is that Payload is an external
   system whose rules are its own; he'd accept that only if the shop treats Payload as an outside
   application and checks what it relies on at its own port (shop's `CatalogSource` maps, but the
   draft does not say shop re-checks price > 0 or sku presence). Severity: moderate.

### Would absolutely not do

Nothing he refuses outright. Flaw 4 comes closest to the problem his pattern was written against,
but the draft keeps it outside its own hexagons on purpose.

## Helland

### Endorse

- **Idempotent processing everywhere, visible to the application.** `HandledMessages.claim` in the
  same transaction as the change, `alreadyRecorded` / `alreadyBooked` answers, stable message ids,
  ack after commit. "Life beyond Distributed Transactions" (CIDR 2007, ACM Queue 2016): "scale-agnostic
  applications are evolving to support idempotent processing of all application-visible messaging."
  Also "Idempotence Is Not a Medical Condition" (ACM Queue, 2012).
- **No transaction across systems.** Separate schema and role per system, "none carries a transaction"
  between systems; consistency between them only by messages. His entity is "the boundary of
  atomicity" ("Life beyond", quoted via acolyer); the draft applies that at system level.
- **Reservation as tentative operation, held by the entity.** `Stock` per sku keeps the reservations
  of placed orders (per-partner state, his "activities"); a reservation is confirmed when the 3PL's
  figure covers it and cancelled at the payment deadline. "Life beyond" uses an ordering system
  reserving warehouse inventory as its tentative-operation example (paraphrase via secondary sources).
  The glossary's "tentative operation" is his idea.
- **Versioned outside data, receiver keeps the highest.** `StockLevelReported{version}`,
  `DebtorStatusChanged{version}`, "receiver keeps highest version". "Data on the Outside versus Data on
  the Inside" (CIDR 2005) argues that data sent between services is immutable and versioned, and that
  the receiver reasons about which version it holds (paraphrase).
- **Idempotency carried to the vendors.** 3PL order `reference = shipmentId`, a 409 maps to
  `orderByReference`; Stripe idempotency key `payment:<paymentId>`; refund ids `<orderId>:late`,
  `<orderId>:dropped`. Retrying through a partner that dedupes is his recipe.
- **Accountants don't use erasers.** Invoices never change; corrections are credit notes; `Transfer`
  rows insert-once by bank id. His 2007 blog post of that title, revisited in "Immutability Changes
  Everything" (CIDR 2015 / ACM Queue 2016).
- **Guesses and apologies made explicit.** `payment-methods.ts` "stale replica accepted";
  `late-payment.ts` refunds a payment that arrives after cancellation; `mail-repeats.ts` accepts a
  duplicate mail. His "Memories, Guesses, and Apologies" (blog, 2007) and "Building on Quicksand"
  (Helland and Campbell, CIDR 2009) argue for exactly this: act on local knowledge, apologise when it
  was wrong (paraphrase).

### Flaws

1. **The deadline is decided by the entity that doesn't hold the fact.** `expireUnpaidOrder` cancels
   on shop's view of the order; payment's truth arrives via Stripe webhook -> payment tx -> outbox ->
   relay -> pg-boss -> shop. A customer who paid at minute 29 while the worker lags, or while Stripe
   retries a webhook the web process missed, gets a cancellation mail and a refund
   (`RefundCardPayment{<orderId>:late}`). The apology works, but it's avoidable: ask payment
   (`CardPaymentsService.status`, already offered) before cancelling, or let `payment` own the
   deadline and publish `CardPaymentExpired`. Severity: moderate.
2. **Replica refresh by live read has no version.** `payload.ProductSaved.v1 {productId}` is a
   notice; both handlers "ask Payload REST for the product now". Two saves in a row, two fetches,
   and the slower first fetch can save the older document after the newer one. "Later messages arrive
   before earlier ones" (his paper, quoted via acolyer) applies equally to answers. Keep Payload's
   `updatedAt` (or a revision) in `CatalogProduct` and keep the highest, as the draft already does for
   stock and debtor status. Severity: moderate.
3. **Checkout commits across many entities.** `placeOrder` commits `Order`, `Cart` and one `Stock`
   per sku atomically. His upper layer assumes no atomicity across entities so that entities can be
   spread across machines. On one Postgres it works; it binds every sku's stock to one store forever.
   At this shop's scale he would not insist; as a principle it is the one place the draft relies on
   what his paper says not to. Severity: low at this scale.
4. **Outside call inside the step, ordering of facts left implicit.** Sequence 4: `bookShipment`
   "claims message id; ... commits nothing yet, calls `Warehouse.createOrder` ..., then in its
   transaction saves". Correctness rests on the 3PL deduping by reference, which is right. But if the
   3PL's shipment webhook arrives while that transaction is open or after a crash before it
   committed, `recordShipmentReport` answers `unknownOrder`, and the draft doesn't say whether that
   is a non-2xx (3PL resends) or a 200 (report lost, no invoice ever). It must be non-2xx.
   Severity: moderate.
5. **No reconciliation with the authoritative partners.** The glossary defines reconciliation, the
   draft has none except the nightly stock refresh. Nothing compares shop's `awaitingPayment` orders
   with Stripe, `Shipment{booked}` with the 3PL's orders, or `CardRefund{pending}` with Stripe beyond
   `RefundOverdue` listing. His position that messages get lost, duplicated and reordered and the
   application must converge anyway (paraphrase, "Life beyond", "Building on Quicksand") argues for a
   periodic compare-and-repair at each vendor seam. Severity: moderate.

### Would absolutely not do

Nothing. His outright refusal, distributed transactions across services (two-phase commit), is
absent: the draft never opens a transaction across systems or across the vendor APIs.

## Where they disagree

1. **Message id in driving ports** (`MessageRef`). Helland: idempotence must be application-visible;
   the use case should see the key it dedupes on. Cockburn: the port should be ignorant of the input
   device; call it an idempotency key, not a message id. Khononov: accepts it as part of the outbox
   and idempotent-consumer pattern (ch. 9). Evans: no published position.
2. **Several aggregates in one checkout transaction.** Khononov: one aggregate per transaction, so
   redraw or justify (ch. 6). Evans: rules across aggregates may lag, but he leaves it to the
   business whether they must (ch. 6); softer. Helland: atomicity stops at the entity, for scale;
   at one Postgres a concession, not a refusal. Cockburn: no published position.
3. **Are `payment` and `fulfillment` contexts at all?** Khononov: start wide, merge them into shop
   until knowledge says otherwise (ch. 10/11). Evans: they mostly translate Stripe's and the 3PL's
   models, which in ch. 14 terms is an anti-corruption layer (facade, adapter, translator) of shop,
   not a context with its own published language. Helland: separate entities owning their own
   facts are fine, even preferable, if each is idempotent and versioned; the draft is. Cockburn: no
   position on how many hexagons; each is fine as long as it is driven through ports.
4. **Event notification plus fetch vs carried state** (`ProductSaved` vs `OrderShipped`). Khononov
   (ch. 15): notification plus fetch is a legitimate way to always read the current state.
   Helland: what crosses the boundary should be an immutable, versioned fact; a live read of
   another's inside data without a version is the weak point (Helland flaw 2).
5. **Port granularity.** Evans: one repository per aggregate root that needs global access (ch. 6),
   which yields many repository ports naturally. Cockburn: two to four purposeful ports; a
   "persistence" conversation, not one per aggregate.
6. **Shared kernel.** Evans: legitimate if small and changed only by agreement. Khononov: legitimate,
   cheapest inside one team (ch. 4). Both would move the VAT rounding out. Helland and Cockburn: no
   published position.

## Buildability

**Verdict:** Buildable as drafted on Next.js 15 + Payload 3 + Drizzle + pg-boss 10 on one Postgres;
nothing is impossible. Four spots fight the frameworks (Drizzle's callback transactions vs
`open()/commit()`, module-level couriers across Next.js bundles, prerendering against an empty
courier, connection count across six pools) and the tree misses files Payload and Next.js require.

What breaks or fights:

1. **`ShopTransactions.open(): Promise<ShopTransaction>` vs Drizzle.** Drizzle offers
   `db.transaction(async (tx) => ...)`, callback-scoped, no handle with `commit()`/`rollback()`.
   `shop/adapters/driven/postgres/transaction.ts` must check out a `pg` client from the pool, issue
   `BEGIN`, wrap it with `drizzle(client)`, and issue `COMMIT`/`ROLLBACK` and `release()` itself. Doable
   and type-safe with the `WeakMap`, but every service now needs `try/finally` or the client leaks
   (each leak permanently takes a pool slot). Give `ShopTransaction` a `[Symbol.asyncDispose]` and
   use `await using tx = await transactions.open()` (Node 24 supports explicit resource management)
   so rollback-and-release is automatic.
2. **Couriers as module singletons in Next.js.** `src/instrumentation.ts` `register()` fills
   `shopCourier`; route files, server components, server actions (`billing/.../http/ops-actions.ts`) and
   the Payload config (`availability-field.ts` via `@payload-config`) read it. Next.js compiles these
   into different bundles/layers, and in dev HMR re-evaluates modules; a module-level variable filled
   in one may be empty in another. Keep the courier's state on `globalThis` under a `Symbol.for(...)`
   key in `src/lib/courier/courier.ts`. Also `register()` runs for the Edge runtime too: guard with
   `process.env.NEXT_RUNTIME === 'nodejs'` and import `assembly.ts` dynamically, or the Edge build
   tries to bundle `pg`.
3. **Prerender at build time.** `next build` prerenders `(store)/page.tsx` and
   `products/[slug]/page.tsx` unless they are dynamic; `instrumentation` has not run, the courier is
   empty, the build fails. Mark them `dynamic = 'force-dynamic'` or `revalidate = 60` (the brief's
   "within a minute") and make sure the first render happens at request time.
4. **Connection budget.** `createPools` makes "one pg.Pool per role": six roles (`shop_app`,
   `payment_app`, `fulfillment_app`, `billing_app`, `payload_app`, `bus_app`), `pg.Pool` default
   `max` 10, in `web` and in `worker`, plus Payload's own adapter pool. That is about 120+ connections
   at one instance each against a default `max_connections` of 100. Set `max` per pool explicitly.
   Sequence 4 holding a transaction open across the 3PL HTTP call makes this worse under 3PL latency.
5. **Missing Payload and Next.js files in the tree.** The draft relies on Payload REST
   (`GET /api/products/:id`) but the tree lists only `(payload)/admin/[[...segments]]/page.tsx`;
   Payload 3 also needs `(payload)/api/[...slug]/route.ts`, `(payload)/layout.tsx` and the admin import
   map. With `(payload)` and `(store)` as route groups, each needs its own root `layout.tsx`, and
   `app/ops/*` pages, outside any group, need one too; none are listed. Next.js resolves
   `/api/checkout` and `/api/hooks/*` before Payload's `/api/[...slug]` catch-all, so the paths
   coexist.
6. **Worker calls Payload over HTTP to the web process.** The worker doesn't run Payload, so shop's
   and fulfillment's `CatalogSource` must call `web`'s REST API; no `PAYLOAD_BASE_URL` is among the
   configuration values (`config.payloadApi` appears in `assembleWeb` only). The worker's product
   handlers then fail whenever `web` is down; acceptable given redelivery, but it is a cross-process
   dependency the process table doesn't show. Each such REST read also fires the `afterRead`
   availability hook, i.e. a shop DB read per catalog fetch.
7. **No operator authentication.** `/ops/*` pages and server actions take `operator: OperatorId`,
   but nothing says where it comes from or what guards `/ops`. Payload's auth (users collection,
   `payload.auth({ headers })`) is at hand; without it, refunds and transfer assignment are public
   server actions.
8. **pg-boss in `web`.** `fillDeliveryProbe({ boss: await startBoss(pools.bus) })` starts a full
   pg-boss instance in each web process, which by default also runs maintenance and cron supervision.
   Start it with supervision and scheduling off in `web`. In pg-boss 10 every queue (and each
   `__parked` dead-letter queue) must be created with `createQueue` before `send`/`work`, and
   `publish` only reaches queues registered with `subscribe(type, queue)`; `createBus` has to do both.
   Check that a re-`publish` with the same `id` after a relay crash is a no-op rather than an error;
   handlers dedupe either way.
9. **Temporal in Drizzle and Zod.** `Temporal.Instant` and `Temporal.PlainDate` in port signatures need
   Drizzle `customType` columns and `z.custom` / `z.instanceof` schemas; small, but in every
   `tables.ts`.

What is fine:

- Stripe webhook in an App Router route: `await req.text()` gives the raw body
  `stripe.webhooks.constructEvent` needs. Idempotency-keyed `paymentIntents.create`, `cancel`,
  `refunds.create`, and `charge_disputed` as a refund error code all exist.
- Payload 3 on Postgres in its own schema (`postgresAdapter({ schemaName })`), `afterChange` writing
  `payload.create({ collection: 'outbox', data, req })` inside the same transaction by passing `req`,
  virtual fields filled by `afterRead`, `update` access denied on `sku`.
- pg-boss 10: `startAfter` for the 30-minute and 4-hour held-back messages, `schedule` with `tz`,
  dead-letter queues, retention per queue.
- Relay `FOR UPDATE SKIP LOCKED` over five readers, at-least-once into pg-boss.
- Branded ids, discriminated-union outcomes, `WeakMap` for the Drizzle handle: plain TypeScript, no
  casts needed.
- drizzle-kit per schema (`drizzle/*.config.ts` with `schemaFilter`), Biome overrides per path,
  dependency-cruiser reach rules, testcontainers for `test/integration/*`.
- Per-system schema and role with grants on own schema: Postgres enforces the "no transaction
  across systems" line for free.

## Legibility

- Sequence 4: is the `HandledMessages` claim in the same transaction as the later `Shipment{booked}`
  save (transaction held open across the 3PL call), or committed first (then a crash in between
  loses the booking on redelivery)?
- Sequence 5: "fails if version is not v0 (redelivered)": throws for retry, or returns `unchanged`?
- `Stock`'s `bookedAtVersion` per reservation is used in sequence 5 but absent from `Stock`'s
  description in the systems table.
- `Shipments.recordShipmentReport` returning `unknownOrder`: which HTTP status does the hook send?
- After `ShipmentRefused` or `flagBookingOverdue`, what can anyone do? `ShopOps` is answering only, and
  the brief forbids operator cancellation; the order looks stuck forever.
- `CatalogProducts.all()` and `SentMails.byOrder()` take no `tx`, every other method does: deliberate
  (answering reads outside a transaction) or slip?
- Worker assembly passes `cardPayments: payment.cardPayments` to `buildShopForWorker`, but the
  comment says `buildPaymentForWorker` returns `{ handlers, outboxReader, schedules }`, and no
  worker-side shop use case calls `CardPayments.start`.
- `fillDeliveryProbe({ readers: [...] })` in `web`: where do web's outbox readers come from, when the
  web system builders return only what other builders take?
- Card refund after invoicing: payment sends `RefundMail` and billing sends a credit-note
  `DocumentMail`; two mails per refund intended? Same for dropped lines (`OrderMail{linesDropped}` and
  payment's refund mail).
- `lib/postgres/transaction-registry.ts` vs the `WeakMap` inside each system's `transaction.ts`: which
  one holds the handle?
- `RefundOverdue` (billing) and `overdueRefunds()` (payment, billing): overdue after how long, and why
  both systems list them?
- `ShopTransaction.system: 'shop'`: presumably a discriminant so a `PaymentTransaction` can't be
  passed structurally to shop ports; not said.
- Brief requires checkout to show the new price when "a cart price changed since the customer last
  saw it"; what records "last saw" between `viewCart` and `placeOrder.confirmedPrices` (the client)?
- `scheduleFullRefresh` is on `StockLevels`, but the nightly schedule is listed as
  `schedules/nightly-stock.ts`; which calls `Warehouse.allSkus`?

## Sources

- Alistair Cockburn, "Hexagonal Architecture", HaT Technical Report 2005.02, v0.9, 2005-09-04.
  https://alistair.cockburn.us/hexagonal-architecture/ (all Cockburn quotes verified there: intent
  statement, "two, three or four ports", "every use case could be given its own port...", "Neither
  extreme appears optimal", "multiple adapters for any one port", "sits in memory...", primary and
  secondary actor definitions, "driving adapters and driven adapters", "blissfully ignorant of the
  nature of the input device", "infiltration of business logic into the user interface code", "by
  purpose rather than by technology"; the article does not mention transactions).
- Pat Helland, "Life beyond Distributed Transactions: an Apostate's Opinion", CIDR 2007; reprinted ACM
  Queue 14(5), 2016. Quotes taken via Adrian Colyer's summary,
  https://blog.acolyer.org/2014/11/20/life-beyond-distributed-transactions/ (entity as "boundary of
  atomicity", idempotent "application-visible messaging", "later messages arrive before earlier ones").
  Warehouse-reservation and tentative-operation points paraphrased from secondary summaries:
  https://muratbuffalo.blogspot.com/2011/04/life-beyond-distributed-transactions.html,
  https://xebia.com/blog/life-beyond-distributed-transactions/. The primary PDF
  (https://ics.uci.edu/~cs223/papers/cidr07p15.pdf) and ACM Queue page
  (https://queue.acm.org/detail.cfm?id=3025012) could not be read as text.
- Pat Helland, "Accountants Don't Use Erasers", MSDN blog, 14 June 2007, and "Immutability Changes
  Everything", CIDR 2015 / ACM Queue 2016 (https://ceres.cs.umd.edu/818/papers/immutability.pdf, title
  and section confirmed by search, not read in full).
- Pat Helland, "Data on the Outside versus Data on the Inside", CIDR 2005; "Memories, Guesses, and
  Apologies", blog 2007; Helland and Campbell, "Building on Quicksand", CIDR 2009; "Idempotence Is Not
  a Medical Condition", ACM Queue 2012. Cited from memory, paraphrased, not looked up.
- Eric Evans, Domain-Driven Design (2003): ch. 2, 4, 5, 6, 9, 14, 15 cited from memory. Shared kernel
  wording from the DDD Reference (2015) as quoted at https://en.wikipedia.org/wiki/Domain-driven_design.
  The DDD Reference PDF (https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
  could not be read as text. "Leave transaction control to the client", the ACL's "Create an isolating
  layer..." and the application layer "kept thin" are standard quotations from the book, not
  re-checked against a copy.
- Vlad Khononov, Learning Domain-Driven Design (O'Reilly, 2021). Chapter titles confirmed at
  https://scrapbox.io/mrsekut-p/%E3%80%8ELearning_Domain-Driven_Design%E3%80%8F. Subdomain, pattern,
  event-type and outbox/saga/process-manager summary checked against
  https://system-design.space/en/chapter/learning-ddd-book/. "Wider boundaries first" from a search snippet of
  https://spk.helpjuice.com/system-architecture/boundaries-of-bounded-contexts (page not opened), which quotes the book
  and points to ch. 11 for it, while the O'Reilly preview of ch. 10
  (https://www.oreilly.com/library/view/learning-domain-driven-design/9781098100124/ch10.html, not
  readable here) opens its bounded-context heuristic on wide vs narrow boundaries; hence "ch. 10/11".
  "One aggregate per transaction" is from memory of ch. 6, paraphrased; not verified.
