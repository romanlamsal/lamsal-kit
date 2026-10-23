---
breaches: []
satisfies: [DOM-1, DOM-3]
situation: shop's Order schema is imported by the browser's checkout form and by the server
---

# Order domain module imports only what runs everywhere

```ts
// shop/domain/order.ts
import { z } from "zod"
import type { Transaction } from "@teeladen/common/transaction"
import { moneySchema } from "./money"
import { skuSchema } from "./sku"

export const orderLineSchema = z.object({
    productId: z.string(),
    sku: skuSchema,
    unitPrice: moneySchema,
    quantity: z.number().int().positive(),
})

export const orderSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(["placed", "paid", "cancelled"]),
    lines: z.array(orderLineSchema).min(1),
    paymentDeadline: z.string().datetime(),
})
export type Order = z.infer<typeof orderSchema>

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    save(order: Order, tx: Transaction): Promise<void>
}
```

Every import passes DOM-1's two questions: zod computes from its arguments, `./money` and `./sku` are domain modules of the same system, and the common library's transaction port is a type that names no store. The browser renders the checkout form from `orderSchema` and loads nothing of Node or Postgres with it; billing, reading shop's published language, gets the same module.
