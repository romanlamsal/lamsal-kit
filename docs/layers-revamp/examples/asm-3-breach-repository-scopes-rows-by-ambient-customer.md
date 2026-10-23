---
breaches: [ASM-3]
satisfies: [SVC-5]
situation: shop cancels an order from a server action, a PaymentFailed handler and the deadline scheduled task
finding: adversarial
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

Neither the use case nor a domain function reads the ambient value: `cancelOrder` decides by the Order it loaded and by `now`, both arguments, so the Statement is satisfied and SVC-5 too. The decision is made by the ambient customer all the same, one step removed, as the Why describes: another customer's order is "not found", and the deadline scheduled task, running in no request, loads and cancels every customer's order, with no caller knowing why the two ways in behave differently. "A use case and a domain function MUST NOT decide by it, nor by what a driven adapter read by it" closes the step; ASM-9's Why names this very mechanism for the transaction and the rule for ambient values in general leaves it open.
