# An ambient transaction crosses into another system

**Status:** ready

**Kind:** real gap (the rule exists; the mechanism defeats it
invisibly) · **Touches:** Ports and factories (the transaction port, "A per-request value may be
held ambient"); Transactions; question 5

## Context

In `domain.md`, the common library holds the transaction port with an ambient unit of work in
`AsyncLocalStorage`. Every system imports it. Shop calls billing's open host service in-process
inside `tx.run`.

## Problem

Billing's repositories read the same ambient context, so they join shop's transaction. That
breaks "the transaction stays inside its system", and no diff shows it. The paragraph on ambient
values treats all of them alike, though a request id and a trace context should cross the
boundary and a transaction must not. An agent wires it this way and sees nothing wrong. It should
start a call into another system outside the caller's transaction.

## Resolution

Add to the per-request-value paragraph:

> An ambient transaction belongs to its system: a call into another system's open host service
> runs outside it. A value that is not a unit of work, such as a request id or a trace context,
> crosses.

Consider adding to question 5's "In a diff": a call into another system made inside the caller's
ambient transaction.

The derivation test bites here: "the transaction stays inside its system" already states the
rule. Argue in the change why a clause is still needed: the ambient choice makes the breach
invisible in a diff, which explicit context does not.

## Grounding

- Fowler, *Unit of Work*: it "keeps track of everything you do during a business transaction"
  *(verified, https://martinfowler.com/eaaCatalog/unitOfWork.html)*. One business transaction is
  one system's use case here.
- Fowler, *Registry*: "essentially a global object, or at least it looks like one" *(verified,
  https://martinfowler.com/eaaCatalog/registry.html)*. The catalog page does not discuss scope;
  the book's process-, thread- and session-scoped registries are from memory.

## Done when

The clause passes the four tests, with the derivation-test argument written down; the sweep
covers Terms, the transaction-port paragraph, Transactions and question 5; presented for
approval.
