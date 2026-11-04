# Review 05: property rules after review 04, three readers, distilled set only

Ran at `e8c86d9`, over `property-rules.md` as of `e8c86d9` (19 rules, review 04's findings applied
in d54c665, de423bf, e87b02c, e8c86d9). Same setup as 04, for comparability: the three prompts of 04
verbatim with `reviews/04/` replaced by `reviews/05/`; `distilled.md` from `distill-properties.mjs`;
`domain.md` unchanged since 04 (issue 21 holds its proposals), `brief.md` copied from 04. Readers:
Implementer over `distilled.md` and `domain.md`; Fresh repo drafts A and B over `distilled.md` and
`brief.md`. Opus, effort high, general-purpose, same as 04.

One contamination: three of P5's Glossary notes leaked into `distilled.md` (l.971–973, "Port:
carry …", "Assembly: … settle", "Courier: say assembly fills it …"). A blank line left inside P5's
`*Glossary notes:*` field when e8c86d9 removed the outbox reader note ends the dropped field early.
Fresh B read them as editorial to-dos and checked the draft under both readings (B S4); nothing
else cites them.

## Counts

| reader | 04 | 05 |
| --- | --- | --- |
| Implementer | 0 cannot-comply, 4 tension; 52 ok; 3 purpose-not-told; 4 Statement/Why disagree; 19 readings; 27 notes | 0 cannot-comply, 5 tension; 53 ok; 2 purpose-not-told; 7 Statement/Why disagree; 21 readings; 25 notes |
| Fresh A / B | 33 / 43 D; 19 / 19 S | 39 / 35 D; 14 / 20 S |

Readings against the counts: all four 04 tensions are gone and none of the five 05 tensions is a
04 item. Three of the five come from P7's "save at most one aggregate" (e87b02c): gapless numbers,
several skus reserved at once, the cart emptied with the order; both Fresh drafts designed around
the same three (§2.1). The 04 Statement/Why disagreements are all gone; the seven new ones are
each a Statement that is narrower than a case its own Why or another rule admits (§2.2), none a
rewrite artifact. Fresh S fell from 19 / 19 to 14 / 20; no S quotes an old id or an absent
document.

## 1. Review 04's checklist, state now

Detail in `checklist.md`. In short:

- Tensions R04-1 to R04-4: not re-found. Trace context on the envelope, batch work on the clock
  (Fresh A sweeps write one notice per item, Fresh B holds messages back), the external writer's
  version (Fresh A D32 a notice and a fetch, Fresh B D16 a version written in Payload's
  transaction), the live answer against the replica.
- Statement/Why R04-5 to R04-8: not re-found.
- Purpose not told R04-9 to R04-11: not re-found. P17's "a status that only shows how far another
  system has got … is no wait" is read as written (Fresh B S18).
- R04-12 product owner: no longer a contradiction between Whys; the split stands, as C4 allows.
  Fresh A catalog our system, Payload keeper; Fresh B and the Implementer Payload. New: P2's "has
  to be asked" makes the fixture's veto a tension (T1, §2.1).
- Readings R04-13, R04-17, R04-19: not re-found. R04-14 the poll: re-found as a Statement/Why
  disagreement (§2.2). R04-15 sandbox, R04-18 runtimes: re-found, unchanged (no change made).
- Splits: R04-20 Store "can carry" re-found (Impl S10). R04-22 "the same for every candidate"
  re-found as purpose-not-told. R04-23 re-found in a new shape, P15 sentence 2 (§2.2). R04-24
  re-found against the new P18 text (Impl S11, Fresh B S16). R04-27 re-found in a new shape (Impl
  N13, §2.4). R04-30 Courier re-found (Fresh A S6, Fresh B S3). The rest not re-found.
- Hygiene R04-31 to R04-33: resolved. No old id, absent document or "Appendix" in the set; no
  reader defined Transaction.
- Fixture R04-34 to R04-40: re-found as expected, the fixture is frozen (Impl N1–N6, N10, N11, N20).
  R04-36 "open order" not raised.
- Choices: §3.

## 2. New in 05

### 2.1 Tensions

**T1, catalog's sku veto makes shop an owner (P2, P3, P10).** P2's Why since d54c665: "A system
that has to be asked before a record is written holds a rule that decides what the record holds,
so the record is that system's." The fixture's `beforeChange` asks shop; the Implementer placed the
hook as shop's driving adapter, so shop's rule decides the sku while catalog's config decides it too
and the table says catalog owns it. Owner is singular. Two ways out, both compliant: drop the veto
(order lines keep a sku snapshot), or move the sku to shop, kept in Payload under P11 sentence 2
(cost: locks or a stale rule on the race, an admin action instead of a field edit). Fresh A avoided
it by owning products in a catalog system whose domain holds the veto; Fresh B has no veto. Issue
21's proposal ("Catalog refuses to change a sku that an open order carries") puts the rule in
catalog and asks a fact of shop, which is the reading T1 did not take: whether asking shop for a
count makes shop the decider is not said.

**T2, gapless invoice numbers (P7, P8, P10).** One aggregate per use case refuses advancing the
series and issuing the invoice in one commit. Implementer and Fresh B (D14): a series aggregate
assigning numbers by message, a draft state the business never had, two hops, a hot row. Fresh A
(D13): `lastNumber + 1` read in the transaction under a unique `(year, seq)` key, saving only the
invoice; the series is no aggregate. P10's third sentence admits the contention either way (Fresh B
S20).

**T3, one order reserving several skus (P7, P10).** Saving a `Stock` per sku breaks P7; saving one
`Reservation` decided on unsaved `Stock` rows breaks P10 sentence 1. Complies by row locks held to
the commit (needs reading Impl S6 of P10) or one message per line. Fresh A (D6, D7): one
`Fulfillment` per order, holds never refused, short stock a backorder; the question does not arise.

**T4, the cart emptied with the order (P7, P10).** The world's own P7 example, "the order placed,
the cart still full", is what the rule produces until a `ClearCart` message is handled. Both Fresh
drafts made the cart a stage of the `Order` (A D5, B D4) to keep placing one save. 3 of 3 met it.

**T5, the PaymentIntent before the Payment record (P17 against P7, P8).** Payment calls Stripe and
then its commit fails: payment holds a tentative operation no aggregate holds a moment for (P17
sentence 2), and PaymentIntents do not lapse by themselves (N8). Complies by committing the
`Payment` with its expiry first, then calling Stripe; P7's one commit then forbids recording the
intent id in the same use case. Fresh A calls payment from inside shop's open transaction, Fresh B
calls Stripe from shop inside its open transaction; neither raises it.

### 2.2 Statement and Why disagree, seven

Each a Statement that reads narrower than a case its Why or another rule admits.

- P4 "at most one acting call per call or message it handles" against the Why's "each item it
  returns … is a message … one acting call per item": one per poll by the Statement, one per item
  by the Why (R04-14 re-found). Fresh A D18 and Fresh B D28 take one acting call writing a message
  per transfer; both forms hold.
- P2's Why ("leaving it behind is no error, so it is no statement of the rule") against P13's MAY:
  if the contract's constraint is no statement, no rule forbids it and the MAY grants nothing.
- P14 "Each message MUST have one schema … that its writer and every reader parse with" against
  the Why: an external writer parses with nothing of this codebase (Impl S8).
- P8 "MUST make the change" against the Why's "records the owner's answer" and P17's refusal as
  the outcome: an executor whose change the 3PL or Stripe refuses (Impl S5).
- P7 "the record of the message it is called for" against P9's "or by the records it writes":
  three readers, three readings (Impl S3 whichever record tells the repeat; Fresh A S12 a
  handled-message record always; Fresh B S6 the claim after the outside call).
- P15 sentence 2 "What else it needs another system to do it MUST ask for by a message" against
  the Why's tentative operation by call (R04-23's new shape; Fresh A S3, S13).
- P11 "only through that open host service or the owner's published events" against the Why's
  data the owner hands over in a command.

### 2.3 Purpose not told, two

- P16 "MUST travel only as an argument, never as an ambient value", in a system that makes no
  in-process call into another: every harm the Why names is a transaction crossing systems.
- P2 "the same for every candidate": a table varying by segment (dunning by customer kind) falls
  outside the letter and inside the harm (R04-22).

### 2.4 Readings

All readers on the same side:

- P17 "it holds something until the answer comes": fulfillment's stock hold is a wait of its own,
  with its own deadline (Fresh A S8, Fresh B S7; the Implementer reserves without a deadline).
- P9 "a key the store refuses twice": the key is per consumer, `(consumer, message_id)` (Fresh A
  S10, Fresh B S9, Fresh A D12).
- P6 Why "a transaction port whose fake commits nothing": the fake still rolls back (Fresh A S11,
  Fresh B S10).
- P11 for the stock field in Payload's admin: stock levels on fulfillment's open host service
  (Fresh A S9, Fresh B D7, D26, Impl S18).
- The revalidate route: Next's cache reached by an internal route that calls no driving port, read
  as the far side of shop's driven adapter (Fresh A D31, Fresh B S19, Impl N7: "the glossary has
  no name for code that is the outside a driven adapter reaches but lives in this repository").
- P1 "every runtime of the language": `Intl` with time zones counted in (Fresh A S5, Fresh B S11,
  Impl S17). R04-18 with a new edge: ECMA-402 and small-ICU builds.

Split or hung, one reader each unless named:

- P10 "data whose change fails no transaction of this store": any read the saved aggregate does not
  cover (Fresh A S4), replicas in the own store (Impl S21).
- P13 "Code of another system" for Payload's configuration importing fulfillment's hook (Impl S18,
  Fresh B S13).
- P5 "a driving adapter's way in, the file the framework finds … which is no export": driving
  export paths for framework files only (Fresh A S7).
- Glossary Driving adapter "as many … as there are ways into the process": one per subscription,
  route, action, hook (Fresh A S14).
- P3 shared kernel "no record's schema": `Money`'s own schema allowed (Fresh B S15); a kernel
  `vatRate(taxClass)` is billing's rule (Impl S7).
- P12 for an adapter's tests importing the upstream's fake (Impl S20).
- P18 "one thing": the thing told of, not the record changed (Impl S11); private messages count
  (Fresh B S16).
- P15's Why reconciliation with Stripe at the deadline: permitted, not expected (Fresh B S8).
- Assumptions' generated published language against P13 sentence 3 "MUST NOT be generated from the
  rest of it": catalog's `payload-types.ts` is generated from the whole configuration (Impl N13).

### 2.5 Text hygiene

- P5's leaked Glossary notes (above).
- Words used and not in the glossary (Impl N15): envelope, export path, dead-letter queue, sweep,
  candidate, thing, part, step, contract, way in, pending, veto, executor, notice, claim, register,
  integration suite, deploy, image.
- An `Outbox` port typed by an upstream's command types puts the upstream's terms into the service
  (Impl N25, the Implementer's own slip, caught by P12). P12's Why says the outbox adapter
  translates; the P2/P13 talk of "shop's `ReserveStock`, declared in shop's published language"
  reads at first as the service building them.

### 2.6 Fixture lines

As in 04, the frozen fixture's mechanism lines are read as situations and built otherwise (Impl
N1–N4, N6). New beyond issue 21: short stock at `OrderPlaced` unsaid (N9); a shipping address
nowhere (N19); the 3PL's article master holds fields fulfillment decides (N10).

## 3. The Fresh drafts and the Implementer against `choices.md`

| | Impl | Fresh A | Fresh B | 04 Impl / A / B |
| --- | --- | --- | --- | --- |
| systems of ours | shop, payment, billing, fulfillment, backoffice | catalog, shop, payment, billing, fulfillment | shop, billing, fulfillment | 5 / 5 / 4 |
| product owner | Payload, config rules | catalog, veto hook | Payload, config rules | Payload / catalog / Payload |
| card payments | own system | own system | inside shop | own / own / own |
| dunning at checkout | replica | replica | replica | replica ×3 |
| stock at checkout | reserve on `OrderPlaced` | hold on event, never refused | hold on event, with deadline | reserve on event ×3 |
| PaymentIntent | after payment's commit | inside shop's open transaction | inside shop's open transaction | before commit ×3 |
| coordination | choreography | orchestration (shop's `Order`) for payment, fulfillment | choreography | choreography ×3 |
| relationships | ACL everywhere; kernel Money, Sku | ACL everywhere; kernel Money | ACL everywhere; kernel Money, own `MoneyV1` per language | ACL ×3 |
| cart | own aggregate, `ClearCart` | stage of `Order` | stage of `Order` | — |
| processes | web, worker | web, worker, migrate | web, worker, migrate | 3 / 3 / 3 |
| dashboard | backoffice replica | per-system slots | per-system pages | backoffice / pages / pages |

Against the entries: C1 anti-corruption 3 of 3 again. C2 now splits: Fresh A orchestrates (04: 3 of
3 choreography). C3 cut three to five. C4 two to one, as 04, the Whys no longer contradicting. C6
messages plus replica 3 of 3, the one live call payment. C7 `migrate` 2 of 3. C8 now splits three
ways: after payment's commit (Impl, forced by T5), inside shop's open transaction (A, B). C9 now
splits: Fresh B keeps card payments in shop. The three entries issue 22 calls fixed by the fixture
(R04-41) now differ where the fixture is not read; the fixture still fixes them for the Implementer.

## 4. What the readers did not need

No reader asked for an old id, a case list or another document. The Implementer built the fixture
with no cannot-comply for the second time, wrote 53 ok examples and caught its own P12 slip with
the rules (N25). Both Fresh drafts' D lists are almost all mechanism and business numbers (bus,
clock, lint, test tooling, deadlines, dunning ladder); the rules leave those, as meant.

## 5. Candidate issues

A grouping, not a decision.

- A. One aggregate per use case (T2, T3, T4): three tensions and two Fresh designs bent around it.
  A Why case for each (counter by key, per-order hold, cart as a stage or a stale rule), or a
  narrower Statement.
- B. Statements narrower than their Whys (§2.2): P4 poll, P8 refused change, P14 external writers,
  P15 tentative call, P11 handed-over data, P7/P9 the record told by. P2's Why against P13's MAY.
- C. T1: whether asking a system for a fact makes it the decider, in P2's Why; then the fixture's
  veto per issue 21.
- D. T5: the tentative operation and the aggregate that holds its moment, P8 with P17; Stripe's
  intents need a lapse of this codebase's.
- E. Hygiene: the distill leak (the blank line in P5's Glossary notes, l.568; or make the script
  drop to the next field marker); words not in the glossary (N15); generated published language
  against P13 sentence 3 (N13).
- F. Purpose: P16's ambient ban inside a system with no in-process upstream; P2 "the same for every
  candidate".
- G. `choices.md`: C2, C8, C9 now differ (§3), which answers R04-41.
- H. Readings 2 or 3 of 3 (§2.4): stock hold as a wait, per-consumer key, rollback in the fake, the
  revalidate route as no layer. Fold the ones meant into Whys.
