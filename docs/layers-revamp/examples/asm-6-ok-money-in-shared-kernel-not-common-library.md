---
breaches: []
satisfies: [ASM-6]
situation: shared kernel Money and Sku, used by shop, payment and billing; common library holds plumbing only
---

# Common library exports plumbing; `Money` and `Sku` live in the shared kernel package

```ts
// common/src/index.ts — everything every system may import, no schema among it
export { createTransactionPort, type TransactionPort, type Transaction } from "./transaction"
export { createRelay, type OutboxReader, type Envelope, type Bus } from "./relay"
export { createBus } from "./bus"
export { courier, requestContext } from "./ambient"
export { logger } from "./logger"
export { tracer } from "./tracer"

// kernel/src/money.ts — @teeladen/kernel, a package of its own; shop, payment and billing domains import it
import { z } from "zod"
export const Money = z.object({ amount: z.number().int(), currency: z.enum(["EUR", "CHF"]) })
export type Money = z.infer<typeof Money>
export const add = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new CurrencyMismatch(a.currency, b.currency)
  return { amount: a.amount + b.amount, currency: a.currency }
}

// billing/src/domain/invoice.ts
import { Money } from "@teeladen/kernel"
export const Invoice = z.object({ id: z.string(), orderId: z.string(), total: Money, lines: z.array(InvoiceLine) })
```

Common library holds store clients, `TransactionPort`, the relay, the bus, the courier, logger and tracer, and
no schema: a change to any of them is a plumbing change, with no system's rule inside it. `Money`
and `Sku` are a model two systems agree on, and they sit in a package that is not the common
library, imported by the domains as a library that computes from its arguments. Which systems
share that package is a decision those systems make, visible in their `package.json`, and the
fulfillment worker, which never prices anything, does not load it.
