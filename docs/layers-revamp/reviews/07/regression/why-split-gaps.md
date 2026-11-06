Base 6745deb, head 7b1c4ac.
Changed: P2 Statement bans a test's double of a business rule's statement; P8 Statement moves "not before commit" from the handler's ack to every driving adapter, answering a call included; P18 Statement also bars telling write order from a time a message carries; P4 Why loses the customer-visible-sender sentences; P8 Why stops calling a hook a handler.

## Targeted findings

- P2: resolved. "A test MUST NOT put a double in its place" refuses `vi.mock` of domain `payment-options` on the Statement alone.
- P4: unchanged. P4's Statement did not change; the Why sentence that put a configured sender on the refused side is struck, and P2's "every value it decides by" does not plainly reach a sender no rule decides by, so a customer-visible `from` as a Configuration value still reads both ways, now with no Why to settle it.
- P8: resolved. A hook is a driving adapter; "MUST NOT answer a call ... before the use case it calls has returned with its writes committed" refuses the 200 before `recordStripeNotice`.
- P18: resolved. "or from a time they carry" refuses keeping the later `occurredAt`; the same words also refuse a time the owner stamps (P18 below, Newly broken).

## Every rule

Rules:
- P1: unaffected
- P2: affected: new sentence bars a test's double of the rule's statement; before, a service test could `vi.mock` a domain module and pass the Statement, after it breaches; port fakes stay (Reach stops at the port); holds
- P3: unaffected
- P4: affected: Why lost the sender sentences, Statement unchanged; config `from` read either way before (Statement) and still does, now with no Why; "call or message it handles" matches P8's new sentence, a withheld call answers with no use case; holds
- P5: unaffected
- P6: affected: P2's ban beside "Each driven port MUST have a fake" and "A fake SHOULD run none of the code it stands in for"; before and after a use-case test runs on port fakes, an upstream's scenario fake (`createFakeOpenCardPayment`) included, since a fake stands in for the port, not the statement behind it (glossary Reach, Double); holds
- P7: affected: shares "writes committed" with P8's sentence; nothing a build may do changes; holds
- P8: affected: commit-before-answer now binds every driving adapter, calls as well as messages; before a hook could answer 200 then call its use case (Statement named only the handler's ack), after it breaches; handler's ack same in substance; a withheld call (bad signature, untranslatable type) calls no use case and is not reached; an error answer after a thrown use case is no answer "before"; holds; distilled output broken: Why's sentence numbers (Newly broken)
- P9: affected: Scope names hooks and repeated calls, whose answer P8 now times; before and after a repeat answers after its use case commits nothing and succeeds; holds
- P10: unaffected
- P11: affected: P8's Why no longer calls a hook a handler, P11's Statement reads an external owner's events "delivered to a handler"; binding text and glossary unchanged; holds (Noticed)
- P12: unaffected
- P13: unaffected
- P14: unaffected
- P15: affected: shares "answer"; P15's is another system answering, P8's the adapter answering its caller; a use case a caller waits on answers after it returns, before and after; holds
- P16: unaffected
- P17: affected: neighbours P18's new clause; a rule deciding a late payment by `succeededAt` against the order's deadline decides by a business time, not by write order of messages about one thing; allowed before and after; holds
- P18: affected: "a time they carry" bars every carried time, the owner's own included; before a receiver could keep the report with the later 3PL `asOf` (owner-stamped, order-independent outcome), after it breaches; where an external owner offers only its time, no version and no current-state answer, no means remains (writer clause cannot bind it, F9); broken
- P19: unaffected

World:
- Scope: unaffected
- F1, F2, F3: unaffected
- F4: affected: P8's force; holds
- F5: affected: P18's force; holds
- F6, F7, F8: unaffected
- F9: affected: an external offering only its time now leaves P18 no means; force text unchanged; holds (break is P18's)

Properties (headings unchanged):
- P1, P3, P5, P6, P7, P9–P17, P19: unaffected
- P2: affected: new sentence serves it (a double is the rule copied into a test); holds
- P4: affected: Why only; holds
- P8: affected: new sentence serves it (an answer is final); holds
- P18: affected: new clause serves it; holds; the rule now refuses a build that delivers it (P18 rule)

Glossary:
- Business domain: unaffected
- Business rule: affected: P2's "its place" is its statement's; holds
- System: unaffected
- Outside: unaffected
- Observation: unaffected
- Tooling: unaffected
- Probe: unaffected
- Use case: affected: P8 "the use case it calls"; holds
- Domain: affected: what P2 bars doubling; holds
- Service: unaffected
- Driven adapters: unaffected
- Driving adapters: affected: P8's new subject; handler, hook bound; scheduled task answers no call; holds
- Reach: affected: keeps P2's ban off port fakes; holds
- Pure: unaffected
- Port: affected: fake stands in for it, not the rule behind it; holds
- Adapter: affected: as Driving adapters; holds
- Message: affected: P8 "acknowledge a message", P18 "a time they carry"; its id is no time; holds
- Outbox: unaffected
- Handler: affected: P8 Statement no longer names it; its ack duty passes through "driving adapter"; holds
- Bus: affected: P8 sentence 2 unchanged beside the new one; holds
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
- Shared kernel: affected: P2's statement may sit there, so its double is barred too; holds
- Hook: affected: now bound by P8's Statement; holds
- External system: affected: its time under P18's clause; definition unchanged; holds
- Aggregate: unaffected
- Owner: affected: P18 bars ordering by the owner's stamped time; holds
- Specification: affected: a domain function P2 bars doubling; holds
- Repository: unaffected
- Snapshot: unaffected
- Replica: affected: a replica keeping the latest by time now breaches P18; definition unchanged; holds
- Record: unaffected
- Transaction: affected: "writes committed"; holds
- Store: unaffected
- Transaction port: unaffected
- Scheduled task: affected: a driving adapter that answers no call; holds
- Ambient value: unaffected
- Factory: unaffected
- System builder: unaffected
- Assembly: unaffected
- Courier: unaffected
- Configuration value: affected: P4 Why no longer places a customer-visible sender; binding unchanged; holds
- Common library: unaffected
- Double: affected: P2's new sentence; holds
- Fake: affected: "a fake is one that works", a double; P6's MUST stands by Reach; holds
- Integration test: unaffected
- End-to-end test: unaffected
- Default suite: unaffected

## Builds

Fresh A:
- P18 section ("the 3PL's stock carries the 3PL's `asOf`, and `Stock` keeps the latest, dropping handed-over reservations with `handedOverAt <= asOf`") and D4: now breach P18 ("a time they carry"); complied with the Statement before.
- Envelope `occurredAt` "never used for ordering": complies, now on the Statement.
- P2 "tests call real domain functions and never double them": complies, now required; `@tea/payment/fakes` scenario fake holds (port fake).
- P8 "Hooks answer 200 only after the use case returned", call table 400 withheld / 500 / 200 after commit: complies, now required.
- S17, P4 senders as domain constants: still complies; its "P4 says the same" lost its basis; reading B still refused by no Statement.

Fresh B:
- P2 "Service tests use the real domain, never a double of it": complies, now required.
- Stripe hook "answers 200 only after it returns", 3PL hook "200 after commit": comply, now required; S17's 200 to unmapped event types calls no use case, not reached.
- P18 per-thing versions, notice-then-ask (`refreshStockLevel` asks the 3PL now): unchanged; the means A lacks.
- Nothing newly breaches.

## Newly broken

P18 refuses an owner-stamped time that delivers the property; with an external offering only its time, no build complies.

```md
---
breaches: [P18]
satisfies: [P9, P10]
situation: shop keeps the 3PL's free stock from the report with the later asOf the 3PL stamped; fulfillment relays it with no version
finding: regression
---
```
```ts
// packages/shop/src/services/record-free-stock.ts
const stock = await stockOf(tx, m.sku);
if (stock.freeAsOf !== null && stock.freeAsOf >= m.asOf) return; // 3PL's own time: older figure
await stockLevels.save(tx, applyFreeStock(stock, { free: m.free, asOf: m.asOf }));
```

Distilled output: the inserted P8 sentence shifts the Statement's count; `layers-why.md` P8 Rule Why still counts the old one (it matched before).

```md
P8 Statement, head: (3) "A driving adapter MUST NOT answer a call ..." (4) "A use case called for such a message ... provisional record ..." (5) "An external system ... MUST tell of its change by such a message."
P8 Why, head: "The third sentence is the same property seen from the receiving side" (now 4); "The fourth sentence closes the gap ... the third sentence is not reached ... the third sentence holds" (now 5, 4, 4).
```

## Noticed

- P11's "published events delivered to a handler" reaches an external owner's events at a hook only if a hook is a handler; glossary Hook and Handler leave it open; P11's Why says "its hook, a handler".
- P8 Scope "a message is delivered" and P9 Scope "whether the bus delivered it, a hook was called with it" read delivery as the bus's; P8's Scope names no call.
- P8's Why "the second sentence says how" (handler deciding nothing) pointed at the wrong sentence before the change too.
- P8 "such a message" (Fresh A S5) still reads as any message handled or only one asking for a decided change.
