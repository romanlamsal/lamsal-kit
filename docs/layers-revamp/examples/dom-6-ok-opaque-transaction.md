---
breaches: []
satisfies: [DOM-6, DOM-1]
situation: shop's one use case writes Drizzle tables and a Payload document in one database
---

# Repository methods take the common library's opaque `Transaction`

```ts
// common/transaction.ts  (common library port)
declare const brand: unique symbol
export type Transaction = { readonly [brand]: "Transaction" }
export interface Transactions {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>
}

// shop/domain/ports/order-repository.ts
export interface OrderRepository {
    save(order: Order, tx: Transaction): Promise<void>
}
// shop/domain/ports/product-commercial-repository.ts
export interface ProductCommercialRepository {
    save(fields: ProductCommercial, tx: Transaction): Promise<void>
}

// shop/adapters/drizzle/order-repository.ts  (narrows on its own side)
save: async (order, tx) => { await asDrizzleTx(tx).insert(orders).values(toRow(order)) }

// shop/adapters/payload/product-commercial-repository.ts  (narrows to Payload's id)
save: async (fields, tx) => {
    await payload.update({ collection: "products", id: fields.productId,
        data: { price: fields.price.amount, sku: fields.sku }, req: { transactionID: asPayloadTx(tx) } })
}
```

The domain's signature names a branded type and no store client. The Drizzle adapter narrows the same value to a Drizzle transaction, the Payload adapter to a `transactionID`, each on its own side of the port, and the service passes it through without knowing either. The browser importing the domain for `orderSchema` gets a type that erases at compile time, and the fake repository ignores `tx` without having to construct a Drizzle one.
