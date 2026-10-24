---
breaches: [TX-12]
satisfies: []
situation: shop lists a customer's orders filtered by "shipped"; fulfillment knows orders, not customers
---

# The OrderShipping copy is refreshed by a scheduled task that queries fulfillment's `shipments` table

```ts
// shop/driving/scheduled/sync-shipping.ts  (scheduled task, every minute)
export const syncShipping = (deps: { refreshShipping: RefreshShipping }) => async () => { await deps.refreshShipping() }

// shop/service/refresh-shipping.ts
export const createRefreshShipping =
  ({ transaction, shipping, shipmentsSource }: Deps): RefreshShipping =>
  async () =>
    transaction.run(async (tx) => {
      const dispatched = await shipmentsSource.dispatchedSince(await shipping.lastSyncedAt(tx))
      for (const row of dispatched) await shipping.save(shipped(row), tx)
    })

// shop/driven/drizzle/shipments-source.ts  — reads fulfillment's table; no message, no open host service
export const createDrizzleShipmentsSource = (db: Db): ShipmentsSource => ({
  dispatchedSince: async (since) =>
    (await db.execute(sql`
      select order_id, dispatched_at, tracking_url
      from fulfillment_shipments
      where status = 'dispatched' and dispatched_at > ${since}
    `)).rows.map(toDispatchedRow),
})
```

The copy is kept, and the filter works, but it is fed by a query against fulfillment's storage rather
than by fulfillment's published messages, one of the two ways TX-12 permits the read.
Fulfillment's rules are bypassed: a shipment fulfillment later marks `returned_to_sender` stays
"shipped" in shop, because the query knows one status string and nothing of what fulfillment means by
it. The raw SQL compiles against any schema, so fulfillment's renaming `dispatched_at` breaks shop at
runtime with no compile error, and the sync silently stops updating anything.
