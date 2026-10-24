---
breaches: [TX-22, TX-5]
satisfies: [TX-1]
situation: fulfillment ships on OrderPaid by calling the 3PL warehouse API, which has no idempotency key
---

# The handler claims the message id in its transaction, calls the 3PL, then fails before commit

```ts
// fulfillment/service/ship-order.ts
type Deps = { transaction: TransactionPort; handled: HandledMessages; shipments: ShipmentRepository; warehouse: Warehouse }

export const createShipOrder =
    ({ transaction, handled, shipments, warehouse }: Deps): ShipOrder =>
    async (message: OrderPaid) =>
        transaction.run(async (tx) => {
            if (!(await handled.claim(message.id, tx))) return          // each message id once
            const reservation = await reservations.byOrderId(message.orderId, tx)
            const consignment = await warehouse.createConsignment(toConsignment(reservation))   // 3PL acts here
            await shipments.save(shipmentFrom(message.orderId, consignment), tx)   // unique (order_id) violated: a
            await outbox.write(orderShipped(message.orderId, consignment.trackingId), tx)        //   second OrderPaid repeat
        })                                                                         //   rolls the claim back too
```

The claim is the first write, in the handler's own transaction, exactly as `tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md` has it for a use case that writes only to fulfillment's store. Here the same use case also books the consignment with the 3PL, and TX-22 has that change made by a use case that writes to no store of fulfillment's. The harm shows why: the 3PL creates the consignment, `shipments.save` fails, the transaction rolls back and the claim with it, the bus redelivers, the claim succeeds afresh and the warehouse ships the order twice. A record of handled ids rolls back with the attempt it guards; the call does not. Split as TX-22 asks, the decision to ship commits with a message, and the use case that handles the message calls the 3PL with the message id as its idempotency key, which this 3PL lacks: that is the external system's side of the problem.
