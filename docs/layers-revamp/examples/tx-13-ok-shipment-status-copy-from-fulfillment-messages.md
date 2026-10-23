---
breaches: []
satisfies: [TX-13]
situation: shop lists a customer's orders filtered by "shipped"; fulfillment knows orders, not customers
---

# Shop keeps an OrderShipping copy, written by fulfillment's ShipmentDispatched messages

```ts
// shop/domain/order-shipping.ts  — shop's aggregate: what fulfillment told shop about one order
export const orderShippingSchema = z.object({
  orderId: orderIdSchema,
  status: z.enum(["pending", "shipped"]),
  shippedAt: z.string().datetime().nullable(),
  trackingUrl: z.string().url().nullable(),
})

// shop/driving/handlers.ts
ShipmentDispatched: async (message: ShipmentDispatched) => { await recordShipment(message) },   // fulfillment's published message

// shop/service/record-shipment.ts
export const createRecordShipment =
  ({ transaction, handled, shipping }: Deps): RecordShipment =>
  async (message) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      await shipping.save(shipped(message), tx)
    })

// shop/service/list-my-orders.ts
export const createListMyOrders =
  ({ orders, shipping }: Deps): ListMyOrders =>
  async ({ customerId, onlyShipped }) => {
    const mine = await orders.byCustomer(customerId)
    const status = await shipping.byOrderIds(mine.map((o) => o.id))
    return mine.filter((o) => !onlyShipped || status.get(o.id)?.status === "shipped").map(toListItem)
  }
```

Fulfillment's open host service offers `getShipmentsForOrder(orderId)`; "the shipped orders of this
customer" is a listing filtered by a term fulfillment does not know, so TX-13's Scope holds and TX-12
governs nothing here. The copy is shop's own aggregate with shop's schema, updated by nothing but
fulfillment's published messages through shop's handler, and the listing reads it like any shop data.
It lags by the relay's moment and drifts where a message is lost, which is what SYS-7's reconciliation,
a scheduled task calling `getShipmentsForOrder` for pending orders older than a day, repairs.
