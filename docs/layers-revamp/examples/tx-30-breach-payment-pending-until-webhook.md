---
breaches: [TX-30]
satisfies: [TX-5]
situation: Stripe stops resending a webhook after three days
---

# A payment stays pending until Stripe's webhook arrives, and nothing else settles it

```ts
// payment/domain/payment.ts
export const paymentSchema = z.object({
  id: z.string(), orderId: z.string(), externalRef: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]),
})

// payment/service/settle-payment.ts — the only use case that leaves "pending", called by the webhook
export const createSettlePayment = ({ payments, handled, outbox, transaction }: Deps): SettlePayment =>
  ({ messageId, externalRef, outcome }) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(messageId, tx))) return
      const payment = await payments.byExternalRef(externalRef, tx)
      await payments.save(settle(payment, outcome), tx)
      await outbox.write(outcome === "succeeded" ? paymentSucceeded(payment) : paymentFailed(payment), tx)
    })
```

The webhook endpoint is down over a weekend, and Stripe stops resending on Monday. The card was
charged; the payment stays `pending`. Shop's deadline passes, shop cancels the order and fulfillment
releases the stock, while the customer's money sits with Stripe. Payment waits on Stripe's answer, and
no business rule says what happens when it does not come: waiting is all it does.
