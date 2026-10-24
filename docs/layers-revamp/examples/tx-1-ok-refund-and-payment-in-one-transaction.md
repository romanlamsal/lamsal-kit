---
breaches: []
satisfies: [TX-1, TX-22]
situation: payment records a Refund and reduces the Payment's refundable amount
---

# Refund-payment writes the Refund and the Payment in one transaction

```ts
// payment/service/refund-payment.ts
type Deps = { transaction: TransactionPort; payments: PaymentRepository; refunds: RefundRepository; outbox: PaymentOutbox }

export const createRefundPayment =
  ({ transaction, payments, refunds, outbox }: Deps): RefundPayment =>
  async ({ paymentId, amount, reason }) =>
    transaction.run(async (tx) => {
      const payment = await payments.byId(paymentId, tx)
      if (!payment) throw new PaymentNotFound(paymentId)
      if (!mayRefund(payment, amount)) throw new RefundExceedsPayment(paymentId, amount)   // specification
      const refund = newRefund(payment, amount, reason)
      await refunds.save(refund, tx)
      await payments.save(withRefund(payment, refund), tx)       // refundable amount goes down
      await outbox.write(stripeRefundRequested(refund), tx)      // private: payment's handler calls Stripe (TX-22)
      return { refundId: refund.id }
    })
```

The Refund and the Payment are two aggregates of payment, and the use case is not done until both are
written: a Refund recorded while the Payment still shows the full refundable amount lets the next
`refundPayment` pass `mayRefund` and refund the same money twice. In one transaction, held by the
service, a failure after `refunds.save` takes the Refund back with it, and there is no moment where the
two disagree and nothing to reconcile.
