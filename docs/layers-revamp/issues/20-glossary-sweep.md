# 20 — Glossary sweep after spec 02

**Status:** closed

## Context

Issues 12 and 14 changed eight glossary terms and added five. The README's tier rule says a
changed term sweeps every lower tier and re-decides what the change touched; the sweep was done
by reading, not by grep, and rules still lean on the old senses. Review 03 (`reviews/03/`, commit
`7858b71`, the review-02 suite re-run as a checkpoint) traced all four Implementer cannot-complies
and most of the Fresh repo ambiguities to these terms. Order: `specs/02-review-findings.md`,
step 6, before issue 15 rules on gaps, so that issue 15 rules on text that means one thing.

Settled when it was opened:

- Reach is transitive: a module reaches what the code it reaches reaches. Otherwise one proxy
  module exempts every reach list. The lists say what a module reaches through a port, not only
  the port.
- One subsection per term, worked in the order below: the term's definition first, then every
  Scope, Statement and Relies-on line that uses the term or its old sense, then the-world lines
  that do. Where the term's new sense is right and the rule is wrong, the rule moves; where the
  rule is right, the term. Neither moves on a guess: each is decided with the requester.
- A rule-level gap the sweep uncovers goes to issue 15, named there; this issue decides what the
  words mean, not what the rules should rule beyond that.
- Examples are issue 19's. The ok files review 03 flagged for these terms are listed there
  (`reviews/03/SUMMARY.md` §4); this issue does not touch `examples/`.
- Settle goes: no rule uses it, DRV-7 and TX-21 say acknowledge.
- The README gains, under Tiers, General rules: a Statement change re-reads the rule's own
  examples. Review 03's example regressions came from Statement changes whose examples nobody
  re-read, more than from the glossary.
- Freeze after this issue: no term changes again without the grep below being run first and its
  hits listed in the issue that changes it.

The grep, at HEAD before this issue: `changes nothing` in five TX-5 Relies-on lines (l. 838,
859, 921, 1114, 1129); `recording a tentative operation` in TX-22's Statement (l. 992) and TX-28's
Relies-on (l. 1023); `its store` in TX-1's Statement and the lines that restate it; `settle`
nowhere but the glossary; six reach lists written before transitivity (DOM-1, SVC-6, DRV-8, DVN-4,
ASM-5, SYS-14).

## Problem

### Reach (new, issue 14)

- Transitive, a service that reaches a port of its system reaches the adapter behind it and what
  assembly handed that adapter: the store client, the HTTP client. SVC-6 and DRV-8 list "a port
  of its system" and not what lies behind it, so no service satisfies them while SVC-4 wants the
  save through a repository (`svc-6-breach-service-reaches-repository-behind-port`, raw
  Implementer cannot-comply; dist Implementer and both Fresh drafts asked). Every reach list has
  the hole: DOM-1, SVC-6, DRV-8, DVN-4, ASM-5, SYS-14. Decide where the ruling sits: in the
  definition ("what lies behind a port it reaches through the port is the port's") or in each
  list ("a port of its system and what assembly hands for it").
- `import type` reaches nothing: the definition says "running it reads or calls". A domain typed
  by the store client's row type passes DOM-1. Decide whether that is intended; if so the Why
  says it and an ok example shows it, if not the definition says "reads, calls or is typed by".

### Pure (new, issue 14)

- "It loads on every runtime": read as every JavaScript runtime (Node, edge, browser) by two Fresh
  drafts and as every process of the application by one. Pick one and say it.
- "Hands its caller nothing the caller did not pass": `randomUUID()` and `new Date()` in the
  domain fail it (`tx-17-ok-fulfillment-subscribes-to-order-placed`,
  `tx-22-ok-order-confirmation-mail-through-outbox`). Decide: the domain takes ids and the clock
  as arguments, which DOM-1 then enforces, or the definition excepts what the runtime hands
  every process alike. The Ambient value entry is the neighbour either way.

### Offer (new, issue 14)

- SYS-1 reads "everything it exports MUST be of its offer"; seven ok files export an adapter, a
  courier accessor or a server action (`sys-1-ok`, `svc-1-ok`, `sys-10-ok`, `asm-4-ok`,
  `drv-3-ok`, `drv-6-ok`, `sys-12-ok`). Decide whether a driving adapter a framework imports by
  path is of the offer, or is reached by "what calls it" and SYS-1's Scope excludes the framework's
  entry points.
- "Its system builders": a builder's return value is whatever it returns, so a builder returning
  the system's repositories hands them to every downstream (W14). Decide whether the offer bounds
  what a builder returns, in the definition or in a rule.
- "The fakes of those ports": the open host service's ports only (two drafts) or every port of
  the system (two). Say which.
- Code of a system: by package or by role. A route file under `apps/web/app` that is shop's
  driving adapter by role imports shop's ports by deep path and SYS-1, SYS-9 are not engaged; code
  outside shop by location may import the offer only, and checkout's port is none. Four ok files
  do the first; the raw Implementer built a route builder on shop's build path (N5). Nothing says
  which reading holds.

### System builder against ASM-2 "needs" (issue 14)

- The glossary's System builder "takes configuration and returns implementations"; ASM-2 read as
  "a factory receives what it needs" has assembly constructing Stripe, Resend and `fetch` and
  handing them in, so assembly knows payment uses Stripe (raw Implementer N6; five ok files hang
  on the reading). Decide what a builder needs from outside: clients, or the configuration to
  build them.

### External system against P2 (issue 12)

- The entry says the external system's configuration holds its business rules; all four Fresh
  drafts read it over P2 and put rules into Payload's config (`choices.md` C4). Decide whether the
  sentence is a definition or a ruling P2 should carry, and whether C4 is open on purpose.

### acting, answering, acting call (new, issue 12)

- A use case that changes only an external system, through a tentative operation or a call, and
  nothing of this system is neither acting ("changes the system") nor answering ("changes
  nothing") (raw Contradiction N7, dist Adversarial N7). Decide: acting means changes this system
  or the outside through it.

### Idempotent (updated, issue 12)

- Five Relies-on lines still say `TX-5: a repeated delivery changes nothing`. The new sense is
  "leaves the records as once left them, and answers as the first did". The lines move to the new
  sense; where a rule's Why argued from "changes nothing", the Why is re-read.
- "The records": whose. A mail provider that takes no idempotency key: claim the message id
  then send, and a crash loses the mail, which the records do not show; send then claim, and a
  crash doubles it. Under the new sense the first satisfies TX-5 and TX-37 forbids the claim as a
  decision by the state of its records (dist Implementer cannot-comply, four readers). Decide
  what the records are: this system's store, so the mail is no record and the gap is issue 15's
  "outside effect with no key"; or every effect, so no handler without a key is idempotent and
  the rule has to say what then.

### Tentative operation (updated, issue 12)

- The new sense holds what it asks for. TX-22's Statement "beyond recording a tentative
  operation" and TX-28's Relies-on line use the old one: this system recording a pending record of
  its own, which holds nothing of anyone. Decide the words TX-22 and TX-28 want: "a pending
  record", "a request it has not confirmed", or the glossary's term with a definition that covers
  both sides.
- An unconfirmed PaymentIntent holds nothing: Stripe reserves no funds until it is confirmed. So
  it is no tentative operation, TX-36 does not lift TX-3 and TX-22, and checkout cannot create it
  synchronously to hand the customer its `client_secret` (dist Implementer cannot-comply, both
  sets, raw Contradiction). Decide: widen the term to a commitment or its preparation; or TX-36's
  Scope covers asking for one or preparing one; or the fixture creates the intent after the
  commit, which is review 03's choice candidate (SUMMARY §6 K) and issue 17's.
- "Its confirmation gives it": the definition has the requester confirm; a PaymentIntent is
  confirmed by the customer's browser, a Checkout Session by the customer paying. Say whether a
  third party's confirmation counts (dist Implementer N9).
- A Payload hook before the change commits (TX-28) that writes a revalidation request to the
  outbox (TX-22): TX-28 allows "recording a tentative operation", TX-22 wants an outbox message,
  and the reader could not tell whether the message is the record (dist Implementer
  cannot-comply, `tx-28-ok-after-change-hook-records-revalidation-request`). The words decided
  above settle it.

### Store (updated, issue 12)

- New sense: two clients are one store when one transaction can carry the writes of both. The
  fixture has one Postgres and no roles, so every system's tables are one store, and TX-1 "hand
  it to each call into its store" pulls billing's read into shop's transaction (raw Gap N11, raw
  Contradiction c4 and c5). All four Fresh drafts gave each system a schema and a role. Decide:
  Store is "of one system" by definition, the fixture states the schemas and roles (issue 17), or
  TX-1 says "into its system's store".
- TX-9's Why "a transaction is one store's" and TX-1's Relies-on restatements follow.

### Common library (updated, issue 12)

- "A package of no system that every system may import" also describes zod and every package
  in `node_modules` (dist Adversarial N10). Add "of this codebase", or say what tells it from a
  dependency.
- The old sense was plumbing and therefore outside; P5's Except, "code of the common library
  reached by a service or an adapter", excepted it from "only through ports". Under the new sense
  the common library is no part of the outside, so the Except excepts nothing (both Red teams).
  Decide: drop the Except, or P5 says what the common library is to a system. The world tier,
  under its rules, inside this issue.
- Three Fresh drafts asked whether the domain may import it; DOM-1's list says no. An ok example
  of a domain that does not and a Why sentence in DOM-1 close it, in issue 19 and here.

### Settle (new, issue 14)

- Zero uses. DRV-7, TX-21 and the Relies-on lines say acknowledge. Goes.

### Example stripping (issues 12 and 14)

- Business domain, Business rule, Tooling, Probe, Specification, Record, Fake, Integration test,
  End-to-end test lost their instances: no reader hung on any. "Configuration value", used by
  DOM-7's Scope since issue 13, was never defined; two Fresh drafts and the dist Adversarial read
  it two ways (a value the environment sets, a value Payload's admin sets). Define it or DOM-7
  says what it means without the word.

## Decision

The grep ran at `7eeb049` before any edit; hits as listed under Context, plus "other code" in
SYS-1's Scope and "code outside a system" in SYS-9's. One subsection per term, the definition
first, then the rules.

- **Reach.** Transitive, in the definition: a module reaches what it reads, calls or is typed
  by, and what those reach in turn; what it reaches through a port it reaches as the port, not as
  the code behind it. The six reach lists stand unchanged: the adapter behind a port and what
  assembly handed it are the port's. `import type` is a reach: a domain typed by the store's row
  type breaches DOM-1. DOM-1's, SVC-6's and DRV-8's Whys say so.
- **Pure.** "Every runtime of the language." The clause on handing back nothing stays: the
  domain takes ids and the time as arguments (DOM-1's Why). A service reaches a runtime global
  that is not pure, `randomUUID()`, `Date.now()`, through no list of SVC-6's: meant, it takes
  them through a port or the common library, so a test hands a fake; SVC-6 stands.
- **Offer.** "For code of this codebase outside it"; the fakes are the open host service's
  driving ports' only; a builder returns what assembly hands on. Code of a system is by role,
  not by package: the glossary's System says a module is of the system whose layer or offer it
  belongs to, wherever the repository keeps it. So a route beside the framework's files is its
  system's driving adapter, imports the system's ports as the system's code, and the framework
  reaches it by its way in. SYS-1's Scope: "for code of this codebase outside it to import";
  SYS-9's: "code of this codebase outside a system". The framework and an external system are
  the outside, no code of this codebase; tooling stays as the Assumptions have it. What a builder
  returns beyond the definition is a rule, issue 15's.
- **System builder against ASM-2.** The builder is assembly's part: it receives the
  configuration and what the process holds once, and builds its system's own from them, a client
  its adapters alone use among them. ASM-2's Scope and Statement stand; its Why argues the
  builder. Assembly knows no more of payment than payment's configuration.
- **External system against P2.** A definition, reworded without the modal: business rules its
  configuration holds are its own, in its terms, even where this codebase writes them. P2 holds
  for a system of this codebase; F9 exempts the external system. C4 stays open on purpose, its
  Bound gaining P2 and DOM-7, whose Why rules the second-statement case.
- **acting, answering.** Acting: changes the system, or the outside through it. A use case that
  only asks an external system is acting; DRV-1's one acting call counts it.
- **Idempotent.** "Its system's records": a Record is what a store holds (glossary), so an
  effect outside, a mail, is no record, and the handler without a key is issue 15's gap. The five
  TX-5 lines restate the new sense.
- **Tentative operation.** The holding clause goes: it gives nothing until it is confirmed, by
  the requester or by whoever else the other system takes the confirmation from; confirmation
  gives what it asks for, cancellation ends it. An unconfirmed PaymentIntent is one, confirmed by
  the customer's browser, so TX-36 lifts TX-3 and TX-22 for it and C8 stays a choice. TX-28 loses
  the term: "beyond recording the external system's change as pending"; a record of its own or a
  private message for a handler are both such a record, which settles the TX-28 against TX-22
  reading. TX-29's line and Why follow. TX-30's Scope: "holds a tentative operation, or waits on
  another system's confirmation or answer", so the hook's pending change is in it and TX-28's
  line on TX-30 holds.
- **Store.** Unchanged; it is physical. TX-1's Statement: "hand it to each call it makes into its
  store"; the restating lines follow. Its Why: a call into another system's open host service is
  no call into the store and takes no transaction (TX-25), so two systems' tables in one store
  leave the other's reads apart. The fixture's schema and role per system is issue 17's. The
  Context's "TX-9" is no rule; "a transaction is one store's" is in TX-22's and TX-6's Whys and
  still holds.
- **Common library.** "A package of this codebase that belongs to no system, written for every
  system to import." P5's Except excepts what it did under the old sense: the outside reached
  through the library's code, where the output changes neither how a use case acts nor what it
  answers; ASM-7 delivers it unchanged. DOM-1's Why says why the library is off its list.
- **Settle.** Gone.
- **Configuration value.** Defined: a value a process is given when it starts and keeps for its
  life, which no record holds. A number in a business rule arriving that way is issue 15's.
- **README.** Tiers, Glossary: the sweep starts with the grep and lists the hits. The General
  rules sentence on re-reading examples was there since the issue opened.

Guessed, not agreed, open to overturn: what a builder returns beyond the glossary is a rule
(issue 15), not a sharper definition; SVC-6 unchanged for the id generator; TX-30's Scope
widened rather than TX-28's line on it narrowed; the Context's "TX-9" stays a slip.

## Consequences

- To issue 15: what a builder may return beyond the glossary; a business rule's number arriving
  as a configuration value (DOM-7 against ASM-2); the handler without a key, "its system's
  records" settled.
- To issue 16: lines rewritten here, read again there: the five TX-5 lines; TX-1's lines in
  SVC-2, SVC-3, TX-2, TX-23, TX-24, TX-15, TX-37, TX-6, TX-5, TX-34, DRV-1, DRV-7, TX-25, TX-28,
  TX-38 for "each call it makes"; TX-29's on TX-28; DVN-4's on SYS-9.
- To issue 17: a schema and a role per system, or one store for all.
- To issue 19: under transitive Reach, `svc-6-breach-service-reaches-repository-behind-port` is
  no breach; the seven SYS-1 ok files are judged by role and by the narrowed offer; the five
  ASM-2 ok files building clients in the builder are ok; `tx-17-ok` and `tx-22-ok` take ids and
  the time as arguments; `dom-1-breach-order-type-from-drizzle-table` stays a breach with
  `import type`; an ok example of a domain that imports no common library; TX-28's and TX-30's
  examples against the new words.
- Freeze: no term changes again without the README's grep.

