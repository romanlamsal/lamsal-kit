# The world

*Draft.* The foundation, with the glossary: what the world does to a system (forces) and what
holds anyway (properties). It names no mechanism and no rule. Any set of rules that delivers the
properties builds a repo alike in what holds; the general rules are one such set. A repo may
overrule one of them wherever the properties still hold. This document uses glossary terms only;
a term it needs enters the glossary first.

Pages marked pdf are PDF pages of the paged sources, the rest printed; all printed before this
settles.

## Scope

Code split into systems, each one bounded context (glossary: System), run as one or more
processes. Each system keeps its records in a store, and what a store commits survives any stop
of a process. Systems reach each other through calls and messages; some are external systems.

Out of scope: throughput and load, security, user interfaces.

## Forces

- **F1. What lies behind the ports changes.** A store, a mail provider, a framework is replaced;
  a new caller arrives: a CLI command, a webhook, a test.
- **F2. The business changes, and so does what is known of it.** Business rules change, the
  model grows, the cut between systems moves.
- **F3. Edits are partial.** People and agents change code having read only part of it.
- **F4. Processes stop and are replaced.** A process can stop between any two of its
  instructions: a crash, a deploy, a timeout. A deploy replaces processes one at a time, and
  records and messages outlive the code that wrote them.
- **F5. Delivery repeats and reorders.** A message can arrive more than once, a redelivery while
  the first attempt still runs, and after one sent later.
- **F6. Callers overlap.** Two use cases can run against the same records at once.
- **F7. Other systems fail.** Another system can be down, slow, or fail after it said yes.
- **F8. Other systems change.** Another system's model and published language change on its
  schedule, not this one's.
- **F9. External systems offer what they offer.** An external system holds none of these
  properties, and its contract follows its own model: "take it or leave it" (Khononov, pdf 79).

## Properties

### P1. The domain models the business domain, not what serves it

*Except:* another system's model this system chose to take (P12).
*Against:* F1.
*Why:* A tea shop sells tea whichever carrier delivers it. The business rules are why the system
exists and the costliest code to get wrong. Where a store, a framework or a carrier shapes the
domain, replacing one rewrites business rules nobody meant to change.
*Provenance:* Evans, Layered Architecture (pdf 53): "Concentrate all the code related to the
domain model in one layer and isolate it from the user interface, application, and
infrastructure code." Khononov, ports & adapters (pdf 152): the business logic layer "doesn't
depend on any of the system's infrastructural components."

### P2. A business rule lives in one place: the domain

*Against:* F2, F3.
*Why:* A business rule copied into a use case, an adapter or a test drifts at the first change;
an edit made where the reader looked leaves the copies wrong. A business rule anywhere else, in a
store trigger, a hook, a service, is one a reader of the domain misses and writes again.
*Provenance:* Evans, Layered Architecture (pdf 52): "When the domain related code is diffused
through this large amount of other code, it becomes extremely difficult to see and to reason
about. […] Changing business rules may require meticulous tracing of UI code, database code, or
other program elements."

### P3. Business rules that change together sit together; rules that change for different reasons share nothing either would have to change

*Against:* F2.
*Why:* A business change made across several systems needs all of them to change in step. A
billing change that reaches checkout through a shared `Order` edits code that had no reason to
change. Rules that change for the same reason and stand apart from the rest are also where a
system splits once the business domain is better known.
*Provenance:* Khononov (pdf 186): "Such changes that are not encapsulated in a single bounded
context signal ineffective design of the contexts' boundaries." Khononov (pdf 187): "Refactoring
logical boundaries is considerably less expensive than refactoring physical boundaries. Hence,
when designing bounded contexts, start with wider boundaries."

### P4. A use case responds the same whoever calls it and whatever serves it

*Against:* F1.
*Why:* A server function, a CLI command, a handler and a test reach one use case; a store and a
fake behind its driven ports serve one use case. Replacing either changes neither the use case
nor how it responds.
*Provenance:* Cockburn, Intent: "Allow an application to equally be driven by users, programs,
automated test or batch scripts, and to be developed and tested in isolation from its eventual
run-time devices and databases."

### P5. A system reaches the outside, and is reached from it, only through its ports; each port speaks the system's terms

*Against:* F1, F3, F8.
*Why:* An agent editing one file sees that file, not the architecture. Where everything the
system needs and offers passes a port, the ports tell all of it, and an edit that reaches past
them ties the system to something no port names. A port in the store's or the carrier's terms
tells nothing, and the meaning moves into the code behind it. Another system reading this one's
records past its ports breaks whenever the store or the records change.
*Provenance:* Cockburn, Intent: "The application is blissfully ignorant of the nature of the
input device." Cockburn: "The rule to obey is that code pertaining to the inside part should not
leak into the outside part." Cockburn: "A port identifies a purposeful conversation."

### P6. Every use case can run with nothing outside the process

*Against:* F1.
*Why:* A test needing a store, a network or another system is slow, flaky, and soon skipped.
What stands in for the outside behaves as the outside does wherever the use case can tell, or a
passing test proves nothing.
*Provenance:* Cockburn, Intent (P4): "tested in isolation from its eventual run-time devices and
databases."

### P7. A use case's writes to its own system's records land together or not at all

*Against:* F4.
*Why:* A process stopping between two writes leaves records no business rule allows: the order
placed, the cart still full. Nothing after can tell a half-done use case from an intended state.
*Provenance:* Khononov, Service Layer (pdf 148): the operation "orchestrates a database
transaction to ensure that a proper response is generated in case of an error."

### P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after

*Against:* F4.
*Why:* A message or a mail sent before the commit announces what may never happen; one sent after
it is lost to a stop in between. Either way someone acts on a world the records contradict. What
is asked of another system, or of this one, before the commit stays tentative, confirmed only
after it.
*Provenance:* Khononov, Outbox (pdf 171): "Both the updated aggregate's state and the new domain
events are committed in the same atomic transaction." Helland, Life beyond Distributed
Transactions: tentative operations.

### P9. A repeated delivery changes nothing in this system

*Against:* F5, F9.
*Why:* The stock reserved twice. Delivery repeats, so every handling tolerates a second arrival,
one overlapping the first included. Outside the system this may not hold: a mail provider may
send twice (F9). Where an effect outside can repeat, a business rule allows the repeat.
*Provenance:* Khononov (pdf 173): the outbox "guarantees delivery of the messages at least once".
EIP, Idempotent Receiver.

### P10. A use case commits only on reads that still hold, or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them

*Against:* F6.
*Why:* Two checkouts read a stock of one and both succeed; the later commit silently undoes the
earlier. A stale read is one a business rule accepts, with what happens meanwhile. Two checkouts
of different teas that fail each other were tied by the code, not the business.
*Provenance:* Evans p. 91, p. 97; Vernon EAD I p. 3; CWE-367. Vernon EAD I: "Failing all but
one of their requests on an ongoing basis is completely unacceptable. […] Nothing about planning
a new backlog item should logically interfere with scheduling a new release! […] the large
cluster aggregate was designed with false invariants in mind, not real business rules."

### P11. No other system changes a system's records

*Against:* F8.
*Why:* Where another system writes this one's records, this one's business rules stop holding
for them, and neither system can change its model without the other.
*Provenance:* Evans, Bounded Context (pdf 239): "Explicitly define the context within which a
model applies. […] Keep the model strictly consistent within these bounds".

### P12. Another system's model enters this one only by choice

*Against:* F8, F9.
*Why:* A system speaks its own language. Where another system's terms run through its domain
unnoticed, each change there is a change here, found late. Taking another's terms as they are is
as much a choice as translating them.
*Provenance:* Evans, Ubiquitous Language (pdf 26); Khononov (pdf 72): "ubiquitous language should
be consistent within the scope of its bounded context." Khononov (pdf 79): conformist,
anticorruption layer, open-host service.

### P13. A system changes its model without its downstream systems changing

*Against:* F8, seen from upstream.
*Why:* A downstream system that reads this one's model breaks at every refactoring here. The
published language holds still while the model moves.
*Provenance:* Khononov, Open-Host Service (pdf 81): "the freedom to evolve its implementation
without affecting the downstream contexts".

### P14. A record or a message means the same to all code that reads it, whenever it was written

*Against:* F4, F8.
*Why:* A deploy runs old and new code side by side, and records and messages outlive both. An
old process saves back a record the new code wrote and drops what it does not know; a message
waiting in an outbox meets code that reads it otherwise. All code includes processes still
running older code and the systems downstream.
*Provenance:* Helland, Data on the Outside versus Data on the Inside: "Stable data has an
unambiguous and unchanging interpretation across space and time. […] One excellent technique for
the creation of stable data is the use of time-stamping and/or versioning." Khononov (pdf 81):
the upstream can "simultaneously expose multiple versions of the published language, allowing
the consumer to migrate to the new version gradually".

### P15. A system works while others are down or slow, as far as its own data reaches

*Against:* F7.
*Why:* Where every use case calls another system, this one is down whenever any of them is. A
use case needing only data this system holds runs anyway; one needing another system now fails
visibly, and that is expected.
*Provenance:* Khononov, Event-carried state transfer (pdf 264): "the consumers can continue
functioning even if the producer is not available."

### P16. No transaction spans two systems

*Against:* F8.
*Why:* A transaction two systems share commits only where both systems' business rules and code
let it, so neither changes alone.
*Provenance:* Helland, Life beyond Distributed Transactions.

### P17. Work spanning systems ends, and only in a state a business rule allows

*Against:* F4, F7.
*Why:* Each system commits its own part (P16), so the outcomes can diverge: another system fails
after it said yes, or this one's commit fails after the other acted. Completing, undoing and
accepting the divergence are each something a business rule allows. What is ruled out is a half
no business rule allows, found by a customer. Work waiting on another system's answer is still a
state a customer finds.
*Provenance:* Khononov (pdf 271): saga and process manager for processes across bounded contexts
that need compensating actions. Helland, Life beyond Distributed Transactions: "Every tentative
operation eventually confirms or cancels."

### P18. The order messages arrive in does not change the outcome

*Against:* F5.
*Why:* A cancel handled before the order it cancels, then the order: stock stays reserved for a
dead order. Each message is handled against what the system already knows, whatever came first.
*Provenance:* Khononov (pdf 271): "Events will arrive out of order." Subscribers "identify and
reorder out-of-order messages."
