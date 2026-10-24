---
breaches: []
satisfies: [SVC-6, DRV-8, DVN-4, SVC-1, SVC-4, TX-1]
situation: shop places an order from a server action
---

# Place order: each layer reaches only what its list names

```ts
// shop/service/ports/order-repository.ts  (the service layer declares the driven port)
export interface OrderRepository {
    save(order: Order, tx: Transaction): Promise<void>
}

// shop/service/place-order.ts  (service -> port, domain, common library)
export const createPlaceOrder =
    ({ orders, carts, transactions }: PlaceOrderDeps): PlaceOrder =>
    async (input) =>
        transactions.run(async (tx) => {
            const cart = await carts.findById(input.cartId, tx)
            const order = placeOrderFromCart(cart, input.placedAt)
            await orders.save(order, tx)
            await carts.save(clearCart(cart), tx)
            return toPlacedOrder(order)          // into the published language
        })

// shop/adapters/drizzle/order-repository.ts  (driven adapter -> port, domain, Postgres)
export const createDrizzleOrderRepository = (db: NodePgDatabase): OrderRepository => ({
    save: async (order, tx) => { await asDrizzleTx(tx).insert(orders).values(toRow(order)) },
})

// app/checkout/actions.ts  (driving adapter -> driving port type, published language)
export async function placeOrderAction(form: FormData) {
    const { placeOrder } = shopServices()
    return placeOrder(placeOrderInputSchema.parse(Object.fromEntries(form)))
}
```

Each layer reaches what its rule lists: the server action a driving port and the published
language it parses with, the service the domain, its ports and the common library's transaction,
the Drizzle adapter the port it implements, the domain and Postgres. The service never learns it
is called from a server action, and never learns the store is Postgres; a second way in, a Payload
hook calling `placeOrder`, and a second store adapter both land without touching the service or
the domain.
