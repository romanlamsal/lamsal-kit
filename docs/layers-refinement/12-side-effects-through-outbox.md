# Side effects at third parties

**Status:** ready to draft, drafted with open question A · **Kind:** real gap · **Touches:**
Transactions (rule 1) · **Blocked by:** `open-questions.md` A (the same sentence needs its answer)

## Context

In `domain.md`, shop sends an order-confirmation mail after the order commits, and creates a
Stripe PaymentIntent during checkout.

## Problem

Rule 1 reads "Does it change data another system owns? → Outbox, required." An agent cannot tell
whether a sent mail or a created payment is "data another system owns". It sends the mail inside
the transaction (the mail goes out, the transaction rolls back), or sends it after commit with
nothing to retry a failure. It should write a message to its outbox in the transaction and let
the relay trigger the mail.

## Resolution

Name third parties' side effects in rule 1:

> 1. **Does it change data another system owns — a third party's included, such as a mail sent
>    or a payment created?** → **Outbox, required.**

That makes Stripe's `client_secret`, which checkout must return in the same request, impossible.
Open question A decides the exception; draft both into the same rule together.

## Grounding

- Cockburn, *Hexagonal Architecture*: "A secondary actor is one that the application drives,
  either to get answers from or to merely notify" — a mail provider is the same kind of actor as
  the database *(verified, https://alistair.cockburn.us/hexagonal-architecture/)*.
- Vernon, *IDDD* ch. 8: events are stored in the same transaction as the aggregate and published
  after commit; notifications are sent from them *(from memory)*.
- Khononov, *Learning DDD* ch. 9, Outbox (p. 171 per the Sharif library table of contents): the
  outbox exists because a commit and a publish cannot be made atomic *(from memory)*.

## Done when

Rule 1 and open question A's answer are drafted together and pass the four tests; the sweep
covers "The review checklist" question 5 and the outbox bullets; presented for approval.
