Base a8345ae, head b122faa.
Changed: P3 s2 kernel "values / computes values" -> "value types / computes with them"; P5 s3 courier gains "that reaches nothing until it does"; P7 gains s2 "Each driven port that writes MUST take that transaction as an argument", Why rewritten; P8 s3 "make the change" -> "act on the change"; P13 Why drops tests-as-downstream-code sentence; P16 s2 drops "travel only as an argument, never as an ambient value", Why points ambient case to s1.

## Targeted findings

- R05-9: resolved. P8 s3 "MUST act on the change, deciding nothing again" is met by an executor that attempts and commits the refusal, so it no longer clashes with P17 s4.
- R05-13: resolved. P16 no longer carries the ambient ban. The argument rule now sits in P7 s2, under the property it serves. Across systems, P16 s1 (and P11 s1) still refuse an ambient transaction that another system's code uses.
- R05-26: unchanged. "values" no longer means two things in P3 s2, and a bare rate constant in the kernel is now refused. But `vatRate(taxClass)` still "computes with them from arguments" (P3 s2), and it is still billing's rule about the invoice line (P3 s1). Two builds remain.
- R05-28: resolved. The P13 Why sentence that counted tests as downstream code under P13 s1 is gone. Glossary Tooling and Assumptions now stand alone.
- tests-assembly Noticed (module-level `pino` breaches P5 only by the Why): resolved. P5 s3 now has the courier "reach nothing until" assembly fills it. A module-level stdout logger reaches stdout with nothing filled, so it breaches by the Statement's letter.

## Every rule

Rules:
- P1 unaffected (courier and kernel appear in its Why only; s1 kernel reach unchanged)
- P2 affected: s1 lets a rule sit "in a shared kernel", and P3 s2 now narrows what a kernel holds. Before and after, a build can state a rule in a kernel only where P3 allows it; this is a permission plus a limit, no contradiction. Holds
- P3 affected: s2 changed. Before, a kernel holding `VAT_RATES` complied by the letter; after, it breaches (no value type, computes nothing from arguments). `Money`, `EmailAddress` and their schemas comply before and after. Why "offers the values the owners' rules decide by" now reads against s2's "value types", but Why binds nobody. Holds
- P4 affected: s1 bans ambient values, and P16 dropped its own ambient transaction ban. An ambient transaction varies by neither caller nor process, so P4 s1 needed nothing from the removed clause, before or after. Holds
- P5 affected: s3 clause added. Before, an unfilled courier with a default that reaches outside (stdout logger, default client) passed by the vacuous "only assembly fills". After, it breaches. Couriers whose read throws while unfilled, and the OTel no-op global, comply before and after. Reading "reaches nothing" through glossary Reach ("what it is typed by", in-process code) would refuse every typed courier; that reading ignores what s3 plainly allows, so it is no split. Why's "a transaction made ambient ... P16 delivers this" is now partly stale (non-binding). Holds
- P6 affected: s4 (absence of observation changes nothing) shares a property with the P5 clause; a courier that reaches nothing unfilled helps s4. The Why's fake `Transactions` still fits P7 s2 (ports take `FakeTx`). Holds
- P7 affected: s2 added. Before, a unit of work whose transaction adapter hands the service tx-bound repositories complied (P7 s1; P16 s2 satisfied, the tx passed as an argument to adapter factories). After, it breaches s2: its write ports take no transaction. World P7 still holds in that build. An ambient transaction used by writing ports breached P16 s2 before and breaches P7 s2 after, so the verdict is the same. Broken (see Newly broken)
- P8 affected: s3 "act on". Before, an executor whose outside refuses could not meet the letter. After, attempting and recording the refusal complies. Giving up on a timeout is still refused ("deciding nothing again", s2 chain). World P8 still delivered. Holds
- P9 affected: the s1 claim "inside the transaction that commits its writes" is a write port, and P7 s2 now types it with the tx. Same verdicts. Holds
- P10 affected: a reading port that takes the use case's transaction ambiently breached P16 s2 before and complies now. P10 s1 still requires reads inside the committing transaction, and a `?? db` fallback is still refused. World P10 holds. Holds
- P11 affected: billing's adapter reading shop's record through shop's ambient tx, in-process, is now refused by P11 s1 alone (P16 s1 does not reach shop's own records). It was refused before by P16 s2 too. Holds
- P12 unaffected
- P13 affected: Why sentence removed. s1 is unchanged, and tests are tooling before and after. A test importing the offer's fake complies either way. Holds
- P14 unaffected
- P15 unaffected
- P16 affected: s2 ambient clause removed. Before, any ambient transaction breached, even inside one system. After, s1 refuses it only where it makes a transaction read or write another owner's records. Spanning stays refused by s1, s2 and s3. P7 s2's write-port tx and P16 s3's driving port carry no tx; the two never meet in complying builds: P8 s1 puts acting calls into other systems after the commit. Holds
- P17 affected: s4 now no longer overlaps with P8 s3 in conflict. Holds
- P18 unaffected
- P19 unaffected

World:
- P1, P2 unaffected
- P3 affected: s2 narrowed toward value types; rules that decide records still go to the owner (P3 s1). Holds
- P4 affected: through the removed ambient clause; an ambient tx does not vary by caller. Holds
- P5 affected: the Except ("assembly chooses what lies behind" observation) is now delivered by the s3 letter, not only by the Why. Holds
- P6 affected: an unfilled observation courier reaching nothing keeps a test free of the outside. Holds
- P7 affected: delivered by P7 s1 plus s2; s2 is stricter than the property (unit of work). Holds
- P8 affected: P8 s3 still delivers "nothing that follows ... is lost". Holds
- P9 unaffected
- P10 affected: delivered by P10 s1 whether a read is ambient or by argument. Holds
- P11 affected: now the only rule refusing the cross-system ambient read of the opener's own records. Holds
- P12 unaffected
- P13 affected: delivered by P13 s1–s3 as before. Holds
- P14, P15 unaffected
- P16 affected: delivered by P16 s1–s3 without the ambient clause. Holds
- P17 affected: P17 s4 delivers the refusal as outcome, now without the clash. Holds
- P18, P19 unaffected

Glossary:
- Business domain, Business rule, System, Outside, Tooling (affected: P13 Why no longer contradicts it; holds), Probe, Use case (affected: "act on" read with *acting*; holds), Domain, Service, Driven adapters, Driving adapters: unaffected except where noted
- Reach affected: "reaches nothing" in P5 s3. The type-inclusive reading would make every courier breach, so it is not plausible. Holds
- Pure, Port (affected: P7 s2 "driven port that writes", P16 s3; holds), Adapter, Message, Outbox (affected: the outbox port must now take the tx; holds), Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer (affected: P13 Why no longer names the offer's fake for tests; holds), Reconciliation, Business process, Business process step (affected: P17 s4 vs P8 s3; holds), Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer: unaffected except where noted
- Shared kernel affected: P3 s2 limits it to value types; the definition ("part of the domain model") is untouched. Holds
- Hook, External system, Aggregate, Owner, Specification, Repository (affected: repository port now takes the tx; holds), Snapshot, Replica, Record, Store, Scheduled task: unaffected except where noted
- Transaction affected: P16 dropped the ambient ban, and P7 s2 binds it to writing ports. The definition is untouched. Holds
- Ambient value affected: no longer used by P16. P4 s1 still uses it. Holds
- Factory, System builder: unaffected
- Assembly affected: "until it does" means until assembly fills. Holds
- Courier affected: the new clause adds a condition, and both bullets stand. Holds
- Configuration value affected: a config courier (webhook secrets) must reach nothing unfilled. Holds
- Common library affected: a logger kept there is a courier now held to the clause. Holds
- Observation affected: s3 clause binds observation couriers. Holds
- Double, Fake, Integration test, End-to-end test, Default suite: unaffected

## Builds

- Fresh A: now breaches P5 s3. `@teashop/common` `pino` logger to stdout, module-level ("Code that is no system"; P4 and P6 sections), reaches stdout with no fill by assembly. It now complies with P8 s3 by the letter: `bookShipment` refused booking recorded, `issueCardRefund` refused published (P8, P17 sections). P7 unchanged: "every write port takes `tx` as a required first parameter" (P7 section). P16 unchanged (ALS banned). P3 unchanged (kernel `Money`, `EmailAddress`; rate passed to `netFromGross`).
- Fresh B: now breaches P5 s3. `@teashop/telemetry` pino logger to stdout ("Telemetry is the one direct reach", P5 section). Courier `read()` throws unfilled, so it complies. It now complies with P8 s3 by the letter: `SubmitShipment` refused gives `ShipmentRefused`, `ExecuteRefund` refused (P8, P17 sections). P7 unchanged ("the `tx` each writing port requires as its first parameter"). P16, P3 unchanged.

## Newly broken

P7 s2 refuses a unit of work that delivers world P7.

```md
---
breaches: [P7]
satisfies: [P16]
situation: shop's transaction adapter hands the service repositories bound to the open transaction
finding: regression
---

# Unit of work hands tx-bound write ports

```ts
// shop/src/service/ports/driven.ts
export interface Orders { save(o: Order): Promise<void> }
export interface ShopOutbox { publish(e: ShopEvent): Promise<void> }
export interface UnitOfWork { run<T>(work: (u: { orders: Orders; outbox: ShopOutbox }) => Promise<T>): Promise<T> }

// shop/src/adapters/driven/postgres/unit-of-work.ts
export const makePgUnitOfWork = (db: ShopDb): UnitOfWork => ({
  run: (work) => db.transaction((tx) => work({ orders: makePgOrders(tx), outbox: makePgOutbox(tx) })),
})

// shop/src/service/place-order.ts
export const makePlaceOrder = ({ uow }: { uow: UnitOfWork }): PlaceOrder => async (input) =>
  uow.run(async ({ orders, outbox }) => {
    const order = placeOrder(input)
    await orders.save(order)
    await outbox.publish(orderPlaced(order))
    return { orderId: order.id }
  })
```

Every write lands in the one transaction the service opens (P7 s1), and the transaction travels as an argument, never ambient. At a8345ae it complied with P7 and P16 s2. At b122faa, `Orders` and `ShopOutbox` write and take no transaction, so P7 s2 refuses it.
```

## Noticed

- P5 s3 "a client of the outside ... as an argument chosen by the process's assembly": a transaction the service opens is chosen by no assembly. This predates the change (R05-13 left it).
- P8 s3 "such a message" still leaves open whether a held deadline message counts (Fresh B S2). This predates the change.
