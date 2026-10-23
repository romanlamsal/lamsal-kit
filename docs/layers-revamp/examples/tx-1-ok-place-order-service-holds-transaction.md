---
breaches: []
satisfies: [TX-1, TX-14, TX-6]
situation: shop places the order, clears the cart and publishes OrderPlaced
---

# Place-order service opens, hands over and commits the transaction

```ts
// shop/service/place-order.ts
import type { Transaction, TransactionPort } from "@teeladen/common/transaction"
import { placeOrder, orderPlaced, sendOrderConfirmation } from "../domain"
import type { CartRepository, OrderRepository, ShopOutbox } from "../domain/ports"

type Deps = { transaction: TransactionPort; carts: CartRepository; orders: OrderRepository; outbox: ShopOutbox }

export const createPlaceOrder =
  ({ transaction, carts, orders, outbox }: Deps): PlaceOrder =>
  async ({ cartId, customerId, locale }) =>
    transaction.run(async (tx: Transaction) => {
      const cart = await carts.byId(cartId, tx)
      if (!cart) throw new CartNotFound(cartId)
      const order = placeOrder(cart, customerId)
      await orders.save(order, tx)
      await carts.clear(cart.id, tx)
      await outbox.write(orderPlaced(order), tx)
      await outbox.write(sendOrderConfirmation(order, locale), tx)
      return { orderId: order.id }
    })
```

The service is the one piece of code that sees the whole use case, so it opens the transaction through
the common library's transaction port, hands the same `tx` to every repository method and to the outbox
port, and `run` commits when the callback returns. No repository decides which writes land together; the
Order, the cleared Cart and the two messages commit as one. The `Transaction` type is the common
library's opaque one, so no store client's name enters the service or the domain.
