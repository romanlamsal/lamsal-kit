---
breaches: [TST-5, TST-7]
satisfies: []
situation: fulfillment's Drizzle StockRepository unit-tested against a mocked Drizzle client
---

# The Drizzle `StockRepository` tested with a mocked client

```ts
// fulfillment/test/adapters/drizzle-stock-repository.test.ts
import { createDrizzleStockRepository } from "../../src/adapters/drizzle-stock-repository"

const values = vi.fn().mockResolvedValue(undefined)
const insert = vi.fn(() => ({ values }))
const where = vi.fn().mockResolvedValue([{ sku: "TEA-00001", on_hand: 40, reserved: 12 }])
const from = vi.fn(() => ({ where }))
const select = vi.fn(() => ({ from }))
const db = { insert, select } as unknown as Database

it("should insert the stock row", async () => {
  // given
  const stock = createDrizzleStockRepository(fakeTxOver(db))
  // when
  await stock.save({ sku: "TEA-00001", onHand: 40, reserved: 12 }, fakeTransaction)
  // then
  expect(insert).toHaveBeenCalledWith(stockTable)
  expect(values).toHaveBeenCalledWith({ sku: "TEA-00001", on_hand: 40, reserved: 12 })
})
```

The mock returns rows shaped the way the author believes Postgres shapes them, and the assertion
checks that the adapter called the builder the way the author wrote it: the test passes when the
adapter agrees with itself. A `numeric` column coming back as a string, a missing migration, a
unique index on `sku` the `insert` violates on the second save, none of it reaches this test, and
all of it is what the adapter exists to get right. The assertions on `insert` and `values` break
on the first refactor to an `upsert` while the behavior is unchanged. The mapping `rowToStock` is a
function and gets a direct test; the rest is an integration test or no test.
