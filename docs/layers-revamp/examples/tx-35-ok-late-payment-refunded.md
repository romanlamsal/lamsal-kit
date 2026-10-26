---
breaches: []
satisfies: [TX-35, TX-3, SYS-13, TX-5]
situation: a payment succeeds after shop's deadline cancelled the order
---

# Shop's domain decides a late payment is refunded, and asks payment for it

```ts
// shop/domain/order.ts
export const onPaymentSucceeded = (order: Order, payment: { amount: Money }): PaymentOutcome =>
  order.status === "cancelled"
    ? { order, refund: { orderId: order.id, amount: payment.amount } }   // business rule: the money goes back
    : { order: markPaid(order), refund: undefined }

// shop/service/apply-payment-succeeded.ts
import { refundPayment } from "@teeladen/payment/published"             // payment's command (SYS-13)

(event) =>
  transaction.run(async (tx) => {
    if (!(await handled.claim(event.id, tx))) return
    const order = await orders.byId(event.orderId, tx)
    const outcome = onPaymentSucceeded(order, event)
    await orders.save(outcome.order, tx)
    await outbox.write(outcome.refund ? refundPayment(outcome.refund) : orderPaid(outcome.order), tx)
  })
```

Shop holds the cancelled order, so shop's business rule decides: the customer gets the money back.
The refund is payment's to make, so shop asks for it through its outbox, in the transaction that
handles the event. If payment refuses, its `RefundRefused` reaches shop and the same kind of rule
decides again.
