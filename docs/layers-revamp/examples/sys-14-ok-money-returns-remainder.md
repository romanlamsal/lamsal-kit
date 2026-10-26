---
breaches: []
satisfies: [SYS-14, DOM-1]
situation: the shared kernel's Money and shop's published OrderPlaced, imported by other systems and by the browser
---

# `Money` and shop's published language import nothing but each other and zod

```ts
// shared-kernel/money.ts — a library that computes from its arguments, and nothing else
import { z } from "zod"

export const moneySchema = z.object({ cents: z.number().int(), currency: z.literal("EUR") })
export type Money = z.infer<typeof moneySchema>

export const percentOf = (money: Money, percent: number): { amount: Money; roundedBy: number } => {
  const exact = (money.cents * percent) / 100
  const cents = Math.round(exact)
  return { amount: { cents, currency: money.currency }, roundedBy: cents - exact }
}

// shop/published/messages.ts — shop's published language: a shared kernel and zod
import { z } from "zod"
import { moneySchema } from "@teeladen/shared-kernel/money"
import { skuSchema } from "@teeladen/shared-kernel/sku"

export const orderPlacedSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderPlaced"), orderId: z.string(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive(), unitPrice: moneySchema })),
})
```

`percentOf` returns what it rounded, and the caller that cares logs it, in a layer that may import the
logger. Whoever imports `Money` or shop's published language loads zod and the shared kernel: billing's
domain, fulfillment's handler, the checkout form in the browser.
