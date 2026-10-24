---
breaches: [DRV-8, TX-5]
satisfies: []
situation: shop sends an order-confirmation mail once the order commits
---

# The worker's assembly wires the mail adapter straight onto the bus; no shop handler exists

```ts
// apps/worker/assembly.ts
const bus = createBus(config.bus)
const relay = createRelay({ bus, readers: [...shop.outboxReaders, ...payment.outboxReaders] })
const mailer = createPostmarkMailer(config.postmark)   // shop's driven adapter, built here anyway

// SendOrderConfirmation has no state to change, it just needs sending: skip the handler ceremony
bus.subscribe("SendOrderConfirmation", async (raw: unknown) => {
  const message = sendOrderConfirmationSchema.parse(raw)
  await mailer.send({ to: message.email, ...renderOrderConfirmation(message, message.locale) })
})

bus.subscribe("PaymentSucceeded", shop.handlers.PaymentSucceeded)
bus.subscribe("PaymentFailed", shop.handlers.PaymentFailed)
bus.subscribe("OrderPaid", billing.handlers.OrderPaid)
```

The lambda the bus calls is a handler (glossary: Bus), and it calls a driven adapter, the mailer,
which is not on DRV-8's list: the use case of sending the mail is written into it, in the worker's
assembly, outside every system. Nothing makes it idempotent (TX-5): no idempotency key goes to the
provider, so the bus's redelivery after a timeout sends the mail twice; there is nothing a test of
shop can hand a fake to; and the next system that needs a mail copies the lambda. Shop's system
builder returns handlers for `PaymentSucceeded` and `PaymentFailed` and has no entry for the
message it writes most often.
