# 08 — Reader round 2

**Status:** open

## Context

Issue 04 recorded reader round 1 over the general rules as first ported. Issues 05, 06, 07 and 01
retire, rewrite and add rules and terms after it, so its findings go stale. The README's loop runs
the readers again instead: a draft is done when every rule has its examples and the readers
produce no new example. Order: `specs/01-work-order.md`, step 9.

## Problem

- Every rule's `*Examples:*` line is `—` (issue 03). Filled first, from `examples/` as issue 05's
  Apply relabels it; then the readers run over `general-rules.md`, the group files and
  `domain.md`, as in round 1: Implementer agents by section, then Gap, Contradiction and
  Adversarial.
- Round 1's example files stay in `examples/`; round 2 adds to them.
- Left by issue 05's Apply, to recheck before the readers run:
  - The `gap-*` files argue against Scopes since retired or rewritten (`ARR-1`, `DOM-6`, `SYS-3`,
    `SYS-5`, `SYS-7`, `SYS-8`, `TX-8`, `TX-13`); issues 05 and 06 placed most of their
    situations.
  - `asm-7-breach-logger-substituted-by-module-mock.md`: deleted by issue 11; `ASM-7`'s line is
    behavior now, not substitution, and its loop breached `TX-1`. `ASM-7` has no breach example.
  - Examples that still import a published language re-exporting the domain, or declare driven
    ports outside `service/ports`, predate `SYS-2`'s flip and `SVC-1`'s move; the export-path and
    port examples were moved, the rest were not.
  - `OrderQueries` in the `TST-11` examples groups two use cases in one driving port.
  - A message with no schema at all, `payload: unknown` in a common-library outbox, lost its rule
    with `TX-4`; a lead for the Gap reader.
- Left by the import-only lists (`SVC-6`, `DRV-8`, `DVN-4`; issue 05's Consequences):
  - `drv-8-breach-mailer-subscribed-to-bus-in-assembly`: a handler written inside assembly
    imports nothing, so it loses `DRV-8`; a lead for the Gap reader.
  - `drv-8-breach-adapter-reads-repository-to-check-owner` reads the repository from the courier and
    keeps only `SVC-2`; `SVC-7` lets it through, a repository being a port of its system.
  - `svc-6-breach-drizzle-transaction-in-port`: whether a store client library's type counts as
    a library that computes from its arguments.
- Left by issue 10: `TX-23`, `TX-24`, `TX-25` are new, with no example files; the `tx-2-*` files
  show writes only, where `TX-2`'s Scope now covers reads.
- Left by issue 11: `TX-26` is new, with no example files; `SVC-4`'s Scope narrowed to records of
  an aggregate. The fixture gained pay-by-invoice with a bank API, the tax class, and the 3PL's
  article master.
- Left by issue 11's review: `TX-27` is new, with no example files; `TX-26`'s Statement and
  `TX-24`'s Scope changed. `tx-12-ok-shipment-status-replica-from-fulfillment-messages.md` calls
  the replica "shop's own aggregate" and filters a listing by it, which `TX-27` may now reach. The
  saga gained step 6.
- Left by issue 07: `SVC-7`, `TX-28` to `TX-31`, `SYS-12` are new; `TX-21`'s Statement, `ASM-4`'s
  Statement, `DRV-3`'s Scope, `DVN-4`'s and `SVC-6`'s lists changed; the Assumptions put external
  systems outside the rules. The fixture's catalog owns price, sku and tax class; the `SYS-12`
  examples are a variant outside the fixture. The examples left under ids issue 05 retired are gone
  or relabeled; whatever still cites a retired id is a finding. Eight examples keep the old
  backdrop, shop syncing its price into Payload, for rules it does not touch:
  `asm-1-breach-payload-config-builds-shop`, `asm-2-breach-adapter-builds-payload`,
  `asm-2-ok-payload-adapter-takes-instance`, `asm-2-ok-assembly-hands-upstreams-to-builder`,
  `asm-3-ok-actor-through-driving-port`, `asm-3-ok-hook-passes-editor`,
  `sys-1-ok-shop-export-paths`, `svc-6-ok-opaque-transaction`.
- Left by issue 01: `TX-32` to `TX-35`, `SYS-13`, `SYS-14` are new; `TX-7`'s Scope widened to an
  open host service called from another process, with no example of that; `TX-12` reads published
  events. The glossary's Message, Published language, Upstream and Downstream changed: a command is
  its receiver's. Examples still sending commands named for their sender's model, or a private
  `SendOrderConfirmation` called a command, are leads. `tx-1-ok-refund-and-payment-in-one-transaction`
  throws on a refused refund; called for shop's `RefundPayment`, that is `TX-34`'s breach. The fixture
  gained refunds, credit notes, the dunning stage and saga step 7.
- From issue 04's proposal: MAY "breaches" are listed under the rule that governs once the MAY's
  Scope fails. The README's examples entry gains it.

## Decision

—

## Consequences

—
