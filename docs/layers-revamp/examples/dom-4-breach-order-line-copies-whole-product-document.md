---
breaches: [DOM-4]
satisfies: []
situation: shop's order line needs the product title and image for the order page
finding: adversarial
---

# The order line copies the whole product document at placement time

```ts
// shop/domain/order.ts
import { productSchema } from "@teeladen/catalog"          // catalog's published language: the Payload document
import { z } from "zod"

export const orderLineSchema = z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    product: productSchema,          // copied when the line was created; never loaded again
})

// shop/domain/cart.ts
export const addLine = (cart: Cart, product: Product, quantity: number): Cart => ({
    ...cart,
    lines: [...cart.lines, { productId: product.id, quantity, product: structuredClone(product) }],
})

export const lineTotal = (line: OrderLine): Money =>
    Money.times(line.product.price, line.quantity)       // the price copied then: this line's fact
```

Every field is "a value copied when it needed it", so the Statement is satisfied: nothing is loaded from catalog after the copy, and the price paid stays the price paid. The Why's harm still lands, because the copy is the other's whole record: the Order schema now contains catalog's model, its layout blocks, SEO fields and image variants, and a Payload field added or renamed for the editors changes `orderSchema`, the published language shop's downstreams parse with, and every stored order that no longer parses. "Copied" needs a bound: "the values its rules decide by, copied when it needed them, never the other's record" would have left `title` and `price` and refused `productSchema`.
