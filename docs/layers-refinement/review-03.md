# Review 03: `layers.md` after ticket 21 and the summary table

**Reviewed:** `registry/docs/agents/layers.md` at `544055e` (branch `docs/layers-refinement`),
with `docs/extending-layers.md`, `domain.md`, `spec-01.md`, `review-01.md`, `review-02.md`,
tickets 01–21, `open-questions.md`, the sibling docs `components.md` and `tanstack-start.md`,
the `summarize-layers` skill with its `citations.md`, and the books (Khononov, Evans, Cockburn's
page) as context. Supersedes `review-02.md`; every review-02 finding is carried, closed or
dropped below.
**Date:** 2026-10-21
**Verdict:** not mergeable as is. Since review 02, ticket 21 (`525c559`) closed six findings and
the table rebuild (`ef97c5b`, `544055e`) closed the row-level S1s. The rebuild also did three
things the body did not: it states rules the body lacks (every driving port takes its caller; a
closed import list for the domain), it dropped a review-01 ruling (controllers receive the ports
that resolve their caller) and a ticket-19 rule ("composes nothing") without a note, and it
carries every unmarked choice review 02 found into cells a linter reads. None of review-02's
sixteen decisions is applied; thirteen are still needed. The cold read placed ticket 21's five
Done-when scenarios at 5, except two roots in one process, at 3; review-02's low scenarios are
unchanged except the two-store case, now 4.

Findings are anchored by quoted text, not line numbers.

## Method

Six independent readers, then merged:

| pass | reader | input | purpose |
| --- | --- | --- | --- |
| R | reviewer (this session) | everything | review-02 carry-forward against the current text; the three paragraphs ticket 21 changed |
| P | fresh Opus agent | `layers.md` only | place the 24 `domain.md` scenarios, four assembly scenarios (ticket 21's Done-when among them) and the placed-as-fault list; confidence 1–5 and what it had to guess |
| A | fresh Opus agent | `layers.md` only | adversarial read: contradictions, non-sequiturs, term drift (entry, assembly, root, registry, ambient, handler, open host), unmarked choices, the nine tells against the registry read and the two ambient scopes |
| T | fresh Opus agent | `layers.md`, the skill, `citations.md` | every table cell traced to a body sentence; `citations.md` against both |
| V | Opus agent | everything | per ticket and per R01/R02 ruling a carrying sentence; status and hash agreement; siblings; review-02's closed marks against the commits |
| S | Opus agent | `layers.md` + book extracts | markers and book terms that changed since review 02; R02-51 to R02-62 re-checked |

**Hits** = how many of the six readers raised the finding independently. For a carried finding
the hits are this round's; review-02's count is in its row there.

Pass P confidence (numbering as in review 02: catalog 1–7, shop 8–11, payment 12–14, billing
15–16, fulfillment 17–19, common library 20–21, cross-cutting 22–24, assembly 25–28):

| confidence | scenarios |
| --- | --- |
| 5 | 3, 5, 12, 15, 18, 20 (tracer, trace context), 26 (server function: imports, registry read, fakes), 27 (hook by argument, instance late-bound), 28 (instance from a service module; the root) |
| 4 | 1, 4 (price read-only), 7 (late binding), 8, 9 (which store; was 2), 11 (write), 13, 14, 16, 21, 25 |
| 3 | 2 (Payload price adapter; was 3), 4 (hook tree; was 3), 7 (two roots in one process; was 3), 10 (mail that cannot dedupe), 17 (early `OrderCancelled`), 19 (worker's build function), 22 (dashboard join) |
| 2 | 6 (collection config as second constructor; was 2), 11 (read inside `run`), 23 (cache revalidation; was 2), 24 (`/health`, `/metrics`; was 1), 28 (factory with no caller) |
| 1 | 20 (instrumentation load order) |

Ticket 21's Done-when asked for 4–5 on five scenarios: four hold (26 twice, 27, 28); "a web
server that also loads Payload's config, both needing shop" is at 3 (R03-04).

## Carry-forward of review 02

Closed since, mark verified against the commit (pass V): R02-02, R02-08, R02-16, R02-47,
R02-49, R02-63 (h). Half closed as marked: R02-03 (row closed; `domain.md` half open, now S1
below), R02-06 (row closed; "a module both adapters share" open, S3), R02-19, R02-21, R02-29.
R02-10's mark understates: "A service, an adapter, a product's instance: received" (`525c559`)
settles that a driven adapter may receive another; only its Q2 tell is open. Every other
review-02 finding is present verbatim at HEAD and carried below with its id. Dropped: none.

Review-02 decisions: Q0 applied (ticket 21). Settled since and not asked again: Q3 (the import
column is gone and the cell reads "a product's instance late-bound"; which root builds is each
codebase's, ticket 21), Q5 (no import columns remain), Q14 (dropped by ticket 21), Q6's first
half (received, by derivation). Still needed: Q1, Q2, Q4, Q7–Q13, Q15, Q16, re-asked at the end.

## Findings

Severity: **S1** contradiction or wrong instruction; **S2** gap a fresh agent fills wrongly;
**S3** wording, stale reference, unmarked choice; **S4** folder housekeeping and grounding.

### S1 — contradictions

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R02-01 | 2 (R, A) | Terms, "acts through one service"; Q2 | carried from review 02. "When the answer needs data the adapter does not hold, a service of its system loads the data and asks the specification" sanctions ask-then-act: two service calls, which "needing two is the signal that a use case has grown inside it" and Q2's tell fire on. A: Q2 exempts only a direct specification call. | closed (ticket 22, ac716ac): "A question that needs this system's state — may this caller do this — is the acting service's: it loads the data, asks the specification, and refuses. A service that only answers, for a screen that hides a button, is called instead of acting, never before it." |
| R02-04 | 2 (R, A) | Terms, "Stop delivering"; Products, hook step 4 | carried from review 02. "a product may not run a hook again, so a handler of one records what it was given, through its one service, before anything that can fail" vs step 4 "the hook hands its work, in-process, to a handler that first checks the change through the product" and "A hand-off … is lost when the process stops first … reconciliation repairs it". A adds: step 4's "handler" is undefined — its layer, when it runs, whether it acts through one service, what "checks through the product" means. | closed (ticket 23, bac336c): step 4 defers through this system's outbox, written in its own transaction; the handler's service checks through the product that the change committed, "not yet" fails and the relay retries until a deadline; *handler* defined in Terms as the driving adapter the relay calls |
| R02-12 | 2 (R, A) | Transactions rule 1 | carried from review 02, raised from S2: "A third party handles none: a handler of this system calls it when the message arrives" and "a handler or scheduled task of this system repeats the call" have the driving adapter calling the third party, against "A driving adapter acts through one service" and the table's "its only door to the store is a service". | closed (ticket 23, bac336c): "A third party reads no relay: a handler of this system receives the message instead, and the message is the retry"; "a scheduled task of this system repeats it"; the chain handler → service → driven port is Terms' (*handler* acts through one service), not spelled in place |
| R02-05 | 1 (R) | Terms, reconciliation; rule 1 | carried from review 02. "A duplicate is repaired by the saga or by reconciliation" vs reconciliation "repairs this system's record": a duplicate payment is the third party's record. | closed (ticket 23, bac336c): "A duplicate is undone by a compensating call, a saga step, which reconciliation starts when it finds one"; Terms: reconciliation "repairs this system's record, or starts the step that repairs the other's" |
| R02-03 | 2 (R, V) | `domain.md`, placed-as-fault (g) | carried from review 02, remaining half. `domain.md`: the price adapter "imports Payload's instance as any driven adapter imports what its port's implementation needs". `layers.md`: "A service, an adapter, a product's instance: received"; "an adapter receives a function that returns the instance". The review domain tells the next ticket author the opposite of the document. | "receives Payload's instance, late-bound, as any driven adapter receives what is built (ticket 19, 21)" |
| R03-01 | 3 (R, A, T) | table, service row | "its driving port takes its caller, and authorization lives here or in the domain" vs body "**A driving port another system calls takes its caller as an argument.** … B's authorization lives in its service or domain". The table widens a rule scoped to ports another system calls to every driving port, which is review-02's Q2 decided by the summary pass; an agent adds a caller parameter everywhere, or trusts the controller's check on a port that later gets an external caller. | closed (ticket 22, ac716ac): body generalized — "A driving port takes what its use case decides by, the caller included" (The layers); Other systems' lead keeps its bold case and says "as every driving port takes what its use case decides by"; cell now "takes what its use case decides by, the caller included" |

### S2 — gaps a fresh agent fills wrongly

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R03-02 | 1 (A) | Ports and factories, "receives its service from the root" | "from a courier the root fills once — the ambient registry (below) or the framework's request context": a request context exists per request, so a root cannot fill it once; an agent stashes services into a request context at startup, or concludes the per-request scope holds services. | closed (ticket 24, 3f3b3ee): the courier is a Terms entry — the per-process registry, or the framework's request context "which middleware the root installs fills per request"; "fills once" is gone |
| R03-03 | 3 (R, T, V) | table, domain row; `citations.md` | "imports no layer, only other domain modules, the common library's ports, a shared kernel, a conformed system's published language and pure libraries" is a closed list where the body gives a test ("whether calling it can reach outside the process", "runs on any runtime"). "the common library's ports" is granted by no body sentence; `citations.md` flags it itself ("candidate finding"). The body needs it: "The context is opaque in the domain" means the repository port names the transaction port's context type. T: the shared kernel and the conformed language are also only implied for the domain ("in any layer that may import a domain", "a module both import"). | body, Atomicity paragraph: "the domain names the common library's port types — the transaction port's context, the outbox — which themselves run on any runtime"; Conformist bullet "in any layer, the domain included"; shared kernel "a module both domains import". Cell: "imports no layer; a package only if it reaches nothing outside the process and runs on any runtime" (Q20) |
| R02-42 | 2 (R, T) | summary, arrow sentence; "Imports no layer" lead | carried from review 02, widened. "The arrow runs one way — driving adapter → service → driven adapter → the outside — and the domain sits beside all of it: every layer may import it, it imports no layer" mixes calls with imports (read as imports, a service imports a driven adapter, Q7's fault). T: the import rule now exists only inside `<layers-summary>`; the body's "**"Imports no layer" is about this system's modules, not about packages.**" quotes a sentence the body lacks, and `citations.md` cites the summary for two domain entries. The skill says the table states no rule of its own. | body, before the "Imports no layer" lead: "Every layer may import the domain; the domain imports no layer; no other layer imports another, a service and an adapter arrive as arguments." Summary: "Calls run one way — driving adapter → service → driven adapter → the outside; imports point only at the domain and at port types." (Q20) |
| R03-04 | 4 (R, P, A, V) | Ports and factories, Assembly paragraph | "what both need is built once, put in the registry by one root and read, not imported, by the other, as the reasons to escalate (Other systems) decide; which root builds it is each codebase's choice" — "as the reasons to escalate decide" now dangles between "built once" and "which root", and the next clause says the reasons decide neither (R02-16's residue, V). P (3): no start order between two roots; a product-config root constructs its hooks at load time, so if the server root builds shop the config root reads the registry when it loads, against "a driving adapter reads it when it runs, not when it loads". A: the ambient paragraph names only driving adapters as readers; a root reading is unsaid. | closed (ticket 24, 3f3b3ee) by dissolution: an *entry* is where a deployable starts, one *root* per entry; a product is built by its build function; the two-entries sentence is gone and no root reads the registry |
| R03-05 | 2 (A, P) | ambient paragraph; Other systems | Two homes for the acting user with no order: "the user an audit column records until a rule decides by it. A driving adapter puts it in" (ambient) and "A driving port another system calls takes its caller as an argument". P (scenario 1): `req.user` as argument or ambient, "no rule for choosing". | closed (ticket 22, ac716ac): "the user an audit column records; what a rule decides by, the port takes" |
| R03-06 | 2 (R, A) | the checklist | Three rules have no tell: "A service does not call another service of its system" (Q5 sees no new `run`, Q6 covers driven adapters, Q7 construction only); "It never imports assembly" (Q7 fires only on "a ready-made instance next to the factory that produces it", not on an import from the root); "a service reads nothing from that scope" (a `registry.get()` in a service body is not "constructed inside … rather than passed in", and the ambient paragraph points at Q7 for it). | closed (ticket 24, 3f3b3ee): Q7 tell gains "read from the per-process registry there" and "a driving adapter importing an instance from the root, or reading a courier when its module loads"; Q5 tell gains "a service that receives or imports another service of its system" |
| R03-07 | 1 (P) | Terms, "Stop delivering"; Other systems, ACL bullet | Translate first or record first: "the driving adapter that receives the other system's call translates it into this system's terms before it calls a service" vs "records what it was given, through its one service, before anything that can fail". Translation can fail (an unknown event shape), and the record goes through the service, which takes this system's terms. P (14, 18): "pull against each other". | one clause in Stop delivering: "records what it was given — the delivery as received, opaque — through its one service; translation happens when the record is applied" or the reverse; decide (Q19) |
| R03-08 | 3 (T, A, V) | table, driven row; domain row | "implementations of this system's driven ports", "implements a driven port the domain declared" and the domain row's "declares the driven ports" exclude adapters for common-library ports ("outbox: Outbox // driven port, from the common library") and for another system's driving port ("an HTTP client, a driven adapter of A, implementing the same port"). | driven: "implements a driven port: one its domain declared, the common library's, or another system's driving port"; domain: "declares the driven ports this system defines" |
| R03-09 | 1 (T) | table, driving row | "translates another system's call into this system's terms before it calls a service" drops the anti-corruption-layer condition the body has ("On the way in … the driving adapter that receives the other system's call translates it", inside the ACL bullet); under a conformist relationship the cell orders the no-op translation Q8 calls a fault. The driven row keeps the condition. | "behind an anti-corruption layer, translates another system's call into this system's terms before it calls a service" |
| R03-10 | 1 (T) | table, service row | "a change to another system's data is an outbox message, or a call after the commit" reads as a free choice; the body has "**Outbox, required.**" and the call only "Where the use case's caller needs the other system's answer in its response". | "a change to another system's data is an outbox message; a call after the commit only where the caller needs the answer" |
| R03-11 | 3 (T, A, V) | table, service row | "only forwarding to a repository is correct" parses as "the only correct thing is forwarding"; the body: "**A service that only forwards to its repository is correct here**". | "a service that only forwards to its repository is correct" |
| R03-12 | 1 (T) | table, service row | "writes that must land together share one transaction, which stays inside its system" drops the body's exception "except a message a product's hook writes in the product's transaction (Products)"; an agent on hook step 3 refuses the product's transaction. | append "except a hook's message (Products)" |
| R03-13 | 1 (T) | table, driven row | "a read across its system's aggregates is a reporting read" drops "as long as it writes nothing". | append "as long as it writes nothing" |
| R03-14 | 1 (T) | table, driving row | "receives its service from the root, as an argument or from the registry or the framework's context" drops the conditions ("As an argument where the entry's code constructs the adapter … where the framework collects it … from a courier"); the choice looks free. | "receives its service from the root: as an argument where the entry constructs it, from the registry or the framework's context where the framework collects it" |
| R03-15 | 1 (A) | Terms, the three faults; table, driving row | "Each is a fault the adapter prevents" and the cell "a repeat changes nothing, an early arrival is not a repeat" put the check on the adapter, while "the receiver's aggregate records the last version it handled" puts the state in the aggregate: an agent dedupes in the controller with a store read, against "its only door to the store is a service". | "Each is a fault the receiving use case prevents; the adapter passes the id and version through" (Q17) |
| R03-16 | 2 (R, V) | Ports and factories; ticket 10 | R01-07's ruling (controllers receive the ports that resolve or translate their caller) lived only in the old driving-adapters row ("it receives ports that resolve or translate its caller, as it receives its service"); pass 1 dropped it, saying Terms' "resolves the caller" carries it. Neither Terms nor the translation entry says *received*; only "A service, an adapter, a product's instance: received" derives it. Ticket 10's footnote "The row now says so" is false. | closed (ticket 22, ac716ac): "A service, an adapter — its own, or one that resolves or translates its caller — a product's instance: received"; Terms: "through a port it receives" |
| R03-17 | 2 (R, V) | ticket 19; the skill | Ticket 19's Decision "an adapter over this system's aggregate serves one aggregate for writes, composes nothing, joins the caller's transaction" survived only as a cell; pass 1 dropped "composes nothing" as uncited, without a note in the ticket. A summary pass changed a rule. R02-10's open question (whether a driven adapter may receive another) is now settled by derivation (`525c559`) and the ticket-19 rule is gone. | footnote in ticket 19; a body sentence if the rule is wanted: "an adapter over this system's aggregate composes no other aggregate" (rule 3 and Q5 need it); the skill: an uncited entry is a finding, not a silent drop (Q22) |
| R03-18 | 1 (V) | `tanstack-start.md` | `layers.md` hands the stack document four decisions — "Which courier, the stack document says", "what carries them is the stack document's", ticket 21's "typed or not; `AsyncLocalStorage` or a module-level object; and when the root fills it" — and `tanstack-start.md` decides none: "from the registry or the server function's middleware context" lists both; `assembly.ts` is named but never said to be the root. | `tanstack-start.md`: one paragraph choosing the courier, where the registry lives, when the root fills it, what carries per-request values; a file-table row for `assembly.ts` as the root |
| R02-07 | 2 (R, A) | Q2 tell | carried from review 02, widened by A. "resolving its caller and asking a specification are not growth" exempts neither inbound translation, nor validation, nor putting per-request values in, nor recording before failure, nor the hook's caller check — each sanctioned elsewhere and each "growth" by the tell. | closed (ticket 22, ac716ac): "preparing the call — resolving its caller, validating, translating, putting ambient values in, asking a specification — is not growth"; recording a delivery and the hook's caller check are not listed, the list is open ("whatever else shapes the input", The layers) |
| R02-09 | 2 (R, S) | outbox bullets, first | carried from review 02. "an id, and the version of the aggregate that wrote it; the receiver's aggregate records the last version it handled" fails for writes that emit no message and for a receiver with several writers; Stripe and the 3PL send no version. S: Khononov p. 245 asks for dedupe and reordering and names no mechanism. | state the property: "an id, and what a receiver needs to order it among its writer's messages — a per-writer sequence, for example; how, each codebase chooses. A delivery not from an outbox carries what the sender gives." (Q7) |
| R02-10 | 2 (R, A) | Q2 tell | carried from review 02, narrowed: receiving is settled (`525c559`). "a driven adapter that gained an import of another driven adapter" still fires on a module both adapters share (ACL bullet) and on a reporting read importing two mappers. | "an import of another driven adapter's port implementation or of a service; a module both adapters share is not one" |
| R02-11 | 3 (R, A, P) | When to leave it alone | carried from review 02. "A service calling another system's driving port is calling a port, not a use case nested in another" is unqualified; rule 1 makes a write an outbox message or a post-commit call, and no tell catches a writing call inside `run`. P (11b, 2): whether a read may happen inside this system's open transaction is unsaid. | closed (ticket 24, 3f3b3ee): "— for a read. A write goes through the outbox or after the commit (Transactions, rule 1), never inside `run`"; Q5 tell "a call to another system's writing port inside `run`" |
| R02-13 | 1 (R) | Other systems, published language | carried from review 02. Nothing says whose schema a command is. V: ticket 09 ruled "needs no clause"; a reader cannot derive it. | "A command belongs to the published language of the system that handles it; the sender imports it like a driving-port type. An event belongs to the system that publishes it." (Q9) |
| R02-14 | 3 (R, A, P) | Terms, "Deliver out of order" | carried from review 02. "A delivery about something this system has not recorded yet is not a repeat" says what not to do, not what to do. P (17, 3): "states no preference between failing and recording"; A: an agent cannot act. V: ticket 11's "record or fail is the codebase's" is still not a positive sentence. | "What the handler does with it — fail so the caller retries, or record it and apply it when the delivery it waited for arrives — is each codebase's choice; a relay allows both, a caller that stops only the second." (Q8) |
| R02-15 | 2 (R, T) | Other systems, shared kernel | carried from review 02. "goes in a module both import and neither changes alone" never says the module is domain code; T: nothing says the domain may import it. | "A shared kernel is domain code: pure, any runtime, importing neither system; both domains import it." (Q15) |
| R02-17 | 2 (R, A) | Products, hook step 2 | carried from review 02. "which touches no row the product's transaction holds" — a foreign key to the product's uncommitted row blocks; A: an agent cannot know which rows a product's transaction locks. | "which writes only this system's tables and refers to the product's record by id, with no foreign key" |
| R02-18 | 3 (R, A, T) | Terms, specification; Other systems | carried from review 02. "may this caller do this" is the Terms example of a specification an adapter asks, while "B's authorization lives in its service or domain" for ports another system calls; the table has now generalized the second (R03-01). | closed (ticket 22, ac716ac): the adapter's specification example is validity ("input it holds — is this valid"); permissions by this system's state are the acting service's; every driving port takes what its use case decides by, the caller included |
| R02-20 | 2 (R, P) | Products, hook steps 1 and 3 | carried from review 02. "The product has committed the change" vs "The hook runs inside the product's transaction": nothing says how a hook tells which it is. P (4, 3): "does not say whether the step is chosen per hook at design time or per call"; Payload's `afterChange` runs inside its transaction, which rules out step 1 and the document does not say so. | "which step applies is a property of the hook the product offers, read from its documentation, not of the change" |
| R02-21 | 2 (R, P) | driven adapters, body | carried from review 02. No sentence for an owned aggregate a product stores. P (2, 3): the driven row lists "a repository over one aggregate" and "another system behind an anti-corruption layer", so the price adapter "fits either"; how a Drizzle transaction reaches Payload's Local API is unsaid. | one sentence under Products: "An adapter over an aggregate this system stores in a product is a repository that also translates: it receives the product's instance, late-bound where the product calls back, and joins this system's transaction where the transaction port reaches the product's tables; where it cannot, the product's tables are a second store." (Q11) |
| R02-22 | 2 (R, P) | When to leave it alone | carried from review 02. `/health`, `/metrics` (P: 2) and cache revalidation (P: 2) have no sentence; spec 01 ruled both. "its only door to the store is a service" pushes a database ping through a service. | "**An endpoint that reports on the process — health, metrics — is not a use case**; it reaches what it pings directly, and sits outside these layers." "A server-side cache is a driven port of the system that owns it; the use case that wrote invalidates it." (Q11) |
| R02-23 | 2 (R, P) | outbox bullets; rule 1 | carried from review 02. "Handling the same message twice changes nothing the second time" vs a mail provider that cannot dedupe; "a repeat may duplicate" is said only for the post-commit call. P (10, 3; 16). Hint from ticket 23's cold read, unverified: the outbox bullet's dedupe mechanism ("the receiver's aggregate records the last version it handled") may read as system-to-system only; a handler whose effect is a third-party call seems to have no such record unless its service keeps one. | outbox bullet: "where the third party it calls cannot recognise a repeat, the handler's service records the call before making it, and a repeat finds the record; a crash between the two duplicates, and reconciliation cannot repair a mail" |
| R02-24 | 3 (R, P, A) | Other systems, export list; snippet | carried from review 02. "a function that takes configuration and builds the open host service" and `createPricing = (config: PricingConfig)` — after escalation a build function receives built systems; "configuration" is undefined. P (19, 25): "pulled two ways" on who builds a system's own adapters, the root ("it builds the adapters") or the build function ("That function is the system's assembly"). | export item: "a function that takes configuration — and the systems the root built for it — and builds the open host service, its own adapters included"; Assembly paragraph: "it builds the adapters the entry's driving adapters need, calls the factories and the build functions systems export" |
| R02-25 | 2 (R, A) | Tests, contract tests | carried from review 02. "the receiving system writes the suite" reads as the provider. | "the consuming system — the one that receives the port as a dependency — writes the suite" |
| R02-26 | 2 (R, A) | Q9 tell | carried from review 02. "renamed, removed, made required, or narrowed" misses a field added as required, a widened enum, a change of meaning. | "renamed, removed, added or made required, narrowed, widened to a value an older handler does not know, or changed in meaning" |
| R02-27 | 2 (R, A) | Q8 tell | carried from review 02. "a message schema copied field for field from the system that publishes it" fires on the third-party schema an inbound ACL must hold. | "Or, used past the driving adapter, a message schema copied field for field …" |
| R02-28 | 2 (R, P) | Q3 | carried from review 02. Payload's collection config re-declaring domain fields: spec 01 ruled it, no sentence. P (6, 2): "silent on storage schemas". | Q3: "A store's own schema — an ORM table, a product's collection config — is not a second constructor; the repository's adapter maps it to the domain's." (Q11) |
| R02-37 | 3 (R, A, S) | Other systems, first sentence; Conformist bullet | carried from review 02, raised from S3 by A: "A system offers an open host service" (every system) vs "The default for an open host — a system that publishes its model on purpose" (some); read literally, conformist is the default for every system, products and third parties included, against the ACL bullet. S: the gloss is Evans p. 263, not Khononov p. 55. | "Every system's offer — its driving ports and published language — is its open host service here (Evans p. 263 reserves the term for a protocol built for many consumers). Conformist is the default toward a system of this codebase that publishes its model on purpose; toward a product or third party, the default is an anti-corruption layer; both defaults are this document's choice." (Q12) |
| R02-63 (c) | 2 (R, P) | rule 2; When to leave it alone | carried from review 02. The dashboard's cross-system join is a fault only by implication ("its system's aggregates"). P (22, 3). | append to the reporting-read bullet: "a read across systems in one adapter is not a reporting read; it reads each owner's open host service or a copy" |

### S3 — wording, stale references, unmarked choices

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R03-19 | 3 (R, A, S) | Ports and factories, both marker sentences; Terms | "One root per entry, and the registry, are this document's choices" sits one paragraph above "Fowler's registry, in two scopes": a choice credited to a book. S: the per-process scope read by driving adapters is Fowler's *service locator* (from memory), a departure from injection the sources prefer, unmarked; "ambient" is coined (van Deursen & Seemann's "ambient context", from memory; no hits in the three extracts); the headline criterion "when no use case or domain function decides by it" was written for per-request values and fits services only awkwardly; "The line is this document's choice" now follows two scopes. V: "never imports assembly" is unmarked though ticket 21's Grounding says both choices are. | closed (ticket 24, 3f3b3ee): "One root per entry, that a driving adapter never imports it, and the courier are this document's choices"; ambient paragraph names the service locator and "*ambient* is this document's word"; "Where the line between ambient and argument falls is this document's choice" |
| R03-20 | 1 (S) | Ports and factories, "imports what is static" | "**An adapter imports what is static and receives what is built.**" is a coined rule with no marker (Khononov p. 128 grounds receiving adapters, Fowler's *Plugin* late binding; neither the split). "A service … received", said of any adapter, clashes with "imports no service (question 6)" for driven adapters: the only service a driven adapter receives is another system's driving port. | closed (ticket 24, 3f3b3ee): "A service — a driving adapter's own; for a driven adapter, only another system's driving port — …: received. That adapters are received is Khononov's (p. 128) and Cockburn's; the split is this document's." |
| R03-21 | 1 (S) | Ports and factories, "receives its service" | "the sources say only that whoever starts the application wires it" understates them: Cockburn's user-side adapter "pass[es] the repository to use (real or mock) into the constructor of the application itself" — the driving adapter wires; Khononov p. 128 resolves ports "in the infrastructure layer, either through dependency injection or by bootstrapping". A root apart from the driving adapters departs from Cockburn's example, unmarked. | closed (ticket 24, 3f3b3ee): "In Cockburn's example the driving adapter wires the application itself; Khononov resolves ports 'in the infrastructure layer, either through dependency injection or by bootstrapping' (p. 128). A root apart from the driving adapters is this document's." |
| R03-22 | 2 (A, S) | Terms; Assembly paragraph; table | Terms used before definition: "the ambient registry" (Terms, defined in Ports and factories), "root" and "build functions systems export" (Assembly; the build function is defined in Other systems), "open host service", "published language", "specifications" (table). | Terms: "the ambient registry (Ports and factories)"; Assembly: "put in the registry (below)"; one-line Terms entries for *root* and *build function*, or "(below)" pointers |
| R03-23 | 4 (A, T, S, V) | Terms vs table, driven row; The layers | "a *repository* is a driven port over one aggregate's storage, and its adapter is a driven adapter" vs the cell "a repository over one aggregate" under implementations, "a repository method joins the caller's transaction", Q1 "the repository that owns the table", and "the repository mapping a row" (V: since ticket 19 the mapping is the adapter's). The word names the port and its implementation. | Terms: "*repository* names the port; its implementation is a repository adapter"; cell "a repository's adapter, one per aggregate"; "the repository's adapter mapping a row" |
| R03-24 | 2 (A, V) | Terms vs table, driving row | "A *driving port* is the interface to a use case — the way in" vs the cell "the ways in: controllers, hooks, …": the same phrase names the port and the adapters (pass 2 introduced it for R02-29). | cell: "the adapters on the ways in" |
| R03-25 | 1 (A) | Other systems | "open host service" in three senses: an interface plus language ("A system offers an open host service: its driving ports and its published language"), a built instance ("a function that … builds the open host service"), and a kind of system ("an open host"). | "builds the implementation of its open host service"; the system sense per R02-37 |
| R02-29 | 2 (R, A) | throughout | carried from review 02, row half closed (`544055e`). *entry* still means a process start ("Each entry — a server's start, a relay worker, a product's config", "One root per entry", "the entry's code") and a package export path ("an entry that loads only the domain", "pricing's entries", "a system's exported entries", "an entry production does not load"). | closed (ticket 24, 3f3b3ee): *entry* defined in Assembly as where a deployable starts; the module sense is "export path" throughout |
| R03-26 | 2 (A, V) | Ports and factories, "receives its service" | "As an argument where the entry's code constructs the adapter — a route, a product's hook": "entry's code" is undefined, and file-based routes are framework-collected (ticket 21's own Context names "a file-based API route" as such); a closure-factory route and a collected route get no distinct answer. | "As an argument where the root, or code it calls, constructs the adapter — a route registered by a closure factory, a product's hook; where the framework collects it — a server function, a file-based route — from a courier …" |
| R03-27 | 1 (T) | table, driven row | "a product's instance late-bound" is made universal; the body late-binds only "A product that calls back". | "a product's instance received, late-bound where the product calls back" |
| R02-41 | 4 (R, A, T, V) | Terms; table, both adapter rows | carried from review 02, worse: the table lists "a clock" among driven adapters and "the clock" among the callers of driving adapters; no body sentence names a clock adapter as driven ("a clock … can [reach outside], so they stay behind ports" is the package test). "a scheduled task is a driving adapter" three times (Terms twice, Products). "their validators" in the driving row, though the rule is a domain schema and only the act of validating is the adapter's (T-12). "Each is a fault the adapter prevents" — see R03-15. | Terms: "A timer that starts work is outside: a scheduled task is a driving adapter; a clock read for the time is a driven port." Drop the Reconciliation repeat. Drop "their validators". |
| R03-28 | 1 (T) | table, driving row; Terms | "Where its caller may deliver more than once — a relay, a webhook, a product's hook": the hook is the adapter, the caller is the product; the cell "called by the outside: a request, a webhook, a product's hook" copies the slip. | "a relay, a vendor's webhook, a product running a hook" |
| R03-29 | 2 (R, T) | table, cells | Small narrowings: service "or a copy" drops "if it offers no fitting read"; driving "where the caller stops retrying it records before anything can fail" drops "through its one service"; "it acts → one service as Products orders" does not fit step 4's hand-off; "tested against fakes, which fill the registry" drops "or the framework's context" (the body's "which" is itself ambiguous between the two); driven "a translation that changes nothing is conformist" reads as acceptable where the body orders "conform instead"; driving "its only door to the store is a service" widens "A controller's only door is a service" and `citations.md` claims the body has the cell's wording. | per cell: "or, where it offers no fitting read, a copy"; "records, through its one service, before anything can fail"; "it acts → as Products orders"; "which fill the registry or the framework's context"; "a translation that changes nothing is no anti-corruption layer: conform (question 8)"; "its only door is a service" |
| R02-06 | 1 (R) | Other systems, ACL bullet | carried from review 02, remaining half. "or in a module both adapters share" has no layer; "Not everything gets a layer" omits it. | "or in a module both adapters share, outside the layers like the common library" |
| R02-19 | 1 (R) | Terms; When to leave it alone | carried from review 02. A port that resolves the caller reads a session store with no service, against "A controller's only door is a service". | "A controller's only door to this system's aggregates is a service; a port that resolves its caller reads its own store" |
| R02-30 | 1 (R) | Other systems, export paragraph | carried from review 02. "the port types are exported type-only, or the entry loads the service that declares them" sanctions what the sentence forbids. | "the port types are exported type-only, so the entry still loads only the domain" |
| R02-31 | 2 (R, A) | Q7 tell | carried from review 02. "constructed inside a service body or a factory body" fires on a build function, which constructs adapters by design. | "inside a service body or a service factory's body; a system's build function is assembly" |
| R02-32 | 2 (R, A) | Q5 tell | carried from review 02. "a loop that calls a write per item" fires on repository calls inside one `run`. | "a loop that opens a transaction per item" |
| R02-33 | 2 (R, A) | Q4 tell; Q1 | carried from review 02. "writes two tables" and "count the tables it touches" count tables; the rule counts aggregates; Q1's "the repository that owns the table". | "writes two aggregates"; "count the aggregates it writes"; "the repository of the aggregate that owns the table" |
| R02-34 | 2 (R, A) | Q6 | carried from review 02. "a service import inside a driven adapter's file" fires on a port-type import from `service/pricing.port`; A: and misses a service received. | "a value import of a service (not its port type) inside a driven adapter's file, or a driven adapter that receives one" |
| R02-35 | 1 (R) | Q1 | carried from review 02. Heading "write" but the tell covers a query; "opaque in the domain" leaves the context a store client in the service. | "Does a service touch a table itself?"; "opaque to the service and the domain" |
| R02-36 | 2 (R, S) | Ports and factories, first paragraph | carried from review 02. "The rules declare what they need" — services call ports; ports in the domain is Khononov p. 127, Evans keeps such interfaces in infrastructure (pp. 53, 55, 76). Unmarked. | "Driven ports live in the domain, named in its terms, though services are what call them (Khononov p. 127; Evans keeps them in infrastructure)." |
| R02-38 | 1 (R) | Products, hook step 3 | carried from review 02. "the outbox is in a store this system's transaction port reaches through that transaction" is circular; "the product's" outbox names no port. Hint from ticket 23, unverified: step 3 now names the embedded record and the product's outbox as ways a write commits with the change, but the body may still say nothing about what reads an embedded message; ticket 23's Consequences suggest an outbox adapter over the product's store, a second implementation of the outbox port under the same contract suite. | "writes only a message, through the outbox port: to this system's outbox, or to an outbox adapter over the product's queue, whose relay is then the product's" |
| R02-39 | 3 (R, A, S) | Terms; rule 3; Products | carried from review 02. "acts through one service", "A service does not call another service of its system" unmarked and stricter than the books; "Steps 2 and 3 are this document's choice" leaves step 4, the first branch and "this system's outbox or the product's" uncovered. S: both rules now sit in the table unmarked. | mark each in one clause; "The hook order is this document's choice; the sources do not cover a product's transaction." (Q13) |
| R02-40 | 3 (R, A, S) | Terms, sources sentence | carried from review 02, worse: "The sources are Evans, Vernon, Khononov and Cockburn" while the body names Fowler ("Fowler's registry") and Richardson ("in Richardson's sense") and uses Freeman & Pryce's sense of integration test. | "…and Cockburn; where they are silent, Fowler, Richardson and Freeman & Pryce, named where used." |
| R02-43 | 1 (R) | rule 2 | carried from review 02. "In this case, the owner publishes" instructs another system. | "the owner must publish; where it cannot, a scheduled task of this system refreshes the copy" |
| R02-44 | 1 (R) | export list, fake item | carried from review 02. "a fake of its driving ports" — hand-written, or the build function wired with fakes? | "a fake: its build function wired with its own driven-port fakes, or a hand-written one that passes the consumers' contract suites" |
| R02-45 | 2 (R, V) | When to leave it alone | carried from review 02. "not a breach of one mutation per use case (`components.md`)" points at a phrase `components.md` never had. | drop the parenthesis, or "not a breach of one write per use case" |
| R02-46 | 2 (R, V) | `components.md`, Terms | carried from review 02. "A *controller* is a boundary adapter: … calls into one thing" while `layers.md` says it "applies the same role" and has "driving adapter", "acts through one service". | "A *controller* is a driving adapter (`layers.md`): it resolves what is needed, reads or acts through one thing, and returns. It holds no rules of its own." |
| R02-48 | 1 (R) | export list, handler item | carried from review 02. "for the assembly that hands it to the relay" — a root or a build function? | "for the root that hands it to the relay" |
| R02-50 | 2 (R, V) | outbox bullets, saga | carried from review 02. Ticket 11's "what wakes it — a delayed message, a scheduled task — is the codebase's" has no sentence; V: nor "a handler is named for the message it receives". | append "what wakes it is each codebase's choice"; "a handler is named for the message it handles, not for what it does" |
| R03-30 | 1 (A) | Q2 | "A controller that hands a repository a transaction and a callback" vs the snippet, which hands the callback to the transaction port. | "A controller that opens a transaction and writes inside it has not delegated a use case" |
| R03-31 | 1 (A) | Q3 tell | "a row shape for one table built in two places" fires on Q3's own fix, where both places spread `settledPatch`. | "a row shape for one table written as a literal in two places, rather than taken from one domain function" |
| R03-32 | 1 (A) | the checklist, small tells | Q8's third tell fires on a shared-kernel type or another system's id in the domain; Q1 misses a repository writing another aggregate's table; Q5's exceptions omit a handler's and reconciliation's own transaction; Q2 misses a controller that calls `tx.run` once (not "grown past one call"). Hint from ticket 23's cold read, may be nothing: Q5 now reads "hook step 2 or 4 opens", while in both steps the service opens the transaction, not the hook. | "one of the other system's terms (not a shared-kernel type or an id)"; Q1 "or a repository writing another aggregate's table"; Q5 "except where Transactions or Products open one: rule 1's recording, hook step 2, a handler's or reconciliation's own"; Q2 "or a driving adapter that calls anything but a service and a specification" |
| R03-33 | 1 (A) | ambient paragraph | "The transaction context is in neither scope: what a read returns depends on it" — the criterion is "no use case or domain function decides by it", and what a read returns is not that test; the locale changes what a rendering returns too. | "in neither scope: a use case decides which writes share it" |
| R03-34 | 1 (A) | rule 3; The layers | Non-sequiturs: "the call is a second transaction, and the outbox is the one that retries" (a nested call could join; the retry does not follow); "Running on any runtime is what lets … and importing it loads only the domain" (loading only the domain follows from "imports no layer"); "keeps a single constructor (question 3) possible: … parse against the same schema" (one schema, not one constructor). | "the called service opens its own transaction; where a second transaction is wanted, use the outbox, which retries"; "importing no layer is what keeps that import to the domain alone"; "is what keeps one schema" |
| R03-35 | 2 (A, V) | Ports and factories, Assembly | "so every dependency but fixed plumbing (question 7) is one a factory declared" vs per-request values "services and adapters read" and the registry a framework-collected adapter reads. | "…is one a factory declared, or a per-request ambient value" |
| R03-36 | 1 (A) | Other systems, published language | "re-exporting the domain, messages included, is this document's choice" reads as publishing the messages the same section calls private. | "re-exporting the domain's schemas, its published messages included" |
| R03-37 | 1 (A) | Tests | "An integration test is one that uses a real external dependency" vs "Driven adapters are integration-tested by design": an in-process ACL adapter over B's service has none. "runs it the second time against that system's open host service" — built with its real adapters or its fakes? A driving adapter is tested against a fake service, and no suite covers that fake; tests are told to fill the registry but not the per-request scope. | "Driven adapters that reach outside the process are integration-tested by design"; "against that system's open host service built with its real adapters"; "a driving adapter receives a fake service, kept honest by the service's own tests; tests fill the per-request scope too" |
| R03-38 | 1 (A) | rule 1, exception | "A driving port a system calls after its commit recognises a repeat" reads as a description, but is an obligation on the provider; whose port is unclear. | "Every driving port of this codebase that another system calls after its commit recognises a repeat." |
| R03-39 | 2 (A, R) | When to leave it alone; Terms | Garden paths: "even when the service exports the same name again, so that deleting a repository fails inside the service that names it rather than at a controller naming a symbol"; "so a handler of one records what it was given" ("one" reads as one item); Tests' "which the test fills with fakes" (the registry, the context, or either). | closed (ticket 23, bac336c) for the handler garden path: "so a driving adapter for such a caller records what it was given". Open: the When to leave it alone sentence and Tests' "which the test fills with fakes" |
| R03-40 | 1 (P) | rule 1; rule 3 | "a system writing several stores has an outbox in each store whose transaction writes the message" sits under rule 1 (another system's data) while the several-stores case is rule 3's ("required where no one transaction reaches them all, as for aggregates in different stores"). | move the clause to rule 3, or point from rule 3 to it |
| R03-41 | 1 (P) | Products | "a field this system owns is read-only there" and the "It acts" tree are never connected: for a field this system owns the tree is unreachable, for a field the product owns the hook is catalog's data changing (rule 2's copy). P (4). | one clause before the tree: "For a change to a field this system owns, the action calls the service (above) and the hook sees this system as the caller; the tree below is for a product's own change this system reacts to." |
| R03-42 | 1 (P) | What this does not cover | Instrumentation load order (P: 1) is ruled to the stack document (ticket 08) but `layers.md` does not say so; "What this does not cover" lists conventions only. | add: "Process start and load order — instrumentation first: the stack document." |
| R03-43 | 1 (P) | Ports and factories | "a server function built as a factory with no caller" (`domain.md` fault h) is a fault only by implication of "from a courier"; P: 2. | append to "It never imports assembly": "and is not a factory, since nothing calls one" |
| R03-44 | 1 (R) | Products, cycle bullet; Assembly paragraph | Two cycle-breakers for two cycles — "Assembly breaks it by late binding" (the instance cycle) and "put in the registry by one root and read, not imported, by the other" (two roots) — with nothing saying which breaks which; an agent reaches for the registry to break the instance cycle, or late binding between roots. | cycle bullet: "Assembly breaks the instance cycle by late binding: …; two roots in one process share through the registry (Ports and factories), never by import." |
| R03-45 | 1 (R) | Terms, common library | "plumbing every system may import: … the ambient registry" admits a service importing the registry module, while "a service reads nothing from that scope"; the service row carries neither. | "the ambient registry, read by driving adapters"; service row: "reads nothing from the per-process registry" |
| R03-46 | 1 (S) | When to leave it alone; table | "reporting read" is coined and unmarked (nearest: Vernon's use case optimal query, from memory). | "a reporting read (this document's term)" |
| R03-47 | 1 (V) | `tanstack-start.md` | "A `.schema.ts` composes domain schemas — pick, extend — and declares no rule of its own" vs the ACL rule that a foreign webhook schema lives in the adapter: a webhook server function's schema is not a domain schema. | "composes domain schemas, or holds the foreign schema of a webhook it translates (`layers.md`, Other systems)" |
| R03-48 | 1 (V) | `components.md` | "A compound is a root that owns the shared state" — *root* collides with `layers.md`'s composition root for an agent that loads both. Low. | "a compound's root component" |
| R03-49 | 2 (T, V) | table, `read` column | Fails the skill's own test ("the sections the row's citations name"): service lacks Terms and The layers; driven lacks The review checklist (Q5, Q6, Q8 cited); driving lacks Transactions (message handlers) and When to leave it alone; domain lacks Terms. | add the sections |
| R02-51 | 1 (S) | published language | carried from review 02. "Khononov keeps the two apart from the start" — Evans does too (pp. 264, 278); the table's "its schemas are the published language, by default" drops the marker, and Khononov p. 55 says the opposite. | "Evans (pp. 264, 278) and Khononov (pp. 55, 140) keep the two apart; making them equal, messages included, is this document's choice"; cell "by this document's default" |
| R02-52 | 1 (S) | driving ports | carried from review 02. "A use case is not a domain concept … This is what keeps the arrow pointing in one direction" vs Evans pp. 53, 76–77; the arrow is kept by the domain importing no layer. The table repeats it as "names no use case". | "A driving port belongs to the service layer; the domain may name the same operation as a domain service (Evans p. 76) but imports no port. This document's choice."; cell "imports no driving port" |
| R02-53 | 1 (S) | ACL bullet | carried from review 02. "foreign, unstable or not yours, as a third-party API's usually is" is looser than Evans p. 256 and Khononov p. 54 (page corrected from 53). | "For a model that is unfit, unstable, or would distort a core model (Khononov p. 54); a large, well-made third-party model may be conformed to (Evans p. 256)." |
| R02-54 | 1 (S) | outbox bullets, saga | carried from review 02; S rates it S2: Khononov p. 147 defines the saga as the long-running process itself, so "rather than Khononov's coordinating component" misreads him; "process manager, an aggregate" vs p. 152 "often implemented as aggregates"; choreography and orchestration are Richardson's words. | "a saga (Khononov p. 147; Richardson, from memory): the sequence of local transactions and their compensations"; "one system's process manager, often an aggregate of that system (Khononov p. 152), sends commands (orchestration, in Richardson's terms)" (Q13) |
| R02-55 | 1 (S) | Terms, specification | carried from review 02. Narrows Evans pp. 159–160 to validation, unmarked; now also in the table ("specifications", "a specification to ask"). | "a *specification* (Evans p. 159), here narrowed to validation: a domain predicate that takes the candidate and says whether it satisfies the rule" |
| R02-56 | 1 (S) | Ports and factories; table, service row | carried from review 02. "**A service is a factory.**" and the cell "a factory: … constructs nothing" use Evans's FACTORY (p. 99, builds aggregates) in another sense. | "A service module exports a factory function"; cell "a factory function: takes its dependencies, returns its driving port, constructs none of them" |
| R02-57 | 1 (S) | DDD-vocabulary paragraph | carried from review 02. "Evans's interface layer" is his "User Interface (aka Presentation Layer)" (p. 53); his domain depends on infrastructure; the inversion is Khononov's (pp. 126–127). | "roughly Evans's user interface layer, and driven adapters the implementation half of his infrastructure layer; Evans's domain depends on infrastructure (p. 53), the inversion is Khononov's (pp. 126–127)" (Q13) |
| R02-58 | 1 (S) | rule 1, exception | carried from review 02. "the sources do not cover it" — the pending state is Richardson's semantic lock (from memory); Khononov p. 246 covers notification plus query. | "the pending state is Richardson's semantic lock; calling after the commit for an answer is this document's choice" |
| R02-59 | 1 (S) | Tests | carried from review 02. "An integration test is one that uses a real external dependency" is coined; close to Freeman & Pryce, not Khononov p. 165. | "An *integration test*, in this document (close to Freeman & Pryce), is one that …" |
| R02-60 | 1 (S) | Other systems, after the bullets | carried from review 02. "The other context-map patterns describe how teams cooperate" — Khononov p. 49 frames all of them so; open host service and published language are the offer above (Evans pp. 263–264); partnership p. 50. | "Partnership and customer–supplier describe how teams cooperate (Khononov pp. 50, 53); open host service and published language are the offer above; separate ways is no integration." |
| R02-61 | 3 (R, A, S) | Preconditions | carried from review 02. "A *store*, in this document's narrowing" — coined, not narrowed; "*Table*, *row* and *aggregate* are used in the relational sense" — an aggregate is a consistency boundary (Khononov p. 87, Evans p. 90). | "A *store*, a term this document coins, is …"; "*Table* and *row* are used in the relational sense; an aggregate is assumed stored in rows" |
| R02-62 | 1 (S) | various, low | carried from review 02. The transaction port is Fowler's Unit of Work, unsaid; the build-function default is unmarked; "the interface to a use case" vs Cockburn's "two, three or four ports" and the one-port-per-service snippet; repository as port plus adapter is Vernon's split of Evans p. 108. | "(Fowler's unit of work, as a port)"; "; this document's choice"; "the interface to a service's use cases"; move "as Vernon joins it to DDD" after the repository clause |

### S4 — folder housekeeping and grounding

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R02-64 | 2 (R, V) | `spec-01.md` | carried from review 02. No rows for tickets 19 (`3ee8bf9`) and 20 (`800a7b3`), no Order line for them; row 21 points at this finding instead; row 08 lacks "superseded in part by 20"; row 10's note still says "infrastructure". The README rule that ticket and spec status always agree is broken. | add the rows under a "From review 01" line; fix the two notes (Q16) |
| R02-65 | 2 (R, V) | ticket 20 | carried from review 02. Resolution §1 still carries the import wording with a footnote only under Decision; Consequences "Nothing new is needed" though a sentence was added at apply time. | one-line note under Resolution |
| R02-66 | 2 (R, V) | `review-01.md` | carried from review 02. First Pickup notes "This file is uncommitted", "wait for approval before committing anyway", unmarked; no note for the R01-37 and R01-47 deviations. | mark the block superseded; add both deviations to "After the fixes" |
| R02-67 | 1 (V) | tickets 09, 12, 14; spec Grounding | carried from review 02. Ticket 12 "p. 171 per the Sharif library table of contents (from memory)" (verified pp. 145–147); ticket 14's "(from memory)" outbox and ch. 4; ticket 09's "summarized on Wikipedia"; spec "(pp. 255–256, ticket 09)" is ticket 14's. | update the three tickets; "ticket 14" |
| R02-68 | 2 (R, V) | spec Grounding; `extending-layers.md` | carried from review 02. Tickets 19, 20 and 21's checks are not listed; Fowler's *Plugin* missing from the fallback table; ticket 20's "Evans ch. 4 p. 54" lacks "manuscript". | add the lines |
| R02-69 | 2 (R, V) | `domain.md` | carried from review 02, the "imports Payload's instance" half is R02-03 above. "Its worker process has its own entry point and its own assembly" — the word is *root*. | "its own root" |
| R02-70 | 1 (V) | tickets 10, 11 | carried from review 02. Ticket 10's "'Calls into one thing' stays" and footnote "The row now says so" (the row is gone, R03-16); ticket 11's footnote 16. | footnotes |
| R02-71 | 1 (V) | tickets 01–18 | carried from review 02. "Done when" still "Approved and committed"; R01-12 dropped the wait. | leave as history; one README line |
| R02-72 | 1 (R) | source extracts | carried from review 02. Re-extracted this session into the scratchpad; gone again with it. | standing note in Pickup |
| R03-50 | 2 (T, V) | `citations.md` | Stale or weak citations: domain "rules" quote 1 ("A *system* is one bounded context") does not support the entry and quote 2 is labelled The layers but sits in Terms; service "use cases" says "The layers table is the only place that said it" though the body has "it is a use case calling a port"; driving `in → out` "a request" has no citation; "Entries dropped" claims the body has "its only door to the store is a service" (it has "A controller's only door is a service"); "**A driving adapter receives its service from the root.**" is both an entry and under "Leads with no row"; the no-row reason for rule 3 overstates what the service row's entry carries; two domain entries cite the summary itself (R02-42). All 89 quotes are otherwise verbatim; 72 body leads, all placed. | fix the seven; a citation never quotes the summary |
| R03-51 | 2 (R, V) | `summarize-layers/SKILL.md` | The skill says the table "states no rule of its own" and `citations.md` "is always complete", yet pass 1 kept an entry it could not cite (flagged "candidate finding") and dropped a ticket-19 rule and a review-01 ruling as "no sentence" (R03-16, R03-17). The skill says nothing about either case. | step 3: "An entry with no sentence is dropped and becomes a finding in `docs/layers-refinement/`; an entry that carries a ticket's or a review's ruling is not dropped: the pass opens a finding to put the sentence in the body." (Q22) |
| R03-52 | 1 (S) | page numbers in tickets and reviews | By the extract footers: Khononov's "resolved … dependency injection or by bootstrapping" is p. 128 (cited as 127 in tickets 20, 21, review 02); "industry-standard, well-established model" is p. 54 (cited as 53 in review 01, 02); Evans's AGGREGATE definition is p. 90 (cited as 92 in review 02). Khononov p. 127 stays right for "the business logic layer defines 'ports'". | correct where cited |
| R03-53 | 1 (V) | tickets 19, 21 | Ticket 19's inventory ("may import: whatever its port's implementation needs — a store client, a product's instance"), its Consequence "a driven adapter imports what its port's implementation needs" and its Decision's "composes nothing" are superseded by 21 and pass 1, unnoted. Ticket 21's pair 2 and Consequence "The driving-adapters row gains 'the registry' and nothing else" are superseded by pass 1; its Grounding "now covering both" is untrue for "never imports assembly" (R03-19). | footnotes |
| R03-54 | 1 (V) | `open-questions.md`, ticket 14 | Superseded lines unmarked in place: open question B's "falls under 'One module per process' (ticket 08)"; ticket 14's Consequence on question D ("shows up as a message in the outbox under step 3"), superseded by 18 and noted only there. | footnotes |
| R03-55 | 1 (V) | `review-02.md` | Q3, Q5 and Q14 are unmarked though settled, moot and dropped; the Pickup order is stale; "What held up" still lists "a server function and a product's hook import the root", now a fault. This review marks the file superseded, which covers it. | the superseded header added with this review |

## What held up

Pass P placed these at 5 from `layers.md` alone; leave them:

- a record two systems write is two aggregates sharing an id
- a hook on this system's own write does nothing; the mechanism is the codebase's
- Stripe behind an anti-corruption layer on the way out: port in the domain, schema and translation in the adapter or a shared module
- billing's handler: built by billing's exported function, handed to the relay, in its own transaction, through one service
- the 3PL webhook: translation in the adapter, record before anything that can fail, reconciliation for what is lost
- the ready-made tracer is not a question-7 fault; trace context is ambient; the domain must not import a module that brings `node:async_hooks`
- a TanStack Start server function: imports the registry accessor, reads its service at request time, not a question-7 fault, never imports assembly; tests fill the courier with fakes (ticket 21's acceptance target, twice)
- a Payload hook gets its service as an argument; the adapter gets a function returning the instance
- importing a ready-made instance from a service module, or the root, is ruled out by sentence

At 4: hooks as driving adapters with `req.user` as the caller; an owned field read-only in Payload admin; the instance cycle broken by late binding; checkout's commit-call-pending-deadline; the two-store case (now that "a store" is "what one transaction port makes atomic", up from 2); the billing write inside `tx.run` as a fault; payment's port recognising a repeat and the nested exception toward Stripe; the Stripe webhook; scheduled dunning; the ambient unit of work as a fault; payment built once at the root.

Pass V: every decision in tickets 01–21 has a carrying sentence except ticket 11's three
(R02-14, R02-50), ticket 09's command ownership (R02-13), ticket 19's "composes nothing"
(R03-17) and ticket 21's marker for "never imports assembly" (R03-19). Ticket 20's sweep (no "one
module per process", no controllers receiving instances) and ticket 21's sweep (no sentence has a
driving adapter importing the root) are clean. Every hash exists and touches `layers.md`; statuses
agree with the spec everywhere but the missing rows for 19 and 20. The table and `citations.md`
were committed together as the skill requires.

Pass T: of 91 table entries, 90 are cited and 72 of 72 body leads are placed. Faithful and needing
no change: the domain row's rules, the service row's in → out, the driven row's transaction and
contract-test entries, the driving row's hook order, ambient and acts-through-one-service entries.

Pass S, faithful: "the application layer: use cases" (Evans p. 53; Khononov p. 128 "application
layer = service layer = use case layer"; Cockburn's use cases at the application boundary); "the
model" (Evans p. 53 "Domain Layer (aka Model Layer)"); "open host service" as the offer (Evans
p. 263); the anti-corruption cell (Evans p. 256, Khononov p. 54); Fowler's registry as the name
for both scopes (from memory). Everything review-02's Source check listed as faithful is
unchanged.

## Source check

Only what changed since review 02 and the open R02 source findings were re-read; review-02's
Source check holds for every other term. Khononov (print pages from the extract footers) and
Evans (final manuscript) were read; Cockburn's page grepped. Fowler, Vernon, Richardson, Freeman
& Pryce and van Deursen & Seemann are from memory, flagged where cited. No S1: nowhere does the
document state the opposite of what it attributes to a book. R02-54 (Khononov's saga) and R03-21
(Cockburn's wiring) come closest.

| id | source | what it says | guidance |
| --- | --- | --- | --- |
| R03-19 | Fowler, *Registry* and *Service Locator* (memory); Cockburn | Registry: "a well-known object that other objects can use to find common objects and services", process-, thread- and session-scoped, "use sparingly". Reading services from a process-scoped registry is a service locator; Fowler and Cockburn ("The Dependency Injection pattern by Martin Fowler gives some implementations") prefer injection. | The attribution covers both scopes; the departure from injection for framework-collected adapters is the thing to mark. "ambient" has no source; say it is this document's word. |
| R03-20 | Khononov p. 128; Cockburn; Fowler *Plugin* (memory) | "The abstract ports are resolved into concrete adapters in the infrastructure layer, either through dependency injection or by bootstrapping." Cockburn: "pass the repository to use (real or mock) into the constructor of the application itself". Plugin: "Links classes during configuration rather than compilation." | Receiving adapters is grounded; the static-vs-built split is coined. Mark it. |
| R03-21 | Cockburn; Khononov p. 128 | Cockburn's user-side adapter wires the application and chooses mock or real ("the FIT adapter code to choose whether to pass in the mock or real repository's adapter … I omit"); or "configuration files and having the SPRING framework generate the equivalent code". | "say only that whoever starts the application wires it" understates both; the root apart from the driving adapters is this document's. |
| R02-54 | Khononov pp. 147, 152 | "A saga is a long-running business process … that spans multiple transactions"; "process managers are often implemented as aggregates". | Drop the contrast with Khononov; "often an aggregate". |
| R02-60 | Khononov pp. 49–50, 53; Evans pp. 263–264 | p. 49: the patterns "are driven by the nature of collaboration between teams"; p. 50 partnership; p. 263 open host service "Define a protocol that gives access to your subsystem as a set of SERVICES"; p. 264 published language. | Name partnership and customer–supplier as the team patterns; open host service and published language are code the document already uses. |
| R02-53 | Khononov p. 54; Evans p. 256 | p. 54: "the contract exposed by the upstream team may be an industry-standard, well-established model"; ACL for a core subdomain, an inefficient upstream, a contract that "changes often". Evans: "off-the-shelf component that has a large interface, you should typically CONFORM". | Page corrected to 54. Criteria as proposed. |
| R02-61 | Khononov p. 87; Evans p. 90 | "the aggregate also acts as a transactional boundary"; "An AGGREGATE is a cluster of associated objects that we treat as a unit for the purpose of data changes". | Page corrected to 90. Not a relational term. |
| R02-51, 52, 55, 56, 57, 58, 59, 36, 37, 39, 09 | as in review 02 | re-read; each page checks out; text unchanged, several now repeated in the table unmarked (R02-51 "by default", R02-52 "names no use case", R02-55 "specifications", R02-56 "a factory", R02-39 "acts through one service", "calls no service of its system"). | guidance as in review 02; the table inherits the body's marker once the body has one |

### Findings the sources do not touch

R02-01 to R02-07, R02-10 to R02-35, R02-38, R02-41 to R02-50, R02-63, R03-01 to R03-18,
R03-22 to R03-55 except R03-46: internal consistency, products, hooks, roots, the registry, the
table, the checklist, the folder. Decide them on the four tests alone.

## Pickup notes

For the session that works through this review.

- **Where:** worktree `.claude/worktrees/docs-layers-refinement`, branch `docs/layers-refinement`,
  HEAD `544055e` before this file. Nothing else in the branch was changed by the review.
- **Process:** `docs/extending-layers.md` steps 1–6 per change; commit per `CLAUDE.md`, no
  approval wait. One commit per finding or per group that touches one sentence; name the ids in
  the commit body. After any body change, run the `summarize-layers` skill: a cell that carries
  a rule the body now has gets its citation, a cell the body contradicts follows the body.
- **Order suggested:** the decisions below first; they settle R02-01, R02-04, R02-05, R02-12,
  R02-18, R03-01 (Q1, Q2, Q4, Q10), the registry wording (R03-02, R03-04, R03-06, R03-19, Q13,
  Q18, Q21) and the table-versus-body policy (R03-03, R02-42, R03-17, R03-51, Q20, Q22). Then
  the S1s; then the S2 table cells (R03-08 to R03-14) in one pass, since they are mechanical
  once the body is settled; then the S2 body gaps; S3 as two sweeps: checklist tells (R02-26,
  R02-27, R02-31 to R02-35, R03-06, R03-30 to R03-32) and markers (R02-36 to R02-40, R02-51 to
  R02-62, R03-19 to R03-21, R03-46). Siblings (R02-45, R02-46, R03-18, R03-47, R03-48) with the
  S3 sweep. S4 after `layers.md` is settled, with Q16 as one housekeeping commit.
- **Sources:** `~/Documents/*Khononov*.pdf`, `~/Documents/*Evans*.pdf` (filenames contain
  non-ASCII whitespace; use the globs); Cockburn at
  `https://alistair.cockburn.us/hexagonal-architecture/`. Extract with
  `pdftotext -layout <pdf> <out.txt>` into the scratchpad; this review's extracts are gone with
  its session (R02-72). Khononov page numbers are the print edition's as printed in the extract's
  footers (R03-52 corrects three earlier citations); Evans's are the final manuscript's.
- **Hits** count independent readers (six). A hit count of 1 is not a reason to drop a finding;
  most of pass S, the sharpest of pass A (R03-02, R03-15) and pass P's translate-or-record
  (R03-07) are singles.
- **Acceptance test** after any `layers.md` change: a fresh agent with only `layers.md`, placing
  the `domain.md` scenarios the change touches and reporting confidence 1–5 and its guesses. To
  re-run for this round: the Payload price adapter (R02-21, 3), the hook tree on an editor's
  change (R02-20, 3), two roots in one process (R03-04, 3; ticket 21's unmet target), the mail
  that cannot dedupe (R02-23, 3), the early `OrderCancelled` (R02-14, 3), the collection config
  (R02-28, 2), `/health` and the cache (R02-22, 2), a read inside `run` (R02-11, 2).

## Decisions the author has to make

**Grilled 2026-10-21, subgroup A (the S1s):** Q1 and Q2 became
`22-driving-adapter-prepares-and-acts.md`, Q4 and Q10 became `23-hook-defers-through-the-outbox.md`.
Tickets 22 (ac716ac), 23 (bac336c) and 24 (3f3b3ee) are applied; the findings they close are marked in their rows. The tickets rule where they differ from the recommendations below: Q1/Q2 generalize to "a
driving adapter decides nothing by this system's state; a port takes what its use case decides
by", and Q4 defers hook step 4 through the outbox rather than a pending row. Subgroups B
(registry wording: Q13's registry part, Q18, Q21, R03-02) and C (table vs body: Q20, Q22,
R03-17) are not grilled yet. Frontier drafted for B, one decision each, recommendation first:

- **B1, "built once" (R03-04, Q21):** conditional — a second root is a second consumer, so the
  reasons to escalate decide; otherwise each root builds its own. Alternative: always share.
- **B2, the other root reads late (R03-04, Q21):** it hands its adapters a function that reads
  the registry, as the Products bullet hands an adapter a function returning the instance; no
  start order. Alternative: the root that runs first builds (stack document's).
- **B3, courier sentence (R03-02):** "the per-process registry, once, or a framework context that
  middleware the root installs fills per request". Alternative: drop "once".
- **B4, registry markers (R03-19, R03-20, R03-21, Q13 part):** mark all five (service locator in
  Fowler's terms; "ambient" this document's word; the choices are one root per entry, never
  importing it, the courier; "imports what is static" this document's; the root apart from the
  drivers, Cockburn's driver named); no "(from memory)" in `layers.md`, that is the ticket's.
  Alternative: mark only the three that change what an agent does.
- **B5, tells (R03-06, R02-11, Q18):** fold into questions 7 and 5. Alternative: a tenth question.

**Grilled 2026-10-21, subgroup B:** became `24-one-root-per-process.md`, applied in 3f3b3ee. The ticket rules
against the draft above: there is one root per process (an entry is where a deployable starts; a
product is built by a build function this system exports, as another system is), so B1 and B2
dissolve rather than reword; B3 becomes a *courier* Terms entry; B4 all five markers; B5 folded
into questions 5 and 7. On the way: the outbox port is each system's driven port, not the common
library's, and the relay receives handlers and outbox readers from the root (the reader joins the
export list); R02-29's module sense of *entry* is renamed; R03-03's clause for subgroup C loses
"the outbox".

**Ruled 2026-10-21, subgroup C, not grilled:** the skill only. The author rules that the
summary summarizes and nothing else: every line between the tags, the sentence under the table
included, shortens a body sentence that states it; an entry the pass can only infer is not
written; a dropped ruling stays dropped and is recorded under "Entries dropped". `SKILL.md`
says so now (R03-51, Q22 answered against the recommendation: a pass never keeps or restores
what the body lacks). The cells follow on the next pass, after ticket 24 lands: the arrow and
import sentence (R02-42), "the common library's ports" (R03-03) and the two self-citing domain
entries fall out unless the body gains the sentence, which is the author's choice and not the
skill's; Q20 stays open as that choice. "Composes nothing" (R03-17, R03-32) stays dropped; a
question-1 tell is a body change and is not drafted. Ticket 22 settled R03-16 on the way.

Settled by the text or by a commit and not asked: review-02's Q0 (ticket 21), Q3 (the import
column is gone; which root builds is each codebase's), Q5 (no import columns remain), Q14
(dropped by ticket 21); Q6's first half, a driven adapter may receive another ("A service, an
adapter, a product's instance: received", `525c559`), so only its Q2 tell remains and is
mechanical; the clock is both a driven port read for the time and, as a timer, outside (follows
from the package test and "A clock is outside"; R02-41's wording is mechanical); how a hook
recognises this system as the caller stays the codebase's (ticket 18); instrumentation load order
stays the stack document's (ticket 08; R03-42 adds the pointer); the four layer names and the
root per entry hold; every table cell that narrows or widens its sentence follows the body once
the body is settled (R03-08 to R03-14, R03-27 to R03-29 are mechanical); the S4 housekeeping is
mechanical.

❓ **Q1** - **Ask, then act (R02-01, review-02 Q1)**: an adapter that needs data to ask "may this
caller do this" calls a service to ask, then a service to act: two calls, and Q2 fires. Does the
acting service enforce the rule itself, so the adapter calls one function and gets a refusal, and
a question-only service exists only for a screen that hides a button?

➡️ Yes. "The service that acts loads the data, asks the specification, and refuses." The
adapter's specification call stays for input it holds (validity), not for permissions that need
a load.

---

❓ **Q2** - **Authorization lives in the service (R02-18, R03-01, R03-05; review-02 Q2)**: the
summary pass has already written "its driving port takes its caller, and authorization lives here
or in the domain" for every driving port, while the body still scopes it to ports another system
calls, and the ambient paragraph keeps "the user an audit column records" as a second home for
the caller. Does every driving port take its caller and refuse in the service, with the
controller's specification call only shaping what it shows, and the ambient user kept only where
no port takes the caller?

➡️ Yes. One rule for every caller; the moment a port is exported, controller-side authorization
is bypassed. The table then stays as it is and the body catches up; the alternative is to narrow
the cell back. Follows from Q1.

---

❓ **Q4** - **Hook step 4 records before it hands off (R02-04; review-02 Q4)**: the delivery rule
says a handler of a product's hook "records what it was given … before anything that can fail";
step 4 hands off in memory to an undefined "handler" and accepts loss. Does step 4 record the
change as pending through one service, in this system's own transaction, and let a driving
adapter that runs after the product answers check it through the product before acting?

➡️ Yes. It makes step 4 a case of step 2's mechanism plus a check, names the handler's layer, and
the general rule holds without an exception. The alternative, marking step 4 as the exception,
keeps a path that loses work on purpose.

---

❓ **Q7** - **Message ordering as a property (R02-09; review-02 Q7)**: "the version of the
aggregate that wrote it" fails when a write emits no message and when a receiver has several
writers; Stripe and the 3PL send no version. Does the bullet state the property — an id, and what
a receiver needs to order a writer's messages — and leave the mechanism to the codebase?

➡️ Yes. Khononov p. 245 asks for ordering per writer and names no mechanism; "a per-writer
sequence" can stay as the example.

---

❓ **Q8** - **Early arrivals: record or fail, stated positively (R02-14; review-02 Q8)**: three
readers again scored or asked this. Does the bullet say "fail so the caller retries, or record it
and apply it when the delivery it waited for arrives, is each codebase's choice; a relay allows
both, a caller that stops only the second"?

➡️ Yes. The positive form is what the README's grilling notes ask for; it also carries ticket
11's decision, which pass V finds not landed.

---

❓ **Q9** - **A command belongs to its handler's published language (R02-13; review-02 Q9)**:
ticket 09 ruled "needs no clause"; two cold reads could not derive it. Does a command belong to
the published language of the system that handles it, imported by the sender like a driving-port
type, while an event belongs to the publisher?

➡️ Yes. It is the conformist bullet applied to messages; one sentence.

---

❓ **Q10** - **Who calls the third party (R02-05, R02-12; review-02 Q10)**: "a handler of this
system calls it" has the driving adapter calling Stripe, which pass A now rates a contradiction
of "acts through one service"; "a duplicate is repaired by … reconciliation" contradicts
reconciliation's definition. Does rule 1 say "a message handler calls one service, which calls
the third party through its driven port", and "a duplicate is undone by a compensating call,
which reconciliation starts when it finds one"?

➡️ Yes. The first is a derivation of the driving-adapters row; the second keeps reconciliation's
definition and gives the duplicate a saga step.

---

❓ **Q11** - **Restore the three spec-01 rulings as sentences (R02-21, R02-22, R02-28; review-02
Q11)**: the cold read again placed the Payload price adapter at 3, the collection config at 2,
`/health` and the cache at 2. Does each get one sentence in `layers.md`: an owned aggregate
stored in a product has an adapter that is both repository and translator, joining this system's
transaction where the port reaches the product's tables; an endpoint that reports on the process
is not a use case; a store's own schema is not a second constructor; a server-side cache is a
driven port the writing use case invalidates?

➡️ Yes. "Only `layers.md` ships"; a ruling that lives in the spec is one a fresh agent cannot
read. Two rounds at the same confidence say the derivation is not there.

---

❓ **Q12** - **"Open host service" as this document's term, and the conformist default scoped
(R02-37, R03-25; review-02 Q12)**: every system "offers an open host service", while "an open
host" is a system "that publishes its model on purpose", which is Evans's sense; read literally,
conformist becomes the default toward products and third parties. Does one clause mark the first
as this document's use and Evans's sense, and does the conformist default name its scope: a
system of this codebase, with an anti-corruption layer the default toward a product or third
party?

➡️ Yes. R01-47 kept the phrase consciously; a marker costs one clause, and the scoped default is
what the ACL bullet already says in other words.

---

❓ **Q13** - **Markers, one sweep (R02-39, R02-54, R02-57, R03-19, R03-20, R03-21; review-02
Q13)**: "one service", "no service-to-service" and the whole hook order get "this document's
choice"; the saga sentence stops contrasting Richardson with Khononov and says "often an
aggregate"; the vocabulary paragraph says "roughly Evans's user interface layer" and credits the
inversion to Khononov; the registry paragraph names the service-locator departure and "ambient"
as this document's word, and the choice marker covers "never imports assembly" and "the courier"
rather than "the registry" next to "Fowler's registry"; "imports what is static" and "whoever
starts the application wires it" get their markers. Apply all as passes S and A proposed?

➡️ Yes. None changes what an agent does; each stops a reader who knows the books from
distrusting the rest, and the table inherits every marker from the body.

---

❓ **Q15** - **Shared kernel is domain code (R02-15; review-02 Q15)**: the bullet names a module
and nothing else, and nothing says the domain may import it. Does it say "a shared kernel is
domain code: pure, any runtime, importing neither system; both domains import it"?

➡️ Yes. Derivation from "The domain runs on any runtime"; one clause.

---

❓ **Q16** - **Spec rows for tickets 19 and 20, and the rest of S4 (R02-64 to R02-71, R03-52 to
R03-54; review-02 Q16)**: add a "From review 01" block with both rows, and in the same commit the
ticket-20 note, the review-01 marks, the grounding carry-backs, the page corrections and the
ticket 19 and 21 footnotes?

➡️ Yes, as one housekeeping commit after `layers.md` is settled.

---

❓ **Q17** - **Who prevents a repeat (R03-15, R02-41)**: "Each is a fault the adapter prevents"
puts the dedupe on the driving adapter, while "the receiver's aggregate records the last version
it handled" puts the state in the aggregate; an adapter that dedupes needs a store read, which
only a service may do. Does the sentence become "Each is a fault the receiving use case prevents;
the adapter passes the id and version through"?

➡️ Yes. It is a derivation of "its only door to the store is a service"; the adapter keeps
resolving, validating and translating, and the service keeps the deciding.

---

❓ **Q18** - **Tells for the three rules without one (R03-06, R02-11)**: "calls no service of its
system", "never imports assembly" and "a service reads nothing from the per-process registry"
fire no question; nor does a writing call to another system's port inside `run`. Do Q7's tell
gain the registry read and the root import, and Q5's tell the sibling-service call and the
writing call inside `run`, rather than a tenth question?

➡️ Yes. Each is the fault an existing question already describes in prose ("the design working"
in Q7's case, "second transaction" in Q5's); a tenth question would split one fault across two
headings.

---

❓ **Q19** - **Translate first or record first for a caller that stops (R03-07)**: the ACL bullet
has the driving adapter translate "before it calls a service", and the delivery rule has it
record "what it was given, through its one service, before anything that can fail"; translation
can fail. Does the record take the delivery as received, opaque, and translation happen when the
record is applied — so a delivery that fails translation is still recorded and reconciliation or
a fix can replay it?

➡️ Yes. "What it was given" already means the raw delivery; the alternative, translate first,
loses exactly the deliveries a schema change breaks, which is the case the rule exists for. The
service that records takes the raw payload as a value, not as this system's terms.

---

❓ **Q20** - **The import rule and the domain's imports in the body (R02-42, R03-03)**: the only
statement of "every layer may import the domain, it imports no layer" is inside the summary tags,
and the domain's closed import list exists only in the table, with "the common library's ports"
granted by no sentence. Does the body get one sentence for the import rule ("no other layer
imports another; a service and an adapter arrive as arguments") and one clause granting the
domain the common library's port types, with the cell restated as the body's test rather than a
list?

➡️ Yes. The skill's claim that the table states no rule of its own has to be true for the table
to be trusted; the domain needs the transaction port's context type, and that is the sentence
that was missing.

---

❓ **Q21** - **Two roots in one process: who reads when (R03-04)**: a product-config root
constructs its hooks as closures when the config loads, so if the server root builds shop the
config root reads the registry at load time, against "reads it when it runs, not when it loads".
Does the sentence say the other root reads the registry when its adapters run (the hook receives
a function returning the service, as the adapter receives one returning the instance), keeping
which root builds as each codebase's choice, and drop "as the reasons to escalate decide"?

➡️ Yes. It reuses the late-binding shape the Products bullet already has, needs no start order,
and removes the dangling clause four readers tripped on. The alternative, "the root that runs
first builds", fixes an order the stack document should own.

---

❓ **Q22** - **What a summary pass may drop (R03-17, R03-51)**: pass 1 dropped a ticket-19 rule
and a review-01 ruling as "no sentence" and kept an entry it could not cite. Does the skill say
that an entry without a sentence becomes a finding and leaves the table, and that an entry
carrying a ticket's or review's ruling is never dropped but opens a finding to put its sentence in
the body?

➡️ Yes. The table is a summary; a pass that changes what the document rules is a ticket in
disguise. The two cases here (R03-16, R03-17) then come back as body sentences through the normal
process.
