# 07 — External systems

**Status:** closed

## Context

The general rules assume storage, transactions and driving adapters this codebase declares. A
product brings its own: catalog's Payload has its config, its transaction and its hooks. Issue 04
proposed a products group file for what does not fit; issue 05 retired rules and forwarded more.
Both are gathered here. Worked after issue 05's Apply, which retires or rewrites rules named
below: recheck each item against the rules as they stand then. Issue 06's External system item
merges Product and third party, so Stripe's items sit here too and the group's name follows it.

## Problem

- `DOM-3` cannot comply on catalog: Payload stores no field its collection config does not
  declare, so price and sku are stated in shop's domain schema and again in Payload's config.
  Deriving the config from the schema covers neither `Money` nor admin-UI concerns. Issue 04
  proposed `DOM-3` stays general and this group rules the case.
- A hook called inside Payload's transaction: no after-commit, its service cannot open its own
  (issues 04, 05).
- Shop's own Local API write re-firing shop's own hook (issue 04).
- The shared `products` record, editorial copy and price (issue 05, `SYS-8` retired): a
  before-change hook returning shop's price for Payload to write; editors editing shop's price in
  Payload's admin (issue 04).
- Shop's fields on the shared `products` record under `TX-23`: whether Payload's Local API can make
  a write conditional, and whether an editor's copy edit counts as a change to shop's aggregate
  (issue 10).
- Drizzle plus Payload as two clients on one database (issue 05).
- Catalog data written through Payload in a transaction that commits with ours. Catalog is an
  external system (issue 06), so `TX-22`'s Scope holds and the shared transaction breaches it
  (issue 05).
- The shared-Postgres store: one store keeps records of several owners. Issue 11 settled ownership
  by business rules, not storage (glossary: Owner): `TX-3`, `TX-12`, `TX-22` say "owns", and shop's
  fields on Payload's `products` document are shop's. Left here: the shared document under `TX-1`
  and `TX-23`, `sys-8`. Sources the red team round cited: ownership is stated by storage, for the
  owner's business rules (Evans pdf 114: other processes "could violate the invariants enforced by
  the objects"); a replica is the receiver's own copy; outbox, processed ids and saga state sit in
  the same store, named apart from domain state (Richardson, Khononov, MS, Helland, NServiceBus).
- Hooks shop's builder constructs that read the courier, the ok examples
  `sys-1-ok-shop-hooks-via-builder.md` and `sys-11-ok-payload-terms-stop-in-shop-payload-module.md`
  (`ASM-4`, `DRV-3`). Issue 04 proposed: Payload's config loads before assembly runs, so its hooks
  are driving adapters assembly does not construct, whoever writes the closure; `ASM-4` stays.
  Issue 05 kept `DRV-3` for a driving adapter assembly cannot construct; where the framework
  offers a factory seam, assembly constructs. `sys-11-ok-*` becomes this group's material
  (`SYS-11` retired).
- An external system that answers only synchronously; the tentative operation is the way around
  (issue 05).
- An external system's hook that never arrives, a Stripe webhook after Stripe stops retrying
  (issue 05, `SYS-7` retired).

Example material, left under retired ids by issue 05's Apply:
`sys-8-ok-product-two-aggregates-one-document.md` (the shared record),
`tx-16-breach-payload-write-message-in-drizzle-outbox.md` and
`tx-16-ok-outbox-in-drizzle-store-and-in-payload-store.md` (Drizzle plus Payload),
`sys-11-ok-payment-stripe-anti-corruption-layer.md` (Stripe's webhook in payment's terms), and
`sys-7-*` (a dropped `OrderCancelled`, for recovery). The `sys-8-breach-*` pair became
`tx-22-breach-*`: catalog's fields written back through Payload.

Shared with issue 01, decided here once:

- Recovery of a message that fails for good, beside `TX-21`, whose "until the handler
  acknowledges it" a retry limit and an error queue revise: NServiceBus, Vernon EAD II p. 9, MS.
  With the hook that never arrives above.
- NServiceBus's repeat and the idempotency key; issue 04's key for a call to a third party,
  "keyed by the message id where the third party takes a key" (`TX-11` retired).
- A tentative operation left open, from the saga gap: with the external system that answers
  only synchronously above.

Store clients, from the review of issue 05's Apply:

- Store clients sit in the common library (glossary: Common library), so a service and a
  driving adapter may import one through `SVC-6`'s and `DRV-8`'s "the common library". Dropping
  them is a glossary change; its sweep: the Common library entry, `ASM-1`'s "two store clients",
  `TX-1`'s Why, `drv-8-breach-server-action-raw-sql-through-common-pool`.
- Transaction port: named in the Common library entry and `TX-1`'s Why, defined nowhere. A term,
  and whether `TX-1`'s service opens its transaction through it; without it, a service needs the
  store client to open one.
- A plain read through a store client, by a service or a driving adapter: only `SVC-6`'s and
  `DRV-8`'s Whys speak to it; CQRS query paths (MS, Vernon) skip the domain.

Decided with the hook inside Payload's transaction and the two clients on one database.

## Decision

Retitled from "Products group". A product is no term of its own: a bounded context whose code this
codebase does not write is an external system, wherever it runs, and Payload's documentation puts
business rules in its configuration (Hooks: "perform business logic"; Access Control: "what a user
can and cannot do"; the ecommerce plugin keeps products, prices, carts and orders). No group file:
every ruling holds for any system.

- **Glossary.** *External system*: in its own process or in ours; its configuration may hold
  business rules this codebase writes, in its terms; its architecture stays its own. *Common
  library*: store clients, a logger, a tracer, the relay, the bus, the courier; the transaction
  port goes, with no term in its place, and the ambient registry is the courier. *Outbox*, *Relay*,
  *Bus*: assembly hands the relay its outbox readers, an external system's included, and the bus
  its handlers.
- **Assumptions.** An external system, configuration included, sits outside the rules; what a
  system of this codebase does with it does not. `SYS-1`, `SYS-2`, `TX-17` no longer bind Payload's
  exports.
- **Hook before the external system commits.** `TX-28`: the use case changes this system no
  further than recording a tentative operation: answering, a veto, a pending record, a private
  message whose handler checks the committed state. A published event is the breach. `TX-29`,
  SHOULD: an external system this codebase configures, whose transaction can write a message,
  tells of its change by that message instead. A MAY was weighed and has nothing to override:
  catalog writing its own outbox is outside the rules, shop writing in Payload's transaction spans
  two systems.
- **Waiting.** `TX-30`: a business rule decides what happens when a confirmation or an answer does
  not come: a deadline that cancels, a reconciliation, or accepting the state. A deadline was
  weighed; accepting the open state is an ending too. Covers a Stripe webhook after Stripe stops
  resending and a tentative operation left open.
- **A message that fails for good.** `TX-21`: the bus keeps the message and delivers it again
  until acknowledged; backing off and parking in a dead-letter queue keep it. Khononov p. 147's
  at-least-once is the relay's; NServiceBus moves a message to the error queue after its retries
  and retries it once the error is resolved.
- **Idempotency key.** `TX-31`, SHOULD: a key the message carries, not one made at the call.
  `TX-22`'s Why: the call's use case records the owner's answer and decides nothing.
- **A hook call is a delivered message.** `TX-5` and `TX-19` apply; `TX-6`, `TX-20` and `TX-21` are
  the external system's to give or not, covered by `TX-28` and `TX-30`. `TX-5`'s Why says so.
- **Our record kept by an external system.** `SYS-12`: the external system's own ways in do not
  change it.
- **The cycle.** `ASM-4`'s Statement and `DRV-3`'s Scope add the driving adapter assembly cannot
  hand what it calls when it constructs it: what it calls is built from what it is built into.
- **In the process, outside the system.** `DVN-4` admits an external system's package, `SVC-6` the
  package of an external system it conforms to.
- **Store clients.** They stay in the common library. `SVC-7`: a service or a driving adapter
  reaches the outside through a port; import lists say what a module holds, not what it calls. A
  read that skips the aggregates is a driven port returning it. `ASM-7`'s MAY relies on it.
- **Fixture.** Catalog owns price, sku and tax class, their rules in Payload's config; shop copies
  them at checkout. Shop owning a price editors set in Payload is P3's boundary drawn wrong
  (Khononov pdf 186), kept as the variant in the `SYS-12` examples.

## Consequences

The Problem items, as placed:

- `DOM-3` on catalog, the shared `products` record, `TX-23` on shop's fields, the before-change
  hook embedding shop's price, editors editing shop's price: gone with the fixture; catalog owns
  the product. The variant is `SYS-12`'s.
- Hook inside Payload's transaction: `TX-28`, `TX-29`. Shop's own write firing its hook: gone with
  the fixture; a repeat would be `TX-5`'s.
- Drizzle plus Payload, two clients: two stores by the glossary; shop writes Payload no more.
- Catalog written in a transaction shared with ours: `TX-22`, unchanged.
- Hooks shop's builder constructs reading the courier: `ASM-4`, `DRV-3`.
- The external system that answers only synchronously: the tentative operation (`TX-3`, `TX-22`),
  the recorded answer (`TX-22`'s Why), what happens without one (`TX-30`).
- Shared with issue 01: recovery (`TX-21`, `TX-30`), the key (`TX-31`), the tentative operation
  left open (`TX-30`).
- Store clients, transaction port, plain reads: `SVC-7`, the glossary.

Examples:

- Retired with their situations: `sys-8-ok-product-two-aggregates-one-document`, both `tx-16-*`,
  `tx-22-breach-repository-writes-whole-document`,
  `tx-22-breach-shop-product-aggregate-is-whole-document`, the three `sys-7-*` (a dropped message no
  longer drops: `TX-21`), `gap-own-write-refires-own-hook`, `gap-before-change-hook-embeds-data`,
  `dom-3-breach-payload-collection-redeclares-price`.
- Relabeled: `gap-hook-inside-payload-transaction` to
  `tx-28-breach-after-change-hook-revalidates-page`;
  `sys-11-ok-payment-stripe-anti-corruption-layer` to
  `svc-7-ok-payment-reaches-stripe-through-gateway-port`;
  `sys-11-ok-payload-terms-stop-in-shop-payload-module` to
  `dvn-4-ok-payload-adapter-imports-external-package`;
  `drv-8-breach-server-action-raw-sql-through-common-pool` to `svc-7-breach-*`.
- New for `SVC-7`, `TX-28` to `TX-31`, `SYS-12`. `svc-6-breach-drizzle-transaction-in-port` also
  breaches `SVC-7`; `sys-1-ok-shop-hooks-via-builder` satisfies `ASM-4`, `DRV-3`; `dom-1-ok` no
  longer imports the common library into the domain.
- `TransactionPort` stays a code name in the examples: a driven port, no glossary term.
- To issue 01: the items above it shared; a hook call is a delivered message.
- To issue 08: see its Problem.

## Review

A review after closing changed, with no new issue:

- `SVC-7` keeps "a port of its system": under "a port", the common library's `Database` type, an
  interface too, would count. Of the 30 examples naming `TransactionPort`, four declared it in the
  common library or imported it from there; the system declares it in its `service/ports` now, and
  the common library keeps the opaque `Transaction` and `createTransactionPort`, which implements
  it. `ASM-7`'s line follows; issue 08's lead on it goes.
- `SVC-7`'s Why says the import lists do not rule calls; its MS line has `IOrderQueries` with no
  driven port behind it. `SYS-12`'s Why says code in the configuration; Helland 2005 §6.5, not §1.3.
  `TX-29`'s outbox is Khononov p. 145–147.
- The fixture loses the before-write hook embedding data, a situation of shop writing into Payload.
  `svc-7-breach-service-queries-handed-drizzle-client` runs SQL instead of importing shop's tables
  from the common library; `svc-7-breach-server-action-raw-sql-through-common-pool` names its clock;
  `tx-28-ok-after-change-hook-records-revalidation-request` reads the version through a port of its
  own.
- Sources checked: Payload runs `beforeChange` and `afterChange` before its commit, and a write
  passing `req` joins the transaction; Stripe keeps a key 24 hours and resends a webhook for three
  days.
