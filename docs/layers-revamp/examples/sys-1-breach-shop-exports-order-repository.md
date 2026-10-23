---
breaches: [SYS-1, TX-12]
satisfies: [SYS-9]
situation: shop exports its order repository so billing's dunning can load the order
---

# Shop's export path hands out a repository and its adapter

```ts
// packages/shop/index.ts
export * from "./domain/schemas"
export type { PlaceOrder } from "./service/place-order"
// dunning needs the order's customer and total; expose the repository
export type { OrderRepository } from "./domain/ports/order-repository"
export { drizzleOrderRepository } from "./adapters/drizzle/order-repository"

// packages/billing/service/run-dunning.ts
import type { OrderRepository } from "@teeladen/shop"
import type { InvoiceRepository } from "../domain/ports/invoice-repository"

export const createRunDunning =
  (invoices: InvoiceRepository, orders: OrderRepository): RunDunning =>
  async ({ asOf }) => {
    for (const invoice of await invoices.overdue(asOf)) {
      const order = await orders.byId(invoice.orderId)
      if (!order) continue
      // escalate the dunning stage by order.customer and order.total ...
    }
  }

// apps/server/assembly.ts
const billing = buildBillingOpenHostService({ invoices: drizzleInvoiceRepository(db), orders: drizzleOrderRepository(db) })
```

Billing imports from an export path, so SYS-9 holds and a linter on import paths sees nothing; what it imported is a driven port and a driven adapter, shop's inside. The harm from SYS-1's Why follows: when shop splits the order's customer into its own table or changes `byId`'s shape, billing's dunning breaks, and shop changes its downstream in order to change its own adapter. Billing also reads shop's data past shop's open host service (TX-12): an order whose payment deadline has passed, which shop's rules treat as cancelled, reads here as an order to dun.
