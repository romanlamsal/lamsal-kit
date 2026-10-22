# Layers

Where server code goes and what it is allowed to touch.

Rules carry ids (`DRV-1`, `S-TX-1`). Another rule, an example or a review question refers to a rule
by id and does not restate it. A rule is stated once, here. Where a rule has a narrowing, the rule
points at it (`→ S-…`) and the narrowing says which rule it narrows.

Companion documents: examples in `layers-revised-examples.md`; the review checklist in
`layers-revised-review.md`; sources and departures from them in `layers-revised-provenance.md`.

## Scope

This document assumes a store that can be read and written. Where it says *transaction*, it
assumes the store can apply several writes atomically; where one cannot, S-TX-2 applies. What
counts as one store is each codebase's choice. *Table*,
*row* and *aggregate* are used in the relational sense — substitute your store's equivalents.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside these layers, and so do the roots that assemble them, a system's export
paths and the common library.

Not covered: where UI code goes (`components.md` — it applies *controller* to route files on the
client; those carry no writes, a server controller passes a write through to one service); library, framework and file-naming conventions
(the stack document); whether a module that straddles two layers should be split now.

## Terms

In `docs/layers-revamp/glossary.md`. The rules below still use the vocabulary the glossary
replaced (root, entry, build function, controller, shared kernel, "other system"); the sweep
happens when they are extracted into `docs/layers-revamp/`.

## General rules

### Arrow

**ARR-1.** The arrow runs one way — driving adapter → service → driven adapter → the outside — and
the domain sits beside all of it: every layer may import it, it imports no layer.

**ARR-2.** A driving adapter's only door to the store is a service.

**ARR-3.** A driven adapter imports no service. A use case found in a driven adapter is parked in
the wrong layer; it belongs in a service.

### Domain

**DOM-1.** The domain is pure and knows no runtime.

- *Pure:* it reaches nothing and computes from its arguments. It imports no layer of this system:
  only other domain modules, the common library's ports, a shared kernel, a conformed system's
  published language and pure libraries. The test for a package is whether calling it can reach
  outside the process: a store client, an HTTP client, a mailer SDK, `node:fs` and a clock all can,
  so they stay behind ports. A validation library cannot — it computes from its arguments and
  returns — so it is allowed, and so is any other library of the same shape.
- *No runtime:* it uses what every runtime has, the language and pure libraries. `node:*` modules
  and a runtime's globals — `Buffer`, `process`, `window`, the DOM — belong to the layers that run
  on one runtime, even where they cannot reach out of the process: `node:path` is pure, and still
  breaks in a browser. This holds through imports: a common-library module that imports
  `node:async_hooks` brings the runtime with it.

Running on any runtime is what lets a browser and another system import the domain, and importing
it loads only the domain.

**DOM-2.** A schema is a rule, not a description of one. `Invoice` — which fields exist, that an
amount is a positive integer, that a status is one of four — is the same statement as the functions
beside it, written in a form that also holds at runtime. Types are inferred from it.

**DOM-3.** A rule about a row is decided once, in the domain, and every place that builds that row
spreads it: the controller validating input and the repository mapping a row parse against the same
schema; a server write and a client-side optimistic update derive from the same domain function.
Two constructors drift, and the drift stays invisible until two parts of the system disagree about
a rule neither of them writes down.

**DOM-4.** An aggregate refers to another aggregate, and to another system's data, by id. What it
needs of the other at the time — a price, a title — it copies as its own value. A reference that
loads the other's whole record, such as a populated relationship, carries the other's model into
this aggregate.

**DOM-5.** Driven ports this system declares live in its domain. The rules declare what they need —
store this order, send this mail — and driven adapters implement it. The domain names ports only;
assembly picks their implementations. The domain names no use case: a use case is not a domain
concept, so the domain never learns the name of one.

**DOM-6.** The transaction context is opaque in the domain, so nothing there names the store or its
client.

### Service

**SVC-1.** A service is a factory. It takes its dependencies as arguments and returns its driving
port. Nothing inside it constructs anything. Its driving port lives beside it, not in the domain
(DOM-5).

**SVC-2.** A driving port takes what its use case decides by, the caller included. A question that
needs this system's state — may this caller do this — is the acting service's: it loads the data,
asks the specification, and refuses. A service that only answers, for a screen that hides a
button, is called instead of acting, never before it.

**SVC-3.** A service does not call another service of its system: the call is a second
transaction, and the outbox is the one that retries. Writes two use cases share go through the
repositories, inside one `run`; deciding they share goes in the domain.
*Allowed:* a service calling another system's driving port is calling a port, not a use case nested
in another — for a read. A write goes through TX-3 or S-TX-1, never inside `run`.

**SVC-4.** A service writes no table itself. The write belongs to the repository that owns the
table; the service hands that repository its transaction context and keeps the deciding.
*Allowed:* a service that only forwards to its repository is correct, not an unnecessary
indirection: a controller's only door is a service (ARR-2), even when the service exports the same
name again, so that deleting a repository fails inside the service that names it rather than at a
controller naming a symbol.

**SVC-5.** A service reads nothing from the per-process ambient scope; it receives its dependencies
as arguments (ASM-2, ASM-3).

### Driving adapters

**DRV-1.** A driving adapter decides nothing by this system's state. It prepares one call —
resolving the caller (a session, a signature, a key) through a port it receives, validating,
translating, putting per-request ambient values in, whatever else shapes the input — and acts
through one service. Needing two service calls is the signal that a use case has grown inside it.
A driving adapter that hands a repository a transaction and a callback has not delegated a use
case, it has inlined one: the deciding still happens in the adapter. To answer a question about
input it holds — is this valid — it calls a specification. A question that needs this system's
state is the service's (SVC-2).

**DRV-2.** Where its caller may deliver more than once — a relay, a webhook, a product's hook — the
caller may do three things. Each is a fault the adapter prevents:

- *Deliver the same thing again, however late.* Handling it a second time changes nothing.
- *Deliver out of order.* A delivery about something this system has not recorded yet is not a
  repeat.
- *Stop delivering.* A relay retries until the handler succeeds, so failing is safe there. A
  vendor's webhook stops after a few tries, and a product may not run a hook again, so a driving
  adapter for such a caller records what it was given, through its one service, before anything
  that can fail. What is lost anyway, reconciliation finds by asking the other system, where it can
  be asked.

**DRV-3.** A driving adapter receives its service from the root: as an argument where the root
constructs the adapter — a route, a server's handler, the adapters a product's build function
takes; from a courier where the framework collects the adapter and the root cannot construct it,
such as a server function. It reads the courier when it runs, not when it loads. A driving adapter
never imports assembly.

**DRV-4.** A driving adapter that receives another system's call — a webhook, a product's hook, a
message — translates it into this system's terms before it calls a service, where the relationship
is an anti-corruption layer (SYS-5).

### Driven adapters

**DVN-1.** A driven adapter implements a driven port the domain declared (DOM-5).

**DVN-2.** An adapter imports what is static and receives what is built. The domain, a schema it
validates with, port types: imported. A service — a driving adapter's own; for a driven adapter,
only another system's driving port — an adapter that resolves or translates its caller, a
product's instance: received. A product's instance is late-bound (PRD-5).

**DVN-3.** *Allowed:* a read across its system's aggregates in a driven adapter is a reporting
read, not a use case, as long as it writes nothing.

### Assembly

**ASM-1.** Assembly is not a layer. One root per entry. The root builds the adapters, calls the
factories and, for each system, the build function that system exports for the way this entry uses
it — its open host service for a server, its handler and its outbox reader for the process that
runs the relay, both where one process does both — and hands the result to its driving adapters,
or to the relay. A product is built the same way, by its build function (PRD-4). Assembly is the
only place that knows both a port and its implementation. Keep it separate from the factories: a
service module exports only its factory, and assembly holds the instances, so every dependency but
fixed plumbing (ASM-2) is one a factory declared.

**ASM-2.** Nothing builds its own dependency instead of receiving it: no concrete adapter imported
into a service file, constructed inside a service body or a factory body, or read from the
per-process registry there; no module exporting a ready-made instance next to the factory that
produces it. What this breaks is substitution: the service can no longer be given a different
implementation, so its tests need the real one.
*Allowed:* plumbing with one fixed configuration, such as a logger or a tracer, may be a ready-made
instance: nobody substitutes it.

**ASM-3.** A value may be held ambient when no use case or domain function decides by it; what a
rule decides by, the port takes.

- *Per process:* what the root built, read as a courier by the driving adapters the root cannot
  construct. The root puts it in before any adapter runs; a driving adapter reads it when it runs,
  not when it loads (DRV-3); a service reads nothing from it (SVC-5).
- *Per request:* a request id, a trace context, the locale a mail is rendered in, the user an audit
  column records. A driving adapter puts it in; services and adapters read it; the domain takes
  arguments. A value a message's handler needs goes in the message, since the handler runs in
  another request.
- The transaction context is in neither scope: what a read returns depends on it.

Which values a codebase holds ambient, it says in an ADR; what carries them is the stack
document's.

**ASM-4.** The courier is used only where the framework collects a driving adapter and the root
cannot construct it. Where it is the framework's request context, middleware the root installs
fills it per request. Which courier a codebase uses, the stack document says. A courier inside a
build function is that function's detail and gets no rule here.

**ASM-5.** The relay is common library: it belongs to no system and imports none; the root of the
process that runs it hands it the handlers and the readers. Whether it routes by message type or
hands every message to every handler, what it orders by, and what counts as taken, is each
codebase's.

**ASM-6.** The common library holds no model.

### Transactions

**TX-1.** Atomicity crosses ports through a transaction port. The service asks to run something
inside a transaction; repository methods take the context it hands back.

**TX-2.** Writes that must land together share one transaction, inside one `run`, and the
transaction stays inside its system → S-PRD-1 step 3. A repository method joins the caller's
transaction and opens nothing. A loop that calls `run` per item is one transaction per item, and a
failure halfway leaves the use case half-applied. Moving a write out of a function tends to give it
its own transaction. A function opens its own transaction instead of joining the one it was given
only where S-TX-1 or S-PRD-1 says so.
*Allowed:* a service passing its transaction context into another repository of its system, in the
same store, is the design working. That is how several tables stay one transaction.

**TX-3.** For each piece of data a use case touches, answer in order:

1. *Does it change data another system owns — a third party's included, such as a mail sent or a
   payment created?* → **Outbox, required.** Write a message to this system's outbox in the same
   transaction. An owner that handles this system's messages changes its data when the message
   arrives. A third party reads no relay: a handler of this system receives the message instead,
   and the message is the retry. → S-TX-1 where the caller needs the other system's answer.
2. *Does it read data another system owns?* → **Call the owner's open host service.** If it offers
   no fitting read, keep a copy in this system, updated by the owner's messages. In this case, the
   owner publishes.
3. *Does it write several aggregates of this system?* → **One transaction, by default.** An outbox
   is also valid here → S-TX-3.
4. *Otherwise* → one transaction.

**TX-4.** The outbox is this system's. Its port is a driven port the system declares, like a
repository (DOM-5). Where the messages live — a table of its own, a store
another transaction reaches, a field it owns on a product's record — is that system's, and so are
the adapter that writes it and the reader of it. A system writing several stores has an outbox in
each store whose transaction writes the message.

**TX-5.** An outbox, wherever it is used: *(split in general-rules.md: bullet 1 → TX-5, bullet 2 →
TX-7, bullet 3 → TX-8; bullet 4 — saga, deadline, choreography vs orchestration — is specialized,
see the extraction notes under Special cases; the example and review question 9 below belong to
TX-7)*

- A relay delivers each message after the commit, at least once, and not necessarily in order. A
  message carries what its receiver needs to tell a repeat from an early arrival (DRV-2): an id, and
  the version of the aggregate that wrote it; the receiver's aggregate records the last version it
  handled.
- A message is handled by code older or newer than the code that wrote it, so its schema stays
  backward and forward compatible: no field renamed, removed, made required or narrowed —
  including a domain schema the published language re-exports. A message written before the deploy
  is handled after it, and a handler on older code may read one written after. The type checker
  sees neither: the stored row is not in the program.
- The receiver decides which messages it handles. It handles each in its own transaction, through
  a driving adapter that calls one service (DRV-1, DRV-2).
- When a later step fails, new steps undo the earlier ones — a saga. Nothing rolls back. A step
  that waits on something that may never happen, such as a payment never made, has one system
  waiting for it: that system holds the deadline in its aggregate and acts once it passes. Whether
  the systems coordinate by choreography or orchestration is each codebase's choice; say which, in
  an ADR.

### Other systems

**SYS-1.** A system offers an open host service. Its driven ports stay inside; they are its needs,
not its offer. Export:

- the published language, for other systems to import;
- the driving port types, for other systems to import;
- a build function for the open host service, for a root or another system's build function to
  call;
- where it handles messages, a build function for its handler, for the assembly that hands it to
  the relay. Whether one function builds both the open host service and the handler, and which
  process runs the relay, is each codebase's choice;
- where it publishes messages, a build function for the reader of its outbox, for the same
  assembly;
- optionally, a fake of its driving ports, for other systems' tests, from an export path
  production does not load.

Give the published language and the port types an export path that loads only the domain, so
another system imports them without loading any service; the port types are exported type-only, or
the export path loads the service that declares them. Other systems reach a system only through
these exports, which a linter can hold from import paths alone.

**SYS-2.** The published language is the domain's own schemas, by default, messages included. A
private message is not published.
*Narrowing:* a separate language is allowed where the domain must change without breaking other
systems; record the reason in an ADR.

**SYS-3.** One system's driving port is the other's driven port. To B, `Pricing` is the way in; to
A's service it is a dependency it receives — a way out, like a mailer. What sits behind the port is
assembly's decision: B's service in-process, or an HTTP client, a driven adapter of A, implementing
the same port. Moving B out of process changes assembly and adds that adapter; no service or domain
changes.

**SYS-4.** A driving port another system calls takes its caller as an argument (SVC-2). A consumer
reaches B's service without passing B's controllers, so whatever those controllers resolve — who is
calling, on whose behalf — arrives as an argument, and B's authorization lives in its service or
domain, as it does for every caller.

**SYS-5.** How two systems relate is chosen per relationship, and the boundary matches the
relationship:

- *Conformist* — the default for an open host, a system that publishes its model on purpose. The
  other's terms, schemas and errors are used as they are, in any layer that may import a domain,
  and its driving port is a driven port a service receives like any other. *Allowed:* using a
  conformed system's terms directly is the design working, not a leak.
- *Anti-corruption layer* — for a model that is foreign, unstable or not yours, as a third-party
  API's usually is. This system's domain declares a driven port in its own terms; a driven adapter
  implements it by calling the other system's driving port and translating. On the way in, the
  driving adapter translates (DRV-4). The other system's schema and the translation live in that
  adapter, or in a module both adapters share; never in the domain. A translation that changes
  nothing is not an anti-corruption layer; conform instead. A term that crosses an anti-corruption
  layer untranslated means there is no layer.
- *Shared kernel* — model two systems share, such as `Money`, goes in a module both import and
  neither changes alone.

The other context-map patterns describe how teams cooperate; in code, each lands as one of these
three, or as no integration at all.

**SYS-6.** The consuming system's build function builds the other system, by default: A's build
function calls B's build function, and nothing else of A learns how B is built. Move that call up
into the entry's root, which builds B once and hands it to A's build function, when:

- a second consuming system would build B again, and B holds something that must exist once — a
  cache, a pool, a subscription;
- B needs systems of its own, and A would end up assembling B's upstreams;
- two systems would assemble each other — a cycle in the context map, which usually means a
  boundary is drawn wrong. A product that calls back is the exception (PRD-5).

Until one of these holds, building B inside the root is ceremony.

**SYS-7.** Between systems, consistency is eventual. Another system catching up a moment later is
the design working. Where this system's record and another's stay apart, reconciliation repairs
it. Reconciliation is a use case of the system that owns the aggregate (SYS-8); a scheduled task of
that system, or any driving adapter that finds the two apart, calls it.

**SYS-8.** An aggregate belongs to the system whose use cases write it, wherever it is stored; a
record two systems write is two aggregates sharing an id.

### Products

**PRD-1.** A product is another system, even when its tables sit in this system's database; the
rules of Other systems apply to it.

**PRD-2.** Where this system stores an aggregate in a product, the product's screens may read it; a
field this system owns is read-only there. A change comes through an action there — a button, an
endpoint — which is a driving adapter that calls this system's service.

**PRD-3.** A product's hooks and scheduled tasks are driving adapters, and the rules on driving
adapters apply to them. What a hook does is decided by S-PRD-1.

**PRD-4.** A product is built by a build function this system's product module exports, as another
system is (SYS-1, SYS-6). That function is the one place where the product learns of this system,
and the only place in this system that knows how the product is built. Where the product takes
its config from a call, the function builds it; where the framework imports the config, the
function carries what the product needs there another way, inside itself — a courier of its own is
one way — and nothing outside the function sees which.

**PRD-5.** A product that calls back is a cycle by design. Its config needs the hooks, the hooks
need services, the services need adapters over the product's instance, and the instance needs the
config. Assembly breaks it by late binding: an adapter receives a function that returns the
instance, and calls it only when it does work.

### Tests

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
adapter the framework collects reads them from a courier, which the test fills with fakes — so a
test hands it fakes and asserts what it *did*: which port it called, with what, and what it
returned. Assert observable behaviour, not the order of internal calls.

**TST-5.** Driven adapters are integration-tested by design. A driven adapter's entire job is to
talk to something external, so a unit test of one asserts a mock of the thing it exists to reach.
Unit tests pay off there only for genuinely self-contained pieces — a query builder's output, a
mapping function.

**TST-6.** Keep the fakes honest with contract tests. Write one suite per driven port, against the
port rather than any implementation, and run it twice: against the fake, and against the real
adapter. The second run is the integration test, and it is what stops a fake from drifting into a
fiction that passes while production breaks. For another system's driving port → S-TST-1.
*Allowed:* several systems each faking the same port. By default, each system writes its own fake.
One fake that the providing system exports fits only where its consumers need the same things of
it; a fake that needs configuration per consumer has outgrown that.

**TST-7.** A good test survives a rewrite of the thing it tests. It names inputs and observable
results.

## Special cases

Each narrows one general rule. Check here before inventing.

*Extraction notes for the specialized tier (decided while writing general-rules.md):*

- Shape: same labeled parts as a general rule (statement, Why, Looks like, Allowed, Provenance,
  Examples), plus a *Narrows:* part naming the general rule's id. A specialized rule narrows the
  statement of a general rule, never its other parts.
- Groups that emerged, one file each under `docs/layers-revamp/`: `unreliable-callers.md`
  (DRV-2's three faults; relay and hook), `other-systems.md` (SYS-2's narrowing: a separate
  published language, ADR; the ACL tells "a translation that changes nothing is not an ACL" and
  "a term crossing untranslated means there is no layer"; old TX-5 bullet 4: saga, the one system
  holding the deadline in its aggregate, choreography vs orchestration in an ADR; S-TX-1;
  S-TST-1), `stores.md` (S-TX-2, S-TX-3), `products.md` (PRD-1 to PRD-5, S-PRD-1, and DVN-2's
  late-binding sentence, which belongs to PRD-5). Names are proposals.
- What each narrows, by current general ids: DRV-2 → DRV-1 (and cites TX-5, ASM-5 for
  at-least-once and redelivery, which are general now); SYS-2 narrowing → SYS-2; TX-5 bullet 4 →
  TX-3 step 1; S-TX-1 → TX-3 step 1; S-TX-2 → TX-2, TX-6; S-TX-3 → TX-3 step 3; S-PRD-1 → DRV-1,
  and TX-6 in step 3.4 only (see the notes under S-PRD-1); S-TST-1 → TST-6.
- DRV-4 is absorbed by the glossary's Anti-corruption layer entry; whatever remains folds into
  the ACL entry in `other-systems.md`.
- PRD-3 is mostly the glossary's Hook and Scheduled task entries; what remains is the pointer to
  S-PRD-1.
- Retired general ids, not to be reused: DOM-2, DVN-3, SYS-4 (folded), DRV-2, DRV-4, PRD-1 to
  PRD-5 (specialized). Specialized rules get their own ids.
- Review checklist: the *Looks like* parts of general-rules.md absorbed its "in a diff" tells;
  `layers-revised-review.md` is derived from them, not extracted. Question 4 belongs to
  `components.md`.
- Open, not yet an issue: where a model two systems share lives. Shared kernel was dropped from
  the glossary; ASM-6 forbids the common library. TST-1 is a definition and a glossary candidate.

**S-TX-1 — the caller needs another system's answer** (narrows TX-3 step 1). Where the use case's
caller needs the other system's answer in its response, call the other system instead, once the
transaction has committed, and record the answer, if this system keeps it, in a transaction of its
own; the aggregate holds a pending state until the answer is recorded. Make the call safe to
repeat: the other system recognises a repeat however it can — a key it dedupes on, this system's id
stored on its side and looked up first. A driving port a system calls after its commit recognises a
repeat. Where a third party cannot, a repeat may duplicate. The pending state is the retry: a
scheduled task of this system repeats it until the answer is recorded or a deadline passes. A
duplicate is undone by a compensating call, a saga step, which reconciliation starts when it finds
one.

**S-TX-2 — a store that cannot apply several writes atomically** (narrows TX-2). The rules that
assume a transaction do not apply to it. An aggregate's outgoing messages are embedded in its own
record.

**S-TX-3 — an outbox between aggregates of one system** (narrows TX-3 step 3). An outbox is
required where no one transaction reaches them all, as for aggregates in different stores. Good
tells for choosing an outbox where one transaction would do:

- the aggregates are often written at the same time, and one transaction would block or conflict;
- the rule between them may hold a moment later.

**S-PRD-1 — what a product's hook does** (narrows DRV-1, TX-2). Answer in order:

1. *The product's caller is this system* → this system started the call, so it is not a driving
   call: the hook does nothing, and the use case that called the product handles the change. How
   the hook recognises this system as the caller is each codebase's choice.
2. *It asks*, such as whether a change is valid → a specification answers it, before or inside the
   product's transaction.
3. *It acts* → answer in order:
   1. *The product has committed the change.* The hook acts through one service.
   2. *The product's caller needs this system's work before the product answers it*, such as a
      profile for a user signing up. The hook acts now, through one service, in this system's own
      transaction, which touches no row the product's transaction holds. If the product rolls
      back, reconciliation undoes the work. Where the product offers a hook that runs after its
      commit and before it answers, step 1 applies and nothing needs undoing.
   3. *The hook runs inside the product's transaction, and a write there commits and rolls back
      with the change.* That holds when the message is embedded in the record the product is
      writing (S-TX-2), when this system's outbox is in a store the product's transaction reaches,
      or when the product has an outbox of its own. The hook calls one service and passes on what
      the product handed it: the transaction, or the record. The service writes only a message,
      through the outbox port, into that context. Nothing is lost. This is the one case where a
      transaction crosses a system boundary.
   4. *Otherwise*, the hook can write nothing that commits with the change. The hook calls one
      service. The service writes the message to this system's outbox, in this system's own
      transaction. The handler receives the message; its service first checks through the product
      that the change committed, then acts. Not yet is not a repeat (DRV-2): the handler fails, the
      relay retries, until a deadline passes.

An act after the commit is lost when the process stops before it and the product does not run the
hook again. Reconciliation repairs that, and undoes step 3.2's work when the product rolls back.

*Notes for extraction (decided while writing general-rules.md):*

- Assume a hook runs inside a transaction of the product's service. The product has layers of its
  own, out of sight; its transaction reaches this system through the hook, a driving adapter, not
  through a service.
- Step 3.3 is not an exception any more. General TX-2 no longer says a transaction stays inside
  its system (struck; it duplicated TX-3 step 1 and SYS-8). Where this system's outbox is in a
  store the product's transaction reaches, TX-2 (a driven adapter handed a transaction writes
  inside it) and TX-6 (message written in the transaction that produced the change) apply as
  written. The entry narrows nothing there; it only reminds that the service writes nothing but
  the message, since writing the product's record directly would breach TX-3 step 1.
- Step 3.4 is the narrowing: TX-6 cannot hold when no transaction of ours reaches the change.
  Options: the message rides on the product's record (S-TX-2), or this system's outbox in its
  own transaction with reconciliation covering the gap (SYS-7).
- Say plainly that the message tells of the product's change, not this system's. In the
  sources' terms this is closer to an inbox than an outbox; do not let it read as publishing on
  the product's behalf.
- Being able to join the product's transaction at all is an accident of where its tables sit,
  not a design goal. The question the entry answers is how to treat a hook's transaction, not
  whether to share one.
- Provenance: Vernon (ch. 2, ch. 13) and Evans (bounded context, shared kernel) keep a context's
  schema inside its boundary and cross-boundary updates asynchronous; Khononov (ch. 9), Vernon
  (ch. 8) and Richardson put the outbox row in the producer's store, in the producer's
  transaction. The departure is PRD-1's shared store; a shared transaction is the same departure,
  not a second one.

**S-TST-1 — a contract suite for another system's driving port** (narrows TST-6). The receiving
system writes the suite, whether the fake is its own or one the other system exports, and runs it
the second time against that system's open host service. That run is the integration test where
the open host service reaches a real dependency.
