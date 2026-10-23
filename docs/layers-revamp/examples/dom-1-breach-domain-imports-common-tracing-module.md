---
breaches: [DOM-1]
satisfies: []
situation: shop's message factory puts the current trace context on OrderPlaced
finding: adversarial
---

# The domain imports the common library's tracer port module, which loads `node:async_hooks`

```ts
// common/src/tracing.ts  (the tracer port and its ambient context, one module)
import { AsyncLocalStorage } from "node:async_hooks"
export interface Tracer { startSpan(name: string): Span }
export interface TraceContext { traceId: string; spanId: string }
const store = new AsyncLocalStorage<TraceContext>()
export const currentTraceContext = (): TraceContext | undefined => store.getStore()

// shop/domain/messages.ts
import { currentTraceContext } from "@teeladen/common/tracing"   // a port of the common library
import type { Order } from "./order"

export const orderPlaced = (order: Order): OrderPlaced => ({
    id: crypto.randomUUID(),
    type: "OrderPlaced",
    orderId: order.id,
    lines: order.lines.map(({ sku, quantity }) => ({ sku, quantity })),
    trace: currentTraceContext(),                 // forwarded, not decided by: ASM-3 is content
})
```

The import is from the module that declares the tracer port, so it is "a port of the common library" and the Statement allows it; the domain decides nothing by the trace context, it forwards it, so ASM-3 is content as well. The Why's harm follows anyway: the module behind the port carries `AsyncLocalStorage`, and the browser that imports `orderSchema` from the same domain gets a load error on `node:async_hooks`, which the Why itself calls the problem "one step removed" without the Statement guarding it. A Statement that says "the type of a port of the common library, imported as a type" would have left `currentTraceContext` nowhere to come from in the domain.
