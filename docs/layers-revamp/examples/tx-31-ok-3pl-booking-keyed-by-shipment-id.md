---
breaches: []
satisfies: [TX-31, TX-22]
situation: fulfillment books a shipment with the 3PL
---

# The 3PL call takes the shipment id the message carries as its idempotency key

```ts
// fulfillment/service/book-shipment.ts — called by the handler of fulfillment's private BookShipment
export const createBookShipment = ({ warehouse, shipments, transaction }: Deps): BookShipment =>
  async ({ shipmentId, lines, address }) => {
    const booking = await warehouse.book({ lines, address }, { idempotencyKey: shipmentId })
    await transaction.run((tx) => shipments.recordBooking(shipmentId, booking.ref, tx))
  }
```

`shipmentId` was made when the use case that decided the shipment wrote `BookShipment`, and every
delivery of the message carries it. A redelivery after the booking succeeded calls the 3PL with the
same key and gets the first booking back; recording its reference again changes nothing. The use
case decides nothing: the decision committed with the message (TX-22).
