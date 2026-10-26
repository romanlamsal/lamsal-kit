# Glossary

Definitions only, read as a whole. What a term may do is in the rules.

## Business domain

**Business domain.** A company's main area of activity: selling tea online. The domain models it.

**Business rule.** What the business domain allows, requires or forbids: an order ships only once
paid.

## System

A system is one bounded context. It is code with its own domain and its own glossary. A code
repository may hold several. Another bounded context is another system, even when it is
imported in-process.

**Outside.** Other systems and third parties, the operating system among them, whether they
drive the system or it drives them: a store, a mail provider, the clock, the file system.

**Tooling.** Code that runs in no process of the deployed application: a developer CLI, a seed
script, a test that asserts about the source tree.

**Probe.** Code a process runs to report on itself rather than on a system: whether it is alive or
ready, its metrics. `/health`, `/metrics`.

## The layers

**Use case.** One goal a caller can reach through the system, and how the system responds.

- **Domain.** The model: business rules, schemas, specifications. It is pure and knows no runtime.
- **Service.** The application layer. It carries out the system's use cases. It holds no business
  rule of its own; the business rules are the domain's. What it holds is the sequence within one
  use case: what to load, which business rule to ask, what to save. Each use case either acts or
  answers.
- **Driven adapters.** Implementations of driven ports.
- **Driving adapters.** Callers adapted to driving ports.

In DDD vocabulary, domain is the model, service is the application layer, driving adapters are the
interface layer, driven adapters the infrastructure layer.

**Port.** An interface, never the code behind it.

- A *driven port* is a way out of the system. Send a mail, save to the database, read from disk.
- A *driving port* is the way in. It names one use case the system offers and what a caller must
  bring, in the system's terms, not its store's. It does not know how it is reached.
- Who starts the call decides which. Seen from the caller, this system's driving port lies
  behind one of the caller's driven ports.

**Adapter.** Code on the far side of a port.

- A *driven adapter* implements a driven port. A port may have several: a database today, another
  store or a fake tomorrow. Swapping one changes nothing on the system's side of the port.
- A *driving adapter* adapts one caller to a driving port. There are as many driving adapters as
  there are ways into the process, like a server function, a CLI command, a webhook.

## Between systems

**Message.** What one system tells another, or itself, so that it may act. An *event* says something
happened; a *command* says do this. *Published*: meant for other systems. *Private*: meant only for
the system that wrote it.

**Outbox.** Where a system's outgoing messages wait until they are delivered. The *outbox port* is
the driven port a service writes messages through. The *outbox reader* is what the relay reads the
outbox through, and marks it by; the system provides it.

**Handler.** A driving adapter that acts on messages delivered to its system.

**Bus.** What delivers a message to the handlers subscribed to it.

**Relay.** The mechanism that reads outboxes and hands each message to the bus.

**Idempotent.** An operation is idempotent when repeating it leads to the same result as performing
it once.

**Tentative operation.** A request to another system for a commitment that leaves open the
possibility of cancellation. It changes nothing it asks for: its confirmation does.

**Open host service.** The driving ports a system offers to other systems.

**Published language.** What another system needs to talk to this one, or to translate from it:
the schemas, types and errors its open host service's driving ports take, return and raise, and
its published messages.

**Reconciliation.** A use case that compares, after the fact, what this system recorded with what
another system holds, and repairs this system's record, or starts the step that repairs the
other's.

**Saga.** A sequence of steps across systems where, when a later step fails, new steps undo the
earlier ones.

**Choreography.** Each system reacts to the others' events and decides for itself what to do next.
No one holds the whole sequence.

**Orchestration.** One system's *process manager* holds the sequence across systems: an aggregate
whose state is where the sequence stands. Each step is a use case of that system that sends
commands to the others.

## Other systems

**Upstream system.** Of two systems that talk, the one the other depends on: it offers the open
host service the other calls, the messages the other handles, and the published language both are
written in. It changes on its own terms.

**Downstream system.** The one that depends on the upstream: it calls the upstream's open host
service, handles its messages, and adapts to its changes.

**Conformist.** A downstream system that takes the upstream as it is: its ports become the
downstream's driven ports and its published language is used untranslated, in any layer including
the domain.

**Anti-corruption layer.** A downstream system that translates the upstream's published language
into its own in every adapter that touches the upstream: the driven adapters that call into it and
the driving adapters it calls into. The upstream's terms stop at those adapters.

**Shared kernel.** A model several systems of this codebase share as code and none owns alone, each
importing it into its domain: `Money`, `Sku`. A change to it is a change to each.

**Hook.** A driving adapter an upstream system calls.

**External system.** A bounded context whose code this codebase does not write, though it may
configure it: bought or adopted, run by its vendor or by us. It is driven through its API and
driving through its hooks.

## Domain

**Aggregate.** A cluster of records changed as one unit and addressed by one id; a repository loads
and saves it whole. It has one owner.

**Owner.** The system whose business rules decide what a record holds, wherever it is kept. A store
may keep records of several owners, and a system may keep records another system owns: a replica.

**Specification.** A domain function that answers yes or no about one candidate: is it valid, may
this happen, does it qualify.

**Repository.** A specialized driven port over exactly one aggregate: loads it, saves it, finds it.

**Snapshot.** A value an aggregate copies from another aggregate or from a message when a use
case needs it, and keeps as its own fact from then on: the price the order was placed at.

**Replica.** Another system's data kept in this system from what the owner publishes or offers:
its messages, or reads of its open host service. It lags the owner.

## Driven adapters

**Record.** What a store holds and a write changes: a row in a relational store, its equivalent in
another.

**Store.** What lies behind one or more driven ports whose writes can be committed in one
transaction. Two clients are one store when their writes commit together, two stores until they
do.

## Driving adapters

**Scheduled task.** A driving adapter the clock calls.

**Ambient value.** A value a function reads without receiving it as an argument. Two scopes: per
process, set once for the process's life, like what assembly produced, a ready-made logger or an
environment variable; per request, what the current request carries, like a request id, a trace
context or a locale.

**Courier.** How a driving adapter reaches what assembly produced when assembly cannot hand it over
as an argument. Example implementations are per-process ambient values or the stack's context
objects.

## Assembly

**Factory.** A function that takes what an implementation needs and returns it. A service is a
factory for a driving port; an adapter's constructor is a factory for a driven port.

**System builder.** The part of assembly a system provides, so that a process's assembly builds
what it needs of the system without knowing its internals or their defaults: it takes
configuration and returns implementations. A system may have several, and one may return one
thing or many.

**Assembly.** The one place in a process where every port gets its implementation, and the only
place where port and implementation meet. It calls the system builders and produces what the
process's driving adapters call into.

**Common library.** Plumbing every system may import: the transaction port, store clients, a
logger, a tracer, the relay, the ambient registry.

## Tests

**Fake.** A working implementation of a port that reaches nothing outside the process: a
repository over an in-memory map.

**Integration test.** A test that uses a real external dependency running where the test runs: a
database or a broker in a container.

**End-to-end test.** A test that uses a real external dependency running elsewhere: an external
system's own service, such as Stripe in test mode, or a mail provider's sandbox.

**Default suite.** The tests run by default: every test that is neither an integration test nor an
end-to-end test.
