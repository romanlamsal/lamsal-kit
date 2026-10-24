---
breaches: [SYS-2]
satisfies: []
situation: shop publishes OrderPaid; billing issues the invoice from it
---

# The public OrderPaid stands apart, and its module imports the domain to translate

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

The public schema is hand-written apart from the domain's, as SYS-2's Why asks, and `toPublic` is
the translation. But it sits in the published-language module and takes the domain's `OrderPaid`,
so the module that declares the contract imports the domain, and every downstream that loads the
contract's path depends on shop's model again. Shop renames `unitPrice` in `orderLineSchema` for a
pricing rule: the published-language module fails to compile and has to change in the same commit
as a refactoring that changed nothing shop publishes. Built in shop's service from the `Order`,
the translation would fail there instead, in the code that decides what shop publishes, and the
published language would stay a module of zod and the shared kernel.
