---
breaches: [TX-17]
satisfies: []
situation: shop publishes OrderPlaced; fulfillment reserves stock on it
---

# Shop addresses OrderPlaced to the systems it knows will handle it

```ts
// shop/domain/ports/outbox.ts
export interface ShopOutbox {
  write(message: ShopMessage, recipients: readonly SystemName[], tx: Transaction): Promise<void>
}

// shop/service/place-order.ts (inside transaction.run)
await outbox.write(orderPlaced(order), ["fulfillment"], tx)                 // reserve the stock
await outbox.write(sendOrderConfirmation(order, locale), ["shop"], tx)

// shop/service/mark-order-paid.ts (inside transaction.run)
await outbox.write(orderPaid(order), ["billing", "fulfillment"], tx)        // invoice, then ship

// shop/driven/drizzle/outbox.ts
write: async (message, recipients, tx) => {
  await asDrizzle(tx).insert(shopOutbox).values(
    recipients.map((to) => ({ id: message.id, to, type: message.type, payload: message })),   // one row per recipient
  )
},
```

The outbox write names fulfillment and billing, so shop's service knows who reads its messages and the
relay delivers to those and no one else. When shop itself wants to count sales on `OrderPaid` (TX-15),
or a new analytics system wants `OrderPlaced`, the change is a deploy of shop, not a subscription in the
listener's assembly; and when fulfillment stops handling `OrderPaid`, shop keeps writing rows nobody
reads. The `SystemName` union lives in shop and lists its downstreams, so the upstream now depends on
who is downstream of it, against the direction the published language sets.
