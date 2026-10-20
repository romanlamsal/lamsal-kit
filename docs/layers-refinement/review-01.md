# Review 01: `layers.md` after spec 01

**Reviewed:** `registry/docs/agents/layers.md` at `d5df10a` (branch `docs/layers-refinement`,
diff against `main`), with `docs/extending-layers.md`, `domain.md`, `spec-01.md`, tickets 01–18
and `open-questions.md` as context.
**Date:** 2026-10-20
**Verdict:** not mergeable as is. Tickets 10, 12 (core), 13, 15, 18 and question 9 land cleanly.
Tickets 09 and 14 did not fully land: the two highest findings are decisions recorded in those
tickets that `layers.md` states the opposite of, or not at all.

Line numbers (`L`) refer to `layers.md` at `d5df10a`.

## Method

Four independent passes, then merged:

| pass | reader | input | purpose |
| --- | --- | --- | --- |
| R | reviewer (this session) | diff + all tickets | contradictions, decisions that did not land |
| P | fresh Opus agent | `layers.md` only | place 18 `domain.md` scenarios; report confidence 1–5 and what it had to guess |
| A | fresh Opus agent | `layers.md` only | adversarial read: contradictions, non-sequiturs, undefined terms, source fidelity |
| V | Opus agent | everything | per ticket: does each `## Decision` line have a sentence in `layers.md`; status/hash agreement; `domain.md` coverage |

**Hits** = how many of the four passes found the finding independently. Pass P's confidence is
quoted where it scored a scenario.

## Findings

Severity: **S1** contradiction or wrong instruction; **S2** gap a fresh agent fills wrongly;
**S3** wording, stale reference, unmarked choice; **S4** folder housekeeping and grounding.

### S1 — contradictions

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R01-01 | 4 | L237–240, L255 | Hook step 3: "the hook writes only a message there". Contradicts L85 "acts through one service", L48 "reaches the store only through a service", `components.md` L26, and ticket 14's own decision ("calls one service, which writes the message"). Knock-ons: the ACL trigger L193 ("before it calls a service") never fires, so nothing forces the message into this system's terms; with ambient context banned (L135), nothing says how the product's transaction reaches a service as `ctx`. P asked exactly this. | "the hook calls one service, handing it the product's transaction; the service writes only a message there" |
| R01-02 | 4 | L258–261 | Rule 1: "The owner changes its data when the message arrives" is false for a third party; no owner reads the relay. Ticket 09/12's intent (this system's own handler calls the mailer) is nowhere. P reached the right answer only by rejecting the text, then noticed the regress: the handler's call is itself "data another system owns" → outbox again. | add "for a third party, a handler of this system calls it; the message is the retry" |
| R01-03 | 3 | L141–143 | Published language = "the messages the system publishes, if any". Ticket 09's public/private split never landed, so the mail message becomes exported language. Ticket 14's premise ("messages in an outbox are the system's published language") also misreads 09. | one clause: "a message only this system handles is not published" |
| R01-04 | 2 | L108–113 | `createOrderService` receives `mailer: Mailer` next to `orders` and `invoices`: the snippet shows what rule 1 forbids. Also unstated through which port a service writes the outbox. | replace `mailer` with an outbox port that takes `ctx`, or comment it as the mail handler's service |
| R01-05 | 1 | L273–279 | "Good tells for one" after "One transaction, by default": "one" reads as one *transaction*; both tells then argue the wrong way. | "Good tells for an outbox:" |
| R01-06 | 3 | L364–368 vs L263–269, L232–234 | Q5 flags "a function that opens its own transaction", but rule 1's exception and hook step 2 require one. No pointer. | append to Q5's tell: "except the transaction rule 1 records an answer in, or hook step 2 opens (Transactions, Products)" |
| R01-07 | 3 | L48 vs L458–459, L392–394 | Controllers may import "infrastructure that resolves or translates its caller"; Tests says driving adapters "receive ports"; Q7's tell names only service and factory files. P scored 2/5 and invented a split (pure translation imported, I/O received). | decide: controllers receive it from assembly (row: "ports of infrastructure that…"), or Q7 covers controllers |
| R01-08 | 1 | L90 vs L245–246 | "a product's hook" delivers at least once; then "the product does not run the hook again". Both cannot hold. | pick one per hook kind, or drop "a product's hook" from L90 |
| R01-09 | 3 | L224 vs L226–227 | "hooks and scheduled tasks are driving adapters" then "it is not a driving one". | head: "driving adapters for what the outside starts", or reword the branch to "not a driving call" |
| R01-10 | 1 | L301–304 | Q1's tell "against a table the file is not named after" lets `service/order.ts` insert into `orders`; service row says "writes through repositories". | "against any table" |
| R01-11 | 2 | L46, L112, L122 | Services may import "driving ports of other services in this system", but driving ports take no `ctx`: a sibling call inside `tx.run` is a silent second transaction (Q5). | state: compose outside `run`, or move the shared writes into repositories |
| R01-12 | 2 | `extending-layers.md` step 6, README step 4, every ticket's "Done when" | Cite "wait for approval before committing, per `CLAUDE.md`"; f6740d4 removed that rule from `registry/CLAUDE-general.md`. | state the rule as this folder's own, or drop the wait |

### S2 — gaps a fresh agent fills wrongly

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R01-13 | 3 | L221–223 | "the product's screens may *read* it" was read as *only* read; P made the field read-only in Payload and called the hook path illegitimate, though L222 allows a change. Nothing says the product's write *is* the repository write and the hook does the rest. | "A change made there is this system's write, already stored; its driving adapter calls a service for the rest" |
| R01-14 | 3 | L284, L90–91 | Out-of-order arrival is stated for the relay only, not webhooks; no handling rule. Ticket 11's "an early message is not a repeat; record or fail-to-retry is the codebase's choice" is ticket-only. P scored 2/5 on `OrderCancelled` before `OrderPlaced`. | move "not necessarily in order" to L90 (any at-least-once caller); add "a message that arrives early is not a repeat; what the handler does with it is each codebase's choice" |
| R01-15 | 2 | L234, L246, L268 | "reconciliation" ×4, never defined: owner, layer, trigger. | one sentence in Terms or Transactions: what it is, that it is this system's scheduled task (a driving adapter) |
| R01-16 | 1 | L244, L269 | "the sources do not cover" ×2; `layers.md` never names its sources. The list lives in `extending-layers.md`, which does not ship. | one sentence in Terms naming the four |
| R01-17 | 2 | L263–269 | Ticket 12 consequences not in doc: the aggregate's pending state; the provider's driving port recognising a repeat (an obligation on the provider, not only a hope of the caller). Trigger "where the use case's caller waits" is loose: every HTTP caller waits. | "needs the other system's answer in its response"; add "the aggregate holds a pending state until the answer is recorded"; add "a driving port a system calls after its commit recognises a repeat" |
| R01-18 | 2 | L292–293, L224 | What wakes the deadline holder is unsaid; a system's *own* scheduled task (dunning) appears nowhere as a driving adapter — only the product's. Spec's ruled-out list carries it, `layers.md` does not. | Terms or driving-adapter paragraph: "a scheduled task of this system is a driving adapter" |
| R01-19 | 2 | L133–137 | Deleted without replacement: who puts an ambient value in, who reads it. A value a *handler* needs (the mail's locale) does not survive the outbox. | "a driving adapter puts it in; services and adapters read it; the domain takes arguments. A value a message's handler needs goes in the message" |
| R01-20 | 1 | L44–48, L188, L197 | Table rows list neither a conformed system's published language nor the shared kernel as imports, while L188 says "in any layer that may import a domain". Services may import "the open host service", which per L147 includes the builder → a service may build B (Q7). | domain row: add "a conformed system's published language, a shared kernel"; services/infra rows: "published language and driving-port types of …" |
| R01-21 | 1 | L47, L52–53 | A clock, a cache, blob storage: neither "this system's aggregates" nor "somebody else's". | infrastructure row: "every other driven adapter" |
| R01-22 | 1 | L232–234 | Step 2 can deadlock: the hook's own transaction on the same database while the product's transaction holds rows. | clause: "which must not touch rows the product's transaction holds" |
| R01-23 | 1 | L151–153 | Must a system export a handler builder for its *own* worker process? Relay topology across processes unsaid. P chose the worker's own assembly, confidence 3. | "which process runs the relay is each codebase's choice" |
| R01-24 | 3 | L448, L470–471 | "An integration test is one that uses a real external dependency" vs "the second run [against an in-process open host service] is the integration test". | "The second run is the integration test where the open host service reaches a real dependency" |

### S3 — wording, stale references, unmarked choices

| id | hits | where | finding | proposed fix |
| --- | --- | --- | --- | --- |
| R01-25 | 3 | L396 | "invisible to the other six" with nine questions. | "invisible to questions 1–6" |
| R01-26 | 1 | L387 | "The first two faults seen from the other end": Q6 is Q2's fault, not Q1's. | "Question 2's fault seen from the other end" |
| R01-27 | 3 | L149 | "where it exports one, a fake" is circular. | "optionally, a fake of its driving ports" |
| R01-28 | 1 | L149–153 | "Whether one function builds both" — the fake item sits between the two builders, so "both" misreads. | reorder: handler item before fake item |
| R01-29 | 2 | L260 | "an outbox in each it sends from" — "sends from" undefined. | "in each store whose transaction writes the message" |
| R01-30 | 3 | L229 | "It asks … → it asks, at any point." Tautology. | "→ a specification answers it, before or inside the product's transaction" |
| R01-31 | 2 | L284–286 | "not necessarily in order — possibly to a handler older or newer …, so a message's schema stays … compatible": order has nothing to do with version skew. | two sentences; see R01-14 |
| R01-32 | 2 | L238–239 vs L5–7 | Step 3 "a store that transaction reaches"; preconditions have only a *port* reaching stores. | "the outbox is in a store this system's transaction port reaches through that transaction" |
| R01-33 | 2 | L136–137, L295 | "Say which values are held ambient; the line is this document's choice" reads self-contradictory. "Say which" (choreography) — say where? | "The line is this document's choice; which values a codebase holds ambient, it says" ; "Say which, in an ADR" |
| R01-34 | 3 | L233–234 | "the saga or reconciliation undoes the work" on a product rollback: no saga step fires; nothing tells this system the product rolled back. | "reconciliation undoes the work" |
| R01-35 | 2 | L234–236 | Step 2's last sentence restates step 1. Ticket 14's "an after-commit hook is not preferred over the message" is not in the tree. | drop, or move the preference before the tree |
| R01-36 | 3 | L14 vs L85–90 | "calls into one thing" vs one service + a specification + resolving infrastructure. Ticket 10 kept it deliberately; three readers still tripped. | "acts through one service" |
| R01-37 | 1 | L320 | Q2 "a controller body that grew past 'call one service'": inbound translation and specification calls now legitimately grow it. | "translating and asking are not growth" |
| R01-38 | 2 | L5–7 | First preconditions sentence near-unparseable on first read. The *store* narrowing is not marked as this document's. L494–495 ("passing its transaction context into another repository of its system") is not qualified to one store. | split the sentence; add "this document's narrowing of *store*"; "another repository of its system in the same store" |
| R01-39 | 2 | L95 vs L112, L162 | "Driven ports live in the domain" vs `TransactionRunner` "from the common library" and `Pricing` from the other system's `service/pricing.port`. | "Driven ports this system declares live in its domain" |
| R01-40 | 1 | L189, L192–193, L231 | Unmarked choices: conformist as "the default for an open host" (Evans treats conformist as forced); "a third-party API always gets one" (and tension with Q8's "conform instead"); hook step 1 unmarked while 2–3 are. | mark each "this document's choice"; "Steps 1–3 are this document's choice" |
| R01-41 | 1 | L290–295 | "a saga, here the whole sequence" is Richardson's definition, uncredited. "process manager" checked against Khononov pp. 150–152: faithful (see Source check); the orchestrator objection is withdrawn. | optionally "in Richardson's sense"; keep "process manager" |
| R01-42 | 1 | L37–38 | "The faults below are the ones a linter cannot see" — Q2, Q6, Q7 are import tells. | "Most faults below" |
| R01-43 | 1 | L155–163 | "an entry that loads only the domain" holds only because the port export is type-only; unstated. | "export the port types type-only" |
| R01-44 | 1 | L177 | "Moving B out of process changes assembly and nothing else" — the paragraph itself adds an HTTP client in A's infrastructure. | "changes assembly and adds adapters; no service or domain changes" |
| R01-45 | 1 | L24 | "infrastructure are driven adapters" vs an inbound translator in infrastructure (L194–195). | "repositories and infrastructure hold driven adapters"; the narrowing and its marker went with ticket 19 (`3ee8bf9`) |
| R01-46 | 1 | L347–359, L497 | "invalidation", "a write declaring", "one mutation per use case" defined only in `components.md`. | pointer in Q4's first line |
| R01-47 | 1 | various | "open host" and "open host service" used interchangeably; "auth" is both an infrastructure subject (L47) and "a product … another system" (L218). | pick one; drop "auth" from one list |

### S4 — folder housekeeping and grounding

| id | where | finding | proposed fix |
| --- | --- | --- | --- |
| R01-48 | `domain.md`, README | Edge cases `layers.md` now places as faults are not recorded as such: the common library's ambient unit of work, shop's in-process billing call under an ambient transaction, the dashboard's cross-system join. Next ticket author re-litigates. | a "placed as a fault" marker or subsection in `domain.md` |
| R01-49 | `spec-01.md` Ruled out | Unplaced `domain.md` rows: auto-instrumentation load order (ticket 08 says stack document; spec does not list it); Payload config re-declaring domain fields (ruled out, no sentence); request id / trace context "should cross boundaries" (deliberately unsaid, ticket 15). | add the three to Ruled out with the reason |
| R01-50 | `11-saga-state.md` Resolution | Still quotes "wired once, above the systems", superseded by ticket 16, unnoted. | footnote |
| R01-51 | ticket 14 Decision | Premise "messages in an outbox are the system's published language (ticket 09)" contradicts 09's private messages; 14's conclusion survives. | footnote |
| R01-52 | `spec-01.md` Grounding | Checked against the books (see Source check): Khononov ch. 15 p. 245 has "Assume the worst" and "Use public and private events" (spec says not found); Evans's bounded-context quote is manuscript p. 239, not p. 111; outbox, embedded events and at-least-once are verbatim on pp. 145–147. Unchecked: Richardson's consumer-driven contracts (ch. 9, used in ch. 10, from memory); Freeman & Pryce "only mock types you own" argues for consumer-owned interfaces, i.e. *away* from a provider's fake, not toward it as ticket 17 says. | update the spec's grounding paragraph and tickets 09, 10, 11, 13, 15 |

## What held up

Pass P placed these at confidence 4–5 from `layers.md` alone; leave them:

- commit, then call, safe to repeat — at both hops (shop → payment, payment → Stripe) (ticket 12)
- a hook on this system's own write does nothing (ticket 18)
- an ambient transaction context is a fault; the in-process billing call moves outside `tx.run` (ticket 15)
- Stripe webhook: signature in the controller, schema and translation in the adapter or shared infrastructure, never the domain; second delivery changes nothing (ticket 10)
- the tracer is not a question-7 fault (ticket 03)
- `requestId` ambient; `locale` and `currentUser` ambient only until a rule decides by them; transaction context never (ticket 15)
- sign-up profile = hook step 2 (ticket 14)
- question 9 on a renamed message field, with expand/contract as the fix (ticket 09)
- fake ownership: consumer writes fake and suite, second run against the provider's open host service (ticket 17)
- two store clients → outbox across them (ticket 13)

## Source check

Khononov, *Learning DDD* (O'Reilly, page numbers of the print edition) and Evans's final
manuscript (April 2003) were read for every finding a source could speak to. Products, hooks,
ambient values, reconciliation and assembly stay without a source; the books are silent.

### Guidance the sources add

| id | source | what it says | guidance |
| --- | --- | --- | --- |
| R01-02 | Khononov ch. 9, pp. 149–154 | A stateful saga or process manager appends a `CommandIssuedEvent`; "the outbox relay will have to execute the commands on relevant endpoints"; "separating the transition of the saga's state from the execution of commands ensures that the commands will be executed reliably, even if the process fails at any stage." | The call to the third party is made by whoever handles the outbox message, and the message is the retry. Rule 1 can say so with a source behind it: "for a third party, a handler of this system executes the message against it". Drop "this document's choice" worry for the mechanism; keep it for the waiting-caller exception. |
| R01-03 | Khononov ch. 9, p. 140; ch. 15, p. 245 | "translating messages to the published language enables differentiating between private events that are intended for the bounded context's internal needs and public events that are designed for integration". "Treat events as an inherent part of the bounded context's public interface. Therefore, when implementing the open-host service pattern, ensure that the events are reflected in the bounded context's published language." "sparingly use domain events for communication with external bounded contexts. Consider designing a set of dedicated public domain events." | Ticket 09's main claim is verified. The missing clause has the book's own terms: "a message only this system handles is a private event and is not published". Note p. 140: "It's a common mistake to design and expose a published language for the model's objects and allow domain events to be published as they are" — the doc's default (re-export domain schemas, messages included) is exactly this; the existing marker ("Khononov keeps the two apart") should name messages too, and question 9 is the cost of the choice. |
| R01-14 | Khononov ch. 15, p. 245, "Assume the worst" | "Events will arrive out of order. Events will be duplicated." "When publishing messages, ensure that the subscribers will be able to deduplicate the messages and identify and reorder out-of-order messages." His message examples carry `event-id`, `version`, `timestamp`. | Two things the doc lacks: (1) out-of-order is a property of events in general, not of the relay — move it to the at-least-once sentence (L90); (2) the obligation sits on the *publisher* too: a message carries what a receiver needs to recognise a repeat and an early arrival — an id, the aggregate's version. State it by property in the outbox bullets. Spec's "not found in any source" is wrong; it is p. 245. |
| R01-17 | Khononov ch. 5, pp. 67–68; ch. 9, pp. 147–149 | Idempotency as the way to transactional behaviour under retries: "make the operation idempotent: that is, leading to the same result even if the operation repeated multiple times." The saga example: the campaign waits in a publishing state until `PublishingConfirmed`/`PublishingRejected` moves it to Published or Rejected. | The pending state has a book example: the aggregate that waits for the other system's answer holds the wait as state. Add "the aggregate holds a pending state until the answer is recorded". The provider's obligation (recognise a repeat) is Khononov's idempotent operation; say it once for "a driving port a system calls after its commit". |
| R01-41 | Khononov ch. 9, pp. 147, 150, 152 | "A saga is a long-running business process … a business process that spans multiple transactions … The saga listens to the events … and issues subsequent commands." "Strictly speaking, a saga matches events to the corresponding commands." Process manager: "a central processing unit that maintains the state of the sequence and determines the next processing steps"; "if a saga contains if-else statements … it is probably a process manager"; "process managers are often implemented as aggregates". | The doc's "process manager sends commands (orchestration)" is Khononov-faithful; drop the "orchestrator" suggestion from R01-41. "Here the whole sequence rather than Khononov's coordinating component" is fair. New: "process managers are often implemented as aggregates" grounds ticket 11 (step state is an aggregate) and the deadline holder — the doc may say "a process manager is an aggregate of the system that runs it". |
| R01-40 | Khononov ch. 4, pp. 53–54; Evans pp. 255–256 | Conformist: the imbalance "can be caused by integration with service providers that are external to the organization"; justified when the contract "may be an industry-standard, well-established model, or it may just be good enough". ACL when: the downstream holds a core subdomain; the upstream model is inefficient or inconvenient; the supplier's contract changes often. Evans sidebar "Following isn't always bad": "When using an off-the-shelf component that has a large interface, you should typically CONFORM to the model implicit in that component … when the interface is large and integration is more significant, it usually makes sense to follow the leader." | "A third-party API always gets one" contradicts both books: Evans conforms to an off-the-shelf component with a large interface (a Payload), Khononov conforms to an external provider whose model is standard or good enough. Either mark "always" as this document's choice, or drop "always" and let the existing criteria ("foreign, unstable or not yours") carry it — they already restate Khononov's three. "The default for an open host" has no book behind it; mark it. Products: Evans's sidebar supports conforming to a product; the doc currently sends every product to an ACL via "another system" + "third party always". |
| R01-05 / rule 3 | Khononov ch. 6, p. 87 | "no system operation can assume a multi-aggregate transaction … one aggregate per database transaction. The need to commit changes in multiple aggregates signals a wrong transaction boundary, and hence, wrong aggregate boundaries." Objects share a transactional boundary "when both can be modified simultaneously or the business rules of one object depend on the state of another object." | The marker on rule 3 is verified. Khononov's criterion gives rule 3 a sharper tell than "often written at the same time": a rule that must hold at every moment → one aggregate; a rule that may hold a moment later → outbox; one transaction across aggregates is the doc's middle ground and should say so. |
| R01-11 | Khononov ch. 6, p. 86, fn. 7 | "the application layer's operations implement the transaction script pattern. It has to orchestrate the operation as an atomic transaction." The operation: load the aggregate, execute, persist, return. | An application service *is* the transaction. One calling another is two transaction scripts, so two transactions; the book gives no composition of services. Supports "compose outside `run`, or move the shared writes into repositories". |
| rule 2 | Khononov ch. 15, pp. 237–238, 246 | Event-carried state transfer "is an asynchronous data replication mechanism … consumers hold a local cache"; "If the components can settle for eventually consistent data, use the event-carried state transfer message. If the consumer needs to read the last write in the producer's state, issue an event notification message, with a subsequent query." | Rule 2 is verified and gains a tell: a read that must see the owner's last write calls the owner; one that may be a moment stale reads a copy fed by the owner's messages. |
| R01-24 / Tests | Khononov ch. 10, p. 165 | Testing pyramid for the domain model ("aggregates and value objects make perfect units"); testing diamond for active record. | Confirms "Test the domain directly"; says nothing on contract tests or the second run. R01-24 stays wording. |
| R01-45 | Khononov ch. 8, pp. 125–127 | Presentation and data access unified into one "infrastructure layer"; the business logic layer defines ports, infrastructure implements adapters, "resolved into concrete adapters … either through dependency injection or by bootstrapping". | Khononov's infrastructure holds driving and driven adapters; the doc's infrastructure holds driven only. A narrowing to mark in one clause, as Terms does for *repository*. "Driven ports live in the domain" and assembly are verified. Resolved by ticket 19: infrastructure is no longer a layer name, so nothing is narrowed. |
| ticket 10 | Khononov ch. 9, pp. 138–140 | Stateless translation: a proxy "to interject the incoming and outgoing requests"; "In an open-host service, translation to the public language takes place when processing incoming requests, and in an anticorruption layer, it occurs when calling the upstream"; asynchronous: a message proxy that translates and filters. | Grounds inbound translation at the driving adapter and, for messages, the tolerant reader as a message proxy. Upgrade ticket 10's "from memory" items. |
| preconditions | Khononov ch. 9, pp. 145–147 | "Both the updated aggregate's state and the new domain events are committed in the same atomic transaction." "When using a NoSQL database that doesn't support multidocument transactions, the outgoing domain events have to be embedded in the aggregate's record." "the outbox pattern guarantees delivery of the messages at least once". | All three verified verbatim; spec's "secondary summaries" can be upgraded. |
| R01-52 | Evans manuscript | "Integration across the boundaries necessarily will involve some translation, which you can analyze explicitly" is on manuscript **p. 239** (Bounded Context), not p. 111. ACL "translates in both directions" p. 258, structure p. 258–259, conformist p. 255–256, published language p. 264: confirmed. Published language p. 264 also: "if the model is the communications medium, it cannot be changed freely … must be very stable", "If one is used as a data interchange language, it essentially becomes frozen." | Fix ticket 15's page. Evans's warning is a second source for the doc's marker on re-exporting the domain and for question 9. |

### Findings the sources do not touch

R01-01, R01-07, R01-08, R01-09, R01-13, R01-15 (no "reconciliation" in Khononov), R01-16,
R01-18, R01-19, R01-21–23, R01-25–39, R01-42–51: internal consistency or this document's own
constructs. Decide them on the four tests alone.

## Pickup notes

For the session that works through this review.

- **Where:** worktree `.claude/worktrees/docs-layers-refinement`, branch `docs/layers-refinement`,
  HEAD `d5df10a`. This file is uncommitted. Nothing else in the branch was changed by the review.
- **Process:** `docs/extending-layers.md` steps 1–6 apply to every change; R01-12 means "per
  `CLAUDE.md`" there is stale, so wait for approval before committing anyway. One commit per
  finding or per group of findings that touch one sentence; name the ids in the commit body.
- **Order suggested:** S1 first, R01-01 and R01-02 together (both are "who writes, who calls"),
  then R01-03/04 (published language and the factory snippet), then R01-05/06/10/11 (Transactions
  and checklist), then R01-07/09/08 (controllers and hooks), R01-12 last in S1. S2 next; S3 is
  one sweep. S4 after `layers.md` is settled.
- **Sources:** `~/Documents/Vlad Khononov - Learning Domain-Driven Design.pdf` and
  `~/Documents/Evans – Domain-Driven Design … .pdf` (filenames contain non-ASCII whitespace;
  use a glob: `~/Documents/*Khononov*.pdf`, `~/Documents/*Evans*.pdf`). Extract with
  `pdftotext -layout <pdf> <out.txt>` into the scratchpad; the extracts from this review are gone
  with its session. Khononov page numbers above are the print edition's, as printed in the
  page footers of the extract; Evans's are the final manuscript's footers.
- **Line numbers** in the tables refer to `layers.md` at `d5df10a`; they shift with the first
  edit. Re-anchor by the quoted text, not the number.
- **Hits** counts independent reviewers (four: this session plus three fresh Opus agents with
  the inputs listed under Method); a hit count of 1 is not a reason to drop a finding, several
  of the sharpest (R01-05, R01-10, R01-20) are singles.
- **After each `layers.md` change**, re-run the cold placement test on the scenarios the change
  touches: a fresh agent with only `layers.md`, asked to place the `domain.md` case and to
  report its confidence. That is the acceptance test this review used.

## Decisions the author has to make

1. R01-01: say the service receives the product's transaction as `ctx`, or leave the mechanism to the codebase and say only "through one service"?
2. R01-07: controllers receive resolving/translating infrastructure from assembly, or import it and Q7 extends to controllers?
3. R01-11: sibling service calls inside one system — allowed outside `run` only, or not at all?
4. R01-03: private messages — one clause in the published language sentence, or in the outbox bullets?
5. R01-12: restore the approval-wait rule for this repository, or drop it from the refinement docs?
6. R01-15 / R01-16: define *reconciliation* and name the sources in Terms, or elsewhere?
7. R01-14: out-of-order handling — state "codebase's choice" positively, or give the property (an early message is not a repeat) only?

## After the fixes

Worked through in commits b70e519..HEAD on `docs/layers-refinement` (2026-10-20). Rulings taken:
R01-01 (a), R01-07 (a), R01-11 (b, sibling service calls dropped), R01-03 (a) plus marker,
R01-12 (b, wait dropped), R01-15/16/18 in Terms, R01-14 as a three-bullet list of faults. Step 1
of the hook tree left unmarked (derives from "acts through one service").

Acceptance: two fresh agents placed nine scenarios from `layers.md` alone at confidence 4–5
(one 3 caused by the scenario, not the document). A third agent's adversarial read found 14;
seven fixed in the last commit. Left for a next round, all pre-existing:

| id | finding | note |
| --- | --- | --- |
| R01-53 | Products: a product screen's change of this system's aggregate bypasses "the only entry for doing something" and "an aggregate belongs to the system whose use cases write it" | ruled: field read-only in the product; a change comes through an action that calls this system's service. Naming an exception would keep a second writer with no use case behind it, skipping the aggregate's rules (a derived price). R01-13's "already stored" dropped |
| R01-54 | Q7 "a concrete adapter imported into a service file" is a linter-visible import, yet Q7 says it is "invisible to questions 1–6"; "the arrow" reads as import direction | fixed: "constructed in place, this one is invisible … and calls along the arrow" |
| R01-55 | repository row "one aggregate each, composes nothing" vs reporting read across aggregates | fixed as proposed |
| R01-56 | rule 1's exception: who retries a failed call after the commit; reconciliation repairs records, it does not make the call | fixed as proposed |
| R01-57 | hook step 4's hand-off mechanism unsaid | fixed as proposed |
| R01-58 | assembly "one module per process" vs each system's exported builder; "every dependency is one a factory declared" vs ready-made plumbing in Q7 | fixed: "calls the factories and the build functions other systems export"; "every dependency but fixed plumbing (question 7)" |
| R01-59 | repository row imports "the store client, the common library, the domain", but an aggregate stored in a product needs the product's instance and types, which only the infrastructure row may import (found by the R01-53 placement test) | ruled, larger than proposed: the repository layer goes; repository stays as Evans's pattern, layers become domain, service, driven adapters, driving adapters. `19-repository-as-pattern.md` holds the decision and the inventory; applied in `3ee8bf9` |
| R01-60 | "one module per process" (Assembly) vs "the consuming system's assembly builds the other system" and "a system's assembly building another system" (Systems, When to leave it alone): three systems in one process cannot have both one module per process and one assembly per system (found by the R01-58 placement test) | ruled, in `20-root-per-entry.md`: one root per entry; a system's assembly is its build function; a driving adapter receives its service from the root, by argument or by import. Apply in a fresh session |
| R01-61 | Q1's tell "a service reaching for a store handle" covers Q7's snippet (`createPostgresOrderRepository(db)` in a service file), which Q7 calls "invisible to questions 1–6"; only "against any table" excludes it (found by the R01-58 placement test) | Q1: "reaching for a store handle to query it"; or Q7: "invisible to questions 1–6 but where question 1's tell fires" |

### Pickup for the next session

- Branch `docs/layers-refinement`, HEAD `30ed865`; R01-53 (ruled: read-only, commit `38c38a6`)
  and R01-54–58 (commit `30ed865`) are applied. Line numbers in the finding tables are stale;
  re-anchor by quoted text.
- Acceptance after those two commits: eight scenarios placed from `layers.md` alone at 4–5
  (editor edits an owned field in Payload admin: 5; checkout retry after a failed call: 4;
  assembly and the logger: 4; Q7 import case: 5; reporting read: 5). The 4s lost a point on
  what the document leaves to the codebase.
- Ticket 19 applied in `3ee8bf9`: four layers (domain, service, driven adapters, driving
  adapters); repository stays as the pattern. Acceptance: a fresh agent placed the Payload price
  adapter, Q1, Q2, Q5, Q6 and the Stripe anti-corruption case at 4–5.
- Next: apply `20-root-per-entry.md` (ruled, carries before/after wording); then R01-61 (wording).
  Process doc steps 1–6 per change, commit per `CLAUDE.md` (no approval wait).
- Rationale for the rulings is in the commit bodies (`git log d5df10a..30ed865`), not here.
- Acceptance test after any `layers.md` change: a fresh agent with only `layers.md`, placing the
  `domain.md` scenarios the change touches, reporting confidence 1–5 and its guesses.
