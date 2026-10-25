# 11 — The world

**Status:** open

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
2. **An acting use case's result.** It may return something meaningful; what it returns depends
   on the use case. The harm: the code invoking it acts on the result where the use case also
   wrote a message for that consequence, skipping relay and bus. Lead: a rule on driving
   adapters.
3. **Call or message.** No rule says when a step is a call to another system and when a message.
   Lead from the draft: a step before the commit is a call whose effect stays tentative; a
   consequence of the commit is a message (`the-world.md` P8).
4. **A failed save.** `TX-23` fails a save on a changed aggregate; no rule says who reruns it,
   the transaction adapter or the caller. A rerun needs a body that can run twice.
5. **The fake of an in-process conformist's open host service.** Who owns it (`TST-11`).
   `SVC-6` and `DVN-4` admit any export path of an upstream, its builder and fake paths included.
6. **The relay.** One for all outboxes or one per system, and in which process.
7. **Probes.** What a probe may touch: a readiness check reaches store clients past the ports.
8. **Driving adapters outside the system's directory.** A framework's file router (TanStack
    Start's server functions and routes) places them in the app.
9. **Ids crossing systems.** In the shared kernel, or in each published language.
10. **Authorization.** Where the check sits. Lead: the driving adapter prepares the call for its
    driving port, the check included. Against: whether a caller may act on a given record, only
    the order's customer cancels it, is a business rule (`the-world.md` P2).
    *Answered in the red team round:* the per-record check is a business rule, so in the domain
    (P2); the driving adapter establishes who calls and passes it. Tell, don't ask: a downstream
    system never asks an upstream whether a user may act; it sends the command to the upstream's
    acting use case, which checks. No source names the per-record check; closest, Evans pdf 295:
    who has authority to approve, answered by the domain model.
11. **`TX-12` and `TX-7`.** Whether `TX-12` relies on `TX-7`.
12. **Earlier review items awaiting a ruling.**
    - `TX-3`'s "holds" back to "owns".
    - `SYS-10`'s "(SVC-1)" reworded; partly superseded, `SYS-10` relies on `SVC-1`.
    - `asm-7-breach-logger-substituted-by-module-mock` flipped to ok, its
      transaction-per-invoice loop fixed.
    - The shared kernel kept in the `SVC-6`, `DRV-8`, `DVN-4` lists.
    - To issue 07: `TX-22`'s "holds" (storage, issue 07) with the shared-Postgres store question;
      `sys-8` under `TX-22`; mail handlers relying on the provider's idempotency key.
13. **The fixture.** `domain.md` leaves open what the bank API is for (a paid order gets an
    invoice, yet unpaid invoices are dunned), who owns a product's tax class, and the SKU's
    second home in the 3PL's article master.
