# Review 04, findings as a checklist

Three readers over the property-rules distilled set: `dist-implementer.md`, `dist-fresh-a.md`,
`dist-fresh-b.md`. One line each, stable id. The regression reader marks each after a change:
`resolved`, `unchanged`, `newly broken`, `out of scope`.

## Tensions

- R04-1 Impl T1: P4 s2 refuses the outbox adapter writing ambient trace context; P4 Why allows it
  (`p4-tension-trace-context-on-envelope`; Fresh B S4, S5).
- R04-2 Impl T2: P4 s3 × P10 s3, clock-started batch work; fan-out forced, stale candidate rule
  required (`p4-tension-batch-on-the-clock`; Fresh A D22, Fresh B D18).
- R04-3 Impl T3: P18 fallback waits on catalog against P15; a configured revision in Payload's
  store, trigger against P2 Why (`p18-tension-external-writer-without-version`).
- R04-4 Impl T4: P10 s2 × P15 Why, every live read needs a staleness rule and every such rule
  sends it to a replica (`p10-tension-live-answer-vs-replica`; was R03-35).

## Statement and Why disagree

- R04-5 P4 s2 as R04-1.
- R04-6 P5 Why numbers sentences in the old Statement's order.
- R04-7 P7 "hands to each call that writes" against the Why's indifference to argument or ambient.
- R04-8 P8 Why's SHOULD for the external outbox, no SHOULD in the Statement.

## Purpose not told

- R04-9 P4 s2 configuration "in nothing it writes" (mail sender, `return_url` base).
- R04-10 P9 s3 business rule for repeats with no business meaning (revalidation, metrics).
- R04-11 P17 s2 deadline for a wait whose ending changes nothing (invoice orders).

## The split

- R04-12 Product owner: P11 Why (editors change it in the admin, external owns) against P2 Why
  (catalog's veto, rule in catalog's domain); Fresh A catalog system, Fresh B and Impl Payload
  (A S1, B S1, B S2, Impl N3, N4, S4, S5). C4.

## Readings three of three took

- R04-13 P12 "record each upstream it conforms to" read as record every upstream with its choice.
- R04-14 P4 "one acting call per call it handles": each polled item a call handled.
- R04-15 P6 "set up as it is there": vendor test mode or sandbox.
- R04-16 P17 "an aggregate of its own": a deadline field on the waiting system's own aggregate.
- R04-17 P9 "return as the first delivery returned": the first result stored and replayed.
- R04-18 P1 "every runtime of the language": standard library only, `lib: ES2023`, `types: []`.
- R04-19 P13 "typed by its published language": by type, offer fakes on real services pass.

## Readings that split or hung

- R04-20 Glossary Store "can carry": one store per role (Fresh A S3; was R03-49).
- R04-21 P8 "beside the transaction": inside the open transaction carrying none (Fresh B) or before
  opening it (Impl S13, Fresh A).
- R04-22 P2 "the same for every candidate": a dated VAT table (Fresh B S18, Fresh A S9).
- R04-23 P15 s1 for a read a rule needs now, not only a change (Fresh A S8).
- R04-24 P18 "overrides": transitions versus state (Impl S17, Fresh B S17).
- R04-25 Assumptions "It is no system of this codebase where a rule says one" (Fresh B S13).
- R04-26 Glossary Hook: Payload's `afterChange` writing Payload's outbox is no hook (Fresh B S12).
- R04-27 P11 s2 for Payload: configured outbox messages as Payload's published language (B S11,
  Impl S10).
- R04-28 P14 Scope "called from another process": a browser counts (Fresh B S16).
- R04-29 P5 s1 "either also through code of the common library" misparsed at first (Impl N25).
- R04-30 Glossary Courier: where it lives, who imports it (Impl N20).

## Hygiene

- R04-31 54 old ids cited in Whys and Assumptions, undefined in the set (Impl N1); Assumptions
  define external configuration's reach only by "(SYS-12)", "(TX-29)", "(SYS-9)".
- R04-32 Absent documents referenced: general-rules, the quarry, Review 02, `components.md`, the
  stack document, the Appendix (Impl N2); Conventions "ids are theirs" (N24).
- R04-33 Transaction undefined in the glossary.

## Fixture

- R04-34 Ambient unit of work, hooks calling shop's services, Local API read, `beforeChange` asks
  shop: read as situations and built otherwise by 3 of 3 (Impl N6, N7, N8).
- R04-35 `PaymentFailed` terminal or not (Impl N15; was R03-32).
- R04-36 "Open order" undefined (Impl N23; was R03-31).
- R04-37 Credit note for an order never invoiced (Impl N17; was R03-48).
- R04-38 3PL idempotency key and sandbox (Impl N11).
- R04-39 Dashboard: `backoffice` system (Impl, N22) versus per-system pages (both Fresh).
- R04-40 Fulfillment "in its own worker process": does any fulfillment code load in web (Impl N9).

## Choices

- R04-41 C2 choreography, C8 PaymentIntent before the commit, C9 payments its own system: 3 of 3
  each where the entry says they may differ.
- R04-42 C4 split two to one, Whys contradict (R04-12).
- R04-43 Stock at checkout: no synchronous hold in any draft (03: 4 of 4 held); fulfillment
  reserves on `OrderPlaced`.
