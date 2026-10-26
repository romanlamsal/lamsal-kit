---
breaches: [TX-29]
satisfies: [TX-28, TX-30]
situation: an editor saves a product in Payload's admin; shop revalidates the cached product page
---

# The afterChange hook records a private message; its handler revalidates once the edit is committed

```ts
// shop/payload/hooks/product-changed.ts — shop's hook, in catalog's config
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc }) => {
    await courier.read().requestPageRevalidation({ productId: doc.id, slug: doc.slug, version: doc.updatedAt })
    return doc
  }

// shop/service/request-page-revalidation.ts — records the request, nothing else
export const createRequestPageRevalidation =
  ({ outbox, transaction }: Deps): RequestPageRevalidation =>
  (input) => transaction.run((tx) => outbox.write(revalidateProductPage(input), tx))   // private message

// shop/service/revalidate-product-page.ts — called by shop's handler of RevalidateProductPage
export const createRevalidateProductPage =
  ({ catalog, pages, clock }: Deps): RevalidateProductPage =>
  async ({ productId, slug, version, writtenAt }) => {
    const product = await catalog.byId(productId)
    if (product && product.version >= version) return pages.revalidate(`/products/${slug}`)
    if (givesUpWaiting(writtenAt, clock.now())) return            // shop's rule: ten minutes, the page's own TTL does the rest
    throw new NotCommittedYet(productId)                           // redelivered after a back-off
  }
```

Payload has not committed when the hook runs, so the hook's use case records the request and changes
nothing that takes the edit as done (TX-28). The handler confirms by catalog's committed state: the
edit's version has arrived, the page rebuilds from it. A read before the commit finds the old version
and redelivery tries again; a save that rolled back never arrives, and shop's business rule ends the
waiting after ten minutes (TX-30). Payload's transaction could write the message itself, which
TX-29 asks for: then nothing would wait.
