# General rules

Rules whose Scope is any system. Terms are the glossary's; the rule shape is the README's. A rule
with `—` under Examples is unfinished. Provenance names sources by the short names under Sources
at the end.

`*Audit:*` lines are temporary: the provenance pass of issue 05, removed when it closes. Flags:
*unsourced*, no source states the ruling, or the part named; *contested*, a source rules the other
way; *stronger*, *weaker*, the modal is stronger or weaker than the sources'; *wider*, *narrower*,
the Scope is wider or narrower than the situation the sources rule on; *citation*, the Provenance
before this pass claimed what its source does not say. No flag: the sources state the ruling.

## Assumptions

This document assumes a store that can be read and written, and that can apply several writes
atomically where it says *transaction*. *Record* is used in the relational sense, a row;
substitute your store's equivalent.

Not everything gets a layer. Assembly, a system's export paths and the common library sit outside
the layers. So does code of a process that reports on the process rather than on a system, like
`/health` and `/metrics`.

Tooling sits outside the layers and the rules. It builds systems through their builders or
replaces their internals: an in-memory outbox, a CLI as relay and bus. What it reaches past an
export path is no offer (SYS-1), and a system changes it without notice.

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
*Provenance:* The direction follows Cockburn (Intent: the application is "blissfully ignorant" of
the adapters on every side), Martin (The Dependency Rule: source code dependencies point inward),
Khononov p. 126 (the business logic layer depends on none of the infrastructural components) and MS
(the domain depends on no layer). Evans Reference p. 10 drops the 2003 book's
domain-to-infrastructure dependency (p. 53, p. 55) and names hexagonal as an alternative. Departs:
in Garrido (§6.2.1) and Martin (Crossing boundaries) a service has no source dependency on a driven
adapter at all; the adapter depends on the application, against the flow of control. Against:
Khononov p. 124 and p. 134, MS (simple CRUD microservices in a single layer) and Evans p. 57 pick
the architecture per subdomain; for simple logic, business logic depending on data access is their
recommendation.
*Audit:* ⚑ contested, wider. The leg "service to driven adapter" is a call direction, but the Scope
counts imports: as worded, a service may import a driven adapter, which hexagonal and clean
architecture forbid. Khononov, MS and Evans fit this arrow to complex subdomains; the Scope is any
system.
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
*Provenance:* The direction follows Khononov p. 77 (the model "devoid of any infrastructural or
technological concerns"), MS ("the domain model layer must not directly depend on any infrastructure
framework"), Evans Reference p. 10 and Garrido §3 ("Hexagon depends on nothing, maybe just on
utilities"). The list, and the test of reaching outside the process and existing on every runtime,
are this document's. Departs: Martin (The Dependency Rule) has data formats of an outer circle kept
out of an inner one, against the conformist's import; a shared kernel (Evans p. 251, Khononov p. 51)
has no slot in the list. Against: Khononov p. 70 couples active records to the ORM, for simple
subdomains.
*Audit:* ⚑ unsourced (the list, the runtime test), wider. The principle is sourced; the allowlist is
not.
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
*Provenance:* Stating a rule once follows Evans p. 160 (without a specification "the same rule may
show up in different guises"), Khononov p. 80 (validation resides in the value objects) and MS
(Two-step validation: "you do not duplicate the validation definition"). That the statement is a
schema is this document's. Against: MS recommends field-level validation on command DTOs and in
ViewModels beside the domain's own (Two-step validation; validators in the MediatR pipeline).
*Audit:* ⚑ contested, unsourced (the schema form). MS states field rules a second time at the edge,
on purpose.
*Examples:* —

**DOM-4**
*Scope:* an aggregate needs something of another aggregate, or of data another system owns.
*Statement:* It MUST hold it as the other's id, or as a value copied when it needed it.
*Why:* The copy is this aggregate's fact from then on: the price the order was placed at stays
after the catalog changes it. A reference that loads the other's whole record makes the two one
aggregate, written by two sets of use cases (SYS-8), and carries the other's model into this one:
its fields, its rules, its changes. The repository then loads and saves, along with its aggregate,
what another repository owns.
*Provenance:* The id follows Vernon EAD II p. 8 ("Prefer references to external aggregates only by
their globally unique identity"), Khononov p. 90 and p. 175, MS (only the foreign key, "a good
practice") and Helland 2007 p. 139 (entities knit together by their keys). The copied value follows
Evans p. 97 (the item "holds its own price") and Helland 2005 §5.2. Against: Evans p. 91–92 and
Reference p. 16 let objects hold references to other aggregates' roots, as does Fowler
(DDD_Aggregate). Vernon calls his rule a rule of thumb (EAD III p. 15), breaks it for query
performance (EAD II p. 11, EAD III p. 15), and holds that such a reference "does not cause the
formation of just one, whole aggregate" (EAD II p. 7).
*Audit:* ⚑ stronger, contested. The MUST rests on Vernon's "prefer"; Evans allows the reference;
Vernon denies the Why's "makes the two one aggregate".
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
*Provenance:* For repositories, follows Khononov p. 127–128 (the business logic layer defines the
ports), MS (repository interfaces in the domain model layer, "recommended") and Evans p. 88
(repositories have meaningful roles in the domain design). Departs: Garrido §2.3 has ports belong to
the application, with no split between domain and service; Freeman §2.1 has the object that needs a
role declare it. Against, for other driven ports: Martin (Crossing boundaries) declares the use
case's output port in the use-case circle; Evans p. 76 puts the interface to the mail system in the
infrastructure layer.
*Audit:* ⚑ contested (driven ports other than repositories). Sourced for repositories; for a mailer
or a payment port, Martin and Evans place it outside the domain.
*Examples:* —

**DOM-6**
*Scope:* a repository method takes a transaction to join.
*Statement:* Its type in the domain MUST be opaque: it names no store and no store client.
*Why:* The repository is a port in the domain (DOM-5), so its signature is domain code and goes
wherever the domain goes (DOM-1). A store client's type there names the store in every runtime
that imports the domain and ties the fake adapter to the real store's client. An opaque type, the
common library's transaction port's, lets the service pass the transaction through and the adapter
narrow it to what its store needs on its own side.
*Provenance:* Martin (The Dependency Rule: "the name of something declared in an outer circle must
not be mentioned by the code in the an inner circle") keeps the store client's name out of the
domain. That a repository method takes a transaction at all is this document's: MS shares the unit
of work through the request scope, Evans p. 111 leaves it to the client's unit of work, and Fowler's
Unit of Work collects the writes and commits them at the end.
*Audit:* ⚑ unsourced. Follows from DOM-1 and from passing transactions (TX-1, ASM-9); stands or
falls with them.
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
*Provenance:* Use cases outside the domain follow Fowler (Service Layer: it "defines an
application's boundary and its set of available operations"), Khononov p. 122, Evans p. 53 (the
application layer "defines the jobs the software is supposed to do") and MS (commands in the
application layer). Beside the service is this document's; Garrido §6.2.1 allows a ports module
apart from the implementation. Cockburn (How Many Ports?) and Garrido §2.3 group several use cases
in one port.
*Audit:* sourced. For the glossary: in the sources a driving port groups several use cases.
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
*Provenance:* Follows Khononov p. 85 (the aggregate's public interface validates the input and
enforces all business rules, "in one place") and Cockburn (Motivation: business logic infiltrating
the user interface). The distinction between a gate and an argument is this document's.
*Audit:* sourced in principle; ⚑ unsourced in detail (gate against argument).
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
*Provenance:* The premise follows Khononov p. 86 n. 7 (the application layer "has to orchestrate the
operation as an atomic transaction") and Helland 2007 p. 138 (a method call does not record the
intent and retry; a message across a transaction boundary does). No source rules on one service
calling another. MS has domain-event handlers in the application layer run inside the command
handler's transaction, one piece of application code driving another (Domain events), and its
IdentifiedCommand handler re-dispatches the command it wraps.
*Audit:* ⚑ unsourced. The ruling is this document's; MS does what it forbids, in one shared
transaction.
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
*Provenance:* Follows Evans p. 109 and Reference p. 17 ("delegating all object storage and access to
the repositories"), MS ("the only channel you should use to update the database should be the
repositories") and Khononov p. 86. Against: Fowler (Repository) ties the pattern to a complex domain
model or heavy querying; MS ("Repositories shouldn't be mandatory", "use the Repository pattern or
not, as you see fit"; the DbContext injected directly "for simpler implementations"); Khononov p. 64
(a transaction script "is also free to access the databases directly").
*Audit:* ⚑ contested, wider. Sourced for a domain model; the sources make repositories optional for
simple logic.
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
*Provenance:* Follows Cockburn (Sample Code, Stage 3: the application accepts the repository adapter
it uses), Seemann ("Service Locator violates encapsulation": a locator hides preconditions, the
constructor is the safest channel), MS (infrastructure injected; the command carries "exactly the
information that is needed") and Freeman §3.3.1. Against: Fowler (Inversion of Control Containers,
Concluding Thoughts) gives Service Locator "a slight edge" for application classes; Evans p. 44, p.
108 and Reference p. 17 reach repositories through "a well-known global interface".
*Audit:* ⚑ contested. Seemann and the DI sources back it; Fowler and Evans accept a locator or
global access in application code.
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
*Provenance:* The conversion is Cockburn's adapter (Intent) and Garrido's (§2.4). The duplication in
the Why follows Khononov p. 124 and Fowler (Service Layer). Departs: Khononov p. 122 and p. 124 make
moving the orchestration into a service layer an option ("can"; "a service layer is not always
necessary"); Evans p. 77 gives digesting the request to the application service. One acting call is
this document's.
*Audit:* ⚑ unsourced (one call), stronger.
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
*Provenance:* Where assembly constructs the adapter, follows Garrido §2.5 (the configurator injects
the application instance into the adapter's constructor). For an adapter the framework constructs,
Seemann ("Service Locator is an Anti-Pattern", comment of 2010-02-04) has each framework-created
object pull from the container the framework's application object holds, having "no recourse"
otherwise; his first choice is the framework's factory seam ("Composition Root": a custom
IControllerFactory), so the composition root still constructs the adapter. Cockburn (Sample Code,
Stage 3) has the driving adapter construct the application itself.
*Audit:* ⚑ wider, citation. Seemann reads from a courier only where the framework offers no factory
seam; the rule does wherever assembly does not construct the adapter. The Khononov p. 128 passage
the old Provenance cited is about binding driven ports, not this.
*Examples:* —

**DRV-6**
*Scope:* a driving adapter reads from a courier.
*Statement:* It MUST read when it runs, not when its module loads.
*Why:* The module loads when the framework discovers it, before or while assembly runs, so a read
at load time finds the courier empty, or holds the first instance for the life of the process. A
test that fills the courier with fakes (TST-4) changes nothing the adapter already holds.
*Provenance:* Seemann ("Service Locator is an Anti-Pattern", comment of 2010-02-04) has the read
happen "inside the constructor or Initialize method of each and every object" the framework creates,
per object, not once at load.
*Audit:* sourced.
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
*Provenance:* That what is built is received follows Seemann ("Composition Root": application code
"relies solely on Constructor Injection"); that an adapter depends on the inside follows Garrido
§6.2.1 ("adapters depend on hexagon"). The split between imported and received is this document's.
Evans p. 55 has the infrastructure layer below the domain, knowing nothing of it: the 2003 layering
hexagonal replaces.
*Audit:* ⚑ unsourced (the split), citation. The Cockburn and Khononov p. 128 passages the old
Provenance cited show the application receiving its adapter (SVC-5, ASM-2), not what an adapter
imports.
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
*Provenance:* Follows Seemann ("Composition Root": "a (preferably) unique location"; in a comment of
2011-08-02, "Each application/process requires only a single Composition Root"), Seemann's
interview, Garrido §6.2.1 (one module for starting up) and MS (Program.cs). Departs: for objects a
framework creates, Seemann accepts "a set of distributed Composition Roots" (comment of 2010-02-06),
and warns that "the earlier you compose, the more you limit your options" (comment of 2011-08-02),
against system builders composing a system before assembly sees it.
*Audit:* sourced. The system builder sits against Seemann's composing late.
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
*Provenance:* Follows Seemann ("Composition Root"; Control Freak among the anti-patterns, DIPPP ch.
5), Fowler (Inversion of Control: instantiating directly "stops the finder from being a plugin"),
Garrido §3, Google SWE ch. 13 (Seams) and Freeman §4.9. Departs: Seemann accepts a parameterless
constructor with defaults beside the injecting one, for a library (comment of 2014-09-13); Google
SWE ch. 13 finds dependency injection "less important" in JavaScript, where functions are replaced
dynamically. Against: Evans p. 78 and p. 108 (singleton and global access).
*Audit:* ⚑ citation. Spring Modulith's reference does not state "one application context", as the
old Provenance claimed; otherwise well sourced.
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
*Provenance:* Against: Seemann lists Ambient Context, with logging as its example, among the DI
anti-patterns (DIPPP ch. 5, contents), finds it "best avoided" (interview), and prefers decorators
or interception for logging (comment of 2012-05-11 on "Service Locator is an Anti-Pattern"),
tolerating an ambient logger as "way better than a Service Locator". Khononov p. 56 has a logging
framework as a library each bounded context uses.
*Audit:* ⚑ contested. Seemann rules against; nothing backs the ready-made instance beyond his
fallback.
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
*Provenance:* A use case receiving what it decides by follows Seemann ("Service Locator violates
encapsulation"); his interview ("Ambient Context is also best avoided") goes wider, against ambient
dependencies altogether. The per-request scope is Fowler's thread-specific locator (Inversion of
Control Containers, Using a Service Locator). The line between deciding and recording is this
document's.
*Audit:* ⚑ unsourced (the line), citation. Fowler's Registry summary does not name two scopes, and
Fowler does not prefer injection for application classes, as the old Provenance said.
*Examples:* —

**ASM-4**
*Scope:* code reads the courier that carries what assembly produced.
*Statement:* It MUST be a driving adapter that assembly does not construct.
*Why:* The courier is a service locator: whoever reads it gets a dependency without anyone handing
it over, so the graph of who depends on what leaves the one place it is visible (ASM-1, ASM-2).
The one code with no caller to hand it anything is a driving adapter the framework constructs
(DRV-3); everything else has a factory. A service reading the courier is SVC-5's breach; a driven
adapter reading it is ASM-2's.
*Provenance:* Follows Seemann ("Service Locator is an Anti-Pattern", comments of 2010-02-04): the
framework-created object reaches the container, and "from there on down, there will be no Service
Locator available"; everything else gets an injected abstract factory. Departs: Seemann says this
read "isn't" the Service Locator anti-pattern, and that a limited, well-known context "isn't service
location" (comment of 2015-10-07). Against: Fowler (Service Locator vs Dependency Injection) lets
any application class depend on the locator; Evans Reference p. 17 gives every repository client
global access.
*Audit:* sourced; ⚑ contested (the Why). The Why calls the courier a service locator, which Seemann
does not; Fowler and Evans allow more readers.
*Examples:* —

**ASM-8**
*Scope:* the courier that carries what assembly produced.
*Statement:* Assembly MUST fill it before any driving adapter runs: directly, or through
middleware it installs where the courier is the framework's request context.
*Why:* A driving adapter reads the courier when it runs (DRV-6) and gets what is there. Filled
late, the first requests find it empty; filled by anything but assembly, a second place produces
instances. Which courier a codebase uses is the stack document's.
*Provenance:* Composing before any driving adapter runs follows Garrido §2.5 (the start-up component
builds the system, then runs the driver adapter). The courier and its filling are this document's.
*Audit:* ⚑ unsourced (the mechanism).
*Examples:* —

**ASM-9**
*Scope:* a transaction.
*Statement:* It MUST NOT be an ambient value.
*Why:* What a read returns depends on the transaction it runs in: a repository reading an ambient
transaction returns different data depending on what the caller happened to open, and a use case
decides by that data, which is ASM-3's harm one step removed. Handed as an argument (TX-1), the
transaction is visible in every signature it crosses, and a write that got none is a write that
opened its own (TX-10), visible as well.
*Provenance:* No source states it. In the sources' own designs the transaction travels outside the
signatures: MS shares the unit of work through the request-scoped DbContext (Domain events, single
transaction across aggregates), and Spring Modulith's listener joins its transaction by declarative
propagation (Events, Application Module Listener).
*Audit:* ⚑ unsourced, contested (by practice).
*Examples:* —

**ASM-5**
*Scope:* the relay and the bus.
*Statement:* They MUST import no system.
*Why:* They are common library: one relay reads every system's outbox, one bus delivers to every
system's handlers, and the assembly of the process that runs them hands them the outbox readers
and the handlers (ASM-2). A relay that imports a system knows its readers, and a new system means
a change to the relay; a relay that imports a system's schema puts a model in the common library
(ASM-6).
*Provenance:* No source states it. Khononov p. 150 has the outbox relay execute commands on their
targets, so his relay knows the systems it calls.
*Audit:* ⚑ unsourced.
*Examples:* —

**ASM-6**
*Scope:* the common library.
*Statement:* It MUST hold no model: no schema, no aggregate, no rule of any system.
*Why:* The common library is plumbing every system imports. A model in it is one every system
shares: a change made for one system's reason reaches all of them, and no system's rules decide
it, because a system's rules are in its domain. The shape two systems both need has a home in each
system's domain, or in the published language of the one that is upstream (SYS-2).
*Provenance:* Follows MS (Integration events: share only "final application blocks, like the Event
Bus client API", and no common domain model) and Evans p. 244 ("Code reuse between BOUNDED CONTEXTS
is a hazard to be avoided"). Departs: a shared kernel, a small agreed model two contexts share, is
Evans's (p. 251) and Khononov's (p. 51–52, "a pragmatic exception"); Martin's entities may serve
many applications.
*Audit:* sourced; ⚑ contested (the Why). Its last sentence leaves no home for the shared kernel
Evans and Khononov allow.
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
*Provenance:* The service holding the transaction follows Fowler (Service Layer: "controlling
transactions"), Evans p. 111 ("Leave transaction control to the client"), Khononov p. 86 n. 7 and p.
123, Vernon EAD I p. 3 (the transactional application service) and MS (the command handler commits).
Handing the transaction to each repository method is this document's: MS and Fowler's Unit of Work
share one unit of work through scope.
*Audit:* sourced; ⚑ unsourced (handing it to each method). The Scope's several aggregates in one
transaction is what Khononov p. 87 rules out (TX-14).
*Examples:* —

**TX-2**
*Scope:* a repository method is handed a transaction.
*Statement:* It MUST write inside it.
*Why:* The transaction was handed over so that this write lands with the others (TX-1). A method
that takes it and writes without it, or opens its own, commits on its own: a failure between the
writes leaves the use case half done, and the transaction's rollback leaves this write in place.
The breach hides in small edits: a loop with one write per iteration is one transaction per item;
a write moved out of a function tends to get a transaction of its own.
*Provenance:* Follows Evans p. 111 (the repository "will ordinarily not commit anything").
*Audit:* sourced.
*Examples:* —

**TX-10**
*Scope:* a repository method is called without a transaction.
*Statement:* It MUST commit its writes in a transaction of its own.
*Why:* An aggregate is changed as one unit (glossary). A save that writes the aggregate's records
one by one and fails midway leaves an aggregate the rules did not produce, and the repository is
the one place that knows how many records the save takes.
*Provenance:* The save as one unit follows Khononov p. 87 ("either all the changes are committed or
none of them is") and Evans p. 92. Against: Evans p. 111 names committing after saving as the
temptation to resist; the client holds the unit of work.
*Audit:* ⚑ contested.
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
*Provenance:* Asynchrony across systems follows Evans Reference p. 16 ("Across boundaries, handle
updates asynchronously"), MS (integration events "must be based on asynchronous communication"),
Richardson (Database per service: transactions that span services by saga; Saga: a service "must
atomically update its database and publish a message/event") and Helland 2005 §1.3 (only the owner's
logic changes its data). For a third party, the outbox is an option in Khononov p. 293 ("it can be
used for sending email messages"). Against: EIP (Command Message) and Richardson (Messaging) give
remote procedure invocation as the usual alternative; Spring Modulith publishes synchronously inside
the originating transaction by default, a trade-off it accepts (Events); Khononov's simple saga
calls the other context directly (p. 148).
*Audit:* ⚑ stronger, contested. Sourced for another bounded context's data; for a third party's API
the outbox is an option and the synchronous call the sources' usual alternative. The client_secret
case (issue 04) sits here. Vernon IDDD ch. 8, cited by the old Provenance, was not available.
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
*Provenance:* Khononov p. 149: in the simple saga, the handler of the event executes the command
against the other component. Departs: his stateful saga has the outbox relay make the call (p. 150).
NServiceBus (Outbox, How it works): an operation in a handler that does not enlist in the outbox
transaction, "such as sending emails", is outside the once-only guarantee.
*Audit:* ⚑ unsourced (as a rule). The repeat NServiceBus names, a call that succeeded before a
failed commit, is not covered.
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
*Provenance:* Follows Richardson (Database per service: data "accessible only via its API"; API
Composition), Helland 2005 §1.3 and §6.5 (no access to the data "unless it is mediated by the
application logic of the service"), Evans p. 114 and Khononov p. 209 (no database shared with
another bounded context, except during a strangler migration). Departs: Khononov p. 246 prefers a
local copy where eventual consistency suffices; MS counts a synchronous call to another service
against its autonomy; Evans p. 263 has an open host service pay off only with many integrations;
Richardson weighs a shared database as a pattern with drawbacks (Shared database).
*Audit:* sourced. The sources rank a copy (TX-13) as an equal or preferred alternative, not a
fallback.
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
*Provenance:* Follows Fowler (What do you mean by "Event-Driven"?, Event-Carried State Transfer),
Khononov p. 238, Richardson (CQRS), MS (integration events "for bringing domain state in sync") and
Helland 2005 §4.1 (versioned reference data, "somewhat out of date"). Departs: each picks the copy
for resilience, latency or efficiency, not only where the owner offers no fitting read; Fowler finds
calling the sender "usually easier".
*Audit:* ⚑ narrower. The sources allow the copy in more situations than the Scope.
*Examples:* —

**TX-14**
*Scope:* a use case of this system writes several aggregates of this system.
*Statement:* It SHOULD write them in one transaction.
*Why:* A failure between two writes that belong to one use case leaves it half done: the order
placed and the cart not cleared. One transaction, held by the service (TX-1), makes the writes
land or fail together. The alternative, one aggregate written and a message in the outbox for the
rest (TX-15), is eventual, and eventual means a moment where the two disagree and a
reconciliation where they keep disagreeing.
*Provenance:* This document's choice, against the sources: Vernon EAD I p. 4 ("modifies only one
aggregate instance per transaction in all cases", "a rule of thumb") and EAD II p. 9, Khononov p. 87
and p. 93, Evans Reference p. 16, Fowler (DDD_Aggregate: "Transactions should not cross aggregate
boundaries") and Helland 2007 p. 135. Vernon EAD II p. 10 lists reasons to break the rule. MS calls
one transaction across aggregates "the simplest approach" and "valid in many business cases", while
quoting Vernon against it.
*Audit:* ⚑ contested. Only MS backs it.
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
*Provenance:* Follows Vernon EAD II p. 9 (eventual consistency outside the boundary), MS
("Optionally, for better scalability and less impact in database locks, use eventual consistency
between aggregates") and Evans p. 91. Departs: Vernon, Khononov p. 147, Evans Reference p. 16 and
Helland 2007 p. 137 make it the default, not a permission; Vernon's test is whose job the
consistency is and what delay the domain experts accept (EAD II p. 9), not a moment's harm.
*Audit:* ⚑ weaker. A MAY where the sources make it the rule; follows from TX-14.
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
*Provenance:* The outbox in the publishing system's own database follows Richardson (Transactional
outbox), Khononov p. 145 and MS (the IntegrationEvent table "in the same database where you have
your domain entities"). The outbox as a property of a record is Richardson's (for NoSQL) and
Khononov's p. 146, on the aggregate's own record. Against: messages on a record in another system's
store go against Richardson (Database per service: "A service's transactions only involve its
database"). Spring Modulith's event publication registry and NServiceBus's outbox are framework
infrastructure every module writes through.
*Audit:* ⚑ contested, citation. Modulith and NServiceBus put the outbox in the framework, which this
rule forbids; the other system's store goes against Richardson. Richardson already has the outbox on
a record, which the old Provenance called this document's.
*Examples:* —

**TX-16**
*Scope:* a system writes to several stores.
*Statement:* It MUST have an outbox in each.
*Why:* The message is written in the transaction that produced the change (TX-6), and a
transaction is one store's (glossary: Store). A change in the second store with the one outbox in
the first has its message in a transaction that is not the change's: the message survives the
change's rollback, or the change commits and the message is never written.
*Provenance:* The outbox where the change's transaction is follows Richardson (Transactional
outbox), Khononov p. 146 and MS. One per store is this document's; NServiceBus keeps one outbox per
endpoint and reaches several databases by a cross-database transaction (Outbox, Transaction scope).
*Audit:* ⚑ unsourced (one per store).
*Examples:* —

**TX-5**
*Scope:* a handler receives a message.
*Statement:* It MUST handle each message id once.
*Why:* Delivery repeats: a handler that failed after acting is delivered the message again, a bus
restarted redelivers what it had in flight. A handler that acts on every delivery reserves the
stock twice and sends the mail twice. The id is what lets the handler recognize the repeat, so a
message schema without one leaves the handler no way to comply, and a handler that reads "not
found" as "already handled" has mistaken an early arrival for a repeat.
*Provenance:* Follows Richardson (Idempotent consumer: "a consumer must be idempotent", by recording
the ids of processed messages), NServiceBus (Outbox: deduplication by MessageId), Helland 2007 p.
135 and p. 140, MS (an identity per event, "convenient"; IdentifiedCommand) and Khononov p. 245.
Departs: EIP (Idempotent Receiver) and Helland 2007 p. 139 reach idempotence by the message's
semantics, with no id; MS prefers idempotent handling to deduplication; NServiceBus deduplicates
within a retention window.
*Audit:* ⚑ stronger (by id), citation. Handling a repeat once is sourced; by id is one of two means,
against the Why's "no way to comply". Khononov's deduplication is ch. 15, not ch. 9 as the old
Provenance said.
*Examples:* —

**TX-6**
*Scope:* a use case writes a message about a change it makes.
*Statement:* It MUST write the message in the transaction that commits the change.
*Why:* Written before the commit and outside the transaction, the message survives a rollback of
the change and tells of something that did not happen. Written after the commit, the process dies
between the two and the change commits with no message, so nothing downstream ever learns of it.
In the same transaction, the two are as committed as each other.
*Provenance:* Follows Richardson (Transactional outbox), Khononov p. 144–145, Helland 2007 p. 137
("transactional enqueuing of messages is de rigueur"), NServiceBus (Outbox), MS and Spring Modulith
(the publication log written "as part of the original business transaction").
*Audit:* sourced.
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
*Provenance:* The Why follows protobuf (Dos and Don'ts: "Clients and servers are never updated at
exactly the same time") and Confluent (full compatibility lets producers and consumers upgrade
independently). Against the list: Confluent and protobuf allow removing an optional or defaulted
field, protobuf reserving its tag; protobuf also rules out type and default changes the list omits,
and in JSON an added field can break old readers. Departs: Confluent defaults to one direction plus
an upgrade order, and ships an incompatible change as a new topic; Helland 2005 §3.4 and Khononov p.
55 version the schema instead of changing it; Evans p. 264 concludes from the same stability that
the domain model should not be the medium.
*Audit:* ⚑ contested (the list). The principle is sourced; the list of forbidden changes is this
document's and differs from Confluent's and protobuf's.
*Examples:* —

**TX-8**
*Scope:* a handler handles a message.
*Statement:* It MUST handle it in a transaction of its own.
*Why:* One transaction per message lets the bus retry a failed message alone, without undoing or
repeating the others delivered with it, and keeps the handler's writes apart from the transaction
that wrote the message, which committed in another process (TX-3). A handler that handles several
messages in one transaction fails all of them when one fails, and redelivery then repeats the ones
that had succeeded (TX-5).
*Provenance:* Follows Vernon EAD II p. 9 ("Each of the subscribers executes in a separate
transaction"), Helland 2007 p. 137, Richardson (Idempotent consumer), NServiceBus (Outbox: one
transaction per incoming message) and Spring Modulith (the application module listener runs in a
transaction of its own). Against: Dahan, in Vernon EAD II p. 10, handles a batch of messages in one
transaction that succeeds or fails as a whole; MS dispatches domain events to their handlers inside
the writer's transaction, by design.
*Audit:* sourced; ⚑ contested (batches; private messages in MS).
*Examples:* —

**TX-17**
*Scope:* a system publishes a message.
*Statement:* Its code MUST NOT name a system that handles the message.
*Why:* The writer does not know its readers: it publishes, and which systems handle the message is
each receiver's decision, made by subscribing its handler (glossary: Bus). A publisher that names
its handlers changes whenever a system starts or stops listening, and imports what it names
(SYS-9), so the dependency runs from upstream to downstream, against the one the published
language establishes.
*Provenance:* For events, follows EIP (Publish-Subscribe Channel), Richardson (Messaging),
NServiceBus (Events), MS (the publisher does not need "to know the subscribers"), Spring Modulith
and Khononov p. 233. Against, for commands: NServiceBus ("Commands should be sent to their logical
owner"), MS ("You send a command to a single receiver"), Richardson (orchestration-based saga), EIP
(Process Manager) and Khononov p. 149 (the command names its target). Fowler (Event Notification)
calls an event that expects a receiver to act a "passive-aggressive command".
*Audit:* ⚑ contested (commands). Sourced for events; for commands every source names the receiver.
Also against the glossary's Orchestration.
*Examples:* —

**TX-18**
*Scope:* a handler needs a value the request that wrote the message carried: the user who acted,
the locale.
*Statement:* The message MUST carry it.
*Why:* The handler runs in another request, in another process, later: the request context that
held the user is gone (ASM-3), and a handler reading an ambient value finds nothing, or the bus's
own context. What the message carries was written in the transaction that knew it (TX-6) and
arrives with it.
*Provenance:* Follows Khononov p. 91 (a domain event provides "all the necessary data"), Evans
Reference p. 13 (an event "often" carries who entered it) and Helland 2005 §1.6 (operands qualify
the sender's intent). Departs: Khononov p. 236 keeps event notifications lean, the subscriber asking
the producer for the rest.
*Audit:* sourced in principle; ⚑ stronger.
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
*Provenance:* An offer apart from the internals follows Evans p. 263 (a protocol opened to "all who
need to integrate"), Khononov p. 55 (the supplier decouples the implementation model from the public
interface) and Spring Modulith (the provided interface: API beans and published events). What the
export paths hold, builders and fakes included, is this document's. Departs: Modulith's named
interfaces may export an SPI, a port other modules implement; MS advises against a shared library of
integration events.
*Audit:* ⚑ unsourced (the list).
*Examples:* —

**SYS-9**
*Scope:* code of one system imports from another system.
*Statement:* It MUST import from one of that system's export paths.
*Why:* An export path is a promise (SYS-1); a deep import past it reaches a service, a driven port
or an adapter, the inside, and holds whatever file layout it found there. A linter holds this
boundary from import paths alone, so the breach shows in the diff and costs nothing to find.
*Provenance:* Follows Spring Modulith (internal packages "must not be referred to from other
modules"; verification rejects them; "the Java compiler is not of much use") and Khononov's
intrusive coupling (coupling.dev, Integration strength). Modulith's open modules allow deep access
while a code base migrates.
*Audit:* sourced.
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
*Provenance:* No source. TypeScript's type-only exports.
*Audit:* ⚑ unsourced (stack mechanics).
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
*Provenance:* Against: Evans p. 278 ("do not equate the interchange language and the model of the
host"), p. 244 and Reference p. 36; Khononov p. 55, p. 140 ("a common mistake to design and expose a
published language for the model's objects and allow domain events to be published as they are") and
p. 244; MS (domain and integration events: "their implementation must be different"); NServiceBus
(messages not re-used as domain objects); protobuf (separate types for the API and for storage);
Helland 2005 §1.3 and §6.6. Supports: Spring Modulith publishes a module's own domain events;
Khononov p. 140 keeps private events out of the published language. Evans p. 278 allows keeping the
two close, the host a conformist, while reserving "the right to beef up the translation layer and
diverge".
*Audit:* ⚑ contested. The most contested rule: every DDD source keeps the published language apart
from the domain. The exclusion of private messages is sourced.
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
*Provenance:* Follows Evans p. 249 (the Routing Service's interface insulates the Booking context)
and Khononov p. 148 (the saga's `IPublishingServiceClient`), examples rather than rulings; Spring
Modulith (Testing): a bean reference across modules pulls the other module into the test. Departs:
Modulith has the downstream depend on the upstream's bean type and prefers events to calls.
*Audit:* sourced (examples).
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
*Provenance:* The conformist is Evans's (p. 256, Reference p. 33). Against the default: Evans has it
for an upstream with "no motivation" to help (Reference p. 33), names no default for an open host
service's clients ("some of them will be conformist and some will build anticorruption layers",
Reference p. 35), and typically builds a translation layer for each integration; within the system
under design he reaches for shared kernel or customer/supplier (p. 270). Khononov p. 172: core
subdomains "have to protect their models by using anticorruption layers"; p. 52 points contexts of
one team to a shared kernel. MS has each downstream keep its own copy of an integration event, the
field-for-field copy the Why calls a cost.
*Audit:* ⚑ contested. The sources choose by subdomain, model quality and team, not by who writes the
upstream.
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
*Provenance:* The anti-corruption layer is Evans's (Reference p. 34; p. 259, both directions sharing
translators) and Khononov's p. 54. Against the trigger: Evans p. 256 ("When using an off-the-shelf
component that has a large interface, you should typically CONFORM") and p. 270 (conforming fits
"peripheral extensions to a large system", as a configured product is); Khononov p. 53 names
external service providers as a cause of conforming. Both choose by the upstream model's quality,
fit and volatility, not by who writes its code; Evans p. 270 backs the layer where the interface is
small or the other system badly designed.
*Audit:* ⚑ contested.
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
*Provenance:* No source asks for a standing reconciliation. Closest: MS (for asynchronous commands,
"you must design a separate reporting and recovery system for failures"), Vernon EAD II p. 9 (on
complete failure, compensate or "report the failure for pending intervention"), NServiceBus (Outbox:
retry the failed message, "another action" otherwise), and a comparison after the fact as an option
in Evans p. 97 and MS (Domain events).
*Audit:* ⚑ unsourced, stronger. Recovery is sourced; a reconciliation use case per copy and per
remote change, as a MUST, is not.
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
*Provenance:* Each context modeling its own part of one identity follows MS (Domain entity: the same
identity "can be modeled across multiple Bounded Contexts"), Evans p. 235 (separate charge classes
per model) and Helland 2007 p. 135 (each datum in exactly one entity). One stored record shared by
two systems goes against Richardson (private tables per service) and Khononov p. 209 (a shared
database during a strangler migration only); by Helland's test (2007 p. 136) a key that unifies both
"is really one entity".
*Audit:* ⚑ contested (the shared record). The split is sourced; the shared record the Scope starts
from is what the sources avoid.
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
*Provenance:* Follows Cockburn (Nature of the Solution: the in-memory adapter "most importantly"),
Garrido §2.4 (two adapters per driven port), Vocke (Mocking and Stubbing), Google SWE ch. 13 (a fake
is preferred among doubles once a real implementation is not feasible) and MS (many fast unit tests,
fewer against the database). Against: Fowler (UnitTest: doubles for external resources a "useful
guideline", not "an absolute rule"; a commit suite with a few broad-stack tests); Vocke (fast
integration tests in the unit-test stage); Google SWE ch. 13 (the real implementation until it
becomes too slow; a fake where its speedup outweighs its upkeep).
*Audit:* ⚑ stronger, contested.
*Examples:* —

**TST-8**
*Scope:* a suite runs against the fake or against the real adapter.
*Statement:* The choice MUST be a flag, not an edit.
*Why:* The real run is what you reach for when a failure makes you doubt the fake (TST-6). If
reaching for it means editing imports, it is not reached for, and the fake drifts unnoticed.
*Provenance:* Follows Google SWE ch. 14 (record/replay: running the real mode easy), Cockburn
(Structure: in-memory or real database by configuration) and Vocke (a profile selects the real
database). Mechanisms, not rulings.
*Audit:* sourced.
*Examples:* —

**TST-3**
*Scope:* a domain rule is tested.
*Statement:* The test SHOULD call the domain function directly.
*Why:* The domain is pure (DOM-1): the test needs no fixture, no fake and no setup, and fails for
one reason. Tested through a service, the same rule needs fakes for every port the service takes,
and a failure is the service's, the fake's or the rule's. Most of what is worth asserting lives in
the domain, so this is where most tests are.
*Provenance:* Follows Freeman §4.5, Fowler (Mocks Aren't Stubs), Vocke ("Push your tests as far down
the test pyramid as you can"), Google SWE ch. 12, Khononov p. 165 (for domain models), Evans p. 44
and p. 175, and MS. Departs: Google SWE ch. 12 tests a helper of one or two classes through them;
Khononov p. 165 moves to integration tests for active records.
*Audit:* sourced.
*Examples:* —

**TST-4**
*Scope:* a service or a driving adapter is tested.
*Statement:* The test MUST hand it fakes for its ports.
*Why:* Both receive their ports (SVC-5, DRV-3), so the test hands them fakes, and then it tests
what the service decided and what the adapter translated, not whether the database works
(TST-5). A driving adapter assembly does not construct reads its ports from a courier (DRV-3); the
test fills the courier with fakes.
*Provenance:* Follows the mockist style (Freeman §1.3), Cockburn (Structure: a test harness with the
in-memory database), Garrido §2.4 and MS (mock repositories). Against: Google SWE ch. 13 ("our first
choice for tests is to use the real implementations") and ch. 12; Fowler (Mocks Aren't Stubs: the
classical style uses real objects where possible, his own); Vocke (Sociable and Solitary); Spring
Modulith (module tests run all layers, mocking other modules only); Bogard, quoted in MS.
*Audit:* ⚑ contested. For a driving adapter, the real service over faked driven ports is what
Google, Fowler and Vocke prefer.
*Examples:* —

**TST-5**
*Scope:* a driven adapter is tested.
*Statement:* The test MUST be an integration test.
*Why:* A driven adapter's whole job is to talk to something external. A unit test of one asserts
against a mock of the thing it exists to reach, and passes when the mock agrees with the adapter's
idea of the database, which is exactly what is in doubt. Self-contained pieces of an adapter, a
query builder's output, a mapping function, are functions, and a direct test of them pays off the
way a domain test does (TST-3).
*Provenance:* Follows Vocke (Integration Tests: "you need to run a database"), Google SWE ch. 13,
Pryce as reported by Garrido §6.1.1 (integration tests for adapters) and Bogard, quoted in MS.
Against, for adapters over a third party: Fowler (IntegrationTest: narrow integration tests against
doubles and contract tests, "without ever running tests against a real instance"), Vocke (a fake
server) and Google SWE ch. 14 ("it is not recommended to have automated tests use a real third-party
API").
*Audit:* ⚑ contested (third-party adapters). Also against the glossary's Integration test, which
names a third party's API.
*Examples:* —

**TST-6**
*Scope:* a driven port has a fake and a real adapter.
*Statement:* One contract suite MUST be written against the port and run against both.
*Why:* The run against the real adapter is the integration test (TST-5); the run against the fake
is what stops the fake from drifting into a fiction that passes while production breaks. Two
suites, one per implementation, drift the same way the fake does.
*Provenance:* Follows Google SWE ch. 13 ("A fake must have its own tests"; contract tests against
both as "one approach"), Vocke and Fowler (IntegrationTest, ContractTest). Departs: Fowler runs
contract tests on the external service's rhythm, outside the regular pipeline and not breaking the
build; Google SWE ch. 14 keeps doubles faithful by recorded traffic.
*Audit:* sourced; ⚑ stronger (Google's "one approach").
*Examples:* —

**TST-9**
*Scope:* several systems fake the same port: an upstream's driving port, called by several
downstreams.
*Statement:* Each downstream SHOULD write its own fake.
*Why:* A fake the upstream exports (SYS-1) fits where its downstreams need the same things of it;
one that needs configuration per downstream has outgrown being shared, and every downstream's
test then depends on the upstream's test code. A downstream's own fake fakes what the downstream
uses, and nothing else.
*Provenance:* Against: Google SWE ch. 13 ("the team that owns the real implementation should write
and maintain a fake"; a fake "only at the root") and ch. 14 (a caller's own double is the
unfaithful-double risk; owners' fakes alleviate it). Supports: Vocke (consumer-driven contracts:
each consumer states what it uses) and Spring Modulith (mock the other module's beans). Google SWE
ch. 13 allows writing your own fake where the owners will not.
*Audit:* ⚑ contested. Google rules the opposite; the sources that back it use mocks or contracts,
not fakes.
*Examples:* —

**TST-7**
*Scope:* a test asserts.
*Statement:* It SHOULD assert on inputs and observable results: which port was called with what,
what came back, what was stored.
*Why:* A test that survives a rewrite of the thing it tests is one that names what goes in and
what comes out. One that asserts the order of internal calls, or that a private helper ran, breaks
on every refactoring and passes on a behavior change that kept the call order, so it stops being
run or stops being believed.
*Provenance:* Follows Vocke ("Test for observable behaviour instead"), Google SWE ch. 12 and ch. 13
(test state, not interactions), Fowler (Mocks Aren't Stubs), Freeman §6.2, Evans p. 179 and Spring
Modulith (published events asserted). Departs: Google SWE ch. 13 ranks which port was called with
what below state, and for state-changing calls only.
*Audit:* sourced.
*Examples:* —

## Sources

Books by printed page; web pages and papers by section heading.

- **Cockburn**: Alistair Cockburn, "Hexagonal Architecture", 2005, alistair.cockburn.us.
- **Confluent**: Confluent documentation, "Schema Evolution and Compatibility for Schema Registry".
- **EIP**: Gregor Hohpe and Bobby Woolf, *Enterprise Integration Patterns*, pattern pages at
  enterpriseintegrationpatterns.com.
- **Evans**: Eric Evans, *Domain-Driven Design*, Addison-Wesley 2003, pages of the final
  manuscript. **Evans Reference**: Eric Evans, *Domain-Driven Design Reference*, 2015.
- **Fowler**: Martin Fowler, martinfowler.com: "Inversion of Control Containers and the Dependency
  Injection pattern", "Mocks Aren't Stubs", "What do you mean by 'Event-Driven'?"; bliki entries
  DDD_Aggregate, BoundedContext, UnitTest, IntegrationTest, ContractTest; *Patterns of Enterprise
  Application Architecture* catalog entries Registry, Service Layer, Repository, Unit of Work.
- **Freeman**: Steve Freeman, Tim Mackinnon, Nat Pryce, Joe Walnes, "Mock Roles, not Objects",
  OOPSLA 2004.
- **Garrido**: Juan Manuel Garrido de Paz, "Hexagonal Architecture", jmgarridopaz.github.io.
- **Google SWE**: Titus Winters, Tom Manshreck, Hyrum Wright (eds.), *Software Engineering at
  Google*, 2020, ch. 12–14, abseil.io.
- **Helland 2005**: Pat Helland, "Data on the Outside versus Data on the Inside", CIDR 2005.
  **Helland 2007**: Pat Helland, "Life beyond Distributed Transactions", CIDR 2007.
- **Khononov**: Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly 2021. Khononov,
  coupling.dev, where named.
- **Martin**: Robert C. Martin, "The Clean Architecture", 2012, blog.cleancoder.com.
- **MS**: Microsoft, *.NET Microservices: Architecture for Containerized .NET Applications*,
  learn.microsoft.com, the DDD and CQRS and the event-based communication chapters.
- **NServiceBus**: Particular Software documentation, "Outbox"; "Messages, events, and commands".
- **protobuf**: protobuf.dev, "Proto Best Practices".
- **Richardson**: Chris Richardson, microservices.io pattern pages.
- **Seemann**: Mark Seemann, blog.ploeh.dk: "Composition Root", "Service Locator is an
  Anti-Pattern" with its comments, "Service Locator violates encapsulation"; interview in Today
  Software Magazine, "Dependency Injection"; Mark Seemann and Steven van Deursen, *Dependency
  Injection Principles, Practices, and Patterns* (DIPPP), 2019.
- **Spring Modulith**: Spring Modulith reference documentation: Fundamentals, Events, Testing,
  Verification.
- **Vernon EAD I–III**: Vaughn Vernon, "Effective Aggregate Design", parts I–III, 2011. Vernon's
  *Implementing Domain-Driven Design* (IDDD) was not available to this pass.
- **Vocke**: Ham Vocke, "The Practical Test Pyramid", martinfowler.com, 2018.

## Retired ids

Never reused: `ARR-2`, `ARR-3`, `DOM-2`, `DRV-2`, `DRV-4`, `DVN-1`, `DVN-3`, `PRD-1` to `PRD-5`,
`SYS-4`, `SYS-6`, `TST-1`, `DRV-5`.
