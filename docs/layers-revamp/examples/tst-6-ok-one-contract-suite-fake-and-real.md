---
breaches: []
satisfies: [TST-6, TST-8]
situation: fulfillment's StockRepository has a fake and a Drizzle adapter over the shared Postgres
---

# One contract suite for `StockRepository`, run against the fake and against Drizzle

```ts
// fulfillment/test/contracts/stock-repository.contract.ts
export const stockRepositoryContract = (name: string, open: () => Promise<{ stock: StockRepository; tx: TransactionPort; close(): Promise<void> }>) =>
  describe(`StockRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<typeof open>>
    beforeAll(async () => { ctx = await open() })
    afterAll(() => ctx.close())

    it("should load the stock it saved", async () => {
      // given
      const saved = { sku: "TEA-00001", onHand: 40, reserved: 12 }
      const t = await ctx.tx.begin()
      await ctx.stock.save(saved, t)
      await ctx.tx.commit(t)
      // when
      const loaded = await ctx.stock.load("TEA-00001")
      // then
      expect(loaded).toEqual(saved)
    })

    it("should not see a save whose transaction rolled back", async () => { /* given / when / then */ })
    it("should return null for an unknown sku", async () => { /* given / when / then */ })
  })

// fulfillment/test/contracts/stock-repository.fake.test.ts
stockRepositoryContract("fake", async () => { const tx = new FakeTransactionPort(); return { stock: new FakeStockRepository(tx), tx, close: async () => {} } })

// fulfillment/test/contracts/stock-repository.integration.test.ts
describe.runIf(process.env.TEELADEN_INTEGRATION === "1")("drizzle", () => stockRepositoryContract("drizzle", openPostgresContainer))
```

The suite is written against the port's signature and its promises, and nothing in it names the
fake or Drizzle. The run against Drizzle is the adapter's integration test; the run against the
fake is what keeps the fake honest: the day the real adapter starts returning `null` for an unknown
sku while the fake throws, one of the two runs fails on the same `it`, and the fake gets fixed
instead of the service tests built on it silently testing a fiction. Both files add a case by
adding an `it` to the one contract.
