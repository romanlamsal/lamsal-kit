---
breaches: [SVC-7]
satisfies: [ASM-2, SVC-6]
situation: the customer's account page lists their orders with line count and total
---

# The overview service is handed the Drizzle client and queries with it

```ts
// shop/service/order-overview.ts
import { sql, type Database } from "@teeladen/common/postgres"  // the common library's store client and its query tag

export const createOrderOverview =
  ({ db }: { db: Database }): OrderOverview =>                  // received from assembly, as ASM-2 asks
  async ({ customerId }) => {
    const { rows } = await db.execute<OrderOverviewRow>(sql`
      select o.id as "orderId", o.status, count(l.id)::int as "lineCount", o.total
      from orders o left join order_lines l on l.order_id = o.id
      where o.customer_id = ${customerId}
      group by o.id`)
    return rows
  }
```

Every import is the common library, which SVC-6 lists, and the client arrives from the caller, as
ASM-2 has it. The service still reaches the store through no port of shop's. Shop's table and column
names and the SQL are in the service; renaming a column breaks a use case, and the service's test
needs a database where a fake overview port would do. The next use case written beside it does the
same for a write, past the repository.
