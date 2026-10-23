---
breaches: [TX-3]
satisfies: []
situation: shop checkout returns Stripe client_secret in the same request
finding: cannot-comply
---

# Checkout must return a client_secret, so it calls payment instead of writing a message

```ts
// shop/service/checkout.ts
type Deps = { transaction: TransactionPort; carts: CartRepository; orders: OrderRepository; outbox: ShopOutbox; payments: PaymentRequests }
// PaymentRequests: shop's driven port; assembly hands in payment's createPayment service (SYS-3)

export const createCheckout =
  ({ transaction, carts, orders, outbox, payments }: Deps): Checkout =>
  async ({ cartId, customerId, locale }) => {
    const order = await transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId)
      await orders.save(order, tx)
      await carts.clear(cart.id, tx)
      await outbox.write(orderPlaced(order), tx)
      await outbox.write(sendOrderConfirmation(order, locale), tx)
      return order
    })
    // outside the transaction, after commit: a Payment is payment's aggregate, and this creates one
    const { clientSecret } = await payments.create({ orderId: order.id, amount: order.total })
    return { orderId: order.id, clientSecret }
  }
```

A Payment is payment's aggregate, so creating one is a change to data another system owns and TX-3
wants a message in shop's outbox. A message is handled later, in another transaction and possibly
another process, and nothing comes back to the request that wrote it; the browser needs the
`client_secret` in this response. The call is kept outside shop's transaction, so a failed call leaves
a committed order and no payment, and the saga's deadline (domain.md step 5) cancels it; that is the
protection, but the Statement has no room for it. Shop cannot comply with TX-3 for this use case.
