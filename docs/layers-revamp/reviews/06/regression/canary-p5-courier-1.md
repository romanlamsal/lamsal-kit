Base b953f9e, head 711215d.
Changed: P5 Statement's last sentence drops "each time it runs"; a driving adapter or observation now need only read the courier, at no stated moment.

## Targeted findings

none

## Every rule

Rules:
- P1: unaffected
- P2: unaffected
- P3: unaffected
- P4: unaffected
- P5: affected: Statement no longer says when the courier is read. Before, a driving adapter or observation that read the courier once (at module load, or on first run, then kept it) breached. Now it complies: it reads a courier only assembly fills. Under a stricter reading the module-level copy is a second holder assembly did not fill, so at best this is newly split; broken
- P6: unaffected (its third sentence tests running without the outside, not when observation is read)
- P7–P19: unaffected

World properties:
- P1–P4: unaffected
- P5: affected: the Except ("observation, where the process's assembly chooses what lies behind it") relied on the rule refusing a read held from before assembly chose. A complying build can now keep the library default logger for the life of the process; broken
- P6–P19: unaffected

Glossary:
- Business domain, Business rule, System, Outside: unaffected
- Observation: affected: it is the subject of the changed clause; its meaning is unchanged; holds
- Tooling, Probe, Use case, Domain, Service, Driven adapters, Driving adapters, Reach, Pure, Port, Adapter: unaffected
- Message, Outbox, Handler, Bus, Relay, Idempotent, Idempotency key, Tentative operation: unaffected
- Open host service, Published language, Offer, Reconciliation, Business process, Business process step, Saga, Choreography, Orchestration: unaffected
- Upstream system, Downstream system, Conformist, Anti-corruption layer, Shared kernel, Hook, External system: unaffected
- Aggregate, Owner, Specification, Repository, Snapshot, Replica, Record, Transaction, Store: unaffected
- Scheduled task, Ambient value, Factory, System builder, Assembly: unaffected ("only assembly fills" is kept)
- Courier: affected: P5 still binds who fills it but no longer when it is read; the entry's meaning is intact; holds
- Configuration value, Common library, Double, Fake, Integration test, End-to-end test, Default suite: unaffected

## Builds

- Fresh A: no change. Its driving adapters call `courier.get()` on every request (Processes, web assembly step 4; How each property holds, P5), so they comply before and after. The `pino` logger's reach is not touched by the change.
- Fresh B: no change. Driving adapters "read `createCourier(...).read()` inside each call" (How each property holds, P5; Adapters table), so they comply before and after. D12's alternative, "a module-scoped courier", is about where the courier is stored, not when it is read.

## Newly broken

```
---
breaches: world P5 (Except: the process's assembly chooses what lies behind observation)
satisfies: P5 Statement at head (observation reached from a courier only assembly fills, which it reads)
situation: system module imported before assembly sets the logger transport; logger read once at module load and kept
finding: regression
---
// packages/common/src/logger.ts: the library keeps the logger in a global; assembly sets its transport
let current: Logger = pino({ enabled: false })
export const setLogger = (l: Logger): void => { current = l }
export const getLogger = (): Logger => current

// packages/shop/src/adapters/driven/postgres/orders.ts
import { getLogger } from '@teashop/common/logger'
const log = getLogger()                                  // read once, when the module loads
export const makePgOrders = (db: ShopDb): OrderRepository<ShopPgTx> => ({
  save: async (tx, o) => { log.info({ orderId: o.id }, 'save'); /* ... */ },
  /* ... */
})

// apps/web/assembly/index.ts: imports the systems first, then
setLogger(pino(config.logTransport))                     // never reaches `log` in orders.ts
```

```
---
breaches: base P5 Statement ("reads each time it runs"); world P5 (a test or a refill by assembly does not reach the adapter)
satisfies: P5 Statement at head
situation: driving adapter a framework constructs keeps the first instance it read from the courier
finding: regression
---
// shop/src/adapters/driving/next/storefront-actions.ts
'use server'
import { shopCourier } from './courier'
let ports: ShopPorts | undefined
export async function placeOrderAction(form: FormData): Promise<PlaceOrderResult> {
  ports ??= shopCourier.read()                           // first run only; kept for the process
  return ports.storefront.placeOrder(parseCheckout(form))
}
```

P5 Why still says "The adapter reads it each time it runs" and refuses `const log = getLogger()` at module load. The Statement no longer backs either.

## Noticed

- Fresh A S5 and Fresh B S13 quote an older P5 first sentence ("through code of the common library whose output changes neither..."); head says "through observation".
- Fresh A S11 and S15 quote P13 with "a shared kernel"; head's P13 Statement has no such clause.
- Fresh A and B both use a `pino` logger to stdout from the common library, and neither says whether assembly fills it. P5 Why refuses a global logger built at module load. Not caused by this change.
