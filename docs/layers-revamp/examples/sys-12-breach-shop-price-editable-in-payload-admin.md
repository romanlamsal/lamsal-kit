---
breaches: [SYS-12]
satisfies: [SVC-4]
situation: variant, not the fixture: shop's business rules decide the price, which is kept on Payload's products document
---

# Shop keeps its price on Payload's document, and editors change it in the admin

```ts
// catalog/collections/products.ts — catalog's config
fields: [
  { name: "title", type: "text" },
  { name: "price", type: "number" },        // shop's: shop's repository saves it through the Local API
]

// shop/payload/product-price-repository.ts — driven adapter over the Local API
export const payloadProductPrices = (payload: Payload): ProductPriceRepository => ({
  byId: async (id, tx) => toProductPrice(await payload.findByID({ collection: "products", id, req: reqOf(tx) })),
  save: async (p, tx) => { await payload.update({ collection: "products", id: p.id, data: { price: p.price.amount }, req: reqOf(tx) }) },
})
```

Shop's writes go through its repository, and shop's rules decide them: a price never below the
purchase price plus margin, a `PriceChanged` for billing and the page. The editor's write does not:
Payload's admin saves the field like any other, by catalog's rules, and none of shop's run. A price
below margin lands, no message tells of it, and shop's next save writes over the editor's or loads
it as if shop had decided it. Where editors set the price, P3 says the boundary is wrong: the fixture
has catalog own it.
