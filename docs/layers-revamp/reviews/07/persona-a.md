# Persona review A

Draft under review: `reviews/07/persona-input-a.md` (the "draft"), read against `reviews/07/brief.md` and
`glossary.md`. Citations are by work and chapter/section. Wording in quotation marks is either verified
(see Sources) or wording I'm sure of. Everything else is marked as paraphrase.

## Khononov

*Learning Domain-Driven Design* (O'Reilly 2021), cited as LDDD.

### Endorse

- **Bounded contexts as physical boundaries.** Each system is its own package (`packages/shop`, `payment`,
  `fulfillment`, `billing`) with its own Postgres schema and role (`sql/0000_roles.sql`, "one role per
  schema with rights on its schema only"), its own `GLOSSARY.md` and its own migrations. LDDD ch. 3
  treats a bounded context as a physical boundary: its own project, its own data, its own ubiquitous
  language (paraphrase). The draft does exactly this.
- **Integration patterns named per relation.** The "Upstream relations" paragraph names who is upstream
  of whom, and `payment`'s `published/` folder is an open host service with a published language
  (`OpenCardPaymentRequestV1`, versioned `.v1` event schemas). These are the LDDD ch. 4 customer-supplier
  patterns (conformist, ACL, OHS).
- **Outbox, relay, idempotent consumers.** "All messages go through an outbox in the writer's
  transaction, the relay, the pg-boss bus." Each system has `*Outbox.append` in the service's `tx` and a
  `*MessageClaims.claim` in the same transaction. This is the outbox pattern of LDDD ch. 9 (paraphrase:
  commit state and outgoing events atomically, then a relay publishes the committed events and
  consumers must tolerate repeats).
- **Process manager vs choreography is stated.** "Order process (`shop` orchestrates by commands)" vs
  "Invoicing and collection (choreography …)". LDDD ch. 9 separates the saga (reacts to events, linear)
  from the process manager (holds state, decides the next step, sends commands) (paraphrase). The order
  lifecycle, with deadlines and branches (paid/expired/rejected/partly shipped), is a fair fit for a
  process manager, and `Order.status` with `paymentDueBy`/`handoverDueBy` is its state.
- **Generic subdomains bought.** Stripe, the 3PL, the bank and the mail provider are external systems,
  each wrapped behind one driven port (`CardProvider`, `Warehouse`, `MailSender`). LDDD ch. 1: buy or
  adopt generic subdomains rather than build them (paraphrase).
- **Testing.** Domain unit tests (`test/domain/place-order.test.ts`), service tests over fakes
  (`fakes/*`), and port contract suites run against both fake and Postgres (`test/ports/*.suite.ts`).
  For domain-model code this is the testing pyramid LDDD ch. 10 recommends (paraphrase).

### Flaws

1. **Multi-aggregate transaction in checkout. Serious.** `placeOrder(cart, items, stocks, dunning, input,
   now, newIds)` produces a new `Cart` (with `checkedOutAs`), a new `Order` and one `Stock` per sku, each
   with a new reservation. `Stock` is its own aggregate ("`Stock { sku, version, freeAt3pl, …,
   reservations }`", saved by `StockLevels.save`). So one `ShopTransactions.run` commits 2 + N aggregates.
   LDDD ch. 6 is explicit: "no system operation can assume a multi-aggregate transaction", and domain
   services are "not a loophole": "The rule of one instance per transaction still holds true" (verified
   via reader highlights, see Sources). The draft is also inconsistent about this. Elsewhere it splits
   per-sku work into private messages (`RecordHandover` fans out to `MarkReservationHandedOver` per sku via
   `shop.private.ReservationHandedOver`), which only makes sense under one-aggregate-per-transaction.
   Khononov's fix: either make the reservation ledger one aggregate (e.g. a single `Inventory`
   aggregate for the shop, which is small enough here), or accept that the brief's "nothing is placed
   unless every line is within stock" is an invariant the model must hold in one aggregate, and redraw
   the aggregate boundary around it. Do not keep the per-sku aggregate and break the rule.
2. **Blanket ACL, "No system conforms to anything". Moderate.** LDDD ch. 4 makes the ACL a choice for
   specific conditions: the downstream holds a core subdomain, the upstream model is awkward, or the
   upstream contract changes often (paraphrase). For contexts owned by one team in one repository, it
   favours the cooperation patterns, partnership or shared kernel (paraphrase). The draft puts all four
   systems under one team, one codebase, one deploy, yet `shop` translates `payment`'s published language
   (`adapters/driven/payment/card-payments.ts`), `billing` translates `shop.OrderShipped.v1`, and so on.
   That is translation cost with no protection gained. He'd rate it moderate: it adds code everywhere
   but breaks nothing.
3. **Too many, too narrow bounded contexts for the subdomains. Moderate.** LDDD ch. 10/11 advise starting
   with wider bounded contexts and splitting later, because boundaries are expensive to move
   (paraphrase). `payment` is a thin model over Stripe (one `Payment` aggregate). `fulfillment` is a thin
   model over the 3PL (`Article`, `Shipment`). Each carries the full machinery anyway: outbox, claims,
   courier, builder, fakes, port suites, its own role. Khononov would likely class both as supporting
   subdomains that wrap generic ones. He would fold them into `shop` as an ACL module, or keep them
   separate only if a separate team or a different rate of change justified it. The brief gives no such
   reason.
4. **Implementation pattern not matched to subdomain type. Moderate.** LDDD ch. 10's heuristic
   (paraphrase): simple logic gets transaction script; complex data gets active record; complex rules
   get a domain model; and where the subdomain deals with money or needs a consistent audit log, an
   event-sourced domain model. Architecture follows from that: layered for the first two, ports and
   adapters for a domain model, CQRS for event sourcing. The draft applies one recipe (domain model plus
   ports and adapters plus outbox) to everything. `fulfillment`'s `Article` registration is close to
   transaction-script territory. `billing` is the opposite case. Invoices, credit notes, payments,
   paybacks, dunning steps, and the brief's "An operator can follow one checkout end to end" make it the
   textbook event-sourcing candidate. Instead `Invoice` is a mutable state record (`credits[]`,
   `payments[]`, `dunning.step`, `version`), and `GetBillingTimeline` has to be reconstructed from
   whatever was kept.
5. **Domain events are built by services, not raised by aggregates. Low.** `ShopOutgoing` variants such as
   `{ kind: 'orderShipped'; order: Order }` are assembled by the service and serialized by the outbox
   adapter. In LDDD ch. 6 the aggregate publishes domain events as part of its behaviour, and the events
   are part of the model (paraphrase). The draft's domain functions (`recordShipment(order, shipped)`)
   return state only, so which events a state change implies is decided in `services/*.ts`.
6. **Aggregates without encapsulation. Low to moderate.** `Order`, `Stock` and `Invoice` are plain readonly
   record types. Nothing prevents a service from building an `Order` literal and calling
   `Orders.save`. LDDD ch. 6 (paraphrase): an aggregate's state is changed only by its own business logic.
   With plain records that holds only by convention.

### Would absolutely not do

- **Commit several aggregates in one transaction and call them separate aggregates** (checkout, flaw 1).
  This is a rule he states, not a heuristic: LDDD ch. 6, "no system operation can assume a
  multi-aggregate transaction".
- Nothing else in the draft reaches refusal. Splitting into four contexts and the blanket ACL go against
  his heuristics, but he presents those as trade-offs.

## Evans

*Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley 2003), cited as
DDD.

### Endorse

- **Explicit bounded contexts and a context map.** The systems table and the "Upstream relations"
  paragraph form a context map in DDD ch. 14's sense. DDD ch. 14, Bounded Context: "Explicitly set
  boundaries in terms of team organization, usage within specific parts of the application, and physical
  manifestations such as code bases and database schemas." Schemas per system and packages per system
  meet the last two.
- **Small shared kernel.** `@tea/kernel` holds only `Money` and `EmailAddress`, with tests and a
  `GLOSSARY.md`. DDD ch. 14, Shared Kernel (paraphrase): a small, explicitly agreed subset of the model,
  changed only together. Keeping it this small is what he advises.
- **Open host service plus published language.** `payment/src/published/` with a versioned
  `OpenCardPaymentRequestV1` and versioned event schemas is DDD ch. 14's Open Host Service paired with
  Published Language.
- **Repositories leave transactions to the client.** `Carts.get(tx, id)` and `save(tx, cart)` with
  `ShopTransactions.run` in the service: DDD ch. 6, Repositories, "Leave transaction control to the
  client". Repositories load and save whole aggregates.
- **Value objects and side-effect-free functions.** `Money` (integer cents, allocate),
  `EmailAddress` (normalised, equality means same customer), `GermanAddress`, and pure domain functions
  (`available(stock)`, `paymentOptions(dunning)`, VAT from gross in `billing/domain/vat.ts`) match
  DDD ch. 5 (Value Objects) and ch. 10 (Side-Effect-Free Functions, Standalone Classes).
- **Snapshots on order lines.** `Order.lines` keeps `unitPrice`, `sku`, `taxClass`, `title` as the order's
  own facts. `Invoice.lines` copies again and adds `vatRate`. That is a value-object copy where the
  business wants a frozen fact, which is what DDD ch. 5 advises.
- **Thin application layer.** Services hold the sequence and the domain holds the rules. DDD ch. 4,
  Layered Architecture (paraphrase): the application layer is thin, coordinates, and holds no business
  rules.

### Flaws

1. **The context-map relation is a blanket rule, not a decision per relation. Serious (strategic).**
   "every system of this codebase translates every upstream in an anti-corruption layer. No system
   conforms to anything." DDD ch. 14 presents Shared Kernel, Customer/Supplier, Conformist, ACL and
   Separate Ways as answers to the actual team and model situation of each relation, and stresses that
   an ACL is costly (paraphrase). Here all contexts belong to one team. For `shop` → `payment`, a
   Customer/Supplier relation in which `shop` uses `payment`'s published language directly would be his
   default. Conformist is also legitimate where the upstream model is good, and arguably Stripe's
   payment model is better than `payment`'s re-statement of it.
2. **No core domain. Serious (strategic).** DDD ch. 15 (Distillation) asks you to name the core domain,
   keep it small, and spend the modelling effort there. Generic subdomains are kept apart and cheap
   (paraphrase). The draft gives all four systems identical depth: domain, services, ports, fakes, port
   suites, courier. It never says which is core. For this brief Evans would probably name the order and
   stock promise (`shop`) and German invoicing (`billing`), and treat `payment`/`fulfillment` as generic
   wrappers.
3. **Bounded contexts without separate teams or models. Moderate.** DDD ch. 14 ties context boundaries to
   models and teams. `payment` and `fulfillment` have no model different enough from `shop`'s to need a
   boundary: `Payment` is one aggregate per order, and `Shipment` mirrors the order's lines. The result is
   three parallel lifecycles for one order (`Order.status` in `shop`, `Shipment.status` in `fulfillment`,
   `Payment.status` in `payment`) kept consistent by messages. Evans would ask whether that split comes
   from the domain or from the house rule set.
4. **Invoice conflates document and account. Moderate.** The brief says "Invoices are never changed or
   deleted". The draft's `Invoice` aggregate is mutated for `credits`, `payments`, `dunning` and
   `takenOverBy`, with a `version`. The legal document (number, lines, VAT) is immutable. The receivable
   (open amount, payments, dunning) is not. In DDD ch. 5/6 terms these are an immutable value (the issued
   document) and an entity with a lifecycle (the receivable). Modelling them as one aggregate hides the
   brief's invariant behind a convention ("save never changes lines").
5. **Refund is modelled in three places. Moderate.** `shop.Order.refunds: OrderRefund[]`,
   `payment.Payment.refunds[]`, `billing.RefundRequest`. The routing of one outcome event to two
   subscribers depends on "each ignores a `refundId` it did not record". The ubiquitous language does not
   say what "refund" means in each context, or which one the operator's "refund this order" belongs to.
   The brief makes it `billing` after invoicing and `shop` before. DDD ch. 2 (Ubiquitous Language) asks
   that this be explicit.
6. **Aggregate invariants enforced by nobody in particular. Moderate.** The domain types are records, and
   rules are free functions. DDD ch. 6 says the root enforces the aggregate's invariants and outside code
   cannot change members except through it (paraphrase). The draft does not say which function guarantees
   "a sku unique and fixed", "no unit sold to two orders" (across `Stock`), or "invoice lines never
   change". The `Stock` invariant also spans several aggregates in checkout, which DDD p. 128 says is not
   expected to hold at all times unless you tie it to one transaction deliberately (see Where they
   disagree).
7. **Presentation in the model. Low.** `CatalogItem { descriptionHtml, imageUrls, … }` lives in
   `shop/src/domain`. Copy and images are not part of any rule. Evans would keep them in a read model or
   the storefront adapter, not the domain.

### Would absolutely not do

- **Fix the context map in advance as one rule for every relation** ("No system conforms to anything").
  Evans offers the context-map patterns as choices to make per relation from team and model facts
  (DDD ch. 14, "Choosing Your Model Context Strategy"). A rule that forbids Conformist and Shared Kernel
  across the board, other than for one kernel, removes the decision he says must be made.
- Beyond that, nothing he would refuse outright. The other points are design objections.

## Cockburn

"Hexagonal Architecture" (alistair.cockburn.us, 2005), and Cockburn & Garrido de Paz, *Hexagonal
Architecture Explained* (2024), with Garrido de Paz's online articles as the published explanation.

### Endorse

- **The intent is met.** The 2005 article: "Allow an application to equally be driven by users, programs,
  automated test or batch scripts". Each system is driven by storefront server actions, Payload `ui`
  fields, ops pages, hooks (`stripe-hook.ts`, `three-pl-hook.ts`), bus handlers and scheduled tasks. All of
  these go through the same driving port types (`ShopDrivingPorts`), and tests drive the same ports.
- **Primary and secondary sides are kept apart.** `ports/driving.ts` and `ports/driven.ts`, with
  `adapters/driving/*` and `adapters/driven/*`. The 2005 article: "The distinction between primary and
  secondary lies in who triggers or is in charge of the conversation". The glossary's "Who starts the
  call decides which" is that rule.
- **Swappable secondary adapters with in-memory fakes.** `fakes/*` per system, and port suites that run
  the same contract against the fake and Postgres (`test/ports/orders.suite.ts` + `orders.test.ts`). The
  2005 article motivates this with the database going down or being replaced, and swapping in an
  in-memory substitute (paraphrase).
- **Hexagon-to-hexagon through ports.** `shop`'s driven port `CardPayments`, whose adapter
  (`adapters/driven/payment/card-payments.ts`) calls `payment`'s driving port `OpenCardPayment`, is the
  standard way to connect two hexagons: one's secondary adapter talks to the other's primary port.
- **A configurator at startup.** `apps/*/src/assembly.ts` calling `buildShop`, `buildPayment` and so on is
  the configurator Garrido de Paz describes: "Which adapter to use for each port is something that is
  configured at application startup."

### Flaws

1. **One port per use case: 24 driving ports in `shop` alone. Moderate.** "Each type is one driving port,
   one use case." The 2005 article: "A port identifies a purposeful conversation". It counts "two, three,
   or four (four is most I have encountered to date)" ports per hexagon. In *Hexagonal Architecture
   Explained*, ports are named by purpose, "For[Doing][Something]" (verified via Garrido de Paz, see
   Sources). Garrido de Paz grants that SRP gives "a lot of ports, each one for a use case", and suggests
   a command bus or a command/query split instead. Cockburn would group `shop` into a handful of
   conversations: ForShopping (catalog, cart, checkout), ForTrackingOrders (ops queries), ForStockKeeping
   (stock replica), and ForFollowingPaymentAndShipment (the message-driven ones). He'd rate this moderate:
   it is legal hexagonal, but it loses the "conversation" view of the boundary.
2. **Transport leaks into the application's ports. Moderate.**
   - Every message-driven driving port takes `Msg = { messageId: string }`. The idempotency key is named
     after the transport, which tells the app it is driven by messages.
   - `ShopMessageClaims.claim(tx, handler: string, messageId)` asks the service for a handler name. A
     handler is a driving adapter (`MessageHandler.name`, "also the bus queue name"), so a queue
     identifier crosses into the service.
   - `billing`'s `GetBankPollCursor` and `AcceptBankTransfers({ transfers, cursor })` put the poller's
     mechanism into the offered ports.

   The 2005 article's core rule is that code pertaining to the inside should not leak to the outside
   and vice versa ("code pertaining to the inside part should not leak into the outside part"). A
   technology-neutral name (`requestId`, `changeId`) and a claim keyed by use case would fix the first
   two. For the third, see flaw 3.
3. **The bank and the 3PL stock listing are pulled by driving adapters. Low to moderate.**
   `adapters/driving/scheduled/bank-poll.ts` (with `bank-api.ts` beside it) calls the bank API itself and
   hands the result to `acceptBankTransfers`. The same goes for `stock-poll.ts` and the 3PL listing. By the
   2005 article's rule (who initiates), the shop starts that conversation, so the bank is a secondary actor
   and belongs behind a driven port (`BankStatements.listSince(cursor)`), called by a use case that the
   clock triggers. As drafted, the bank client, the cursor-minus-one-day overlap and the bank error
   handling sit in a primary adapter. The application never sees the bank, and cannot be tested against a
   fake bank through a port.
4. **The transaction port is threaded through every driven port. Low.** `get(tx: ShopTx, …)` on every
   repository, and the runtime `instanceof PgShopTx` check in each adapter, couple all secondary adapters
   of one store to each other. They can only be swapped together. Cockburn has no published position on
   transactions. The adapter-swap story in the 2005 article is per port, and here it is per store. Worth
   knowing, not fatal: the port suites run fake and Postgres side by side.
5. **Framework-bound adapters live inside each system package. Low.** `packages/shop/src/adapters/driving/
   next/*` holds Next.js server actions, RSC data functions and a Payload `ui` field component. The 2005
   article puts adapters outside the hexagon but says nothing about packaging. It is legal. The cost is
   that every system package depends on Next.js and React types.

### Would absolutely not do

- Nothing in the draft breaks the pattern outright. The ports are interfaces, the adapters are swappable,
  and tests drive the app through its ports. The closest thing to a refusal is flaw 2: transport names
  (`messageId`, `handler`, poll `cursor`) appearing in the application's own port signatures runs against
  the article's central rule that inside code must not leak outside and vice versa. It is a leak, not an
  inversion. Cockburn has no published position on global couriers (`globalThis.__teaShopPorts`) or on
  how many hexagons one deployable may hold.

## Helland

"Life beyond Distributed Transactions: an Apostate's Opinion" (CIDR 2007; ACM Queue 14(5), 2016),
cited as LBDT. "Data on the Outside versus Data on the Inside" (CIDR 2005), cited as DOI. "Memories,
Guesses, and Apologies" (2007 blog post), cited as MGA. "Idempotence Is Not a Medical Condition" (ACM
Queue 2012), cited as INMC. "Immutability Changes Everything" (CIDR 2015 / ACM Queue 2015), cited as ICE.

### Endorse

- **No distributed transactions.** Each system commits to its own schema. Cross-system effects go by
  message. "Asynchronous, at least once, any order." LBDT: "Messages are repeated. Later messages arrive
  before earlier ones." The draft designs for exactly that.
- **Idempotent processing, recorded in the entity's transaction.** `claim(tx, handler, messageId)` →
  `'first' | 'repeat'` inside the same `run` as the state change. Outbox inserts are `on conflict (id) do
  nothing`. LBDT: scale-agnostic applications "support idempotent processing of all application-visible
  messaging". The way to get there is to remember processed messages in the same transaction as the
  entity's change (paraphrase of LBDT, "Activities").
- **Deterministic ids for at-most-once facts.** uuid v5 of `expire:{orderId}`, `dunning:{invoiceId}:{step}`,
  `stripe:{eventId}`. The fact names its own message, so any re-derivation of it collapses. This is the
  INMC idea that the request must carry its own identity (paraphrase).
- **Outside data is versioned and refetched, not trusted in order.** `occurredAt` is "informative only
  (never used for ordering)". Replicas carry the owner's versions (`CustomerDunning.billingVersion`,
  `shipmentVersion`, `articleVersion`). `cms.ProductSaved.v1 { productId }` and Stripe notices carry only a
  reference, and the receiver fetches current state. DOI (paraphrase): outside data is immutable, versioned
  and describes "then", not "now". Receivers reason about versions, not arrival order.
- **Tentative order with a deadline, and apologies built in.** A card order is placed, then must be paid
  within `PAYMENT_WINDOW`, or `ExpireUnpaidOrder` cancels it and releases stock. A payment that succeeds
  after the cancel is refunded. Unshippable lines are dropped and refunded. This is MGA's "guess, then
  apologise" and LBDT's tentative operations, which end in confirm or cancel (paraphrase). The brief
  forces the apologies; the draft gives each one a message and a handler.
- **Stock as a guess over an authoritative replica.** `Stock.freeAt3pl`/`freeAsOf` with reservations
  that carry `handedOverAt` lets `available(stock)` subtract only reservations not yet reflected in the
  3PL's figure. Both timestamps come from the 3PL's own clock (`acceptedAt` and the stock report's
  `asOf`). That is "then vs now" reasoning (DOI) done right.
- **Append-only financial facts.** Invoices are never changed, every correction is a credit note, and the
  number series are gapless. ICE (paraphrase): record immutable facts and derive the current state from
  them.

### Flaws

1. **`consignmentRepeatPolicy = 'lookUpFirst'` is check-then-act across a remote boundary. Serious.**
   `handOverShipment` calls `Warehouse.findConsignment(shipmentId)` and, if that returns `null`, calls
   `createConsignment(...)`. With two worker replicas and pg-boss redelivery (job expiry while a 3PL call
   hangs), two attempts can both see `null` and both `POST /orders`. That is a duplicate shipment, which
   the brief forbids outright. The `claim` row only serialises the two attempts if the 3PL call is made
   inside the claim's open transaction, and the draft does not say it is (see Legibility). INMC: the
   receiver must make the operation idempotent. Asking first is not idempotence (paraphrase). Helland's
   fix: make the 3PL dedupe on `reference = shipmentId` (a uniqueness guarantee from the vendor), or hold
   a lease or lock that spans the remote call. Also record "attempt started" durably before calling, so a
   crash between call and save reconciles instead of re-sending.
2. **Four outboxes inside one Postgres. Moderate (cost, not correctness).** LBDT's constraints are argued
   for "almost-infinite" scale. Within one entity, atomicity is fine, and a single small database is the
   easy case. The draft splits one small shop's data into four schemas, then rebuilds atomicity with
   outbox, relay, bus, claims and reconciliation sweeps (`RequestPaymentReconciliation`, hourly). Helland
   would recognise every mechanism as correct. He would also note that his paper argues for them
   because you cannot get a transaction across entities, and here you could. Whether that is worth it
   is a product decision. The draft does not justify it.
3. **The entity boundary in checkout is unclear. Moderate.** LBDT: "A scale-agnostic programming
   abstraction must have the notion of entity as the boundary of atomicity." Checkout atomically writes a
   cart, an order and N `Stock` entities (one per sku). That works on one Postgres. It contradicts the
   draft's own per-sku fan-out elsewhere (`MarkReservationHandedOver` per sku). Helland would want one
   answer: either the stock ledger is one entity, or reservations are tentative operations an order asks
   of each sku-entity, confirmed or cancelled per sku.
4. **Invoice entity mixes immutable and mutable data. Low to moderate.** `Invoice` is updated in place
   (`version`, `payments[]`, `credits[]`, `dunning`). ICE would keep the issued invoice as an immutable
   fact and the receivable as derived or append-only. The brief's "never changed" is then structural,
   not a coding convention.
5. **Stripe Search as a recovery path. Low.** `CardProvider.findIntentByPayment` ("provider search by
   metadata") is a lagging index over another system's data, so it is a guess. The idempotency key
   `pi:{paymentId}` already covers the 23-hour window (`providerKeyStillValid`). After that window, a miss
   in a lagging index would open a second intent. DOI: data read from outside is stale by nature
   (paraphrase).

### Would absolutely not do

- Nothing in the draft. It never uses distributed transactions, never assumes exactly-once or in-order
  delivery, and never uses wall-clock order across systems. Those are the things his papers argue
  against. Flaw 1 is a bug against his position (INMC), not a design he would refuse in principle.

## Where they disagree

- **Checkout writing cart, order and N `Stock` aggregates in one transaction.**
  - Khononov: forbidden (LDDD ch. 6, one aggregate per transaction, no loophole). Redraw the aggregate.
  - Evans: allowed if chosen on purpose. DDD p. 128 expects rules that span aggregates to be resolved
    over time, but he also gives a test (as reported by Vernon): if keeping the data consistent is the
    job of the user running the use case, aim for transactional consistency. Here it is: the customer
    must learn at checkout which lines are short.
  - Helland: atomicity belongs inside one entity (LBDT). At this scale on one database he would accept it,
    but would ask which entity the stock promise lives in.
  - Cockburn: no published position.
- **Blanket anti-corruption layer.**
  - Evans and Khononov: a per-relation choice. Overkill between contexts of one team.
  - Cockburn: every adapter translates between outside and inside, so an ACL is just a well-behaved
    secondary adapter, and he would not object.
  - Helland (DOI): outside data must be turned into the inside representation anyway, so he would not
    object either.
- **Four bounded contexts for one small shop.**
  - Khononov: start wider; `payment` and `fulfillment` are not worth their own context.
  - Evans: boundaries follow models and teams. Neither differs much here.
  - Helland: the split is coherent but buys scale the shop doesn't need.
  - Cockburn: neutral. Each is a well-formed hexagon.
- **One driving port per use case.**
  - Cockburn: too many. Ports are purposeful conversations, two to four of them.
  - Evans: one application service per use case is normal in his layered architecture (ch. 4). No
    objection.
  - Khononov: no published position on port granularity.
- **Domain as plain records plus pure functions.**
  - Evans: endorses side-effect-free functions (ch. 10) but expects the aggregate root to own its
    invariants (ch. 6).
  - Khononov: requires the aggregate's own logic to be the only way to change its state (ch. 6).
  - Cockburn and Helland: no position on how the inside is modelled.
- **Billing as state vs events.**
  - Khononov: money plus audit means an event-sourced domain model (ch. 10 heuristic, paraphrase).
  - Helland (ICE): immutable facts, derive state. The same direction, for different reasons.
  - Evans (2003): predates event sourcing in the blue book. No position there.
  - Cockburn: no position.

## Buildability

**Verdict:** buildable in TypeScript on Node 24 with Payload 3, Next.js 15, Drizzle, pg-boss, Stripe and
pdfkit, but only after fixing a handful of framework fights: the Next.js build and instrumentation
runtime, package subpath exports, and pg-boss redelivery around remote calls. One correctness gap needs
fixing too: the duplicate 3PL consignment. The rest is a lot of boilerplate for a small shop, but it
works.

What would break or fight the frameworks:

1. **`next build` with an empty courier.** All storefront RSC data functions call `readShopPorts()`,
   which throws "until filled". `register()` in `apps/web/instrumentation.ts` does not run during
   `next build`. So any route Next tries to prerender, such as `(shop)/page.tsx` or
   `(shop)/products/[slug]/page.tsx`, throws at build time. Every storefront and ops route needs
   `export const dynamic = 'force-dynamic'`, or `connection()`/`headers()` before the courier read. That
   also settles "within a minute": reading on every request, no ISR.
2. **`instrumentation.ts` runs in both runtimes.** `register()` is called for the Node.js and the Edge
   runtime. Importing `pg`, `payload` and `apps/web/src/assembly.ts` unguarded breaks the edge bundle. You
   need `if (process.env.NEXT_RUNTIME === 'nodejs') { await import('./src/assembly') }`. The draft does
   not show this.
3. **Package exports do not allow the draft's own imports.** "Package exports: … `@tea/payment` exports …
   `./next` … Nothing else resolves." Yet `apps/web/app/` files do `export { POST } from
   '@tea/payment/next/stripe-hook'`, a subpath. Either export `./next/*` or re-export everything from
   `@tea/payment/next`. With a single barrel, server actions (`'use server'`), server components and
   route handlers all come from one `index.ts`. That is fine for server code, but any `'use client'`
   component added there risks pulling server modules into the client graph.
4. **Server actions from workspace packages.** `setCartLineAction` and `checkoutAction` live in
   `packages/shop/src/adapters/driving/next/`. Next.js only compiles them if those files carry
   `'use server'` and `next.config.ts` has `transpilePackages: ['@tea/shop', '@tea/payment',
   '@tea/fulfillment', '@tea/billing', '@tea/cms']`. This is doable but not shown.
5. **The dependency-cruiser exception for `packages/cms/src/collections/products.ts` is moot.** Payload 3
   `ui` field components are string paths (`'@tea/shop/next#AvailableStockField'`), resolved by the
   generated `apps/web/app/(payload)/admin/importMap.js`. That file does the actual import and is already
   under `apps/web/app/**`. Static analysis never sees a dependency from `products.ts`. Harmless, but it
   shows a wrong mental model of how Payload wires components.
6. **pg-boss redelivery around remote calls (`handOverShipment`, `executeProviderRefund`).** pg-boss
   re-queues a job whose handler outlives `expireInSeconds`. With two `worker` replicas, the same message
   can run concurrently. `claim(tx, …)` only protects you if the remote call happens while the claim's
   transaction is still open, which holds a Postgres connection across a 3PL or Stripe call. For Stripe
   refunds the idempotency key `refund:{refundId}` saves you. For the 3PL, `lookUpFirst` does not (see
   Helland flaw 1). Set a generous `expireInSeconds` and use 3PL-side dedupe.
7. **Optimistic conflicts in checkout surface as exceptions.** `Stock` and `Cart` saves are
   version-checked. Two checkouts for the same sku collide, and the loser throws out of
   `ShopTransactions.run`. The draft has no retry loop and no `select … for update`, so the customer sees
   "payment unavailable, retry"-style errors under load. Add a bounded retry in the Postgres
   `ShopTransactions` adapter, or lock `Stock` rows in sku order (which also avoids deadlocks).
8. **pg-boss v10 specifics.** Every queue (one per handler), the dead-letter queue `'parked'` and every
   scheduled task's queue must be created with `createQueue` before `send`/`work`/`schedule`.
   `createPgBossBus` and `scheduleTasks` have to do this on start, and `tools/migrate` only installs the
   schema. Renaming a `MessageHandler.name` ("also the bus queue name") strands its queued jobs, so
   handler names become a migration concern.
9. **Payload in the worker.** `getPayload({ config: cmsConfig })` in `apps/worker/src/assembly.ts` works
   (Payload 3 Local API runs outside Next, and the `ui` paths are strings), but Payload is ESM-only, so
   the worker must be `"type": "module"` and compiled accordingly. The Payload config reads its own
   DB/secret env, outside the zod `WorkerConfig`, so configuration is parsed in two places. Set
   `push: false` on the Postgres adapter, or Payload may try to push schema changes in development.
10. **`cms_outbox` read by raw SQL.** `createCmsOutboxReader(pool)` reads and updates the table Payload
    generates for the `cms_outbox` collection (Payload's column naming, `id`, `created_at`, `updated_at`,
    the `payload` json column). This works, but it couples the reader to Payload's generated DDL.
    Pin the collection's `dbName` and fields, and cover them with an integration test.
11. **`Date` vs `Temporal.Instant` at every boundary.** `Clock.now(): Temporal.Instant` and
    `listPaymentOverdue(tx, now: Temporal.Instant, …)`, but `RecordFreeStock.asOf: Date`,
    `CheckoutAccepted` paths, `GetAvailableStock.freeAt3plAsOf: Date | null`, `Warehouse.acceptedAt: Date`.
    Drizzle returns `Date`. Expect conversions in every adapter and service, and bugs where the two mix.
12. **Backlog probe permissions.** The `/ops/delays` probe reads "each outbox and each bus queue" from the
    web process, but the role list (`shop_rw`, …, `cms_outbox_reader`) gives no web-side role read access
    to all outboxes and the `pgboss` schema. A probe role is missing from `sql/0000_roles.sql`.

What is fine:

- Drizzle per schema with `migrate(db, { migrationsFolder, migrationsSchema })`, one role and pool per
  system. pg-boss with `migrate: false` in apps and schema install in `tools/migrate`. A relay holding a
  session advisory lock on a dedicated client.
- Payload `afterChange`/`afterDelete` writing `cms_outbox` with `req` so the row joins Payload's
  transaction. Payload 3's Postgres adapter supports this.
- Stripe: idempotency keys with the 23-hour validity rule, webhook signature check, notice-then-refetch,
  and the mapping of `charge_disputed`/`amount_too_large` to refusals.
- `globalThis` courier with `declare global { var … }`: survives Next.js bundling instrumentation and
  routes separately. `instanceof PgShopTx` is safe because the builder builds both the tx and the
  repositories in one module graph.
- Gapless number series: `Series` saved in the same `billing` transaction as the invoice, version-checked.
  This serialises issuing invoices, which is correct and cheap at this volume.

## Legibility

- Whether the 3PL and Stripe calls in executors (`handOverShipment`, `executeProviderRefund`) run inside
  the `run(tx)` that holds the claim, or after commit.
- How a service knows the `handler` string `claim(tx, handler, messageId)` asks for. Is it the use case
  name or the bus queue name?
- "with `migrate: false` on nothing it starts" (Processes) does not parse.
- The rule behind `available(stock)`: which reservations count against `freeAt3pl` given `handedOverAt`
  and `freeAsOf`, and what triggers `shop.private.ReservationReleaseDue`.
- Why `RecordHandover` fans out per sku (`MarkReservationHandedOver`) while `checkout` writes all skus in
  one transaction.
- How a card invoice's `openAmount()` reaches zero: `billing` never subscribes `CardPaymentSucceeded`, so
  where the `payments: { kind: 'card' }` entry comes from (presumably `paymentMethod` in
  `OrderShipped.v1`).
- How a post-invoice card refund shows up in `openAmount()`: no payment kind for a card refund, so the open
  amount would go negative after a credit note.
- What happens after `FlagOverdueHandover` / `HANDOVER_GRACE` (48 h): only an ops flag, or a step in the
  order process? The brief has no such rule.
- How `/ops/**` pages authenticate operators: Payload users are listed as the CMS's records, but the
  check is not shown.
- What `Envelope.correlationId` holds for messages without an order, such as
  `billing.private.TransferReported`, and how a transfer joins "one checkout end to end".
- Where each `*Timeline` port's entries come from: records, outbox history, or logs.
- `Money` is "branded by schema", but the type `{ readonly cents: number }` is not branded, unlike
  `EmailAddress`.
- Which operations the draft considers tentative operations in the glossary's sense (reservation, card
  payment, refund request). The term is never applied.
- The `web` assembly is described only as a diff of the worker's. Which builders it calls, and whether it
  builds handlers it never subscribes, is left to the reader.

## Sources

- Cockburn, "Hexagonal Architecture" (2005), https://alistair.cockburn.us/hexagonal-architecture/ —
  verified: Intent sentence; "A port identifies a purposeful conversation"; "two, three, or four (four is
  most I have encountered to date)"; primary/secondary definitions and "who triggers or is in charge of the
  conversation"; "code pertaining to the inside part should not leak into the outside part"; no mention of
  transactions or globals.
- Garrido de Paz, "Hexagonal Architecture" (with Cockburn's endorsement; basis of *Hexagonal Architecture
  Explained*, 2024), https://jmgarridopaz.github.io/content/hexagonalarchitecture.html — verified: "Each
  group of interactions with a given purpose/intention is a port"; "a lot of ports, each one for a use
  case"; command bus / command-query split; "Which adapter to use for each port is something that is
  configured at application startup."
- For[Doing][Something] port naming: search results pointing to the book's description and
  https://dev.to/xoubaman/understanding-hexagonal-architecture-3gk ,
  https://www.goodreads.com/book/show/231537868-hexagonal-architecture-explained .
- Khononov, *Learning Domain-Driven Design* (2021): "no system operation can assume a multi-aggregate
  transaction", "The rule of one instance per transaction still holds true", "There is nothing wrong
  with using active records when the business logic is simple", "the business logic layer defines
  'ports' that have to be implemented by the infrastructure layer", verified via reader highlights at
  https://www.goodreads.com/notes/59357356-learning-domain-driven-design/62860717-daniel-dao?page=2 (no
  page numbers there). The ch. 4 ACL conditions, the ch. 10 decision heuristics (event sourcing for money
  and audit, wide boundaries first, testing shapes) and the ch. 9 outbox/saga/process manager are
  paraphrased from memory. I could not verify their wording.
- Evans, *Domain-Driven Design* (2003): p. 128 on rules spanning aggregates, and Evans's
  user-responsibility test, as reported by Vernon,
  https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf and
  https://www.informit.com/articles/article.aspx?p=2020371&seqNum=5 . "Leave transaction control to the
  client" (ch. 6) and the Bounded Context pattern sentence (ch. 14) are wording I'm sure of. Other ch. 4,
  5, 10, 14 and 15 positions are paraphrased.
- Helland, "Life beyond Distributed Transactions": quotes verified via
  https://blog.acolyer.org/2014/11/20/life-beyond-distributed-transactions/ ("Messages are repeated.
  Later messages arrive before earlier ones."; "A scale-agnostic programming abstraction must have the
  notion of entity as the boundary of atomicity."; "support idempotent processing of all
  application-visible messaging"; "almost-infinite"). Tentative operations confirmed or cancelled, per
  summaries at https://codito.pages.dev/paper-life-beyond-transactions and
  https://www.scribd.com/document/433110266/p70-Helland . ACM Queue (https://queue.acm.org/detail.cfm?id=3025012)
  returned 403. "Data on the Outside versus Data on the Inside", "Memories, Guesses, and Apologies",
  "Idempotence Is Not a Medical Condition" and "Immutability Changes Everything" are paraphrased from
  memory, not fetched.
- Framework behaviour (Next.js `instrumentation.ts` runtimes and build-time prerendering, Payload 3
  importMap and transactions via `req`, pg-boss v10 `createQueue` and job expiry, Drizzle
  `migrationsSchema`, Stripe idempotency key 24-hour window and Search lag) is from my own knowledge of
  those libraries. I did not look it up for this review.
