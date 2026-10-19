# Where a saga's state lives

**Status:** ready to draft · **Kind:** real gap · **Touches:** Transactions (the outbox bullets,
"a saga") · **Related:** `open-questions.md` A (a saga step that must answer synchronously)

## Context

In `domain.md`, the checkout saga spans shop, payment, fulfillment and billing; when payment
fails or never arrives, the reservation is released and the order cancelled.

## Problem

"When a later step fails, new steps undo the earlier ones — a saga. Nothing rolls back." places
no code. An agent spreads the saga's state over the systems' aggregates, puts it in the common
library, or keeps it in memory. It should hold it in one system's aggregate and send its
commands through that system's outbox.

## Resolution

Extend the saga bullet:

> When a later step fails, new steps undo the earlier ones — a saga. Nothing rolls back. The
> saga's state is an aggregate of the system that runs it, and its commands leave through that
> system's outbox.

Whether a codebase coordinates by reaction (saga) or by a central state machine (process manager)
stays its choice. Decide whether to say "say which", as the transaction paragraph does.

## Grounding

- Khononov, *Learning DDD* ch. 9 (Saga p. 173, Process Manager p. 176 per the Sharif library
  table of contents): a saga listens to events and issues commands, including compensating ones;
  a process manager keeps explicit state, implemented as an aggregate; commands go out through
  the outbox *(from memory)*.
- Vernon, *IDDD* ch. 4, "Long-Running Processes, aka Sagas": the process is owned by one bounded
  context and its state tracked there, timeouts included *(from memory)*.

## Done when

The clause passes the four tests; open question A is checked for a conflict (a synchronous step
inside the saga); presented for approval.
