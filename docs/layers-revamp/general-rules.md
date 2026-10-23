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
reads state and decides by it, or writes outside any use case and the transaction a service would
hold, and the rules in the domain are bypassed for that one way in. A driven adapter that calls a
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
whenever a use case is added. Beside the service, the port is exported type-only on the export
path (SYS-10), and the implementation sits where the declaration is.
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
where the specification says no, and the answering service is called on its own, not as a step
before the act.
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
*Statement:* It MUST make one call, to one service.
*Why:* A driving adapter that needs two service calls has a use case growing inside it: which
second call to make, and what to do when the first succeeded and the second fails, are a use
case's decisions, and here they sit in one way in, without a transaction, repeated or missing in
the next way in. A driving adapter that hands a repository a transaction and a callback has not
delegated a use case; it has written one, inside itself. Preparing the call is the adapter's job:
working out who the caller is (DRV-5), validating and translating the input, putting per-request
ambient values in, asking a specification about the input it holds. None of that is deciding by
what the system has stored (SVC-2).
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

**DRV-5**
*Scope:* a driving adapter works out who its caller is, from a session, a signature, an API key.
*Statement:* It MAY call a driven port it receives for that.
*Why:* ARR-1 has no leg from a driving adapter to a driven adapter, and the caller's identity is
not something the adapter establishes alone: a session is in a store, a key is checked against a
record. The identity is what the caller brings (SVC-5), and the adapter is the one part of the
system that sees the session or the header. Whether the identified caller is allowed to do what
it asks is decided by the service (SVC-2); the port here answers who, not whether.
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

## Retired ids

Never reused: `ARR-2`, `ARR-3`, `DOM-2`, `DRV-2`, `DRV-4`, `DVN-1`, `DVN-3`, `PRD-1` to `PRD-5`,
`SYS-4`, `SYS-6`.
