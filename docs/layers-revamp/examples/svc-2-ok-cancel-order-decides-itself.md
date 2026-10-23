---
breaches: []
satisfies: [SVC-2, SVC-5]
situation: shop cancels an order from a server action, a PaymentFailed handler and the deadline scheduled task
---

# `cancelOrder` loads the order and asks the specification itself

```ts
// shop/domain/order.ts
export const canBeCancelledBy = (order: Order, requestedBy: Requester, now: Date): boolean =>
    order.status === "placed" &&
    (requestedBy.kind === "system" || requestedBy.customerId === order.customerId)

// shop/service/cancel-order.ts
export type CancelOrder = (input: {
    orderId: string
    requestedBy: Requester
    now: Date
}) => Promise<Order>

export const createCancelOrder =
    ({ orders, outbox, transactions }: CancelOrderDeps): CancelOrder =>
    async ({ orderId, requestedBy, now }) => {
        const order = await orders.findById(orderId)
        if (!order) throw new OrderNotFound(orderId)
        if (!canBeCancelledBy(order, requestedBy, now)) throw new CancelRefused(orderId)
        const cancelled = cancelOrder(order, now)
        await transactions.run(async (tx) => {
            await orders.save(cancelled, tx)
            await outbox.write(orderCancelled(cancelled), tx)
        })
        return cancelled
    }
```

Three driving adapters call this service: the customer's server action, the `PaymentFailed` handler, the deadline scheduled task. Each brings who is asking; the service loads the order and the specification decides, in the same call that writes. No way in can skip the check, and a check made a moment earlier in an adapter would be stale by the time the service acts anyway.
