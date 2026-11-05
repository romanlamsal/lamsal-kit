# Affected set, 1892b7e..8ab0943

Built by hand: `affected.mjs` still reads `general-rules.md` and misses property-rules uses (and
the System entry). Built from a script over the kept fields only (Scope, Statement, Why, Provenance;
Assumptions whole); Absorbs, Drops, Glossary notes, Terms used and the Appendix are not distilled
and are left out. `the-world.md` is unchanged between base and head. `distill-properties.mjs` is
unchanged. Base's distilled is `reviews/05/distilled.md` minus its leaked P5 notes (SUMMARY);
head's is `glossary-source-check-distilled.md`.

`*` marks a use in a Scope or Statement; the rest are uses in Why or Provenance only.

## Changed rule fields

- Assumptions: wording ("service" → "services", "repository's" → "codebase's").
- P1: Statement ("Outside its domain, a module … MUST reach only a shared kernel" → "A module of the
  domain MUST reach only its domain, a shared kernel imported into it included, …"), Why.
- P2: Why (owner asks for another system's data; asked system not an owner).
- P3: Provenance.
- P4, P5, P6, P9, P11, P12, P13, P15, P16: Why.
- P7: Statement ("or several only where a business rule ties them"; "or by the call after the commit
  that P8 allows"), Why, Provenance.
- P8: Statement ("as a request to another system for a tentative operation, which the transaction
  does not carry" → "where its caller needs an external system's answer before the use case
  returns, as a call to that system after the commit, idempotent by a record the transaction
  committed, from which a later step repeats the call or ends the change"; "a record of it as
  pending" → "a provisional record of it"), Why, Provenance.
- P10: Why, Provenance.
- P17: Why, Provenance.
- P14, P18, P19: no kept field changed.

## Changed glossary entries

Meaning changed:

- Service: was "the application layer … carries out the system's use cases"; now "the
  implementation of a driving port", sequence within its use case. DDD line: services make up the
  application layer.
- Port: driving port "a service implements it".
- Tentative operation: was a request to another aggregate or another system, confirmed by the
  requester or whoever the holder takes it from; now a commitment one aggregate asks of another, in
  its system or another's, by a message; the asker holds the right to cancel; releasing confirms,
  using cancels; every one eventually confirms or cancels.
- Saga: was steps across systems undone by new steps on a later failure; now local transactions
  across systems that all commit or, when one is refused, end in new ones that undo in business terms.
- Choreography: now "work spanning systems where …" (was "each system reacts …").
- Orchestration: process manager gone; one system holds the sequence and tells the others by
  commands.
- Upstream system: per call or message; depends on its published language; two systems may each be
  upstream of the other.
- Downstream system: depends on the upstream's published language and adapts; the list of calls,
  commands, events dropped.
- Anti-corruption layer: was a downstream system translating in every adapter touching the upstream;
  now the layer in a downstream system that translates; the upstream's terms stop at it.
- Shared kernel: now "a part of the domain model" several systems share; belongs to each.
- Repository: was a driven port over exactly one aggregate; now access to the aggregates of one
  type, loads, saves, finds them whole; repository port (driven port) and repository adapter
  (driven adapter).
- Transaction: "a set of writes" → "a group of reads and writes".
- Store: was what lies behind driven ports whose writes commit in one transaction; now what keeps
  records such that one transaction can carry writes to any of them.
- Factory: returns the implementation typed by its port.

Wording only:

- System: "code repository" / "repository" → "codebase".

Removed term: process manager (was inside Orchestration). Still used in P17 Provenance and
the-world P8 Provenance (Khononov's term, quoted).

## Uses of changed terms, head

- Service: Assumptions, P1, P2, P4*, P5*, P6*, P7*, P10, P11*, P12, P13*, P14*, P15, P16, the-world.
- Driving port: P4*, P5, P6, P9, P13, P14*, P16*.
- Tentative operation: P7 (Why: "the first asks it for a tentative operation and later confirms or
  cancels it" for another system, P8 and P15 deliver how it is asked; Provenance Helland p. 140),
  P17* (Scope "a tentative operation included"; Statement "a tentative operation it took or asked
  for"), the-world P8 Why ("what is asked of another system, or of this one, before the commit stays
  tentative") and Provenance.
- Saga: P8, P15, P17 Provenance; the-world P8 Provenance.
- Choreography, Orchestration: P17* (Scope).
- Upstream system: P1*, P12*, P13*; Why: P2, P3, P5, P6, P14, P15, P16, P19; the-world.
- Downstream system: P13* (Scope); Why: P1, P4, P6, P9, P12, P14, P16; the-world.
- Anti-corruption layer: P6, P12, P19 (Why/Provenance only).
- Shared kernel: P1*, P2*, P3*, P12*, P13*; Why: P4, P5, P6, P11, P16, P19.
- Repository: Why/Provenance only: P4, P5, P7, P10, P11, P13, P16, P17, P19; glossary Aggregate.
- Transaction: Assumptions, P7*, P8*, P9*, P10*, P16*; Why: P4, P5, P6, P11, P15, P18; P17
  Provenance; the-world; glossary Saga, Store.
- Store: Assumptions, P9*, P10*, P16*; Why: P1, P2, P4, P5, P6, P7, P8, P11, P13, P14, P15, P17,
  P19; the-world; glossary Port, Owner, Record.
- Factory: P5 (Why).
- System / codebase: every rule; wording change only, listed for completeness.

## Review 05 findings hanging on the changes

The fixture examples of review 05 live in `dist-implementer.md`, `dist-fresh-a.md`,
`dist-fresh-b.md` (no `examples/` file names a property rule). Those whose rule's kept fields
changed or that hang on a changed term:

- `p2-breach-sku-veto-asks-shop` (P2 Why, P3; Owner).
- `p7-breach-gapless-invoice-number`, `p7-breach-multi-sku-reservation`,
  `p7-breach-cart-cleared-with-order` (P7 Statement).
- `p17-breach-intent-before-payment-record` (P8 Statement, P17, Tentative operation).
- `p7-ok-shop-write-scope` (P7, Transaction), `p16-ok-common-transaction-runner-by-shape` (P16,
  Transaction, Store), `p3-ok-shared-kernel-values-only` (P1, P3, Shared kernel),
  `p12-ok-payment-stripe-acl` (P12, Anti-corruption layer), `p6-ok-fakes-for-external-systems`
  (P6, Service), `p5-ok-fulfillment-worker-assembly` (P5, Factory).
- Impl "The checkout saga" section (Saga, Orchestration, Tentative operation, P8, P17).

Earlier partial run over the same base: `p7-ties-p2-owner.md` (P2, P7, P10 only; glossary
unchanged then).
