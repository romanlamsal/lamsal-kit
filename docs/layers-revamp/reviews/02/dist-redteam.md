# Red team review, distilled set

## Summary

- **D1. Distributed monolith (live calls, no replicas): holds.** Finding: no property stops a use case from needing every other system up while it runs. P15's "as far as its own data reaches" is met by a system that keeps nothing of the others. Proposed P19.
- **D2. Every system reads one shared schema: holds.** Finding: no property stops a system from reading another system's records directly. P11 refuses only "changes", the glossary counts "a store" as Outside, and P13's "downstream systems" excludes readers of tables. Proposed P20.
- **D3. One system owning everything: holds.** Finding: nothing makes the business split into more than one system. A system "may" sit beside others, and P11, P13, P15, P16 and P17 say nothing when there are no other systems. Proposed force F10 and property P21.
- **D4. Everything in one shared kernel: fails** P3 (and arguably P13).
- **D5. Entity services under one orchestrator: fails** P11 and P7, through the glossary's **Owner**.
- **D6. Pinball choreography: fails** P3.

Designs that hold: 3.

---

## Design: D1. Distributed monolith (live calls, no replicas)

**What it is.** There are several systems, each a bounded context with its own processes and its own store. The cut between them follows P3. A use case that needs another system's data does not keep it. It calls that system's open host service, through a driven port, while the use case runs. Each system is an anti-corruption layer towards the others: it translates their published language in its driven adapters. No system keeps a replica, and none takes a snapshot ahead of time. Acting across systems goes through the outbox port as messages. A failure later on is undone by a saga. A typical use case calls three to six other systems' answering use cases before it commits its own records.

**Why it is bad.** A use case works only when every system it calls is up, so its availability is the product of theirs. Its latency is the sum of theirs. Deploying any one system makes use cases fail in every system that calls it. The systems are cut apart in the code but not at runtime. That is a distributed monolith.

| Property | Holds / fails | How |
|---|---|---|
| P1 | holds | Each domain models its own part of "the business domain, not what serves it". Other systems' models stop at the anti-corruption layer. |
| P2 | holds | Each rule sits in one system's domain. Calling another system's answering use case is a step in a use case, not a rule. |
| P3 | holds | The cut is chosen so that "Business rules that change together sit together". The systems share only published languages, which are translated at the adapters. |
| P4 | holds | "responds the same whoever calls it and whatever serves it": other systems sit behind driven ports. |
| P5 | holds | Other systems are reached "only through its ports", and the anti-corruption layer keeps every port speaking "the system's terms". |
| P6 | holds | Each other system's driven port has a fake, so "Every use case can run with nothing outside the process". |
| P7 | holds | A use case writes only its own records, in one transaction. |
| P8 | holds | Effects on other systems leave through the outbox port in the same transaction. Live calls only answer, so "nothing final follows from it before it commits". |
| P9 | holds | Handlers record each message's id. |
| P10 | holds | What is read live from another system is stale by commit time. The design writes a business rule for each such read accepting it: "or on stale ones a business rule accepts". |
| P11 | holds | Systems only call each other's open host services. "No other system changes the records a system owns". |
| P12 | holds | Anti-corruption layer: nothing enters the domain. "only by choice". |
| P13 | holds | Upstream systems version their published language and only add to it. The anti-corruption layers keep "its downstream systems" from changing. |
| P14 | holds | Records and messages are versioned. Meaning never changes in place. |
| P15 | holds | "as far as its own data reaches": the system keeps nothing of the others, so its own data reaches only its own records. Every use case that needs another system lies outside that reach, so the property asks nothing of it. |
| P16 | holds | Each transaction touches one store, one system. |
| P17 | holds | Steps across systems go through messages, with sagas and timeouts. "ends, and only in a state a business rule allows". |
| P18 | holds | Handlers compare against the aggregate's state, not against arrival order. |

| Force | Exposed although every property holds? | How |
|---|---|---|
| F1 | no | Ports and fakes absorb it. |
| F2 | slightly | The cut moves. Live calls placed along the old cut have to be moved one by one. |
| F3 | yes | An edit to one system's answering use case, such as a slower query or a new failure mode, breaks callers the editor never read. |
| F4 | yes | "A deploy replaces processes one at a time": each system being replaced fails the use cases of every system that calls it live. |
| F5 | no | |
| F6 | no | |
| F7 | **yes, fully** | "Another system can be down, slow": any one of them stops every use case that calls it. The properties allow this. |
| F8 | partly | The anti-corruption layers absorb model changes. Changes in latency and availability pass through. |
| F9 | yes | An external system called live has the same effect. |

---

## Design: D2. Every system reads one shared schema

**What it is.** All systems keep their records in one store, in one schema. Each system writes only the records it owns, in its own transactions. When a system needs another system's data, its driven adapter reads that system's tables directly, translates the rows into its own terms, and returns them through its own driven port. That read runs outside its write transaction. No system uses another's open host service or a replica to read. Owners never change what a column means and never drop one. They only add. Acting across systems goes through the outbox and the bus.

**Why it is bad.** Each owner's table layout becomes a contract it never declared and cannot see. An owner cannot restructure, compact or move its records, because unknown readers depend on them. A table that was never published becomes part of the published language. No system can replace its store alone. This is the classic integration-database anti-pattern.

| Property | Holds / fails | How |
|---|---|---|
| P1 | holds | Table layouts stay in driven adapters. The domain models "the business domain, not what serves it". |
| P2 | holds | Rules are in each owner's domain. Readers' adapters translate and decide nothing. |
| P3 | holds | Owners only add columns, so no rule change "would have to change" anything a reader shares. (See Notes.) |
| P4 | holds | Ports hide the store. |
| P5 | holds | The reader reaches the store, and the glossary lists the store as Outside ("a store, a mail provider, the clock"). It does so "only through its ports", and the port "speaks the system's terms" because the adapter translates. The owner is not reached at all; only its records in the store are. |
| P6 | holds | The reader's driven port has a fake. |
| P7 | holds | Each use case writes its own records in one transaction. |
| P8 | holds | Outbox in the same transaction. |
| P9 | holds | Handlers record each message's id. |
| P10 | holds | The reader's cross-system read is not locked and may be stale, and a business rule accepts this: "or on stale ones a business rule accepts". No locks on others' rows, so use cases do not "fail each other". |
| P11 | holds | "No other system **changes** the records a system owns": readers only read. |
| P12 | holds | The reader's adapter translates. The owner's model does not enter its domain. |
| P13 | holds | The glossary's **Downstream system** "calls the upstream's open host service, sends its commands, handles its events". A system that reads tables does none of these, so it is not one of the "downstream systems" P13 protects. For true downstream systems, published language is versioned. |
| P14 | holds | Owners never change what a record means: "means the same to all code that reads it". That includes readers in other systems. |
| P15 | holds | A reader reads tables directly, so it works even while the owner's processes are down. |
| P16 | holds | The read runs outside the write transaction, so each transaction touches one system's records. |
| P17 | holds | Messages and sagas, as in D1. |
| P18 | holds | Handlers use state, not order. |

| Force | Exposed although every property holds? | How |
|---|---|---|
| F1 | yes | "A store ... is replaced": no owner can replace its store without breaking every reader of its tables. |
| F2 | yes | "the model grows": owners may only add columns. Their records cannot follow the model. |
| F3 | **yes, fully** | Someone editing an owner's tables has read only the owner's code. Readers in other systems break unseen. |
| F4 | yes | During a rolling deploy an owner's migration runs while readers' old code still reads the old shape. Adding only reduces this but does not remove it. |
| F5 | no | |
| F6 | slightly | Reads across systems compete in one store. |
| F7 | less | Readers outlive owners' processes. |
| F8 | **yes** | Each owner's record shape changes on its own schedule and is read as if it were its published language. |
| F9 | yes, if extended | Reading an external system's database the same way is just as allowed. |

---

## Design: D3. One system owning everything

**What it is.** The whole business domain is one system: one bounded context, one domain, one glossary, one store, run as one or more identical processes. Inside the domain, modules each hold rules that change for one reason and share no schema with each other, which keeps P3. The only other systems are external ones, such as a payment provider and a mail provider, reached through anti-corruption layers. The system owns every record of this codebase.

**Why it is bad.** The glossary has to give every business word one meaning across all departments. So where sales and the warehouse both say "order", one of them gets a coined name. Every deploy replaces the whole business's processes. A crash or a bad deploy stops every use case at once. Everyone edits one codebase, so no team can change its part on its own schedule. When the business grows, there is no cut to move, only one model to keep stretching. This is the big ball of mud, even when its modules are tidy.

| Property | Holds / fails | How |
|---|---|---|
| P1 | holds | One domain, "The domain models the business domain". The glossary defines **Business domain** as "A company's main area of activity", one per company. |
| P2 | holds | One domain, so every rule lives in "one place: the domain". |
| P3 | holds | Modules: "rules that change for different reasons share nothing either would have to change". Nothing makes the modules separate systems. |
| P4 | holds | Ports. |
| P5 | holds | The store and external systems are reached through ports, with anti-corruption layers. |
| P6 | holds | Fakes. |
| P7 | holds | One store, one transaction per use case. |
| P8 | holds | Outbox for private messages and for calls to external systems. |
| P9 | holds | Hooks and handlers record each message's id. |
| P10 | holds | Optimistic versions on aggregates. |
| P11 | holds | There is no other system of this codebase, and external systems reach it only through hooks. This holds vacuously. |
| P12 | holds | The external systems' model stops at the anti-corruption layer. |
| P13 | holds | "without its downstream systems changing": it has none. This holds vacuously. |
| P14 | holds | Versioned records and messages. |
| P15 | holds | "while others are down or slow": the only others are external systems. Orders wait as pending while payment is down. |
| P16 | holds | No transaction includes an external system. |
| P17 | holds | A saga and reconciliation with the payment provider. |
| P18 | holds | State-based handlers. |

| Force | Exposed although every property holds? | How |
|---|---|---|
| F1 | yes | One store for the whole business, so replacing it touches everything. |
| F2 | **yes** | "the cut between systems moves": there is no cut to move. Each department's language changes inside one glossary. |
| F3 | **yes** | The whole business is in one codebase, so every edit reads a smaller share of it. |
| F4 | **yes** | Any stop of a process stops every use case of the business. No property limits how far a stop reaches. |
| F5 | no | |
| F6 | slightly | Every use case runs against one store. |
| F7 | only external systems | |
| F8 | n/a | There are no other systems of this codebase. |
| F9 | as usual | |

---

## Design: D4. Everything in one shared kernel

**What it is.** Every system's schemas and specifications (`Order`, `Customer`, `Product`, `Payment`) sit in one shared kernel that every system imports into its domain. Messages are written in the kernel's schemas.

**Why it is bad.** Each system's model is everyone's model. Any change to a schema is a change to every system, and they must agree on it together.

| Property | Holds / fails | How |
|---|---|---|
| P1 | holds | The kernel models the business. |
| P2 | holds | Each rule lives once, in the kernel, which is part of each domain. |
| P3 | **fails** | "rules that change for different reasons share nothing either would have to change": pricing and shipping rules share the kernel's `Order`, and "A change to it is a change to each". |
| P4–P12 | hold | As in D1. P12: the kernel is imported "by choice". P5: the kernel's terms are each system's terms. |
| P13 | arguably fails | The kernel is imported "into its domain", so changing `Order` is changing a system's model, and "A change to it is a change to each". But the kernel is also "agree[d] on together". (See Notes.) |
| P14–P18 | hold | As in D1. |

Forces: F2 and F3 hit every system at once. It fails P3, so there is no finding.

---

## Design: D5. Entity services under one orchestrator

**What it is.** There is one system per noun: Order, Customer, Product. Each is a store over its aggregate behind commands that check only its schema. One Orchestrator system holds every business rule as process managers and sends commands to the entity systems.

**Why it is bad.** The noun systems are anemic. Every rule change touches the Orchestrator, and often an entity system as well. The Orchestrator is a god system.

| Property | Holds / fails | How |
|---|---|---|
| P1–P6 | hold | P2: every rule lives in one place, the Orchestrator's domain. |
| P7 | **fails** | **Owner**: "The system whose business rules decide what a record holds, wherever it is kept". The Orchestrator's rules decide the Order and Customer records, so it owns them. A use case writing both cannot "land together" across two entity systems' stores without breaking P16. |
| P8–P10 | hold | |
| P11 | **fails** | The Orchestrator owns the records, and the entity systems, which are other systems, change them: "No other system changes the records a system owns". |
| P12–P18 | hold | P15: see Notes on "its own data". |

Forces: F7 and F2 hit the Orchestrator hardest. It fails, so there is no finding. It fails only because of the glossary's definition of **Owner**; see Notes.

---

## Design: D6. Pinball choreography

**What it is.** One business flow emerges from eight systems, each reacting to the previous one's published events: placed, then reserved, then captured, then shipped, then points granted. Each system's step reacts to the step before it, and no one holds the sequence.

**Why it is bad.** Nobody can say where an order stands. Changing the flow means editing handlers in several systems, which an edit of one system cannot see.

| Property | Holds / fails | How |
|---|---|---|
| P1, P2 | hold | P2 holds only if each handler's use case asks its own domain ("may this order ship?"). If not, the rule lives in which events are subscribed, in assembly. |
| P3 | **fails** | "Business rules that change together sit together": "reserve stock only after payment" changes Inventory's and Payment's reactions together, and they sit in two systems. |
| P4–P18 | hold | P17 through per-system timeouts and compensating events. P18 through state-based handlers. |

Forces: F3 and F2 hit hardest. It fails P3, so there is no finding.

---

## Findings

### From D1 (distributed monolith holds)

> **P19.** A use case needs no other system to answer while it runs, except where a business rule needs that system's answer now
> *Against:* F7.

Words that let D1 through:
- P15 "as far as its own data reaches". A system that keeps no replica or snapshot has nothing of others in its own data, so P15 asks nothing of the use cases that depend on them.
- P10 "or on stale ones a business rule accepts". A live read of another system is accepted by writing a business rule that accepts it.
- The glossary defines **Replica** and **Snapshot**, but no property makes a system keep either.

An alternative is to rewrite P15 itself: "A system works while others are down or slow, as far as its business rules allow".

### From D2 (shared schema holds)

> **P20.** A system reads another system's records only through what that system publishes or returns to it: its open host service, its published events, or a replica refreshed from them
> *Against:* F3, F8.

Words that let D2 through:
- P11 "No other system **changes** the records a system owns". Changing is refused; reading is not.
- P5 "only through its ports". These are the reader's own ports, and the glossary's **Outside** counts "a store", so reading through the store is "through its ports". The owner is "reached" only through its ports, but its records in a shared store are not the owner.
- P13 "its downstream systems". The glossary's **Downstream system** "calls the upstream's open host service, sends its commands, handles its events", so a system that reads tables is not downstream, and P13 does not protect it.
- P14 "means the same". It covers meaning, not shape.
- **Owner** "A store may keep records of several owners."

An alternative is to widen P13: "A system changes its model and how it keeps its records without any other system changing".

### From D3 (one system owning everything holds)

> - **F10. The business speaks more than one language.** One word means different things in different parts of the business, such as sales' order and the warehouse's, and each part's language changes on its own schedule.

> **P21.** A system's terms are the words of the part of the business it serves, each with one meaning
> *Against:* F10, F2.

Words that let D3 through:
- **System** "A code repository **may** hold several." Several systems are allowed, never required.
- **Business domain** "A company's main area of activity", one per company, read with P1 "The domain models the business domain". One model for everything reads as intended.
- P3 "sit together" / "share nothing". Modules inside one system meet it, and no sentence says that what shares nothing lies in different systems.
- P11 "No other system", P13 "its downstream systems", P15 "while others are down", P16 "two systems" and P17 "Work spanning systems". All of these hold vacuously when there is only one system.

---

## Notes

- **P5 and Conformist.** Does a conformist's port speak "the system's terms" when "its published language is used untranslated"? P1's *Except* points to P12 and not to P5. To avoid deciding this, D1 uses anti-corruption layers.
- **P5 and a shared store.** Does reading a system's records in a shared store count as reaching that system? The sentence is "A system reaches the outside, and is reached from it, only through its ports", while **Outside** lists "a store". D2 holds only on the reading that it does not.
- **P16 and reads.** Does a transaction that reads another system's records, without writing them, "span" two systems ("No transaction spans two systems")? D2 avoids the question by reading outside the transaction.
- **P3 and the reader's adapter in D2.** Does "share nothing either would have to change" count another system's adapter over the owner's tables as shared with the owner's rules? If it does, D2 fails P3, but only once the owner wants to do more than add.
- **P13 and a shared kernel (D4).** Is a change to the kernel a case of "A system changes its model", given "each importing it into its domain" and "A change to it is a change to each"? Or is it no one system's change, because the kernel is "agree[d] on together"?
- **"Own" in P7 and P15.** Do "its own system's records" (P7) and "its own data" (P15) mean the records a system owns, which **Owner** places "wherever it is kept", or the records it keeps? D5's failure on P7 depends on reading them as owned.
- **P10's escape.** Is a rule written only to accept a stale read a **Business rule** ("What the business domain allows, requires or forbids")? If any such rule counts, P10's first half refuses nothing.
- **P17 "ends".** There is no bound, so a flow that ends after a week of retries holds.
- **Whether D3 is plainly bad depends on size.** The world has no force for size or for people working at once, and "Out of scope: throughput and load". A small business on one modular system is reasonable. F10 is proposed as the force that separates the two cases, but I could not decide whether the authors want it.
- **Hub variant.** I did not write up a variant of "one system owning everything" where a Core system keeps and owns every record and the other systems answer from Core through live calls. It holds for the same reason D1 does, P15 "as far as its own data reaches", and is covered by P19.
- **External configuration and P2.** **External system** says "Its configuration may hold business rules this codebase writes". So "A business rule lives in one place: the domain" does not say whose domain. A design that moves every rule into an external system's configuration was not decided.
