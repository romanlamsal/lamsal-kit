# One root per process; the registry is the fallback for adapters the root cannot construct

**Status:** ready

**Kind:** contradiction (review 03, R03-04) and unmarked choices (R03-02, R03-19, R03-20,
R03-21), with the three missing tells (R03-06, R02-11) · **Touches:** Ports and factories (the
Assembly paragraph, "imports what is static", "receives its service from the root", the ambient
paragraph), Other systems (the export list's wording for *entry*, R02-29), the checklist
(questions 5 and 7), When to leave it alone (the port-call bullet), `domain.md` (placed-as list),
the layer table (both adapter rows, via the skill) · **Related:** `review-03.md` subgroup B
(B1–B5, Q13's registry part, Q18, Q21); `20-root-per-entry.md` (root per entry stands);
`21-service-registry.md` (its "two roots in one process" consequence is superseded here);
`review-02.md` R02-16, R02-29. Apply after 22 and 23.

Grilled and decided on 2026-10-21; the `## Decision` section is the ruling and the Resolution is
the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Ticket 20 made assembly one root per entry and named three entries: "a server's start, a relay
worker, a product's config". Ticket 21's sweep added "One process may load two entries, such as
a server and a product's config: each keeps its root, and what both need is built once, put in
the registry by one root and read, not imported, by the other, as the reasons to escalate (Other
systems) decide; which root builds it is each codebase's choice." Four readers tripped on it
(R03-04): "as the reasons to escalate decide" dangles; a product-config root constructs its
hooks when the config loads, so a registry read there is a load-time read against "reads it when
it runs, not when it loads"; and the ambient paragraph names only driving adapters as readers.

Review 03 drafted the fix as a sentence about two roots: build once when an escalation reason
holds, let the other root read late through a function. The grilling found the premise wrong.
Assembly happens where a deployable starts — a server, a job, a relay worker. That root is the
outer one by default. A product's config is not where anything starts: either the root builds it,
through a factory that takes this system's services, and its hooks close over those arguments; or
the framework loads it, and its hooks are driving adapters the framework collects, which read the
registry like a server function does. Either way there is one root in the process, and nothing is
"built once by one root for the other".

The per-process registry has one job: it is the fallback for a driving adapter the root cannot
construct — a server function the framework collects. A `node:http` server, a route, a hook in a
config the root builds: these receive their service as an argument. The courier sentence (R03-02)
says "a courier the root fills once — the ambient registry or the framework's request context",
which cannot be true of a request context.

The paragraphs around this carry choices the books do not make, credited to no one or to Fowler
(R03-19, R03-20, R03-21), and three rules no checklist question catches (R03-06, R02-11).

## Problem

The two-entries sentence rules a case that does not exist under the document's own definition of
assembly, and in doing so says a root reads the registry, which no other sentence allows. A fresh
agent placed "which root builds shop" at confidence 3 twice (review 02 P, review 03 P). The
sentence has to go, and the definition that makes it go — an entry is where a deployable starts —
has to be in the text, since the product's config is listed today as an entry.

The registry's role as a fallback is implied by "where the framework collects it" and said
nowhere. Without it an agent reads "from the registry or the framework's context" in the table as
one of three equal ways and reaches for the registry in a route it could have constructed.

## Resolution

### 1. Ports and factories, Assembly paragraph (R03-04, R02-29)

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
> worker — and it has one *root*, which builds what that entry runs: it builds the adapters, calls
> the factories and, for each system, the build function that system exports for the way this
> entry uses it — its open host service for a server, its handler for a relay worker (Other
> systems) — and hands the result to its driving adapters. A product's config is not an entry.
> Where the root builds it, through a factory that takes this system's services, its hooks close
> over those arguments; where the framework loads it, its hooks are driving adapters the framework
> collects and take their service as such adapters do (below). Assembly is the only place that
> knows both a port and its implementation.

The rest of the paragraph ("Keep it separate from the factories: …") is unchanged.

### 2. Ports and factories, "imports what is static" (R03-20)

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

### 3. Ports and factories, "receives its service from the root" (R03-02, R03-19, R03-21)

Before:

> **A driving adapter receives its service from the root.** As an argument where the entry's code
> constructs the adapter — a route, a product's hook; where the framework collects it, such as a
> server function, from a courier the root fills once — the ambient registry (below) or the
> framework's request context. It never imports assembly. Which courier, the stack document says.
> One root per entry, and the registry, are this document's choices; the sources say only that
> whoever starts the application wires it.

After:

> **A driving adapter receives its service from the root.** As an argument where the root
> constructs the adapter — a route, a server's handler, a hook in a config the root builds. Where
> the framework collects the adapter and the root cannot construct it, such as a server function,
> from a courier the root fills: the per-process registry (below), filled once before any adapter
> runs, or the framework's request context, filled per request by middleware the root installs.
> The registry is the fallback for that case, not a third way. A driving adapter never imports
> assembly. Which courier, the stack document says. One root per entry, that a driving adapter
> never imports it, and the registry as the fallback are this document's choices. In Cockburn's
> example the driving adapter wires the application itself; Khononov resolves ports "in the
> infrastructure layer, either through dependency injection or by bootstrapping" (p. 128). A root
> apart from the driving adapters is this document's.

### 4. Ports and factories, ambient paragraph (R03-19, Q13's registry part)

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
> read by the driving adapters the root cannot construct — a service locator in Fowler's terms,
> and a departure from the injection the sources prefer, confined to that case. The root puts it
> in before any adapter runs; a driving adapter reads it when it runs, not when it loads; a
> service reads nothing from that scope and receives its dependencies as arguments (question 7).

> Where the line between ambient and argument falls is this document's choice; which values a
> codebase holds ambient, it says in an ADR, and what carries them is the stack document's.

The "Per request: …" sentences between are unchanged.

### 5. The checklist, question 7's tell (R03-06)

Before:

> **In a diff:** a concrete adapter imported into a service file, or constructed inside a service
> body or a factory body, rather than passed in. Also: a module exporting a ready-made instance
> next to the factory that produces it.

After:

> **In a diff:** a concrete adapter imported into a service file, constructed inside a service
> body or a factory body, or read from the per-process registry there, rather than passed in; a
> driving adapter importing an instance from the root, or reading the registry when its module
> loads. Also: a module exporting a ready-made instance next to the factory that produces it.

### 6. The checklist, question 5's tell (R03-06, R02-11)

Before:

> **In a diff:** a function that opens its own transaction instead of joining the one it was
> given, except the one rule 1 records an answer in or hook step 2 or 4 opens (Transactions,
> Products); a repository method that takes the context and writes without it; a loop that calls
> a write per item.

After:

> **In a diff:** a function that opens its own transaction instead of joining the one it was
> given, except the one rule 1 records an answer in or hook step 2 or 4 opens (Transactions,
> Products); a repository method that takes the context and writes without it; a loop that calls
> a write per item; a service that receives or imports another service of its system; a call to
> another system's writing port inside `run`.

Check the exact current exception clause at apply time; ticket 23's sweep widened it.

### 7. When to leave it alone, the port-call bullet (R02-11)

Before: "**A service calling another system's driving port is calling a port**, not a use case
nested in another."

After: "**A service calling another system's driving port is calling a port**, not a use case
nested in another — for a read. A write goes through the outbox or after the commit (Transactions,
rule 1), never inside `run`."

### 8. Other systems and When to leave it alone, *entry* in the module sense (R02-29)

With *entry* defined in pair 1, the module sense is renamed. "an entry that loads only the
domain" → "an export path that loads only the domain"; "or the entry loads the service that
declares them" → "or the export path loads the service that declares them"; "from an entry
production does not load" → "from an export path production does not load"; the code comment
"pricing's entries" → "pricing's export paths"; "a system's exported entries" (Not everything
gets a layer) → "a system's export paths".

### 9. `domain.md`, placed-as-fault list

Add: "Two roots in one process, one building shop for the other: there is one root, the
server's; Payload's config is built by it with shop's services as arguments, or, where the
framework loads the config, its hooks read the registry as a server function does (ticket 24)."

### Sweep

Grep `entry`, `entries`, `root`, `registry`, `courier`, `ambient`, `built once`, `two roots`.
The table follows through the skill: the driving row's "from the registry or the framework's
context" gains "where the root cannot construct it"; the driven row's "imports what is static"
entry is unchanged. `tanstack-start.md:16` ("reads its service inside the server function's body,
from the registry or the server …") holds: a server function is the fallback case. `domain.md:80`
holds. Ticket 21's consequence "Two roots in one process no longer import each other; the first to
build a system puts it in, the other reads it" gets a footnote: superseded here, one root. Ticket
20's entry list ("a product's config") gets the same footnote. `components.md` is untouched.

### The four tests

| pair | gap | derivation | generality | source |
| --- | --- | --- | --- | --- |
| 1 entry, one root | an agent builds a second root for a product's config and shares through the registry | does not follow: "entry" was undefined and the config was listed as one | any framework-loaded config: Payload, a CMS, an auth library | sources silent on roots; marked in pair 3 |
| 1 builder per entry kind | an agent builds the open host service in a relay worker and hunts for the handler | follows from the export list; the pointer is what was missing | yes | Khononov p. 128 (bootstrapping) |
| 2 driven adapter's service | an agent hands a driven adapter a sibling service, against question 6 | follows from question 6; wording hid it | yes | Khononov p. 128, Cockburn: received |
| 3 fallback | an agent reaches for the registry in a route | does not follow: "where the framework collects it" named a case, not a rank | yes | departure from injection, marked |
| 3 courier filled | an agent stashes services in a request context at startup | wording | yes | — |
| 4 service locator | a reader who knows Fowler distrusts the paragraph | — | — | Fowler, Registry and Service Locator (from memory) |
| 5, 6 tells | three rules fire no question | each tell is the fault its question describes in prose | yes | — |
| 7 read only | an agent writes to another system's port inside `run` | follows from rule 1; the bullet hid it | yes | Khononov p. 150 (no two transactions atomic) |

## Grounding

- Khononov p. 128: "The abstract ports are resolved into concrete adapters in the infrastructure
  layer, either through dependency injection or by bootstrapping." Grounds that adapters are
  received and that something outside the business logic wires them; names no root.
- Cockburn, *Hexagonal Architecture*: "have the (FIT or UI) user-side adapter pass the repository
  to use (real or mock) into the constructor of the application itself"; "The Dependency Injection
  pattern by Martin Fowler gives some implementations … or using configuration files and having
  the SPRING framework generate the equivalent code." The driving adapter wires in his example; a
  root apart from it is this document's.
- Fowler, *PoEAA*, *Registry* (from memory): "a well-known object that other objects can use to
  find common objects and services"; process- and thread-scoped; "use sparingly". *Service
  Locator* (from memory, the injection article): a registry read for services, which Fowler
  contrasts with injection. The per-process scope read for services is a service locator;
  confining it to adapters the root cannot construct is this document's.
- "Ambient context" (van Deursen & Seemann, from memory) is the nearest term for the per-request
  scope; no source among the four uses it. This document's word.
- Evans, Vernon: silent on assembly.

Extracts in the session's scratchpad (`khononov.txt`, `cockburn.html`), gone with it.

## Done when

The nine pairs are applied, 22 and 23 first; each new sentence passes the four tests above; the
sweep finds no "two roots", no root reading the registry, and no *entry* in the module sense; the
skill has rebuilt the table; a fresh agent with only `layers.md` places at confidence 4–5: a
server and Payload's config in one process (one root; hooks as arguments or, framework-loaded,
the registry); a server function next to a route (registry for the one, argument for the other);
a `registry.get()` in a service body (question 7); a service receiving a sibling service
(question 5); a write to another system's port inside `run` (question 5, rule 1). Committed per
`CLAUDE.md`; status set here, in `spec-01.md` and noted in `review-03.md`.

## Decision

**One root per process, the deployable's.** An entry is where a deployable starts — a server, a
job, a relay worker — and it has one root. That root is the outer one by default: it builds every
system the process runs, calling for each the build function the system exports for the way this
entry uses it (open host service for a server, handler for a relay worker), and hands the result
to its driving adapters. A product's config is not an entry. Where the root builds it, the config
factory takes this system's services and its hooks close over them; where the framework loads
it, its hooks are adapters the framework collects. The sentence about two roots sharing through
the registry goes; nothing replaces it.

**The per-process registry is the fallback, confined to one case.** It serves a driving adapter
the root cannot construct, because the framework collects it: a server function. Everything the
root can construct — a route, a `node:http` server's handler, a hook in a config the root builds —
receives its service as an argument. The registry is not a third way beside the argument and the
request context; the text says so.

**The courier sentence names who fills what, and when.** The per-process registry, once, before
any adapter runs; the framework's request context, per request, by middleware the root installs.

**Markers, all five.** Service locator named for the per-process scope; "ambient" as this
document's word; one root per entry, never importing it, and the fallback marked as this
document's choices; the static-versus-built split marked, with the driven adapter's only
received service being another system's driving port; Cockburn's and Khononov's wiring named
against the root. No "(from memory)" in `layers.md`; that is this file's.

**Tells fold into questions 5 and 7.** A registry read in a service body and a root import or a
load-time registry read in a driving adapter go to question 7; a sibling-service receipt or
import and a writing call to another system's port inside `run` go to question 5, with the
leave-it-alone bullet narrowed to reads. No tenth question.

**Considered options**

- Two roots, built once when an escalation reason holds, the other reading late through a
  function (review 03's draft B1/B2): rules a case the definition of assembly excludes, and makes
  a root a registry reader, which no other sentence allows.
- "The root that runs first builds": a start order the stack document should own, for the same
  non-case.
- Always share what both need, mechanism unstated: the same non-case.
- A tenth checklist question for the three tells: splits one fault across two headings.
- Mark only the three markers that change what an agent does: a reader who knows Fowler reads
  "Fowler's registry" over a service locator and distrusts the rest.

**Consequences**

- R03-04 closes by dissolution, not rewording; ticket 21's "two roots" consequence and ticket
  20's "a product's config" entry are superseded. R02-16 is fully closed.
- "Which root builds it is each codebase's choice" is gone; nothing is left to the codebase here
  but which courier, which stays the stack document's.
- The driving-adapters row follows the body: "where the root cannot construct it" qualifies the
  registry read; the driven-adapters row is unchanged.
- *Entry* becomes a defined term in the body; the module sense is renamed to "export path"
  (R02-29 closes).
- R03-02, R03-06, R03-19, R03-20, R03-21, R02-11 close with this ticket; review 03's Q13 keeps
  its non-registry markers, Q18 and Q21 are settled here.
