# 12 — The world and the glossary after the review

**Status:** open

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
- A sentence two drafts read two ways is either a choice left open on purpose, then it says so,
  or one reading, then it says that one.

## Problem

### Designs the Red team holds against the properties

Hold in both sets:

- The distributed monolith: P15 "as far as its own data reaches" asks nothing of a system that
  keeps nothing.
- The shared schema: P11 refuses changes only; the store is Outside; a reader of another
  system's table is no downstream system.
- One system owning everything: P11, P13 and P15 to P17 hold with nothing to say; System "may
  hold several".

Hold against the raw documents only, on the heading where the Why refuses:

- Ports found from within, an ambient registry: P5 says through what, not where a reader learns
  it.
- The vendor-shaped domain: P1's Except with P12's "as much a choice".

Proposed by the Red teams, to accept, reword or refuse:

- P19: a use case needs another system now only where a business rule needs its answer now
  (both).
- P20: no system reads another's records except through its ports or what it publishes (both);
  or P5's Why sentence "Another system reading this one's records past its ports breaks whenever
  the store or the records change" lifted into its heading.
- F10 with P22: one word with two meanings is two systems (both, with doubt: P3's Provenance
  advises wide boundaries).
- P23: which ports a use case reaches is told at assembly (raw).
- P24: a conformist keeps its own business rules in its own terms (raw).

Open with them: does a Why bind; is a call a message, P14 covering records and messages and not a
call across a deploy; is a reader of records a downstream system; P7's and P15's "own", owned or
kept; P10's "a business rule accepts" refuses nothing where any business rule counts.

### Property Whys that rule

P5's sentence above; P1's "Where a store, a framework or a carrier shapes the domain, replacing
one rewrites business rules nobody meant to change". The raw Red team's shared-schema and
vendor-shaped designs fail on these sentences and hold on the headings.

### A property on tests

No force or property speaks of tests, so the distilled Adversarial could not tell what any TST
rule is for. Either a property, or the TST rules say in their Scopes what they protect (issue 13).

### Sentences the Fresh repo drafts took two ways

The drafts converged otherwise: five systems, orchestration with Order as process manager,
anti-corruption everywhere, one schema, role and pool per system, web and worker, refusals as the
receiver's events, Payload external with its versions read as an outbox, VAT in billing, Money and
Sku as a shared kernel. Raw against distilled: no difference; the property Whys were not needed.
Where they diverged, each draft had picked a reading of one of these; the pick is noted where all
agreed.

1. Store, "when their writes commit together": can or do (4 of 4, all "do").
2. Owner with P11, for records an external system keeps: who owns Payload's product records
   (4 of 4, split; two make catalog's verdict advisory, one vetoes through hooks, one has catalog
   own what Payload keeps).
3. "A command … which may refuse": how the refusal comes back (4 of 4, all the receiver's event;
   TX-34 says so, the world could).
4. Hook: an external upstream only, or any upstream (4 of 4, all "any").
5. "Each use case either acts or answers": may an acting one return its outcome (3 of 4, all yes).
6. "A repeated delivery changes nothing in this system": records only, or outside effects too
   (3 of 4, all records).
7. An external system's "configuration may hold business rules" against P2 (3 of 4, all "but
   should not").
8. Outbox reader, "marks it by": where the marks live for an external system's outbox (3 of 4).
9. Tentative operation, "changes nothing it asks for": is a hold or a reservation one (3 of 4,
   all yes).
10. Tooling against a deployed migration step (3 of 4, split).
11. "Every use case can run with nothing outside the process", P6: in tests or in production
    (2 of 4).
12. "Work waiting on another system's answer is still a state a customer finds": shown, bounded,
    or both (2 of 4).
13. P15 "its own data": replicas included (one draft, both Red teams).
14. Anti-corruption layer, "the driving adapters it calls into": which "it" (one draft).
15. P1's Except: the conformist only, or the shared kernel too (one draft).
16. Outside: a logger's or a tracer's export (one draft).
17. Process manager: the next command is the service's sequence or the aggregate's business rule
    (one draft).

Also split: synchronous calls between systems of this codebase, three drafts calling payment's
open host service for the client secret and one sending messages only; a driving adapter per
caller and port, or per way in.

### Words the rule readers hung on

- DRV-7 "succeeded": a use case that returns without committing, a refusal recorded and
  committed.
- TX-19 and Idempotent, "the same result": the final state, the business outcome, or who got the
  last unit; and whether a redelivery that throws with the state unchanged is one
  (`svc-4-ok-mark-paid-through-repository` throws, never acknowledges, the message parks).
- "Acting call" (DRV-1): not in the glossary.
- Snapshot: a value copied from an open host service's answer, the order line copying catalog's
  price, is neither a snapshot ("from another aggregate or from a message") nor a replica.
- Whether a request id on an outbox row is "what it answers" (TX-34); whether ASM-3 reaches a
  domain function the service calls. Rule words: where the glossary does not settle them, issue
  15.

### Housekeeping

- P3's heading reads awkwardly.
- `the-world.md` cites pdf pages where the rules cite printed ones.

## Decision

—

## Consequences

—
