# Assembly is one root per entry

**Status:** closed (800a7b3)

**Kind:** contradiction, and a gap a fresh agent fills wrongly · **Touches:** Ports and factories
(the Assembly paragraph), Other systems (the export list, the escalation paragraph), When to leave
it alone · **Related:** `08-assembly-per-process.md` (superseded in part), `16-relay-wiring.md`
(already allows more than one assembly), `19-repository-as-pattern.md` (renamed controllers to
driving adapters), `review-01.md` R01-60 (the trigger), R01-58

Grilled and decided on 2026-10-20; the `## Decision` section is the ruling and the Resolution
is the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Ticket 08 wrote "Assembly is not a layer. One module per process builds the adapters, calls the
factories, and hands the result to the controllers." At the time the consuming repositories were
single fullstack web apps with one `assembly.ts` exporting an object; one module per process was
exactly right. Since then the document gained several systems per repository, products, the
relay, the common library and exported build functions.

Ticket 16's decision already states: "The handler's assembly may differ from the one that builds
the system's open host service: shop's assembly builds billing's open host service, while
billing's handler may run wherever the relay does."

## Problem

R01-60, found by a fresh agent placing the assembly scenario (confidence 4): "one module per
process" (Assembly) against "the consuming system's assembly builds the other system" and "a
system's assembly building another system" (Other systems, When to leave it alone). Three systems
in one process cannot have both one module per process and one assembly per system; the document
never says what "a system's assembly" refers to.

A second gap, the author's: the document says "a service is a factory" and assembly "hands the
result to the controllers", but a driving adapter a framework constructs — a TanStack Start
server function, a Payload hook — cannot receive an argument. Nothing says how it gets its
service. An agent either makes the server function a factory with no caller, or imports a
concrete instance and trips question 7.

## Resolution

Assembly has two levels. A **root** per entry builds what that entry runs; a system's **build
function** (the one its export list already names) is that system's assembly. Driving adapters
receive their service from the root, by argument or by importing the root.

### 1. Ports and factories, the Assembly paragraph

Before:

> **Assembly is not a layer.** One module per process builds the adapters, calls the factories and
> the build functions other systems export, and hands the result to the controllers. It is the only
> place that knows both a port and its implementation. Keep it separate from the factories: a
> service module exports only its factory, and assembly holds the instances, so every dependency
> but fixed plumbing (question 7) is one a factory declared.

After:

> **Assembly is not a layer.** Each entry — a server's start, a relay worker, a product's config —
> has one root that builds what that entry runs: it builds the adapters, calls the factories and
> the build functions systems export, and hands the result to its driving adapters. Assembly is
> the only place that knows both a port and its implementation. Keep it separate from the
> factories: a service module exports only its factory, and assembly holds the instances, so every
> dependency but fixed plumbing (question 7) is one a factory declared.
>
> **A driving adapter receives its service from the root**: as an argument where the entry
> constructs the adapter; by importing the root where the framework constructs it, such as a
> server function or a product's hook. That import is the one place a driving adapter imports
> assembly. One root per entry is this document's choice; the sources say only that whoever
> starts the application wires it.

Whether the root builds at import or on first use is the codebase's; the document does not say.
The consuming repositories' `assembly.ts` exporting a built object is the plain case.

### 2. Other systems, the export list, the open-host-service item

Before:

> - a function that takes configuration and builds the open host service, for another system's
>   assembly to call;

After:

> - a function that takes configuration and builds the open host service, for a root or another
>   system's build function to call. That function is the system's assembly;

### 3. Other systems, the escalation paragraph

Before:

> **The consuming system's assembly builds the other system, by default; escalate when that stops
> being true.** A's assembly calls the function B exports to build its open host service, and
> nothing else of A learns how B is built.
> Move that call up into a composition root that wires both systems once, when:
>
> - a second consuming system would build B again, and B holds something that must exist once — a
>   cache, a pool, a subscription;
> - B needs systems of its own, and A would end up assembling B's upstreams;
> - two systems would assemble each other — a cycle in the context map, which usually means a
>   boundary is drawn wrong. A product that calls back is the exception (Products).
>
> Until one of these holds, a root is ceremony.

After:

> **The consuming system's build function builds the other system, by default; escalate when that
> stops being true.** A's build function calls the function B exports to build its open host
> service, and nothing else of A learns how B is built.
> Move that call up into the entry's root, which builds B once and hands it to A's build function,
> when:
>
> - a second consuming system would build B again, and B holds something that must exist once — a
>   cache, a pool, a subscription;
> - B needs systems of its own, and A would end up assembling B's upstreams;
> - two systems would assemble each other — a cycle in the context map, which usually means a
>   boundary is drawn wrong. A product that calls back is the exception (Products).
>
> Until one of these holds, building B inside the root is ceremony.

### 4. When to leave it alone, two bullets

Before: "**A system's assembly building another system itself is correct** until one of the
reasons to escalate holds."
After: "**A system's build function building another system itself is correct** until one of the
reasons to escalate holds."

Before: "… and so do the module that assembles them, a system's exported entries and the common
library."
After: "… and so do the roots that assemble them, a system's exported entries and the common
library."

### Checked, untouched

The export list's handler item ("for the assembly that hands it to the relay", ticket 16) reads
correctly with a root per entry. "Assembly picks their implementations" (ports paragraph);
"assembly's decision: B's service in-process, or an HTTP client" (Other systems); "Assembly breaks
it by late binding" (Products); question 7's "assembly decides which one". The step-5 sweep
confirms these and greps `assembl`, `root`, `controller` across the document and the siblings.

### Housekeeping

- `08-assembly-per-process.md`: footnote under Resolution, "superseded in part by ticket 20: one
  root per entry, not one module per process" (done with this ticket).
- `review-01.md`: R01-60 row "closed (ticket 20)", R01-58 row unchanged.
- `domain.md`, placed-as-fault list: "a server function built as a factory with no caller, or
  importing a service instance from a service module: a driving adapter the framework constructs
  imports the root (ticket 20)".

## Grounding

- Khononov ch. 8 p. 127: "The abstract ports are resolved into concrete adapters in the
  infrastructure layer, either through dependency injection or by bootstrapping." Nothing more.
- Evans ch. 4 p. 54: "The infrastructure layer may also support the pattern of interactions
  between the four layers through an architectural framework." Factories (ch. 6) are for domain
  objects only.
- Cockburn, *Hexagonal Architecture*: the driver constructs the application — "pass the
  repository to use (real or mock) into the constructor of the application itself",
  `new Discounter(RepositoryFactory.getMockRateRepository())`, code "typed in directly … or using
  configuration files and having the SPRING framework generate the equivalent code".
- Vernon *(from memory)*: Spring injection, one application; nothing on several bounded contexts
  in one process.
- Fallback, Fowler *PoEAA*: *Registry* (a well-known object other code reaches to find instances)
  grounds a driving adapter importing the root; *Plugin* grounds configuration linking a port to
  its implementation at a central point.

None places assembly per system or per process. "One root per entry" and "a driving adapter
imports the root" are this document's choices, the second with Fowler behind it; both marked.

## Done when

The four pairs are applied; each new sentence passes the four tests; the sweep finds no sentence
naming one module per process or controllers receiving instances; a fresh agent with only
`layers.md` places at confidence 4–5: three systems in one Node process where shop and billing
both need payment (who builds payment, where); a TanStack Start server function needing shop's
service (what it imports, and whether that is a question-7 fault); a Payload hook needing a
service (same); the relay worker needing billing's handler. Committed per `CLAUDE.md`; status set
here and in `review-01.md`.

## Decision

**Assembly is one root per entry, not one module per process.** An entry is where a process
starts running this code or where a framework loads it: a server's start, a relay worker, a
product's config. Each root builds what its entry runs. Ticket 16 had already allowed the
handler's assembly to differ from the open host service's; this names the unit. The sources say
only that whoever starts the application wires it, so the choice is marked.

**A system's assembly is its build function.** The export list's "function that takes
configuration and builds the open host service" was always that; the document never said so with
the word. Derivation test: reworded, not added. "A's assembly builds B" becomes "A's build
function builds B"; the escalation rule and its three reasons stand unchanged, with the root as
the place escalated to.

**A driving adapter receives its service from the root, by argument or by import.**[^21] The
document never said driving adapters are factories; only services are. Where the framework
constructs the adapter, it imports the root, and that is the one place a driving adapter imports
assembly. Question 7 stays sharp: its fault is a *service module* exporting a ready-made instance
next to its factory; the root is not a service module. Fowler's Registry is the fallback
grounding; marked.

**Lazy building is not part of the rule.** Considered and dropped: the consuming repositories
export an eagerly built object and it works; the Payload cycle is already broken at the adapter
by late binding of the instance; import-time side effects and load order are the stack
document's.

**Considered options**

- Keep one module per process and let it be "split by system": leaves "a system's assembly"
  undefined and contradicts ticket 16.
- One assembly per system, each a module, with the process module calling them: makes every
  system's assembly a root already, so the escalation rule has nothing to escalate from, and
  "A's assembly builds B" becomes false.
- A registry object as a named concept in `layers.md`: a new term for what "import the root"
  already says; Fowler stays in the grounding only.

**Consequences**

- Ticket 08's sentence is superseded in part; its bootstrap-is-the-stack-document ruling stands.
- Two roots in one process (a web server and a product's config loaded by it) are the escalation
  rule's first reason applied inside one process: the server's root builds the shared system
  once, the product's config reaches it. Nothing new is needed; the placement test should show
  an agent deriving it.
- Ticket 19's rename of controllers to driving adapters is assumed in every "after".

[^21]: The "by import" half is superseded by `21-service-registry.md`: a driving adapter reads the
    registry or the framework's context, and never imports assembly.
