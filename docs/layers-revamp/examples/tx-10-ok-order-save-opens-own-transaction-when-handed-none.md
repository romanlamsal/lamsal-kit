---
breaches: []
satisfies: [TX-10, TX-2]
situation: shop's Order repository is called by a use case that writes only the Order
---

# `save` without a transaction wraps all of the aggregate's rows in one of its own

```ts
// shop/driven/drizzle/order-repository.ts
export const createDrizzleOrderRepository = (db: Db): OrderRepository => ({
  save: async (order, tx) => {
    const write = async (d: DrizzleConn) => {
      await d
        .insert(orders)
        .values(toOrderRow(order))
        .onConflictDoUpdate({ target: orders.id, set: toOrderRow(order) })
      await d.delete(orderLines).where(eq(orderLines.orderId, order.id))
      if (order.lines.length > 0) {
        await d.insert(orderLines).values(order.lines.map((l) => toLineRow(order.id, l)))
      }
    }
    if (tx) return write(asDrizzle(tx))     // handed one: join it (TX-2)
    await db.transaction(write)             // handed none: the aggregate still lands whole (TX-10)
  },
})

// shop/service/update-shipping-address.ts  — writes the Order alone, so it hands no transaction
export const createUpdateShippingAddress =
  ({ orders }: Deps): UpdateShippingAddress =>
  async ({ orderId, address }) => {
    const order = await orders.byId(orderId)
    if (!order) throw new OrderNotFound(orderId)
    await orders.save(withShippingAddress(order, address))
  }
```

An Order is one header row and N line rows, and the repository is the only code that knows that. Called
without a transaction, `save` opens one around the whole write, so a failing line insert leaves no
half-replaced Order: the delete and the inserts land together or not at all. The service writing one
aggregate did not need to open anything, and the one that writes several hands its own in and gets the
same statements inside it.
