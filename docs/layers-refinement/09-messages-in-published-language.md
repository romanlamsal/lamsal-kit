# Messages missing from the published language

**Status:** ready

**Kind:** real gap · **Touches:** Other systems (the open host
service definition and its export list); Transactions (rules 1 and 2, the outbox bullets)

## Context

In `domain.md`, shop publishes `OrderPlaced` and `OrderPaid`; billing and fulfillment react.
Under orchestration, a process manager would send commands instead, asking another system to act.

## Problem

Transactions, rule 2 says "the owner publishes" and rule 1 sends messages through the outbox, but
the open host service exports only driving ports, their published language (what those ports
take, return and raise), and a builder. A message is neither a port's input nor its output. An
agent defines `OrderPaid`'s schema in each consumer, or has consumers import shop's internals.
It should export the schema with shop's published language.

## Resolution

Extend the open host service definition:

> **A system offers an open host service: its driving ports, and their *published language* — the
> schemas, types and errors those ports take, return and raise, and the messages the system
> publishes.**

The export list then needs no new entry: messages ride in "the published language".

Whose language a command belongs to follows already: the receiver handles it through a driving
adapter calling one service, so a command such as `ReserveStock` is the receiver's published
language and the sender conforms to it. Run the derivation test on that; add a clause only if it fails.

## Grounding

- Evans, *DDD* ch. 14: a published language is "a well-documented shared language that can
  express the necessary domain information as a common medium of communication", not limited to
  calls *(definition as summarized on Wikipedia; book wording from memory)*.
- Vernon, *IDDD* ch. 13: notifications are published in a published language (media types)
  *(from memory)*.
- Khononov, *Learning DDD* ch. 15 separates public events from private ones *(from memory; the
  chapter's table of contents confirms "Types of Events" and "Designing Event-Driven
  Integration", not the passage itself)*.

## Done when

The clause passes the four tests; the sweep finds no sentence that limits the published language
to port input and output (Terms, Other systems, the linter sentence "reach a system only
through these exports", question 8); presented for approval.
