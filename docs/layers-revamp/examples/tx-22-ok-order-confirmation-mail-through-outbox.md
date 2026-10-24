---
breaches: []
satisfies: [TX-22, TX-6, ASM-3]
situation: shop sends an order-confirmation mail once the order commits
---

# The confirmation mail is a private message in shop's outbox, not a call to the mail provider

```ts
// shop/domain/messages/send-order-confirmation.ts
export const sendOrderConfirmationSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("SendOrderConfirmation"),
  orderId: orderIdSchema,
  email: z.string().email(),
  locale: z.enum(["de", "en"]),
  lines: z.array(orderLineSchema),
  total: moneySchema,
})
export const sendOrderConfirmation = (order: Order, locale: Locale): SendOrderConfirmation => ({
  id: randomUUID(), type: "SendOrderConfirmation", orderId: order.id, email: order.email, locale,
  lines: order.lines, total: order.total,
})

// shop/service/place-order.ts (inside transaction.run)
await orders.save(order, tx)
await carts.clear(cart.id, tx)
await outbox.write(orderPlaced(order), tx)
await outbox.write(sendOrderConfirmation(order, locale), tx)   // the mail is asked for, not sent, here
```

No system of this codebase holds the mail; the provider does, and it reads no bus. The use case
asks for the mail by writing a private message in the same transaction as the Order, so the
message commits exactly when the order does and never when it rolls back. Shop's own handler
handles it later, on the provider's behalf, calling a use case that sends the mail with the
message id as the provider's idempotency key and writes nothing of shop's (TX-22). The locale the
mail is rendered in travels in the message, since the handler runs in no request (ASM-3). The
placing service knows the mail provider by nothing: no SDK, no API key, no template engine.
