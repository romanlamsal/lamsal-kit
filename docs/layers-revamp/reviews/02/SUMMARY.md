# Review of the current state: 14 readers, two sets

Raw set: `glossary.md`, `the-world.md`, `general-rules.md`, `domain.md`, `examples/`. Distilled
set: `distilled.md` (740 lines, 67 rules), `domain.md`, the example files it names. Fresh repo and
Red team: the two world documents, or `distilled-world.md` (preamble, Glossary, The world). Reader
files sit beside this one.

| reader | raw | distilled |
| --- | --- | --- |
| Implementer | 0 cannot-comply; 70 ok examples checked, 28 flags on 26 files; 6 Relies-on | 2 cannot-comply; 14 ok checked, 2 flags |
| Gap | 7 gaps; 5 Relies-on | 8 gaps |
| Contradiction | 0 pairs, 20 rejected; 8 Relies-on | 0 pairs, 20 rejected |
| Adversarial | 26 findings; 8 Relies-on | 14 findings; 9 rules whose purpose the text does not tell |
| Fresh repo A / B | 39 / 34 decisions; 19 / 17 two-way sentences | 37 / 30 decisions; 17 / 15 two-way sentences |
| Red team | 5 of 5 designs hold (2 on P5's heading only) | 3 of 6 hold |

## 1. Found by several readers

Ordered by how many readers hit it independently.

1. **No rule places a business rule.** raw Gap, dist Gap, raw Adv (notes), dist Adv (tx-17, drv-8).
   The VAT rate written in billing's service meets every Scope: DOM-3 covers shapes, SVC-2 places
   the enforcing, TST-3 the test. The glossary's "holds no business rule of its own" and P2 are not
   rules. dist Adv puts the VAT rule in shop's published event (P3 fails) and the dunning rule in a
   server action (P4 fails) with every Statement met.
2. **DRV-8's list has no upstream published language and no external package.** raw Impl N5,
   raw Contr c11/N6, dist Impl, dist Gap, dist Contr. A handler of `OrderPaid` cannot import shop's
   schema; the Stripe hook cannot import `stripe`. DVN-4 lists both. Three ok examples do the
   import anyway (`sys-9-ok`, `tx-1-ok`, `svc-7-ok-payment`). The compliant shapes are a conformist
   re-export through the domain or a schema restated inline, which is TX-7's second statement.
3. **Relies-on lines on DRV-7 claim the ack happens.** All four raw readers. DRV-7 forbids an early
   ack and requires none after success. TX-34's Why needs the positive half ("it has succeeded, and
   the handler acknowledges") to stop redelivery of a refusal. Lines in TX-15, TX-3, TX-22, TX-31,
   TX-35, TX-34, TX-21.
4. **SVC-2's line on DRV-8 claims "reaches its system through driving ports".** All four raw
   readers. DRV-8 rules imports only. The reach is SVC-7's, and SVC-7 says "a port", not a driving
   port: both Adversarials reach a repository from a driving adapter through the courier with every
   Statement met. `svc-7-breach-server-action-raw-sql-through-common-pool` lists DRV-8 as satisfied
   for the same reason.
5. **TX-6 lines in TX-3, TX-15, TX-22 drop "it makes".** raw Impl R4, raw Contr R6, raw Adv. TX-6's
   Scope is a message about a change the use case makes; these messages ask for or delegate one.
   The commit-together guarantee is TX-1's.
6. **A SHOULD stated as given.** All four raw readers. TX-22→TX-31 and TST-6→TST-4 lack the "by
   default" that SVC-2→TX-24 and SVC-4→TST-4 carry.
7. **A decision by a live read of another system has no staleness rule.** raw Gap, dist Gap, raw
   Impl N16. TX-24 covers own stored data, TX-27 a replica. Checkout reading billing's dunning
   stage through its open host service and committing on it falls in neither. Both Implementers
   built it on a replica to stay inside TX-27.
8. **TX-5 and a mail provider without a key.** raw Impl N2, raw Gap, raw Contr c4, dist Contr c6,
   dist Impl. Claim-then-send loses the mail to a crash, which P8 forbids and no rule does;
   send-then-claim doubles it. The glossary's "same result" does not say whether the mail counts.
   The same question for the 3PL and the bank.
9. **The checkout `client_secret`.** dist Impl (both cannot-comply findings), raw Impl N12/N13,
   raw Gap, raw Contr c6/N5, dist Contr c4, dist Gap. See §2.2.
10. **Probes have no way to the store.** raw Gap, dist Gap, raw Impl N19, raw Contr c14. ASM-4
    shuts the courier to anything but a driving adapter, ASM-2 covers factories, not route modules.
    Every reader has `/health` open its own pool, which pings a pool no use case uses.
11. **Catalog's config reading fulfillment's stock table.** raw Gap, dist Gap. The Assumptions name
    two config parts, SYS-12 and TX-29; a read is neither. Both Implementers read fulfillment's
    open host service instead, so the gap is in the Assumptions' list, not in the build.
12. **Instrumentation built before assembly, from the environment.** raw Gap, dist Gap. ASM-1's
    Statement does not reach it. May be the stack document's (dist Gap notes).
13. **The admin dashboard** in no system is a gap (raw Gap). Both Implementers host it in shop over
    replicas (TX-26) and note that if the fixture means the owners' tables, TX-12 is cannot-comply.
14. **ASM-2 vs DRV-3 on the Payload cycle.** The closest call to a contradiction in both sets,
    resolved differently: raw says neither Scope is narrower and the pair hangs on "receive it from
    its caller"; dist says DRV-3 is the narrower and governs.
15. **ASM-7's MAY: how far it reaches.** raw Contr N2: it permits the import, not the call through no
    port, so a service recording spans still breaches SVC-7 if Jaeger is "the outside". dist Contr
    c2 and notes: read with the preamble's "a permission where another rule would forbid", it lifts
    DOM-1's and SYS-14's lists, and `sys-14-breach-money-imports-common-logger` is no breach. §2.1.

## 2. What the distilled loses

The distilled set found the same gaps, no contradiction, and fewer adversarial findings: 14 to 26,
and 10 of its 14 have a raw twin. Five things changed with the Whys and Relies-on gone.

1. **MAY rules lose their target.** README: a MAY "exists where another rule would otherwise
   forbid; its Relies on names that rule". The distiller drops Relies on, so the distilled ASM-7 and
   every other MAY names no rule it excepts, and the preamble's "where another rule would forbid"
   let the dist Contradiction reader extend ASM-7 to DOM-1 and SYS-14. Either a MAY's Statement
   names the rule, or the distiller keeps Relies on for MAYs.
2. **TX-3 and TX-22 exclude tentative operations only in their Whys** (raw Contr N5). The dist
   Implementer therefore reports two cannot-comply findings: payment cannot create the
   PaymentIntent through its outbox and still return the `client_secret` in the same call (TX-22),
   and shop's checkout cannot call payment and stay inside TX-3. The raw readers escape through the
   glossary's "changes nothing it asks for" plus the Why. The Scope should carry it.
3. **P5's Why refuses what its heading admits.** "Another system reading this one's records past
   its ports breaks whenever the store or the records change" sits in P5's Why. The raw Red team's
   shared-schema and vendor-shaped designs hold on the heading and fail on the Why; the distilled
   Red team's shared-schema design holds flat. P1's Why ("Where a store, a framework or a carrier
   shapes the domain") is the same case. Property Whys carry rulings.
4. **Nine rules whose purpose Scope and Statement do not tell** (dist Adv): every TST rule (no
   property or force speaks of tests), SVC-1, ASM-1, ASM-10, ASM-5, ASM-6, DRV-1, DRV-6, SYS-10,
   TX-33. The reader guessed. For TST a property is missing from the world; for the rest the Scope
   could say what it protects.
5. **55 of 67 rules show `*Examples:* —`**, so the distilled names 14 of the 70 ok files on disk,
   and the dist Implementer checked 14 where the raw checked 70. Not the distiller's doing.

Words both sets hung on, undefined: DRV-7's "succeeded" (a return that does not commit?), TX-19's
"the same result" (final state, business outcome, or who got the last unit), "acting call" (DRV-1,
not in the glossary), whether ASM-3 reaches a domain function the service calls, whether a request
id on an outbox row is "what it answers".

## 3. Rule findings per reader

### Gaps (raw 7, dist 8, 5 shared)

Shared: VAT rule placement; live-read staleness; catalog config reads the stock table; `/health`
pool; instrumentation order. Raw only: the order line copies catalog's price, which is no snapshot
by the glossary (copied from an API answer, not an aggregate or a message) and no replica; the admin
dashboard. Dist only: bank transfers applied again on every poll (TX-5 covers delivered messages,
a polled answer is none); an unmatched transfer dropped (TX-35's Scope wants a delivered event);
trace context crossing the outbox (ASM-3 covers the read, TX-7 the schema change, nothing the
crossing). Two dist gaps hold under one reading only: the bank is polled, and OTel's load order is
no library convention.

### Adversarial (raw 26, dist 14)

Found by both sets, so Statement gaps with or without the Why:

- SVC-7: a generic `Sql` port declared in the service layer. "a port of its system" does not say
  the system's terms.
- SVC-3: a driven port whose adapter wraps a sibling service, typed inline; the second transaction
  commits alone (raw: cart cleared, order lost; dist: a gapless number spent).
- DRV-8: a repository reached through the courier with an inline type (raw); the dunning rule
  applied in the server action (dist, P4).
- TX-28: the hook's use case records a private message; its handler acts before Payload commits.
  Whether the message is tentative depends on the handler, outside the Scope.
- TX-7: an optional `paidByInvoice` keeps both directions readable; old handlers ignore it and the
  order is never invoiced (P14).
- TX-30, TX-35: any business rule satisfies: one that abandons without asking Stripe, postpones
  forever, or asks for the refund again forever.
- TX-23: reload and save again after the conflict (raw); upsert of an aggregate never loaded
  (dist, P10).
- DOM-1, SYS-14: ambient reads with no import: `node:crypto`, `process.env`, `Date.now()`,
  `toLocaleUpperCase()`. The lists bound imports; a global is no import.
- TX-17: one event per consumer, no system named (raw); the VAT rate in shop's event (dist, P3).

Raw only, where the Why was needed to see the harm: SVC-6 (Drizzle's transaction type through the
common library in every port signature), SVC-4 (a repository method writes a part, no version),
DRV-1 (an acting call then a failing answering call), DRV-6 (memoized read), DRV-7 (a conflict
committed as a refusal and acked), ASM-3 (the domain reads TZ), ASM-5 (the relay lists outbox
tables by name), TX-2 (a write to a second store), TX-25 (a port takes `Database`; a transaction is
one), TX-22 (book and mark in one attempt), TX-31 (a resent message with a new id, the 3PL books
twice), TX-20/TX-21 (an in-memory bus), TX-33 (billing subscribes to payment's private message:
outside the Scope, the harm happens), SYS-2 (a generator copies the domain enum, no import), TST-5
(`pushSchema` from the adapter's tables), TST-6 (the suite omits the stale save).

Dist only: DOM-3 (a field's meaning changed in place; TX-7's Scope has no records), TX-24 (a
decision by a snapshot inside the saved aggregate), TX-12 (shop reads billing's outbox table as
"published events").

### Contradictions: none

Both sets: 0 pairs of 20 candidates. Worth reading: TX-19 alone may have no code for scarce or
numbered allocation under F5, the last unit or a gapless number (dist); DOM-3 against a published
enum is a contradiction only if a message is a record (both); TX-22's Scope read literally holds for
the handler's own use case too (raw N8).

## 4. Relies-on lines (raw only)

- R1 SVC-2→DRV-8: the reach (4 readers).
- R2 SVC-4→DRV-8 "imports a driving port": permitted, not required (minor).
- R3 DRV-7's positive half, in 7 rules.
- R4 TX-6 "it makes": TX-3, TX-15, TX-22.
- R5 TX-22→TX-31, TST-6→TST-4: SHOULD as given.
- R6 SVC-4→TX-2 "a store" where TX-2 binds "its store" (raw Adv).
- R7 TX-19→TX-32: "one system" and an external system's messages (raw Contr; hangs on the
  glossary's System against the Assumptions).
- R8 SYS-10→SVC-1: "a system's ports" is wider than "declares" (minor).
- A missing line: SYS-10 leans on SYS-14 (raw Adv).

## 5. Examples

Raw Implementer over 70 ok files; dist over 14.

Fail a rule they list (6): `asm-9-ok`, `svc-3-ok`, `svc-4-ok` (TX-1: a load before the
transaction), `asm-2-ok-payload-adapter`, `asm-7-ok` (DVN-4: a sibling module import; raw Impl N6:
DVN-4, DRV-8, SVC-6 name no sibling where DOM-1 and SYS-14 do), `dom-4-ok` (the Scope never holds,
both references cross systems; "sku: shop's own commercial field" contradicts the fixture).

Claim a rule whose Scope the code does not reach (6): `svc-7-ok-order-overview` TX-1 (dist too),
`svc-6-ok-opaque` DOM-1, `sys-14-ok` DOM-1 (dist too), `tx-3-ok` TX-3, `tx-22-ok` TX-22,
`tx-29-ok` TX-22.

Breach a rule they do not list (15 files, plus 1 fixture fact): SVC-7 `new Date()` in server
actions (`drv-1-ok`, `drv-3-ok`, `drv-6-ok`, `asm-3-ok-hook-passes-editor`); TX-1 loads outside
the transaction (`svc-2-ok`; `tx-30-ok`, flagged by 4 readers); DRV-8 upstream import in handlers
(`sys-9-ok`, `tx-1-ok`); SYS-2 published language declared with the domain (`tx-17-ok`,
`tx-7-ok`); SYS-1 exporting adapters (`asm-2-ok-assembly-hands`, `asm-8-ok`, `drv-6-ok` courier
key; `sys-12-ok` `ChangePriceButton`, 3 readers); TX-28 (`asm-3-ok-actor`: `afterChange` commits
before Payload); TX-19 (`tx-6-ok`: `payment_failed` after `succeeded` fails a paid payment); ASM-2
(`asm-7-ok` default `fetch`); `svc-7-ok-payment` hook imports `stripe` (4 readers). `sys-13-ok`
loses the `client_secret` (fixture fact) and never acks on redelivery (TX-5).

Other: Money's shape differs across examples; `svc-7-ok-payment`'s TX-5 and `sys-12-ok`'s SVC-4
rest on prose; `tx-34-ok` decides by payment and saves only refund (TX-24); `tx-29-ok` hands
fulfillment's handlers to the server bus and carries no version; `tx-33-ok` never acks a refund of
an order with no invoice (dist Impl); five examples give shop the price or sku the fixture gives
catalog (raw Impl N11).

## 6. The world

### Red team

Hold in both sets: the distributed monolith (P15 "as far as its own data reaches" asks nothing of a
system that keeps nothing), the shared schema (P11 refuses changes only, the store is Outside, a
table reader is no Downstream system), one system owning everything (P11, P13, P15 to P17 vacuous;
System "may hold several"). Raw only: ports found from within (an ambient registry: P5 says through
what, not where a reader learns it), the vendor-shaped domain (P1's Except plus P12 "as much a
choice").

Proposed: P19, a use case needs another system now only where a business rule needs its answer now
(both); P20/P21, no reading another's records except through its ports or what it publishes (both,
or lift P5's Why sentence); F10 plus P22, one word with two meanings is two systems (both, with
doubt: P3's Provenance advises wide boundaries); P23, which ports a use case reaches is told at
assembly (raw); P24, a conformist keeps its own rules in its own terms (raw).

Open: does a Why bind; is a call a message (P14 covers records and messages, not a call across a
deploy); is a reader of records downstream; P7/P15 "own" means owned or kept; P10's "a business rule
accepts" refuses nothing if any rule counts.

### Fresh repo, four drafts

Converge: five systems (catalog, ordering, payments, billing, fulfillment), dist-B seven (Inventory,
Notifications). All four: orchestration with Order as process manager; anti-corruption everywhere
(dist-B: Notifications conformist); one schema, role and pool per system read as separate stores;
web plus worker (three add a migrate process); refusals as the receiver's events; Payload external,
its versions read as an outbox by assembly's reader; gross prices, VAT in billing; shared kernel
`Money`, `Sku` (plus `TaxClass` in three). Raw against distilled: no systematic difference; the
property Whys were not needed to draft.

Diverge:

- Synchronous calls between own systems: raw-A, dist-A, dist-B call payments' open host service
  for the client secret (dist-B also Inventory's hold); raw-B none, all messages.
- Payload's product records: raw-A and dist-A make catalog's verdict advisory, Payload owns its
  drafts; raw-B vetoes through answering hooks, Payload still owns; dist-B has Catalog own what
  Payload keeps, vetoing. 4 of 4 flagged the Owner sentence with P11.
- Migrations: tooling (raw-A) or a deployed one-off process (raw-B, dist-A).
- A driving adapter: one per caller-port pair (raw-A) or one per way in (raw-B).

Sentences most drafts had to pick a reading for, same pick each time where noted:

1. Store, "when their writes commit together": can or do (4/4, all "do").
2. Owner with P11 and an external keeper (4/4, split).
3. "A command ... which may refuse": how the refusal comes back (4/4, all the receiver's event;
   TX-34 says so, the world could).
4. Hook: an external upstream only, or any (4/4, all "any").
5. "Each use case either acts or answers": may an acting one return its outcome (3/4, all yes).
6. "A repeated delivery changes nothing in this system": records or outside effects too (3/4, all
   records).
7. An external system's "configuration may hold business rules" against P2 (3/4, all "but should
   not").
8. Outbox reader "marks it by": where marks live for an external outbox (3/4).
9. Tentative operation "changes nothing it asks for": is a hold or reservation one (3/4, all yes).
10. Tooling against a deployed migration step (3/4, split).
11. "Every use case can run with nothing outside the process": tests or production (2/4).
12. "Work waiting on another system's answer is still a state a customer finds": shown, bounded,
    or both (2/4).
13. P15 "its own data": replicas included (raw-A; both Red teams).
14. Anti-corruption layer, "the driving adapters it calls into": which "it" (raw-A).
15. P1's Except: conformist only, or the shared kernel too (raw-B).
16. Outside: a logger's or tracer's export (raw-B).
17. Process manager: the next command is the service's sequence or the aggregate's rule (dist-A).

## 7. Fixture sentences the readers hung on

- "while holding its own ambient transaction" and "a unit of work kept ambient" against ASM-9:
  fact or situation? Read as fact, ASM-9 is cannot-comply (raw Impl N1, dist Adv).
- Is Payload's Local API catalog's open host service for TX-12? (raw Impl N3, raw Gap, dist Impl on
  SYS-12.)
- Mail provider, 3PL, bank: do they take idempotency keys; do they offer a test system (TST-5); is
  the bank polled or does it call a hook.
- "Issues a credit note for each refund" against step 7's never-invoiced order.
- `OrderPlaced` with too little stock: TX-35's Scope? (raw Gap, dist Impl.)
- The sku veto reads a count that can change before Payload commits: a P10 gap in catalog's rule
  (raw Impl N10, dist Gap).
- Examples build a Checkout Session where the fixture says PaymentIntent (raw Impl N12).
- ASM-4: is a typed courier accessor the reader (raw Impl N8)?
- Billing's second `OrderPaid` for an invoice order is another message: a second invoice unless the
  Invoice is keyed by order (raw Impl N15).
- Choreography is read everywhere; `sys-13-ok` orchestrates and cannot return the `client_secret`.

## 8. Candidate issues

A grouping, not a decision.

- A. Where a business rule lives (§1.1; dist Adv tx-17, drv-8).
- B. DRV-8's list: upstream published language, external package; sibling modules in the closed
  lists (§1.2, raw Impl N6).
- C. Relies-on sweep: DRV-7's positive half, TX-6 "it makes", SHOULD as given, SVC-2→DRV-8 (§4).
- D. Decisions on another system's live answer (§1.7); TX-5 and effects outside (§1.8); polled
  answers (dist Gap).
- E. Tentative operations in TX-3's and TX-22's Scopes; the `client_secret` (§2.2).
- F. A MAY names what it excepts; ASM-7's reach (§2.1, §1.15).
- G. Probes and instrumentation (§1.10, §1.12); external config that reads (§1.11); the dashboard
  (§1.13).
- H. Statement gaps both Adversarials found: SVC-7 "in the system's terms", SVC-3 through a port,
  TX-28's handler, TX-7 and a message's meaning, TX-23 unloaded or reloaded, DOM-1/SYS-14 ambient
  reads, TX-30/TX-35 ending (§3).
- I. Examples: 26 flagged files (§5); Money's shape.
- J. The world: P5's Why into the heading or P20; P19; F10/P22; the 17 two-way sentences; a
  property on tests (§6, §2.4).
- K. Fixture: the ambient transaction wording, the Local API as open host service, the providers'
  facts (§7).
