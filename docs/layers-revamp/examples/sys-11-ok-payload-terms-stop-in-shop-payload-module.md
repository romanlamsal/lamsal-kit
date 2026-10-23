---
breaches: []
satisfies: [SYS-11, SYS-3]
situation: shop reads content through Payload's Local API; a Payload edit revalidates the shop page
---

# Payload's terms stop in shop's `payload/` module

```ts
// packages/shop/domain/ports/product-content.ts — driven port, shop's terms
export interface ProductContent {
  bySlug(slug: string): Promise<{ productId: string; title: string; body: RichText } | null>
}

// packages/shop/payload/product-content.ts — driven adapter over the Local API, the way out
export const payloadProductContent = (payload: Payload): ProductContent => ({
  async bySlug(slug) {
    const { docs } = await payload.find({ collection: "products", where: { slug: { equals: slug } }, limit: 1 })
    const doc = docs[0]
    return doc ? { productId: doc.id, title: doc.title, body: richTextSchema.parse(doc.body) } : null
  },
})

// packages/shop/payload/hooks/product-changed.ts — hook Payload calls, the way in
import type { CollectionAfterChangeHook } from "payload"
import type { Product as ProductDoc } from "@teeladen/catalog/payload-types"

export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc, previousDoc, req }) => {
    const { productContentChanged } = courier.read()
    await productContentChanged({ productId: doc.id, slug: doc.slug, previousSlug: previousDoc?.slug ?? null, requestId: req.context.requestId })
    return doc
  }
```

Catalog is a product: its code is Payload's, and `docs`, `depth`, `req`, `CollectionAfterChangeHook` are Payload's terms. Shop puts an anti-corruption layer in one module, `payload/`: the driven adapter translates a `find` result into what `ProductContent` promises, and the hook translates Payload's hook arguments into one call on shop's `ProductContentChanged` driving port. The Local API is the product's driving port, and shop calls it through a driven port of its own that assembly fills with the Payload instance (SYS-3). A Payload major that changes `find`'s return shape or the hook signature is two files' work; a test of the service that revalidates the page hands it a fake `ProductContent`.
