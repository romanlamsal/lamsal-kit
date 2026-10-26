---
breaches: []
satisfies: [TX-29, TX-22]
situation: an editor saves a product in Payload's admin; shop revalidates the cached page, fulfillment registers a new sku with the 3PL
---

# Catalog's config writes `ProductChanged` in the editor's transaction; the relay reads catalog's outbox

```ts
// catalog/collections/products.ts — catalog's config: an external system's code this codebase writes
hooks: {
  afterChange: [
    async ({ doc, previousDoc, req }) => {
      await req.payload.create({
        collection: "outbox",                                 // catalog's own collection, in Payload's store
        data: { type: "ProductChanged", productId: doc.id, slug: doc.slug, sku: doc.sku, previousSku: previousDoc?.sku ?? null },
        req,                                                  // carries req.transactionID: commits with the edit
      })
      return doc
    },
  ],
}

// apps/server/assembly.ts
const bus = createBus({ handlers: [...shop.handlers, ...fulfillment.handlers] })
const relay = createRelay({
  readers: [shop.outboxReader, payloadOutboxReader(payload, { collection: "outbox" })],   // catalog's, from assembly
  bus,
})
// shop's handler of ProductChanged revalidates /products/:slug;
// fulfillment's handler writes RegisterSku to its outbox when the sku is new (TX-22)
```

Catalog's transaction writes the message beside the edit, so `ProductChanged` exists if and only if
the edit committed, and the relay hands it on after the commit. No shop or fulfillment hook runs
inside Payload's save, nothing tentative waits for a confirmation, and a rolled-back save leaves no
trace. The outbox is catalog's and catalog provides no reader, so assembly builds one over the
Payload instance and hands it to the relay. Each handler acts on catalog's message in its own system's
terms.
