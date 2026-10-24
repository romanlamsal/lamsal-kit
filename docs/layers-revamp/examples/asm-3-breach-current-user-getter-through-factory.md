---
breaches: [ASM-3]
satisfies: []
situation: shop's cancel-order service needs to know which customer is cancelling
---

# The current user arrives through the factory, as a dependency that reads the request context

```ts
// shop/service/cancel-order.ts
type Deps = {
    orders: OrderRepository
    outbox: ShopOutbox
    transactions: TransactionPort
    currentCustomer: () => { customerId: string } | null       // "a dependency, through its factory"
}

export type CancelOrder = (input: { orderId: string; now: Date }) => Promise<Order>

export const createCancelOrder =
    ({ orders, outbox, transactions, currentCustomer }: Deps): CancelOrder =>
    async ({ orderId, now }) => {
        const order = await orders.findById(orderId)
        const caller = currentCustomer()
        if (!order || !caller || order.customerId !== caller.customerId) throw new CancelRefused(orderId)
        // ...save and write OrderCancelled
    }

// apps/web/instrumentation.ts  (assembly)
const shop = buildShop({ tx, currentCustomer: () => requestContext.getStore()?.customer ?? null })
```

Everything the service uses arrives as an argument, the dependency through the factory, and the
service module itself imports nothing ambient. The value it decides by is ambient all the same:
`currentCustomer()` reads the request context, so the service reads an ambient value and it
changes whether the use case acts, ASM-3's breach one call removed. Who is calling is in no
driving port signature: the `PaymentFailed` handler calls `cancelOrder({ orderId, now })` from a
process with no request and `currentCustomer()` returns `null`, and a test that forgets the
function passes a service that refuses everything. The caller belongs in `CancelOrder`'s input.
