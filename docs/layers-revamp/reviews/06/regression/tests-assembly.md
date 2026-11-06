Base 06e705e, head a8345ae.
Changed: Assumptions' not-covered list adds how a test stands in for assembly, couriers included; P6 Why drops "a logger courier that throws while unfilled needs a default that reaches nothing".

## Targeted findings

- canary-p5-courier-2, Noticed 1 (no-op default vs "only assembly fills", asked by P6 Why): resolved. No text now asks for a default. P6 s4 is met by a test that fills the courier, and Assumptions now gives that fill to the codebase as the test standing in for assembly. Whether a library's own default is a fill stays open in P5 s3, but no rule needs one now (Noticed).

## Every rule

Rules:
- P1 affected: its Why says a courier in the common library fails Pure. A domain that reads a courier is refused before and after, whoever fills it. Holds
- P2 affected: its Why talks about doubles and the fakes a test is handed. The Statement still refuses a second statement of the rule, and a domain module is imported, never handed by assembly. A test's stand-in role hands nothing new. Holds
- P3 unaffected
- P4 affected: its Why names a logger reached through a courier as no input. The Statement has no courier in it, and observation changes neither how the use case acts nor what it answers, before and after. Holds
- P5 affected: s3 says "a courier that only assembly fills", and the new clause shares courier and assembly. Before: by the letter of s3, a test filling a courier was a second filler. The Why ("a test that fills the courier with fakes", "a test registers an in-memory one or none") and "how a driving adapter is tested" already leaned toward allowing it. After: Assumptions names the test as standing in for assembly. In deployed processes only assembly fills, before and after, and s3's per-run read is untouched. Holds
- P6 affected: the Why sentence is gone. Before: the Why read s4 as refusing a logger courier that throws while unfilled. After: no such reading. s4 itself asks only that code reached through no port runs without the outside and that its absence changes nothing. A throwing courier that the test fills locally complies before and after, and so does a no-op default. s4 still delivers world P6. Holds
- P7–P12 unaffected
- P13 affected: its Why calls tests code of the downstream, and says assembly reaches systems through builders. Builders were on the offer before and after. s1 still binds a test as code of its system, and the new clause adds no import that s1 refused. Holds
- P14–P19 unaffected

World:
- P1–P4 unaffected
- P5 affected: the Except says "the process's assembly chooses what lies behind" observation. In a test, the test standing in for assembly registers an in-memory provider or none. Before, P5's Why said the same, and production assembly's choice is unchanged. Holds
- P6 affected: the removed sentence argued for this property. P6 s4 still delivers it, because a test can fill a courier and run the use case with nothing outside. Holds
- P7–P19 unaffected

Glossary:
- Business domain, Business rule, System, Outside, Tooling, Probe, Use case, Domain, Service, Driven adapters, Driving adapters, Reach, Pure, Port, Adapter, Message, Outbox, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer, Shared kernel, Hook, External system: unaffected
- Observation affected: the removed sentence was about an observation courier. The definition is untouched, and a no-op logger and a local one both change nothing. Holds
- Aggregate, Owner, Specification, Repository, Snapshot, Replica, Record, Transaction, Store, Scheduled task, Ambient value, Factory: unaffected
- System builder affected: a test standing in for assembly calls builders as assembly does. The definition is intact. Holds
- Assembly affected: the new clause uses it. "The one place in a process" stays; a test's stand-in for it is named as the codebase's, not as a second assembly of a deployed process. Holds
- Courier affected: the new clause uses it. "How code reaches what assembly produced": in a test, that is what the stand-in produced, and the two bullets are untouched. Holds
- Configuration value, Common library, Double: unaffected
- Fake affected: what a test stands in with. The definition is intact, and P6 s1–s3 still ask for fakes, so "how" does not give "whether" to the codebase. Holds
- Integration test, End-to-end test, Default suite: unaffected ("when the integration suite runs" is unchanged)

## Builds

- Fresh A: no change. Its `apps/web/test/` driving adapter tests fill couriers with fakes (Directory tree). That was already the codebase's under "how a driving adapter is tested", and it now also falls under the new clause. Courier `get()` throws when unfilled (Assembly of `web` step 4), but those couriers carry driving ports, which no use case reaches, so P6 s4 is not reached. Its logger writes stdout and never throws, and OTel is a no-op without an SDK (P6 section). It complies before and after.
- Fresh B: no change. `read()` throws when unfilled (Common library interfaces), only builders call `fill` (P5 section), and telemetry is a no-op with no SDK (P6 section). It complies before and after.

## Newly broken

none

## Noticed

- P5 s3 still does not say whether a library's built-in default, such as the OTel no-op before registration, is a fill by someone other than assembly. P5's Why ("or none") leans toward allowing it. This predates the change.
- The glossary's Tooling ("runs in no process of the deployed application") covers tests, and Assumptions puts tooling outside the rules, yet P6 and P13 rule tests. This predates the change.
- Both builds' module-level `pino` stdout logger breaches P5 only by the Why's reading of "chosen by assembly". This was carried over from canary-p5-courier-2 and predates the change.
