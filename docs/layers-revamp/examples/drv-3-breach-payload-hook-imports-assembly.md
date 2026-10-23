---
breaches: [DRV-3]
satisfies: []
situation: Payload's config needs the hooks, the hooks need shop services, the services need the Payload instance
---

# Payload hook imports assembly to get its service

```ts
// app/assembly.ts
import { getPayload } from "payload"
import config from "@payload-config"

export const payload = await getPayload({ config })
export const shop = buildShopOpenHostService({ db, payload, transactions })

// catalog/collections/products.ts  (Payload collection config, imported by @payload-config)
import { shop } from "@/app/assembly"

export const Products: CollectionConfig = {
    slug: "products",
    hooks: {
        afterChange: [
            async ({ doc, req }) => {
                if (req.context.origin === "shop") return
                await shop.productContentChanged({ productId: doc.id, slug: doc.slug, changedBy: toRequester(req), changedAt: new Date() })
            },
        ],
    },
    fields: [/* … */],
}
```

The hook needs `shop.productContentChanged`, assembly has it, so the hook imports assembly. Loading `products.ts` now runs assembly, and assembly loads the Payload config, which loads `products.ts`: the cycle the fixture names, surfacing as `shop` being `undefined` at the first `afterChange`. There are also two places where port and implementation meet, and a test of the hook cannot hand it a fake; it gets whatever instance assembly built, against the real database.
