---
breaches: [SVC-7]
satisfies: [ASM-2, SVC-6]
situation: the customer's account page lists their orders with line count and total
---

# The overview service is handed the Drizzle client and queries with it

```ts
// shop/service/order-overview.ts
import type { Database } from "@teeladen/common/postgres"      // the common library's store client
import { orders, orderLines } from "@teeladen/common/postgres/schema"

export const createOrderOverview =
  ({ db }: { db: Database }): OrderOverview =>                  // received from assembly, as ASM-2 asks
  ({ customerId }) =>
    db.select({ orderId: orders.id, status: orders.status, lineCount: count(orderLines.id), total: orders.total })
      .from(orders).leftJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(eq(orders.customerId, customerId)).groupBy(orders.id)
```

Every import is the common library, which SVC-6 lists, and the client arrives from the caller, as
ASM-2 has it. The service still reaches the store through no port. Shop's table names and Drizzle's
query builder are in the service; renaming a column breaks a use case, and the service's test needs
a database where a fake overview port would do. The next use case written beside it does the same
for a write, past the repository.
