---
breaches: []
satisfies: [TX-30, TX-22]
situation: Stripe stops resending a webhook after three days
---

# Payment's business rule asks Stripe once the answer is overdue

```ts
// payment/domain/payment.ts
export const paymentSchema = z.object({
  id: z.string(), orderId: z.string(), externalRef: z.string(),
  status: z.enum(["pending", "succeeded", "failed", "abandoned"]),
  answerDueBy: z.string().datetime(),                      // a business rule: one hour after creation
})
export const isOverdue = (p: Payment, now: Date) => p.status === "pending" && new Date(p.answerDueBy) < now

// payment/service/settle-overdue-payments.ts — called by a scheduled task every five minutes
export const createSettleOverduePayments = ({ payments, gateway, outbox, transaction, clock }: Deps): SettleOverduePayments =>
  async () => {
    for (const payment of await payments.overdue(clock.now())) {
      const status = await gateway.status(payment.externalRef)           // asks Stripe: a read
      await transaction.run(async (tx) => {
        const next = settleFromStatus(payment, status)                   // succeeded, failed, or abandoned
        await payments.save(next, tx)
        await outbox.write(messageFor(next), tx)                         // abandoned: CancelPaymentIntent, private
      })
    }
  }
```

The payment carries when its answer is due, and a business rule decides what happens then: payment
asks Stripe, a reconciliation, and settles by what Stripe holds. A PaymentIntent nobody confirmed is
abandoned, and its cancellation at Stripe goes through payment's outbox (TX-22). The webhook stays
the usual way in; the deadline ends the waiting when it does not come.
