---
breaches: [TX-10]
satisfies: []
situation: shop's Order repository is called by a use case that writes only the Order
---

# `save` without a transaction issues the header insert and each line insert as its own commit

```ts
// shop/driven/drizzle/order-repository.ts
export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  save: async (order, tx) => {
    const conn = tx ? asDrizzle(tx) : db          // no tx: plain client, autocommit per statement
    await conn
      .insert(orders)
      .values(toOrderRow(order))
      .onConflictDoUpdate({ target: orders.id, set: toOrderRow(order) })
    await conn.delete(orderLines).where(eq(orderLines.orderId, order.id))
    for (const line of order.lines) {
      await conn.insert(orderLines).values(toLineRow(order.id, line))
    }
  },
})

// shop/service/update-shipping-address.ts
await orders.save(withShippingAddress(order, address))   // no transaction handed: one aggregate, nothing to join
```

The `tx ? … : db` fallback looks like TX-2 done right, and when a transaction is handed in it is. When
none is, every statement commits by itself: the header lands, the delete empties the lines, and a
connection drop on the second insert leaves an Order with one line of three, a record the domain's
`placeOrder` never produced and no rule can explain. The service that called `save` wrote one
aggregate and rightly opened nothing; the repository was the one place that knew the save takes N+2
statements, and it let them commit one by one.
