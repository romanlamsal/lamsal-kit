# General rules

Rules whose Scope is any system. Terms are the glossary's; the rule shape is the README's. A rule
with `—` under Examples is unfinished.

## Assumptions

This document assumes a store that can be read and written, and that can apply several writes
atomically where it says *transaction*. *Record* is used in the relational sense, a row;
substitute your store's equivalent.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside the layers, and so do assembly, a system's export paths and the common
library.

Not covered: where UI code goes, which is `components.md`; library, framework and file-naming
conventions, which are the stack document's; whether a module that straddles two layers should be
split now.

## Arrow

**ARR-1**
*Scope:* code of one layer of a system depends on code of another layer of the same system: it
imports it, receives it, or calls it.
*Statement:* The dependency MUST be one leg of the arrow: driving adapter to service, service to
driven adapter, driven adapter to the outside, any layer to the domain.
*Why:* A dependency that is no leg of the arrow lets one part of the system know what it has no
business knowing. A service that knows the route that calls it, or the store client that saves
for it, changes whenever either changes, and a second way in, or a second store, means rewriting
the use case. A driving adapter that skips the service and reaches a driven adapter or the store
reads state and decides by it, or writes outside any use case and outside the transaction a
service holds, and the rules in the domain are bypassed for that one way in. A driven adapter that calls a
service has a use case inside it, in the layer meant to do nothing but talk to the outside. A
domain that depends on a layer drags that layer along wherever the domain is imported: a browser
importing a schema loads the server's store client with it. With the arrow one way, the system is
replaced from the outside in, a new driving adapter, a swapped driven adapter, with service and
domain untouched.
*Provenance:* Cockburn's hexagonal architecture: the application knows neither the adapters that
drive it nor those it drives. Khononov, ch. 8: ports and adapters invert the dependency, the
infrastructure layer depends on the business logic layer and not the other way around.
*Examples:* —

## Domain

**DOM-1**
*Scope:* a domain module imports a module.
*Statement:* The import MUST be one of: another domain module, a port of the common library, the
published language of an upstream this system conforms to, a library that computes from its
arguments.
*Why:* The test for a module is two questions: does calling it reach outside the process, and
does it exist on every runtime? A store client, an HTTP client, a mailer SDK, `node:fs` and a
clock reach outside, so they stay behind ports. A validation library takes arguments and returns,
so it passes, and so does any library like it. `node:path` reaches nowhere outside the process
and still breaks in a browser; `Buffer`, `process`, `window` and the DOM are one runtime's. A
domain that imports any of these loads on one runtime, and whoever imports it elsewhere, a browser
rendering a form from the schema, another system reading the published language, gets a load
error or the server's store client along with the model. A common-library module that itself
imports `node:async_hooks` carries the same problem one step removed.
*Examples:* —

**DOM-3**
*Scope:* a rule about the shape of a record: which fields it has, what each holds, which values a
status takes.
*Statement:* It MUST be stated once, as a schema in the domain.
*Why:* A schema says what the functions beside it say, in a form that also checks at runtime, and
the type is inferred from it. Stated a second time, as a type declared beside the schema, a
validator in a driving adapter, a second constructor in a client-side optimistic update, the two
drift, and the drift stays invisible until two parts of the system disagree about a rule neither
writes down. Everything that builds the record parses against the one schema or derives from the
one domain function, and a changed field lands as a compile error in every builder at once.
*Examples:* —

**DOM-4**
*Scope:* an aggregate needs something of another aggregate, or of data another system owns.
*Statement:* It MUST hold it as the other's id, or as a value copied when it needed it.
*Why:* The copy is this aggregate's fact from then on: the price the order was placed at stays
after the catalog changes it. A reference that loads the other's whole record makes the two one
aggregate, written by two sets of use cases (SYS-8), and carries the other's model into this one:
its fields, its rules, its changes. The repository then loads and saves, along with its aggregate,
what another repository owns.
*Provenance:* Vernon's aggregate rule: reference other aggregates by identity only.
*Examples:* —

**DOM-5**
*Scope:* this system declares a driven port.
*Statement:* The declaration MUST be in the domain.
*Why:* The rules say what they need, store this order, send this mail, and the driven adapters do
it; assembly picks which. Declared elsewhere, in a service module or beside the adapter, the
domain function that needs the port has no way to name it without importing a layer (DOM-1), so
the service ends up holding what the rules decide. Declared in the domain, a driven adapter
depends on the domain and nothing else of the system (ARR-1), and the fake and the real adapter
implement the same declaration.
*Examples:* —

**DOM-6**
*Scope:* a repository method takes a transaction to join.
*Statement:* Its type in the domain MUST be opaque: it names no store and no store client.
*Why:* The repository is a port in the domain (DOM-5), so its signature is domain code and goes
wherever the domain goes (DOM-1). A store client's type there names the store in every runtime
that imports the domain and ties the fake adapter to the real store's client. An opaque type, the
common library's transaction port's, lets the service pass the transaction through and the adapter
narrow it to what its store needs on its own side.
*Examples:* —

## Service

**SVC-1**
*Scope:* a system declares a driving port.
*Statement:* It MUST be declared beside the service that implements it, outside the domain.
*Why:* A use case is not a domain concept: the rules say what an invoice is, not that there is a
"create invoice" call. A driving port in the domain hands every importer of the domain, a
browser, another system, the names of this system's use cases, and the domain then changes
whenever a use case is added. Beside the service, the port is exported as a type, not a value, on
the export path (SYS-10), and the implementation sits where the declaration is.
*Examples:* —

**SVC-2**
*Scope:* a use case decides by what this system has stored: whether this caller is allowed,
whether the stock suffices, whether the order is still open.
*Statement:* The service that acts MUST make the decision itself, in the call that acts.
*Why:* A driving port does not know how it is reached, so a check made in a driving adapter
protects one way in; another adapter, or a downstream calling the port directly, bypasses it. The
service sees every call. A service that answers a question exists for screens, to hide a button
for instance; it is not a gate in front of the acting service. If a driving adapter asked first and
then called the acting service, the acting service checks again anyway, because things change
between the two calls. So the acting service loads the data, asks the specification and refuses
where the specification says no. An answering service asked first, to learn whether the act is
allowed, is a gate on one way in, and its answer is stale by the time the act runs; an answering
service asked for an argument the act takes, who this session belongs to, decides nothing.
*Examples:* —

**SVC-3**
*Scope:* a service of a system needs what another service of the same system does.
*Statement:* It MUST NOT call that service.
*Why:* A service is the transaction (TX-1); one inside another nests two transactions, and the
inner one has no retry and no rollback of its own. If two use cases need the same writes, both
call the same repositories inside their own transaction, and the domain decides what the writes
are. If one use case follows another, a message in the outbox carries it (TX-15), and the message
is what retries. A call to an upstream's driving port is a call to a driven port of this system
(SYS-3), not a nested use case.
*Provenance:* Khononov: the application service is the transaction.
*Examples:* —

**SVC-4**
*Scope:* a use case writes a record.
*Statement:* The write MUST go through the repository of the aggregate the record belongs to.
*Why:* The repository saves the aggregate whole, in the transaction it is handed (TX-2). A write
from the service itself, an insert or update with a store client, lands beside the aggregate's
writes with nothing that keeps them whole, and puts the store's name into the service (ARR-1).
The service keeps the deciding, the repository the saving. A service that does nothing but call
its repository is that split working, not an extra layer: a driving adapter calls a service
(ARR-1), and when the repository is deleted the compile error lands in the service that named it,
not in a driving adapter.
*Examples:* —

**SVC-5**
*Scope:* a service needs a value: a dependency, or something its use case decides by, such as who
is calling.
*Statement:* It MUST receive it as an argument: a dependency through its factory, what the use
case decides by through its driving port.
*Why:* Anything a service reads ambiently, it reads to pass on. If it passes it to a driven
adapter, the adapter reads it itself. If it passes it to the domain, the domain decides by it, so
it is part of what the caller brings and belongs in the port. There is no third case. A value the
use case decides by that arrives ambiently is invisible in the port's signature: a second driving
adapter, or a test, does not know to supply it, and the current user read from a request context
is a different user in a handler, which runs in no request at all.
*Examples:* —

## Driving adapters

**DRV-1**
*Scope:* a driving adapter has adapted its caller's request.
*Statement:* It MUST make one call that acts, to one service.
*Why:* A driving adapter that needs two acting calls has a use case growing inside it: which
second call to make, and what to do when the first succeeded and the second fails, are a use
case's decisions, and here they sit in one way in, without a transaction, repeated or missing in
the next way in. A driving adapter that hands a repository a transaction and a callback has not
delegated a use case; it has written one, inside itself. Preparing the call is the adapter's job:
validating and translating the input, putting per-request ambient values in, asking a
specification about the input it holds, working out who the caller is. Where that last one takes
this system's stored state, a session, an API key checked against a record, it is a question to a
service that answers (SVC-2), and the answer becomes an argument of the acting call. An answering
call whose answer decides whether to act is the use case's decision sitting in the adapter. Either
way the adapter calls services and nothing else of the system (ARR-1).
*Provenance:* The conversion is Cockburn's adapter.
*Examples:* —

**DRV-3**
*Scope:* a driving adapter needs its service.
*Statement:* It MUST take it as an argument where assembly constructs the adapter, and read it
from a courier where it does not.
*Why:* An adapter assembly does not construct, a server function the framework finds and calls,
has no caller to hand it anything. Importing the service's module instead gets a factory, not an
instance; importing assembly runs assembly at module load and lets the adapter pick its own
instance. Either way a second place exists where port and implementation meet, and the test has
no way to hand the adapter a fake. The courier keeps assembly the one place.
*Provenance:* That a driving adapter never imports assembly, and the courier, are this document's
choices. In Cockburn's example the driving adapter wires the application itself; Khononov resolves
ports "in the infrastructure layer, either through dependency injection or by bootstrapping"
(p. 128).
*Examples:* —

**DRV-6**
*Scope:* a driving adapter reads from a courier.
*Statement:* It MUST read when it runs, not when its module loads.
*Why:* The module loads when the framework discovers it, before or while assembly runs, so a read
at load time finds the courier empty, or holds the first instance for the life of the process. A
test that fills the courier with fakes (TST-4) changes nothing the adapter already holds.
*Examples:* —

## Driven adapters

**DVN-2**
*Scope:* a driven adapter needs something.
*Statement:* It MUST import what is static, the domain, the schema it validates with, the port
types, and take what is built through its factory: a store client, an upstream's open host
service it translates for, another adapter.
*Why:* What is built exists per process and per test, so an adapter that imports it instead of
receiving it is stuck with that one (ASM-2): its test needs the real store. What is static is the
same in every process, so handing it in through the factory adds a parameter nobody varies and
hides, among the real dependencies, which ones a test has to supply.
*Provenance:* That adapters are received is Khononov's (p. 128) and Cockburn's; the split between
imported and received is this document's.
*Examples:* —

## Assembly

**ASM-1**
*Scope:* a process.
*Statement:* It MUST have one assembly.
*Why:* Two assemblies in one process are two places where a port meets its implementation, and two
instances of what exists once: two store clients, two relays. Which system builders the one
assembly calls follows from how the process is driven: a server's assembly calls the open host
service builders, a worker's the handler and outbox reader builders, a process doing both calls
both.
*Provenance:* Seemann's composition root, one per application; that it sits apart from the
driving adapters is this document's choice (DRV-3).
*Examples:* —

**ASM-2**
*Scope:* a service, an adapter, a system builder or any other factory needs a dependency.
*Statement:* It MUST receive the dependency from its caller.
*Why:* A dependency built in place breaks substitution: a service that builds its own adapter is
stuck with it, so its tests need the real thing, and a second instance of what exists once
appears. A system builder is a factory for its system, and its upstreams are dependencies like any
other: assembly builds them and hands them in, so each exists once, the graph is visible in one
place, and a test hands the builder a fake upstream. Built in place, this breach is invisible to
the other rules: the code sits in the right layer and calls in the right direction. A module that
exports a ready-made instance beside its factory is the breach one step removed: the importer
receives nothing, it imports the built thing.
*Provenance:* Seemann's composition root; Spring Modulith's one application context.
*Examples:* —

**ASM-7**
*Scope:* plumbing of the common library with one configuration for the whole process: a logger, a
tracer.
*Statement:* It MAY be imported as a ready-made instance.
*Why:* ASM-2 exists so a dependency is substituted and exists once; plumbing with one
configuration is substituted by nobody and exists once by being a module. Handing it through
every factory adds a parameter to every signature for nothing a test varies. The line is
substitution: a logger a test silences, a tracer a test inspects, gets substituted, and then the
harm in ASM-2 is back.
*Examples:* —

**ASM-3**
*Scope:* a value is ambient, in either scope.
*Statement:* A use case and a domain function MUST NOT decide by it.
*Why:* An ambient value is in no signature. A use case that decides by one, the current user for a
permission, the locale for a rule, depends on something no caller knows to supply: the second
driving adapter forgets it, the test does not set it, the handler runs in another request where
it is absent, and the decision changes without a trace. What a use case decides by arrives through
its driving port (SVC-5); what is ambient is what gets recorded or forwarded, a request id, a
trace context, the locale a mail is rendered in, the user an audit column records.
*Provenance:* Fowler's registry, in two scopes. The per-process scope is a service locator in
Fowler's terms, a departure from the injection the sources prefer, confined to the courier
(ASM-4). Where the line between ambient and argument falls is this document's choice.
*Examples:* —

**ASM-4**
*Scope:* code reads the courier that carries what assembly produced.
*Statement:* It MUST be a driving adapter that assembly does not construct.
*Why:* The courier is a service locator: whoever reads it gets a dependency without anyone handing
it over, so the graph of who depends on what leaves the one place it is visible (ASM-1, ASM-2).
The one code with no caller to hand it anything is a driving adapter the framework constructs
(DRV-3); everything else has a factory. A service reading the courier is SVC-5's breach; a driven
adapter reading it is ASM-2's.
*Examples:* —

**ASM-8**
*Scope:* the courier that carries what assembly produced.
*Statement:* Assembly MUST fill it before any driving adapter runs: directly, or through
middleware it installs where the courier is the framework's request context.
*Why:* A driving adapter reads the courier when it runs (DRV-6) and gets what is there. Filled
late, the first requests find it empty; filled by anything but assembly, a second place produces
instances. Which courier a codebase uses is the stack document's.
*Examples:* —

**ASM-9**
*Scope:* a transaction.
*Statement:* It MUST NOT be an ambient value.
*Why:* What a read returns depends on the transaction it runs in: a repository reading an ambient
transaction returns different data depending on what the caller happened to open, and a use case
decides by that data, which is ASM-3's harm one step removed. Handed as an argument (TX-1), the
transaction is visible in every signature it crosses, and a write that got none is a write that
opened its own (TX-10), visible as well.
*Examples:* —

**ASM-5**
*Scope:* the relay and the bus.
*Statement:* They MUST import no system.
*Why:* They are common library: one relay reads every system's outbox, one bus delivers to every
system's handlers, and the assembly of the process that runs them hands them the outbox readers
and the handlers (ASM-2). A relay that imports a system knows its readers, and a new system means
a change to the relay; a relay that imports a system's schema puts a model in the common library
(ASM-6).
*Examples:* —

**ASM-6**
*Scope:* the common library.
*Statement:* It MUST hold no model: no schema, no aggregate, no rule of any system.
*Why:* The common library is plumbing every system imports. A model in it is one every system
shares: a change made for one system's reason reaches all of them, and no system's rules decide
it, because a system's rules are in its domain. The shape two systems both need has a home in each
system's domain, or in the published language of the one that is upstream (SYS-2).
*Examples:* —

## Transactions

**TX-1**
*Scope:* one use case writes several aggregates of this system in one transaction.
*Statement:* The service MUST hold the transaction: open it, hand it to each repository method,
commit it.
*Why:* A repository saves one aggregate whole and knows nothing of the others. The service sees
the whole use case, so it is the one that knows which writes land together; a repository that
opened the transaction would be deciding that for writes it does not see. Opening the transaction
through the common library's transaction port is what keeps the store's name out of the service
(ARR-1) and the client's type out of the domain (DOM-6).
*Examples:* —

**TX-2**
*Scope:* a repository method is handed a transaction.
*Statement:* It MUST write inside it.
*Why:* The transaction was handed over so that this write lands with the others (TX-1). A method
that takes it and writes without it, or opens its own, commits on its own: a failure between the
writes leaves the use case half done, and the transaction's rollback leaves this write in place.
The breach hides in small edits: a loop with one write per iteration is one transaction per item;
a write moved out of a function tends to get a transaction of its own.
*Examples:* —

**TX-10**
*Scope:* a repository method is called without a transaction.
*Statement:* It MUST commit its writes in a transaction of its own.
*Why:* An aggregate is changed as one unit (glossary). A save that writes the aggregate's records
one by one and fails midway leaves an aggregate the rules did not produce, and the repository is
the one place that knows how many records the save takes.
*Examples:* —

**TX-3**
*Scope:* a use case of this system changes data another system owns, a third party's included: a
mail sent, a payment created.
*Statement:* It MUST do so by writing a message to this system's outbox.
*Why:* The owner's rules decide its data (glossary: Aggregate), so a change to it is the owner's
use case, and this system at most asks for it. Changing it directly, writing the owner's record or
calling the third party inside this transaction, puts a write this system's rules do not decide
into this system's transaction: there is no rollback once the third party has acted, no retry once
this transaction committed and the third party had failed, and the owner's model is now in this
service. Written to the outbox in the same transaction (TX-6), the message is exactly as committed
as the change it tells of, and whoever acts on it, the owner's handler or this system's (TX-11),
retries it until it lands.
*Provenance:* Khononov's outbox pattern (ch. 9); Vernon (ch. 8) on domain events crossing
bounded contexts.
*Examples:* —

**TX-11**
*Scope:* a use case of this system changes data a third party holds, through a message in its
outbox.
*Statement:* A handler of this system MUST handle the message and make the call to the third
party.
*Why:* A third party reads no bus; nobody acts on the message unless this system does. The
handler runs in a transaction of its own (TX-8), apart from the use case that wrote the message,
so a failed call is retried by redelivery and the use case's commit stands while the third party
is down. The translation into the third party's terms is the driven adapter the handler calls
(SYS-11).
*Examples:* —

**TX-12**
*Scope:* a use case of this system reads data another system owns.
*Statement:* It MUST read it through the owner's open host service.
*Why:* The owner's open host service is the ports it offers on purpose, in its published language
(SYS-1, SYS-2). Reading its store directly, a join across both systems' tables, a query against
its records, binds this system to the owner's storage: the owner's schema change breaks this
system's query with no compile error, and the owner's rules, which decide what a record means,
are bypassed. In-process the open host service is a function call (SYS-3); going through it costs
a port, not a network hop.
*Examples:* —

**TX-13**
*Scope:* a use case of this system reads data another system owns and the owner's open host
service offers no fitting read.
*Statement:* It MAY read a copy kept in this system, updated by the owner's published messages.
*Why:* TX-12 has the read go through the owner's ports; where none fits, a listing filtered by a
term the owner does not know, the alternatives are a read of the owner's store or a copy. The copy
is this system's aggregate (glossary): its rules decide what it holds, the owner's messages update
it (TX-8), and the owner publishes them (SYS-2). The copy lags by a moment and drifts where a
message is lost, so SYS-7 asks a reconciliation of it.
*Examples:* —

**TX-14**
*Scope:* a use case of this system writes several aggregates of this system.
*Statement:* It SHOULD write them in one transaction.
*Why:* A failure between two writes that belong to one use case leaves it half done: the order
placed and the cart not cleared. One transaction, held by the service (TX-1), makes the writes
land or fail together. The alternative, one aggregate written and a message in the outbox for the
rest (TX-15), is eventual, and eventual means a moment where the two disagree and a
reconciliation where they keep disagreeing.
*Provenance:* This document's choice. Vernon and Khononov keep one aggregate per transaction and
have the rest follow by domain event.
*Examples:* —

**TX-15**
*Scope:* a use case of this system writes several aggregates of this system, and a later write of
them following the first by a moment does no harm.
*Statement:* It MAY write the first in its transaction and put a message in the outbox for the
rest.
*Why:* TX-14 has the writes in one transaction because a use case half done is the harm; where the
later write arriving a moment later is not half done, a reservation after an order, a statistic
after a sale, the one transaction buys nothing and costs the lock on both aggregates and a use case
with no retry in part (SVC-3). The message is written in the first write's transaction (TX-6) and
handled in its own (TX-8).
*Examples:* —

**TX-4**
*Scope:* a system's outbox.
*Statement:* Its port MUST be a driven port the system declares, its adapter and its reader the
system's own.
*Why:* A message is a record this system's use case writes, decided by this system's rules, so it
is this system's (glossary: Aggregate). A reader that returns another system's messages, or an
outbox port in the common library, makes the messages nobody's: their schema is in no domain
(ASM-6), and which system's transaction they are written in (TX-6) is undecided. Where the
messages live is left to the system: a table of its own, a store another transaction reaches, a
field it owns on a record in another system's store. TX-6 fixes one thing, that the message is
reachable from the transaction that produced the change, and that transaction is wherever the
change is.
*Provenance:* Khononov (ch. 9) and Richardson put the outbox table in the publishing aggregate's
own database; Vernon (ch. 8) has the model and the messages share one persistence instance. That
the messages may live on a record, or in a store another system's transaction reaches, is this
document's.
*Examples:* —

**TX-16**
*Scope:* a system writes to several stores.
*Statement:* It MUST have an outbox in each.
*Why:* The message is written in the transaction that produced the change (TX-6), and a
transaction is one store's (glossary: Store). A change in the second store with the one outbox in
the first has its message in a transaction that is not the change's: the message survives the
change's rollback, or the change commits and the message is never written.
*Examples:* —

**TX-5**
*Scope:* a handler receives a message.
*Statement:* It MUST handle each message id once.
*Why:* Delivery repeats: a handler that failed after acting is delivered the message again, a bus
restarted redelivers what it had in flight. A handler that acts on every delivery reserves the
stock twice and sends the mail twice. The id is what lets the handler recognize the repeat, so a
message schema without one leaves the handler no way to comply, and a handler that reads "not
found" as "already handled" has mistaken an early arrival for a repeat.
*Provenance:* At-least-once delivery with the consumer de-duplicating is Vernon's (ch. 8) and
Khononov's (ch. 9).
*Examples:* —

**TX-6**
*Scope:* a use case writes a message about a change it makes.
*Statement:* It MUST write the message in the transaction that commits the change.
*Why:* Written before the commit and outside the transaction, the message survives a rollback of
the change and tells of something that did not happen. Written after the commit, the process dies
between the two and the change commits with no message, so nothing downstream ever learns of it.
In the same transaction, the two are as committed as each other.
*Provenance:* Khononov's outbox pattern (ch. 9).
*Examples:* —

**TX-7**
*Scope:* the schema of a message changes, a domain schema the message re-uses included.
*Statement:* The change MUST keep old messages readable by new code and new messages readable by
old code: no field renamed, removed, made required or narrowed.
*Why:* A message is handled by code older or newer than the code that wrote it. One written before
a deploy sits in the outbox and is handled after it; a handler still on old code, in a process not
yet restarted, reads one written by new code. The type checker sees none of this: the stored
message is not in the program, so a renamed field compiles and fails at runtime, on a message
nobody re-sends.
*Examples:* —

**TX-8**
*Scope:* a handler handles a message.
*Statement:* It MUST handle it in a transaction of its own.
*Why:* One transaction per message lets the bus retry a failed message alone, without undoing or
repeating the others delivered with it, and keeps the handler's writes apart from the transaction
that wrote the message, which committed in another process (TX-3). A handler that handles several
messages in one transaction fails all of them when one fails, and redelivery then repeats the ones
that had succeeded (TX-5).
*Provenance:* Vernon (ch. 10): subscribers execute in a separate transaction.
*Examples:* —

**TX-17**
*Scope:* a system publishes a message.
*Statement:* Its code MUST NOT name a system that handles the message.
*Why:* The writer does not know its readers: it publishes, and which systems handle the message is
each receiver's decision, made by subscribing its handler (glossary: Bus). A publisher that names
its handlers changes whenever a system starts or stops listening, and imports what it names
(SYS-9), so the dependency runs from upstream to downstream, against the one the published
language establishes.
*Examples:* —

**TX-18**
*Scope:* a handler needs a value the request that wrote the message carried: the user who acted,
the locale.
*Statement:* The message MUST carry it.
*Why:* The handler runs in another request, in another process, later: the request context that
held the user is gone (ASM-3), and a handler reading an ambient value finds nothing, or the bus's
own context. What the message carries was written in the transaction that knew it (TX-6) and
arrives with it.
*Examples:* —

## Other systems

**SYS-1**
*Scope:* a system exports a path for other code to import.
*Statement:* What the path exports MUST be the system's offer: its published language, its
driving port types, its system builders, or a fake of its driving ports for downstream tests.
*Why:* Driven ports, services and adapters are what a system needs, not what it offers; a
downstream that imports one couples to the inside, and the system changes its adapters by changing
its downstreams. The offer is what downstream systems need to talk to it, the published language
and the port types, and what assembly needs to build it, the builders. A fake of the driving ports
is part of the offer for tests and lives on a path production does not load.
*Provenance:* Khononov's open host service and published language; the export paths are this
document's.
*Examples:* —

**SYS-9**
*Scope:* code of one system imports from another system.
*Statement:* It MUST import from one of that system's export paths.
*Why:* An export path is a promise (SYS-1); a deep import past it reaches a service, a driven port
or an adapter, the inside, and holds whatever file layout it found there. A linter holds this
boundary from import paths alone, so the breach shows in the diff and costs nothing to find.
*Examples:* —

**SYS-10**
*Scope:* the export path of a system's published language and driving port types.
*Statement:* Loading it MUST load the domain and nothing else of the system: the port types are
exported as types, not values.
*Why:* A downstream, or a browser, imports the published language for the schemas. A path that
also loads a service, because the port types sit beside it (SVC-1) and were exported as values,
pulls the service's dependencies along: a store client in a browser bundle, a second system's
whole graph in a test that wanted one type. Exported as types, the port types vanish at compile
time and the path loads the domain (DOM-1).
*Examples:* —

**SYS-2**
*Scope:* a system declares its published language.
*Statement:* It MUST be the domain's own schemas, re-exported: the published messages included,
the private ones excluded.
*Why:* A published language kept apart from the domain is a second statement of the same shapes
(DOM-3): the two drift, and a translation layer between them appears in every system to keep them
aligned. Re-exported, the schema a downstream parses with is the one the upstream validated with.
A private message is meant for the system that wrote it (glossary); exported, it becomes a
contract (TX-7) the system did not mean to give.
*Provenance:* Khononov keeps the published language and the domain apart from the start;
re-exporting the domain, messages included, is this document's choice.
*Examples:* —

**SYS-3**
*Scope:* a downstream system calls an upstream's driving port.
*Statement:* The downstream MUST call it through a driven port of its own, implemented by what
assembly picks.
*Why:* In-process, assembly hands the downstream the upstream's service itself; out of process, a
driven adapter of the downstream, an HTTP client. Moving the upstream out of process then changes
assembly and adds that adapter, and nothing in the downstream's services or domain. A downstream
that imports the upstream's service and calls it has decided in-process for good, and tests with
the upstream running.
*Examples:* —

**SYS-5**
*Scope:* a downstream integrates an upstream of this codebase that offers an open host service.
*Statement:* It SHOULD be a conformist.
*Why:* An open host service publishes its model on purpose, in a published language this codebase
writes (SYS-2); translating it changes nothing and costs a layer, a driven port whose types copy
the upstream's field for field and an adapter that maps each field to itself, or a message schema
copied field for field from the system that publishes it. Under conformist, the upstream's terms
in the downstream's domain are the design working, not a leak. The upstream's change still reaches
the downstream, but as a change this codebase makes, with the compiler showing every place it
lands.
*Provenance:* Conformist as the default for an open host service is this document's choice. The
context-map patterns are Evans's; Vernon (ch. 3) on choosing between them.
*Examples:* —

**SYS-11**
*Scope:* a downstream integrates an upstream whose code this codebase does not write: a third
party's API, a product.
*Statement:* It SHOULD put an anti-corruption layer between them.
*Why:* A foreign model changes on terms this codebase does not control, and its terms are not this
domain's: a PaymentIntent is not a Payment. Untranslated, the foreign terms spread into the domain
and the services, and the upstream's change is absorbed everywhere at once instead of in the
adapters that touch it. One module holding the translation for both the driven adapters that call
into the upstream and the hooks it calls into keeps it in one place.
*Provenance:* Evans's anti-corruption layer; that a product counts as a foreign model is this
document's.
*Examples:* —

**SYS-7**
*Scope:* a system keeps a copy of data another system owns, or changes data another system owns
through messages.
*Statement:* It MUST have a reconciliation for it.
*Why:* Consistency between systems is eventual (TX-3, TX-13): a change crosses by message, later.
A moment's lag is the design working; a gap that stays is drift, from a message lost, a handler
that failed for good, a copy updated out of order, and a comparison after the fact is what finds
it. The reconciliation is a use case of the system whose aggregate it repairs: for the copy, this
system's own; for the owner's data, the step that asks the owner to repair. It is called like any
use case, by a scheduled task, or by whichever driving adapter notices the drift.
*Examples:* —

**SYS-8**
*Scope:* one record carries fields whose rules two systems decide: a product document with
editorial copy and a price.
*Statement:* Each system MUST model its fields as an aggregate of its own, sharing the record's
id.
*Why:* An aggregate belongs to the system whose rules decide what it holds (glossary), so one
record with two deciders is two aggregates. Modeled as one, one system's use case writes a field
the other's rules decide, with no message (TX-3) and no rule of its own behind the write, and a
repository loads and saves fields its system does not own, so a save undoes the other system's
change. Two aggregates with one id each have a repository over their own fields, and the other's
fields reach them as another system's data (DOM-4, TX-12).
*Examples:* —

## Tests

**TST-2**
*Scope:* a test in the default suite reaches a driven port whose real adapter talks to an external
dependency.
*Statement:* It MUST use a fake implementation of the port.
*Why:* The default suite runs on every save and before every commit, and it is run that often
because it is fast enough that nobody thinks about running it. One real database in it makes it
slow and makes it need an environment; from then on it is run less, and failures are found later.
A port with one implementation is not premature: the fake is the second.
*Examples:* —

**TST-8**
*Scope:* a suite runs against the fake or against the real adapter.
*Statement:* The choice MUST be a flag, not an edit.
*Why:* The real run is what you reach for when a failure makes you doubt the fake (TST-6). If
reaching for it means editing imports, it is not reached for, and the fake drifts unnoticed.
*Examples:* —

**TST-3**
*Scope:* a domain rule is tested.
*Statement:* The test SHOULD call the domain function directly.
*Why:* The domain is pure (DOM-1): the test needs no fixture, no fake and no setup, and fails for
one reason. Tested through a service, the same rule needs fakes for every port the service takes,
and a failure is the service's, the fake's or the rule's. Most of what is worth asserting lives in
the domain, so this is where most tests are.
*Examples:* —

**TST-4**
*Scope:* a service or a driving adapter is tested.
*Statement:* The test MUST hand it fakes for its ports.
*Why:* Both receive their ports (SVC-5, DRV-3), so the test hands them fakes, and then it tests
what the service decided and what the adapter translated, not whether the database works
(TST-5). A driving adapter assembly does not construct reads its ports from a courier (DRV-3); the
test fills the courier with fakes.
*Examples:* —

**TST-5**
*Scope:* a driven adapter is tested.
*Statement:* The test MUST be an integration test.
*Why:* A driven adapter's whole job is to talk to something external. A unit test of one asserts
against a mock of the thing it exists to reach, and passes when the mock agrees with the adapter's
idea of the database, which is exactly what is in doubt. Self-contained pieces of an adapter, a
query builder's output, a mapping function, are functions, and a direct test of them pays off the
way a domain test does (TST-3).
*Examples:* —

**TST-6**
*Scope:* a driven port has a fake and a real adapter.
*Statement:* One contract suite MUST be written against the port and run against both.
*Why:* The run against the real adapter is the integration test (TST-5); the run against the fake
is what stops the fake from drifting into a fiction that passes while production breaks. Two
suites, one per implementation, drift the same way the fake does.
*Examples:* —

**TST-9**
*Scope:* several systems fake the same port: an upstream's driving port, called by several
downstreams.
*Statement:* Each downstream SHOULD write its own fake.
*Why:* A fake the upstream exports (SYS-1) fits where its downstreams need the same things of it;
one that needs configuration per downstream has outgrown being shared, and every downstream's
test then depends on the upstream's test code. A downstream's own fake fakes what the downstream
uses, and nothing else.
*Examples:* —

**TST-7**
*Scope:* a test asserts.
*Statement:* It SHOULD assert on inputs and observable results: which port was called with what,
what came back, what was stored.
*Why:* A test that survives a rewrite of the thing it tests is one that names what goes in and
what comes out. One that asserts the order of internal calls, or that a private helper ran, breaks
on every refactoring and passes on a behavior change that kept the call order, so it stops being
run or stops being believed.
*Examples:* —

## Retired ids

Never reused: `ARR-2`, `ARR-3`, `DOM-2`, `DRV-2`, `DRV-4`, `DVN-1`, `DVN-3`, `PRD-1` to `PRD-5`,
`SYS-4`, `SYS-6`, `TST-1`, `DRV-5`.
