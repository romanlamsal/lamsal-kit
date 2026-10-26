---
breaches: [ASM-1]
satisfies: []
situation: Payload's config needs the hooks, the hooks need shop's services, the services need the Payload instance
---

# Payload config builds shop's services a second time

```ts
// catalog/payload.config.ts — Payload loads this when the Next.js server starts
import { buildConfig } from "payload"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { Pool } from "pg"
import { createTransactionPort } from "@teeladen/common"
import { buildShop } from "@teeladen/shop"
import { buildBilling } from "@teeladen/billing"
import { productsCollection } from "./collections/products"

// the hooks need shop's services, and the config is where the hooks are declared, so build them here
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const tx = createTransactionPort(pool)
const shop = buildShop({ tx, catalog: deferredPayloadCatalog(), billing: buildBilling({ tx }).invoicing })

export default buildConfig({
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),
  collections: [productsCollection({ syncPrice: shop.syncPrice })],
})

// apps/web/instrumentation.ts — the server's assembly, builds shop again for the route handlers
export async function register() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const payload = await getPayload({ config })
  const tx = createTransactionPort(pool)
  courier.fill({ shop: buildShop({ tx, catalog: createPayloadCatalog(payload), billing: buildBilling({ tx }).invoicing }) })
}
```

The web process now has two assemblies: `payload.config.ts` wires shop for the hooks, `register()`
wires it for the route handlers. Two pools, two `tx`, two billing instances exist where
one should; a cart cleared through the route's shop and a price synced through the hook's shop run
on clients that know nothing of each other. `deferredPayloadCatalog()` is the cycle being fought
in the wrong place: the config cannot have the Payload instance that shop's driven adapter needs,
so it fakes having it. A test of the hooks cannot hand them a fake shop either; the config built
the real one at module load. The one assembly fills a courier the hooks read when they run, and
the config declares hooks without holding a single service.
