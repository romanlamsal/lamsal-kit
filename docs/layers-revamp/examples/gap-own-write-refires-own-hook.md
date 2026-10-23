---
breaches: []
satisfies: []
situation: shop's own write through Payload's Local API fires shop's own afterChange hook again
finding: gap
---

# The driven adapter tags its write and the hook returns early on the tag

```ts
// shop/adapters/payload/product-commercial-repository.ts — driven adapter, plants the tag
save: async (fields, tx) => {
  await payload.update({
    collection: "products",
    id: fields.productId,
    data: { sku: fields.sku, price: fields.price.amount },
    req: { transactionID: asPayloadTx(tx) },
    context: { origin: "shop" },
  })
}

// catalog/collections/products.hooks.ts — Payload calls this for the editor's save and for shop's save alike
export const productChanged: CollectionAfterChangeHook<ProductDoc> = async ({ doc, previousDoc, req }) => {
  if (req.context.origin === "shop") return doc        // the echo of shop's own write: make no call
  const { productContentChanged } = courier.read<ShopServices>()
  await productContentChanged({
    productId: doc.id,
    slug: doc.slug,
    previousSlug: previousDoc?.slug ?? null,
    changedBy: req.user ? { kind: "editor", userId: req.user.id } : { kind: "system" },
  })
  return doc
}
```

DRV-1's Scope holds and its Statement wants one acting call; the early return makes none, and
the decision "this call is my own echo" is made in the adapter, from a tag a driven adapter
planted two layers away. TX-5 fits in spirit, a repeat recognized and skipped, but its Scope is a
handler receiving a message, and a hook is not one. SVC-2 would have the service decide, but the
service decides by what is stored, and `origin` is in the request; without the tag the service
sees a price change made by itself and writes `PriceChanged` a second time, or loops where the
sync writes again. No rule's Scope covers an upstream calling this system's driving adapter
because of this system's own write. A reader wants ruled where the echo is recognized, and
whether a driving adapter may decide to call nothing.
