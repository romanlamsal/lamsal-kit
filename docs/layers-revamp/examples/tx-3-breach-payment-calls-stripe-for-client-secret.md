---
breaches: [TX-3]
satisfies: []
situation: payment creates a Stripe PaymentIntent and returns its client_secret in the same call
finding: cannot-comply
---

# Create-payment calls Stripe synchronously because the client_secret has to come back

```ts
// payment/service/create-payment.ts
type Deps = { transaction: TransactionPort; payments: PaymentRepository; gateway: PaymentGateway }
// PaymentGateway: payment's driven port; the Stripe adapter behind it is the anti-corruption layer

export const createCreatePayment =
  ({ transaction, payments, gateway }: Deps): CreatePayment =>
  async ({ orderId, amount }) => {
    const existing = await payments.byOrderId(orderId)
    if (existing) return { paymentId: existing.id, clientSecret: existing.clientSecret }
    const payment = newPayment(orderId, amount)
    // the third party acts here, before anything of ours is committed
    const intent = await gateway.createIntent({ amount, idempotencyKey: payment.id })
    const open = withIntent(payment, intent)      // { intentId, clientSecret }
    await transaction.run((tx) => payments.save(open, tx))
    return { paymentId: open.id, clientSecret: open.clientSecret }
  }
```

The PaymentIntent is data Stripe holds; TX-3 wants the use case to write a message and TX-11's handler
to make the call. The `client_secret` exists only once Stripe has created the intent, and checkout
(domain.md) returns it in the same request, so the call cannot wait for a handler. The snippet does what
it can: the Stripe call sits outside payment's transaction, the idempotency key is payment's own id so a
repeated call after a crash gets the same intent, and the lookup by order makes the use case repeatable.
None of that is a message in the outbox; payment cannot comply with TX-3 for this use case.
