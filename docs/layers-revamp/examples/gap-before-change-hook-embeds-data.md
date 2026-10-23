---
breaches: []
satisfies: []
situation: Payload's beforeChange hook embeds shop's price in the products document Payload is about to save
finding: gap
---

# The hook asks shop for the price and returns it in the data Payload writes

```ts
// catalog/collections/products.hooks.ts — Payload calls this before it writes the document
import type { CollectionBeforeChangeHook } from "payload"
import { courier } from "@teeladen/common"

export const embedPriceBeforeChange: CollectionBeforeChangeHook<ProductDoc> = async ({ data, originalDoc }) => {
  if (data.sku === originalDoc?.sku) return data
  const { priceForSku } = courier.read<ShopServices>()      // a service that answers
  const price = await priceForSku({ sku: data.sku })          // shop's rule: list price by sku
  return { ...data, price: price.amount }                     // Payload writes it with the editor's copy, in Payload's transaction
}

// shop/service/price-for-sku.ts
export const createPriceForSku =
  ({ priceList }: Deps): PriceForSku =>
  async ({ sku }) => {
    const entry = await priceList.bySku(sku)
    if (!entry) throw new NoPriceForSku(sku)
    return entry.price
  }
```

Payload makes the write, in its transaction, with the editor's fields: no use case of shop wrote
a record, so SVC-4's Scope does not hold, no repository ran, and TX-6 has no change of this use
case to bind a `PriceChanged` message to, so none is written. DRV-1's Scope holds on the hook and
its Statement counts calls, one answering call and no act, which is a breach of the letter but
not the question: whether a field shop's rules decide may land in the store by the upstream's
hand, carrying shop's answer. SYS-8 holds on the document and says shop models its fields as its
own aggregate; it says nothing about who may write them. An editor typing a price into the admin
UI ends in the same place, the price arrives in `data` and Payload saves it, with the hook able
to veto at most. A reader wants ruled whether a hook may return data for the upstream to write,
and how the outbox learns of a write this system's repository never made.
