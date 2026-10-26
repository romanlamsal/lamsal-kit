# 11 — The world

**Status:** closed

## Context

`the-world.md` is new: the foundation, with the glossary. It states forces, what the world does to
a system, and properties, what holds anyway. It names no mechanism and no rule. The general rules
are one set of mechanisms that delivers the properties; another set delivering them would build a
repo alike in what holds. A repo may overrule a general rule wherever the properties still hold.
Order: `specs/01-work-order.md`, step 6.

Settled when it was opened:

- Open questions first. The session working this issue puts every open question below to the user
  before anything else, as one grill round, and records each answer under its question. Then it
  works the Problem with the answers.
- Tiers: the glossary and `the-world.md` on top, then general rules, then group rules.
  `the-world.md` uses glossary terms only.
- No link from a rule to the property it serves, for now.
- This issue edits neither the glossary nor `the-world.md`, except where an answer says so. Where
  the sweep finds either wrong, it records the finding here.

Glossary changes made while `the-world.md` was written. Each is a changed term, so lower tiers are
swept (README, Tiers):

- New: *Business domain*, *Business rule*, *Record*, *Probe*; *Outside* from the red team round
  below.
- Domain, Service, Aggregate: "rules" became "business rules". Plain "rules" means the documents'
  rules.
- Service: holds the sequence "within one use case". Orchestration: the process manager holds the
  sequence "across systems"; it is an aggregate, and each step a use case of its system.
- Open host service: offered "to other systems", no longer "to outside callers". Published
  language: what "another system" needs.
- Replica: no longer "this system's aggregate"; kept "from what the owner publishes or offers: its
  messages, or reads of its open host service", no longer only from its published messages.
- Snapshot: copied "from another aggregate or from a message".
- System builder: "the part of assembly for one system, or for what one process runs of it"; "a
  system has as many builders as there are ways it is driven" dropped.
- Port: seen from the caller, a driving port "lies behind one of the caller's driven ports"; it no
  longer "is the caller's driven port".
- System: "This document lays one out" dropped.
- Opening: "each term uses only terms defined above it" dropped; the glossary is read as a whole.

Applied already, outside the glossary and `the-world.md`:

- `general-rules.md` Assumptions: the *Record* sentence dropped; the glossary defines it.
- `TX-12`'s Why: "A replica is this system's aggregate, so reading it is no read of another
  system's data" became "A replica is filled from the owner's published messages, so reading it
  reads them."
- README: the ordering claim dropped from Documents and Tiers; Peer review added.

A red team round on `the-world.md` (README, Peer review) changed it after it was opened. The sweep
reads the rules against these too:

- Properties renumbered. New: P3, business rules that change together sit together; P14, a record
  or a message means the same to all code that reads it.
- P2 places business rules in the domain. P4: a use case responds the same. P5: ports both ways,
  each in the system's terms. P8: an uncommitted write is not yet a fact. P10: a use case commits
  only on reads that still hold; use cases fail each other only where a business rule ties them.
  P15: down or slow. P17: work spanning systems ends.
- "The model" became "a business rule" in P9, P10, P17.
- F2: the cut between systems moves. F4: a deploy replaces processes one at a time; records and
  messages outlive the code that wrote them. Scope: what a store commits survives any stop.
- "A system's records" are the records it keeps, not those its business rules decide (issue 07).
  Revised by answer 12: the records it owns (glossary: Owner); a store keeps records of several
  owners.

## Problem

- **Business rule.** `general-rules.md` uses plain "rule" for a business rule in places. Each such
  use becomes "business rule"; "the business", meaning the business domain, becomes "business
  domain".
- **Replica.** A replica is no longer an aggregate, and a repository is over exactly one
  aggregate. No rule says how a replica is stored, written and read. Every rule naming replica or
  snapshot is re-read against the entries; `TX-12`'s Why follows the wider Replica, which reads of
  the open host service also fill.
- **System builder.** Rules leaning on one builder per way a system is driven, or on a builder as
  a place apart from assembly, are re-read: a builder serves what one process runs.
- **Port, open host service.** Rules leaning on a driving port being the caller's driven port are
  re-read: under an anti-corruption layer, the caller's driven port is its own. Rules on the open
  host service are re-read for callers that are not systems.
- **Process manager.** Rules on the service's sequence or on orchestration are re-read against
  the split, within one use case and across systems, and against the process manager being an
  aggregate.
- **Probe.** The Assumptions' code "that reports on the process rather than on a system" is a
  probe; the sentence uses the term.
- **Assumptions.** `general-rules.md`'s Assumptions stay: what this rule set needs of a store is
  its own, not the world's. `the-world.md`'s Scope states only what holds for any rule set.
- **README.**
  - Documents lists `the-world.md`.
  - Tiers places it on top with the glossary, and says what a changed property visits with no
    link from rules to properties.
  - Working here 1 reads it with the glossary; spec 01's opening likewise.
  - Exceptions states the overrule condition: a repo may overrule a general rule where the
    properties of `the-world.md` still hold.
  - Exceptions also meets an overrule of `the-world.md` itself: a CLI driving the repo on
    in-memory outboxes, relay and bus, only aggregates reaching production, breaks the Scope's
    surviving commits and P8. Accepted as an overrule one tier higher; how it is stated is open.

### Open questions

Most come from a peer review: a fresh agent, given only the glossary and `the-world.md`, drafted
an architecture for the fixture's shop and listed where the two left it guessing.

1. **Unique keys.** `TX-5`'s Why relies on a second record of the same id failing. The Assumptions
   give no store that fails a write where a record with the same key exists. Lead: the
   Assumptions gain it.
   *Answer:* yes. A store that cannot fail a duplicate key satisfies the Assumptions and breaks
   `TX-5`'s means by id under concurrent redelivery.
2. **An acting use case's result.** It may return something meaningful; what it returns depends
   on the use case. The harm: the code invoking it acts on the result where the use case also
   wrote a message for that consequence, skipping relay and bus. Lead: a rule on driving
   adapters.
   *Answer:* no rule. `DRV-1` allows one acting call, `DRV-8` no client to act with; the adapter
   hands the result to its caller. A downstream system acting on it goes to issue 01.
3. **Call or message.** No rule says when a step is a call to another system and when a message.
   Lead from the draft: a step before the commit is a call whose effect stays tentative; a
   consequence of the commit is a message (`the-world.md` P8).
   *Answer:* `TX-3`, `TX-22` and `TX-12` rule it. Asking for a tentative operation, of this
   system, another system of the codebase or an external system, falls outside `TX-3`'s Scope:
   it changes nothing until confirmed or declined. Its Why says so; the Scope stands.
4. **A failed save.** `TX-23` fails a save on a changed aggregate; no rule says who reruns it,
   the transaction adapter or the caller. A rerun needs a body that can run twice.
   *Answer:* a request whose save fails fails to its caller; the rules rerun nothing. A handler's
   use case runs again on redelivery. A repo may do better; a driving adapter's answering call
   before the acting one stays rare. `TX-23`'s Why says so. No transaction port is ruled on; it
   is named, not defined (issue 07).
5. **The fake of an in-process conformist's open host service.** Who owns it (`TST-11`).
   `SVC-6` and `DVN-4` admit any export path of an upstream, its builder and fake paths included.
   *Answer:* no change. Nobody imports a marked fake into production, or builds a real system in
   a suite meant for fakes; narrowing the lists rules out nothing that happens. `TST-11` stands.
6. **The relay.** One for all outboxes or one per system, and in which process.
   *Answer:* the repo's; no rule, no line in Not covered. An outbox no relay reads is a wiring
   fault, easy to find. `TX-20` stands.
7. **Probes.** What a probe may touch: a readiness check reaches store clients past the ports.
   *Answer:* no rule. A probe sits outside the layers; code that reports on a system is no probe.
   The Assumptions use the term.
8. **Driving adapters outside the system's directory.** A framework's file router (TanStack
    Start's server functions and routes) places them in the app.
    *Answer:* no rule. A system is a bounded context, not a directory: a driving adapter is code
    of the system whose driving port it calls, wherever its file sits. Placement is the stack
    document's.
9. **Ids crossing systems.** In the shared kernel, or in each published language.
   *Answer:* in the published language of the system that issues it. A shared kernel is a model
   no one system owns (Evans: shared by agreement; Khononov: changed jointly); `OrderId` is
   shop's. The glossary's Shared kernel says so.
10. **Authorization.** Where the check sits. Lead: the driving adapter prepares the call for its
    driving port, the check included. Against: whether a caller may act on a given record, only
    the order's customer cancels it, is a business rule (`the-world.md` P2).
    *Answered in the red team round:* the per-record check is a business rule, so in the domain
    (P2); the driving adapter establishes who calls and passes it. Tell, don't ask: a downstream
    system never asks an upstream whether a user may act; it sends the command to the upstream's
    acting use case, which checks. No source names the per-record check; closest, Evans pdf 295:
    who has authority to approve, answered by the domain model.
11. **`TX-12` and `TX-7`.** Whether `TX-12` relies on `TX-7`.
    *Answer:* yes, weakly: it matters to a system reading the owner's tables, which `TX-12`
    forbids anyway.
12. **Earlier review items awaiting a ruling.**
    - `TX-3`'s "holds" back to "owns".
    - `SYS-10`'s "(SVC-1)" reworded; partly superseded, `SYS-10` relies on `SVC-1`.
    - `asm-7-breach-logger-substituted-by-module-mock` flipped to ok, its
      transaction-per-invoice loop fixed.
    - The shared kernel kept in the `SVC-6`, `DRV-8`, `DVN-4` lists.
    - To issue 07: `TX-22`'s "holds" (storage, issue 07) with the shared-Postgres store question;
      `sys-8` under `TX-22`; mail handlers relying on the provider's idempotency key.
    *Answers:*
    - Owner by business rules, not storage: under "keeps", catalog may change shop's price on
      Payload's document, and moving a table moves ownership. Glossary gains *Owner*; `TX-3`,
      `TX-22` say "owns", `TX-12` did; `the-world.md` P11 reads "the records a system owns".
      Under "owns", a replica's records are the owner's, so writing one falls under `TX-3`;
      `TX-3`'s Why places a replica written from what the owner publishes or offers outside its
      Scope, and `TX-26` has the keeping system write it, so the owner never learns who keeps a
      copy. `SVC-4`'s Scope narrows to records of an aggregate: replica, outbox and handled-id
      records belong to none; it relies on `TX-3` for the aggregate being its own system's.
    - `SYS-10`: done by issue 09; closed.
    - `asm-7-breach-…`: deleted, wrong twice.
    - Shared kernel kept in the lists.
    - `TX-22`'s "holds" settled above. Mail key: `TX-22`'s Why gains the holder that takes no
      key, a repeat the domain accepts. `sys-8` stays in issue 07.
13. **The fixture.** `domain.md` leaves open what the bank API is for (a paid order gets an
    invoice, yet unpaid invoices are dunned), who owns a product's tax class, and the SKU's
    second home in the 3PL's article master.
    *Answer:* pay-by-invoice, for its reconciliation: billing invoices those orders on
    `OrderPlaced`, dunning chases them, a bank API reports transfers billing matches. Shop owns
    the tax class beside price; billing needs it per invoice line. Fulfillment registers each new
    SKU in the 3PL's article master.

Not asked, from the red team round: the CLI overrule. Dropped: it outlined what would happen, and
the README does not reach a codebase, which gets one `layers.md` distilled from the glossary,
`the-world.md` and the rules. The overrule condition is `the-world.md`'s opening; the README does
not state it again. A reader that changes a property on purpose was weighed and left out.

## Decision

- **Glossary.** New *Owner*: the system whose business rules decide a record, wherever it is
  kept. *Aggregate* has one owner. *Shared kernel*: none owns it alone. *System builder*: what a
  system provides so a process's assembly builds what it needs without knowing its internals or
  their defaults; a system has several, each returns one thing or many.
- **`the-world.md`.** P11: the records a system owns.
- **General rules.**
  - Assumptions: a write fails where a record with the same key exists; probes sit outside the
    layers.
  - "Rule" became "business rule" where it meant one: Assumptions, `DOM-3` Scope and Why,
    `SVC-1`, `DRV-8`, `ASM-6` Statement and Why, `TX-24`, `TX-3`, `TX-12`, `TST-3` Scope and
    Why. Wording only; no Relies-on line names `DOM-3`, `ASM-6` or `TST-3`.
  - `TX-3`, `TX-22`: "owns". No Relies-on line named either before; `SVC-4` now relies on `TX-3`.
  - `TX-3`'s Why: a tentative operation and a replica written from what the owner offers fall
    outside its Scope.
  - `TX-26`, new: a replica is written by a use case of the system that keeps it.
  - `SVC-4`: records of an aggregate, through its repository. `TX-23`'s line on it follows; it
    still holds.
  - `TX-12`: relies on `TX-7`; its Why follows the wider Replica.
  - `TX-22`'s Why: a holder that takes no key. `TX-23`'s Why: who reruns.
  - `ASM-1`: builders follow what a process runs; a builder is part of assembly.
  - Port, open host service, process manager: re-read, nothing leaned on the old entries.
- **README.** Documents lists `the-world.md`; Tiers puts it on top and has a changed force or
  property read every rule; Working here 1 and spec 01's opening read it.
- **Fixture.** Pay-by-invoice and the bank API, the tax class, the 3PL's article master.

## Consequences

- To issue 01: a downstream system acting on an acting use case's result.
- To issue 07: ownership settled; the shared document under `TX-1` and `TX-23`, and `sys-8`, stay.
- To issue 08: `TX-26` has no examples; `ASM-7` has no breach example; the fixture's bank API and
  pay-by-invoice are new situations for the readers.
