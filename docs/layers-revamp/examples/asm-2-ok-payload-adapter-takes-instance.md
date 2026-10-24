---
breaches: []
satisfies: [ASM-2, DVN-4]
situation: shop writes price and sku onto Payload's products document through the Local API
---

# Payload driven adapter imports the schema, takes the Payload instance

```ts
// shop/adapters/payload/product-commercial-repository.ts  (driven adapter)
import type { Payload } from "payload"
import type { ProductCommercialRepository } from "../../service/ports/product-commercial-repository"
import { productCommercialSchema, type ProductCommercial } from "../../domain/product-commercial"
import type { Transaction } from "@teeladen/common/transaction"
import { asPayloadTx } from "./transaction"

export const createPayloadProductCommercialRepository = (payload: Payload): ProductCommercialRepository => ({
    findById: async (productId) => {
        const doc = await payload.findByID({ collection: "products", id: productId, depth: 0 })
        return productCommercialSchema.parse({ productId: doc.id, sku: doc.sku, price: { amount: doc.price, currency: "EUR" } })
    },
    save: async (fields: ProductCommercial, tx: Transaction) => {
        await payload.update({
            collection: "products",
            id: fields.productId,
            data: { sku: fields.sku, price: fields.price.amount },
            req: { transactionID: asPayloadTx(tx), context: { origin: "shop" } },
        })
    },
})
```

What is static comes by import: the port type, the schema the adapter parses Payload's document against, the transaction helper. What is built per process, the Payload instance, comes through the factory, so assembly builds Payload once and hands it here, and the integration test (TST-5) hands in a Payload built against a test database. Nothing in this module runs at import time.
