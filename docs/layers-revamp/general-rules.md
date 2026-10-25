# General rules

Rules whose Scope is any system. Terms are the glossary's; the rule shape is the README's. A rule
with `—` under Examples is unfinished. Provenance names sources by the short names under Sources
at the end.

## Assumptions

This document assumes a store that can be read and written, that can apply several writes
atomically where it says *transaction*, and that can make a write fail where the record has
changed since it was read. It assumes no isolation between transactions beyond reading committed
writes: a transaction may read what another commits while it runs.

Every system gets the same architecture: domain, service, repositories and adapters, a simple one
too. That is this document's choice. The sources pick the architecture per subdomain and let
simple logic read and write the store directly; here no system is judged simple enough, and none
is rewritten when it grows rules.

Not everything gets a layer. Assembly, a system's export paths and the common library sit outside
the layers. So does code of a process that reports on the process rather than on a system, like
`/health` and `/metrics`.

Tooling sits outside the layers and the rules. It builds systems through their builders or
replaces their internals: an in-memory outbox, a CLI as relay and bus. What it reaches past an
export path is no offer (SYS-1), and a system changes it without notice.

Not covered: where UI code goes, which is `components.md`; library, framework and file-naming
conventions, which are the stack document's; whether a module that straddles two layers should be
split now; whether a downstream conforms to an upstream or builds an anti-corruption layer, which
a repository's ADRs decide; how a driving adapter is tested, and when the integration suite runs,
which are the repository's.

## Domain

**DOM-1**
*Scope:* a domain module imports a module.
*Statement:* The import MUST be one of: another domain module, a shared kernel, the published
language of an upstream this system conforms to, a library that computes from its arguments.
*Relies on:*
- SYS-10: loading a path that exports a system's published language loads no module of that
  system outside its published language.
*Why:* The domain is pure and knows no runtime (glossary). The test for a module is two
questions: does calling it reach outside the process, and does it exist on every runtime? A store
client, an HTTP client, a mailer SDK, `node:fs` and a clock reach outside, so they stay behind
ports. A validation library takes arguments and returns, so it passes, and so does any library
like it. `node:path` reaches nowhere outside the process and still breaks in a browser; `Buffer`,
`process`, `window` and the DOM are one runtime's. A domain that imports any of these loads on
one runtime, and whoever imports it elsewhere, a browser rendering a form from the schema, another
system's domain, gets a load error or the server's store client along with the model. The common
library is not on the list: its ambient registry would hand the domain a value no caller passed.
The list is closed: an import of a kind it does not name is a question for this rule, not a
permission.
*Provenance:* The direction follows Khononov p. 77 (the model "devoid of any infrastructural or
technological concerns"), MS ("the domain model layer must not directly depend on any infrastructure
framework"), Evans Reference p. 10 and Garrido §3 ("Hexagon depends on nothing, maybe just on
utilities"). The shared kernel follows Evans p. 251 and Khononov p. 51. The list, and the test of
reaching outside the process and existing on every runtime, are this document's. Departs: Martin
(The Dependency Rule) has data formats of an outer circle kept out of an inner one, against the
conformist's import. Against: Khononov p. 70 couples active records to the ORM, for simple
subdomains; this document picks one architecture for every system (Assumptions).
*Examples:* —

**DOM-3**
*Scope:* a rule about the shape of a record: which fields it has, what each holds, which values a
status takes.
*Statement:* It MUST be stated once, as a schema in the domain.
*Relies on:* —
*Why:* A schema says what the functions beside it say, in a form that also checks at runtime, and
the type is inferred from it. Stated a second time, as a type declared beside the schema, a
validator in a driving adapter, a second constructor in a client-side optimistic update, the two
drift, and the drift stays invisible until two parts of the system disagree about a rule neither
writes down. Everything that builds the record parses against the one schema or derives from the
one domain function, and a changed field lands as a compile error in every builder at once. The
published language's schemas shape what crosses to other systems, not records, so they fall
outside the Scope: a driving adapter parsing with the published language and the domain checking
its own rule are two statements by design, a second statement inside the domain is not.
*Provenance:* Stating a rule once follows Evans p. 160 (without a specification "the same rule may
show up in different guises"), Khononov p. 80 (validation resides in the value objects) and MS
(Two-step validation: "you do not duplicate the validation definition"). That the statement is a
schema is this document's. Departs: MS recommends field-level validation on command DTOs and in
ViewModels beside the domain's own (Two-step validation; validators in the MediatR pipeline); at
the published language's edge this document does the same (SYS-2).
*Examples:* —

**DOM-4**
*Scope:* an aggregate needs something of another aggregate of the same system.
*Statement:* It MUST hold it as the other's id, or as a snapshot.
*Relies on:* —
*Why:* A repository loads and saves its aggregate whole (glossary: Aggregate). An aggregate that
holds the other's whole record has its repository load that record along with it and save it
back: a stale copy, written over whatever another use case changed in the other meanwhile, by a
repository whose aggregate does not own it. The id loads nothing of the other. The snapshot is
this aggregate's fact from then on: the price the order was placed at stays after the product's
price changes.
*Provenance:* The id follows Vernon EAD II p. 8 ("Prefer references to external aggregates only by
their globally unique identity"), Khononov p. 90 and p. 175, MS (only the foreign key, "a good
practice") and Helland 2007 p. 139 (entities knit together by their keys). The snapshot follows
Evans p. 97 (the item "holds its own price") and Helland 2005 §5.2. The MUST is this document's
strengthening of Vernon's "prefer". Against: Evans p. 91–92 and Reference p. 16 let objects hold
references to other aggregates' roots, as does Fowler (DDD_Aggregate). Vernon calls his rule a
rule of thumb (EAD III p. 15) and breaks it for query performance (EAD II p. 11, EAD III p. 15).
*Examples:* —

## Service

**SVC-1**
*Scope:* a system declares a port, driving or driven.
*Statement:* It MUST be declared in the service layer.
*Relies on:*
- SYS-10: loading a path that exports a system's open host service's driving port types loads no
  module of the system outside its published language.
*Why:* A use case is not a domain concept: the rules say what an invoice is, not that there is a
"create invoice" call. A driving port in the domain hands every importer of the domain, a browser,
another system, the names of this system's use cases, and the domain then changes whenever a use
case is added. A driven port is called by services; the domain is pure and calls none. One home
for both lets the import lists of each layer be checked by path, and makes the services that call
a port and the adapters that implement it its importers, and nothing else. A conformist declares
no port for its upstream: it uses the upstream's driving port types (glossary: Conformist).
*Provenance:* Use cases outside the domain follow Fowler (Service Layer: it "defines an
application's boundary and its set of available operations"), Khononov p. 122, Evans p. 53 (the
application layer "defines the jobs the software is supposed to do") and MS (commands in the
application layer). Driven ports with the application follow Martin (Crossing boundaries: the
output port in the use-case circle), Garrido §2.3 ("ports belong to the application") and Freeman
§2.1 (the object that needs a role declares it). Departs, for repositories: Khononov p. 127–128
(the business logic layer defines the ports), MS (repository interfaces in the domain model
layer) and Evans p. 88. A driving port names one use case (glossary): Cockburn (How Many Ports?)
and Garrido §2.3 group several in one port, while Cockburn finds no "particular damage in
choosing the 'wrong' number of ports", and MS has one handler per command.
*Examples:* —

**SVC-6**
*Scope:* a module of the service layer imports a module.
*Statement:* The import MUST be one of: its system's domain, a shared kernel, a port declared in
its service layer, its system's published language, the common library, the export path of an
upstream its system conforms to, a library that computes from its arguments.
*Relies on:*
- ASM-2: a factory receives port implementations, store clients and other clients of something
  outside the process from its caller.
- SYS-1: an upstream's export path holds its published language, its open host service's driving
  port types, system builders and fakes of those ports, and nothing else.
*Why:* A service that knows the route that calls it, or the store client that saves for it,
changes whenever either changes, and a second way in, or a second store, means rewriting the use
case. It reaches driven adapters through the ports they implement, handed in, so a swapped adapter
leaves it untouched. The published language is on the list because the service translates both
ways between it and the domain. A store client's type in a port's signature is the store's name in
the service, one step removed. With the list, the system is replaced from the outside in, a new
driving adapter, a swapped driven adapter, with service and domain untouched.
*Provenance:* The direction follows Cockburn (Intent: the application is "blissfully ignorant" of
the adapters on every side), Martin (The Dependency Rule: source code dependencies point inward;
Crossing boundaries: the use case calls an interface the adapter implements), Garrido §6.2.1 and
Khononov p. 126 (the business logic layer depends on none of the infrastructural components).
Translating at the application level follows MS (integration events "defined at the application
level") and Khononov p. 55 ("the supplier implements the translation of its internal model"). The
list is this document's. Against: Khononov p. 124 and p. 134, MS (simple CRUD microservices in a
single layer) and Evans p. 57 pick the architecture per subdomain; this document picks one
(Assumptions).
*Examples:* —

**SVC-2**
*Scope:* a use case decides by what this system has stored: whether this caller is allowed,
whether the stock suffices, whether the order is still open.
*Statement:* The service that acts MUST enforce the decision itself, in the call that acts.
*Relies on:*
- TX-1: a use case that writes runs in one transaction its service opens, hands to each call into
  its store, reads included, and commits.
- TX-2: a driven adapter handed a transaction makes each call into its store inside it, reads
  included.
- TX-23: a repository's save of an aggregate loaded through it fails where the aggregate has
  changed in the store since the load.
- TX-24: by default, the data a decision has to hold by when the use case commits belongs to
  aggregates the use case saves.
- DRV-8: a driving adapter reaches its system through driving ports, importing no driven port,
  driven adapter or service of it.
- SYS-1: a system exports no service, driven port or adapter to other code.
*Why:* A driving port does not know how it is reached, so a check made in a driving adapter
protects one way in; another adapter, or a downstream calling the port directly, bypasses it. The
service sees every call. A check made before the acting call, by another call, is stale by the
time the act runs: what it read changes between the two. So the acting service loads the data in
the transaction that writes, asks the domain's specification, which decides, and refuses where it
says no; where what it loaded changes before the commit, its save fails and the act with it.
*Provenance:* Follows Khononov p. 85 (the aggregate's public interface validates the input and
enforces all business rules, "in one place") and Cockburn (Motivation: business logic infiltrating
the user interface). The stale check is CWE-367's (Time-of-check Time-of-use: "the resource's
state can change between the check and the use in a way that invalidates the results of the
check").
*Examples:* —

**SVC-3**
*Scope:* a service of a system needs what another service of the same system does.
*Statement:* It MUST NOT call that service.
*Relies on:*
- TX-1: a use case that writes runs in one transaction its own service opens and commits.
- ASM-9: a transaction is no ambient value.
*Why:* A service called from another opens a transaction of its own, a second one, with no rollback
of its own: the outer one fails and the inner one's writes stay. If two use cases need the same
writes, both call the same repositories inside their own transaction, and the domain decides what
the writes are. If one use case follows another, a message in the outbox carries it. A call to an
upstream's driving port goes through a driven port of this system (glossary: Port), not a nested
use case.
*Provenance:* The premise follows Khononov p. 86 n. 7 (the application layer "has to orchestrate the
operation as an atomic transaction") and Helland 2007 p. 138 (a method call does not record the
intent and retry; a message across a transaction boundary does). No source rules on one service
calling another. MS has domain-event handlers in the application layer run inside the command
handler's transaction, one piece of application code driving another (Domain events), and its
IdentifiedCommand handler re-dispatches the command it wraps.
*Examples:* —

**SVC-4**
*Scope:* a use case writes a record.
*Statement:* The write MUST go through the repository of the aggregate the record belongs to.
*Relies on:*
- TX-2: a driven adapter that writes to a store writes inside the transaction it is handed.
- DRV-8: a driving adapter imports a driving port of its system, and no repository.
- TST-4: by default, a service's test hands it fakes for its driven ports.
*Why:* A repository saves its aggregate whole (glossary: Aggregate). A write from the service
itself, an insert or update with a store client, lands beside the aggregate's writes with nothing
that keeps them whole, and puts the store's name into the service. The service keeps the
deciding, the repository the saving. A service that does nothing but call its repository is that
split working, not an extra layer: a driving adapter calls a service, and when the repository is
deleted the compile error lands in the service that named it, not in a driving adapter. A
repository with one real adapter has a second, the fake the service's tests use.
*Provenance:* Follows Evans p. 109 and Reference p. 17 ("delegating all object storage and access to
the repositories"), MS ("the only channel you should use to update the database should be the
repositories") and Khononov p. 86. Against: Fowler (Repository) ties the pattern to a complex domain
model or heavy querying; MS ("Repositories shouldn't be mandatory", "use the Repository pattern or
not, as you see fit"; the DbContext injected directly "for simpler implementations"); Khononov p. 64
(a transaction script "is also free to access the databases directly"). This document picks one
architecture for every system (Assumptions).
*Examples:* —

## Driving adapters

**DRV-8**
*Scope:* a driving adapter imports a module.
*Statement:* The import MUST be one of: the framework that calls it, a driving port of its
system, its system's domain, a shared kernel, its system's published language, the common
library, a library that computes from its arguments.
*Relies on:*
- ASM-2: a factory receives a port's implementation from its caller.
- DRV-3: a driving adapter assembly cannot construct reads what it calls from a courier.
*Why:* A driving adapter that skips the service and reaches a driven adapter, a repository or the
store reads state and decides by it, or writes outside any use case and outside the transaction a
service holds, and the rules in the domain are bypassed for that one way in. Typed by the driving
port, the adapter calls whichever service assembly handed it, a fake in a test. The published
language is what it parses its caller's input with where the caller is another system.
*Provenance:* The conversion at the edge is Cockburn's adapter (Intent) and Garrido's (§2.4,
"the driver adapter has a configurable dependency on the driver port", §3). The list is this
document's.
*Examples:* —

**DRV-1**
*Scope:* a driving adapter handles one call from its caller: a request, a message, a tick.
*Statement:* It MUST make at most one acting call.
*Relies on:*
- SVC-2: the service that acts enforces a decision by stored state itself, in the call that acts.
- TX-1: a use case that writes runs in one transaction its service opens and commits.
*Why:* A driving adapter that makes two acting calls has a use case growing inside it: which
second call to make, and what to do when the first succeeded and the second fails, are a use
case's decisions, and here they sit in one way in, without a transaction, repeated or missing in
the next way in. A loop over acting calls is the same use case, written in the adapter. Preparing
the call is the adapter's job: validating and translating the input, putting per-request ambient
values in, asking a specification about the input it holds, working out who the caller is. Where
that last one takes this system's stored state, a session, an API key checked against a record,
it is a question to a service that answers, and the answer becomes an argument of the acting
call. An answering service asked for an argument the act takes, who this session belongs to,
decides nothing. One asked whether to act is a guard on one way in: it refuses earlier and lets
nothing through that the acting service would refuse. A bus that delivers several messages at
once gets one call per message; a use case over a batch complies, one acting call in one
transaction.
*Provenance:* The conversion is Cockburn's adapter (Intent) and Garrido's (§2.4). The duplication in
the Why follows Khononov p. 124 and Fowler (Service Layer). Departs: Khononov p. 122 and p. 124 make
moving the orchestration into a service layer an option ("can"; "a service layer is not always
necessary"); Evans p. 77 gives digesting the request to the application service. One acting call is
this document's. A batch in one transaction is Dahan's, in Vernon EAD II p. 10.
*Examples:* —

**DRV-3**
*Scope:* a driving adapter assembly cannot construct: the framework finds and calls it.
*Statement:* It MUST read what it calls from a courier.
*Relies on:*
- ASM-8: assembly fills the courier before any driving adapter reads it.
*Why:* An adapter the framework finds and calls, a server function, has no caller to hand it
anything. Importing the service's module instead gets a factory, not an instance; importing
assembly runs assembly at module load and lets the adapter pick its own instance. Either way a
second place exists where port and implementation meet, and the test has no way to hand the
adapter a fake. The courier keeps assembly the one place. Where the framework offers a factory
seam, assembly constructs the adapter and hands it what it calls. A hook in a framework's static
config that forwards to an adapter assembly built reads that adapter from the courier.
*Provenance:* Follows Seemann ("Service Locator is an Anti-Pattern", comment of 2010-02-04): each
framework-created object pulls from the container the framework's application object holds,
having "no recourse" otherwise; his first choice is the framework's factory seam ("Composition
Root": a custom IControllerFactory), where the composition root constructs the adapter. Departs:
Cockburn (Sample Code, Stage 3) has the driving adapter construct the application itself.
*Examples:* —

**DRV-6**
*Scope:* a driving adapter reads from a courier.
*Statement:* It MUST read when it runs, not when its module loads.
*Relies on:* —
*Why:* The module loads when the framework discovers it, before or while assembly runs, so a read
at load time finds the courier empty, or holds the first instance for the life of the process. A
test that fills the courier with fakes changes nothing the adapter already holds.
*Provenance:* Seemann ("Service Locator is an Anti-Pattern", comment of 2010-02-04) has the read
happen "inside the constructor or Initialize method of each and every object" the framework creates,
per object, not once at load.
*Examples:* —

**DRV-7**
*Scope:* a handler is delivered a message.
*Statement:* It MUST NOT acknowledge it unless the use case it calls has succeeded.
*Relies on:*
- TX-21: the bus delivers a message again until the handler acknowledges it.
- TX-1: a use case that writes runs in one transaction its service opens and commits.
*Why:* An acknowledged message is gone. A queue client that acknowledges on receipt, or a handler
that catches the use case's error and returns, loses the message the moment the use case fails,
and the change it tells of does not reach this system. A use case that writes nothing succeeds
when it returns; one that writes succeeds when it has committed.
*Provenance:* Follows Vernon EAD II p. 9 ("The modification can be retried if the subscriber does
not acknowledge success"), Helland 2007 p. 134, EIP (Transactional Client) and MS (RabbitMQ
requeues the unacknowledged). Khononov, Evans and Cockburn do not rule on it.
*Examples:* —

## Driven adapters

**DVN-4**
*Scope:* a driven adapter imports a module.
*Statement:* The import MUST be one of: a client of something outside the process, the port it
implements, its system's domain, a shared kernel, the common library, the export path of an
upstream, a library that computes from its arguments.
*Relies on:*
- SYS-1: everything a system exports is its published language, its open host service's driving
  port types, a system builder or a fake of its open host service's driving ports.
*Why:* A driven adapter exists to talk to the outside on the system's behalf. One that calls a
service has a use case inside it, in the layer meant to do nothing but talk to the outside; one
that imports another adapter or a service of its system is tied to how that one is built.
In-process, the adapter for an upstream calls the upstream's open host service and is typed by
its export path.
*Provenance:* That an adapter depends on the inside follows Garrido §6.2.1 ("adapters depend on
hexagon") and Martin (The Dependency Rule). Evans p. 55 has the infrastructure layer below the
domain, knowing nothing of it: the 2003 layering hexagonal replaces. The list is this document's.
*Examples:* —

## Assembly

**ASM-1**
*Scope:* a process.
*Statement:* It MUST have one assembly.
*Relies on:* —
*Why:* Two assemblies in one process are two places where a port meets its implementation, and two
instances of what exists once: two store clients, two relays. Which system builders the one
assembly calls follows from how the process is driven: a server's assembly calls the open host
service builders, a worker's the handler and outbox reader builders, a process doing both calls
both.
*Provenance:* Follows Seemann ("Composition Root": "a (preferably) unique location"; in a comment of
2011-08-02, "Each application/process requires only a single Composition Root"), Seemann's
interview, Garrido §6.2.1 (one module for starting up) and MS (Program.cs). Departs: for objects a
framework creates, Seemann accepts "a set of distributed Composition Roots" (comment of
2010-02-06), and warns that "the earlier you compose, the more you limit your options" (comment
of 2011-08-02). A system builder takes its choices as configuration from assembly, so composing a
system before assembly sees it costs no option.
*Examples:* —

**ASM-2**
*Scope:* a factory needs a port's implementation, a store client, any other client of something
outside the process, or a configuration value.
*Statement:* It MUST receive it from its caller.
*Relies on:*
- ASM-1: a process has one assembly.
*Why:* A dependency built in place breaks substitution: a service that builds its own adapter is
stuck with it, so its tests need the real thing, and a second instance of what exists once
appears. A system builder is a factory for its system, and its upstreams are dependencies like any
other: in-process, assembly hands the downstream the upstream's service itself; out of process, a
driven adapter of the downstream, an HTTP client. Moving the upstream out of process then changes
assembly and adds that adapter, and nothing in the downstream's services or domain; each instance
exists once, the graph is visible in one place, and a test hands the builder a fake upstream.
Built in place, this breach is invisible to the other rules: the code sits in the right layer and
calls in the right direction. A module that exports a ready-made instance beside its factory is
the breach one step removed: the importer receives nothing, it imports the built thing.
*Provenance:* Follows Garrido §3 (Configurable Dependency: "a dependency of an object on an
interface", passed to the constructor at runtime) and §2.5 (the composition root sets up the
adapters), Cockburn (secondary actor adapters swapped, the application "without actually knowing
the nature of the things on the other side of the adapters", adapters including "any code needed
for communication between applications across the enterprise or net") and MS (infrastructure
objects injected). Seemann ("Composition Root"; Control Freak among the anti-patterns, DIPPP ch. 5),
Fowler (Inversion of Control: instantiating directly "stops the finder from being a plugin") and
Freeman §4.9 support. Evans p. 249 (the Routing Service's interface insulates the Booking context)
and Khononov p. 148 (the saga's `IPublishingServiceClient`) show an upstream behind the
downstream's interface, as examples. The configuration value is this document's: no DDD or
hexagonal source names it. Departs: Khononov p. 128 binds ports by injection or bootstrapping;
Google SWE ch. 13 (Seams) finds dependency injection "less important" in JavaScript, where
functions are replaced dynamically; Seemann accepts a parameterless constructor with defaults
beside the injecting one, for a library (comment of 2014-09-13). Against: Evans p. 78, p. 108 and
Reference p. 17 (singleton and global access); Fowler (Inversion of Control Containers, Concluding
Thoughts) gives Service Locator "a slight edge" for application classes.
*Examples:* —

**ASM-10**
*Scope:* a factory needs something the same in every instance, process and test: a domain
function, a schema, a constant.
*Statement:* It SHOULD import it.
*Relies on:*
- ASM-2: a factory receives a port's implementation, a client of something outside the process
  and a configuration value from its caller.
*Why:* A parameter nobody varies sits among the real dependencies and hides which of them a test has
to supply. Nothing a test swaps falls under this rule, so it leaves ASM-2 alone. Handed in anyway,
nothing breaks; the signature says less.
*Provenance:* Follows Garrido §3 (a configurable dependency is a dependency on an interface), Google
SWE ch. 13 ("A real implementation is preferred if it is fast, deterministic, and has simple
dependencies") and Seemann, "Volatile Dependencies" (2006: stable dependencies need no isolation;
"To distinguish them from stable dependencies, I suggest the term volatile dependencies").
*Examples:* —

**ASM-7**
*Scope:* plumbing of the common library whose output changes nothing the system does or returns:
a logger, a tracer.
*Statement:* It MAY be imported as a ready-made instance.
*Relies on:*
- ASM-2: a factory receives each client of something outside the process from its caller.
*Why:* Telemetry reaches outside the process, a logger to its transport, a tracer to its
exporter. The line is behavior, not substitution: a meter falls under this rule, a feature-flag
client, whose answer changes what the system does, does not. Telemetry is substituted without a
parameter: OpenTelemetry's JS API reads a global tracer provider, and a test inspecting spans
registers an in-memory exporter there. Missing from the signature, telemetry hides nothing a
caller has to supply; handed through every factory, it adds a parameter to every signature for
nothing the system's behavior depends on.
*Provenance:* Supports: the OpenTelemetry JS API ("Acquire a tracer from the global tracer
provider"; its methods "can be safely called by a library or end-user application whether there
is an SDK registered or not"); Khononov p. 56 has a logging framework as a library each bounded
context uses. Against: Seemann lists Ambient Context, with logging as its example, among the DI
anti-patterns (DIPPP ch. 5, contents), finds it "best avoided" (interview), and prefers
decorators or interception for logging (comment of 2012-05-11 on "Service Locator is an
Anti-Pattern"), tolerating an ambient logger as "way better than a Service Locator". His remedies
are object-oriented; the harm he names, a dependency hidden from the caller, is what the Why
answers.
*Examples:* —

**ASM-3**
*Scope:* a service, or a driven adapter a service calls, reads an ambient value, in either scope.
*Statement:* The value MUST NOT change how the use case acts or what it answers.
*Relies on:* —
*Why:* An ambient value is in no signature. A use case that acts by one, the current user for a
permission, the tenant a repository filters by, depends on something no caller knows to supply:
the second driving adapter forgets it, the test does not set it, the handler runs outside the
request where it was set, and the result changes without a trace. A driven adapter's read is
the same harm: the repository that filters by an ambient tenant answers differently by who
happened to call. What the use case acts by arrives through its driving port. That reaches what
gets recorded too: the locale a mail is rendered in and the user an audit column records arrive
as arguments, since the handler that renders the mail runs outside the request. A value the
handler needs from the request that wrote the message reaches it in the message, or by a query
the message points to, or not at all. Telemetry, which changes neither, stays ambient.
*Provenance:* A use case receiving what it acts by follows Seemann ("Service Locator violates
encapsulation"); his interview ("Ambient Context is also best avoided") goes wider, against ambient
dependencies altogether. The message carrying what the handler needs follows Khononov p. 91 (a
domain event provides "all the necessary data"), Evans Reference p. 13 and Helland 2005 §1.6;
Khononov p. 236 keeps event notifications lean, the subscriber asking the producer for the rest.
The line between telemetry and everything else is this document's.
*Examples:* —

**ASM-4**
*Scope:* code reads the courier.
*Statement:* It MUST be a driving adapter assembly cannot construct.
*Relies on:*
- ASM-1: a process has one assembly.
*Why:* Read anywhere else, the courier is a service locator: whoever reads it gets a dependency
without anyone handing it over, so the graph of who depends on what leaves assembly, the one
place it is visible. A factory that reads it has a dependency it did not receive; code that is no
factory, a service function, passes every other rule, since the courier lives in the common
library its layer may import. The one code with no caller to hand it anything is a driving
adapter the framework constructs.
*Provenance:* Follows Seemann ("Service Locator is an Anti-Pattern", comments of 2010-02-04): the
framework-created object reaches the container, and "from there on down, there will be no Service
Locator available"; everything else gets an injected abstract factory. Seemann holds that a
limited, well-known context "isn't service location" (comment of 2015-10-07): the read this rule
allows. Against: Fowler (Service Locator vs Dependency Injection) lets any application class
depend on the locator; Evans Reference p. 17 gives every repository client global access.
*Examples:* —

**ASM-8**
*Scope:* the courier.
*Statement:* Assembly MUST fill it before any driving adapter reads it.
*Relies on:*
- DRV-6: a driving adapter reads the courier when it runs, not when its module loads.
- ASM-4: what reads the courier is a driving adapter assembly cannot construct.
- ASM-1: a process has one assembly.
*Why:* A reader gets what is there when it runs. Filled late, the first requests find it empty;
filled by anything but assembly, a second place produces instances. A per-process courier is
filled at startup; a per-request one, the framework's request context, by middleware assembly
installs. A system builder filling it is assembly filling it. Which courier a codebase uses is the
stack document's.
*Provenance:* Composing before any driving adapter runs follows Garrido §2.5 (the start-up component
builds the system, then runs the driver adapter). The courier and its filling are this document's.
*Examples:* —

**ASM-9**
*Scope:* a transaction.
*Statement:* It MUST NOT be an ambient value.
*Relies on:*
- TX-25: a driving port takes no transaction.
*Why:* What a read returns depends on the transaction it runs in: a repository reading an ambient
transaction returns different data depending on what the caller happened to open. A transaction
opened on purpose changes nothing of how the use case acts, and still travels where nobody passed
it. Node's `AsyncLocalStorage` store "is accessible to any asynchronous operations created within
the callback": shop's ambient transaction becomes billing's on an in-process call to billing's
open host service, one transaction spanning two systems. Handed as an argument, the transaction
is visible in every signature it crosses, stops where the call into another system takes none,
and a write that got none does not compile.
*Provenance:* The harm follows Richardson (Database per service: "A service's transactions only
involve its database") and Helland 2007 ("Atomic Transactions Cannot Span Entities"); the
mechanism is Node.js (Asynchronous context tracking). The combination is this document's. Against,
in practice: MS shares the unit of work through the request-scoped DbContext (Domain events,
single transaction across aggregates).
*Examples:* —

**ASM-5**
*Scope:* a common-library module imports a module.
*Statement:* It MUST NOT be a system's module.
*Relies on:*
- ASM-2: a factory receives a port's implementation from its caller.
*Why:* The common library is plumbing every system imports. One that imports a system knows it,
and a new system means a change to the library: a relay that imports a system knows its outbox
readers, a bus that imports a system knows its handlers. They implement the library's ports and
arrive from the assembly of the process that runs the relay and the bus. A library module that
imports a system's schema puts a model in the common library.
*Provenance:* MS shares only "final application blocks, like the Event Bus client API". Otherwise
no source states it. Departs: Khononov p. 150 has the outbox relay execute commands on their
targets, so his relay knows the systems it calls.
*Examples:* —

**ASM-6**
*Scope:* the common library.
*Statement:* It MUST hold no model: no schema, no aggregate, no rule of any system.
*Relies on:* —
*Why:* The common library is plumbing every system imports. A model in it is one every system
shares: a change made for one system's reason reaches all of them, and no system's rules decide
it, because a system's rules are in its domain.
*Provenance:* Follows MS (Integration events: share only "final application blocks, like the Event
Bus client API", and no common domain model) and Evans p. 244 ("Code reuse between BOUNDED CONTEXTS
is a hazard to be avoided"). A model systems agree to share is a shared kernel (Evans p. 251,
Khononov p. 51–52, "a pragmatic exception"), not the common library. Departs: Martin's entities may
serve many applications.
*Examples:* —

## Transactions

**TX-1**
*Scope:* a use case writes.
*Statement:* Its service MUST run it in one transaction: open it, hand it to each call into its
store, commit it.
*Relies on:*
- TX-2: a driven adapter writes to its store inside the transaction it is handed.
- DRV-1: a driving adapter makes at most one acting call per call it handles, a message included.
*Why:* A repository saves one aggregate whole and knows nothing of the others. The service sees the
whole use case, so it is the one that knows which writes land together; a repository that opened the
transaction would be deciding that for writes it does not see. One acting use case is one
transaction, several aggregates included: the order placed and the cart cleared land or fail
together. An answering use case holds none. Every call into the store takes the transaction, the
reads too, and the record of a handled
message commits with the writes it guards. A store is what one transaction commits, so a use case
that writes writes one store; a write to a second store goes to a handler through the outbox. The
transaction is a required parameter: a forgotten one is a type error. Opening it through the common
library's transaction port keeps the store's name out of the service and the client's type out of
the domain. A handler calls one use case per message, so each message gets a transaction of its own,
apart from the one that wrote it.
*Provenance:* The service holding the transaction follows Fowler (Service Layer: "controlling
transactions"), Evans p. 111 ("Leave transaction control to the client"), Khononov p. 86 n. 7 and
p. 123, Vernon EAD I p. 3 (the transactional application service) and MS (the command handler
commits). One transaction per message follows Vernon EAD II p. 9 ("Each of the subscribers
executes in a separate transaction"), NServiceBus (Outbox) and Richardson (Idempotent consumer);
Dahan's batch in one transaction (Vernon EAD II p. 10) complies, one use case over the batch.
Handing the transaction to each call is this document's, by ASM-9: MS and Fowler's Unit of Work
share one unit of work through scope. Against several aggregates in one transaction: Vernon EAD I
p. 4 ("modifies only one aggregate instance per transaction in all cases", "a rule of thumb"),
Khononov p. 87 and p. 93, Evans Reference p. 16, Fowler (DDD_Aggregate: "Transactions should not
cross aggregate boundaries") and Helland 2007 p. 135. For: MS calls it "the simplest approach" and
"valid in many business cases", and Vernon EAD II p. 10 breaks his rule where one user's
aggregates see no "transactional collisions".
*Examples:* —

**TX-2**
*Scope:* a driven adapter is handed a transaction.
*Statement:* Each call it makes into its store MUST run inside that transaction.
*Relies on:*
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
*Why:* A write outside it, through the global client or a transaction the adapter opens itself,
commits on its own: a failure between the writes leaves the use case half done, and the
transaction's rollback leaves this write in place. A read outside it sees none of the use case's
writes so far, so the service decides by a state its own transaction has already changed, and it
reads past whatever the transaction holds against others: a row lock the transaction took, an
isolation level stricter than the default. The type checker cannot see this: a method that takes
the transaction and calls through the global client compiles. The breach hides in small edits: a
loop with one write per iteration on the client, not the transaction; a lookup moved into a helper
that reaches for the client. Repositories, the outbox and the record of handled messages alike.
*Provenance:* Follows Evans p. 111 (the repository "will ordinarily not commit anything"). Reads
inside the transaction are this document's.
*Examples:* —

**TX-23**
*Scope:* a repository saves an aggregate that was loaded through it.
*Statement:* The save MUST fail where the aggregate has changed in the store since it was loaded.
*Relies on:*
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
- TX-2: a driven adapter handed a transaction makes each call into its store inside it.
- SVC-4: a use case's write of a record goes through the repository of the aggregate it belongs to.
*Why:* One transaction does not stop another from changing what it read before it commits. At
Postgres's default isolation, READ COMMITTED, shop's payment and its deadline arrive together:
marking the order paid loads it open, cancelling it loads it open, each saves, and both commit.
The order ends in whichever state saved last, `OrderPaid` and `OrderCancelled` are both out, and
fulfillment ships an order it released. The later save wrote over the earlier one by a decision
whose state no longer held. A save that fails tells the second use case so, and its transaction
rolls back with nothing of it committed. A version the aggregate carries, compared on save, is
one way; a lock taken at the load and held to the commit, under which the aggregate cannot
change, is another.
*Provenance:* Follows Khononov p. 86–87 (the concurrency check: the later transaction must not be
"blindly overwriting the changes committed by the first one"; a version compared on save; "it's
crucial to ensure that the database used for storing an aggregate's data supports concurrency
management") and Vernon EAD I p. 2 (a version number "checked before they are saved to the
database"; the stale copy's updates "are rejected"). Evans p. 94 locks the whole purchase order
instead, which the Statement admits too.
*Examples:* —

**TX-24**
*Scope:* a use case decides by what this system has stored, and the decision has to hold when the
use case commits: the stock suffices, the order is still open.
*Statement:* The data it decides by SHOULD belong to aggregates the use case saves.
*Relies on:*
- TX-23: a repository's save of an aggregate loaded through it fails where the aggregate has
  changed in the store since the load.
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
*Why:* The aggregates a use case saves fail on a change. Data in one it reads and does not save
changes before the commit and nothing fails: two reservations both read a stock of 1 from
`Stock`, each saves a `Reservation` of its own, and both commit. Held in the aggregate the use
case saves, the stock with its reservations in `Stock`, the second save fails. Where the decision
cannot sit in the aggregates one use case saves, it is a rule across aggregates, which holds
after a delay: a later use case, a reconciliation, a compensating step repairs it. A deviation's
ADR names what holds the data still instead: a lock on what the decision read, an isolation level
under which the second commit fails.
*Provenance:* Follows Evans p. 91 (invariants within an aggregate "enforced with the completion of
each transaction"; "Any rule that spans AGGREGATES will not be expected to be always up to date")
and p. 97 (the line item holds its own price, the purchase order's invariant kept inside it),
Evans Reference p. 16 ("Within an aggregate boundary, apply consistency rules synchronously"),
Vernon EAD I p. 3 ("Model True Invariants In Consistency Boundaries": an invariant "is a business
rule that must always be consistent", transactionally) and Khononov p. 87 (the aggregate as the
transactional boundary). Departs: Vernon EAD I p. 4 has one aggregate per transaction; under
TX-1's several, the data may span the aggregates one use case saves. Evans p. 94–95 locks the
purchase order and the parts it prices before modeling the lock away (p. 96–97).
*Examples:* —

**TX-25**
*Scope:* a system declares a driving port.
*Statement:* It MUST NOT take a transaction.
*Relies on:*
- TX-1: a use case that writes runs in one transaction its own service opens and commits.
*Why:* A writing use case opens its own transaction, so one handed in is a second, or takes the
place of the one its service opens. An answering use case writes nothing and needs none; a port
that takes one "to read consistently" is where the caller's slips in. The caller of an open host
service's port is another system: its transaction handed in runs the upstream's reads in the
downstream's, one transaction across two systems' data, the upstream's store bound to whatever
the downstream opened, and a port that stops working once the upstream runs in its own process.
*Provenance:* Follows Richardson (Database per service: "A service's transactions only involve
its database") and Helland 2007 ("Atomic Transactions Cannot Span Entities"). The rule on the
port is this document's.
*Examples:* —

**TX-15**
*Scope:* a use case writes more aggregates of this system than it relies on.
*Statement:* It SHOULD leave each write it does not rely on to a handler, through a message in its
outbox.
*Relies on:*
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
- TX-6: a message about a change commits in the transaction that commits the change.
- TX-20: the relay hands each message it reads from an outbox to the bus at least once.
- TX-21: the bus delivers a message to a handler again until the handler acknowledges it.
- DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
- TX-5: a repeated delivery changes nothing.
*Why:* A use case relies on a write when its goal (glossary: Use case) is not reached without it:
checkout relies on the order and the emptied cart, not on a statistic. A write it does not rely on
holds its lock until the commit, and its failure aborts the rest; moved to a handler, it is retried
alone. Left in the one transaction, nothing ends up wrong: the cost is locks and retries.
*Provenance:* Follows Vernon EAD II p. 9 (eventual consistency outside the boundary; Evans's test,
whose job the consistency is, which this document reads as "relies on") and MS ("Optionally, for
better scalability and less impact in database locks, use eventual consistency between
aggregates"). Departs: Vernon, Khononov p. 147, Evans Reference p. 16 and Helland 2007 p. 137 make
eventual consistency the default beyond one aggregate; this rule follows them except where the
use case relies on more (TX-1).
*Examples:* —

**TX-3**
*Scope:* a use case of this system changes data another system of this codebase holds.
*Statement:* It MUST do so by writing a message to this system's outbox.
*Relies on:*
- TX-6: a message about a change commits in the transaction that commits the change.
- TX-20: the relay hands each message it reads from an outbox to the bus at least once.
- TX-21: the bus delivers a message to a handler again until the handler acknowledges it.
- DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
- TX-5: a repeated delivery changes nothing.
*Why:* The owner's rules decide its data (glossary: Aggregate), so a change to it is the owner's use
case, and this system at most asks for it. Changing it directly, writing the owner's record or
calling the owner inside this transaction, puts a write this system's rules do not decide into this
system's transaction, and the owner's model into this service. Calling the owner after the commit
does not help: a crash between the commit and the call, or a failed call, loses the change, and
nobody retries. Written to the outbox in the same transaction, the message is exactly as committed
as the change it tells of; the owner's handler acts on it, and redelivery retries it until it lands.
*Provenance:* Asynchrony across systems follows Evans Reference p. 16 ("Across boundaries, handle
updates asynchronously", said of aggregates, so of systems a fortiori), MS (integration events
"must be based on asynchronous communication"), Richardson (Database per service: transactions
that span services by saga; Saga: a service "must atomically update its database and publish a
message/event") and Helland 2005 §1.3 (only the owner's logic changes its data). The lost call
after commit follows Khononov p. 144–145 ("Can we trust this code? No.") and Richardson
(Transactional outbox: "no guarantee that it won't crash before sending the message"). Against:
EIP (Command Message) and Richardson (Messaging) give remote procedure invocation as the usual
alternative. Departs: Khononov's simple saga calls the other context directly (p. 148).
*Examples:* —

**TX-22**
*Scope:* a use case of this system changes something outside its store that no system of this
codebase holds: a mail sent, a shipment booked with an external system.
*Statement:* The change MUST go through this system's outbox, on behalf of its holder.
*Relies on:*
- TX-6: a message about a change commits in the transaction that commits the change.
- TX-20: the relay hands each message it reads from an outbox to the bus at least once.
- TX-21: the bus delivers a message to a handler again until the handler acknowledges it.
- DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
- TX-5: a repeated delivery changes nothing.
*Why:* The holder reads no bus, so this system acts for it. The use case that decides the change
writes a message instead of making it; this system's handler handles that message on the holder's
behalf, and the use case it calls makes the change and writes to no store of this system. The
decision commits with the message and the call is apart from it, so a retry repeats the call and
decides nothing again. A use case that marks the reservation and books the 3PL in one attempt
decides again on redelivery, the order cancelled meanwhile, while the booking stands. The call's use
case reaches idempotence through the holder's idempotency key, the message id; a record of handled
ids cannot help, being outside any transaction the call is in. The holder's answer comes back as its
own message or its hook. A request designed as a tentative operation changes nothing (glossary) and
falls outside the Scope: the way around a holder that has no asynchronous answer. An event from
another system that leads to a mail takes two hops: this system's use case decides, and its message
drives the mail.
*Provenance:* Follows Khononov p. 148, p. 149–150 (the handler executes the command; "the command
execution logic should be moved out of the saga itself") and p. 293 (the outbox: "it can be used
for sending email messages"). Departs: Khononov p. 150 has the relay execute the commands, which
the glossary's relay does not (glossary: Relay). Against: EIP (Command Message) and Richardson
(Messaging), the synchronous call. Evans p. 55 and Cockburn do not rule on the timing.
*Examples:* —

**TX-6**
*Scope:* a use case writes a message about a change it makes.
*Statement:* It MUST write the message in the transaction that commits the change.
*Relies on:*
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
- TX-2: a driven adapter writes to its store inside the transaction it is handed.
*Why:* Written before the commit and outside the transaction, the message survives a rollback of the
change and tells of something that did not happen. Written after the commit, the process dies
between the two and the change commits with no message, so nothing downstream ever learns of it. In
the same transaction, the two are as committed as each other. Where the messages live is left to the
system: a table of its own, a field it owns on the record it changes; they are reachable from the
transaction that produced the change, and a transaction is one store's (glossary: Store), so a
system whose use cases write to several stores has an outbox in each.
*Provenance:* Follows Richardson (Transactional outbox), Khononov p. 144–145, Helland 2007 p. 137
("transactional enqueuing of messages is de rigueur"), NServiceBus (Outbox) and MS. The outbox as
a property of the record follows Richardson (Transactional outbox, for NoSQL) and Khononov p. 146.
Departs: EIP (Event Message) finds guaranteed delivery "usually not very helpful with events".
*Examples:* —

**TX-20**
*Scope:* the relay reads a message from an outbox.
*Statement:* It MUST hand it to the bus at least once.
*Relies on:*
- TX-5: a repeated delivery changes nothing.
*Why:* A relay that marks the message before the bus has it loses it when the process dies between
the two, and the change it tells of reaches nobody. Marked after, a crash hands it over again: a
repeat, which the receiving use case absorbs, instead of a loss, which nothing can.
*Provenance:* Follows Khononov p. 145 (the relay marks messages "upon successful publishing") and
p. 147 (the outbox "guarantees delivery of the messages at least once"), Richardson (Transactional
outbox) and NServiceBus (Outbox).
*Examples:* —

**TX-21**
*Scope:* the bus delivers a message to a handler.
*Statement:* It MUST deliver it again until the handler acknowledges it.
*Relies on:*
- DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
- TX-5: a repeated delivery changes nothing.
*Why:* A handler fails, a process dies mid-message, a store is briefly down. Delivered once, the
message is lost with the attempt; delivered again, the attempt that fails is retried.
*Provenance:* Follows EIP (Guaranteed Delivery; Transactional Client) and Vernon EAD II p. 9 ("The
modification can be retried if the subscriber does not acknowledge success").
*Examples:* —

**TX-5**
*Scope:* a use case is called for a delivered message.
*Statement:* It MUST be idempotent.
*Relies on:*
- TX-1: a use case that writes runs in one transaction, which its service hands to each call into
  its store and commits.
- TX-2: a driven adapter writes to its store inside the transaction it is handed.
*Why:* Delivery repeats: a handler that failed after acting is delivered the message again, a relay
that crashed after handing a message over hands it over again, and a redelivery can run while the
first attempt still does. A use case that acts on every delivery reserves the stock twice and
sends the mail twice. Two means reach idempotence: recording the ids of handled messages in the
transaction that acts on them, where a second record of the same id fails, or a change whose
repeat is no change, a status set rather than toggled.
*Provenance:* By id, follows Richardson (Idempotent consumer: "a consumer must be idempotent", by
recording the ids of processed messages), NServiceBus (Outbox: deduplication by MessageId), Helland
2007 p. 140 and Khononov p. 245. By what the message says, follows EIP (Idempotent Receiver),
Helland 2007 p. 139 and MS, which prefers idempotent handling to deduplication. Departs:
NServiceBus deduplicates within a retention window.
*Examples:* —

**TX-19**
*Scope:* a use case is called for a delivered message.
*Statement:* It MUST reach the same result whatever order the messages arrive in.
*Relies on:* —
*Why:* Messages overtake each other: fulfillment's `OrderCancelled` arrives before the `OrderPlaced`
it cancels. A use case that reads "not found" as "already handled" drops the cancel, and the
reservation made a moment later stays for a dead order; "not found" is not "already handled".
Messages that override each other, two price updates, need something to order them by, which the
publisher puts on them. Between two publishers, which message wins is the domain's decision.
*Provenance:* Follows Khononov p. 245 ("Events will arrive out of order"; the publisher's version to
order by), Helland 2007 p. 138 and MS (an older price event overwriting a newer one).
*Examples:* —

**TX-7**
*Scope:* the schema of a message changes, or a new message takes over from another.
*Statement:* The change MUST keep messages old code writes readable by new code, and messages new
code writes readable by old code, each field keeping its meaning.
*Relies on:* —
*Why:* A message is handled by code older or newer than the code that wrote it. One written before a
deploy sits in the outbox and is handled after it; one deployment does not clear the outbox. A
handler still on old code, in a process not yet restarted, reads one written by new code. The type
checker sees none of this: the stored message is not in the program, so a renamed field compiles and
fails at runtime, on a message nobody re-sends. An optional field added or removed keeps both
directions; a field renamed, a required one added or removed, a type changed, an enum value added or
removed, a meaning changed, an amount from cents to euros, breaks one. A change that cannot keep
both goes through versions: new code writes the old message and the new while old readers run, and
reads the old until none waits.
*Provenance:* Follows protobuf (Dos and Don'ts: "Clients and servers are never updated at exactly
the same time"), Confluent (full compatibility lets producers and consumers upgrade independently;
an incompatible change as a new topic) and Khononov p. 55 ("only possible if the modified
implementation model can be translated into the published language the consumers are already
using"; "simultaneously expose multiple versions") and p. 243 ("if an event's schema changes, the
subscribers' projection logic will fail"). Departs: Confluent defaults to one direction plus an
upgrade order; Helland 2005 §3.4 goes further, every change a new version.
*Examples:* —

**TX-17**
*Scope:* a system publishes an event.
*Statement:* Its code MUST NOT name a system that handles it.
*Relies on:* —
*Why:* The writer does not know its readers: it publishes, and which systems handle the event is
each receiver's decision, made by subscribing its handler (glossary: Bus). A publisher that names
its handlers changes whenever a system starts or stops listening, and imports what it names, so the
dependency runs from upstream to downstream, against the one the published language establishes.
*Provenance:* Follows EIP (Publish-Subscribe Channel), Richardson (Messaging), NServiceBus (Events),
MS (the publisher does not need "to know the subscribers") and Khononov p. 233.
*Examples:* —

**TX-12**
*Scope:* a use case of this system reads data another system owns.
*Statement:* It MUST read it from the owner's open host service or from its published messages.
*Relies on:*
- SYS-2: the modules that declare a published language import nothing of the domain.
*Why:* The owner's open host service and its published messages are what it offers on purpose, in
its published language. Reading its store directly, a join across both systems' tables, a query
against its records, binds this system to the owner's storage: the owner's schema change breaks this
system's query with no compile error, and the owner's rules, which decide what a record means, are
bypassed. In-process the open host service is a function call behind a driven port; going through it
costs a port, not a network hop. A replica is filled from the owner's published messages, so
reading it reads them. The replica lags by a moment. Where
the components can settle for that, the published messages are the rule of thumb: the read then
needs the owner neither running nor fast.
*Provenance:* Follows Richardson (Database per service: data "accessible only via its API"; API
Composition; CQRS), Helland 2005 §1.3 and §6.5 (no access to the data "unless it is mediated by
the application logic of the service") and §4.1 (versioned reference data, "somewhat out of
date"), Evans p. 114, Fowler (What do you mean by "Event-Driven"?, Event-Carried State Transfer),
Khononov p. 238 and MS (integration events "for bringing domain state in sync"). The rule of thumb
is Khononov p. 246 ("If the components can settle for eventually consistent data, use the
event-carried state transfer message"); Fowler finds it "usually easier just to call the sender".
Departs: Richardson weighs a shared database as a pattern with drawbacks (Shared database);
Khononov p. 209 allows one during a strangler migration; Evans p. 263 has an open host service pay
off only with many integrations; MS counts a synchronous call to another service against its
autonomy.
*Examples:* —

## Other systems

**SYS-1**
*Scope:* a system exports a path for other code to import.
*Statement:* Everything it exports MUST be one of: its published language, its open host service's
driving port types, a system builder, a fake of its open host service's driving ports.
*Relies on:* —
*Why:* Driven ports, services and adapters are what a system needs, not what it offers; a downstream
that imports one couples to the inside, and the system changes its adapters by changing its
downstreams. A driving port that none but this system's own driving adapters reach is no offer
either, and a downstream faking it fakes a shape nobody offers. The offer is what downstream systems
need to talk to it, the published language and the open host service's port types, and what assembly
needs to build it, the builders. In-process, a downstream's driven adapter, or a conformist's driven
port, is typed by the upstream's driving port type, so the port types serve production as well as
tests. A fake of the open host service is part of the offer for tests and lives on a path production
does not load.
*Provenance:* An offer apart from the internals follows Evans p. 263 (a protocol opened to "all who
need to integrate"), Khononov p. 55 (the supplier decouples the implementation model from the
public interface), Garrido §2.3 ("Ports are interfaces that the application offers to the outside
world") and Cockburn (an application "deployed in headless mode, so only the API is available, and
other programs can make use of its functionality"). The owner's fake follows Google SWE ch. 13
(TST-11). What the export paths hold, builders and fakes included, is this document's. Departs: MS
advises against a shared library of integration events.
*Examples:* —

**SYS-9**
*Scope:* code outside a system imports from it.
*Statement:* It MUST import from one of that system's export paths.
*Relies on:*
- SYS-1: everything an export path exports is the system's published language, its open host
  service's driving port types, a system builder or a fake of those ports.
*Why:* A deep import past an export path reaches a service, a driven port or an adapter, the
inside, and holds whatever file layout it found there, so the system's change is tied to its
importer's. Assembly is outside every system too: it reaches a system through its builders, not its
adapters. A linter holds this boundary from import paths alone, so the breach shows in the diff and
costs nothing to find.
*Provenance:* Follows Khononov p. 41 ("Each bounded context should be implemented as an individual
service/project, meaning it is implemented, evolved, and versioned independently") and intrusive
coupling (coupling.dev, Integration strength). The linter is this document's.
*Examples:* —

**SYS-10**
*Scope:* a path exports a system's published language or its open host service's driving port
types.
*Statement:* Loading it MUST load no module of the system outside its published language.
*Relies on:*
- SVC-1: a system's ports are declared in its service layer.
- SYS-2: the modules that declare the published language import no domain.
*Why:* A downstream, or a browser, imports the published language for the schemas. A path that
also loads a service, because the port types sit beside it and were exported as values, pulls the
service's dependencies along: a store client in a browser bundle, a second system's whole graph in
a test that wanted one type. Exported as types, the port types vanish at compile time and the path
loads the published language alone. Builders and fakes are on other paths.
*Provenance:* Follows Garrido §6.2.1 ("If the programming language doesn't allow the hexagon to
expose just the ports", "split the hexagon into ports and implementation", where the "ports would
depend on nothing"). TypeScript's type-only exports are the mechanism.
*Examples:* —

**SYS-2**
*Scope:* a system declares its published language.
*Statement:* The modules that declare it MUST NOT import the domain.
*Relies on:*
- TX-7: a changed message schema keeps messages old code writes readable by new code and the
  reverse, each field keeping its meaning.
- SVC-6: a service module's allowed imports include its system's domain and its published language.
*Why:* A published language that re-exports the domain's schemas, picks from them, extends them or
re-uses a domain enum is the domain: every refactoring of the model is a change to the contract, and
the contract then keeps both directions readable for changes nobody made to it. Kept apart, the
domain refactors without touching the contract; where a domain change does meet the contract, the
translation between the two fails to compile, and the contract changes on its own terms.
The shapes may match at first; they are still two. Any of these needs the import, so a linter holds
the rule.
*Provenance:* Follows Evans p. 278 ("Therefore, do not equate the interchange language and the model
of the host"; "Keeping them close together will reduce translation overhead", the shapes matching
at first), p. 264 (a model used as the interchange "essentially becomes frozen and cannot respond to
new development needs") and Reference p. 36; Khononov p. 55, p. 140 ("a common mistake to design
and expose a published language for the model's objects"), p. 229 ("it can expose less data and in
a more convenient model for consumers") and p. 244; MS (domain and integration events: "their
implementation must be different"). Departs: Khononov p. 207 makes it conditional when
retrofitting ("If changes in the implementation details of one component often ripple … consider
making it an open-host service").
*Examples:* —

## Tests

**TST-3**
*Scope:* a domain rule is tested.
*Statement:* The test SHOULD call the domain function directly.
*Relies on:*
- DOM-1: a domain module imports nothing but other domain modules, a shared kernel, the published
  language of an upstream its system conforms to and libraries that compute from their arguments.
*Why:* The domain is pure: the test needs no fixture, no fake and no setup, and fails for one
reason. Tested through a service, the same rule needs fakes for every port the service takes, and a
failure is the service's, the fake's or the rule's. Most of what is worth asserting lives in the
domain, so this is where most tests are.
*Provenance:* Follows Freeman §4.5, Fowler (Mocks Aren't Stubs), Vocke ("Push your tests as far down
the test pyramid as you can"), Google SWE ch. 12, Khononov p. 165 (for domain models), Evans p. 44
and p. 175, and MS. Departs: Google SWE ch. 12 tests a helper of one or two classes through them;
Khononov p. 165 moves to integration tests for active records, where this document picks one
architecture for every system (Assumptions).
*Examples:* —

**TST-10**
*Scope:* a test of a domain function reaches another domain module.
*Statement:* It SHOULD NOT replace it with a double.
*Relies on:*
- DOM-1: a domain module imports nothing but other domain modules, a shared kernel, the published
  language of an upstream its system conforms to and libraries that compute from their arguments.
*Why:* The domain is pure, so the real module is fast and deterministic. A double of a pure
function restates what the function returns, and the two drift: the test passes against the
double's answer while the real function's has changed.
*Provenance:* Follows Google SWE ch. 13 ("our first choice for tests is to use the real
implementations"; "A real implementation is preferred if it is fast, deterministic, and has simple
dependencies"), Khononov p. 165 ("Aggregates and value objects make perfect units for effectively
testing the business logic") and Fowler (Mocks Aren't Stubs, the classical style).
*Examples:* —

**TST-4**
*Scope:* a service is tested.
*Statement:* The test SHOULD hand it fakes for its driven ports.
*Relies on:*
- ASM-2: a factory receives each port's implementation from its caller.
- TST-5: a driven adapter's test talks to what the adapter talks to, not a double of it.
*Why:* The default suite runs on every save and before every commit, and it is run that often
because it is fast enough that nobody thinks about running it. One real database in it makes it
slow and makes it need an environment; from then on it is run less, and failures are found later.
With fakes, the test tests what the service decided; whether the database works is the
adapter's test. A port with one real implementation is not premature: the fake is the second. A
test that proves the transaction itself, that a use case's writes land together or the message with
the change, needs the real store.
*Provenance:* Follows Cockburn (Nature of the Solution: the in-memory adapter "most importantly";
"The functional specification … is made against the inner hexagon's interface"; the application
"can be configured to run decoupled … using an in-memory oracle, or mock, database replacement; or
it can run against the test- or run-time database"), Garrido §2.4 (two adapters per driven port),
Evans p. 111 and MS (many fast unit tests, fewer against the database). Departs: Fowler
(UnitTest: doubles for external resources a "useful guideline", not "an absolute rule"); Google
SWE ch. 13 (the real implementation until it becomes too slow).
*Examples:* —

**TST-5**
*Scope:* a driven adapter is tested.
*Statement:* The test MUST NOT replace what the adapter talks to with a double.
*Relies on:* —
*Why:* A driven adapter's whole job is to talk to something outside. A test of one against a
double of that thing passes when the double agrees with the adapter's idea of it, which is exactly
what is in doubt. Whether the test is then an integration test or an end-to-end test follows from
where the real thing runs (glossary).
*Provenance:* Follows Vocke (Integration Tests: "you need to run a database"), Google SWE ch. 13,
Pryce as reported by Garrido §6.1.1 (integration tests for adapters) and Bogard, quoted in MS.
Departs, for adapters over an external system: Fowler (IntegrationTest: narrow integration tests
against doubles and contract tests, "without ever running tests against a real instance"), Vocke
(a fake server) and Google SWE ch. 14 ("it is not recommended to have automated tests use a real
third-party API").
*Examples:* —

**TST-6**
*Scope:* a driven port has a fake and a real adapter.
*Statement:* One contract suite MUST be written against the port and run against both.
*Relies on:*
- TST-4: a service's test hands it fakes for its driven ports.
*Why:* The service tests stand on the fake; the run against the fake is what stops it from
drifting into a fiction that passes while production breaks. The run against the fake is in the
default suite, the run against the real adapter outside it. Two suites, one per implementation,
drift the same way the fake does.
*Provenance:* Follows Google SWE ch. 13 ("A fake must have its own tests"), Vocke and Fowler
(IntegrationTest, ContractTest). Departs: Google SWE ch. 13 names contract tests against both as
"one approach"; Fowler runs contract tests on the external service's rhythm, outside the regular
pipeline and not breaking the build; Google SWE ch. 14 keeps doubles faithful by recorded traffic.
*Examples:* —

**TST-8**
*Scope:* a suite runs against the fake or against the real adapter.
*Statement:* The choice MUST be a flag, not an edit.
*Relies on:*
- TST-6: one contract suite is written against the port and run against the fake and the real
  adapter.
*Why:* The real run is what you reach for when a failure makes you doubt the fake. If reaching for
it means editing imports, it is not reached for, and the fake drifts unnoticed.
*Provenance:* Follows Google SWE ch. 14 (record/replay: running the real mode easy), Cockburn
(Structure: in-memory or real database by configuration) and Vocke (a profile selects the real
database). Mechanisms, not rulings.
*Examples:* —

**TST-12**
*Scope:* an end-to-end test.
*Statement:* It SHOULD NOT run automatically.
*Relies on:* —
*Why:* An end-to-end test reaches a service that runs elsewhere, on its owner's terms: it is slow,
it fails when the service is down or rate-limits, and a failure in it is as often the service's as
the code's. Run on every change, it breaks builds nobody can fix; run on purpose, its failure is
read as what it is.
*Provenance:* Follows Google SWE ch. 14 ("it is not recommended to have automated tests use a real
third-party API"). Departs: Fowler (ContractTest: "Often running just once a day is plenty"),
automated outside the regular pipeline, not breaking the build.
*Examples:* —

**TST-11**
*Scope:* two downstreams fake the same driving port of an upstream's open host service.
*Statement:* They SHOULD use one fake of it, exported by the upstream.
*Relies on:*
- TST-6: one contract suite is written against the port and run against the fake and the real
  adapter.
- SYS-1: an export path may hold a fake of its open host service's driving ports.
*Why:* A fake is a working implementation (glossary), so one port has one fake, and what each
downstream needs of it is scenario data, not a second implementation. Two downstream fakes of one
port are two ideas of the upstream's behavior, each passing its own tests, each drifting on its
own; the upstream's fake passes the upstream's contract suite once, and is exported on its own
path.
*Provenance:* Follows Google SWE ch. 13 ("the team that owns the real implementation should write
and maintain a fake"), departing on timing: here from the second downstream, not only once a
fake is needed at all; ch. 14 (a caller's own double is the unfaithful-double risk). Fowler (Mocks
Aren't Stubs: "Fake objects actually have working implementations"). Departs: Vocke
(consumer-driven contracts: each consumer states what it uses); Google SWE ch. 13 allows writing
your own fake where the owners will not.
*Examples:* —

**TST-7**
*Scope:* a test asserts.
*Statement:* It SHOULD assert on inputs and observable results: which port was called with what,
what came back, what was stored.
*Relies on:* —
*Why:* A test that survives a rewrite of the thing it tests is one that names what goes in and
what comes out. One that asserts the order of internal calls, or that a private helper ran, breaks
on every refactoring and passes on a behavior change that kept the call order, so it stops being
run or stops being believed.
*Provenance:* Follows Vocke ("Test for observable behaviour instead"), Google SWE ch. 12 and ch. 13
(test state, not interactions), Fowler (Mocks Aren't Stubs), Freeman §6.2 and Evans p. 179.
Departs: Google SWE ch. 13 ranks which port was called with what below state, and for
state-changing calls only.
*Examples:* —

## Sources

Books by printed page; web pages and papers by section heading.

- **Cockburn**: Alistair Cockburn, "Hexagonal Architecture", 2005, alistair.cockburn.us.
- **Confluent**: Confluent documentation, "Schema Evolution and Compatibility for Schema Registry".
- **CWE-367**: MITRE, CWE-367, "Time-of-check Time-of-use (TOCTOU) Race Condition",
  cwe.mitre.org.
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
- **Node.js**: Node.js documentation, "Asynchronous context tracking" (`node:async_hooks`,
  `AsyncLocalStorage`).
- **NServiceBus**: Particular Software documentation, "Outbox"; "Messages, events, and commands".
- **OpenTelemetry JS API**: the `@opentelemetry/api` package README, github.com/open-telemetry.
- **protobuf**: protobuf.dev, "Proto Best Practices".
- **Richardson**: Chris Richardson, microservices.io pattern pages, among them Database per
  service, Shared database, Transactional outbox, Idempotent consumer, Saga, Messaging, API
  Composition, CQRS.
- **Seemann**: Mark Seemann, blog.ploeh.dk: "Composition Root", "Service Locator is an
  Anti-Pattern" with its comments, "Service Locator violates encapsulation"; "Volatile
  Dependencies", 2006, his former MSDN blog; interview in Today Software Magazine, "Dependency
  Injection"; Mark Seemann and Steven van Deursen, *Dependency Injection Principles, Practices, and
  Patterns* (DIPPP), 2019.
- **Vernon EAD I–III**: Vaughn Vernon, "Effective Aggregate Design", parts I–III, 2011. Vernon's
  *Implementing Domain-Driven Design* (IDDD) was not available.
- **Vocke**: Ham Vocke, "The Practical Test Pyramid", martinfowler.com, 2018.

## Retired ids

Never reused: `ARR-1`, `ARR-2`, `ARR-3`, `DOM-2`, `DOM-5`, `DOM-6`, `DRV-2`, `DRV-4`, `DRV-5`,
`DVN-1`, `DVN-2`, `DVN-3`, `PRD-1` to `PRD-5`, `SVC-5`, `SYS-3`, `SYS-4`, `SYS-5`, `SYS-6`,
`SYS-7`, `SYS-8`, `SYS-11`, `TST-1`, `TST-2`, `TST-9`, `TX-4`, `TX-8`, `TX-10`, `TX-11`, `TX-13`,
`TX-14`, `TX-16`, `TX-18`.
