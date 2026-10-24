---
breaches: []
satisfies: [SYS-2, SYS-10]
situation: shop publishes OrderPlaced, OrderPaid, OrderCancelled; billing and fulfillment parse them
---

# Shop's published messages: a union of their own, translated to by shop's services

```ts
// packages/shop/published/messages.ts  (imports zod and the shared kernel, nothing of shop's domain)
import { moneySchema, skuSchema } from "@teeladen/kernel"

const line = z.object({ sku: skuSchema, quantity: z.number().int().positive(), unitPrice: moneySchema })
const envelope = { messageId: z.string().uuid(), orderId: z.string().uuid() }

export const shopMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OrderPlaced"), ...envelope, lines: z.array(line), total: moneySchema }),
  z.object({ type: z.literal("OrderPaid"), ...envelope, total: moneySchema, paidAt: z.string().datetime() }),
  z.object({ type: z.literal("OrderCancelled"), ...envelope, reason: z.enum(["payment_failed", "deadline_passed", "customer"]) }),
])
export type ShopMessage = z.infer<typeof shopMessageSchema>
export type OrderPaid = Extract<ShopMessage, { type: "OrderPaid" }>

// packages/shop/service/translate/order-paid.ts  (the service translates, SVC-6)
import type { Order } from "../../domain/order"
import type { OrderPaid } from "../../published/messages"

export const toOrderPaid = (order: Order, messageId: string): OrderPaid => ({
  type: "OrderPaid", messageId, orderId: order.id, total: order.total, paidAt: order.paidAt.toISOString(),
})

// packages/billing/driving/handlers.ts
import { shopMessageSchema } from "@teeladen/shop"
```

The published messages are one standalone union in shop's published language, with no import of
shop's domain, so a linter checks SYS-2 by the path. Billing parses with the union, and the type
narrows on `type`. When shop splits `unitPrice` in its domain for a pricing rule, `toOrderPaid`
and its sibling for `OrderPlaced` fail to compile, and shop decides there whether the contract
changes; until it does, the messages keep their shape and the outbox stays readable (TX-7).
Loading `@teeladen/shop` loads zod, the kernel and this file.
