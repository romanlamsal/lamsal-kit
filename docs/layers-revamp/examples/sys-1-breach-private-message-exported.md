---
breaches: [SYS-1, SYS-2]
satisfies: []
situation: shop's private mail message leaves through the published language
---

# `export *` publishes shop's private mail message

```ts
// packages/shop/domain/messages.ts
export const orderPlacedSchema = z.object({ /* ... */ })
export const orderPaidSchema = z.object({ /* ... */ })
export const orderCancelledSchema = z.object({ /* ... */ })
// private: shop's own handler sends the confirmation mail
export const sendOrderConfirmationSchema = z.object({
  messageId: z.string().uuid(), orderId: z.string().uuid(),
  recipient: z.string().email(), locale: z.string(),
})

// packages/shop/index.ts
export * from "./domain/schemas"
export * from "./domain/messages"

// packages/billing/driving/handle-order-confirmation.ts — six months later
import { sendOrderConfirmationSchema } from "@teeladen/shop"
// billing attaches the invoice PDF to the confirmation mail: subscribe to shop's mail message
export const handleOrderConfirmation = (attachInvoice: AttachInvoice) => async (message: Message) => {
  const { orderId, recipient, locale } = sendOrderConfirmationSchema.parse(message.body)
  await attachInvoice({ messageId: message.id, orderId, recipient, locale })
}
```

The `export *` is the natural way to keep `index.ts` short, and it puts a private message on the published language's path. Billing finds `sendOrderConfirmationSchema` there and subscribes to it, which nobody in shop intended or notices. From then on the mail message is a contract: shop replacing `recipient` with a `customerId` and letting the mail handler look the address up breaks billing's handler at runtime (TX-7), on a message shop considered its own business.

A private message is in no published language (glossary: Message, Published language), so the path exports something that is no offer (SYS-1). The same `export *` re-exports the domain's schemas as the published language, which SYS-2 forbids.
