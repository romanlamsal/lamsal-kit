Base fc95cc4, head 7543822.
Changed: glossary gains **Transaction port** (driven port a service opens a transaction on one store through; returns it, typed in the system's terms); P5 s3 lets a port's implementation, a client of the outside, a configuration value or observation also reach code "returned by a port so chosen", i.e. by a port the process's assembly chose.

## Targeted findings

- tx-uow / tx-variant-a / tx-variant-b Noticed (P5 s3 vs the transaction the service opens): resolved. P5 s3 now admits what an assembly-chosen port returns, so the transaction a Transaction port returns, and repositories a builder port returns (P7 s2 "what builds it"), comply plainly, not only on the generous reading. Residue: both builds' `run(work)` hand the transaction to a callback, not as a return value. "Returned" covers that on the natural reading, and the verdict is the same either way.
- R05-31 ("transaction port" not in the glossary): resolved for this term. **Transaction port** is now an entry, and P6 Why's "a transaction port whose fake commits nothing" fits it. The other R05-31 words (*part*, *claim*, *envelope* ...) are unchanged.

## Every rule

Rules:
- P1 unaffected
- P2 affected: a configuration value may now reach code returned by a port. P2 s1 still refuses one a business rule decides by, however it arrives ("no record holds"), before and after; holds
- P3 unaffected
- P4 affected: s1 decides by "what its driven ports return", and a port may now return a configuration value or the transaction. A configuration value still MUST NOT change acts or answers; the transaction is the same for every caller and decides nothing. Same verdicts; holds
- P5 affected: s3 widened. Before, a value handed on by an assembly-chosen port (transaction, builder-built repositories, a port that returns other ports) complied only on the generous reading (tx-uow P5). After, it complies plainly, so only strict-reading verdicts flip. Still refused: a module-level instance or client built in place (no port returns it), a service reading a courier, and a returned implementation of an outside the returning adapter does not adapt (s1 via Reach, "and what those reach in turn"). The new clause serves P5's own property, so it is not misplaced. The Why's "admits one chooser" is now narrower than s3, but binds nobody; holds
- P6 affected: the Why uses the new term. s1 needs a fake for every driven port, the Transaction port included, as before (P5 Why already called it "a driven port of its own"). Both builds' copy-on-commit fakes comply before and after; holds
- P7 affected: s1 "one transaction that its service opens" now matches the glossary's port. s2's builder variant now also passes P5 s3 plainly, not only generously. The Transaction port writes no record itself, so s2's "each driven port that writes" does not reach it, before and after; holds
- P8 affected: s1 "in its transaction". The outbox write is in the transaction the port returns; same verdicts; holds
- P9 affected: s1 claims "inside the transaction that commits its writes"; same verdicts; holds
- P10 affected: s1 reads inside the committing transaction; s2 "transaction of this store" matches "on one store"; same verdicts; holds
- P11 affected: a port so chosen could return another system's repository. P11 s1 refuses that read or write whatever handed it over, before and after; holds
- P12 unaffected
- P13 unaffected
- P14 unaffected
- P15 unaffected
- P16 affected: s3 bans a driving port that *takes* a transaction, and P5 s3 now admits one *returned* by a port so chosen, an upstream's open host port included. Before, strict P5 s3 also refused it. After, P16 s1 (one owner's records) and s2 (no call carries it), plus P11 s1, still refuse every use that spans systems; holds
- P17 unaffected
- P18 unaffected
- P19 unaffected

World:
- P1–P3 unaffected
- P4 affected: still delivered by P4 s1 for values a port returns; holds
- P5 affected: "only through ports assembly hands it" now includes what an assembly-handed port returns. Assembly still picks what lies behind it: the returning port is assembly's choice, s1 keeps what it returns in the system's terms, and Reach stops an adapter from returning another outside's implementation; holds
- P6 affected: the Transaction port's fake comes from P6 s1; holds
- P7 affected: delivered by P7 s1, and P5 s3 no longer strains against it; holds
- P8–P15 unaffected
- P16 affected: a transaction returned across systems is still refused by P16 s1, s2 and P11 s1; holds
- P17–P19 unaffected

Glossary:
- Business domain, Business rule, System, Outside, Tooling, Probe, Use case, Domain, Driving adapters, Pure, Adapter, Message, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer, Shared kernel, Hook, External system, Aggregate, Owner, Specification, Snapshot, Replica, Record, Scheduled task, Ambient value, System builder, Common library, Double, Integration test, End-to-end test, Default suite: unaffected
- Transaction port affected (new): it fits P5 Why ("opens, commits and rolls back through a driven port of its own"), P6 Why and P7 s1. "It returns the transaction" does not literally describe both builds' `run(work)`, which hands it to a callback, but no Scope or Statement uses the term, so no verdict hangs on it; holds
- Transaction affected: the definition is intact, and the port now names how the service opens one; holds
- Store affected: "on one store" restates that a transaction is one store's; holds
- Service affected: it opens through the port, the sequence still its own; holds
- Driven adapters affected: they implement the Transaction port as before; holds
- Port affected: the Transaction port is an interface and a way out; holds
- Reach affected: "however the code got hold of it" already counts values a port returns; holds
- Repository, Outbox affected: their ports get the returned transaction, or are returned by a builder port; definitions intact; holds
- Factory affected: a builder port's implementation returns implementations typed by their ports; holds
- Assembly affected: "only place where port and implementation meet". P5 s3 now admits implementations a port returns. They meet in assembly where assembly chose the builder or its factories. The UoW adapter that imports another adapter's factory itself rides on the earlier S6 split (Noticed); holds
- Courier affected: a value a port returns is no courier, since assembly handed the port as an argument; the courier's conditions still bind couriers; holds
- Configuration value, Observation affected: either may now come back from a port so chosen; P4 s1 and P6 s4 still bind them; holds
- Fake affected: the Transaction port's fake is a fake by definition; holds

## Builds

- Fresh A: no change. `Transactions<Tx>.run(work)` (Ports and adapters, conventions; D8), built by `makePgTransactions(db)` in the system builder, hands `tx` to the service's callback. That complies with P5 s3's new clause on the natural reading and complied on the generous one before. Its module-level `pino` (P4, P6 sections) is still refused by P5 s3, since no port returns it.
- Fresh B: no change. `Transactions<Tx>.run(work)` (conventions; D10) is implemented by `@teashop/pg` `createPgTransactions`, handed in by the builder (Common library interfaces; S13), and complies as above. `@teashop/telemetry` pino to stdout (P5 section) is still refused.

## Newly broken

none

## Noticed

- Whether a UoW adapter may import another adapter's factory (tx-variant-a's `makePgOrders`) still turns on P5 s1's adapter boundary (Fresh A S6), and glossary Assembly's "only place where port and implementation meet" now rests on that alone. This predates the change (tx-uow Noticed).
- An ambient transaction used by a reading port is still refused by no Statement (P7 s2 binds writing ports only). This predates the change (tx-uow Noticed).
- P6 Why's fake that "commits nothing" still leaves rollback open (r05-reconcile). This predates the change.
