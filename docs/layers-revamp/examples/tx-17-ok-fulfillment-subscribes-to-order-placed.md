---
breaches: []
satisfies: [TX-17]
situation: shop publishes OrderPlaced; fulfillment reserves stock on it
---

# Shop writes OrderPlaced and names nobody; fulfillment's assembly subscribes its handler

```ts
// shop/domain/messages/order-placed.ts
export const orderPlaced = (order: Order): OrderPlaced => ({
  id: randomUUID(),
  type: "OrderPlaced",
  orderId: order.id,
  customerId: order.customerId,
  placedAt: order.placedAt,
  lines: order.lines.map(({ sku, quantity, unitPrice }) => ({ sku, quantity, unitPrice })),
})

// shop/service/place-order.ts (inside transaction.run)
await outbox.write(orderPlaced(order), tx)            // to shop's outbox; where it goes from here is not shop's business

// shop/published.ts  — export path: schemas and types, no handler, no system named
export { orderPlacedSchema, orderPaidSchema, orderCancelledSchema } from "./domain/messages"
export type { OrderPlaced, OrderPaid, OrderCancelled } from "./domain/messages"

// apps/fulfillment-worker/assembly.ts  — fulfillment decides to listen
const fulfillment = buildFulfillmentWorker({ db, transaction, warehouse })
bus.subscribe("OrderPlaced", fulfillment.handlers.OrderPlaced)
bus.subscribe("OrderPaid", fulfillment.handlers.OrderPaid)
bus.subscribe("OrderCancelled", fulfillment.handlers.OrderCancelled)
```

Nothing in shop knows that fulfillment exists: the message is written to shop's outbox with a type and a
payload, the relay hands it to the bus, and fulfillment's worker assembly is where fulfillment chooses to
subscribe its handler. When billing starts handling `OrderPlaced` too, or fulfillment stops, shop's code
does not change and shop's deploy is not needed. The dependency runs the one way the published language
sets: fulfillment imports shop's schema, shop imports nothing of fulfillment.
