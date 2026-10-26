---
breaches: [SVC-6, SVC-7]
satisfies: []
situation: shop's OrderRepository takes Drizzle's transaction type
---

# Repository method typed with Drizzle's `PgTransaction`

```ts
// shop/service/ports/order-repository.ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { Order } from "../../domain/order"

type DrizzleTx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0]

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    save(order: Order, tx: DrizzleTx): Promise<void>
}

// shop/service/place-order.ts
await db.transaction(async (tx) => {
    await orders.save(order, tx)
    await carts.save(clearCart(cart), tx)
})

// shop/test/fakes/order-repository.ts
export const createFakeOrderRepository = (): OrderRepository => ({
    save: async (order, _tx: DrizzleTx) => { store.set(order.id, order) },
})
```

Typing the parameter with the real transaction type is what autocomplete offers, and it type-checks the adapter for free. But the port is in shop's service layer, so `drizzle-orm/node-postgres` is now imported by the service, a store client's type that is not on SVC-6's list. The service opens the transaction with `db` to produce a value of that type, so the store client is in the service too, and the fake repository, and every test of a service, has to name Drizzle's type to compile. Opening it with `db.transaction`, the service reaches the store through no port (SVC-7).
