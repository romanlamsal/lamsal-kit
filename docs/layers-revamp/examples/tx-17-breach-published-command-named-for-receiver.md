---
breaches: [TX-17]
satisfies: [SYS-2]
situation: shop places the order; fulfillment reserves the stock on it
finding: adversarial
---

# Shop publishes `ReserveStock`, a command with fulfillment's use case as its name and shape

```ts
// shop/domain/messages.ts  (published language, SYS-2)
export const reserveStockSchema = z.object({
    id: z.string().uuid(),
    type: z.literal("ReserveStock"),              // what the receiver should do, not what happened here
    orderId: z.string(),
    lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
    reserveUntil: z.string().datetime(),          // fulfillment's reservation deadline, computed by shop
})

// shop/service/place-order.ts
await outbox.write(reserveStock(order, paymentDeadline(order)), tx)     // no system named anywhere in shop

// fulfillment/driving/handlers.ts
export const buildFulfillmentHandlers = ({ reserveStock }: FulfillmentServices) => ({
    ReserveStock: async (message: ReserveStock) => { await reserveStock(message) },
})
```

No line of shop names fulfillment: the message is published, subscribed to by whoever wants it, and shop imports nothing downstream, so the Statement is satisfied. The Why's harm follows regardless: the message exists for one receiver and says what that receiver should do with which arguments, so when fulfillment's reservation rule changes, `reserveUntil` changes in shop's domain and published language, when billing wants to know that an order was placed there is no event to subscribe to, and when fulfillment stops reserving, shop publishes an instruction nobody carries out. "Its code MUST NOT name a system that handles the message, nor a use case of one" or, in the glossary, "published: an event meant for other systems" would catch a command addressed by its name instead of by an import.
