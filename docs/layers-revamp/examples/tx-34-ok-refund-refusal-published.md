---
breaches: []
satisfies: [TX-34, TX-5, TX-1]
situation: payment refunds when shop asks, but not a disputed charge
---

# Payment publishes `RefundRefused` and succeeds

```ts
// payment/published/messages.ts
export const refundRefusedSchema = z.object({
  id: z.string().uuid(), type: z.literal("RefundRefused"),
  orderId: z.string(), reason: z.enum(["disputed", "already-refunded"]),
})

// payment/service/refund-payment.ts
(command) =>
  transaction.run(async (tx) => {
    if (!(await handled.claim(command.id, tx))) return
    const payment = await payments.byOrderId(command.orderId, tx)
    const decision = decideRefund(payment, command.amount)                 // domain
    if (decision.refused) {
      await outbox.write(refundRefused(command.orderId, decision.reason), tx)
      return                                                                // commits: the use case succeeded
    }
    const refund = newRefund(payment, command.amount)
    await refunds.save(refund, tx)
    await outbox.write(stripeRefundRequested(refund), tx)
  })
```

The refusal commits with the claimed command id, so the handler acknowledges and a repeat finds the id
and returns. `RefundRefused` is payment's event, naming no system; shop subscribes to it and decides
what follows for its order.
