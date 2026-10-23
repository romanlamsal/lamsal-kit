---
breaches: [DOM-1]
satisfies: []
situation: shop's domain function generates the order id
---

# Domain function imports `node:crypto` for the order id

```ts
// shop/domain/order.ts
import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { Cart } from "./cart"
import { orderSchema, type Order } from "./order-schema"

export const placeOrderFromCart = (cart: Cart, placedAt: Date): Order =>
    orderSchema.parse({
        id: randomUUID(),
        status: "placed",
        lines: cart.lines.map((line) => ({
            productId: line.productId,
            sku: line.sku,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
        })),
        paymentDeadline: new Date(placedAt.getTime() + 30 * 60_000).toISOString(),
    })
```

`node:crypto` is one runtime's module. The checkout page imports `orderSchema` from this same module to render and validate the form, and the browser bundle now fails to resolve `node:crypto`, or pulls in a polyfill the domain never asked for. The id is a value the use case decides by, so it arrives as an argument like `placedAt` does, or comes from `globalThis.crypto`, which every runtime has.
