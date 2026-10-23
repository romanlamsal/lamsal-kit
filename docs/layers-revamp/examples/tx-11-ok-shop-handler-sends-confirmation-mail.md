---
breaches: []
satisfies: [TX-11, TX-8, TX-5]
situation: shop sends an order-confirmation mail once the order commits
---

# Shop's own handler picks SendOrderConfirmation up and calls the mail provider through a driven port

```ts
// shop/driving/handlers.ts
export const buildShopHandlers = ({ sendOrderConfirmation, markOrderPaid, cancelOrder }: ShopServices) => ({
  SendOrderConfirmation: async (message: SendOrderConfirmation) => { await sendOrderConfirmation(message) },
  PaymentSucceeded: async (message: PaymentSucceeded) => { await markOrderPaid(message) },
  PaymentFailed: async (message: PaymentFailed) => { await cancelOrder(message) },
})

// shop/service/send-order-confirmation.ts
type Deps = { transaction: TransactionPort; handled: HandledMessages; mailer: Mailer }   // Mailer: shop's driven port

export const createSendOrderConfirmation =
  ({ transaction, handled, mailer }: Deps): SendOrderConfirmation =>
  async (message) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      await mailer.send({
        to: message.email,
        ...renderOrderConfirmation(message, message.locale),   // domain: subject and body from the message alone
        idempotencyKey: message.id,                             // the provider dedupes what a commit failure re-sends
      })
    })
```

The mail provider reads no bus; shop's handler is what turns the message into a call, through the
`Mailer` driven port whose adapter knows the provider's SDK. The call runs in the handler's own
transaction, apart from the checkout that wrote the message and committed long ago, so the provider
being down fails this transaction and the bus redelivers until the mail lands, while the Order stayed
committed throughout. The message id doubles as the provider's idempotency key, so a redelivery after a
sent-but-uncommitted claim does not reach the customer twice.
