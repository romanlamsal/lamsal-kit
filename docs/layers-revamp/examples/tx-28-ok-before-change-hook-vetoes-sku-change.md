---
breaches: []
satisfies: [TX-28, DRV-1]
situation: catalog's beforeChange asks shop how many open orders carry a sku, and refuses to change a sku one does
---

# Catalog's beforeChange asks; shop answers and changes nothing; catalog vetoes

```ts
// shop/payload/hooks/open-orders-with-sku.ts — shop's hook, handed to catalog's config by assembly
export const openOrdersWithSku =
  (courier: Courier<ShopServices>) =>
  ({ sku }: { sku: string }): Promise<{ openOrders: number }> =>
    courier.read().countOpenOrdersWithSku({ sku })

// shop/service/count-open-orders-with-sku.ts — answering use case
export const createCountOpenOrdersWithSku =
  ({ openOrders }: Deps): CountOpenOrdersWithSku =>
  async ({ sku }) => ({ openOrders: await openOrders.countWithSku(sku) })

// catalog/collections/products.ts — catalog's config: its rule, a sku on an open order does not change
export const products = (shop: ShopHooks): CollectionConfig => ({
  slug: "products",
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        if (!originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data
        const { openOrders } = await shop.openOrdersWithSku({ sku: originalDoc.sku })
        if (openOrders > 0) throw new APIError("This sku is on an open order.", 409)   // Payload rolls the save back
        return data
      },
    ],
  },
  // fields: … sku unique, price above zero
})
```

Payload calls catalog's `beforeChange` inside the editor's save, before it commits. The rule is
catalog's, in its config beside a sku unique: a sku on an open order does not change. Shop's hook
answers a fact, how many open orders carry the sku, and its use case writes nothing, so whether
Payload commits the save or rolls it back, nothing of shop's is left wrong. Catalog refuses its own
change by the answer: a veto. No rule of shop's decides the sku, which stays catalog's to own
(glossary: Owner).
