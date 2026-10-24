# 05 — Provenance pass over the general rules

**Status:** open

## Context

Many general rules were carried over from the old document, written while its author's
understanding was partly wrong. A rule resting on a wrong assumption can stand as a MUST. Before
issue 04's decisions, every rule's Statement, within its Scope, is checked against sources outside
this repo: which source states it, which states it differently, which rules against it, and which
rules no source states.

Method:

- Sources: Sources at the end of `general-rules.md`. Khononov and Evans from the author's copies;
  the rest fetched 2026-10-23. Vernon's IDDD was not available, so citations of it are unchecked.
- Six readers, one per cluster: Khononov; Evans; hexagonal and dependency injection; messaging;
  MS and Spring Modulith; testing. Each recorded the passages that support a rule, depart from
  it or contradict it, with the source's own strength. 675 quotes, each found verbatim in its
  source text by script; the heaviest read again in context.
- The verdict per rule is the Provenance rewritten and an `*Audit:*` line, flags defined in the
  rules file's preamble. The reader files hold book quotes at length and are not in the repo.

## Problem

### Tally, 58 rules

- **No flag (11):** `SVC-1`, `DRV-6`, `ASM-1`, `TX-2`, `TX-6`, `TX-12`, `SYS-3`, `SYS-9`,
  `TST-3`, `TST-7`, `TST-8`.
- **Contested (25).** MUST or MUST NOT: `ARR-1`, `DOM-3`, `DOM-4`, `DOM-5`, `SVC-4`, `SVC-5`,
  `ASM-4` (its Why), `ASM-6` (its Why), `ASM-9`, `TX-3`, `TX-4`, `TX-7`, `TX-8`, `TX-10`,
  `TX-17`, `SYS-2`, `SYS-8`, `TST-2`, `TST-4`, `TST-5`. SHOULD or MAY: `ASM-7`, `TX-14`,
  `SYS-5`, `SYS-11`, `TST-9`.
- **Unsourced (17).** The whole ruling: `DOM-6`, `SVC-3`, `ASM-5`, `ASM-8`, `ASM-9`, `TX-11`,
  `TX-16`, `SYS-7`, `SYS-10`. A part: `DOM-1`, `DOM-3`, `SVC-2`, `DRV-1`, `DVN-2`, `ASM-3`,
  `TX-1`, `SYS-1`.
- **Stronger than the sources (8):** `DOM-4`, `DRV-1`, `TX-3`, `TX-5`, `TX-18`, `SYS-7`,
  `TST-2`, `TST-6`. **Weaker:** `TX-15`.
- **Wider than the sources' situation (4):** `ARR-1`, `DOM-1`, `SVC-4`, `DRV-3`. **Narrower:**
  `TX-13`.
- **Citation wrong before this pass (6):** `DRV-3`, `DVN-2`, `ASM-2`, `ASM-3`, `TX-4`, `TX-5`.

### Across rules

1. **One architecture for every system.** Khononov (p. 124, 134, 165), MS and Evans (p. 57) pick
   the architecture per subdomain; for simple logic a transaction script or active record reads
   and writes the store directly. `ARR-1`, `DOM-1`, `SVC-4` and `TST-3` claim any system.
   Decide: general rules for a system with a domain model, and a group file for simple ones, or
   one architecture by choice, stated as such.
2. **The published language apart from the domain.** `SYS-2` against Evans, Khononov, MS,
   NServiceBus and protobuf, the most contested rule. It carries `SYS-5`'s "translating changes
   nothing", `TX-7`'s freeze of re-used domain schemas (Evans p. 264 gives that freeze as the
   reason to keep them apart) and part of `DOM-3`.
3. **One aggregate per transaction.** `TX-14` against Vernon, Khononov, Evans, Fowler and Helland;
   MS alone backs it. It carries `TX-1`'s Scope, `TX-15`'s strength and `SVC-3`'s Why.
4. **Commands name their receiver.** `TX-17` against every messaging source for commands, and
   against the glossary's Orchestration. With the saga gap, to issue 01.
5. **The transaction as an argument.** `DOM-6`, `ASM-9` and `TX-1`'s mechanism have no source;
   MS and Spring pass the transaction by scope.
6. **Locator and ambient values.** Seemann backs injection and rules against ambient context,
   for logging too (`ASM-7`); Fowler and Evans accept a locator or global access (`SVC-5`,
   `ASM-4`). Seemann does not call the framework object's read a service locator (`ASM-4`'s Why)
   and reaches for it only where the framework has no factory seam (`DRV-3`).
7. **Tests.** `TST-2` and `TST-4` are mockist MUSTs; Google, Fowler and Vocke prefer the real
   collaborator while it is fast. `TST-5` against all three for third-party adapters; `TST-9` the
   opposite of Google.
8. **Driven ports in the domain.** `DOM-5` is sourced for repositories only.
9. **A third party through the outbox.** `TX-3` is an option for a third party in the sources, a
   synchronous call their usual alternative. Issue 04's client_secret case sits here.

### Glossary and Assumptions

Found on the way, for a glossary issue of its own:

- *Service* "holds no rule of its own": Evans p. 53 and MS agree; Martin's use cases and
  Fowler's Service Layer hold business rules.
- *Driving port* names one use case: Cockburn and Garrido group several in one port.
- *Fake* has no entry. *Integration test*: Fowler, Vocke and Spring Modulith call tests against
  doubles integration tests; Google SWE rules out the glossary's own example, a real third-party
  API.
- *Open host service*: Evans p. 263 has it pay off with many integrations only; Khononov p. 245
  counts events in the public interface. *Published language*: Evans p. 264 has it documented and
  apart from the host's model.
- *Upstream*, *Downstream*: Evans Reference p. 28 means teams and project success, not code.
- *System*: Khononov p. 41 has each bounded context its own project; Martin's entities serve
  several applications.
- *Message*: NServiceBus has replies as a third kind. *Saga*: Helland 2007 p. 140 reaches
  agreement by tentative operations. *Handler*: in Dahan's design (Vernon EAD II p. 10) the
  class handling the message is the application service.
- *System builder*: Seemann composes as late as possible (ASM-1's Provenance).
- No rule covers: optimistic concurrency (Khononov p. 87, "crucial"), acceptance or end-to-end
  tests (Fowler, Mocks Aren't Stubs: "you must combine"), an acyclic graph of systems (Spring
  Modulith, Verification).

### Next

The author reads the `*Audit:*` lines and decides per rule: keep, saying why the departure is
right; change; or retire. A change to Scope or Statement follows the README's tiers. Then the
Audit lines go and issue 04 is rechecked against the rules as they stand.

## Decision

Per rule, as the author decides; applied when the pass closes.

- `ARR-1`: retired. Split into one rule per layer naming what its code may import, receive or
  call, in `DOM-1`'s form. Service: the domain, the ports in the service layer, the common
  library, a conformed upstream's export path. Driving adapter: its system's driving port types,
  the domain, the common library. Driven adapter: what it talks to outside, the port it
  implements, the domain, the common library, an upstream's export path; `DVN-2` merges in.
- One architecture for every system (Across rules, 1): kept, stated in Assumptions as this
  document's choice. Every system gets domain, service, repository and adapters, a simple one
  too: no per-system judgment of "simple enough", no rewrite when a system grows rules. The
  Provenance of `SVC-4`, `DOM-1` and `TST-3` names the departure.
- `DOM-3`: kept as it is. Whether the published language re-exports the domain's schemas is
  `SYS-2`'s; the author leans to re-export, against duplicate schemas.
- `DOM-1`: kept as an allowlist: an unlisted kind of import fails closed, as a question. The
  slot "a port of the common library" goes with `DOM-5`. The runtime test applies the glossary's
  "pure and knows no runtime".
- `DOM-4`: split along its "or". Kept for another aggregate of the same system; the Why names
  the stale embedded record the repository writes back, not "makes the two one aggregate", and the
  Provenance names the MUST this document's strengthening of Vernon's "prefer". The half for
  another system's data is retired: what is stored of it is a copy, `TX-12` and `TX-13` place it,
  and snapshot against kept copy is the glossary item of issue 04.
- `DOM-5`: retired into `SVC-1`: a port this system declares, driving or driven, is declared in
  the service layer. Why: the domain is pure and calls no port; one home lets the allowlists be
  checked by path; the services calling a port and the adapters implementing it are then its only
  importers. Provenance: Martin (output port in the use-case circle), Garrido ("ports belong to
  the application"), Freeman §2.1; departs from Khononov, MS and Evans for repositories. A
  conformist declares no port for its upstream; it imports the upstream's.
- `DOM-6`: retired. Its restatement, a repository joins the transaction it is handed, is `TX-2`;
  a store client's type in a port's signature becomes an example of `DOM-1` and of the service
  rule.
- `SVC-2`: kept. "Make the decision" becomes "enforce it": the domain's specification decides.
  Provenance adds CWE-367 (time-of-check, time-of-use) for the stale check. The gate-against-
  argument paragraph leaves the Why; `DRV-1` keeps it.
- `SVC-3`: deferred to `TX-1` and `TX-14`. An ambient transaction stays forbidden (`ASM-9`): one
  system calling another's open host service in-process would carry its transaction into the
  other's services, one transaction spanning two systems. That argument is this document's; no
  source for it.
- `SVC-1`, the glossary's one use case per driving port: kept. Grouping buys shorter wiring and
  one fake per conversation; it costs the union of dependencies in every test, `SVC-3` breached
  by a sibling method no linter sees, and acting mixed with answering. Cockburn finds "no
  particular damage" in the number of ports; MS has one handler per command.
- `SVC-4`: kept, by the one architecture above. A port with one adapter as ceremony is `TST-2`'s
  question: the fake is the port's second implementation.
- `DRV-1`: Scope a driving adapter handles one call from its caller, a request, a message, a
  tick; Statement it MUST make at most one acting call. "At most" lets an adapter that only
  answers comply. Answering calls need no Statement: the driving adapter's rule allows calling
  services. The Why loses the answer that decides whether to act: a guard on one way in refuses
  earlier and lets nothing through, the acting service enforces (`SVC-2`). A loop over acting
  calls is an example of the breach.
- `DRV-3`: the half for an adapter assembly constructs is `ASM-2`'s, not restated. Kept for a
  driving adapter assembly cannot construct, the framework finds and calls it: it MUST read the
  services it calls from a courier. "Cannot", the glossary's word for the courier: where the
  framework offers a factory seam, assembly constructs.
- `DRV-6`: kept, the timing apart from the channel.
- `DVN-2`: retired. What a driven adapter imports is its layer's rule; what is received
  is `ASM-2`'s. What is static is imported gets a rule of its own, for every factory: Scope a
  factory needs something the same in every instance, process and test, a domain function, a
  schema, a constant; Statement it SHOULD import it; Why a parameter nobody varies hides which
  of the real dependencies a test has to supply. SHOULD: nothing breaks. Nothing a test swaps
  falls under it, so it leaves `ASM-2` alone. Provenance: Garrido §3 (only a dependency on an
  interface is configurable), Google SWE ch. 13 (a real implementation where fast and
  deterministic), Seemann's "Volatile Dependencies" (2006).
- `SVC-5`: retired. Dependencies are `ASM-2`'s; what a use case decides by is `ASM-3`'s. Fowler's
  "slight edge" for a locator moves to `ASM-2`'s Against.
- `ASM-1`: kept. A system builder takes its choices as configuration from assembly, so Seemann's
  "the earlier you compose, the more you limit your options" costs no option; the Provenance says
  so.
- `ASM-7`: kept, MAY. Scope a criterion, not a list: plumbing of the common library whose output
  changes nothing the system does or returns, a logger, a tracer; a meter falls in, a feature-flag
  client does not. Why: the line is behavior, not substitution. OpenTelemetry's JS API reads a
  global TracerProvider, and a test inspecting spans registers an in-memory exporter: substitution
  without a parameter. Telemetry missing from the signature hides nothing a caller has to supply.
  Provenance adds the OpenTelemetry JS API as supporting, its wording fetched first. Seemann's
  remedies, decorators and interception, are OOP; the harm he names is what the Why answers.
- `ASM-3`: Scope a service, or a driven adapter a service calls, reads an ambient value, in
  either scope; Statement it MUST NOT change how the use case acts or what it answers. The value
  is the subject, so a driven adapter's read is in plain sight: a repository filtering by an
  ambient tenant breaches. Stricter than "decide by": the locale a mail is rendered in and the user
  an audit column records arrive as arguments, since the outbox handler runs outside the request.
  Only telemetry stays ambient, `ASM-7`'s line. "A domain function" goes: `DOM-1` rules out the
  ambient registry. The line stays this document's.
- `ASM-4`: kept, against its earlier retirement. `ASM-2` reaches factories only, and the service
  layer's rule allows the common library, where the courier lives: without `ASM-4`, a service
  function reading the courier passes every rule. The converse of `DRV-3`, not a restatement.
  Scope code reads the courier, the glossary's definition not restated; Statement it MUST be a
  driving adapter assembly cannot construct. Why: read anywhere else, the courier is a service
  locator; Seemann's limited, well-known context then supports it, and the contested flag goes.
  "`SVC-5`'s breach" becomes `ASM-2`'s. `DRV-3`'s "the services it calls" becomes "what it calls";
  its example is a Payload hook in the static config forwarding to an adapter assembly built.
- `ASM-2`: kept, MUST. Scope a factory needs one of four things: a port's implementation, a
  store client, a third-party client, a configuration value; Statement it MUST receive it from
  its caller. The hexagonal sources hand in a port's implementation and nothing else; the clients
  and the configuration are what Garrido's composition root sets up. `ASM-7`'s telemetry is none
  of the four, so no carve-out. Provenance leads with Garrido §3 (Configurable Dependency) and
  §2.5 (the composition root), Cockburn (swappable secondary actor adapters), MS (inject
  infrastructure objects) and Khononov p. 128 (injection or bootstrapping, a departure);
  Seemann's Composition Root supports; Google SWE's "less important" in JavaScript departs.
  Against: Evans p. 108 and Reference p. 17 (global access), Fowler's "slight edge". The
  configuration value is this document's: no DDD or hexagonal source names it.
- `ASM-8`: Scope the courier, the glossary's definition not restated; Statement assembly MUST
  fill it before any driving adapter reads it. "Reads" covers a per-process courier filled at
  startup and a per-request one filled by middleware; the middleware moves to the Why. A system
  builder filling it, the Payload case, is assembly filling it. Provenance: Garrido §2.5, the
  composition root builds the system, then runs the driver adapter; the mechanism stays this
  document's.
- `ASM-9`: kept. Not `ASM-3`'s duplicate: a transaction opened on purpose changes nothing of how
  the use case acts, so `ASM-3` catches the accident only; `ASM-9` forbids the mechanism. The Why
  adds the cross-system leak: Node's `AsyncLocalStorage` store "is accessible to any asynchronous
  operations created within the callback", so shop's ambient transaction becomes billing's on an
  in-process call to its open host service; Richardson (Database per Service, "A service's
  transactions only involve its database") and Helland 2007 ("Atomic Transactions Cannot Span
  Entities") give the harm. The combination is this document's. Spring Modulith leaves the
  Provenance; MS stays as practice against. The fixture's ambient unit of work is a situation
  `ASM-9` places as a breach; its fix is `TX-1`'s.
- `ASM-5`: widened to the whole common library. Scope a common-library module imports a module;
  Statement it MUST NOT be a system's module. A denylist: what the library may import is open,
  what it must not is one thing. The relay and the bus are examples; their outbox readers and
  handlers implement the library's ports and arrive by `ASM-2`. Provenance unsourced but for MS
  ("final application blocks, like the Event Bus client API"); Khononov p. 150's relay departs.
- `ASM-6`: kept. The Why loses its last sentence, the homes of a shared shape: those are
  `SYS-2`'s and issue 04's shared kernel. The contested flag goes.
- `TX-1`: Scope a use case writes; Statement its service MUST run it in one transaction: open it,
  hand it to each repository and outbox call, commit it. One acting use case is one transaction;
  an answering one holds none. The transaction is a required parameter: a forgotten one is a type
  error, `ASM-9`'s visibility completed. Reads take it too, so a check and its write share it
  (`SVC-2`). Provenance: Evans p. 111, Fowler (Service Layer), Vernon EAD I p. 3, MS (the command
  handler commits); handing it to each call is this document's, by `ASM-9`. The Why's `ARR-1`
  and `DOM-6` become the service rule and `DOM-1`; the fixture's ambient unit of work is its
  breach example.
- `TX-10`: retired. Evans p. 111 leaves the commit to the client; with `TX-1` no repository
  method is called without a transaction. `ASM-9`'s "a write that got none is a write that opened
  its own (TX-10)" becomes "a write that got none does not compile".
- `TX-2`: Scope a repository method writes; Statement unchanged. The type checker cannot see a
  method that takes the transaction and writes through the global client.
- `SVC-3`: kept, MUST NOT. The service owns the use case's one transaction (`TX-1`) and a driving
  port carries none, so a nested call runs in a second transaction with no rollback of its own; a
  use case that follows another goes through the outbox (`TX-15`). Provenance unchanged: no
  source rules on it; MS does it in one shared transaction.
- `TX-14`: retired into `TX-1`: one acting use case runs in one transaction, which already puts
  several aggregates in it. Its Provenance moves to `TX-1`: against, Vernon EAD I p. 4, Khononov
  p. 87, Evans Reference p. 16, Fowler and Helland 2007 (one aggregate per transaction); for, MS
  and Vernon's user-aggregate affinity (EAD II p. 10, "transactional collisions").
- `TX-15`: Scope a use case writes more aggregates of this system than it relies on; Statement it
  SHOULD leave each write it does not rely on to a handler, through a message in its outbox. The
  use case relies on a write when its goal (glossary: Use case) is not reached without it:
  checkout relies on the order and the emptied cart, not on a statistic. Why: a write it does not
  rely on holds its lock until commit and its failure aborts the rest; moved to a handler, it is
  retried alone. SHOULD: nothing ends up wrong. Provenance: Vernon EAD II p. 9 (Evans's whose-job
  test, read as "relies on" by this document), MS ("less impact in database locks"); Vernon,
  Khononov p. 147, Evans Reference p. 16 and Helland make it the default beyond one aggregate,
  and the rule follows them but where the use case relies on more (`TX-1`). The weaker flag goes.
- `TX-3`: Scope a use case of this system changes data another system or a third party holds: a
  mail sent, a shipment booked; Statement unchanged. "Holds" for both: a third party is no system
  (glossary: System). "A payment created" goes: it was the open `client_secret` case. `TX-1` makes
  the call after commit visible, not safe: a crash or a failed call there loses the change and
  nobody retries; the Why names it. Provenance adds Khononov p. 144–145 ("Can we trust this code?
  No.") and Richardson (Transactional outbox: "no guarantee that it won't crash before sending the
  message"); Evans Reference p. 16 says it of aggregate boundaries, a fortiori of systems; the MUST
  for a third party is this document's, on Khononov p. 293's ground; Spring Modulith goes. A hook
  inside Payload's transaction has no after-commit and its service cannot open its own: to the
  products group file (issue 04). Rejected: "changes an aggregate outside the system": a mail is
  no aggregate, and "outside" reads as storage.
- Tentative operation, a glossary add (Between systems): "A request to another system or a third
  party for a commitment that leaves open the possibility of cancellation. It changes nothing it
  asks for: its confirmation does." From Helland 2007, without his "Every tentative operation
  eventually confirms or cancels"; one left open is reconciliation's (`SYS-7`). A request is no
  change, so neither `TX-1` nor `TX-3` binds it; a confirmation reaching this system is a driving
  call whose write `TX-1` covers, one this system sends a change under `TX-3`. No rule of its own,
  no exclusion in `TX-3`'s Scope.
- Issue 04's `client_secret` case closes: a Stripe Checkout Session requested as a tentative
  operation, payment storing nothing until the webhook; the two `tx-3-breach-*-client-secret`
  examples become `TX-3` ok examples. The customer paying after the deadline cancelled the order
  goes to issue 01's saga gap.
- `TX-12`: Scope unchanged; Statement it MUST read it from the owner's open host service or from its
  published messages. One fault, a read of the owner's store: a copy is this system's aggregate
  (issue 02), so reading it is outside the Scope, and filling it reads the owner's messages. The Why
  gains `TX-13`'s (the copy lags, `SYS-7` reconciles it) and Khononov p. 246 ("If the components
  can settle for eventually consistent data, use the event-carried state transfer message") as a
  rule of thumb, no SHOULD: Fowler finds it "usually easier just to call the sender". Provenances
  merge; departures: Richardson (Shared database), Evans p. 263, Khononov p. 209's strangler
  exception. The `findInvoices(where: SQL)` hole stays the glossary issue's (driving port).
- `TX-13`: retired into `TX-12`; its examples relabel to `TX-12`, and `DOM-4`'s "`TX-12` and
  `TX-13` place it" becomes `TX-12`.
- `TX-11`: retired. What it adds over `TX-3` is that this system's handler acts. A lambda on the
  bus is a handler (glossary: Bus) and breaches `DRV-1`, `TX-5`, `TX-8`; a relay that calls the
  third party itself is no relay (glossary: Relay), and no rule restates a definition. `TX-3`'s
  Why: "(`TX-11`)" becomes "the owner's handler, or for a third party this system's"; Khononov
  p. 149 (the handler executes the command) moves to its Provenance. The NServiceBus repeat and
  the idempotency key go to issue 01. `tx-11-ok-*` goes as a duplicate of `tx-3-ok`; the lambda
  breach relabels to `DRV-1`.
- `TX-6`: kept as it is. `TX-1` hands the transaction to calls into the store; a use case that
  publishes to the bus directly takes none and compiles, and only `TX-6` forbids it. Provenance:
  Spring Modulith goes; EIP (Event Message) departs, guaranteed delivery "usually not very helpful
  with events".
- `TX-1`: "each repository and outbox call" becomes "each call into its store": the record of a
  handled message and a read take it too, by construction, a store being what one transaction
  commits. The Why gains the consequence: a use case that writes writes one store, and a write to
  a second store goes to a handler through the outbox.
- `TX-2`: Scope a driven adapter writes to a store; Statement it MUST write inside the transaction
  it is handed. Outbox and handled-ids adapters, not only repositories.
- `TX-16`: retired. `TX-6` puts the message in the change's transaction, and a transaction is one
  store's (glossary: Store), so an outbox sits in each store whose use cases send messages. The
  Drizzle plus Payload pair stays the products group file's.
- `TX-4`: retired. Its sourced part, the outbox in the publisher's own database (Richardson,
  Khononov p. 145, MS), follows from `TX-6` and `TX-1`. Its unsourced part, port, adapter and
  reader the system's own, is what NServiceBus's framework outbox contradicts; the reader is the
  system's by the glossary (Outbox), its port the library's by `ASM-5`. The Why's "a message is
  this system's aggregate" leaned on issue 04's open question whether the outbox port is a
  repository; a schema in no domain is `ASM-6`'s. The storage sentence moves to `TX-6`'s Why,
  Richardson's outbox as a record's property and Khononov p. 146 to its Provenance.
- Idempotent, a glossary add (Between systems): "An operation is idempotent when repeating it
  leads to the same result as performing it once." Khononov p. 68; Richardson, EIP and MS agree.
- `TX-5`: Scope a use case is called for a delivered message; Statement it MUST be idempotent. The
  subject is the use case, not the handler (issue 04). Both means follow: by id (Richardson,
  NServiceBus, Helland p. 140, Khononov p. 245) and by what the message says (EIP, Helland p. 139,
  MS's preference); NServiceBus's retention window departs. The stronger flag goes. The early
  arrival moves to `TX-19`.
- `TX-19`, new: Scope `TX-5`'s; Statement it MUST reach the same result whatever order messages
  arrive in. Fixture: fulfillment's `OrderCancelled` before `OrderPlaced` leaves no reservation.
  Why: "not found" is not "already handled"; messages that override each other, two price updates,
  need something to order by from the publisher, Khononov's advice, kept in the Why; between two
  publishers the domain decides, and refunding a late payment is issue 01's saga gap. Provenance:
  Khononov p. 245 ("Events will arrive out of order"), Helland p. 138, MS (an older price event
  overwriting a newer one).
- Delivery: here, not parked in issue 01, which may revise them. `TX-20`: Scope the relay reads a
  message from an outbox; Statement it MUST hand it to the bus at least once. Khononov p. 145
  (marks "upon successful publishing") and p. 147 ("guarantees delivery of the messages at least
  once"), Richardson (Transactional outbox), NServiceBus. `TX-21`: Scope the bus delivers a message
  to a handler; Statement it MUST deliver it again until the handler acknowledges it. EIP
  (Guaranteed Delivery, Transactional Client), Vernon EAD II p. 9. `DRV-7`: Scope a handler is
  delivered a message; Statement it MUST NOT acknowledge it unless the use case it calls has
  succeeded. "Succeeded": a use case that writes nothing commits nothing; for one that writes,
  success includes the commit (`TX-1`). Why: the queue client acknowledging on receipt, a handler
  catching the use case's error and returning. Provenance: Vernon EAD II p. 9 ("The modification
  can be retried if the subscriber does not acknowledge success"), Helland p. 134, EIP
  (Transactional Client), MS (RabbitMQ requeues the unacknowledged); Khononov, Evans and Cockburn
  are silent.
- `TX-3`, split in two by who acts on the message. Scope a use case of this system changes data
  another system of this codebase holds; Statement unchanged. The owner's handler acts, so `TX-5`
  binds the owner's use case; Khononov p. 148's direct call stays a departure. The Scope's
  examples move to `TX-22`, and the Why's "or for a third party this system's" goes.
- `TX-22`, new. Scope a use case of this system changes something outside its store that no
  system of this codebase holds; Statement: The change MUST go through this system's outbox, on
  behalf of its holder. The use case that decides it writes a message instead of making it. This
  system's handler handles that message on the holder's behalf: the use case it calls makes the
  change and writes to no store of this system. "On behalf" sits in the Statement so distillation
  keeps it: the holder reads no bus. Why: the decision commits with the message (`TX-6`) and the
  call is apart from it, so a retry repeats the call and decides nothing again; a use case that
  marks the reservation and books the 3PL in one attempt redecides on redelivery, the order
  cancelled meanwhile, while the booking stands. Idempotent (`TX-5`) through the holder's
  idempotency key, the message id; a handled-ids record cannot help outside any transaction. The
  holder's answer comes back as its own message or webhook. A call designed as a tentative
  operation changes nothing (glossary) and falls outside the Scope: the way around a holder that
  answers only synchronously. An event from another system that leads to a mail takes two hops.
  Provenance: Khononov p. 148, p. 149–150 ("the command execution logic should be moved out of the
  saga itself") and p. 293 ("it can be used for sending email messages"); departs p. 150, where
  the relay executes the commands (glossary: Relay); against EIP (Command Message) and Richardson
  (Messaging), the synchronous call; Evans p. 55 and Cockburn do not rule on the timing. Where
  cases land: mail, Stripe, the 3PL under `TX-22`; billing's data under `TX-3`; this system's own
  data in its store under `TX-1`; catalog's data written through Payload in a transaction that
  commits with ours under neither, the products group file's.
- Glossary issue: Product and third party merge into External system, the term Evans (p. 114,
  p. 129, Reference p. 34) and Khononov (p. 69, p. 193) share; Khononov p. 10 bins bought and
  adopted alike. Draft: "A bounded context whose code this codebase does not write: bought or
  adopted, run by its vendor or by us. It is driven through its API and driving through its
  hooks." A bounded context is the test (Evans p. 244), so a mail provider stays infrastructure
  behind a driven port (Evans p. 55). "Third party", undefined and used 14 times in the general
  rules, and the `TX-3` entry's "a third party is no system" are revisited there.

- `TX-7`: the list goes, the principle stays. Statement: The change MUST keep messages old code
  writes readable by new code, and messages new code writes readable by old code, each field
  keeping its meaning. Scope widens: the schema of a message changes or a new message takes over
  from another, a domain schema the message re-uses included; distillation keeps the versions
  path, new code writing both while old readers run and reading the old until none waits. Why
  gains Confluent's list: an optional field added or removed keeps both directions; a field
  renamed, a required one added or removed, a type changed, an enum value added or removed, a
  meaning changed (issue 04's `amount`, cents to euros) breaks one. One deployment does not clear
  the outbox: old messages wait through it. The freeze of a re-used domain schema is stated,
  `SYS-2`'s to decide. Provenance adds Khononov p. 55 ("only possible if the modified
  implementation model can be translated into the published language the consumers are already
  using"; "simultaneously expose multiple versions") and p. 243 ("if an event's schema changes,
  the subscribers' projection logic will fail"); Confluent's new topic follows; Helland 2005 §3.4
  departs, stronger, every change a new version; Confluent's default and Evans p. 264 stay
  departures. The contested flag goes. For `SYS-2`: a zod discriminated union over a system's
  messages, the published language a standalone thing apart from the domain.
- `TX-8`: retired. One transaction per message follows from `DRV-1` (a message is one call) and
  `TX-1`; "a transaction of its own" read as the handler opening it (issue 04); apart from the
  writer's transaction cannot fail. `DRV-1`'s Why gains: a bus that delivers several messages at
  once makes one call per message. A use case over a batch, Dahan's (Vernon EAD II p. 10),
  complies: one acting call, one transaction, as `TX-1` allows several aggregates. Provenance
  moves to `TX-1`: Vernon EAD II p. 9 ("Each of the subscribers executes in a separate
  transaction"), NServiceBus and Richardson (one transaction per incoming message), Dahan as
  complying. `tx-8-*` relabel to `TX-1` and `DRV-1`.
- `TX-17`: Scope a system publishes an event; Statement its code MUST NOT name a system that
  handles it. Khononov p. 233 joins the Provenance, Spring Modulith goes. Commands to issue 01
  with the saga gap: every source names the receiver (Khononov p. 235 "the command's target", p.
  149, NServiceBus "logical owner", glossary: Orchestration), and the Why's dependency argument
  does not carry, a command living in its receiver's published language. Fowler's
  passive-aggressive command and issue 04's `ReserveStock` go along. The command rule is one
  line; open around it: the glossary item below; routing to one named receiver while the bus
  delivers to subscribers (glossary: Bus) and the relay imports no system (`ASM-5`); the sender
  importing the receiver's command (`SYS-9`); the receiver's refusal coming back (Khononov p.
  235), the saga gap.
- `TX-18`: retired. Unnarrowed it bars Khononov p. 236's notification; narrowed to a value no
  store holds it is forced: such a value reaches the handler in the message or not at all, and
  reading it ambiently is `ASM-3`'s breach. Pointer or payload is the publisher's choice, message
  by message. `tx-18-*` relabel to `ASM-3`. The fixture's request id and trace context crossing
  the bus go to issue 01, beside the relay and bus rules.
- Glossary issue: whose published language holds a command. Message's "Published: meant for
  other systems" with Published language's "its published messages" puts shop's command for
  billing in shop's; Khononov p. 235 and NServiceBus put it in the receiver's. Upstream splits
  alike: "the messages the other handles" makes the sender upstream, "the open host service the
  other calls" the receiver. Joins Upstream/downstream and Published language.

- `SYS-1`: Statement in `DOM-1`'s form: Everything it exports MUST be one of: its published
  language, its driving port types, a system builder, a fake of its driving ports. Provenance
  keeps Evans p. 263 and Khononov p. 55 and adds Garrido §2.3 ("Ports are interfaces that the
  application offers to the outside world") and Cockburn ("deployed in headless mode, so only the
  API is available, and other programs can make use of its functionality"); Spring Modulith goes,
  its SPI departure with it; MS's shared library of integration events stays a departure. The
  list is this document's, the flag says so. The fake slot is decided with `TST-9` (issue 04):
  Google SWE has the owner write the fake.
- `SYS-9`: Scope widens: code outside a system imports from it. Assembly falls under it and
  reaches a system through its builders, not its adapters. Provenance is Khononov's alone: p. 41
  ("Each bounded context should be implemented as an individual service/project, meaning it is
  implemented, evolved, and versioned independently"), a deep import tying one system's change to
  another's file layout, and intrusive coupling (coupling.dev). Spring Modulith and MS go; the
  linter sentence stays, unsourced. Flag: sourced.
- `SYS-10`: Scope a path exports a system's published language or its driving port types;
  Statement Loading it MUST load no module of the system outside its domain and its published
  language. It holds whichever way `SYS-2` decides. The port types exported as types move to the
  Why as the mechanism; builders and fakes end up on other paths. Provenance Garrido §6.2.1 ("If
  the programming language doesn't allow the hexagon to expose just the ports … split the hexagon
  into ports and implementation … ports would depend on nothing"), TypeScript's type-only exports
  the mechanism. The unsourced flag goes.
- `SYS-3`: retired. "Through a driven port" is the glossary's (Port: "Seen from the caller, this
  system's driving port is the caller's driven port"); "implemented by what assembly picks" is
  `ASM-2`'s, whose Why names upstreams; importing the upstream's service breaches `SYS-1` and
  `SYS-9`; its breach example already breaches `ASM-2`. Provenance moves to `ASM-2`: Evans p. 249
  and Khononov p. 148 as examples, Cockburn ("without actually knowing the nature of the things on
  the other side of the adapters"; adapters include "any code needed for communication between
  applications across the enterprise or net"); Modulith goes. `SVC-3`'s Why cites the glossary
  (Port), `TX-12`'s `ASM-2`. `sys-3-*` relabel to `ASM-2`.

- `SYS-2`: flips. Scope unchanged; Statement The modules that declare it MUST NOT import the
  domain. Re-export, `.pick()`, `.extend()` and a re-used domain enum all need that import, so a
  linter holds it. Why: the domain refactors without touching the contract; where a domain change
  meets the contract, the translation fails to compile; the contract changes on its own terms,
  and only then does `TX-7` ask for versions; shapes may match at first (Evans p. 278, "Keeping
  them close together will reduce translation overhead"). Provenance Evans, Khononov and MS alone:
  Evans p. 278 ("Therefore, do not equate the interchange language and the model of the host"),
  p. 264 ("it essentially becomes frozen and cannot respond to new development needs") and
  Reference p. 36; Khononov p. 55, p. 140 ("a common mistake to design and expose a published
  language for the model's objects"), p. 229 ("it can expose less data and in a more convenient
  model for consumers") and p. 244; MS ("their implementation must be different"). Departs:
  Khononov p. 207, conditional when retrofitting ("If changes in the implementation details of one
  component often ripple … consider making it an open-host service"). NServiceBus, protobuf,
  Helland and Spring Modulith go; the contested flag goes. The private-message clause goes: it
  restates the glossary (Message, Published language). For a monorepo of internal systems, where
  a change's cost is foreseeable, the author expects a repository ADR to set it aside
  (`docs/extending-layers.md`). The zod discriminated union over a system's published messages is
  an example, `sys-2-ok-shop-messages-union`, not a rule.
- Follows from `SYS-2`. `DOM-3` unchanged: `SYS-2`'s narrower Scope governs the published
  language's schemas, and `DOM-3`'s Why says so; MS's two-step validation, against `DOM-3`, now
  fits in part, a driving adapter parsing with the published language and the domain checking its
  own rule; a second statement inside the system stays `DOM-3`'s breach. `TX-7`'s Scope loses "a
  domain schema the message re-uses included", its Why the freeze sentence. `SYS-10`'s Statement,
  revising round 3f: Loading it MUST load no module of the system outside its published language.
  The service's and the driving adapter's lists (`ARR-1`'s split) gain its system's published
  language; the service translates both ways (MS, integration events "defined at the application
  level"; Khononov p. 55, "the supplier implements the translation of its internal model").
  `SYS-5`'s Why leans on `SYS-2`; there the author holds that conforming by default lets an
  upstream's change leak into the downstream.
- Open host service only. `SYS-1`'s slot becomes its open host service's driving port types, and
  `SYS-10`'s Scope with it: a driving port only this system's own driving adapters reach is no
  offer, and a downstream faking it fakes a shape nobody offers. In-process, a downstream's driven
  adapter, or a conformist's driven port, is typed by the upstream's driving port type, so the
  slot serves production as well as tests. The fake slot, if `TST-9` keeps it, fakes the open host
  service alone. Glossary issue: Published language's "its driving ports" becomes "its open host
  service's driving ports"; joins the Open host service / published language item.

## Consequences

—
