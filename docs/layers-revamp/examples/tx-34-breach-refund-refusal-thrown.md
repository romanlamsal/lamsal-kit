---
breaches: [TX-34]
satisfies: [TX-1, DRV-7]
situation: payment refunds when shop asks, but not a disputed charge
---

# Payment refuses a refund by throwing

```ts
// payment/service/refund-payment.ts — called by payment's handler for shop's RefundPayment
export const createRefundPayment = ({ transaction, handled, payments, refunds, outbox }: Deps): RefundPayment =>
  (command) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(command.id, tx))) return
      const payment = await payments.byOrderId(command.orderId, tx)
      if (isDisputed(payment)) throw new PaymentDisputed(payment.id)        // business rule says no
      const refund = newRefund(payment, command.amount)
      await refunds.save(refund, tx)
      await outbox.write(stripeRefundRequested(refund), tx)                 // private, TX-22
    })
```

The throw rolls back the claim, so the handler does not acknowledge and the bus delivers the command
again. The charge is still disputed, so the rule refuses again, five times, and the bus parks the
command in the dead-letter queue. Shop sent the refund and told the customer the money is on its way.
Nothing it handles says otherwise, and retrying the parked command later refuses it once more.
