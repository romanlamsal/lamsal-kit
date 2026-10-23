---
breaches: []
satisfies: [SYS-5]
situation: billing creates an invoice on shop's OrderPaid message
---

# Billing's invoice is built from shop's OrderPaid untranslated

```ts
// packages/billing/domain/invoice.ts
import { orderLineSchema, type OrderPaid } from "@teeladen/shop"
import { moneySchema } from "@teeladen/kernel"

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),       // gapless; billing's rule
  orderId: z.string().uuid(),
  lines: z.array(orderLineSchema),           // shop's schema, in billing's domain
  total: moneySchema,
  issuedAt: z.string().datetime(),
})
export type Invoice = z.infer<typeof invoiceSchema>

export const invoiceFor = (event: OrderPaid, id: string, number: number, issuedAt: Date): Invoice => ({
  id,
  number,
  orderId: event.orderId,
  lines: event.lines,
  total: event.total,
  issuedAt: issuedAt.toISOString(),
})
```

Shop offers an open host service in a published language this codebase writes, so billing takes it as it is: `orderLineSchema` and `OrderPaid` sit in billing's domain, and `invoiceFor` copies the lines (DOM-4) without a port whose types repeat shop's field for field. Shop's terms in billing's domain are the design working. When shop adds a `discount` to `orderLineSchema`, the invoice lines carry it at once, and every place billing's rules need to look at it is a compile error in this codebase, not a runtime surprise.
