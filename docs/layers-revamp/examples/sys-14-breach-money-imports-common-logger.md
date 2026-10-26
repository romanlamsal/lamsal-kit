---
breaches: [SYS-14]
satisfies: [DOM-1]
situation: the shared kernel's Money, imported by every system's domain and by shop's checkout form
---

# `Money` logs its rounding through the common library's logger

```ts
// shared-kernel/money.ts
import { logger } from "@teeladen/common/logger"          // pino, with its transport

export const moneySchema = z.object({ cents: z.number().int(), currency: z.literal("EUR") })
export type Money = z.infer<typeof moneySchema>

export const percentOf = (money: Money, percent: number): Money => {
  const exact = (money.cents * percent) / 100
  const cents = Math.round(exact)
  if (cents !== exact) logger.debug({ exact, cents }, "money rounded")
  return { cents, currency: money.currency }
}

// billing/domain/invoice-line.ts — passes DOM-1: a shared kernel is on its list
import { percentOf } from "@teeladen/shared-kernel/money"
```

Billing's domain imports the shared kernel, which DOM-1 admits, and every domain that does now loads
pino and its transport. Shop's checkout form imports `moneySchema` to parse the total in the browser
and gets pino's Node transport in its bundle. A test of billing's VAT rule needs the logger set up or
writes to stdout. DOM-1 names the shared kernel, not what the shared kernel imports, so the domain's
purity leaks through the one door its list leaves open.
