Base b953f9e, head 711215d.
Changed: P5 Statement's last sentence drops "each time it runs": a driving adapter or observation that reads a courier may now read it once (at module load, or on first run) and keep it.

## Targeted findings

none

## Every rule

Rules:
- P1 unaffected
- P2 unaffected
- P3 unaffected
- P4 affected: Statement bars ambient and configuration values from changing how a use case acts; a configuration value read once from a courier is still one process-wide value, so before and after a build may read it per call or once, and P4 refuses it the same either way. Holds
- P5 affected: the removed clause was the only binding text making a courier reader re-read it. Before, a driving adapter or observation that took the courier's value at module load or on first run and kept it breached. Now it complies, since it still reads "from a courier that only assembly fills". No other Statement says when the read happens. The Why still argues the removed rule ("The adapter reads it each time it runs", `const log = getLogger()` at module load refused), so Why and Statement now disagree. Broken
- P6 affected: shares the property P5's Except sets up (observation reached through no port). Statement s4 asks only that the use case run without the outside, and a kept no-op default does that. A build could pass P6 before and after. Holds
- P7 unaffected
- P8 unaffected
- P9 unaffected
- P10 unaffected
- P11 unaffected
- P12 unaffected
- P13 unaffected
- P14 unaffected
- P15 unaffected
- P16 affected: the courier is an ambient value; P16's ban on an ambient transaction does not depend on when the read happens, before or after. Holds
- P17 unaffected
- P18 unaffected
- P19 unaffected

World:
- P1 unaffected
- P2 unaffected
- P3 unaffected
- P4 affected: responding the same whoever calls; a driving port taken once from a courier is still assembly's instance in production. Holds
- P5 affected: its Except reads "observation, where the process's assembly chooses what lies behind it". With a courier whose unfilled state is a no-op, a module-load read made before assembly runs keeps the no-op for the life of the process, so assembly chooses nothing for that module. Before, the per-run read meant assembly's later fill reached every reader. Now a complying build can break the Except. Broken
- P6 affected: a module that keeps the courier's no-op still runs with nothing outside. Holds
- P7–P19 unaffected

Glossary:
- Business domain, Business rule, System, Outside, Tooling, Probe: unaffected
- Observation affected: the changed sentence uses it, and the definition is untouched. Holds
- Use case, Domain, Service, Driven adapters: unaffected
- Driving adapters affected: the changed sentence's subject, definition untouched. Holds
- Reach affected: "however the code got hold of it" makes a kept copy still a reach of what the courier held; meaning intact. Holds
- Pure, Port, Adapter, Message, Outbox, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation, Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration, Upstream system, Downstream system, Conformist, Anti-corruption layer, Shared kernel, Hook, External system: unaffected
- Aggregate, Owner, Specification, Repository, Snapshot, Replica, Record, Transaction, Store, Scheduled task: unaffected
- Ambient value affected: a courier read is a per-process ambient value; the definition still holds whether the read is made once or per call. Holds
- Factory, System builder: unaffected
- Assembly affected: "only assembly fills" is unchanged; "one place per process" is untouched. Holds
- Courier affected: the term the change is about; "how code reaches what assembly produced" still describes it, with no timing in it before or after. Holds
- Configuration value affected: one of the things the sentence routes; per process for its life, so the timing of the read changes nothing. Holds
- Common library, Double, Fake, Integration test, End-to-end test, Default suite: unaffected

## Builds

- Fresh A: no change. Driving adapters call `courier.get()` on every request (Assembly of `web` step 4; P5 section), which complies before and after. Its global `pino` stdout logger in `@teashop/common` has no courier filled by assembly, so it breaches P5 before and after.
- Fresh B: no change. It reads `createCourier(...).read()` inside each call (Adapters table; P5 section). The `pino` stdout logger in `@teashop/telemetry` has the same unchanged status as A's.

## Newly broken

```md
---
breaches: the-world P5 Except ("observation, where the process's assembly chooses what lies behind it")
satisfies: P5 Statement at head (it breached at b953f9e: "reads each time it runs")
situation: a logger courier whose unfilled state is a no-op (the default P6 s4 needs so tests run), read once at module load, before register() runs assembly
finding: regression
---
// packages/common/src/logger.ts
let current: Logger = noopLogger            // filled by assembly only
export const setLogger = (l: Logger) => { current = l }
export const getLogger = () => current

// packages/shop/src/services/place-order.ts
const log = getLogger()                      // module load: keeps noopLogger for the life of the process
export const makePlaceOrder = (deps: PlaceOrderDeps): PlaceOrder => async (input) => {
  log.info({ cartId: input.cartId }, 'placing')   // goes nowhere in production
  /* ... */
}

// apps/web/assembly/index.ts
setLogger(pino(transportFrom(config)))       // assembly's choice never reaches place-order.ts
```

```md
---
breaches: nothing binding at head (P5 Statement at b953f9e)
satisfies: P5 Statement at head
situation: a framework-constructed driving adapter takes the driving ports from the courier once at module load; a test refills the courier with fakes per case
finding: regression
---
// apps/web/app/(shop)/checkout/actions.ts
'use server'
const { placeOrder } = shopCourier.get()     // module load, kept
export async function placeOrderAction(form: FormData) {
  return placeOrder(parseCheckout(form))     // second test's fakes never reach it
}
```

## Noticed

- No binding text says whether a no-op default in an unfilled courier is a fill by someone other than assembly ("only assembly fills"). P6's Why asks for one. This predates the change.
- Both builds' module-level `pino` stdout logger breaches P5 only by the Why's reading of "chosen by assembly". The Statement's courier clause fits it only if the global counts as a courier. This predates the change.
