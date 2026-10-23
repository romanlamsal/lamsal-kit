---
breaches: []
satisfies: [SVC-1, SYS-10]
situation: shop offers place-order to its server action and to Payload hooks
---

# `PlaceOrder` driving port declared beside its service

```ts
// shop/service/place-order.ts
import type { Order, PlaceOrderInput } from "../domain/order"
import type { OrderRepository, CartRepository } from "../domain/ports"
import type { Transactions } from "@teeladen/common/transaction"

export type PlaceOrder = (input: PlaceOrderInput & { placedAt: Date }) => Promise<Order>

export type PlaceOrderDeps = {
    orders: OrderRepository
    carts: CartRepository
    transactions: Transactions
}

export const createPlaceOrder =
    ({ orders, carts, transactions }: PlaceOrderDeps): PlaceOrder =>
    async (input) => { /* … */ }

// shop/index.ts  (export path: published language + port types)
export * from "./domain/order"
export type { PlaceOrder } from "./service/place-order"
export type { CancelOrder } from "./service/cancel-order"
```

The use case "place an order" is declared where it is carried out, as a type, and the domain does not know it exists. The export path re-exports the domain's schemas as values and the driving ports as types, so a browser or billing importing shop's published language loads the domain and nothing else. Adding `ReleaseReservation` tomorrow changes the service folder and the export path, not the domain.
