# Layers

The glossary, the world and the property rules. Read whole.

**Why.** Where a decision contests a rule, or a Statement reads two ways: read the rule's entry
in `layers-why.md` (`## P<n>.`). It holds the property's and the rule's Why and Provenance.

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

**Observation.** Code that reaches the outside and changes neither how a use case acts nor what it
answers: logs, traces, metrics, error reports, profiling.

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
  directions.

## Between systems

**Message.** What one system tells another, or itself, so that it may act. It has an id, the same on
every delivery of it. An *event* says something happened; no receiver can refuse it. A *command*
says do this, to the one system that offers it, which may refuse. *Published*: meant for other
systems. *Private*: meant only for the system that wrote it.

**Outbox.** Where a system's outgoing messages wait until they are delivered. An *outbox port* is
a driven port a service writes messages through. The *outbox reader* is what the relay reads the
outbox through, and marks it by; the system provides it, and for an external system's outbox,
assembly does.

**Handler.** A driving adapter that acts on messages delivered to its system.

**Bus.** What delivers a message to the handlers subscribed to it. Assembly hands it the handlers.

**Relay.** The mechanism that reads outboxes and hands each message to the bus. Assembly hands it
the outbox readers.

**Idempotent.** An operation is idempotent when repeating it leaves its system's records as
performing it once left them, and answers as the first did.

**Idempotency key.** What a call carries so that its receiver can tell a repeat: it names the change
the call asks for, the same on every attempt at it. A message's id does this for the message.

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
another system holds, and repairs this system's record, or starts the business process step that
repairs the other's.

**Business process.** A sequence of use cases that together reach what one business case asks, the
order placed, paid, shipped and invoiced, each committing its own transaction. It may run in one
system, by private messages, or span several; spanning systems, no transaction holds it whole.

**Business process step.** One use case of a business process, with what it asks of the next.

**Saga.** A business process spanning systems whose steps either all commit or, when one is refused,
end in new ones that undo, in business terms, those already committed.

**Choreography.** A business process spanning systems where each system reacts to the others' events
and decides its own next step; no system holds the whole sequence.

**Orchestration.** A business process spanning systems where one system holds the sequence and tells
the others by commands which step to take.

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

**Transaction port.** The driven port a service opens a transaction on one store through.

## Driving adapters

**Scheduled task.** A driving adapter the clock calls.

**Ambient value.** A value a function reads without receiving it as an argument. Two scopes: per
process, set once for the process's life; per request, what the current request carries.

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

**Courier.** How code reaches what assembly produced when assembly cannot hand it over as an
argument:
- a driving adapter nothing can hand it to: one a framework constructs, or one assembly builds
  before what it calls exists;
- observation reading a global its library keeps.

**Configuration value.** A value a process is given when it starts and keeps for its life, which
no record holds.

**Common library.** Code of this codebase that belongs to no system, shared so that systems need not
each write it. It has no layers and holds no business rule; code of a system that runs it is judged
as if it were written there.

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

---

# Property rules

One rule per property of the world, under the property's heading: Except and Against are the
property's, Scope and Statement are the rule, read as one. The glossary's terms, as spelled. Where
a property needs nothing a reader could breach, the entry says so. Conventions at the end are
taste, no property behind them.

## Assumptions

This document assumes a store that can be read and written, that can apply several writes atomically
where it says *transaction*, and that can make a write fail where the record has changed since it
was read, or where a record with the same key exists. It assumes no isolation between transactions
beyond reading committed writes: a transaction may read what another commits while it runs.

It also assumes the clock can start a use case once a moment has passed: a message held back until
then, or a sweep run on the clock. Either can come late, never early.

Every system gets the same architecture: domain, services, repositories and adapters, a simple one
too. That is this document's choice. The sources pick the architecture per subdomain and let simple
logic read and write the store directly; here no system is judged simple enough, and none is
rewritten when it grows business rules.

Not everything gets a layer. Assembly and a system's offer sit outside the layers. So do probes.
The common library has none: code that runs it is judged in its own layer.

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
whether a module that straddles two layers should be split now; how a driving adapter is tested, how
a test stands in for assembly, couriers included, and when the integration suite runs; how the bus
finds a message's handlers, by its type or by each handler filtering; how telemetry crosses a message,
a trace context on the envelope.

## Rules

### P1. The domain models the business domain and is shaped by nothing that serves it

*Except:* the terms of an upstream this system conforms to (P12); its business rules stay its own,
written in those terms.
*Against:* F1.
*Scope:* a module of a system's domain reaches code that is not of that domain.
*Statement:* A module of the domain MUST reach only its domain, a shared kernel imported into it
included, the published language of an upstream its system conforms to, or pure code of no system.
That pure code MUST be in no terms of the outside and MUST load on every runtime of the language.

### P2. A business rule lives in one place: the domain

*Against:* F2, F3.
*Scope:* code of this codebase states a business rule of a system, or needs what one decides.
*Statement:* A business rule of a system MUST be stated once, in its domain or in a shared kernel
that domain imports, with every value it decides by that is the same for every candidate and that no
record holds. Code anywhere else that needs what it decides MUST get it from that statement,
directly or through the system, and MUST NOT state it again.

### P3. Business rules that change together sit together; rules that change for different reasons stay apart

*Against:* F2.
*Scope:* a business rule is stated anywhere in this codebase, a shared kernel and the common
library included.
*Statement:* A business rule that decides what a record holds MUST be stated in the domain of the
record's owner. A shared kernel MUST hold no such rule and no record's schema, only value types and
what computes with them from arguments.

### P4. A use case responds the same whoever calls it and whatever serves it

*Against:* F1.
*Scope:* a use case runs, whichever driving adapter calls its driving port and whichever code
behind its driven ports serves it.
*Statement:* How a use case acts and what it answers MUST be decided by its service and its domain
from the arguments its driving port takes and what its driven ports return, and an ambient value or
a configuration value MUST NOT change either, whether the service reads it or code behind a port
does. A driving adapter MUST reach the system only through its driving ports, with at most one
acting call per call or message it handles, and MUST NOT withhold a call the service would accept.

### P5. A system reaches the outside, and is reached from it, only through ports assembly hands it; each port speaks the system's terms

*Except:* observation, where the process's assembly chooses what lies behind it.
*Against:* F1, F3, F8.
*Scope:* code of a system reaches the outside or the code behind a port, or anything outside a
system reaches into it.
*Statement:* A service MUST reach the outside only as a port of its system in the system's terms,
and an adapter or an outbox reader only as such a port or as the outside it adapts, each also
through observation. Anything outside a system MUST reach into it only through its offer or by a
driving adapter's way in. A port's implementation, a client of the outside, a configuration value or
observation MUST reach code of a system as an argument chosen by the process's assembly, or returned
by a port so chosen, or from a courier that only assembly fills, that reaches nothing until it does,
and that a driving adapter, or observation, reads each time it runs.

### P6. Every use case can run with nothing outside the process, in a test

*Against:* F1.
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

### P7. A use case's writes to its own system's records land together or not at all

*Against:* F4.
*Scope:* a caller reaches a goal through a system, and reaching it writes the system's records.
*Statement:* A use case MUST save at most one aggregate, or several only where a business rule ties
them, in one transaction that its service opens, that carries every write the use case makes, and
that its service commits once after the last write. Each driven port that writes MUST be handed that
transaction as an argument, to its methods or to what builds it inside the use case. Where a write
in it fails, the transaction MUST roll back whole.

### P8. An uncommitted write is not yet a fact: nothing final follows from it before it commits, and nothing that follows from it is lost after

*Against:* F4.
*Scope:* a use case writes a message or decides a change its transaction does not commit, a message
is delivered, or another system tells this system of a change before committing it.
*Statement:* A message a use case writes MUST go into the outbox in its transaction, and a change it
decides that the transaction does not commit MUST leave it only as such a message asking for the
change, or as a call to another system after the commit, made from a record the transaction
committed, from which a later use case repeats the call or ends the change. The outbox MUST keep
each message until the bus holds it, and the bus through any stop of a process until a handler
acknowledges it, which the handler MUST NOT do before the use case it calls has returned with its
writes committed. A use case called for such a message MUST act on the change, deciding nothing
again, and a change another system tells of before committing it MUST change nothing in this system
beyond a provisional record of it until it is confirmed. An external system this codebase
configures, whose transaction can write a message to an outbox, MUST tell of its change by such a
message.

### P9. A repeated delivery or call changes no record of this system, and succeeds where the first did

*Except:* a repeat that nothing it carries or left tells from a new request, where a business rule
allows what follows from it.
*Against:* F5, F9.
*Scope:* an acting use case, called by a call or for a message, whether the bus delivered it, a hook
was called with it, or a driving adapter asked another system for it.
*Statement:* The use case MUST tell a repeat inside the transaction that commits its writes, by the
message's id or the call's idempotency key claimed there, the store refusing a second claim of it,
or by the records it writes there, and finding the first's writes committed MUST commit nothing and
succeed. A change it makes outside that transaction, and a call after the commit, MUST carry to the
system that makes it an idempotency key, the same on every attempt at the change, whichever use case
makes it: the id of what the change is about, one derived from the record the transaction committed,
or the message's id or the call's idempotency key where it alone asks for the change; by that key
that system answers a repeat. Where neither the message's id, an idempotency key nor its records
tell a repeat, what the repeat does MUST be what a business rule of its system allows. Where no
idempotency key reaches the system that makes a change outside, and the change made twice ends
otherwise than made once, what follows from the repeat MUST be what a business rule of its system
allows: the repeat prevented, corrected afterwards, or accepted.

### P10. A use case commits only on reads that still hold, or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them

*Against:* F6.
*Scope:* an acting use case decides what it writes by data that other use cases, or other systems,
can change while it runs.
*Statement:* A use case MUST decide by data read inside the transaction that commits the decision,
and the store MUST fail that transaction's writes where the data has changed, or come to exist,
since the read. A decision on data whose change fails no transaction of this store MUST rest on a
business rule of its system that accepts the data stale and says what follows where it changed
meanwhile. Its writes MUST NOT fail on a change to records that no business rule ties to the use
case's goal.

### P11. No other system changes the records a system owns, or reads them except through its published language

*Against:* F8.
*Scope:* code of a system of this codebase, or configuration this codebase writes for an external
system, reads or changes a record another system owns; or an external system keeps a record a
system of this codebase owns.
*Statement:* Such code MUST change a record another system owns only through the owner's open host
service or a command the owner's published language declares, and MUST read it only through that
open host service or the owner's published events delivered to a handler of the reading system.
Where an external system keeps a record a system of this codebase owns, this codebase MUST configure
it so that nothing but the owner's use cases changes the record, and its configuration MAY read the
record where it keeps it.

### P12. Another system's model enters this one only by choice

*Against:* F8, F9.
*Scope:* a system talks to an upstream system, an external system included, and its code meets
that upstream's published language.
*Statement:* For each upstream, a system MUST either conform to it, taking its terms from its
published language and not stating them again, or reach that published language, or generate from
it, only by its adapters that carry a call or a message between the two. A published language MUST
NOT reach another system's published language.

### P13. A system changes its model without its downstream systems changing

*Against:* F8, seen from upstream.
*Scope:* a system is upstream of another: code of the other imports from it, calls its open host
service, handles its events or sends it commands.
*Statement:* Code of another system MUST import of a system only its offer, and of that only what is
typed by its published language or pure code of no system. What crosses between two systems, by a
call or in a message, MUST be of the upstream system's published language. The modules that declare
a published language MUST reach nothing of their system outside it, nor be generated from the rest
of it, and MAY state in their own terms what a business rule of the domain also states.

### P14. A record or a message means the same to all code that reads it, whenever it was written

*Against:* F4, F8.
*Scope:* a message, a record a system keeps, or an open host service's driving port called from
another process: its schema as stated, and every change to it.
*Statement:* Each message MUST have one schema, stated once, that its writer and every reader parse
with. A change to the schema of any of them MUST let code written before it and code written after
it each read what the other produces as the other meant it and, where it saves it back, lose nothing
of it. A change that cannot MUST be a new version, which new code writes or offers beside the old
while code that knows only the old runs, reading the old until nothing written in it waits.

### P15. A use case works while other systems are down or slow, unless a business rule needs another system's answer now

*Against:* F7.
*Scope:* a use case needs to know something another system holds, or needs another system to act.
*Statement:* A use case not called for a message MUST NOT depend on another system answering while
it runs, unless a business rule of its system, or of a caller that waits for its answer, on the open
call or by polling for it, needs that system's answer now, to a read or to an act, for what the
use case answers or decides before it returns. What else it needs another system to do it MUST ask
for by a message.

### P16. No transaction spans two systems

*Against:* F8.
*Scope:* a transaction a system opens, and each call between two systems, in either direction,
in-process or not.
*Statement:* A transaction MUST read and write only records owned by the system that opened it. A
call into another system, through a driving port or an external system's API, MUST NOT carry it. A
driving port MUST NOT take a transaction, nor anything else that reaches a store, whatever type it
is declared as.

### P17. A business process spanning systems ends, and only in a state a business rule allows

*Against:* F4, F7.
*Scope:* a system's part of a business process spanning systems, under choreography or
orchestration, a tentative operation included, from the first business process step it takes in it
until its part ends.
*Statement:* A business rule of that system MUST decide how its part ends from each state it can
stand in, on whatever another system can send it there and on none coming, by completing its part,
by a business process step that undoes an earlier one, asked of the system that took it, or by
accepting the state as it stands. Where its part waits on another system, it MUST hold the moment it
stops waiting in an aggregate of its own. A status that only shows how far another system has got,
with nothing of this system's hanging on it, is no wait. A refusal of a business process step MUST
be committed as its outcome and reach the system that decided the business process step, and a
failure that neither gave nor refused MUST NOT be committed as one.

### P18. The order messages arrive in does not change the outcome

*Against:* F5.
*Scope:* messages that tell of the same thing, written by one system or by several, and the use
cases called for them.
*Statement:* A use case called for a message MUST leave the records of what it tells of as the
messages about that thing, applied in the order they were written, would leave them, and MUST NOT
tell that order from when they arrive. The system that writes messages about one thing MUST let a
use case called for one tell that order, by what the message carries or by answering what the thing
is now. Where messages written by different systems conflict over one thing, a business rule of the
receiving system MUST decide which prevails.

### P19. Within one system, each term has one meaning

*Against:* F2, F3.
*Scope:* code of a system uses a word with a meaning: in a module's names, schemas, messages,
tests or prose.
*Statement:* A term of a system MUST have one meaning, used in every module of the system. A word
taken from another system's offer MUST keep the meaning that system gives it, and where this system
has a term by that word in another meaning, every module that uses the word MUST name it apart from
that term.

## Conventions

Taste, not property: a codebase that does otherwise breaks nothing the world promises.

- A business rule is tested: the test SHOULD call the domain function directly.
- A test asserts: it SHOULD assert on inputs and observable results.
- An end-to-end test SHOULD NOT run automatically.
- A factory needs something the same in every instance, process and test: it SHOULD import it.
