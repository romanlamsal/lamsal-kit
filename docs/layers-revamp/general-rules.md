# General rules

Rules that hold for every system, without exception. Terms are the glossary's. Specialized rules
narrow these by naming the id they narrow; nothing here points down at them.

A rule is one entry with labeled parts, in this order. Only the statement is required.

- The **statement**, after the id: what holds. A specialized rule narrows the statement, nothing
  else.
- *Why:* what the statement protects, or what breaks without it.
- *Looks like:* what a breach looks like in a diff.
- *Allowed:* what the statement does not forbid, where that is easy to mistake for a breach.
- *Provenance:* which source the rule follows or departs from.
- *Examples:* ids in `examples.md`.

## Scope

This document assumes a store that can be read and written, and that the store can apply several
writes atomically where it says *transaction*. What counts as one store is each codebase's choice.
*Record* and *aggregate* are used in the relational sense, a record being a row; substitute your
store's equivalents.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside these layers, and so do assembly, a system's export paths and the common
library.

Not covered: where UI code goes. That is `components.md`, which applies *controller* to route
files on the client; those carry no writes, and on the server a driving adapter passes a write
through to one service. Also not covered: library, framework and file-naming conventions, which
are the stack document's, and whether a module that straddles two layers should be split now.

## Arrow

**ARR-1.** The arrow runs one way — driving adapter → service → driven adapter → the outside — and
the domain sits beside all of it: every layer may import it, it imports no layer.

**ARR-2.** A driving adapter's only door to the store is a service.

**ARR-3.** A driven adapter imports no service.
*Why:* a use case found in a driven adapter is in the wrong layer; it belongs in a service.
*Looks like:* a service import in a driven adapter's file; a driven adapter that gained an import
of another driven adapter.
*Allowed:* a read across its system's aggregates in a driven adapter is not a use case, as long as
it writes nothing.

## Domain

**DOM-1.** The domain is pure and knows no runtime. It computes from its arguments and imports no
layer of this system: only other domain modules, the common library's ports, an upstream's
published language where this system is a conformist, and pure libraries. It uses what every
runtime has, the language and pure libraries.
*Why:* the test for a package is: can calling it reach outside the process? A store client, an
HTTP client, a mailer SDK, `node:fs` and a clock all can, so they stay behind ports. A validation
library cannot — it takes arguments and returns — so it is fine, and so is any other library like
it. `node:*` modules and a runtime's globals are a separate matter: `node:path` cannot reach
outside the process, and still breaks in a browser. They belong to the layers that run on one
runtime. Keeping the domain runtime-free is what lets a browser, or another system, import it and
get nothing but the domain.
*Looks like:* a store client, HTTP client, SDK or clock in a domain module; `node:*`, `Buffer`,
`process`, `window` or the DOM there, directly or through a common-library module that imports
`node:async_hooks`.

**DOM-3.** A rule about a record is decided once, in the domain, as a schema. The `Invoice` schema —
which fields exist, that an amount is a positive integer, that a status is one of four — says the
same thing as the functions beside it, in a form that also checks at runtime, and the type is
inferred from it. Everything that builds an invoice record parses against that schema or derives from
the one domain function.
*Why:* two constructors drift, and the drift stays invisible until two parts of the system
disagree about a rule neither of them writes down.
*Looks like:* the shape of one record built in two places — once on the server and once in a
client-side optimistic update, or in two services; a type declared beside a validator that
restates it.

**DOM-4.** An aggregate refers to another aggregate, and to another system's data, by id. What it
needs of the other at the time — a price, a title — it copies as its own value.
*Why:* the copy is this aggregate's fact from then on. A reference that loads the other's whole
record makes the two one aggregate, written by two sets of use cases (SYS-8), and carries the
other's model into this one.
*Looks like:* a populated relationship.
*Provenance:* Vernon's aggregate rule: reference other aggregates by identity only.

**DOM-5.** Driven ports this system declares live in its domain. The domain names ports only,
never a use case.
*Why:* the rules say what they need — store this order, send this mail — and the driven adapters
do it; assembly picks which. A use case is not a domain concept, so the domain never learns the
name of one.
*Looks like:* a driving port type in the domain; a domain module importing an adapter.

**DOM-6.** What a service hands a repository method to join its transaction (TX-1) is opaque in
the domain.
*Why:* so nothing there names the store or its client.
*Looks like:* a store client's type in a domain signature.

## Service

**SVC-1.** A service constructs nothing. It takes its dependencies as arguments and returns its
driving port. The driving port is declared beside the service, not in the domain (DOM-5).
*Looks like:* a constructor call or an adapter import inside a service module; a driving port type
in the domain.

**SVC-2.** A driving port takes everything its use case needs to decide, including who is
calling. When the decision depends on what this system has stored — whether this caller is
allowed to do this, say — the service that acts makes it: it loads the data, asks the
specification, and refuses if it must.
*Why:* a driving port does not know how it is reached, so a check made in a driving adapter
protects only that one way in; another adapter, or a downstream calling the port directly,
bypasses it. Only the service sees every call. A service that only answers a question exists for
screens, to hide a button for instance. It is not a gate in front of the acting service. If a driving adapter asked first and then called
the acting service, the acting service would have to check again anyway, because things may have
changed in between. So the acting service checks, and the answering service is called on its own,
never as a step before the act.
*Looks like:* a driving adapter reading the store to check a permission before it calls the
service; a driving adapter calling an answering service and then the acting one.

**SVC-3.** A service does not call another service of its system.
*Why:* that would nest one transaction in another, and a nested transaction cannot be retried on
its own. If two use cases need the same writes, both call the same repositories inside their own
transaction, and the domain decides what those writes are. If one use case must follow another,
the outbox carries it, and the outbox is what retries.
*Looks like:* a service that receives or imports another service of its system.
*Allowed:* a service calling an upstream's driving port is calling a port, not nesting a use case
in another — for a read. A write goes through TX-3, never inside the transaction.
*Provenance:* Khononov's application service is the transaction.

**SVC-4.** A service writes no record itself. The write belongs to the repository of the
aggregate the record is part of; the service keeps the deciding.
*Looks like:* an insert, update or delete inside a service; a service holding a store client.
*Allowed:* a service that does nothing but call its repository is fine, even if it looks like an
extra layer. A driving adapter may only call a service (ARR-2). If the repository is deleted
later, the compile error lands in the service that named it, not in a driving adapter.

**SVC-5.** A service reads no ambient value, of either scope. Its dependencies arrive as
arguments (ASM-2), and what a use case decides by arrives through its driving port (ASM-3).
*Why:* anything a service would read ambiently, it reads only to pass on. If it passes it to a
driven adapter, the adapter can read it itself. If it passes it to the domain, the domain decides
by it, so the port should have taken it. There is no third case.
*Looks like:* a service reading a dependency from a courier or a registry; a service reading a
request id, a locale or the current user from a request context instead of its arguments.

## Driving adapters

**DRV-1.** A driving adapter makes no decision that depends on what this system has stored. It
prepares one call and makes it, to one service. Any question that needs this system's state goes
to the service (SVC-2).
*Why:* a driving adapter that hands a repository a transaction and a callback has not delegated a
use case. It has written one, inside itself, and the decisions are still made in the adapter.
*Looks like:* a driving adapter that needs two service calls, a sign that a use case has grown
inside it; a driving adapter handing a repository a transaction and a callback; an adapter body
that does more than call one service.
*Allowed:* preparing the call: working out who the caller is (from a session, a signature, an API
key) through a port the adapter receives; validating and translating the input; putting
per-request ambient values in; asking a specification about the input it holds, such as whether
it is valid. None of this is deciding by the system's state.
*Provenance:* the conversion is Cockburn's adapter; that the adapter reads no state of its own
follows from its only door being a service.

**DRV-3.** A driving adapter gets its service from assembly, never by importing it. Where
assembly constructs the adapter — a route, the adapters a system builder takes — the service is an
argument. Where the driving adapter is not part of assembly — the framework finds and calls it,
as it does a server function — it reads its service from a courier, when it runs, not when its
module loads.
*Why:* an adapter assembly does not construct cannot be handed anything, and importing assembly
instead would run assembly at module load and let the adapter pick its own instance. The courier
keeps assembly the one place where a port meets its implementation.
*Looks like:* a driving adapter importing assembly; a courier read when the module loads.
*Provenance:* that a driving adapter never imports assembly, and the courier, are this document's
choices. In Cockburn's example the driving adapter wires the application itself; Khononov resolves
ports "in the infrastructure layer, either through dependency injection or by bootstrapping"
(p. 128).

## Driven adapters

**DVN-2.** A driven adapter imports what is static and gets what is built as arguments to its
factory. Static: the domain, the schema it validates with, the port types. Built: a store client,
an upstream's open host service it translates for, another adapter.
*Provenance:* that adapters are received is Khononov's (p. 128) and Cockburn's; the split between
imported and received is this document's.

## Assembly

**ASM-1.** One assembly per process. It holds the instances; a service module exports its factory
and nothing built.
*Why:* two assemblies in one process would be two places where a port meets its implementation,
and two instances of what must exist once. With assembly apart from the factories, every
dependency except fixed plumbing (ASM-2) is one a factory asked for. Which system builders
assembly calls follows from how the process is driven: a server's assembly calls the open host
service builders, the process running the relay calls the outbox reader builders, the process
running handlers calls the handler builders, a process doing several calls all of them.
*Provenance:* one assembly per process, apart from the driving adapters, is this document's
choice; see DRV-3.

**ASM-2.** Nothing builds its own dependency instead of receiving it.
*Why:* it breaks substitution. A service that builds its own adapter cannot be given a different
one, so its tests need the real thing. A system builder is a factory for its system, and its
upstreams are dependencies like any other: assembly builds them and hands them in, so each exists
once, the graph is visible in one place, and a test hands the builder a fake upstream.
*Looks like:* a concrete adapter imported into a service file, constructed inside a service body
or a factory body, or read as a per-process ambient value there; a module exporting a ready-made
instance next to the factory that produces it; a system builder calling another system's builder.
Built in place, this breach is invisible to the other rules: the code sits in the right layer and
calls in the right direction.
*Allowed:* plumbing with one fixed configuration, such as a logger or a tracer, may be a ready-made
instance: nobody substitutes it.
*Provenance:* Seemann's composition root and Spring Modulith's one context per application. Pass 1
had the downstream's builder build its upstreams; inverted here.

**ASM-3.** A value may be ambient only when no use case and no domain function decides by it
(SVC-2).

- *Per process:* what assembly produced. Assembly fills it before any adapter runs. Only driving
  adapters that are not part of assembly read it, through a courier (DRV-3); a service never does
  (SVC-5).
- *Per request:* a request id, a trace context, the locale a mail is rendered in, the user an audit
  column records. The driving adapter puts it in. Plumbing and driven adapters read it, for what
  they record or forward; a service and the domain never do (SVC-5). A handler runs in another
  request, so what it needs goes into the message.
- A transaction is in neither scope: what a read returns depends on it.

Which values a codebase holds ambient, it says in an ADR; what carries them is the stack
document's.
*Provenance:* Fowler's registry, in two scopes. The per-process scope is a service locator in
Fowler's terms, and a departure from the injection the sources prefer, confined to the courier
case. Where the line between ambient and argument falls is this document's choice.

**ASM-4.** The courier exists only for driving adapters that are not part of assembly (DRV-3). Where
the courier is the framework's request context, middleware installed by assembly fills it per
request. Which courier a codebase uses is in the stack document. A courier inside a system builder
is that builder's own business and gets no rule here.

**ASM-6.** The common library holds no model.

## Transactions

**TX-1.** Where one use case writes several aggregates, the service holds the transaction: it
opens it, hands it to each repository method, and commits it. A repository called on its own is
its own transaction.
*Why:* a repository saves one aggregate whole and knows nothing of the others. Only the service
sees the whole use case, so only it can say which writes must land together. It opens the
transaction through a port of the common library, so it names no store itself.

**TX-2.** Writes that must land together share one transaction. A driven adapter that is handed a
transaction writes inside it.
*Why:* a failure between two writes that must land together leaves the use case half done.
*Looks like:* a repository method that takes the transaction and then writes without it, or opens
its own; a loop with one write per iteration, which is one transaction per item; a write moved
out of a function, which tends to give it a transaction of its own.

**TX-3.** For each piece of data a use case touches, answer in order:

1. *Does it change data another system owns?* That includes a third party's: a mail sent, a
   payment created. → **Outbox, required.** Write a message to this system's outbox (TX-6). If the
   owner handles this system's messages, it changes its data when the message arrives. A third
   party subscribes to no bus, so a handler of this system receives the message (MSG-7).
2. *Does it read data another system owns?* → **Call the owner's open host service.** If the owner
   offers no fitting read, keep a copy here, updated by the owner's messages; then the owner has
   to publish them.
3. *Does it write several aggregates of this system?* → **One transaction**, by default. An outbox
   between them is also valid.
4. *Otherwise* → one transaction.

*Looks like:* a call to another system's driving port that acts, inside this system's
transaction.
*Allowed:* calling the owner's open host service to act, after this system's transaction has
committed, where this request needs the answer now. A failed call fails this request; nothing
retries it. What this system records of the answer is a change of its own (TX-1).
*Provenance:* one transaction across several aggregates (step 3) is this document's choice; Vernon
and Khononov keep one aggregate per transaction. The synchronous call is Khononov's first saga
(ch. 9); moving it to the outbox buys reliability, not legality.

**TX-4.** The outbox belongs to its system. Its port is a driven port the system declares, like a
repository (DOM-5). Where the messages live is the system's choice — a table of its own, a store
another transaction reaches, a field it owns on a record in another system's store — and so are
the adapter that writes it and the reader that reads it. A system that writes to several stores
has an outbox in each.
*Why:* a message is a record this system's use case writes, so it is this system's (SYS-8). Where
it lives is left open because TX-6 fixes only one thing: the message must be reachable from the
transaction that produced the change. That transaction is wherever the change is, so a system
writing several stores needs an outbox in each.
*Looks like:* a reader that returns another system's messages; an outbox in a store the system's
transactions do not reach.
*Provenance:* Khononov (ch. 9) and Richardson put the outbox table in the publishing aggregate's
own database; Vernon (ch. 8) has the model and the messages share one persistence instance. That
the messages may live on a record, or in a store another system's transaction reaches, is this
document's.

**TX-6.** A message is written to the outbox in the transaction that produced the change it tells
of.
*Why:* written outside that transaction, the message either survives a rollback of the change, or
the change commits and the message is never written.
*Provenance:* Khononov's outbox pattern.

## Between systems

**MSG-1.** The relay is common library: it belongs to no system and imports none. It is handed
the outbox readers and publishes each message to the bus at least once, until the bus has taken
it; then it marks the message relayed.
*Why:* a relay inside a system would import it and see only its outbox. Marking before the bus
has taken the message loses it to a crash in between. The relay sees only whether the bus took
the message; what happens to a handler behind it is the bus's (MSG-2).
*Looks like:* a relay module importing a system; a relay that marks on fetch; a relay handed
handlers.
*Allowed:* an in-process bus. It holds nothing, so it takes a message only by running the
handlers now, and refuses if one throws; the relay then retries the publish and the systems that
already handled it dedup by id (MSG-3). Same rules, retry moves. An in-process bus has no
set-aside (MSG-2): the relay retries until every handler succeeds.
*Provenance:* Khononov's outbox relay (ch. 9), followed; at-least-once is his. He marks the message
"published"; here that word is the message's (SYS-2).

**MSG-2.** The bus is handed the handlers and delivers each message at least once, in no
guaranteed order, to every handler subscribed to it, until each reports it handled.
*Why:* who starts the call decides driving from driven (glossary). On the publish side the relay
starts it, so the bus is a driven port of the relay, with an in-memory adapter and broker
adapters. On the consume side the bus starts it, so a handler is the driving adapter it calls and
the use case is the driving port. Subscribing is wiring, done by assembly, not a driven port of
the system. A process that is only relay, outbox readers and bus adapter is valid; handlers run
wherever a subscriber process runs them.
*Looks like:* a bus that marks on delivery; a handler reached from anything but the bus.
*Allowed:* setting a message aside for a handler after the codebase's limit of deliveries, where
something reads what is set aside. A broker that ships with this on is this *Allowed* used,
provided the set-aside is read.
*Provenance:* Khononov has the bus as the broker's and wants events "always delivered
consistently, no matter what" (ch. 15); he has no delivery limit. The set-aside is Hohpe & Woolf's
Dead Letter Channel; a departure, confined to an *Allowed*.

**MSG-3.** A message carries an id, and the receiving system handles each id once. Messages arrive in no
guaranteed order (MSG-2), so a message about something the receiving system has not recorded yet
is not handled now; the bus delivers it again (MSG-2). How the handler says "not yet" —
failing, asking for a delay — is the codebase's.
*Why:* the id makes a repeat harmless: the service records it in the use case's transaction (TX-2),
so a repeat finds it. Redelivery makes an early arrival wait for what it depends on.
*Looks like:* a message schema without an id; a handler that treats "not found" as "already
handled".
*Allowed:* a message carrying the version of the aggregate that wrote it, so a handler can ignore
one staler than what it holds.
*Provenance:* at-least-once delivery with the consumer de-duplicating is Vernon's (ch. 8) and
Khononov's (ch. 9).

**MSG-4.** A message's schema stays backward and forward compatible: no field is renamed, removed,
made required or narrowed. That includes a domain schema the published language re-exports.
*Why:* a message is handled by code older or newer than the code that wrote it. One written before
a deploy is handled after it; a handler still on old code may read one written by new code. The
type checker sees none of this, because the stored record is not in the program.
*Looks like:* a field renamed, removed, made required or narrowed in the schema of a message.

**MSG-5.** The receiving system decides which messages it handles. Each message is handled in a
transaction of its own.
*Why:* the writer does not know its readers; it publishes, and whoever handles the message is the
reader's business. One transaction per message lets the bus retry a failed message
alone, without undoing or repeating the others delivered with it.
*Looks like:* a handler that handles several messages in one transaction; a writer of an event
whose code names the systems that handle it.
*Allowed:* the handler deciding on receipt, by a switch on the message type, or beforehand, by
declaring the types it handles; a system exporting one handler or several. Either way the handler
reports a message it chose not to act on as handled.
*Provenance:* Vernon (ch. 10): subscribers execute in a separate transaction. Khononov's saga and
process manager put the address of a command in the message (`target`, ch. 9) and have the relay
execute it; here the address is implicit in which system exports the type (glossary: upstream
system).

**MSG-6.** A private message is delivered only to handlers of the system that wrote it.
*Why:* a private message is a record of the system's inside; another system handling it couples
to that inside (SYS-1). The bus is the only thing that holds the handlers, so the withholding is
its; what it needs to know — which messages are private, which system a handler belongs to — the
codebase provides.
*Looks like:* a handler of one system acting on another system's private message; a bus with no
way to tell a private message from a published one.
*Allowed:* any way of telling the bus. The outbox reader marking each message; the service
flagging it at write (TX-6); a field on the message; the bus checking the type against the
published language export; a predicate on the handler. Any way of telling it a handler's system:
handed as each system builder's unit, or tagged.
*Provenance:* Khononov (ch. 9, ch. 15) writes every domain event to the outbox and publishes it to
an internal bus; the open host service's message proxy forwards the public ones in the published
language. Here one bus withholds instead of two buses and a proxy. His public events are
translated types; here they are the same types, exported (SYS-2).

**MSG-7.** The handler's service makes the call that the message asked for. It makes it through a
driven port. It does not write a message for it.
*Why:* TX-3 step 1 sends every call to another system through the outbox. The handler's service is
making one of those calls. Without a named caller, step 1 would apply again, and the call would
never happen. This rule names the caller and breaks the circle.
*Looks like:* a handler's service writing the message it was handed back to the outbox.

## Other systems

**SYS-1.** A system exports its offer and nothing of its needs: what downstream systems need to
talk to it, and what assembly needs to build it. Other systems reach it only through these
exports. Today the offer is:

- the published language and the driving port interfaces, for downstream systems;
- its system builders, for assembly or a downstream's system builder to call;
- optionally, a fake of its driving ports for downstream tests, from an export path production
  never loads.

The published language and the port interfaces get an export path that loads only the domain; the
port interfaces are exported type-only, or that path would load the service that declares them.
*Why:* driven ports, services and adapters are what a system needs; a downstream importing one
couples to the inside. An export path that loads only the domain lets a downstream import the
published language without loading any service, and a linter can hold the boundary from import
paths alone.
*Looks like:* an import from another system that is not one of its export paths; a driven port or
an adapter of one system imported by another.

**SYS-2.** The published language is the domain's own schemas and errors, messages included. The
driving port interfaces are exported beside it (SYS-1), not in it. A private message is not
published.
*Provenance:* Khononov keeps the published language and the domain apart from the start;
re-exporting the domain, messages included, is this document's choice.

**SYS-3.** The upstream's driving port is, to the downstream, a driven port like any other.
*Why:* so assembly decides what implements it: in-process, the upstream's service itself; out of
process, a driven adapter of the downstream, such as an HTTP client. Moving the upstream out of
process changes assembly and adds that adapter. Nothing in the downstream's services or domain
changes.

**SYS-5.** How a downstream relates to an upstream is chosen per relationship. Conformist is the
default where the upstream offers an open host service. An anti-corruption layer is for an
upstream whose model is foreign, unstable or not yours, as a third-party API's usually is.
*Why:* an open host service publishes its model on purpose; translating it changes nothing and
costs a layer. A foreign model changes on terms this system does not control, and the adapters
are where that change is absorbed. The other context-map patterns are about how teams cooperate;
in code, each lands as one of these two, or as no integration at all.
*Looks like:* a driven port whose types copy the upstream's field for field, with an adapter that
maps each field to itself; a message schema copied field for field from the system that publishes
it; behind an anti-corruption layer, one of the upstream's terms showing up in this domain or in a
service.
*Allowed:* under conformist, using the upstream's terms directly is the design working, not a
leak. Under an anti-corruption layer, one module holding the translation for both adapters, and a
command to the upstream being this system's private message, whose handler's service reaches the
upstream through the driven adapter that translates (TX-3 step 1, MSG-7).
*Provenance:* conformist as the default for an open host service is this document's choice. The
context-map patterns are DDD's.

**SYS-7.** Where this system keeps a copy of another system's data, sends another system a
command, or calls a third party, it has a reconciliation for it.
*Why:* consistency between systems is eventual (TX-3, MSG-5): a change crosses by message, later. A
moment's lag is the design working; a gap that stays is drift, and only a comparison after the
fact finds it. A system that writes an event does not know who handles it (MSG-5), so it has
nothing to compare; a reader that keeps a copy does. The reconciliation is a use case of this
system, called like any use case: by a scheduled task, or by a use case that finds the drift.
*Looks like:* a copy of another system's data (TX-3 step 2) with nothing that compares it to the
source; a command sent, or a third party called, with nothing that checks it landed.
*Allowed:* another system catching up a moment later.

**SYS-8.** A record that two systems write is two aggregates that share an id.
*Why:* an aggregate belongs to the system whose use cases write it (glossary), so one record with
two writers is two aggregates: each system's use cases write its own, and the fields of one are
not the other's to change.
*Looks like:* one system's use case writing a field the other system's rules decide.

## Tests

**TST-1.** An integration test is one that uses a real external dependency — a database, a broker,
a third-party API. Everything else is not, whatever it covers.

**TST-2.** The default suite runs on fakes. Where a real dependency would appear, a fake
implementation of the port appears instead. Switching between fake and real is a flag, not an
edit.
*Why:* the default suite must be fast enough that nobody thinks about running it. The real run is
what you reach for when a failure makes you doubt the fake.
*Allowed:* a port with one implementation is not premature; the second implementation is the fake.

**TST-3.** Test the domain directly.
*Why:* it is pure, it holds the rules, and it needs no fixtures, no fakes and no setup. Most of
what is worth asserting lives here.

**TST-4.** Test services and driving adapters against fakes. Assert what they did — which port was
called, with what, and what came back — not the order of internal calls.
*Why:* both receive their ports, so a test can hand them fakes. A driving adapter that is not
part of assembly (DRV-3) reads its ports from a courier, and the test fills the courier with
fakes.

**TST-5.** Driven adapters are integration-tested.
*Why:* a driven adapter's entire job is to talk to something external, so a unit test of one
asserts a mock of the thing it exists to reach. Unit tests pay off there only for genuinely
self-contained pieces — a query builder's output, a mapping function.

**TST-6.** Write one contract suite per driven port, against the port rather than any
implementation, and run it twice: once against the fake, once against the real adapter.
*Why:* the second run is the integration test, and it is what stops a fake from drifting into a
fiction that passes while production breaks.
*Allowed:* several systems each faking the same port. By default, each system writes its own fake.
One fake that the upstream exports fits only where its downstreams need the same things of it; a
fake that needs configuration per downstream has outgrown that.

**TST-7.** A good test survives a rewrite of the thing it tests. It names inputs and observable
results.

## Ids not in this file

`DRV-2`, `DRV-4`, `PRD-1` to `PRD-5` were general ids in the pass-1 translation and are specialized
rules now; they retire as general ids and are not reused. `DOM-2` was folded into `DOM-3`, `DVN-3`
into `ARR-3`'s *Allowed*, `SYS-4` into `SVC-2`'s *Why*, `SYS-6` into `ASM-2` with its default
inverted; all four are retired. `ASM-5` was replaced by `MSG-1` and `MSG-2` when relay and bus were
told apart; `TX-5`, `TX-7`, `TX-8` moved to Between systems as `MSG-3` to `MSG-5`. All four
retire. `DVN-1` restated the glossary's driven adapter and `DOM-5`, and its narrowing to ports the
domain declared contradicted the common library's and an upstream's ports; retired.
