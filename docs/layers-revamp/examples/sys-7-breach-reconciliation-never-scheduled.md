---
breaches: [SYS-7]
satisfies: [SVC-1, SVC-4]
situation: a dropped OrderCancelled leaves stock reserved for a dead order
finding: adversarial
---

# Shop has a reconciliation for its reservations; nothing ever calls it

```ts
// shop/service/reconcile-reservations.ts  (a use case: compares, repairs, exactly as the glossary says)
export type ReconcileReservations = (input: { asOf: Date }) => Promise<{ repaired: number }>

export const createReconcileReservations =
    ({ orders, reservations, outbox, transactions }: ReconcileDeps): ReconcileReservations =>
    async ({ asOf }) => {
        const cancelled = await orders.findCancelledSince(asOf.getTime() - DAY)
        const held = await reservations.heldFor(cancelled.map((o) => o.id))       // through fulfillment's open host service
        return transactions.run(async (tx) => {
            for (const r of held) await outbox.write(orderCancelled(cancelled.find((o) => o.id === r.orderId)!), tx)
            return { repaired: held.length }
        })
    }

// shop/builders/open-host-service.ts
export const buildShop = (deps: ShopDeps) => ({
    placeOrder: createPlaceOrder(deps), cancelOrder: createCancelOrder(deps),
    reconcileReservations: createReconcileReservations(deps),      // offered; "ops can trigger it when needed"
})

// apps/server/scheduled.ts — every scheduled task shop has
cron.schedule("*/5 * * * *", () => shop.expireUnpaidOrders({ now: new Date() }))
```

Shop has a reconciliation for the data it changes through messages: a use case that compares after the fact and starts the repair, offered on the open host service, so the Statement is satisfied. The Why's harm is identical to `sys-7-breach-no-reconciliation-for-reservations.md`: the gap stays, because no scheduled task and no driving adapter that notices drift calls `reconcileReservations`, and a use case nobody reaches finds nothing. The Why says it "is called like any use case, by a scheduled task, or by whichever driving adapter notices the drift"; the Statement needs that too, as "It MUST have a reconciliation for it, with a driving adapter that runs it".
