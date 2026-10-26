---
breaches: [TX-31]
satisfies: [TX-22]
situation: fulfillment books a shipment with the 3PL
---

# The 3PL call takes an idempotency key made at the call

```ts
// fulfillment/service/book-shipment.ts — called by the handler of fulfillment's private BookShipment
export const createBookShipment = ({ warehouse, shipments, transaction }: Deps): BookShipment =>
  async ({ shipmentId, lines, address }) => {
    const booking = await warehouse.book({ lines, address }, { idempotencyKey: randomUUID() })
    await transaction.run((tx) => shipments.recordBooking(shipmentId, booking.ref, tx))
  }
```

The 3PL takes a key, and the call passes one, made fresh each time. The booking succeeds, the process
dies before the handler acknowledges, and `BookShipment` is delivered again: a new key, a second
booking, two parcels for one order. The key that deduplicates is one every delivery carries.
