# Review 04: `layers-revised.md` after the restructure, pass 1

**Reviewed:** `registry/docs/agents/layers-revised.md`, `layers-revised-examples.md`,
`layers-revised-review.md`, `layers-revised-provenance.md`, uncommitted on branch
`docs/layers-refinement-wt` off `b1e2434`, with `layers.md` at `b1e2434` as the source, tickets
01–24, `domain.md`, `review-03.md`, `extending-layers.md` and the books (Khononov, Evans PDFs
extracted; Vernon, Cockburn, Fowler, Richardson from memory) as context. Does not supersede
`review-03.md`: that review is of `layers.md`; this one carries its open findings against the
new files and adds what the restructure introduced.
**Date:** 2026-10-21
**Verdict:** not mergeable as is; structurally sound. The restructure lost nothing: every ticket
01–24 decision, every `domain.md` "placed as a fault" bullet and every review-03 "what held up"
scenario has a carrying sentence (pass V), and every snippet, checklist question and marker landed
(pass T). It introduced four S1s of its own — one renumbering bug, two table cells promoted to body
rules that now contradict the body (DVN-1, DVN-2), one new definition (*aggregate*) that makes
TX-3 step 3 unreachable — and widened S-TX-2. It closed 9 of review-03's 112 open findings and
made 9 moot; 68 are still open in moved form, most of them the S2 gaps the decisions Q7–Q19 ruled
on but never applied. The cold read (pass P) placed 30 scenarios at 5:9 / 4:15 / 3:4 / 2:2 / 1:0;
review-03's lows (`/health`, cache, collection config, price adapter, hook tree) are unchanged.

Findings are anchored by rule id and quoted text.

## Method

Six independent readers, then merged:

| pass | reader | input | purpose |
| --- | --- | --- | --- |
| R | fork of the authoring session | review-03 + the four files | carry every open review-03 finding: moot, closed by restructure, still open, worsened |
| P | fresh Opus agent | `layers-revised.md`, `-examples.md` only | place 30 `domain.md` scenarios; confidence 1–5 and what it had to guess |
| A | fresh Opus agent | the four files only | adversarial read against the doc's own contract (stated once, Terms are definitions, S- entries narrow one rule, ids resolve): contradictions, non-sequiturs, drift, gaps, tells firing on allowed code |
| T | fresh Opus agent | `layers.md` + the four | every normative sentence of `layers.md` traced to a home; every id reference resolved; duplicates; rules inside Terms |
| V | fresh Opus agent | the four + tickets 01–24, `domain.md`, review-03 | per ticket decision a carrying sentence; "placed as a fault"; "what held up" |
| S | fresh Opus agent | `layers.md`, the two docs, `extending-layers.md`, PDFs | every marker in `layers.md` found in provenance under the right id; residue in the body; book terms used in a non-book sense |

**Hits** = how many of the six raised it independently. Review-03 ids in brackets name the carried
finding.

Pass P confidence (scenario numbers are this review's; the first 24 follow review-03's order,
25–30 are assembly and saga):

| confidence | scenarios |
| --- | --- |
| 5 | 3 (two-writer record), 5 (hook on own write), 8 (checkout commit–call–record), 12 (Stripe ACL), 15 (billing handler), 19 (worker root), 26 (server function), 27 (hook by argument, late-bound instance), 29 (hook message in product tx) |
| 4 | 1, 4, 7, 10, 11, 16, 17, 18, 20, 21, 22, 25, 28a, 30, 11b |
| 3 | 2 (price adapter), 6 (collection config), 9 (two store clients), 14 (Stripe webhook: translate or record), 28b (port with no caller) |
| 2 | 23 (cache), 24 (`/health`, `/metrics`) |
| 1 | — |

## Carry-forward of review 03

Pass R, 112 open findings (R03-39's open half counted):

| sev | open in R03 | moot (table, skill, citations gone) | closed by restructure | still open | worsened | out of scope (folder, siblings) |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | 1 | 0 | 0 | 0 | 0 | 1 |
| S2 | 30 | 5 | 3 | 20 | 1 | 1 |
| S3 | 58 | 2 | 6 | 45 | 2 | 3 |
| S4 | 15 | 2 | 0 | 0 | 0 | 13 |
| **total** | **112** | **9** | **9** | **65** | **3** | **18** |

Closed by restructure: R03-03 (domain import list now a body rule, DOM-1), R03-09 (DRV-4 keeps the
ACL condition), R03-12 (TX-2 points at S-PRD-1), R03-22 (terms defined before use), R03-26
("entry's code" gone), R03-36 (private message adjacent), R03-40 (several-stores clause under
TX-4), R03-44 (two-roots sentence gone), R02-45 (parenthesis dropped). Moot: R03-10, R03-11,
R03-13, R03-14, R03-17 (author ruled "composes nothing" stays dropped), R03-29, R03-49, R03-50,
R03-51. Worsened: R03-08 → R04-02, R03-27 → R04-10, R02-19 → R04-11. Every other open finding is
carried below with its review-03 id in brackets; its row there has the full text.

Review-03 decisions Q7, Q8, Q9, Q11, Q12, Q15, Q17, Q19 were answered yes and none is applied in
the new text (R04-04, 05, 13, 14, 15, 16, 17, 20, 21, 22, 26, 31). Q16 (folder) is untouched.

## Findings

Severity as in review 03: **S1** contradiction or wrong instruction; **S2** gap a fresh agent
fills wrongly; **S3** wording, stale reference, wrong pointer, duplicate, unmarked choice; **S4**
housekeeping. *Introduced* = not in `layers.md`; the restructure made it.

### S1 — contradictions

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-01 | 1 (T) | S-PRD-1 3.2 "Where the product offers a hook that runs after its commit and before it answers, step 1 applies" | *Introduced.* The acts ladder was renumbered 1–4 → 3.1–3.4; "step 1" now names the top-level step ("the hook does nothing"). The closing paragraph already says "step 3.2's work", so the new numbering is in force. | "step 3.1 applies" |
| R04-02 | 2 (A, R) [R03-08] | DVN-1 "A driven adapter implements a driven port the domain declared (DOM-6)" vs SYS-3 "an HTTP client, a driven adapter of A, implementing the same port", examples SVC-1 "tx: TransactionRunner // driven port, from the common library", Terms *Relay* "through the reader that system exports" | *Introduced* (a table cell promoted to a rule). Three adapters the doc requires implement ports this domain did not declare: another system's driving port, the common library's transaction port, the outbox reader the relay types. DVN-1 forbids all three. | DVN-1: "A driven adapter implements a driven port: one this domain declared (DOM-6), another system's driving port (SYS-3), or a common-library port." |
| R04-03 | 2 (A, V) | ASM-1 "calls the factories and, for each system, the build function that system exports" vs SYS-6 "The consuming system's build function builds the other system, by default … building B inside the root is ceremony" | ASM-1 has the root call every system's build function; SYS-6 has it call only the consuming system's. Pre-existing wording, now adjacent rules. | ASM-1: "for each system this entry hands to a driving adapter or the relay, the build function that system exports; a system another system consumes is built there (SYS-6)" |
| R04-04 | 4 (A, R, V, P) [R03-15] | DRV-2 "Each is a fault the adapter prevents" vs DRV-1 "decides nothing by this system's state" vs TX-5 "the receiver's aggregate records the last version it handled" | Deduping and detecting an early arrival need this system's state; DRV-1 forbids the adapter that, TX-5 puts the state in the aggregate. Q17 answered yes, not applied. P (14): "doc assumes our own version field". | DRV-2: "Each is a fault the receiving use case prevents, by what its aggregate records (TX-5); the adapter passes the message's id and version on." |
| R04-05 | 3 (A, R, P) [R03-07] | DRV-2 bullet 3 "records what it was given, through its one service, before anything that can fail" vs DRV-4 "translates it into this system's terms before it calls a service" | Translation can fail; the two sentences order a webhook adapter's work opposite ways. Q19 answered yes (record the raw delivery), not applied. P (14, 18): "pull against each other". | DRV-2 bullet 3: "records the delivery as received, opaque, through its one service; translation (DRV-4) happens when the record is applied" |
| R04-06 | 1 (A) | S-PRD-1 3.1 "The product has committed the change. The hook acts through one service." + closing "An act after the commit is lost … Reconciliation repairs that" vs DRV-2 bullet 3 "a product may not run a hook again, so a driving adapter for such a caller records what it was given … before anything that can fail" | Two instructions for the same post-commit hook: record first (DRV-2) or act and lean on reconciliation (3.1). | 3.1: "The hook records what it was given through one service (DRV-2); the handler acts." — or 3.1 keeps acting and DRV-2 names hooks as the exception |
| R04-07 | 3 (A, S, R) [R02-61] | Terms *Aggregate* "A cluster of records written as one unit" vs TX-3 step 3 "Does it write several aggregates of this system? → One transaction"; Scope "*Table*, *row* and *aggregate* are used in the relational sense" | *Introduced* definition. By it, records written in one transaction are one aggregate, so step 3 is unreachable. S: Evans's glossary is "a cluster of associated objects treated as a unit for the purpose of data changes" — a consistency boundary, not a relational term; the Scope clause contradicts the Terms entry. | Terms: "A cluster of records with one invariant, loaded and saved by one repository (Evans)." Scope: drop *aggregate* from the relational clause. Provenance row: several aggregates per transaction is TX-3 step 3's departure, already listed. |
| R04-08 | 2 (R, V) [R02-03] | `domain.md`, placed-as-fault (g): "imports Payload's instance as any driven adapter imports what its port's implementation needs" vs DVN-2 "a product's instance: received … late-bound (PRD-5)" | Out of scope for the new files; carried because the review domain tells a ticket author the opposite of the document. | `domain.md`: "receives Payload's instance, late-bound (DVN-2, PRD-5)" |

### S2 — gaps a fresh agent fills wrongly

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-09 | 4 (T, V, A, S) | S-TX-2 "The rules that assume a transaction do not apply to it" (heading: narrows TX-2); Scope "where one cannot, S-TX-2 applies" | *Introduced* widening. `layers.md` lapsed only question 5; the new body lapses TX-1, TX-3, TX-4, TX-5 and S-TX-1 too, and could be read as waiving TX-3 step 1. Heading and body disagree on what is narrowed. S: Khononov p. 146 grounds the embedding positively. | Body: "TX-2 does not apply to it; an aggregate's outgoing messages are embedded in its own record, and TX-3 step 1 holds." Provenance row: Khononov p. 146. |
| R04-10 | 1 (R) [R03-27] | DVN-2 "A product's instance is late-bound (PRD-5)" | *Introduced* widening: PRD-5 late-binds only a product that calls back; DVN-2 makes it universal. | "a product's instance, late-bound where the product calls back (PRD-5)" |
| R04-11 | 2 (A, R) [R02-19] | ARR-2 "A driving adapter's only door to the store is a service" vs DRV-1 "resolving the caller (a session, a signature, a key) through a port it receives" | *Worsened*: "A controller's only door is a service" became a standalone rule for every driving adapter. A session store read through the resolver port is a door to a store with no service, and no rule says where that port is declared (DOM-6 covers this system's needs only). | ARR-2: "A driving adapter's only door to this system's aggregates is a service; a port that resolves its caller reads its own store." |
| R04-12 | 1 (A) | PRD-4 "That function is the one place where the product learns of this system" vs PRD-2 "A change comes through an action there — a button, an endpoint — which is a driving adapter that calls this system's service" | An action in the product is a second place the product learns of this system, unless the build function hands it over. | PRD-4: "…the one place where the product learns of this system: its hooks and its actions (PRD-2) are handed to it there." |
| R04-13 | 2 (A, R) [R02-13] | Terms *Message*; SYS-2; TX-3 step 1 | Whose published language a command belongs to is unsaid; conformist default and "the owner publishes" pull opposite ways. Q9 answered yes, not applied. | Terms *Message*: "A command belongs to the published language of the system that handles it; an event to the system that writes it." |
| R04-14 | 2 (A, R) [R02-15] | Terms *Shared kernel* "in a module both import and neither changes alone"; DOM-1 grants it as an import | Whether a shared kernel is domain code bound by DOM-1–DOM-7, and where it lives (not a system, not the common library, not in Scope's list), is unsaid. Q15 answered yes, not applied. | SYS-5: "A shared kernel is domain code of both systems: pure, any runtime, importing neither; it sits outside any system, beside the common library." |
| R04-15 | 3 (A, R, P) [R02-21] | Terms *Repository*, PRD-5 "adapters over the product's instance", Terms *Store* | An adapter over an aggregate this system stores in a product: a repository or an ACL adapter, does it take the context, is the product's client a second store. P (2): 3, "doc says one-vs-two stores is each codebase's choice — I had to pick". Q11 answered yes, not applied. | PRD-2: "The adapter over that aggregate is a repository that also translates: it receives the product's instance and joins this system's transaction where the transaction port reaches the product's tables; where it cannot, the product's tables are a second store (S-TX-3)." |
| R04-16 | 3 (A, R, P) [R02-14] | DRV-2 bullet 2 "is not a repeat" | Says what an early arrival is not; what the handler does is said only inside S-PRD-1 3.4. P (17): "fail-and-retry vs recording ahead; doc prescribes the fix only for products". Q8 answered yes, not applied. | DRV-2 bullet 2: "What the receiver does with it — fail so the caller retries, or record it and apply it when the delivery it waited for arrives — is each codebase's choice; a relay allows both, a caller that stops only the second." |
| R04-17 | 3 (A, R, P) [R02-23] | DRV-2 bullet 1 "Handling it a second time changes nothing"; TX-3 step 1 "the message is the retry" | A handler whose effect is a third-party call that cannot dedupe (mail): record before or after the send; "a repeat may duplicate" is said only in S-TX-1. P (10): 4, "no exactly-once recipe". | TX-5 or TX-3 step 1: "Where the third party cannot recognise a repeat, the handler's service records the call before making it, and a repeat finds the record; a crash between the two duplicates, and reconciliation cannot repair a mail." |
| R04-18 | 3 (A, R, P) [R02-20] | S-PRD-1 3.1–3.4 | How a hook knows which step applies (pre- or post-commit, transaction handed in, caller waiting) is unsaid; 3.2 depends on what the product's caller knows, not the hook. P (4): "that Payload's afterChange runs pre-commit — stack knowledge". | S-PRD-1 preamble: "Which step applies is a property of the hook the product offers — before, inside or after its commit — read from its documentation and fixed per hook in an ADR, not of the change." |
| R04-19 | 1 (A) | S-PRD-1 step 2 "It asks, such as whether a change is valid → a specification answers it" vs SVC-2 "A question that needs this system's state … is the acting service's" | A validity question that needs state (uniqueness) has no route: step 2 names only a specification. | Step 2: "a specification answers it from the input; a question that needs this system's state goes through one service (SVC-2)" |
| R04-20 | 3 (A, R, P) [R02-28] | DOM-4; review Q3 "a row shape for one table built in two places" | A store's own table definition (ORM table, a product's collection config) is a second description of the row; whether it is a second constructor is unsaid and Q3's tell fires on it. P (6): 3. Q11 answered yes, not applied. | DOM-4: "A store's own schema — an ORM table, a product's collection config — is not a second constructor; the repository's adapter maps it to the domain's." |
| R04-21 | 3 (A, R, P) [R02-22] | ARR-2, DRV-1; Scope | `/health`, `/metrics` have no sentence; ARR-2 literally forces a service for a database ping. P (24): 2. Q11 answered yes, not applied. | Scope: "An endpoint that reports on the process — health, metrics — is not a use case; it reaches what it pings directly and sits outside these layers." |
| R04-22 | 3 (A, R, P) [R02-22] | SYS-6 "a cache, a pool"; review Q2 tell | A server-side cache has no sentence: which layer, who invalidates; a cache decorating a repository is "a driven adapter importing another" under Q2. P (23): 2. | DVN-4: "A cache is a driven port of the system that owns the data, decorating another adapter in assembly; the use case that wrote invalidates it." |
| R04-23 | 1 (A) | Terms *Outbox* "the *outbox reader* is what the relay reads it through"; ASM-5 "imports none" | The reader's interface must be declared where the relay can import it — the common library — which no sentence says; with R04-02 its adapter is then forbidden. | Terms *Outbox*: "the outbox reader implements the common library's reader port" |
| R04-24 | 1 (A) | DRV-1 lists inbound work only; Terms *Driving adapters* "their validators and inbound translation" | Mapping a result or a domain error back to a response is never placed. | DRV-1: "…and maps the result, or the error, back for its caller" |
| R04-25 | 2 (A, P) | PRD-4 "this system's product module" | "product module" appears once, belongs to no layer; P (7): when the product is also listed as a system and several systems embed it, whose module. | Terms: "*Product module*: the driven-adapter module of a system that holds the product's build function and the adapters over its instance; one per embedding system." |
| R04-26 | 2 (R, P) [R02-09] | TX-5 bullet 1 "an id, and the version of the aggregate that wrote it" | Fails for writes that emit no message, for a receiver with several writers, and for a vendor's webhook that sends no version. P (14). Q7 answered yes, not applied. | "an id, and what a receiver needs to order it among its writer's messages — a per-writer sequence, for example; how, each codebase chooses. A delivery not from an outbox carries what the sender gives." |
| R04-27 | 1 (R) [R02-17] | S-PRD-1 3.2 "which touches no row the product's transaction holds" | A foreign key to the product's uncommitted row blocks; an agent cannot know which rows a product's transaction locks. | "which writes only this system's tables and refers to the product's record by id, with no foreign key" |
| R04-28 | 2 (A, R) [R02-24] | Terms *Build function* "takes configuration"; ASM-1 "The root builds the adapters … calls the factories"; SYS-6 "builds B once and hands it to A's build function" | After escalation a build function receives built systems, which its definition does not take and which makes it a factory by the *Factory* term; who builds a system's own adapters — root or build function — is two-way. | Terms: "takes configuration, and the systems the root built for it (SYS-6), and builds the open host service, its own adapters included"; ASM-1: "builds the adapters its own driving adapters need" |
| R04-29 | 1 (R) [R02-25] | S-TST-1 "The receiving system writes the suite" | Reads as the provider. | "The consuming system — the one that receives the port as a dependency — writes the suite" |
| R04-30 | 1 (R) [R02-26] | TX-5 bullet 2 "no field renamed, removed, made required or narrowed"; review Q9 | Misses a field added as required, a widened enum, a change of meaning. | "renamed, removed, added or made required, narrowed, widened to a value an older handler does not know, or changed in meaning" |
| R04-31 | 3 (R, S, P) [R02-37] | SYS-1 "A system offers an open host service" vs SYS-5 "the default for an open host, a system that publishes its model on purpose" | Read literally, conformist is the default toward products and third parties; S: Evans reserves the term for a protocol many consumers share. P (1): whether Payload's user is conformed or translated — guessed. Q12 answered yes, not applied. | SYS-5: "Conformist is the default toward a system of this codebase that publishes its model on purpose; toward a product or a third party, the default is an anti-corruption layer." Provenance row for the OHS use. |
| R04-32 | 1 (R) [R02-63 (c)] | DVN-3 "a read across its system's aggregates" | A cross-system join is a fault only by implication. P (22): 4, guessed whether a reporting system with copies may join. | DVN-3 append: "a read across systems in one adapter is not a reporting read; it reads each owner's open host service or a copy (TX-3 step 2)" |
| R04-33 | 1 (R) [R02-42] | ARR-1 "The arrow runs one way — driving adapter → service → driven adapter → the outside — … every layer may import it, it imports no layer" | Mixes calls with imports: read as imports, a service imports a driven adapter (ASM-2's fault). "No other layer imports another" is unsaid. | ARR-1: "Calls run one way — …. Imports point only at the domain and at port types: no layer imports another; a service and an adapter arrive as arguments (ASM-2)." |
| R04-34 | 1 (P) | SVC-2 "A driving port takes what its use case decides by, the caller included" | Reads absolute; a clock-driven or relay-driven port has no caller. P (28b): 3. | "the caller included where one exists" |
| R04-35 | 1 (P) | S-TX-1 | Chained synchronous calls (shop → payment → Stripe, each needing the answer) are not addressed; P (13): 4. | S-TX-1 append: "A system called this way may itself be in S-TX-1 toward a third party; each link holds its own pending state." |
| R04-36 | 1 (S) | Terms *Store* | *Introduced* loss: "in this document's narrowing" dropped and no provenance row, though `extending-layers.md` names *store* as the example of a marked narrowing. | Provenance row: "Terms: store — coined; narrows the ordinary word to what one transaction port makes atomic." |
| R04-37 | 2 (V, R) [R02-50] | Terms *Handler*; TX-5 bullet 4 | Ticket 11's "a handler is named for the message it handles, not for what it does" and "what wakes a waiting step is the codebase's" have no sentence. | Terms *Handler* append "named for the message it handles"; TX-5 bullet 4 append "what wakes it — a delayed message, a scheduled task — is each codebase's choice" |

### S3 — wording, pointers, duplicates, Terms purity, unmarked choices

**Pointers and the S- contract**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-38 | 2 (T, A) | SVC-3 *Allowed* "A write goes through TX-3 or S-TX-1, never inside `run`" | TX-3 is the whole ladder; only step 1 is the outbox. | "TX-3 step 1 or S-TX-1" |
| R04-39 | 2 (T, A) | TX-2 "the transaction stays inside its system → S-PRD-1 step 3" | Step 3 has four sub-cases; only 3.3 crosses. | "→ S-PRD-1 step 3.3" |
| R04-40 | 1 (A) | TX-2, TX-4, DRV-1 (no `→ S-TX-2`, `→ S-PRD-1`); S-TX-1 "(narrows TX-3 step 1)" though it opens a transaction of its own; Special cases "Each narrows one general rule" vs S-PRD-1 "(narrows DRV-1, TX-2)" | The intro's contract (the rule points at its narrowing) holds for TX-3 only; S-TX-1 narrows TX-2 too; the section lead says "one". | Add the arrows; S-TX-1 "(narrows TX-3 step 1, TX-2)"; lead "Each narrows the general rules it names." |
| R04-41 | 1 (A) | SYS-2 "*Narrowing:* a separate language is allowed where …" | The only inline narrowing; the contract puts narrowings in S- entries. | S-SYS-1 "a published language apart from the domain (narrows SYS-2)"; SYS-2 "→ S-SYS-1" |
| R04-42 | 3 (T, V, A, S) | DVN-2 "An adapter imports what is static and receives what is built. … A service — a driving adapter's own; for a driven adapter, only another system's driving port — an adapter that resolves or translates its caller, a product's instance: received." | Governs both adapter kinds but sits under Driven adapters and no DRV- rule points at it; the sentence is unparseable (A). | Move to Arrow as ARR-4, split the list: "Received: its service (a driving adapter's own, DRV-3; a driven adapter receives only another system's driving port, SYS-3), a resolver or translator of its caller, a product's instance (PRD-5)." Re-key the provenance row. |
| R04-43 | 1 (T) | review Q2 header cites DVN-3; Q4 header "— `components.md`" | Q2 never mentions the reporting read; Q4 names no rule where every other header does. | Q2: add "*Fine:* a reporting read (DVN-3)"; Q4: "— TX-2, `components.md`" |

**Duplicates** (the contract is "stated once")

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-44 | 2 (T, A) | DRV-3 "reads the courier when it runs, not when it loads" / ASM-3 "reads it when it runs, not when it loads (DRV-3)" / ASM-4 "The courier is used only where the framework collects a driving adapter and the root cannot construct it" / DRV-3 same condition / Terms *Courier* same condition | Courier rule four times. | ASM-4 holds the rule; DRV-3, ASM-3 and Terms point. |
| R04-45 | 2 (T, A) | SVC-5 / ASM-2 "or read from the per-process registry there" / ASM-3 "a service reads nothing from it (SVC-5)" | Three times. | SVC-5 only; ASM-2 and ASM-3 point. |
| R04-46 | 2 (T, A) | Terms *Entry* "It has one *root*" / ASM-1 "One root per entry"; Terms *Factory* "A service is one" / SVC-1 "A service is a factory"; Terms *Entry* "and so is a build function" / Terms *Build function* "It is that system's assembly" | Rules in Terms restating body rules. | Terms: "its *root* is the code that builds what it runs"; drop "A service is one"; drop one of the assembly clauses. |
| R04-47 | 2 (T, A) | Terms *Context-map relationships* (ACL: "domain declares a driven port in its own terms, and a driven adapter translates"; shared kernel: "in a module both import and neither changes alone") / SYS-5 same | Where-it-goes stated in Terms and in the rule. | Terms one line each: "translate at the boundary"; "model both systems own jointly". |
| R04-48 | 1 (A) | SVC-1 "Nothing inside it constructs anything" / ASM-2; DOM-6 "assembly picks their implementations" / ASM-1 "the only place that knows both a port and its implementation"; SYS-3 "a dependency it receives" / SYS-5 conformist "a driven port a service receives like any other"; SVC-2 "the caller included" / SYS-4; Terms *Saga* / TX-5 bullet 4 "new steps undo the earlier ones"; PRD-1 / Terms *Product* / Terms *System* "so is a product"; PRD-3 / Terms *Hook*, *Scheduled task*; Scope "roots … outside these layers" / ASM-1 "Assembly is not a layer"; ASM-5 / ASM-1 "hands the result … to the relay" | Nine more restatements. | Keep one home each; the other points by id. PRD-1 → "The rules of Other systems apply to a product."; PRD-3 → "The rules on driving adapters apply to a product's hooks and scheduled tasks." |
| R04-49 | 2 (T, A) | S-PRD-1 3.2 "If the product rolls back, reconciliation undoes the work" / closing "undoes step 3.2's work when the product rolls back" | Inside one entry. | Drop one. |
| R04-50 | 2 (T, A) | Terms *Outbox* "written in the transaction that produced them" / TX-3 step 1 "in the same transaction"; with S-TX-2 (no transaction) the Terms clause is also wrong | Rule in a definition; contradicts the non-atomic case. | Terms: "written with the change that produced them" |

**Terms carrying rules**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-51 | 2 (T, A) | Terms *Controller* "a server controller passes a write through to one service, a route controller does not carry writes at all"; *Common library* "It holds no model"; *Reconciliation* "A scheduled task of this system, or any driving adapter that finds the two apart, calls it"; *Relay* "until it is taken"; *Aggregate* "belongs to the system whose use cases write it" | Rules inside definitions, against "Definitions only". V-9 adds: a driving adapter that "finds the two apart" decides by this system's state (DRV-1). | Controller clause → DRV-1 or a `components.md` pointer; "holds no model" → a rule (DOM-8 or ASM-6); reconciliation's caller → "called by a scheduled task, or by a service handed evidence of a difference"; aggregate ownership → DOM-5 or keep as the definition of *belongs*, by choice. |

**Term drift**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-52 | 1 (A) | DRV-3 "a route, a server's handler" vs Terms *Handler* | *Handler* used for an HTTP handler. | "a route, a request listener" |
| R04-53 | 1 (A) | SYS-1 "a build function for its handler"; ASM-1 "its handler"; Terms *Relay* "the handlers" | One handler per system that dispatches, or several, is unsaid. | SYS-1: "for its handlers — one or several, as the system routes" |
| R04-54 | 2 (A, V) | Terms *Courier*, ASM-2, review Q7 "the per-process registry"; Terms *Common library* "the ambient registry" | *Registry* never defined; two names for it. | Terms *Ambient value*: "The *registry* is the common-library object that holds per-process ambient values."; one name throughout. |
| R04-55 | 1 (A) | Terms *Courier* "the framework's request context, which middleware the root installs fills per request" vs Terms *Ambient value* per request | The request context is the courier for per-process values and the per-request scope; the two scopes share a holder and the words overlap. | Courier: "…or the framework's request context into which middleware copies what the root built; the per-request values it also carries are ASM-3's" |
| R04-56 | 2 (A, R) [R03-25] | Terms *Open host service* (interfaces) vs SYS-1 "a build function for the open host service" (instance) vs SYS-5 "an open host" (a kind of system) | Three senses. | Build function: "builds the services behind its open host service"; the system sense per R04-31. |
| R04-57 | 2 (A, R) [R03-23] | Terms *Repository* "A driven port over one aggregate's storage" vs SVC-4 "the repository that owns the table", TX-2 "A repository method joins", DOM-4 "the repository mapping a row", TX-2 *Allowed* "several tables stay one transaction" | Port and implementation share the word; per aggregate vs per table. | Terms: "*repository* names the port; its implementation is a repository adapter"; SVC-4 "the repository of the aggregate that owns the table"; DOM-4 "the repository's adapter mapping a row"; TX-2 "several aggregates stay one transaction" |
| R04-58 | 1 (R) [R03-24] | Terms *Driving port* "the way in" vs Terms *The layers* "Driving adapters: the ways in" | Same phrase for the port and the adapters. | "the adapters on the ways in" |
| R04-59 | 2 (A, R) [R02-41] | Terms *The layers* "a clock" under driven adapters; Terms *Scheduled task* "the clock calls"; PRD-3 "a product's … scheduled tasks" (A-33: the product calls, not the clock); "their validators" | Clock on both sides; a product's scheduler unnamed; validators listed though the rule is a domain schema. | Terms: "A timer that starts work is outside: a scheduled task is a driving adapter a clock or a scheduler, a product's included, calls; a clock read for the time is a driven port." Drop "their validators". |
| R04-60 | 2 (A, R) [R03-28] | DRV-2 "a relay, a webhook, a product's hook" | The hook is the adapter, the caller is the product; a scheduler that reruns is missing (A-59). | "a relay, a vendor's webhook, a product running a hook, a scheduler" |
| R04-61 | 1 (A) | DRV-3 "receives its service from the root" vs Terms *Entry* "the root is assembly, and so is a build function"; DRV-3 "the adapters a product's build function takes" | Build functions construct adapters too; "root" too narrow. | "receives its service from assembly" |
| R04-62 | 1 (A) | SYS-5 ACL "calling the other system's driving port" | A third party has no driving port in this doc's sense. | "calling the other system's driving port or API" |
| R04-63 | 1 (A) | DRV-2 "A relay retries until the handler succeeds" vs Terms *Relay* "until it is taken … what counts as taken, is each codebase's" | A codebase that counts a dead letter as taken breaks "failing is safe". | DRV-2: "A relay retries until the message is taken (Terms), so failing is safe there" |
| R04-64 | 1 (A) | ASM-3 "the user an audit column records" ambient vs SVC-2 "the caller included" argument | Same user from two sources; a repository may decide by the ambient one. | ASM-3: "the user an audit column records, when no rule decides by it; the caller a use case decides by is an argument (SVC-2)" |
| R04-65 | 1 (A) | TX-4 "an outbox in each store" vs SYS-1 "a build function for the reader of its outbox" | Several outboxes, one reader export. | "for the reader of each of its outboxes" |
| R04-66 | 1 (A) | PRD-3 "What a hook does is decided by S-PRD-1" | A product's scheduled task has no deciding rule. | "What a hook or a product's scheduled task does is decided by S-PRD-1." |

**Garden paths, non-sequiturs, stale wording**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-67 | 1 (A) | SVC-2 "A service that only answers, for a screen that hides a button, is called instead of acting, never before it." | Garden path; "instead of acting" reads as the service acts. | "A service that only answers exists for a screen; the acting service never relies on its having been asked." |
| R04-68 | 2 (A, R) [R03-38] | S-TX-1 "A driving port a system calls after its commit recognises a repeat." | Reads as description; an obligation on the provider inside a special case. | Move to SYS-4: "Every driving port of this codebase that another system calls after its commit recognises a repeat." |
| R04-69 | 2 (A, R) [R02-30] | SYS-1 "the port types are exported type-only, or the export path loads the service that declares them" | "or" reads as an alternative. | "exported type-only; otherwise the export path loads the service that declares them" |
| R04-70 | 1 (A) | PRD-4 "the function carries what the product needs there another way, inside itself … nothing outside the function sees which" | A framework-imported config module is outside the function; "inside itself" cannot hold. | "the config module reads a courier the build function fills; both are the product module's" |
| R04-71 | 1 (A) | Terms *Courier*, whole sentence | Garden path. | "A *courier* is the per-process registry or the framework's request context; it carries what the root built to a driving adapter the framework collects." |
| R04-72 | 1 (A) | DOM-4 "every place that builds that row spreads it" | "spreads" unclear. | "derives from it" |
| R04-73 | 1 (A) | Scope "Code that asserts about the source tree rather than about the application" | Architecture tests and lint rules are meant. | say so |
| R04-74 | 2 (A, R) [R03-34] | SVC-3 "the call is a second transaction, and the outbox is the one that retries"; DOM-2 "Running on any runtime is what lets … and importing it loads only the domain" | Non-sequiturs: a nested call could join; loading only the domain follows from DOM-1. | SVC-3: "a second use case is a second transaction; a use case that must follow another is started by a message (TX-3)"; move the loading clause to DOM-1 |
| R04-75 | 1 (A) | SVC-3 "deciding they share goes in the domain" vs DOM-6 "The domain names no use case" | The domain cannot decide what two use cases share without knowing them. | "the rule they share is one domain function both call" |
| R04-76 | 2 (A, R) [R03-39] | SVC-4 *Allowed* "so that deleting a repository fails inside the service that names it rather than at a controller naming a symbol"; TST-4 "which the test fills with fakes" | Garden paths carried from `layers.md`; the "so that" is a side benefit as reason. | Drop the clause or "; a side effect: …"; TST-4 "the test fills the courier with fakes" |
| R04-77 | 1 (A) | DOM-7 "The transaction context is opaque in the domain, so nothing there names the store"; DOM-6 "a use case is not a domain concept, so the domain never learns the name of one" | Reversed "so". | DOM-7: "Nothing in the domain names the store or its client; the transaction context is opaque there." |
| R04-78 | 2 (A, R) [R03-35] | ASM-1 "a service module exports only its factory, and assembly holds the instances, so every dependency but fixed plumbing (ASM-2) is one a factory declared" | Conclusion does not follow from module layout; per-request ambient values are read, not declared. | Two sentences; "…is one a factory declared, or a per-request ambient value" |
| R04-79 | 1 (A) | TST-5 "a unit test of one asserts a mock of the thing it exists to reach" | Garden path. | "can only assert against a mock of the thing it exists to reach" |
| R04-80 | 2 (A, R) [R02-38] | S-PRD-1 3.3 "or when the product has an outbox of its own" vs TX-4 "The outbox is this system's" | Writing this system's message into a product's outbox contradicts TX-4 unless the field-on-the-record case is meant; the product's outbox names no port. | "or when this system's outbox is a field it owns on the product's record (TX-4), or an outbox adapter over the product's queue" |
| R04-81 | 1 (R) [R03-33] | ASM-3 "The transaction context is in neither scope: what a read returns depends on it" | Not the criterion the paragraph states. | "in neither scope: a use case decides which writes share it" |
| R04-82 | 1 (R) [R03-41] | PRD-2 vs S-PRD-1 | A field this system owns vs the hook tree are never connected. | PRD-2 append: "For a change to a field this system owns, the action calls the service and the hook sees this system as the caller (S-PRD-1 step 1); the tree is for a product's own change this system reacts to." |
| R04-83 | 2 (R, P) [R03-42] | Scope "Not covered" | Instrumentation load order ruled to the stack document (ticket 08) but not pointed at. P (20): inferred. | add "Process start and load order — instrumentation first: the stack document." |
| R04-84 | 2 (R, P) [R03-43] | DRV-3 | A server function built as a factory with no caller is a fault only by implication. P (26): 4. | append "and is not a factory, since nothing calls one" |
| R04-85 | 2 (R, V) [R03-45] | Terms *Common library* "the ambient registry" vs SVC-5 | The list admits a service importing the registry module. | "the per-process registry, read by driving adapters" |
| R04-86 | 1 (R) [R02-43] | TX-3 step 2 "In this case, the owner publishes" | Instructs another system. | "the owner must publish; where it cannot, a scheduled task of this system refreshes the copy" |
| R04-87 | 1 (R) [R02-44] | SYS-1 "a fake of its driving ports" | Hand-written, or the build function wired with fakes? | "a fake: its build function wired with its own driven-port fakes, or a hand-written one that passes the consumers' contract suites" |
| R04-88 | 1 (R) [R02-48] | SYS-1 "for the assembly that hands it to the relay" | Root or build function? | "for the root that hands it to the relay" |
| R04-89 | 1 (R) [R02-53] | SYS-5 ACL "foreign, unstable or not yours, as a third-party API's usually is" | Looser than Evans p. 256 and Khononov p. 54. | "unfit, unstable, or would distort a core model; a large, well-made third-party model may be conformed to" |
| R04-90 | 2 (A, R) [R02-60] | SYS-5 "The other context-map patterns describe how teams cooperate" | Khononov frames all of them so; OHS and PL are the offer above. | "Partnership and customer–supplier describe how teams cooperate; open host service and published language are the offer above; separate ways is no integration." |
| R04-91 | 1 (R) [R03-37] | TST-1 vs TST-5 "Driven adapters are integration-tested by design"; S-TST-1 "against that system's open host service"; TST-4 | An in-process ACL adapter has no external dependency; built with real adapters or fakes is unsaid; tests fill the per-process scope but not the per-request one. | "Driven adapters that reach outside the process are integration-tested by design"; "built with its real adapters"; TST-4 "and the per-request scope" |
| R04-92 | 1 (V) | TX-1 | Ticket 15's "billing's driving port takes no context" is derivable, not stated; `domain.md`'s "the call moves outside the transaction" is unconditional while SVC-3 lets a read stay inside. P (11a): 4. | TX-1 append "A driving port takes no transaction context."; `domain.md` "a write moves outside" |
| R04-93 | 2 (A, R) [R03-30] | DRV-1 "hands a repository a transaction and a callback" vs examples DRV-1 (the callback goes to the transaction port) | Sentence and snippet disagree. | "A driving adapter that opens a transaction and writes inside it has not delegated a use case" |
| R04-94 | 1 (T) | Terms *Specification* "returns whether it is acceptable" (was "returns the answer"); Terms *Controller* dropped "It takes its rules from the domain" | *Introduced* narrowing and one dropped clause. | Decide: keep the narrowing (S-3 then marks it) or restore "returns the answer"; "holds no rule of its own" → DRV-1 |
| R04-95 | 1 (P) | ASM-3 per request | That the per-request scope spans in-process systems is not stated. P (21): 4. | "shared by every system in the process; a message carries it across processes" |
| R04-96 | 1 (P) | SYS-6 reasons | A handler or outbox reader that must exist once is not among the reasons. P (25): 4. | reason 1: "a cache, a pool, a subscription, a handler the relay must receive once" |

**Review checklist tells**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-97 | 2 (A, R) [R02-34] | Q6 "a service import inside a driven adapter's file" vs SYS-1, SYS-5 | Fires on the type-only import of another system's driving port the ACL adapter must make. A rates S1. | "a value import of a service of its own system (another system's port type, exported type-only, is allowed: SYS-1, SYS-5), or a driven adapter that receives one" |
| R04-98 | 2 (A, R) [R02-32] | Q5 "a loop that calls a write per item" vs TX-2 "A loop that calls `run` per item" | Fires on repository calls inside one `run`; body is right, review doc stale. | "a loop that calls `run` per item" |
| R04-99 | 1 (A) | Q1 "or a service reaching for a store handle to query it, against any table" vs SVC-4 "writes no table itself" | The tell has no rule behind its read half. | SVC-4: "A service writes or reads no table itself" — or drop the clause |
| R04-100 | 2 (A, R) [R02-10] | Q2 "a driven adapter that gained an import of another driven adapter" | No rule forbids it; fires on a module both adapters share (SYS-5) and a reporting read importing two mappers. | "an import of another driven adapter's port implementation or of a service; a module both adapters share is not one" |
| R04-101 | 1 (R) [R02-31] | Q7 "constructed inside a service body or a factory body" | Fires on a build function. | "inside a service body or a service factory's body; a system's build function is assembly" |
| R04-102 | 1 (R) [R02-33] | Q4 "writes two tables", "count the tables" | Counts tables; the rule counts aggregates. | "writes two aggregates"; "count the aggregates it writes" |
| R04-103 | 1 (R) [R02-35] | Q1 heading "write" | Tell covers a query. | "Does a service touch a table itself?" |
| R04-104 | 1 (R) [R02-27] | Q8 "a message schema copied field for field from the system that publishes it" | Fires on the third-party schema an inbound ACL must hold. | "Or, used past the driving adapter, a message schema copied field for field …" |
| R04-105 | 1 (R) [R03-31] | Q3 "a row shape for one table built in two places" | Fires on Q3's own fix. | "written as a literal in two places, rather than taken from one domain function" |
| R04-106 | 2 (A, R) [R03-32] | Q5 "except where S-TX-1 or S-PRD-1 step 3.2 or 3.4 opens one"; Q8 third tell; Q1; Q2 | A handler's and reconciliation's own transaction omitted; Q8 fires on a shared-kernel type or an id; Q1 misses a repository writing another aggregate's table; Q2 misses a controller calling `tx.run` once. | Q5 "…, a handler's or reconciliation's own (TX-5)"; Q8 "(not a shared-kernel type or an id)"; Q1 "or a repository writing another aggregate's table"; Q2 "or a driving adapter that calls anything but a service and a specification" |
| R04-107 | 1 (A) | review doc, whole | Non-linter faults with no question: a third party called inside `run`; a handler with no id/version pass-through; a populated relationship in an aggregate; authorization in a controller; an untranslated webhook. | Q10 "Does a use case call another system's write directly? — TX-3 step 1"; Q11 "Does a repeating caller's adapter pass id and version on? — DRV-2, TX-5" |

**Provenance**

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-108 | 3 (S, A, R) [R02-56] | Terms *Factory* "A service is one"; SVC-1 | Evans's FACTORY builds aggregates; here a dependency-taking constructor function. No row. | Row: "Terms: factory, SVC-1 — not Evans's FACTORY; a constructor function, this document's use." Or rename. |
| R04-109 | 2 (S, R) [R02-55] | Terms *Specification* | Evans's SPECIFICATION has validation, selection and building-to-order; narrowed to validation. No row. | Row. |
| R04-110 | 3 (S, A, R) [R02-54] | Terms *Saga* "process manager, an aggregate of that system"; provenance "rather than Khononov's coordinating component" | Khononov p. 147 defines the saga as the process itself, so the contrast misreads him; p. 152 "often implemented as aggregates"; *process manager* = orchestrator is Richardson's saga orchestrator, not Khononov's PM (which differs by branching, not orchestration). | Saga row rewritten per pass S; Terms "often an aggregate". |
| R04-111 | 2 (S, R) [R02-57] | Terms "driving adapters are the interface layer"; provenance "Evans's interface layer" | Evans's is "User Interface (aka Presentation Layer)"; his domain depends on infrastructure, the inversion is Khononov's. Also the only source-vocabulary sentence left in the body (S-9). | "roughly Evans's user interface layer"; credit the inversion; drop from the body or keep as orientation. |
| R04-112 | 1 (S) | ASM-3 row "a service locator in Fowler's terms" | Service locator is Fowler's 2004 IoC article, not PoEAA, which is the listed fallback. | Cite the article in `extending-layers.md` or drop "in Fowler's terms". |
| R04-113 | 2 (S, A) [R02-40] | provenance intro "The sources are Evans, Vernon, Khononov and Cockburn" vs rows citing Fowler and Richardson; Freeman & Pryce's sense of integration test used | Source list incomplete. | "…and Cockburn; where they are silent, Fowler, Richardson and Freeman & Pryce, named where used." |
| R04-114 | 2 (S, R) [R02-62, R02-59, R03-46] | TX-1/TX-2 (Evans: a repository leaves transaction control to the client; Fowler's unit of work never named); TST-1 (Freeman & Pryce, narrower); DVN-3 "reporting read" (coined, undefined in Terms); DOM-5 (Vernon); S-TX-2 (Khononov p. 146); SYS-5 last paragraph (collapse to three); Terms *Aggregate* ownership by writer; TX-3 step 1 outbox for third parties; TST-6 contract tests | Rows missing; `extending-layers.md` wants coined terms defined in Terms. | Add rows; Terms entry for *reporting read*. |
| R04-115 | 2 (S, R) [R02-36, R02-39, R02-51, R02-52, R02-58] | DOM-6 (ports in the domain: Khononov p. 127; Evans keeps them in infrastructure); DRV-1 "one service" and SVC-3 unmarked as stricter than the books; SYS-2 row names Khononov only (Evans pp. 264, 278 too); DOM-6 vs Evans's domain service (p. 76); S-TX-1 pending state is Richardson's semantic lock | Review-03's open marker findings, now rows to add. | One row each. |
| R04-116 | 1 (S) | SVC-3 row "Khononov's application service is the transaction" | Khononov says application *layer* operation (p. 86 fn 7). | "Khononov's application layer operation is the transaction (p. 86, fn 7)" |
| R04-117 | 1 (S) | DRV-3/ASM-1 row key | The courier is also Terms and ASM-4. | Key "Terms: courier, DRV-3, ASM-1, ASM-4" |
| R04-118 | 1 (A) | provenance DRV-1 "that the adapter reads no state of its own follows from its only door being a service" vs DRV-1 "resolving the caller … through a port it receives" | The adapter does read state through the resolver port; "reads no state" misquotes. | "that the adapter decides by none of this system's state follows from ARR-2" |

### S4 — housekeeping

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R04-119 | 1 (T) | DOM-1 dropped "Runtime validation is not an exception carved out for one package; it falls out of the test"; SVC-1/DOM-6 dropped "This is what keeps the arrow pointing in one direction"; TST-2 dropped "and it is what the default suite runs against"; TST-6 dropped "where the open host service reaches a real dependency" (kept in S-TST-1) | Rationale clauses dropped deliberately; listed so the drop is on record. | None, or restore the first. |
| R04-120 | 1 (A) | DVN-3 is only an *Allowed:* clause; SYS-2 "A private message is not published" restates Terms *Message*; ASM-2 "Nothing builds its own dependency" overshoots build functions | Shape. | DVN-3 "A driven adapter decides nothing. *Allowed:* …"; drop the SYS-2 sentence; "Nothing outside assembly builds …" |
| R04-121 | 1 (A) | examples SYS-1 `export type { Pricing }` under "loads only the domain"; examples TX-1/TX-2 tag omits TX-3 step 3 | Comment and tag incomplete. | "type-only, so the service module is not loaded"; tag "TX-1, TX-2, TX-3 step 3" |
| R04-122 | 1 (A) | DOM-1 "the common library's ports" vs Terms *Common library* list (one port) | Plural misleads. | "the common library's transaction port" (and the reader port, R04-23) |
| R04-123 | 1 (A) | Terms *Open host service* "the schemas, types and errors those ports take" vs SYS-1 "the published language; the driving port types" | Port types listed apart from a language that contains "types those ports take". | SYS-1: "the published language, the driving port types included" |
| R04-124 | 1 (V) | ticket 19 "composes nothing" | Author ruled it stays dropped (review-03 subgroup C); V proposes ARR-3 "and no other driven adapter of its system". | None unless the ruling changes. |
| R04-125 | — | `summarize-layers` skill, `citations.md`, `<layers-summary>` references in `README.md`, `extending-layers.md` step 5, review-03 pickup notes | Table tossed; the skill, its citations and three documents still describe it. | Delete the skill and `citations.md`; rewrite README layout bullet and `extending-layers.md` step 5 for the four-file layout and the id scheme. |
| R04-126 | — | review-03 S4 rows R02-64 to R02-72, R03-52 to R03-55; siblings R03-18, R02-46, R03-47, R03-48 | Folder and sibling housekeeping; untouched by the restructure. | As in review-03. |

## What held up

Pass P placed at 5 from the two shipped files alone: the two-writer record (Terms *Aggregate*);
the hook on this system's own write (S-PRD-1 step 1); checkout's commit–call–record with pending
state (S-TX-1, SYS-3); Stripe behind an anti-corruption layer (DOM-6, SYS-5); billing's handler
built by its build function, handed to the relay, one service in its own transaction (SYS-1,
ASM-5, TX-5); the worker's root and fulfillment's five exports (ASM-1, SYS-1); the server function
reading its service from the courier at run time, never importing the root, tested by filling the
courier (DRV-3, ASM-3, TST-4); the hook by argument and the instance late-bound (DRV-3, PRD-5); a
hook's message in the product's transaction (S-PRD-1 3.3). P explicitly credited the id scheme:
every placement names the rules it stands on, which review-03's pass P could not do.

Pass V: all 24 tickets, all nine "placed as a fault" bullets and all 21 "what held up" scenarios
have a carrying sentence; no ticket decision is contradicted. Pass T: every snippet, every "The
fault" line, all nine questions, all twelve "When to leave it alone" bullets and all 17 marker
sites landed; every id referenced exists. Pass S: no S1 — nowhere does a document state the
opposite of what it attributes to a book; the p. 128 quote, "one aggregate per transaction" and
"infrastructure layer holds both" verify against the PDFs.

## Comparison with review 03

| | review 03 (`layers.md` at `544055e`) | review 04 (the four files) |
| --- | --- | --- |
| findings in the review | 130 (18 closed at HEAD) | 126 |
| open against the reviewed text | 112 | 126 |
| S1 | 6 (1 open) | 8 (7 in the files, 1 folder) |
| S2 | 38 (31 open) | 29 |
| S3 | 63 (58 open) | 81 |
| S4 | 15 (15 open) | 8 (+ 2 rows bundling 17 folder/sibling items) |
| carried from the previous review | 112 of 130 | 68 of 126 |
| new to this review | 18 | 58 |
| of the new: introduced by the restructure | — | 9 (R04-01, 02, 07, 09, 10, 36, 94 and the widenings in 11, 42) |
| of the new: duplicates / Terms purity against the doc's own contract | — | 8 rows (R04-44 to R04-51), bundling ~30 single restatements |
| cold read, lowest confidence | 1 (one scenario), 2 (five) | 2 (two scenarios), none at 1 |
| review-03 decisions ruled yes and not yet applied | 13 | 8 (Q7, 8, 9, 11, 12, 15, 17, 19) |

Reading: the count did not fall, and should not have — pass 1 was a translation. What changed
is the shape. Review 03's S2 and S3 were dominated by the table (23 rows about cells, citations,
the skill) and by cross-section staleness; those are gone. Review 04's extra S3s are the doc's own
new contract catching restatements and rules in Terms — faults that were invisible under the old
structure because nothing said "stated once". The S2 gaps are the same gaps as in review 03,
one fewer in count and now each anchored to a single rule id to fix. The S1s are the real cost of
pass 1: four introduced (one typo-class, three from promoting table cells or coining a definition),
two pre-existing but now adjacent, one folder.

## Pickup notes

- **Where:** worktree `.claude/worktrees/layers-refinement-wt`, branch `docs/layers-refinement-wt`,
  four uncommitted files under `registry/docs/agents/`. `layers.md` untouched.
- **Order suggested:** the seven S1s first (R04-01 is one word; R04-02, 07, 09, 10 are the
  restructure's own and have one-sentence fixes; R04-04, 05, 06 share one decision: who records,
  who dedupes, when translation happens — settle it once and write DRV-2 once). Then the eight
  ruled-but-unapplied S2s (R04-04, 05, 13, 14, 15, 16, 17, 20, 21, 22, 26, 31) as one sweep,
  since review-03's Decisions already hold the wording. Then the pointer/contract S3s (R04-38 to
  R04-51), which are mechanical, before any wording S3 — a wording fix on a sentence that then
  moves is wasted. Provenance rows (R04-108 to R04-118) in one commit. R04-125 (skill,
  citations, README, extending-layers) when the four files replace `layers.md`.
- **Pass 2's method:** review-03's decisions Q7–Q19 are the author's and stand; apply them as
  written there. Where this review's fix differs from a decision's wording (R04-04 vs Q17, R04-05
  vs Q19, R04-16 vs Q8), the decision's wording wins.
- **Acceptance test** after pass 2: a fresh agent with `layers-revised.md` and `-examples.md`
  only, placing scenarios 2, 6, 9, 14, 23, 24, 28b (the 2s and 3s), reporting confidence and the
  rule ids it stood on.
- **Hits** count independent readers (six). A single is not a reason to drop: R04-01 (the one
  S1 nobody else could see), R04-06, R04-19, R04-23, R04-24 are singles.
