---
breaches: [ASM-3]
satisfies: []
situation: shop cancels an order from a server action, a PaymentFailed handler and the deadline scheduled task
---

# The order repository filters rows by the ambient customer; the use case decides by what it loaded

```ts
// shop/adapters/drizzle/order-repository.ts  (driven adapter)
import { requestContext } from "@teeladen/common/request-context"

export const createDrizzleOrderRepository = (db: NodePgDatabase): OrderRepository => ({
    findById: async (id) => {
        const customerId = requestContext.getStore()?.customer?.customerId    // row-level scoping, "tenant style"
        const rows = await db.select().from(orders).where(
            customerId ? and(eq(orders.id, id), eq(orders.customerId, customerId)) : eq(orders.id, id),
        )
        return rows[0] ? toOrder(rows[0]) : null
    },
})

// shop/service/cancel-order.ts  (the use case decides by the loaded order and the port's arguments only)
export const createCancelOrder =
    ({ orders, outbox, transactions }: CancelOrderDeps): CancelOrder =>
    async ({ orderId, now }) => {
        const order = await orders.findById(orderId)
        if (!order) throw new OrderNotFound(orderId)
        if (!isCancellable(order, now)) throw new CancelRefused(orderId)
        // ...save and write OrderCancelled
    }
```

The use case decides by the Order it loaded and by `now`, both arguments; the ambient read sits in
the driven adapter the service calls, which ASM-3's Scope names. It changes what the use case
acts on: another customer's order is "not found", and the deadline scheduled task, running in no
request, loads and cancels every customer's order, with no caller knowing why the two ways in
behave differently. Which customer is asking belongs in `CancelOrder`'s input, and the service
asks the domain whether that customer may cancel.
