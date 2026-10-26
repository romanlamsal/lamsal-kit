---
breaches: []
satisfies: [SYS-1, ASM-4, DRV-3]
situation: Payload's config needs shop's hooks, the hooks need services, the services need the Payload instance
---

# Shop's hooks reach Payload's config through a system builder

```ts
// packages/shop/builders/hooks.ts — a system builder for the way shop is driven by Payload
import type { Courier } from "@teeladen/common/courier"
import type { ShopServices } from "../service/services"
import { productChanged } from "../payload/hooks/product-changed"

export const buildShopHooks = (courier: Courier<ShopServices>) => ({
  productsAfterChange: [productChanged(courier)],
})

// packages/shop/build.ts
export { buildShopHooks } from "./builders/hooks"
export { buildShopOpenHostService } from "./builders/open-host-service"

// apps/server/assembly.ts
import { productsCollection } from "@teeladen/catalog"
import { buildShopHooks, buildShopOpenHostService } from "@teeladen/shop/build"

const courier = createCourier<ShopServices>()
const hooks = buildShopHooks(courier)
const payload = await getPayload({ config: payloadConfig({ products: productsCollection({ afterChange: hooks.productsAfterChange }) }) })
const shop = buildShopOpenHostService({ db, payload })
courier.fill(shop)
```

The hooks are shop's driving adapters, so they are not part of shop's offer and no export path carries them directly; what crosses the package boundary is `buildShopHooks`, a system builder, which SYS-1 allows. The cycle from the fixture is cut in assembly, the one place that sees all three: it builds the hooks before the Payload instance exists and hands them a courier, builds Payload with them, builds shop's services with the Payload instance, fills the courier. Catalog's config module never imports a file of shop's, and shop's hook file stays inside the package. Assembly constructs the hooks, but before shop's services exist, since those are built from the Payload instance the hooks are built into; so the hooks read the courier (ASM-4, DRV-3).
