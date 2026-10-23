---
breaches: []
satisfies: [TX-5, TX-6]
situation: Stripe webhooks arrive at least once, out of order, in Stripe's terms
---

# Payment's webhook handler claims Stripe's event id and lets the domain order the outcomes

```ts
// payment/driving/stripe-webhook.ts  (driving adapter; Stripe calls it)
export const stripeWebhook = (deps: { recordStripeEvent: RecordStripeEvent; webhookSecret: string }) =>
  async (req: Request) => {
    const event = verifySignature(await req.text(), req.headers.get("stripe-signature"), deps.webhookSecret)   // pure, anti-corruption layer module
    await deps.recordStripeEvent(toPaymentOutcome(event))   // anti-corruption layer: Stripe's event → payment's terms
    return new Response(null, { status: 200 })
  }

// payment/service/record-stripe-event.ts
export const createRecordStripeEvent =
  ({ transaction, handled, payments, outbox }: Deps): RecordStripeEvent =>
  async (outcome) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(outcome.eventId, tx))) return   // Stripe re-sent it; already recorded
      const payment = await payments.byIntentId(outcome.intentId, tx)
      if (!payment) throw new UnknownIntent(outcome.intentId)   // retried by Stripe, not swallowed
      const next = applyOutcome(payment, outcome)   // domain: a "failed" dated before a recorded "succeeded" changes nothing
      await payments.save(next.payment, tx)
      for (const m of next.messages) await outbox.write(m, tx)   // PaymentSucceeded | PaymentFailed
    })
```

Stripe retries until it gets a 200, so the same event arrives more than once; the claim on `evt_…` in
the same transaction as the Payment write makes the second arrival a no-op and a crash before commit a
clean retry. An unknown intent is thrown, not read as "nothing to do", so Stripe keeps delivering until
payment has the Payment row. Ordering is the domain's, by Stripe's `created` timestamp carried in the
outcome, not the handler's, and the published message commits with the Payment it tells of.
