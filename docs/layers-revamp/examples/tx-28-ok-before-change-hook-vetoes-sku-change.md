---
breaches: []
satisfies: [TX-28, DRV-1]
situation: a beforeChange hook asks shop whether a sku on an open order may change
---

# The beforeChange hook asks; shop answers and changes nothing

```ts
// shop/payload/hooks/sku-change-guard.ts — shop's hook, in catalog's config
export const skuChangeGuard =
  (courier: Courier<ShopServices>): CollectionBeforeChangeHook<ProductDoc> =>
  async ({ data, originalDoc }) => {
    if (!originalDoc || data.sku === undefined || data.sku === originalDoc.sku) return data
    const { allowed } = await courier.read().skuChangeAllowed({ productId: originalDoc.id, from: originalDoc.sku })
    if (!allowed) throw new APIError("This sku is on an open order.", 409)   // Payload rolls the save back
    return data
  }

// shop/service/sku-change-allowed.ts — answering use case
export const createSkuChangeAllowed =
  ({ openOrders }: Deps): SkuChangeAllowed =>
  async ({ from }) => ({ allowed: canChangeSku(await openOrders.countWithSku(from)) })
```

Payload calls the hook inside the editor's save, before it commits. Shop's use case answers by
shop's business rule and writes nothing, so whether Payload commits the save or rolls it back,
nothing of shop's is left wrong. Its answer can stop the save: a veto.
