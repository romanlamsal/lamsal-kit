---
breaches: []
satisfies: [SVC-3, TX-1, TX-14, TX-6]
situation: shop places an order, clears the cart and sends the confirmation mail once the order commits
---

# `placeOrder` writes Order and Cart through repositories; the mail follows by message

```ts
// shop/service/place-order.ts
export const createPlaceOrder =
    ({ orders, carts, outbox, transactions }: PlaceOrderDeps): PlaceOrder =>
    async (input) => {
        const cart = await carts.findById(input.cartId)
        if (!cart) throw new CartNotFound(input.cartId)
        const order = placeOrderFromCart(cart, input.shippingAddress, input.placedAt)

        await transactions.run(async (tx) => {
            await orders.save(order, tx)
            await carts.save(clearCart(cart), tx)
            await outbox.write(orderPlaced(order), tx)                   // published
            await outbox.write(sendOrderConfirmation(order), tx)         // private command
        })
        return order
    }

// shop/handlers/send-order-confirmation.ts  (handler, in its own transaction)
export const createSendOrderConfirmationHandler =
    ({ mail }: { mail: MailSender }) =>
    async (msg: SendOrderConfirmation) => { await mail.sendOrderConfirmation(toConfirmation(msg)) }
```

Clearing the cart is also a use case of its own, reachable from the cart page, but `placeOrder` does not call that service: both call `carts.save` inside their own transaction and the domain's `clearCart` decides what the write is. The confirmation mail follows the order by a private message written in the same transaction, so it goes out once the order commits and is retried by redelivery if the mail provider is down, instead of being a nested call with no retry.
