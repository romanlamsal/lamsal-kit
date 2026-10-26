---
breaches: []
satisfies: [ASM-9, TX-1, TX-6, SVC-6]
situation: shop's checkout writes Order and Cart in one transaction, then calls payment's open host service in-process
---

# Checkout opens the transaction, hands it to each repository, and calls payment outside it

```ts
// common/src/transaction.ts — opaque to every domain that names it
declare const brand: unique symbol
export type Transaction = { readonly [brand]: "Transaction" }

// shop/src/service/ports/transaction-port.ts — shop's driven port, implemented by the common library
import type { Transaction } from "@teeladen/common"
export type TransactionPort = {
  begin(): Promise<Transaction>
  commit(t: Transaction): Promise<void>
  rollback(t: Transaction): Promise<void>
}

// shop/src/service/checkout.ts
export const createCheckout = (deps: { tx: TransactionPort; carts: CartRepository; orders: OrderRepository; outbox: ShopOutbox; payment: PaymentIntents }): Checkout =>
  async ({ cartId }) => {
    const cart = await deps.carts.load(cartId)
    const order = placeOrder(cart)                                        // domain
    const t = await deps.tx.begin()
    try {
      await deps.orders.save(order, t)
      await deps.carts.clear(cartId, t)
      await deps.outbox.write(orderPlaced(order), t)
      await deps.tx.commit(t)
    } catch (e) {
      await deps.tx.rollback(t)
      throw e
    }
    const intent = await deps.payment.createIntent({ orderId: order.id, amount: order.total })   // no transaction crosses
    return { orderId: order.id, clientSecret: intent.clientSecret }
  }
```

The transaction is a value with a name in every signature it crosses: `save(order, t)`,
`clear(cartId, t)`, `write(message, t)`. A repository called without one is visible as such and
commits on its own. Payment's open host service, in-process here, receives no `t`, so its
repositories cannot read shop's uncommitted order and the transaction stays inside the system that
opened it, which is what the fixture asks of the boundary. A test hands `createCheckout` a fake
`TransactionPort` and asserts what the fake repositories hold after `commit`.
