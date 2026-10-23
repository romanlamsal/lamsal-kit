---
breaches: []
satisfies: [ASM-1, ASM-2, ASM-5]
situation: fulfillment worker process with its own entry point, OpenTelemetry auto-instrumentation preloaded
---

# Fulfillment worker: one entry point, one assembly, instrumentation preloaded

```ts
// apps/fulfillment-worker/otel.ts — preloaded: `node --import ./otel.js ./main.js`
import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] }).start()

// apps/fulfillment-worker/main.ts — the process's assembly, runs after the preload
import { Pool } from "pg"
import { createTransactionPort, createRelay, createBus } from "@teeladen/common"
import { buildShopQueries } from "@teeladen/shop"
import { buildFulfillment } from "@teeladen/fulfillment"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const tx = createTransactionPort(pool)
const shopQueries = buildShopQueries({ tx })                     // upstream of fulfillment, in-process
const fulfillment = buildFulfillment({
  tx,
  shopQueries,
  warehouse: { baseUrl: process.env.WAREHOUSE_URL, apiKey: process.env.WAREHOUSE_KEY },
})

const bus = createBus({ handlers: fulfillment.handlers })
const relay = createRelay({ readers: [fulfillment.outboxReader], bus })
await relay.start()
```

The worker process has exactly one place where ports meet implementations: `main.ts`. It calls the
system builders the worker needs, the handler and outbox reader builders of fulfillment and the open
host service builder of shop, and hands each builder its upstreams and the one transaction port. The
preloaded `otel.ts` configures common library plumbing with one configuration for the process and
builds no port implementation, so it is not a second assembly; it has to load before `pg` is
imported, which `--import` guarantees without moving any wiring out of `main.ts`. One pool, one
relay, one bus exist in the process, and the relay receives the readers instead of importing them.
