# 06 — Glossary pass

**Status:** open

## Context

Issue 05's provenance pass and issue 04's reader round left changes to glossary terms. Changing a
term is an issue a fresh session works (README, Tiers): it sweeps every lower tier for the term
and re-decides what the change touched. Adding a term is cheaper and is not here, except where
the addition leans on a change.

## Problem

Items, with where their detail is:

- External system: Product and third party merge; draft in issue 05 (`TX-3`, `TX-22` entries).
  "Third party", undefined, appears across the general rules.
- Published language and open host service: the published language holds the types of the open
  host service's driving ports only (issue 05, `SYS-2`); driving port types themselves (issue 04).
- A driving port that names a question in the published language, `TX-12`'s
  `findInvoices(where: SQL)` hole (issue 04).
- Driving port grouping (issue 05, `SVC-1`).
- Whose published language holds a command, the sender's or the receiver's (issue 05, `TX-17`);
  Upstream and downstream split alike.
- System: code that is no system, the admin dashboard, `/health`, `/metrics` (issue 04).
- Message, Saga, Handler; Bus delivering to subscribers while a command goes to one receiver
  (issue 01).
- System builder.
- Service "holds no rule of its own".
- Snapshot against kept copy, `DOM-4`'s value copied against a copy fed by messages (issue 04).
- Shared kernel, `Money` and `Sku` (issue 04).
- Ambient value's per-process scope.
- Reconciliation: used by no rule once `SYS-7` retires; drop it, or keep it for issue 01.
- Fake: Fowler's definition, "Fake objects actually have working implementations" (issue 05,
  `TST-11`).
- Integration test: a real dependency running where the test runs, a database or a broker in a
  container; adds End-to-end test and Default suite, drafts in issue 05 (round 3i).

## Decision

—

## Consequences

—
