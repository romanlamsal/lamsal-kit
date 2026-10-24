---
breaches: [SYS-10]
satisfies: []
situation: the browser imports shop's cart schema to render the cart form
---

# `export *` from the service module drags pino into the browser bundle

```ts
// packages/shop/service/checkout.ts
import { logger } from "@teeladen/common/logger"      // pino, ready-made: ASM-7 allows this
import type { OrderRepository } from "../service/ports/order-repository"
import type { PaymentIntents } from "../service/ports/payment-intents"

export type Checkout = (input: { cartId: string; customerId: string }) => Promise<{ orderId: string; clientSecret: string }>

export const createCheckout =
  (orders: OrderRepository, payments: PaymentIntents): Checkout =>
  async (input) => {
    logger.info({ cartId: input.cartId }, "checkout")
    // ...
  }

// packages/shop/index.ts
export * from "./domain/schemas"
export * from "./service/checkout"          // re-exports Checkout and createCheckout

// apps/web/components/cart-form.tsx — runs in the browser
import { cartSchema } from "@teeladen/shop"
```

One `export *` saves listing the port type, and it also re-exports `createCheckout`, a value. A bundler cannot erase a value export, so following `@teeladen/shop` for `cartSchema` walks into `checkout.ts`, and from there into pino and its `node:` modules: the browser build fails on `node:fs`, or ships a polyfill of a logger nobody in the browser calls. The same path in billing's test, wanted for one type, now loads shop's whole service graph. The ready-made logger is not the problem; ASM-7 permits it. The problem is that the published language's path loads a service.
