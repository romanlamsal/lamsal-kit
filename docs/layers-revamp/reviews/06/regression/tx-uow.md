Base 239cc1b, head fc95cc4.
Changed: P7 s2 "MUST take that transaction as an argument" becomes "MUST be handed that transaction as an argument, to its methods or to what builds it inside the use case", and P7 Why follows ("or to what builds it"). P5 Why now sends "a transaction made ambient" to P7, not P16. P3 Why "values the owners' rules decide by" becomes "value types the owners' rules compute with". P8 and P16 are only rewrapped.

## Targeted findings

- tx-variant-a Newly broken (unit of work with tx-bound write ports): resolved. The UoW's `run` builds `makePgOrders(tx)` and `makePgOutbox(tx)` inside the use case, so `Orders` and `ShopOutbox` are handed the transaction through what builds them, and P7 s2 admits it.
- P5 Why "a transaction made ambient ... P16 delivers this": resolved. The pointer now names P7, and P7 s2 refuses a writing port that gets the transaction any way other than as an argument. The Why binds nobody.
- P3 Why "offers the values the owners' rules decide by": resolved. "Value types the owners' rules compute with" now matches P3 s2. The Why binds nobody.

## Every rule

Rules:
- P1 unaffected
- P2 affected: shares "value" with the P3 Why change. P2 s1's "every value it decides by" is unchanged, and a rate constant sits in the domain before and after; holds
- P3 affected: only the Why changed. s1 and s2 are untouched: a kernel with `Money` and `EmailAddress` complies before and after, and a rate table in the kernel is refused before and after; holds
- P4 affected: shares the property (inputs come only through driven ports). A port built inside the use case is still a driven port, and the service decides by what it returns, before and after; holds
- P5 affected: the Why pointer moved, and s3 ("a port's implementation ... as an argument chosen by the process's assembly") shares a property with P7 s2's new builder clause. Before, a UoW handing tx-bound ports breached P7 s2 whatever P5 said. After, it passes P7 s2. P5 s3 still decides it: factories that assembly hands in pass, and a builder the service imports itself is refused, before and after; holds
- P6 affected: a port built per use case needs a fake builder or a fake UoW on `FakeTx`. s1 holds it the same way before and after; holds
- P7 affected: s2 widened. Before, only method-level `tx` complied. After, a builder that is handed `tx` inside the use case also complies. A port built at assembly without `tx`, or one that reads an ambient transaction, breaches before and after. s1 ("carries every write the use case makes") still refuses a write beside the transaction, so world P7 is delivered. The Why's "where the transaction is a required parameter of each port that writes" is now narrower than s2, but binds nobody; holds
- P8 affected: s1 "in its transaction". An outbox port built with `tx` writes inside it, and the verdicts are the same; holds
- P9 affected: s1's claim "inside the transaction that commits its writes". A claim port built with `tx` is inside it, and the verdicts are the same; holds
- P10 affected: s1 reads inside the committing transaction. A reading port built with `tx` reads inside it. Reading ports are outside P7 s2 before and after; holds
- P11 unaffected
- P12 unaffected
- P13 unaffected
- P14 unaffected
- P15 unaffected
- P16 affected: the P5 Why no longer lists the ambient transaction under P16. s1–s3 are unchanged. A driving adapter that builds tx-bound repositories and hands them to a driving port breaches s3 and P7 s1, before and after; holds
- P17 unaffected
- P18 unaffected
- P19 unaffected

World:
- P1, P2 unaffected
- P3 affected: only its rule's Why changed; still delivered by P3 s1 and s2; holds
- P4 unaffected
- P5 affected: "ports assembly hands it". A builder-built port is handed by assembly when assembly chose the builder (P5 s3); holds
- P6 unaffected
- P7 affected: delivered by P7 s1, with s2 as a means; s2 is wider but s1 is unchanged; holds
- P8–P15 unaffected
- P16 affected: Why reassignment only; delivered by P16 s1–s3 as before; holds
- P17–P19 unaffected

Glossary:
- Business domain, Business rule, System, Outside, Observation, Tooling, Probe, Domain, Driving adapters, Reach, Pure, Adapter, Message, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer, Hook, External system, Aggregate, Owner, Specification, Snapshot, Replica, Record, Store, Scheduled task, Courier, Configuration value, Common library, Double, Fake, Integration test, End-to-end test, Default suite: unaffected
- Use case affected: "inside the use case" reads as during its run, the service's call into the UoW included; holds
- Service affected: it still opens and commits ("sequence within its use case"), whether ports come from methods or from a builder; holds
- Driven adapters affected: one may now be built per use case from the transaction; holds
- Port affected: a port built per use case is still an interface typed for the service; holds
- Transaction affected: P7 s2 now also hands it to builders; the definition is intact; holds
- Repository, Outbox affected: their ports may take `tx` through a builder; the definitions are intact; holds
- Shared kernel affected: P3 Why now says "value types", matching s2; holds
- Ambient value affected: P5 Why now sends the ambient transaction to P7; no binding text changed; holds
- Factory affected: "what builds it" fits a driven adapter's factory, typed by its port; holds
- System builder affected: shares "builds". A system builder runs in assembly, never inside a use case, so it cannot be read as P7's builder; holds
- Assembly affected: "where port and implementation meet". With the builder handed in by assembly and typed by its port, they meet there; holds

## Builds

- Fresh A: no change. P7 section: "every write port takes `tx` as a required first parameter", which complies before and after. P3 (kernel `Money`, `EmailAddress`) and P5 verdicts are unchanged.
- Fresh B: no change. P7 section: "with the `tx` each writing port requires as its first parameter", which complies before and after. P3 and P5 verdicts are unchanged.

## Newly broken

none

## Noticed

- tx-variant-a's example imports `makePgOrders` inside `unit-of-work.ts`. Whether P5 s1 ("an adapter ... only as such a port or as the outside it adapts") lets one driven adapter call another's factory turns on what counts as one adapter (Fresh A S6). This predates the change.
- An ambient transaction used by a reading port is refused by no Statement (P7 s2 binds writing ports only, and P10 s1 counts the read as inside), yet the P5 Why's "ambient, P7" covers writes only. This predates the change (tx-variant-a P10).
- P5 s3 "a client of the outside ... as an argument chosen by the process's assembly" still fits badly with the transaction the service opens. This predates the change (tx-variant-a Noticed).
