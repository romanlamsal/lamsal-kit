# Citations for the layer table

Every entry of the table at the top of `registry/docs/agents/layers.md`, with the section and the
body sentence it follows, quoted verbatim. Rebuilt by the `summarize-layers` skill.

## domain

### goes here
- the model — The layers: "In the vocabulary of domain-driven design, **domain** is the model"
- rules — Terms: "A *system* is one bounded context: code with its own domain and its own glossary"; The layers: "It takes its rules from the domain."
- schemas — The layers: "A schema is a rule, not a description of one."
- specifications — The layers: "it calls a *specification*: a domain function that takes the candidate and returns the answer"
- the driven ports the rules need — Ports and factories: "**Driven ports this system declares live in its domain.** The rules declare what they need — store this order, send this mail — and driven adapters implement it."

### in → out
- imported by every layer — The layers: "every layer may import it, it imports no layer"
- by a browser and by another system — The layers: "Running on any runtime is what lets a browser and another system import the domain, and importing it loads only the domain."
- imports no layer — The layers: "every layer may import it, it imports no layer"
- other domain modules — The layers: "**"Imports no layer" is about this system's modules, not about packages.**"
- the common library's ports — The layers: "This holds through imports: a common-library module that imports `node:async_hooks` brings the runtime with it." (implies the import; no sentence grants it outright: candidate finding)
- a shared kernel — Other systems: "**Shared kernel.** Model two systems share, such as `Money`, goes in a module both import and neither changes alone."
- a conformed system's published language — Other systems: "its terms, schemas and errors are used as they are, in any layer that may import a domain"
- pure libraries — The layers: "A validation library cannot — it computes from its arguments and returns — so it is allowed, and so is any other library of the same shape."
- reaches nothing; computes from its arguments — The layers: "The test for a package in the domain is whether calling it can reach outside the process"; "it computes from its arguments and returns"

### rules
- runs on any runtime — The layers: "**The domain runs on any runtime.**"
- a package that can reach outside the process stays behind a port — The layers: "a store client, an HTTP client, a mailer SDK, `node:fs` and a clock all can, so they stay behind ports"
- a schema is a rule, and types are inferred from it — The layers: "A schema is a rule, not a description of one."; "Types are inferred from it."
- refers to another aggregate and to another system's data by id — The layers: "**An aggregate refers to another aggregate, and to another system's data, by id.**"
- declares the driven ports and names no use case — Ports and factories: "**Driven ports this system declares live in its domain.**"; "A use case is not a domain concept, so the domain never learns the name of one."
- its schemas are the published language, by default — Other systems: "**The published language is the domain's own schemas, by default.**"
- tested directly — Tests: "**Test the domain directly.**"

### read
- The layers, Ports and factories, Other systems, Tests

## service

### goes here
- the application layer — The layers: "**service** is the application layer"
- use cases — The layers table is the only place that said it; Terms: "A *driving port* is the interface to a use case — the way in, something a controller calls."; Transactions: "Khononov's application service is the transaction."
- the driving ports beside them — Ports and factories: "**Driving ports live beside the service that satisfies them.**"

### in → out
- in through its driving port — Terms: "A *driving port* is the interface to a use case — the way in, something a controller calls."
- called by a driving adapter or by another system — Terms: "a *driving adapter* calls a driving port"; Other systems: "A consumer reaches B's service without passing B's controllers"
- out through the driven ports it received — Ports and factories: "**A service is a factory.** It takes its dependencies as arguments and returns its driving port."
- repositories, a mailer — Terms: "A *driven port* is something the code needs from outside — the way out: store an aggregate, send a mail, put a file somewhere."
- another system's driving port — Other systems: "To B, `Pricing` is the way in; to A's service it is a dependency it receives — a way out, like a mailer."

### rules
- a factory: takes its dependencies, returns its driving port, constructs nothing — Ports and factories: "**A service is a factory.** It takes its dependencies as arguments and returns its driving port. Nothing inside it constructs anything."
- writes that must land together share one transaction, which stays inside its system — Transactions: "**Writes that must land together share one transaction, and the transaction stays inside its system**"
- a change to another system's data is an outbox message, or a call after the commit — Transactions: "**Does it change data another system owns — a third party's included, such as a mail sent or a payment created?** → **Outbox, required.**"; "Where the use case's caller needs the other system's answer in its response, call the other system instead, once the transaction has committed"
- reads another system's data through its open host service, or a copy — Transactions: "**Does it read data another system owns?** → **Call the owner's open host service.** If it offers no fitting read, keep a copy in this system, updated by the owner's messages."
- calls no service of its system — Transactions: "A service does not call another service of its system: the call is a second transaction, and the outbox is the one that retries."
- its driving port takes its caller, and authorization lives here or in the domain — Other systems: "**A driving port another system calls takes its caller as an argument.**"; "B's authorization lives in its service or domain"
- only forwarding to a repository is correct — When to leave it alone: "**A service that only forwards to its repository is correct here**"
- tested against fakes — Tests: "**Test services and driving adapters against fakes.**"

### read
- Ports and factories, Other systems, Transactions, Tests, When to leave it alone

## driven adapters

### goes here
- implementations of this system's driven ports — Terms: "a *driven adapter* implements a driven port"
- a repository over one aggregate — Terms: "a *repository* is a driven port over one aggregate's storage, and its adapter is a driven adapter like a mailer's"
- a mailer — Terms: "and its adapter is a driven adapter like a mailer's"
- a clock — The layers: "a store client, an HTTP client, a mailer SDK, `node:fs` and a clock all can, so they stay behind ports"
- blob storage — Terms: "store an aggregate, send a mail, put a file somewhere"
- another system behind an anti-corruption layer — Other systems: "**Anti-corruption layer.** This system's domain declares a driven port in its own terms; a driven adapter implements it by calling the other system's driving port and translating."

### in → out
- implements a driven port the domain declared — Ports and factories: "The rules declare what they need — store this order, send this mail — and driven adapters implement it."
- the outside: a store, a mailer, a product's instance, another system's driving port — Tests: "A driven adapter's entire job is to talk to something external"; Products: "an adapter receives a function that returns the instance, and calls it only when it does work"; Other systems: "a driven adapter implements it by calling the other system's driving port and translating"

### rules
- a repository method joins the caller's transaction and opens nothing — 5. Did one transaction quietly become several?: "A repository method joins the caller's transaction and opens nothing."
- imports what is static and receives what is built, a product's instance late-bound — Ports and factories: "**An adapter imports what is static and receives what is built.**"; Products: "Assembly breaks it by late binding: an adapter receives a function that returns the instance, and calls it only when it does work."
- imports no service (question 6) — 6. Does a driven adapter import a service?: "It means a use case is parked in a driven adapter."
- behind an anti-corruption layer it translates, and a translation that changes nothing is conformist (question 8) — Other systems: "a driven adapter implements it by calling the other system's driving port and translating"; 8. Does the boundary match the relationship?: "A translation that changes nothing is not an anti-corruption layer; conform instead."
- a read across its system's aggregates is a reporting read — When to leave it alone: "**A read across its system's aggregates in a driven adapter is a reporting read, not a use case**, as long as it writes nothing."
- integration-tested by design, with one contract suite per port run against the fake and the real adapter — Tests: "**Driven adapters are integration-tested by design.**"; "Write one suite per driven port, against the port rather than any implementation, and run it twice: against the fake, and against the real adapter."

### read
- Terms, Ports and factories, Other systems, Products, Tests, When to leave it alone

## driving adapters

### goes here
- entry points: controllers — Terms: "A *controller* is a driving adapter"
- hooks — Products: "**A product's hooks and scheduled tasks are driving adapters**"
- scheduled tasks — Terms: "a scheduled task is a driving adapter"
- message handlers — Transactions: "The receiver handles it in its own transaction, through a driving adapter that calls one service."
- their validators — Terms: "it resolves the caller (a session, a signature, a key), validates, acts through one service, and returns"
- inbound translation — Other systems: "the driving adapter that receives the other system's call translates it into this system's terms before it calls a service"

### in → out
- called by the outside — Terms: "Who starts the call decides which: the outside starts it, driving; this system starts it, driven."
- a request, a webhook, a product's hook, the clock, the relay — The layers: "Where its caller may deliver more than once — a relay, a webhook, a product's hook"; Terms: "A clock is outside: a scheduled task is a driving adapter."
- one service to act, a specification to ask — The layers: "**A driving adapter acts through one service and asks through the domain.**"
- its only door to the store is a service — When to leave it alone: "A controller's only door is a service"

### rules
- acts through one service and asks through the domain — The layers: "**A driving adapter acts through one service and asks through the domain.**"
- receives its service from the root, as an argument or from the registry or the framework's context, and never imports assembly — Ports and factories: "**A driving adapter receives its service from the root.**"; "It never imports assembly."
- a repeat changes nothing — The layers: "**Deliver the same thing again, however late.** Handling it a second time changes nothing."
- an early arrival is not a repeat — The layers: "**Deliver out of order.** A delivery about something this system has not recorded yet is not a repeat."
- where the caller stops retrying it records before anything can fail — The layers: "a handler of one records what it was given, through its one service, before anything that can fail"
- a product's hook answers in order: this system called → nothing, it asks → a specification, it acts → one service as Products orders — Products: "For a hook, answer in order:"; "**The product's caller is this system** → this system started the call, so it is not a driving call: the hook does nothing"; "**It asks**, such as whether a change is valid → a specification answers it"; "**It acts** → answer in order:"
- translates another system's call into this system's terms before it calls a service — Other systems: "the driving adapter that receives the other system's call translates it into this system's terms before it calls a service"
- puts per-request ambient values in — Ports and factories: "A driving adapter puts it in; services and adapters read it; the domain takes arguments."
- tested against fakes, which fill the registry — Tests: "**Test services and driving adapters against fakes.** Each receives ports — a driving adapter the framework collects reads them from the registry or the framework's context (Ports and factories), which the test fills with fakes"

### read
- Terms, The layers, Ports and factories, Other systems, Products, Tests

## Leads with no row

- "**Preconditions.**" — binds the store, not a layer.
- "**Terms.**" — defines the rows; its sentences are cited above.
- "**Assembly is not a layer.**" — Ports and factories: not a layer, by its own words; the root is where the rows meet.
- "**A driving adapter receives its service from the root.**" — in the driving-adapters row; its root half is assembly.
- "**Atomicity crosses ports through a transaction port.**" — binds service and repository together; the service row's transaction entry and the driven row's "joins the caller's transaction" carry both halves.
- "**A value may be held ambient when no use case or domain function decides by it**" — cross-cutting; the driving-adapters row carries its per-request half.
- "**A system offers an open host service: …**" — Other systems: binds the system's exports, not a layer.
- "**One system's driving port is the other's driven port.**" — cited under the service row's `in → out`; no entry of its own, as it names a relationship.
- "**How two systems relate is chosen per relationship, in the terms of DDD's context map.**", "**Conformist.**", "**Shared kernel.**" — relationship choices; their layer halves are cited above (conformist import, shared kernel import, anti-corruption adapter).
- "**The consuming system's build function builds the other system, by default; escalate when that stops being true.**" — assembly.
- "**A product with a model of its own — a CMS, an auth library — is another system**" — defines a system.
- "**Where this system stores an aggregate in a product, the product's screens may read it; a field this system owns is read-only there.**" — binds the product's screens; the action it names is a driving adapter already in the row.
- "**A product that calls back is a cycle by design.**" — assembly; its late binding is cited in the driven-adapters row.
- Products steps 1–4 and "**The product has committed the change**" etc. — the hook entry points at Products; the order of answers is the section's.
- Transactions rule 3 "**Does it write several aggregates of this system?**" and 4 "**Otherwise**" — the service row's "one transaction" entry carries them; rule 3's outbox tells are the section's.
- "**An outbox, wherever it is used:**" — binds the relay (common-library plumbing) and the receiver; the receiver's handler is in the driving-adapters row.
- Checklist "**In a diff:**" leads — tells for the rulings above, not rulings.
- "**An integration test is one that uses a real external dependency**", "**The default suite runs on fakes.**", "**What makes a good test here**" — cross-cutting test rules.
- "**Keep the fakes honest with contract tests.**" — cited under the driven-adapters row's test entry.
- "**A service passing its transaction context into another repository of its system, in the same store, is the design working.**" — the service row's transaction entry.
- "**A use case touching three aggregates and naming three invalidations is correct**" — `components.md`'s concern.
- "**A port with one implementation is not premature.**", "**Several systems each faking the same port can be correct.**" — ports and fakes, not a layer.
- "**Using a conformed system's terms directly is the design working**" — any layer; cited under the domain row's conformist import.
- "**A service calling another system's driving port is calling a port**" — the service row's `in → out` already names it.
- "**A system's build function building another system itself is correct**", "**Not everything gets a layer.**" — assembly and the things outside the layers.
- "**Another system catching up a moment later is the design working.**" — between systems.
- "**The checklist is a prompt to look.**" — the checklist.

## Entries dropped

From the table as it stood before this pass (`what it is` / `may import` / `does`):

- "composes nothing" (driven adapters, does) — no sentence; review-02 R02-10 found it unmarked. Whether a cache over a repository is allowed is a decision for a ticket, not for the table.
- "a cache" (driven adapters, what it is) — no sentence says a cache is a driven port; spec-01's ruling never landed (review-02 R02-22).
- "a store client, a product's instance and its types, an HTTP client" (driven adapters, may import) — kinds; the sentence is "An adapter imports what is static and receives what is built", now an entry.
- "services, domain and the registry" (driving adapters, may import) — the column is replaced; the service arrives, it is not imported ("A driving adapter receives its service from the root."), and the registry read is an entry.
- "the published language and driving-port types of a system it conforms to" (service, may import) — column replaced; Other systems' export list and the Conformist bullet carry it.
- "it receives ports that resolve or translate its caller, as it receives its service" (driving adapters, may import) — column replaced; Terms' "resolves the caller" and the translation entry carry it.
- "reaches the store only through a service" (driving adapters, does) — reworded to "its only door to the store is a service", the sentence When to leave it alone has; review-02 R02-19's session resolver is that finding's.
