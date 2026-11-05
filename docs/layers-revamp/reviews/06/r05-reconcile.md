# Review 05 findings against the current rules

Judged against `glossary.md`, `the-world.md`, `property-rules.md` at `3d5adb6`. Binding: glossary,
world headings and Except, rule Heading/Scope/Statement. Decisions applied as given in the brief
(tests are tooling; the common library is judged where it runs; Payload's config may import a hook;
each polled item handed on as one message).

### R05-6: closed
- Finding: P4 s2 "at most one acting call per call or message it handles" allows one per poll; the Why gives one per polled item.
- Now: P4 s2 unchanged. P9 Scope: "called ... for a message, whether the bus delivered it, a hook was called with it, or a driving adapter asked another system for it". P4 Why: "one acting call per item, or one that writes one message per item (P7)".
- Why: under the decision each polled item is a message the adapter handles, so P4 s2 gives one acting call per item. The one-call build (writing one message per item) complies too. Both readers' builds comply, and Statement and Why agree.
- Property: P4 (one way in holds no sequence). Sits under P4; part of its harm, half a sequence outside a transaction, is P7's. No glossary text names a polled item a message (Message: "What one system tells another"); P9 Why and the decision do.

### R05-7: closed
- Finding: P2 Why "no statement of the rule" makes P13 s3's MAY grant nothing, under the key "MAY: permission where another rule would forbid".
- Now: P13 s3 "MAY state in their own terms what a business rule of the domain also states". P2 s1 "MUST NOT state it again". The distilled preamble no longer carries the MAY key (`distill-properties.mjs`).
- Why: the MAY now reads as a plain permission against P2 s1's letter. P2 Why and P13 Why say the same thing ("for the published language alone" / "the published language's alone"), so the Why and the MAY no longer contradict.
- Property: P13 (the contract changes on its own terms). The permission is an exception to P2 s1 but sits under P13. Both Whys cross-refer, so no clash.

### R05-8: closed
- Finding: P14 s1 "one schema ... that its writer and every reader parse with" binds Stripe as a writer; the Why says the rule asks nothing of external systems.
- Now: P14 s1 is unchanged. Assumptions: "An external system sits outside the rules: its exports, its layers and its transactions are its own"; its API's types are "the published language".
- Why: Stripe as writer is outside the rules. Readers here parse with one schema, Stripe's package types. Reading the writer clause as binding Stripe means ignoring the Assumptions, and such a build cannot be made anyway. Dissolved.
- Property: P14. Placement right.

### R05-9: open
- Finding: P8 s3 "MUST make the change" when the 3PL or Stripe refuses it.
- Now: P8 s3 is unchanged: "A use case called for such a message MUST make the change, deciding nothing again". P17 s4: "A refusal of a business process step MUST be committed as its outcome and reach the system that decided the business process step". P17 Why: "the shipment marked unbooked with the 3PL's reason ... an external system that declines: the use case that asked records it the same way".
- Why open: P8 s3 has no carve-out for an outside that refuses, so it cannot be met there, while P17 s4 governs the same case. There is only one build (attempt the change, commit the refusal), so this is no split. It is a literal clash between two Statements.
- Property: P8 s3 delivers P8 (what the commit decided is not lost or decided again); the refusal as outcome is P17's. The clash comes from their overlap at the executor that is refused.
- Binding: P8 s3, P17 s4.

### R05-11: closed
- Finding: P11 s1 lists only the open host service and published events as read channels; the Why admits data handed over in a command.
- Now: P11 s1 is unchanged. P11 Scope: "reads or changes a record another system owns". Glossary Record: "What a store holds and a write changes". P11 Why: data handed over "is a message in a published language, not a record of the owner's store".
- Why: a delivered command's field is no record held by a store, so it falls outside the Scope. No implementer plausibly refuses fulfillment reading `ReserveStock`'s lines. The "published events delivered" channel stays the shape for reads of records, the outbox at rest being refused. Dissolved.
- Property: P11. Placement right.

### R05-13: open
- Finding: P16 s2's ambient ban has no told purpose inside a system that makes no in-process call into another system.
- Now: P16 s2 is unchanged: "It MUST travel only as an argument, never as an ambient value". The Scope reaches "a transaction a system opens". Every harm in the Why still needs a call into another system (billing's repository adapters finding shop's client).
- Why open: same text, same gap. Inside one system the reasons sit elsewhere. P5 Why: "So does a transaction: whether its commit lands decides whether the use case's writes exist". P7 s1: one transaction carrying every write. Neither is P16's.
- Property: P16 needs the clause only where a call crosses. Within one system it delivers P5/P7. Misplaced: the clause binds every transaction under a property that explains only the crossing.
- Binding: P16 Scope, P16 s2. P5 s3 does not name a transaction (it covers what "assembly" chooses).

### R05-14: closed
- Finding: P2 s1 "the same for every candidate" leaves a segment-keyed table (dunning 14/30 days) outside the MUST.
- Now: P2 s1 is unchanged. P2 Why: "The candidate's own data, the order's total, is what the rule decides about, not part of the rule". P4 s1: "a configuration value MUST NOT change either".
- Why: read cooperatively, the table's values are the same for every candidate and only the segment, the candidate's data, varies. The places the literal reading opens are refused anyway: configuration by P4 s1, and a service by P2 s1 "stated once, in its domain". A record stays allowed. No second build survives. Dissolved.
- Property: P2. Placement right.

### R05-17: closed
- Finding: P6 Why's "a transaction port whose fake commits nothing" leaves open whether the fake rolls back (both Fresh readers took that it does).
- Now: the Why's wording is unchanged. P6 s3: the suite "MUST assert each behavior of the port that a test of a use case relies on, on the fake". P6 Why: "behaves as the outside does wherever the use case can tell".
- Why: a test that relies on rollback brings the assertion onto the fake, so a fake that does nothing on throw fails the binding suite. "Commits nothing" means "to no store". Reading it otherwise means ignoring P6 s3. Dissolved; under the decision P6 binds only that the fake and the suite exist.
- Property: P6. Placement right.

### R05-18: open
- Finding: P1 "MUST load on every runtime of the language": `Intl` with time zones (ECMA-402, small-ICU builds) is untold.
- Now: P1 s2 is unchanged: "That pure code MUST be in no terms of the outside and MUST load on every runtime of the language". The Why names `node:path`, `Buffer`, `process`, `window`, the DOM, browsers and edge runtimes, and says nothing of `Intl`.
- Why open: all three readers took `Intl` in, but the other build is plausible and was named: ECMA-262 only (a local date passed as an argument), or the runtimes the codebase deploys to (Fresh B). The text does not choose. Split, narrow.
- Property: P1. Placement right.
- Binding: P1 s2.

### R05-19: closed
- Finding: the stock field in Payload's admin, read through fulfillment's open host service (all three) or through a hook of fulfillment calling an internal driving port.
- Now: P11 Scope covers "configuration this codebase writes for an external system". P11 s1: "read it only through that open host service". P5 s2: "or by a driving adapter's way in".
- Why: under the decision both builds comply. Config can import fulfillment's hook by a way in (P5 s2), the hook being fulfillment's own code reading its own record, so it is outside P11's "another system owns". Or a hook defined in the config reads the offer's port from a courier, through the open host service. Dissolved.
- Property: P11 for the read, P5 for the import. Placement right.

### R05-20: open
- Finding: the revalidate route has no layer and no glossary name. It is read as the far side of shop's driven adapter.
- Now: Glossary Adapter: "Code on the far side of a port". System: "A module is of the system whose layer or offer it belongs to, wherever the codebase keeps it". P5 s2: "Anything outside a system MUST reach into it only through its offer or by a driving adapter's way in". P5 Why: "Callers outside the codebase, a framework ... reach a driving adapter by its way in".
- Why open: the glossary places the route in shop's driven adapter. But Next, the outside, then calls a file of shop that is no driving adapter's way in, which P5 s2's letter leaves unaccounted for. The other build (a driving adapter, a driving port and a use case) is plausible (Fresh B S19 Reading B). Split.
- Property: P5. Placement right.
- Binding: P5 s1, P5 s2; glossary Adapter, System.

### R05-21: closed
- Finding: P10 s2 "data whose change fails no transaction of this store": only other stores and systems, or any read not covered by the saved aggregate; and replicas in this system's own store.
- Now: P10 s2 is unchanged. P10 Why: "a replica lags its owner ... A business rule across aggregates the use case does not save together is in the same place".
- Why: the letter already gives the wider reading. A row read and not saved, whose change fails nothing, needs a stale rule. A replica's staleness is against its owner, which no failure in this store covers. Both readers built so. The narrow reading needs "fails no transaction" to mean "sits in no store of ours". Dissolved.
- Property: P10. Placement right.

### R05-23: closed
- Finding: P5 "way in ... which is no export": whether a framework file or Payload's config may import a driving adapter through export paths.
- Now: P5 s2: "only through its offer or by a driving adapter's way in". P13 Why: "The system's own driving adapters are the system's code wherever a framework wants the file (glossary: System)".
- Why: under the decision Payload's config imports a hook through a way in. The framework file is the system's own driving adapter wherever it sits. Both of Fresh A's builds comply. "Which is no export" sits in the Why and means "not on the offer". Dissolved.
- Property: P5 (the reached-from half of its heading). P5 s2 and P13 s1 ("import of a system only its offer") both bind imports. The decision settles where they overlap.

### R05-25: closed
- Finding: P18's "one thing" can mean the thing told of or the record changed; and whether private messages count.
- Now: P18 is unchanged. Scope: "messages that tell of the same thing, written by one system or by several". Glossary Message covers *private*. The heading binds: "The order messages arrive in does not change the outcome".
- Why: either reading of "thing" ends with a business rule deciding between payment's and billing's events on shop's `Order`. Keeping whichever arrived last breaks the binding heading. Private messages are messages by the glossary, and reading them out needs ignoring that. Dissolved.
- Property: P18. Placement right.

### R05-26: open
- Finding: P3's kernel clause: whether `Money`'s own schema is allowed; whether `vatRate(taxClass)` belongs to the kernel or to billing.
- Now: P3 s2: "A shared kernel MUST hold no such rule and no record's schema, only values and what computes values from arguments". P3 Why: "`Money`'s rounding is about any amount and reaches a record only through the owner's rule"; "offers the values the owners' rules decide by". P2 Why: "The values a rule decides by are part of it: ... the VAT rate".
- Why open: the `Money` schema is a value's schema, which the letter allows (dissolved). `vatRate` stays split. It computes a value from an argument and is about any amount (P3 Why's test: kernel), yet P2 Why makes the rate part of billing's rule about the invoice line (P3 s1: billing's domain). "Values" means value types in P3 and decision parameters in P2.
- Property: P3. Placement right; P2's Why pulls against it from under P2.
- Binding: P3 s1, P3 s2, P2 s1.

### R05-27: closed
- Finding: the Assumptions call types generated from Payload's config a published language, while P13 s3 says a published language "MUST NOT ... be generated from the rest of it".
- Now: P13 s3 is unchanged. Assumptions are unchanged: an external system's "exports ... are its own, even where this codebase writes its configuration", and its published language includes "the types generated from this codebase's configuration of it".
- Why: `payload-types.ts` is the external system's export, outside the rules. P13 s3 binds the published-language modules of systems of this codebase. Reading s3 onto Payload means ignoring the Assumptions, which name the generated types on purpose. Dissolved.
- Property: P13. Placement right.

### R05-28: changed
- Finding: an adapter's tests import the upstream's fake; P12 reaches the upstream's published language "only by its adapters".
- Now: Glossary Tooling: "Code that runs in no process of the deployed application". Assumptions: "Tooling sits outside the layers and the rules"; how a test stands in for assembly is the codebase's. P13 Why is unchanged: "The downstream's own tests are code of the downstream too, and fake the upstream through the fake the offer exports".
- Why changed: the P12 question is dissolved, since tests are tooling and P12 binds no test. What remains is P13's Why sentence, which counts tests as code under P13 s1's "Code of another system", against the glossary and the Assumptions. The import it describes complies either way: the fake is on the offer.
- Property: P12/P13; the test sentence belongs to neither.
- Binding: P13 s1, glossary Tooling, Assumptions.

### R05-32: closed
- Finding: an `Outbox` port typed by an upstream's command types puts the upstream's terms into the service. The P2/P13 talk of "shop's `ReserveStock`" reads as the sender's service building commands.
- Now: P12 s1: "reach that published language ... only by its adapters that carry a call or a message". P12 Why: "the driven adapter behind a port of shop's own that turns shop's terms into fulfillment's `ReserveStock` and writes it to shop's outbox". Glossary ACL, now generic: "the layer that translates between the upstream's published language and the system's own terms".
- Why: the binding P12 s1 plainly refuses the typed port for an anti-corruption system. The narrow old ACL wording that missed the outbox adapter is gone. P13 Why's "shop's `ReserveStock`, declared in shop's published language" stays and reads as the breach it illustrates. Dissolved.
- Property: P12. Placement right.

## Table

| id | status | rules | kind |
| --- | --- | --- | --- |
| R05-6 | closed | P4 s2, P9 Scope | dissolved |
| R05-7 | closed | P2 s1, P13 s3 | dissolved |
| R05-8 | closed | P14 s1, Assumptions | dissolved |
| R05-9 | open | P8 s3, P17 s4 | clash |
| R05-11 | closed | P11 Scope, s1; gl. Record | dissolved |
| R05-13 | open | P16 s2 (P5, P7) | misplaced |
| R05-14 | closed | P2 s1, P4 s1 | dissolved |
| R05-17 | closed | P6 s3 | dissolved |
| R05-18 | open | P1 s2 | split |
| R05-19 | closed | P11 s1, P5 s2 | dissolved |
| R05-20 | open | P5 s1, s2; gl. Adapter, System | split |
| R05-21 | closed | P10 s2 | dissolved |
| R05-23 | closed | P5 s2, P13 s1 | dissolved |
| R05-25 | closed | P18; world P18 heading | dissolved |
| R05-26 | open | P3 s1, s2; P2 s1 | split |
| R05-27 | closed | P13 s3, Assumptions | dissolved |
| R05-28 | changed | P13 s1 / Why; gl. Tooling | Why vs Statement |
| R05-32 | closed | P12 s1; gl. ACL | dissolved |
