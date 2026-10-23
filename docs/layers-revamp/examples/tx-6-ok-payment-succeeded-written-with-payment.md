---
breaches: []
satisfies: [TX-6]
situation: payment records a Stripe webhook and publishes PaymentSucceeded
---

# PaymentSucceeded is inserted into the outbox by the same transaction that saves the Payment

```ts
// payment/service/record-stripe-event.ts
export const createRecordStripeEvent =
  ({ transaction, handled, payments, outbox }: Deps): RecordStripeEvent =>
  async (outcome) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(outcome.eventId, tx))) return
      const payment = await payments.byIntentId(outcome.intentId, tx)
      if (!payment) throw new UnknownIntent(outcome.intentId)
      const next = applyOutcome(payment, outcome)
      await payments.save(next.payment, tx)
      for (const message of next.messages) {
        await outbox.write(message, tx)   // same tx: committed with the Payment, rolled back with it
      }
    })   // commit here, both or neither

// payment/domain/apply-outcome.ts
export const applyOutcome = (payment: Payment, outcome: PaymentOutcome): { payment: Payment; messages: PaymentMessage[] } =>
  outcome.kind === "succeeded"
    ? { payment: succeeded(payment, outcome), messages: [paymentSucceeded(payment, outcome)] }
    : { payment: failed(payment, outcome), messages: [paymentFailed(payment, outcome)] }
```

The domain returns the changed Payment and the messages that tell of the change together, and the
service writes both in one transaction. The process dying after `payments.save` and before `commit`
loses both; dying after commit loses neither, and the relay picks the message up. There is no moment
where the Payment says "succeeded" and no `PaymentSucceeded` exists, so shop's `markOrderPaid` and
billing's invoice follow from every success, never from none.
