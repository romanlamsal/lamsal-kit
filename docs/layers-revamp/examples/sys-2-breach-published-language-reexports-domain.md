---
breaches: [SYS-2]
satisfies: []
situation: shop's published messages, re-exported from its domain
---

# Shop's published language is its domain's schemas, re-exported

```ts
// packages/shop/domain/messages.ts
import { moneySchema } from "@teeladen/kernel"
import { orderLineSchema } from "./schemas"

const envelope = { messageId: z.string().uuid(), orderId: z.string().uuid() }
export const orderPlacedSchema = z.object({ ...envelope, lines: z.array(orderLineSchema), total: moneySchema })
export const orderPaidSchema = z.object({ ...envelope, lines: z.array(orderLineSchema), total: moneySchema, paidAt: z.string().datetime() })
export const orderCancelledSchema = z.object({ ...envelope, reason: z.enum(["payment_failed", "deadline_passed", "customer"]) })

// packages/shop/published/index.ts
export { orderSchema, cartSchema, orderLineSchema } from "../domain/schemas"
export { orderPlacedSchema, orderPaidSchema, orderCancelledSchema } from "../domain/messages"
export type { Order, Cart, OrderLine } from "../domain/schemas"
export type { OrderPlaced, OrderPaid, OrderCancelled } from "../domain/messages"
```

The schema billing parses `OrderPaid` with is the object shop's service built the message from:
one statement, no translation, which is why it gets written. It makes the domain the contract.
Shop splits `OrderLine`'s `unitPrice` into `listPrice` and `discount` for a new pricing rule, a
refactoring inside shop's model, and the change lands in `orderPaidSchema` and on every
downstream at once: billing's handler and every message waiting in the outbox now need versions
(TX-7) for a change nobody made to the contract. `orderSchema` and `cartSchema` are exported too,
so the next refactoring of the cart reaches whoever started parsing with them.
