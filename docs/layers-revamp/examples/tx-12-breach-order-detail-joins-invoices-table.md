---
breaches: [TX-12, SYS-9]
satisfies: []
situation: shop's order detail page shows the invoice number billing issued
---

# Shop's Order repository joins billing's `invoices` table in the one Postgres

```ts
// shop/driven/drizzle/order-repository.ts
import { invoices } from "../../../../billing/src/driven/drizzle/schema"   // same database, the table is right there

export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  // ...
  detailById: async (orderId) => {
    const rows = await db
      .select({
        order: orders,
        invoiceNumber: invoices.number,
        invoiceStatus: invoices.status,
        dunningStage: invoices.dunningStage,
      })
      .from(orders)
      .leftJoin(invoices, eq(invoices.orderId, orders.id))
      .where(eq(orders.id, orderId))
    return rows.length === 0 ? null : toOrderDetail(rows)
  },
})
```

Shop now reads billing's storage, not billing's offer. Billing issues a corrective invoice and marks the
first `status = "cancelled"`; the join returns two rows and shop shows whichever `toOrderDetail` picks,
because the rule for which invoice is the current one is billing's and was never asked. When billing
moves `dunning_stage` into its own table, shop's page breaks the day the migration runs, and the deep
import into billing's adapter folder ties shop to billing's file layout besides.
