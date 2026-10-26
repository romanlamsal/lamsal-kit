# 15 — Gaps and loose Statements

**Status:** open

## Context

The full review (spec 02) found situations of the fixture no Scope holds for, and Statements a
breach satisfies with nothing in the Why to move (issue 13 has those). Found by both sets unless
noted. Order: `specs/02-review-findings.md`, step 6, on the text issues 12 to 14 leave.

Settled when it was opened:

- A gap closes by a new rule, a widened Scope, or a sentence in the Assumptions, under the tier
  rules; or it stays open on purpose, recorded here.
- A loose Statement is sharpened until it refuses the breach, or the breach is accepted and the
  ok example says why.
- A rule placing business rules exists by now (spec 02, step 2); findings it covers are checked
  against it, not ruled again.

## Problem

### Gaps

- A decision on another system's live answer. Checkout reads billing's dunning stage through its
  open host service and commits on it. TX-24 covers this system's own stored data, TX-27 a
  replica. Both Implementers built a replica to stay inside TX-27: a detour.
- An outside effect with no idempotency key. TX-5 against a mail provider that takes none:
  claim the message id, then send, and a crash loses the mail, which P8 forbids and no rule
  does; send, then claim, and a crash doubles it. Idempotent's "the same result" does not say
  whether the mail counts (issue 12). The same for the 3PL and the bank. TX-22's Why rules it
  today ("a repeat stays possible, which a business rule has to allow"); issue 13 moves the
  sentence, this issue decides what it says.
- A polled answer (distilled). The bank's transfers are applied again on every poll: TX-5 covers
  delivered messages, a polled answer is none. An unmatched transfer is dropped: TX-35's Scope
  wants a delivered event. Holds if the bank is polled (issue 17).
- A probe's way to the store. ASM-4 shuts the courier to anything but a driving adapter; ASM-2
  covers factories, not route modules. Every reader had `/health` open its own pool, which pings
  a pool no use case uses. `gap-health-and-metrics-endpoints` from round 1.
- Instrumentation built before assembly, from the environment: ASM-1's Statement does not reach
  it. Holds if the library's load order is no convention; may be the stack document's.
- Catalog's config reading fulfillment's stock table. The Assumptions name two parts of external
  configuration the rules reach, SYS-12's and TX-29's; a read is neither. Both Implementers read
  fulfillment's open host service instead.
- The admin dashboard belongs to no system (raw; `gap-admin-dashboard-belongs-to-no-system`).
  Both Implementers host it in shop over replicas; if the fixture means the owners' tables
  (issue 17), TX-12 cannot be complied with.
- Trace context crossing the outbox (distilled): ASM-3 covers the read, TX-7 the schema, nothing
  the crossing. `asm-3-ok-trace-context-crosses-bus-in-envelope` shows a shape with no rule.
- A message with no schema, `payload: unknown` in a common-library outbox, lost its rule with
  TX-4 (issue 08).
- One transaction across shop and Payload: `svc-6-ok-opaque-transaction` and
  `asm-2-ok-payload-adapter-takes-instance` hand shop's transaction into Payload's Local API.
  TX-25's Scope is a system declaring a driving port; P16 is uncovered for an external system's
  ways in (raw Implementer N11).
- An external system's Local API as this system's way in: is Payload's Local API catalog's open
  host service for TX-12 (raw Implementer N3, both Gaps). Fact in issue 17, rule here.

### Loose Statements

- SVC-7: a generic `Sql` port declared in the service layer. "A port of its system" does not say
  the system's terms (P5).
- SVC-3: a driven port whose adapter wraps a sibling service, typed inline; the second
  transaction commits alone (raw: cart cleared, order lost; distilled: a gapless number spent).
- TX-28: the hook's use case records a private message, and its handler acts before Payload
  commits. Whether the message is tentative depends on the handler, outside the Scope.
- TX-7: an optional `paidByInvoice` keeps both directions readable; old handlers ignore it and
  the order is never invoiced (P14). DOM-3 (distilled): a field's meaning changed in place; TX-7's
  Scope has no records.
- TX-30, TX-35: any business rule satisfies: one that abandons without asking Stripe, postpones
  forever, or asks for the refund again forever.
- TX-23: reload and save again after the conflict (raw); an upsert of an aggregate never loaded
  (distilled, P10).
- TX-17: one event per consumer with no system named (raw).
- TX-24 (distilled): a decision by a snapshot inside the saved aggregate.
- TX-12 (distilled): shop reads billing's outbox table as "published events".
- TX-19 (distilled Contradiction): alone, it may leave no code for scarce or numbered allocation
  under F5, the last unit or a gapless number.
- TX-22's Scope read literally holds for the handler's own use case too (raw Contradiction N8).
- ASM-2 against DRV-3 on the Payload cycle: the raw set says neither Scope is narrower and the
  pair hangs on "receive it from its caller"; the distilled says DRV-3 governs. Say which.
- ASM-4: is a typed courier accessor the reader (raw Implementer N8).
- Words issue 12 leaves to the rules: a request id as "what it answers" (TX-34), ASM-3's reach
  into a domain function the service calls.

## Decision

—

## Consequences

—
