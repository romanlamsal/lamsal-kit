---
breaches: []
satisfies: [SYS-9]
situation: billing's handler parses shop's OrderPaid message
---

# Billing imports OrderPaid from shop's export path

```ts
// packages/billing/driving/handle-order-paid.ts — handler
import { orderPaidSchema, type OrderPaid } from "@teeladen/shop"
import type { Message } from "@teeladen/common/bus"
import type { IssueInvoice } from "../service/issue-invoice"

export const handleOrderPaid =
  (issueInvoice: IssueInvoice) =>
  async (message: Message): Promise<void> => {
    const event: OrderPaid = orderPaidSchema.parse(message.body)
    await issueInvoice({
      messageId: message.id,
      orderId: event.orderId,
      lines: event.lines,
      total: event.total,
      paidAt: event.paidAt,
    })
  }
```

`@teeladen/shop` is shop's export path for its published language; the handler gets the schema shop's own service built the message with, and nothing of shop's inside. Shop is free to move `orderPaidSchema` between files, rename its domain folders or split its package: the path is the promise, and billing's import does not change. The schema is used untranslated: billing conforms.
