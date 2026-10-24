---
breaches: [TX-5]
satisfies: [TX-8, TX-11]
situation: fulfillment ships on OrderPaid by calling the 3PL warehouse API, which has no idempotency key
finding: adversarial
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

The handler handles each message id once: the claim is the first write, in the handler's own transaction, exactly as `tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md` has it, so the Statement, TX-8 and TX-11 are all met. The Why's harm happens anyway: the 3PL creates the consignment, `shipments.save` fails, the transaction rolls back and the claim with it, the bus redelivers, the claim succeeds afresh and the warehouse ships the order twice, because the call that acts on the external system sat between the claim and its commit. The Statement talks about handling once; the harm is acting twice, and "MUST act on each message id once: a call to an external system comes after the claim of the id has committed" is the wording that puts the claim in a transaction of its own, which `tx-11-ok-shop-handler-sends-confirmation-mail.md` only survives because the mail provider has an idempotency key the 3PL lacks.
