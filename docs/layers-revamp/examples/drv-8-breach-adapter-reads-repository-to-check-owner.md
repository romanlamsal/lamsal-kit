---
breaches: [DRV-8, SVC-2]
satisfies: []
situation: shop's server action, having identified the customer, also checks the order belongs to them
---

# Server action reads the repository to check "whether"

```ts
// app/orders/[id]/actions.ts  (driving adapter)
export async function cancelOrderAction(orderId: string) {
    const { identifySession, cancelOrder } = shopServices()
    const { orders } = shopServices().ports                  // OrderRepository, a driven port

    const token = cookies().get("session")?.value
    const caller = token ? await identifySession({ token }) : null
    if (!caller) return { error: "sign in first" }

    // while we are here: is this even their order, and is it still open?
    const order = await orders.findById(orderId)
    if (!order || order.customerId !== caller.customerId) return { error: "not found" }
    if (order.status !== "placed") return { error: "order is not open" }

    await cancelOrder({ orderId, requestedBy: { kind: "customer", customerId: caller.customerId }, now: new Date() })
    return { ok: true }
}
```

A driving port type is on DRV-8's list, a driven port is not: the adapter reads state and decides by it, which is what DRV-8's Why describes. The decision it makes, may this customer cancel this order, is the use case's (SVC-2): the `PaymentFailed` handler, another way in, makes neither check, and the one the action makes is stale by the time `cancelOrder` runs. The answering call for the session is fine; the repository read is the breach.
