---
breaches: [ASM-2]
satisfies: []
situation: shop's Payload adapter gets the Payload instance the way Payload's docs show
---

# Payload driven adapter builds its own Payload instance

```ts
// shop/adapters/payload/product-commercial-repository.ts  (driven adapter)
import { getPayload } from "payload"
import config from "@payload-config"
import type { ProductCommercialRepository } from "../../service/ports/product-commercial-repository"
import { productCommercialSchema } from "../../domain/product-commercial"

const payload = await getPayload({ config })   // Payload's docs do it this way

export const payloadProductCommercialRepository: ProductCommercialRepository = {
    findById: async (productId) => {
        const doc = await payload.findByID({ collection: "products", id: productId, depth: 0 })
        return productCommercialSchema.parse({ productId: doc.id, sku: doc.sku, price: { amount: doc.price, currency: "EUR" } })
    },
    save: async (fields, tx) => {
        await payload.update({ collection: "products", id: fields.productId,
            data: { sku: fields.sku, price: fields.price.amount }, req: { transactionID: asPayloadTx(tx) } })
    },
}
```

`getPayload({ config })` is the first line of every Payload example, so the adapter calls it and exports a ready-made repository. The adapter is now stuck with that one instance: its test runs against whatever database `@payload-config` points to, and the process has a second Payload beside the one assembly built, with its own connection pool. Importing `@payload-config` also loads the collection configs and their hooks, which reach for shop's services: the fixture's cycle, started from the driven side.
