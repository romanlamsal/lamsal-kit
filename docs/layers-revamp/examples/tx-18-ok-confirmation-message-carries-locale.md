---
breaches: []
satisfies: [TX-18]
situation: the order-confirmation mail is rendered in the language the customer checked out in
---

# The checkout request's locale travels inside SendOrderConfirmation to the handler

```ts
// shop/driving/checkout-route.ts  (driving adapter: the server function)
export async function POST(req: Request) {
  const checkout = courier.get().shop.checkout
  const customer = await currentCustomer(req)                              // DRV-5
  const body = checkoutInputSchema.parse(await req.json())
  const locale = negotiateLocale(req.headers.get("accept-language"))       // the request has it; the port carries it
  const result = await checkout({ cartId: body.cartId, customerId: customer.id, locale })
  return Response.json(result)
}

// shop/service/checkout.ts (inside transaction.run)
await outbox.write(sendOrderConfirmation(order, locale), tx)   // message: { ..., email, locale: "de" | "en", lines, total }

// shop/service/send-order-confirmation.ts  (runs in the worker process, in no request)
async (message) =>
  transaction.run(async (tx) => {
    if (!(await handled.claim(message.id, tx))) return
    await mailer.send({ to: message.email, ...renderOrderConfirmation(message, message.locale), idempotencyKey: message.id })
  })
```

The handler runs in the worker process, minutes later, in no HTTP request: the `Accept-Language` that
chose German is gone. The driving adapter read it, the driving port carried it, and the checkout wrote
it into the message in the transaction that knew it, so the handler has the locale as a field and
renders the mail in the customer's language without reaching for anything ambient. The same goes for
the recipient address: the message carries it rather than the handler looking the customer up.
