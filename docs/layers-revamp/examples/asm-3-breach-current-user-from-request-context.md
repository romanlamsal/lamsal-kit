---
breaches: [ASM-3]
satisfies: []
situation: shop's cancelOrder reads the current customer from the request context
---

# `cancelOrder` reads the customer from `AsyncLocalStorage`

```ts
// common/request-context.ts  (common library, per-request ambient values)
export const requestContext = new AsyncLocalStorage<{ requestId: string; customerId?: string }>()
export const currentCustomerId = (): string | undefined => requestContext.getStore()?.customerId

// shop/service/cancel-order.ts
import { currentCustomerId } from "@teeladen/common/request-context"

export type CancelOrder = (input: { orderId: string }) => Promise<Order>

export const createCancelOrder =
    ({ orders, outbox, transactions }: CancelOrderDeps): CancelOrder =>
    async ({ orderId }) => {
        const order = await orders.findById(orderId)
        if (!order) throw new OrderNotFound(orderId)
        if (order.customerId !== currentCustomerId()) throw new CancelRefused(orderId)
        const cancelled = cancelOrder(order)
        await transactions.run(async (tx) => {
            await orders.save(cancelled, tx)
            await outbox.write(orderCancelled(cancelled), tx)
        })
        return cancelled
    }
```

The middleware already puts the customer into the request context for logging, so the service reads it there and the port stays small. The use case now decides by a value in no signature: the `PaymentFailed` handler runs in no request, `currentCustomerId()` is `undefined`, and every cancel from the handler is refused. The deadline scheduled task has the same problem, and the service's test passes or fails depending on whether the test harness happened to wrap the call in `requestContext.run`.
