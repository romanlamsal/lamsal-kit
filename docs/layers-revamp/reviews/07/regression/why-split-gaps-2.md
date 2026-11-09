Base 4764eac, head d27468a.
Changed: four Statements only, sentence counts kept: P2 adds "A test MUST NOT put a double in its place"; P4's config/ambient clause adds "a value the business decides on being part of how it acts"; P8's ack clause moves from "the handler" to any driving adapter, answering a call included, joined into sentence 2; P18's writer clause bars a time as the means of telling order ("other than a time"), receiver clause untouched.

## Targeted findings

- P2 (why-split): resolved. P2 sentence 3 refuses `vi.mock` of `payment-options` in a service test; port fakes stay, Reach stops at the port.
- P4 (why-split; why-split-gaps P4 line): resolved. "a value the business decides on being part of how it acts" puts a customer-visible `from` read from a Configuration value on the refused side; residual under P4 below.
- P8 (why-split): resolved. "a driving adapter MUST NOT answer a call or acknowledge a message it handles before the use case it calls has returned with its writes committed" refuses the hook's 200 before `recordStripeNotice`.
- P18 (why-split): resolved. billing, writer of this codebase, may no longer offer `occurredAt` as the order; a version or an answer of the thing now is left.
- why-split-gaps newly broken, P18 owner-stamped time: resolved. The bar sits on the writer's clause, which an External system is not bound by (Assumptions); a receiver may still order by the 3PL's own `asOf`. A system of this codebase relaying that time must add a version or answer (Builds, Fresh A); a complying build exists (Fresh B's `SkuStock`).
- why-split-gaps newly broken, P8 Why sentence count: resolved. The clause joined sentence 2; Statement keeps four sentences, so the Why's "third" and "fourth" match again.

## Every rule

Rules:
- P1: unaffected
- P2: affected: new sentence 3 bars a double of a business rule's statement in any test; before, a service test could double a domain module and pass on the Statement alone, after it breaches; a fake of a driven port, an upstream's open host service fake included, stands in for the port (glossary Reach, Double); serves P2's property; holds
- P3: unaffected
- P4: affected: sentence 1 now counts a business-decided value as how a use case acts; before, a customer-visible sender from configuration behind the mail adapter read either way, after it breaches; a key, a URL, a pool size choosing what serves stay inside Scope's "whichever code behind its driven ports serves it"; serves P4; residual: "the business decides on" is no glossary term, and a customer-visible base URL in mail links (Fresh A `publicBaseUrl`) reads either way before and after; holds
- P5: affected: shares Configuration value; P5 rules how a value reaches code, P4 what it may change; handed in by assembly, a value still may choose what serves, before and after; holds
- P6: affected: P2's ban beside "Each driven port MUST have a fake"; before and after a use-case test runs on port fakes; "its place" read as the system's place would contradict P6 and needs ignoring Reach, so no split; holds
- P7: affected: shares "writes committed"; nothing a build may do changes; holds
- P8: affected: before, the Statement bound only the handler's ack, so a hook could answer 200 then call its use case; after, every driving adapter answers or acknowledges only after commit; a call withheld (bad signature, untranslatable type) calls no use case and is not reached; an error answer after a thrown use case is no answer "before"; handler and bus duties same; serves P8 (nothing final before commit, nothing lost after); holds
- P9: affected: Scope names hooks and repeated calls, whose answer P8 now times; a repeat commits nothing and succeeds, then answers, before and after; holds
- P10: unaffected
- P11: affected: shares "handler"; Handler unchanged, P8 still names it in the bus clause; nothing changes; holds
- P12: unaffected
- P13: unaffected
- P14: unaffected
- P15: affected: shares "answer" and a caller that waits; a use case a caller waits on, on the open call or by polling, answers after it returns, before and after; holds
- P16: unaffected
- P17: affected: neighbours P18's "a time"; a rule deciding a late payment by a deadline or `succeededAt` decides by a business time, not the writer's means of order; allowed before and after; holds
- P18: affected: before, a writer of this codebase could offer a time as the order; after, only a version, another non-time mark, or an answer of the thing now; receiver clause, external writers and the different-writers clause unchanged; serves P18; holds
- P19: affected: Scope names tests; P2's ban is no meaning of a term; holds

World:
- Scope: unaffected
- F1: affected: P4's force; holds
- F2, F3: affected: P2's forces; holds
- F4: affected: P8's force; holds
- F5: affected: P18's force; holds
- F6, F7, F8: unaffected
- F9: affected: an external writer offering only its time stays usable by a receiver; holds

Properties (headings unchanged):
- P1, P3, P5–P7, P9–P17, P19: unaffected
- P2: affected: new sentence serves it (a double is the rule copied into a test); holds
- P4: affected: new clause serves it (a value one process holds and the next does not); holds
- P8: affected: new clause serves it (an answer is final, an ack lets go); holds
- P18: affected: new clause serves it (a time is no order of writing); holds

Glossary:
- Business domain: affected: P4's "the business decides on" leans on it; no entry defines what the business decides; holds
- Business rule: affected: P2 "its place" is its statement's; holds
- System: unaffected
- Outside: unaffected
- Observation: unaffected
- Tooling: unaffected
- Probe: unaffected
- Use case: affected: P4 "how a use case acts" now holds business-decided values; P8 "the use case it calls"; holds
- Domain: affected: what P2 bars doubling; holds
- Service: unaffected
- Driven adapters: unaffected
- Driving adapters: affected: P8's subject; handler, hook, server function bound; holds
- Reach: affected: keeps P2's ban off port fakes; holds
- Pure: unaffected
- Port: affected: a fake stands in for it, not for the rule behind it; holds
- Adapter: affected: a driving adapter's translation back is the answer P8 times; holds
- Message: affected: P8 "acknowledge a message", P18 "other than a time"; its id is no time; holds
- Outbox: affected: same P8 sentence; holds
- Handler: affected: its ack duty now via "a driving adapter"; holds
- Bus: affected: same P8 sentence; holds
- Relay: unaffected
- Idempotent: unaffected
- Idempotency key: unaffected
- Tentative operation: unaffected
- Open host service: unaffected
- Published language: unaffected
- Offer: unaffected
- Reconciliation: unaffected
- Business process: unaffected
- Business process step: unaffected
- Saga: unaffected
- Choreography: unaffected
- Orchestration: unaffected
- Upstream system: unaffected
- Downstream system: unaffected
- Conformist: unaffected
- Anti-corruption layer: unaffected
- Shared kernel: affected: P2's statement may sit there, its double barred too; holds
- Hook: affected: now bound by P8's answer clause; holds
- External system: affected: P18's writer clause does not bind it (Assumptions); holds
- Aggregate: affected: its version is P18's non-time means; holds
- Owner: unaffected
- Specification: affected: a domain function P2 bars doubling; holds
- Repository: unaffected
- Snapshot: unaffected
- Replica: affected: one filled from a writer of this codebase is now ordered by version or answer, not a time; holds
- Record: unaffected
- Transaction: affected: "writes committed"; holds
- Store: unaffected
- Transaction port: unaffected
- Scheduled task: affected: a driving adapter that answers no call; holds
- Ambient value: affected: same P4 clause; holds
- Factory: unaffected
- System builder: unaffected
- Assembly: unaffected
- Courier: unaffected
- Configuration value: affected: P4 now refuses one that holds a business-decided value; holds
- Common library: unaffected
- Double: affected: P2's new sentence; holds
- Fake: affected: a double, still owed per port by P6 (Reach); holds
- Integration test: unaffected
- End-to-end test: unaffected
- Default suite: unaffected

## Builds

Fresh A:
- P18 section: `fulfillment.FreeStockReported.v1 { sku, free, asOf }` and private `StockItemReported` carry only the 3PL's `asOf`, and fulfillment answers no "stock now": fulfillment, the writer, now breaches P18's writer clause; complied before. `Stock` keeping the latest `asOf` as receiver is not itself refused. D4 (`handedOverAt <= asOf`): shop's private handover and fulfillment's report, two writers over one `Stock`, decided by shop's rule (P18 sentence 3); holds.
- Envelope `occurredAt` "never used for ordering": complies, now on the Statement.
- P2 "tests call real domain functions and never double them": complies, now required.
- P8 "Hooks answer 200 only after the use case returned", call table 400 withheld / 500 / 200 after commit: complies, now required.
- P4 and S17, senders as domain constants: complies, now on P4's Statement; `publicBaseUrl` in shop's configuration reads either way, as before.

Fresh B:
- P2 "Service tests use the real domain, never a double of it": complies, now required.
- Stripe hook "answers 200 only after it returns", 3PL hook "200 after commit": comply, now required; S17's 200 to unmapped types calls no use case, not reached; checkout route 503 after the use case threw is no answer before.
- P18 per-thing versions (`SkuStock`, `Debtor`), Payload notice-then-ask: unchanged, comply; `SkuStock` is the form Fresh A lacks.
- P4: `POSTMARK_FROM_STREAM` names the deployment to the provider, no business-decided value; holds.
- Nothing newly breaches.

## Newly broken

none

## Noticed

- P19's Why cites "the third sentence"; P19's Statement has two.
- P8's Why "the second sentence says how" (the handler deciding nothing) points at sentence 3.
- P8's Scope names no call: the new "answer a call" reaches one only where its use case writes a message or decides an uncommitted change; a server action answering before a plain write commits is outside.
- P18's receiver clause orders a relay's messages by the relay's write order, not its source's: fulfillment relaying 3PL reports in arrival order and shop keeping the 3PL's latest `asOf` part ways.
