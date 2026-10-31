# Review 03: the same 14 readers, after spec 02 steps 1 to 5

Ran at `4d6ac11`, mid-spec: issues 12, 13, 14 closed; 15 to 19 open. Same suite as review 02
(`ccfa1e9`): seven reader kinds, raw set and distilled set, all 14 in parallel, Opus. Raw set:
`glossary.md`, `the-world.md`, `general-rules.md`, `domain.md`, `examples/` (165 files, 70 ok).
Distilled set: `distilled.md` (781 lines, 73 rules), `domain.md`, the 29 example files it names (30
references; `tx-28-ok-after-change…` twice, as TX-28's ok and TX-29's breach). Fresh repo and Red
team: the two world documents, or `distilled-world.md`, plus `brief.md`, rebuilt from the fixture's
capabilities and technologies. Every example path resolved in every reader; no missing-path notes.

What changed between the two runs: 67 → 73 rules (DOM-7, SYS-15, TX-36 to TX-39), 18 → 19
properties (P19), headings of P1, P3, P5, P6, P9, P11, P15 rewritten, glossary gains Pure, Offer,
Settle, Reach, lists become reach statements, Whys moved into Scopes and Statements. Examples: 5
files touched; 60 of 73 rules still show `*Examples:* —`.

| reader | 02 raw | 03 raw | 02 dist | 03 dist |
| --- | --- | --- | --- | --- |
| Implementer | 0 cannot-comply; 26 of 70 ok files flagged; 6 Relies-on | 1 cannot-comply; 46 of 70 flagged; 2 Relies-on; 18 new ok | 2 cannot-comply; 2 of 14 flagged | 3 cannot-comply, 1 tension; 14 of 16 flagged; 12 purpose-not-told |
| Gap | 7 gaps; 5 Relies-on | 10 gaps; 8 Relies-on; 25 rejected | 8 gaps | 12 gaps; 26 rejected |
| Contradiction | 0 of 20; 8 Relies-on | 0 of 42; 9 Relies-on | 0 of 20 | 0 of 38 |
| Adversarial | 26 | 35; 37 Why findings; 18 Relies-on | 14; 9 purpose-not-told | 36; ~45 purpose-not-told |
| Fresh A / B | 39 / 34 D; 19 / 17 S | 43 / 36 D; 30 / 27 S | 37 / 30 D; 17 / 15 S | 35 / 34 D; 17 / 19 S |
| Red team | 5 of 5 hold | 13 of 14 hold | 3 of 6 hold | 9 of 13 hold |

More findings everywhere. Part is the readers reading harder (42 contradiction candidates against
20), part is new rules with new edges (TX-36, TX-37, TX-38 account for a third of the new
adversarial and gap findings), part is the examples not yet rewritten against the changed rules.

## 1. Review 02's findings, one by one

§ numbers are review 02's SUMMARY.

### §1 found by several readers

1. **No rule places a business rule.** Closed by DOM-7 for the plain case: the VAT rate in a service
   is now a DOM-7 breach, no reader found it. Three new edges around it: (a) a rule *between*
   systems, "no pay-by-invoice to a dunned customer", reads billing's state and gates shop's use
   case, and no rule says whose domain holds it (dist Gap, raw Gap N13 on the sku veto, raw Contr
   N14); DOM-7's Why rules on the sku veto ("stays here") against `tx-28-ok-before-change…`, which
   puts it in catalog's config (4 readers). (b) DOM-7 against ASM-2: the number in a rule, the
   deadline's minutes or a dunning grace period, arrives as a "configuration value" and differs per
   process; "configuration value" is undefined (both Adversarials, dist Gap N11). (c) DOM-7 and the
   shared kernel: "the domain" includes a kernel imported into it, so one system's rules move into
   the kernel and nothing bounds what a kernel holds (raw Adv, both Red teams).
2. **DRV-8's list.** Closed: the list now names the upstream's published language, and the Stripe
   SDK in a hook was rejected as a contradiction candidate (dist Contr c14). Replaced by a bigger
   one, §2.1 below: under the glossary's Reach ("however the code got hold of it") and Port ("never
   the code behind it"), calling a port reaches the implementation behind it, which no list names.
3. **Relies-on lines on DRV-7's positive half.** Not re-found. DRV-7's "succeeded" is still
   undefined (raw Adv W10, `drv-7-breach-use-case-commits-after-returning`).
4. **SVC-2 → DRV-8 "reaches through driving ports".** Still open, all four raw readers again, now as
   "DRV-8 does not exclude the service": calling the driving port reaches the service behind it
   (raw Impl, raw Gap R8, raw Contr N1, raw Adv R1). SVC-4's line too.
5. **TX-6 lines drop "it makes".** Still open (raw Gap R3, raw Contr R4). TX-6's Scope is a message
   about a change the use case makes; TX-3's, TX-15's and TX-22's messages ask for one.
6. **A SHOULD stated as given.** TST-6 → TST-4 still (raw Adv R11, raw Contr R7). TX-22 → TX-31 not
   re-found; in its place TX-37 → TX-31 drops TX-31's Scope condition "that takes an idempotency
   key" (raw Impl, raw Gap R4, raw Contr R5, raw Adv R7).
7. **A decision by a live read of another system.** Still open, every Gap and Implementer: TX-24
   covers own stored data, TX-27 a replica, nothing a live open host service answer (raw Gap, dist
   Gap, raw Impl N15, dist Contr N22). All four Fresh drafts built the dunning check on a replica,
   where in 02 three of four called billing live.
8. **TX-5 and a provider without a key.** Still open and sharper. TX-37 now forbids the handler to
   decide by its records, so `handled.claim` before the send is a TX-37 breach; without it the mail
   goes twice. Whether "the records" in Idempotent includes the provider's is undefined (dist Impl
   cannot-comply `tx-37-breach-order-confirmation-mail-without-key`, raw Gap
   `gap-outside-effect-repeats-unaccepted`, dist Contr N4, raw Gap R1).
9. **The `client_secret`.** Still open, changed shape. TX-36 (MAY) was added; the dist Implementer
   still reports cannot-comply: an unconfirmed PaymentIntent "holds nothing", so it is no tentative
   operation by the glossary, and TX-3 and TX-22 both demand the outbox. The raw Adversarial adds
   that TX-3's and TX-22's carve-outs sit only in their Whys and a MAY cannot lift a MUST by any
   stated rule (W28); TX-36's Relies-on line on TX-30 claims a rule that never binds a system that
   stores nothing (R8). The examples use a Checkout Session where the fixture says PaymentIntent
   (dist Impl N4, N9).
10. **Probes.** Closed by the glossary's Probe and the Assumptions: both Gaps rejected it. Residual:
    no rule says how a probe gets the pool assembly built, and `gap-health-and-metrics-endpoints`
    cites a retired id (raw Impl N4, dist Impl N16, raw Gap N6).
11. **Catalog's config reading fulfillment's stock table.** Still open, both Gaps. The Assumptions
    name two config parts inside the rules (SYS-12, TX-29) and a read is neither. The dist Gap and
    both Implementers read it as a closed list.
12. **Instrumentation before assembly.** Closed: both Gaps rejected it, no property bears.
13. **The admin dashboard.** Mostly closed: SYS-9's new Scope ("code outside a system reaches it")
    covers it (raw Adv N14, raw Gap N6), the dist Gap rejected it, both Implementers built a
    `backoffice` system over replicas. The gap example file cites retired ids SYS-3, SYS-5, SYS-7,
    TX-13 and SYS-9's old Scope.
14. **ASM-2 vs DRV-3 on the Payload cycle.** Closed: both Contradiction readers rejected it (raw c15,
    dist c16). The dist Implementer notes the cycle breaks without a courier when hooks needing no
    Payload are built first (N17).
15. **ASM-7's MAY.** Still open: no MAY names the rule it lifts. ASM-7 was read as lifting ASM-2 and
    SVC-7 (dist Contr N2, dist Adv N1), TX-36 as lifting TX-22 and TX-3 (dist Contr N1, dist Adv
    N2). Both lines in ASM-7's Relies on quote MUSTs its own Statement contradicts, and no text
    states precedence between a MAY and a MUST (raw Adv R16).

### §2 what the distilled loses

1. **MAY rules lose their target.** Open, as §1.15.
2. **Tentative operations only in Whys.** Open, as §1.9. TX-36 exists; the carve-out is still argued
   in TX-3's and TX-22's Whys, not their Scopes (raw Adv W28).
3. **P5's Why refuses what its heading admits.** The sentence moved into P11's heading ("or reads
   them except through its published language"). Both Red teams still hold the shared-schema
   design: "published language" names a vocabulary, not a channel, so a table whose schema the
   owner declares published, a SQL view in published shape, or a CDC stream passes (raw B, dist
   D2b, D2c). Four property Whys still rule where the heading does not: P6 (fake fidelity), P9
   (an outside effect repeats only by a business rule), P5 (a registry), P10 ("with what happens
   meanwhile") (raw Adv W34 to W37).
4. **Rules whose purpose the text does not tell.** Longer, not shorter: the dist Adversarial lists
   about 45 of 73 rules, the dist Implementer 12 (DRV-1, SVC-3, TX-37, TX-24, ASM-10, SYS-10,
   SYS-15, TX-39, DOM-4, TST-8, ASM-4, TX-28's carve-out). Both name the rules whose Scope does say:
   DOM-3, DOM-7, SVC-7, ASM-3, TX-1, TX-2, TX-5 to TX-7, TX-12, TX-19, TX-20, TX-21, TX-23, TX-24,
   TX-27, TX-30, TX-32, TX-35, SYS-2, SYS-12, TST-4, TST-6. Properties no rule protects outright:
   P19 (dist Adv `tx-5-breach-order-paid-means-two-things`, raw Gap N17), P3 (raw Gap N17, dist Gap
   N17), P15 except through TX-30 under one reading of "answer" (both Gaps).
5. **`*Examples:* —`.** 60 of 73 now. Issue 19.

### §3 adversarial findings both sets made in 02

Still found by both: SVC-7 generic `Sql` port (no Statement asks a driven port for the system's
terms, raw Adv W3, N4); SVC-3 sibling service behind a driven port; TX-30 and TX-35 satisfied by
any rule, "wait another hour, forever"; TX-23 upsert never loaded, plus a failed save swallowed
(raw); TX-17 and SYS-13 command dressed as an event; TX-28 handler acting before Payload commits.
Changed shape: TX-7's optional-field finding became "a field's meaning changes with the schema
unchanged", so TX-7's Scope never opens (both), and records are outside TX-7 entirely (both Gaps,
raw Adv). DOM-1 and SYS-14 ambient reads: closed for globals, since Reach covers "however the code
got hold of it" (dist Adv held SVC-6 and SYS-9 on it); replaced by type-only imports, which reach
nothing at runtime, so every reach-list rule (DOM-1, SVC-1, SVC-6, DRV-8, DVN-4, SYS-2, SYS-10,
SYS-14) is blind to `import type` (both Adversarials, raw Impl, raw Contr). `dom-1-breach-order-type-from-drizzle-table`
becomes ok by adding one keyword.

Existing adversarial examples the raw Adversarial checked: now refused by the text, `svc-4-breach-second-repository`,
`drv-6-breach-memoized`, `tx-12-breach-query-port`, `dom-4-breach-copies-whole-document` (by the
glossary's Snapshot), `tst-4-breach-fake-mailer-calls-sandbox` (by Fake); still not refused,
`svc-2-breach-loaded-order-passed-through-port`, `svc-3-breach-clear-cart-behind-driven-port`,
`asm-1-breach-one-assembly-run-twice`, `asm-8-breach-courier-filled-with-lazy-factory`,
`sys-1-breach-builder-returns-repositories`.

### §4 Relies-on lines

Still open: R1 SVC-2 → DRV-8 (4 readers), R2 SVC-4 → DRV-8, R4 TX-6 "it makes" (2), R5 TST-6 → TST-4
(2), R7 TX-19 → TX-32 for external publishers (raw Gap R2, raw Contr R6). Not re-found: R3 DRV-7's
positive half, R6 SVC-4 → TX-2, R8 SYS-10 → SVC-1, the missing SYS-10 → SYS-14 line. New, §3.4 below.

### §5 examples

46 of 70 ok files fail a check (raw Impl), 14 of 16 named ones (dist Impl); 26 in 02. The 02
flags stand (TX-1 loads before the transaction, `new Date()` in driving adapters, SYS-2 published
language in the domain, SYS-1 exporting adapters). New flags come from the changed rules, §4 below.

### §6 the world

Red team: raw 13 of 14 designs hold (02: 5 of 5), dist 9 of 13 (02: 3 of 6). Of 02's proposals,
P19 landed and is met by prefixing (`CatalogProduct`, `StockItem`) in both sets; P15's "needs
another system's answer now" landed in the heading and is now the loophole both sets walk
through, since any rule saying "current" qualifies; P11's read clause landed and leaks as §2.3.
P20/P21 (no reading another's records) is proposed again in both. Fresh repo: 02's four drafts
converged on five systems and live dunning calls; 03's four range from three to five systems and
all four use a replica for dunning and a synchronous tentative stock hold at checkout, §5 below.

### §7 fixture

Still hung on: the ambient transaction wording (every Implementer and Adversarial read it as a
situation); the 3PL's idempotency key, which `tx-22-breach-claim-rolled-back…` denies and
`tx-31-*` assert (raw Contr N17, raw Impl N13); the bank, polled or hook (both Gaps, split);
"issues a credit note for each refund" against step 7 (raw Impl N10, dist Impl N15); PaymentIntent
against the examples' Checkout Session (dist Impl N4); "open order" undefined (raw Impl N9, raw Adv
N2); no owner of the customer (raw Gap N15, dist Gap N13, raw Impl N24); `PaymentFailed` terminal
or not (raw Impl N11, dist Impl N8); stock below zero (raw Impl N18, dist Impl N15).

## 2. New since 02

### 2.1 Reach and Port, the one cannot-comply of the raw set

Glossary Reach: "what running it reads or calls, however the code got hold of it". Port: "an
interface, never the code behind it". Then `orders.save(order, tx)` reaches the Drizzle adapter's
`save`, which SVC-6's list does not name; the route calling its driving port reaches the service,
which DRV-8's list does not name. SVC-4 makes the repository call a MUST, so no writing service
satisfies SVC-6 (raw Impl finding `svc-6-breach-service-reaches-repository-behind-port`; raw Contr
N1 lists the same as a single rule with no satisfying code, and notes that if "narrower governs"
displaces the wider rule wholesale, SVC-6 never governs a service that writes, where its two breach
examples cite it). Both readers name the fix: Reach is non-transitive, or the lists say "a port
and what assembly hands for it". The other readers assumed non-transitive Reach silently (raw Gap
N1, dist Contr N17).

### 2.2 TX-37 and TX-38 against P17, P9 and the handler pattern

TX-37 ("MUST make the change, deciding nothing again by the state of its records"):

- forbids the `handled.claim` every handler example uses before an outside effect (dist Impl
  cannot-comply, dist Impl purpose list, raw Gap gap 7);
- cannot be met when the external system refuses: Stripe refuses a disputed refund, the 3PL an
  unregistered sku (raw Contr N3, c8, c10; dist Contr c1);
- sends a reminder to a customer who paid meanwhile, since the cleared stage may not be looked at
  (dist Adv `tx-37-breach-reminder-mailed-after-payment`);
- `tx-28-ok-after-change…`'s handler decides by shop's `givesUpWaiting` rule, a TX-37 breach (5
  readers).

TX-38 ("MUST fail, committing nothing") with TX-21 ("deliver again until acknowledged") and DRV-7:
an outside refusal for good redelivers forever, P17 unreachable, dead-lettering forbidden (both
Adversarials, both Contradictions, dist Gap N8). TX-21's Statement arguably refuses the parking its
own Why permits (raw Adv W17).

### 2.3 Gaps new in 03

Both sets: a record's meaning changes across a rolling deploy, TX-7 covers messages only
(`gap-record-schema-change-across-deploy`, `gap-record-meaning-changes-across-deploy`); polled bank
transfers are no delivered message, so TX-5, TX-19, TX-35, TX-38 do not hold and a transfer reported
twice is recorded twice (both); an unmatched transfer is left to no rule, TX-35 needs an event that
tells (both). Raw only: an aggregate holding another system's document untranslated, DOM-4 "of the
same system" (also dist, as `gap-aggregate-holds-other-systems-id`); the sku veto racing checkout,
each side deciding on the other's data in its own transaction; a pay-by-invoice order waits on
`InvoicePaid` having asked nothing, so TX-30's "answer" misses it; `ProductChanged`, written by an
external system's config, has no declaring home and each reader restates its schema; `OrderPaid`
meaning two things inside billing, P19 carried by no rule. Dist only: a message reaching a bus whose
process has no handler yet, TX-21 holds only once delivered to a handler; a tentative call unkeyed,
TX-31 binds messages only, TX-36 says nothing of keys; a 3PL webhook without an id is no message by
the glossary, so no message rule reaches it; fulfillment backorders and tells no one.

### 2.4 Adversarial, new in 03

Besides §2.1, §2.2 and the type-only imports: ASM-2 binds the factory, not the functions it returns,
so an adapter method reads `process.env` per call (raw); ASM-3 stops at services and driven adapters,
so a handler takes the locale from baggage, and a service reads ambient values through a
common-library helper without "reading" them itself (both); ASM-5's relay lists outbox tables by
name through a handed pool (raw), or the dashboard lives in the common library (dist); ASM-6 read
literally lets a TS type through (raw); ASM-7's MAY lets a driving adapter mail after the commit
through a ready-made mailer, P8 (dist); ASM-9's transaction is an argument but the connection is
ambient (raw); TX-2 "its store" lets a repository write a second store or a Redis stream (both);
TX-12's "from its published events" is met by reading the owner's outbox table (both) and lets a
synchronous read on every checkout through, P15 (dist); TX-20's cursor relay skips a late commit so
TX-20 never binds it (both); TX-24 as a SHOULD deviates with no business rule, P10 (both); TX-25
takes an id or returns a function of a transaction (both); TX-26's replica lets shop re-derive
billing's rule (dist); TX-31's key is the same across split shipments (dist); TX-5 check-then-insert
is idempotent sequentially and double-invoices under F5 (dist); SVC-1 never opens for a service
typed as the adapter's return type (both); SYS-2 `Pick<Order, …>` reaches nothing (both); SYS-10's
port type inferred from the service (dist); SYS-12 "MUST NOT change" leaves create and delete free
(raw); TST-6's flag never set, nothing says when the real run runs (raw).

Raw Why findings (37): 18 breaches only the Why refuses (W1 to W18, the §2.2 and §1.9 cases among
them); 15 Whys that rule, DOM-7's sku-veto placement, DOM-3's published-language exemption, DRV-1's
three rulings, TX-19's "keeps the higher", SYS-12 reassigning ownership, TST-6's suite placement
(W19 to W33); the four property Whys of §1 §2.3.

### 2.5 Relies-on, new in 03

TX-37 → TX-31 drops the key condition (4 readers). TX-36 → TX-30 claims a rule that never binds a
system holding nothing (raw Adv R8). SVC-2 → SYS-1 claims "exports no service" where builders return
services (raw Adv R2, raw Contr R3). SYS-2 → SVC-6 and SYS-15 → SYS-1 read a positive out of a
restriction (raw Adv R9, R10). SVC-6 → SYS-1 and DOM-1 → SYS-10/SYS-14 lean on rules that bind only
this codebase's systems while the relying rule admits external upstreams (raw Gap R5, R6; raw Contr
R2). TX-1 → DRV-1 "a message included" where DRV-1 is per call, batches (raw Adv R4, raw Contr R8).
Five rules → TX-5 "changes nothing" where Idempotent says "as performing it once left them" and
binds the use case, not the delivery (raw Adv R6, raw Gap R1). SVC-6 → ASM-2 drops "needs" and
ASM-7 lifts it unsaid (raw Adv R14, raw Contr R1). ASM-9 → TX-25 for Payload's `req.transactionID`
(raw Contr R9). Lines never used: SVC-1 → SYS-10, SVC-4 → TX-3 (raw Adv R17). Leans without a line:
TX-1's Provenance on ASM-9; SVC-6, DRV-8, DVN-4, ASM-7 Whys on ASM-6; TX-3 and TX-22 on TX-36;
TX-23 on TX-21 and DRV-7; TX-30 on TX-21 (raw Adv R18). The raw Implementer checked every other line
its build touched and lists them as holding.

### 2.6 Contradictions: none, 80 candidates

Closest calls, both sets: TX-37 × TX-34 (× SVC-2) on a disputed refund, which escapes only because
TX-34's Scope is conditional and the command can be read as asking for payment's Refund record, not
Stripe's; TX-1 × TX-25 under the glossary's Store, which makes the one Postgres one store so shop's
transaction reaches billing's read (raw c4, c5; raw Gap N11 calls this a conflict); TX-28 × TX-22 on
revalidation from a pre-commit hook, which the dist Implementer reports as cannot-comply once TX-29
is deviated from (its Scope fails on another database adapter). Single rules with no satisfying
code under a strict reading: TX-19 for the last unit of stock and gapless numbers (both), TX-5 with
no key (both), TST-5 for Stripe, the 3PL and the bank, whose "real thing set up as production" is a
live account (both), SVC-7 for a driving adapter reading its own request (raw N2), TX-37 on refusal
(raw N3).

## 3. The world

### Red team

Raw, 13 of 14 hold: distributed monolith (P15's exception self-certifying, P10 pushes to live
reads), shared schema (P11 "published language" as terms; P16 "spans" as writes), one system
(P19 by renaming), one shared kernel (every system is owner, "other" in P11 empty), entity services
(P11 "changes" as "decides"), pinball (nothing tells it from choreography), ambient registry (P5
"hands" met by registering), vendor-shaped domain (Drizzle declared an upstream, P1's Except),
model in the common library (not outside, not another's model), tooling side door, global
serialization (waiting is not failing), commands as events, unversioned open host service with
lockstep deploys. Lying fakes fail P4. Fourteen fixes proposed: P15 Except bounding "now" to a
commitment; P11 as channel; P13 covering the store and deploys; P3 "imports nothing that changes
for another reason"; P20 on shared code; P11 binding tooling and any code; P21 a sequence has one
home; P5 "as arguments, or by courier in a driving adapter"; P1's Except excluding store, framework
and runtime; Outside including tooling; P22 "asked in its own published language"; P14 covering a
published language's answers; F10 on divided work.

Dist, 9 of 13 hold: the same first eight plus rules in vendor configuration (the glossary allows it
and F9 exempts it from every property). Fail: rules in the common library (P2), leaky private events
(P13, once frozen holds), one transaction across two in-process systems (P16), rules as swappable
adapters (P2, P4). Proposals overlap the raw set's: P20 no cycles, P15 bounded to a commitment, P9
covering a retried acting call, P11 as channel plus "published language speaks the system's
terms", P19 "a word the business uses in two senses is two systems' word", P21 one aggregate per
transaction, P3 naming the unit, P22 a system keeps what its rules decide (Owner: one decider, it
keeps), P2 "the domain of the system that owns what it decides", P23 sequence has a home, P24 no
ports from ambient values, P25 rules this codebase writes live in the repository, F10 to F12.

Agreed by both: P15's exception, P11's wording, P19 by prefixing, P3's unit, the shared kernel
unbounded, P5 "hands", the vendor upstream, the external-config rule against P2 (raw Notes calls it
a contradiction between the glossary and P2). Words both hinged on: own/keeps, upstream under mutual
dependence, outside (common library, tooling, store), through, hands, apart, spans, "a business
rule" with no granularity, "needs now". The dist Red team notes the distilled names
`general-rules.md` as a source and holds no rules, so about 19 glossary terms are used by no
property and some designs fail only through a definition acting as a rule.

### Fresh repo, four drafts

| | raw A | raw B | dist A | dist B |
| --- | --- | --- | --- | --- |
| systems of ours | sales, billing, fulfillment | ordering, billing, fulfilment | ordering, payments, billing, fulfilment | sales, payments, billing, warehouse |
| card payments | inside sales | inside billing | payments | payments |
| Payload | external, rules in config | external, rules in config | external, rules in config | external, rules in config |
| dunning at checkout | replica | replica | replica | replica |
| stock at checkout | synchronous tentative hold | synchronous tentative hold | synchronous tentative operation | synchronous tentative hold |
| PaymentIntent | after commit | before commit, tentative | after commit, resume endpoint | before commit, tentative |
| coordination | orchestration, Order | orchestration, Order | choreography | orchestration toward warehouse and payments, choreography toward billing |
| relationships | ACL everywhere, no shared kernel | conformist to billing and fulfilment; kernel Money, Sku, TaxClass | ACL everywhere; kernel Money | ACL everywhere; kernel Money |
| processes | web, worker | web, worker, migrate | web, api, worker, migrate | web, api, worker, migrate |
| stores | schema + role per system | schema + role per system | schema + role + pool per system | schema + role + pool per system |
| dashboard | per-system ops pages | admin views as hooks | Payload components calling api | ops pages calling answering ports |

Against 02: no draft calls billing live any more (02: three of four did), every draft holds stock
synchronously before committing (02: reserve on `OrderPlaced`), the system count no longer
converges (02: five, four times), and two drafts fold payments into another system. The property
Whys were not needed in either set.

Against `choices.md`: C1 (conformist or ACL) split three to one, open and confirmed. C2 (choreography
or orchestration) split, open and confirmed. C3 (the cut) ranges three to five, open. C4 (external
record's owner) all four pick the external system with rules in its config, so every draft read the
glossary's External system sentence over P2 (S-lists, 4 of 4); the dist Red team's D9 shows the
same reading admits every rule into vendor configuration. C5 (relay marks) three of four mark on
Payload's rows with Payload's role. C6 (live call or messages) all four chose messages plus a
replica for billing and a synchronous call for the stock hold, each calling the hold a rule that
"needs the answer now". C7 (migration) all four a `migrate` job as tooling. Two divergences no
entry covers: PaymentIntent before or after the commit (2 to 2, both sides hold P8 by reading the
intent as tentative or by creating it after); card payments as their own system or not (2 to 2).

Sentences three or more drafts picked a reading for, same pick each: Store "can carry" as
configured by roles, so one instance is four stores (4 of 4; 02's drafts read it as "do"); External
system's configuration holds rules against P2 (4 of 4, config wins); the outbox reader of an
external system's outbox is assembly's, for an outbox this codebase configures (4 of 4); Offer's
"fakes of those ports" as open host service ports only (4 of 4); "as many driving adapters as ways
in" per entry, not per transport (4 of 4); Hook includes Payload-rendered components (4 of 4);
Pure's "loads on every runtime" as every JavaScript runtime (3); Pure's "hands nothing" bans clock
and randomness from the domain (3); P9 "delivery" includes hook calls (3); P15 "needs now" met by
the stock hold (4); P8 lets a tentative operation precede the commit (3); the process manager is
the Order aggregate itself (3); P17 and operator queues (3, split: raw A and dist A report P17 not
holding for parked deliveries); P10 waiting is not failing (3); P5's Except restricts to
behaviour-free common code (3); P11 and the relay reading outbox rows (2).

## 4. Examples, regressions from the rule changes

Files that passed in 02 and fail now because a rule changed (raw Impl, raw Contr N16, dist Impl):

- SYS-1 "of its offer": `sys-1-ok` exports `PlaceOrder`, `Checkout`, `OrderDetails` no other system
  calls; `svc-1-ok`, `sys-10-ok`, `asm-4-ok` export ports only shop's adapters reach; `drv-3-ok`,
  `drv-6-ok` export the courier key; `sys-12-ok` exports `ChangePriceButton` (3 readers).
- DOM-1 with Pure: `randomUUID()` in shop's domain, `tx-17-ok`, `tx-22-ok-order-confirmation`
  (4 readers); `dom-1-breach-order-id-from-node-crypto` recommends `globalThis.crypto`, which is no
  better.
- ASM-2 "needs" read as "receives": `asm-1-ok`, `asm-7-ok` (`fetch` default), `tst-8-ok`
  (`createStripeGateway({ secretKey })`), `asm-2-ok-assembly-hands`, `asm-8-ok` build clients inside.
- SYS-9 with the courier and builders: assembly imports `createPayloadCatalog` and holds
  fulfillment's repositories (`asm-2-ok-*`, `asm-8-ok`).
- DOM-7: `tx-12-ok` decides who may see an order in the service; `sys-14-ok` restates `quantity`
  positive in the published schema; `tx-28-ok-before-change` places the sku veto where DOM-7's Why
  says not to; `tx-30-ok` restates `isOverdue` in SQL.
- TX-37: `tx-28-ok-after-change` decides by `givesUpWaiting` (5 readers); TX-28: the same file's use
  case records a private message, which the glossary's Tentative operation does not cover (4
  readers); it is also listed as TX-29's breach, a SHOULD (dist Adv N15).
- TX-1 "each call into its store, reads included": `asm-9-ok`, `svc-3-ok`, `svc-4-ok` list TX-1 and
  load before it; `svc-2-ok`, `asm-3-ok-hook`, `tx-30-ok` too (every reader).
- SVC-4 partial write: `tx-31-ok` and `tx-31-breach` `recordBooking` (3 readers); `tx-1-ok-place-order`,
  `asm-9-ok`, `tx-22-ok-order-confirmation` `carts.clear`.
- SVC-6 "upstream it conforms to": `tx-35-ok` imports payment's published language with no stated
  conformity (3 readers).
- DOM-4 "of the same system": all three `dom-4-*` files are about catalog's or payment's aggregates,
  outside the Scope (3 readers).
- Fixture: five files give shop catalog's price or sku; `OrderPlaced` lacks payment method and tax
  class in `sys-2-ok`, `sys-14-ok`, `tx-17-ok`; `tx-1-ok-one-invoice` issues a second invoice on step
  6's `OrderPaid`; `svc-7-ok-payment` returns Stripe's `clientSecret` through payment's port and
  acknowledges event types it does not handle.

Unchanged from 02: `new Date()` in driving adapters (`drv-1-ok`, `drv-3-ok`, `drv-6-ok`,
`asm-3-ok-hook`), SYS-2 published schemas in `domain/messages` (`tx-17-ok`, `tx-7-ok`, `dom-1-ok`),
`tx-6-ok` TX-19, `sys-13-ok` TX-5 and the `client_secret`, `tx-33-ok` never acks, Money's shape
differs (`amount` vs `cents`). The two `gap-*` files cite retired ids.

## 5. Undefined words the readers hung on

New or sharper: "configuration value" (ASM-2, ASM-10, against DOM-7); "decide" (SVC-2, TX-22, TX-24,
TX-30, TX-37); "governs" and "narrower" across Scopes with different subjects; "a port of its system"
with Reach and Port; "relies on" (TX-15, defined in its Why); "succeeded" (DRV-7, TX-38); "answer"
(TX-30, synchronous or not); "acknowledge" against the glossary's Settle, which no rule uses;
"conforms" with no rule saying how conformity is declared; "of this codebase" for catalog; "schema"
(DOM-3, ASM-6, a validator or a type); "this system" in TX-28 for a page cache; "the records" in
Idempotent; "delivered" for polled data; "output" in ASM-7 and P5's Except for side effects;
"open order" in the fixture. From 02, still: "the same result" (TX-19), "acting call" (DRV-1).

## 6. Candidate issues

A grouping, not a decision. Where an open issue already holds the item, it is named.

- A. Reach and Port: transitive or not; lists say "a port and what assembly hands for it" (§2.1).
  Also type-only imports against every reach list.
- B. TX-37 and TX-38 against P17, P9 and the claim pattern; TX-21 against dead-lettering (§2.2).
- C. MAY against MUST: precedence stated once, each MAY names what it lifts; TX-3's and TX-22's
  carve-outs into their Scopes; the glossary's Tentative operation against an unconfirmed
  PaymentIntent (§1.9, §1.15). Issue 15 or 17.
- D. Rules between systems and the edges of DOM-7: whose domain, configuration values, the shared
  kernel (§1.1). Issue 15.
- E. Gaps of §2.3, with §1.7, §1.8, §1.11. Issue 15.
- F. Relies-on: §1 items 4 to 6, §2.5. Issue 16 (its listed items 3, 6, 8 were not re-found).
- G. The world: P15's exception, P11's wording, P19's renaming, P3's unit, shared code bounded, P5
  "hands", vendor upstreams, external configuration against P2, the four property Whys that rule
  (§3). Beyond issue 12.
- H. Examples: §4 on top of issue 19's list; the two gap files; the double reference under TX-29.
- I. Fixture: §1 §7, plus the customer's owner and stock below zero. Issue 17.
- J. Purpose not told: 45 rules by the dist Adversarial; a property for tests still missing (§2.4).
- K. Choices: C1 to C7 confirmed open; two new candidates, PaymentIntent before or after the commit,
  payments as its own system.
