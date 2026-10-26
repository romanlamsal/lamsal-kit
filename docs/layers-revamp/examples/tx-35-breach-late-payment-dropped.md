---
breaches: [TX-35]
satisfies: [TX-5, DRV-7]
situation: a payment succeeds after shop's deadline cancelled the order
---

# Shop's mark-paid returns when the order is already cancelled

```ts
// shop/service/mark-order-paid.ts — called for payment's PaymentSucceeded
export const createMarkOrderPaid = ({ transaction, handled, orders, outbox }: Deps): MarkOrderPaid =>
  (event) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(event.id, tx))) return
      const order = await orders.byId(event.orderId, tx)
      if (order.status === "cancelled") return                 // too late, nothing to do
      await orders.save(markPaid(order), tx)
      await outbox.write(orderPaid(order), tx)
    })
```

The customer paid in the last second; the deadline task cancelled the order a moment before the
webhook reached payment. Shop acknowledges `PaymentSucceeded` and does nothing. The stock was released,
no invoice follows, and the customer's card stays charged. The early return reads like a guard, and
nothing in the domain says the shop decided to keep the money.
