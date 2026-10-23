---
breaches: []
satisfies: [ASM-3, SVC-5, ASM-4, DRV-6]
situation: Payload's own auth supplies req.user; the afterChange hook calls shop's syncPrice
---

# The hook passes `req.user` through the driving port; the service decides by the argument

```ts
// shop/src/service/sync-price.ts
export type SyncPrice = (input: { productId: string; price: Money; actor: { id: string; role: "editor" | "admin" } }) => Promise<void>

export const createSyncPrice = (deps: { tx: TransactionPort; products: ProductCommercialRepository }): SyncPrice =>
  async ({ productId, price, actor }) => {
    if (!mayChangePrice(actor)) throw new NotAllowed("price")          // specification, fed by the argument
    const t = await deps.tx.begin()
    await deps.products.save({ id: productId, price, changedBy: actor.id }, t)
    await deps.tx.commit(t)
  }

// catalog/src/collections/products.hooks.ts — a hook: Payload constructs and calls it
import { courier } from "@teeladen/common"
import type { CollectionAfterChangeHook } from "payload"

export const syncPriceAfterChange: CollectionAfterChangeHook<Product> = async ({ doc, req }) => {
  if (!req.user) return doc
  const { shop } = courier.read()                                      // read when it runs
  await shop.syncPrice({ productId: doc.id, price: Money.parse(doc.price), actor: { id: req.user.id, role: req.user.role } })
  return doc
}

// shop/src/adapters/drizzle-product-commercial-repository.ts — records the request id, decides nothing by it
await conn.insert(priceChanges).values({ ...row, requestId: requestContext.getStore()?.requestId ?? null })
```

Who acted is something the use case decides by, so it is in `SyncPrice`'s signature and the hook
supplies it from the `req` Payload handed it; a second way in, an admin CLI that fixes a price,
sees in the type that it has to bring an actor. The request id is per-request ambient and nobody
decides by it: the driven adapter reads it itself and writes it into the audit column. The service
reads nothing ambiently; it receives its ports through its factory and the actor through its port,
and a test calls `syncPrice` with an `editor` and asserts `NotAllowed` without any request context.
