---
breaches: []
satisfies: [SYS-11]
situation: payment creates a Stripe PaymentIntent and handles Stripe's webhooks
---

# Stripe's terms stop in payment's `stripe/` module

```ts
// packages/payment/domain/ports/payment-gateway.ts — driven port, payment's terms
export interface PaymentGateway {
  authorize(input: { paymentId: string; amount: Money }): Promise<{ externalRef: string; clientSecret: string }>
}

// packages/payment/stripe/gateway.ts — driven adapter, the way out
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

Stripe is an upstream whose code this codebase does not write, so payment puts an anti-corruption layer between them: one module, `stripe/`, holds the driven adapter that calls out and the hook Stripe calls into. `PaymentIntent`, `client_secret`, `payment_intent.succeeded` appear here and nowhere else; the domain's `Payment` holds an `externalRef` and an `outcome`, and `SettlePayment` is a port in payment's terms. When Stripe's API version renames a status or the webhook payload changes, the change is absorbed in these two files and the compiler shows nothing to do in domain or services.
