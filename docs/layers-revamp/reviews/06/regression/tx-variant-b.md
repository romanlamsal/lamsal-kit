Base a8345ae, head 0be6e15.
Changed: P3 s2 kernel "values" becomes "value types and what computes with them"; P4 adds "the transaction its service opens is no such value"; P5 s3 courier must also "reach nothing until" assembly fills it; P8 s3 "make the change" becomes "act on the change"; P16 drops "MUST travel only as an argument, never as an ambient value", leaving the ambient case to s1; P7 Why makes an ambient transaction the codebase's; P13 Why drops the sentence about tests.

## Targeted findings

- R05-9: resolved. P8 s3 "act on the change, deciding nothing again" is met by an executor that tries the change and commits the outside's refusal, which is what P17 s4 asks for, so the two Statements no longer clash.
- R05-13: resolved. P16 no longer binds a transaction inside one system. The cross-system harm (callee code using the caller's ambient transaction) stays refused by P16 s1 when it touches the callee's records, and by P11 when it reads the caller's. Inside one system, ambient now turns on P7 s1 and on P5 s3 (see P5).
- R05-26: unchanged. "Value types" ends the clash between P3's "values" and P2's "values a rule decides by". But `vatRate(taxClass)` still "computes with them from arguments" under P3 s2, and whether it "decides what a record holds" under P3 s1 is as open as before.
- R05-28: resolved. P13 Why no longer counts tests as "Code of another system". Nothing binding does, and the glossary's Tooling and the Assumptions stand alone.
- tests-assembly Noticed (module-level `pino`): resolved. P5 s3 now says it in the Statement: a logger built at module load that writes to stdout reaches the outside without any assembly fill, so it is neither an argument chosen by assembly nor a courier that "reaches nothing until" assembly fills it.

## Every rule

Rules:
- P1 affected: its Why says a courier in the common library fails Pure, and the kernel it admits is now limited to value types. A domain reading a courier is refused before and after, and the domain reaching `Money` passes before and after. Holds
- P2 affected: s1 lets a rule sit "in a shared kernel that domain imports, with every value it decides by", and P3 s2 changed what a kernel holds. Before, a reader could take a rate table as P3's "values". After, P3 speaks of types and P2 of decision values, with no shared word. A rule about any value with its constants (rounding half-up) passes both, before and after. Holds
- P3 affected: s2 changed. Before, a kernel could hold "values", read as decision parameters too. After, it holds value types and computations with them from arguments. `Money` and `EmailAddress` pass both. A constant rate table is no longer admitted by the word itself, but a function over a kernel type still is (R05-26). The Why still says the kernel "offers the values the owners' rules decide by", which is stale but binds nobody. Holds
- P4 affected: Statement adds that the service's own transaction is no ambient value. Before, a repository adapter reading the service's transaction ambiently could be refused as an ambient value deciding how the use case acts. After, P4 does not refuse it. A transaction the caller opened, or a leaked one, is still an ambient value the service did not open, and is refused. The sentence serves P4: the service's own transaction does not vary by caller. Holds
- P5 affected: s3 adds "that reaches nothing until it does". Before, a library global with a default that reaches the outside (pino to stdout) could pass as a courier nobody but assembly fills. After, it is refused. A courier that throws or is a no-op until filled (OTel API, `get()`/`read()` throwing) passes before and after. Removing P16's ambient clause also leaves the in-system ambient transaction to P5 s3's "a client of the outside". P5's own Why ("So does a transaction") says such a transaction must come as an argument, while P7's Why says it is the codebase's choice: a split that only changes how strict the rule is, since P7 s1 holds either way. P5's Why sentence "a transaction made ambient ... P16 delivers this" is now stale. Holds
- P6 affected: s4 asks that code reached through no port run without the outside. An unfilled observation courier now reaches nothing by P5 s3, so a test that fills no courier meets s4. Before, a default that reached stdout also met s4, since writing to stdout does not fail. Holds
- P7 affected: only the Why changed, but P7 s1 now carries alone what P16 s2 also delivered inside one system. A write that finds a leaked transaction, a caller's, or none is not carried by "one transaction that its service opens", so it is refused before and after. Holds
- P8 affected: s3 changed. Before, an executor whose outside refused could not "make the change" and breached by the letter. After, it acts on the change and commits the refusal. "Deciding nothing again" is kept, the chain of holders is unchanged, and nothing that follows a commit is lost. Holds
- P9 affected: its Why leans on P8 for "deciding nothing again", which is unchanged. The repeat rules are untouched. Holds
- P10 affected: s1 asks for reads "inside the transaction that commits". A read through the service's ambient transaction is inside it, and a read through a leaked one is not, before and after. Holds
- P11 affected: it now carries the cross-system read P16 s2 also refused (callee code reading the caller's uncommitted records through an ambient transaction). s1 refuses it before and after. Holds
- P12 unaffected
- P13 affected: Why sentence removed. s1 still binds "Code of another system". Tests are tooling, and the fake is on the offer either way. A's `./fakes` limited to `test/**` complies before and after. Holds
- P14, P15 unaffected
- P16 affected: s2 drops the ambient ban. Before, any transaction made ambient breached. After, an in-system ambient transaction is not P16's. Across systems, s1 refuses a transaction that reads or writes another owner's records, whoever's code does it, and s2 refuses a call that carries one. A callee that ignores the caller's ambient context spans nothing. The world's P16 is still delivered. Holds
- P17 affected: s4 (refusal committed as outcome) no longer clashes with P8 s3. A refused executor complies with both. Holds
- P18, P19 unaffected

World:
- P1 unaffected
- P2 affected: the kernel narrowing changes where a value may sit, not that a rule is stated once. Still delivered by P2 s1. Holds
- P3 affected: still delivered by P3 s1 and s2. Holds
- P4 affected: still delivered by P4. The service's own transaction does not vary by caller or by what serves. Holds
- P5 affected: the Except ("assembly chooses what lies behind" observation) is now delivered by the Statement for library globals, not by the Why alone. Holds
- P6 affected: P6 s4 together with P5 s3 means unfilled observation reaches nothing in a test. Holds
- P7 affected: delivered by P7 s1 alone inside a system. Holds
- P8 affected: "act on" keeps "nothing lost after", and a refusal is an outcome, not a loss. Holds
- P9, P10 unaffected
- P11 affected: P11 s1 now carries the ambient cross-read. Holds
- P12–P15 unaffected
- P16 affected: delivered by P16 s1 and s2. Holds
- P17 affected: P17 s4 is now reachable without a clash with P8. Holds
- P18, P19 unaffected

Glossary:
- Business domain, Business rule, System, Tooling, Probe, Use case, Domain, Service, Driven adapters, Driving adapters, Pure, Port, Adapter, Message, Outbox, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer, Hook, External system: unaffected
- Outside affected: stdout is the operating system, so a module-level pino logger reaches the outside, and P5 s3's new clause rests on that. Holds
- Observation affected: P5 s3 now binds what observation's courier may do before it is filled. The definition is intact. Holds
- Reach affected: P5 s3 applies "reaches" to a courier. Its typed-by reach of a driving port type is "as the port", nothing outside. Holds
- Shared kernel affected: P3 s2 narrows what it holds. "A change to it is a change to each" is intact. Holds
- Aggregate, Specification, Repository, Snapshot, Replica, Record, Store, Scheduled task, Factory, System builder: unaffected
- Owner affected: P16 s1 now covers the ambient crossing by owner alone. The definition is intact. Holds
- Transaction affected: P4, P7 Why and P16 now separate the service's own transaction from a caller's or a leaked one. The definition is intact. Holds
- Ambient value affected: P4 exempts the service's own transaction. The glossary's "two scopes" do not name a per-run scope, but P4 says outright that this value is no such value. Holds
- Assembly affected: "only assembly fills" is unchanged, and "until it does" points to assembly's fill. Holds
- Courier affected: P5 s3 adds a property its bullets do not contradict (the OTel no-op global fits). Holds
- Configuration value, Double, Fake, Integration test, End-to-end test, Default suite: unaffected
- Common library affected: its module-level pino is judged in the service that runs it, and is now refused there by P5 s3. Holds

## Builds

- Fresh A:
  - Now breaches P5 s3. Services reach the module-level `pino` stdout logger of `@teashop/common` ("Code that is no system" table; P4 and P6 sections: "pino to stdout", "the logger writes stdout"). It reaches stdout with no fill by assembly.
  - Still complies with P5 s3 where it did before: its couriers (Assembly of `web` step 4, `get()` throws when unfilled) and the OTel API no-op.
  - Now complies with P8 s3 where it breached by the letter: executors that commit an outside refusal (P17 section: refused booking published as nothing shipped, `Article.refused`; mailing `refused`).
  - P16 no longer needs its `node:async_hooks` ban (P16 section). It still complies.
- Fresh B:
  - Now breaches P5 s3: `@teashop/telemetry` "pino to stdout" (Directory tree; P5 section, "Telemetry is the one direct reach").
  - Still complies with P5 s3 where it did before: `createCourier` `read()` throws when unfilled (Common library interfaces), only builders call `fill` (P5 section), and `startTelemetry` in assembly registers the OTel SDK.
  - Now complies with P8 s3 where it breached by the letter: `SubmitShipment` to `ShipmentRefused`, and `ExecuteRefund` or `AcceptRefundRequest` to `CardRefundRefused` (P17 section). S2's reading is untouched.
  - P16 no longer needs its `node:async_hooks` ban. It still complies.

## Newly broken

none. Both builds now breach P5 s3 through their pino loggers, but that is the result the tests-assembly Noticed item asked for, not a regression.

## Noticed

- P5 s3 "as an argument chosen by the process's assembly" does not say whether a transaction the service opens through an assembly-chosen port, and passes as an argument, counts as such. This predates the change, and the in-system ambient split rests on it.
- P8 s3 "such a message" still leaves held and swept messages to Fresh B's S2 reading. This predates the change.
- P6 and P13's Why still rule tests that the glossary's Tooling puts outside the rules (P6 s1's SHOULD on tests). This predates the change.
