---
breaches: [SVC-7]
satisfies: [DRV-8]
situation: shop cancels an order from a server action
---

# Server action writes the orders table with raw SQL on the common library's pool

```ts
// app/orders/[id]/actions.ts  (driving adapter)
import { pool } from "@teeladen/common/postgres"          // common library, outside the layers
import { orderSchema } from "@teeladen/shop"               // domain, allowed: any layer to the domain
import { canBeCancelledBy } from "@teeladen/shop"          // domain specification

export async function cancelOrderAction(orderId: string, customerId: string) {
    const { rows } = await pool.query<{ order: unknown }>(
        "select to_jsonb(o) as order from orders o where o.id = $1",
        [orderId],
    )
    if (rows.length === 0) return { ok: false, reason: "not found" }
    const order = orderSchema.parse(rows[0].order)
    if (!canBeCancelledBy(order, { kind: "customer", customerId }, new Date())) {
        return { ok: false, reason: "not open" }
    }
    await pool.query("update orders set status = 'cancelled', cancelled_at = now() where id = $1", [orderId])
    return { ok: true }
}
```

Every import is on DRV-8's list: the two shop imports are domain, and `pool` is the common library,
which holds store clients. What the adapter does with `pool` is the breach: it reaches the store
through no port of shop's, and `new Date()` reaches the clock the same way. It reads state, decides
by it and writes outside any use case and any transaction a service holds, and no `OrderCancelled`
reaches the outbox. Through a driving port, the cancel is shop's use case, which loads the Order
through its repository, asks the specification and writes the message with the change.
