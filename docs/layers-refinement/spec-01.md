# Spec 01: layers.md against the Teeladen domain

## Destination

`registry/docs/agents/layers.md` places every edge case in `domain.md`, or names it as the
consuming repository's choice. Done when every row below is closed or ruled out.

## Order

1. Open question A, then tickets 12 and 11: A decides the exception in the rule 12 extends, and
   whether a saga step may answer synchronously.
2. Ticket 09, then open question B: both settle how messages travel between systems.
3. Tickets 15, 13 and 10, in any order.
4. Ticket 14 (generality test first), then open question D: both are about product hooks.
5. Open question C.

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
| `09-messages-in-published-language.md` | ready | |
| `10-inbound-translation.md` | ready | may split a ticket for the controllers row |
| `11-saga-state.md` | ready | check against ticket 12's exception in rule 1 |
| `12-side-effects-through-outbox.md` | closed (bef2a8d) | absorbs open question A |
| `13-two-store-clients.md` | ready | |
| `14-hook-writes-product-transaction.md` | ready | generality test may rule it out |
| `15-ambient-transaction-scope.md` | ready | argue the derivation test |
| `open-questions.md` A | closed (bef2a8d) | resolved into 12 |
| `open-questions.md` B | ready | grill; relates to 08 |
| `open-questions.md` C | ready | grill |
| `open-questions.md` D | ready | grill; after 14 |

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
certain is Evans's two-way anti-corruption layer (ticket 10).
