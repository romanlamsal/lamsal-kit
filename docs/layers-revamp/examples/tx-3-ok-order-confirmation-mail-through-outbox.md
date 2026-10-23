---
breaches: []
satisfies: [TX-3, TX-6, TX-18]
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

The mail provider holds the mailbox's data; a mail sent is a change to it. The use case asks for it by
writing a private message in the same transaction as the Order, so the message commits exactly when the
order does and never when it rolls back. Who sends it is shop's own handler (TX-11), later, with its own
retries. The service knows the mail provider by nothing: no SDK, no API key, no template engine.
