---
breaches: [SYS-5]
satisfies: []
situation: billing creates an invoice on shop's OrderPaid message
---

# Billing translates OrderPaid into a copy of itself

```ts
// packages/billing/domain/order-paid.ts — "keep shop's types out of billing"
export const billingOrderPaidSchema = z.object({
  orderId: z.string().uuid(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int(), unitPrice: moneySchema })),
  total: moneySchema,
  paidAt: z.string().datetime(),
})
export type BillingOrderPaid = z.infer<typeof billingOrderPaidSchema>

// packages/billing/driving/handle-order-paid.ts — handler
import { orderPaidSchema, type OrderPaid } from "@teeladen/shop"

const translate = (e: OrderPaid): BillingOrderPaid => ({
  orderId: e.orderId,
  lines: e.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice })),
  total: e.total,
  paidAt: e.paidAt,
})

export const handleOrderPaid = (issueInvoice: IssueInvoice) => async (message: Message) => {
  await issueInvoice({ messageId: message.id, ...translate(orderPaidSchema.parse(message.body)) })
}
```

Shop is an upstream of this codebase with an open host service, and billing has put a layer in front of it anyway: a schema that copies shop's field for field and a mapping of each field to itself. It changes nothing and costs a module. Worse, it hides change: shop adds `discount` to its order lines and `translate` keeps compiling because it names the fields it copies, so billing's invoices silently ignore the discount. Under the conformist the same change would land as compile errors in billing. This is a SHOULD, and no ADR names SYS-5 and says what protects against that.
