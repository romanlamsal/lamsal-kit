# A hook writes the outbox inside the product's transaction

**Status:** ready

**Kind:** real gap · **Touches:** Products
(the hooks bullet)

## Context

In `domain.md`, Payload's `afterChange` hook runs inside Payload's transaction and exposes it as
`req.transactionID`, on the same Postgres as shop's outbox.

## Problem

The hooks bullet reads: "a hook may run inside the product's transaction, whatever its name.
Where it does, the hook leaves its work to a handler that first checks the change through the
product. Changes lost in between are repaired by reconciliation." An agent builds an in-memory
hand-off and a reconciliation job, when the hook could write this system's outbox in the
product's transaction and lose nothing.

## Resolution

After "first checks the change through the product":

> Where the product lets the hook write in its transaction, the hook writes this system's outbox
> there, and nothing needs reconciling.

Generality test first: does this hold in any codebase, or only for products that expose their
transaction? If only some, the sentence still guides "when you can, do this"; if the test says
repository-specific, move it to the consuming repository and close this ticket.

## Grounding

Khononov, *Learning DDD* ch. 9, Outbox: the state change and the outgoing message commit in one
atomic transaction *(from memory)*. Here the state change is the product's, the message this
system's.

## Done when

The generality test is decided; if it passes, the clause passes the other three and the sweep
covers the outbox bullets; presented for approval.
