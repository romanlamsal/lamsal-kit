---
breaches: [DRV-1]
satisfies: []
situation: shop checkout must return a Stripe client_secret in the same request; payment creates it
---

# Checkout server action calls `placeOrder`, then payment

```ts
// app/checkout/actions.ts  (driving adapter)
export async function checkoutAction(form: FormData) {
    const { placeOrder } = shopServices()
    const { createPaymentForOrder } = paymentServices()   // payment's open host service
    const input = placeOrderInputSchema.parse(Object.fromEntries(form))

    const order = await placeOrder({ ...input, placedAt: new Date() })

    try {
        const payment = await createPaymentForOrder({
            orderId: order.id,
            amount: orderTotal(order),
        })
        return { orderId: order.id, clientSecret: payment.clientSecret }
    } catch (err) {
        // order is placed; what now? cancel it? leave it for the deadline?
        return { orderId: order.id, error: "payment unavailable" }
    }
}
```

The browser needs the `client_secret` in this response and two systems are involved, so the action calls both. The `catch` is where the use case grows inside the adapter: when payment is down after the order committed, whether to cancel, leave the order for the deadline, or let the customer retry is a decision the adapter makes alone, without a transaction and with no retry. A second way in, a "pay again" button on the order page, has to make it a second time, differently, and the order-then-pay sequence that the checkout saga describes lives in a route file nobody tests.
