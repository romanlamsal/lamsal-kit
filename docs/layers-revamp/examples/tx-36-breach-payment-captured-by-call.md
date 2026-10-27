---
breaches: [TX-22]
satisfies: []
situation: payment returns a client_secret in the same call, and confirms the PaymentIntent in it
---

# Payment charges the card in the call checkout makes for the client secret

```ts
// payment/service/request-payment.ts  — called by shop's checkout, after its commit
export const createRequestPayment =
  ({ gateway, transaction, payments }: Deps): RequestPayment =>
  async ({ orderId, amount, paymentMethodId }) => {
    const intent = await gateway.createPaymentIntent({
      amount, reference: orderId, paymentMethodId,
      confirm: true,                                   // Stripe charges the card now
    })
    await transaction.run((tx) => payments.save(pending(orderId, intent.id), tx))
    return { clientSecret: intent.clientSecret }
  }
```

Named a request like the Checkout Session, this call confirms: with `confirm: true` Stripe charges
the card before it answers, and nothing is left to cancel; a refund is a second change, not a
cancellation. It is no tentative operation, so TX-36 does not hold, and TX-22's Scope does: a change
outside payment's store that no system of this codebase owns, made by a call. A crash between
Stripe's answer and payment's save leaves a charge no record of payment's knows, and shop, whose
call failed, retries checkout and charges again. The tentative request, a session that expires
unused, is `tx-22-ok-payment-requests-checkout-session.md`.
