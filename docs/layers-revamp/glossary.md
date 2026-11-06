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
