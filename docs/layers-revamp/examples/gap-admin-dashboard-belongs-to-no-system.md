---
breaches: []
satisfies: []
situation: the admin dashboard joins orders, invoices and shipments; it is no system and owns nothing
finding: gap
---

# The dashboard reads three open host services and joins in memory

```tsx
// apps/admin/app/orders/page.tsx — a server component; no system, no domain, no aggregate, no builder
import { courier } from "@teeladen/common"
import type { ShopQueries } from "@teeladen/shop"
import type { BillingQueries } from "@teeladen/billing"
import type { FulfillmentQueries } from "@teeladen/fulfillment"

type Upstreams = { shop: ShopQueries; billing: BillingQueries; fulfillment: FulfillmentQueries }

export default async function OrdersPage() {
  const { shop, billing, fulfillment } = courier.read<Upstreams>()
  const orders = await shop.listOrders({ placedAfter: daysAgo(30) })
  const orderIds = orders.map((o) => o.id)
  const [invoices, shipments] = await Promise.all([
    billing.invoicesForOrders({ orderIds }),
    fulfillment.shipmentsForOrders({ orderIds }),
  ])
  const rows = orders.map((o) => ({
    orderId: o.id,
    status: o.status,
    invoiceNumber: invoices.find((i) => i.orderId === o.id)?.number ?? null,
    shippedAt: shipments.find((s) => s.orderId === o.id)?.shippedAt ?? null,
  }))
  return <OrdersTable rows={rows} />
}
```

This is what the breach example `sys-9-breach-dashboard-imports-drizzle-tables.md` points
toward, and the rules it breaches are silent here: TX-12 begins "a use case of this system",
SYS-9 "code of one system", SYS-3 "a downstream system", and the dashboard is no system under
the glossary. It has no domain, no aggregate, no builder, and nothing is its upstream in the
glossary's sense. The breach example holds only by treating it as a system, which no rule says
it is. The in-memory join, paging across three systems, and the alternative TX-13 offers, a read
model fed by three systems' messages, which needs an aggregate and so a system, are all outside
any Scope. A reader wants ruled whether a cross-cutting read is a system of its own, owing
SYS-5, SYS-7 and a builder, or sits outside the layers like assembly and the common library
(general-rules Assumptions), and in that case whether it may read the stores.
