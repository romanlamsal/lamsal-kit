---
breaches: []
satisfies: [SYS-10, SVC-1]
situation: the browser imports shop's cart schema to render the cart form
---

# Shop's driving port types vanish at compile time

```ts
// packages/shop/service/checkout.ts — driving port beside its service
import type { Cart, Order } from "../published"   // published language: no domain import (SYS-2)
import type { OrderRepository } from "../service/ports/order-repository"
import type { PaymentIntents } from "../service/ports/payment-intents"
import type { Transactions } from "@teeladen/common/transactions"
import { logger } from "@teeladen/common/logger"

export type Checkout = (input: { cartId: Cart["id"]; customerId: string }) => Promise<{ order: Order; clientSecret: string }>

export const createCheckout =
  (orders: OrderRepository, payments: PaymentIntents, tx: Transactions): Checkout =>
  async (input) => { /* ... */ }

// packages/shop/index.ts
export * from "./published"
export type { Checkout } from "./service/checkout"

// apps/web/components/cart-form.tsx — runs in the browser
import { cartSchema } from "@teeladen/shop"
```

`export type` is erased when the package compiles, so `@teeladen/shop` resolves to `published` and nothing else: the browser bundle gets zod and the schemas, and the pino logger `checkout.ts` imports stays on the server. The driving port sits beside the service that implements it, outside the domain (SVC-1), and still travels to the downstream as a type. A test in billing that wants `Checkout` for a fake loads no store client.
