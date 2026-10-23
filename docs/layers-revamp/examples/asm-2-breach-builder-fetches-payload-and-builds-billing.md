---
breaches: [ASM-2]
satisfies: []
situation: shop's system builder fetches the Payload instance and builds billing in place
---

# shop's builder gets its own Payload instance and its own billing

```ts
// shop/src/build.ts
import { getPayload } from "payload"
import config from "@payload-config"
import { buildBilling } from "@teeladen/billing"
import type { TransactionPort } from "@teeladen/common"
import { createPayloadCatalog } from "./adapters/payload-catalog"
import { createCheckout } from "./service/checkout"
import { createOrderRepository, createCartRepository, createShopOutbox } from "./adapters/drizzle"

export async function buildShop(deps: { tx: TransactionPort }) {
  const payload = await getPayload({ config })        // Payload memoizes this, so "it is the same instance anyway"
  const catalog = createPayloadCatalog(payload)
  const billing = buildBilling({ tx: deps.tx })       // shop needs billing, so shop builds it
  return {
    checkout: createCheckout({
      tx: deps.tx,
      catalog,
      billing: billing.invoicing,
      orders: createOrderRepository(deps.tx),
      carts: createCartRepository(deps.tx),
      outbox: createShopOutbox(deps.tx),
    }),
  }
}
```

The builder is a factory for shop, and its upstreams are dependencies it builds in place instead of
receiving. Substitution is gone: a test of `checkout` that wants a fake `CatalogPort` has to start
Payload against Postgres first, because `getPayload` runs inside the builder, and it runs billing's
real services with it. Billing now exists twice in the web process, once here and once where
assembly builds it for billing's own routes and dunning task, and which one the admin's invoice
screen reads is a question nobody can answer from one file. Nothing else flags this: the code sits
in a builder and calls in the right direction.
