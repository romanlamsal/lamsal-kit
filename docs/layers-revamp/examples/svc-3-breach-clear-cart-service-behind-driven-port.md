---
breaches: [SVC-3]
satisfies: [DOM-5, SVC-5, ASM-2]
situation: shop places the order and clears the cart
finding: adversarial
---

# `placeOrder` calls `clearCart` through a driven port assembly implements with the service

```ts
// shop/domain/ports/cart-clearing.ts  (a driven port, declared in the domain)
export interface CartClearing {
    clear(input: { cartId: string }): Promise<void>
}

// shop/service/place-order.ts
export const createPlaceOrder =
    ({ orders, outbox, transactions, cartClearing }: PlaceOrderDeps): PlaceOrder =>
    async ({ cartId, customerId }) => {
        const cart = await carts.byId(cartId)
        const order = placeOrder(cart, customerId)
        await transactions.run(async (tx) => {
            await orders.save(order, tx)
            await outbox.write(orderPlaced(order), tx)
        })
        await cartClearing.clear({ cartId })          // a driven port, like the mailer
        return { orderId: order.id }
    }

// shop/builders/open-host-service.ts  (assembly wires the port to the other service)
const clearCart = createClearCart({ carts, transactions })
const placeOrder = createPlaceOrder({ orders, outbox, transactions, cartClearing: { clear: clearCart } })
```

`placeOrder` calls no service: it calls `cartClearing`, a driven port declared in the domain and received through the factory, and only assembly knows that the implementation is `clearCart`. The Why's harm is exactly what happens: `clearCart` opens a transaction of its own, so the order commits and the cart survives when the second transaction fails, and the use case has no retry for that half; moved inside the `run`, it would nest. The Statement forbids the call by what the callee is, which the caller cannot see; "MUST NOT depend on it, directly or behind a port of this system" names the dependency rather than the call, and the builder line is where it shows.
