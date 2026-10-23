---
breaches: [SVC-4, ARR-1]
satisfies: []
situation: shop marks the order paid on PaymentSucceeded
---

# `markOrderPaid` updates two columns with the store client

```ts
// shop/service/mark-order-paid.ts
import { eq } from "drizzle-orm"
import { orders } from "../adapters/drizzle/schema"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export const createMarkOrderPaid =
    ({ db, outbox, transactions }: { db: NodePgDatabase } & MarkOrderPaidDeps): MarkOrderPaid =>
    async ({ orderId, paymentId, paidAt }) => {
        await transactions.run(async (tx) => {
            // it's just two columns, loading and re-saving the whole order felt wasteful
            await db
                .update(orders)
                .set({ status: "paid", paymentId, paidAt })
                .where(eq(orders.id, orderId))
            await outbox.write(orderPaid({ orderId, paymentId, paidAt }), tx)
        })
    }
```

Loading the aggregate to flip one status feels wasteful, so the service writes the two columns directly. The update runs on `db`, not inside `tx`, so it commits on its own and the `OrderPaid` message can roll back without it, or the reverse. The service now imports a Drizzle table and a store client, so a second store means rewriting the use case, and `markPaid`'s rule, that only a placed order becomes paid, is nowhere: a cancelled order whose Stripe webhook arrives late is marked paid.
