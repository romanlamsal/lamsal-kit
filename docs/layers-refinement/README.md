# layers.md refinement

Tickets from a review of `registry/docs/agents/layers.md` against a made-up domain
(`domain.md`). Each ticket is self-contained: one session picks one up.

## Picking up a ticket

1. Read `registry/docs/agents/layers.md` whole, `docs/extending-layers.md`, and `domain.md`.
2. Work the ticket through the steps of `docs/extending-layers.md`. A ticket's proposed wording
   is a draft: it passes the four tests and the step-5 sweep before it goes in.
3. Record the resolution the grilling reached as a `## Decision` section at the end of the
   ticket, written as an ADR in the `domain-modeling` skill's format (its `ADR-FORMAT.md`): what
   was decided, in what context, and why; considered options and consequences only where they
   add value. An open question resolves the same way, in the ticket it becomes.
4. Present the change and wait for approval before committing, per `CLAUDE.md`.

Done when the ticket's own "Done when" holds and its `## Decision` section is written.

## Tickets

| ticket | status |
| --- | --- |
| `01-invoice-in-two-systems.md` | applied, uncommitted |
| `02-order-lines-shadowing.md` | applied, uncommitted |
| `03-tracer-carve-out.md` | applied, uncommitted |
| `04-idempotent-driving-adapters.md` | applied, uncommitted |
| `05-record-two-systems-write.md` | applied, uncommitted |
| `06-reporting-read-scope.md` | applied, uncommitted |
| `07-errors-in-published-language.md` | applied, uncommitted |
| `08-assembly-per-process.md` | applied, uncommitted |
| `09-messages-in-published-language.md` | ready to draft |
| `10-inbound-translation.md` | ready to draft |
| `11-saga-state.md` | ready to draft |
| `12-side-effects-through-outbox.md` | ready to draft, drafted with open question A |
| `13-two-store-clients.md` | ready to draft |
| `14-hook-writes-product-transaction.md` | ready to draft, generality borderline |
| `15-ambient-transaction-scope.md` | ready to draft |
| `open-questions.md` | needs a decision, grill first |

"Applied, uncommitted" means the change sits in the working tree as of 2026-10-19; check
`git log -- registry/docs/agents/layers.md` before acting on it.

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
