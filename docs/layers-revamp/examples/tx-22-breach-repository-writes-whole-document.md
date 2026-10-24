---
breaches: [TX-22]
satisfies: [DOM-4, SVC-4]
situation: one products document carries editorial copy and price
---

# Two aggregates with one id; shop's repository saves its aggregate by writing the whole document back

```ts
// shop/domain/product-commercial.ts  (shop's aggregate: its fields only, the document's id)
export const productCommercialSchema = z.object({ id: z.string(), sku: skuSchema, price: moneySchema })
export type ProductCommercial = z.infer<typeof productCommercialSchema>

// shop/service/ports/product-commercial-repository.ts
export interface ProductCommercialRepository {
    byId(id: string): Promise<ProductCommercial | null>
    save(product: ProductCommercial): Promise<void>
}

// shop/adapters/payload/product-commercial-repository.ts  (driven adapter over Payload's Local API)
export const createPayloadProductCommercialRepository = (payload: Payload): ProductCommercialRepository => ({
    byId: async (id) => {
        const doc = await payload.findByID({ collection: "products", id })
        return productCommercialSchema.parse({ id: doc.id, sku: doc.sku, price: fromMinor(doc.price) })
    },
    save: async (product) => {
        const doc = await payload.findByID({ collection: "products", id: product.id })   // Payload validates the full doc
        await payload.update({ collection: "products", id: product.id, data: { ...doc, sku: product.sku, price: toMinor(product.price) } })
    },
})
```

Shop models its fields as an aggregate of its own, `ProductCommercial`, with the document's id and
nothing of catalog's model in it. The write is the breach: `save` reads the whole document and
writes it back with two fields changed, so it writes catalog's title and body too. Catalog is an
external system and those fields are its; a shop use case changes them with no message through
shop's outbox (TX-22), and an editor's retitle between the two Payload calls is overwritten with
no error. The aggregate boundary in the domain never reached the write.
