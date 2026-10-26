# 14 — Lists to reach

**Status:** open

## Context

Five rules rule what a module imports by a closed list: DOM-1 (a domain module), SYS-14 (a module
of a published language or a shared kernel), SVC-6 (the service layer), DRV-8 (a driving adapter),
DVN-4 (a driven adapter). Issue 05 chose the form for its check: an import is one of the kinds
named or it is a question for the rule. The full review (spec 02) found the form wanting in three
ways: a list bounds imports where the harm is in reaches, no list is complete, and the lists
disagree with each other. Order: `specs/02-review-findings.md`, step 5.

Settled when it was opened:

- Each Statement says the reach, what the module may read or call, which is what each list tried
  to say: the domain reads nothing it is not handed and runs on every runtime (P1, P6); a
  published language and a shared kernel load nothing of a system; the service layer reaches its
  own ports, its domain and the published languages it conforms to; a driving adapter reaches its
  system through its driving ports; a driven adapter reaches the thing it adapts and the port it
  implements. The session words each.
- Reach is what the sources rule: Cockburn's inside that knows nothing of the outside, Evans's
  dependency direction, Khononov's business logic layer depending on no infrastructure. A reach
  Statement is no stricter than they are.
- The import list moves under Examples, where an ok example may be concrete and a script may
  still check it. The Provenance keeps that the list was this document's.
- Every example listing one of the five rules is re-read by issue 19; every Relies-on line naming
  one by issue 16.

## Problem

- DRV-8's list has neither the published language of an upstream nor an external system's
  package, which DVN-4's has. A handler of `OrderPaid` cannot import shop's schema; the Stripe
  hook cannot import `stripe`. Three ok examples import anyway:
  `sys-9-ok-billing-imports-from-export-path`, `tx-1-ok-one-invoice-transaction-per-message`,
  `svc-7-ok-payment-reaches-stripe-through-gateway-port`. The compliant shapes today are a
  conformist re-export through the domain, or a schema restated inline beside the published one.
  Found by five readers of both sets.
- SVC-2's Relies-on line has DRV-8 guarantee that a driving adapter "reaches its system through
  driving ports". DRV-8 rules imports; the reach is SVC-7's, which says "a port", so a repository
  is reached from a driving adapter through the courier with every Statement met (both
  Adversarials; `svc-7-breach-server-action-raw-sql-through-common-pool` lists DRV-8 as
  satisfied). A reach Statement for DRV-8 makes the line true.
- Sibling modules: DOM-1 and SYS-14 name "another module of the same"; DVN-4, DRV-8 and SVC-6
  name no sibling. `asm-2-ok-payload-adapter-takes-instance` and
  `asm-7-ok-logger-and-tracer-imported-ready-made` fail DVN-4 on an import from `./`. Decide
  whether a module beside the adapter is the adapter.
- A global is no import: `crypto`, `process.env`, `Date.now()`, `toLocaleUpperCase()` reach the
  runtime and the locale past DOM-1 and SYS-14 with every Statement met (both Adversarials).
  `new Date()` in a server action, in four ok examples, reaches the clock past SVC-7's port.
- What an allowed import hands over: SVC-6's "a library that computes from its arguments" lets
  Drizzle's transaction type into every port signature through the common library (raw
  Adversarial); `svc-6-breach-drizzle-transaction-in-port` asks whether a store client's type is
  such a library (issue 08).
- A handler written inside assembly imports nothing, so DRV-8 does not hold for it:
  `drv-8-breach-mailer-subscribed-to-bus-in-assembly` (issue 08). A reach holds wherever the code
  sits.
- `drv-8-breach-adapter-reads-repository-to-check-owner` reads the repository from the courier and
  keeps only SVC-2; a repository is a port of its system, so SVC-7 lets it through (issue 08). The
  reach Statement decides it.
- `drv-6-ok-server-action-reads-at-run-time` imports a courier accessor from an export path of
  shop, which SYS-1 does not have shop export; the accessor's home is in no rule (raw Implementer
  N8).

## Decision

—

## Consequences

—
