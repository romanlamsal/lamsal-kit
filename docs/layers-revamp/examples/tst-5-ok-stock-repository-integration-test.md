---
breaches: []
satisfies: [TST-5, TST-7]
situation: fulfillment's Drizzle StockRepository over the shared Postgres
---

# The Drizzle `StockRepository` is tested against a real Postgres

```ts
// fulfillment/test/adapters/drizzle-stock-repository.integration.test.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Pool } from "pg"
import { createTransactionPort } from "@teeladen/common"
import { createDrizzleStockRepository } from "../../src/adapters/drizzle-stock-repository"
import { migrate } from "../../src/adapters/migrate"

let container: StartedPostgreSqlContainer
let pool: Pool
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16").start()
  pool = new Pool({ connectionString: container.getConnectionUri() })
  await migrate(pool)
}, 60_000)
afterAll(async () => { await pool.end(); await container.stop() })

it("should load the stock it saved, with reserved quantity intact", async () => {
  // given
  const tx = createTransactionPort(pool)
  const stock = createDrizzleStockRepository(tx)
  const saved = { sku: "TEA-00001", onHand: 40, reserved: 12 }
  const t = await tx.begin()
  await stock.save(saved, t)
  await tx.commit(t)
  // when
  const loaded = await stock.load("TEA-00001")
  // then
  expect(loaded).toEqual(saved)
})
```

The adapter's job is to talk to Postgres, and the test lets it: the SQL runs, the migration runs,
the row-to-aggregate mapping is checked against what Postgres actually returns for `integer` and
`numeric` columns. A mock of the Drizzle client would agree with the adapter's own idea of the
table, which is precisely what is in doubt. The file is named `.integration.test.ts` and runs
under the flag the contract suite uses, outside the default suite.
