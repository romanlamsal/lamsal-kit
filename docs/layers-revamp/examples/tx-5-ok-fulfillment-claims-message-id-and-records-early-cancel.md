---
breaches: []
satisfies: [TX-5, TX-19, TX-1]
situation: fulfillment handles OrderPlaced and OrderCancelled, which arrive repeated and out of order
---

# The handler's service claims the message id first and lets the domain place an early cancel

```ts
// fulfillment/service/apply-order-message.ts
type Deps = { transaction: TransactionPort; handled: HandledMessages; fulfillments: OrderFulfillmentRepository; reservations: ReservationRepository }

export const createApplyOrderMessage =
  ({ transaction, handled, fulfillments, reservations }: Deps): ApplyOrderMessage =>
  async (message: OrderPlaced | OrderCancelled) =>
    transaction.run(async (tx) => {
      const fresh = await handled.claim(message.id, tx)   // INSERT ... ON CONFLICT DO NOTHING on the message id
      if (!fresh) return                                   // same id delivered again: nothing to do
      const current =
        (await fulfillments.byOrderId(message.orderId, tx)) ?? unknownOrder(message.orderId)
      const next = applyOrderMessage(current, message)     // domain: a cancel with no placed order records "cancelled"
      await fulfillments.save(next.fulfillment, tx)        //         a placed order already cancelled reserves nothing
      for (const reservation of next.reservations) await reservations.save(reservation, tx)
      for (const released of next.released) await reservations.save(released, tx)
    })
```

The handler recognizes a repeat by the message id alone: the claim is a write in the same transaction
as the reservation, so a failure after claiming rolls the claim back and the redelivery runs again,
while a success means the second delivery returns at the first line. "Not found" is never read as
"already handled": an `OrderCancelled` that arrives before `OrderPlaced` finds no OrderFulfillment and
records a cancelled one, and the later `OrderPlaced` meets that record and reserves nothing, so no stock
stays reserved for a dead order.
