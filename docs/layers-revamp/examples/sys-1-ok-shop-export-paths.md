---
breaches: []
satisfies: [SYS-1, SYS-2, SYS-10]
situation: shop's export paths carry published language, driving port types, system builders, a fake
---

# Shop exports its offer and nothing else

```ts
// packages/shop/index.ts — published language and driving port types
export {
  orderSchema, cartSchema, productCommercialSchema,
  orderPlacedSchema, orderPaidSchema, orderCancelledSchema,
} from "./published"
export type { Order, Cart, ProductCommercial, OrderPlaced, OrderPaid, OrderCancelled } from "./published"
export { OrderNotOpen, ProductNotFound } from "./published/errors"
export type { PlaceOrder } from "./service/place-order"
export type { Checkout } from "./service/checkout"
export type { OrderDetails } from "./service/order-details"

// packages/shop/build.ts — system builders, one per way shop is driven
export { buildShopOpenHostService } from "./builders/open-host-service"
export { buildShopHandlers } from "./builders/handlers"
export { buildShopOutboxReader } from "./builders/outbox-reader"
export { buildShopHooks } from "./builders/hooks"

// packages/shop/testing.ts — fake of the driving ports; production never loads this path
export { fakeShop } from "./testing/fake-shop"
```

Three paths, each one kind of offer. Billing and fulfillment import schemas and errors from `index.ts`, the server's and the worker's assembly import builders from `build.ts`, a downstream's test imports `fakeShop` from `testing.ts`. No driven port, service or driven adapter leaves the package, so shop can replace its Drizzle repository without touching a downstream. The driving port types are exported as types, so loading `index.ts` loads the published language only (SYS-10), and the published language is declared apart from the domain, which shop's services translate to and from (SYS-2).
