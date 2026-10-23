---
breaches: []
satisfies: [TX-15, TX-6]
situation: shop marks the order paid and keeps a lifetime-spend statistic per customer
---

# Mark-order-paid writes the Order and OrderPaid; CustomerStats follows by shop's own handler

```ts
// shop/service/mark-order-paid.ts
export const createMarkOrderPaid =
  ({ transaction, handled, orders, outbox }: Deps): MarkOrderPaid =>
  async (message: PaymentSucceeded) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      const order = await orders.byId(message.orderId, tx)
      if (!order) throw new OrderNotFound(message.orderId)
      await orders.save(markPaid(order, message.paymentId), tx)
      await outbox.write(orderPaid(order), tx)   // published; billing, fulfillment and shop itself handle it
    })

// shop/driving/handlers.ts
OrderPaid: async (message: OrderPaid) => { await recordSale(message) },

// shop/service/record-sale.ts  — the CustomerStats aggregate, a moment later
export const createRecordSale =
  ({ transaction, handled, stats }: Deps): RecordSale =>
  async (message) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      const current = (await stats.byCustomerId(message.customerId, tx)) ?? emptyStats(message.customerId)
      await stats.save(addSale(current, message.total), tx)
    })
```

Order and CustomerStats are both shop's aggregates and both change because of one payment, but a
lifetime-spend figure that is a moment behind the order it counts harms nobody, so TX-15's Scope holds
and TX-14 governs nothing here. The Order and the `OrderPaid` message commit together; the statistic is
written in the handler's own transaction and retried by redelivery if it fails, instead of holding a
lock on CustomerStats through the payment's transaction and failing the paid mark when the statistic
write hiccups.
