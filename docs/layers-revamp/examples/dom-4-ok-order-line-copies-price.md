---
breaches: []
satisfies: [DOM-4]
situation: shop's Order line refers to a product and to a payment
---

# Order line holds the product's id and the price copied at placement

```ts
// shop/domain/order.ts
export const orderLineSchema = z.object({
    productId: z.string(),          // catalog's document id
    sku: skuSchema,                 // shop's own commercial field, copied
    title: z.string(),              // copied from catalog when the line was added
    unitPrice: moneySchema,         // copied: the price the order was placed at
    quantity: z.number().int().positive(),
})

export const orderSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(["placed", "paid", "cancelled"]),
    lines: z.array(orderLineSchema).min(1),
    paymentId: z.string().nullable(), // payment's aggregate, by id
    paymentDeadline: z.string().datetime(),
})

export const orderTotal = (order: Order): Money =>
    order.lines.reduce((sum, line) => addMoney(sum, timesMoney(line.unitPrice, line.quantity)), zeroEur)
```

The line holds the product as its id plus the values the order needs as its own facts: the title and price as they were when the customer bought. When an editor retitles the tea or shop raises the price, the placed order keeps saying what was sold for how much. The payment is held by id; shop never loads payment's record into its aggregate, so the order repository saves orders and nothing of payment's.
