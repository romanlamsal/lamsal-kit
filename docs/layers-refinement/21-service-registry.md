# A driving adapter never imports assembly

**Status:** closed (525c559)

**Kind:** wrong instruction, and the gap behind five review-02 findings · **Touches:** Terms
(common library), The layers (driving-adapters row), Ports and factories (the "receives its
service" paragraph, the ambient paragraph), Tests, `domain.md` fault (h), `tanstack-start.md` ·
**Related:** `20-root-per-entry.md` (supersedes its "by import" half), `15-ambient-transaction-scope.md`
(the ambient test this reuses), `08-assembly-per-process.md` (load order stays the stack
document's), `review-02.md` Q0, R02-06, R02-08, R02-16, R02-47, R02-49, R02-63 (h)

Grilled and decided on 2026-10-21; the `## Decision` section is the ruling and the Resolution is
the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Ticket 20 ruled that a driving adapter receives its service from the root "as an argument where
the entry constructs the adapter; by importing the root where the framework constructs it, such
as a server function or a product's hook", and called that import "the one place a driving
adapter imports assembly".

The constraint behind it is real: a module the framework collects — a TanStack Start server
function, a file-based API route — cannot take an argument. But the constraint is narrower than
ticket 20 assumed. A `node:http` handler, a Hono or Express route and a Payload hook are
constructed by code the entry runs, so a closure factory works and the root passes the service
in; Payload's cycle is already broken by late binding (Products). Only module-collected adapters
lack a hand to receive from.

The import was the wrong remedy for them. Review 02 traced five findings to it:

- the driving-adapters row ("services and domain") forbids the import the body allows (R02-06);
- "Test services and driving adapters against fakes. Each receives ports" is false for an
  adapter that imports the root; a test needs module mocking (R02-08);
- two roots in one process import each other when a product calls back (R02-16);
- ticket 20 said both choices were marked; only one is (R02-47);
- the stack document says nothing about where a server function gets its service (R02-49).

A sixth: `domain.md` fault (h) names importing a service instance from a service module as the
fault, but a fresh agent could not derive that importing the root is the same fault in another
file (R02-63).

## Problem

`layers.md` already has the concept that solves it, under another scope. The ambient paragraph
holds "a value that influences nothing a use case or domain function decides", Fowler's registry,
"scoped per request", put in by a driving adapter. A service instance passes that test — a
driving adapter reads it, no use case decides by it — but fails the paragraph's framing: the root
puts it in, once per process. So an agent reading the paragraph takes a process-scoped registry
of services to be forbidden, and the only sanctioned way left is the import.

The alternative remedy, the framework's request context (server-function middleware carrying
`context.orders`), is one courier among several and names a framework; it belongs to the stack
document, not here.

## Resolution

One concept, two scopes, one test. What the root built is held ambient per process and read by
driving adapters when they run; request values stay as they are. A driving adapter never imports
assembly. Which courier a codebase uses is the stack document's.

### 1. Terms, the common library

Before:

> A *common library* is plumbing every system may import: the transaction port, store clients, a
> logger, a tracer, the outbox port and its relay. It holds no model.

After:

> A *common library* is plumbing every system may import: the transaction port, store clients, a
> logger, a tracer, the outbox port and its relay, the ambient registry. It holds no model.

### 2. The layers, driving-adapters row, "may import"

Before: "services and domain; it receives ports that resolve or translate its caller, as it
receives its service"

After: "services, domain and the registry; it receives ports that resolve or translate its
caller, as it receives its service"

(R02-06's other additions — the common library's fixed plumbing, the other system's schema behind
an anti-corruption layer — are that finding's, not this ticket's.)

### 3. Ports and factories, "receives its service"

Before:

> **A driving adapter receives its service from the root**: as an argument where the entry
> constructs the adapter; by importing the root where the framework constructs it, such as a
> server function or a product's hook. That import is the one place a driving adapter imports
> assembly. One root per entry is this document's choice; the sources say only that whoever
> starts the application wires it.

After:

> **An adapter imports what is static and receives what is built.** The domain, a schema it
> validates with, port types: imported. A service, an adapter, a product's instance: received.
>
> **A driving adapter receives its service from the root.** As an argument where the entry
> constructs the adapter; where the framework constructs it, such as a server function, from a
> courier the root fills once — the ambient registry (below) or the framework's request context.
> It never imports assembly. Which courier, the stack document says. One root per entry, and the
> registry, are this document's choices; the sources say only that whoever starts the
> application wires it.

### 4. Ports and factories, the ambient paragraph

Before:

> **A value that influences nothing a use case or domain function decides may be held ambient**
> — Fowler's registry, scoped per request: a request id, a trace context, the locale a mail is
> rendered in, the user an audit column records until a rule decides by it. A driving adapter
> puts it in; services and adapters read it; the domain takes arguments. A value a message's
> handler needs goes in the message, since the handler runs in another request. The transaction
> context is not ambient: what a read returns depends on it. The line is this document's choice;
> which values a codebase holds ambient, it says in an ADR.

After:

> **What nothing a use case or domain function decides by may be held ambient** — Fowler's
> registry, in two scopes. Per process: what the root built. The root puts it in before any
> adapter runs; a driving adapter reads it when it runs, not when it loads; a service reads
> nothing there and receives its dependencies as arguments (question 7). Per request: a request
> id, a trace context, the locale a mail is rendered in, the user an audit column records until
> a rule decides by it. A driving adapter puts it in; services and adapters read it; the domain
> takes arguments. A value a message's handler needs goes in the message, since the handler runs
> in another request. The transaction context is in neither scope: what a read returns depends
> on it. The line is this document's choice; which values a codebase holds ambient, it says in
> an ADR, and what carries them is the stack document's.

### 5. Tests, "against fakes"

Before:

> **Test services and driving adapters against fakes.** Each receives ports, so a test hands it
> fakes and asserts what it *did*: which port it called, with what, and what it returned.

After:

> **Test services and driving adapters against fakes.** Each receives ports — a driving adapter
> the framework constructs reads them from the registry, which the test fills with fakes — so a
> test hands it fakes and asserts what it *did*: which port it called, with what, and what it
> returned.

### 6. `domain.md`, placed-as-fault list

Before: "A server function built as a factory with no caller, or importing a service instance
from a service module: a driving adapter the framework constructs imports the root (ticket 20)."

After: "A server function built as a factory with no caller, or importing a service instance
from a service module or from the root: a driving adapter the framework constructs reads its
service from the registry or the framework's context (ticket 21)."

### 7. `tanstack-start.md`, File conventions

Add after the table:

> A `.fn.ts` reads its service inside the handler, from the registry or the server function's
> middleware context; it imports neither a service instance nor `assembly.ts` (`layers.md`,
> Ports and factories). A `.schema.ts` composes domain schemas — pick, extend — and declares no
> rule of its own (`layers.md` question 3).

The second sentence is the static half of pair 3 applied to the validator a server function takes
at module level: the schema is domain, so the import is right, and the file that holds it must not
become a second constructor.

### Applied with tightenings

The first placement test put the Payload hook at 3 (argument or registry?) and found the ambient
paragraph's opening and "reads nothing there" hard to parse. Applied as:

- pair 3: "As an argument where the entry's code constructs the adapter — a route, a product's
  hook; where the framework collects it, such as a server function, from a courier …". The line
  is who constructs the adapter; the hook is named on the argument side.
- pair 4: "**A value may be held ambient when no use case or domain function decides by it**";
  "a service reads nothing from that scope". The second cold read still parsed the ticket's
  opening as a garden path.
- pair 5: "a driving adapter the framework collects reads them from the registry or the
  framework's context (Ports and factories), which the test fills with fakes" — generality test:
  the test fills whichever courier the codebase chose.
- sweep sentence: "built once, put in the registry by one root and read by the other, as the
  reasons to escalate (Other systems) decide; which root builds it is each codebase's choice" —
  the Decision's "which root builds what is still each codebase's", stated positively; "read, not
  imported" after the second cold read derived "no cycle" only at 3.

### Checked, untouched

"Assembly is the only place that knows both a port and its implementation" holds: the registry
holds instances the root built, it does not build them. Question 7's fault stays "a module
exporting a ready-made instance next to the factory": the registry is common-library plumbing,
not a service module. "One process may load two entries … built once by one root and imported by
the other" needs "imported" changed to "put in the registry by one root and read by the other";
that is the step-5 sweep, and it removes R02-16's cycle. Ticket 15's line stands: the transaction
context fails the same test in both scopes. Ticket 08's load-order ruling stands: the read is at
request time, and when the root fills the registry is the stack document's.

### Housekeeping

- `20-root-per-entry.md`: footnote under Decision, "the 'by import' half is superseded by
  ticket 21: a driving adapter reads the registry or the framework's context, and never imports
  assembly".
- `review-01.md`: R01-60 row, "by argument or by import" → footnote to ticket 21.
- `review-02.md`: Q0 is this ticket; R02-06, R02-08, R02-16, R02-47, R02-49 and R02-63 (h)
  close with it, with their proposed fixes dropped.
- `spec-01.md`: a row for this ticket.

## Grounding

- Fowler, *PoEAA*, *Registry* *(from memory)*: "a well-known object that other objects can use
  to find common objects and services"; Fowler gives both a process-scoped and a thread-scoped
  form, and warns it is a global, to be used sparingly. Both scopes here are his.
- Cockburn, *Hexagonal Architecture*: the driver constructs and configures the application;
  nothing on how a framework-collected adapter reaches it.
- Khononov ch. 8 p. 127: ports "resolved into concrete adapters … either through dependency
  injection or by bootstrapping". Bootstrapping into a registry is one form of it.
- Evans: silent.

No source says where a framework-constructed adapter gets its service. The two scopes and "never
imports assembly" are this document's choices, with Fowler behind the registry; marked in pair 3
as ticket 20's marker was, now covering both.

## Done when

The seven pairs are applied and the step-5 sweep (grep `root`, `registry`, `ambient`, `import`)
finds no sentence saying a driving adapter imports the root; each new sentence passes the four
tests; a fresh agent with only `layers.md` places at confidence 4–5: a TanStack Start server
function needing shop's service (what it imports, what it reads, whether that is a question-7
fault); the same server function tested against fakes (how the fake arrives); a web server that
also loads Payload's config, both needing shop (who builds, who reads, no cycle); a Payload hook
needing a service (argument with late binding, not the registry); fault (h) with "imports the
root" as the fault. Committed per `CLAUDE.md`; status set here, in `spec-01.md` and in
`review-02.md`.

## Decision

**A driving adapter never imports assembly.** It receives its service as an argument where the
entry constructs it, and otherwise reads it from a courier the root fills once. Ticket 20 named
the import as the exception; the import was the cause of five review-02 findings and a module
cycle, so the exception goes.

**The courier is ambient, in a second scope of the rule the document already has.** The ambient
test, "nothing a use case or domain function decides by", admits what the root built. Per process
the root puts it in and driving adapters read it when they run; per request a driving adapter
puts values in and services and adapters read them. Services read the process scope never: their
dependencies arrive as arguments, which is question 7. The transaction context fails the test in
both scopes.

**An adapter imports what is static and receives what is built.** The general line behind the
whole ticket, stated once: the domain, a validator's schema and port types are imported; a
service, an adapter and a product's instance are received. It is why a server function may take
a domain schema at module level and may not take a service there.

**Which courier is the stack document's.** The registry, or the framework's request context, or
both; typed or not; `AsyncLocalStorage` or a module-level object; and when the root fills it.
`layers.md` names the registry as the framework-agnostic one and stops there.

**Considered options**

- Keep "imports the root" and confine it to a one-line binding that calls a handler which takes
  its service (review-02 Q14): keeps the import and its cycle, and makes a two-file shape
  mandatory to test anything.
- The framework's request context as the only courier: names a mechanism not every framework
  has, and belongs to the stack document.
- A lazy root (a getter the adapter imports): the same import with an extra step; the cycle and
  the module mocking stay.

**Consequences**

- Ticket 20's root per entry and build-function-as-assembly stand; only its import half is
  superseded.
- Two roots in one process no longer import each other; the first to build a system puts it in,
  the other reads it. Which root builds what is still each codebase's, and R02-16's proposed
  "root of the entry the other loads" is not needed.
- Tests on fakes hold for every driving adapter without module mocking.
- The driving-adapters row gains "the registry" and nothing else from this ticket.
- `tanstack-start.md` gains two sentences; the `.schema.ts` convention is now bound to question 3.
