# Review 02: `layers.md` after tickets 19 and 20

**Reviewed:** `registry/docs/agents/layers.md` at `67bd22b` (branch `docs/layers-refinement`),
with `docs/extending-layers.md`, `domain.md`, `spec-01.md`, `review-01.md`, tickets 01–20,
`open-questions.md`, the sibling docs `components.md` and `tanstack-start.md`, and the books
(Khononov, Evans, Cockburn's page) as context.
**Date:** 2026-10-21
**Verdict:** not mergeable as is, but closer than at review 01. Every ticket decision and every
review-01 ruling has a carrying sentence; nothing states the opposite of a ticket. The six S1s are
all of one kind: a table row or a Terms definition that the body text has since outgrown. Two of
them are sweeps ticket 20 did not run (the driving-adapters row, the marker for "imports the
root"). Ticket 19's own acceptance target regressed: the Payload price adapter, placed at 4–5
when the ticket closed, placed at 3 in this round's cold read.

Findings are anchored by quoted text, not line numbers; line numbers shifted twice since review 01.

## Method

Five independent passes, then merged:

| pass | reader | input | purpose |
| --- | --- | --- | --- |
| R | reviewer (this session) | `layers.md`, siblings, tickets 19–20, review 01 | consistency after the four-layer rename and the root |
| P | fresh Opus agent | `layers.md` only | place every `domain.md` scenario and the placed-as-fault list, plus four scenarios review 01 never placed; confidence 1–5 and what it had to guess |
| A | fresh Opus agent | `layers.md` only | adversarial read: contradictions, non-sequiturs, term drift, unmarked choices, checklist tells that fire wrongly |
| V | Opus agent | everything | per ticket 01–20 and review-01 ruling: a carrying sentence in `layers.md`; status and hash agreement; sibling docs |
| S | Opus agent | `layers.md` + book extracts | source fidelity of every book term and every marker; choices stricter or looser than the books and unmarked |

**Hits** = how many of the five passes found the finding independently. Pass P's confidence is
quoted where it scored a scenario. Pass P read nothing but `layers.md`; its confidence is the
acceptance test ticket 19 and 20 used.

Pass P confidence, all 28 scenarios (numbering in `pass-P` order: catalog 1–7, shop 8–11,
payment 12–14, billing 15–16, fulfillment 17–19, common library 20–21, cross-cutting 22–24, new
25–28):

| confidence | scenarios |
| --- | --- |
| 5 | 3, 5, 12, 25 (who builds payment) |
| 4 | 1, 8, 10, 11 (write), 13, 15, 16, 18, 19, 20, 27, 28, 9 (branching) |
| 3 | 2 (Payload price adapter), 4 (hook tree on an editor's price change), 7 (config cycle), 14, 17, 21, 22, 26 (server function and hook in one process), 11 (read), 25 (what a build function receives) |
| 2 | 6 (Payload config as second constructor), 23 (cache revalidation), 9 (which store) |
| 1 | 24 (`/health`, `/metrics`) |

## Findings

Severity: **S1** contradiction or wrong instruction; **S2** gap a fresh agent fills wrongly;
**S3** wording, stale reference, unmarked choice; **S4** folder housekeeping and grounding.

### S1 — contradictions

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R02-01 | 1 (A) | Terms, "acts through one service"; Q2 | "When the answer needs data the adapter does not hold, a service of its system loads the data and asks the specification" sanctions an ask-then-act pair: the adapter calls a service to ask, then a service to act. "To act, it calls one service function; needing two is the signal that a use case has grown inside it" and Q2's tell fire on exactly that. It also invites a check-then-act race. | "When the answer needs data the adapter does not hold, the adapter does not ask: the service that acts loads the data, asks the specification, and refuses. A service that only answers a question — for a screen that hides a button — is called instead of acting, never before it." |
| R02-02 | 1 (A) | The layers, service and driving-adapter rows; Q7; ambient paragraph | Service may import "domain, the common library's ports, and …"; driving adapters "services and domain". Q7 lets "a logger or a tracer … be a ready-made instance", the ambient paragraph has "A driving adapter puts it in; services and adapters read it", and Terms says the common library is "plumbing every system may import". A ready-made logger and a request-scoped registry are instances, not ports; the table forbids what three paragraphs sanction. | service row: "domain, the common library's ports and its fixed plumbing (question 7), and …"; driving-adapters row: see R02-06 |
| R02-03 | 3 (A, V, P) | The layers, driven-adapters row; Products, cycle bullet; `domain.md` | Row: may import "a product's instance and its types". Products: "an adapter receives a function that returns the instance, and calls it only when it does work". With ticket 20 the import is the cycle late binding exists to break: hook imports root, root builds the adapter, adapter imports the instance, instance needs the config, config imports the hooks. P, confidence 3: "nothing says how that ES-module cycle is avoided". `domain.md`'s ticket-19 entry says "imports Payload's instance". | row: "a product's types, and its instance or a function that returns it (Products)"; `domain.md`: "imports Payload's types and receives its instance, late-bound where Payload calls back" |
| R02-04 | 2 (A, P) | Terms, "Stop delivering"; Products, hook step 4 | "a product may not run a hook again, so a handler of one records what it was given, through its one service, before anything that can fail" vs step 4 "the hook hands its work, in-process, to a handler that first checks the change through the product" and "A hand-off … is lost when the process stops first … reconciliation repairs it". A step-4 hook is a handler of a product's hook; the general rule requires a durable record, step 4 accepts loss. P guessed "who triggers the step-4 handler again on failure". | step 4: "the hook records the change as pending, through one service, in this system's own transaction; a handler checks it through the product before acting" — or qualify the general rule: "… before anything that can fail, except where the hook runs before the product commits (Products, step 4)" |
| R02-05 | 1 (A) | Terms, reconciliation; Transactions rule 1 | Reconciliation "compares what this system recorded with what another system holds, and repairs this system's record". Rule 1: "Where a third party cannot, a repeat may duplicate … A duplicate is repaired by the saga or by reconciliation." A duplicate payment is the third party's record; by its definition reconciliation cannot repair it. | rule 1: "A duplicate is undone by a compensating call, a saga step, which reconciliation starts when it finds one." |
| R02-06 | 3 (A, V, R) | The layers, driving-adapters row vs Ports and factories | Row: may import "services and domain; it receives ports that resolve or translate its caller, as it receives its service". Body: "by importing the root where the framework constructs it … That import is the one place a driving adapter imports assembly"; ACL: "The other system's schema and the translation live in that adapter, or in a module both adapters share". Ticket 20's sweep missed the row; "a module both adapters share" has no layer. | closed (ticket 21, 525c559): row gains "the registry"; the body's import is gone, so the row no longer forbids it. The other additions and the shared module's layer stay open under R02-02 |

### S2 — gaps a fresh agent fills wrongly

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R02-07 | 2 (A, V) | Q2 tell; Other systems, ACL bullet | "resolving its caller and asking a specification are not growth" exempts neither inbound translation ("the driving adapter that receives the other system's call translates it into this system's terms before it calls a service") nor step 4's hand-off. R01-37 proposed "translating and asking"; translating was dropped in `d272715` with no note. | "resolving its caller, translating its input (Other systems) and asking a specification are not growth" |
| R02-08 | 2 (A, R) | Tests | "Test services and driving adapters against fakes. Each receives ports, so a test hands it fakes." A server function or product hook that imports the root receives nothing; a test cannot hand it fakes without module mocking. | closed (ticket 21, 525c559): a framework-constructed adapter reads its ports from the registry, which the test fills with fakes; proposed two-piece shape dropped |
| R02-09 | 2 (A, P) | Outbox bullets, first | "A message carries … an id, and the version of the aggregate that wrote it; the receiver's aggregate records the last version it handled." A version advances on every write, not only on writes that emit a message, so a receiver at 3 seeing 5 cannot tell an early arrival from a write that sent nothing; a receiver fed by several aggregates has no single last version. P: "Stripe and the 3PL have no 'version of the aggregate that wrote it', so their ordering is a guess." | state the property, not the mechanism: "A message carries what its receiver needs to recognise a repeat and to order it among its writer's messages: an id, and a per-writer sequence; how, each codebase chooses. A delivery not from an outbox carries what the sender gives." |
| R02-10 | 1 (A) | driven-adapters row; Q2 tell | "composes nothing" and "a driven adapter that gained an import of another driven adapter" forbid a cache that decorates a repository and an anti-corruption adapter built on an HTTP-client adapter ("an HTTP client, a driven adapter of A"). Unmarked. | decide (question 6 below). Proposal: "A driven adapter may receive another driven adapter, a cache over a repository or a client; it never imports one." Q2 tell: "a driven adapter that gained an import of another driven adapter of this system's aggregates, or of a service" |
| R02-11 | 2 (A, P) | When to leave it alone; Transactions rule 1 | "A service calling another system's driving port is calling a port, not a use case nested in another" is unqualified. Rule 1 makes a write to another system an outbox message or a post-commit call. P placed fault (b) as "clear for writes; for a read inside `tx.run` I had to infer it", confidence 3. | append ", for a read; a write goes through the outbox or after the commit (Transactions, rule 1), never inside `run`" |
| R02-12 | 2 (A, R) | Transactions rule 1 | "a handler of this system calls it when the message arrives" and "a handler or scheduled task of this system repeats the call" read as the driving adapter calling the third party itself; the row says it "reaches the store only through a service". In the post-commit path there is no message, so "a handler" has nothing to handle. | "a message handler of this system calls one service, which calls the third party's port"; "a scheduled task of this system calls the service that repeats the call" |
| R02-13 | 1 (A) | Other systems, published language; outbox bullets | "a message only this system handles is private" and "one system's process manager … sends commands" never say whose schema a command is: the sender's published language (the handler conforms to its caller), the handler's, or private. | "A command belongs to the published language of the system that handles it; the sender imports it like a driving-port type. An event belongs to the system that publishes it." |
| R02-14 | 3 (A, P, V) | Terms, "Deliver out of order"; outbox bullets | "A delivery about something this system has not recorded yet is not a repeat" says what not to do, not when a recorded early arrival is applied. P, confidence 3 on scenarios 14 and 17: "fail-and-retry vs record-early (doc permits failing for a relay, never says which to prefer)". V: ticket 11's "record or fail-to-retry is the codebase's choice" never landed as a positive sentence. | "What the handler does with it — fail so the caller retries, or record it and apply it when the delivery it waited for arrives — is each codebase's choice; a relay allows both, a webhook allows only the second." |
| R02-15 | 1 (A) | Other systems, shared kernel | "goes in a module both import and neither changes alone" never says the module obeys the domain's rules, what it may import, or where it sits; "Not everything gets a layer" omits it. | "A shared kernel is domain code: pure, any runtime, importing neither system." |
| R02-16 | 2 (A, P) | Ports and factories, "One process may load two entries"; Products | "what both need is built once by one root and imported by the other, as the reasons to escalate (Other systems) decide" — the escalation reasons choose root vs build function, not which of two roots. With a callback product the two roots import each other (server root imports the product's instance, product config imports hooks, hooks import the server root); late binding inside an adapter does not break a cycle between roots. P, confidence 3: "which root builds shop (server or Payload-config)". | closed (ticket 21, 525c559): "put in the registry by one root and read by the other"; neither root imports the other. Which root builds stays each codebase's; proposed fix dropped |
| R02-17 | 1 (A) | Products, hook step 2 | "which touches no row the product's transaction holds" — a profile row with a foreign key to the product's uncommitted user row blocks on the key check; agents add foreign keys by default. | append "including through a foreign key: it refers to the product's record by id only" |
| R02-18 | 1 (A) | Terms, specification; Other systems, "takes its caller as an argument" | A controller asks "may this caller do this" via a specification, and "B's authorization lives in its service or domain". An agent puts authorization in the controller; once the port is exposed to another system it is bypassed. | "Authorization is the service's: every driving port takes its caller and refuses there. A controller resolves the caller, and asks a specification only to shape what it shows." |
| R02-19 | 1 (A) | driving-adapters row | "reaches the store only through a service" vs "it receives ports that resolve or translate its caller": a session resolver reads a session store with no service. | "writes only through a service; reads through a service or through a port that resolves its caller" |
| R02-20 | 1 (P) | Products, hook steps 1 and 3 | "The product has committed the change" vs "The hook runs inside the product's transaction": nothing says how a hook tells which it is. P, confidence 3: "the doc never says whether a hook running inside `req.transactionID` counts as committed, or whether it falls to step 3 or step 4." | one clause: "which step applies is a property of the hook the product offers, read from its documentation, not of the change" |
| R02-21 | 1 (P) | driven-adapters row, "does" | "an adapter over this system's aggregate serves one aggregate for writes, composes nothing, and joins the caller's transaction; an adapter over another system translates" — for an owned aggregate stored in a product both halves apply. P, confidence 3 (ticket 19's acceptance target was 4–5): "whether one adapter may do both roles … how 'joins the caller's transaction' works when the caller's tx is a Drizzle tx and the write goes through Payload". | "An adapter over this system's aggregate that a product stores is both: a repository to its service, a translator toward the product; it joins the caller's transaction where the store is one (Preconditions), and is its own store otherwise (rule 3)." |
| R02-22 | 1 (P) | When to leave it alone | `/health`, `/metrics` and cache revalidation: P placed them at 1 and 2. Spec 01 ruled them out ("a service that only forwards is already correct here"; "a cache is a driven port; the writing use case invalidates it"), but `layers.md` carries neither; "reaches the store only through a service" pushes a database ping through a service. | one bullet: "**An endpoint that reports on the process — health, metrics — is not a use case**; it reaches what it pings directly, and sits outside these layers." Cache revalidation: "a cache is a driven port; the use case that wrote invalidates it" |
| R02-23 | 1 (P) | outbox bullets; rule 1 | "Handling the same message twice changes nothing the second time" vs the mail provider, which cannot dedupe; only rule 1's exception admits "Where a third party cannot, a repeat may duplicate". P, confidence 4 with the guess: "neither says what a mail handler should do". | in the outbox bullet: "where the third party it calls cannot recognise a repeat, the handler records the call before making it, and a repeat finds the record" |
| R02-24 | 1 (P) | Other systems, export list | "a function that takes configuration and builds the open host service" — P, confidence 3: "Is an already-built `Payment` part of 'configuration'?" The escalation paragraph "hands it to A's build function" implies yes; the export item does not say. | export item: "a function that takes configuration — and the systems the root built for it — and builds the open host service" |
| R02-25 | 1 (A) | Tests, contract tests | "the receiving system writes the suite" reads as the system receiving the calls, the provider; the intent is the consumer. | "the consuming system — the one that receives the port as a dependency — writes the suite" |
| R02-26 | 1 (A) | Q9 tell | "a field renamed, removed, made required, or narrowed" misses a field added as required (old messages lack it) and a widened enum read by older handlers; both are the faults the body describes. | "renamed, removed, added or made required, narrowed, or widened to a value an older handler does not know" |
| R02-27 | 1 (A) | Q8 tell | "a message schema copied field for field from the system that publishes it" fires on a third-party webhook schema that the ACL bullet puts in the driving adapter, field for field by necessity. | "Or, in this domain or a service, a message schema copied field for field …" |
| R02-28 | 1 (P) | Q3 | Payload's collection config re-declaring shop's fields: spec 01 ruled it out ("the store schema is the store's; the repository maps it"), but `layers.md` carries no sentence. P, confidence 2: "whether a schema declaration counts as a 'constructor'". | Q3: "A store's own schema — an ORM table, a product's collection config — is not a second constructor; the repository maps it to the domain's." |

### S3 — wording, stale references, unmarked choices

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R02-29 | 2 (A, R) | throughout | "entry" in three senses: the process entry with a root ("Each entry — a server's start, a relay worker, a product's config"), a package entry point ("an entry that loads only the domain", "a system's exported entries"), and driving adapters as "entry points". | keep *entry* for the process; "export path" for package files; row: "the ways in: controllers, hooks, …" |
| R02-30 | 1 (A) | Other systems, export paragraph | "the port types are exported type-only, or the entry loads the service that declares them" — the "or" sanctions what the sentence forbids. | "the port types are exported type-only, so the entry still loads only the domain" |
| R02-31 | 1 (A) | Q7 tell | "constructed inside a service body or a factory body" fires on a build function, which constructs adapters by design. | "inside a service factory's body" |
| R02-32 | 1 (A) | Q5 tell | "a loop that calls a write per item" fires on a loop of repository calls inside one `run`; the body's fault is "a loop that calls `run` per item". | "a loop that opens a transaction per item" |
| R02-33 | 1 (A) | Q4 tell | "writes two tables" counts tables; the rule counts aggregates. An order over `orders` and `order_lines` fires falsely. | "writes two aggregates" |
| R02-34 | 1 (A) | Q6 | Q2's tell already contains "or of a service"; Q6 "seen from the other end" is the same end. A driven adapter importing another system's driving-port type, which lives "beside the service", trips "a service import". | merge into Q2, or Q6 tell: "an import of this system's service" |
| R02-35 | 1 (A) | Q1 | Heading "Does a service write a table itself?" but the tell covers a query. "The context is opaque in the domain" leaves it a store client in the service, which is what lets `ctx.insert` compile. | heading "Does a service touch a table itself?"; "opaque to the service and the domain" |
| R02-36 | 2 (A, S) | Ports and factories, first paragraph | "The rules declare what they need — store this order, send this mail" — rules call no port; services do. Khononov puts ports in the business logic layer (p. 127); Evans keeps the mail interface "in the infrastructure layer" (pp. 55, 76). Unmarked. | "Driven ports live in the domain, named in its terms, though services are what call them: Khononov's placement; Evans keeps such interfaces in infrastructure." |
| R02-37 | 2 (A, S) | Other systems, first sentence; Conformist bullet | "A system offers an open host service" (every system) vs "The default for an open host — a system that publishes its model on purpose" (some). The gloss matches Evans (p. 263, consumers "coupled to the model of the open host") and contradicts Khononov (p. 55, the supplier "decouples the implementation model from the public interface"). R01-47 kept "open host" consciously, without a note. | "Every system's offer — its driving ports and published language — is its open host service here; Evans reserves the term for a protocol built for many consumers. An open host in Evans's sense publishes its model; Khononov's publishes a separate language." |
| R02-38 | 1 (A) | Products, hook step 3 | "the outbox is in a store this system's transaction port reaches through that transaction" is circular; "to this system's outbox or the product's" — a product's queue has the product's relay, not "common-library plumbing", and no port is named for writing it (Q1 fires on `ctx.insert(productJobs)`). | "(the product hands the hook its transaction, and this system's transaction port accepts it as a context) … writes only a message, through the outbox port: to this system's outbox, or to an outbox adapter over the product's queue, whose relay is then the product's" |
| R02-39 | 2 (A, S) | Terms; Transactions rule 3; Products | Unmarked choices stricter than the books: "acts through one service … needing two is the signal" (Evans p. 53 and Khononov p. 122 imply delegation, no count); "A service does not call another service of its system" (sources silent; Khononov p. 86 fn. 7 supports the reasoning); "Steps 2 and 3 are this document's choice" leaves step 4 unmarked though no source covers it either. | mark each in one clause; "Steps 2 to 4 are this document's choice" |
| R02-40 | 2 (A, S) | Terms, sources sentence | "The sources are Evans, Vernon, Khononov and Cockburn" — the document cites Fowler ("Fowler's registry"), Richardson ("Richardson's sense") and leans on Freeman & Pryce for fakes. | "…and Cockburn; where they are silent, Fowler, Richardson and Freeman & Pryce, named where used." |
| R02-41 | 3 (A, V, R) | Terms | "A clock is outside: a scheduled task is a driving adapter" beside the driven-adapters row listing "a clock". "a scheduled task is a driving adapter" is stated three times (ports paragraph; reconciliation paragraph twice). "their validators" in the driving-adapters row, though validation is a domain schema. "the caller may do three things. Each is a fault the adapter prevents" — deliveries are not faults. | "A timer that starts work is outside: a scheduled task is a driving adapter; a clock read for the time is a driven port." Drop the Reconciliation repeat. Drop "their validators". "Each causes a fault unless the adapter prevents it." |
| R02-42 | 1 (A) | The layers, after the table | "The arrow runs one way — driving adapter → service → driven adapter → the outside" right after the import table: a service never imports a driven adapter. | "Calls run one way …; imports point at the domain and at ports, never at an adapter." |
| R02-43 | 1 (A) | Transactions rule 2 | "In this case, the owner publishes" instructs another system; a third party may not. | "the owner must publish; where it cannot, a scheduled task of this system refreshes the copy" |
| R02-44 | 1 (A) | Other systems, export list | "a fake of its driving ports" — hand-written, or the build function wired with fake driven adapters? | "a fake: its build function wired with its own driven-port fakes, or a hand-written one that passes the consumers' contract suites" |
| R02-45 | 2 (V, R) | When to leave it alone | "not a breach of one mutation per use case (`components.md`)" — `components.md` never had the phrase, at this or its first commit. R01-46's pointer points at nothing. | drop the parenthesis, or "not a breach of one write per use case" |
| R02-46 | 2 (V, R) | `components.md` Terms | "A *controller* is a boundary adapter: it receives a request, resolves what is needed, calls into one thing, and returns. It holds no rules of its own." `layers.md` claims it "applies the same role", but was reworded by R01-36 to "acts through one service" and to "driving adapter". | "A *controller* is a driving adapter (`layers.md`): it resolves what is needed, reads or acts through one thing, and returns. It holds no rules of its own." Keep the writes difference. |
| R02-47 | 1 (V) | Ports and factories | "One root per entry is this document's choice" — ticket 20's Grounding says both "one root per entry" and "a driving adapter imports the root" are choices, "both marked". Only the first is. | closed (ticket 21, 525c559): "One root per entry, and the registry, are this document's choices"; the import is gone, so its marker is not needed |
| R02-48 | 1 (V) | Other systems, export list, handler item | "for the assembly that hands it to the relay" — after ticket 20 "assembly" is a root or a build function. | "for the root that hands it to the relay" |
| R02-49 | 2 (V, R) | `tanstack-start.md` | "`<service>.fn.ts` — server functions — controllers in the sense of `layers.md`" names no root file and never says a server function imports it; `layers.md` now rules exactly that case ("such as a server function"). | closed (ticket 21, 525c559): `.fn.ts` reads its service inside the handler from the registry or middleware context, imports neither a service instance nor `assembly.ts`; proposed import sentence dropped |
| R02-50 | 1 (V) | outbox bullets, saga | Ticket 11's "what wakes it — a delayed message, a scheduled task — is the codebase's" has no sentence. | append to the deadline sentence: "what wakes it is each codebase's choice" |
| R02-51 | 1 (S) | Other systems, published language | "Khononov keeps the two apart from the start" — Evans does too: p. 264 "essentially becomes frozen", p. 278 "do not equate the interchange language and the model of the host … reserve the right … to diverge". | "Evans (pp. 264, 278) and Khononov (pp. 55, 140) keep the two apart; making them equal, messages included, is this document's choice." |
| R02-52 | 2 (S, R) | Ports and factories, driving ports | "A use case is not a domain concept, so the domain never learns the name of one. This is what keeps the arrow pointing in one direction." Evans p. 53: application tasks "are meaningful to the business"; pp. 76–77: funds transfer is a domain service. R: the arrow is kept by the domain importing no layer, not by where port types sit. | "A driving port belongs to the service layer; the domain may name the same operation as a domain service (Evans p. 76) but imports no port. This document's choice." |
| R02-53 | 1 (S) | Other systems, ACL bullet | "For a model that is foreign, unstable or not yours, as a third-party API's usually is" is looser than the books: Evans p. 256 "When using an off-the-shelf component that has a large interface, you should typically CONFORM"; Khononov p. 53 conforms to "an industry-standard, well-established model", p. 54 reasons for an ACL: a core subdomain, an inefficient upstream, a contract that changes often. "Not yours" describes a conformist's upstream too. R01-40 dropped "always"; the criteria stayed. | "For a model that is unfit, unstable, or would distort a core model (Khononov p. 54); a large, well-made third-party model may be conformed to (Evans p. 256)." |
| R02-54 | 1 (S) | outbox bullets, saga | "a saga, here the whole sequence in Richardson's sense rather than Khononov's coordinating component" — Khononov p. 147: "A saga is a long-running business process … that spans multiple transactions"; the component comes after. "process manager, an aggregate of that system" — p. 152 says "often implemented as aggregates". "choreography" and "orchestration" are Richardson's terms; Khononov uses neither. | "a saga (Khononov p. 147; Richardson): the sequence of local transactions and their compensations, whether or not one component coordinates it"; "one system's process manager, often an aggregate of that system (Khononov p. 152), sends commands (orchestration, in Richardson's terms)" |
| R02-55 | 1 (S) | Terms, specification | "a domain function that takes the candidate and returns the answer" narrows Evans p. 159 ("predicate-like VALUE OBJECTS") and p. 160 (validation, selection, building-to-order) to validation, unmarked. | "a *specification* (Evans p. 159), here narrowed to validation: a domain predicate that takes the candidate and says whether it satisfies the rule" |
| R02-56 | 1 (S) | Ports and factories, "A service is a factory" | Evans's FACTORY (p. 99) creates "complex objects and AGGREGATES … as a piece"; the document means a function that takes dependencies. | "A service module exports a factory function (not Evans's FACTORY, which builds aggregates)" |
| R02-57 | 1 (S) | The layers, DDD-vocabulary paragraph | "driving adapters are Evans's interface layer and driven adapters his infrastructure layer" — Evans calls it "User Interface (aka Presentation Layer)" (p. 53); his infrastructure layer also holds frameworks and service interfaces (pp. 53, 55); his domain depends on infrastructure ("dependent only on the layers below"); the inversion is Khononov's (pp. 126–127). | "driving adapters are roughly Evans's user interface layer, and driven adapters the implementation half of his infrastructure layer; Evans's domain depends on infrastructure (p. 53), the inversion is Khononov's (pp. 126–127)" |
| R02-58 | 1 (S) | Transactions rule 1, exception | "This exception is this document's choice; the sources do not cover it" — the pending state is Richardson's semantic lock (a `_PENDING` state set by a compensatable step); Khononov p. 246 covers notification plus query. | "the pending state is Richardson's semantic lock; the synchronous call is this document's choice" |
| R02-59 | 1 (S) | Tests | "An integration test is one that uses a real external dependency" is coined; Khononov p. 165 uses "integration" for integrating layers; Freeman & Pryce are close. | "An *integration test*, in this document (close to Freeman & Pryce), is one that …" |
| R02-60 | 1 (S) | Other systems, after the three bullets | "The other context-map patterns describe how teams cooperate" — open host service and published language (Evans pp. 263–264) are code patterns, and the document already uses them; partnership is Khononov p. 50. | "The others — customer/supplier and partnership, team arrangements, and separate ways — land as one of these three, or as no integration at all." |
| R02-61 | 1 (S) | Preconditions | "A *store*, in this document's narrowing" — no book defines *store*; it is coined. "*Table*, *row* and *aggregate* are used in the relational sense" — an aggregate is a consistency boundary (Khononov p. 87, Evans p. 92), not a relational term. | "A *store*, a term this document coins, is …"; "*Table* and *row* are used in the relational sense; an aggregate is assumed stored in rows" |
| R02-62 | 1 (S) | various, low | "transaction port" plays Fowler's Unit of Work, unsaid. "The consuming system's build function builds the other system, by default" is unmarked (sources silent). "A *driving port* is the interface to a use case" vs Cockburn's "two, three or four ports" and the document's own one-port-per-service snippet. Repository as port plus adapter is Vernon's split of Evans p. 108. | "(Fowler's unit of work)"; append "; this document's choice"; "the interface to a service's use cases"; optional "split as Vernon splits it" |
| R02-63 | 1 (P) | `domain.md` placed-as-fault list | Faults (c), the dashboard's cross-system join, and (h), a server function built as a factory, are inferred only: "the reporting-read allowance covers only 'across its system's aggregates'. Nothing names a cross-system join as a fault"; "nothing says a server function the framework constructs must not be a factory". | (h) closed (ticket 21, 525c559): `domain.md` names importing the root as the fault, and Ports and factories says "It never imports assembly". (c) open: rule 2 or When to leave it alone, "a read across systems in one adapter is not a reporting read" |

### S4 — folder housekeeping and grounding

| id | where | finding | proposed fix |
| --- | --- | --- | --- |
| R02-64 | `spec-01.md` | No rows for tickets 19 (`3ee8bf9`) and 20 (`800a7b3`), nor an Order line; README requires "Its `**Status:**` line and its row in the spec always agree". Row 08 lacks "superseded in part by 20"; row 10's note still says "infrastructure". | add the rows under a "From review 01" line; fix the two notes |
| R02-65 | `20-root-per-entry.md` | The sentence added at apply time ("One process may load two entries … built once by one root and imported by the other") is not recorded; Consequences still say "Nothing new is needed". | one-line note under Resolution |
| R02-66 | `review-01.md` | First "Pickup notes" still say "HEAD `d5df10a`. This file is uncommitted" and "wait for approval before committing anyway"; superseded by "Pickup for the next session", unmarked. No note for the conscious deviations R01-37 (translating dropped) and R01-47 ("open host" kept). | mark the block superseded; add both deviations to "After the fixes" |
| R02-67 | tickets 09, 12, 14; `spec-01.md` Grounding | Citations review 01 verified were not carried back: ticket 12 "p. 171 per the Sharif library table of contents (from memory)" (verified pp. 145–147); ticket 14's outbox and ch. 4 "(from memory)" (pp. 145–147, 53–54); ticket 09's Evans "summarized on Wikipedia" (p. 264). Spec attributes "the conformist copying the upstream model (pp. 255–256, ticket 09)" — it is ticket 14's. | update the three tickets; "ticket 14" |
| R02-68 | `spec-01.md` Grounding; `extending-layers.md` fallback table | Tickets 19 and 20's checks are not listed (Evans manuscript pp. 54–55, 107–111; Khononov pp. 126–127; Cockburn's configurator); Fowler's *Plugin* (ticket 20) is missing from the fallback table; ticket 20's "Evans ch. 4 p. 54" lacks "manuscript". | add the lines |
| R02-69 | `domain.md` | "Its worker process has its own entry point and its own assembly" — ticket 20's word is *root*. The ticket-19 entry's "imports Payload's instance" conflicts with late binding (R02-03). | "its own root"; "receives Payload's instance, late-bound" |
| R02-70 | tickets 10, 11 | Ticket 10's Decision "'Calls into one thing' stays" and its footnote "receives that infrastructure's ports from assembly" are superseded by R01-36 and tickets 19–20. Ticket 11's footnote 16 "a root wires it once only when one of the escalation reasons holds" is stale after 20. | footnotes |
| R02-71 | tickets 01–18 | "Done when" still reads "Approved and committed" or "presented for approval"; R01-12 dropped the wait. | leave as history; one README line saying so |
| R02-72 | source extracts | This review's book extracts are gone with its session (scratchpad). | re-extract per Pickup notes |

## What held up

Pass P placed these at 4–5 from `layers.md` alone; leave them:

- a record two systems write is two aggregates sharing an id (5)
- a hook on this system's own write does nothing; the mechanism is the codebase's (5)
- Stripe behind an anti-corruption layer on the way out: port in the domain, schema and translation in the adapter or a shared module, never the domain (5)
- three systems in one process sharing payment with a Stripe client that must exist once: the entry's root builds payment once and hands it to shop's build function (5 on who and where)
- checkout returning `client_secret`: commit, call, pending state, deadline in the Order, the provider recognises a repeat (4)
- the order-confirmation mail: outbox, private message, this system's handler calls the mailer, locale in the message (4)
- the ambient transaction is a fault; the in-process billing write goes through the outbox (4)
- the payment driving port recognising a repeat; the nested exception inside payment toward Stripe (4)
- billing's handler built by billing's exported function, handed to the relay, in its own transaction, through one service (4)
- scheduled dunning as a driving adapter, mails through the outbox (4)
- the 3PL webhook: signature in the controller, translation in the adapter, record before anything that can fail (4)
- the worker's root; fulfillment's build function building what it needs until a reason to escalate holds (4)
- the ready-made tracer is not a question-7 fault; trace context is ambient (4)
- an editor's change of an owned field: read-only in Payload; an action calls shop's service; the hook sees shop as caller (4)
- a server function and a product's hook import the root; not a question-7 fault (4; 3 once both share a process, R02-16)
- the 3PL adapter: driven, port in fulfillment's domain, contract suite run twice (4)

Pass V: every decision in tickets 09–20 and every R01 ruling has a carrying sentence, except the
items in R02-07, R02-14, R02-47 and R02-50. Ticket 19's inventory is applied row by row; ticket
20's four pairs verbatim; every hash exists and touches `layers.md`; statuses agree with the spec
for 01–18 and the open questions.

Pass S, faithful and needing no change: Cockburn's driving/driven by "who triggers or is in
charge of the conversation"; the scheduled task as a primary actor; "a port is an interface";
the adapter on the far side; "Khononov's infrastructure layer holds both" (p. 126); the relay
after the commit, at least once (pp. 145, 147); out of order and duplicated (p. 245); embedded
messages where the store has no multi-write transaction (p. 146); shared kernel "neither changes
alone" (Evans p. 251); refer by id and copy the value (Khononov p. 90, Evans p. 97); a repository
"opens nothing" (Evans p. 111); eventual consistency between systems (Khononov p. 150); rule 2's
copy as event-carried state transfer (p. 238); private messages not published (p. 140); "Test
the domain directly" (p. 165); the markers on one root per entry, the conformist default
(Evans p. 255, Khononov p. 53), product transactions, one aggregate per transaction (p. 87),
"Khononov's application service is the transaction" (p. 86 fn. 7), Fowler's registry.

## Source check

Khononov, *Learning DDD* (print page numbers) and Evans's final manuscript (April 2003) were
read for every term and marker; Cockburn's page for the port and adapter vocabulary. Vernon,
Richardson, Fowler and Freeman & Pryce are from memory, flagged where cited. No S1: nowhere does
the document state the opposite of what it attributes to a book. R02-37, R02-51 and R02-54 come
closest.

| id | source | what it says | guidance |
| --- | --- | --- | --- |
| R02-51 | Evans pp. 264, 278; Khononov pp. 55, 140, 246 | Evans: an interchange language "essentially becomes frozen"; "do not equate the interchange language and the model of the host … reserve the right … to diverge". Khononov: the supplier "decouples the implementation model from the public interface"; publishing domain events as they are is "a common mistake". | The marker names only Khononov; both books keep the two apart, Evans allowing close but not equal. Name both. |
| R02-37 | Evans p. 263; Khononov p. 55 | Evans: an open host "leads to the other subsystems being coupled to the model of the open host". Khononov: the open host's published language is a separate model. | "a system that publishes its model on purpose" is Evans's open host, not Khononov's. Say which, or drop the gloss. |
| R02-36 | Khononov p. 127; Evans pp. 55, 76 | Khononov: "the business logic layer defines 'ports' that have to be implemented by the infrastructure layer". Evans: "some message-sending interface can be located in the infrastructure layer"; the email interface "is a SERVICE in the infrastructure layer". Cockburn's sample keeps `RateRepository` in its own package. | Ports in the domain is Khononov's placement; mark Evans's. |
| R02-52 | Evans pp. 53, 76–77 | Application tasks "are meaningful to the business"; "a feature that can transfer funds … is a domain SERVICE because … a 'funds transfer' is a meaningful banking term". | "A use case is not a domain concept" is in tension with Evans; mark it, and let the domain name the operation as a domain service without importing a port. |
| R02-53 | Evans p. 256; Khononov pp. 53–54 | Evans: with "an off-the-shelf component that has a large interface, you should typically CONFORM". Khononov: conform to "an industry-standard, well-established model"; an ACL for a core subdomain, an inefficient upstream, or a contract that "changes often". | The ACL criteria restate Khononov once "not yours" goes; a product with a large interface is a conformist case by Evans. |
| R02-54 | Khononov pp. 147–148, 152 | "A saga is a long-running business process … that spans multiple transactions"; then "The saga listens to the events … and issues subsequent commands"; "process managers are often implemented as aggregates". | Khononov's saga is the sequence too; the contrast with Richardson is wrong. "Often", not always, an aggregate. Choreography and orchestration are Richardson's words. |
| R02-55 | Evans pp. 159–160 | "A SPECIFICATION is a predicate that determines if an object does or does not satisfy some criteria"; uses: "validation, selection, and building-to-order"; "The FACTORY of a SPECIFICATION can configure it using information from other sources". | The document narrows to validation; p. 159 supports "a service loads the data and asks". Mark the narrowing. |
| R02-56 | Evans p. 99 | FACTORY: "Shift the responsibility for creating instances of complex objects and AGGREGATES to a separate object … Create entire AGGREGATES as a piece". | "A service is a factory" uses a book word in another sense; say "factory function". |
| R02-57 | Evans pp. 53, 55; Khononov pp. 126–127 | Evans: "User Interface (aka Presentation Layer)"; infrastructure: "message sending for the application, persistence for the domain, drawing widgets for the UI"; layers "dependent only on the layers below". Khononov: ports in business logic, adapters in infrastructure, "resolved … through dependency injection or by bootstrapping". | The vocabulary paragraph misnames Evans's layer and credits him with an inversion that is Khononov's and Cockburn's. |
| R02-58 | Richardson (memory); Khononov p. 246 | Semantic lock: a pending state set by a compensatable step, cleared by a later one. Khononov: "If the consumer needs to read the last write … issue an event notification message, with a subsequent query." | The pending state has a fallback source; only the synchronous call is uncovered. |
| R02-59 | Khononov p. 165; Freeman & Pryce (memory) | Khononov's "integration" means integrating layers; "Aggregates and value objects make perfect units". | The integration-test definition is coined; say so. "Test the domain directly" stands. |
| R02-60 | Evans pp. 250–264; Khononov p. 50 | Evans's patterns: shared kernel, customer/supplier, conformist, ACL, separate ways, open host service, published language. Khononov adds partnership. | Open host and published language are code patterns the document already uses; the "team" sentence should name only customer/supplier, partnership and separate ways. |
| R02-61 | Khononov p. 87; Evans p. 92 | An aggregate is a consistency boundary. | Not a relational term; *store* is coined, not narrowed. |
| R02-09 | Khononov pp. 238, 245 | Messages carry "event-id", "version", "timestamp"; subscribers "deduplicate … identify and reorder out-of-order messages". | The book asks for ordering per writer; the document's aggregate version is one mechanism and fails on writes that emit nothing. State the property. |
| R02-39 | Evans p. 53; Khononov pp. 86, 122 | Thin application layer; "The presentation layer's responsibility becomes limited to providing the required input to the service layer"; the application service as transaction script. | One service per action and no service-to-service calls are stricter than the books; mark both. |

### Findings the sources do not touch

R02-01 to R02-08, R02-10 to R02-35, R02-38, R02-41 to R02-50, R02-63: internal consistency,
products, hooks, roots, the checklist. Decide them on the four tests alone.

## Pickup notes

For the session that works through this review.

- **Where:** worktree `.claude/worktrees/docs-layers-refinement`, branch `docs/layers-refinement`,
  HEAD `67bd22b` before this file. Nothing else in the branch was changed by the review.
- **Process:** `docs/extending-layers.md` steps 1–6 per change; commit per `CLAUDE.md`, no
  approval wait. One commit per finding or per group that touches one sentence; name the ids in
  the commit body.
- **Order suggested:** ticket 21 (Q0) first; it closes R02-06, R02-08, R02-16, R02-47,
  R02-49 and R02-63 (h), and narrows R02-03 to its product-instance half. Then S1: R02-02 (the
  service row against question 7), R02-03 (the product instance, late-bound), R02-04 with
  R02-14 (record-first and early arrivals), R02-01 with R02-18 (asking and authorization), R02-05
  with R02-12 (who calls the third party, what reconciliation repairs). S2 next; R02-21, R02-22
  and R02-28 are each one sentence restoring a spec-01 ruling `layers.md` never carried. S3 is
  two sweeps: checklist tells (R02-26, R02-27, R02-31 to R02-35) and markers (R02-36, R02-37,
  R02-39, R02-40, R02-51 to R02-62). Siblings (R02-45, R02-46) with the S3 sweep. S4
  after `layers.md` is settled.
- **Sources:** `~/Documents/*Khononov*.pdf`, `~/Documents/*Evans*.pdf` (filenames contain
  non-ASCII whitespace; use the globs); Cockburn at
  `https://alistair.cockburn.us/hexagonal-architecture/`. Extract with
  `pdftotext -layout <pdf> <out.txt>` into the scratchpad; this review's extracts are gone with
  its session. Khononov page numbers are the print edition's as printed in the extract's
  footers; Evans's are the final manuscript's.
- **Hits** count independent readers (five: this session plus four Opus agents with the inputs
  under Method). A hit count of 1 is not a reason to drop a finding; most of pass S and the
  sharpest of pass A (R02-01, R02-05, R02-13) are singles.
- **Acceptance test** after any `layers.md` change: a fresh agent with only `layers.md`, placing
  the `domain.md` scenarios the change touches and reporting confidence 1–5 and its guesses. The
  scenarios to re-run for this round's S1s: the Payload price adapter (R02-21, now 3), the hook
  tree on an editor's change (R02-20, 3), the config cycle and two roots in one process (R02-03,
  R02-16, 3), `/health` (R02-22, 1).

## Decisions the author has to make

Settled by the text and not asked: the four layer names and the root per entry hold; every
ticket decision landed; the S3 checklist-tell fixes and the S4 housekeeping are mechanical.

✅ **Q0** (answered; applied in ticket 21, 525c559) - **A driving adapter never imports assembly (ticket 21)**: ticket 20's "by importing
the root where the framework constructs it" is the cause of R02-06, R02-08, R02-16, R02-47 and
R02-49, and of fault (h) being underivable (R02-63). The constraint is real only for a module the
framework collects, a server function or a file-based route; a `node:http` handler, a Hono route
and a Payload hook take a closure factory. Does the adapter instead read its service from a
courier the root fills once — the ambient registry, as a second, per-process scope of the ambient
rule the document already has, or the framework's request context — and never import assembly,
with "an adapter imports what is static and receives what is built" as the line behind it?

➡️ Yes; `21-service-registry.md` holds the wording. It passes the ambient test as written
("nothing a use case or domain function decides by"), removes the two-roots cycle, keeps tests
on fakes without module mocking, and sends the courier to the stack document. Q3's second half,
Q5's driving-adapters row and Q14 are then settled by it: Q3 keeps only the product-instance
half, Q5 adds "the registry" to the row, Q14 is dropped.

---

❓ **Q1** - **Ask, then act (R02-01)**: an adapter that needs data to ask "may this caller do
this" calls a service to ask, then a service to act: two calls, and Q2 fires. Does the acting
service enforce the rule itself, so the adapter calls one function and gets a refusal, and a
question-only service exists only for a screen that hides a button?

➡️ Yes. "The service that acts loads the data, asks the specification, and refuses." The
adapter's specification call stays for input it holds (validity), not for permissions that need
a load.

---

❓ **Q2** - **Authorization lives in the service (R02-18)**: "may this caller do this" is the
Terms example of a specification an adapter asks, while "B's authorization lives in its service
or domain" for ports another system calls. Does every driving port take its caller and refuse in
the service, with the adapter's specification call only shaping what it shows?

➡️ Yes. One rule for every caller; the moment a port is exported, controller-side authorization
is bypassed. Follows from Q1.

---

❓ **Q3** - **The product's instance is received, not imported (R02-03, R02-16)**: the
driven-adapters row says "a product's instance and its types" may be imported; Products says the
adapter "receives a function that returns the instance". Does the row become "a product's types,
and its instance or a function that returns it", and does the two-roots sentence say which root
builds what both need: "the root of the entry the other loads"?

➡️ Yes to both. Importing the instance recreates the cycle ticket 20's root was meant to end,
and "as the reasons to escalate decide" points at a rule written for a different choice.

---

❓ **Q4** - **Hook step 4 records before it hands off (R02-04)**: the delivery rule says a
handler of a product's hook "records what it was given … before anything that can fail"; step 4
hands off in memory and accepts loss. Does step 4 record the change as pending through one
service, in this system's own transaction, and let the handler check it through the product
before acting?

➡️ Yes. It makes step 4 a case of step 2's mechanism plus a check, and the general rule holds
without an exception. The alternative, marking step 4 as the exception, keeps a path that loses
work on purpose.

---

❓ **Q5** - **Import lists name plumbing and the root (R02-02, R02-06)**: the service row allows
"the common library's ports" only, the driving-adapters row "services and domain" only; Q7 allows
a ready-made logger, the ambient paragraph lets adapters read a registry, Ports and factories
lets an adapter import the root. Do both rows list what the body allows, with a pointer to the
paragraph that allows it?

➡️ Yes. The table is the sentence a linter reads; a row that forbids what a later paragraph
allows is the fault review 01's R01-07 had, come back on two rows.

---

❓ **Q6** - **A driven adapter may receive another (R02-10)**: "composes nothing" and Q2's
"import of another driven adapter" forbid a cache decorating a repository and an anti-corruption
adapter over an HTTP-client adapter. Is the rule "a driven adapter may receive another driven
adapter, never import one", with Q2's tell narrowed to imports?

➡️ Yes. Receiving keeps substitution (Q7); importing is the fault Q2 and Q6 exist for. "Composes
nothing" then means "composes no other aggregate", which is what rule 3 and Q5 need.

---

❓ **Q7** - **Message ordering as a property (R02-09)**: "the version of the aggregate that wrote
it" fails when a write emits no message and when a receiver has several writers; Stripe and the
3PL send no version. Does the bullet state the property — an id, and what a receiver needs to
order a writer's messages — and leave the mechanism to the codebase?

➡️ Yes. Khononov p. 245 asks for ordering per writer and names no mechanism; "a per-writer
sequence" can stay as the example.

---

❓ **Q8** - **Early arrivals: record or fail, stated positively (R02-14)**: ticket 11 ruled
"record or fail-to-retry is the codebase's choice"; `layers.md` says only "is not a repeat". Does
the bullet say "fail so the caller retries, or record it and apply it when the delivery it waited
for arrives, is each codebase's choice; a relay allows both, a webhook only the second"?

➡️ Yes. Three readers scored this 3 or asked; the positive form is what the README's grilling
notes ask for.

---

❓ **Q9** - **A command belongs to its handler's published language (R02-13)**: nothing says whose
schema a command is. Does a command belong to the published language of the system that handles
it, imported by the sender like a driving-port type, while an event belongs to the publisher?

➡️ Yes. It is the conformist bullet applied to messages; the alternative inverts ownership of the
handler's own data.

---

❓ **Q10** - **Who calls the third party (R02-05, R02-12)**: "a handler of this system calls it"
reads as the driving adapter calling Stripe; "a duplicate is repaired by … reconciliation"
contradicts reconciliation's definition. Does rule 1 say "a message handler calls one service,
which calls the third party's port", and "a duplicate is undone by a compensating call, which
reconciliation starts when it finds one"?

➡️ Yes. The first is a derivation of the driving-adapters row; the second keeps reconciliation's
definition and gives the duplicate a saga step.

---

❓ **Q11** - **Restore the three spec-01 rulings as sentences (R02-21, R02-22, R02-28)**: the
cold read placed the Payload price adapter at 3, `/health` at 1 and Payload's collection config
at 2, though spec 01 ruled all three. Does each get one sentence in `layers.md`: an owned
aggregate stored in a product has an adapter that is both repository and translator; an
endpoint that reports on the process is not a use case; a store's own schema is not a second
constructor?

➡️ Yes. "Only `layers.md` ships"; a ruling that lives in the spec is one a fresh agent cannot
read. R02-21 also restores ticket 19's acceptance target.

---

❓ **Q12** - **"Open host service" as this document's term (R02-37)**: every system "offers an
open host service", while "an open host" is a system "that publishes its model on purpose",
which is Evans's open host and the opposite of Khononov's. Does one clause mark the first as this
document's use and the second as Evans's sense?

➡️ Yes. R01-47 kept the phrase consciously; a marker costs one clause and the term stays.

---

❓ **Q13** - **Three markers, three fixes (R02-39, R02-54, R02-57)**: "one service" and "no
service-to-service" get "this document's choice"; the saga sentence stops contrasting Richardson
with Khononov and says "often an aggregate"; the vocabulary paragraph says "roughly Evans's user
interface layer" and credits the inversion to Khononov. Apply all three as pass S proposed?

➡️ Yes. None changes what an agent does; each stops a reader who knows the books from
distrusting the rest.

---

❓ **Q14** - **Tests for a framework-constructed adapter (R02-08)**: "Each receives ports, so a
test hands it fakes" is false for an adapter that imports the root. Does Tests say such an
adapter is two pieces — a function that takes its service, tested against a fake, and a one-line
binding that imports the root and is not unit-tested?

➡️ Yes. It is the only shape that keeps "the default suite runs on fakes" true without module
mocking, and it is what the stack document (R02-49) should show.

---

❓ **Q15** - **Shared kernel is domain code (R02-15)**: the bullet names a module and nothing
else. Does it say "a shared kernel is domain code: pure, any runtime, importing neither system"?

➡️ Yes. Derivation from "The domain runs on any runtime"; one clause.

---

❓ **Q16** - **Spec rows for tickets 19 and 20 (R02-64)**: the spec has no rows for them, and the
README says a ticket's status and its row always agree. Add a "From review 01" block with both
rows, and in the same commit the ticket-20 note (R02-65), the review-01 marks (R02-66) and the
grounding carry-backs (R02-67, R02-68)?

➡️ Yes, as one housekeeping commit after `layers.md` is settled.
