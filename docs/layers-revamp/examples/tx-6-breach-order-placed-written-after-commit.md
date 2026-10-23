---
breaches: [TX-6]
satisfies: []
situation: shop places the order and publishes OrderPlaced
---

# OrderPlaced goes to the outbox after the order's transaction committed

```ts
// shop/service/place-order.ts
export const createPlaceOrder =
  ({ transaction, carts, orders, outbox }: Deps): PlaceOrder =>
  async ({ cartId, customerId, locale }) => {
    const order = await transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId)
      await orders.save(order, tx)
      await carts.clear(cart.id, tx)
      return order
    })
    // publish only once we know the order is really in: never announce an order that rolled back
    await outbox.write(orderPlaced(order))
    await outbox.write(sendOrderConfirmation(order, locale))
    return { orderId: order.id }
  }
```

The intent is sound, the message must not survive a rollback, but the fix moves the write past the
commit, and between the two the process can die, the pod can be evicted, the outbox insert can fail. The
order is committed and nothing tells of it: fulfillment reserves nothing, the customer gets no mail, and
when the payment deadline passes shop publishes an `OrderCancelled` for an order fulfillment has never
heard of. Written with `tx` inside `run`, the message would be exactly as committed as the order.
