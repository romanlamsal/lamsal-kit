# Review 07, summary

Regular review: Fresh drafts A and B, distilled set (property rules), over `1aa00c6`. Brief
copied from review 06; `domain.md` unchanged. Same prompt as review 06, paths only. Distilled
output checked by hand before launch: glossary and world identical to source (the world's
"*Draft.*" stripped), 19 rules, each Scope, Statement, Why, Provenance in order, only the author
fields and the Appendix dropped, nothing leaked. Not changed, noted: the distilled preamble says
nothing of what MUST, SHOULD, MAY mean or that Why binds nobody; no draft tripped on it.

## Counts

| | Review 06 | Review 07 |
| --- | --- | --- |
| Fresh A, D / S | 35 / 18 | 40 / 20 |
| Fresh B, D / S | 35 / 21 | 34 / 18 |
| "does not hold" | 0 | 0 |

A S20 reads the brief, not the document; dropped.

## Review 05 and regression items, state now

- R05-31 (words not in the glossary): closed. "Transaction port" entered (7543822); what is left
  in binding text, *part* (P17 Scope defines it), *claimed* (P9, settled as R05-16), *way in*
  (glossary Port, Driving adapter), is plain or glossed.
- R05-33 (choices): moot; `choices.md` is gone (e2c3ebd).
- R05-34 (fixture): closed by review 06's brief (short lines, delivery address, article master).
- tx-uow Noticed, P5 s3 vs the transaction the service opens: resolved (tx-port). No draft reads
  it otherwise.
- Regression Noticed still open: UoW adapter importing another adapter's factory (P5 s1); ambient
  transaction used by a reading port; P6 Why fake "commits nothing" (A S9 took rollback whole).
- Fresh B 06's breach, published language admitting the kernel: gone. B 07 reads P13 s3 as
  refusing it and carries `amountCents` (B S13).

## New

- Glossary Transaction port, "It returns the transaction": B took it literally,
  `open()`/`commit()`/`rollback()` with try/rollback in every service (B S3), while its own D5
  lists `run(work)` as also holding; A built `run(work: (tx) => …)` (A D11). Caused by 7543822.
  The tx-port regression flagged the same wording.
- Glossary Outbox, "*the outbox port*" singular, against P12 Why's port of shop's own that writes
  `ReserveStock` to shop's outbox (A S2). A took one port per system.
- Glossary Hook: whether Payload's `afterChange` that writes only Payload's own collection is a
  hook (A S12). A: configuration, no system's.
- P13 "A system builder is in the offer for assembly": whether only assembly and tooling may
  import it (A S19).
- Assumptions, "Which one is the architecture's" (clock): one mechanism per codebase or per use
  case (B S9). B: per use case.

## The drafts against each other

| | A | B |
| --- | --- | --- |
| Systems | shop, payment, fulfillment, billing | same |
| Products | Payload owns, its config holds price and sku rules | same |
| Stock | shop, `Stock` per sku saved with the order | same |
| Bus | pg-boss, same Postgres | same |
| Coordination | shop orchestrates, billing by choreography | same |
| Shared kernel | `Money`, `EmailAddress` | same |
| Translation | anti-corruption layer everywhere | same |
| Couriers | filled by the system builder | same |
| Transaction port | `run(work)`, opaque `ShopTx`, `instanceof` | `open()` + `commit`/`rollback`, `WeakMap` |
| Refunds | shop before invoice, billing after | payment decides all, shop and billing ask |
| Mails | per system, private message + executor | same |
| Card start | intent reference from the webhook | payment commits, then calls Stripe |
| Published language | (not stated) | no kernel types, `amountCents` |

They agree on almost every cut. Where they differ, each holds every property, except the
transaction port shape, which B attributes to the glossary's wording.

## Sentences both drafts picked a reading for

Same reading in both unless said.

- P7 s1 "commits once after the last write" with P8's call after the commit (A S3, B S4; 06 B S4).
  Both: the call after the commit is allowed, its answer is recorded by a later use case. Second
  review in a row.
- P9 "the store refusing a second claim of it" (A S6, B S6): both count `on conflict do nothing`,
  told by the returned row, leaning on P7 Why's "an insert that does nothing on conflict".
- P17 "it holds something until the answer comes" / "is no wait" (A S8, B S7; 06 A S8, A S18,
  B S9): both: a reservation waiting for handover holds something. Third review in a row.
- P1 "MUST load on every runtime of the language" (A S18, B S12; 06 A S13, B S16): A allows a
  pure polyfill, B restricts host globals; compatible. Third review in a row.
- P5 Why "a system builder being assembly" (A S1, B S11): both: the builder fills its system's
  courier. Glossary System builder says the same; no finding.
- P2 with glossary External system (A S4, B S2; 06 A S2): both: Payload owns products and its
  config's rules.
- Glossary System "wherever the codebase keeps it" with P13 s1 / P5 s2 (A S10, B S1; 06 A S1,
  B S1, B S10): both: the framework's route or config file importing a driving adapter is the
  system's.

## One draft each, seen before

A S5 P8 s3 deadline messages (06 B S2, before "make" became "act on"); A S7 P10 replicas (06
B S18); A S9 P6 Why fake; A S11 P8 s4 "can" (06 A S3); A S13 Tooling (06 B S8); A S14 P4 retries
(06 A S16, B S5); A S16 P17 refusal naming no sender (06 B S20); A S17 P2 sender address (06 B S6);
B S8 P17 accepting (06 A S9); B S10 Outbox "assembly does" (06 A S4); B S14 P3 kernel
`EmailAddress` (06 B S12); B S15 P10 outside answer (06 A S7); B S16 P6 vendor sandbox (06 B S14);
B S18 P11 Payload admin (06 A S17).

New, one draft, not above: A S15 P7 aggregates tied (reservations across skus); B S5 P7 Why
service calling a service; B S17 P4 webhook event types without a port.

## Candidate issues

1. Glossary Transaction port: "returns" reads as a mechanism (R07-1).
2. Glossary Outbox, one outbox port or several (R07-2).
3. Recurring, same reading every time: P7 s1 with P8, P17 "holds something", P1 runtimes. They
   cost each draft a pick but split nothing; candidates for a shorter Statement, not for more text.

## Fold

Folded straight into the rules, no issue opened (9ee3e03, d41482d): R07-1, 2, 5, 6, 7, 13 (Why
pointer), 14. Closed with no change: R07-3, 4, 8, 9, 10, 11, 12, 13, 15. States per item in
`checklist.md`; regression `regression/r07-fold.md`.

## Persona reviews

Added after the regular review, on request: two readers judging drafts A and B as Khononov, Evans,
Cockburn and Helland would, plus buildability. Input: `brief.md`, the glossary, and each draft
through its directory tree only (`persona-input-a.md`, `persona-input-b.md`: no property mapping,
no D or S list), so the readers judge the build, not the rules' reading. Web allowed. Output
`persona-a.md`, `persona-b.md`. The glossary changed (9ee3e03) while they ran. Not yet folded.
