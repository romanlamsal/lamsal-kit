---
breaches: [SYS-2, DOM-3]
satisfies: []
situation: shop publishes OrderPaid; billing issues the invoice from it
---

# A hand-written public schema beside the domain's OrderPaid

```ts
// packages/shop/domain/messages.ts
export const orderPaidSchema = z.object({
  messageId: z.string().uuid(), orderId: z.string().uuid(),
  lines: z.array(orderLineSchema), total: moneySchema, paidAt: z.string().datetime(),
})

// packages/shop/published/order-paid.ts — "don't leak the internal shape to downstreams"
export const orderPaidPublicSchema = z.object({
  id: z.string().uuid(), orderId: z.string().uuid(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int(), unitPrice: moneySchema })),
  total: moneySchema, paidAt: z.string().datetime(),
})
export type OrderPaidPublic = z.infer<typeof orderPaidPublicSchema>

export const toPublic = (e: OrderPaid): OrderPaidPublic => ({
  id: e.messageId, orderId: e.orderId,
  lines: e.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice })),
  total: e.total, paidAt: e.paidAt,
})

// packages/shop/index.ts
export { orderPaidPublicSchema, type OrderPaidPublic } from "./published/order-paid"
```

OrderPaid is now stated twice (DOM-3), and `toPublic` is the translation layer that keeps the two aligned. Shop adds `discount` to `orderLineSchema` and writes it into the message; `toPublic` maps fields by name, so the compiler is silent and the public schema never carries it. Billing's invoice totals stop matching the orders, and the drift is found when a customer complains, not when the field was added. Every downstream that wants the discount then waits for shop to extend the public schema and its mapping, which is the drift SYS-2's Why describes.
