# Where a saga's state lives

**Status:** closed (746cb5a)

**Kind:** real gap · **Touches:** Transactions (the outbox bullets); Other systems (the export
list, the linter sentence); the driving-adapter sentence on at-least-once callers · **Related:**
`12-side-effects-through-outbox.md` (rule 1's exception for a waiting caller)

## Context

In `domain.md`, the checkout saga spans shop, payment, fulfillment and billing; when payment
fails or never arrives, the reservation is released and the order cancelled.

## Problem

"When a later step fails, new steps undo the earlier ones — a saga. Nothing rolls back." places
no code. An agent lets two systems time out on the same step, so a late payment meets a released
reservation, or none, so the order stays pending forever. It drops a message that arrives before
the one it depends on, because the relay's order is not stated. It names handlers for the action
the wiring decided, so the wiring carries the saga. It should let one system hold the deadline,
expect any order, and leave each receiver to decide what it handles.

## Resolution

Outbox bullets:

> - A relay delivers each message after the commit, at least once, and not necessarily in order.
> - The relay is common-library plumbing. The receiver decides which messages it handles;
>   handing each receiver's handler to the relay is wired once, above the systems.[^16]
> - …
> - When a later step fails, new steps undo the earlier ones — a saga, here the whole sequence
>   rather than Khononov's coordinating component. Nothing rolls back. A step that waits on
>   something that may never happen, such as a payment never made, has one system waiting for
>   it: that system holds the deadline in its aggregate and acts once it passes. How the systems
>   coordinate is each codebase's choice: each reacts to the others' events (choreography), or
>   one system's process manager sends commands (orchestration). Say which.

Driving-adapter sentence: "…handling the same delivery twice changes nothing the second time,
however late the second comes."

Other systems: "Export:" without a count; a list item "where it handles messages, a function that
takes configuration and builds its message handler, for the assembly that hands it to the relay";
"Other systems reach a system only through these exports".

In `domain.md`, shop publishes `OrderPlaced` instead of writing `ReserveStock`; shop's Order holds
the payment deadline and publishes `OrderCancelled`; fulfillment releases on it.

## Grounding

- Khononov, *Learning DDD* ch. 9, pp. 147, 150, 152 (print edition): "a saga matches events to
  the corresponding commands"; a process manager is "a central processing unit that maintains the
  state of the sequence and determines the next processing steps", and "process managers are
  often implemented as aggregates" *(verified, review 01)*.
- Vernon, *IDDD* ch. 4, "Long-Running Processes, aka Sagas": the process is owned by one bounded
  context and its state tracked there, timeouts included *(from memory)*.
- Vernon, *IDDD* ch. 8: a domain event is a past-tense fact, published after commit; subscribers
  in other contexts react *(from memory)*.
- Fallback: Richardson, *Microservices Patterns* ch. 3–4: a saga is the whole sequence of local
  transactions, coordinated by choreography (events) or orchestration (commands and replies);
  a semantic lock is the pending state; an idempotent consumer records the messages it handled;
  relays poll the outbox or tail the transaction log *(from memory)*.

## Done when

The clauses pass the four tests; ticket 12's exception in rule 1 is checked for a conflict (a
synchronous step inside the saga); presented for approval.

## Decision

**Where the state lives follows; the deadline does not.** Each step's state is an aggregate of the
system that handles it, so a repository stores it; the common library holds no model. The
ticket's draft, "the saga's state is an aggregate of the system that runs it", assumed one system
runs the saga, which choreography denies. What does not follow is who notices a step that never
comes: one system holds the deadline, and what wakes it — a delayed message, a scheduled task — is
the codebase's.

The relay promises at least once and no order. A message arriving before the one it depends on
is not a repeat; a guard that treats it as one drops it. Whether the handler records it or fails
so it comes again stays the codebase's: under "at least once", a retry is safe, and a dead-letter
queue is the codebase's own weakening. A lost relay state means a replay, which "however late"
covers.

The receiver decides what it handles, so wiring only hands handlers to the relay; where that
happens is open question B. A handler is named for the message it receives, not for the action
it takes.

Ticket 12's exception has no conflict here. It applies to any request whose caller waits, at any
point in the saga; a message handler's caller, the relay, waits for nothing, so handlers keep the
outbox. A failed call after the commit leaves a step that never comes, and the deadline catches
it. A step arriving after the saga was undone is decided by the receiver from its aggregate's
state; it needs no sentence.

The author prefers choreography; orchestration stays open, and no decision here blocks it. The
codebase says which.

**Considered options**

- The saga's state in the system that runs it (the ticket's draft): wrong under choreography.
- Wiring that names the action (`PaymentFailed → releaseReservation`): the wiring decides.
- "Record, never retry" as a rule: retry is safe under "at least once".
- "What the next step needs is in a store": follows from the aggregate; the relay's own state
  may be lost.
- A replay clause on the outbox bullet: follows from "however late".

[^16]: Superseded by ticket 16: the consuming system's assembly hands the handler to the relay
    by default, and a root wires it once only when one of the escalation reasons holds.
