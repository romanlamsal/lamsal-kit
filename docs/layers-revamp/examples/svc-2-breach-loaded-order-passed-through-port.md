---
breaches: [SVC-2]
satisfies: [DRV-1]
situation: shop cancels an order from a server action
finding: adversarial
---

# The acting service decides on the Order the adapter hands it, not the one in the store

```ts
// shop/service/cancel-order.ts
export type CancelOrder = (input: { order: Order; requestedBy: Requester; now: Date }) => Promise<Order>

export const createCancelOrder =
    ({ orders, outbox, transactions }: CancelOrderDeps): CancelOrder =>
    async ({ order, requestedBy, now }) => {
        if (!canBeCancelledBy(order, requestedBy, now)) throw new CancelRefused(order.id)   // decided here
        const cancelled = cancelOrder(order, now)
        await transactions.run(async (tx) => {
            await orders.save(cancelled, tx)
            await outbox.write(orderCancelled(cancelled), tx)
        })
        return cancelled
    }

// app/orders/[id]/actions.ts  (driving adapter)
export async function cancelOrderAction(orderId: string) {
    const { getOrder, cancelOrder } = shopServices()
    const order = await getOrder({ orderId })                        // answering service, for an argument
    if (!order) return { error: "not found" }
    await cancelOrder({ order, requestedBy: sessionRequester(), now: new Date() })
    return { ok: true }
}
```

The service that acts makes the decision itself, in the call that acts, with the domain's specification: the Statement is met word for word, and DRV-1 is too, since the answering call supplies an argument and does not decide whether to act. The Why's harm is intact: the decision is made on an Order loaded in another call, so the `PaymentSucceeded` handler marking the order paid between `getOrder` and `cancelOrder` is not seen, and a second driving adapter, or anyone with the port, hands in an Order whose `status` and `customerId` say whatever it likes, because the port now takes the data the decision is made by. "MUST load what it decides by and make the decision itself, in the call that acts" is the wording that refuses an aggregate as port input.
