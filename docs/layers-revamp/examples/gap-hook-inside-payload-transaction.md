---
breaches: []
satisfies: []
situation: Payload's afterChange hook runs inside the editor's save transaction (req.transactionID) and calls shop's syncPrice
finding: gap
---

# The hook hands Payload's transaction into shop's driving port, and the service joins it

```ts
// catalog/collections/products.hooks.ts — Payload calls this inside the transaction of the editor's save
import type { CollectionAfterChangeHook } from "payload"
import { courier } from "@teeladen/common"
import { fromPayloadTransaction } from "@teeladen/shop/payload"   // wraps req.transactionID as shop's opaque Transaction

export const syncPriceAfterChange: CollectionAfterChangeHook<ProductDoc> = async ({ doc, previousDoc, req }) => {
  if (doc.price === previousDoc?.price) return doc
  const { syncPrice } = courier.read<ShopServices>()
  await syncPrice({
    productId: doc.id,
    price: { amount: doc.price, currency: "EUR" },
    actor: req.user ? { kind: "editor", userId: req.user.id } : { kind: "system" },
    tx: req.transactionID ? fromPayloadTransaction(req.transactionID) : undefined,
  })
  return doc
}

// shop/service/sync-price.ts — joins the caller's transaction when handed one, opens its own otherwise
export const createSyncPrice =
  ({ transactions, commercials, outbox }: Deps): SyncPrice =>
  async ({ productId, price, actor, tx }) => {
    const work = async (t: Transaction) => {
      const current = await commercials.byProductId(productId, t)
      if (!current) throw new ProductNotFound(productId)
      await commercials.save(withPrice(current, price), t)
      await outbox.write(priceChanged({ productId, price, actor }), t)
    }
    return tx ? work(tx) : transactions.run(work)
  }
```

TX-1 comes closest: its Scope holds, one use case writing two of shop's aggregates in one
transaction, but its Statement has the service open the transaction, and here a product opened
it before the hook ran. TX-6's Scope does not hold: the change the editor's save makes is
Payload's, not this use case's, so nothing rules that `PriceChanged` must commit with it, and
without the join a rollback of the editor's save leaves a committed message telling of a price
Payload never stored. DOM-6 holds only on the repository signature, ASM-9 is satisfied because
the transaction travels as an argument. No rule's Scope covers a driving adapter called inside a
transaction its caller holds, or a driving port that takes a transaction. A reader wants ruled
whether a driving port may carry a transaction at all, and if not, what protects shop's writes
from the upstream's rollback.
