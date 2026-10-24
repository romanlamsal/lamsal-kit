---
breaches: [TX-19]
satisfies: []
situation: fulfillment releases the reservation on OrderCancelled, which can arrive before OrderPlaced
---

# Release-reservation dedupes by state: no reservation means "already released"

```ts
// fulfillment/service/release-reservation.ts
export const createReleaseReservation =
  ({ transaction, reservations, stock }: Deps): ReleaseReservation =>
  async (message: OrderCancelled) =>
    transaction.run(async (tx) => {
      const reservation = await reservations.byOrderId(message.orderId, tx)
      if (!reservation || reservation.status === "released") return   // redelivery, or already handled
      await reservations.save(release(reservation), tx)
      await stock.save(restock(await stock.bySkus(reservation.skus, tx), reservation), tx)
    })

// fulfillment/service/reserve-stock.ts
export const createReserveStock =
  ({ transaction, reservations, stock }: Deps): ReserveStock =>
  async (message: OrderPlaced) =>
    transaction.run(async (tx) => {
      if (await reservations.byOrderId(message.orderId, tx)) return      // redelivery: already reserved
      const levels = await stock.bySkus(message.lines.map((l) => l.sku), tx)
      await reservations.save(reserve(message, levels), tx)
    })
```

Neither service looks at the message id; both infer "seen before" from what fulfillment has stored.
When the relay delivers `OrderCancelled` ahead of `OrderPlaced`, there is no reservation yet, the cancel
is read as a repeat and returns, and the `OrderPlaced` that follows reserves stock for an order shop has
already cancelled, which is the dead reservation domain.md names. The state check also fails as a
dedupe the other way: a redelivered `OrderPlaced` after a genuine release finds no live reservation and
reserves again.
