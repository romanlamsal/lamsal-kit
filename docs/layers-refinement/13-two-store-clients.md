# One system behind two store clients

**Status:** closed (879dfc1)

**Kind:** real gap · **Touches:** Preconditions; Transactions
(items 1 and 3); question 5

## Context

In `domain.md`, shop writes Order through Drizzle and price and sku through Payload's Local API,
which keeps its own transactions. Both sit in the same Postgres, on different connections.

## Problem

The preconditions assume one store: "it assumes the store can apply several writes atomically".
Transactions, item 3 then says one transaction by default. An agent wraps both writes in one
`tx.run`; the Payload repository takes the context, ignores it, and commits on its own. It should
either make one transaction port reach both, or treat the two as apart and use the outbox.

## Resolution

Preconditions:

> Store clients are one store where one transaction port makes their writes atomic together; two
> clients of one database are two stores until one port reaches both, which is each codebase's
> choice. Where this document says *transaction*, it assumes the store can apply several writes
> atomically; where one cannot, question 5 ("Did one transaction quietly become several?") does
> not apply to it, and an aggregate's outgoing messages are embedded in its own record.

Transactions, item 1:

> Write a message to this system's outbox in the same transaction; a system writing several stores
> has an outbox in each it sends from.

Transactions, item 3:

> An outbox is also valid here, and required where no one transaction reaches them all, as for
> aggregates in different stores.

Question 5, "In a diff":

> a repository method that takes the context and writes without it

## Grounding

- Khononov, *Learning DDD* ch. 9, Outbox: the aggregate's state and its outgoing events commit in
  one atomic transaction; with a NoSQL database that lacks multi-document transactions, "the
  outgoing domain events have to be embedded in the aggregate's record" *(secondary summaries and
  a reader's highlight; not checked against the book)*.
- Vernon, *IDDD* ch. 10: one aggregate per transaction. "Lack of Technical Mechanisms" is one of
  his "Reasons to Break the Rules": with no messaging, timers or background threads, a team
  modifies several aggregates in one transaction *(verified against O'Reilly's preview)*. "Global
  Transactions" is another: a transaction across resources is a constraint, not a default.
- Fowler, *PoEAA*, Unit of Work: coordinates the writes of one business transaction against one
  database *(from memory)*.
- Richardson, *Microservices Patterns* ch. 4: sagas instead of distributed transactions (2PC/XA)
  *(from memory)*.
- Item 3 already marks one transaction as "this document's choice": the books' default is the
  fallback.

## Done when

The clause passes the four tests; the sweep covers every "transaction" sentence in Terms,
Ports and factories and question 5; presented for approval.

## Decision

**A store is what one transaction port makes atomic.** "The store" read as one per system, and
one database read as one store. Drawing the line by what the port does, not by database, client
or product, covers two databases, an ORM beside a raw driver and a product's API in one sentence.
A rule for products only (an aggregate stored in a product is always apart) was rejected: it draws
the line by kind and forbids the port reaching both. The term is this document's narrowing of
*store*; the books assume one transactional store behind the repositories.

**Reaching both is each codebase's choice.** In Teeladen, Payload's Postgres adapter is Drizzle:
the port can open Payload's transaction and hand its session to shop's repositories. No mechanism
is named, 2PC included.

**Across stores, the outbox is required.** Price is shop's aggregate stored in a product, so
item 1 (another system's data) does not apply; item 3 does, and its outbox becomes the only
choice. The clause is worded by property, "where no one transaction reaches them all", with
different stores as the example, so it also covers two aggregates in a store that writes one
record at a time.

**The message commits with the write that sends it.** Item 1's "this system's outbox" read as one
table; a price written through Payload with its message in the Drizzle outbox loses the message on
a crash. Hence an outbox in each store a system sends from, and, following Khononov, messages
embedded in the aggregate's record where a store cannot write two records atomically. The
embedding hint was tested against the repository row, the common-library relay and question 9;
it breaks none, as long as the relay reads a generic envelope.

**Question 5 gains the silent form.** A repository that takes the context and writes without it
looks correct in a diff; the new tell names it.

**Considered options**

- A products-only rule: rejected, see above.
- "Required for aggregates in different stores or where no one transaction reaches them all": the
  first half follows from the second; kept as an example instead.
- Ruling single-record stores out of scope: the hint costs one clause and breaks nothing.

**Consequences**

- Ticket 14 is the reach-both case from the hook's side: the hook writes shop's outbox in
  Payload's transaction only where shop's transaction port reaches it.
- The ticket's former grounding cited Vernon's "lack of technical mechanisms" as a reason the rule
  exists; it is a reason to break it.
