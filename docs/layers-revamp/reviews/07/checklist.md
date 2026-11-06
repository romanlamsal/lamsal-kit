# Review 07, checklist

State after the fold (9ee3e03, d41482d). "Changed" items are what the regression r07-fold targets.

## Split

- R07-1 Glossary Transaction port "It returns the transaction": B `open/commit/rollback` from the
  wording (B S3), A `run(work)` (A D11); caused by 7543822. Changed: second sentence struck
  (9ee3e03).

## Words and readings

- R07-2 Glossary Outbox "*the outbox port*" singular vs P12 Why's own port writing to the outbox
  (A S2). Changed: "An *outbox port* is a driven port" (d41482d).
- R07-3 Glossary Hook: Payload `afterChange` writing only Payload's collection (A S12). No change:
  Driving adapter ("the driving ports it calls") and External system settle it.
- R07-4 P13 "A system builder is in the offer for assembly": who may import it (A S19). No change:
  P13 s1 refuses other systems' code; noise.
- R07-5 Assumptions clock "Which one is the architecture's": per codebase or per use case (B S9).
  Changed: sentence struck (d41482d).

## Recurring, same reading in both

- R07-6 P7 s1 "commits once after the last write" with P8's call after the commit (A S3, B S4).
  Changed: P7 s3 struck, P8 s1's duplicate (9ee3e03).
- R07-7 P17 "holds something until the answer comes" / "is no wait" (A S8, B S7). Changed: s2's
  condition list struck, every wait holds its moment, as s1's "on none coming" asks; Why sentence
  and Provenance wording follow (9ee3e03).
- R07-8 P1 "load on every runtime of the language" (A S18, B S12). No change: readings
  compatible; B's extra bans are "pure"'s.
- R07-9 P9 "the store refusing a second claim" with `on conflict do nothing` (A S6, B S6). No
  change: intended.
- R07-10 P2 with glossary External system: Payload owns products (A S4, B S2). No change:
  intended.
- R07-11 Glossary System "wherever the codebase keeps it" with P13 s1 / P5 s2 (A S10, B S1). No
  change: intended.

## Carried

- R07-12 P5 s1: UoW adapter importing another adapter's factory (tx-uow, tx-port Noticed). No
  change: P5 s3 refuses it, the factory handed by nobody.
- R07-13 No Statement refuses an ambient transaction used by a reading port (tx-uow, tx-port).
  Closed on P5 s3 (and P4 s1); changed: P5 Why's "a transaction made ambient, P7" struck (d41482d).
- R07-14 P6 Why fake "commits nothing" vs rollback whole (A S9; r05-reconcile). Changed: Why item
  struck; P6 s3 decides rollback (d41482d).
- R07-15 Distilled preamble: no modal meanings, no "Why binds nobody"; no draft tripped. No
  change: property-rules preamble says the Why is reasoning; modals read as RFC 2119.
