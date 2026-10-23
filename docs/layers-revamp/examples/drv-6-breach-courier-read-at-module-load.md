---
breaches: [DRV-6]
satisfies: []
situation: shop's server action module hoists the courier read so every action in the file can share it
---

# Courier read at module top level

```ts
// app/orders/[id]/actions.ts  (driving adapter the framework constructs)
"use server"

import { shopServices } from "@teeladen/shop/courier-key"
import { cancelOrderInputSchema, reorderInputSchema } from "@teeladen/shop"

const { cancelOrder, reorder } = shopServices()   // once, for the whole file

export async function cancelOrderAction(raw: unknown) {
    const input = cancelOrderInputSchema.parse(raw)
    return cancelOrder({ ...input, now: new Date() })
}

export async function reorderAction(raw: unknown) {
    const input = reorderInputSchema.parse(raw)
    return reorder({ ...input, placedAt: new Date() })
}
```

Two actions share the services, so the developer destructures once at the top. Next.js evaluates this module when it discovers the route, which in dev happens before the instrumentation hook has filled the courier: `shopServices()` throws, or returns whatever was there first and holds it for the life of the process. The test that fills the courier with fakes before calling `cancelOrderAction` changes nothing: the real `cancelOrder` was captured at import.
