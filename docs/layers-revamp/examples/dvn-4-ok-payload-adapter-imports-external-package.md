---
breaches: []
satisfies: [DVN-4, SVC-7]
situation: shop reads the product, price and tax class included, through Payload's Local API
---

# Shop's driven adapter over the Local API imports `payload`, catalog's package

```ts
// packages/shop/service/ports/catalog-products.ts — driven port, shop's terms
export interface CatalogProducts {
  byId(productId: string): Promise<{ productId: string; sku: Sku; price: Money; taxClass: TaxClass } | null>
}

// packages/shop/payload/catalog-products.ts — driven adapter
import type { Payload } from "payload"                       // catalog is an external system in this process
import type { Product as ProductDoc } from "@teeladen/catalog/payload-types"

export const payloadCatalogProducts = (payload: Payload): CatalogProducts => ({
  async byId(productId) {
    const doc: ProductDoc | null = await payload.findByID({ collection: "products", id: productId, disableErrors: true })
    return doc
      ? { productId: doc.id, sku: skuSchema.parse(doc.sku), price: { amount: doc.price, currency: "EUR" }, taxClass: taxClassSchema.parse(doc.taxClass) }
      : null
  },
})
```

Catalog runs in shop's process, so `payload` is no client of something outside the process, and
catalog, an external system, has no export path of this codebase. DVN-4 lists the external
system's package for exactly this: the adapter imports it and catalog's generated types, and
translates a Payload document into what `CatalogProducts` promises. Shop's checkout reads the price
through the port (SVC-7) and copies it into the Order; Payload's terms, `findByID`, `collection`,
the document, stay in this file, and the instance arrives from assembly.
