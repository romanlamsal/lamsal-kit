---
breaches: [SYS-9, TX-12]
satisfies: []
situation: the admin dashboard joins orders, invoices and shipments in the one Postgres
---

# The dashboard deep-imports three systems' Drizzle tables

```ts
// apps/admin/dashboard/orders-overview.ts
import { eq } from "drizzle-orm"
import { orders } from "../../../packages/shop/src/adapters/drizzle/schema"
import { invoices } from "../../../packages/billing/src/adapters/drizzle/schema"
import { shipments } from "../../../packages/fulfillment/src/adapters/drizzle/schema"
import { db } from "../db"

export const ordersOverview = () =>
  db
    .select({
      orderId: orders.id,
      status: orders.status,
      invoiceNumber: invoices.number,
      shippedAt: shipments.shippedAt,
    })
    .from(orders)
    .leftJoin(invoices, eq(invoices.orderId, orders.id))
    .leftJoin(shipments, eq(shipments.orderId, orders.id))
    .orderBy(orders.placedAt)
```

The three tables sit in one database and Drizzle's table objects are one auto-import away, so the join writes itself. Each import holds the file layout it found: fulfillment moving its schema file into a `postgres/` folder breaks the dashboard's build, and shop's driven adapter is now something three teams depend on. The dashboard also reads data the three systems own past their open host services (TX-12): `orders.status` is a column, and an order whose payment deadline has passed, cancelled by shop's rules, shows as open here because the rule that decides that lives in shop's domain, not in the column. A linter on import paths would have flagged all three lines in the diff.
