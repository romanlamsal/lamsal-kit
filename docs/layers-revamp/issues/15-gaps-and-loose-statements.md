# 15 — Gaps and loose Statements

**Status:** closed

## Context

The full review (spec 02) found situations of the fixture no Scope holds for, and Statements a
breach satisfies with nothing in the Why to move (issue 13 has those). Found by both sets unless
noted. Order: `specs/02-review-findings.md`, step 6, on the text issues 12 to 14 leave.

Settled when it was opened:

- A gap closes by a new rule, a widened Scope, or a sentence in the Assumptions, under the tier
  rules; or it stays open on purpose, recorded here.
- A loose Statement is sharpened until it refuses the breach, or the breach is accepted and the
  ok example says why.
- A rule placing business rules exists by now (spec 02, step 2); findings it covers are checked
  against it, not ruled again.

## Problem

### Gaps

- A decision on another system's live answer. Checkout reads billing's dunning stage through its
  open host service and commits on it. TX-24 covers this system's own stored data, TX-27 a
  replica. Both Implementers built a replica to stay inside TX-27: a detour.
- An outside effect with no idempotency key. TX-5 against a mail provider that takes none:
  claim the message id, then send, and a crash loses the mail, which P8 forbids and no rule
  does; send, then claim, and a crash doubles it. Idempotent counts records, not the mail (issue
  12). The same for the 3PL and the bank. TX-22's Why rules it
  today ("a repeat stays possible, which a business rule has to allow"); issue 13 removed the
  sentence, this issue decides what it says.
- A polled answer (distilled). The bank's transfers are applied again on every poll: TX-5 covers
  delivered messages, a polled answer is none. An unmatched transfer is dropped: TX-35's Scope
  wants a delivered event. Holds if the bank is polled (issue 17).
- A probe's way to the store. ASM-4 shuts the courier to anything but a driving adapter; ASM-2
  covers factories, not route modules. Every reader had `/health` open its own pool, which pings
  a pool no use case uses. `gap-health-and-metrics-endpoints` from round 1.
- Instrumentation built before assembly, from the environment: ASM-1's Statement does not reach
  it. Holds if the library's load order is no convention; may be the stack document's.
- Catalog's config reading fulfillment's stock table. The Assumptions name two parts of external
  configuration the rules reach, SYS-12's and TX-29's; a read is neither. Both Implementers read
  fulfillment's open host service instead.
- The admin dashboard belongs to no system (raw; `gap-admin-dashboard-belongs-to-no-system`).
  Both Implementers host it in shop over replicas; if the fixture means the owners' tables
  (issue 17), TX-12 cannot be complied with.
- Trace context crossing the outbox (distilled): ASM-3 covers the read, TX-7 the schema, nothing
  the crossing. `asm-3-ok-trace-context-crosses-bus-in-envelope` shows a shape with no rule.
- A message with no schema, `payload: unknown` in a common-library outbox, lost its rule with
  TX-4 (issue 08).
- One transaction across shop and Payload: `svc-6-ok-opaque-transaction` and
  `asm-2-ok-payload-adapter-takes-instance` hand shop's transaction into Payload's Local API.
  TX-25's Scope is a system declaring a driving port; P16 is uncovered for an external system's
  ways in (raw Implementer N11).
- An external system's Local API as this system's way in: is Payload's Local API catalog's open
  host service for TX-12 (raw Implementer N3, both Gaps). Fact in issue 17, rule here.
- Properties no rule delivers, since issue 12. P15: TX-12 lets a use case read another system's
  open host service whether or not a business rule needs the answer now; with the first gap
  above. P19: no rule speaks of a term's meaning within a system.

### Loose Statements

- SVC-7: a generic `Sql` port declared in the service layer. "A port of its system" does not say
  the system's terms (P5).
- SVC-3: a driven port whose adapter wraps a sibling service, typed inline; the second
  transaction commits alone (raw: cart cleared, order lost; distilled: a gapless number spent).
- TX-28: the hook's use case records a private message, and its handler acts before Payload
  commits. Whether the message is tentative depends on the handler, outside the Scope.
- TX-7: an optional `paidByInvoice` keeps both directions readable; old handlers ignore it and
  the order is never invoiced (P14). DOM-3 (distilled): a field's meaning changed in place; TX-7's
  Scope has no records.
- TX-30, TX-35: any business rule satisfies: one that abandons without asking Stripe, postpones
  forever, or asks for the refund again forever.
- TX-23: reload and save again after the conflict (raw); an upsert of an aggregate never loaded
  (distilled, P10).
- TX-17: one event per consumer with no system named (raw).
- TX-24 (distilled): a decision by a snapshot inside the saved aggregate.
- TX-12 (distilled): shop reads billing's outbox table as "published events".
- TX-19 (distilled Contradiction): alone, it may leave no code for scarce or numbered allocation
  under F5, the last unit or a gapless number.
- TX-22's Scope read literally holds for the handler's own use case too (raw Contradiction N8).
  Settled by issue 13: TX-22's Scope is a use case that decides, TX-37 the one that makes.
- ASM-2 against DRV-3 on the Payload cycle: the raw set says neither Scope is narrower and the
  pair hangs on "receive it from its caller"; the distilled says DRV-3 governs. Say which.
- ASM-4: is a typed courier accessor the reader (raw Implementer N8).
- Words issue 12 leaves to the rules: a request id as "what it answers" (TX-34), ASM-3's reach
  into a domain function the service calls, DRV-7's "succeeded" (a use case that returns without
  committing, a refusal recorded and committed; a conflict committed as a refusal is TX-38's
  since issue 13), TX-19's "the same result" (Idempotent's no longer says "result").

### Since review 03, cooperative readers only

The Implementers and Fresh drafts of review 03 (`reviews/03/`); the optional readers' findings
stay in its SUMMARY, not accepted here.

- TX-37 "deciding again by the state of its records": does a `handled.claim` before an outside
  effect decide, does a record step that keeps the first answer, does a lapse rule of this
  system (`tx-28-ok-after-change-hook-records-revalidation-request`, raw Implementer N17, dist
  Implementer tx-37-breach and purpose list). Every handler example claims first; TX-37 read
  literally forbids it.
- TX-38 with TX-21 and DRV-7: a use case that can never succeed, a refund of an order never
  invoiced (`tx-33-ok-billing-handles-payment-refunded`), fails and is delivered again forever.
  No rule parks it; P17 does not hold for parked deliveries (dist Implementer, two Fresh drafts).
- ASM-3 and TX-15: Scopes compliant code leaves. The compliant alternative, the value passed as
  an argument, the write left to a handler, is outside the Scope, so an ok example satisfies
  nothing (raw Implementer N8).
- A published language that states a rule of its system, `quantity` positive, the tax class enum,
  states it twice: SYS-2 forbids reaching the domain, DOM-1 forbids the domain reaching the
  published language, DOM-7 wants the rule in the domain (dist Implementer tension,
  `sys-14-ok-money-returns-remainder`).
- "Conforms": DOM-1 and SVC-6 admit an upstream its system conforms to, and nothing says how a
  system declares that (`tx-35-ok-late-payment-refunded`, dist Implementer N20).
- "Another system of this codebase" (TX-3, TX-22, TX-34): whether an external system this
  codebase configures is one decides TX-3 against TX-22 whenever shop writes catalog's records
  (raw Implementer N17).
- Test words no rule or term gives: "double" (TST-5, TST-10), "flag" (TST-8), "contract suite"
  (TST-6) (dist Implementer N20).

### Since issue 20

- What a system builder returns: the glossary says what assembly hands on; a builder returning
  its repositories breaches no Statement, since SYS-9 is met through the builder.
- A business rule's number arriving as a configuration value (glossary since issue 20): DOM-7
  wants the rule in the domain, ASM-2 the value from the caller; which holds for the deadline's
  minutes.
- "Its system's records" in Idempotent settles that a mail is no record: the handler without a
  key is this issue's gap, not the glossary's.

Regression on issue 20 (`reviews/03/regression/20-glossary-sweep.md`, N1 to N3 and Noticed):

- N1, System builder against SYS-1. The definition now lists what a builder returns: driving port
  implementations, handlers, outbox readers. A hook, a route and a scheduled task are none, so a
  builder returning them is no system builder and the path exporting it breaches SYS-1; both
  review 03 builds have one. The list is also instances in distilled text (README, What binds).
- N2, Pure against DRV-8. "Loads on every runtime of the language" makes a Node built-in impure,
  so a Node-only driving adapter verifying a webhook signature with `node:crypto` reaches what
  DRV-8 does not list. Same cluster: DRV-8 lists no entry for an external system's SDK doing the
  verification; it passes only as "what calls it".
- N3, Reach against SVC-7. Through a port as the port: a service querying the store through a
  common-library interface reaches the interface, so SVC-7's Scope fails and the store is reached
  through no port of its system. The same clause resolves R03-24.
- A ready-made common-library clock: issue 20 lets a service take the time "through a port or the
  common library"; a clock is no port and reaches the operating system, and neither SVC-6 nor
  ASM-7 admits it.

Closed since this issue was opened, by issues 12 to 14, per review 03: the probe's way to the
store (glossary Probe), the admin dashboard (SYS-9's Scope), instrumentation before assembly,
ASM-2 against DRV-3 on the Payload cycle. Each is checked against the rule that closed it, not
ruled again.

### Since regression

Regression on this issue's first close (`reviews/03/regression/15-gaps-and-loose-statements.md`,
N1 to N4) and the two Fresh repo drafts (`15-fresh-a.md`, `15-fresh-b.md`), 16 checklist items
resolved, one newly broken:

- N1 (R03-24), Reach against SVC-7. Reach stops at a port of its system; the common library's
  `Transactions` is none, so a service running a use case through it reaches the store, which
  SVC-7 forbids. The Decision below says ASM-7 lets it through; it does not: a failed commit
  changes how the use case acts, so ASM-7's Scope fails. Hits `svc-6-ok-opaque-transaction`, P5's
  Except (R03-58) and the whole distilled build.
- N2, SVC-8 against Conformist. SVC-8 has no exception for a conformist where DOM-1 and SVC-6
  have one; `asm-2-ok-shop-reads-invoice-through-driven-port` and
  `tx-12-ok-invoice-number-through-billing-port` declare a driven port in billing's published type.
- N3, TX-7 against an added optional field. "Readable by old code as new code meant it" catches
  every optional field an old reader ignores; `tx-7-ok-gift-message-added-optional` breaches.
- N4, SVC-2 against TX-24 and TX-27. Under the reading the Decision's own example needs, what the
  use case decides by is what the call saves, so SVC-2 is a MUST exactly where TX-24 does not
  apply: replicas, and decisions that need not hold at commit. It refuses what TX-27 allows; hits
  raw fulfillment's `planShipment` and dist checkout's replica fallback.
- Fresh draft A, S4: Reach's "as the port" with "Domain ... It is pure" reads two ways, a domain
  module calling a port reaches the interface and stays pure, or reaching a port whose
  implementation leaves the process is reaching outside. Review 03's drafts raised no reading of
  Reach; this sentence opened one. Pure's runtime reading (review 03 A S9) and System builder's
  list reading (review 03 B S17) are gone; Double raised no reading.

## Decision

Method, settled with the requester before any edit: every item ruled against Scope and Statement
as issues 12 to 14 and 20 leave them. A gap closes in a Scope, a Statement, a new rule or a
sentence in the Assumptions; a reading settles in binding text or in the glossary; a loose
Statement is sharpened, or its breach is accepted and the reason recorded here for the ok example.
Glossary changes under the freeze: the grep ran at `96ffa84`, hits listed per term. New ids: DOM-8,
DOM-9, SVC-8, ASM-11, SYS-16, TX-40 to TX-47.

### Glossary

- **Reach** (N3): "What it reaches through a port *of its system* it reaches as the port." Hits of
  the old clause: glossary l. 41, SVC-6's Why l. 187. An interface of the common library is no port
  of its system, so the code behind it is reached: a service querying through a common-library
  `Sql` interface reaches the store, and SVC-7 binds. The common library's telemetry is reached the
  same way and ASM-7 lets it through, its output changing neither how the use case acts nor what
  it answers. Its `Transactions` is not: a commit's outcome decides what the use case does and
  answers, so the transaction is a driven port of the system (TX-47, Since regression below), and
  R03-24 is resolved by the clause and TX-47. The six reach lists stand. A conformist's upstream
  ports are its own driven ports
  (glossary), so they stop the reach.
- **Pure** (N2): loses "it loads on every runtime of the language". Hits: glossary l. 44; DOM-1's
  Why l. 50 and Provenance l. 75; "pure code of no system" in the Statements of DOM-1, SVC-6, DRV-8,
  DVN-4, SYS-14 and the DOM-1 lines of TST-3 and TST-10. The runtime clause moves to where it
  protects something: DOM-1 and SYS-14 list "pure code of no system that loads on every runtime of
  the language", since the domain, the kernel and the published language are what a browser and
  another system's process import. `node:crypto` in a driving adapter, a driven adapter or a
  service is pure code of no system; `randomUUID()` and `Date.now()` still fail the handing clause.
- **System builder** (N1): loses the list, "and returns what assembly hands on". Hits: glossary
  l. 184 and 191, ASM-1's Why l. 480 and 489, ASM-2's Why l. 501, ASM-8's Why l. 645. What it may
  return is ASM-11's.
- **Double**, new: what a test puts in place of something the code under test reaches; a fake is
  one that works. TST-5 and TST-10 use the word. "Flag" (TST-8) is common language; TST-6's
  Statement defines "contract suite" inline.

### Assumptions

- The external-system paragraph: the configuration parts the rules reach gain "what it reads of
  the system's records (SYS-9)"; it is no system of this codebase where a rule says one (TX-3
  against TX-22); where a rule names an open host service or a published language and the system
  is external, its API is the one and its package the other (TX-12, DRV-8, the SDK in a hook).
- Not covered gains: how telemetry crosses a message, the trace context on the envelope, the
  stack document's; where a system records that it conforms to an upstream, the repository's,
  the glossary's Conformist saying how it shows in code.

### New rules

- **TX-40** (P15). Scope: a use case reads data another system owns, and no business rule of this
  system needs the owner's answer before the use case commits. Statement: it SHOULD read it from
  the owner's published events, not from its open host service. TX-12's Why loses the rule of
  thumb. C6's Bound gains TX-40; the entry stays open, both its designs hold where a rule needs
  the answer now.
- **TX-41** (the keyless outside effect). Scope: a use case called for a message changes something
  in an external system that takes no idempotency key. Statement: a business rule of its system
  MUST accept the change being made again on a repeated delivery. TX-22's old "no key" sentence
  lands here; P9's Why said it already.
- **TX-42** (a message's shape). Scope: a system writes a message. Statement: its shape MUST be
  stated once, as a schema. `payload: unknown` parsed by hand in each handler breaches. Published:
  the published language (SYS-2); private: the system's own.
- **TX-43** (P16, the caller's side). Scope: a use case of this system calls another system.
  Statement: the call MUST NOT carry the use case's transaction. Payload's Local API handed shop's
  transaction breaches; TX-25 stays the callee's side. Where one Postgres is one store (issue 17),
  TX-1 and TX-2 read the other system's tables as this use case's store; TX-43 is the narrower
  and governs.
- **TX-44** (a pending external change). Scope: a use case of this system acts on an external
  system's change this system recorded as pending. Statement: it MUST NOT act on it before the
  external system has confirmed the change. The version check in
  `tx-28-ok-after-change-hook-records-revalidation-request`'s handler is this.
- **TX-45** (another system refuses). Scope: a use case called for a message asks another system
  for a change, and that system refuses it. Statement: it MUST commit the refusal as the message's
  outcome, and not fail. Stripe's disputed refund, the 3PL's unregistered sku: an outcome, not a
  message parked forever.
- **TX-46** (a polled answer). Scope: a driving adapter asks another system for what it has to
  tell this one. Statement: it MUST hand each item to a use case as a message delivered to this
  system, with the id the other system gives the item. TX-5, TX-19, TX-35 and TX-38 then hold for
  the bank's transfers; whether the bank is polled stays issue 17's.
- **DOM-8** (P19). Scope: a term of a system's glossary is used in its code. Statement: it MUST
  have the meaning its glossary gives it, in every module of the system.
- **DOM-9** (a business rule's number). Scope: a business rule of this system decides by a value.
  Statement: the value MUST come from the domain's code or from a record, not from a configuration
  value. The deadline's minutes are the domain's; a value the business changes at runtime is a
  record.
- **SVC-8** (P5, a port's terms). Scope: a system declares a driven port. Statement: what it takes
  and returns MUST be in the system's terms. A generic `Sql` port in the service layer breaches.
  SVC-7's Why loses "in the system's". "Not in the terms of what lies behind it" was in the first
  close and is withdrawn (N2).
- **ASM-11** (what a builder returns, N1). Scope: a system builder returns. Statement: what it
  returns MUST be one of: an implementation of a driving port of its system, a driving adapter of
  its system, an outbox reader of its system. A hook, a route and a scheduled task are driving
  adapters, so the review 03 builders comply and `sys-1-ok-shop-hooks-via-builder` is ok again;
  `sys-1-breach-builder-returns-repositories` breaches ASM-11. Both named from its Examples.
- **SYS-16** (MAY). Scope: a published language constrains what it takes or carries. Statement: it
  MAY state what a business rule of its system also states, as a constraint of the contract in
  its own terms. Relies on DOM-7, which it excepts.

### Sharpened

- **SVC-2**: gained "and on the state that call saves" at the first close; withdrawn after the
  regression (N4). Reload and save again is TX-23's and TX-24's.
- **TX-23**: Scope "a repository saves an aggregate"; the save MUST fail where the aggregate in the
  store differs from what the use case loaded, or exists where it loaded none. The blind upsert
  breaches.
- **TX-7**: Scope gains the schema of a record a system keeps (review 03 §2.3). The Statement's
  "as new code meant it" of the first close is withdrawn (N3); `paidByInvoice` is a new message
  taking over, the Scope's last case; a field's meaning changed in place breaches.
- **TX-12**: "from its published events delivered to a handler of this system". Reading the
  owner's outbox table breaches.
- **TX-17**: "It MUST publish one event of what happened, which names no system that handles it."
  One event per consumer breaches.
- **TX-19**: Scope: a use case is called for a delivered message, and a message written before or
  after it tells of the same thing; Statement: the records of that thing MUST end as they would
  had the messages arrived in the order they were written. Two orders racing for the last unit
  tell of two things; arrival decides, as a business rule allows (P10). "The same result" is gone.
- **TX-30**: "so that the waiting ends". **TX-35**: "so that its part of the work ends in a state
  the business rule allows". Postponing or asking again forever breaches (P17).
- **TX-37**: "deciding nothing again by the business rules of its system or by the state of its
  records beyond whether it has made it already". The claim and a record that keeps the first
  answer comply. A lapse rule in the handler does not: the deadline is the use case that holds
  the pending change, a scheduled task's (TX-30).
- **TX-38**: Scope gains "and no refusal by another system". **TX-34**: Scope "does not carry it
  out: a business rule of its system says no, or the system it asked for the change refuses".
- **DRV-7**: "unless the use case it calls has returned with what it wrote committed". The Why's
  ruling on "succeeded" moves; a committed refusal is a return (TX-34), a committed failure TX-38's.
- **ASM-3**: Scope "reads an ambient value, itself or through what it calls". The common-library
  helper that reads the request for the service is in.
- **ASM-4**: Statement gains "or a probe". Checking the closed probe gap found ASM-4 still
  shutting the courier to it, so `/health` had no way to the pool a use case uses. Guessed, open to
  overturn.
- **TX-27**: Scope: a use case decides by another system's data, from a replica or from what the
  owner answered; Statement: the decision MUST be one a business rule of its system accepts on
  data that can change at the owner before the use case commits. Checkout committing on billing's
  live dunning stage is in the Scope; the replica built for a rule to stand under is a detour.
- **DOM-1, SYS-14**: the runtime qualifier, see Pure.

### Since regression

- N1: new rule **TX-47**, after TX-1. Scope: a service opens, commits or rolls back a transaction.
  Statement: it MUST do so through a driven port of its system. The common library implements the
  port by shape, without naming it; `asm-9-ok-transaction-handed-as-argument` already shows it and
  is the ok example. `svc-6-ok-opaque-transaction` imports the common library's `Transactions` as
  the port and breaches TX-47 (issue 19). TX-1 gains a Relies-on line on TX-47; TX-1's Why already
  argued it. The Reach bullet above is corrected: ASM-7 does not admit the transaction. P5's
  Except is untouched, a port of its system being P5's main clause (R03-58).
- N2: **SVC-8**'s Statement loses "not in the terms of what lies behind it"; the Why says a
  conformist's terms are its upstream's. `asm-2-ok-shop-reads-invoice-through-driven-port` and
  `tx-12-ok-invoice-number-through-billing-port` hold.
- N3: **TX-7**'s Statement returns to "readable by old code". The clause caught every optional
  field an old reader ignores. `paidByInvoice` changes what the whole message means, which the
  Scope's "a new message takes over from another" holds for; the Why says so.
  `tx-7-ok-gift-message-added-optional` holds.
- N4: **SVC-2**'s Statement returns to "in the call that acts". The clause duplicated TX-24 as a
  MUST over replicas and over decisions that need not hold at commit, against TX-27. The Why's
  sentence refusing reload-and-save-again, a ruling, goes too.
- Fresh draft A, S4 (Reach with "Domain ... It is pure"): DOM-1 lists no port among what the
  domain reaches, so the ruling stands; no change.

### Accepted, no change

- SVC-3 behind a driven port: DVN-4 refuses the adapter that calls a service of its system; the
  example lists DVN-4 (issue 19).
- TX-24 by a snapshot: a snapshot is the aggregate's own fact (glossary); whether a value may be
  one is the business rule's (DOM-4).
- TX-22's Scope for the handler's own use case: TX-37 (issue 13). ASM-2 against DRV-3: DRV-3 is
  narrower and governs. Instrumentation before assembly: the stack document's (Assumptions), the
  telemetry ASM-7's. The admin dashboard: SYS-9 refuses the owners' tables; the page is a driving
  adapter (glossary) over three open host services, reads the courier (ASM-4), and each call
  reaches the port of the system it belongs to; issue 19 turns the gap file into an ok example.
- Trace context across the outbox: Assumptions, not covered. A request id on an outbox row: a
  record, not an answer (glossary: Idempotent, Record).
- The courier accessor: ASM-4 binds the code whose run performs the read; the accessor is the
  courier's code or the adapter's (ASM-4's Why).
- The clock and ids (regression, Noticed): the operating system is Outside; a service takes the
  time and its ids through a port of its system, whose implementation assembly may take from the
  common library, or as arguments; a driving adapter from what calls it. A ready-made
  common-library clock breaches SVC-7 and ASM-7's Scope fails for it. Issue 20's "or the common
  library" is overruled; SVC-7's Why says so.
- The external system's SDK in a hook (regression, Noticed): the package is its published
  language (Assumptions), on DRV-8's list; a call through it that reaches the external system is
  the outside and SVC-7's.
- ASM-3's and TX-15's Scopes compliant code leaves: an ok example may show the shape outside the
  Scope and say so (README, Examples).
- Test words: Double entered; the rest common language or defined inline.

### Relies on

Updated: ASM-8 on ASM-4 (the probe); TX-34 on TX-38 (no refusal by another system), with a new
line on TX-45. New lines for every new rule. Checked and holding under the changed text: TX-23's
three (narrower claim), DRV-7's eight ("succeeded" as a paraphrase of returned and committed),
TX-7's two, TX-30's two, TX-35's, TX-37's, TX-17's, SVC-2's, DOM-1's two, SYS-14's.

Guessed, not agreed, open to overturn: ASM-4 admitting the probe; TX-43 standing on
narrower-governs against TX-1 and TX-2 until issue 17 decides the store per system; twelve new
rules rather than fewer, each one ruling; the Fresh repo drafts after the glossary change deferred
to the Consequences.

## Consequences

- To issue 16: the lines of the thirteen new rules are new; TX-34's on TX-38 and TX-45, ASM-8's on
  ASM-4 rewritten here, TX-1's on TX-47 added; the lines checked above are read again there.
- To issue 17: the store per system decides whether TX-43 leans on narrower-governs; the bank
  polled or calling a hook decides whether TX-46 holds for it; Payload's Local API as catalog's
  open host service is ruled (Assumptions); the sku veto stays catalog's (issue 20).
- To issue 19: examples for the thirteen new rules; ASM-11 names two existing files, TX-47 one
  ok file and its breach is regression N1's body
  (`reviews/03/regression/15-gaps-and-loose-statements.md`); `svc-6-ok-opaque-transaction` lists
  TX-47 as breached or moves the port into shop; every example
  naming a sharpened rule is re-read (SVC-2, TX-23, TX-7, TX-12, TX-17, TX-19, TX-30, TX-35,
  TX-37, TX-38, TX-34, DRV-7, ASM-3, ASM-4, TX-27, DOM-1, SYS-14);
`gap-health-and-metrics-endpoints`   becomes ASM-4's ok,
`gap-admin-dashboard-belongs-to-no-system` SYS-9's;  
`tx-28-ok-after-change-hook-records-revalidation-request` moves `givesUpWaiting` to a scheduled  
task's use case and satisfies TX-44; `svc-3-breach-clear-cart-service-behind-driven-port` lists  
DVN-4; `drv-8-breach-mailer-subscribed-to-bus-in-assembly` and  
`tx-22-breach-claim-rolled-back-after-3pl-call` list TX-41 where TX-5 left.
- Glossary changed (Reach, Pure, System builder, Double): the regression reader and two Fresh
  repo drafts ran after the first close (`reviews/03/regression/15-*`); their findings are ruled
  in Since regression. The second close changes rules only, so the regression reader runs again
  and no Fresh draft does (`reviews/regression-reader.md`, After it runs).
- `choices.md` C6 bounded by TX-40; README's Examples entry gains the out-of-Scope ok.
