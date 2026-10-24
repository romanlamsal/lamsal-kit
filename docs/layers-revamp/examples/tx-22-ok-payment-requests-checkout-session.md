---
breaches: []
satisfies: [TX-22, TX-1, TX-5]
situation: payment requests a Stripe Checkout Session and returns its client_secret in the same call
---

# Payment requests a Checkout Session synchronously and stores nothing until the webhook

```ts
// payment/service/request-checkout-session.ts  (answers; writes nothing)
type Deps = { gateway: PaymentGateway }
// PaymentGateway: payment's driven port; the Stripe adapter behind it translates to Stripe's terms

export const createRequestCheckoutSession =
  ({ gateway }: Deps): RequestCheckoutSession =>
  async ({ orderId, amount, expiresAt }) => {
    const session = await gateway.createCheckoutSession({
      amount, expiresAt, reference: orderId, idempotencyKey: `checkout-${orderId}`,
    })
    return { clientSecret: session.clientSecret }
  }

// payment/service/record-payment.ts  (acts, on Stripe's webhook through payment's hook)
export const createRecordPayment =
  ({ transaction, payments, handled, outbox }: RecordDeps): RecordPayment =>
  async (event) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(event.id, tx))) return
      const payment = paymentFrom(event)                       // first record of the payment, from Stripe's confirmation
      await payments.save(payment, tx)
      await outbox.write(paymentSucceeded(payment), tx)
    })
```

A Checkout Session changes nothing it asks for: Stripe holds no money for it, and it expires
unused at the order's payment deadline. It is a tentative operation (glossary), outside TX-22's
Scope, so payment may request it in the call and hand the `client_secret` back. Payment's record
of a payment begins with the confirmation: Stripe's webhook reaches payment's hook, and one use
case records the payment and publishes `PaymentSucceeded` in one transaction. A request repeated
after a timeout gets the same session by its idempotency key, and an abandoned one leaves nothing
in payment to clean up.
