---
breaches: [ASM-1]
satisfies: [ASM-8, DRV-3]
situation: web process serving Next.js routes and Payload's admin; Payload's config needs shop's hooks
finding: adversarial
---

# One assembly function, called from `register()` and again from Payload's `onInit`

```ts
// apps/web/assembly.ts  (the one assembly)
export async function assemble(): Promise<Produced> {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const tx = createTransactionPort(pool)
    const payload = await getPayload({ config })
    const billing = buildBilling({ tx })
    const shop = buildShop({ tx, catalog: createPayloadCatalog(payload), billing: billing.invoicing })
    const produced = { shop, billing }
    courier.fill(produced)
    return produced
}

// apps/web/instrumentation.ts
export async function register() { await assemble() }

// apps/web/payload.config.ts
export default buildConfig({
    onInit: async () => { await assemble() },     // Payload's own init path: make sure the hooks find the courier
    collections: [products],
})
```

The process has one assembly: one module, one function, the only place `fill` is called, so the Statement holds. Its Why does not: `assemble` runs twice, once from `register()` and once from `onInit`, and the second run opens a second pool, builds a second shop and a second billing and fills the courier with them, so hooks and routes get instances from different runs, and `/health` pings a pool the routes no longer use. "MUST have one assembly, run once per process" is the wording; the fixture's config-hooks-services cycle is what makes the second call look reasonable.
