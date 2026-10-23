---
breaches: [SVC-1]
satisfies: []
situation: shop keeps all its ports in one domain module
---

# Driving ports declared in `domain/ports.ts` next to the driven ports

```ts
// shop/domain/ports.ts
import type { Transaction } from "@teeladen/common/transaction"
import type { Cart } from "./cart"
import type { Order, PlaceOrderInput, CancelOrderInput } from "./order"

// driven
export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    save(order: Order, tx: Transaction): Promise<void>
}
export interface CartRepository {
    findById(id: string): Promise<Cart | null>
    save(cart: Cart, tx: Transaction): Promise<void>
}

// driving
export type PlaceOrder = (input: PlaceOrderInput) => Promise<Order>
export type CancelOrder = (input: CancelOrderInput) => Promise<Order>
export type MarkOrderPaid = (input: { orderId: string; paymentId: string }) => Promise<Order>

export interface ShopUseCases {
    placeOrder: PlaceOrder
    cancelOrder: CancelOrder
    markOrderPaid: MarkOrderPaid
}
```

"All ports in one place" reads tidy, and the developer who just wrote the driven ports adds the driving ones below. Now every importer of the domain, the browser rendering the cart, billing parsing `OrderPaid`, sees the full list of shop's use cases, and the domain changes each time a use case is added or renamed, for a reason that has nothing to do with the model. The rules say what an order is; that there is a "mark order paid" call is the service's business.
