---
breaches: []
satisfies: [ASM-7, DVN-4]
situation: fulfillment's 3PL client imports the pino logger and the OpenTelemetry tracer; auto-instrumentation preloaded
---

# The warehouse client imports `logger` and `tracer`; it receives its fetch and configuration

```ts
// common/src/tracer.ts — one configuration per process; the SDK the preload started is what `trace` finds
import { trace } from "@opentelemetry/api"
export const tracer = trace.getTracer("teeladen")

// fulfillment/src/adapters/warehouse-client.ts — driven adapter to the 3PL
import { logger, tracer } from "@teeladen/common"
import type { Warehouse } from "../service/ports"
import { toWarehouseOrder, fromWarehouseShipment } from "./warehouse-translation"

export const createWarehouseClient = (cfg: { baseUrl: string; apiKey: string }, fetchImpl: typeof fetch = fetch): Warehouse => ({
  async requestShipment(order) {
    return tracer.startActiveSpan("warehouse.requestShipment", async (span) => {
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/shipments`, {
          method: "POST",
          headers: { authorization: cfg.apiKey, "content-type": "application/json" },
          body: JSON.stringify(toWarehouseOrder(order)),
        })
        if (!res.ok) {
          logger.warn({ status: res.status, orderId: order.id }, "3pl rejected shipment")
          throw new WarehouseRejected(res.status)
        }
        return fromWarehouseShipment(await res.json())
      } finally {
        span.end()
      }
    })
  },
})
```

The logger and the tracer are configured once for the worker process, by the preload and the pino
options in `common/src/logger.ts`, and nobody substitutes them: the adapter's integration test
asserts on what the 3PL stub received and what `requestShipment` returned, not on a log line or a
span. When the auto-instrumentation preload is missing, `trace.getTracer` returns a tracer whose
spans are no-ops and the adapter's behavior is unchanged, which is what makes the import harmless.
The configuration and the `fetch` are received through the factory, because those a test does vary.
