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
| `10-inbound-translation.md` | closed (c30b656) | controllers row settled here |
| `11-saga-state.md` | closed (746cb5a) | |
| `12-side-effects-through-outbox.md` | closed (bef2a8d) | absorbs open question A |
| `13-two-store-clients.md` | closed (879dfc1) | a store is what one transaction port reaches |
| `14-hook-writes-product-transaction.md` | closed (badd398) | hook as a decision tree; only a message in the product's transaction |
| `15-ambient-transaction-scope.md` | closed (3aa71b4) | retitled: what may be held ambient |
| `16-relay-wiring.md` | closed (d6ee97c) | resolves open question B |
| `17-fakes-of-other-systems.md` | closed (97e2dc2) | resolves open question C |
| `18-hook-on-own-write.md` | closed (8deed33) | resolves open question D |
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

## Grounding to verify

Every Evans, Vernon and Khononov citation in the tickets is from memory; the books were not
reachable online. Check them against the books before quoting them in `layers.md`; the least
certain is Khononov's saga as one coordinating component, which `layers.md` already relies on
(ticket 11). Fallback citations (Fowler, Richardson) are from memory too. Ticket 09 adds: Vernon
ch. 13 versioned media types, Richardson ch. 3 compatible message schemas, all from memory;
Khononov's "assume the worst; use the outbox" heuristic was not found in any source. Ticket 13 adds:
Khononov's outbox committing state and events in one atomic transaction, and events embedded in
the aggregate's record for stores without multi-document transactions, both from secondary
summaries and a reader's highlight. Ticket 14 adds: Richardson ch. 4's compensatable step, from
memory.

Checked against Evans's final manuscript (April 15, 2003; pages run about 100 below the hardcover):
the two-way anti-corruption layer (pp. 258–259, ticket 10), the conformist copying the upstream
model (p. 256, ticket 09), the published language's definition (p. 264), integration across a
bounded context's boundary as explicit translation (p. 111, ticket 15).

Checked against O'Reilly's preview of Vernon, *IDDD* ch. 10: "Lack of Technical Mechanisms" and
"Global Transactions" are reasons to break one aggregate per transaction (ticket 13).
