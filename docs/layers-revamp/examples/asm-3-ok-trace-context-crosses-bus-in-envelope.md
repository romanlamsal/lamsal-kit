---
breaches: []
satisfies: [ASM-3, ASM-7, DVN-4]
situation: request id and trace context should cross system boundaries; the transaction must not
---

# The outbox adapter puts the trace context on the envelope; the handler restores it

```ts
// shop/driven/drizzle/outbox.ts — driven adapter, reads the ambient trace context through the common library
import { traceHeaders } from "@teeladen/common/tracer"

write: async (message, tx) => {
  const headers = traceHeaders()                              // traceparent, plus the request id as baggage
  await asDrizzle(tx).insert(outbox).values({ id: message.id, type: message.type, payload: message, headers })
}

// common/tracer.ts — the common library's tracer, over OpenTelemetry
export const traceHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  propagation.inject(context.active(), headers)
  return headers
}

// common/bus/run-handler.ts — before the handler runs
const parent = propagation.extract(context.active(), envelope.headers)
await context.with(parent, () => handler(envelope.payload))
```

The trace context changes neither how a use case acts nor what it answers, so the outbox adapter may
read it ambiently (ASM-3), through the common library's tracer (ASM-7, DVN-4). It travels on the
envelope, not in the message's schema, and the handler's spans join the request's trace in the
worker. The transaction crosses nothing: each handler opens its own.
