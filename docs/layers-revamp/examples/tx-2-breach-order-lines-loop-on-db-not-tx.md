---
breaches: [TX-2]
satisfies: []
situation: shop saves an Order with lines
---

# The header row joins the transaction, the lines loop writes on `db`

```ts
// shop/driven/drizzle/order-repository.ts
export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  save: async (order, tx) => {
    const conn = tx ? asDrizzle(tx) : db
    await conn
      .insert(orders)
      .values(toOrderRow(order))
      .onConflictDoUpdate({ target: orders.id, set: toOrderRow(order) })
    await replaceLines(db, order)                     // extracted last sprint; takes `db`, not `conn`
  },
})

const replaceLines = async (db: Db, order: Order) => {
  await db.delete(orderLines).where(eq(orderLines.orderId, order.id))
  for (const line of order.lines) {
    await db.insert(orderLines).values(toLineRow(order.id, line))   // one autocommit per line
  }
}
```

`save` takes the transaction and writes the header inside it, then the lines go out through `db`, each
insert committing on its own. When the service's transaction rolls back, the order row vanishes and the
lines stay, pointing at an order that does not exist; when the third insert fails, the first two are
already committed and the handed transaction's rollback cannot reach them. This is the small edit TX-2's
Why names: a write moved into a helper that took `db` and got a transaction per statement.
