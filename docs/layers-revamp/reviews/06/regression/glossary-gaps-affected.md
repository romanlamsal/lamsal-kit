# Affected set, 871bf84..088b79a

Mechanical: `affected.mjs` over glossary.md, the-world.md and property-rules.md as distilled.
Whitespace-normalized; whether a meaning changed is not judged.

## Changed rule fields, property-rules.md

`*` marks a binding field (Heading, Scope, Statement); a section is listed whole.

- P8: Statement*
- P9: Statement*
- P12: Statement*, Why
- P15: Statement*, Why
- P16: Why
- P17: Heading*, Scope*, Statement*
- No distilled field changed: P2, P4, P5, P6, P13

## Changed undistilled fields, property-rules.md (bind nobody)

- P17: Glossary notes, Terms used
- Appendix: whole

## Changed blocks, the-world.md

`*` marks Heading, Except, Against or a force. No rule names the property it serves: every rule
is read against the change (README, Tiers).

- P17: Heading*

## Changed glossary entries

- Reconciliation
- Saga
- Choreography
- Orchestration
- Idempotency key: new
- Business process: new
- Business process step: new

## Uses of changed terms, head

Scope/Statement: a use in Heading, Scope or Statement; the-world `*`: in Heading, Except, Against or a force.

### Reconciliation

- Why/Provenance only: P9 (Why), P10 (Why), P11 (Why), P15 (Why), P17 (Why)

### Saga

- Why/Provenance only: P8 (Provenance), P15 (Provenance), P17 (Provenance)
- the-world: P17 (Provenance)

### Choreography

- Scope/Statement: P17 (Scope, Why)

### Orchestration

- Scope/Statement: P17 (Scope, Why)

### Idempotency key

- Scope/Statement: P9 (Statement, Provenance)
- Why/Provenance only: P8 (Provenance), P15 (Provenance)

### Business process

- Scope/Statement: P17 (Heading, Scope, Statement)
- Why/Provenance only: P16 (Why)
- the-world: P17* (Heading)
- glossary: Business process step, Saga, Choreography, Orchestration

### Business process step

- Scope/Statement: P17 (Scope, Statement)
- glossary: Reconciliation

## Examples of review 06 hanging on the change

- none
