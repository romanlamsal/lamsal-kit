# 10 — Transaction reads and concurrency

**Status:** open

## Context

Issue 09 wrote each rule's Relies-on lines against the Statements as they stand. The transaction
rules guarantee less than `TX-1` and `SVC-2` lean on. Order: `specs/01-work-order.md`, step 5.

Settled when it was opened:

- `TX-1`'s Why claimed one transaction lets a check and the write it allows see the same state.
  Struck in issue 09's review: false at Postgres's default isolation, READ COMMITTED, where two
  checkouts both read a stock of 1 and both commit.
- The Assumptions name atomicity, several writes applied at once, and no isolation.

## Problem

- **Reads.** `TX-1` hands the transaction to each call into the store, reads included, and
  `SVC-2` reads what it decides by in it. `TX-2`'s Scope is a driven adapter that writes, so no
  rule has an adapter read inside the transaction it is handed. Lead: `TX-2`'s Scope becomes every
  call into a store. A Scope change: it visits `TX-1`, `TX-5`, `TX-6`, `SVC-4` (README, Working
  here 4).
- **Concurrency.** `SVC-2` enforces a decision in the call that acts, against a stale check
  (CWE-367). One transaction does not stop a concurrent one from changing what it read before it
  commits. Lead: a repository's save fails where the aggregate changed since it was loaded, a
  version compared on write (optimistic concurrency; Khononov's aggregate chapter, page to verify
  in the sources). That covers a decision inside one aggregate. A decision across aggregates,
  stock against open orders, needs a lock or a stricter isolation level: a rule for it, or
  `SVC-2`'s Scope narrowed to one aggregate. Whether the Assumptions gain isolation is part of it.
  `SVC-2`'s Why ("loads the data in the transaction that writes") follows the decision.
- **Answering ports.** `TX-1` has a writing use case's service open its own transaction, so its
  driving port takes none. An answering use case's port is not covered: a downstream can hand its
  transaction to an upstream's answering port, the harm `ASM-9` names for an ambient one, one
  transaction spanning two systems.

## Decision

—

## Consequences

—
