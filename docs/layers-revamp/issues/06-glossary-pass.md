# 06 — Glossary pass

**Status:** open

## Context

Issue 05's provenance pass and issue 04's reader round left changes to glossary terms. Changing a
term is an issue a fresh session works (README, Tiers): it sweeps every lower tier for the term
and re-decides what the change touched. Adds settled in other issues come here too, so every
glossary edit lands in one pass. First in the chain: issue 05's Apply follows, then issues 01,
04 and 07.

## Problem

Settled, wording drafted; applied here with the sweep:

- Idempotent, an add (Between systems): "An operation is idempotent when repeating it leads to
  the same result as performing it once." Khononov p. 68 (issue 05, `TX-5`).
- Tentative operation, an add (Between systems): "A request to another system or a third party
  for a commitment that leaves open the possibility of cancellation. It changes nothing it asks
  for: its confirmation does." Helland 2007 (issue 05, `TX-3`). "A third party" follows the
  External system item.
- Published language: "its driving ports" becomes "its open host service's driving ports"
  (issue 05, `SYS-2`).
- Integration test: "A test that uses a real external dependency running where the test runs: a
  database or a broker in a container." Adds End-to-end test, "A test that talks to an external
  system's own service, such as Stripe in test mode.", and Default suite, "The tests run by
  default: every test that is neither an integration test nor an end-to-end test." (issue 05,
  round 3i). "External system" follows the External system item.
- Fake, an add: Fowler's definition, "Fake objects actually have working implementations" (issue
  05, `TST-11`); wording to draft.

Open, with where their detail is:

- External system: Product and third party merge; draft in issue 05 (`TX-3`, `TX-22` entries).
  "Third party", undefined, appears across the general rules. First: two settled entries lean on
  it.
- Published language and open host service: driving port types themselves (issue 04).
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

## Decision

—

## Consequences

—
