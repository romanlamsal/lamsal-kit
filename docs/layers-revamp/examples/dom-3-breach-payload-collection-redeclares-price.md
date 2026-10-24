---
breaches: [DOM-3]
satisfies: []
situation: Payload's products collection config declares the price and sku fields shop's domain schema declares
finding: cannot-comply
---

# Payload's collection config is a second statement of `price` and `sku`

```ts
// shop/domain/product-commercial.ts
export const productCommercialSchema = z.object({
    productId: z.string(),
    sku: z.string().regex(/^[A-Z]{3}-\d{4}$/),
    price: z.object({ amount: z.number().int().nonnegative(), currency: z.enum(["EUR"]) }),
})

// catalog/collections/products.ts  (Payload collection config)
export const Products: CollectionConfig = {
    slug: "products",
    fields: [
        { name: "title", type: "text", required: true },
        { name: "slug", type: "text", unique: true },
        { name: "sku", type: "text", required: true },
        { name: "price", type: "number", required: true, min: 0 },
    ],
}
```

Shop owns `price` and `sku` and declares their shape in its domain. Payload stores them on the same `products` document and will not store a field its collection config does not declare, so the config states the shape again: `sku` as free text without the pattern, `price` as a bare number without the currency. The two drift the way DOM-3's Why describes, an editor's import tool writes `sku: "tea-1"` and Payload accepts what shop's schema rejects. Deriving the Payload fields from the zod schema would satisfy the letter, but Payload's field types do not cover a `Money` object and the config also carries admin-UI concerns the domain has no word for; the fixture cannot state the shape once while a product stores the field.
