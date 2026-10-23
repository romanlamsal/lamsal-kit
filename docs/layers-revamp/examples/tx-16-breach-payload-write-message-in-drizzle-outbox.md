---
breaches: [TX-16, TX-6]
satisfies: []
situation: shop writes Orders through Drizzle and price through Payload's Local API: two store clients, one database
---

# The price changes in a Payload transaction, its PriceChanged message goes into the Drizzle outbox

```ts
// shop/service/change-price.ts
type Deps = { transaction: TransactionPort; outbox: ShopOutbox; catalog: Payload }   // the one outbox: shop_outbox via Drizzle

export const createChangePrice =
  ({ transaction, outbox, catalog }: Deps): ChangePrice =>
  async ({ productId, price }) => {
    // Payload wraps this in a transaction of its own and commits before returning
    await catalog.update({
      collection: "products",
      id: productId,
      data: { price: price.amount, currency: price.currency },
    })
    // one outbox for the whole system; it is all the same Postgres anyway
    await transaction.run(async (tx) => {
      await outbox.write(priceChanged(productId, price), tx)
    })
  }
```

Shop writes to two stores, Payload's transaction and Drizzle's, and has an outbox in one. The price
commits in the Payload transaction, then the process dies, or the Drizzle transaction fails, and the
price has changed with no `PriceChanged` ever written: the cached shop page is never revalidated and
shows the old price. Swap the two steps and the message commits first; a validation hook in Payload then
rejects the update and the relay delivers a `PriceChanged` for a change that never happened. Either way
the message is in a transaction that is not the change's.
