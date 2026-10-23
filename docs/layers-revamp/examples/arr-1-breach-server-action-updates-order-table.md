---
breaches: [ARR-1]
satisfies: []
situation: shop cancels an order from a server action
---

# Server action writes the orders table itself

```ts
// app/orders/[id]/actions.ts  (driving adapter)
import { db } from "@teeladen/common/postgres"
import { orders } from "@teeladen/shop/adapters/drizzle/schema"
import { eq } from "drizzle-orm"

export async function cancelOrderAction(orderId: string) {
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!row) throw new Error("not found")
    if (row.status !== "placed") return { ok: false, reason: "not open" }

    await db
        .update(orders)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(orders.id, orderId))

    return { ok: true }
}
```

The driving adapter reaches the store client and the Drizzle table directly: it reads state, decides by it, and writes, in no use case and in no transaction a service holds. The domain's rule for when an order may be cancelled is bypassed for this one way in, and nothing writes `OrderCancelled` to the outbox, so fulfillment keeps the reservation. When the payment deadline passes, the scheduled task has to cancel orders too, and now implements the cancel a second time, differently.
