# 07 — Products group

**Status:** open

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

—

## Consequences

—
