# 12 — The world and the glossary after the review

**Status:** closed

## Context

The full review (spec 02) ran the README's Fresh repo reader four times and the Red team twice:
over `glossary.md` and `the-world.md`, and over the distilled output's Glossary and The world,
which keeps of a property its heading, Except and Against. Its rule readers hung on words the
glossary does not give. Order: `specs/02-review-findings.md`, step 3.

Settled when it was opened:

- Open questions first. The session puts every item below to the user as one grill round, with a
  recommendation each, and records each answer under its item. Then it changes the two documents
  and sweeps the lower tiers (README, Tiers): every rule read against each changed force, property
  or term; the README and `domain.md` for the terms.
- The distilled output keeps no property Why. A ruling in a Why binds nobody who reads the
  distilled: it goes into the heading, or becomes a property, or stays a reason.
- A sentence two drafts read two ways is either a choice, then a `choices.md` entry and the
  sentence stays, or one reading, then it says that one.

## Problem

### Designs the Red team holds against the properties

Hold in both sets:

- The distributed monolith: P15 "as far as its own data reaches" asks nothing of a system that
  keeps nothing.
  - *Answer:* P15 rewritten, measured by business need, not by own data. A system that owns
    nothing is no system anyway (glossary: System).
- The shared schema: P11 refuses changes only; the store is Outside; a reader of another
  system's table is no downstream system.
  - *Answer:* P11 refuses reads past the owner's published language too.
- One system owning everything: P11, P13 and P15 to P17 hold with nothing to say; System "may
  hold several".
  - *Answer:* a choice within P3 (`choices.md` C3), and P19 new.

Hold against the raw documents only, on the heading where the Why refuses:

- Ports found from within, an ambient registry: P5 says through what, not where a reader learns
  it.
  - *Answer:* P5's heading: ports assembly hands it. "Handed" stays the word assembly's
    definition gives it.
- The vendor-shaped domain: P1's Except with P12's "as much a choice".
  - *Answer:* P1's Except narrowed to a conformist's terms, its business rules its own.

Proposed by the Red teams, to accept, reword or refuse:

- P19: a use case needs another system now only where a business rule needs its answer now
  (both).
  - *Answer:* folded into P15's heading, no property of its own.
- P20: no system reads another's records except through its ports or what it publishes (both);
  or P5's Why sentence "Another system reading this one's records past its ports breaks whenever
  the store or the records change" lifted into its heading.
  - *Answer:* into P11's heading, where ownership is; the P5 sentence goes.
- F10 with P22: one word with two meanings is two systems (both, with doubt: P3's Provenance
  advises wide boundaries).
  - *Answer:* refused as a force; P19, one meaning per term within one system, which renaming
    satisfies as well as splitting.
- P23: which ports a use case reaches is told at assembly (raw).
  - *Answer:* into P5's heading.
- P24: a conformist keeps its own business rules in its own terms (raw).
  - *Answer:* into P1's Except.

Open with them: is a call a message, P14 covering records and messages and not a call across a
deploy; is a reader of records a downstream system; P7's and P15's "own", owned or
kept; P10's "a business rule accepts" refuses nothing where any business rule counts.

- *Answer, call:* no message. P14 stays; calls across a deploy are left open, and TX-7 rules on
  them beyond what the world asks.
- *Answer, reader:* a reader reads through the published language (P11), so it is a downstream.
- *Answer, own:* P7 unchanged, Owner gives a replica's records to its keeper. P15 no longer says
  "own".
- *Answer, P10:* unchanged; what is accepted is a business rule's, which P2 puts in the domain.

### Property Whys that rule

P5's sentence above; P1's "Where a store, a framework or a carrier shapes the domain, replacing
one rewrites business rules nobody meant to change". The raw Red team's shared-schema and
vendor-shaped designs fail on these sentences and hold on the headings.

- *Answer:* P5's goes to P11's heading; P1's heading says the domain is shaped by nothing that
  serves it, and the Why keeps the reason.

### A property on tests

No force or property speaks of tests, so the distilled Adversarial could not tell what any TST
rule is for. Either a property, or the TST rules say in their Scopes what they protect (issue 13).

- *Answer:* neither. The TST rules are preference and serve no force or property.

### Sentences the Fresh repo drafts took two ways

The drafts converged otherwise: five systems, orchestration with Order as process manager,
anti-corruption everywhere, one schema, role and pool per system, web and worker, refusals as the
receiver's events, Payload external with its versions read as an outbox, VAT in billing, Money and
Sku as a shared kernel. Raw against distilled: no difference; the property Whys were not needed.
Where they diverged, each draft had picked a reading of one of these; the pick is noted where all
agreed.

1. Store, "when their writes commit together": can or do (4 of 4, all "do").
   - *Answer:* can: one transaction can carry the writes of both.
2. Owner with P11, for records an external system keeps: who owns Payload's product records
   (4 of 4, split; two make catalog's verdict advisory, one vetoes through hooks, one has catalog
   own what Payload keeps).
   - *Answer:* each design holds; Owner decides by whose business rules decide. `choices.md` C4.
     DOM-7's Why was aligned with its example in `8083cd0`.
3. "A command … which may refuse": how the refusal comes back (4 of 4, all the receiver's event;
   TX-34 says so, the world could).
   - *Answer:* converged, no gap; TX-34 rules it, Message unchanged.
4. Hook: an external upstream only, or any upstream (4 of 4, all "any").
   - *Answer:* external only. Between systems of this codebase a message carries it (TX-3,
     TX-17); every rule's hook was an external system's already.
5. "Each use case either acts or answers": may an acting one return its outcome (3 of 4, all yes).
   - *Answer:* yes; Use case defines acting, answering and an acting call. A driving adapter
     translates in both directions, the return into its answer included.
6. "A repeated delivery changes nothing in this system": records only, or outside effects too
   (3 of 4, all records).
   - *Answer:* records, and the repeat succeeds where the first did (P9, Idempotent).
7. An external system's "configuration may hold business rules" against P2 (3 of 4, all "but
   should not"). Answered by spec 02 step 2: it may; a business rule written there is the external
   system's, about the records it keeps (Assumptions; DOM-7's Why).
8. Outbox reader, "marks it by": where the marks live for an external system's outbox (3 of 4).
   - *Answer:* left to the codebase, `choices.md` C5.
9. Tentative operation, "changes nothing it asks for": is a hold or a reservation one (3 of 4,
   all yes).
   - *Answer:* yes. It holds what it asks for without giving it (Helland 2007 p. 140: the
     warehouse "allocates the inventory without knowing if it will be used").
10. Tooling against a deployed migration step (3 of 4, split).
    - *Answer:* Tooling unchanged; `choices.md` C7.
11. "Every use case can run with nothing outside the process", P6: in tests or in production
    (2 of 4).
    - *Answer:* in a test, in P6's heading.
12. "Work waiting on another system's answer is still a state a customer finds": shown, bounded,
    or both (2 of 4).
    - *Answer:* bounded; P17's heading says so, its Why sentence reworded.
13. P15 "its own data": replicas included (one draft, both Red teams).
    - *Answer:* gone with P15's rewrite; its Why says replicas included.
14. Anti-corruption layer, "the driving adapters it calls into": which "it" (one draft).
    - *Answer:* the upstream.
15. P1's Except: the conformist only, or the shared kernel too (one draft).
    - *Answer:* the conformist; a shared kernel models the business domain and needs none.
16. Outside: a logger's or a tracer's export (one draft).
    - *Answer:* a third party, so Outside; the entry unchanged.
17. Process manager: the next command is the service's sequence or the aggregate's business rule
    (one draft).
    - *Answer:* the aggregate's business rule (Orchestration).

Also split: synchronous calls between systems of this codebase, three drafts calling payment's
open host service for the client secret and one sending messages only; a driving adapter per
caller and port, or per way in.

- *Answer, calls:* each holds P15; `choices.md` C6.
- *Answer, driving adapter:* per way in.

### Words the rule readers hung on

- DRV-7 "succeeded": a use case that returns without committing, a refusal recorded and
  committed.
  - *Answer:* a rule word, issue 15.
- TX-19 and Idempotent, "the same result": the final state, the business outcome, or who got the
  last unit; and whether a redelivery that throws with the state unchanged is one
  (`svc-4-ok-mark-paid-through-repository` throws, never acknowledges, the message parks).
  - *Answer:* Idempotent: the same records and the same answer, so the throwing redelivery is
    none and the example returns the paid order. TX-19's "the same result": issue 15.
- "Acting call" (DRV-1): not in the glossary.
  - *Answer:* defined under Use case.
- Snapshot: a value copied from an open host service's answer, the order line copying catalog's
  price, is neither a snapshot ("from another aggregate or from a message") nor a replica.
  - *Answer:* Snapshot names no source; it and Replica are projected into this system's terms.
- Whether a request id on an outbox row is "what it answers" (TX-34); whether ASM-3 reaches a
  domain function the service calls. Rule words: where the glossary does not settle them, issue
  15.

### A glossary sentence that rules

Service: "It holds no business rule of its own; the business rules are the domain's" is DOM-7
stated a second time and goes: a sentence stays in a definition where it tells the term from a
neighbouring term (README, Documents). Domain and Service are told apart by what each holds, Domain
the business rules, Service the sequence of a use case. Reword both so, without their lists
(README, What binds).

### Housekeeping

- P3's heading reads awkwardly.
  - *Answer:* "rules that change for different reasons stay apart".
- `the-world.md` cites pdf pages where the rules cite printed ones.
  - *Answer:* printed, from the paged sources: Khononov's printed page is the pdf page less 26,
    Evans's is the same.

## Decision

- **`the-world.md`.**
  - P1: heading, the domain is shaped by nothing that serves it; Except, an upstream's terms a
    conformist takes, its business rules its own; Why keeps the reason.
  - P3: heading reworded. P5: ports assembly hands it; the sentence on reading records leaves the
    Why. P6: in a test. P9: no record of this system changes, and a repeat succeeds where the
    first did. P11: reads only through the owner's published language. P15: a use case works
    while others are down, unless a business rule needs another system's answer now. P17: the Why
    on waiting.
  - P19, new: within one system, each term has one meaning.
  - Pages printed throughout.
- **Glossary.** Use case: acting, answering, acting call. Domain and Service by what each holds,
  without lists. Driving adapter: one way in, translating in both directions, no instances.
  Idempotent, Tentative operation, Orchestration, Anti-corruption layer, Hook, Snapshot, Replica,
  Store as answered above.
- **`choices.md`.** C3 the cut between systems, C4 the owner of what an external system keeps, C5
  the relay's marks on an external outbox, C6 calls between systems of this codebase, C7
  migrations.
- **General rules.**
  - TX-36, new: a use case MAY ask for a tentative operation by a call, apart from its outbox.
    Under the new Tentative operation a hold changes something, so TX-3's and TX-22's Scopes hold
    for the request, which their Whys had carved out; the MAY carries it. Relies on TX-3, TX-22,
    TX-30. TX-3's and TX-22's Whys lose the carve-out and name TX-36. No Relies-on line names
    TX-36 yet.
  - Read against the changed properties and terms: no other Scope or Statement changes. Hook: every
    rule's hook is an external system's. Snapshot, Replica, Store, Use case, Service and Domain:
    the rules use them as now defined.
- **Examples.** `svc-4-ok-mark-paid-through-repository`: a repeat returns the paid order, and it
  satisfies TX-5. `sys-13-ok-checkout-process-sends-receivers-commands`: the process manager's
  domain functions decide each command. `tx-22-ok-payment-requests-checkout-session` and
  `tx-3-ok-checkout-requests-checkout-session` satisfy TX-36; `tx-36-breach-payment-captured-by-call`
  new.
- **README, `domain.md`.** Read for the changed terms; nothing to change.

## Consequences

- To issue 13: TX-3 and TX-22's tentative operations settled by TX-36. ASM-7 now stands against
  P5's heading as well as SVC-7: a ready-made logger reaches the outside through no port assembly
  hands. The TST rules serve no property; their Scopes need not say one.
- To issue 15: the rule words above. P15 is delivered by no rule: TX-12 lets a use case read
  another system's open host service whether or not a business rule needs the answer now. P19 is
  delivered by no rule.
- To issue 16: TX-36's Relies-on lines are new.
- To issue 19: the admin dashboard's join (`gap-admin-dashboard-belongs-to-no-system`) breaches
  P11 now.
