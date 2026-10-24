---
breaches: [DOM-1]
satisfies: []
situation: shop's Order type is inferred from its Drizzle table
---

# Domain derives `Order` from the Drizzle table

```ts
// shop/domain/order.ts
import { orders } from "@teeladen/shop/adapters/drizzle/schema"

export type Order = typeof orders.$inferSelect

export const canBeCancelled = (order: Order, now: Date): boolean =>
    order.status === "placed" && new Date(order.paymentDeadline) > now

// shop/adapters/drizzle/schema.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey(),
    status: text("status", { enum: ["placed", "paid", "cancelled"] }).notNull(),
    paymentDeadline: timestamp("payment_deadline").notNull(),
})
```

Stating the shape once (DOM-3) tempts the developer to make the table the one statement and let the domain infer from it. The domain now depends on a driven adapter's module, against the arrow, and the browser importing `canBeCancelled` to grey out a button loads `drizzle-orm/pg-core` with it. A column renamed for storage reasons renames a domain field, and a second store, or a fake repository, has to produce Drizzle's row type.
