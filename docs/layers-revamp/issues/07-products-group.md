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
- Drizzle plus Payload as two clients on one database (issue 05).
- Catalog data written through Payload in a transaction that commits with ours. Catalog is an
  external system (issue 06), so `TX-22`'s Scope holds and the shared transaction breaches it
  (issue 05).
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

Shared with issue 01, decided here once:

- Recovery of a message that fails for good, beside `TX-21`, whose "until the handler
  acknowledges it" a retry limit and an error queue revise: NServiceBus, Vernon EAD II p. 9, MS.
  With the hook that never arrives above.
- NServiceBus's repeat and the idempotency key; issue 04's key for a call to a third party,
  "keyed by the message id where the third party takes a key" (`TX-11` retired).
- A tentative operation left open, from the saga gap: with the external system that answers
  only synchronously above.

## Decision

—

## Consequences

—
