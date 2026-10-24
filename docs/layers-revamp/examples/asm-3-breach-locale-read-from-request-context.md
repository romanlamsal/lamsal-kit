---
breaches: [ASM-3]
satisfies: []
situation: the order-confirmation mail is rendered in the language the customer checked out in
---

# The handler's service reads the locale from the request context, like every server function does

```ts
// shop/domain/messages/send-order-confirmation.ts
export const sendOrderConfirmationSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("SendOrderConfirmation"),
  orderId: orderIdSchema,
  email: z.string().email(),
  lines: z.array(orderLineSchema),
  total: moneySchema,
})   // no locale: the whole app reads it from requestContext, so does this

// shop/service/send-order-confirmation.ts
import { requestContext } from "@teeladen/common/request-context"   // AsyncLocalStorage<{ requestId; locale }>

export const createSendOrderConfirmation =
  ({ transaction, handled, mailer }: Deps): SendOrderConfirmation =>
  async (message) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      const locale = requestContext.getStore()?.locale ?? "de"
      await mailer.send({ to: message.email, ...renderOrderConfirmation(message, locale), idempotencyKey: message.id })
    })
```

In the web process the request context holds the browser's language and this reads right. The handler
runs in the worker process, where the bus delivers the message in no request at all: `getStore()` is
`undefined`, the fallback kicks in, and every English-speaking customer receives a German confirmation.
In a test that runs the handler under a request context it passes, because the context happens to be
set. The request that knew the locale is gone when the handler runs; a field on the message would have
been written while it was there.
