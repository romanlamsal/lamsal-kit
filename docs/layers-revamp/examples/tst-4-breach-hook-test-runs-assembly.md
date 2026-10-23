---
breaches: [TST-4, TST-2]
satisfies: []
situation: shop's afterChange hook tested by running the web process's assembly and a real Payload instance
---

# The hook's test calls `register()` to get real services into the courier

```ts
// catalog/test/collections/products.hooks.test.ts
import { getPayload } from "payload"
import config from "@payload-config"
import { register } from "../../../apps/web/instrumentation"     // fills the courier with the real graph
import { courier } from "@teeladen/common"
import { syncPriceAfterChange } from "../../src/collections/products.hooks"

beforeAll(async () => {
  process.env.DATABASE_URL = "postgres://localhost/teeladen_test"
  await register()
})

it("should sync the price into shop's table", async () => {
  // given
  const payload = await getPayload({ config })
  const doc = await payload.create({ collection: "products", data: { title: "Sencha", price: 850, sku: "TEA-00001" } })
  const req = await payload.login({ collection: "users", data: { email: "editor@teeladen.test", password: "pw" } })

  // when
  await syncPriceAfterChange({ doc: { ...doc, price: 900 }, previousDoc: doc, req: req as unknown as PayloadRequest, operation: "update", collection: productsCollection, context: {} })

  // then
  expect(await courier.read().shop.queries.priceOf("p-1")).toEqual({ amount: 900, currency: "EUR" })
})
```

The hook received no fakes: its ports come from the real assembly, so the test needs Postgres, runs
Payload's migrations, and `payload.create` fires the very hook under test once before the test
calls it by hand, which is why the assertion reads `900` and hopes the first run's `850` is gone. A
red run can mean the hook's translation, shop's service, the Drizzle repository, Payload's
transaction handling or the database, and the test cannot say which. What the hook does, read the
courier and call `syncPrice` with the actor and the price, is testable with a fake in the courier
and no process started.
