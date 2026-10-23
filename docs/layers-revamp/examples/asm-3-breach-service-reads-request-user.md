---
breaches: [ASM-3, SVC-5]
satisfies: []
situation: shop's cancelOrder decides permission by the user in the request context; the PaymentFailed handler calls the same service
---

# cancelOrder reads the current user from AsyncLocalStorage

```ts
// shop/src/service/cancel-order.ts
import { requestContext } from "@teeladen/common"          // AsyncLocalStorage the server's middleware fills per request

export type CancelOrder = (input: { orderId: string; reason: CancelReason }) => Promise<void>

export const createCancelOrder = (deps: { tx: TransactionPort; orders: OrderRepository; outbox: ShopOutbox }): CancelOrder =>
  async ({ orderId, reason }) => {
    const user = requestContext.getStore()?.user
    if (!user || !mayCancel(user)) throw new NotAllowed("cancel")   // the current user decides whether this happens
    const order = await deps.orders.load(orderId)
    const cancelled = cancel(order, reason)
    const t = await deps.tx.begin()
    await deps.orders.save(cancelled, t)
    await deps.outbox.write(orderCancelled(cancelled), t)
    await deps.tx.commit(t)
  }

// shop/src/handlers/on-payment-failed.ts — handler, runs in the worker, in no request
export const onPaymentFailed = (cancelOrder: CancelOrder): Handler<PaymentFailed> =>
  async (message) => cancelOrder({ orderId: message.payload.orderId, reason: "payment-failed" })
```

`CancelOrder`'s signature says an order id and a reason suffice; the permission check depends on a
value no caller knows to supply. The route handler works, because the middleware filled the
context. The `PaymentFailed` handler runs in the worker where the request context is empty, so
`mayCancel` sees no user and every failed payment ends in `NotAllowed`: step 5 of the checkout saga
never runs, orders stay open past their deadline and fulfillment keeps stock reserved for dead
orders, with nothing in any signature pointing at the cause. A unit test with fake ports hits the
same wall and the author sets the context in `beforeEach`, hiding the breach instead of finding it.
