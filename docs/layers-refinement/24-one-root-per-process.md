# One root per process; a product is built by a build function; a courier, an outbox and the relay are terms

**Status:** ready

**Kind:** contradiction (review 03, R03-04), unmarked choices (R03-02, R03-19, R03-20, R03-21),
three missing tells (R03-06, R02-11), and three terms the text used without defining (*courier*,
*outbox*, *relay*; *entry* and *root* in passing, R02-29) · **Touches:** Terms (common library,
new entries), The layers (service example comment), Ports and factories (Assembly, "imports what
is static", "receives its service from the root", the ambient paragraph), Other systems (export
list, *entry* in the module sense), Products (new build-function bullet), the checklist
(questions 5 and 7), Tests (the fakes sentence), When to leave it alone (the port-call bullet,
"exported entries"), `domain.md` (placed-as list), the layer table (both adapter rows, via the
skill), `tanstack-start.md` (one pointer) · **Related:** `review-03.md` subgroup B (B1–B5, Q13's
registry part, Q18, Q21), R03-03 (its "the outbox" clause falls away here); `20-root-per-entry.md`
(root per entry stands; its entry list is superseded); `21-service-registry.md` (its "two roots"
consequence is superseded); `23-hook-defers-through-the-outbox.md` (the reader over a product's
record is now a system's export); `review-02.md` R02-16, R02-29; review 03's Q11 ("a store's own
schema is not a second constructor") grounds what a product's build function may declare from the
domain and should land with or before this ticket. Apply after 22 and 23.

Grilled and decided on 2026-10-21; the `## Decision` section is the ruling and the Resolution is
the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Ticket 20 made assembly one root per entry and listed three entries: "a server's start, a relay
worker, a product's config". Ticket 21's sweep added "One process may load two entries, such as
a server and a product's config: each keeps its root, and what both need is built once, put in
the registry by one root and read, not imported, by the other, as the reasons to escalate (Other
systems) decide; which root builds it is each codebase's choice." Four readers tripped on it
(R03-04): the escalation clause dangles; a product-config root constructs its hooks when the
config loads, so its registry read is a load-time read against "reads it when it runs, not when
it loads"; and the ambient paragraph names only driving adapters as readers.

Review 03 drafted the fix as a sentence about two roots. The grilling found the premise wrong.
Assembly happens where a deployable starts: a server, a job, a relay worker. That root is the
outer one by default, and it builds every system the process runs, each through the build
function that system exports (Other systems). A product is another system (Products), so it is
built the same way: by a build function this system's product module exports, which the root
calls with what the product needs of this system. How the function gets that into the product is
its own business. A product that takes its config from a call gets a config built for it; a
product whose config the framework imports, as Payload's is, gets it another way inside the
function, a per-process courier the config's hook slots read when a hook runs being one. Nothing
outside the function sees which. There is one root in the process, and nothing is "built once by
one root for the other".

Along the way the text's undefined words came up. *Courier* appears once, explained inline, in
a sentence that has the root fill a request context "once" (R03-02). The common library is said
to hold "the outbox port and its relay", but a port is what a system's rules declare they need,
in that system's terms, and ticket 23 made where a system's messages live store-dependent: its
own table, a store the product's transaction reaches, a field on a product's record. The outbox
port is each system's driven port; only the relay is common. The relay's inputs — every system's
handlers and the readers of every system's outbox — are handed to it by the root of whichever
process runs it, since common library imports no system. The export list has the handler builder
and not the reader builder. And the paragraphs around all this carry choices the books do not
make, credited to no one or to Fowler (R03-19, R03-20, R03-21), and three rules no checklist
question catches (R03-06, R02-11).

## Problem

The two-entries sentence rules a case that does not exist under the document's definition of
assembly, and in doing so has a root read the registry, which no other sentence allows. A fresh
agent placed "which root builds shop" at confidence 3 twice (review 02 P, review 03 P). The
sentence has to go, and the definition that makes it go — an entry is where a deployable starts,
a product is built by a build function — has to be in the text, since the product's config is
listed today as an entry and "a product's hook" as an adapter the entry's code constructs.

A reader of "the outbox port … from the common library" in the service example builds one outbox
mechanism for every system and has no place for a system whose messages sit in a product's
record. A reader of the export list hands the relay nothing to read with.

## Resolution

### 1. Terms, common library

Before: "A *common library* is plumbing every system may import: the transaction port, store
clients, a logger, a tracer, the outbox port and its relay, the ambient registry. It holds no
model."

After: "A *common library* is plumbing every system may import: the transaction port, store
clients, a logger, a tracer, the relay, the ambient registry. It holds no model."

### 2. Terms, three new entries, after the *handler* paragraph

> An *outbox* is where a system's outgoing messages wait, written in the transaction that
> produced them. The outbox port is a driven port the system declares, like a repository; where
> the messages live — a table of its own, a store another transaction reaches, a field it owns
> on a product's record — is that system's, and so are the adapter that writes it and the reader
> of it.
>
> The *relay* reads every system's outbox, through the reader that system exports, and delivers
> each message to the handlers until it is taken. It is common library: it belongs to no system
> and imports none; the root of the process that runs it hands it the handlers and the readers.
> Whether it routes by message type or hands every message to every handler, what it orders by,
> and what counts as taken, is each codebase's.
>
> A *courier* carries what the root built to a driving adapter the root cannot construct because
> the framework collects it, such as a server function: the per-process registry (Ports and
> factories), or the framework's request context, which middleware the root installs fills per
> request. Which, the stack document says. A courier inside a build function is that function's
> detail and gets no rule here.

### 3. The layers, service example

Before: `outbox: Outbox                 // driven port, from the common library`

After: `outbox: Outbox                 // driven port, from the domain`

### 4. Ports and factories, Assembly paragraph (R03-04, R02-29)

Before:

> **Assembly is not a layer.** Each entry — a server's start, a relay worker, a product's config —
> has one root that builds what that entry runs: it builds the adapters, calls the factories and
> the build functions systems export, and hands the result to its driving adapters. One process
> may load two entries, such as a server and a product's config: each keeps its root, and what
> both need is built once, put in the registry by one root and read, not imported, by the other,
> as the reasons to escalate (Other systems) decide; which root builds it is each codebase's
> choice. Assembly is the only place that knows both a port and its implementation.

After:

> **Assembly is not a layer.** An *entry* is where a deployable starts — a server, a job, a relay
> worker — and it has one *root*, which builds what that entry runs: it builds the adapters,
> calls the factories and, for each system, the build function that system exports for the way
> this entry uses it — its open host service for a server, its handler and its outbox reader for
> the process that runs the relay, both where one process does both (Other systems) — and hands
> the result to its driving adapters, or to the relay. A product is built the same way, by its
> build function (Products). Where the framework collects a driving adapter and the root cannot
> construct it, the root fills a courier (Terms) instead; that is the courier's only case.
> Assembly is the only place that knows both a port and its implementation.

The rest of the paragraph ("Keep it separate from the factories: …") is unchanged.

### 5. Ports and factories, "imports what is static" (R03-20)

Before:

> **An adapter imports what is static and receives what is built.** The domain, a schema it
> validates with, port types: imported. A service, an adapter — its own, or one that resolves or
> translates its caller — a product's instance: received.

After:

> **An adapter imports what is static and receives what is built.** The domain, a schema it
> validates with, port types: imported. A service — a driving adapter's own; for a driven adapter,
> only another system's driving port — an adapter that resolves or translates its caller, a
> product's instance: received. That adapters are received is Khononov's (p. 128) and Cockburn's;
> the split is this document's.

### 6. Ports and factories, "receives its service from the root" (R03-02, R03-19, R03-21)

Before:

> **A driving adapter receives its service from the root.** As an argument where the entry's code
> constructs the adapter — a route, a product's hook; where the framework collects it, such as a
> server function, from a courier the root fills once — the ambient registry (below) or the
> framework's request context. It never imports assembly. Which courier, the stack document says.
> One root per entry, and the registry, are this document's choices; the sources say only that
> whoever starts the application wires it.

After:

> **A driving adapter receives its service from the root.** As an argument where the root
> constructs the adapter — a route, a server's handler, the adapters a product's build function
> takes. Where the framework collects the adapter and the root cannot construct it, such as a
> server function, from a courier (Terms). A driving adapter never imports assembly. One root per
> entry, that a driving adapter never imports it, and the courier are this document's choices. In
> Cockburn's example the driving adapter wires the application itself; Khononov resolves ports
> "in the infrastructure layer, either through dependency injection or by bootstrapping" (p. 128).
> A root apart from the driving adapters is this document's.

### 7. Ports and factories, ambient paragraph (R03-19, Q13's registry part)

Before:

> **A value may be held ambient when no use case or domain function decides by it** — Fowler's
> registry, in two scopes. Per process: what the root built. The root puts it in before any
> adapter runs; a driving adapter reads it when it runs, not when it loads; a service reads nothing
> from that scope and receives its dependencies as arguments (question 7).

> The line is this document's choice; which values a codebase holds ambient, it says in an ADR,
> and what carries them is the stack document's.

After:

> **A value may be held ambient when no use case or domain function decides by it** — Fowler's
> registry, in two scopes; *ambient* is this document's word. Per process: what the root built,
> read as a courier by the driving adapters the root cannot construct — a service locator in
> Fowler's terms, and a departure from the injection the sources prefer, confined to that case.
> The root puts it in before any adapter runs; a driving adapter reads it when it runs, not when
> it loads; a service reads nothing from that scope and receives its dependencies as arguments
> (question 7).

> Where the line between ambient and argument falls is this document's choice; which values a
> codebase holds ambient, it says in an ADR, and what carries them is the stack document's.

The "Per request: …" sentences between are unchanged.

### 8. Other systems, export list

After the handler bullet ("where it handles messages, a function that takes configuration and
builds its handler, for the assembly that hands it to the relay. …"), add:

> - where it publishes messages, a function that takes configuration and builds the reader of its
>   outbox, for the same assembly;

### 9. Products, new bullet before "A product that calls back is a cycle by design"

> - **A product is built by a build function this system's product module exports**, as another
>   system is (Other systems). That function is the one place where the product learns of this
>   system, and the only place in this system that knows how the product is built. Where the
>   product takes its config from a call, the function builds it; where the framework imports
>   the config, the function carries what the product needs there another way, inside itself.

### 10. The checklist, question 7's tell (R03-06)

Before:

> **In a diff:** a concrete adapter imported into a service file, or constructed inside a service
> body or a factory body, rather than passed in. Also: a module exporting a ready-made instance
> next to the factory that produces it.

After:

> **In a diff:** a concrete adapter imported into a service file, constructed inside a service
> body or a factory body, or read from the per-process registry there, rather than passed in; a
> driving adapter importing an instance from the root, or reading a courier when its module
> loads. Also: a module exporting a ready-made instance next to the factory that produces it.

### 11. The checklist, question 5's tell (R03-06, R02-11)

Append to "**In a diff:**": "; a service that receives or imports another service of its system;
a call to another system's writing port inside `run`." Check the exception clause at apply time;
ticket 23's sweep widened it.

### 12. Tests, the fakes sentence

Before: "a driving adapter the framework collects reads them from the registry or the framework's
context (Ports and factories), which the test fills with fakes"

After: "a driving adapter the framework collects reads them from a courier (Terms), which the test
fills with fakes"

### 13. When to leave it alone, the port-call bullet (R02-11)

Before: "**A service calling another system's driving port is calling a port**, not a use case
nested in another."

After: "**A service calling another system's driving port is calling a port**, not a use case
nested in another — for a read. A write goes through the outbox or after the commit (Transactions,
rule 1), never inside `run`."

### 14. *Entry* in the module sense (R02-29)

With *entry* defined in pair 4, the module sense is renamed: "an entry that loads only the
domain" → "an export path that loads only the domain"; "or the entry loads the service that
declares them" → "or the export path loads the service that declares them"; "from an entry
production does not load" → "from an export path production does not load"; the code comment
"pricing's entries" → "pricing's export paths"; "a system's exported entries" (Not everything
gets a layer) → "a system's export paths".

### 15. `domain.md`, placed-as-fault list

Add: "Two roots in one process, one building shop for the other: there is one root, the
server's; it builds Payload through shop's build function for it, handing over shop's hooks, and
how the function gets them into Payload's imported config is the function's (ticket 24)."

### Sweep

Grep `entry`, `entries`, `root`, `registry`, `courier`, `ambient`, `outbox`, `relay`, `built
once`, `two roots`, `product's hook`. The table follows through the skill: the driving row's
"from the registry or the framework's context" becomes "from a courier where the root cannot
construct it"; the driven row gains nothing. `tanstack-start.md:16` ("from the registry or the
server …") gains "(a courier, `layers.md` Terms)". `domain.md:80-82` holds. Transactions and
Products say "this system's outbox", "the product's outbox": consistent with pair 2, each a
system's own. Ticket 23's "outbox adapter over the product's store" is now the system's reader
export: footnote. Ticket 21's consequence "Two roots in one process no longer import each other;
the first to build a system puts it in, the other reads it": footnote, superseded. Ticket 20's
entry list: same footnote. `components.md` is untouched.

### The four tests

| pair | gap | derivation | generality | source |
| --- | --- | --- | --- | --- |
| 1, 2 outbox is the system's port | an agent builds one outbox mechanism for all systems and has no place for embedded messages | follows from "driven ports this system declares live in its domain"; the common-library line hid it | yes | Khononov p. 145–146 (outbox per aggregate's transaction) |
| 2 relay receives | an agent has the relay import systems' builders | follows from "plumbing every system may import" | yes | silent; marked by "common library" |
| 2 courier | an agent stashes services in a request context at startup, or reads the registry in a route | wording | yes | Fowler, Service Locator; marked in pair 7 |
| 4 entry, one root | an agent builds a second root for a product's config | does not follow: "entry" was undefined and the config was listed as one | any product | silent; marked in pair 6 |
| 4 builder per entry kind | an agent builds the open host service in a relay worker and hunts for the handler | follows from the export list; the pointer was missing | yes | Khononov p. 128 |
| 5 driven adapter's service | an agent hands a driven adapter a sibling service | follows from question 6 | yes | Khononov p. 128, Cockburn |
| 8 reader export | the relay has nothing to read with | follows from pair 2 | yes | — |
| 9 product build function | an agent passes shop's service into a static config file and recreates the import cycle, or reads a courier in a route | follows from the escalation paragraph's shape; "a product is another system" | any product; Payload and a runtime-config library both fit | silent; the shape is Khononov p. 128's bootstrapping |
| 10, 11 tells | three rules fire no question | each is the fault its question describes in prose | yes | — |
| 13 read only | an agent writes to another system's port inside `run` | follows from rule 1 | yes | Khononov p. 150 |

## Grounding

- Khononov p. 128: "The abstract ports are resolved into concrete adapters in the infrastructure
  layer, either through dependency injection or by bootstrapping." Grounds that adapters are
  received and wired outside the business logic; names no root.
- Khononov p. 145–146: the outbox is written "in the same atomic transaction" as the aggregate;
  on a store without multi-document transactions "the outgoing domain events have to be embedded
  in the aggregate's record". The outbox is per aggregate's transaction, hence per system; a
  shared mechanism is nowhere in the source.
- Cockburn, *Hexagonal Architecture*: "have the (FIT or UI) user-side adapter pass the repository
  to use (real or mock) into the constructor of the application itself"; "The Dependency Injection
  pattern by Martin Fowler gives some implementations … or using configuration files and having
  the SPRING framework generate the equivalent code." The driving adapter wires in his example; a
  root apart from it is this document's.
- Fowler, *PoEAA*, *Registry* (from memory): "a well-known object that other objects can use to
  find common objects and services"; process- and thread-scoped; "use sparingly". *Service
  Locator* (from memory): a registry read for services, contrasted with injection. The
  per-process scope read for services is a service locator; confining it to adapters the root
  cannot construct is this document's.
- "Ambient context" (van Deursen & Seemann, from memory): nearest term for the per-request scope;
  none of the four uses it. This document's word. *Courier* and *entry* in the process sense are
  coined here; *relay* and *outbox* are Khononov's words, defined here in this document's terms.
- Evans, Vernon: silent on assembly.

Extracts in the session's scratchpad (`khononov.txt`, `cockburn.html`), gone with it.

## Done when

The fifteen pairs are applied, 22 and 23 first; each new sentence passes the four tests above;
the sweep finds no "two roots", no root reading a registry, no "outbox port" credited to the
common library, and no *entry* in the module sense; the skill has rebuilt the table; a fresh
agent with only `layers.md` places at confidence 4–5: a server and Payload in one process (one
root, Payload through shop's build function); a server function next to a route (courier for the
one, argument for the other); shop's messages embedded in a Payload document (shop's outbox port,
shop's reader, exported); a process running server and relay (one root, both builders); a
`registry.get()` in a service body (question 7); a service receiving a sibling service (question
5); a write to another system's port inside `run` (question 5, rule 1). Committed per
`CLAUDE.md`; status set here, in `spec-01.md` and noted in `review-03.md`.

## Decision

**One root per process, the deployable's.** An entry is where a deployable starts — a server, a
job, a relay worker — and it has one root, the outer one by default. It builds every system the
process runs through the build function each exports for the way the entry uses it: open host
service, handler and outbox reader, or all of them where one process serves and relays. The
sentence about two roots sharing through the registry goes; nothing replaces it.

**A product is built by a build function, as another system is.** The function lives in this
system's product module and is the one place where the product learns of this system — its
driving adapters the product will call, what its config declares from this system's domain — and
the only place in this system that knows how the product is built. Where the product takes its
config from a call, the function builds the config. Where the framework imports the config, as
Payload does, the function gets what the product needs into it another way, inside itself; a
per-process courier the config's hook slots read when a hook runs is one way, and nothing
outside the function sees it. A build function gives each entry its own wiring: a server passes
the hooks, a CLI passes none. The builder is the rule; the courier inside it is a pattern.

**A courier is a term, for one case.** It carries what the root built to a driving adapter the
root cannot construct because the framework collects it: the per-process registry, or the
framework's request context filled per request by middleware the root installs. *Ambient* is the
wider word: any value held where nothing decides by it; the two meet at the per-process registry
and nowhere else. The courier ranks nothing: in a stack where the framework collects every
adapter, every adapter reads one.

**The outbox port is each system's; only the relay is common.** A port is what a system's rules
declare they need, in that system's terms; where its messages live is store-dependent (ticket
23); so the outbox port, its adapter and its reader are the system's, and the reader joins the
export list beside the handler. The relay reads through the readers and delivers to the handlers
until a message is taken; it imports no system, and the root of its process hands it both. No
envelope, routing or outcome model is ruled: a codebase that fans out to every handler and one
that routes by type both fit; dedupe is already the receiving use case's ("Deliver the same thing
again").

**Markers, all five.** Service locator named for the per-process scope; "ambient" as this
document's word; one root per entry, never importing it, and the courier as this document's
choices; the static-versus-built split marked, with the driven adapter's only received service
being another system's driving port; Cockburn's and Khononov's wiring named against the root. No
"(from memory)" in `layers.md`; that is this file's.

**Tells fold into questions 5 and 7.** A registry read in a service body and a root import or a
load-time courier read in a driving adapter go to question 7; a sibling-service receipt or import
and a writing call to another system's port inside `run` go to question 5, with the
leave-it-alone bullet narrowed to reads. No tenth question.

**Considered options**

- Two roots, built once when an escalation reason holds, the other reading late through a
  function (review 03's draft B1/B2): rules a case the definition of assembly excludes, and makes
  a root a registry reader.
- "The root that runs first builds": a start order for the same non-case.
- A product's hooks reading the courier themselves, through an accessor in the hooks module or
  in the config file: works, but puts the courier in the system's code and in a file the
  framework imports; the build function hides it and the CLI case needs no accessor at all.
- A config builder with a hooks parameter, called once from the static config file and once from
  the CLI: the same wiring, exposed; superseded by the build function carrying the adapters.
- The courier as the rule for products with an imported config: it is one way the build function
  may use; naming it as the rule reads as required.
- An envelope the relay routes by: an implementation detail; one codebase fans out, another
  routes.
- A reader per store in the common library: wrong once the outbox port is the system's; only the
  system knows where its messages are.
- A tenth checklist question for the three tells: splits one fault across two headings.
- Mark only the three markers that change what an agent does: a reader who knows Fowler reads
  "Fowler's registry" over a service locator and distrusts the rest.

**Consequences**

- R03-04 closes by dissolution; ticket 21's "two roots" consequence and ticket 20's "a product's
  config" entry are superseded; R02-16 is fully closed.
- "Which root builds it is each codebase's choice" is gone; what stays the codebase's is which
  courier (stack document), how the relay routes and orders (ADR), and how a build function gets
  what the product needs into an imported config (the function's).
- The outbox leaves the common library; the service example's comment changes; R03-03's clause
  for subgroup C loses "the outbox" and keeps the transaction context.
- The domain half of "what the product needs" (fields a product's config declares) rests on
  Q11's "a store's own schema is not a second constructor"; the product's build function hands
  the product schemas, never decisions — a specification is asked only through a hook.
- The driving-adapters row follows the body: a courier where the root cannot construct the
  adapter; the driven-adapters row is unchanged.
- *Entry* becomes a defined term in the body; the module sense is renamed to "export path"
  (R02-29 closes).
- R03-02, R03-06, R03-19, R03-20, R03-21, R02-11 close with this ticket; review 03's Q13 keeps
  its non-registry markers, Q18 and Q21 are settled here.
