---
breaches: []
satisfies: [ASM-8, ASM-1]
situation: web process serving Next.js routes and Payload's admin; hooks and routes read the courier
---

# `register()` fills the courier once, before Next.js serves a request or Payload runs an operation

```ts
// common/src/ambient.ts — the per-process courier
type Produced = { shop: ShopOpenHostService; billing: BillingOpenHostService; payment: PaymentOpenHostService }
let produced: Produced | undefined
export const courier = {
  fill(p: Produced) { produced = p },
  read(): Produced {
    if (!produced) throw new Error("courier empty: assembly has not run")
    return produced
  },
}

// apps/web/instrumentation.ts — assembly; Next.js awaits register() before handling the first request
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const tx = createTransactionPort(pool)
  const payload = await getPayload({ config })               // Payload runs no collection hook while initializing
  const billing = buildBilling({ tx })
  const payment = buildPayment({ tx, stripe: { secretKey: process.env.STRIPE_SECRET_KEY } })
  const shop = buildShop({ tx, catalog: createPayloadCatalog(payload), billing: billing.invoicing, payment: payment.payments })
  courier.fill({ shop, billing, payment })
}
```

Payload's hooks and the route handlers read the courier when they run; here it is filled by
assembly, in the one hook the framework gives a process before its first request, so no request
and no editor's save finds it empty. Nothing but `register()` calls `fill`, so the instances the
hooks get are the instances the routes get, built once from one pool. The order inside `register()`
matters: the Payload instance comes first because shop's driven adapter needs it, and `fill` comes
last because it is what makes the driving adapters live.
