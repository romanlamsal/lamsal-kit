# 14 — Lists out of the distilled

**Status:** closed

## Context

Five rules rule what a module imports by a closed list: DOM-1 (a domain module), SYS-14 (a module
of a published language or a shared kernel), SVC-6 (the service layer), DRV-8 (a driving adapter),
DVN-4 (a driven adapter). Issue 05 chose the form for its check: an import is one of the kinds
named or it is a question for the rule. The full review (spec 02) found the form wanting in three
ways: a list bounds imports where the harm is in reaches, no list is complete, and the lists
disagree with each other. Order: `specs/02-review-findings.md`, step 5.

Widened after the review, when the README gained "nothing the distiller keeps names instances"
(Rule shape, What binds): this issue sweeps every list of instances in the distilled output
(README, What binds), in any document. A
list that is the ruling becomes a reach statement, its items example files; a list that
illustrates goes, an item becoming an example file where it is worth one. Among them the Scopes of
DOM-3, SVC-2, SVC-7, DRV-1, ASM-10, ASM-7, TX-24, TX-22 and TX-32, the forces, and the glossary
entries issue 12 does not reword. The check is a read of the distilled output. ASM-7's and
TX-22's Scopes lost their lists in issue 13.

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
- The import list becomes example files, named from Examples, where an ok example may be
  concrete and a script may still check it. The Provenance keeps that the list was this
  document's.
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
  The domain reading `TZ` past ASM-3's Scope, deferred here by issue 13.
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

Three passes, each settled with the requester before any edit.

- Lists that illustrate went: seventeen glossary clauses, F1 and F4, the tooling clause of the
  Assumptions, the Scopes of DOM-3, SVC-2, SVC-7, DRV-1, DRV-3, ASM-10, TX-24, TX-32, TX-35 and
  TST-7's Statement. The README's swap test tells an illustration from a definition: members each
  swappable for another of their kind are instances; members that together are the term go on
  being the definition. Partitions and definitions stayed.
- Every item a Scope or Statement lists is argued in its rule's Why, the reasoning inline, no Why
  pointing at another Why. Where the Why was silent the Why grew; no Statement moved on a guess.
- Reach. Glossary: a module reaches what running it reads or calls, however the code got hold of
  it. Pure, Offer and Settle entered alongside. The five import rules rule the reach: Scope "X
  reaches past itself", Statement "What it reaches MUST be one of:" the kinds, in glossary terms.
  "A library that computes from its arguments" is "pure code of no system"; a sibling module is
  the module. DRV-8 gained an upstream's published language, "the framework that calls it" became
  "what calls it". DVN-4's client, external package and upstream export path are "the outside".
  SVC-6 reaches "the published language and the open host service of an upstream its system
  conforms to", not its whole offer. SYS-1 exports nothing but the offer; SYS-9 reaches a system
  through its offer; SYS-2 and ASM-5 say reach, ASM-5 losing its list of mechanisms. ASM-10 and
  ASM-7 keep "import": there the mechanism is the ruling. The Assumptions say offer, not export
  path.

## Consequences

- Problems above: the upstream published language is in DRV-8; SVC-2's DRV-8 line is now
  guaranteed; a module beside a module is inside the Scope's "itself"; a global that hands back
  what nobody passed is not pure, so DOM-1 and SYS-14 catch it; a store client's type is not
  pure code of no system; a handler inside assembly is judged by what it reaches; the repository
  through the courier is a driven port, on no driving adapter's list. The courier accessor's
  export stays a SYS-1 finding.
- To issue 19: every example naming DOM-1, SVC-6, DRV-8, DVN-4, SYS-14, SYS-9, SYS-1, SYS-2 or
  ASM-5 is re-read. Expected flips: `drv-8-breach-adapter-reads-repository-to-check-owner` and
  `svc-6-breach-drizzle-transaction-in-port` become clean breaches; the three DRV-8 ok examples
  importing shop's schema become ok.
- To issue 16: the Relies-on lines on the nine rules were rewritten here; DVN-4 gained a SYS-9
  line.
- Open elsewhere: "plumbing" in P5's Except and three Whys; `new Date()` in a service is SVC-7's,
  reach wording already; TX-30's saga-reply side is unargued by agreement; ASM-3's TZ read is
  covered by DOM-1's pure clause now.
