---
breaches: []
satisfies: [SYS-2]
situation: shop's published messages and its private mail message
---

# Shop's published language is its domain re-exported, private message left out

```ts
// packages/shop/domain/messages.ts
import { moneySchema } from "@teeladen/kernel"
import { orderLineSchema } from "./schemas"

const envelope = { messageId: z.string().uuid(), orderId: z.string().uuid() }
export const orderPlacedSchema = z.object({ ...envelope, lines: z.array(orderLineSchema), total: moneySchema })
export const orderPaidSchema = z.object({ ...envelope, lines: z.array(orderLineSchema), total: moneySchema, paidAt: z.string().datetime() })
export const orderCancelledSchema = z.object({ ...envelope, reason: z.enum(["payment_failed", "deadline_passed", "customer"]) })

// private: only shop's own handler sends the confirmation mail
export const sendOrderConfirmationSchema = z.object({ ...envelope, recipient: z.string().email(), locale: z.string() })

// packages/shop/index.ts
export { orderSchema, cartSchema, orderLineSchema, productCommercialSchema } from "./domain/schemas"
export { orderPlacedSchema, orderPaidSchema, orderCancelledSchema } from "./domain/messages"
export type { Order, Cart, OrderLine, ProductCommercial } from "./domain/schemas"
export type { OrderPlaced, OrderPaid, OrderCancelled } from "./domain/messages"
```

The schema billing parses `OrderPaid` with is the object shop's service built the message from: one statement, no translation between them. `sendOrderConfirmationSchema` is a private message and is not on the path, so shop can rename `recipient` or add a required field without owing anyone TX-7's compatibility. `orderLineSchema` is exported too, because the messages re-use it and a downstream needs it to read them.
