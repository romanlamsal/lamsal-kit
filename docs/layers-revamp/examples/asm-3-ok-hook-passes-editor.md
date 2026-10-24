---
breaches: []
satisfies: [ASM-3, DRV-1]
situation: Payload's afterChange hook tells shop a product's content changed; Payload's auth supplies req.user
---

# Service receives its dependencies through its factory and the editor through its port

```ts
// shop/service/product-content-changed.ts
export type ProductContentChanged = (input: {
    productId: string
    slug: string
    changedBy: { kind: "editor"; userId: string } | { kind: "system" }
    changedAt: Date
}) => Promise<void>

export const createProductContentChanged =
    ({ productCommercial, outbox, transactions }: ProductContentChangedDeps): ProductContentChanged =>
    async ({ productId, slug, changedBy, changedAt }) => {
        const fields = await productCommercial.findById(productId)
        if (!fields) throw new ProductNotFound(productId)
        await transactions.run((tx) =>
            outbox.write(productPageInvalidated({ productId, slug, changedBy, changedAt }), tx))
    }

// catalog/collections/products.ts  (hook: a driving adapter Payload constructs)
afterChange: [
    async ({ doc, req }) => {
        if (req.context.origin === "shop") return   // shop's own write echoing back
        const { productContentChanged } = shopServices()
        await productContentChanged({
            productId: doc.id, slug: doc.slug,
            changedBy: req.user ? { kind: "editor", userId: req.user.id } : { kind: "system" },
            changedAt: new Date(),
        })
    },
],
```

The repository, outbox and transactions arrive through the factory; who changed the product and when arrive through the driving port, because the use case records them. The hook, the one place that sees Payload's `req.user`, translates it into the port's `changedBy`. A test, or a second way in such as a CLI reimport, sees in the signature exactly what to supply.
