---
breaches: []
satisfies: [SYS-7, SYS-3, TX-12]
situation: a dropped OrderCancelled leaves stock reserved for a dead order
---

# Shop reconciles its cancelled orders against fulfillment's reservations

```ts
// packages/shop/domain/ports/reservations.ts — fulfillment's open host service, behind shop's driven port
export interface Reservations {
  openForOrders(orderIds: string[]): Promise<string[]>
}

// packages/shop/service/reconcile-reservations.ts — the reconciliation, a use case like any other
export type ReconcileReservations = (input: { cancelledSince: Date }) => Promise<{ republished: number }>

export const createReconcileReservations =
  (orders: OrderRepository, reservations: Reservations, outbox: OutboxPort, tx: Transactions): ReconcileReservations =>
  async ({ cancelledSince }) => {
    const cancelled = await orders.cancelledSince(cancelledSince)
    const byId = new Map(cancelled.map((o) => [o.id, o]))
    const stillReserved = await reservations.openForOrders([...byId.keys()])
    await tx.run(async (t) => {
      for (const orderId of stillReserved) {
        const order = byId.get(orderId)
        if (order) await outbox.write(orderCancelled(order), t)
      }
    })
    return { republished: stillReserved.length }
  }

// apps/server/scheduled.ts — scheduled task
cron.schedule("*/15 * * * *", () => shop.reconcileReservations({ cancelledSince: hoursAgo(48) }))
```

Shop changes fulfillment's stock through messages, so SYS-7 asks shop for a reconciliation of it. The use case compares what shop recorded, orders cancelled, with what fulfillment holds, reservations still open, read through fulfillment's open host service behind a driven port (SYS-3, TX-12), and starts the step that repairs the other's record: it publishes `OrderCancelled` again for the orders fulfillment never released. The lag of a moment the design accepts; the reservation that stays for two days is what this finds. The scheduled task calls it like any driving adapter calls a service.
