---
breaches: []
satisfies: [TX-3, TX-1, TX-6]
situation: shop checkout returns Stripe client_secret in the same request
---

# Checkout asks payment for a checkout session, which changes nothing of payment's

```ts
// shop/service/checkout.ts
type Deps = { transaction: TransactionPort; carts: CartRepository; orders: OrderRepository; outbox: ShopOutbox; sessions: CheckoutSessions }
// CheckoutSessions: shop's driven port; assembly hands in payment's requestCheckoutSession (ASM-2)

export const createCheckout =
  ({ transaction, carts, orders, outbox, sessions }: Deps): Checkout =>
  async ({ cartId, customerId, locale }) => {
    const order = await transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId)
      await orders.save(order, tx)
      await carts.save(clearCart(cart), tx)
      await outbox.write(orderPlaced(order), tx)
      await outbox.write(sendOrderConfirmation(order, locale), tx)
      return order
    })
    // after commit: a request, not a change; payment stores nothing until Stripe's webhook
    const { clientSecret } = await sessions.request({ orderId: order.id, amount: order.total, expiresAt: order.paymentDeadline })
    return { orderId: order.id, clientSecret }
  }
```

The browser needs the `client_secret` in this response, so checkout asks payment for it
synchronously. That is no change to payment's data: `requestCheckoutSession` is a tentative
operation, a Stripe Checkout Session that commits nobody to anything, and payment records nothing
until Stripe's webhook confirms a payment (`tx-22-ok-payment-requests-checkout-session.md`). TX-3's
Scope, a change to data another system holds, does not hold for the request, and the order and
its messages commit in shop's one transaction before it. If the request fails, the order stays
placed and unpaid, and the payment deadline it carries cancels it; a session nobody pays expires
on the same deadline.
