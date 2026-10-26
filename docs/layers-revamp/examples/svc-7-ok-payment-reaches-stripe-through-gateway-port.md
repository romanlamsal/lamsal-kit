---
breaches: []
satisfies: [SVC-7, DVN-4, TX-5]
situation: payment creates a Stripe PaymentIntent and handles Stripe's webhooks
---

# Payment reaches Stripe through its `PaymentGateway` port; Stripe's terms stop in `stripe/`

```ts
// packages/payment/service/ports/payment-gateway.ts — driven port, payment's terms
export interface PaymentGateway {
  authorize(input: { paymentId: string; amount: Money }): Promise<{ externalRef: string; clientSecret: string }>
}

// packages/payment/stripe/gateway.ts — driven adapter, the way out
import Stripe from "stripe"                                   // the external system's package (DVN-4)

export const stripePaymentGateway = (stripe: Stripe): PaymentGateway => ({
  async authorize({ paymentId, amount }) {
    const intent = await stripe.paymentIntents.create(
      { amount: amount.amount, currency: amount.currency, metadata: { paymentId } },
      { idempotencyKey: paymentId },
    )
    if (!intent.client_secret) throw new GatewayError(intent.id)
    return { externalRef: intent.id, clientSecret: intent.client_secret }
  },
})

// packages/payment/stripe/webhook.ts — hook, the way in
export const stripeWebhook =
  (stripe: Stripe, signingSecret: string, settlePayment: SettlePayment) =>
  async (rawBody: string, signature: string): Promise<void> => {
    const event = stripe.webhooks.constructEvent(rawBody, signature, signingSecret)
    if (event.type === "payment_intent.succeeded")
      await settlePayment({ messageId: event.id, externalRef: event.data.object.id, outcome: "succeeded" })
    else if (event.type === "payment_intent.payment_failed")
      await settlePayment({ messageId: event.id, externalRef: event.data.object.id, outcome: "failed" })
  }
```

Payment's service reaches Stripe through `PaymentGateway`, a driven port in payment's terms, and
its test hands it a fake gateway. `stripe` is imported by the driven adapter and the hook, nowhere
else: `PaymentIntent`, `client_secret` and `payment_intent.succeeded` stop at `stripe/`. The hook
is the way in: it hands `SettlePayment` Stripe's event id as the message id, since Stripe delivers
an event again and out of order, and the use case behind it claims the id (TX-5).
