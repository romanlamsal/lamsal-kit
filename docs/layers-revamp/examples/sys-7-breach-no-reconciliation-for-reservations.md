---
breaches: [SYS-7]
satisfies: [TX-3, TX-6]
situation: a dropped OrderCancelled leaves stock reserved for a dead order
---

# The outbox is trusted to make reconciliation unnecessary

```ts
// packages/shop/service/cancel-order.ts
export const createCancelOrder =
  (orders: OrderRepository, outbox: OutboxPort, tx: Transactions): CancelOrder =>
  ({ orderId, reason }) =>
    tx.run(async (t) => {
      const order = await orders.byId(orderId, t)
      if (!order || !isCancellable(order)) throw new OrderNotOpen(orderId)
      const cancelled = cancel(order, reason)
      await orders.save(cancelled, t)
      // fulfillment releases the reservation on this. Outbox plus relay retry: it cannot get lost.
      await outbox.write(orderCancelled(cancelled), t)
    })

// apps/server/scheduled.ts — every scheduled task shop has
cron.schedule("*/5 * * * *", () => shop.expireUnpaidOrders({ now: new Date() }))
cron.schedule("0 6 * * *", () => billing.runDunning({ asOf: new Date() }))
```

The message is written in the change's transaction (TX-6) and the change to fulfillment's data goes through the outbox (TX-3), so the comment is right that the message is as committed as the cancellation. Delivery is what the relay guarantees; handling is not. Fulfillment's handler gets `OrderCancelled` before `OrderPlaced` (fixture) and fails for good, or a deploy ships a handler bug for a day, and the reservation stays. Nothing in shop ever compares its cancelled orders with fulfillment's reservations, so the stock sits in the warehouse while the shop page says sold out, until a customer asks. The gap that stays is SYS-7's harm, and the outbox does not look for it.
