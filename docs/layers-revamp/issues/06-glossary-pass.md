# 06 — Glossary pass

**Status:** closed

## Context

Issue 05's provenance pass and issue 04's reader round left changes to glossary terms. Changing a
term is an issue a fresh session works (README, Tiers): it sweeps every lower tier for the term
and re-decides what the change touched. Adds settled in other issues come here too. Order and
scope: `specs/01-work-order.md`, step 2.

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
  it. Tested against issue 07's Problem list, which builds on it.
- Published language and open host service: driving port types themselves (issue 04).
- A driving port that names a question in the published language, `TX-12`'s
  `findInvoices(where: SQL)` hole (issue 04).
- Driving port grouping (issue 05, `SVC-1`).
- System: code that is no system, the admin dashboard, `/health`, `/metrics` (issue 04).
- System builder.
- Service "holds no rule of its own".
- Snapshot against kept copy, `DOM-4`'s value copied against a copy fed by messages (issue 04).
- Shared kernel, `Money` and `Sku` (issue 04).
- Ambient value's per-process scope.

Left to issue 01, which changes them under the glossary's tier rules (README, Tiers):

- Whose published language holds a command, the sender's or the receiver's (issue 05, `TX-17`);
  Upstream and downstream split alike.
- Message, Saga, Handler; Bus delivering to subscribers while a command goes to one receiver
  (issue 01).
- Reconciliation: used by no rule once `SYS-7` retires; drop it, or keep it for issue 01.

## Decision

Settled entries applied as drafted, but for the External system follow-ons: Tentative operation
reads "a request to another system", an external system being one; End-to-end test reads "a real
external dependency running elsewhere: an external system's own service, such as Stripe in test
mode, or a mail provider's sandbox", mirroring Integration test, so a mail sandbox test stays out
of the default suite. Fake: "A working implementation of a port that reaches nothing outside the
process: a repository over an in-memory map."

Open items:

- External system: issue 05's draft, plus "though it may configure it". A bounded context is the
  test, so a mail provider stays behind a driven port, no external system. Product goes; Hook
  moves above it. Port's "a product's hook" becomes "a webhook". Tested against issue 07: catalog
  is an external system, so catalog data written through Payload falls under `TX-22`'s Scope; the
  rest of its list reads unchanged.
- Published language and open host service: no change beyond the settled wording. The driving
  port types are the open host service (Port: an interface); the published language is what they
  take, return and raise. Issue 05 puts ports in the service layer, so no domain imports one.
- Driving port, the `findInvoices(where: SQL)` hole: it names the use case and what a caller
  brings "in the system's terms, not its store's".
- Driving port grouping: one use case per port, as issue 05 decided (`SVC-1`).
- Code that is no system: Tooling, a term under System: "Code that runs in no process of the
  deployed application: a developer CLI, a seed script, a test that asserts about the source
  tree." Assumptions: tooling sits outside the layers and the rules; `/health` and `/metrics`
  outside the layers, beside assembly. The admin dashboard is a system of its own, reading under
  `TX-12` (issue 04's proposal); no text.
- System builder: no change. It is a factory by Factory's definition, so `ASM-2` reaches it;
  Seemann's late composing is `ASM-1`'s Provenance.
- Service: "What it holds is the sequence: what to load, which rule to ask, what to save." Where
  Martin's use cases and Fowler's Service Layer hold rules, here the sequence is the service's and
  the rules are the domain's.
- Snapshot and Replica, under Domain: `DOM-4`'s value copied against `TX-12`'s copy fed by
  messages.
- Shared kernel, under Other systems: "A model several systems of this codebase share as code,
  each importing it into its domain". `DOM-1`'s list gains it, applied with issue 05 (Evans
  p. 251, Khononov p. 51).
- Ambient value, per process: "set once for the process's life, like what assembly produced, a
  ready-made logger or an environment variable".

## Consequences

- `glossary.md` carries every entry above; `general-rules.md`'s Assumptions the Tooling and
  `/health` sentences.
- Swept: the README's group example, `domain.md`'s catalog kind and third parties, examples whose
  prose used "product" or "third party" as a term. Rules issue 05 rewrites or retires are left to
  its Apply, which gains a bullet mapping them to these terms.
- Issue 07's catalog item restated under `TX-22`.
