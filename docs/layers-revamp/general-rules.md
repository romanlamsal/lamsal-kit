# General rules

Rules that hold for every system, without exception. Terms are the glossary's. A rule is one
unit: id, statement, provenance where it has one. Specialized rules narrow these by naming the id
they narrow; nothing here points down at them.

## Scope

This document assumes a store that can be read and written, and that the store can apply several
writes atomically where it says *transaction*. What counts as one store is each codebase's choice.
*Table*, *row* and *aggregate* are used in the relational sense; substitute your store's
equivalents.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside these layers, and so do assembly, a system's export paths and the common
library.

Not covered: where UI code goes (`components.md`; it applies *controller* to route files on the
client, which carry no writes, where a server's driving adapter passes a write through to one
service); library, framework and file-naming conventions (the stack document); whether a module
that straddles two layers should be split now.

## Arrow

**ARR-1.** The arrow runs one way — driving adapter → service → driven adapter → the outside — and
the domain sits beside all of it: every layer may import it, it imports no layer.

**ARR-2.** A driving adapter's only door to the store is a service.

**ARR-3.** A driven adapter imports no service. A use case found in a driven adapter is parked in
the wrong layer; it belongs in a service.

## Domain

**DOM-1.** The domain is pure and knows no runtime.

- *Pure:* it reaches nothing and computes from its arguments. It imports no layer of this system:
  only other domain modules, the common library's ports, an upstream's published language where
  this system is a conformist, and pure libraries. The test for a package is whether calling it
  can reach outside the process: a store client, an HTTP client, a mailer SDK, `node:fs` and a
  clock all can, so they stay behind ports. A validation library cannot — it computes from its
  arguments and returns — so it is allowed, and so is any other library of the same shape.
- *No runtime:* it uses what every runtime has, the language and pure libraries. `node:*` modules
  and a runtime's globals — `Buffer`, `process`, `window`, the DOM — belong to the layers that run
  on one runtime, even where they cannot reach out of the process: `node:path` is pure, and still
  breaks in a browser. This holds through imports: a common-library module that imports
  `node:async_hooks` brings the runtime with it.

Running on any runtime is what lets a browser and another system import the domain, and importing
it loads only the domain.

**DOM-3.** A rule about a row is decided once, in the domain, as a schema: `Invoice` — which
fields exist, that an amount is a positive integer, that a status is one of four — is the same
statement as the functions beside it, written in a form that also holds at runtime, and its type
is inferred from it. Every place that builds that row spreads the one decision: the driving
adapter validating input and the repository mapping a row parse against the same schema; a server
write and a client-side optimistic update derive from the same domain function. Two constructors
drift, and the drift stays invisible until two parts of the system disagree about a rule neither
of them writes down.

**DOM-4.** An aggregate refers to another aggregate, and to another system's data, by id. What it
needs of the other at the time — a price, a title — it copies as its own value, because it is
this aggregate's fact from then on. A reference that loads the other's whole record, such as a
populated relationship, makes the two one aggregate, written by two sets of use cases (SYS-8),
and carries the other's model into this one.
*Provenance:* Vernon's aggregate rule: reference other aggregates by identity only.

**DOM-5.** Driven ports this system declares live in its domain. The rules declare what they
need — store this order, send this mail — and driven adapters implement it. The domain names ports
only; assembly picks their implementations. The domain names no use case: a use case is not a
domain concept, so the domain never learns the name of one.

**DOM-6.** What the transaction port hands back is opaque in the domain, so nothing there names
the store or its client.

## Service

**SVC-1.** A service constructs nothing. It takes its dependencies as arguments and returns its
driving port. Its driving port lives beside it, not in the domain (DOM-5).

**SVC-2.** A driving port takes what its use case decides by, the caller included. A question that
needs this system's state — may this caller do this — is the acting service's: it loads the data,
asks the specification, and refuses. A service that only answers, for a screen that hides a
button, is called instead of acting, never before it.

**SVC-3.** A service does not call another service of its system: the call is a second
transaction, and the outbox is the one that retries. Writes two use cases share go through the
repositories, inside one transaction; deciding that they share goes in the domain.
*Allowed:* a service calling an upstream's driving port is calling a port, not a use case nested
in another — for a read. A write goes through TX-3, never inside the transaction.
*Provenance:* Khononov's application service is the transaction.

**SVC-4.** A service writes no table itself. The write belongs to the repository that owns the
table; the service hands that repository its transaction and keeps the deciding.
*Allowed:* a service that only forwards to its repository is correct, not an unnecessary
indirection: a driving adapter's only door is a service (ARR-2), even when the service exports the
same name again, so that deleting a repository fails inside the service that names it rather than
at a driving adapter naming a symbol.

**SVC-5.** A service reads no per-process ambient value; it receives its dependencies as arguments
(ASM-2, ASM-3).

## Driving adapters

**DRV-1.** A driving adapter decides nothing by this system's state. It prepares one call —
resolving the caller (a session, a signature, a key) through a port it receives, validating,
translating, putting per-request ambient values in, whatever else shapes the input — and acts
through one service. Needing two service calls is the signal that a use case has grown inside it.
A driving adapter that hands a repository a transaction and a callback has not delegated a use
case, it has inlined one: the deciding still happens in the adapter. To answer a question about
input it holds — is this valid — it calls a specification. A question that needs this system's
state is the service's (SVC-2).
*Provenance:* the conversion is Cockburn's adapter; that the adapter reads no state of its own
follows from its only door being a service.

**DRV-3.** A driving adapter receives its service from assembly: as an argument where assembly
constructs the adapter — a route, the adapters a system builder takes; from a courier where the
framework, not assembly, finds and calls the adapter, such as a server function. It reads the
courier when it runs, not when it loads. A driving adapter never imports assembly.
*Provenance:* that a driving adapter never imports assembly, and the courier, are this document's
choices. In Cockburn's example the driving adapter wires the application itself; Khononov resolves
ports "in the infrastructure layer, either through dependency injection or by bootstrapping"
(p. 128).

## Driven adapters

**DVN-1.** A driven adapter implements a driven port the domain declared (DOM-5).

**DVN-2.** An adapter imports what is static and receives what is built. The domain, a schema it
validates with, port types: imported. A service — a driving adapter's own; for a driven adapter,
only an upstream's driving port — and an adapter that resolves or translates its caller: received.
*Provenance:* that adapters are received is Khononov's (p. 128) and Cockburn's; the split between
imported and received is this document's.

**DVN-3.** *Allowed:* a read across its system's aggregates in a driven adapter is not a use
case, as long as it writes nothing.

## Assembly

**ASM-1.** Assembly is not a layer. One assembly per process. It builds the adapters, calls the
factories and, for each system, the system builder for the way this process drives it — its open
host service for a server, its handler and its outbox reader for the process that runs the relay,
both where one process does both — and hands the result to its driving adapters, or to the relay.
Assembly is the only place that knows both a port and its implementation. Keep it apart from the
factories: a service module exports only its factory, and assembly holds the instances, so every
dependency but fixed plumbing (ASM-2) is one a factory declared.
*Provenance:* one assembly per process, apart from the driving adapters, is this document's
choice; see DRV-3.

**ASM-2.** Nothing builds its own dependency instead of receiving it: no concrete adapter imported
into a service file, constructed inside a service body or a factory body, or read as a per-process
ambient value there; no module exporting a ready-made instance next to the factory that produces
it. What this breaks is substitution: the service can no longer be given a different
implementation, so its tests need the real one.
*Allowed:* plumbing with one fixed configuration, such as a logger or a tracer, may be a ready-made
instance: nobody substitutes it.

**ASM-3.** A value may be held ambient when no use case or domain function decides by it; what a
rule decides by, the port takes.

- *Per process:* what assembly produced, read through a courier by the driving adapters assembly
  does not construct (DRV-3). Assembly puts it in before any adapter runs; a driving adapter reads
  it when it runs, not when it loads; a service reads nothing from it (SVC-5).
- *Per request:* a request id, a trace context, the locale a mail is rendered in, the user an audit
  column records. A driving adapter puts it in; services and adapters read it; the domain takes
  arguments. A value a handler needs goes in the message, since the handler runs in another
  request.
- A transaction is in neither scope: what a read returns depends on it.

Which values a codebase holds ambient, it says in an ADR; what carries them is the stack
document's.
*Provenance:* Fowler's registry, in two scopes. The per-process scope is a service locator in
Fowler's terms, and a departure from the injection the sources prefer, confined to the courier
case. Where the line between ambient and argument falls is this document's choice.

**ASM-4.** The courier is used only where assembly does not construct the driving adapter
(DRV-3). Where it is the framework's request context, middleware assembly installs
fills it per request. Which courier a codebase uses, the stack document says. A courier inside a
system builder is that builder's detail and gets no rule here.

**ASM-5.** The relay is common library: it belongs to no system and imports none; the assembly of
the process that runs it hands it the handlers and the outbox readers. Whether it routes by message
type or hands every message to every handler, what it orders by, and what marks a message
delivered, is each codebase's.

**ASM-6.** The common library holds no model.

## Transactions

**TX-1.** Atomicity crosses ports through a transaction port. The service asks to run something
inside a transaction; repository methods take what it hands back.

**TX-2.** Writes that must land together share one transaction, and the transaction stays inside
its system. A function joins the transaction it was given and opens none of its own; a repository
method joins the caller's. A loop that opens a transaction per item is one transaction per item,
and a failure halfway leaves the use case half-applied. Moving a write out of a function tends to
give it its own transaction.
*Allowed:* a service passing its transaction into another repository of its system, in the same
store, is the design working. That is how several tables stay one transaction.

**TX-3.** For each piece of data a use case touches, answer in order:

1. *Does it change data another system owns — a third party's included, such as a mail sent or a
   payment created?* → **Outbox, required.** Write a message to this system's outbox (TX-6). An
   owner that handles this system's messages changes its data when the message arrives. A third
   party reads no relay: a handler of this system receives the message instead, and the message is
   the retry.
2. *Does it read data another system owns?* → **Call the owner's open host service.** If it offers
   no fitting read, keep a copy in this system, updated by the owner's messages. In this case, the
   owner publishes.
3. *Does it write several aggregates of this system?* → **One transaction, by default.** An outbox
   is also valid here.
4. *Otherwise* → one transaction.

*Provenance:* one transaction across several aggregates (step 3) is this document's choice; Vernon
and Khononov keep one aggregate per transaction.

**TX-4.** The outbox is this system's. Its port is a driven port the system declares, like a
repository (DOM-5). Where the messages live — a table of its own, a store another transaction
reaches, a field it owns on a product's record — is that system's, and so are the adapter that
writes it and the reader of it. A system writing several stores has an outbox in each store whose
transaction writes the message.

**TX-5.** An outbox, wherever it is used:

- The relay delivers each message after the commit, at least once, and not necessarily in order. A
  message carries what its handler needs to tell a repeat from an early arrival: an id, and the
  version of the aggregate that wrote it; the handler's aggregate records the last version it
  handled.
- A message is handled by code older or newer than the code that wrote it, so its schema stays
  backward and forward compatible: no field renamed, removed, made required or narrowed —
  including a domain schema the published language re-exports. A message written before the deploy
  is handled after it, and a handler on older code may read one written after. The type checker
  sees neither: the stored row is not in the program.
- The receiving system decides which messages it handles. Its handler handles each in its own
  transaction and calls one service (DRV-1).

**TX-6.** A message is written to the outbox in the transaction that produced the change it tells
of. Written outside it, the message survives a rollback of the change, or the change survives a
failure to write the message.
*Provenance:* Khononov's outbox pattern.

## Other systems

**SYS-1.** A system offers an open host service. Its driven ports stay inside; they are its needs,
not its offer. Export:

- the published language, for downstream systems to import;
- the driving port types, for downstream systems to import;
- a system builder for the open host service, for assembly or a downstream's system builder to
  call;
- where it handles messages, a system builder for its handler, for the assembly that hands it to
  the relay. Whether one builder builds both the open host service and the handler, and which
  process runs the relay, is each codebase's choice;
- where it publishes messages, a system builder for its outbox reader, for the same assembly;
- optionally, a fake of its driving ports, for downstream systems' tests, from an export path
  production does not load.

Give the published language and the port types an export path that loads only the domain, so a
downstream imports them without loading any service; the port types are exported type-only, or
the export path loads the service that declares them. Other systems reach a system only through
these exports, which a linter can hold from import paths alone.

**SYS-2.** The published language is the domain's own schemas, messages included. A private
message is not published.
*Provenance:* Khononov keeps the published language and the domain apart from the start;
re-exporting the domain, messages included, is this document's choice.

**SYS-3.** What sits behind an upstream's driving port is assembly's decision: the upstream's
service in-process, or an HTTP client — a driven adapter of the downstream implementing the same
port. Moving the upstream out of process changes assembly and adds that adapter; no service or
domain changes.

**SYS-4.** A driving port another system calls takes its caller as an argument (SVC-2). A
downstream reaches the upstream's service without passing the upstream's driving adapters, so
whatever those resolve — who is calling, on whose behalf — arrives as an argument, and the
upstream's authorization lives in its service or domain, as it does for every caller.

**SYS-5.** How a downstream relates to an upstream is chosen per relationship, and the boundary
matches the relationship.

- *Conformist* is the default for an upstream that offers an open host service: it publishes its
  model on purpose.
  *Allowed:* using an upstream's terms directly is the design working, not a leak.
- *Anti-corruption layer* is for a model that is foreign, unstable or not yours, as a third-party
  API's usually is. The downstream's domain declares a driven port in its own terms; a driven
  adapter implements it by calling the upstream's driving port and translating; on the way in, the
  driving adapter translates. The upstream's schema and the translation live in those adapters,
  or in a module both share; never in the domain.

The other context-map patterns describe how teams cooperate; in code, each lands as one of these
two, or as no integration at all.
*Provenance:* conformist as the default for an open host service is this document's choice. The
context-map patterns are DDD's.

**SYS-6.** The downstream's system builder builds the upstream, by default: it calls the
upstream's system builder, and nothing else of the downstream learns how the upstream is built.
Move that call up into assembly, which builds the upstream once and hands it to the downstream's
builder, when:

- a second downstream would build the upstream again, and the upstream holds something that must
  exist once — a cache, a pool, a subscription;
- the upstream needs systems of its own, and the downstream would end up assembling the upstream's
  upstreams;
- two systems would assemble each other — a cycle in the context map, which usually means a
  boundary is drawn wrong.

Until one of these holds, building the upstream in assembly is ceremony.

**SYS-7.** Between systems, consistency is eventual. Another system catching up a moment later is
the design working. Where this system's record and another's stay apart, reconciliation repairs
it. Reconciliation is a use case of the system that owns the aggregate (SYS-8); a scheduled task of
that system, or any driving adapter that finds the two apart, calls it.

**SYS-8.** An aggregate belongs to the system whose use cases write it, wherever it is stored; a
record two systems write is two aggregates sharing an id.

## Tests

**TST-1.** An integration test is one that uses a real external dependency — a database, a broker,
a third-party API. Everything else is not, whatever it covers.

**TST-2.** The default suite runs on fakes. It must be fast enough that nobody thinks about
running it. Where a real dependency would appear, a fake implementation of the port appears
instead. Make switching between fake and real a flag rather than an edit: the fast run is the
default, and the real one is what you reach for when a failure makes you doubt the fake.
*Allowed:* a port with one implementation is not premature; the second implementation is the fake.

**TST-3.** Test the domain directly. It is pure, it holds the rules, and it needs no fixtures, no
fakes and no setup. Most of what is worth asserting lives here.

**TST-4.** Test services and driving adapters against fakes. Each receives ports — a driving
adapter assembly does not construct (DRV-3) reads them from a courier, which the test fills with
fakes — so a
test hands it fakes and asserts what it *did*: which port it called, with what, and what it
returned. Assert observable behaviour, not the order of internal calls.

**TST-5.** Driven adapters are integration-tested by design. A driven adapter's entire job is to
talk to something external, so a unit test of one asserts a mock of the thing it exists to reach.
Unit tests pay off there only for genuinely self-contained pieces — a query builder's output, a
mapping function.

**TST-6.** Keep the fakes honest with contract tests. Write one suite per driven port, against the
port rather than any implementation, and run it twice: against the fake, and against the real
adapter. The second run is the integration test, and it is what stops a fake from drifting into a
fiction that passes while production breaks.
*Allowed:* several systems each faking the same port. By default, each system writes its own fake.
One fake that the upstream exports fits only where its downstreams need the same things of it; a
fake that needs configuration per downstream has outgrown that.

**TST-7.** A good test survives a rewrite of the thing it tests. It names inputs and observable
results.

## Ids not in this file

`DRV-2`, `DRV-4`, `PRD-1` to `PRD-5` were general ids in the pass-1 translation and are specialized
rules now; they retire as general ids and are not reused. `DOM-2` was folded into `DOM-3` and is
retired.
