# Red team review, raw set

Read: `glossary.md`, `the-world.md`, both whole. Example business domain throughout: selling tea online.

## Summary

- **A. Distributed monolith**: holds. Findings: no property asks a system to keep the data its use cases need (P15 "as far as its own data reaches"); no property keeps a call between systems compatible across a deploy (P14 covers only "A record or a message").
- **B. Every system reading one shared schema**: holds, on P5's heading; P5's *Why* refuses it. Finding: no property forbids reading another system's records (P11 covers only "changes"; P5's heading only "is reached from it").
- **C. One system owning everything**: holds. Finding: no property makes two meanings of one word two systems; P3 asks only that rules "share nothing", not that they sit apart.
- **D. Ports found from within (every use case looks its ports up in a per-process ambient value)**: holds. Finding: no property makes what a use case reaches readable without reading its body (against F3).
- **E. Vendor-shaped domain (every system a conformist of one external system)**: holds, on P5's heading read with the Conformist definition; P5's *Why* refuses it. Finding: P1's *Except* and P12's "only by choice" admit any choice, including a domain that models the vendor.

Designs that hold: 5 (B and E only on P5's heading, see Notes).

## Design: A. Distributed monolith

**What it is.** The tea shop is cut into systems along reasons for change: catalog, pricing, stock, cart, order, billing, shipping. Each system is one bounded context with its own store and its own processes. Each keeps only the records it is owner of; none keeps a replica of another's data. Every use case reaches what it needs of other systems by calling their open host service at the moment it runs: showing a cart calls pricing, which calls catalog; placing an order calls cart, pricing, stock and billing in a chain. Each downstream system is an anti-corruption layer: the upstream's published language stops at its adapters. Changes asked of other systems are tentative operations (reserve stock, authorize payment), confirmed by commands written through the outbox port after the commit; an orchestration's process manager in order holds the sequence and undoes earlier steps when a later one fails (a saga). Published languages are versioned apart from the models. A change to a published language ships on one release day to the upstream and all its downstream systems.

**Why it is bad in practice.** Every use case is down whenever any system in its chain is down or slow; availability is the product of all of them, and latency stacks. No system can show a cart, a price or an order history on its own. Every change to a published language needs the upstream and its downstream systems released together, and during a deploy old callers meet new driving ports. Seven systems' worth of processes, stores and deploys buy none of the independence systems are for.

### Properties

| Id | Holds | How, in the property's words |
|---|---|---|
| P1 | holds | Each domain holds only its business rules; other systems' terms stop at the anti-corruption layer's adapters. "The domain models the business domain, not what serves it." |
| P2 | holds | Each business rule sits in its owner's domain; services only sequence calls. "A business rule lives in one place: the domain." |
| P3 | holds | The cut follows reasons for change; systems depend on each other at run time, not through shared code. "Business rules that change together sit together; rules that change for different reasons share nothing either would have to change." |
| P4 | holds | Other systems sit behind driven ports; a server function, a handler and a test reach the same use case. "A use case responds the same whoever calls it and whatever serves it." |
| P5 | holds | Every call out passes a driven port in the caller's terms; every call in passes a driving port. "only through its ports; each port speaks the system's terms." |
| P6 | holds | Every other system has a fake behind its driven port that is down, slow or refusing on demand. "Every use case can run with nothing outside the process"; "behaves as the outside does wherever the use case can tell." |
| P7 | holds | Each use case commits its own records in one transaction of its own store. "A use case's writes to its own system's records land together or not at all." |
| P8 | holds | Reservations and authorizations are tentative operations; confirmations leave through the outbox. "What is asked of another system, or of this one, before the commit stays tentative, confirmed only after it." |
| P9 | holds | Handlers record each message's id. "A repeated delivery changes nothing in this system." |
| P10 | holds | Each aggregate commits on a version check; what was read from another system is taken as stale and kept as a snapshot (the price the order was placed at). "or on stale ones a business rule accepts." |
| P11 | holds | Each system writes only its own records; change elsewhere is asked by command, which the receiver "may refuse". "No other system changes the records a system owns." |
| P12 | holds | Translation at every adapter is chosen. "Another system's model enters this one only by choice." |
| P13 | holds | Published languages are versioned apart from the models. "The published language holds still while the model moves." |
| P14 | holds | Records and messages carry versions. "A record or a message means the same to all code that reads it, whenever it was written." |
| P15 | holds | No system keeps another's data, so its own data reaches almost no use case; the rest fail visibly. "as far as its own data reaches"; "one needing another system now fails visibly, and that is expected." |
| P16 | holds | Each system commits alone; cross-system steps are tentative operations. "No transaction spans two systems." |
| P17 | holds | Calls time out; the process manager confirms or cancels each tentative operation. "Work spanning systems ends, and only in a state a business rule allows"; "Every tentative operation eventually confirms or cancels." |
| P18 | holds | Each handler checks what its system already knows; a cancel before its order is kept and applied when the order arrives. "Each message is handled against what the system already knows, whatever came first." |

### Forces

| Id | Exposed although every property holds | How |
|---|---|---|
| F1 | no | Adapters swap behind ports. |
| F2 | partly | Each time "the cut between systems moves", call chains are rewired across processes; P3 holds at any one cut. |
| F3 | yes | An edit to one system's driving port, made having read only that system, breaks callers in other processes; nothing in the properties keeps a driving port compatible. |
| F4 | yes | "A deploy replaces processes one at a time": an old caller calls a new open host service, or the reverse. P14 covers "A record or a message", not a call. |
| F5 | no | P9, P18. |
| F6 | no | P10. |
| F7 | yes, most | "Another system can be down, slow": every use case needs some other system now, and P15 allows that because its own data reaches nothing. |
| F8 | yes | A published-language change on the upstream's schedule forces every downstream release; P13 covers "changes its model", not its published language. |
| F9 | no | No external system in the design. |

## Design: B. Every system reading one shared schema

**What it is.** All systems keep their records in one store under one schema. Each table has one owner and only the owner writes it. Every system reads any other system's records directly, through a driven port of its own in its own terms, whose driven adapter queries the owner's tables and translates. The reading happens outside the reader's transaction; the reader's transaction writes only its own records. Each owner keeps its record shape still when its model moves (its driven adapter maps the model onto the record shape) and versions records when the shape must change. Messages go through each system's outbox as usual.

**Why it is bad in practice.** It is the integration database. Each owner's tables are a contract nobody declared: no port of the owner names who reads them, so the owner cannot replace its store, split a table or move to another store without finding every reader in every other system. Each reader depends on the owner's storage shape, not on anything the owner offers. The coupling is invisible from the owner's code.

Variants that fail: the shared schema as a shared kernel every domain imports fails P3 ("A billing change that reaches checkout through a shared `Order` edits code that had no reason to change"); readers that also write fail P11.

### Properties

| Id | Holds | How, in the property's words |
|---|---|---|
| P1 | holds | The reader's port and domain are in its own terms; the table shape stops at its driven adapter. "The domain models the business domain, not what serves it." |
| P2 | holds | Readers read only columns that state facts, not ones they would derive with the owner's business rules. "A business rule lives in one place: the domain." |
| P3 | holds | No shared code between systems; the record shape holds no business rule. "share nothing either would have to change." |
| P4 | holds | Each use case's ports take a store or a fake. "whatever serves it." |
| P5 | holds, heading only | The reader reaches the store, which the glossary counts as outside ("Outside. ... a store"), through its own driven port in its own terms; the owner is never called, so it is not "reached". "A system reaches the outside, and is reached from it, only through its ports; each port speaks the system's terms." The *Why* refuses: "Another system reading this one's records past its ports breaks whenever the store or the records change." |
| P6 | holds | The reader's port over the owner's records has a fake. "Every use case can run with nothing outside the process." |
| P7 | holds | Each use case writes its own records in one transaction. |
| P8 | holds | Messages leave through the outbox. "nothing final follows from it before it commits." |
| P9 | holds | Handlers record message ids. |
| P10 | holds | Reads of other systems' records are taken as stale and accepted by a business rule, as a replica would be; they take no lock. "or on stale ones a business rule accepts; use cases fail each other only where a business rule ties them." |
| P11 | holds | Readers only read. "No other system changes the records a system owns." |
| P12 | holds | Each reader chose to read and translate. "only by choice." |
| P13 | holds | The owner's record shape holds still while its model moves; and a reader of records is arguably no downstream system at all, since a downstream system "calls the upstream's open host service, sends its commands, handles its events". "A system changes its model without its downstream systems changing." |
| P14 | holds | Records are versioned; the property itself counts readers in other systems: "All code includes processes still running older code and the systems downstream." |
| P15 | holds | The owner's process down, its records are still in the store and still read. "A system works while others are down or slow." |
| P16 | holds | The reader's transaction writes only its own records; reads of others happen outside it. "No transaction spans two systems." |
| P17 | holds | Cross-system work, where there is any, uses tentative operations as in A. |
| P18 | holds | As in A. |

### Forces

| Id | Exposed although every property holds | How |
|---|---|---|
| F1 | yes | "A store ... is replaced": the owner cannot replace its store or its table layout alone; every reader's driven adapter breaks. |
| F2 | yes | A business change that changes the owner's records changes every reader. |
| F3 | yes, most | An edit to an owner's tables, made having read the owner's code, cannot see the readers; P5's *Why* "the ports tell all of it" no longer holds, though P5's heading does. |
| F4 | no | P14. |
| F5 | no | P9, P18. |
| F6 | no | P10. |
| F7 | no | Better than a good design: owners' records stay readable while owners are down. |
| F8 | yes | The owner's records change "on its schedule, not this one's". |
| F9 | no | No external system in the design. |

## Design: C. One system owning everything

**What it is.** The whole tea shop is one system: one bounded context, one domain, one glossary, one store, its processes all running the same code. It is owner of every record. Its only outside is third parties: a payment provider and a mail provider (external systems), the clock. Inside, aggregates are cut small along reasons for change; where the business says one word in two senses ("customer" to billing and to shipping), the one glossary forces two terms (`Payer`, `Recipient`), so no rules that change for different reasons share an aggregate. The payment provider is behind an anti-corruption layer; payment is a tentative operation confirmed after the commit.

**Why it is bad in practice.** One glossary for the whole business: every word the business uses in two senses becomes a coined term nobody in the business says, or one overloaded term. Nothing ever splits, so the model grows until no reader knows it whole. Every change to any part deploys all of it. Every person and agent works in the same model and the same store.

### Properties

| Id | Holds | How, in the property's words |
|---|---|---|
| P1 | holds | The domain models the business; the payment provider's terms stop at its adapters. "The domain models the business domain, not what serves it." |
| P2 | holds | All rules in the one domain. "A business rule lives in one place: the domain." |
| P3 | holds | Rules that change together sit together trivially; rules that change for different reasons sit in different aggregates and share no code. "rules that change for different reasons share nothing either would have to change." Its *Provenance* even advises it: "start with wider boundaries." |
| P4 | holds | Ports and fakes as usual. "whoever calls it and whatever serves it." |
| P5 | holds | The outside (payment, mail, clock, store) only through ports. |
| P6 | holds | Fakes for every port. |
| P7 | holds | One store, one transaction per use case. |
| P8 | holds | Payment confirmed and mail sent after the commit, through the outbox. |
| P9 | holds | Payment provider webhooks deduplicated by id; "Where an effect outside can repeat, a business rule allows the repeat." |
| P10 | holds | Small aggregates, version checks. "use cases fail each other only where a business rule ties them." |
| P11 | holds | No other system writes its records; the external systems keep their own. |
| P12 | holds | The payment provider's model translated, by choice. |
| P13 | holds, vacuously | It has no downstream system. "A system changes its model without its downstream systems changing." |
| P14 | holds | Records and messages versioned across deploys. |
| P15 | holds | Every record is its own; only payment and mail need another system. "as far as its own data reaches." |
| P16 | holds | No transaction with the payment provider. |
| P17 | holds | Payment authorization confirms or cancels. |
| P18 | holds | Webhooks handled against what it knows. |

### Forces

| Id | Exposed although every property holds | How |
|---|---|---|
| F1 | no | Ports. |
| F2 | yes | "the model grows, the cut between systems moves": there is no cut to move, and nothing in the properties makes one. |
| F3 | yes, most | "Edits are partial": one glossary for the whole business; an edit made having read the part around `Payer` never meets `Recipient`, though the business calls both "customer". |
| F4 | partly | Every deploy replaces all of the business at once; P14 holds. |
| F5 | no | P9, P18. |
| F6 | no | P10. |
| F7 | no | Only the payment provider and mail provider. |
| F8 | no | No other systems of this codebase. |
| F9 | no | Anti-corruption layer at the payment provider. |

## Design: D. Ports found from within

**What it is.** Assembly does not hand any service its driven ports. It fills one per-process ambient value, a registry from port to implementation, and every service, at the point it needs one, looks a driven port up in it. Port and implementation still meet only in assembly. Tests fill the same registry with fakes. The domain stays pure. Systems, stores, outboxes and messages are otherwise as in a good design.

**Why it is bad in practice.** No use case shows what it reaches. A reader of a service learns its ports only by reading its whole body and everything it calls; a helper that adds a lookup makes every use case that calls it reach the store, with nothing outside the body changed. A new caller (a test, a CLI command) learns which ports to fill when one is missing at run time. Tests in one process share one registry.

### Properties

| Id | Holds | How, in the property's words |
|---|---|---|
| P1 | holds | The domain reads no ambient value. "The domain models the business domain, not what serves it." |
| P2 | holds | Unchanged by how ports are obtained. |
| P3 | holds | Unchanged. |
| P4 | holds | Whatever implementation the registry holds, the use case responds the same. "A use case responds the same whoever calls it and whatever serves it." |
| P5 | holds | Every reach outside still passes a port; ports speak the system's terms. "only through its ports." |
| P6 | holds | Fill the registry with fakes. "Every use case can run with nothing outside the process." |
| P7 | holds | Unchanged. |
| P8 | holds | Unchanged. |
| P9 | holds | Unchanged. |
| P10 | holds | Unchanged. |
| P11 | holds | Unchanged. |
| P12 | holds | Unchanged. |
| P13 | holds | Unchanged. |
| P14 | holds | Unchanged. |
| P15 | holds | Unchanged. |
| P16 | holds | Unchanged. |
| P17 | holds | Unchanged. |
| P18 | holds | Unchanged. |

### Forces

| Id | Exposed although every property holds | How |
|---|---|---|
| F1 | yes | "a new caller arrives: a CLI command, a webhook, a test": it cannot tell which ports to fill until a lookup fails. |
| F2 | no | |
| F3 | yes, most | "People and agents change code having read only part of it": the part read does not show what the code reaches. |
| F4 | no | |
| F5 | no | |
| F6 | no | |
| F7 | no | |
| F8 | no | |
| F9 | no | |

## Design: E. Vendor-shaped domain

**What it is.** The tea shop's systems (catalog, order, billing, shipping) are each a conformist of one external system, a commerce platform: its ports become their driven ports, and its published language (its line items, price rules, fulfillments) is used untranslated "in any layer including the domain". The tea shop's own business rules (blends, subscriptions, grading) are written in the platform's types, in this codebase's domains. Each system keeps its records in its own store, in the platform's shape, versioned; each offers its own published language, versioned apart from its model. Platform webhooks are hooks, deduplicated.

**Why it is bad in practice.** The domain models the vendor, not the tea business. Every change of the platform's model rewrites the tea shop's own business rules; leaving the platform means rewriting every domain. What P1's *Why* warns of, "Where a store, a framework or a carrier shapes the domain, replacing one rewrites business rules nobody meant to change", happens by permission.

### Properties

| Id | Holds | How, in the property's words |
|---|---|---|
| P1 | holds | "*Except:* another system's model this system chose to take (P12)." |
| P2 | holds | The rules sit in this codebase's domains, in the platform's types. "A business rule lives in one place: the domain." |
| P3 | holds | Each system's rules change for its own reasons; a platform change is not a business change. |
| P4 | holds | A fake of the platform's ports, or another vendor adapted to them, serves the use case unchanged. "whatever serves it." |
| P5 | holds, heading only | Under the Conformist definition the platform's ports are this system's driven ports and its terms are taken as this system's ("its ports become the downstream's driven ports"). "each port speaks the system's terms." The *Why* refuses: "A port in the store's or the carrier's terms tells nothing, and the meaning moves into the code behind it." |
| P6 | holds | Fakes of the platform's ports. |
| P7 | holds | Own store, one transaction. |
| P8 | holds | Calls to the platform before the commit are tentative operations. |
| P9 | holds | Webhooks deduplicated; "Where an effect outside can repeat, a business rule allows the repeat." |
| P10 | holds | As in A. |
| P11 | holds | The platform does not write this codebase's stores; its hooks call driving ports. |
| P12 | holds | "Taking another's terms as they are is as much a choice as translating them." Chosen. |
| P13 | holds | Each system's published language is versioned apart from its model. |
| P14 | holds | Records versioned when the platform's shape changes. |
| P15 | holds | Records kept locally; works while the platform is down "as far as its own data reaches". |
| P16 | holds | No transaction with the platform. |
| P17 | holds | Tentative operations confirm or cancel. |
| P18 | holds | Hooks handled against what the system knows. |

### Forces

| Id | Exposed although every property holds | How |
|---|---|---|
| F1 | yes | "A store, a mail provider, a framework is replaced": replacing the platform means adapting a new vendor to the old vendor's model forever, or rewriting every domain. |
| F2 | yes | A tea-shop business change must be expressible in the platform's model. |
| F3 | partly | A reader of the domain must know the platform's model to read the tea shop's. |
| F4 | no | P14. |
| F5 | no | P9, P18. |
| F6 | no | P10. |
| F7 | no | P15. |
| F8 | yes, most | "Another system's model and published language change on its schedule": every domain changes with it. |
| F9 | yes | "its contract follows its own model": that model is now this codebase's domain. |

## Findings

### From A: a system keeps what its use cases need

**Proposed P19. A use case needs another system now only where a business rule needs that system's answer now**

*Against:* F7.
*Lets A through:* P15 "as far as its own data reaches"; its *Why*: "one needing another system now fails visibly, and that is expected." A system that keeps no replica has its own data reach nothing, and P15 holds of it.

### From A: calls across a deploy

**Proposed P20. A call between systems means the same to the code on both sides, whichever side a deploy has replaced**

*Against:* F4, F8.
*Lets A through:* P14 "A record or a message means the same to all code that reads it", which does not name calls, though the Scope does: "Systems reach each other through calls and messages"; P13 "A system changes its model without its downstream systems changing", which covers the model, not the published language.

### From B: reading another's records

**Proposed P21. No system reads the records another system owns, except through that system's ports or what it publishes**

*Against:* F1, F3, F8.
*Lets B through:* P11 "No other system changes the records a system owns" (reads are not changes); P5 "is reached from it, only through its ports" (reading a store, which is outside, is not reaching the owner); P14's *Why* "All code includes ... the systems downstream", which presumes other systems read records. The refusal exists only in P5's *Why*: "Another system reading this one's records past its ports breaks whenever the store or the records change." Equally: lift that sentence into P5's heading.

### From C: one system for the whole business

**Proposed P22. Where the business means two things by one word, the two meanings sit in two systems**

*Against:* F2, F3.
*Lets C through:* P3 "rules that change for different reasons share nothing either would have to change", which asks only for no sharing, not for sitting apart; its *Why* names the split, "where a system splits once the business domain is better known", but no property asks for it; its *Provenance* advises "start with wider boundaries".

### From D: what a use case reaches

**Proposed P23. Which ports a use case reaches is told where it is assembled, not found by reading its code**

*Against:* F3, F1.
*Lets D through:* P5 "only through its ports", which says what a system reaches through, not where a reader learns it; P4 "whatever serves it" and P6 "Every use case can run with nothing outside the process", both of which a per-process ambient value delivers.

### From E: the vendor's model in the domain

**Proposed P24. A system that takes another system's model keeps its own business rules in its own terms**

*Against:* F8, F9.
*Lets E through:* P1 "*Except:* another system's model this system chose to take (P12)"; P12 "only by choice" and "Taking another's terms as they are is as much a choice as translating them", which set no condition on the choice; the glossary's Conformist, "used untranslated, in any layer including the domain".

## Notes

- **Does a property's *Why* bind like its heading?** B and E hold on P5's heading and fail on its *Why*: "Another system reading this one's records past its ports breaks whenever the store or the records change"; "A port in the store's or the carrier's terms tells nothing". I counted them as holding on the heading. If the *Why* binds, B and E fail P5, P21 is already there, and E's failure contradicts the glossary's Conformist ("its ports become the downstream's driven ports").
- **Is a call a message?** Scope: "Systems reach each other through calls and messages"; glossary Message: "What one system tells another, or itself, so that it may act. It has an id". If a call is a message, P14 covers A's deploy gap and P20 is not needed. I read calls as not messages, from the Scope sentence.
- **Is a reader of records a downstream system?** Glossary Downstream system: "calls the upstream's open host service, sends its commands, handles its events". If not, P13 says nothing of B's readers. B holds either way, but P13's reach is unclear.
- **Does a transaction that reads another system's records span two systems?** P16 "No transaction spans two systems." In one store a reader's transaction may read the owner's tables. I kept B's reads outside the transaction so as not to depend on this.
- **Conformist and P3.** P3 "share nothing either would have to change": a conformist's domain shares the upstream's published language, which a change of the upstream's business rules changes. If that is sharing, P3 refuses conformists, and contradicts P12 "Taking another's terms as they are is as much a choice as translating them". I made A an anti-corruption layer to avoid this; E depends on it.
- **"Its own data": owned or held?** P15 "as far as its own data reaches"; its *Why*: "A use case needing only data this system holds runs anyway". Owner: "wherever it is kept". A system whose records another system keeps is owner of data it does not hold.
- **Not counted: an entity system** that keeps every record while the other systems hold only business rules and call it to load and save. It hung on P11 "No other system changes the records a system owns" against Owner "The system whose business rules decide what a record holds, wherever it is kept" and Store "Two clients are one store when their writes commit together": whether a system that commits another's writes changes its records, or is its store. I could not say how P11 holds, so it is not a design that holds.
- **C may be intended.** P3's *Provenance*: "start with wider boundaries". If one system for the whole business is meant to be admitted, P22 overrules that advice and C is not a finding.
