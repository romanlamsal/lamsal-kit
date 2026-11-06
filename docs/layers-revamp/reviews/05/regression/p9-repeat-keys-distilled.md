# Layers, distilled

The glossary, the world and the property rules. Read whole.

---

# Glossary

Definitions only, read as a whole. What a term may do is in the rules.

## Business domain

**Business domain.** A company's main area of activity. The domain models it.

**Business rule.** What the business domain allows, requires or forbids.

## System

A system is one bounded context. It is code with its own domain and its own glossary. A codebase may
hold several. Another bounded context is another system, even when it is imported in-process. A
module is of the system whose layer or offer it belongs to, wherever the codebase keeps it.

**Outside.** Other systems and third parties, the operating system among them, whether they
drive the system or it drives them.

**Tooling.** Code that runs in no process of the deployed application.

**Probe.** Code a process runs to report on itself rather than on a system.

## The layers

**Use case.** One goal a caller can reach through the system, and how the system responds. An
*acting* use case changes the system, or the outside through it, and may return what it did; an
*answering* one changes nothing. An *acting call* is a call to an acting use case.

- **Domain.** The model; it holds the business rules. It is pure.
- **Service.** The implementation of a driving port. What it holds is the sequence within its use
  case.
- **Driven adapters.** Implementations of driven ports.
- **Driving adapters.** Callers adapted to driving ports.

In DDD vocabulary, domain is the model, services make up the application layer, driving adapters are
the interface layer, driven adapters the infrastructure layer.

**Reach.** A module reaches what running it reads or calls and what it is typed by, however the
code got hold of it, and what those reach in turn. What it reaches through a port of its system
it reaches as the port, not as the code behind it.

**Pure.** A module is pure when calling it reaches nothing outside the process and it hands its
caller nothing the caller did not pass.

**Port.** An interface, never the code behind it.

- A *driven port* is a way out of the system.
- A *driving port* is the way in; a service implements it. It names one use case the system offers
  and what a caller must bring, in the system's terms, not its store's. It does not know how it is
  reached.
- Who starts the call decides which. Seen from the caller, this system's driving port lies
  behind one of the caller's driven ports.

**Adapter.** Code on the far side of a port.

- A *driven adapter* implements a driven port. A port may have several. Swapping one changes
  nothing on the system's side of the port.
- A *driving adapter* adapts one way in to the driving ports it calls, translating in both
  directions. There are as many driving adapters as there are ways into the process.

## Between systems

**Message.** What one system tells another, or itself, so that it may act. It has an id, the same on
every delivery of it. An *event* says something happened; no receiver can refuse it. A *command*
says do this, to the one system that offers it, which may refuse. *Published*: meant for other
systems. *Private*: meant only for the system that wrote it.

**Outbox.** Where a system's outgoing messages wait until they are delivered. The *outbox port* is
the driven port a service writes messages through. The *outbox reader* is what the relay reads the
outbox through, and marks it by; the system provides it, and for an external system's outbox,
assembly does.

**Handler.** A driving adapter that acts on messages delivered to its system.

**Bus.** What delivers a message to the handlers subscribed to it. Assembly hands it the handlers.

**Relay.** The mechanism that reads outboxes and hands each message to the bus. Assembly hands it
the outbox readers.

**Idempotent.** An operation is idempotent when repeating it leaves its system's records as
performing it once left them, and answers as the first did.

**Tentative operation.** A commitment one aggregate asks of another aggregate or another system, by
a message or a call, that leaves open its cancellation. The asker holds the right to cancel:
releasing it confirms, using it cancels; every one eventually confirms or cancels.

**Open host service.** The driving ports a system offers to other systems.

**Published language.** What another system needs to talk to this one, or to translate from it:
the schemas, types and errors its open host service's driving ports take, return and raise, the
events it publishes, and the commands it takes from other systems.

**Offer.** What a system makes public for code of this codebase outside it: its published
language, the driving port types of its open host service and their fakes, and its system
builders.

**Reconciliation.** A use case that compares, after the fact, what this system recorded with what
another system holds, and repairs this system's record, or starts the step that repairs the
other's.

**Saga.** A sequence of local transactions across systems that either all commit or, when one is
refused, ends in new ones that undo, in business terms, those already committed.

**Choreography.** Work spanning systems where each system reacts to the others' events and decides
its own next step; no system holds the whole sequence.

**Orchestration.** Work spanning systems where one system holds the sequence and tells the others by
commands which step to take.

## Other systems

**Upstream system.** Of two systems that talk, the one whose published language the other depends
on, for a given call or message: it offers the open host service the other calls, takes the commands
the other sends, publishes the events the other handles. It changes on its own terms. Two systems
may each be upstream of the other, for different calls or messages.

**Downstream system.** The one that depends on the upstream's published language and adapts to its
changes.

**Conformist.** A downstream system that takes the upstream as it is: its ports become the
downstream's driven ports and its published language is used untranslated, in any layer including
the domain.

**Anti-corruption layer.** In a downstream system, the layer that translates between the upstream's
published language and the system's own terms; the upstream's terms stop at it.

**Shared kernel.** A part of the domain model that several systems of this codebase share as code
and agree on together; it belongs to each of them, each importing it into its domain. A change to it
is a change to each.

**Hook.** A driving adapter an external system calls.

**External system.** A bounded context whose code this codebase does not write, though it may
configure it: bought or adopted, run by its vendor or by us, in its own process or in ours. Business
rules its configuration holds are its own, in its terms, even where this codebase writes them; its
architecture stays its own. It is driven through its API and driving through its hooks.

## Domain

**Aggregate.** A cluster of records changed as one unit and addressed by one id; a repository loads
and saves it whole.

**Owner.** The system whose business rules decide what a record holds, wherever it is kept; of a
record no business rule decides, the system that keeps it. A store may keep records of several
owners. A replica's records are its keeper's; what they copy stays the owner's to decide.

**Specification.** A domain function that answers yes or no about one candidate.

**Repository.** Access to the aggregates of one type: it loads, saves and finds them whole. The
*repository port* is a driven port; a *repository adapter* is a driven adapter implementing it.

**Snapshot.** A value an aggregate copies when a use case needs it, projected into this system's
terms, and keeps unchanged as its own fact from then on.

**Replica.** A copy of another system's data, kept under the owner's ids and projected into this
system's terms. It is refreshed from what the owner publishes or
returns to it, and lags the owner.

## Driven adapters

**Record.** What a store holds and a write changes.

**Transaction.** A group of reads and writes that commits whole or not at all. Until it commits,
none of its writes is seen outside it.

**Store.** What keeps records such that one transaction can carry writes to any of them. Two clients
are one store when one transaction can carry the writes of both, two stores until it can.

## Driving adapters

**Scheduled task.** A driving adapter the clock calls.

**Ambient value.** A value a function reads without receiving it as an argument. Two scopes: per
process, set once for the process's life; per request, what the current request carries.

**Courier.** How a driving adapter reaches what assembly produced when assembly cannot hand it over
as an argument.

## Assembly

**Factory.** A function that takes what an implementation needs and returns the implementation,
typed by its port: a service's factory returns a driving port's, a driven adapter's a driven port's.

**System builder.** The part of assembly a system provides, so that a process's assembly builds
what it needs of the system without knowing its internals or their defaults: it takes
configuration and what the process holds once, builds its system's own from them, and returns
what assembly hands on. A system may have several, and one may return one thing or many.

**Assembly.** The one place in a process where every port gets its implementation, and the only
place where port and implementation meet. It calls the system builders and produces what the
process's driving adapters call into.

**Configuration value.** A value a process is given when it starts and keeps for its life, which
no record holds.

**Common library.** A package of this codebase that belongs to no system, written for every
system to import.

## Tests

**Double.** What a test puts in place of something the code under test reaches; a fake is one
that works.

**Fake.** A working implementation of a port that reaches nothing outside the process.

**Integration test.** A test that uses a real external dependency running where the test runs.

**End-to-end test.** A test that uses a real external dependency running elsewhere.

**Default suite.** The tests run by default: every test that is neither an integration test nor an
end-to-end test.

---

# The world

The foundation, with the glossary: what the world does to a system (forces) and what
holds anyway (properties). It names no mechanism and no rule. Any set of rules that delivers the
properties builds a repo alike in what holds; the property rules are one such set. A repo may
overrule one of them wherever the properties still hold. This document uses glossary terms only;
a term it needs enters the glossary first.

Books are cited by printed page.

## Scope

Code split into systems, each one bounded context (glossary: System), run as one or more
processes. Each system keeps its records in a store, and what a store commits survives any stop
of a process. Systems reach each other through calls and messages; some are external systems.

Out of scope: throughput and load, security, user interfaces.

## Forces

- **F1. What lies behind the ports changes.** What serves a port is replaced; a new caller
  arrives.
- **F2. The business changes, and so does what is known of it.** Business rules change and the
  model grows. Subdomains are found and systems are designed (Khononov), so today's cut between
  systems is a guess that a better-known domain moves.
- **F3. Edits are partial.** People and agents change code having read only part of it.
- **F4. Processes stop and are replaced.** A process can stop between any two of its
  instructions. A deploy replaces processes one at a time, and
  records and messages outlive the code that wrote them.
- **F5. Delivery repeats and reorders.** A message or a call can arrive more than once, a redelivery
  or a retry while the first attempt still runs, and a message after one sent later.
- **F6. Callers overlap.** Two use cases can run against the same records at once.
- **F7. Other systems fail.** Another system can be down, slow, or fail after it said yes.
- **F8. Other systems change.** Another system's model and published language change on its
  schedule, not this one's.
- **F9. External systems offer what they offer.** An external system holds none of these
  properties, and its contract follows its own model: "take it or leave it" (Khononov p. 53).

## Properties

### P1. The domain models the business domain and is shaped by nothing that serves it

*Except:* the terms of an upstream this system conforms to (P12); its business rules stay its own,
written in those terms.
*Against:* F1.
*Why:* A tea shop sells tea whichever carrier delivers it. The business rules are why the system
exists and the costliest code to get wrong. Shaped by a store, a framework or a carrier, the
domain changes when one is replaced, and business rules nobody meant to change are rewritten. A
conformist takes its upstream's terms, not its upstream's business rules: a domain that is the
vendor's model with nothing of its own has no business rules left to protect.
*Provenance:* Evans, Layered Architecture (p. 53): "Concentrate all the code related to the
domain model in one layer and isolate it from the user interface, application, and
infrastructure code." Khononov, ports & adapters (p. 126): the business logic layer "doesn't
depend on any of the system's infrastructural components."

### P2. A business rule lives in one place: the domain

*Against:* F2, F3.
*Why:* A business rule copied into a use case, an adapter or a test drifts at the first change;
an edit made where the reader looked leaves the copies wrong. A business rule anywhere else, in a
store trigger, a hook, a service, is one a reader of the domain misses and writes again.
*Provenance:* Evans, Layered Architecture (p. 52): "When the domain related code is diffused
through this large amount of other code, it becomes extremely difficult to see and to reason
about. […] Changing business rules may require meticulous tracing of UI code, database code, or
other program elements."

### P3. Business rules that change together sit together; rules that change for different reasons stay apart

*Against:* F2.
*Why:* A business change made across several systems needs all of them to change in step. A
billing change that reaches checkout through a shared `Order` edits code that had no reason to
change. Rules that change for the same reason and stand apart from the rest are also where a
system splits once the business domain is better known.
*Provenance:* Khononov (p. 160): "Such changes that are not encapsulated in a single bounded
context signal ineffective design of the contexts' boundaries." Khononov (p. 161): "Refactoring
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

### P5. A system reaches the outside, and is reached from it, only through ports assembly hands it; each port speaks the system's terms

*Except:* the outside reached through code of the common library that a service or an adapter
calls, where its output changes neither how a use case acts nor what it answers.
*Against:* F1, F3, F8.
*Why:* An agent editing one file sees that file, not the architecture. Where everything the
system needs and offers passes a port, the ports tell all of it, and an edit that reaches past
them ties the system to something no port names. A port the system finds for itself, read from a
registry, is in no signature, and what serves it changes where nobody looks. A port in the
store's or the carrier's terms tells nothing, and the meaning moves into the code behind it.
*Provenance:* Cockburn, Intent: "The application is blissfully ignorant of the nature of the
input device." Cockburn: "The rule to obey is that code pertaining to the inside part should not
leak into the outside part." Cockburn: "A port identifies a purposeful conversation."

### P6. Every use case can run with nothing outside the process, in a test

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
*Provenance:* Khononov, Service Layer (p. 122): the operation "orchestrates a database
transaction to ensure that a proper response is generated in case of an error."

### P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after

*Against:* F4.
*Why:* A message or a mail sent before the commit announces what may never happen; one sent after it
is lost to a stop in between. Either way someone acts on a world the records contradict. Nothing is
asked of another system before the commit; what is asked after it is asked from what the commit
left, so a stop in between loses nothing.
*Provenance:* Khononov, Outbox (p. 145): "Both the updated aggregate's state and the new domain
events are committed in the same atomic transaction." Helland, Life beyond Distributed
Transactions: tentative operations.

### P9. A repeated delivery or call changes no record of this system, and succeeds where the first did

*Except:* a repeat that nothing it carries or left tells from a new request, where a business rule
allows what follows from it.
*Against:* F5, F9.
*Why:* The stock reserved twice. Delivery repeats, and so does a call whose caller stopped or timed
out not knowing whether it went through, so every handling tolerates a second arrival, one
overlapping the first included. A repeat that fails where the first succeeded, the order already
paid, is delivered again and again until it parks, for a change already made. Outside the system
this may not hold: a mail provider may send twice (F9). Where an effect outside can repeat, a
business rule allows the repeat.
*Provenance:* Khononov (p. 147): the outbox "guarantees delivery of the messages at least once".
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

### P11. No other system changes the records a system owns, or reads them except through its published language

*Against:* F8.
*Why:* Where another system writes the records this one owns, this one's business rules stop
holding for them, and neither system can change its model without the other. A system that reads
them past the owner's published language breaks at the owner's next schema change, and the
owner's business rules, which decide what a record means, are bypassed.
*Provenance:* Evans, Bounded Context (p. 239): "Explicitly define the context within which a
model applies. […] Keep the model strictly consistent within these bounds".

### P12. Another system's model enters this one only by choice

*Against:* F8, F9.
*Why:* A system speaks its own language. Where another system's terms run through its domain
unnoticed, each change there is a change here, found late. Taking another's terms as they are is
as much a choice as translating them.
*Provenance:* Evans, Ubiquitous Language (p. 26); Khononov (p. 46): "ubiquitous language should
be consistent within the scope of its bounded context." Khononov (p. 53): conformist,
anticorruption layer, open-host service.

### P13. A system changes its model without its downstream systems changing

*Against:* F8, seen from upstream.
*Why:* A downstream system that reads this one's model breaks at every refactoring here. The
published language holds still while the model moves.
*Provenance:* Khononov, Open-Host Service (p. 55): "the freedom to evolve its implementation
without affecting the downstream contexts".

### P14. A record or a message means the same to all code that reads it, whenever it was written

*Against:* F4, F8.
*Why:* A deploy runs old and new code side by side, and records and messages outlive both. An
old process saves back a record the new code wrote and drops what it does not know; a message
waiting in an outbox meets code that reads it otherwise. All code includes processes still
running older code and the systems downstream.
*Provenance:* Helland, Data on the Outside versus Data on the Inside: "Stable data has an
unambiguous and unchanging interpretation across space and time. […] One excellent technique for
the creation of stable data is the use of time-stamping and/or versioning." Khononov (p. 55):
the upstream can "simultaneously expose multiple versions of the published language, allowing
the consumer to migrate to the new version gradually".

### P15. A use case works while other systems are down or slow, unless a business rule needs another system's answer now

*Against:* F7.
*Why:* Where every use case calls another system, this one is down whenever any of them is. A
use case needing only data this system keeps, replicas included, runs anyway. One whose business
rule needs another system's answer now fails visibly, and that is expected: the customer pays
now, so the payment provider is asked now.
*Provenance:* Khononov, Event-carried state transfer (p. 238): "the consumers can continue
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
no business rule allows, found by a customer. Waiting on another system's answer is a state too,
and it ends like any other: in one a business rule allows.
*Provenance:* Khononov (p. 245): saga and process manager for processes across bounded contexts
that need compensating actions. Helland, Life beyond Distributed Transactions: "Every tentative
operation eventually confirms or cancels."

### P18. The order messages arrive in does not change the outcome

*Against:* F5.
*Why:* A cancel handled before the order it cancels, then the order: stock stays reserved for a
dead order. Each message is handled against what the system already knows, whatever came first.
*Provenance:* Khononov (p. 245): "Events will arrive out of order." Subscribers "identify and
reorder out-of-order messages."

### P19. Within one system, each term has one meaning

*Against:* F2, F3.
*Why:* "Order" meaning checkout's order in one module and billing's invoiceable order in the next
is two models in one system: a change made for one meaning breaks code written for the other, and
a reader of one module takes the meaning it found there for the system's. Renaming one, or
splitting the system, ends it.
*Provenance:* Khononov (p. 46): "ubiquitous language should be consistent within the scope of its
bounded context." Evans, Bounded Context (p. 239): "Keep the model strictly consistent within
these bounds".

---

# Property rules

*Draft.* One rule per property of `the-world.md`, written to be read whole: Scope and Statement are
the rule, the Why is its reasoning, and the reader is an agent that reads all three. The glossary's
terms, as spelled. Where a property needs nothing a reader could breach, the entry says so.
Conventions at the end are taste, no property behind them.

## Assumptions

This document assumes a store that can be read and written, that can apply several writes atomically
where it says *transaction*, and that can make a write fail where the record has changed since it
was read, or where a record with the same key exists. It assumes no isolation between transactions
beyond reading committed writes: a transaction may read what another commits while it runs.

It also assumes the clock can start a use case once a moment has passed: a message held back until
then, or a sweep run on the clock. Which one is the architecture's. Either can come late, never
early.

Every system gets the same architecture: domain, services, repositories and adapters, a simple one
too. That is this document's choice. The sources pick the architecture per subdomain and let simple
logic read and write the store directly; here no system is judged simple enough, and none is
rewritten when it grows business rules.

Not everything gets a layer. Assembly, a system's offer and the common library sit outside the
layers. So do probes.

Tooling sits outside the layers and the rules. It builds systems through their builders or replaces
their internals. What it reaches past the offer a system changes without notice.

An external system sits outside the rules: its exports, its layers and its transactions are its own,
even where this codebase writes its configuration. What a system of this codebase does with it is
inside them: the adapters that call it, the hooks it calls, and the parts of its configuration that
touch the system: what may change the system's records it keeps (P11), how it tells the system of a
change (P8), what it reads of the system's records (P11). Where a rule says a system of this
codebase, an external system is not one. Where a rule names an open host service or a published
language and the system is external, its API is the open host service, and what that API and the
messages it writes are typed by, the types generated from this codebase's configuration of it
included, the published language.

Not covered, and the codebase's: where UI code goes; library, framework and file-naming conventions;
whether a module that straddles two layers should be split now; how a driving adapter is tested, and
when the integration suite runs; how the bus finds a message's handlers, by its type or by each
handler filtering; how telemetry crosses a message, a trace context on the envelope.

## Rules

### P1. The domain models the business domain and is shaped by nothing that serves it

*Scope:* a module of a system's domain reaches code that is not of that domain.
*Statement:* A module of the domain MUST reach only its domain, a shared kernel imported into it
included, the published language of an upstream its system conforms to, or pure code of no system.
That pure code MUST be in no terms of the outside and MUST load on every runtime of the language.
*Why:* What serves the domain is the outside and the code that speaks to it: the store and its
client, the framework that calls in, the carrier and its SDK, the runtime the process runs on.
Each is replaced on its own schedule (F1). A domain that reaches one is shaped by it: an `Order`
typed by the store client's row type changes shape when the store is swapped, a `Shipment` typed
by the 3PL's consignment is rewritten when the tea shop changes carrier, and business rules
nobody meant to change are edited in the same diff. The mechanism is a closed list of what the
domain may reach. A reach of a kind the list does not name is refused, not left open: the list
is where the question is asked, not a sample of answers.

Reach is the glossary's: what running a module reads or calls, what it is typed by, and what
those reach in turn. So `import type` counts, bringing the store's terms in with nothing running;
and what a listed module itself reaches counts as the domain's reach, so a listed module is no
door to an unlisted one.

The third item carries three tests, each closing one way in.
- Pure (glossary). A store client, an HTTP client, a mailer SDK and `node:fs` reach outside the
  process. The clock, an id generator and an ambient value hand back what no caller passed. So
  the domain takes the time and its ids as arguments; how the service comes by them is P5's.
- In no terms of the outside. Pure is not enough: a store library's table builder, an ORM's
  decorators, a framework's request type run nothing outside the process and still write the
  store's or the framework's terms into the model. The framework is the outside too, a third
  party that drives the system (glossary: Outside). A validation library, a date library, a
  decimal library take arguments, return, and name nothing outside: they pass, and the domain's
  schemas are written with them.
- Loads on every runtime of the language. `node:path` is pure and exists on one runtime; so do
  `Buffer`, `process`, `window` and the DOM. The runtime serves the domain as the store does,
  and a new caller arrives where it differs (F1): a browser rendering a form from the domain's
  schema, an edge runtime serving a route. A domain that loads on one runtime fails to load
  there, or drags the server's client into the bundle. The service
  and the adapters are not held to this: they run where assembly runs them.

"Of no system" keeps out every system's code: another system's domain, this system's services,
adapters and assembly, and this system's own published language. The last serves the open host
service, shaped for downstream systems and held still for them (P13 delivers this); a domain typed
by it changes when what the contract serves changes, or freezes with it. What an external system's
API is typed by is its published language (Assumptions), so it is a system's code too. Which other
system's model may enter at all is P12's; this rule says only where a model chosen by conforming may
enter the domain.

Four cases, and how the Statement covers them:
- A store's row type in the domain is refused by the Statement's "in no terms of the outside".
- The common library. Its modules are judged as any library's: its logger reaches outside the
  process and a courier kept there hands the domain a value no caller passed, so both fail purity; a
  pure helper in no terms of the outside passes, as a validation library does. It holds no model, so
  passing it brings in none.
- A shared kernel is part of the model, agreed with the systems that share it, not something that
  serves the domain: `Money` in an `Order`. A `Money` that imports the common library's logger to
  report a rounding, is the domain reaching the logger through the kernel: refused here, in
  whichever module the import was written. What a kernel or a published language may reach for its
  other importers, a downstream's adapter or a browser, is not P1's.
- The conformist, P1's one exception. Its domain is written in its upstream's terms (glossary:
  Conformist): its business rules take the upstream's schemas as arguments, imported from the
  upstream's export path; a schema restated beside them is a second declaration drifting on the
  upstream's schedule. Its business rules stay its own, written in those terms. What that export
  path loads is reached too: a path that loads the upstream's services beside its published
  language makes the conformist's import a breach here. Where the upstream is an external system,
  the domain is typed by its package's types; a call through the package reaches the outside and
  fails purity.

That the domain holds the business rules and each term has one meaning is the glossary's
definition of the domain kept by P2 and P19; this rule keeps what is not the business domain out.
*Provenance:* The direction follows Evans, Layered Architecture (p. 53), Khononov p. 77 (the model
"devoid of any infrastructural or technological concerns") and p. 126, MS ("the domain model layer
must not directly depend on any infrastructure framework"), Evans Reference p. 10 and Garrido §3
("Hexagon depends on nothing, maybe just on utilities"). The shared kernel follows Evans p. 251 and
Khononov p. 51 ("Ideally, the shared kernel will consist only of integration contracts and data
structures"). The list, the runtime test and the outside's-terms test are this document's. Departs:
Martin (The Dependency Rule) keeps an outer circle's data formats out of an inner one, against the
conformist's import. Against: Khononov p. 70 couples active records to the ORM for simple
subdomains; this document picks one architecture for every system (Assumptions).

### P2. A business rule lives in one place: the domain

*Scope:* code of this codebase states a business rule of a system, or needs what one decides.
*Statement:* A business rule of a system MUST be stated once, in its domain or in a shared kernel
that domain imports, with every value it decides by that is the same for every candidate and that no
record holds. Code anywhere else that needs what it decides MUST get it from that statement,
directly or through the system, and MUST NOT state it again.
*Why:* A business rule stated twice is two rules the first time it changes. The edit lands where
its author looked, an agent having read one file (F3), and the other statement stays; the system
then decides one way through one path and another way through the next, and nothing fails,
because each statement is consistent with itself. A statement outside the domain is the one a
reader of the domain misses, and writes a third time. The glossary puts the business rules in the
domain, so the domain is where a reader looks; this rule makes what the reader finds there the
only statement, and makes everything else derive from it instead of copying it.

Deriving, inside the system, is calling or parsing. A driving adapter parses its caller's input
with the domain's schema and asks the domain's specification about it; a driven adapter parses
what the store returns with the same schema; a service asks the domain for the rate instead of
computing it; a client-side optimistic update builds its value with the domain's constructor, the
domain loading in the browser (P1 delivers this). The reach lists that let each layer import the
domain are P5's. For a record's shape, the one statement that serves both the type and the parse
is a schema: it checks at runtime, so code outside the domain can parse with it, and the type is
inferred from it. A changed field then fails to compile in every builder at once, and a changed
rate reaches every caller with the next deploy. Deriving, outside the system, is asking: another
system gets what the rule decided through the system's offer or its published events (P11 and
P13 deliver how) and does not work it out itself. Shop putting `reserveUntil` on `ReserveStock`,
fulfillment's reservation deadline computed in shop, states fulfillment's rule in shop's code.

A statement is code the system decides by: its verdict, its value or its shape is what the
system acts on, so leaving it behind when the rule changes leaves the system deciding two ways.
A rate computed in a service, a condition in a server action, a check in a hook, a trigger or a
check constraint in the store, a validator in a driving adapter beside the domain's schema, a
type declared beside that schema, a second constructor in client code, a second function in the
domain itself: each is a statement, and each is refused, the last by "once".

The values a rule decides by are part of it: the payment deadline's minutes, the VAT rate, the
number of reminders before dunning. Read from the environment, the number is a statement in no
module a reader of the domain opens, and since a configuration value is a process's for its life,
the old image and the new one of one deployment give two orders placed in the same second
deadlines apart. What the business wants to change at runtime is a record, changed by a use case
and read by the rule like any other record, the same in every process. A configuration value is
held by no record (glossary), so the Statement refuses it without naming it. What a process needs
to run, a key, a URL, a pool size, decides no business rule and is outside the Scope. The
candidate's own data, the order's total, is what the rule decides about, not part of the rule.

A test's assertion is one example, checked against the statement on every run: when the rule
changes, it fails, and so it cannot drift unseen. A double of a domain module is the rule copied
into the test, which every test using it decides by and which is checked against nothing: the
test passes on the double's answer after the real function's answer has changed. The domain is
pure, fast and deterministic, so the double buys nothing. The fakes a service's test is handed
stand in for driven ports, not for the domain.

Three things look like second statements and are not. The published language may constrain what
crosses in its own terms where a business rule says the same: `quantity` positive in the schema that
takes an order line. That constraint is the contract's, not the business rule's: when the domain
comes to allow a zero quantity, the contract rightly keeps refusing it until it changes on its own
terms (P13 and P14 deliver this), and the service translating between the two is where the
difference shows. Leaving it behind is no error, so it is no statement of the rule. This holds for
the published language alone: a driving adapter that restates the domain's schema is no contract and
states the rule again. Second, a key the store enforces: the store fails a write where a record with
the same key exists (Assumptions), and a new aggregate's save failing where one exists stands on it
(P10 delivers this). The domain states the key as part of the shape; the store refuses a duplicate
when two use cases race past the domain's check, and decides nothing the domain's statement does
not; the adapter keeps it in step as it keeps every column, and its test against the store set up as
production sets it up finds the store that disagrees (P6 delivers this). A condition the store
checks beyond the key, a check constraint, a trigger, decides, and is refused. A trigger that only
raises a version decides nothing the business allows, and states no business rule (P18). Third, an
external system's configuration: the business rules it holds are the external system's own where
they decide a record the external system keeps and no business rule of this system decides. A rule
about a record this system's business rules decide, written into the external system's field
validation, is this system's rule stated outside its domain. Where the rule that decides a record
needs another system's data, the owner asks for it: the timetable may not retire a flight an open
booking carries, so it asks bookings whether open bookings carry the flight; bookings answers about
its own bookings, and the timetable's rule decides the retirement, accepting the answer stale (P10).
Being asked makes bookings no owner of the flight: its answer is about its own records, and an
answer that decided the flight's record would be a second owner's rule, which P3 refuses. A system
that takes a write the owner's rule decides, in a hook of the owner, is one of the owner's ways in.
A system asked only to protect records of its own decides nothing about the record written: it
copies what it needs and is not asked. Who may change such a record is P11's.

A shared kernel holds the rules several systems agree on, stated once and imported into each
domain; a change to it is a change to each (glossary). Which rules belong there is P3's. The
common library is no domain, so it holds no business rule; that it holds no schema and no
aggregate either is P3's. A conformist states its business rules in its upstream's terms, still
in its own domain (P1 and P12 deliver this).

Not ruled here is where a decision is enforced and on what state. A driving adapter that asks
the domain's specification states nothing again, yet guards one way in; the acting service
enforcing the decision on every call, on state that still holds, is P4's and P10's. A handler
that decides again on a later state applies the rule twice, not states it twice; P8 delivers
that. Rules elsewhere say a business rule decides what follows, what is accepted as stale, or
when waiting ends; that such a rule is written in the domain is this rule, what it decides is
theirs. A message's shape is no business rule; one schema per message is P14's.
*Provenance:* Follows Evans p. 52–53 (business rules "diffused through" other code are changed
by tracing all of it; the domain layer is "responsible for representing [...] business rules";
the application layer "does not contain business rules or knowledge"), MS ("all the domain logic
should be contained in the domain classes [...] but not within the command handler"), Evans p. 160
(without a specification "the same rule may show up in different guises"), Khononov p. 80
(validation resides in the value objects) and MS (Two-step validation: "you do not duplicate the
validation definition"). The real domain module in tests follows Google SWE ch. 13 ("A real
implementation is preferred if it is fast, deterministic, and has simple dependencies") and
Fowler (Mocks Aren't Stubs, the classical style); the MUST is this document's strengthening of
that preference. The published language's own constraint follows Evans p. 278 ("do not equate
the interchange language and the model of the host"). The shape as a schema, the line against
configuration values, the store's key and the external system's configuration are this
document's; no source rules on them. Departs: MS validates fields on command DTOs and in
ViewModels beside the domain's own; this rule keeps that at the published language's edge only.

### P3. Business rules that change together sit together; rules that change for different reasons stay apart

*Scope:* a business rule is stated anywhere in this codebase, a shared kernel and the common
library included.
*Statement:* A business rule that decides what a record holds MUST be stated in the domain of the
record's owner. A shared kernel MUST hold no such rule and no record's schema, only values and what
computes values from arguments.
*Why:* The harm is a business change that has to be made in code that does not know it belongs to
it, or a change made for one system's reason that lands in another. Two routes lead there. One is a
rule stated in the wrong system: fulfillment's reservation holds stock for thirty minutes, and shop
works out `reserveUntil` as now plus thirty; the warehouse wants an hour, the change is
fulfillment's, the code is shop's, and a reader of fulfillment's domain never finds it. The other is
a model several systems share: an `Order` in a shared kernel or the common library whose status
rules serve checkout and billing alike, so billing's next invoicing change edits checkout's order
and breaks checkout's tests. The mechanism groups by record. The rules that decide what one record
holds change together, since a change to what the record means touches each of them; the owner is
the one system whose business rules those are (glossary: Owner), so stating every one in its domain
puts them together, and P2 delivers that within that domain each is stated once. Owner is singular:
two systems' rules deciding one record is the breach, whichever system keeps it. Rules about records
of different owners change for different reasons and land in different domains. Another system takes
part in a record's rules only as input: it asks, the owner decides, a command may be refused
(glossary: Message), and what it asks is decided by its own rules about its own request. So the line
between shop's rule and fulfillment's runs through what fulfillment's command takes: where
fulfillment holds stock until the time asked, the hold time is shop's to ask, decided by shop's rule
about shop's request; where fulfillment holds for thirty minutes, `reserveUntil` computed in shop is
fulfillment's rule stated in shop. A rule decides what a record holds when it is about that record:
`Money`'s rounding is about any amount and reaches a record only through the owner's rule that calls
it. A rule that decides no record, what an answering use case answers, is of the system whose use
case it is, and P2 delivers its place. A shared kernel is imported into several domains, and a
change to it is a change to each (glossary): values and what computes them from arguments, `Money`
and its rounding, change when the value's meaning changes, which every importer shares; a rule about
a record changes when that record's owner's business changes, which the other importers do not
share. So the kernel holds none, a record's schema included, since a schema is the rule about a
record's shape, and offers the values the owners' rules decide by. The common library belongs to no
system and is written for every system to import (glossary): a business rule there is in no system's
domain, and a change made for one system's reason reaches all of them; a value several systems share
goes to a shared kernel they agree on. The envelope the relay and the bus carry is the common
library's and holds no system's shape, so no business rule. Left to others: a published language
that states a constraint the domain also states is the contract's own statement, two by design, and
P2 and P13 deliver whether it may; a replica's record holds what its owner's rules decided, the
keeper deciding which copy it keeps, never a value the owner did not decide (glossary: Replica).
Business rules about a record an external system keeps for this system are this system's, in its
domain; one in the external system's configuration about such a record is a second statement, and
one about a record the external system owns is the external system's own. A conformist states its
own rules in its upstream's terms (P1's Except); the upstream's rules about the upstream's records
stay upstream. Rules that change together and stand apart from the rest, gathered under one owner,
show where a system splits once the business domain is better known; splitting a system where one
term comes to mean two things: P19 delivers this. Which records form one aggregate within a system:
P10 delivers this.
*Provenance:* Grouping by bounded context follows Khononov p. 160 (changes "not encapsulated in a
single bounded context signal ineffective design") and p. 161 (start with wider boundaries). The
owner's logic alone deciding its data follows Helland 2005 §1.3. The common library follows MS
(share only "final application blocks, like the Event Bus client API", no common domain model) and
Evans p. 244 ("Code reuse between BOUNDED CONTEXTS is a hazard to be avoided"). The kernel follows
Evans p. 251 and Khononov p. 51–52 ("a pragmatic exception"); values only follows Khononov p. 51
("Ideally, the shared kernel will consist only of integration contracts and data structures").
Departs: Evans p. 251 shares "the subset of code or of the database design" with the model, where
the kernel here holds no record's schema; Martin's entities may serve many applications. Placing a
record's rules by its owner is this document's.

### P4. A use case responds the same whoever calls it and whatever serves it

*Scope:* a use case runs, whichever driving adapter calls its driving port and whichever code
behind its driven ports serves it.
*Statement:* How a use case acts and what it answers MUST be decided by its service and its domain
from the arguments its driving port takes and what its driven ports return, and an ambient value or
a configuration value MUST NOT change either, whether the service reads it or code behind a port
does. A driving adapter MUST reach the system only through its driving ports, with at most one
acting call per call or message it handles, and MUST NOT withhold a call the service would accept.
*Why:* A tea shop's checkout is reached by a server function, a CLI the staff use, a handler and
a test; its records are served by Postgres in production and by a fake in the test. P4 holds where
all of them meet one computation, the service and the domain, fed by two inputs: what the caller
hands the driving port and what the driven ports return. Everything that varies by caller is then
an argument, in a signature every caller fills; everything that varies by what serves the use
case lies behind a port, the same port for the store and the fake. A new way in reaches the same
computation and gets the same response; a swapped driven adapter answers the same port. The harm
is anything else that feeds the use case, because it varies where nobody looks: a check one way in
makes and the next forgets, a value the request carries and the handler does not, a number one
process holds and the next does not. Each such input makes the response a function of who called
or what served, and a test that passes says nothing of the server function, nor the server
function of the CLI.

The first sentence puts the computation in the service and the domain and closes its inputs. A check
a driving adapter makes and the service does not protects one way in: the order page refuses to
cancel a shipped order, and the CLI, or a downstream calling the driving port, cancels it. A value
read where it was not passed is in no signature: the current user taken from a request context
decides a permission, the second driving adapter forgets to set it, the test does not, and the
handler, running outside any request, finds none. A business rule deciding by a configuration value
decides by which process took the request: during a deploy the old image and the new run side by
side with different payment deadlines, and two orders placed in the same second get deadlines apart.
What the business wants to change at runtime is a record, read through a driven port like any other
record, and the same for every process. A ready-made clock or id generator the service imports is no
argument and no driven port, and fails the same test; the time and the ids arrive through a `Clock`
port and an id generator port, or as arguments. Pure code of no system and a shared kernel, called
by the service or the domain, add no input: they compute from what they are passed and are part of
the computation.

The first sentence reaches behind the ports too, because an input closed at the service comes back
through them. A repository adapter that filters by an ambient tenant returns, for the same arguments
and the same records, what depends on who happened to call; a driven adapter that turns an instant
into a date by the process's `TZ` returns what depends on which process ran it. The service decides
only by what its port returned, and the use case still answers by who called or which process ran,
so the value is refused wherever it is read. A configuration value that chooses what lies behind a
port, a key, a URL, a pool size, changes nothing for the same records: a test that points the URL at
a stub has swapped what serves the use case, which is P4's case and not its breach. A value the
business decides on is part of how the use case acts: the sender a customer is meant to see on a
mail is the business's, and is held in the domain or a record; a sender that only names the
deployment to its mail provider changes nothing. What the use case records goes the same way: the
user an audit column records and the locale a mail is rendered in arrive as arguments, and a handler
that needs a value of the request that wrote its message gets it in the message, or by a query the
message points to, or not at all.

The second sentence is the driving adapter's side. A driving adapter that makes two acting calls
holds a sequence the glossary gives to the service: which second call to make, and what to do when
the first succeeded and the second failed, are decided in one way in, outside any transaction, and
repeated or missing in the next. A loop over acting calls is the same sequence. A bus that delivers
several messages at once gets one acting call per message. So does a poll: each item it returns,
handed on under the id the other system gives it, is a message (P9), and the adapter makes one
acting call per item, or one that writes one message per item (P7). What the adapter does before the
call is translation: parsing its caller's input into the domain's shapes, routing by path or by
message type to the driving port it calls, working out who the caller is, through an answering call
where that takes this system's stored state, the answer becoming an argument of the acting call. A
caller it cannot identify, input it cannot parse, a message of a type it has no driving port for:
each it cannot translate, and withholding the call is the adapter's. An answering call asked whether
to act is a guard: it withholds the acting call earlier where the service would refuse it too, and
the service still refuses it. A guard the service does not repeat, a role check on the admin route
alone, a webhook that skips events under some amount, is a decision that holds on one way in.
Translating back is the adapter's too: JSON for the route, a line for the CLI, one answer.

Telemetry is no input: a logger or tracer imported ready-made, a trace context the adapter puts in
per request and the outbox adapter carries on the envelope, change neither how the use case acts
nor what it answers, so nothing here refuses them.

What P4 needs beyond this rule other properties deliver. That a fake answers as the store does
wherever the use case can tell: P6 delivers this. That the use case reaches the outside, and is
reached, only through ports assembly hands it, in its system's terms: P5 delivers this. That a check
by stored state is made in the transaction that acts, not in a call before it: P10 delivers this.
That a caller's transaction does not run the use case: P16 delivers this, and the glossary's driving
port already takes what a caller brings in the system's terms, not its store's. That a business
rule's number is stated in the domain: P2 delivers this.
*Provenance:* Follows Cockburn, Intent: an application "equally" driven by users, programs,
automated tests or batch scripts, and tested in isolation from its run-time devices and databases.
The decision in the service follows Khononov p. 85 (the aggregate's interface enforces all business
rules "in one place") and Cockburn (Motivation: business logic infiltrating the user interface).
The sequence out of the driving adapter follows Khononov p. 124 and Fowler (Service Layer);
departs from Khononov p. 122 and p. 124, where a service layer "is not always necessary", and from
Evans p. 77, which gives digesting the request to the application service. One acting call is this
document's; one message per item follows Vernon EAD II p. 9. What the use case acts
by arriving through its driving port follows Seemann ("Service Locator violates encapsulation");
his interview goes wider ("Ambient Context is also best avoided"), which this rule does not, keeping
telemetry ambient. The message carrying what its handler needs follows Khononov p. 91, Evans
Reference p. 13 and Helland 2005 §1.6; Khononov p. 236 keeps event notifications lean, the
subscriber asking for the rest. The line drawn by what a value changes, wherever it is read, is this
document's.

### P5. A system reaches the outside, and is reached from it, only through ports assembly hands it; each port speaks the system's terms

*Scope:* code of a system reaches the outside or the code behind a port, or anything outside a
system reaches into it.
*Statement:* A service MUST reach the outside only as a port of its system in the system's terms,
and an adapter or an outbox reader only as such a port or as the outside it adapts, each also
through code of the common library whose output changes neither how a use case acts nor what it
answers. Anything outside a system MUST reach into it only through its offer or by a driving
adapter's way in. A port's implementation, a client of the outside or a configuration value MUST
reach code of a system as an argument chosen by the process's assembly, or from a courier that only
assembly fills and a driving adapter reads each time it runs.
*Why:* An agent editing one file sees that file. Where every way out and every way in of a system is
a port, the ports are a complete list of what the system needs and offers, and swapping what serves
one, or adding a caller, is an edit at the port's far side and in assembly, nowhere else. Each way
past the ports breaks that list in its own place. The tea shop's checkout service that queries
Postgres with the client it was handed has the store's tables in a use case, a test that needs the
store, and a second store meaning a rewritten use case. The service that builds its Stripe client
from `process.env` is stuck with that client in every process and test that loads it, and opens a
second pool beside assembly's. The service that pulls its repository from a registry filled at
module load has a dependency in no signature, and what serves it changes where nobody looks. A port
declared in the store's terms, a `Sql` port taking a query string, is the store client one step
removed: there is nothing behind it to swap, and the meaning sits in the code behind it. The three
sentences close those three gaps: what code reaches, what may reach in, and how it gets hold of it.

The first sentence is the seam. Reach is the glossary's: it counts what code is typed by, and stops
at a port of its system and nowhere else. So a store client's type in a port's signature is the
store reached, and an interface the common library exports is no port of the system: a service
calling the store through a common-library `Sql`, or opening its transaction through the common
library's interface, reaches the store and is refused; it opens, commits and rolls back through a
driven port of its own, which the common library may implement by shape and assembly hands in. The
clock, the random id and the environment are the operating system's, which is the outside: a service
takes the time through a `Clock` port, or as an argument of its driving port, and a per-process
value it reads ambiently, `TZ` deciding a payment deadline's hour, is the outside reached through no
port. The adapters are the only code that touches the outside directly, each the outside it adapts:
a driven adapter its store, its API, its SDK; a driving adapter what calls it, the framework's route
types, the request, the external system's event parsed with that system's package. The same driven
adapter querying a second store, or a hook calling the external system through the package it parsed
with, reaches an outside it does not adapt and is refused. The outbox reader is named beside them:
it reads a store, and no port of its system stands in front of it, so by the glossary it is no
adapter. "The code behind a port" refuses an import past a port inside a system too: a service that
imports the Postgres repository adapter rather than the repository port, a driven adapter that
imports another driven adapter's module. Pure code of no system reaches nothing outside the process
and hands back nothing its caller did not pass, so a validation library or a signature check passes.
The domain, the system's own published language, a shared kernel and the published language of an
upstream the system conforms to are the system's terms, not the outside; which of them a layer may
reach, and on which runtime, is P1's and P12's to rule, and P1 delivers the domain's purity
alongside the glossary's Pure.

The second sentence turns the seam around. A system is reached by other systems of this codebase, by
assembly, by the relay and the bus, and by callers outside the codebase. Code of this codebase
reaches it through its offer: the published language, the driving port types of its open host
service, its system builders. A deep import past the offer reaches a service or an adapter and holds
whatever file layout it found; a linter on import paths finds it. The builders are on the offer, so
what they return crosses too: a builder that returns shop's repositories "for the dashboard" hands a
driven port to every importer, and the dashboard reads shop's store past every rule in shop's
services. What assembly hands on is what the process's driving side calls into: the services behind
the driving ports, the driving adapters it constructs for a framework or the bus, and the outbox
readers for the relay. A relay that imports a system, lists its outbox tables by name, or reads a
slot a system filled at module load, reaches the system through none of these: the worker that does
not load the system relays nothing of it, and assembly cannot hand the relay fakes. Callers outside
the codebase, a framework, an external system, reach a driving adapter by its way in, the file the
framework finds or the hook the external system calls, which is no export.

The third sentence is "assembly hands it". A dependency built in place, or imported ready-made from
a module that exports an instance beside its factory, is in no signature: the test cannot hand a
fake, the module that built it runs in every process that loads it, the test run included, and a
second instance of what exists once appears. Built in place, the breach passes every other check:
the code sits in the right layer and calls in the right direction. A configuration value is what a
test varies, a base URL pointed at a stub; read in place from the environment, it fails at first use
in a process where the variable is unset. The glossary makes assembly one per process and the only
place a port meets its implementation, so "chosen by the process's assembly" admits one chooser; a
system builder is assembly's own part, and the client only its adapters use, the payment provider's
SDK, it builds from the configuration it receives. A driving adapter a framework constructs, a
server function, has no caller to hand it anything, and one assembly constructs before what it calls
exists, a hook Payload's config takes before shop's services take the Payload instance, cannot be
handed it either. These read from a courier. Only assembly fills it, a system builder being
assembly, or a second place produces instances. The adapter reads it each time it runs: a read at
module load, or on the first run kept for the rest, holds the first instance for the life of the
process, and a test that fills the courier with fakes changes nothing the adapter already holds. Any
other reader, a service function reading a courier kept in the common library, receives a dependency
nobody handed it, which the sentence refuses: a service locator by another name. A courier that
carries a store client beside the driving ports puts the store's type into every adapter that reads
it; it carries what its readers call. A courier filled after its first reader runs fails that reader
loudly, not with another instance, so the order is assembly's concern and not this rule's.

The first sentence's last clause is the property's exception, and the line is behavior, not
substitution. Telemetry reaches outside the process, a logger to its transport, a tracer to its
exporter, and a service or an adapter that calls it through a ready-made import behaves the same
with no exporter registered; a test inspecting spans registers an in-memory exporter globally,
without a parameter. Handed through every factory, it adds a parameter to every signature for
nothing the system's behavior depends on. A feature-flag client, whose answer changes what the
system does, falls outside the exception and goes through a port and an argument like any other
client. So does the common library's transaction: whether its commit lands decides whether the use
case's writes exist and whether it throws. The domain, a shared kernel and a published language are
no service and no adapter: they load where no telemetry is configured.

What this rule does not decide. Which port a driving adapter may call is P4's: a server action
handed a repository reaches it as a port and passes here, and skipping the service there bypasses
the business rules for one way in, P4 delivers this. A driven adapter that calls a service has a
use case inside an adapter, P4 delivers this too. A per-request ambient value, the current user
for a permission, is no reach of the outside; that a use case responds the same whoever calls it
is P4's. A driving port that takes a transaction, a transaction made ambient, one call carrying a
transaction into another system: P16 delivers this. Where in a system a port is declared, the
service layer rather than the domain, is P1's. A business rule's number read from configuration is
P2's.
*Provenance:* Follows Cockburn (Intent: the application "blissfully ignorant" of what lies on the
other side of its ports; "A port identifies a purposeful conversation"; "code pertaining to the
inside part should not leak into the outside part"), Garrido §2.3 ("Ports are interfaces that the
application offers to the outside world"), §3 (Configurable Dependency, passed in at runtime) and
§2.5 (the composition root sets up the adapters), Martin (The Dependency Rule), Khononov p. 126,
Seemann ("Composition Root"; "Service Locator is an Anti-Pattern", comments of 2010-02-04: the
framework-created object pulls from the container, in its constructor, not at load) and Fowler
(Inversion of Control: instantiating directly "stops the finder from being a plugin"). Reach
through the offer follows Khononov p. 41 and coupling.dev (intrusive coupling). Telemetry through
no port follows the OpenTelemetry JS API. Departs: Seemann lists Ambient Context, logging its
example, among the DI anti-patterns (DIPPP ch. 5); Khononov p. 128 binds ports by injection or
bootstrapping alike; Google SWE ch. 13 finds injection "less important" in JavaScript. Against: MS
(IOrderQueries runs SQL on a connection string it holds, past any driven port); Evans p. 78,
p. 108 and Reference p. 17 (singletons and global access); Fowler (Inversion of Control
Containers) gives Service Locator "a slight edge". What code reaches directly, the courier, and
the line by behavior are this document's.

### P6. Every use case can run with nothing outside the process, in a test

*Scope:* a test runs a use case: its service, the driven ports it reaches and what implements
them, and code it reaches through no port of its system.
*Statement:* Each driven port MUST have a fake, which the system declaring the port SHOULD provide,
and a test of a use case SHOULD run its service on fakes for all its driven ports. A fake SHOULD run
none of the code it stands in for. One suite per port, written against the port and parameterized by
the implementation it runs on, MUST assert each behavior of the port that a test of a use case
relies on, on the fake in the default suite and on every other implementation against the outside it
reaches in the deployed application, set up as it is there. Code a use case reaches through no port
of its system MUST run without the outside, and its absence MUST change neither how the use case
acts nor what it answers.
*Why:* A test that needs a store, a network or another system is slow, needs an environment and
fails for reasons that are not the code's; the default suite, run on every save because nobody
has to think about running it, cannot hold it, so it moves to a suite run less, and a broken use
case is found later or by a customer. The property has two halves, and the Statement has a
sentence for each, plus one for what no port covers.

Running without the outside. P5 delivers that a use case reaches the outside only through ports
assembly hands it, a configuration value and a store client included, and that the clock and the
random id are the outside reached through a port like any other. What P5 leaves open is whether
there is anything to hand in a test. The first sentence says there is: every driven port has a fake,
a working implementation that reaches nothing outside the process (glossary: Fake). The tea shop's
checkout runs on an in-memory `Orders`, an in-memory outbox, a `Clock` set to a fixed instant, a
`PaymentGateway` that answers from a table, and a transaction port whose fake commits nothing. A
port with one real adapter is not premature: the fake is its second implementation. The SHOULD on
the test itself is where a test may still choose the real store: one that proves the writes of a use
case land together, or the message with the change, needs the store that commits them, and is an
integration test (P7 and P8 deliver what it proves). It is not that test's job to show P6; the
fakes' existence and the other tests are. A fake built from what it stands in for, the upstream's
real services on in-memory adapters, reaches nothing outside the process and still lets the test
fail for the upstream's sake: a change in billing's service breaks shop's test of checkout, and the
test no longer tells of shop. A fake written for the port fails only where the port's behavior does,
and the suite of the second sentence holds it to the real one.

Who writes the fake. A driven port a system declares is its own, and so is its fake. A conformist
declares no port for its upstream: the upstream's driving port type is its driven port (glossary:
Conformist), so the port is the upstream's, and so is the fake, exported by the upstream and run by
the upstream's suite on its own service. Two downstreams that each write a fake of billing's
`InvoiceQueries` hold two ideas of billing, each passing its own tests, each drifting on its own;
billing's one fake drifts nowhere, since billing's suite runs on it. The Statement rules it from the
first downstream, as a SHOULD: a downstream that writes its own fake anyway has a second
implementation of the upstream's port, which the upstream's suite then runs on too, or it has a fake
no suite holds. A downstream with an anti-corruption layer declares its own driven port, `Invoicing`
in shop's terms, and fakes that; the adapter behind it is shop's, and so is the suite. An external
system offers what it offers (F9) and writes no fake for this codebase: the system that declares the
driven port writes it.

Behaving as the outside does. A fake that differs from the outside where the use case can tell makes
a passing test prove nothing. The second sentence closes that with one suite per port, run on both
sides. The case: the fake `Orders` fails a stale save, a test of cancel after payment passes on it,
and the real adapter, its version missing from the where clause, writes over the payment in the
deployed application. Asserted in the suite, the stale save fails on the real run. The suite asserts
what the tests of use cases rely on, not everything the port could do: where no test relies on a
behavior, the fake and the real adapter may differ, and no test claims otherwise; a test that comes
to rely on it brings the assertion with it. Errors are behavior too: the gateway's fake that answers
a disputed charge with a refusal, not a failure, is held to the provider's test mode answering the
same. Two suites, one per implementation, drift the way the fake does, so it is one, written against
the port. Parameterized by the implementation, the real run is a flag away, not an edit: it is what
one reaches for when a failure makes the fake doubtful, and a run that means editing imports is not
reached for.

The real run proves only what it touches. An adapter run on a double of the store is checked
against the adapter's own idea of the store, which is what is in doubt; a real database whose
tables the test pushes from the adapter's own table definitions is that double again: the
migrations hold a unique constraint the definitions lack, the suite passes, and the insert fails
in the deployed application. So the other implementation reaches what it reaches there, set up
as it is set up there. Whether that run is an integration test or an end-to-end test follows from
where the outside runs (glossary); it falls outside the default suite either way, and when it
runs is not this property's. For a conformist's port, the other implementation is the upstream's
service, run against the upstream's store as its migrations set it up.

What no port covers. P5 lets a use case reach some code of the common library through no port,
where its output changes neither how the use case acts nor what it answers: telemetry. That code
runs in every test of the use case, with no fake in front of it. The OpenTelemetry API passes:
with no SDK registered its spans are no-ops, and the 3PL client that imports the tracer behaves
the same in a test. A logger whose transport throws when its collector is unreachable, or a
module that opens a pool when it loads, does not: the use case cannot run with nothing outside,
and the third sentence refuses it. The domain, a shared kernel and pure code reach nothing
outside by definition (glossary: Pure) and pass without a word.

Driving adapters are no use case. A test of a use case enters through its driving port, and neither
the bus nor the courier is needed for it; how a driving adapter is tested is the codebase's
(Assumptions).
*Provenance:* Fakes for every driven port follow Cockburn (Nature of the Solution: the in-memory
adapter "most importantly"; the application "can be configured to run decoupled … using an
in-memory oracle, or mock, database replacement; or it can run against the test- or run-time
database"), Garrido §2.4 (two adapters per driven port), Evans p. 111 and MS (many fast unit
tests, fewer against the database). The one suite run on both follows Google SWE ch. 13 ("A fake
must have its own tests"), Vocke and Fowler (IntegrationTest, ContractTest); the flag follows
Google SWE ch. 14, Cockburn (Structure: in-memory or real database by configuration) and Vocke (a
profile selects the real database). The real run against the real thing follows Vocke
(Integration Tests: "you need to run a database"), Google SWE ch. 13 and Pryce as reported by
Garrido §6.1.1. The owner's fake follows Google SWE ch. 13 ("the team that owns the real
implementation should write and maintain a fake"). The no-op telemetry follows the OpenTelemetry
JS API (its methods "can be safely called by a library or end-user application whether there is
an SDK registered or not"). Departs: Fowler (UnitTest) holds doubles for external resources a
"useful guideline", and Google SWE ch. 13 prefers the real implementation until it becomes too
slow; Google SWE ch. 13 names contract tests against both "one approach", Fowler runs them on the
external service's rhythm outside the regular pipeline, and Google SWE ch. 14 keeps doubles
faithful by recorded traffic; for adapters over an external system, Fowler (IntegrationTest),
Vocke (a fake server) and Google SWE ch. 14 ("it is not recommended to have automated tests use a
real third-party API") test against doubles; Vocke has each consumer state what it uses
(consumer-driven contracts), and Google SWE ch. 13 allows a caller's own fake where the owners
will not write one. The owner's fake from the first downstream, and the rule on code reached
through no port, are this document's.

### P7. A use case's writes to its own system's records land together or not at all

*Scope:* a caller reaches a goal through a system, and reaching it writes the system's records.
*Statement:* A use case MUST save at most one aggregate, or several only where a business rule ties
them, in one transaction that its service opens, that carries every write the use case makes, and
that its service commits once after the last write. The same transaction MUST carry the messages the
use case writes to the outbox and the record of the message it is called for, and what else its goal
needs MUST be asked for by such a message, or by the call after the commit that P8 allows. Where a
write in it fails, the transaction MUST roll back whole.
*Why:* A process can stop between any two instructions (F4), and a write can fail where the one
before it succeeded. Between two writes that each commit on their own, the stop leaves records no
business rule allows: a booking saved and the message asking for its invoice not, so no invoice ever
follows. Nothing read afterwards tells a half-done use case from an intended state, so nothing
repairs it. A store commits a transaction whole or not at all (Assumptions); the rule makes sure
everything that has to land together is inside one, and that nothing commits beside it.

The Statement draws the line in three places. First, what lands together: the aggregates a business
rule ties, and the messages that tell of their change. A business rule ties records where it must
hold in every committed state of them, not only once what follows by message has landed. An
aggregate is drawn around what its business rules keep consistent, so a tying rule mostly draws the
records it ties into one aggregate. Not always: an aggregate is loaded and saved whole, and some
rules tie more than that can carry. Ticket numbers that run without a gap tie the series to every
ticket of the year; an itinerary holding seats on three flights ties three flights' seat counts; the
itinerary booked and the basket emptied tie the basket to the itinerary. Drawn into one aggregate,
each would be every ticket of a year, or every flight an itinerary might touch. The use case saves
the tied aggregates in one transaction instead, and they fail each other's writes, which P10 accepts
because a rule ties them. The tying rule is stated in the domain (P2), so a second aggregate in a
transaction points to a rule a reader can find. Two aggregates no rule ties need no shared commit,
and saving them together makes use cases fail each other that nothing ties (P10). What else the goal
needs follows by message and lands with the aggregates of the use case that handles it. One case
looks like a tie and is none. Where the caller has to see one change at once, nothing ties the rest:
the use case saves that aggregate and the rest follows; the traveller sees the seat held, and the
invoice follows from its message. A write the goal does not need, a statistic, goes the same way.
One case looks like none and is a tie. Where one aggregate must not reach its final state before
another agrees, a rule ties them, and within the system they are saved together; where the other is
another system's, no transaction reaches it (P16): the first commits its intent, then asks the other
for a tentative operation, by a message or by the call after the commit that P8 allows, and later
confirms or cancels it; P17 delivers that it ends.

Second, who holds the transaction: the service. It is the only code that sees the whole use case
(glossary: Service, the sequence within its use case), so it alone knows which writes land together.
A repository adapter that opened and committed its own transaction would decide that for writes it
does not see, and commit its aggregate while the next one fails. Every call that writes records of
the system takes the transaction: repositories, the outbox port, the record of handled messages. A
write made beside it commits on its own and stays when the transaction rolls back: through the
store's global client in a driven adapter handed a transaction, through a transaction the adapter
opens itself, in a loop with one write per iteration on the client, in a helper that reaches for the
client. The type checker sees none of these where a method takes the transaction and calls through
the client anyway; where the transaction is a required parameter of each port that writes, a
forgotten one is at least a type error. "Commits once, after the last write" refuses a status set
after the commit, as much as one set before it with a client of its own.

Third, one goal, one acting call. Code that composes acting calls to reach one goal has a use case
growing outside any service, and each acting call commits its own transaction. A driving adapter
that places the order and then calls a second acting use case to clear the cart leaves the order
placed when the second fails or the process stops between them; a loop over acting calls is the
same. A service that calls another service of its system to reuse its writes is the same split
one level down: the inner service opens and commits its own transaction, the outer one fails
afterwards, and the inner writes stay. Two use cases that need the same writes each call the same
repositories inside their own transaction, and the domain decides what the writes are. What the
code around the acting call may still do is everything short of a second one: validate, translate,
ask an answering use case for an argument, who the session belongs to. Several calls that each
reach a goal of their own are not a split: a bus delivering a batch gives one call per message. Work
over many items a scheduled task finds is one acting call that writes one message per item, and each
is handled as a use case of its own that saves its own item. A poll's items are messages already
(P9), and each may be its own acting call.

Rolling back whole means no write of the use case commits once one has failed. A use case that
catches the failed write, rolls back to a savepoint and commits the rest is the half-done use case
by another route. A write that does not fail, an insert that does nothing on conflict, is no
failed write. What the use case answers after the rollback is not this rule's: a save that lost
to a concurrent one fails the use case so the decision is made afresh (P10 delivers this); a claim
of a message id already handled succeeds without writing (P9 delivers this); a stop no
retry cures is failed and parked rather than committed as an outcome (P17 delivers this).

Exceptions, and why they are none. An answering use case writes nothing and is outside the Scope.
Another system's records are not this system's: where two systems keep their records in one
store, the call into the other system takes no transaction, and P16 delivers this. A record of
this system kept in a second store, or mirrored into an external system, cannot be in this
transaction, since a transaction is one store's (glossary: Store): if the goal needs it, the
records belong in one store or the goal is cut again; if it does not, a message asks for it, and
P8 delivers that the message is neither premature nor lost. That the outbox's message commits
with the change it tells of is P8's too; here the outbox write is one write among the others.
Whether the transaction travels as an argument or as an ambient value, and through which port the
service opens it, matter for other reasons, P16's and P5's; this rule needs only that every write
is carried by it.
*Provenance:* The service holding the transaction follows Fowler (Service Layer: "controlling
transactions"), Evans p. 111 ("Leave transaction control to the client"; the repository "will
ordinarily not commit anything"), Khononov p. 86 n. 7 and p. 122–123, Vernon EAD I p. 3 and MS (the
command handler commits). One aggregate per transaction as the default follows Vernon EAD I p. 4,
Khononov p. 87 and p. 93, Evans Reference p. 16, Fowler (DDD_Aggregate) and Helland 2007 p. 135. The
rest by message follows Vernon EAD II p. 9 (each subscriber "in a separate transaction"; whose job
the consistency is). The tentative operation, between aggregates or systems, follows Helland 2007 p.
140. A nested call recording no intent follows Helland 2007 p. 138. One acting call per goal and no
service calling another are this document's; no source rules on them. Departs: Khononov p. 122 and
p. 124 make the service layer optional; MS runs domain-event handlers inside the command handler's
transaction, one piece of application code driving another, and its IdentifiedCommand handler
re-dispatches. Departs, where no business rule ties the aggregates, from Vernon EAD II p. 10, which
breaks the rule for a batch created at once, and from MS ("valid in many business cases"). Departs,
saving several aggregates a business rule ties in one transaction within one system, from Vernon EAD
I p. 4 and Helland 2007 p. 135, whose one entity per transaction holds "for entities within the same
application" too.

### P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after

*Scope:* a use case writes a message or decides a change its transaction does not commit, a message
is delivered, or another system tells this system of a change before committing it.
*Statement:* A message a use case writes MUST go into the outbox in its transaction, and a change it
decides that the transaction does not commit MUST leave it only as such a message asking for the
change, or as a call to another system after the commit, made from a record the transaction
committed, from which a later step repeats the call or ends the change. The outbox MUST keep each
message until the bus holds it, and the bus through any stop of a process until a handler
acknowledges it, which the handler MUST NOT do before the use case it calls has returned with its
writes committed. A use case called for such a message MUST make the change, deciding nothing again,
and a change another system tells of before committing it MUST change nothing in this system beyond
a provisional record of it until it is confirmed. An external system this codebase configures, whose
transaction can write a message to an outbox, MUST tell of its change by such a message.
*Why:* A use case's writes are a fact once its transaction commits, and not before; a process can
stop between any two instructions (F4). What leaves the transaction is not bound to that commit: a
mail sent, a parcel booked with the 3PL, a command handed to another system, an event published, a
record mirrored into an external system or into a second store of this system. Done before the
commit, or beside it, it stands when the transaction rolls back: the customer gets a confirmation
for an order of tea that was never placed. Done after the commit, a stop in between loses it: the
order is placed and no mail goes, no stock is reserved, no invoice is written, and nothing retries.
Either way someone acts on a world the records contradict, and no later code can tell.

The first sentence closes both gaps with one move. What is to leave the transaction is written into
it, as a message in the outbox, so it is exactly as committed as the writes it follows from, and it
leaves only after the commit, by delivery. The use case decides; it does not make the change. A
transaction is one store's (glossary: Store), so a system whose use cases write to several stores
has an outbox in each; where the messages sit, a table or a field the system owns on the record it
changes, is the system's to choose. Delivery then has to lose nothing it carries, and that is a
chain of holders, each letting go only once the next holds: the relay marks a message only after the
bus has it; the bus keeps it outside the memory of any one process, a deploy included, and delivers
it again until a handler acknowledges; the handler acknowledges only once its use case has
committed. A relay that marks first, a bus held in memory, a queue client that acknowledges on
receipt, a handler that catches the use case's error and returns: each lets the message go while
nothing holds it. Again need not be at once: a bus that backs off and parks the message in a
dead-letter queue still holds it; one that drops it from there has let it go. A hook is a handler
whose holder is the external system: it stops resending once the hook answers, so the answer is the
acknowledgement, and a hook that answers at once and calls its use case afterwards lets go the same
way. A use case that writes nothing has committed nothing and is done when it returns.

The first two sentences cover several cases. A message about a change is the first clause applied to
an event. A change to data another system of this codebase owns: calling the owner inside the
transaction makes its change before this commit, calling it after loses the change on a stop;
written as a command in the outbox, the owner's handler makes it after. Which system's use case may
make that change is P11's; P11 delivers this. A change no other system of this codebase owns, a
mail, a booking, a mirror: the owner of a mail reads no bus, so this system's own handler acts for
it, and the second sentence says how. That handler is where the chain ends rather than regresses: it
decides nothing, so the first sentence does not reach the call it makes beside its own transaction;
the decision committed with the message. A handler that decides again decides on a later state, with
its call still apart from its transaction: fulfillment's handler for `BookShipment` checks the
reservation, books the 3PL and marks the reservation shipped; the mark loses to `OrderCancelled`'s
release and rolls back, and the booking stands for a reservation that no longer exists. Making the
change without deciding, it records the owner's answer where there is one, a booking's id. Whether
it has made the change already it may ask its records; P9 delivers the means. Whether the change is
still wanted it may not ask: what happened meanwhile, the order cancelled, is the deciding system's
to answer by a business rule, and P17 delivers that.

A call after the commit is the other way out, for a use case P15 lets wait on another system's
answer, which no handler could give in time: checkout commits the order, then asks payment for the
card payment and hands the browser its `client_secret`; booking commits its hold record, then asks
the airline's API to hold the seat under a key derived from that record's id, and shows the
traveller the hold now. The committed record is what makes the call safe. A stop before the call or
after it leaves the record, and a later step repeats the call, or ends the hold by a business rule
(P17). That the repeat changes nothing, by a key derived from the record or the hold looked up by
its id, is P9's, and so is what follows where the other system offers neither. Made before the
commit or beside the transaction, the call stands when the transaction rolls back, with no record
that it was made, and the first sentence refuses it. An answering call beside the transaction
changes nothing, so nothing follows from it. Telemetry beside the transaction tells of an attempt,
not a fact, and its output changes neither how a use case acts nor what it answers.

The third sentence is the same property seen from the receiving side: another system's uncommitted
write is no fact here either. Payload calls catalog's hook before its change commits; the change can
still roll back after the hook returns, by a later hook, a failed validation, a stop. A use case
that revalidates the product page or publishes `ProductChanged` from the hook announces a change
that may never be. Two answers stay safe. A veto answers and changes nothing. Whose rule the veto
states, and so whose record it is, is P2's, not this sentence's. A provisional record of the change,
a record of its own or a private message for a handler, leaves the change to a confirmation that
comes after the external commit: a message the external system publishes, a later hook, a read of
its state that finds the change there. The handler that acts on the provisional record as soon as
its message arrives acts before the commit one hop later, so it waits for the confirmation too; a
read that finds nothing yet is no refusal, and the use case fails and is delivered again. The fourth
sentence closes the gap where it can: where the external system's transaction can write a message to
an outbox, configured so, the message commits with the change and the relay hands it on after, so
nothing is provisional and the third sentence is not reached; the outbox is the external system's,
in its store, and assembly hands the relay its outbox reader (glossary: Outbox). Where it cannot,
the third sentence holds. A hook called after the commit tells of a fact, and the first sentence
governs what follows from it.

P8 leans on others. P7 delivers that a use case's writes, its outbox message among them, land in one
transaction, each driven adapter writing inside it. P9 delivers that the repeats this chain brings,
delivering at least once and the call after the commit repeated, change nothing: the key passed to
an external system, and what a business rule allows where no key reaches. P16 delivers that no
transaction is carried into another system, which is why a message is the only bridge. P17 delivers
that a provisional record, a change asked by a call after the commit and a refused request end in a
state a business rule allows, and what counts as a message's outcome. P14 delivers that a message
waiting in the outbox across a deploy is read as it was meant.
*Provenance:* The message committed with the change follows Richardson (Transactional outbox),
Khononov p. 144–146, Helland 2007 p. 137 ("transactional enqueuing of messages is de rigueur"),
NServiceBus (Outbox) and MS; the outbox as a field of the record follows Richardson and Khononov p.
146. The lost call after the commit follows Khononov p. 144–145 ("Can we trust this code? No.") and
Richardson ("no guarantee that it won't crash before sending the message"). The holders follow
Khononov p. 145 and p. 147 (marked "upon successful publishing"; "at least once"), EIP (Guaranteed
Delivery; Transactional Client; Dead Letter Channel), Vernon EAD II p. 9 ("retried if the subscriber
does not acknowledge success") and NServiceBus (the error queue, retried "once the error is
resolved"). The call after the commit, made from a committed record and pushed on by a later step,
follows Brandur (Idempotency keys: "Atomic phases should be safely committed before initiating any
foreign state mutation"; a completer pushes unfinished requests "through to completion") and Helland
2007 p. 138 (the intent to invoke recorded). The executor follows Khononov p. 149–150 ("the command
execution logic should be moved out of the saga itself", his saga the coordinating component, not
the glossary's sequence) and p. 293 (the outbox "for sending email messages"). Departs: Khononov p.
150 has the relay execute commands, which the glossary's relay does not; EIP (Event Message) finds
guaranteed delivery "usually not very helpful with events". Against: EIP (Command Message) and
Richardson (Messaging), the synchronous call. This document's: deciding nothing again; the hook
before the commit; the message in an external system's transaction; the holders as one chain.

### P9. A repeated delivery or call changes no record of this system, and succeeds where the first did

*Scope:* an acting use case is called for a message, whether the bus delivered it, a hook was called
with it, or a driving adapter asked another system for it, or is called through a driving adapter
that a caller outside its process reaches; or a use case calls another system after its commit (P8).
*Statement:* The use case MUST tell a repeat inside the transaction that commits its writes, by the
message's id or the call's key claimed there under a key the store refuses twice, or by the records
it writes there, and finding the first's writes committed MUST commit nothing and succeed. A change
it makes outside that transaction, and a call after the commit, MUST carry to the system that makes
it a key that names the change, the same on every attempt at it by whichever message or step: the id
of what the change is about, one derived from the record the transaction committed, or the message's
or the call's where it alone asks for the change; by that key that system answers a repeat. Where
neither a key nor its records tell a repeat, or no such key reaches the system that makes a change,
and the change made twice ends otherwise than made once, what follows from the repeat MUST be what a
business rule of its system allows: the repeat prevented, corrected afterwards, or accepted.
*Why:* The stock reserved twice. A message arrives more than once (F5): the relay hands one over
again after a stop, the bus delivers again a message whose handler stopped after its use case
committed, Stripe resends an event for days and at times twice at once, a poll returns items the
last poll returned. The repeat is the price of losing nothing after a commit (P8), and the second
may run while the first still does. So every acting use case called for a message meets it, and
the Scope reaches every way a message arrives, not the bus alone.

Where the repeat is told decides whether it is told. A claim committed in a transaction of its own
before the writes, and a stop between: the message is claimed and never acted on, and every
redelivery returns at once. A claim or a check after the commit, and a stop between: the act runs
twice. A check that reads "handled?" and then acts, inside the transaction but with nothing the
store refuses twice, lets an overlapping repeat read "not yet" as well, and both commit. Claimed
inside, under a key the store refuses twice (Assumptions), the overlapping second fails at its
commit with nothing committed, is delivered again, and that delivery finds the claim. The claim
commits with the writes it guards or not at all; P7 delivers this. The other means is the records
themselves: a status set, not toggled; the order found paid; the transfer's id in the invoice's
list of applied transfers. Two attempts that both read the order unpaid both save it, and the later
save fails; P10 delivers this. A use case whose writes are not all of that kind is not told by its
records: an `OrderPaid` written to the outbox again on an order already paid is a record the repeat
changed, and a second event downstream.

The message's id is its writer's, the same on every delivery (glossary: Message). A hook's event
carries the external system's id, Stripe's event id. A polled item carries the id the other system
gives it, the bank's transfer id, and the driving adapter that asked hands each item on as one
message with that id: an adapter that hands the use case rows without it leaves nothing to claim,
and the next poll credits the invoice again. A message with no id leaves the records as the means.
"Not found" tells no repeat: the cancel that arrives before the order it cancels was never handled,
and P18 delivers what becomes of it.

The second clause is "succeeds where the first did". A repeat that finds the order paid and throws
"already paid" fails: its handler does not acknowledge, and the bus delivers it again and again
until it parks it, for a change already made. The repeat succeeds. What it answers is the use
case's, read from what is committed as a first run reads it: the second finds the booking id the
first attempt recorded and returns it. A first delivery that failed committed nothing, so the next
is no repeat and acts afresh. A first that committed a refusal was handled, and its repeat returns
without publishing the refusal again. Telling a repeat is not deciding again: whether the change was
made already is this rule's question, whether it is still wanted is not, and P8 delivers that the
decision committed with the message stands.

A change outside the transaction, a call to another system, a mail, is covered by no claim. The 3PL
books, the process stops before the commit, nothing is claimed, and the redelivery books again;
claim first and call after, and a stop between loses the booking. No order of a claim and a call
closes that gap. The system that makes the change can: handed a key, it answers a repeat with the
first call's result instead of acting again. The key names the change, so it is the same on every
attempt at it; a fresh UUID made at the call differs on each attempt and deduplicates nothing. The
id of what the change is about serves, the shipment, the refund, and so does the message's id where
that message alone asks for the change. Where a later step repeats a call another made, it carries
the key the first carried: payment's step that reopens the intent sends Stripe the key derived from
the `Payment`, not its own message's id, or Stripe opens a second intent. Where no key reaches the
repeat, the change happens twice: the mail provider takes no key; Stripe keeps one for a day, and
the message waited longer in a dead-letter queue. That is F9, and whether the repeat is acceptable
is the business's: a second confirmation mail is accepted; a second parcel is not, so the 3PL that
takes no key is asked whether a consignment for the shipment exists before one is created, the race
that remains is accepted, or that 3PL is used for nothing the business refuses twice. A
reconciliation that finds the second consignment and cancels it corrects the repeat afterwards.
Which of these follows is a business rule, so it lives in the domain (P2 delivers this): a domain
function the use case asks what a change that may be a repeat leads to, whose answer may be to go
ahead. How a codebase writes an acceptance down is the codebase's. A change that ends the same made
twice, a cache refreshed, a status set to what it already is, needs no rule: its repeat is no
change. Telemetry tells of attempts (P8), and two deliveries are two attempts.

A polled item's order is P18's, its unmatched transfer P17's. The key is the same on every delivery
of one message, not on every message asking for one change: a reconciliation that asks again for a
shipment parked unbooked writes a new message, which is no repeated delivery; the shipment's id as
key covers it, and the ruling is left to P17.

A call repeats too. A caller that stopped or timed out after the call does not know whether it went
through, and repeats it: P8's later step after a commit, a browser that resubmits checkout. The call
carries a key its caller keeps the same, and the use case it reaches claims it as it would a
message's id: payment, called again for the same order, finds its `Payment` and answers with the
intent it first opened. Where the call carries no key, the records may: the second `register` finds
the customer with that email, and where what the first committed matches the request, it returns the
same customer; with another name it is a new request, and refused. Where neither tells, what follows
is a business rule's: a second empty cart, `setCartLine` called again with no cart, is accepted; a
second order is not, so checkout takes the cart's id as its key. A caller in the same process knows
whether its call returned; one outside does not, so the Scope reaches the driving adapters outside
callers reach. An answering use case changes nothing, and a repeat of it changes nothing either.
*Provenance:* The repeat follows Khononov p. 147 (the outbox "guarantees delivery of the messages at
least once"). The claimed id follows Richardson (Idempotent consumer: "a consumer must be
idempotent", by recording the ids of processed messages), NServiceBus (Outbox: deduplication by
MessageId), Helland 2007 p. 140 and Khononov p. 245; the change whose repeat is no change follows
EIP (Idempotent Receiver), Helland 2007 p. 139 and MS, which prefers idempotent handling to
deduplication. The polled item follows EIP (Polling Consumer); treating it as a delivered message is
this document's. The external system's key carries NServiceBus's MessageId from the receiver to the
external system, this document's. The business rule accepting a repeat is this document's, from P9.
The repeated call follows Helland 2007 p. 139 ("if a reply is required, the same reply must be
returned"), Stripe (Idempotent requests: retries with the same key "return the saved response") and
Brandur (Idempotency keys: "Pass through our own unique ID rather than the value transmitted to
us"). Departs: NServiceBus deduplicates within a retention window; here the store refuses the claim
twice.

### P10. A use case commits only on reads that still hold, or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them

*Scope:* an acting use case decides what it writes by data that other use cases, or other systems,
can change while it runs.
*Statement:* A use case MUST decide by data read inside the transaction that commits the decision,
and the store MUST fail that transaction's writes where the data has changed, or come to exist,
since the read. A decision on data whose change fails no transaction of this store MUST rest on a
business rule of its system that accepts the data stale and says what follows where it changed
meanwhile. Its writes MUST NOT fail on a change to records that no business rule ties to the use
case's goal.
*Why:* Two checkouts read a stock of one, both decide to reserve, both commit; the later commit
undoes the earlier and nothing anywhere says so. The harm has one shape: a decision commits after
what it was made on stopped holding. It comes about wherever the data a decision read and the writes
that commit it are not held together until the commit, and the cases below are each a way to pull
them apart.

The check made by another call. A driving adapter asks an answering use case whether the order can
be cancelled, then calls cancel; what the answer read changes between the two calls (CWE-367). The
first sentence asks the acting use case to read and decide in its own committing transaction, so
the earlier answer decides nothing. A guard of that kind may stay, refusing earlier on one way in,
as long as the acting use case decides afresh. That the deciding is the acting service's on every
way in, by the domain's specification, is P4's and P2's: P4 delivers this, P2 delivers this.

The read outside the transaction. A repository adapter that looks up through the global client, not
the transaction it was handed, reads past the use case's own writes and past whatever its
transaction holds against others, a row lock, a stricter isolation level. It is a read outside the
committing transaction, so the first sentence refuses it. That the writes go inside it is P7's.

The write that compares nothing. A repository adapter that saves a loaded aggregate without
comparing its version, a method that inserts one cart line rather than saving the cart, an upsert of
a reservation keyed by its order with nothing loaded: each writes over whatever another use case
committed meanwhile, and the store fails nothing. The first sentence asks the store to fail the
writes where the data read changed, or came to exist where the read found none, which is why the new
aggregate's insert fails on a key already taken. The means are open: a version the aggregate
carries, compared on save; a lock taken at the read and held to the commit, under which the data
cannot change; a unique key; an isolation level under which the second commit fails. The cheapest is
to keep the data a decision reads in the aggregate the use case saves: the stock with its
reservations in one `Stock`, so the second reservation's save fails, where two `Reservation`s saved
beside a `Stock` read and not saved both commit. The Statement asks for the failure, not for this
means.

The retry inside. A use case whose save fails and that reloads the order and saves its cancel onto
the new state applies a decision made on an unpaid order to a paid one. The first sentence has it
fail, and its transaction rolls back with nothing committed; the decision goes back to whoever can
make it afresh, the caller or the redelivery, which runs from the read again. That a redelivery
comes, and that a lost race is not committed as a refusal, is P9's and P17's: P17 delivers this.

The stale read a business rule accepts. Some data no failure in this transaction can cover: a
replica lags its owner, and another system's live answer is stale the moment it returns, since no
save in this store fails on a change there. A business rule across aggregates the use case does not
save together is in the same place. The second sentence lets the use case decide by such data only
where a business rule of its system accepts it stale and says what follows where it changed
meanwhile: shop offers pay-by-invoice by its copy of billing's dunning stage, a customer who entered
dunning a moment ago accepted; a reconciliation, a later use case or a step that undoes an earlier
one repairs a rule across aggregates after a delay. Calling the owner instead of reading the replica
buys no exemption: both are stale, and the rule holds for both. Without the business rule the
decision rests on a fact nobody agreed may be stale, which is the first harm again.

Failing each other for nothing. The third sentence is the other half of the property. A use case's
writes fail on a change to what they cover, so what they cover decides whom it fails with. An
aggregate drawn wider than its business rules, release scheduling and backlog planning in one
`Product`, fails the planner whenever a release is scheduled; nothing in the business ties the two
(Vernon's false invariants). An aggregate that holds another's whole record loads and saves it along
with itself: it fails whenever a use case changes the other, and where it does not fail it writes a
stale copy over the other's change; held as the other's id, or as a snapshot that is this
aggregate's own fact from then on, the price the order was placed at, it covers nothing of the
other. A statistic written in the same transaction, an untied aggregate P7 keeps out, would fail
every checkout that races on the counter. Moved to a handler through a message in the outbox, the
write fails alone and is retried alone. An aggregate drawn around what its business rules tie, and a
use case writing what its goal relies on, fail each other exactly where the business says the two
cannot both stand. Two `OrderPlaced` racing for the last unit fail each other by a business rule,
the unit given to the first: that is the third sentence kept, not broken. Which message arrives
first is P18's.

Exceptions: an answering use case commits no decision and falls outside the Scope. A fake that does
not fail a stale save lets a service test pass on what production writes over; that the fake
behaves as the store does is P6's: P6 delivers this.
*Provenance:* The failing save follows Khononov p. 86–87 (the later transaction must not be "blindly
overwriting the changes committed by the first one"; a version compared on save) and Vernon EAD I p.
2 (a version "checked before they are saved"; the stale copy's updates "are rejected"); Evans p. 94
locks the purchase order, which the Statement admits. The check in the acting call follows Khononov
p. 85 and CWE-367. Failing rather than reapplying follows Fowler (Optimistic Offline Lock: on a
conflict "the transaction is rolled back"); departs from MS, which retries inside the use case on a
concurrency exception. The data in the saved aggregates follows Evans p. 91 and p. 97, Evans
Reference p. 16, Vernon EAD I p. 3 and Khononov p. 87; follows Vernon EAD I p. 4's one aggregate per
transaction as the default. The stale read a business rule accepts follows Vernon EAD II p. 9, MS
(Domain events: domain experts decide), Helland 2005 §2.5 and Evans p. 91. The id and the snapshot
follow Vernon EAD II p. 8, Khononov p. 90, Evans p. 97 and Helland 2005 §5.2; against: Evans p.
91–92 and Fowler (DDD_Aggregate) let objects hold other roots. The write left to a handler follows
Vernon EAD II p. 9 and MS; that it is MUST is this rule's, since P10 counts a retry forced by an
untied write as a failure. Failing each other only where a business rule ties follows Vernon EAD I
p. 3 (false invariants).

### P11. No other system changes the records a system owns, or reads them except through its published language

*Scope:* code of a system of this codebase, or configuration this codebase writes for an external
system, reads or changes a record another system owns; or an external system keeps a record a
system of this codebase owns.
*Statement:* Such code MUST change a record another system owns only through the owner's open host
service or a command the owner's published language declares, and MUST read it only through that
open host service or the owner's published events delivered to a handler of the reading system.
Where an external system keeps a record a system of this codebase owns, this codebase MUST configure
it so that nothing but the owner's use cases changes the record, and its configuration MAY read the
record where it keeps it.
*Why:* The owner's business rules decide what a record holds (glossary: Owner). A write that runs
none of the owner's use cases is a write those rules never saw: billing sets shop's order to
`invoiced` with an `UPDATE` on the table both systems keep in one Postgres, and shop's rule that an
order cancelled is never invoiced did not run; no message tells of the change, and shop's next save
of the order, loaded a moment earlier, writes over it or is refused for a change no use case of
shop made. A read past the owner's open host service and published events reads the record in the
owner's storage shape: billing's report joins `shop.orders`, shop renames `total` to
`total_gross`, and the report breaks at runtime with no compile error; where it does not break, it
reads a `status` whose meaning shop's rules decide and the report guesses. Each system's model
then changes only where the other lets it, which is F8 from both sides.

The mechanism is the channel, not the location. Every route to the record that is not one of the
owner's channels is refused alike, whatever it is: a join or a query across a shared store, a deep
import of the owner's repository, a builder of the owner that hands its repositories out, a read of
the owner's outbox table (it holds published events, but it is the owner's store, read past its
published language, and a message there may yet roll back), code in an external system's
configuration that writes the owner's tables. The owner's channels are its offer on purpose: its
open host service, in-process a function call, out of process a request; the commands it takes; the
events it publishes, which reach the reader through the bus, never at rest. A change through them
runs one of the owner's use cases, so the owner's business rules decide it and may refuse it. A read
through them is in the owner's published language, which holds still while the model moves (P13
delivers that). For an external owner, its API is its open host service and what that API is typed
by its published language (Assumptions): shop changes a Stripe PaymentIntent through Stripe's API
and learns of its change through Stripe's events at its hook, a handler.

The first sentence holds for every system, external owners included. The second keeps an external
system that keeps this system's record from changing it by its own admin, its API, or code in its
configuration. An external system holds none of the properties (F9), so the rule binds what this
codebase writes and configures, not the vendor: a field an editor cannot change in Payload's admin,
an API key that cannot write it. Which channel a change takes, a command through the outbox or a
call, and when it goes against this system's commit, P8 delivers; that the call carries no
transaction, P16 delivers.

What is not reached is not refused. A replica's records are its keeper's (glossary: Owner), filled
from what the owner publishes or returns to it (glossary: Replica), so reading one's own replica is
no read of another system's record; the same holds for a snapshot, this system's fact from the
moment it is copied. Data the owner hands over, the order lines in a `ReserveStock` command shop
sends fulfillment, a field of an event, is a message in a published language, not a record of the
owner's store, and the receiver reads it as handed. A reconciliation reads the other system through
its open host service and repairs the other's record by starting the owner's step, never by writing
it. A step that undoes another system's, the payment refunded, is asked of its owner. A shared
kernel is part of each sharing system's domain model, shared as code, not records. The relay and the
outbox reader are no system: the relay reaches each outbox through the reader its owner provides.
Tooling, a migration or a one-off script, sits outside the rules (Assumptions).

The exception is the external keeper. An external system that keeps another system's record
stores it, shows it, and its configuration reads it where it is kept, since that is what keeping
is; what it may not do is change it by any way but the owner's use cases, which reach it through
the owner's driven adapter. Where the business wants the record changed through the external
keeper's ways in, the keeper hands the change to the owner's use case, and keeps the record as
before. Another system that needs the record holds a copy, never the record: in a travel
business the fare in the tariff is pricing's, the fare on an issued ticket is booking's snapshot,
and the fares search answers from are search's replica.
*Provenance:* Follows Evans, Bounded Context (p. 239, P11's), Evans p. 114 ("Processes outside the
object system should not access such an object store. They could violate the invariants enforced
by the objects"), Helland 2005 §1.3 (only the owner's logic changes its data) and §6.5 (no access
to the data "unless it is mediated by the application logic of the service"), and Richardson
(Database per service: data "accessible only via its API"; API Composition; CQRS). Events as a
read channel follow Fowler (Event-Carried State Transfer), Khononov p. 238 and MS (integration
events "for bringing domain state in sync"). The channel as the mechanism, for every system and the
configuration of external ones alike, is this document's. Departs: Richardson weighs a shared
database as a pattern with drawbacks (Shared database); Khononov p. 209 allows one during a
strangler migration; Evans p. 263 has an open host service pay off only with many integrations.

### P12. Another system's model enters this one only by choice

*Scope:* a system talks to an upstream system, an external system included, and its code meets
that upstream's published language.
*Statement:* For each upstream, a system MUST either conform to it, taking its terms from its
published language and not stating them again, or reach that published language, or generate from
it, only by its adapters that carry a call or a message between the two. A published language MUST
NOT reach another system's published language, nor a shared kernel any system's.
*Why:* Every system that talks to another meets its terms: billing's `Invoice`, Stripe's
`PaymentIntent`, Payload's generated `Product`. The harm is not that those terms enter but that they
enter halfway. Shop's domain imports billing's `DunningStage` because a schema was at hand; an agent
editing the next module (F3) sees it there and uses it again; billing renames a stage on its own
schedule (F8), and shop's checkout, its routes and its tests change with it, found by whoever runs
shop next. A reader of shop's domain cannot tell billing's term there from shop's own. The glossary
gives the two choices a downstream has. A conformist takes the upstream as it is: its terms in any
layer, the domain included, every change there a change here, and that cost accepted (F9: an
external system's contract is take it or leave it). An anti-corruption layer translates in the
adapters that touch the upstream, and a change there edits those adapters and nothing behind them.
Either is a choice. What this rule rules out is the third state, which is no choice: the upstream's
terms in the domain here, translated in an adapter there, so that the system pays a conformist's
cost without knowing it and an anti-corruption layer's without its protection.

Which of the two a system is to an upstream shows in its code. The upstream's terms past the
adapters make it a conformist, and a conformist translates nowhere short of its own published
language (the second sentence): an adapter that turns billing's `Invoice` into a type of shop's,
while shop's domain holds billing's `DunningStage`, is the third state. How a codebase marks the
choice, if at all, is its own: a module of the system that re-exports the upstream's published
language for the rest to import is one way.

The anti-corruption layer is stated as a reach. Reach includes what a module is typed by (glossary),
so `import type` of billing's schema into shop's service, or a driven port whose signature returns
billing's `Invoice`, is the upstream's term in the service. The adapters it lets through are those
the two systems talk across: the driven adapter that calls billing's open host service, in-process
or over HTTP; the driven adapter behind a port of shop's own that turns shop's terms into
fulfillment's `ReserveStock` and writes it to shop's outbox; the handler that parses billing's
`InvoicePaid` with billing's schema; the hook Stripe calls, which verifies and parses Stripe's event
with Stripe's package. Each hands the system its own terms, so the domain, the services, the ports
and the system's own published language never learn the upstream's. A route of shop's that renders
billing's `Invoice` type to the browser is no such adapter: it carries nothing between shop and
billing, and billing's term reaches shop's browser through it. A generator that copies billing's
enum into shop's domain on every build is the import one step removed, as is the domain copied into
a published language (P13): shop's module imports nothing, and billing's next value is in shop's
model all the same. A replica and a snapshot are projected into this system's terms by definition
(glossary); the handler or adapter that fills one is where the projection happens.

Taking the terms from the published language is for the conformist. A conformist that restates its
upstream's schema in its own domain holds a second declaration of it, which drifts on the upstream's
schedule: billing adds a stage, shop's copy lacks it, and shop finds out at runtime, on a record.
Taking the terms from the upstream's published language, its export path or an external system's
package (Assumptions), turns the same change into a compile error in every module that uses it: the
change there is still a change here, but it is found at once, which is what the choice accepted. An
external system that offers its published language only as documentation is stated in code once, in
the module the conformist then reaches; stated a second time, it is restated. An adapter of an
anti-corruption layer that restates the upstream's schema rather than parsing with it drifts too;
the drift stops at that adapter, and P14 delivers that a message means the same to all code that
reads it.

The second sentence keeps one system's choice from becoming another's. Shop conforms to billing and
re-exports billing's `DunningStage` in its own published language; fulfillment, which translates
shop's terms in its adapters, now holds billing's term it never chose, and changes on billing's
schedule while believing it depends on shop. A shared kernel that imports billing's `Currency` puts
billing's model into every domain that shares the kernel. So a conformist translates at its own
published language even where it translates nowhere else, and a kernel holds only what the systems
sharing it agreed on. A shared kernel is itself the third way a model enters by choice (glossary:
agreed on together); this rule rules nothing else about it.

Which layer may reach an upstream's open host service as well as its published language, and that
each layer stays pure or loads on every runtime, is P1's and P5's to rule; this rule says only whose
terms may be there. That the upstream offers nothing of its model beyond its published language, so
that nothing else can enter, P13 delivers this, and P11 delivers that no system reads another's
records past it. Ports in the system's own terms P5 delivers; this rule says when an upstream's
terms are the system's own. A conformist's business rules stay its own, written in its upstream's
terms: P1 and P2 deliver this.
*Provenance:* Follows Evans, Ubiquitous Language (p. 26) and Khononov p. 46 ("ubiquitous language
should be consistent within the scope of its bounded context"); the two choices follow Khononov p.
53 (conformist, anticorruption layer, open-host service). The shared kernel's bounds follow Khononov
p. 51 ("Ideally, the shared kernel will consist only of integration contracts and data structures").
The reach that stops at the adapters carrying a call or a message, and the conformist's terms
imported rather than restated, are this document's. Departs: Martin (The Dependency Rule) keeps the
data formats of an outer circle out of an inner one, against the conformist's import into its
domain.

### P13. A system changes its model without its downstream systems changing

*Scope:* a system is upstream of another: code of the other imports from it, calls its open host
service, handles its events or sends it commands.
*Statement:* Code of another system MUST import of a system only its offer, and of that only what is
typed by its published language, a shared kernel or pure code of no system. What crosses between two
systems, by a call or in a message, MUST be of the upstream system's published language, or of a
shared kernel both share. The modules that declare a published language MUST reach nothing of their
system outside it, nor be generated from the rest of it, and MAY state in their own terms what a
business rule of the domain also states.
*Why:* A downstream system breaks at a refactoring of its upstream's model wherever its code, or
what it receives, names that model. There are three ways it comes to: the downstream imports the
model, the upstream hands the model across, or the contract is the model under another name. The
Statement closes each in turn.

The first sentence is about the downstream's imports. A deep import past an export path reaches a
service, a driven port, a repository or the domain, and holds whatever file layout it found
there, so the upstream's change is tied to its importer's. Only the offer is imported, and of the
offer only what is typed by the published language: the driving port types of the open host
service, which take and return the published language, and their fake, whose scenario data is
given in the same terms. A system builder is in the offer for assembly. Assembly is no system, and
a downstream that imports a builder holds whatever it returns: a builder that returns shop's
repositories "for the dashboard" hands the dashboard shop's aggregates, and shop changes its model
by changing its downstream. The line is drawn on import paths, so a linter holds it and the breach
shows in the diff. The downstream's own tests are code of the downstream too, and fake the upstream
through the fake the offer exports.

The second sentence is about what crosses at runtime, which no import shows. A route that serves
another system and serializes the aggregate it got from the domain sends the model over the wire:
the downstream parses fields that move with every refactoring, and no compiler on either side sees
it. What crosses is the upstream's published language, and the glossary says which system is
upstream: the one whose open host service is called, whose event is handled, whose command is sent.
So a command is the receiver's: shop's `ReserveStock`, declared in shop's published language,
makes fulfillment's handler parse a shape shop decides, and fulfillment's next change to its
reservations is a change to shop. That `reserveUntil` is worked out in shop at all is a business
rule of fulfillment's outside its domain; P2 delivers this. A private message is in no published
language: billing subscribed to payment's `StripeRefundRequested` parses a schema payment changes
whenever it likes, and payment's next rename breaks billing with no contract to tell either. Its
other harm, acting on a step the writer has not taken, is not this property's. Toward an external
upstream the sentence holds too: a hook takes the external system's event in that system's terms,
which is the downstream's side of the same line.

The third sentence is about the contract itself. A published language that re-exports the domain's
schemas, picks from them, extends them or reuses a domain enum is the domain: every refactoring of
the model changes the contract, and each one then has to keep both directions readable for old and
new downstream code. A generator that copies the domain's enum into the published language on each
build is the same import one step removed: the published module imports nothing, and the domain's
next value reaches every downstream parser; it shows as tooling that reads the system and writes
the published language. A published language derived from the store's table definitions is the
same harm through the store instead of the model, and the same sentence refuses it, since the line
is the published language's own modules, not the domain alone. Kept apart, the shapes may match at
first; they are still two. The service translates between them, and where a change of the model
does meet the contract, the translation fails to compile: the change is made there, and the
contract changes on its own terms or not at all. When it does change, P14 delivers what the
downstream code then still reads.

The MAY follows from the third sentence. A contract that may not import the domain's schema still
has to say what a downstream may send: `quantity` positive, the tax class one of three. Saying it
again in the contract's terms is the contract's statement, not a copy of the business rule: where
the domain comes to allow a zero quantity, the contract refuses it until the contract changes, and
the translation is where the difference shows. The permission is the published language's alone: a
driving adapter that restates the domain's schema beside it is a second statement of a business
rule, which P2 delivers against.

What the Statement leaves alone, and why. A shared kernel is part of each sharing system's domain
model, and a change to it is a change to each by definition (glossary: Shared kernel); between its
sharers, what crosses may be of it instead of a published language, and that coupling is chosen
together. A published language carries none of it: it is open to every downstream, and one that
shares no kernel would receive a part of the host's model. A conformist takes its upstream's
published language into its own domain; its downstream reliance is still on the upstream's published
language, never on the upstream's model, so the upstream's model moves freely, and a change to that
published language reaches the conformist by its own choice (P12). Assembly and tooling are no
system: assembly reaches a system through its builders, and tooling reaches past the offer at its
own risk. The system's own driving adapters are the system's code wherever a framework wants the
file (glossary: System), and its own browser code rendering a form from the domain's schema is the
system's too: neither is another system. What another system reads of the records this system owns
is P11's: P11 delivers this. What loads along with the offer, a store client in a browser bundle, a
fake in a production process, changes no downstream code when the model moves, and is not ruled
here.
*Provenance:* The open host service holding still while the model moves follows Khononov p. 55 ("the
freedom to evolve its implementation without affecting the downstream contexts"; the supplier
decouples the implementation model from the public interface) and p. 41 (each bounded context
"implemented, evolved, and versioned independently"), with intrusive coupling (coupling.dev,
Integration strength). The published language apart from the model follows Evans p. 278 ("do not
equate the interchange language and the model of the host"), p. 264 (a model used as the interchange
"essentially becomes frozen"), Reference p. 36, Khononov p. 140 ("a common mistake to design and
expose a published language for the model's objects"), p. 229 and p. 244, and MS (domain and
integration events: "their implementation must be different"). The command as the receiver's follows
NServiceBus (a command "Has one logical owner") and Khononov p. 235. The contract's own constraint
follows Evans p. 278 and MS (two-step validation). The shared kernel as its sharers' contract
follows Khononov p. 51 ("integration contracts and data structures that are intended to be passed
across the bounded contexts' boundaries") and p. 50 (cooperation), and Evans p. 251. The offer as
the only import, its linter, the private message, and the MAY against a business rule stated once
are this document's. Departs: Khononov p. 207 makes the open host service conditional when
retrofitting; Evans p. 263 has it pay off only with many integrations, where this rule asks it of
every downstream; MS advises against a shared library of integration events, where the offer exports
the published language.

### P14. A record or a message means the same to all code that reads it, whenever it was written

*Scope:* a message, a record a system keeps, or an open host service's driving port called from
another process: its schema as stated, and every change to it.
*Statement:* Each message MUST have one schema, stated once, that its writer and every reader parse
with. A change to the schema of any of them MUST let code written before it and code written after
it each read what the other produces as the other meant it and, where it saves it back, lose nothing
of it. A change that cannot MUST be a new version, which new code writes or offers beside the old
while code that knows only the old runs, reading the old until nothing written in it waits.
*Why:* A record or a message is read by code that did not write it, some of it not yet written. A
deploy replaces processes one at a time, so old and new code run side by side. A message written
before a deploy waits in the outbox and is handled after it, or waits days in a dead-letter queue;
a downstream system deploys on its own schedule and handles this system's published events with
code written for last month's schema; a record written years ago is loaded by today's code. The
type checker sees none of this: the stored message is not in the program, so a renamed field
compiles and fails at runtime, on a message nobody sends again.

The rule has a where and a how. Where: one schema per message, parsed with by the writer and by
every handler. A message written as `payload: unknown` and parsed by hand in each handler has as
many shapes as handlers, each drifting on its own, and two handlers of one deploy read one message
two ways; with one schema the change is made in one place and the compiler finds every reader in
this codebase. Where that schema lives is not this rule's: a published message's is its system's
published language, kept apart from the domain (P13 delivers this), a private message's is the
system's own; the envelope the relay and the bus carry it in is the common library's and holds no
system's shape. A record gets its one statement from the domain's schema, which the driven
adapters parse with rather than restate (P2 delivers this).

How: a change is judged from both sides of it. "Code written before the change" is every reader
and writer still built on the old schema, however long it runs: a process not yet restarted, a
downstream handler, a parked message's eventual handler. An optional field added or removed keeps
both directions. A field renamed, a required one added or removed, a type changed, an enum value
added or removed, a meaning changed (an amount from cents to euros) breaks one. "As the other meant
it" is the test, not "parses": shop adds `paidByInvoice` to `OrderPlaced`, optional, and every old
handler parses the new message; but before the field every `OrderPlaced` was paid by card, and
billing's old handler, reading an order without it, waits to invoice on an `OrderPaid` that never
comes. No field changed meaning; the absence did, and the old reader reads in the message what
shop did not mean, so the Statement refuses it. A gift message added the same way passes: an old
handler that cannot show it ships the parcel without the note, and what it read of the order was
true. "Lose nothing of it" is the record's half: the old process loads a row the new code wrote,
drops the field it does not know, and saves the row back, and the new code's write is gone. A
change that ships the readers first, knowing the field and writing none, and the writer once no
old process runs, keeps it; so does one that keeps the new field where the old code's save does
not reach.

A change that cannot keep both sides goes through versions. New code writes the old message beside
the new, or offers the old port beside the new, while old code runs, and reads the old until none
waits: the outbox drained, the dead-letter queue emptied, the records rewritten. The old version is
written for what it can still say truly: card orders keep their `OrderPlaced`, invoice orders go
out only as the new message, and billing's old handler is told by its subscription that it knows
nothing of pay by invoice rather than told something false. A published language offering two
versions at once is the same mechanism across systems.

The port's half: an open host service called from another process meets old and new code the same
way, a downstream process still on old code calling the upstream's new one, and an error the new
code raises reaching a caller that knows none of it. Called in the same process, port and caller
are compiled and deployed together and the type checker sees both sides, so the Scope leaves the
port out; a message such an in-process upstream writes stays in it. An external system's schemas
change on its schedule (F9) and this rule cannot ask anything of them; how far its terms reach
into this system is P12's.

Neighbours tied to deploys that rule elsewhere: the version a message carries of what it tells of,
so a receiver keeps the later change, is P18's, not a version of the schema; reading another
system's store past its published language, broken by the owner's schema change, is P11's; a command
declared by its sender, waiting in the old shape in the sender's outbox, is P12's and P13's; a
configuration value or ambient value differing between the old and the new image decides
differently, it does not read a record differently, and is P2's and P4's.
*Provenance:* Follows protobuf (Dos and Don'ts: "Clients and servers are never updated at exactly
the same time"), Confluent (full compatibility lets producers and consumers upgrade independently;
an incompatible change as a new topic), Khononov p. 55 ("simultaneously expose multiple versions")
and p. 243 ("if an event's schema changes, the subscribers' projection logic will fail"), and
Helland 2005 (stable data has "an unambiguous and unchanging interpretation"; §3.4, a changed
meaning as a new version). One schema stated once is this document's; the test by what the writer
meant, which takes in a field whose absence is read as a fact, is this document's. Departs:
Confluent defaults to one direction plus an upgrade order; Helland 2005 §3.4 goes further, every
change a new version.

### P15. A use case works while other systems are down or slow, unless a business rule needs another system's answer now

*Scope:* a use case needs to know something another system holds, or needs another system to act.
*Statement:* A use case not called for a message MUST NOT depend on another system answering while
it runs, unless a business rule of its system, or of a caller held on it, needs that system's answer
now, to a read or to an act, for what the use case answers or decides before it returns. What else
it needs another system to do it MUST ask for by a message.
*Why:* A use case that depends on another system answering is down whenever that system is, and slow
whenever it is: checkout that asks billing for the customer's dunning stage takes no orders while
billing deploys, and a use case that depends on three systems is up only while all three are. The
dependency is what matters, not where the call sits. Reach stops at a port (glossary: Reach), so a
service that calls a driven port reaches the port; the adapter behind it that calls billing, or
answers from a cache and calls billing on a miss, still makes the use case depend on billing, and
the Statement holds for it as surely as for a call written in the service. An upstream in the same
process is no exception: its store can be down while this system's is up, and moving it out of
process changes assembly and nothing in this service, so the rule holds for it from the start.

The harm is a caller held on another system's answer, so the Statement holds the use cases a caller
holds on and leaves out the one called for a message: the use case that wrote the message returned
long before, and nobody is held on the one called for it.

What the use case needs to know of another system it has without asking that system, and how is the
implementer's: a replica, filled from the owner's published events or from what the owner returned
to this system's own calls; a snapshot an aggregate keeps, the price the order was placed at; the
message carrying it; an argument its caller passes. Each answers while the owner is down. Each may
be older than the owner's state, and whether a decision may rest on it is a business rule's to say;
P10 delivers this. What the use case needs another system to do goes as a message, which commits
with the use case and is handled once the other system is back: shop asks fulfillment to reserve
stock by a command, a tentative operation shop cancels when the order is cancelled, and checkout
succeeds while fulfillment is down. That the message is written in the use case's transaction, and
is not lost after, is P8's; P8 delivers this.

The exception is where the dependency is the use case's nature: a business rule that needs the other
system's answer now, to a read or to an act. The customer pays now, so checkout asks Stripe for a
PaymentIntent and hands the browser its `client_secret`; at the payment deadline a reconciliation
asks Stripe whether the order was paid. Such a use case fails while the other system is down,
visibly, and is slow while it is slow, and both are expected. For an act, the line is whether what
the use case answers or decides hangs on the act's outcome: the card charged or refused before the
order is confirmed; a confirmation mail hangs on nothing and goes by message. For a read, the line
between the exception and what the use case has without asking is drawn by how old the business rule
lets the answer be: where it accepts what the owner said a while ago, through the owner's downtime
too, a replica serves; where it accepts only what the owner says now, the use case calls. Either way
the answer can change before the commit, and what follows then is P10's, for the live answer as for
the replica.

A use case called for a message may ask another system while it runs. Fulfillment's use case for
`BookShipment` books the 3PL, and a mail is sent for the message that asks for it: their whole job
is the other system's answer, and without them the change could be made nowhere. A handler acting on
an external system's change recorded provisionally reads that system's committed state first. A
message that only tells that a thing changed is answered by asking its sender for the thing's state
(Khononov p. 246). While the other system is down the use case fails, and the bus keeps the message
and delivers it again; P9 delivers that the repeat changes nothing, and a message that parks before
the other system is back is P17's.

Reading another system only through its open host service or its published events is P11's. A use
case may call another system after its transaction commits; P8 rules that such a call is safe, P9
that its repeat changes nothing, and this rule when it is made: where a business rule needs the
answer now. A use case called by one held on it is held too: payment, called by checkout for the
`client_secret`, opens the intent at Stripe while checkout's caller waits, and the rule it answers
to is checkout's. A PaymentIntent nobody needs at once, for an invoice mailed tomorrow, is asked for
by a message.

The rule governs the use case. A driving adapter that depends on another system answering before it
calls the use case holds the way in the same way; what a driving adapter may reach is P5's, and P5
delivers this. A scheduled task that polls a bank for transfers is a driving adapter nobody is held
on: it hands each transfer on as a message (P9), and a bank that is down delays the poll, not a
caller.
*Provenance:* The harm follows Richardson (runtime coupling: "the degree to which the availability
of one service is affected by the availability of another service"; respond "without waiting for the
response from any other service") and MS ("try not to depend on other internal microservices as part
of the initial service's HTTP request/response operation"). Having it without asking follows
Khononov p. 238 (event-carried state transfer: "the consumers can continue functioning even if the
producer is not available") and p. 246 ("If the components can settle for eventually consistent
data, use the event-carried state transfer message"), Fowler (What do you mean by "Event-Driven"?,
Event-Carried State Transfer), Helland 2005 (operands from published reference data) and Evans p. 97
(the item holds its own price). The exception follows Khononov p. 237 and p. 246 ("If the consumer
needs to read the last write in the producer's state, issue an event notification message, with a
subsequent query"). Asking another system to act by a message follows Evans Reference p. 16 ("Across
boundaries, handle updates asynchronously") and MS (integration events "must be based on
asynchronous communication"); the call made by the use case called for the message follows Khononov
p. 149–150 ("the command execution logic should be moved out of the saga itself") and Fowler, who
finds it "usually easier just to call the sender". The act's need follows Brandur (Idempotency keys:
a caller that "needs to know in-band whether it went through so that it can decide whether to
proffer some good or service"). Departs: Richardson answers even a business rule's need with a
pending outcome, not a call, and keeps every service self-contained; MS keeps request/response "only
from the client apps to the front-end services"; Udi Dahan puts two entities that "just HAVE to have
request/response communication" in one service: here a system of this codebase is called as any
other, the dependency ruled by the need, not by who wrote the callee; Khononov's simple saga calls
the other context directly (p. 148). Against: EIP (Command Message) and Richardson (Messaging) give
the synchronous call as the usual alternative. The dependency behind a port counted as the use
case's, and the use case called for a message left out, are this document's.

### P16. No transaction spans two systems

*Scope:* a transaction a system opens, and each call between two systems, in either direction,
in-process or not.
*Statement:* A transaction MUST read and write only records owned by the system that opened it.
It MUST travel only as an argument, never as an ambient value, and a call into another system,
through a driving port or an external system's API, MUST NOT carry it. A driving port MUST NOT
take a transaction, nor anything else that reaches a store, whatever type it is declared as.
*Why:* A transaction two systems share commits only where both systems' business rules and code
let it, so neither changes alone. Shop's rollback undoes what billing decided inside it; billing
decides what to invoice by an order shop has not committed and may roll back a line later; the
upstream's store is bound to whatever the downstream opened, and the call stops working the day
the upstream moves to its own process, though nothing in its signature said it depended on
sharing one. Each system committing its own part is what lets P17's work spanning systems be
reasoned about at all.

The first sentence says what spanning is, by records and their owner (glossary: Owner): a store may
keep records of several owners, so two systems in one Postgres are no permission, and a read counts
as much as a write: what the transaction decides on another system's records commits as if they were
its own, under its locks and isolation, past the other's business rules. Who writes does not matter:
billing's repository adapter writing billing's records in shop's transaction, and shop's adapter
writing shop's records in a transaction Payload opened, both put two owners' records into one
commit. Replicas, the outbox and the record of handled messages are the keeper's own and stay in.

The second and third sentences are how a transaction gets across, and both ends are shut. A
transaction kept ambient, in `AsyncLocalStorage`, is "accessible to any asynchronous operations
created within the callback": shop's checkout calls billing's open host service in-process, and
billing's repository adapters find shop's client and read the uncommitted order, with no signature
saying so. Handed only as an argument, it is visible in every signature it crosses and stops where a
call into another system takes none. On the callee's side, a driving port is the way in (glossary:
Port), so a port that takes no transaction lets none in; the clause is on the declaration so that
the compiler holds it, and on "anything else that reaches a store" because a Drizzle transaction is
assignable to the database type a port asks for. On the caller's side, an external system declares
no port of this codebase and takes whatever its API takes: Payload's Local API takes a `req` whose
`transactionID` puts catalog's hooks and Payload's own writes into shop's commit, so shop's rollback
undoes a change catalog already acted on. The inverse is the hook: Payload calls shop's hook with
its `req`, and the hook hands shop's driving port nothing of it, so shop's use case runs and commits
on its own.

What crosses instead is no part of this rule. What this system wants of another goes as a
message written in its own transaction, or as a call made outside it; P8 delivers this. A call
to another system's open host service while the transaction is open is allowed, carrying none:
the callee reads and writes in its own, and its answer is stale by the commit; P10 delivers
this. Where the outcomes of the parts diverge, P17 delivers what follows. Writing or reading
another system's records past its published language is refused by the first sentence and by
P11, which delivers it whatever transaction it runs in.

Four crossings are cases of the first sentence: the ambient transaction, the port that takes one,
the call into another system that carries one, and shop handing its transaction to Payload's Local
API, a port no system of this codebase declares. The crossing it names is any call between systems.
A port's transaction taking the place of the one its own service opens is one system's harm, and P7
delivers it; the port clause costs nothing there, since a port joins the open host service by being
exported, its declaration unchanged. Where two systems share one store, the first sentence settles
it: one store, two owners, two transactions. No exception: a shared kernel and the common library
own no records, a conformist takes its upstream's terms, not its transactions, and tooling, a
migration across two systems' tables, opens no system's transaction (Assumptions).
*Provenance:* Follows Helland 2007 ("Atomic Transactions Cannot Span Entities") and Richardson
(Database per service: "A service's transactions only involve its database"). The ambient
crossing is Node.js (Asynchronous context tracking). The rule on the port, on the caller's side
and on the record's owner is this document's. Against, in practice: MS shares the unit of work
through the request-scoped DbContext (Domain events, single transaction across aggregates).

### P17. Work spanning systems ends, and only in a state a business rule allows

*Scope:* a system's part of work spanning systems, under choreography or orchestration, a
tentative operation included, from the first step it takes in that work until its part ends.
*Statement:* A business rule of that system MUST decide how its part ends from each state it can
stand in, on whatever another system can send it there and on none coming, by completing the work,
by a step that undoes an earlier one, asked of the system that took it, or by accepting the state as
it stands. Where its part waits on another system, it MUST hold the moment it stops waiting in an
aggregate of its own, if:
- it holds something until the answer comes, a tentative operation it took or asked for
  included, or
- a business rule limits how long it may wait.

A status that only shows how far another system has got, with nothing of this system's hanging on
it, is no wait. A refusal of a step MUST be committed as the step's outcome and reach the system
that decided the step, and a failure that neither gave nor refused MUST NOT be committed as one.
*Why:* Each system commits its own part (P16), so the parts diverge. Another system says yes and
then fails, stops answering, refuses, or answers after this one has moved on. Two harms follow,
and both are found by a customer. Work that never ends: the tea shop's order waits as "payment
pending" for a webhook Stripe stopped sending while the card was charged; stock stays reserved for
a checkout nobody completes; a command sits parked in a dead-letter queue while its sender waits
for an answer. Work that ends in a half nobody chose: the payment arrives for an order the deadline
already cancelled, and the use case either returns, so the card stays charged for nothing, or
throws, so the bus delivers the event until it parks it, and the card stays charged there.

The first sentence closes the list of endings. Completing, undoing and accepting are each something
a business rule can allow; everything else is not an ending. Asking again forever, postponing the
question, returning because the order is already cancelled, throwing until the message parks: none
is one of the three, and none is a business rule's choice, so the Statement refuses each. A handler
that returns is not "accepting the state": accepting is written down as a business rule, where a
reader finds it (P2 delivers where). The rule is the system's whose part it is. Under orchestration
that is the orchestrating system, which holds the sequence (glossary: Orchestration); under
choreography each system decides for its own part (glossary: Choreography). The system an event
reaches decides, holding the state the event meets; the step it would undo stays the other system's,
so undoing is asked of that system, which may refuse, and the refusal comes back under the fourth
sentence. The late payment is refunded, asked of payment; or the order is reinstated; or the
business accepts keeping the money and says so. A use case that carries out a change another use
case decided does not decide whether it is still wanted: that question, and the deadline it hangs
on, sit with the system that decided the change (P8 delivers the executor's side).

The second sentence makes the waiting end without the other system. The delivery rules reach no
message the other system stopped sending, and none a dead-letter queue keeps: nothing in this system
changes until it arrives, unless this system holds what makes it change. A deadline in its own
aggregate, the order's payment deadline, acts when it passes whatever the other system does. A
deadline is a business fact, a grace period, the hours a hold lasts, so it is held where the
business's facts are. What starts it once it passes is the clock (Assumptions), which can come late,
so the use case it starts decides by the aggregate: a deadline the answer already met finds the
answer there, and one moved since finds the new moment. At the deadline the rule may ask the other
system, a reconciliation, but it still decides on no answer: a reconciliation that asks again
forever is the waiting renamed. Held in the aggregate the late answer also loads, the deadline and
the answer meet on one aggregate, and which of them wins is a business rule's, not a race's (P10
delivers the race). Waiting covers these cases: the end of a tentative operation this system took,
which its asker confirms or cancels; an external system's change recorded provisionally until
confirmed; an answer to a command this system sent; a message the other system was to send. A system
that publishes an event and waits for nothing has no part to end there and falls outside the second
sentence. Nor does a status that only shows another system's progress: a ticket issued on account
shows "payment open" until billing's event says paid, nothing of booking's hangs on it, and billing,
which collects, ends the matter on its own deadline. Where booking's own rule cancels a ticket
unpaid after 14 days, booking waits, and the 14 days are its moment. What makes a part wait is what
it holds until the answer comes, a seat, stock, a tentative operation, or a business rule's limit on
how long it may wait.

The fourth sentence is what lets the first decide on what actually happened. A refusal that throws
fails its use case: the handler does not acknowledge, the bus redelivers, the same business rule
refuses again, the bus parks it, and the sender learns nothing. Shop asked payment for a refund,
payment refuses it for a disputed charge, and shop tells the customer the money is on its way.
Committed as the outcome, the refund marked refused, the shipment marked unbooked with the 3PL's
reason, the use case has succeeded, the handler acknowledges, and the refusal reaches the system
that decided the step, which ends its part by the first sentence. Where that system is another,
the refusal reaches it as an event; where it is this one, the record is where its own use cases
read it. The refusal may come from a system asked in turn, an external system that declines: the
use case that asked records it the same way. The adapter tells a refusal from a failure in the
external system's terms, a decline from a timeout, and that line is the adapter's. A failure, a
store briefly down, a save that lost a race, a bug, is no refusal: committed as one, payment's
lost race recorded as `RefundRefused`, it ends the work for a reason no business rule gave. It
fails instead, commits nothing, and is delivered again (P8 delivers that it is not lost); a
failure no retry cures parks where an operator finds it, and the waiting system's deadline still
ends that system's part.

How the refusal reaches the deciding system is left open here: published as an event of the
receiver's own published language naming no sender, it keeps the receiver free of its senders (P12
delivers this). That a repeated answer changes nothing is P9's; that a message arriving before the
one it follows does not change the ending is P18's.

An external system holds none of this (F9): Stripe stops resending when it chooses. The rule
governs this system's part, which ends whatever the external system does.
*Provenance:* Follows Helland 2007 p. 140 ("Every tentative operation eventually confirms or
cancels"; "When an entity agrees to perform a tentative operation, it agrees to let another entity
decide the outcome") and NServiceBus (Saga timeouts: how long to wait is the business's to say). The
undo follows Richardson (Saga: a step that "violates a business rule" is undone by compensating
transactions), Khononov p. 235 ("The only thing that can be done to overturn an event is to issue a
compensating action") and p. 151 (the orchestrator he calls a process manager "determines the next
processing steps"), and Vernon EAD II p. 8–9 ("compensate, or at a minimum to report the failure for
pending intervention"). The refusal as outcome follows Khononov p. 235 (a command "can be rejected")
and p. 148 (rejection as an event the saga handles); failure retried and parked follows EIP
(Transactional Client) and NServiceBus (Outbox: the error queue). Departs: Richardson's orchestrated
participant and NServiceBus reply to the sender; this rule leaves the route open. The deadline held
in the aggregate follows Evans p. 161 and p. 163 (due date plus grace period, selected by the
repository once past) and Khononov p. 88 and p. 102 (time left held and checked in the aggregate;
the payment deadline in the order's event). What makes a part wait follows Helland 2007 p. 140 and
p. 141 (the tentative operation, which holds, against the activity, what one remembers of a partner)
and NServiceBus (Saga timeouts: "an upper limit on the waiting period that the business dictates").
The closed list of endings and the line between a refusal and a failure are this document's.

### P18. The order messages arrive in does not change the outcome

*Scope:* messages that tell of the same thing, written by one system or by several, and the use
cases called for them.
*Statement:* A use case called for a message MUST leave the records of what it tells of as the
messages about that thing, applied in the order they were written, would leave them, and MUST NOT
tell that order from when they arrive. The system that writes messages about one thing MUST let a
use case called for one tell that order, by what the message carries or by answering what the thing
is now. Where messages written by different systems conflict over one thing, a business rule of the
receiving system MUST decide which prevails.
*Why:* Arrival order is not the order of writing (F5). The relay hands a message over again after
a crash, the bus retries one that failed and backs off before it does, parks it and retries it
once the fault is fixed, and a redelivery runs while the first attempt still does; an external
system resends on its own terms, and Stripe sends its events in any order. Each of these lets a
message written later arrive first. A bus that promises order within a partition narrows this and
does not close it: the retry and the parked message still overtake, so the Statement rests on what
the messages carry, and on nothing the bus promises.

Two harms follow, and the Statement has a clause for each. The first: a message meets a state its
predecessor has not made yet. Fulfillment's `OrderCancelled` arrives before the `OrderPlaced` it
cancels; the use case finds no order, reads "not found" as "already handled" and acknowledges, and
the reservation made a moment later stays for a dead order. Applied in the order written, the cancel
would have found the order and the reservation would never stand, so the Statement refuses the drop
without naming it. Two means meet it. The use case records what the early message says, the cancel
kept for an order not yet seen, and the `OrderPlaced` that follows meets it and reserves nothing. Or
the use case fails, commits nothing, and the redelivery runs once the predecessor has landed; a
predecessor that never comes then parks the message where someone finds it, which is a failure a
retry may cure, not a refusal. Messages that do not override each other, a reservation and its
release, are ordered this way, by what they say: a release is a release whichever arrives first.

The second harm: messages that override each other, a status, a stage, where the receiver keeps the
last. The customer pays, billing clears the dunning stage, and shop's replica receives the reminder
stage, written before the clearing, after it: it keeps that stage and refuses pay-by-invoice to a
customer who owes nothing. From the message alone the receiver cannot tell the older. When it
arrived says nothing, and a time on the message is the clock of the process that wrote it, which the
next process disagrees with; ordered by that time, the records end as no order of writing left them,
which the first sentence refuses. The writer alone knows the order it changed the thing in, so the
writer lets the receiver tell it, in one of two ways. It carries a version: one counter per thing,
raised in the transaction that commits the change, the aggregate's version where it carries one; the
receiver keeps the higher and drops the lower. Or its message is a notice that the thing changed,
and the receiver asks it what the thing is now: two notices that arrive out of order both fetch the
latest, and the order no longer matters. The fetch costs the writer answering while the receiver
handles the message; a writer that is down fails the delivery, and the bus delivers it again (P15
leaves a use case called for a message free to ask). An equal version is the same change delivered
again, which P9 delivers. The version is of the thing the message tells of, not of the message's
schema; a schema's change is P14's.

Several writers share no counter. Payment and billing both telling shop of the same customer have
no order of writing between them that either can stamp, so which prevails is the business's, and
the business rule that says so sits in the receiving system's domain, where a reader finds it.

Messages about different things are outside the first clause's reach. Two `OrderPlaced` racing for
the last unit tell of two orders. Which arrives first is which was placed first as far as
fulfillment can know, and a business rule that gives the unit to the first is the outcome, not a
breach; whether the two may fail each other at all is P10's to deliver. A message that arrives
after a deadline passed, the payment after the order was cancelled for want of it, meets the clock,
not another message; what follows is P17's.

An external system holds none of the properties (F9): it is outside the rules, and the writer's
clause cannot bind it. Its messages are still delivered to a use case of this system, and the first
sentence holds for them: the receiver uses whichever means the external system offers, what its
messages say, a status that only moves forward, a version, or its API's answer to what the thing is
now. Where this codebase configures the external system, a version can be configured in, raised in
the transaction that commits the change. Items a driving adapter polls from another system, a bank's
transfers listed in its own order, fall under this rule once they are handed to a use case as
messages; handing them over as messages with the other system's id is P9's.
*Provenance:* The receiver's clause follows Khononov p. 245 ("Events will arrive out of order"),
Helland 2007 p. 138 and MS (an older price event overwriting a newer). The writer's clause follows
Khononov p. 245 ("When publishing messages, ensure that the subscribers will be able to deduplicate
the messages and identify and reorder out-of-order messages"), which puts the means on the
publisher; the notice answered by asking the writer follows Khononov p. 246. The version as one
counter per thing, and the business rule between writers, are this document's.

### P19. Within one system, each term has one meaning

*Scope:* code of a system uses a word with a meaning: in a module's names, schemas, messages,
tests or prose.
*Statement:* A term of a system MUST have one meaning, used in every module of the system. A word
taken from another system's offer MUST keep the meaning that system gives it, and where this system
has a term by that word in another meaning, every module that uses the word MUST name it apart from
that term.
*Why:* "Order" meaning checkout's order in one module and billing's invoiceable order in the next
is two models in one system. A change made for one meaning breaks code written for the other, and
an agent that read one module (F3) takes the meaning it found there for the system's and writes
the next module by it. Nothing fails to compile: both meanings fit the same word, often the same
type, and the drift shows when two parts of the system disagree about a business rule neither
writes down. The mechanism is one register per system. A system is one bounded context with its
own glossary (glossary: System); that glossary is where a term's meaning is stated, once, and
every module reads the word as the glossary has it. A meaning that changes (F2) changes in the
glossary first, and every module that uses the term follows; a partial edit that moves the
meaning in one module and leaves the rest is the breach the second sentence names. A word the
glossary does not hold is common language, read in its ordinary sense, or the system's next term,
entered before the code uses it; a word the code gives a meaning the glossary has not stated is a
meaning only the module that coined it knows. Where one word has to mean two things, one meaning
is renamed: checkout's order stays `Order`, billing's becomes `InvoiceableOrder`. Where the two
meanings belong to rules that change for different reasons, the system is split where they part;
P3 delivers where that split goes.

Other systems' words enter every system that talks to them, and the third sentence keeps them
from becoming a second meaning of a word here. Shop's anti-corruption layer reads billing's
`Order` in the driven adapter that calls billing; shop's own `Order` is another thing. The adapter
names billing's apart, `billing.Order` or `BillingOrder`; a local `order` holding billing's breaks
the second sentence, since a reader of the adapter takes it for shop's. The same holds for
an external system's package: Stripe's `Customer` in payment's hook is Stripe's customer, not the
customer payment's glossary defines, and is named as Stripe's. A conformist's glossary takes its
upstream's terms in the upstream's meaning (glossary: Conformist), so in its domain the upstream's
`Order` is its own term and needs no naming apart; a conformist whose glossary also gave `Order`
a meaning of its own would hold two, which the first sentence refuses. Whether a system conforms
or translates is a choice P12 delivers; this rule only keeps either choice to one meaning per
word. A shared kernel is no other system's offer: each system sharing it imports it into its
domain and agrees on it (glossary: Shared kernel), so its `Money` is a term of each sharing
system's glossary in the kernel's meaning, and a system that gave `Money` another meaning beside
it would hold two.

The architecture's own vocabulary, repository, handler, event, outbox, is common language of this
codebase and sits in every system's code. Where a system's business domain uses one of its words,
the Statement holds as for any other: a ticketing system whose glossary makes `Event` the concert
cannot also name its messages `TicketSoldEvent` in the message sense, and renames one of the two,
the concert a `Show` or the messages without the suffix.

Exceptions, and why they are exceptions. An external system's configuration is its own, in its
terms, even where this codebase writes it (glossary: External system): it is another bounded
context, and its words mean what its vendor says; what this system's code does with it falls under
the third sentence. Tooling runs in no process of the deployed application and sits outside the
rules. Meaning across time is not this rule's: that a stored record or a waiting message means to
new code what it meant to the code that wrote it is P14's, and P14 delivers this; that this
system's published language holds still while its terms move is P13's, and P13 delivers this.
*Provenance:* Follows Evans, Ubiquitous Language (p. 26) and Bounded Context (p. 239: "Keep the
model strictly consistent within these bounds") and Khononov p. 46 ("ubiquitous language should be
consistent within the scope of its bounded context"). The rule on code, the term entered before code
uses it, and another system's word named apart are this document's; the last follows Khononov p.
53's anti-corruption layer, carried from the model to the names.

## Conventions

Taste, not property: a codebase that does otherwise breaks nothing the world promises.

- A business rule is tested: the test SHOULD call the domain function directly.
- A test asserts: it SHOULD assert on inputs and observable results.
- An end-to-end test SHOULD NOT run automatically.
- A factory needs something the same in every instance, process and test: it SHOULD import it.
