---
breaches: [ASM-2]
satisfies: [SYS-9]
situation: shop calls billing's open host service in-process
---

# Shop's service builds billing and calls it

```ts
// packages/shop/service/order-details.ts
import { buildBillingOpenHostService } from "@teeladen/billing/build"
import { db } from "@teeladen/common/postgres"
import type { OrderRepository } from "../service/ports/order-repository"

export type OrderDetails = (input: { orderId: string }) => Promise<{ order: Order; invoice: Invoice | null }>

export const createOrderDetails =
  (orders: OrderRepository): OrderDetails =>
  async ({ orderId }) => {
    const order = await orders.byId(orderId)
    if (!order) throw new OrderNotFound(orderId)
    const billing = buildBillingOpenHostService({ db })
    const invoice = await billing.invoiceForOrder({ orderId })
    return { order, invoice }
  }
```

Everything is imported from export paths (SYS-9), and the call is one function call, so it looks like the cheap in-process integration the fixture asks for. But shop has decided in-process for good: there is no driven port to give another implementation, so moving billing out of process rewrites this service, and shop's test of `createOrderDetails` runs billing's real builder against the real database. The builder is also built in place on every call instead of received (ASM-2): a second billing, a second set of its adapters, per request.
