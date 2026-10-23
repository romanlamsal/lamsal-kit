---
breaches: [TX-14]
satisfies: []
situation: shop places the order and clears the cart
---

# The Order commits in its transaction; the Cart is cleared by a second call afterwards

```ts
// shop/service/place-order.ts
export const createPlaceOrder =
  ({ transaction, carts, orders, outbox }: Deps): PlaceOrder =>
  async ({ cartId, customerId, locale }) => {
    const cart = await carts.byId(cartId)
    if (!cart) throw new CartNotFound(cartId)
    const order = placeOrder(cart, customerId)
    await transaction.run(async (tx) => {
      await orders.save(order, tx)
      await outbox.write(orderPlaced(order), tx)
      await outbox.write(sendOrderConfirmation(order, locale), tx)
    })
    // the cart is the customer's scratch space; clearing it is housekeeping, keep it out of the order's transaction
    await carts.clear(cart.id)
    return { orderId: order.id }
  }
```

Order and Cart are both shop's aggregates and both change in this use case. The clear runs after the
commit as its own write, so a dropped connection or a crashed process between the two leaves the order
placed and the cart full: the customer sees the same cart, presses "order" again, and shop has two
orders, two `OrderPlaced`, two reservations for one purchase. That the cart still showing is not harmless
is what keeps this out of TX-15's Scope; the clear belongs inside `run`, handed the same `tx`.
