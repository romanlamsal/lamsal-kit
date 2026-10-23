---
breaches: []
satisfies: []
situation: the checkout saga across shop, payment, billing and fulfillment, undone on PaymentFailed or the deadline
finding: gap
---

# Shop holds the saga in a process manager that sends commands

```ts
// shop/service/checkout-process.ts — a process manager: holds the sequence, sends commands through shop's outbox
export const createCheckoutProcess =
  ({ transactions, orders, outbox }: Deps): CheckoutProcess => ({
    onOrderPlaced: ({ orderId, lines }) =>
      transactions.run((tx) => outbox.write(reserveStock({ orderId, lines }), tx)),      // command, fulfillment handles it
    onStockReserved: ({ orderId }) =>
      transactions.run((tx) => outbox.write(createPayment({ orderId }), tx)),            // command, payment handles it
    onPaymentSucceeded: ({ orderId }) =>
      transactions.run(async (tx) => {
        const order = await orders.byId(orderId, tx)
        await orders.save(markPaid(order), tx)
        await outbox.write(issueInvoice({ orderId }), tx)                                 // command, billing handles it
        await outbox.write(ship({ orderId }), tx)                                         // command, fulfillment handles it
      }),
    onPaymentFailed: ({ orderId }) =>
      transactions.run(async (tx) => {
        const order = await orders.byId(orderId, tx)
        await orders.save(cancel(order), tx)
        await outbox.write(releaseStock({ orderId }), tx)                                // the compensating step
      }),
  })
```

Every step passes its rule: the commands are messages written in shop's outbox in the
transaction of the change (TX-3, TX-6), each handler runs once per id in its own transaction
(TX-5, TX-8), and no handler system is named in code (TX-17). The glossary defines saga,
choreography, orchestration and process manager, and no rule's Scope uses any of them: nothing
rules whether one system holds the sequence or each reacts to the others' events, which system
owns the compensating step, or whether it travels as an event (`OrderCancelled`, fulfillment
decides to release) or a command (`ReleaseStock`, shop decides). The fixture's five steps read
as choreography and the existing examples build it that way; this is the other design, and the
rules say the same about both. A reader wants a default, the situation in which a process
manager is the right call, and whose aggregate holds the saga's state between steps.
