---
breaches: []
satisfies: [SYS-8]
situation: one products document carries editorial copy and price
---

# One products document, two aggregates sharing its id

```ts
// packages/shop/domain/product-commercial.ts — shop's aggregate: the fields shop's rules decide
export const productCommercialSchema = z.object({ id: z.string(), sku: skuSchema, price: moneySchema })
export type ProductCommercial = z.infer<typeof productCommercialSchema>

// packages/shop/domain/ports/product-commercial-repository.ts
export interface ProductCommercialRepository {
  byId(id: string, tx?: Transaction): Promise<ProductCommercial | null>
  save(product: ProductCommercial, tx?: Transaction): Promise<void>
}

// packages/shop/payload/product-commercial-repository.ts — driven adapter over Payload's Local API
export const payloadProductCommercialRepository = (payload: Payload): ProductCommercialRepository => ({
  async byId(id) {
    const doc = await payload.findByID({ collection: "products", id, select: { sku: true, price: true } })
    return doc ? productCommercialSchema.parse({ id, sku: doc.sku, price: doc.price }) : null
  },
  async save(product, tx) {
    const req = tx ? { transactionID: toPayloadTransaction(tx).transactionID } : undefined
    await payload.update({ collection: "products", id: product.id, data: { sku: product.sku, price: product.price }, req, context: { origin: "shop" } })
  },
})

// packages/catalog/collections/products.ts — catalog's fields; shop's derived from shop's schema, read-only to editors
fields: [
  { name: "title", type: "text" }, { name: "slug", type: "text", unique: true }, { name: "body", type: "richText" },
  ...payloadFieldsFrom(productCommercialSchema.omit({ id: true }), { admin: { readOnly: true } }),
]
```

The record is Payload's `products` document; the deciders are two: catalog's config and its editors for copy, images and slug, shop's rules for sku and price. So shop models `ProductCommercial`, addressed by the document's id, with a repository that selects and updates its own two fields and nothing else. An editor saving new copy between shop's `byId` and `save` keeps it, because shop's save never carries `title` or `body`. Shop reads the copy, when it needs it, as another system's data through a `ProductContent` port, not through this repository. Payload still needs the two fields in its collection config to store them; deriving them from `productCommercialSchema` keeps shop's rule stated once (DOM-3) while the document carries both aggregates.
