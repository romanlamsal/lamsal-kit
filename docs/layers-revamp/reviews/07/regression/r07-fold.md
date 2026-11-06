Base 7543822, head d41482d.
Changed: glossary Outbox makes outbox port indefinite ("An *outbox port* is a driven port"); glossary Transaction port loses "It returns the transaction, typed in the system's terms"; Assumptions loses "Which one is the architecture's"; P5 Why loses "a transaction made ambient, P7"; P6 Why loses the transaction-port fake that "commits nothing"; P7 Statement loses s3 (outbox messages in the same transaction, the rest by message or P8's call after the commit); P17 s2 drops its "if:" list, so every wait holds its moment; P17 Why and Provenance follow.

## Targeted findings

- R07-1 resolved: glossary Transaction port now fixes no shape, so `open/commit/rollback` (B D5) and `run(work)` (A D11) both fit; P5 s1 still requires the port in the system's terms.
- R07-2 resolved: glossary Outbox's "An *outbox port* is a driven port" admits one port (A S2) or several outbox ports (B `FulfilmentRequests`, `PaymentRequests`, `ShopEvents`, `ShopSchedule`; P12 Why's port of shop's own).
- R07-5 resolved: Assumptions no longer says who picks; held-back message or sweep, one per codebase or per use case (B S9 a, b), both comply.
- R07-6 resolved: P7 no longer restates P8; P7 s1 (one transaction carrying every write, committed once after the last) and P8 s1 (call to another system after the commit) give the one reading both builds took: call allowed, nothing written after it.
- R07-7 resolved: P17 s2 asks a moment of every wait, so "holds something" (A S8) is gone; B S7's question is now only P17 s3's "nothing of this system's hanging on it", and shop's reservations do hang on the booking.
- R07-13 resolved: the Why pointer to P7, whose s2 binds only writing ports, is gone; P5 s3 refuses a transaction (a client of the outside) that a reading adapter takes from a slot assembly did not fill.
- R07-14 resolved: P6 Why no longer describes a transaction fake that "commits nothing"; P6 s3 holds the fake to whole rollback where a use-case test relies on it (A S9 B, as A built).

## Every rule

Rules:
- P1 unaffected.
- P2 unaffected.
- P3 unaffected.
- P4 affected: P4 s1 (ambient value) and s2 (one acting call) are part of what still refuses the ambient transaction and a second acting call for "the rest", which P7 s3 used to name; holds, a build can do the same before and after.
- P5 affected: its Why pointer is struck, and "typed in the system's terms" is gone from glossary Transaction port; P5 s1 still refuses a transaction port typed by the store (store reached), and P5 s3 still refuses an ambient transaction read by any adapter; holds.
- P6 affected: Why item struck; s1 still requires a fake for the transaction port, s3 its relied-on rollback, before and after; holds.
- P7 affected: s3 struck. What it delivered: outbox messages in the use case's transaction, now P8 s1 ("in its transaction") plus P7 s1 ("carries every write"); the rest of the goal only by message or by the call after the commit, now P8 s1 ("a change it decides that the transaction does not commit MUST leave it only as..."), P7 s1 (no second transaction), P4 s2 (no second acting call). "Every write" in s1 reads as the heading's own records, so the call to another system is no write; holds.
- P8 affected: s1 now alone delivers what P7 s3 duplicated; Statement unchanged, same builds comply; holds.
- P9 affected: shares "call after the commit" with struck P7 s3; P9 s2 unchanged; holds.
- P10 affected: shares "transaction"; s1's read inside the committing transaction is met by an ambient one as before, and P5 s3 refuses it; holds.
- P11 unaffected.
- P12 affected: Why's port of shop's own writing to the outbox is now plainly an outbox port; Statement's "adapters that carry a call or a message" unchanged; holds.
- P13 unaffected.
- P14 unaffected.
- P15 affected: s2 "What else it needs another system to do it MUST ask for by a message" overlaps struck P7 s3; unchanged; holds.
- P16 affected: shares "transaction"; s1 still refuses an ambient transaction across systems whoever reads it, s3 unchanged; holds.
- P17 affected: s2 now asks a moment of every wait, not only where something is held or a rule limits the wait. Before, a part that held nothing, had no limit and stated a standing acceptance complied without a moment; now it must hold one. That is the targeted tightening, in line with s1's "on none coming" and with the heading's "ends"; s3 still exempts status-only progress. Tentative operations, asker and taker, stay covered by "waits on another system"; holds.
- P18 unaffected.
- P19 unaffected.
- Assumptions affected: clock sentence struck; P17 still relies only on "late, never early"; holds.

World properties:
- P1, P2, P3 unaffected.
- P4 affected: the ambient transaction is still refused by P5 s3 / P4 s1; holds.
- P5 affected: port in the system's terms for the transaction port now from P5 s1 alone; holds.
- P6 affected: Why only; holds.
- P7 affected: P7 s1 + P8 s1 + P4 s2 still deliver it; holds.
- P8 affected: P8 s1 unchanged; holds.
- P9–P16 unaffected.
- P17 affected: the wait's end is now required in every case, which the property's "ends" asks; holds.
- P18, P19 unaffected.

Glossary:
- Business domain, Business rule, System, Outside, Observation, Tooling, Probe: unaffected.
- Use case (Domain, Service, Driven adapters, Driving adapters): unaffected.
- Reach: affected: what keeps the transaction port in the system's terms now rests on Reach (store types in a port signature); holds.
- Pure: unaffected.
- Port: affected: outbox port and transaction port are ports; holds.
- Adapter: unaffected.
- Message: unaffected.
- Outbox: affected: changed; no Scope or Statement says "the outbox port"; holds.
- Handler, Bus: unaffected.
- Relay: affected: shares "outbox readers"; unchanged; holds.
- Idempotent, Idempotency key: unaffected.
- Tentative operation: affected: P17 s2 no longer names it; "every one eventually confirms or cancels" is still delivered by P17 s1 + s2 (every wait); holds.
- Open host service, Published language, Offer, Reconciliation: unaffected.
- Business process, Business process step: affected: P17 s2 now covers every wait of a part; holds.
- Saga, Choreography, Orchestration: unaffected.
- Upstream system, Downstream system, Conformist, Anti-corruption layer, Shared kernel, Hook, External system: unaffected.
- Aggregate: affected: P17 s2's moment held in one now for every wait; holds.
- Owner, Specification: unaffected.
- Repository: affected: P7 s2 still hands writing repositories the transaction; holds.
- Snapshot, Replica, Record: unaffected.
- Transaction: affected: shares the word; unchanged; holds.
- Store: affected: Transaction port keeps "on one store"; holds.
- Transaction port: affected: changed; used in no Scope or Statement; holds.
- Scheduled task: affected: clock Assumption names a sweep; holds.
- Ambient value: affected: struck Why pointer; P4 s1 and P5 s3 unchanged; holds.
- Factory, System builder, Assembly: unaffected.
- Courier: affected: P5 s3's "courier that only assembly fills" is what refuses the ambient transaction; holds.
- Configuration value, Common library: unaffected.
- Double: unaffected.
- Fake: affected: P6 Why item struck; holds.
- Integration test, End-to-end test, Default suite: unaffected.

## Builds

Fresh A:
- D11 `run(work)` transaction port: now plainly fits glossary Transaction port (was R07-1's split); complies before and after under P5 s1.
- S2 one `ShopOutbox`: still complies; D9's "separate port per destination" now also fits glossary Outbox.
- S3 `openCardPayment` writes nothing after the Stripe call: complies, P7 s1 + P8 s1.
- S8 `Order.handoverDueBy`, `RefundRequest.answerDueBy`: comply with P17 s2. Newly named by P17 s2: shop's `handedOver` order waiting for `fulfillment.ShipmentReported.v1`, and fulfillment's `Shipment` `handedOver` waiting for the 3PL's report, hold no moment. Old s2 exempted both, but they already breached P17 s1 ("on none coming", no rule for a report that never comes); now they breach s2 too.
- S9 `FakeShopTx` applies on success, discards on throw: complies with P6 s3, as before.

Fresh B:
- D5 / S3 `open/commit/rollback`: complies; no longer forced, `run(work)` (D5 "also held") now fits too.
- Split outbox ports (`FulfilmentRequests`, `PaymentRequests`, `ShopEvents`, `ShopSchedule`, adapter `outbox.ts`): now plainly outbox ports by glossary Outbox; before, at odds with "the outbox port".
- S4 `placeOrder` → `CardPayments.start` after commit, `payment.start` → Stripe after its commit, nothing written after: complies, P7 s1 + P8 s1.
- S7 / D22 `Order.bookingOverdueAt`, `Refund.overdueAt`: comply. Newly named by P17 s2: shop after `ShipmentBooked` waiting for `ShipmentReported`, and fulfillment's `Shipment{booked}` waiting for the 3PL's report, hold no moment. Already a breach of P17 s1; now also s2.
- S9 b (held-back messages for deadlines, sweeps elsewhere): complies plainly.

## Newly broken

none

## Noticed

- A reading adapter that takes an ambient transaction through a transaction-port method (`current()`) gets it "returned by a port so chosen" (P5 s3); P7 s2 binds only writing ports and P10 s1 is met, so nothing refuses it. Not caused.
- P17's "waits" is in no glossary entry; after the change, s3 and the Why's list are all that bound it. The gap was there before; the change only made it the sole trigger.
- P7 Why still lists "the outbox port", singular, and "the call after the commit that P8 allows"; Why only.
