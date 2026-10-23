---
breaches: [SYS-11]
satisfies: []
situation: payment creates a Stripe PaymentIntent and handles Stripe's webhooks
---

# The Payment aggregate stores the Stripe PaymentIntent

```ts
// packages/payment/domain/payment.ts
import type Stripe from "stripe"

export const paymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: moneySchema,
  intent: z.custom<Stripe.PaymentIntent>(),
})
export type Payment = z.infer<typeof paymentSchema>

export const isSettled = (p: Payment): boolean => p.intent.status === "succeeded"
export const canRetry = (p: Payment): boolean =>
  p.intent.status === "requires_payment_method" || p.intent.status === "requires_action"

// packages/payment/service/settle-payment.ts
export type SettlePayment = (input: { event: Stripe.Event }) => Promise<void>

export const createSettlePayment =
  (payments: PaymentRepository, outbox: OutboxPort, tx: Transactions): SettlePayment =>
  async ({ event }) =>
    tx.run(async (t) => {
      if (event.data.object.object !== "payment_intent") return
      const payment = await payments.byIntent(event.data.object.id, t)
      if (!payment) throw new PaymentNotFound(event.data.object.id)
      const updated = { ...payment, intent: event.data.object }
      await payments.save(updated, t)
      if (isSettled(updated)) await outbox.write(paymentSucceeded(updated), t)
    })
```

Keeping the whole PaymentIntent is the obvious move: Stripe already models everything, and `z.custom` makes it fit the schema. Now the domain's rules are written in Stripe's terms: `canRetry` is a list of Stripe statuses, `SettlePayment` takes a `Stripe.Event`, and shop's checkout reads `payment.intent.client_secret`. When Stripe adds `requires_capture` or a new API version reshapes the event, the change lands in the domain, the driving port, the repository's column and shop at once, instead of in the adapters that touch Stripe. A test of `createSettlePayment` has to construct a `Stripe.Event`. This is a SHOULD with no ADR naming SYS-11.
