---
breaches: [ASM-2, DVN-2]
satisfies: []
situation: shared Postgres via Drizzle, the store client exported as a ready-made instance beside its factory
---

# A module exports the built Drizzle client; shop's repository imports it

```ts
// common/src/db.ts
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

export const createDb = (pool: Pool) => drizzle(pool)
export const db = createDb(new Pool({ connectionString: process.env.DATABASE_URL }))   // "so nobody has to thread it through"

// shop/src/adapters/drizzle-order-repository.ts
import { db } from "@teeladen/common/db"
import { orders, orderLines } from "./schema"
import type { OrderRepository } from "../domain/ports"

export const createOrderRepository = (): OrderRepository => ({
  async save(order, t) {
    const conn = narrow(t) ?? db
    await conn.insert(orders).values(toOrderRow(order))
    await conn.insert(orderLines).values(order.lines.map(toLineRow(order.id)))
  },
  async load(id) {
    return fromRows(await db.select().from(orders).where(eq(orders.id, id)))
  },
})
```

The factory `createDb` exists, and beside it the module hands out the built thing; the repository
imports it and receives nothing. The pool is opened when the module loads, in every process that
imports common library, the fulfillment worker's instrumentation preload included, and in every
test run, where `DATABASE_URL` is unset and the pool fails on first use. The contract suite cannot
hand this adapter a client over a test container; it talks to whatever `db` connected to. The
breach is ASM-2's one step removed: the importer did not build the dependency, but nobody handed it
over either.
