---
breaches: []
satisfies: [DRV-1, ASM-3, DRV-8]
situation: shop's server action works out which customer is cancelling, from the session cookie
---

# Server action asks an answering service who the session belongs to, then makes one acting call

```ts
// shop/services/identify-session.ts  (service that answers)
export const identifySession =
    ({ sessions }: { sessions: SessionRepository }): IdentifySession =>
    async ({ token }) => {
        const session = await sessions.findByToken(token)
        return session && !session.expired ? { customerId: session.customerId } : null
    }

// app/orders/[id]/actions.ts  (driving adapter the framework constructs)
export async function cancelOrderAction(orderId: string) {
    const { identifySession, cancelOrder } = shopServices()   // from the courier

    const token = cookies().get("session")?.value
    const caller = token ? await identifySession({ token }) : null
    if (!caller) return { error: "sign in first" }

    await cancelOrder({
        orderId,
        requestedBy: { kind: "customer", customerId: caller.customerId },
        now: new Date(),
    })
    return { ok: true }
}
```

The session lives in a store, so the adapter cannot establish the caller alone; it asks a service that answers, and the answer becomes the `requestedBy` argument of the one call that acts. Two service calls, one acting: the adapter calls services and nothing else of the system, so the arrow holds without an exception. Whether that customer may cancel this order is for `cancelOrder` and its specification to decide; the "sign in first" return decides nothing by stored state, it translates "no caller" into the protocol's answer.
