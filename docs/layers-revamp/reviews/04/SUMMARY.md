# Review 04: property rules, three readers, distilled set only

Ran at `7d1c798`, over `property-rules.md` as of `4f46425` (19 rules, Statements rewritten from
each rule's Why with `general-rules.md` closed). Not a regular review: `general-rules.md` and its
examples were not read by anyone. The set is `distilled.md` from `distill-properties.mjs`: glossary,
the-world, Assumptions, rules P1 to P19 with Scope, Statement, Why and Provenance, Conventions. No
Examples lines exist, so no example files were named. Readers: Implementer over `distilled.md` and
`domain.md`; Fresh repo drafts A and B over `distilled.md` and `brief.md` (copied from 03,
`domain.md` unchanged since). Opus, effort high, same as 03.

Prompt changes against `regular-review.md`, which change what this review measures:

- Readers received the Why. In 03 the distilled set carried Scope and Statement only.
- Fresh drafts received the rules. In 03 the distilled Fresh drafts read `distilled-world.md`,
  glossary and world only. Their D and S counts are over about three times the text.
- Implementer task 4 (check the named ok files) had nothing to check; replaced by "write an ok
  example per fixture situation". Two tasks added: Statement and Why disagree; readings picked.
- "Purpose not told" now means Scope, Statement and Why together do not tell it.

## Counts

| reader | 03 dist | 04 |
| --- | --- | --- |
| Implementer | 3 cannot-comply, 1 tension; 14 of 16 ok flagged; 12 purpose-not-told | 0 cannot-comply, 4 tension; 52 ok written; 3 purpose-not-told; 4 Statement/Why disagree; 19 readings; 27 notes |
| Fresh A / B | 35 / 34 D; 17 / 19 S | 33 / 43 D; 19 / 19 S |

Readings against the counts: the three 03 cannot-complys are gone and each has a rule that closed
it (§1). Of the four tensions, two are artifacts of the Statement rewrite (T1, and P7 under §2.2),
one was a 03 item (T4 = R03-35), one is new (T2). Purpose-not-told fell from 12 to 3, with the Why
in the set; the three left are each a sentence the rewrite added or kept without its case. The
Fresh S counts held level while the text tripled, and every S quotes a Why beside the Statement:
the Whys are being read as the rule's meaning, which is what shipping them was for. Where the Why
and the Statement disagree the readers took the Why (T1, Fresh B S4).

## 1. Review 03's checklist, state now

Items R03-8 to R03-27 (ok example files by cause) and R03-6, R03-7 (Relies-on lines) are out of
scope: the set has neither. The rest:

- R03-1 Reach through a port transitive: not re-found. P5 says "as a port of its system"; no reader
  asked what lies behind it.
- R03-2 pre-commit hook cannot revalidate nor ask by outbox: resolved. P8 sentence 3 and the Why's
  external outbox; all three built Payload's `afterChange` writing Payload's own outbox in Payload's
  transaction, catalog or shop acting on the message after commit.
- R03-3 PaymentIntent no tentative operation: resolved. P8 sentence 1 "a request for a tentative
  operation made beside the transaction"; all three create the intent before shop's commit (Impl
  saga step 2, Fresh A S17, Fresh B D13/D14). Fresh B does it inside the open transaction carrying
  none, Fresh A and Impl before opening it; P8's "beside" admits both (Impl S13).
- R03-4 keyless mail cannot be idempotent: resolved at a cost. P9 sentence 3; all three wrote a
  domain constant accepting a second mail. The Implementer lists the sentence under purpose-not-told
  (§2.3) for repeats with no business meaning.
- R03-5 published language restating a domain rule: resolved by P13's MAY; both Fresh drafts cite
  it for `quantity` positive.
- R03-31 sku veto, "open order": re-found, now as the top finding (§2.1). "Open order" Impl N23.
- R03-32 `PaymentFailed` terminal or not: re-found (Impl N15), fixture.
- R03-34 one Postgres one store: re-found as Fresh A S3, read as one store per role again.
- R03-35 stale answers from a live open host service: re-found as T4 (§2.1).
- R03-37 acknowledge against Settle: not re-found.
- R03-40 PaymentIntent as tentative: resolved, as R03-3.
- R03-41 request id in outbox headers: re-found, sharper, as T1 (§2.1).
- R03-42 Idempotent, whose records: resolved by P9 sentences 1 and 3 splitting own records from
  outside changes.
- R03-44 probes and the courier: re-found lightly (Impl N20 `probeCourier`).
- R03-45 how conformance is declared: re-found, 3 of 3 (§2.4).
- R03-48 credit note for an order never invoiced: re-found (Impl N17; Fresh B P17 waits on
  `InvoiceableOrder`).
- R03-49 Store "can carry" as per-role stores: re-found (Fresh A S3).
- R03-50 external configuration holds rules, read over P2: re-found and now split, §2.1.
- R03-55 P15 "needs now" met by a synchronous stock hold: changed. None of the three holds stock
  synchronously (03: 4 of 4 did). Fulfillment reserves on `OrderPlaced`; Fresh B keeps a stock
  replica in shop for display only. Checkout's one synchronous wait is payment.
- R03-56 tentative operation before the commit: 3 of 3.
- R03-57 P17 and parked deliveries: closed by P17 sentence 1's "accepting the state as it stands";
  all three end stuck work by accepting it into an operations queue.
- R03-59 choices: §3.

## 2. New in 04

### 2.1 Tensions and the one split

**Who owns the product.** P11's Why: where editors change the record in the external system's
admin, the record is the external system's to own. P2's Why: catalog's veto of a sku change, the
rule stays in catalog's domain, reached through its hook. Fresh A read P2 and built a `catalog`
system owning an adopted `Product` beside Payload's editorial document, with a veto hook and
`catalogStatus` written back. Fresh B and the Implementer read P11 and made Payload the owner with
`min: 1` and `unique: true` in its configuration; the Implementer then has catalog's config call
shop's open host service for the veto as a downstream would (Impl S5), no hook. Three readers, two
Whys, two architectures. This is C4, still open, and the two Whys contradict each other on it.

**T1, P4 sentence 2 against its own Why.** "Code behind a driven port MUST use an ambient value or
a configuration value only to reach the outside it adapts, and in nothing it writes or returns"
refuses the outbox adapter writing the trace context into the envelope; P4's Why says telemetry is
no input and "nothing here refuses them". The old Statement drew the line by behavior (an ambient
value MUST NOT change how the use case acts or what it answers), which admitted telemetry; the
rewrite drew it by use. Fresh B took the Why (S4); the Implementer threaded a `TraceCarrier`
through every outbox call to satisfy the letter. Fresh B also reads the sentence as refusing a
configured mail sender address (S5), moving it into the domain. Rewrite artifact.

**T2, P4 sentence 3 against P10 sentence 3, work started by the clock.** One transaction over all
overdue customers fails whenever any one of them pays (P10); a loop of acting calls in the
scheduled task breaks "at most one acting call" (P4). All three converged on the same shape: one
acting call writes one private message per candidate, each handled in its own transaction (Impl
T2, Fresh A D22/S4, Fresh B D18). The cost is a business rule accepting the candidate list stale
(P10 sentence 2). The rules forced one design, which may be the one meant; nothing in the text
says so.

**T3, an external writer without a version.** P18's fallback for Payload's `ProductChanged`, take
the current state from the owner, makes the replica refresh wait on catalog against P15. The
Implementer configured a `revision` column raised by a trigger in Payload's store; both Fresh
drafts a `revision` field raised in `beforeChange`. P2's Why lists a trigger among refused
statements; the Implementer read it as outside P2's Scope since it decides no business rule.

**T4, P10 sentence 2 against P15's Why.** Every live answer is stale on return, so P10 wants a
business rule accepting it stale; P15's Why says where a rule accepts a lagging value the replica
serves. Read together, no live read is ever allowed, including payment asking Stripe at the
deadline, which P15's own Why gives as its example. Complies only under "stale for the length of
the call is not the replica's lag" (Impl S3). Was R03-35.

### 2.2 Statement and Why disagree

- P4 sentence 2, as T1.
- P5: the Why numbers its sentences in the old Statement's order. "The second clause of the first
  sentence turns the seam around" now points at sentence 2; "the second sentence is assembly hands
  it" at sentence 3; "the third sentence is the exception" at a clause of sentence 1. A reader
  mapping by number reads the courier as the exception. Rewrite artifact; fix the Why.
- P7: "hands to each call that writes" against the Why's "whether the transaction travels as an
  argument or an ambient value ... this rule needs only that every write is carried by it". The
  rewrite made P7 rule on the argument where its Why leaves that to P16. Rewrite artifact.
- P8: the Why calls configuring the external system's outbox a SHOULD; the Statement has none.
  Known fallout of the rewrite (TX-29).

### 2.3 Purpose not told, three sentences

- P4 sentence 2, configuration "in nothing it writes": a driven adapter writing a configured
  `return_url` base or mail sender to its outside is refused, while a driving adapter may pass the
  same value as an argument and assembly may hand it to the adapter's factory.
- P9 sentence 3: a business rule demanded for repeats with no business meaning, cache
  revalidation, a metrics push. The Implementer wrote `REVALIDATION_MAY_REPEAT` into shop's domain
  "only to satisfy the letter".
- P17 sentence 2: a deadline demanded for a wait whose ending changes nothing. Shop's invoice order
  "awaiting payment" holds nothing; the reader invented `settlementWaitEnds` and a
  `settledElsewhere` state against the fixture's "shop's deadline does not apply" (Impl S8).

### 2.4 Readings all three took the same way

- P12 "MUST record each upstream it conforms to": all three record every upstream with its choice
  (`conforms.ts`, `upstreams.json`, `conformance.json`) and generate the import linter from it
  (Fresh A S14, Fresh B S10). The Statement asks less than every reader did.
- P4 "one acting call per call it handles" for a poll: each polled item is a call handled, 3 of 3
  (Impl S1, Fresh A S4, Fresh B S3), from P7's and P9's Whys.
- P6 "set up as it is there": the vendor's test mode or sandbox, 3 of 3 (Impl S15, A, B S15).
- P17 "an aggregate of its own": a deadline field on the waiting system's own aggregate, never a
  separate process record, 3 of 3 (Impl, A S13, B S9).
- P9 "return as the first delivery returned": the first result stored with the claim and replayed,
  3 of 3 (Impl `claim`/`settle`, A D13, B S7).
- P1 "every runtime of the language": the language's standard library, enforced by `lib: ES2023`
  and `types: []`, 3 of 3 (A S7, B P1, Impl P1).
- P13 "only what is typed by its published language": by type, so the offer's fake built on the
  upstream's real services passes (B S14, A P6).

### 2.5 Text hygiene the set carries

- 54 old rule ids are cited in Whys and in the Assumptions and defined nowhere in the set (Impl
  N1). The Assumptions use three as the only definition of what an external system's configuration
  may touch: "(SYS-12)", "(TX-29)", "(SYS-9)".
- Referenced and absent: "general-rules", "the quarry", "Review 02", `components.md`, "the stack
  document", "The Appendix is for the author" (Impl N2). Conventions say "ids are theirs" for
  TST-3, TST-7, TST-12, ASM-10 (N24).
- P5 sentence 1 "either also through code of the common library" reads at first as the adapter's
  two ways (N25).
- Transaction is still undefined in the glossary; every reader defined it by its port.

### 2.6 Fixture lines read as situations by all three

The ambient unit of work in the common library (deleted by the Implementer, unused by both
drafts); "afterChange hooks call shop's services" (Payload's own outbox instead, 3 of 3); "shop
reads the product through Payload's Local API" (a replica, refreshed by message or nightly
reconciliation, 3 of 3); "beforeChange asks shop" (open host service call or no hook). The
dashboard: Implementer a `backoffice` system over replicas, both drafts per-system ops pages (N22:
"the largest cost the fixture pays"). The fixture's mechanism lines no longer describe any design a
reader builds.

## 3. The Fresh drafts and the Implementer against `choices.md`

| | Impl | Fresh A | Fresh B | 03 dist A / B |
| --- | --- | --- | --- | --- |
| systems of ours | shop, payment, billing, fulfillment, backoffice | catalog, shop, payment, billing, fulfillment | shop, payment, billing, fulfillment | 4 / 4 |
| product owner | Payload, config rules | catalog, veto hook | Payload, config rules | Payload / Payload |
| card payments | own system | own system | own system | own / own |
| dunning at checkout | replica | replica | replica | replica / replica |
| stock at checkout | reserve on `OrderPlaced` | reserve on `OrderPlaced` | replica for display, reserve on event | sync hold / sync hold |
| PaymentIntent | before commit, tentative | before commit, tentative | before commit, tentative | after / before |
| coordination | choreography | choreography | choreography | choreography / mixed |
| relationships | ACL everywhere; kernel Money | ACL everywhere; kernel Money, TaxClass, Sku | ACL everywhere; kernel Money | ACL / ACL |
| processes | web, worker, worker-fulfillment | web, worker, migrate | web, worker, migrate | 4 / 4 |
| stores | schema per system | schema, role, pool per system | schema, role per system | same / same |
| dashboard | backoffice replica | per-system pages | per-system pages | Payload / ops pages |

Against the entries: C1 anti-corruption 3 of 3 (03: 3 to 1). C2 choreography 3 of 3 (03: split).
C3 cut four or five, open. C4 split two to one, open, and the Whys contradict (§2.1). C5 not
visible. C6 messages plus replica 3 of 3, the one live call at checkout being payment. C7 `migrate`
job 3 of 3. C8 PaymentIntent before the commit 3 of 3 (03: 2 to 2). C9 payments its own system 3
of 3 (03: 2 to 2). Where drafts agree an entry says they may differ, C2, C8, C9: either P8, P15 and
P17 as now worded closed the choice, or the readers followed the Whys' examples (P8's Why names the
PaymentIntent; P17's Why reasons in events). The requester decides whether that was meant.

## 4. What the readers did not need

No reader asked for a case list, a rule per layer, or the retired ids beyond noting them
undefined. Every Fresh S and every Implementer tension cites a Why; no finding says a Why was too
long. The Implementer wrote 52 ok examples keyed to P-ids and built the saga in seven steps with no
cannot-comply. Against 03's distilled Implementer, which could not build three situations, the
rules as a set are buildable.

## 5. Candidate issues

A grouping, not a decision.

- A. Product owner: P11's Why against P2's Why; C4. One ruling, in one place (§2.1).
- B. Statement and Why alignment after the rewrite: P4 sentence 2 back to the behavioral line, P5
  Why renumbered, P7 "hands" against its Why, P8's SHOULD decided (§2.1 T1, §2.2).
- C. Batch work on the clock: the fan-out as the design, said once in P4's or P10's Why, or a
  `choices.md` entry (T2). Staleness for the length of a call against the replica's lag, in P10 or
  P15 (T4).
- D. P12: record every upstream and its choice, as all three did, or keep "conforms to" and say
  why (§2.4).
- E. P9 sentence 3 and P17 sentence 2 for repeats and waits with no business meaning (§2.3).
- F. Hygiene: old ids and absent documents out of the Whys and Assumptions, or a legend the
  distill emits; Transaction into the glossary (§2.5).
- G. `choices.md`: C2, C8, C9 now 3 of 3; meant or not (§3).
- H. Fixture: the mechanism lines in `domain.md` (§2.6), `PaymentFailed`, "open order", credit
  note for an uninvoiced order, the 3PL's key and sandbox.
- I. The external writer's version: a configured `revision` in Payload, trigger or hook, against
  P2's Why on triggers (T3).

Next: `derive-from-architecture.md` is the restart plan if the requester judges this set not worth
aligning. If it is, B and A first, then a regression pass with the same three readers.
