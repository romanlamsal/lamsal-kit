---
breaches: [ASM-4, ASM-2]
satisfies: []
situation: shop's driven adapter over Payload's Local API fetches the Payload instance from the courier
---

# The Payload Local API adapter reads the courier for its Payload instance

```ts
// shop/src/adapters/payload-catalog.ts
import { courier } from "@teeladen/common"
import type { CatalogPort } from "../service/ports"

// the Payload instance exists only after getPayload(), and shop is built before that is
// convenient, so the adapter looks it up when first used
export const payloadCatalog: CatalogPort = {
  async writeCommercial(productId, { price, sku }) {
    const { payload } = courier.read()
    await payload.update({ collection: "products", id: productId, data: { price: price.amount, sku: sku.value } })
  },
  async readContent(productId) {
    const { payload } = courier.read()
    return toContent(await payload.findByID({ collection: "products", id: productId }))
  },
}

// apps/web/instrumentation.ts
export async function register() {
  const payload = await getPayload({ config })
  const shop = buildShop({ tx, catalog: payloadCatalog, billing: buildBilling({ tx }).invoicing })
  courier.fill({ shop, payload })                       // the courier now carries an external system's instance too
}
```

A driven adapter has a factory; it has a caller to hand it the Payload instance, and here it reads
the courier instead, so shop's dependence on Payload leaves the one place the graph is visible and
sits in a module nobody passes anything to. `payloadCatalog` is a ready-made instance, not a
factory, so the contract suite for `CatalogPort` cannot hand the real adapter a Payload instance over
a test database; it has to fill the courier first, and whoever filled it last wins. The courier,
meant to carry what driving adapters call into, now carries a store client of sorts, and the
`register()` ordering trick that made the cycle easy to break is replaced by a lookup at call time
that fails on the first hook that runs before `register()` finished.
