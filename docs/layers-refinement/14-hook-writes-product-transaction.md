# A hook writes the outbox inside the product's transaction

**Status:** closed (badd398)

**Kind:** real gap · **Touches:** Products
(the hooks bullet); Transactions (the opening rule)

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

Products, the hooks bullet:

> - **A product's hooks and scheduled tasks are driving adapters**, and the constraints on driving
>   adapters apply to them. For a hook:
>   - **It asks**, such as whether a change is valid → it asks, at any point.
>   - **It acts** → answer in order:
>     1. **The product has committed the change** → the hook acts through one service.
>     2. **The product's caller needs this system's work before the product answers it**, such as a
>        profile for a user signing up → the hook acts now, through one service, in this system's
>        own transaction. If the product rolls back, the saga or reconciliation undoes the work. A
>        hook the product runs after its commit does the same with nothing to undo, and is preferred
>        where the product offers one.
>     3. **The hook runs inside the product's transaction, and a write there commits and rolls
>        back with the change** (the product hands the hook its transaction, and the outbox is in a
>        store that transaction reaches) → the hook writes only a message there, to this system's
>        outbox or the product's, as each codebase chooses. Nothing is lost.
>     4. **Otherwise**, inside the transaction or before it opens → the hook leaves its work to a
>        handler that first checks the change through the product.
>
>   Steps 2 and 3 are this document's choice; the sources do not cover a product's transaction. A
>   hand-off, or an act after the commit, is lost when the process stops first and the product
>   does not run the hook again; reconciliation repairs it.

Transactions, the opening rule:

> **Writes that must land together share one transaction, and the transaction stays inside its
> system**, except a message a product's hook writes in the product's transaction (Products).

## Grounding

- Khononov, *Learning DDD* ch. 9, Outbox: the state change and the outgoing message commit in one
  atomic transaction *(from memory)*. Here the state change is the product's, the message this
  system's.
- Evans, conformist (p. 256) and anti-corruption layer (pp. 258–259): the relationship decides
  whether to translate, not where *(verified against the final manuscript)*. Khononov ch. 4 says
  the same *(from memory)*.
- Richardson, *Microservices Patterns* ch. 4: a compensatable step, undone by a later one, grounds
  step 2 *(from memory)*.
- Vernon, *IDDD* ch. 10, and Khononov: consistency across contexts is eventual; their reason, no
  transaction spanning the stores, does not hold where one does. What remains against joining is
  coupling, hence "only a message".

## Done when

The generality test is decided; if it passes, the clause passes the other three and the sweep
covers the outbox bullets; presented for approval.

## Decision

**The generality test passes.** Whether a hook's write can commit with the product's change
depends on the product and on whether this system's transaction port reaches the product's
transaction (ticket 13). Worded as a condition by property, the step holds in any codebase.

**The product's transaction holds only a message, never this system's work.** Joining it is
technically sound where the port reaches both: change and work commit or roll back together. It
was rejected because it opens too many doors: a failure in this system's work fails the product's
write, and separating the stores later forces a switch anyway.

**Every message in this system's outbox is in this system's terms.** Recording the product's
change in the product's terms was considered: it keeps translation out of the product's write
path. It was rejected because messages in an outbox are the system's published language
(ticket 09): another system subscribing would conform to the product without choosing to, past
this system's anti-corruption layer. The hook is an ordinary driving adapter: it translates where
the relationship asks for it (ticket 10) and calls one service, which writes the message.

**Which outbox is each codebase's choice.** This system's, or the product's where the product has
one and the hook can write it in the product's transaction.

**Acting before the commit is allowed where the product's caller waits.** Sign-up plus profile:
the message is asynchronous and the user's next request finds no profile. The hook acts in this
system's own transaction, and the saga or reconciliation undoes the work on a rollback, mirroring
Transactions item 1's exception. An after-commit hook serves the waiting caller with nothing to
undo, so it is preferred; it is not preferred over the message, which alone loses nothing.

**The loss line is drawn by property.** The old text covered only hooks inside the transaction; an
act after the commit is lost on a crash too.

**Considered options**

- Writing this system's aggregates in the product's transaction: rejected, see above.
- The event in the product's terms, public or private to this system: rejected, see above; private
  would have needed an outbox message outside the published language.
- "After-commit hooks are always preferred": true against step 2 only.
- A generic Transactions clause ("this document may state exceptions"): names no place, guides no
  decision.

**Consequences**

- The Transactions pointer names the hooks bullet. A change to either finds the other through the
  step-5 sweep ("hook", "Products").
- Open question D, a hook firing on this system's own write, now shows up as a message in the
  outbox under step 3.
