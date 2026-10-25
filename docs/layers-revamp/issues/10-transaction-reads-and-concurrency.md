# 10 — Transaction reads and concurrency

**Status:** closed

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

- **Reads.** `TX-2`'s Scope becomes a driven adapter handed a transaction; each call into its
  store, reads included, runs inside it. The visit: `TX-1`, `TX-5`, `TX-6`, `SVC-4` rely on writes
  inside the handed transaction, which the wider Statement still guarantees; their lines stand.
- **Concurrency.** Two new rules; `SVC-2`'s Scope and Statement stand:
  - `TX-23`: a repository's save fails where the aggregate changed since it was loaded. A version
    compared on save and a lock held from load to commit both comply. Khononov p. 86–87, Vernon
    EAD I p. 2, Evans p. 94.
  - `TX-24`, SHOULD: the data a decision has to hold by at commit belongs to aggregates the use
    case saves. A decision across aggregates holds after a delay; a deviation's ADR names a lock
    or an isolation level. Evans p. 91 and p. 97, Vernon EAD I p. 3.
  - `SVC-2` relies on `TX-2`, `TX-23`, `TX-24`; its Why's "loads the data in the transaction that
    writes" gains the failing save.
- **Isolation.** The Assumptions gain a write that fails where the record changed since it was
  read, and assume no isolation. `TX-23` holds at READ COMMITTED: Postgres re-checks an
  `UPDATE`'s condition against the row version it waited for.
- **Answering ports.** `TX-25`: a driving port takes no transaction. `ASM-9`'s Why, the
  transaction stopping where a call into another system takes none, now relies on it.
- Review fixes: `TX-5`'s Why has a second record of the same id fail, for a redelivery running
  beside the first attempt; `TX-23` relies on `SVC-4`, a version seeing only writes through the
  repository; the Assumptions' no isolation reads committed writes.

## Consequences

- To issue 07: shop's fields on Payload's `products` document fall under `TX-23`; whether the
  Local API can make a write conditional, and whether an editor's copy edit is a change to shop's
  aggregate.
- To issue 08: `TX-23`, `TX-24`, `TX-25` have no examples; the `tx-2-*` files show writes only.
