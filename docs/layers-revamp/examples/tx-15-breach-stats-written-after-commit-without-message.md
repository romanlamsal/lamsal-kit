---
breaches: [TX-15]
satisfies: []
situation: shop marks the order paid and keeps a lifetime-spend statistic per customer
---

# CustomerStats is updated by a second write after the commit, with no message behind it

```ts
// shop/service/mark-order-paid.ts
export const createMarkOrderPaid =
  ({ transaction, handled, orders, outbox, stats }: Deps): MarkOrderPaid =>
  async (message: PaymentSucceeded) => {
    const order = await transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return null
      const order = await orders.byId(message.orderId, tx)
      if (!order) throw new OrderNotFound(message.orderId)
      await orders.save(markPaid(order, message.paymentId), tx)
      await outbox.write(orderPaid(order), tx)
      return order
    })
    if (!order) return
    // stats are not business-critical; a moment late is fine, so do them after the commit
    const current = (await stats.byCustomerId(order.customerId)) ?? emptyStats(order.customerId)
    await stats.save(addSale(current, order.total))
  }
```

The later write arriving a moment later is indeed harmless, so TX-15's Scope holds; what it permits is a
message in the outbox for the rest, and this is a bare second call after the commit instead. When
`stats.save` fails, deadlock, timeout, process gone, nothing retries it: there is no message to
redeliver, no handler to fail, no trace that a sale went uncounted, and the figure is off for that
customer for good. The paid mark and the statistic have become two writes with no transaction and no
message between them, which is neither of the two things the rules allow.
