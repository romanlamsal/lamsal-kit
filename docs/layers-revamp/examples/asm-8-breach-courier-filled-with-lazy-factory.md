---
breaches: [ASM-8]
satisfies: [DRV-3, DRV-6, ASM-4]
situation: web process serving Next.js routes and Payload's admin; hooks and routes read the courier
finding: adversarial
---

# `register()` fills the courier before any request, with a factory instead of the instance

```ts
// common/src/ambient.ts
type Produced = { shop: () => ShopOpenHostService; billing: () => BillingOpenHostService }
let produced: Produced | undefined
export const courier = {
    fill(p: Produced) { produced = p },
    read(): Produced { if (!produced) throw new Error("courier empty"); return produced },
}

// apps/web/instrumentation.ts  (assembly; runs before the first request)
export async function register() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const tx = createTransactionPort(pool)
    const payload = await getPayload({ config })
    courier.fill({
        billing: () => buildBilling({ tx }),                                   // "cheap to build, build on demand"
        shop: () => buildShop({ tx, catalog: createPayloadCatalog(payload), billing: buildBilling({ tx }).invoicing }),
    })
}

// apps/web/app/api/checkout/route.ts  (driving adapter)
export async function POST(request: Request) {
    const shop = courier.read().shop()        // read when it runs; every request gets a freshly built shop
    // ...
}
```

Assembly, and nothing else, fills the courier, directly, before any driving adapter runs: the Statement is met, and DRV-3, DRV-6 and ASM-4 are met on the reading side. The Why's harm follows anyway: the courier holds what produces instances rather than the instances, so each request builds a shop and a billing of its own and the hooks build another, which is "a second place produces instances" with assembly's own code as that place. "Assembly MUST fill it with the instances it produced" is the wording; the glossary's "what assembly produced" meant that and the Statement leaves it to the type of `Produced`.
