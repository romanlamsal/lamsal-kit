---
breaches: [DRV-8]
satisfies: []
situation: shop cancels an order from a server action
finding: adversarial
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

The adapter imports nothing from shop's service or driven-adapter layer: the two shop imports are domain, and `pool` is the common library, whose store clients DRV-8's list allows. The Statement is satisfied, and SVC-4 says nothing either because no use case is writing. The Why's harm is complete: the adapter reads state, decides by it, writes outside any use case and any transaction a service holds, and no `OrderCancelled` reaches the outbox. The list's "the common library" lets the store client in; "the common library but its store clients" would hold here.
