---
breaches: []
satisfies: [ARR-1, DOM-5, SVC-4]
situation: shop places an order from a server action
---

# Place order: every dependency is one leg of the arrow

```ts
// shop/domain/ports/order-repository.ts  (domain declares the driven port)
export interface OrderRepository {
    save(order: Order, tx: Transaction): Promise<void>
}

// shop/service/place-order.ts  (service -> driven port, service -> domain)
export const createPlaceOrder =
    ({ orders, carts, transactions }: PlaceOrderDeps): PlaceOrder =>
    async (input) => {
        const cart = await carts.findById(input.cartId)
        const order = placeOrderFromCart(cart, input.placedAt)
        await transactions.run(async (tx) => {
            await orders.save(order, tx)
            await carts.save(clearCart(cart), tx)
        })
        return order
    }

// shop/adapters/drizzle/order-repository.ts  (driven adapter -> domain, -> outside)
export const createDrizzleOrderRepository = (db: NodePgDatabase): OrderRepository => ({
    save: async (order, tx) => { await asDrizzleTx(tx).insert(orders).values(toRow(order)) },
})

// app/checkout/actions.ts  (driving adapter -> service)
export async function placeOrderAction(form: FormData) {
    const { placeOrder } = shopServices()
    return placeOrder(placeOrderInputSchema.parse(Object.fromEntries(form)))
}
```

Each dependency points one way: the server action knows the service, the service knows the domain and the port, the Drizzle adapter knows the domain and Postgres. The service never learns it is called from a server action, and never learns the store is Postgres; a second way in, a Payload hook calling `placeOrder`, and a second store adapter both land without touching the service or the domain.
