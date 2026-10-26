---
breaches: []
satisfies: [SVC-7, TX-1]
situation: the customer's account page lists their orders with line count and total
---

# The order overview is a driven port returning rows; the join lives in its adapter

```ts
// shop/service/ports/order-overview-query.ts — driven port, shop's terms
export type OrderOverviewRow = { orderId: string; placedAt: string; status: OrderStatus; lineCount: number; total: Money }
export interface OrderOverviewQuery {
  forCustomer(customerId: string): Promise<OrderOverviewRow[]>
}

// shop/service/order-overview.ts — answering use case
export const createOrderOverview =
  ({ overview }: { overview: OrderOverviewQuery }): OrderOverview =>
  ({ customerId }) => overview.forCustomer(customerId)

// shop/drizzle/order-overview-query.ts — driven adapter
export const drizzleOrderOverviewQuery = (db: Database): OrderOverviewQuery => ({
  forCustomer: (customerId) =>
    db.select({ orderId: orders.id, placedAt: orders.placedAt, status: orders.status,
                lineCount: count(orderLines.id), total: orders.total })
      .from(orders).leftJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(eq(orders.customerId, customerId)).groupBy(orders.id),
})
```

The list skips the `Order` aggregate: loading every order whole to count its lines would be work
for nothing, and no business rule decides here. The read still reaches the store through a port: the
service knows rows in shop's terms, the join and the table names sit in the Drizzle adapter, and the
service's test hands it a fake `OrderOverviewQuery` returning two rows. The use case answers and
writes nothing, so it holds no transaction (TX-1).
