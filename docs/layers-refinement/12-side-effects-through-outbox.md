# Side effects at third parties

**Status:** ready

**Kind:** real gap · **Touches:**
Transactions (headline, rule 1) · **Absorbs:** `open-questions.md` A (the same sentence needed its
answer)

## Context

In `domain.md`, shop sends an order-confirmation mail after the order commits, and checkout
returns a Stripe `client_secret` that payment creates in the same request.

## Problem

Rule 1 reads "Does it change data another system owns? → Outbox, required." An agent cannot tell
whether a sent mail or a created payment is "data another system owns". It sends the mail inside
the transaction (the mail goes out, the transaction rolls back), or sends it after commit with
nothing to retry a failure. It should write a message to its outbox in the transaction and let
the relay trigger the mail.

Naming third parties in rule 1 makes the `client_secret` impossible: the outbox answers after the
request is gone (open question A).

## Resolution

Reword the headline and rule 1:

> **Writes that must land together share one transaction, and the transaction stays inside its
> system.** For each piece of data the use case touches, answer in order:
>
> 1. **Does it change data another system owns — a third party's included, such as a mail sent
>    or a payment created?** → **Outbox, required.** Write a message to this system's outbox in
>    the same transaction. The owner changes its data when the message arrives.
>
>    Where the use case's caller waits for the other system's answer, call the other system
>    instead, once the transaction has committed, and record the answer, if this system keeps
>    it, in a transaction of its own. Make the call safe to repeat: the other system recognises a
>    repeat however it can — a key it dedupes on, this system's id stored on its side and looked
>    up first. Where it cannot, a repeat may duplicate. A failure after the commit, and a
>    duplicate, are repaired by the saga or by reconciliation. This exception is this document's
>    choice; the sources do not cover it.

In `domain.md`, payment creates the PaymentIntent behind its anti-corruption layer; shop calls
payment.

## Grounding

- Cockburn, *Hexagonal Architecture*: "A secondary actor is one that the application drives,
  either to get answers from or to merely notify" — a mail provider is the same kind of actor as
  the database *(verified, https://alistair.cockburn.us/hexagonal-architecture/)*.
- Vernon, *IDDD* ch. 8: events are stored in the same transaction as the aggregate and published
  after commit; notifications are sent from them *(from memory)*.
- Vernon, *IDDD* ch. 10: one aggregate per transaction, eventual consistency between them — a
  use case of several transactions is normal there *(from memory)*.
- Khononov, *Learning DDD* ch. 9, Outbox (p. 171 per the Sharif library table of contents): the
  outbox exists because a commit and a publish cannot be made atomic *(from memory)*.
- Fowler, *PoEAA* ch. 5: a business transaction often spans several system transactions — the
  nearest source for commit, call, record *(from memory)*.
- None of the four sources addresses a synchronous answer from a change at another system.

## Done when

The headline and rule 1 pass the four tests; the sweep covers "The review checklist" question 5
and the outbox bullets; presented for approval.

## Decision

**Answer needed now: commit, then call, safe to repeat.** Rule 1 sends every change at another
system through the outbox, third parties' included, yet checkout must return Stripe's
`client_secret` in the same request. Where the use case's caller waits for the other system's
answer, the use case commits first, then calls the other system directly, and may record the
answer in a second transaction. The call is safe to repeat because the other system recognises a
repeat, however it can; a failure after the commit is repaired by the saga or by reconciliation,
like a lost message. The exception covers internal systems too: an outbox-only rule forces
polling or push onto every request that waits for an answer.

The headline moved from "One use case is one transaction" to "Writes that must land together
share one transaction". The old wording (`3c0821c`) guarded against a use case scattering its
writes, as checklist question 5 does; the answer's write need not land with the rest, since a
repeated call returns the same answer. No separate exception for the second transaction is
needed.

**Considered options**

- Pending order, secret delivered later by poll or push: always allowed; rejected as the rule for
  the latency and moving parts it adds to every waiting request.
- A bare exception without repeat-safety or repair: leaves the failure window unowned.
- Call first, then commit: a failure leaves a resource at the other system that this system
  knows nothing of; only a scan of the other system finds it.
- Keep the headline and add an exception for the second transaction: rewording states what the
  rule protects, so no exception is needed.
- Restore the sentence `3c0821c` dropped ("A call to another store runs outside it — before,
  with an idempotency key, or after, …"): it allowed the call first and sat outside Transactions.

**Consequences**

- The aggregate the call is for needs a pending state, also where accepting depends on the
  answer: pending, then accepted or rejected in the second transaction.
- An internal provider's driving port recognises the repeat: payment returns the existing
  Payment for an order id.
- Nobody waits on a message handler, a scheduled task or a saga step; they keep the outbox.
- Not added: a sentence on when to keep the answer (follows from the aggregate rules), and a
  "When to leave it alone" bullet (rule 1 names the second transaction itself).
