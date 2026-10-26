---
breaches: []
satisfies: [SYS-12, SVC-4]
situation: variant, not the fixture: shop's business rules decide the price, which is kept on Payload's products document
---

# The price field is read-only to Payload's own ways in; editors change it through shop

```ts
// catalog/collections/products.ts — catalog's config
fields: [
  { name: "title", type: "text" },
  {
    name: "price", type: "number",
    access: { create: () => false, update: () => false },   // admin and REST API refuse; the Local API overrides access
    admin: { readOnly: true, components: { afterInput: ["@teeladen/shop/payload#ChangePriceButton"] } },
  },
]

// shop/payload/change-price-button.tsx — shop's driving adapter in Payload's admin
"use server"
export async function changePrice(productId: string, amount: number) {
  await courier.read().changePrice({ productId, price: { amount, currency: "EUR" }, actor: await editorFromSession() })
}
```

Payload's admin and its REST API cannot write the field: access refuses them. Shop's repository
writes it through the Local API, which overrides access, inside a use case of shop's. An editor who
wants a new price uses shop's button, a driving adapter that calls shop's `changePrice`, an acting
call with its own transaction, outside any save of Payload's; shop's rules decide and its message
tells of the change. The flow works, and still every price edit crosses two systems, which P3 calls
a boundary drawn wrong: the fixture has catalog own the price.
