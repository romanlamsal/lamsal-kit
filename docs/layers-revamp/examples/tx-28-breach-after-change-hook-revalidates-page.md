---
breaches: [TX-28]
satisfies: [DRV-3, TX-25]
situation: an editor saves a product in Payload's admin; an afterChange hook calls shop to revalidate the cached product page
---

# The afterChange hook revalidates the page before Payload has committed the edit

```ts
// shop/payload/hooks/product-changed.ts — shop's hook, in catalog's config
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc }) => {
    await courier.read().revalidateProductPage({ productId: doc.id, slug: doc.slug })
    return doc
  }

// shop/service/revalidate-product-page.ts
export const createRevalidateProductPage =
  ({ pages, outbox, transaction }: Deps): RevalidateProductPage =>
  ({ productId, slug }) =>
    transaction.run(async (tx) => {
      await pages.revalidate(`/products/${slug}`)                    // the cache rebuilds from what it reads now
      await outbox.write(productPageChanged({ productId, slug }), tx)  // published: other systems act on it
    })
```

Payload calls `afterChange` inside the transaction of the editor's save (`req.transactionID`), and
the hook hands no transaction to shop (TX-25): shop's use case runs on its own and commits. Both of
its changes take the edit as done. The page rebuilds from a read that runs before Payload's commit
and finds the old price, and stays stale until its next revalidation; when a later hook or a failed
validation rolls the save back, `ProductPageChanged` is already out, telling of an edit that never
happened.
