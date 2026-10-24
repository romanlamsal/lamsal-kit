---
breaches: [DRV-1]
satisfies: [DRV-8]
situation: shop's checkout server action places the order and needs the Stripe client_secret in the same request
finding: adversarial
---

# One acting call, carrying the rest of the use case as a callback

```ts
// shop/service/place-order.ts
export type PlaceOrder = (input: {
    cartId: string
    customerId: string
    afterSave?: (order: Order, tx: Transaction) => Promise<void>     // "extension point"
}) => Promise<{ orderId: string }>

export const createPlaceOrder =
    ({ transaction, carts, orders, outbox }: Deps): PlaceOrder =>
    async ({ cartId, customerId, afterSave }) =>
        transaction.run(async (tx) => {
            const order = placeOrder(await carts.byId(cartId, tx), customerId)
            await orders.save(order, tx)
            await outbox.write(orderPlaced(order), tx)
            await afterSave?.(order, tx)
            return { orderId: order.id }
        })

// app/checkout/actions.ts  (driving adapter)
export async function checkoutAction(form: FormData) {
    const { placeOrder, requestPayment } = shopServices()
    const input = checkoutInputSchema.parse(Object.fromEntries(form))
    return placeOrder({
        ...input,
        afterSave: async (order) => { await requestPayment({ orderId: order.id, amount: orderTotal(order) }) },
    })
}
```

The adapter makes one call that acts, to one service, and calls nothing else of the system: the Statement and DRV-8 are satisfied as written. The Why's harm is intact: which second call to make and what to do when it fails is decided in this one way in, inside a callback the next way in, Payload's hook placing a phone order, does not pass, so payment is requested from the browser checkout and from nowhere else, and the request runs inside shop's transaction, which is TX-3's harm as well. "One call that acts, to one service, with values as its arguments" is the clause that keeps the adapter from handing behavior in with the data.
