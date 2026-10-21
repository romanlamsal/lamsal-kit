# Spec 01: layers.md against the Teeladen domain

## Destination

`registry/docs/agents/layers.md` places every edge case in `domain.md`, or names it as the
consuming repository's choice. Done when every row below is closed or ruled out.

## Order

1. Open question A, then tickets 12 and 11: A decides the exception in the rule 12 extends, and
   whether a saga step may answer synchronously.
2. Ticket 09, then open question B (ticket 16): both settle how messages travel between systems.
3. Tickets 15, 13 and 10, in any order.
4. Ticket 14 (generality test first), then open question D: both are about product hooks.
5. Open question C (ticket 17).
6. Ticket 21 (review 02, Q0), before any other review-02 finding: six of them close with it.
7. Tickets 22 then 23 (review 03, subgroup A: Q1, Q2, Q4, Q10), before the rest of review 03;
   23's step 4 uses 22's shape.

## Tickets

Status is one of: ready, blocked, closed (commit), ruled out. Each row matches the ticket's
`**Status:**` line. The next ticket is the first ready row in the order above.

| ticket | status | note |
| --- | --- | --- |
| `01-invoice-in-two-systems.md` | closed (c40be8e) | |
| `02-order-lines-shadowing.md` | closed (c40be8e) | |
| `03-tracer-carve-out.md` | closed (c40be8e) | |
| `04-idempotent-driving-adapters.md` | closed (c40be8e) | |
| `05-record-two-systems-write.md` | closed (c40be8e) | |
| `06-reporting-read-scope.md` | closed (c40be8e) | |
| `07-errors-in-published-language.md` | closed (c40be8e) | |
| `08-assembly-per-process.md` | closed (c40be8e) | |
| `09-messages-in-published-language.md` | closed (dedd87d) | |
| `10-inbound-translation.md` | closed (c30b656) | controllers row settled here; review 01 made the infrastructure received, not imported |
| `11-saga-state.md` | closed (746cb5a) | |
| `12-side-effects-through-outbox.md` | closed (bef2a8d) | absorbs open question A |
| `13-two-store-clients.md` | closed (879dfc1) | a store is what one transaction port reaches |
| `14-hook-writes-product-transaction.md` | closed (badd398) | hook as a decision tree; only a message in the product's transaction |
| `15-ambient-transaction-scope.md` | closed (3aa71b4) | retitled: what may be held ambient |
| `16-relay-wiring.md` | closed (d6ee97c) | resolves open question B |
| `17-fakes-of-other-systems.md` | closed (97e2dc2) | resolves open question C |
| `18-hook-on-own-write.md` | closed (8deed33) | resolves open question D |
| `21-service-registry.md` | closed (525c559) | from review 02, Q0; supersedes ticket 20's import half. Rows for 19 and 20: review 02, R02-64 |
| `22-driving-adapter-prepares-and-acts.md` | closed (ac716ac) | from review 03, Q1 and Q2; closes R02-01, R02-18, R03-01, R03-05, R02-07, R03-16 |
| `23-hook-defers-through-the-outbox.md` | closed (bac336c) | from review 03, Q4 and Q10; closes R02-04, R02-12, R02-05, R03-39; supersedes ticket 14's steps 3 and 4 |
| `24-one-root-per-process.md` | ready | from review 03, subgroup B (Q13's registry part, Q18, Q21); closes R03-04, R03-02, R03-06, R03-19, R03-20, R03-21, R02-11, R02-29; defines *entry*, *courier*, *outbox*, *relay*; a product is built by a build function; the outbox port leaves the common library; supersedes ticket 21's two-roots consequence and ticket 20's config entry; narrows R03-03 |
| `open-questions.md` A | closed (bef2a8d) | resolved into 12 |
| `open-questions.md` B | closed (d6ee97c) | resolved into 16 |
| `open-questions.md` C | closed (97e2dc2) | resolved into 17 |
| `open-questions.md` D | closed (8deed33) | resolved into 18 |

Tickets 01–08 were applied before the `## Decision` convention; they carry none.

## Ruled out

Gaps the review found and dropped; reopen only with a new failure.

- Products: conformist or anti-corruption layer? Already chosen per relationship ("How two
  systems relate is chosen per relationship").
- A product's collection config, or an ORM table, as a second constructor (question 3): the store
  schema is the store's, and the repository maps it to the domain's schema.
- Decorators around ports (tracing, retry, cache): assembly picks implementations; a generic
  wrapper is common library.
- Health and metrics endpoints: a service that only forwards is already "correct here".
- Server-side caches: a cache is a driven port; the writing use case invalidates it.
- Stale reads across systems in the UI: `components.md`'s concern, not this one's.
- The caller of a cron job or webhook: the controller resolves the caller.
- Migrations: the stack document, or the repository.
- Auto-instrumentation load order: the stack document (ticket 08).
- Payload's collection config re-declaring domain fields: the store schema is the store's; the
  repository maps it (the second-constructor row above, applied to a product).
- Request id and trace context crossing system boundaries: by ticket 15's rule nothing is decided
  by an ambient value, so crossing changes nothing; deliberately unsaid.

## Grounding to verify

Vernon citations in the tickets are from memory; the book was not reachable. Fallback citations
(Fowler, Richardson) are from memory too: Richardson's consumer-driven contracts (ch. 9–10,
ticket 17), compatible message schemas (ch. 3, ticket 09) and the compensatable step (ch. 4,
ticket 14) are unchecked.

Checked against Khononov, *Learning DDD* (print edition page numbers), in review 01: the saga and
process manager (ch. 9 pp. 147–152, ticket 11); the outbox, embedded events and at-least-once
(ch. 9 pp. 145–147, ticket 13, verbatim); private and public events (ch. 9 p. 140, ch. 15 p. 245,
ticket 09); "Assume the worst": events arrive out of order and duplicated (ch. 15 p. 245, which
an earlier version of this paragraph said was not found); stateless translation and the message
proxy (ch. 9 pp. 138–140, ticket 10); one aggregate per transaction (ch. 6 p. 87); the
application service as transaction script (ch. 6 p. 86); conformist and anti-corruption criteria
(ch. 4 pp. 53–54); event-carried state transfer (ch. 15 pp. 237–238, 246).

Checked against Evans's final manuscript (April 15, 2003; pages run about 100 below the hardcover):
the two-way anti-corruption layer (pp. 258–259, ticket 10), the conformist copying the upstream
model (pp. 255–256, ticket 09), the published language's definition and its "essentially becomes
frozen" warning (p. 264), integration across a bounded context's boundary as explicit translation
(p. 239, Bounded Context, ticket 15; an earlier version said p. 111).

Freeman & Pryce's "only mock types you own" (ticket 17) argues for consumer-owned interfaces, away
from a provider's fake.

Checked against O'Reilly's preview of Vernon, *IDDD* ch. 10: "Lack of Technical Mechanisms" and
"Global Transactions" are reasons to break one aggregate per transaction (ticket 13).
