---
breaches: [SYS-11]
satisfies: []
situation: shop reads content through Payload's Local API
---

# Shop's product-page service returns the Payload document

```ts
// packages/shop/service/product-page.ts
import type { Payload } from "payload"
import type { Product as ProductDoc } from "@teeladen/catalog/payload-types"
import type { StockLevels } from "../domain/ports/stock-levels"

export type ProductPage = (input: { slug: string }) => Promise<ProductDoc & { inStock: boolean }>

export const createProductPage =
  (payload: Payload, stock: StockLevels): ProductPage =>
  async ({ slug }) => {
    const { docs } = await payload.find({ collection: "products", where: { slug: { equals: slug } }, depth: 2 })
    const doc = docs[0]
    if (!doc) throw new ProductNotFound(slug)
    const level = await stock.forSku(doc.sku)
    return { ...doc, inStock: level > 0 }
  }

// apps/web/app/products/[slug]/page.tsx
const page = await shop.productPage({ slug })
return <Layout blocks={page.layout} hero={page.meta?.image?.sizes?.card?.url} price={page.price} />
```

The Payload instance is received through the factory and the generated type is right there, so the service passes the document through and the page renders Payload's `layout` blocks and `meta.image.sizes`. Payload's model now spreads through shop: the driving port's return type is a Payload document, the page component speaks Payload's field names, and `depth: 2` decides in a service what the product resolves. A Payload upgrade that changes the upload `sizes` shape, or an editor-driven config change renaming `layout`, is absorbed in the service, the port and every page at once instead of in an adapter. The service cannot be tested without a Payload instance or a fake of Payload itself. A SHOULD, without an ADR naming SYS-11.
