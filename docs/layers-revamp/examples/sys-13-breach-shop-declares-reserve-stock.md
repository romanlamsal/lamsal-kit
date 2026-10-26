---
breaches: [SYS-13, TX-33]
satisfies: [SYS-2]
situation: shop places the order; fulfillment reserves the stock on it
---

# Shop declares `ReserveStock` in its own published language, shaped for fulfillment's use case

```ts
// shop/published/messages.ts  (shop's published language, SYS-2)
export const reserveStockSchema = z.object({
    id: z.string().uuid(),
    type: z.literal("ReserveStock"),              // what the receiver should do, not what happened here
    orderId: z.string(),
    lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
    reserveUntil: z.string().datetime(),          // fulfillment's reservation deadline, computed by shop
})

// shop/service/place-order.ts
await outbox.write(reserveStock(order, paymentDeadline(order)), tx)     // no system named anywhere in shop

// fulfillment/driving/handlers.ts — fulfillment imports shop's published language to handle it
import type { ReserveStock } from "@teeladen/shop/published"
export const buildFulfillmentHandlers = ({ reserveStock }: FulfillmentServices) => ({
    ReserveStock: async (message: ReserveStock) => { await reserveStock(message) },
})
```

The schema imports no domain, so SYS-2 holds, and no line of shop names fulfillment. Yet the command
is fulfillment's use case, declared in shop's terms. When fulfillment's reservation rule changes,
`reserveUntil` changes in shop's published language, and commands in the old shape still wait in
shop's outbox. Fulfillment imports shop's published language to handle orders it is told to carry
out, so shop is upstream of the system it gives orders to, and fulfillment adapts to it; its handler
is subscribed to a command another system's published language declares (TX-33). Declared in
fulfillment's published language, `ReserveStock` would be fulfillment's to change, and shop would
import it as the downstream.
