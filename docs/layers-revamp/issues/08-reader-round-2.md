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
  - `drv-8-breach-server-action-raw-sql-through-common-pool.md` (adversarial): `DRV-8`'s list
    allows the common library, store clients included.
  - Examples that still import a published language re-exporting the domain, or declare driven
    ports outside `service/ports`, predate `SYS-2`'s flip and `SVC-1`'s move; the export-path and
    port examples were moved, the rest were not.
  - `OrderQueries` in the `TST-11` examples groups two use cases in one driving port.
  - A message with no schema at all, `payload: unknown` in a common-library outbox, lost its rule
    with `TX-4`; a lead for the Gap reader.
- Left by the import-only lists (`SVC-6`, `DRV-8`, `DVN-4`; issue 05's Consequences):
  - `drv-8-breach-mailer-subscribed-to-bus-in-assembly`: a handler written inside assembly
    imports nothing, so it loses `DRV-8`; a lead for the Gap reader.
  - `drv-8-breach-adapter-reads-repository-to-check-owner` reads the repository from the courier
    and keeps only `SVC-2`.
  - `svc-6-breach-drizzle-transaction-in-port`: whether a store client library's type counts as
    a library that computes from its arguments.
  - The raw-SQL example above is issue 07's now (store clients).
- Left by issue 10: `TX-23`, `TX-24`, `TX-25` are new, with no example files; the `tx-2-*` files
  show writes only, where `TX-2`'s Scope now covers reads.
- Left by issue 11: `TX-26` is new, with no example files; `SVC-4`'s Scope narrowed to records of
  an aggregate. The fixture gained pay-by-invoice with a bank API, the tax class, and the 3PL's
  article master.
- Left by issue 11's review: `TX-27` is new, with no example files; `TX-26`'s Statement and
  `TX-24`'s Scope changed. `tx-12-ok-shipment-status-replica-from-fulfillment-messages.md` calls
  the replica "shop's own aggregate" and filters a listing by it, which `TX-27` may now reach. The
  saga gained step 6.
- From issue 04's proposal: MAY "breaches" are listed under the rule that governs once the MAY's
  Scope fails. The README's examples entry gains it.

## Decision

—

## Consequences

—
