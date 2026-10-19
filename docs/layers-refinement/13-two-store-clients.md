# One system behind two store clients

**Status:** ready to draft · **Kind:** real gap · **Touches:** Preconditions; Transactions
(rule 3); Ports and factories (the transaction port)

## Context

In `domain.md`, shop writes Order through Drizzle and price and sku through Payload's Local API,
which keeps its own transactions. Both sit in the same Postgres, on different connections.

## Problem

The preconditions assume one store: "it assumes the store can apply several writes atomically".
Rule 3 then says one transaction by default. An agent wraps both writes in one `tx.run`; the
Payload write runs on its own connection and commits on its own. It should either make one
transaction port reach both, or treat the two as apart and use the outbox.

## Resolution

Extend the preconditions:

> Several store clients are one store only where one transaction port makes their writes atomic
> together; aggregates it cannot reach together are apart, and Transactions, rule 3 takes the
> outbox.

Fix the wording so "question 5" (the checklist) and "rule 3" (Transactions) cannot be confused.

## Grounding

- Vernon, *IDDD* ch. 10: modify one aggregate per transaction, with "lack of technical
  mechanisms" among the reasons the rule exists *(from memory)*.
- Khononov, *Learning DDD*: one aggregate per transaction by default *(from memory)*.
- Rule 3 already marks one transaction as "this document's choice" and allows the outbox: the
  books' default is the fallback.

## Done when

The clause passes the four tests; the sweep covers every "transaction" sentence in Terms,
Ports and factories and question 5; presented for approval.
