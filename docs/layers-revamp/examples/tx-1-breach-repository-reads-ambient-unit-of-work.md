---
breaches: [TX-1, ASM-9]
satisfies: []
situation: shop's common library keeps an ambient unit of work in AsyncLocalStorage
---

# Repositories pick the transaction up from AsyncLocalStorage

```ts
// shop/service/place-order.ts
export const createPlaceOrder =
  ({ unitOfWork, carts, orders, outbox }: Deps): PlaceOrder =>
  async ({ cartId, customerId }) =>
    unitOfWork.run(async () => {            // opens a transaction into AsyncLocalStorage, hands nothing over
      const cart = await carts.byId(cartId)
      const order = placeOrder(cart, customerId)
      await orders.save(order)
      await carts.clear(cart.id)
      await outbox.write(orderPlaced(order))
    })

// shop/driven/drizzle/order-repository.ts
export const createDrizzleOrderRepository = (db: Db, unitOfWork: UnitOfWork): OrderRepository => ({
  save: async (order) => {
    const conn = unitOfWork.current() ?? db   // whatever the caller happened to open, or autocommit
    await conn.insert(orders).values(toOrderRow(order))
    await conn.insert(orderLines).values(order.lines.map((l) => toLineRow(order.id, l)))
  },
  byId: async (id) => toOrder(await (unitOfWork.current() ?? db).query.orders.findFirst({ where: eq(orders.id, id) })),
})
```

The service opened the transaction but hands it to nobody; each repository method reads it from the
ambient store, so which writes land together is decided by what happens to be in `AsyncLocalStorage`
when the method runs, not by the service. The `?? db` fallback is the harm in TX-1's Why: a repository
called from a handler, or from a test that opened nothing, silently autocommits each statement, and
the signature shows no difference. It is also how billing's repositories, called in-process from a shop
service, join shop's transaction without either system asking for it.
