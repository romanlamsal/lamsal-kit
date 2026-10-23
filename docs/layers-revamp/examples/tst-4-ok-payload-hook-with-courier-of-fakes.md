---
breaches: []
satisfies: [TST-4, TST-7]
situation: shop's afterChange hook on Payload's products collection, a driving adapter Payload constructs
---

# The hook's test fills the courier with a fake shop and invokes the hook with a fabricated `req`

```ts
// catalog/test/collections/products.hooks.test.ts
import { courier } from "@teeladen/common"
import { syncPriceAfterChange } from "../../src/collections/products.hooks"
import { fakeShop } from "@teeladen/shop/testing"

it("should call syncPrice with the editor as actor and the document's price", async () => {
  // given
  const shop = fakeShop()
  courier.fill({ shop })
  const doc = { id: "p-1", title: "Sencha", price: 850, sku: "TEA-00001" }
  const req = { user: { id: "u-9", role: "editor" }, transactionID: "t-1" } as unknown as PayloadRequest

  // when
  await syncPriceAfterChange({ doc, previousDoc: { ...doc, price: 800 }, req, operation: "update", collection: productsCollection, context: {} })

  // then
  expect(shop.calls.syncPrice).toEqual([{ productId: "p-1", price: { amount: 850, currency: "EUR" }, actor: { id: "u-9", role: "editor" } }])
})
```

Payload constructs the hook, so the hook reads its service from the courier, and the test fills
the courier with a fake and gets to assert on the translation alone: which port was called with
what. No Payload instance starts, no Postgres is needed, and the test stays in the default suite.
The `as unknown as PayloadRequest` narrows a fabricated request to Payload's type for the fields the
hook reads and nothing else; the fake shop is shop's own, exported on a path production never
loads.
