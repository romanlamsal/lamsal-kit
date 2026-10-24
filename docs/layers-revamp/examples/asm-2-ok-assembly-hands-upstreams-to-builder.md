---
breaches: []
satisfies: [ASM-2, ASM-1, ASM-8]
situation: web process assembly resolves the Payload config/hooks/services cycle and hands shop its upstreams
---

# Assembly builds billing, payment and the Payload adapter, then hands them to shop's builder

```ts
// apps/web/instrumentation.ts — Next.js runs register() once per process, before the first request
import { Pool } from "pg"
import { getPayload } from "payload"
import config from "@payload-config"
import { courier, createTransactionPort } from "@teeladen/common"
import { buildBilling } from "@teeladen/billing"
import { buildPayment } from "@teeladen/payment"
import { buildShop, createPayloadCatalog } from "@teeladen/shop"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const tx = createTransactionPort(pool)
  const payload = await getPayload({ config })                  // the external system's instance, built once
  const billing = buildBilling({ tx })
  const payment = buildPayment({ tx, stripe: { secretKey: process.env.STRIPE_SECRET_KEY } })
  const shop = buildShop({
    tx,
    catalog: createPayloadCatalog(payload),                     // shop's driven adapter over the Local API
    billing: billing.invoicing,                                 // shop's driven port, implemented by billing's service
    payment: payment.payments,
  })
  courier.fill({ shop, billing, payment })
}

// shop/src/build.ts — the system builder receives every dependency, builds nothing it could receive
export const buildShop = (deps: { tx: TransactionPort; catalog: CatalogPort; billing: BillingPort; payment: PaymentIntents }) => ({
  checkout: createCheckout({ ...deps, orders: createOrderRepository(deps.tx), carts: createCartRepository(deps.tx), outbox: createShopOutbox(deps.tx) }),
  syncPrice: createSyncPrice({ tx: deps.tx, products: createProductCommercialRepository(deps.tx) }),
})
```

`buildShop` receives its upstreams, billing's and payment's open host services, and the Payload
instance wrapped in shop's own driven adapter, so billing, payment and the pool each exist once and
the whole graph is readable in `register()`. The cycle in the fixture is broken by order: the Payload
instance is built first, the config declares hooks that hold no service (they read the courier when
they run), and the courier is filled after the builders return and before Next.js serves a request
or Payload runs an operation. A test of shop hands `buildShop` a fake `BillingPort` and a fake
`CatalogPort`, and never starts Payload.
