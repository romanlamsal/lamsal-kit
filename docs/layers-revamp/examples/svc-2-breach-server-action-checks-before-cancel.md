---
breaches: [SVC-2, DRV-1]
satisfies: []
situation: shop's server action checks the order before calling cancelOrder
---

# Server action asks `getOrder`, decides, then calls `cancelOrder`

```ts
// app/orders/[id]/actions.ts  (driving adapter)
export async function cancelOrderAction(orderId: string) {
    const { getOrder, cancelOrder } = shopServices()
    const customerId = await currentCustomerId()

    const order = await getOrder({ orderId })
    if (order.customerId !== customerId) return { error: "not yours" }
    if (order.status !== "placed") return { error: "order is not open" }

    await cancelOrder({ orderId })
    return { ok: true }
}

// shop/service/cancel-order.ts  (trusts the caller)
export const createCancelOrder =
    ({ orders, outbox, transactions }: CancelOrderDeps): CancelOrder =>
    async ({ orderId }) => {
        const order = await orders.findById(orderId)
        if (!order) throw new OrderNotFound(orderId)
        const cancelled = cancelOrder(order)
        await transactions.run(async (tx) => {
            await orders.save(cancelled, tx)
            await outbox.write(orderCancelled(cancelled), tx)
        })
        return cancelled
    }
```

`getOrder` already exists for the order page, so the action reuses it as a gate and keeps `cancelOrder` simple. The gate protects one way in: the `PaymentFailed` handler calls `cancelOrder` on an order that Stripe retried and that was marked paid in between, and the service cancels a paid order because nobody told it to check. Two service calls in one adapter is also a use case taking shape outside any transaction: the order can change between `getOrder` and `cancelOrder`.
