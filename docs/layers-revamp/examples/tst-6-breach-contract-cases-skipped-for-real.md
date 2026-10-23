---
breaches: [TST-6]
satisfies: [TST-5, TST-8]
situation: fulfillment's StockRepository has a fake and a Drizzle adapter over the shared Postgres
finding: adversarial
---

# One contract suite, run against both, with the cases that differ skipped for the real adapter

```ts
// fulfillment/test/contracts/stock-repository.contract.ts
export const stockRepositoryContract = (name: "fake" | "drizzle", open: OpenStockRepository) =>
    describe(`StockRepository contract: ${name}`, () => {
        let ctx: Awaited<ReturnType<OpenStockRepository>>
        beforeAll(async () => { ctx = await open() })
        afterAll(() => ctx.close())

        it("should load the stock it saved", async () => { /* given / when / then */ })

        it.skipIf(name === "drizzle")("should return null for an unknown sku", async () => {
            // Postgres adapter throws StockNotFound here; "the fake's behaviour is what the services expect"
            // given / when / then
        })

        it.skipIf(name === "drizzle")("should reject a reservation above on-hand", async () => {
            // the CHECK constraint lands in the next migration; green until then
            // given / when / then
        })
    })

// fulfillment/test/contracts/stock-repository.fake.test.ts
stockRepositoryContract("fake", openFakeStockRepository)
// fulfillment/test/contracts/stock-repository.integration.test.ts
describe.runIf(process.env.TEELADEN_INTEGRATION === "1")("drizzle", () => stockRepositoryContract("drizzle", openPostgresContainer))
```

One contract suite is written against the port and run against both implementations, so the Statement is satisfied, the real run is an integration test behind a flag, and both files add a case by adding an `it`. The Why's harm is exactly what the skips buy: on the two cases that matter, the fake asserts a behaviour the real adapter does not have, the services are tested against that fiction, and production throws where the tests saw `null`; the drift the one suite exists to catch is hidden inside it, one `skipIf` at a time. "One contract suite MUST be written against the port and every case of it run against both" is the wording; the per-implementation skip is a second suite in disguise.
