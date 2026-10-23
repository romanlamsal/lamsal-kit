---
breaches: []
satisfies: [TX-16, TX-4, TX-6]
situation: shop writes Orders through Drizzle and price through Payload's Local API: two store clients, one database
---

# Shop has a `shop_outbox` table for the Drizzle store and a `shop-outbox` collection for the Payload store

```ts
// shop/driven/payload/outbox.ts  — the same ShopOutbox port, implemented over Payload's transaction
export const createPayloadShopOutbox = (payload: Payload): ShopOutbox => ({
  write: async (message, tx) => {
    await payload.create({
      collection: "shop-outbox",            // shop's collection, not catalog's; editors never see it
      data: { messageId: message.id, type: message.type, payload: message },
      req: asPayloadReq(tx),                // { transactionID } narrowed from the opaque Transaction
    })
  },
})

// shop/service/change-price.ts  — ProductCommercials lives on the products document, so this is a Payload transaction
export const createChangePrice =
  ({ payloadTransaction, commercials, payloadOutbox }: Deps): ChangePrice =>
  async ({ productId, price }) =>
    payloadTransaction.run(async (tx) => {
      const current = await commercials.byProductId(productId, tx)
      if (!current) throw new ProductNotFound(productId)
      await commercials.save(withPrice(current, price), tx)      // payload.update({ collection: "products", ... req })
      await payloadOutbox.write(priceChanged(current, price), tx)
    })

// shop/system-builder.ts
outboxReaders: [createDrizzleShopOutboxReader(db), createPayloadShopOutboxReader(payload)],
```

Drizzle's transaction and Payload's `req.transactionID` do not commit together, so shop writes to two
stores. Each has an outbox the transaction of that store reaches: `PriceChanged` is written through
Payload in the Payload transaction that changes the price, `OrderPlaced` through Drizzle in the Drizzle
transaction that saves the Order, and both land exactly as committed as the change they tell of. Both
outboxes share shop's one `ShopOutbox` port and message schemas; the system builder hands the relay a
reader for each.
