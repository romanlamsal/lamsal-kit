---
breaches: [DOM-4]
satisfies: []
situation: shop's order page needs the product title and image for each line
---

# Order line embeds the product document

```ts
// shop/domain/order.ts
import type { Product } from "@/payload-types"

export type OrderLine = {
    product: Product            // the whole catalog document, loaded with the order
    quantity: number
}

export type Order = {
    id: string
    status: "placed" | "paid" | "cancelled"
    lines: OrderLine[]
}

export const orderTotal = (order: Order): number =>
    order.lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0)

// shop/adapters/drizzle/order-repository.ts
findById: async (id) => {
    const rows = await db.select().from(orders)
        .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
        .leftJoin(products, eq(products.id, orderLines.productId))  // Payload's table
        .where(eq(orders.id, id))
    return toOrder(rows)
}
```

The order page needs a title and an image, and embedding the product gives it everything at once. Now the order's total is computed from today's price, not the price paid, and an editor's retitle rewrites every past order. The order repository joins Payload's `products` table, so Order and Product have become one aggregate written by two systems' use cases, and the catalog's model, every Payload field, is carried into shop's domain.
