# What may be held ambient

**Status:** closed (3aa71b4)

**Kind:** real gap (the rule exists; the mechanism defeats it
invisibly) · **Touches:** Ports and factories (the transaction port, "A per-request value may be
held ambient"); Transactions; questions 5 and 7

## Context

In `domain.md`, the common library holds the transaction port with an ambient unit of work in
`AsyncLocalStorage`. Every system imports it. Shop calls billing's open host service in-process
inside `tx.run`. The same store carries the request id for logs; OpenTelemetry keeps the trace
context in its own.

## Problem

Billing's repositories read the same ambient context, so they join shop's transaction. That
breaks "the transaction stays inside its system", and no diff shows it. The paragraph on ambient
values treated all of them alike, though a request id and a trace context should cross the
boundary and a transaction must not. It named no line between what may be ambient and what must
be passed.

## Resolution

Replace the per-request paragraph:

> **A value that influences nothing a use case or domain function decides may be held ambient** —
> Fowler's registry, scoped per request: a request id, a trace context, the locale a mail is
> rendered in, the user an audit column records until a rule decides by it. The transaction
> context is not one: what a read returns depends on it. Say which values are held ambient; the
> line is this document's choice.

Delete the transaction-port paragraph that made explicit or ambient context each codebase's
choice, "passed or ambient" in question 5, and question 7's two ambient sentences.

## Grounding

- Fowler, *Unit of Work*: it "keeps track of everything you do during a business transaction"
  *(verified, https://martinfowler.com/eaaCatalog/unitOfWork.html)*. One business transaction is
  one system's use case here.
- Fowler, *Registry*: "essentially a global object, or at least it looks like one" *(verified,
  https://martinfowler.com/eaaCatalog/registry.html)*. The catalog page does not discuss scope;
  the book's process-, thread- and session-scoped registries are from memory.
- Evans, *DDD* ch. 14 (final manuscript, April 2003), Bounded Context: "Integration across the
  boundaries necessarily will involve some translation, which you can analyze explicitly"
  (manuscript p. 239, Bounded Context; review 01 corrected the earlier p. 111) *(verified)*.
- Richardson, *Distributed tracing*: instrumentation "passes the external request id to all
  services that are involved in handling the request", possibly as part of a microservice chassis
  *(verified, https://microservices.io/patterns/observability/distributed-tracing.html)*.
- No source speaks to ambient context; the line is this document's choice.

## Done when

The clause passes the four tests; the sweep covers Terms, the transaction-port paragraph,
Transactions and questions 5 and 7; presented for approval.

## Decision

**Ambient holds what nothing is decided by.** Ambient values exist so that a request id reaches
every log line without a `requestId` argument on every port. The line between ambient and passed
is what decides: a value that influences nothing a use case or domain function decides may be
ambient; everything else is an argument. The same value can sit on either side: the user an audit
column records is ambient until a rule, such as four-eyes approval, decides by it. A mail's locale
is ambient: the renderer reads it, no rule does.

**The transaction context is passed.** It looks like plumbing, since no rule branches on it, but
what a read returns depends on it: its own uncommitted writes, its isolation level, and with
row-level security the tenant or user it carries. The paragraph names it, because the rule alone
hides this. Explicit context also settles the original problem: billing's driving port takes no
context, so shop's transaction cannot reach billing without a change to a signature.

**Nothing on crossing into another system.** By the rule, no decision depends on an ambient
value, so one that reaches another system in-process, or is lost out of process, changes nothing
there. Where the values live follows from what is already there: plumbing values in the common
library, a system's own values in that system outside its domain, since the common library holds
no model and the domain imports no runtime.

**Considered options**

- Correlation values cross, everything else stays (an earlier draft): draws the line by kind, not
  by use, and breaks on an ambient tenant, which one controller also puts in.
- No ambient text at all: brings back `requestId` on every port.
- The transaction as ambient, since rule 1 keeps writes to another system out of it: rejected,
  because what a read returns depends on it.
- The downstream system unsets and resets the caller's ambient values: it cannot know them, and
  per-system stores make it unnecessary.
- A question 7 tell for "a service that decides by an ambient value": derived from the paragraph,
  and not about building a dependency.
- Naming where each store is defined, or how a message carries the values: derived, or each
  codebase's mechanism.

**Consequences**

- `domain.md`'s common library, with an ambient unit of work, is now a case the document places as
  a fault.
- Question 7 lost its ambient-accessor tell: ambient context holds values, not implementations,
  and a repository falling back to its own transaction is question 5's tell.
