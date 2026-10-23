---
breaches: [SVC-3, TX-14]
satisfies: []
situation: shop's placeOrder reuses the clearCart service
---

# `placeOrder` calls the `clearCart` service

```ts
// shop/service/clear-cart.ts
export const createClearCart =
    ({ carts, transactions }: ClearCartDeps): ClearCart =>
    async ({ cartId }) => {
        const cart = await carts.findById(cartId)
        if (!cart) throw new CartNotFound(cartId)
        await transactions.run((tx) => carts.save(clearCart(cart), tx))
    }

// shop/service/place-order.ts
export const createPlaceOrder =
    ({ orders, outbox, transactions, clearCart }: PlaceOrderDeps): PlaceOrder =>
    async (input) => {
        const cart = await carts.findById(input.cartId)
        const order = placeOrderFromCart(cart, input.shippingAddress, input.placedAt)
        await transactions.run(async (tx) => {
            await orders.save(order, tx)
            await outbox.write(orderPlaced(order), tx)
            await clearCart({ cartId: input.cartId })   // its own transaction, inside ours
        })
        return order
    }
```

`clearCart` exists and does exactly what is needed, so the developer injects it rather than repeat two lines. The inner service opens its own transaction: the cart is cleared and committed while the outer transaction is still open, and when the order insert fails on a constraint and the outer transaction rolls back, the customer has no order and an empty cart. The inner call also retries on nothing of its own, and the use case's writes, one of which TX-14 wants together, now land in two transactions.
