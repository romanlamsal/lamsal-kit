---
breaches: [TST-6]
satisfies: []
situation: fulfillment's StockRepository: the fake and the Drizzle adapter each have their own test file
---

# A test file for the fake, another for Drizzle, each asserting its own idea of the port

```ts
// fulfillment/test/fakes/fake-stock-repository.test.ts
it("should throw NotFound for an unknown sku", async () => {
  // given
  const stock = new FakeStockRepository(new FakeTransactionPort())
  // when
  const load = stock.load("TEA-99999")
  // then
  await expect(load).rejects.toBeInstanceOf(NotFound)
})

// fulfillment/test/adapters/drizzle-stock-repository.integration.test.ts
it("should return null for an unknown sku", async () => {
  // given
  const stock = createDrizzleStockRepository(tx)
  // when
  const loaded = await stock.load("TEA-99999")
  // then
  expect(loaded).toBeNull()
})
```

Both suites are green and the two implementations disagree about what `load` does for an unknown
sku. Every fulfillment service test runs on the fake and learns that a missing sku throws, so the
`OrderPlaced` handler's service catches `NotFound` to decide "no stock record yet"; in production
the Drizzle adapter returns `null`, the catch never fires, and the service dereferences `null` on
the first order for a new tea. The two suites drifted exactly the way the fake drifted, because
nothing ran the same assertion against both.
