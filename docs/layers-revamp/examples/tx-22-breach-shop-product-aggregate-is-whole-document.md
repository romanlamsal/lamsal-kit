---
breaches: [TX-22]
satisfies: []
situation: one products document carries editorial copy and price
---

# Shop's Product is the whole Payload document

```ts
// packages/shop/domain/product.ts — "the product is the Payload doc"
import type { Product as ProductDoc } from "@teeladen/catalog/payload-types"
export type Product = ProductDoc          // title, slug, body, images, sku, price, updatedAt, ...

// packages/shop/service/ports/product-repository.ts
export interface ProductRepository {
  byId(id: string): Promise<Product | null>
  save(product: Product): Promise<void>
}

// packages/shop/payload/product-repository.ts
export const payloadProductRepository = (payload: Payload): ProductRepository => ({
  byId: (id) => payload.findByID({ collection: "products", id }),
  save: async (product) => { await payload.update({ collection: "products", id: product.id, data: product }) },
})

// packages/shop/service/reprice-products.ts — nightly price list from the ERP
export const createRepriceProducts =
  (products: ProductRepository): RepriceProducts =>
  async ({ prices }) => {
    for (const { productId, price } of prices) {
      const product = await products.byId(productId)
      if (product) await products.save({ ...product, price })
    }
  }
```

Payload generates `Product`, so the type is free and the repository is two lines; this is what gets written first. The one record now has one aggregate with two deciders. `save` writes the `title` and `body` it loaded a moment ago, so an editor's change made in the admin UI between `byId` and `save` is overwritten with no error and no message: a shop use case has written fields catalog, an external system, holds, with no message in shop's outbox (TX-22), and shop's repository loads and saves what it does not own. The generated type also carries catalog's whole model, images, layout blocks, SEO fields, into shop's domain, where any catalog config change becomes shop's compile error.
